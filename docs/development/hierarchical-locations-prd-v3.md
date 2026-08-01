# Hierarchical Maps and Spatial Context V3

Status: Proposed, implementation-ready after maintainer approval

Audience: Product, design, and Marinara Engine contributors

Supersedes: `hierarchical-locations-prd-v2.md`

## Architecture boundary

This plan treats spatial orientation as a focused product capability with a narrow state boundary.

The feature is a hierarchical map and spatial-orientation system, not a generic Voxta-style scenario engine. It borrows one useful Voxta pattern: persistent state selects a small, relevant prompt context. It does not initially add flags, variables, events, scripts, timers, or a separate action-inference model.

The supported owner modes are Roleplay and Game.

The plan has five focused layers:

| Layer | Responsibility | Example |
| --- | --- | --- |
| Map definition | Stable spatial truth | The Library is inside the Wizard Tower |
| Runtime state | The current scene location | The scene is currently in the Library |
| Prompt projection | Bounded model orientation | Breadcrumb, current memory, reachable exits |
| Visual identity | Optional place-specific art references | The Library keeps its arches, windows, and materials across scenes |
| Transition | Validated state change | Move from Library to Observatory |

The state machine is deliberately small:

```text
current location + requested destination + definition revision
                              ↓
                  validate ownership and reachability
                       ↙ accepted       rejected ↘
              persist snapshot         preserve state
```

Manual movement ships first. Later, a constrained model tool such as `change_location({ destinationId })` may request the same transition. The server, not the model, validates and applies it. A separate action-inference call is deferred unless later evidence shows it is needed.

## Summary

Add a shared Hierarchical Map feature for Roleplay and Game. It provides an author-defined location hierarchy, one authoritative focal location, bounded current-location prompt context, and server-validated movement.

Lorebooks remain the canonical source for reusable world facts. The hierarchy may reference existing lorebook entries by stable ID so the active location can select relevant lore without copying or rewriting it. AI map drafting may use explicitly selected lorebooks as grounded source material, and it must distinguish source-backed locations from inferred or invented additions.

A location may also own an optional visual identity kit: a short visual anchor plus stable references to profile-gallery images. The location remains a spatial entity, not an image. The chat's image style profile controls overall rendering style, location references preserve the place, and character or persona references preserve the people in it.

Connected Conversation can later read a safe projection of the linked story location, but it never owns or changes spatial state.

```text
authoritative hierarchy + current location
                    ↓
resolve breadcrumb, context, and valid destinations
                    ↓
build the mode-specific prompt
                    ↓
commit a validated move with the next owner turn
                    ↺
```

This is not a general scenario engine. It does not add flags, events, author JavaScript, or pathfinding. It does include a visual, nested map browser with map, layer, and list presentations.

## Product decisions

These decisions resolve the open questions from V2:

1. The hierarchy definition and current location are stored separately.
2. Current location is snapshotted with committed message and swipe state so branches, regeneration, and checkpoints restore the correct position.
3. Manual movement commits atomically with the next owner-mode user turn, before prompt generation.
4. Spatial Context is authoritative when enabled. Game's legacy free-text location must not become a second source of truth.
5. Roleplay and Game use one shared spatial projection contract with thin mode-specific prompt adapters.
6. `awarenessSummary` is author-written. When absent, Conversation receives a bounded excerpt of the public description only.
7. Conversation uses scene-level wording unless authoritative presence data proves the connected character is present.
8. Direct links and visual child placement are included in the MVP.
9. Existing Game grid and node maps may bind explicitly to hierarchy locations; names are never matched automatically.
10. Lorebooks own canonical reusable world facts; the map owns spatial identity, containment, navigation, and current-location state. Map locations reference lorebook entries by stable ID and never copy their content.
11. A location attachment is an explicit chat-scoped activation source. While that exact location is current, its enabled entries may activate without a keyword match, but disabled or explicitly excluded books and entries remain disabled.
12. Lorebook-grounded map drafting follows the owner runtime UI and precedes Connected Conversation. When source lorebooks are selected, the draft must expose which locations are source-backed, inferred, or invented instead of presenting unsupported geography as canon.
13. A location is never replaced by an image. It may reference optional visual identity assets by stable image ID, with one primary establishing reference and bounded supporting references.
14. Location visual references feed only eligible image-generation paths. Text generation, lore activation, and Connected Conversation never receive image bytes or image-only notes.
15. Storyboard is a downstream consumer of the same visual resolver. Each storyboard freezes a message-and-swipe-anchored reference manifest so later regeneration does not silently adopt newer location or character art.
16. Model-requested movement remains a later phase.

## Scope

| Mode | Owns hierarchy | Moves focal location | Story projection | Connected projection |
| --- | ---: | ---: | ---: | ---: |
| Roleplay | Yes | Yes | Yes | N/A |
| Game | Yes | Yes | Yes | N/A |
| Conversation | No | No | No | Later phase, read-only |

## User experience

### Authoring

Chat Settings shows a compact Spatial Context section with:

- Enabled state
- Current breadcrumb
- Location and warning counts
- Open Location Editor action

The editor is a lazy-loaded map workspace, not a narrow settings form:

- Desktop uses a hierarchy pane, local map or layer view, and location-detail pane.
- Mobile shows one pane at a time with clear back navigation.
- Validation appears beside the affected field or node.
- Save state and revision conflicts are always visible.
- Archive is the primary removal action; hard delete is restricted.
- Selection previews a location. A distinct Enter action navigates to it, so click never ambiguously means inspect, edit, and move.
- Each parent presents children as a positioned map, ordered layers, or an accessible list.
- Duplicate subtree supports creator reuse without requiring cross-chat templates in the MVP.
- Each location has a progressive `Linked lore` section that searches existing lorebook entries, shows disabled or missing references, and supports Open entry and Detach without copying or deleting lore content.
- Each location has a progressive `Visual identity` section with a primary image, supporting references, usage notes, and explicit gallery, upload, or generate actions. Images never replace the location name, icon, or accessible navigation label.

### Lorebook-grounded drafting

The AI map builder offers lorebook grounding when the owner chat has selected or active lorebooks. Grounding is explicit and inspectable, not a normal keyword scan.

- Game setup uses the lorebooks selected in the Lorebooks step as default map sources.
- Roleplay uses the open chat's active lorebooks as defaults and lets the creator change the source selection in the map builder.
- `Strict canon` creates every named node from at least one selected lore entry. It preserves multiple sourced roots rather than inventing unsupported connecting places.
- `Canon with expansion` preserves sourced names and relationships while allowing clearly labelled inferred or invented locations to fill practical gaps.
- `Setup only` preserves the existing behavior and uses setup, world overview, story arc, scenario, and character context without lorebook grounding.
- When selected lorebooks exist, `Canon with expansion` is the approachable default. The builder keeps `Strict canon` one control away for lorebook-heavy creators.

Every generated node in the draft preview shows `Lore-backed`, `Inferred`, or `Added by AI`. Lore-backed nodes list their source entries and provide Open entry. The label proves a valid source reference, not that the model interpreted the prose perfectly, so creator review remains the semantic authority. Apply changes only the local working copy, and Save remains the persistence boundary.

### Location visual identity and reference art

Location images should improve scene consistency without turning the hierarchy into a gallery or another source of spatial truth.

- A creator may upload an image, select an existing profile-gallery image, promote a generated scene, or generate an establishing reference from the location's breadcrumb, public description, visual anchor, linked lore, and selected image style profile.
- Attaching a chat-gallery image, generated Game background, or other temporary source first creates a durable profile-gallery asset. The map stores the stable gallery image ID, never a file path, external URL, or base64 payload.
- One `identity` image may be primary. Supporting images may describe a distinctive detail, an alternate view, a layout, or an inheritable art-style cue.
- `layout` references remain editor aids unless a specialized background or floor-plan request explicitly asks for them. They are not automatically sent to ordinary scene illustration because they can distort composition.
- Only `style` references may opt into descendant inheritance. Identity and detail images apply to the exact location, so a city skyline is not silently used as the visual identity of every room inside it.
- Generated scene art never becomes canon automatically. `Set as location reference` is an explicit review action, preventing repeated generation from amplifying accidental details or style drift.
- The selected location inspector shows the primary image and reference roles. Dense hierarchy and map views stay name-first; they may show a small thumbnail when space permits, but navigation never depends on image recognition.
- The image-generation preview names every resolved location and character reference, its role, and any reference omitted by provider limits. It never logs or displays raw base64 in diagnostics.

The intended consistency stack is:

```text
chat image style profile  -> shared rendering language
current location refs     -> stable architecture and place identity
character/persona refs    -> stable people and appearance
scene prompt              -> current action, framing, weather, and lighting
```

Reference art is visual evidence, not automatic lore. Adding an image never creates locations, changes containment, or writes lorebook facts. Image-to-map inference remains a separately reviewed future workflow.

### Storyboard reference continuity

