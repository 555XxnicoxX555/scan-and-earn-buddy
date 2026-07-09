create or replace function public.customer_weekly_purchase_streak(
  target_business_id text,
  target_customer_id uuid
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  with purchase_weeks as (
    select distinct date_trunc('week', pe.created_at)::date as week_start
    from public.point_events pe
    where pe.business_id = target_business_id
      and pe.customer_id = target_customer_id
      and pe.event_type = 'purchase'
      and coalesce(pe.purchase_status, 'confirmed') = 'confirmed'
  ),
  anchor_week as (
    select case
      when exists (
        select 1
        from purchase_weeks pw
        where pw.week_start = date_trunc('week', now())::date
      )
      then date_trunc('week', now())::date
      else (date_trunc('week', now()) - interval '1 week')::date
    end as week_start
  ),
  ranked_weeks as (
    select
      pw.week_start,
      row_number() over (order by pw.week_start desc) as row_number
    from purchase_weeks pw
    cross join anchor_week aw
    where pw.week_start <= aw.week_start
  )
  select coalesce(count(*)::integer, 0)
  from ranked_weeks rw
  cross join anchor_week aw
  where rw.week_start = (aw.week_start - ((rw.row_number - 1)::integer * interval '1 week'))::date;
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
  selected_streak_weeks integer;
  selected_streak_bonus integer;
  earned_points integer;
  streak_bonus_awarded integer := 0;
  weekly_streak_after integer := 0;
  next_balance integer;
  next_tier text;
  normalized_request_id text;
  normalized_items jsonb;
  normalized_category text;
  normalized_note text;
  normalized_method text;
  event_id uuid;
  streak_event_id uuid;
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

  select
    coalesce(bls.earn_rate, 0.10),
    greatest(1, coalesce(bls.streak_bonus_weeks, 3)),
    greatest(0, coalesce(bls.streak_bonus_points, 0))
  into selected_rate, selected_streak_weeks, selected_streak_bonus
  from public.business_loyalty_settings bls
  where bls.business_id = target_business_id;

  selected_rate := coalesce(selected_rate, 0.10);
  selected_streak_weeks := coalesce(selected_streak_weeks, 3);
  selected_streak_bonus := coalesce(selected_streak_bonus, 0);

  earned_points := floor(purchase_total * selected_rate)::integer;
  if selected_rate > 0 and earned_points < 1 then
    earned_points := 1;
  end if;

  next_balance := target_account.points_balance + earned_points;

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

  weekly_streak_after := public.customer_weekly_purchase_streak(target_business_id, target_customer.id);

  if selected_streak_bonus > 0
    and weekly_streak_after >= selected_streak_weeks
    and not exists (
      select 1
      from public.point_events pe
      where pe.business_id = target_business_id
        and pe.customer_id = target_customer.id
        and pe.event_type = 'adjustment'
        and pe.description = 'Bonus de racha semanal'
        and coalesce(pe.purchase_status, 'confirmed') = 'confirmed'
        and pe.created_at >= date_trunc('week', now())
        and pe.created_at < date_trunc('week', now()) + interval '1 week'
    )
  then
    streak_bonus_awarded := selected_streak_bonus;
    next_balance := next_balance + streak_bonus_awarded;

    insert into public.point_events (
      customer_id,
      business_id,
      event_type,
      points_delta,
      description,
      recorded_by_auth_user_id,
      request_id
    )
    values (
      target_customer.id,
      target_business_id,
      'adjustment',
      streak_bonus_awarded,
      'Bonus de racha semanal',
      auth.uid(),
      normalized_request_id || ':streak'
    )
    returning id into streak_event_id;
  end if;

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

  return jsonb_build_object(
    'eventId', event_id,
    'streakEventId', streak_event_id,
    'customerId', target_customer.id,
    'customerName', target_customer.name,
    'pointsEarned', earned_points,
    'streakBonusPoints', streak_bonus_awarded,
    'weeklyStreak', weekly_streak_after,
    'pointsBalance', next_balance,
    'tier', next_tier,
    'earnRate', selected_rate,
    'entryMethod', normalized_method
  );
end;
$$;

create or replace function public.cancel_customer_consumption(
  target_business_id text,
  target_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.point_events%rowtype;
  target_bonus_event public.point_events%rowtype;
  target_account public.loyalty_accounts%rowtype;
  reversed_points integer;
  next_balance integer;
  next_tier text;
  adjustment_id uuid;
begin
  if auth.uid() is null or not public.is_business_admin(target_business_id) then
    raise exception 'No autorizado';
  end if;

  select *
  into target_event
  from public.point_events pe
  where pe.id = target_event_id
    and pe.business_id = target_business_id
    and pe.event_type = 'purchase'
  for update;

  if target_event.id is null then
    raise exception 'Consumo no encontrado';
  end if;

  if target_event.purchase_status <> 'confirmed' then
    raise exception 'El consumo ya no esta confirmado';
  end if;

  if target_event.request_id is not null then
    select *
    into target_bonus_event
    from public.point_events pe
    where pe.business_id = target_business_id
      and pe.customer_id = target_event.customer_id
      and pe.request_id = target_event.request_id || ':streak'
      and pe.event_type = 'adjustment'
      and coalesce(pe.purchase_status, 'confirmed') = 'confirmed'
    for update;
  end if;

  select *
  into target_account
  from public.loyalty_accounts la
  where la.customer_id = target_event.customer_id
    and la.business_id = target_business_id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  reversed_points := greatest(0, target_event.points_delta) + greatest(0, coalesce(target_bonus_event.points_delta, 0));
  next_balance := greatest(0, target_account.points_balance - reversed_points);
  next_tier := case
    when next_balance >= 2000 then 'platinum'
    when next_balance >= 1000 then 'gold'
    when next_balance >= 500 then 'silver'
    else 'bronze'
  end;

  update public.loyalty_accounts
  set points_balance = next_balance,
      tier = next_tier
  where id = target_account.id
  returning * into target_account;

  update public.point_events
  set purchase_status = 'cancelled'
  where id = target_event.id
  returning * into target_event;

  if target_bonus_event.id is not null then
    update public.point_events
    set purchase_status = 'cancelled'
    where id = target_bonus_event.id
    returning * into target_bonus_event;
  end if;

  insert into public.point_events (
    customer_id,
    business_id,
    event_type,
    points_delta,
    description,
    recorded_by_auth_user_id
  )
  values (
    target_event.customer_id,
    target_business_id,
    'adjustment',
    -reversed_points,
    case
      when target_bonus_event.id is not null then 'Consumo y bonus de racha cancelados por owner'
      else 'Consumo cancelado por owner'
    end,
    auth.uid()
  )
  returning id into adjustment_id;

  return jsonb_build_object(
    'event', to_jsonb(target_event),
    'streakBonusEvent', case when target_bonus_event.id is not null then to_jsonb(target_bonus_event) else null end,
    'account', to_jsonb(target_account),
    'adjustmentId', adjustment_id,
    'reversedPoints', reversed_points
  );
end;
$$;

revoke all on function public.customer_weekly_purchase_streak(text, uuid) from public;
revoke all on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) from public;
revoke all on function public.cancel_customer_consumption(text, uuid) from public;
grant execute on function public.customer_weekly_purchase_streak(text, uuid) to authenticated;
grant execute on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) to authenticated;
grant execute on function public.cancel_customer_consumption(text, uuid) to authenticated;
