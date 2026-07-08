# Storyboard Engine Guide

The storyboard engine turns one completed Game Mode GM turn into a short sequence of manga-style keyframes. Use it when you want a turn to read like a mini cutscene: the viewer follows the current story section, shows the matching panel, and can play an MP4 clip for each panel when storyboard animations are enabled.

This guide covers the user workflow. For provider setup details, see [Scene Video Generation](SCENE_VIDEO_GENERATION.md).

## What Storyboards Create

A storyboard is attached to a specific completed GM narration turn. Marinara uses that narration as the source, splits it into 2-6 ordered keyframes, then anchors each keyframe to the reader sections in the turn.

Each keyframe can have:

- a title and short narration beat,
- a section range and anchor quote from the GM text,
- a still-image prompt written by the selected storyboard prompt preset,
- a character list for identity continuity.

When animations are enabled, Marinara builds a separate `game.video` prompt from each saved keyframe image. The storyboard director no longer needs to write per-keyframe video prompts for the normal animation path.

Keyframe images are saved in the Gallery's **Images** tab. Keyframe clips are saved as scene videos and appear in the Gallery's **Videos** tab. The storyboard metadata stays attached to the Game Mode turn so the floating viewer can follow the text while you read.

## Quick Start

1. Open or create a Game Mode chat.
2. Make sure image generation is available:
   - New game: enable **Visual Generation** in the setup wizard and select an **Image Generation Connection**.
   - Existing game: open **Chat Settings -> Agents -> Illustrator**, enable **Game Illustrator** and **Automatic Visuals**, and select an **Image Connection**.
   - Toggle Send Avatar References to get consistency between generations. This sends the avatar image of the character. 
   - Storyboard images require a strong state-of-the-art image model, or something equivalent to Google Nano Banana 2 Lite.
3. Optional: set up animated clips:
   - Create a **Video Generation** connection in **Settings -> Connections**.
   - Select it in the setup wizard's **Video Generation Connection** field, or in **Chat Settings -> Agents -> Scene Videos -> Video Connection**.
4. Optional: open **Chat Settings -> Agents -> Storyboards** and choose the **Illustration Prompt** and **Animation Prompt** styles for this chat. Open **Chat Settings -> Agents -> Scene Videos** to choose the **Game Video Prompt** used when keyframes are animated.
5. Play until the GM finishes a narration turn. If you enabled **Automatic Storyboard Illustrations**, the storyboard starts once the turn finishes streaming; otherwise create one manually in the next step.
6. Open **Gallery** and click **Create storyboard**.
7. Keep reading. The floating storyboard viewer appears and changes panels/illustrations/animations as you read through the turn.

If you close the floating viewer, reopen it from the storyboard card in **Gallery -> View storyboard**.

## Manual vs Automatic

**Gallery -> Create storyboard** creates a storyboard for the latest completed GM narration only when you ask for it, or refreshes/re-illustrates the current turn. It requires the Game Illustrator image connection. It can be used even when automatic storyboards are off.

Automatic generation is controlled per chat:

- **Automatic Storyboard Illustrations** creates still keyframe images after each completed GM turn. This is the lower-cost path.
- **Automatic Storyboard Animations** adds MP4 clips for each keyframe. It requires storyboard illustrations plus a Video Generation connection. Turning animations on also enables illustrations; turning illustrations off disables animations.
- **Illustration Prompt** controls manual storyboards and automatic storyboards that only create still keyframes. The default **Still Keyframes** preset avoids comic panels, speech bubbles, captions, and SFX text so the floating viewer does not reveal later beats before you read them.
- **Animation Prompt** controls storyboards when **Automatic Storyboard Animations** is enabled. The default **Comic Page** preset allows panel flow, dialogue bubbles, captions, and SFX because the generated images become source frames for clips.
- **Edit Storyboard Presets** lets you copy a built-in preset into a chat-local editable template. Built-ins are read-only; custom copies are stored on that chat and can be selected for either prompt slot.

Find these switches in either place:

- New game: setup wizard -> **Visual Generation** -> **Storyboards**.
- Existing game: **Chat Settings -> Agents -> Storyboards**.

Use automatic illustrations when you want every turn to get a visual panel sequence. Add automatic animations only when you are comfortable with multiple video-generation calls per completed GM turn (currently this is expensive).

Built-in storyboard prompt presets are **Still Keyframes**, **Comic Page**, **Colored Manga**, and **B&W Manga**. They are separate from Roleplay Illustrator prompt presets and from the global game prompt entries in Settings -> Generations -> Prompt Overrides.

Storyboard animations combine two prompt layers. The Storyboards card chooses how Marinara plans and renders the keyframe image. The Scene Videos card's **Game Video Prompt** chooses how Marinara animates that saved image into motion.

## What Happens Under the Hood

When a storyboard starts, Marinara:

