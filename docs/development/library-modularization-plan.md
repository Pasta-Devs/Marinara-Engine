# Library Modularization + Enhancement - Concept

**Status:** concepts only, no implementation. Target branch: `staging`.

Marinara has three resource libraries - characters, personas, and lorebooks - each reached from
its own right-panel sidebar. They grew independently:

| Surface | File | Approximate lines |
|---|---|---:|
| Characters panel | `packages/client/src/components/panels/CharactersPanel.tsx` | 1693 |
| Personas panel | `packages/client/src/components/panels/PersonasPanel.tsx` | 1312 |
| Lorebooks panel | `packages/client/src/components/panels/LorebooksPanel.tsx` | 1294 |
| Full-screen library (characters + personas) | `packages/client/src/components/characters/CharacterLibraryView.tsx` | 857 |

The panels repeat search, sort, tag filtering, selection, bulk operations, and card presentation,
but their behavior has already drifted. Personas keep search/sort in local state while the other
libraries use `ui.store`; entity filters, folder/group semantics, pagination, and card metadata are
not interchangeable. The maintenance problem is real, but the shared boundary must be smaller than
an entity-library engine.

Separately, `getCardLibrarySummary()` in `packages/client/src/lib/card-library-search.ts` uses a
fallback chain (`creator_notes` -> `description` -> `No creator notes yet.`). That gives imported
cards an inconsistent and often unhelpful scan line. A short factual summary is useful, but it is a
separate data and AI-job design from the UI extraction.

**Primary product goal:** overhaul the full-screen library into a useful at-a-glance manager for
finding, comparing, organizing, selecting, and starting chats with cards. Shared sidebar pieces are
a secondary benefit, not the reason for the architecture. Extract shared library mechanics without
changing organization semantics, then define a portable, freshness-aware `entitySummary` feature
and a controlled batch service.

**Decisions taken:**
- Character summaries live in `extensions.entitySummary`, so they can remain inside native card data.
- Persona and lorebook summaries are explicit Engine fields with importer/exporter coverage.
- Character and persona groups remain intact. They are product entities consumed by game setup and
  the quick persona switcher, not merely library folders.
- Lorebook full-screen support is a separate resource-library design, not a simple third branch in
  `CharacterLibraryView`.
- Prompt-context changes and Mari integration are downstream consumers, not prerequisites for the
  first usable summary implementation.

**Design boundary:** this plan has two independent tracks. Track A overhauls the full-screen manager
and extracts reusable UI mechanics without changing persisted organization semantics. Compact
sidebars, chat setup, and future resource pickers may consume the proven projections and primitives,
but remain purpose-specific surfaces. Track B defines summaries and AI batch processing only after
storage, portability, freshness, authorization, and failure contracts are settled.

---

## Track B, Phase 0 - `entitySummary` data contract

One field, three homes, one meaning: *2-3 sentences, third person, factual, no flattery - what this
entity is, for a reader who has never seen it.*

### Storage and portability

- Character: `data.extensions.entitySummary`. `characterDataSchema` is `.passthrough()` and the
  current V2 card path serializes `charData` into the PNG envelope. Add the key explicitly to
  `CharacterExtensions` in `packages/shared/src/types/character.ts`.
- Persona / Lorebook: real columns in `packages/server/src/db/schema/characters.ts` and
  `lorebooks.ts`, plus fields on the fully hydrated `Persona` / `Lorebook` API types. Existing
  persona columns `creator`, `personaVersion`, and `creatorNotes` should be represented deliberately,
  rather than conflating database rows with editor/domain models.
- Native persona and lorebook export/import mappings must be updated with the storage fields.
  Compatible exports may intentionally omit Engine-only metadata.
- Old rows without summaries must load as unsummarized. No destructive backfill is required.

The compatibility matrix must cover:

- character V2 JSON;
- character PNG with `chara`;
- character PNG containing both `ccv3` and `chara`, including the winner when they disagree;
- native persona export/import;
- compatible persona export behavior;
- native lorebook export/import;
- compatible lorebook export behavior;
- old persisted rows without summary fields.

### Provenance and freshness

Store alongside the summary:

- `entitySummaryGeneratedAt`;
- `entitySummarySource` (`"ai" | "manual"`);
- `entitySummaryContentHash`;
- a source projection/hash version.

Define a versioned, canonical source projection for each entity kind, including normalization and
tag ordering. Use the same projection for prompt construction and hashing so freshness cannot drift
from generation inputs. Document whether linked resources, embedded lorebooks, avatars, creator
notes, system prompts, and imported metadata are included.

