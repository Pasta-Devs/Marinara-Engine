# Optional Agent and Capability Packages

Status: implemented for the v2.3.0 development cycle in issue #3612.

## Objective

Marinara Engine's base distribution must not compile or ship optional agent and capability implementations. Fresh installations start with no optional packages. Upgrades preserve capabilities that were available before this package system was introduced.

The official catalog, package sources, reproducible artifacts, validation scripts, and contribution workflow live in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Installed artifacts live beneath the configured Marinara data directory so application updates cannot overwrite them.

## Package model

An agent package may contribute one or more declarative agents and optional trusted executable capabilities:

- server entry points for routes, lifecycle hooks, prompt providers, result handlers, and storage migrations;
- client entry points for panels, chat surfaces, settings sections, setup choices, runtime displays, and full Game-mode surfaces;
- shared JSON schemas and stable wire contracts;
- package-owned assets, documentation, and Professor Mari knowledge fragments.

Packages target a versioned Marinara capability API. They must not import private source paths from the engine.

Client capability elements receive the Engine's selected UI locale through their `lang` and `dir` attributes and the
`capabilityProps.localization` object. Package-owned interfaces keep their own locale files and fall back to package
English; the Engine does not translate package prompts or package-authored machine values. Locale changes reuse the
existing `marinara-capability-props` event so an installed interface can rerender without an Engine restart.

### Delivery and caching

Installed package files are served with strong validators derived from the manifest's per-file
SHA-256 hashes — the same values the Engine re-verifies the bytes against on every read. The
client bundle (`/api/capability-packages/<id>/client`) and every package asset always revalidate
(`no-cache` plus an `ETag`), so an unchanged file answers `304 Not Modified` instead of
re-downloading, while a republished file is picked up immediately. Nothing is served `immutable`:
install policy permits republishing the same version with different bytes, so no package URL is
content-addressed.

Capability API 1.1 adds a generic runtime facade to the server activation context.
Packages can read the effective agent-debug state and write through the Engine's
Pino logger, including explicit debug-mode overrides, without importing the
private logger or runtime-configuration modules. The facade exposes operations,
not the underlying Engine objects.

Capability API 1.2 adds transaction-scoped chat/message operations, narrow
chat-metadata writes and lore-entry existence reads, and the spatial snapshot
compatibility store. Packages can validate domain changes inside an Engine
transaction and atomically commit metadata with an owner message, swipe, or spatial
snapshot without receiving a database handle or table object. Engine retains
rollback and historical-storage compatibility; packages retain validation and
domain policy. The same API exposes normalized chat and character records, eligible
lore-entry selection, JSON-ish response parsing, and resolved language-model calls.
Connection credentials, provider implementations, database handles, and storage
objects remain private to Engine.

### Host client namespace

The Engine owns its client state and its libraries, and agent package clients use them instead of bundling copies. A
copy keeps state of its own: package clients that bundled the UI settings store saved an older version of it over the
Engine's settings on every load (Pasta-Devs/Marinara-Agents#1478), and each bundled chat store kept the chat that was
open when the page loaded.

Before the Engine imports the first package client, it defines one global:

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

The property is not writable or configurable, and the namespace and its `stores`, `services`, `modules`, `components`
and `data` objects are frozen. The package loader (`useCapabilityClientModules`) loads `lib/marinara-host.ts` with
`import()` and awaits `ensureMarinaraHost()` before it imports any package client, so the namespace is complete when a
package module is evaluated. An Engine with no package clients never loads it. If it cannot load (a stale chunk after an
update, for example), each package shows its existing load error and the rest of the Engine keeps working. The
TypeScript type is `MarinaraHostV1` in `packages/client/src/lib/marinara-host-contract.ts`, together with the lists on
this page. Package builds declare matching structural types instead of importing Engine source.

