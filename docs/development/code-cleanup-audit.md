# Code cleanup audit

**Audit date:** 2026-07-22

**Target branch:** `staging`

**Purpose:** identify removable artifacts and bounded simplifications without changing runtime behavior.

**Implementation status:** high-confidence and low-risk findings implemented in the same cleanup change.

## Implementation outcome

Completed:

- removed the four unreachable source modules, obsolete sidecar builder, zero-test runner, and completed task briefs;
- removed the debug-log buffer that existed only for the unreachable debug panel while preserving browser-console diagnostics;
- resolved all 60 compiler-proven unused-code findings and enabled unused checks in the client and server;
- removed 53 unconsumed client hooks, helpers, types, and UI declarations in domain-sized batches;
- removed the eight high-confidence orphaned dependencies and repaired the lockfile, workspace-install check, and troubleshooting text;
- made root `pnpm test` run real regression coverage instead of reporting success with zero tests;
- reused the existing storyboard-keyframe selector and consolidated duplicated Spotify query-token logic;
- constrained preset-variable reordering to the requested preset, using the formerly ignored `presetId` as an integrity boundary.

Intentionally retained for separate compatibility or product work:

- `@rollup/wasm-node`;
- server exports that could be out-of-tree APIs or test seams;
- PNG parser and tutorial geometry consolidation;
- the broad editor/composer and large-module refactors;
- compatibility fields scheduled for a future major release.

The detailed findings below are retained as the pre-change evidence record. Where recommendation wording remains, this implementation outcome is authoritative.

## Validation

The implemented cleanup passed the repository's supported proof lanes:

- `pnpm install --frozen-lockfile`
- `pnpm check` (unused-code enforcement, TypeScript, ESLint, and production builds)
- `pnpm test` (all regression lanes plus browser smoke coverage: 81 passed, 51 intentionally skipped)

The browser suite also exposed four state-dependent locator assumptions while making the generic test command honest. Those tests now navigate explicitly, scope duplicate mobile controls, and target the actual Noodle timeline scroller without weakening their product assertions.

## Executive summary

The repository is large (1,665 tracked files and roughly 478,000 lines across the source-oriented file types inspected), but most large files are active product code rather than obvious debris. The safest cleanup is a collection of small, evidence-backed removals—not a broad rewrite.

The original audit's first cleanup lane identified:

- four source modules with no inbound references (899 lines total);
- one obsolete sidecar build script (173 lines);
- one test runner that succeeds while executing zero tests (54 lines, plus its package-script wiring);
- two completed phase-task briefs left at the repository root (235 lines);
- 60 compiler-proven unused declarations, imports, parameters, and locals;
- eight likely orphaned direct dependencies, subject to a fresh-install/build check;
- one likely unused static Mari sprite, after a browser smoke check.

The four unreachable modules, stale script, no-op runner, and task briefs alone account for 1,361 tracked lines. The proposed work should still be split into small cleanup PRs so each deletion has narrow proof and an easy rollback.

## How the audit was performed

The audit combined several kinds of evidence:

1. Inventory of all tracked files, file types, major source areas, and largest files.
2. TypeScript AST import/export analysis, including relative imports and repository aliases.
3. Exact-symbol and filename searches across tracked source, scripts, documentation, manifests, and workflows.
4. TypeScript compiler probes with `noUnusedLocals` and `noUnusedParameters` forced on for the client and server.
5. Direct-dependency searches plus targeted Git-history inspection where a dependency or script appeared stranded by a prior refactor.
6. Normalized duplicate-window comparison, followed by manual inspection of the most substantial matches.
7. Syntax checks for tracked JSON, Python, and Bash files.

Confidence labels used below:

- **High:** multiple independent checks agree; removal should be mechanical.
- **Medium:** currently unreferenced, but dynamic loading, external consumers, or product intent could still matter.
- **Defer:** a legitimate simplification opportunity whose regression surface is too broad for an artifact-removal pass.

Static analysis cannot prove the absence of runtime string lookup, downloaded package use, user-supplied paths, or external consumers. Those cases are called out rather than treated as dead code.

## 1. High-confidence file removals

### 1.1 Unreachable source modules

