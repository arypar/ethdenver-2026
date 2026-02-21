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
    <div className="relative rounded-2xl border border-white/[0.06] overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(255,0,122,0.04), transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.04), transparent 50%),
          rgba(8,8,15,0.5)
        `,
      }}>
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-white">Active Rules</h3>
          <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-white/40 tabular-nums">
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

      <div className="h-px w-full animate-shimmer" />

      {rules.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center px-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-white/[0.02]"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }} />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
              <ShieldCheck className="h-7 w-7 text-white/10" />
            </div>
          </div>
          <p className="mt-5 text-[14px] font-medium text-white/50">No rules configured</p>
          <p className="mt-1.5 max-w-[300px] text-[12px] text-white/20 leading-relaxed">
            Build your first rule above by dragging blocks onto the canvas, then activate it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-4 pb-4">
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
        ? 'border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.14]'
        : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] opacity-70 hover:opacity-100'
    )}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            'h-2 w-2 rounded-full shrink-0 transition-colors',
            rule.enabled ? 'bg-emerald-400 animate-pulse-glow' : 'bg-white/15'
          )} style={rule.enabled ? { color: 'rgba(52,211,153,0.4)' } : undefined} />
          <span className="text-[14px] font-semibold text-white/90 truncate flex-1">{rule.name}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <TagPill color="rose" label={rule.trigger.pool} />
          {rule.conditions.length > 0 && (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-white/15 shrink-0" />
              {rule.conditions.map(c => (
                <TagPill key={c.id} color="indigo" label={`price ${c.operator} $${c.value}`} />
              ))}
            </>
          )}
          {rule.actions.length > 0 && (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-white/15 shrink-0" />
              {rule.actions.map(a => (
                <TagPill key={a.id} color="emerald" label={a.type} />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
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
