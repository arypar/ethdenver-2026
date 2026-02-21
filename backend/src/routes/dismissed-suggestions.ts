import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log, logError } from '../lib/log.js';

const router = Router();

router.get('/dismissed-suggestions', async (_req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.json([]);
    return;
  }

  const { data, error } = await supabase
    .from('dismissed_suggestions')
    .select('pool_name')
    .order('dismissed_at', { ascending: false });

  if (error) {
    logError('dismissed', `Load: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  const pools = (data ?? []).map(r => r.pool_name);
  log('dismissed', `Loaded ${pools.length} dismissed suggestions`);
  res.json(pools);
});

router.post('/dismissed-suggestions', async (req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const { pool } = req.body;
  if (!pool || typeof pool !== 'string') {
    res.status(400).json({ error: 'Missing pool name' });
    return;
  }

  const { error } = await supabase
    .from('dismissed_suggestions')
    .upsert({ pool_name: pool }, { onConflict: 'pool_name' });

  if (error) {
    logError('dismissed', `Dismiss ${pool}: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  log('dismissed', `Dismissed suggestion: ${pool}`);
  res.json({ ok: true });
});

export default router;
