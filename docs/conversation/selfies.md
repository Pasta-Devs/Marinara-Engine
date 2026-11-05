# Selfies

A selfie is an image a character generates of themselves and sends in a Conversation chat, like a photo shared in a messaging app. This guide covers turning selfies on, choosing how they look, asking for one by hand, and video messages.

Selfies come from the optional **Illustrator** package and use image generation. Each selfie is one image request to the service you pick, so they stay off until you set them up. They are different from the scene pictures in Roleplay and Game Mode.

## Turn selfies on

Before you start: install **Illustrator** from **Agents → Agent Organizer**, and add an image account, which is an account for a service that makes pictures (see [Image Generation Providers and Setup](../media/image-providers.md)).

1. Open a Conversation chat, then open **Chat Settings**.
2. Find the **Agents** section and open **Illustrator Settings**.
3. Turn on **Generated Selfies**. The selfie settings appear below it.
4. In **Selfie model**, pick your image account.

Turning on **Generated Selfies** also turns on the master **Commands** switch for the chat.

Characters send selfies only once **Selfie model** is set. Until then the chat shows "Choose a Selfie Provider to let characters generate selfie images."

If it did not work: **Illustrator Settings** shows only when Illustrator is installed. A selfie also needs the **Selfies** command on (see [Choose which Commands a character can use](getting-started.md#choose-which-commands-a-character-can-use)).

## Selfie settings

All of these live in **Illustrator Settings** and apply to the current chat only.

- **Selfie model**: the image account that draws the picture. The default is **None (selfies disabled)**.
- **Prompt Model**: the text model that writes the picture description. The default is **Agent default**.
- **Image Style**: a saved set of art-style words, such as "anime". The default is the default style from Style Profiles in Advanced settings. See [Image Style Profiles](../media/style-profiles.md).
- **Images Per Generation**: how many variants to make for each illustration or selfie.
- **Resolution**: the image size. It shows only after you set **Selfie model**. The default is 896x1152.
- **Send Avatar References**: sends the character's avatar or sprite as a reference picture. Off by default. It works only if the image service accepts reference pictures.
- **Attach Card Appearance**: adds the card's **Appearance** text of each named character to the prompt. Off by default.

**Resolution** options: 512x512, 512x768, 768x768, 768x1024, 896x1152 and 1024x1024. 896x1152 is a tall portrait that suits most selfies.

**Send Avatar References** and **Attach Card Appearance** each offer **Off**, **Images only**, **Videos only** and **Images and videos**.

If the card or persona has **Image Appearance Override** on (under **Appearance** in the editor), Marinara sends that text instead of **Appearance**. Use it when **Appearance** is written for the story, not for pictures.

## Ask for a selfie by hand

1. Open **Chat Settings** and expand the **Gallery** section.
2. Click **Selfie**. With more than one character, pick who takes it from the list beside the button.
3. If **Expose media prompts before sending** is on (**Settings → Generations → Overall Generations**), review or edit the prompt and click **Generate**. Canceling sends no request.
4. Wait while the button reads **Generating...**.

You see "Selfie generated." and the picture appears in the chat. A manual request uses **Selfie model** and costs one image request.

## How characters send selfies

A character decides on its own when to send a selfie. You do not type anything. Marinara generates the picture and posts it, and later replies see a short note of what it showed.

If it did not work: when you see the literal text `[selfie...]` in a message, check that the chat is in Conversation Mode, **Commands** and **Selfies** are on, **Generated Selfies** is on and **Selfie model** is set. If generation starts but fails, read the error about the image account.

## Make a selfie again

1. Click a selfie in the chat to open it.
2. Click **Regenerate image** (the circular arrow beside the pin button).
3. Edit the prompts if you want, including **Character prompts**. Pick an **Image model**, or keep **Chat's image provider**.
4. Click **Generate image**.

The new picture replaces the old one in the message. The old one stays in the Gallery. Each try is one image request. Pictures made before this option existed use the chat's selfie account, and their negative and character prompts were not saved.

## Video messages

A character can send a short video clip. Install Illustrator first. Selfies can stay off.

To ask for one yourself, type `/video`, or `/video Aster` to pick a character. Or click **Video** in the chat's **Gallery**, which uses the character picked there. The clip arrives as a new message and plays in the chat. It shows the latest moment of the conversation: the model that writes it reads as many recent messages as Illustrator does for a picture (its **Agent Budget**). You can also animate a picture from the Gallery. The clip continues that picture and joins the newest reply.

If a clip cannot be added to the chat, it is still saved under the Gallery's **Videos** tab. A character's own gallery lists a video only when the clip shows that character (see [Character and Persona Galleries](../characters/galleries.md)).

### Video settings

Open **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos**: lets characters send video messages on their own. Off by default in new chats, because each clip is a video request. It also shows as **Videos** in the **Commands** list.
- **Video Run Interval**: shown once **Generated Videos** is on. How many messages must pass between clips. **0** stops them.
- **Video model**: the video account. **Default video provider** uses your default.
- **First frame**: the picture the clip starts from (below).

`/video` and the Gallery **Video** button work either way and ignore the interval. Swiping a reply that sent a clip lets the new swipe send its own. In a group chat each character can send one clip per reply, up to **Videos per reply** (3 by default) under **Settings → Generations → Video Generation**.

**First frame** options:

- **New selfie, or the avatar if no selfie provider** (default): a new selfie when selfies are on and **Selfie model** is set, otherwise the avatar.
- **New selfie, then animate it**: always a new selfie, also saved to the Gallery. It needs selfies on and **Selfie model**.
- **Avatar or sprite**: the avatar, or a full-body sprite if there is no avatar.
- **Prompt only (no picture)**: no picture. Some ComfyUI workflows fail without one. If **Send Avatar References** includes videos, this reads **Prompt only (avatar from Send Avatar References)** and starts from the avatar.

With **Expose media prompts before sending** on, you review the selfie prompt together with the clip prompt.

Pictures in other formats, such as WebP, are converted for the video service. One video message is one video request, plus one image request when it starts from a new selfie. Your **Prompt Model** writes the video prompt, and **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** holds its instructions.

## Reference: the selfie tag

Characters ask for a selfie with a tag in their reply. You never type it. It looks like `[selfie]`, optionally with context:

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` and `[selfie: standing beside the river]` also work, in any letter case. Marinara removes the tag and posts the picture.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Image Generation Providers and Setup](../media/image-providers.md)
- [Image Style Profiles](../media/style-profiles.md)
