'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActionDetailDialog } from './ActionDetailDialog';
import { ExecuteDialog } from './ExecuteDialog';
import { cn } from '@/lib/utils';
import { Zap, Eye, PlayCircle, XCircle, Inbox, Radio, Trash2 } from 'lucide-react';
import type { ActionItem, ActionStatus, Rule } from '@/lib/types';
import { generateTriggerData } from '@/lib/mock-data';

type Filter = 'All' | 'Pending' | 'Completed' | 'Dismissed';
const FILTERS: Filter[] = ['All', 'Pending', 'Completed', 'Dismissed'];

interface ActionsInboxProps {
  actions: ActionItem[];
  rules: Rule[];
  connected: boolean;
  onUpdateStatus: (id: string, status: ActionStatus) => void;
  onAddAction: (action: ActionItem) => void;
  onClearAll: () => void;
  onConnectRequired: () => void;
}

export function ActionsInbox({ actions, rules, connected, onUpdateStatus, onAddAction, onClearAll, onConnectRequired }: ActionsInboxProps) {
  const [filter, setFilter] = useState<Filter>('All');
  const [reviewAction, setReviewAction] = useState<ActionItem | null>(null);
  const [executeState, setExecuteState] = useState<{ open: boolean; id: string; label: string; pool: string }>({ open: false, id: '', label: '', pool: '' });

  const filtered = actions.filter(a => filter === 'All' || a.status === filter);
  const liveCount = actions.filter(a => a.source === 'live').length;

  const simulateGlobal = () => {
    if (rules.length === 0) return;
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const trig = generateTriggerData(rule.name, rule.trigger.pool);
    onAddAction({ id: crypto.randomUUID(), ruleId: rule.id, ruleName: rule.name, status: 'Pending',
      triggerReason: trig.triggerReason, suggestedAction: trig.suggestedAction, timestamp: Date.now(), source: 'simulated',
      details: { eventType: rule.trigger.type, pool: rule.trigger.pool, conditionsMet: trig.conditionsMet, proposedActions: trig.proposedActions } });
  };

  const handleExecute = (id: string) => {
    if (!connected) { onConnectRequired(); return; }
    const a = actions.find(x => x.id === id);
    setExecuteState({ open: true, id, label: a?.suggestedAction || 'Action', pool: a?.details.pool || 'WETH/USDC' });
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Actions</h1>
          <p className="mt-1 text-[13px] text-white/40">
            {actions.filter(a => a.status === 'Pending').length} pending actions
            {liveCount > 0 && <span className="ml-2 text-emerald-400">{liveCount} from live swaps</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-0.5 backdrop-blur-xl">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                filter === f ? 'bg-white/[0.1] text-white shadow-sm' : 'text-white/30 hover:text-white/60'
              )}>{f}</button>
            ))}
          </div>
          {actions.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl text-[12px] font-semibold border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10" onClick={onClearAll}>
              <Trash2 className="h-3.5 w-3.5" /> Clear All
            </Button>
          )}
          <Button size="sm" className="rounded-xl text-[12px] font-semibold" onClick={simulateGlobal} disabled={rules.length === 0}
            style={{ boxShadow: '0 0 16px rgba(255,0,122,0.2)' }}>
            <Zap className="h-3.5 w-3.5" /> Simulate
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
            <Inbox className="h-6 w-6 text-white/20" />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-white/70">
            {filter === 'All' ? 'No actions yet' : `No ${filter.toLowerCase()} actions`}
          </p>
          <p className="mt-1 max-w-[260px] text-[13px] text-white/30">
            {rules.length === 0
              ? 'Create rules first. Enabled rules auto-fire on live swaps.'
              : 'Enabled rules fire automatically on live swap events. You can also use Simulate.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="p-2">
            {filtered.map(action => (
              <div key={action.id} className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-all hover:bg-white/[0.04]">
                <StatusDot status={action.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white/90 truncate">{action.ruleName}</span>
                    <SourceBadge source={action.source} />
                    <span className="text-[11px] text-white/25 shrink-0">
                      {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/30 truncate mt-0.5">{action.triggerReason}</p>
                  <p className="text-[12px] text-white/50 truncate">&rarr; {action.suggestedAction}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="xs" className="rounded-lg text-[11px] border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white" onClick={() => setReviewAction(action)}>
                    <Eye className="h-3 w-3" /> Review
                  </Button>
                  {action.status === 'Pending' && (
                    <>
                      <Button size="xs" className="rounded-lg text-[11px]" onClick={() => handleExecute(action.id)}
                        style={{ boxShadow: '0 0 12px rgba(255,0,122,0.2)' }}>
                        <PlayCircle className="h-3 w-3" /> Execute
                      </Button>
                      <Button variant="ghost" size="icon-xs" className="text-white/20 hover:text-white/60 hover:bg-white/[0.06]" onClick={() => onUpdateStatus(action.id, 'Dismissed')}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActionDetailDialog action={reviewAction} open={!!reviewAction} onClose={() => setReviewAction(null)} onExecute={handleExecute} connected={connected} onConnectRequired={onConnectRequired} />
      <ExecuteDialog open={executeState.open} onClose={() => setExecuteState({ open: false, id: '', label: '', pool: '' })} onConfirm={() => onUpdateStatus(executeState.id, 'Completed')} label={executeState.label} pool={executeState.pool} />
    </div>
  );
}

function SourceBadge({ source }: { source?: 'live' | 'simulated' }) {
  if (source === 'live') {
    return (
      <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
        <Radio className="h-2.5 w-2.5" />Live
      </span>
    );
  }
  if (source === 'simulated') {
    return (
      <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
        Sim
      </span>
    );
  }
  return null;
}

function StatusDot({ status }: { status: ActionStatus }) {
  const s = { Pending: 'bg-amber-400 shadow-amber-400/40', Completed: 'bg-emerald-400 shadow-emerald-400/40', Dismissed: 'bg-white/20' }[status];
  return <span className={`h-2 w-2 rounded-full shrink-0 shadow-[0_0_6px] ${s}`} />;
}
