create table if not exists public.dish_like_overrides (
  business_id text not null references public.businesses(id) on delete cascade,
  dish_id text not null,
  count_delta integer not null default 0 check (count_delta >= 0),
  note text,
  updated_at timestamptz not null default now(),
  primary key (business_id, dish_id)
);

alter table public.dish_like_overrides enable row level security;

drop policy if exists "Anyone can read dish like overrides" on public.dish_like_overrides;
create policy "Anyone can read dish like overrides"
on public.dish_like_overrides for select
using (true);

drop policy if exists "Business admins can manage dish like overrides" on public.dish_like_overrides;
create policy "Business admins can manage dish like overrides"
on public.dish_like_overrides for all
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

grant select on public.dish_like_overrides to anon, authenticated;
grant insert, update, delete on public.dish_like_overrides to authenticated;
