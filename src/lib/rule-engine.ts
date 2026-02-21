import type { Rule, RuleCondition, ActionItem, WindowSize, ConditionOperator, ChainId } from './types';
import type { SwapEvent } from './use-pool-stream';

const WINDOW_MS: Record<WindowSize, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
};

function compare(left: number, op: ConditionOperator, right: number): boolean {
  switch (op) {
    case '>':  return left > right;
    case '>=': return left >= right;
    case '<':  return left < right;
    case '<=': return left <= right;
    case '=':  return Math.abs(left - right) < 0.001;
    default:   return false;
  }
}

function formatUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

interface ConditionResult {
  met: boolean;
  description: string;
}

export function evaluateCondition(
  condition: RuleCondition,
  swap: SwapEvent,
  recentSwaps: SwapEvent[],
): ConditionResult {
  const threshold = parseFloat(condition.value);
  if (isNaN(threshold) && condition.field !== 'Swap Direction') {
    return { met: false, description: `${condition.field}: invalid threshold "${condition.value}"` };
  }

  switch (condition.field) {
    case 'Price': {
      const met = compare(swap.price, condition.operator, threshold);
      return {
        met,
        description: `Price: $${swap.price.toLocaleString()} ${condition.operator} $${threshold.toLocaleString()}`,
      };
    }

    case 'Notional USD': {
      const met = compare(swap.volumeUSD, condition.operator, threshold);
      return {
        met,
        description: `Notional USD: ${formatUSD(swap.volumeUSD)} ${condition.operator} ${formatUSD(threshold)}`,
      };
    }

    case 'Price Impact %': {
      if (recentSwaps.length < 2) {
        return { met: false, description: 'Price Impact %: not enough data' };
      }
      const prices = recentSwaps.slice(-10).map(s => s.price);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const impact = avg !== 0 ? Math.abs(swap.price - avg) / avg * 100 : 0;
      const met = compare(impact, condition.operator, threshold);
      return {
        met,
        description: `Price Impact: ${impact.toFixed(2)}% ${condition.operator} ${threshold}%`,
      };
    }

    case 'Swap Direction': {
      const direction = condition.value || 'Buy';
      const prev = recentSwaps.length > 0 ? recentSwaps[recentSwaps.length - 1].price : swap.price;
      const actual = swap.price >= prev ? 'Buy' : 'Sell';
      const met = actual === direction;
      return {
        met,
        description: `Swap Direction: ${actual} (wanted ${direction})`,
      };
    }

    case 'Count in Window': {
      const windowMs = WINDOW_MS[condition.window || '5m'];
      const cutoff = swap.timestamp - windowMs;
      const count = recentSwaps.filter(s => s.timestamp >= cutoff).length + 1;
      const met = compare(count, condition.operator, threshold);
      return {
        met,
        description: `Count in ${condition.window || '5m'}: ${count} swaps ${condition.operator} ${threshold}`,
      };
    }

    default:
      return { met: false, description: `Unknown condition: ${condition.field}` };
  }
}

export function evaluateRule(
  rule: Rule,
  swap: SwapEvent,
  recentSwaps: SwapEvent[],
): ActionItem | null {
  if (!rule.enabled) return null;
  if (rule.trigger.pool !== swap.pool) return null;

  const results = rule.conditions.map(c => evaluateCondition(c, swap, recentSwaps));
  const allMet = results.length === 0 || results.every(r => r.met);

  if (!allMet) return null;

  const conditionsMet = results.filter(r => r.met).map(r => r.description);

  const chain: ChainId = rule.trigger.chain ?? 'eth';
  const volLabel = chain === 'monad' ? `${swap.volumeUSD.toFixed(2)} MON` : formatUSD(swap.volumeUSD);
  const triggerReason = `${volLabel} swap on ${swap.pool} at $${swap.price.toLocaleString()}`;

  const proposedActions = rule.actions.map(a => {
    switch (a.type) {
      case 'Create Alert':
        return a.config.message || 'Alert triggered';
      case 'Notify':
        return `Notify ${a.config.channel || 'channel'}`;
      case 'Recommend Swap':
        return `Recommend: swap ${a.config.amount || '?'} ${a.config.token || 'token'}`;
      default:
        return a.type;
    }
  });

  const suggestedAction = proposedActions[0] || 'Review triggered action';

  return {
    id: crypto.randomUUID(),
    ruleId: rule.id,
    ruleName: rule.name,
    status: 'Pending',
    triggerReason,
    suggestedAction,
    timestamp: Date.now(),
    source: 'live' as const,
    details: {
      eventType: rule.trigger.type,
      pool: swap.pool,
      chain,
      conditionsMet,
      proposedActions,
    },
  };
}
