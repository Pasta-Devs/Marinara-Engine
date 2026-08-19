# Backing Up and Restoring Marinara

This guide shows the two ways to save a copy of everything in Marinara Engine, and how to put that copy back later. Use it before you upgrade, move to a new device, or reset your data.

## Two ways to save your data

Marinara gives you two save options. They live in different places and do different jobs.

- **Download Backup** makes a full **.zip** archive of everything on disk. A **.zip** is a single compressed file that holds many files inside it. This is the most complete copy, and the best guard against data loss.
- **Export Profile** makes a lighter file that holds your account data (characters, personas, chats, lorebooks, presets, agents, themes, and Personal Extensions). A profile is Marinara's portable copy of your account. You can restore it later inside Marinara.

If you just want one safe copy of everything, use **Download Backup**. Use **Export Profile** when you want a smaller file or a version other roleplay tools can read.

Both save options live in **Settings** on the **Advanced** tab, in the **Backup & Export** section.

## Access on the same device or another device

On the computer that runs Marinara, these tools work right away. This is the loopback case, meaning you opened the app at `localhost` or `127.0.0.1` on the same machine.

From a phone, tablet, or any other device, backup and restore need the **Admin Access** secret. Set the secret on the server, then paste the same value into **Settings** on the **Advanced** tab under **Admin Access**. See the remote access guide linked at the end.

## Download Backup

**Download Backup** creates one **.zip** file with your database, your settings, and all your media folders (avatars, sprites, backgrounds, gallery images, fonts, your custom notification sound, and more).

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Download Backup**.
5. The button shows **Creating backup…** while it works.
6. When the archive is ready, Marinara streams it straight to your browser without holding the whole file in page memory.
7. Your browser either opens its normal **Save As** dialog or puts the file in your Downloads folder, depending on your download settings.

This step matters most on Android and iOS. On those devices the app's own data folder is usually not reachable. That makes **Download Backup** the only easy way to get a copy off the device. Save it somewhere safe and private, like your own cloud storage.

The **.zip** also contains a plain text file named `RESTORE.txt`. It explains how to recover your data by hand if you ever need to. Treat the backup as private: it can hold secret files used to unlock your saved API keys. To learn what each folder holds, see the data location guide linked below.

## Automatic backups

The **Backup & Export** section can also create a rotating automatic full backup on the device that runs Marinara.
Turn on **Automatic Backups**, choose **Daily**, **Weekly**, or **Monthly**, and set **Automatic backups kept** from
1 to 9999. Marinara creates the first backup shortly after you enable it. After each successful run, it keeps the
newest configured number of automatic archives and deletes the oldest excess automatic archive. This retention limit
never deletes manual backups or backups saved with **Download Backup**.

Automatic backups are stored inside `backups/` in Marinara's data folder. The newest archive is
`marinara-automatic-backup.zip`; retained older automatic archives use timestamped filenames. They use the same
restorable, streamed archive format as **Download Backup**, including uploaded media and the encryption-key file when
one exists. Keep a separate copy outside Marinara's data folder if you need protection from a lost disk, erased app
storage, or a device reset.

## Export Profile

**Export Profile** creates a smaller file with your account data. Media is included, so avatars, images, and your custom notification sound come along too.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Export Profile**.
5. A dialog titled **Export Profile** opens with two choices.
6. Pick a format (explained below).
7. The file downloads to your device.

The dialog offers two formats:

| Format | What it is | Restorable in Marinara? |
| --- | --- | --- |
| **Marinara Native** | Keeps Marinara fields, lorebook folders, character and persona data, presets, agents, themes, Personal Extension drafts, and inline media. | Yes |
| **Compatible JSON** | Plain character, persona, and lorebook files for other roleplay tools. | No |

Choose **Marinara Native** to keep a copy you can restore in Marinara later. Smaller profiles download as
`marinara-profile.json`; larger profiles are offered as a streamed `marinara-profile.zip` whose data is split into
bounded table files so a large library does not have to fit into one in-memory JSON string.

Personal Extension code is preserved in a native profile, but its enabled state and execution approval are not. Every restored extension arrives disabled and must be reviewed again in **Settings** > **Addons**.

Choose **Compatible JSON** only when you want to move characters or lorebooks to another tool. It downloads a **.zip** of plain files. You cannot restore this file back into Marinara with **Import Profile**.

## Restoring with Import Profile

To put a saved profile or a **Download Backup** archive back, use **Import Profile**. It lives on a different tab from the save tools.

1. Open **Settings**.
2. Go to the **Imports** tab.
3. Find the **Profile & Marinara** section.
4. Click **Import Profile (JSON/ZIP)**.
5. Pick your file. It can be a `marinara-profile.json`, a `marinara-profile.zip`, or a full **Download Backup** **.zip**.
6. Marinara scans the file first. The button shows **Scanning Profile...**.
7. A dialog titled **Import Profile** appears. It lists what it found, for example the number of characters and personas.
8. The dialog warns that importing cannot be undone. Read it, then click **Import** to go on, or **Cancel** to stop.
9. The import runs and shows **Importing Profile...** with a progress bar.

A recent Marinara profile restores by matching each item's own identity, not its name. So if you import the same profile twice, it updates your existing items in place instead of making duplicates.

Very old profile files (from much older versions) do not carry this behavior. Re-importing one of those can create duplicate characters, personas, and lorebooks. If you only ever restore recent exports, you will not hit this.

If you pick the file, then change it on disk before you confirm, the import stops with a warning. Just choose the file again.

If a **.zip** is missing some media files, the import still finishes. It shows an amber warning that lists the missing files and imports everything else.

## After you restore: re-enter your keys

**Export Profile** removes secret values from the profile file. Your saved API keys and webhook links are blank inside it. That makes the profile file safe to store and share. An API key is the password that connects Marinara to an AI provider.

A **Download Backup** archive is different. Marinara does not remove secrets from it. The backup **.zip** is a raw copy of your data. It holds your saved keys and the secret file that can unlock them. Never share a backup **.zip**. Store it somewhere private.

**Import Profile** restores from the profile file, even when you pick a backup **.zip**. The archive holds a copy of the profile file inside, and the import reads that copy. So items created by the import come in with blank keys and webhook links.

After you import a profile, do this:

1. Open **Settings**.
2. Go to the **Connections** tab.
3. Re-enter the API key for each provider you use.

If you use custom tools that call a webhook link, re-enter that link on each tool too.

Importing does not erase keys you have already set. If you re-import an old profile, Marinara keeps the live keys and webhook links on items that still exist. A re-import will not blank them.

## The Existing backups list

The **Backup & Export** section can show an **Existing backups** list with a delete button. In normal use this list stays empty. **Download Backup** saves the file straight to your device. It does not leave a copy in this list, and the single rotating automatic archive is managed by the Automatic Backups control instead. You do not need this list to make or keep a downloaded backup.

## Related guides

- [Where Marinara Stores Your Data](where-data-is-stored.md)
- [Clearing or Resetting Your Data](clearing-data.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
