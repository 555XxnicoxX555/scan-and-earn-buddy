create table if not exists public.business_ai_credit_balances (
  business_id text not null references public.businesses(id) on delete cascade,
  period_month text not null,
  monthly_limit integer not null default 150 check (monthly_limit > 0),
  credits_remaining integer not null default 150 check (credits_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, period_month)
);

create table if not exists public.business_ai_credit_events (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  period_month text not null,
  credits_delta integer not null,
  reason text not null,
  task_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_content_assets (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  dish_id text,
  dish_name text not null,
  category text,
  format_id text not null,
  format_title text not null,
  caption text not null,
  hashtags text,
  image_path text not null,
  image_url text not null,
  source_photo text,
  reference_photo_source text,
  model text,
  task_id text,
  credits_used integer not null default 2,
  created_at timestamptz not null default now()
);

alter table public.business_ai_credit_balances enable row level security;
alter table public.business_ai_credit_events enable row level security;
alter table public.generated_content_assets enable row level security;

create or replace function public.current_ai_credit_period()
returns text
language sql
stable
as $$
  select to_char(now(), 'YYYY-MM');
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
begin
  if not public.is_business_admin(target_business_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.business_ai_credit_balances (business_id, period_month, monthly_limit, credits_remaining)
  values (target_business_id, current_period, 150, 150)
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
begin
  if credits_to_consume <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  if not public.is_business_admin(target_business_id) then
    raise exception 'Forbidden';
  end if;

  insert into public.business_ai_credit_balances (business_id, period_month, monthly_limit, credits_remaining)
  values (target_business_id, current_period, 150, 150)
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

drop policy if exists "Business admins can read AI credit balances" on public.business_ai_credit_balances;
create policy "Business admins can read AI credit balances"
on public.business_ai_credit_balances for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can read AI credit events" on public.business_ai_credit_events;
create policy "Business admins can read AI credit events"
on public.business_ai_credit_events for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can read generated content" on public.generated_content_assets;
create policy "Business admins can read generated content"
on public.generated_content_assets for select
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can create generated content" on public.generated_content_assets;
create policy "Business admins can create generated content"
on public.generated_content_assets for insert
with check (public.is_business_admin(business_id) and auth.uid() = auth_user_id);

insert into storage.buckets (id, name, public)
values ('generated-content', 'generated-content', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Business admins can upload generated content images" on storage.objects;
create policy "Business admins can upload generated content images"
on storage.objects for insert
with check (
  bucket_id = 'generated-content'
  and public.is_business_admin((storage.foldername(name))[1])
);

drop policy if exists "Business admins can read generated content images" on storage.objects;
create policy "Business admins can read generated content images"
on storage.objects for select
using (
  bucket_id = 'generated-content'
  and public.is_business_admin((storage.foldername(name))[1])
);

drop policy if exists "Anyone can read public generated content images" on storage.objects;
create policy "Anyone can read public generated content images"
on storage.objects for select
using (bucket_id = 'generated-content');
