# Noodle Prompt Internals (Developers)

Developer reference for where Noodle's generation prompts live in the code, how to customize them, and how to debug the final prompts. End users configure Noodle through its Settings panel; see the Noodle guides in `docs/noodle/`.

## Prompt source map

Noodle currently has one inline text-generation prompt, one registered text prompt override, and one registered image prompt override.

| Purpose                                                     | Source                                                             | Main symbol                                     | How to customize                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline posts, replies, follows, polls, votes, and digests | `packages/server/src/routes/noodle.routes.ts`                      | `buildRefreshPrompt()`                          | Edit the inline system and context messages in code. The tone/creative-freedom portion is delegated to the **Noodle Timeline Voice & Tone** override below; the rest (schema-critical output-format rules) is not customizable from the UI. |
| Timeline voice/tone instructions (subset of the system prompt) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Edit **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**, or change the registered default (`noodleTimelineVoiceDefaultText(enhanced)` in `noodle-prompt.ts`) in code. Deliberately scoped to tone only — structured-action limits, target field rules, and other schema-critical instructions stay hardcoded outside this override so a rewrite can't break `noodleGeneratedRefreshSchema` parsing. The unedited default follows the Noodle setting `enableEnhancedTimelineWriting` (`ctx.enhanced`, off by default reproduces the original single-line tone instruction); once a user saves their own override text, it wins regardless of that setting. |
| First-time character account profiles                       | `packages/server/src/routes/noodle.routes.ts`                      | `generateMissingNoodleProfiles()`               | Edit the inline system and user messages in code. Participant selection runs first, and only selected character accounts without `profileGenerated` are passed to this prompt.                       |
| Generated post image prompt                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`)        | Edit **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**, or change the registered default in code. |
| Default Noodle-specific image instructions                  | `packages/shared/src/schemas/noodle.schema.ts`                     | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Change the Noodle setting in the UI or its schema default in code.                                                                    |
| Opted-in chat context inserted into timeline generation     | `packages/server/src/routes/noodle.routes.ts`                      | `buildOptedInChatContext()`                     | Change the context assembly in code; user opt-in remains in each chat's settings.                                                     |
| Timeline post and reply image inputs                        | `packages/server/src/services/noodle/noodle-vision.ts`             | `prepareNoodleVisionAttachments()`              | Change image selection, normalization, limits, or text-only compatibility fallback in code.                                           |
| Noodle activity inserted into chat prompts                  | `packages/server/src/services/noodle/noodle-context.ts`            | `buildRecentSocialMediaActivityBlock()`         | Change filtering or block assembly in code; users control target modes and item limits in Noodle Settings, while the wrapped block has an 8,192-token hard ceiling.                                  |
| Generated JSON contract                                     | `packages/shared/src/schemas/noodle.schema.ts`                     | `noodleGeneratedRefreshSchema`                  | Change only alongside the prompt, route processing, shared types, and regression coverage.                                            |
| Lorebook world/lore context inserted into timeline generation | `packages/server/src/routes/noodle.routes.ts`                    | `buildRefreshPrompt()` (calls `processLorebooks()`) | Gated by the **Lorebook context** Noodle setting (`enableLorebookContext`, off by default). Reuses the same multi-character `processLorebooks()` group chats use, with a Noodle-specific token budget from `noodleLorebookTokenBudget()` in `noodle-prompt.ts`, scaled by active character count and hard-capped at 8,192 tokens. Runs with `previewOnly: true` since Noodle has no per-chat slot to persist sticky/cooldown timing state. |

The timeline and profile prompts are not currently listed in the Prompt Overrides UI. The **Noodle Post Image** template is the only Noodle generation prompt exposed there. The Noodle-local **Prompt instructions** field is passed into that image template; it does not modify the timeline-writing prompt.

The image route loads `NOODLE_IMAGE_POST`, then passes the result through `compileImagePrompt()` before sending it to the image provider. This means the final request can also be affected by the selected image style profile and connection defaults.

## Inspecting final prompts

A manual refresh requested with Debug Mode enabled logs the final profile and timeline model messages through the shared server logger. Look for:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Timeline image payloads are never written as base64 in debug logs. The logged text contains the same post/reply attachment keys sent to the model plus the number of native image inputs. Noodle normalizes and caps these inputs in `noodle-vision.ts`. If a provider explicitly rejects vision content, the route logs and sends the assembled text-only fallback prompt instead.

For images, enable **Expose media prompts before sending** under **Settings -> Generations -> Image Generation** to inspect and edit the final compiled positive and negative prompts before the request is sent.

## Editing safely

Prompt assembly is a high-risk compatibility boundary. When editing it, keep the prompt, `noodleGeneratedRefreshSchema`, route processing, and the Noodle mention and poll regressions aligned. Run at least:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

## Related guides

- [Noodle: The In-App Social Timeline](../noodle/overview.md)
- [Noodle Settings and Chat Carryover](../noodle/settings.md)
- [Architecture Map (Developers)](architecture-map.md)
