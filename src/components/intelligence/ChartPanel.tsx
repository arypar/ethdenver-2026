'use client';

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bookmark, TrendingUp, TrendingDown } from 'lucide-react';
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
  CartesianGrid,
} from 'recharts';
import type { ChartConfig, ChartDataPoint } from '@/lib/types';
import { formatValue, getChartStats } from '@/lib/mock-data';

interface ChartPanelProps {
  config: ChartConfig;
  data: ChartDataPoint[];
  onSave: () => void;
}

function CustomTooltip({ active, payload, metric }: { active?: boolean; payload?: Array<{ value: number }>; metric: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
      {formatValue(payload[0].value, metric as ChartConfig['metric'])}
    </div>
  );
}

export function ChartPanel({ config, data, onSave }: ChartPanelProps) {
  const stats = getChartStats(data);
  const title = `${config.pool} ${config.metric}`;

  const xAxisProps = {
    dataKey: 'time' as const,
    tick: { fill: 'rgba(244,244,247,0.5)', fontSize: 11 },
    tickLine: false,
    axisLine: false,
    interval: Math.floor(data.length / 6),
  };

  const yAxisProps = {
    tick: { fill: 'rgba(244,244,247,0.5)', fontSize: 11 },
    tickLine: false,
    axisLine: false,
    width: 56,
    tickFormatter: (v: number) => formatValue(v, config.metric),
  };

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: 'rgba(255,255,255,0.04)',
  };

  const renderChart = () => {
    const margin = { top: 4, right: 4, left: 0, bottom: 0 };
    if (config.chartType === 'bar') {
      return (
        <BarChart data={data} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip metric={config.metric} />} />
          <Bar dataKey="value" fill="#FF007A" opacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      );
    }
    if (config.chartType === 'line') {
      return (
        <LineChart data={data} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip metric={config.metric} />} />
          <Line type="monotone" dataKey="value" stroke="#FF007A" strokeWidth={1.5} dot={false} />
        </LineChart>
      );
    }
    return (
      <AreaChart data={data} margin={margin}>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<CustomTooltip metric={config.metric} />} />
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF007A" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#FF007A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke="#FF007A" strokeWidth={1.5} fill="url(#areaFill)" />
      </AreaChart>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px]">Mock</Badge>
            <Button variant="ghost" size="sm" onClick={onSave}>
              <Bookmark className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex gap-6 text-xs">
          <Stat label="Current" value={formatValue(stats.current, config.metric)} />
          <Stat
            label="24h Change"
            value={`${stats.change24h >= 0 ? '+' : ''}${stats.change24h.toFixed(2)}%`}
            color={stats.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}
            icon={stats.change24h >= 0 ? TrendingUp : TrendingDown}
          />
          <Stat label="Peak" value={formatValue(stats.peak, config.metric)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-medium ${color || 'text-foreground'} flex items-center gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {value}
      </div>
    </div>
  );
}
