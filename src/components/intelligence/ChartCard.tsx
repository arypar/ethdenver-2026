'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, TrendingUp, TrendingDown, Maximize2, Droplets, Wallet, ExternalLink } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from 'recharts';
import type { SavedChart, ChartConfig, ChartDataPoint } from '@/lib/types';
import { formatValue, formatAxisTick, formatBlockFull, getChartStats, getYDomain } from '@/lib/pool-data';
import { usePoolLiquidityMonitor, type LiquidityEvent } from '@/lib/use-pool-liquidity-monitor';
import { TOKENS } from '@/lib/tokens';

interface ChartCardProps {
  chart: SavedChart;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExpand: (chart: SavedChart) => void;
}

function ChartTooltip({ active, payload, metric, range }: { active?: boolean; payload?: Array<{ value: number; payload: ChartDataPoint }>; metric: string; range?: string }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  const showPrice = metric !== 'Price' && point.price != null && point.price > 0;
  const interval = range ? BUCKET_DURATION[range] : undefined;
  const metricLabel = metric === 'Swap Count' ? 'Swaps' : metric;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-black/80 px-3 py-2 backdrop-blur-xl shadow-xl">
      {point.block && (
        <p className="text-[10px] text-white/30 mb-0.5 font-mono">Block {formatBlockFull(point.block)}</p>
      )}
      <p className="text-[10px] text-white/40 mb-0.5">{point.time}{interval ? ` (${interval} bucket)` : ''}</p>
      <p className="text-[14px] font-bold text-white">
        {metricLabel}: {formatValue(payload[0].value, metric as ChartConfig['metric'])}
      </p>
      {showPrice && (
        <p className="text-[11px] text-white/50 mt-0.5">Price: {formatValue(point.price!, 'Price')}</p>
      )}
    </div>
  );
}

const BUCKET_DURATION: Record<string, string> = {
  '1H': '~1 min',
  '24H': '~15 min',
  '7D': '~2 hr',
  '30D': '~12 hr',
};

function getChartDescription(metric: string, range: string): string {
  if (metric === 'Liquidity') return 'Live liquidity adds, removals, and fee collects for this pool';
  const interval = BUCKET_DURATION[range] || range;
  switch (metric) {
    case 'Price':
      return `Closing price per ${interval} bucket over the last ${range}`;
    case 'Volume':
      return `USD volume per ${interval} bucket over the last ${range}`;
    case 'Fees':
      return `Fees collected per ${interval} bucket over the last ${range}`;
    case 'Swap Count':
      return `Number of swaps per ${interval} bucket over the last ${range}`;
    default:
      return `${metric} per ${interval} bucket over the last ${range}`;
  }
}

function LiveDot(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#FF007A" opacity={0.2}>
        <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3} fill="#FF007A" stroke="#fff" strokeWidth={1.5} />
    </g>
  );
}