Storyboard should consume the reviewed visual identities from the completed GM turn without making the spatial feature depend on Storyboard.

- The profile gallery and entity galleries form a reference bank that may contain several reviewed images for a location, character, or persona. A generated keyframe receives only a provider-sized reference payload selected from that bank.
- Creating a storyboard resolves the exact spatial snapshot for its source message and swipe. The chat's latest location is never substituted for an earlier turn.
- The storyboard freezes the resolved location, ordered candidate image IDs, per-keyframe selections, omissions, and provider capacity in a visual-reference manifest. Regeneration reuses that manifest until the creator explicitly chooses `Refresh references`.
- The same primary location candidate is available to every keyframe. Character and persona candidates vary by the frame's visible-character list, so off-screen cast members do not consume reference slots.
- The first version automatically selects one primary image per depicted entity and at most one supporting location image. Richer banks remain useful for manual selection and future shot-aware angle, outfit, expression, or detail matching, but Marinara does not send every stored image on every frame.
- If only one automatic slot remains, a keyframe with visible characters selects the lead visible character; an establishing keyframe with no visible characters selects the primary location. With two or more slots, the primary location is selected before additional visible-character references.
- A higher-capacity provider does not silently add references to an existing storyboard. A lower-capacity provider produces an inline `Review references` conflict instead of silently changing the frozen payload.
- Each keyframe preview has one progressive `Visual sources` disclosure listing the resolved location, selected characters, image roles, ordering, and omission reasons. `Refresh references` is available there without adding a separate Storyboard asset manager or blocking modal.
- Generated keyframes never become character or location references automatically. Existing explicit promotion actions remain the only persistence boundary.

### Runtime movement

Owner-mode chat surfaces show:

- Persisted current breadcrumb
- Valid destination picker
- Clearly labelled pending destination

Selecting a destination does not immediately change authoritative state. Sending the next message submits the destination ID and expected revision separately from visible message text. The server commits the move before assembling the reply prompt.

If validation fails, the message and movement are not partially committed. The client keeps the draft and explains the conflict.

## Data model

Definitions belong in chat metadata. Runtime position belongs in snapshot history.

```ts
export type SpatialOwnerMode = "roleplay" | "game";

export type LocationVisualReferenceRole = "identity" | "detail" | "layout" | "style";

export interface LocationVisualReference {
  imageId: string;
  role: LocationVisualReferenceRole;
  primary?: boolean;
  usageNote?: string;
  inheritToDescendants?: boolean;
  sortOrder: number;
}

export interface ChatLocation {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
  kind: "region" | "settlement" | "place" | "building" | "floor" | "room";
  modelMemory?: string;
  icon?: string;
  childPresentation: "map" | "layers" | "list";
  placement?: { x: number; y: number };
  layerOrder?: number;
  awarenessSummary?: string;
  visualIdentity?: string;
  visualReferences: LocationVisualReference[];
  lorebookEntryIds: string[];
  links: ChatLocationLink[];
  status: "active" | "archived";
  sortOrder: number;
}

export interface ChatLocationLink {
  targetId: string;
  label?: string;
  bidirectional: boolean;
  state: "available" | "hidden" | "blocked";
}

export interface SpatialContextDefinition {
  schemaVersion: 1;
  ownerMode: SpatialOwnerMode;
  enabled: boolean;
  locations: ChatLocation[];
  startingLocationId: string | null;
  revision: number;
}

export interface SpatialContextSnapshot {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  currentLocationId: string | null;
  definitionRevision: number;
  createdAt: string;
}

export interface PendingSpatialTransition {
  destinationId: string;
  expectedDefinitionRevision: number;
  expectedCurrentLocationId: string | null;
  commandId: string;
}
```

Do not store `ownerChatId` inside `SpatialContextDefinition`; the containing chat is the owner. Stable opaque IDs survive renames and reparenting.

The first owner MVP treats a missing `lorebookEntryIds` or `visualReferences` field as an empty array, so later packages can extend schema version 1 without eagerly rewriting existing definitions. Entry references and image references are stable IDs only. Lorebook names, entry names, keys, content, image paths, and image bytes are resolved at use time and are never copied into the spatial definition. `imageId` resolves through the durable profile gallery; attaching a temporary or chat-scoped image promotes a durable copy first.

## Graph rules

Valid destinations are active:

- Children of the current location
- The current location's parent
- Direct link targets
- Reverse targets of bidirectional links

Siblings are not automatically adjacent.

Reject:

- Duplicate IDs
- Missing parent or link targets
- Self-parenting or parent cycles
- More than 500 locations
- Depth above 20
- More than 50 links per location
- More than 50 lorebook entry references per location
- Duplicate lorebook entry references on one location
- More than 6 visual references per location
- Duplicate visual image references on one location
- More than one primary visual reference, or a primary reference whose role is not `identity`
- Descendant inheritance on a role other than `style`
- Placement coordinates outside 0 to 100
- Invalid or duplicate layer ordering within a layer parent
- Movement to archived, hidden, blocked, or unreachable locations
- Stale revisions or a changed current location
- Reused command IDs with different contents
- Mutation attempts from Conversation

Text limits:

- Name: 200 characters
- Description: 4,000 characters
- Awareness summary: 1,000 characters
- Private model memory: 8,000 characters
- Visual identity: 800 characters
- Visual-reference usage note: 300 characters

Direct-link cycles are valid. Parent cycles are not.

### Archive and delete

- The current or starting location needs an atomic replacement before archive.
- A location with active children cannot be archived.
- Hard delete is allowed only for an archived leaf with no inbound links.
- Descendants are never silently reparented.
- Missing lorebook references appear as warnings, not graph corruption.
- Archiving or deleting a location never deletes its referenced lorebook entries.
- Deleting a lorebook or entry never silently rewrites the map. The location retains a repairable broken reference until the creator detaches or replaces it.
- Archiving or deleting a location never deletes a shared profile-gallery image.
- Deleting a gallery image that is still referenced by a location or frozen Storyboard manifest is blocked until the creator detaches it or refreshes every dependent manifest. Missing image references remain repairable warnings and never become raw-path fallbacks.

## Persistence and history

### Definitions

Store `SpatialContextDefinition` in `chat.metadata.spatialContext`. Definition updates require `expectedRevision`; accepted updates increment the revision.

### Runtime position

Store the current position using message/swipe-addressable snapshots, following the existing Game State snapshot pattern.

- New owner chats begin at `startingLocationId`.
- A committed turn creates a snapshot after any accepted movement.
- Regeneration associates position with the resulting swipe.
- Switching swipes resolves the matching snapshot.
- Branching at a message copies the snapshot effective at that point, not the source chat's latest position.
- Game checkpoints reference or include the applicable spatial snapshot.
- Reload resolves the latest committed snapshot.

Definition editing is not rewound by ordinary message branching in the MVP. A branch receives a copy of the current definition, with its own future revision history. Its runtime position comes from the branch point.

## Prompt projections

A shared server projection service resolves structured projection data. Thin mode adapters turn it into final prompt text.

### Owner story projection

Include:

- Breadcrumb names
- Current location ID
- Public description
- Current-location private model memory
- Available destination names, IDs, and link labels
- An authoritative-state instruction

Exclude all unrelated location descriptions and memories, hidden or blocked destinations, canvas coordinates, and editor metadata.

### Current-location lore activation

The owner spatial resolver returns the exact current location's `lorebookEntryIds` beside the normal spatial projection. The formatter does not paste those IDs or entry contents into the spatial block. Instead, prompt assembly passes the IDs into the existing lorebook processor as forced candidates with activation source `current_location`.

Rules:

- Only the exact current location activates attached lore in the first release. Parents and descendants do not inherit entries implicitly.
- An explicit location attachment can activate an enabled entry even when its lorebook is not otherwise global, character-linked, persona-linked, or pinned to the chat.
- A globally disabled lorebook, disabled entry, or explicit chat exclusion always wins over the attachment.
- Existing lorebook macros, insertion positions, recursion, ordering, and per-book token and entry limits are reused.
- Location-attached lore also has a total reserved cap of 2,048 tokens per owner prompt. Truncation is deterministic and appears in Active Context.
- An entry activated by both location and ordinary keyword, semantic, recursive, or constant rules is injected once and reports every activation source.
- A committed move resolves the destination's entries before the owner reply prompt is assembled. Pending or rejected movement does not change lore activation.
- Game wording treats the location as the party's authoritative position. Roleplay wording treats it as the focal scene and does not infer that every character is present.

The Active Context UI groups these entries under `Current location`, shows the owning lorebook, activation sources, token use or truncation, and Open entry. Broken, disabled, and excluded references remain visible in the map editor but never enter the prompt.

### Connected Conversation projection

Added in Phase 3. Include only:

- Linked story name and mode
- Breadcrumb
- `awarenessSummary`, or a bounded public-description excerpt
- Read-only instruction
- Character presence only when authoritative state proves it

