import type { ChartDataPoint, Metric, Pool, TimeRange } from './types';

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const triggerReasons = [
  'Large swap detected: $2.4M WETH → USDC',
  'Price impact exceeded 3.2% threshold',
  'Swap count surged to 85 in 5m window',
  'Notional swap exceeded $500K on UNI/ETH',
];

const suggestedActions = [
  'Swap 50% WETH → USDC to reduce exposure',
  'Tighten position range on WETH/USDC',
  'Review portfolio — high volatility detected',
  'Consider limit order at support level',
];

const RANGE_POINTS: Record<TimeRange, number> = {
  '1H': 12,
  '24H': 24,
  '7D': 28,
  '30D': 30,
};

const METRIC_BASES: Record<string, [number, number]> = {
  Volume: [500_000, 2_000_000],
  TVL: [5_000_000, 20_000_000],
  Fees: [5_000, 50_000],
  Price: [1_500, 3_500],
  'Liquidity Delta': [-500_000, 500_000],
  'Swap Count': [200, 2_000],
  Liquidity: [1_000_000, 10_000_000],
};

function timeLabels(range: TimeRange, count: number): string[] {
  const labels: string[] = [];
  const now = Date.now();
  const span =
    range === '1H' ? 3_600_000
    : range === '24H' ? 86_400_000
    : range === '7D' ? 604_800_000
    : 2_592_000_000;
  const step = span / (count - 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(now - span + step * i);
    if (range === '1H' || range === '24H') {
      labels.push(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } else {
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }
  return labels;
}

export function generateChartData(metric: Metric | string, pool: Pool, range: TimeRange): ChartDataPoint[] {
  const seed = hashString(`${metric}-${pool}-${range}`);
  const rand = seededRandom(seed);
  const count = RANGE_POINTS[range] || 24;
  const [lo, hi] = METRIC_BASES[metric] ?? [100, 10_000];
  const labels = timeLabels(range, count);

  let value = lo + rand() * (hi - lo);
  return labels.map((time) => {
    const drift = (rand() - 0.48) * (hi - lo) * 0.08;
    value = Math.max(lo * 0.5, Math.min(hi * 1.5, value + drift));
    return { time, value: Math.round(value * 100) / 100 };
  });
}

export function generateSparklineData(seed: number): number[] {
  const rand = seededRandom(seed);
  const pts: number[] = [];
  let v = 50 + rand() * 50;
  for (let i = 0; i < 20; i++) {
    v += (rand() - 0.48) * 10;
    v = Math.max(10, Math.min(100, v));
    pts.push(Math.round(v * 10) / 10);
  }
  return pts;
}

export function generateTriggerData(ruleName: string, pool: string) {
  const seed = hashString(`${ruleName}-${Date.now()}`);
  const rand = seededRandom(seed);
  const idx = Math.floor(rand() * triggerReasons.length);
  return {
    triggerReason: triggerReasons[idx],
    suggestedAction: suggestedActions[idx],
    conditionsMet: [
      `Notional USD > $100K`,
      `Price Impact > 1.5%`,
      `Within 15m window`,
    ].slice(0, 1 + Math.floor(rand() * 3)),
    proposedActions: [suggestedActions[idx]],
  };
}
