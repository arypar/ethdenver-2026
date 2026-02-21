'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Plus, X, Droplets, Wallet, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PoolSuggestion } from '@/lib/use-wallet-suggestions';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SuggestedPoolsProps {
  suggestions: PoolSuggestion[];
  loading: boolean;
  existingPools: Set<string>;
  onSelect: (suggestion: PoolSuggestion) => void;
  onRefresh: () => void;
}

export function SuggestedPools({
  suggestions,
  loading,
  existingPools,
  onSelect,
  onRefresh,
}: SuggestedPoolsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/api/dismissed-suggestions`)
      .then(r => r.ok ? r.json() : [])
      .then((pools: string[]) => setDismissed(new Set(pools)))
      .catch(() => {});
  }, []);

  const dismiss = (pool: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(pool);
      return next;
    });
    fetch(`${API_BASE}/api/dismissed-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool }),
    }).catch(() => {});
  };

  const visible = suggestions.filter(s => !dismissed.has(s.pool));

  if (!loading && visible.length === 0) return null;

  return (
    <div className="mt-3.5 pt-3.5 border-t border-white/[0.06]">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="h-3 w-3 text-[#FF007A]/70" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          Suggested for you
        </span>
        <button
          onClick={onRefresh}
          className="ml-auto flex items-center gap-1 text-[11px] text-white/20 hover:text-white/45 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Rescan
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {loading && visible.length === 0 && (
          <>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-8 w-32 animate-shimmer rounded-full border border-white/[0.06] bg-white/[0.03]"
              />
            ))}
          </>
        )}

        {visible.map(s => {
          return (
            <div
              key={`${s.chain}-${s.pool}`}
              className={cn(
                'group relative flex items-center gap-1.5 rounded-full border px-3 py-1 transition-all duration-200 cursor-pointer',
                'border-white/[0.08] bg-white/[0.04] hover:border-[#FF007A]/30 hover:bg-[#FF007A]/[0.06] hover:shadow-[0_0_20px_rgba(255,0,122,0.08)]',
              )}
              onClick={() => onSelect(s)}
            >
              {s.reason === 'lp' ? (
                <Droplets className="h-3 w-3 text-emerald-400 shrink-0" />
              ) : (
                <Wallet className="h-3 w-3 text-blue-400 shrink-0" />
              )}

              <span className="text-[13px] font-medium text-white/80">
                {s.pool}
              </span>

              <span
                className={cn(
                  'rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide',
                  s.reason === 'lp'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                )}
              >
                {s.reason === 'lp' ? 'LP' : `Holds ${s.token}`}
              </span>

              {s.chain === 'monad' && (
                <span className="rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-[1px] text-[9px] font-semibold">
                  Monad
                </span>
              )}

              <Plus className="h-3 w-3 text-white/30 group-hover:text-[#FF007A] transition-colors shrink-0" />

              <button
                onClick={e => { e.stopPropagation(); dismiss(s.pool); }}
                className="ml-0.5 rounded-full p-0.5 text-white/15 hover:text-white/40 hover:bg-white/[0.06] transition-all"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