Never include private model memory, internal IDs, hidden destinations, the complete hierarchy, location-attached lorebook IDs or content, location visual-reference IDs, visual identity notes, usage notes, image paths, or image bytes.

Game may prove presence through its committed `presentCharacters` state. Roleplay uses neutral wording such as “The linked story's current scene is…” until it gains an explicit presence source. Never infer presence by character name.

### Required prompt paths

The same projection resolver must feed:

- Roleplay generation
- Game GM generation
- Dry-run preview
- Live Peek Prompt assembly

Cached Peek Prompt continues to display the exact prompt originally sent. Debug logging includes the final projection but must not log private model memory at normal levels.

### Current-location visual projection for image generation

Visual references use a separate resolver from the story prompt. It resolves the spatial snapshot applicable to the image target, not merely the chat's latest location. Automatic Game art uses the snapshot committed for that assistant message. Retrying art for an earlier swipe and invoking Illustrator from an earlier message use that message and swipe's resolved location.

Eligible paths are Game automatic scene art, Game manual scene illustration, and Roleplay Illustrator scene or background generation when the per-chat location-reference control is enabled. Portrait, selfie, avatar, and sprite generation do not attach location references automatically.

Two chat-metadata controls mirror the existing avatar-reference controls: `illustratorUseLocationReferences` and `gameImageUseLocationReferences`. Missing or false remains off for backward compatibility. When the creator sets the first primary location image, the same Save flow offers `Use this location in scene art`, checked by default but explicit, so image bytes are never sent to a provider merely because an image is displayed in the map editor.

Candidate order is deterministic and provider-aware:

1. Explicit references selected for this image request.
2. The exact resolved location's primary `identity` reference.
3. Referenced characters and persona in scene order.
4. The exact location's supporting `identity` and `detail` references in `sortOrder`.
5. The nearest ancestor's inheritable `style` reference.

No sibling or name-based fallback is allowed. At most two location images are candidates for an ordinary scene request, and the existing provider adapter applies its total image limit. Explicit request references always consume slots first. For the remaining automatic slots, a background request prioritizes location identity over character references, while an illustration chooses the primary location reference before additional depicted-person references. If a provider cannot accept both the place and every requested person, the preview reports the deterministic tradeoff and every omission reason.

The image prompt compiler adds the location breadcrumb, bounded `visualIdentity`, and each selected reference's bounded `usageNote`. The chat's selected `ImageStyleProfile` remains the style authority. Reference images preserve place or subject identity and must not silently replace the profile's style text, positive tags, negative tags, or prompt mode.

Reference roles express creator intent and selection priority; they do not guarantee that every provider will interpret an image as identity, detail, layout, or style. Provider capability notes and the generated preview keep the creator as the visual authority.

Text-model requests receive none of these image bytes or image-only usage notes. Connected Conversation receives neither the visual-reference IDs nor their contents. Image debug logs may include image IDs, location IDs, roles, selection reasons, and omissions, but never base64 or filesystem paths.

### Storyboard visual-reference manifests

The Storyboard adapter resolves visual candidates once for the completed GM turn, after its message and swipe are committed. It stores a frozen bank and the provider-sized payload chosen for each keyframe. This separates durable reference identity from a provider request that may accept only a small subset.

Selection is deterministic:

1. Explicit keyframe references consume slots first.
2. With one automatic slot remaining, an establishing frame selects the location primary and a frame with visible characters selects the lead visible character.
3. With two or more automatic slots remaining, select the exact location primary, then one primary reference for each visible character or persona in narrative order.
4. Use remaining capacity for one supporting exact-location identity or detail, then secondary depicted-entity references, then the nearest inheritable location style.

Storyboard never creates a contact sheet or composite reference implicitly. Those techniques can change provider interpretation and remain a future provider-specific optimization. Missing images, a changed provider, or a reduced provider limit marks the manifest `needs_review`; it does not silently choose a different entity. Increasing capacity also preserves the frozen payload until `Refresh references` is confirmed.

The manifest stores IDs, labels, roles, ordering, selection reasons, omissions, source message and swipe, resolved location ID, definition revision, provider identity, and the reference limit used. It stores no image bytes or filesystem paths. Debug output may describe that manifest but follows the same no-base64 and no-path rules as ordinary image generation.

## Game compatibility

Existing Game grid and node maps remain local or tactical representations. The hierarchy becomes the world and containment layer above them.

When Spatial Context is enabled:

- Spatial Context supplies the authoritative named location to prompts.
- The Game tracker displays the spatial breadcrumb as its location.
- Legacy model or manual patches cannot independently change the free-text Game location.
- `GameMap.spatialLocationId` may bind a whole map to one hierarchy location.
- `GridCell.spatialLocationId` and `MapNode.spatialLocationId` may bind an enterable destination.
- Bindings use stable IDs only; names are never matched automatically.
- Selecting a bound destination creates the same pending transition as the hierarchy browser.
- Moving between unbound cells or nodes changes only tactical party position.
- Entering a location may select its bound local map; leaving may select the closest bound ancestor map.

When disabled, existing Game location behavior is unchanged.

This boundary preserves the current map UI and saves while preventing two sources of named spatial truth.

## API shape

```text
GET  /api/chats/:chatId/spatial-context
PUT  /api/chats/:chatId/spatial-context
```

Definition update:

```ts
interface UpdateSpatialContextRequest {
  expectedRevision: number;
  expectedCurrentLocationId: string | null;
  replacementCurrentLocationId?: string | null;
  definition: SpatialContextDefinition;
}
```

`replacementCurrentLocationId` is only used when a definition edit archives the effective current location. The server must validate and apply that replacement in the same write as the definition revision. Ordinary movement still goes through owner-mode turn submission.

Pending movement is submitted through the existing owner-mode turn request rather than a separate immediate-transition endpoint.

The server validates definition integrity, owner mode, expected revision, expected current location, reachability, and command idempotency inside the same transaction as message submission.

Return `409 Conflict` for stale state and `400 Bad Request` for invalid graphs or destinations. Errors must not reveal hidden destinations.

## Implementation plan

### Phase 0: shared core and proof fixtures

- Add shared types and Zod schemas.
- Add pure graph validation, breadcrumb, and destination helpers.
- Add deterministic fixtures for valid and invalid graphs.
- Confirm message/swipe snapshot integration points for Roleplay and Game.
- Measure representative prompt projections.

Exit condition: schema, movement semantics, and snapshot behavior are proven without UI.

### Phase 1: owner MVP

1. Add definition persistence with optimistic concurrency.
2. Add spatial snapshot storage and resolution.
3. Integrate atomic pending movement into owner-mode turn submission.
4. Handle reload, swipes, branches, and Game checkpoints.
5. Add the shared projection service to every required prompt path.
6. Add the compact settings section, hierarchy navigator, local map canvas, layer selector, and editor workspace.
7. Add breadcrumb, destination picker, preview, and pending state to owner surfaces.
8. Bind existing Game maps, cells, and nodes through stable location IDs.
9. Reconcile the Game tracker location when enabled.

Exit condition: Roleplay and Game can author, move, persist, restore, and prompt from the same spatial model. Bound Game-map movement and unbound tactical movement remain distinct.

### Phase 2A: location lorebook bindings and runtime

- Add `lorebookEntryIds` to locations with an empty-array compatibility default.
- Add inline attach, open, detach, disabled, excluded, and broken-reference states to the Location Editor.
- Resolve exact-current-location references as forced candidates through the existing lorebook processor.
- Reuse normal macros, insertion, recursion, ordering, and per-book limits; add deterministic deduplication and a 2,048-token total location-lore cap.
- Report `current_location` alongside any keyword, semantic, recursive, or constant activation sources in Active Context.
- Prove identical behavior in Roleplay and Game, including movement, reload, regeneration, swipes, and branches.
- Prove that Connected Conversation receives neither location lore IDs nor contents.

Exit condition: creators can explicitly bind existing lore to locations, and only the accepted current location activates those entries in owner prompts.

### Phase 2B: lorebook-grounded map drafting

- Extend create, replace, and history-safe expansion requests with grounding mode and explicit lorebook or entry source selection.
- Read selected enabled lore entries directly for this authoring operation instead of relying on keyword activation or the generated world overview.
- Build a connection-aware bounded source catalog with visible omission counts and deterministic ordering.
- Give the model temporary source keys, validate every returned key server-side, and persist only stable entry IDs.
- Support `setup_only`, `lore_strict`, and `lore_expand` behavior with preview provenance.
- Auto-bind valid source entries to generated locations while preserving Apply and Save as separate review boundaries.
- Preserve every existing location ID and lore binding during add-only expansion.

Exit condition: a lorebook-literate creator can generate a map grounded directly in selected canon, identify every unsupported addition, and decline or edit it before persistence.

### Phase 2C: location visual identity and scene references

