# story-bundle.agent.md

> Agent context file for the **Story Bundle** feature. Contains all files and
> conventions needed to understand and extend it — so you don't have to
> re-search the repo every time.
> Branch: `story-bundle-dev` · Feature doc: `story-bundle.md`

## 1. Repo Architecture in 30 Seconds

pnpm monorepo with three packages. Every entity follows exactly this chain:

```
packages/shared   → types + Zod schemas (imported as "@marinara-engine/shared")
packages/server   → Fastify + file-native JSON tables (fileTable) + REST routes
packages/client   → React 19 + TanStack Query + Zustand + Tailwind v4 + i18next
```

New field/feature = always touch all three layers + barrel exports + en.json.

## 2. Feature Files (Story Bundle Itself)

| File | Role |
|---|---|
| `packages/shared/src/types/story-bundle.ts` | Interface `StoryBundle { id, name, description, imagePath, avatarCrop, comment, creator, version, tags, characterIds, personaIds, lorebookIds, presetIds, agentIds, intros, createdAt, updatedAt }` + `StoryBundleIntro { id, name, text }` |
| `packages/shared/src/schemas/story-bundle.schema.ts` | Zod: `storyBundleIdParamsSchema`, `storyBundleIntroSchema`, `createStoryBundleSchema` (name trim min1 max200, all other fields optional), `updateStoryBundleSchema` (all fields optional) |
| `packages/shared/src/index.ts` | Barrel — both export lines must stay |
| `packages/server/src/db/schema/story-bundles.ts` | `fileTable("story_bundles", …)` |
| `packages/server/src/db/file-backed-store.ts` | `"story_bundles"` in `FILE_BACKED_TABLES` (registration, else `Unsupported table`) |
| `packages/server/src/services/storage/story-bundles.storage.ts` | `createStoryBundlesStorage(db)`: list/getById/create/update/remove |
| `packages/server/src/routes/story-bundles.routes.ts` | REST under `/api/story-bundles` (GET/POST/PATCH/DELETE) + image endpoints (`POST/DELETE /:id/image`, `GET /images/file/:filename`) + `GET /:id/export` |
| `packages/client/src/hooks/use-story-bundles.ts` | `storyBundleKeys` + query/mutation hooks (incl. image upload/remove) |
| `packages/client/src/components/panels/StoryBundlesPanel.tsx` | List panel (right side, with per-row Play button) |
| `packages/client/src/components/story-bundles/StoryBundleEditor.tsx` | Full-page editor (detail view) — shell with tab rail; Play uses the current draft state |
| `packages/client/src/components/story-bundles/StoryBundleMetadata.tsx` | Metadata tab (avatar/image upload, bundle ID, name, comment, creator, version, tags) |
| `packages/client/src/components/story-bundles/StoryBundleDescription.tsx` | Description tab (HTML description with preview toggle) |
| `packages/client/src/components/story-bundles/StoryBundleCharacters.tsx` | Characters tab (search/random/load-more, groups dropdown, selected list) |
| `packages/client/src/components/story-bundles/StoryBundlePersonas.tsx` | Personas tab (single-select persona picker with avatar-crop support) |
| `packages/client/src/components/story-bundles/StoryBundleLorebooks.tsx` | Lorebooks tab (search/random/load-more, selected list; no groups) |
| `packages/client/src/components/story-bundles/StoryBundlePresets.tsx` | Presets tab (search/random/load-more, selected list; no groups) |
| `packages/client/src/components/story-bundles/StoryBundleAgents.tsx` | Agents tab (search/random/load-more, selected list; no groups) |
| `packages/client/src/components/story-bundles/StoryBundleIntros.tsx` | Intros tab (inline intros: name + text, add/edit/delete) |
| `packages/shared/src/types/export.ts` | `ExportType` extended with `"marinara_story_bundle"` |
| `packages/server/src/services/import/marinara.importer.ts` | `importStoryBundle()` — import handler + `case` in the switch |
| `packages/server/src/services/export/export-image-helpers.ts` | Shared image helpers: `readAvatarDataUrl()`, `readSpritesForId()`, `readGalleryForCharacter()` |
| `tests/story-bundle/helpers/story-bundle-fixture.ts` | Test helper: `importStoryBundleFixture()`, `buildStoryBundleEnvelope()` |
| `tests/story-bundle/helpers/story-bundle-api.ts` | Test helper: `StoryBundleAPI` class (create/delete/import/export) |
| `tests/story-bundle/helpers/fresh-client.ts` | Test helper: `prepareFreshClient()` (client state before each test) |
| `tests/story-bundle/data/*.json` | Fixture files (empty, with-description, with-characters, with-personas, with-lorebooks, full) |
| `tests/story-bundle/data/test-data.html` | HTML test data for the description preview |
| `tests/story-bundle/tests/*.test.ts` | Playwright e2e tests (panel, editor, metadata, description, pickers, intros, play, import/export) |
| `tests/story-bundle/pages/*.page.ts` | Page objects for panel, dialogs, editor shell, and each tab |

