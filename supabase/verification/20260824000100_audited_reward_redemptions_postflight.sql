-- POST-FLIGHT READ ONLY: do not run as a migration.
-- Returns one aggregate row so the SQL Editor cannot hide earlier checks.

select jsonb_build_object(
  'columns', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.column_name), '[]'::jsonb)
    from (
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'reward_redemptions'
        and column_name in ('requested_by_auth_user_id', 'requested_expires_at',
                            'status_updated_at', 'status_updated_by_auth_user_id')
    ) c
  ),
  'constraints', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.table_name, c.conname), '[]'::jsonb)
    from (
      select conrelid::regclass::text as table_name, conname, contype,
             pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conrelid in ('public.reward_redemptions'::regclass,
                         'public.reward_redemption_events'::regclass)
    ) c
  ),
  'indexes', (
    select coalesce(jsonb_agg(to_jsonb(i) order by i.tablename, i.indexname), '[]'::jsonb)
    from (
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename in ('reward_redemptions', 'reward_redemption_events')
    ) i
  ),
  'triggers', (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.event_object_table, t.trigger_name, t.event_manipulation), '[]'::jsonb)
    from (
      select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
      from information_schema.triggers
      where trigger_schema = 'public'
        and event_object_table in ('reward_redemptions', 'reward_redemption_events')
    ) t
  ),
  'policies', (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname), '[]'::jsonb)
    from (
      select tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
        and tablename in ('reward_redemptions', 'reward_redemption_events')
    ) p
  ),
  'table_grants', (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.table_name, g.grantee, g.privilege_type), '[]'::jsonb)
    from (
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('reward_redemptions', 'reward_redemption_events')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    ) g
  ),
  'unsafe_table_grants', (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('reward_redemptions', 'reward_redemption_events')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type <> 'SELECT'
  ),
  'functions', (
    select coalesce(jsonb_agg(to_jsonb(f) order by f.proname, f.arguments), '[]'::jsonb)
    from (
      select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
             p.prosecdef as security_definer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('manage_reward_redemption_status',
                          'manage_reward_redemption_status_v2',
                          'get_staff_redemption_queue',
                          'get_reward_redemption_history',
                          'enforce_reward_redemption_integrity',
                          'record_reward_redemption_event',
                          'record_reward_redemption_transition')
    ) f
  ),
  'routine_grants', (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.routine_name, g.grantee), '[]'::jsonb)
    from (
      select routine_name, grantee, privilege_type
      from information_schema.role_routine_grants
      where routine_schema = 'public'
        and routine_name in ('manage_reward_redemption_status',
                             'manage_reward_redemption_status_v2',
                             'get_staff_redemption_queue',
                             'get_reward_redemption_history')
    ) g
  ),
  'coverage', (
    select jsonb_build_object(
      'redemption_rows', (select count(*) from public.reward_redemptions),
      'audit_event_rows', (select count(*) from public.reward_redemption_events),
      'redemptions_without_audit_event', count(*) filter (where not exists (
        select 1 from public.reward_redemption_events re where re.redemption_id = rr.id
      ))
    )
    from public.reward_redemptions rr
  ),
  'duplicate_transitions', (
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
    from (
      select redemption_id, coalesce(from_status, '__initial__') as normalized_from_status,
             to_status, count(*) as duplicate_count
      from public.reward_redemption_events
      group by redemption_id, coalesce(from_status, '__initial__'), to_status
      having count(*) > 1
    ) d
  ),
  'invalid_statuses', (
    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    from (
      select status, count(*) as row_count
      from public.reward_redemptions
      where status not in ('requested', 'approved', 'redeemed', 'cancelled')
      group by status
    ) s
  ),
  'cross_tenant_or_missing_customers', (
    select count(*)
    from public.reward_redemptions rr
    where not exists (
      select 1 from public.customer_profiles cp
      where cp.id = rr.customer_id and cp.business_id = rr.business_id
    )
  ),
  'open_rows_with_reserved_auto_cancel_key', (
    select count(*)
    from public.reward_redemptions
    where status in ('requested', 'approved')
      and coalesce(request_context, '{}'::jsonb) ? 'autoCancelledReason'
  ),
  'actor_role_distribution', (
    select coalesce(jsonb_agg(to_jsonb(a) order by a.actor_role), '[]'::jsonb)
    from (
      select actor_role, count(*) as event_count
      from public.reward_redemption_events
      group by actor_role
    ) a
  )
) as postflight_summary;
