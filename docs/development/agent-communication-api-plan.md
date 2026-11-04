# Agent Communication API Plan

## Status

Proposal. Nothing in this plan is implemented.

This is a Large feature under `.github/agents/chai-workflow.md` (new shared contracts, agent routing, install behavior), so it is phased and each phase is checked with the maintainer before it starts. Phases 1 through 3 are the recommended scope. Phases 4 and 5 are optional and need a separate decision.

Before any phase begins, follow the repository coordination rules:

1. Check for an existing issue, issue-linked branch, draft PR, or project item covering package-to-package communication. Issue #6561 (configurable agent order) was closed without implementation and is the closest prior request.
2. Establish visible ownership on the issue.
3. Open a draft PR against `staging` when implementation starts. One PR per phase. Each phase adds its own Capability API minor.

Package-side adoption (Long-Term Memory, Slurp, Noodle, Relationship Tracker, Memory Nag) happens in `Pasta-Devs/Marinara-Agents` after the Engine phase ships, and after the host overlay baseline in that repo (`scripts/esbuild-host-plugins.mjs`, `HOST_CAPABILITY_API`) moves to the new minor.

## Goal

Let installed agent packages talk to each other inside the Engine through contracts the Engine owns, so a package can:

- offer a service to other packages and know which package is calling;
- react when another package, or the Engine, does something (an agent finished, a chat changed, a package came online);
- hand data to agents that run later in the same turn;
- tell the user, in Agent Organizer, which packages it works with;

without importing another package, hard-coding another package's id, reaching into another package's documents, or trusting a caller name the caller typed itself.

Today packages already couple to each other, but through conventions nobody enforces. This plan turns those conventions into Engine contracts and adds the two channels that are missing: events and same-turn data exchange.

## Product Rule

The Engine mediates every package-to-package exchange. A package never names a peer except through a service key or event type, and it keeps working when the peer is absent.

- The Engine assigns caller identity. A package never self-reports who it is.
- Every new seam is a soft seam: a package feature-detects it and degrades quietly on an older Engine, the same way `runtime.services.get` returning `null` is handled today.
- Existing permissions gate existing data. Reading chat content through an event needs `chat-read`, the same as reading it through persistence. No new permission is added unless a seam exposes data no existing permission covers.
- Nothing is shown to the user unless it changes a decision. Agent Organizer shows "Works with" only when a manifest declares it. Everything else is visible only in Debug mode and the server log.
- Durable state stays where it is. Events are not storage. Package documents stay owned by the package that wrote them.

## Current Contracts

What a package can use today, and where it is enforced.

### Service registry (the only package-to-package channel)

`packages/server/src/services/capability-packages/capability-service-registry.service.ts` is a flat global `Map<string, unknown>`.

- `api.registerService(key, service, { hostOnly })` throws on a duplicate key and returns an identity-guarded cleanup. `capability-module-runtime.service.ts:409-413` wraps it in `trackCleanup`.
- Ownership is checked for two prefixes only: `agent-runtime:<ownId>` (needs the `agent-runtime` permission) and `mari-actions:<ownId>` (needs `mari-actions`). Any other key is unowned. Nothing stops package A from registering `b:recall`.
- `runtime.services.get(key)` (Capability API 1.341) is built per package in `capability-module-runtime.service.ts:166-173`, so the Engine already knows which package is calling, but it does not pass that identity on. It returns `null` for the two host-only prefixes, for `hostOnly` services (1.388), and during a shared-room generation.
- `listCapabilityServiceKeys(prefix)` exists on the server but is not exposed to packages.

Keys in use in `Marinara-Agents`:

| Key | Producer | Consumers |
| --- | --- | --- |
| `long-term-memory:recall` (v1) | long-term-memory | noodle, slurp2 |
| `long-term-memory:intake` (v1) | long-term-memory | slurp2 only, by a hard-coded allowlist |
| `long-term-memory:runtime` (hostOnly) | long-term-memory | Engine |
| `slurp2:actions`, `mari-actions:slurp2`, `slurp2:backup` | slurp2 | Engine |
| `noodle:backup`, `noodle:prompt-context` | noodle | Engine |
| `agent-runtime:<id>` | memory-nag, relationship-tracker, quartermaster | Engine |
| `hierarchical-maps:*` (5 keys), `conversation-calls:*` (2 keys) | generated server entries | Engine |

