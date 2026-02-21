'use client';

import { cn } from '@/lib/utils';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function PillButton({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}: PillButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-ring whitespace-nowrap',
        {
          'gradient-primary text-white shadow-[0_0_16px_rgba(255,0,122,0.20)] hover:shadow-[0_0_24px_rgba(255,0,122,0.30)] hover:-translate-y-[1px] active:translate-y-0':
            variant === 'primary',
          'bg-white/[0.06] border border-white/[0.10] text-uni-text0 hover:bg-white/[0.10] hover:border-white/[0.16]':
            variant === 'secondary',
          'text-uni-text1 hover:text-white hover:bg-white/[0.06]':
            variant === 'ghost',
          'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25':
            variant === 'danger',
        },
        {
          'px-3 py-1 text-xs': size === 'sm',
          'px-5 py-2 text-sm': size === 'md',
          'px-6 py-2.5 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