export function RenderChart({ config, data, chartId, height }: { config: ChartConfig; data: SavedChart['data']; chartId: string; height?: string }) {
  const domain = getYDomain(data, config.metric);
  const lastPoint = data.length > 0 ? data[data.length - 1] : null;

  const xAxis = {
    dataKey: 'time' as const,
    tick: { fill: 'rgba(255,255,255,0.25)', fontSize: 10 },
    tickLine: false,
    axisLine: false,
    interval: Math.max(1, Math.floor(data.length / 6)),
  };

  const yAxis = {
    tick: { fill: 'rgba(255,255,255,0.25)', fontSize: 10 },
    tickLine: false,
    axisLine: false,
    width: 62,
    domain,
    tickFormatter: (v: number) => formatAxisTick(v, config.metric),
    allowDataOverflow: true,
  };

  const grid = { strokeDasharray: '3 3' as const, stroke: 'rgba(255,255,255,0.04)' };
  const margin = { top: 12, right: 12, left: 0, bottom: 0 };

  const inner = () => {
    if (config.chartType === 'bar') {
      return (
        <BarChart data={data} margin={margin}>
          <CartesianGrid {...grid} />
          <XAxis {...xAxis} />
          <YAxis {...yAxis} />
          <Tooltip content={<ChartTooltip metric={config.metric} range={config.range} />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Bar dataKey="value" fill="#FF007A" opacity={0.85} radius={[3, 3, 0, 0]} animationDuration={300} />
        </BarChart>
      );
    }
    if (config.chartType === 'line') {
      return (
        <LineChart data={data} margin={margin}>
          <CartesianGrid {...grid} />
          <XAxis {...xAxis} />
          <YAxis {...yAxis} />
          <Tooltip content={<ChartTooltip metric={config.metric} range={config.range} />} />
          <Line
            type="monotone" dataKey="value" stroke="#FF007A" strokeWidth={2}
            dot={false} activeDot={{ r: 4, fill: '#FF007A', stroke: '#fff', strokeWidth: 1.5 }}
            animationDuration={300} isAnimationActive={true}
          />
          {lastPoint && (
            <ReferenceDot x={lastPoint.time} y={lastPoint.value} shape={<LiveDot />} />
          )}
        </LineChart>
      );
    }
    return (
      <AreaChart data={data} margin={margin}>
        <CartesianGrid {...grid} />
        <XAxis {...xAxis} />
        <YAxis {...yAxis} />
        <Tooltip content={<ChartTooltip metric={config.metric} range={config.range} />} />
        <defs>
          <linearGradient id={`af-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF007A" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#FF007A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="value" stroke="#FF007A" strokeWidth={2}
          fill={`url(#af-${chartId})`}
          dot={false} activeDot={{ r: 4, fill: '#FF007A', stroke: '#fff', strokeWidth: 1.5 }}
          animationDuration={300} isAnimationActive={true}
        />
        {lastPoint && (
          <ReferenceDot x={lastPoint.time} y={lastPoint.value} shape={<LiveDot />} />
        )}
      </AreaChart>
    );
  };

  return (
    <div className={height ?? 'h-[240px]'}>
      <ResponsiveContainer width="100%" height="100%">{inner()}</ResponsiveContainer>
    </div>
  );
}

// ── Liquidity event feed helpers ──────────────────────────────────

const liqEventColors: Record<string, string> = {
  mint: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  burn: 'bg-red-400/10 text-red-400 border-red-400/20',
  collect: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
};

const liqEventLabels: Record<string, string> = {
  mint: 'Add Liquidity',
  burn: 'Remove Liquidity',
  collect: 'Collect Fees',
};

const liqEventIcons: Record<string, typeof TrendingUp> = {
  mint: TrendingUp,
  burn: TrendingDown,
  collect: Wallet,
};

function truncateAddr(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 2) return addr || '--';
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

function liqTimeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 24 * 3600) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTokenAmount(raw: string, decimals: number): string {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.0001) return n.toFixed(4);
  if (n !== 0) return n.toExponential(2);
  return '0';
}

function getPoolTokenInfo(poolName: string): { sym0: string; dec0: number; sym1: string; dec1: number } {
  const parts = poolName.split('/');
  const sym0 = parts[0] || '?';
  const sym1 = parts[1] || '?';
  const dec0 = TOKENS[sym0]?.decimals ?? 18;
  const dec1 = TOKENS[sym1]?.decimals ?? 18;
  return { sym0, dec0, sym1, dec1 };
}

function LiqEventRow({ event, sym0, dec0, sym1, dec1 }: {
  event: LiquidityEvent; sym0: string; dec0: number; sym1: string; dec1: number;
}) {
  const colorClass = liqEventColors[event.event_type] || 'bg-white/10 text-white/60';
  const Icon = liqEventIcons[event.event_type] || Droplets;
  const label = liqEventLabels[event.event_type] || event.event_type;

  const humanAmt0 = formatTokenAmount(event.amount0, dec0);
  const humanAmt1 = formatTokenAmount(event.amount1, dec1);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03] text-[11px] transition-colors hover:bg-white/[0.04]">
      <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${colorClass}`}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-white/60 font-mono tabular-nums shrink-0">
          {humanAmt0} <span className="text-white/30">{sym0}</span>
        </span>
        <span className="text-white/15">+</span>
        <span className="text-white/60 font-mono tabular-nums shrink-0">
          {humanAmt1} <span className="text-white/30">{sym1}</span>
        </span>
      </div>

      <a
        href={`https://etherscan.io/tx/${event.tx_hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-0.5 text-white/20 hover:text-[#FF007A] font-mono shrink-0 transition-colors"
      >
        {truncateAddr(event.tx_hash, 4)}
        <ExternalLink className="h-2 w-2 opacity-40" />
      </a>

      <span className="text-white/20 text-[10px] shrink-0 tabular-nums">{liqTimeAgo(event.block_timestamp)}</span>
    </div>
  );
}

