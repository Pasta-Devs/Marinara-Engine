# Generalized Proposed-Patch and Commit System

**Status:** Proposed architecture decision
**Scope:** Durable, agent-authored state derived from a canonical chat turn
**Reference implementation:** HumanOS Runtime commits
**Out of scope for this ADR:** candidate message publication, Phase 5 review, provider retries, UI-only preferences, caches, delivery jobs, and media generation

## 1. Problem

HumanOS Runtime currently has Marinara's strongest write contract: a canonical message anchor, server-owned turn identity, base revision, append-only revisions, persistent idempotency, and conflict detection. Other durable writers use heterogeneous storage paths. Some append snapshots, while others directly update aggregate or document rows.

That inconsistency creates four authority risks:

1. a rejected or edited draft may indirectly influence durable state;
2. two agents may overwrite the same target without deterministic ordering;
3. retries may duplicate or mutate state differently;
4. a stored value may have no durable evidence linking it to the canonical prose that authorized it.

The generalized system must make every governed write a two-step operation:

1. **Propose** a typed patch against a captured target revision.
2. **Commit** that patch only after canonical publication, policy validation, conflict checks, and deterministic ordering.

Agents propose state. The server owns commit authority.

## 2. Design principles

1. **Server-owned authority evidence is mandatory.** Agent-authored and automatically inferred commits require canonical message/swipe/hash evidence. User, administrator, repair, and migration commits require an explicit server-owned authority record and may not forge canonical-turn provenance.
2. **Proposals are not state.** A proposal may be stored for audit, but projections and ordinary reads ignore it until committed.
3. **Commit authority is server-only.** Models cannot supply revision coordinates, canonical hashes, commit order, or idempotency identity.
4. **Targets are independently revisioned.** Conflicts are checked per logical target, not against one global chat revision.
5. **Committed history is append-only.** Mutable application tables are projections of committed history, not the audit authority.
6. **Retries are exact or rejected.** Reusing an idempotency key with identical normalized input replays the prior result; different input is an idempotency conflict.
7. **Ordering is deterministic.** Same-turn patches are sorted by server-assigned phase, target key, writer priority, and proposal ID.
8. **Adapters validate semantics.** The generic kernel owns authority and concurrency; target adapters own patch schemas, invariants, and projection updates.
9. **Failure scope is explicit.** Required commits block their declared boundary; degradable commits record failure and do not poison unrelated targets.
10. **Operational state is not automatically narrative state.** Caches, vectors, thumbnails, delivery receipts, and device/UI preferences stay outside this ledger unless they become story-authoritative.

## 3. Governed and excluded writes

### 3.1 Governed targets

A write is governed when it is agent-authored or automatically inferred from canonical prose and changes durable narrative truth or future generation context.

Initial target kinds for the roleplay/chat product:

- `humanos_runtime`
- `character_truth_observation`
- `character_branch_hypothesis`
- `world_state`
- `relationship_state`
- `character_memory`
- `director_memory`
- `lorebook_entry`
- `chat_summary`
- `message_narrative_metadata`

Game/session adapters are not part of this implementation roadmap. The generic kernel remains extensible, but no game-state migration, target decomposition, or compatibility work is required for this project.

### 3.2 Excluded by default

These remain ordinary operational writes unless a later ADR promotes them:

- image, sprite, audio, and video generation jobs;
- Discord/Home Assistant delivery state;
- embeddings and vector indexes;
- search caches and derived activation indexes;
- typing/activity indicators;
- local presentation preferences, layout, theme, and transient HUD state;
- telemetry, logs, and agent-run diagnostics;
- candidate publication lifecycle, which already has its own authority boundary.

A UI-facing value that becomes canonical story state must use a governed target adapter. “It is shown in the HUD” is not itself enough to classify it.

## 4. Core model

### 4.1 Server-owned authority evidence

The ledger uses an explicit evidence union:

