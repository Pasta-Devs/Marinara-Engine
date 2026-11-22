# Importing from SillyTavern

Bring your SillyTavern data into Marinara Engine. Import one file at a time, or scan a whole SillyTavern folder and import everything at once.

## What you can bring over

| SillyTavern data | In Marinara |
| --- | --- |
| Characters | Characters |
| Chats and group chats | Chats |
| Presets | Presets (the prompt's sections and the preset's sampler settings) |
| World Info | Lorebooks (notes the AI reads when certain words come up) |
| Backgrounds | Chat backgrounds |
| Personas | Personas (the profile that stands in for you) |

## Quick single-file imports

1. Open **Settings → Imports**.
2. In **SillyTavern Import**, click the button for your file type.
3. Choose the file.

| Button | File |
| --- | --- |
| **Import Character (JSON/PNG)** | A `.json` or `.png` character card. |
| **Import Chat (JSONL)** | A `.jsonl` chat log (one JSON record per line, the format SillyTavern saves chats in). |
| **Import Preset (JSON)** | A `.json` preset. |
| **Import Lorebook (JSON)** | A `.json` World Info file. |

The buttons have no options. A character import keeps all source tags and limits any regex scripts to that character. A regex script is a find-and-replace rule for text. To choose these options, use **Import** in the Characters panel. See [Importing and Exporting Character Cards](../characters/import-export.md).

If a character card has a lorebook inside it, your browser asks whether to import it as its own lorebook. Click **OK** to keep it as a lorebook you can reuse, or **Cancel** to import only the character.

**Import Chat (JSONL)** creates a Roleplay chat, unless the file records another mode, and opens it.

### Import a chat from the chat list

You can also use the import button at the top of the chat list. Its tooltip is **Import SillyTavern or Marinara chat JSONL**. It works the same way: the chat opens in the mode the file records, or as a Roleplay chat when the file records none. See [Exporting and Importing Chats](../chats/export-import.md).

## Import a SillyTavern folder

Before you start: the wizard reads files on the server computer. If SillyTavern is on another computer, copy its folder (the one where you installed SillyTavern) to the Marinara computer first. On the Marinara computer the wizard works right away. From another device, set the admin secret and enter it in **Settings → Advanced → Admin Access**. See [Backing Up and Restoring Marinara](backup-and-restore.md) and the "Privileged APIs (ADMIN_SECRET)" section of the [Server Configuration Reference](../CONFIGURATION.md).

1. Open **Settings → Imports → SillyTavern Import**.
2. Click **Import from SillyTavern Folder**.
3. Choose your SillyTavern folder. Pick the main folder, usually the one that holds a `data/` or `public/` folder. Use one of these ways:
   - Click **Browse** and pick the folder.
   - If there is no folder chooser (a remote server), an in-app folder browser opens. It lists only folders inside the home folder of the user that runs the server. Click **Select This Folder**.
   - Type the path in **SillyTavern Folder Path**, for example `/home/you/SillyTavern`. A typed path works if it is inside the home folder of the user that runs the server. If the server's `IMPORT_ALLOWED_ROOTS` setting is set, it must be inside one of those folders instead.
4. Click **Scan Folder**. Marinara shows how many items it found in each category.
5. On **Choose exactly what to import**, check the items you want. Each category has **All** and **None** buttons and a **Show** or **Hide** toggle for the single items.
6. Click **Import Selected**. A progress bar shows the current item and a count per category.
7. When you see **Import complete!**, read the count for each category and click **Done**. Below the counts, a short list says how many chats kept their Author's Note and persona, which SillyTavern user names had no persona here, and which preset settings were left out.

Most items start selected. Marinara leaves SillyTavern's stock presets unchecked, such as `deterministic`, `neutral` and the `universal-*` presets, and a banner says so. Leave them unchecked unless you want copies.

If the scan finds characters, two more options appear:

**Imported character tags** (default **All tags**):

- **All tags** keeps the source tags.
- **No tags** skips them.
- **Existing only** keeps only tags you already have.

**Imported regex scripts** (default **Character only**):

- **Character only** applies the scripts to each character.
- **Global** adds them to **Presets → Regexes**, where you can manage scripts that run across chats. See [Regex Scripts](../extending/regex-scripts.md#manage-your-scripts).

If it did not work:

- "Could not find SillyTavern data directory." means Marinara cannot read that folder. Pick the main SillyTavern folder.
- "Marinara can only read folders inside your home folder" means the folder is outside the home folder of the user that runs the server. Move the SillyTavern folder into it, or ask whoever runs the server to allow its location with the `IMPORT_ALLOWED_ROOTS` setting. If that setting is set, even a picked folder must be inside one of its folders. See the [Server Configuration Reference](../CONFIGURATION.md).
- If **Browse** gets a typed path outside the home folder, the folder browser opens at the home folder instead.
- If one item fails, Marinara skips it, keeps going and lists it under warnings on the last step, for example `Character "Foo": error message`.

## What happens to your data

- Chat files that belong to one character import as branches of one chat. A branch is a copy of a chat that you continue separately.
- Group chats import as Roleplay chats.
- Imported items keep the source file's last-changed date, not the date of the import. Each chat message keeps the date SillyTavern saved it with.
- A chat's **Author's Note** comes along with its depth. If SillyTavern used another frequency, position or role for it, Marinara still adds it to every reply at that depth, and the import says so. A note that was turned off in SillyTavern stays off.
- A chat is linked to the persona SillyTavern used: the persona it was locked to, else the persona with the same name as the chat's user. Import personas in the same run, or make one with that name first. When there is no match, the chat has no persona and the import names the missing persona.
- A preset brings its sampler settings: temperature, Top P, Top K, Min P, frequency and presence penalty, and reasoning effort. They are the starting values for chats that use the preset; a connection's or chat's own values still win. Max response length and context size stay on your connection. Top A and repetition penalty have no setting here and are left out.

## What does not transfer

The wizard reads only the categories in the first table. Other SillyTavern data, such as global app settings, quick replies, instruct and context templates, and connection profiles, is not imported. Chats imported before this fix got the import time as their message dates. To fix one, delete it and import its file again (in a folder import, untick **Skip what's already here**).

## Related guides

- [Importing and Exporting Character Cards](../characters/import-export.md)
- [Importing and Exporting Lorebooks](../lorebooks/import-export.md)
- [Exporting and Importing Chats](../chats/export-import.md)
- [Regex Scripts](../extending/regex-scripts.md)
