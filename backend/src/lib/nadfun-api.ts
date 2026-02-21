import { logWarn, logError } from './log.js';

const BASE_URL = 'https://api.nadapp.net';
const API_KEY = process.env.NADFUN_API_KEY || '';

let rateLimitedUntil = 0;
let rateLimitLogged = false;

async function apiFetch<T>(path: string): Promise<T | null> {
  if (Date.now() < rateLimitedUntil) {
    return null;
  }
  if (rateLimitLogged) rateLimitLogged = false;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 60_000;
      if (!rateLimitLogged) {
        rateLimitLogged = true;
        logWarn('nadfun', `Rate limited — backing off 60s`);
      }
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
    native_price: string;
    transaction_hash: string;
    created_at: number;
  };
}

export async function resolveToken(address: string): Promise<NadToken | null> {
  const result = await apiFetch<{ token_info: { name: string; symbol: string; image_uri: string; is_graduated: boolean; creator: { account_id: string } } }>(`/agent/token/${address}`);
  if (!result?.token_info) return null;
  const t = result.token_info;
  return { name: t.name, symbol: t.symbol, image_url: t.image_uri, graduated: t.is_graduated, creator: t.creator?.account_id ?? '' };
}

export async function getMarketData(address: string): Promise<NadMarketData | null> {
  return apiFetch<NadMarketData>(`/agent/market/${address}`);
}

export async function getMetrics(address: string, timeframes = '1,5,60,1D'): Promise<{ metrics: NadMetric[] } | null> {
  return apiFetch<{ metrics: NadMetric[] }>(`/agent/metrics/${address}?timeframes=${timeframes}`);
}

export async function getSwapHistory(address: string, limit = 50, page = 1): Promise<{ swaps: NadSwap[]; total_count: number } | null> {
  return apiFetch<{ swaps: NadSwap[]; total_count: number }>(`/agent/swap-history/${address}?limit=${limit}&page=${page}`);
}

export async function getSwapHistorySince(address: string, sinceTimestamp: number): Promise<NadSwap[]> {
  const allSwaps: NadSwap[] = [];
  const pageSize = 100;
  let page = 1;
  const maxPages = 50;

  while (page <= maxPages) {
    const result = await getSwapHistory(address, pageSize, page);
    if (!result || result.swaps.length === 0) break;

    let reachedEnd = false;
    for (const swap of result.swaps) {
      if (swap.swap_info.created_at < sinceTimestamp) {
        reachedEnd = true;
        break;
      }
      allSwaps.push(swap);
    }

    if (reachedEnd || result.swaps.length < pageSize) break;
    page++;
  }

  return allSwaps;
}
