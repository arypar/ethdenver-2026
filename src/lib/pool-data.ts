import type { ChartDataPoint, Metric, Pool, TimeRange } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchChartData(
  metric: Metric,
  pool: Pool,
  range: TimeRange,
): Promise<ChartDataPoint[]> {
  const res = await fetch(`${API_BASE}/uniswap/chart-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pool, metric, range }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to fetch chart data: ${res.status}`);
  }

  return res.json();
}

export function formatValue(value: number, metric: Metric): string {
  if (metric === 'Price') {
    if (value >= 10_000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (value >= 1) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (value >= 0.001) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(6)}`;
  }

  if (metric === 'Volume' || metric === 'Fees') {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(4)}`;
  }

  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatAxisTick(value: number, metric: Metric): string {
  if (metric === 'Price') {
    if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
    if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    return `$${value.toFixed(4)}`;
  }

  if (metric === 'Volume' || metric === 'Fees') {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function getChartStats(data: ChartDataPoint[]) {
  if (data.length === 0) return { current: 0, change24h: 0, peak: 0 };
  const current = data[data.length - 1].value;
  const first = data[0].value;
  const change24h = first !== 0 ? ((current - first) / first) * 100 : 0;
  const peak = Math.max(...data.map(d => d.value));
  return { current, change24h, peak };
}

export function formatBlock(block: number): string {
  if (block >= 1_000_000) return `#${(block / 1_000_000).toFixed(1)}M`;
  if (block >= 1_000) return `#${(block / 1_000).toFixed(0)}K`;
  return `#${block}`;
}

export function formatBlockFull(block: number): string {
  return `#${block.toLocaleString()}`;
}

export function getYDomain(data: ChartDataPoint[], metric: Metric): [number, number] | [string, string] {
  if (data.length === 0) return [0, 1];
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (metric === 'Price') {
    if (min === max) return [min * 0.999, max * 1.001];
    const pad = (max - min) * 0.08;
    return [Math.max(0, min - pad), max + pad];
  }

  return [0, max * 1.05 || 1];
}
