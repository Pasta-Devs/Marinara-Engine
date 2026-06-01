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

- [ ] Matching validation command passes locally (for example `pnpm typecheck`, `pnpm build`, `pnpm check:architecture`, `pnpm check:docs`, or full `pnpm check` when warranted)
- [ ] `pnpm check` passes locally before PR push/handoff, including the unused-code check
- [ ] `pnpm typecheck` passes locally
- [ ] `pnpm build` passes locally
- [ ] `pnpm check:architecture` passes locally
- [ ] `pnpm check:docs` passes locally
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml --workspace` passes locally
- [ ] Rust clippy/tests were run for Rust behavior changes
- [ ] Browser or Tauri app manual verification completed
- [ ] Browser screenshot/recording evidence added when UI/browser state is the claim
- [ ] Remote runtime smoke checked when relevant

### Manual verification notes

<!-- Describe exactly what you tested in a real browser/app/runtime, step by step. If an AI agent filled this out, verify it yourself before ticking boxes. -->

-

## Docs and release impact

- [ ] No docs changes needed
- [ ] Updated `README.md`
- [ ] Updated `CONTRIBUTING.md`
- [ ] Updated `docs/developer/`
- [ ] Updated repo skills or `AGENTS.md`
- [ ] Updated Feature Discoverability / marked N/A in notes
- [ ] Confirmed this PR does not restore old staging/package-workspace/release claims

## UI evidence

<!-- Add before/after screenshots or recordings for visible UI changes. -->