| Member                    | Value                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                 | `1`. It changes only when the shape breaks.                                                                                                                                              |
| `capabilityApi`           | The Engine's `supportedCapabilityApi`, for example `{ major: 1, minor: 341 }`.                                                                                                           |
| `stores`                  | The live zustand stores `ui`, `chat`, `agent`, `sidecar`, `dialog`, `gallery`, `encounter`, `gameState` and `backfill`. `chat` includes the pending spatial transition slice.            |
| `services.tts`            | The `lib/tts-service.ts` module (`ttsService`, `playWhenAvailable`, ...).                                                                                                                |
| `services.audio`          | From capability API 1.381, the `lib/audio-service.ts` module: independent music/SFX players, the shared asset manifest and default music selection. See [Package audio](#package-audio). |
| `services.dialogs`        | The `lib/app-dialogs.ts` module (`showAlertDialog`, `showConfirmDialog`, `showPromptDialog`, `showChoiceDialog`).                                                                        |
| `services.imageDownloads` | From capability API 1.385, the gallery's existing `downloadUrlToDevice`, `shouldUseIosImageShare`, `prepareImageSave` and `savePreparedImageToDevice` helpers.                           |
| `modules`                 | Library modules, keyed by bare specifier (below).                                                                                                                                        |
| `queryClient`             | The one React Query `QueryClient` the Engine renders with.                                                                                                                               |
| `components.Modal`        | The Engine's `Modal`, with its overlay order, Escape and back-button handling.                                                                                                           |
| `data.emojiCatalog`       | The `lib/emoji-catalog.generated.ts` module.                                                                                                                                             |
| `api`                     | The `lib/api-client.ts` module (`api`, `ApiError`, `getApiErrorMessage`, ...).                                                                                                           |

A package reads a member only after checking it, for example
`const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`.
For image downloads, use `shouldUseIosImageShare()` to follow the gallery's platform policy. On iPhone,
prepare the image with `prepareImageSave(url, filename)` before the user's save gesture, then call
`savePreparedImageToDevice(prepared)` directly from that gesture. It handles cancelled sharing silently and
does not replace a failed share with a WebKit download preview. Other platforms use `downloadUrlToDevice`.
These helpers save to the client device, including when the Engine server runs in Docker.
The namespace only grows: a new member comes with a capability API minor, and a package that needs it requires that
minor. Packages built for the namespace require the capability API version that added it, so an older Engine never
installs them and keeps the version it has. When a member is missing anyway, the package never falls back to a bundled
copy of a stateful Engine service: the `ui` and `chat` stores become read-only copies that never write, and every other
member reports that the feature needs a newer Marinara Engine.

**Host modules.** `modules[specifier]` is a complete module namespace, including `default` where the library has one.
`MARINARA_HOST_MODULE_IMPORTS` in the client contract maps each public slot to the dependency it imports. Most map
to themselves. The stable `framer-motion` slot maps to `framer-motion-v13` (an exact npm alias of Motion 13.5.1),
while the opt-in `motion/react` slot maps to the Engine's primary `framer-motion` 14 dependency. Package tooling uses this mapping for both its export inventory and TypeScript paths; public slot names need not be physical dependencies. The specifiers are `react`, `react/jsx-runtime`, `react-dom`,
`react-dom/client`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `sonner`, `zod`, `i18next`,
`react-i18next`, `framer-motion`, `motion/react`, `tailwind-merge` and `clsx`. A package build resolves these specifiers to shims that
read the namespace, so the package renders with the Engine's one React and shares its React Query cache and toasts.

- Packages never render a `<Toaster>` and never create a `QueryClient`. A `toast` from `sonner` shows at the user's
  toast position. The Engine's query defaults (30-second `staleTime`, one retry, no refetch on window focus) apply
  unless a query sets its own options, and a new package-owned query key starts with the package id.
- A package keeps its own i18next instance from `i18next.createInstance()` inside `<I18nextProvider>`. It never uses
  `initReactI18next`, `setI18n` or `setDefaults`, which would replace the Engine's instance.
- `lucide-react`, `chess.js`, `scheduler` and `@marinara-engine/shared` are not host modules; packages bundle what they
  use of them.
- Packages are built against these majors: `react` 19, `react-dom` 19, `@tanstack/react-query` 5, `zustand` 5,
  `sonner` 2, `zod` 3, `i18next` 26, `react-i18next` 17, `framer-motion` 13, `motion` 14 (the `motion/react` slot),
  `tailwind-merge` 3 and `clsx` 2. Replacing the major behind an existing public slot requires a capability API **major**.
  Adding a distinct slot is additive: capability API 1.377 adds `motion/react` without changing `framer-motion`.
  `scripts/regressions/marinara-host-namespace.regression.ts` pins each slot's mapped dependency and major.
- The Engine validates its own data with native Zod 4. Existing packages keep Zod 3 through the explicit
  `zod-v3` compatibility dependency, both in the client `zod` slot and in package-server imports. This preserves
  their existing records, defaults and module exports. The alias carries the reviewed bounded-collection security
  backport in `patches/zod@3.25.76.patch`; it is not stock Zod 3. These legacy package validators retain Zod 3
  behavior apart from that documented security repair. The core upgrade does not apply Zod 4's other validation
  changes to them.
- Existing installed packages keep their full Motion 13 namespace and do not need rebuilding. A package choosing
  Motion 14 imports `motion/react` through the host shim and declares capability API 1.377 or newer. Older hosts
  reject that declaration rather than silently substituting Motion 13. Keep each animation tree on one version:
  `AnimatePresence`, `MotionConfig`, `LayoutGroup`, motion values and their consumers must come from the same slot.
  The versions have distinct contexts; no context bridge is provided. Package views mount their own React roots,
  while the host `Modal` uses CSS animations. Do not expect shared layout or presence across the version boundary.

**Store fields packages read.** Published packages read these fields today. The Engine keeps each of them, and
dropping or renaming one needs a capability API major (`MARINARA_HOST_STORE_FIELDS` pins them with `Pick<>`):

| Store       | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui`        | `achievementsEnabled`, `debugMode`, `includeReasoningInExports`, `enableStreaming`, `userStatus`, `enterToSendConvo`, `conversationCallVoiceVolume`, `conversationCallVoiceMuted`, `setConversationCallVoiceVolume`, `setConversationCallVoiceMuted`, `conversationTimeZone`, `noodleNavigation`, `setNoodleNavigation`, `noodleSelectedPersonaId`, `setNoodleSelectedPersonaId`, `reviewImagePromptsBeforeSend`, `musicPlayerEnabled`, `musicPlayerSource`, `sidebarOpen`, `setSidebarOpen`, `chatBackground`, `setChatBackground`, `characterDetailId`, `lorebookDetailId`, `presetDetailId`, `connectionDetailId`, `agentDetailId`, `toolDetailId`, `personaDetailId`, `regexDetailId`, `characterLibraryOpen`, `botBrowserOpen`, `gameAssetsBrowserOpen`, `modal`, `rightPanelOpen`, `closeModal`, `closeRightPanel`, `closeBotBrowser`, `closeAllDetails` |
| `chat`      | `activeChatId`, `activeChat`, `isStreaming`, `streamingChatId`, `abortControllers`, `reset`, `pendingSpatialTransitions`, `setPendingSpatialTransition`, `clearPendingSpatialTransition`, `setPendingSpatialTransitionStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `agent`     | `setYoutubePlay`, `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sidecar`   | `modelDownloaded`, `modelDisplayName`, `fetchStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `dialog`    | `dialog`, `openDialog`, `closeDialog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `gallery`   | `pinImage`, `pinVideo`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `encounter` | `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `gameState` | `current`, `setGameState`, `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `backfill`  | `resetBackfill`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Engine-owned browser storage.** Packages may read these keys and never write or remove them: `marinara-engine-ui`,
`marinara-engine-ui:host`, `marinara-active-chat-id`, `marinara-input-drafts` (local and session storage),
`marinara-pending-spatial-transitions`, `marinara-pinned-gallery-images` and `marinara_sidecar_prompted`. They never
open the IndexedDB database `marinara-tts-audio-cache`. To change a setting, a package calls the store's action, for
example `host.stores.ui.getState().setConversationCallVoiceMuted(true)`, and the Engine saves it.

**App dialogs.** The Engine renders its alert, confirm, prompt and choice dialogs on its topmost layer, the command
bar's, so a dialog a package opens shows above the package's own overlay and takes focus.

**Package builds from before the namespace.** They bundle their own copy of the UI store at version 74 and save over
`marinara-engine-ui` with only the settings that copy knows. The Engine also saves each write to a host-only
`marinara-engine-ui:host` copy, and when it loads, it ignores a stored blob older than its own version while that copy
is at the current version. The Engine still sets `globalThis.React` and `globalThis.ReactDOM` for installed bundles
that use the classic JSX runtime.

### Capability API 1.7 chat branches

Capability API 1.7 adds normalized branch metadata to `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` is the trimmed persisted branch name. Roots return `null`. Known
Engine-created branches expose the immediate parent chat, the source fork
message, and the copied child message. Empty branches use null message anchors.
Legacy branches, malformed metadata, and imported group siblings without a
known relationship return null lineage fields; Engine does not infer historical
relationships. Generic export/import omits parent and message IDs because IDs
change between installations. Parent deletion leaves child lineage untouched.

### Capability API 1.8 Game experiences

Capability API 1.8 adds package-provided Game experiences, per-turn Game prompt context, and resource writes.

A package may provide an entire Game mode rather than an addition to the built-in one. It declares the `game-surface` slot and is chosen while a game is created, from the Experiences block of the setup wizard; the choice is recorded on the game and fixed for its lifetime, so an experience is never switched on or off part-way through a run. The surface draws its own HUD, menus, and combat over the shared narration, and declares which built-in systems it replaces. Anything left undeclared stays built-in, so an experience opts out only of what it actually implements. The optional `contributions.gameSurface.surfaceClass` names a class the Engine applies to the game area while that surface is mounted, letting the package's stylesheet restyle the shared chrome that renders outside its own element.

Packages holding the `prompt-context` permission contribute text to the system prompt of each generated Game turn, so a package that owns live state can keep the model consistent with what the player is looking at. A contribution may also declare which built-in game systems it replaces, and Engine then stops instructing the model to drive them. Contributions are collected per turn and are never required: a contributor that returns nothing is skipped, and one that throws, or that does not settle within its deadline, is logged and skipped without affecting generation.

The resource facade exposes writes beside its reads, so a package's setup flow can find-or-create the player persona and its lorebook. Engine retains storage, validation, and identity; packages retain domain content.

### Capability API 1.10 package assets

Capability API 1.10 adds general package-owned static asset delivery. A manifest may declare
`contributions.assets.paths` — an allowlist of up to 256 image (`png`/`webp`/`gif`/`jpg`/`jpeg`)
and JSON files shipped inside the package — and the Engine serves them over
`/api/capability-packages/<id>/assets/<path>` through the exact verification chain browser-tab
icons already use: path containment, `files[]` hash membership, a passive content-type allowlist,
and integrity re-verification on every read. Active document types (SVG, HTML, scripts) are
rejected by the schema; every declared path must be hash-pinned in `files[]`; and the in-package
`manifest.json` is never servable, even if declared. Declaring `contributions.assets` requires a
`schemaVersion` 2 manifest with `capabilityApi` 1.10 or newer — a v1 manifest cannot declare it
at all. Assets always revalidate — like the client bundle they carry a strong manifest-hash
`ETag` and answer an unchanged revalidation with `304 Not Modified` and no body, so a shipped
tileset re-downloads only when its bytes actually change. (Responses are deliberately never
`immutable`: install policy permits republishing the same version with different bytes, so a
version-tagged URL is not content-addressed.) This is what lets a `game-surface` Experience ship
real art instead of inlining it into its client bundle.

A manifest that violates these rules is rejected at install with one of: "A declared package
asset must be listed in the package file manifest", "contributions.assets requires schemaVersion
2 and capabilityApi 1.10 or newer", the schema's extension error for a non-image/JSON path, or —
for archives whose filenames differ only by case, which case-insensitive filesystems would
collapse onto one file — "Package contains duplicate file" / "Package manifest declares files
that collide on case-insensitive filesystems".

Every capability element receives its own identity for this purpose: `capabilityProps.packageId`
and `capabilityProps.packageVersion` arrive alongside `localization`, so a bundle builds its
asset URLs as `/api/capability-packages/<packageId>/assets/<path>` (optionally keyed with
`?v=<packageVersion>` so a version bump busts any intermediary cache) without re-fetching the
installed list or scraping its own import URL.

### Capability API 1.11 Experience combat seam

Capability API 1.11 adds a combat seam to the `game-surface` capability props. `combatActive`
reports the instant the built-in combat UI actually mounts — unlike `chatMeta.gameActiveState`,
the GM's narrative scene state, which lags the flip and can say "combat" without any encounter
existing — and `combatStyle` carries the effective style (`classic` or `tactical`).
`requestCombat()` asks the Engine to generate an encounter through the exact pass the manual
Start Combat button uses, minus the confirm dialog, since the Experience's own interface already
expressed the intent; the Engine's generation pass still decides what the encounter is.
Deliberately absent: any way for a package to supply combatants or combat state directly —
combat stays Engine-owned.

`requestCombat()` is identity-stable, silent on the package path, and returns a code the
Experience renders its own feedback from: `"started"`, or a refusal — `"combat-active"`,
`"pending"` (a generation is already in flight), `"no-turn"` (the GM has not written a turn
yet), or `"unavailable"` (concluded session or replay). `combatPending` and `combatError`
mirror the generation's progress and failure so a package is never left waiting on
`combatActive` after a failed generation. Like the 1.7/1.8 seams (and unlike the hard-gated
1.10 `contributions.assets`), these props are delivered to every `game-surface` package
regardless of the `capabilityApi` it declares — the 1.11 label marks when they appeared, so a
package that _requires_ them declares 1.11 and older Engines refuse it cleanly.

### Capability API 1.12: spatial events for the owning Experience

Capability API 1.12 addresses the spatial capability events to the game-owning Experience
package as well. `spatial_transition_committed`, `spatial_transition_rejected`, and the
untyped `spatial_context_refresh` nudge — previously addressed only to `hierarchical-maps` on
the `marinara-capability-server-event` window event — are now dual-dispatched with
`packageId` set to the chat's `gameExperienceId`. Payloads differ per event: a committed
event carries `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; a
rejected event carries `{ chatId, commandId, code?, message? }` (no location fields — the
move did not happen); the refresh nudge carries `data: null`. An Experience that sent a
travel command via `sendMessage`'s `pendingSpatialTransition` argument can therefore confirm
or clear its journey the moment the host knows, instead of inferring the outcome from later
state reads. 1.12 also closes a gap that affected World Maps itself: transitions rejected on
either silent HTTP path — the pre-stream owner-turn commit inside a generation, or the
standalone REST commit — previously produced no event at all; both now synthesize
`spatial_transition_rejected`, and only on definitive evidence (a `spatial_*` error code
other than `already_applied`). Inconclusive failures — a network error that may have lost a
successful commit — deliver the untyped `spatial_context_refresh` nudge instead, so listeners
reconcile from server state rather than a fabricated verdict. Note that a committed event
whose `travel.mode` is `"step_by_step"` with `complete: false` means the journey continues —
keep your pending state until the completing event. This is a soft seam like 1.11: events are
delivered regardless of the declared `capabilityApi`; declare 1.12 only if your package
requires them.

### Capability API 1.13: transient narration collapse

Capability API 1.13 adds `requestsCollapsedNarration` to the chrome declaration a
`game-surface` package passes to `setExperienceChrome`. While the flag is true the Game Mode
narration box folds down to its slim handle, so an Experience can clear the screen for a
cutscene or a full-screen beat.

It is a REQUEST, not a preference. The player's own collapse setting is never written, and
the flag is honored only while your Experience is the live surface — drop the flag, or stop
being the active surface, and the box returns to whatever the player chose. That is the
"always reopens afterwards" guarantee; there is deliberately no way to persist a collapse
from a package.

The Engine's safety rules outrank the request. The box force-expands whenever the player's
text input is on screen (including at the very start of a scene, before any segment exists)
and whenever the segment-advance controls are live, because those controls are the only way
to finish a turn — a package that could hide them could strand the player permanently. The
handle also keeps raising its attention indicator for a pending scene-analysis, generation,
or combat-generation retry. A player who expands the box by hand during a request keeps it
open until the request drops. Like the 1.11/1.12 seams, this is a soft seam: the field is
honored regardless of the declared `capabilityApi`, and the 1.13 label marks when it
appeared, so a package that _requires_ it declares 1.13.

### Capability API 1.14: tracker surfaces and agent lifecycle

Capability API 1.14 adds two `contributions.slots` values for active, enabled Roleplay
agent packages with a client entrypoint:

- `roleplay-tracker` mounts the package's `toolbar` view in the Roleplay HUD. Its props
  include `chatId`, `chatMode`, `mobileCompact`, the host's `toolbarButtonClass`,
  `onRerunTracker`, `trackerRetryBusy`, `lockMode`, and `onToggleLockMode`. The callbacks
  are optional: check that they exist before using them.
- `tracker-panel` mounts the package's `tracker` view inside the existing Tracker Panel,
  with `chatId`, `chatMode`, and `detached`. Reuse that host surface rather than opening
  a second panel. Both slots also receive the ordinary capability identity and localization props.

Prompt-context contributions remain registered through `api.registerPromptContext` and
require `prompt-context` permission. The request now exposes `targetCharacterIds`,
`personaId`, and `placedAgentTypes` (optional for compatibility). `placedAgentTypes` tells
the contributor which agent-data sections the preset already placed, so it can avoid
duplicating its context. The host retains each contribution's package identity in
`packageBlocks` to place package-owned text at the corresponding agent section. A
contributor returning audience-specific text should respect the supplied target character IDs.

A server entrypoint may also register its own post-processing lifecycle service through
`api.registerService("agent-runtime:<package-id>", service)`. It needs the `agent-runtime`
permission; registration for another package ID is rejected. The optional hooks are:

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` runs before post-processing; its non-null result is scoped to the agent
and included in its prompt as serialized runtime context. `finalizeResult` receives that
value plus the generated result, and returns an `AgentResult`. The generation and manual
retry paths defer result publication until finalization. Each asynchronous hook has a
two-second deadline: a failed preparation is logged and skipped, while a failed finalization
turns the result into a failure instead of applying unvalidated output. These are short
host lifecycle hooks, not a place for an additional slow model call.

There is no per-field 1.14 version gate for these additions. A package may feature-detect
optional props and degrade on older Engines, but one that requires the slots, placement,
or lifecycle behavior must declare `capabilityApi: { major: 1, minor: 14 }` in its v2
manifest so an older Engine refuses installation cleanly.

### Capability API 1.15: current embedding configuration

`api.runtime.resolveEmbeddings()` returns a fresh `Promise<CapabilityEmbeddingHost>` using
the package's current agent connection configuration. Call it when starting an embedding
operation, rather than caching `api.runtime.embeddings`, which is the activation-time
snapshot and will not follow later connection changes without reactivation.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

The returned host has `spaceId`, `label`, and `embed(texts, signal?, inputType?)` (see
capability API 1.68 for the input type). Resolution uses the configured embedding source
and falls back to the built-in local MiniLM embedder when none is available or
configuration resolution fails. `embed` can return `null`; empty
batches, more than 128 texts, or more than 200,000 combined characters are refused. A
new host does not re-embed existing vectors, so a package must handle a changed `spaceId`
before comparing new vectors with stored ones.

The method is exposed regardless of the package's declared API version on current Engines.
Declare API 1.15 if following connection changes is required. A package deliberately
supporting older Engines may check `typeof api.runtime.resolveEmbeddings === "function"`
and fall back to `api.runtime.embeddings`, accepting its activation-time limitation.

### Capability API 1.16: package-declared Game Master verbs

Capability API 1.16 lets an Experience package declare a short, closed list of named Game Master
actions — verbs — that the Engine renders into the GM's format reminder, scans back out of the
finished narration, and executes on the package's behalf. No package server code runs for any of
it, so a `game-surface` Experience with only `agents` and `client` entrypoints can still have the
GM change its world in prose.

The whole seam is live: the schema, the reserved-name and key-ownership rules, the table reader, the
prompt render and the executor. A package that ships a table and holds `chat-write` gets its verbs
rendered into the GM's reminder on every Game turn of a chat bound to it, and executed when the GM
uses one. A chat bound to no package, or to a package that declares no table, resolves zero verbs
and its turn is byte-identical to one from before this seam existed.

A package declares its table as `gm-verbs.json`, listed in `contributions.assets.paths` and
hash-pinned in `files[]` like any other asset. Discovery is by that reserved filename, which is a
new convention rather than an existing one: every other file in the package pipeline is a declared
path read by name (`entrypoints`, icon paths, asset paths), and nothing else is found by shape. Two
consequences of the asset route are worth stating plainly. A file shipped in `files[]` but left out
of `contributions.assets.paths` is silent in both directions — install and catalog build stay clean
and the package simply has no verbs, with no diagnostic anywhere. And a declared asset is served
unguarded over `/api/capability-packages/<id>/assets/gm-verbs.json`, because the asset route has no
privileged-access check, so a verb table must never carry anything sensitive. Like the 1.11–1.13
seams this is a soft seam: an older Engine sees an ordinary JSON asset and ignores it, so a package
can ship a table without narrowing its install range — declare `capabilityApi` 1.16 only if your
package _requires_ the verbs to run, since doing so refuses the install on every Engine older than
this one.

The document is `{ "schemaVersion": 1, "verbs": [ … ] }` with one to sixteen verbs. Each verb is
strict: an unknown key inside one is a refusal, not a silent extra. Unknown fields beside
`schemaVersion` and `verbs` are handled differently by the two surfaces, on purpose: the Engine's
own read strips them, so a table written for a newer Engine still yields the verbs this one
understands, while the shared document schema an authoring tool would validate against is strict and
refuses them. Validating your table against the schema is therefore stricter than the Engine is at
runtime, which is the direction you want while you are writing one:

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

A verb name is `[a-z][a-z0-9_]*`, at most 32 characters, and may not be one of the Engine's own GM
bracket tags. That check is case-folded, because the reminder renders `[Note:` and `[Book:`
capitalized while the shipped parse regex is case-insensitive, so a lowercase `note` verb would
shadow the journal tag. The reserved set is derived from every tag the GM and party reminders can
render across all of their branches, and from every tag the Engine's five narration parsers match
back out of a finished turn — the client tag parser and the client narration formatter, the
server's segment editor, the sidecar scene analyzer, and the generate route's dialogue rewriter.
Their vocabulary is wider than any reminder renders: it includes the dialogue tokens `main`,
`side`, `extra`, `action`, `thought` and `whisper`, and the QTE pair `qte_bonus` / `qte_result`
that only the narration formatter matches. That last group is why the pin is worth the
trouble: a verb named `whisper` would have `[whisper:Tam]` cut out of a dialogue line before the
turn is saved, and the line would stop being a dialogue line for good. It is pinned by regression,
extractors included: each parser that supplies a name no other one does — the tag parser's
`party-chat` / `party-turn`, the formatter's QTE pair — has to keep supplying it, so a source
dropping quietly out of the sweep fails the build rather than narrowing the pin, and the three that
contribute nothing unique are swept anyway so that a tag arriving in one of them first is still
caught. What the pin does not promise is completeness: a built-in tag added to a file outside the
swept set, or spelled in a shape the extractor cannot read, would still be missed, so the set is
widened when a new parser appears rather than trusted to stay closed. Ordinary-looking words are
reserved for the same reason — `action`, `state`, `status` and `note` are all built-in tags — so a
refusal on a plain verb name is usually this rule rather than a typo. The `description` is one line
of 1–200 characters with no square brackets and no line breaks, because it is rendered verbatim into
the verb's line in the reminder's `COMMANDS:` block. "Line break" there is wider than CR and LF: it
counts `U+0085`, `U+2028` and `U+2029`, which end a line for anything that reads the block back, and
the description is refused for the C0 controls and DEL too — a tab being the likeliest — since those
reshape the block without ending a line at all. Verbatim into the block, but not past the reminder's
macro pass: the whole reminder is macro-expanded before it is sent, so `{{…}}` inside a description
is expanded rather than printed — including the macros that _write_ chat variables, such as
`{{setvar::…}}`. That is no more reach than the `chat-write` permission already grants a package,
but it is easy to trip into by accident, so keep macro braces out of a description unless you mean
them. A verb takes up to six arguments, each `{ name, type, enum?, maxLength?, optional? }`, named
`[a-z][a-zA-Z0-9_]*` up to 32 characters —
deliberately wider than a verb name, which allows no uppercase, because an argument name is a JSON
key rather than a bracket tag. Only a string argument may carry an `enum` (1–16 values, which must
be distinct — a repeated value adds nothing to a set, and is refused like every other duplicate in a
verb table); a string argument _without_ an enum must declare `maxLength` (1–500), since the
executor's scoped parse inherits no ceiling of its own and an uncapped free-text argument would
invite a whole narration fragment into the package; and an argument carrying both an `enum` and a
`maxLength` is refused, because the enum already bounds the value. Payloads are flat, single-line
JSON — a nested `}` ends the tag match early — and one instance per verb name per message is parsed,
so a repeated verb in one narration is applied once.

You do not have to spell any of that in the description. The reminder line is built from the parsed
table, so each verb renders as a schematic payload, then the description, then one copyable example:

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

The schematic is what teaches the vocabulary — every argument in declaration order, optional ones
marked `"name"?:` outside the JSON string, an enum as the full alternation, an un-enum'd string as
its cap, and a number or boolean unquoted, since the validator refuses `"3"` for a number rather
than coercing it. The example is one concrete instance and can only ever show a single enum value,
which is why it is not the teaching channel: a GM given nothing but `{"word":"fair"}` writes
"sunny", the validator refuses a word it was never shown, and the refusal is invisible — the tag is
stripped on the name match rather than on validation success, so the narration reads clean and the
world simply never changed. Deriving both from the same parsed table is also what stops them
drifting: a description cannot promise a value the validator refuses, because the description is no
longer where the values live. Spend the 200 characters on _when_ to use the verb, not on restating
its arguments.

Degradation is per verb. A verb this Engine cannot use — a newer `effect`, a shape it cannot
represent, or a declaration it refuses outright such as a reserved name or a key that is not the
package's — is dropped on its own with a log line while every verb it does understand still runs,
the same rule `parseCapabilityCatalogWithCompat` already uses for catalog entries. A refused verb
therefore fails quietly rather than loudly: read the log line if a verb you declared never appears.
A document that is unusable as a whole (a `schemaVersion` this Engine does not know, an empty
`verbs` array, not an object) yields an empty table and one log line. The table is also refused on
its _declared_ `files[].bytes` before it is ever read, at 64 KB, since `files[]` permits up to
100 MB and nothing else caps an asset ahead of a read. In every failure the turn survives untouched.

A verb that declares `metadataKey` is a **state verb**: its arguments are written wholesale under
that key on the chat's metadata row, and the package sees the change through the props it already
receives. A verb without `metadataKey` is an **event verb**: it is delivered to the package live as
a capability client event, with no durable write, no queue, no replay and no acknowledgement.
`metadataKey` is refused on an event verb, so an event verb cannot squat a key it never writes, and
required on a state verb.

The two halves differ in ways worth knowing before choosing one. A state write is durable and never
reverts: swiping away from the turn, editing it, or deleting it all leave the value in place, and
the visible symptom is that the last swipe _generated_ wins rather than the last swipe _displayed_,
so prose and world can disagree within a session with nothing reconciling them. An event has no
memory at all — one frame, one synchronous dispatch — and is lost, silently, on an aborted turn, on
a tab closed or reloaded mid-stream, on a dispatch that arrives before the package's first mount,
on a chat the player has switched away from, and while the package's own loading gate holds.
Nothing re-delivers it. In exchange, an event's effect reverts with the story when the package keeps
it somewhere a rewind rebuilds, which the state half cannot do — a chat metadata row does not
rewind. The one loss with no trace either way is an event applied to live state and then lost to a
hard reload before the package's next save flush.

Relative semantics are therefore refused by design on both halves. A state verb cannot express "add
five gold" by construction, since the write is an absolute overwrite. A relative _event_ verb is
refused as a rule, because regenerating a turn mints a fresh swipe index and does not carry the
previous swipe's marks forward, so a relative verb accumulates once per swipe generated. Deduping
on `chatId:messageId:swipeIndex` guards redelivery, which this channel cannot do anyway, and does
not guard regeneration, which it will. Absoluteness — not a ledger — is what makes a verb safe to
apply twice. Relative vocabularies belong here only reshaped as absolute-per-message.

On a turn that carries both kinds, the event's synchronous dispatch reaches the package _before_
the state verb's asynchronous refetch lands. An event handler must not read a same-turn state
verb's effect and expect to see the new value.

Refusals are asymmetric, and that asymmetry is a feature. The Engine validates shape only —
argument names, types, enum membership, string caps — because semantics belong to the package: an
NPC name cannot be enumerated at declaration time when the world is compiled per chat. For a state
verb the package's own refusal is therefore _advisory_, since the metadata row is already committed
by the time the package sees it. For an event verb the same refusal is _binding_: nothing was
committed engine-side, so a package that rejects an unknown name has genuinely rejected it.

A state verb's `metadataKey` must be the declaring package's to write, under three rules. The key
begins with the package's id normalized to camel case (`hierarchical-maps` → `hierarchicalMaps`);
it continues with a non-empty suffix starting at an uppercase boundary, which is what stops one
package prefixing another's namespace; and the normalized id must not be a metadata namespace the
Engine owns, or extend one at an uppercase boundary. That namespace list is derived from every
top-level `ChatMetadata` key, from the Engine's own metadata key constants, and from the keys that
live in the interface's index signature rather than in its declaration — `encounterActive`,
`internalAssistant`, `imageGenConnectionId` and the rest of the Engine's undeclared chat metadata,
which the first two sources cannot see at all. Reading that third group takes seven sources, because
the Engine writes and reads chat metadata in more shapes than one: the object a
`patchMetadata`/`updateMetadata` call passes, the object an updater callback _returns_ (a shape
used about as often as the first), the client's own `useUpdateChatMetadata()` mutation and its
`onMetadataChange` prop (which never touch `patchMetadata` at all), the client's direct
`PATCH /chats/:id/metadata` calls (which skip that hook too — the Game surface writes its combat,
scene and narration keys this way), the `chatMetadata.key` and `chat.metadata.key` property reads,
reads off a `parseChatMetadata(…)` result — the idiom the Engine uses most, and the only one that
sees keys like `scenario` — and, last, the list of per-chat metadata keys the Engine already
maintains by hand for chat settings profiles, which is where keys that are written and read entirely
across function boundaries turn up.

All of that is pinned by regression, extractors included. Two things are deliberately outside the
sweeps. A write handed a variable or a helper's return value (`patchMetadata(id, hydratedMeta)`, or
the same shape on the metadata route) commits keys no static sweep can read; there are twenty such
calls today and the regression pins that number, so a twenty-first fails the build until someone
reads it by hand. And a read that happens _inside_ a helper, off a parameter, is interprocedural and
out of reach of any read sweep — the shape `spatialContext` takes, written into chat metadata by the
`hierarchical-maps` package's own client, which ships from the Agents repository rather than this
one, and read back here through a helper and a file-local parse. That second gap is what the
hand-maintained list closes, and it is why one of the seven sources is a curated list rather than a
derivation. The derivation names its blind spots instead of claiming to have none. One entry in the
list, `persona`, is a hand-added floor no source produces today. The third rule refuses whole
packages, deliberately: `conversation-calls` normalizes to `conversationCalls`, and
`conversationCalls` + `Enabled` is an existing Engine key, so that package cannot own chat metadata
keys under its own id; `noodle` and `background` sit in the same position, the latter because
`background` is an Engine chat-metadata key in its own right. Such a package can still declare event
verbs, which own no key at all. Keys are flat and top-level because that is the shape a package's
reconciler already reads.

