# Storyboard Engine Guide

This guide explains storyboards in Marinara Engine. A storyboard turns completed story text into a short run of keyframe images and can add animated clips. Game Mode storyboards follow one finished GM turn. Roleplay storyboards combine completed exchanges into an inline episode. Conversation chats do not use Storyboards.

## What storyboards are

Game Mode is the chat mode where an AI Game Master (GM) narrates a turn-based adventure. When the GM finishes a narration turn, the Storyboard Engine can illustrate that single turn. In Roleplay, the Storyboard Agent reads completed user and assistant messages since its previous successful episode.

Marinara reads the GM narration and splits it into a short run of ordered keyframes. Each keyframe is one picture of a moment in the turn. A storyboard holds 1 to 6 keyframes. The default is 3.

Each keyframe is tied to a range of the turn's text. These text ranges are called reader sections. As you read down the turn, a small viewer shows the keyframe that matches your current spot in the text.

Before it plans the images, Marinara strips the turn's GM command tags. GM command tags are hidden instruction tags in a GM message, such as dice rolls or game-state updates. They are removed so they do not show up in the picture.

Keyframe still images are saved in the **Gallery**, under the **Images** tab. Keyframe clips are saved as scene videos, under the **Videos** tab. Because they are normal Gallery items, you can preview, download, pin, or copy the prompt of any keyframe on its own.

## Roleplay storyboard episodes

Roleplay Storyboards are separate from Illustrator. Illustrator can keep making its usual single images while Storyboard plans one or more ordered keyframes from a completed section of the chat.

1. Install **Storyboard** from **Agents > Download Agents**.
2. Open a Roleplay chat, then add **Storyboard** in **Chat Settings > Agents**.
3. In the Storyboard card, choose **Manual only**, **Still images**, or **Animations**.
4. Select the prompt, image, and optional video connections. The image connection is required.
5. For a manual episode, open **Gallery** and choose **Create storyboard**. Automatic episodes run after the configured number of newly completed assistant responses.

The default interval is 1, so an automatic episode can appear after every newly completed assistant response. A larger **Assistant messages per episode** value lets dialogue and back-and-forth accumulate. When the interval is reached, Marinara combines the messages since the previous successful Storyboard, within a bounded recent window. Opening an existing chat does not backfill old messages, and a failed episode does not advance the successful cadence anchor.

Roleplay keyframes render inline after the assistant response that ends the episode. Use the arrows on multi-keyframe Storyboards to move between frames. Images and clips are also saved in the Gallery.

Roleplay planning has four editable layers under global **Agents > Storyboard** settings:

- **Episode contract** selects completed story beats from the supplied messages.
- **Visual style** provides normal/anime, NovelAI, comic, colored manga, and black-and-white manga choices.
- **Animation addon** is included only for animated Storyboards. It treats the illustration as the exact T=0 frame, then describes simple action, camera behavior, source dialogue, sound effects, ambience, and an ending hold.
- **Output contract** defines the keyframe JSON returned by the planning model.

These Roleplay prompts do not replace the optimized Game Mode planner library. Image and video provider formatters remain shared and selectable. The animation plan is provider-neutral, so it can use Google Gemini Omni, LTX/ComfyUI, or another configured Video Generation connection that accepts image-to-video requests. Provider capabilities and output quality still vary.

## Game Mode storyboards

This section explains how to configure, generate, review, and animate storyboards for Game Mode turns.

## Before you start

You need a few things set up before a storyboard can render.

1. A Game Mode chat. The setup below is specifically for the Game Mode workflow.
2. A working image connection for the game's illustrator. Set it in either place. You only need one:
   - Existing game: open **Chat Settings**, go to **Agents**, then the **Illustrator** card. Turn on **Game Illustrator** and pick an **Image Connection**.
   - New game: in the setup wizard, turn on **Visual Generation** and pick an **Image Generation Connection**.
3. A strong, recent image model is recommended. The app suggests a state-of-the-art image model, or something equivalent to Google Nano Banana 2 Lite.

For animated clips, you also need a video connection. See the animation steps below.

