create table if not exists public.dish_likes (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  dish_id text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (business_id, dish_id, auth_user_id)
);

alter table public.dish_likes enable row level security;

drop policy if exists "Anyone can read dish likes" on public.dish_likes;
create policy "Anyone can read dish likes"
on public.dish_likes for select
using (true);

drop policy if exists "Customers can like dishes" on public.dish_likes;
create policy "Customers can like dishes"
on public.dish_likes for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "Customers can remove own dish likes" on public.dish_likes;
create policy "Customers can remove own dish likes"
on public.dish_likes for delete
using (auth.uid() = auth_user_id);

create index if not exists dish_likes_business_dish_idx
on public.dish_likes (business_id, dish_id);

grant select on public.dish_likes to anon, authenticated;
grant insert, delete on public.dish_likes to authenticated;