Verbs run only for a package that declares `chat-write` and is installed and ready. This permission
also gates writes through the package persistence API, including messages, chat metadata, roleplay
events and spatial snapshots. `chat-read` gates chat, message, game-state and spatial-snapshot reads.
The same checks apply inside persistence transactions and chat locks; a write permission does not
implicitly grant read permission. Engine-owned persistence calls remain trusted.

The Agent Organizer detail view shows the installed version's declared permissions after installation.
When the catalog version requests different permissions, it shows those separately. Installing or
updating code still requires the existing approval bound to that exact version and checksum; model
commands do not request separate approval on every turn.

These are API checks, not a JavaScript sandbox. Network, storage and UI permissions are access
declarations. Package browser/server code remains trusted code and can access its host environment;
only install packages you trust. Readiness is checked rather than servability, so an update that leaves
a package `restart-required` stops its verbs resolving until Engine restarts.

### Capability API 1.17: prepare an Experience before its opening turn

A `game-surface` package may declare `contributions.gameSurface.prepareBeforeStart: true`
with schema version 2 and Capability API 1.17. The Engine mounts that surface
while the game is ready, before enabling Start Game. Classic games and packages without
the flag retain their existing startup flow.

The opted-in main surface receives two additional props:

- `startup: boolean` stays true until the player finishes the Engine introduction with Continue.
  Pause world simulation and player actions while it is true.
- `setStartupReady(context: string | null): void` reports preparation state. Send `null` while
  loading, saving, or recovering from failure. Send a string only after the actual world is
  persisted and usable; an empty string permits startup without additional context.

The host blocks Start Game, its widget preparation confirmation, and initial-turn retries
until a ready string arrives. While blocked, the package's own loading and failure/retry
interface remains visible. Once ready, the package is hidden behind the normal Engine
introduction. Continue opens the ordinary surface, which may remount: keep world preparation
idempotent and restore persisted state instead of generating it again. A returning game that
has already completed its introduction does not repeat startup preparation.

Opening context is limited to **8,000 characters**. Invalid or oversized context keeps startup
blocked and displays an error; the host does not truncate world facts. Supply a compact account
of the prepared starting location and its actual cast. The Engine appends this text to its
existing first-turn `generationGuide` with source `game_start`, so the opening uses the world
that exists. This does not register context for later turns; keep using the package's normal
prompt contribution or turn-generation context for those.

Readiness callbacks belong to the mounted chat, game, and package. Late callbacks from another
scope are ignored. A module/runtime failure blocks startup rather than treating missing world
context as success. On reload, the package must report readiness from its saved world. The
server prompt-context contributor remains read-only and subject to its short deadline; do not
use it for world generation or as a long-running startup barrier.

### Capability API 1.19: package-contributed tools

Capability API 1.16 gave a package a way to have the model _say_ something it could act on. This one
gives it a way to have the model _call_ something. A package holding the new `tools` permission
registers a named tool from its server entrypoint, and the Engine offers it to the model beside the
built-ins on every turn of every chat, validates the call against the package's own JSON Schema, and
hands the arguments to the package's handler.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

Tool calling rather than a response format, on purpose. A response format claims the whole reply, so
the narration would have to be a field inside a JSON object and could not stream. A tool call arrives
alongside the prose and costs it nothing: the model writes its turn as normal and calls the tool
while it does. It also means the package gets arguments the provider itself constrained, instead of
parsing them back out of finished narration — which is the difference between a schema and a
convention the model is asked to honour.

Enums are the reason this matters. A package that knows the twelve places in its world can put those
twelve strings in the schema, and a call naming a thirteenth is refused before the handler sees it.
Refusals reuse the Engine's own tool-argument validator, which names the values that would have
worked, so the model gets something it can act on rather than "must be equal to one of the allowed
values". Whatever the handler returns is shown to the model as the tool result.

Rules worth knowing before you write one:

- Names are namespaced to `<packageId>_<name>`, with `-` flattened to `_`, so `world-clock`'s
  `set_time` reaches the model as `world_clock_set_time`. A qualified name already taken by another
  package is refused. Built-ins and enabled custom tools keep ownership of colliding names; the
  package definition is omitted and the built-in or custom handler runs. Qualified names must fit
  the provider limit of **64 characters**.
  Resolution is built-in first, then custom, then package, in both the definitions the model is
  shown and the executor, so the owner of a name is always the one that runs the call.
- A package's tools are always attached for as long as it is active. There is no second per-chat
  switch the way there is for built-in tools: declaring the permission and registering the tool is
  the decision. The selected provider must support native tool calls.
- The parameters schema is snapshotted and compiled at registration, so a schema the Engine cannot compile fails the
  package at activation, where a developer sees it, rather than mid-turn.
- A handler that throws is reported to the model as a failed tool call and logged; its message is not
  forwarded. A handler that has not settled within **10 seconds** is abandoned the same way — it keeps
  running, but the turn stops waiting on it.
- Tool results must serialize to at most **64 KiB**. Larger or non-serializable results fail the call
  instead of crowding out the conversation. Descriptions and results are trusted package content;
  package authors must check `chatId` before reading or changing chat-specific state.
- Every definition is serialised into each turn's provider request and counted by context fitting, so
  registration is bounded: at most **16 tools per package** and **64 across all packages**, a
  description of at most **512 characters**, and a parameters schema of at most **8 KiB**. Exceeding
  any of these throws, which fails activation. Registering a name the package already owns replaces
  that tool rather than consuming another slot.
- The activation context stops working once the activation is torn down: a package that retains `api`
  and calls `registerTool` from a later callback is refused, so a dead runtime cannot register a tool
  or replace a live one belonging to a re-activated package.
- Deactivating, updating or removing a package releases its tools, so a tool is never offered to a
  model whose package is no longer there to answer it.
  Tools are removed before awaiting package cleanup, whose individual callbacks have an 8-second deadline.

These deadlines bound asynchronous waits only. Packages run as trusted code in the server process;
synchronous work that blocks the event loop cannot be interrupted by a timer. Hard cancellation would
require a separate worker or process boundary, which this API does not provide.

This is not a soft seam. `api.registerTool` only exists on an Engine this new, so a package that
needs it must declare `capabilityApi` 1.19 and will refuse to install on anything older.

## Decision statements and the Decision model

The user's **Decision model** answers yes/no and choice statements about the recent chat. See [Decision Models](../connections/decision-models.md) for what it is and how users set one up.

An agent prompt template shipped by a package can use decision statements exactly as a user's custom agent does: `{{#if decision:"..."}}` and `{{#if decision_choice:"..." == "..."}}`. The Engine finds them in the template, asks them before the agent runs (after the reply, for a post-processing agent), and resolves the template with the answers. No capability API version is involved. See [Conditional Prompts](../prompts/conditional-prompts.md#asking-the-decision-model) for the syntax and the wording advice, and [Creating Custom Agents](../agents/custom-agents.md#decision-statements-in-the-agents-prompt) for how agent phases read them.

