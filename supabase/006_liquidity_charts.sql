-- Allow 'Liquidity' as a chart metric and store pool contract address
alter table dashboard_charts
  drop constraint if exists dashboard_charts_metric_check;

alter table dashboard_charts
  add constraint dashboard_charts_metric_check
  check (metric in ('Price', 'Volume', 'Fees', 'Swap Count', 'Liquidity'));

alter table dashboard_charts
  add column if not exists pool_address text;

notify pgrst, 'reload schema';