```ts
interface CanonicalTurnEvidence {
  kind: "canonical_turn";
  chatId: string;
  turnId: string;
  messageId: string;
  swipeIndex: number;
  sourceContentHash: string;
  canonicalRevision?: number;
}

interface ExplicitAuthorityEvidence {
  kind: "manual_edit" | "repair" | "migration";
  authorityRecordId: string;
  chatId?: string;
  reason: string;
  sourceHash?: string;
}

type CommitEvidence = CanonicalTurnEvidence | ExplicitAuthorityEvidence;
```

The server creates canonical-turn evidence after promotion and revalidates it immediately before each agent or automatic commit batch. Manual, repair, and migration paths create explicit authority records with authenticated actor identity and reason. Models never receive authority to alter either form. If selected canonical content changes, outstanding canonical-turn proposals become stale and cannot commit.

### 4.2 Proposal envelope

```ts
interface StatePatchProposal<Patch = unknown> {
  proposalId: string;             // server generated
  schemaVersion: number;
  targetKind: GovernedTargetKind;
  targetScope: string;            // adapter-normalized scope
  targetId: string;               // entity/document/aggregate ID
  targetKey: string;              // `${kind}:${scope}:${id}`
  operation: string;              // adapter allowlist
  patch: Patch;                   // normalized typed payload
  patchHash: string;              // canonical JSON hash
  baseRevision: number;           // captured by server
  evidence: CommitEvidence;
  actor: {
    type: "agent" | "user" | "administrator" | "system";
    id: string;
    authorityPath: "canonical_turn" | "manual_edit" | "repair" | "migration";
    agentRunId?: string;
    pipelineStage?: "post_canonical_tracking" | "post_canonical_commit";
    priority: number;             // server configuration
  };
  commitGroupId: string;          // server owned logical outcome boundary
  dependencyIds: string[];        // server-owned proposal/group prerequisites
  failureBoundary: "proposal" | "target" | "group" | "turn";
  failureMode: "required" | "degradable" | "optional";
  idempotencyKey: string;         // server derived
  createdAt: string;
}
```

Recommended idempotency derivation:

```text
sha256(
  schemaVersion | targetKey | operation | patchHash |
  authorityEvidenceFingerprint |
  actorType | actorId | authorityPath | logicalPatchSlot
)
```

`logicalPatchSlot` is a server-owned stable name such as `relationship:user:char-1` or `summary:rolling`. It prevents a retry from creating another logical patch while allowing one agent to propose multiple distinct targets.

### 4.3 Proposal states

- `proposed`: validated structurally but not committed;
- `committed`: ledger row and projection committed atomically;
- `replayed`: exact retry resolved to an existing committed result;
- `rejected_policy`: forbidden target, operation, writer, or scope;
- `rejected_evidence`: canonical anchor no longer matches;
- `revision_conflict`: target revision changed;
- `idempotency_conflict`: key reused for different normalized input;
- `validation_failed`: adapter invariant failed;
- `superseded`: optional proposal replaced before commit within the same batch;
- `commit_failed`: storage failure; no projection or committed ledger row may remain partially applied;
- `out_of_scope`: an unresolved proposal reached the 90-day limit and was compacted without changing state.

Proposal identity, authority fields, target, operation, payload, hashes, evidence, and idempotency identity are immutable after insertion. Only resolution fields (`status`, `resolved_at`, `diagnostic_json`, and `commit_id`) may change. No generic proposal-patch API is exposed.

Terminal failures remain durable audit records and do not alter target projections. Unresolved proposals remain available until resolved; if still unresolved after 90 days, they become compact `out_of_scope` tombstones retaining proposal identity, idempotency key, patch hash, evidence identity, timestamps, and final status. Committed ledger rows are permanent.

## 5. Storage schema

Use three generic tables. Target-specific snapshot tables may remain, but the generic ledger becomes the authority for governed commits.

### 5.1 `state_patch_proposals`

Suggested columns:

