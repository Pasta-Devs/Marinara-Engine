# Storyboard Agent Extraction

Status: draft for maintainer scope approval. This plan reflects the confirmed Illustrator-style agent model. Do not begin implementation until the cross-repository base and issue ownership are resolved.

## Outcome

Ship Storyboard as an optional, Game-only downloadable agent from `Pasta-Devs/Marinara-Agents`, using the same lightweight package shape as Illustrator: `manifest.json` plus `agents.json`, without a Maps-style package client or server runtime.

Installing and adding the Storyboard agent to a Game chat restores the existing still and animation workflows. All Storyboard settings and prompt selections live on the global Storyboard agent configuration or the chat's Storyboard agent assignment, not in the general Game settings surface or global image/video generation prompt overrides.

## Problem and proof

- `packages/client/src/components/chat/ChatSettingsDrawer.tsx` is 542,885 bytes. Conservatively measured direct Storyboard blocks account for 30,811 bytes, or 5.7 percent.
- `packages/client/src/components/game/GameSurface.tsx` is 512,757 bytes. Conservatively measured direct Storyboard blocks account for 41,889 bytes, or 8.2 percent.
- Client lint emits Babel's over-500-KB deoptimization warning for both files.
- The discarded preset-restoration branch adds 812 lines, removes 38 lines, and increases `ChatSettingsDrawer.tsx` by 37,614 bytes. Its behavior is required, but its component implementation must not be merged back into the oversized drawer.
- Removing Storyboard clears the warning from `GameSurface.tsx`. `ChatSettingsDrawer.tsx` will still require one additional focused component extraction to fall safely below 500 KB.

## Product model

Storyboard behaves like Illustrator, not like Hierarchical Maps:

- It is a normal optional agent with `phase: "post_processing"`, `enabledByDefault: false`, and `modeAllowlist: ["game"]`.
- Its package contains the agent definition, built-in prompts, defaults, metadata, and catalog artifact.
- Engine supplies the generic Agent editor, per-chat agent assignment UI, execution host, provider routing, storage, and result handling.
- Storyboard-specific Engine UI is split into focused components and shown from the Storyboard agent's settings rather than embedded in the general Game settings drawer.
- The package does not ship `client.js`, `server.mjs`, custom elements, capability mount slots, or Maps-style feature routes.

## Prompt chains to preserve

One Storyboard selection must never be flattened into one global generation prompt. Storyboard has two related chains with independent prompt choices.

### Illustration path

1. Completed Game Mode GM turn.
2. Illustration planner prompt, selected from multiple built-in or custom planner presets.
3. Provider-facing illustration image prompt, selected from multiple built-in or custom image presets.
4. Generated keyframe illustrations.

### Animation path

1. Completed Game Mode GM turn.
2. Animation planner prompt, selected from multiple built-in or custom planner presets.
3. Provider-facing keyframe or first-frame image prompt, selected from the shared illustration image-prompt library.
4. Provider-facing animation/video prompt, selected from multiple built-in or custom video presets.
5. Generated videos built from the illustration/keyframe chain.

The animation path extends the illustration path. It does not replace or bypass it.

## Prompt libraries and selections

Preserve the previous global preset model on the Storyboard agent configuration:

- `plannerTemplates`: the combined still-planner and animation-planner library, retaining template kind.
- `illustrationTemplates`: provider-facing keyframe and first-frame image templates.
- `videoTemplates`: provider-facing animation/video templates.
- `illustrationPlannerTemplateId`: selected still planner.
- `animationPlannerTemplateId`: selected animation planner.
- `illustrationTemplateId`: selected provider-facing image prompt.
- `videoTemplateId`: selected provider-facing video prompt.

Built-ins remain individually available, including the existing still, NovelAI, comic, colored manga, black-and-white manga, anime episode, LTX Director, LTX Simple, storyboard image, first-frame image, cinematic video, anime video, comic video, and LTX video variants.

The editor must retain Illustrator-style behavior:

- Built-in entries are readable and resettable.
- A built-in can be copied before editing.
- Custom entries can be added, named, described, edited, selected, and removed.
- Changing one stage does not overwrite the other stages or the global provider prompt override.
- Provider-aware recommendations may be shown, but an existing valid selection must not be silently replaced when a connection changes.

## Agent settings ownership

### Global Storyboard agent configuration

- Prompt libraries and custom prompt bodies.
- Default selection for each of the four prompt stages.
- Default text, image, and video connection overrides where supported by the generic agent contract.
- Default run interval and behavior defaults.

### Per-chat Storyboard agent assignment

- Enabled/disabled state.
- Automatic generation mode: off, still illustrations, or animations.
- Keyframe count and clip duration.
- Viewer mode and background presentation behavior.
- Optional per-chat selection overrides for the four prompt stages.
- NovelAI character captions and other existing Storyboard-only runtime toggles.

