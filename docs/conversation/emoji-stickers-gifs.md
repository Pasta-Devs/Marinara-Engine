# Custom Emojis, Stickers, and GIFs

This guide covers the extra images you can add to a Conversation Mode chat: custom emojis, custom stickers, and searched GIFs. It also explains how to control which custom emojis and stickers the character is allowed to use in its replies.

These tools work in Conversation Mode only. Roleplay and Game modes get the plain emoji picker, with no custom emojis, no stickers, and no GIF search.

## Where to find these tools

In a Conversation Mode chat, look at the message input bar. There is a round button with a smiley-face icon, labeled **Emoji, GIFs & stickers**. Click it to open a small panel above the input bar.

The panel has these tabs:

- **Emoji**: the standard emoji grid, plus a star tab labeled **Custom emojis** for your uploaded images.
- **GIFs**: live GIF search.
- **Stickers**: your uploaded stickers.

A **Tools** tab also appears when other input tools are turned on. On mobile the same tabs open in a sheet above the keyboard.

## Custom emojis

A custom emoji is a small image you upload once and reuse in any Conversation chat. In a message you write it as a shortcode, which is the emoji name wrapped in colons, like `:kekw:`.

Custom emojis are shared across your whole profile. You upload them one time, then use them everywhere.

### Uploading a custom emoji

1. Open the **Emoji, GIFs & stickers** panel and go to the **Emoji** tab.
2. Click the star tab labeled **Custom emojis**.
3. Click **Upload** and choose one or more image files.
4. In the **Name this emoji** dialog, type a name and click **Add**.

You should see the new emoji appear in the **Custom emojis** grid.

Emoji names follow strict rules. A name is 1 to 32 characters. You can use only lowercase letters, numbers, and underscores. If you type spaces or capital letters, the app cleans the name for you. For example, it lowercases letters and turns other characters into underscores.

A custom emoji image must be no larger than 256 by 256 pixels. The app checks this when you upload. Names must be unique across all your custom emojis. If you pick a name that is already taken, you see an error like `An emoji named ":name:" already exists.`

You can upload an animated GIF file as a custom emoji. It plays back animated in the chat. This is separate from the **GIFs** tab described below.

### Using a custom emoji

Click any tile in the **Custom emojis** grid to drop its shortcode into your message. This does not send the message, it only inserts the text. You can also type the shortcode by hand, for example `:kekw:`. Type the name in lowercase, exactly as you saved it.

### Renaming, deleting, exporting, and importing

Click **Edit** at the top of the **Custom emojis** tab to turn on edit mode.

In edit mode:

- Click a tile to open the **Rename emoji** dialog, then click **Rename**.
- Click the small trash badge on a tile to delete that emoji. The **Delete emoji** dialog warns that messages that already used it will show the plain text instead.
- Click **Export** to download all your custom emojis as a file named `marinara-custom-emojis.json`. This file holds the images inside it, so it is fully portable.
- Click **Import** to load a previously exported file. The import skips emojis that fail the name or size rules, or that clash with an existing name.

## Custom stickers

A custom sticker works like a custom emoji, but for larger images. You write a sticker as `sticker:name:`, and it always renders as a big block image on its own line.

Open the **Stickers** tab in the same panel. Uploading, naming, renaming, deleting, exporting, and importing all work the same way as emojis, with these differences:

- The upload dialog is titled **Name this sticker**.
- A sticker image must be no larger than 512 by 512 pixels.
- Sticker names are unique across all your stickers. A duplicate shows `A sticker named "sticker:name:" already exists.`
- Exports download a file named `marinara-custom-stickers.json`.

### Sending a sticker

Click a sticker tile in the grid. A **Send sticker** dialog asks how you want to use it, with two choices:

- **Send & reply**: posts the sticker as its own message right away and lets the character respond.
- **Add to message**: drops the `sticker:name:` text into your message so you can keep typing.

## GIF search (Giphy)

The **GIFs** tab searches Giphy, a large online GIF library. Type in the search box to find GIFs, or browse the trending list. Click a GIF to send it into the chat.

### GIF search needs a key

GIF search needs a free Giphy API key. An API key is a secret code that lets Guksu Motor talk to the Giphy service on your behalf. Without a key, the **GIFs** tab shows a setup card instead of results.

To set up GIF search:

1. Open the Giphy Developer Dashboard at `https://developers.giphy.com/dashboard/`.
2. Create a free API key for a web app.
3. Add the key to your `.env` file. This is the server settings file for Guksu.

Add a line like this to `.env`:

```
GIPHY_API_KEY=your_key_here
```

After you add the key, restart Guksu. For a full explanation of the `.env` file, see the server configuration guide linked below.

### GIF content rating

GIF results use Giphy's mature content rating. This is fixed and cannot be changed in the app. Results can include suggestive or adult GIFs, so search with that in mind. There is no offline or safe-only GIF source.

## Tagging a gallery image as an emoji or sticker

You can tag any image already saved in a Character Gallery or Persona Gallery as a custom emoji or sticker. A tagged gallery image is scoped to that one character or persona. It works only in chats that include them.

To tag a gallery image:

1. Open the **Character Editor** or **Persona Editor**.
2. Go to the **Gallery** tab and open the **Images** sub-tab.
3. Hover an image and click the small tag button in its top-left corner.
4. Choose **Make emoji** or **Make sticker**.
5. In the **Custom Emoji** or **Custom Sticker** dialog, type a name.

You should see the tag button change to show the assigned name.

The same size limits apply here. **Make emoji** caps at 256 by 256 pixels and **Make sticker** caps at 512 by 512 pixels. If an image is too big for the kind you picked, you see a red error toast.

To change a tagged image later, click its tag button again. The menu offers **Rename**, a switch option like **Switch to sticker**, and a remove option like **Remove emoji**. Tagging does not move or copy the image, it stays a normal gallery image too.

## Selection preferences

Guksu can tell the responding character which of your custom emojis and stickers it may use in its reply. You control this with **Selection preferences**.

To open the panel, click the gear icon labeled **Selection preferences**. It sits at the top of the **Custom emojis** tab and the **Stickers** tab. Both open the same setting. This setting is saved per chat, so each chat can differ.

The panel has one mode row with three choices:

- **Semantic** (the default): offers the emojis and stickers that best fit the recent conversation. Semantic mode uses a local embedder, which is a small AI model that runs on your own machine. If it is not available, this mode falls back to random.
- **Random**: offers a random set each reply.
- **Tool-call**: a model call picks the fitting ones each reply. You must choose a connection in the dropdown that appears. If the connection is unset or fails, it falls back to semantic. In a group chat turn where more than one character replies, Tool-call is skipped for that turn and selection falls back to semantic.

Below the modes is **Max offered (each)**. This is how many custom emoji names and how many sticker names are offered to the character each turn. The default is 20. You can set it from 1 to 100.

## How custom emojis and stickers show up

In a Conversation chat, an emoji shortcode like `:kekw:` renders as a small inline image on the text line. If a message contains only emoji shortcodes and nothing else, they render larger.

A sticker like `sticker:wave:` always renders as a large block image on its own line.

If a name cannot be found, for example after you delete that emoji, the message shows the plain shortcode text instead, like `:kekw:`.

## Reactions use only the global emoji pool

You can react to a message with a custom emoji. Reactions can use only your main custom emojis, the global pool. Gallery-tagged emojis, stickers, and GIFs are not available as reactions. Message reactions are covered in the Conversation Mode getting-started guide.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Character and Persona Galleries](../characters/galleries.md)
- [Server Configuration Reference](../CONFIGURATION.md)
