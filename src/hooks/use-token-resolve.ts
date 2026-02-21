'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface TokenInfo {
  name: string;
  symbol: string;
  image?: string;
}

export function useTokenResolve(address: string, enabled: boolean) {
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const lastAddr = useRef('');

  useEffect(() => {
    if (!enabled || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setInfo(null);
      lastAddr.current = '';
      return;
    }
    if (address.toLowerCase() === lastAddr.current) return;
    lastAddr.current = address.toLowerCase();
    setResolving(true);
    const controller = new AbortController();
    fetch(`${API_BASE}/monad/token-info/${address}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setInfo({ name: data.name, symbol: data.symbol, image: data.image }); })
      .catch(() => {})
      .finally(() => setResolving(false));
    return () => controller.abort();
  }, [address, enabled]);

  return { info, resolving };
}
