import { Router } from 'express';
import { createPublicClient, webSocket, formatEther, formatGwei } from 'viem';
import { mainnet } from 'viem/chains';

const router = Router();

let subscriptionActive = false;
let unwatch: (() => void) | null = null;
let txCount = 0;

const wsClient = createPublicClient({
  chain: mainnet,
  transport: webSocket('wss://ethereum-rpc.publicnode.com'),
});

router.get('/test', (_req, res) => {
  if (subscriptionActive) {
    res.json({
      status: 'already_running',
      txCount,
      message: 'Subscription is already active. Hit DELETE to stop.',
    });
    return;
  }

  subscriptionActive = true;
  txCount = 0;

  console.log('\n========================================');
  console.log(' ETHEREUM TX STREAM — STARTED');
  console.log('========================================\n');

  unwatch = wsClient.watchBlocks({
    includeTransactions: true,
    onBlock: (block) => {
      console.log(
        `\n📦 BLOCK #${block.number} | ${block.transactions.length} txs | gas used: ${block.gasUsed.toLocaleString()}`,
      );
      console.log(`   hash: ${block.hash}`);
      console.log(`   timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
      console.log('   ────────────────────────────────────');

      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue;

        txCount++;
        const value = formatEther(tx.value);
        const gasPrice = tx.gasPrice ? formatGwei(tx.gasPrice) : '?';
        const method = tx.input.slice(0, 10);
        const isContract = tx.input.length > 2;

        console.log(
          `   tx #${txCount} | ${tx.hash.slice(0, 18)}...` +
          ` | ${tx.from.slice(0, 10)}... → ${tx.to ? tx.to.slice(0, 10) + '...' : 'CONTRACT CREATE'}` +
          ` | ${value} ETH` +
          ` | gas: ${gasPrice} gwei` +
          (isContract ? ` | method: ${method}` : ' | transfer'),
        );
      }
    },
    onError: (error) => {
      console.error('❌ Block subscription error:', error.message);
    },
  });

  res.json({
    status: 'started',
    message: 'Subscribed to Ethereum blocks via wss://ethereum-rpc.publicnode.com. Check your server console for live transactions. Hit DELETE to stop.',
  });
});

router.delete('/test', (_req, res) => {
  if (unwatch) {
    unwatch();
    unwatch = null;
  }
  subscriptionActive = false;

  console.log('\n========================================');
  console.log(` ETHEREUM TX STREAM — STOPPED (${txCount} txs logged)`);
  console.log('========================================\n');

  res.json({
    status: 'stopped',
    totalTxLogged: txCount,
  });
});

export default router;
