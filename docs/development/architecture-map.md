# Architecture Map (Developers)

This guide is developer material for contributors. It describes the code organization of Marinara Engine: shared foundations, feature systems, mode ownership, and where each piece of code belongs. It also lists the current large files and the direction for future refactor work.

Scope: `packages/client/src`, `packages/server/src`, and `packages/shared/src`. The repo keeps no conventional `.test.ts` suite. Tracked regression scripts and Playwright smoke coverage provide automated validation; temporary `.test.ts` proof files are gitignored and removed after use.

File counts, line counts, and route counts drift as the repo changes. This map gives approximate shapes and names. Always check the current tree for exact numbers.

## Section codes

Use these codes when planning moves, labeling issues, or adding a short file header to code that cannot be moved yet.

| Code | Meaning | Primary home |
| --- | --- | --- |
| `CORE-CONTRACT` | Types, schemas, constants, pure helpers shared by client and server | `packages/shared/src` |
| `CLIENT-APP` | React app bootstrap, layout shell, global UI wiring | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | Client-only UI primitives, common hooks, common browser helpers, global stores | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Fastify app bootstrap, middleware, route registration, runtime config | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Server-only storage, DB, LLM, prompt, lorebook, import, and integration foundations | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | Conversation-only UI and server behavior | conversation components, `/api/conversation`, conversation services |
| `MODE-ROLEPLAY` | Roleplay UI, scenes, sprites, encounter helpers | roleplay chat components, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Game-mode UI, GM prompts, dice, party, map, combat, assets, sessions | `components/game`, `/api/game`, game services |
| `FEATURE-AGENTS` | Agent definitions, execution, debug state, knowledge routing | agent components, agent store, agent routes/services |
| `FEATURE-ASSETS` | Backgrounds, avatars, gallery, generated images, sprites, game assets | asset routes, gallery storage, image services |
| `FEATURE-SIDECAR` | Local model runtime, scene analysis, downloads, process control | sidecar store, `/api/sidecar`, sidecar services |
| `FEATURE-TTS` | TTS config, voice routing, cache keys, audio playback | TTS settings/hooks/routes/services |
| `FEATURE-IMPORT` | SillyTavern and Marinara importers and migration helpers | import routes/services |
| `TEST` | Tracked regression and browser smoke coverage, plus temporary proof tests when needed | `scripts/regressions`, `e2e`, and temporary `packages/server/src/**/__tests__/` files removed after use |

Prefer making the path communicate the section. A comment like `// Section: MODE-GAME` is only useful while a file still sits in a mixed directory.

## Package boundaries

### packages/shared

`CORE-CONTRACT`. This package should stay runtime-agnostic.

Current contents:

- `types`: chat, character, game, game state, combat, scene, sidecar, TTS, agents, prompts, lorebooks, exports, themes.
- `schemas`: Zod schemas for persisted and shared entities.
- `constants`: providers, defaults, chat modes, model lists, agent prompts.
- `utils`: pure helpers such as macro expansion, XML wrapping, and music scoring.
- `features`: agent manifests and registry, function-call definitions, folder packages, and turn-game engines for UNO, Chess, and Poker.

Rules:

- No React, DOM, Fastify, server storage, filesystem, network, or provider SDK code.
- Move code here only when both client and server need the same contract or pure algorithm.
- Do not turn `shared` into a general dumping ground for client-only helpers.

### packages/client

React 19 and Vite PWA. It currently holds several hundred source files.

Current top-level shape:

- `App.tsx`, `main.tsx`: app bootstrap, React Query, PWA, global effects.
- `components/layout`: app shell, sidebars, top bar, modal renderer.
- `components/ui`: reusable UI primitives.
- `components/chat`: mixed common chat, conversation, roleplay, scene, sprite, and encounter UI.
- `components/game`: game-mode surface and panels.
- `components/panels`, `components/modals`, entity editors: settings and resource management.
- `features`: extracted feature modules, currently including chat-settings sections and tracker-panel pieces.
- `hooks`: React Query hooks and runtime hooks for most API features.
- `lib`: browser and client helpers. This currently mixes common helpers with mode-specific game helpers.
- `stores`: Zustand stores for UI, chat runtime, agents, game state, game mode, assets, sidecar, translation, gallery, encounters, and the turn games.
- `styles`: global stylesheet and theme-specific CSS.

