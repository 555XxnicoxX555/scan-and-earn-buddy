---
name: ux-work-report-generator
description: Create detailed visual UX/product work reports as static web pages. Use when the user asks for a report, recap, audit summary, client/stakeholder handoff, visual changelog, UX work documentation, before/after explanation, or a record of what was changed, why it matters, validation evidence, screenshots, decisions, risks, and next steps.
---

# UX Work Report Generator

## Purpose

Generate a polished static report page outside the main app source unless the user explicitly asks otherwise. The report must be evidence-based, visual, and specific to the work just completed.

## Workflow

1. Confirm the output location. Default to a sibling folder outside the active repo, for example `../ux-audit-report` or `../<project>-work-report`.
2. Gather evidence from the current state:
   - `git diff --name-only`
   - `git status --short`
   - relevant tests/build commands and outputs
   - screenshots from the app or generated visual examples
   - user-facing decisions, tradeoffs, blockers, and pending work
3. Create a static page with `index.html`, `styles.css`, `README.md`, and `assets/`.
4. Include real screenshots when possible. If not possible, include representative mockups and label them clearly as representative.
5. Validate the report:
   - open with a browser or static server
   - confirm images load
   - confirm no console errors
   - confirm the report folder is outside the main repo when requested
6. Final response must include:
   - absolute path to the report
   - how to open it
   - short contents summary
   - validation performed

## Required Report Structure

Use these sections by default:

1. Executive summary
2. Scope reviewed
3. UX problems detected
4. Work performed by theme or timeline
5. Concrete examples and before/after
6. Animations and interactions
7. Technical evidence and changed files
8. Problems, limitations, and decisions
9. Next steps prioritized by impact and effort
10. Optional skill/process proposal when requested

## Visual Rules

- Use a professional static web page, not a plain markdown dump.
- Use cards, timeline, badges, tables, screenshots, and code blocks.
- Keep claims grounded in evidence.
- Separate "verified" from "recommended" or "pending".
- Do not include secrets, raw tokens, API keys, passwords, or private connection strings.
- If a screenshot contains sensitive content, redact or avoid it.

## Evidence Rules

Include commands only when they were actually run. Good evidence examples:

```text
npm run smoke:ui
UI smoke passed: menu, detail, admin guard, create dish, save, preview.

npm run audit:ui
UI audit passed: 64 buttons checked.

npm run build
Built successfully.
```

Avoid vague claims like "everything works" unless a matching automated or manual verification is listed.

## Using Bundled Resources

- Use `scripts/create-report-scaffold.mjs` to create the basic folder structure.
- Use `templates/static-report/` as the starting HTML/CSS structure.
- Read `references/report-checklist.md` when the report is large, client-facing, or must be especially rigorous.
