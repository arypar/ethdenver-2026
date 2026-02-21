import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';
import { checkRuleNow } from '../lib/rule-engine.js';

const router = Router();

router.get('/rules', async (_req, res) => {
  if (!DB_ENABLED || !supabase) { res.json([]); return; }

  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { logError('rules', `Load: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  const rules = (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: { type: 'Swap', pool: row.pool, chain: row.chain || 'eth' },
    conditions: row.conditions,
    conditionLogic: row.condition_logic || 'AND',
    actions: row.actions,
    createdAt: new Date(row.created_at).getTime(),
  }));

  const enabled = rules.filter(r => r.enabled).length;
  log('rules', `GET /rules — ${rules.length} total (${enabled} enabled)`);
  res.json(rules);
});

router.post('/rules', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id, name, enabled, trigger, conditions, conditionLogic, actions } = req.body;

  log('rules', `POST /rules — "${name}" on ${trigger?.chain || 'eth'}:${trigger?.pool} (${(conditions || []).length} cond, ${(actions || []).length} act)`);

  if (!trigger?.pool) {
    logError('rules', `  REJECTED — missing pool in trigger`);
    res.status(400).json({ error: 'Missing pool' });
    return;
  }

  const chain = trigger.chain || 'eth';
  const baseRow = {
    id: id || undefined,
    name: name || 'Untitled Rule',
    enabled: enabled ?? true,
    pool: trigger.pool,
    chain,
    conditions: conditions || [],
    actions: actions || [],
  };

  let { error } = await supabase.from('rules').upsert(
    { ...baseRow, condition_logic: conditionLogic || 'AND' },
    { onConflict: 'id' },
  );

  if (error?.message?.includes('condition_logic')) {
    log('rules', `  condition_logic column missing, retrying without it`);
    ({ error } = await supabase.from('rules').upsert(baseRow, { onConflict: 'id' }));
  }

  if (error) { logError('rules', `  SAVE FAILED: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  log('rules', `  SAVED OK — rule "${name}" on ${chain}:${trigger.pool} (id=${id?.slice(0, 8) || 'new'})`);
  res.json({ ok: true });

  if ((enabled ?? true) && id) {
    checkRuleNow(id).catch(() => {});
  }
});

router.patch('/rules/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id } = req.params;
  const updates: Record<string, any> = {};

  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
  if (req.body.trigger?.pool !== undefined) updates.pool = req.body.trigger.pool;
  if (req.body.trigger?.chain !== undefined) updates.chain = req.body.trigger.chain;
  if (req.body.conditions !== undefined) updates.conditions = req.body.conditions;
  if (req.body.conditionLogic !== undefined) updates.condition_logic = req.body.conditionLogic;
  if (req.body.actions !== undefined) updates.actions = req.body.actions;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  log('rules', `PATCH /rules/${id.slice(0, 8)} — fields: [${Object.keys(updates).join(', ')}]${updates.enabled !== undefined ? ` enabled→${updates.enabled}` : ''}`);

  let { error } = await supabase.from('rules').update(updates).eq('id', id);

  if (error?.message?.includes('condition_logic')) {
    delete updates.condition_logic;
    if (Object.keys(updates).length > 0) {
      ({ error } = await supabase.from('rules').update(updates).eq('id', id));
    } else {
      error = null;
    }
  }

  if (error) { logError('rules', `  UPDATE FAILED ${id.slice(0, 8)}: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  log('rules', `  UPDATED OK — ${id.slice(0, 8)}`);
  res.json({ ok: true });

  if (updates.enabled !== false) {
    checkRuleNow(id).catch(() => {});
  }
});

router.delete('/rules/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id } = req.params;
  log('rules', `DELETE /rules/${id.slice(0, 8)}`);
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) { logError('rules', `  DELETE FAILED ${id.slice(0, 8)}: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  log('rules', `  DELETED OK — ${id.slice(0, 8)}`);
  res.json({ ok: true });
});

export default router;
