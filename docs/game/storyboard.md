# Storyboard Agent Guide

The downloadable **Storyboard** Agent turns completed story text into ordered keyframe images and, optionally, short image-to-video clips. It supports **Roleplay** and **Game Mode**. Conversation chats do not use Storyboard.

This is the current agent-based workflow. The Storyboard package supplies the planning prompts, defaults, and per-chat controls. Marinara Engine supplies the host integration that generates media, saves it to the Gallery, and displays it in the chat or Game viewer.

## Roleplay and Game Mode at a glance

| | Roleplay | Game Mode |
| --- | --- | --- |
| Story source | Completed user and assistant messages since the previous successful episode | One completed GM narration turn |
| Automatic choices | **Manual only**, **Still images**, or **Animations** | Separate **Automatic Storyboard Illustrations** and **Automatic Storyboard Animations** switches |
| Manual action | **Gallery > Create storyboard** for the latest completed assistant response | **Gallery > Create storyboard** for the latest completed GM turn |
| Display | Inline below the assistant response that ends the episode | Floating viewer or Game background, synchronized to the narration |
| Planning prompts | Episode contract, visual style, optional animation addon, and output contract | Separate still and animation planners |
| Shared final prompts | Illustration image prompt and animation video prompt | Illustration image prompt and animation video prompt |

Both modes save keyframe images to the Gallery's **Images** tab and clips to its **Videos** tab.

## Install the Agent

1. Open the **Agents** panel from the Sparkles icon.
2. Select **Download Agents**.
3. Open **Storyboard** and select **Install**.
4. Open a Roleplay or Game chat, then open **Chat Settings > Agents**.
5. Turn on **Enable Agents**, then turn on **Enable Storyboards** in the Storyboard card.

Installing the package makes it available to compatible chats; it does not silently activate it in every chat. The current package does not require a Marinara restart after installation.

If Storyboard is not listed in Chat Settings, confirm that the package is installed and that the chat is in Roleplay or Game Mode.

## Storyboard Agent settings

Open the **Agents** panel, select **Storyboard**, and open its setup. These values are the defaults for chats that do not have their own overrides.

### Generation and media defaults

| Setting | Default | Purpose |
| --- | --- | --- |
| Agent connection | Your selected Agent connection | Plans the storyboard with an LLM |
| **Image connection** | Use the Game image connection | Generates every keyframe; an image connection is required somewhere in the fallback chain |
| **Video connection** | Use the Game video connection | Generates clips when animations are enabled |
| **Automatic generation** | Still images | Chooses the starting automatic behavior for newly activated chats |
| **Keyframes per turn** | 3, range 1-6 | Sets the target number of ordered frames |
| **Clip seconds** | 6, range 1-15 | Sets the requested duration of each clip |
| **Viewer display** | Floating viewer | Sets the Game Mode viewer default; Roleplay always displays Storyboards inline |
| **Default Roleplay episode interval** | 1, range 1-100 | Sets how much new Roleplay material accumulates between automatic episodes |
| **Attach Card Appearance** | On | Adds matched character appearance details to image prompts |
| **Send Avatar References** | On | Sends matched character and persona avatars when the image provider supports references |
| **Use the final image template** | On | Formats a planned frame before it is sent to the image provider |
| **Use NovelAI character prompts** | On | Uses native per-character prompting on supported official NovelAI V4/V4.5 connections |

### Game prompt library

The Game library supplies two different planning lanes. The active lane is chosen by whether the Game is making stills or clips.

| Setting | Default | Purpose |
| --- | --- | --- |
| **Still planner** | Still Keyframes | Splits one completed GM turn into finished still-image moments |
| **Animation planner** | Comic Page Animation | Creates animation-ready first frames and duration-aware motion directions |

The package also includes NovelAI, comic, colored manga, black-and-white manga, anime episode, and LTX-oriented planners. Planner prompt text is editable in the global Agent setup. The Game chat chooses among the still and animation options under **Chat Settings > Agents > Storyboards**.

### Roleplay prompt library

Roleplay assembles four selected prompts into one planner request.

| Setting | Default | Purpose |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Chooses completed source-supported beats and keeps them in message order |
| **Visual style** | Normal / Anime | Defines the visual treatment of every keyframe |
| **Animation addon** | Simple Storyboard Motion | Adds motion, camera, source dialogue and sound, ambience, and an ending hold only for clips |
| **Output contract** | Roleplay Keyframe JSON | Defines the structured keyframe fields returned by the planner |

