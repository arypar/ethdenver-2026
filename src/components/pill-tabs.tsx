'use client';

import { cn } from '@/lib/utils';

interface PillTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function PillTabs({ tabs, active, onChange }: PillTabsProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-uni-surface0/80 p-1 backdrop-blur-sm border border-white/[0.06]">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap focus-ring',
            active === tab
              ? 'text-white bg-white/[0.1] shadow-[0_0_12px_rgba(255,0,122,0.12)]'
              : 'text-uni-text1 hover:text-white/80'
          )}
        >
          {active === tab && (
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-uni-rose/10 to-uni-charm/8 pointer-events-none" />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}
