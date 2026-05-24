<!-- Target branch: `refactor` for this migration work unless a maintainer asks for another base. -->
<!-- Open as a draft while implementation is still in progress. -->
<!-- Agents: do not newly tick checklist boxes, and do not untick boxes that are already checked. Describe validation in text instead. -->

## Linked Issue

<!-- Every PR should reference a feature request or issue report when one exists. -->
<!-- If there is not one yet, open one first when maintainer alignment or discussion is needed: -->
<!-- https://github.com/Pasta-Devs/Marinara-Engine/issues/new/choose -->

Closes #

## Why This Change

<!-- What user problem, bug, or goal does this solve? Explain the reason, not only the file edits. -->

-

## Owner And Impact

<!-- Use docs/developer/architecture.html, modules.html, and impact-areas.html before filling this out. -->

- Owner:
- Behavior changed:
- Expected impact area:
- Dependent callers reviewed:
- Affected modes/capabilities:
- Rust/TypeScript boundary touched:

## What Changed

<!-- List the key changes in this PR. -->

-

## Architecture Notes

<!-- Fill this out when imports, shared modules, feature boundaries, engine layers, shared/api adapters, Rust commands, capability crates, or mode boundaries changed. Use N/A for narrow docs/content-only changes. -->

-

## Validation

<!-- Human contributors may check only what they personally ran or verified. Agents should preserve existing checkbox state. -->

- [ ] `pnpm check:architecture` passes locally, if imports, file layout, feature boundaries, engine layers, shared APIs, or Rust command structure changed
- [ ] `pnpm typecheck` passes locally
- [ ] `pnpm check:rust` passes locally
- [ ] `pnpm check:docs` passes locally
- [ ] `pnpm build` passes locally, if imports, bundling, or runtime UI paths changed
- [ ] `pnpm check` passes locally, if this PR is ready for broad evaluation
- [ ] Ran the app and clicked through the changed workflow manually
- [ ] Checked relevant edge cases, such as light/dark mode, mobile viewport, empty states, error paths, provider/storage failures, or persisted-data migration paths
- [ ] Read and followed `CONTRIBUTING.md`, `AGENTS.md`, and the relevant `docs/developer/` pages

### Manual Verification Notes

<!-- Describe exactly what you tested in the real browser/app, step by step. -->
<!-- Browser checks are useful for web-renderable UI, but Tauri-only behavior still needs native app verification. -->

-

## Docs And Release Impact

- [ ] No docs/release changes needed
- [ ] Updated developer or user docs as needed
- [ ] Updated release notes/changelog if this is user-facing and release-noteworthy
- [ ] Version/release files updated only if this PR intentionally includes a version bump

## UI Evidence

<!-- Add before/after screenshots or recordings for UI changes. -->
