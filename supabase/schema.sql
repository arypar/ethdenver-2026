-- Pools being actively tracked by the backend
create table tracked_pools (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  address text not null,
  token0_symbol text not null,
  token1_symbol text not null,
  token0_address text not null,
  token1_address text not null,
  decimals0 smallint not null,
  decimals1 smallint not null,
  fee_tier int not null,
  invert boolean not null default false,
  created_at timestamptz not null default now()
);

-- Raw swap events indexed from on-chain logs
create table swaps (
  id bigint generated always as identity primary key,
  pool_name text not null references tracked_pools(name) on delete cascade,
  block_number bigint not null,
  tx_hash text not null,
  price numeric not null,
  volume_usd numeric not null,
  fee_usd numeric not null,
  swapped_at timestamptz not null,
  indexed_at timestamptz not null default now(),
  unique (pool_name, block_number, tx_hash)
);

create index idx_swaps_pool_time on swaps (pool_name, swapped_at desc);
create index idx_swaps_block on swaps (block_number desc);

-- User-saved dashboard charts (replaces localStorage)
create table user_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_name text not null references tracked_pools(name) on delete cascade,
  metric text not null check (metric in ('Price', 'Volume', 'Fees', 'Swap Count')),
  time_range text not null check (time_range in ('1H', '24H', '7D', '30D')),
  title text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_user_charts_user on user_charts (user_id);

-- Seed the well-known pools so tracking starts immediately
insert into tracked_pools (name, address, token0_symbol, token1_symbol, token0_address, token1_address, decimals0, decimals1, fee_tier, invert)
values
  ('WETH/USDC', '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', 'USDC', 'WETH', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 6, 18, 500, true),
  ('WBTC/ETH',  '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD', 'WBTC', 'WETH', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 8, 18, 3000, false),
  ('UNI/ETH',   '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801', 'UNI',  'WETH', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 18, 3000, false),
  ('LINK/ETH',  '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8', 'LINK', 'WETH', '0x514910771AF9Ca656af840dff83E8264EcF986CA', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 18, 3000, false);

-- Row-level security
alter table tracked_pools enable row level security;
alter table swaps enable row level security;
alter table user_charts enable row level security;

-- Anyone can read pools and swaps (public data)
create policy "Public read pools" on tracked_pools for select using (true);
create policy "Public read swaps" on swaps for select using (true);

-- Only the backend service role can insert/update pools and swaps
create policy "Service insert pools" on tracked_pools for insert with check (auth.role() = 'service_role');
create policy "Service insert swaps" on swaps for insert with check (auth.role() = 'service_role');

-- Users can only read/write their own charts
create policy "Users read own charts" on user_charts for select using (auth.uid() = user_id);
create policy "Users insert own charts" on user_charts for insert with check (auth.uid() = user_id);
create policy "Users update own charts" on user_charts for update using (auth.uid() = user_id);
create policy "Users delete own charts" on user_charts for delete using (auth.uid() = user_id);
