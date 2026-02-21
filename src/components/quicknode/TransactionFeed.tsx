'use client';

import { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { StreamTx, Chain } from '@/lib/use-stream-feed';
import { METHOD_NAMES, CHAIN_CONFIG } from '@/lib/use-stream-feed';

interface Props {
  transactions: StreamTx[];
  chain: Chain;
}

function truncate(addr: string | null, chars = 6): string {
  if (!addr) return '--';
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

function formatValue(raw: string | undefined): string {
  if (!raw || raw === '0') return '0';
  try {
    const wei = BigInt(raw);
    if (wei === BigInt(0)) return '0';
    const eth = Number(wei) / 1e18;
    if (eth < 0.0001) return '<0.0001';
    return eth.toFixed(4);
  } catch {
    return '0';
  }
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function TransactionFeed({ transactions, chain }: Props) {
  const cfg = CHAIN_CONFIG[chain];
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (autoScroll && containerRef.current) containerRef.current.scrollTop = 0;
  }, [transactions.length, autoScroll]);

  useEffect(() => {
    prevLenRef.current = transactions.length;
  }, [transactions.length]);

  function handleScroll() {
    if (!containerRef.current) return;
    setAutoScroll(containerRef.current.scrollTop < 20);
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
        <div className="animate-pulse-glow mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <p className="text-sm text-white/50">Waiting for {cfg.label} transactions...</p>
        <p className="text-xs text-white/30 mt-1">
          Start the simulator or connect a QuickNode Stream
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <div className="grid grid-cols-[80px_1fr_1fr_1fr_120px_100px_80px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-[11px] font-medium text-white/30 uppercase tracking-wider">
        <span>Block</span>
        <span>Tx Hash</span>
        <span>From</span>
        <span>To</span>
        <span>Method</span>
        <span className="text-right">Value ({cfg.nativeToken})</span>
        <span className="text-right">Age</span>
      </div>

      <div ref={containerRef} onScroll={handleScroll} className="max-h-[520px] overflow-y-auto">
        {transactions.map((tx, i) => {
          const isNew = i === 0 && transactions.length > prevLenRef.current;
          return (
            <div
              key={tx.tx_hash + i}
              className={`grid grid-cols-[80px_1fr_1fr_1fr_120px_100px_80px] gap-2 px-4 py-2 border-b border-white/[0.03] text-[13px] transition-colors hover:bg-white/[0.04] ${isNew ? 'animate-flash' : ''}`}
            >
              <span className="text-white/60 font-mono tabular-nums">
                {tx.block_number?.toLocaleString()}
              </span>

              <a
                href={`${cfg.explorer}/tx/${tx.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary/80 hover:text-primary font-mono truncate"
              >
                {truncate(tx.tx_hash, 8)}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
              </a>

              <span className="text-white/50 font-mono truncate" title={tx.from_address}>
                {truncate(tx.from_address)}
              </span>

              <span className="text-white/50 font-mono truncate" title={tx.to_address || ''}>
                {truncate(tx.to_address)}
              </span>

              <span className="inline-flex items-center">
                <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-medium text-primary/80 truncate">
                  {METHOD_NAMES[tx.method_id] || tx.method_id}
                </span>
              </span>

              <span className="text-white/60 font-mono tabular-nums text-right">
                {formatValue(tx.value)}
              </span>

              <span className="text-white/40 text-right text-[12px]">
                {timeAgo(tx.block_timestamp)}
              </span>
            </div>
          );
        })}
      </div>

      {!autoScroll && (
        <button
          onClick={() => { setAutoScroll(true); if (containerRef.current) containerRef.current.scrollTop = 0; }}
          className="w-full py-2 text-xs text-primary/70 hover:text-primary border-t border-white/[0.06] transition-colors"
        >
          Scroll to latest
        </button>
      )}
    </div>
  );
}
