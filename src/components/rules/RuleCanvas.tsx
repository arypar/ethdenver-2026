'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RuleBlock } from './RuleBlock';
import { cn } from '@/lib/utils';
import { MousePointerClick, Sparkles } from 'lucide-react';
import type { CanvasBlock, BlockCategory } from './block-types';

interface RuleCanvasProps {
  name: string;
  onNameChange: (name: string) => void;
  blocks: CanvasBlock[];
  onUpdateBlock: (id: string, config: Record<string, string | number>) => void;
  onRemoveBlock: (id: string) => void;
  onActivate: () => void;
  canActivate: boolean;
}

const ENERGY_COLORS: Record<BlockCategory, { solid: string; rgb: string }> = {
  trigger: { solid: 'rgb(244, 63, 94)', rgb: '244, 63, 94' },
  condition: { solid: 'rgb(99, 102, 241)', rgb: '99, 102, 241' },
  action: { solid: 'rgb(16, 185, 129)', rgb: '16, 185, 129' },
};

const SECTION_CONFIG: Record<BlockCategory, { label: string; color: string; emptyHint: string }> = {
  trigger: { label: 'WHEN', color: 'text-rose-400', emptyHint: 'Add trigger' },
  condition: { label: 'IF', color: 'text-indigo-400', emptyHint: 'Add conditions' },
  action: { label: 'THEN', color: 'text-emerald-400', emptyHint: 'Add actions' },
};

interface FlowLine {
  id: string;
  d: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromCategory: BlockCategory;
  toCategory: BlockCategory;
}

