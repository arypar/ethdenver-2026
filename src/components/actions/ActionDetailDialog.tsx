'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import type { ActionItem } from '@/lib/types';

interface ActionDetailDialogProps {
  action: ActionItem | null;
  open: boolean;
  onClose: () => void;
  onExecute: (id: string) => void;
  connected: boolean;
  onConnectRequired: () => void;
}

export function ActionDetailDialog({ action, open, onClose, onExecute, connected, onConnectRequired }: ActionDetailDialogProps) {
  if (!action) return null;

  const handleExecute = () => {
    if (!connected) { onConnectRequired(); return; }
    onExecute(action.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-white/[0.1] bg-[#0C0C14]/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em] text-white">Action Details</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 text-[13px]">
          <div className="flex justify-between rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 backdrop-blur-xl">
            <span className="text-white/40">Status</span>
            <StatusText status={action.status} />
          </div>

          <Section title="Event">
            <Row label="Rule" value={action.ruleName} />
            <Row label="Type" value={action.details.eventType} />
            <Row label="Pool" value={action.details.pool} />
            <Row label="Chain" value={action.details.chain === 'monad' ? 'Monad (nad.fun)' : 'Ethereum'} />
            <Row label="Trigger" value={action.triggerReason} />
          </Section>

          <Section title="Conditions Met">
            <ul className="flex flex-col gap-1.5">
              {action.details.conditionsMet.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Proposed Actions">
            <ul className="flex flex-col gap-1.5">
              {action.details.proposedActions.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </Section>

          {action.status === 'Pending' && (
            <Button className="rounded-xl h-10 text-[13px] font-semibold" onClick={handleExecute}
              style={{ boxShadow: '0 0 20px rgba(255,0,122,0.25)' }}>
              <Zap className="h-3.5 w-3.5" /> Execute Now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-white/25">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </div>
  );
}

function StatusText({ status }: { status: string }) {
  const styles = {
    Pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Dismissed: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  }[status] || 'text-white/40 bg-white/[0.04] border-white/[0.08]';
  return <span className={`rounded-md border px-2 py-0.5 text-[12px] font-semibold ${styles}`}>{status}</span>;
}
