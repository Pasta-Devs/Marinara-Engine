# Chat Backgrounds

This guide covers the background library in Marinara Engine. These are images you upload and pick from by hand to sit behind your chat. For the **Background** agent that picks a scene backdrop for you each turn, see [Roleplay Backgrounds](../roleplay/backgrounds.md). For AI-generated scene backgrounds you make from the Gallery, see [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md).

## Where to find backgrounds

You manage backgrounds in one place: **Settings**, then the **Appearance** tab, then the **Backgrounds** section.

The **Backgrounds** section has three parts:

1. The **Chat Background** picker, where you choose the image for the chat you are in.
2. The **Background Blur** slider.
3. The background library, where you import, organize, filter, tag, rename, and delete images.

A chat background only shows in Roleplay and Game mode chats. Conversation mode uses a gradient instead, which you set in the **Conversation Theme** section. See [Appearance Settings](appearance-settings.md) for that.

## The background library

The library holds every image you can pick from. It mixes images you uploaded with the built-in art bundled with Marinara. Each image shows a small label so you can tell them apart:

- **Library**: an image you uploaded yourself. You can rename, tag, and delete these.
- **Game asset**: a built-in image bundled with Marinara. These are read-only. You cannot rename, tag, or delete them.

### Import a background

1. Find the **Import Backgrounds** box at the top of the library.
2. Drag one or more image files onto the box, or click it to pick files.
3. Wait for the upload to finish. The box shows **Importing...** while it works.
4. Your new images appear in the grid below with the **Library** label.

You can import several files at once. Each file must be an image in one of these formats: JPG, PNG, GIF, WebP, or AVIF. Each file can be up to 20 MB.

Marinara checks the real contents of every file, not just its name. If you rename a non-image file to end in `.png`, the upload is rejected.

### Pick a background for the current chat

1. Open **Settings**, then **Appearance**, then **Backgrounds**.
2. In the grid, click the thumbnail you want.
3. A checkmark appears on the selected image. It becomes the background for the chat you have open.
4. To go back to the default, click the selected thumbnail again, or click the **Remove** button next to **Chat Background**.

### Search the library

Use the **Search backgrounds** box above the library to filter by name, tag, or source. The count line shows how many images match, for example "3 of 20 backgrounds". Click the small X in the search box to clear it.

Use the selector beside search to sort backgrounds **A-Z**, **Z-A**, **Newest**, or **Oldest**. Select **All** to clear tag filters, or expand **Tags** and select one or more tags. When several tags are selected, a background matches if it has any selected tag.

### Organize backgrounds into folders

Folders organize the library without moving or hiding the underlying image files.

1. Click **New Folder**. Marinara creates a uniquely named folder.
2. Double-click or double-tap the folder name to rename it. You can also focus it and press F2.
3. On desktop, drag a background row into a folder. On a phone or tablet, drag it by the visible grip handle.
4. Drag a background back into the unfiled area to remove it from its folder.

Folders and assignments are saved on the server and included in backups. Deleting a folder returns its backgrounds to the unfiled list; it does not delete the images. Search and tag filters automatically reveal matching items inside their folders.

The **Background** agent still sees every available background, including backgrounds placed in folders. Folders affect organization in Settings only.

### Rename a background

You can only rename images with the **Library** label.

1. Hover over the image row and click the pencil icon (**Rename**).
2. Type the new name. You do not need to type the file extension.
3. Click **Save**.

### Tag a background

Tags help you group and search your uploads. You can only tag images with the **Library** label.

1. Click the tag icon (**Edit tags**) on the image row.
2. Type a tag in the **Add tag...** field. As you type, Marinara suggests tags you used before.
3. Press Enter or click **Add**.
4. To remove a tag, click the small X on that tag chip.

### Delete a background

You can only delete images with the **Library** label. Hover over the image row and click the trash icon, then confirm the deletion. If the image was the current chat background or the default Roleplay background, Marinara switches back to the built-in default for you.

## Setting a default Roleplay background

The default Roleplay background is the image every new Roleplay chat starts with, before it picks its own. Set it once and every new Roleplay chat uses it.

1. In the **Backgrounds** section, find the image you want in the grid.
2. Click the star icon (**Set as default for new Roleplay chats**) on that image row.
3. The star fills with color without moving from its position. New Roleplay chats now start with it.

To go back, click the star on the current default image. You can also click the **Reset Roleplay default** link near the top of the grid. That link only appears when your default background differs from the built-in one.

## Background Blur

**Background Blur** softens the background image behind the chat so text is easier to read. It applies to Roleplay and Game mode backgrounds.

1. In the **Backgrounds** section, find the **Background Blur** slider.
2. Drag it from 0 to 24. Higher numbers mean more blur.
3. Set it to 0 to keep backgrounds sharp. At 0 the value reads **Off**.

The default is 0 (**Off**).

## How your uploads and built-in backgrounds mix

The library shows your uploads and the built-in **Game asset** images together in one grid. You pick from both the same way. The difference is that **Game asset** images are read-only, so the rename, tag, and delete controls do not appear on them.

AI-generated scene backgrounds you create from the Gallery also land in this same library, so you can reuse them later. See [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md).

## Where your background choices are saved

Two different settings decide what background a chat shows, and they save in different ways:

- The **Chat Background** you pick for a chat is saved with that chat on the server. It follows the chat to any device you open it on.
- Background folders and their assignments are saved on the server and follow the library to other devices.
- The default Roleplay background and **Background Blur** are saved per device. They do not sync between browsers or devices. For the full sync model, see [Appearance Settings](appearance-settings.md).

## Automatic and AI-generated backgrounds

This guide covers the library you pick from by hand. Two related features handle backgrounds for you:

- The **Background** agent can pick a scene backdrop from your library on its own, turn by turn, in Roleplay chats. See [Roleplay Backgrounds](../roleplay/backgrounds.md).
- The Gallery can generate a brand new scene background with AI from the current scene. See [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md).

## Related guides

- [Roleplay Backgrounds](../roleplay/backgrounds.md): the Background agent that auto-picks a backdrop each turn.
- [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md): AI-generated scene backgrounds made from the Gallery.
- [Appearance Settings](appearance-settings.md): the full Appearance tab, including which settings sync and which stay on one device.
