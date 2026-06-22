create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customer_profiles(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  points_balance integer not null default 40 check (points_balance >= 0),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  public_qr_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  event_type text not null check (event_type in ('signup', 'purchase', 'redeem', 'adjustment', 'expiration')),
  points_delta integer not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  reward_id text not null,
  reward_name text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'redeemed', 'cancelled')),
  created_at timestamptz not null default now()
);

insert into public.businesses (id, name)
values ('sumi', 'Sumi')
on conflict (id) do nothing;

alter table public.businesses enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.point_events enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "Anyone can read businesses" on public.businesses;
create policy "Anyone can read businesses"
on public.businesses for select
using (true);

drop policy if exists "Customers can read own profile" on public.customer_profiles;
create policy "Customers can read own profile"
on public.customer_profiles for select
using (auth.uid() = auth_user_id);

drop policy if exists "Customers can update own profile name" on public.customer_profiles;
create policy "Customers can update own profile name"
on public.customer_profiles for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "Customers can read own loyalty account" on public.loyalty_accounts;
create policy "Customers can read own loyalty account"
on public.loyalty_accounts for select
using (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = loyalty_accounts.customer_id
      and cp.auth_user_id = auth.uid()
  )
);

drop policy if exists "Customers can read own point events" on public.point_events;
create policy "Customers can read own point events"
on public.point_events for select
using (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = point_events.customer_id
      and cp.auth_user_id = auth.uid()
  )
);

drop policy if exists "Customers can read own redemptions" on public.reward_redemptions;
create policy "Customers can read own redemptions"
on public.reward_redemptions for select
using (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = reward_redemptions.customer_id
      and cp.auth_user_id = auth.uid()
  )
);

drop policy if exists "Customers can request own redemptions" on public.reward_redemptions;
create policy "Customers can request own redemptions"
on public.reward_redemptions for insert
with check (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = reward_redemptions.customer_id
      and cp.business_id = reward_redemptions.business_id
      and cp.auth_user_id = auth.uid()
  )
);

create or replace function public.touch_loyalty_account()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_loyalty_account_updated_at on public.loyalty_accounts;
create trigger touch_loyalty_account_updated_at
before update on public.loyalty_accounts
for each row
execute function public.touch_loyalty_account();

create or replace function public.handle_new_loyalty_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  selected_business_id text;
  selected_name text;
begin
  selected_business_id := coalesce(new.raw_user_meta_data->>'business_id', 'sumi');
  selected_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Cliente');

  insert into public.businesses (id, name)
  values (selected_business_id, selected_business_id)
  on conflict (id) do nothing;

  insert into public.customer_profiles (auth_user_id, business_id, name, email)
  values (new.id, selected_business_id, selected_name, new.email)
  returning id into profile_id;

  insert into public.loyalty_accounts (customer_id, business_id, points_balance, tier)
  values (profile_id, selected_business_id, 40, 'bronze');

  insert into public.point_events (customer_id, business_id, event_type, points_delta, description)
  values (profile_id, selected_business_id, 'signup', 40, 'Cuenta creada');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_loyalty on auth.users;
create trigger on_auth_user_created_loyalty
after insert on auth.users
for each row
execute function public.handle_new_loyalty_user();