Generation must compare the source hash at write time. If the entity changed while the provider was
running, reject or mark the result stale rather than overwriting newer content. Manual summaries are
protected by default. Pending, ready, stale, and failed states must be representable; provider,
model, and error metadata belongs in the batch result or a separate job record, not in the summary
text field.

### Consumers

1. Library cards prefer a generated summary and retain the existing fallback for unsummarized rows.
2. Search includes summaries in `card-library-search.ts` and in server-side predicates before
   pagination for all three entity kinds. Existing fields remain independently searchable so the
   preferred display summary does not remove legacy matches.
3. Prompt context is deferred to a separate prompt-pipeline proposal. Existing referenced-character
   and lorebook activation paths must not silently change when summaries are introduced.

Embeddings and semantic search remain explicitly deferred until text search measurably fails.

---

## Track A, Phase 1 - Full-screen manager foundation

The existing full-screen character/persona library is the proving ground and primary UX target. It
should become a real manager, not a stretched sidebar: dense scanning, grid/list views, meaningful
summaries, multi-select, bulk actions, and a clear start-chat workflow. Shared pieces should then be
adopted by sidebars where they fit.

Each extracted piece must have a concrete second consumer when it lands, such as the full-screen
manager plus one sidebar or picker. New code belongs in `packages/client/src/components/library/`
and `packages/client/src/hooks/library/`.

### Resource projections

Define small pure adapters that project full entities into a common display/search shape without
discarding the source entity:

- `characterToLibraryItem(character)`;
- `personaToLibraryItem(persona)`;
- later, `lorebookToLibraryItem(lorebook)`.

The projection includes ID, kind, title, disambiguating subtitle/comment, summary, image, tags,
creator/version metadata, timestamps, searchable fields, and compact status indicators. Entity-
specific actions and full data stay outside this common shape. This gives every surface one answer
for how a resource is named, summarized, searched, and badged.

### Hooks

- `useLibrarySelection()` - selection mode, selected IDs, toggle, clear, and select-all-visible.
  It replaces duplicated local selection mechanics while preserving each panel's mutation actions.
- `useLibraryQuery({ scope })` - search text and sort in one scope-keyed query contract backed by
  `ui.store`. Do not add a second `useLibrarySort()` owner. Moving persona state into persisted
  store state requires a version bump, malformed-value normalization, and migration from every
  existing field.
- Shared tag normalization/filter primitives only. Keep tag collection and bulk tag
  rename/delete mutation orchestration entity-specific until APIs and failure semantics match.
- Existing `useLibraryFolders()` remains for scopes it already owns. Do not migrate character or
  persona groups onto it. If library-only character/persona folders are later needed, add separate
  scopes and define coexistence with groups as a new persistence feature with an explicit migration.

### Components

- `<LibraryToolbar>` - search and sort shell with entity-specific filter controls passed as children.
- `<LibraryCardShell>` - shared layout for title, summary, meta, tags, drag payload, and selection
  affordance. Entity-specific card bodies own lorebook filters, linked-resource metadata, avatar
  rules, and actions. Avoid a slot-heavy universal card.
- `<LibraryListRow>` - compact rendering for sidebars, pickers, and the manager's dense list view.
- `<LibraryGrid>` - grid/list layout plus existing `SmoothFolderContent` and `PanelLoadMoreBar`.
- `<LibraryEmptyState>`.
- A shared chat-draft/start-chat operation used by full-screen cards, multi-selection, and compact
  sidebar actions. UI surfaces own their presentation; chat creation semantics exist once.

The full-screen manager and panels remain purpose-specific components. Do not build one component
with a `compact` flag or a generic config-driven `<EntityLibrary>` engine. They share projections,
headless behavior, visual shells, and actions while keeping different information density and
workflows.

### Reuse across the Engine

The output of this track is a library toolkit, not only a refactored manager. Other Engine surfaces
must be able to import individual projections, behaviors, primitives, and operations without
importing the full-screen manager.

Reusable pieces include:

- resource projections and consistent title, summary, image, tag, metadata, search, and status
  derivation;
- search parsing, normalized matching, sort definitions, selection, and pagination/load-more
  presentation;
- `LibraryCardShell`, `LibraryListRow`, `LibraryToolbar`, `LibraryEmptyState`, and the selection
  action bar;
- shared operations for opening an editor, starting a single-character chat, building a
  multi-character chat draft, exporting a selection, and attaching an eligible resource to chat.

Expected consumers include:

