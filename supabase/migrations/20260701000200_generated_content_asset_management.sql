grant select, insert, update, delete on public.generated_content_assets to authenticated;

drop policy if exists "Business admins can update generated content" on public.generated_content_assets;
create policy "Business admins can update generated content"
on public.generated_content_assets for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "Business admins can delete generated content" on public.generated_content_assets;
create policy "Business admins can delete generated content"
on public.generated_content_assets for delete
using (public.is_business_admin(business_id));

drop policy if exists "Business admins can delete generated content images" on storage.objects;
create policy "Business admins can delete generated content images"
on storage.objects for delete
using (
  bucket_id = 'generated-content'
  and public.is_business_admin((storage.foldername(name))[1])
);
