'use client';

import { GlowCard } from '@/components/glow-card';
import { PillButton } from '@/components/pill-button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, BarChart3 } from 'lucide-react';
import type { SavedChart, ChartConfig } from '@/lib/types';
import { generateSparklineData } from '@/lib/mock-data';

interface SavedChartsProps {
  charts: SavedChart[];
  onOpen: (chart: SavedChart) => void;
  onRemove: (id: string) => void;
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="#FF007A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavedCharts({ charts, onOpen, onRemove }: SavedChartsProps) {
  if (charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-uni-text1/50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-uni-text1">No saved charts yet</p>
          <p className="text-xs text-uni-text1/60 mt-1">Generate a chart and save it to build your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-uni-text1 uppercase tracking-wider mb-4">
        Saved Charts
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {charts.map(chart => (
          <SavedChartCard
            key={chart.id}
            chart={chart}
            onOpen={() => onOpen(chart)}
            onRemove={() => onRemove(chart.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SavedChartCard({
  chart,
  onOpen,
  onRemove,
}: {
  chart: SavedChart;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const sparkData = generateSparklineData(chart.id.charCodeAt(0) * 100 + chart.id.charCodeAt(1));

  return (
    <GlowCard className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-uni-text0 truncate">{chart.title}</h4>
        <MiniSparkline data={sparkData} />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <Badge className="rounded-full bg-uni-rose/10 text-uni-rose border-uni-rose/20 text-[11px] px-2 py-0">
          {chart.config.metric}
        </Badge>
        <Badge className="rounded-full bg-white/[0.06] text-uni-text1 border-white/[0.08] text-[11px] px-2 py-0">
          {chart.config.pool}
        </Badge>
        <Badge className="rounded-full bg-white/[0.06] text-uni-text1 border-white/[0.08] text-[11px] px-2 py-0">
          {chart.config.range}
        </Badge>
      </div>
      <div className="flex gap-2 pt-1">
        <PillButton variant="secondary" size="sm" className="flex-1" onClick={onOpen}>
          <Eye className="w-3 h-3" />
          Open
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="w-3 h-3 text-red-400" />
        </PillButton>
      </div>
    </GlowCard>
  );
}
