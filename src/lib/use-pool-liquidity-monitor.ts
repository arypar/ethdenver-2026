'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { sepolia } from 'viem/chains';

const POLL_INTERVAL_MS = 8_000;
const INITIAL_LOOKBACK_BLOCKS = BigInt(2000);
const MAX_EVENTS = 200;

const MINT_EVENT = parseAbiItem(
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
);
const BURN_EVENT = parseAbiItem(
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
);
const COLLECT_EVENT = parseAbiItem(
  'event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)',
);

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

export interface LiquidityEvent {
  event_type: 'mint' | 'burn' | 'collect';
  pool_address: string;
  owner: string;
  tick_lower: number;
  tick_upper: number;
  amount: string;
  amount0: string;
  amount1: string;
  block_number: number;
  tx_hash: string;
  block_timestamp: string;
}

interface PoolLiquidityStats {
  mints: number;
  burns: number;
  collects: number;
}

interface TVLData {
  amount0: string;
  amount1: string;
}

async function fetchBlockTimestamps(blockNumbers: bigint[]): Promise<Map<number, string>> {
  const unique = [...new Set(blockNumbers.map(Number))];
  const map = new Map<number, string>();
  const BATCH = 6;

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const blocks = await Promise.all(
      batch.map(n => sepoliaClient.getBlock({ blockNumber: BigInt(n) }).catch(() => null)),
    );
    for (let j = 0; j < batch.length; j++) {
      const block = blocks[j];
      if (block) {
        map.set(batch[j], new Date(Number(block.timestamp) * 1000).toISOString());
      }
    }
  }
  return map;
}

function rawLogsToEvents(
  mintLogs: any[],
  burnLogs: any[],
  collectLogs: any[],
  poolAddress: string,
  timestamps: Map<number, string>,
): LiquidityEvent[] {
  const events: LiquidityEvent[] = [];
  const ts = (bn: number) => timestamps.get(bn) || new Date().toISOString();

  for (const log of mintLogs) {
    const bn = Number(log.blockNumber);
    events.push({
      event_type: 'mint',
      pool_address: poolAddress,
      owner: log.args.owner ?? '',
      tick_lower: Number(log.args.tickLower ?? 0),
      tick_upper: Number(log.args.tickUpper ?? 0),
      amount: String(log.args.amount ?? '0'),
      amount0: String(log.args.amount0 ?? '0'),
      amount1: String(log.args.amount1 ?? '0'),
      block_number: bn,
      tx_hash: log.transactionHash ?? '',
      block_timestamp: ts(bn),
    });
  }

  for (const log of burnLogs) {
    const bn = Number(log.blockNumber);
    events.push({
      event_type: 'burn',
      pool_address: poolAddress,
      owner: log.args.owner ?? '',
      tick_lower: Number(log.args.tickLower ?? 0),
      tick_upper: Number(log.args.tickUpper ?? 0),
      amount: String(log.args.amount ?? '0'),
      amount0: String(log.args.amount0 ?? '0'),
      amount1: String(log.args.amount1 ?? '0'),
      block_number: bn,
      tx_hash: log.transactionHash ?? '',
      block_timestamp: ts(bn),
    });
  }

  for (const log of collectLogs) {
    const bn = Number(log.blockNumber);
    events.push({
      event_type: 'collect',
      pool_address: poolAddress,
      owner: log.args.owner ?? '',
      tick_lower: Number(log.args.tickLower ?? 0),
      tick_upper: Number(log.args.tickUpper ?? 0),
      amount: '0',
      amount0: String(log.args.amount0 ?? '0'),
      amount1: String(log.args.amount1 ?? '0'),
      block_number: bn,
      tx_hash: log.transactionHash ?? '',
      block_timestamp: ts(bn),
    });
  }

  events.sort((a, b) => b.block_number - a.block_number);
  return events;
}

