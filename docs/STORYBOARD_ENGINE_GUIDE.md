# Storyboard Engine Guide

The storyboard engine turns one completed Game Mode GM turn into a short sequence of manga-style keyframes. Use it when you want a turn to read like a mini cutscene: the viewer follows the current story section, shows the matching panel, and can play an MP4 clip for each panel when storyboard animations are enabled.

This guide covers the user workflow. For provider setup details, see [Scene Video Generation](SCENE_VIDEO_GENERATION.md).

## What Storyboards Create

A storyboard is attached to a specific completed GM narration turn. Marinara uses that narration as the source, splits it into 2-6 ordered keyframes, then anchors each keyframe to the reader sections in the turn.

Each keyframe can have:

- a title and short narration beat,
- a section range and anchor quote from the GM text,
- a still-image prompt for the manga panel,
- character and continuity notes,
- optionally, a video prompt for an animated clip.

Keyframe images are saved in the Gallery's **Images** tab. Keyframe clips are saved as scene videos and appear in the Gallery's **Videos** tab. The storyboard metadata stays attached to the Game Mode turn so the floating viewer can follow the text while you read.

## Quick Start

1. Open or create a Game Mode chat.
2. Make sure image generation is available:
   - New game: enable **Visual Generation** in the setup wizard and select an **Image Generation Connection**.
   - Existing game: open **Chat Settings -> Agents -> Illustrator**, enable **Game Illustrator** and **Automatic Visuals**, and select an **Image Connection**.
   - Toggle Send Avatar References to get consistency between generations. This sends the avatar image of the character. 
3. Optional: set up animated clips:
   - Create a **Video Generation** connection in **Settings -> Connections**.
   - Select it in the setup wizard's **Video Generation Connection** field, or in **Chat Settings -> Agents -> Scene Videos -> Video Connection**.
4. Play until the GM finishes a narration turn. If you enabled **Automatic Storyboard Illustrations**, the storyboard starts once the turn finishes streaming; otherwise create one manually in the next step.
5. Open **Gallery** and click **Create Storyboard**.
6. Keep reading. The floating storyboard viewer appears and changes panels/illustrations/animations as you read through the turn.

If you close the floating viewer, reopen it from the storyboard card in **Gallery -> View storyboard**.

## Manual vs Automatic

**Gallery -> Create Storyboard** creates a storyboard for the latest completed GM narration only when you ask for it, or refreshes/re-illustrates the current turn. It requires the Game Illustrator image connection. It can be used even when automatic storyboards are off.

Automatic generation is controlled per chat:

- **Automatic Storyboard Illustrations** creates manga keyframe images after each completed GM turn. This is the lower-cost path.
- **Automatic Storyboard Animations** adds MP4 clips for each keyframe. It requires storyboard illustrations plus a Video Generation connection. Turning animations on also enables illustrations; turning illustrations off disables animations.

Find these switches in either place:

- New game: setup wizard -> **Visual Generation** -> **Storyboards**.
- Existing game: **Chat Settings -> Agents -> Storyboards**.

Use automatic illustrations when you want every turn to get a visual panel sequence. Add automatic animations only when you are comfortable with multiple video-generation calls per completed GM turn (currently this is expensive).

## What Happens Under the Hood

When a storyboard starts, Marinara:

1. Takes the selected completed GM message and strips GM command tags.
2. Sends the GM narration, game context, reader section indices, target keyframe count, aspect ratio, and clip duration to a Prompt Director.
3. Uses `game.storyboardIllustrationDirector` to plan still comic-page keyframes.
4. Saves the storyboard plan, then starts keyframe media generation.
5. Renders keyframe images through the Game Illustrator image connection.
6. If animations are enabled and a video connection is selected, builds a `game.video` prompt from each saved keyframe image, like the Gallery **Animate illustration** action, then renders each keyframe clip from that generated image as the first frame/reference.

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

Storyboards are only as clear as the turn they receive and the Game Storyboard Illustration Director or Game Storyboard Director prompts strength. The best source turns have concrete character positions, visible actions, setting details, and emotional beats. A turn that says "the fight continues" gives the Prompt Director less to work with than a turn that names who moves, what changes, and where the camera-worthy moment is.

For more consistent boards:

- Keep the game's setting, tone, and art style specific during setup.
- **Use character cards with detailed avatars and reference images enabled to get consistency**
- Keep important outfits, wounds, props, and locations explicit in the narration or game state.
- Use image style profiles for the visual finish you want.

For advanced tuning, open **Settings -> Advanced -> Game Prompt Templates and Prompt Overrides**. The most relevant keys are:

| Key | What it changes |
| --- | --- |
| `game.storyboardIllustrationDirector` | How storyboards split GM narration into still keyframes. |
| `game.storyboardDirector` | Legacy/full storyboard director for workflows that need director-written per-keyframe video prompts. |
| `game.sceneIllustration` | How each keyframe image prompt is compiled for the image provider. |
| `game.video` | How scene-video and storyboard animation prompts are compiled from the saved keyframe image for the video provider. |

Keep storyboard and video templates concise. Providers with smaller prompt limits, especially xAI Imagine, reject overly long video prompts.

## Cost and Performance

A storyboard usually creates about 4 image jobs. With animations enabled, it also creates about 4 video jobs. These jobs can run concurrently, so provider rate limits or slow queues may show up as partial storyboards.

A practical starting point:

- Use manual **Create Storyboard** until you know the output and cost profile.
- Enable **Automatic Storyboard Illustrations** if you want every GM turn to get a visual recap.
- Enable **Automatic Storyboard Animations** only for chats where video cost and wait time are acceptable.

If a provider is slow, raise `IMAGE_GEN_TIMEOUT_MS` for keyframe images or `VIDEO_GEN_TIMEOUT_MS` for clips in `.env`, then restart Marinara. xAI polling is controlled by `XAI_VIDEO_POLL_INTERVAL_MS`.

## Troubleshooting

### "Choose an Illustrator image connection in Game Settings first"

Enable **Game Illustrator** and select an **Image Connection** under **Chat Settings -> Agents -> Illustrator**. For a new game, enable **Visual Generation** and choose an **Image Generation Connection** in the setup wizard. Automatic storyboard options are also in the setup wizard. 

### Storyboard images appear, but videos do not

Storyboard videos need both **Automatic Storyboard Animations** and a selected **Video Generation** connection. If animations are off, manual and automatic storyboards create still keyframes only.

### Automatic storyboards do not run

Check that **Automatic Storyboard Illustrations** or **Automatic Storyboard Animations** is enabled, the Game Illustrator image connection is selected, and the GM turn has finished streaming. Marinara also avoids duplicating a storyboard that already exists for the same turn and swipe, but it can be manually recreated in gallery and clicking create storyboard.


### The storyboard is partial or stuck rendering

Partial storyboards usually mean one or more image/video provider jobs failed (content prohibited?), timed out, or hit rate limits. Increase `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` for slow providers, and use `LOG_PRESET=prompt-connections` or `LOG_LEVEL=debug` to inspect `[debug/game/storyboard-director]` and `[debug/game/storyboard-video]` logs.
