'use client';

import { useState, useCallback } from 'react';
import { PoolInput } from '@/components/ui/pool-input';
import { Button } from '@/components/ui/button';
import { resolvePool } from '@/lib/uniswap-api';
import { Plus, Loader2 } from 'lucide-react';

interface AddPoolFormProps {
  onAdd: (pool: string, poolAddress: string) => void;
  existingPools: Set<string>;
}

export function AddPoolForm({ onAdd, existingPools }: AddPoolFormProps) {
  const [pool, setPool] = useState('/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = pool.split('/');
  const tokenA = parts[0] || '';
  const tokenB = parts[1] || '';
  const isValid = tokenA.length >= 2 && tokenB.length >= 2;
  const alreadyExists = existingPools.has(pool);

  const handleAdd = useCallback(async () => {
    if (!isValid || alreadyExists) return;
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolvePool(pool);
      onAdd(resolved.pool, resolved.poolAddress);
      setPool('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve pool');
    } finally {
      setLoading(false);
    }
  }, [pool, isValid, alreadyExists, onAdd]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.06em] text-white/25">
          Token Pair
        </label>
        <PoolInput value={pool} onChange={setPool} inputClassName="h-9" />
      </div>

      <Button
        className="h-9 w-full rounded-xl px-4 text-[13px] font-semibold"
        onClick={handleAdd}
        disabled={loading || !isValid || alreadyExists}
        style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {loading ? 'Resolving...' : alreadyExists ? 'Already tracked' : 'Add Pool'}
      </Button>

      {error && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-[11px] text-amber-400/80">{error}</p>
        </div>
      )}
    </div>
  );
}
