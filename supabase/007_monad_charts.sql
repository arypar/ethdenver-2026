-- Monad nad.fun token tracking and swap history

create table if not exists monad_tracked_tokens (
  token_address text primary key,
  name text,
  symbol text,
  image_url text,
  tracked_at timestamptz not null default now()
);

alter table monad_tracked_tokens enable row level security;
create policy "Public read monad_tracked_tokens" on monad_tracked_tokens
  for select using (true);
create policy "Service insert monad_tracked_tokens" on monad_tracked_tokens
  for insert with check (auth.role() = 'service_role');

create table if not exists monad_swaps (
  id bigint generated always as identity primary key,
  token_address text not null,
  direction text not null check (direction in ('buy', 'sell')),
  amount_in text not null,
  amount_out text not null,
  sender text not null,
  block_number bigint not null,
  tx_hash text not null,
  swapped_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index idx_monad_swaps_token_block on monad_swaps (token_address, block_number desc);
create index idx_monad_swaps_token_time on monad_swaps (token_address, swapped_at desc);

alter table monad_swaps enable row level security;
create policy "Public read monad_swaps" on monad_swaps
  for select using (true);
create policy "Service insert monad_swaps" on monad_swaps
  for insert with check (auth.role() = 'service_role');

-- Add chain column to dashboard_charts (default eth for existing rows)
alter table dashboard_charts add column if not exists chain text not null default 'eth';

-- Add chain column to rules (default eth for existing rows)
alter table rules add column if not exists chain text not null default 'eth';

notify pgrst, 'reload schema';
