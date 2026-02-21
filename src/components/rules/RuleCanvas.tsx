'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RuleBlock } from './RuleBlock';
import { cn } from '@/lib/utils';
import { ArrowDown, Blocks } from 'lucide-react';
import type { CanvasBlock } from './block-types';

interface RuleCanvasProps {
  name: string;
  onNameChange: (name: string) => void;
  blocks: CanvasBlock[];
  onUpdateBlock: (id: string, config: Record<string, string | number>) => void;
  onRemoveBlock: (id: string) => void;
  onActivate: () => void;
  canActivate: boolean;
}

export function RuleCanvas({ name, onNameChange, blocks, onUpdateBlock, onRemoveBlock, onActivate, canActivate }: RuleCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  const triggers = blocks.filter(b => b.category === 'trigger');
  const conditions = blocks.filter(b => b.category === 'condition');
  const actions = blocks.filter(b => b.category === 'action');
  const hasBlocks = blocks.length > 0;

  const poolName = triggers[0] ? String(triggers[0].config.pool || '') : '';
  const poolTokens = poolName.includes('/') ? poolName.split('/') : [];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[520px] rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-200',
        isOver ? 'ring-2 ring-primary/20 border-primary/20' : ''
      )}
      style={{
        background: `
          radial-gradient(ellipse at 15% 30%, rgba(244,63,94,0.04), transparent 50%),
          radial-gradient(ellipse at 85% 20%, rgba(99,102,241,0.04), transparent 50%),
          radial-gradient(ellipse at 50% 85%, rgba(16,185,129,0.03), transparent 50%),
          rgba(8,8,15,0.6)
        `,
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />

      <div className="relative z-10 p-5 flex flex-col gap-4">
        <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Rule name..."
          className="h-10 bg-white/[0.05] border-white/[0.08] backdrop-blur-xl text-[14px] font-medium text-white rounded-xl placeholder:text-white/20" />

        {hasBlocks ? (
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {triggers.length > 0 && (
                <BlockSection label="WHEN" color="text-rose-400">
                  {triggers.map(block => <RuleBlock key={block.id} block={block} onUpdate={onUpdateBlock} onRemove={onRemoveBlock} />)}
                </BlockSection>
              )}
              {triggers.length > 0 && conditions.length > 0 && <Connector />}
              {conditions.length > 0 && (
                <BlockSection label="IF" color="text-indigo-400">
                  {conditions.map(block => <RuleBlock key={block.id} block={block} onUpdate={onUpdateBlock} onRemove={onRemoveBlock} />)}
                </BlockSection>
              )}
              {(triggers.length > 0 || conditions.length > 0) && actions.length > 0 && <Connector />}
              {actions.length > 0 && (
                <BlockSection label="THEN" color="text-emerald-400">
                  {actions.map(block => <RuleBlock key={block.id} block={block} onUpdate={onUpdateBlock} onRemove={onRemoveBlock} poolTokens={poolTokens} />)}
                </BlockSection>
              )}
            </div>
          </SortableContext>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
              <Blocks className="h-6 w-6 text-white/15" />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-white/60">Drop blocks here</p>
            <p className="mt-1 max-w-[260px] text-[13px] text-white/25">
              Drag blocks from the palette or click to add them to this canvas.
            </p>
          </div>
        )}

        {hasBlocks && (
          <Button className="w-full rounded-xl h-11 text-[13px] font-semibold mt-2" onClick={onActivate} disabled={!canActivate}
            style={{ boxShadow: canActivate ? '0 0 24px rgba(255,0,122,0.25)' : undefined }}>
            Activate Rule
          </Button>
        )}
      </div>
    </div>
  );
}

function BlockSection({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className={cn('text-[10px] font-bold uppercase tracking-[0.1em] px-1', color)}>{label}</span>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="h-4 w-px bg-white/10" />
      <ArrowDown className="h-3 w-3 text-white/15" />
      <div className="h-2 w-px bg-white/10" />
    </div>
  );
}
