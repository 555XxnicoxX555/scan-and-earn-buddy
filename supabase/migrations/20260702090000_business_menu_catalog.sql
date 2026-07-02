create table if not exists public.business_menu_catalog (
  business_id text primary key references public.businesses(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_by_auth_user_id uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.business_menu_catalog enable row level security;

drop policy if exists "Anyone can read business menu catalog" on public.business_menu_catalog;
create policy "Anyone can read business menu catalog"
on public.business_menu_catalog for select
using (true);

drop policy if exists "Business owners can insert menu catalog" on public.business_menu_catalog;
create policy "Business owners can insert menu catalog"
on public.business_menu_catalog for insert
with check (public.is_business_admin(business_id));

drop policy if exists "Business owners can update menu catalog" on public.business_menu_catalog;
create policy "Business owners can update menu catalog"
on public.business_menu_catalog for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Business owners can delete menu catalog" on public.business_menu_catalog;
create policy "Business owners can delete menu catalog"
on public.business_menu_catalog for delete
using (public.is_business_admin(business_id));

grant select on public.business_menu_catalog to anon, authenticated;
grant insert, update, delete on public.business_menu_catalog to authenticated;
