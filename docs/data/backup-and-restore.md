# Backing Up and Restoring Guksu

This guide shows the two ways to save a copy of everything in Guksu Motor, and how to put that copy back later. Use it before you upgrade, move to a new device, or reset your data.

## Two ways to save your data

Guksu gives you two save options. They live in different places and do different jobs.

- **Download Backup** makes a full **.zip** archive of everything on disk. A **.zip** is a single compressed file that holds many files inside it. This is the most complete copy, and the best guard against data loss.
- **Export Profile** makes a lighter file that holds your account data (characters, personas, chats, lorebooks, presets, agents, and themes). A profile is Guksu's portable copy of your account. You can restore it later inside Guksu.

If you just want one safe copy of everything, use **Download Backup**. Use **Export Profile** when you want a smaller file or a version other roleplay tools can read.

Both save options live in **Settings** on the **Advanced** tab, in the **Backup & Export** section.

## Access on the same device or another device

On the computer that runs Guksu, these tools work right away. This is the loopback case, meaning you opened the app at `localhost` or `127.0.0.1` on the same machine.

From a phone, tablet, or any other device, backup and restore need the **Admin Access** secret. Set the secret on the server, then paste the same value into **Settings** on the **Advanced** tab under **Admin Access**. See the remote access guide linked at the end.

## Download Backup

**Download Backup** creates one **.zip** file with your database, your settings, and all your media folders (avatars, sprites, backgrounds, gallery images, fonts, and more).

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Download Backup**.
5. The button shows **Creating backup...** while it works.
6. On desktop Chrome or Edge, a **Save As** dialog opens so you pick where the file goes. Choose a folder and save.
7. You should see **Backup saved!** or **Backup downloaded!** when it finishes.

On some browsers the **Save As** dialog is not available. In that case the file goes to your normal Downloads folder instead.

This step matters most on Android and iOS. On those devices the app's own data folder is usually not reachable. That makes **Download Backup** the only easy way to get a copy off the device. Save it somewhere safe and private, like your own cloud storage.

The **.zip** also contains a plain text file named `RESTORE.txt`. It explains how to recover your data by hand if you ever need to. Treat the backup as private: it can hold secret files used to unlock your saved API keys. To learn what each folder holds, see the data location guide linked below.

## Export Profile

**Export Profile** creates a smaller file with your account data. Media is included, so avatars and images come along too.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Export Profile**.
5. A dialog titled **Export Profile** opens with two choices.
6. Pick a format (explained below).
7. The file downloads to your device.

The dialog offers two formats:

| Format | What it is | Restorable in Guksu? |
| --- | --- | --- |
| **Guksu Native** | Keeps Guksu fields, lorebook folders, character and persona data, presets, agents, themes, and inline media. | Yes |
| **Compatible JSON** | Plain character, persona, and lorebook files for other roleplay tools. | No |

Choose **Guksu Native** to keep a copy you can restore in Guksu later. It downloads a file named `marinara-profile.json`.

Choose **Compatible JSON** only when you want to move characters or lorebooks to another tool. It downloads a **.zip** of plain files. You cannot restore this file back into Guksu with **Import Profile**.

If a **Guksu Native** file would be very large, Guksu cannot fit it into one JSON file. It then asks **Export profile as ZIP?**. Click to accept, and it downloads `marinara-profile.zip` with the same data instead.

## Restoring with Import Profile

To put a saved profile or a **Download Backup** archive back, use **Import Profile**. It lives on a different tab from the save tools.

1. Open **Settings**.
2. Go to the **Imports** tab.
3. Find the **Profile & Guksu** section.
4. Click **Import Profile (JSON/ZIP)**.
5. Pick your file. It can be a `marinara-profile.json`, a `marinara-profile.zip`, or a full **Download Backup** **.zip**.
6. Guksu scans the file first. The button shows **Scanning Profile...**.
7. A dialog titled **Import Profile** appears. It lists what it found, for example the number of characters and personas.
8. The dialog warns that importing cannot be undone. Read it, then click **Import** to go on, or **Cancel** to stop.
9. The import runs and shows **Importing Profile...** with a progress bar.

A recent Guksu profile restores by matching each item's own identity, not its name. So if you import the same profile twice, it updates your existing items in place instead of making duplicates.

Very old profile files (from much older versions) do not carry this behavior. Re-importing one of those can create duplicate characters, personas, and lorebooks. If you only ever restore recent exports, you will not hit this.

If you pick the file, then change it on disk before you confirm, the import stops with a warning. Just choose the file again.

If a **.zip** is missing some media files, the import still finishes. It shows an amber warning that lists the missing files and imports everything else.

## After you restore: re-enter your keys

**Export Profile** removes secret values from the profile file. Your saved API keys and webhook links are blank inside it. That makes the profile file safe to store and share. An API key is the password that connects Guksu to an AI provider.

A **Download Backup** archive is different. Guksu does not remove secrets from it. The backup **.zip** is a raw copy of your data. It holds your saved keys and the secret file that can unlock them. Never share a backup **.zip**. Store it somewhere private.

**Import Profile** restores from the profile file, even when you pick a backup **.zip**. The archive holds a copy of the profile file inside, and the import reads that copy. So items created by the import come in with blank keys and webhook links.

After you import a profile, do this:

1. Open **Settings**.
2. Go to the **Connections** tab.
3. Re-enter the API key for each provider you use.

If you use custom tools that call a webhook link, re-enter that link on each tool too.

Importing does not erase keys you have already set. If you re-import an old profile, Guksu keeps the live keys and webhook links on items that still exist. A re-import will not blank them.

## The Existing backups list

The **Backup & Export** section can show an **Existing backups** list with a delete button. In normal use this list stays empty. **Download Backup** saves the file straight to your device. It does not leave a copy on the server, so nothing appears here. You do not need this list to make or keep a backup.

## Related guides

- [Where Guksu Stores Your Data](where-data-is-stored.md)
- [Clearing or Resetting Your Data](clearing-data.md)
- [Upgrading Guksu Motor](../UPGRADING.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