- the full-screen library manager, as the richest composition and primary product surface;
- character, persona, and lorebook sidebars, as compact purpose-built compositions;
- game/chat setup participant pickers;
- lorebook attachment and other resource-picker dialogs;
- future import review, duplicate review, or maintenance surfaces.

Each consumer still owns its information density, prominent actions, current-chat context,
drag-and-drop behavior, and entity-specific filters. It must not independently redefine naming,
summary fallback, searchable fields, tag normalization, status badges, or chat-start semantics.
Sidebars are therefore compact compositions built from the toolkit, not the manager rendered with a
`compact` prop and not separate implementations of library behavior.

### Extraction rule

Behavior parity is non-negotiable during extraction, but the full-screen manager is intentionally a
product enhancement. First introduce projections and selection in the existing full-screen
character/persona library, then add grid/list presentation and the start-chat flow. Adopt the proven
pieces in one sidebar at a time. Keep entity filters, mutations, groups/folders, and detail actions
local until a shared contract is proven.

---

## Phase 2 - Manager workflows and lorebook parity

The upgraded full-screen manager should support:

1. At-a-glance grid and dense list views with name, disambiguating comment, factual summary,
   creator/version, tags, and important status indicators.
2. Fast search and filtering that works over the complete paginated library.
3. Single-card start chat as a primary action.
4. Multi-select characters, optionally choose a persona and mode, then start a group chat from a
   persistent selection action bar.
5. Attach lorebooks to the pending chat setup without treating them as participants.
6. Bulk organization and maintenance actions, with per-item failure reporting.

The sidebar remains optimized for quick lookup, opening an editor, drag-to-chat, favorites/recent
items, and one-click chat starts. It reuses `LibraryListRow`, resource projections, search helpers,
status indicators, and the shared start-chat operation, but does not inherit the full manager's
bulk-management UI.

`CharacterLibraryView.tsx` can provide layout ideas, but it embeds character/persona-only
selection, editing, avatar, token, and chat behavior. Lorebooks add active/category filters, linked
entities, images, visibility, and folder behavior.

Design a separate `LorebookLibraryView` or a resource-library surface after the shared card shell
has demonstrated that its boundary is sound. Do not rename `CharacterLibraryView` or
`cardLibraryKind` in the same change as lorebook support; make naming generic only after a third
resource is implemented and tested.

---

## Phase 3 - Management and bulk operations

Bulk export and bulk delete exist. In value order, later management work may include:

1. Bulk tag add/remove across a selection.
2. Bulk move to a library-only folder, if that separate folder concept is approved.
3. Duplicate/clone an entity.
4. Bulk summarize through the Phase 4 service.
5. Saved views.
6. Library-wide stats and triage.

Bulk mutation UX should be reversible-feeling. Confirm destructive operations through existing
`lib/app-dialogs`, report per-item failures rather than aborting the batch, and preserve partial
success details.

Saved views, statistics, duplicate detection, and other management additions are not required to
validate the initial modularization boundary.

---

## Phase 4 - AI summary service

The utility service owns summarization. The library UI is the first caller. Mari is added only after
the batch lifecycle, authorization, duplicate-name handling, and confirmation behavior are proven.

### Endpoint and lifecycle

`POST /library/summarize` accepts `{ kind, ids[] }` and returns a batch ID. Persist a batch record
and per-item state:

- `pending`;
- `running`;
- `ready`;
- `stale`;
- `failed`;
- `skipped-manual`.

Define `GET /library/summarize/:batchId` for status and results, plus explicit retry and cancellation
semantics. Bound IDs, source and output size, provider timeout, total runtime, and estimated cost.
The client may receive live progress over SSE, but SSE is only transport; persisted batch state is
the source of truth when the client reconnects. A disconnect must not be called resumable unless
these records exist.

Use an independent per-item `AbortController`: request disconnect must not abort the batch, while
an explicit cancel request must. Provider failures become per-item failures and do not erase earlier
successful results.

### Provider execution

- Reuse `resolveChatSummaryConnection()` with explicit empty chat metadata and no chat connection;
  document the resulting agents-default behavior and fallback warnings.
- Follow the existing utility-call provider shape and `parseGameJsonish()` where structured output
  is required.
- Process items serially in the summary service initially. Do not reuse the media-specific queue
  until a neutral per-connection scheduler has a second non-media caller and a defined abort and
  preference contract.
- Use one prompt per entity kind, with source-field caps, hard output limits, explicit factual/no-
  flattery instructions, and clear boundaries around user-authored content. Exclude creator notes,
  system prompts, and post-history instructions unless the source projection explicitly approves
  them.

