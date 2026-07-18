# Importing from SillyTavern

This guide shows how to bring your SillyTavern data into Guksu Motor. You can import one file at a time, or scan a whole SillyTavern folder and import everything at once.

## What you can bring over

Guksu Motor can import these kinds of SillyTavern data:

- Characters (character cards)
- Chats (message logs)
- Group chats (chats with more than one character)
- Presets (generation settings)
- Lorebooks (SillyTavern calls these "World Info")
- Backgrounds (chat background images)
- Personas (your own **{{user}}** profiles)

A lorebook is a set of notes the AI reads when certain words come up in the chat. A preset is a saved bundle of generation settings. A persona is the profile that stands in for you in a chat.

There are two ways to import. Use the single-file buttons for one file. Use the **Import from SillyTavern Folder** wizard to move a whole SillyTavern install at once.

## Quick single-file imports

Open **Settings**, then the **Imports** tab, then find the **SillyTavern Import** section. Its description reads "Bring over characters, chats, presets, and lorebooks from SillyTavern files."

This section has four one-file buttons. Each one opens a normal file picker with no extra options:

- **Import Character (JSON/PNG)** takes a `.json` or `.png` character card.
- **Import Chat (JSONL)** takes a `.jsonl` chat log. It always creates a **Roleplay** chat and switches you to it.
- **Import Preset (JSON)** takes a `.json` preset file.
- **Import Lorebook (JSON)** takes a `.json` World Info file.

JSONL means one JSON record per line. It is the format SillyTavern uses to save a chat log.

When you import a character whose card has an embedded lorebook, a browser prompt asks if you also want to import it as a standalone Guksu lorebook. Click **OK** to keep the World Info as its own lorebook you can reuse. Click **Cancel** to skip that step and import only the character.

These quick buttons use fixed defaults you cannot change here. They keep all source tags and they scope any regex scripts to the character only. A regex script is a find-and-replace rule that changes text before or after the AI sees it. To choose those options yourself, use the **Import** button in the Characters panel instead. See [Importing and Exporting Character Cards](../characters/import-export.md).

### Importing a chat into a chosen mode

The single-file **Import Chat (JSONL)** button above always makes a **Roleplay** chat. If you want the chat to land in a different mode, use the small import button at the top of the chat list instead. Its tooltip reads **Import SillyTavern or Guksu chat JSONL**. That button imports the file into whichever mode tab you have open, such as Conversation, Roleplay, or Game. For more on chat import and export, see [Exporting and Importing Chats](../chats/export-import.md).

## Import from SillyTavern Folder

This wizard scans a full SillyTavern folder and imports many items at once. It reads characters, chats, group chats, presets, lorebooks, backgrounds, and personas together.

To open it, go to **Settings**, then **Imports**, then the **SillyTavern Import** section, then click **Import from SillyTavern Folder**. A window titled **Import from SillyTavern** opens.

### Step 1: point at your SillyTavern folder

1. In the field labeled **SillyTavern Folder Path**, type the path to your SillyTavern folder. An example is `/path/to/SillyTavern`.
2. Or click **Browse** to pick the folder with your computer's folder chooser. On a remote or headless server with no folder chooser, an in-app folder browser opens instead, with a **Select This Folder** button.
3. Point at the main SillyTavern folder. The tip in the window says this is usually the folder that holds a `data/` or `public/` folder inside it.
4. Click **Scan Folder**. The button shows **Scanning...** while it works.

After the scan, Guksu reports how many items it found in each category. If it cannot read the folder, it shows an error such as "Could not find SillyTavern data directory."

### Step 2: choose what to import

The next screen is titled **Choose exactly what to import**. It shows a checklist for each category: **Characters**, **Chats**, **Group Chats**, **Presets**, **Lorebooks**, **Backgrounds**, and **Personas**. A counter shows how many items you have selected.

Each category has **All** and **None** buttons and a **Show** or **Hide** toggle so you can see the individual items and their dates.

Almost everything starts pre-selected. SillyTavern's built-in presets are the exception. Guksu detects them and leaves them unchecked, and a banner explains why. These are the stock presets such as `default`, `deterministic`, `neutral`, and the `universal-*` presets. Leave them unchecked unless you really want copies.

If the scan found any characters, two extra controls appear:

- **Imported character tags** sets the tag import mode. Choose **All tags** to keep the source tags, **No tags** to skip them, or **Existing only** to keep only tags you already have in Guksu. The default is **All tags**.
- **Imported regex scripts** sets where regex scripts go. Choose **Character only** so the scripts apply to each bot, or **Global** to add them to **Presets -> Regexes** for every chat. The default is **Character only**.

When your selection looks right, click **Import Selected**. Click **Back** to return to the folder step.

### Step 3: watch the progress

Guksu imports the items one at a time. You see a spinner, the current category and item name, a progress bar, and running counts per category.

### Step 4: read the results

The last step shows an **Import complete!** banner when the import succeeds, or an error banner when it fails. On success, a card for each category shows its final count. If any single item failed, a warnings list shows one line per failure, such as `Character "Foo": error message`. Click **Done** to close the window.

### How the wizard handles your data

- The import is best-effort per item. If one character, chat, preset, lorebook, background, or persona fails, Guksu skips it, records a warning, and keeps going with the rest.
- Several chat files that belong to one character import as branches of a single chat, not as separate chats.
- Group chats always import as **Roleplay** chats.
- Imported items keep the source file's last-changed date as their date in Guksu. They do not use the moment you ran the import.

## Access and folder rules

The single-file import buttons work for everyone with no extra setup.

The **Import from SillyTavern Folder** wizard reads files from disk, so it needs privileged access. On the same machine as the server (loopback), it works with no extra setup. From another device or browser, you must set an admin secret on the server. Then save the same value in **Settings -> Advanced -> Admin Access**. See [Server Configuration Reference](../CONFIGURATION.md) for how to set the admin secret.

If your server sets `IMPORT_ALLOWED_ROOTS`, Guksu rejects typed paths outside those folders. Paths you pick with **Browse** or the in-app folder browser always work, even with that setting on.

## What does not transfer

The folder wizard only scans the seven categories listed above. Other SillyTavern data, such as global app settings, quick replies, and extensions, is not read and is not imported.

SillyTavern's built-in presets are left unchecked by default, so they do not come over unless you check them yourself.

Guksu skips any single item that fails to convert. Check the warnings list on the last step of the wizard to see exactly what was left out.

## Related guides

- [Importing and Exporting Character Cards](../characters/import-export.md)
- [Importing and Exporting Lorebooks](../lorebooks/import-export.md)
- [Exporting and Importing Chats](../chats/export-import.md)
- [Regex Scripts](../extending/regex-scripts.md)
