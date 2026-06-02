# Contributing to Marinara Engine

Marinara Engine is currently being rebuilt on the `refactor` branch as a local-first Tauri desktop app with a React UI, a React-free TypeScript product engine, and Rust capability modules. Use this guide with `README.md`, `AGENTS.md`, and the developer docs under `docs/developer/`.

## Branches

Current development targets `refactor`.

- Base feature, bug fix, and documentation branches on `refactor`.
- Open pull requests against `refactor`.
- Do not target `main` unless a maintainer explicitly asks for a mainline or release change.
- Treat `refactor` docs as the only authoritative docs for current work. Do not use `main` or historical `staging` docs for refactor implementation, integrations, or release guidance unless a maintainer explicitly asks for that branch context.
- Keep PRs focused. Separate architecture moves, product behavior, UI polish, and docs-only work when they can be reviewed independently.

## Development Setup

Prerequisites:

- Node.js 22 or newer.
- pnpm through the repo-pinned `packageManager`.
- Rust stable toolchain.
- Tauri v2 platform prerequisites for your OS.

Typical local setup:

```sh
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
git checkout refactor
pnpm install
pnpm tauri dev
```

Useful commands:

```sh
pnpm tauri dev
pnpm dev
pnpm build
pnpm tauri build
cargo run --manifest-path src-tauri/Cargo.toml --bin marinara-server
docker compose up --build
```

- `pnpm tauri dev` is the normal desktop development command.
- `pnpm dev` runs the web shell only. Tauri-only capabilities will not all work there.
- `marinara-server` runs the hostable Rust HTTP runtime. It hosts the Rust API only, not the React UI.
- `docker compose up --build` builds and starts the remote Rust runtime container.

## Current Source Shape

The refactor branch is layered by ownership:

- `src/app` owns React bootstrap, app shell, providers, and startup effects.
- `src/features` owns user-facing React workflows.
- `src/features/shell` owns settings, imports, onboarding, Professor Mari, and integrations surfaces.
- `src/features/modes` owns chat, roleplay, game, shared transcript UI, and the mode router.
- `src/features/runtime` owns shared runtime systems such as generation, world-state, visuals, tracker, and haptics.
- `src/features/catalog` owns resource-library UI and hooks for chats, characters, personas, sprites, lorebooks, presets, connections, agents, gallery, and knowledge sources.
- `src/shared` owns feature-neutral frontend components, hooks, stores, types, and browser helpers.
- `src/shared/api` owns typed adapters for embedded Tauri commands and the optional remote Rust runtime.
- `src/engine` owns React-free product behavior, contracts, generation, agents, capability ports, and mode engines.
- `src-tauri` owns the Tauri host, command facades, HTTP server and dispatch, and Rust capability crates for core, storage, assets, LLM, integrations, and security.

This ownership map follows the current refactor actual-state design. Keep contributor guidance consistent with the developer docs and architecture diagrams when those change.

## Architecture Rules

Start each change by naming the owner: app shell, catalog, runtime system, concrete mode, shared UI/helper, engine service, shared API adapter, Tauri command, hostable HTTP route, or Rust capability crate.

Hard boundaries:

- Product behavior belongs in `src/engine`; React UI belongs in `src/features`; runtime wrappers belong in `src/shared/api`; privileged or hostable capabilities belong in `src-tauri`.
- Engine code must not import React, Zustand stores, `@tauri-apps/api`, feature internals, or concrete `src/shared/api` adapters.
- New or touched feature code should use focused shared API wrappers, not raw `invokeTauri` imports or raw remote-runtime `fetch`.
- Remote-capable behavior must use the explicit path through `src/shared/api`, `remote-runtime.ts`, `src-tauri/src/http_server.rs`, and `src-tauri/src/http_dispatch.rs`.
- Chat, roleplay, and game remain separate mode owners. Put reusable mode UI in shared mode UI, not in another concrete mode.
- `src/shared` must stay feature-neutral and must not import from `src/features` or `src/app`.
- Tauri commands should stay thin. Durable behavior belongs in focused Rust modules or crates.

Known pressure points:

- `src/features/modes/router/components/ModeSurface.tsx` is still broad. Avoid adding unrelated orchestration there when a mode, runtime, or catalog owner fits better.
- `src/features/modes/game/components/GameSurface.tsx` is the largest UI orchestrator. Prefer extracting focused game-owned helpers or controllers when adding substantial behavior.
- Some shared mode UI files are large. Keep them mode-neutral rather than using them as a place for concrete chat, roleplay, or game rules.
- `src-tauri/src/lib.rs` still has a broad command registration list. Add commands deliberately and keep implementation outside the registry.
- Import workflows are split, but dense modules remain. Trace storage, asset, security, and payload paths before changing imports.

## Validation

Run focused checks that match the change while developing. `pnpm check` is the
baseline combined check for PR push or handoff, not a replacement for targeted
proof.

```sh
pnpm typecheck
pnpm build
pnpm check:architecture
pnpm check:docs
cargo check --manifest-path src-tauri/Cargo.toml --workspace
pnpm check
```

Use these as a guide:

- TypeScript, React, feature, or engine changes: `pnpm typecheck`.
- Import graph, dependency boundaries, or bundling changes: `pnpm check:architecture` and usually `pnpm build`.
- Rust commands, capability crates, provider transport, storage, imports, assets, native integrations, or hostable runtime changes: `cargo check --manifest-path src-tauri/Cargo.toml --workspace`.
- Docs, templates, skills, or agent guidance: `pnpm check:docs`.
- Visible UI behavior: run the app and manually verify the workflow. Use Playwright or screenshots when the change is visual or flow-sensitive.
- Remote runtime behavior: run `marinara-server`, check `/health`, configure the app's Remote Runtime URL, and exercise the supported shared API path when practical.

CI also runs lint, tests, build, size checks, Rust clippy, Rust tests, and the Browser Smoke and Performance job. Local validation should still describe exactly what was run and what remains unverified.

## Pull Requests

Every PR should include:

- The user problem, bug, or maintenance goal.
- The primary owner and impact area.
- The files or modules touched.
- Boundary notes for engine, shared API, feature layers, Rust commands, and remote runtime when relevant.
- Manual verification notes for user-facing behavior.
- Screenshots or recordings for visible UI changes.
- Any remaining risk, follow-up work, or proof gaps.

Before opening or updating a PR after the final diff, run `pnpm check`.
This is the general pre-PR gate for line endings, architecture, TypeScript,
Rust compile, docs, discovery metadata, agent workflow, and unused-code checks.
It does not replace targeted proof when the change needs it, such as focused
tests, lint, build, size checks, clippy, Rust tests, native Tauri QA, or browser
checks.
Do not submit `*.test.ts` or `*.test.tsx` files in a PR as proof; validation
belongs in existing checks, command output, local-only scratch harnesses,
app/browser/Tauri verification, or manual verification notes.

Leave PR template checkboxes unchecked until a human has actually verified each item. If an AI agent drafts a PR body, treat the checkboxes as a to-do list, not as proof.

## Docs And Release Notes

Keep docs accurate for the refactor branch:

- Update `README.md` and `docs/developer/` when run commands, architecture, source ownership, or validation changes.
- Update `AGENTS.md` or repo skills only when contributor or agent workflow rules change.
- Do not restore old `staging`, package-workspace, installer, release, screenshot, or changelog claims unless they are true for the refactor branch.
- Public release packaging, installation pages, final screenshots, release notes, and license metadata are still being rebuilt around the new architecture.