Each selector has an editable collection below it. Use **Add option** for a custom prompt, rename it, add a short description, and edit the prompt body. The built-in options can be restored to their package defaults.

### Shared provider formatters

After either mode plans its frames, shared formatters create the final provider requests.

| Setting | Default | Purpose |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | Formats each planned keyframe for the image provider |
| **Default video prompt** | Cinematic Scene Video | Formats the first-frame image and motion plan for the video provider |

The built-in image choices also include **Storyboard Illustration** and **Storyboard First Frame**. Video choices include **Anime Game Video**, **Comic Page Video**, and **LTX Director Video**. Game and Roleplay chats can select different formatters without changing the underlying shared prompt collection.

### Global defaults and chat overrides

Each chat can override the Agent defaults. Chat Settings marks inherited values as **Using agent default** and offers a reset control after you create an override.

Connection precedence differs slightly by mode:

- Roleplay exposes per-chat prompt, image, and video selectors. **Use global default** inherits the Storyboard setup.
- Game Mode uses its Game-specific planning, image, and video connections when they are set, then falls back to the Storyboard Agent defaults.

An image connection is required for stills. Animations require both a successful keyframe image and a video connection.

## Roleplay Storyboards

Roleplay Storyboards group completed exchanges into a visual episode and render that episode below the assistant response that finishes it.

### Quick start

1. Install Storyboard and activate it for the Roleplay chat.
2. In **Chat Settings > Agents > Storyboards**, select a **Prompt connection** and **Image connection**, or leave them on **Use global default** when the global setup is complete.
3. Choose an **Automatic mode**:
   - **Manual only**: no automatic episode; **Create storyboard** makes a still episode on demand.
   - **Still images**: automatically makes an illustrated episode.
   - **Animations**: automatically makes keyframe images and a clip for each frame; a video connection is required.
4. Set **Messages per episode** and **Keyframes per episode**.
5. Finish a new assistant response, or open the Gallery and select **Create storyboard**.

Use the arrows on a multi-keyframe Storyboard to move between frames. An animated frame shows its playable clip inline and falls back to its image while the clip is pending or unavailable.

### How the episode interval works

The interval controls how many new user and assistant messages accumulate between successful automatic Storyboards. Both message roles advance the interval, and the episode includes the new messages in chronological order.

The default is 1, so the next newly completed assistant response can produce an episode immediately. A larger value lets more dialogue and action accumulate. The source is bounded to the most recent 20 messages and 12,000 characters so an old or very long chat cannot create an unbounded planning request.

The cadence anchor advances only after a complete or partial Storyboard is saved. A failed episode does not consume the source material. Opening an existing chat does not backfill old responses; automatic generation waits for a newly completed assistant response.

### Roleplay prompt chain

Roleplay uses four planning layers before the shared provider formatters:

1. **Episode contract** selects completed, source-supported story beats and anchors them to the supplied messages.
2. **Visual style** chooses Normal/Anime, NovelAI, Comic, Colored Manga, or B&W Manga treatment.
3. **Animation addon** is added only for animated Storyboards. It describes one achievable action, camera behavior, source-supported dialogue and sound, ambience, and an ending hold.
4. **Output contract** defines the structured keyframe result returned by the planner.

The **Storyboard Illustration Prompt** then formats each planned first frame for the image provider. When clips are enabled, the **Storyboard Video Prompt** formats the motion plan for the video provider.

The Roleplay prompt library is separate from the Game planner library. Editing a Roleplay visual style does not rewrite Game Mode's still or animation planners.

### Storyboard and Illustrator together

Storyboard is a separate Agent from Illustrator. Manual Illustrator actions and other Illustrator media remain available. When Roleplay Storyboard is set to **Still images** or **Animations**, Marinara suppresses the ordinary automatic foreground Illustrator image for that completed response so the two Agents do not generate competing post-response media. **Manual only** leaves the normal Illustrator path unchanged.

## Game Mode Storyboards

Game Mode Storyboard uses exactly one completed GM narration turn as its story source. It strips hidden GM command tags, plans ordered frames, and anchors each frame to a range of readable turn sections. The viewer changes frames as the reader moves through those sections.

