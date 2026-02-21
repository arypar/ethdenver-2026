'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, X, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { RenderChart } from './ChartCard';
import { usePoolStream, metricFromSwap, type SwapEvent } from '@/lib/use-pool-stream';
import type { SavedChart } from '@/lib/types';
import { formatValue, formatBlockFull, getChartStats, getYDomain } from '@/lib/pool-data';

interface ChartExpandDialogProps {
  chart: SavedChart | null;
  open: boolean;
  onClose: () => void;
}

interface FeedEntry {
  id: string;
  blockNumber: number;
  price: number;
  volumeUSD: number;
  txHash: string;
  timestamp: number;
  direction: 'up' | 'down' | 'neutral';
}

function SwapFeed({ pool }: { pool: string }) {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const lastPriceRef = useRef<number>(0);

  const handleSwap = useCallback((swap: SwapEvent) => {
    const direction: FeedEntry['direction'] =
      lastPriceRef.current === 0 ? 'neutral' :
      swap.price > lastPriceRef.current ? 'up' :
      swap.price < lastPriceRef.current ? 'down' : 'neutral';
    lastPriceRef.current = swap.price;

    const entry: FeedEntry = {
      id: `${swap.blockNumber}-${swap.txHash}`,
      blockNumber: swap.blockNumber,
      price: swap.price,
      volumeUSD: swap.volumeUSD,
      txHash: swap.txHash,
      timestamp: swap.timestamp,
      direction,
    };

    setEntries(prev => {
      const next = [entry, ...prev];
      if (next.length > 50) next.length = 50;
      return next;
    });
  }, []);

  const { connected, swapCount } = usePoolStream(pool, handleSwap);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Live Feed</span>
          {connected ? (
            <Wifi className="h-3 w-3 text-emerald-400" />
          ) : (
            <WifiOff className="h-3 w-3 text-white/20" />
          )}
        </div>
        <span className="text-[10px] font-mono text-white/20">{swapCount} swaps</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 rounded-xl border border-white/[0.06] bg-white/[0.03] flex items-center justify-center">
                {connected ? (
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                )}
              </div>
              <p className="text-[11px] text-white/25">
                {connected ? 'Waiting for swaps...' : 'Connecting to stream...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${i === 0 ? 'bg-white/[0.03]' : ''}`}
                style={i === 0 ? { animation: 'fadeIn 300ms ease-out' } : undefined}
              >
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  entry.direction === 'up' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' :
                  entry.direction === 'down' ? 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.5)]' :
                  'bg-white/20'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-semibold font-mono ${
                      entry.direction === 'up' ? 'text-emerald-400' :
                      entry.direction === 'down' ? 'text-red-400' :
                      'text-white/70'
                    }`}>
                      ${entry.price >= 1 ? entry.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : entry.price.toFixed(6)}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono">
                      ${entry.volumeUSD >= 1000 ? (entry.volumeUSD / 1000).toFixed(1) + 'K' : entry.volumeUSD.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono text-white/15">
                      {formatBlockFull(entry.blockNumber)}
                    </span>
                    <a
                      href={`https://etherscan.io/tx/${entry.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-mono text-white/10 hover:text-white/30 flex items-center gap-0.5"
                      onClick={e => e.stopPropagation()}
                    >
                      {entry.txHash.slice(0, 8)}...
                      <ExternalLink className="h-2 w-2" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartExpandDialog({ chart, open, onClose }: ChartExpandDialogProps) {
  if (!chart) return null;

  const stats = getChartStats(chart.data);
  const { config } = chart;
  const lastBlock = chart.data.length > 0 ? chart.data[chart.data.length - 1].block : undefined;
  const allValues = chart.data.map(d => d.value);
  const high = allValues.length > 0 ? Math.max(...allValues) : 0;
  const low = allValues.length > 0 ? Math.min(...allValues) : 0;
  const open_ = allValues.length > 0 ? allValues[0] : 0;
  const totalVolume = chart.data.reduce((sum, d) => sum + d.value, 0);
  const isPositive = stats.change24h >= 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-none !w-screen !h-screen !rounded-none !border-0 bg-[#07070D] p-0 gap-0 overflow-hidden"
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="flex h-full flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#FF007A]" style={{ boxShadow: '0 0 8px rgba(255,0,122,0.4)' }} />
                <span className="text-[15px] font-bold text-white tracking-[-0.02em]">{config.pool}</span>
                <span className="text-[12px] text-white/30 font-medium">{config.metric}</span>
              </div>
              <div className="h-4 w-px bg-white/[0.06]" />
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                LIVE
              </span>
              {lastBlock && (
                <>
                  <div className="h-4 w-px bg-white/[0.06]" />
                  <span className="text-[11px] font-mono text-white/20">Block {formatBlockFull(lastBlock)}</span>
                </>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/40 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Main content */}
          <div className="flex flex-1 min-h-0">
            {/* Chart area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Hero value */}
              <div className="px-6 pt-5 pb-2 shrink-0">
                <div className="flex items-end gap-4">
                  <span className={`text-[36px] font-bold tracking-[-0.03em] leading-none ${isPositive ? 'text-white' : 'text-white'}`}
                    style={isPositive ? { textShadow: '0 0 30px rgba(52,211,153,0.15)' } : { textShadow: '0 0 30px rgba(248,113,113,0.15)' }}>
                    {formatValue(stats.current, config.metric)}
                  </span>
                  <div className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold ${
                    isPositive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {isPositive ? '+' : ''}{stats.change24h.toFixed(2)}%
                  </div>
                  <span className="text-[12px] text-white/20 pb-0.5">{config.range}</span>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-0 px-4 pb-2">
                {chart.data.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#FF007A]" />
                      <span className="text-[13px] text-white/30">Loading on-chain data...</span>
                    </div>
                  </div>
                ) : (
                  <RenderChart config={config} data={chart.data} chartId={`exp-${chart.id}`} height="h-full" />
                )}
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-6 border-t border-white/[0.06] px-6 py-3 shrink-0">
                {config.metric === 'Price' ? (
                  <>
                    <StatChip label="Open" value={formatValue(open_, config.metric)} />
                    <StatChip label="High" value={formatValue(high, config.metric)} accent="emerald" />
                    <StatChip label="Low" value={formatValue(low, config.metric)} accent="red" />
                    <StatChip label="Current" value={formatValue(stats.current, config.metric)} />
                  </>
                ) : (
                  <>
                    <StatChip label="Current" value={formatValue(stats.current, config.metric)} />
                    <StatChip label="Peak" value={formatValue(stats.peak, config.metric)} accent="emerald" />
                    <StatChip label="Total" value={formatValue(totalVolume, config.metric)} />
                  </>
                )}
                <StatChip label="Data Points" value={chart.data.length.toString()} />
                <div className="flex-1" />
                <span className="text-[10px] font-mono text-white/15">
                  {config.chartType} · {config.range} · {chart.data.length} pts
                </span>
              </div>
            </div>

            {/* Live feed sidebar */}
            <div className="w-[280px] shrink-0 border-l border-white/[0.06] bg-white/[0.01]">
              <SwapFeed pool={config.pool} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'red' }) {
  const valueColor = accent === 'emerald' ? 'text-emerald-400' : accent === 'red' ? 'text-red-400' : 'text-white/80';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/25">{label}</span>
      <span className={`text-[12px] font-semibold font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