Every producer already uses the `<ownId>:` prefix. Consumers self-report a `caller` string that nothing verifies. The intake service has a `ponytail:` note naming an Engine-supplied caller id as the intended fix.

### Agent runtime hooks

`agent-runtime:<packageId>` services expose `prepareContext` and `finalizeResult` (`capability-agent-runtime.service.ts`). Each has a 2 s deadline. The agent type must equal the package id. Output lands in `context.memory._capabilityAgentContexts` and is rendered as `<agent_runtime_context>`. There is no `registerLifecycleHook` and no hook that fires for another package's agent.

### Same-turn visibility between agents

`packages/server/src/services/agents/agent-pipeline.ts` runs `pre_generation`, `parallel`, then `post_processing`. Within a phase there is no ordering. Agents sharing a connection are batched into one model call. What one agent can see of another in the same turn:

- `context.preGenInjections`, opt-in through `settings.includePreGenInjections`.
- `context.parallelResults`, opt-in through `settings.includeParallelResults`, rendered as `<parallel_agent_results>`.
- Rewrite agents get `memory._agentResults`, rendered as `<agent_results>`.
- `AgentContext.sceneCheck`, a shared claim.
- Chat metadata, used as a de facto shared store (`activeAgentIds`, `macroVariables`, `spatialContext`, summary keys).

`AgentResult.type` is a closed enum of 32 Engine values (`packages/shared/src/types/agent.ts:40-73`). A package agent has no generic result type, so its structured output has no typed place in `parallelResults`.

### Server to client

There is no WebSocket or EventSource in the client. The only push is the per-generation SSE stream (`routes/generate/sse.ts`). Package-addressed frames (`gm_verb`, `turn_game_state_patch`, conversation-call and spatial events) are re-dispatched on the client as the `marinara-capability-server-event` window event (`packages/client/src/lib/capability-client-events.ts`, detail `{ packageId, type, chatId, data }`). `agent_result` frames go to `agentStore.addResult` and are not forwarded to packages. Outside a generation, clients poll `GET /api/capability-packages/installed|catalog|agents`.

### Client host namespace

`globalThis.__MARINARA_HOST__` (`packages/client/src/lib/marinara-host-contract.ts`) is a frozen root with shared stores, services, pinned modules, the shared `queryClient`, and the api client. There is no client-side registry or event bus. Any package can dispatch `marinara-capability-server-event` or write a shared store. No sender identity exists on the client.

### Storage

`runtime.persistence.documents` (`capability-persistence.service.ts:378-456`, table `capability_documents`) takes a caller-supplied `packageId` with no ownership check. Any package can read or write any package's documents. The `storage` permission gates only image and video disk operations.

Built-in trackers write to `game_state_snapshots`. Slurp reads that table directly and documents that "the trackers have no documented read contract". Hierarchical Maps overrides the `location` column.

### Manifest

`contributions` is an Engine-owned open object. The schema has no `provides`, `requires`, `dependsOn` or `peers`. Every dependency is detected at runtime.

## Gaps

| Need | Today | Gap |
| --- | --- | --- |
| Know who is calling a service | Consumer sends `caller: "slurp2"` | Forgeable. Intake allowlist is hard-coded in the producer. |
| Stop a package from taking another's key | Only `agent-runtime:` and `mari-actions:` are owned | Any other key can be squatted or shadowed by activation order. |
| Find out what is available | `services.get(key)` only | No listing, no "is package X active". |
| React to something happening | None | No event bus on the server or the client. Polling or a hard-coded hook per case. |
| Agent A feeds agent B in the same turn | Opt-in text blocks, no ordering | No structured handoff, no package-owned result type, no dependency between agents. |
| Push to the client outside a generation | None | Clients poll. |
| Keep documents private | None | Any package reads any package's documents. |
| Read tracker state with a contract | Raw table reads | Schema drift breaks consumers silently. |
| Tell the user what works with what | Nothing in the manifest or Agent Organizer | Users discover pairings from release notes. |

## Architecture

Five seams. Each is independent, each is a Capability API minor, each degrades to today's behavior on an older Engine.

### Seam 1: Caller identity and key ownership

