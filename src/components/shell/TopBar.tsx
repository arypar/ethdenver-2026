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
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(255,0,122,0.14), rgba(123,97,255,0.14))' }}>
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
              <defs>
                <linearGradient id="ct-g" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF007A" />
                  <stop offset="100%" stopColor="#7B61FF" />
                </linearGradient>
              </defs>
              <path d="M15 7a5 5 0 1 0 0 10" stroke="url(#ct-g)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <circle cx="15" cy="7" r="1.8" fill="#FF007A" />
              <circle cx="15" cy="17" r="1.8" fill="#7B61FF" />
              <circle cx="9.5" cy="12" r="1.2" fill="white" fillOpacity="0.55" />
            </svg>
            <div className="absolute inset-0 rounded-xl border border-white/[0.06]"
              style={{ boxShadow: '0 0 20px rgba(255,0,122,0.12), 0 0 40px rgba(123,97,255,0.06)' }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.015em] text-white">Chaintology</span>
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
