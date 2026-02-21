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
  { type: 'Swap', category: 'trigger', label: 'Swap Event' },

  { type: 'Notional USD', category: 'condition', label: 'Notional USD' },
  { type: 'Price Impact %', category: 'condition', label: 'Price Impact %' },
  { type: 'Swap Direction', category: 'condition', label: 'Swap Direction' },
  { type: 'Count in Window', category: 'condition', label: 'Count in Window' },

  { type: 'Create Alert', category: 'action', label: 'Create Alert' },
  { type: 'Notify', category: 'action', label: 'Notify Channel' },
  { type: 'Recommend Swap', category: 'action', label: 'Recommend Swap' },
  { type: 'Auto Swap', category: 'action', label: 'Auto Swap' },
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
    const base: Record<string, string | number> = { operator: '>', value: '' };
    if (type === 'Count in Window') {
      base.window = '5m';
    }
    if (type === 'Swap Direction') {
      return { direction: 'Buy' };
    }
    return base;
  }
  if (type === 'Notify') return { channel: '' };
  if (type === 'Recommend Swap' || type === 'Auto Swap') return { token: '', percent: 50 };
  return { message: '' };
}
