# Clearing or Resetting Your Data

Permanently delete some or all of your data with the **Danger Zone**. There is no undo.

To delete one chat or one character, use its own delete button instead. See [Managing Chats](../chats/managing-chats.md) and [Creating and Editing Characters](../characters/creating-and-editing-characters.md).

**Before you start:** make a backup. There is no trash or recycle bin. See [Backing Up and Restoring Marinara](backup-and-restore.md). If you use Marinara from another device, you also need the admin secret. See [Remote Access](../REMOTE_ACCESS.md).

## Clear some categories

1. Open **Settings → Advanced** and scroll to **Danger Zone**.
2. Check each category you want to delete. **Select All** checks every box. When all are checked, the same button reads **Clear Selection** and unchecks them.
3. Click **Clear Selected Data**. It stays disabled until you check a category.
4. Read the warning. It shows how many categories you picked.
5. Click **Confirm Delete**, or **Cancel** to stop. Nothing is deleted until you confirm.

When it works, a message says the selected data was cleared. If the request fails, an error message appears ("Failed to clear selected data."). Some data may already be cleared, so check what is left. Check that you have admin access.

## Clear everything

1. In **Danger Zone**, click **Clear All Data**. You do not need to check any box.
2. The warning asks: "Delete all supported data categories except Professor Mari? There is no undo."
3. Click **Confirm Delete**, or **Cancel** to stop.

This does the same as checking all eight boxes.

## The eight data categories

Each category deletes only what its row lists, except for the gallery folder noted below the table.

| Category | What it deletes |
| --- | --- |
| **Chats & Messages** | All chats and their contents, and the whole `gallery` folder and game scene videos. |
| **Characters** | All characters and groups, except Professor Mari, with their avatars. |
| **Personas** | All personas and groups, with their avatars. |
| **Lorebooks** | All lorebooks, entries and folders. |
| **Presets** | All prompt presets and preset folders, except the built-in stock preset. |
| **Connections** | All saved accounts, and the model choices and voice settings tied to them. |
| **Automation & Addons** | All agent settings, custom tools, regex scripts and synced themes. Not Personal Extensions or External Extensions. |
| **Media & Assets** | Backgrounds, avatars, sprites, gallery, scene videos, fonts and knowledge-source files. |

More detail:

- **Chats & Messages** also deletes swipes (several answers kept on one message), memories, agent results, game state and chat images.
- **Characters** and **Personas** also delete 2D and 3D avatar models.
- **Presets** also deletes their groups, sections and variables. If another preset was the default, the stock preset becomes the default.
- **Connections** also clears text-to-speech and speech-to-text settings, the models you chose for features, and a Tripo API key saved on the **3D Avatars** page.
- **Automation & Addons** also deletes agent results, agent memory, agent folders and agent Home widgets.
- **Media & Assets** also deletes the asset list and chat images.
- Knowledge-source files are files you uploaded for knowledge agents. Synced themes are your custom themes saved in Marinara.

Some categories reach into files outside their name. **Chats & Messages** deletes the whole `gallery` folder, including character and persona gallery images, even if you did not check **Characters** or **Personas**.

Clearing does not touch your other settings, the `backups/` folder or the `.encryption-key` file. It also leaves Personal Extensions, Game Mode assets, custom emoji and stickers, your notification sound, lorebook, preset, agent and account images, and long-term memory files. See [Where Marinara Stores Your Data](where-data-is-stored.md).

## Professor Mari stays

Professor Mari is the built-in assistant on the Home screen. The **Danger Zone** never deletes her, not even with **Clear All Data**.

## Related guides

- [Backing Up and Restoring Marinara](backup-and-restore.md)
- [Where Marinara Stores Your Data](where-data-is-stored.md)
- [Remote Access](../REMOTE_ACCESS.md)
