'use client';

import { useState, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { BlockPalette } from './BlockPalette';
import { RuleCanvas } from './RuleCanvas';
import { DragOverlayBlock } from './RuleBlock';
import { ActiveRulesList } from './ActiveRulesList';
import {
  PALETTE_ITEMS, createDefaultConfig, getBlockError,
  type CanvasBlock, type PaletteItem, type BlockCategory,
} from './block-types';
import type { ChainId, Rule, TriggerType, Pool, ConditionField, ConditionOperator, ActionType, ConditionLogic, WindowSize } from '@/lib/types';

interface RulesTabProps {
  connected: boolean;
  rules: Rule[];
  onAddRule: (rule: Rule) => void;
  onUpdateRule: (id: string, updates: Partial<Rule>) => void;
  onRemoveRule: (id: string) => void;
  onDuplicateRule: (id: string) => void;
  onSimulateTrigger: (rule: Rule) => void;
  onConnectRequired: () => void;
}

export function RulesTab({
  connected, rules, onAddRule, onUpdateRule, onRemoveRule,
  onDuplicateRule, onSimulateTrigger, onConnectRequired,
}: RulesTabProps) {
  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [conditionLogic, setConditionLogic] = useState<ConditionLogic>('AND');
  const [activeDrag, setActiveDrag] = useState<{ category: BlockCategory; type: string } | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const addBlock = useCallback((item: PaletteItem) => {
    const newBlock: CanvasBlock = {
      id: crypto.randomUUID(),
      category: item.category,
      type: item.type,
      config: createDefaultConfig(item.category, item.type),
    };
    setBlocks(prev => {
      const base = item.category === 'trigger'
        ? prev.filter(b => b.category !== 'trigger')
        : prev;
      const sorted = [...base, newBlock];
      sorted.sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
      return sorted;
    });
  }, []);

  const updateBlock = useCallback((id: string, config: Record<string, string | number>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, config } : b));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('palette-')) {
      const item = PALETTE_ITEMS.find(p => `palette-${p.type}` === id);
      if (item) setActiveDrag({ category: item.category, type: item.type });
    } else {
      const block = blocks.find(b => b.id === id);
      if (block) setActiveDrag({ category: block.category, type: block.type });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('palette-')) {
      const item = PALETTE_ITEMS.find(p => `palette-${p.type}` === activeId);
      if (item && (overId === 'canvas' || blocks.some(b => b.id === overId))) {
        addBlock(item);
      }
      return;
    }

    const activeBlock = blocks.find(b => b.id === activeId);
    const overBlock = blocks.find(b => b.id === overId);
    if (activeBlock && overBlock && activeBlock.category === overBlock.category && activeId !== overId) {
      setBlocks(prev => {
        const oldIdx = prev.findIndex(b => b.id === activeId);
        const newIdx = prev.findIndex(b => b.id === overId);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleActivate = () => {
    if (!connected) { onConnectRequired(); return; }
    const rule = convertBlocksToRule(name, blocks, editingRuleId, conditionLogic);
    if (editingRuleId) {
      onUpdateRule(rule.id, rule);
      setEditingRuleId(null);
    } else {
      onAddRule(rule);
    }
    setName('');
    setBlocks([]);
    setConditionLogic('AND');
  };

  const handleEdit = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setName(rule.name);
    setConditionLogic(rule.conditionLogic || 'AND');
    setBlocks(convertRuleToBlocks(rule));
  };

  const hasTriggersAndActions = blocks.some(b => b.category === 'trigger') && blocks.some(b => b.category === 'action');
  const allBlocksValid = blocks.length > 0 && blocks.every(b => getBlockError(b) === null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Rules Builder</h1>
        <p className="mt-1 text-[13px] text-white/40">Set price alerts and swap recommendations for any pool.</p>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <div className="lg:sticky lg:top-[80px] lg:self-start">
            <BlockPalette onClickAdd={addBlock} />
          </div>
          <RuleCanvas name={name} onNameChange={setName} blocks={blocks} onUpdateBlock={updateBlock} onRemoveBlock={removeBlock} onActivate={handleActivate} canActivate={hasTriggersAndActions && allBlocksValid} conditionLogic={conditionLogic} onConditionLogicChange={setConditionLogic} />
        </div>

        <ActiveRulesList rules={rules} onToggle={(id, enabled) => onUpdateRule(id, { enabled })} onEdit={handleEdit} onDuplicate={onDuplicateRule} onDelete={onRemoveRule} onSimulate={onSimulateTrigger} />

        <DragOverlay dropAnimation={null}>
          {activeDrag && <DragOverlayBlock category={activeDrag.category} type={activeDrag.type} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function categoryOrder(cat: BlockCategory): number {
  if (cat === 'trigger') return 0;
  if (cat === 'condition') return 1;
  return 2;
}

function convertBlocksToRule(name: string, blocks: CanvasBlock[], existingId: string | null, conditionLogic: ConditionLogic): Rule {
  const triggers = blocks.filter(b => b.category === 'trigger');
  const conditions = blocks.filter(b => b.category === 'condition');
  const actions = blocks.filter(b => b.category === 'action');
  const t = triggers[0];
  return {
    id: existingId || crypto.randomUUID(),
    name: name || 'Untitled Rule',
    enabled: true,
    trigger: {
      type: 'Swap' as TriggerType,
      pool: (String(t?.config.pool) || 'WETH/USDC') as Pool,
      chain: (String(t?.config.chain) || 'eth') as ChainId,
    },
    conditions: conditions.map(c => ({
      id: c.id,
      field: c.type as ConditionField,
      operator: (String(c.config.operator) || '>') as ConditionOperator,
      value: String(c.config.value || ''),
      ...(c.config.window ? { window: String(c.config.window) as WindowSize } : {}),
    })),
    conditionLogic,
    actions: actions.map(a => ({
      id: a.id, type: a.type as ActionType,
      config: Object.fromEntries(Object.entries(a.config).map(([k, v]) => [k, typeof v === 'number' ? v : String(v)])),
    })),
    createdAt: Date.now(),
  };
}

function convertRuleToBlocks(rule: Rule): CanvasBlock[] {
  const blocks: CanvasBlock[] = [];
  blocks.push({ id: crypto.randomUUID(), category: 'trigger', type: 'Pool', config: { pool: rule.trigger.pool, chain: rule.trigger.chain || 'eth' } });
  for (const c of rule.conditions) {
    const config: Record<string, string | number> = { operator: c.operator, value: c.value };
    if (c.window) config.window = c.window;
    blocks.push({ id: c.id, category: 'condition', type: c.field, config });
  }
  for (const a of rule.actions) {
    blocks.push({ id: a.id, category: 'action', type: a.type,
      config: Object.fromEntries(Object.entries(a.config).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as string | number])) });
  }
  return blocks;
}
