# Illustrator Agent

The **Illustrator** is a downloadable agent that draws pictures of your scenes while you chat. This guide shows how to turn it on, pick an art style and image model, and make clips. An agent is a small AI helper that runs automatically for one chat.

## What the Illustrator does

The Illustrator is a post-processing agent, so it runs after the AI finishes each reply. It reads the latest reply and decides whether the moment is worth a picture. If it is, it writes an image prompt (the text that tells an image model what to draw) and sends it to your image service. Every image it makes is saved to the chat **Gallery**.

It does not draw every message. After it makes an image, it waits for 5 accepted user and assistant messages by default before it can make another. Each Roleplay chat can change that number. Swiping or regenerating a reply does not advance the count. If it decides a moment is not worth a picture, it skips it.

It works in Roleplay and Game Mode chats. Installing it also adds Conversation selfies and [video messages](../conversation/selfies.md#video-messages). The setup in this guide is for Roleplay. Game Mode uses one switch (see [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Before you start

The Illustrator writes the prompt, but a separate image model draws the picture. You need one. See [Image Generation Providers and Setup](image-providers.md).

Give it an image model one of two ways.

1. Set the **Images** job under **Defaults** in the **Connections** panel.
2. Or give the Illustrator its own image model on its **Open Setup** screen.

If no image model can be found, the picture fails and the app asks you to choose one.

## Turn on the Illustrator

Before you start: install **Illustrator** from **Agent Organizer**. See [Agents overview](../agents/agents-overview.md).

1. Open the Roleplay chat you want to illustrate.
2. Open **Chat Settings** and find **Agents**.
3. Turn on **Enable Agents**.
4. In the **Misc Agents** group, find **Illustrator** and add it with the plus button.

An **Illustrator** card with its own options appears. Agents use extra tokens and can add model calls per turn. The token estimates cover only agent instructions.

### Game Mode: the Game Illustrator toggle

Game Mode has no **Prompt Mode** or **Prompt Model** options. Open the game's **Chat Settings** and turn on **Game Illustrator** ("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## Pick an art style

The **Prompt Mode** picker (labeled **Prompt** on the card) sets the art style for every prompt the Illustrator writes. A new Illustrator starts on **Background**.

| Style | What it draws |
| --- | --- |
| **Illustration** | A single polished scene picture. The general style. |
| **Comic Page** | A comic page with panels, speech bubbles, captions and sound effects. |
| **Colored Manga** | A colored manga scene with stylized bubbles and sound effects. |
| **B&W Manga** | A black and white manga page with inked lines and screentone shading. |
| **Background** | A location or establishing shot with no characters. |
| **Selfie** | An in-character selfie or casual portrait. |

The final look also depends on your style profile. See [Image Style Profiles](style-profiles.md).

## Choose the prompt model

The **Prompt Model** is the text model that writes the image prompt. It does not draw. Pick it in the **Prompt Model** list on the card. The default is **Main chat model**, which reuses your chat's model. Choose another text model if you want a different one to write prompts.

The image model that draws the picture is the one you set under **Before you start**.

## Keep characters consistent

Two settings on the card help characters look the same across pictures. Both start off.

**Attach Card Appearance** adds each visible character's saved appearance text to the image prompt. In a Roleplay chat it is a list with four choices.

- **Off**
- **Images only**, the usual behavior.
- **Videos only**: a clip gets the appearance text of the characters it shows. This matters most for a **Prompt only** clip, which has no picture.
- **Images and videos**: both.

When it is on, a card or persona with **Image Appearance Override** turned on sends that override instead of its **Appearance** text. Use it when **Appearance** is written for the narrator but reads badly to an image model. Keep the full description in **Appearance** and put a shorter, tag-style version in the override. With the override off or empty, image prompts use **Appearance**. The narrator always sees the full **Appearance**. The switch is under **Appearance** in the Character and Persona editors.

**Send Avatar References** sends character and persona avatars, or their sprites, to the image service as reference images, so the model can copy a face or outfit. Not every service accepts them. In a Roleplay chat it is a list like **Attach Card Appearance**. With videos included, a clip whose **First frame** is **Prompt only** starts from the character's avatar or sprite, and the choice reads **Prompt only (avatar from Send Avatar References)**.

## Control how often it draws

The Illustrator card has an **Open Setup** button for the full setup screen. There you set the default run interval and give it its own image model.

Each Roleplay chat has its own **Image Run Interval** on the card in **Chat Settings** ("Messages between automatic images in this chat. 0 means only when you ask."). A chat with none set uses the value from the setup screen, **5** by default. The card shows **Using agent default** or **Chat override**. Press **Use agent default** to go back. When you add the Illustrator to a chat, the add window shows the same field and saves it to that chat only.

Set **Image Run Interval** to **0** for manual-only mode. It stops automatic runs, including automatic scene backgrounds, but keeps the agent available for Gallery actions. Set a positive number to resume.

To make a picture now, open **Chat Settings**, expand **Gallery** and click **Illustrate**. The Illustrator runs once at once, and the button shows **Generating...**.

## Make clips

In a Roleplay chat, **Chat Settings → Agents → Illustrator** has an **Illustrator makes** setting.

- **Pictures** (default): pictures only.
- **Pictures and clips**: Illustrator may also turn a new picture into a short clip when motion is the point, such as action, a chase or something breaking. This includes pictures the storyteller asks for with `[illustrate]`. It writes the motion itself, following the video model's **Video prompting instructions**. The picture shows first, and the clip joins the same message when ready.
- **Clips only**: wherever Illustrator would show a picture, it shows a short clip. The picture it draws becomes the clip's starting frame and goes to the Gallery, not the reply. If the clip fails, the picture is shown.

Clips use the video model under **Scene Videos**, and each clip is a video request. With no working video model, Illustrator makes pictures even with **Clips only**. Custom agents that make images follow the same setting. See [Scene Video Generation](scene-video.md).

**Video Run Interval** appears once Illustrator makes clips. It is how many user and assistant messages must pass after a clip before the next, and it is separate from **Image Run Interval**.

- With **Clips only**, every run is a clip, the **Video Run Interval** sets how often Illustrator runs, and **Image Run Interval** is hidden.
- A chat with no value uses the **Video Run Interval** on the **Open Setup** screen, or 5.
- **0**: no clips on its own, including for `[illustrate]` pictures, which get their picture instead.
- A reply gets at most **Videos per reply** clips (**Settings → Generations → Video Generation**).
- You can still animate a picture from the Gallery. With **Clips only**, a message's **Illustrate** button makes a clip.
- A swipe of a reply that got a clip counts as a new reply and can get its own clip. The earlier swipe keeps its clip.

**First frame**, in the same section, sets what every Roleplay clip starts from: Illustrator's clips, `/video` and the Gallery's **Video** button. The choices are a new Illustrator picture, the named character's avatar or sprite, the picture with the avatar as fallback, or no picture. Conversation video messages use the same setting.

- **Clips only** with the avatar or no picture: no picture is drawn. The clip comes from Illustrator's scene and motion.
- **Pictures and clips**: the picture still shows, and only the clip starts from the avatar or nothing.
- No first frame chosen: a clip never draws a picture just for itself. **Pictures and clips** animates the picture Illustrator just made. **Clips only**, `/video` and **Video** make the clip from the scene alone.

A clip with no picture of its own describes everyone it names, including your persona. The avatar first frame starts from whoever is named first.

Re-running Illustrator from a message's **Illustrate** button follows **Illustrator makes** and **First frame** too.

## Multiple characters on NovelAI

When the Illustrator's image model is NovelAI on a V4, V4.5 or V5 model, the prompt writer adds one caption per visible character. Each caption has that character's appearance, expression, pose and rough position in the frame. Marinara checks the captions against the scene's character list, drops any it cannot match, and sends the rest to NovelAI as native character prompts next to the main prompt. This keeps hair, clothes and other traits from mixing between characters. Images from **Illustrate** and from a character's `[illustrate]` command get the same captions.

V5 accepts up to 22 characters. V4 and V4.5 accept up to 6. With more visible characters, the most important are kept and the rest become unnamed background.

Fixed traits come from the **Appearance** field. If it is already Danbooru tags, they are copied as they are. If it is prose, the writer turns it into tags. Clothing comes from the character tracker's current outfit when the tracker runs, also turned into tags.

With **Attach Card Appearance** on, the writer also gets the full Appearance text of every card and persona in the chat, so long or ensemble cards are not cut short. Ensemble cards that describe several characters as `[NAME] tags | [NAME] tags` are listed per character. The writer copies fixed traits into the matching caption, treats the card's clothing tags as a default that the tracker or scene overrides, and ignores characters who are not in the scene. When captions come back, Marinara adds nothing more. With no captions, the single-character case, the usual appearance line is added to the main prompt as before.

No setting is needed. Captions appear only for NovelAI on its own host, so a proxy or another service is unaffected. With **Expose media prompts before sending** on, the review window lists the captions under the main prompt, read-only. Edit the main prompt as usual.

## Gallery saving and prompt inspection

In **Settings → Generations → Image Generation**, **Automatically save generated images to character galleries** is on by default. Turn it off to stop adding chat illustrations and selfies to the depicted characters' and personas' galleries. Images still appear in the conversation and chat Gallery, and explicit gallery saves still work. Existing entries are unchanged. Galleries share image files, so this controls membership, not deletion.

For new NovelAI illustrations, the image inspector shows the scene and style prompt followed by the positive character captions, separated by ` | `. The saved gallery prompt is the same.

To draw an illustration again with a changed prompt, without regenerating the reply, open it and use **Regenerate image**. See [Regenerating an image](scene-backgrounds.md#regenerating-an-image).

To illustrate an earlier Roleplay message or range, use `/illustrate range=12` or `/illustrate range=12-18`. See [Slash Commands](../chats/slash-commands.md).

## Related guides

- [Image Generation Providers and Setup](image-providers.md)
- [Image Style Profiles](style-profiles.md)
- [Scene Backgrounds and the Gallery](scene-backgrounds.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
