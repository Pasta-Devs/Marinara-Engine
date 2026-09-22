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

The returned host has `spaceId`, `label`, and `embed(texts, signal?)`. Resolution uses the
configured embedding source and falls back to the built-in local MiniLM embedder when
none is available or configuration resolution fails. `embed` can return `null`; empty
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

The Download Agents detail view shows the installed version's declared permissions after installation.
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

Package runtime code has no way to ask the Decision model directly yet. That needs a capability API method and a version bump of its own.

Design every use for a user with no Decision model, which is most users. A statement with no answer reads as no, so the `{{else}}` branch, or nothing, must be a sensible default. Never write "requires Jev": a user's own local model often answers as well.

### A note for Game Mode Experience developers

Engine combat decides what ordinary enemies do on its own. Every non-boss enemy on the GM's side of a fight gets a role from its skills and class (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter or controller), a proficiency from its level unless the enemy sets one (novice, trained, veteran or master), and a temperament such as reckless, cautious, opportunistic or protective. Beasts and monstrosities are always mindless. Engine code picks these from a seed with no model call, and the game's difficulty changes how consistently enemies play to type. Only authored bosses are directed by the GM through a model call. See [Game Mode combat AI](game-combat-ai-design.md).

More combat improvements are on the way. Before involving a decision model anywhere in the combat pipeline, check that vanilla Engine combat does not already do what you need. If an enemy needs a particular personality, give it the matching proficiency and temperament first. A decision per enemy turn would add a network request, cost and a time limit to something the Engine settles locally and instantly, and a fight would then depend on a model the user may not have set up, which reads as "no".

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
`ruleset.json` that declares it, and is refused on its declared size above 1 MB before it is read.
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
is an Engine change that adds a kind, not something a ruleset can do. The format, the first-party 5e
file and the reasons behind its shape are in
[`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

This is not a soft seam. A ruleset package does nothing on an Engine that cannot read it, so a
manifest that lists `ruleset.json` must declare Capability API 1.20, and an older Engine refuses the
install cleanly.

The Engine refuses the asset on its declared size above 256 KB before reading it, re-verifies it
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

Shared request/result types are exported by `@marinara-engine/shared`. Keep package-specific prompt building and orchestration in the package; call these host entrypoints for provider I/O instead of copying Engine service implementations. Pure helpers and types may still be bundled.