**Caller identity.** `registerService` takes a new option:

```ts
api.registerService(key, service, {
  hostOnly?: boolean;
  forCaller?: (caller: CapabilityServiceCaller) => unknown;
});

type CapabilityServiceCaller = Readonly<{
  packageId: string;
  packageVersion: string;
  permissions: readonly CapabilityPermission[];
}>;
```

When `forCaller` is set, `runtime.services.get(key)` from package X returns `forCaller({ packageId: "x", ... })` instead of the raw service, memoized per consumer for the life of the registration. The Engine's own reads keep getting the raw service. The producer decides what each caller sees, and the identity comes from the per-package runtime the Engine already builds, not from the request.

This is the smallest change that fixes the forgeable `caller` field. Long-Term Memory's intake moves its allowlist from a string constant to `forCaller`, and a user switch can later widen it without a package release.

**Key ownership.** A package may register only `<ownId>:<name>` keys, plus the two Engine-reserved prefixes with their existing checks. Enforcement follows the manifest's `capabilityApi.minor`: packages declaring the new minor or later get a throw in the existing `Capability package ${id} must ...` form; older packages get a warning in the log. Every published package already complies, so the warning path is expected to stay silent.

**Discovery.** Two read-only additions on `api.runtime`:

```ts
runtime.services.list(prefix: string): string[];        // keys visible to this caller
runtime.packages.isActive(packageId: string): boolean;  // activated server package
```

`list` applies the same host-only filtering as `get`. Both return empty or `false` during a shared-room generation, matching `get`.

### Seam 2: Server event bus

A single in-process bus owned by the Engine, exposed through `api.events`.

```ts
api.events.publish(type: `${ownId}:${string}`, payload: JsonValue, scope?: { chatId?: string }): void;
api.events.subscribe(
  type: string,                 // exact type or "<prefix>:*"
  handler: (event: CapabilityEvent) => void | Promise<void>,
): Cleanup;

type CapabilityEvent = Readonly<{
  type: string;
  source: string;               // publishing package id, or "engine"
  chatId?: string;
  payload: JsonValue;
  at: string;                   // ISO timestamp
}>;
```

Rules:

- Type namespace: a package publishes only under `<ownId>:`. The Engine publishes under `engine:`. Publishing outside the own namespace throws.
- Delivery is asynchronous and fire-and-forget. The publisher never awaits subscribers. Each handler gets a 2 s deadline, the same as agent runtime hooks. A timeout or throw is logged with the subscriber id and never reaches the publisher.
- A publish from inside a handler is queued, not delivered re-entrantly.
- Payloads must be JSON, at most 64 KB, matching the Mari action limit. Larger payloads throw at publish time, so the mistake is caught in development.
- Not durable. Nothing is replayed to a subscriber that activates later. Durable facts belong in `persistence.appendRoleplayEvent` or package documents.
- Handler order is activation order and is not a contract.
- Subscriptions are released through `trackCleanup` at teardown, like every other registration.
- Subscribing to an `engine:` type that carries chat content requires `chat-read`. The check happens at `subscribe`, in the existing permission-closure style, so a package without the permission fails at activation, not at the first event.
- Events do not fire during a shared-room generation, matching the service registry.

Engine-published events for the first release, kept to what packages are already working around:

| Type | Payload | Permission |
| --- | --- | --- |
| `engine:agent.result` | `{ chatId, agentId, agentType, resultType, success, messageId?, data }` | `chat-read` |
| `engine:generation.completed` | `{ chatId, messageId, mode }` | `chat-read` |
| `engine:chat.metadata.changed` | `{ chatId, keys: string[] }` (keys only, not values) | `chat-read` |
| `engine:package.activated`, `engine:package.deactivated` | `{ packageId, version }` | none |

`engine:agent.result` is emitted where `agentStore.addResult` frames are produced today. This is the event that lets Relationship Tracker react to Character Tracker's `presentCharacters` without reading a table, and lets Long-Term Memory take in a quest or relationship change without a producer-specific intake.

**Client fan-out.** A publish with `scope.chatId` during a generation for that chat also rides the generation SSE as a package-addressed frame and is re-dispatched through the existing `marinara-capability-server-event` path with `detail.type = event.type` and `detail.packageId = source`. No new transport. Events published outside a generation stay server-side until Phase 5.

