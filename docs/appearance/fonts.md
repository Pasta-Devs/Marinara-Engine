# Custom Fonts and Google Fonts

Change the font Marinara uses across the app. Pick the built-in font, add your own font files, or download a font from Google Fonts by name.

## Choosing an app font

1. Open **Settings** and click the **Appearance** tab, then the **App** button.
2. Find the **Text & Scale** section.
3. Open the **Font** dropdown and pick a font.

The easiest way to get a new font is [Google Fonts](#downloading-from-google-fonts). The default is **Default (Inter)**, a clean font chosen for on-screen reading. Fonts you add appear in the same dropdown below it.

Your font choice syncs across devices. Every browser connected to the same Marinara server switches to it. See [Settings Overview](../settings/settings-overview.md).

Chat widgets have a separate **Font** choice under **Chat widget style**. Turn on **Apply preset font** there to use it for messages, input boxes and chat controls too. See [Ready-made chat window styles](custom-css-themes.md#ready-made-chat-window-styles).

## Adding your own fonts

Before you start: fonts go in a folder on the server. The server is the computer that runs Marinara. If you run Marinara on your own computer, that is the server, and the data folder is where Marinara keeps your data.

1. Click **Open Fonts Folder**, next to the **Font** dropdown, to open `data/fonts/` on the server. Or find the `data/fonts/` folder in Marinara's data folder yourself.
2. Copy your font file into it.
3. Go to **Settings → Appearance → App → Text & Scale**.
4. Open the **Font** dropdown. Your font is in the list.
5. Select it. The app text changes at once.

Marinara reads `.ttf`, `.otf`, `.woff` and `.woff2` files and ignores other types. It builds the display name from the file name, so `OpenSans-Bold.ttf` shows as "Open Sans". Name your files clearly for a tidy list.

Every device that connects to the same server can use the fonts in `data/fonts/`.

If it did not work: check the file type and that the file is in `data/fonts/` on the server, not on the device you are viewing from.

## Downloading from Google Fonts

The server needs internet access for this.

1. Go to **Settings → Appearance → App → Text & Scale**.
2. In the **Google Fonts** field, type the exact font name, for example `Fira Code` or `Lora`.
3. Click **Add**.
4. Wait for the download. The font then appears in the **Font** dropdown.

The **Browse fonts at fonts.google.com →** link next to the field opens the Google Fonts site so you can look up names. The name can use letters, numbers and spaces only. Downloading the same font again replaces the old copy.

If it did not work, read the error message.

- If Marinara cannot reach Google Fonts, check your internet connection.
- If it says the font was not found, check the spelling, and check on the Google Fonts site that the font has a Regular (400) style. Marinara downloads only that weight.

## Open Fonts Folder

The **Open Fonts Folder** button next to the **Font** dropdown opens `data/fonts/` in the file explorer on the server computer, not on the device you are using. If you run Marinara on your own computer, it opens the folder for you. From a phone or a second computer, copy your font files into the server's `data/fonts/` folder yourself.

While the default font is selected, the preset editor's prompt fields and a character's Example Dialogue use a monospace font. Any other font applies to them too. Other prompt fields, such as an agent's prompt template, stay monospace.

## Related guides

- [Appearance Settings](appearance-settings.md)
