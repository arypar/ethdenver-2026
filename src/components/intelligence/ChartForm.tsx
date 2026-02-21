'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PoolInput } from '@/components/ui/pool-input';
import { cn } from '@/lib/utils';
import { Plus, Loader2 } from 'lucide-react';
import { WELL_KNOWN_POOLS } from '@/lib/tokens';
import type { ChainId, ChartConfig, Metric, TimeRange, ChartType } from '@/lib/types';

const ETH_METRICS: Metric[] = ['Price', 'Volume', 'Fees', 'Swap Count'];
const MONAD_METRICS: Metric[] = ['Price', 'Volume', 'Swap Count'];
const RANGES: TimeRange[] = ['1H', '24H', '7D', '30D'];
const CHART_TYPES: ChartType[] = ['line', 'area', 'bar'];

interface ChartFormProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onGenerate: () => void;
  loading?: boolean;
  chain?: ChainId;
}

export function ChartForm({ config, onChange, onGenerate, loading, chain = 'eth' }: ChartFormProps) {
  const isMonad = chain === 'monad';
  const metrics = isMonad ? MONAD_METRICS : ETH_METRICS;
  const isDisabled = isMonad
    ? loading || !config.pool.match(/^0x[a-fA-F0-9]{40}$/)
    : loading || !config.pool.includes('/');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Metric">
          <Select value={config.metric} onValueChange={v => onChange({ ...config, metric: v as Metric })}>
            <SelectTrigger className="w-[150px] bg-white/[0.05] border-white/[0.08] text-white/80 h-9"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">{metrics.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>

        {isMonad ? (
          <Field label="Token Address">
            <input
              type="text"
              value={config.pool}
              onChange={e => onChange({ ...config, pool: e.target.value.trim() })}
              placeholder="0x..."
              className="h-9 w-[320px] rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15]"
            />
          </Field>
        ) : (
          <Field label="Pool">
            <PoolInput
              value={config.pool}
              onChange={pool => onChange({ ...config, pool })}
              inputClassName="h-9"
            />
          </Field>
        )}

        <Field label="Range">
          <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5 h-9 items-center">
            {RANGES.map(r => (
              <button key={r} onClick={() => onChange({ ...config, range: r })}
                className={cn('rounded-md px-2.5 py-1 text-[12px] font-medium transition-all duration-150',
                  config.range === r ? 'bg-white/[0.1] text-white' : 'text-white/30 hover:text-white/60')}>
                {r}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Type">
          <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5 h-9 items-center">
            {CHART_TYPES.map(t => (
              <button key={t} onClick={() => onChange({ ...config, chartType: t })}
                className={cn('rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-all duration-150',
                  config.chartType === t ? 'bg-white/[0.1] text-white' : 'text-white/30 hover:text-white/60')}>
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Button className="h-9 rounded-xl px-4 text-[13px] font-semibold" onClick={onGenerate} disabled={isDisabled}
          style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {loading ? 'Fetching...' : 'Generate'}
        </Button>
      </div>

      {!isMonad && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/20 mr-1">Popular:</span>
          {WELL_KNOWN_POOLS.map(p => (
            <button
              key={p}
              onClick={() => onChange({ ...config, pool: p })}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-all duration-150 border',
                config.pool === p
                  ? 'bg-white/[0.1] text-white border-white/[0.15]'
                  : 'text-white/30 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1]',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.06em] text-white/25">{label}</label>
      {children}
    </div>
  );
}
