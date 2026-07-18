# Clearing or Resetting Your Data

This guide shows you how to permanently delete your data in Guksu Motor using the **Danger Zone**. You can clear a few categories or wipe everything. There is no undo, so read the warnings first.

## Where the Danger Zone is

The clear data tools live in one place.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Scroll to the **Danger Zone** section at the bottom.

The **Danger Zone** description reads: "Permanently clear selected categories of local data. Professor Mari is always preserved."

If you use Guksu from another device (not the computer running the app), clearing data needs admin access. See [Remote Access](../REMOTE_ACCESS.md) for how to set that up.

## Back up before you clear

Clearing data cannot be undone. There is no trash and no recycle bin. Once you confirm, the data is gone.

Make a backup first so you can restore later if you change your mind. See [Backing Up and Restoring Guksu](backup-and-restore.md).

## The eight data categories

The **Danger Zone** shows a checklist of eight categories. Each one is a separate scope. Checking one category does not touch the others.

| Category | What it clears |
|---|---|
| **Chats & Messages** | Chats, folders, messages, scene/OOC data, and chat runtime state. |
| **Characters** | Characters and character groups. Professor Mari is always preserved. |
| **Personas** | Personas and persona groups. |
| **Lorebooks** | Lorebooks and lorebook entries. |
| **Presets** | Prompt presets, groups, sections, and variables. |
| **Connections** | API connections and model endpoints. |
| **Automation & Addons** | Agents, tools, regex scripts, synced themes, and automation state. |
| **Media & Assets** | Backgrounds, avatars, sprites, gallery items, fonts, and knowledge-source files. |

A few categories remove more than database records. **Chats & Messages** also deletes the entire on-disk gallery folder and all scene-video files. This includes character and persona gallery images, even if you did not check **Characters** or **Personas**. **Media & Assets** deletes the on-disk folders for backgrounds, avatars, sprites, galleries, scene-video files, fonts, and knowledge-source files. **Connections** also clears your saved text-to-speech (TTS) settings, because those are tied to a connection.

## Clearing selected categories

Use this when you want to wipe some data but keep the rest.

1. Check the box next to each category you want to delete.
2. To toggle every box at once, use the **Select All** button. When all boxes are checked, the same button changes to **Clear Selection** so you can uncheck them all.
3. Click **Clear Selected Data**. This button stays disabled until at least one category is checked.
4. A warning box appears. It says how many categories you picked and reminds you there is no undo.
5. Click **Cancel** to stop, or **Confirm Delete** to delete. Nothing is deleted until you click **Confirm Delete**.

After a successful clear, you should see a confirmation message. It says the selected data was cleared and runtime caches were reset immediately.

## Clearing everything

Use this to wipe all eight categories in one step.

1. Click **Clear All Data**. You do not need to check any boxes first.
2. A warning box asks: "Delete all supported data categories except Professor Mari? There is no undo."
3. Click **Cancel** to stop, or **Confirm Delete** to delete everything.

This does the same thing as checking every box and clearing them together.

## Professor Mari is always kept

Professor Mari is the built-in helper character. This feature never deletes her. Even if you clear the **Characters** category or use **Clear All Data**, Professor Mari stays in place. You cannot remove her from the **Danger Zone**.

## Related guides

- [Backing Up and Restoring Guksu](backup-and-restore.md)
- [Remote Access](../REMOTE_ACCESS.md)
