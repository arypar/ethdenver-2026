import { Router } from 'express';
import { log, logError } from '../lib/log.js';

const router = Router();
const TRADING_API = 'https://trade-api.gateway.uniswap.org/v1';

interface PoolDataRequest {
  tokenA: string;
  tokenB: string;
  decimalsA: number;
  decimalsB: number;
}

router.post('/pool-data', async (req, res) => {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'UNISWAP_API_KEY not configured' });
    return;
  }

  try {
    const { tokenA, tokenB, decimalsA, decimalsB } = req.body as PoolDataRequest;
    log('pool-data', `Fetching price for ${tokenA?.slice(0, 10)}... / ${tokenB?.slice(0, 10)}...`);

    const oneUnit = BigInt(10 ** decimalsA).toString();

    const upstream = await fetch(`${TRADING_API}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify({
        swapper: '0x0000000000000000000000000000000000000001',
        tokenIn: tokenA,
        tokenOut: tokenB,
        tokenInChainId: '1',
        tokenOutChainId: '1',
        amount: oneUnit,
        type: 'EXACT_INPUT',
        slippageTolerance: 0.5,
        routingPreference: 'BEST_PRICE',
        protocols: ['V3', 'V2'],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      const errMsg = err.detail || err.errorCode || 'Quote failed';
      logError('pool-data', `Upstream quote failed (${upstream.status}): ${errMsg}`);
      res.status(upstream.status).json({ error: errMsg });
      return;
    }

    const data = await upstream.json();

    const outputRaw = BigInt(data.quote.output.amount);
    const outputDivisor = BigInt(10 ** decimalsB);
    const priceWhole = Number(outputRaw / outputDivisor);
    const priceFrac = Number(outputRaw % outputDivisor) / Number(outputDivisor);
    const price = priceWhole + priceFrac;

    const gasFee = data.quote.gasFeeUSD || '0';
    log('pool-data', `${tokenA?.slice(0, 10)}.../${tokenB?.slice(0, 10)}... → price $${price.toFixed(6)} | gas $${gasFee} | route: ${data.routing || 'unknown'}`);

    res.json({
      price,
      gasFeeUSD: gasFee,
      routing: data.routing,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('pool-data', `Error fetching pool data: ${message}`);
    res.status(500).json({ error: message });
  }
});

export default router;
