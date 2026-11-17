# Character and Persona Galleries

The **Gallery**, part of the **Images** tab in the character and persona editors, keeps images and videos attached to a character or persona, so they stay even if you delete chats. Use it for reference sheets, outfit variants and imported image packs. You can also create new images with AI, and tag a gallery image as a custom emoji or sticker.

## Find the Gallery

Every character and persona has its own gallery. Open the character in the Character Editor or the persona in the Persona Editor, click the **Images** tab, then **Gallery** at the top of it. A character's gallery is titled **Character Gallery**, and a persona's is **Persona Gallery**. They work the same way.

The Gallery has two sub-tabs:

- **Images** holds pictures you upload.
- **Videos** holds videos you upload, plus scene videos and video-call clips tied to this character.

A chat's own gallery is different. It holds scene illustrations and generated attachments for that one chat. Keep short-lived scene art there, and lasting art here.

### Add images

1. Open **Images → Gallery** and select **Images**.
2. Drag image files onto **Upload Character Images**, or click it to pick files. In a persona the box reads **Upload Persona Images**.
3. Wait for the upload to finish. The new images appear in the grid.

Click an image to see it larger. Each tile has a download control and a delete control.

### Add videos

1. Open **Images → Gallery** and select **Videos**.
2. Drag video files onto **Upload Character Videos**, or click it to pick files. In a persona the box reads **Upload Persona Videos**.
3. Wait for the upload to finish.

