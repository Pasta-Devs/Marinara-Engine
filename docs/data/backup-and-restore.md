# Backing Up and Restoring Marinara

Save a copy of your Marinara Engine data, and put it back later. Do this before you upgrade, move to a new device, or [clear your data](clearing-data.md).

## Which one to use

| Option | What it makes | Use it for |
| --- | --- | --- |
| **Download Backup** | A `.zip` with all your data and files. | One complete copy of everything. |
| **Export Profile** | A smaller file with your account data (characters, chats, lorebooks and more). | A copy without secrets, or files for other tools. |

A `.zip` is one file that holds many files. Both options are in **Settings → Advanced → Backup & Export**. Restoring is in **Settings → Imports → Profile & Marinara**.

**Before you start:** on the computer that runs Marinara, these tools work right away. From a phone, a tablet or any other device, set the admin secret on the server and enter the same value in **Settings → Advanced → Admin Access**. The admin secret is a password in the server's `.env` file, as the setting `ADMIN_SECRET`. See the "Privileged APIs (ADMIN_SECRET)" section of the [Server Configuration Reference](../CONFIGURATION.md) and [Remote Access](../REMOTE_ACCESS.md).

## Download Backup

1. Open **Settings → Advanced**.
2. In **Backup & Export**, click **Download Backup**. The button shows **Creating backup…**.
3. Save the file when your browser asks, or find it in your Downloads folder.

The `.zip` holds:

