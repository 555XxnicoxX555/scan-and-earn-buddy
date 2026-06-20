---
name: fathom-integration
description: Maintain and troubleshoot Blu Analyzer's Fathom integration. Use when working on Fathom webhook ingestion, manual recent syncs, missing or duplicated calls, recorded_by_email closer assignment, director/closer reassignment, Revisión Fathom states, analyze-button eligibility, Supabase Edge Functions fathom-webhook/fathom-manage/sync-fathom-recent, or production data fixes involving Fathom calls.
---

# Fathom Integration Skill

Use this skill for Blu Analyzer Fathom work. It captures the local architecture and the failure modes we have already hit, so do not rediscover them from scratch.

## First Moves

1. Inspect the live shape before editing:
   - `supabase/functions/fathom-webhook/index.ts`
   - `supabase/functions/fathom-manage/index.ts`
   - `supabase/functions/sync-fathom-recent/index.ts`
   - `supabase/functions/_shared/fathom-normalizer.ts`
   - `supabase/functions/_shared/fathom-logs.ts`
   - latest `supabase/migrations/*fathom*.sql`
2. Read `references/blu-fathom-reference.md` when the task touches production sync, webhook signatures, assignment states, or database repair.
3. Query production before assuming the bug is frontend-only. Fathom bugs usually cross `calls`, `company_members`, `user_roles`, `fathom_integrations`, `fathom_imports`, and logs.

## Core Model

- `fathom_integrations` stores one Fathom API/webhook integration per connected user. In Sales Partners, the active integration is the director account and calls are assigned by `recorded_by_email`.
- `fathom-webhook` ingests signed Fathom payloads, normalizes meetings, creates or updates `calls`, stores logs, and decides whether analysis can proceed.
- `sync-fathom-recent` fetches meetings from Fathom API and replays them through `fathom-webhook`.
- `fathom-manage` handles manual retry, approval/dismissal, marking unknown owner, and reassigning a call owner.
- `reassign_fathom_calls_for_company_member(company_id, employee_email, employee_user_id)` is global. It must remain parameterized and never hardcoded to one company or person.

## Assignment Rules

- Assign by `calls.recorded_by_email` matching an active `company_members.employee_email`.
- A pending member should keep the call visible in `Revisión Fathom`, not hide it from the user.
- A director/admin/owner must not remain as closer for metrics, filters, Golden Nuggets, or marketing reports.
- When assigning a real closer:
  - If the call already has `call_analysis`, set it `completed`, `fathom_review_status = approved`, `fathom_classification = identity_corrected`.
  - If it has no analysis, set it `needs_review`, `fathom_review_status = needs_review`, `fathom_classification = identity_corrected_needs_review`.
  - Always clear `fathom_mismatch`.
- If the owner is manually unknown, use `manual_owner_unknown` or `sales_manual_owner_unknown` only while it truly should display as `Closer indefinido`.

## Dates

For reporting or history comparisons, use the real call date in this priority:
`fathom_recording_started_at`, `fathom_scheduled_start_at`, `fathom_created_at`, `created_at`.

## Production Safety

- Never include access tokens in committed files or final answers.
- Do not leave `fathom_integrations.webhook_secret` null. If temporarily bypassing signature verification for an emergency manual replay, restore it immediately and verify it is non-null.
- Prefer deploying only the touched Edge Function:
  `npx supabase functions deploy fathom-manage --project-ref <project-ref>`
- Run `npm run build` for frontend-affecting changes.
- Commit and push after code or migration changes.

## Validation Checklist

- Check Fathom API returned the expected meetings for the date range.
- Check webhook processing statuses and duplicate counts.
- Check `calls.user_id`, `recorded_by_email`, `status`, `fathom_review_status`, `fathom_classification`, and `fathom_mismatch`.
- Check `call_analysis` existence before moving a reviewed call to `completed`.
- Check History uses `get_team_calls_with_analysis`; Global dashboards may be counting a different source.
- Check marketing reports separately when the bug mentions Global Marketing or lead type.
