'use client';

import Link from 'next/link';
import { ArrowLeft, Radio } from 'lucide-react';
import type { Chain } from '@/lib/use-stream-feed';
import { CHAIN_CONFIG } from '@/lib/use-stream-feed';

interface Props {
  connected: boolean;
  chain: Chain;
  onChainChange: (chain: Chain) => void;
}

const CHAINS: Chain[] = ['eth', 'monad'];

export function QuickNodeHeader({ connected, chain, onChainChange }: Props) {
  const cfg = CHAIN_CONFIG[chain];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4 text-white/60" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <div className="absolute inset-0 rounded-lg" style={{ boxShadow: '0 0 12px rgba(255,0,122,0.2)' }} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                Uniswap Streams
              </h1>
              <p className="text-[11px] text-white/40 -mt-0.5">
                QuickNode Streams &times; Uniswap
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Chain toggle */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] p-0.5">
            {CHAINS.map((c) => (
              <button
                key={c}
                onClick={() => onChainChange(c)}
                className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                  chain === c
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-white/40 hover:text-white/60 border border-transparent'
                }`}
              >
                {CHAIN_CONFIG[c].icon} {CHAIN_CONFIG[c].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
            <div
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ boxShadow: connected ? '0 0 6px rgba(52,211,153,0.5)' : '0 0 6px rgba(248,113,113,0.5)' }}
            />
            <span className="text-[12px] font-medium text-white/60">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
            <span className="text-[14px]">{cfg.icon}</span>
            <span className="text-[12px] font-medium text-white/60">{cfg.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
