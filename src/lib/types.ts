export type ChainId = 'eth' | 'monad';
export type Metric = 'Price' | 'Volume' | 'TVL' | 'Fees' | 'Swap Count' | 'Liquidity' | 'Liquidity Delta';
export type Pool = string;
export type TimeRange = '1H' | '24H' | '7D' | '30D';
export type ChartType = 'line' | 'area' | 'bar';

export interface ChartConfig {
  metric: Metric;
  pool: Pool;
  range: TimeRange;
  chartType: ChartType;
  chain?: ChainId;
  poolAddress?: string;
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
  price?: number;
  block?: number;
}

export type TriggerType = 'Swap' | 'Liquidity Added' | 'Liquidity Removed';
export type ConditionField = 'Price' | 'Notional USD' | 'Price Impact %' | 'Liquidity Change %' | 'Swap Direction' | 'Count in Window';
export type ConditionOperator = '>' | '>=' | '<' | '<=' | '=';
export type WindowSize = '1m' | '5m' | '15m' | '1h';
export type ActionType = 'Create Alert' | 'Notify' | 'Recommend Swap' | 'Auto Swap' | 'Add Liquidity' | 'Remove Liquidity';

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
    amount?: string;
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
    chain?: ChainId;
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
    actionTypes?: string[];
  };
}
