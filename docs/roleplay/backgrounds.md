# Roleplay Backgrounds

A Roleplay chat shows a full-scene image behind your messages. You can let the **Background** agent pick it after each reply, make a new one by hand, or pin one image to a single chat. When the image changes, Marinara fades from the old one to the new one.

Image generation is not required. Without an image generation account, the backdrop is a solid color and the chat works as text.

## Set a background for one chat

Use this to keep one image behind the chat you have open, instead of letting the agent choose. It changes only that chat.

1. Open the chat. Then open **Settings → Appearance → Backgrounds**.
2. Under **Chat Background**, pick an uploaded image or one of your game asset backgrounds.

You see the image behind your messages. To go back to the default, click **Remove** next to **Chat Background**.

No images yet? Upload one first. See [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Let the Background agent pick the backdrop

The **Background** agent is a helper that runs alongside replies. After each reply, it reads the current scene and picks the image that fits best from all your backgrounds. It picks existing images only. The **Illustrator** agent makes new ones automatically.

1. Open your Roleplay chat.
2. Open **Chat Settings** with the sliders button in the chat.
3. Open **Agents** and turn on **Enable Agents**.
4. Add the **Background** agent.

The backdrop now changes on its own as the story moves between places.

If it did not work: with only one or two backgrounds, the agent keeps picking those. Add more to your library. See [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Generate a background by hand

Marinara builds an image prompt from the scene (genre, setting, location, weather and time) and makes a new backdrop.

Before you start: install the **Illustrator** agent and set an image generation account for it, or mark one image generation account as the default. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md). You do not need to add Illustrator to the chat.

1. Open **Chat Settings** with the sliders button in the chat, and expand **Gallery**.
2. Click **Background**. It shows **Generating...** while it works, and the Gallery says "Illustrator is generating a background image for this scene."
3. Wait for it to finish. The new image is added to your background library and applied to the scene.

Manual generation uses the Illustrator agent's image account, then your default image generation account. It works in Roleplay and Game modes, not Conversation.

If it did not work: the message "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." means Marinara found no image account. Set one, then try again. If the **Background** button is missing, Illustrator is not installed.

## Weather versions of backgrounds

With this on, the background follows the story's weather. When it starts raining in the inn, Illustrator repaints the inn's background with rain on the windows. Indoors, the full-screen weather is turned off, so the rain shows only through the windows.

1. Open **Chat Settings** with the sliders button in the chat, and open **Agents → Illustrator**.
2. Turn on **Weather Versions of Backgrounds**.

What happens:

- Each picture and weather is made **once**. When the weather changes back, or the story returns to the inn in the rain, the saved version is shown again at no cost.
- The version is saved next to the original as `name--wx-rain.png` (or `snow`, `storm`, `fog`, `hail`, `sand`, `ash`, or `clear` for a dry copy of a picture first made in bad weather). The **Background** agent picks among your plain pictures and then shows the matching weather version when one exists.
- Clear, cloudy, windy and other light weather keep the plain picture.
- It needs the **World State** agent for the weather, and the Illustrator image model has to be able to start from a picture (most can, including OpenAI, Gemini, NovelAI and ComfyUI with an image input). Models that can't are skipped, and the picture stays as it is.
- It works for backgrounds in your library, whether you picked them, the Background agent did or Illustrator made them.

If it did not work: check that the chat's World State shows a **Weather**, and that **Illustrator** is added to the chat with an image model.

## Your library and blur

The images you pick from live in the same **Backgrounds** section. Importing, tags, renaming, deleting, the **Background Blur** slider and the default backdrop for new Roleplay chats are in [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Related guides

- [Chat Backgrounds](../appearance/chat-backgrounds.md): the upload library and appearance controls.
- [Scene Backgrounds](../media/scene-backgrounds.md): AI scene art made from your Gallery.
- [Roleplay Mode: Getting Started](getting-started.md): the Roleplay stage, sprites and HUD.
