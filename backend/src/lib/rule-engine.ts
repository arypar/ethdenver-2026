import { supabase, DB_ENABLED } from './supabase.js';
import { tracker, dbQuerySwaps, type SwapRecord } from './pool-tracker.js';
import { monadTracker, type MonadSwapRecord } from './monad-tracker.js';
import { log, logDebug, logError } from './log.js';

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
  conditionLogic: 'AND' | 'OR';
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const COOLDOWN_MS = 30_000;
const RECENT_BUFFER_SIZE = 200;
const cooldowns = new Map<string, number>();
const recentSwaps = new Map<string, SwapRecord[]>();

const TOKEN_ALIASES: Record<string, string> = {
  ETH: 'WETH',
  BTC: 'WBTC',
};

function normalizePoolName(pool: string): string {
  return pool
    .split('/')
    .map(t => TOKEN_ALIASES[t.toUpperCase()] ?? t.toUpperCase())
    .join('/');
}

function poolsMatch(a: string, b: string): boolean {
  const tokensA = normalizePoolName(a).split('/');
  const tokensB = normalizePoolName(b).split('/');
  if (tokensA.length !== 2 || tokensB.length !== 2) return normalizePoolName(a) === normalizePoolName(b);
  return (tokensA[0] === tokensB[0] && tokensA[1] === tokensB[1])
      || (tokensA[0] === tokensB[1] && tokensA[1] === tokensB[0]);
}

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

    case 'Count in Window':
    case 'Swap Count': {
      const windowMs = WINDOW_MS[condition.window || '5m'];
      const cutoff = swap.timestamp - windowMs;
      const count = recent.filter(s => s.timestamp >= cutoff).length + 1;
      const met = compare(count, condition.operator, threshold);
      return { met, description: `Swap Count in ${condition.window || '5m'}: ${count} ${condition.operator} ${threshold}` };
    }

    case 'Volume': {
      const windowMs = WINDOW_MS[condition.window || '5m'];
      const cutoff = swap.timestamp - windowMs;
      const total = recent
        .filter(s => s.timestamp >= cutoff)
        .reduce((sum, s) => sum + s.volumeUSD, 0) + swap.volumeUSD;
      const met = compare(total, condition.operator, threshold);
      return { met, description: `Volume in ${condition.window || '5m'}: ${formatUSD(total)} ${condition.operator} ${formatUSD(threshold)}` };
    }

    default:
      return { met: false, description: `Unknown condition: ${condition.field}` };
  }
}

function buildProposedAction(a: RuleAction): string {
  switch (a.type) {
    case 'Create Alert': return a.config.message || 'Alert triggered';
    case 'Swap': return `Swap ${a.config.amount || '?'} ${a.config.token || 'token'}`;
    default: return a.type;
  }
}

let lastRuleCount = -1;

async function loadEnabledRules(): Promise<DbRule[]> {
  if (!DB_ENABLED || !supabase) return [];
  const { data, error } = await supabase.from('rules').select('*').eq('enabled', true);
  if (error) { logError('rule-engine', `Load rules: ${error.message}`); return []; }
  const rules = (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    pool: r.pool,
    chain: r.chain || 'eth',
    conditionLogic: (r.condition_logic || 'AND') as 'AND' | 'OR',
    conditions: r.conditions as RuleCondition[],
    actions: r.actions as RuleAction[],
  }));

  if (rules.length !== lastRuleCount) {
    lastRuleCount = rules.length;
    const summary = rules.map(r => `"${r.name}" (${r.chain}:${r.pool}, ${r.conditions.length} cond, ${r.actions.length} act)`).join(', ');
    log('rule-engine', `[RULES LOADED] ${rules.length} enabled: [${summary}]`);
  }

  return rules;
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
    logDebug('rule-engine', `  [SKIP INSERT] "${rule.name}" — pending action already exists`);
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
    logError('rule-engine', `  [INSERT FAILED] ${error.message}`);
  } else {
    log('rule-engine', `  [INSERT OK] Action created for "${rule.name}"`);
  }
}

async function logActiveRules() {
  const rules = await loadEnabledRules();
  if (rules.length === 0) {
    log('rule-engine', 'Active rules: none');
    return;
  }
  const byChain = new Map<string, DbRule[]>();
  for (const r of rules) {
    const list = byChain.get(r.chain) ?? [];
    list.push(r);
    byChain.set(r.chain, list);
  }
  const summary = Array.from(byChain.entries())
    .map(([chain, rs]) => {
      const pools = [...new Set(rs.map(r => r.pool))];
      return `${chain}: ${rs.length} rule(s) on [${pools.join(', ')}]`;
    })
    .join(' | ');
  log('rule-engine', `Active rules: ${rules.length} total — ${summary}`);
}

