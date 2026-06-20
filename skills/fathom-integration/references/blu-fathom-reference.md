# Blu Fathom Reference

## Main Files

- `supabase/functions/fathom-webhook/index.ts`: webhook entrypoint, signature verification, payload normalization, call creation/update, owner resolution, import/log persistence.
- `supabase/functions/sync-fathom-recent/index.ts`: authenticated manual recent sync. Fetches Fathom meetings, signs/replays them to `fathom-webhook`.
- `supabase/functions/fathom-manage/index.ts`: connect/retry/approve/dismiss/reassign/unknown-owner actions.
- `supabase/functions/_shared/fathom-normalizer.ts`: Fathom payload normalization, including `recorded_by_email`, recording ids, meeting dates, titles, transcript fields.
- `supabase/functions/_shared/fathom-logs.ts`: structured Fathom logs.
- `src/pages/History.tsx`: review tabs, owner select, and display labels.
- `src/lib/call-leads.ts`: `getCallCloserLabel`, display date priority, duration helpers.
- `src/hooks/useCallHistory.ts`: calls `get_team_calls_with_analysis`.
- `src/components/marketing/GlobalSpectrumDashboard.tsx`: global team/marketing counts can use reports/analyses and may diverge from History if `calls.user_id` or review status is stale.

## Important Tables

- `calls`: `user_id`, `name`, `transcript_text`, `status`, `recorded_by_email`, `fathom_recorded_by_name`, `fathom_mismatch`, `fathom_recording_id`, `fathom_review_status`, `fathom_review_reason`, `fathom_classification`, `fathom_created_at`, `fathom_scheduled_start_at`, `fathom_recording_started_at`, `fathom_recording_ended_at`, `deleted_at`.
- `call_analysis`: latest analysis by `call_id`; use existence to decide whether a reassigned call can be `completed`.
- `company_members`: `company_id`, `employee_email`, `employee_user_id`, `status`.
- `user_roles`: `user_id`, `company_id`, `role`.
- `fathom_integrations`: `user_id`, `company_id`, `fathom_api_key`, `fathom_email`, `webhook_id`, `webhook_secret`, `ingest_token`, `is_enabled`, `last_sync_at`, `last_webhook_received_at`.
- `fathom_imports` and `fathom_event_logs`: operational status and diagnostics.
- `fathom_user_mappings`: manual or inferred Fathom email to Blu user mapping.

## Useful Production Queries

Replace ids and emails; never commit tokens or live secrets.

```sql
select c.id, c.name, c.user_id, c.recorded_by_email, c.fathom_recorded_by_name,
       c.status, c.fathom_review_status, c.fathom_classification, c.fathom_mismatch,
       coalesce(c.fathom_recording_started_at,c.fathom_scheduled_start_at,c.fathom_created_at,c.created_at) as call_date,
       exists(select 1 from public.call_analysis ca where ca.call_id = c.id) as has_analysis
from public.calls c
where lower(c.recorded_by_email) = lower('<fathom-email>')
  and c.deleted_at is null
order by call_date desc;
```

```sql
select coalesce(p.name, u.email) as closer, c.user_id, count(*)::int as calls
from public.calls c
join public.user_roles ur on ur.user_id = c.user_id
left join public.profiles p on p.user_id = c.user_id
left join auth.users u on u.id = c.user_id
where ur.company_id = '<company-id>'
  and c.deleted_at is null
  and coalesce(c.fathom_recording_started_at,c.fathom_scheduled_start_at,c.fathom_created_at,c.created_at) >= '<from-iso>'
  and coalesce(c.fathom_recording_started_at,c.fathom_scheduled_start_at,c.fathom_created_at,c.created_at) < '<to-iso>'
group by closer, c.user_id
order by calls desc, closer;
```

```sql
select source, stage, status, event_type, message, payload, created_at
from public.fathom_event_logs
where source in ('sync-fathom-recent','fathom-webhook','fathom-manage')
order by created_at desc
limit 50;
```

## Manual Recent Sync Workflow

1. Prefer invoking `sync-fathom-recent` from the app or with a real user JWT. Body supports:
   - `target_user_id`
   - `limit`
   - `created_after`
   - `created_before`
2. Confirm the integration is enabled and belongs to the company/user being synced.
3. Fathom API date filters are `created_after` and `created_before`; these are meeting creation filters, not necessarily recording-start filters.
4. Inspect response:
   - `fetched`
   - `processed`
   - `duplicate`
   - `unmatched_user`
   - `missing_transcript`
   - `failed`
5. If manually replaying to `fathom-webhook`, the body must match the signed bytes exactly when `webhook_secret` is present. A safer emergency fallback is temporarily nulling `webhook_secret`, posting with the `ingest_token`, then immediately restoring the secret and verifying:

```sql
select webhook_secret is not null as webhook_secret_restored
from public.fathom_integrations
where id = '<integration-id>';
```

Use this fallback only for controlled production repair.

## Common Bugs

- **Global shows calls but History does not**: Global may count analyses/team pools while History hides `needs_review` or unknown-owner classifications from active calls. Inspect `calls.status`, `fathom_review_status`, `fathom_classification`, and `call_analysis`.
- **Reassign says success but still shows Closer indefinido**: `calls.user_id` changed but `manual_owner_unknown` or `sales_manual_owner_unknown` was not cleared.
- **Tomás/Bernardo type issue**: Confirm Fathom actually returned meetings in the date range. In the Sales Partners incident, 30 Apr-7 May returned only Bernardo meetings, all duplicates, no Tomás meetings.
- **Accents look broken in console**: Check UTF-8 bytes with `encode(convert_to(value, 'UTF8'), 'hex')`; PowerShell display can lie.
- **Marketing reports disagree with analyzed call**: `marketing_reports` is separate from `calls`/`call_analysis`; sync lead grade/date/closer explicitly when needed.

## Expected State Transitions

- Pending Fathom email match to pending closer:
  `needs_review`, visible in Revisión Fathom, assignment problem shown.
- Closer becomes active and call has analysis:
  `completed`, `approved`, `identity_corrected`, visible in History.
- Closer becomes active and call has no analysis:
  `needs_review`, `identity_corrected_needs_review`, visible in Revisión Fathom.
- Manual unknown:
  `manual_owner_unknown` or `sales_manual_owner_unknown`, label should be `Closer indefinido`.
