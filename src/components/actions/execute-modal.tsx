'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PillButton } from '@/components/pill-button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ExecuteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action?: string;
}

export function ExecuteModal({ open, onClose, onConfirm, action }: ExecuteModalProps) {
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = () => {
    setExecuting(true);
    setTimeout(() => {
      setExecuting(false);
      setDone(true);
      onConfirm();
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1200);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !executing) { setDone(false); onClose(); } }}>
      <DialogContent className="sm:max-w-md glow-card border-white/[0.08] bg-uni-surface0/95 backdrop-blur-2xl rounded-[24px]">
        <DialogHeader className="text-center items-center gap-3">
          {done ? (
            <div className="mx-auto w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
          ) : (
            <div className="mx-auto w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-[0_0_24px_rgba(255,0,122,0.25)]">
              {executing
                ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                : <span className="text-xl">⚡</span>
              }
            </div>
          )}
          <DialogTitle className="text-xl font-bold text-uni-text0">
            {done ? 'Transaction Confirmed' : executing ? 'Executing...' : 'Confirm Execution'}
          </DialogTitle>
          <DialogDescription className="text-uni-text1">
            {done
              ? 'Mock transaction completed successfully.'
              : executing
                ? 'Simulating transaction submission...'
                : `This will execute: "${action || 'Action'}". This is a mock transaction.`
            }
          </DialogDescription>
        </DialogHeader>
        {!executing && !done && (
          <div className="flex flex-col gap-3 pt-4">
            <PillButton variant="primary" size="lg" className="w-full" onClick={handleConfirm}>
              Confirm (Mock)
            </PillButton>
            <PillButton variant="ghost" size="md" className="w-full" onClick={onClose}>
              Cancel
            </PillButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