Important current crossovers:

- `components/game` imports `components/chat` for shared visual pieces such as weather and gallery drawers.
- `components/chat` imports game-state and encounter state for roleplay features.
- `hooks/use-generate.ts` touches chat state, agent state, game state, game mode state, translation state, and UI settings.
- `lib/game-*` helpers are game-only but live beside global helpers.

### packages/server

Fastify API, file-native storage, and provider integrations. It currently holds several hundred source files.

Current top-level shape:

- `app.ts`, `index.ts`: app factory, bootstrap, static serving, file-storage hydration, and seeders.
- `routes`: many route files. Most are thin CRUD APIs, but `generate.routes.ts` and `game.routes.ts` are large orchestration files. A `routes/generate/` folder holds the first extracted pieces of the generation path.
- `services/storage`: storage facade layer for chats, characters, prompts, lorebooks, settings, assets, themes, game state.
- `services/llm`: provider registry, base provider contract, OpenAI-compatible providers, local sidecar bridge.
- `services/prompt`: shared prompt assembly for non-game generation.
- `services/conversation`: schedules, autonomous messages, awareness, conversation profiles, conversation command handling.
- `services/game`: GM prompts, dice, combat, state machine, party prompts, maps, weather, time, sessions, checkpoints, reputation, assets.
- `services/sidecar`: local runtime, model management, scene analysis, scene postprocessing.
- `services/agents`: agent execution and knowledge routing.
- Feature foundations: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/extensions`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, and `discord-webhook.ts`.
- `db/schema`: file-table definitions for data stored under `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts`: native table metadata and query expressions.
- `db/file-backed-store.ts`: in-memory table store, transaction boundary, crash recovery, and JSON snapshot persistence. See [File-Native Storage (Developers)](file-storage.md).

Important current crossovers:

- Routes import storage, LLM, prompt, lorebook, game, sidecar, and feature services directly.
- `generate.routes.ts` serves the main conversation and roleplay generation path plus the agent pipeline.
- `game.routes.ts` owns game orchestration and also reaches into LLM, sidecar, lorebook, image, storage, and Discord webhook behavior.
- Scene analysis lives in sidecar services, but game mode can run it through either the sidecar or a selected LLM connection.

## Mode ownership

### Shared by all modes

These are global foundations:

- Chat and message persistence: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, shared chat types and schemas.
- Characters and personas: character routes, storage, schemas, and client character hooks and editors.
- Connections and providers: connection routes, storage, shared provider constants, and `services/llm`.
- Prompt presets, lorebooks, regex, custom tools: shared authoring and prompt-injection foundations.
- Generation transport: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts`, and the provider registry.
- TTS, translation, gallery, themes, settings, imports, backups.

### Conversation mode

Primary code:

