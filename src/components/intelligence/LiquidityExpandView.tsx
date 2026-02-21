'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  X, ExternalLink, Droplets, TrendingUp, TrendingDown,
  Wallet, ArrowUpRight, ArrowDownRight, Clock, Hash,
  Activity, Layers, Filter,
} from 'lucide-react';
import { usePoolLiquidityMonitor, type LiquidityEvent, type TvlUsd } from '@/lib/use-pool-liquidity-monitor';
import { TOKENS } from '@/lib/tokens';
import type { SavedChart } from '@/lib/types';

interface LiquidityExpandViewProps {
  chart: SavedChart | null;
  open: boolean;
  onClose: () => void;
}

type EventFilter = 'all' | 'mint' | 'burn' | 'collect';

function getTokenInfo(poolName: string) {
  const parts = poolName.split('/');
  const sym0 = parts[0] || '?';
  const sym1 = parts[1] || '?';
  const dec0 = TOKENS[sym0]?.decimals ?? 18;
  const dec1 = TOKENS[sym1]?.decimals ?? 18;
  return { sym0, dec0, sym1, dec1 };
}

function fmtAmount(raw: string, decimals: number): string {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(4);
  if (Math.abs(n) >= 0.0001) return n.toFixed(6);
  if (n !== 0) return n.toExponential(2);
  return '0';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtFullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || '--';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

const EVENT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  mint:    { label: 'Add Liquidity',    color: 'text-emerald-400', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20', icon: ArrowUpRight },
  burn:    { label: 'Remove Liquidity', color: 'text-red-400',     bg: 'bg-red-500/8',      border: 'border-red-500/20',     icon: ArrowDownRight },
  collect: { label: 'Collect Fees',     color: 'text-amber-400',   bg: 'bg-amber-500/8',    border: 'border-amber-500/20',   icon: Wallet },
};

export function LiquidityExpandView({ chart, open, onClose }: LiquidityExpandViewProps) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const poolAddress = chart?.config.poolAddress ?? '';
  const poolName = chart?.config.pool ?? '';
  const { sym0, dec0, sym1, dec1 } = getTokenInfo(poolName);

  const { events, tvl, tvlUsd, stats, loading, wsConnected } = usePoolLiquidityMonitor(poolAddress, 'eth', poolName);

  const filteredEvents = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.event_type === filter),
    [events, filter],
  );

  const totalEvents = stats.mints + stats.burns + stats.collects;
  const addPct = totalEvents > 0 ? (stats.mints / totalEvents) * 100 : 0;
  const removePct = totalEvents > 0 ? (stats.burns / totalEvents) * 100 : 0;
  const collectPct = totalEvents > 0 ? (stats.collects / totalEvents) * 100 : 0;

  const humanTvl0 = formatUsd(tvlUsd.usd0);
  const humanTvl1 = formatUsd(tvlUsd.usd1);

  if (!chart) return null;

  const filterBtns: { key: EventFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: totalEvents, color: 'text-white/60' },
    { key: 'mint', label: 'Adds', count: stats.mints, color: 'text-emerald-400' },
    { key: 'burn', label: 'Removes', count: stats.burns, color: 'text-red-400' },
    { key: 'collect', label: 'Collects', count: stats.collects, color: 'text-amber-400' },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="!max-w-none !w-screen !h-screen !rounded-none !border-0 bg-[#07070D] p-0 gap-0 overflow-hidden"
      >
        <VisuallyHidden><DialogTitle>Liquidity Monitor</DialogTitle></VisuallyHidden>
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="flex h-full flex-col">
          {/* ── Top bar ─────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF007A]/10 border border-[#FF007A]/20">
                  <Droplets className="h-3.5 w-3.5 text-[#FF007A]" />
                </div>
                <span className="text-[16px] font-bold text-white tracking-[-0.02em]">{poolName}</span>
                <span className="text-[12px] text-white/30 font-medium">Liquidity</span>
              </div>
              <div className="h-4 w-px bg-white/[0.06]" />
              <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-white/40">
                Ethereum
              </span>
              <div className="h-4 w-px bg-white/[0.06]" />
              {wsConnected && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  LIVE
                </span>
              )}
              <a
                href={`https://etherscan.io/address/${poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors"
              >
                {truncAddr(poolAddress)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/40 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ── Main content ────────────────────────────────── */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel – overview */}
            <div className="w-[380px] shrink-0 border-r border-white/[0.06] flex flex-col overflow-y-auto">
              {/* TVL hero cards */}
              <div className="p-5 space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/25 flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  Total Value Locked
                </div>

                <div className="rounded-xl border border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-white/40">{sym0}</span>
                    <span className="text-[9px] font-mono text-white/15">{TOKENS[sym0]?.address ? truncAddr(TOKENS[sym0].address) : ''}</span>
                  </div>
                  <div className="text-[28px] font-bold tracking-[-0.03em] text-white leading-none">
                    {humanTvl0}
                  </div>
                  <div className="text-[11px] text-emerald-400/60 mt-1">{sym0}</div>
                </div>

                <div className="rounded-xl border border-blue-500/10 bg-gradient-to-br from-blue-500/[0.06] to-transparent p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-white/40">{sym1}</span>
                    <span className="text-[9px] font-mono text-white/15">{TOKENS[sym1]?.address ? truncAddr(TOKENS[sym1].address) : ''}</span>
                  </div>
                  <div className="text-[28px] font-bold tracking-[-0.03em] text-white leading-none">
                    {humanTvl1}
                  </div>
                  <div className="text-[11px] text-blue-400/60 mt-1">{sym1}</div>
                </div>
              </div>

              {/* Activity breakdown */}
              <div className="px-5 pb-5 space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/25 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Activity Breakdown
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                  {/* Composition bar */}
                  <div className="h-3 rounded-full overflow-hidden bg-white/[0.04] flex">
                    {addPct > 0 && (
                      <div
                        className="bg-emerald-400 transition-all duration-500 rounded-l-full"
                        style={{ width: `${addPct}%` }}
                      />
                    )}
                    {removePct > 0 && (
                      <div
                        className="bg-red-400 transition-all duration-500"
                        style={{ width: `${removePct}%` }}
                      />
                    )}
                    {collectPct > 0 && (
                      <div
                        className="bg-amber-400 transition-all duration-500 rounded-r-full"
                        style={{ width: `${collectPct}%` }}
                      />
                    )}
                  </div>

                  {/* Stat rows */}
                  <div className="space-y-2.5">
                    <ActivityRow label="Adds" count={stats.mints} total={totalEvents} color="emerald" Icon={ArrowUpRight} />
                    <ActivityRow label="Removes" count={stats.burns} total={totalEvents} color="red" Icon={ArrowDownRight} />
                    <ActivityRow label="Fee Collects" count={stats.collects} total={totalEvents} color="amber" Icon={Wallet} />
                  </div>
                </div>
              </div>

              {/* Pool details */}
              <div className="px-5 pb-5 mt-auto">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
                  <DetailRow label="Network" value="Ethereum Mainnet" />
                  <DetailRow label="Protocol" value="Uniswap V3" />
                  <DetailRow label="Pool" value={truncAddr(poolAddress)} mono link={`https://etherscan.io/address/${poolAddress}`} />
                  <DetailRow label="Events Indexed" value={totalEvents.toString()} />
                  <DetailRow label="Status" value={wsConnected ? 'Polling' : 'Disconnected'} accent={wsConnected ? 'emerald' : 'red'} />
                </div>
              </div>
            </div>

            {/* Right panel – event timeline */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Filter bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-2.5 shrink-0">
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-white/20 mr-1.5" />
                  {filterBtns.map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setFilter(btn.key)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                        filter === btn.key
                          ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                          : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      {btn.label}
                      <span className={`text-[10px] ${filter === btn.key ? btn.color : 'text-white/20'}`}>
                        {btn.count}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-white/15 font-mono">
                  {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[140px_1fr_1fr_140px_100px_80px] gap-2 px-5 py-2 border-b border-white/[0.04] text-[9px] font-semibold uppercase tracking-[0.08em] text-white/20 shrink-0">
                <span>Type</span>
                <span>{sym0} Amount</span>
                <span>{sym1} Amount</span>
                <span>Transaction</span>
                <span>Block</span>
                <span className="text-right">Time</span>
              </div>

              {/* Events */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#FF007A] mx-auto mb-3" />
                      <p className="text-[12px] text-white/30">Scanning for liquidity events...</p>
                      <p className="text-[10px] text-white/15 mt-1">This may take a moment</p>
                    </div>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Droplets className="mx-auto h-8 w-8 text-white/[0.06] mb-3" />
                      <p className="text-[13px] text-white/30">
                        {filter === 'all' ? 'No liquidity events found' : `No ${filter} events found`}
                      </p>
                      <p className="text-[11px] text-white/15 mt-1">
                        {filter !== 'all'
                          ? 'Try a different filter or wait for new events'
                          : 'Add or remove liquidity to see events appear here'}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredEvents.map((evt, i) => (
                    <EventTimelineRow
                      key={`${evt.tx_hash}-${evt.event_type}-${i}`}
                      event={evt}
                      sym0={sym0} dec0={dec0}
                      sym1={sym1} dec1={dec1}
                      isFirst={i === 0}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventTimelineRow({ event, sym0, dec0, sym1, dec1, isFirst }: {
  event: LiquidityEvent;
  sym0: string; dec0: number;
  sym1: string; dec1: number;
  isFirst: boolean;
}) {
  const meta = EVENT_META[event.event_type] || EVENT_META.mint;
  const Icon = meta.icon;
  const amt0 = fmtAmount(event.amount0, dec0);
  const amt1 = fmtAmount(event.amount1, dec1);

  return (
    <div
      className={`grid grid-cols-[140px_1fr_1fr_140px_100px_80px] gap-2 items-center px-5 py-3 border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${
        isFirst ? 'bg-white/[0.02]' : ''
      }`}
      style={isFirst ? { animation: 'fadeSlideIn 300ms ease-out' } : undefined}
    >
      {/* Type badge */}
      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium w-fit ${meta.bg} ${meta.color} ${meta.border}`}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>

      {/* Token 0 amount */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-semibold font-mono tabular-nums text-white/80">{amt0}</span>
        <span className="text-[10px] text-white/25">{sym0}</span>
      </div>

      {/* Token 1 amount */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-semibold font-mono tabular-nums text-white/80">{amt1}</span>
        <span className="text-[10px] text-white/25">{sym1}</span>
      </div>

      {/* Transaction */}
      <a
        href={`https://etherscan.io/tx/${event.tx_hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[11px] font-mono text-white/25 hover:text-[#FF007A] transition-colors"
      >
        {truncAddr(event.tx_hash)}
        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40" />
      </a>

      {/* Block */}
      <div className="flex items-center gap-1 text-[11px] font-mono text-white/20">
        <Hash className="h-2.5 w-2.5 opacity-40" />
        {event.block_number.toLocaleString()}
      </div>

      {/* Time */}
      <div className="text-right" title={fmtFullTime(event.block_timestamp)}>
        <div className="flex items-center justify-end gap-1 text-[11px] text-white/25">
          <Clock className="h-2.5 w-2.5 opacity-40" />
          {fmtTime(event.block_timestamp)}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ label, count, total, color, Icon }: {
  label: string; count: number; total: number;
  color: 'emerald' | 'red' | 'amber';
  Icon: typeof TrendingUp;
}) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  const colorMap = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400', dot: 'bg-emerald-400' },
    red:     { text: 'text-red-400',     bg: 'bg-red-400',     dot: 'bg-red-400' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-400',   dot: 'bg-amber-400' },
  }[color];

  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.04] ${colorMap.text}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/50">{label}</span>
          <span className={`text-[12px] font-semibold tabular-nums ${colorMap.text}`}>{count}</span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
          <div className={`h-full rounded-full ${colorMap.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-white/20 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function DetailRow({ label, value, mono, link, accent }: {
  label: string; value: string; mono?: boolean; link?: string; accent?: 'emerald' | 'red';
}) {
  const accentColor = accent === 'emerald' ? 'text-emerald-400' : accent === 'red' ? 'text-red-400' : 'text-white/60';

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/25">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[11px] text-white/40 hover:text-[#FF007A] transition-colors flex items-center gap-1 ${mono ? 'font-mono' : ''}`}
        >
          {value}
          <ExternalLink className="h-2 w-2 opacity-40" />
        </a>
      ) : (
        <span className={`text-[11px] ${mono ? 'font-mono' : ''} ${accentColor}`}>{value}</span>
      )}
    </div>
  );
}