**Client bus.** `__MARINARA_HOST__.events` mirrors the shape for client-to-client use:

```ts
host.events.publish(type, payload);   // host stamps source from the calling element's packageId
host.events.subscribe(type, handler); // returns Cleanup
```

The client bus is cooperative. All package code runs in one page, so sender identity on the client is a convenience, not a boundary. The document says so. Server-side identity is the only trusted one.

### Seam 3: Scoped documents and a tracker read contract

**Documents.** `runtime.persistence.documents` rejects a `packageId` that is not the caller's own. Same enforcement split as key ownership: throw for packages declaring the new minor, warn for older packages. Cross-package data moves through services and events, never through another package's rows. Engine-owned rows (`__engine__:<chatId>`) stay Engine-only as they are now.

**Tracker state.** A read-only Engine host member replaces raw table reads:

```ts
runtime.gameState.read(chatId: string): Promise<GameStateSnapshotView | null>;  // needs chat-read
```

`GameStateSnapshotView` is a shared type in `packages/shared/src/types/` that names the columns packages already read (`presentCharacters`, `personaStats`, `playerStats`, `weather`, `location`, `date`, `time`, `worldCustomFields`) and applies Hierarchical Maps' location projection when that package is active, so consumers get the same location the prompt gets. Writes stay with the Engine trackers. Slurp's `slp-agent-memory-source.ts` is the first consumer.

### Seam 4: Manifest declarations

An Engine-owned `contributions.services` block:

```json
"contributions": {
  "services": {
    "provides": [{ "key": "long-term-memory:recall", "version": 1 }],
    "requires": [{ "key": "slurp2:settings", "version": 1, "optional": true }]
  }
}
```

- `provides` keys must start with the package id. The install validator rejects a mismatch.
- `requires` is informational in this phase. Agent Organizer shows a **Works with** line on the package page listing the installed-or-not state of each provider. Nothing is blocked at install. `optional: false` is reserved for a later decision; in this phase it only changes the wording.
- Activation order: packages whose `requires` name another installed package activate after it, so a consumer's `activate` can find the provider. Cycles fall back to today's order with a warning.
- `version` is the contract version the service object already carries (`{ version: 1, ... }` in Long-Term Memory). A breaking change bumps the number and keeps the old key registered until consumers move. Non-breaking additions do not bump it.

The Agents-repo catalog build validates `provides` against the keys the server entry registers, so the manifest cannot drift from the code.

### Seam 5: Same-turn exchange and ordering (optional, maintainer decision)

Two additions to the agent pipeline. Both touch prompt assembly and batching, so they are the riskiest part and are listed last.

**Turn exchange.** A per-generation scratch map, visible to `agent-runtime` hooks and to pipeline agents through a Turn Data Access toggle:

```ts
context.turn.exchange.set(`${ownId}:${name}`, value);  // write-once per key per turn
context.turn.exchange.get(key): JsonValue | undefined;
```

`finalizeResult` of a pre-generation or parallel agent writes; `prepareContext` of a later-phase agent reads. Values are JSON, 16 KB each, dropped at the end of the turn. Rendered to the model only when the agent's settings opt in (`includeTurnExchange`, next to the two existing toggles in Custom Agents).

**Generic package result type.** Add `"capability"` to `AGENT_RESULT_TYPE_VALUES` with `data: { packageId, kind, value }`, so a package agent's structured output has a typed place in `parallelResults` and `_agentResults`, and `engine:agent.result` carries it unchanged.

**Ordering.** `agents.json` gains `runAfter?: string[]` (agent types). Within a phase, an agent with `runAfter` runs after the named agents when they are active in the chat, and is ignored otherwise. This is the narrow form of #6561, which was closed without implementation. The cost is real: an agent with `runAfter` leaves the shared batch for its connection and becomes its own model call. The toggle readout above the agent list must count it. This is the item most likely to be cut, and the plan works without it.

## Security and Trust Boundary

