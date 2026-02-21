import { Router } from 'express';
import { log, logError } from '../lib/log.js';

const router = Router();
const TRADING_API = 'https://trade-api.gateway.uniswap.org/v1';

router.post('/quote', async (req, res) => {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'UNISWAP_API_KEY not configured' });
    return;
  }

  try {
    log('quote', `${req.body.tokenIn?.slice(0, 10)}... → ${req.body.tokenOut?.slice(0, 10)}... amount=${req.body.amount}`);
    const upstream = await fetch(`${TRADING_API}/quote`, {
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
      logError('quote', `Upstream failed (${upstream.status}): ${JSON.stringify(data.detail || data.errorCode || 'unknown')}`);
      res.status(upstream.status).json(data);
      return;
    }

    const outAmt = data.quote?.output?.amount;
    const gasFee = data.quote?.gasFeeUSD || '?';
    log('quote', `${req.body.tokenIn?.slice(0, 10)}... → ${req.body.tokenOut?.slice(0, 10)}... | input ${req.body.amount} | output ${outAmt || '?'} | gas $${gasFee} | route: ${data.routing || 'unknown'}`);

    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('quote', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

export default router;
