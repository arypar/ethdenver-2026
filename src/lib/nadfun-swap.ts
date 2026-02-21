import { parseEther, formatEther, encodeFunctionData, type Abi } from 'viem';

export const NADFUN_CONTRACTS = {
  BONDING_CURVE_ROUTER: '0x6F6B8F1a20703309951a5127c45B49b1CD981A22' as const,
  DEX_ROUTER: '0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137' as const,
  BONDING_CURVE: '0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE' as const,
  LENS: '0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea' as const,
  WMON: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' as const,
} as const;

export const MONAD_CHAIN_ID = 143;

export const LENS_ABI = [
  {
    type: 'function', name: 'getAmountOut', stateMutability: 'view',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amountIn', type: 'uint256' },
      { name: '_isBuy', type: 'bool' },
    ],
    outputs: [
      { name: 'router', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'isGraduated', stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: 'isGraduated', type: 'bool' }],
  },
  {
    type: 'function', name: 'isLocked', stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: 'isLocked', type: 'bool' }],
  },
  {
    type: 'function', name: 'getProgress', stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: 'progress', type: 'uint256' }],
  },
] as const satisfies Abi;

export const BONDING_CURVE_ROUTER_ABI = [
  {
    type: 'function', name: 'buy', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [],
  },
  {
    type: 'function', name: 'sell', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [],
  },
] as const satisfies Abi;

export const DEX_ROUTER_ABI = [
  {
    type: 'function', name: 'buy', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function', name: 'sell', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const satisfies Abi;

export const ERC20_APPROVE_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const satisfies Abi;

export interface NadfunQuote {
  router: `0x${string}`;
  amountOut: bigint;
  amountOutFormatted: string;
  isBondingCurve: boolean;
  isGraduated: boolean;
  slippageAmountOut: bigint;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getNadfunQuote(
  tokenAddress: string,
  amountIn: string,
  isBuy: boolean,
  slippagePct = 1,
): Promise<NadfunQuote> {
  const res = await fetch(`${API_BASE}/nadfun/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenAddress, amountIn, isBuy }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Quote failed (${res.status})`);

  const amountOut = BigInt(data.amountOut);
  const slippageAmountOut = (amountOut * BigInt(100 - slippagePct)) / BigInt(100);

  return {
    router: data.router as `0x${string}`,
    amountOut,
    amountOutFormatted: formatEther(amountOut),
    isBondingCurve: data.router.toLowerCase() === NADFUN_CONTRACTS.BONDING_CURVE_ROUTER.toLowerCase(),
    isGraduated: data.isGraduated ?? false,
    slippageAmountOut,
  };
}

export function buildBuyTx(
  quote: NadfunQuote,
  tokenAddress: `0x${string}`,
  to: `0x${string}`,
  amountInWei: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const abi = quote.isBondingCurve ? BONDING_CURVE_ROUTER_ABI : DEX_ROUTER_ABI;
  const data = encodeFunctionData({
    abi,
    functionName: 'buy',
    args: [{ amountOutMin: quote.slippageAmountOut, token: tokenAddress, to, deadline }],
  });
  return { to: quote.router, data, value: amountInWei };
}

export function buildSellTx(
  quote: NadfunQuote,
  tokenAddress: `0x${string}`,
  to: `0x${string}`,
  amountInWei: bigint,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const abi = quote.isBondingCurve ? BONDING_CURVE_ROUTER_ABI : DEX_ROUTER_ABI;
  const data = encodeFunctionData({
    abi,
    functionName: 'sell',
    args: [{ amountIn: amountInWei, amountOutMin: quote.slippageAmountOut, token: tokenAddress, to, deadline }],
  });
  return { to: quote.router, data, value: BigInt(0) };
}

export function buildApproveTx(
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
): { to: `0x${string}`; data: `0x${string}` } {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [spender, amount],
  });
  return { to: tokenAddress, data };
}
