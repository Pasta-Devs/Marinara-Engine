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
package that *requires* them declares 1.11 and older Engines refuse it cleanly.

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
appeared, so a package that *requires* it declares 1.13.

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

The official catalog is a schema-validated, versioned JSON document fetched over HTTPS. Each release entry includes immutable artifact URLs, SHA-256 digests, byte sizes, engine compatibility, permissions, and whether its runtime requires a restart.

At server startup, the host fetches the catalog once when at least one official package is installed, selects only newer versions compatible with the running Engine and capability API, verifies them through the normal installation pipeline, and installs them before package runtimes activate. Failures are isolated per package. Existing files and registry state remain usable when the catalog is offline or verification fails, and server-runtime readiness failures use the previous-version rollback path.

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

The Agents panel contains a `Download Agents` control matching the Card Browser's `Download Cards` affordance. It opens a full-screen responsive library with search, package kinds, compatibility information, install/update state, permissions, storage cost, documentation, and uninstall controls.

Desktop uses a browse list with an adjacent detail region. Mobile uses one pane with explicit back navigation and touch-sized actions. Empty, offline, incompatible, corrupt-download, interrupted-install, update, rollback, and restart-required states are first-class.

## Extraction gate

An extraction is complete only when the base production client and server bundles no longer contain the package implementation, a fresh install cannot activate it without downloading the package, an upgraded install retains it, and package install/update/uninstall passes on desktop, mobile, and Termux-compatible filesystems.