Package server code can also ask the user's configured Decision model bounded yes/no and Choice questions about context the package supplies, through `api.runtime.decisions.evaluate(...)`. It uses the same Decision model as agent activation questions and prompt conditionals (a managed local model or a Decision connection) and never exposes keys or Engine internals. `decisions` is optional and needs no newer capability API or permission: check `typeof api.runtime.decisions?.evaluate === "function"` and fall back on older Engines.

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages` is the package's own context, oldest first (at most 200 messages and 200,000 characters; a message `name` is at most 100 characters). The oldest messages are dropped to fit the model.
- Each `question` is at most 500 characters; ids must be unique. A Choice question has at least two `options`, and its answer is one of them or `"none of these"`.
- One request may ask for at most the user's **Decision statements per turn** limit of answers; each Choice option counts once, plus one. An invalid request throws a `TypeError`.
- `answers` holds the probability of yes per yes/no question, and a question missing from it was not answered. Compare it with `threshold`, the model's own operating point: probabilities are not comparable across Decision models.

Design every use for a user with no Decision model. A statement with no answer reads as no, so the `{{else}}` branch, or nothing, must be a sensible default. Write for "a Decision model", rather than requiring Jev: local chat models and other supported backends use the same syntax, but can give different answers. See [Thresholds](../connections/decision-models.md#thresholds) and [Limits and cost](../prompts/conditional-prompts.md#limits-and-cost) before relying on a particular score, request count or cached answer.

### A note for Game Mode Experience developers

Engine combat decides what ordinary enemies do on its own. Every non-boss enemy on the GM's side of a fight gets a role from its skills and class (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter or controller), a proficiency from its level unless the enemy sets one (novice, trained, veteran or master), and a temperament such as reckless, cautious, opportunistic or protective. Beasts and monstrosities are always mindless. Engine code picks these from a seed with no model call, and the game's difficulty changes how consistently enemies play to type. Only authored bosses are directed by the GM through a model call. See [Game Mode combat AI](game-combat-ai.md).

More combat improvements are on the way. Before involving a decision model anywhere in the combat pipeline, check that vanilla Engine combat does not already do what you need. If an enemy needs a particular personality, give it the matching proficiency and temperament first. A decision per enemy turn would add model work and a time limit; a hosted backend would also add network requests and charges. The fight would then depend on answers from a model the user may not have set up, so it would need a sensible no-answer fallback.

## Initial packages

- all currently built-in agents;
- hierarchical spatial maps for Roleplay and Game;
- Conversation audio and video calls;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

The base keeps the package manager, catalog client, generic agent pipeline contracts, generic turn-game host contracts, and inert host interfaces. Concrete implementations belong to packages.

## Trust and installation

The official catalog is a schema-validated, versioned JSON document fetched over HTTPS. Each release entry includes immutable artifact URLs, SHA-256 digests, byte sizes, engine compatibility, permissions, and whether its runtime requires a restart. A ruleset entry may also list `locales`, its language packs by language (Capability API 1.811), each with its own URL, SHA-256 digest and byte size and the store card's translated name and description. The Engine fetches only the pack in its current language after installing the ruleset, and again when its language changes (`POST /api/capability-packages/rulesets/language`, sent by the page as it opens and on each change), keeping it with the installed version and removing the others; see [Writing Rulesets](../extending/writing-rulesets.md).

Updates need the user's consent: apart from one-time migrations that keep an upgraded install's former built-ins (see [Compatibility migration](#compatibility-migration)), startup never downloads or installs a package. `GET /api/capability-packages/updates/pending` lists each installed official package whose catalog version is newer and compatible with the running Engine and capability API, leaving out a version the user already declined. The client shows them in one **Agent updates available** prompt. The prompt installs each selected update through the normal installation pipeline, pinned to the offered version and artifact SHA-256. Updates the user leaves unselected are declined the same way as **Not now**. **Not now** records the declined versions in `DATA_DIR/capability-packages/update-decisions-v1.json` (`POST /api/capability-packages/updates/decline`), so that version is not offered again, while a newer one is. **Update** stays available in **Agent Organizer** either way. Failures are isolated per package. Existing files and registry state remain usable when the catalog is offline or verification fails, and server-runtime readiness failures use the previous-version rollback path.

Release notes are published as `notes.json` beside the `catalog.json` they describe, never inside a catalog entry or a manifest: an older Engine drops a catalog entry with a key it does not know. Each pending update carries, as `releaseNotes`, the notes of every version after the installed one up to the offered one, newest first, and `releaseHighlight` is true when any of them is marked as a change the user will notice. Notes are plain text and are never rendered as Markdown or HTML.

The installer must:

1. require privileged loopback/admin access;
2. enforce HTTPS, download limits, and timeouts;
3. verify catalog trust and artifact SHA-256 before extraction;
4. reject absolute paths, traversal, links, device files, and undeclared files;
5. validate the manifest and engine compatibility;
6. extract into a temporary sibling directory;
7. atomically activate only after validation succeeds;
8. retain the previous version until the new runtime starts successfully;
9. roll back activation on failure;
10. never execute install, update, or uninstall scripts.

Only first-party trusted executable packages are enabled by the official catalog. A future third-party flow requires a separate explicit trust design.

## Runtime and restart behavior

The server owns the installed-package registry and exposes installed capabilities to clients. Declarative and reloadable modules activate immediately. The UI invalidates catalog, agent, mode-capability, and active-chat queries after activation.

The manifest may declare `restartRequired` only when the host cannot safely reload that entry point. Successful hot activation says `Agent installed. It is ready to use.` Restart-required activation says `Agent installed. Restart Marinara Engine to finish setup.`

Turn-game packages are hot-reloadable: installation registers their server engine and manual slash launcher immediately, and uninstallation detaches the runtime without an Engine restart. Per-chat Conversation Commands settings control only whether characters may emit the package's hidden command; they do not gate the user's slash launcher. Current official turn-game manifests retain their conservative legacy restart marker for Engine 2.x compatibility; Engine 3.x recognizes the `turn-game` kind, performs the safe hot activation, and returns the package as active and ready.

### Disk use: runtime copies and kept versions

A package server does not run from `DATA_DIR/capability-packages/versions/<id>/<version>`. Each activation verifies the installed files, copies them into a new folder under `DATA_DIR/capability-runtime-snapshots`, and imports the copy. The copy is deleted when that runtime stops.

- **Runtime copies.** A copy holds every verified manifest file except the client entrypoint. The server never loads it, and the browser gets it from `versions/`. Assets stay, so a server can read files beside its `server.mjs`, as Quartermaster does with `icons/`. The copied files are read-only.
- **Startup sweep.** A crash or a forced stop skips a copy's cleanup. At every start, before any package activates, the Engine deletes every entry in `capability-runtime-snapshots` except the shared `node_modules` links, because none of them can be in use by the new process. It makes read-only files writable first, which Windows needs, and never follows links. Only the process that holds the storage writer lease reaches this step, so a second Engine started on the same data folder stops when it opens storage and never deletes a running Engine's copies.
- **Kept versions.** `versions/<id>` keeps the current version and `previousVersion`, which rollback restores when a new server runtime fails to start. Older versions, and a version a failed update was rolled back from, are deleted after an activation or an update succeeds and at startup. A package whose update waits for a restart (`restart-required`), or whose runtime has not started yet (`readiness: "pending"`), keeps every version until it has started.
- **Never deleted:** package data (folders such as `DATA_DIR/long-term-memory` and the package's tables in `storage`), chats, settings, `installed.json`, update decisions, `.install-*` folders, and `versions/` folders of ids missing from the registry. Uninstall still removes the package's code and keeps its data.

## Compatibility migration

On the first upgraded launch:

- custom agents remain untouched;
- every legacy built-in agent visible to that installation is recorded as installed;
- maps, Conversation calls, and Conversation games retain their prior availability;
- existing per-chat configuration, snapshots, game state, call history, and agent memory remain in place;
- migration is idempotent and records its completion only after all legacy availability entries are durable.

Legacy package artifacts remain available from the official catalog as migration sources. Fresh installations do not expose or activate them until the user installs them.

## Uninstallation

Uninstall removes the package from active chat selections, deletes its agent configuration and downloaded executable files, and detaches its runtime at restart when needed. Historical chats, messages, map snapshots, call summaries, and completed game records remain readable so removing a package cannot destroy user work. Destructive removal of historical domain data is a separate, explicit user action.

Every uninstall requires confirmation. Affected chats fall back to their ordinary base surfaces without corrupting history.

## Catalog interface

The Agents panel contains an `Agent Organizer` control matching the `Download` button in the Characters and Personas panels, which opens the Card Browser. It opens a full-screen responsive library with search, package kinds, compatibility information, install/update state, permissions, storage cost, documentation, and uninstall controls.

Desktop shows a sidebar with search, mode filter and sections next to the store pages. Mobile shows search, mode filter and section chips above the page; an agent page replaces the list, with explicit back navigation and touch-sized actions. Empty, offline, incompatible, corrupt-download, interrupted-install, update, rollback, and restart-required states are first-class.

## Extraction gate

An extraction is complete only when the base production client and server bundles no longer contain the package implementation, a fresh install cannot activate it without downloading the package, an upgraded install retains it, and package install/update/uninstall passes on desktop, mobile, and Termux-compatible filesystems.

### Capability API 1.30: wound tracks, spending on a check, and a fight fought on a track

A ruleset's `live.tracks` entry may declare `levels` and `kinds`, which turns it from a bounded
integer into a WOUND TRACK: a column of boxes, each with its own label and penalty, that a mark sits
on. `levels` is 1 to 16 rungs, best first and worst last, each a `label` and an integer `penalty`.
`kinds` is 1 to 6 sorts of harm the track may take, each an `id`, a short `label` and a distinct
`severity`. The two go together: `kinds` without `levels` is refused, because there would be nothing
to mark. Beside them, `resolution.penaltyFrom` names the track whose penalty rides on every roll:
under `dice-pool` it takes that many dice off the pool and never below `pool.min`, and under
`dice-sum` it is a flat modifier on the roll.

The rest of 1.30 is everything else this slice added, and a package that ships any ONE of them
declares 1.30:

- `combat.health` may name a wound track instead of a pool, and then `combat.damageKinds` says what
  each damage type marks: `default`, an optional `byType` map, and `marks`, which is `per-blow`
  where a landing blow ticks one box or `per-point` where a damage roll counts health levels.
  `damageKinds` is required with a wound track and refused with a pool.
- `resolution.spend` (a `dice-pool` ruleset only): the pool a player may spend on a check, what one
  payment costs, whether it buys `successes` or `dice`, and `perCheck`, the ceiling on one roll.
- `mechanics.check` on a catalog entry: what a thing the character PICKED does to a check, as
  `reroll` (`upTo` and `once` or `until`), `dice`, `successes` or `threshold`. Also pool-only.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A wound track's length is its levels, so its `min` is 0 and its `max` is `levels.length`, and a file
that says otherwise is refused rather than quietly corrected. A track named by `resolution.penaltyFrom`
must be a wound track: a plain track carries no penalty to apply.

Not a soft seam, for the same reason as 1.20 through 1.28: an Engine that cannot read `levels`,
`kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` or `mechanics.check` refuses the whole
ruleset file, so install reads the verified bytes of `ruleset.json` and refuses the package under an
older declaration. No change for a ruleset whose tracks are plain numbers, whose health is a pool
and which says nothing about spending on a check.

### Capability API 1.29: what one turn of a ruleset fight can do

Five additions, all optional, to the `combat` block and to the catalog entries a fight reads:

- A blow may carry up to three MORE amounts beside its first. `mechanics.plus` on a catalog entry
  and `damage.plus` on a creature action are each `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`: rolled and typed on its own, doubled on its own by a
  critical, saved against on its own by the target, and still one check against concentration and
  one check for going down for the whole blow.
- `combat.attacks[].strikes` is a value reference saying how many strikes one spend of that list's
  budget buys. The rest wait in hand until the turn ends, and while any are in hand every row of
  that list costs no budget.
- `mechanics.free` costs no budget, `mechanics.gives` hands budgets back for this turn only (capped
  where they land), and `mechanics.standard` lets its holder buy named standard actions with
  another budget. A `utility` entry that declares `gives` or `standard` is offered rather than
  dropped.
- A new entry kind, `rider`, and a creature's own `riders`, add a damage clause to the first
  qualifying hit of a turn or a round, passively and without ever being on the menu.
- The closed condition effect list gains `own-saves-advantage`, `own-saves-disadvantage`,
  `resist-all`, `cannot-target-source` and `cannot-approach-source`, and a condition may narrow the
  saves it is about (`saves`), count only while its source is in sight (`whileSourceInSight`) or
  end when its source goes down (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Not a soft seam, for the same reason as 1.20 through 1.28: an Engine that cannot read these keys
refuses the whole ruleset file, or the catalog file that holds them, so install reads the verified
bytes of `ruleset.json` and of every declared `catalogs/<id>.json` and refuses either one under an
older declaration. No permission, and no change for a ruleset that declares none of them.

### Capability API 1.28: a ruleset fight on a board

A ruleset's `combat` block may say what one cell of a battlefield is worth in its own distance
(`distance: { label, perCell }`), and that is what makes a fight positionable at all. Beside it:
`ranged` says what a shot past its ordinary distance, or taken with a foe in the next cell, costs;
`cover` says what standing behind something adds to the defense an attack is rolled against;
`opportunity` names the budget a strike at somebody walking away is paid out of; an attack list may
give its rows a `reach` and a `range`, each read from a column of that list or written once for
every row; and a creature action's `range` may be `{ "normal": 30, "long": 120 }` instead of a plain
number.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A ruleset that declares `ranged`, `cover`, `opportunity` or any weapon reach or range WITHOUT
`distance` is refused at import: none of them means anything without a cell to measure it in. The
board itself is the tactical combat style's own generator, terrain and deployment, so this level
adds no second battlefield model and no permission.

Not a soft seam, for the same reason as 1.20 through 1.27: an Engine that cannot read these keys
refuses the whole ruleset file, or the catalog file that holds the creature whose range is a pair,
so install reads the verified bytes of `ruleset.json` and of every declared `catalogs/<id>.json` and
refuses either one under an older declaration. No change for a ruleset that says nothing about
distance.

### Capability API 1.27: ruleset bestiaries

A ruleset catalog may declare `"holds": "creatures"` and carry creature stat blocks instead of sheet
rows. A creature is written in the numbers the `combat` block already declares: health that may be a
number or dice thrown when the fight starts, a defense, an initiative modifier, ability scores and
save modifiers under the sheet's own ids, damage types it resists, is hurt more by or ignores, the
conditions it is never in, the threat tier it sits on, traits the Game Master is shown, and actions
that may hit, force a save, apply a condition, be limited to so many uses, come back on a recharge
roll, resolve a sequence of the block's other actions for one budget, or be bought with the
creature's own signature points.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

A catalog of creatures declares no `feeds` and is never offered by the sheet editor's picker: it is
read by a fight, not by a character sheet. The fight that reads it is the combat director's
`ruleset` style, which needs no Capability API level of its own: it plays whatever `combat` block
and bestiary an installed ruleset already carries.

Not a soft seam, for the same reason as 1.20 through 1.26: an Engine that cannot read `holds` or an
entry's `creature` refuses the whole ruleset file, or the catalog file that holds it, so install
reads the verified bytes of `ruleset.json` and of every declared `catalogs/<id>.json` and refuses
either one under an older declaration. No permission, and no change for a ruleset without a bestiary.

### Capability API 1.26: ruleset combat

A ruleset may carry an optional top-level `combat` block saying how a fight is RESOLVED by its own
numbers: what is rolled and against what, the action economy, which sheet lists are attacks and
which are abilities, what its conditions do, concentration, what happens to a character at zero, the
damage types it has and the scale an opponent is picked from. The same release lets a catalog
entry's `mechanics` say how many targets it takes, that it always lands, what conditions it applies,
what temporary points it grants, how it grows with the sheet and which budget it spends.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A game on a ruleset that declares `combat`, with the combat director on, fights its battles by
this block on the battle screen. A ruleset without it fights the way it did before, through its
`battle` block or the player's Classic or Tactical preference.

Not a soft seam, for the same reason as 1.20 through 1.25: an Engine that cannot read `combat` or
the new `mechanics` keys refuses the whole ruleset file, or the catalog file that holds them, so
install reads the verified bytes of `ruleset.json` and of every declared `catalogs/<id>.json` and
refuses either one under an older declaration. No permission, and no change for a ruleset with
neither.

### Capability API 1.25: ruleset layers and world guidance

A ruleset may declare an optional top-level `layers` array: named variants of itself (Low magic, Hard
winter) that a player turns on when a game is created, frozen into that game's pin for its lifetime.
The same release gives the base `gm` block an optional `worldGuidance` string, which world generation
reads once at setup so the setting suits the rules the party will play by.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A layer's effects are a closed set and every one of them narrows or appends: guidance added after the
ruleset's own, values removed from an enum field, the difficulty ladder replaced by one of the same
resolution kind, and catalog entries hidden from the sheet editor's picker. Nothing is added, so a
character sheet stays readable whichever layers a game chose, and a layer brings no package code and no
extra model call. Layers shipped by someone other than the ruleset's author are a later addition.

Not a soft seam, for the same reason as 1.20 through 1.24: an Engine that does not know `layers` or
`gm.worldGuidance` refuses the whole ruleset file, so install reads the verified bytes of `ruleset.json`
and refuses either one under an older declaration. No permission, and no change for a ruleset with
neither.

### Capability API 1.24: the dice-pool resolution kind

A ruleset's `resolution` may declare `"kind": "dice-pool"` instead of `"dice-sum"`. The check then throws
the character sheet's own number of dice and counts the ones that reach a target, with optional doubled
faces, exploding faces, cancelling faces, botches, exceptional successes and a range of situational dice
the Game Master may add or take for one check.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

The sheet is the same sheet: what `dice-sum` adds to the roll is, here, the number of dice. So the kind
brings no new sheet vocabulary, no editor slot and no package code.

Not a soft seam, for the same reason as 1.20 through 1.23: an Engine that knows only `dice-sum` refuses
the whole ruleset file, so install reads the verified bytes of `ruleset.json` and refuses a `dice-pool`
resolution under an older declaration. No permission, and no change for a ruleset that sums its dice.

### Capability API 1.23: scaled catalog values

A catalog entry's row may carry an optional `scaled` map: up to four of that row's own number columns
whose value the ruleset keeps, rather than the player. Each one is an ordinary value reference with an
optional step table, so a class resource can follow a level and a feature's uses can follow an ability
score without the format learning any new arithmetic.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

The value is worked out when the sheet is edited and never when it is read, so live state, the Game
Master's prompt block and the battle bridge all keep reading the stored number.

A scaled row can sit inline in `ruleset.json` or in a `catalogs/<id>.json` asset. The manifest
declares both files as assets but cannot show the keys inside them, so install reads the verified
bytes of both and refuses a `scaled` key under a
declaration older than 1.23, exactly as it does for `catalogs` under 1.21 and `battle` under 1.22. An
older Engine's strict schema would refuse the file that holds it anyway. No permission, and no change
for a ruleset whose catalogs ship none.

The same release adds the `[sheet: op="use" name="..."]` command, which pays a catalog entry's
`mechanics.cost` plus one use of every row pool that entry wrote. It needs no declaration: it reads
catalogs the Engine already serves.

### Capability API 1.22: the battle block

A ruleset may carry an optional `battle` block, which lends a battle the numbers on the character
sheet: the live pool that is hit points, an optional pool that becomes MP, the pools that become
spell slots, and the sheet lists whose catalog-marked rows become the Engine's own `CombatSkill`s.
When the fight ends, the hit points, energy and slots it spent are written back through the same
sheet operations a player's own buttons use.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

This is not a combat adapter. The damage arithmetic stays the Engine's, and `attackRoll`, `save`,
`concentration` and `perCostStep` on a catalog entry are read by nobody: rules-accurate resolution
belongs to the combat handoff's per-ruleset adapters. `coverage.combat` keeps its own meaning and
the bridge never reads it.

The block lives inside `ruleset.json`, which the manifest cannot show, so install reads the verified
bytes and refuses a `battle` key under a declaration older than 1.22, exactly as it does for
`catalogs` under 1.21. An older Engine's strict schema would refuse the whole ruleset file anyway.
No permission, and no change for a ruleset that ships no `battle` block.

### Capability API 1.21: ruleset catalogs

A ruleset may ship **catalogs**: named collections of ready-made entries (spells, class features,
gear) that the sheet editor offers in a picker, so a player does not type a list row by row. The
header lives in `ruleset.json` under `catalogs`; the entries sit either inline in that header or in
a reserved asset of their own, one file per catalog:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` is a reserved asset family: the file name is the catalog's own id, so the
Engine finds the file from the ruleset alone and no catalog can name another one's file. A catalog
asset is hash-pinned in `files[]` like every other declared asset, only ever ships beside the
`ruleset.json` that declares it, and is refused on its declared size above 2 MB before it is read (1 MB before Capability API
1.340; a package with a catalog file over 1 MB declares 1.340).
Its contents go through the same checks the inline entries go through, against the same sheet, so a
catalog can never write a row the sheet could not hold. Up to 12 catalogs per ruleset and 2000
entries per catalog.

