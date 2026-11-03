# Backing Up and Restoring Marinara

Save a copy of your Marinara Engine data, and put it back later. Do this before you upgrade, move to a new device, or [clear your data](clearing-data.md).

## Which one to use

| Option | What it makes | Use it for |
| --- | --- | --- |
| **Download Backup** | A `.zip` file with all your data, uploaded files and the key file for saved API keys. | One complete copy of everything. |
| **Export Profile** | A smaller file with your account data: characters, personas, chats, lorebooks, presets, agents, themes and Personal Extensions. | A restorable copy without secrets, or characters and lorebooks for other tools. |

A `.zip` is one file that holds many files. Both options are in **Settings → Advanced → Backup & Export**. Restoring is in **Settings → Imports → Profile & Marinara**.

**Before you start:** on the computer that runs Marinara, these tools work right away. From a phone, a tablet or any other device, set the admin secret (`ADMIN_SECRET`) on the server and enter the same value in **Settings → Advanced → Admin Access**. See [Remote Access](../REMOTE_ACCESS.md).

## Download Backup

1. Open **Settings → Advanced**.
2. In **Backup & Export**, click **Download Backup**. The button shows **Creating backup…**.
3. Save the file when your browser asks, or find it in your Downloads folder.

The `.zip` holds:

- your saved text data (characters, chats, lorebooks, presets, connections, settings);
- your uploaded and generated files, such as avatars, sprites, backgrounds, gallery images, fonts, custom emoji and stickers, and your custom notification sound;
- the `.encryption-key` file, when it exists;
- a `RESTORE.txt` note that explains how to recover files by hand.

For the folder names, see [Where Marinara Stores Your Data](where-data-is-stored.md).

> **Warning:** A backup is a raw copy. It holds your saved API keys and the `.encryption-key` file that unlocks them. Never share it. Store it somewhere private.

On Android and iOS you cannot reach the app's data folder, so **Download Backup** is the way to get a copy off the device.

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

| Format | What it makes | Restore it in Marinara? |
| --- | --- | --- |
| **Marinara Native** | Marinara fields, lorebook folders, characters, personas, presets, agents, themes, Personal Extension drafts and media. | Yes |
| **Compatible JSON** | A `.zip` of plain character, persona and lorebook files for other tools. | No |

A native profile downloads as `marinara-profile.json`. A large one downloads as `marinara-profile.zip` instead.

A native profile keeps Personal Extension code, but not whether it is turned on or approved. Every restored extension arrives disabled. Review it again in **Settings → Addons**.

## Restore with Import Profile

**Import Profile** loads a profile file or a **Download Backup** `.zip`.

1. Open **Settings → Imports**.
2. In **Profile & Marinara**, click **Import Profile (JSON/ZIP)**.
3. Choose `marinara-profile.json`, `marinara-profile.zip` or a backup `.zip`. The button shows **Scanning Profile...**.
4. Read the **Import Profile** dialog. It lists what Marinara found and warns that you cannot undo the import.
5. Click **Import**, or **Cancel** to stop. A progress bar shows **Importing Profile...**.

If it did not work:

- If the file changed on disk after you chose it, the import stops with a warning. Choose the file again.
- Outside your own computer, profile import needs HTTPS. Open Marinara through an HTTPS address.
- If a `.zip` is missing some media files, the import still finishes. A warning lists what is missing, and Marinara imports the rest.

Recent profiles match each item by its own identity, not its name. If you import the same profile twice, Marinara updates your items and does not make copies. Profiles from much older versions do not match this way, so importing one again can make duplicate characters, personas and lorebooks.

## Enter your keys again

**Export Profile** blanks your API keys and webhook links. An API key is the secret code a service gives you. This makes the profile file safe to store.

**Import Profile** also reads the profile file inside a backup `.zip`. Items it creates come in with blank keys and links, even from a backup. After you import:

1. Open **Connections** from the top bar.
2. Open each account you use, enter its API key and save. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
3. Enter the webhook link again on each custom tool that uses one.

Marinara also leaves some chat addresses out of the profile: the Discord mirror webhook, the DeepLX address, the DeepL key and the Intiface address. The same goes for settings profiles and the translation defaults for new chats. Enter them again in each chat's **Chat Settings**.

Importing never blanks keys you already set. If you import an old profile again, items that still exist keep their live keys and links.

## The Existing backups list

The **Backup & Export** section can show an **Existing backups** list with a delete button. It is normally empty. **Download Backup** saves to your device and adds nothing to it. The automatic backup is managed by the **Automatic backups** setting.

## Related guides

- [Where Marinara Stores Your Data](where-data-is-stored.md)
- [Clearing or Resetting Your Data](clearing-data.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
