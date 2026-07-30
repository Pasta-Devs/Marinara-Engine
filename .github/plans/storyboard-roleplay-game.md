# Storyboard for Roleplay and Game

Status: implementation tracked by Engine issue #4311 and Marinara-Agents issue #144.

## Goal

Use one Storyboard agent package for Game and Roleplay chats.

- Game keeps its current Storyboard behavior.
- Roleplay uses the existing assistant-response run interval pattern.
- Storyboard selects the correct prompt wording from the chat mode.
- Illustrator remains an independent package and is not required by Storyboard.

## Product decision

Storyboard was derived from Illustrator because Game did not have an Illustrator path. Adding Storyboard features back to Illustrator would leave two packages doing the same job. The shared design history does not create an install or runtime dependency between the packages.

Storyboard becomes the shared visual agent:

| Chat mode | Source                                                      | Cadence                      | Default                      |
| --------- | ----------------------------------------------------------- | ---------------------------- | ---------------------------- |
| Game      | Completed GM narration                                      | Existing every-turn behavior | Existing Storyboard settings |
| Roleplay  | Latest completed user-and-assistant exchange                | Existing agent `runInterval` | One keyframe                 |

Users keep the existing still or animation choice. Animation continues through the current planner -> first-frame image -> video connection chain.

Roleplay does not create a Game session, Game state, fake database turn, or extra transcript message. `runInterval` controls frequency only: an interval of 5 means “run after every fifth completed assistant response,” while each run still plans only the latest completed exchange. The immediately preceding user message or messages establish the action or request, and the assistant response establishes the canonical outcome. Older conversation is continuity context, not source material.

Multi-message episodes are intentionally outside automatic cadence. A future manual **Storyboard message range** action can let the user select an explicit beginning and end; only that intentional range should produce a multi-exchange, multi-keyframe Roleplay storyboard.

## Mode-aware prompts

Reuse the Maps pattern:

```ts
const ownerMode = chat.mode === "game" ? "game" : "roleplay";
```

The Engine detects the mode and supplies these variables to the existing Storyboard prompt renderer:

- `${ownerMode}`
- `${sourceTurnLabel}`
- `${sourceRoleLabel}`
- `${contextBlock}`
- `${sourceTurnBlock}`
- `${modeRulesBlock}`

Important values are:

| Variable          | Game                                                         | Roleplay                                                                                                                 |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `sourceTurnLabel` | completed GM narration                                       | latest completed Roleplay exchange                                                                                        |
| `sourceRoleLabel` | GM                                                           | assistant                                                                                                                |
| `modeRulesBlock`  | Do not include the user's next CYOA/action.                  | Do not invent the user's next reply or continue beyond this response.                                                    |
| `contextBlock`    | Existing Game state, party, Game NPCs, Maps, and art context | Chat-assigned characters, active persona, recent conversation, optional tracker state, Maps, background, and art context |

Templates only interpolate values; this does not add conditional prompt syntax. Keep `${gameContextBlock}` as a Game-mode alias so saved custom prompts remain valid.

## Existing structures to reuse

- Current Storyboard planner JSON and keyframe records.
- Current still planner -> image formatter chain.
- Current animation planner -> first-frame image -> video formatter chain.
- Current Storyboard storage, gallery records, routes, settings panel, and viewer.
- Existing generic agent cadence helper for Roleplay run intervals.
- Existing Roleplay chat-character, persona, conversation, optional tracker, image-style, background, and Maps context.
- Existing Storyboard image and video connection settings.

Do not rename routes or tables in this change, and do not make Storyboard depend on the optional Maps package.

## Implementation

### Marinara Engine

1. Exclude `execution: "host"` agents from the generic agent pipeline, matching the existing retry path.
2. Normalize Storyboard's owner mode from the chat and replace hard-coded Game/GM/CYOA prompt text with the variables above.
3. Allow the existing Storyboard generation path to compile the latest completed Roleplay exchange and active swipe into one source scene. Keep `runInterval` as cadence only.
4. When `ownerMode` is `roleplay`, build the roster only from the chat's assigned character IDs and active persona. Add recent conversation, optional Character Tracker state, Maps context, and Roleplay illustration settings. Do not read Game setup, party, Game character-card, or Game NPC metadata.
5. Reuse `agent-cadence.ts` for Roleplay. Advance cadence only after at least one media result succeeds.
6. Reuse the existing per-chat generation lock and a client chat/message/swipe attempt key to prevent duplicate automatic requests.
7. Reuse the Storyboard settings panel and viewer in the Roleplay surface. Default Roleplay to one keyframe without changing the Game default.

### Marinara-Agents

1. Expand Storyboard's allowlist to `game` and `roleplay`.
2. Replace hard-coded Game wording in built-in planner prompts with the new variables.
3. Port Illustrator's useful director guidance into Storyboard's existing keyframe JSON contract.
4. Keep the current planner, image formatter, video formatter, image connection, and video connection settings.
5. Version the package as 1.1.0 and rebuild its artifact, manifests, hashes, and catalog lanes together.

## Illustrator compatibility

- Do not delete Illustrator or its saved settings in the first release.
- Existing Illustrator chats continue working without migration.
- Storyboard keeps its own interval, prompt, image, video, appearance, avatar-reference, and style settings.
- Installing or enabling Storyboard does not install, enable, read, or copy settings from Illustrator.
- Storyboard does not change Illustrator activation or runtime behavior. If a user enables both automatic agents, both may generate media for the same response.

## Non-goals

- New storage or schema.
- Fake Game turns in Roleplay.
- Visual Novel support.
- Game setup, party, or Game NPC fallback in Roleplay.
- A new prompt engine or conditional template language.
- Route, table, or viewer redesign.
- Immediate deletion of Illustrator data.

## Acceptance criteria

- One Storyboard package works in Game and Roleplay.
- Existing Game still and animation behavior is unchanged.
- Roleplay uses the latest completed exchange, while the configured run interval controls only how often it runs.
- Roleplay prompts contain no GM, Game-state, or CYOA instructions.
- Roleplay character context comes only from assigned chat characters, the active persona, the conversation, and optional Roleplay tracker/Maps context.
- Still generation uses the selected image connection; animation uses that still and the selected video connection.
- Existing Storyboard records and custom Game templates remain readable.
- Duplicate or failed requests do not advance cadence or create duplicate Storyboards.
- Illustrator behavior remains unchanged whether Storyboard is installed, absent, enabled, or disabled.

## Validation and delivery

- Add prompt regressions for the same scene in Game and Roleplay.
- Add cadence, retry, swipe, duplicate-request, and host-routing regressions.
- Re-run existing Game Storyboard route and storage coverage.
- Manually verify still and animation flows on desktop and mobile Roleplay.
- Run `pnpm check`, `pnpm localization:check`, `pnpm regression:prompt`, `pnpm smoke:ui`, and `git diff --check` in Engine.
- Build and validate every affected Marinara-Agents artifact and catalog lane against the paired Engine branch.
- Use linked draft PRs against `staging`; release Engine support before publishing the dependent Storyboard package.
