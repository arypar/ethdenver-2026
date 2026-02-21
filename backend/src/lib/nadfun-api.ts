import { log, logError } from './log.js';

const BASE_URL = 'https://api.nadapp.net';
const API_KEY = process.env.NADFUN_API_KEY || '';

let rateLimitedUntil = 0;

async function apiFetch<T>(path: string): Promise<T | null> {
  if (Date.now() < rateLimitedUntil) {
    log('nadfun', `Rate limited — skipping ${path}`);
    return null;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 60_000;
      logError('nadfun', `Rate limited on ${path} — backing off 60s`);
      return null;
    }

    if (!res.ok) {
      logError('nadfun', `${res.status} on ${path}`);
      return null;
    }

    return await res.json() as T;
  } catch (err) {
    logError('nadfun', `Fetch ${path}: ${err instanceof Error ? err.message : 'unknown'}`);
    return null;
  }
}

export interface NadToken {
  name: string;
  symbol: string;
  image_url: string;
  graduated: boolean;
  creator: string;
}

export interface NadMarketData {
  market_info: {
    price_usd: number;
    holder_count: number;
    volume: number;
    ath: number;
    market_cap: number;
  };
}

export interface NadMetric {
  timeframe: string;
  percent: number;
  transactions: number;
  volume: number;
  makers: number;
}

export interface NadSwap {
  swap_info: {
    event_type: string;
    native_amount: string;
    token_amount: string;
    transaction_hash: string;
  };
}

export async function resolveToken(address: string): Promise<NadToken | null> {
  return apiFetch<NadToken>(`/agent/token/${address}`);
}

export async function getMarketData(address: string): Promise<NadMarketData | null> {
  return apiFetch<NadMarketData>(`/agent/market/${address}`);
}

export async function getMetrics(address: string, timeframes = '1,5,60,1D'): Promise<{ metrics: NadMetric[] } | null> {
  return apiFetch<{ metrics: NadMetric[] }>(`/agent/metrics/${address}?timeframes=${timeframes}`);
}

export async function getSwapHistory(address: string, limit = 50): Promise<{ swaps: NadSwap[]; total_count: number } | null> {
  return apiFetch<{ swaps: NadSwap[]; total_count: number }>(`/agent/swap-history/${address}?limit=${limit}`);
}
