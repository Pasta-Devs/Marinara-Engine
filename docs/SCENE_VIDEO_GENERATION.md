# Scene Video Generation

Marinara can turn Game Mode and Roleplay gallery illustrations into short MP4 scene videos. Gallery video generation is manual: generate or upload an illustration, then use the Gallery **Video** action or an illustration's **Animate** button to create a clip from that specific image.

Game Mode can also storyboard completed GM turns. A Prompt Director turns one GM narration into ordered keyframes, Marinara renders each keyframe as a gallery illustration, and each keyframe can be animated into a short clip so the sequence plays like a cutscene alongside the text. For the step-by-step user workflow, see the [Storyboard Engine Guide](STORYBOARD_ENGINE_GUIDE.md).

Scene videos are separate from normal image generation. They use a **Video Generation** connection, save MP4 files in the scene-video media store, appear in the Gallery, and can be pinned or followed with the same overlay controls as generated illustrations.

## Setup

1. Open **Settings -> Connections**.
2. Create or edit a connection with provider **Video Generation**.
3. Pick a video service:
   - **Google AI Studio** supports Gemini Omni and Veo models. Gemini Omni uses `gemini-omni-flash-preview` by default through Google AI Studio's Gemini API. Veo uses `veo-3.1-generate-preview` by default through the Gemini API long-running video endpoint, and character/call loop references are sent as both the first and last frame so Veo can interpolate back to the avatar pose.
   - **xAI Imagine** uses `grok-imagine-video-1.5` by default through the xAI Videos API.
   - **OpenRouter Video** uses `google/veo-3.1` by default through OpenRouter's asynchronous Videos API. You can type any OpenRouter video-capable model ID supported by your account.
   - **Seedance 2.0** uses `seedance-2-0` by default through the Seedance API. Seedance reference-image jobs require provider-fetchable HTTPS image URLs.
4. Enter the provider API key and save the connection.
5. Optional: enable **Use as default video connection** so new/manual scene-video requests can fall back to this connection when the chat has no explicit video connection selected.

Video generation connections have their own defaults. Gemini Omni exposes duration and aspect ratio; duration is rendered into the prompt because Gemini Omni does not currently accept `duration_seconds` in `generation_config.video_config`. Google Veo, xAI, and OpenRouter expose duration, aspect ratio, and resolution. Veo accepts 4, 6, or 8 seconds, and Marinara uses 8 seconds when an image reference is present because Veo requires that for first/last-frame interpolation.

Seedance first/last-frame references need public HTTPS URLs. If your Marinara server is publicly reachable, set `VIDEO_REFERENCE_PUBLIC_BASE_URL`. If you are running locally, edit the Seedance Video Generation connection and turn on **Upload Seedance reference frames temporarily** under **Default for Videos**. This uploads local reference frames to temporary public links so Seedance can fetch them.

Default values:

| Service | Duration | Aspect ratio | Resolution |
| --- | --- | --- | --- |
| Google AI Studio Gemini Omni | 10s | 16:9 | Provider default |
| Google AI Studio Veo | 8s | 16:9 | 720p |
| xAI Imagine | 10s | 16:9 | 720p |
| OpenRouter Video | 10s | 16:9 | 720p |
| Seedance 2.0 | 5s | 16:9 | 720p |

## Chat Settings

Video connections are selected separately from image-generation connections.

- **Game Mode setup wizard:** choose **Video Generation Connection** on the model/setup step when creating the game.
- **Existing Game Mode chats:** open **Chat Settings -> Agents -> Scene Videos** and choose **Video Connection**.
- **Roleplay chats:** open **Chat Settings -> Agents -> Scene Videos** and choose **Video Connection**.

If a chat does not have a selected video connection, Marinara tries the connection marked **Default for Videos** in Connections. If neither exists, Gallery video actions show a connection warning.

Game Mode has separate storyboard controls under **Chat Settings -> Agents -> Storyboards**. **Automatic Storyboard Illustrations** creates keyframe images after each completed GM narration. **Automatic Storyboard Animations** also creates MP4 clips for those keyframes and requires a Video Generation connection. The **Illustration Prompt** selector controls still-only/manual storyboard style; the **Animation Prompt** selector controls storyboard style when clips are requested. The **Game Video Prompt** selector in **Chat Settings -> Agents -> Scene Videos** controls how saved scene/storyboard images are animated. When automation is disabled, use the manual **Create storyboard** control in **Gallery**.

## Gallery Workflow

The Gallery separates still images and generated videos into **Images** and **Videos** tabs, with counts for each tab. The top actions shown for a mode still apply to the active chat:

