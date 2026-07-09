update public.business_rewards
set min_tier = null
where min_tier is not null
  and min_tier not in ('bronze', 'silver', 'gold', 'platinum');

alter table public.business_rewards
drop constraint if exists business_rewards_min_tier_check;

alter table public.business_rewards
add constraint business_rewards_min_tier_check
check (min_tier is null or min_tier in ('bronze', 'silver', 'gold', 'platinum'));

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
  customer_tier_rank integer;
  reward_min_tier_rank integer;
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

      if nullif(target_reward.min_tier, '') is not null then
        customer_tier_rank := case coalesce(nullif(target_account.tier, ''), 'bronze')
          when 'platinum' then 3
          when 'gold' then 2
          when 'silver' then 1
          else 0
        end;

        reward_min_tier_rank := case target_reward.min_tier
          when 'platinum' then 3
          when 'gold' then 2
          when 'silver' then 1
          else 0
        end;

        if customer_tier_rank < reward_min_tier_rank then
          raise exception 'El cliente no tiene el nivel requerido para este premio';
        end if;
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

revoke all on function public.manage_reward_redemption_status(text, uuid, text) from public;
grant execute on function public.manage_reward_redemption_status(text, uuid, text) to authenticated;