async function evaluateRules(matchingRules: DbRule[], swap: SwapRecord, poolKey: string, chain: string) {
  if (matchingRules.length === 0) return;

  const recent = getRecent(poolKey);
  logDebug('rule-engine', `[CHECK] ${chain}:${swap.pool} | price=$${swap.price.toLocaleString()} vol=$${swap.volumeUSD.toFixed(2)} | ${matchingRules.length} rule(s) | ${recent.length} recent`);

  for (const rule of matchingRules) {
    const lastFired = cooldowns.get(rule.id) || 0;
    const sinceLast = Date.now() - lastFired;
    if (sinceLast < COOLDOWN_MS) {
      logDebug('rule-engine', `  [SKIP] "${rule.name}" — cooldown (${Math.round((COOLDOWN_MS - sinceLast) / 1000)}s left)`);
      continue;
    }

    if (rule.conditions.length === 0) {
      log('rule-engine', `  [WARN] "${rule.name}" — no conditions defined, auto-passes`);
    }

    const results = rule.conditions.map(c => evaluateCondition(c, swap, recent));
    const logic = rule.conditionLogic || 'AND';
    const passed = results.length === 0
      || (logic === 'AND' ? results.every(r => r.met) : results.some(r => r.met));

    if (!passed) {
      logDebug('rule-engine', `  [NOT TRIGGERED] "${rule.name}" — ${results.filter(r => !r.met).length}/${results.length} failed (${logic})`);
      continue;
    }

    cooldowns.set(rule.id, Date.now());

    const conditionsMet = results.filter(r => r.met).map(r => r.description);
    const proposedActions = rule.actions.map(buildProposedAction);

    log('rule-engine', `[TRIGGERED] "${rule.name}" — ${conditionsMet.join(' | ')} → [${proposedActions.join(', ')}]`);
    await insertAction(rule, swap, conditionsMet, proposedActions);
  }
}

function findLatestSwapForPool(chain: string, pool: string): { swap: SwapRecord; poolKey: string } | null {
  for (const [poolKey, swaps] of recentSwaps.entries()) {
    if (swaps.length === 0) continue;
    const [keyChain, keyPool] = poolKey.split(':', 2);
    if (keyChain !== chain) continue;

    if (chain === 'monad' ? keyPool.toLowerCase() === pool.toLowerCase() : poolsMatch(keyPool, pool)) {
      return { swap: swaps[swaps.length - 1], poolKey };
    }
  }
  return null;
}

async function seedPoolIfEmpty(chain: string, pool: string): Promise<boolean> {
  for (const [poolKey] of recentSwaps) {
    const [keyChain, keyPool] = poolKey.split(':', 2);
    if (keyChain !== chain) continue;
    if (chain === 'monad' ? keyPool.toLowerCase() === pool.toLowerCase() : poolsMatch(keyPool, pool)) return true;
  }

  const sinceMs = Date.now() - 3_600_000;

  if (chain === 'eth') {
    for (const poolName of tracker.trackedPools()) {
      if (!poolsMatch(poolName, pool)) continue;
      let swaps = tracker.getSwaps(poolName);
      if (swaps.length === 0) swaps = await dbQuerySwaps(poolName, sinceMs);
      if (swaps.length === 0) continue;
      const poolKey = `eth:${poolName}`;
      recentSwaps.set(poolKey, swaps.slice(-RECENT_BUFFER_SIZE));
      logDebug('rule-engine', `[SEED] Loaded ${swaps.length} swap(s) for ${poolKey}`);
      return true;
    }
    const dbSwaps = await dbQuerySwaps(pool, sinceMs);
    if (dbSwaps.length > 0) {
      const poolKey = `eth:${pool}`;
      recentSwaps.set(poolKey, dbSwaps.slice(-RECENT_BUFFER_SIZE));
      logDebug('rule-engine', `[SEED] Loaded ${dbSwaps.length} swap(s) from DB for ${poolKey}`);
      return true;
    }
  } else if (chain === 'monad') {
    for (const tokenAddr of monadTracker.trackedTokens()) {
      if (tokenAddr.toLowerCase() !== normalizedTarget) continue;
      const swaps = monadTracker.getSwaps(tokenAddr);
      if (swaps.length === 0) continue;
      const poolKey = `monad:${tokenAddr.toLowerCase()}`;
      const converted: SwapRecord[] = swaps.slice(-RECENT_BUFFER_SIZE).map(s => ({
        pool: s.token,
        blockNumber: s.blockNumber,
        price: s.price,
        volumeUSD: s.volumeMON,
        feeUSD: 0,
        txHash: s.txHash,
        timestamp: s.timestamp,
      }));
      recentSwaps.set(poolKey, converted);
      logDebug('rule-engine', `[SEED] Loaded ${converted.length} swap(s) for ${poolKey}`);
      return true;
    }
  }

  return false;
}

