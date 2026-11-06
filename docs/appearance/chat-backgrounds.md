# Chat Backgrounds

The background library holds images you upload and pick by hand to sit behind your chat. For the **Background** agent that picks a backdrop for you each turn, see [Roleplay Backgrounds](../roleplay/backgrounds.md). For AI-generated backgrounds made from the Gallery, see [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md).

A chat background shows in all chat modes. In Conversation chats, the gradient from **Conversation Theme** stays over the image, and **Conversation background image opacity** sets how strongly the image shows. See [Appearance Settings](appearance-settings.md).

## Change the background of a chat

Before you start: open the chat you want to change. The background you pick applies to that chat.

1. Open **Settings**, then **Appearance**, then the **App** button.
2. In **Backgrounds**, tap **Browse library**.
3. Tap a picture. It becomes this chat's background, and the window closes.

To use your own image, import it first (see [Import a background](#import-a-background)).

## Where to find backgrounds

1. Open **Settings**.
2. Select the **Appearance** tab, then the **App** button.
3. Find the **Backgrounds** section.

It has the **Chat Background** picker, the **Background Blur** slider, and the **Conversation background image opacity** and **Chat List Backgrounds** controls (see [Appearance Settings](appearance-settings.md)).

The picker shows a preview of the current background, or **Default background** when none is chosen. Under it, up to three **Recent** backgrounds are one tap away. Click **Browse library** to open the **Background Library** window.

## The background library

The library mixes images you uploaded with art bundled with Marinara. Each image has a label.

| Label | Meaning |
| --- | --- |
| **My upload** | An image you uploaded. You can rename, tag and delete it. |
| **Game asset** | Built-in art. It is read-only: no rename, tags or delete. |

The **Filter by source** buttons, **All sources**, **My uploads** and **Game assets**, show how many images each holds.

### Import a background

1. In the **Background Library** window, find **Import Backgrounds** next to the search box.
2. Tap or click it and pick image files. You can pick several at once. On a computer you can also drop files on it.
3. Wait. It shows **Importing…** while it works.

The new images appear in the grid with the **My upload** label.

Each file must be JPG, PNG, GIF, WebP or AVIF, up to 20 MB. Marinara checks what is inside the file, not its name. A non-image renamed to `.png` is rejected.

### Pick a background for the current chat

1. Open **Browse library**.
2. Click a thumbnail. A check mark appears, the image becomes this chat's background, and the window closes.
3. To go back to the default, click the selected thumbnail again, or click the X (**Clear selection**) on the preview.

### Search and filter

- **Search backgrounds** filters by name, tag or source. A count line shows how many match, for example "3 of 20 backgrounds". Click the X in the box to clear it.
- **Sort backgrounds** offers **Manual order**, **A-Z**, **Z-A**, **Newest** and **Oldest**. With **Manual order**, drag to reorder, or press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd> on a focused image.
- The folder chips **All folders**, **Favorites** and **Unfiled**, plus one chip per folder, filter by folder.
- Under tags, **All** clears tag filters. Expand **Tags** and pick one or more tags. An image matches if it has any picked tag.

Click the star on an image to add it to your favorites. It does not change the default background.

### Organize backgrounds into folders

Folders organize the library without moving or hiding the image files.

1. Click **New Folder**, type a name and click **Add**.
2. Tap an image's **Move to folder** button and pick the folder. Or drag the image onto a folder chip. On a phone or tablet, press and hold the image, then drag.
3. To bring an image back, drag it onto **Unfiled**.
4. Select a folder chip to show the pencil (**Rename folder**) and trash (**Delete folder**) buttons.

Deleting a folder returns its images to **Unfiled** and does not delete them. Folders are saved on the server and included in backups. The **Background** agent still sees every background, including those in folders.

### Rename a background

Only **My upload** images can be renamed.

1. Click the pencil (**Rename background**) on the image.
2. Type the new name. You do not need the file suffix.
3. Click **Save**.

### Tag a background

Only **My upload** images can be tagged.

1. Click the tag icon (**Edit tags**) on the image.
2. Type a tag in **Add tag…**. Marinara suggests tags you used before.
3. Press <kbd>Enter</kbd> or click **Add**.

To remove a tag, click it while editing tags.

### Download a background

Click the download icon (**Download background**) on any image, including built-in ones. On an iPhone or iPad, the share sheet opens. If it does not, tap **Save file** in the message that appears.

### Delete a background

Only **My upload** images can be deleted.

1. Click the trash icon (**Delete background**) on the image.
2. Confirm.

If it was the current chat background or the default Roleplay background, Marinara switches back to the built-in default.

## Set a default Roleplay background

The default Roleplay background is the image every new Roleplay chat starts with.

1. In the **Background Library** window, find the image.
2. Click its pin icon (**Set as default for new Roleplay chats**).

The thumbnail shows a **Default** label. To undo it, click the pin on that image again, or click **Reset Roleplay default** above the grid. That button appears only when your default differs from the built-in one.

## Background Blur

**Background Blur** softens the background behind the chat so text is easier to read. It applies to backgrounds in all chat modes.

1. In the **Backgrounds** section, find the **Background Blur** slider.
2. Drag it from 0 to 24. Higher means more blur.

At 0 it reads **Off**, and backgrounds stay sharp. The default is 0.

## Where your background choices are saved

| Setting | Saved |
| --- | --- |
| The **Chat Background** for a chat | With that chat on the server. It follows the chat to any device. |
| Folders and their assignments | On the server, with the library. |
| The default Roleplay background and **Background Blur** | Per device. They do not sync between browsers or devices. |

For the full sync model, see [Appearance Settings](appearance-settings.md).

## Related guides

- [Roleplay Backgrounds](../roleplay/backgrounds.md): the Background agent that picks a backdrop each turn.
- [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md): AI-generated scene backgrounds made from the Gallery. They also land in this library.
- [Appearance Settings](appearance-settings.md): the full Appearance tab.
