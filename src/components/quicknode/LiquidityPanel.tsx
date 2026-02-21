'use client';

import { useState, useEffect, useRef } from 'react';
import { Droplets, TrendingUp, TrendingDown, Wallet, ExternalLink } from 'lucide-react';
import type { Chain } from '@/lib/use-stream-feed';
import { CHAIN_CONFIG } from '@/lib/use-stream-feed';
import { useLiquidityStream, type LiquidityEvent, type LPPosition } from '@/lib/use-liquidity-stream';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Props {
  chain: Chain;
}

function truncate(addr: string | null, chars = 6): string {
  if (!addr) return '--';
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

function formatAmount(raw: string): string {
  try {
    const n = Number(raw);
    if (n === 0) return '0';
    if (Math.abs(n) < 0.01) return '<0.01';
    if (Math.abs(n) > 1e12) return (n / 1e18).toFixed(4);
    return n.toLocaleString();
  } catch {
    return raw;
  }
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

function LiqEventRow({ event, chain }: { event: LiquidityEvent; chain: Chain }) {
  const cfg = CHAIN_CONFIG[chain];
  const colorClass = eventColors[event.event_type] || 'bg-white/10 text-white/60';
  const Icon = eventIcons[event.event_type] || Droplets;

  return (
    <div className="grid grid-cols-[90px_1fr_1fr_120px_80px] gap-2 px-4 py-2.5 border-b border-white/[0.03] text-[13px] transition-colors hover:bg-white/[0.04]">
      <span className="inline-flex items-center">
        <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${colorClass}`}>
          <Icon className="h-3 w-3" />
          {event.event_type}
        </span>
      </span>

      <a
        href={`${cfg.explorer}/tx/${event.tx_hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-primary/80 hover:text-primary font-mono truncate"
      >
        {truncate(event.tx_hash, 8)}
        <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
      </a>

      <span className="text-white/50 font-mono truncate" title={event.pool_address}>
        Pool: {truncate(event.pool_address)}
      </span>

      <span className="text-white/40 text-[12px]">
        [{event.tick_lower}, {event.tick_upper}]
      </span>

      <span className="text-white/40 text-right text-[12px]">
        {timeAgo(event.block_timestamp)}
      </span>
    </div>
  );
}

function PositionRow({ pos, chain }: { pos: LPPosition; chain: Chain }) {
  return (
    <div className="grid grid-cols-[1fr_120px_1fr_1fr_80px] gap-2 px-4 py-2.5 border-b border-white/[0.03] text-[13px] transition-colors hover:bg-white/[0.04]">
      <span className="text-white/50 font-mono truncate" title={pos.owner}>
        {truncate(pos.owner)}
      </span>

      <span className="text-white/40 text-[12px]">
        [{pos.tick_lower}, {pos.tick_upper}]
      </span>

      <span className="text-white/60 font-mono tabular-nums">
        {formatAmount(pos.liquidity)}
      </span>

      <span className="text-white/40 text-[12px]">
        a0: {formatAmount(pos.amount0)} / a1: {formatAmount(pos.amount1)}
      </span>

      <span className="text-white/40 text-right text-[12px]">
        #{pos.last_block.toLocaleString()}
      </span>
    </div>
  );
}

export function LiquidityPanel({ chain }: Props) {
  const { events, connected, stats } = useLiquidityStream(chain);
  const [subTab, setSubTab] = useState<'events' | 'positions'>('events');
  const [positions, setPositions] = useState<LPPosition[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [poolFilter, setPoolFilter] = useState('');

  useEffect(() => {
    if (subTab !== 'positions') return;
    if (!poolFilter) return;

    setPosLoading(true);
    fetch(`${API_BASE}/streams/liquidity/positions?chain=${chain}&pool=${poolFilter}`)
      .then((r) => r.json())
      .then(({ positions: pos }) => setPositions(pos ?? []))
      .catch(() => setPositions([]))
      .finally(() => setPosLoading(false));
  }, [subTab, chain, poolFilter]);

  const statCards = [
    { label: 'Mints', value: stats.mints, color: 'text-emerald-400' },
    { label: 'Burns', value: stats.burns, color: 'text-red-400' },
    { label: 'Collects', value: stats.collects, color: 'text-amber-400' },
    { label: 'Total Events', value: stats.total, color: 'text-white' },
  ];

  return (
    <div className="space-y-4">
      {/* Liq stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Droplets className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-xl font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 w-fit">
        <button
          onClick={() => setSubTab('events')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            subTab === 'events'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-white/40 hover:text-white/60 border border-transparent'
          }`}
        >
          Events Feed
        </button>
        <button
          onClick={() => setSubTab('positions')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            subTab === 'positions'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-white/40 hover:text-white/60 border border-transparent'
          }`}
        >
          Positions
        </button>
      </div>

      {subTab === 'events' ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
          <div className="grid grid-cols-[90px_1fr_1fr_120px_80px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-[11px] font-medium text-white/30 uppercase tracking-wider">
            <span>Event</span>
            <span>Tx Hash</span>
            <span>Pool</span>
            <span>Tick Range</span>
            <span className="text-right">Age</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-12 text-center">
                <Droplets className="mx-auto h-8 w-8 text-white/20 mb-3" />
                <p className="text-sm text-white/50">Waiting for liquidity events...</p>
                <p className="text-xs text-white/30 mt-1">Mint, Burn, and Collect events will appear here</p>
              </div>
            ) : (
              events.map((evt, i) => <LiqEventRow key={`${evt.tx_hash}-${evt.event_type}-${i}`} event={evt} chain={chain} />)
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Enter pool address (0x...)"
              value={poolFilter}
              onChange={(e) => setPoolFilter(e.target.value)}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_1fr_1fr_80px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-[11px] font-medium text-white/30 uppercase tracking-wider">
              <span>Owner</span>
              <span>Tick Range</span>
              <span>Liquidity</span>
              <span>Amounts</span>
              <span className="text-right">Last Block</span>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {!poolFilter ? (
                <div className="p-12 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-white/20 mb-3" />
                  <p className="text-sm text-white/50">Enter a pool address to view positions</p>
                </div>
              ) : posLoading ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-white/50">Loading positions...</p>
                </div>
              ) : positions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-white/50">No active positions found</p>
                </div>
              ) : (
                positions.map((pos, i) => <PositionRow key={`${pos.owner}-${pos.tick_lower}-${pos.tick_upper}`} pos={pos} chain={chain} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
