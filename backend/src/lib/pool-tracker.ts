import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { getCachedPool, resolvePool, type PoolMeta } from './pool-cache.js';
import { log, logDebug, logError } from './log.js';
import { supabase, DB_ENABLED } from './supabase.js';
import { EventEmitter } from 'events';

const RPC_URL = process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com';
const POLL_MS = 4_000;
const LOG_CHUNK_SIZE = 5000;
const CONCURRENCY = 5;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SECS_PER_BLOCK = 12;
const INITIAL_BACKFILL_BLOCKS = Math.round((7 * 24 * 60 * 60) / SECS_PER_BLOCK); // ~50400 (7 days)

const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
);

const rpcClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export interface SwapRecord {
  pool: string;
  blockNumber: number;
  price: number;
  volumeUSD: number;
  feeUSD: number;
  txHash: string;
  timestamp: number;
}

interface TrackedPoolState {
  meta: PoolMeta;
  swaps: SwapRecord[];
  backfillBlocks: number;
  backfilling: boolean;
}

export function tickToPrice(tick: number, decimals0: number, decimals1: number, invert: boolean): number {
  const rawPrice = 1.0001 ** tick;
  const humanPrice = rawPrice * 10 ** (decimals0 - decimals1);
  return invert ? 1 / humanPrice : humanPrice;
}

export function swapVolumeUSD(amount0: bigint, amount1: bigint, price: number, meta: PoolMeta): number {
  const abs0 = amount0 < BigInt(0) ? -amount0 : amount0;
  const abs1 = amount1 < BigInt(0) ? -amount1 : amount1;
  const human0 = Number(formatUnits(abs0, meta.decimals0));
  const human1 = Number(formatUnits(abs1, meta.decimals1));
  const stables = ['USDC', 'USDT', 'DAI'];
  if (stables.includes(meta.token0Symbol)) return human0;
  if (stables.includes(meta.token1Symbol)) return human1;
  return Math.max(human0, human1) * price;
}

function parseSwapLog(entry: any, poolName: string, meta: PoolMeta, timestamp: number): SwapRecord {
  const { amount0, amount1, tick } = entry.args as {
    amount0: bigint;
    amount1: bigint;
    tick: number;
  };
  const price = tickToPrice(tick, meta.decimals0, meta.decimals1, meta.invert);
  const volumeUSD = swapVolumeUSD(amount0, amount1, price, meta);
  const feeUSD = volumeUSD * (meta.feeTier / 1_000_000);
  return {
    pool: poolName,
    blockNumber: Number(entry.blockNumber),
    price: Math.round(price * 100) / 100,
    volumeUSD: Math.round(volumeUSD * 100) / 100,
    feeUSD: Math.round(feeUSD * 100) / 100,
    txHash: entry.transactionHash ?? '',
    timestamp,
  };
}

// ─── Database helpers ────────────────────────────────────────────────

async function dbLoadTrackedPools(): Promise<Array<{ name: string; meta: PoolMeta }>> {
  if (!DB_ENABLED || !supabase) return [];
  const { data, error } = await supabase.from('tracked_pools').select('*');
  if (error) { logError('db', `Load pools: ${error.message}`); return []; }
  return (data ?? []).map(row => ({
    name: row.name,
    meta: {
      address: row.address as `0x${string}`,
      token0Symbol: row.token0_symbol,
      token1Symbol: row.token1_symbol,
      token0Address: row.token0_address as `0x${string}`,
      token1Address: row.token1_address as `0x${string}`,
      decimals0: row.decimals0,
      decimals1: row.decimals1,
      feeTier: row.fee_tier,
      invert: row.invert,
    },
  }));
}

async function dbUpsertPool(name: string, meta: PoolMeta): Promise<void> {
  if (!DB_ENABLED || !supabase) return;
  const { error } = await supabase.from('tracked_pools').upsert({
    name,
    address: meta.address,
    token0_symbol: meta.token0Symbol,
    token1_symbol: meta.token1Symbol,
    token0_address: meta.token0Address,
    token1_address: meta.token1Address,
    decimals0: meta.decimals0,
    decimals1: meta.decimals1,
    fee_tier: meta.feeTier,
    invert: meta.invert,
  }, { onConflict: 'name' });
  if (error) logError('db', `Upsert pool ${name}: ${error.message}`);
}

