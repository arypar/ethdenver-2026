'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type CanvasBlock, type BlockCategory } from './block-types';
import type { ConditionOperator, WindowSize } from '@/lib/types';

const OPERATORS: ConditionOperator[] = ['>', '>=', '<', '<=', '='];
const WINDOWS: WindowSize[] = ['1m', '5m', '15m', '1h'];

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
}

export function RuleBlock({ block, onUpdate, onRemove }: RuleBlockProps) {
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
          <BlockConfig block={block} updateField={updateField} />
        </div>

        <button onClick={() => onRemove(block.id)}
          className="rounded-lg p-1 text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function BlockConfig({ block, updateField }: { block: CanvasBlock; updateField: (key: string, value: string | number) => void }) {
  if (block.category === 'trigger') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/30 shrink-0">Pool</span>
        <Input
          value={String(block.config.pool || 'WETH/USDC')}
          onChange={e => updateField('pool', e.target.value.toUpperCase())}
          placeholder="e.g. PEPE/WETH"
          className={cn(INPUT_CLASS, 'w-[140px]')}
        />
      </div>
    );
  }

  if (block.category === 'condition') {
    if (block.type === 'Swap Direction') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/30 shrink-0">Direction</span>
          <Select value={String(block.config.direction || 'Buy')} onValueChange={v => updateField('direction', v)}>
            <SelectTrigger className={cn(INPUT_CLASS)} size="sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="Buy">Buy</SelectItem>
              <SelectItem value="Sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    const showWindow = block.type === 'Count in Window';
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={String(block.config.operator || '>')} onValueChange={v => updateField('operator', v)}>
          <SelectTrigger className={cn(INPUT_CLASS, 'w-[68px]')} size="sm"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">{OPERATORS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={String(block.config.value || '')} onChange={e => updateField('value', e.target.value)} placeholder="Value" className={cn(INPUT_CLASS, 'w-[100px]')} />
        {showWindow && (
          <Select value={String(block.config.window || '5m')} onValueChange={v => updateField('window', v)}>
            <SelectTrigger className={cn(INPUT_CLASS, 'w-[76px]')} size="sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">{WINDOWS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
    );
  }

  if (block.type === 'Notify') {
    return <Input value={String(block.config.channel || '')} onChange={e => updateField('channel', e.target.value)} placeholder="Channel (e.g. #alerts)" className={INPUT_CLASS} />;
  }

  if (block.type === 'Recommend Swap' || block.type === 'Auto Swap') {
    return (
      <div className="flex items-center gap-2">
        <Input value={String(block.config.token || '')} onChange={e => updateField('token', e.target.value)} placeholder="Token" className={cn(INPUT_CLASS, 'w-[100px]')} />
        <Input type="number" value={block.config.percent?.toString() || ''} onChange={e => updateField('percent', Number(e.target.value))} placeholder="%" className={cn(INPUT_CLASS, 'w-[72px]')} />
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
