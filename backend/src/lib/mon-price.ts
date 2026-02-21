import { log, logError } from './log.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd';
const DEFILLAMA_URL =
  'https://coins.llama.fi/prices/current/coingecko:monad';

let cachedPrice: number | null = null;
let cacheUpdatedAt = 0;
let fetching = false;

async function fetchFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { monad?: { usd?: number } };
    return data?.monad?.usd ?? null;
  } catch {
    return null;
  }
}

async function fetchFromDefiLlama(): Promise<number | null> {
  try {
    const res = await fetch(DEFILLAMA_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      coins?: { 'coingecko:monad'?: { price?: number } };
    };
    return data?.coins?.['coingecko:monad']?.price ?? null;
  } catch {
    return null;
  }
}

async function refreshPrice(): Promise<void> {
  if (fetching) return;
  fetching = true;
  try {
    let price = await fetchFromCoinGecko();
    if (price == null) {
      price = await fetchFromDefiLlama();
    }
    if (price != null && price > 0) {
      cachedPrice = price;
      cacheUpdatedAt = Date.now();
      log('mon-price', `MON/USD = $${price.toFixed(4)}`);
    }
  } catch (err) {
    logError(
      'mon-price',
      `Refresh failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  } finally {
    fetching = false;
  }
}

/**
 * Returns the cached MON/USD price, refreshing in the background
 * if the cache is stale. Returns null only if no price has ever
 * been fetched successfully.
 */
export async function getMonUsdPrice(): Promise<number | null> {
  if (cachedPrice != null && Date.now() - cacheUpdatedAt < CACHE_TTL_MS) {
    return cachedPrice;
  }
  await refreshPrice();
  return cachedPrice;
}

export function getMonUsdPriceSync(): number | null {
  if (cachedPrice != null && Date.now() - cacheUpdatedAt < CACHE_TTL_MS) {
    return cachedPrice;
  }
  refreshPrice().catch(() => {});
  return cachedPrice;
}
