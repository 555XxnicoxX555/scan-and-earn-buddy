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

drop function if exists public.lookup_loyalty_customer_by_qr(text, uuid);

create or replace function public.lookup_loyalty_customer_by_qr(
  target_business_id text,
  target_qr_id uuid
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_email text,
  points_balance integer,
  tier text,
  public_qr_id uuid,
  last_visit timestamptz,
  visit_count integer,
  weekly_streak integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    cp.id,
    cp.name,
    cp.email,
    la.points_balance,
    la.tier,
    la.public_qr_id,
    (
      select max(pe.created_at)
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as last_visit,
    (
      select count(*)::integer
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as visit_count,
    public.customer_weekly_purchase_streak(target_business_id, cp.id) as weekly_streak
  from public.customer_profiles cp
  join public.loyalty_accounts la on la.customer_id = cp.id
  where cp.business_id = target_business_id
    and la.business_id = target_business_id
    and la.public_qr_id = target_qr_id
  limit 1;
end;
$$;

drop function if exists public.lookup_loyalty_customers_for_consumption(text, text);

create or replace function public.lookup_loyalty_customers_for_consumption(
  target_business_id text,
  search_query text default ''
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_email text,
  points_balance integer,
  tier text,
  public_qr_id uuid,
  last_visit timestamptz,
  visit_count integer,
  weekly_streak integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_query text;
begin
  if auth.uid() is null or not public.is_business_staff(target_business_id) then
    raise exception 'No autorizado';
  end if;

  normalized_query := lower(trim(coalesce(search_query, '')));

  return query
  select
    cp.id,
    cp.name,
    cp.email,
    la.points_balance,
    la.tier,
    la.public_qr_id,
    (
      select max(pe.created_at)
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as last_visit,
    (
      select count(*)::integer
      from public.point_events pe
      where pe.customer_id = cp.id
        and pe.business_id = target_business_id
        and pe.event_type = 'purchase'
    ) as visit_count,
    public.customer_weekly_purchase_streak(target_business_id, cp.id) as weekly_streak
  from public.customer_profiles cp
  join public.loyalty_accounts la on la.customer_id = cp.id
  where cp.business_id = target_business_id
    and la.business_id = target_business_id
    and (
      normalized_query = ''
      or lower(coalesce(cp.name, '')) like '%' || normalized_query || '%'
      or lower(coalesce(cp.email, '')) like '%' || normalized_query || '%'
      or la.public_qr_id::text like '%' || normalized_query || '%'
    )
  order by cp.created_at desc
  limit 20;
end;
$$;

revoke all on function public.customer_weekly_purchase_streak(text, uuid) from public;
revoke all on function public.lookup_loyalty_customer_by_qr(text, uuid) from public;
revoke all on function public.lookup_loyalty_customers_for_consumption(text, text) from public;
grant execute on function public.customer_weekly_purchase_streak(text, uuid) to authenticated;
grant execute on function public.lookup_loyalty_customer_by_qr(text, uuid) to authenticated;
grant execute on function public.lookup_loyalty_customers_for_consumption(text, text) to authenticated;
