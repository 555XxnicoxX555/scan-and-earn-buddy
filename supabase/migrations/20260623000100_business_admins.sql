create table if not exists public.business_admins (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now(),
  unique (business_id, auth_user_id)
);

alter table public.business_admins enable row level security;

create or replace function public.is_business_admin(target_business_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_admins ba
    where ba.business_id = target_business_id
      and ba.auth_user_id = auth.uid()
  );
$$;

drop policy if exists "Business admins can read own membership" on public.business_admins;
create policy "Business admins can read own membership"
on public.business_admins for select
using (auth.uid() = auth_user_id);

drop policy if exists "Business admins can update own business" on public.businesses;
create policy "Business admins can update own business"
on public.businesses for update
using (public.is_business_admin(id))
with check (public.is_business_admin(id));

drop policy if exists "Business admins can read business customers" on public.customer_profiles;
create policy "Business admins can read business customers"
on public.customer_profiles for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can read business loyalty accounts" on public.loyalty_accounts;
create policy "Business admins can read business loyalty accounts"
on public.loyalty_accounts for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can update business loyalty accounts" on public.loyalty_accounts;
create policy "Business admins can update business loyalty accounts"
on public.loyalty_accounts for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Business admins can read business point events" on public.point_events;
create policy "Business admins can read business point events"
on public.point_events for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can create business point events" on public.point_events;
create policy "Business admins can create business point events"
on public.point_events for insert
with check (public.is_business_admin(business_id));

drop policy if exists "Business admins can read business redemptions" on public.reward_redemptions;
create policy "Business admins can read business redemptions"
on public.reward_redemptions for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can update business redemptions" on public.reward_redemptions;
create policy "Business admins can update business redemptions"
on public.reward_redemptions for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));
