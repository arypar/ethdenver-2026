'use client';

import { Activity, BarChart3, Box, Users } from 'lucide-react';
import type { StreamStats as Stats } from '@/lib/use-monad-stream';

interface Props {
  stats: Stats;
}

const cards = [
  { key: 'totalTx' as const, label: 'Total Transactions', icon: Activity, format: (v: number) => v.toLocaleString() },
  { key: 'txPerMin' as const, label: 'Tx / Minute', icon: BarChart3, format: (v: number) => v.toLocaleString() },
  { key: 'latestBlock' as const, label: 'Latest Block', icon: Box, format: (v: number) => v ? `#${v.toLocaleString()}` : '--' },
  { key: 'uniqueAddresses' as const, label: 'Unique Addresses', icon: Users, format: (v: number) => v.toLocaleString() },
];

export function StreamStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div
          key={key}
          className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
              {label}
            </span>
          </div>
          <p className="text-xl font-semibold text-white tabular-nums">
            {format(stats[key])}
          </p>
        </div>
      ))}
    </div>
  );
}