## 3. Touched Infrastructure Files (Wiring)

| File | What lives there for the feature |
|---|---|
| `packages/server/src/db/schema/index.ts` | `export * from "./story-bundles.js";` |
| `packages/server/src/db/file-backed-store.ts` | `"story_bundles"` in `FILE_BACKED_TABLES` |
| `packages/server/src/routes/index.ts` | `app.register(storyBundlesRoutes, { prefix: "/api/story-bundles" })` |
| `packages/client/src/stores/ui.store.ts` | Panel type `"story-bundles"`, `storyBundleDetailId`, `openStoryBundleDetail`/`closeStoryBundleDetail`, mutual exclusion in all `open*Detail` actions (`storyBundleDetailId: null`), `hasAnyDetailOpen`, `closeAllDetails` |
| `packages/client/src/components/layout/AppShell.tsx` | Lazy import `StoryBundleEditor` + `detailView` chain (`storyBundleDetailId ? <StoryBundleEditor />`) |
| `packages/client/src/components/layout/RightPanel.tsx` | Lazy import `StoryBundlesPanel` + `PANEL_CONFIG["story-bundles"]` + `PANELS["story-bundles"]` |
| `packages/client/src/components/layout/TopBar.tsx` | `RightPanelButtonPanel` union, `RIGHT_PANEL_BUTTONS` entry, `panelContextActive["story-bundles"]`, `!storyBundleDetailId` in `isHomeActive` |
| `packages/client/src/styles/globals.css` | `.mari-panel-gradient--story-bundles` (pink `#f472b6` → violet `#a855f7`) + `.mari-description-preview` (HTML preview styling) |
| `packages/client/src/localization/locales/en.json` | `navigation.topbar.storyBundles` + `storyBundles.*` block + `storyBundles.metadata.*` sub-block (see `story-bundle.md` § 4 Localization for the full key list) |

## 4. Reference Files: How Other Entities Do It

For extensions, read these neighbors as templates:

- **Schema:** `packages/server/src/db/schema/lorebooks.ts`, `regex-scripts.ts`
- **Storage:** `packages/server/src/services/storage/regex-scripts.storage.ts`, `library-folders.storage.ts`
- **Routes:** `packages/server/src/routes/regex-scripts.routes.ts`, `library-folders.routes.ts`
- **Hooks:** `packages/client/src/hooks/use-regex-scripts.ts`, `use-lorebooks.ts`
- **Panel:** `packages/client/src/components/panels/LorebooksPanel.tsx`, `PersonasPanel.tsx`
- **Editor:** `packages/client/src/components/personas/PersonaEditor.tsx`, `presets/PresetEditor.tsx`, `lorebooks/LorebookEditor.tsx`

## 5. Important Infrastructure (Always Reuse, Never Rebuild)