1. Takes the selected completed GM message and strips GM command tags.
2. Sends the GM narration, game context, reader section indices, target keyframe count, aspect ratio, and clip duration to a Prompt Director.
3. Chooses the chat's storyboard prompt preset: **Illustration Prompt** for still-only storyboards, or **Animation Prompt** when storyboard animations are requested.
4. Saves the storyboard plan, then starts keyframe media generation.
5. Renders keyframe images through the Game Illustrator image connection.
6. If animations are enabled and a video connection is selected, builds the selected **Game Video Prompt** from each saved keyframe image, like the Gallery **Animate illustration** action, then renders each keyframe clip from that generated image as the first frame/reference.

The default plan targets 4 keyframes, 16:9 output, and 6-second clips when videos are generated. Very short turns may produce fewer frames, but the engine keeps storyboards between 2 and 6 keyframes.

## Using the Viewer

The floating storyboard viewer is tied to the current turn's sections, not simply to the newest Gallery item. As you read through the GM turn, it chooses the keyframe whose section range matches your current position.

The viewer:

- plays the keyframe video when it is ready,
- falls back to the keyframe image while video is pending or failed,
- can be dragged and resized,
- includes close, size, play/pause, mute/unmute, and frame-position controls,
- can be reopened from **Gallery** after being closed.

Generated storyboard images and videos also remain normal Gallery assets. You can preview, download, pin, or copy prompts from the Gallery workflow.

## Getting Better Results

Storyboards are only as clear as the turn they receive and the selected storyboard prompt preset. The best source turns have concrete character positions, visible actions, setting details, and emotional beats. A turn that says "the fight continues" gives the Prompt Director less to work with than a turn that names who moves, what changes, and where the camera-worthy moment is.

For more consistent boards:

- Keep the game's setting, tone, and art style specific during setup.
- **Use character cards with detailed avatars and reference images enabled to get consistency**
- Keep important outfits, wounds, props, and locations explicit in the narration or game state.
- Use image style profiles for the visual finish you want.
- Use **Still Keyframes** for normal reading, **Comic Page** when clips are enabled, or a custom copy when a specific chat needs a stronger manga/comic style.

For common tuning, use **Chat Settings -> Agents -> Storyboards** first:

| Control | What it changes |
| --- | --- |
| **Illustration Prompt** | The storyboard director template used for manual and still-only storyboards. |
| **Animation Prompt** | The storyboard director template used when storyboard animations are requested. |
| **Edit Storyboard Presets** | Chat-local custom copies of built-in storyboard presets. |
| **Scene Videos -> Game Video Prompt** | The video-template layer used to animate generated scene illustrations and storyboard keyframes. |

For global media-template tuning, open **Settings -> Generations -> Prompt Overrides**. The most relevant keys are:

| Key | What it changes |
| --- | --- |
| `game.sceneIllustration` | How each keyframe image prompt is compiled for the image provider. |
| `game.video` | Fallback video template if a selected chat Game Video Prompt cannot be rendered. Normal video prompt style selection lives in Chat Settings. |
| `game.storyboardIllustrationDirector` | Fallback storyboard director template if a selected chat storyboard preset cannot be rendered. Normal storyboard style selection lives in Chat Settings. |

Keep storyboard and video templates concise. Providers with smaller prompt limits, especially xAI Imagine, reject overly long video prompts.

## Cost and Performance

A storyboard usually creates about 4 image jobs. With animations enabled, it also creates about 4 video jobs. These jobs can run concurrently, so provider rate limits or slow queues may show up as partial storyboards.

A practical starting point:

- Use manual **Create storyboard** until you know the output and cost profile.
- Enable **Automatic Storyboard Illustrations** if you want every GM turn to get a visual recap.
- Enable **Automatic Storyboard Animations** only for chats where video cost and wait time are acceptable.

If a provider is slow, raise `IMAGE_GEN_TIMEOUT_MS` for keyframe images or `VIDEO_GEN_TIMEOUT_MS` for clips in `.env`, then restart Marinara. Provider polling is controlled by `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS`, `XAI_VIDEO_POLL_INTERVAL_MS`, or `OPENROUTER_VIDEO_POLL_INTERVAL_MS`.

## Troubleshooting

### "Choose an Illustrator image connection in Game Settings first"

Enable **Game Illustrator** and select an **Image Connection** under **Chat Settings -> Agents -> Illustrator**. For a new game, enable **Visual Generation** and choose an **Image Generation Connection** in the setup wizard. Automatic storyboard options are also in the setup wizard. 

### Storyboard images appear, but videos do not

Storyboard videos need both **Automatic Storyboard Animations** and a selected **Video Generation** connection. If animations are off, manual and automatic storyboards create still keyframes only.

### Automatic storyboards do not run

Check that **Automatic Storyboard Illustrations** or **Automatic Storyboard Animations** is enabled, the Game Illustrator image connection is selected, and the GM turn has finished streaming. Marinara also avoids duplicating a storyboard that already exists for the same turn and swipe, but it can be manually recreated in gallery and clicking create storyboard.


### The storyboard is partial or stuck rendering

Partial storyboards usually mean one or more image/video provider jobs failed (content prohibited?), timed out, or hit rate limits. Increase `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` for slow providers, and use `LOG_PRESET=prompt-connections` or `LOG_LEVEL=debug` to inspect `[debug/game/storyboard-director]` and `[debug/game/storyboard-video]` logs.
