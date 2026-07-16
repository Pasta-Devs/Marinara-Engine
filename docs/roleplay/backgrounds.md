# Roleplay Backgrounds

This guide covers the scene backdrop in Roleplay Mode: the **Background** agent that picks a backdrop for you after each reply, making a backdrop by hand, and pinning one to a single chat. Your uploaded background library and its controls are covered in [Chat Backgrounds](../appearance/chat-backgrounds.md), and AI scene art made from the Gallery is covered in [Scene Backgrounds](../media/scene-backgrounds.md).

## The scene background

Roleplay Mode shows a full scene backdrop behind your messages. When the backdrop changes, Marinara cross-fades smoothly from the old image to the new one, so scene changes feel gentle instead of jumpy.

You do not need image generation for this to work. If you have not set up an image generation connection, the backdrop shows as a solid color. Your chat still works as normal text chat.

## The Background agent

The **Background** agent is an optional helper that chooses a scene backdrop for you. It runs after each reply. It reads the current scene, then picks the most fitting image from every available background. Library folders are only an organization aid in Settings and never hide choices from the agent. If a location has no matching image, it can generate a new one for you.

The **Background** agent is off by default. To turn it on:

1. Open your Roleplay chat.
2. Open **Chat Settings** (the gear icon).
3. Open the **Agents** section.
4. Enable the **Background** agent.

After that, the scene backdrop updates on its own as your story moves between places.

## Generate a background by hand

You can also make a new backdrop yourself, without the agent. Marinara builds an image prompt from the scene (its genre, setting, current location, weather, and time) and creates a fresh backdrop.

1. Open the **Gallery** (the image icon in the chat toolbar).
2. Click the **Background** button.
3. Wait for the button to finish. It shows **Generating...** while it works.

While it runs, you see this note: "AI background generation is running. The new background will be applied when it finishes." The new image is added to your background library and applied to the scene.

Manual generation and the **Background** agent both need an image generation connection. Marinara uses the connection set for the **Background** agent first. If none is set, it falls back to the **Illustrator** agent's connection, then to your default image generation connection. If it cannot find one, generation fails with this message: "Choose an image generation connection for the Background/Illustrator agent, or mark an image generation connection as the default for agents."

Scene background generation works only in Roleplay and Game modes. It is not available in Conversation mode.

## Set a background for one chat

You can pin a specific backdrop to the chat you are viewing, instead of letting the agent choose.

1. Open **Settings**.
2. Open the **Appearance** tab.
3. Find the **Backgrounds** section.
4. Under **Chat Background**, pick an uploaded image or one of your game asset backgrounds.

To go back to the default backdrop, click **Remove** next to **Chat Background**.

## Your background library and blur

The images you can pick from live in the same **Backgrounds** section under **Settings** and then **Appearance**. The [Chat Backgrounds](../appearance/chat-backgrounds.md) guide covers that library in full: importing images, tags, renaming, deleting, the **Background Blur** slider, and setting a default backdrop for new Roleplay chats.

## Related guides

- [Chat Backgrounds](../appearance/chat-backgrounds.md): the upload library and appearance controls for backgrounds.
- [Scene Backgrounds](../media/scene-backgrounds.md): AI-generated scene art made from your Gallery.
- [Roleplay Mode: Getting Started](getting-started.md): the full Roleplay scene, sprites, and HUD.
