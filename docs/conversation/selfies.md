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

**Send Avatar References** is a toggle that is off by default. When it is on, Guksu sends the character's avatar or sprite to the image service as a reference picture. This helps the selfie look like the character. It only works when the image provider supports reference images.

### Attach Card Appearance

**Attach Card Appearance** is a toggle that is off by default. When it is on, Guksu adds the character card's appearance text to the selfie description. This gives the model more detail about how the character looks.

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

Once selfies are set up, a character can decide to send one during the chat on their own. You do not type a command. The character chooses the moment, and Guksu generates the picture and posts it in the chat.

## Asking for a selfie by hand

You can also request a selfie yourself instead of waiting for the character.

1. Open the chat **Gallery** panel.
2. Click the **Selfie** button (the camera icon).
3. If the chat has more than one character, pick who should take the selfie from the character list next to the button.
4. If **Expose media prompts before sending** is enabled under **Settings**, **Generations**, **Image Generation**, review or edit the final compiled selfie prompt and click **Generate**. Canceling the review does not send an image request.
5. Wait while the button shows **Generating...**.

When the selfie is ready, you should see a "Selfie generated." message, and the picture appears in the chat. This manual request also uses your chosen **Selfie Connection**, so it uses one image generation request too.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Image Generation Providers and Setup](../media/image-providers.md)
- [Image Style Profiles](../media/style-profiles.md)
