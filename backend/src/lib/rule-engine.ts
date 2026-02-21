import { supabase, DB_ENABLED } from './supabase.js';
import { tracker, type SwapRecord } from './pool-tracker.js';
import { monadTracker, type MonadSwapRecord } from './monad-tracker.js';
import { log, logError } from './log.js';

type ConditionOperator = '>' | '>=' | '<' | '<=' | '=';
type WindowSize = '1m' | '5m' | '15m' | '1h';

const WINDOW_MS: Record<WindowSize, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
};

interface RuleCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
  window?: WindowSize;
}

interface RuleAction {
  id: string;
  type: string;
  config: Record<string, any>;
}

interface DbRule {
  id: string;
  name: string;
  enabled: boolean;
  pool: string;
  chain: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const COOLDOWN_MS = 30_000;
const RECENT_BUFFER_SIZE = 200;
const cooldowns = new Map<string, number>();
const recentSwaps = new Map<string, SwapRecord[]>();

function pushRecent(poolKey: string, swap: SwapRecord) {
  let buf = recentSwaps.get(poolKey);
  if (!buf) { buf = []; recentSwaps.set(poolKey, buf); }
  buf.push(swap);
  if (buf.length > RECENT_BUFFER_SIZE) buf.splice(0, buf.length - RECENT_BUFFER_SIZE);
}

function getRecent(poolKey: string): SwapRecord[] {
  return recentSwaps.get(poolKey) ?? [];
}

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

function evaluateCondition(
  condition: RuleCondition,
  swap: SwapRecord,
  recent: SwapRecord[],
): { met: boolean; description: string } {
  const threshold = parseFloat(condition.value);
  if (isNaN(threshold) && condition.field !== 'Swap Direction') {
    return { met: false, description: `${condition.field}: invalid threshold` };
  }

  switch (condition.field) {
    case 'Price': {
      const met = compare(swap.price, condition.operator, threshold);
      return { met, description: `Price: $${swap.price.toLocaleString()} ${condition.operator} $${threshold.toLocaleString()}` };
    }

    case 'Notional USD': {
      const met = compare(swap.volumeUSD, condition.operator, threshold);
      return { met, description: `Notional USD: ${formatUSD(swap.volumeUSD)} ${condition.operator} ${formatUSD(threshold)}` };
    }

    case 'Price Impact %': {
      if (recent.length < 2) {
        return { met: false, description: 'Price Impact %: not enough data' };
      }
      const prices = recent.slice(-10).map(s => s.price);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const impact = avg !== 0 ? Math.abs(swap.price - avg) / avg * 100 : 0;
      const met = compare(impact, condition.operator, threshold);
      return { met, description: `Price Impact: ${impact.toFixed(2)}% ${condition.operator} ${threshold}%` };
    }

    case 'Swap Direction': {
      const direction = condition.value || 'Buy';
      const prev = recent.length > 0 ? recent[recent.length - 1].price : swap.price;
      const actual = swap.price >= prev ? 'Buy' : 'Sell';
      const met = actual === direction;
      return { met, description: `Swap Direction: ${actual} (wanted ${direction})` };
    }

    case 'Count in Window': {
      const windowMs = WINDOW_MS[condition.window || '5m'];
      const cutoff = swap.timestamp - windowMs;
      const count = recent.filter(s => s.timestamp >= cutoff).length + 1;
      const met = compare(count, condition.operator, threshold);
      return { met, description: `Count in ${condition.window || '5m'}: ${count} swaps ${condition.operator} ${threshold}` };
    }

    default:
      return { met: false, description: `Unknown condition: ${condition.field}` };
  }
}

function buildProposedAction(a: RuleAction): string {
  switch (a.type) {
    case 'Create Alert': return a.config.message || 'Alert triggered';
    case 'Recommend Swap': return `Recommend: swap ${a.config.amount || '?'} ${a.config.token || 'token'}`;
    default: return a.type;
  }
}

async function loadEnabledRules(): Promise<DbRule[]> {
  if (!DB_ENABLED || !supabase) return [];
  const { data, error } = await supabase.from('rules').select('*').eq('enabled', true);
  if (error) { logError('rule-engine', `Load rules: ${error.message}`); return []; }
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    pool: r.pool,
    chain: r.chain || 'eth',
    conditions: r.conditions as RuleCondition[],
    actions: r.actions as RuleAction[],
  }));
}

async function hasPendingAction(ruleId: string): Promise<boolean> {
  if (!DB_ENABLED || !supabase) return false;
  const { count, error } = await supabase
    .from('rule_actions')
    .select('id', { count: 'exact', head: true })
    .eq('rule_id', ruleId)
    .eq('status', 'Pending');
  if (error) { logError('rule-engine', `Check pending: ${error.message}`); return false; }
  return (count ?? 0) > 0;
}