| File | Purpose |
|---|---|
| `packages/server/src/lib/logger.ts` | Pino `logger` — mandatory in server code, `console.*` forbidden |
| `packages/server/src/utils/id-generator.ts` | `newId()` (nanoid), `now()` (ISO) |
| `packages/server/src/db/connection.ts` | `DB` type (`export type DB = FileNativeDB`) |
| `packages/server/src/db/file-schema.ts` | `fileTable`, `text`, column definitions |
| `packages/server/src/db/file-query.ts` | Query builder: `db.select().from(t).where(eq(col, v)).orderBy(col)` |
| `packages/client/src/lib/app-dialogs.ts` | `showConfirmDialog({ title, message, confirmLabel, cancelLabel, tone })` — **options object, no positional args**; tone: `"default" \| "destructive" \| "accent"` |
| `packages/client/src/localization/use-localized-ui-text.ts` | `useLocalizedUiText()` maps English text → en.json key (`findEnglishMessageKey`) |
| `packages/client/src/lib/utils.ts` | `cn()` (class merge) |
| `packages/client/.instructions.md` | **Required reading before any client change** |

## 6. Conventions & Pitfalls

- **Logging (server):** `logger.error(err, "Msg")` (error first), format specifiers: `logger.info("Resolved %d agents", n)`. New prompt/generation routes need debug logging (`logDebugOverride` or similar).
- **i18n:** New UI text → semantic keys in `en.json` (sort alphabetically). Maintain English only; other locales stay partial (fallback). Before shipping: `pnpm localization:check`.
- **TopBar labels** go through `useLocalizedUiText()` — the English label text therefore needs an en.json key (here: `navigation.topbar.storyBundles`).
- **Detail surfaces are mutually exclusive:** every new `open*Detail` action must set all other detail IDs to `null` in `ui.store.ts` (and vice versa) + be added to `hasAnyDetailOpen`, `closeAllDetails`, `requestChatModeShortcut`.
- **Register new tables:** every new `fileTable` must be added to `FILE_BACKED_TABLES` (`packages/server/src/db/file-backed-store.ts`), otherwise the file store throws `Unsupported table: <name>` on every insert/select (exactly what happened on the first story-bundle create — the error only surfaced on the actual API call, not at server start).
- **Cascade rules:** when a table references another via FK, a cascade rule must be added to `CASCADES` (`file-backed-store.ts`) so deleting the parent also deletes child rows.
- **Styling:** only CSS variables (`var(--border)`, `var(--card)`, `var(--destructive)` …) + `mari-panel-gradient-surface mari-panel-gradient--<name>`; no hard-coded hex colors outside `globals.css`.
- **data-testid:** every new component/interactive element gets one; catalog in `story-bundle.md` § 5.
- **Test files:** Playwright e2e tests live in `tests/story-bundle/tests/` and are versioned via a `.gitignore` exception (`!tests/**/*.test.ts`). Page objects in `tests/story-bundle/pages/`. New tests follow the existing pattern (page object + data-testid + `prepareFreshClient`).
- **Editor draft state:** the editor keeps a local draft (`presetIds`, `characterIds`, …) synced from the loaded bundle via `useLayoutEffect`. Play reads the draft, not the server state — keep it that way so unsaved changes are honored when playing.
- **Branches:** changes against `staging`, not `main` (currently working on `story-bundle-dev`).
- **Never check PR checkboxes**; list manual verification explicitly.

## 7. Commands

```bash
pnpm install              # once / after lockfile changes
pnpm check                # baseline validation: TS + ESLint + localization + build
pnpm localization:check   # localization only
pnpm version:check        # only for version/release metadata
pnpm regression:story-bundle  # all story-bundle Playwright tests (desktop + mobile)
pnpm run manual-validation:story-bundle  # visible Chrome, one test at a time, 1.5s slow-mo per action
```

PowerShell: chain commands with `;`, never with `&&`.

