'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Chain } from './use-stream-feed';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
const MAX_EVENTS = 200;

export interface LiquidityEvent {
  chain: string;
  pool_address: string;
  event_type: 'mint' | 'burn' | 'collect';
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

export interface LPPosition {
  owner: string;
  tick_lower: number;
  tick_upper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  last_block: number;
}

export interface TVLData {
  amount0: string;
  amount1: string;
}

export function useLiquidityStream(chain: Chain) {
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [positions, setPositions] = useState<LPPosition[]>([]);
  const [tvl, setTvl] = useState<TVLData>({ amount0: '0', amount1: '0' });
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const chainRef = useRef(chain);

  const liqCountRef = useRef({ mints: 0, burns: 0, collects: 0 });

  useEffect(() => {
    chainRef.current = chain;
    setEvents([]);
    liqCountRef.current = { mints: 0, burns: 0, collects: 0 };

    fetch(`${API_BASE}/streams/liquidity/events?chain=${chain}&limit=50`)
      .then((r) => r.json())
      .then(({ events: evts }) => {
        if (Array.isArray(evts) && evts.length > 0) {
          setEvents(evts);
          const counts = { mints: 0, burns: 0, collects: 0 };
          for (const e of evts) {
            if (e.event_type === 'mint') counts.mints++;
            else if (e.event_type === 'burn') counts.burns++;
            else counts.collects++;
          }
          liqCountRef.current = counts;
        }
      })
      .catch(() => {});
  }, [chain]);

  const addEvent = useCallback((evt: LiquidityEvent) => {
    if (evt.event_type === 'mint') liqCountRef.current.mints++;
    else if (evt.event_type === 'burn') liqCountRef.current.burns++;
    else liqCountRef.current.collects++;

    setEvents((prev) => {
      const next = [evt, ...prev];
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
    });
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
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'liquidity_event' && data.chain === chainRef.current) {
            const { type: _, ...evt } = data;
            addEvent(evt as LiquidityEvent);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
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
  }, [addEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [connect]);

  const stats = {
    mints: liqCountRef.current.mints,
    burns: liqCountRef.current.burns,
    collects: liqCountRef.current.collects,
    total: events.length,
  };

  return { events, positions, tvl, connected, stats };
}
