# LTX 2.3 Storyboards in Game Mode

This guide connects a local LTX 2.3 ComfyUI image-to-video workflow to Game Mode Storyboards, so each storyboard frame becomes a short video clip. It is an advanced setup for players with a local GPU and ComfyUI. Some players call this Story Mode. In Marinara the controls are labeled **Game Mode** and **Storyboards**.

The setup was developed with **Krea 2** first-frame images and the **Z-Image Turbo Narrative** Image Style. Other image accounts should work if they accept descriptive natural-language scene prompts. The LTX video renders locally in ComfyUI. Whether the first-frame image is local or hosted depends on the image account you pick.

The finished path has these steps:

1. The GM writes a narration turn.
2. The Animation Planner returns an `imagePrompt` and a `narrationBeat`.
3. The `imagePrompt` goes to the image account and becomes the first-frame illustration.
4. The `narrationBeat` goes through **Narration Passthrough** and becomes `%prompt%`.
5. The first frame and the prompt go to the ComfyUI LTX 2.3 workflow, which makes an MP4 clip.

The illustration is the first frame of the clip. LTX gets both a starting picture and a prompt about what moves next. If it works, a clip appears in the Gallery's **Videos** tab.

## Before you start

You need:

1. A working local ComfyUI that Marinara can reach. See [ComfyUI Workflow Setup](../media/comfyui.md).
2. A GPU with enough VRAM (the memory on your graphics card). An 8 GB card can work for a first test at 480p with one keyframe.
3. The editable `ltx-director-simple` workflow, or an equivalent LTX 2.3 image-to-video graph that completes in ComfyUI, and its `ltx-director-simple-api` API-format export.
4. An image account in Marinara for the first-frame illustrations.
5. The **Storyboard** agent, downloaded from **Agents → Agent Organizer** and turned on for the game under **Chat Settings → Agents**. See [Storyboard Agent Guide](storyboard.md).

The editable workflow and its API export are different files. Open `ltx-director-simple` in ComfyUI, install every custom node that ComfyUI Manager reports as missing, and test the graph there. Import `ltx-director-simple-api` into Marinara. After every node or model change, export the graph again in API format and replace the JSON on the Marinara account. Do not paste the normal visual-editor workflow into Marinara.

## Prepare the ComfyUI API workflow

First queue the editable workflow in ComfyUI with a real source image and a simple prompt. Confirm that it saves an MP4 with audio.

The simple Marinara path puts one complete prompt in the LTX Director global prompt input:

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

The LTX Director node can still handle image conditioning, guide data, audio and the two sampling stages. "Simple" means Marinara sends one coherent image-to-video paragraph instead of a Prompt Relay timeline.

### Placeholders

In the API export, replace the matching values with these quoted Marinara placeholders:

| Placeholder | Value Marinara supplies |
| --- | --- |
| `%prompt%` | The full prompt from the Animation Planner and video template |
| `%reference_image_name%` | The first-frame image uploaded to ComfyUI |
| `%duration_seconds%` | The clip duration in seconds |
| `%length%` | The duration as a frame count at Marinara's 16 FPS default |
| `%fps%` | The frame rate Marinara uses |
| `%width%`, `%height%` | Dimensions from the video account's resolution and aspect ratio |
| `%seed%` | A new random seed for each request |
| `%model%` | Optional model value from the account, when the workflow does not fix its loader model |

Marinara can also fill `%length_s%`, `%global_prompt%`, `%local_prompts%` and `%segment_lengths%`. These four are optional. The simple path does not need them and sends its prompt through `%prompt%`.

The reference image belongs inside the `segments` array of LTX Director's `timeline_data`, which is a serialized JSON string in the API workflow. `%length%` keeps the clip length dynamic through `normalDurationFrames`. The frame-zero reference-image segment keeps its own fixed `"length":16`.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- Do not put `%reference_image_name%` beside `timeline_data` or in a separate top-level image field.
- Keep string placeholders such as `%reference_image_name%` quoted.
- Numeric node inputs may quote `%length%`, `%duration_seconds%` and `%fps%`, because Marinara turns them into numbers. Inside the serialized `timeline_data` string, leave `%length%` unquoted as shown so the decoded value is a number.
- Keep frame count, seconds and frame rate tied to these placeholders. The numbers an editable ComfyUI graph shows are not Marinara defaults.

### Export after every edit

1. Queue the editable workflow in ComfyUI and confirm it makes a playable MP4.
2. Select **Save (API Format)**, **Export (API)** or **Export to API**, depending on your ComfyUI version.
3. Add or confirm the placeholders in the new API JSON.
4. Replace the workflow stored on the Marinara account.

Deleting a node and continuing to use an older export leaves references to a node that no longer exists. ComfyUI then rejects the request.