- The server is the trust boundary. Identity (`CapabilityServiceCaller`, `CapabilityEvent.source`) is assigned by the Engine from the activating package's manifest. A package cannot set it.
- Permissions are checked at registration or subscription, never per message, so a package without a permission fails at activation and the failure is visible in the log and the install flow.
- Event payloads and exchange values are bounded and JSON-only. No functions, no class instances, no shared mutable objects cross packages through events. Services remain the channel for live objects, as today.
- Handlers run under deadlines and cannot block the publisher, the generation, or teardown.
- Nothing in this plan widens what a package can read. `chat-read` still gates chat content. `engine:chat.metadata.changed` carries keys, not values.
- Client-side identity is cooperative and documented as such. Anything that needs trust goes through a privileged route or a server service.
- Shared-room generations keep every seam off, matching `getCapabilityService`.

## Delivery Phases

Each phase is one PR to `staging`, one Capability API minor, one regression script, one `### Capability API 1.NNN:` section in `docs/development/optional-agent-packages.md`, and a release-notes line stating the seam, its permission, and whether a declaration is required.

### Phase 1: Identity and ownership (Seam 1)

- `forCaller` registration option and per-consumer resolution in `runtime.services.get`.
- Key-ownership enforcement with the minor-gated throw/warn split.
- `runtime.services.list` and `runtime.packages.isActive`.
- Regression: a package registering a foreign key is refused; `forCaller` receives the consumer's id, not a self-reported one; host reads bypass `forCaller`; listing hides host-only keys.
- Agents-repo follow-up: Long-Term Memory intake moves its allowlist to `forCaller`; Noodle and Slurp drop the `caller` field once the overlay baseline moves.

### Phase 2: Server event bus (Seam 2)

- `api.events` with namespace, deadline, queueing, size and permission rules.
- The four `engine:` events.
- Chat-scoped events ride the generation SSE through the existing client dispatch.
- `__MARINARA_HOST__.events` on the client.
- Regression: namespace violation throws; subscriber timeout does not fail the publisher; `chat-read` is required for `engine:agent.result`; nested publish is queued; cleanup runs at teardown; a chat-scoped event appears as a package-addressed SSE frame.
- Agents-repo follow-up: Relationship Tracker subscribes to `engine:agent.result` for `character_tracker_update`; Memory Nag subscribes to `engine:generation.completed`.

### Phase 3: Scoped storage and tracker contract (Seam 3)

- Document ownership enforcement with the minor-gated split.
- `runtime.gameState.read` and `GameStateSnapshotView`.
- Regression: a foreign `packageId` is refused for new-minor packages and warned for older; `gameState.read` needs `chat-read` and applies the maps projection when active.
- Agents-repo follow-up: Slurp replaces its direct table read.

### Phase 4: Manifest declarations (Seam 4)

- `contributions.services` in the zod schema and the Agents-repo JSON schema.
- Install validation of `provides` prefix.
- Activation ordering by `requires`.
- Agent Organizer **Works with** line, localized through semantic keys.
- Regression: provider activates before consumer; cycle falls back with a warning; mismatched `provides` is refused at install.

### Phase 5: Same-turn exchange and ordering (Seam 5)

Needs a separate maintainer decision before it starts, because of the batching cost and the prior closure of #6561. If approved, split into two PRs: exchange and result type first, `runAfter` second.

### Deferred

