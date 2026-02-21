-- Monad transactions received via QuickNode Streams webhook
create table monad_transactions (
  id bigint generated always as identity primary key,
  tx_hash text unique not null,
  block_number bigint not null,
  block_hash text,
  tx_index int,
  from_address text not null,
  to_address text,
  value text default '0',
  gas_limit text,
  gas_price text,
  method_id text,
  tx_type text,
  block_timestamp timestamptz not null,
  received_at timestamptz not null default now()
);

create index idx_monad_tx_block on monad_transactions (block_number desc, tx_index desc);
create index idx_monad_tx_time on monad_transactions (block_timestamp desc);
create index idx_monad_tx_method on monad_transactions (method_id);

alter table monad_transactions enable row level security;
create policy "Public read monad_transactions" on monad_transactions
  for select using (true);
create policy "Service insert monad_transactions" on monad_transactions
  for insert with check (auth.role() = 'service_role');
