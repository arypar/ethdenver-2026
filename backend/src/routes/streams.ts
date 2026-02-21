import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { broadcastStreamTx, broadcastLiquidityEvent } from '../lib/ws-server.js';
import { tracker } from '../lib/pool-tracker.js';
import { monadTracker } from '../lib/monad-tracker.js';
import { log, logDebug, logError } from '../lib/log.js';
import { getCachedPool } from '../lib/pool-cache.js';
import { createPublicClient, http, erc20Abi, parseAbiItem, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const tvlRpc = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com'),
});

/*
 * ============================================================
 * QuickNode Stream Setup — Two Streams Required
 * ============================================================
 *
 * 1) ETH Mainnet Stream
 *    Chain:       Ethereum Mainnet
 *    Dataset:     block_with_receipts
 *    Destination: POST → {BACKEND_URL}/streams/webhook/eth
 *
 *    Filter function (paste into QuickNode dashboard):
 *
 *    function main(stream) {
 *      var poolAbi = JSON.stringify([
 *        {"anonymous":false,"inputs":[{"indexed":true,"type":"address","name":"sender"},{"indexed":true,"type":"address","name":"recipient"},{"type":"int256","name":"amount0"},{"type":"int256","name":"amount1"},{"type":"uint160","name":"sqrtPriceX96"},{"type":"uint128","name":"liquidity"},{"type":"int24","name":"tick"}],"name":"Swap","type":"event"},
 *        {"anonymous":false,"inputs":[{"type":"address","name":"sender"},{"indexed":true,"type":"address","name":"owner"},{"indexed":true,"type":"int24","name":"tickLower"},{"indexed":true,"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount"},{"type":"uint256","name":"amount0"},{"type":"uint256","name":"amount1"}],"name":"Mint","type":"event"},
 *        {"anonymous":false,"inputs":[{"indexed":true,"type":"address","name":"owner"},{"indexed":true,"type":"int24","name":"tickLower"},{"indexed":true,"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount"},{"type":"uint256","name":"amount0"},{"type":"uint256","name":"amount1"}],"name":"Burn","type":"event"},
 *        {"anonymous":false,"inputs":[{"indexed":true,"type":"address","name":"owner"},{"type":"address","name":"recipient"},{"indexed":true,"type":"int24","name":"tickLower"},{"indexed":true,"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount0"},{"type":"uint128","name":"amount1"}],"name":"Collect","type":"event"}
 *      ]);
 *      var data = stream.data;
 *      if (!data || !data.length) return null;
 *      var decoded = decodeEVMReceipts(data[0].receipts, [poolAbi]);
 *      var matched = decoded.filter(function(r) {
 *        return r.decodedLogs && r.decodedLogs.length > 0;
 *      });
 *      if (matched.length === 0) return null;
 *      return {
 *        block: { number: data[0].number, hash: data[0].hash, timestamp: data[0].timestamp },
 *        receipts: matched
 *      };
 *    }
 *
 * 2) Monad Mainnet Stream — nad.fun CurveBuy/CurveSell events
 *    Chain:       Monad (chain ID 143)
 *    Dataset:     block_with_receipts
 *    Destination: POST → {BACKEND_URL}/streams/webhook/monad
 *
 *    Filter function (paste into QuickNode dashboard):
 *
 *    function main(stream) {
 *      var curveAbi = JSON.stringify([
 *        {"anonymous":false,"inputs":[{"indexed":true,"type":"address","name":"sender"},{"indexed":true,"type":"address","name":"token"},{"type":"uint256","name":"amountIn"},{"type":"uint256","name":"amountOut"}],"name":"CurveBuy","type":"event"},
 *        {"anonymous":false,"inputs":[{"indexed":true,"type":"address","name":"sender"},{"indexed":true,"type":"address","name":"token"},{"type":"uint256","name":"amountIn"},{"type":"uint256","name":"amountOut"}],"name":"CurveSell","type":"event"}
 *      ]);
 *      var data = stream.data;
 *      if (!data || !data.length) return null;
 *      var decoded = decodeEVMReceipts(data[0].receipts, [curveAbi]);
 *      var CURVE = '0xa7283d07812a02afb7c09b60f8896bcea3f90ace';
 *      var matched = decoded.filter(function(r) {
 *        if (!r.decodedLogs) return false;
 *        r.decodedLogs = r.decodedLogs.filter(function(l) {
 *          return l.address && l.address.toLowerCase() === CURVE;
 *        });
 *        return r.decodedLogs.length > 0;
 *      });
 *      if (matched.length === 0) return null;
 *      return {
 *        block: { number: data[0].number, hash: data[0].hash, timestamp: data[0].timestamp },
 *        receipts: matched
 *      };
 *    }
 *
 *    NOTE: The webhook handler also accepts the legacy raw-block format
 *    (Block with transactions) for backward compatibility.
 * ============================================================
 */

