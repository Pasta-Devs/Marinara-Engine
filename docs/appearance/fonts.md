# Custom Fonts and Google Fonts

This guide shows how to change the font Guksu Motor uses across the app. You can pick the built-in font, add your own font files, or download a font from Google Fonts by name.

## Choosing an app font

The font setting lives in **Settings**, under the **Appearance** tab, in the **Text & Scale** section.

1. Open **Settings** and click the **Appearance** tab.
2. Find the **Text & Scale** section.
3. Open the **Font** dropdown.
4. Pick a font from the list.

The default choice is **Default (Inter)**. Inter is a clean font chosen for on-screen reading. Any custom fonts you add appear in the same **Font** dropdown, below the default option.

Your font choice syncs across devices. When you pick a font, every browser and device connected to the same Guksu server switches to it. To learn how this sync works, see the [Settings Overview](../settings/settings-overview.md) guide.

## Adding your own fonts

You can add a custom font by dropping a font file into a folder on the server. This is the machine that runs Guksu.

1. Find the `data/fonts/` folder inside Guksu's data folder on the server machine.
2. Copy your font file into that folder.
3. Go back to **Settings**, then **Appearance**, then **Text & Scale**.
4. Open the **Font** dropdown. Your font now appears in the list.
5. Select it.

Guksu reads these font file types: `.ttf`, `.otf`, `.woff`, and `.woff2`. Files with any other extension are ignored.

Guksu builds a display name from the file name. For example, a file named `OpenSans-Bold.ttf` shows up as "Open Sans". So name your files in a clear way if you want a tidy list.

Font files in the `data/fonts/` folder live on the server. Every device that connects to the same Guksu server can use them. Your font choice syncs across those devices too, so they all show the same font.

## Downloading from Google Fonts

Guksu can fetch a font straight from Google Fonts for you. The server needs internet access for this to work.

1. Open **Settings**, then **Appearance**, then **Text & Scale**.
2. Find the **Google Fonts** field.
3. Type the exact font name, for example `Fira Code` or `Lora`.
4. Click **Add**.
5. Wait for the download to finish. The new font then appears in the **Font** dropdown.

Type the name exactly as Google Fonts spells it. The **Browse fonts at fonts.google.com** link sits next to the field. It opens the Google Fonts site in a new tab so you can look up names.

The name may use letters, numbers, and spaces only. If you download the same font again later, Guksu replaces the old copy instead of making a duplicate.

If the download fails, read the error message. When Guksu cannot reach Google Fonts, it tells you to check your internet connection. When it says the font was not found, there are two possible causes. The name may not match a font on Google Fonts. Or the font may have no regular (400) weight, which is the normal non-bold style. Check the spelling, and check on the Google Fonts site that the font offers a Regular style.

## Open Fonts Folder is local only

Next to the **Font** dropdown there is an **Open Fonts Folder** button. It opens the `data/fonts/` folder in the file explorer on the server machine.

This button acts on the server, not on the device where you are viewing Guksu. If you run Guksu on your own computer, it opens the folder for you. If you connect from a phone or a second computer, the button does nothing useful for you. In that case, copy your font files into the server's `data/fonts/` folder yourself.

## Related guides

- [Appearance Settings](appearance-settings.md)
