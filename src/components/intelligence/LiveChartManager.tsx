'use client';

import { useMemo, useRef } from 'react';
import { usePoolStream, metricFromSwap, type SwapEvent } from '@/lib/use-pool-stream';
import { formatBlock } from '@/lib/pool-data';
import type { SavedChart, Pool, ChartDataPoint } from '@/lib/types';

interface LiveChartManagerProps {
  charts: SavedChart[];
  onAppendDataPoint: (chartId: string, point: ChartDataPoint) => void;
  onAccumulateDataPoint: (chartId: string, delta: number) => void;
}

const AGGREGATE_METRICS = new Set(['Volume', 'Fees', 'Swap Count']);

function PoolListener({
  pool,
  charts,
  onAppendDataPoint,
  onAccumulateDataPoint,
}: {
  pool: Pool;
  charts: SavedChart[];
  onAppendDataPoint: (chartId: string, point: ChartDataPoint) => void;
  onAccumulateDataPoint: (chartId: string, delta: number) => void;
}) {
  const chartsRef = useRef(charts);
  chartsRef.current = charts;
  const appendRef = useRef(onAppendDataPoint);
  appendRef.current = onAppendDataPoint;
  const accumulateRef = useRef(onAccumulateDataPoint);
  accumulateRef.current = onAccumulateDataPoint;

  const handleSwap = (swap: SwapEvent) => {
    const blockLabel = formatBlock(swap.blockNumber);

    for (const chart of chartsRef.current) {
      if (chart.config.pool !== pool) continue;
      const value = metricFromSwap(swap, chart.config.metric);
      if (value === 0) continue;

      if (AGGREGATE_METRICS.has(chart.config.metric)) {
        accumulateRef.current(chart.id, value);
      } else {
        appendRef.current(chart.id, {
          time: blockLabel,
          value: Math.round(value * 100) / 100,
          block: swap.blockNumber,
        });
      }
    }
  };

  usePoolStream(pool, handleSwap);

  return null;
}

export function LiveChartManager({ charts, onAppendDataPoint, onAccumulateDataPoint }: LiveChartManagerProps) {
  const activePools = useMemo(() => {
    const pools = new Set<Pool>();
    for (const chart of charts) {
      if (chart.data.length > 0) pools.add(chart.config.pool);
    }
    return Array.from(pools);
  }, [charts]);

  return (
    <>
      {activePools.map(pool => (
        <PoolListener
          key={pool}
          pool={pool}
          charts={charts.filter(c => c.config.pool === pool && c.data.length > 0)}
          onAppendDataPoint={onAppendDataPoint}
          onAccumulateDataPoint={onAccumulateDataPoint}
        />
      ))}
    </>
  );
}
