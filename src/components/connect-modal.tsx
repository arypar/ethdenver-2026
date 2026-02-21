'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PillButton } from './pill-button';
import { Wallet } from 'lucide-react';

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  message?: string;
}

export function ConnectModal({ open, onClose, onConnect, message }: ConnectModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md glow-card border-white/[0.08] bg-uni-surface0/95 backdrop-blur-2xl rounded-[24px]">
        <DialogHeader className="text-center items-center gap-3">
          <div className="mx-auto w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-[0_0_24px_rgba(255,0,122,0.25)]">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-uni-text0">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-uni-text1">
            {message || 'Connect your wallet to unlock all Chaintology features.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <PillButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => { onConnect(); onClose(); }}
          >
            Connect (Mock)
          </PillButton>
          <PillButton variant="ghost" size="md" className="w-full" onClick={onClose}>
            Cancel
          </PillButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