- Add bounded `visualIdentity` and `visualReferences` fields with empty compatibility defaults.
- Reuse durable profile-gallery image IDs and the existing secure gallery upload, metadata, and image-generation paths. Never persist raw paths, external URLs, or base64 in the definition.
- Add the parallel per-chat Illustrator and Game location-reference controls. The first-primary Save flow obtains explicit consent before enabling provider use.
- Generate an establishing reference from bounded exact-location context and enabled attached lore only. Do not scan unrelated lorebooks or hierarchy branches.
- Add inline primary, supporting, role, usage-note, gallery selection, upload, generate, detach, broken-reference, and backlink states to the Location Editor.
- Resolve the message and swipe's exact location into eligible Game and Roleplay scene-art requests, then merge location, character, persona, and explicit references under provider-specific limits.
- Add explicit `Set as location reference` promotion for generated art. Never promote generated scenes automatically.
- Preserve visual reference IDs through branches and JSONL metadata export, warn on missing destination assets, and include the assets in profile backup and restore.
- Prove that story prompts and Connected Conversation receive neither location image IDs, bytes, paths, nor image-only notes.

Exit condition: a creator can establish a place visually, generate multiple scenes that reuse its reviewed identity, see exactly which visual references were sent, and remove or replace those references without changing spatial or lore truth.

### Phase 2D: Storyboard visual-reference manifests

- Add a downstream Storyboard adapter around the Phase 2C visual resolver rather than coupling spatial persistence to Storyboard.
- Resolve the source message and swipe's spatial snapshot, then freeze the location and entity reference bank plus per-keyframe provider payloads.
- Reuse the exact location primary across keyframes when capacity permits, while selecting character and persona references from each frame's visible-character list.
- Persist provider identity, reference capacity, ordered selections, and omission reasons so regeneration is reproducible.
- Add inline `Visual sources`, `Review references`, and explicit `Refresh references` states to Storyboard preview and regeneration.
- Reject silent reselection when an image is missing or provider capacity shrinks. Do not auto-fill newly available capacity.
- Preserve the manifest through the existing Storyboard lifecycle and prove that keyframe image-to-video continues to use only the rendered keyframe as its first-frame input.

Exit condition: every Storyboard keyframe can explain and reproduce its visual inputs, repeated frames share the correct historical place identity, and provider limitations never silently swap the location or depicted people.

### Phase 3: connected Conversation

- Resolve the latest owner state through `connectedChatId` at generation time.
- Add a bounded read-only projection.
- Use conservative presence wording.
- Exclude location-attached lore IDs and content, visual-reference IDs and metadata, image paths, and image bytes even when owner-mode generation uses them.
- Cover unlink, relink, deleted owner, malformed links, concluded stories, and location-lore negative controls.

### Phase 4: model-requested movement

- Add a typed `change_location` request for owner modes.
- Apply the same revision, reachability, and idempotency validation.
- Record accepted and rejected requests in debug diagnostics.
- Conversation remains unable to request transitions.

### Phase 5: creator templates

- Save and import reusable location subtrees or full maps.
- Allow creators to ship starter maps with characters after ownership and merge behavior are specified.
- Preserve internal references while generating new IDs when copying into another chat.

## Repository implementation blueprint

Planning baseline: `hierarchical-locations` after merging `staging` at `4fd752ea` on 2026-07-13. At this baseline the branch contains the V1, V2, and V3 planning documents only. No Spatial Context runtime code exists yet.

### Confirmed integration constraints

| Concern | Current repository behavior | Implementation consequence |
| --- | --- | --- |
| Definition storage | Chat metadata is JSON and generic metadata updates are partial merges. | Spatial definitions stay in `chat.metadata.spatialContext`, but use a dedicated validated endpoint instead of the generic metadata patch route. |
| Runtime history | `game_state_snapshots` is the only message and swipe-addressable world-state history. | Add a mode-neutral spatial snapshot table. Do not add Spatial Context columns to Game-only snapshots. |
| Owner turn start | `/api/generate` commits visible Game state, creates the user message, then updates attachments and persona data in separate calls. | Add a small transaction-bound owner-turn service so user-message creation and an accepted spatial move succeed or fail together. Keep provider calls outside the transaction. |
| Swipes and branches | Swipe deletion shifts Game snapshot indexes. Branch creation copies all Game and turn-game snapshots to new message IDs. | Spatial snapshots must participate in both paths and must copy the snapshot effective at an earlier branch point. |
| Prompt assembly | Live generation, dry run, live Peek Prompt, cached Peek Prompt, and Game GM prompts have distinct assembly paths. | Resolve structured spatial data once, then call a shared formatter/injector from every live path. Cached Peek Prompt continues to read the exact saved provider request. |
| Client data | Server data uses React Query. Per-chat input drafts survive navigation and reload. Heavy editors are lazy-loaded through `AppShell`. | Add a dedicated query/mutation hook, persist pending transitions beside per-chat drafts, and route a lazy Location Editor through the existing detail-view model. |
| Game travel | Game maps already have grid and node positions plus a pending map move that becomes visible `*moves to ...*` text. | Add optional stable-ID bindings. Bound destinations use structured spatial requests without visible prose; unbound movement keeps the existing tactical flow. |
| Storage | File-native snapshots are the sole persistence backend. Small transactions are used, while large transaction loops are avoided to keep writes responsive. | Keep the owner-turn transaction constant-size and prove it against file-native storage before expanding the feature. |
| Lorebook processing | Lorebook activation already supports explicit chat IDs, keyword and semantic matching, macros, recursion, ordering, and prompt markers. Initial Game setup scans with no chat messages, so ordinary keyword entries do not directly ground the later map draft. | Add forced current-location candidates to the shared lorebook processor and give map drafting a separate explicit, bounded source-catalog path. Do not infer map canon from the world overview alone. |
| Image consistency | Image style profiles control prompt style, character and persona avatars can already be sent as references, and providers accept different maximum reference counts. Galleries store stable image IDs separately from file paths. | Keep place identity separate from global style and character identity. Resolve the applicable spatial snapshot, attach stable gallery images only to eligible scene-art requests, and trim candidates deterministically through existing provider adapters. |
| Storyboard references | Storyboard already plans visible characters per keyframe, resolves provider-specific reference limits, sends character images through preview and render, stores its source message and swipe, and uses each rendered keyframe as the video first frame. | Add a frozen visual-reference manifest that resolves the historical location once, varies characters per keyframe, and preserves ordered selections across regeneration. Keep image-to-video input unchanged. |

### Target module map

New shared modules:

- `packages/shared/src/types/spatial-context.ts`: public definition, snapshot, transition, projection, response, warning, and error-code types.
- `packages/shared/src/schemas/spatial-context.schema.ts`: Zod schemas and all storage/request limits.
- `packages/shared/src/utils/spatial-context.ts`: pure graph indexing, validation, breadcrumb, reachability, archive checks, and deterministic destination sorting.
- `packages/shared/src/index.ts`: explicit exports for the new shared contract.

New server modules:

- `packages/server/src/db/schema/spatial-context.ts`: `spatial_context_snapshots` schema.
- `packages/server/src/services/storage/spatial-context.storage.ts`: snapshot reads, writes, branch copies, swipe shifts, command lookup, and cleanup.
- `packages/server/src/services/spatial-context/state-resolution.ts`: effective snapshot resolution for bootstrap, visible swipe, regeneration, branching, and checkpoints.
- `packages/server/src/services/spatial-context/projection.ts`: structured owner and connected projections plus bounded text formatting.
- `packages/server/src/services/spatial-context/visual-reference-resolution.ts`: snapshot-aware location visual selection, inheritance, provider candidates, and safe diagnostics.
- `packages/server/src/services/spatial-context/storyboard-reference-manifest.ts`: frozen Storyboard banks, per-keyframe payload selection, provider-capacity review, refresh, and safe serialization.
- `packages/server/src/services/spatial-context/owner-turn.ts`: validation and constant-size atomic move plus user-message commit.
- `packages/server/src/services/spatial-context/game-map-binding.ts`: authoritative breadcrumb projection plus explicit Game map, cell, and node binding resolution.
- `packages/server/src/routes/spatial-context.routes.ts`: dedicated GET and revisioned PUT routes.

New client modules:

- `packages/client/src/hooks/use-spatial-context.ts`: query keys, GET, definition PUT, conflict handling, and cache invalidation.
- `packages/client/src/features/spatial-context/SpatialContextSettingsSection.tsx`: compact Chat Settings summary and editor action.
- `packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx`: lazy full-page editor shell.
- `packages/client/src/features/spatial-context/components/HierarchyNavigator.tsx`: hierarchy navigation and keyboard interactions.
- `packages/client/src/features/spatial-context/components/LocalMapCanvas.tsx`: positioned child-location map.
- `packages/client/src/features/spatial-context/components/LayerSelector.tsx`: ordered floor, tower, and dungeon layers.
- `packages/client/src/features/spatial-context/components/LocationInspector.tsx`: field editing, preview, links, archive controls, and inline validation.
- `packages/client/src/features/spatial-context/components/SpatialContextRuntimeBar.tsx`: breadcrumb, destination picker, pending state, and clear action.
- `packages/client/src/features/spatial-context/lib/editor-state.ts`: working-copy operations and server-error mapping. This remains client-local and is not exported through a barrel.