Legacy Game chat metadata remains readable during migration, but new writes go through the Storyboard agent settings model.

## Repository boundary

### Marinara-Agents owns

- `packages/storyboard/agents.json` and `manifest.json`.
- Agent identity, description, phase, Game-only allowlist, permissions, defaults, and catalog metadata.
- Every built-in Storyboard planner, image, and video prompt body.
- Default prompt libraries, template descriptions, provider compatibility metadata, and default selection IDs.
- Built artifact and catalog entry.

### Marinara Engine owns

- Agent manifest/schema support for Storyboard's named prompt libraries and selections.
- Generic global Agent editor and per-chat agent assignment UI.
- Focused, lazy Storyboard settings and viewer components outside `ChatSettingsDrawer.tsx` and `GameSurface.tsx`.
- The post-processing execution adapter and structured Storyboard plan/result contract.
- Provider/model routing, connection fallback, prompt compilation, media generation, cancellation, gallery publication, and storage.
- Migration from existing Game metadata and the former global Storyboard preset app setting.
- Prompt logging through UI debug mode and `DEBUG_AGENTS`.

Engine must not retain the built-in Storyboard prompt bodies after the downloadable agent becomes the source of truth.

## Data and compatibility migration

- Do not delete existing Storyboard records, generated media, or legacy metadata in the first release.
- Import the previous global preset schema directly into the installed Storyboard agent configuration.
- Preserve all custom template IDs and de-duplicate deterministic collisions.
- Selection precedence is per-chat Storyboard agent override, global Storyboard agent default, legacy per-chat selection, then package default.
- Continue reading existing Storyboard records without changing message IDs, swipe indexes, media paths, or gallery links.
- Uninstalling the agent disables generation but does not delete Storyboard history or media.
- Reinstalling the agent restores the same configuration and history.

## Delivery phases

### Phase 1: Engine generic host support

- Add the smallest reusable agent settings contract needed for named prompt libraries and independent selections.
- Add a Storyboard result/execution adapter modeled on Illustrator's post-processing path.
- Extract Storyboard settings and viewer code into focused lazy components.
- Keep the current built-in prompts as temporary compatibility fallbacks.

### Phase 2: Illustrator-style Marinara-Agents package

- Create `packages/storyboard/manifest.json` and `agents.json` from current staging behavior.
- Move every built-in planner, image, and video prompt into the agent definition.
- Restore the custom-preset behavior from `feature/global-storyboard-prompt-presets` through the generic Agent editor.
- Build and validate the package artifact and catalog entry.

### Phase 3: Engine cleanup and migration

- Switch Storyboard prompt resolution to the installed agent definition.
- Migrate existing global and per-chat settings.
- Remove Engine-owned built-in Storyboard prompt catalogs and the general Game settings section.
- Remove temporary fallback code after the agreed compatibility window.
- Perform one additional focused `ChatSettingsDrawer.tsx` extraction so both Babel warnings are gone.

## Validation gates

- `pnpm check`, `pnpm localization:check`, `pnpm regression:prompt`, focused Storyboard regressions, and `git diff --check` in Engine.
- Marinara-Agents catalog-lane tests, catalog validation, manifest validation, and exact ZIP lifecycle regression.
- Confirm every existing built-in remains independently selectable in the correct stage.
- Confirm custom add, copy, edit, rename, describe, reset, select, and delete behavior.
- Confirm illustration and animation use their own planner selections and that animation consumes the generated keyframe/first-frame chain.
- Confirm provider connection changes do not silently discard valid selected presets.
- Install, enable, disable, update, remove, reinstall, and offline-restart proof using the built artifact.
- Existing Storyboard settings/history migration, including failure and retry.
- Manual Game checks on desktop and mobile for manual generation, automatic stills, automatic animations, viewer/background modes, gallery, replay, prompt review, partial failure, and cancellation.
- Verify `ChatSettingsDrawer.tsx` and `GameSurface.tsx` no longer trigger Babel's 500-KB warning.

## Deferred Roleplay mode

- Keep `modeAllowlist: ["game"]` for the first release.
- Keep the Storyboard result and media record shapes mode-neutral where that does not add implementation complexity.
- Add Roleplay only after defining its source-turn trigger, narration authority, viewer placement, and background behavior.

## Non-goals

- Do not convert Storyboard into a Maps-style feature package.
- Do not collapse the prompt chains into one global generation override or one opaque prompt.
- Do not redesign provider behavior, LTX Prompt Relay, or the visual presentation during extraction.
- Do not merge the old preset-restoration branch's oversized drawer implementation.
- Do not enable Storyboard by default.
- Do not add Roleplay mode in this extraction.
- Do not delete legacy data in the first package release.
