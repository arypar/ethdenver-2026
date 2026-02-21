'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { GripVertical, Zap, Filter, Play, Layers } from 'lucide-react';
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
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02), transparent 60%),
          rgba(8,8,15,0.5)
        `,
      }}
    >
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Layers className="h-3.5 w-3.5 text-white/30" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-white/80">Blocks</h3>
          <p className="text-[10px] text-white/25 leading-none mt-0.5">Drag or click to add</p>
        </div>
      </div>

      <div className="h-px w-full bg-white/[0.05]" />

      <div className="p-3 flex flex-col gap-0.5">
        {categories.map((cat, idx) => {
          const meta = CATEGORY_META[cat];
          const Icon = CATEGORY_ICONS[cat];
          const items = PALETTE_ITEMS.filter(i => i.category === cat);

          return (
            <div key={cat}>
              {idx > 0 && <div className="h-px bg-white/[0.04] mx-1 my-2.5" />}
              <div className="mb-2 flex items-center gap-2 px-1.5">
                <Icon className={cn('h-3 w-3', meta.color)} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/30">
                  {meta.label}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map(item => (
                  <DraggablePaletteItem key={item.type} item={item} onClickAdd={onClickAdd} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
        'group flex cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150',
        'bg-transparent',
        'hover:bg-white/[0.05] active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <GripVertical className="h-3 w-3 text-white/10 group-hover:text-white/25 transition-colors shrink-0" />
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotColor)} style={{ boxShadow: `0 0 4px ${meta.glow}` }} />
      <span className="text-[12px] font-medium text-white/50 group-hover:text-white/75 transition-colors">{item.label}</span>
    </div>
  );
}