## Create the video account

1. Open **Settings → Connections**.
2. Click **Add account** and choose a **Video Generation** account.
3. Choose **ComfyUI**.
4. Enter the **Base URL**, normally `http://127.0.0.1:8188` when ComfyUI runs on the same computer.
5. Paste the full API-format workflow into **ComfyUI workflow**.
6. For the first low-VRAM test, choose a six-second default duration, **16:9** and 480p.
7. Save the account.

A text-only connection test cannot exercise `%reference_image_name%`. Test image-to-video from a Gallery image or a Storyboard after saving.

## Set up the Game Mode chat

Open the Game Mode chat, then **Chat Settings → Agents**. Turn on **Enable Agents** and **Enable Storyboards** first. The wizard's Storyboard Optimized presentation does not turn on the agent.

### Illustrator

| Setting | Recommended value |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | Off for this tested workflow |

The Animation Planner already receives the turn's character-appearance context, so **Attach Card Appearance** stays off to avoid adding it twice. **Storyboard First Frame** also avoids repeating campaign art direction around the planner's finished first-frame scene.

**Send Avatar References** controls reference images sent to the first-frame image service. It does not control LTX's first-frame input: LTX receives the finished illustration through `%reference_image_name%`. Turn avatar references on only after you confirm your image account supports them and they help.

The first frame strongly affects animation quality. It should show the exact moment before the planned movement, with the subject, route, hands, door, prop or target clearly visible.

### Scene Videos

| Setting | Recommended value |
| --- | --- |
| **Video model** | The LTX 2.3 ComfyUI account you created |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt** controls manual Gallery and Game Assets animations. Storyboard clips can use their own prompt without changing those.

### Storyboards

| Setting | Recommended starting value |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 3 normally. Start with 1 for the first 8 GB VRAM test. |
| **Animation Clip Duration** | 5 seconds |
| **Viewer Display** | Floating while testing |
| **Illustration Planner** | **Still Keyframes** (the fallback for turns without video) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- **LTX Simple Image-to-Video** is the recommended planner. It plans one animation-ready first frame and one direct 4 to 8 sentence motion prompt, with one main action, one camera behavior, restrained motion around it and relevant audio or brief dialogue.
- **LTX Director Storyboard** is an advanced option with more detailed, duration-aware direction and continuity rules. Try it once the simple path is stable, or when a longer clip needs more connected phases. Both use the same `%prompt%` contract.
- With animations on, **LTX Simple Image-to-Video** writes both outputs: an `imagePrompt` for Krea and a `narrationBeat` for LTX. **Still Keyframes** is used only for turns without videos.
- **Storyboard First Frame** sends the planner's full natural-language first-frame scene to Krea without a keyframe title, prompt labels, repeated appearance notes or campaign art direction. Keep **Use Storyboard Template** on so it applies.
- **Narration Passthrough** passes the planner's finished `narrationBeat` through the video prompt contract without another scene recap.

Each keyframe makes one Krea image job and one local LTX video job, so three keyframes launch three image renders and three video renders.

## Run the first test

Use a completed GM turn with one obvious visual action, such as opening a door, looking toward a sound or saying one short line.

1. For the quickest low-VRAM check, set **Keyframes per Turn** to 1 and leave **Animation Clip Duration** at 5 seconds.
2. Turn both automatic Storyboard settings on after the GM turn is complete.
3. Open **Chat Settings → Gallery** and select **Create storyboard**. This starts the full illustration-and-animation path without waiting for another turn.
4. If prompt review is on, check the first-frame prompt before you submit it.
5. Check that the first frame is a physically useful starting pose.
6. Wait for the first-frame render, then the ComfyUI clip.
7. When the manual path works, set **Keyframes per Turn** back to 3 and leave both automatic settings on.

Use the **Floating** viewer during setup so you can inspect each image and clip. Switch to **Background** later if you want Storyboard media in the Game scene.

