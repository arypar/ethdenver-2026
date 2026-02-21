import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';

const router = Router();

router.get('/actions', async (_req, res) => {
  if (!DB_ENABLED || !supabase) { res.json([]); return; }

  const { data, error } = await supabase
    .from('rule_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) { logError('actions', `Load: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  const actions = (data ?? []).map(row => ({
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    status: row.status,
    triggerReason: row.trigger_reason,
    suggestedAction: row.suggested_action,
    timestamp: new Date(row.created_at).getTime(),
    source: row.source,
    details: row.details,
  }));

  res.json(actions);
});

router.patch('/actions/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { id } = req.params;
  const { status } = req.body;
  if (!status) { res.status(400).json({ error: 'Missing status' }); return; }

  const { error } = await supabase.from('rule_actions').update({ status }).eq('id', id);
  if (error) { logError('actions', `Update ${id}: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  res.json({ ok: true });
});

router.delete('/actions', async (_req, res) => {
  if (!DB_ENABLED || !supabase) { res.status(503).json({ error: 'DB not configured' }); return; }

  const { error } = await supabase.from('rule_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) { logError('actions', `Clear all: ${error.message}`); res.status(500).json({ error: error.message }); return; }

  log('actions', 'Cleared all actions');
  res.json({ ok: true });
});

export default router;
