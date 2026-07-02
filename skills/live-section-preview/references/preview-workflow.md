# Live Preview Workflow

Use this reference when a preview will later be ported into the main app.

## Before Creating The Preview

- Identify the exact component or section.
- Locate the source files, but do not edit them during preview.
- Copy only the minimum HTML/CSS/data needed to make the isolated preview realistic.
- Decide which states must be visible: default, hover, focus, loading, empty, error, mobile.

## During Preview

- Keep the page clearly labeled as a preview.
- Give the user a local URL.
- Iterate in the preview folder only.
- Keep `notes.md` updated with mapping back to the production files.
- Make relevant controls work locally: selects update content, buttons open drawers/modals, toggles change state, forms show feedback.
- Use mock data or preview-only localStorage keys. Do not call production APIs or mutate the main app's data.

## After Approval

- Apply the accepted changes to the main project with a focused patch.
- Do not copy preview-only labels, debug controls, or fake data unless requested.
- Verify the main app route/component.
- Run relevant tests, smoke checks, or build.

## What Good Looks Like

- The user can compare the proposed change without risk.
- The user can interact with the section as if it were in the app.
- The preview uses realistic spacing, typography, colors, and viewport constraints.
- The final implementation is smaller than the preview because it reuses existing app structure.
