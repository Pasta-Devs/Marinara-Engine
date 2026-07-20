# Frontend Architecture (Developers)

This is developer material, not an end-user guide. It explains how the Marinara Engine client is built. It covers the React app structure, the Zustand stores, the React Query hooks, the main components, and the server API map. If you just want to use the app, start with the user guides instead.

## Overview

Marinara Engine is an AI chat application with Conversation, Roleplay, and Game modes. The client is a React 19 single-page app served by Vite, styled with Tailwind CSS v4, and packaged as a Progressive Web App (PWA).

The client lives in `packages/client`. It talks to a Fastify API server (`packages/server`) over REST and Server-Sent Events (SSE). Shared data contracts (types, Zod schemas, constants) live in `packages/shared` and are imported by both sides.

## Application architecture

### Three-column layout

The UI uses a Discord-inspired three-column design managed by `components/layout/AppShell.tsx`:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Left sidebar (`components/layout/ChatSidebar.tsx`): the chat list, organized by folders and filterable by mode (Conversation, Roleplay, Game).
- Center pane: either the active chat surface or a full editor (character, lorebook, preset, and so on). Only one shows at a time. Editors replace the chat area.
- Right panel (`components/layout/RightPanel.tsx`): a resource browser and settings, toggled from the top bar. Once a panel is mounted, it stays in the DOM (hidden with CSS) to keep its scroll position and local state.
- Top bar (`components/layout/TopBar.tsx`): quick-switch buttons for each right panel.

### Navigation

Navigation is state-driven. There is no URL router. The `stores/ui.store.ts` Zustand store controls what renders:

| Navigation target      | Store field          | Trigger function                                  |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Open character editor  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Open lorebook editor   | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Open preset editor     | `presetDetailId`     | `openPresetDetail(id)`                             |
| Open connection editor | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Open agent editor      | `agentDetailId`      | `openAgentDetail(id)`                              |
| Open persona editor    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Switch right panel     | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Open modal             | `modal`              | `openModal(type, props?)`                          |

### Code splitting

Major editors and heavy components are lazy-loaded in `AppShell.tsx` using `React.lazy()` plus `Suspense`. This keeps the initial bundle small (see the bundle budget below).

## State management

### Zustand stores (client state)

The client uses a set of Zustand stores in `packages/client/src/stores/` for UI and runtime state. `ui.store.ts` is the only persisted store. The others hold runtime state for chats, agents, games, the local model runtime, translation, dialogs, backfill, and table games.

The current store files are: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts`, and `uno-game.store.ts`.

#### `ui.store.ts`: settings and UI chrome

The only persisted store (localStorage via the Zustand `persist` middleware). It holds:

- Theme: `visualTheme` ("default" or "sillytavern"), the `data-theme` value (dark or light), and custom color overrides.
- Appearance: `fontSize`, `chatFontSize`, `fontFamily`, custom fonts, and cursor style.
- Chat display: `boldDialogue`, `showTimestamps`, `showModelName`, and `messagesPerPage`.
- Text styling: chat text color, roleplay message background opacity, and text stroke.
- Streaming: `enableStreaming` and `streamingSpeed`.
- Conversation theme: gradient colors for message bubbles.
- Sound: `convoNotificationSound` and `rpNotificationSound`.
- Behavior: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects`, and `guideGenerations`.
- Navigation: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, all `*DetailId` fields, and `modal`.

Synced custom themes are not stored in `ui.store.ts`. They are fetched from the server through React Query and mirrored across devices connected to the same Marinara instance.

#### `chat.store.ts`: chat runtime

Not persisted. Tracks the active chat session:

- `activeChatId`: which chat is displayed.
- `messages`: the current message array.
- `isStreaming`, `streamBuffer`: generation in progress.
- `inputDrafts`: per-chat draft messages.
- `currentInput`: the current value of the chat input.
- `perChatTyping`: typing indicator state.
- `unreadCounts`, `chatNotifications`: notification badges.
- `abortControllers`: cancel in-flight generations.

#### `agent.store.ts`: agent execution

Tracks agent pipeline state during and after generation:

- `activeAgents`: agents currently running.
- `thoughtBubbles`: agent reasoning shown in real time.
- `echoMessages`: the echo chamber (simulated viewer chat).
- `cyoaChoices`: the branching choice UI.
- `debugLog`: performance metrics and token usage.
- `failedAgentTypes`: agents that errored (for retry UI).