If you have no image connection set, a storyboard request fails with this message: "Choose an Illustrator image connection in Game Settings first."

For steady character looks across keyframes, use character cards with avatars, and turn on **Send Avatar References** in the **Illustrator** card. This sends each character's avatar as a reference image.

## Quick start

1. Open or create a Game Mode chat.
2. Set up the image connection as shown in the section above.
3. Play until the GM finishes a narration turn.
4. Open the **Gallery** panel.
5. Click **Create storyboard**. The button shows **Creating...** with a spinner while it runs.
   - If **Expose image prompts before sending** is enabled in **Settings > Generation**, review and edit the compiled prompt for every keyframe, then confirm generation.
6. Keep reading the turn. The floating viewer appears and switches keyframes as you read.

If you close the viewer, reopen it. In the **Gallery** panel, click **View storyboard**.

While a storyboard is generating, the **Gallery** shows this banner: "Storyboard generation is running. Keyframes will appear in the game storyboard viewer when ready."

## Automatic and manual storyboards

You can make storyboards by hand, or have Marinara make them for you.

Manual is the **Create storyboard** button in the **Gallery**. It builds a storyboard for the latest finished GM narration turn, only when you ask. You can also use it to refresh or re-illustrate the current turn, even when automatic storyboards are off.

Automatic storyboards are set per chat. Find the controls in either place:

- New game: setup wizard, **Visual Generation**, then the **Storyboards** subsection.
- Existing game: **Chat Settings**, **Agents**, then the **Storyboards** card.

**Automatic Storyboard Illustrations** makes still keyframe images after each finished GM turn, with no clicks from you. This is the lower-cost path. For a new game created through the wizard, this is on by default once **Visual Generation** is enabled. It has no effect until **Game Illustrator** is set up.

Automatic storyboards do not pause the completed-turn pipeline for prompt review. When **Expose image prompts before sending** is enabled, use the manual **Create storyboard** action to see and edit every final compiled keyframe prompt. Automatic runs continue without a modal so gameplay does not stall while the chat is unattended.

**Automatic Storyboard Animations** also makes an MP4 clip for each keyframe. This is off by default. It needs still illustrations plus a video connection. Turning animations on also turns illustrations on. Turning illustrations off turns animations off.

To set up clips:

1. Create a **Video Generation** connection in **Settings**, then **Connections**.
2. Select it in the wizard's **Video Generation Connection** field, or in **Chat Settings**, **Agents**, **Scene Videos**, then **Video Connection**.
3. Turn on **Automatic Storyboard Animations**.

If you turn on animations without a video connection, the wizard warns you: "Choose a Video Generation connection below to save automatic storyboard animations."

A storyboard usually creates 3 image jobs, one per keyframe. With animations on, it also creates up to 3 video jobs. The number follows **Keyframes per Turn**, so choosing 5 can mean 5 image jobs and up to 5 video jobs. Video jobs are much slower and cost more. Start with still illustrations, and add animations only for chats where the wait and cost are fine.

## Storyboard settings

All of these live in the **Storyboards** card. Open **Chat Settings**, go to **Agents**, then **Storyboards**.

| Setting | Default | What it does |
| --- | --- | --- |
| **Automatic Storyboard Illustrations** | On for new wizard games with Visual Generation; else off | Makes still keyframes after each GM turn |
| **Automatic Storyboard Animations** | Off | Adds an MP4 clip per keyframe; needs a video connection |
| **Keyframes per Turn** | 3 (range 1 to 6) | How many keyframes each turn plans |
| **Animation Clip Duration** | 6 seconds (range 1 to 15) | Length of each clip |
| **Viewer Display** | Floating | Floating panel or full background |
| **Illustration Planner** | Still Keyframes | Plans finished still keyframes and their image descriptions |
| **Animation Planner** | Comic Page Animation | Plans animation-ready source images and motion directions |
| **Use Storyboard Template** | On | Formats planned scenes with the selected Storyboard Illustration Prompt. Turn it off for direct NovelAI tag prompts |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formats each planned keyframe for the image model |
| **Storyboard Video Prompt** | Same as Game Video Prompt | Motion prompt used only for storyboard keyframe clips |

