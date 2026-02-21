'use client';

import { UniLogo } from './uni-logo';
import { PillTabs } from './pill-tabs';
import { PillButton } from './pill-button';
import { Wallet, LogOut } from 'lucide-react';

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  connected: boolean;
  address: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const TABS = ['Intelligence', 'Rules Builder', 'Actions'];

export function TopNav({ activeTab, onTabChange, connected, address, onConnect, onDisconnect }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="absolute inset-0 bg-uni-bg0/70 backdrop-blur-xl border-b border-white/[0.06]" />
      <div className="relative mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <UniLogo />
          <span className="text-lg font-bold tracking-tight text-uni-text0">
            Chain<span className="text-gradient-primary">tology</span>
          </span>
        </div>

        <div className="hidden md:block">
          <PillTabs tabs={TABS} active={activeTab} onChange={onTabChange} />
        </div>

        {connected ? (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 py-1.5 transition-all hover:bg-white/[0.10] hover:border-white/[0.14] focus-ring"
          >
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
            <span className="text-sm font-medium text-uni-text0">{address}</span>
            <LogOut className="w-3.5 h-3.5 text-uni-text1" />
          </button>
        ) : (
          <PillButton onClick={onConnect} size="md">
            <Wallet className="w-4 h-4" />
            Connect
          </PillButton>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden relative flex justify-center pb-3 px-4">
        <PillTabs tabs={TABS} active={activeTab} onChange={onTabChange} />
      </div>
    </header>
  );
}
