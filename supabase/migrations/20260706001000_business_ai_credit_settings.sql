create table if not exists public.business_ai_settings (
  business_id text primary key references public.businesses(id) on delete cascade,
  monthly_limit integer not null default 150 check (monthly_limit > 0),
  generation_credit_cost integer not null default 2 check (generation_credit_cost > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_ai_settings enable row level security;

drop policy if exists "Business admins can read AI settings" on public.business_ai_settings;
create policy "Business admins can read AI settings"
on public.business_ai_settings for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can create AI settings" on public.business_ai_settings;
create policy "Business admins can create AI settings"
on public.business_ai_settings for insert
with check (public.is_business_admin(business_id));

drop policy if exists "Business admins can update AI settings" on public.business_ai_settings;
create policy "Business admins can update AI settings"
on public.business_ai_settings for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

create or replace function public.business_ai_credit_settings(target_business_id text)
returns table (
  monthly_limit integer,
  generation_credit_cost integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_admin(target_business_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.business_ai_settings (business_id)
  values (target_business_id)
  on conflict (business_id) do nothing;

  return query
  select settings.monthly_limit, settings.generation_credit_cost
  from public.business_ai_settings settings
  where settings.business_id = target_business_id;
end;
$$;

create or replace function public.ensure_business_ai_credit_balance(target_business_id text)
returns public.business_ai_credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  current_period text := public.current_ai_credit_period();
  balance_row public.business_ai_credit_balances;
  configured_monthly_limit integer := 150;
begin
  if not public.is_business_admin(target_business_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.business_ai_settings (business_id)
  values (target_business_id)
  on conflict (business_id) do nothing;

  select monthly_limit
  into configured_monthly_limit
  from public.business_ai_settings
  where business_id = target_business_id;

  insert into public.business_ai_credit_balances (business_id, period_month, monthly_limit, credits_remaining)
  values (target_business_id, current_period, configured_monthly_limit, configured_monthly_limit)
  on conflict (business_id, period_month) do nothing;

  select *
  into balance_row
  from public.business_ai_credit_balances
  where business_id = target_business_id
    and period_month = current_period;

  return balance_row;
end;
$$;

create or replace function public.consume_business_ai_credits(
  target_business_id text,
  credits_to_consume integer,
  event_reason text,
  kie_task_id text default null
)
returns public.business_ai_credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  current_period text := public.current_ai_credit_period();
  balance_row public.business_ai_credit_balances;
  configured_monthly_limit integer := 150;
begin
  if credits_to_consume <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  if not public.is_business_admin(target_business_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.business_ai_settings (business_id)
  values (target_business_id)
  on conflict (business_id) do nothing;

  select monthly_limit
  into configured_monthly_limit
  from public.business_ai_settings
  where business_id = target_business_id;

  insert into public.business_ai_credit_balances (business_id, period_month, monthly_limit, credits_remaining)
  values (target_business_id, current_period, configured_monthly_limit, configured_monthly_limit)
  on conflict (business_id, period_month) do nothing;

  select *
  into balance_row
  from public.business_ai_credit_balances
  where business_id = target_business_id
    and period_month = current_period
  for update;

  if balance_row.credits_remaining < credits_to_consume then
    raise exception 'Insufficient AI credits';
  end if;

  update public.business_ai_credit_balances
  set credits_remaining = credits_remaining - credits_to_consume,
      updated_at = now()
  where business_id = target_business_id
    and period_month = current_period
  returning * into balance_row;

  insert into public.business_ai_credit_events (
    business_id,
    auth_user_id,
    period_month,
    credits_delta,
    reason,
    task_id
  )
  values (
    target_business_id,
    auth.uid(),
    current_period,
    -credits_to_consume,
    event_reason,
    kie_task_id
  );

  return balance_row;
end;
$$;

revoke all on public.business_ai_settings from anon, authenticated;
grant select, insert, update on public.business_ai_settings to authenticated;

revoke all on function public.business_ai_credit_settings(text) from public, anon;
revoke all on function public.ensure_business_ai_credit_balance(text) from public, anon;
revoke all on function public.consume_business_ai_credits(text, integer, text, text) from public, anon;
grant execute on function public.business_ai_credit_settings(text) to authenticated;
grant execute on function public.ensure_business_ai_credit_balance(text) to authenticated;
grant execute on function public.consume_business_ai_credits(text, integer, text, text) to authenticated;
