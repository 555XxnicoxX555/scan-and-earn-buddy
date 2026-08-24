-- Audited redemption workflow. Apply after the existing redemption hardening migrations.

alter table public.reward_redemptions
  add column if not exists requested_by_auth_user_id uuid,
  add column if not exists requested_expires_at timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_updated_by_auth_user_id uuid;

update public.reward_redemptions rr
set requested_by_auth_user_id = null
where requested_by_auth_user_id is not null
  and not exists (select 1 from auth.users au where au.id = rr.requested_by_auth_user_id);
update public.reward_redemptions rr
set status_updated_by_auth_user_id = null
where status_updated_by_auth_user_id is not null
  and not exists (select 1 from auth.users au where au.id = rr.status_updated_by_auth_user_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reward_redemptions_requested_by_auth_user_id_fkey') then
    alter table public.reward_redemptions add constraint reward_redemptions_requested_by_auth_user_id_fkey foreign key (requested_by_auth_user_id) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reward_redemptions_status_updated_by_auth_user_id_fkey') then
    alter table public.reward_redemptions add constraint reward_redemptions_status_updated_by_auth_user_id_fkey foreign key (status_updated_by_auth_user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

-- All writes go through the request/transition RPCs; inherited direct-write policies are removed.
drop policy if exists "Customers can request own redemptions" on public.reward_redemptions;
drop policy if exists "Business admins can update business redemptions" on public.reward_redemptions;
drop policy if exists "Business managers can update business redemptions" on public.reward_redemptions;
revoke insert, update, delete on public.reward_redemptions from public, anon, authenticated;
grant select on public.reward_redemptions to authenticated;

create or replace function public.enforce_reward_redemption_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.customer_profiles cp
    where cp.id = new.customer_id and cp.business_id = new.business_id
  ) then raise exception 'Cliente invalido para este negocio'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'requested' then raise exception 'Todo canje debe comenzar como solicitado'; end if;
    if new.requested_by_auth_user_id is distinct from auth.uid() then raise exception 'Actor de solicitud invalido'; end if;
    if not exists (
      select 1 from public.business_rewards br
      where br.reward_key = new.reward_id and br.business_id = new.business_id
        and br.name = new.reward_name and br.points_cost = new.points_cost
    ) then raise exception 'Premio invalido para este negocio'; end if;
    new.request_context := jsonb_strip_nulls(jsonb_build_object(
      'source', left(new.request_context->>'source', 64),
      'language', left(new.request_context->>'language', 16),
      'path', left(new.request_context->>'path', 256)
    ));
  elsif new.business_id is distinct from old.business_id
     or new.customer_id is distinct from old.customer_id
     or new.reward_id is distinct from old.reward_id
     or new.reward_name is distinct from old.reward_name
     or new.points_cost is distinct from old.points_cost
     or new.requested_by_auth_user_id is distinct from old.requested_by_auth_user_id
     or new.requested_expires_at is distinct from old.requested_expires_at
  then raise exception 'La identidad del canje es inmutable'; end if;
  if pg_column_size(coalesce(new.request_context, '{}'::jsonb)) > 8192 then raise exception 'El contexto de solicitud es demasiado grande'; end if;
  return new;
end;
$$;

drop trigger if exists enforce_reward_redemption_integrity on public.reward_redemptions;
create trigger enforce_reward_redemption_integrity
before insert or update on public.reward_redemptions
for each row execute function public.enforce_reward_redemption_integrity();
revoke all on function public.enforce_reward_redemption_integrity() from public, anon, authenticated;

create table if not exists public.reward_redemption_events (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.reward_redemptions(id),
  business_id text not null references public.businesses(id),
  from_status text,
  to_status text not null check (to_status in ('requested', 'approved', 'redeemed', 'cancelled')),
  -- UUID snapshot intentionally has no FK: deleting an auth account must not erase audit identity.
  actor_auth_user_id uuid,
  actor_role text not null default 'unknown' check (actor_role in ('customer', 'owner', 'manager', 'employee', 'system', 'unknown')),
  actor_label text not null default 'No disponible',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists reward_redemption_events_redemption_idx
  on public.reward_redemption_events (redemption_id, occurred_at desc, id desc);
create index if not exists reward_redemption_events_business_idx
  on public.reward_redemption_events (business_id, occurred_at desc);
create unique index if not exists reward_redemption_events_transition_uidx
  on public.reward_redemption_events (redemption_id, coalesce(from_status, '__initial__'), to_status);

create index if not exists reward_redemptions_staff_queue_idx
  on public.reward_redemptions (business_id, status, created_at, id)
  where status in ('requested', 'approved');
create index if not exists reward_redemptions_expiration_idx
  on public.reward_redemptions (business_id, requested_expires_at, id)
  where status = 'requested' and requested_expires_at is not null;

alter table public.reward_redemption_events enable row level security;

drop policy if exists "Customers and managers can read redemption history" on public.reward_redemption_events;
drop policy if exists "Managers can read redemption history" on public.reward_redemption_events;
create policy "Managers can read redemption history"
on public.reward_redemption_events for select
to authenticated
using (
  public.is_business_manager(reward_redemption_events.business_id)
);

revoke all on public.reward_redemption_events from public, anon, authenticated;
grant select on public.reward_redemption_events to authenticated;

create or replace function public.prevent_reward_redemption_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'El historial de canjes es inmutable';
end;
$$;

drop trigger if exists reward_redemption_events_no_update on public.reward_redemption_events;
create trigger reward_redemption_events_no_update
before update or delete on public.reward_redemption_events
for each row execute function public.prevent_reward_redemption_event_mutation();
revoke all on function public.prevent_reward_redemption_event_mutation() from public, anon, authenticated;

create or replace function public.reward_redemption_actor_role(target_business_id text, target_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select ba.role
    from public.business_admins ba
    where ba.business_id = target_business_id and ba.auth_user_id = target_user_id
    order by case ba.role when 'owner' then 0 when 'manager' then 1 else 2 end
    limit 1
  ), 'unknown');
$$;
revoke all on function public.reward_redemption_actor_role(text, uuid) from public, anon, authenticated;

create or replace function public.reward_redemption_actor_label(target_user_id uuid, fallback_label text default 'No disponible')
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(nullif(trim(coalesce(
    (select raw_user_meta_data->>'name' from auth.users where id = target_user_id),
    '')), ''), nullif(trim(coalesce(fallback_label, '')), ''), 'No disponible');
$$;
revoke all on function public.reward_redemption_actor_label(uuid, text) from public, anon, authenticated;

create or replace function public.record_reward_redemption_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_role text;
  actor_label text;
begin
  actor_id := auth.uid();
  actor_role := case
    when actor_id is not null then public.reward_redemption_actor_role(new.business_id, actor_id)
    else 'unknown'
  end;
  if actor_role = 'unknown' and actor_id is not null then
    actor_role := 'customer';
  end if;
  actor_label := public.reward_redemption_actor_label(actor_id, case when actor_role = 'customer' then 'Cliente' else 'No disponible' end);
  insert into public.reward_redemption_events (
    redemption_id, business_id, from_status, to_status, actor_auth_user_id, actor_role, actor_label, metadata
  ) values (
    new.id, new.business_id, null, new.status, actor_id, actor_role, actor_label,
    jsonb_build_object('source', 'redemption_insert', 'pointsDelta', 0, 'rewardStockDelta', 0, 'redemptionId', new.id)
  );
  return new;
end;
$$;
revoke all on function public.record_reward_redemption_event() from public, anon, authenticated;

drop trigger if exists reward_redemptions_record_initial_event on public.reward_redemptions;
create trigger reward_redemptions_record_initial_event
after insert on public.reward_redemptions
for each row execute function public.record_reward_redemption_event();

create or replace function public.record_reward_redemption_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_label text;
  points_delta integer := 0;
  stock_delta integer := 0;
begin
  if old.status is distinct from new.status then
    if old.status = 'requested'
       and new.status = 'cancelled'
       and new.status_updated_by_auth_user_id is null
       and coalesce(new.request_context->>'autoCancelledReason', '') <> '' then
      actor_role := 'system';
      actor_label := 'Sistema';
    else
      actor_role := public.reward_redemption_actor_role(new.business_id, new.status_updated_by_auth_user_id);
      if actor_role = 'unknown' and new.status_updated_by_auth_user_id is not null and exists (
        select 1 from public.customer_profiles cp
        where cp.business_id = new.business_id and cp.auth_user_id = new.status_updated_by_auth_user_id
      ) then actor_role := 'customer'; end if;
      actor_label := public.reward_redemption_actor_label(new.status_updated_by_auth_user_id, 'No disponible');
    end if;
    points_delta := case when old.status = 'requested' and new.status = 'approved' then -new.points_cost when old.status = 'approved' and new.status = 'cancelled' then new.points_cost else 0 end;
    if old.status = 'requested' and new.status = 'approved' then
      select case when br.stock is null then 0 else -1 end into stock_delta from public.business_rewards br where br.business_id = new.business_id and br.reward_key = new.reward_id;
    elsif old.status = 'approved' and new.status = 'cancelled' then
      select case when br.stock is null then 0 else 1 end into stock_delta from public.business_rewards br where br.business_id = new.business_id and br.reward_key = new.reward_id;
    end if;
    insert into public.reward_redemption_events (
      redemption_id, business_id, from_status, to_status, actor_auth_user_id, actor_role, actor_label, metadata
    ) values (
      new.id, new.business_id, old.status, new.status,
      case when actor_role = 'system' then null else new.status_updated_by_auth_user_id end,
      actor_role, actor_label, jsonb_build_object('source', 'redemption_transition', 'pointsDelta', points_delta, 'rewardStockDelta', coalesce(stock_delta, 0), 'redemptionId', new.id)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.record_reward_redemption_transition() from public, anon, authenticated;

drop trigger if exists reward_redemptions_record_transition on public.reward_redemptions;
create trigger reward_redemptions_record_transition
after update of status on public.reward_redemptions
for each row execute function public.record_reward_redemption_transition();

-- Reconstruct only transitions supported by historical evidence. Unknown actors remain explicit.
insert into public.reward_redemption_events (redemption_id, business_id, from_status, to_status, actor_auth_user_id, actor_role, actor_label, metadata, occurred_at)
select rr.id, rr.business_id, null, 'requested', rr.requested_by_auth_user_id,
       case when exists (
         select 1 from public.customer_profiles cp
         where cp.business_id = rr.business_id and cp.auth_user_id = rr.requested_by_auth_user_id
       ) then 'customer' else 'unknown' end,
       public.reward_redemption_actor_label(rr.requested_by_auth_user_id, 'No disponible'),
       jsonb_build_object('source', 'historical_backfill', 'pointsDelta', 0, 'rewardStockDelta', 0, 'redemptionId', rr.id), coalesce(rr.created_at, now())
from public.reward_redemptions rr
where (rr.status = 'requested' or rr.requested_by_auth_user_id is not null)
  and not exists (
  select 1 from public.reward_redemption_events re where re.redemption_id = rr.id
);

insert into public.reward_redemption_events (redemption_id, business_id, from_status, to_status, actor_auth_user_id, actor_role, actor_label, metadata, occurred_at)
select rr.id, rr.business_id,
       case when rr.requested_by_auth_user_id is not null then 'requested' else null end,
       rr.status,
       rr.status_updated_by_auth_user_id,
       case
         when rr.status_updated_by_auth_user_id is null then 'unknown'
         else public.reward_redemption_actor_role(rr.business_id, rr.status_updated_by_auth_user_id)
       end,
       public.reward_redemption_actor_label(rr.status_updated_by_auth_user_id, 'No disponible'),
       jsonb_build_object('source', 'historical_status_backfill', 'incomplete', true, 'redemptionId', rr.id), coalesce(rr.status_updated_at, rr.created_at, now())
from public.reward_redemptions rr
where rr.status <> 'requested'
  and not exists (
    select 1 from public.reward_redemption_events re
    where re.redemption_id = rr.id and re.to_status = rr.status
  );

create or replace function public.get_staff_redemption_queue(
  target_business_id text,
  queue_status text default 'open'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_role text;
  payload jsonb;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  select ba.role into staff_role
  from public.business_admins ba
  where ba.business_id = target_business_id and ba.auth_user_id = auth.uid()
    and ba.role in ('owner', 'manager', 'employee')
  order by case ba.role when 'owner' then 0 when 'manager' then 1 else 2 end limit 1;
  if staff_role is null then raise exception 'No autorizado'; end if;
  with expired as (
    select id
    from public.reward_redemptions
    where business_id = target_business_id
      and status = 'requested'
      and requested_expires_at is not null
      and requested_expires_at < now()
    order by requested_expires_at asc, id
    limit 100
    for update skip locked
  )
  update public.reward_redemptions rr
  set status = 'cancelled',
      status_updated_at = now(),
      status_updated_by_auth_user_id = null,
      request_context = coalesce(request_context, '{}'::jsonb) || jsonb_build_object('autoCancelledReason', 'expired_request')
  from expired
  where rr.id = expired.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'customer_id', q.customer_id, 'customer_name', q.customer_name,
    'reward_name', q.reward_name, 'points_cost', q.points_cost, 'status', q.status,
    'created_at', q.created_at, 'requested_expires_at', q.requested_expires_at,
    'status_updated_at', q.status_updated_at
  ) order by q.created_at asc), '[]'::jsonb) into payload
  from (
    select rr.id, rr.customer_id, cp.name as customer_name, rr.reward_name, rr.points_cost,
      rr.status, rr.created_at, rr.requested_expires_at, rr.status_updated_at
    from public.reward_redemptions rr
    join public.customer_profiles cp on cp.id = rr.customer_id and cp.business_id = rr.business_id
    where rr.business_id = target_business_id
      and (
        (queue_status = 'approved' and rr.status = 'approved')
        or (queue_status = 'requested' and rr.status = 'requested')
        or (queue_status = 'open' and rr.status in ('requested', 'approved'))
      )
    order by rr.created_at asc
    limit 100
  ) q;
  return payload;
