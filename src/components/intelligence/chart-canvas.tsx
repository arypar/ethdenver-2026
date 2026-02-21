'use client';

import { GlowCard } from '@/components/glow-card';
import { PillButton } from '@/components/pill-button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { ChartConfig, ChartDataPoint } from '@/lib/types';
import { formatValue, getChartStats } from '@/lib/pool-data';

interface ChartCanvasProps {
  config: ChartConfig;
  data: ChartDataPoint[];
  onSave: () => void;
}

function ChartTooltipContent({ active, payload, metric }: { active?: boolean; payload?: Array<{ value: number }>; metric: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl bg-uni-surface0/95 backdrop-blur-xl border border-white/[0.10] px-3 py-2 shadow-xl">
      <span className="text-sm font-medium text-uni-text0">
        {formatValue(payload[0].value, metric as ChartConfig['metric'])}
      </span>
    </div>
  );
}

export function ChartCanvas({ config, data, onSave }: ChartCanvasProps) {
  const stats = getChartStats(data);
  const title = `${config.pool} ${config.metric}`;

  const commonProps = {
    data,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };

  const axisProps = {
    xAxis: {
      dataKey: 'time',
      tick: { fill: '#A1A1B3', fontSize: 11 },
      tickLine: false,
      axisLine: false,
      interval: Math.floor(data.length / 6),
    },
    yAxis: {
      tick: { fill: '#A1A1B3', fontSize: 11 },
      tickLine: false,
      axisLine: false,
      width: 60,
      tickFormatter: (v: number) => formatValue(v, config.metric),
    },
  };

  const renderChart = () => {
    if (config.chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <XAxis {...axisProps.xAxis} />
          <YAxis {...axisProps.yAxis} />
          <Tooltip content={<ChartTooltipContent metric={config.metric} />} />
          <Bar dataKey="value" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF007A" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#FF007A" stopOpacity={0.3} />
            </linearGradient>
          </defs>
        </BarChart>
      );
    }
    if (config.chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <XAxis {...axisProps.xAxis} />
          <YAxis {...axisProps.yAxis} />
          <Tooltip content={<ChartTooltipContent metric={config.metric} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#FF007A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#FF007A', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      );
    }
    return (
      <AreaChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis {...axisProps.xAxis} />
        <YAxis {...axisProps.yAxis} />
        <Tooltip content={<ChartTooltipContent metric={config.metric} />} />
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF007A" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#FF007A" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="#FF007A"
          strokeWidth={2}
          fill="url(#areaGrad)"
          activeDot={{ r: 4, fill: '#FF007A', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    );
  };

  return (
    <GlowCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-uni-text0 tracking-tight">{title}</h2>
          <Badge className="rounded-full bg-green-500/10 text-green-400 border-green-500/20 text-[11px] font-medium px-2 py-0">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
            Live (mock)
          </Badge>
        </div>
        <PillButton variant="secondary" size="sm" onClick={onSave}>
          <Bookmark className="w-3.5 h-3.5" />
          Save
        </PillButton>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox
          label="Current"
          value={formatValue(stats.current, config.metric)}
          icon={<Activity className="w-3.5 h-3.5 text-uni-text1" />}
        />
        <StatBox
          label="24h Change"
          value={`${stats.change24h >= 0 ? '+' : ''}${stats.change24h.toFixed(2)}%`}
          icon={stats.change24h >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          }
          highlight={stats.change24h >= 0 ? 'green' : 'red'}
        />
        <StatBox
          label="Peak"
          value={formatValue(stats.peak, config.metric)}
          icon={<TrendingUp className="w-3.5 h-3.5 text-uni-charm" />}
        />
      </div>
    </GlowCard>
  );
}

function StatBox({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-uni-text1 text-[11px] font-medium uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <span className={`text-sm font-semibold ${
        highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-uni-text0'
      }`}>
        {value}
      </span>
    </div>
  );
}
