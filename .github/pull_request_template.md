<!-- Target branch: `refactor`. Change the base to `refactor` before submitting unless a maintainer explicitly asked for another base. -->
<!-- Keep all checkboxes unchecked until a human has actually verified them. -->

## Linked issue

<!-- Every user-facing PR should reference a feature request or issue report when practical. -->

Closes #

## Why this change

<!-- What user problem, bug, refactor goal, or maintenance need does this solve? -->

-

## What changed

<!-- List the key changes in this PR. -->

-

## Refactor impact

Primary owner:

<!-- Examples: app shell, catalog, chat mode, roleplay mode, game mode, runtime generation, world-state, shared API, engine generation, Rust storage, imports, remote runtime. -->

Impact areas reviewed:

-

Boundary notes:

<!-- Note engine/shared-api/feature/Rust/remote-runtime boundaries. Say "none" only if you checked. -->

-

Pressure points touched:

<!-- Mention ModeSurface, GameSurface, shared mode UI, src-tauri/src/lib.rs command registration, or import modules if touched. -->

-

## Validation

<!-- Check only what you personally ran or manually verified. Treat unchecked items as explicit TODOs. -->
<!-- Proof is session evidence, not permission to add durable test artifacts. Unless a maintainer explicitly asked for tests, do not submit new test artifacts in any language as PR proof. Temporary local tests or harnesses are fine when they remain uncommitted; cite their command output or resulting observation here instead. -->

- [ ] Matching validation command passes locally (for example `pnpm typecheck`, `pnpm build`, `pnpm check:architecture`, `pnpm check:docs`, or full `pnpm check` when warranted)
- [ ] Full `pnpm check` passes before PR push/handoff
- [ ] Human/manual validation completed by contributor or reviewer

### Manual verification notes

<!-- Describe exact commands and manual steps, including typecheck/build/docs/architecture/Rust/browser/remote-runtime checks when they apply. If an AI agent filled this out, verify it yourself before ticking boxes. -->

-

## Feature Discoverability

Check exactly one:

- [ ] Updated `src/features/shell/discovery/` because this PR adds or materially changes a user-discoverable feature, workflow, setting, mode, panel, import path, agent, media capability, or advanced tool.
- [ ] N/A because this PR is only a bugfix, refactor, test, docs, internal wiring, visual polish, copy edit, or compatibility fix and does not add a new thing users need to find.

Reason:

-

## Docs and release impact

- [ ] No docs changes needed
- [ ] Updated `README.md`
- [ ] Updated `CONTRIBUTING.md`
- [ ] Updated `docs/developer/`
- [ ] Updated repo skills or `AGENTS.md`
- [ ] Confirmed this PR does not restore old staging/package-workspace/release claims

## UI evidence

<!-- Add before/after screenshots or recordings for visible UI changes. -->
