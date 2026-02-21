-- Add chain column to monad_transactions and rename to stream_transactions
alter table monad_transactions add column if not exists chain text not null default 'monad';
alter table monad_transactions rename to stream_transactions;

-- Update indexes for the renamed table
create index if not exists idx_stream_tx_chain on stream_transactions (chain, block_number desc);

-- Liquidity events from Uniswap V3 pools (Mint, Burn, Collect)
create table if not exists liquidity_events (
  id bigint generated always as identity primary key,
  chain text not null default 'eth',
  pool_address text not null,
  event_type text not null,
  owner text,
  tick_lower int,
  tick_upper int,
  amount text,
  amount0 text,
  amount1 text,
  block_number bigint not null,
  tx_hash text not null,
  block_timestamp timestamptz not null,
  received_at timestamptz not null default now()
);

create index idx_liq_pool_block on liquidity_events (pool_address, block_number desc);
create index idx_liq_chain_type on liquidity_events (chain, event_type);
create index idx_liq_owner on liquidity_events (owner);

alter table liquidity_events enable row level security;
create policy "Public read liquidity_events" on liquidity_events
  for select using (true);
create policy "Service insert liquidity_events" on liquidity_events
  for insert with check (auth.role() = 'service_role');

notify pgrst, 'reload schema';