### Quick start

1. Install Storyboard.
2. Create or open a Game Mode chat.
3. Open **Chat Settings > Agents**, turn on **Enable Agents**, then turn on **Enable Storyboards**.
4. Confirm that the Game has an image connection or that the global Storyboard setup supplies one.
5. Finish a GM narration turn.
6. Open the **Gallery** and select **Create storyboard**.

Select **View storyboard** in the Gallery to reopen a dismissed Game viewer. Manual generation uses the current animation setting: when **Automatic Storyboard Animations** is on, the manual Storyboard also requests clips.

### Automatic Game Storyboards

The Storyboard card has two automation switches:

- **Automatic Storyboard Illustrations** creates still keyframes after a completed GM turn.
- **Automatic Storyboard Animations** also creates a clip for every keyframe. Turning animations on enables illustrations; turning illustrations off disables animations.

Automatic generation does not run unless the Storyboard Agent is active for that Game. It also does not recreate a Storyboard for a turn that already has one. Use the manual Gallery action when you intentionally want another Storyboard for the latest turn.

If **Expose image prompts before sending** is enabled under Generation settings, a manual Game Storyboard can show the compiled image prompts for review. Automatic Storyboards continue without a review window so they do not pause gameplay.

### Game settings

Open **Chat Settings > Agents > Storyboards**.

| Setting | Agent default | What it controls |
| --- | --- | --- |
| **Enable Storyboards** | Off per chat | Activates the installed Agent for this Game |
| **Automatic Storyboard Illustrations** | Derived from Automatic generation | Still keyframes after each finished GM turn |
| **Automatic Storyboard Animations** | Derived from Automatic generation | MP4 clips for every keyframe |
| **Keyframes per Turn** | 3, range 1-6 | Target number of frames; short turns may produce fewer |
| **Animation Clip Duration** | 6 seconds, range 1-15 | Requested duration for each clip; a provider may clamp it |
| **Viewer Display** | Floating | Draggable viewer or full Game background |
| **Still Planner** | Still Keyframes | Plans completed still illustrations |
| **Animation Planner** | Comic Page Animation | Plans animation-ready first frames and motion directions |
| **Use Storyboard Template** | On | Applies the selected final illustration formatter |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formats the planned frame for the image provider |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formats the first frame and motion plan for the video provider |

The package also supplies NovelAI, comic, manga, anime, and LTX-oriented planners. Selecting an animation planner does not enable video generation by itself; **Automatic Storyboard Animations** and a video connection are still required.

### Game prompt chain

Game Mode keeps separate planners for still and animated results:

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

The planner chooses and orders the story beats. The illustration prompt is a provider-facing formatter, not another story planner. When animations are enabled, the animation planner produces both an exact first-frame description and a motion direction; the video prompt turns that motion direction into the final request.

### Revised Game Mode recipes

These recipes pair a package-applied Storyboard chain with the remaining Game and provider settings. Apply the named chain when your package exposes it, or reproduce the listed selections manually.

#### Google Comic Storyboards

Package-applied chain:

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Game checklist:

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- Keep the setup-generated art style.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

This creates ordinary still Storyboards. The saved Comic Page animation chain becomes active only if you later select a video connection and turn on **Automatic Storyboard Animations**.

#### NovelAI Direct Tags

Package-applied chain:

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: create a custom option whose prompt contains only:

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Leave the Animation Planner and Storyboard Video Prompt unchanged.

Game checklist:

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Remove the prose **Style Text** from the Danbooru profile.
- Tune the positive, negative, and illustration tags as needed.

The custom pass-through template sends the planner's compact NovelAI tags without wrapping them in the normal prose illustration formatter.

#### Local Krea 2 + LTX 2.3

Package-applied chain:

- **Illustration Planner**: Still Keyframes as the still-only fallback
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: LTX Director Video
- **Use Storyboard Template**: On

For an 8 GB VRAM GPU, start with one keyframe at 480p. After that completes successfully, move toward three keyframes and higher resolutions. See [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md) for the ComfyUI connection, placeholders, and full test procedure.

### Storyboard Optimized presentation is not the Agent switch

The Game setup wizard's **Storyboard Optimized** presentation changes the GM narration prompt so turns contain stronger filmable visual anchors. It does not install or activate Storyboard, enable automatic media, or choose image and video connections.

