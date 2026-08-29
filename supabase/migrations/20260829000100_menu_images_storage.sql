insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images-public', 'menu-images-public', true, 3145728, array['image/webp']),
  ('menu-images-originals', 'menu-images-originals', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public optimized menu images are readable" on storage.objects;
create policy "Public optimized menu images are readable"
on storage.objects for select
using (bucket_id = 'menu-images-public');

drop policy if exists "Business admins manage optimized menu images" on storage.objects;
create policy "Business admins manage optimized menu images"
on storage.objects for all
to authenticated
using (
  bucket_id = 'menu-images-public'
  and public.is_business_admin((storage.foldername(name))[1])
)
with check (
  bucket_id = 'menu-images-public'
  and public.is_business_admin((storage.foldername(name))[1])
);

drop policy if exists "Business admins manage original menu images" on storage.objects;
create policy "Business admins manage original menu images"
on storage.objects for all
to authenticated
using (
  bucket_id = 'menu-images-originals'
  and public.is_business_admin((storage.foldername(name))[1])
)
with check (
  bucket_id = 'menu-images-originals'
  and public.is_business_admin((storage.foldername(name))[1])
);
