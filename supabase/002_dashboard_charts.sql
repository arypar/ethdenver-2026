-- Dashboard charts (single-user, no auth required)
create table dashboard_charts (
  id uuid primary key default gen_random_uuid(),
  pool_name text not null,
  metric text not null check (metric in ('Price', 'Volume', 'Fees', 'Swap Count')),
  time_range text not null check (time_range in ('1H', '24H', '7D', '30D')),
  chart_type text not null default 'area' check (chart_type in ('line', 'area', 'bar')),
  title text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table dashboard_charts enable row level security;

-- Service role has full access (backend manages everything)
create policy "Service full access" on dashboard_charts
  for all using (true) with check (true);