The client fetches a catalog only when a picker opens, through
`GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. The installed-ruleset
list never carries inline entries, only a count, because it is read whenever a sheet editor opens.
Catalog text never reaches a prompt: the Game Master still sees only what `gm.sheetSummary` names,
so catalogs cost no tokens.

Like 1.20 this is not a soft seam, and the gate has two halves because catalogs live inside the
ruleset file rather than in the manifest. Declaring a `catalogs/<id>.json` asset requires 1.21, and
a `ruleset.json` that carries a `catalogs` key is refused at install when the manifest declares
less, because an older Engine's strict schema would refuse the whole ruleset file anyway. No
permission, as before.

### Capability API 1.20: Game Mode rulesets

A ruleset is a game's rules as validated data: a resolution kind the Engine already implements, a
character sheet declared from a closed set of primitives, rests, and guidance for the Game Master
prompt. A package ships it as the reserved-filename asset `ruleset.json`, discovered by convention
exactly like `gm-verbs.json`: listed in `contributions.assets.paths` and hash-pinned in `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

The snippet shows only the keys that matter to a ruleset; the usual manifest fields (`name`,
`version`, `description`, `engine`, `builtAgainst`) are still required.

A ruleset package needs no permission, no server or client entrypoint and no agent. The kind and the
asset go together: a package of kind `ruleset` must list `ruleset.json`, and a package that lists
`ruleset.json` must declare the kind, so a ruleset cannot ride in under another kind. Nothing in the
file is executed: there are no expression strings, and a mechanic that no resolution kind expresses
is an Engine change that adds a kind, not something a ruleset can do. The format is documented in the
author guide, [`writing-rulesets.md`](../extending/writing-rulesets.md), and the code that reads it in
[Game Mode architecture](game-mode-architecture.md).

This is not a soft seam. A ruleset package does nothing on an Engine that cannot read it, so a
manifest that lists `ruleset.json` must declare Capability API 1.20, and an older Engine refuses the
install cleanly.

The Engine refuses the asset on its declared size above 512 KB before reading it (256 KB before Capability
API 1.340; a package whose ruleset is over 256 KB declares 1.340), re-verifies it
against the install-time hash, and validates it with the strict shared schema
(`packages/shared/src/schemas/ruleset.schema.ts`). A file it cannot use is dropped with one log line
that names the package and the first few `path: message` problems. Two packages that declare the same
ruleset id resolve to the first in package-id order, and the other is dropped with a log line.
`engine-legacy` and `traditional` are Engine-owned ids a file may not claim.

A game pins its ruleset once, at creation, as `chat.metadata.gameRuleset`. No pin means the Engine's
own rules, exactly as before. A pin the install cannot honour (the package is gone, or the installed
definition is older than the pinned version) is reported as unavailable and never reinterpreted as
another ruleset. The pin is matched on the ruleset id and on the package that supplied it, so
another package claiming the same id does not take over an existing game.

### Capability API 1.73: the avatar agents

The Engine hosts the two avatar agents, `2d-avatars` (PNGTuber sprites and mesh avatars) and
`3d-avatars` (VRM models). Their packages stay thin: an agent definition each, default prompts,
locales and the catalog entry. The Engine owns everything else: per-owner storage under
`DATA_DIR/avatar-models/`, import, the lazy-loaded renderers, the setup on each agent's Agent editor
page, the stream director, the expression classifier and the generation routes. The shared contract
is `packages/shared/src/types/avatars.ts` (its schemas are in `schemas/avatars.schema.ts`), and the
client half is `packages/client/src/features/avatars/contract.ts`. The user guide is
[`docs/agents/avatars.md`](../agents/avatars.md).

There is no new manifest field. An avatar package declares schema version 2 and Capability API 1.73,
so an Engine without these surfaces refuses the install instead of listing an agent that shows
nothing. The change that introduced 1.73 shipped these surfaces as inert stubs; the Engine's setup,
stage and renderers are now on `staging`, and the two packages are listed in the preview catalog.
Their referenced artifact URLs must be published before installation works; a catalog entry alone
is not proof that its downloadable artifact is available.
The 2D agent's generation prompts ship as the `avatarGenerationTemplates` prompt template
collection in its `defaultSettings`, with the ids in `AVATAR_PROMPT_TEMPLATE_IDS`; the Agent editor
merges and resets them like any other built-in template collection.

### Capability API 1.72: an Experience's map pack

