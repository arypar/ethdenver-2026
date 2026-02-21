'use client';

import { useState, useCallback } from 'react';
import { ChartForm } from './ChartForm';
import { ChartList } from './ChartList';
import { ChartExpandDialog } from './ChartExpandDialog';
import { LiveChartManager } from './LiveChartManager';
import { fetchChartData } from '@/lib/pool-data';
import { Activity, Zap } from 'lucide-react';
import type { ChartConfig, SavedChart } from '@/lib/types';

interface IntelligenceTabProps {
  charts: SavedChart[];
  onAddChart: (chart: SavedChart) => void;
  onRenameChart: (id: string, title: string) => void;
  onRemoveChart: (id: string) => void;
  onAppendDataPoint: (chartId: string, point: { time: string; value: number }) => void;
  onAccumulateDataPoint: (chartId: string, delta: number) => void;
}

export function IntelligenceTab({ charts, onAddChart, onRenameChart, onRemoveChart, onAppendDataPoint, onAccumulateDataPoint }: IntelligenceTabProps) {
  const [config, setConfig] = useState<ChartConfig>({
    metric: 'Volume', pool: 'WETH/USDC', range: '24H', chartType: 'area',
  });
  const [expandedChart, setExpandedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChartData(config.metric, config.pool, config.range);
      if (data.length === 0) {
        setError(`No swap activity for ${config.pool} in the last ${config.range}. Try a wider time range or a more active pair.`);
        return;
      }
      onAddChart({
        id: crypto.randomUUID(),
        title: `${config.pool} ${config.metric}`,
        config: { ...config },
        data,
        createdAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [config, onAddChart]);

  const liveCount = charts.filter(c => c.data.length > 0).length;

  return (
    <div>
      {/* Hero header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF007A]/10 border border-[#FF007A]/20">
            <Activity className="h-4.5 w-4.5 text-[#FF007A]" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-white">Intelligence</h1>
          </div>
        </div>
        <p className="text-[14px] text-white/40 ml-12">
          Real-time on-chain analytics powered by Uniswap V3 swap events.
        </p>
        {liveCount > 0 && (
          <div className="ml-12 mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-emerald-400">
                {liveCount} chart{liveCount !== 1 ? 's' : ''} streaming
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Create chart panel */}
      <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <Zap className="h-3.5 w-3.5 text-[#FF007A]" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">New Chart</span>
        </div>
        <div className="px-5 py-4">
          <ChartForm config={config} onChange={setConfig} onGenerate={handleGenerate} loading={loading} />
          {error && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <p className="text-[12px] text-amber-400/80">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts grid */}
      <ChartList charts={charts} onRename={onRenameChart} onDelete={onRemoveChart} onExpand={setExpandedChart} />

      <ChartExpandDialog chart={expandedChart} open={!!expandedChart} onClose={() => setExpandedChart(null)} />

      <LiveChartManager charts={charts} onAppendDataPoint={onAppendDataPoint} onAccumulateDataPoint={onAccumulateDataPoint} />
    </div>
  );
}
