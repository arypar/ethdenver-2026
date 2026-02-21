'use client';

import Link from 'next/link';
import { ArrowLeft, Radio } from 'lucide-react';

interface Props {
  connected: boolean;
}

export function QuickNodeHeader({ connected }: Props) {
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
                Monad Stream
              </h1>
              <p className="text-[11px] text-white/40 -mt-0.5">
                QuickNode Streams &times; Uniswap
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#836EF9" fillOpacity="0.8" />
              <path d="M2 17l10 5 10-5" stroke="#836EF9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="#836EF9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[12px] font-medium text-white/60">Monad Testnet</span>
          </div>
        </div>
      </div>
    </header>
  );
}