async function dbInsertSwaps(swaps: SwapRecord[]): Promise<void> {
  if (!DB_ENABLED || !supabase || swaps.length === 0) return;
  const rows = swaps.map(s => ({
    pool_name: s.pool,
    block_number: s.blockNumber,
    tx_hash: s.txHash,
    price: s.price,
    volume_usd: s.volumeUSD,
    fee_usd: s.feeUSD,
    swapped_at: new Date(s.timestamp).toISOString(),
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('swaps')
      .upsert(batch, { onConflict: 'pool_name,block_number,tx_hash', ignoreDuplicates: true });
    if (error) logError('db', `Insert swaps batch: ${error.message}`);
  }
}

export async function dbQuerySwaps(
  poolName: string,
  sinceMs: number,
): Promise<SwapRecord[]> {
  if (!DB_ENABLED || !supabase) return [];
  const since = new Date(sinceMs).toISOString();

  const { data, error } = await supabase
    .from('swaps')
    .select('pool_name, block_number, tx_hash, price, volume_usd, fee_usd, swapped_at')
    .eq('pool_name', poolName)
    .gte('swapped_at', since)
    .order('swapped_at', { ascending: true });

  if (error) { logError('db', `Query swaps: ${error.message}`); return []; }
  return (data ?? []).map(row => ({
    pool: row.pool_name,
    blockNumber: row.block_number,
    price: Number(row.price),
    volumeUSD: Number(row.volume_usd),
    feeUSD: Number(row.fee_usd),
    txHash: row.tx_hash,
    timestamp: new Date(row.swapped_at).getTime(),
  }));
}

// ─── Tracker ─────────────────────────────────────────────────────────

class PoolTracker extends EventEmitter {
  private pools = new Map<string, TrackedPoolState>();
  private lastBlock = BigInt(0);
  private interval: ReturnType<typeof setInterval> | null = null;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    this.lastBlock = await rpcClient.getBlockNumber();
    log('tracker', `Starting at block ${this.lastBlock}`);

    if (DB_ENABLED) {
      const dbPools = await dbLoadTrackedPools();
      for (const { name, meta } of dbPools) {
        this.pools.set(name, { meta, swaps: [], backfillBlocks: 0, backfilling: false });
        log('tracker', `Loaded from DB: ${name}`);
      }
    }

    this.interval = setInterval(() => this.poll(), POLL_MS);
    this.poll();
  }

  async track(poolName: string): Promise<boolean> {
    if (this.pools.has(poolName)) return true;

    const parts = poolName.split('/');
    if (parts.length !== 2) return false;

    let meta = getCachedPool(poolName);
    if (!meta) {
      try {
        meta = await resolvePool(parts[0], parts[1]);
      } catch {
        return false;
      }
    }

    this.pools.set(poolName, { meta, swaps: [], backfillBlocks: 0, backfilling: false });
    dbUpsertPool(poolName, meta).catch(() => {});
    log('tracker', `Now tracking ${poolName} (${meta.address}) — backfilling 7 days`);

    this.backfill(poolName, INITIAL_BACKFILL_BLOCKS).catch(err =>
      logError('tracker', `Initial backfill failed for ${poolName}: ${err instanceof Error ? err.message : 'unknown'}`),
    );

    return true;
  }

  isTracked(poolName: string): boolean {
    return this.pools.has(poolName);
  }

  getSwaps(poolName: string, sinceTimestamp?: number): SwapRecord[] {
    const state = this.pools.get(poolName);
    if (!state) return [];
    if (sinceTimestamp) {
      return state.swaps.filter(s => s.timestamp >= sinceTimestamp);
    }
    return state.swaps;
  }

  getPoolMeta(poolName: string): PoolMeta | undefined {
    return this.pools.get(poolName)?.meta;
  }

  getPoolMetaByAddress(address: string): { name: string; meta: PoolMeta } | undefined {
    const lower = address.toLowerCase();
    for (const [name, state] of this.pools) {
      if (state.meta.address.toLowerCase() === lower) return { name, meta: state.meta };
    }
    return undefined;
  }

  ingestSwapEvent(poolAddress: string, args: { amount0: bigint; amount1: bigint; tick: number }, blockNumber: number, txHash: string): SwapRecord | null {
    const match = this.getPoolMetaByAddress(poolAddress);
    if (!match) return null;

    const { name, meta } = match;
    const state = this.pools.get(name);
    if (!state) return null;

    const price = tickToPrice(args.tick, meta.decimals0, meta.decimals1, meta.invert);
    const volumeUSD = swapVolumeUSD(args.amount0, args.amount1, price, meta);
    const feeUSD = volumeUSD * (meta.feeTier / 1_000_000);

    const swap: SwapRecord = {
      pool: name,
      blockNumber,
      price: Math.round(price * 100) / 100,
      volumeUSD: Math.round(volumeUSD * 100) / 100,
      feeUSD: Math.round(feeUSD * 100) / 100,
      txHash,
      timestamp: Date.now(),
    };

    state.swaps.push(swap);
    this.emit('swap', swap);

    dbInsertSwaps([swap]).catch(() => {});

    logDebug('swap', `${swap.pool} | $${swap.price.toLocaleString()} | vol $${swap.volumeUSD.toFixed(2)} | block ${swap.blockNumber}`);

    return swap;
  }

  hasBackfill(poolName: string, blocksNeeded: number): boolean {
    const state = this.pools.get(poolName);
    return !!state && state.backfillBlocks >= blocksNeeded;
  }

  isBackfilling(poolName: string): boolean {
    return this.pools.get(poolName)?.backfilling ?? false;
  }

  async backfill(poolName: string, blocksBack: number): Promise<void> {
    const state = this.pools.get(poolName);
    if (!state) return;
    if (state.backfillBlocks >= blocksBack) return;
    if (state.backfilling) return; // don't wait — callers should check isBackfilling()

    state.backfilling = true;

    try {
      const sinceMs = Date.now() - blocksBack * SECS_PER_BLOCK * 1000;

      if (DB_ENABLED) {
        const dbSwaps = await dbQuerySwaps(poolName, sinceMs);
        if (dbSwaps.length > 0) {
          const prices = dbSwaps.map(s => s.price);
          const vols = dbSwaps.reduce((sum, s) => sum + s.volumeUSD, 0);
          log('tracker', `${poolName} — loaded ${dbSwaps.length} swaps from DB | vol $${vols.toFixed(2)} | price range $${Math.min(...prices).toFixed(2)}–$${Math.max(...prices).toFixed(2)}`);
          state.swaps = dbSwaps;
          state.backfillBlocks = blocksBack;
          return;
        }
      }

      const daysBack = ((blocksBack * SECS_PER_BLOCK) / 86400).toFixed(1);
      log('tracker', `Backfilling ${poolName} from chain — ${blocksBack} blocks (~${daysBack} days)...`);
      const currentBlock = await rpcClient.getBlockNumber();
      const startBlock = currentBlock - BigInt(blocksBack);
      const now = Date.now();

      const onBatchComplete = (batchLogs: any[]) => {
        const batchSwaps: SwapRecord[] = [];
        for (const entry of batchLogs) {
          const blockDiff = Number(currentBlock - BigInt(entry.blockNumber));
          const timestamp = now - blockDiff * SECS_PER_BLOCK * 1000;
          batchSwaps.push(parseSwapLog(entry, poolName, state.meta, timestamp));
        }
        if (batchSwaps.length > 0) {
          state.swaps.push(...batchSwaps);
          state.swaps.sort((a, b) => a.blockNumber - b.blockNumber);
          dbInsertSwaps(batchSwaps).catch(() => {});
        }
      };

      await this.fetchLogs(state.meta.address, startBlock, currentBlock, onBatchComplete);

      const seen = new Set<string>();
      state.swaps = state.swaps.filter(s => {
        const key = `${s.blockNumber}:${s.txHash}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      state.backfillBlocks = blocksBack;

      if (state.swaps.length > 0) {
        const prices = state.swaps.map(s => s.price);
        const totalVol = state.swaps.reduce((sum, s) => sum + s.volumeUSD, 0);
        const totalFees = state.swaps.reduce((sum, s) => sum + s.feeUSD, 0);
        const latestPrice = state.swaps[state.swaps.length - 1].price;
        log('tracker', `Backfilled ${poolName}: ${state.swaps.length} swaps | latest $${latestPrice.toFixed(2)} | range $${Math.min(...prices).toFixed(2)}–$${Math.max(...prices).toFixed(2)} | total vol $${totalVol.toFixed(2)} | total fees $${totalFees.toFixed(2)}`);
      } else {
        log('tracker', `Backfilled ${poolName}: 0 swaps found on chain`);
      }
    } catch (err) {
      logError('tracker', `Backfill failed for ${poolName}: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      state.backfilling = false;
    }
  }

  trackedPools(): string[] {
    return Array.from(this.pools.keys());
  }

  getLastBlock(): number {
    return Number(this.lastBlock);
  }

  private async poll() {
    if (this.pools.size === 0) return;

    try {
      const currentBlock = await rpcClient.getBlockNumber();
      if (currentBlock <= this.lastBlock) return;

      const fromBlock = this.lastBlock + BigInt(1);
      const now = Date.now();

      const entries = Array.from(this.pools.entries());
      const results = await Promise.all(
        entries.map(([name, state]) =>
          rpcClient
            .getLogs({
              address: state.meta.address,
              event: SWAP_EVENT,
              fromBlock,
              toBlock: currentBlock,
            })
            .then(logs => ({ name, state, logs }))
            .catch(err => {
              logError('tracker', `Poll failed for ${name}: ${err instanceof Error ? err.message : 'unknown'}`);
              return { name, state, logs: [] as any[] };
            }),
        ),
      );

      this.lastBlock = currentBlock;

      const allNewSwaps: SwapRecord[] = [];
      const summary: string[] = [];

      for (const { name, state, logs } of results) {
        summary.push(`${name}:${logs.length}`);
        for (const entry of logs) {
          const swap = parseSwapLog(entry, name, state.meta, now);
          state.swaps.push(swap);
          allNewSwaps.push(swap);
          this.emit('swap', swap);
        }
      }

      if (allNewSwaps.length > 0) {
        let totalVol = 0;
        let totalFees = 0;
        const poolPrices = new Map<string, number>();
        for (const s of allNewSwaps) {
          totalVol += s.volumeUSD;
          totalFees += s.feeUSD;
          poolPrices.set(s.pool, s.price);
        }

        const priceSnap = Array.from(poolPrices.entries()).map(([p, px]) => `${p}=$${px.toLocaleString()}`).join(', ');
        log('tracker', `poll ${Number(fromBlock)}..${Number(currentBlock)} — ${allNewSwaps.length} swap(s) | vol $${totalVol.toFixed(2)} | [${priceSnap}]`);

        dbInsertSwaps(allNewSwaps).catch(() => {});
      }

      this.prune();
    } catch (err) {
      logError('tracker', `Block poll failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private prune() {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const state of this.pools.values()) {
      const idx = state.swaps.findIndex(s => s.timestamp >= cutoff);
      if (idx > 0) state.swaps.splice(0, idx);
    }
  }

  private async fetchLogs(address: `0x${string}`, fromBlock: bigint, toBlock: bigint, onBatch?: (logs: any[]) => void): Promise<void> {
    const chunks: Array<{ from: bigint; to: bigint }> = [];
    let from = fromBlock;
    while (from <= toBlock) {
      const to = from + BigInt(LOG_CHUNK_SIZE - 1) > toBlock ? toBlock : from + BigInt(LOG_CHUNK_SIZE - 1);
      chunks.push({ from, to });
      from = to + BigInt(1);
    }

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(({ from: f, to: t }) =>
          rpcClient.getLogs({ address, event: SWAP_EVENT, fromBlock: f, toBlock: t }),
        ),
      );
      const batchLogs: any[] = [];
      for (const logs of results) batchLogs.push(...logs);
      if (onBatch) onBatch(batchLogs);
    }
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.started = false;
  }
}

export const tracker = new PoolTracker();
