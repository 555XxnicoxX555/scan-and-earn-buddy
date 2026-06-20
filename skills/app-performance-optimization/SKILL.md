---
name: app-performance-optimization
description: Improve perceived and real performance in Blu Analyzer React/Supabase flows. Use when optimizing dashboards, filters, tabs, React Query data loading, button actions, optimistic updates, loading skeletons, cache invalidation, expensive derived calculations, charts, and UI responsiveness across the app.
---

# App Performance Optimization

Use this skill to make Blu Analyzer feel faster without weakening data correctness.

## First Moves

1. Identify whether the problem is perceived latency, network latency, render cost, or backend query cost.
2. Find the active data owner: React Query hook, Supabase RPC/function, context provider, or local component state.
3. Inspect query keys and invalidations before changing UI. Most slow interactions here come from broad refetches or waiting for server confirmation.
4. Prefer small, reversible improvements: optimistic cache updates, scoped invalidation, memoized selectors, debounced filters, and stable loading states.

## Interaction Pattern

For buttons that mutate existing data:

1. Use `onMutate` to cancel related queries and snapshot cached data.
2. Update only the affected query caches immediately.
3. Disable or mark only the clicked control as pending when possible.
4. On error, restore the snapshot and show a short toast.
5. On success or settled, invalidate the narrowest query key needed to reconcile with the server.

Prefer this for:
- Moving calls/reports to trash.
- Restoring items.
- Reassigning owners.
- Updating result classes.
- Toggling settings.
- Applying status changes.

Avoid optimistic updates when:
- The mutation creates irreversible side effects such as payments or credit consumption.
- The local client cannot reliably know the resulting state.
- A permission check often fails and showing a temporary success would be misleading.

## Dashboard And Filter Pattern

- Keep filters local and instant; debounce only expensive server-backed filters.
- Separate raw server data from derived UI slices with `useMemo`.
- Keep query keys explicit: include user id, role, date range, selected closer, and show-deleted flags when they change the result.
- Do not invalidate all dashboard queries after a tiny mutation. Invalidate exact families such as `["call-history"]`, `["team-analytics"]`, or `["marketing-reports"]` only when they truly depend on the change.
- Use `placeholderData` or previous data for tab/filter changes to prevent blank screens.
- Use skeletons for initial load; use subtle inline pending states for refetches.

## Stable First Paint Pattern

- Do not render role-dependent dashboards while `role` is still `null` or `roleLoading` is true. A `null` role often mounts the wrong dashboard for one frame and then remounts with the real role.
- Do not start analytics queries with incomplete prerequisites such as an empty `memberEmails`, missing company id, or unknown user id. Add an `enabled` gate so the first query does not produce a misleading empty state.
- Avoid page-level duplicate prefetches when the mounted dashboard already owns its data. Extra “warm-up” queries can keep the whole page on a skeleton and then trigger a second load inside the real dashboard.
- For status cards and dashboard sections, cache the last known non-sensitive result in `sessionStorage` using a user- or company-scoped key. Paint from cache immediately, then refetch silently and reconcile.
- When cached data exists, do not show a full-screen loader during refetch. Keep the layout stable and use a small inline pending state only if needed.
- Prefer parallel reads after the required id is known. For example, after loading `company_id`, fetch members, reports, roles, and analyses with `Promise.all` when they do not depend on each other.

## Rendering Pattern

- Move expensive mapping, grouping, sorting, date parsing, and score aggregation into memoized helpers.
- Avoid parsing JSON or dates repeatedly inside large render loops.
- Keep list item props stable; prefer small child components when only one row changes.
- For chart-heavy dashboards, memoize chart data and avoid rebuilding config objects on every render.
- If a tab contains heavy content, lazy render it only after the tab becomes active.

## Supabase Pattern

- Prefer RPCs for team-scoped reads that need RLS-aware joins or latest-analysis selection.
- Keep soft-delete and permission-sensitive mutations in Edge Functions or SECURITY DEFINER RPCs, not direct client table updates.
- For trash-style flows, server reads should filter expired items and a scheduled cleanup should enforce retention.
- Verify production behavior with targeted SQL counts when changing retention, visibility, or team permissions.

## Verification Checklist

- The clicked item responds immediately.
- Failure rolls back the UI.
- Counters and tabs update without waiting for a full refetch.
- The server still reconciles after success.
- Query invalidation is no broader than necessary.
- `npm run build` passes.
- For production Supabase changes, verify the affected RPC/function/cron exists and permissions are correct.