A `game-surface` package that sets up through the Game wizard (`gameSurface.setup`, 1.18) can ship a
map pack with schema version 2 and Capability API 1.72: its own setting kit, ready-made worlds built
with that kit, and its own tile pack. Each is the share file Game Mode and Pixelforge already read and
write (a `.worldkit.json`, `.world.json` files and a `.tilepack.json`), and each is also a declared,
hash-pinned asset.

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds` (at most 32) and `tiles` are optional. A world file may carry its world's story script
(worldgen W10), which ships with the map as part of it. A world file of version 2 also carries the
world's `snapshot`, the world as it was made (W11): an Engine whose world generator has changed since
reads the world from it, exactly as it was made, so a pack keeps working across Engine updates. Write
the files from a game's or library world's **Download** (or `GET /api/game/:chatId/world/file`), which
include it. A pack file is at most 8 MB, the largest share file the Engine reads (a tile pack keeps its
own smaller limits), so a world whose file is larger (a very big world's snapshot) cannot ship in a pack. A world whose story sets an `intro`
needs Capability API 1.339 (see [The intro message](../extending/writing-story-scripts.md#the-intro-message)).
`tiles` may be an image tile pack (tile pack version 2: PNG sheets on a grid of cells, with sprites of
several cells), which needs Capability API 1.80; the Engine decodes and checks its sheets once per
package version. With the Experience on, a new game is locked
to the pack's kit; if the pack ships worlds, the player picks one of them (story included) and makes
no other. Turning the
Experience off gives the player's own choices back. `POST /api/game/create` holds a game to the same
lock. The game keeps its kit and world like any game, so it plays on if the package is removed, and
draws its overworld and towns with the pack's tiles while the package is installed.

The Engine reads the files through the verified asset path (declared size at most 8 MB each, hash
re-checked) and checks them as it checks share files. A pack is refused whole, with the reason, when a
file does not read, when a world was made with another kit or does not fit it, or when its bytes are
not the ones installed; the Experience then cannot start a game. A ruleset is never part of a map
pack: an Experience that needs its own rules ships a separate ruleset package.

#### Capability API 1.344: creature packs

`mapPack.creatures` lists up to 8 `.creaturepack.json` files (each a declared asset, read and checked as
the library reads a creature pack). In a game of the Experience, every fight draws a creature's art from
these packs first, in their order, and then from the creature pack chosen in the library.

#### Capability API 1.345: music

A package's assets may be audio from 1.345: `.ogg`, `.mp3` or `.wav`, 16 MB each at most. `mapPack.music`
names the Experience's tracks and when they play:

```json
"music": {
  "tracks": [
    { "id": "valley", "path": "music/valley.ogg", "title": "The Held Valley" },
    { "id": "town", "path": "music/thrushwick.ogg" },
    { "id": "fight", "path": "music/fight.ogg" }
  ],
  "default": "valley",
  "combat": "fight",
  "places": [{ "place": "p3", "track": "town" }]
}
```

Each track is also a declared asset, and every track id named is one of `tracks`. A place in `places` is
a place of one of the pack's worlds, by id. Out of a fight, the game plays the place's track, else the
track of the nearest place it is inside that has one, else `default`; in a fight, `combat`. A story's
`music` action (see [Writing Game Mode Story Scripts](../extending/writing-story-scripts.md)) cues one
of the tracks over all of these until it hands back. With none of these, the Engine's own music plays.
A player who has picked their own music source (the Music DJ, Spotify) hears that instead: their choice
always wins.

#### Capability API 1.346: people

`mapPack.people` is a `.people.json` file (a declared asset) that dresses the named people of the pack's
worlds. People come from the world itself, generated and named or added by hand in its edits (Pixelforge
or the World tab), so they stand at their places like everyone else; the file says who they are:

```json
{
  "peopleVersion": 1,
  "people": [
    {
      "person": "p3-e1",
      "portrait": "people/maud.png",
      "expressions": { "happy": "people/maud-happy.png", "angry": "people/maud-angry.png" },
      "sprite": "maud-walk",
      "description": "Keeper of Thrushwick's bells, older than she lets on.",
      "voice": "Slow, warm, and fond of proverbs about weather.",
      "lore": [{ "keys": ["bells", "bell tower"], "content": "The bells have rung the year out for 200 years." }]
    }
  ],
  "lore": [{ "name": "The Held Autumn", "keys": ["autumn", "harvest"], "content": "The year has not turned." }]
}
```

- `person` is a person id of one of the pack's worlds (`<place id>-<n>`, or `-e<n>` for one added by
  hand), and that person must have a name there.
- `portrait` and `expressions` (`neutral`, `happy`, `sad` and the other narration expressions) are
  pictures among the package's assets. The portrait shows in the Journal once the game meets them, and
  their expressions are used for the lines they speak.
- `sprite` is a character of the pack's own (image) tiles, which they wear walking on town and place
  maps instead of one picked for them.
- `description`, `voice` and `lore` become a lorebook made with each new game of the Experience
  (_Experience name_: people), active from the first turn: one entry per person, brought in by their
  name, one per `lore` entry by its own keys, and one per entry of the file's own `lore`.

#### Capability API 1.347: companions

A person may be a companion: someone the party can take in, so a party that lacks healing, scouting or
a light in the dark is never locked out of what the story asks of it.

```json
{
  "person": "p3-4",
  "portrait": "people/hob.png",
  "companion": {
    "role": "Healing and herb lore",
    "sheets": {
      "5e-2014": {
        "v": 1,
        "level": ["level"],
        "builds": [
          { "at": 1, "build": { "abilities": { "wis": 16 }, "fields": { "level": 1, "class": "Cleric" } } },
          { "at": 3, "build": { "abilities": { "wis": 16 }, "fields": { "level": 3, "class": "Cleric" } } }
        ]
      }
    }
  }
}
```

- `sheets` holds a sheet for each ruleset the companion can join a game of, by the ruleset's id. `v` is
  the ruleset's sheet version the builds were written for (older ones are migrated as stored sheets are).
- `level` names the sheet fields that hold a character's level in that ruleset, added up (a multiclass
  sheet keeps one per class). Each build's level fields must add up to its `at`, and the builds go up.
- A companion joins with the build for the highest level the party has reached (the lowest while the
  party is below them all), and after each turn moves up to a higher build once the party reaches it. A
  sheet the player raised past its build is left alone, and nothing lowers one. Their health, pools and
  conditions are kept apart from the build, so a rise keeps them. Ship a build for each level the
  companion should be playable at.
- The story takes them in and lets them go with `recruit` and `dismiss` actions. The Game Master is
  told who the companions are, where, and what they bring, and may take only them in (a
  `[party_change]` naming anyone else is refused); the player's own library characters may still join.
- A companion joins as any recruit does: they are in the party's list, carry their card and sheet, and
  fight in tactical combat. In a game on a ruleset they have no sheet for, they join with a blank one.

A people file with companions needs 1.347; without, 1.346. A story that recruits or dismisses someone
needs 1.347, and each person it names must be a companion in the pack's people file.

#### Capability API 1.350: checking a pack before export

An authoring app (Pixelforge) can have the Engine check a whole map pack before it exports the package,
exactly as an installed one is read, without installing it:

```
POST /api/game/experience/check
{ "mapPack": { ...the manifest's gameSurface.mapPack block },
  "files": { "map/valley.worldkit.json": { ...parsed JSON }, ... },
  "assets": [{ "path": "people/maud.png", "bytes": 48213 }, { "path": "music/valley.ogg", "bytes": 3100000 }] }
```

`files` holds every JSON file the block names (kit, worlds, tiles, creature packs, people), parsed;
`assets` lists the package's other assets (pictures, audio) by path and size. The answer is
`{ "ok": true | false, "minor": <n>, "issues": [{ "path": "...", "message": "..." }] }`: `minor` is the
Capability API minor (1.`minor`) the pack needs, and `issues` names each problem by the block's key
(`mapPack.music.default`) or the file it is in. The manifest's own rules (declared assets, track ids,
audio sizes) are all reported; the files' checks stop at the first problem, as an install does.

#### Capability API 1.351: held seasons

A world's story may hold places at a season whatever the date (`seasons`, and the `season` action: see
[writing story scripts](../extending/writing-story-scripts.md#seasons)), and a world's battlefields may be
painted with seasons (`seasons` rows and `seasonKeys`). A map pack with either needs 1.351. The overworld
reads held places as `seasons` (place id to season, `*` for the whole world) from
`GET /api/game/:chatId/overworld`; a made battlefield carries its tiles' starting seasons as `seasons`,
keyed `"x,y"`.

#### Capability API 1.355: ruleset overlays

An Experience's map pack may add to the rulesets its games play, while the Experience is on: its own
creatures, conditions and items, which are not the ruleset package's to ship.

```json
"mapPack": { "kit": "...", "rulesets": [{ "ruleset": "5e-2014", "overlay": "rules/5e.overlay.json" },
                                        { "ruleset": "dnd5e", "overlay": "rules/dnd5e.overlay.json" }] }
```

Each `.overlay.json` (declared as an asset like the pack's other files) is for one ruleset, by its id. A
ruleset imported from a file (`local/<id>`) or a repository (`<owner>/<id>`) plays the overlay for its bare
id, unless the pack names its exact id too:

```json
{ "overlayVersion": 1,
  "creatureTags": [{ "id": "unreaped", "label": "Unreaped" }],
  "conditions": [{ "condition": "owed_frost_held", "effects": ["own-attacks-disadvantage"] }],
  "sheetConditions": [{ "id": "owed_frost_held", "label": "Held by the Frost" }],
  "creatures": [{ "id": "the-owed", "label": "The Owed", "creature": { ... } }],
  "catalogs": { "magic_items": [{ "id": "lantern-of-dusk", ... }] } }
```

`creatureTags` join the ruleset's `combat.creatureTypes.tags`, `conditions` its `combat.conditions`,
`sheetConditions` its `sheet.live.conditions`, `creatures` its `creatures` catalog, and each list of
`catalogs` the catalog of that id. A game of that ruleset with the Experience on plays the ruleset with
all of it merged in (story fights, `give`, the Game Master's own uses), and the ruleset is read again
whole: an overlay whose entries do not fit it, or that reuses an id the ruleset has, is left out
whole and the game plays the ruleset as it was. `POST /api/game/experience/check` merges each overlay
into its ruleset as installed and reports what does not fit.

From Capability API 1.367 an overlay may add sheet tracks too, `"tracks": [{ "id": "owing", "label":
"Owing", "min": 0, "max": 20, "default": 0 }]`, shaped as the ruleset's `sheet.live.tracks` and joining
them: a track the overlay declares is shown on the sheet, moved by sheet commands, and kept for what a
story's Held Ground or a board's light rule marks. A pack with an overlay that adds tracks needs 1.367.

#### Capability API 1.357: dungeon looks and a hand map's own words

An Experience's maps made by hand can be drawn in its own looks, not only the library's cave, crypt,
temple and station sets, and told to the Game Master in its own words.

```json
"mapPack": { "kit": "...", "dungeons": ["looks/corn-maze.tilepack.json", "looks/snowfield.tilepack.json"] }
```

Each is an image tile pack (`tilePackVersion` 2) laid out as a dungeon set: `dn_floor`, `dn_wall`,
`dn_liquid`, `dn_prop0` to `dn_prop7` (`dn_liquid` may have edge pieces, as a library set's). It must draw
at least `dn_floor` and `dn_wall`; the rest fall back to plain colours. A hand map (`edits.maps`) whose
`pack` is one of their ids is drawn with it, before any library pack of that id. No two may share an id.

A hand map may also carry its own words for the Game Master:

```json
"words": { "floor": "stubbled earth", "wall": "walls of standing corn", "liquid": "a ditch of rainwater",
           "props": ["a scarecrow", null, "a corn-dolly shrine"] }
```

`props` is one entry per prop slot, 0 to 7 (`null` for a slot left unsaid). The Game Master is then told
the map as "A place made by hand (stubbled earth, walls of standing corn), with a ditch of rainwater in it;
in it: a scarecrow (2), a corn-dolly shrine", in place of saying only that it was made by hand. Both need
an Experience that declares 1.357.

#### Capability API 1.359: items that cost a story number

An overlay may name items whose use spends (or adds to) one of the Experience's story number flags:

```json
{
  "overlayVersion": 1,
  "storyUses": [{ "item": "magic_items/jar-of-someone-elses-death", "flag": "debts_settled", "add": -2, "atLeast": 2 }]
}
```

`item` is `catalog/entry` of the merged ruleset (the overlay's own items count), named once. In a fight,
using that item (the acting fighter's sheet item) is refused while the flag, with any spends not yet
recorded, is below `atLeast`: "Jar of Someone Else's Death needs 2 Debts Settled; the party has 1." A use
the fight takes is kept with the game, and the next story turn records it once (`spend="<id>"`, by the
Engine), within the flag's `min` and `max`, and tells the Game Master what it cost. Each flag must be a
number flag of one of the pack's stories. A map pack with `storyUses` needs 1.359.

#### Capability API 1.360: parties beyond six, and companions who never fight

A story fight's variants may be for parties above six, or open-ended (`"party": { "min": 7 }`), and a
story condition may ask the party's size (`{ "partySize": { "is": ">=", "value": 7 } }`; see
[writing story scripts](../extending/writing-story-scripts.md#conditions)).

A companion of the people file may never fight:

```json
{ "person": "p3-7", "companion": { "role": "Keeps the ledger", "noncombatant": true, "sheets": { ... } } }
```

They travel with the party and are told to the Game Master as never fighting, but are not counted in the
party's size (for fight variants and `partySize` conditions) and are not put in its fights. A people file
with one needs 1.360.

### Capability API 1.372: GM setup values

`contributions.gameSurface.setup.defaults` sets what picking the Experience in the Game wizard fills in.
Pixelforge's Experience tab writes it. Every key is optional, and the player may still change each value:

```json
"setup": {
  "defaults": {
    "name": "The Held Autumn",
    "genre": ["Fantasy"],
    "setting": "Sallowmarch, a valley where nothing has died for forty years.",
    "tone": ["Whimsical", "Dark"],
    "difficulty": "Normal",
    "rating": "sfw",
    "language": "English",
    "combatStyle": "tactical",
    "playerGoals": "Find out why the year will not turn.",
    "preferences": "Quiet dread over gore.",
    "gameSpecialInstructions": "Keep the valley's names.",
    "artStylePrompt": "Muted autumn watercolour.",
    "intro": { "mode": "defined", "text": "The leaves have not fallen in nine years.", "locked": true }
  }
}
```

- `name`: at most 100 characters.
- `genre` and `tone`: 1 to 12 names each, at most 60 characters, no commas. Joined, each list stays within 200 characters.
- `difficulty`: `Casual`, `Normal`, `Hard` or `Brutal`.
- `rating`: `sfw` or `nsfw`.
- `combatStyle`: `classic` or `tactical`.
- Text limits: `setting` 4,000 characters, `language` 100, `playerGoals` and `preferences` 2,000, `gameSpecialInstructions` 2,000, `artStylePrompt` 500.

`intro` is the Game Master's intro message (1.339), with the same rules as a story script's `intro`
(see [Writing story scripts](../extending/writing-story-scripts.md#the-intro-message)). It is the only
value that locks. A locked intro shows read-only in the wizard, and the game opens with it whatever the
setup sends. The game keeps the intro as it was when the game began (`chat.metadata.gameExperienceIntro`).
It is read before the story's own `intro`. A setup-file import keeps its own values, and turning the
Experience off leaves the filled values as they are.

### Capability API 1.373: Experience files

An Experience that holds only pictures, music and data can travel as one `<id>.experience.json` file
instead of a package zip. Players import it from the Game wizard's Experiences section with
**Import an Experience file**; it needs no agents catalog.

Its manifest has `"kind": ["experience"]` and nothing else in `kind`, needs `capabilityApi` 1.373 or newer,
and carries no code: `entrypoints` is `{}`, `permissions` is empty, there is no `restartRequired` or
`prepareBeforeStart`, and `contributions.slots` is exactly `["game-surface"]`. Every file in `files` is
`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ogg`, `.mp3`, `.wav` or `.json`. The game surface draws
nothing of its own; the Experience works through its `gameSurface` contributions (setup, maps, worlds,
creature packs, music).

The file is JSON with its keys in this order:

```json
{"format":"marinara-experience","version":1,
"manifest":{ ... },
"files":{
"art/portrait.png":"iVBORw0KGgo...",
"music/theme.ogg":"T2dnUwAC..."
}}
```

- `manifest` is the package manifest as above, at most 1 MB, and comes before any file.
- `files` maps each path in the manifest's `files` to its bytes in standard base64 (padding only at its end,
  no whitespace or line breaks inside it). Every listed file appears exactly once, and nothing else does.
- Paths are written without escapes, so a path with a quote, a backslash, a control character or a lone surrogate is refused.

Before anything is sent, the wizard reads only the start of the file, up to the end of its manifest, and
shows a review: the name, version and description, the import size, how much of it is pictures, music and
data, and Import and Don't Import. Import sends the file to `POST /api/capability-packages/experience-file`
(content type `application/vnd.marinara.experience+json`). The server reads it as it arrives, writes each
file to a temporary folder, and checks its size and `sha256` against the manifest. A file that does not
match, a missing or extra file, a cut-off file or an older version than the one installed is refused, and
nothing it wrote is kept.

Each file must then be what its name says. Pictures pass the signature check character card imports use
(`isAllowedImageBuffer`) and must be the type their extension names, so a page or an SVG named `.png` is
refused. They are stored without their metadata: PNG keeps only the chunks that draw it (no `tEXt`, `zTXt`,
`iTXt`, `eXIf` or `iCCP`), JPEG drops its APP segments but JFIF and Adobe and its comments (so EXIF
orientation is not kept), GIF drops comments, plain text and application extensions but the loop count,
and WebP drops its EXIF, XMP and ICC chunks. Music must be well-formed Ogg Vorbis or Opus (every page's
checksum checked; its comments and cover art are blanked in place), MP3 (its ID3 and APE tags removed) or
WAV (only its `fmt `, `fact` and `data` chunks kept). Data files must be UTF-8 JSON. Anything after a
picture's or sound's end is dropped. The installed manifest records the stored files' sizes and hashes. A newer version replaces the installed one, as a catalog update does. An
Experience file cannot replace a package of another kind with the same id.

An Experience is never accepted as a package zip. An agents catalog lists one only with an artifact URL
ending in `.experience.json`. The Engine installs that file through the same reader, checks and stripping,
and refuses it unless its manifest is the one the catalog lists. A catalog entry that is an Experience
(`kind` `experience`, or the `game-surface` slot) with any other artifact is refused before anything is
downloaded, and the first-start catalog install skips Experiences. Experiences already installed keep
working.

Pixelforge 0.45.0 exports an Experience as this file, and only opens Experience files.

### Capability API 1.18: keep Experience setup in the Game wizard

A `game-surface` package can declare `contributions.gameSurface.setup` with schema
version 2 and Capability API 1.18. The Engine keeps its usual seven setup steps,
including Party, goals, models, and lorebooks. Only new games offer Experiences;
reopening setup for an existing game preserves its Experience and package config.
Packages without this declaration retain their legacy setup dialog.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

All three fields are optional. The declared seed appears beneath the selected
Experience with a Randomize button. The seed is an unsigned whole number from 0
to 4294967295; blank, fractional, negative, exponent, or hex input blocks Start.
The host writes the numeric seed and declared constants to `experienceConfig`;
`config` cannot contain the seed key. Constants must serialize to at most 8,000
characters. A seed label is package-authored display text; omit it to use the
Engine's localized label.

A declared widget requirement is enforced while the Experience is active. The
host sets the control to the declared value, locks it, and explains which
Experience set it. A setup-file import cannot override the declared value. The
player's own earlier choice is kept untouched and is restored as soon as the
Experience is turned off. The spatial-map setup controls are hidden for these
Experiences, so no separate map draft, template, or builder is launched.

The Lorebooks step can select up to 100 individual enabled entries, including
entries from unattached books. Disabled books, entries, and chat exclusions are
respected. These ids travel in `GameSetupConfig.activeLorebookEntryIds`. On
`/game/setup` they are additive forced entries: they skip probability rolls but
retain ordinary token limits. Global, character-bound, and attached lore still
participate in the ordinary scan. Packages can read the same selected ids from
the setup config for their own world-generation request. Imported entry ids that
do not exist on this machine are reported and skipped.

A setup-file import restores an installed compatible Experience and its valid
numeric seed, but discards arbitrary package config. The current manifest supplies
constants again. A file that carries no usable Experience seed leaves the
prefilled random seed alone. Existing games skip Experience imports with an
explanation. Creation snapshots retain the Experience name and seed for the setup
summary.

Use the existing startup-readiness declaration independently when the world must
be prepared before the opening turn. Declare API 1.18 as the package minimum;
older hosts cannot interpret this setup declaration.

### Capability API 1.71: read messages as agents read them

In Roleplay, a message can carry whispers that are not part of its `content`. Every agent the Engine
runs reads them, and a package that reads the chat itself can now read the same text. Each record
from `persistence.listMessages(chatId)` gets `agentContent`: the message as Engine agents read it.
Each whisper sits at its place, marked `[Private whisper to <name>: …]`, and a message that is only
a whisper reads as its whispers. A document a character hands over, such as a letter, follows the
message. The player's private notes are left out.

`agentContent` is there only in Roleplay chats. It is missing in other modes and in a hosted
multiplayer room, where everyone sees what agents write. `content` never changes: it is still the
public text. `extra` doesn't change either: it is the message's saved data, with every whisper in it,
in every mode. Never show text built from it to players or characters a whisper was not for.

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

It is a soft seam: older Engines leave the field out, so a package that reads
`agentContent ?? content` does not need to declare 1.71. It needs the `chat-read` permission, like
`listMessages`. Whispers are private: anything a package writes from them, such as a note or a memory,
can reach characters the whisper was not for.

### Capability API 1.68: embed search queries as queries

`embeddings.embed(texts, signal?, inputType?)` takes a third argument: pass `"query"` for search
text, such as a recall query. Texts default to `"document"`. Some embedding models expect a prefix
on queries, and some also on documents: e5 and nomic-embed-text use one of each, and Snowflake
Arctic Embed v2 prefixes only queries. The Engine adds the right one. Recall is weaker when a query
is embedded as a document. Other models, including the built-in MiniLM embedder, get no prefix
either way. The input type does not change `spaceId`, so stored vectors stay comparable and nothing
needs re-embedding.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

It is a soft seam: an older Engine ignores the third argument, so a package can always pass it and
does not need to declare 1.68. Pass the input type as the third argument, never in an options
object: an older Engine hands the second argument straight to the provider as an abort signal.

### Capability API 1.67: open a character in the editor

The browser view gets `openCharacter(characterId, { tab })`. It opens the character editor, on the
given tab when there is one, so a package can send the user to a card field it reads. Older Engines
do not have it: check that `openCharacter` exists before you show the link.

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

### Capability API 1.66: scenes from package threads

A roleplay scene usually branches from a Conversation (`/scene`). A package holding the new `scenes`
permission can let its own threads, such as a direct-message thread, be the origin instead. The scene
is an ordinary scene chat: the same planner, prompt-preference dialog, scene instructions, End Scene,
Discard and Convert controls, and the same character memory when it concludes. The package owns the
thread side: what the planner reads, the lock while the scene runs, and what happens with the recap.

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

The browser view (`home-browser-tab`) receives these props:

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })` opens the
  scene prompt-preference dialog, plans and creates the scene, and opens its chat. Pass `plan` (a
  `SceneFullPlan`: name, description, hidden scenario, first message, scene system prompt, rating,
  relationship history, participation guide, background, cast) to write the scene yourself; the
  dialog and the Engine planner are skipped and the scene is created exactly as planned. It resolves to
  `{ chatId }`, or `null` when the user cancels or creating fails (the user sees why). The helper always
  uses the package's own id. It is a convenience, not a boundary: the scene routes accept any package
  id, so `getContext` must return only what the player may see in that thread anyway.
- `openChat(chatId)` goes to a chat, for a "Go to scene" button on a locked thread.
- `focusSceneOriginId` is the thread to show when the user comes back from a scene (Back, End Scene,
  Discard). Call `onFocusSceneOriginHandled()` once you have shown it.

Rules worth knowing:

- `data` is this scene's own settings, a plain JSON object of at most 4,000 characters. The Engine
  keeps it with the scene and passes it to `claim(originId, { sceneChatId, characterIds, data })` and
  to `release` as `end.data`, so each scene can decide for itself: `claim` may admit a scene without
  locking (return `true` and store nothing), and `release` may unlock without taking the recap, or
  take it at the reach the scene asked for.
- Only `getContext` is required. A package that just wants to start scenes leaves out `claim` and
  `release`: nothing is locked, any number of scenes can run from the same origin, and nothing is
  delivered when they end (**Back** still returns to the package). Leave out only `release` to lock
  without hearing the outcome, or only `claim` to hear outcomes without a lock.
- One provider per package; registering again replaces it, and deactivating removes it.
- `characterIds` must be Engine characters; unknown IDs are dropped, and a context without one known
  character is refused. An unknown `personaId` is treated as none. `notes` is cut at 8,000 characters
  and is given to the planner and, with the transcript, to the scene writer as hidden context.
- `claim` runs after the scene chat exists. `false` discards it with a 409; a throw discards it with
  a 503. `getContext`, `claim` and `release` each have 8 seconds: a late `getContext` or `claim`
  counts as a failure (503, the scene chat is removed), a late `release` is logged and dropped.
- `release` gets `concluded` (with `summary`, `description`, `scenario`, `rating` and the cast),
  `abandoned`, `deleted` or `converted`. It must be idempotent and must ignore a scene that does not
  hold the lock. A release that throws, or that arrives while the package is inactive, is logged and
  dropped: the scene chat stays ended either way, so reconcile a stale lock by reading the scene chat
  with `chat-read`. Its metadata has `sceneStatus`, and a concluded scene also has `sceneSummary`.
- The Engine writes nothing into a Conversation for a package origin. Character memory is stored on
  conclude exactly as for a Conversation scene.

`scenes` is refused on a manifest that declares a `capabilityApi` older than 1.66.

### Capability API 1.376: Home browser fullscreen

A `home-browser-tab` view receives `capabilityProps.browserFullscreen`:

- `active`: whether this package currently fills the Home browser content area.
- `setActive(boolean)`: enter or leave fullscreen for this active package.
- `enterLabel` and `exitLabel`: localized accessible labels for the toggle.

This is in-app fullscreen: Home's tabs, address bar and bookmarks are hidden, while the Engine
topbar stays available. It does not call the browser Fullscreen API or require browser fullscreen
support. The state is temporary and resets on navigation away from the package or Home. Keep an
exit button available on every package screen and use `aria-pressed` to reflect `active`. Prop updates
must update the button without replacing unfinished forms. Packages depending on this control
declare capability API 1.376 or newer; older packages can keep their existing layouts.

### Capability API 1.391: Advanced Memory scene summaries and the memory block

`persistence.listChatSummaries(chatId)` also returns `advancedMemory`: the chat's enabled, completed
Advanced Memory scene summaries, in the order they were written; a scene summarized again moves to the end,
so use `startMessageId` for story order. Each one has its `id`, `sceneId`, `kind` (`"scene"`), `title`,
`content`, `timeline`, `startMessageId`, `endMessageId`, `audienceCharacterIds`, `sourceFingerprint`,
`updatedAt` and `memory`. Older chats can hold several copies of one scene with the same `sceneId`.
Constant, temporary, excerpt and recollection records are not listed.

The `long-term-memory:runtime` service can add an optional `summaryMemoryInstruction()` method that
returns one paragraph, or `null`. When the chat lists Long-Term Memory as an active agent, the Engine
appends that paragraph to each first-pass request of a scene summary (every part of a scene split into
several) and asks for a `"memory"` string in the same JSON reply. It stores that string untouched and returns it as `memory`; the Engine never parses
it, so the package owns its format. A scene summarized in several parts gets each part's block, joined
by a blank line; the combining requests never see the blocks. The paragraph is capped at 4,000
characters.

`memory` is `null` when the reply had no block, after the user edits the summary by hand, and on records
written before 1.391. Without the method, or in a chat that does not list Long-Term Memory, the summary
request is unchanged.

The block is one flat string written from the whole scene, including messages some participants never
saw; unlike the recap, it has no per-reader sections. A package that shows memories to a character must
scope the record by `audienceCharacterIds` itself.

Older Engines do not return `advancedMemory`: check that it exists, or declare 1.391.

```ts
const scenes = (await api.runtime.persistence.listChatSummaries?.(chatId))?.advancedMemory ?? [];
```

### Capability API 1.390: the Engine draws an agent page header

A package with `contributions.agentDetail` can set `"header": "engine"`. The Engine then draws the
same header as on every other agent page: Back, the store banner and logo, the name, the Active
toggle for the open chat and Manage package. The `detail` view gets two extra props:
`engineHeader: true` and `headerSlot`, an element in the header actions. Hide your own header when
`engineHeader` is set, and render extra header buttons (for example "Add memories" or help) into
`headerSlot`, with a React portal or `appendChild`. `headerSlot` is `null` on the first render, so
wait for the next props update. Without the flag, the package keeps the full page as before.
Declare capability API 1.390 when you set it.

### Capability API 1.389: hide or show messages from the AI

`persistence.setMessagesHiddenFromAI(chatId, messageIds, hidden)` hides messages of one chat from the AI,
or shows them again, as the Engine's summary does with **Hide summarised messages**. It needs the
`chat-write` permission and changes the message and every swipe. A chat that is not found rejects.

- Ids that are not messages of this chat are ignored.
- A message whose visibility the user set by hand is never changed.
- It resolves the ids whose flag this call changed. A message that was already hidden (by the summary,
  for example) is not returned, so record the returned ids and show only those again later.

Older Engines do not have the method: check that it exists, or declare 1.389.

```ts
const hidden = (await api.runtime.persistence.setMessagesHiddenFromAI?.(chatId, messageIds, true)) ?? [];
```

### Capability API 1.388: a service only the Engine can read

Every service a package registers is readable by every other package through `runtime.services.get(key)`. A
service meant for the Engine alone, such as a runtime the Engine calls during generation, takes a third argument:

```ts
api.registerService("my-package:runtime", service, { hostOnly: true });
```

The Engine's own lookup still returns it. `runtime.services.get` returns `null` for it to every package, the owner
included. Releasing the service clears the flag, so the key can be registered again without it. An Engine older than
1.388 ignores the argument, so the service stays readable there; do not rely on `hostOnly` for secrecy on older
Engines.

### Capability API 1.387: read a chat's summaries

`persistence.listChatSummaries(chatId)` returns the summaries the Engine keeps for a chat, so a package
does not parse the chat's metadata for them. It needs the `chat-read` permission, like `listMessages`,
and returns copies:

- `day` and `week`: Conversation summaries by date (`"DD.MM.YYYY"`, a week by its Monday), each
  `{ summary, keyDetails }`.
- `rolling`: the rolling summary entries in the chat's order, disabled ones included (check `enabled`).
  A chat that only has the older single summary reads it as one entry with `origin: "legacy"`, dated
  with the chat's last update time.
- `gameSessions`: a Game's summary of each previous session. Every entry is complete: a missing text
  field reads `""`, a missing list `[]`, an older `revelations` list joins `keyDiscoveries`, and a missing
  `sessionNumber` is the entry's position (from 1). An entry without a date takes the chat's last update time.

A chat without summaries, or one that is not found, gets empty values. Older Engines do not have the
method: check that it exists, or declare 1.387.

```ts
const { day, week, rolling, gameSessions } = (await api.runtime.persistence.listChatSummaries?.(chatId)) ?? {};
```

### Capability API 1.386: open a connection, and raw generation for packages

The browser view gets `openConnection(connectionId)`. It opens the connection editor on that saved
connection, so a package that lets the user pick a connection can offer "Edit connection" instead of
its own provider settings. When the editor closes, Home comes back to the package's tab; leaving the
editor another way, such as opening a chat, does not. The desktop layout unmounts Home, and the
package view with it, while the editor is open: save what the user typed first. Older Engines do not
have it: check that `openConnection` exists before you show the button.

```ts
if (typeof props.openConnection === "function") props.openConnection(connectionId);
```

A browser package can also write text with a saved connection, without a server part of its own:
`POST /api/generate/raw` through the host api client, which adds the CSRF and admin headers.

- `connectionId`: the saved connection. Its saved parameters apply, and `parameters` (`temperature`,
  `maxTokens`, `maxContext`, `topP`, `topK`, `minP`, `frequencyPenalty`, `presencePenalty`,
  `reasoningEffort`, `verbosity`, `serviceTier`, `customParameters`, `enabledParameters`) overrides
  them one field at a time.
- `messages`: 1 to 200 `{ role: "system" | "user" | "assistant", content }`. Adjacent messages of one
  role are merged and the prompt is fitted to the model's context, as for the Engine's own generations.
- `streaming`: `true` answers with server-sent events; otherwise the answer is `{ content, runId }`, or
  `{ aborted: true, runId }`.
- `runId`: your id for the run. `POST /api/generate/raw/abort` with `{ runId }` stops it, and so does
  closing the request.
- `debugMode` (1.386): pass the browser view's `debugMode`. When it is true, or the server runs with
  `DEBUG_AGENTS`, the server logs the final messages sent to the provider and the reply. The body is
  strict, so an older Engine refuses the field: send it only when it is true, from a package that
  declares 1.386.

The events are `raw_started` (`{ runId }`), `token` (the next piece of text), `result` (`{ content }`,
the whole text), `aborted`, `error` (the message), `fallback_used` when the Engine's fallback connection
answered instead, and `done`, always last.

### Capability API 1.50: Professor Mari actions

A package holding the new `mari-actions` permission can offer named actions to Professor Mari. It
registers one service under its own id; Mari's `package_service` tool lists every offered action and
runs one when the user asks for it.

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

Rules worth knowing:

- The key must be `mari-actions:<package-id>` for the registering package. Registration throws without
  the permission or under another package's id, so an action Mari runs always belongs to the package it
  names.
- `list()` returns `{ name, summary?, inputs? }` entries. Names are 1 to 80 letters, digits, `.`, `_` or
  `-`; other entries are not shown. `summary` and `inputs` are what Mari reads, so write them in plain
  words. Only the first 50 actions can be seen or run, Mari sees at most 40 inputs per action, input
  names are cut at 80 characters and each text at 300 characters.
  `list()` must answer within 5 seconds, or the package's actions are left out.
- `run(name, input, { signal })` is called only with a listed name and a plain JSON object of at most 64,000
  characters. The input comes from a model: validate it against your own schema before doing anything.
  Answer `{ ok: true, value }` or `{ ok: false, status?, error }`; Mari sees the first 2,000 characters
  of the error text. `signal` aborts when the user stops Mari or after 5 minutes; the Engine stops
  waiting at that point, so stop your work too.
- The Engine elides data URLs in `value` before Mari reads it, and truncates long answers. Return ids
  and short text, not files.
- Listing is read-only. Every run counts as a change for Mari's Permissions Mode: Plan refuses it,
  Manual holds it for the user's Accept. The Engine cannot preview or undo a package action, so no
  Keep/Restore card is shown; offer an undo action of your own when a change is hard to take back.
  Because of this, Plan mode also refuses actions that only read.
- Deactivating or removing the package removes its actions.

`mari-actions` is refused on a manifest that declares a `capabilityApi` older than 1.50.

### Capability API 1.36: package achievements

A package holding the new `achievements` permission can add badges to the Home **Achievements** panel,
read whether they are unlocked, and unlock them. The panel shows them under a section headed with the
package name, after the Engine's own badges.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

Rules worth knowing:

- Ids are namespaced to `<packageId>.<id>`. A built-in id has no dot, so the two cannot collide. The
  host accepts the local or the namespaced id, and refuses any id the package did not register itself.
- `unlock(id)` resolves `true` only for the call that unlocked the badge. `isUnlocked(id)` and `list()`
  read state; `list()` returns the package's own badges with progress.
- Counting stays with the package. A ranked badge sets `target` and a `readProgress` callback, both
  or neither; the
  Engine unlocks it on the same pass as its own ranked badges once the count reaches the target. Keep
  the counter in the persistence host. A callback that throws, or does not settle within **2 seconds**,
  reports zero and is logged. As with tools, this bounds asynchronous waits only: synchronous work
  that blocks the event loop cannot be interrupted.
- `iconPath` is a path inside the package's asset root, served from the package assets route. A locked
  card still shows the padlock. When the art fails to load, the card falls back to `icon` (default
  `trophy`).
- `title` and `description` are the display text. A locale pack can override them through
  `capabilityAchievements.<packageId>.<id>.title` and `.description`.
- At most **32 badges per package**. A batch with one invalid entry registers nothing.
- Deactivating or removing the package hides its badges. Unlocks are kept, as with the Engine's own
  badges, and show again when the package returns.

`api.registerAchievements` and `api.runtime.achievements` only exist on an Engine this new, so a
package that uses them declares `capabilityApi` 1.36.

### Capability API 1.35: agent Home widgets

An agent package can offer up to three cards for the Home widget grid. The Engine never places them on
its own: the user adds, hides, restores, and reorders them in the **Widget Manager**, where they are
grouped under the agent. The Engine owns the grid, the frame, and the layout; the package owns what is
inside the card.

Declare the `home-widget` slot and the widget definitions together:

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id` is lower-case kebab case, at most 64 characters, and unique within the package.
- `label` (1–80 characters) and `description` (up to 200) are the Widget Manager text. A locale pack can
  override them through `localizations.<locale>.homeWidgets.<id>.label` and `.description`.
- `size` is `compact` or `large`. A large widget takes more room in the grid.
- `icon` is one of the Engine's icon names (`activity`, `bell`, `calendar`, `chart`, `circle`, `clock`,
  `file`, `flame`, `heart`, `image`, `list`, `message`, `sparkles`, `star`, `zap`). `iconPath` is package
  art (`gif`, `jpg`, `jpeg`, `png`, `webp`) and must be listed in `files[]`.
- `accent`, `surface`, and `header` pick from the Engine's presentation presets.

The install is refused when the package is not an `agent` with the `ui` permission and a client
entrypoint, when the slot and `homeWidgets` are not declared together, when two widgets share an id, or
when `capabilityApi` is older than 1.35.

The Engine mounts the package's client element with `view="widget"`. On top of the usual
`packageId`, `packageVersion`, and `localization`, `capabilityProps` carries:

- `widgetId`, `widgetLabel`, `widgetDescription`, `widgetIcon`, `widgetIconPath`, `widgetAccent`,
  `widgetSurface`, and `widgetHeader`: the definition of the card being drawn, so one bundle can draw
  every widget it declares.
- `active`: `true` only while Home is showing and the card is visible. Pause polling and animation when
  it is `false`.
- `onOpenNoodle()`: opens the package's own Home browser tab. Despite the name, it works for any package
  that also declares the `home-browser-tab` slot. Without that tab, it and `onOpenPost` do nothing.
- `onOpenPost(id)`: opens the package's own Home browser tab at one item. `id` is a string of up to 128
  characters; anything else is ignored. The tab's `view="browser"` element then receives
  `focusPostId: id`. It should call `onFocusPostHandled()` once it has shown the item, so the focus does
  not replay. Switching to any other tab drops a pending focus.

A widget is a small view of the agent, not a second copy of it. Keep it light, and send the user to the
browser tab for anything larger.

### Capability API 1.34: a creature written in the ruleset's own terms

A bestiary creature may carry a `sheet`: a character sheet in the ruleset's own terms, as partial as
it likes. A fight builds it exactly as it builds a party member, so its health, defense, saves,
initiative, speed and the abilities on its lists come from the ruleset's own declarations, and it
pays for them out of its own pools. It then gives none of `health`, `defense`, `initiativeModifier`,
`speed`, `abilities` or `saves` beside the sheet, and may have no block actions of its own:

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

The gate reads the ruleset's own bytes and every catalog file the install holds, exactly as 1.27
does. A row on a creature's sheet may carry `_catalog: "<catalog>/<entry>"` for an entry of a
catalog that feeds that list, and the Engine loads those catalogs for the fight along with the
bestiary. Not a soft seam, for the same reason as 1.20 through 1.33: an Engine that cannot read the
key refuses the whole strict catalog file, so a package that ships one declares 1.34. No permission.

### Capability API 1.33: the moment a reaction waits for

A catalog entry's `mechanics.reaction` may be an object rather than `true`. `on` names the moment
the Engine notices, `at` says whom what is taken is pointed at, and `cancels` stops what the window
was holding from happening at all:

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` is `aimed` (before something lands on the entry's holder) or `harmed` (after something has hurt
them), and naming one is what puts the entry on that window's menu. `at` is `source`, which fills in
whoever caused the moment, or `chosen`, which keeps the entry's own targets. Only an `aimed` entry
may `cancel`, because a moment that has already happened cannot be called off, and what a cancelled
action cost is still spent: it was paid for before anybody was asked.

An entry that still says `"reaction": true` says only that it is not taken on a turn, which is not
enough to offer it anywhere, so it stays on no menu and needs nothing newer. Not a soft seam, for
the same reason as 1.20 through 1.32: an Engine that cannot read the object refuses the whole strict
catalog file, so a package that ships one declares 1.33. No permission.

### Capability API 1.32: a weapon that caps its own strikes

An attack source may declare `strikesCappedBy`, a boolean column of its own list. Where that column
is set on a row, that row buys a single strike however many `strikes` the list buys, so a weapon
that fires once a turn stays one shot while the rest of the list swings as often as the sheet says.
SRD 5.1's Loading property is the sentence it exists for: "you can fire only one piece of ammunition
when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks
you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

It needs `strikes` beside it and is refused without one, because a list that buys one strike a spend
already holds every row to one. Not a soft seam, for the same reason as 1.20 through 1.31: an Engine
that cannot read the key refuses the whole ruleset file, so a package that ships it declares 1.32.
No permission.

### Capability API 1.31: host generation integrations

Server packages can call `api.runtime.integrations` to use the current Engine's LLM, image and video services. Declare capability API 1.31 in the package manifest and check that the integration host is available during activation. Older Engines reject the newer API requirement before activating the package. Provider operations require the `network` permission; saving, staging and removing media require `storage`.

- `llm.createProvider(...)` accepts the same connection settings as Engine's provider factory, including custom request parameters and headers. The returned provider supports `chat`, `chatComplete`, `embed`, `maxContextValue` and `maxTokensOverrideValue`. It exposes no credential properties.
- `llm.localSidecar()` returns the host's local sidecar provider through the same facade.
- `llm.withFallback(...)` wraps a provider created by the same package host. It preserves Engine's admission, fallback notifications and provider selection behavior.
- `images.generate(...)` and `videos.generate(...)` use the live Engine implementations, including cancellation, request logging, network checks and media queues. Forward the caller's `signal` and UI `debugMode` when present.
- `images.save`, `images.remove`, `images.stage` and `images.sweepStaged` reuse the gallery's safe writes and staged-file lifecycle. `videos.save` and `videos.remove` reuse the video storage path. `images.resolveNovelAiRequestSize` reuses the host's NovelAI size normalization. Video duration and public reference-upload normalization are also available through `videos.resolveDuration` and `videos.resolveReferenceUpload`.
- `speech.transcribe(audio, { filename, mimeType, signal })` sends recorded audio to the speech-to-text server the user set in **Connections → Speech to Text** and resolves the transcript, or `null` while that server is off, so the package keeps its own transcription. It applies the host's URL policy (`STT_LOCAL_URLS_ENABLED`), size and time limits, and never exposes the saved key. `speech` is optional and needs no newer capability API: check `typeof api.runtime.integrations?.speech?.transcribe === "function"` and fall back on older Engines.

Shared request/result types are exported by `@marinara-engine/shared`. Keep package-specific prompt building and orchestration in the package; call these host entrypoints for provider I/O instead of copying Engine service implementations. Pure helpers and types may still be bundled.

### Package audio

From capability API **1.381**, `__MARINARA_HOST__.services.audio` provides Engine-owned playback and
asset selection. Declare that minor in the package manifest, and update the Engine alongside the package.
Speech remains in `services.tts`; music and sound effects use `services.audio`.
`services.tts.ttsService.speakSequence(requests, id?, options?)` accepts `options.audioConnectionId`
from 1.381, applying that selected speech connection to every chunk while retaining each request's
voice. Leave it undefined for the normal default, or pass `""` to explicitly use legacy TTS settings.
An unknown, deleted, quarantined or non-speech `audioConnectionId` is ignored and normal speech
resolution runs: the saved speech selection, then the default/fallback connection, then legacy settings.
If the saved speech selection itself is unavailable, playback refuses rather than borrowing another
connection. Packages that require a particular connection should validate the saved ID before playback.

- `createPlayer()` returns an independent player with `unlock()`, `playMusic(tag, assets?)`,
  `stopMusic(immediate?)`, `playSfx(tag, assets?, loopCount?)`, `setVolumes({ music, sfx })`,
  `setMuted(boolean)` and `dispose()`. Volumes range from 0 to 1. `assets` is a record keyed by tag,
  whose entries have `{ path: string, url?: string }`; paths use the existing Game asset server, while
  `url` can address a package-owned asset. Playback reuses the Engine's crossfade, autoplay retry and
  SFX pool. Call `unlock()` directly in a user gesture when starting audio; browser autoplay rules still apply.
- Keep one player for the mounted package surface and call `dispose()` on unmount. Disposal permanently
  stops that player's audio, releases its context and gesture listeners, and makes later calls inert.
  It does not stop Game or another package's player. Create a new player when the surface mounts again.
- `getAssetManifest()` fetches `/api/game-assets/manifest` through the Engine API client and returns
  `{ scannedAt, count, assets, byCategory }`. Each asset has `tag`, `category`, `subcategory`, `name`,
  `path` and `ext`. Pass `manifest.assets` to playback; refetch after adding generated assets if needed.
- `selectDefaultMusic(cue, manifest, { currentTag?, genre? }?)` returns an existing music tag or `null`.
  Cues are `home`, `combat`, `boss`, `happy`, `tense`, `sad` and `bond`. It reuses the Game music scorer
  and only the state-based library; another Game's area/tier tracks and generated package-context
  tracks are excluded. Pass the current tag to keep fitting music stable. Choose again when the cue
  changes, rather than on volume changes. Stock cues can share a track: this helper does not generate
  music or promise a distinct composition for each mood.

For a generated `{ tag, path }` returned by the Engine, play it with
`player.playMusic(tag, { [tag]: { path } })`. Generation/provider selection stays server-side; packages
must not duplicate provider requests or access saved credentials. Use the Engine's generation endpoint
for opt-in generated music and effects, and keep generated context keys separate for each package world
and cue. A failed or unavailable generated track can fall back to `selectDefaultMusic`.

### Capability API 1.341: host runtime services and shared server libraries

A package server that bundles its own copy of an Engine service runs a second instance of it, with its own state:
its own Intiface connection, its own connection admission, its own chat metadata queue and its own service registry.
Capability API 1.341 adds `api.runtime` members that reach the Engine's live instances instead, and lets package
servers take a few libraries from the Engine instead of bundling them. Every new member is optional in
`CapabilityRuntimeHost`, so check that it exists before using it.

- `runtime.services.get(key)` returns a service a package registered with `api.registerService`, or `null` while it is
  absent or during a shared-room generation. It reads the Engine's own registry, so every package sees it.
  `agent-runtime:` and `mari-actions:` keys always return `null`; only the Engine reads those. So does a service
  registered with `hostOnly` (Capability API 1.388), for every package including its owner.
- `runtime.commands.parse(content)`, `strip(content)` and `instructions()` read conversation commands with the
  Engine's grammar and every package's registered tags.
- `runtime.logger.isLevelEnabled(level)` says whether the Engine logger writes that level now.
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })` is the Engine's queued metadata patch,
  with one queue per chat shared with the Engine's own writers, the shared-room guard and write ordinals. Keys in the
  patch replace those keys and every other key stays. `patch` may be a function of the current metadata. Inside
  `withChatLock` for the same chat it runs within that lock. Like `updateChatMetadata`, it refuses a new reference to
  a Global Gallery image that no longer exists.
- `runtime.persistence.appendMessages(chatId, messages)` adds messages, each with its first swipe, in one batch and
  returns them. `createChatNote` and `createChatInfluence` add a note or a one-time influence from a conversation to
  its connected roleplay. These four persistence members need `chat-write`.
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })` applies a
  `[schedule_update]` the way the Engine does after a Conversation reply: a temporary status on the character card,
  so the character shows it in every chat until it ends. `status` is `online`, `idle`, `dnd` or `offline`, `activity`
  is at most 500 characters, and one of the two is required. `duration` is written as the command writes it (`2h`,
  `30m`); without one, or with one it cannot read, the status lasts 60 minutes, and never more than a week. It resolves
  `{ status, activity, expiresAt }`, or `null` when nothing changed: a status the user set by hand stays in charge,
  and a shared room keeps its own routines. It rejects an update that is not valid, a chat that is not a Conversation
  chat and a character that is not in the chat, and it needs `chat-write`. It came to capability API 1.341 after the
  first Engines that report 1.341, so check `typeof api.runtime.persistence.updateCharacterStatus === "function"`, and
  skip the status change when it is missing.