| Candidate | Evidence | Cleanup note | Required proof |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 lines) | No inbound import and `AgentDebugPanel` occurs only at its declaration. | Remove the component. Then review the agent store's `debugLog` and `clearDebugLog`; they are otherwise consumed only by this unreachable panel. Do not remove `lastResults`, which is used by `SpriteOverlay`. | `pnpm check`; open agent settings/debug mode and verify the active debug surfaces. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 lines) | No inbound import and `AgentThoughtBubbles` occurs only at its declaration. Current thought-bubble/checklist UI is rendered through `RoleplayHUD` / `RoleplayHUDActionsMenu`. | Remove the component and its stale entry in `packages/client/.instructions.md`. | `pnpm check`; `pnpm regression:roleplay`; browser-check the roleplay HUD and continuity checklist. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 lines) | No inbound import, route registration, or exact-name reference. | Remove this panel only. Do **not** infer that the entire gallery capability is dead: `NoodleHome`, gallery hooks, server routes, and storage still have active references. | `pnpm check`; `pnpm smoke:ui`; manually verify Noodle image upload/gallery behavior. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 lines) | No imports, no barrel export, and all four exported symbols occur only in this file. | Delete the file. | `pnpm check`; `pnpm regression`. |

### 1.2 Obsolete sidecar build script

`scripts/build-sidecar-runtime.mjs` has no package-script, workflow, documentation, or source reference. It invokes `pnpm exec node-llama-cpp`, but `node-llama-cpp` is no longer a workspace dependency. Its Git history ties it to the former local-Gemma sidecar build path.

**Recommendation (high confidence):** delete the script. Before doing so, make one final release-artifact search outside the repository if any installer pipeline is configured externally.

### 1.3 Completed implementation briefs at the root

`MARI_PHASE2_TASK.md` and `MARI_PHASE3_TASK.md` are branch-oriented implementation instructions for work now present in the codebase. Nothing in the repository references them, and they are not durable user or contributor documentation.

**Recommendation (high confidence):** remove them from the working tree. Their history remains available in Git. If any rationale is still valuable, retain only that rationale in the relevant architecture document rather than preserving task instructions.

### 1.4 Misleading zero-test runner

`packages/server/scripts/run-tests.mjs` targets three `.test.ts` globs, but none of the target directories contains a test file. Running both `pnpm --filter @marinara-engine/server test` and root `pnpm test` exits successfully with zero tests and zero suites. The former tests were intentionally removed, and repository rules prohibit retaining `.test.ts` files.

This is more dangerous than ordinary dead code because a green `pnpm test` currently implies coverage that does not exist.

**Recommendation (high confidence):**

1. Remove the server runner and the server `test` script.
2. Keep the Windows installer layout check, but give it an honest dedicated script name if needed.
3. Redefine root `test` to run an intentional regression/smoke subset, or remove the generic alias and document `pnpm check`, `pnpm regression:*`, and `pnpm smoke:ui` as the actual proof commands.
4. Ensure CI cannot report “tests passed” solely from a zero-test invocation.

## 2. Dependency cleanup

These direct dependencies have no current import, registration, configuration, or runtime string reference outside manifests/lockfile unless noted.

| Workspace | Dependency | Confidence and evidence |
| --- | --- | --- |
| client | `class-variance-authority` | **High.** No source/config use. Earlier dependency cleanup history also treated it as unused. |
| client | `autoprefixer` | **High with build proof.** No PostCSS configuration or import; the client uses the Tailwind Vite plugin. |
| server | `@earendil-works/pi-ai` | **High.** The Professor Mari runtime was refactored away from the Pi dependency. Repository history explicitly records it as already unimported and left for a follow-up cleanup. |
| server | `@fastify/websocket` | **High.** No plugin registration, websocket route, or import. |
| server | `png-chunk-text` | **High.** No import. Current PNG metadata handling is implemented directly. |
| server | `png-chunks-encode` | **High.** No import. |
| server | `png-chunks-extract` | **High.** No import. |
| shared | `chess.js` | **High with compatibility proof.** No current source import. Built-in chess functionality was extracted into optional packages. Removing it also requires deleting its entry in `scripts/check-workspace-install.mjs` and updating the stale missing-`chess.js` troubleshooting text. |

`@rollup/wasm-node` in the client is also unreferenced, but it may be an environment-specific Rollup fallback. Treat it as **medium confidence**: inspect packaging/CI history and prove builds on supported platforms before removing it.

Do not classify dependencies such as `workbox-window`, `pino-pretty`, root `esbuild`, type packages, or CLI-only tools as unused based on import text alone. They are consumed by generated modules, string-based transport configuration, build scripts, or package scripts.

For the dependency PR, update `pnpm-lock.yaml`, install from a clean dependency state, and run the full build/check lane. Removing a package from an already-populated `node_modules` tree is not sufficient proof.

## 3. Compiler-proven unused code

Forcing TypeScript unused checks produced **57 server diagnostics** and **3 client diagnostics**. These are stronger evidence than text-search-only candidates. Most are imports or locals and can be removed mechanically; callback parameters and public method parameters need their call signatures checked first.

### 3.1 Client

- `ChatSettingsDrawer.tsx`: unused `subject` filter parameter.
- `GameCombatUI.tsx`: unused `line` map parameter.
- `hooks/use-encounter.ts`: unused `_res`; await the request without assigning it.

