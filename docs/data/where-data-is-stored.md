# Where Guksu Stores Your Data

This guide explains where Guksu Motor keeps your data on your own computer. It covers the main data folder, the `storage` and asset folders inside it, and the encryption key file that protects your saved API keys.

Guksu Motor (called "Guksu" below) runs on your own machine. Guksu stores your saved characters, chats, and settings only on your own computer. Keep in mind that when you generate a reply, Guksu still sends your chat content to the AI provider you connected to.

## The data folder (DATA_DIR)

Everything you create in Guksu lives inside one folder on the machine that runs the server. That folder is called the data folder. The environment variable that points to it is named `DATA_DIR`. An environment variable is a value you set on the server outside the app. You will not find it inside the app's **Settings** panel.

By default the data folder is a folder named `data` that Guksu creates next to its server files. If you run Guksu in an official Docker container, the data folder is `/app/data` inside the container.

If you are not sure where the data folder is, check the server startup log. When Guksu starts, it prints a line that begins with `[storage] DATA_DIR=` followed by the full path to your data folder.

You can move the data folder to another location by setting `DATA_DIR` yourself. To learn how to set it, see the [Server Configuration Reference](../CONFIGURATION.md). Guksu must restart for a new `DATA_DIR` value to take effect.

## The storage folder and asset folders

Inside the data folder, your data is split into a `storage` folder and several asset folders.

The `storage` folder holds your text data: characters, chats, messages, lorebooks, presets, and connections. Guksu saves these as files here, so this is the folder that holds most of your work.

Your images, audio, and other media files live in their own folders, each named for what it holds. The main asset folders are:

| Folder | What it holds |
| --- | --- |
| `avatars` | Character and persona avatars |
| `sprites` | Character sprite art |
| `backgrounds` | Chat backgrounds you uploaded |
| `gallery` | Gallery images |
| `fonts` | Custom fonts you added |
| `knowledge-sources` | Files you uploaded for knowledge agents |
| `game-assets` | Game Mode assets |
| `custom-emojis` | Custom emoji images |
| `custom-stickers` | Custom sticker images |

For a deeper technical explanation of how the `storage` folder works, developers can read [File-Native Storage](../development/file-storage.md).

## The encryption key file

Guksu encrypts your saved API keys so they are not stored as plain text. The key used for this encryption is saved in a file named `.encryption-key` inside your data folder.

This file matters when you move or restore your data. Say you copy your data folder to a new machine but leave the `.encryption-key` file behind. Guksu can no longer decrypt your saved API keys, so you have to enter them again. Always keep this file together with the rest of your data.

Some advanced setups provide the key through an `ENCRYPTION_KEY` environment variable instead of the file. If you use that variable, keep the value safe on its own. In that case there is no `.encryption-key` file to copy. See the [Server Configuration Reference](../CONFIGURATION.md) for details.

## Where is my data on Android

On Android, the server's data folder usually sits in app storage that you cannot reach without root access. This means you cannot simply copy the folder off the phone.

To get a copy of your data on Android, use the **Download Backup** button. You can find it in **Settings**, on the **Advanced** tab, in the **Backup & Export** section. This creates a single zip file with your data. The zip includes the `.encryption-key` file when one exists. This is the most reliable way to save your data from a phone.

For the full backup and restore steps on every platform, see [Backing Up and Restoring Guksu](backup-and-restore.md).

## Related guides

- [Backing Up and Restoring Guksu](backup-and-restore.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [File-Native Storage](../development/file-storage.md)