You can use the Storyboard Agent with either Standard or Storyboard Optimized presentation. Install and activate the Agent separately.

### Game viewer

**Floating viewer** is a draggable, resizable panel above the Game. It follows the reader's position in the GM narration and shows the corresponding frame. A video plays when ready and otherwise falls back to the frame image.

**Game background** places the active frame behind the Game controls. This replaces the normal generated scene background while the mode is active, so the ordinary **Generate background** action is unavailable. Background clips play once and remain on their final frame; Game controls provide replay, play/pause, and mute actions.

Closing the floating viewer hides it for the current turn. Use **Gallery > View storyboard** to reopen it.

## Image prompting and character consistency

The selected planner and final image prompt do different jobs:

- The planner decides which moments to show and writes the visual content of each frame.
- The final image template adds the provider-facing structure, matched character appearance, reference handling, location context, campaign art direction, and image instructions.

When a planner already returns the exact prompt syntax the image provider should receive, use a pass-through template such as `${scenePrompt}`. Turn off **Use the final image template** only when you intentionally want to bypass the selected formatter instead. Required image instructions still apply.

For steadier characters:

- Keep character-card Appearance fields specific and current.
- Keep **Attach Card Appearance** on unless the selected planner already repeats all needed appearance details.
- Keep **Send Avatar References** on when the provider accepts references and the avatars match the intended look.
- Prefer a small, clearly visible cast per frame. Storyboard includes only matched visible character and persona references rather than every character in the chat.

**Use NovelAI character prompts** only changes requests sent through supported official NovelAI V4/V4.5 connections. Other providers use the shared prompt path even when the switch is on.

## Cost and performance

Every keyframe is a separate image job. Animated Storyboards add one video job per successful keyframe. A three-frame animated Storyboard can therefore make three image requests and three video requests.

Start with still images and one keyframe when validating a new provider or local workflow. Increase the frame count, clip duration, and automatic cadence only after the basic path is reliable.

## Existing Games from the older Storyboard system

Storyboard is now a downloadable Agent, but existing Game chats may still contain explicit settings created by the older Engine-native Storyboard UI. Marinara preserves those values as per-chat overrides when the package is installed; it does not discard a working Game setup.

This means an older Game can behave differently from the current Agent defaults. Open **Chat Settings > Agents > Storyboards** and use each reset control when you want that field to inherit the Storyboard Agent default again.

The older settings are migration data, not a second Storyboard implementation. Current generation still requires the Storyboard package to be installed and active for the Game.

## Troubleshooting

### Storyboard is missing from Chat Settings

- Install **Storyboard** from **Agents > Download Agents**.
- Use a Roleplay or Game chat; Conversation is not supported.
- Confirm the package version is compatible with the installed Engine version.

### Create storyboard is available but generation fails

- Turn on **Enable Agents** and **Enable Storyboards** for the chat.
- Select a valid image-generation connection in the Roleplay Storyboard card, Game settings, or global Storyboard setup.
- Wait for the assistant or GM response to finish before trying again.

### Roleplay did not create an automatic episode

- Choose **Still images** or **Animations**, not **Manual only**.
- Wait for a newly completed assistant response. Opening a chat does not backfill old messages.
- Check **Messages per episode**. The successful cadence anchor must accumulate enough new user and assistant messages.
- A failed run does not advance the anchor, so inspect the server log for the original provider or parsing error.

### Images appear but videos do not

- In Roleplay, choose **Animations**. In Game Mode, turn on **Automatic Storyboard Animations**.
- Select a Video Generation connection.
- Confirm the video connection supports image-to-video input.
- Check the Gallery's **Videos** tab. A clip may finish after its keyframe image.
- If planning fell back after an LLM failure, Marinara can preserve fallback images while skipping videos for that run.

### A Storyboard is partial or stuck

One or more provider jobs may have failed, timed out, or hit a rate or content limit. Increase `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` in `.env` when the provider is healthy but slow, then restart Marinara because these values are read at startup.

Enable Debug mode and search the server log for `storyboard` to inspect the planner, compiled image prompt, reference selection, and video prompt. Debug logs can contain private chat text and prompts; sanitize them before sharing.

## Related guides

- [Agents Overview](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Image Generation Providers](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
- [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md)
