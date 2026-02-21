'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Rule, SavedChart, ActionItem, ActionStatus } from './types';
import { generateTriggerData } from './mock-data';
import { fetchChartData } from './pool-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded */ }
}

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
  };
  createdAt: number;
}

export function useSavedCharts() {
  const [charts, setCharts] = useState<SavedChart[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const dbCharts = await apiGet<DbChart[]>('/api/charts');

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
        },
        data: [],
        createdAt: c.createdAt,
      }));

      setCharts(withEmptyData);

      for (const chart of withEmptyData) {
        fetchChartData(chart.config.metric, chart.config.pool, chart.config.range)
          .then(data => {
            if (cancelled) return;
            setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, data } : c));
          })
          .catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const add = useCallback((chart: SavedChart) => {
    setCharts(prev => [chart, ...prev]);
    apiPost('/api/charts', { id: chart.id, title: chart.title, config: chart.config });
  }, []);

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

  const accumulateDataPoint = useCallback((id: string, delta: number) => {
    setCharts(prev => {
      return prev.map(c => {
        if (c.id !== id || c.data.length === 0) return c;
        const data = [...c.data];
        const last = { ...data[data.length - 1] };
        last.value = Math.round((last.value + delta) * 100) / 100;
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
    setRules(loadFromStorage('unisignal-rules', []));
  }, []);

  const addRule = useCallback((rule: Rule) => {
    setRules(prev => {
      const next = [rule, ...prev];
      saveToStorage('unisignal-rules', next);
      return next;
    });
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<Rule>) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveToStorage('unisignal-rules', next);
      return next;
    });
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id);
      saveToStorage('unisignal-rules', next);
      return next;
    });
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
      const next = [dup, ...prev];
      saveToStorage('unisignal-rules', next);
      return next;
    });
  }, []);

  return { rules, addRule, updateRule, removeRule, duplicateRule };
}

export function useActions() {
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => {
    setActions(loadFromStorage('unisignal-actions', []));
  }, []);

  const addAction = useCallback((action: ActionItem) => {
    setActions(prev => {
      const next = [action, ...prev];
      saveToStorage('unisignal-actions', next);
      return next;
    });
  }, []);

  const updateStatus = useCallback((id: string, status: ActionStatus) => {
    setActions(prev => {
      const next = prev.map(a => a.id === id ? { ...a, status } : a);
      saveToStorage('unisignal-actions', next);
      return next;
    });
  }, []);

  const simulateTrigger = useCallback((rule: Rule) => {
    const triggerData = generateTriggerData(rule.name, rule.trigger.pool);
    const action: ActionItem = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'Pending',
      triggerReason: triggerData.triggerReason,
      suggestedAction: triggerData.suggestedAction,
      timestamp: Date.now(),
      source: 'simulated',
      details: {
        eventType: rule.trigger.type,
        pool: rule.trigger.pool,
        conditionsMet: triggerData.conditionsMet,
        proposedActions: triggerData.proposedActions,
      },
    };
    addAction(action);
    return action;
  }, [addAction]);

  const clearAll = useCallback(() => {
    setActions([]);
    saveToStorage('unisignal-actions', []);
  }, []);

  return { actions, addAction, updateStatus, simulateTrigger, clearAll };
}
