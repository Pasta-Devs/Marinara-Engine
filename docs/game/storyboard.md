# Storyboard Agent Guide

The downloadable **Storyboard** agent turns completed story text into ordered keyframe images and, optionally, short image-to-video clips. It works in Game Mode and Roleplay. Conversation chats do not use it.

The Storyboard package supplies the planning prompts, defaults and per-chat controls. Marinara supplies the media generation, saves results to the Gallery and shows them in the chat or Game viewer. This guide covers Game Mode first. The Roleplay workflow follows in [Roleplay Storyboards](#roleplay-storyboards). For the rest of Roleplay, see [Roleplay Mode: Getting Started](../roleplay/getting-started.md).

- **Game Mode** uses one completed GM narration turn. It has separate **Automatic Storyboard Illustrations** and **Automatic Storyboard Animations** switches, and **Gallery → Create storyboard** for the latest GM turn. It shows in a floating viewer or as the Game background, synced to the narration, and uses separate still and animation planners.
- **Roleplay** uses completed messages since the last successful episode. Its automatic choices are **Manual only**, **Still images** or **Animations**, and **Gallery → Create storyboard** works on the latest completed assistant response. It shows inline below the response that ends the episode, and uses an episode contract, visual style, optional animation addon and output contract.

Both modes save keyframe images to the Gallery's **Images** tab and clips to its **Videos** tab.

## Install the agent

1. Open the **Agents** panel (the Sparkles icon).
2. Select **Agent Organizer**.
3. Open **Storyboard** and select **Install**.
4. Open a Game or Roleplay chat, then open **Chat Settings → Agents**.
5. Turn on **Enable Agents**, then turn on **Enable Storyboards** in the Storyboard card.

Installing makes the agent available but does not turn it on in every chat. No Marinara restart is needed.

If it did not work, and Storyboard is missing from Chat Settings, check that the package is installed, the chat is Game or Roleplay, and the package version works with your Marinara version.

## Game Mode Storyboards

Game Mode Storyboard uses exactly one completed GM narration turn as its story source. It strips hidden GM command tags, plans ordered frames and anchors each frame to a range of readable turn sections. The viewer changes frames as the reader moves through those sections.

### Make a Game Storyboard

**Before you start:** the game needs an image account (the Game's own, or one from the global Storyboard setup). See [Image Generation Providers](../media/image-providers.md).

1. Install Storyboard and open a Game Mode chat.
2. Open **Chat Settings → Agents**, turn on **Enable Agents**, then **Enable Storyboards**.
3. Finish a GM narration turn.
4. Open **Chat Settings → Gallery** and select **Create storyboard**.

Select **View storyboard** in the Gallery to reopen a dismissed viewer. Manual generation follows the current animation setting: when **Automatic Storyboard Animations** is on, a manual Storyboard also requests clips.

If it did not work, see [Troubleshooting](#troubleshooting).

### Automatic Game Storyboards

The Storyboard card has two switches:

- **Automatic Storyboard Illustrations** creates still keyframes after a completed GM turn.
- **Automatic Storyboard Animations** also creates a clip for every keyframe. Turning animations on turns illustrations on, and turning illustrations off turns animations off.

Automatic generation runs only while the agent is active for that game, and does not recreate a Storyboard for a turn that already has one. Use the manual Gallery action when you want another for the latest turn.

If **Expose media prompts before sending** is on in Generation settings, a manual Game Storyboard can show its compiled image prompts for review. Automatic Storyboards skip the review so gameplay does not pause.

### Game settings

Open **Chat Settings → Agents → Storyboards**.

| Setting | Agent default | What it controls |
| --- | --- | --- |
| **Enable Storyboards** | Off per chat | Turns the installed agent on for this game. |
| **Automatic Storyboard Illustrations** | From Automatic generation | Still keyframes after each GM turn. |
| **Automatic Storyboard Animations** | From Automatic generation | MP4 clips for every keyframe. |
| **Keyframes per Turn** | 3 (1 to 200) | Target number of frames. Short turns may produce fewer. |
| **Animation Clip Duration** | 5 seconds (1 to 15) | Requested length of each clip. A service may clamp it. |
| **Viewer Display** | Floating | Draggable viewer, or full Game background. |
| **Illustration Planner** | Still Keyframes | Plans completed still illustrations. |
| **Animation Planner** | Comic Page Animation | Plans animation-ready first frames and motion directions. |
| **Use Storyboard Template** | On | Applies the selected final illustration formatter. |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formats the planned frame for the image service. |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formats the first frame and motion plan for the video service. |

The package also supplies NovelAI, comic, manga, anime and LTX-oriented planners. Choosing an animation planner does not turn video on by itself. **Automatic Storyboard Animations** and a video account are still required.

Each chat can override the agent defaults. Chat Settings marks inherited values as **Using agent default** and offers a reset control once you override one.

### How a Game Storyboard is built

Game Mode keeps separate planners for stills and animations.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

The planner chooses and orders the story beats. The illustration prompt is a formatter for the service, not another planner. With animations on, the animation planner produces an exact first-frame description and a motion direction, and the video prompt turns the motion direction into the final request.

### Game viewer

- **Floating viewer** is a draggable, resizable panel above the game. It follows the reader's position in the narration and shows the matching frame. A video plays when ready and otherwise shows the frame image. Closing it hides it for the current turn. Use **Gallery → View storyboard** to reopen it.
- **Game background** puts the active frame behind the rest of the screen. It replaces the generated scene background while on, so **Generate background** is unavailable. Background clips play once and stay on their final frame.

For replay, play/pause and mute, open **Game controls** (the game controller button, near the top right of the chat). It opens as a window on a computer or a panel on a phone. If you moved it into Chat Settings, open the **Game controls** section there.

### Storyboard Optimized is not the agent switch

The wizard's **Storyboard Optimized** presentation changes the GM narration prompt so turns contain stronger filmable visual anchors. It does not install or turn on Storyboard, turn on automatic media or choose image and video accounts. You can use the agent with either **Standard** or **Storyboard Optimized**. Install and turn on the agent separately.

### Game Mode recipes

Each recipe pairs a Storyboard chain with the other Game and service settings. Apply the named chain if your package offers it, or choose the listed options by hand.

#### Google Comic Storyboards

Chain: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Game checklist:

- **Illustrator**: On (wizard Features step)
- Image account: Google/Nano Banana, **Image Style**: Default, and keep the setup-generated art style
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- Video account: None

This makes ordinary still Storyboards. The saved Comic Page animation chain applies only if you later pick a video account and turn on **Automatic Storyboard Animations**.

#### NovelAI Direct Tags

Chain: **Illustration Planner** NovelAI Keyframes. For **Storyboard Illustration Prompt**, create a custom option whose prompt contains only the text below. Set **Use Storyboard Template** to On. Leave the Animation Planner and Video Prompt unchanged.

```text
${scenePrompt}
```

Game checklist:

- **Image Style**: Danbooru, and remove the prose **Style text** from the Danbooru profile
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Tune the positive, negative and illustration tags as needed

The pass-through template sends the planner's compact NovelAI tags without wrapping them in the normal prose formatter.

#### Local Krea 2 + LTX 2.3

Chain: **Illustration Planner** Still Keyframes as the still-only fallback, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

On an 8 GB VRAM GPU, start with one keyframe at 480p. After it works, move toward three keyframes and higher sizes. For the ComfyUI account, placeholders and full test, see [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md).

## Roleplay Storyboards

Roleplay Storyboards group completed exchanges into a visual episode shown below the assistant response that finishes it.

### Make a Roleplay Storyboard

1. Install Storyboard and turn it on for the Roleplay chat.
2. In **Chat Settings → Agents → Storyboards**, pick a **Prompt connection** and **Image model**, or leave them on **Use global default** when the global setup is complete.
3. Choose an **Automatic mode**:
   - **Manual only**: no automatic episode. **Create storyboard** makes a still episode on demand.
   - **Still images**: automatically makes an illustrated episode.
   - **Animations**: automatically makes keyframe images and a clip for each frame. A video account is required.
4. Set **Messages per episode** and **Keyframes per episode**.
5. Finish a new assistant response, or open **Chat Settings → Gallery** and select **Create storyboard**.

Use the arrows on a multi-keyframe Storyboard to move between frames. An animated frame shows its clip inline and falls back to its image while the clip is pending or unavailable.

### How the episode interval works

The interval is how many new user and assistant messages must accumulate between successful automatic Storyboards. Both roles count, and the episode includes the new messages in order. The default is 1, so the next completed assistant response can make an episode at once. A larger value lets more dialogue and action build up. The source is limited to the latest 20 messages and 12,000 characters, so a long chat cannot make an unbounded planning request.

The counter moves forward only after a complete or partial Storyboard is saved, so a failed episode does not use up the source. Opening an existing chat does not backfill old responses. Automatic generation waits for a newly completed assistant response.

### Roleplay prompt library

Roleplay builds one planner request from four selected prompts:

| Setting | Default | Purpose |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Picks source-supported beats and keeps them in message order. |
| **Visual style** | Normal / Anime | The look of every keyframe. Others: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** | Simple Storyboard Motion | Used only for clips. Adds one achievable action, camera behavior, source dialogue and sound, ambience and an ending hold. |
| **Output contract** | Roleplay Keyframe JSON | The structured keyframe fields the planner returns. |

The **Storyboard Illustration Prompt** then formats each first frame for the image service, and with clips on, the **Storyboard Video Prompt** formats the motion plan. Open the collapsed **Prompt library** in Stage 1 to edit these. Use **Add option** for a custom prompt, then rename it, add a short description and edit the body. You can restore built-in options to their defaults. Editing a Roleplay visual style does not change Game Mode's planners.

### Storyboard and Illustrator together

Storyboard is separate from Illustrator, and manual Illustrator actions stay available. When Roleplay Storyboard is on **Still images** or **Animations**, Marinara skips the ordinary automatic Illustrator image for that response so the two do not make competing media. **Manual only** leaves the Illustrator path unchanged.

## Storyboard agent settings

Open the **Agents** panel, select **Storyboard** and open its setup. These values are the defaults for chats without their own overrides.

| Setting | Default | Purpose |
| --- | --- | --- |
| Agent connection | Your selected agent account | Plans the storyboard with a model. |
| **Image model** | **Use the chat image connection** | Makes every keyframe. An image account is needed somewhere in the fallback chain. |
| **Video connection** | **Use the chat video connection** | Makes clips when animations are on. |
| **Automatic generation** | Still images | The starting automatic behavior for newly activated chats. |
| **Keyframes per turn** | 3 (1 to 200) | Target number of ordered frames. |
| **Clip seconds** | 5 (1 to 15) | Requested length of each clip. |
| **Viewer display** | Floating viewer | The Game viewer default. Roleplay always shows Storyboards inline. |
| **Default Roleplay episode interval** | 1 (1 to 100) | New Roleplay material needed between automatic episodes. |
| **Attach Card Appearance** | On | Adds matched character appearance to image prompts. A card or persona with **Image Appearance Override** on supplies that text instead of its **Appearance** field. |
| **Send Avatar References** | On | Sends matched character and persona avatars when the image service accepts references. |
| **Use the final image template** | On | Formats a planned frame before it goes to the image service. In a Game chat, this is **Use Storyboard Template**. |
| **Use NovelAI character prompts** | On | Native per-character prompting on supported official NovelAI V4 and V4.5 accounts only. Other services use the shared prompt path. |

For Game Mode, the library has two planning lanes, chosen by whether the game makes stills or clips: **Still planner** (default Still Keyframes) and **Animation planner** (default Comic Page Animation). Planner text is editable in the global agent setup, and each Game chat chooses among the options in its own settings.

After planning, shared formatters create the final requests: **Default image prompt** (Game Scene Illustration) and **Default video prompt** (Cinematic Scene Video). Each numbered stage has its own collapsed **Prompt library**: Stage 2 for image formatters, Stage 3 for image-aware motion planners and Stage 4 for video passthrough formatters. Image choices also include **Storyboard Illustration** and **Storyboard First Frame**. Video choices include **Anime Game Video**, **Comic Page Video** and **Narration Passthrough**. Game and Roleplay chats can pick different formatters.

Stage 3's **Image-aware shot planning** also follows the video account's **Video prompting instructions**. Use that field in the account editor to say what your video model expects, such as camera wording, prompt length or sound cues.

Accounts are picked slightly differently by mode. Roleplay has per-chat prompt, image and video selectors, and **Use global default** inherits the Storyboard setup. Game Mode uses its own planning, image and video accounts when set, then falls back to the agent defaults. Stills need an image account. Animations need a successful keyframe image and a video account.

## Image prompting and character consistency

The planner decides which moments to show and writes each frame's visual content. The final image template adds the service-facing structure, matched character appearance, reference handling, location context, campaign art direction and image instructions.

When a planner already returns the exact syntax the image service should receive, use a pass-through template such as `${scenePrompt}`. Turn off **Use the final image template** only to bypass the formatter on purpose. Required image instructions still apply.

For steadier characters:

- Keep character-card Appearance fields specific and current.
- Keep **Attach Card Appearance** on unless the planner already repeats the needed details.
- Keep **Send Avatar References** on when the service accepts references and the avatars match the look you want.
- Prefer a small, clearly visible cast per frame. Storyboard includes only matched visible characters and personas, not everyone in the chat.

## Cost and performance

Every keyframe is a separate image job. Animated Storyboards add one video job per successful keyframe, so a three-frame animated Storyboard can make three image requests and three video requests. When you test a new service or local setup, start with still images and one keyframe. Raise the frame count, clip length and automatic interval only after the basic path works.

## Games from the older Storyboard system

Existing Game chats may hold settings from the older built-in Storyboard UI. Marinara keeps them as per-chat overrides when the package is installed, so an older game can behave differently from the current agent defaults. Open **Chat Settings → Agents → Storyboards** and use each reset control to make a field follow the agent default again. These settings are migration data only. Generation still needs the package installed and on for the game.

## Troubleshooting

### Create storyboard is available but generation fails

- Turn on **Enable Agents** and **Enable Storyboards** for the chat.
- Pick a valid image-generation account in the Roleplay Storyboard card, Game settings or global Storyboard setup.
- Wait for the assistant or GM response to finish, then try again.

### Roleplay did not create an automatic episode

- Choose **Still images** or **Animations**, not **Manual only**.
- Wait for a newly completed assistant response. Opening a chat does not backfill old messages.
- Check **Messages per episode**. Enough new user and assistant messages must accumulate.
- A failed run does not move the counter, so check the server log for the original service or parsing error.

### Images appear but videos do not

- In Roleplay, choose **Animations**. In Game Mode, turn on **Automatic Storyboard Animations**.
- Pick a Video Generation account that supports image-to-video input.
- Check the Gallery's **Videos** tab. A clip may finish after its keyframe image.
- If planning fell back after a model failure, Marinara can keep fallback images and skip videos for that run.

### A Storyboard is partial or stuck

A service job may have failed, timed out or hit a rate or content limit. If the service is healthy but slow, raise `IMAGE_GEN_TIMEOUT_MS` or `VIDEO_GEN_TIMEOUT_MS` in `.env`, then restart Marinara, because these are read at startup. See [Configuration](../CONFIGURATION.md).

Turn on Debug mode and search the server log for `storyboard` to see the planner, compiled image prompt, reference selection and video prompt. Debug logs can contain private chat text, so sanitize them before sharing.

## Related guides

- [Agents Overview](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Game Mode: Getting Started](getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Image Generation Providers](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
- [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md)