- `id` primary key;
- `schema_version`;
- `target_kind`, `target_scope`, `target_id`, `target_key`;
- `operation`;
- `patch_json`, `patch_hash`;
- `base_revision`;
- evidence-kind and evidence-union columns, including canonical coordinates or explicit authority-record identity;
- `actor_type`, `actor_id`, `authority_path`, optional `agent_run_id`, optional `pipeline_stage`, `writer_priority`;
- `commit_group_id`, `dependency_ids_json`, `failure_boundary`, `failure_mode`;
- `logical_patch_slot`;
- `idempotency_key` unique;
- `status`, `diagnostic_json`;
- `created_at`, `resolved_at`.

Indexes:

- unique `idempotency_key`;
- `(target_key, status, created_at)`;
- `(chat_id, turn_id, status)`;
- `(message_id, swipe_index)`;
- `(agent_run_id)`.

### 5.2 `state_target_heads`

One row per logical target:

- `target_key` primary key;
- `target_kind`, `target_scope`, `target_id`;
- `revision`;
- `last_commit_id`;
- `state_hash`;
- `updated_at`.

This is the compare-and-set head. It avoids inferring revisions from mutable application rows or scanning history.

### 5.3 `state_commit_ledger`

Append-only committed history:

- `id` primary key;
- `proposal_id` unique;
- `target_key`;
- `base_revision`, `result_revision`;
- `operation`, `patch_json`, `patch_hash`;
- `before_hash`, `result_hash`;
- server-owned authority-evidence columns;
- actor identity and authority-path columns;
- deterministic `batch_id` and `commit_order`;
- `commit_group_id` and dependency provenance;
- nullable `compensates_commit_id`;
- `idempotency_key` unique;
- `committed_at`.

No update or delete API is exposed for committed rows. Administrative repair must create a compensating commit with explicit provenance. User, administrator, system, and agent writes share this ledger and target-head model through the actor-aware envelope. During migration, compatibility edit APIs may remain, but every governed write must advance the target head and append an external-authority commit so stale agent proposals cannot overwrite it.

## 6. Target adapter contract

```ts
interface GovernedStateAdapter<Patch, Projection> {
  readonly targetKind: GovernedTargetKind;
  readonly schemaVersion: number;

  normalizeTarget(input: unknown, authority: CommitAuthority): TargetIdentity;
  normalizePatch(operation: string, input: unknown): Patch;
  validatePolicy(proposal: StatePatchProposal<Patch>, authority: CommitAuthority): void;
  loadProjection(tx: DBTransaction, target: TargetIdentity): Promise<Projection | null>;
  applyPatch(current: Projection | null, operation: string, patch: Patch): Projection;
  validateResult(current: Projection | null, result: Projection): void;
  persistProjection(tx: DBTransaction, target: TargetIdentity, result: Projection): Promise<void>;
  hashProjection(result: Projection): string;
}
```

Adapters must be deterministic and side-effect-free until `persistProjection`. Network calls, model calls, embedding generation, and event emission are forbidden inside commit transactions.

## 7. Commit algorithm

### 7.1 Proposal phase

1. A post-canonical tracker invokes a target-specific proposal tool.
2. The tool runtime supplies canonical evidence, active subjects, allowed target kinds, and current target revisions.
3. The adapter normalizes target identity and patch content.
4. The kernel calculates hashes and the idempotency key.
5. The proposal is inserted as `proposed`, or an exact prior proposal/result is returned.
6. No application projection changes.

### 7.2 Batch planning

After all tracker proposals for the turn are collected:

1. reload and verify the canonical message/swipe/hash;
2. group proposals by `targetKey`;
3. reject duplicate logical slots with different payloads;
4. sort by:
   - pipeline phase rank;
   - `targetKind` rank;
   - `targetKey` bytewise ascending;
   - configured writer priority ascending;
   - `proposalId` ascending;
5. build independent target batches;
6. detect mutually exclusive operations through adapter policy.

Do not let model completion timing determine commit order.

### 7.3 Per-target transaction

For each target batch:

