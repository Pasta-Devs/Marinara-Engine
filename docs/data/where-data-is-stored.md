# Where Marinara Stores Your Data

Find the folder where Marinara Engine keeps your data, and know which parts to keep when you move or copy it.

Marinara runs on your own computer and saves your characters, chats and settings there. When you generate a reply, Marinara still sends your chat content to the AI service you connected.

## Find the data folder

Everything you create lives in one folder on the computer that runs the server. This is the data folder. Its setting is `DATA_DIR`, a value you give the server before it starts (an environment variable). It is not in **Settings**.

- By default it is a folder named `data` next to the server files.
- In the official Docker container it is `/app/data`.
- To see the exact path, look at the window where you started Marinara (the terminal or console). When it starts, it prints a line that begins with `[storage] DATA_DIR=` followed by the path. If you cannot find that window, look for a folder named `data` inside the Marinara folder.

To move the folder, set `DATA_DIR` and restart Marinara. See the [Server Configuration Reference](../CONFIGURATION.md).

## What is inside

Your text data is in the `storage` folder: characters, chats, messages, lorebooks, presets and connections. Marinara saves it as many small files. After an upgrade from the older layout, you may see old copies in `storage/tables/` with names ending in `.pre-shard`. Marinara never deletes them. You can delete them yourself to free space once everything works.

Your images, audio and other files are in their own folders next to `storage`. The folder names are:

| Folder | What it holds |
| --- | --- |
| `avatars` | Character and persona avatars |
| `sprites` | Character sprite art |
| `avatar-models` | Files for the **2D Avatars** and **3D Avatars** agents, such as PNGTuber pictures and 3D models |
| `backgrounds` | Chat backgrounds you uploaded |
| `gallery` | Gallery images |
| `fonts` | Custom fonts you added |
| `knowledge-sources` | Files you uploaded for knowledge agents |
| `game-assets` | Game Mode assets |
| `game-scene-videos` | Game Mode scene videos |
| `conversation-call-character-videos` | Character videos for Conversation calls |
| `custom-emojis` | Custom emoji images |
| `custom-stickers` | Custom sticker images |
| `notification-sounds` | Your custom notification sound |
| `long-term-memory` | Data for the long-term memory agent |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Images attached to lorebooks, presets, agents and accounts |

The data folder also holds `backups/` (your [automatic backups](backup-and-restore.md#automatic-backups)) and the encryption key file. **Download Backup** includes every folder in the table, `storage` and the key file. Developers can read [File-Native Storage](../development/file-storage.md).

## Keep the encryption key file

Marinara encrypts your saved API keys. The key for this is the file `.encryption-key` in the data folder.

If you copy your data to a new computer without this file, Marinara cannot read your saved API keys. You must enter them again. Copy it together with the rest of the data folder.

Some setups give the key through the `ENCRYPTION_KEY` environment variable instead. Then there is no file to copy. Keep that value safe on its own. See the [Server Configuration Reference](../CONFIGURATION.md).

## Copy your data from Android

On Android, the data folder is in app storage that you cannot reach without root access, so you cannot copy it. Use **Settings → Advanced → Backup & Export → Download Backup**. The `.zip` includes the `.encryption-key` file when one exists. See [Backing Up and Restoring Marinara](backup-and-restore.md).

Automatic backups are saved in the same app storage. Uninstalling or resetting the app can remove them with the live data, so keep a copy somewhere else.

## Related guides

- [Backing Up and Restoring Marinara](backup-and-restore.md)
- [Clearing or Resetting Your Data](clearing-data.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [File-Native Storage](../development/file-storage.md)