end;
$$;

revoke all on function public.get_staff_redemption_queue(text, text) from public, anon;
grant execute on function public.get_staff_redemption_queue(text, text) to authenticated;

create or replace function public.manage_reward_redemption_status_v2(
  target_business_id text,
  target_redemption_id uuid,
  expected_status text,
  next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rr public.reward_redemptions%rowtype;
  account public.loyalty_accounts%rowtype;
  reward public.business_rewards%rowtype;
  staff_role text;
  next_balance integer;
  next_tier text;
  delta integer := 0;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  select ba.role into staff_role from public.business_admins ba
  where ba.business_id = target_business_id and ba.auth_user_id = auth.uid()
    and ba.role in ('owner', 'manager', 'employee') limit 1;
  if staff_role is null then raise exception 'No autorizado'; end if;
  if not (
    (expected_status = 'requested' and next_status in ('approved', 'cancelled'))
    or (expected_status = 'approved' and next_status in ('redeemed', 'cancelled'))
  ) then raise exception 'Transicion invalida'; end if;
  -- Read the immutable identity first. Approval takes the same account -> reward lock
  -- order as request_reward_redemption before locking and revalidating the redemption.
  select * into rr from public.reward_redemptions
  where id = target_redemption_id and business_id = target_business_id;
  if rr.id is null then raise exception 'Canje no encontrado'; end if;
  if next_status = 'cancelled' and staff_role = 'employee' then raise exception 'Los empleados no pueden cancelar canjes'; end if;

  if expected_status = 'requested' and next_status = 'approved' then
    select * into account from public.loyalty_accounts
    where customer_id = rr.customer_id and business_id = target_business_id for update;
    if account.id is null then raise exception 'Cuenta de puntos no encontrada'; end if;
    select * into reward from public.business_rewards
    where business_id = target_business_id and reward_key = rr.reward_id for update;
  end if;

  select * into rr from public.reward_redemptions
  where id = target_redemption_id and business_id = target_business_id for update;
  if rr.id is null then raise exception 'Canje no encontrado'; end if;
  if rr.status = next_status then return jsonb_build_object('redemption', to_jsonb(rr) - 'request_context' - 'requested_by_auth_user_id' - 'status_updated_by_auth_user_id', 'account', null, 'idempotent', true); end if;
  if rr.status is distinct from expected_status then raise exception 'El canje cambio; actualiza la cola'; end if;
  if rr.status = 'requested' and rr.requested_expires_at is not null and rr.requested_expires_at < now() then
    update public.reward_redemptions
    set status = 'cancelled', status_updated_at = now(), status_updated_by_auth_user_id = null,
        request_context = coalesce(request_context, '{}'::jsonb) || jsonb_build_object('autoCancelledReason', 'expired_request')
    where id = rr.id returning * into rr;
    return jsonb_build_object('redemption', to_jsonb(rr) - 'request_context' - 'requested_by_auth_user_id' - 'status_updated_by_auth_user_id', 'account', null, 'pointsDelta', 0, 'expired', true, 'idempotent', false);
  end if;

  if next_status = 'approved' then
    if not exists (
      select 1 from public.customer_profiles cp
      where cp.id = rr.customer_id and cp.business_id = target_business_id and cp.status = 'active'
    ) then raise exception 'La cuenta del cliente no esta habilitada'; end if;
    if reward.id is null then raise exception 'Premio no encontrado para este negocio'; end if;
    if rr.points_cost is distinct from reward.points_cost or rr.reward_name is distinct from reward.name then
      raise exception 'El premio cambio desde la solicitud; el cliente debe solicitarlo nuevamente';
    end if;
    if reward.active is false then raise exception 'El premio no esta activo'; end if;
    if reward.valid_until is not null and reward.valid_until < current_date then raise exception 'El premio esta vencido'; end if;
    if nullif(reward.min_tier, '') is not null and (
      case coalesce(nullif(account.tier, ''), 'bronze') when 'platinum' then 3 when 'gold' then 2 when 'silver' then 1 else 0 end
      < case reward.min_tier when 'platinum' then 3 when 'gold' then 2 when 'silver' then 1 else 0 end
    ) then raise exception 'El cliente no tiene el nivel requerido para este premio'; end if;
    if account.points_balance < rr.points_cost then raise exception 'El cliente no tiene puntos suficientes'; end if;
    if reward.id is not null and reward.stock is not null then
      if reward.stock <= 0 then raise exception 'El premio no tiene stock disponible'; end if;
      update public.business_rewards set stock = stock - 1 where id = reward.id;
    end if;
    next_balance := account.points_balance - rr.points_cost;
    next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);
    update public.loyalty_accounts set points_balance = next_balance, tier = next_tier where id = account.id returning * into account;
    insert into public.point_events (customer_id, business_id, event_type, points_delta, description, recorded_by_auth_user_id)
      values (rr.customer_id, target_business_id, 'redeem', -rr.points_cost, 'Canje aprobado: ' || rr.reward_name, auth.uid());
    delta := -rr.points_cost;
  elsif next_status = 'cancelled' and rr.status = 'approved' then
    select * into account from public.loyalty_accounts
    where customer_id = rr.customer_id and business_id = target_business_id for update;
    if account.id is null then raise exception 'Cuenta de puntos no encontrada'; end if;
    select * into reward from public.business_rewards
    where business_id = target_business_id and reward_key = rr.reward_id for update;
    if reward.id is not null and reward.stock is not null then update public.business_rewards set stock = stock + 1 where id = reward.id; end if;
    next_balance := account.points_balance + rr.points_cost;
    next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);
    update public.loyalty_accounts set points_balance = next_balance, tier = next_tier where id = account.id returning * into account;
    insert into public.point_events (customer_id, business_id, event_type, points_delta, description, recorded_by_auth_user_id)
      values (rr.customer_id, target_business_id, 'adjustment', rr.points_cost, 'Canje cancelado y puntos devueltos: ' || rr.reward_name, auth.uid());
    delta := rr.points_cost;
  end if;
  update public.reward_redemptions set status = next_status, status_updated_at = now(), status_updated_by_auth_user_id = auth.uid() where id = rr.id returning * into rr;
  return jsonb_build_object('redemption', to_jsonb(rr) - 'request_context' - 'requested_by_auth_user_id' - 'status_updated_by_auth_user_id', 'account', to_jsonb(account), 'pointsDelta', delta, 'idempotent', false);
