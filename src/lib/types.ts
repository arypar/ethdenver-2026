export type Metric = 'Price' | 'Volume' | 'Fees' | 'Swap Count';
export type Pool = string;
export type TimeRange = '1H' | '24H' | '7D' | '30D';
export type ChartType = 'line' | 'area' | 'bar';

export interface ChartConfig {
  metric: Metric;
  pool: Pool;
  range: TimeRange;
  chartType: ChartType;
}

export interface SavedChart {
  id: string;
  title: string;
  config: ChartConfig;
  data: ChartDataPoint[];
  createdAt: number;
}

export interface ChartDataPoint {
  time: string;
  value: number;
  block?: number;
}

export type TriggerType = 'Swap';
export type ConditionField = 'Notional USD' | 'Price Impact %' | 'Swap Direction' | 'Count in Window';
export type ConditionOperator = '>' | '>=' | '<' | '<=' | '=';
export type WindowSize = '1m' | '5m' | '15m' | '1h';
export type ActionType = 'Create Alert' | 'Notify' | 'Recommend Swap' | 'Auto Swap';

export interface RuleCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
  window?: WindowSize;
}

export interface RuleAction {
  id: string;
  type: ActionType;
  config: {
    channel?: string;
    token?: string;
    percent?: number;
    message?: string;
  };
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    pool: Pool;
    watchedWallet?: string;
  };
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: number;
}

export type ActionStatus = 'Pending' | 'Completed' | 'Dismissed';

export interface ActionItem {
  id: string;
  ruleId: string;
  ruleName: string;
  status: ActionStatus;
  triggerReason: string;
  suggestedAction: string;
  timestamp: number;
  source?: 'live' | 'simulated';
  details: {
    eventType: string;
    pool: string;
    conditionsMet: string[];
    proposedActions: string[];
  };
}
