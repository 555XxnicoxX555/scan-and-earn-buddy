alter table public.business_admins
drop constraint if exists business_admins_role_check;

alter table public.business_admins
add constraint business_admins_role_check
check (role in ('owner', 'employee'));

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
      and ba.role = 'owner'
  );
$$;

create or replace function public.is_business_staff(target_business_id text)
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
      and ba.role in ('owner', 'employee')
  );
$$;

create table if not exists public.business_loyalty_settings (
  business_id text primary key references public.businesses(id) on delete cascade,
  earn_rate numeric(6,4) not null default 0.10 check (earn_rate >= 0 and earn_rate <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_loyalty_settings (business_id, earn_rate)
select id, 0.10
from public.businesses
on conflict (business_id) do nothing;

alter table public.business_loyalty_settings enable row level security;

drop policy if exists "Business staff can read loyalty settings" on public.business_loyalty_settings;
create policy "Business staff can read loyalty settings"
on public.business_loyalty_settings for select
to authenticated
using (public.is_business_staff(business_id));

drop policy if exists "Business owners can update loyalty settings" on public.business_loyalty_settings;
create policy "Business owners can update loyalty settings"
on public.business_loyalty_settings for update
to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Business owners can insert loyalty settings" on public.business_loyalty_settings;
create policy "Business owners can insert loyalty settings"
on public.business_loyalty_settings for insert
to authenticated
with check (public.is_business_admin(business_id));

grant select on public.business_loyalty_settings to authenticated;
grant insert, update on public.business_loyalty_settings to authenticated;

alter table public.point_events
add column if not exists purchase_total numeric(12,2),
add column if not exists purchase_items jsonb not null default '[]'::jsonb,
add column if not exists recorded_by_auth_user_id uuid references auth.users(id),
add column if not exists qr_id uuid,
add column if not exists earn_rate numeric(6,4),
add column if not exists request_id text;

create unique index if not exists point_events_business_request_id_idx
on public.point_events (business_id, request_id)
where request_id is not null;

grant execute on function public.is_business_admin(text) to authenticated;
grant execute on function public.is_business_staff(text) to authenticated;

create or replace function public.lookup_loyalty_customer_by_qr(
  target_business_id text,
  target_qr_id uuid
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_email text,
  points_balance integer,
  tier text,
  public_qr_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    cp.id,
    cp.name,
    cp.email,
    la.points_balance,
    la.tier,
    la.public_qr_id
  from public.customer_profiles cp
  join public.loyalty_accounts la on la.customer_id = cp.id
  where cp.business_id = target_business_id
    and la.business_id = target_business_id
    and la.public_qr_id = target_qr_id
  limit 1;
end;
$$;

create or replace function public.record_customer_consumption(
  target_business_id text,
  target_qr_id uuid,
  purchase_total numeric,
  purchase_items jsonb,
  request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_account public.loyalty_accounts%rowtype;
  target_customer public.customer_profiles%rowtype;
  selected_rate numeric(6,4);
  earned_points integer;
  next_balance integer;
  next_tier text;
  normalized_request_id text;
  event_id uuid;
begin
  normalized_request_id := nullif(trim(coalesce(request_id, '')), '');

  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  if purchase_total is null or purchase_total <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if normalized_request_id is null then
    raise exception 'Falta request_id';
  end if;

  if purchase_items is null
    or jsonb_typeof(purchase_items) <> 'array'
    or jsonb_array_length(purchase_items) = 0 then
    raise exception 'Agrega al menos un producto';
  end if;

  if exists (
    select 1
    from public.point_events pe
    where pe.business_id = target_business_id
      and pe.request_id = normalized_request_id
  ) then
    raise exception 'Consumo duplicado';
  end if;

  select *
  into target_account
  from public.loyalty_accounts la
  where la.business_id = target_business_id
    and la.public_qr_id = target_qr_id
  for update;

  if target_account.id is null then
    raise exception 'QR no encontrado';
  end if;

  select *
  into target_customer
  from public.customer_profiles cp
  where cp.id = target_account.customer_id
    and cp.business_id = target_business_id;

  if target_customer.id is null then
    raise exception 'Cliente no encontrado';
  end if;

  select coalesce(bls.earn_rate, 0.10)
  into selected_rate
  from public.business_loyalty_settings bls
  where bls.business_id = target_business_id;

  selected_rate := coalesce(selected_rate, 0.10);
  earned_points := floor(purchase_total * selected_rate)::integer;
  if selected_rate > 0 and earned_points < 1 then
    earned_points := 1;
  end if;

  next_balance := target_account.points_balance + earned_points;
  next_tier := case
    when next_balance >= 2000 then 'platinum'
    when next_balance >= 1000 then 'gold'
    when next_balance >= 500 then 'silver'
    else 'bronze'
  end;

  update public.loyalty_accounts
  set points_balance = next_balance,
      tier = next_tier
  where id = target_account.id;

  insert into public.point_events (
    customer_id,
    business_id,
    event_type,
    points_delta,
    description,
    purchase_total,
    purchase_items,
    recorded_by_auth_user_id,
    qr_id,
    earn_rate,
    request_id
  )
  values (
    target_customer.id,
    target_business_id,
    'purchase',
    earned_points,
    'Consumo registrado en local',
    purchase_total,
    purchase_items,
    auth.uid(),
    target_qr_id,
    selected_rate,
    normalized_request_id
  )
  returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id,
    'customerId', target_customer.id,
    'customerName', target_customer.name,
    'pointsEarned', earned_points,
    'pointsBalance', next_balance,
    'tier', next_tier,
    'earnRate', selected_rate
  );
end;
$$;

revoke all on function public.lookup_loyalty_customer_by_qr(text, uuid) from public;
revoke all on function public.record_customer_consumption(text, uuid, numeric, jsonb, text) from public;
grant execute on function public.lookup_loyalty_customer_by_qr(text, uuid) to authenticated;
grant execute on function public.record_customer_consumption(text, uuid, numeric, jsonb, text) to authenticated;

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = 'globaladsggle@gmail.com'
  limit 1;

  if target_user_id is not null then
    insert into public.business_admins (business_id, auth_user_id, role)
    values ('sumi', target_user_id, 'owner')
    on conflict (business_id, auth_user_id)
    do update set role = 'owner';
  end if;
end;
$$;
