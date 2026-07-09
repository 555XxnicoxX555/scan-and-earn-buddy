alter table public.point_events
add column if not exists purchase_category text,
add column if not exists purchase_note text,
add column if not exists consumption_entry_method text;

alter table public.point_events
drop constraint if exists point_events_consumption_entry_method_check;

alter table public.point_events
add constraint point_events_consumption_entry_method_check
check (
  consumption_entry_method is null
  or consumption_entry_method in ('qr', 'manual', 'api', 'adjustment')
);

drop function if exists public.lookup_loyalty_customer_by_qr(text, uuid);

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
  public_qr_id uuid,
  last_visit timestamptz,
  visit_count integer
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
    la.public_qr_id,
    (
      select max(pe.created_at)
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as last_visit,
    (
      select count(*)::integer
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as visit_count
  from public.customer_profiles cp
  join public.loyalty_accounts la on la.customer_id = cp.id
  where cp.business_id = target_business_id
    and la.business_id = target_business_id
    and la.public_qr_id = target_qr_id
  limit 1;
end;
$$;

drop function if exists public.lookup_loyalty_customers_for_consumption(text, text);

create or replace function public.lookup_loyalty_customers_for_consumption(
  target_business_id text,
  search_query text default ''
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_email text,
  points_balance integer,
  tier text,
  public_qr_id uuid,
  last_visit timestamptz,
  visit_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_query text;
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  normalized_query := lower(trim(coalesce(search_query, '')));

  return query
  select
    cp.id,
    cp.name,
    cp.email,
    la.points_balance,
    la.tier,
    la.public_qr_id,
    (
      select max(pe.created_at)
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as last_visit,
    (
      select count(*)::integer
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as visit_count
  from public.customer_profiles cp
  join public.loyalty_accounts la on la.customer_id = cp.id
  where cp.business_id = target_business_id
    and la.business_id = target_business_id
    and (
      normalized_query = ''
      or lower(coalesce(cp.name, '')) like '%' || normalized_query || '%'
      or lower(coalesce(cp.email, '')) like '%' || normalized_query || '%'
      or la.public_qr_id::text like '%' || normalized_query || '%'
    )
  order by cp.created_at desc
  limit 20;
end;
$$;

create or replace function public.record_customer_consumption_v2(
  target_business_id text,
  target_qr_id uuid,
  purchase_total numeric,
  request_id text,
  purchase_items jsonb default '[]'::jsonb,
  purchase_category text default null,
  purchase_note text default null,
  entry_method text default 'manual'
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
  normalized_items jsonb;
  normalized_category text;
  normalized_note text;
  normalized_method text;
  event_id uuid;
begin
  normalized_request_id := nullif(trim(coalesce(request_id, '')), '');
  normalized_items := coalesce(purchase_items, '[]'::jsonb);
  normalized_category := nullif(trim(coalesce(purchase_category, '')), '');
  normalized_note := nullif(trim(coalesce(purchase_note, '')), '');
  normalized_method := coalesce(nullif(trim(coalesce(entry_method, '')), ''), 'manual');

  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  if purchase_total is null or purchase_total <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if normalized_request_id is null then
    raise exception 'Falta request_id';
  end if;

  if jsonb_typeof(normalized_items) <> 'array' then
    raise exception 'Los productos deben enviarse como lista';
  end if;

  if normalized_method not in ('qr', 'manual', 'api', 'adjustment') then
    raise exception 'Metodo de carga invalido';
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
    purchase_category,
    purchase_note,
    consumption_entry_method,
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
    normalized_items,
    normalized_category,
    normalized_note,
    normalized_method,
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
    'earnRate', selected_rate,
    'entryMethod', normalized_method
  );
end;
$$;

revoke all on function public.lookup_loyalty_customer_by_qr(text, uuid) from public;
revoke all on function public.lookup_loyalty_customers_for_consumption(text, text) from public;
revoke all on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) from public;
grant execute on function public.lookup_loyalty_customer_by_qr(text, uuid) to authenticated;
grant execute on function public.lookup_loyalty_customers_for_consumption(text, text) to authenticated;
grant execute on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) to authenticated;
