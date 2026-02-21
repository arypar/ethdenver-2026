import { Router } from 'express';
import { createPublicClient, http, parseEther, formatEther, defineChain } from 'viem';
import { logDebug, logError } from '../lib/log.js';
import { monadTracker } from '../lib/monad-tracker.js';

const router = Router();

const MONAD_RPC = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';

const monadChain = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
});

const rpc = createPublicClient({
  chain: monadChain,
  transport: http(MONAD_RPC),
});

const LENS = '0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea' as const;
const BONDING_CURVE_ROUTER = '0x6F6B8F1a20703309951a5127c45B49b1CD981A22' as const;

const LENS_ABI = [
  {
    type: 'function' as const, name: 'getAmountOut' as const, stateMutability: 'view' as const,
    inputs: [
      { name: '_token', type: 'address' as const },
      { name: '_amountIn', type: 'uint256' as const },
      { name: '_isBuy', type: 'bool' as const },
    ],
    outputs: [
      { name: 'router', type: 'address' as const },
      { name: 'amountOut', type: 'uint256' as const },
    ],
  },
  {
    type: 'function' as const, name: 'isGraduated' as const, stateMutability: 'view' as const,
    inputs: [{ name: '_token', type: 'address' as const }],
    outputs: [{ name: 'isGraduated', type: 'bool' as const }],
  },
  {
    type: 'function' as const, name: 'isLocked' as const, stateMutability: 'view' as const,
    inputs: [{ name: '_token', type: 'address' as const }],
    outputs: [{ name: 'isLocked', type: 'bool' as const }],
  },
  {
    type: 'function' as const, name: 'getProgress' as const, stateMutability: 'view' as const,
    inputs: [{ name: '_token', type: 'address' as const }],
    outputs: [{ name: 'progress', type: 'uint256' as const }],
  },
] as const;

router.post('/quote', async (req, res) => {
  try {
    const { token, amountIn, isBuy } = req.body;
    if (!token || !amountIn) {
      res.status(400).json({ error: 'token and amountIn are required' });
      return;
    }

    const amountInWei = parseEther(amountIn.toString());
    logDebug('nadfun', `Quote: ${isBuy ? 'BUY' : 'SELL'} ${token.slice(0, 10)}... amountIn=${amountIn}`);

    const [quoteResult, graduated, locked] = await Promise.all([
      rpc.readContract({
        address: LENS,
        abi: LENS_ABI,
        functionName: 'getAmountOut',
        args: [token as `0x${string}`, amountInWei, isBuy],
      }),
      rpc.readContract({
        address: LENS,
        abi: LENS_ABI,
        functionName: 'isGraduated',
        args: [token as `0x${string}`],
      }),
      rpc.readContract({
        address: LENS,
        abi: LENS_ABI,
        functionName: 'isLocked',
        args: [token as `0x${string}`],
      }),
    ]);

    const [routerAddr, amountOut] = quoteResult;
    const isBondingCurve = routerAddr.toLowerCase() === BONDING_CURVE_ROUTER.toLowerCase();

    const meta = monadTracker.getTokenMeta(token);

    logDebug('nadfun', `Quote result: router=${isBondingCurve ? 'BondingCurve' : 'DEX'} amountOut=${formatEther(amountOut)}`);

    res.json({
      router: routerAddr,
      amountOut: amountOut.toString(),
      amountOutFormatted: formatEther(amountOut),
      isBondingCurve,
      isGraduated: graduated,
      isLocked: locked,
      tokenSymbol: meta?.symbol ?? null,
      tokenName: meta?.name ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('nadfun', `Quote error: ${message}`);
    res.status(500).json({ error: message });
  }
});

router.post('/token-info', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ error: 'token is required' }); return; }

    const [graduated, locked, progress] = await Promise.all([
      rpc.readContract({ address: LENS, abi: LENS_ABI, functionName: 'isGraduated', args: [token as `0x${string}`] }),
      rpc.readContract({ address: LENS, abi: LENS_ABI, functionName: 'isLocked', args: [token as `0x${string}`] }),
      rpc.readContract({ address: LENS, abi: LENS_ABI, functionName: 'getProgress', args: [token as `0x${string}`] }),
    ]);

    const meta = monadTracker.getTokenMeta(token);

    res.json({
      isGraduated: graduated,
      isLocked: locked,
      progressBps: Number(progress),
      progressPct: (Number(progress) / 100).toFixed(2),
      symbol: meta?.symbol ?? null,
      name: meta?.name ?? null,
      imageUrl: meta?.image_url ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('nadfun', `Token info error: ${message}`);
    res.status(500).json({ error: message });
  }
});

export default router;
