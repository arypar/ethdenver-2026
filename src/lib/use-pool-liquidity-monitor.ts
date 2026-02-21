'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TOKENS } from '@/lib/tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
const POLL_INTERVAL_MS = 10_000;
const MAX_EVENTS = 200;

export interface LiquidityEvent {
  event_type: 'mint' | 'burn' | 'collect';
  pool_address: string;
  owner: string;
  tick_lower: number;
  tick_upper: number;
  amount: string;
  amount0: string;
  amount1: string;
  block_number: number;
  tx_hash: string;
  block_timestamp: string;
}

interface PoolLiquidityStats {
  mints: number;
  burns: number;
  collects: number;
}

interface TVLData {
  amount0: string;
  amount1: string;
}

export interface TvlUsd {
  usd0: number;
  usd1: number;
  total: number;
}

function computeStats(events: LiquidityEvent[]): PoolLiquidityStats {
  const s = { mints: 0, burns: 0, collects: 0 };
  for (const e of events) {
    if (e.event_type === 'mint') s.mints++;
    else if (e.event_type === 'burn') s.burns++;
    else s.collects++;
  }
  return s;
}

// On-chain token0 always has the numerically lower address.
// If the pool name lists the higher-address token first (e.g. "WETH/USDC"
// where WETH address > USDC address), the on-chain amount0/amount1 are in
// reverse order relative to the display. Detect this and swap.
function shouldInvert(poolName?: string): boolean {
  if (!poolName) return false;
  const parts = poolName.split('/');
  if (parts.length !== 2) return false;
  const addr0 = TOKENS[parts[0]]?.address;
  const addr1 = TOKENS[parts[1]]?.address;
  if (!addr0 || !addr1) return false;
  return addr0.toLowerCase() > addr1.toLowerCase();
}

function swapEventAmounts(evt: LiquidityEvent): LiquidityEvent {
  return { ...evt, amount0: evt.amount1, amount1: evt.amount0 };
}

export function usePoolLiquidityMonitor(poolAddress: string, _chain: string = 'eth', poolName?: string) {
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [tvl, setTvl] = useState<TVLData>({ amount0: '0', amount1: '0' });
  const [tvlUsd, setTvlUsd] = useState<TvlUsd>({ usd0: 0, usd1: 0, total: 0 });
  const [stats, setStats] = useState<PoolLiquidityStats>({ mints: 0, burns: 0, collects: 0 });
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const poolRef = useRef(poolAddress);
  const poolNameRef = useRef(poolName);
  const invertRef = useRef(shouldInvert(poolName));
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { poolRef.current = poolAddress; }, [poolAddress]);
  useEffect(() => {
    poolNameRef.current = poolName;
    invertRef.current = shouldInvert(poolName);
  }, [poolName]);

  const fetchEvents = useCallback(async () => {
    if (!poolRef.current) return;
    const pool = poolRef.current.toLowerCase();
    try {
      const res = await fetch(
        `${API_BASE}/streams/liquidity/events?chain=eth&pool=${pool}&limit=${MAX_EVENTS}`,
      );
      if (!res.ok) return;
      const { events: evts } = await res.json();
      if (Array.isArray(evts)) {
        const processed = invertRef.current ? evts.map(swapEventAmounts) : evts;
        setEvents(processed);
        setStats(computeStats(processed));
      }
    } catch { /* backend unreachable */ }
  }, []);

  const fetchTvl = useCallback(async () => {
    if (!poolRef.current) return;
    const pool = poolRef.current.toLowerCase();
    const name = poolNameRef.current;
    try {
      let url = `${API_BASE}/streams/liquidity/tvl?chain=eth&pool=${pool}`;
      if (name) url += `&poolName=${encodeURIComponent(name)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.tvl) {
        const t = data.tvl;
        setTvl(invertRef.current ? { amount0: t.amount1, amount1: t.amount0 } : t);
      }
      if (data.tvlUsd) {
        const u = data.tvlUsd;
        setTvlUsd(invertRef.current
          ? { usd0: u.usd1, usd1: u.usd0, total: u.total }
          : { usd0: u.usd0, usd1: u.usd1, total: u.total });
      }
    } catch { /* backend unreachable */ }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!poolAddress) return;
    setLoading(true);
    setEvents([]);
    setStats({ mints: 0, burns: 0, collects: 0 });
    setTvl({ amount0: '0', amount1: '0' });
    setTvlUsd({ usd0: 0, usd1: 0, total: 0 });

    Promise.all([fetchEvents(), fetchTvl()]).finally(() => setLoading(false));
  }, [poolAddress, fetchEvents, fetchTvl]);

  // Periodic refresh from backend (fallback if WS misses events)
  useEffect(() => {
    if (!poolAddress) return;
    pollTimer.current = setInterval(() => {
      fetchEvents();
      fetchTvl();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [poolAddress, fetchEvents, fetchTvl]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!poolAddress) return;

    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttempt.current = 0;
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (
              data.type === 'liquidity_event' &&
              data.pool_address?.toLowerCase() === poolRef.current.toLowerCase()
            ) {
              const { type: _, ...evt } = data;
              const liqEvt = invertRef.current
                ? swapEventAmounts(evt as LiquidityEvent)
                : evt as LiquidityEvent;

              setEvents(prev => {
                const next = [liqEvt, ...prev];
                return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
              });
              setStats(prev => {
                const s = { ...prev };
                if (liqEvt.event_type === 'mint') s.mints++;
                else if (liqEvt.event_type === 'burn') s.burns++;
                else s.collects++;
                return s;
              });
              if (liqEvt.event_type === 'mint' || liqEvt.event_type === 'burn') {
                setTvl(prev => {
                  let t0 = BigInt(prev.amount0 || '0');
                  let t1 = BigInt(prev.amount1 || '0');
                  if (liqEvt.event_type === 'mint') {
                    t0 += BigInt(liqEvt.amount0 || '0');
                    t1 += BigInt(liqEvt.amount1 || '0');
                  } else {
                    t0 -= BigInt(liqEvt.amount0 || '0');
                    t1 -= BigInt(liqEvt.amount1 || '0');
                  }
                  return { amount0: t0.toString(), amount1: t1.toString() };
                });
              }
            }
          } catch { /* ignore malformed */ }
        };

        ws.onclose = () => {
          setWsConnected(false);
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
          reconnectAttempt.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        };

        ws.onerror = () => ws.close();
      } catch {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [poolAddress]);

  return { events, tvl, tvlUsd, stats, loading, wsConnected };
}
