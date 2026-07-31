# Roleplay Storyboard Episodes

Status: implementation tracked by Engine issue #4311 and Marinara-Agents issue #144.

## Goal

Add the existing optional Storyboard agent to Roleplay without changing the optimized Game Storyboard prompt path or modifying Illustrator.

Roleplay Storyboards render inline after the assistant narration, like an Illustrator attachment. They may run manually or automatically after a configurable number of completed assistant responses.

## Product contract

| Mode | Source | Automatic cadence | Display |
| --- | --- | --- | --- |
| Game | Existing completed GM narration turn | Existing every-turn behavior | Existing Game viewers |
| Roleplay | Completed user/assistant exchanges since the previous successful Storyboard | Every `runInterval` assistant responses; default 1 | Inline beneath the ending assistant response |

- `runInterval` counts completed assistant responses. User messages between them remain in the source episode.
- Interval 1 storyboards the latest completed exchange. Larger intervals combine the accumulated exchanges into one ordered Roleplay episode.
- The first successful automatic run uses the latest completed exchange. Later runs begin after the previous successful Storyboard anchor.
- A failed run does not advance cadence. Opening an old chat does not trigger automatic backfill.
- Source selection uses active swipes, is bounded to the newest 20 messages and 12,000 source characters, and does not create a fake Game turn or Game state.
- The Storyboard planner performs beat selection directly; there is no separate summarization model call.

## Prompt architecture

Existing Game prompt templates and compiled Game prompts remain unchanged.

Roleplay uses a separate package-owned layered compiler:

1. **Roleplay episode contract** — completed-source rules, numbered-section anchoring, chronology, no invented next reply, and beat-count guidance.
2. **Selected visual style** — editable Normal/Anime, NovelAI, Comic, Colored Manga, and B&W Manga modules derived from the optimized style-specific parts of the existing Game presets.
3. **Animation addon** — included only for animation mode; `imagePrompt` is exact T=0 and `narrationBeat` supplies one simple supported action, camera behavior, environmental motion, source-supported dialogue, sound, ambience, and an ending hold.
4. **JSON output contract** — one shared keyframe schema with section ranges and exact source anchors.

Source/cadence/output instructions are written once in the Roleplay base contract rather than repeated inside every Roleplay style module. LTX-specific `timeline_data` formatting stays in the video-provider layer; Roleplay planning remains provider-neutral.

## Settings

### Global Settings -> Agents -> Storyboard

Keep the existing Storyboard settings and add clearly separated sections:

- Game prompt library and Game default selections, unchanged.
- Roleplay prompt library with editable episode contract, visual-style modules, animation addon, output contract, and Roleplay default selections.
- Existing image and video connections, keyframe count, animation duration, character appearance, avatar references, and provider-facing image/video formatters remain shared unless a chat overrides them.

### Roleplay Chat Settings -> Agents -> Storyboard

Expose the same relevant controls as Game Storyboard settings:

- Manual, Illustrations, or Animations.
- Run every N assistant responses.
- Keyframes per episode.
- Roleplay visual style.
- Provider-facing image and video prompt formatters.
- Animation duration.
- Image, video, and prompt-model connections where the existing settings surface supports chat overrides.
- Character appearance and avatar-reference options.

Roleplay uses inline display in the first release. Existing Game floating/background behavior remains unchanged.

## Engine implementation

1. Exclude `execution: "host"` agents from the generic agent pipeline so Storyboard is invoked only by its host workflow.
2. Add a tested `selectRoleplayStoryboardEpisode` helper that resolves cadence, active swipes, source bounds, the previous successful anchor, and a stable source hash.
3. Add a separate `buildRoleplayStoryboardMessages` compiler. Do not branch or interpolate mode variables inside the existing Game templates.
4. Extract the shared plan/render/store portion of the current Game route behind a prepared Storyboard source contract. Keep Game preparation and prompt compilation unchanged.
5. Add generic Roleplay Storyboard list, preview, and generation endpoints while retaining the existing `/game` endpoints for compatibility.
6. Reuse the existing Storyboard lock, background image/video workers, Gallery storage, scene-video storage, keyframe records, prompt review, provider routing, and recovery behavior.
7. Anchor each Roleplay Storyboard to the ending assistant message and swipe. Existing storage names remain compatibility details; no table rename or migration is required.
8. Add an inline Roleplay viewer and manual Create Storyboard action. Automatic generation arms only after a newly completed response, not initial page load.

## Marinara-Agents implementation

1. Add `roleplay` to Storyboard's mode allowlist while preserving `execution: "host"` and Game defaults.
2. Add the package-owned Roleplay prompt fragments and editable library metadata described above.
3. Keep the existing Game planner templates byte-for-byte unchanged.
4. Keep existing provider-facing image and video formatter templates available to both modes.
5. Version and rebuild the Storyboard package, manifests, artifact, hashes, and every catalog lane together.

## Non-goals for the first release

- Changing, suppressing, migrating, or depending on Illustrator.
- Automatically animating every N Illustrator runs or selecting among Illustrator variants.
- Arbitrary manual message-range selection.
- Roleplay floating/background viewer modes.
- Renaming Game-prefixed routes, tables, or shared types.
- Rewriting existing Game prompt templates into shared Game/Roleplay templates.

## Acceptance criteria

- Storyboard can be installed and activated as an agent in Roleplay.
- Interval 1 creates a Storyboard from the latest completed exchange; larger intervals create one bounded episode from accumulated exchanges.
- Roleplay Storyboards render inline beneath their ending assistant response.
- Manual, still, and animation modes use the configured Roleplay settings and prompt library.
- Animation keyframes keep `imagePrompt` at T=0 and send provider-neutral `narrationBeat` direction through the selected video connection.
- Roleplay context uses assigned chat characters, active Persona, active conversation swipes, optional Character Tracker state, Maps context, and Roleplay illustration settings; it never reads Game setup, party, Game NPC, or CYOA state.
- Existing Game Storyboard prompts, settings, generation, storage, and viewers retain their current behavior.
- Illustrator behavior is unchanged whether Storyboard is installed, absent, enabled, or disabled.
- Duplicate, failed, cancelled, and stale requests do not create duplicate Storyboards or incorrectly advance cadence.

## Validation and delivery

- Add prompt regressions for Game prompt stability and every Roleplay prompt layer/style.
- Add source-window regressions for interval 1, larger intervals, first run, active swipes, retry, failure, bounds, no initial-load backfill, and duplicate requests.
- Re-run Game Storyboard route, prompt-review, storage, recovery, image-only, and animation coverage.
- Run `pnpm check`, `pnpm localization:check`, `pnpm regression:prompt`, `pnpm regression:roleplay`, `pnpm smoke:ui`, and `git diff --check` in Engine.
- Manually verify Roleplay settings and inline rendering on desktop/mobile and light/dark themes.
- Validate still and animation flows with one cloud video service and one local ComfyUI workflow.
- Build and validate every affected Marinara-Agents artifact and catalog lane against the paired Engine branch.
- Merge/release Engine host support before publishing the dependent Storyboard package update.
