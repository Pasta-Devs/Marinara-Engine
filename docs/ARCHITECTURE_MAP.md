# Marinara Engine Architecture Map

This is the working map for organizing the codebase by shared foundations, feature systems, and mode-specific ownership.

Audit date: 2026-07-05
Scope: `packages/client/src`, `packages/server/src`, and `packages/shared/src`. The repo keeps no committed test suite; temporary `.test.ts` files are gitignored and removed after use.

## Section Codes

Use these codes when planning moves, labeling issues, or adding a short file header to code that cannot be moved yet.

| Code                | Meaning                                                                             | Primary home                                                             |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CORE-CONTRACT`     | Types, schemas, constants, pure helpers shared by client and server                 | `packages/shared/src`                                                    |
| `CLIENT-APP`        | React app bootstrap, layout shell, global UI wiring                                 | `packages/client/src/App.tsx`, `main.tsx`, `components/layout`           |
| `CLIENT-SHARED`     | Client-only UI primitives, common hooks, common browser helpers, global stores      | `packages/client/src/components/ui`, `hooks`, `lib`, `stores`            |
| `SERVER-APP`        | Fastify app bootstrap, middleware, route registration, runtime config               | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config`         |
| `SERVER-SHARED`     | Server-only storage, DB, LLM, prompt, lorebook, import, and integration foundations | `packages/server/src/services`, `db`, `utils`, `lib`                     |
| `MODE-CONVERSATION` | Conversation-only UI and server behavior                                            | conversation components, `/api/conversation`, conversation services      |
| `MODE-ROLEPLAY`     | Roleplay and visual-novel UI, scenes, sprites, encounter helpers                    | roleplay chat components, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME`         | Game-mode UI, GM prompts, dice, party, map, combat, assets, sessions                | `components/game`, `/api/game`, game services                            |
| `FEATURE-AGENTS`    | Agent definitions, execution, debug state, knowledge routing                        | agent components, agent store, agent routes/services                     |
| `FEATURE-ASSETS`    | Backgrounds, avatars, gallery, generated images, sprites, game assets               | asset routes, gallery storage, image services                            |
| `FEATURE-SIDECAR`   | Local model runtime, scene analysis, downloads, process control                     | sidecar store, `/api/sidecar`, sidecar services                          |
| `FEATURE-TTS`       | TTS config, voice routing, cache keys, audio playback                               | TTS settings/hooks/routes/services                                       |
| `FEATURE-IMPORT`    | ST/Marinara importers and migration helpers                                         | import routes/services                                                   |
| `TEST`              | Temporary proof tests only                                                          | Temporary `packages/server/src/**/__tests__/` files, removed after use   |

Prefer making the path communicate the section. A comment like `// Section: MODE-GAME` is only useful while a file is still in a mixed directory.

## Package Boundaries

### `packages/shared`

`CORE-CONTRACT`. This package should stay runtime-agnostic.

Current contents:

- `types`: chat, character, game, game state, combat, scene, sidecar, TTS, agents, prompts, lorebooks, exports, themes.
- `schemas`: Zod schemas for persisted/shared entities.
- `constants`: providers, defaults, chat modes, model lists, agent prompts.
- `utils`: pure helpers such as macro expansion, XML wrapping, and music scoring.
- `features`: agent manifests/registry, function-call definitions, folder packages, and turn-game engines for UNO and Chess.

Rules:

- No React, DOM, Fastify, Drizzle, filesystem, network, or provider SDK code.
- Move code here only when both client and server need the same contract or pure algorithm.
- Avoid turning `shared` into a general dumping ground for client-only helpers.

### `packages/client`

React 19 + Vite PWA. It currently has about 447 source files.

Current top-level shape:

- `App.tsx`, `main.tsx`: app bootstrap, React Query, PWA, global effects.
- `components/layout`: app shell, sidebars, top bar, modal renderer.
- `components/ui`: reusable UI primitives.
- `components/chat`: mixed common chat, conversation, roleplay, visual novel, scene, sprite, and encounter UI.
- `components/game`: game-mode surface and panels.
- `components/panels`, `components/modals`, entity editors: settings and resource management.
- `features`: extracted feature modules, currently including chat-settings sections and tracker-panel pieces.
- `hooks`: React Query hooks and runtime hooks for most API features.
- `lib`: browser/client helpers. This currently mixes common helpers with mode-specific game helpers.
- `stores`: Zustand stores for UI, chat runtime, agents, game state, game mode, assets, sidecar, translation, gallery, encounters.
- `styles`: global stylesheet and theme-specific CSS.

