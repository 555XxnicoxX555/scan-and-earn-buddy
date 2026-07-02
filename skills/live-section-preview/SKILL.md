---
name: live-section-preview
description: Build an isolated live preview URL for proposed UI changes before editing the main project. Use when the user says "show me how it would look", "muestrame como se veria", "preview this change", "probemos esta sección", "hazlo aislado", or asks to review a visual variation before approving implementation in the real app.
---

# Live Section Preview

## Purpose

Create a temporary isolated preview page for one section, component, or flow. The user can inspect the change live in a browser before approving implementation in the main project.

## Core Rule

Do not modify the main app implementation during the preview phase. Work in a separate preview folder. Only apply changes to the main project after the user explicitly approves with language like "me parece bien, implementalo".

The preview must be functionally representative: controls, toggles, selects, tabs, drawers, hover/focus states, and local state should behave like the real app whenever practical. Use mock/local data and localStorage inside the preview only. Never write into the main app's source files, database, real localStorage keys, or production state during preview.

## Workflow

1. Identify the exact section/component to preview.
2. Create a separate folder outside or clearly separate from the main source, defaulting to `../live-section-preview/<slug>/`.
3. Scaffold a static preview using `scripts/create-preview-scaffold.mjs`.
4. Copy or approximate only the relevant HTML/CSS/data needed for the isolated preview.
5. Start a local server and provide the URL, usually `http://127.0.0.1:<port>`.
6. Iterate inside the preview folder based on user feedback.
7. When the user approves, translate the accepted changes into the main project with a focused patch.
8. Verify the main project with the relevant tests/build/smoke checks.

## Preview Folder Requirements

The preview folder should contain:

```text
index.html
styles.css
script.js
README.md
assets/          optional
notes.md         optional implementation notes
```

## Server Guidance

Prefer the bundled static server:

```powershell
node skills/live-section-preview/scripts/serve-preview.mjs "<preview-folder>" 9173
```

For a background server on Windows, launch it with `Start-Process -WindowStyle Hidden` and keep the URL for the user.

Fallback if Node is not appropriate:

```powershell
cd "<preview-folder>"
python -m http.server 9173
```

If port `9173` is busy, choose another free port. Tell the user the URL.

## Approval Contract

Before approval:

- Preview changes are disposable.
- Do not touch production app files.
- Keep notes mapping preview selectors/components to app files.

After approval:

- Apply only the accepted visual/interaction changes.
- Preserve existing app architecture.
- Run verification.
- Summarize exactly what moved from preview to production code.

## What To Include In The Preview

- The relevant section in a realistic viewport.
- States requested by the user: hover, active, disabled, loading, empty, error.
- Working local interactions for the relevant controls, using mock data if needed.
- Small controls if helpful, such as tabs for "before" and "after".
- Labels showing that it is a preview, not production.

## Using Bundled Resources

- Use `scripts/create-preview-scaffold.mjs` to create the preview folder.
- Use `scripts/serve-preview.mjs` to serve it locally.
- Use `templates/section-preview/` for the default starter.
- Read `references/preview-workflow.md` when the preview will later be ported into a real app.
