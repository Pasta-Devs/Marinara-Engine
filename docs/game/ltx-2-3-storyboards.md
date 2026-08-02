# LTX 2.3 Storyboards in Game Mode

This guide connects a local LTX 2.3 ComfyUI image-to-video workflow to Marinara Engine's Game Mode storyboards. Some players call this Story Mode; the controls in Marinara are labeled **Game Mode** and **Storyboards**.

The configuration below was developed with **Krea 2** first-frame generation and the **Z-Image Turbo Narrative** natural-language Image Style. Other image connections should also work when they accept descriptive natural-language scene prompts. The LTX video render runs locally in ComfyUI; whether first-frame generation is local or hosted depends on the selected image connection.

The finished path is:

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> LTX Director Video -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

The generated illustration is the first frame of the clip. LTX therefore receives both a visual starting point and a prompt that concentrates on what moves next.

## Before you start

You need:

1. A working local ComfyUI installation that Marinara can reach.
2. The editable `ltx-director-simple` workflow, or an equivalent LTX 2.3 image-to-video graph that completes successfully inside ComfyUI.
3. Its `ltx-director-simple-api` API-format export for the Marinara connection.
4. A Marinara image-generation connection for the first-frame illustrations.
5. The **Storyboard** Agent installed from **Agents > Download Agents** and activated for the Game under **Chat Settings > Agents**.

The editable ComfyUI workflow and its API export are different files. Open `ltx-director-simple` in ComfyUI, install every missing custom node reported by ComfyUI Manager, and test the graph there. Import `ltx-director-simple-api` into the Marinara connection. After every node or model change, export the graph again in API format and replace the JSON stored on the connection. Do not paste the normal visual-editor workflow into Marinara.

See [ComfyUI Workflow Setup](../media/comfyui.md) for the general export and connection process.

## Choose an LTX 2.3 model

Choose the model format for the GPU architecture and the memory available after ComfyUI loads the text encoder, VAEs, and upscaler. Treat these as starting points, not promises that every workflow will fit every card.

| GPU family | Practical starting point | Notes |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | The low-memory starting point for 3070, 3080, and 3090-class cards. |
| RTX 40 series with 16-24 GB | FP8 input-scaled | Uses the accelerated FP8 path available on Ada-generation hardware. |
| RTX 40 series with 8-12 GB | INT8 ConvRot when FP8 offloading is too slow | Compare both on the actual workflow; available VRAM and offloading behavior still matter. |
| RTX 50 series (Blackwell) | NVFP4 dev workflow | Requires an NVFP4-capable ComfyUI, CUDA, and node stack. |
| RTX 50 using the existing distilled workflow | FP8 input-scaled | Use this compatibility path until an official distilled NVFP4 checkpoint is available. |

The tested RTX 3080 workflow uses:

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

These suffixes describe different quantized model formats and execution paths, not quality presets that can always be swapped in place:

- **INT8 ConvRot** is the practical community low-memory path for RTX 30-series cards and smaller Ada cards.
- **FP8 input-scaled** uses accelerated FP8 matrix operations on roughly RTX 40-series and newer NVIDIA hardware.
- **NVFP4** is the Blackwell-native four-bit path used by the RTX 50-series workflow.
- **Dev** and **distilled** workflows use different sampling assumptions. Do not put a dev checkpoint into the attached distilled graph without changing the workflow to match.

An 8 GB card should start at 480p and one keyframe for its first integration test. Fitting the checkpoint does not guarantee that a longer or higher-resolution video will fit, because video latents, the text encoder, VAEs, audio, and upscaling also use memory.

The official beginner workflow uses these components:

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

Custom workflows may use a distilled v1.1 checkpoint, a third-party quantization, different loader nodes, or different model folders. The filenames saved in the API workflow must exactly match the files visible to ComfyUI.

Official references:

