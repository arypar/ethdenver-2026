'use client';

import { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useStreamFeed, CHAIN_CONFIG, type Chain } from '@/lib/use-stream-feed';
import { QuickNodeHeader } from '@/components/quicknode/QuickNodeHeader';
import { StreamStats } from '@/components/quicknode/StreamStats';
import { TransactionFeed } from '@/components/quicknode/TransactionFeed';
import { LiquidityPanel } from '@/components/quicknode/LiquidityPanel';

export default function QuickNodePage() {
  const [chain, setChain] = useState<Chain>('eth');
  const { transactions, connected, stats, startSimulation, stopSimulation } = useStreamFeed(chain);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [tab, setTab] = useState<'transactions' | 'liquidity'>('transactions');

  const cfg = CHAIN_CONFIG[chain];

  async function toggleSim() {
    setSimLoading(true);
    try {
      if (simRunning) {
        await stopSimulation();
        setSimRunning(false);
      } else {
        const res = await startSimulation();
        setSimRunning(res.status === 'started' || res.status === 'already_running');
      }
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <QuickNodeHeader connected={connected} chain={chain} onChainChange={setChain} />

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Uniswap on {cfg.label}
            </h2>
            <p className="text-sm text-white/40">
              Real-time Uniswap activity on {cfg.label} via QuickNode Streams
            </p>
          </div>

          <button
            onClick={toggleSim}
            disabled={simLoading}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              simRunning
                ? 'border border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
            } disabled:opacity-50`}
          >
            {simRunning ? (
              <><Square className="h-3.5 w-3.5" /> Stop Demo</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Start Demo</>
            )}
          </button>
        </div>

        <StreamStats stats={stats} />

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 w-fit">
          <button
            onClick={() => setTab('transactions')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'transactions'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setTab('liquidity')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'liquidity'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            Liquidity
          </button>
        </div>

        {tab === 'transactions' ? (
          <TransactionFeed transactions={transactions} chain={chain} />
        ) : (
          <LiquidityPanel chain={chain} />
        )}

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-xs text-white/30 leading-relaxed">
            Powered by{' '}
            <a href="https://www.quicknode.com/docs/streams" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary">
              QuickNode Streams
            </a>
            {' '}&mdash; blockchain data is streamed from {cfg.label}, decoded for Uniswap V3
            swap and liquidity events, and delivered to this dashboard in real time via
            webhook ingestion and WebSocket broadcast.
          </p>
        </div>
      </main>
    </div>
  );
}
