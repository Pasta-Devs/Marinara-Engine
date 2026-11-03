# Custom Emojis, Stickers, and GIFs

Upload your own emojis and stickers, search GIFs, and control which custom emojis and stickers a character may use in its replies. These tools work in Conversation Mode only. Roleplay and Game Mode have the plain emoji picker.

## Where to find these tools

In a Conversation chat, click the round smiley button **Emoji, GIFs & stickers** next to the message box. A panel opens above it (a sheet above the keyboard on a phone). Its tabs are:

- **Emoji**: the standard emoji grid, plus a star tab **Custom emojis** for your uploaded images.
- **GIFs**: live GIF search.
- **Stickers**: your uploaded stickers.

A **Tools** tab also shows when other input tools are on.

## Upload a custom emoji

A custom emoji is a small image you upload once and use in any Conversation chat. In a message you write it as a shortcode: the name between colons, like `:kekw:`.

1. Open the panel, go to **Emoji**, then the star tab **Custom emojis**.
2. Click **Upload** and choose one or more image files.
3. In the **Name this emoji** dialog, type a name and click **Add**.

The emoji appears in the **Custom emojis** grid.

Rules:

- A name is 1 to 32 characters: lowercase letters, numbers and underscores. The app cleans other characters for you.
- The image can be at most 256 by 256 pixels. Animated GIF files work and play in the chat.
- Names must be unique. A taken name shows `An emoji named ":name:" already exists.`

If it did not work: check the name and the image size against the rules above.

## Use a custom emoji

Click a tile in the **Custom emojis** grid. This inserts its shortcode into your message and does not send it. You can also type the shortcode, in lowercase, exactly as saved.

In a Conversation chat a shortcode shows as a small inline image. A message of only emoji shortcodes shows them larger. If the name no longer exists, for example after you delete it, the message shows the plain text `:kekw:`.

## Rename, delete, export and import

Click **Edit** at the top of the **Custom emojis** tab to turn on edit mode.

- Click a tile to open **Rename emoji**, then click **Rename**.
- Click the trash badge on a tile to delete it. **Delete emoji** warns that messages that used it will show the text instead.
- Click **Export** to download all your custom emojis as `marinara-custom-emojis.json`. The images are inside the file.
- Click **Import** to load an exported file. It skips emojis that break the name or size rules or clash with an existing name.

## Custom stickers

A sticker works like a custom emoji for larger images. You write it as `sticker:name:`, and it shows as a big image on its own line. Open the **Stickers** tab. Upload, rename, delete, export and import work the same way, with these differences:

| | Emoji | Sticker |
| --- | --- | --- |
| Upload dialog | **Name this emoji** | **Name this sticker** |
| Largest image | 256 by 256 pixels | 512 by 512 pixels |
| Duplicate name error | `An emoji named ":name:" already exists.` | `A sticker named "sticker:name:" already exists.` |
| Export file | `marinara-custom-emojis.json` | `marinara-custom-stickers.json` |

To send a sticker, click its tile. The **Send sticker** dialog offers:

- **Send & reply**: posts the sticker as its own message and lets the character answer.
- **Add to message**: puts the `sticker:name:` text in your message so you can keep typing.

## Search GIFs

The **GIFs** tab searches Giphy, an online GIF library. Type in the search box or browse the trending list, then click a GIF to send it.

Before you start: GIF search needs a free Giphy API key (the secret code that lets Marinara use the Giphy service for you). Without one, the tab shows a setup card.

1. Open the Giphy developer dashboard at `https://developers.giphy.com/dashboard/`.
2. Create an API key for a web app.
3. Add this line to your `.env` file (the server settings file):

   ```text
   GIPHY_API_KEY=your_key_here
   ```

4. Restart Marinara.

See [Server Configuration Reference](../CONFIGURATION.md) for more about `.env`.

GIF results use Giphy's mature rating. You cannot change it in the app, so results can include adult GIFs. There is no safe-only GIF source.

## Tag a gallery image as an emoji or sticker

Any image in a Character Gallery or Persona Gallery can become an emoji or sticker. It works only in chats that include that character or persona.

1. Open the **Character Editor** or **Persona Editor**.
2. Open the **Gallery** tab, then the **Images** sub-tab.
3. Hover an image and click the tag button in its top-left corner.
4. Choose **Make emoji** or **Make sticker**.
5. In the **Custom Emoji** or **Custom Sticker** dialog, type a name.

The tag button now shows the name. The same size limits apply, and an image that is too big shows a red error. To change it later, click the tag button again for **Rename**, a switch option such as **Switch to sticker**, or a remove option such as **Remove emoji**. The image also stays a normal gallery image.

## Selection preferences

Marinara tells the responding character which custom emojis and stickers it may use. To change how it picks them, click the gear **Selection preferences** at the top of the **Custom emojis** or **Stickers** tab. Both open the same setting, saved per chat.

| Mode | What it offers |
| --- | --- |
| **Semantic** (default) | The ones that best fit the recent conversation. It uses a local embedder (a small model on your own computer). If that is not available, it falls back to random. |
| **Random** | A random set each reply. |
| **Tool-call** | A model picks the fitting ones each reply. Choose a model in the **Select a model…** list. If none is set or it fails, it falls back to semantic. When several characters reply in one group turn, it is skipped and semantic is used. |

**Max offered (each)** is how many emoji names and how many sticker names are offered per turn. The default is 20, from 1 to 100.

## Reactions use only the global pool

You can react to a message with a custom emoji, but only from your main custom emojis. Gallery-tagged emojis, stickers and GIFs are not available as reactions. See [React and get notified](getting-started.md#react-and-get-notified).

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Character and Persona Galleries](../characters/galleries.md)
- [Server Configuration Reference](../CONFIGURATION.md)
