-- PRE-FLIGHT READ ONLY: do not run as a migration.
-- Run in the Supabase SQL editor only after the read-only manifest is approved.
-- Aggregated into one result row because the editor preserves only the final set.

with
state_distribution as (
  select coalesce(jsonb_object_agg(status, redemption_count order by status), '{}'::jsonb) as value
  from (
    select status::text, count(*) as redemption_count
    from public.reward_redemptions
    group by status
  ) states
),
volume_summary as (
  select
    count(*) as total_redemptions,
    count(*) filter (where status in ('requested', 'approved')) as open_redemptions,
    count(*) filter (
      where status = 'requested'
        and requested_expires_at is not null
        and requested_expires_at < now()
    ) as expired_requests,
    coalesce(max(pg_column_size(coalesce(request_context, '{}'::jsonb))), 0) as largest_request_context_bytes
  from public.reward_redemptions
),
integrity_summary as (
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
  from public.reward_redemptions rr
),
pending_duplicates as (
  select coalesce(jsonb_agg(to_jsonb(duplicates) order by pending_duplicates desc), '[]'::jsonb) as value
  from (
    select business_id, customer_id, reward_id, count(*) as pending_duplicates
    from public.reward_redemptions
    where status = 'requested'
    group by business_id, customer_id, reward_id
    having count(*) > 1
  ) duplicates
),
context_checks as (
  select
    count(*) filter (where pg_column_size(coalesce(request_context, '{}'::jsonb)) > 8192) as contexts_over_8192_bytes,
    count(*) filter (
      where status in ('requested', 'approved')
        and coalesce(request_context, '{}'::jsonb) ? 'autoCancelledReason'
    ) as open_rows_with_reserved_auto_cancel_key
  from public.reward_redemptions
),
policy_snapshot as (
  select coalesce(jsonb_agg(to_jsonb(policies) order by tablename, policyname), '[]'::jsonb) as value
  from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('reward_redemptions', 'reward_redemption_events')
  ) policies
),
table_grant_snapshot as (
  select coalesce(jsonb_agg(to_jsonb(grants) order by table_name, grantee, privilege_type), '[]'::jsonb) as value
  from (
    select table_schema, table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('reward_redemptions', 'reward_redemption_events')
  ) grants
),
function_snapshot as (
  select coalesce(jsonb_agg(to_jsonb(functions) order by proname, arguments), '[]'::jsonb) as value
  from (
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
  ) functions
),
routine_grant_snapshot as (
  select coalesce(jsonb_agg(to_jsonb(grants) order by routine_name, grantee), '[]'::jsonb) as value
  from (
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
  ) grants
)
select
  state_distribution.value as state_distribution,
  to_jsonb(volume_summary) as volume_summary,
  to_jsonb(integrity_summary) as integrity_summary,
  pending_duplicates.value as pending_duplicates,
  to_jsonb(context_checks) as context_checks,
  policy_snapshot.value as policy_snapshot,
  table_grant_snapshot.value as table_grant_snapshot,
  function_snapshot.value as function_snapshot,
  routine_grant_snapshot.value as routine_grant_snapshot
from state_distribution
cross join volume_summary
cross join integrity_summary
cross join pending_duplicates
cross join context_checks
cross join policy_snapshot
cross join table_grant_snapshot
cross join function_snapshot
cross join routine_grant_snapshot;
