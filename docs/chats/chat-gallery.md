# The Chat Gallery

The **Gallery** holds a chat's pictures and videos: illustrations, selfies, painted backgrounds, storyboard frames and anything you upload. It is a section of **Chat Settings**. On a computer you can pop it out into its own window (see [Chat Settings Overview](chat-settings.md#popping-a-section-out-into-its-own-window)).

A chat's Gallery belongs to that chat. Pictures you want to keep for a character, whatever chat they are in, go in the character's own Gallery. See [Character and Persona Galleries](../characters/galleries.md).

## Images and Videos

The **Gallery** has two tabs, **Images** and **Videos**. Each tab shows a count of how many items it holds. The **Videos** tab holds scene videos in Roleplay and Game chats, and video messages in Conversation chats.

At the top of the section, action buttons appear only when the matching feature applies to the chat:

- **Illustrate**: runs the Illustrator agent for a one-off scene image. See [Illustrator Agent](../media/illustrator-agent.md).
- **Selfie**: generates a character selfie in Conversation mode.
- **Background**: paints and applies a background for the current scene. See [Backgrounds Made by Illustrator](../media/scene-backgrounds.md#paint-a-background-now).
- **Video**: makes a scene video from the latest illustration. In Conversation mode, it sends a video message from a character instead; see [Video messages](../conversation/selfies.md#video-messages).
- **Create storyboard**: generates keyframes for the latest Game Mode turn or completed Roleplay episode when Storyboard is active.
- **Browse Images**: opens a browser of saved images to insert.
- **View storyboard**: opens the latest Game Mode storyboard.

Below the buttons is the **Upload Images** dropzone. Drag images onto it to add your own pictures to this chat's Gallery.

### Per-image actions

Move your pointer over an image in the **Images** tab, or tap it on mobile, to see its actions:

- Open the image full size (**Open gallery image**).
- **Pin to chat**: pins the image to the chat as a floating picture. Drag it to move it and use its corner handle to resize it. It keeps its place and size when you reload the page in this browser. The lock button next to the dismiss button stops it from moving or resizing until you unlock it.
- **Download image**: saves the image to your device.
- **Animate illustration**: turns that image into a scene video.
- **Copy prompt**: copies the saved image prompt. If the image has no saved prompt, this shows **No prompt saved** and is disabled.
- The tag button in the picture's top-left corner: **Use as background** labels it as a background and asks which places it shows, such as `John's bedroom`.
- **Add to a character's or persona's gallery** (the person button): keeps the picture in that character's or persona's own gallery, so it outlives this chat. Its background label and places come along, and it then follows that character into every chat. See [Backgrounds that follow a character](../roleplay/backgrounds.md#backgrounds-that-follow-a-character).
- **Delete gallery image**: removes the image after you confirm.

### Regenerating an image

You can make a generated image again without regenerating the reply it belongs to. This works for images in the chat's Gallery that have a saved prompt, such as illustrations, selfies and storyboard frames.

1. Open the image full size, from the Gallery or from the message it is in.
2. Click **Regenerate image** (the circular-arrow button at the top right of the picture).
3. Change what you want in the boxes under the picture: **Prompt**, **Negative prompt**, a box for each character under **Character prompts** when the image had them, and the image model.
4. Click **Generate image**, or **Cancel** to leave the image as it is.

The new image becomes the selected version in the message. Earlier results stay together in one Gallery tile with a version count. Each version keeps its saved prompt, negative prompt and other saved generation details. Reference pictures are sent again from the characters' current avatars, followed by the lorebook entry pictures the image was first drawn with. Stability AI, Arli AI, SD Web UI and Draw Things get no entry pictures. Some older images did not save their negative prompt and character prompts; the editor says so when that is the case.

### Image versions

Open a stacked image to choose a version. In a Gallery, left/right arrows, arrow keys and horizontal swipes move between tiles. Opening an image from a chat message stays within that image's stack. Up/down controls, arrow keys and vertical swipes on the picture move between versions in the current stack. Zoom out before navigating. Scrolling the prompt does not change versions.

Click the picture, prompt header or collapse button to use Up/Down for versions. Click prompt text or a copy button to use Up/Down for scrolling instead. Version controls also stay visible while regenerating or editing. Apply or clear a painted mask before switching versions; controls pause while generation runs.

The version you choose is saved and shown in the chat, including after a reload. Regenerating or editing an older version adds a new result to the same stack and keeps the later versions too. A branched chat has its own selection.

With **Automatically save generated images to character galleries** enabled, regenerations and edits keep the original image's character and persona gallery destinations. Those galleries group the versions too. Each gallery saves its own selected version, so browsing there does not change the picture selected in chat. Gallery entries share the saved image files; they do not make extra copies. Opening a gallery also restores missing versions from older chat stacks when their original gallery entry still links to the source chat. Versions deleted from an already grouped gallery stay deleted.

In the chat Gallery, use **Delete gallery image** on the tile, or the delete button in the viewer, to choose what to remove:

- **Delete this version** removes the displayed version. If it was selected, the newest remaining version is shown.
- **Delete other versions** keeps the displayed version and removes the rest.
- **Delete entire stack** removes every version and its image attachments from the chat.

These choices permanently delete the saved versions. **Cancel** keeps them all.

## Related guides

- [Illustrator Agent](../media/illustrator-agent.md): scene illustrations and clips.
- [Backgrounds Made by Illustrator](../media/scene-backgrounds.md): the **Background** button, weather versions and window stencils.
- [Character and Persona Galleries](../characters/galleries.md)
- [Scene Video Generation](../media/scene-video.md): turn a Gallery picture into a video.
