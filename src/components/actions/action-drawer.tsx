'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PillButton } from '@/components/pill-button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Info, Zap } from 'lucide-react';
import type { ActionItem } from '@/lib/types';

interface ActionDrawerProps {
  action: ActionItem | null;
  open: boolean;
  onClose: () => void;
  onExecute: (id: string) => void;
  connected: boolean;
  onConnectRequired: () => void;
}

export function ActionDrawer({ action, open, onClose, onExecute, connected, onConnectRequired }: ActionDrawerProps) {
  if (!action) return null;

  const handleExecute = () => {
    if (!connected) {
      onConnectRequired();
      return;
    }
    onExecute(action.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-uni-surface0/95 backdrop-blur-2xl border-white/[0.08] w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-white/[0.06]">
          <SheetTitle className="text-lg font-bold text-uni-text0">
            Action Details
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={action.status} />
            <span className="text-sm text-uni-text1">
              {new Date(action.timestamp).toLocaleString()}
            </span>
          </div>

          <Section icon={<Info className="w-4 h-4 text-uni-charm" />} title="Event Details">
            <InfoRow label="Rule" value={action.ruleName} />
            <InfoRow label="Event" value={action.details.eventType} />
            <InfoRow label="Pool" value={action.details.pool} />
            <InfoRow label="Trigger" value={action.triggerReason} />
          </Section>

          <Section icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} title="Conditions Met">
            <ul className="flex flex-col gap-1.5">
              {action.details.conditionsMet.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-uni-text0/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={<Zap className="w-4 h-4 text-uni-rose" />} title="Proposed Actions">
            <ul className="flex flex-col gap-1.5">
              {action.details.proposedActions.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-uni-text0/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-uni-rose shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </Section>

          {action.status === 'Pending' && (
            <PillButton variant="primary" size="lg" className="w-full mt-2" onClick={handleExecute}>
              <Zap className="w-4 h-4" />
              Execute Now
            </PillButton>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.06] flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-uni-text0 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-xs text-uni-text1">{label}</span>
      <span className="text-xs font-medium text-uni-text0">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    Dismissed: 'bg-white/[0.04] text-uni-text1 border-white/[0.08]',
  }[status] || 'bg-white/[0.04] text-uni-text1 border-white/[0.08]';

  const Icon = status === 'Completed' ? CheckCircle2 : Clock;

  return (
    <Badge className={`rounded-full ${styles} text-[11px] font-medium px-2.5 py-0.5 gap-1`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}