- **Illustrate** generates a still scene illustration.
- **Video** animates the latest generated scene illustration.
- **Background** generates or applies a scene background.

Each illustration tile has actions ordered as Pin, Download, Animate, and Copy prompt. The fullscreen preview offers Pin, Download, and Copy prompt in the prompt panel below the image; use the tile's **Animate** button when you want to animate that exact illustration instead of the newest gallery item. Copy prompt copies the prompt that created the gallery item.

Generated videos:

- appear under **Videos** in the Gallery,
- open in a fullscreen preview when clicked,
- show their generation prompt below the video,
- include a **Copy prompt** button,
- can be downloaded,
- can be pinned to the chat surface,
- participate in **View latest**.

## Game Mode Turn Storyboards

Storyboards are per completed GM turn. Marinara uses the GM turn narration.

The storyboard flow is:

1. The Prompt Director reads the completed turn narration plus stable reader-section indices.
2. It creates 2-6 ordered keyframes, usually 4, using the chat's selected storyboard prompt preset.
3. Each keyframe contains a still-image prompt, section anchors, character context, and duration/aspect-ratio settings.
4. Marinara saves the storyboard metadata, then starts keyframe media generation concurrently once the prompts are ready.
5. Keyframe illustrations are saved to the Gallery's **Images** tab. When animations are enabled, Marinara builds the video prompt from each saved keyframe image with the selected **Game Video Prompt** used by Gallery **Animate illustration**, then saves keyframe clips to scene videos in the **Videos** tab.

The Game Mode **Gallery** panel has a **Create storyboard** button for manual generation. Manual storyboards create still keyframe illustrations by default using the chat's **Illustration Prompt** selection; they also create clips using the **Animation Prompt** selection plus the Scene Videos **Game Video Prompt** when **Automatic Storyboard Animations** is enabled and a Video Generation connection is selected. After a storyboard exists, gallery also shows its keyframes and a button to reopen the floating storyboard viewer by clicking on **View storyboard**.

The floating storyboard viewer follows the current story section while you read and click through a turn. It shows the active keyframe clip when available, falls back to the generated keyframe image while video is pending or failed, and includes close, drag, resize, play/pause, mute/unmute, size, and frame-position controls.

## View Latest And Pinning

**View latest** is a live viewer for the newest Gallery media item. When enabled, it updates automatically whenever a new illustration or scene video is added to the Gallery.

Pinned videos use the same move and resize model as pinned illustrations. Drag the pinned media to reposition it and use the overlay controls to resize, unpin, or close it. The static illustration remains available as a fallback when a video is pending or fails.

The Game Mode storyboard viewer uses the same viewer control model as **View latest**, but it is anchored to the current turn's storyboard keyframes instead of the newest Gallery item and changes as you progress through the game turn.

## Prompt Templates

Storyboard and video prompt style are selected per chat:

- **Chat Settings -> Agents -> Storyboards -> Illustration Prompt** is used for manual and still-only storyboards. The default **Still Keyframes** preset avoids comic text and panels.
- **Chat Settings -> Agents -> Storyboards -> Animation Prompt** is used when storyboard animations are requested. The default **Comic Page** preset allows comic panels, dialogue bubbles, captions, and SFX because those keyframes become clip source images.
- **Chat Settings -> Agents -> Storyboards -> Edit Storyboard Presets** copies built-ins such as **Still Keyframes**, **Comic Page**, **Colored Manga**, and **B&W Manga** into chat-local editable templates.
- **Chat Settings -> Agents -> Scene Videos -> Game Video Prompt** is used for Game scene videos and storyboard clips. The default **Cinematic Scene Video** preset turns the saved first-frame image into motion.
- **Chat Settings -> Agents -> Scene Videos -> Edit Video Presets** copies the built-in video prompt into chat-local editable templates.

Open **Settings -> Generations -> Video Generation Prompt Templates** and **Prompt Overrides** to edit the reusable global templates used by scene media.

The relevant keys are:

| Key | Purpose |
| --- | --- |
| `game.narrationSummarizer` | Converts completed Game Mode narration into a concise illustration request before scene illustration prompting. |
| `game.sceneIllustration` | Builds the still game scene/keyframe illustration prompt. |
| `game.video` | Fallback video template if a selected per-chat Game Video Prompt cannot be rendered. |
| `game.storyboardIllustrationDirector` | Fallback storyboard director template if a selected per-chat storyboard preset cannot be rendered. |