- A persistent client event stream (`GET /api/capability-packages/events`, SSE) for events outside a generation. Decide after Phase 2 shows whether packages need it. Until then, clients keep polling.
- A user-facing switch for cross-package data sharing beyond what packages already offer (Long-Term Memory's "Other Agents can add memories"). Add only if a real complaint arrives.
- Enforced `requires` (install refused without the provider). Informational first.

## Expected File Changes

Engine, by phase.

| Phase | Files |
| --- | --- |
| 1 | `packages/shared/src/types/capability-runtime.ts` (caller type, `services.list`, `packages.isActive`), `packages/server/src/services/capability-packages/capability-service-registry.service.ts`, `capability-module-runtime.service.ts`, `packages/shared/src/schemas/capability-package.schema.ts` (minor bump and comment line), `scripts/regressions/capability-package-lifecycle.regression.ts` (assertion), new `scripts/regressions/capability-service-identity.regression.ts`, `docs/development/optional-agent-packages.md` |
| 2 | new `packages/server/src/services/capability-packages/capability-event-bus.service.ts`, `capability-module-runtime.service.ts` (`api.events`), `packages/shared/src/types/capability-runtime.ts` (`CapabilityEvent`), emit points in `routes/generate/` where agent results and completion are already written to SSE, `packages/client/src/lib/capability-client-events.ts`, `marinara-host-contract.ts`, `marinara-host.ts`, new `scripts/regressions/capability-event-bus.regression.ts`, docs |
| 3 | `capability-persistence.service.ts`, new game-state view type in `packages/shared/src/types/`, new host member in `capability-module-runtime.service.ts`, `scripts/regressions/capability-persistence-permissions.regression.ts`, docs |
| 4 | `capability-package.schema.ts` (`contributions.services`), install validator, activation ordering in `capability-module-runtime.service.ts`, Agent Organizer package page, `packages/client/src/locales/en/*.json`, docs |
| 5 | `packages/server/src/services/agents/agent-pipeline.ts`, `agent-executor.ts`, `packages/shared/src/types/agent.ts`, `capability-agent-runtime.service.ts`, Custom Agents settings UI and docs |

Agents repo: `schemas/package-manifest.schema.json` (Phase 4), `scripts/esbuild-host-plugins.mjs` baseline, `sources/host-runtime-overlay/.../host-runtime.ts` type, then per-package adoption listed under each phase.

## Tests

- Every phase ships a `scripts/regressions/capability-*.regression.ts` script that proves the refusal path and the success path, in the style of `capability-runtime-host-services.regression.ts`.
- `capability-package-lifecycle.regression.ts` asserts the new minor.
- Phase 2 adds an SSE-level check that a chat-scoped event reaches the client dispatch as a package-addressed frame and that a non-scoped event does not.
- Phase 3 adds a legacy-manifest row: a package declaring an older minor still reads a foreign document and gets a warning, so no installed package breaks on update.
- Phase 4 adds an Agent Organizer browser check for the **Works with** line in both themes and on mobile width.
- `pnpm check` and `pnpm localization:check` on every phase.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| An installed package breaks when ownership rules tighten | Throw only for packages declaring the new minor. Older packages warn. All published packages already use own-prefixed keys. |
| A slow subscriber delays a generation | Fire-and-forget delivery, 2 s deadline, publisher never awaits. Emit points are after the SSE write, not before. |
| Event storms from chatty packages | 64 KB payload cap, no durability, log at debug only. Add a per-package rate limit if a real case appears. |
| Packages lean on events for state they should persist | The doc section says events are not storage and are not replayed. |
| Phase 5 raises per-turn cost | `runAfter` leaves the shared batch and the cost readout counts it. Phase 5 is optional. |
| Agents-repo overlay baseline lags the Engine | Each phase's follow-up starts with the baseline bump. Packages feature-detect so a stale bundle keeps working. |
| Client bus mistaken for a trust boundary | Documented as cooperative. Trusted paths stay server-side. |

## Explicit Non-Goals

- No package imports another package's code. The build system in `Marinara-Agents` stays as it is.
- No remote-procedure layer, no serialization of functions, no cross-process transport. Everything is in-process on the server.
- No durable message queue. Roleplay events and documents remain the durable channels.
- No change to how the Engine reads host-only services, Mari actions, or agent runtime hooks.
- No new permission in Phases 1 through 4.
- No generic plugin-to-plugin UI composition on the client beyond the cooperative bus.

## Acceptance Criteria

- A package can register a service and learn, from the Engine, which package is calling it.
- A package cannot register a key under another package's prefix or read another package's documents when it declares the current Capability API.
- A package can subscribe to an agent finishing in a chat and react within the same process without polling.
- A package can find out whether a peer package is active without hard-coding anything but the peer's id.
- A chat-scoped package event published during a generation reaches that package's client element through the existing event path.
- Slurp reads tracker state through a typed Engine contract instead of the table.
- Agent Organizer shows which installed packages a package works with, when the manifest says so.
- Every seam degrades to today's behavior on an Engine that predates it, and every published package keeps working unchanged after each phase.

## Open Questions for the Maintainer

1. Phase 5 reopens the substance of #6561. Is a narrow `runAfter` acceptable now that the cost is counted in the readout, or should Phase 5 stay deferred?
2. Should `requires` ever block install, or stay informational for good?
3. Is a persistent client event stream worth its own transport, or is riding the generation SSE enough for the packages that exist?
