import { Router } from 'express';
import { monadTracker, dbQueryMonadSwaps, type MonadSwapRecord } from '../lib/monad-tracker.js';
import { DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';

const router = Router();

const SECS_PER_BLOCK = 0.5;

type Metric = 'Price' | 'Volume' | 'Swap Count' | 'Fees';
type TimeRange = '1H' | '24H' | '7D' | '30D';

interface RangeConfig {
  buckets: number;
  blocksBack: number;
  blocksPerBucket: number;
}

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  '1H':  { buckets: 60,  blocksBack: 7_200,      blocksPerBucket: 120 },
  '24H': { buckets: 96,  blocksBack: 172_800,     blocksPerBucket: 1_800 },
  '7D':  { buckets: 84,  blocksBack: 1_209_600,   blocksPerBucket: 14_400 },
  '30D': { buckets: 60,  blocksBack: 5_184_000,   blocksPerBucket: 86_400 },
};

function formatTimeLabel(msAgo: number): string {
  const mins = Math.round(msAgo / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h ago`;
  const days = hrs / 24;
  return `${days.toFixed(1)}d ago`;
}

function bucketSwaps(swaps: MonadSwapRecord[], config: RangeConfig, latestBlock: number) {
  const startBlock = latestBlock - config.blocksBack;
  const now = Date.now();
  const totalMs = config.blocksBack * SECS_PER_BLOCK * 1000;

  interface Bucket {
    blockEnd: number;
    label: string;
    closingPrice: number | null;
    volumeMON: number;
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
      volumeMON: 0,
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

    const sinceMs = Date.now() - config.blocksBack * SECS_PER_BLOCK * 1000;
    let swaps: MonadSwapRecord[];

    if (DB_ENABLED) {
      swaps = await dbQueryMonadSwaps(addr, sinceMs);
      log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — ${swaps.length} swaps from DB`);

      if (swaps.length === 0) {
        log('monad-chart', `${addr.slice(0, 10)} — DB empty, triggering backfill...`);
        await monadTracker.backfill(addr, config.blocksBack);
        swaps = await dbQueryMonadSwaps(addr, sinceMs);
        log('monad-chart', `${addr.slice(0, 10)} — ${swaps.length} swaps after backfill`);
      }
    } else {
      if (!monadTracker.hasBackfill(addr, config.blocksBack)) {
        await monadTracker.backfill(addr, config.blocksBack);
      }
      swaps = monadTracker.getSwaps(addr, sinceMs);
      log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — ${swaps.length} swaps from memory`);
    }

    if (swaps.length === 0) {
      log('monad-chart', `${addr.slice(0, 10)} — no swaps, returning empty`);
      res.json([]);
      return;
    }

    const latestBlock = Math.max(...swaps.map(s => s.blockNumber));
    const buckets = bucketSwaps(swaps, config, latestBlock);

    const dataPoints = buckets.map(b => {
      let value: number;
      switch (metric) {
        case 'Price':
          value = b.closingPrice ?? 0;
          break;
        case 'Volume':
          value = b.volumeMON;
          break;
        case 'Fees':
          value = b.volumeMON * 0.01;
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
        price: Math.round((b.closingPrice ?? 0) * 1e6) / 1e6,
        block: b.blockEnd,
      };
    });

    log('monad-chart', `${addr.slice(0, 10)} ${metric} ${range} — served in ${Date.now() - t0}ms`);
    res.json(dataPoints);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('monad-chart', message);
    res.status(500).json({ error: message });
  }
});

export default router;
