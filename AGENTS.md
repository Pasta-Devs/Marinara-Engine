## Hard Rules

- Product behavior belongs in `src/engine`; React UI belongs in `src/features`; runtime wrappers belong in `src/shared/api`; privileged/hostable capabilities belong in `src-tauri`.
- Engine code must not import React, Zustand stores, `@tauri-apps/api`, feature internals, or concrete `src/shared/api` adapters.
- New or touched feature code should use focused shared API wrappers, not raw `invokeTauri` imports or raw remote-runtime `fetch`.
- Remote-capable behavior must follow the explicit HTTP pipeline documented in `marinara-architecture-guard`.
- Chat, roleplay, and game remain separate mode owners.
- Fix root causes; do not add fake success, silent catches, broad fallbacks, or UI-only guards over broken contracts.

## Credit And Workflow Budget

- Preserve coding quality: use high/adaptive reasoning for code edits, reviews, risky debugging, and architecture. Save credits by avoiding unnecessary agents, browser proof, and PR loops rather than weakening coding reasoning.
- Ordinary bugfix language means local fix and verification by default. Commit, push, draft PR creation, CodeRabbit, CI polling, ready marking, and merge require an explicit shipping request such as "ship it", "open a PR", "push this", or "ready for review".
- Use the tiny local bug path for narrow, low-risk, machine-provable fixes: no full ledger by default, just a short claim/proof/validation/files/risk/vault receipt. Escalate to the full workflow as soon as the bug is nontrivial, PR-affecting, cross-boundary, storage/import/export/prompt/provider/security-sensitive, browser-evidence-dependent, or uncertain.
- Before local bugfix edits, name only the cheap gate: core claim, likely owner/lane, risk level, and proof target. Broaden the gate only after a hypothesis is falsified or a risk boundary appears.
- Use the cheapest proof that proves the claim. Prefer static inspection, targeted tests, scratch harnesses, route/module repros, or jsdom/component proof before Playwright; use browser proof when visual layout, interaction, routing, responsive behavior, screenshots, console/network behavior, or browser-only behavior is the claim.
- When available, keep `workflow-health.mjs` for nontrivial Marinara work, PR work, issue selection, and risky workflow changes. Do not spend it on a tiny one-file local bug unless repo policy or visible risk requires it.

## Verification

Run checks that match the change:

- TypeScript/UI/engine: `pnpm typecheck`
- Build/import graph/bundling: `pnpm build`
- Rust commands/capabilities/provider transport/hostable runtime: `cargo check --manifest-path src-tauri/Cargo.toml`
- Docs/skills/agent guidance: `pnpm check:docs`
- Architecture/import rules: `pnpm check:architecture`
- PR boundary/ready-for-review: `pnpm check` (includes the unused-code check)

Ordinary local bugfixes should run the focused proof and matching lane check.
Do not turn every "fix the bug" request into full `pnpm check`; run full
`pnpm check` when the work becomes PR/shipping/ready-for-review, risky,
cross-lane, or otherwise needs the full baseline.

For code changes, final responses must include behavior changed, primary files/modules touched, impact/dependent areas reviewed, verification, and remaining risk.

## Professor Mari Codebase Agent

- Professor Mari is a codebase-research agent, not a static knowledge-base bot. For Marinara implementation questions, she should inspect the current repository through her code search/read tools before answering.
- When adding, moving, or deleting a durable feature area, update this section in the same change so Professor Mari's map stays current.
- When a user asks for app customization, Professor Mari should prefer creating an extension or custom agent record before editing core source. If core source edits are needed, use narrow exact-match edits and keep the same architecture boundaries listed above.
- Professor Mari must not read secrets, private chat transcripts, generated dependency/build output, or files outside the Marinara Engine repository.
- User-facing feature discovery lives in `src/features/shell/discovery`; keep its registry current when adding or changing discoverable product behavior.

### Current Map

- `src/app`: React bootstrap, shell layout, app providers, startup effects, top bars, sidebars, and panel composition.
- `src/features/shell/mari`: Professor Mari's standalone assistant UI surface.
- `src/features/shell/discovery`: In-app Discover guide, feature metadata registry, search/filter helpers, and discoverability action routing.
- `src/engine/mari`: TypeScript request/response contract for the Professor Mari entrypoint.
- `src-tauri/src/commands/storage/mari.rs`: Privileged Professor Mari agent execution, tool definitions, codebase search/read/edit access, and extension/custom-agent creation.
- `src/shared/api/mari-api.ts`: Focused frontend runtime wrapper for the Professor Mari command.
- `src/engine`: React-free product behavior and mode orchestration.
- `src/features`: React UI packages. Shell tools live in `src/features/shell`, catalog/resource editors live in `src/features/catalog`, mode surfaces live in `src/features/modes`, shared runtime UI lives in `src/features/runtime`.
- `src/features/catalog/sprites`: Shared catalog sprite query keys, types, and React Query hooks used by character and persona sprite editors plus runtime sprite consumers.
- `src/shared/api`: Embedded Tauri and hostable runtime wrappers. Feature code should call these wrappers instead of raw Tauri or raw remote-runtime fetch.
- `src-tauri`: Rust command facades, hostable runtime dispatch, storage, LLM/provider transport, assets, imports, integrations, and other privileged capabilities.
- `public/sprites/mari`: Professor Mari visual assets used by onboarding, FAQ, title controls, and the Mari shell surface.
- `skills/frontend-design`: Repo-local frontend concept, layout, visual direction, and first-pass UI implementation workflow that pairs with Impeccable.
- `skills/impeccable`: Repo-local frontend design, critique, polish, accessibility, responsive, and live-iteration workflow for UI craft passes.
- `skills/bunny-style-review`: Repo-local branch and PR review workflow for failure-path review and actionable nitpicks.
- `skills/marinara-architecture-guard`: Architecture guardrails for placement, import direction, and remote-capable command routing.
- `skills/marinara-agent-workflow`: Agent workflow references, source maps, handoff formats, and verification discipline.
