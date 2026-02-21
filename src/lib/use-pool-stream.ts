'use client';

import { useEffect, useRef, useState } from 'react';
import type { Pool, Metric } from './types';
import { wsClient } from './ws-client';

export interface SwapEvent {
  type: 'swap';
  pool: Pool;
  price: number;
  volumeUSD: number;
  feeUSD: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface StreamState {
  connected: boolean;
  latestSwap: SwapEvent | null;
  swapCount: number;
  currentPrice: number;
}

export function usePoolStream(
  pool: Pool | null,
  onSwap?: (event: SwapEvent) => void,
): StreamState {
  const [state, setState] = useState<StreamState>({
    connected: false,
    latestSwap: null,
    swapCount: 0,
    currentPrice: 0,
  });

  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  const countRef = useRef(0);

  useEffect(() => {
    const unsub = wsClient.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, connected }));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!pool) return;

    countRef.current = 0;

    const unsubscribe = wsClient.subscribe(pool, (data) => {
      const swap = data as SwapEvent;
      countRef.current++;
      setState({
        connected: true,
        latestSwap: swap,
        swapCount: countRef.current,
        currentPrice: swap.price,
      });
      onSwapRef.current?.(swap);
    });

    return () => {
      unsubscribe();
      setState({
        connected: false,
        latestSwap: null,
        swapCount: 0,
        currentPrice: 0,
      });
    };
  }, [pool]);

  return state;
}

export function metricFromSwap(swap: SwapEvent, metric: Metric): number {
  switch (metric) {
    case 'Price':
      return swap.price;
    case 'Volume':
      return swap.volumeUSD;
    case 'Fees':
      return swap.feeUSD;
    case 'Swap Count':
      return 1;
    default:
      return swap.price;
  }
}