### Review gate

AI writes to pending state first and never silently overwrites user-authored fields. A manual
summary is not overwritten by a bulk run without explicit opt-in. Provider/model/error metadata is
visible per item so a partial batch is diagnosable.

Deferred AI ideas: auto-tagging, duplicate detection, field-cleanup suggestions, and semantic
search. These should not define the initial summary or library abstraction boundary.

---

## Sequencing

1. Track A: introduce resource projections and overhaul the existing full-screen character/persona
   library with selection, grid/list presentation, at-a-glance metadata, and start-chat workflows.
2. Track B: define summary types, source projections, storage, import/export mappings, server-side
   search, manual editing, and freshness/concurrency rules.
3. Adopt proven projections, list rows, search helpers, status indicators, and chat actions in one
   sidebar at a time without turning sidebars into manager screens.
4. Build the summary service with persisted batch/item state, status retrieval, limits, retries,
   cancellation, serial execution, and live SSE progress.
5. Add bulk summarize UI and manual proof for reconnect, partial failure, concurrent edits, and old
   or imported data.
6. Add lorebook support to the manager through its own adapter and workflows; add Mari as a
   confirmed caller afterward.

Tracks A and B can proceed in parallel. Bulk summarize depends on Track B's data contract, not on
full-screen lorebook work. Mari depends on the proven batch service.

---

## Critical files

**Client**
- `packages/client/src/components/panels/{Characters,Personas,Lorebooks}Panel.tsx`
- `packages/client/src/components/characters/CharacterLibraryView.tsx`
- `packages/client/src/lib/card-library-search.ts`
- `packages/client/src/stores/ui.store.ts`
- `packages/client/src/hooks/{use-characters,use-lorebooks,use-library-folders}.ts`
- `packages/client/src/components/ui/SelectionActionBar.tsx`, `SmoothFolderContent.tsx`,
  `PanelLoadMoreBar.tsx`
- Read `packages/client/.instructions.md` before touching any client code.

**Shared**
- `packages/shared/src/types/{character,persona,lorebook}.ts`
- `packages/shared/src/schemas/{character,lorebook}.schema.ts`
- `packages/shared/src/schemas/library-folder.schema.ts` if library-only folders are approved.

**Server**
- `packages/server/src/db/schema/{characters,lorebooks}.ts`
- `packages/server/src/services/storage/{characters,lorebooks}.storage.ts`
- `packages/server/src/services/import/marinara.importer.ts`
- `packages/server/src/routes/{characters,lorebooks}.routes.ts`
- `packages/server/src/services/chat-summary/connection-resolution.ts`
- `packages/server/src/services/generation/professor-mari-command-runtime.ts` for the later Mari
  integration
- `packages/server/src/routes/generate/sse.ts`

---

## Verification

Per phase, not at the end:

- `pnpm check` as the baseline. Use tracked regression and Playwright smoke lanes; do not retain
  temporary `.test.ts` files.
- For each panel migration, manually compare search, every sort mode, tag filters, folder/group
  behavior, selection -> bulk export, selection -> bulk delete, and infinite scroll before and
  after the change. Check desktop and mobile where touch-drag behavior is involved.
- Organization compatibility: verify existing character groups still work in game setup and
  persona groups still work in the quick persona switcher. Use a pre-existing profile, not only a
  fresh one.
- Summary portability: verify native persona/lorebook round-trips, compatible-export behavior, old
  rows without summaries, character V2 JSON, PNG `chara`, and PNGs containing both `ccv3` and
  `chara`.
- Summary search: verify a match on an unloaded page for each entity kind and verify legacy fields
  remain searchable independently of the generated summary.
- Summary concurrency: change source content while generation runs and confirm a stale result
  cannot overwrite it; verify manual summaries are skipped by default and partial failures remain
  visible per item.
- Summary batches: run one item and a 50+ item batch; close the browser tab mid-batch and recover
  status/results through the batch endpoint. Test cancellation, provider timeout, retry, and no
  concurrent provider storm.

## Docs and process

- User-facing library behavior requires checking `README.md`, `docs/CONFIGURATION.md`, `docs/FAQ.md`,
  and `CHANGELOG.md` together. This concept document is internal; if it is implemented, mirror the
  relevant English docs to `docs-i18n` or open a `[docs-i18n]` follow-up issue.
- Open a draft PR per implementation phase when work starts. Leave every test-plan checkbox
  unchecked for human verification.
