# Story Bundle

> Development documentation for the new **Story Bundle** object in Marinara Engine.
> Branch: `story-bundle-dev` · Status: current iteration (Metadata tab + image support + Agents tab + Play flow).

## 1. Overview & Scope

A **Story Bundle** is a new, self-contained data object in Marinara Engine.
It carries a **title** (`name`) and an optional **HTML description** (`description`),
plus assignments to characters, personas, lorebooks, presets, agents, and inline
intro messages. Further fields (chapters, scenes, …) are intentionally not
implemented yet — but the architecture is designed so later iterations can
extend it without rebuilding existing layers.

```ts
interface StoryBundle {
  id: string;             // nanoid, generated server-side
  name: string;           // Bundle title (1–200 chars, trimmed)
  description: string | null; // Optional HTML description (sanitized client-side via DOMPurify)
  imagePath: string | null;   // Optional bundle picture (served from the story-bundle image store)
  avatarCrop?: AvatarCrop | null; // Avatar crop settings for the bundle image
  comment: string;        // Optional free-text note shown under the bundle name
  creator: string;        // Optional author/creator
  version: string;        // Optional version string (e.g. "1.0.0")
  tags: string[];         // Free tags (JSON array in the DB)
  characterIds: string[]; // Assigned character IDs (JSON array in the DB)
  personaIds: string[];   // Assigned persona IDs (JSON array in the DB)
  lorebookIds: string[];  // Assigned lorebook IDs (JSON array in the DB)
  presetIds: string[];    // Assigned prompt-preset IDs (JSON array in the DB)
  agentIds: string[];     // Pre-configured agent IDs (JSON array in the DB)
  intros: StoryBundleIntro[]; // Inline intros (name + text), JSON array in the DB
  createdAt: string;      // ISO-8601 timestamp
  updatedAt: string;      // ISO-8601 timestamp
}

interface StoryBundleIntro {
  id: string;   // generated client-side via crypto.randomUUID()
  name: string; // Intro name (1–200 chars)
  text: string; // Message text (min 1 char)
}
```

The object follows the repo's established end-to-end pattern exactly:

```
Shared (types + Zod) → Server (DB schema + storage + REST routes) → Client (hooks + store + panel + editor)
```

## 2. Layer: Shared (`packages/shared`)

| File | Purpose |
|---|---|
| `src/types/story-bundle.ts` | TypeScript interfaces `StoryBundle` (with comment, creator, version, tags, imagePath, avatarCrop, agentIds) and `StoryBundleIntro` |
| `src/schemas/story-bundle.schema.ts` | Zod schemas for API input |
| `src/index.ts` | Barrel exports (`export * from ...`) |

### Zod Schemas

| Schema | Rule |
|---|---|
| `storyBundleIdParamsSchema` | `{ id: string, min 1 }` — URL params |
| `storyBundleIntroSchema` | `{ id: string min 1, name: string trimmed min 1 max 200, text: string min 1 }` |
| `createStoryBundleSchema` | `{ name: string, description?: string \| null, imagePath?: string \| null, avatarCrop?: unknown \| null, comment?: string, creator?: string, version?: string, tags?: string[], characterIds?: string[], personaIds?: string[], lorebookIds?: string[], presetIds?: string[], agentIds?: string[], intros?: StoryBundleIntro[] }` — name trimmed, min 1, max 200 |
| `updateStoryBundleSchema` | Same fields as create, all optional |

Derived types: `CreateStoryBundleInput`, `UpdateStoryBundleInput`.

## 3. Layer: Server (`packages/server`)

| File | Purpose |
|---|---|
| `src/db/schema/story-bundles.ts` | `fileTable("story_bundles", …)` — table definition |
| `src/db/schema/index.ts` | Barrel export added |
| `src/db/file-backed-store.ts` | `"story_bundles"` registered in `FILE_BACKED_TABLES` |
| `src/services/storage/story-bundles.storage.ts` | `createStoryBundlesStorage(db)` — CRUD access |
| `src/routes/story-bundles.routes.ts` | REST endpoints under `/api/story-bundles` |
| `src/services/export/export-image-helpers.ts` | Shared image helpers: `readAvatarDataUrl()`, `readSpritesForId()`, `readGalleryForCharacter()` |
| `src/routes/index.ts` | Route registration added |

