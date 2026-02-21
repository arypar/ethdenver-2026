'use client';

import { useState, useMemo } from 'react';
import { GlowCard } from '@/components/glow-card';
import { PillButton } from '@/components/pill-button';
import { PillSelect } from '@/components/pill-select';
import { PillInput } from '@/components/pill-input';
import { ConditionRow } from './condition-row';
import { ActionRow } from './action-row';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Zap, Filter, Play, Layers } from 'lucide-react';
import type { Rule, TriggerType, Pool, RuleCondition, RuleAction, ChainId } from '@/lib/types';

const TRIGGERS: TriggerType[] = ['Swap', 'Liquidity Added', 'Liquidity Removed'];
const CHAINS: ChainId[] = ['eth', 'monad'];
const ETH_POOLS: Pool[] = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'ARB/USDC', 'LINK/ETH', 'MATIC/USDC'];

interface RuleComposerProps {
  connected: boolean;
  onActivate: (rule: Rule) => void;
  onConnectRequired: () => void;
  editingRule?: Rule | null;
}

export function RuleComposer({ connected, onActivate, onConnectRequired, editingRule }: RuleComposerProps) {
  const [name, setName] = useState(editingRule?.name || '');
  const [chain, setChain] = useState<ChainId>(editingRule?.trigger.chain || 'eth');
  const [triggerType, setTriggerType] = useState<TriggerType>(editingRule?.trigger.type || 'Swap');
  const [pool, setPool] = useState<Pool>(editingRule?.trigger.pool || 'WETH/USDC');
  const [monadToken, setMonadToken] = useState(chain === 'monad' ? editingRule?.trigger.pool || '' : '');
  const [watchWallet, setWatchWallet] = useState(editingRule?.trigger.watchedWallet || '');
  const [showWallet, setShowWallet] = useState(!!editingRule?.trigger.watchedWallet);
  const [conditions, setConditions] = useState<RuleCondition[]>(editingRule?.conditions || []);
  const [actions, setActions] = useState<RuleAction[]>(editingRule?.actions || []);

  const effectivePool = chain === 'monad' ? monadToken : pool;

  const addCondition = () => {
    setConditions(prev => [...prev, {
      id: crypto.randomUUID(),
      field: 'Notional USD',
      operator: '>',
      value: '',
    }]);
  };

  const addAction = () => {
    setActions(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'Create Alert',
      config: {},
    }]);
  };

  const ruleSummary = useMemo(() => {
    const parts: string[] = [];
    const poolLabel = chain === 'monad' ? (monadToken ? `${monadToken.slice(0, 10)}...` : '?') : pool;
    parts.push(`WHEN ${triggerType} on ${poolLabel} (${chain})`);
    if (conditions.length > 0) {
      const condStr = conditions
        .filter(c => c.value)
        .map(c => `${c.field} ${c.operator} ${c.value}${c.window ? ` in ${c.window}` : ''}`)
        .join(' AND ');
      if (condStr) parts.push(`CHECK ${condStr}`);
    }
    if (actions.length > 0) {
      parts.push(`DO ${actions.map(a => a.type).join(', ')}`);
    }
    return parts.join(' → ');
  }, [triggerType, pool, monadToken, chain, conditions, actions]);

  const handleActivate = () => {
    if (!connected) {
      onConnectRequired();
      return;
    }
    const rule: Rule = {
      id: editingRule?.id || crypto.randomUUID(),
      name: name || 'Untitled Rule',
      enabled: true,
      trigger: {
        type: triggerType,
        pool: effectivePool,
        chain,
        watchedWallet: showWallet && watchWallet ? watchWallet : undefined,
      },
      conditions,
      actions,
      createdAt: editingRule?.createdAt || Date.now(),
    };
    onActivate(rule);
    if (!editingRule) {
      setName('');
      setConditions([]);
      setActions([]);
    }
  };

  return (
    <GlowCard className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-uni-text0 tracking-tight flex items-center gap-2">
          <Layers className="w-4 h-4 text-uni-rose" />
          Rule Composer
        </h2>
      </div>

      <div className="flex gap-3 items-end">
        <PillInput
          label="Rule Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My trading rule..."
          className="flex-1"
        />
        <PillButton variant="primary" onClick={handleActivate}>
          <Zap className="w-4 h-4" />
          Activate
        </PillButton>
      </div>

      {/* WHEN block */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="bg-uni-rose/8 px-4 py-2 flex items-center gap-2 border-b border-white/[0.06]">
          <Zap className="w-3.5 h-3.5 text-uni-rose" />
          <span className="text-xs font-semibold text-uni-rose uppercase tracking-wider">When</span>
          <span className="text-xs text-uni-text1 ml-1">Trigger</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <PillSelect label="Chain" options={CHAINS} value={chain} onChange={v => { setChain(v); if (v === 'eth') setMonadToken(''); }} compact />
          <PillSelect label="Trigger Type" options={TRIGGERS} value={triggerType} onChange={setTriggerType} compact />
          {chain === 'eth' ? (
            <PillSelect label="Pool" options={ETH_POOLS} value={pool} onChange={setPool} compact />
          ) : (
            <PillInput
              label="Token Address"
              value={monadToken}
              onChange={e => setMonadToken(e.target.value)}
              placeholder="0x... (nad.fun token)"
            />
          )}
          <div className="flex items-center gap-3">
            <Switch
              checked={showWallet}
              onCheckedChange={setShowWallet}
              className="data-[state=checked]:bg-uni-rose"
            />
            <span className="text-xs text-uni-text1">Watch specific wallet</span>
          </div>
          {showWallet && (
            <PillInput
              value={watchWallet}
              onChange={e => setWatchWallet(e.target.value)}
              placeholder="0x..."
            />
          )}
        </div>
      </div>

      {/* CHECK block */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="bg-uni-charm/8 px-4 py-2 flex items-center gap-2 border-b border-white/[0.06]">
          <Filter className="w-3.5 h-3.5 text-uni-charm" />
          <span className="text-xs font-semibold text-uni-charm uppercase tracking-wider">Check</span>
          <span className="text-xs text-uni-text1 ml-1">Conditions</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {conditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              onChange={updated => {
                const next = [...conditions];
                next[i] = updated;
                setConditions(next);
              }}
              onRemove={() => setConditions(conditions.filter((_, j) => j !== i))}
            />
          ))}
          <PillButton variant="ghost" size="sm" onClick={addCondition} className="self-start">
            <Plus className="w-3.5 h-3.5" />
            Add condition
          </PillButton>
        </div>
      </div>

      {/* DO block */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="bg-green-500/8 px-4 py-2 flex items-center gap-2 border-b border-white/[0.06]">
          <Play className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Do</span>
          <span className="text-xs text-uni-text1 ml-1">Actions</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {actions.map((a, i) => (
            <ActionRow
              key={a.id}
              action={a}
              onChange={updated => {
                const next = [...actions];
                next[i] = updated;
                setActions(next);
              }}
              onRemove={() => setActions(actions.filter((_, j) => j !== i))}
            />
          ))}
          <PillButton variant="ghost" size="sm" onClick={addAction} className="self-start">
            <Plus className="w-3.5 h-3.5" />
            Add action
          </PillButton>
        </div>
      </div>

      {/* Summary */}
      {(conditions.length > 0 || actions.length > 0) && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3">
          <span className="text-[11px] text-uni-text1 uppercase tracking-wider font-medium block mb-1">Rule Summary</span>
          <p className="text-xs text-uni-text0/80 leading-relaxed">{ruleSummary}</p>
        </div>
      )}
    </GlowCard>
  );
}
