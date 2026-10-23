# Selfies

This guide covers selfies in Conversation Mode. A selfie is an image a character generates of themselves and sends into the chat, like a photo shared in a messaging app. This guide explains how to turn selfies on, how to set them up, and how to ask for one by hand.

## What selfies are

Selfies are a Conversation Mode feature. A character can send a generated picture of themselves during a normal chat. This is different from the scene pictures used in Roleplay Mode and Game Mode. Selfies are made for the messaging-app feel of Conversation Mode.

Selfies use image generation. Each selfie your character sends uses one image generation request from the connection you pick. Because of this, selfies are turned off until you set them up.

Selfies are supplied by the optional **Illustrator** package. Install Illustrator from **Agents → Download Agents** before setting them up.

## Turning selfies on

Selfies live inside **Illustrator Settings** in the **Agents** section of a Conversation chat. **Commands** are hidden actions that a character can take on their own, such as sending a selfie or playing a song. The command controls appear inside **Agents** when a command-providing package is installed.

To turn selfies on:

1. Open a Conversation chat.
2. Open **Chat Settings** (the sliders icon).
3. Find the **Agents** section.
4. Turn on the master **Commands** toggle inside it. Characters cannot use any hidden action while this is off.
5. Find **Illustrator Settings**.
6. Turn on the **Generated Selfies** switch.

After you turn on **Generated Selfies**, the selfie settings appear below the switch. You should see fields for the connection, prompt model, style, and references. The **Resolution** buttons appear only after you pick a **Selfie Connection**.

## Selfie settings

Once selfies are on, set up how they look and which service makes them. All of these settings are in **Illustrator Settings** in **Chat Settings → Agents**. They apply to the current chat only.

### Selfie Connection

**Selfie Connection** picks the image generation service that draws the picture. The default value is **None (selfies disabled)**, which means no service is chosen yet. Pick one of your configured image connections here.

Until you choose a **Selfie Connection**, characters cannot send selfies. If you see the note "Choose a Selfie Connection to let characters generate selfie images", the connection is still empty.

To learn how to add an image connection, see [Image Generation Providers and Setup](../media/image-providers.md).

### Prompt Model

**Prompt Model** picks the text model that writes the description of the selfie. The image connection then draws that description. The default value is **Main chat model**, which reuses the same model your chat already uses. You can pick a different text connection if you want another model to write the selfie description.

### Image Style

**Image Style** picks a Style Profile for the selfie. A Style Profile is a saved set of art-style words, such as "anime" or "realistic photo". The default value is **Use default style from Style Profiles in Advanced settings**, which follows your global default style.

