# Importing and Exporting Character Cards

This guide shows how to import character cards into Marinara Engine and export your own characters back out. It covers the file types Marinara accepts, the choices in the import dialog, and the three export formats.

A character card is a single file that holds one character: its name, description, personality, greetings, and often an avatar image. Cards let you move a character between Marinara and other roleplay apps.

## Import formats

The **Import Character** window accepts four file types. You can drop several files at once, and they can be mixed types.

| File type | What it is |
| --- | --- |
| **.json** | A plain character card in text form (Chara Card V2). |
| **.png** | A character card image with the card data hidden inside the picture. |
| **.charx** | A Character Card V3 package (CharX), the zip-based format used by RisuAI. |
| **.marinara** | A Marinara native export (also seen as `.marinara.json`). |

A **.marinara** file keeps the most detail, because it is Marinara's own format. The other three come from SillyTavern, Chub, Risu, and similar tools.

## Importing a character

Follow these steps to bring one or more cards into your library.

1. Open the **Characters** panel.
2. Click the **Import** button in the toolbar. It is an icon button with a download arrow. The **Import Character** window opens.
3. Drag your files onto the window, or click it to browse. You should see "Drop one or more files here or click to browse".
4. Set the two import options (described below). They apply to every file in this batch.
5. Wait for the result list. Each file shows a green check with "Imported" and the name, or a red mark with an error.

### Choosing which tags to keep

The **Imported card tags** option decides what happens to the tags on the incoming card. This is called tag import mode. You have three choices:

- **All tags**: keep every tag from the source card. This is the default.
- **No tags**: skip the source tags.
- **Existing only**: keep only tags that already exist in your library.

### Choosing where regex scripts go

Some cards ship with regex scripts, small text-replacement rules. The **Imported regex scripts** option controls their reach:

- **Character only**: the scripts run only for this character. This is the default.
- **Global**: the scripts are added to **Presets**, in the **Regexes** section, and run in every chat.

Pick **Character only** unless you know you want the rules everywhere.

### Cards with a built-in lorebook

A lorebook is a set of background facts the AI can look up during a chat. If a card you are importing has a lorebook baked in, the import pauses and shows an **Embedded lorebook found** panel. It lists each file and how many entries it holds. Choose one option for the whole batch:

- **Import Lorebook**: also create a standalone Marinara lorebook linked to the character.
- **No Import**: keep the lorebook only inside the card.

### Importing many cards at once

The same **Import Character** window handles batch imports. Select several files, and Marinara imports them one after another. The result list has one row per file, so you can see which cards worked and which failed.

## Exporting a character

Open a character in the editor, then click **Export character** in the top toolbar. The **Export Character** window offers three formats.

| Format | What you get | Best for |
| --- | --- | --- |
| **Marinara Native** | A `.marinara.json` file that keeps Marinara metadata, sprites, gallery images, and attached lorebooks. | Moving a character between Marinara installs with full detail. |
| **Compatible JSON** | Plain Chara Card V2 JSON with no Marinara wrapper. | Sharing to other apps that read JSON cards. |
| **Compatible PNG Card** | A Chara Card V2 image with the card data baked into the picture. | Apps and sites that expect a PNG card, such as SillyTavern, Chub, and Risu. |

Choose **Marinara Native** when you want to keep everything. Choose one of the **Compatible** formats when the file is going to another tool. The two compatible formats drop Marinara-only extras like sprites and gallery images.

## Exporting many characters at once

You can export a batch of characters as a single zip file.

1. Open the **Characters** panel.
2. Click the **Select** button in the toolbar to enter select mode. It is an icon button with a checkmark.
3. Tick the characters you want.
4. Click **Export** in the action bar at the bottom. Marinara downloads a zip named `marinara-characters.zip`.

The zip holds one **Marinara Native** file per character. There is no PNG or compatible-JSON option for bulk export, so use single-character export when you need those formats.

## Importing a whole SillyTavern folder

The steps above cover cards you pick by hand. To move an entire SillyTavern install at once, use the bulk folder importer instead. It brings over characters, chats, presets, and lorebooks together. It lives in **Settings** under the **Imports** tab. See [Importing from SillyTavern](../data/importing-from-sillytavern.md) for the full walkthrough.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Card Browser: Finding and Importing Characters](bot-browser.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