#### `game-state.store.ts`: RPG companion

Holds scene and world context for Roleplay mode:

- `current` (GameState): date, time, location, weather, present characters, events, player stats, quests, and inventory.
- `isVisible`, `expandedSections`: HUD display state.

#### `encounter.store.ts`: combat system

Turn-based combat state:

- `active`: whether an encounter is in progress.
- `party`, `enemies`: combatants with HP, attacks, and statuses.
- `environment`: arena details.
- `playerActions`, `encounterLog`: the action queue and history.
- `combatResult`: victory, defeat, fled, or interrupted.

#### `gallery.store.ts`: image overlays

- `pinnedImages`: images pinned to the chat area as overlays.

### React Query (server data)

All server data is fetched and cached through TanStack React Query, configured in `main.tsx`:

- Stale time: 30 seconds (global default).
- Retry: 1 attempt.
- Refetch on focus: disabled.
- Cache: in-memory only (no persistence).

Each entity has a dedicated hook file that exports query and mutation hooks.

## Hooks reference

All hooks live in `src/hooks/` and follow the pattern `use-{entity}.ts`.

### Chat hooks (`use-chats.ts`)

| Hook                               | Type           | Description                                  |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | All chats                                    |
| `useChat(id)`                      | Query          | Single chat by ID                            |
| `useChatMessages(chatId, perPage)` | Infinite Query | Paginated messages for a chat                |
| `useChatGroup(groupId)`            | Query          | Chat group                                   |
| `useCreateChat()`                  | Mutation       | Create a new chat                            |
| `useDeleteChat()`                  | Mutation       | Delete a chat                                |
| `useUpdateChatMetadata()`          | Mutation       | Update chat metadata (agents, sprites, more) |
| `useBranchChat()`                  | Mutation       | Branch a chat from a specific message        |
| `useUpdateMessage()`               | Mutation       | Edit message content (optimistic update)     |
| `useDeleteMessage()`               | Mutation       | Delete a single message                      |
| `useDeleteMessages()`              | Mutation       | Delete multiple messages                     |
| `useSetActiveSwipe()`              | Mutation       | Switch to a different generation swipe       |
| `usePeekPrompt()`                  | Mutation       | Preview the assembled prompt                 |
| `useClearAllData()`                | Mutation       | Delete everything (destructive)              |

### Character hooks (`use-characters.ts`)

| Hook                   | Type     | Description                            |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | All characters                         |
| `useCharacter(id)`     | Query    | Single character with parsed card data |
| `useCreateCharacter()` | Mutation | Create character                       |
| `useUpdateCharacter()` | Mutation | Update character card data             |
| `useDeleteCharacter()` | Mutation | Delete character                       |
| `useUploadAvatar()`    | Mutation | Upload avatar image                    |
| `usePersonas()`        | Query    | All personas                           |
| `usePersona(id)`       | Query    | Single persona                         |
| `useCreatePersona()`   | Mutation | Create persona                         |
| `useUpdatePersona()`   | Mutation | Update persona                         |
| `useDeletePersona()`   | Mutation | Delete persona                         |
| `useCharacterGroups()` | Query    | Character groups                       |
| `usePersonaGroups()`   | Query    | Persona groups                         |

### Preset hooks (`use-presets.ts`)

| Hook                           | Type     | Description                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | All presets                                                |
| `usePreset(id)`                | Query    | Single preset                                              |
| `usePresetFull(id)`            | Query    | Preset with sections, groups, and choices                  |
| `useDefaultPreset()`           | Query    | The default preset                                         |
| `useCreatePreset()`            | Mutation | Create preset                                              |
| `useUpdatePreset()`            | Mutation | Update preset                                              |
| `useDeletePreset()`            | Mutation | Delete preset                                              |
| `usePresetSections(presetId)`  | Query    | Prompt sections for a preset                               |
| `usePresetGroups(presetId)`    | Query    | Section groups                                             |
| `usePresetVariables(presetId)` | Query    | Preset variables (formerly choice blocks)                  |
| `usePreviewPreset()`           | Mutation | Rendered prompt preview for `{ presetId, chatId, choices }` |

### Agent hooks (`use-agents.ts`)

