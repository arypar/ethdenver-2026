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

  { type: 'Create Alert', category: 'action', label: 'Create Alert' },
  { type: 'Recommend Swap', category: 'action', label: 'Recommend Swap' },
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

export function createDefaultConfig(category: BlockCategory, type: string): Record<string, string | number> {
  if (category === 'trigger') {
    return { pool: 'WETH/USDC' };
  }
  if (category === 'condition') {
    return { operator: '>', value: '' };
  }
  if (type === 'Recommend Swap') return { token: '', amount: '' };
  return { message: '' };
}