async function insertAction(rule: DbRule, swap: SwapRecord, conditionsMet: string[], proposedActions: string[]) {
  if (!DB_ENABLED || !supabase) return;

  if (await hasPendingAction(rule.id)) {
    log('rule-engine', `  "${rule.name}" — skipped (pending action already exists)`);
    return;
  }

  const volLabel = rule.chain === 'monad' ? `${swap.volumeUSD.toFixed(2)} MON` : formatUSD(swap.volumeUSD);
  const triggerReason = `${volLabel} swap on ${swap.pool} at $${swap.price.toLocaleString()}`;
  const suggestedAction = proposedActions[0] || 'Review triggered action';

  const { error } = await supabase.from('rule_actions').insert({
    rule_id: rule.id,
    rule_name: rule.name,
    status: 'Pending',
    trigger_reason: triggerReason,
    suggested_action: suggestedAction,
    source: 'live',
    details: {
      eventType: 'Swap',
      pool: swap.pool,
      chain: rule.chain,
      conditionsMet,
      proposedActions,
      actionTypes: rule.actions.map(a => a.type),
    },
  });

  if (error) {
    logError('rule-engine', `Insert action: ${error.message}`);
  } else {
    log('rule-engine', `Action created for rule "${rule.name}" — ${triggerReason}`);
  }
}

async function logActiveRules() {
  const rules = await loadEnabledRules();
  if (rules.length === 0) {
    log('rule-engine', 'Active rules: none');
    return;
  }
  const pools = [...new Set(rules.map(r => r.pool))];
  log('rule-engine', `Active rules: ${rules.length} enabled across ${pools.length} pool(s) [${pools.join(', ')}]`);
  for (const rule of rules) {
    const condStr = rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND ') || 'no conditions';
    const actStr = rule.actions.map(a => a.type).join(', ') || 'no actions';
    const cd = cooldowns.get(rule.id);
    const cdStr = cd ? ` | cooldown ${Math.max(0, Math.round((COOLDOWN_MS - (Date.now() - cd)) / 1000))}s` : '';
    log('rule-engine', `  → "${rule.name}" on ${rule.pool} (${rule.chain}) | ${condStr} | actions: [${actStr}]${cdStr}`);
  }
}

export function startRuleEngine() {
  if (!DB_ENABLED) {
    log('rule-engine', 'DB disabled — rule engine not started');
    return;
  }

  setTimeout(() => logActiveRules(), 2000);
  setInterval(() => logActiveRules(), 60_000);

  async function evaluateRules(matchingRules: DbRule[], swap: SwapRecord, poolKey: string) {
    if (matchingRules.length === 0) return;

    const recent = getRecent(poolKey);
    log('rule-engine', `Evaluating ${matchingRules.length} rule(s) for ${swap.pool} swap | price $${swap.price.toLocaleString()} | vol $${swap.volumeUSD.toFixed(2)} | recent: ${recent.length}`);

    for (const rule of matchingRules) {
      const lastFired = cooldowns.get(rule.id) || 0;
      const sinceLast = Date.now() - lastFired;
      if (sinceLast < COOLDOWN_MS) {
        log('rule-engine', `  "${rule.name}" — skipped (cooldown ${Math.round((COOLDOWN_MS - sinceLast) / 1000)}s remaining)`);
        continue;
      }

      const results = rule.conditions.map(c => evaluateCondition(c, swap, recent));
      const allMet = results.length === 0 || results.every(r => r.met);

      for (const r of results) {
        log('rule-engine', `  "${rule.name}" condition: ${r.description} → ${r.met ? 'PASS' : 'FAIL'}`);
      }

      if (!allMet) {
        log('rule-engine', `  "${rule.name}" — not triggered (${results.filter(r => !r.met).length}/${results.length} conditions failed)`);
        continue;
      }

      cooldowns.set(rule.id, Date.now());

      const conditionsMet = results.filter(r => r.met).map(r => r.description);
      const proposedActions = rule.actions.map(buildProposedAction);

      log('rule-engine', `  "${rule.name}" — TRIGGERED! Actions: ${proposedActions.join(', ')}`);
      await insertAction(rule, swap, conditionsMet, proposedActions);
    }
  }

  tracker.on('swap', async (swap: SwapRecord) => {
    const poolKey = `eth:${swap.pool}`;
    pushRecent(poolKey, swap);

    const rules = await loadEnabledRules();
    const matchingRules = rules.filter(r => r.chain === 'eth' && r.pool === swap.pool);
    await evaluateRules(matchingRules, swap, poolKey);
  });

  monadTracker.on('swap', async (monadSwap: MonadSwapRecord) => {
    const rules = await loadEnabledRules();
    const matchingRules = rules.filter(r =>
      r.chain === 'monad' && r.pool.toLowerCase() === monadSwap.token.toLowerCase(),
    );

    const swapRecord: SwapRecord = {
      pool: monadSwap.token,
      blockNumber: monadSwap.blockNumber,
      price: monadSwap.price,
      volumeUSD: monadSwap.volumeMON,
      feeUSD: 0,
      txHash: monadSwap.txHash,
      timestamp: monadSwap.timestamp,
    };

    const poolKey = `monad:${monadSwap.token.toLowerCase()}`;
    pushRecent(poolKey, swapRecord);

    if (matchingRules.length === 0) return;
    await evaluateRules(matchingRules, swapRecord, poolKey);
  });

  log('rule-engine', 'Server-side rule engine started — evaluating all conditions on every swap (ETH + Monad)');
}
