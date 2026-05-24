# Contributing to Marinara Engine

This is the canonical contributor guide for Marinara Engine. Use it with `README.md` for the product overview, `docs/developer/` for architecture and run/build guidance, and `AGENTS.md` for repository agent workflow rules.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri v2, Rust stable toolchain |
| Frontend | React 19, Tailwind CSS v4, Framer Motion, Zustand, React Query |
| Product engine | TypeScript 5, Zod, React-free engine modules |
| Local capabilities | Rust command and capability crates for storage, assets, provider transport, and integrations |
| Build | Vite 7, Tauri CLI, Cargo, pnpm 10 |

## Development Setup

Prerequisites:

- Node.js and pnpm through the repo-pinned `packageManager`
- Rust stable toolchain
- Platform-specific Tauri prerequisites for your operating system
- Git

Typical local setup:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
git fetch origin
git switch refactor
pnpm install
pnpm tauri dev
```

Useful entry points:

- `pnpm tauri dev` starts the normal desktop development app. Tauri starts Vite on `http://localhost:1420` and opens the native window.
- `pnpm dev` starts only the Vite web shell. This is useful for React layout checks, but it does not prove Tauri-only filesystem, command, asset protocol, dialog, provider, or native-window behavior.
- `pnpm docs:dev` serves the developer docs at `http://127.0.0.1:4174/`.
- `pnpm build` typechecks and builds the frontend into `dist/`.
- `pnpm tauri build` builds the desktop bundle. Tauri runs `pnpm build` first through `src-tauri/tauri.conf.json`.

For more detail, read `docs/developer/run-build.html`.

## Branches

Marinara Engine uses `refactor` as the integration branch for this refactor migration work.

Guidelines:

- Base new refactor feature, bugfix, and documentation branches on `origin/refactor`.
- Use focused branch names such as `fix/provider-timeout-message` or `feature/game-asset-browser`.
- Open draft PRs against `refactor` while implementation is still in progress.
- Do not commit, merge, or push directly to protected integration branches unless a maintainer explicitly asks for that exact operation.
- Do not force-push, delete branches, hard reset, or overwrite someone else's work without explicit maintainer approval.

## Repo Layout

- `src/app/` - React bootstrap, shell, providers, and startup wiring.
- `src/features/` - feature-owned React UI, hooks, UI stores, and feature workflows.
- `src/shared/` - shared frontend UI primitives, browser helpers, stores, and generic utilities.
- `src/shared/api/` - typed Tauri adapter functions and channel/listen wrappers.
- `src/engine/` - React-free TypeScript product engine, contracts, generation, agents, repositories, and mode behavior.
- `src-tauri/` - Tauri host code, Rust commands, capability crates, native storage, assets, provider transport, and integrations.
- `docs/developer/` - developer docs for architecture, modules, impact areas, and local run/build commands.
- `skills/` - repo-local agent guidance for architecture, mode separation, bugfix discipline, and onboarding.

## Architecture And Ownership

Dependency direction is the main guardrail:

```text
React app/features
  -> shared/api Tauri adapters
  -> TypeScript engine use cases
  -> engine capability ports
  -> Rust Tauri commands
  -> Rust capability crates
```

Before changing behavior, read these docs:

- `docs/developer/architecture.html`
- `docs/developer/modules.html`
- `docs/developer/impact-areas.html`

Use this impact brief before fixes, features, and refactors:

```text
Owner:
Behavior changed:
Expected impact area:
Dependent callers:
Affected modes:
Rust/TS boundary touched:
Checks planned:
```

Core ownership rules:

- Product behavior belongs in the TypeScript engine or the owning feature, not in generic UI glue.
- Privileged local work belongs behind Tauri commands and Rust capabilities.
- React components should not duplicate prompt rules, mode orchestration, storage formats, or provider transport behavior.
- Engine code must not import React, Zustand stores, `@tauri-apps/api`, or concrete `src/shared/api` adapters.
- Chat, roleplay, and game are separate product paths. Do not route one mode through another or hide mode differences behind a generic mode flag.
- Shared code should be truly shared and lower-level. Avoid broad `utils` files, convenience barrels, generic routers, fake local API bridges, and one-line compatibility shims.