1. begin a database transaction;
2. check for an existing row by idempotency key;
3. revalidate canonical evidence;
4. load or create the `state_target_heads` row;
5. require `head.revision === proposal.baseRevision`;
6. load the current projection and verify its hash against the head;
7. apply and validate patches in deterministic order, assigning every committed proposal its own consecutive revision (`n→n+1`, then `n+1→n+2`);
8. calculate and retain each intermediate result hash;
9. persist the final projection once when the adapter can stage all deterministic intermediate states safely;
10. append one ledger row per proposal with its unique base/result revision and intermediate result hash;
11. compare-and-set the target head to the final revision/hash;
12. resolve proposal statuses;
13. commit;
14. emit events and schedule derived jobs only after transaction success.

If an adapter cannot deterministically represent and hash intermediate states, the caller must submit one normalized compound proposal instead. Multiple ledger rows never share one result revision.

If any transactional write fails, the projection, ledger, head, and proposal resolution must roll back together.

### 7.4 Cross-target behavior

SQLite cannot provide useful distributed semantics across external systems, so the default unit of atomicity is one target key.

- `commit_group_id`, `dependencyIds`, and `failureBoundary` are assigned by the server, never the model.
- The default failure boundary is `target`.
- `group` is used only when cross-target partial success would violate a declared story invariant.
- `turn` is reserved for genuinely inseparable transitions and must not become the lazy default.
- A required proposal failure blocks its declared boundary and records all unattempted required dependents as blocked.
- A degradable proposal failure does not roll back already committed unrelated target keys.
- Dependencies between target keys must be explicit DAG edges. A dependent target commits only after all required parents succeed.
- There is no silent best-effort ordering.

## 8. Conflict and merge policy

Default policy is **reject on revision conflict**. Automatic merge is adapter-specific and opt-in.

Safe merge candidates:

- append-only memory observations with unique evidence IDs;
- set-union tags with canonical normalization.

The first production release does not enable automatic merge. These are future adapter-specific candidates only after reject-on-conflict behavior is proven.

Never auto-merge by default:

- relationship trust/intimacy values;
- world facts with contradictory values;
- summary replacement;
- lorebook prose edits;
- deletes.

A merge-capable adapter must record both the originally proposed base revision and the actual merge base/result in diagnostics. It must generate the same result for the same inputs.

## 9. Read model and recovery

Ordinary application reads continue using target projection tables for performance. Audit/debug reads use the generic proposal and commit ledger.

Recovery rules:

- rebuildable adapters may reconstruct projections by replaying ledger rows;
- non-rebuildable adapters must retain periodic checkpoints with a ledger revision;
- projection/head hash mismatch is corruption and fails closed;
- undo is a compensating proposal, never deletion of history;
- canonical message edits invalidate outstanding proposals but never auto-revert committed state;
- prior commits remain historically linked to their original evidence hash;
- evidence changes create an `evidence_superseded` provenance/reconciliation signal;
- any state correction requires an explicit compensating commit validated against the current target revision.

## 10. Security and tool authority

Expose target-specific proposal tools, not a generic arbitrary JSON writer.

Examples:

- `propose_character_truth_observation`
- `propose_character_branch_hypothesis`
- `propose_relationship_patch`
- `propose_world_state_patch`
- `propose_memory_observation`
- `propose_lorebook_entry_patch`
- `propose_chat_summary_patch`

Each tool is scoped by server-owned callbacks containing:

- canonical evidence;
- active chat/character/persona IDs;
- allowed target kinds and operations;
- captured base revisions;
- actor identity, authority path, configured failure mode, and server-owned commit boundary.

Trackers cannot:

- choose another chat or inactive subject;
- supply canonical hashes, revisions, writer priority, commit groups, failure boundaries, dependencies, or idempotency keys;
- commit directly;
- mutate architecture data through a Runtime/state tracker;
- call proposal tools before canonical promotion.

## 11. Character Truth Model

The Character Truth Model is a governed roleplay subsystem, not migration shadowing.

### 11.1 Private truth observations

`character_truth_observation` records private, evidence-linked inferences about an active character's current internal state, including thought direction, mood, tone, emotion, cognition, defenses, wound activation, attachment pressure, and psychologically plausible intent.