### 3.2 Server

- `db/file-backed-store.ts`: unused `TABLES_REVERSE`; unused `loadedManifest` instance field/assignment.
- Route imports/locals: `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`), and `generate/dry-run-route.ts` (`lorebooksStore`).
- Unused route callback parameters: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts`, and `youtube.routes.ts` (`reply`). Rename to `_reply` only if Fastify signature position must be preserved.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext`, and `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval`, and local `chatParams`.
- `generate/dry-run-route.ts`: dead local helper `wrapperMessages`.
- `services/agents/agent-executor.ts`: unused `agentType` parameter in `sanitizeTextAgentResponse`; update its internal callers if the parameter is removed.
- `services/agents/agent-pipeline.ts`: unused `AgentPhase`.
- `services/conversation/schedule.service.ts`: unused `createLLMProvider` and `ConversationStatusOverride`.
- `services/game/perception.service.ts`: unused `RPGAttributes`.
- `services/generation/conversation-react-command-runtime.ts`: unused `command` helper parameter.
- `services/import/st-bulk.importer.ts`: unused `personasTable`.
- `services/lorebook/keyword-scanner.ts`: unused destructured `currentMessageIndex`; check the internal options shape before removing it.
- `services/lorebook/prompt-injector.ts`: unused `LorebookEntry`.
- `services/mari-db/mari-db.service.ts`: dead `makeEmptyValidation` helper.
- `services/prompt/assembler.ts`: unused `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder`, and `chatHistoryEndIdx`.
- `services/sidecar/scene-analyzer.ts`: dead `widgetUpdateHint` and `widgetStateSummary` helpers.
- `services/sidecar/scene-postprocess.ts`: dead `normalizeExpression` helper.
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt` is assigned but never read.
- `services/storage/noodle.storage.ts`: unused `NoodlerStageProfile`.
- `services/storage/prompts.storage.ts`: unused `presetId` parameter in `reorderVariables`; verify callers and storage ordering semantics before changing the signature.

After this list is clean, enable `noUnusedLocals` and `noUnusedParameters` in the server and client TypeScript configurations. That converts this audit from a one-time sweep into a maintained invariant. Prefixing intentionally required callback parameters with `_` is preferable to globally disabling the rule again.

## 4. Internal exports with no repository consumer

Exported declarations are exempt from ordinary unused-local checks, so a second pass searched for names that occur only at their declaration. The client is an application rather than a public library, making these useful removal candidates. Delete them in domain-sized batches and allow the compiler to expose any associated private helpers or imports.

### 4.1 Client hooks and helpers

- Agent hooks: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Character hooks: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Chat/folder hooks: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Game hooks: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Haptic hooks: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Lorebook hooks: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Other hooks: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- UI declarations: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS`, and `SyncedSettings`.
- Library helpers: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip`, and `buildTTSMessageText`.

An unused client hook does **not** prove its server endpoint is unused. Remove the hook first; audit routes separately against UI, capability packages, and external API compatibility.

### 4.2 Server candidates requiring a final API/test-seam decision

The following exported server declarations also have no in-repository consumer. Most appear internal, but exported test seams and helpers can be used by out-of-tree tooling, so confidence is medium until maintainers confirm they are not supported APIs:

- runtime/basic auth: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`;
- test seams: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`;
- generation/prompt helpers: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`;
- game helpers: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`;
- lorebook helpers: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`;
- utilities/types: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

Do not apply this “one textual occurrence” test wholesale to `packages/shared`: shared exports are compatibility contracts for the client, server, and downloadable agent packages, including consumers outside this repository.

## 5. Static asset candidate

`packages/client/public/sprites/mari/Mari_point_down_left.png`, the one bundled Mari sprite whose basename/path had no repository reference, was removed by omnibar slice 38a.

Do not use basename searches to prune bundled game assets. Server seeders and manifests scan some asset directories dynamically.

## 6. Bounded simplifications

These are maintainability improvements, not dead-code deletions. Each should preserve behavior exactly and carry focused regression proof.

### 6.1 Exact or near-exact duplicated business logic

