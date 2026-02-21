'use client';

import { PillSelect } from '@/components/pill-select';
import { PillInput } from '@/components/pill-input';
import { X } from 'lucide-react';
import type { RuleCondition, ConditionField, ConditionOperator, WindowSize } from '@/lib/types';

const FIELDS: ConditionField[] = ['Price', 'Volume', 'Swap Count', 'Notional USD', 'Price Impact %', 'Liquidity Change %', 'Swap Direction', 'Count in Window'];
const OPERATORS: ConditionOperator[] = ['>', '>=', '<', '<=', '='];
const WINDOWS: WindowSize[] = ['1m', '5m', '15m', '1h'];
const WINDOWED_FIELDS: ConditionField[] = ['Count in Window', 'Swap Count', 'Volume', 'Liquidity Change %'];

interface ConditionRowProps {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const showWindow = WINDOWED_FIELDS.includes(condition.field);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 group">
      <div className="flex-1 min-w-[140px]">
        <PillSelect
          label="Field"
          options={FIELDS}
          value={condition.field}
          onChange={v => onChange({ ...condition, field: v })}
          compact
        />
      </div>
      <div className="min-w-[80px]">
        <PillSelect
          label="Op"
          options={OPERATORS}
          value={condition.operator}
          onChange={v => onChange({ ...condition, operator: v })}
          compact
        />
      </div>
      <PillInput
        label="Value"
        value={condition.value}
        onChange={e => onChange({ ...condition, value: e.target.value })}
        placeholder="e.g. 1000"
        className="flex-1 min-w-[100px]"
      />
      {showWindow && (
        <div className="min-w-[80px]">
          <PillSelect
            label="Window"
            options={WINDOWS}
            value={condition.window || '5m'}
            onChange={v => onChange({ ...condition, window: v })}
            compact
          />
        </div>
      )}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-full hover:bg-red-500/10 text-uni-text1 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove condition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
