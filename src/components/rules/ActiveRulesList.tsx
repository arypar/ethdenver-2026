'use client';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Edit3, Copy, Trash2, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(255,0,122,0.03), transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.03), transparent 50%),
          rgba(8,8,15,0.4)
        `,
      }}
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-white/90">Active Rules</h3>
          <span className="inline-flex items-center rounded-full bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white/35 tabular-nums">
            {rules.length}
          </span>
        </div>
        {rules.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" style={{ color: 'rgba(52,211,153,0.5)' }} />
            {rules.filter(r => r.enabled).length} active
          </div>
        )}
      </div>

      <div className="h-px w-full bg-white/[0.04]" />

      {rules.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <ShieldCheck className="h-5 w-5 text-white/12" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-white/45">No rules configured</p>
          <p className="mt-1 max-w-[280px] text-[11px] text-white/20 leading-relaxed">
            Build your first rule above by dragging blocks onto the canvas, then activate it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 p-3">
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onToggle={onToggle} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onSimulate={onSimulate} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDuplicate, onDelete, onSimulate }: {
  rule: Rule;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (rule: Rule) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSimulate: (rule: Rule) => void;
}) {
  return (
    <div className={cn(
      'group relative rounded-xl border backdrop-blur-xl transition-all duration-200',
      rule.enabled
        ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12]'
        : 'border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] opacity-60 hover:opacity-100'
    )}>
      <div className="p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
            rule.enabled ? 'bg-emerald-400 animate-pulse-glow' : 'bg-white/15'
          )} style={rule.enabled ? { color: 'rgba(52,211,153,0.4)' } : undefined} />
          <span className="text-[13px] font-semibold text-white/85 truncate flex-1">{rule.name}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {rule.trigger.chain === 'monad' && (
            <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-purple-300/80">
              Monad
            </span>
          )}
          <TagPill color="rose" label={rule.trigger.chain === 'monad' ? `${rule.trigger.pool.slice(0, 6)}...${rule.trigger.pool.slice(-4)}` : rule.trigger.pool} />
          {rule.conditions.length > 0 && (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-white/12 shrink-0" />
              {rule.conditions.map(c => (
                <TagPill key={c.id} color="indigo" label={`price ${c.operator} $${c.value}`} />
              ))}
            </>
          )}
          {rule.actions.length > 0 && (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-white/12 shrink-0" />
              {rule.actions.map(a => (
                <TagPill key={a.id} color="emerald" label={a.type} />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <Switch checked={rule.enabled} onCheckedChange={v => onToggle(rule.id, v)} />
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <Button variant="ghost" size="icon-xs" onClick={() => onSimulate(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Zap className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Edit3 className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(rule.id)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Copy className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onDelete(rule.id)} className="text-white/20 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TAG_COLORS = {
  rose: 'bg-rose-500/[0.08] border-rose-500/20 text-rose-300/80',
  indigo: 'bg-indigo-500/[0.08] border-indigo-500/20 text-indigo-300/80',
  emerald: 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-300/80',
} as const;

function TagPill({ color, label }: { color: keyof typeof TAG_COLORS; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
      TAG_COLORS[color]
    )}>
      {label}
    </span>
  );
}
