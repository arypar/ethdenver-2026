'use client';

import { cn } from '@/lib/utils';

interface PillSelectProps<T extends string> {
  label?: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  compact?: boolean;
}

export function PillSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  compact = false,
}: PillSelectProps<T>) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-uni-text1 tracking-wide uppercase">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'rounded-full border transition-all duration-150 font-medium focus-ring',
              compact ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              value === opt
                ? 'bg-uni-rose/15 border-uni-rose/40 text-white shadow-[0_0_8px_rgba(255,0,122,0.10)]'
                : 'bg-white/[0.04] border-white/[0.08] text-uni-text1 hover:bg-white/[0.07] hover:text-white/80'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
