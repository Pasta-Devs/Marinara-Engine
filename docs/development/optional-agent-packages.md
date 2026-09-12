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
