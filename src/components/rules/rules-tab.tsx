'use client';

import { useState } from 'react';
import { RuleComposer } from './rule-composer';
import { ActiveRulesList } from './active-rules-list';
import type { Rule } from '@/lib/types';

interface RulesTabProps {
  connected: boolean;
  rules: Rule[];
  onAddRule: (rule: Rule) => void;
  onUpdateRule: (id: string, updates: Partial<Rule>) => void;
  onRemoveRule: (id: string) => void;
  onDuplicateRule: (id: string) => void;
  onSimulateTrigger: (rule: Rule) => void;
  onConnectRequired: () => void;
}

export function RulesTab({
  connected,
  rules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onDuplicateRule,
  onSimulateTrigger,
  onConnectRequired,
}: RulesTabProps) {
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const handleActivate = (rule: Rule) => {
    if (editingRule) {
      onUpdateRule(rule.id, rule);
      setEditingRule(null);
    } else {
      onAddRule(rule);
    }
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <RuleComposer
        key={editingRule?.id || 'new'}
        connected={connected}
        onActivate={handleActivate}
        onConnectRequired={onConnectRequired}
        editingRule={editingRule}
      />
      <ActiveRulesList
        rules={rules}
        onToggle={(id, enabled) => onUpdateRule(id, { enabled })}
        onEdit={rule => setEditingRule(rule)}
        onDuplicate={onDuplicateRule}
        onDelete={onRemoveRule}
        onSimulate={onSimulateTrigger}
      />
    </div>
  );
}
