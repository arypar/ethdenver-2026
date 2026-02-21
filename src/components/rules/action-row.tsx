'use client';

import { PillSelect } from '@/components/pill-select';
import { PillInput } from '@/components/pill-input';
import { X } from 'lucide-react';
import type { RuleAction, ActionType } from '@/lib/types';

const ACTION_TYPES: ActionType[] = ['Create Alert', 'Notify', 'Recommend Swap', 'Auto Swap'];

interface ActionRowProps {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}

export function ActionRow({ action, onChange, onRemove }: ActionRowProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 group">
      <div className="flex-1 min-w-[160px]">
        <PillSelect
          label="Action"
          options={ACTION_TYPES}
          value={action.type}
          onChange={v => onChange({ ...action, type: v })}
          compact
        />
      </div>

      {(action.type === 'Notify') && (
        <PillInput
          label="Channel"
          value={action.config.channel || ''}
          onChange={e => onChange({ ...action, config: { ...action.config, channel: e.target.value } })}
          placeholder="Telegram / Discord"
          className="flex-1 min-w-[140px]"
        />
      )}

      {(action.type === 'Recommend Swap' || action.type === 'Auto Swap') && (
        <>
          <PillInput
            label="Token"
            value={action.config.token || ''}
            onChange={e => onChange({ ...action, config: { ...action.config, token: e.target.value } })}
            placeholder="USDC"
            className="min-w-[100px]"
          />
          <PillInput
            label="% of balance"
            type="number"
            value={action.config.percent?.toString() || ''}
            onChange={e => onChange({ ...action, config: { ...action.config, percent: Number(e.target.value) } })}
            placeholder="50"
            className="min-w-[100px]"
          />
        </>
      )}

      {action.type === 'Create Alert' && (
        <PillInput
          label="Message"
          value={action.config.message || ''}
          onChange={e => onChange({ ...action, config: { ...action.config, message: e.target.value } })}
          placeholder="Alert message..."
          className="flex-1 min-w-[180px]"
        />
      )}

      <button
        onClick={onRemove}
        className="p-1.5 rounded-full hover:bg-red-500/10 text-uni-text1 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove action"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
