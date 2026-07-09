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
  target_account public.loyalty_accounts%rowtype;
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

  select *
  into target_account
  from public.loyalty_accounts la
  where la.customer_id = target_event.customer_id
    and la.business_id = target_business_id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  next_balance := greatest(0, target_account.points_balance - greatest(0, target_event.points_delta));
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
    -greatest(0, target_event.points_delta),
    'Consumo cancelado por owner',
    auth.uid()
  )
  returning id into adjustment_id;

  return jsonb_build_object(
    'event', to_jsonb(target_event),
    'account', to_jsonb(target_account),
    'adjustmentId', adjustment_id
  );
end;
$$;

revoke all on function public.cancel_customer_consumption(text, uuid) from public;
grant execute on function public.cancel_customer_consumption(text, uuid) to authenticated;