Existing integration files expected to change:

- Persistence: `packages/server/src/db/migrate.ts`, `packages/server/src/db/schema/index.ts`, `packages/server/src/db/file-backed-store.ts`, `packages/server/src/services/storage/chats.storage.ts`, and `packages/server/src/routes/backup.routes.ts` where required by table registration.
- Chat lifecycle: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/routes/generate.routes.ts`, and `packages/shared/src/schemas/chat.schema.ts`.
- Prompt paths: `packages/server/src/routes/generate/dry-run-route.ts`, `packages/server/src/services/generation/game-gm-prompt-runtime.ts`, and the live-preview portion of `packages/server/src/routes/chats.routes.ts`.
- Lorebook grounding and activation: `packages/server/src/services/lorebook/`, `packages/server/src/routes/spatial-context.routes.ts`, `packages/client/src/features/spatial-context/components/LocationInspector.tsx`, the lorebook editor, and the Active Context UI.
- Location reference art: `packages/server/src/db/schema/gallery.ts`, gallery storage and routes, `packages/server/src/services/image/`, `packages/server/src/routes/generate/illustrator-references.ts`, Game illustration and Storyboard assembly in `packages/server/src/routes/game.routes.ts`, `packages/server/src/services/storage/game-storyboards.storage.ts`, the shared Storyboard prompt contracts, `packages/client/src/features/spatial-context/components/LocationInspector.tsx`, and the image-generation and Storyboard preview UIs.
- Client routing and send paths: `packages/client/src/stores/ui.store.ts`, `packages/client/src/stores/chat.store.ts`, `packages/client/src/components/layout/AppShell.tsx`, `packages/client/src/components/chat/ChatSettingsDrawer.tsx`, `packages/client/src/components/chat/ChatArea.tsx`, `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, `packages/client/src/components/chat/ChatInput.tsx`, `packages/client/src/components/game/GameSurface.tsx`, and `packages/client/src/components/game/GameInput.tsx`.
- Portability and proof: native chat import/export code in `packages/server/src/routes/chats.routes.ts` and `packages/server/src/services/import/`, `scripts/regressions/`, `e2e/core-flows.e2e.ts`, and root `package.json` scripts.

The file list is a boundary, not a requirement to edit every file in one pull request. Each work package below should keep its diff focused.

### Persistence contract

Definitions remain inside chat metadata and are copied automatically when a branch copies chat metadata. Runtime state uses a separate table:

```ts
interface SpatialContextSnapshotRow {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: "bootstrap" | "owner_turn" | "assistant_swipe" | "definition_repair" | "branch_copy";
  transitionCommandId: string | null;
  transitionPayloadHash: string | null;
  createdAt: string;
}
```

Required indexes and invariants:

- One effective row per `(chatId, messageId, swipeIndex)`.
- A transition command ID is unique within its chat when non-null.
- A repeated command ID with different destination, expected revision, or expected current location returns `409 spatial_transition_command_mismatch`.
- A repeated command ID with the same payload returns `409 spatial_transition_already_applied`, includes the committed snapshot and user-message ID, and performs no second write. The client reconciles from the response instead of resending the turn.
- Snapshot rows use stable location IDs. Renames and reparenting do not rewrite snapshots.
- A bootstrap row uses `messageId: ""` and swipe `0` until a committed message anchor exists.
- Deleting a chat, message, or swipe removes or shifts the matching spatial rows in the same places that currently maintain Game and turn-game snapshots.

The new table must be registered in the file-table definitions, file-backed table list, cascade graph, profile backup/restore, and Mari DB integrity metadata. Lookup behavior must be covered by file-native regressions.

### Effective-state and history rules

Use one resolver for APIs, prompts, branching, and the client response:

1. If a specific message and swipe are requested, return that spatial snapshot.
2. For the current view, inspect the latest visible assistant message and its active swipe.
3. If that assistant swipe has no row, walk backward to the nearest user-turn or assistant snapshot in visible message order.
4. Fall back to the bootstrap row.
5. If no snapshot exists and the enabled definition has a valid starting location, return an in-memory starting state and materialize it on the first owner turn.

Owner-turn anchoring:

- Before persistence, resolve the source state from the currently visible history, not from the newest row by timestamp alone.
- In the atomic turn transaction, create the user message, initial swipe, chat timestamps, and an `owner_turn` spatial snapshot anchored to that user message.
- After an assistant response is saved, materialize the same state on its `(messageId, swipeIndex)` as `assistant_swipe`.
- A failed or aborted provider call leaves the accepted user turn and its spatial snapshot committed. Reload therefore shows the move and the saved user message, without inventing an assistant response.
- Regeneration resolves state immediately before the target assistant message and writes that state to the new swipe. Continuation retains the target swipe's state.
- Selecting a swipe changes the effective state through the existing active-swipe row. It does not rewrite other snapshots.
- Branch creation copies the definition, rekeys every copied spatial snapshot to the new message IDs, and includes the bootstrap row. An earlier-message branch stops copying at the selected cutoff.
- Game checkpoints store the applicable spatial snapshot ID or a stable copy of its current location and definition revision. Loading a checkpoint restores both Game state and spatial state.

Definition editing is not historical. A rename or reparent changes the breadcrumb rendered for old snapshots because the stable location ID is resolved against the branch's current definition. An old snapshot may refer to an archived location; it remains readable, but the next destination must be an active reachable node. If an editor archives the currently effective location, `replacementCurrentLocationId` is required and the server writes a `definition_repair` snapshot at the current visible anchor in the same transaction as the new definition revision.

### Atomic owner-turn sequence

Extend `generateRequestSchema` and the client generation contract with optional `pendingSpatialTransition`. It is accepted only for Roleplay and Game owner chats.

The server sequence is:

1. Acquire the existing per-chat generation lock.
2. Parse the request and load the chat inside the request lifecycle.
3. If there is no spatial transition, preserve the current message flow.
4. If a transition exists, start a constant-size database transaction.
5. Re-read the definition and visible state inside the transaction.
6. Validate owner mode, enabled state, expected definition revision, expected current location, command ID, destination status, and reachability.
7. Create the user message and initial swipe through a transaction-bound chat-storage instance.
8. Insert the spatial snapshot and update chat timestamps.
9. For Game, commit the visible Game snapshot in the same transaction where practical.
10. Commit, then continue attachment enrichment, persona snapshotting, prompt assembly, and provider work outside the transaction.

Validation failures occur before optimistic client state is treated as authoritative. A `400` graph or destination error and a `409` stale-state error contain stable machine codes, safe user-facing text, current revision, and current breadcrumb. They never include hidden or blocked destination names.

The client retains the submitted text, attachments, and pending destination until the server accepts the turn. On a conflict it removes the optimistic message, refreshes the Spatial Context query, restores the draft, and offers `Review destinations`. On acceptance it clears all three together.

### Shared projection contract

The resolver returns structured data before any prompt text is produced:

```ts
interface ResolvedOwnerSpatialProjection {
  kind: "owner";
  chatId: string;
  ownerMode: SpatialOwnerMode;
  definitionRevision: number;
  currentLocationId: string;
  breadcrumb: Array<{ id: string; name: string }>;
  description: string;
  modelMemory: string | null;
  lorebookEntryIds: string[];
  destinations: Array<{ id: string; name: string; label?: string }>;
  omittedDestinationCount: number;
}

interface ResolvedLocationVisualProjection {
  chatId: string;
  messageId: string | null;
  swipeIndex: number | null;
  locationId: string;
  breadcrumb: Array<{ id: string; name: string }>;
  visualIdentity: string | null;
  references: Array<{
    imageId: string;
    role: LocationVisualReferenceRole;
    usageNote: string | null;
    sourceLocationId: string;
    inherited: boolean;
  }>;
}

interface StoryboardVisualReferenceCandidate {
  imageId: string;
  source: "explicit" | "location" | "character" | "persona" | "inherited_style";
  entityId?: string;
  label: string;
  role: string;
  order: number;
}

interface StoryboardKeyframeReferencePayload {
  keyframeIndex: number;
  imageIds: string[];
  omitted: Array<{
    imageId: string;
    reason: "provider_limit" | "not_visible" | "missing" | "setting_disabled";
  }>;
}

interface StoryboardVisualReferenceManifest {
  sourceMessageId: string;
  sourceSwipeIndex: number;
  locationId: string | null;
  definitionRevision: number | null;
  provider: string;
  model: string;
  providerReferenceLimit: number;
  status: "ready" | "needs_review";
  candidates: StoryboardVisualReferenceCandidate[];
  keyframes: StoryboardKeyframeReferencePayload[];
  createdAt: string;
}
```