To learn more about styles, see [Image Style Profiles](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** is a dropdown that is **Off** by default. It sits below the **Video messages** section, and each choice says what it applies to: **Images only**, **Videos only**, or **Images and videos**.

- For images, Marinara sends the character's avatar or sprite to the image service as a reference picture. This helps the selfie look like the character. It only works when the image provider supports reference images.
- For videos, a video message whose **First frame** is **Prompt only** starts from the character's avatar or sprite instead of no picture. Video services take a single starting picture, so the other first frames, which already start from a picture of the character, are not affected.

### Attach Card Appearance

**Attach Card Appearance** is a dropdown that is **Off** by default, with the same **Images only**, **Videos only** and **Images and videos** choices. It adds the card's appearance text of each character the prompt names to the selfie prompt, the video prompt, or both. This gives the model more detail about how the character looks.

If the card or persona also has **Image Appearance Override** turned on, Marinara sends that override instead of the **Appearance** text. Turn it on under **Appearance** in the Character or Persona editor when the full **Appearance** description is written for the narrator rather than for an image model. The AI that writes the selfie description still reads the card's **Appearance** too. It keeps the override's words exactly as written and uses the **Appearance** text only to fill in other details.

### Resolution

**Resolution** sets the size of the selfie image. The **Resolution** buttons appear only after you pick a **Selfie Connection**. Pick one of the quick buttons. The default is **896x1152**, a tall portrait shape that suits most selfies.

The size options are:

| Resolution | Shape              |
| ---------- | ------------------ |
| 512x512    | Square             |
| 512x768    | Portrait           |
| 768x768    | Square             |
| 768x1024   | Portrait           |
| 896x1152   | Portrait (default) |
| 1024x1024  | Square             |

## How a character sends a selfie

Once selfies are set up, a character can decide to send one during the chat on their own. You do not type a command. The character chooses the moment, and Marinara generates the picture and posts it in the chat. Later replies see a short note with what the selfie showed, so the character remembers sending it.

The model's response uses `[selfie]`, optionally with context:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` and `[selfie: standing beside the river]` also work. The command is case-insensitive, so `[SELFIE:xxxxx.]` is valid syntax. It is a Conversation command, not a Roleplay or Game Mode image trigger. A literal marker left in the message can indicate that the chat is in another mode or **Commands** is disabled. Confirm that Illustrator is installed, **Generated Selfies** is enabled and **Selfie Connection** is selected. If generation starts but fails, inspect the reported connection or image-provider error; changing the marker's capitalization will not fix it.

## Asking for a selfie by hand

You can also request a selfie yourself instead of waiting for the character.

1. Open **Chat Settings** and expand the **Gallery** section.
2. Click the **Selfie** button (the camera icon).
3. If the chat has more than one character, pick who should take the selfie from the character list next to the button.
4. If **Expose media prompts before sending** is enabled under **Settings**, **Generations**, **Overall Generations**, review or edit the final compiled selfie prompt and click **Generate**. Canceling the review does not send an image request.
5. Wait while the button shows **Generating...**.

When the selfie is ready, you should see a "Selfie generated." message, and the picture appears in the chat. This manual request also uses your chosen **Selfie Connection**, so it uses one image generation request too.

## Making a selfie again

Not happy with a picture? Click a selfie in the chat to open it, then click **Regenerate image** (the circular arrow next to the pin button). You can edit the prompt, the negative prompt and any character prompts, and pick an **Image connection**. Click **Generate image**. The new picture replaces the old one in the message, and the old one stays in the Gallery. Each try uses one image generation request.

Pictures made before this option existed can be made again too. They use the chat's selfie connection, and their negative and character prompts were not saved.

## Video messages

A character can also send you a short video clip. Type `/video`, or `/video Aster` to pick a character, or click **Video** in the chat's **Gallery** (the film icon), which uses the character picked in the Gallery. **Video** works whenever Illustrator is installed, even with selfies off. The clip arrives as a new message from that character and plays in the chat. When you ask for a clip this way, it shows the latest moment of the conversation: the AI writing it reads as many recent messages as Illustrator does for a picture (its **Agent Budget** context size). A selfie first frame reads the same messages, so the clip starts from that moment too. Later replies see a short note with what the clip shows. You can also animate a picture from the Gallery: the clip continues that picture, is sent by the character picked in the Gallery, and joins the newest reply. If a clip can't be added to the chat, it is still saved under the Gallery's **Videos** tab. A character's own gallery lists a video message only when the clip shows that character; see [Character and Persona Galleries](../characters/galleries.md).

Set this up under **Chat Settings**, **Agents**, **Illustrator Settings**, in the **Video messages** section:

- **Generated Videos** lets characters send you a video message on their own when it fits the conversation.
  - Like `/video`, the clip is written from the recent conversation, so a clip you ask for shows what you asked for.
  - It is off by default in new chats, because each clip is a video request. Turn it on here, or save it in a settings profile to have it on in new chats. The same switch appears as **Videos** in the **Commands** list of the new-chat setup and Chat Settings.
  - **Video Run Interval** (shown once it is on) sets how many messages must pass between these clips. **0** stops them.
  - `/video` and the Gallery's **Video** button work either way and ignore the interval.
  - Swiping a reply that sent a clip lets the new swipe send its own.
  - In a group chat, each character can send one clip per reply, up to **Videos per reply** (3 by default) under **Settings**, **Generations**, **Video Generation**.
- **Video Connection** picks the Video Generation connection. Leave it on **Default video connection** to use your default one. A connection's **Video Prompting Instructions** guide the AI that writes the video prompt.
- **First frame** picks the picture the clip starts from:
  - **New selfie, or the avatar if no selfie connection** (the default) makes a new selfie when selfies are on and a **Selfie Connection** is set, and otherwise uses the avatar.
  - **New selfie, then animate it** always makes a new selfie first. It needs selfies on and a **Selfie Connection**, and the selfie is also saved to the Gallery. With **Expose media prompts before sending** on, you review the selfie's prompt together with the clip's.
  - **Avatar or sprite** starts from the character's avatar, or a full-body sprite when there is no avatar.
  - **Prompt only (no picture)** sends no picture, so the video model works from the prompt alone. Some ComfyUI workflows need a picture and fail without one. When **Send Avatar References** includes videos, this choice reads **Prompt only (avatar from Send Avatar References)** and the clip starts from the avatar instead.

Pictures in other formats, such as WebP, are converted for the video service. A video message makes one video request, plus one image request when it starts from a new selfie. The AI that writes the prompt is your **Prompt Model**, and **Settings**, **Generations**, **Video Generation Prompt Overrides**, **Conversation Video Message** holds its instructions.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Image Generation Providers and Setup](../media/image-providers.md)
- [Image Style Profiles](../media/style-profiles.md)
