'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { RuleCondition, ConditionField, ConditionOperator, WindowSize } from '@/lib/types';

const FIELDS: ConditionField[] = ['Notional USD', 'Price Impact %', 'Liquidity Change %', 'Swap Direction', 'Count in Window'];
const OPERATORS: ConditionOperator[] = ['>', '>=', '<', '<=', '='];
const WINDOWS: WindowSize[] = ['1m', '5m', '15m', '1h'];
const WINDOWED: Set<ConditionField> = new Set(['Count in Window', 'Liquidity Change %']);

interface ConditionsEditorProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
}

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const add = () => {
    onChange([...conditions, { id: crypto.randomUUID(), field: 'Notional USD', operator: '>', value: '' }]);
  };

  const update = (i: number, patch: Partial<RuleCondition>) => {
    const next = [...conditions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => onChange(conditions.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
          <Select value={c.field} onValueChange={v => update(i, { field: v as ConditionField })}>
            <SelectTrigger className="w-[140px] bg-white" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={c.operator} onValueChange={v => update(i, { operator: v as ConditionOperator })}>
            <SelectTrigger className="w-[64px] bg-white" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {OPERATORS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={c.value} onChange={e => update(i, { value: e.target.value })} placeholder="Value" className="h-8 w-[100px] text-sm bg-white" />
          {WINDOWED.has(c.field) && (
            <Select value={c.window || '5m'} onValueChange={v => update(i, { window: v as WindowSize })}>
              <SelectTrigger className="w-[72px] bg-white" size="sm"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {WINDOWS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => remove(i)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-foreground text-[12px]" onClick={add}>
        <Plus className="h-3 w-3" /> Add condition
      </Button>
    </div>
  );
}
