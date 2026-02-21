'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  children?: React.ReactNode;
}

export function TopBar({ children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <rect x="2" y="4.5" width="6" height="7" rx="3" stroke="#FF007A" strokeWidth="1.5" fill="none" />
              <rect x="8" y="4.5" width="6" height="7" rx="3" stroke="#D973A3" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="absolute inset-0 rounded-lg" style={{ boxShadow: '0 0 12px rgba(255,0,122,0.2)' }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">Chaintology</span>
        </div>

        <div className="hidden sm:block">{children}</div>

        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3.5 backdrop-blur-xl transition-all hover:bg-white/[0.1] hover:border-white/[0.16]"
                  style={!connected ? { boxShadow: '0 0 16px rgba(255,0,122,0.12), inset 0 0 16px rgba(255,0,122,0.04)' } : undefined}
                >
                  {connected ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                      <span className="text-[13px] font-medium text-white/80">{account.displayName}</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[13px] font-medium text-white/80">Connect</span>
                    </>
                  )}
                </button>
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>

      <div className="flex justify-center sm:hidden">{children}</div>
    </header>
  );
}
