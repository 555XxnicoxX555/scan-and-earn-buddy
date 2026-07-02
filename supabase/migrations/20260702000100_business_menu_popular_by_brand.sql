alter table public.business_menu_settings
add column if not exists popular_by_brand jsonb not null default '{}'::jsonb;
