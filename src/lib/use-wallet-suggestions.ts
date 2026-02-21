'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { erc20Abi, type Address, getAddress } from 'viem';
import {
  SCANNABLE_TOKENS,
  TOKEN_PAIR_SUGGESTIONS,
  symbolFromAddress,
} from './tokens';

// V3 NonfungiblePositionManager on Mainnet
const V3_POSITION_MANAGER: Address = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
// V4 PositionManager on Mainnet
const V4_POSITION_MANAGER: Address = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e';
// V3 Factory on Mainnet
const V3_FACTORY: Address = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const MAX_POSITIONS = 20;

const nftBalanceAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const v3PositionsAbi = [
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
] as const;

const v3FactoryAbi = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

export interface LpPositionData {
  poolAddress?: string;
  token0Symbol: string;
  token1Symbol: string;
  version: 'v3' | 'v4';
  feeTier: number;
  tokenId: string;
}

export interface PoolSuggestion {
  pool: string;
  reason: 'lp' | 'holding';
  token?: string;
  chain: 'eth' | 'monad';
  version?: 'v3' | 'v4';
  feeTier?: number;
  token0Symbol?: string;
  token1Symbol?: string;
  poolAddress?: string;
}

export function useWalletSuggestions() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: 1 });

  const [suggestions, setSuggestions] = useState<PoolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const scannedRef = useRef<string | null>(null);

  const scan = useCallback(async () => {
    if (!address || !publicClient) {
      console.log('[WalletSuggestions] skip: no address or publicClient', { address, hasClient: !!publicClient });
      return;
    }
    if (scannedRef.current === address) return;

    scannedRef.current = address;
    setLoading(true);
    console.log('[WalletSuggestions] scanning', address, 'on Mainnet...');

    const lpPools = new Set<string>();
    const results: PoolSuggestion[] = [];

    // --- V3 LP positions ---
    try {
      const balance = await publicClient.readContract({
        address: V3_POSITION_MANAGER,
        abi: nftBalanceAbi,
        functionName: 'balanceOf',
        args: [address],
      });
      console.log('[WalletSuggestions] V3 position NFT balance:', Number(balance));

      const count = Math.min(Number(balance), MAX_POSITIONS);
      if (count > 0) {
        const tokenIdCalls = Array.from({ length: count }, (_, i) => ({
          address: V3_POSITION_MANAGER,
          abi: nftBalanceAbi,
          functionName: 'tokenOfOwnerByIndex' as const,
          args: [address, BigInt(i)] as const,
        }));
        const tokenIdResults = await publicClient.multicall({ contracts: tokenIdCalls });
        const validTokenIds = tokenIdResults
          .filter((r): r is typeof r & { status: 'success' } => r.status === 'success')
          .map(r => r.result as bigint);

        if (validTokenIds.length > 0) {
          const positionCalls = validTokenIds.map(tokenId => ({
            address: V3_POSITION_MANAGER,
            abi: v3PositionsAbi,
            functionName: 'positions' as const,
            args: [tokenId] as const,
          }));
          const positionResults = await publicClient.multicall({ contracts: positionCalls });

          const pendingFactoryCalls: Array<{
            poolName: string; sym0: string; sym1: string; fee: number;
            token0Addr: Address; token1Addr: Address;
          }> = [];

          for (let idx = 0; idx < positionResults.length; idx++) {
            const res = positionResults[idx];
            if (res.status !== 'success' || !Array.isArray(res.result)) continue;
            const [, , token0Addr, token1Addr, fee] = res.result as [
              bigint, Address, Address, Address, number, number, number, bigint,
              bigint, bigint, bigint, bigint,
            ];
            const sym0 = symbolFromAddress(token0Addr) ?? shortAddr(token0Addr);
            const sym1 = symbolFromAddress(token1Addr) ?? shortAddr(token1Addr);
            const poolName = `${sym0}/${sym1}`;

            if (!lpPools.has(poolName)) {
              lpPools.add(poolName);
              pendingFactoryCalls.push({ poolName, sym0, sym1, fee: Number(fee), token0Addr, token1Addr });
            }
          }

          if (pendingFactoryCalls.length > 0) {
            const factoryCalls = pendingFactoryCalls.map(p => ({
              address: V3_FACTORY,
              abi: v3FactoryAbi,
              functionName: 'getPool' as const,
              args: [p.token0Addr, p.token1Addr, p.fee] as const,
            }));
            const factoryResults = await publicClient.multicall({ contracts: factoryCalls });

            for (let i = 0; i < pendingFactoryCalls.length; i++) {
              const p = pendingFactoryCalls[i];
              let poolAddr: string | undefined;
              const fRes = factoryResults[i];
              if (fRes.status === 'success' && fRes.result) {
                const addr = fRes.result as Address;
                if (addr !== '0x0000000000000000000000000000000000000000') {
                  poolAddr = addr.toLowerCase();
                }
              }
              console.log(`[WalletSuggestions] V3 pool ${p.poolName} → ${poolAddr || 'not found'}`);
              results.push({
                pool: p.poolName,
                reason: 'lp',
                chain: 'eth',
                version: 'v3',
                feeTier: p.fee,
                token0Symbol: p.sym0,
                token1Symbol: p.sym1,
                poolAddress: poolAddr,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[WalletSuggestions] V3 scan error:', err);
    }

    // --- V4 LP positions ---
    try {
      const balance = await publicClient.readContract({
        address: V4_POSITION_MANAGER,
        abi: nftBalanceAbi,
        functionName: 'balanceOf',
        args: [address],
      });
      console.log('[WalletSuggestions] V4 position NFT balance:', Number(balance));

      const count = Math.min(Number(balance), MAX_POSITIONS);
      if (count > 0) {
        const tokenIdCalls = Array.from({ length: count }, (_, i) => ({
          address: V4_POSITION_MANAGER,
          abi: nftBalanceAbi,
          functionName: 'tokenOfOwnerByIndex' as const,
          args: [address, BigInt(i)] as const,
        }));
        const tokenIdResults = await publicClient.multicall({ contracts: tokenIdCalls });
        const validTokenIds = tokenIdResults
          .filter((r): r is typeof r & { status: 'success' } => r.status === 'success')
          .map(r => r.result as bigint);

        console.log('[WalletSuggestions] V4 valid token IDs:', validTokenIds.map(String));

        for (const tokenId of validTokenIds) {
          const poolName = `V4-Pool-${tokenId.toString().slice(0, 8)}`;
          if (!lpPools.has(poolName)) {
            lpPools.add(poolName);
            results.push({ pool: poolName, reason: 'lp', chain: 'eth', version: 'v4' });
          }
        }
      }
    } catch (err) {
      console.warn('[WalletSuggestions] V4 scan error:', err);
    }

    // --- Token balance scan ---
    try {
      const balanceCalls = SCANNABLE_TOKENS.map(t => ({
        address: t.address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      }));

      const balanceResults = await publicClient.multicall({ contracts: balanceCalls });

      for (let i = 0; i < SCANNABLE_TOKENS.length; i++) {
        const res = balanceResults[i];
        if (res.status !== 'success') continue;
        const bal = res.result as bigint;
        if (bal === BigInt(0)) continue;

        const symbol = SCANNABLE_TOKENS[i].symbol;
        console.log('[WalletSuggestions] found token:', symbol, 'balance:', bal.toString());
        const pairs = TOKEN_PAIR_SUGGESTIONS[symbol];
        if (!pairs) continue;

        for (const pair of pairs) {
          if (!lpPools.has(pair)) {
            lpPools.add(pair);
            results.push({ pool: pair, reason: 'holding', token: symbol, chain: 'eth' });
          }
        }
      }
    } catch (err) {
      console.warn('[WalletSuggestions] token balance scan error:', err);
    }

    console.log('[WalletSuggestions] total suggestions:', results.length, results);
    setSuggestions(results);
    setLoading(false);
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) {
      scan();
    } else {
      setSuggestions([]);
      scannedRef.current = null;
    }
  }, [isConnected, address, scan]);

  const refresh = useCallback(() => {
    scannedRef.current = null;
    scan();
  }, [scan]);

  return { suggestions, loading, refresh };
}

function shortAddr(addr: string): string {
  try {
    const a = getAddress(addr);
    return a.slice(0, 6) + '...' + a.slice(-4);
  } catch {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }
}
