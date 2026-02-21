export type BlockCategory = 'trigger' | 'condition' | 'action';

export interface PaletteItem {
  type: string;
  category: BlockCategory;
  label: string;
}

export interface CanvasBlock {
  id: string;
  category: BlockCategory;
  type: string;
  config: Record<string, string | number>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'Pool', category: 'trigger', label: 'Pool' },

  { type: 'Price', category: 'condition', label: 'Price Threshold' },
  { type: 'Volume', category: 'condition', label: 'Volume (USD)' },
  { type: 'Swap Count', category: 'condition', label: 'Swap Count' },

  { type: 'Create Alert', category: 'action', label: 'Create Alert' },
  { type: 'Swap', category: 'action', label: 'Swap' },
  { type: 'Add Liquidity', category: 'action', label: 'Add Liquidity' },
  { type: 'Remove Liquidity', category: 'action', label: 'Remove Liquidity' },
];

export const CATEGORY_META: Record<BlockCategory, { label: string; tagLabel: string; color: string; bg: string; border: string; dotColor: string; glow: string }> = {
  trigger: {
    label: 'Triggers',
    tagLabel: 'WHEN',
    color: 'text-rose-400',
    bg: 'bg-rose-500/[0.06]',
    border: 'border-rose-500/20',
    dotColor: 'bg-rose-400',
    glow: 'rgba(244,63,94,0.12)',
  },
  condition: {
    label: 'Conditions',
    tagLabel: 'IF',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/[0.06]',
    border: 'border-indigo-500/20',
    dotColor: 'bg-indigo-400',
    glow: 'rgba(99,102,241,0.12)',
  },
  action: {
    label: 'Actions',
    tagLabel: 'THEN',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/[0.06]',
    border: 'border-emerald-500/20',
    dotColor: 'bg-emerald-400',
    glow: 'rgba(16,185,129,0.12)',
  },
};

export function getBlockError(block: CanvasBlock): string | null {
  if (block.category === 'trigger') {
    const pool = String(block.config.pool || '').trim();
    const chain = String(block.config.chain || 'eth');
    if (chain === 'monad') {
      if (!pool.match(/^0x[a-fA-F0-9]{40}$/)) return 'Enter a valid token address';
    } else {
      if (!pool || !pool.includes('/')) return 'Select a valid pool pair';
    }
    return null;
  }
  if (block.category === 'condition') {
    const val = String(block.config.value || '').trim();
    if (block.type === 'Swap Count') {
      if (!val || isNaN(Number(val)) || Number(val) === 0) return 'Enter a count';
    } else {
      if (!val || isNaN(Number(val)) || Number(val) === 0) return 'Enter a value';
    }
    return null;
  }
  if (block.type === 'Swap') {
    const token = String(block.config.token || '').trim();
    const amount = String(block.config.amount || '').trim();
    if (!token) return 'Select a token';
    if (!amount || isNaN(Number(amount))) return 'Enter an amount';
    return null;
  }
  if (block.type === 'Add Liquidity' || block.type === 'Remove Liquidity') {
    const amount = String(block.config.amount || '').trim();
    if (!amount || isNaN(Number(amount))) return 'Enter an amount';
    const rangeLow = String(block.config.rangeLow || '').trim();
    const rangeHigh = String(block.config.rangeHigh || '').trim();
    if (block.type === 'Add Liquidity' && (!rangeLow || !rangeHigh)) return 'Set price range';
    if (block.type === 'Remove Liquidity') {
      const percent = String(block.config.percent || '').trim();
      if (!percent || isNaN(Number(percent)) || Number(percent) <= 0 || Number(percent) > 100) return 'Enter a valid % (1–100)';
    }
    return null;
  }
  const message = String(block.config.message || '').trim();
  if (!message) return 'Enter an alert message';
  return null;
}

export function createDefaultConfig(category: BlockCategory, type: string): Record<string, string | number> {
  if (category === 'trigger') {
    return { pool: 'WETH/USDC', chain: 'eth' };
  }
  if (category === 'condition') {
    if (type === 'Swap Count' || type === 'Volume') return { operator: '>', value: '', window: '5m' };
    return { operator: '>', value: '' };
  }
  if (type === 'Swap') return { token: '', amount: '' };
  if (type === 'Add Liquidity') return { amount: '', rangeLow: '', rangeHigh: '' };
  if (type === 'Remove Liquidity') return { percent: '100', amount: '' };
  return { message: '' };
}
