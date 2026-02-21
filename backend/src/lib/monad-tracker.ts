import { createPublicClient, http, parseAbiItem, formatEther, defineChain } from 'viem';
import { EventEmitter } from 'events';
import { log, logError } from './log.js';
import { supabase, DB_ENABLED } from './supabase.js';
import { resolveToken, getSwapHistorySince, type NadToken, type NadSwap } from './nadfun-api.js';

const MONAD_RPC = process.env.MONAD_RPC_URL || 'https://monad-mainnet.drpc.org';
const CURVE_ADDRESS = '0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE' as const;
const POLL_MS = 3_000;
const API_POLL_MS = 15_000;
const LOG_CHUNK_SIZE = 5000;
const CONCURRENCY = 5;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SECS_PER_BLOCK = 1;

const monadChain = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
});

const rpc = createPublicClient({
  chain: monadChain,
  transport: http(MONAD_RPC),
});

const CURVE_BUY_EVENT = parseAbiItem(
  'event CurveBuy(address indexed sender, address indexed token, uint256 amountIn, uint256 amountOut)',
);
const CURVE_SELL_EVENT = parseAbiItem(
  'event CurveSell(address indexed sender, address indexed token, uint256 amountIn, uint256 amountOut)',
);

export interface MonadSwapRecord {
  token: string;
  direction: 'buy' | 'sell';
  amountIn: string;
  amountOut: string;
  price: number;
  volumeMON: number;
  sender: string;
  blockNumber: number;
  txHash: string;
  timestamp: number;
}

interface TrackedTokenState {
  meta: NadToken | null;
  swaps: MonadSwapRecord[];
  backfillBlocks: number;
  backfilling: boolean;
}

function computePrice(direction: 'buy' | 'sell', amountIn: bigint, amountOut: bigint): number {
  if (direction === 'buy') {
    const tokensOut = Number(formatEther(amountOut));
    if (tokensOut === 0) return 0;
    return Number(formatEther(amountIn)) / tokensOut;
  }
  const monOut = Number(formatEther(amountOut));
  const tokensIn = Number(formatEther(amountIn));
  if (tokensIn === 0) return 0;
  return monOut / tokensIn;
}

function apiSwapsToRecords(token: string, apiSwaps: NadSwap[]): MonadSwapRecord[] {
  return apiSwaps.map(s => {
    const info = s.swap_info;
    const direction: 'buy' | 'sell' = info.event_type === 'BUY' ? 'buy' : 'sell';
    const nativeAmount = Number(formatEther(BigInt(info.native_amount)));
    const tokenAmount = Number(formatEther(BigInt(info.token_amount)));
    const price = tokenAmount > 0 ? nativeAmount / tokenAmount : 0;
    const amountIn = direction === 'buy' ? info.native_amount : info.token_amount;
    const amountOut = direction === 'buy' ? info.token_amount : info.native_amount;
    return {
      token: token.toLowerCase(),
      direction,
      amountIn,
      amountOut,
      price,
      volumeMON: nativeAmount,
      sender: '',
      blockNumber: 0,
      txHash: info.transaction_hash,
      timestamp: info.created_at * 1000,
    };
  });
}

async function dbClearMonadSwaps(token: string): Promise<void> {
  if (!DB_ENABLED || !supabase) return;
  const { error } = await supabase.from('monad_swaps').delete().eq('token_address', token.toLowerCase());
  if (error) logError('monad-db', `Clear swaps: ${error.message}`);
}

async function dbInsertMonadSwaps(swaps: MonadSwapRecord[]): Promise<void> {
  if (!DB_ENABLED || !supabase || swaps.length === 0) return;
  const rows = swaps.map(s => ({
    token_address: s.token.toLowerCase(),
    direction: s.direction,
    amount_in: s.amountIn,
    amount_out: s.amountOut,
    sender: s.sender.toLowerCase(),
    block_number: s.blockNumber,
    tx_hash: s.txHash,
    swapped_at: new Date(s.timestamp).toISOString(),
  }));
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('monad_swaps').insert(batch);
    if (error) logError('monad-db', `Insert swaps: ${error.message}`);
  }
}

