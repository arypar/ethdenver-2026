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

// Ethereum mainnet token addresses
export const TOKENS: Record<string, TokenInfo> = {
  WETH:  { symbol: 'WETH',  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  ETH:   { symbol: 'ETH',   address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  USDC:  { symbol: 'USDC',  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDT:  { symbol: 'USDT',  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  DAI:   { symbol: 'DAI',   address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  WBTC:  { symbol: 'WBTC',  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  UNI:   { symbol: 'UNI',   address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  LINK:  { symbol: 'LINK',  address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  ARB:   { symbol: 'ARB',   address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', decimals: 18 },
  MATIC: { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 },
};

const _addressToSymbol: Record<string, string> = {};
for (const [sym, info] of Object.entries(TOKENS)) {
  _addressToSymbol[info.address.toLowerCase()] = sym;
}
export const ADDRESS_TO_SYMBOL: Readonly<Record<string, string>> = _addressToSymbol;

export function symbolFromAddress(addr: string): string | undefined {
  return ADDRESS_TO_SYMBOL[addr.toLowerCase()];
}

export const TOKEN_PAIR_SUGGESTIONS: Record<string, string[]> = {
  WBTC:  ['WBTC/ETH', 'WBTC/USDC'],
  UNI:   ['UNI/ETH'],
  LINK:  ['LINK/ETH'],
  ARB:   ['ARB/USDC'],
  MATIC: ['MATIC/USDC'],
  USDC:  ['WETH/USDC'],
  USDT:  ['WETH/USDT'],
  DAI:   ['DAI/USDC'],
  WETH:  ['WETH/USDC', 'WBTC/ETH'],
};

export const SCANNABLE_TOKENS = Object.values(TOKENS).filter(
  t => t.symbol !== 'ETH',
);

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
