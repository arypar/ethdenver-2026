'use client';

import { PillSelect } from '@/components/pill-select';
import { PillButton } from '@/components/pill-button';
import { GlowCard } from '@/components/glow-card';
import { Sparkles, Shuffle } from 'lucide-react';
import type { Metric, Pool, TimeRange, ChartType, ChartConfig } from '@/lib/types';

const METRICS: Metric[] = ['Volume', 'TVL', 'Fees', 'Price', 'Liquidity Delta', 'Swap Count'];
const POOLS: Pool[] = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'ARB/USDC', 'LINK/ETH', 'MATIC/USDC'];
const RANGES: TimeRange[] = ['1H', '24H', '7D'];
const CHART_TYPES: ChartType[] = ['line', 'area', 'bar'];

interface ChartBuilderProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onGenerate: () => void;
  onRandomize: () => void;
}

export function ChartBuilder({ config, onChange, onGenerate, onRandomize }: ChartBuilderProps) {
  return (
    <GlowCard className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-uni-text0 tracking-tight flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-uni-rose" />
        Chart Builder
      </h2>

      <PillSelect
        label="Metric"
        options={METRICS}
        value={config.metric}
        onChange={v => onChange({ ...config, metric: v })}
      />

      <PillSelect
        label="Pool"
        options={POOLS}
        value={config.pool}
        onChange={v => onChange({ ...config, pool: v })}
      />

      <PillSelect
        label="Time Range"
        options={RANGES}
        value={config.range}
        onChange={v => onChange({ ...config, range: v })}
        compact
      />

      <PillSelect
        label="Chart Type"
        options={CHART_TYPES}
        value={config.chartType}
        onChange={v => onChange({ ...config, chartType: v })}
        compact
      />

      <div className="flex gap-3 pt-2">
        <PillButton variant="primary" className="flex-1" onClick={onGenerate}>
          <Sparkles className="w-4 h-4" />
          Generate
        </PillButton>
        <PillButton variant="secondary" onClick={onRandomize}>
          <Shuffle className="w-4 h-4" />
          Randomize
        </PillButton>
      </div>
    </GlowCard>
  );
}
