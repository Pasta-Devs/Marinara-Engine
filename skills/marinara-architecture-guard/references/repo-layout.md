# Marinara Repo Layout

Use this as a quick map. The detailed source of truth for current maintenance docs is `docs/developer/architecture.html`, `docs/developer/modules.html`, and `docs/developer/impact-areas.html`.

## TypeScript

```text
src/app/
  React bootstrap, shell, providers, startup effects.

src/features/
  Layered React feature packages. Import direction is shell -> modes -> runtime -> catalog.

src/features/catalog/
  Resource and data owners: chats, characters, personas, lorebooks, presets, chat-presets, connections, agents, gallery, knowledge.

src/features/runtime/
  Shared runtime systems: generation, world-state, visuals, tracker, haptics.

src/features/modes/
  User mode surfaces and mode-specific UI: shared, conversation, roleplay, game, game-assets, router.

src/features/shell/
  App-level tools: settings, connections, spotify, onboarding, mari, bot-browser, imports, notifications.

src/shared/
  Reusable frontend-only components, hooks, lib helpers, UI stores, and runtime adapters.

src/shared/api/
  Typed runtime wrappers around embedded Tauri commands/channels and the configured hostable Rust HTTP runtime. Feature code may call these. Engine code may not.
  Do not add new raw feature imports of tauri-client; add a focused wrapper here first.

src/engine/
  React-free product engine. Owns domain rules and orchestration.
```

## Engine Layers

```text
engine/contracts       Layer 0: types, schemas, constants
engine/core            Layer 0: result, IDs, clock, JSON primitives
engine/capabilities    Layer 1: TypeScript ports for Rust capabilities
engine/shared          Layer 2: pure deterministic helpers
engine/entities        Layer 3: pure entity operations
engine/repositories    Layer 4: capability-backed repositories
engine/generation-core Layer 5: prompt, lorebook, regex, LLM message building blocks
engine/agents-runtime  Layer 6: agent executor, tools, knowledge, memory
engine/generation      Layer 7: generation lifecycle and persistence
engine/modes           Layer 8: chat, roleplay, game top-level mode engines
```

Higher layers may import lower layers. Lower layers may not import higher layers.
Engine capability ports are implemented by feature/runtime/app-edge adapter code that calls `src/shared/api`; the engine itself stays host-independent.

## Rust

```text
src-tauri/src/
  lib.rs, state, app setup, command facades, HTTP server/dispatch, and the hostable marinara-server binary.

src-tauri/src/commands/
  Thin Tauri command modules grouped by capability.

src-tauri/src/http_dispatch.rs and http_server.rs
  Hostable Rust runtime facade. Remote-capable JSON commands go through the explicit dispatch allowlist; streaming routes use dedicated HTTP handlers.

src-tauri/crates/core/
  errors, IDs, paths, timestamps, basic foundations.

src-tauri/crates/security/
  path safety, outbound policy, secrets, safe fetch guards.

src-tauri/crates/storage/
  raw local storage, atomic writes, manifests, repositories.

src-tauri/crates/assets/
  managed media and file/blob handling.

src-tauri/crates/llm/
  provider transport, streaming, request shaping requiring secrets/network.

src-tauri/crates/integrations/
  Spotify, TTS, translation, haptics, and external integration transport.
```

Rust owns capability execution. TypeScript owns product meaning.

Hostable runtime flow:

```text
src/shared/api typed wrapper
  -> tauri-client.ts
  -> remote-runtime.ts allowlist when remoteRuntimeUrl is configured
  -> /api/invoke or /api/llm/stream
  -> src-tauri/src/http_dispatch.rs or http_server.rs
  -> existing focused Rust command/capability module
```

## UI Feature Layers

Important feature owners:

- `features/catalog/chats`: chat data hooks, mutations, folders, query keys, and storage-facing types.
- `features/catalog/characters`, `features/catalog/personas`, `features/catalog/lorebooks`, `features/catalog/presets`, `features/catalog/chat-presets`: library data and editing surfaces.
- `features/catalog/sprites`: shared sprite query keys, types, and React Query hooks for character and persona sprite owners.
- `features/catalog/connections`, `features/catalog/agents`, `features/catalog/gallery`, `features/catalog/knowledge`: data owners and resource hooks.
- `features/runtime/generation`: generation hook binding UI state and capability adapters to engine generation.
- `features/runtime/world-state`, `features/runtime/visuals`, `features/runtime/tracker`, `features/runtime/haptics`: shared runtime systems used by modes and shell.
- `features/modes/shared/chat-ui`: shared transcript, message, input, overlay, settings, branch, summary, gallery, and quick-switcher UI.
- `features/modes/shared/scene-ui`: shared scene banner UI.
- `features/modes/conversation`: conversation surface, setup, recent chats, and autonomous conversation UI.
- `features/modes/roleplay`: roleplay surface, HUD, choices, encounters, scene controls, and roleplay tracker UI.
- `features/modes/game`: game surface, hooks, stores, API facade, and gameplay UI.
- `features/modes/game-assets`: game asset browser and editor UI.
- `features/modes/router`: the only concrete mode composition point.
- `features/shell/settings`, `features/shell/connections`, `features/shell/spotify`, `features/shell/onboarding`, `features/shell/mari`, `features/shell/bot-browser`, `features/shell/imports`, `features/shell/notifications`: app-level tools and shell workflows.

Cross-package imports should use curated public files such as `index.ts`, `shell.ts`, `query-keys.ts`, and `types.ts`. Shared UI belongs in `src/shared/components` only when it is genuinely generic across the app, not merely shared by concrete modes.
Existing broad files such as mode composition surfaces are not precedent for new product behavior; move new logic to the owning mode, runtime, catalog, engine, or capability module.
