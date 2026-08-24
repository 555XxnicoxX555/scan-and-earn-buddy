-- POST-FLIGHT READ ONLY: do not run as a migration.
-- Run only after the audited migration transaction succeeds.

-- 1. Columns and constraints created by the migration.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reward_redemptions'
  and column_name in (
    'requested_by_auth_user_id',
    'requested_expires_at',
    'status_updated_at',
    'status_updated_by_auth_user_id'
  )
order by column_name;

select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.reward_redemptions'::regclass,
  'public.reward_redemption_events'::regclass
)
order by table_name::text, conname;

-- 2. Audit table, indexes, triggers and RLS policies.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('reward_redemptions', 'reward_redemption_events')
order by tablename, indexname;

select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('reward_redemptions', 'reward_redemption_events')
order by event_object_table, trigger_name, event_manipulation;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('reward_redemptions', 'reward_redemption_events')
order by tablename, policyname;

-- 3. DML must be absent for public-facing roles; SELECT may remain behind RLS.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('reward_redemptions', 'reward_redemption_events')
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 4. Audited RPCs and execute grants.
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'manage_reward_redemption_status',
    'manage_reward_redemption_status_v2',
    'get_staff_redemption_queue',
    'get_reward_redemption_history',
    'enforce_reward_redemption_integrity',
    'record_reward_redemption_event',
    'record_reward_redemption_transition'
  )
order by p.proname, arguments;

select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'manage_reward_redemption_status',
    'manage_reward_redemption_status_v2',
    'get_staff_redemption_queue',
    'get_reward_redemption_history'
  )
order by routine_name, grantee;

-- 5. Backfill coverage and append-only transition uniqueness.
select
  (select count(*) from public.reward_redemptions) as redemption_rows,
  (select count(*) from public.reward_redemption_events) as audit_event_rows,
  count(*) filter (where not exists (
    select 1 from public.reward_redemption_events re where re.redemption_id = rr.id
  )) as redemptions_without_audit_event
from public.reward_redemptions rr;

select redemption_id, coalesce(from_status, '__initial__') as normalized_from_status,
       to_status, count(*) as duplicate_count
from public.reward_redemption_events
group by redemption_id, coalesce(from_status, '__initial__'), to_status
having count(*) > 1
order by duplicate_count desc;

-- 6. State, tenant and reserved-context invariants after migration.
select status, count(*)
from public.reward_redemptions
where status not in ('requested', 'approved', 'redeemed', 'cancelled')
group by status;

select count(*) as cross_tenant_or_missing_customers
from public.reward_redemptions rr
where not exists (
  select 1 from public.customer_profiles cp
  where cp.id = rr.customer_id and cp.business_id = rr.business_id
);

select count(*) as open_rows_with_reserved_auto_cancel_key
from public.reward_redemptions
where status in ('requested', 'approved')
  and coalesce(request_context, '{}'::jsonb) ? 'autoCancelledReason';

select actor_role, count(*) as event_count
from public.reward_redemption_events
group by actor_role
order by actor_role;