- your saved text data (characters, chats, lorebooks, presets, connections, settings);
- your uploaded and generated files, such as avatars, sprites, backgrounds, gallery images, fonts, custom emoji and stickers, and your custom notification sound;
- the `.encryption-key` file, when it exists;
- a `RESTORE.txt` note about restoring files by hand (see [Restore by hand](#restore-by-hand)).

For the folder names, see [Where Marinara Stores Your Data](where-data-is-stored.md).

> **Warning:** A backup holds your saved API keys and the `.encryption-key` file that unlocks them. Never share it. Store it somewhere private.

On Android you cannot reach the app's data folder, so **Download Backup** is the way to get a copy off the device.

If it did not work: if you see "Backup preparation timed out after one hour.", try again. If another device cannot download, check **Admin Access** (see above).

## Automatic backups

Marinara can make a full backup on a schedule, on the computer that runs it.

1. Open **Settings → Advanced → Backup & Export**.
2. Turn on **Automatic backups**.
3. Choose **Daily**, **Weekly** or **Monthly**.
4. Set **Automatic backups kept** from 1 to 9999.

Marinara makes the first backup shortly after you turn it on. After each run it keeps the newest backups up to your number and deletes older automatic ones. It never deletes backups you made with **Download Backup**.

Automatic backups are in the `backups/` folder inside the data folder. The newest is `marinara-automatic-backup.zip`. Older ones have a date and time in the name. They use the same format as **Download Backup**.

Each run needs free space for one more full archive, because the old one stays until the new one is done. If there is not enough room, Marinara skips the run and shows the reason next to the setting. It tries again when space is free.

> **Tip:** Keep a second copy outside the data folder. A lost disk or an erased app also removes the automatic backups.

## Export a profile

1. Open **Settings → Advanced → Backup & Export**.
2. Click **Export Profile**. A dialog with the same title opens.
3. Pick a format.
4. Your browser downloads the file.

- **Marinara Native** keeps your characters, personas, chats, lorebooks, presets, agents, themes, Personal Extension code and media. It does not restore API keys, webhook links or some chat settings (see [Enter your keys again](#enter-your-keys-again)). You can restore it in Marinara.
- **Compatible JSON** makes a `.zip` of plain character, persona and lorebook files for other tools. You cannot restore it in Marinara.

A native profile downloads as `marinara-profile.json`. If it is too large, Marinara offers a ZIP file instead. Click **Export ZIP** to download `marinara-profile.zip`.

A native profile keeps regex scripts, their folders and each folder's pause setting. To share individual scripts as JSON, see [Regex Scripts](../extending/regex-scripts.md#import-and-replace-scripts).

A native profile keeps Personal Extension code, but not whether it is turned on or approved. Every restored extension arrives disabled. Review it again in **Settings → Addons**.

## Restore with Import Profile

**Import Profile** loads a profile file or a **Download Backup** `.zip`.

1. Open **Settings → Imports**.
2. In **Profile & Marinara**, click **Import Profile (JSON/ZIP)**.
3. Choose `marinara-profile.json`, `marinara-profile.zip` or a backup `.zip`. The button shows **Scanning Profile...**.
4. Read the **Import Profile** dialog. It lists what Marinara found. Items already in Marinara are replaced by the file's versions, unless you [only add what's missing](#only-add-whats-missing).
5. Click **Import**, or **Cancel** to stop. The button shows **Importing Profile...**. Marinara first saves a safety copy of your data, then a progress bar follows. When it finishes, a message says the profile was imported.

If it did not work:

- Unless you open Marinara at `localhost`, `127.0.0.1` or `[::1]`, profile import needs HTTPS. The error is "Profile import requires HTTPS outside local development." Open Marinara through an HTTPS address.
- If a `.zip` is missing some media files, the import still finishes. A warning lists what is missing, and Marinara imports the rest.
- If the disk is too full for the safety copy, nothing is imported. The error starts with "Nothing was imported, because a safety copy could not be saved first." Free up about as much space as a full backup takes, then import again.

If you import the same profile twice, Marinara updates your items and does not copy them. Profiles from much older versions can make duplicates.

### Only add what's missing

To get back something you deleted without losing changes you made since, turn on **Keep my current versions, only add what's missing** above **Import Profile (JSON/ZIP)**, then import as above. Every item and file already in Marinara stays as it is, and only what Marinara doesn't have is added. That includes everything you deleted since the file was saved, such as single messages or lorebook entries, not only the item you wanted back. Long-term memory counts as one item: if Marinara already has some, the file's is not added.

Nothing is replaced, so Marinara saves no safety copy, and **Undo Last Import** still undoes the import before this one.

Profiles from much older versions can't do this: they always add their items next to yours, and the **Import Profile** dialog says so.

### Undo an import

Before each import that replaces items, Marinara saves a full copy of your data in the `backups/` folder of the data folder, as a file whose name starts with `marinara-before-import-` followed by the date and time. When the import finishes, the copy from the import before it is deleted, so only the latest one is kept.

1. Open **Settings → Imports**.
2. In **Profile & Marinara**, click **Undo Last Import**. The line under it shows when the safety copy was saved.
3. Click **Undo Last Import** in the dialog to confirm.

Undo puts back your versions of the items and files the last import replaced. If you changed one of those items after the import, that change is lost. Everything else stays as it is, including items the import added. You can undo an import once, and then the safety copy is deleted.

Undo does not turn back on what the import switched off for safety. Turn these on again by hand:

- your active theme;
- Personal Extensions (review them again in **Settings → Addons**);
- custom tools that run a script or a webhook;
- Professor Mari memories.

If the import cleared a connection's API key, enter the key again (see [Enter your keys again](#enter-your-keys-again)). Set it again as your default or fallback connection if it was one.

Branch chats the import replaced stay unlinked from the chat they branched from. The import already removed that link, and Undo cannot bring it back.

Profiles from much older versions only add items, so Marinara saves no safety copy for them and there is nothing to undo.

The safety copy takes as much space as a full backup. To free that space without undoing the import, click **Delete Safety Copy** in **Profile & Marinara**, then confirm. Your data stays as it is, but you can no longer undo that import. If an import was interrupted, **Delete Safety Copy** can appear on its own; the copy can't be used for Undo then, but you can still delete it.

## Enter your keys again

**Import Profile** never brings back API keys or webhook links, even from a **Download Backup** `.zip`. An API key is the secret code a service gives you. The profile file and the profile inside a backup have these values blanked. So after you import on a new computer, you must enter them again:

1. Open **Connections** from the top bar.
2. Open each account you use, enter its API key and save. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
3. Enter the webhook link again on each custom tool that uses one.

Some chat settings with addresses or keys (Discord, DeepL, Intiface) also come back blank. Enter them again in each chat's **Chat Settings**.

Importing never blanks keys you already set on the same install.

## Move to a new computer

1. Install Marinara on the new computer and start it. See [Installation](../INSTALLATION.md).
2. Open **Settings → Imports → Profile & Marinara** and click **Import Profile (JSON/ZIP)**.
3. Choose your **Download Backup** `.zip` or your profile file, then click **Import**.
4. Enter your API keys again, as described above.

The key file in a backup only helps if you copy the whole data folder by hand, as below.

## Restore by hand

Use this only if **Import Profile** cannot be used. The `.zip` has one folder inside, for example `marinara-backup-...`, with a `RESTORE.txt` note.

1. Stop Marinara.
2. Unzip the backup.
3. Copy the folders and the `.encryption-key` file from the unzipped folder into your data folder. See [Where Marinara Stores Your Data](where-data-is-stored.md).
4. Start Marinara.

Keep the `.encryption-key` file with the `storage` folder, or the saved API keys cannot be read.

The **Existing backups** list in **Backup & Export** is normally empty. You do not need it.

## Related guides

- [Where Marinara Stores Your Data](where-data-is-stored.md)
- [Clearing or Resetting Your Data](clearing-data.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