export function usePoolLiquidityMonitor(poolAddress: string, _chain: string = 'eth') {
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [tvl, setTvl] = useState<TVLData>({ amount0: '0', amount1: '0' });
  const [stats, setStats] = useState<PoolLiquidityStats>({ mints: 0, burns: 0, collects: 0 });
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const lastBlockRef = useRef<bigint>(BigInt(0));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poolRef = useRef(poolAddress);

  useEffect(() => { poolRef.current = poolAddress; }, [poolAddress]);

  const fetchLogs = useCallback(async (fromBlock: bigint, toBlock: bigint) => {
    const addr = poolRef.current as Address;
    if (!addr) return [];

    const [mintLogs, burnLogs, collectLogs] = await Promise.all([
      sepoliaClient.getLogs({ address: addr, event: MINT_EVENT, fromBlock, toBlock }).catch(() => []),
      sepoliaClient.getLogs({ address: addr, event: BURN_EVENT, fromBlock, toBlock }).catch(() => []),
      sepoliaClient.getLogs({ address: addr, event: COLLECT_EVENT, fromBlock, toBlock }).catch(() => []),
    ]);

    const allLogs = [...mintLogs, ...burnLogs, ...collectLogs];
    const blockNums = allLogs.map(l => l.blockNumber);
    const timestamps = blockNums.length > 0 ? await fetchBlockTimestamps(blockNums) : new Map<number, string>();

    return rawLogsToEvents(mintLogs, burnLogs, collectLogs, poolRef.current, timestamps);
  }, []);

  const computeStats = useCallback((evts: LiquidityEvent[]) => {
    const s = { mints: 0, burns: 0, collects: 0 };
    let t0 = BigInt(0);
    let t1 = BigInt(0);

    const sorted = [...evts].sort((a, b) => a.block_number - b.block_number);
    for (const e of sorted) {
      if (e.event_type === 'mint') {
        s.mints++;
        t0 += BigInt(e.amount0 || '0');
        t1 += BigInt(e.amount1 || '0');
      } else if (e.event_type === 'burn') {
        s.burns++;
        t0 -= BigInt(e.amount0 || '0');
        t1 -= BigInt(e.amount1 || '0');
      } else {
        s.collects++;
      }
    }

    return { stats: s, tvl: { amount0: t0.toString(), amount1: t1.toString() } };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!poolAddress) return;
    setLoading(true);
    setEvents([]);
    lastBlockRef.current = BigInt(0);

    const init = async () => {
      try {
        const currentBlock = await sepoliaClient.getBlockNumber();
        const fromBlock = currentBlock > INITIAL_LOOKBACK_BLOCKS ? currentBlock - INITIAL_LOOKBACK_BLOCKS : BigInt(0);

        const newEvents = await fetchLogs(fromBlock, currentBlock);
        setEvents(newEvents.slice(0, MAX_EVENTS));

        const { stats: s, tvl: t } = computeStats(newEvents);
        setStats(s);
        setTvl(t);
        lastBlockRef.current = currentBlock;
        setWsConnected(true);

        console.log(`[LiqMonitor] Initial fetch: ${newEvents.length} events from block ${fromBlock} to ${currentBlock}`);
      } catch (err) {
        console.warn('[LiqMonitor] Initial fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [poolAddress, fetchLogs, computeStats]);

  // Poll for new events
  useEffect(() => {
    if (!poolAddress) return;

    const poll = async () => {
      try {
        const currentBlock = await sepoliaClient.getBlockNumber();
        if (currentBlock <= lastBlockRef.current) return;

        const fromBlock = lastBlockRef.current + BigInt(1);
        const newEvents = await fetchLogs(fromBlock, currentBlock);
        lastBlockRef.current = currentBlock;

        if (newEvents.length > 0) {
          console.log(`[LiqMonitor] Polled ${newEvents.length} new events (blocks ${fromBlock}..${currentBlock})`);
          setEvents(prev => {
            const merged = [...newEvents, ...prev];
            return merged.length > MAX_EVENTS ? merged.slice(0, MAX_EVENTS) : merged;
          });
          setStats(prev => {
            const s = { ...prev };
            for (const e of newEvents) {
              if (e.event_type === 'mint') s.mints++;
              else if (e.event_type === 'burn') s.burns++;
              else s.collects++;
            }
            return s;
          });
          setTvl(prev => {
            let t0 = BigInt(prev.amount0 || '0');
            let t1 = BigInt(prev.amount1 || '0');
            for (const e of newEvents) {
              if (e.event_type === 'mint') {
                t0 += BigInt(e.amount0 || '0');
                t1 += BigInt(e.amount1 || '0');
              } else if (e.event_type === 'burn') {
                t0 -= BigInt(e.amount0 || '0');
                t1 -= BigInt(e.amount1 || '0');
              }
            }
            return { amount0: t0.toString(), amount1: t1.toString() };
          });
        }
      } catch (err) {
        console.warn('[LiqMonitor] Poll error:', err);
      }
    };

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poolAddress, fetchLogs]);

  return { events, tvl, stats, loading, wsConnected };
}
