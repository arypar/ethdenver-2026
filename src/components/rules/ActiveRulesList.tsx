'use client';

import { Button } from '@/components/ui/button';
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
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-white">Active Rules</h3>
        <p className="text-[12px] text-white/30 mt-0.5">{rules.length} rule{rules.length !== 1 ? 's' : ''}</p>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <ShieldCheck className="h-4.5 w-4.5 text-white/15" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-white/60">No rules yet</p>
          <p className="mt-0.5 text-[12px] text-white/25">Create your first rule to get started.</p>
        </div>
      ) : (
        <div className="px-2 pb-2">
          {rules.map(rule => (
            <div key={rule.id} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-white/[0.04]">
              <Switch checked={rule.enabled} onCheckedChange={v => onToggle(rule.id, v)} />
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium text-white/80">{rule.name}</span>
                <p className="text-[11px] text-white/25 truncate mt-0.5">
                  {rule.trigger.pool}
                  {rule.conditions.length > 0 && ` · ${rule.conditions.map(c => `price ${c.operator} $${c.value}`).join(', ')}`}
                  {rule.actions.length > 0 && ` · ${rule.actions.map(a => a.type).join(', ')}`}
                </p>
              </div>
              <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <Button variant="ghost" size="icon-xs" onClick={() => onSimulate(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Zap className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onEdit(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Edit3 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(rule.id)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Copy className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onDelete(rule.id)} className="text-white/20 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
