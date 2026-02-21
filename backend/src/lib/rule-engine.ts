import { supabase, DB_ENABLED } from './supabase.js';
import { tracker, type SwapRecord } from './pool-tracker.js';
import { log, logError } from './log.js';

type ConditionOperator = '>' | '>=' | '<' | '<=' | '=';

interface RuleCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
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
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const COOLDOWN_MS = 30_000;
const cooldowns = new Map<string, number>();

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

function evaluateCondition(condition: RuleCondition, swap: SwapRecord): { met: boolean; description: string } {
  const threshold = parseFloat(condition.value);
  if (isNaN(threshold)) return { met: false, description: `${condition.field}: invalid threshold` };

  if (condition.field === 'Price') {
    const met = compare(swap.price, condition.operator, threshold);
    return { met, description: `Price: $${swap.price.toLocaleString()} ${condition.operator} $${threshold.toLocaleString()}` };
  }

  return { met: false, description: `Unknown condition: ${condition.field}` };
}

function buildProposedAction(a: RuleAction): string {
  switch (a.type) {
    case 'Create Alert': return a.config.message || 'Alert triggered';
    case 'Recommend Swap': return `Recommend: swap $${a.config.amount || '?'} into ${a.config.token || 'token'}`;
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

  const triggerReason = `${formatUSD(swap.volumeUSD)} swap on ${swap.pool} at $${swap.price.toLocaleString()}`;
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
      conditionsMet,
      proposedActions,
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
    log('rule-engine', `  → "${rule.name}" on ${rule.pool} | ${condStr} | actions: [${actStr}]${cdStr}`);
  }
}

export function startRuleEngine() {
  if (!DB_ENABLED) {
    log('rule-engine', 'DB disabled — rule engine not started');
    return;
  }

  setTimeout(() => logActiveRules(), 2000);
  setInterval(() => logActiveRules(), 60_000);

  tracker.on('swap', async (swap: SwapRecord) => {
    const rules = await loadEnabledRules();
    const matchingRules = rules.filter(r => r.pool === swap.pool);

    if (matchingRules.length === 0) return;

    log('rule-engine', `Evaluating ${matchingRules.length} rule(s) for ${swap.pool} swap | price $${swap.price.toLocaleString()} | vol $${swap.volumeUSD.toFixed(2)}`);

    for (const rule of matchingRules) {
      const lastFired = cooldowns.get(rule.id) || 0;
      const sinceLast = Date.now() - lastFired;
      if (sinceLast < COOLDOWN_MS) {
        log('rule-engine', `  "${rule.name}" — skipped (cooldown ${Math.round((COOLDOWN_MS - sinceLast) / 1000)}s remaining)`);
        continue;
      }

      const results = rule.conditions.map(c => evaluateCondition(c, swap));
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
  });

  log('rule-engine', 'Server-side rule engine started — evaluating on every swap');
}