1. **Storyboard keyframe selection — low risk.** `GameSurface.tsx` has a local `findStoryboardKeyframeForSegment` implementation matching exported `findReplayStoryboardKeyframe` in `lib/game-session-replay.ts`. Reuse the library helper and remove the local copy.
2. **Spotify search normalization — low/medium risk.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS`, and the expansion flow are duplicated between `game-spotify-music.service.ts` and `tool-executor.ts`. Extract a small Spotify query-token helper so the two paths cannot drift.
3. **PNG character-card metadata extraction — medium risk.** `extractCharaFromPng` is independently implemented in `import.routes.ts` and `st-bulk.importer.ts`. Extract one server utility and prove normal text chunks, international text chunks, base64/raw payloads, V2/V3 cards, and malformed PNGs with regression fixtures.
4. **Tutorial tooltip geometry — medium risk.** `GameTutorial.tsx` and `OnboardingTutorial.tsx` duplicate collision/placement logic. Extract only the shared geometry calculation; retain each tutorial's mobile and product-specific policies as explicit options.
5. **Client/server game-segment edit normalization — medium/high risk.** The pure normalization in the client and server is similar. Only move a genuinely runtime-neutral schema/normalizer to shared; leave server parsing and persistence concerns on the server.

### 6.2 Large repeated UI areas: defer broad consolidation

- `CharacterEditor.tsx` and `PersonaEditor.tsx` contain a substantial repeated sprite-management workflow.
- `ChatInput.tsx` and `ConversationInput.tsx` repeat guided-plan and composer behavior.

There is real consolidation value, but merging either pair wholesale would create a large regression surface. Extract one coherent hook/component at a time—sprite management first for the editors, guided-plan behavior first for the composers—and browser-test both callers after every extraction.

### 6.3 Active complexity hotspots

The largest active modules are `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/components/chat/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts`, and `client/components/panels/SettingsPanel.tsx`. They are not deletion candidates. Continue extracting bounded route handlers, domain services, drawer sections, and pure helpers only when the affected feature is already being changed. A standalone “split everything” PR would add churn without reliable behavioral proof.

## 7. Items deliberately excluded from cleanup

- Compatibility fields explicitly marked as accepted through the 2.x line, including image-style, game-state, TTS, persona-tracker, and conversation-context compatibility shapes. Remove these only through a versioned migration in the next major release.
- Generated capability registries and manifests. Regenerate them through their scripts; do not hand-prune them.
- Downloadable Illustrator, Music DJ, Lorebook Keeper, and other agent package code. Agent-owned runtime/prompt cleanup belongs in `Pasta-Devs/Marinara-Agents`; only host integration belongs here.
- Home Assistant modules under `custom_components`, whose discovery is convention- and manifest-driven.
- `MarinaraLauncher.exe`, which is consumed by taskbar-shortcut migration code.
- `start-local.bat`, which is not referenced by package scripts but remains a plausible human-facing local launcher. Remove only after a maintainer intent check.
- Schema declarations that appear unreferenced but execute as part of module initialization or table registration.
- Server routes merely because a convenience React hook is unused; downloadable packages or API consumers may still call them.

## 8. Recommended cleanup sequence

Keep the work simple and reviewable:

1. **PR A — artifacts:** remove the four unreachable modules, stale component documentation entry, obsolete sidecar script, completed task briefs, and—after manual confirmation—the unused Mari sprite.
2. **PR B — honest test surface:** remove the zero-test runner and rename/redefine package scripts so successful commands represent real checks.
3. **PR C — compiler cleanup:** resolve the 60 TypeScript diagnostics, then enable unused checks in client/server configs.
4. **PR D — dependencies:** remove the eight high-confidence packages, repair the workspace-install check and troubleshooting text, regenerate the lockfile, and prove a clean install/build.
5. **PR E onward — domain batches:** remove unused client exports by domain, then take the low-risk duplicate helpers one at a time.

Avoid combining dependency removal, broad UI refactoring, and route decomposition into one cleanup PR.

## 9. Validation matrix

Run the proof appropriate to each change:

- Every code cleanup: `pnpm check`.
- Shared or broad server changes: `pnpm regression` or the narrow `pnpm regression:<domain>` command first, followed by the full lane before merge.
- UI component/hook cleanup: `pnpm smoke:ui` plus manual browser verification of the affected flow.
- Prompt, agent, or roleplay paths: `pnpm regression:prompt` and/or `pnpm regression:roleplay`.
- Dependency cleanup: clean/frozen install, `pnpm check`, production builds, and supported-platform CI.
- PNG import consolidation: direct import regressions covering valid and malformed character cards.
- Release/version files, if unexpectedly touched: `pnpm version:check` and `pnpm credits:check`.

Before this cleanup, the generic `pnpm test` result could not be cited as test evidence because it completed successfully without running tests.

## 10. Audit validation and limitations

During this audit:

- all tracked JSON files parsed successfully;
- all 12 tracked Python files parsed successfully with Python's AST parser;
- `start.sh`, `start-termux.sh`, and `android/build-apk.sh` passed `bash -n`;
- TypeScript unused probes produced the 57 server and 3 client findings documented above;
- the server and root test commands were directly observed succeeding with zero tests.

ShellCheck and PowerShell were not installed, so shell semantic linting and parsing of PowerShell/Windows scripts were not performed. Android and Home Assistant targets were inspected structurally but were not fully built in this audit. Those platform checks belong in the cleanup PRs that touch their files.
