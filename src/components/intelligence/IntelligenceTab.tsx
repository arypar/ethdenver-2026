'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { ChartForm } from './ChartForm';
import { ChartList } from './ChartList';
import { ChartExpandDialog } from './ChartExpandDialog';
import { LiquidityExpandView } from './LiquidityExpandView';
import { LiveChartManager } from './LiveChartManager';
import { SuggestedPools } from './SuggestedPools';
import { fetchChartData } from '@/lib/pool-data';
import { useWalletSuggestions, type PoolSuggestion } from '@/lib/use-wallet-suggestions';
import { AddPoolForm } from './AddPoolForm';
import { Activity, Zap, Droplets } from 'lucide-react';
import type { ChainId, ChartConfig, SavedChart } from '@/lib/types';

interface IntelligenceTabProps {
  chain: ChainId;
  charts: SavedChart[];
  onAddChart: (chart: SavedChart) => void;
  onRenameChart: (id: string, title: string) => void;
  onRemoveChart: (id: string) => void;
  onAppendDataPoint: (chartId: string, point: { time: string; value: number }) => void;
  onAccumulateDataPoint: (chartId: string, delta: number, block?: number) => void;
}

const DEFAULT_CONFIG: Record<ChainId, ChartConfig> = {
  eth: { metric: 'Volume', pool: 'WETH/USDC', range: '24H', chartType: 'area', chain: 'eth' },
  monad: { metric: 'Volume', pool: '', range: '24H', chartType: 'area', chain: 'monad' },
};

export function IntelligenceTab({ chain, charts, onAddChart, onRenameChart, onRemoveChart, onAppendDataPoint, onAccumulateDataPoint }: IntelligenceTabProps) {
  const [config, setConfig] = useState<ChartConfig>(DEFAULT_CONFIG[chain]);
  const [expandedChart, setExpandedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedTokenRef = useRef<{ name: string; symbol: string } | null>(null);

  const isMonad = chain === 'monad';

  const { suggestions, loading: suggestionsLoading, refresh: refreshSuggestions } = useWalletSuggestions();

  const existingPools = useMemo(
    () => new Set(charts.map(c => c.config.pool)),
    [charts],
  );

  const handleSuggestionSelect = useCallback(async (suggestion: PoolSuggestion) => {
    const pool = suggestion.pool;

    if (suggestion.reason === 'lp' && suggestion.poolAddress) {
      onAddChart({
        id: crypto.randomUUID(),
        title: `${pool} Liquidity`,
        config: { metric: 'Liquidity', pool, range: '24H', chartType: 'area', chain: 'eth', poolAddress: suggestion.poolAddress },
        data: [],
        createdAt: Date.now(),
      });
      return;
    }

    const genConfig: ChartConfig = { metric: 'Volume', pool, range: '24H', chartType: 'area', chain };
    setConfig(genConfig);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChartData(genConfig.metric, genConfig.pool, genConfig.range, chain);
      if (data.length === 0) {
        setError(`No swap activity for ${pool} in the last 24H. Try a wider time range or a more active pair.`);
        return;
      }
      onAddChart({
        id: crypto.randomUUID(),
        title: `${pool} Volume`,
        config: genConfig,
        data,
        createdAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [onAddChart, chain]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChartData(config.metric, config.pool, config.range, chain);
      const resolved = resolvedTokenRef.current;
      const label = isMonad
        ? (resolved ? `$${resolved.symbol}` : `${config.pool.slice(0, 8)}...`)
        : config.pool;
      if (data.length === 0) {
        setError(`No swap activity for ${label} in the last ${config.range}. Try a wider time range or a more active token.`);
        return;
      }
      onAddChart({
        id: crypto.randomUUID(),
        title: `${label} ${config.metric}`,
        config: { ...config, chain },
        data,
        createdAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [config, chain, isMonad, onAddChart]);

  const handleAddPool = useCallback((pool: string, poolAddress: string) => {
    onAddChart({
      id: crypto.randomUUID(),
      title: `${pool} Liquidity`,
      config: { metric: 'Liquidity', pool, range: '24H', chartType: 'area', chain: 'eth', poolAddress },
      data: [],
      createdAt: Date.now(),
    });
  }, [onAddChart]);

  const liveCount = charts.filter(c => c.data.length > 0 || c.config.metric === 'Liquidity').length;

  const headerTitle = isMonad ? 'Intelligence (Monad)' : 'Intelligence (ETH)';
  const headerSubtitle = isMonad
    ? 'Real-time nad.fun token analytics on Monad'
    : 'Real-time on-chain analytics via Uniswap V3';

  return (
    <div>
      {/* Header + suggestions unified block */}
      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF007A]/10 border border-[#FF007A]/20">
              <Activity className="h-4 w-4 text-[#FF007A]" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-white">{headerTitle}</h1>
              {liveCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400">
                    {liveCount} chart{liveCount !== 1 ? 's' : ''} streaming
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="hidden sm:block text-[13px] text-white/30">
            {headerSubtitle}
          </p>
        </div>

        {/* Wallet-based pool suggestions (ETH only) */}
        {!isMonad && (
          <SuggestedPools
            suggestions={suggestions}
            loading={suggestionsLoading}
            existingPools={existingPools}
            onSelect={handleSuggestionSelect}
            onRefresh={refreshSuggestions}
          />
        )}
      </div>

      {/* Create chart + Add liquidity pool panels */}
      <div className="mb-8 flex gap-4">
        {/* New Chart panel */}
        <div className="flex-[2] min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
            <Zap className="h-3.5 w-3.5 text-[#FF007A]" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">New Chart</span>
          </div>
          <div className="px-5 py-4">
            <ChartForm config={config} onChange={setConfig} onGenerate={handleGenerate} loading={loading} chain={chain}
              onTokenResolved={info => { resolvedTokenRef.current = info; }} />
            {error && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                <p className="text-[12px] text-amber-400/80">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* New Liquidity Pool panel (ETH mainnet only) */}
        {!isMonad && (
          <div className="flex-1 min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
              <Droplets className="h-3.5 w-3.5 text-[#FF007A]" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">New Liquidity Pool</span>
            </div>
            <div className="px-5 py-4">
              <AddPoolForm onAdd={handleAddPool} existingPools={existingPools} />
            </div>
          </div>
        )}
      </div>

      {/* Charts grid */}
      <ChartList charts={charts} onRename={onRenameChart} onDelete={onRemoveChart} onExpand={setExpandedChart} />

      {expandedChart?.config.metric === 'Liquidity' ? (
        <LiquidityExpandView chart={expandedChart} open={!!expandedChart} onClose={() => setExpandedChart(null)} />
      ) : (
        <ChartExpandDialog chart={expandedChart} open={!!expandedChart} onClose={() => setExpandedChart(null)} />
      )}

      <LiveChartManager charts={charts} chain={chain} onAppendDataPoint={onAppendDataPoint} onAccumulateDataPoint={onAccumulateDataPoint} />
    </div>
  );
}