Supported types are MP4, WebM and MOV. Newest videos are listed first. To see which scene videos and clips appear for which character, see [Which videos are listed](#which-videos-are-listed).

## Create images with AI

**Create with AI** in the Gallery makes new pictures for this character or persona with your image generation connection. Pick what to make in **Type**:

| Type                | What you get                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Character sheet** | A reference sheet, saved the same way as from the **Character Sheet** section.                                             |
| **Background**      | A wide picture of a place, started from the card's scenario. It is saved to the Gallery and labelled as a chat background. |
| **Sticker sheet**   | One picture with several stickers, cut into one sticker per picture.                                                       |
| **Emoji sheet**     | The same, as small face emoji.                                                                                             |

Before you start: add an image generation connection.

1. Open **Images → Gallery** and click **Create with AI**.
2. Pick a **Type**, and edit the prompt if you want a different look or place.
3. For a sticker or emoji sheet, list the names in **Stickers to draw** or **Emoji to draw**, separated by commas. Up to 16 fit on one sheet.
4. Click **Generate**.
5. Click **Save as Background**, **Save Stickers** or **Save Emoji**, or **Save as Character Sheet**.

### Fix how a sheet was cut

After a sticker or emoji sheet is generated, each sticker is found by its outline, its green background is removed, and it appears as its own tile with its name. Saved stickers are at most 512 by 512 pixels and emoji at most 256 by 256, and each is tagged with its name.

- Click a tile to keep or skip it. Skipped tiles are not saved.
- Edit the name under a tile to rename it.
- Click **Recut with a box** on a tile to place a box on the whole sheet. Drag the box, pull its corners, or draw a new box around the sticker, then click **Use this box**.
- Click **Add a sticker** or **Add an emoji** to cut out one that was missed.
- Click **Cut again** to start the cutting over and undo your boxes.

### Write the whole prompt yourself

The prompt sent to the image model is built from the fields in the dialog. To change all of it, for example to ask for stickers of things the character likes and not only of the character, click **Edit full prompt**. It is sent exactly as you write it. Changes to the other fields are added only when you click **Rebuild**, which also replaces your edits. Click the close button next to **Rebuild** to go back to the built prompt.

## Tag a gallery image as a custom emoji or sticker

A custom emoji is a small inline image written as `:name:`. A sticker is a larger block image written as `sticker:name:`. Both work only in Conversation Mode chats, the messenger-style mode.

1. Open **Images → Gallery** and select **Images**.
2. Click the small tag button in the image's top-left corner (tooltip **Tag as emoji or sticker**).
3. Click **Make emoji** or **Make sticker**.
4. In the **Custom Emoji** or **Custom Sticker** dialog, type a name and confirm.

A name uses 1 to 32 lowercase letters, numbers and underscores. Other characters are converted for you, so "Big Grin" becomes `big_grin`.

If it did not work: an emoji image must be no larger than 256 by 256 pixels, and a sticker no larger than 512 by 512. If the image is too big, an error appears and nothing is tagged.

### Manage a tagged image

Once an image is tagged, its overlay button shows the name. Click it for more options:

- **Rename** changes the name.
- **Switch to sticker** or **Switch to emoji** changes the kind. The new kind's size limit is checked, so a sticker larger than 256 by 256 cannot become an emoji. An error appears and the kind stays.
- **Remove emoji** or **Remove sticker** untags the image. The image stays in the Gallery.

A gallery-tagged emoji or sticker works only for that one character or persona, in Conversation Mode chats that include them. This is separate from the global emoji and sticker pools in the message composer. If a gallery name matches a global name, the gallery version wins in that chat. Names are not checked for uniqueness, so pick a distinct name for each image.

## Describe pictures

Any gallery picture can have a short description of what it shows. Conversation chats use the descriptions of tagged emojis and stickers to choose which ones to offer (see [Describe emojis and stickers](../conversation/emoji-stickers-gifs.md#describe-emojis-and-stickers)). A description is saved with the picture and travels in a **Marinara Native** export.

- To write one, click the tag button in the image's top-left corner and choose **Add description**, or **Edit description** to change it.
- To have AI write them, click **Select images**, pick the pictures, then click **Describe with AI**. The **Image reading** model looks at each one and writes a short description. If some already have one, choose to describe only the ones without or all of them again.

Before you start: AI descriptions need a model that can read images. Marinara uses the **Image reading** model if you set one under **Behind the scenes** in your connection settings, and otherwise your agents' model. Up to 8 pictures are sent at a time, so a large selection takes a moment.

A chat's own gallery has the same **Describe with AI** in its select mode.

## Reuse a gallery image in messages and greetings

Any image in a character's Gallery can show inside chat text: a greeting, an example message or a message the character sends. Hover a gallery image and click **Copy image reference** (the link icon). It copies a piece of Markdown to paste wherever the character speaks:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` means the character who is speaking that message. When the message shows, Marinara replaces `self` with that character and loads the image from their gallery.

It works in:

- **First Message**, **Alternate Greetings** and **Example Dialogue** on the character card. The field's Markdown preview shows the image while you edit.
- Any message a character sends, in Roleplay and Conversation mode.
- Group chats. In a multi-speaker reply, `self` resolves for each speaker. If the speaker's gallery lacks the file, Marinara checks the other characters in the chat, in chat order. If two characters have the same filename, the speaker's own image wins.

It does not work in:

- **Your own messages**. They have no speaking character, so a `self` reference shows as a broken image. To post a character's image yourself, use the chat asset browser's insert, which writes the full `card://characters/<id>/...` form.
- **System messages**. They do not show Markdown images, so the reference shows as text.
- **Persona galleries**. Your messages have no speaker, so use the persona form `card://personas/<id>/gallery/<file>`.

A full link holds the character's internal id, and ids are regenerated when a character is imported, so full links break for anyone you share the character with. The `self` form carries no id. It survives a **Marinara Native** export and import, because the gallery images travel inside the export with their filenames. **Compatible PNG Card** and **Compatible JSON** exports do not include the gallery, so no gallery reference can work after sharing that way. Use **Marinara Native** when a character uses gallery images.

### Save web images from greetings

Many cards show images from other websites in their greetings, and those links can break. When **First Message** or **Alternate Greetings** show web images, **Dialogue & Greetings** has a **Save images locally** button.

1. Open the **Card** tab and find **Dialogue & Greetings**.
2. Click **Save images locally**. Marinara downloads the images into the Gallery and swaps each link for a `card://self/gallery/...` reference.
3. Click **Save** to keep the new links.

Nothing downloads until you click the button. Only PNG, JPEG, GIF and WebP images up to 10 MB and 40 megapixels are saved. Links to your own computer or home network are refused. An image that cannot be saved keeps its web link, and a notice says why.

**Restore web links** puts the original links back in the greetings. The saved copies stay in the Gallery until you delete them. Lorebook images are not covered.

## Which videos are listed

The **Videos** sub-tab lists scene videos generated in chats with this character, and video-call clips. Which character lists a video depends on where it came from:

- A Conversation video message is listed for the characters it shows: the one who sent it and anyone it names. A first name is enough when no one else in the chat shares it, if it is written with a capital letter. Everyone in the chat is included when the text asks for a group photo or selfie. Names inside quotation marks do not count.
- Your persona's gallery lists a clip only when it names your persona.
- Older videos, and videos from Roleplay and Game Mode chats, are listed for every character and the persona of their chat.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Custom Emojis, Stickers, and GIFs](../conversation/emoji-stickers-gifs.md)
- [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md)
