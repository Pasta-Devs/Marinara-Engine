# Scene Video Generation

This guide explains how Marinara Engine turns a scene illustration into a short MP4 video clip. It covers the video providers, how to generate a clip from the Gallery, the Game Mode controls, and the video settings. A scene video is a brief animated clip made from one still image.

## What scene video does

A scene video takes an existing gallery image and animates it into a short MP4 clip. The still image becomes the first frame, and the AI adds motion. Scene videos work in **Roleplay** and **Game Mode** chats.

You always need a picture first. Scene video generation cannot run from text alone. You must generate or upload a gallery image before you can animate it.

Scene videos use a separate connection type called **Video Generation**. They are not the same as normal image generation. The finished clips are saved with the chat and shown in the Gallery, where you can pin, download, or view them.

## Video Generation connections

To make scene videos, you first add a connection that can generate video. This uses the same Connections panel as your chat and image connections.

1. Open **Settings**, then open **Connections**.
2. Click **Add Connection**.
3. Set the provider type to **Video Generation**.
4. Under **Video Service**, pick one of the four services below.
5. Enter the API key for that service. An API key is a secret token that proves your account to the provider.
6. Pick a model, or keep the default model the service fills in.
7. Save the connection.

The **Video Service** picker offers four choices. Each one fills in a default web address and a default model:

| Video Service        | Default model               | Notes                                                                        |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Runs Gemini Omni and Veo video models through the Gemini API.                |
| **xAI Imagine**      | `grok-imagine-video-1.5`    | Grok Imagine video through the xAI Videos API.                               |
| **OpenRouter Video** | `google/veo-3.1`            | Video models through OpenRouter. You can type any OpenRouter video model ID. |
| **Seedance 2.0**     | `seedance-2-0`              | Text, first-frame, and first and last frame video modes.                     |

**Google AI Studio** covers two model families. **Gemini Omni** uses `gemini-omni-flash-preview`. **Google Veo** uses `veo-3.1-generate-preview`. Which one runs depends on the model you pick in the connection.

There is no local or self-hosted option for video. Every video service needs an online account and an API key.

### Make it the default video connection

The connection editor for a Video Generation connection shows a **Default for Videos** group. Turn on **Use as default video connection** so Marinara can use this connection when a chat has no video connection of its own. Only mark one connection as the default video connection.

### Connection video defaults

A Video Generation connection has its own **Video Generation Defaults** panel in the connection editor. Here you set the default clip length, aspect ratio, and resolution for that connection. These per-connection defaults take priority over the app-wide fallback length.

| Service          | Default length | Length range | Aspect ratio | Resolution       |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10s            | 1 to 60s     | 16:9         | Provider default |
| Google Veo       | 8s             | 4, 6, or 8s  | 16:9         | 720p             |
| xAI Imagine      | 10s            | 1 to 15s     | 16:9         | 720p             |
| OpenRouter Video | 10s            | 1 to 60s     | 16:9         | 720p             |
| Seedance 2.0     | 5s             | 4 to 15s     | 16:9         | 720p             |

Gemini Omni has no resolution field, and its length is written into the prompt text instead of a separate setting. Google Veo forces 8 seconds whenever it animates a reference image, because it needs 8 seconds to blend the first and last frames.

### Seedance reference frames

Seedance must fetch your reference image over a public web link before it can animate it. A local Marinara server has no public link, so plain local setups need one extra step.

Open the Seedance connection and turn on **Upload Seedance reference frames temporarily**. This uploads the reference frame to a temporary public link so Seedance can read it. You can pick how long that link lasts under **Temporary link lifetime**, which defaults to 12 hours.

If your Marinara server already has a public web address, you can set an environment variable instead of using temporary uploads. See the [Server Configuration Reference](../CONFIGURATION.md) for the video reference setting.

## Choosing a provider

All four services make short clips from your image. They differ in speed, clip length, and how they handle reference images.

- **Google AI Studio (Gemini Omni)**: flexible length up to 60 seconds. Length is baked into the prompt, not a separate control.
- **Google AI Studio (Veo)**: strong quality, but fixed to 4, 6, or 8 seconds. It uses 8 seconds when it animates an image.
- **xAI Imagine**: 1 to 15 second clips. It uses a shorter prompt limit than the other services.
- **OpenRouter Video**: 1 to 60 seconds, and lets you type any video model your OpenRouter account supports.
- **Seedance 2.0**: 4 to 15 second clips with first-frame and first and last frame modes. It needs a public link to your reference image.

Expect video jobs to take a while. The provider starts the job, then Marinara waits and checks until the clip is ready. This can take several minutes per clip, longer than a still image.

## Generate a video from the Gallery

Both **Roleplay** and **Game Mode** chats can make scene videos from the **Gallery** panel. Open it from the chat's image or gallery icon. Game Mode chats also have a second place to do this, the **Game Assets** panel, covered later in this guide.

The Gallery has an **Images** tab and a **Videos** tab, each with a count. Still pictures live under **Images**. Finished clips live under **Videos**.

To animate the newest picture:

1. Make sure at least one picture exists under the **Images** tab. Use **Illustrate** or upload a picture first.
2. Click **Video** in the action row at the top of the Gallery.
3. If **Expose media prompts before sending** is enabled under **Settings**, **Generations**, **Image Generation**, review or edit the compiled animation prompt and click **Generate**. Canceling this window does not start a provider request.
4. The button changes to **Generating...**, and a banner tells you video generation is running.
5. When it finishes, the clip appears under the **Videos** tab.

