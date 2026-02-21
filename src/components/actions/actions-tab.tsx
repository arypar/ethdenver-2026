'use client';

import { useState } from 'react';
import { GlowCard } from '@/components/glow-card';
import { PillButton } from '@/components/pill-button';
import { Badge } from '@/components/ui/badge';
import { ActionDrawer } from './action-drawer';
import { ExecuteModal } from './execute-modal';
import {
  Zap,
  Eye,
  PlayCircle,
  XCircle,
  CheckCircle2,
  Clock,
  Inbox,
} from 'lucide-react';
import type { ActionItem, ActionStatus, Rule } from '@/lib/types';
import { generateTriggerData } from '@/lib/mock-data';

type Filter = 'All' | 'Pending' | 'Completed' | 'Dismissed';
const FILTERS: Filter[] = ['All', 'Pending', 'Completed', 'Dismissed'];

interface ActionsTabProps {
  actions: ActionItem[];
  rules: Rule[];
  connected: boolean;
  onUpdateStatus: (id: string, status: ActionStatus) => void;
  onAddAction: (action: ActionItem) => void;
  onConnectRequired: () => void;
}

export function ActionsTab({
  actions,
  rules,
  connected,
  onUpdateStatus,
  onAddAction,
  onConnectRequired,
}: ActionsTabProps) {
  const [filter, setFilter] = useState<Filter>('All');
  const [drawerAction, setDrawerAction] = useState<ActionItem | null>(null);
  const [executeModal, setExecuteModal] = useState<{ open: boolean; actionId: string; label: string }>({
    open: false,
    actionId: '',
    label: '',
  });

  const filtered = actions.filter(a => filter === 'All' || a.status === filter);

  const handleSimulateGlobal = () => {
    if (rules.length === 0) return;
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const trig = generateTriggerData(rule.name, rule.trigger.pool);
    const action: ActionItem = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'Pending',
      triggerReason: trig.triggerReason,
      suggestedAction: trig.suggestedAction,
      timestamp: Date.now(),
      details: {
        eventType: rule.trigger.type,
        pool: rule.trigger.pool,
        conditionsMet: trig.conditionsMet,
        proposedActions: trig.proposedActions,
      },
    };
    onAddAction(action);
  };

  const handleExecute = (id: string) => {
    const a = actions.find(x => x.id === id);
    if (!connected) { onConnectRequired(); return; }
    setExecuteModal({ open: true, actionId: id, label: a?.suggestedAction || 'Action' });
  };

  const confirmExecute = () => {
    onUpdateStatus(executeModal.actionId, 'Completed');
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-uni-text0 tracking-tight">Actions</h2>
          <p className="text-sm text-uni-text1 mt-0.5">
            {actions.filter(a => a.status === 'Pending').length} pending action{actions.filter(a => a.status === 'Pending').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-150 ${
                  filter === f
                    ? 'bg-uni-rose/15 text-uni-rose border border-uni-rose/30'
                    : 'bg-white/[0.04] text-uni-text1 border border-white/[0.06] hover:bg-white/[0.07]'
                }`}
              >
                {f}
                {f !== 'All' && (
                  <span className="ml-1 opacity-60">
                    {actions.filter(a => a.status === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <PillButton
            variant="primary"
            size="sm"
            onClick={handleSimulateGlobal}
            disabled={rules.length === 0}
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate
          </PillButton>
        </div>
      </div>

      {/* Actions list */}
      {filtered.length === 0 ? (
        <GlowCard className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Inbox className="w-7 h-7 text-uni-text1/50" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-uni-text1">
              {filter === 'All' ? 'No actions yet' : `No ${filter.toLowerCase()} actions`}
            </p>
            <p className="text-xs text-uni-text1/60 mt-1">
              {rules.length === 0
                ? 'Create rules first, then simulate triggers'
                : 'Use "Simulate" to generate mock trigger events'
              }
            </p>
          </div>
        </GlowCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onReview={() => setDrawerAction(action)}
              onExecute={() => handleExecute(action.id)}
              onDismiss={() => onUpdateStatus(action.id, 'Dismissed')}
            />
          ))}
        </div>
      )}

      <ActionDrawer
        action={drawerAction}
        open={!!drawerAction}
        onClose={() => setDrawerAction(null)}
        onExecute={handleExecute}
        connected={connected}
        onConnectRequired={onConnectRequired}
      />

      <ExecuteModal
        open={executeModal.open}
        onClose={() => setExecuteModal({ open: false, actionId: '', label: '' })}
        onConfirm={confirmExecute}
        action={executeModal.label}
      />
    </div>
  );
}

function ActionCard({
  action,
  onReview,
  onExecute,
  onDismiss,
}: {
  action: ActionItem;
  onReview: () => void;
  onExecute: () => void;
  onDismiss: () => void;
}) {
  const statusConfig = {
    Pending: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Clock },
    Completed: { color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
    Dismissed: { color: 'bg-white/[0.04] text-uni-text1 border-white/[0.08]', icon: XCircle },
  }[action.status];

  const StatusIcon = statusConfig.icon;

  return (
    <GlowCard className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`rounded-full ${statusConfig.color} text-[11px] font-medium px-2.5 py-0.5 gap-1 shrink-0`}>
              <StatusIcon className="w-3 h-3" />
              {action.status}
            </Badge>
            <span className="text-sm font-semibold text-uni-text0 truncate">{action.ruleName}</span>
            <span className="text-[11px] text-uni-text1">
              {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-uni-text1 truncate">{action.triggerReason}</p>
          <p className="text-xs text-uni-text0/70 truncate">
            <span className="text-uni-rose">→</span> {action.suggestedAction}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <PillButton variant="secondary" size="sm" onClick={onReview}>
            <Eye className="w-3 h-3" />
            Review
          </PillButton>
          {action.status === 'Pending' && (
            <>
              <PillButton variant="primary" size="sm" onClick={onExecute}>
                <PlayCircle className="w-3 h-3" />
                Execute
              </PillButton>
              <PillButton variant="ghost" size="sm" onClick={onDismiss}>
                <XCircle className="w-3 h-3" />
              </PillButton>
            </>
          )}
        </div>
      </div>
    </GlowCard>
  );
}