export async function dbQueryMonadSwaps(token: string, sinceMs: number): Promise<MonadSwapRecord[]> {
  if (!DB_ENABLED || !supabase) return [];
  const since = new Date(sinceMs).toISOString();
  const { data, error } = await supabase
    .from('monad_swaps')
    .select('*')
    .eq('token_address', token.toLowerCase())
    .gte('swapped_at', since)
    .order('swapped_at', { ascending: true });

  if (error) { logError('monad-db', `Query swaps: ${error.message}`); return []; }
  return (data ?? []).map(row => ({
    token: row.token_address,
    direction: row.direction as 'buy' | 'sell',
    amountIn: row.amount_in,
    amountOut: row.amount_out,
    price: computePrice(
      row.direction as 'buy' | 'sell',
      BigInt(row.amount_in),
      BigInt(row.amount_out),
    ),
    volumeMON: Number(formatEther(BigInt(row.direction === 'buy' ? row.amount_in : row.amount_out))),
    sender: row.sender,
    blockNumber: row.block_number,
    txHash: row.tx_hash,
    timestamp: new Date(row.swapped_at).getTime(),
  }));
}

class MonadTokenTracker extends EventEmitter {
  private tokens = new Map<string, TrackedTokenState>();
  private lastBlock = BigInt(0);
  private interval: ReturnType<typeof setInterval> | null = null;
  private apiInterval: ReturnType<typeof setInterval> | null = null;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    try {
      this.lastBlock = await rpc.getBlockNumber();
      log('monad-tracker', `Starting at block ${this.lastBlock}`);
    } catch (err) {
      logError('monad-tracker', `Failed to get block number: ${err instanceof Error ? err.message : 'unknown'}`);
      this.lastBlock = BigInt(0);
    }

    if (DB_ENABLED && supabase) {
      const { data } = await supabase.from('monad_tracked_tokens').select('*');
      for (const row of data ?? []) {
        const addr = row.token_address.toLowerCase();
        this.tokens.set(addr, {
          meta: { name: row.name, symbol: row.symbol, image_url: row.image_url, graduated: false, creator: '' },
          swaps: [],
          backfillBlocks: 0,
          backfilling: false,
        });
        log('monad-tracker', `Loaded tracked token: ${row.symbol || row.token_address}`);
        resolveToken(addr).then(meta => {
          const state = this.tokens.get(addr);
          if (state && meta) {
            state.meta = meta;
            if (meta.graduated) log('monad-tracker', `${meta.symbol || addr.slice(0, 10)} marked as graduated — API polling enabled`);
          }
        }).catch(() => {});
      }
    }

