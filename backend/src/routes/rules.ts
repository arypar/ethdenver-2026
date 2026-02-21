import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';

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
    actions: row.actions,
    createdAt: new Date(row.created_at).getTime(),
  }));

  const enabled = rules.filter(r => r.enabled).length;
  const disabled = rules.length - enabled;
  const pools = [...new Set(rules.map(r => r.trigger.pool))];
  log('rules', `Loaded ${rules.length} rules (${enabled} enabled, ${disabled} disabled) | pools: [${pools.join(', ')}]`);
  for (const r of rules) {
    const condSummary = (r.conditions as any[]).map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(', ') || 'none';
    const actSummary = (r.actions as any[]).map((a: any) => a.type).join(', ') || 'none';
    log('rules', `  ${r.enabled ? '●' : '○'} "${r.name}" on ${r.trigger.pool} | conditions: [${condSummary}] | actions: [${actSummary}]`);
  }
  res.json(rules);
});

router.post('/rules', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id, name, enabled, trigger, conditions, actions } = req.body;
  if (!trigger?.pool) { res.status(400).json({ error: 'Missing pool' }); return; }

  const { error } = await supabase.from('rules').upsert({
    id: id || undefined,
    name: name || 'Untitled Rule',
    enabled: enabled ?? true,
    pool: trigger.pool,
    chain: trigger.chain || 'eth',
    conditions: conditions || [],
    actions: actions || [],
  }, { onConflict: 'id' });

  if (error) { logError('rules', `Save: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  const condSummary = (conditions || []).map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(', ') || 'none';
  const actSummary = (actions || []).map((a: any) => a.type).join(', ') || 'none';
  log('rules', `Saved rule "${name}" on ${trigger.pool} | enabled: ${enabled ?? true} | conditions: [${condSummary}] | actions: [${actSummary}]`);
  res.json({ ok: true });
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
  if (req.body.actions !== undefined) updates.actions = req.body.actions;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  const { error } = await supabase.from('rules').update(updates).eq('id', id);
  if (error) { logError('rules', `Update ${id}: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  const fields = Object.keys(updates).join(', ');
  log('rules', `Updated rule ${id.slice(0, 8)}... | fields: [${fields}]${updates.enabled !== undefined ? ` | enabled → ${updates.enabled}` : ''}`);
  res.json({ ok: true });
});

router.delete('/rules/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id } = req.params;
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) { logError('rules', `Delete ${id}: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  log('rules', `Deleted rule ${id.slice(0, 8)}...`);
  res.json({ ok: true });
});

export default router;