## 8. Extension Checklist (Next Iteration, e.g. New Fields)

1. `packages/shared`: extend interface + Zod schema (keep the update schema optional).
2. `packages/server`: add columns to the `fileTable`, adjust storage methods (register new tables in `FILE_BACKED_TABLES` too).
3. `packages/client`: create a new tab component (pattern: `StoryBundleCharacters.tsx` / `StoryBundlePresets.tsx`), import it in `StoryBundleEditor.tsx` and add it to the TABS array + rendering, add hooks for data loading.
4. Add `en.json` keys (sort alphabetically).
5. `pnpm check` green, assign new `data-testid`s, update `story-bundle.md` + this file.
6. Commit on the feature branch.

## 9. Tab Component Pattern

Every new tab in the StoryBundleEditor follows this pattern (see `StoryBundleCharacters.tsx` / `StoryBundlePresets.tsx`):

- **Props interface**: `ids: string[]`, `onIdsChange: (ids: string[]) => void`, `items: T[]`, `folders: Folder[]`, `validIds: Set<string>`
- **Three sections**: (1) Add Items — search field + random button + paginated list with plus buttons, (2) Groups — dropdown + add button, (3) Selected Items — list with remove buttons
- **Empty states**: dashed border box with i18n text
- **Pagination**: `ITEM_PICKER_PAGE_SIZE = 20`, local `useState` limit, "Load more" button
- **data-testid**: `story-bundle-editor-<tabname>`, `story-bundle-editor-<tabname>-search`, `story-bundle-editor-<tabname>-random`, `story-bundle-editor-<tabname>-load-more`, `story-bundle-editor-<tabname>-empty`, `story-bundle-editor-<tabname>-group-select`, `story-bundle-editor-<tabname>-add-group`
- **Lorebooks/Presets/Agents tabs**: no Groups section (those entities have no folder groups). Only two sections: Add + Selected.
- **Personas tab**: single-select — picking a persona replaces the previous one.

## 10. Import/Export Pattern

Story Bundles follow the established Marinara export/import pattern:

- **Export**: `GET /api/story-bundles/:id/export` → `ExportEnvelope` with `type: "marinara_story_bundle"`, `version: 1`, `data: { name, description, characterIds, personaIds, lorebookIds, presetIds, agentIds, intros, embeddedCharacters, embeddedPersonas, embeddedLorebooks, embeddedPresets }`. Characters and personas are embedded with avatars, sprites, and gallery as base64 data URLs — the JSON is fully self-contained for PC-to-PC transfer. Served as a `.marinara.json` download.
- **Import**: `POST /api/import/marinara` with the envelope → dispatcher in `importMarinara()` routes to `importStoryBundle()`. Validates `name` (required), filters ID arrays to strings, creates the bundle via `createStoryBundlesStorage`. Import deduplicates by name (case-insensitive): existing characters/personas/lorebooks/presets are skipped, only new ones are created. Binary data (avatars, sprites, gallery) is restored from the base64 data URLs. Referenced agents that are not installed are surfaced in the import dialog with an install option for the providing capability package.
- **Image helpers**: `packages/server/src/services/export/export-image-helpers.ts` — `readAvatarDataUrl()`, `readSpritesForId()`, `readGalleryForCharacter()` read binary data from disk and return base64 data URLs. Shared by character export and story-bundle export.
- **Test helpers**: `importStoryBundleFixture(page, filePath)` in `tests/story-bundle/helpers/story-bundle-fixture.ts` reads a fixture JSON, POSTs it to `/api/import/marinara`, and returns the created `StoryBundle`. `buildStoryBundleEnvelope(input)` builds an envelope inline (for programmatic tests). `StoryBundleAPI` in `tests/story-bundle/helpers/story-bundle-api.ts` offers create/delete/import/export.
- **Fixtures**: `tests/story-bundle/data/` contains JSON files in various states (empty, with-description, with-characters, with-personas, with-lorebooks, full).
