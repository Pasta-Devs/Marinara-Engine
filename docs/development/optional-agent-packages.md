# Optional Agent and Capability Packages

Status: implemented for the v2.3.0 development cycle in issue #3612.

## Objective

Marinara Engine's base distribution must not compile or ship optional agent and capability implementations. Fresh installations start with no optional packages. Upgrades preserve capabilities that were available before this package system was introduced.

The official catalog, package sources, reproducible artifacts, validation scripts, and contribution workflow live in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Installed artifacts live beneath the configured Marinara data directory so application updates cannot overwrite them.

## Package model

An agent package may contribute one or more declarative agents and optional trusted executable capabilities:

- server entry points for routes, lifecycle hooks, prompt providers, result handlers, and storage migrations;
- client entry points for panels, chat surfaces, settings sections, setup choices, and runtime displays;
- shared JSON schemas and stable wire contracts;
- package-owned assets, documentation, and Professor Mari knowledge fragments.

Packages target a versioned Marinara capability API. They must not import private source paths from the engine.

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

The base keeps the package manager, catalog client, generic agent pipeline contracts, generic turn-game host contracts, and inert extension points. Concrete implementations belong to packages.

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
