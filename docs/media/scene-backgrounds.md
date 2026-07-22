# Scene Backgrounds and the Gallery

This guide covers AI-generated scene backgrounds, the backdrop images Marinara Engine creates for you from the **Gallery**, and the Gallery panel itself. Two related guides exist: [Chat Backgrounds](../appearance/chat-backgrounds.md) covers the hand-picked upload library, and [Roleplay Backgrounds](../roleplay/backgrounds.md) covers the agent that auto-picks a backdrop each turn.

## Where scene backgrounds work

Scene backgrounds work in Roleplay and Game modes. They are not available in Conversation mode. If you try to generate one in Conversation mode, the app shows this message:

```
Scene background generation is available in Roleplay and Game modes.
```

To generate a background, you need an **Image Generation** connection. Set one up first if you have not already. See [Image Generation Providers and Setup](image-providers.md).

## Generating and applying a background from the Gallery

The **Gallery** is the image and video panel for a chat. Open it from the image icon in the chat toolbar. The **Background** button lets you generate background art for the current scene.

To generate a background:

1. Open the **Gallery** panel.
2. Click the **Background** button.
3. The button label changes to **Generating...** while the image is made.
4. You should see this status message: "AI background generation is running. The new background will be applied when it finishes."
5. When it finishes, the new image is applied to the current scene right away. A "Background generated." message confirms it.

The background is built from your current scene. In a game, this includes the genre, setting, location, weather, and time of day. Generated backgrounds use the **Backgrounds** canvas size, which is 1280 by 720 pixels by default. You can change that size under **Settings**, then **Generations**, then **Image Generation**.

### If no image connection is set

If Marinara cannot find an image connection to use, the generate step fails with this message:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

To fix this, open the **Connections** panel, expand **Defaults**, and choose an image connection under **Images**, or set an image connection override on the **Illustrator** agent.

## The Gallery panel

The **Gallery** has two tabs, **Images** and **Videos**. Each tab shows a count of how many items it holds. The **Videos** tab is available only when scene videos are enabled for the chat.

At the top of the panel, action buttons appear only when the matching feature applies to the chat:

- **Illustrate**: runs the Illustrator agent for a one-off scene image. See [Illustrator Agent](illustrator-agent.md).
- **Selfie**: generates a character selfie in Conversation mode.
- **Background**: generates and applies a scene background, as described above.
- **Video**: makes a scene video from the latest illustration.
- **Create storyboard**: generates Game Mode storyboard keyframes.
- **Browse Images**: opens a browser of saved images to insert.
- **View storyboard**: opens the latest Game Mode storyboard.

Below the buttons is the **Upload Images** dropzone. Drag images onto it to add your own pictures to this chat's Gallery.

### Per-image actions

Move your pointer over any image in the **Images** tab, or tap it on mobile, to reveal its actions:

- Open the image full size (**Open gallery image**).
- **Pin to chat**: pins the image to the chat.
- **Download image**: saves the image to your device.
- **Animate illustration**: turns that image into a scene video.
- **Copy prompt**: copies the saved image prompt. If the image has no saved prompt, this shows **No prompt saved** and is disabled.
- **Delete gallery image**: removes the image after you confirm.

## Reviewing a prompt before it is sent

You can check and edit the prompt before Marinara sends a background request to your image provider.

1. Open **Settings**, then **Generations**, then **Image Generation**.
2. Turn on **Expose media prompts before sending**.

With this setting on, a **Review Image Prompt** window opens before each request is sent. Its help text reads: "Edit the prompt below before Marinara sends the image request to your provider."

In the window, you can:

- Edit the prompt text and the negative prompt.
- See the image kind and size, plus a live character count.
- Click **Cancel** to stop, or **Generate** to send.

If any prompt box is empty, **Generate** is disabled and you see this note: "Every image request needs a prompt." The text you type is sent exactly as written.

## Managing your saved backgrounds

Every scene background you generate is saved to your background library. You can also add your own images to that same library. Uploaded backgrounds accept JPG, PNG, GIF, WebP, and AVIF files, up to 20 MB each.

You can tag, rename, and delete backgrounds you added. Tags are lowercase and can hold letters, numbers, spaces, hyphens, and underscores, up to 40 characters each. Built-in game-asset backgrounds appear alongside your own, but you cannot rename, tag, or delete them.

You manage this library and set a per-chat or default backdrop from the appearance settings. For the full library, the picker, and **Background Blur**, see [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Related guides

- [Chat Backgrounds](../appearance/chat-backgrounds.md): the upload library you pick from by hand.
- [Roleplay Backgrounds](../roleplay/backgrounds.md): the agent that auto-picks a backdrop each turn.
- [Illustrator Agent](illustrator-agent.md): scene illustrations for Roleplay and Game modes.
- [Image Generation Providers and Setup](image-providers.md): set up an image connection.
- [Scene Video Generation](scene-video.md): turn a Gallery image into a video.