Observations:

- are derived only from canonical evidence plus the character's stable HumanOS architecture and prior committed observations;
- include confidence, evidence references, observation time, and optional supersession links;
- are private generation context, not claims exposed automatically in dialogue;
- may be contradicted or superseded by later canonical evidence without deleting history;
- must distinguish observed behavior from inferred internal state;
- cannot rewrite stable character architecture.

### 11.2 Branch hypotheses

`character_branch_hypothesis` stores derived planning possibilities: believable next actions, future branch scenarios, rupture/repair paths, and arc trajectories consistent with current private truth.

Hypotheses:

- reference source observation commit IDs and the architecture version used;
- carry confidence, assumptions, branch conditions, horizon, status, and expiry;
- are versioned derived projections rather than canonical facts;
- may guide composition and Narrative Director planning;
- cannot directly mutate observations, Runtime, relationships, lorebooks, or canonical prose;
- become historical facts only when later canonical evidence separately authorizes an observation or state commit.

This prevents a plausible future from becoming a fake memory merely because a model predicted it with confidence. Private truth tracks what is currently inferred; branch hypotheses track what might believably happen.

### 11.3 Chat-bound Relationship Save File

Character Truth and relationship progression are stored in a server-managed **Relationship Save File**, not in the reusable character card or persona card. Its logical identity is the tuple:

- `chatId`;
- `characterId`;
- `personaId`.

The save file loads automatically with its chat and preserves the specific relationship developed between that character and that user persona. A different persona in the same character chat, or the same persona in a different chat, receives a different save identity. Deleting the chat deletes its relationship save through an explicit audited cascade; deleting or editing an individual message does not silently erase established relationship history.

The authoritative save consists of ledger commits, milestone records, checkpoint lineage, active truth state, and canonical evidence references. It never mutates character-card architecture or persona-card identity. In v1 it is strictly chat-local. A later continue/import workflow may explicitly fork a save into another chat, preserving source provenance and requiring user confirmation; automatic cross-chat inheritance is forbidden.

### 11.4 Ten-message checkpoint and semantic classification

After every **10 new canonical messages** since the last successful checkpoint, schedule one derived relationship-summary checkpoint. Only canonical messages count; candidates, rejected drafts, retries, agent diagnostics, and regenerated non-selected swipes do not. The job is idempotent for the covered canonical range and may be retried without creating a second logical checkpoint.

Each checkpoint records:

- the covered canonical message range and ordered message/swipe content hashes;
- the previous checkpoint ID and relationship-save revision;
- the summary policy/model version and creation reason;
- the active relationship state and Character Truth token estimate;
- semantic classifications and source commit IDs;
- validity or staleness after later canonical edits.

The semantic classifier assigns extracted material to one of three retention classes:

1. `fleeting` — transient mood, tone, momentary expectation, or scene-local cognition that does not materially change the relationship;
2. `currently_relevant` — an unresolved truth, pressure, belief, defense, desire, promise, or conflict that should continue influencing behavior;
3. `milestone` — a durable turning point that changes the relationship's achieved state or the interpretation of later interactions.

Typical milestones include first trust, significant rupture or repair, confession, revealed wound, changed boundary, major promise, betrayal, forgiveness, commitment, intimacy threshold, and a durable change in attachment or power dynamics. Classification is evidence-linked and may be corrected only through a later governed commit.

Fleeting observation payloads may be compacted after a verified checkpoint preserves their semantically relevant effect. Their proposal identity, commit hash, evidence identity, retention class, and checkpoint provenance remain as replay-safe tombstones. Currently relevant truths remain hot until resolved, superseded, or promoted to milestones. **Milestone payloads and provenance are retained for the life of the chat and are never deleted by routine compaction.**

### 11.5 Token-budget compaction and lorebook projection

When active Character Truth reaches its configured prompt token budget, schedule semantic compaction. Compaction must:

