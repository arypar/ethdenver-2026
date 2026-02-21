'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
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
import {
  getNadfunQuote, buildBuyTx, buildSellTx, buildApproveTx,
  MONAD_CHAIN_ID, ERC20_APPROVE_ABI, type NadfunQuote,
} from '@/lib/nadfun-swap';
import type { Pool, ChainId } from '@/lib/types';
import type { PoolTokens } from '@/lib/tokens';
import { formatEther, parseEther } from 'viem';

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
  chain?: ChainId;
}

export function ExecuteDialog({ open, onClose, onConfirm, label, pool, chain }: ExecuteDialogProps) {
  const isMonad = chain === 'monad';
  const [step, setStep] = useState<Step>('input');
  const [amount, setAmount] = useState(isMonad ? '0.1' : '0.01');
  const [isBuy, setIsBuy] = useState(true);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [nadfunQuoteData, setNadfunQuoteData] = useState<NadfunQuote | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [poolTokens, setPoolTokens] = useState<PoolTokens | null>(null);

  const { address } = useAccount();
  const wagmiConfig = useConfig();

  const poolKey = (pool ?? 'WETH/USDC') as Pool;
  const tokenAddress = isMonad ? (pool ?? '') : '';

  useEffect(() => {
    if (open) {
      setStep('input');
      setAmount(isMonad ? '0.1' : '0.01');
      setIsBuy(true);
      setQuote(null);
      setNadfunQuoteData(null);
      setError('');
      setTxHash('');
      setTokenSymbol('');

      if (isMonad) {
        setStep('resolving');
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/nadfun/token-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenAddress }),
        })
          .then(r => r.json())
          .then(info => {
            setTokenSymbol(info.symbol || tokenAddress.slice(0, 8));
            setStep('input');
          })
          .catch(() => {
            setTokenSymbol(tokenAddress.slice(0, 8));
            setStep('input');
          });
      } else {
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
    }
  }, [open, poolKey, isMonad, tokenAddress]);

  const tokenA = poolTokens?.tokenA;
  const tokenB = poolTokens?.tokenB;

  // -- Monad (nadfun) quote --
  const handleGetNadfunQuote = async () => {
    if (!address) return;
    setStep('quoting');
    setError('');
    try {
      // Switch to Monad early so the wallet is ready for the swap
      try { await switchChain(wagmiConfig, { chainId: MONAD_CHAIN_ID }); } catch {}

      const q = await getNadfunQuote(tokenAddress, amount, isBuy);
      setNadfunQuoteData(q);

      if (!isBuy) {
        const publicClient = getPublicClient(wagmiConfig, { chainId: MONAD_CHAIN_ID });
        if (publicClient) {
          const allowance = await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_APPROVE_ABI,
            functionName: 'allowance',
            args: [address, q.router],
          });
          const amountWei = parseEther(amount);
          if ((allowance as bigint) < amountWei) {
            setStep('approval');
            return;
          }
        }
      }

      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setStep('error');
    }
  };

  const handleNadfunApprove = async () => {
    if (!address || !nadfunQuoteData) return;
    setStep('approving');
    try {
      await switchChain(wagmiConfig, { chainId: MONAD_CHAIN_ID });
      const wc = await getWalletClient(wagmiConfig);
      const amountWei = parseEther(amount);
      const approveTx = buildApproveTx(tokenAddress as `0x${string}`, nadfunQuoteData.router, amountWei);
      const hash = await (wc as any).sendTransaction({
        to: approveTx.to,
        data: approveTx.data as `0x${string}`,
        chainId: MONAD_CHAIN_ID,
      });
      const publicClient = getPublicClient(wagmiConfig, { chainId: MONAD_CHAIN_ID });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setStep('error');
    }
  };

  const handleNadfunSwap = async () => {
    if (!nadfunQuoteData || !address) return;
    setStep('swapping');
    try {
      await switchChain(wagmiConfig, { chainId: MONAD_CHAIN_ID });
      const wc = await getWalletClient(wagmiConfig);
      const amountWei = parseEther(amount);
      const tx = isBuy
        ? buildBuyTx(nadfunQuoteData, tokenAddress as `0x${string}`, address, amountWei)
        : buildSellTx(nadfunQuoteData, tokenAddress as `0x${string}`, address, amountWei);
      const hash = await (wc as any).sendTransaction({
        to: tx.to,
        data: tx.data as `0x${string}`,
        value: tx.value,
        chainId: MONAD_CHAIN_ID,
      });
      setTxHash(hash);
      const publicClient = getPublicClient(wagmiConfig, { chainId: MONAD_CHAIN_ID });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setStep('done');
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
      setStep('error');
    }
  };

  // -- ETH (Uniswap) quote --
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
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
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
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
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

  const outputAmount = isMonad
    ? nadfunQuoteData?.amountOutFormatted ?? ''
    : quote?.quote?.output && tokenB
      ? formatTokenAmount(quote.quote.output.amount, tokenB)
      : '';
  const gasFeeUSD = isMonad ? '' : quote?.quote?.gasFeeUSD ?? '';

  const fromSymbol = isMonad ? (isBuy ? 'MON' : tokenSymbol) : (tokenA?.symbol ?? '?');
  const toSymbol = isMonad ? (isBuy ? tokenSymbol : 'MON') : (tokenB?.symbol ?? '?');
  const explorerUrl = isMonad
    ? `https://monadscan.com/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;
  const explorerName = isMonad ? 'MonadScan' : 'Etherscan';
  const dexLabel = isMonad
    ? `${tokenSymbol || tokenAddress.slice(0, 8)} on nad.fun`
    : `${poolKey} on Uniswap`;

  const si = stepIndex(step);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        showCloseButton={step !== 'quoting' && step !== 'approving' && step !== 'swapping'}
        className="sm:max-w-[460px] rounded-2xl p-0 gap-0 border-0 shadow-2xl overflow-hidden"
        style={{
          backgroundColor: '#0D0D16',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 0 80px rgba(0, 0, 0, 0.6), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <VisuallyHidden><DialogTitle>Swap</DialogTitle></VisuallyHidden>
        {/* Header gradient */}
        <div className="relative px-5 pt-5 pb-4 min-w-0">
          <div className={`absolute inset-0 bg-gradient-to-b ${isMonad ? 'from-purple-500/[0.06]' : 'from-[#FF007A]/[0.06]'} to-transparent pointer-events-none`} />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isMonad ? 'bg-purple-500/15 border-purple-500/20' : 'bg-[#FF007A]/15 border-[#FF007A]/20'} border`}>
                {step === 'done'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : step === 'error'
                    ? <AlertTriangle className="h-4 w-4 text-red-400" />
                    : <ArrowDownUp className={`h-4 w-4 ${isMonad ? 'text-purple-400' : 'text-[#FF007A]'}`} />}
              </div>
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
                  {step === 'done' ? 'Swap Complete' : step === 'error' ? 'Swap Failed' : 'Swap'}
                </h2>
                <p className="text-[11px] text-white/30">{dexLabel}</p>
              </div>
            </div>

            {step !== 'error' && step !== 'done' && (
              <div className="mt-3 flex gap-1">
                {STEP_LABELS.map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`h-1 w-full rounded-full transition-all duration-300 ${
                      i < si ? (isMonad ? 'bg-purple-500' : 'bg-[#FF007A]') : i === si ? (isMonad ? 'bg-purple-500/60' : 'bg-[#FF007A]/60') : 'bg-white/[0.06]'
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
        <div className="px-5 pb-5 flex flex-col gap-3 min-w-0">
          {step === 'resolving' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className={`h-6 w-6 animate-spin ${isMonad ? 'text-purple-400' : 'text-[#FF007A]'}`} />
              <p className="text-[13px] text-white/40">
                {isMonad ? 'Loading token info...' : 'Resolving pool tokens...'}
              </p>
            </div>
          )}

          {step === 'input' && (
            <>
              {/* Buy/Sell toggle for Monad */}
              {isMonad && (
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => setIsBuy(true)}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                      isBuy
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setIsBuy(false)}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                      !isBuy
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              )}

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
                    className="flex-1 min-w-0 bg-transparent text-[28px] font-semibold text-white outline-none placeholder:text-white/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.1] px-3 py-1.5 shrink-0">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                      isMonad ? 'bg-gradient-to-br from-purple-400 to-violet-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'
                    }`}>
                      {fromSymbol[0]}
                    </div>
                    <span className="text-[14px] font-semibold text-white">{fromSymbol}</span>
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
                      {toSymbol[0]}
                    </div>
                    <span className="text-[14px] font-semibold text-white">{toSymbol}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={isMonad ? handleGetNadfunQuote : handleGetQuote}
                disabled={!amount || Number(amount) <= 0}
                className="mt-1 h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isMonad
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
                    : 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: isMonad
                    ? '0 0 24px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                Get Quote
              </button>
            </>
          )}

          {step === 'quoting' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="relative">
                <Loader2 className={`h-8 w-8 animate-spin ${isMonad ? 'text-purple-400' : 'text-[#FF007A]'}`} />
                <div className={`absolute inset-0 blur-xl ${isMonad ? 'bg-purple-500/20' : 'bg-[#FF007A]/20'}`} />
              </div>
              <p className="text-[13px] text-white/50">
                {isMonad ? 'Querying nad.fun Lens...' : 'Finding best route...'}
              </p>
              <p className="text-[11px] text-white/20">{amount} {fromSymbol} → {toSymbol}</p>
            </div>
          )}

          {step === 'approval' && (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-amber-300">Token approval needed</p>
                  <p className="text-[12px] text-amber-200/50 mt-1">
                    Approve {fromSymbol} for trading{isMonad ? ' on nad.fun' : ' on Uniswap'}. This is a one-time transaction.
                  </p>
                </div>
              </div>
              <button
                onClick={isMonad ? handleNadfunApprove : handleApprove}
                className="h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all"
                style={{
                  background: isMonad
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
                    : 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: isMonad
                    ? '0 0 24px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                Approve {fromSymbol}
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
              <p className="text-[11px] text-white/20">Approving {fromSymbol} for trading</p>
            </div>
          )}

          {step === 'review' && (quote || nadfunQuoteData) && (
            <>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">You pay</span>
                    <p className="text-[20px] font-semibold text-white mt-0.5">{amount} <span className="text-white/50">{fromSymbol}</span></p>
                  </div>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white ${
                    isMonad ? 'bg-gradient-to-br from-purple-400 to-violet-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'
                  }`}>
                    {fromSymbol[0]}
                  </div>
                </div>
                <div className="mx-4 border-t border-white/[0.06]" />
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">You receive</span>
                    <p className="text-[20px] font-semibold text-emerald-400 mt-0.5">{outputAmount} <span className="text-emerald-400/50">{toSymbol}</span></p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[12px] font-bold text-white">
                    {toSymbol[0]}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06]">
                {isMonad && nadfunQuoteData && (
                  <DetailRow label="Router" value={nadfunQuoteData.isBondingCurve ? 'Bonding Curve' : 'DEX (Graduated)'} />
                )}
                {!isMonad && quote && (
                  <DetailRow label="Route" value={quote.routing} />
                )}
                {gasFeeUSD && <DetailRow icon={<Fuel className="h-3 w-3" />} label="Network fee" value={`$${gasFeeUSD}`} />}
                <DetailRow label="Slippage" value="1%" />
              </div>

              <button
                onClick={isMonad ? handleNadfunSwap : handleSwap}
                className="h-12 w-full rounded-xl text-[14px] font-semibold text-white transition-all"
                style={{
                  background: isMonad
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
                    : 'linear-gradient(135deg, #FF007A 0%, #D63384 100%)',
                  boxShadow: isMonad
                    ? '0 0 24px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : '0 0 24px rgba(255,0,122,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
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
                <Loader2 className={`h-8 w-8 animate-spin ${isMonad ? 'text-purple-400' : 'text-[#FF007A]'}`} />
                <div className={`absolute inset-0 blur-xl ${isMonad ? 'bg-purple-500/20' : 'bg-[#FF007A]/20'}`} />
              </div>
              <p className="text-[13px] text-white/50">Confirm in your wallet...</p>
              <p className="text-[11px] text-white/20">{amount} {fromSymbol} → {outputAmount} {toSymbol}</p>
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
                  {amount} {fromSymbol} → {outputAmount} {toSymbol}
                </p>
              </div>
              {txHash && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium ${isMonad ? 'text-purple-400' : 'text-[#FF007A]'} hover:bg-white/[0.08] transition-all`}
                >
                  View on {explorerName} <ExternalLink className="h-3 w-3" />
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
