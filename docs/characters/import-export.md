# Importing and Exporting Character Cards

A character card is one file that holds one character: name, description, personality, greetings and often an avatar image. Import cards to add characters from other apps and sites. Export your own characters to back them up or share them.

## Importing a character

Before you start: have a character card file on your device. To find cards online instead, see [Card Browser](bot-browser.md).

1. Click **Characters** in the top navigation bar. If you do not see it, open **More** first.
2. Click **Import** in the toolbar (the icon with a download arrow). The **Import Character** window opens.
3. Set the import options below. They apply to every file in this batch.
4. Drop your files on the window, or tap or click it to open your device's file picker. You can pick several files, and the types can be mixed.
5. Wait for the result list. Each file shows a green check, or a red mark with an error. The text is `Imported "Name"`, `Imported "Name" with its embedded lorebook`, or `Imported "Name" without creating the embedded lorebook`.
6. Find the new character in **Characters**.

Marinara accepts four file types:

| File type | What it is |
| --- | --- |
| **.json** | A card saved as text. Marinara exports (`.marinara.json`) are also .json files. |
| **.png** | A card image with the card data hidden inside the picture. |
| **.charx** | A card package saved as a zip file. |
| **.marinara** | A Marinara export file. |

A Marinara export keeps the most detail. The other types come from SillyTavern, Chub, Risu and similar tools.

If it did not work: read the red message next to the file. The other files in the batch still import.

### Import options

| Option | Choices |
| --- | --- |
| **Imported card tags** | **All tags** (default): keep every tag. |
| | **No tags**: skip them. |
| | **Existing only**: keep tags already in your library. |
| **Imported regex scripts** | **Character only** (default): rules run for this character. |
| | **Global**: rules go to **Presets → Regexes** and can run across chats. |
| **Split description into fields** | Off by default. Tick it to move labelled personality, appearance and similar text out of **Description** into their own fields. |

Regex scripts are small text-replacement rules. Keep **Character only** unless you want the rules everywhere. The split leaves narrator, world and multi-character cards as they are.

### Cards with a built-in lorebook

A lorebook is a set of background facts the AI looks up during a chat. If a card has one built in, the import pauses and shows **Embedded lorebook found**. It lists each file and how many entries it has. Choose one option for the whole batch:

- **Import Lorebook** also creates a standalone Marinara lorebook linked to the character.
- **No Import** keeps the lorebook only inside the card.

### Import a whole SillyTavern folder

To move a whole SillyTavern install, use the bulk importer in **Settings** on the **Imports** tab. It brings over characters, chats, presets and lorebooks together. See [Importing from SillyTavern](../data/importing-from-sillytavern.md).

## Update a character you already have

When a card's author releases a newer version, you can update your copy in place instead of adding a second one. The character keeps its chats, memories, gallery, sprites, folder, favorite star, colors and your own tags. Its current card is saved to **Version history** first (even with automatic versioning off), so you can go back.

### From the Import window

1. Import the newer card file as usual (steps above).
2. If it looks like a character you already have, the import pauses on **Already in your library**. Marinara matches a card downloaded from the same Card Browser page, or one with the same name and creator. The reason is shown under each choice.
3. For each card, pick one:
   - **Update "Name"**: update that character in place (the default).
   - **Update another character…**: pick any character from a list. Use this for a card that came another way, for example from a website into SillyTavern and then into Marinara, so its name or creator no longer matches.
   - **Add as a new character**: keep both.
   - **Skip this card**: leave it out.
4. Choose whether to **Use the new card's picture**, and what happens to **Creator's Notes** (see below).
5. Click **Continue**. If the card has a built-in lorebook, the next step asks about it as usual. An updated character's linked lorebook is refreshed with the new entries, not copied a second time.
6. The result says `Updated "Name". Its old card is in Version history.`

### From the character editor

1. Open the character and save any changes first.
2. Click **⋯** next to **Save** and choose **Update from card file…**.
3. Pick the newer card (.png, .json or .charx), check the choices and click **Update**.

For a character downloaded from the [Card Browser](bot-browser.md), the same menu has **Check for update**. It opens that card's page in the Card Browser, where you can compare and import the newer version.

### Creator's Notes

Creator's Notes are the short text under each card in **Characters**, and some people keep custom CSS there. Pick one:

| Choice | What happens |
| --- | --- |
| **Merge: keep mine, add the author's changes** (default) | Your text and CSS stay. Lines the author added go in before your first style block, and lines the author removed are dropped if you hadn't changed them. If you never edited the notes, they simply become the new card's. |
| **Use the card's notes** | Your notes are replaced by the card's. |
| **Keep mine** | Your notes stay exactly as they are. |

Cards imported before this feature don't remember their original notes, so the first merge only adds lines you don't have yet.

### Undo an update

Open the character, find **Version history** on the **Metadata** tab and restore the version from before the update. See [Version history](creating-and-editing-characters.md#version-history).

## Export a character

1. Open the character in the editor.
2. Click **…** in the header, then **Export character**. The **Export Character** window opens.
3. Pick a format. Marinara downloads the file.

| Format | What you get | Best for |
| --- | --- | --- |
| **Marinara Native** | A `.marinara.json` file with Marinara metadata, sprites, gallery images and attached lorebooks. | Moving a character between Marinara installs with full detail. |
| **Compatible JSON** | A plain card file other apps can read. It drops Marinara-only extras such as sprites and gallery images. | Other apps that read JSON cards. |
| **Compatible PNG Card** | A card image with the data inside the picture. It carries your sprites but not gallery images. | Apps and sites that expect a PNG card, such as SillyTavern, Chub and Risu. |

Both **Compatible** formats append non-empty **Backstory** and **Appearance** fields to the standard **Description**, so other apps keep that information. Your saved card does not change.

A card's [Interactive Onboarding](interactive-onboarding.md) is kept by **Marinara Native** and **Compatible PNG Card**, so the card still asks its questions when someone imports it into Marinara. **Compatible JSON** leaves it out.

## Export many characters at once

1. Click **Characters** in the top navigation bar (or **More** first, if it is not shown).
2. Click **Select** in the toolbar (the checkmark icon) and tick the characters you want.
3. Click **Export** in the bar at the bottom. Marinara downloads `marinara-characters.zip`.

The zip holds one **Marinara Native** file per character. Bulk export has no PNG or JSON option. Use single-character export for those. For more ways to select characters, see [Organizing Your Character Library](library-organization.md#export-or-delete-many-characters).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Card Browser: Finding and Importing Characters](bot-browser.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
