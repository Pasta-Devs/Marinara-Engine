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

A native profile keeps Personal Extension code, but not whether it is turned on or approved. Every restored extension arrives disabled. Review it again in **Settings → Addons**.

## Restore with Import Profile

**Import Profile** loads a profile file or a **Download Backup** `.zip`.

1. Open **Settings → Imports**.
2. In **Profile & Marinara**, click **Import Profile (JSON/ZIP)**.
3. Choose `marinara-profile.json`, `marinara-profile.zip` or a backup `.zip`. The button shows **Scanning Profile...**.
4. Read the **Import Profile** dialog. It lists what Marinara found and warns that you cannot undo the import.
5. Click **Import**, or **Cancel** to stop. The button shows **Importing Profile...** and a progress bar follows. When it finishes, a message says the profile was imported.

If it did not work:

- Unless you open Marinara at `localhost`, `127.0.0.1` or `[::1]`, profile import needs HTTPS. The error is "Profile import requires HTTPS outside local development." Open Marinara through an HTTPS address.
- If a `.zip` is missing some media files, the import still finishes. A warning lists what is missing, and Marinara imports the rest.

If you import the same profile twice, Marinara updates your items and does not copy them. Profiles from much older versions can make duplicates.

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