**Keyframes per Turn** is a slider. The engine tries to plan this many keyframes. A short turn may get fewer. It never plans more than 6.

**Animation Clip Duration** is a number of seconds. It is greyed out unless **Automatic Storyboard Animations** is on. Until you set a value, it uses the 6-second default and shows a **Storyboard default** pill. Once you set your own value, a **Use storyboard default** button appears to clear it. Some video providers may clamp your value to a lower maximum, so the exact length is not promised.

In **Background** viewer mode, each animation starts once with sound when its story beat becomes active. Narration can display while it plays, but narration auto-play waits for the clip to finish. The animation then stays paused on its final frame. The game toolbar provides replay, play/pause, and mute controls on desktop and mobile. Floating storyboard videos also play once and can be replayed instead of looping indefinitely.

The two planners create the visual plan. **Illustration Planner** is used for still storyboards. **Animation Planner** is used when videos are generated and produces both an animation-ready image description and a compact motion direction.

**Storyboard Illustration Prompt** then formats the planner's image description into the final request sent to the image model. Existing chats default to **Game Scene Illustration**. **Storyboard Illustration** keeps the planner result primary while adding character references, appearance notes, campaign art direction, and image instructions.

**Storyboard Video Prompt** is separate from the general **Game Video Prompt** in the **Scene Videos** card. It combines the generated keyframe, the Animation Planner's motion direction, and the current scene context into the final request sent to the video model. Leave it on the inherited choice to reuse the general prompt, or select **Anime Game Video** for keyframe clips without changing manual Gallery or Game Assets videos.

Select **Comic Page Animation** for the duration-aware comic source pages, then choose **Comic Page Video** to interpret those panels as ordered visual reference beats for one clip. The original **Comic Page** remains available for ordinary illustrations. The separate video choice leaves the inherited **Game Video Prompt** plus manual Gallery and Game Assets videos unchanged.

New games created with the **Storyboard Optimized** presentation select the **Storyboard Game Prompt**, **Comic Page Animation** planner, **Storyboard Illustration**, and **Comic Page Video**. You can switch that chat to the single-shot combination at any time by selecting **Still Keyframe Animation** and **Anime Game Video**.

### LTX 2.3 image-to-video

For a local LTX 2.3 ComfyUI workflow, start with **LTX Simple Image-to-Video** as the Animation Planner, **Storyboard First Frame** as the Storyboard Illustration Prompt, and **LTX Director Video** as the Storyboard Video Prompt. The Animation Planner creates both the natural-language T=0 image prompt and the complete motion paragraph. Storyboard First Frame passes the T=0 scene to a natural-language image provider with minimal wrapping, while LTX Director Video sends the motion paragraph to the workflow's `%prompt%` input. **LTX Director Storyboard** is the more detailed, duration-aware alternative; it uses the same video prompt and workflow contract.

See [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md) for model selection, ComfyUI placeholders, the complete Game settings profile, validation steps, and troubleshooting.

## Style presets

The planner presets shape how each keyframe is selected and described. Two selectors pick them:

- **Illustration Planner** is used when storyboards make still keyframes without videos. Default: **Still Keyframes**.
- **Animation Planner** is used when **Automatic Storyboard Animations** is on. Default: **Comic Page Animation**.

The two selectors have separate preset lists. Illustration presets describe finished stills and can include reader-facing comic or manga lettering. Animation presets describe a stable first frame plus duration-aware motion direction. An illustration preset never appears in the Animation Planner menu, and an animation preset never appears in the Illustration Planner menu.

