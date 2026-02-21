-- Dismissed pool suggestions (replaces localStorage)
create table if not exists dismissed_suggestions (
  id bigint generated always as identity primary key,
  pool_name text not null unique,
  dismissed_at timestamptz not null default now()
);

alter table dismissed_suggestions enable row level security;

create policy "Service full access dismissed_suggestions" on dismissed_suggestions
  for all using (true) with check (true);

notify pgrst, 'reload schema';
