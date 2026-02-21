'use client';

import { useState, useCallback } from 'react';
import { ChartBuilder } from './chart-builder';
import { ChartCanvas } from './chart-canvas';
import { SavedCharts } from './saved-charts';
import { generateChartData } from '@/lib/mock-data';
import type { ChartConfig, ChartDataPoint, SavedChart } from '@/lib/types';
import type { Metric, Pool, TimeRange, ChartType } from '@/lib/types';

const METRICS: Metric[] = ['Volume', 'TVL', 'Fees', 'Price', 'Liquidity Delta', 'Swap Count'];
const POOLS: Pool[] = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'ARB/USDC', 'LINK/ETH', 'MATIC/USDC'];
const RANGES: TimeRange[] = ['1H', '24H', '7D'];
const CHART_TYPES: ChartType[] = ['line', 'area', 'bar'];

interface IntelligenceTabProps {
  savedCharts: SavedChart[];
  onSaveChart: (chart: SavedChart) => void;
  onRemoveChart: (id: string) => void;
}

export function IntelligenceTab({ savedCharts, onSaveChart, onRemoveChart }: IntelligenceTabProps) {
  const [config, setConfig] = useState<ChartConfig>({
    metric: 'Volume',
    pool: 'WETH/USDC',
    range: '24H',
    chartType: 'area',
  });
  const [data, setData] = useState<ChartDataPoint[]>(() =>
    generateChartData('Volume', 'WETH/USDC', '24H')
  );

  const handleGenerate = useCallback(() => {
    setData(generateChartData(config.metric, config.pool, config.range));
  }, [config]);

  const handleRandomize = useCallback(() => {
    const newConfig: ChartConfig = {
      metric: METRICS[Math.floor(Math.random() * METRICS.length)],
      pool: POOLS[Math.floor(Math.random() * POOLS.length)],
      range: RANGES[Math.floor(Math.random() * RANGES.length)],
      chartType: CHART_TYPES[Math.floor(Math.random() * CHART_TYPES.length)],
    };
    setConfig(newConfig);
    setData(generateChartData(newConfig.metric, newConfig.pool, newConfig.range));
  }, []);

  const handleSave = useCallback(() => {
    const chart: SavedChart = {
      id: crypto.randomUUID(),
      title: `${config.pool} ${config.metric}`,
      config: { ...config },
      data: [...data],
      createdAt: Date.now(),
    };
    onSaveChart(chart);
  }, [config, data, onSaveChart]);

  const handleOpenSaved = useCallback((chart: SavedChart) => {
    setConfig(chart.config);
    setData(chart.data);
  }, []);

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <ChartBuilder
          config={config}
          onChange={setConfig}
          onGenerate={handleGenerate}
          onRandomize={handleRandomize}
        />
        <ChartCanvas
          config={config}
          data={data}
          onSave={handleSave}
        />
      </div>

      <SavedCharts
        charts={savedCharts}
        onOpen={handleOpenSaved}
        onRemove={onRemoveChart}
      />
    </div>
  );
}
