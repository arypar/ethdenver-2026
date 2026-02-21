'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowDownUp,
  ExternalLink, RefreshCw, Shield, Fuel,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { getWalletClient, getPublicClient, switchChain } from '@wagmi/core';
import {
  getQuote, getSwap, checkApproval, buildQuoteParams, formatTokenAmount,
  parseTokenAmount, getOrResolvePoolTokens, type QuoteResponse,
} from '@/lib/uniswap-api';
import { getCachedPoolTokens, parsePoolName } from '@/lib/tokens';
import type { Pool } from '@/lib/types';
import type { PoolTokens } from '@/lib/tokens';

type Step = 'input' | 'resolving' | 'quoting' | 'approval' | 'approving' | 'review' | 'swapping' | 'done' | 'error';

const STEP_LABELS = ['Amount', 'Quote', 'Review', 'Execute'] as const;
function stepIndex(s: Step): number {
  if (s === 'input' || s === 'resolving') return 0;
  if (s === 'quoting') return 1;
  if (s === 'approval' || s === 'approving' || s === 'review') return 2;
  if (s === 'swapping') return 3;
  if (s === 'done') return 4;
  return -1;
}

interface ExecuteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label?: string;
  pool?: string;
}

export function ExecuteDialog({ open, onClose, onConfirm, label, pool }: ExecuteDialogProps) {
  const [step, setStep] = useState<Step>('input');
  const [amount, setAmount] = useState('0.01');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [poolTokens, setPoolTokens] = useState<PoolTokens | null>(null);

  const { address } = useAccount();
  const wagmiConfig = useConfig();

  const poolKey = (pool ?? 'WETH/USDC') as Pool;

  useEffect(() => {
    if (open) {
      setStep('input');
      setAmount('0.01');
      setQuote(null);
      setError('');
      setTxHash('');
      const cached = getCachedPoolTokens(poolKey);
      if (cached) {
        setPoolTokens(cached);
      } else {
        setStep('resolving');
        getOrResolvePoolTokens(poolKey)
          .then(tokens => { setPoolTokens(tokens); setStep('input'); })
          .catch(() => {
            const { tokenASymbol, tokenBSymbol } = parsePoolName(poolKey);
            setPoolTokens({ tokenA: { symbol: tokenASymbol, address: '0x0000000000000000000000000000000000000000', decimals: 18 }, tokenB: { symbol: tokenBSymbol, address: '0x0000000000000000000000000000000000000000', decimals: 18 }, chainId: 1 });
            setStep('input');
          });
      }
    }
  }, [open, poolKey]);

  const tokenA = poolTokens?.tokenA;
  const tokenB = poolTokens?.tokenB;

  const handleGetQuote = async () => {
    if (!address || !poolTokens || !tokenA) return;
    setStep('quoting');
    setError('');

    try {
      const rawAmount = parseTokenAmount(amount, tokenA.decimals);
      const params = await buildQuoteParams(address, poolKey, 'AtoB', rawAmount);
      const quoteRes = await getQuote(params);
      setQuote(quoteRes);

      const approvalRes = await checkApproval({
        walletAddress: address,
        token: tokenA.address,
        amount: rawAmount,
        chainId: poolTokens.chainId,
      });

      setStep(approvalRes.approval ? 'approval' : 'review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setStep('error');
    }
  };

  const handleApprove = async () => {
    if (!address || !poolTokens || !tokenA) return;
    setStep('approving');

    try {
      const chainId = poolTokens.chainId;
      await switchChain(wagmiConfig, { chainId });
      const walletClient = await getWalletClient(wagmiConfig, { chainId });

      const rawAmount = parseTokenAmount(amount, tokenA.decimals);
      const approvalRes = await checkApproval({
        walletAddress: address,
        token: tokenA.address,
        amount: rawAmount,
        chainId,
      });

      if (approvalRes.approval) {
        const hash = await walletClient.sendTransaction({
          to: approvalRes.approval.to as `0x${string}`,
          data: approvalRes.approval.data as `0x${string}`,
          value: BigInt(approvalRes.approval.value || '0'),
        });

        const publicClient = getPublicClient(wagmiConfig, { chainId });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setStep('error');
    }
  };

  const handleSwap = async () => {
    if (!quote || !poolTokens) return;
    setStep('swapping');

    try {
      const chainId = poolTokens.chainId;
      await switchChain(wagmiConfig, { chainId });
      const walletClient = await getWalletClient(wagmiConfig, { chainId });

      const swapRes = await getSwap(quote);
      const hash = await walletClient.sendTransaction({
        to: swapRes.swap.to as `0x${string}`,
        data: swapRes.swap.data as `0x${string}`,
        value: BigInt(swapRes.swap.value || '0'),
      });

      setTxHash(hash);

      const publicClient = getPublicClient(wagmiConfig, { chainId });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setStep('done');
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    if (step === 'quoting' || step === 'approving' || step === 'swapping') return;
    onClose();
  };

  const outputAmount = quote?.quote?.output && tokenB
    ? formatTokenAmount(quote.quote.output.amount, tokenB)
    : '';
  const gasFeeUSD = quote?.quote?.gasFeeUSD ?? '';

  const si = stepIndex(step);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        showCloseButton={step !== 'quoting' && step !== 'approving' && step !== 'swapping'}
        className="sm:max-w-[460px] rounded-2xl border-white/[0.08] bg-[#0D0D16]/98 backdrop-blur-2xl p-0 gap-0"
      >
        {/* Header gradient */}
        <div className="relative px-5 pt-5 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-[#FF007A]/[0.06] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF007A]/15 border border-[#FF007A]/20">
                {step === 'done'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : step === 'error'
                    ? <AlertTriangle className="h-4 w-4 text-red-400" />
                    : <ArrowDownUp className="h-4 w-4 text-[#FF007A]" />}
              </div>
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
                  {step === 'done' ? 'Swap Complete' : step === 'error' ? 'Swap Failed' : 'Swap'}
                </h2>
                <p className="text-[11px] text-white/30">{poolKey} on Uniswap</p>
              </div>
            </div>

            {/* Progress steps */}
            {step !== 'error' && step !== 'done' && (
              <div className="mt-3 flex gap-1">
                {STEP_LABELS.map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`h-1 w-full rounded-full transition-all duration-300 ${
                      i < si ? 'bg-[#FF007A]' : i === si ? 'bg-[#FF007A]/60' : 'bg-white/[0.06]'
                    }`} />
                    <span className={`text-[9px] font-medium uppercase tracking-wider ${
                      i === si ? 'text-white/60' : i < si ? 'text-white/25' : 'text-white/10'
                    }`}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          {step === 'resolving' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF007A]" />
              <p className="text-[13px] text-white/40">Resolving pool tokens...</p>
            </div>
          )}

          {step === 'input' && (
            <>
              {/* From token */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">You pay</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.0"
                    type="number"
                    step="any"
                    min="0"
                    className="flex-1 bg-transparent text-[28px] font-semibold text-white outline-none placeholder:text-white/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.1] px-3 py-1.5 shrink-0">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {(tokenA?.symbol ?? '?')[0]}
                    </div>
                    <span className="text-[14px] font-semibold text-white">{tokenA?.symbol ?? '?'}</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center -my-1.5 relative z-10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-[#0D0D16]">
                  <ArrowDownUp className="h-3.5 w-3.5 text-white/40" />
                </div>
              </div>

              {/* To token */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">You receive</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-[28px] font-semibold text-white/20">~</span>
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.1] px-3 py-1.5 shrink-0">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {(tokenB?.symbol ?? '?')[0]}
                    </div>
                    <span className="text-[14px] font-semibold text-white">{tokenB?.symbol ?? '?'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGetQuote}
                disabled={!amount || Number(amount) <= 0}
                className="mt-1 h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                Get Quote
              </button>
            </>
          )}

          {step === 'quoting' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF007A]" />
                <div className="absolute inset-0 blur-xl bg-[#FF007A]/20" />
              </div>
              <p className="text-[13px] text-white/50">Finding best route...</p>
              <p className="text-[11px] text-white/20">{amount} {tokenA?.symbol} → {tokenB?.symbol}</p>
            </div>
          )}

          {step === 'approval' && (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-amber-300">Token approval needed</p>
                  <p className="text-[12px] text-amber-200/50 mt-1">
                    Approve {tokenA?.symbol} for trading on Uniswap. This is a one-time transaction.
                  </p>
                </div>
              </div>
              <button
                onClick={handleApprove}
                className="h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                Approve {tokenA?.symbol}
              </button>
              <button onClick={handleClose} className="h-10 w-full rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
                Cancel
              </button>
            </>
          )}

          {step === 'approving' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                <div className="absolute inset-0 blur-xl bg-amber-400/20" />
              </div>
              <p className="text-[13px] text-white/50">Confirm in your wallet...</p>
              <p className="text-[11px] text-white/20">Approving {tokenA?.symbol} for trading</p>
            </div>
          )}

          {step === 'review' && quote && (
            <>
              {/* Swap summary */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">You pay</span>
                    <p className="text-[20px] font-semibold text-white mt-0.5">{amount} <span className="text-white/50">{tokenA?.symbol}</span></p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[12px] font-bold text-white">
                    {(tokenA?.symbol ?? '?')[0]}
                  </div>
                </div>
                <div className="mx-4 border-t border-white/[0.06]" />
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">You receive</span>
                    <p className="text-[20px] font-semibold text-emerald-400 mt-0.5">{outputAmount} <span className="text-emerald-400/50">{tokenB?.symbol}</span></p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[12px] font-bold text-white">
                    {(tokenB?.symbol ?? '?')[0]}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06]">
                <DetailRow label="Route" value={quote.routing} />
                {gasFeeUSD && <DetailRow icon={<Fuel className="h-3 w-3" />} label="Network fee" value={`$${gasFeeUSD}`} />}
                <DetailRow label="Slippage" value={`${quote.quote?.slippage ?? 0.5}%`} />
              </div>

              <button
                onClick={handleSwap}
                className="h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                Confirm Swap
              </button>
              <button onClick={handleClose} className="h-10 w-full rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
                Cancel
              </button>
            </>
          )}

          {step === 'swapping' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF007A]" />
                <div className="absolute inset-0 blur-xl bg-[#FF007A]/20" />
              </div>
              <p className="text-[13px] text-white/50">Confirm in your wallet...</p>
              <p className="text-[11px] text-white/20">{amount} {tokenA?.symbol} → {outputAmount} {tokenB?.symbol}</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="absolute inset-0 blur-2xl bg-emerald-400/20 rounded-full" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white">Swap executed!</p>
                <p className="text-[12px] text-white/30 mt-1">
                  {amount} {tokenA?.symbol} → {outputAmount} {tokenB?.symbol}
                </p>
              </div>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-[#FF007A] hover:bg-white/[0.08] transition-all"
                >
                  View on Etherscan <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button onClick={handleClose} className="h-10 w-full rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
                Close
              </button>
            </div>
          )}

          {step === 'error' && (
            <>
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-red-300">Transaction failed</p>
                  <p className="text-[12px] text-red-200/50 mt-1 break-all">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setStep('input')}
                className="h-10 w-full rounded-xl text-[13px] font-medium text-white/60 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try Again
              </button>
              <button onClick={handleClose} className="h-10 w-full rounded-xl text-[13px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
                Close
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12px] text-white/30">{icon}{label}</span>
      <span className="text-[12px] font-medium text-white/70">{value}</span>
    </div>
  );
}
