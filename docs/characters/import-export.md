# Importing and Exporting Character Cards

A character card is one file that holds one character: name, description, personality, greetings and often an avatar image. Import cards to add characters from other apps and sites. Export your own characters to back them up or share them.

## Importing a character

1. Open the **Characters** panel.
2. Click **Import** in the toolbar (the icon with a download arrow). The **Import Character** window opens.
3. Set the import options below. They apply to every file in this batch.
4. Drop your files on the window, or click it to browse. It says "Drop one or more files here or click to browse". You can pick several files, and the types can be mixed.
5. Wait for the result list. Each file shows a green check and `Imported "Name"`, or a red mark with an error.

Marinara accepts four file types:

| File type | What it is |
| --- | --- |
| **.json** | A plain character card in text form (Chara Card V2). |
| **.png** | A character card image with the card data hidden inside the picture. |
| **.charx** | A Character Card V3 package (CharX), the zip-based format used by RisuAI. |
| **.marinara** | A Marinara native export. Exports are named `.marinara.json`. |

A Marinara native file keeps the most detail. The other three come from SillyTavern, Chub, Risu and similar tools.

If it did not work: read the red message next to the file. The other files in the batch still import.

### Import options

| Option | Choices | Default |
| --- | --- | --- |
| **Imported card tags** | **All tags** keeps every tag on the card. **No tags** skips them. **Existing only** keeps only tags already in your library. | **All tags** |
| **Imported regex scripts** | **Character only** runs the card's regex scripts for this character. **Global** adds them to **Presets → Regexes**, so they run in every chat. | **Character only** |
| **Split description into fields** | Tick it to move labelled personality, appearance, backstory, scenario, rules and example-dialogue text out of **Description** into their own fields. Narrator, world and multi-character cards are left as they are. | Off |

Regex scripts are small text-replacement rules. Keep **Character only** unless you want the rules everywhere.

### Cards with a built-in lorebook

A lorebook is a set of background facts the AI looks up during a chat. If a card has one built in, the import pauses and shows **Embedded lorebook found**. It lists each file and how many entries it has. Choose one option for the whole batch:

- **Import Lorebook** also creates a standalone Marinara lorebook linked to the character.
- **No Import** keeps the lorebook only inside the card.

### Import a whole SillyTavern folder

To move a whole SillyTavern install, use the bulk importer in **Settings** on the **Imports** tab. It brings over characters, chats, presets and lorebooks together. See [Importing from SillyTavern](../data/importing-from-sillytavern.md).

## Export a character

1. Open the character in the editor.
2. Click **Export character** in the header. The **Export Character** window opens.
3. Pick a format. Marinara downloads the file.

| Format | What you get | Best for |
| --- | --- | --- |
| **Marinara Native** | A `.marinara.json` file with Marinara metadata, sprites, gallery images and attached lorebooks. | Moving a character between Marinara installs with full detail. |
| **Compatible JSON** | Plain Chara Card V2 JSON. It drops Marinara-only extras such as sprites and gallery images. | Other apps that read JSON cards. |
| **Compatible PNG Card** | A Chara Card V2 image with the card data inside the picture. It carries your sprites but not gallery images. | Apps and sites that expect a PNG card, such as SillyTavern, Chub and Risu. |

Both **Compatible** formats append non-empty **Backstory** and **Appearance** fields to the standard **Description**, so other V2 readers keep that information. Your saved card does not change.

A card's [Interactive Onboarding](interactive-onboarding.md) is kept by **Marinara Native** and **Compatible PNG Card**, so the card still asks its questions when someone imports it into Marinara. **Compatible JSON** leaves it out.

## Export many characters at once

1. Open the **Characters** panel.
2. Click **Select** in the toolbar (the checkmark icon) and tick the characters you want.
3. Click **Export** in the bar at the bottom. Marinara downloads `marinara-characters.zip`.

The zip holds one **Marinara Native** file per character. Bulk export has no PNG or JSON option. Use single-character export for those. For more ways to select characters, see [Organizing Your Character Library](library-organization.md).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Card Browser: Finding and Importing Characters](bot-browser.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
