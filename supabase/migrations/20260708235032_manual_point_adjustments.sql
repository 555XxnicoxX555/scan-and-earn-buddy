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

revoke all on function public.adjust_customer_points(text, uuid, integer, text, text) from public;
grant execute on function public.adjust_customer_points(text, uuid, integer, text, text) to authenticated;