## AI-Assisted Contribution Rules

AI-assisted code is welcome when it is reviewed, simplified, and owned by the contributor.

Before accepting generated or AI-assisted code:

- Match nearby repo patterns and naming.
- Confirm the change lives in the owning layer or module.
- Remove unused abstraction, unused dependencies, placeholder code, fake-success branches, and obsolete fallbacks.
- Check failure paths, empty states, persisted-data edge cases, and relevant mode boundaries.
- Explain the user problem and impact area in the PR, not just the file changes.
- Do not add generated-by lines, AI self-attribution, AI co-author trailers, or private local paths.

Human reviewers should verify checked PR checklist items before relying on them. Agents must not newly tick PR checklist boxes or untick boxes that were already checked; they should describe validation results and gaps in text instead.

## Validation

Run the checks that match the changed area:

```bash
pnpm typecheck
pnpm check:architecture
pnpm check:rust
pnpm check:docs
pnpm build
pnpm check
```

Use them this way:

- `pnpm typecheck` for TypeScript, React, shared API, or engine changes.
- `pnpm check:architecture` for import boundaries, layered ownership, shared modules, Rust command structure, or architecture-sensitive refactors.
- `pnpm check:rust` for Rust commands, Tauri capabilities, provider transport, storage, assets, or integrations.
- `pnpm check:docs` for docs, repo guidance, or repo-local skill changes.
- `pnpm build` when imports, bundling, production frontend behavior, or app startup changed.
- `pnpm check` for PR readiness, release/runtime risk, broad shared-contract changes, or when narrower checks cannot cover the risk.

There is not currently a meaningful automated test suite beyond these checks. Do not present `pnpm test` as a reliable gate in docs or PR descriptions unless the repo adds and documents that script.

Manual verification matters. For UI and workflow changes, run the app and click through the changed path. Browser-only checks can help with layout and React behavior, but native Tauri behavior still needs the desktop app.

## Before You Open A Pull Request

1. Open or link an issue when the change needs maintainer alignment, product discussion, or bug tracking.
2. Keep the scope tight. Separate unrelated refactors from user-facing fixes, feature work, and docs changes.
3. Identify the owner, impact area, dependent callers, affected modes or capabilities, and checks planned.
4. Test the change yourself. Include exact validation commands and manual verification notes.
5. Add screenshots or recordings for UI changes.
6. Update docs in the same PR when behavior changes make existing docs misleading.

## Pull Request Expectations

- Target `refactor` for this migration work unless a maintainer asks for another base.
- Open the PR as a draft while work is still in progress.
- Link the issue or feature request when one exists.
- Explain why the change matters to users or maintainers.
- Fill out the owner and impact section in the PR template.
- Keep PRs focused and reviewable.
- Human contributors may check validation and manual verification boxes only for items they personally completed.
- Agents should leave PR checklist boxes in their existing state and summarize proof or remaining gaps in text.
- Call out remaining risk or native/manual QA still needed.

## Documentation Rules

- `README.md` is the user-facing product overview and quickstart.
- `CONTRIBUTING.md` is the canonical contributor workflow document.
- `AGENTS.md` is the repo-local agent instruction source.
- `docs/developer/` is the developer documentation source for architecture, modules, impact areas, and run/build instructions.
- `skills/` contains repo-local agent guidance and should change only when durable workflow or architecture guidance changes.

If a change makes an existing doc misleading, update that doc in the same PR.

## Versioning And Releases

Current policy:

- Canonical application version source: root `package.json`.
- Tauri bundle version lives in `src-tauri/tauri.conf.json` and should stay synchronized with the app version when releases are prepared.
- Release tags should use `vX.Y.Z` when the repo begins publishing tagged releases.
- Do not bump versions unless the PR intentionally prepares a release or a maintainer asks for a version bump.
- Do not commit built installer binaries or generated release artifacts.

The refactor branch release workflow is still lighter than the legacy release workflow. Do not copy legacy workspace, Android, Windows installer, Docker, or old release-branch steps into this repo unless those systems are reintroduced here.