export function RuleCanvas({ name, onNameChange, blocks, onUpdateBlock, onRemoveBlock, onActivate, canActivate }: RuleCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  const triggers = blocks.filter(b => b.category === 'trigger');
  const conditions = blocks.filter(b => b.category === 'condition');
  const actions = blocks.filter(b => b.category === 'action');
  const hasBlocks = blocks.length > 0;

  const poolName = triggers[0] ? String(triggers[0].config.pool || '') : '';
  const poolTokens = poolName.includes('/') ? poolName.split('/') : [];

  const gridRef = useRef<HTMLDivElement>(null);
  const [flowLines, setFlowLines] = useState<FlowLine[]>([]);
  const [dots, setDots] = useState<{ x: number; y: number; category: BlockCategory }[]>([]);

  const measure = useCallback(() => {
    const container = gridRef.current;
    if (!container || blocks.length === 0) {
      setFlowLines([]);
      setDots([]);
      return;
    }

    const rect = container.getBoundingClientRect();

    const getPositions = (category: string) => {
      const els = container.querySelectorAll(`[data-block-category="${category}"]`);
      return Array.from(els).map(el => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - rect.left,
          right: r.right - rect.left,
          centerY: r.top - rect.top + r.height / 2,
        };
      });
    };

    const tPos = getPositions('trigger');
    const cPos = getPositions('condition');
    const aPos = getPositions('action');

    const newLines: FlowLine[] = [];
    const newDots: { x: number; y: number; category: BlockCategory }[] = [];
    let idx = 0;

    if (tPos.length > 0 && cPos.length > 0) {
      const t = tPos[0];
      const sx = t.right + 2;
      newDots.push({ x: sx, y: t.centerY, category: 'trigger' });

      cPos.forEach(c => {
        const ex = c.left - 2;
        const midX = (sx + ex) / 2;
        newLines.push({
          id: `tc-${idx++}`,
          d: `M ${sx} ${t.centerY} C ${midX} ${t.centerY}, ${midX} ${c.centerY}, ${ex} ${c.centerY}`,
          from: { x: sx, y: t.centerY },
          to: { x: ex, y: c.centerY },
          fromCategory: 'trigger',
          toCategory: 'condition',
        });
        newDots.push({ x: ex, y: c.centerY, category: 'condition' });
      });
    }

    const sources = cPos.length > 0
      ? cPos.map(p => ({ ...p, cat: 'condition' as BlockCategory }))
      : tPos.length > 0
        ? tPos.map(p => ({ ...p, cat: 'trigger' as BlockCategory }))
        : [];

    if (sources.length > 0 && aPos.length > 0) {
      sources.forEach(s => {
        const sx = s.right + 2;
        newDots.push({ x: sx, y: s.centerY, category: s.cat });

        aPos.forEach(a => {
          const ex = a.left - 2;
          const midX = (sx + ex) / 2;
          newLines.push({
            id: `sa-${idx++}`,
            d: `M ${sx} ${s.centerY} C ${midX} ${s.centerY}, ${midX} ${a.centerY}, ${ex} ${a.centerY}`,
            from: { x: sx, y: s.centerY },
            to: { x: ex, y: a.centerY },
            fromCategory: s.cat,
            toCategory: 'action',
          });
          newDots.push({ x: ex, y: a.centerY, category: 'action' });
        });
      });
    }

    const dotKeys = new Set<string>();
    const uniqueDots = newDots.filter(d => {
      const key = `${Math.round(d.x)}-${Math.round(d.y)}`;
      if (dotKeys.has(key)) return false;
      dotKeys.add(key);
      return true;
    });

    setFlowLines(newLines);
    setDots(uniqueDots);
  }, [blocks]);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => requestAnimationFrame(measure));
    if (gridRef.current) observer.observe(gridRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <Input
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Rule name..."
        className="h-11 bg-white/[0.04] border-white/[0.08] backdrop-blur-xl text-[14px] font-medium text-white rounded-xl placeholder:text-white/20 focus:border-white/[0.15] transition-colors"
      />

      <div
        ref={setNodeRef}
        className={cn(
          'relative rounded-2xl border transition-all duration-200 flex-1 flex flex-col',
          isOver
            ? 'border-primary/30 bg-primary/[0.04]'
            : hasBlocks
              ? 'border-white/[0.06] bg-white/[0.02]'
              : 'border-dashed border-white/[0.08] bg-white/[0.015]'
        )}
      >
        {/* Grid canvas background — clipped separately */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 p-5 flex flex-col gap-4 flex-1">
          {hasBlocks ? (
            <>
              <div ref={gridRef} className="relative">
                <FlowSVG lines={flowLines} dots={dots} />

                <div className="relative grid grid-cols-3 gap-10" style={{ zIndex: 2 }}>
                  <SortableContext items={triggers.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <BlockColumn
                      category="trigger"
                      blocks={triggers}
                      onUpdate={onUpdateBlock}
                      onRemove={onRemoveBlock}
                    />
                  </SortableContext>
                  <SortableContext items={conditions.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <BlockColumn
                      category="condition"
                      blocks={conditions}
                      onUpdate={onUpdateBlock}
                      onRemove={onRemoveBlock}
                    />
                  </SortableContext>
                  <SortableContext items={actions.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <BlockColumn
                      category="action"
                      blocks={actions}
                      onUpdate={onUpdateBlock}
                      onRemove={onRemoveBlock}
                      poolTokens={poolTokens}
                    />
                  </SortableContext>
                </div>
              </div>

              <Button
                className="w-full rounded-xl h-10 text-[13px] font-semibold"
                onClick={onActivate}
                disabled={!canActivate}
                style={{ boxShadow: canActivate ? '0 0 20px rgba(255,0,122,0.2)' : undefined }}
              >
                Activate Rule
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <MousePointerClick className="h-5 w-5 text-white/20" />
                </div>
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                  <Sparkles className="h-2.5 w-2.5 text-primary" />
                </div>
              </div>
              <p className="mt-4 text-[13px] font-medium text-white/50">Drop blocks here</p>
              <p className="mt-1 max-w-[240px] text-[12px] text-white/20 leading-relaxed">
                Drag from the palette or click a block to start building your rule.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Column ── */

function BlockColumn({ category, blocks, onUpdate, onRemove, poolTokens }: {
  category: BlockCategory;
  blocks: CanvasBlock[];
  onUpdate: (id: string, config: Record<string, string | number>) => void;
  onRemove: (id: string) => void;
  poolTokens?: string[];
}) {
  const energy = ENERGY_COLORS[category];
  const section = SECTION_CONFIG[category];
  const populated = blocks.length > 0;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 px-1 mb-0.5">
        <div
          className="shrink-0 rounded-full"
          style={{
            width: 7,
            height: 7,
            backgroundColor: populated ? energy.solid : `rgba(${energy.rgb}, 0.25)`,
            boxShadow: populated ? `0 0 6px ${energy.solid}` : 'none',
            animation: populated ? 'energy-node-pulse 2.5s ease-in-out infinite' : 'none',
          }}
        />
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.1em]',
            populated ? section.color : 'text-white/20'
          )}
        >
          {section.label}
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: populated
              ? `linear-gradient(to right, rgba(${energy.rgb}, 0.25), transparent)`
              : `linear-gradient(to right, rgba(255,255,255,0.04), transparent)`,
          }}
        />
      </div>

      {populated ? (
        <div className="flex flex-col gap-2">
          {blocks.map(block => (
            <RuleBlock
              key={block.id}
              block={block}
              onUpdate={onUpdate}
              onRemove={onRemove}
              poolTokens={poolTokens}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015] py-8 px-3 flex-1">
          <span className="text-[11px] text-white/15 text-center">{section.emptyHint}</span>
        </div>
      )}
    </div>
  );
}

/* ── SVG Flow Lines ── */

function FlowSVG({ lines, dots }: { lines: FlowLine[]; dots: { x: number; y: number; category: BlockCategory }[] }) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="grad-trigger-condition" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(244, 63, 94)" />
          <stop offset="100%" stopColor="rgb(99, 102, 241)" />
        </linearGradient>
        <linearGradient id="grad-trigger-action" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(244, 63, 94)" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" />
        </linearGradient>
        <linearGradient id="grad-condition-action" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(99, 102, 241)" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" />
        </linearGradient>
        <filter id="energy-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
      </defs>

      {lines.map((line, i) => {
        const gradId = `grad-${line.fromCategory}-${line.toCategory}`;
        const toColor = ENERGY_COLORS[line.toCategory];
        const duration = `${2 + (i % 3) * 0.5}s`;
        const delay = `${(i * 0.4) % 2}s`;

        return (
          <g key={line.id}>
            <path
              d={line.d}
              stroke={`url(#${gradId})`}
              strokeWidth={8}
              fill="none"
              opacity={0.08}
              filter="url(#energy-glow)"
            />
            <path
              id={`fp-${line.id}`}
              d={line.d}
              stroke={`url(#${gradId})`}
              strokeWidth={1.5}
              fill="none"
              opacity={0.55}
            />
            <circle r={2} fill={toColor.solid} opacity={0.9}>
              <animateMotion
                dur={duration}
                begin={delay}
                repeatCount="indefinite"
                calcMode="linear"
              >
                <mpath href={`#fp-${line.id}`} />
              </animateMotion>
            </circle>
            <circle r={5} fill={toColor.solid} opacity={0.15} filter="url(#energy-glow)">
              <animateMotion
                dur={duration}
                begin={delay}
                repeatCount="indefinite"
                calcMode="linear"
              >
                <mpath href={`#fp-${line.id}`} />
              </animateMotion>
            </circle>
          </g>
        );
      })}

      {dots.map((dot, i) => {
        const color = ENERGY_COLORS[dot.category];
        return (
          <g key={`dot-${i}`}>
            <circle
              cx={dot.x}
              cy={dot.y}
              r={4}
              fill={color.solid}
              opacity={0.2}
              filter="url(#energy-glow)"
            />
            <circle cx={dot.x} cy={dot.y} r={3} fill={color.solid} opacity={0.8}>
              <animate
                attributeName="opacity"
                values="0.5;0.9;0.5"
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="2.5;3.5;2.5"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