1. retain all unresolved currently relevant truths needed for believable behavior;
2. retain milestone identity, meaning, sequence, and evidence provenance;
3. collapse redundant or fleeting detail into a concise relationship-state projection;
4. preserve links to source checkpoints and commits;
5. produce a deterministic, versioned result for the same ordered inputs.

The prompt-facing result is a **private, chat-scoped managed lorebook projection** linked to the Relationship Save File. It loads automatically only for the matching chat, character, and persona. It is a rebuildable read model—not the authority—and must never overwrite or merge into a user-authored lorebook, character card, or persona card. If its hash or provenance diverges from the save file, it is marked stale and rebuilt from the latest valid checkpoint plus subsequent commits.

The projection should contain the achieved relationship state, permanent milestones, unresolved relevant truths, current relational pressure, and only the minimum private Character Truth required for consistency. Branch hypotheses remain separately labeled speculative context and are never serialized as relationship facts.

## 12. Writer migration matrix

| Current writer | Classification | Initial target/adapter | Migration rule |
|---|---|---|---|
| HumanOS Runtime | Append-only snapshot | `humanos_runtime` | Refactor existing storage behind generic kernel; preserve row/history compatibility |
| Character private-state tracker | Append/supersede observation | `character_truth_observation` | Commit evidence-linked observations; never expose inferred thought as canonical dialogue fact |
| Character branch planner | Derived versioned projection | `character_branch_hypothesis` | Reference observation commits; hypotheses guide planning but have no direct mutation authority |
| World facts used by roleplay | Mutable aggregate | `world_state` | Patch allowed narrative fields through aggregate adapter; forbid direct tracker updates |
| Relationship Save File | Chat-bound aggregate plus append-only milestones | `relationship_save` | Key by chat, character, and persona; auto-load with chat; never mutate cards; retain milestones for chat lifetime |
| Relationship values | Mutable aggregate, high conflict risk | `relationship_state` | Store inside or reference the matching relationship save; reject conflicts by default |
| Relationship checkpoint writer | Derived versioned checkpoint | `relationship_checkpoint` | Run every 10 canonical messages; classify fleeting, currently relevant, and milestone material |
| Managed relationship lorebook projection | Rebuildable private read model | `relationship_lorebook_projection` | Refresh at Character Truth token budget; chat-scoped and never overwrite user-authored lorebooks |
| Agent/character memory | Append observation plus mutable consolidation | `character_memory` | Observations are authoritative; consolidation is derived and references source commit IDs |
| Narrative Director overarching arc | Mutable document | `director_memory` | Replace direct post-promotion update with document patch and revision head |
| Lorebook Keeper entries | Mutable documents and links | `lorebook_entry` | Per-entry target; lock/link invariants in adapter; creation uses server-assigned target ID |
| Rolling chat summaries | Derived versioned checkpoint | `chat_summary` | Store covered message range/hashes and policy version; replacement appends a new revision |
| Narrative message metadata | Mutable JSON attached to canonical message | `message_narrative_metadata` | Whitelisted JSON paths only; target includes message ID/swipe |
| Game/session state | Not used by this project | Excluded from roadmap | Generic kernel may support a future external adapter; no implementation or migration work planned |
| Images, TTS, Discord, presentation preferences | Operational/ephemeral | Excluded | Keep outside governance; link to commit IDs only when useful for provenance |

## 13. Migration phases

### Phase A — Kernel and parity verification

- Add proposal, target-head, and commit-ledger schemas.
- Implement canonical JSON hashing and authority types.
- Implement adapter registry and deterministic planner.
- Run selected writers in **parity verification mode**: calculate proposed adapter results and diagnostics while legacy writes remain authoritative.
- Store parity results separately from authoritative proposals and commit-ledger rows.
- Compare predicted projections against legacy results without updating projections or target heads.

Parity verification is temporary migration instrumentation. It is unrelated to private character truth, internal-state observations, or branch hypotheses.

Exit criteria:

