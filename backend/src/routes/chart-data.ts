import { Router } from 'express';
import { tracker, dbQuerySwaps, type SwapRecord } from '../lib/pool-tracker.js';
import { DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';

const router = Router();

const SECS_PER_BLOCK = 12;

type Metric = 'Price' | 'Volume' | 'Fees' | 'Swap Count';
type TimeRange = '1H' | '24H' | '7D' | '30D';

interface RangeConfig {
  buckets: number;
  blocksBack: number;
  blocksPerBucket: number;
}

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  '1H':  { buckets: 60,  blocksBack: 300,    blocksPerBucket: 5 },
  '24H': { buckets: 96,  blocksBack: 7200,   blocksPerBucket: 75 },
  '7D':  { buckets: 84,  blocksBack: 50400,  blocksPerBucket: 600 },
  '30D': { buckets: 60,  blocksBack: 216000, blocksPerBucket: 3600 },
};

function formatTimeLabel(msAgo: number): string {
  const mins = Math.round(msAgo / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h ago`;
  const days = hrs / 24;
  return `${days.toFixed(1)}d ago`;
}

function bucketSwapsByBlock(
  swaps: SwapRecord[],
  config: RangeConfig,
  latestBlock: number,
  feeFraction: number,
) {
  const startBlock = latestBlock - config.blocksBack;
  const now = Date.now();
  const totalMs = config.blocksBack * SECS_PER_BLOCK * 1000;

  interface Bucket {
    blockEnd: number;
    label: string;
    closingPrice: number | null;
    volumeUSD: number;
    swapCount: number;
    hasData: boolean;
  }

  const buckets: Bucket[] = [];
  for (let i = 0; i < config.buckets; i++) {
    const blockEnd = startBlock + (i + 1) * config.blocksPerBucket;
    const bucketFraction = (i + 1) / config.buckets;
    const msAgo = totalMs * (1 - bucketFraction);
    buckets.push({
      blockEnd,
      label: formatTimeLabel(msAgo),
      closingPrice: null,
      volumeUSD: 0,
      swapCount: 0,
      hasData: false,
    });
  }

  for (const swap of swaps) {
    if (swap.blockNumber < startBlock) continue;
    const idx = Math.min(
      config.buckets - 1,
      Math.max(0, Math.floor((swap.blockNumber - startBlock) / config.blocksPerBucket)),
    );
    buckets[idx].closingPrice = swap.price;
    buckets[idx].volumeUSD += swap.volumeUSD;
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

  return { buckets: trimmed, feeFraction };
}

router.post('/chart-data', async (req, res) => {
  const { pool, metric, range } = req.body as { pool: string; metric: Metric; range: TimeRange };

  if (!pool || !metric || !range) {
    res.status(400).json({ error: 'Missing pool, metric, or range' });
    return;
  }

  const config = RANGE_CONFIG[range];
  if (!config) {
    res.status(400).json({ error: `Invalid range "${range}"` });
    return;
  }

  try {
    const t0 = Date.now();

    if (!tracker.isTracked(pool)) {
      const ok = await tracker.track(pool);
      if (!ok) {
        res.status(400).json({ error: `Could not resolve pool "${pool}"` });
        return;
      }
    }

    const meta = tracker.getPoolMeta(pool);
    const feeFraction = meta ? meta.feeTier / 1_000_000 : 0.003;
    const sinceMs = Date.now() - config.blocksBack * SECS_PER_BLOCK * 1000;

    let swaps: SwapRecord[];
    let backfilling = false;

    if (DB_ENABLED) {
      swaps = await dbQuerySwaps(pool, sinceMs);
      log('chart-data', `${pool} ${metric} ${range} — ${swaps.length} swaps from DB`);

      if (swaps.length === 0 && !tracker.hasBackfill(pool, config.blocksBack)) {
        log('chart-data', `${pool} ${metric} ${range} — DB empty, triggering background backfill`);
        tracker.backfill(pool, config.blocksBack).catch(err =>
          logError('chart-data', `Background backfill failed: ${err instanceof Error ? err.message : 'unknown'}`),
        );
        backfilling = true;
      }
    } else {
      if (!tracker.hasBackfill(pool, config.blocksBack)) {
        log('chart-data', `${pool} ${metric} ${range} — triggering background backfill`);
        tracker.backfill(pool, config.blocksBack).catch(err =>
          logError('chart-data', `Background backfill failed: ${err instanceof Error ? err.message : 'unknown'}`),
        );
        backfilling = true;
      }
      swaps = tracker.getSwaps(pool, sinceMs);
      log('chart-data', `${pool} ${metric} ${range} — ${swaps.length} swaps from memory`);
    }

    if (swaps.length === 0) {
      log('chart-data', `${pool} ${metric} ${range} — no swaps yet, returning empty (backfilling: ${backfilling})`);
      res.json({ data: [], backfilling });
      return;
    }

    const latestBlock = Math.max(...swaps.map(s => s.blockNumber));
    const { buckets } = bucketSwapsByBlock(swaps, config, latestBlock, feeFraction);

    const dataPoints = buckets.map(b => {
      let value: number;
      switch (metric) {
        case 'Price':
          value = b.closingPrice ?? 0;
          break;
        case 'Volume':
          value = b.volumeUSD;
          break;
        case 'Fees':
          value = b.volumeUSD * feeFraction;
          break;
        case 'Swap Count':
          value = b.swapCount;
          break;
        default:
          value = 0;
      }
      return {
        time: b.label,
        value: Math.round(value * 100) / 100,
        price: Math.round((b.closingPrice ?? 0) * 100) / 100,
        block: b.blockEnd,
      };
    });

    log('chart-data', `${pool} ${metric} ${range} — served in ${Date.now() - t0}ms`);
    res.json({ data: dataPoints, backfilling });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('chart-data', message);
    res.status(500).json({ error: message });
  }
});

export default router;
