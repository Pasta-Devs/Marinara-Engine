## Hard Rules

- Product behavior belongs in `src/engine`; React UI belongs in `src/features`; runtime wrappers belong in `src/shared/api`; privileged/hostable capabilities belong in `src-tauri`.
- Engine code must not import React, Zustand stores, `@tauri-apps/api`, feature internals, or concrete `src/shared/api` adapters.
- New or touched feature code should use focused shared API wrappers, not raw `invokeTauri` imports or raw remote-runtime `fetch`.
- Remote-capable behavior must follow the explicit HTTP pipeline documented in `marinara-architecture-guard`.
- Chat, roleplay, and game remain separate mode owners.
- Fix root causes; do not add fake success, silent catches, broad fallbacks, or UI-only guards over broken contracts.

## Verification

Run checks that match the change:

- TypeScript/UI/engine: `pnpm typecheck`
- Build/import graph/bundling: `pnpm build`
- Rust commands/capabilities/provider transport/hostable runtime: `cargo check --manifest-path src-tauri/Cargo.toml`
- Docs/skills/agent guidance: `pnpm check:docs`
- Architecture/import rules: `pnpm check:architecture`

For code changes, final responses must include behavior changed, primary files/modules touched, impact/dependent areas reviewed, verification, and remaining risk.

## Professor Mari Codebase Agent

- Professor Mari is a codebase-research agent, not a static knowledge-base bot. For Marinara implementation questions, she should inspect the current repository through her code search/read tools before answering.
- When adding, moving, or deleting a durable feature area, update this section in the same change so Professor Mari's map stays current.
- When a user asks for app customization, Professor Mari should prefer creating an extension or custom agent record before editing core source. If core source edits are needed, use narrow exact-match edits and keep the same architecture boundaries listed above.
- Professor Mari must not read secrets, private chat transcripts, generated dependency/build output, or files outside the Marinara Engine repository.

### Current Map

- `src/app`: React bootstrap, shell layout, app providers, startup effects, top bars, sidebars, and panel composition.
- `src/features/shell/mari`: Professor Mari's standalone assistant UI surface.
- `src/engine/mari`: TypeScript request/response contract for the Professor Mari entrypoint.
- `src-tauri/src/commands/storage/mari.rs`: Privileged Professor Mari agent execution, tool definitions, codebase search/read/edit access, and extension/custom-agent creation.
- `src/shared/api/mari-api.ts`: Focused frontend runtime wrapper for the Professor Mari command.
- `src/engine`: React-free product behavior and mode orchestration.
- `src/features`: React UI packages. Shell tools live in `src/features/shell`, catalog/resource editors live in `src/features/catalog`, mode surfaces live in `src/features/modes`, shared runtime UI lives in `src/features/runtime`.
- `src/features/catalog/sprites`: Shared catalog sprite query keys, types, and React Query hooks used by character and persona sprite editors plus runtime sprite consumers.
- `src/shared/api`: Embedded Tauri and hostable runtime wrappers. Feature code should call these wrappers instead of raw Tauri or raw remote-runtime fetch.
- `src-tauri`: Rust command facades, hostable runtime dispatch, storage, LLM/provider transport, assets, imports, integrations, and other privileged capabilities.
- `public/sprites/mari`: Professor Mari visual assets used by onboarding, FAQ, title controls, and the Mari shell surface.
- `skills/marinara-architecture-guard`: Architecture guardrails for placement, import direction, and remote-capable command routing.
- `skills/marinara-agent-workflow`: Agent workflow references, source maps, handoff formats, and verification discipline.
