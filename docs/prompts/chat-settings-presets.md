# Chat Settings Presets

This guide explains Chat Settings Presets in Guksu Motor. A preset is a named bundle of a chat's connection, prompt preset, and other per-chat settings. You can reuse the bundle across chats. This guide shows how to save, apply, star a default, rename, import, and export presets.

## What a Chat Settings Preset is

A Chat Settings Preset, sometimes shortened to a chat preset, is a saved bundle of the settings you pick for one chat. You give the bundle a name, then apply it to any other chat in the same mode. This saves you from setting up the same connection, prompt preset, and agents again every time.

You manage these presets from the top of the **Chat Settings** panel. Open a chat, open **Chat Settings** (the gear), and the preset bar sits at the very top.

Chat Settings Presets work in Conversation Mode and Roleplay Mode. Game Mode does not use them. In a Game chat, the preset bar does not appear.

## Chat Settings Presets are not prompt presets

Guksu has two different "preset" systems. Do not mix them up.

- A **prompt preset** is the system prompt template that builds the text sent to the AI. You edit it in the Presets panel. See [Preset Editor and Prompt Manager](presets.md).
- A **Chat Settings Preset** is a wider bundle. It includes which prompt preset the chat uses, plus the connection, agents, and more.

In short, a prompt preset is one item inside a Chat Settings Preset. This guide covers the Chat Settings Preset bundle only.

## What a preset includes and excludes

A Chat Settings Preset bundles this chat's settings. The in-app help text lists them: the connection, the prompt preset (called the prompt source in Conversation Mode), agents, tools, translation, memory recall, advanced parameters, and other settings.

A preset never touches content that belongs to the chat itself. The help text names these: your characters, persona, lorebooks, sprites, summary, tags, and scene prompt. Those stay tied to the chat and do not change when you apply a preset.

So a preset carries how the chat talks to the AI. It does not carry who is in the chat or what has happened so far.

## Applying a preset to a chat

The preset bar has a dropdown at the top. Its tooltip reads **Apply a chat-settings preset to this chat**.

1. Open the chat you want to change.
2. Open **Chat Settings** (the gear icon).
3. Open the preset dropdown at the top of the panel.
4. Pick a preset by name.

The chat's settings update at once to match the preset. If your current chat does not match any saved preset, the dropdown shows **Custom settings - choose a preset**. If the chat points at a preset that no longer exists, it shows **Missing preset - choose a preset**.

## Saving your settings as a preset

The row of icon buttons under the dropdown holds the preset actions. Hover over a button to see its label. The buttons are:

| Button | Tooltip label | What it does |
|---|---|---|
| Save (disk icon) | **Save current chat settings into this preset** | Overwrites the selected preset with the chat's current settings |
| Rename (pencil icon) | **Rename preset** | Renames the selected preset |
| Save As (file-plus icon) | **Save current chat settings as a new preset** | Creates a new preset from the chat's current settings |
| Import (down-arrow icon) | **Import preset (.json)** | Loads a preset from a `.json` file |
| Export (up-arrow icon) | **Export preset (.json)** | Saves the selected preset to a `.json` file |
| Delete (trash icon) | **Delete preset** | Removes the selected preset |

To make your first preset, set up a chat the way you like, then use **Save current chat settings as a new preset**. Type a name and confirm. Your new preset now appears in the dropdown.

To update a preset later, apply it, change the chat's settings, then use **Save current chat settings into this preset**. This overwrites the preset with the new settings.

## Starring a default preset

Next to the dropdown is a star button. Its tooltip reads **Mark this preset as default for new chats in this mode**.

Star a preset to make it the starting point for every new chat you create in that mode. Only one preset per mode can be the starred default at a time. Starring a new one moves the star off the old one.

When a preset is already the default, the star tooltip reads **This preset is the default for new chats in this mode**. When no preset is selected, it reads **Select a preset to mark it as default**.

## Importing and exporting presets

Use **Export preset (.json)** to save a preset as a file you can share or back up. The file downloads with a `.marinara-chat-preset.json` name.

Use **Import preset (.json)** to load a preset file back in. Guksu adds the imported preset as a new, non-default preset. It does not overwrite anything and it does not become the default until you star it.

Presets store settings, not secrets. Sharing a preset file is a safe way to pass your setup to another person.

## The Default preset

Every mode that supports this feature has one built-in preset named **Default**. Conversation Mode and Roleplay Mode each get their own **Default**.

The **Default** preset is empty. Apply it to reset a chat's preset-controlled settings back to the system defaults for that mode. This is a quick way to start over on a chat's setup.

You cannot change the **Default** preset. The Save, Rename, and Delete buttons are greyed out while it is selected, so you cannot click them. Their tooltips explain this: **Cannot save into the Default preset**, **Cannot rename the Default preset**, and **Cannot delete the Default preset**.

## Related guides

- [Chat Settings Overview](../chats/chat-settings.md)
- [Preset Editor and Prompt Manager](presets.md)
- [Generation Parameters](generation-parameters.md)