function LiquidityFeed({ poolAddress, poolName }: { poolAddress: string; poolName: string }) {
  const { events, tvl, stats, loading, wsConnected } = usePoolLiquidityMonitor(poolAddress, 'eth');
  const { sym0, dec0, sym1, dec1 } = getPoolTokenInfo(poolName);

  const humanTvl0 = formatTokenAmount(tvl.amount0, dec0);
  const humanTvl1 = formatTokenAmount(tvl.amount1, dec1);
  const totalEvents = stats.mints + stats.burns + stats.collects;

  return (
    <div>
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 py-3 border-b border-white/[0.04]">
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/25 mb-0.5">Adds</div>
          <div className="text-[15px] font-semibold tabular-nums text-emerald-400">{stats.mints}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/25 mb-0.5">Removes</div>
          <div className="text-[15px] font-semibold tabular-nums text-red-400">{stats.burns}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/25 mb-0.5">Fee Collects</div>
          <div className="text-[15px] font-semibold tabular-nums text-amber-400">{stats.collects}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/25 mb-0.5">{sym0} TVL</div>
          <div className="text-[14px] font-semibold tabular-nums text-white/70">{humanTvl0}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/25 mb-0.5">{sym1} TVL</div>
          <div className="text-[14px] font-semibold tabular-nums text-white/70">{humanTvl1}</div>
        </div>
      </div>

      {/* Pool info bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <a
            href={`https://etherscan.io/address/${poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 font-mono transition-colors"
          >
            Pool: {truncateAddr(poolAddress, 5)}
            <ExternalLink className="h-2 w-2 opacity-40" />
          </a>
          <span className="text-[10px] text-white/15">Ethereum</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/20 tabular-nums">{totalEvents} event{totalEvents !== 1 ? 's' : ''}</span>
          {wsConnected && (
            <span className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[9px] font-medium text-emerald-400">Polling</span>
            </span>
          )}
        </div>
      </div>

      {/* Event feed */}
      <div className="max-h-[220px] overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400 mx-auto mb-2" />
            <p className="text-[11px] text-white/30">Scanning for liquidity events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center">
            <Droplets className="mx-auto h-5 w-5 text-white/10 mb-2" />
            <p className="text-[11px] text-white/30">No liquidity events found</p>
            <p className="text-[10px] text-white/15 mt-1">Add or remove liquidity to see events appear here</p>
          </div>
        ) : (
          events.map((evt, i) => (
            <LiqEventRow
              key={`${evt.tx_hash}-${evt.event_type}-${i}`}
              event={evt}
              sym0={sym0} dec0={dec0} sym1={sym1} dec1={dec1}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main chart card ──────────────────────────────────────────────

export function ChartCard({ chart, onRename, onDelete, onExpand }: ChartCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chart.title);
  const [flash, setFlash] = useState(false);
  const prevLenRef = useRef(chart.data.length);
  const stats = getChartStats(chart.data);
  const { config } = chart;

  useEffect(() => {
    if (chart.data.length > prevLenRef.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(t);
    }
    prevLenRef.current = chart.data.length;
  }, [chart.data.length]);

  const lastBlock = chart.data.length > 0 ? chart.data[chart.data.length - 1].block : undefined;

  const commitRename = () => {
    onRename(chart.id, title || chart.title);
    setEditing(false);
  };

  return (
    <div className={`group rounded-2xl border bg-white/[0.04] backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06] ${flash ? 'border-[#FF007A]/40 shadow-[0_0_20px_rgba(255,0,122,0.15)]' : 'border-white/[0.08]'}`}>
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitRename()}
                className="h-7 text-sm rounded-lg bg-white/[0.06] border-white/[0.1] text-white" autoFocus />
              <Button variant="ghost" size="icon-xs" onClick={commitRename}><Check className="h-3 w-3" /></Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-white">{chart.title}</h3>
                <span className="text-[11px] text-white/30">{config.chain === 'monad' && config.pool.startsWith('0x') ? `${config.pool.slice(0, 6)}...${config.pool.slice(-4)}` : config.pool} · {config.range}</span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  LIVE
                </span>
                {lastBlock && (
                  <span className="text-[10px] font-mono text-white/20">
                    Block #{lastBlock.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/25 mt-0.5">{getChartDescription(config.metric, config.range)}</p>
            </div>
          )}
        </div>
        <div className="flex gap-0.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Button variant="ghost" size="icon-xs" onClick={() => onExpand(chart)} title="Expand"
            className="text-white/30 hover:text-white hover:bg-white/[0.08]"><Maximize2 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => setEditing(true)} title="Rename"
            className="text-white/30 hover:text-white hover:bg-white/[0.08]"><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onDelete(chart.id)} title="Delete"
            className="text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      {config.metric === 'Liquidity' && config.poolAddress ? (
        <div className="pt-1">
          <LiquidityFeed poolAddress={config.poolAddress} poolName={config.pool} />
        </div>
      ) : (
        <>
          <div className="px-3 pt-2">
            {chart.data.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#FF007A]" />
                  <span className="text-[12px] text-white/30">Loading on-chain data...</span>
                </div>
              </div>
            ) : (
              <RenderChart config={config} data={chart.data} chartId={chart.id} />
            )}
          </div>

          {chart.data.length > 0 && (
            <div className="flex items-center gap-8 border-t border-white/[0.06] mx-5 py-3.5 text-[12px]">
              <Stat label="Latest bucket" value={formatValue(stats.current, config.metric, config.chain)} />
              <Stat label={`${config.range} change`} value={`${stats.change24h >= 0 ? '+' : ''}${stats.change24h.toFixed(2)}%`} positive={stats.change24h >= 0} showIcon />
              <Stat label="Peak bucket" value={formatValue(stats.peak, config.metric, config.chain)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, positive, showIcon }: { label: string; value: string; positive?: boolean; showIcon?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/30">{label}</span>
      {showIcon && (positive ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />)}
      <span className={`font-semibold ${showIcon ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-white/80'}`}>{value}</span>
    </div>
  );
}
