import { Router } from 'express';
import { log } from '../lib/log.js';

const router = Router();
const TRADING_API = 'https://trade-api.gateway.uniswap.org/v1';

router.post('/check-approval', async (req, res) => {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'UNISWAP_API_KEY not configured' });
    return;
  }

  try {
    log('check-approval', `token=${req.body.token?.slice(0, 10)}... wallet=${req.body.walletAddress?.slice(0, 10)}...`);
    const upstream = await fetch(`${TRADING_API}/check_approval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
