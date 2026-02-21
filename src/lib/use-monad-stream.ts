'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
const MAX_TRANSACTIONS = 200;

export interface MonadTx {
  tx_hash: string;
  block_number: number;
  block_hash: string;
  tx_index: number;
  from_address: string;
  to_address: string | null;
  value: string;
  gas_limit: string;
  gas_price: string;
  method_id: string;
  tx_type: string;
  block_timestamp: string;
}

export interface StreamStats {
  totalTx: number;
  txPerMin: number;
  latestBlock: number;
  uniqueAddresses: number;
}

export const METHOD_NAMES: Record<string, string> = {
  '0x3593564c': 'execute',
  '0x414bf389': 'exactInputSingle',
  '0xc04b8d59': 'exactInput',
  '0x5ae401dc': 'multicall',
  '0xac9650d8': 'multicall',
  '0x04e45aaf': 'exactInputSingle',
  '0xdb3e2198': 'exactOutputSingle',
  '0xf28c0498': 'exactOutput',
  '0xb858183f': 'exactInput',
};

export function useMonadStream() {
  const [transactions, setTransactions] = useState<MonadTx[]>([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<StreamStats>({
    totalTx: 0,
    txPerMin: 0,
    latestBlock: 0,
    uniqueAddresses: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const recentTimestamps = useRef<number[]>([]);
  const addressSet = useRef(new Set<string>());
  const totalRef = useRef(0);

  const addTransaction = useCallback((tx: MonadTx) => {
    totalRef.current++;
    addressSet.current.add(tx.from_address);
    if (tx.to_address) addressSet.current.add(tx.to_address);

    const now = Date.now();
    recentTimestamps.current.push(now);
    const oneMinAgo = now - 60_000;
    recentTimestamps.current = recentTimestamps.current.filter((t) => t > oneMinAgo);

    setTransactions((prev) => {
      const next = [tx, ...prev];
      return next.length > MAX_TRANSACTIONS ? next.slice(0, MAX_TRANSACTIONS) : next;
    });

    setStats({
      totalTx: totalRef.current,
      txPerMin: recentTimestamps.current.length,
      latestBlock: tx.block_number,
      uniqueAddresses: addressSet.current.size,
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
          if (data.type === 'monad_tx') {
            const { type, ...tx } = data;
            addTransaction(tx as MonadTx);
          }
        } catch { /* ignore malformed */ }
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
  }, [addTransaction]);

  useEffect(() => {
    // Fetch initial transactions
    fetch(`${API_BASE}/quicknode/transactions?limit=50`)
      .then((r) => r.json())
      .then(({ transactions: txs }) => {
        if (Array.isArray(txs) && txs.length > 0) {
          totalRef.current = txs.length;
          for (const tx of txs) {
            addressSet.current.add(tx.from_address);
            if (tx.to_address) addressSet.current.add(tx.to_address);
          }
          setTransactions(txs);
          setStats({
            totalTx: txs.length,
            txPerMin: 0,
            latestBlock: txs[0]?.block_number ?? 0,
            uniqueAddresses: addressSet.current.size,
          });
        }
      })
      .catch(() => {});

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const startSimulation = useCallback(() => {
    return fetch(`${API_BASE}/quicknode/simulate`).then((r) => r.json());
  }, []);

  const stopSimulation = useCallback(() => {
    return fetch(`${API_BASE}/quicknode/simulate`, { method: 'DELETE' }).then((r) => r.json());
  }, []);

  return { transactions, connected, stats, startSimulation, stopSimulation };
}