| Hook                 | Type     | Description                     |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | All agent configurations        |
| `useAgentConfig(id)` | Query    | Single agent config             |
| `useCreateAgent()`   | Mutation | Create custom agent             |
| `useUpdateAgent()`   | Mutation | Update agent config             |
| `useDeleteAgent()`   | Mutation | Delete agent                    |
| `useToggleAgent()`   | Mutation | Toggle built-in agent on or off |

### Generation hook (`use-generate.ts`)

The most complex hook. It returns `{ generate, retryAgents }`.

`generate(params)` takes one options object with fields such as `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate`, and `attachments`. It returns `false` if a generation is already in flight for that chat. The flow is:

1. Set streaming state in `chat.store.ts`.
2. Send the generation request to `/api/generate`.
3. Parse SSE events such as `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done`, and `error`.
4. Update the React Query cache with new messages.
5. Populate the agent store with thought bubbles and debug info.
6. Handle errors with toast notifications.

### Other hooks

The `src/hooks/` folder also contains many feature-specific hooks. A representative sample:

| File                           | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | API connection CRUD plus test             |
| `use-lorebooks.ts`             | Lorebook and entry CRUD                    |
| `use-scene.ts`                 | Scene planning, creation, conclusion       |
| `use-encounter.ts`             | Combat encounter init, action, summary     |
| `use-autonomous-messaging.ts`  | Autonomous message polling and scheduling  |
| `use-idle-detection.ts`        | 10-minute inactivity detector              |
| `use-background-autonomous.ts` | Background polling for inactive chats      |
| `use-translate.ts`             | Text translation                          |
| `use-apply-regex.ts`           | Regex script execution on messages         |
| `use-custom-tools.ts`          | Custom tool CRUD                           |
| `use-knowledge-sources.ts`     | Knowledge source management                |
| `use-gallery.ts`               | Chat gallery images                        |
| `use-chat-folders.ts`          | Chat folder CRUD plus reordering           |
| `use-regex-scripts.ts`         | Regex script CRUD                          |
| `use-haptic.ts`                | Haptic device connection and commands      |

## Component guide

### Chat system (`components/chat/`)

The chat system is the largest feature area. `ChatArea.tsx` lazy-loads three rendering surfaces: Conversation, Roleplay, and Game Mode.

#### Conversation mode (`ChatConversationSurface.tsx`)

Messenger-style chat bubbles. User messages on the right, assistant on the left. Features:

- Infinite scroll pagination (load older messages when you scroll up).
- Per-message actions: edit, copy, regenerate, delete, branch, peek prompt.
- Attachment support (images and files).
- Emoji and GIF pickers.
- Slash commands.
- Notification sounds on new messages.
- Draft persistence per chat.

#### Roleplay mode (`ChatRoleplaySurface.tsx`)

A dark, immersive RPG-themed interface. It has all the Conversation features plus:

- Character sprites with expression changes driven by the expression agent.
- The Roleplay HUD showing game state (time, location, weather, present characters).
- Weather effects (particle overlays that match the scene weather).
- The echo chamber panel (simulated viewer reactions).
- Combat encounters with a turn-based action system.
- A world info panel showing active lorebook entries.
- A scene system for branching mini-roleplays.
- Background images with crossfade transitions.

#### Game Mode (`GameSurface.tsx`)