- exact retries replay;
- conflicting retries fail;
- stale canonical anchors fail;
- deterministic ordering is stable under randomized agent completion order;
- no projection or target-head changes in parity verification mode;
- parity records cannot be mistaken for authoritative commits.

### Phase B — Runtime reference migration

- Wrap HumanOS Runtime in the generic adapter.
- Dual-record generic ledger rows while preserving existing Runtime rows and APIs.
- Verify revisions, hashes, idempotency, and replay results match the current implementation.

Exit criteria:

- all existing Runtime tests pass unchanged or through compatibility adapters;
- no duplicate Runtime commits;
- replay and stale-write behavior are equivalent.

### Phase C — Append/snapshot writers

Migrate the chat-bound Relationship Save File, character-truth observations, and memory observations first. They have the strongest natural append-only audit history. Authoritative observations and milestone records remain immutable; ten-message checkpoints, consolidation, managed lorebook projections, and branch generation are derived jobs referencing source commit IDs.

### Phase D — Mutable aggregate writers

Migrate relationships, roleplay world facts, Director memory, and summaries. Summaries are derived but versioned checkpoints containing covered message ranges, ordered canonical hashes, and policy/model version. Introduce per-target heads and strict conflict rejection; automatic merge remains disabled.

### Phase E — Lorebooks and message metadata

Migrate document/link mutations and whitelisted message metadata. These need the broadest invariant tests and careful compatibility APIs.

### Phase F — Enforcement

- Disable direct agent-authored writes to governed tables.
- Route administrative/user edits through the same actor-aware ledger and target heads; compatibility APIs must at minimum append external-authority commits.
- Add startup diagnostics for unregistered governed writers.
- Remove legacy dual-write paths after a migration window.

## 14. Required tests

### Kernel

- exact proposal/commit replay;
- idempotency-key collision with different payload;
- stale target revision;
- stale message content or selected swipe;
- rollback of projection, ledger, head, and proposal status on failure;
- deterministic order under randomized completion timing;
- required/degradable/optional failure propagation;
- dependency blocking across target keys;
- target-head/projection hash mismatch;
- compensating commit history.

### Adapter contract suite

Every adapter must pass shared tests for:

- normalization stability;
- schema rejection of unknown fields;
- authorization scope;
- deterministic application;
- invariant validation;
- projection hash stability;
- transaction rollback;
- replay from ledger or checkpoint.

### Route integration

- rejected candidates create no proposals;
- recomposed drafts authorize only the promoted final hash;
- trackers cannot propose before promotion;
- editing/swiping between proposal and commit fails evidence validation;
- one turn with multiple trackers produces stable ordering;
- failed optional targets do not block unrelated required targets;
- no event or derived job runs before commit success.

### Relationship Save File and Character Truth

- save identity is isolated by `chatId + characterId + personaId` and never mutates either reusable card;
- exactly one idempotent checkpoint is created per covered ten-message canonical range;
- candidate, rejected, retry, diagnostic, and non-selected swipe rows do not advance checkpoint cadence;
- semantic classification distinguishes fleeting, currently relevant, and milestone material with evidence provenance;
- fleeting payload compaction preserves replay-safe tombstones and the verified checkpoint that absorbed their relevant effect;
- currently relevant truths remain active until a governed resolution, supersession, or milestone promotion;
- milestone payloads, ordering, meaning, and provenance survive routine compaction for the life of the chat;
- canonical message edits mark affected checkpoint/evidence lineage stale or superseded but never silently erase milestones;
- managed lorebook projections are private, chat-scoped, token-budget-triggered, deterministic, and rebuildable from authoritative save state;
- managed projections never overwrite user-authored lorebooks or leak into a different chat, character, or persona;
- branch hypotheses remain speculative and cannot be serialized as achieved relationship facts;
- deleting a chat performs an explicit audited cascade of its relationship save and managed projections;
- any future cross-chat continuation creates a provenance-preserving fork only after explicit user confirmation.

### Migration

- legacy and parity-verification projections match on captured fixtures;
- parity records cannot advance target heads or appear as committed authority;
- schema migration is additive and restart-safe;
- downgrade/rollback leaves legacy projections readable;
- old Runtime history remains queryable.

