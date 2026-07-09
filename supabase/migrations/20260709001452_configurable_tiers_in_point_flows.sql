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

  next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

  update public.loyalty_accounts
  set points_balance = next_balance,
      tier = next_tier
  where id = target_account.id
  returning * into target_account;

  return jsonb_build_object(
    'eventId', event_id,
    'streakEventId', streak_event_id,
    'customerId', target_customer.id,
    'customerName', target_customer.name,
    'pointsEarned', earned_points,
    'streakBonusPoints', streak_bonus_awarded,
    'weeklyStreak', weekly_streak_after,
    'pointsBalance', target_account.points_balance,
    'tier', target_account.tier,
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
  next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

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

create or replace function public.manage_reward_redemption_status(
  target_business_id text,
  target_redemption_id uuid,
  next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_redemption public.reward_redemptions%rowtype;
  target_account public.loyalty_accounts%rowtype;
  target_reward public.business_rewards%rowtype;
  next_balance integer;
  next_tier text;
  applied_delta integer := 0;
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  if next_status not in ('approved', 'redeemed', 'cancelled') then
    raise exception 'Estado invalido';
  end if;

  select *
  into target_redemption
  from public.reward_redemptions
  where id = target_redemption_id
    and business_id = target_business_id
  for update;

  if target_redemption.id is null then
    raise exception 'Canje no encontrado';
  end if;

  if target_redemption.status in ('redeemed', 'cancelled') then
    raise exception 'El canje ya esta cerrado';
  end if;

  if target_redemption.status = next_status then
    return jsonb_build_object(
      'redemption', to_jsonb(target_redemption),
      'account', null,
      'pointsDelta', 0
    );
  end if;

  select *
  into target_reward
  from public.business_rewards
  where business_id = target_business_id
    and reward_key = target_redemption.reward_id
  for update;

  select *
  into target_account
  from public.loyalty_accounts
  where customer_id = target_redemption.customer_id
    and business_id = target_business_id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  if next_status = 'approved' and target_redemption.status = 'requested' then
    if target_reward.id is not null then
      if target_reward.active is false then
        raise exception 'El premio no esta activo';
      end if;

      if target_reward.valid_until is not null and target_reward.valid_until < current_date then
        raise exception 'El premio esta vencido';
      end if;

      if target_reward.stock is not null and target_reward.stock <= 0 then
        raise exception 'El premio no tiene stock disponible';
      end if;

      if target_reward.stock is not null then
        update public.business_rewards
        set stock = stock - 1
        where id = target_reward.id
        returning * into target_reward;
      end if;
    end if;

    if target_account.points_balance < target_redemption.points_cost then
      raise exception 'El cliente no tiene puntos suficientes';
    end if;

    next_balance := target_account.points_balance - target_redemption.points_cost;
    next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

    update public.loyalty_accounts
    set points_balance = next_balance,
        tier = next_tier
    where id = target_account.id
    returning * into target_account;

    insert into public.point_events (
      customer_id,
      business_id,
      event_type,
      points_delta,
      description,
      recorded_by_auth_user_id
    )
    values (
      target_redemption.customer_id,
      target_business_id,
      'redeem',
      -target_redemption.points_cost,
      'Canje aprobado: ' || target_redemption.reward_name,
      auth.uid()
    );
    applied_delta := -target_redemption.points_cost;
  elsif next_status = 'cancelled' and target_redemption.status = 'approved' then
    if target_reward.id is not null and target_reward.stock is not null then
      update public.business_rewards
      set stock = stock + 1
      where id = target_reward.id
      returning * into target_reward;
    end if;

    next_balance := target_account.points_balance + target_redemption.points_cost;
    next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

    update public.loyalty_accounts
    set points_balance = next_balance,
        tier = next_tier
    where id = target_account.id
    returning * into target_account;

    insert into public.point_events (
      customer_id,
      business_id,
      event_type,
      points_delta,
      description,
      recorded_by_auth_user_id
    )
    values (
      target_redemption.customer_id,
      target_business_id,
      'adjustment',
      target_redemption.points_cost,
      'Canje cancelado y puntos devueltos: ' || target_redemption.reward_name,
      auth.uid()
    );
    applied_delta := target_redemption.points_cost;
  end if;

  update public.reward_redemptions
  set status = next_status
  where id = target_redemption.id
  returning * into target_redemption;

  return jsonb_build_object(
    'redemption', to_jsonb(target_redemption),
    'account', to_jsonb(target_account),
    'pointsDelta', applied_delta,
    'reward', case when target_reward.id is not null then to_jsonb(target_reward) else null end
  );
end;
$$;

create or replace function public.adjust_customer_points(
  target_business_id text,
  target_customer_id uuid,
  adjustment_points integer,
  adjustment_reason text default null,
  request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_customer public.customer_profiles%rowtype;
  target_account public.loyalty_accounts%rowtype;
  target_event public.point_events%rowtype;
  normalized_reason text;
  normalized_request_id text;
  next_balance integer;
  next_tier text;
begin
  normalized_reason := nullif(trim(coalesce(adjustment_reason, '')), '');
  normalized_request_id := nullif(trim(coalesce(request_id, '')), '');

  if auth.uid() is null or not public.is_business_admin(target_business_id) then
    raise exception 'No autorizado';
  end if;

  if adjustment_points is null or adjustment_points = 0 then
    raise exception 'El ajuste debe sumar o restar puntos';
  end if;

  if normalized_request_id is null then
    raise exception 'Falta request_id';
  end if;

  select *
  into target_event
  from public.point_events pe
  where pe.business_id = target_business_id
    and pe.request_id = normalized_request_id
  limit 1;

  if target_event.id is not null then
    select *
    into target_account
    from public.loyalty_accounts la
    where la.customer_id = target_event.customer_id
      and la.business_id = target_business_id;

    return jsonb_build_object(
      'event', to_jsonb(target_event),
      'account', to_jsonb(target_account),
      'idempotent', true
    );
  end if;

  select *
  into target_customer
  from public.customer_profiles cp
  where cp.id = target_customer_id
    and cp.business_id = target_business_id;

  if target_customer.id is null then
    raise exception 'Cliente no encontrado';
  end if;

  select *
  into target_account
  from public.loyalty_accounts la
  where la.customer_id = target_customer.id
    and la.business_id = target_business_id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  next_balance := target_account.points_balance + adjustment_points;
  if next_balance < 0 then
    raise exception 'El ajuste deja saldo negativo';
  end if;

  next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

  update public.loyalty_accounts
  set points_balance = next_balance,
      tier = next_tier
  where id = target_account.id
  returning * into target_account;

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
    adjustment_points,
    case
      when normalized_reason is null then 'Ajuste manual de puntos'
      else 'Ajuste manual: ' || normalized_reason
    end,
    auth.uid(),
    normalized_request_id
  )
  returning * into target_event;

  return jsonb_build_object(
    'event', to_jsonb(target_event),
    'account', to_jsonb(target_account),
    'idempotent', false
  );
end;
$$;

revoke all on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) from public;
revoke all on function public.cancel_customer_consumption(text, uuid) from public;
revoke all on function public.manage_reward_redemption_status(text, uuid, text) from public;
revoke all on function public.adjust_customer_points(text, uuid, integer, text, text) from public;

grant execute on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) to authenticated;
grant execute on function public.cancel_customer_consumption(text, uuid) to authenticated;
grant execute on function public.manage_reward_redemption_status(text, uuid, text) to authenticated;
grant execute on function public.adjust_customer_points(text, uuid, integer, text, text) to authenticated;
