'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Trash2, BarChart3 } from 'lucide-react';
import type { SavedChart } from '@/lib/types';

interface SavedChartsListProps {
  charts: SavedChart[];
  onOpen: (chart: SavedChart) => void;
  onRemove: (id: string) => void;
}

export function SavedChartsList({ charts, onOpen, onRemove }: SavedChartsListProps) {
  if (charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No saved charts</p>
        <p className="text-xs text-muted-foreground/70">Generate a chart and save it to see it here</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Saved Charts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {charts.map(chart => (
            <div key={chart.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{chart.title}</div>
                <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                  <span>{chart.config.metric}</span>
                  <span>{chart.config.pool}</span>
                  <span>{chart.config.range}</span>
                </div>
              </div>
              <div className="flex gap-1 ml-4">
                <Button variant="ghost" size="icon-xs" onClick={() => onOpen(chart)}>
                  <Eye className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onRemove(chart.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