- `runtime.integrations.admission` is the Engine's connection admission, so a package's background work waits for the
  user's own requests on the same connection. `withProvider(provider, connectionId, mode)` wraps a provider created by
  the same package's integrations, `run(connectionId, mode, operation)` runs one attempt, `tryBackground(connectionId)`
  takes the background slot when the connection is idle, and `isFailure(error)` recognizes the Engine's busy and
  rejected errors. It needs no permission because it only books slots.
- `runtime.integrations.haptics` (`status`, `connect`, `executeCommand`) uses the Engine's one Intiface Central
  connection. It needs `network`.
- `runtime.integrations.spotify` (`commandsAvailable`, `playSong`) uses the Music DJ agent's Spotify account.
  `playSong` rejects with `ConversationSpotifyCommandError`; the codes `spotify_unavailable` and
  `missing_playback_scope` mean Spotify is not set up, so drop the command quietly. It needs `network`.
- `runtime.integrations.speech.transcribeLocal(wav)` transcribes a PCM WAV recording with the Local Whisper model
  downloaded in **Connections**, and rejects with the Engine's message when it is not downloaded. It needs `network`.
- `runtime.integrations.images.addToChatGallery(input)` lists an image saved with `images.save` in the chat's
  gallery, and `images.persistToEntityGalleries(input)` lists it in the galleries of the characters and personas it
  shows, as Engine-generated images are. Both need `storage`.

