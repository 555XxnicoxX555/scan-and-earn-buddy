alter table public.reward_redemptions
add column if not exists requested_by_auth_user_id uuid,
add column if not exists requested_expires_at timestamptz,
add column if not exists status_updated_at timestamptz,
add column if not exists status_updated_by_auth_user_id uuid,
add column if not exists request_context jsonb not null default '{}'::jsonb;

update public.reward_redemptions
set requested_expires_at = coalesce(requested_expires_at, created_at + interval '15 minutes')
where status = 'requested';

with duplicate_requests as (
  select id,
         row_number() over (
           partition by business_id, customer_id, reward_id
           order by created_at desc, id desc
         ) as request_rank
  from public.reward_redemptions
  where status = 'requested'
)
update public.reward_redemptions
set status = 'cancelled',
    status_updated_at = now(),
    request_context = coalesce(request_context, '{}'::jsonb) || jsonb_build_object('autoCancelledReason', 'duplicate_pending_request')
where id in (
  select id
  from duplicate_requests
  where request_rank > 1
);

create unique index if not exists reward_redemptions_one_pending_reward_idx
on public.reward_redemptions (business_id, customer_id, reward_id)
where status = 'requested';

create or replace function public.request_reward_redemption(
  target_business_id text,
  target_reward_id text,
  request_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.customer_profiles%rowtype;
  target_account public.loyalty_accounts%rowtype;
  target_reward public.business_rewards%rowtype;
  created_redemption public.reward_redemptions%rowtype;
  customer_tier_rank integer;
  reward_min_tier_rank integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion para solicitar un canje';
  end if;

  select *
  into target_profile
  from public.customer_profiles
  where business_id = target_business_id
    and auth_user_id = auth.uid()
  limit 1;

  if target_profile.id is null then
    raise exception 'Cliente no encontrado para este negocio';
  end if;

  select *
  into target_account
  from public.loyalty_accounts
  where business_id = target_business_id
    and customer_id = target_profile.id
  for update;

  if target_account.id is null then
    raise exception 'Cuenta de puntos no encontrada';
  end if;

  select *
  into target_reward
  from public.business_rewards
  where business_id = target_business_id
    and reward_key = target_reward_id
  for update;

  if target_reward.id is null then
    raise exception 'Premio no encontrado';
  end if;

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
      raise exception 'Necesitas nivel % para este premio', target_reward.min_tier;
    end if;
  end if;

  if target_account.points_balance < target_reward.points_cost then
    raise exception 'No tienes puntos suficientes para este premio';
  end if;

  update public.reward_redemptions
  set status = 'cancelled',
      status_updated_at = now(),
      status_updated_by_auth_user_id = auth.uid(),
      request_context = coalesce(public.reward_redemptions.request_context, '{}'::jsonb) || jsonb_build_object('autoCancelledReason', 'expired_request_replaced')
  where business_id = target_business_id
    and customer_id = target_profile.id
    and reward_id = target_reward.reward_key
    and status = 'requested'
    and requested_expires_at is not null
    and requested_expires_at < now();

  if exists (
    select 1
    from public.reward_redemptions
    where business_id = target_business_id
      and customer_id = target_profile.id
      and reward_id = target_reward.reward_key
      and status = 'requested'
  ) then
    raise exception 'Este premio ya tiene una solicitud pendiente';
  end if;

  insert into public.reward_redemptions (
    customer_id,
    business_id,
    reward_id,
    reward_name,
    points_cost,
    status,
    requested_by_auth_user_id,
    requested_expires_at,
    request_context
  )
  values (
    target_profile.id,
    target_business_id,
    target_reward.reward_key,
    target_reward.name,
    target_reward.points_cost,
    'requested',
    auth.uid(),
    now() + interval '15 minutes',
    coalesce(request_context, '{}'::jsonb)
  )
  returning * into created_redemption;

  return jsonb_build_object(
    'redemption', to_jsonb(created_redemption),
    'expiresAt', created_redemption.requested_expires_at
  );
end;
$$;

revoke all on function public.request_reward_redemption(text, text, jsonb) from public;
grant execute on function public.request_reward_redemption(text, text, jsonb) to authenticated;

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

  if next_status = 'approved'
     and target_redemption.status = 'requested'
     and target_redemption.requested_expires_at is not null
     and target_redemption.requested_expires_at < now() then
    update public.reward_redemptions
    set status = 'cancelled',
        status_updated_at = now(),
        status_updated_by_auth_user_id = auth.uid(),
        request_context = coalesce(request_context, '{}'::jsonb) || jsonb_build_object('autoCancelledReason', 'expired_request')
    where id = target_redemption.id
    returning * into target_redemption;

    raise exception 'La solicitud de canje vencio. El cliente debe pedir el canje de nuevo.';
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
  set status = next_status,
      status_updated_at = now(),
      status_updated_by_auth_user_id = auth.uid()
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
