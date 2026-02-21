'use client';

import { X, Droplets, TrendingUp, TrendingDown, Wallet, ExternalLink } from 'lucide-react';
import { usePoolLiquidityMonitor } from '@/lib/use-pool-liquidity-monitor';
import type { LpPositionData } from '@/lib/use-wallet-suggestions';
import type { LiquidityEvent } from '@/lib/use-pool-liquidity-monitor';

interface LpInfoCardProps {
  lpData: LpPositionData;
  onClose: () => void;
}

function formatFeeTier(fee: number): string {
  if (fee >= 1000) return `${(fee / 10000).toFixed(1)}%`;
  return `${(fee / 10000).toFixed(2)}%`;
}

function formatBigAmount(raw: string): string {
  const n = Number(raw);
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e18) return `${(n / 1e18).toFixed(4)}`;
  if (Math.abs(n) >= 1e15) return `${(n / 1e15).toFixed(2)}e15`;
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (Math.abs(n) < 0.01 && n !== 0) return '<0.01';
  return n.toLocaleString();
}

function truncate(addr: string, chars = 6): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const eventColors: Record<string, string> = {
  mint: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  burn: 'bg-red-400/10 text-red-400 border-red-400/20',
  collect: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
};

const eventIcons: Record<string, typeof TrendingUp> = {
  mint: TrendingUp,
  burn: TrendingDown,
  collect: Wallet,
};

function EventRow({ event }: { event: LiquidityEvent }) {
  const colorClass = eventColors[event.event_type] || 'bg-white/10 text-white/60';
  const Icon = eventIcons[event.event_type] || Droplets;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.03] text-[12px] transition-colors hover:bg-white/[0.04]">
      <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${colorClass}`}>
        <Icon className="h-2.5 w-2.5" />
        {event.event_type}
      </span>

      <a
        href={`https://etherscan.io/tx/${event.tx_hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[#FF007A]/70 hover:text-[#FF007A] font-mono shrink-0"
      >
        {truncate(event.tx_hash, 6)}
        <ExternalLink className="h-2.5 w-2.5 opacity-40" />
      </a>

      <span className="text-white/30 text-[11px] shrink-0">
        [{event.tick_lower}, {event.tick_upper}]
      </span>

      <span className="text-white/40 text-[11px] truncate">
        a0: {formatBigAmount(event.amount0)} / a1: {formatBigAmount(event.amount1)}
      </span>

      <span className="text-white/25 text-[11px] ml-auto shrink-0">
        {timeAgo(event.block_timestamp)}
      </span>
    </div>
  );
}

export function LpInfoCard({ lpData, onClose }: LpInfoCardProps) {
  const poolAddress = lpData.poolAddress || '';

  const poolName = lpData.token0Symbol && lpData.token1Symbol
    ? `${lpData.token0Symbol}/${lpData.token1Symbol}`
    : '';
  const { events, tvl, stats, loading, wsConnected } = usePoolLiquidityMonitor(
    poolAddress,
    'eth',
    poolName,
  );

  const statCards = [
    { label: 'Mints', value: stats.mints, color: 'text-emerald-400' },
    { label: 'Burns', value: stats.burns, color: 'text-red-400' },
    { label: 'Collects', value: stats.collects, color: 'text-amber-400' },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] backdrop-blur-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-emerald-400" />
          <span className="text-[14px] font-semibold text-white">
            {lpData.token0Symbol}/{lpData.token1Symbol}
          </span>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-[1px] text-[10px] font-semibold text-emerald-400 uppercase">
            LP Monitor
          </span>
          <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-[1px] text-[10px] font-medium text-white/40 uppercase">
            {lpData.version}
          </span>
          {lpData.feeTier > 0 && (
            <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-[1px] text-[10px] font-medium text-white/40">
              {formatFeeTier(lpData.feeTier)} fee
            </span>
          )}
          {wsConnected && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-[1px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[9px] font-medium text-emerald-400">Live</span>
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 px-5 py-3 border-b border-white/[0.04]">
        {statCards.map(({ label, value, color }) => (
          <div key={label}>
            <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-white/25">{label}</div>
            <div className={`text-[16px] font-semibold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
        <div>
          <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-white/25">TVL Token0</div>
          <div className="text-[13px] font-mono text-white/60">{formatBigAmount(tvl.amount0)}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-white/25">TVL Token1</div>
          <div className="text-[13px] font-mono text-white/60">{formatBigAmount(tvl.amount1)}</div>
        </div>
      </div>

      {/* Event feed */}
      <div className="max-h-[250px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400 mx-auto mb-2" />
            <p className="text-[12px] text-white/40">Loading liquidity events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center">
            <Droplets className="mx-auto h-6 w-6 text-white/15 mb-2" />
            <p className="text-[12px] text-white/40">No liquidity events yet</p>
            <p className="text-[11px] text-white/20 mt-1">Mint, Burn, and Collect events will stream here in real time</p>
          </div>
        ) : (
          events.map((evt, i) => (
            <EventRow key={`${evt.tx_hash}-${evt.event_type}-${i}`} event={evt} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <div className="text-[10px] text-white/20 font-mono">
          Your Position: NFT #{lpData.tokenId}
        </div>
        <div className="text-[10px] text-white/20">
          {events.length} event{events.length !== 1 ? 's' : ''} indexed
        </div>
      </div>
    </div>
  );
}
