alter table public.business_loyalty_settings
add column if not exists signup_bonus_points integer not null default 0,
add column if not exists referral_referrer_points integer not null default 0,
add column if not exists referral_referred_points integer not null default 0,
add column if not exists streak_bonus_weeks integer not null default 3,
add column if not exists streak_bonus_points integer not null default 0;

create table if not exists public.business_rewards (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  reward_key text not null,
  name text not null,
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  stock integer check (stock is null or stock >= 0),
  image_url text,
  min_tier text,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reward_key)
);

alter table public.business_rewards enable row level security;

drop policy if exists "Anyone can read active business rewards" on public.business_rewards;
create policy "Anyone can read active business rewards"
on public.business_rewards for select
to anon, authenticated
using (active = true);

drop policy if exists "Business owners can read all business rewards" on public.business_rewards;
create policy "Business owners can read all business rewards"
on public.business_rewards for select
to authenticated
using (public.is_business_admin(business_id));

drop policy if exists "Business owners can insert business rewards" on public.business_rewards;
create policy "Business owners can insert business rewards"
on public.business_rewards for insert
to authenticated
with check (public.is_business_admin(business_id));

drop policy if exists "Business owners can update business rewards" on public.business_rewards;
create policy "Business owners can update business rewards"
on public.business_rewards for update
to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Business owners can delete business rewards" on public.business_rewards;
create policy "Business owners can delete business rewards"
on public.business_rewards for delete
to authenticated
using (public.is_business_admin(business_id));

grant select on public.business_rewards to anon, authenticated;
grant insert, update, delete on public.business_rewards to authenticated;

create or replace function public.touch_business_rewards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_business_rewards_updated_at on public.business_rewards;
create trigger set_business_rewards_updated_at
before update on public.business_rewards
for each row execute function public.touch_business_rewards_updated_at();
