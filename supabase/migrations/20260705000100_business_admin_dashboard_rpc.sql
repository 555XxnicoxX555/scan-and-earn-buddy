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
