'use client';

import { ChartCard } from './ChartCard';
import { Activity } from 'lucide-react';
import type { SavedChart } from '@/lib/types';

interface ChartListProps {
  charts: SavedChart[];
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExpand: (chart: SavedChart) => void;
}

export function ChartList({ charts, onRename, onDelete, onExpand }: ChartListProps) {
  if (charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <Activity className="h-7 w-7 text-white/15" />
        </div>
        <p className="mt-5 text-[15px] font-semibold text-white/60">No charts yet</p>
        <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-white/25">
          Pick a pool and metric above, then hit Generate to start streaming live on-chain data.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/30">
          Your Charts
        </h2>
        <span className="text-[12px] text-white/20">{charts.length} chart{charts.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {charts.map(chart => (
          <ChartCard key={chart.id} chart={chart} onRename={onRename} onDelete={onDelete} onExpand={onExpand} />
        ))}
      </div>
    </div>
  );
}