Prompt limits are separate from storage limits:

- At most 20 breadcrumb nodes.
- At most 4,000 characters of owner description.
- At most 8,000 characters of private model memory.
- At most 50 destinations in deterministic `sortOrder`, name, then ID order, followed only by an omitted count.
- At most 50 current-location lorebook references before the lorebook processor applies entry and token budgets.
- At most 6 stored visual references per location and at most 2 location-reference candidates for an ordinary scene request before the provider's total reference limit.
- A Storyboard manifest may retain all resolved candidate IDs for audit and refresh, but every keyframe payload is capped by the provider limit captured when the manifest is created.
- At most 1,000 characters for a connected `awarenessSummary` or fallback public-description excerpt.

One formatter produces the shared structured owner block. Roleplay and Game use thin adapters around that block. The formatter never serializes `lorebookEntryIds`; the owner prompt pipeline consumes them through the lorebook processor. A second formatter, introduced only in Phase 3, produces the privacy-reduced Conversation block and receives no location-lore field.

Every live path calls the same resolver and formatter immediately before final model-request preparation:

- Standard Roleplay generation.
- Game GM generation.
- `/api/generate/dryRun`.
- Live Peek Prompt assembly when no exact saved request exists.
- Retry and continuation paths that rebuild a prompt.

Exact cached Peek Prompt needs no new assembly. It displays the already-saved provider request, which must contain the spatial block used for that swipe. Regression coverage must compare normalized spatial blocks across live generation, dry run, and live Peek Prompt for the same fixture.

### Lorebook-grounded draft contract

Map grounding is an explicit authoring input:

```ts
interface SpatialMapGroundingRequest {
  mode: "setup_only" | "lore_strict" | "lore_expand";
  lorebookIds: string[];
  entryIds?: string[];
}
```

Game setup defaults `lorebookIds` from `GameSetupConfig.activeLorebookIds`. Roleplay defaults them from the chat's active global, linked, and pinned books. The creator can change the selection before generation. Disabled or explicitly excluded books and entries are never sent.

This is not a lorebook activation scan. The server reads the selected sources directly, resolves supported macros against the owner setup context without persisting the resolved text, and builds a catalog containing:

- Temporary source key
- Entry and lorebook names
- Activation keys and tags
- Entry description when present
- Otherwise, a bounded content excerpt

The catalog is limited by the smallest of 100 entries, 16,000 characters, and the connection context remaining after reserving setup, system, and requested output space. Priority is deterministic:

1. Explicitly selected `entryIds`.
2. Entries with location-like tags, names, or keys.
3. Entries with authored descriptions.
4. Remaining entries in stable lorebook and entry order.

If entries are omitted, the preview reports the count and offers Refine sources. It never implies that the whole lorebook was considered.

The simplified model plan adds temporary source keys to each proposed location. The server rejects unknown keys, maps valid keys to stable entry IDs, removes duplicates, and computes preview provenance:

- `Lore-backed`: at least one validated source entry.
- `Inferred`: a relationship or container derived from source material but not represented as its own source entry.
- `Added by AI`: no source entry supports the node.

`lore_strict` rejects every node without a validated source key. `lore_expand` accepts inferred and added nodes but labels them visibly. A valid source key proves provenance, not semantic fidelity; the preview must show source excerpts so the creator can catch a misread relationship or name before Apply.

The generate endpoint returns the normalized draft definition plus a transient provenance map keyed by generated location ID. Only `lorebookEntryIds` persist after Save. Replace and expand retain the existing history protections; expansion may add bindings to new nodes but cannot rewrite existing locations or bindings.

### Game compatibility boundary

When Spatial Context is enabled for a Game chat:

- `SpatialContextSnapshot.currentLocationId` is authoritative.
- Game state `location` is a compatibility projection only.
- Game-state GET responses and tracker UI receive the resolved breadcrumb as the displayed location.
- World State agent patches and manual Game tracker patches cannot independently write `location`; the server drops that field with a debug diagnostic or returns a field-level conflict for explicit manual edits.
- New Game snapshots mirror the breadcrumb into their legacy `location` value so session history and existing UI remain readable, but prompt code still reads the spatial projection.
- A Game map, grid cell, or node may bind explicitly to a stable hierarchy location ID.
- Selecting a bound destination creates a structured pending spatial transition and does not insert movement prose.
- Unbound cell and node movement remains tactical and changes only party position.
- Entering a bound location selects its local map when available; leaving selects the closest bound ancestor map when available.
- The UI labels the systems distinctly as `Story location` and `Map position` when both are visible.
- Disabling Spatial Context immediately restores current legacy Game location behavior without deleting spatial definitions or snapshots.

Negative controls must prove that a model-emitted Game location patch, a manual tracker edit, and an unbound map click cannot change `currentLocationId`. Positive controls prove that a valid bound click uses the normal transition validator.

### Owner UI contract

Chat Settings adds one compact `Hierarchical Map` section for Roleplay and Game only. It shows enabled state, current breadcrumb, active and archived counts, warning count, and `Open Map Editor`. It does not embed the full editor in the drawer.

The Location Editor follows the existing full-page editor route:

- Desktop uses a hierarchy navigator, local map or layer view, and selected-location inspector.
- Mobile shows the hierarchy first and details second, with a visible Back to locations action. No operation depends on hover or drag.
- Rows expose add child, add sibling, reparent, duplicate subtree, archive, and link actions through labelled controls.
- The local view renders children as positioned map nodes, ordered layers, or an accessible list.
- Selecting previews a location; a distinct Enter action navigates to it.
- The inspector contains name, kind, public description, private model memory, icon, presentation, placement or layer order, status, parent, direct links, and linked lore.
- Visual identity is an inline inspector section, not a blocking modal. It shows the primary preview first, then supporting references, role, usage note, inheritance state, broken state, and image-source metadata.
- Gallery selection and upload reuse existing image controls. `Generate establishing reference` opens a preview; accepting the image and setting it as primary are explicit actions.
- A generated scene offers `Set as location reference` from its existing image actions. It never mutates the location merely because the scene was generated there.
- Linked lore uses an inline searchable disclosure rather than a blocking modal. Results group entries by lorebook and expose disabled or excluded state before attachment.
- Attached rows provide Open entry and Detach. Detach never deletes lore, and duplicate subtree copies bindings.
- The lorebook editor shows current-chat map backlinks so a creator can find every location using an entry.
- AI draft controls show source books, grounding mode, considered and omitted entry counts, and provenance without requiring technical prompt knowledge.
- Validation is inline and also summarized near Save. Selecting a summary item focuses the affected node and field.
- The editor uses a local working copy and one revisioned Save action. `editorDirty` protects navigation. Server conflicts preserve the working copy and offer Reload server version or Review differences; there is no blind overwrite.
- Empty state teaches the first action: `Create a starting location`. Enabling is unavailable until a valid active starting location exists.
- Loading uses the existing editor skeleton vocabulary. Save, conflict, archived, hidden, blocked, and invalid states use text or icons in addition to color.

Owner chat surfaces share `SpatialContextRuntimeBar`:

- The persisted breadcrumb is visible above or beside the input without covering story content.
- The destination picker lists parent, children, and direct links in labelled groups while preserving deterministic order.
- Selecting a destination creates a clearly labelled pending chip. It does not move state immediately.
- The chip can be cleared and survives chat switching or reload with the text draft.
- Sending may contain text, attachments, or only a pending destination. The transition is request data and is not appended to visible message text.
- A stale pending destination stays visible after conflict, marked `Needs review`, until the user selects a valid replacement or clears it.
- On narrow screens the breadcrumb truncates in the middle, retains the current location name, and exposes the full path through an accessible disclosure.

The editor and runtime controls use existing semantic theme tokens, support dark, light, and SillyTavern themes, maintain 44px touch targets for primary mobile actions, and include visible focus states. Motion is limited to 150 to 250 ms state transitions and never moves layout purely for decoration.

### Portability and lifecycle coverage

Native Marinara chat export must carry:

- The current definition in `marinara_metadata`.
- Spatial snapshots keyed by exported message ordinal and swipe index, not by display names.
- The bootstrap snapshot when present.

Import creates new chat, message, and snapshot IDs while preserving location IDs inside the definition. Malformed imported graphs disable Spatial Context, preserve the raw definition for repair, and return warnings. They are never silently name-matched or partially activated.

Chat JSONL export preserves location-to-entry IDs because they are part of the definition, but it does not silently bundle lorebook content. Import resolves references against the destination profile and reports missing entries as repairable warnings without name matching. Profile backup and restore preserve working references because they carry both spatial definitions and lorebook tables. A future explicit campaign package may bundle referenced lorebooks for cross-profile portability.

Chat JSONL also preserves location-to-image IDs, roles, usage notes, and ordering, but does not inline image bytes. Import resolves those IDs against the destination profile and reports missing images as repairable warnings without path or filename matching. Profile backup and restore include profile-gallery records and files. A future explicit campaign package may offer `Include location images`, with an asset count, total size, and licensing reminder before export.