## 15. Audit and observability

The first UI is audit-first:

- list target, actor, authority path, timestamp, evidence message, operation, base/result revisions, and before/result hashes;
- distinguish proposed, rejected, blocked, failed, committed, compensated, imported, migrated, and `out_of_scope` records;
- provide **Revert by compensation**, which asks the adapter for an inverse proposal and validates it against the current revision;
- require confirmation for destructive or cross-target compensation;
- never expose delete-history as undo.

A graphical per-target/per-character timeline is a planned later UX layer over the same ledger. It must not introduce separate authority semantics.

Structured observability must record:

Record structured diagnostics for:

- proposal accepted/rejected;
- target, base revision, and result revision;
- canonical evidence identity, never raw sensitive prose by default;
- adapter validation failures;
- commit duration and retries;
- blocked dependencies;
- projection/hash corruption;
- derived jobs scheduled from commit IDs.

Metrics should distinguish proposal failure from commit failure. Agent-run success must not imply state-commit success.

## 16. Initial implementation slice

The first production slice should be deliberately small. Phase A is now unblocked by design decisions:

1. add generic schemas and storage kernel;
2. add adapter contract tests;
3. implement the HumanOS Runtime compatibility adapter;
4. dual-record Runtime commits into the generic ledger;
5. prove exact parity with current Runtime behavior;
6. do not migrate another writer until parity, recovery, and restart tests pass;
7. introduce the chat-bound Relationship Save File and Character Truth observation adapter next;
8. add idempotent ten-message relationship checkpoints and semantic retention classification;
9. add the private token-budget-triggered managed lorebook projection;
10. add derived branch hypotheses only after save isolation, milestone retention, and projection rebuild tests pass.

This avoids rewriting every state subsystem at once while establishing a real authority kernel. Attempting a simultaneous migration of character truth, lorebooks, summaries, relationships, and memory would be less “architecture” and more “group project conducted during a kitchen fire.”

## 17. Locked decisions and deferred adapter policy

### Locked before implementation

- one generic authority kernel with typed target adapters;
- one actor-aware ledger for agent, user, administrator, and system writes;
- proposal payload and authority identity are immutable after insertion;
- unresolved proposals compact to replay-preserving `out_of_scope` tombstones at 90 days;
- per-target revisions and permanent append-only commit history;
- every committed proposal receives its own consecutive result revision;
- server-owned evidence, ordering, revisions, commit groups, dependencies, failure boundaries, and idempotency;
- target-level transactions with explicit cross-target dependency DAGs;
- reject-on-conflict with no automatic merge in the first production release;
- authoritative memory/character-truth observations remain distinct from derived consolidation and branch hypotheses;
- Relationship Save Files are chat-local and keyed by chat, character, and persona; they auto-load without modifying either reusable card;
- relationship checkpoints run idempotently every 10 canonical messages;
- semantic retention is classified as `fleeting`, `currently_relevant`, or `milestone`;
- fleeting payloads may compact after verified semantic preservation, while milestones and provenance remain for the lifetime of the chat;
- Character Truth token-budget pressure creates a private, chat-scoped, rebuildable managed lorebook projection;
- summaries and relationship checkpoints are derived but versioned;
- compensation is append-only and audit-first, with a graphical timeline planned later;
- canonical evidence edits never auto-revert committed state;
- parity verification records are migration diagnostics, never authoritative state;
- game/session adapters are outside this project's roadmap;
- projection tables remain optimized read models;
- operational and UI-only state stays out by default.

### Deferred until the relevant adapter

- storage-specific cold-tier mechanics and operational payload-size limits; the semantic retention policy itself is locked;
- detailed target-key decomposition for roleplay world facts;
- rebuild cost limits for ten-message relationship checkpoints and managed lorebook projections; the cadence itself is locked;
- graphical timeline interaction design;
- adapter-specific merge proposals after reject-on-conflict has production evidence.
