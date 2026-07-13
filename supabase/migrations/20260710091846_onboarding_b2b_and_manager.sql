alter table public.business_admins
drop constraint if exists business_admins_role_check;

alter table public.business_admins
add constraint business_admins_role_check
check (role in ('owner', 'manager', 'employee'));

create or replace function public.is_business_manager(target_business_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_admins ba
    where ba.business_id = target_business_id
      and ba.auth_user_id = auth.uid()
      and ba.role in ('owner', 'manager')
  );
$$;

create or replace function public.is_business_staff(target_business_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_admins ba
    where ba.business_id = target_business_id
      and ba.auth_user_id = auth.uid()
      and ba.role in ('owner', 'manager', 'employee')
  );
$$;

revoke all on function public.is_business_manager(text) from public;
revoke all on function public.is_business_staff(text) from public;
revoke all on function public.is_business_manager(text) from anon;
revoke all on function public.is_business_staff(text) from anon;
grant execute on function public.is_business_manager(text) to authenticated;
grant execute on function public.is_business_staff(text) to authenticated;

drop policy if exists "Business admins can read business customers" on public.customer_profiles;
create policy "Business managers can read business customers"
on public.customer_profiles for select
to authenticated
using (public.is_business_manager(business_id));

drop policy if exists "Business admins can read business loyalty accounts" on public.loyalty_accounts;
create policy "Business managers can read business loyalty accounts"
on public.loyalty_accounts for select
to authenticated
using (public.is_business_manager(business_id));

drop policy if exists "Business admins can read business point events" on public.point_events;
create policy "Business managers can read business point events"
on public.point_events for select
to authenticated
using (public.is_business_manager(business_id));

drop policy if exists "Business admins can read business redemptions" on public.reward_redemptions;
create policy "Business managers can read business redemptions"
on public.reward_redemptions for select
to authenticated
using (public.is_business_manager(business_id));

drop policy if exists "Business owners can read menu events" on public.business_menu_events;
create policy "Business managers can read menu events"
on public.business_menu_events for select
to authenticated
using (public.is_business_manager(business_id));

do $$
begin
  if to_regclass('public.point_event_corrections') is not null then
    execute 'drop policy if exists "Business owners can read point event corrections" on public.point_event_corrections';
    execute 'create policy "Business managers can read point event corrections" on public.point_event_corrections for select to authenticated using (public.is_business_manager(business_id))';
  end if;
end;
$$;

drop policy if exists "Business owners can insert menu catalog" on public.business_menu_catalog;
create policy "Business managers can insert menu catalog"
on public.business_menu_catalog for insert
to authenticated
with check (public.is_business_manager(business_id));

drop policy if exists "Business owners can update menu catalog" on public.business_menu_catalog;
create policy "Business managers can update menu catalog"
on public.business_menu_catalog for update
to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "Business owners can delete menu catalog" on public.business_menu_catalog;
create policy "Business managers can delete menu catalog"
on public.business_menu_catalog for delete
to authenticated
using (public.is_business_manager(business_id));

drop policy if exists "Business admins can manage menu settings" on public.business_menu_settings;
create policy "Business managers can manage menu settings"
on public.business_menu_settings for all
to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "Business owners can read all business rewards" on public.business_rewards;
create policy "Business managers can read all business rewards"
on public.business_rewards for select
to authenticated
using (public.is_business_manager(business_id));

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.record_customer_consumption_v2(text,uuid,numeric,text,jsonb,text,text,text)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    'ba.role in (''owner'', ''employee'')',
    'ba.role in (''owner'', ''manager'', ''employee'')'
  );
  function_definition := replace(
    function_definition,
    'if staff_role = ''employee'' then',
    'if staff_role in (''manager'', ''employee'') then'
  );
  execute function_definition;
end;
$$;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.get_business_admin_dashboard(text)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    'public.is_business_admin(target_business_id)',
    'public.is_business_manager(target_business_id)'
  );
  execute function_definition;
end;
$$;

create table if not exists public.platform_operators (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_platform_operator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_operators po
    where po.auth_user_id = auth.uid()
      and po.active = true
  );
$$;

revoke all on function public.is_platform_operator() from public;
revoke all on function public.is_platform_operator() from anon;
grant execute on function public.is_platform_operator() to authenticated;

create table if not exists public.onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  owner_email text not null,
  business_name text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.onboarding_invites(id) on delete cascade,
  schema_version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'needs_changes', 'approved', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_files (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.onboarding_invites(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  category text not null check (category in ('logo', 'menu', 'product', 'reference', 'other')),
  created_at timestamptz not null default now()
);

create index if not exists onboarding_invites_status_idx
on public.onboarding_invites (status, expires_at desc);

create index if not exists onboarding_submissions_status_idx
on public.onboarding_submissions (status, updated_at desc);

create index if not exists onboarding_files_invite_idx
on public.onboarding_files (invite_id, created_at desc);

create or replace function public.touch_onboarding_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists platform_operators_touch_updated_at on public.platform_operators;
create trigger platform_operators_touch_updated_at
before update on public.platform_operators
for each row execute function public.touch_onboarding_updated_at();

drop trigger if exists onboarding_submissions_touch_updated_at on public.onboarding_submissions;
create trigger onboarding_submissions_touch_updated_at
before update on public.onboarding_submissions
for each row execute function public.touch_onboarding_updated_at();

alter table public.platform_operators enable row level security;
alter table public.onboarding_invites enable row level security;
alter table public.onboarding_submissions enable row level security;
alter table public.onboarding_files enable row level security;

create policy "Platform operators can read operators"
on public.platform_operators for select
to authenticated
using (public.is_platform_operator());

create policy "Platform operators can manage invites"
on public.onboarding_invites for all
to authenticated
using (public.is_platform_operator())
with check (public.is_platform_operator());

create policy "Platform operators can manage submissions"
on public.onboarding_submissions for all
to authenticated
using (public.is_platform_operator())
with check (public.is_platform_operator());

create policy "Platform operators can manage onboarding files"
on public.onboarding_files for all
to authenticated
using (public.is_platform_operator())
with check (public.is_platform_operator());

grant select on public.platform_operators to authenticated;
grant select, insert, update, delete on public.onboarding_invites to authenticated;
grant select, insert, update, delete on public.onboarding_submissions to authenticated;
grant select, insert, update, delete on public.onboarding_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-onboarding-private',
  'business-onboarding-private',
  false,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Platform operators can read onboarding objects" on storage.objects;
create policy "Platform operators can read onboarding objects"
on storage.objects for select
to authenticated
using (bucket_id = 'business-onboarding-private' and public.is_platform_operator());

drop policy if exists "Platform operators can delete onboarding objects" on storage.objects;
create policy "Platform operators can delete onboarding objects"
on storage.objects for delete
to authenticated
using (bucket_id = 'business-onboarding-private' and public.is_platform_operator());

insert into public.platform_operators (auth_user_id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))
from auth.users
where lower(email) = 'globaladsggle@gmail.com'
on conflict (auth_user_id) do update
set email = excluded.email,
    active = true;
