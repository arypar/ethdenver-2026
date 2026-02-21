'use client';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Edit3, Copy, Trash2, Zap, ShieldCheck, ChevronRight } from 'lucide-react';
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-white/90">Active Rules</h3>
          <span className="inline-flex items-center rounded-full bg-white/[0.05] border border-white/[0.08] px-1.5 py-px text-[10px] font-medium text-white/30 tabular-nums">
            {rules.length}
          </span>
        </div>
        {rules.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" style={{ color: 'rgba(52,211,153,0.5)' }} />
            {rules.filter(r => r.enabled).length} active
          </div>
        )}
      </div>

      {rules.length === 0 ? (
        <div
          className="liquid-glass rounded-xl border border-white/[0.06]"
          style={{
            background: `
              radial-gradient(ellipse at 30% 0%, rgba(255,0,122,0.03), transparent 60%),
              radial-gradient(ellipse at 70% 100%, rgba(99,102,241,0.03), transparent 60%),
              rgba(255,255,255,0.015)
            `,
          }}
        >
          <div className="flex flex-col items-center py-10 text-center px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <ShieldCheck className="h-4 w-4 text-white/12" />
            </div>
            <p className="mt-2.5 text-[12px] font-medium text-white/40">No rules configured</p>
            <p className="mt-1 max-w-[260px] text-[10px] text-white/18 leading-relaxed">
              Build your first rule above, then activate it.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
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
  const poolLabel = rule.trigger.chain === 'monad'
    ? `${rule.trigger.pool.slice(0, 6)}...${rule.trigger.pool.slice(-4)}`
    : rule.trigger.pool;

  return (
    <div
      className={cn(
        'group relative rounded-xl border overflow-hidden transition-all duration-200',
        rule.enabled
          ? 'border-white/[0.07] hover:border-white/[0.13]'
          : 'border-white/[0.04] opacity-50 hover:opacity-90'
      )}
      style={{
        background: rule.enabled
          ? `
            radial-gradient(ellipse at 0% 0%, rgba(255,0,122,0.05), transparent 55%),
            radial-gradient(ellipse at 100% 100%, rgba(99,102,241,0.04), transparent 55%),
            rgba(255,255,255,0.018)
          `
          : 'rgba(255,255,255,0.012)',
        backdropFilter: 'blur(16px) saturate(120%)',
        WebkitBackdropFilter: 'blur(16px) saturate(120%)',
        boxShadow: rule.enabled
          ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 12px rgba(0,0,0,0.15)'
          : 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <div className="relative flex flex-col gap-2.5 p-3.5">
        {/* Name + toggle row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0',
              rule.enabled ? 'bg-emerald-400 animate-pulse-glow' : 'bg-white/15'
            )} style={rule.enabled ? { color: 'rgba(52,211,153,0.4)' } : undefined} />
            <span className="text-[12px] font-semibold text-white/85 truncate">{rule.name}</span>
          </div>
          <Switch checked={rule.enabled} onCheckedChange={v => onToggle(rule.id, v)} />
        </div>

        {/* Inline flow: pill → pill → pill */}
        <div className="flex items-center gap-1 flex-wrap">
          {rule.trigger.chain === 'monad' && (
            <>
              <Pill color="purple">{rule.trigger.pool.slice(0, 6)}...{rule.trigger.pool.slice(-4)}</Pill>
              <ChevronRight className="h-2.5 w-2.5 text-white/10 shrink-0" />
            </>
          )}
          {rule.trigger.chain !== 'monad' && (
            <>
              <Pill color="rose">{poolLabel}</Pill>
              <ChevronRight className="h-2.5 w-2.5 text-white/10 shrink-0" />
            </>
          )}
          {rule.conditions.map((c, i) => (
            <span key={c.id} className="contents">
              <Pill color="indigo">price {c.operator} ${c.value}</Pill>
              {(i < rule.conditions.length - 1 || rule.actions.length > 0) && (
                <ChevronRight className="h-2.5 w-2.5 text-white/10 shrink-0" />
              )}
            </span>
          ))}
          {rule.actions.map((a, i) => (
            <span key={a.id} className="contents">
              <Pill color="emerald">{a.type}</Pill>
              {i < rule.actions.length - 1 && (
                <ChevronRight className="h-2.5 w-2.5 text-white/10 shrink-0" />
              )}
            </span>
          ))}
        </div>

        {/* Hover actions */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 -mb-0.5">
          <Button variant="ghost" size="icon-xs" onClick={() => onSimulate(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Zap className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onEdit(rule)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Edit3 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(rule.id)} className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]"><Copy className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onDelete(rule.id)} className="text-white/20 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}

const PILL_COLORS = {
  rose: 'bg-rose-500/[0.08] border-rose-500/20 text-rose-300/80',
  indigo: 'bg-indigo-500/[0.08] border-indigo-500/20 text-indigo-300/80',
  emerald: 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-300/80',
  purple: 'bg-purple-500/[0.08] border-purple-500/20 text-purple-300/80',
} as const;

function Pill({ color, children }: { color: keyof typeof PILL_COLORS; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-1.5 py-px text-[10px] font-medium',
      PILL_COLORS[color]
    )}>
      {children}
    </span>
  );
}
