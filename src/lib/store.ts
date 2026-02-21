'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChainId, Rule, SavedChart, ActionItem, ActionStatus } from './types';
import { fetchChartData } from './pool-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiPatch(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiDelete(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

interface DbChart {
  id: string;
  title: string;
  config: {
    metric: string;
    pool: string;
    range: string;
    chartType: string;
    chain?: string;
    poolAddress?: string;
  };
  createdAt: number;
}

const BACKFILL_POLL_MS = 2_000;

export function useSavedCharts(chain: ChainId = 'eth') {
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const dbCharts = await apiGet<DbChart[]>(`/api/charts?chain=${chain}`);
      if (cancelled) return;

      const source = dbCharts && dbCharts.length > 0 ? dbCharts : [];
      if (source.length === 0) return;

      const withEmptyData: SavedChart[] = source.map(c => ({
        id: c.id,
        title: c.title,
        config: {
          metric: c.config.metric as SavedChart['config']['metric'],
          pool: c.config.pool,
          range: c.config.range as SavedChart['config']['range'],
          chartType: (c.config.chartType || 'area') as SavedChart['config']['chartType'],
          chain: (c.config.chain || chain) as ChainId,
          ...(c.config.poolAddress ? { poolAddress: c.config.poolAddress } : {}),
        },
        data: [],
        createdAt: c.createdAt,
      }));

      setCharts(withEmptyData);

      // Initial fetch for each chart
      for (const chart of withEmptyData) {
        if (chart.config.metric === 'Liquidity') continue;
        fetchChartData(chart.config.metric, chart.config.pool, chart.config.range, chain)
          .then(({ data, backfilling }) => {
            if (cancelled) return;
            setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, data, backfilling } : c));
          })
          .catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [chain]);

  // Poll for any charts that are backfilling to get incremental data
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);

    pollTimer.current = setInterval(() => {
      setCharts(prev => {
        const backfillingCharts = prev.filter(c => c.backfilling && c.config.metric !== 'Liquidity');
        if (backfillingCharts.length === 0) return prev;

        for (const chart of backfillingCharts) {
          const chainId = (chart.config.chain || chain) as ChainId;
          fetchChartData(chart.config.metric, chart.config.pool, chart.config.range, chainId)
            .then(({ data, backfilling }) => {
              setCharts(p => p.map(c => c.id === chart.id ? { ...c, data, backfilling } : c));
            })
            .catch(() => {});
        }
        return prev;
      });
    }, BACKFILL_POLL_MS);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [chain]);

  const add = useCallback((chart: SavedChart) => {
    setCharts(prev => [chart, ...prev]);
    apiPost('/api/charts', { id: chart.id, title: chart.title, config: { ...chart.config, chain } });
  }, [chain]);

  const rename = useCallback((id: string, title: string) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    apiPatch(`/api/charts/${id}`, { title });
  }, []);

  const remove = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
    apiDelete(`/api/charts/${id}`);
  }, []);

  const appendDataPoint = useCallback((id: string, point: { time: string; value: number; block?: number }) => {
    setCharts(prev => {
      return prev.map(c => {
        if (c.id !== id) return c;
        const maxPoints = 200;
        const data = [...c.data, point];
        if (data.length > maxPoints) data.splice(0, data.length - maxPoints);
        return { ...c, data };
      });
    });
  }, []);

  const accumulateDataPoint = useCallback((id: string, delta: number, block?: number) => {
    setCharts(prev => {
      return prev.map(c => {
        if (c.id !== id || c.data.length === 0) return c;
        const data = [...c.data];
        const last = { ...data[data.length - 1] };
        last.value = Math.round((last.value + delta) * 100) / 100;
        if (block != null) last.block = block;
        data[data.length - 1] = last;
        return { ...c, data };
      });
    });
  }, []);

  return { charts, add, rename, remove, appendDataPoint, accumulateDataPoint };
}

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    apiGet<Rule[]>('/api/rules').then(data => {
      if (data) setRules(data);
    });
  }, []);

  const addRule = useCallback((rule: Rule) => {
    setRules(prev => [rule, ...prev]);
    apiPost('/api/rules', rule);
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    apiPatch(`/api/rules/${id}`, updates);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    apiDelete(`/api/rules/${id}`);
  }, []);

  const duplicateRule = useCallback((id: string) => {
    setRules(prev => {
      const source = prev.find(r => r.id === id);
      if (!source) return prev;
      const dup: Rule = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (copy)`,
        createdAt: Date.now(),
      };
      apiPost('/api/rules', dup);
      return [dup, ...prev];
    });
  }, []);

  return { rules, addRule, updateRule, removeRule, duplicateRule };
}

const ACTIONS_POLL_MS = 5_000;

export function useActions() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const data = await apiGet<ActionItem[]>('/api/actions');
      if (!cancelled && data) setActions(data);
    };

    poll();
    const interval = setInterval(poll, ACTIONS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const updateStatus = useCallback((id: string, status: ActionStatus) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    apiPatch(`/api/actions/${id}`, { status });
  }, []);

  const clearAll = useCallback(() => {
    setActions([]);
    apiDelete('/api/actions');
  }, []);

  return { actions, updateStatus, clearAll };
}
