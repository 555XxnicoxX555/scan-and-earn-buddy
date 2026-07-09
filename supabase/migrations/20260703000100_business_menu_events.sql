create table if not exists public.business_menu_events (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  event_type text not null check (event_type in ('menu_view', 'dish_detail_view', 'signup_start', 'signup_complete')),
  dish_id text,
  session_id text,
  customer_id uuid references public.customer_profiles(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists business_menu_events_business_created_idx
on public.business_menu_events (business_id, created_at desc);

create index if not exists business_menu_events_business_type_created_idx
on public.business_menu_events (business_id, event_type, created_at desc);

create index if not exists business_menu_events_business_dish_created_idx
on public.business_menu_events (business_id, dish_id, created_at desc)
where dish_id is not null;

alter table public.business_menu_events enable row level security;

drop policy if exists "Public can record business menu events" on public.business_menu_events;
create policy "Public can record business menu events"
on public.business_menu_events for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
  )
);

drop policy if exists "Business owners can read menu events" on public.business_menu_events;
create policy "Business owners can read menu events"
on public.business_menu_events for select
to authenticated
using (public.is_business_admin(business_id));

grant insert on public.business_menu_events to anon, authenticated;
grant select on public.business_menu_events to authenticated;