- [LTX 2.3 image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 model card](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 model card](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Official LTX 2.3 ComfyUI examples](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community ComfyUI-separated and FP8 weights](https://huggingface.co/Kijai/LTX2.3_comfy)

## Prepare the ComfyUI API workflow

First queue the editable workflow directly in ComfyUI with a real source image and a simple prompt. Confirm that it saves an MP4 with audio before adapting its API export for Marinara.

The simple Marinara path uses one complete prompt in the LTX Director global prompt input:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

The LTX Director node may still handle image conditioning, guide data, audio, and the two sampling stages. "Simple" refers to the prompt contract: Marinara sends one coherent image-to-video paragraph instead of a Prompt Relay timeline.

### Required placeholders

Replace the corresponding values in the API export with quoted Marinara placeholders:

| Placeholder | Supplied value |
| --- | --- |
| `%prompt%` | The complete prompt produced by the selected Storyboard Animation Planner and video template |
| `%reference_image_name%` | The first-frame image uploaded to ComfyUI |
| `%duration_seconds%` | The Storyboard clip duration in seconds |
| `%length%` | The duration converted to Marinara's 16 FPS frame contract |
| `%fps%` | The frame rate Marinara uses for the clip |
| `%width%`, `%height%` | Dimensions selected from the video connection's resolution and aspect ratio |
| `%seed%` | A new random seed for the request |
| `%model%` | Optional model value from the connection when the workflow does not hard-code its loader model |

The reference image belongs inside the `segments` array of LTX Director's `timeline_data`. In the API workflow, `timeline_data` is a serialized JSON string. `%length%` keeps the clip length dynamic through `normalDurationFrames`; the frame-zero reference-image segment intentionally keeps its own fixed short `"length":16` value:

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

Do not place `%reference_image_name%` beside `timeline_data` or in a separate top-level image field. Keep frame count, seconds, and frame rate connected to the workflow's external inputs with `%length%`, `%duration_seconds%`, and `%fps%`; the numeric values shown by an editable ComfyUI graph are not Marinara defaults.

Keep string placeholders such as `%reference_image_name%` quoted. Exact numeric node inputs may quote `%length%`, `%duration_seconds%`, and `%fps%` because Marinara converts them to numbers. Inside the serialized `timeline_data` string, leave `%length%` unquoted as shown so the decoded timeline value is numeric.

### Export after every edit

1. Queue the editable workflow in ComfyUI.
2. Confirm that the current graph produces a playable MP4.
3. Select **Save (API Format)**, **Export (API)**, or **Export to API**.
4. Add or confirm the placeholders in the new API JSON.
5. Replace the workflow stored on the Marinara connection.

Deleting a node and continuing to use an older API export can leave references to a node that no longer exists. ComfyUI then rejects the request before generation begins.

## Create the Marinara video connection

1. Open **Settings**, then **Connections**.
2. Add a **Video Generation** connection.
3. Choose **ComfyUI**.
4. Enter the ComfyUI base URL, normally `http://127.0.0.1:8188` when it runs on the same computer.
5. Paste the complete API-format workflow into **ComfyUI Workflow**.
6. Choose a six-second default duration, **16:9**, and 480p for the first low-VRAM test.
7. Save the connection.

A text-only connection test cannot exercise `%reference_image_name%`. Validate image-to-video from a Gallery image or a Storyboard after saving the connection.

## Configure the Game Mode chat

Open the Game Mode chat, then open **Chat Settings** and select **Agents**. Turn on **Enable Agents** and **Enable Storyboards** before configuring the sections below. Storyboard Optimized presentation in the new-game wizard does not activate the Agent.

### Illustrator

| Setting | Recommended value |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off for this tested workflow |

The Animation Planner already receives the Storyboard turn's character-appearance context, so this setup leaves **Attach Card Appearance** off to avoid appending the same information again during final image formatting. **Storyboard First Frame** also avoids repeating campaign art direction around the planner's completed T=0 scene.

**Send Avatar References** controls reference images sent to the first-frame image provider; it does not control LTX's first-frame input. LTX receives the finished Storyboard illustration through `%reference_image_name%`. Leave avatar references off for this tested Krea setup, then enable them separately only after confirming that the selected image connection supports and benefits from them.

The first-frame image has a large effect on animation quality. It should show the exact moment immediately before the planned movement, with the subject, route, hands, door, prop, or target clearly visible.

### Scene Videos

| Setting | Recommended value |
| --- | --- |
| **Video Connection** | The LTX 2.3 ComfyUI connection created above |
| **Game Video Prompt** | **LTX Director Video** |

The general **Game Video Prompt** controls manual Gallery and Game Assets animations. Storyboard clips can select their own prompt without changing those other animation actions.

### Storyboards

Use this starting profile:

| Setting | Recommended starting value |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normally; start with 1 for the first 8 GB VRAM test |
| **Animation Clip Duration** | 6 seconds |
| **Viewer Display** | Floating while testing |
| **Illustration Planner** | **Still Keyframes**; retained as the still-only fallback |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **LTX Director Video** |

**LTX Simple Image-to-Video** is the recommended default. It plans one animation-ready first frame and one direct 4–8 sentence motion prompt. It favors one primary action, one camera behavior, restrained environmental motion, and relevant audio or brief dialogue.

**LTX Director Storyboard** remains available as an advanced option. It provides more detailed duration-aware direction and continuity rules. Try it after the simple path is stable, or when a longer clip genuinely needs more connected phases. Both planners use the same `%prompt%` workflow contract.

**Illustration Planner: Still Keyframes** does not create Krea's prompt while animations are enabled. In animation mode, **LTX Simple Image-to-Video** creates both outputs: a natural-language `imagePrompt` for Krea and a `narrationBeat` for LTX. Still Keyframes remains selected only for turns generated without videos.

**Storyboard First Frame** passes the Animation Planner's complete natural-language T=0 scene directly to Krea without adding a keyframe title, prompt labels, repeated appearance notes, or campaign art direction. Keep **Use Storyboard Template** on so this formatter is actually applied.

**LTX Director Video** is intentionally small. It passes the Animation Planner's completed `narrationBeat` through the universal video prompt contract without surrounding it with another scene recap.

Each keyframe creates one Krea image job and one local LTX video job. Three keyframes therefore launch three first-frame renders and three video renders. For an 8 GB VRAM GPU, start with one keyframe at 480p. After that succeeds, move toward three keyframes and higher resolutions.

## Run the first test

Use a completed GM turn containing one obvious visual action, such as opening a door, looking toward a sound, taking a few steps, or saying one short line.

1. For the quickest low-VRAM check, temporarily set **Keyframes per Turn** to 1 while leaving **Animation Clip Duration** at 6 seconds. The normal tested profile uses 3 keyframes.
2. Turn both automatic Storyboard settings on after the current GM turn is already complete.
3. Open the Gallery and choose **Create storyboard** for that completed GM turn. This manually starts the full illustration-and-animation path without waiting for another turn.
4. If prompt exposure is enabled, review the first-frame prompt before submitting it.
5. Confirm that the generated first frame is a physically useful starting pose.
6. Wait for the first-frame render and then the ComfyUI clip to finish.
7. Restore **Keyframes per Turn** to 3 and leave both automatic settings on for later turns after the manual path works.

Use **Floating** viewer mode during setup because it makes it easier to inspect each image and clip. Switch to **Background** after the workflow is reliable if you want storyboard media integrated into the Game Mode scene.

## How the prompt handoff works

For each keyframe, the Animation Planner returns:

- `imagePrompt`: only the visible first frame at time T=0;
- `narrationBeat`: the complete LTX image-to-video prompt describing what happens next.

The selected Animation Planner writes both fields. **Storyboard First Frame** formats `imagePrompt` and sends that natural-language T=0 scene to Krea 2. After the image exists, **LTX Director Video** resolves to `narrationBeat`. Marinara places it in the normal video request's `prompt` field, replaces `%prompt%` in the ComfyUI workflow, uploads the first frame, and replaces `%reference_image_name%` with its ComfyUI filename.

There is no requirement to create two local prompt segments. A single global prompt is the normal path for these Storyboard presets.

## What makes a good LTX prompt

The source image already describes character appearance, composition, setting, lighting, palette, and texture. The video prompt should concentrate on motion:

- one flowing paragraph in present tense;
- one focused action that fits the clip duration;
- camera movement described relative to the subject;
- visible reactions through gaze, face, posture, breathing, or gesture;
- at most one useful environmental motion;
- ambient sound, effects, music, or brief quoted dialogue when relevant;
- a natural completion, settling motion, or brief hold at the end.

Avoid scene changes, cuts, teleportation, multiple unrelated actions, complex physics, crowded choreography, exact readable text, and repeated inventories of details already visible in the first frame.

Example:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Record a reproducible setup

An "8 GB" result depends on more than the checkpoint. When sharing the workflow, record:

- the exact GPU model and VRAM;
- ComfyUI version or commit;
- NVIDIA driver, CUDA, PyTorch, and Python versions;
- required custom-node packages and their versions;
- exact model filenames and their ComfyUI folders;
- output resolution, duration, keyframe count, and approximate render time;
- whether Krea 2 runs locally or through a hosted image connection in that setup.

The attached API JSON stores a snapshot of node IDs, model paths, and input names. Users who keep models under a different folder, such as `LTX2/`, must update the loader values and export a fresh API copy. A workflow that runs in its author's ComfyUI installation can still fail elsewhere when a custom node or model path differs.

## Troubleshooting

### ComfyUI returns HTTP 400 or "Prompt outputs failed validation"

The API workflow does not match the currently installed graph. Look for a deleted node, a dangling node ID, a missing custom node, an input renamed by a node update, or a model filename that no longer exists. Export a fresh API workflow from the working ComfyUI graph.

### Images are created but videos are not

Check **Automatic Storyboard Animations** and the Game Mode **Video Connection**. Animations require both the first-frame illustration and a selected video connection.

### LTX receives no starting image

Confirm that `%reference_image_name%` appears in the saved API workflow and feeds the LTX Director image segment. Marinara only uploads the first frame when that placeholder is present.

### The clip morphs, changes characters, or becomes chaotic

Return to **LTX Simple Image-to-Video**, use one keyframe, and test a turn with one action. A source image cannot cleanly become several locations, poses, and outcomes during a short continuous clip. Also check the first frame: a confusing starting pose produces a harder animation problem even with a good motion prompt.

### Every generation looks too similar

Replace any hard-coded sampling seed with `%seed%`. Once a useful result appears, temporarily fix that seed in the workflow only when comparing prompt or sampling changes.

### Generation runs out of memory

Start at 480p. Reduce duration next if necessary. Keep one keyframe per turn during testing, close other GPU applications, and avoid keeping a local language model loaded on the same low-VRAM GPU. A quantized checkpoint reduces model memory but does not remove the memory used by video latents, the text encoder, VAEs, audio, and upscaling.

### Marinara stops waiting but ComfyUI continues rendering

Closing the browser request or losing the client connection can stop Marinara's polling without cancelling a job already queued in ComfyUI. Check ComfyUI's queue, history, and output folder before starting the same render again.

### The workflow works in ComfyUI but fails from Marinara

Compare the saved connection JSON with the newest API export. Verify the base URL, placeholder spelling, required custom nodes, model paths, output node, dimensions, and duration fields. The editable graph can work while Marinara still holds an older exported snapshot.

For detailed server traces, enable debug logging and look for `[debug/game/storyboard-video]` and `[video-gen/comfyui]`. A healthy request shows the completed global prompt, an uploaded reference-image filename, duration, frame count, and a queued ComfyUI prompt ID.

## Related guides

- [Storyboard Agent Guide](storyboard.md)
- [ComfyUI Workflow Setup](../media/comfyui.md)
- [Scene Video Generation](../media/scene-video.md)
- [Game Mode: Getting Started](getting-started.md)