The AI Game Master surface. It lives outside the chat folder, in `components/game/GameSurface.tsx`. `ChatArea.tsx` renders it when the chat mode is `game`. It reads the dedicated game stores (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`). It drives sessions, dice rolls, skill checks, maps, and turn storyboards through the hooks in `use-game.ts` and `use-game-storyboards.ts`.

#### Key components

- `ChatArea.tsx`: the central orchestrator. It fetches all data (messages, characters, personas), builds the character map, determines the chat mode, and renders the right surface.
- `ChatMessage.tsx`: renders a single message with markdown, swipe navigation, editing, and action menus. It uses an uncontrolled `EditTextarea` subcomponent to avoid re-renders during editing.
- `ChatInput.tsx`: user input with auto-resize, draft persistence, slash command completion, attachment handling, and emoji or GIF insertion.

### Editor components

Each resource type has a full-page editor that replaces the chat area:

| Editor            | File                                          | Manages                                                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Character Editor  | `components/characters/CharacterEditor.tsx`   | Character card fields, avatar, greeting, personality, system prompt, extensions |
| Lorebook Editor   | `components/lorebooks/LorebookEditor.tsx`     | Lorebook metadata and entries with keys, activation rules, injection settings   |
| Preset Editor     | `components/presets/PresetEditor.tsx`         | Prompt sections, groups, markers, generation parameters, choice blocks          |
| Connection Editor | `components/connections/ConnectionEditor.tsx` | API provider, base URL, model, context window, flags                            |
| Agent Editor      | `components/agents/AgentEditor.tsx`           | Agent prompt template, phase, connection, tools, settings                       |
| Persona Editor    | `components/personas/PersonaEditor.tsx`       | User persona with name, description, stats, avatar                              |

### Modal system (`components/modals/`)

Modals are rendered by `components/layout/ModalRenderer.tsx`. It reads `ui.store.modal` and renders the matching component inside `Suspense`. The modal components live under `components/modals/`.

The current modal types include (this list is illustrative, not exhaustive):

| Type                       | Component                     | Purpose                                    |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Quick character creation (name and avatar) |
| `create-connection`        | `CreateConnectionModal`       | Quick connection creation                  |
| `create-persona`           | `CreatePersonaModal`          | Quick persona creation                     |
| `create-lorebook`          | `CreateLorebookModal`         | Quick lorebook creation                    |
| `create-preset`            | `CreatePresetModal`           | Quick preset creation                      |
| `import-character`         | `ImportCharacterModal`        | Import from file (JSON or PNG)             |
| `import-connection`        | `ImportConnectionModal`       | Import a connection package                |
| `import-lorebook`          | `ImportLorebookModal`         | Import from file                           |
| `import-preset`            | `ImportPresetModal`           | Import from file                           |
| `import-persona`           | `ImportPersonaModal`          | Import from file                           |
| `character-card-update`    | `CharacterCardUpdateModal`    | Agent-proposed card evolution review       |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Agent write consent and review             |
| `docs-viewer`              | `DocsViewerModal`             | In-app documentation browser               |
| `st-bulk-import`           | `STBulkImportModal`           | Bulk import from SillyTavern data          |
| `about-me-viewer`          | `AboutMeViewerModal`          | View a Conversation-mode About Me          |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Scene prompt preference settings           |

Modal pattern: all modals accept `{ open, onClose }`, wrap content in the `Modal` base component, use mutations for API calls, and show loading state from `mutation.isPending`.

### Panel system (`components/panels/`)

Right-side panels show resource lists with search, sort, and filtering. Clicking a resource opens its full editor in the center pane.

Panels are registered in `RightPanel.tsx` in two places:

1. `PANEL_CONFIG`: title, icon, and gradient color.
2. `PANELS`: the component map.

Panels use module-level persistence. A `mountedPanels` Set tracks which panels have been visited. Once mounted, a panel stays in the DOM (hidden with `display: none` or `aria-hidden`) to keep its state.

### UI primitives (`components/ui/`)

| Component          | Description                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Base modal with backdrop click, escape key, enter and exit animations |
| `ColorPicker`      | Solid color or gradient picker with preset swatches                   |
| `ExpandedTextarea` | Full-screen portal overlay for editing large text blocks              |
| `EmojiPicker`      | Searchable emoji popover (portal-rendered)                            |
| `GifPicker`        | GIF search via the Giphy API                                          |
| `HelpTooltip`      | Hover icon that shows a portal-positioned tooltip                     |

All UI components use controlled props (value plus onChange) and portal rendering for overlays.

## API client (`lib/api-client.ts`)

All server communication uses the `api` object:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Method                         | Signature           | Description                           |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Fetch JSON                            |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Send JSON, receive JSON               |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Full update                           |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Partial update                        |
| `api.delete(path)`             | `DELETE /api{path}` | Delete resource                       |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Multipart file upload                 |
| `api.download(path, filename)` | `GET /api{path}`    | Download plus save-as dialog          |
| `api.stream(path, body)`       | `POST /api{path}`   | SSE async generator (tokens only)     |
| `api.streamEvents(path, body)` | `POST /api{path}`   | SSE async generator (all event types) |

Errors throw `ApiError`, which carries `status` and `message` properties.

## Styling system

### Tailwind CSS v4

The project uses Tailwind CSS v4 with the `@tailwindcss/vite` plugin (no PostCSS config needed). Theme tokens map from CSS custom properties in `globals.css`:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Theme architecture

`globals.css` is organized into labeled sections. These include the Tailwind `@theme` mapping, dark theme variables, light theme overrides, base reset, custom cursors, scrollbars, glass panels, glow utilities, UI components, and keyframe animations. Other sections cover chat animations, per-mode chat styling, sprites and game HUD, function-call cards, responsive rules, the imported SillyTavern theme, accessibility rules, and performance hints.

### Custom themes

Users can create custom themes. Theme definitions are stored on the Marinara server and sync across connected devices. The active custom theme is shared too. The CSS is injected as a `style` tag by `CustomThemeInjector.tsx`.

Synced theme CSS can request the built-in Accent Pulse engine with `--marinara-theme-accent-pulse: enabled`. Add `--marinara-theme-accent-pulse-source: #a78bfa` (or a gradient) when the pulse should use a specific theme accent instead of the current Appearance accent.

## Shared package (`packages/shared`)

The frontend imports types, schemas, and constants from `@marinara-engine/shared`.

### Constants

Key files in `packages/shared/src/constants/`:

- `defaults.ts`: exports such as `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES`, and `LIMITS`. This is the version source and holds default generation settings.
- `providers.ts`: exports `PROVIDERS`, the API provider configs (OpenAI, Anthropic, Google, and more) with URLs and auth.
- `model-lists.ts`: static model catalogs per provider, plus `IMAGE_GENERATION_SOURCES` for image generation providers.
- `agent-prompts.ts`: base-only summary and secret-plot prompts plus runtime lookup for prompts supplied by installed agent packages.

### Schemas (Zod)

All input validation uses Zod schemas from `packages/shared/src/schemas/`. Representative files:

| Schema file             | Entities                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | AgentConfig create and update, agent phases, result types          |
| `character.schema.ts`   | Character card, extensions, character books, groups                |
| `chat.schema.ts`        | Chat create, message create, generation request                   |
| `connection.schema.ts`  | API connection create and update                                   |
| `custom-tool.schema.ts` | Custom tool definitions                                            |
| `lorebook.schema.ts`    | Lorebook and entry create/update, activation conditions, schedules |
| `prompt.schema.ts`      | Preset, section, group, choice block, generation parameters        |
| `regex.schema.ts`       | Regex script create and update                                     |

The folder also holds schemas for app settings, chat presets, conversation calls, custom emojis and stickers, extensions, Noodle, and themes.

### Types

Entity type definitions live in `packages/shared/src/types/`. A sample of the key files:

| Type file             | Key interfaces                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `CharacterExtensions`, `RPGStatsConfig`                    |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Utilities

| File              | Purpose                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: replaces macros such as `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}`, and `{{getvar::name}}`     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: converts a display name to an XML tag slug ("World Info (Before)" becomes "world_info_before")                           |

## API endpoints

The server (`packages/server`) exposes REST APIs under `/api`. This is a high-level map, not the exhaustive list. The file `packages/server/src/routes/index.ts` and the individual route files are the source of truth.

### Core resources

| Prefix               | Methods                  | Description                                                                                |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | Character CRUD, groups, export (JSON or PNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | Chat CRUD, messages, metadata, connect and disconnect                                     |
| `/api/prompts`       | GET, POST, PATCH, DELETE | Preset CRUD, sections, groups, choice blocks, export                                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | API connection CRUD, duplicate, test                                                      |
| `/api/agents`        | GET, POST, PATCH, DELETE | Agent CRUD, echo messages, runs; built-in toggles use `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | Lorebook CRUD, entries, export                                                            |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | Custom tool CRUD                                                                          |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | Regex script CRUD                                                                         |

Agent memory tools use `/api/agents/memory/:agentType/:chatId`, where `agentType` is the agent type string and `chatId` is the target chat id.

### Generation

| Endpoint                     | Method | Description                                          |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Main SSE generation with the agent pipeline          |
| `/api/generate/retry-agents` | POST   | SSE retry for the agent types supplied by the caller |

### Chat features

| Prefix                    | Endpoints                        | Description                  |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD plus reorder                | Chat folder management       |
| `/api/conversation`       | schedule, status, message, check | Autonomous messaging system  |
| `/api/scene`              | create, plan, conclude           | Scene branching              |
| `/api/encounter`          | init, action, summary            | Combat encounters            |
| `/api/translate`          | POST                             | Text translation             |
| `/api/game`               | CRUD and actions                 | Game Mode sessions and state |
| `/api/game-assets`        | CRUD and upload                  | Game assets                  |
| `/api/turn-games`         | Chess, UNO, Poker routes         | Conversation table games     |
| `/api/conversation-calls` | call and session routes          | Conversation audio calls     |

### Media and assets

| Prefix                        | Description                  |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Avatar image serving         |
| `/api/backgrounds`            | Background CRUD plus upload  |
| `/api/sprites/:characterId`   | Sprite expression management |
| `/api/fonts`                  | Custom font management       |
| `/api/gallery/:chatId`        | Per-chat gallery images      |
| `/api/global-gallery`         | Global gallery images        |
| `/api/tts`                    | Text-to-speech routes        |
| `/api/youtube`                | YouTube DJ routes            |
| `/api/custom-emojis`          | Custom emoji assets          |
| `/api/custom-stickers`        | Custom sticker assets        |
| `/api/gifs/search`            | GIF search (Giphy proxy)     |

### External integrations

| Prefix                          | Description                  |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Chub character search        |
| `/api/bot-browser/chartavern/*` | CharacterTavern search       |
| `/api/bot-browser/janny/*`      | JannyAI search               |
| `/api/bot-browser/pygmalion/*`  | Pygmalion search             |
| `/api/bot-browser/wyvern/*`     | Wyvern search                |
| `/api/bot-browser/datacat/*`    | DataCat search               |
| `/api/haptic/*`                 | Haptic device control        |
| `/api/spotify/*`                | Spotify auth                 |
| `/api/knowledge-sources`        | Knowledge base for retrieval |

### System

| Endpoint                        | Description                             |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Version check against GitHub releases   |
| `/api/updates/latest`           | Latest release metadata                 |
| `/api/updates/commits-behind`   | Git install update distance             |
| `/api/backup`                   | Full backup, export, import             |
| `/api/import/*`                 | SillyTavern and Marinara profile import |
| `/api/admin/clear-all`          | Full data clear                         |
| `/api/themes`                   | Synced custom themes                    |
| `/api/extensions`               | Installed extensions                    |
| `/api/app-settings`             | Server-side app settings                |
| `/api/sidecar`                  | Local model runtime                     |
| `/api/chat-presets`             | Chat settings presets                   |
| `/api/connection-folders`       | Connection folders                      |
| `/api/prompt-overrides`         | Built-in prompt overrides               |
| `/api/achievements`             | Achievement unlocks                     |
| `/api/noodle`                   | Noodle social timeline                  |
| `/api/professor-mari/workspace` | Professor Mari workspace operations     |

## PWA support

The app is a Progressive Web App configured with VitePWA:

- Manifest: `public/manifest.json` with the "Marinara Engine" app name, standalone display mode, and dark theme.
- Icons: a 64px favicon, 192px and 512px maskable icons, and a splash logo.
- Service worker: Workbox with an auto-update strategy.
- Caching: static assets are cached; `/api/*` routes use NetworkOnly.
- Keep-alive: `lib/keep-alive.ts` uses the Web Locks API plus BroadcastChannel pings to keep the tab from sleeping.

### Version skew detection

`App.tsx` polls `/api/health` every 5 minutes. If the server version differs from the client's cached version, the client unregisters the service worker. It also clears the caches to force an update.

## Agent system

The agent system processes AI responses through configurable pipelines. Agents run in three phases:

1. Pre-generation: before the main LLM call (for example, context injection or knowledge retrieval).
2. Parallel: alongside the main generation (for example, world-state tracking or combat).
3. Post-processing: after the main response (for example, prose rewriting or lorebook updates).

Retry requests go through `/api/generate/retry-agents` with an explicit `agentTypes` list. A broad UI action like **Re-run Trackers** passes all active tracker types. An individual widget control passes only its target tracker.

Agent memory tools, such as the Narrative Director Secret Plot panel, use `/api/agents/memory/:agentType/:chatId`. The route applies to configured agents that store per-chat memory. Secret Plot memory is stored under `director` in current configs, while `secret-plot-driver` remains accepted for legacy chats.

### First-party downloadable agents

The lightweight Engine ships with an empty runtime agent registry. Packages installed from the public [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) catalog contribute validated agent manifests, client/server feature entrypoints, and UI slots at runtime. The active definitions are exposed through `BUILT_IN_AGENTS` for compatibility, but they come from installed packages rather than bundled implementations. The official catalog contains these packages:

| Agent                    | Phase           | What it does                                                      |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Enforces writing quality (anti-repetition, show-don't-tell)       |
| `continuity`             | post_processing | Detects continuity issues and can produce rewrite guidance        |
| `director`               | pre_generation  | Injects narrative directions and optional Secret Plot state       |
| `echo-chamber`           | parallel        | Simulates audience reactions                                      |
| `world-state`            | post_processing | Extracts date, time, location, and weather from the narrative     |
| `expression`             | post_processing | Selects character sprite expressions                              |
| `quest`                  | post_processing | Tracks quest creation, updates, and completion                    |
| `background`             | post_processing | Selects fitting background images                                 |
| `character-tracker`      | post_processing | Tracks character state changes                                    |
| `persona-stats`          | post_processing | Tracks player persona stat changes                                |
| `custom-tracker`         | post_processing | Tracks user-defined structured state                              |
| `illustrator`            | post_processing | Generates scene image prompts and media requests                  |
| `lorebook-keeper`        | post_processing | Auto-creates and updates lorebook entries                         |
| `card-evolution-auditor` | post_processing | Audits character cards for suggested evolution                    |
| `combat`                 | parallel        | Tracks combat rounds, HP, initiative, and outcomes                |
| `html`                   | post_processing | Rewrites finished Roleplay responses to add diegetic HTML visuals |
| `spotify`                | post_processing | Controls Music DJ playback (Spotify, YouTube, or local music)     |
| `knowledge-retrieval`    | pre_generation  | Retrieves context from knowledge sources                          |
| `knowledge-router`       | pre_generation  | Routes relevant lorebook and knowledge entries                    |
| `haptic`                 | post_processing | Sends haptic device commands                                      |
| `cyoa`                   | post_processing | Generates choice prompts                                          |
| `conversation-calls`     | feature         | Adds Conversation audio/video calls and related settings          |
| `hierarchical-maps`      | feature         | Adds Roleplay/Game maps, spatial context, and movement             |
| `uno`                    | feature         | Adds the Conversation UNO table                                   |
| `chess`                  | feature         | Adds the Conversation Chess board                                 |
| `poker`                  | feature         | Adds the Conversation Texas Hold'em table                         |
| `eightball`              | feature         | Adds the Conversation 8-Ball Pool table                           |
| `tic-tac-toe`            | feature         | Adds the Conversation Tic-Tac-Toe board                           |
| `rock-paper-scissors`    | feature         | Adds Conversation Rock-Paper-Scissors matches                     |

### Agent result types

Agents produce typed results that the frontend handles. The `AgentResultType` union in `packages/shared/src/types/agent.ts` includes:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update`, and `about_me_update`.

## Chat modes

### Conversation mode

Plain dialogue with one or more AI characters. Characters can have different statuses (online, idle, do not disturb, offline) that influence response timing and style. Built-in agents are added per chat rather than enabled globally.

### Roleplay mode

An immersive narrative experience with game-state tracking: scene context (location, time, weather), character presence and mood, player stats, inventory and quests, combat encounters, world info from lorebooks, and sprite expressions.

### Game Mode

AI Game Master sessions with party members, dice, game state, assets, storyboards, a journal, and a structured session lifecycle. Game Mode uses dedicated stores and routes for game state, assets, table games, scene videos, and storyboards. See [Game Mode: Getting Started](../game/getting-started.md) for the user-facing workflow.

## Development

### Commands

Install dependencies:

```bash
pnpm install
```

Start the server and client with hot reload:

```bash
pnpm dev
```

Run the client dev server only:

```bash
pnpm dev:client
```

Run the API server only:

```bash
pnpm dev:server
```

Run the baseline validation (TypeScript plus ESLint):

```bash
pnpm check
```

Build for production:

```bash
pnpm build
```

### Bundle budget

- Main entry: max 1 MB.
- Per chunk: max 500 KB.
- Vendor splits: react, tanstack, motion, zustand, icons, and misc.

### Path alias

`@/*` resolves to `./src/*` in both the TypeScript and Vite configs.

## Related guides

- [Architecture Map (Developers)](architecture-map.md)
- [File-Native Storage (Developers)](file-storage.md)
