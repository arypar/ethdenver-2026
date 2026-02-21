'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PoolInput } from '@/components/ui/pool-input';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type CanvasBlock, type BlockCategory } from './block-types';
import type { ConditionOperator } from '@/lib/types';

const GLASS_STYLES: Record<BlockCategory, { className: string; shadow: string }> = {
  trigger: {
    className: 'bg-rose-500/[0.06] border-rose-500/20',
    shadow: '0 0 24px rgba(244,63,94,0.08), inset 0 0 20px rgba(244,63,94,0.03)',
  },
  condition: {
    className: 'bg-indigo-500/[0.06] border-indigo-500/20',
    shadow: '0 0 24px rgba(99,102,241,0.08), inset 0 0 20px rgba(99,102,241,0.03)',
  },
  action: {
    className: 'bg-emerald-500/[0.06] border-emerald-500/20',
    shadow: '0 0 24px rgba(16,185,129,0.08), inset 0 0 20px rgba(16,185,129,0.03)',
  },
};

const INPUT_CLASS = 'h-8 bg-white/[0.06] border-white/[0.1] text-white/80 text-sm backdrop-blur-sm placeholder:text-white/20';

interface RuleBlockProps {
  block: CanvasBlock;
  onUpdate: (id: string, config: Record<string, string | number>) => void;
  onRemove: (id: string) => void;
  poolTokens?: string[];
}

export function RuleBlock({ block, onUpdate, onRemove, poolTokens }: RuleBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = CATEGORY_META[block.category];
  const glass = GLASS_STYLES[block.category];

  const updateField = (key: string, value: string | number) => {
    onUpdate(block.id, { ...block.config, [key]: value });
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, boxShadow: glass.shadow }}
      className={cn(
        'group relative rounded-2xl border backdrop-blur-xl transition-all duration-200',
        glass.className,
        isDragging && 'z-50 opacity-90 scale-[1.02]',
        !isDragging && 'hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div {...attributes} {...listeners}
          className="mt-0.5 cursor-grab rounded-md p-0.5 text-white/15 hover:text-white/30 hover:bg-white/[0.06] active:cursor-grabbing transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dotColor)} style={{ boxShadow: `0 0 6px ${meta.glow}` }} />
            <span className={cn('text-[10px] font-bold uppercase tracking-[0.08em]', meta.color)}>{meta.tagLabel}</span>
            <span className="text-[13px] font-semibold text-white/80">{block.type}</span>
          </div>
          <BlockConfig block={block} updateField={updateField} poolTokens={poolTokens} />
        </div>

        <button onClick={() => onRemove(block.id)}
          className="rounded-lg p-1 text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function BlockConfig({ block, updateField, poolTokens }: { block: CanvasBlock; updateField: (key: string, value: string | number) => void; poolTokens?: string[] }) {
  if (block.category === 'trigger') {
    return (
      <PoolInput
        value={String(block.config.pool || 'WETH/USDC')}
        onChange={pool => updateField('pool', pool)}
        inputClassName="h-8"
      />
    );
  }

  if (block.category === 'condition') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/30 shrink-0">Price</span>
        <Select value={String(block.config.operator || '>')} onValueChange={v => updateField('operator', v)}>
          <SelectTrigger className={cn(INPUT_CLASS, 'w-[100px]')} size="sm"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value=">">above</SelectItem>
            <SelectItem value="<">below</SelectItem>
            <SelectItem value=">=">at or above</SelectItem>
            <SelectItem value="<=">at or below</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/30">$</span>
          <Input
            type="number"
            value={String(block.config.value || '')}
            onChange={e => updateField('value', e.target.value)}
            placeholder="0.00"
            className={cn(INPUT_CLASS, 'w-[120px] pl-6')}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'Recommend Swap') {
    const tokens = poolTokens && poolTokens.length > 0 ? poolTokens : ['Token A', 'Token B'];
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/30 shrink-0">Swap into</span>
        <Select value={String(block.config.token || '')} onValueChange={v => updateField('token', v)}>
          <SelectTrigger className={cn(INPUT_CLASS, 'w-[100px]')} size="sm">
            <SelectValue placeholder="Token" />
          </SelectTrigger>
          <SelectContent position="popper">
            {tokens.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/30">$</span>
          <Input
            type="number"
            value={String(block.config.amount || '')}
            onChange={e => updateField('amount', e.target.value)}
            placeholder="Amount"
            className={cn(INPUT_CLASS, 'w-[110px] pl-6')}
          />
        </div>
      </div>
    );
  }

  return <Input value={String(block.config.message || '')} onChange={e => updateField('message', e.target.value)} placeholder="Alert message" className={INPUT_CLASS} />;
}

export function DragOverlayBlock({ category, type }: { category: BlockCategory; type: string }) {
  const meta = CATEGORY_META[category];
  const glass = GLASS_STYLES[category];
  return (
    <div className={cn('rounded-2xl border backdrop-blur-xl px-4 py-3', glass.className)}
      style={{ boxShadow: glass.shadow }}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', meta.dotColor)} style={{ boxShadow: `0 0 6px ${meta.glow}` }} />
        <span className={cn('text-[10px] font-bold uppercase tracking-[0.08em]', meta.color)}>{meta.tagLabel}</span>
        <span className="text-[13px] font-semibold text-white/80">{type}</span>
      </div>
    </div>
  );
}
