import { Router } from 'express';
import { monadTracker, type MonadSwapRecord } from '../lib/monad-tracker.js';
import { resolveToken } from '../lib/nadfun-api.js';
import { getMonUsdPrice } from '../lib/mon-price.js';
import { log, logError } from '../lib/log.js';

const router = Router();

const SECS_PER_BLOCK = 1;

type Metric = 'Price' | 'Volume' | 'Swap Count' | 'Fees';
type TimeRange = '1H' | '24H' | '7D' | '30D';

interface RangeConfig {
  buckets: number;
  blocksBack: number;
  blocksPerBucket: number;
}

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  '1H':  { buckets: 60,  blocksBack: 3_600,      blocksPerBucket: 60 },
  '24H': { buckets: 96,  blocksBack: 86_400,     blocksPerBucket: 900 },
  '7D':  { buckets: 84,  blocksBack: 604_800,    blocksPerBucket: 7_200 },
  '30D': { buckets: 60,  blocksBack: 2_592_000,  blocksPerBucket: 43_200 },
};

function formatTimeLabel(msAgo: number): string {
  const mins = Math.round(msAgo / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h ago`;
  const days = hrs / 24;
  return `${days.toFixed(1)}d ago`;
}

function bucketSwaps(swaps: MonadSwapRecord[], config: RangeConfig) {
  const now = Date.now();
  const totalMs = config.blocksBack * SECS_PER_BLOCK * 1000;
  const startMs = now - totalMs;
  const msPerBucket = totalMs / config.buckets;

  interface Bucket {
    label: string;
    closingPrice: number | null;
    volumeMON: number;
    swapCount: number;
    hasData: boolean;
  }

  const buckets: Bucket[] = [];
  for (let i = 0; i < config.buckets; i++) {
    const bucketFraction = (i + 1) / config.buckets;
    const msAgo = totalMs * (1 - bucketFraction);
    buckets.push({
      label: formatTimeLabel(msAgo),
      closingPrice: null,
      volumeMON: 0,
      swapCount: 0,
      hasData: false,
    });
  }

  for (const swap of swaps) {
    if (swap.timestamp < startMs) continue;
    const idx = Math.min(
      config.buckets - 1,
      Math.max(0, Math.floor((swap.timestamp - startMs) / msPerBucket)),
    );
    buckets[idx].closingPrice = swap.price;
    buckets[idx].volumeMON += swap.volumeMON;
    buckets[idx].swapCount += 1;
    buckets[idx].hasData = true;
  }

  const firstDataIdx = buckets.findIndex(b => b.hasData);
  const trimmed = firstDataIdx > 0 ? buckets.slice(firstDataIdx) : buckets;

  const firstKnownPrice = trimmed.find(b => b.closingPrice !== null)?.closingPrice ?? 0;
  let carryPrice = firstKnownPrice;
  for (const b of trimmed) {
    if (b.closingPrice !== null) carryPrice = b.closingPrice;
    else b.closingPrice = carryPrice;
  }

  return trimmed;
}

router.post('/chart-data', async (req, res) => {
  const { token, metric, range } = req.body as { token: string; metric: Metric; range: TimeRange };

  if (!token || !metric || !range) {
    res.status(400).json({ error: 'Missing token, metric, or range' });
    return;
  }

  const config = RANGE_CONFIG[range];
  if (!config) {
    res.status(400).json({ error: `Invalid range "${range}"` });
    return;
  }

  try {
    const t0 = Date.now();
    const addr = token.toLowerCase();

    if (!monadTracker.isTracked(addr)) {
      const ok = await monadTracker.track(addr);
      if (!ok) {
        res.status(400).json({ error: `Could not track token "${token}"` });
        return;
      }
    }

    let backfilling = false;
    if (!monadTracker.hasBackfill(addr, config.blocksBack)) {
      log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — triggering background backfill`);
      monadTracker.backfill(addr, config.blocksBack).catch(err =>
        logError('monad-chart', `Background backfill failed: ${err instanceof Error ? err.message : 'unknown'}`),
      );
      backfilling = true;
    }

    const sinceMs = Date.now() - config.blocksBack * SECS_PER_BLOCK * 1000;
    const swaps = monadTracker.getSwaps(addr, sinceMs);
    log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — ${swaps.length} swaps`);

    if (swaps.length === 0) {
      log('monad-chart', `${addr.slice(0, 10)} — no swaps yet (backfilling: ${backfilling})`);
      res.json({ data: [], backfilling });
      return;
    }

    const buckets = bucketSwaps(swaps, config);

    const monUsd = await getMonUsdPrice();
    const rate = monUsd ?? 0;
    if (rate === 0) {
      log('monad-chart', `WARNING: MON/USD price unavailable — chart values will be 0 for USD metrics`);
    }

    const dataPoints = buckets.map(b => {
      let value: number;
      switch (metric) {
        case 'Price':
          value = (b.closingPrice ?? 0) * rate;
          break;
        case 'Volume':
          value = b.volumeMON * rate;
          break;
        case 'Fees':
          value = b.volumeMON * 0.01 * rate;
          break;
        case 'Swap Count':
          value = b.swapCount;
          break;
        default:
          value = 0;
      }
      return {
        time: b.label,
        value: Math.round(value * 1e6) / 1e6,
        price: Math.round((b.closingPrice ?? 0) * rate * 1e6) / 1e6,
        block: 0,
      };
    });

    log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — served in ${Date.now() - t0}ms`);
    res.json({ data: dataPoints, backfilling });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('monad-chart', message);
    res.status(500).json({ error: message });
  }
});

router.get('/token-info/:address', async (req, res) => {
  const { address } = req.params;
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  try {
    const cached = monadTracker.getTokenMeta(address);
    if (cached) {
      res.json({ name: cached.name, symbol: cached.symbol, image: cached.image_url, graduated: cached.graduated });
      return;
    }

    const meta = await resolveToken(address);
    if (!meta) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    res.json({ name: meta.name, symbol: meta.symbol, image: meta.image_url, graduated: meta.graduated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('monad-token', message);
    res.status(500).json({ error: message });
  }
});

export default router;
