alter table public.customer_profiles
add column if not exists status text not null default 'active';

alter table public.customer_profiles
drop constraint if exists customer_profiles_status_check;

alter table public.customer_profiles
add constraint customer_profiles_status_check
check (status in ('active', 'incomplete', 'blocked', 'deleted'));

create or replace function public.prevent_customer_status_self_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is distinct from new.status
    and not public.is_business_admin(old.business_id) then
    raise exception 'No autorizado para cambiar el estado del cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_customer_status_self_update on public.customer_profiles;
create trigger prevent_customer_status_self_update
before update on public.customer_profiles
for each row
execute function public.prevent_customer_status_self_update();

drop policy if exists "Business owners can update business customer status" on public.customer_profiles;
create policy "Business owners can update business customer status"
on public.customer_profiles for update
to authenticated
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Customers can request own redemptions" on public.reward_redemptions;
create policy "Customers can request own redemptions"
on public.reward_redemptions for insert
to authenticated
with check (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = reward_redemptions.customer_id
      and cp.business_id = reward_redemptions.business_id
      and cp.auth_user_id = (select auth.uid())
      and coalesce(cp.status, 'active') = 'active'
  )
);
