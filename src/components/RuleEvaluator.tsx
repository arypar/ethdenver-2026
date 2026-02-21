'use client';

import { useEffect, useRef } from 'react';
import type { Rule, ActionItem } from '@/lib/types';
import type { SwapEvent } from '@/lib/use-pool-stream';
import { wsClient } from '@/lib/ws-client';
import { evaluateRule } from '@/lib/rule-engine';

const WINDOW_SIZE = 100;
const COOLDOWN_MS = 30_000;

interface Props {
  rules: Rule[];
  onAction: (action: ActionItem) => void;
}

export default function RuleEvaluator({ rules, onAction }: Props) {
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const recentSwapsRef = useRef(new Map<string, SwapEvent[]>());
  const cooldownRef = useRef(new Map<string, number>());
  const unsubsRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    const enabledRules = rulesRef.current.filter(r => r.enabled);
    const neededPools = new Set(enabledRules.map(r => r.trigger.pool));

    for (const [pool, unsub] of unsubsRef.current) {
      if (!neededPools.has(pool)) {
        unsub();
        unsubsRef.current.delete(pool);
        recentSwapsRef.current.delete(pool);
      }
    }

    for (const pool of neededPools) {
      if (unsubsRef.current.has(pool)) continue;

      const unsub = wsClient.subscribe(pool, (data) => {
        const swap = data as SwapEvent;
        const recent = recentSwapsRef.current.get(pool) || [];
        recent.push(swap);
        if (recent.length > WINDOW_SIZE) recent.splice(0, recent.length - WINDOW_SIZE);
        recentSwapsRef.current.set(pool, recent);

        for (const rule of rulesRef.current) {
          if (!rule.enabled || rule.trigger.pool !== pool) continue;

          const lastFired = cooldownRef.current.get(rule.id) || 0;
          if (Date.now() - lastFired < COOLDOWN_MS) continue;

          const action = evaluateRule(rule, swap, recent);
          if (action) {
            cooldownRef.current.set(rule.id, Date.now());
            onActionRef.current(action);
          }
        }
      });

      unsubsRef.current.set(pool, unsub);
    }
  }, [rules]);

  useEffect(() => {
    return () => {
      for (const unsub of unsubsRef.current.values()) unsub();
      unsubsRef.current.clear();
    };
  }, []);

  return null;
}