const router = Router();

const SLOT0_ABI = [
  {
    inputs: [], name: 'slot0', stateMutability: 'view', type: 'function',
    outputs: [
      { type: 'uint160', name: 'sqrtPriceX96' },
      { type: 'int24', name: 'tick' },
      { type: 'uint16', name: 'observationIndex' },
      { type: 'uint16', name: 'observationCardinality' },
      { type: 'uint16', name: 'observationCardinalityNext' },
      { type: 'uint8', name: 'feeProtocol' },
      { type: 'bool', name: 'unlocked' },
    ],
  },
] as const;

const STABLECOINS = new Set(['USDC', 'USDT', 'DAI']);

const WETH_USDC_POOL = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640' as Address;

async function getEthPriceUsd(): Promise<number> {
  try {
    const slot0 = await tvlRpc.readContract({
      address: WETH_USDC_POOL, abi: SLOT0_ABI, functionName: 'slot0',
    });
    const sqrtPrice = Number(slot0[0]) / 2 ** 96;
    const rawPrice = sqrtPrice * sqrtPrice;
    return 1e12 / rawPrice;
  } catch {
    return 0;
  }
}

function computeUsdTvl(
  bal0: bigint, bal1: bigint,
  dec0: number, dec1: number,
  sym0: string, sym1: string,
  sqrtPriceX96: bigint,
  ethPriceUsd: number,
): { usd0: number; usd1: number; total: number } {
  const bal0Human = Number(bal0) / 10 ** dec0;
  const bal1Human = Number(bal1) / 10 ** dec1;

  const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
  const rawPrice = sqrtPrice * sqrtPrice;
  const token1PriceInToken0 = (rawPrice === 0) ? 0 : 1 / (rawPrice * 10 ** (dec0 - dec1));

  const s0Stable = STABLECOINS.has(sym0);
  const s1Stable = STABLECOINS.has(sym1);
  const s0Eth = sym0 === 'WETH' || sym0 === 'ETH';
  const s1Eth = sym1 === 'WETH' || sym1 === 'ETH';

  let usd0 = 0;
  let usd1 = 0;

  if (s0Stable) {
    usd0 = bal0Human;
    usd1 = bal1Human * token1PriceInToken0;
  } else if (s1Stable) {
    const token0PriceInToken1 = rawPrice * 10 ** (dec0 - dec1);
    usd0 = bal0Human * token0PriceInToken1;
    usd1 = bal1Human;
  } else if (s0Eth && ethPriceUsd > 0) {
    usd0 = bal0Human * ethPriceUsd;
    usd1 = bal1Human * token1PriceInToken0 * ethPriceUsd;
  } else if (s1Eth && ethPriceUsd > 0) {
    const token0PriceInToken1 = rawPrice * 10 ** (dec0 - dec1);
    usd0 = bal0Human * token0PriceInToken1 * ethPriceUsd;
    usd1 = bal1Human * ethPriceUsd;
  }

  return { usd0, usd1, total: usd0 + usd1 };
}

// ── Uniswap V3 pool event ABIs for direct RPC log fetching ──
const MintEventAbi = parseAbiItem(
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
);
const BurnEventAbi = parseAbiItem(
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
);
const CollectEventAbi = parseAbiItem(
  'event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)',
);

