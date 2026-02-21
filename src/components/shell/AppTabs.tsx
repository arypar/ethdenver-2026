'use client';

import { cn } from '@/lib/utils';

const TABS = ['Intelligence (ETH)', 'Intelligence (Monad)', 'Rules Builder', 'Actions'] as const;
export type TabId = (typeof TABS)[number];

interface AppTabsProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function AppTabs({ active, onChange }: AppTabsProps) {
  return (
    <nav className="flex items-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 backdrop-blur-xl">
      {TABS.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'relative rounded-lg px-4 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-all duration-200',
            active === tab
              ? 'bg-white/[0.1] text-white shadow-sm'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          {tab}
          {active === tab && (
            <span className="absolute inset-x-3 -bottom-1 h-[2px] rounded-full bg-primary"
              style={{ boxShadow: '0 0 8px rgba(255,0,122,0.5)' }} />
          )}
        </button>
      ))}
    </nav>
  );
}
