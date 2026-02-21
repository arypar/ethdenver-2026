'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { RuleAction, ActionType } from '@/lib/types';

const ACTION_TYPES: ActionType[] = ['Create Alert', 'Notify', 'Recommend Swap', 'Auto Swap'];

interface ActionsEditorProps {
  actions: RuleAction[];
  onChange: (actions: RuleAction[]) => void;
}

export function ActionsEditor({ actions, onChange }: ActionsEditorProps) {
  const add = () => {
    onChange([...actions, { id: crypto.randomUUID(), type: 'Create Alert', config: {} }]);
  };

  const update = (i: number, patch: Partial<RuleAction>) => {
    const next = [...actions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const updateConfig = (i: number, key: string, value: string | number) => {
    const next = [...actions];
    next[i] = { ...next[i], config: { ...next[i].config, [key]: value } };
    onChange(next);
  };

  const remove = (i: number) => onChange(actions.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-2">
      {actions.map((a, i) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
          <Select value={a.type} onValueChange={v => update(i, { type: v as ActionType, config: {} })}>
            <SelectTrigger className="w-[150px] bg-white" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {a.type === 'Notify' && (
            <Input value={a.config.channel || ''} onChange={e => updateConfig(i, 'channel', e.target.value)} placeholder="Channel" className="h-8 w-[120px] text-sm bg-white" />
          )}
          {(a.type === 'Recommend Swap' || a.type === 'Auto Swap') && (
            <>
              <Input value={a.config.token || ''} onChange={e => updateConfig(i, 'token', e.target.value)} placeholder="Token" className="h-8 w-[80px] text-sm bg-white" />
              <Input type="number" value={a.config.percent?.toString() || ''} onChange={e => updateConfig(i, 'percent', Number(e.target.value))} placeholder="%" className="h-8 w-[64px] text-sm bg-white" />
            </>
          )}
          {a.type === 'Create Alert' && (
            <Input value={a.config.message || ''} onChange={e => updateConfig(i, 'message', e.target.value)} placeholder="Alert message" className="h-8 flex-1 text-sm bg-white" />
          )}
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => remove(i)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-foreground text-[12px]" onClick={add}>
        <Plus className="h-3 w-3" /> Add action
      </Button>
    </div>
  );
}