| Lane | Preset | Best for |
| --- | --- | --- |
| Illustration | **Still Keyframes** | Normal reading. Single-scene keyframes without comic panels, speech bubbles, captions, or SFX text. |
| Illustration | **NovelAI Keyframes** | Compact still-image tag prompts tuned for NovelAI V4 and V4.5. For a direct tag prompt, turn off **Use Storyboard Template**. |
| Illustration | **Comic Page** | Finished comic-page illustrations with 2-6 panels, dialogue bubbles, captions, and lettering. |
| Illustration | **Colored Manga** | Finished colored manga staging with cell shading, screentones, speech bubbles, and SFX. |
| Illustration | **B&W Manga** | Finished black-and-white manga inks, screentones, heavy blacks, speech bubbles, and SFX. |
| Animation | **Still Keyframe Animation** | Ordered single shots with an exact first frame, one main movement, simple camera behavior, environmental motion, and an ending hold. |
| Animation | **Anime Episode Director** | Broadcast-anime single shots with first-frame continuity, compact motion direction, and provider-safe staging. |
| Animation | **NovelAI Keyframe Animation** | NovelAI tag-based first frames with timing and motion kept in a separate animation direction. |
| Animation | **Comic Page Animation** | Duration-aware comic source pages whose chronological panels act as ordered visual references for one clip. |
| Animation | **Colored Manga Animation** | Text-free colored manga first frames with motion that preserves linework and cel shading. |
| Animation | **B&W Manga Animation** | Text-free monochrome first frames with motion that preserves inks and screentones. |

The **Still Keyframe Animation** preset is the style-neutral motion counterpart to **Still Keyframes**. The **Anime Episode Director** is a separate specialized option that pairs with **Anime Game Video** when you want broadcast-anime shot planning. It keeps severe violence non-graphic and stages it through anticipation, obstruction, reaction, or aftermath where possible, which can reduce provider safety rejections without changing the GM's canonical story.

The **Comic Page Animation** preset uses the animation clip duration to control page density. It defaults to 2 panels for a 6-7 second clip, allowing a third only for three simple beats with about 2 seconds each; it uses 2-3 panels for 8-10 seconds and no more than 4 for longer clips. Animation pages prioritize visual timing over comic lettering, keep each panel focused, and reserve a short ending hold. Panels follow cause and effect in reading order. **Comic Page Video** normally enters panel 1 immediately; it permits only a very brief full-page establish when doing so cannot reveal a later consequence early.

The **NovelAI Keyframes** preset writes compact Danbooru tags. Danbooru tags are short comma-separated keyword tags that some anime image models expect. Choosing an animation, comic, or manga preset does not turn animations on by itself. You still need **Automatic Storyboard Animations** and a video connection for clips.

## Campaign art style and image style profiles

Game setup generates a campaign-level art style for visual consistency. For an existing game, open **Chat Settings > Agents > Illustrator** to see it under **Campaign art style**. You can edit it, clear it, restore the original setup-generated wording, or turn off **Use Campaign Art Style**.

The campaign art style and **Image Style** profile are separate prompt layers. When both are enabled, Marinara includes both. Turning off or clearing the campaign style leaves the selected Image Style profile in place. This setting applies to storyboard keyframes and the game's other generated visual assets.

With **Expose image prompts before sending** enabled in **Settings > Generation**, manual **Create storyboard** requests first show the exact compiled positive and negative prompts for all planned keyframes. Changes in that review are one-off overrides for that storyboard only; they do not replace the campaign style or Image Style profile settings.

## Editing storyboard presets

The built-in presets are read-only. To make your own, open **Edit Illustration Planner Presets**, **Edit Animation Planner Presets**, **Edit Illustration Prompt Presets**, or **Edit Video Prompt Presets** inside the **Storyboards** card. Each section shows only the built-ins and custom copies for that stage.

Copy a built-in into a chat-only editable template, then pick that copy in the matching selector. Illustration Planner copies cannot be selected as Animation Planners, and Animation Planner copies cannot be selected as Illustration Planners. Storyboard Illustration Prompt copies affect only storyboard images. Video prompt copies remain shared with the general Game Video Prompt so either video selector can use them.

Each custom copy has a name, a short description, and the prompt body you edit. A trash button removes a copy after a confirm dialog. These copies are stored on that one chat, not across your whole app.

## The storyboard viewer

The viewer follows your reading position. It shows the keyframe whose reader section matches where you are in the turn text. It is not just "the newest Gallery image." There are two display styles, set by **Viewer Display**.

**Floating** is the default. A small draggable panel sits above the game. Its header reads **Storyboard**. It plays the keyframe's video when ready, and falls back to the image while a clip is pending or failed.

