alter table public.business_rewards
add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reward-images',
  'reward-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reward images are readable" on storage.objects;
create policy "Public reward images are readable"
on storage.objects for select
using (bucket_id = 'reward-images');

drop policy if exists "Business owners manage reward images" on storage.objects;
create policy "Business owners manage reward images"
on storage.objects for all
to authenticated
using (
  bucket_id = 'reward-images'
  and public.is_business_admin((storage.foldername(name))[1])
)
with check (
  bucket_id = 'reward-images'
  and public.is_business_admin((storage.foldername(name))[1])
);

update public.business_rewards
set image_url = case reward_key
  when 'coffee' then 'assets/menu/americano.png'
  when 'dessert' then 'assets/menu/brownie-helado.png'
  when 'shawarma' then 'assets/menu/shawarma-carne.png'
  else image_url
end
where business_id = 'sumi'
  and nullif(trim(coalesce(image_url, '')), '') is null
  and reward_key in ('coffee', 'dessert', 'shawarma');