end;
$$;

revoke all on function public.manage_reward_redemption_status_v2(text, uuid, text, text) from public, anon;
grant execute on function public.manage_reward_redemption_status_v2(text, uuid, text, text) to authenticated;

-- Keep the legacy entry point safe for older clients; it delegates to the strict RPC.
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
declare current_status text;
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then raise exception 'No autorizado'; end if;
  select status into current_status from public.reward_redemptions
  where id = target_redemption_id and business_id = target_business_id;
  if current_status is null then raise exception 'Canje no encontrado'; end if;
  return public.manage_reward_redemption_status_v2(target_business_id, target_redemption_id, current_status, next_status);
end;
$$;

revoke all on function public.manage_reward_redemption_status(text, uuid, text) from public, anon;
grant execute on function public.manage_reward_redemption_status(text, uuid, text) to authenticated;

create or replace function public.get_reward_redemption_history(target_business_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_business_manager(target_business_id) then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(to_jsonb(re) order by re.occurred_at desc, re.id desc)
    from (select * from public.reward_redemption_events
      where business_id = target_business_id
      order by occurred_at desc, id desc limit 2000) re), '[]'::jsonb);
end;
$$;

revoke all on function public.get_reward_redemption_history(text) from public, anon;
grant execute on function public.get_reward_redemption_history(text) to authenticated;

-- Audit rows are retained append-only; operational removal is a soft status transition,
-- never a DELETE. Retention/archival policy is documented in ADMIN_PANEL.md.
notify pgrst, 'reload schema';