const backfillState = new Map<string, { lastBlock: number; lastFetchMs: number }>();
const BACKFILL_COOLDOWN_MS = 30_000;
const BACKFILL_LOOKBACK = 2000;

async function backfillLiquidityEvents(poolAddress: string): Promise<any[]> {
  const pool = poolAddress.toLowerCase() as Address;
  const now = Date.now();
  const state = backfillState.get(pool);

  if (state && now - state.lastFetchMs < BACKFILL_COOLDOWN_MS) return [];

  try {
    const currentBlock = await tvlRpc.getBlockNumber();
    const fromBlock = state?.lastBlock
      ? BigInt(state.lastBlock + 1)
      : currentBlock - BigInt(BACKFILL_LOOKBACK);

    if (fromBlock > currentBlock) {
      backfillState.set(pool, { lastBlock: Number(currentBlock), lastFetchMs: now });
      return [];
    }

    const [mintLogs, burnLogs, collectLogs] = await Promise.all([
      tvlRpc.getLogs({ address: pool, event: MintEventAbi, fromBlock, toBlock: 'latest' }),
      tvlRpc.getLogs({ address: pool, event: BurnEventAbi, fromBlock, toBlock: 'latest' }),
      tvlRpc.getLogs({ address: pool, event: CollectEventAbi, fromBlock, toBlock: 'latest' }),
    ]);

    const allLogs = [...mintLogs, ...burnLogs, ...collectLogs];
    if (allLogs.length === 0) {
      backfillState.set(pool, { lastBlock: Number(currentBlock), lastFetchMs: now });
      return [];
    }

    const uniqueBlockNums = [...new Set(allLogs.map(l => l.blockNumber))];
    const blockTimestamps = new Map<bigint, string>();
    for (let i = 0; i < uniqueBlockNums.length; i += 10) {
      const batch = uniqueBlockNums.slice(i, i + 10);
      const blocks = await Promise.all(batch.map(bn => tvlRpc.getBlock({ blockNumber: bn })));
      blocks.forEach((b, j) => {
        blockTimestamps.set(batch[j], new Date(Number(b.timestamp) * 1000).toISOString());
      });
    }

    const rows: any[] = [];

    for (const l of mintLogs) {
      rows.push({
        chain: 'eth', pool_address: pool, event_type: 'mint',
        owner: String(l.args.owner || ''),
        tick_lower: Number(l.args.tickLower ?? 0),
        tick_upper: Number(l.args.tickUpper ?? 0),
        amount: String(l.args.amount ?? '0'),
        amount0: String(l.args.amount0 ?? '0'),
        amount1: String(l.args.amount1 ?? '0'),
        block_number: Number(l.blockNumber),
        tx_hash: l.transactionHash,
        block_timestamp: blockTimestamps.get(l.blockNumber) || new Date().toISOString(),
      });
    }
    for (const l of burnLogs) {
      rows.push({
        chain: 'eth', pool_address: pool, event_type: 'burn',
        owner: String(l.args.owner || ''),
        tick_lower: Number(l.args.tickLower ?? 0),
        tick_upper: Number(l.args.tickUpper ?? 0),
        amount: String(l.args.amount ?? '0'),
        amount0: String(l.args.amount0 ?? '0'),
        amount1: String(l.args.amount1 ?? '0'),
        block_number: Number(l.blockNumber),
        tx_hash: l.transactionHash,
        block_timestamp: blockTimestamps.get(l.blockNumber) || new Date().toISOString(),
      });
    }
    for (const l of collectLogs) {
      rows.push({
        chain: 'eth', pool_address: pool, event_type: 'collect',
        owner: String(l.args.owner || ''),
        tick_lower: Number(l.args.tickLower ?? 0),
        tick_upper: Number(l.args.tickUpper ?? 0),
        amount: '0',
        amount0: String(l.args.amount0 ?? '0'),
        amount1: String(l.args.amount1 ?? '0'),
        block_number: Number(l.blockNumber),
        tx_hash: l.transactionHash,
        block_timestamp: blockTimestamps.get(l.blockNumber) || new Date().toISOString(),
      });
    }

    rows.sort((a, b) => b.block_number - a.block_number);

    if (DB_ENABLED && supabase && rows.length > 0) {
      const existingResult = await supabase
        .from('liquidity_events')
        .select('tx_hash, event_type, tick_lower, tick_upper')
        .eq('pool_address', pool)
        .gte('block_number', Number(fromBlock));
      const existingKeys = new Set(
        (existingResult.data || []).map(
          (r: any) => `${r.tx_hash}:${r.event_type}:${r.tick_lower}:${r.tick_upper}`,
        ),
      );
      const newRows = rows.filter(
        r => !existingKeys.has(`${r.tx_hash}:${r.event_type}:${r.tick_lower}:${r.tick_upper}`),
      );
      if (newRows.length > 0) {
        const { error } = await supabase.from('liquidity_events').insert(newRows);
        if (error) logError('streams', `Backfill DB insert: ${error.message}`);
      }
    }

    backfillState.set(pool, { lastBlock: Number(currentBlock), lastFetchMs: now });
    logDebug('streams', `[eth] Backfilled ${rows.length} liquidity event(s) for ${pool.slice(0, 10)}...`);
    return rows;
  } catch (err: any) {
    logError('streams', `Backfill error for ${pool}: ${err.message}`);
    backfillState.set(pool, { lastBlock: state?.lastBlock || 0, lastFetchMs: now });
    return [];
  }
}

