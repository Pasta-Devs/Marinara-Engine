# Character and Persona Galleries

This guide covers the **Gallery** tab inside the character and persona editors. It explains how to add images and videos that stay attached to a character or persona. It also shows how to tag a gallery image as a custom emoji or sticker.

## The Gallery tab

Every character and every persona has its own **Gallery** tab. Open a character in the **Character Editor**, or a persona in the **Persona Editor**, then click the **Gallery** tab (camera icon).

The Gallery has two sub-tabs:

- **Images**: pictures you upload for this character or persona.
- **Videos**: videos you upload, plus scene videos and video-call clips tied to this character.

A character's gallery is titled **Character Gallery**. A persona's gallery is titled **Persona Gallery**. Both work the same way.

## How the Gallery differs from a chat's gallery

Gallery images belong to the character or persona, not to one chat. If you delete a chat, these gallery images stay. Use the Gallery for reference sheets, outfit variants, or imported character image packs.

A chat's own gallery is different. It holds scene-specific illustrations and generated message attachments for that single chat. Keep short-lived scene art in the chat gallery. Keep lasting character art in the character or persona Gallery.

## Adding images

1. Open the character or persona editor.
2. Click the **Gallery** tab.
3. Make sure the **Images** sub-tab is selected.
4. Drag image files onto the **Upload Character Images** box, or click it to pick files. In a persona, this box is labeled **Upload Persona Images**.
5. Wait for the upload to finish. Your new gallery images appear in the grid below.

You can upload common image types, such as JPG, PNG, GIF, WebP, and AVIF. Click any image to open a larger view. Each image tile also has a download control and a delete control.

## Adding videos

1. Click the **Gallery** tab.
2. Select the **Videos** sub-tab.
3. Drag video files onto the **Upload Character Videos** box, or click it to pick files. In a persona, this box is labeled **Upload Persona Videos**.
4. Wait for the upload to finish.

Supported video types are MP4, WebM, and MOV. The **Videos** sub-tab also lists scene videos generated in chats with this character, plus any video-call clips. They are sorted with the newest first.

## Tagging a gallery image as a custom emoji or sticker

You can turn a gallery image into a custom emoji or a sticker for **Conversation Mode** (the messenger-style chat mode). A custom emoji is a small inline image written as `:name:`. A sticker is a larger block image written as `sticker:name:`. These only work in Conversation Mode chats.

To tag an image:

1. Open the **Gallery** tab and select the **Images** sub-tab.
2. Find the image you want. In its top-left corner is a small tag button, with the tooltip **Tag as emoji or sticker**.
3. Click the tag button. A menu opens with **Make emoji** and **Make sticker**.
4. Click **Make emoji** or **Make sticker**.
5. In the **Custom Emoji** or **Custom Sticker** dialog, type a name, then confirm.

The name uses lowercase letters, numbers, and underscores, up to 32 characters. Other characters are converted for you. For example, "Big Grin" becomes `big_grin`.

Size limits depend on the kind you pick, not on the gallery. An emoji image must be no larger than 256 by 256 pixels. A sticker image must be no larger than 512 by 512 pixels. If the image is too big, an error message appears and the tag is not applied.

### Managing a tagged image

Once an image is tagged, its overlay button shows the assigned name. Click it to open a menu with more options:

- **Rename**: change the name.
- **Switch to sticker** or **Switch to emoji**: change which kind it is. The switch re-checks the size limit of the new kind. A sticker image larger than 256 by 256 pixels is too big to become an emoji. If that happens, an error appears and the kind stays the same.
- **Remove emoji** or **Remove sticker**: untag the image. This does not delete the image from the Gallery.

### Where these scoped emojis and stickers work

A gallery-tagged emoji or sticker is scoped to that one character or persona. It only works in Conversation Mode chats that include that character or persona. This is separate from the global emoji and sticker pools that live in the message composer.

If a gallery name matches a name in the global pool, the gallery version wins for that chat. Names are not checked for uniqueness. Pick a distinct name for each image to avoid surprises.

## Reuse a gallery image in messages and greetings

Any image in a character's Gallery can be displayed inside chat text: a greeting, an example message, or a message the character sends. Hover a gallery image and click **Copy image reference** (the link icon). It copies a small piece of Markdown you can paste anywhere the character speaks:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

The one rule: **`self` means the character who is speaking that message.** When the message renders, Marinara replaces `self` with that character and shows the image from their gallery.

Where it works:

- **First Message**, **Alternate Greetings**, and **Example Dialogue** on the character card. The field's Markdown preview shows the image while you edit.
- Any message a character sends, in **Roleplay** and **Conversation** mode alike.
- **Group chats**: in a multi-speaker reply, `self` resolves per speaker, so each character's line shows that character's own gallery image. If the speaker's gallery does not have the file, Marinara looks it up in the other chat characters' galleries, so the right image still appears even when a reply is merged under one speaker.

Where it does not work, by design:

- **Your own messages**. They have no speaking character, so a `self` reference shows as a broken image. If you want to post a character's gallery image yourself, use the chat asset browser's insert (which writes the full `card://characters/<id>/...` form).
- **System messages**. They do not render Markdown image syntax at all, so a reference shows as literal text.
- **Persona galleries**. Persona images appear in your messages, which have no speaker. Use the persona form `card://personas/<id>/gallery/<file>` instead.

One nuance for group chats: if two characters in the chat have gallery images with the **same filename**, the speaking character's image always wins. When the speaker does not have the file, the **first match wins**: the other characters are checked in the chat's character order. Give shared-name images distinct filenames if you need a specific character's version to show from another character's line.

### Why `self` instead of the full link

A full link contains the character's internal id (`card://characters/<id>/gallery/<file>`), and ids are regenerated whenever a character is imported, so full links break for anyone you share the character with. The `self` form carries no id and no server address. It survives a **native JSON export and import**: the gallery images travel inside the export and keep their filenames, so every reference keeps working on the other side.

One honest caveat: **PNG card exports do not include the gallery**, so no gallery reference of any kind can work after a PNG-only share. Ship the native `.json` export when your character uses gallery images.

### Save web images from greetings

Many cards show images from other websites in their greetings, and those links can break or change. When the **First Message** or **Alternate Greetings** show web images, **Dialogue & Greetings** has a **Save images locally** button. It downloads those images into the character's Gallery and swaps each link for a `card://self/gallery/...` reference, so the images still show if the website removes them or you are offline. Save the character afterwards to keep the new links.

Nothing is downloaded until you press the button. Only PNG, JPEG, GIF, and WebP images up to 10 MB and 40 megapixels are saved. Links to your own computer or home network are refused. An image that can't be saved keeps its web link, and a notice says why.

**Restore web links** puts the original links back in the greetings. The saved copies stay in the Gallery until you delete them. Compatible JSON and PNG exports use the original web links, since those cards carry no gallery. Lorebook images are not covered.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [User Personas: Creating and Editing](personas.md)
- [Custom Emojis, Stickers, and GIFs](../conversation/emoji-stickers-gifs.md)
- [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md)
