create table if not exists public.point_event_corrections (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  original_event_id uuid not null references public.point_events(id) on delete cascade,
  adjustment_event_id uuid references public.point_events(id) on delete set null,
  corrected_by_auth_user_id uuid references auth.users(id) on delete set null,
  previous_purchase_total numeric,
  next_purchase_total numeric,
  previous_points_delta integer,
  next_points_delta integer,
  points_delta_adjustment integer not null default 0,
  previous_purchase_items jsonb,
  next_purchase_items jsonb,
  previous_purchase_category text,
  next_purchase_category text,
  previous_purchase_note text,
  next_purchase_note text,
  correction_note text,
  created_at timestamptz not null default now()
);

alter table public.point_event_corrections enable row level security;

drop policy if exists "Business owners can read point event corrections" on public.point_event_corrections;
create policy "Business owners can read point event corrections"
on public.point_event_corrections for select
using (public.is_business_admin(business_id));

create index if not exists point_event_corrections_business_created_idx
on public.point_event_corrections (business_id, created_at desc);

create index if not exists point_event_corrections_original_event_idx
on public.point_event_corrections (original_event_id, created_at desc);

create or replace function public.correct_customer_consumption(
  target_business_id text,
  target_event_id uuid,
  next_purchase_total numeric,
  next_purchase_items jsonb default '[]'::jsonb,
  next_purchase_category text default null,
  next_purchase_note text default null,
  correction_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.point_events%rowtype;
  target_account public.loyalty_accounts%rowtype;
  normalized_items jsonb := coalesce(next_purchase_items, '[]'::jsonb);
  normalized_category text := nullif(trim(coalesce(next_purchase_category, '')), '');
  normalized_note text := nullif(trim(coalesce(next_purchase_note, '')), '');
  normalized_correction_note text := nullif(trim(coalesce(correction_note, '')), '');
  selected_rate numeric;
  previous_purchase_total numeric;
  previous_purchase_items jsonb;
  previous_purchase_category text;
  previous_purchase_note text;
  previous_points integer;
  next_points integer;
  delta_points integer;
  next_balance integer;
  next_tier text;
  adjustment_event public.point_events%rowtype;
  correction_row public.point_event_corrections%rowtype;
begin
  if auth.uid() is null or not public.is_business_admin(target_business_id) then
    raise exception 'No autorizado';
  end if;

  if next_purchase_total is null or next_purchase_total <= 0 then
    raise exception 'El monto corregido debe ser mayor a cero';
  end if;

  if jsonb_typeof(normalized_items) <> 'array' then
    raise exception 'Los productos deben enviarse como array';
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

  if coalesce(target_event.purchase_status, 'confirmed') = 'cancelled' then
    raise exception 'No se puede corregir un consumo cancelado';
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

  selected_rate := coalesce(target_event.earn_rate, 0.10);
  previous_purchase_total := target_event.purchase_total;
  previous_purchase_items := target_event.purchase_items;
  previous_purchase_category := target_event.purchase_category;
  previous_purchase_note := target_event.purchase_note;
  previous_points := greatest(0, coalesce(target_event.points_delta, 0));
  next_points := floor(next_purchase_total * selected_rate)::integer;
  if selected_rate > 0 and next_points < 1 then
    next_points := 1;
  end if;
  delta_points := next_points - previous_points;
  next_balance := target_account.points_balance + delta_points;

  if next_balance < 0 then
    raise exception 'Saldo insuficiente para aplicar la correccion';
  end if;

  next_tier := public.loyalty_tier_for_points(target_business_id, next_balance);

  update public.loyalty_accounts
  set points_balance = next_balance,
      tier = next_tier,
      updated_at = now()
  where id = target_account.id
  returning * into target_account;

  update public.point_events
  set purchase_total = next_purchase_total,
      purchase_items = normalized_items,
      purchase_category = normalized_category,
      purchase_note = normalized_note,
      points_delta = next_points,
      purchase_status = 'corrected',
      description = case
        when normalized_correction_note is null then 'Consumo corregido por owner'
        else 'Consumo corregido por owner: ' || normalized_correction_note
      end
  where id = target_event.id
  returning * into target_event;

  if delta_points <> 0 then
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
      target_event.customer_id,
      target_business_id,
      'adjustment',
      delta_points,
      'Ajuste por correccion de consumo',
      auth.uid(),
      'correction:' || target_event.id::text || ':' || gen_random_uuid()::text
    )
    returning * into adjustment_event;
  end if;

  insert into public.point_event_corrections (
    business_id,
    original_event_id,
    adjustment_event_id,
    corrected_by_auth_user_id,
    previous_purchase_total,
    next_purchase_total,
    previous_points_delta,
    next_points_delta,
    points_delta_adjustment,
    previous_purchase_items,
    next_purchase_items,
    previous_purchase_category,
    next_purchase_category,
    previous_purchase_note,
    next_purchase_note,
    correction_note
  )
  values (
    target_business_id,
    target_event.id,
    adjustment_event.id,
    auth.uid(),
    previous_purchase_total,
    next_purchase_total,
    previous_points,
    next_points,
    delta_points,
    previous_purchase_items,
    normalized_items,
    previous_purchase_category,
    normalized_category,
    previous_purchase_note,
    normalized_note,
    normalized_correction_note
  )
  returning * into correction_row;

  return jsonb_build_object(
    'event', to_jsonb(target_event),
    'account', to_jsonb(target_account),
    'adjustmentEvent', case when adjustment_event.id is not null then to_jsonb(adjustment_event) else null end,
    'correction', to_jsonb(correction_row)
  );
end;
$$;

revoke all on function public.correct_customer_consumption(text, uuid, numeric, jsonb, text, text, text) from public;
grant execute on function public.correct_customer_consumption(text, uuid, numeric, jsonb, text, text, text) to authenticated;

create or replace function public.get_business_admin_dashboard(
  target_business_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null or not public.is_business_admin(target_business_id) then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'customers', coalesce((
      select jsonb_agg(to_jsonb(customer_row) order by customer_row.created_at desc)
      from (
        select *
        from public.customer_profiles
        where business_id = target_business_id
        order by created_at desc
        limit 500
      ) customer_row
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(account_row) order by account_row.updated_at desc)
      from (
        select *
        from public.loyalty_accounts
        where business_id = target_business_id
        order by updated_at desc
        limit 500
      ) account_row
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(event_row) order by event_row.created_at desc)
      from (
        select *
        from public.point_events
        where business_id = target_business_id
        order by created_at desc
        limit 1000
      ) event_row
    ), '[]'::jsonb),
    'redemptions', coalesce((
      select jsonb_agg(to_jsonb(redemption_row) order by redemption_row.created_at desc)
      from (
        select *
        from public.reward_redemptions
        where business_id = target_business_id
        order by created_at desc
        limit 500
      ) redemption_row
    ), '[]'::jsonb),
    'menuEvents', coalesce((
      select jsonb_agg(to_jsonb(menu_event_row) order by menu_event_row.created_at desc)
      from (
        select *
        from public.business_menu_events
        where business_id = target_business_id
        order by created_at desc
        limit 1000
      ) menu_event_row
    ), '[]'::jsonb),
    'consumptionCorrections', coalesce((
      select jsonb_agg(to_jsonb(correction_row) order by correction_row.created_at desc)
      from (
        select *
        from public.point_event_corrections
        where business_id = target_business_id
        order by created_at desc
        limit 500
      ) correction_row
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

revoke all on function public.get_business_admin_dashboard(text) from public;
grant execute on function public.get_business_admin_dashboard(text) to authenticated;
