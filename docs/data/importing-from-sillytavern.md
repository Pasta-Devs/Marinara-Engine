# Importing from SillyTavern

Bring your SillyTavern data into Marinara Engine. Import one file at a time, or scan a whole SillyTavern folder and import everything at once.

## What you can bring over

| SillyTavern data | In Marinara |
| --- | --- |
| Characters | Characters |
| Chats and group chats | Chats |
| Presets | Presets (a saved bundle of generation settings) |
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

### Import a chat into a mode you choose

To pick the mode, use the import button at the top of the chat list. Its tooltip is **Import SillyTavern or Marinara chat JSONL**. It imports into the mode tab you have open (Conversation, Roleplay or Game). See [Exporting and Importing Chats](../chats/export-import.md).

## Import a SillyTavern folder

Before you start: the wizard reads files on the server computer. If SillyTavern is on another computer, copy its folder (the one where you installed SillyTavern) to the Marinara computer first. On the Marinara computer the wizard works right away. From another device, set the admin secret and enter it in **Settings → Advanced → Admin Access**. See [Backing Up and Restoring Marinara](backup-and-restore.md) and the "Privileged APIs (ADMIN_SECRET)" section of the [Server Configuration Reference](../CONFIGURATION.md).

1. Open **Settings → Imports → SillyTavern Import**.
2. Click **Import from SillyTavern Folder**.
3. Choose your SillyTavern folder. Pick the main folder, usually the one that holds a `data/` or `public/` folder. Use one of these ways:
   - Click **Browse** and pick the folder.
   - If there is no folder chooser (a remote server), an in-app folder browser opens. It lists only folders inside the home folder of the user that runs the server. Click **Select This Folder**.
   - Type the path in **SillyTavern Folder Path**, for example `/path/to/SillyTavern`. A typed path works only if the server's `IMPORT_ALLOWED_ROOTS` setting lists a folder that contains it.
4. Click **Scan Folder**. Marinara shows how many items it found in each category.
5. On **Choose exactly what to import**, check the items you want. Each category has **All** and **None** buttons and a **Show** or **Hide** toggle for the single items.
6. Click **Import Selected**. A progress bar shows the current item and a count per category.
7. When you see **Import complete!**, read the count for each category and click **Done**.

Most items start selected. Marinara leaves SillyTavern's stock presets unchecked, such as `deterministic`, `neutral` and the `universal-*` presets, and a banner says so. Leave them unchecked unless you want copies.

If the scan finds characters, two more options appear:

**Imported character tags** (default **All tags**):

- **All tags** keeps the source tags.
- **No tags** skips them.
- **Existing only** keeps only tags you already have.

**Imported regex scripts** (default **Character only**):

- **Character only** applies the scripts to each character.
- **Global** adds them to **Presets → Regexes** for every chat.

If it did not work:

- "Could not find SillyTavern data directory." means Marinara cannot read that folder. Pick the main SillyTavern folder.
- "folderPath is not allowed" means the server refused the path. Click **Browse** and pick the folder instead. The server's owner can limit which folders may be imported with the `IMPORT_ALLOWED_ROOTS` setting. If it is set, even a picked folder must be inside one of those folders. Ask whoever runs the server, or see the [Server Configuration Reference](../CONFIGURATION.md).
- If one item fails, Marinara skips it, keeps going and lists it under warnings on the last step, for example `Character "Foo": error message`.

## What happens to your data

- Chat files that belong to one character import as branches of one chat. A branch is a copy of a chat that you continue separately.
- Group chats import as Roleplay chats.
- Imported items keep the source file's last-changed date, not the date of the import.

## What does not transfer

The wizard reads only the categories in the first table. Other SillyTavern data, such as global app settings and quick replies, is not imported.

## Related guides

- [Importing and Exporting Character Cards](../characters/import-export.md)
- [Importing and Exporting Lorebooks](../lorebooks/import-export.md)
- [Exporting and Importing Chats](../chats/export-import.md)
- [Regex Scripts](../extending/regex-scripts.md)
