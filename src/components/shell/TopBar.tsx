'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

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
              <path d="M4 12V7c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#FF007A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <circle cx="12" cy="7" r="1.5" fill="#FF007A" />
              <circle cx="4" cy="12" r="1.5" fill="#D973A3" />
            </svg>
            <div className="absolute inset-0 rounded-lg" style={{ boxShadow: '0 0 12px rgba(255,0,122,0.2)' }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">UniSignal</span>
        </div>

        <div className="hidden sm:block">{children}</div>

        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div className="flex items-center gap-2">
                {connected && (
                  <button
                    onClick={openChainModal}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 backdrop-blur-xl transition-all hover:bg-white/[0.08] hover:border-white/[0.12]"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img src={chain.iconUrl} alt={chain.name ?? ''} className="h-4 w-4 rounded-full" />
                    )}
                    <span className="text-[12px] font-medium text-white/60">{chain.name}</span>
                  </button>
                )}
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
