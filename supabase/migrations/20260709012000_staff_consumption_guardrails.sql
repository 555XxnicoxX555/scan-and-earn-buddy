create table if not exists public.business_staff_security_settings (
  business_id text primary key references public.businesses(id) on delete cascade,
  max_employee_purchase_total numeric(12,2) not null default 250000,
  max_employee_daily_total numeric(12,2) not null default 1000000,
  max_employee_daily_count integer not null default 80,
  require_qr_for_employee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_employee_purchase_total > 0),
  check (max_employee_daily_total > 0),
  check (max_employee_daily_count > 0)
);

alter table public.business_staff_security_settings enable row level security;

drop policy if exists "Owners can read staff security settings" on public.business_staff_security_settings;
create policy "Owners can read staff security settings"
on public.business_staff_security_settings for select
using (public.is_business_admin(business_id));

drop policy if exists "Owners can update staff security settings" on public.business_staff_security_settings;
create policy "Owners can update staff security settings"
on public.business_staff_security_settings for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Owners can insert staff security settings" on public.business_staff_security_settings;
create policy "Owners can insert staff security settings"
on public.business_staff_security_settings for insert
with check (public.is_business_admin(business_id));

alter table public.point_events
add column if not exists staff_role_at_recording text,
add column if not exists staff_daily_total_after numeric(12,2),
add column if not exists staff_daily_count_after integer,
add column if not exists staff_limit_snapshot jsonb not null default '{}'::jsonb,
add column if not exists staff_review_status text not null default 'normal';

alter table public.point_events
drop constraint if exists point_events_staff_review_status_check;

alter table public.point_events
add constraint point_events_staff_review_status_check
check (staff_review_status in ('normal', 'limit_checked', 'owner_bypass', 'needs_review'));

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
  staff_role text;
  security_settings public.business_staff_security_settings%rowtype;
  employee_daily_total_before numeric(12,2) := 0;
  employee_daily_count_before integer := 0;
  employee_daily_total_after numeric(12,2) := 0;
  employee_daily_count_after integer := 0;
  staff_review text := 'normal';
  limit_snapshot jsonb := '{}'::jsonb;
begin
  normalized_request_id := nullif(trim(coalesce(request_id, '')), '');
  normalized_items := coalesce(purchase_items, '[]'::jsonb);
  normalized_category := nullif(trim(coalesce(purchase_category, '')), '');
  normalized_note := nullif(trim(coalesce(purchase_note, '')), '');
  normalized_method := coalesce(nullif(trim(coalesce(entry_method, '')), ''), 'manual');

  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select ba.role
  into staff_role
  from public.business_admins ba
  where ba.business_id = target_business_id
    and ba.auth_user_id = auth.uid()
    and ba.role in ('owner', 'employee')
  order by case ba.role when 'owner' then 0 else 1 end
  limit 1;

  if staff_role is null then
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

  select *
  into security_settings
  from public.business_staff_security_settings
  where business_id = target_business_id;

  if security_settings.business_id is null then
    security_settings.business_id := target_business_id;
    security_settings.max_employee_purchase_total := 250000;
    security_settings.max_employee_daily_total := 1000000;
    security_settings.max_employee_daily_count := 80;
    security_settings.require_qr_for_employee := false;
  end if;

  if staff_role = 'employee' then
    if security_settings.require_qr_for_employee and normalized_method <> 'qr' then
      raise exception 'Este negocio requiere QR para cargas de empleados';
    end if;

    if purchase_total > security_settings.max_employee_purchase_total then
      raise exception 'El monto supera el limite permitido para empleados';
    end if;

    select
      coalesce(sum(pe.purchase_total), 0),
      count(*)::integer
    into employee_daily_total_before, employee_daily_count_before
    from public.point_events pe
    where pe.business_id = target_business_id
      and pe.recorded_by_auth_user_id = auth.uid()
      and pe.event_type = 'purchase'
      and coalesce(pe.purchase_status, 'confirmed') in ('confirmed', 'corrected')
      and pe.created_at >= date_trunc('day', now())
      and pe.created_at < date_trunc('day', now()) + interval '1 day';

    employee_daily_total_after := employee_daily_total_before + purchase_total;
    employee_daily_count_after := employee_daily_count_before + 1;

    if employee_daily_total_after > security_settings.max_employee_daily_total then
      raise exception 'El empleado supero el limite diario de monto cargado';
    end if;

    if employee_daily_count_after > security_settings.max_employee_daily_count then
      raise exception 'El empleado supero el limite diario de consumos cargados';
    end if;

    staff_review := 'limit_checked';
  else
    employee_daily_total_after := null;
    employee_daily_count_after := null;
    staff_review := 'owner_bypass';
  end if;

  limit_snapshot := jsonb_build_object(
    'staffRole', staff_role,
    'maxEmployeePurchaseTotal', security_settings.max_employee_purchase_total,
    'maxEmployeeDailyTotal', security_settings.max_employee_daily_total,
    'maxEmployeeDailyCount', security_settings.max_employee_daily_count,
    'requireQrForEmployee', security_settings.require_qr_for_employee
  );

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
    request_id,
    staff_role_at_recording,
    staff_daily_total_after,
    staff_daily_count_after,
    staff_limit_snapshot,
    staff_review_status
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
    normalized_request_id,
    staff_role,
    employee_daily_total_after,
    employee_daily_count_after,
    limit_snapshot,
    staff_review
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
      request_id,
      staff_role_at_recording,
      staff_limit_snapshot,
      staff_review_status
    )
    values (
      target_customer.id,
      target_business_id,
      'adjustment',
      streak_bonus_awarded,
      'Bonus de racha semanal',
      auth.uid(),
      normalized_request_id || ':streak',
      staff_role,
      limit_snapshot,
      staff_review
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
    'entryMethod', normalized_method,
    'staffRole', staff_role,
    'staffReviewStatus', staff_review,
    'staffDailyTotalAfter', employee_daily_total_after,
    'staffDailyCountAfter', employee_daily_count_after
  );
end;
$$;

revoke all on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) from public;
grant execute on function public.record_customer_consumption_v2(text, uuid, numeric, text, jsonb, text, text, text) to authenticated;
