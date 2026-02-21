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

// Sepolia testnet token addresses
export const TOKENS: Record<string, TokenInfo> = {
  WETH:  { symbol: 'WETH',  address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  USDC:  { symbol: 'USDC',  address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  USDT:  { symbol: 'USDT',  address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', decimals: 6 },
  DAI:   { symbol: 'DAI',   address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', decimals: 18 },
  WBTC:  { symbol: 'WBTC',  address: '0x29f2D40B0605204364af54EC677bD022dA425d03', decimals: 8 },
  UNI:   { symbol: 'UNI',   address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  LINK:  { symbol: 'LINK',  address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', decimals: 18 },
  ARB:   { symbol: 'ARB',   address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', decimals: 18 },
  MATIC: { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 },
  ETH:   { symbol: 'ETH',   address: '0x0000000000000000000000000000000000000000', decimals: 18 },
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
  ['WETH/USDC', { tokenA: TOKENS.WETH, tokenB: TOKENS.USDC, chainId: 11155111 }],
  ['WBTC/ETH',  { tokenA: TOKENS.WBTC, tokenB: TOKENS.WETH, chainId: 11155111 }],
  ['UNI/ETH',   { tokenA: TOKENS.UNI,  tokenB: TOKENS.WETH, chainId: 11155111 }],
  ['LINK/ETH',  { tokenA: TOKENS.LINK, tokenB: TOKENS.WETH, chainId: 11155111 }],
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
