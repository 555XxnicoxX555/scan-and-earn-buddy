-- PRE-FLIGHT READ ONLY: do not run as a migration.
-- Run in the Supabase SQL editor only after the read-only manifest is approved.

-- 1. Volume and state distribution.
select status, count(*) as redemption_count
from public.reward_redemptions
group by status
order by status;

select
  count(*) as total_redemptions,
  count(*) filter (where status in ('requested', 'approved')) as open_redemptions,
  count(*) filter (
    where status = 'requested'
      and requested_expires_at is not null
      and requested_expires_at < now()
  ) as expired_requests,
  max(pg_column_size(coalesce(request_context, '{}'::jsonb))) as largest_request_context_bytes
from public.reward_redemptions;

-- 2. Data integrity before adding/using audit foreign keys.
select
  count(*) filter (
    where requested_by_auth_user_id is not null
      and not exists (select 1 from auth.users au where au.id = rr.requested_by_auth_user_id)
  ) as orphan_requested_actor_ids,
  count(*) filter (
    where status_updated_by_auth_user_id is not null
      and not exists (select 1 from auth.users au where au.id = rr.status_updated_by_auth_user_id)
  ) as orphan_status_actor_ids,
  count(*) filter (
    where not exists (
      select 1 from public.customer_profiles cp
      where cp.id = rr.customer_id and cp.business_id = rr.business_id
    )
  ) as cross_tenant_or_missing_customers
from public.reward_redemptions rr;

select business_id, customer_id, reward_id, count(*) as pending_duplicates
from public.reward_redemptions
where status = 'requested'
group by business_id, customer_id, reward_id
having count(*) > 1
order by pending_duplicates desc;

-- 3. Reserved/unbounded historical context that needs classification.
select
  count(*) filter (where pg_column_size(coalesce(request_context, '{}'::jsonb)) > 8192) as contexts_over_8192_bytes,
  count(*) filter (
    where status in ('requested', 'approved')
      and coalesce(request_context, '{}'::jsonb) ? 'autoCancelledReason'
  ) as open_rows_with_reserved_auto_cancel_key
from public.reward_redemptions;

-- 4. Existing policies and table grants that the migration must close.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('reward_redemptions', 'reward_redemption_events')
order by tablename, policyname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('reward_redemptions', 'reward_redemption_events')
order by table_name, grantee, privilege_type;

-- 5. RPCs/dependencies expected by the audited migration.
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'request_reward_redemption',
    'manage_reward_redemption_status',
    'manage_reward_redemption_status_v2',
    'is_business_staff',
    'is_business_manager',
    'loyalty_tier_for_points'
  )
order by p.proname, arguments;

select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'request_reward_redemption',
    'manage_reward_redemption_status',
    'manage_reward_redemption_status_v2',
    'get_staff_redemption_queue',
    'get_reward_redemption_history'
  )
order by routine_name, grantee;
