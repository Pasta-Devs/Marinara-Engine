# Custom Emojis, Stickers, and GIFs

Upload your own emojis and stickers, search GIFs, and control which custom emojis and stickers a character may use in its replies. These tools work in Conversation Mode only. Roleplay and Game Mode have the plain emoji picker.

## Where to find these tools

In a Conversation chat, click the round smiley button **Emoji, GIFs & stickers** next to the message box. A panel opens above it (a sheet above the keyboard on a phone). Its tabs are:

- **Emoji**: the standard emoji grid, plus a star tab **Custom emojis** for your uploaded images.
- **GIFs**: live GIF search.
- **Kaomoji**: text faces such as `(^_^)`.
- **Stickers**: your uploaded stickers.

A **Tools** tab also shows when other input tools are on.

## Upload a custom emoji

A custom emoji is a small image you upload once and use in any Conversation chat. In a message you write it as a shortcode: the name between colons, like `:kekw:`.

1. Open the panel, go to **Emoji**, then the star tab **Custom emojis**.
2. Click **Upload** and choose one or more image files.
3. In the **Name this emoji** dialog, type a name and click **Add**.

The emoji appears in the **Custom emojis** grid.

Rules:

- A name is 1 to 32 characters: lowercase letters, numbers and underscores. The app changes other characters for you.
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

A sticker is a larger image that shows on its own line. You normally click it in the **Stickers** tab; the text `sticker:name:` is what gets inserted. On the **Stickers** tab, click **Upload** and use **Edit**, **Export** and **Import** as for emojis. The differences:

- The upload dialog is **Name this sticker**.
- The largest image is 512 by 512 pixels (emojis: 256 by 256).
- The export file is `marinara-custom-stickers.json`.

To send a sticker, click its tile. The **Send sticker** dialog offers:

- **Send & reply**: posts the sticker as its own message and lets the character answer.
- **Add to message**: puts the `sticker:name:` text in your message so you can keep typing.

## Search GIFs

The **GIFs** tab searches Giphy, an online GIF library. Type in the search box or browse the trending list, then click a GIF to send it.

Before you start: GIF search needs a free Giphy API key. A key is a secret code that lets Marinara use the Giphy service for you. Without one, the tab shows a setup card. Setting it up means editing the `.env` file, which is Marinara's plain text settings file. It sits in the Marinara project folder, or at `/app/data/.env` in Docker (see [Edit the .env file](../CONFIGURATION.md#edit-the-env-file)).

1. Open the Giphy developer dashboard at `https://developers.giphy.com/dashboard/`.
2. Create an API key for a web app and copy it.
3. Open the `.env` file in a text editor.
4. Add this line at the end, with your key in place of `your_key_here`, and save the file:

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Restart Marinara. That means stop it and start it again the way you normally start it (see [Installation](../INSTALLATION.md)).

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

- **Semantic** (default): offers the ones that best fit the recent conversation. It uses a small model on your own computer. If that is not available, it picks at random.
- **Random**: offers a random set each reply.
- **Tool-call**: a model picks the fitting ones each reply. Choose a model in **Select a model…**. If none is set or it fails, it uses semantic. It is skipped when several characters reply in one group turn.

**Max offered (each)** is how many emoji names and how many sticker names are offered per turn. The default is 20, from 1 to 100.

## Reactions use only your main custom emojis

You can react to a message with a custom emoji, but only from the emojis you uploaded on the **Custom emojis** tab. Gallery-tagged emojis, stickers and GIFs are not available as reactions. See [React and get notified](getting-started.md#react-and-get-notified).

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Character and Persona Galleries](../characters/galleries.md)
- [Server Configuration Reference](../CONFIGURATION.md)
