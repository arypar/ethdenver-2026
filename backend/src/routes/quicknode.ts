import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { broadcastMonadTx } from '../lib/ws-server.js';
import { log, logError } from '../lib/log.js';

/*
 * ============================================================
 * QuickNode Stream Filter (configure in QuickNode dashboard)
 * ============================================================
 * Chain:       Monad Testnet (chain ID 143)
 * Dataset:     Block (with transactions)
 * Destination: Webhook POST → {BACKEND_URL}/quicknode/webhook
 * Auth header: x-qn-api-key: {your QUICKNODE_STREAM_TOKEN}
 *
 * Filter function (paste into QuickNode dashboard):
 *
 *   function main(stream) {
 *     var ROUTERS = [
 *       '0x0d97dc33264bfc1c226207428a79b26757fb9dc3', // UniversalRouter
 *       '0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900', // SwapRouter02
 *     ];
 *     var blocks = stream.data;
 *     if (!blocks || !blocks.length) return null;
 *     var out = [];
 *     for (var i = 0; i < blocks.length; i++) {
 *       var block = blocks[i];
 *       if (!block.transactions) continue;
 *       var matched = [];
 *       for (var j = 0; j < block.transactions.length; j++) {
 *         var tx = block.transactions[j];
 *         if (tx.to && ROUTERS.indexOf(tx.to.toLowerCase()) !== -1) {
 *           matched.push(tx);
 *         }
 *       }
 *       if (matched.length > 0) {
 *         block.transactions = matched;
 *         out.push(block);
 *       }
 *     }
 *     return out.length > 0 ? out : null;
 *   }
 * ============================================================
 */

const router = Router();

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

interface ParsedTx {
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

function hexToNumber(hex: string | undefined): number {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function hexToDecStr(hex: string | undefined): string {
  if (!hex) return '0';
  try {
    return BigInt(hex).toString();
  } catch {
    return '0';
  }
}

const UNISWAP_ROUTERS = new Set([
  '0x0d97dc33264bfc1c226207428a79b26757fb9dc3', // UniversalRouter
  '0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900', // SwapRouter02
]);

function parseBlockTxs(block: RawBlock): ParsedTx[] {
  const blockNumber = hexToNumber(block.number);
  const blockHash = block.hash || '';
  const blockTs = hexToNumber(block.timestamp);
  const blockDate = new Date(blockTs * 1000).toISOString();

  if (!block.transactions) return [];

  return block.transactions
    .filter((tx) => {
      if (!tx.to) return false;
      return UNISWAP_ROUTERS.has(tx.to.toLowerCase());
    })
    .map((tx) => ({
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
}

// ── POST /webhook ── receives QuickNode Stream payload
router.post('/webhook', async (req, res) => {
  const token = process.env.QUICKNODE_STREAM_TOKEN;
  if (token && req.headers['x-qn-api-key'] !== token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const body = req.body;

    let blocks: RawBlock[] = [];
    if (Array.isArray(body)) {
      blocks = body;
    } else if (body?.data && Array.isArray(body.data)) {
      blocks = body.data;
    } else if (body?.streamData && Array.isArray(body.streamData)) {
      blocks = body.streamData;
    } else if (body?.hash && body?.transactions) {
      blocks = [body];
    } else {
      const keys = Object.keys(body || {});
      log('quicknode', `Unknown payload shape — keys: [${keys.join(', ')}] | sample: ${JSON.stringify(body).slice(0, 300)}`);
    }

    let totalInserted = 0;

    for (const block of blocks) {
      const txs = parseBlockTxs(block);
      if (txs.length === 0) continue;

      if (DB_ENABLED && supabase) {
        const { error } = await supabase
          .from('monad_transactions')
          .upsert(txs, { onConflict: 'tx_hash', ignoreDuplicates: true });
        if (error) logError('quicknode', `DB insert error: ${error.message}`);
      }

      for (const tx of txs) {
        broadcastMonadTx({ ...tx });
      }
      totalInserted += txs.length;
    }

    log('quicknode', `Webhook processed ${blocks.length} block(s), ${totalInserted} tx(s)`);
    res.json({ ok: true, blocks: blocks.length, transactions: totalInserted });
  } catch (err: any) {
    logError('quicknode', `Webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /transactions ── paginated list for initial load
router.get('/transactions', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  if (!DB_ENABLED || !supabase) {
    res.json({ transactions: [], total: 0 });
    return;
  }

  const { data, error, count } = await supabase
    .from('monad_transactions')
    .select('*', { count: 'exact' })
    .order('block_number', { ascending: false })
    .order('tx_index', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('quicknode', `Query error: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ transactions: data ?? [], total: count ?? 0 });
});

// ── Simulation mode ──
let simInterval: ReturnType<typeof setInterval> | null = null;
let simBlockNumber = 56_900_000;
let simTxCount = 0;

const SAMPLE_ADDRESSES = [
  '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e',
  '0x5c4ec8d4fc6e74f8a7a6df6d36017eeffff9301f',
  '0xf8a319bcd9fff599c191f30eb7b2c876067cb2ad',
  '0xd27f514bc2b7db091035daeb741c8de56308e0aa',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0x2880ab155794e7179c9ee2e38200202908c17b43',
];

const SWAP_METHODS = [
  { id: '0x3593564c', name: 'execute' },
  { id: '0x414bf389', name: 'exactInputSingle' },
  { id: '0x5ae401dc', name: 'multicall' },
  { id: '0xc04b8d59', name: 'exactInput' },
  { id: '0x04e45aaf', name: 'exactInputSingle' },
  { id: '0xdb3e2198', name: 'exactOutputSingle' },
];

const ROUTER_ADDRESSES = [
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
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

function generateMockTx(): ParsedTx {
  simTxCount++;
  const method = pick(SWAP_METHODS);
  const value = BigInt(Math.floor(Math.random() * 5e18)).toString();
  return {
    tx_hash: randomHex(32),
    block_number: simBlockNumber,
    block_hash: randomHex(32),
    tx_index: Math.floor(Math.random() * 20),
    from_address: pick(SAMPLE_ADDRESSES),
    to_address: pick(ROUTER_ADDRESSES),
    value,
    gas_limit: String(21000 + Math.floor(Math.random() * 300000)),
    gas_price: String(100_000_000_000),
    method_id: method.id,
    tx_type: '0x2',
    block_timestamp: new Date().toISOString(),
  };
}

router.get('/simulate', async (_req, res) => {
  if (simInterval) {
    res.json({ status: 'already_running', txCount: simTxCount });
    return;
  }

  simTxCount = 0;
  log('quicknode', 'Simulation started — generating mock Monad swap transactions');

  simInterval = setInterval(async () => {
    const batchSize = 1 + Math.floor(Math.random() * 3);
    simBlockNumber++;

    for (let i = 0; i < batchSize; i++) {
      const tx = generateMockTx();
      tx.tx_index = i;

      if (DB_ENABLED && supabase) {
        const { error } = await supabase
          .from('monad_transactions')
          .upsert([tx], { onConflict: 'tx_hash', ignoreDuplicates: true });
        if (error) logError('quicknode', `Sim DB error: ${error.message}`);
      }

      broadcastMonadTx({ ...tx });
    }
  }, 1500);

  res.json({ status: 'started', message: 'Generating mock transactions every ~1.5s' });
});

router.delete('/simulate', (_req, res) => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  log('quicknode', `Simulation stopped (${simTxCount} total txs generated)`);
  res.json({ status: 'stopped', totalGenerated: simTxCount });
});

export default router;