To animate one specific picture instead of the newest one:

1. Open the **Images** tab.
2. Hover over the picture you want.
3. Click the **Animate illustration** button (the film icon) in the hover controls.

The same **Review Video Prompt** window appears for **Animate illustration** when prompt review is enabled. It shows the exact server-compiled prompt, duration, aspect ratio, and resolution that will be used for that selected image. Your edit applies only to that generation and does not replace the reusable Game Video Prompt template.

Under the **Videos** tab, each clip plays inline and shows its length and model name. You can pin a clip with **Pin video to chat**, or save it with **Download scene video**. If there are no clips yet, the tab reads **No videos yet**.

If you try to make a video with no picture in the chat, Marinara shows this message: "Add or generate a gallery image before generating a scene video." Generate or upload a picture first, then try again.

## Game Mode scene video

Game Mode has a second place to make a scene video: the **Game Assets** panel. Open it with the **Game Assets** button in the game controls.

1. Open the **Game Assets** panel.
2. Click **Generate video**. Its tooltip reads "Generate a scene video from the latest illustration."
3. The newest clip plays in the panel when it is ready.

The **Generate video** button stays inactive until the game has both a video connection and a scene illustration. If you click it too early, you may see one of these messages:

- "Choose a Video Generation connection in Game Settings first." Set a video connection for the game.
- "Generate a scene illustration before generating a scene video." Make a picture first.

If a clip fails, the panel shows "Scene video generation failed." Try again, and check your connection and API key if it keeps failing.

## Choosing a video connection for a chat

Each chat picks its own video connection. You set this under **Chat Settings**, then **Agents**, then **Scene Videos**.

**Roleplay** chats show a **Scene Videos** card described as "Generate manual MP4 scene videos from gallery images." It has one control, the **Video Connection** dropdown. Pick your Video Generation connection here.

**Game Mode** chats show a **Scene Videos** card described as "Generate MP4 scene videos from game illustrations." It has more controls:

- **Video Connection**: the Video Generation connection this game uses.
- **Game Video Prompt**: the prompt template that decides how the picture animates. The built-in default is **Cinematic Scene Video**.
- **Edit Video Presets**: add and edit your own copies of the video prompt template for this chat.

The **Game Video Prompt** continues to control manual Gallery and Game Assets videos. Storyboard keyframe clips can choose a different **Storyboard Video Prompt** in **Chat Settings**, **Agents**, then **Storyboards**. If no separate storyboard choice is set, they inherit the Game Video Prompt.

When you first create a Game Mode chat, the setup wizard also has a **Video Generation Connection** picker. It is on the **Features** step, and it appears after you turn on **Visual Generation**.

If a chat has no video connection of its own, Marinara falls back to the connection you marked **Use as default video connection**. If there is no chat connection and no default, video actions show a warning telling you to pick one.

## Video generation settings

Some video defaults live in the app settings, not on a connection. Open **Settings**, then **Generations**, then the **Video Generation** section. It is described as "Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls."

The main scene-video setting here is **Scene video fallback length**, which defaults to 10 seconds. It is used only when the selected video connection has no length of its own. You can set it from 1 to 60 seconds.

This section also holds **Video Generation Prompt Overrides**, where you can edit the reusable video prompt templates. This is the advanced way to change how clips move without editing any code.

The same section has an **Animated expression length** setting. That belongs to a separate feature, animated portrait sprites. See [Animated Expressions](animated-expressions.md) for that feature.

## Storyboards

Game Mode can also build a storyboard, which is an ordered set of keyframe pictures for one game turn. When storyboard animations are turned on, Marinara animates each keyframe into a clip using your video connection and the **Storyboard Video Prompt**. It inherits the **Game Video Prompt** unless you choose a separate template. A keyframe is one still frame in that ordered set.

Storyboards have their own controls and their own guide. See [Game Mode Storyboards](../game/storyboard.md) for the full setup and workflow.

## Troubleshooting

### "Choose a Video Generation connection"

Your chat has no video connection selected. Open **Chat Settings**, then **Agents**, then **Scene Videos**, and pick a connection. If the dropdown is empty, add one under **Settings**, then **Connections**.

### "Add or generate a gallery image before generating a scene video"

Scene video always animates an existing picture. Use **Illustrate**, upload a picture, or click **Animate illustration** on a picture you already have.

### The video takes a long time

This is normal. The provider starts the job, and Marinara waits and checks until the clip is ready. Veo, xAI, OpenRouter, and Seedance all work this way, and a clip can take several minutes.

### Seedance fails to read the reference image

Seedance needs a public link to your picture. On a local server, open the Seedance connection and turn on **Upload Seedance reference frames temporarily**. See the Seedance section above.

### A video request keeps failing

Check that the connection has a valid API key and that your account has video access. Open the connection under **Settings**, then **Connections**, and confirm the key and model. Server-side timeouts for video are covered in the [Server Configuration Reference](../CONFIGURATION.md).

## Related guides

- [Animated Expressions](animated-expressions.md)
- [Game Mode Storyboards](../game/storyboard.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Server Configuration Reference](../CONFIGURATION.md)