Important current crossovers:

- `components/game` imports `components/chat` for shared visual pieces such as weather and gallery drawers.
- `components/chat` imports game-state and encounter state for roleplay/visual-novel features.
- `hooks/use-generate.ts` touches chat state, agent state, game state, game mode state, translation state, and UI settings.
- `lib/game-*` helpers are game-only but live beside global helpers.

### `packages/server`

Fastify API + file-backed storage + a temporary in-memory SQL compatibility index + provider integrations. It currently has about 326 source files.

Current top-level shape:

- `app.ts`, `index.ts`: app factory, bootstrap, static serving, file-storage hydration, compatibility migrations, seeders.
- `routes`: 67 route files. Many are thin CRUD APIs, but `generate.routes.ts` and `game.routes.ts` are large orchestration files.
- `services/storage`: storage facade layer for chats, characters, prompts, lorebooks, settings, assets, themes, game state.
- `services/llm`: provider registry, base provider contract, OpenAI-compatible providers, local sidecar bridge.
- `services/prompt`: shared prompt assembly for non-game generation.
- `services/conversation`: schedules, autonomous messages, awareness, conversation command handling.
- `services/game`: GM prompts, dice, combat, state machine, party prompts, maps, weather, time, sessions, checkpoints, reputation, assets.
- `services/sidecar`: local runtime, model management, scene analysis, scene postprocessing.
- `services/agents`: agent execution and knowledge routing.
- `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/extensions`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/memory-recall`, and `discord-webhook.ts`: feature foundations.
- `db/schema`: temporary compatibility schema for the in-memory SQL index while durable data lives in `DATA_DIR/storage`.
- `db/file-backed-store.ts`: v1.5.7 bridge that imports legacy SQLite into JSON snapshots and autosaves runtime changes back to files. See `docs/FILE_STORAGE_MIGRATION.md`.

Important current crossovers:

- Routes import storage, LLM, prompt, lorebook, game, sidecar, and feature services directly.
- `generate.routes.ts` serves the main conversation/roleplay generation path and agent pipeline.
- `game.routes.ts` owns game orchestration and also reaches into LLM, sidecar, lorebook, image, storage, and Discord webhook behavior.
- Scene analysis lives in sidecar services, but game mode can run it through either sidecar or a selected LLM connection.

## Mode Ownership

### Shared by all modes

These are global foundations:

- Chat/message persistence: `server/src/routes/chats.routes.ts`, `services/storage/chats.storage.ts`, shared chat types/schemas.
- Characters/personas: character routes/storage/schemas and client character hooks/editors.
- Connections/providers: connection routes/storage/shared provider constants and `services/llm`.
- Prompt presets/lorebooks/regex/custom tools: shared authoring and prompt-injection foundations.
- Generation transport: `client/src/hooks/use-generate.ts`, `server/src/routes/generate.routes.ts`, provider registry.
- TTS, translation, gallery, themes, settings, imports, backups.

### Conversation mode

Primary code:

- Client: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx`, conversation quick-start wiring in `ChatArea.tsx`.
- Client hooks: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Server: `/api/conversation`, `services/conversation/*`.
- Shared metadata: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart`, day/week summaries.

Expected boundary:

- Conversation should own schedules, autonomous check-ins, conversation activity, and non-roleplay message display.
- Conversation should not know about game dice, GM tags, QTE, game maps, or game combat.

### Roleplay and visual novel mode

Primary code:

- Client: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, `RoleplayHUD*`, `SpriteOverlay.tsx`, `SpriteSidebar.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx`, `ExpressionPanel.tsx`, `EncounterModal.tsx`.
- Server: `/api/scene`, `/api/encounter`, `/api/sprites`, parts of `/api/generate`.
- Shared contracts: `scene`, `vn`, roleplay-related chat metadata fields, sprite placement types.

Expected boundary:

- Roleplay/visual-novel should own scenes, sprite display, CYOA choices, RP HUD, and RP encounter helper flows.
- Shared visual effects that are also used by game mode should move out of `components/chat`.

### Game mode

Primary code:

- Client: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Server: `/api/game`, `/api/game-assets`, `services/game/*`, game portions of `services/sidecar/scene-analyzer.ts` and `scene-postprocess.ts`.
- Shared contracts: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts`, game fields in `ChatMetadata`.

Expected boundary:

- Game should own GM prompts, party prompts, dice, skill checks, QTE, game combat, maps, travel/rest, weather/time, NPC reputation, game session summaries, generated game assets, and game logs.
- Game should not depend on chat-mode UI except through shared primitives or explicitly shared feature components.

## Current Large Files

These are the files most likely to slow future work:

| File                                                         | Approx lines | Section                    | Concern                                                                                   |
| ------------------------------------------------------------ | -----------: | -------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/server/src/routes/generate.routes.ts`              |        12155 | shared generation / agents | Route, streaming, prompt, agents, storage, and side effects are in one file.              |
| `packages/server/src/routes/game.routes.ts`                  |        11066 | `MODE-GAME`                | API handlers, GM flow, scene analysis, assets, combat, and persistence are coupled.       |
| `packages/client/src/components/game/GameSurface.tsx`        |        10980 | `MODE-GAME`                | Rendering, state orchestration, assets, logs, narration, combat, and effects are coupled. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` |         9083 | mixed chat settings        | Section extraction is underway in `features/chat-settings`, but the drawer is still large. |
| `packages/client/src/components/game/GameNarration.tsx`      |         6294 | `MODE-GAME`                | Display rendering and command formatting are tightly coupled.                             |
| `packages/client/src/components/game/GameCombatUI.tsx`       |         3288 | `MODE-GAME`                | Combat display, controls, and logs can become smaller panels/hooks.                       |
| `packages/client/src/components/chat/RoleplayHUD.tsx`        |         1582 | `MODE-ROLEPLAY`            | Split partially done via `RoleplayHUDActionsMenu.tsx` and `RoleplayHUDPanels.tsx`.        |

## Target Structure

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

The old flat `types`, `schemas`, and `constants` layout is no longer the whole story: `packages/shared/src/features/` now hosts agents, function calls, folder packages, and turn games. The first shared cleanup should still be type-level and incremental, not a mass file move.

## Migration Rules

1. New code should be placed in the narrowest correct section.
2. If two or more modes use a client component, move it to `CLIENT-SHARED` before adding more mode-specific behavior.
3. If client and server both need a type/schema/pure helper, move it to `CORE-CONTRACT`.
4. If only the server needs it, keep it out of `packages/shared`.
5. Route files should validate HTTP input and call services. Domain decisions should move into services.
6. Stores should either be global (`ui`, `chat`, `sidecar`) or mode-specific (`game-mode`, `encounter`). Avoid one store quietly owning multiple modes.
7. Metadata should become discriminated by `ChatMode`: base metadata plus conversation, roleplay, visual-novel, and game extensions.
8. Move one feature at a time and leave compatibility exports/wrappers when a broad import path would otherwise churn the repo.
9. After each move, run `pnpm lint` and a targeted Prettier check for touched files.

## First Refactor Candidates

These are good first cleanup passes because they reduce coupling without changing behavior.

1. Split `components/chat` into common, conversation, and roleplay groups.
   - Common candidates: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects`, shared message/input primitives.
   - Conversation candidates: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Roleplay candidates: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. The RoleplayHUD split is partially done in `RoleplayHUDActionsMenu.tsx` and `RoleplayHUDPanels.tsx`.
2. Move game-only client helpers under a game module.
   - Candidates: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Split `GameSurface.tsx` into runtime hooks and smaller containers.
   - Candidate hooks: narration runtime, asset runtime, scene-analysis runtime, combat runtime, log/runtime history, audio runtime.
4. Split `GameNarration.tsx` into command parsing/formatting and display components.
5. Split `game.routes.ts` by handler group.
   - Candidate groups: setup/session, turn generation, dice/skill/QTE, journal/inventory, map/travel/weather, combat, assets/scene analysis.
6. Split `generate.routes.ts` into generation transport, agent pipeline handling, retry routes, and command/postprocess helpers.
7. Split `ChatMetadata` into mode-specific metadata contracts.
8. Move shared roleplay/game visuals out of `components/chat` before game imports more chat internals.

## Practical Start

For the next cleanup PR, use this order:

1. Create the target directories for one area only.
2. Move pure helpers first.
3. Move leaf components next.
4. Leave the large orchestrator in place until its imports mostly point at the new module.
5. Add compatibility re-exports only where import churn would distract from the real change.
6. Run lint and targeted Prettier checks.