The floating viewer has these controls:

- **Close storyboard viewer** hides the panel for the current turn only. It reappears when the next GM turn finishes. A page refresh also clears the hide.
- **Drag storyboard viewer** is the header handle. Drag the panel anywhere on screen.
- **Play storyboard video** and **Pause storyboard video** control clip playback. Clips start muted.
- **Mute storyboard video** and **Unmute storyboard video** show only when the keyframe has a rendered clip.
- **Change storyboard viewer size** cycles three widths: small, medium (the default), and large.
- A corner handle resizes the panel freely and overrides the size preset.

**Background** fills the whole game surface with the active keyframe instead of a floating card. The image or clip sits behind the game controls. It uses the same reading-position logic as the floating viewer.

Background mode has a trade-off. It turns off Marinara's normal generated scene location background. While it is on, the **Generate background** button in the illustrator popover is disabled. The button shows this note: "Storyboard background display is active, so scene background generation is disabled."

## Getting better results

A storyboard is only as clear as the turn it reads. The best turns name who moves, what changes, and where the key moment is. A vague turn like "the fight continues" gives the engine less to draw than a turn with concrete action and setting details.

For steadier results:

- Keep the game's setting, tone, and art style specific during setup.
- Use character cards with detailed avatars, and turn on **Send Avatar References**.
- Keep important outfits, wounds, props, and locations clear in the narration.
- Use image style profiles for the finish you want.
- Use **Still Keyframes** for normal reading, and a comic or manga preset when clips are on.

## NovelAI options

For a compact NovelAI request, choose **NovelAI Keyframes** and turn off **Use Storyboard Template** in the **Storyboards** card. This sends the planned scene prompt directly while keeping the separate appearance, reference-image, image-instruction, and style settings available.

**Use NovelAI Character Prompts** sends each visible character through native NovelAI Add Character captions and positions. This is on by default. Important: it only takes effect for an official NovelAI connection using a V4 or V4.5 model on novelai.net. For any other provider or model, the toggle does nothing, and Marinara uses the shared legacy prompt instead.

## Troubleshooting

**"Choose an Illustrator image connection in Game Settings first."** Open **Chat Settings**, **Agents**, then the **Illustrator** card. Turn on **Game Illustrator** and pick an **Image Connection**. For a new game, enable **Visual Generation** and pick an **Image Generation Connection** in the setup wizard.

**"Storyboards can only be generated from GM narration turns."** **Create storyboard** only works on a finished GM narration turn. It does not work on your own player messages. Wait for the GM's reply to finish, then try again.

**"This GM turn has no narration to storyboard."** The turn has no story text to draw. This happens when a GM turn holds only hidden command tags and no narration. Play on until the GM writes a turn with story text, then storyboard that one.

**Images appear, but no videos.** Videos need both **Automatic Storyboard Animations** on and a **Video Generation** connection selected. With animations off, storyboards make still keyframes only.

**Automatic storyboards do not run.** Check that **Automatic Storyboard Illustrations** or **Automatic Storyboard Animations** is on. Check that the image connection is set and the GM turn has finished streaming. Marinara will not make a second storyboard for a turn that already has one. You can still remake it by hand with **Create storyboard** in the **Gallery**.

**The storyboard is partial or stuck.** This usually means one or more image or video jobs failed, timed out, or hit a provider rate limit. Prohibited content can also block a job. If a provider is slow, raise the image and video generation timeouts in your `.env` file, then restart Marinara. See the [configuration guide](../CONFIGURATION.md) for the exact variable names.

For deeper diagnosis, set your log level to debug and watch the server log. The storyboard log lines are tagged `[debug/game/storyboard-illustrator]`, `[debug/game/storyboard-image-preview]`, `[debug/game/storyboard-image-assets]`, and `[debug/game/storyboard-video]`.

## Related guides

- [Scene Video Generation](../media/scene-video.md)
- [Image Generation Providers](../media/image-providers.md)
- [Game Mode: Getting Started](getting-started.md)
- [LTX 2.3 Storyboards in Game Mode](ltx-2-3-storyboards.md)
