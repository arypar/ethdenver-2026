'use client';

import { GlowCard } from '@/components/glow-card';
import { PillButton } from '@/components/pill-button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Edit3, Copy, Trash2, Zap, ShieldCheck } from 'lucide-react';
import type { Rule } from '@/lib/types';

interface ActiveRulesListProps {
  rules: Rule[];
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (rule: Rule) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSimulate: (rule: Rule) => void;
}

export function ActiveRulesList({ rules, onToggle, onEdit, onDuplicate, onDelete, onSimulate }: ActiveRulesListProps) {
  if (rules.length === 0) {
    return (
      <GlowCard className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-uni-text1/50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-uni-text1">No active rules</p>
          <p className="text-xs text-uni-text1/60 mt-1">Compose a rule and activate it to get started</p>
        </div>
      </GlowCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-uni-text1 uppercase tracking-wider">
        Active Rules ({rules.length})
      </h3>
      {rules.map(rule => (
        <RuleCard
          key={rule.id}
          rule={rule}
          onToggle={enabled => onToggle(rule.id, enabled)}
          onEdit={() => onEdit(rule)}
          onDuplicate={() => onDuplicate(rule.id)}
          onDelete={() => onDelete(rule.id)}
          onSimulate={() => onSimulate(rule)}
        />
      ))}
    </div>
  );
}

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onSimulate,
}: {
  rule: Rule;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSimulate: () => void;
}) {
  return (
    <GlowCard className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={rule.enabled}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-uni-rose"
          />
          <span className="text-sm font-semibold text-uni-text0">{rule.name}</span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          rule.enabled
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-white/[0.04] text-uni-text1 border border-white/[0.06]'
        }`}>
          {rule.enabled ? 'Active' : 'Paused'}
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Badge className="rounded-full bg-uni-rose/10 text-uni-rose border-uni-rose/20 text-[11px] px-2 py-0">
          {rule.trigger.type}
        </Badge>
        <Badge className="rounded-full bg-white/[0.06] text-uni-text1 border-white/[0.08] text-[11px] px-2 py-0">
          {rule.trigger.pool}
        </Badge>
        {rule.conditions.length > 0 && (
          <Badge className="rounded-full bg-uni-charm/10 text-uni-charm border-uni-charm/20 text-[11px] px-2 py-0">
            {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
          </Badge>
        )}
        {rule.actions.length > 0 && (
          <Badge className="rounded-full bg-green-500/10 text-green-400 border-green-500/20 text-[11px] px-2 py-0">
            {rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <PillButton variant="secondary" size="sm" onClick={onSimulate}>
          <Zap className="w-3 h-3" />
          Simulate
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={onEdit}>
          <Edit3 className="w-3 h-3" />
          Edit
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={onDuplicate}>
          <Copy className="w-3 h-3" />
        </PillButton>
        <PillButton variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-red-400" />
        </PillButton>
      </div>
    </GlowCard>
  );
}
