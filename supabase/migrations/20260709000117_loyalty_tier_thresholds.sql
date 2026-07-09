alter table public.business_loyalty_settings
add column if not exists tier_silver_points integer not null default 500,
add column if not exists tier_gold_points integer not null default 1000,
add column if not exists tier_platinum_points integer not null default 2000;

alter table public.business_loyalty_settings
drop constraint if exists business_loyalty_settings_tier_thresholds_check;

alter table public.business_loyalty_settings
add constraint business_loyalty_settings_tier_thresholds_check
check (
  tier_silver_points >= 0
  and tier_gold_points > tier_silver_points
  and tier_platinum_points > tier_gold_points
);

create or replace function public.loyalty_tier_for_points(
  target_business_id text,
  points_balance integer
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  with settings as (
    select
      coalesce(bls.tier_silver_points, 500) as silver_points,
      coalesce(bls.tier_gold_points, 1000) as gold_points,
      coalesce(bls.tier_platinum_points, 2000) as platinum_points
    from public.business_loyalty_settings bls
    where bls.business_id = target_business_id
  ),
  resolved as (
    select
      coalesce((select silver_points from settings), 500) as silver_points,
      coalesce((select gold_points from settings), 1000) as gold_points,
      coalesce((select platinum_points from settings), 2000) as platinum_points,
      greatest(coalesce(points_balance, 0), 0) as balance
  )
  select case
    when balance >= platinum_points then 'platinum'
    when balance >= gold_points then 'gold'
    when balance >= silver_points then 'silver'
    else 'bronze'
  end
  from resolved;
$$;

create or replace function public.sync_loyalty_account_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.tier := public.loyalty_tier_for_points(new.business_id, new.points_balance);
  return new;
end;
$$;

create or replace function public.refresh_loyalty_account_tiers_for_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.loyalty_accounts la
  set tier = public.loyalty_tier_for_points(la.business_id, la.points_balance)
  where la.business_id = new.business_id;

  return new;
end;
$$;

drop trigger if exists sync_loyalty_account_tier_before_write on public.loyalty_accounts;
create trigger sync_loyalty_account_tier_before_write
before insert or update of points_balance, business_id on public.loyalty_accounts
for each row
execute function public.sync_loyalty_account_tier();

drop trigger if exists refresh_loyalty_account_tiers_after_settings_change on public.business_loyalty_settings;
create trigger refresh_loyalty_account_tiers_after_settings_change
after insert or update of tier_silver_points, tier_gold_points, tier_platinum_points on public.business_loyalty_settings
for each row
execute function public.refresh_loyalty_account_tiers_for_business();

update public.loyalty_accounts la
set tier = public.loyalty_tier_for_points(la.business_id, la.points_balance);

revoke all on function public.loyalty_tier_for_points(text, integer) from public;
revoke all on function public.sync_loyalty_account_tier() from public;
revoke all on function public.refresh_loyalty_account_tiers_for_business() from public;
grant execute on function public.loyalty_tier_for_points(text, integer) to authenticated;
