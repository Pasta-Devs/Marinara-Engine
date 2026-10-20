# Noodle Prompt Internals (Developers)

Developer reference for where Noodle's generation prompts live in the code, how to customize them, and how to debug the final prompts. End users configure Noodle through its Settings panel; see the Noodle guides in `docs/noodle/`.

Noodle is a downloadable package. Its routes (`/api/noodle`, registered when the package activates) and its generation code live in the Noodle package in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), under `packages/noodle/src/engine/packages/server/src/`. In the table below, a source marked **package** is relative to that folder. The Engine keeps the shared Noodle schema and types, Noodle storage, the registered prompt overrides that Settings lists, and the default timeline prompt text in `packages/server/src/services/noodle/noodle-prompt.ts`. The package keeps its own copies of `services/prompt-overrides/registry/noodle.ts` and `services/noodle/noodle-prompt.ts`.

## Prompt source map

Noodle has one assembled timeline prompt, an inline profile prompt, and three registered prompt overrides: two for the timeline system prompt and one for post images.

| Purpose                                                     | Source                                                             | Main symbol                                     | How to customize                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline posts, replies, follows, polls, votes, and digests | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildRefreshPrompt()`                          | The system message is the **Noodle Timeline Prompt** override followed by the **Noodle Timeline Voice & Tone** override (both below). The two user messages, the context (accounts, persona, profiles, schedules, lore, opted-in chat context, the timeline, enabled features and quotas) and the `# JSON Output Format` message, are assembled in code. |
| Timeline base system prompt                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`)   | Edit **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**, or change `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` in `noodle-prompt.ts` in code. The default holds the adult-platform, persona-authorship, interaction and JSON rules, so a rewrite can break `noodleGeneratedRefreshSchema` parsing. |
| Timeline voice/tone instructions (appended after the base)  | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Edit **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**, or change the registered default (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` in `noodle-prompt.ts`) in code. The unedited default follows the Noodle setting `enableEnhancedTimelineWriting` (`ctx.enhanced`, off by default reproduces the original single-line tone instruction) and whether random users are allowed; once a user saves their own override text, it wins regardless of those settings. |
| First-time character account profiles                       | **package** `services/noodle/noodle-public-profiles.service.ts`    | `generateMissingNoodleProfiles()`               | Edit the inline system and user messages in code. Participant selection runs first, and only selected character accounts without `profileGenerated` are passed to this prompt.                       |
| Generated post image prompt                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`)        | Edit **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**, or change the registered default in code. |
| Default Noodle-specific image instructions                  | `packages/shared/src/schemas/noodle.schema.ts`                     | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Change the Noodle setting in the UI or its schema default in code.                                                                    |
| Opted-in chat context inserted into timeline generation     | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildOptedInChatContext()`                     | Change the context assembly in code; user opt-in remains in each chat's settings.                                                     |
| Timeline post and reply image inputs                        | **package** `services/noodle/noodle-vision.ts`                     | `prepareNoodleVisionAttachments()`              | Change image selection, normalization, limits, or text-only compatibility fallback in code.                                           |
| Noodle activity inserted into chat prompts                  | **package** `services/noodle/noodle-context.ts`                    | `buildRecentSocialMediaActivityBlock()`         | The package registers it as the `noodle:prompt-context` service. Change filtering or block assembly in code; users control target modes and item limits in Noodle Settings, while the wrapped block has an 8,192-token hard ceiling.                                  |
| Generated JSON contract                                     | `packages/shared/src/schemas/noodle.schema.ts`                     | `noodleGeneratedRefreshSchema`                  | Change only alongside the prompt, route processing, shared types, and regression coverage.                                            |
| Lorebook world/lore context inserted into timeline generation | **package** `services/noodle/noodle-public-prompt.service.ts`    | `buildRefreshPrompt()` (calls `processLorebooks()`) | Gated by the **Lorebook context** Noodle setting (`enableLorebookContext`, off by default). Reuses the same multi-character `processLorebooks()` group chats use, with a Noodle-specific token budget from `noodleLorebookTokenBudget()` in `noodle-prompt.ts`, scaled by active character count and hard-capped at 8,192 tokens. Runs with `previewOnly: true` since Noodle has no per-chat slot to persist sticky/cooldown timing state. |

The profile prompt is not listed in the Prompt Overrides UI. The **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** and **Noodle Post Image** templates are. When **Noodle image generation** is on (`enableImagePrompts`), the Noodle setting **Image instructions (sent to your LLM)** goes to the timeline model, which follows it when it writes each post's image idea; the default **Noodle Post Image** template no longer appends it, though custom templates can still use it as `${userInstructions}`.

The image service (**package** `services/noodle/noodle-public-images.service.ts`) loads `NOODLE_IMAGE_POST`, then passes the result through `compileImagePrompt()` before sending it to the image provider. This means the final request can also be affected by the selected image style profile and connection defaults.

## Inspecting final prompts

A manual refresh requested with Debug Mode enabled logs the final profile and timeline model messages through the shared server logger. Look for:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Timeline image payloads are never written as base64 in debug logs. The logged text contains the same post/reply attachment keys sent to the model plus the number of native image inputs. Noodle normalizes and caps these inputs in `noodle-vision.ts`. If a provider explicitly rejects vision content, the package logs and sends the assembled text-only fallback prompt instead.

For images, enable **Expose media prompts before sending** under **Settings -> Generations -> Overall Generations** to inspect and edit the final compiled positive and negative prompts before the request is sent.

## Editing safely

Prompt assembly is a high-risk compatibility boundary. When editing it, keep the prompt, `noodleGeneratedRefreshSchema`, route processing, and the Noodle mention and poll regressions aligned. In the Engine, run at least:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Changes to package-owned code are made and validated in Marinara-Agents, against its `staging` branch.

## Related guides

- [Noodle: The In-App Social Timeline](../noodle/overview.md)
- [Noodle Settings and Chat Carryover](../noodle/settings.md)
- [Optional Agent and Capability Packages](optional-agent-packages.md)
- [Architecture Map (Developers)](architecture-map.md)
