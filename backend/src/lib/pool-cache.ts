import { createPublicClient, http, getAddress } from 'viem';
import { mainnet } from 'viem/chains';

const RPC_URL = process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com';

const rpcClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export interface PoolMeta {
  address: `0x${string}`;
  token0Symbol: string;
  token1Symbol: string;
  token0Address: `0x${string}`;
  token1Address: `0x${string}`;
  decimals0: number;
  decimals1: number;
  feeTier: number;
  invert: boolean;
}

const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as const;
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    name: 'getPool',
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const WELL_KNOWN_TOKENS: Record<string, `0x${string}`> = {
  WETH:  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT:  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  WBTC:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  DAI:   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  UNI:   '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  LINK:  '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  AAVE:  '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  MKR:   '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
  COMP:  '0xc00e94Cb662C3520282E6f5717214004A7f26888',
  SNX:   '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
  CRV:   '0xD533a949740bb3306d119CC777fa900bA034cd52',
  LDO:   '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
  ARB:   '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
  PEPE:  '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
  SHIB:  '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
  MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
  APE:   '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
  DOGE:  '0x4206931337dc273a630d328dA6441786BfaD668f',
  GRT:   '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
  ENS:   '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
  RPL:   '0xD33526068D116cE69F19A9ee46F0bd304F21A51f',
  BLUR:  '0x5283D291DBCF85356A21bA090E6db59121208b44',
  OP:    '0x4200000000000000000000000000000000000042',
  FET:   '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85',
  RNDR:  '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24',
  IMX:   '0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF',
  WLD:   '0x163f8C2467924be0ae7B5347228CABF260318753',
  EIGEN: '0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83',
  ENA:   '0x57e114B691Db790C35207b2e685D4A43181e6061',
  PENDLE:'0x808507121B80c02388fAd14726482e061B8da827',
};

const FEE_TIERS = [3000, 500, 10000, 100] as const;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

const cache = new Map<string, PoolMeta>();

function seedCache() {
  cache.set('WETH/USDC', {
    address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    token0Symbol: 'USDC', token1Symbol: 'WETH',
    token0Address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals0: 6, decimals1: 18, feeTier: 500, invert: true,
  });
  cache.set('WBTC/ETH', {
    address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD',
    token0Symbol: 'WBTC', token1Symbol: 'WETH',
    token0Address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals0: 8, decimals1: 18, feeTier: 3000, invert: false,
  });
  cache.set('UNI/ETH', {
    address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801',
    token0Symbol: 'UNI', token1Symbol: 'WETH',
    token0Address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals0: 18, decimals1: 18, feeTier: 3000, invert: false,
  });
  cache.set('LINK/ETH', {
    address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8',
    token0Symbol: 'LINK', token1Symbol: 'WETH',
    token0Address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals0: 18, decimals1: 18, feeTier: 3000, invert: false,
  });
}
seedCache();

export function getCachedPool(name: string): PoolMeta | undefined {
  return cache.get(name);
}

export function getAllCachedPools(): string[] {
  return Array.from(cache.keys());
}

export function resolveSymbol(input: string): `0x${string}` | null {
  if (input.startsWith('0x') && input.length === 42) {
    return getAddress(input) as `0x${string}`;
  }
  const upper = input.toUpperCase();
  return WELL_KNOWN_TOKENS[upper] ?? null;
}

async function fetchTokenMeta(address: `0x${string}`): Promise<{ symbol: string; decimals: number }> {
  const [symbol, decimals] = await Promise.all([
    rpcClient.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
    rpcClient.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
  ]);
  return { symbol: symbol as string, decimals: Number(decimals) };
}

export async function resolvePool(tokenAInput: string, tokenBInput: string): Promise<PoolMeta> {
  const canonicalName = `${tokenAInput.toUpperCase()}/${tokenBInput.toUpperCase()}`;
  const cached = cache.get(canonicalName);
  if (cached) return cached;

  const addressA = resolveSymbol(tokenAInput);
  const addressB = resolveSymbol(tokenBInput);

  if (!addressA) throw new Error(`Unknown token "${tokenAInput}". Provide a 0x address instead.`);
  if (!addressB) throw new Error(`Unknown token "${tokenBInput}". Provide a 0x address instead.`);

  let poolAddress: `0x${string}` | null = null;
  let foundFee = 0;

  for (const fee of FEE_TIERS) {
    const result = await rpcClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [addressA, addressB, fee],
    });
    if (result && result !== ZERO_ADDRESS) {
      poolAddress = result as `0x${string}`;
      foundFee = fee;
      break;
    }
  }

  if (!poolAddress) {
    throw new Error(`No Uniswap V3 pool found for ${tokenAInput}/${tokenBInput} on any fee tier`);
  }

  const [metaA, metaB] = await Promise.all([
    fetchTokenMeta(addressA),
    fetchTokenMeta(addressB),
  ]);

  const aLower = addressA.toLowerCase();
  const bLower = addressB.toLowerCase();
  const aIsToken0 = aLower < bLower;

  const meta: PoolMeta = {
    address: poolAddress,
    token0Symbol: aIsToken0 ? metaA.symbol : metaB.symbol,
    token1Symbol: aIsToken0 ? metaB.symbol : metaA.symbol,
    token0Address: aIsToken0 ? addressA : addressB,
    token1Address: aIsToken0 ? addressB : addressA,
    decimals0: aIsToken0 ? metaA.decimals : metaB.decimals,
    decimals1: aIsToken0 ? metaB.decimals : metaA.decimals,
    feeTier: foundFee,
    invert: !aIsToken0,
  };

  cache.set(canonicalName, meta);
  return meta;
}