- Client: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx`, and conversation quick-start wiring in `ChatArea.tsx`.
- Client hooks: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Server: `/api/conversation`, `services/conversation/*`.
- Shared metadata: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart`, and day and week summaries.

Expected boundary:

- Conversation should own schedules, autonomous check-ins, conversation activity, and non-roleplay message display.
- Conversation should not know about game dice, GM tags, quick-time events, game maps, or game combat.

### Roleplay mode

Primary code:

- Client: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, the `RoleplayHUD` components, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx`, and `EncounterModal.tsx`.
- Server: `/api/scene`, `/api/encounter`, `/api/sprites`, and parts of `/api/generate`.
- Shared contracts: `scene`, roleplay-related chat metadata fields, and sprite placement types.

Expected boundary:

- Roleplay should own scenes, sprite display, CYOA choices, the roleplay HUD, and roleplay encounter helper flows.
- Shared visual effects that game mode also uses should move out of `components/chat`.

### Game mode

Primary code:

- Client: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Server: `/api/game`, `/api/game-assets`, `services/game/*`, and game portions of `services/sidecar/scene-analyzer.ts` and `scene-postprocess.ts`.
- Shared contracts: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts`, and game fields in `ChatMetadata`.

Expected boundary:

- Game should own GM prompts, party prompts, dice, skill checks, quick-time events, game combat, maps, travel and rest, weather and time, NPC reputation, game session summaries, generated game assets, and game logs.
- Game should not depend on chat-mode UI except through shared primitives or explicitly shared feature components.

## Current large files

These files are the most likely to slow future work because they mix many concerns in one place. Line counts change often, so this list gives rough order and the concern rather than exact sizes.

| File | Section | Concern |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | shared generation and agents | Route, streaming, prompt, agents, storage, and side effects live in one file. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | API handlers, GM flow, scene analysis, assets, combat, and persistence are coupled. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | Rendering, state orchestration, assets, logs, narration, combat, and effects are coupled. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | mixed chat settings | Section extraction is underway in `features/chat-settings`, but the drawer is still large. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | Display rendering and command formatting are tightly coupled. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | Combat display, controls, and logs can become smaller panels and hooks. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | A split is partly done via `RoleplayHUDActionsMenu.tsx` and `RoleplayHUDPanels.tsx`. |

## Target structure

This is the direction for future refactors. It does not require moving everything at once.

### Client target

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Server target

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Shared target

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

The old flat `types`, `schemas`, and `constants` layout is no longer the whole story. `packages/shared/src/features/` now hosts agents, function calls, folder packages, and turn games. The first shared cleanup should still be type-level and incremental, not a mass file move.

## Migration rules

1. Place new code in the narrowest correct section.
2. If two or more modes use a client component, move it to `CLIENT-SHARED` before adding more mode-specific behavior.
3. If client and server both need a type, schema, or pure helper, move it to `CORE-CONTRACT`.
4. If only the server needs it, keep it out of `packages/shared`.
5. Route files should validate HTTP input and call services. Domain decisions should move into services.
6. Stores should be either global (`ui`, `chat`, `sidecar`) or mode-specific (`game-mode`, `encounter`). Avoid one store quietly owning multiple modes.
7. Metadata should become discriminated by `ChatMode`: base metadata plus conversation, roleplay, and game extensions.
8. Move one feature at a time. Leave compatibility exports or wrappers when a broad import path would otherwise churn the repo.
9. After each move, run lint:

   ```bash
   pnpm lint
   ```

   Then run a targeted Prettier check on the touched files.

## First refactor candidates

These are good first cleanup passes because they reduce coupling without changing behavior.

1. Split `components/chat` into common, conversation, and roleplay groups.
   - Common candidates: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects`, and shared message and input primitives.
   - Conversation candidates: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Roleplay candidates: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. The roleplay HUD split is partly done in `RoleplayHUDActionsMenu.tsx` and `RoleplayHUDPanels.tsx`.
2. Move game-only client helpers under a game module.
   - Candidates: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Split `GameSurface.tsx` into runtime hooks and smaller containers.
   - Candidate hooks: narration runtime, asset runtime, scene-analysis runtime, combat runtime, log and history runtime, audio runtime.
4. Split `GameNarration.tsx` into command parsing and formatting plus display components.
5. Split `game.routes.ts` by handler group.
   - Candidate groups: setup and session, turn generation, dice and skill and quick-time events, journal and inventory, map and travel and weather, combat, assets and scene analysis.
6. Split `generate.routes.ts` into generation transport, agent pipeline handling, retry routes, and command and postprocess helpers.
7. Split `ChatMetadata` into mode-specific metadata contracts.
8. Move shared roleplay and game visuals out of `components/chat` before game imports more chat internals.

## Practical start

For the next cleanup PR, use this order:

1. Create the target directories for one area only.
2. Move pure helpers first.
3. Move leaf components next.
4. Leave the large orchestrator in place until its imports mostly point at the new module.
5. Add compatibility re-exports only where import churn would distract from the real change.
6. Run lint:

   ```bash
   pnpm lint
   ```

   Then run targeted Prettier checks on the touched files.

## Related guides

- [Frontend Architecture (Developers)](frontend.md)
- [File-Native Storage (Developers)](file-storage.md)
