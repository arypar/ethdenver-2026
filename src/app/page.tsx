'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { TopBar } from '@/components/shell/TopBar';
import { AppTabs, type TabId } from '@/components/shell/AppTabs';
import { IntelligenceTab } from '@/components/intelligence/IntelligenceTab';
import { RulesTab } from '@/components/rules/RulesTab';
import { ActionsInbox } from '@/components/actions/ActionsInbox';
import RuleEvaluator from '@/components/RuleEvaluator';
import { useSavedCharts, useRules, useActions } from '@/lib/store';

export default function Home() {
  const [tab, setTab] = useState<TabId>('Intelligence');

  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const { charts, add: addChart, rename: renameChart, remove: removeChart, appendDataPoint, accumulateDataPoint } = useSavedCharts();
  const { rules, addRule, updateRule, removeRule, duplicateRule } = useRules();
  const { actions, updateStatus, simulateTrigger, addAction, clearAll: clearActions } = useActions();

  const requireConnect = useCallback(() => {
    if (openConnectModal) openConnectModal();
  }, [openConnectModal]);

  const handleSimulate = useCallback((rule: Parameters<typeof simulateTrigger>[0]) => {
    simulateTrigger(rule);
    setTab('Actions');
  }, [simulateTrigger]);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[15%] h-[600px] w-[600px] rounded-full opacity-100"
          style={{ background: 'radial-gradient(circle, rgba(255,0,122,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-[30%] right-[10%] h-[500px] w-[500px] rounded-full opacity-100"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-5%] left-[40%] h-[400px] w-[400px] rounded-full opacity-100"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />
      </div>

      <RuleEvaluator rules={rules} onAction={addAction} />

      <div className="relative z-10">
        <TopBar>
          <AppTabs active={tab} onChange={setTab} />
        </TopBar>

        <main className="mx-auto max-w-6xl px-6 py-10">
          {tab === 'Intelligence' && (
            <IntelligenceTab
              charts={charts}
              onAddChart={addChart}
              onRenameChart={renameChart}
              onRemoveChart={removeChart}
              onAppendDataPoint={appendDataPoint}
              onAccumulateDataPoint={accumulateDataPoint}
            />
          )}
          {tab === 'Rules Builder' && (
            <RulesTab
              connected={isConnected}
              rules={rules}
              onAddRule={addRule}
              onUpdateRule={updateRule}
              onRemoveRule={removeRule}
              onDuplicateRule={duplicateRule}
              onSimulateTrigger={handleSimulate}
              onConnectRequired={requireConnect}
            />
          )}
          {tab === 'Actions' && (
            <ActionsInbox
              actions={actions}
              rules={rules}
              connected={isConnected}
              onUpdateStatus={updateStatus}
              onAddAction={addAction}
              onClearAll={clearActions}
              onConnectRequired={requireConnect}
            />
          )}
        </main>
      </div>
    </div>
  );
}