If it did not work, see [Troubleshooting](#troubleshooting).

## How the prompt handoff works

For each keyframe, the Animation Planner returns `imagePrompt` (only the visible first frame at time T=0) and `narrationBeat` (the full LTX prompt for what happens next). **Storyboard First Frame** formats `imagePrompt` and sends it to Krea 2. When the image exists, **Narration Passthrough** resolves to `narrationBeat`. Marinara puts it in the video request's `prompt` field, replaces `%prompt%` in the ComfyUI workflow, uploads the first frame and replaces `%reference_image_name%` with its ComfyUI filename. You do not need two local prompt segments. A single global prompt is the normal path.

## Write a good LTX prompt

The source image already shows appearance, composition, setting, light and style. The video prompt should be about motion:

- One flowing paragraph in the present tense.
- One focused action that fits the clip length.
- Camera movement described relative to the subject.
- Visible reactions through gaze, face, posture, breathing or gesture.
- At most one useful environmental motion.
- Ambient sound, effects, music or short quoted dialogue when relevant.
- A natural ending, a settling motion or a brief hold.

Avoid scene changes, cuts, teleporting, several unrelated actions, complex physics, crowded choreography, exact readable text and repeats of details already visible in the first frame.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Troubleshooting

### ComfyUI returns HTTP 400 or "Prompt outputs failed validation"

The API workflow does not match the installed graph. Look for a deleted node, a dangling node ID, a missing custom node, an input a node update renamed, or a model filename that no longer exists. Export a fresh API workflow from the working graph.

### Images are created but videos are not

Check **Automatic Storyboard Animations** and the Game Mode **Video model**. Animations need both the first-frame illustration and a selected video account.

### LTX receives no starting image

Confirm `%reference_image_name%` appears in the saved API workflow and feeds the LTX Director image segment. Marinara uploads the first frame only when that placeholder is present.

### The clip morphs, changes characters or becomes chaotic

Go back to **LTX Simple Image-to-Video**, use one keyframe and test a turn with one action. One image cannot cleanly become several places, poses and outcomes in a short clip. Check the first frame too: a confusing starting pose makes a harder animation.

### Every generation looks too similar

Replace any hard-coded sampling seed with `%seed%`. Once you get a useful result, fix that seed in the workflow temporarily, only while you compare prompt or sampling changes.

### Generation runs out of memory

Start at 480p. Then reduce the duration. Keep one keyframe per turn while testing, close other GPU applications and do not keep a local language model loaded on the same low-VRAM GPU. A quantized checkpoint lowers model memory but not the memory used by video latents, the text encoder, VAEs, audio and upscaling.

### Marinara stops waiting but ComfyUI continues rendering

Closing the browser request or losing the connection can stop Marinara's polling without cancelling a job already queued in ComfyUI. Check ComfyUI's queue, history and output folder before you start the same render again.

### The workflow works in ComfyUI but fails from Marinara

Compare the saved account JSON with your newest API export. Check the base URL, placeholder spelling, custom nodes, model paths, output node, dimensions and duration fields. The editable graph can work while Marinara still holds an older exported snapshot.

For server traces, turn on debug logging and look for `[debug/game/storyboard-video]` and `[video-gen/comfyui]`. A healthy request shows the completed global prompt, an uploaded reference-image filename, the duration, the frame count and a queued ComfyUI prompt ID.

## Reference: LTX 2.3 models

Choose the model format for your GPU family and the memory left after ComfyUI loads the text encoder, VAEs and upscaler. These are starting points, not promises.

| GPU family | Practical starting point | Notes |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | The low-memory start for 3070, 3080 and 3090-class cards. |
| RTX 40 series, 16 to 24 GB | FP8 input-scaled | Uses the accelerated FP8 path on Ada hardware. |
| RTX 40 series, 8 to 12 GB | INT8 ConvRot when FP8 offloading is too slow | Compare both on your workflow. |
| RTX 50 series (Blackwell) | NVFP4 dev workflow | Needs an NVFP4-capable ComfyUI, CUDA and node stack. |
| RTX 50, existing distilled workflow | FP8 input-scaled | Use this until an official distilled NVFP4 checkpoint exists. |

The tested RTX 3080 workflow uses `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`. These suffixes are different quantized formats and execution paths, not quality presets you can always swap. **Dev** and **distilled** workflows use different sampling assumptions, so do not put a dev checkpoint into the distilled graph without changing the workflow. Fitting the checkpoint does not guarantee a longer or higher-resolution video will fit.

The official beginner workflow uses `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors` and `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`. Custom workflows can use other checkpoints, quantizations, loader nodes or folders. The filenames saved in the API workflow must exactly match the files ComfyUI can see. If you keep models in another folder, such as `LTX2/`, update the loader values and export a fresh API copy.

When you share a workflow, record your GPU model and VRAM, the ComfyUI version, the NVIDIA driver, CUDA, PyTorch and Python versions, the custom nodes and their versions, the model filenames and folders, the resolution, duration, keyframe count and render time, and whether Krea 2 ran locally or hosted.

Official references:

- [LTX 2.3 image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 model card](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 model card](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Official LTX 2.3 ComfyUI examples](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community ComfyUI-separated and FP8 weights](https://huggingface.co/Kijai/LTX2.3_comfy)

## Related guides

- [Storyboard Agent Guide](storyboard.md)
- [ComfyUI Workflow Setup](../media/comfyui.md)
- [Scene Video Generation](../media/scene-video.md)
- [Game Mode: Getting Started](getting-started.md)
