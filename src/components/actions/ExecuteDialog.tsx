'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import {
  getQuote, getSwap, checkApproval, buildQuoteParams, formatTokenAmount,
  parseTokenAmount, getOrResolvePoolTokens, type QuoteResponse,
} from '@/lib/uniswap-api';
import { getCachedPoolTokens, parsePoolName } from '@/lib/tokens';
import type { Pool } from '@/lib/types';
import type { PoolTokens } from '@/lib/tokens';

type Step = 'input' | 'resolving' | 'quoting' | 'approval' | 'approving' | 'review' | 'swapping' | 'done' | 'error';

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
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

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

      if (approvalRes.approval) {
        setStep('approval');
      } else {
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setStep('error');
    }
  };

  const handleApprove = async () => {
    if (!walletClient || !address || !poolTokens || !tokenA) return;
    setStep('approving');

    try {
      const rawAmount = parseTokenAmount(amount, tokenA.decimals);
      const approvalRes = await checkApproval({
        walletAddress: address,
        token: tokenA.address,
        amount: rawAmount,
        chainId: poolTokens.chainId,
      });

      if (approvalRes.approval) {
        const hash = await walletClient.sendTransaction({
          to: approvalRes.approval.to as `0x${string}`,
          data: approvalRes.approval.data as `0x${string}`,
          value: BigInt(approvalRes.approval.value || '0'),
        });

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
    if (!walletClient || !quote) return;
    setStep('swapping');

    try {
      const swapRes = await getSwap(quote);
      const hash = await walletClient.sendTransaction({
        to: swapRes.swap.to as `0x${string}`,
        data: swapRes.swap.data as `0x${string}`,
        value: BigInt(swapRes.swap.value || '0'),
      });

      setTxHash(hash);

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

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm rounded-2xl border-white/[0.1] bg-[#0C0C14]/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-white">
            {step === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {(step === 'quoting' || step === 'approving' || step === 'swapping') && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {step === 'error' && <AlertTriangle className="h-4 w-4 text-red-400" />}
            {step === 'input' && 'Execute Swap'}
            {step === 'quoting' && 'Getting Quote...'}
            {step === 'approval' && 'Token Approval Required'}
            {step === 'approving' && 'Approving...'}
            {step === 'review' && 'Review Swap'}
            {step === 'swapping' && 'Executing Swap...'}
            {step === 'done' && 'Swap Confirmed'}
            {step === 'error' && 'Error'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-white/40">
            {label || `Swap ${tokenA?.symbol ?? '?'} for ${tokenB?.symbol ?? '?'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          {step === 'resolving' && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[13px] text-white/40">Resolving pool...</p>
            </div>
          )}

          {step === 'input' && (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-white/30">
                  Amount ({tokenA?.symbol ?? '?'})
                </label>
                <Input
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.01"
                  className="bg-white/[0.06] border-white/[0.1] text-white h-10"
                  type="number"
                  step="any"
                  min="0"
                />
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/40">
                {tokenA?.symbol ?? '?'} <ArrowRight className="inline h-3 w-3 mx-1" /> {tokenB?.symbol ?? '?'} on {poolKey}
              </div>
              <Button className="rounded-xl h-10 text-[13px] font-semibold" onClick={handleGetQuote}
                disabled={!amount || Number(amount) <= 0}
                style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}>
                Get Quote
              </Button>
              <Button variant="ghost" className="rounded-xl h-10 text-[13px] text-white/40 hover:text-white hover:bg-white/[0.06]" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}

          {step === 'quoting' && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[13px] text-white/40">Fetching best route...</p>
            </div>
          )}

          {step === 'approval' && (
            <>
              <p className="text-[13px] text-white/50">
                You need to approve {tokenA?.symbol ?? '?'} for trading before this swap can execute.
              </p>
              <Button className="rounded-xl h-10 text-[13px] font-semibold" onClick={handleApprove}
                style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}>
                Approve {tokenA?.symbol ?? '?'}
              </Button>
              <Button variant="ghost" className="rounded-xl h-10 text-[13px] text-white/40 hover:text-white hover:bg-white/[0.06]" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}

          {step === 'approving' && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[13px] text-white/40">Confirm approval in your wallet...</p>
            </div>
          )}

          {step === 'review' && quote && (
            <>
              <div className="flex flex-col gap-2">
                <QuoteRow label="You pay" value={`${amount} ${tokenA?.symbol ?? '?'}`} />
                <QuoteRow label="You receive" value={`${outputAmount} ${tokenB?.symbol ?? '?'}`} highlight />
                <QuoteRow label="Route" value={quote.routing} />
                {gasFeeUSD && <QuoteRow label="Gas fee" value={`$${gasFeeUSD}`} />}
                <QuoteRow label="Slippage" value={`${quote.quote?.slippage ?? 0.5}%`} />
              </div>
              <Button className="rounded-xl h-10 text-[13px] font-semibold" onClick={handleSwap}
                style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}>
                Confirm Swap
              </Button>
              <Button variant="ghost" className="rounded-xl h-10 text-[13px] text-white/40 hover:text-white hover:bg-white/[0.06]" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}

          {step === 'swapping' && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[13px] text-white/40">Confirm transaction in your wallet...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-4 gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-[13px] text-white/60">Swap executed successfully!</p>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-primary hover:underline"
                >
                  View on Etherscan
                </a>
              )}
            </div>
          )}

          {step === 'error' && (
            <>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[12px] text-red-300">
                {error}
              </div>
              <Button variant="ghost" className="rounded-xl h-10 text-[13px] text-white/40 hover:text-white hover:bg-white/[0.06]"
                onClick={() => setStep('input')}>
                Try Again
              </Button>
              <Button variant="ghost" className="rounded-xl h-10 text-[13px] text-white/40 hover:text-white hover:bg-white/[0.06]" onClick={handleClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuoteRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[12px]">
      <span className="text-white/40">{label}</span>
      <span className={highlight ? 'font-semibold text-emerald-400' : 'font-medium text-white/80'}>{value}</span>
    </div>
  );
}
