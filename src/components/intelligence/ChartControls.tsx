'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BarChart3, Shuffle } from 'lucide-react';
import type { ChartConfig, Metric, Pool, TimeRange, ChartType } from '@/lib/types';

const METRICS: Metric[] = ['Volume', 'TVL', 'Fees', 'Price', 'Liquidity Delta', 'Swap Count'];
const POOLS: Pool[] = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'ARB/USDC', 'LINK/ETH', 'MATIC/USDC'];
const RANGES: TimeRange[] = ['1H', '24H', '7D', '30D'];
const CHART_TYPES: ChartType[] = ['line', 'area', 'bar'];

interface ChartControlsProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onGenerate: () => void;
  onRandomize: () => void;
}

export function ChartControls({ config, onChange, onGenerate, onRandomize }: ChartControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Chart Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldRow label="Metric">
          <Select value={config.metric} onValueChange={v => onChange({ ...config, metric: v as Metric })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {METRICS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Pool">
          <Select value={config.pool} onValueChange={v => onChange({ ...config, pool: v as Pool })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {POOLS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Range">
          <Select value={config.range} onValueChange={v => onChange({ ...config, range: v as TimeRange })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Chart Type">
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            {CHART_TYPES.map(t => (
              <button
                key={t}
                onClick={() => onChange({ ...config, chartType: t })}
                className={cn(
                  'flex-1 rounded-sm px-3 py-1 text-xs font-medium capitalize transition-colors',
                  config.chartType === t
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </FieldRow>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={onGenerate}>Generate</Button>
          <Button variant="outline" onClick={onRandomize}>
            <Shuffle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