The `story_bundles` table is a file-native JSON table like all other entities
(lorebooks, presets, personas …). IDs are generated via `newId()` (nanoid),
timestamps via `now()` (ISO) from `utils/id-generator.ts`.

`characterIds`, `personaIds`, `lorebookIds`, `presetIds`, and `agentIds` are
stored as JSON strings in text columns and serialized on read/write via
`JSON.stringify`/`JSON.parse` (same pattern as Character Groups).

> **Important:** Every new `fileTable` must additionally be registered in
> `FILE_BACKED_TABLES` (`src/db/file-backed-store.ts`), otherwise the store
> throws `Unsupported table: <name>` on every access.

### REST API

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/story-bundles` | List, sorted by `createdAt` |
| `GET` | `/api/story-bundles/:id` | A single bundle, else `404` |
| `POST` | `/api/story-bundles` | Create (Zod-validated), `201` + object |
| `PATCH` | `/api/story-bundles/:id` | Update fields, `404` if unknown |
| `DELETE` | `/api/story-bundles/:id` | Delete, `404` if unknown |
| `POST` | `/api/story-bundles/:id/image` | Upload/replace the bundle picture (base64 image in body) |
| `DELETE` | `/api/story-bundles/:id/image` | Remove the bundle picture and reset the avatar crop |
| `GET` | `/api/story-bundles/images/file/:filename` | Serve a stored bundle image file |
| `GET` | `/api/story-bundles/:id/export` | Export as `.marinara.json` (download) |

Import is handled through the existing `/api/import/marinara` endpoint
(POST with an `ExportEnvelope`, `type: "marinara_story_bundle"`).

Error handling: Zod errors → `400`, missing records → `404`,
internal errors → `500` with `logger.error(err, …)` (Pino, never `console.*`).

## 4. Layer: Client (`packages/client`)

### Data Access

| File | Purpose |
|---|---|
| `src/hooks/use-story-bundles.ts` | TanStack Query hooks |

- `storyBundleKeys` — query-key factory (`all`, `list`, `detail(id)`)
- `useStoryBundles()` — list (`staleTime` 2 min, `placeholderData`)
- `useStoryBundle(id)` — detail, only active when `id` is set
- `useCreateStoryBundle()` / `useUpdateStoryBundle()` / `useDeleteStoryBundle()`
  — mutations, invalidate `storyBundleKeys.all` on success
- `useUploadStoryBundleImage()` / `useRemoveStoryBundleImage()` — image mutations

### Navigation & State (`src/stores/ui.store.ts`)

- New panel type: `"story-bundles"` in the `Panel` union.
- New detail-surface field: `storyBundleDetailId: string | null`.
- Actions: `openStoryBundleDetail(id)` / `closeStoryBundleDetail()`.
- Mutual exclusion: every `open*Detail` action sets `storyBundleDetailId: null`
  (and vice versa), so exactly one detail view is ever open. `hasAnyDetailOpen`,
  `closeAllDetails`, and `requestChatModeShortcut` account for the new field too.

### UI Components

| File | Purpose |
|---|---|
| `src/components/panels/StoryBundlesPanel.tsx` | List panel in the right panel (with per-row Play button) |
| `src/components/story-bundles/StoryBundleEditor.tsx` | Full-page editor (detail view) — shell with tab rail |
| `src/components/story-bundles/StoryBundleMetadata.tsx` | Metadata tab (avatar/image upload, bundle ID, name, comment, creator, version, tags) |
| `src/components/story-bundles/StoryBundleDescription.tsx` | Description tab (HTML description with preview toggle) |
| `src/components/story-bundles/StoryBundleCharacters.tsx` | Characters tab (search/random/load-more, groups dropdown, selected list) |
| `src/components/story-bundles/StoryBundlePersonas.tsx` | Personas tab (single-select persona picker with avatar-crop support) |
| `src/components/story-bundles/StoryBundleLorebooks.tsx` | Lorebooks tab (search/random/load-more, selected list; no groups) |
| `src/components/story-bundles/StoryBundlePresets.tsx` | Presets tab (search/random/load-more, selected list; no groups) |
| `src/components/story-bundles/StoryBundleAgents.tsx` | Agents tab (search/random/load-more, selected list; no groups) |
| `src/components/story-bundles/StoryBundleIntros.tsx` | Intros tab (inline intros: name + text, add/edit/delete) |
| `src/components/layout/RightPanel.tsx` | Panel registered (`PANEL_CONFIG` + `PANELS`) |
| `src/components/layout/TopBar.tsx` | TopBar button (`BookMarked` icon, gradient) |
| `src/components/layout/AppShell.tsx` | Lazy import + `detailView` chain |
| `src/styles/globals.css` | Gradient `.mari-panel-gradient--story-bundles` (pink → violet) |
| `packages/shared/src/types/export.ts` | `ExportType` extended with `"marinara_story_bundle"` |
| `packages/server/src/services/import/marinara.importer.ts` | `importStoryBundle()` — import handler for story-bundle envelopes |
| `tests/story-bundle/helpers/story-bundle-fixture.ts` | Test helper: `importStoryBundleFixture()`, `buildStoryBundleEnvelope()` |
| `tests/story-bundle/helpers/story-bundle-api.ts` | Test helper: `StoryBundleAPI` class (create/delete/import/export) |
| `tests/story-bundle/helpers/fresh-client.ts` | Test helper: `prepareFreshClient()` (client state before each test) |
| `tests/story-bundle/data/*.json` | Fixture files in various states (empty, with-description, with-characters, with-personas, with-lorebooks, full) |
| `tests/story-bundle/data/test-data.html` | HTML test data for the description preview |
| `tests/story-bundle/tests/*.test.ts` | Playwright e2e tests |

**UI workflow:**
1. The TopBar button "Story Bundles" opens the right panel.
2. "New Bundle" opens a prompt dialog (title "Create Story Bundle") with exactly
   one field (title). After confirming, the bundle is created and the editor opens.
3. The editor has eight tabs (via `EditorTabRail`): **Metadata** (avatar, bundle ID,
   name, comment, creator, version, tags), **Description** (HTML description with
   preview toggle), **Characters** (character assignment), **Personas**
   (single-select persona), **Lorebooks** (lorebook assignment), **Presets**
   (preset assignment), **Agents** (agent assignment), **Intros** (inline intros:
   name + text). Each tab is extracted into its own component under
   `src/components/story-bundles/`.
4. The **Metadata** tab contains:
   - **Avatar/image upload**: drag & drop or file picker for a bundle picture.
     Supports JPG, PNG, WebP. Preview with crop support.
   - **Bundle ID**: read-only display of the internal ID.
   - **Name**: required field (1–200 chars, trimmed).
   - **Comment**: optional free-text note shown under the bundle name.
   - **Creator**: optional author/creator field.
   - **Version**: optional version field (e.g. "1.0.0").
   - **Tags**: free tags with add/remove. Duplicates are prevented.
5. The **Description** tab contains the HTML description textarea with a
   preview toggle.
6. The description supports a **preview toggle**: in edit mode you type HTML,
   in preview mode the sanitized HTML (via DOMPurify) is rendered live.
   Allowed tags: `a`, `b`, `blockquote`, `br`, `code`, `del`, `em`, `h1`–`h6`,
   `hr`, `i`, `img`, `ins`, `li`, `mark`, `ol`, `p`, `pre`, `s`, `small`,
   `span`, `strong`, `sub`, `sup`, `table`, `tbody`, `td`, `th`, `thead`,
   `tr`, `u`, `ul`.
7. The **Characters** tab has three sections:
   - **Selected Characters**: shows all assigned characters with avatar, name,
     title, and a remove button (Trash2 icon). Empty state shows a dashed
     placeholder box.
   - **Groups**: dropdown of all character groups. Clicking "Add" adds all
     characters of the selected group (duplicates are ignored). Shows per group
     how many new characters would be added.
   - **Add Characters**: search field with magnifier icon, "Random" button
     (picks a random character), list of all available characters with
     avatar/name/title and a plus button to add. "Load more" button for
     pagination. Empty state shows matching messages.
8. The **Personas** tab is a single-select picker:
   - **Selected Persona**: the one assigned persona with avatar (incl. crop),
     name, title, and a remove button. Picking a persona replaces any
     previously selected one.
   - **Add Personas**: search field, random button, paginated list with
     avatar/name/title and a plus button.
9. The **Lorebooks** tab has two sections (no groups, since lorebooks have no
   folder groups):
   - **Selected Lorebooks**: assigned lorebooks with BookOpen icon, name,
     category, and a remove button.
   - **Add Lorebooks**: search field, random button, paginated list with
     BookOpen icon/name/category and a plus button.
10. The **Presets** tab follows the same pattern as Lorebooks (no groups):
    - **Selected Presets**: assigned presets with SlidersHorizontal icon, name,
      description, and a remove button.
    - **Add Presets**: search field, random button, paginated list with
      SlidersHorizontal icon/name/description and a plus button.
11. The **Agents** tab follows the same pattern (no groups):
    - **Selected Agents**: assigned agents with icon, name, description, and a
      remove button.
    - **Add Agents**: search field, random button, paginated list with a plus
      button. Loading state while the agent list resolves.
12. The **Intros** tab manages 1:n inline intros (no references to external
    entities):
    - **Add Intro**: button opens an inline form with a name input and a text
      textarea. Saving creates a new intro with `crypto.randomUUID()`.
    - **Selected Intros**: list of all intros with MessageSquare icon, name,
      text preview, edit button (Pencil), and delete button (X).
    - **Edit**: opens the form with the existing values, saving updates the
      intro in place.
    - **Delete**: removes the intro immediately from the list.
    - **Empty state**: dashed placeholder box when no intros exist.
    - **Play flow**: when clicking "Play", if intros exist, a choice dialog
      (`showChoiceDialog`) shows the intro names. The chosen intro is inserted
      as the first assistant message into the chat
      (`POST /api/chats/:id/messages` with `role: "assistant"`). Cancelling
      stops the play flow.
13. **Play**: both the panel row and the editor header expose a Play button.
    Playing creates a new roleplay chat (`POST /api/chats`) seeded with the
    bundle's characters, first persona, first prompt preset, and first
    connection; then activates the bundle's lorebooks and agents on the chat
    via `PATCH /api/chats/:id/metadata`, inserts the selected intro, and tags
    the chat with `storyBundleId` so the chat sidebar shows the bundle picture.
    The editor plays the **current draft state** (what the user sees), so
    unsaved changes are honored. If the selected preset has configurable
    variables, the ChoiceSelectionModal opens instead of the full setup wizard.
14. Deleting goes through a destructive confirmation dialog.
15. **Export**: `GET /api/story-bundles/:id/export` returns an `ExportEnvelope`
    with `type: "marinara_story_bundle"` as a JSON download (`.marinara.json`).
    The envelope contains `name`, `description`, `characterIds`, `personaIds`,
    `lorebookIds`, `presetIds`, `agentIds`, `intros`, plus `embeddedCharacters`,
    `embeddedPersonas`, `embeddedLorebooks`, `embeddedPresets` with full entity
    data. Characters and personas are embedded with avatars, sprites, and
    gallery as base64 data URLs — the JSON is fully self-contained for
    PC-to-PC transfer.
16. **Import**: `POST /api/import/marinara` with a story-bundle envelope creates
    a new bundle. The import handler (`importStoryBundle`) validates the name
    (required), filters ID arrays to strings, and imports embedded
    characters/personas/lorebooks/presets. Import deduplicates by name
    (case-insensitive): existing entities are skipped, only new ones are
    created. Binary data (avatars, sprites, gallery) is restored from the
    base64 data URLs. Referenced agents that are not installed are surfaced in
    the import dialog with an option to install the providing capability
    package. For tests there are the helpers `importStoryBundleFixture(page,
    filePath)` and `buildStoryBundleEnvelope(input)` in
    `tests/story-bundle/helpers/story-bundle-fixture.ts`.

### Localization (`src/localization/locales/en.json`)

New semantic keys: `navigation.topbar.storyBundles` plus the `storyBundles.*`
block (add, addAgents, addCharacters, addFromGroup, addIntros, addLorebooks,
addPersona, addPreset, agentRandomHint, agentsEmpty, allAdded, allAgentsAdded,
allCharactersAdded, allLorebooksAdded, back, cancel,
charactersEmpty, close, count, create, createDialogTitle, createFailed,
createPromptMessage, delete, deleteConfirmBody, deleteConfirmTitle, deleteFailed,
descriptionEdit, descriptionEmpty, descriptionHint, descriptionLabel,
descriptionPlaceholder, descriptionPreview, editorTitle, embeddedFound,
embeddedFoundHint, empty, export, exportFailed, exportSuccess, groups,
imageReadFailed, imageRemoveFailed, imageRemoved, imageUpdated,
imageUploadFailed, invalidImageType, import, importDropHint, importedAs,
importedWithEmbedded, importEmbedded, importFailed, importFailedCount,
importFormat, importing, importNotAStoryBundle, importParseFailed,
importSucceeded, importTitle, introAddHint, introEdit, introNamePlaceholder,
introPickMessage, introPickTitle, introRemove, introSave, introSaveEdit,
introsEmpty, introTextPlaceholder, loadingAgents, loadMore, lorebookRandomHint,
lorebooksEmpty, missingAgentInstall, missingAgentInstalled,
missingAgentInstallFailed, missingAgentInstalling, missingAgentNoPackage,
missingAgentsFound, missingAgentsFoundHint, nameLabel, namePlaceholder,
newBundle, noAgentsMatch, noCharactersMatch, noLorebooksMatch,
noPersonasAvailable, noPersonasMatch, noPresetsAvailable, noPresetsMatch, of,
personaAlreadySelected, personaEmpty, personaRandomHint, play, playFailed,
playStarted, playTitle, presetAlreadySelected, presetEmpty, presetRandomHint,
random, randomHint, removeAgent, removeCharacter,
removeLorebook, removePersona, removePreset, save, saveFailed, saveSuccess,
searchAgents, searchCharacters, searchLorebooks, searchPersonas, searchPresets,
selectedAgents, selectedCharacters, selectedIntros, selectedLorebooks,
selectedPersona, selectedPreset, skipEmbedded) and the `storyBundles.metadata.*`
sub-block (add, addTag, avatar, bundleId, changeImage, comment,
commentPlaceholder, creator, creatorPlaceholder, name, removeAll, removeImageConfirm,
removeImageMessage, removeImageTitle, removeTag, tags, uploading, uploadImage,
version, versionPlaceholder).
Community locale files remain intentionally partial (fallback to English).

## 5. data-testid Catalog

Every React component of the feature carries `data-testid` attributes for
smoke/regression tests:

### TopBar
| testid | Element |
|---|---|
| `topbar-panel-button-story-bundles` | TopBar button "Story Bundles" |

### `StoryBundlesPanel`
| testid | Element |
|---|---|
| `story-bundles-panel` | Panel root |
| `story-bundles-import-button` | Import button |
| `story-bundles-create-button` | "New Bundle" button |
| `story-bundle-row-${bundle.id}` | List row of a bundle |
| `story-bundle-play-button-${bundle.id}` | Play button in the row action pill |
| `story-bundle-export-button-${bundle.id}` | Export button in the row |
| `story-bundle-delete-button-${bundle.id}` | Delete button in the row |

### `StoryBundleEditor`
| testid | Element |
|---|---|
| `story-bundle-editor` | Editor root |
| `story-bundle-editor-loading` | Loading state |
| `story-bundle-editor-header` | Sticky header |
| `story-bundle-editor-back-button` | Back button |
| `story-bundle-editor-play-button` | Play button |
| `story-bundle-editor-save-button` | Save button |
| `story-bundle-editor-delete-button` | Delete button |
| `story-bundle-editor-tab-${tabId}` | Tab rail buttons (metadata, description, characters, personas, lorebooks, presets, agents, intros) |

### `StoryBundleDescription`
| testid | Element |
|---|---|
| `story-bundle-editor-description` | Description tab container |
| `story-bundle-editor-description-label` | Description field label |
| `story-bundle-editor-description-input` | HTML textarea for the description |
| `story-bundle-editor-description-preview-toggle` | Preview/edit toggle button |
| `story-bundle-editor-description-preview` | Rendered HTML preview |

### `StoryBundleCharacters`
| testid | Element |
|---|---|
| `story-bundle-editor-characters` | Characters tab container |
| `story-bundle-editor-characters-search` | Search field in the add-characters section |
| `story-bundle-editor-characters-group-select` | Groups dropdown |
| `story-bundle-editor-characters-add-group` | "Add" button for groups |
| `story-bundle-editor-characters-random` | "Random" button |
| `story-bundle-editor-characters-add-${id}` | Add button of an available character |
| `story-bundle-editor-characters-load-more` | "Load more" button |
| `story-bundle-editor-characters-empty` | Empty-state text |
| `story-bundle-editor-characters-selected` | Selected-characters section |
| `story-bundle-editor-characters-remove-${id}` | Remove button of a selected character |
| `story-bundle-editor-characters-selected-empty` | Selected empty-state text |

### `StoryBundleMetadata`
| testid | Element |
|---|---|
| `story-bundle-editor-metadata` | Metadata tab container |
| `story-bundle-editor-metadata-avatar` | Avatar/image section |
| `story-bundle-editor-metadata-avatar-preview` | Avatar preview after upload |
| `story-bundle-editor-metadata-upload-button` | Image upload button |
| `story-bundle-editor-metadata-image-input` | Hidden file input |
| `story-bundle-editor-metadata-bundle-id` | Bundle ID (read-only) |
| `story-bundle-editor-metadata-name-input` | Name input field |
| `story-bundle-editor-metadata-comment-input` | Comment textarea |
| `story-bundle-editor-metadata-creator-input` | Creator input field |
| `story-bundle-editor-metadata-version-input` | Version input field |
| `story-bundle-editor-metadata-tags` | Tags section |
| `story-bundle-editor-metadata-tags-list` | Tags list |
| `story-bundle-editor-metadata-tags-remove-all` | "Remove All" tags button |
| `story-bundle-editor-metadata-tag-input` | Tag input field |
| `story-bundle-editor-metadata-tag-add-button` | Add-tag button |
| `story-bundle-editor-metadata-tag-${tag}` | Individual tag chip (dynamic) |

### `StoryBundlePersonas`
| testid | Element |
|---|---|
| `story-bundle-editor-personas` | Personas tab container |
| `story-bundle-editor-personas-search` | Search field in the add-personas section |
| `story-bundle-editor-personas-random` | "Random" button |
| `story-bundle-editor-personas-add-${id}` | Add button of an available persona |
| `story-bundle-editor-personas-load-more` | "Load more" button |
| `story-bundle-editor-personas-empty` | Empty-state text |
| `story-bundle-editor-personas-selected` | Selected-persona section |
| `story-bundle-editor-personas-remove-${id}` | Remove button of the selected persona |
| `story-bundle-editor-personas-selected-empty` | Selected empty-state text |

### `StoryBundleLorebooks`
| testid | Element |
|---|---|
| `story-bundle-editor-lorebooks` | Lorebooks tab container |
| `story-bundle-editor-lorebooks-search` | Search field in the add-lorebooks section |
| `story-bundle-editor-lorebooks-random` | "Random" button |
| `story-bundle-editor-lorebooks-add-${id}` | Add button of an available lorebook |
| `story-bundle-editor-lorebooks-load-more` | "Load more" button |
| `story-bundle-editor-lorebooks-empty` | Empty-state text |
| `story-bundle-editor-lorebooks-selected` | Selected-lorebooks section |
| `story-bundle-editor-lorebooks-remove-${id}` | Remove button of a selected lorebook |
| `story-bundle-editor-lorebooks-selected-empty` | Selected empty-state text |

### `StoryBundlePresets`
| testid | Element |
|---|---|
| `story-bundle-editor-presets` | Presets tab container |
| `story-bundle-editor-presets-search` | Search field in the add-presets section |
| `story-bundle-editor-presets-random` | "Random" button |
| `story-bundle-editor-presets-add-${id}` | Add button of an available preset |
| `story-bundle-editor-presets-load-more` | "Load more" button |
| `story-bundle-editor-presets-empty` | Empty-state text |
| `story-bundle-editor-presets-selected` | Selected-presets section |
| `story-bundle-editor-presets-remove-${id}` | Remove button of a selected preset |
| `story-bundle-editor-presets-selected-empty` | Selected empty-state text |

### `StoryBundleAgents`
| testid | Element |
|---|---|
| `story-bundle-editor-agents` | Agents tab container |
| `story-bundle-editor-agents-loading` | Loading state |
| `story-bundle-editor-agents-search` | Search field in the add-agents section |
| `story-bundle-editor-agents-random` | "Random" button |
| `story-bundle-editor-agents-add-${id}` | Add button of an available agent |
| `story-bundle-editor-agents-load-more` | "Load more" button |
| `story-bundle-editor-agents-empty` | Empty-state text |
| `story-bundle-editor-agents-selected` | Selected-agents section |
| `story-bundle-editor-agents-remove-${id}` | Remove button of a selected agent |
| `story-bundle-editor-agents-selected-empty` | Selected empty-state text |

### `StoryBundleIntros`
| testid | Element |
|---|---|
| `story-bundle-editor-intros` | Intros tab container |
| `story-bundle-editor-intros-add-button` | "Add Intro" button |
| `story-bundle-editor-intros-name-input` | Name input field |
| `story-bundle-editor-intros-text-input` | Text textarea |
| `story-bundle-editor-intros-save-button` | Save button |
| `story-bundle-editor-intros-cancel-button` | Cancel button |
| `story-bundle-editor-intros-edit-button` | Edit button (Pencil) |
| `story-bundle-editor-intros-delete-button` | Delete button (X) |
| `story-bundle-editor-intros-empty` | Empty-state text |

### App Dialogs (`Modal` / `AppDialogRenderer`)
| testid | Element |
|---|---|
| `story-bundle-create-dialog` | Modal panel of the "Create Story Bundle" prompt dialog |
| `story-bundle-delete-dialog` | Modal panel of the delete confirmation dialog |
| `app-dialog-prompt-input` | Text input of the prompt dialog |
| `app-dialog-cancel-button` | Cancel button (prompt and confirm dialogs) |
| `app-dialog-confirm-button` | Confirm button (prompt and confirm dialogs) |
| `${testId}-close-button` | X close button of the modal panel (if `testId` is set) |

> Note: `Modal` accepts an optional `testId` prop; the `AppDialog` state field
> `testId` is passed through to the `Modal` component by `AppDialogRenderer`.

## 6. Validation

```bash
pnpm install        # once
pnpm check          # TypeScript + ESLint + localization + build
pnpm localization:check
```

Current status: `pnpm check` runs fully green
(the only output is the pre-existing Vite chunk-size warning).

### 6.1 Playwright e2e Tests (Story Bundle)

The specification lives in `tests/story-bundle/tests/` and runs via a
dedicated pnpm script:

```bash
pnpm regression:story-bundle   # all story-bundle tests (desktop + mobile)
```

The script invokes `playwright test -c playwright.config.ts tests/story-bundle/tests/`
and starts the web servers (desktop 5178/7971, mobile 5179/7972) automatically
via `config.webServer`. Current status: **214 passed** (107 tests × 2 projects).

**Test files:**
| File | Tests | Content |
|---|---|---|
| `tests/story-bundle/tests/story-bundles-panel.test.ts` | 5 | Panel (open/close, list, empty state) |
| `tests/story-bundle/tests/story-bundles-panel-extra.test.ts` | 2 | Panel extra behavior |
| `tests/story-bundle/tests/story-bundle-editor.test.ts` | 15 | Editor shell (tab navigation, save button, delete) |
| `tests/story-bundle/tests/story-bundle-editor-save.test.ts` | 1 | Save behavior |
| `tests/story-bundle/tests/story-bundle-metadata.test.ts` | 11 | Metadata tab (fields, tags) |
| `tests/story-bundle/tests/story-bundle-metadata-extra.test.ts` | 5 | Metadata extra behavior |
| `tests/story-bundle/tests/story-bundle-import-export.test.ts` | 6 | Import/export |
| `tests/story-bundle/tests/story-bundle-import-embedded.test.ts` | 2 | Import with embedded content |
| `tests/story-bundle/tests/story-bundle-import-agents.test.ts` | 6 | Import with agent references |
| `tests/story-bundle/tests/story-bundle-characters-picker.test.ts` | 7 | Characters tab (search/random/load-more) |
| `tests/story-bundle/tests/story-bundle-personas-picker.test.ts` | 7 | Personas tab |
| `tests/story-bundle/tests/story-bundle-lorebooks-picker.test.ts` | 5 | Lorebooks tab |
| `tests/story-bundle/tests/story-bundle-preset.test.ts` | 3 | Presets tab |
| `tests/story-bundle/tests/story-bundle-presets-picker.test.ts` | 5 | Presets picker |
| `tests/story-bundle/tests/story-bundle-agents-picker.test.ts` | 5 | Agents tab |
| `tests/story-bundle/tests/story-bundle-agent.test.ts` | 2 | Agent assignment |
| `tests/story-bundle/tests/story-bundle-intro.test.ts` | 6 | Intros tab (add/edit/delete) |
| `tests/story-bundle/tests/story-bundle-intro-extra.test.ts` | 3 | Intros extra behavior |
| `tests/story-bundle/tests/story-bundle-play.test.ts` | 11 | Play flow (intro selection, chat start, sidebar image, preset loading) |

**Page objects:**
| File | Purpose |
|---|---|
| `tests/story-bundle/pages/base.page.ts` | Base page object |
| `tests/story-bundle/pages/story-bundles-panel.page.ts` | List panel |
| `tests/story-bundle/pages/create-story-bundle-dialog.page.ts` | Create dialog |
| `tests/story-bundle/pages/delete-story-bundle-dialog.page.ts` | Delete dialog |
| `tests/story-bundle/pages/import-story-bundle-modal.page.ts` | Import modal |
| `tests/story-bundle/pages/story-bundle-editor.page.ts` | Editor shell (tab navigation, play/save/delete buttons) |
| `tests/story-bundle/pages/story-bundle-metadata-tab.page.ts` | Metadata tab (all fields, tags) |
| `tests/story-bundle/pages/story-bundle-description-tab.page.ts` | Description tab (textarea, preview toggle) |
| `tests/story-bundle/pages/story-bundle-characters-tab.page.ts` | Characters tab |
| `tests/story-bundle/pages/story-bundle-personas-tab.page.ts` | Personas tab |
| `tests/story-bundle/pages/story-bundle-lorebooks-tab.page.ts` | Lorebooks tab |
| `tests/story-bundle/pages/story-bundle-presets-tab.page.ts` | Presets tab |
| `tests/story-bundle/pages/story-bundle-agents-tab.page.ts` | Agents tab |
| `tests/story-bundle/pages/story-bundle-intros-tab.page.ts` | Intros tab (add/edit/delete forms) |

Execution notes:

- Playwright runs **headless** by default — no visible browser window opens.
  This is expected behavior (also in the VS Code Playwright extension). For a
  visible window append `--headed`:
  `pnpm exec playwright test -c playwright.config.ts tests/story-bundle/tests/ --headed`
- For watching the flows by eye, use the dedicated manual-validation script,
  which opens a visible Chrome window, runs one test at a time, and adds a
  1.5s slow-motion delay per action:
  `pnpm run manual-validation:story-bundle`
- The Playwright `slowMo` delay is configurable via the `PLAYWRIGHT_SLOW_MO`
  environment variable (default 100ms). The manual-validation script sets it
  to 1500ms; the regular `regression:story-bundle` and `smoke:ui` runs use the
  default.
- The tests intentionally write nothing to stdout; a "The test case did not
  report any output" in the extension is therefore normal. The result is in the
  Test Explorer or the summary (`2 passed`).
- The files are named `*.test.ts` (Playwright extension convention). So they are
  versioned despite the "temporary tests" patterns in `.gitignore`, there are
  exceptions `!tests/**/*.test.ts` and `!tests/**/*.spec.ts`.

### 6.2 Test Fixtures & Helpers

For tests that need a story bundle in a specific state:

- **`tests/story-bundle/helpers/story-bundle-fixture.ts`**: `importStoryBundleFixture(page, filePath)`
  imports a `.marinara.json` fixture file via `POST /api/import/marinara` and
  returns the created `StoryBundle`. `buildStoryBundleEnvelope(input)` builds an
  envelope inline for programmatic tests.
- **`tests/story-bundle/helpers/story-bundle-api.ts`**: `StoryBundleAPI` class
  with `create()`, `delete()`, `importFromEnvelope()`, `export()` — uses
  `page.request` for API calls with cookie/auth state.
- **`tests/story-bundle/helpers/fresh-client.ts`**: `prepareFreshClient(page)`
  seeds the client state (onboarding completed, UI store version) before each
  test.
- **`tests/story-bundle/data/`**: fixture JSONs in various states:
  `empty.json`, `with-description.json`, `with-characters.json`,
  `with-personas.json`, `with-lorebooks.json`, `full.json`,
  `story-bundle-test-data.marinara.json`, plus `test-data.html`.

```ts
// Example: import a bundle with a description
import { importStoryBundleFixture } from './tests/story-bundle/helpers/story-bundle-fixture';
const bundle = await importStoryBundleFixture(page, './tests/story-bundle/data/with-description.json');
// bundle.description === "<h1>Chapter One</h1>..."
```