**Never a bundled copy.** When one of these members is missing, the package reports the feature as needing a newer
Marinara Engine. It never falls back to a bundled copy of a stateful Engine service, such as the provider registry,
the local sidecar, connection admission, haptics, Spotify, the logger, a registry or a storage queue, because a second
copy splits state the Engine keeps in one place. Pure helpers and types may still be bundled.

**Shared server libraries.** A package server may leave `zod`, `adm-zip`, `dotenv`, `nanoid` and `jsonrepair` out of
its bundle and import them by name, as it already may for `@huggingface/transformers`, `onnxruntime-node`,
`onnxruntime-web`, `sharp`, `pino`, `pino-pretty` and `undici`. The Engine builds managed links in each package's
host-managed runtime copy by resolving its server's declared dependencies with Node's package resolver. This works
with direct, hoisted and partially hoisted dependencies, including when `DATA_DIR` is outside the Engine checkout.
Zod is the compatibility exception: a package's `zod` import resolves to the full `zod-v3` dependency, including its
default, named, CommonJS and subpath exports. Other libraries keep the very module instance the Engine uses. The
Engine's own `zod` imports continue to resolve to native Zod 4. The names above remain direct production dependencies
of `packages/server`. Managed snapshots link declared dependencies; undeclared transitives such as `ws` are not part
of the shared-library contract. Missing optional libraries are skipped, and installed development tools remain
available. A missing or incompatible Zod 3 alias fails activation explicitly instead of letting a package silently
load native Zod 4. Host dependency setup failures preserve the requested package version and rollback metadata;
after the Engine dependency is repaired, activation can retry without reinstalling the package.
Windows uses junctions for these links; source and launcher installs, Android and Termux, and both Docker images use
the same dependency-resolution contract. Legacy shared data links are refreshed when the physical server dependency
directory is available. Existing real directories are left alone, and fresh runtime copies resolve their dependencies
independently of that legacy data link. A package's own declared bundled dependency tree remains intact.

At startup, legacy API-1 packages disabled by the known Zod migration errors are retried through the normal
compatibility and file-integrity checks. This lets a repaired Engine recover an already failed installation without
deleting its maps or other package data. Other error messages remain disabled. Historical registry entries
record only error messages, so recovery recognizes the exact legacy `innerType` and nested `curve` failures.

**Declaring it.** A package that uses any of this declares `schemaVersion: 2`, `capabilityApi: { major: 1, minor: 341 }`
and `builtAgainst`, and keeps its `engine` range. A `schemaVersion: 1` manifest is never checked against the
capability API, so it moves to version 2. The capability API is the gate, not the Engine version: an Engine without
these members refuses the install or update ("Package requires capability API 1.341; this Engine supports ..."),
leaves the package out of its update list, and keeps the installed version running.