When the existing Storyboard lifecycle is exported or copied, its visual manifest preserves the source message ordinal and swipe, resolved location ID, candidate image IDs, and keyframe ordering without embedding bytes. Import remaps message and storyboard IDs, resolves gallery image IDs in the destination profile, and marks missing assets `needs_review`. Legacy storyboards without a manifest resolve one from their saved source message and swipe on first regeneration; they never fall back to name matching or the latest chat location.

Profile backup and restore include the new table through `FILE_BACKED_TABLES`. Chat deletion, bulk deletion, expunge, branch deletion, swipe deletion, and message deletion follow the existing cascade and application-cleanup paths. Existing chats need no eager migration because absent metadata means disabled Spatial Context.

### Work packages and merge order

#### Package A: core contract and proof spike

- Add shared types, schemas, pure graph helpers, limits, fixtures, and stable error codes.
- Add a temporary proof harness for constant-size transactions against file-native storage. Do not keep `.test.ts` files.
- Prove the state resolver with bootstrap, visible swipe, earlier branch point, archived historical current, and stale-definition fixtures.
- Measure projection sizes for shallow, depth-20, wide-500, long-text, and linked graphs.

Gate: graph semantics, projection bounds, snapshot anchors, and transaction feasibility are demonstrated before UI work starts.

#### Package B: definition API and storage

- Add schema, migration, file-backed registration, storage adapter, GET, and revisioned PUT.
- Add current-location replacement for archive operations.
- Wire deletion, swipe shifting, and profile backup/restore.
- Add server regression coverage for revision conflicts, invalid graphs, hidden errors, and command reuse.

Gate: definitions and snapshots round-trip on both storage backends and invalid writes leave no partial state.

#### Package C: owner-turn history integration

- Extend the generation request with `pendingSpatialTransition`.
- Add atomic owner-turn persistence and assistant-swipe materialization.
- Integrate regeneration, continuation, active swipes, branches, and Game checkpoints.
- Add native chat export/import of definitions and snapshots.

Gate: reload, provider failure, swipe changes, earlier-message branching, import/export, and checkpoint restore resolve the expected location.

#### Package D: prompt projection and Game authority

- Add structured projection and bounded formatters.
- Integrate live generation, Game GM, dry run, live Peek Prompt, retries, and continuations.
- Enforce the Game compatibility boundary and tracker breadcrumb display.
- Add privacy and inactive-location negative controls.

Gate: all prompt paths contain the same spatial block, no unrelated location text leaks, and Game cannot maintain a competing authoritative location.

#### Package E: map browser and editor

- Add React Query hooks, conflict mapping, settings summary, and lazy editor route.
- Add hierarchy, local map, layer, list, preview, inspector, and duplicate-subtree workflows.
- Add accessible desktop and mobile states.
- Preserve unsaved edits across revision conflicts.

Gate: creators can build and repair nested maps without drag, hover, or precision input.

#### Package E.1: AI-assisted map drafting

- Add an on-demand setup-time generator that uses bounded Game or Roleplay setup context, never implicit turn-time mutation.
- Generate a simplified keyed map plan, then assign stable IDs, repair safe layout omissions, and validate the complete definition server-side.
- Preview the generated hierarchy as a local draft before replacing editor state.
- Require explicit Apply and Save actions; generation never enables Spatial Context or writes a definition by itself.
- Keep ordinary conversation history out of the generation prompt and expose final prompts through debug logging.

Gate: a nontechnical creator can describe a world, receive a valid nested map, inspect it, and decline or apply it without changing persisted state until Save.

#### Package E.1.1: history-safe AI map expansion

- Treat whole-map AI creation as a pre-campaign workflow. Once message-linked spatial history exists, preserve every existing location ID server-side.
- Replace the active-campaign generator with an add-only expansion workflow scoped to a selected active location.
- Preserve the current location, starting location, existing descriptions, links, layout, archived nodes, and future Game bindings. Assign new stable IDs only to added locations.
- Keep expansion based on bounded setup and selected-location context, not ordinary turn history.
- Preview new locations as a local draft and retain the existing Apply and Save boundary.
- Allow whole-map replacement only before committed spatial history exists, with expansion as the safer default when a map is already present.

Gate: AI can grow an active campaign map without orphaning turn snapshots, changing current location, or replacing existing IDs.

#### Package E.2: Game setup wizard map option

- Add an optional `Draft a hierarchical world map` choice to the existing Features step, with a simple size selection.
- Run map generation only after `/game/setup` persists the world overview and story arc. A gameplay turn is not required.
- Keep setup visibly busy while the follow-up draft is generated, including after a repaired setup payload is applied.
- Open the normal AI preview and map editor after generation. Skip returns to the game, Apply changes only the working copy, and Save remains the persistence boundary.
- If map generation fails, preserve the successfully created game, explain the failure, and let the creator build a map later from Chat Settings.
- Do not embed the full map editor into the narrow setup wizard or silently enable and persist a generated definition.

Gate: a creator can request a richer initial map during setup without generating from incomplete local wizard state or bypassing review.

#### Package F: Roleplay and Game runtime UI

- Add the shared runtime bar and per-chat pending-transition persistence.
- Integrate Roleplay and Game send paths without altering visible message text.
- Add explicit Game map, cell, and node binding controls.
- Select bound maps after accepted transitions while preserving unbound tactical movement.

Gate: Roleplay and Game can move, recover from stale state, reload, switch chats, and use the feature with keyboard and touch.

#### Package F.1: location lorebook bindings and runtime activation

- Extend the shared schema and editor working copy with bounded `lorebookEntryIds`.
- Add inline map attachment controls, lorebook backlinks, and broken-reference warnings.
- Extend shared lorebook processing with forced candidate IDs, activation-source deduplication, exclusions, and the reserved location-lore cap.
- Integrate the same resolver into Roleplay, Game GM, dry run, and live Peek Prompt paths.
- Add Active Context source and truncation reporting.
- Preserve reference IDs through branch and JSONL export/import flows, and warn when destination lore is missing.

Gate: moving between locations activates only the destination's enabled attached lore in every owner prompt path, with no duplicate injection or Conversation leakage.

#### Package F.2: lorebook-grounded map drafting

- Add grounding mode and explicit source selection to create, replace, and expand requests.
- Build the bounded source catalog from selected lorebooks, not ordinary chat scanning.
- Validate temporary source keys and auto-bind valid entries to generated nodes.
- Show Lore-backed, Inferred, and Added by AI provenance with source inspection in the draft preview.
- Enforce source-backed nodes in Strict canon and visible unsupported additions in Canon with expansion.
- Preserve history-safe add-only expansion and the existing Apply then Save review boundary.

Gate: selected lorebook facts ground the generated hierarchy directly, every unsupported location is visible before Save, and strict mode cannot persist an unreferenced generated node.

#### Package F.3: location visual identity and scene-art references

- Add bounded visual identity text and stable profile-gallery bindings to the location schema and editor working copy.
- Add the inline visual identity editor, primary and supporting roles, explicit style inheritance, gallery backlinks, and broken-reference repair.
- Add the parallel per-chat Illustrator and Game provider-use controls, with first-primary consent and backward-compatible off defaults.
- Add on-demand establishing-reference generation and explicit promotion of reviewed generated scenes.
- Resolve the applicable message and swipe location for Roleplay Illustrator and Game scene-art requests.
- Merge explicit, location, character, persona, and inherited-style candidates deterministically under each provider's existing limit, with visible omission reasons.
- Preserve IDs and metadata through branches and JSONL, include binaries in profile backup and restore, and add story-prompt and Conversation negative controls.

Gate: repeated art in one location can reuse a reviewed place identity with deterministic, visible tradeoffs against character references, historical message art resolves its historical location, and no visual-only data leaks into text prompts.

#### Package F.3.1: Storyboard visual-reference manifests

- Keep F.3.1 as a downstream consumer of F.3 and a separate reviewable change; it does not expand the F.3 persistence gate.
- Add a frozen reference bank and ordered per-keyframe payload manifest to Storyboard metadata.
- Anchor location resolution to the Storyboard's source message and swipe, then reuse the same place candidate across its frames.
- Select character and persona references from each keyframe's visible-character list and never spend capacity on off-screen cast members.
- Apply explicit, single-slot, multi-slot, supporting, and inherited-style priorities deterministically through the existing provider-capability resolver.
- Add progressive Visual sources, omission reasons, needs-review conflicts, and explicit Refresh references to preview and regeneration.
- Preserve legacy Storyboard behavior when Spatial Context is disabled or no eligible location reference exists.

Gate: regenerating a keyframe reuses its frozen payload, location and character selections are historically correct and inspectable, and changing provider capacity cannot silently alter an existing storyboard.

#### Package G: connected Conversation