    this.interval = setInterval(() => this.poll(), POLL_MS);
    this.apiInterval = setInterval(() => this.pollApi(), API_POLL_MS);
    if (this.tokens.size > 0) this.poll();
  }

  async track(tokenAddress: string): Promise<boolean> {
    const addr = tokenAddress.toLowerCase();
    if (this.tokens.has(addr)) return true;

    let meta: NadToken | null = null;
    try {
      meta = await resolveToken(addr);
    } catch { /* proceed without metadata */ }

    this.tokens.set(addr, { meta, swaps: [], backfillBlocks: 0, backfilling: false });

    if (DB_ENABLED && supabase) {
      await supabase.from('monad_tracked_tokens').upsert({
        token_address: addr,
        name: meta?.name ?? null,
        symbol: meta?.symbol ?? null,
        image_url: meta?.image_url ?? null,
      }, { onConflict: 'token_address' }).then(({ error }) => {
        if (error) logError('monad-db', `Upsert token: ${error.message}`);
      });
    }

    const label = meta?.symbol || addr.slice(0, 10);
    log('monad-tracker', `Now tracking ${label} — backfilling...`);

    const initialBlocks = Math.round((1 * 60 * 60) / SECS_PER_BLOCK);
    this.backfill(addr, initialBlocks).catch(err =>
      logError('monad-tracker', `Backfill failed for ${label}: ${err instanceof Error ? err.message : 'unknown'}`),
    );

    return true;
  }

  isTracked(tokenAddress: string): boolean {
    return this.tokens.has(tokenAddress.toLowerCase());
  }

  getSwaps(tokenAddress: string, sinceTimestamp?: number): MonadSwapRecord[] {
    const state = this.tokens.get(tokenAddress.toLowerCase());
    if (!state) return [];
    if (sinceTimestamp) return state.swaps.filter(s => s.timestamp >= sinceTimestamp);
    return state.swaps;
  }

  getTokenMeta(tokenAddress: string): NadToken | null {
    return this.tokens.get(tokenAddress.toLowerCase())?.meta ?? null;
  }

  hasBackfill(tokenAddress: string, blocksNeeded: number): boolean {
    const state = this.tokens.get(tokenAddress.toLowerCase());
    return !!state && state.backfillBlocks >= blocksNeeded;
  }

  isBackfilling(tokenAddress: string): boolean {
    return this.tokens.get(tokenAddress.toLowerCase())?.backfilling ?? false;
  }

  trackedTokens(): string[] {
    return Array.from(this.tokens.keys());
  }

  getLastBlock(): number {
    return Number(this.lastBlock);
  }

  ingestCurveEvent(
    direction: 'buy' | 'sell',
    tokenAddress: string,
    sender: string,
    amountIn: bigint,
    amountOut: bigint,
    blockNumber: number,
    txHash: string,
    timestamp: number,
  ): boolean {
    const addr = tokenAddress.toLowerCase();
    const state = this.tokens.get(addr);
    if (!state) return false;

    if (state.swaps.some(s => s.txHash === txHash && s.direction === direction && s.amountIn === amountIn.toString())) {
      return false;
    }

    const price = computePrice(direction, amountIn, amountOut);
    const swap: MonadSwapRecord = {
      token: addr,
      direction,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      price,
      volumeMON: Number(formatEther(direction === 'buy' ? amountIn : amountOut)),
      sender,
      blockNumber,
      txHash,
      timestamp,
    };

    state.swaps.push(swap);
    this.emit('swap', swap);
    dbInsertMonadSwaps([swap]).catch(() => {});
    return true;
  }

  async backfill(tokenAddress: string, blocksBack: number): Promise<void> {
    const addr = tokenAddress.toLowerCase();
    const state = this.tokens.get(addr);
    if (!state) return;
    if (state.backfillBlocks >= blocksBack) return;
    if (state.backfilling) return; // don't wait — callers should check isBackfilling()

    state.backfilling = true;
    try {
      const now = Date.now();
      const label = state.meta?.symbol || addr.slice(0, 10);
      const sinceTs = Math.floor((now - blocksBack * SECS_PER_BLOCK * 1000) / 1000);

      // Try nad.fun API first — much faster than scanning 86K+ blocks on-chain
      log('monad-tracker', `Backfilling ${label} — trying nad.fun API first...`);
      const apiSwaps = await getSwapHistorySince(addr, sinceTs);
      if (apiSwaps.length > 0) {
        const converted = apiSwapsToRecords(addr, apiSwaps);
        converted.sort((a, b) => a.timestamp - b.timestamp);
        state.swaps = converted;
        state.backfillBlocks = blocksBack;
        const totalVol = converted.reduce((s, sw) => s + sw.volumeMON, 0);
        log('monad-tracker', `Backfilled ${label} via API: ${converted.length} swaps | vol ${totalVol.toFixed(2)} MON`);
        await dbClearMonadSwaps(addr);
        await dbInsertMonadSwaps(converted);
        return;
      }

      // Fall back to on-chain log scanning with incremental writes
      const currentBlock = await rpc.getBlockNumber();
      const startBlock = currentBlock - BigInt(blocksBack);
      log('monad-tracker', `${label}: API returned 0 swaps — scanning ${blocksBack} blocks on-chain...`);

      const parseBuyLog = (entry: any): MonadSwapRecord => {
        const { sender, token, amountIn, amountOut } = entry.args as {
          sender: string; token: string; amountIn: bigint; amountOut: bigint;
        };
        const blockDiff = Number(currentBlock - BigInt(entry.blockNumber));
        const ts = now - blockDiff * SECS_PER_BLOCK * 1000;
        return {
          token: token.toLowerCase(), direction: 'buy',
          amountIn: amountIn.toString(), amountOut: amountOut.toString(),
          price: computePrice('buy', amountIn, amountOut),
          volumeMON: Number(formatEther(amountIn)),
          sender, blockNumber: Number(entry.blockNumber),
          txHash: entry.transactionHash ?? '', timestamp: ts,
        };
      };

      const parseSellLog = (entry: any): MonadSwapRecord => {
        const { sender, token, amountIn, amountOut } = entry.args as {
          sender: string; token: string; amountIn: bigint; amountOut: bigint;
        };
        const blockDiff = Number(currentBlock - BigInt(entry.blockNumber));
        const ts = now - blockDiff * SECS_PER_BLOCK * 1000;
        return {
          token: token.toLowerCase(), direction: 'sell',
          amountIn: amountIn.toString(), amountOut: amountOut.toString(),
          price: computePrice('sell', amountIn, amountOut),
          volumeMON: Number(formatEther(amountOut)),
          sender, blockNumber: Number(entry.blockNumber),
          txHash: entry.transactionHash ?? '', timestamp: ts,
        };
      };

      const onBuyBatch = (logs: any[]) => {
        const swaps = logs.map(parseBuyLog);
        if (swaps.length > 0) {
          state.swaps.push(...swaps);
          state.swaps.sort((a, b) => a.blockNumber - b.blockNumber);
          dbInsertMonadSwaps(swaps).catch(() => {});
        }
      };

      const onSellBatch = (logs: any[]) => {
        const swaps = logs.map(parseSellLog);
        if (swaps.length > 0) {
          state.swaps.push(...swaps);
          state.swaps.sort((a, b) => a.blockNumber - b.blockNumber);
          dbInsertMonadSwaps(swaps).catch(() => {});
        }
      };

      await Promise.all([
        this.fetchLogs(CURVE_BUY_EVENT, addr as `0x${string}`, startBlock, currentBlock, onBuyBatch),
        this.fetchLogs(CURVE_SELL_EVENT, addr as `0x${string}`, startBlock, currentBlock, onSellBatch),
      ]);

      state.backfillBlocks = blocksBack;

      if (state.swaps.length > 0) {
        const totalVol = state.swaps.reduce((s, sw) => s + sw.volumeMON, 0);
        log('monad-tracker', `Backfilled ${label}: ${state.swaps.length} swaps | vol ${totalVol.toFixed(2)} MON`);
      } else {
        log('monad-tracker', `Backfilled ${label}: 0 swaps (on-chain + API)`);
      }
    } catch (err) {
      logError('monad-tracker', `Backfill failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      state.backfilling = false;
    }
  }

  private async poll() {
    if (this.tokens.size === 0) return;

    try {
      const currentBlock = await rpc.getBlockNumber();
      if (currentBlock <= this.lastBlock) return;

      const fromBlock = this.lastBlock + BigInt(1);
      const now = Date.now();

      const tokenAddrs = Array.from(this.tokens.keys()) as `0x${string}`[];

      const [buyLogs, sellLogs] = await Promise.all([
        rpc.getLogs({
          address: CURVE_ADDRESS,
          event: CURVE_BUY_EVENT,
          args: { token: tokenAddrs },
          fromBlock,
          toBlock: currentBlock,
        }).catch(() => [] as any[]),
        rpc.getLogs({
          address: CURVE_ADDRESS,
          event: CURVE_SELL_EVENT,
          args: { token: tokenAddrs },
          fromBlock,
          toBlock: currentBlock,
        }).catch(() => [] as any[]),
      ]);

      this.lastBlock = currentBlock;

      const allNew: MonadSwapRecord[] = [];

      for (const entry of buyLogs) {
        const { sender, token, amountIn, amountOut } = entry.args as {
          sender: string; token: string; amountIn: bigint; amountOut: bigint;
        };
        const addr = token.toLowerCase();
        const state = this.tokens.get(addr);
        if (!state) continue;
        const price = computePrice('buy', amountIn, amountOut);
        const swap: MonadSwapRecord = {
          token: addr,
          direction: 'buy',
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          price,
          volumeMON: Number(formatEther(amountIn)),
          sender,
          blockNumber: Number(entry.blockNumber),
          txHash: entry.transactionHash ?? '',
          timestamp: now,
        };
        state.swaps.push(swap);
        allNew.push(swap);
        this.emit('swap', swap);
      }

      for (const entry of sellLogs) {
        const { sender, token, amountIn, amountOut } = entry.args as {
          sender: string; token: string; amountIn: bigint; amountOut: bigint;
        };
        const addr = token.toLowerCase();
        const state = this.tokens.get(addr);
        if (!state) continue;
        const price = computePrice('sell', amountIn, amountOut);
        const swap: MonadSwapRecord = {
          token: addr,
          direction: 'sell',
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          price,
          volumeMON: Number(formatEther(amountOut)),
          sender,
          blockNumber: Number(entry.blockNumber),
          txHash: entry.transactionHash ?? '',
          timestamp: now,
        };
        state.swaps.push(swap);
        allNew.push(swap);
        this.emit('swap', swap);
      }

      if (allNew.length > 0) {
        log('monad-tracker', `poll ${Number(fromBlock)}..${Number(currentBlock)} — ${allNew.length} swaps`);
        dbInsertMonadSwaps(allNew).catch(() => {});
      }

      this.prune();
    } catch (err) {
      logError('monad-tracker', `Poll failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private async pollApi() {
    const graduated = Array.from(this.tokens.entries())
      .filter(([, s]) => s.meta?.graduated)
      .map(([addr]) => addr);
    if (graduated.length === 0) return;

    for (const addr of graduated) {
      try {
        const state = this.tokens.get(addr);
        if (!state) continue;

        const latestTs = state.swaps.length > 0
          ? Math.floor(state.swaps[state.swaps.length - 1].timestamp / 1000)
          : Math.floor((Date.now() - 60_000) / 1000);

        const apiSwaps = await getSwapHistorySince(addr, latestTs);
        if (apiSwaps.length === 0) continue;

        const converted = apiSwapsToRecords(addr, apiSwaps);
        const existingHashes = new Set(state.swaps.map(s => s.txHash));
        const newSwaps = converted.filter(s => !existingHashes.has(s.txHash));
        if (newSwaps.length === 0) continue;

        newSwaps.sort((a, b) => a.timestamp - b.timestamp);
        state.swaps.push(...newSwaps);

        for (const swap of newSwaps) this.emit('swap', swap);
        dbInsertMonadSwaps(newSwaps).catch(() => {});

        const label = state.meta?.symbol || addr.slice(0, 10);
        log('monad-tracker', `API poll ${label}: ${newSwaps.length} new swap(s)`);
      } catch (err) {
        logError('monad-tracker', `API poll ${addr.slice(0, 10)}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }

  private prune() {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const state of this.tokens.values()) {
      const idx = state.swaps.findIndex(s => s.timestamp >= cutoff);
      if (idx > 0) state.swaps.splice(0, idx);
    }
  }

  private async fetchLogsChunk(event: any, tokenAddress: `0x${string}`, from: bigint, to: bigint): Promise<any[]> {
    try {
      return await rpc.getLogs({
        address: CURVE_ADDRESS,
        event,
        args: { token: tokenAddress },
        fromBlock: from,
        toBlock: to,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('block range') || msg.includes('too large') || msg.includes('exceed')) {
        const mid = from + (to - from) / BigInt(2);
        if (mid === from) return [];
        log('monad-tracker', `Splitting chunk ${Number(from)}..${Number(to)} (range too large)`);
        const [a, b] = await Promise.all([
          this.fetchLogsChunk(event, tokenAddress, from, mid),
          this.fetchLogsChunk(event, tokenAddress, mid + BigInt(1), to),
        ]);
        return [...a, ...b];
      }
      throw err;
    }
  }

  private async fetchLogs(event: any, tokenAddress: `0x${string}`, fromBlock: bigint, toBlock: bigint, onBatch?: (logs: any[]) => void): Promise<void> {
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
        batch.map(({ from: f, to: t }) => this.fetchLogsChunk(event, tokenAddress, f, t)),
      );
      const batchLogs: any[] = [];
      for (const logs of results) batchLogs.push(...logs);
      if (onBatch) onBatch(batchLogs);
    }
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.apiInterval) clearInterval(this.apiInterval);
    this.started = false;
  }
}

export const monadTracker = new MonadTokenTracker();
