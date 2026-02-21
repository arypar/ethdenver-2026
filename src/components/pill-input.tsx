'use client';

import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

interface PillInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function PillInput({ label, className, ...props }: PillInputProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-uni-text1 tracking-wide uppercase">{label}</span>}
      <input
        className={cn(
          'rounded-full bg-white/[0.04] border border-white/[0.08] px-4 py-2 text-sm text-uni-text0 placeholder:text-uni-text1/50',
          'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[rgba(255,0,122,0.35)] focus:border-uni-rose/30 focus:bg-white/[0.06]'
        )}
        {...props}
      />
    </div>
  );
}