// ── Monad Uniswap router addresses ──
const MONAD_ROUTERS = new Set([
  '0x0d97dc33264bfc1c226207428a79b26757fb9dc3',
  '0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900',
]);

// ── Helpers ──
function hexToNumber(hex: string | undefined): number {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function hexToDecStr(hex: string | undefined): string {
  if (!hex) return '0';
  try { return BigInt(hex).toString(); } catch { return '0'; }
}

// ── Types ──
interface RawTx {
  hash: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  input?: string;
  blockNumber?: string;
  blockHash?: string;
  transactionIndex?: string;
  type?: string;
}

interface RawBlock {
  hash?: string;
  number?: string;
  timestamp?: string;
  transactions?: RawTx[];
}

interface StreamTxRow {
  chain: string;
  tx_hash: string;
  block_number: number;
  block_hash: string;
  tx_index: number;
  from_address: string;
  to_address: string | null;
  value: string;
  gas_limit: string;
  gas_price: string;
  method_id: string;
  tx_type: string;
  block_timestamp: string;
}

interface DecodedLog {
  address: string;
  name: string;
  [key: string]: unknown;
}

interface DecodedReceipt {
  transactionHash: string;
  from?: string;
  to?: string;
  decodedLogs?: DecodedLog[];
}

interface EthPayload {
  block: { number: string; hash: string; timestamp: string };
  receipts: DecodedReceipt[];
}

// ── POST /webhook/monad ── decoded CurveBuy/CurveSell events from Monad stream
// Accepts two payload formats:
//   1. Decoded receipts (block_with_receipts + decodeEVMReceipts filter) — preferred
//   2. Legacy raw blocks (block_with_transactions) — falls back to raw tx logging
router.post('/webhook/monad', async (req, res) => {
  const token = process.env.QUICKNODE_STREAM_TOKEN;
  if (token && req.headers['x-qn-api-key'] !== token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const body = req.body;

    // ── Format 1: Decoded receipts (new stream with block_with_receipts) ──
    if (body?.block && body?.receipts) {
      const blockNumber = hexToNumber(body.block.number);
      const blockTs = hexToNumber(body.block.timestamp);
      const timestamp = blockTs * 1000;
      let curveEvents = 0;

      for (const receipt of body.receipts as DecodedReceipt[]) {
        if (!receipt.decodedLogs) continue;
        const txHash = receipt.transactionHash;

        for (const dlog of receipt.decodedLogs) {
          if (dlog.name !== 'CurveBuy' && dlog.name !== 'CurveSell') continue;

          const direction: 'buy' | 'sell' = dlog.name === 'CurveBuy' ? 'buy' : 'sell';
          const tokenAddr = String(dlog.token || '').toLowerCase();
          const sender = String(dlog.sender || '');
          const amountIn = BigInt(String(dlog.amountIn || '0'));
          const amountOut = BigInt(String(dlog.amountOut || '0'));

          const ingested = monadTracker.ingestCurveEvent(
            direction, tokenAddr, sender, amountIn, amountOut, blockNumber, txHash, timestamp,
          );
          if (ingested) curveEvents++;
        }
      }

      if (curveEvents > 0) {
        log('streams', `[monad] block ${blockNumber} — ${curveEvents} curve event(s) ingested`);
      }
      res.json({ ok: true, chain: 'monad', block: blockNumber, curveEvents });
      return;
    }

    // ── Format 2: Legacy raw blocks (backward compat) ──
    let blocks: RawBlock[] = [];
    if (Array.isArray(body)) blocks = body;
    else if (body?.data && Array.isArray(body.data)) blocks = body.data;
    else if (body?.hash && body?.transactions) blocks = [body];

    let totalInserted = 0;

    for (const block of blocks) {
      const blockNumber = hexToNumber(block.number);
      const blockHash = block.hash || '';
      const blockTs = hexToNumber(block.timestamp);
      const blockDate = new Date(blockTs * 1000).toISOString();

      if (!block.transactions) continue;

      const txs: StreamTxRow[] = block.transactions
        .filter((tx) => tx.to && MONAD_ROUTERS.has(tx.to.toLowerCase()))
        .map((tx) => ({
          chain: 'monad',
          tx_hash: tx.hash,
          block_number: blockNumber,
          block_hash: blockHash,
          tx_index: hexToNumber(tx.transactionIndex),
          from_address: tx.from,
          to_address: tx.to || null,
          value: hexToDecStr(tx.value),
          gas_limit: hexToDecStr(tx.gas),
          gas_price: hexToDecStr(tx.gasPrice || tx.maxFeePerGas),
          method_id: (tx.input && tx.input.length >= 10) ? tx.input.slice(0, 10) : '',
          tx_type: tx.type || '0x0',
          block_timestamp: blockDate,
        }));

      if (txs.length === 0) continue;

      if (DB_ENABLED && supabase) {
        const { error } = await supabase
          .from('stream_transactions')
          .upsert(txs as any[], { onConflict: 'tx_hash', ignoreDuplicates: true });
        if (error) logError('streams', `Monad DB insert: ${error.message}`);
      }

      for (const tx of txs) broadcastStreamTx('monad', { ...tx });
      totalInserted += txs.length;
    }

    log('streams', `[monad] ${blocks.length} block(s), ${totalInserted} tx(s)`);
    res.json({ ok: true, chain: 'monad', blocks: blocks.length, transactions: totalInserted });
  } catch (err: any) {
    logError('streams', `Monad webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook/eth ── decoded Uniswap V3 events from ETH stream
router.post('/webhook/eth', async (req, res) => {
  const token = process.env.QUICKNODE_STREAM_TOKEN;
  if (token && req.headers['x-qn-api-key'] !== token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const body = req.body as EthPayload;
    if (!body?.block || !body?.receipts) {
      logDebug('streams', `[eth] No block/receipts in payload — keys: [${Object.keys(body || {}).join(', ')}]`);
      res.json({ ok: true, chain: 'eth', swaps: 0, liquidity: 0 });
      return;
    }

    const blockNumber = hexToNumber(body.block.number);
    const blockHash = body.block.hash || '';
    const blockTs = hexToNumber(body.block.timestamp);
    const blockDate = new Date(blockTs * 1000).toISOString();

    let swapCount = 0;
    let liqCount = 0;
    const streamTxRows: StreamTxRow[] = [];
    const liqRows: any[] = [];

    for (const receipt of body.receipts) {
      if (!receipt.decodedLogs || receipt.decodedLogs.length === 0) continue;

      const txHash = receipt.transactionHash;

      for (const dlog of receipt.decodedLogs) {
        const poolAddress = dlog.address?.toLowerCase() || '';

        if (dlog.name === 'Swap') {
          swapCount++;

          const amount0 = BigInt(String(dlog.amount0 || '0'));
          const amount1 = BigInt(String(dlog.amount1 || '0'));
          const tick = Number(dlog.tick || 0);

          tracker.ingestSwapEvent(poolAddress, { amount0, amount1, tick }, blockNumber, txHash);

          streamTxRows.push({
            chain: 'eth',
            tx_hash: txHash,
            block_number: blockNumber,
            block_hash: blockHash,
            tx_index: 0,
            from_address: receipt.from || '',
            to_address: receipt.to || null,
            value: '0',
            gas_limit: '0',
            gas_price: '0',
            method_id: 'swap',
            tx_type: '0x2',
            block_timestamp: blockDate,
          });

          broadcastStreamTx('eth', {
            tx_hash: txHash,
            block_number: blockNumber,
            from_address: receipt.from || '',
            to_address: receipt.to || null,
            pool_address: poolAddress,
            method_id: 'swap',
            block_timestamp: blockDate,
          });
        }

        if (dlog.name === 'Mint' || dlog.name === 'Burn' || dlog.name === 'Collect') {
          liqCount++;
          const eventType = dlog.name.toLowerCase();

          const row = {
            chain: 'eth',
            pool_address: poolAddress,
            event_type: eventType,
            owner: String(dlog.owner || ''),
            tick_lower: Number(dlog.tickLower ?? 0),
            tick_upper: Number(dlog.tickUpper ?? 0),
            amount: String(dlog.amount || '0'),
            amount0: String(dlog.amount0 || '0'),
            amount1: String(dlog.amount1 || '0'),
            block_number: blockNumber,
            tx_hash: txHash,
            block_timestamp: blockDate,
          };

          liqRows.push(row);

          broadcastLiquidityEvent('eth', row);
        }
      }
    }

    if (DB_ENABLED && supabase) {
      if (streamTxRows.length > 0) {
        const { error } = await supabase
          .from('stream_transactions')
          .upsert(streamTxRows as any[], { onConflict: 'tx_hash', ignoreDuplicates: true });
        if (error) logError('streams', `ETH tx insert: ${error.message}`);
      }

      if (liqRows.length > 0) {
        const { error } = await supabase
          .from('liquidity_events')
          .insert(liqRows);
        if (error) logError('streams', `ETH liq insert: ${error.message}`);
      }
    }

    log('streams', `[eth] block ${blockNumber} — ${swapCount} swap(s), ${liqCount} liq event(s)`);
    res.json({ ok: true, chain: 'eth', swaps: swapCount, liquidity: liqCount });
  } catch (err: any) {
    logError('streams', `ETH webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /transactions ── paginated stream transactions for any chain
router.get('/transactions', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  if (!DB_ENABLED || !supabase) {
    res.json({ transactions: [], total: 0 });
    return;
  }

  const { data, error, count } = await supabase
    .from('stream_transactions')
    .select('*', { count: 'exact' })
    .eq('chain', chain)
    .order('block_number', { ascending: false })
    .order('tx_index', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('streams', `Query error: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ transactions: data ?? [], total: count ?? 0 });
});

// ── GET /liquidity/events ── paginated liquidity events
// Falls back to direct RPC log fetching when the DB has no events for the pool.
router.get('/liquidity/events', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const pool = req.query.pool as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!DB_ENABLED || !supabase) {
    if (pool && chain === 'eth') {
      try {
        let events = await backfillLiquidityEvents(pool);
        events = events.slice(0, limit);
        res.json({ events, total: events.length });
      } catch {
        res.json({ events: [], total: 0 });
      }
    } else {
      res.json({ events: [], total: 0 });
    }
    return;
  }

  let query = supabase
    .from('liquidity_events')
    .select('*', { count: 'exact' })
    .eq('chain', chain)
    .order('block_number', { ascending: false })
    .limit(limit);

  if (pool) query = query.eq('pool_address', pool.toLowerCase());

  const { data, error, count } = await query;

  if (error) {
    logError('streams', `Liq query error: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  if ((!data || data.length === 0) && pool && chain === 'eth') {
    try {
      await backfillLiquidityEvents(pool);
      const { data: freshData, count: freshCount } = await supabase
        .from('liquidity_events')
        .select('*', { count: 'exact' })
        .eq('chain', chain)
        .eq('pool_address', pool.toLowerCase())
        .order('block_number', { ascending: false })
        .limit(limit);
      res.json({ events: freshData ?? [], total: freshCount ?? 0 });
      return;
    } catch {
      // fall through to return empty
    }
  }

  // Trigger background refresh for subsequent polls (non-blocking)
  if (pool && chain === 'eth') {
    backfillLiquidityEvents(pool).catch(() => {});
  }

  res.json({ events: data ?? [], total: count ?? 0 });
});

// ── GET /liquidity/tvl ── on-chain TVL via ERC20 balanceOf on the pool contract
router.get('/liquidity/tvl', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const pool = req.query.pool as string | undefined;
  const poolName = req.query.poolName as string | undefined;

  if (!pool) {
    res.json({ tvl: { amount0: '0', amount1: '0' }, eventCount: 0 });
    return;
  }

  const poolAddr = pool.toLowerCase() as Address;

  let token0Addr: Address | undefined;
  let token1Addr: Address | undefined;

  if (poolName) {
    const cached = getCachedPool(poolName);
    if (cached) {
      token0Addr = cached.token0Address;
      token1Addr = cached.token1Address;
    }
  }

  if (!token0Addr || !token1Addr) {
    const POOL_ABI = [
      { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
    ] as const;
    try {
      const [t0, t1] = await Promise.all([
        tvlRpc.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'token0' }),
        tvlRpc.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'token1' }),
      ]);
      token0Addr = t0 as Address;
      token1Addr = t1 as Address;
    } catch (err: any) {
      logError('streams', `TVL token lookup failed for ${pool}: ${err.message}`);
      res.json({ tvl: { amount0: '0', amount1: '0' }, eventCount: 0 });
      return;
    }
  }

  try {
    const [bal0, bal1, slot0Result] = await Promise.all([
      tvlRpc.readContract({
        address: token0Addr,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [poolAddr],
      }),
      tvlRpc.readContract({
        address: token1Addr,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [poolAddr],
      }),
      tvlRpc.readContract({
        address: poolAddr,
        abi: SLOT0_ABI,
        functionName: 'slot0',
      }).catch(() => null),
    ]);

    let eventCount = 0;
    if (DB_ENABLED && supabase) {
      const { count } = await supabase
        .from('liquidity_events')
        .select('id', { count: 'exact', head: true })
        .eq('chain', chain)
        .eq('pool_address', poolAddr);
      eventCount = count ?? 0;
    }

    let tvlUsd: { usd0: number; usd1: number; total: number } | undefined;
    const meta = poolName ? getCachedPool(poolName) : undefined;
    if (slot0Result && meta) {
      const sqrtPriceX96 = slot0Result[0];
      const needsEthPrice = !STABLECOINS.has(meta.token0Symbol) && !STABLECOINS.has(meta.token1Symbol);
      const ethPriceUsd = needsEthPrice ? await getEthPriceUsd() : 0;
      tvlUsd = computeUsdTvl(
        bal0, bal1,
        meta.decimals0, meta.decimals1,
        meta.token0Symbol, meta.token1Symbol,
        sqrtPriceX96,
        ethPriceUsd,
      );
    }

    res.json({
      tvl: { amount0: bal0.toString(), amount1: bal1.toString() },
      tvlUsd,
      eventCount,
    });
  } catch (err: any) {
    logError('streams', `TVL balance read failed for ${pool}: ${err.message}`);
    res.json({ tvl: { amount0: '0', amount1: '0' }, eventCount: 0 });
  }
});

// ── GET /liquidity/positions ── aggregated positions by owner + tick range
router.get('/liquidity/positions', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const pool = req.query.pool as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!DB_ENABLED || !supabase || !pool) {
    res.json({ positions: [] });
    return;
  }

  const { data, error } = await supabase
    .from('liquidity_events')
    .select('*')
    .eq('chain', chain)
    .eq('pool_address', pool.toLowerCase())
    .in('event_type', ['mint', 'burn'])
    .order('block_number', { ascending: false })
    .limit(500);

  if (error) {
    logError('streams', `Positions query error: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  const posMap = new Map<string, {
    owner: string;
    tick_lower: number;
    tick_upper: number;
    liquidity: bigint;
    amount0: bigint;
    amount1: bigint;
    last_block: number;
  }>();

  for (const row of data ?? []) {
    const key = `${row.owner}:${row.tick_lower}:${row.tick_upper}`;
    if (!posMap.has(key)) {
      posMap.set(key, {
        owner: row.owner,
        tick_lower: row.tick_lower,
        tick_upper: row.tick_upper,
        liquidity: BigInt(0),
        amount0: BigInt(0),
        amount1: BigInt(0),
        last_block: row.block_number,
      });
    }
    const pos = posMap.get(key)!;
    const amt = BigInt(row.amount || '0');
    const a0 = BigInt(row.amount0 || '0');
    const a1 = BigInt(row.amount1 || '0');
    if (row.event_type === 'mint') {
      pos.liquidity += amt;
      pos.amount0 += a0;
      pos.amount1 += a1;
    } else {
      pos.liquidity -= amt;
      pos.amount0 -= a0;
      pos.amount1 -= a1;
    }
    if (row.block_number > pos.last_block) pos.last_block = row.block_number;
  }

  const positions = Array.from(posMap.values())
    .filter(p => p.liquidity > BigInt(0))
    .sort((a, b) => b.last_block - a.last_block)
    .slice(0, limit)
    .map(p => ({
      owner: p.owner,
      tick_lower: p.tick_lower,
      tick_upper: p.tick_upper,
      liquidity: p.liquidity.toString(),
      amount0: p.amount0.toString(),
      amount1: p.amount1.toString(),
      last_block: p.last_block,
    }));

  res.json({ positions });
});

// ── Simulation mode ──
let simInterval: ReturnType<typeof setInterval> | null = null;
let simBlockNumber = 56_900_000;
let simTxCount = 0;

const SIM_ADDRESSES = [
  '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e',
  '0x5c4ec8d4fc6e74f8a7a6df6d36017eeffff9301f',
  '0xf8a319bcd9fff599c191f30eb7b2c876067cb2ad',
];

const SIM_METHODS = ['execute', 'exactInputSingle', 'multicall', 'exactInput'];

const SIM_ROUTERS = [
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
];

function randomHex(bytes: number): string {
  let h = '0x';
  for (let i = 0; i < bytes; i++) h += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return h;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

router.get('/simulate', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';

  if (simInterval) {
    res.json({ status: 'already_running', txCount: simTxCount });
    return;
  }

  simTxCount = 0;
  log('streams', `Simulation started for ${chain}`);

  simInterval = setInterval(() => {
    const batchSize = 1 + Math.floor(Math.random() * 3);
    simBlockNumber++;

    for (let i = 0; i < batchSize; i++) {
      simTxCount++;
      const tx: StreamTxRow = {
        chain,
        tx_hash: randomHex(32),
        block_number: simBlockNumber,
        block_hash: randomHex(32),
        tx_index: i,
        from_address: pick(SIM_ADDRESSES),
        to_address: pick(SIM_ROUTERS),
        value: BigInt(Math.floor(Math.random() * 5e18)).toString(),
        gas_limit: String(21000 + Math.floor(Math.random() * 300000)),
        gas_price: String(100_000_000_000),
        method_id: pick(SIM_METHODS),
        tx_type: '0x2',
        block_timestamp: new Date().toISOString(),
      };

      broadcastStreamTx(chain, { ...tx });
    }
  }, 1500);

  res.json({ status: 'started', chain });
});

router.delete('/simulate', (_req, res) => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  log('streams', `Simulation stopped (${simTxCount} txs)`);
  res.json({ status: 'stopped', totalGenerated: simTxCount });
});

export default router;
