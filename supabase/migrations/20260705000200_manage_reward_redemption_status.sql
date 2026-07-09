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
  into target_account
  from public.loyalty_accounts
  where customer_id = target_redemption.customer_id
    and business_id = target_business_id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  if next_status = 'approved' and target_redemption.status = 'requested' then
    if target_account.points_balance < target_redemption.points_cost then
      raise exception 'El cliente no tiene puntos suficientes';
    end if;

    next_balance := target_account.points_balance - target_redemption.points_cost;
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
    next_balance := target_account.points_balance + target_redemption.points_cost;
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
    'pointsDelta', applied_delta
  );
end;
$$;

revoke all on function public.manage_reward_redemption_status(text, uuid, text) from public;
grant execute on function public.manage_reward_redemption_status(text, uuid, text) to authenticated;
