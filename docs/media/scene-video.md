# Scene Video Generation

A scene video is a short MP4 clip of the scene. It can animate a Gallery picture, with the picture as the first frame and the AI adding motion. In Roleplay it can also be made from the story alone. This guide shows how to set up a video service, make clips from the Gallery and Game Mode, and change the video settings.

Scene videos work in Roleplay and Game Mode chats. Conversation chats send video messages instead. See [Video messages](../conversation/selfies.md#video-messages).

Game Mode and **Animate illustration** always start from a picture, so generate or upload one first. In Roleplay, `/video` and the Gallery's **Video** button follow Illustrator's **First frame** setting. With no First frame chosen, they need no picture.

Scene videos use a separate kind of account, **Video Generation**, not normal image generation. Finished clips are saved with the chat and shown in the Gallery, where you can pin, download or view them.

## Set up a video service

1. Click **Connections** in the top bar, then **Add**. The **Add account** window opens.
2. Choose a service from the **Images & video** section. The services are listed below.
3. Paste the API key for a cloud service. Local ComfyUI needs none. SwarmUI needs a Swarm Auth Token only if your server requires an account.
4. Click **Connect**, then pick a model or keep the default. NanoGPT has no default, so pick one from its list. For ComfyUI, leave the model unset unless the workflow uses `%model%`. For SwarmUI the model is optional.
5. Open the video model and click **Test video** to check it.

Each service fills in a default address and, where it applies, a default model. NanoGPT has no default model, so pick one.

| Video service | Default model | Notes |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Runs Gemini Omni and Veo models through the Gemini API. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Grok Imagine video through the xAI Videos API. |
| **OpenRouter Video** | `google/veo-3.1` | You can type any OpenRouter video model ID. |
| **NanoGPT** | none, pick one | Video models through NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Hosted text-to-video and image-to-video models. |
| **Seedance 2.0** | `seedance-2-0` | Text, first-frame, and first and last frame modes. |
| **ComfyUI** | set by the workflow | Local WAN and other video workflows in API format. |
| **SwarmUI** | set by the workflow | ComfyUI video workflows through your SwarmUI server. |

**Google AI Studio** covers two families. **Gemini Omni** uses `gemini-omni-flash-preview`. **Google Veo** uses `veo-3.1-generate-preview`. The model you pick decides which runs.

For **ComfyUI**, use `http://127.0.0.1:8188` and paste an API-format video workflow into **ComfyUI workflow (required)**. It is required. See [ComfyUI Workflow Setup](comfyui.md#comfyui-video-workflows) for placeholders and output nodes.

For **SwarmUI**, Marinara fills in `http://127.0.0.1:7801`. Paste an API-format video workflow into **ComfyUI workflow (required)**. It is required. SwarmUI cannot use the `%reference_image_name%` placeholders, so use `%reference_image%`. If your server requires an account, paste a Swarm Auth Token into **API key**.

### Make it the default video model

To use a video model when a chat has none of its own, set the **Video** job under **Defaults** at the top of the **Connections** panel. Chat Settings shows it as **Default video provider**. Without a chat model and without a default, video actions warn you to pick one.

### Video prompting instructions

Each video model has a **Video prompting instructions** box. Tell the AI that writes your video prompts what your video model expects, such as camera moves, prompt length or sound. It guides Roleplay Gallery animations, Conversation video messages and Storyboard's **Image-aware shot planning**. If the AI copies a whole sentence of it into the prompt, Marinara removes that sentence. Game Mode scene videos, call clips and animated expressions write their prompts separately and ignore it.

### Video defaults per model

A video model has a **Video defaults** panel for default clip length, aspect ratio and resolution. They win over the app-wide fallback length.

Default length, range, aspect ratio and resolution for each service:

- Gemini Omni: 10s, 1 to 60s, 16:9, provider-default resolution.
- Google Veo: 8s, 4, 6 or 8s, 16:9, 720p.
- xAI Imagine: 10s, 1 to 15s, 16:9, 720p.
- OpenRouter Video: 10s, 1 to 60s, 16:9, 720p.
- Atlas Cloud: 8s, 1 to 60s, 16:9, 720p.
- Seedance 2.0: 5s, 4 to 15s, 16:9, 720p.
- ComfyUI and SwarmUI: 5s, 1 to 60s, 16:9, 720p.

Gemini Omni has no resolution field, and its length goes into the prompt text. Google Veo forces 8 seconds whenever it animates a reference image, because it needs 8 seconds to blend the first and last frames.

### Seedance reference frames

Seedance must fetch your reference image over a public web link. A local Marinara server has none, so plain local setups need one extra step.

1. Open the Seedance model.
2. Turn on **Upload Seedance reference frames temporarily**. The frame goes to a temporary public link.
3. Optional: set **Temporary link lifetime**. The default is 12 hours.

If your Marinara server already has a public address, you can set an environment variable instead. See the [Server Configuration Reference](../CONFIGURATION.md).

## Make a video from the Gallery

Roleplay and Game Mode chats can make scene videos from the Gallery. Open **Chat Settings** and expand **Gallery**. The Gallery has an **Images** tab and a **Videos** tab, each with a count.

### In Roleplay

**Video** in the action row at the top of the Gallery makes a clip of the latest reply, the same as `/video`. Add a description after `/video` to say what the clip should show.

- **First frame**: follows Illustrator's **First frame** setting. That is a new Illustrator picture of the latest reply (drawn first, then animated), the character's avatar or sprite, or no picture. With none chosen, the clip is made from the story alone.
- **Avatar**: the clip starts from whoever your description names first, including your persona. A part of a name no one else shares is enough, with a capital ("Lena" for "Dr. Lena Kowalski"). With no one named, it starts from the chat's character.
- **Review**: with **Expose media prompts before sending** on, you can review and edit the clip's prompt first.
- **Context**: the AI reads as many recent messages as Illustrator does for a picture (Illustrator's **Context Size**, under **Agent Budget** on its setup screen).
- **No picture**: when the clip starts from no picture or an avatar, the AI describes the scene itself. Its instructions are **Roleplay Clip Director**, under **Settings → Generations → Video Generation Prompt Overrides**.

The finished clip plays inline under the latest reply, even when the picture came from an earlier one. Clips do not open in a floating window on their own. To float one, use **Pin video to chat** under **Videos**. Remove a clip from a message with its **X** button. It stays in the Gallery.

### In Game Mode

1. Make sure at least one picture is under **Images**. Use **Illustrate** or upload one.
2. Click **Video** in the action row at the top of the Gallery.
3. If **Expose media prompts before sending** is on (**Settings → Generations → Overall Generations**), review or edit the prompt and click **Generate**. Canceling does not start a request.
4. The button shows **Generating...** and a banner says video generation is running.
5. When it finishes, the clip appears under **Videos**.

If there is no picture, Marinara says "Add or generate a gallery image before generating a scene video." Make or upload one and try again.

### Animate one picture

1. Open the **Images** tab.
2. Hover over the picture.
3. Click **Animate illustration** (the film icon).

With prompt review on, a window shows the exact compiled prompt, duration, aspect ratio and resolution for that picture. Your edit applies only to that clip. In Roleplay, the AI planning the motion reads as many recent messages as Illustrator does, ending at the reply the picture belongs to. Its reusable instructions are **Roleplay Gallery Animation Director** under **Settings → Generations → Video Generation Prompt Overrides**.

Each clip under **Videos** plays inline with its length and model name. Use **Pin video to chat** or **Download scene video**. With no clips, the tab reads **No videos yet**.

## Choose a service

All eight services make short clips from your image.

- **Google AI Studio (Gemini Omni)**: length up to 60 seconds, written into the prompt.
- **Google AI Studio (Veo)**: strong quality, fixed at 4, 6 or 8 seconds. It uses 8 when it animates an image.
- **xAI Imagine**: 1 to 15 seconds, with a shorter prompt limit than the others.
- **OpenRouter Video**: 1 to 60 seconds, with any video model your account supports.
- **NanoGPT**: 1 to 60 seconds, no default model.
- **Atlas Cloud**: loads Atlas Cloud's current video catalog, image-to-video models first, each with its starting price per second of output. If it cannot, Marinara shows Veo 3.1 and Seedance 2.0 starter models. You can type an exact model ID. Model limits still apply.
- **Seedance 2.0**: 4 to 15 seconds, with first-frame and first-and-last-frame modes. It needs a public link to your reference image.
- **ComfyUI**: local, through your API-format workflow. Marinara uploads the reference image directly when the workflow uses `%reference_image_name%`.
- **SwarmUI**: local, through your workflow and SwarmUI server. The reference image goes in through `%reference_image%`.

Video jobs are slow. The service starts the job, and Marinara waits and checks until the clip is ready. A clip can take several minutes. Large local WAN models may need more than the 30-minute default. Raise `VIDEO_GEN_TIMEOUT_MS` and restart Marinara.

### Atlas Cloud model differences

Atlas Cloud models do not all accept the same settings. Before each request, Marinara reads the model's published input schema from `static.atlascloud.ai` and fits your defaults to it.

- The source picture goes in the image field that model uses.
- Clip length moves to the nearest length the model offers. A model limited to 5 or 10 seconds turns an 8-second default into 10.
- Resolution moves to the nearest tier the model offers. Models that take a pixel size get the closest `width*height` for your aspect ratio and resolution.
- A setting the model lacks is left out, so the model's default applies.

The server log lists every changed value on a line starting `[video-gen/atlas-cloud] fitted request`. If the schema cannot be read, Marinara sends the same general request as before.

Pick an image-to-video model for scene videos. A text-to-video model has no image field. It ignores your picture and makes an unrelated clip from the prompt, and the server log says so. **Test video** sends a plain gradient as the first frame when the model needs an image, so image-to-video models can pass the test.

Many Atlas Cloud models have inputs of their own, such as `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` or LoRA lists.

1. Open the Atlas Cloud model and pick or type a model.
2. Expand **Video defaults**, then **Atlas Cloud setup**.
3. Find **Model options** under the length, aspect ratio and resolution controls.

The top of **Model options** lists the lengths, resolutions, frame sizes and aspect ratios the model accepts. A text-to-video model also shows a warning. Each option uses Atlas Cloud's own name and description, and starts on **Model default**, with the default in brackets. An option left on **Model default** is not sent. Change one to send your value with every video from this model, including **Test video**. List and object inputs, such as LoRAs, take JSON.

Choices are saved per model. **Reset model options** clears them for the current model. Click **Save** to keep your changes. If a saved option no longer fits the model, Marinara leaves it out and names it in the log line.

## Make a video in Game Assets

Game Mode has a second place to make a scene video, **Game Assets**. Click its folder button, near the top right of the chat. It opens as a window on a computer and a full-width panel on a phone. If you moved it into Chat Settings, open the **Game Assets** section there.

1. Open **Game Assets**.
2. Click **Generate video** ("Generate a scene video from the latest illustration").
3. The newest clip plays there when ready.

**Generate video** stays inactive until the game has both a video model and a scene illustration. If you click too early you may see "Choose a Video Generation connection in Game Settings first." (set a video model for the game) or "Generate a scene illustration before generating a scene video." If a clip fails, the panel shows "Scene video generation failed." Try again, and check your key if it keeps failing.

## Choose a video model for a chat

Each chat picks its own video model under **Chat Settings → Agents → Scene Videos**.

- **Roleplay** shows a **Scene Videos** card ("Generate manual MP4 scene videos from gallery images"). It has one control, the video model list.
- **Game Mode** shows a **Scene Videos** card ("Generate MP4 scene videos from game illustrations") with more controls. The video model list picks the model. **Game Video Prompt** is the template that decides how the picture animates. The built-in default is **Cinematic Scene Video**. **Edit Video Prompt Presets** adds and edits your own copies for this chat.

**Game Video Prompt** controls manual Gallery and Game Assets videos in Game Mode. Roleplay Gallery animations use **Roleplay Gallery Animation Director** instead. The Storyboard Agent has its own default **Storyboard Video Prompt**. Each chat can override it under **Chat Settings → Agents → Storyboards**. Resetting returns to the Storyboard Agent default.

When you create a Game Mode chat, the setup wizard has a video model picker on the **Features** step, after you turn on visual generation.

## Video generation settings

Some video defaults are app-wide. Open **Settings → Generations** and find **Video Generation** ("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls").

- **Scene video fallback length**: used only when the selected video model has no length of its own. The default is 10 seconds. The range is 1 to 60.
- **Video Generation Prompt Overrides**: edit the reusable video prompt templates. **Roleplay Gallery Animation Director** sets the instructions sent to the Prompt Model before a Roleplay Gallery clip. Its `${durationSeconds}` variable becomes the clip length.
- **Videos per reply**: how many video messages Conversation characters can send in one reply, and how many clips Illustrator adds to one Roleplay reply. The default is 3. The range is 1 to 10. Each Conversation character sends at most one. It exists for group chats and for asking for several videos at once. Raise it to let more characters send a clip. Lower it to save requests. Clips past the limit are skipped. `/video` and the Gallery's **Video** button do not count.
- **Animated expression length** belongs to animated portrait sprites. See [Animated Expressions](animated-expressions.md).

## Storyboards

The downloadable Storyboard Agent builds ordered keyframe images and clips in Roleplay and Game Mode. When animations are on, Marinara animates each successful keyframe with the selected video model and the agent's **Storyboard Video Prompt**. See the [Storyboard Agent Guide](../game/storyboard.md).

## Troubleshooting

### "Choose a Video Generation connection"

Your chat has no video model. Open **Chat Settings → Agents → Scene Videos** and pick one. If the list is empty, add one under **Connections**.

### "Add or generate a gallery image before generating a scene video"

Game Mode and **Animate illustration** need an existing picture. Roleplay can make a clip from the story alone when no first frame is chosen. Use **Illustrate**, upload a picture, or click **Animate illustration** on one you have.

### The video takes a long time

This is normal. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud and Seedance all start a job and Marinara waits for it. A clip can take several minutes.

### Seedance fails to read the reference image

Seedance needs a public link to your picture. On a local server, turn on **Upload Seedance reference frames temporarily** on the Seedance model. See [Seedance reference frames](#seedance-reference-frames).

### A video request keeps failing

Check that the account has a valid API key and video access. Open the account in **Connections** and confirm the key and model. For server timeouts see the [Server Configuration Reference](../CONFIGURATION.md).

## Related guides

- [Animated Expressions](animated-expressions.md)
- [Storyboard Agent Guide](../game/storyboard.md)
- [LTX 2.3 Storyboards in Game Mode](../game/ltx-2-3-storyboards.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Server Configuration Reference](../CONFIGURATION.md)
