create table if not exists public.business_menu_settings (
  business_id text primary key references public.businesses(id) on delete cascade,
  recommended_dish_id text,
  popular_dish_id text,
  updated_at timestamptz not null default now()
);

alter table public.business_menu_settings enable row level security;

drop policy if exists "Anyone can read business menu settings" on public.business_menu_settings;
create policy "Anyone can read business menu settings"
on public.business_menu_settings for select
using (true);

drop policy if exists "Business admins can manage menu settings" on public.business_menu_settings;
create policy "Business admins can manage menu settings"
on public.business_menu_settings for all
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

grant select on public.business_menu_settings to anon, authenticated;
grant insert, update, delete on public.business_menu_settings to authenticated;