export async function checkRuleNow(ruleId?: string) {
  const rules = await loadEnabledRules();
  const targets = ruleId ? rules.filter(r => r.id === ruleId) : rules;

  if (targets.length === 0) {
    log('rule-engine', `[IMMEDIATE] No enabled rules to check${ruleId ? ` (id=${ruleId.slice(0, 8)})` : ''}`);
    return;
  }

  for (const rule of targets) {
    let match = findLatestSwapForPool(rule.chain, rule.pool);
    if (!match) {
      await seedPoolIfEmpty(rule.chain, rule.pool);
      match = findLatestSwapForPool(rule.chain, rule.pool);
    }
    if (!match) {
      logDebug('rule-engine', `[IMMEDIATE] "${rule.name}" — no swap data for ${rule.chain}:${rule.pool}`);
      continue;
    }

    logDebug('rule-engine', `[IMMEDIATE] Checking "${rule.name}" on ${rule.chain}:${rule.pool}`);
    await evaluateRules([rule], match.swap, match.poolKey, rule.chain);
  }
}

async function seedRecentFromTrackers() {
  let seeded = 0;
  const sinceMs = Date.now() - 3_600_000;

  for (const poolName of tracker.trackedPools()) {
    let swaps = tracker.getSwaps(poolName);
    if (swaps.length === 0) {
      swaps = await dbQuerySwaps(poolName, sinceMs);
      if (swaps.length > 0) {
        logDebug('rule-engine', `[SEED] ${poolName}: loaded ${swaps.length} swaps from DB`);
      }
    }
    if (swaps.length === 0) continue;
    const poolKey = `eth:${poolName}`;
    const recent = swaps.slice(-RECENT_BUFFER_SIZE);
    recentSwaps.set(poolKey, recent);
    seeded += recent.length;
  }

  for (const tokenAddr of monadTracker.trackedTokens()) {
    const swaps = monadTracker.getSwaps(tokenAddr);
    if (swaps.length === 0) continue;
    const poolKey = `monad:${tokenAddr.toLowerCase()}`;
    const converted: SwapRecord[] = swaps.slice(-RECENT_BUFFER_SIZE).map(s => ({
      pool: s.token,
      blockNumber: s.blockNumber,
      price: s.price,
      volumeUSD: s.volumeMON,
      feeUSD: 0,
      txHash: s.txHash,
      timestamp: s.timestamp,
    }));
    recentSwaps.set(poolKey, converted);
    seeded += converted.length;
  }

  return seeded;
}

export function startRuleEngine() {
  if (!DB_ENABLED) {
    log('rule-engine', 'DB disabled — rule engine not started');
    return;
  }

  setTimeout(async () => {
    const seeded = await seedRecentFromTrackers();
    log('rule-engine', `[STARTUP] Seeded ${seeded} recent swaps from tracker data across ${recentSwaps.size} pool(s)`);
    await logActiveRules();
    log('rule-engine', `[STARTUP] Running immediate check on all enabled rules...`);
    await checkRuleNow();
  }, 3000);
  setInterval(() => logActiveRules(), 60_000);

  tracker.on('swap', async (swap: SwapRecord) => {
    const poolKey = `eth:${swap.pool}`;
    pushRecent(poolKey, swap);

    const rules = await loadEnabledRules();
    const ethRules = rules.filter(r => r.chain === 'eth');
    const matchingRules = ethRules.filter(r => poolsMatch(r.pool, swap.pool));

    if (ethRules.length > 0 && matchingRules.length === 0) {
      logDebug('rule-engine', `[NO MATCH] ETH swap on "${swap.pool}" — rules target [${[...new Set(ethRules.map(r => r.pool))].join(', ')}]`);
    }

    await evaluateRules(matchingRules, swap, poolKey, 'eth');
  });

  monadTracker.on('swap', async (monadSwap: MonadSwapRecord) => {
    const rules = await loadEnabledRules();
    const monadRules = rules.filter(r => r.chain === 'monad');
    const matchingRules = monadRules.filter(r =>
      r.pool.toLowerCase() === monadSwap.token.toLowerCase(),
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

    if (monadRules.length > 0 && matchingRules.length === 0) {
      logDebug('rule-engine', `[NO MATCH] Monad swap on "${monadSwap.token}" — rules target [${[...new Set(monadRules.map(r => r.pool))].join(', ')}]`);
    }

    if (matchingRules.length === 0) return;
    await evaluateRules(matchingRules, swapRecord, poolKey, 'monad');
  });

  log('rule-engine', 'Server-side rule engine started — evaluating all conditions on every swap (ETH + Monad)');
}
