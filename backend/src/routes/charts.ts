import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { tracker } from '../lib/pool-tracker.js';
import { monadTracker } from '../lib/monad-tracker.js';
import { log, logError } from '../lib/log.js';

const router = Router();

router.get('/charts', async (req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.json([]);
    return;
  }

  const chainFilter = req.query.chain as string | undefined;

  let query = supabase
    .from('dashboard_charts')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (chainFilter) query = query.eq('chain', chainFilter);

  const { data, error } = await query;

  if (error) {
    logError('charts', `Load: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  const charts = (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    config: {
      metric: row.metric,
      pool: row.pool_name,
      range: row.time_range,
      chartType: row.chart_type,
      chain: row.chain || 'eth',
      ...(row.pool_address ? { poolAddress: row.pool_address } : {}),
    },
    createdAt: new Date(row.created_at).getTime(),
  }));

  log('charts', `Loaded ${charts.length} charts from DB${chainFilter ? ` (chain=${chainFilter})` : ''}`);
  res.json(charts);
});

router.post('/charts', async (req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const { id, title, config } = req.body;
  if (!id || !config?.metric || !config?.pool || !config?.range) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const chain = config.chain || 'eth';

  if (config.metric !== 'Liquidity') {
    if (chain === 'monad') {
      await monadTracker.track(config.pool);
    } else {
      await tracker.track(config.pool);
    }
  }

  const { error } = await supabase.from('dashboard_charts').upsert({
    id,
    pool_name: config.pool,
    metric: config.metric,
    time_range: config.range,
    chart_type: config.chartType || 'area',
    title: title || `${config.pool} ${config.metric}`,
    chain,
    ...(config.poolAddress ? { pool_address: config.poolAddress } : {}),
  }, { onConflict: 'id' });

  if (error) {
    logError('charts', `Save: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  log('charts', `Saved chart ${id} — ${config.pool} ${config.metric} ${config.range}`);
  res.json({ ok: true });
});

router.patch('/charts/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const { id } = req.params;
  const updates: Record<string, any> = {};

  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.position !== undefined) updates.position = req.body.position;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  const { error } = await supabase
    .from('dashboard_charts')
    .update(updates)
    .eq('id', id);

  if (error) {
    logError('charts', `Update ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  log('charts', `Updated chart ${id}`);
  res.json({ ok: true });
});

router.delete('/charts/:id', async (req, res) => {
  if (!DB_ENABLED || !supabase) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const { id } = req.params;
  const { error } = await supabase
    .from('dashboard_charts')
    .delete()
    .eq('id', id);

  if (error) {
    logError('charts', `Delete ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
    return;
  }

  log('charts', `Deleted chart ${id}`);
  res.json({ ok: true });
});

export default router;
