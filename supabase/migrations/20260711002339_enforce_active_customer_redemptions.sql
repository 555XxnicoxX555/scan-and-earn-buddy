create or replace function public.enforce_active_customer_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.customer_profiles
    where id = new.customer_id
      and business_id = new.business_id
      and status = 'active'
  ) then
    raise exception 'La cuenta del cliente no esta habilitada para solicitar canjes';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_active_customer_redemption
on public.reward_redemptions;

create trigger enforce_active_customer_redemption
before insert on public.reward_redemptions
for each row
execute function public.enforce_active_customer_redemption();

revoke all on function public.enforce_active_customer_redemption() from public, anon, authenticated;
