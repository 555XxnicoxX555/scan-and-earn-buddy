alter table public.generated_content_assets
add column if not exists request_key text;

create index if not exists generated_content_assets_request_key_idx
on public.generated_content_assets (business_id, request_key, created_at desc)
where request_key is not null and request_key <> '';
