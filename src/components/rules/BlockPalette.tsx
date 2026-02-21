'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { GripVertical, Zap, Filter, Play } from 'lucide-react';
import { PALETTE_ITEMS, CATEGORY_META, type PaletteItem, type BlockCategory } from './block-types';

interface BlockPaletteProps {
  onClickAdd: (item: PaletteItem) => void;
}

const CATEGORY_ICONS: Record<BlockCategory, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  condition: Filter,
  action: Play,
};

export function BlockPalette({ onClickAdd }: BlockPaletteProps) {
  const categories: BlockCategory[] = ['trigger', 'condition', 'action'];

  return (
    <div className="flex flex-col gap-1">
      {categories.map((cat, idx) => {
        const meta = CATEGORY_META[cat];
        const Icon = CATEGORY_ICONS[cat];
        const items = PALETTE_ITEMS.filter(i => i.category === cat);

        return (
          <div key={cat}>
            {idx > 0 && <div className="h-px bg-white/[0.04] mx-2 my-3" />}
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Icon className={cn('h-3.5 w-3.5', meta.color)} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/30">
                {meta.label}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map(item => (
                <DraggablePaletteItem key={item.type} item={item} onClickAdd={onClickAdd} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DraggablePaletteItem({ item, onClickAdd }: { item: PaletteItem; onClickAdd: (item: PaletteItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { item },
  });

  const meta = CATEGORY_META[item.category];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClickAdd(item)}
      className={cn(
        'group flex cursor-grab items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150',
        'border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl',
        'hover:bg-white/[0.07] hover:border-white/[0.12] active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <GripVertical className="h-3 w-3 text-white/12 group-hover:text-white/30 transition-colors shrink-0" />
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-glow', meta.dotColor)} style={{ color: meta.glow, boxShadow: `0 0 4px ${meta.glow}` }} />
      <span className="text-[12px] font-medium text-white/55 group-hover:text-white/75 transition-colors">{item.label}</span>
    </div>
  );
}
