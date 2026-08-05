# World Maps Movement V4: Step by Step and Travel Now

Status: Proposed implementation plan

Tracking issue: [#4618](https://github.com/Pasta-Devs/Marinara-Engine/issues/4618)

Extends: [`hierarchical-locations-prd-v3.md`](./hierarchical-locations-prd-v3.md)

Historical inputs: the July 2026 recovery-branch documents, especially
`hierarchical-maps-future-roadmap.md` and
`hierarchical-maps-addon-recovery-plan.md`. They contain useful route and history
constraints, but they are not the current implementation plan.

## Decision

Finish the navigation that exists. Do not replace it with a second travel system.

World Maps already has directed one-hop resolution, atomic owner-turn movement,
spatial snapshots, idempotent command IDs, package route preview, a persisted
pending draft, and visible stale-state recovery. Multi-step travel needs one clear
pace choice:

| Mode             | Next accepted owner turn                           | Use                             |
| ---------------- | -------------------------------------------------- | ------------------------------- |
| **Step by step** | Move one validated edge and keep the target queued | Exploration and encounters      |
| **Travel now**   | Validate the complete route and move to the target | Backtracking and routine travel |

`Step by step` is the default. Selecting either mode only queues travel; it does
not move the chat, submit a hidden turn, or call a model.

Both modes extend `PendingSpatialTransition`. They use the existing snapshots,
command idempotency, prompt projection, package draft storage, and committed or
rejected SSE events. This plan adds no travel table, durable journey object,
background process, or immediate zero-turn mutation.

## Scope

Ship one target, two pace choices, shortest directed routes, server validation,
one spatial mutation per turn, Roleplay/Game parity, and deterministic failure
reconciliation. Keep movement and discovery separate.

Do not add narrated journeys, waypoints, scenic weights, travel time, goals,
background travel, another inference model, automatic links to unreachable
locations, or a `pendingSpatialTravel` protocol. The ordinary assistant reply can
narrate the canonical arrival.

## Current failure

The August 5 Roleplay reproduction shows two movement authorities acting in one
turn:

1. A multi-step route to a stratum was queued while the current location was a
   workshop.
2. The owner turn committed the expected first edge from the workshop to its
   guild parent at definition revision 11.
3. The assistant then emitted a hidden move to a known but unreachable tower.
4. The assistant-movement fallback created a bidirectional guild-to-tower link,
   incremented the definition to revision 12, and moved to the tower.
5. The pending route still expected revision 11 and became `Needs review`.
6. The fallback also recreated reciprocal records for a direct link the editor
   had already canonicalized.

This is not an ordinary stale-state conflict. Stepwise travel and implicit fast
travel both succeeded during one narrative turn and invalidated each other.

Required result:

- `Step by step` moves only to the guild and keeps the stratum target queued.
- `Travel now` validates the complete directed route and moves once to the
  stratum.
- Neither mode adds, removes, reverses, unblocks, upgrades, or duplicates a link.
- The server result rebases the pending draft instead of producing a false
  `Needs review` state.

## Reuse the shipped foundation

Use `resolveSpatialDestinations(...)` as the outgoing-edge authority and preserve
`validateSpatialTransition(...)` for legacy one-hop requests. Extend the current
snapshots, command hashes, `pendingSpatialTransitions` draft, package preview,
committed/rejected SSE events, and shared prompt projection. Do not create parallel
storage, history, or prompt paths.

## Product flow

Selecting a reachable distant location opens a compact route preview with a
segmented two-option control:

- `Step by step`: `Move one stop with each turn.`
- `Travel now`: `Reach the destination with your next turn.`

The queued target and mode remain visible and cancelable beside the composer.
Changing the selection updates the same pending draft. An adjacent destination
uses a one-edge route, so both modes have the same movement result.

### Step by step

For every accepted scene-addressed owner turn while the route remains queued:

1. Resolve authoritative current state and recompute the route to the target.
2. Validate the expected definition revision and current location.
3. Choose only the first route edge as the destination for this turn.
4. Commit that destination with the owner message.
5. Generate using the accepted next location's normal context and lore.
6. Return the accepted step and authoritative remaining route.
7. If the target was not reached, rebase the same draft to the accepted state and
   rotate to a new command ID for the next owner turn.

Only the accepted next location becomes current. Later route locations do not
activate their private memory or linked lore.

### Travel now

On the next accepted scene-addressed owner turn:

1. Resolve authoritative current state and recompute the complete route.
2. Reject the whole request if any step is invalid.
3. Commit one snapshot whose current location is the target.
4. Generate using destination context plus a bounded route summary.
5. Clear the pending draft after acceptance.

Intermediate locations prove reachability only. They do not become temporary
current locations and do not contribute private memory or linked lore.

`Travel now` is validated route compression, not teleportation. Hidden, blocked,
archived, missing, disconnected, or wrong-way edges make the target unreachable.

## Directed route rules

Route search repeatedly calls the same outgoing-edge resolver used for one-hop
movement. An active location has outgoing edges to:

- its active parent;
- each active child;
- each available direct-link target stored on the current location; and
- the source of an available incoming direct-link record only when that record is
  bidirectional.

Parent and child travel remains implicitly two-way. Direct links remain directed:

| Direction viewed from A | Valid route edge  |
| ----------------------- | ----------------- |
| Outgoing                | A -> B only       |
| Incoming                | B -> A only       |
| Both ways               | A -> B and B -> A |

Route search initially minimizes edge count. Existing destination ordering and
stable location ID provide deterministic tie-breaking. The client may display a
preview, but it never submits a route as authoritative.

The editor and runtime use the same unordered endpoint-pair canonicalization. No
save, import, movement, or discovery path may persist both a bidirectional record
and a reciprocal one-way record for the same pair.

## Extend the current contract

Do not add `PendingSpatialTravel`. Extend the current request compatibly:

```ts
export type SpatialTravelMode = "step_by_step" | "travel_now";

export interface PendingSpatialTransition {
  destinationId: string;
  travelMode?: SpatialTravelMode;
  expectedDefinitionRevision: number;
  expectedCurrentLocationId: string | null;
  commandId: string;
}
```

When `travelMode` is present, `destinationId` is the route target. When it is
absent, retain the shipped one-hop meaning and validation so an older package can
continue to submit an adjacent destination.

Extend the committed event instead of creating a new event family:

```ts
interface ResolvedSpatialTravel {
  mode: SpatialTravelMode;
  fromLocationId: string;
  targetLocationId: string;
  routeLocationIds: string[];
  remainingLocationIds: string[];
  complete: boolean;
}

interface SpatialTransitionCommittedData {
  chatId: string;
  commandId: string;
  currentLocationId: string | null;
  definitionRevision: number;
  travel?: ResolvedSpatialTravel;
}
```

The route arrays are bounded and contain stable IDs. The package resolves public
names for display. The server result controls current location and remaining
route; the client does not advance a local index speculatively.

The pending route stays in current per-chat draft storage. After an accepted
step, the package replaces its request state with the returned current location,
definition revision, remaining route, and a new command ID. `Needs review` is
reserved for a real external mismatch such as an edit, branch, swipe, checkpoint,
administrative repair, or import.

## One movement authority

Queued travel has priority for the accepted turn:

- After queued travel is accepted, strip but do not apply any assistant
  `spatial_move` or `spatial_discover` directive from that response.
- Do not call the unreachable-move `addAvailableLink(... bidirectional: true)`
  fallback from movement or location-guidance handling.
- Regeneration, continuation, and guided generation do not create owner turns and
  do not advance a route.
- `/impersonate` creates one owner turn and consumes the route once.
- Typed Roleplay, typed Game, CYOA, and other scene-addressed actions use the same
  movement-aware submission helper.
- Character-addressed and non-story actions do not consume a route.
- Unbound Game grid or node movement remains tactical and cannot change the World
  Maps location.

With no queued route, model-directed movement remains a narrow compatibility path:

- an explicit user-led arrival may move only to one currently reachable outgoing
  destination;
- an unreachable known location is rejected without changing current location,
  definition revision, or links; and
- generated narration without a valid directive never authorizes movement.

## Discovery is a separate mutation

Discovery may create topology only when it is the explicit spatial mutation for
the turn:

- discovering a new child may use the parent-child relationship;
- discovering a new direct link must include direction relative to the current
  location: `outgoing`, `incoming`, or `both`;
- a direct-link discovery without direction is rejected rather than defaulting to
  bidirectional;
- matching an existing known location is movement, not discovery, and cannot
  synthesize a missing link; and
- a turn with accepted queued travel cannot also mutate topology.

If reviewed discovery of links to existing locations needs more product design,
defer that mutation. Do not retain automatic bidirectional creation as a fallback.

## Commit and failure behavior

Preserve the commit ordering that V3 and current Engine already use.

### Normal owner turn

1. Validate and resolve travel under the existing generation lock.
2. Commit the owner message and spatial snapshot atomically.
3. Emit the committed result and assemble the destination-aware prompt.
4. Call the provider.

A provider failure after step 2 leaves the accepted owner message and movement
committed. The package must reconcile the command as accepted: rebase a stepwise
route or clear a completed route. It must not retry the same movement or mark it
`Needs review` merely because the assistant reply failed.

### `/impersonate`

Impersonation needs generated text before it can save the owner message:

1. Validate and resolve the route before provider generation.
2. Generate the impersonated owner text.
3. Commit that text and the resolved snapshot atomically.

A provider failure before step 3 leaves movement unapplied and the same pending
request retryable. An already-applied retry returns the existing saved owner turn
and committed event, as it does today.

### Rejection, abort, and disconnect

- A validation rejection occurs before writes and preserves the draft. A stale
  request becomes `Needs review`; an unreachable request explains that no valid
  directed route exists.
- After an ambiguous abort or disconnect, query authoritative state by command ID.
  If applied, reconcile it as accepted. If absent, retain the same request.
- Repeating an applied command with the same payload returns its committed result.
  Reusing a command ID with a different payload retains the current mismatch
  error.

Movement never edits the map definition. A successful route therefore does not
increment the definition revision.

## Prompt behavior

Extend the existing structured spatial projection with bounded accepted-travel
facts:

- mode;
- from and accepted-to locations;
- route target;
- remaining public route names for `Step by step`; and
- the validated public route summary for `Travel now`.

Render these facts as the issue's `<movement_this_turn>` section inside the
existing spatial prompt path, not as a user message or a second prompt channel.
The renderer tells the assistant that movement is already canonical and that no
second location change may be produced. It uses public names and authored edge
labels only, applies existing prompt budgets, and reports deterministic omission
in debug/Peek Prompt output. It does not inject intermediate private memory or
lore.

## Ownership

Marinara Engine owns shared contracts, commit timing, idempotency, failure
recovery, submission parity, and generic prompt/SSE extension points. The World
Maps package owns directed route behavior, the two-mode UI, draft reconciliation,
spatial directive/discovery behavior, package tests, generated payloads, artifact,
and catalog metadata.

Do not copy package-owned Maps UI or route behavior into Engine. Paired PRs should
cross-link issue #4618 and identify the exact package artifact under test.

## Implementation slices

### 1. Directed route contract

- Add `SpatialTravelMode` and the optional request/event fields.
- Add a bounded shortest-route resolver over `resolveSpatialDestinations(...)`.
- Keep requests without a mode on the existing one-hop path.
- Prove hidden, blocked, archived, disconnected, stale, and one-way fixtures.

Exit: either mode resolves deterministically without writing state.

### 2. One canonical owner-turn mutation

- Resolve the mode inside the existing owner-turn pipeline.
- Commit one snapshot and extend the existing committed event.
- Feed accepted travel into the shared spatial prompt projection.
- Suppress later assistant movement/discovery for that turn.
- Remove automatic link creation from ordinary movement.
- Preserve the documented normal-turn and `/impersonate` failure behavior.

Exit: the August 5 regression produces one movement, no definition edit, and no
false stale route.

### 3. Package modes and reconciliation

- Add the two-option control and default to `Step by step`.
- Extend the current pending draft rather than adding another store.
- Rebase stepwise progress from the committed event and rotate command IDs.
- Clear `Travel now` only after authoritative acceptance.
- Reconcile ambiguous failures by command ID.
- Install the exact package artifact into the paired Engine build.

Exit: desktop and mobile can queue, change, cancel, advance, retry, and complete
both modes without reopening the editor.

## Proof matrix

| Claim                                | Automated proof                                                                                       | Manual proof                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Step by step moves once              | A multi-hop fixture advances one edge and returns the remaining route                                 | Queue a route in Roleplay and Game and send successive turns           |
| Travel now validates the whole route | Available edges succeed; hidden, blocked, archived, disconnected, and wrong-way edges fail atomically | Preview a long route and inspect destination context                   |
| Direction is authoritative           | Forward, reverse, both-way, and duplicate-pair fixtures                                               | Try both endpoints of each direction setting                           |
| One turn has one spatial mutation    | Queued travel plus assistant directives applies only queued travel                                    | Repeat the workshop/guild/tower reproduction                           |
| Movement never edits topology        | An unreachable directive leaves definition and links byte-equivalent                                  | Request a known unreachable location and inspect the editor            |
| Discovery is explicit                | Direct-link discovery requires direction; known-place match cannot create a link                      | Discover a new place, then try prose against a known unreachable place |
| Server owns progression              | A stale client preview cannot choose the accepted step                                                | Edit the map in another tab before submission                          |
| Failures reconcile correctly         | Provider failure, abort, disconnect, and duplicate-command fixtures produce at most one snapshot      | Force a provider error, recover, and inspect the pending route         |
| Submission paths agree               | Roleplay, Game, CYOA, `/impersonate`, regeneration, continuation, and non-scene fixtures              | Exercise supported actions against the same route                      |
| Context stays bounded                | Long routes omit deterministically and never inject intermediate private context                      | Inspect Peek Prompt with a maximum-length route                        |

Required gates include focused Engine spatial and prompt regressions, Engine type
and lint checks, package route/UI regression, exact-artifact lifecycle regression,
catalog validation, and desktop/mobile browser coverage. Automated proof,
agent-operated browser proof, and human manual verification remain separate.

## Rollout

- Existing requests without `travelMode` retain one-hop behavior.
- Existing package route drafts load as `Step by step`; invalid drafts become
  `Needs review` rather than being silently rewritten.
- No map-definition schema bump or movement-data migration is required.
- The paired package declares the first Engine version with the extended travel
  contract and does not advertise it to older hosts.
- Do not claim issue #4618 fixed until both PRs and the exact installed artifact
  pass integration review.
- Leave all human validation checkboxes unchecked.

## What the recovery documents contributed

Keep:

- player-controlled travel pace;
- shortest valid routes and server recomputation;
- no partial movement on stale or invalid routes;
- destination-only context for fast travel;
- one-hop context for stepwise travel;
- bounded route facts; and
- snapshot-backed history without fake dialogue.

Drop:

- zero-turn `Travel now` and a new durable event table;
- `Narrate journey`, waypoints, goals, and scenic weights;
- per-chat model travel settings;
- autonomous multi-hop movement from generated prose; and
- roadmap work unrelated to dependable navigation.

The implementation target is two modes, one directed route resolver, one pending
draft, one owner-turn mutation, and one authoritative result.
