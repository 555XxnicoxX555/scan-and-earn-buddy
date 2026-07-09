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
  public_qr_id uuid
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
    la.public_qr_id
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

revoke all on function public.lookup_loyalty_customers_for_consumption(text, text) from public;
grant execute on function public.lookup_loyalty_customers_for_consumption(text, text) to authenticated;
