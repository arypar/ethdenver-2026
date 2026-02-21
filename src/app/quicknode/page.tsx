'use client';

import { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useMonadStream } from '@/lib/use-monad-stream';
import { QuickNodeHeader } from '@/components/quicknode/QuickNodeHeader';
import { StreamStats } from '@/components/quicknode/StreamStats';
import { TransactionFeed } from '@/components/quicknode/TransactionFeed';

export default function QuickNodePage() {
  const { transactions, connected, stats, startSimulation, stopSimulation } = useMonadStream();
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);

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
      <QuickNodeHeader connected={connected} />

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Uniswap Swap Transactions
            </h2>
            <p className="text-sm text-white/40">
              Real-time Uniswap swaps on Monad testnet via QuickNode Streams
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
              <>
                <Square className="h-3.5 w-3.5" />
                Stop Demo
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start Demo
              </>
            )}
          </button>
        </div>

        <StreamStats stats={stats} />

        <TransactionFeed transactions={transactions} />

        {/* Footer info */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-xs text-white/30 leading-relaxed">
            Powered by{' '}
            <a href="https://www.quicknode.com/docs/streams" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary">
              QuickNode Streams
            </a>
            {' '}&mdash; blockchain data is extracted from Monad testnet, filtered for Uniswap swap
            method signatures (execute, exactInputSingle, multicall, etc.), and delivered to
            this dashboard in real time via webhook ingestion and WebSocket broadcast.
          </p>
        </div>
      </main>
    </div>
  );
}
