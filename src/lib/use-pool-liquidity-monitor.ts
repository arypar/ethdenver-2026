'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LiquidityEvent, TVLData } from './use-liquidity-stream';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
const MAX_EVENTS = 100;

interface PoolLiquidityStats {
  mints: number;
  burns: number;
  collects: number;
}

export function usePoolLiquidityMonitor(poolAddress: string, chain: string = 'eth') {
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [tvl, setTvl] = useState<TVLData>({ amount0: '0', amount1: '0' });
  const [stats, setStats] = useState<PoolLiquidityStats>({ mints: 0, burns: 0, collects: 0 });
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const poolRef = useRef(poolAddress);

  useEffect(() => { poolRef.current = poolAddress; }, [poolAddress]);

  useEffect(() => {
    if (!poolAddress) return;
    setLoading(true);

    const fetchInitial = async () => {
      try {
        const [evtsRes, tvlRes] = await Promise.all([
          fetch(`${API_BASE}/streams/liquidity/events?chain=${chain}&pool=${poolAddress}&limit=50`),
          fetch(`${API_BASE}/streams/liquidity/tvl?chain=${chain}&pool=${poolAddress}`),
        ]);

        const evtsData = await evtsRes.json();
        const tvlData = await tvlRes.json();

        if (Array.isArray(evtsData.events)) {
          setEvents(evtsData.events);
          const s = { mints: 0, burns: 0, collects: 0 };
          for (const e of evtsData.events) {
            if (e.event_type === 'mint') s.mints++;
            else if (e.event_type === 'burn') s.burns++;
            else s.collects++;
          }
          setStats(s);
        }

        if (tvlData.tvl) setTvl(tvlData.tvl);
      } catch {
        // initial fetch failed
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [poolAddress, chain]);

  const addEvent = useCallback((evt: LiquidityEvent) => {
    setEvents(prev => {
      const next = [evt, ...prev];
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
    });
    setStats(prev => ({
      mints: prev.mints + (evt.event_type === 'mint' ? 1 : 0),
      burns: prev.burns + (evt.event_type === 'burn' ? 1 : 0),
      collects: prev.collects + (evt.event_type === 'collect' ? 1 : 0),
    }));
    if (evt.event_type === 'mint' || evt.event_type === 'burn') {
      setTvl(prev => {
        const a0 = BigInt(prev.amount0 || '0');
        const a1 = BigInt(prev.amount1 || '0');
        const da0 = BigInt(evt.amount0 || '0');
        const da1 = BigInt(evt.amount1 || '0');
        if (evt.event_type === 'mint') {
          return { amount0: (a0 + da0).toString(), amount1: (a1 + da1).toString() };
        }
        return { amount0: (a0 - da0).toString(), amount1: (a1 - da1).toString() };
      });
    }
  }, []);

  const connect = useCallback(() => {
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
            data.chain === chain &&
            data.pool_address?.toLowerCase() === poolRef.current.toLowerCase()
          ) {
            const { type: _, ...evt } = data;
            addEvent(evt as LiquidityEvent);
          }
        } catch { /* ignore */ }
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
  }, [chain, addEvent]);

  useEffect(() => {
    if (!poolAddress) return;
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [poolAddress, connect]);

  return { events, tvl, stats, loading, wsConnected };
}
