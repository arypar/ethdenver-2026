import { Router } from 'express';
import { resolvePool, getCachedPool, getAllCachedPools } from '../lib/pool-cache.js';
import { log } from '../lib/log.js';

const router = Router();

router.post('/resolve-pool', async (req, res) => {
  const { tokenA, tokenB } = req.body as { tokenA?: string; tokenB?: string };

  if (!tokenA || !tokenB) {
    res.status(400).json({ error: 'tokenA and tokenB are required' });
    return;
  }

  try {
    log('resolve-pool', `Resolving ${tokenA}/${tokenB}...`);
    const meta = await resolvePool(tokenA, tokenB);
    log('resolve-pool', `Resolved ${tokenA}/${tokenB} → ${meta.address} (fee: ${meta.feeTier})`);

    res.json({
      pool: `${tokenA.toUpperCase()}/${tokenB.toUpperCase()}`,
      poolAddress: meta.address,
      token0: { symbol: meta.token0Symbol, address: meta.token0Address, decimals: meta.decimals0 },
      token1: { symbol: meta.token1Symbol, address: meta.token1Address, decimals: meta.decimals1 },
      feeTier: meta.feeTier,
      invert: meta.invert,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resolution failed';
    res.status(400).json({ error: message });
  }
});

router.get('/pools', (_req, res) => {
  res.json({ pools: getAllCachedPools() });
});

router.get('/pool-meta', (req, res) => {
  const pool = req.query.pool as string;
  if (!pool) {
    res.status(400).json({ error: 'pool query param required' });
    return;
  }
  const meta = getCachedPool(pool);
  if (!meta) {
    res.status(404).json({ error: `Pool "${pool}" not in cache. Call POST /uniswap/resolve-pool first.` });
    return;
  }
  res.json(meta);
});

export default router;
