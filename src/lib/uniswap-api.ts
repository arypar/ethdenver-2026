import type { Pool } from './types';
import { getCachedPoolTokens, cachePoolTokens, parsePoolName, type TokenInfo, type PoolTokens } from './tokens';

export interface QuoteParams {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: string;
  tokenOutChainId: string;
  amount: string;
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  slippageTolerance?: number;
  routingPreference?: 'BEST_PRICE' | 'FASTEST' | 'CLASSIC';
}

export interface QuoteResponse {
  routing: string;
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string };
    slippage: number;
    route: unknown[];
    gasFee: string;
    gasFeeUSD: string;
    gasUseEstimate: string;
  };
  permitData?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SwapResponse {
  swap: {
    to: string;
    from: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
}

export interface ApprovalResponse {
  approval: {
    to: string;
    from: string;
    data: string;
    value: string;
    chainId: number;
  } | null;
}

export interface ResolvedPool {
  pool: string;
  poolAddress: string;
  token0: { symbol: string; address: string; decimals: number };
  token1: { symbol: string; address: string; decimals: number };
  feeTier: number;
  invert: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.detail || `API error ${res.status}`);
  }
  return data as T;
}

const resolveCache = new Map<string, ResolvedPool>();

export async function resolvePool(pool: Pool): Promise<ResolvedPool> {
  const upper = pool.toUpperCase();
  const cached = resolveCache.get(upper);
  if (cached) return cached;

  const { tokenASymbol, tokenBSymbol } = parsePoolName(upper);
  const resolved = await apiPost<ResolvedPool>('/uniswap/resolve-pool', {
    tokenA: tokenASymbol,
    tokenB: tokenBSymbol,
  });

  resolveCache.set(upper, resolved);

  if (!getCachedPoolTokens(upper)) {
    cachePoolTokens(upper, {
      tokenA: { symbol: tokenASymbol, address: resolved.invert ? resolved.token1.address as `0x${string}` : resolved.token0.address as `0x${string}`, decimals: resolved.invert ? resolved.token1.decimals : resolved.token0.decimals },
      tokenB: { symbol: tokenBSymbol, address: resolved.invert ? resolved.token0.address as `0x${string}` : resolved.token1.address as `0x${string}`, decimals: resolved.invert ? resolved.token0.decimals : resolved.token1.decimals },
      chainId: 1,
    });
  }

  return resolved;
}

export async function getOrResolvePoolTokens(pool: Pool): Promise<PoolTokens> {
  const cached = getCachedPoolTokens(pool.toUpperCase());
  if (cached) return cached;
  await resolvePool(pool);
  return getCachedPoolTokens(pool.toUpperCase())!;
}

export async function getQuote(params: QuoteParams): Promise<QuoteResponse> {
  return apiPost<QuoteResponse>('/uniswap/quote', {
    ...params,
    slippageTolerance: params.slippageTolerance ?? 0.5,
    routingPreference: params.routingPreference ?? 'BEST_PRICE',
  });
}

export async function getSwap(
  quoteResponse: QuoteResponse,
  permit2Signature?: string,
): Promise<SwapResponse> {
  const { permitData, ...cleanQuote } = quoteResponse;

  const swapRequest: Record<string, unknown> = { ...cleanQuote };

  if (permit2Signature && permitData && typeof permitData === 'object') {
    swapRequest.signature = permit2Signature;
    swapRequest.permitData = permitData;
  }

  const data = await apiPost<SwapResponse>('/uniswap/swap', swapRequest);

  if (!data.swap?.data || data.swap.data === '' || data.swap.data === '0x') {
    throw new Error('Empty swap data — quote may have expired. Please refresh.');
  }

  return data;
}

export async function checkApproval(params: {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
}): Promise<ApprovalResponse> {
  return apiPost<ApprovalResponse>('/uniswap/check-approval', params);
}

export async function buildQuoteParams(
  swapper: string,
  pool: Pool,
  direction: 'AtoB' | 'BtoA',
  amount: string,
): Promise<QuoteParams> {
  const { tokenA, tokenB, chainId } = await getOrResolvePoolTokens(pool);
  const isAtoB = direction === 'AtoB';
  const tokenIn = isAtoB ? tokenA : tokenB;
  const tokenOut = isAtoB ? tokenB : tokenA;

  return {
    swapper,
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    tokenInChainId: String(chainId),
    tokenOutChainId: String(chainId),
    amount,
    type: 'EXACT_INPUT',
  };
}

export function formatTokenAmount(amount: string, token: TokenInfo): string {
  const raw = BigInt(amount);
  const divisor = BigInt(10 ** token.decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(token.decimals, '0').slice(0, 6).replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export function parseTokenAmount(amount: string, decimals: number): string {
  const [whole, frac = ''] = amount.split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFrac).toString();
}
