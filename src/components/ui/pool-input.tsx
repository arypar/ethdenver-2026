'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PoolInputProps {
  value: string;
  onChange: (pool: string) => void;
  className?: string;
  inputClassName?: string;
}

export function PoolInput({ value, onChange, className, inputClassName }: PoolInputProps) {
  const parts = value.split('/');
  const tokenA = parts[0] || '';
  const tokenB = parts[1] || '';

  const update = (a: string, b: string) => {
    onChange(`${a.toUpperCase()}/${b.toUpperCase()}`);
  };

  const baseInput = cn(
    'bg-white/[0.05] border-white/[0.08] text-white/80 text-sm placeholder:text-white/20 text-center',
    inputClassName,
  );

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        value={tokenA}
        onChange={e => update(e.target.value.replace('/', ''), tokenB)}
        placeholder="WETH"
        className={cn(baseInput, 'w-[72px]')}
      />
      <span className="text-[13px] font-semibold text-white/25">/</span>
      <Input
        value={tokenB}
        onChange={e => update(tokenA, e.target.value.replace('/', ''))}
        placeholder="USDC"
        className={cn(baseInput, 'w-[72px]')}
      />
    </div>
  );
}
