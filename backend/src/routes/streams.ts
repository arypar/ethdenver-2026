import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { broadcastStreamTx, broadcastLiquidityEvent } from '../lib/ws-server.js';
import { tracker } from '../lib/pool-tracker.js';
import { log, logError } from '../lib/log.js';

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
 * 2) Monad Mainnet Stream
 *    Chain:       Monad (chain ID 143)
 *    Dataset:     Block (with transactions)
 *    Destination: POST → {BACKEND_URL}/streams/webhook/monad
 *
 *    Filter function (paste into QuickNode dashboard):
 *
 *    function main(stream) {
 *      var ROUTERS = [
 *        '0x0d97dc33264bfc1c226207428a79b26757fb9dc3',
 *        '0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900',
 *      ];
 *      var blocks = stream.data;
 *      if (!blocks || !blocks.length) return null;
 *      var out = [];
 *      for (var i = 0; i < blocks.length; i++) {
 *        var block = blocks[i];
 *        if (!block.transactions) continue;
 *        var matched = [];
 *        for (var j = 0; j < block.transactions.length; j++) {
 *          var tx = block.transactions[j];
 *          if (tx.to && ROUTERS.indexOf(tx.to.toLowerCase()) !== -1) {
 *            matched.push(tx);
 *          }
 *        }
 *        if (matched.length > 0) {
 *          block.transactions = matched;
 *          out.push(block);
 *        }
 *      }
 *      return out.length > 0 ? out : null;
 *    }
 * ============================================================
 */

const router = Router();

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

// ── POST /webhook/monad ── raw block transactions from Monad stream
router.post('/webhook/monad', async (req, res) => {
  const token = process.env.QUICKNODE_STREAM_TOKEN;
  if (token && req.headers['x-qn-api-key'] !== token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const body = req.body;
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
      log('streams', `[eth] No block/receipts in payload — keys: [${Object.keys(body || {}).join(', ')}]`);
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
router.get('/liquidity/events', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const pool = req.query.pool as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!DB_ENABLED || !supabase) {
    res.json({ events: [], total: 0 });
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

  res.json({ events: data ?? [], total: count ?? 0 });
});

// ── GET /liquidity/tvl ── TVL snapshot for a pool
router.get('/liquidity/tvl', async (req, res) => {
  const chain = (req.query.chain as string) || 'eth';
  const pool = req.query.pool as string | undefined;

  if (!DB_ENABLED || !supabase || !pool) {
    res.json({ tvl: { amount0: '0', amount1: '0' }, eventCount: 0 });
    return;
  }

  const { data, error } = await supabase
    .from('liquidity_events')
    .select('event_type, amount0, amount1')
    .eq('chain', chain)
    .eq('pool_address', pool.toLowerCase())
    .in('event_type', ['mint', 'burn']);

  if (error) {
    logError('streams', `TVL query error: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  let tvl0 = BigInt(0);
  let tvl1 = BigInt(0);

  for (const row of data ?? []) {
    const a0 = BigInt(row.amount0 || '0');
    const a1 = BigInt(row.amount1 || '0');
    if (row.event_type === 'mint') {
      tvl0 += a0;
      tvl1 += a1;
    } else {
      tvl0 -= a0;
      tvl1 -= a1;
    }
  }

  res.json({
    tvl: { amount0: tvl0.toString(), amount1: tvl1.toString() },
    eventCount: data?.length ?? 0,
  });
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
