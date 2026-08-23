# LTX Storyboard Image-to-Video

Status: Simplification follow-up under local review.

## Problem

Marinara's first LTX Director Storyboard integration split each planned shot into a stable global prompt and multiple pipe-delimited local prompts. The Storyboard route then recognized the built-in template IDs and bypassed the normal video-prompt contract to assemble an LTX-specific payload.

That design made prompt customization surprising: copying or editing a built-in template changed its ID and silently disabled the special handoff. It also encouraged the planner to distribute too many actions across a short clip. When planning failed, the generic fallback storyboard could pass a large excerpt of raw narration to video generation, producing the overloaded prompts seen in runtime logs.

The working local ComfyUI workflow does not require that temporal-prompt layer. LTX 2.3 can animate the supplied first frame from one direct image-to-video prompt.

## Product decision

Keep the existing opt-in template IDs and settings controls for saved-chat compatibility, but simplify their contract:

- **LTX Director Storyboard** plans the first frame and one complete LTX 2.3 image-to-video prompt per shot.
- **Storyboard First Frame** formats the exact T=0 illustration used as the reference image.
- **Narration Passthrough** is only `${narrationSummary}` and therefore passes the planner's completed prompt through the same universal video-template path used by every other workflow.

The Storyboard route must not inspect those template IDs, manufacture local segments, or attach an LTX-specific prompt payload. The selected video template remains fully customizable.

## Planner contract

Keep the existing Storyboard JSON shape:

- `imagePrompt` describes only the exact first frame at T=0.
- `narrationBeat` is the complete prompt sent to the video model with that image.
- section anchors and `characters` retain their existing meanings.

For each `narrationBeat`, follow the official [LTX image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) and [prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide):

- write one flowing present-tense paragraph, using roughly 2-4 short sentences for 1-6 seconds, 3-5 for 7-10 seconds, and 4-8 for 11-15 seconds only when the action supports that detail;
- begin from the state shown in `imagePrompt` and describe what happens next;
- use one primary action and one camera setup for 1-6 seconds, up to two connected phases and setups for 7-10 seconds, and up to three for 11-15 seconds;
- describe each camera behavior relative to the subject and vary the angle only when the duration can show the transition clearly;
- express reactions through visible face, gaze, posture, breathing, or gestures;
- include restrained environmental motion and relevant audio or brief quoted dialogue;
- finish with the action completing, settling, or holding;
- rely on the source image for static appearance, composition, setting, lighting, palette, texture, and style;
- avoid scene changes, new subjects, overloaded action, complex physics, readable text, UI, invented events, and any cut or camera change that cannot fit clearly within the duration.

Start simple. Four sentences are sufficient when they completely direct the shot; the planner must not pad a simple action merely to add motion.

Example:

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Data flow

1. The planner returns one T=0 `imagePrompt` and one complete `narrationBeat` for each shot.
2. Storyboard image generation creates the first-frame reference illustration.
3. The Narration Passthrough template resolves `${narrationSummary}` to that shot's `narrationBeat`.
4. The normal video-generation request carries the result in its existing `prompt` field.
5. The ComfyUI adapter replaces `%prompt%` in the saved workflow and supplies the existing reference image, dimensions, duration, frame count, seed, and model values.

There is no LTX-only Storyboard route branch in this flow.

## ComfyUI contract

Use the known-working LTX 2.3 image-to-video workflow with the normal Marinara placeholders. Its Director inputs should be:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Keep `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%`, and `%model%` where the workflow already expects them. A six-second request remains 96 frames under Marinara's existing 16 FPS contract.

Older saved workflows using `%global_prompt%`, `%local_prompts%`, and `%segment_lengths%` remain compatible: the adapter maps an ordinary request prompt to the global value and leaves local prompts and segment lengths empty. Those placeholders are compatibility support, not the recommended Storyboard configuration.

## Failure behavior

- If the client disconnects or the planner aborts, propagate the cancellation. Do not continue generating fallback media.
- If the planner genuinely fails, the existing fallback planner may preserve still-image behavior, but skip video generation for that request. Raw narration is not a safe image-to-video prompt.
- A reviewed client-supplied storyboard remains eligible for video generation because its prompt has already been reviewed upstream.

## Scope

This change does not add a second vision-model pass over the generated reference image. The planner already directs both the first frame and its immediate motion, while the image itself conditions LTX at generation time. A future image-aware rewrite can be evaluated separately if first-frame drift proves significant.

No client UI, localization, storage schema, migration, version, service restart, or Marinara-Agents work is required.

## Acceptance criteria

- The LTX Storyboard planner requests one complete duration-aware image-to-video prompt with readable action phases, relative camera direction, and optional audio or dialogue.
- The Narration Passthrough template is exactly `${narrationSummary}`.
- The Storyboard route has no exact-template-ID bypass, local-prompt sanitizer, or LTX-specific handoff.
- A workflow with `global_prompt: "%prompt%"` receives the planner's complete prompt; `local_prompts` and `segment_lengths` stay empty.
- Existing `%global_prompt%` workflows still receive the normal request prompt as a compatibility fallback.
- Planner cancellation stops the operation, and genuine fallback planning skips video generation.
- `pnpm regression:prompt`, `pnpm check`, and `git diff --check` cover the final patch.
