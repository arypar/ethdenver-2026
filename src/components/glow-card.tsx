'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlowCard({ children, className, hover = true }: GlowCardProps) {
  return (
    <div
      className={cn(
        'glow-card rounded-[20px] p-6',
        hover && 'transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_0_30px_rgba(255,0,122,0.06)]',
        className
      )}
    >
      {children}
    </div>
  );
}
