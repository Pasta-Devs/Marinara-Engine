# Illustrator Agent

This guide covers the **Illustrator**, a built-in helper that draws pictures of your scenes while you chat. You will learn what it does, how to turn it on, the art styles it can use, and the two connections it needs.

## What the Illustrator agent does

An agent is a small AI helper that runs automatically for one chat. The **Illustrator** is a post-processing agent, which means it runs after the AI finishes each reply. It reads the latest reply and decides if the moment is worth a picture. When it is, the Illustrator writes an image prompt and sends it to your image provider. A prompt is the text description that tells an image model what to draw.

The Illustrator does not draw every message. By default, after it makes an image it waits about 5 accepted assistant replies before it can make another one. Swiping or regenerating the same reply does not advance that interval. If it decides a moment is not worth illustrating, it skips it and makes no image. Every image it creates is saved to the chat **Gallery**.

You can use the Illustrator in **Roleplay** and **Game Mode** chats, and installing it also unlocks Conversation selfies. Its short description in the app reads: "Responsible for image and video generations." The setup steps and settings in this guide are for Roleplay chats. Game Mode uses one simple switch instead, covered in the Game Mode section below.

## Before you start

The Illustrator writes the image prompt, but it needs a separate image connection to actually draw the picture. An image connection is a saved link to an image provider, such as OpenAI or a local Stable Diffusion server.

Set up an image connection first. You have two ways to give the Illustrator one:

1. Mark one image connection as the default. Open the **Connections** panel, expand **Defaults**, and choose it under **Images**.
2. Or give the Illustrator its own image connection from its full setup screen (see **Open Setup** below).

If no image connection can be found, the picture fails and the app asks you to choose one. See [Image Generation Providers and Setup](image-providers.md) to add a provider.

## Turning on the Illustrator

The Illustrator is off by default. In a **Roleplay** chat, add it like this:

1. Open the chat you want to illustrate.
2. Open **Chat Settings** using the gear icon.
3. Find the **Agents** section and turn on **Enable Agents**.
4. In the **Misc Agents** group, find **Illustrator** and add it with the Plus button.

You should now see an **Illustrator** settings card with its own options. Adding an agent uses extra tokens and makes extra AI calls per turn, so the panel shows a running cost estimate.

### Game Mode: the Game Illustrator toggle

Game Mode does not use the steps above, and it does not show the **Prompt Mode** or **Prompt Model** options. Instead, open the game's **Chat Settings** and turn on the single **Game Illustrator** toggle. Its description reads: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Prompt modes

The **Prompt Mode** picker sets the art style the Illustrator uses for every prompt it writes. In the agent card this picker is labeled **Prompt**. A short line under it reads: "Prompt mode controls how Illustrator writes image prompts for this chat."

The picker offers these styles:

- **Illustration**: a single polished scene picture. This is the general style.
- **Comic Page**: a comic page with panels, speech bubbles, captions, and sound effects.
- **Colored Manga**: a colored manga scene with stylized bubbles and sound effects.
- **B&W Manga**: a black and white manga page with inked lines and screentone shading.
- **Background**: a location or establishing shot with no characters in it.
- **Selfie**: an in character selfie or a casual portrait.

A new Illustrator agent starts on the **Background** style. Change the style at any time from the picker. The overall look of the final image also depends on your style profile. See [Image Style Profiles](style-profiles.md) to set that.

## Prompt Model and the image connection

The Illustrator uses two different connections, and it helps to keep them straight.

The **Prompt Model** is the text model that writes the image prompt. It is not the model that draws the picture. Pick it from the **Prompt Model** dropdown on the Illustrator card. The default is **Main chat model**, which reuses the same connection your chat already uses. Choose another text connection if you want a different model to write the prompts.

The image connection is the image provider that draws the final picture. You set it as described in **Before you start**, either under **Defaults → Images** or from the agent's own setup screen.

## Attach Card Appearance and Send Avatar References

Two toggles on the Illustrator card help characters look consistent. Both are off by default.

**Attach Card Appearance** adds each visible character's saved appearance text to the image prompt. Its help text reads: "Append matched character appearance lines to image prompts, using only visible/generated names." Turn it on when you want the picture to match how a character is written.

**Send Avatar References** sends character and persona avatars, or their sprites, to the image provider as reference images. Its help text reads: "Send matching character and persona avatars or sprites as reference images when the provider supports them." This helps the image model copy a face or outfit. Not every provider accepts reference images, so the effect depends on the provider you chose.

## More settings and running it by hand

The Illustrator card has an **Open Setup** button. It opens the agent's full setup screen, where you can set how often the agent runs and give it its own image connection.

You can also make a picture on demand instead of waiting. Open the chat **Gallery** and use the **Illustrate** button. The Illustrator runs once right away and the button shows **Generating...** while it works. This is useful when you want a picture of the current moment and the agent has not drawn one yet.

## Related guides

- [Image Generation Providers and Setup](image-providers.md)
- [Image Style Profiles](style-profiles.md)
- [Scene Backgrounds and the Gallery](scene-backgrounds.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