- Implement only after Packages A through F.3.1 are stable.
- Resolve the linked owner at generation time and use the reduced projection formatter.
- Add conservative presence wording and read-only UI.
- Prove unlink, relink, deleted owner, malformed reciprocal links, cycles, and concluded story behavior.

Gate: Conversation never receives private model memory, internal IDs, hidden destinations, location-attached lore IDs or content, location visual-reference IDs or contents, or mutation capability.

Model-requested movement, creator templates, portable campaign packages, image-to-map inference, bulk location-art generation, automatic multi-view character-reference selection, and per-character positions remain separate later packages after the owner grounding, visual-identity, and Storyboard-manifest work ships.

### Issue and pull-request boundaries

This is a large feature under the repository workflow. Before Package A implementation begins:

1. Confirm or open the single tracking issue and make ownership visible there.
2. Check for an existing issue-linked branch, draft pull request, or project-board item.
3. Open a draft pull request against `staging` as soon as implementation starts.
4. Use the work packages as reviewable PR boundaries when practical; do not combine the owner MVP and connected Conversation merely to reduce PR count.

Suggested issue split:

1. Spatial Context shared core, persistence, and definition API.
2. Owner-turn snapshots, swipes, branches, checkpoints, and portability.
3. Owner prompt projection and Game compatibility.
4. Owner editor and runtime movement UI.
5. Location lorebook bindings and owner runtime activation.
6. Lorebook-grounded map drafting.
7. Location visual identity and scene-art reference resolution.
8. Storyboard frozen visual-reference manifests.
9. Connected Conversation read-only projection.
10. Model-requested movement.

### Proof matrix

| Claim | Automated proof | Manual proof |
| --- | --- | --- |
| Location lore activation is exact and bounded | Fixtures cover accepted movement, pending and rejected movement, disabled and excluded entries, duplicate activation sources, token truncation, reload, swipes, and branches | Move between two differently linked locations in Roleplay and Game, then inspect Active Context and Peek Prompt |
| Lorebook grounding is inspectable | Strict-mode fixtures reject unreferenced nodes; expansion fixtures preserve validated source keys and label unsupported nodes; catalog caps and omission counts are deterministic | Draft from a large existing lorebook, open source excerpts, compare Strict canon and Canon with expansion, and reject an invented location |
| Location art stays consistent and bounded | Fixtures cover exact-location selection, historical swipe resolution, explicit style inheritance, missing images, provider limits, request kinds, and deterministic omission reasons | Set a primary reference, generate several Game and Roleplay scenes in the same place, move elsewhere, retry art on an older swipe, and inspect the visual-source preview |
| Storyboard references are reproducible | Fixtures cover source swipe anchoring, frozen banks, visible-character selection, single-slot and multi-slot providers, missing assets, lower and higher replacement capacity, legacy manifests, and explicit refresh | Generate a multi-frame storyboard, move locations, change a character and location primary, regenerate before and after Refresh references, and inspect every frame's Visual sources |
| Graph validation is deterministic | Dedicated spatial regression script with positive and negative fixtures | Inspect inline editor errors for representative invalid nodes |
| Move and user message are atomic | Injected storage failure before and after each transaction write on both backends | Force a stale revision while a draft and destination are pending |
| History restores the right location | Snapshot regression covering reload, swipes, regeneration, branch cutoff, and checkpoint | Exercise each flow in Roleplay and Game |
| Prompt paths agree | Compare normalized blocks from generation helper, dry run, and live Peek Prompt | Inspect Peek Prompt and debug output for one chat per owner mode |
| Context stays bounded | Wide and long-text fixtures assert character and destination caps | Inspect a deep and wide hierarchy in the editor and destination picker |
| Privacy holds | Negative assertions for private memory, hidden links, inactive nodes, unrelated descriptions, location-attached lore IDs and content, and all location visual-reference fields and bytes | Link a Conversation chat and inspect its text and image request previews in Phase 3 |
| Game has one location authority | Reject legacy patches; validate bound transitions; preserve unbound movement | Try tracker edit, bound and unbound map moves, checkpoint load, enable, and disable |
| UI is resilient | Playwright flow for create, edit, pending move, conflict, and mobile navigation | Verify dark, light, SillyTavern, keyboard, touch, long names, and empty states |
| Portability preserves IDs and state | Native export/import and profile backup/restore round trips cover spatial, lore, image, and Storyboard-manifest bindings; missing destination lore or images produce warnings | Export a branched chat with a storyboard, import it with and without its lorebooks and gallery assets, and inspect the breadcrumb, history, bindings, frozen keyframe sources, and warnings |

Add `scripts/regressions/spatial-context.regression.ts` and a `regression:spatial` package script, then include it in `pnpm regression`. Do not add permanent `.test.ts` files. Each implementation PR still runs the narrow spatial regression plus the repository checks appropriate to its scope.

## Acceptance criteria

- A map location stores lorebook entry references, never copied lore content.
- A location stores optional visual identity metadata and stable gallery image references, never raw paths, external URLs, or image bytes.
- Image style profiles control rendering style, location references control place identity, and character or persona references control subject identity.
- Eligible scene-art requests resolve the exact location for their message and swipe, including historical retries, and never fuzzy-match a location by name.
- Generated art becomes a location reference only after an explicit creator action.
- Layout references never enter ordinary scene generation automatically, and only style references may inherit to descendants.
- Text prompts and Connected Conversation receive no location visual-reference IDs, bytes, paths, or image-only notes.
- Storyboard resolves location from its source message and swipe, freezes its reference bank and ordered keyframe payloads, and reuses them during regeneration until explicit refresh.
- Each Storyboard keyframe selects references only for its resolved location and visible people; off-screen cast members never consume capacity.
- Single-slot and multi-slot provider behavior is deterministic and visible, and provider changes never silently add, remove, or replace frozen references.
- Storyboard manifests store stable IDs and metadata, never image bytes or filesystem paths.
- Legacy storyboards without manifests never use location-name matching or the latest chat location as an implicit repair.
- Only the accepted exact current location force-activates attached lore, subject to disabled, exclusion, deduplication, ordering, entry-limit, and token-budget rules.
- Active Context identifies current-location activation, combined activation sources, and deterministic truncation.
- Grounded drafting reads explicitly selected lore entries directly rather than depending on keyword scans or generated world-overview summaries.
- Strict canon produces only source-backed locations; Canon with expansion labels every inferred or unsupported addition before Save.
- Connected Conversation receives no location-attached lore IDs or content.
- Rename and reparent operations preserve location identity.
- Invalid graphs and stale writes never mutate state.
- Movement commits with a user turn or not at all.
- Reload, swipe selection, earlier-message branching, and Game checkpoint restore resolve the correct location.
- Owner prompts contain only active-location context and valid destinations.
- Game does not display or prompt from a competing free-text location when enabled.
- Existing Game maps can bind explicitly to hierarchy locations without breaking tactical movement.
- Roleplay and Game use the same hierarchy and transition rules.
- Dry-run and Peek Prompt use the same projection behavior as generation.
- Existing chats and disabled Spatial Context retain current behavior.
- Conversation cannot own or mutate spatial state.
- Private model memory never enters Conversation projection.

## Validation

Deterministic coverage must include graph limits, cycles, navigation directions, hidden and blocked links, stale revisions, idempotency, branch points, swipes, checkpoints, lorebook reference limits, forced activation, exclusions, deduplication, token truncation, grounding catalog caps, source-key validation, strict-mode rejection, provenance, visual-reference limits, primary and inheritance rules, historical visual resolution, provider trimming, missing-image warnings, request-kind exclusions, Storyboard source anchoring, frozen-manifest regeneration, visible-character filtering, single-slot and multi-slot selection, provider-capacity changes, explicit refresh, legacy-manifest fallback, privacy boundaries, and inactive-location negative controls.

Repository checks:

```bash
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

Manual verification covers desktop and mobile authoring, deep breadcrumbs, layers, positioned maps, long names, conflict recovery, archive protections, Roleplay, Game, bound and unbound map movement, reload, branching, checkpoint restore, linked-lore attachment and backlinks, disabled and broken lore, large-source omission warnings, Strict canon and Canon with expansion previews, visual upload and gallery selection, primary and supporting references, explicit scene promotion, inherited style, broken images, provider omission reporting, historical-swipe art, Storyboard Visual sources, single-slot and multi-slot providers, frozen regeneration, provider-change review, explicit refresh, legacy Storyboards, Active Context, and Peek Prompt. PR validation checkboxes remain unchecked for human verification.

## Deferred

- Immediate movement without a chat turn
- Independent character positions
- Generic flags, events, or scripts
- Location templates and scenario packages
- Per-character spatial knowledge
- Shareable location lore in Conversation
- Automatic image-to-map inference
- Automatic promotion of generated scenes into location canon
- Bulk generation of reference art for every location
- Automatic shot-aware selection among multiple character outfits, angles, expressions, and detail references
- Provider-specific composite or contact-sheet reference generation
