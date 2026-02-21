export interface TokenInfo {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

export interface PoolTokens {
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  chainId: number;
}

export const WELL_KNOWN_POOLS = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'LINK/ETH'] as const;

export const TOKENS: Record<string, TokenInfo> = {
  WETH: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  USDC: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  WBTC: { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  UNI:  { symbol: 'UNI',  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  LINK: { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  ETH:  { symbol: 'ETH',  address: '0x0000000000000000000000000000000000000000', decimals: 18 },
};

const poolTokensCache = new Map<string, PoolTokens>([
  ['WETH/USDC', { tokenA: TOKENS.WETH, tokenB: TOKENS.USDC, chainId: 1 }],
  ['WBTC/ETH',  { tokenA: TOKENS.WBTC, tokenB: TOKENS.WETH, chainId: 1 }],
  ['UNI/ETH',   { tokenA: TOKENS.UNI,  tokenB: TOKENS.WETH, chainId: 1 }],
  ['LINK/ETH',  { tokenA: TOKENS.LINK, tokenB: TOKENS.WETH, chainId: 1 }],
]);

export function getCachedPoolTokens(pool: string): PoolTokens | undefined {
  return poolTokensCache.get(pool);
}

export function cachePoolTokens(pool: string, tokens: PoolTokens): void {
  poolTokensCache.set(pool, tokens);
}

export function parsePoolName(pool: string): { tokenASymbol: string; tokenBSymbol: string } {
  const [tokenASymbol, tokenBSymbol] = pool.split('/');
  return { tokenASymbol: tokenASymbol ?? '', tokenBSymbol: tokenBSymbol ?? '' };
}
