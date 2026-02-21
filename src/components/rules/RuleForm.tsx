'use client';

import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ConditionsEditor } from './ConditionsEditor';
import { ActionsEditor } from './ActionsEditor';
import { Layers } from 'lucide-react';
import type { Rule, TriggerType, Pool, RuleCondition, RuleAction } from '@/lib/types';

const TRIGGERS: TriggerType[] = ['Swap', 'Liquidity Added', 'Liquidity Removed'];
const POOLS: Pool[] = ['WETH/USDC', 'WBTC/ETH', 'UNI/ETH', 'ARB/USDC', 'LINK/ETH', 'MATIC/USDC'];

interface RuleFormProps {
  connected: boolean;
  onActivate: (rule: Rule) => void;
  onConnectRequired: () => void;
  editingRule?: Rule | null;
}

export function RuleForm({ connected, onActivate, onConnectRequired, editingRule }: RuleFormProps) {
  const [name, setName] = useState(editingRule?.name || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(editingRule?.trigger.type || 'Swap');
  const [pool, setPool] = useState<Pool>(editingRule?.trigger.pool || 'WETH/USDC');
  const [watchWallet, setWatchWallet] = useState(editingRule?.trigger.watchedWallet || '');
  const [showWallet, setShowWallet] = useState(!!editingRule?.trigger.watchedWallet);
  const [conditions, setConditions] = useState<RuleCondition[]>(editingRule?.conditions || []);
  const [actions, setActions] = useState<RuleAction[]>(editingRule?.actions || []);

  const summary = useMemo(() => {
    const parts: string[] = [`${triggerType} on ${pool}`];
    const conds = conditions.filter(c => c.value).map(c =>
      `${c.field} ${c.operator} ${c.value}${c.window ? ` (${c.window})` : ''}`
    );
    if (conds.length) parts.push(conds.join(', '));
    if (actions.length) parts.push(actions.map(a => a.type).join(', '));
    return parts.join(' → ');
  }, [triggerType, pool, conditions, actions]);

  const handleActivate = () => {
    if (!connected) { onConnectRequired(); return; }
    onActivate({
      id: editingRule?.id || crypto.randomUUID(),
      name: name || 'Untitled Rule',
      enabled: true,
      trigger: { type: triggerType, pool, watchedWallet: showWallet && watchWallet ? watchWallet : undefined },
      conditions,
      actions,
      createdAt: editingRule?.createdAt || Date.now(),
    });
    if (!editingRule) { setName(''); setConditions([]); setActions([]); }
  };

  return (
    <div className="rounded-2xl bg-white p-6"
      style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)' }}>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/8">
          <Layers className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-[13px] font-semibold tracking-[-0.003em] text-foreground">
          {editingRule ? 'Edit Rule' : 'Create Rule'}
        </h3>
      </div>

      <div className="flex flex-col gap-5">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Rule name" className="bg-background/60" />

        <Section title="Trigger">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event">
              <Select value={triggerType} onValueChange={v => setTriggerType(v as TriggerType)}>
                <SelectTrigger className="w-full bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  {TRIGGERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pool">
              <Select value={pool} onValueChange={v => setPool(v as Pool)}>
                <SelectTrigger className="w-full bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  {POOLS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Switch checked={showWallet} onCheckedChange={setShowWallet} />
            <span className="text-[12px] text-muted-foreground">Watch specific wallet</span>
          </div>
          {showWallet && <Input value={watchWallet} onChange={e => setWatchWallet(e.target.value)} placeholder="0x..." className="mt-2 bg-background/60" />}
        </Section>

        <Section title="Conditions">
          <ConditionsEditor conditions={conditions} onChange={setConditions} />
        </Section>

        <Section title="Actions">
          <ActionsEditor actions={actions} onChange={setActions} />
        </Section>

        {(conditions.length > 0 || actions.length > 0) && (
          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="text-[12px] text-muted-foreground">{summary}</p>
          </div>
        )}

        <Button className="rounded-xl h-10 text-[13px] font-semibold" onClick={handleActivate}>
          Activate Rule
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