The selected **Game Video Prompt** receives variables such as scene title, narration summary, source illustration prompt, characters, setting, art style, duration seconds, aspect ratio, and a reminder that the source illustration is used as the first frame/reference. Editing this chat-local prompt is the main way to prompt-engineer different motion outcomes without changing code.

The selected storyboard prompt receives the game context, stripped GM narration, reader section indices, target keyframe count, duration, and aspect ratio. Automatic storyboard animations reuse the saved keyframe image as the first-frame/reference image and build the motion prompt through `game.video`, matching the manual Gallery animation flow.

Before rendering the template, Marinara compacts the video prompt context. The narration variable is a short visible story beat, not the full assistant message, and the illustration prompt variable is a filtered excerpt that drops common still-image boilerplate. xAI receives a stricter final prompt budget than Gemini Omni, Google Veo, and OpenRouter because its video API rejects prompts over its maximum length.

The same video prompt layer is used for Gemini Omni, Google Veo, xAI, and OpenRouter scene videos today. Existing saved `game.omniVideo` overrides are still read as a legacy fallback only when the chat-selected Game Video Prompt cannot be rendered and the global `game.video` fallback is used.

## Storage And Safety

Scene videos are stored as MP4 files under Marinara's local data directory, separate from `chat_images`. Metadata records the chat, provider, model, prompt, source image, duration, aspect ratio, file path, and creation time.

Game Mode storyboards store their own metadata and keyframe records. Keyframe image/video media still uses the existing Gallery and scene-video stores, so generated storyboard assets are visible outside the floating storyboard viewer.

Video providers are called server-side. Provider responses are validated as MP4 before being saved, and remote video downloads are constrained to HTTPS.

## Troubleshooting

### "Choose a Video Generation connection"

Open **Chat Settings -> Agents -> Scene Videos** for a Game Mode chat and for Roleplay chats, then select a Video Generation connection. If the dropdown is empty, create one in **Settings -> Connections**.

### "Generate a scene illustration before generating a scene video"

Use **Illustrate** first, or upload a gallery image, or click **Animate** on an existing gallery illustration.

### Gemini Omni rejects `duration_seconds`

This is expected provider behavior. Marinara does not send `duration_seconds` to Gemini Omni's `video_config`; duration is rendered into the prompt instead.

### Storyboards do not generate automatically

Automatic storyboards are opt-in. Open **Chat Settings -> Agents -> Storyboards** and enable **Automatic Storyboard Illustrations** or **Automatic Storyboard Animations**. Manual **Storyboard turn** generation in **Gallery** still works when the automatic toggles are off.

### Storyboard keyframes are images but not videos

Storyboard image generation uses the Game Mode image-generation connection. Storyboard video generation also needs **Automatic Storyboard Animations** plus a Video Generation connection. **Automatic Storyboard Animations** can only be toggled on if Automatic Storyboard Illustrations are also on, because it depends on those for keyframes. The **Animation Prompt** selector changes storyboard image style for video-enabled runs, and **Game Video Prompt** changes how those saved images move, but neither selector generates clips by itself. If animations are off, or no video connection is selected and no default video connection exists, Marinara can still save keyframe images, but clips cannot be generated.

### Storyboard generation times out

The Prompt Director has its own request window, then each keyframe image/video render runs as media generation work. Keyframes start concurrently after the prompts are ready, so several provider jobs may be active at once. If a provider is slow or rate-limited, increase the relevant timeout (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, or provider-specific polling settings) and check debug logs for `[debug/game/storyboard-director]` and `[debug/game/storyboard-video]`.

### Animated Storyboard generation takes a while to load

The process to create animated storyboards is first the regular GM turn needs to complete. Then the storyboard illustration director creates still keyframe prompts. Image keyframes are created for each section of the game turn, saved to the Gallery, and animated through the same video prompt path as Gallery **Animate illustration**. It is a lot of prompts and API calls.

### Veo, xAI, or OpenRouter video requests take a while

Google Veo, xAI, and OpenRouter start video jobs and then poll for completion. Veo's default polling interval is controlled by `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS`, xAI's by `XAI_VIDEO_POLL_INTERVAL_MS`, and OpenRouter's by `OPENROUTER_VIDEO_POLL_INTERVAL_MS`. The overall timeout is controlled by `VIDEO_GEN_TIMEOUT_MS`.

### xAI rejects a long prompt

xAI has a smaller video prompt limit than Gemini Omni, Google Veo, and OpenRouter. Marinara automatically summarizes narration, excerpts the source illustration prompt, and caps the final rendered prompt for xAI requests. If you heavily customize `game.video`, keep the template concise so provider-specific safety room remains available.
