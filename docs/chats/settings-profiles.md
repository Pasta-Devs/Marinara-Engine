# Settings Profiles

A settings profile is a named bundle of reusable chat settings: connection, prompt preset, agents, tools, translation, memory recall, advanced parameters and more. Apply it to another chat instead of setting those options again.

Profiles live at the top of **Chat Settings**. They work in Conversation and Roleplay. Game chats do not show the profile controls.

A **prompt preset** is different. It controls the system prompt structure and generation values, and you edit it in the Presets panel. See [Preset Editor and Prompt Manager](../prompts/presets.md). A settings profile is the wider bundle, and it can include a prompt preset as one item.

## Apply a profile

1. Open the chat you want to change, then open **Chat Settings**. See [Chat Settings](chat-settings.md).
2. Open the **Profile** dropdown (labeled **Apply a settings profile to this chat**).
3. Choose a profile by name.

The chat updates at once. If the profile turns **Hide summarised messages** on or off, the chat's summarised messages are hidden from the model, or shown again, at the same moment.

If it did not work: when the chat's values match no saved profile, the dropdown shows **Custom settings profile**. If the applied profile was deleted, it shows **Missing profile - choose a profile**. Choose another profile.

## Create or edit a profile

1. Next to the dropdown, tap **New** ("New profile from this chat's settings"). The profile builder opens with this chat's settings in its slots. To change a saved profile, select it and click **Edit**. The Default profile cannot be edited.
2. Type a **Profile name**.
3. Fill the slots (see the list below).
4. Tap **Save and choose chats…**.
5. To use the profile for new chats, tick **Make this the default**. The list starts with **New conversation chats** or **New roleplay chats**.
6. Tick the existing chats that should get the profile now.
7. Tap **Apply to N chats**, or **Save** with none ticked.

The builder groups the slots under **Chat**, **Story**, **Pictures** and **Behind the scenes**. The slots are:

- **Connection**, **Prompt preset** and **Parameters**
- **Agents**, **Tools** and **Memory & summary**
- **Persona**, **Lorebooks** and **Background**
- **Image style** and **Translation**

How to fill the slots:

- Pick items from each slot's list. **Agents**, **Tools** and **Lorebooks** allow several picks. Use the checkboxes in **Tools** to turn each tool on or off. For a single-item slot, choose **None** to clear it.
- In the agents and lorebooks lists on a computer, hold <kbd>Ctrl</kbd> (<kbd>Command</kbd> on macOS) to pick several items. On a phone, use the selection controls. **Clear selection** empties a list.
- On a computer you can open a library sidebar while the editor stays open and drag an item onto its field.
- **Parameters**, **Memory & summary** and **Translation** only show whether the profile holds them. Change them in Chat Settings, then save into the profile.

In the new chat wizard, the **Use a Profile** step also has **New profile…** at the top of the list and **Edit** beside a saved profile. After you save, the wizard selects that profile.

## Save chat settings into a profile

To update a profile from a chat, apply it, change the chat, then use the icon row below the dropdown.

| Button | Label | Result |
| --- | --- | --- |
| Save | **Save current chat settings into this profile** | Replaces the profile's saved values. |
| Rename | **Rename profile** | Changes the name. |
| Import | **Import settings profile (.json)** | Loads a profile file. |
| Export | **Export settings profile (.json)** | Downloads the profile. |
| Delete | **Delete profile** | Removes the profile for good. |

### Update other chats that use the profile

Each chat keeps its own copy of a profile's settings, so saving a profile does not change other chats by itself. When other chats of the same mode use it, the **Other chats use this profile** dialog asks:

- **Save to this profile only** saves the profile and leaves other chats alone.
- **Save and update N other chats** also copies the profile's Chat Settings into those chats. It replaces their own changes to those settings, and a setting you left at its default in the chat you save from goes back to its default in them.

When no other chat uses the profile, **Save** works without asking. Multiplayer rooms are never updated this way.

## Choosing the default profile

The star beside the dropdown marks the profile used automatically for new chats in that mode. Only one profile per mode can be the default. The labels are **Mark this profile as default for new chats in this mode**, **This profile is the default for new chats in this mode** and **Select a profile to mark it as default**. You can also tick **Make this the default** in the builder.

## Import and export a profile

**Export settings profile (.json)** downloads a `.marinara-settings-profile.json` file you can keep as a backup or share. **Import settings profile (.json)** makes a new profile from a compatible file and never overwrites an existing one. Older exports still import. A failed import shows **Import failed**.

Profiles store settings, not provider secrets. An exported or imported profile also leaves out the Discord mirror webhook, the DeepLX address, the DeepL key and the Intiface address. Profiles you save on this install keep them. Exported files leave out the persona and lorebooks, because they exist only on this install.

## The Default profile

Conversation and Roleplay each have a built-in **Default** profile. Applying it restores the profile-controlled settings to Marinara's defaults for that mode. It cannot be renamed, overwritten or deleted. The disabled controls say **Cannot save into the Default profile**, **Cannot rename the Default profile** and **Cannot delete the Default profile**.

## Favorite window layouts

The star beside **Reset View** in the Chat Settings title bar saves a favorite window layout for new chats. The star beside the **Profile** dropdown chooses the default profile instead. See [Choosing a layout for new chats](chat-settings.md#choosing-a-layout-for-new-chats) for the steps.

When a new chat uses a default profile that has a saved layout, that layout takes priority over the favorite layout. A profile without a saved layout keeps the chat's arrangement, including one from a favorite. A profile still applies its own layout tips setting (older profiles without one show the tips) and its own Scoped Regex Scripts mode, or the prompt preset's default when it has none.

## What a profile includes

A profile stores how the chat talks to the model:

- Connection.
- Prompt preset (called the prompt source in Conversation).
- Agents and tools.
- Translation, Memory Recall and Advanced Parameters.
- Window and button layout: positions, sizes, pins, locks, which tools are inside Chat Settings or popped out, open control windows, and button positions on computers and phones. Profiles without a saved layout, such as **Default**, leave the chat's layout as it is.
- Whether the layout tips are hidden. Applying **Default**, or an older profile without this choice, shows the tips again.
- Other reusable chat options.

A profile can also hold **starting picks**: a persona, lorebooks to switch on, and a background.

- Applying the profile copies the picks into the chat. If the profile leaves one empty, the chat keeps its own.
- Other settings in the profile still replace the chat's settings.
- The picks are not linked. A later change in the chat stays in that chat.
- **Save current chat settings into this profile** keeps the profile's own persona, lorebooks and background. A profile without a background takes the chat's background when you save into it.
- Updating other chats never changes their persona, lorebooks or background.

A profile does not replace chat-owned content: characters, sprites, summary, tags and scene prompt. It also holds no conversation history and no running state such as macro variables, the characters you turned off, or a multiplayer room.

### What Save and update copies

**Save and update** copies these into the other chats:

- Generation and context options.
- Group chat options.
- Feature and command switches.
- Agents and their options.
- Memory and summary settings.
- Translation.
- The window layout.

Everything else stays as each chat has it:

- Its connection, prompt preset and custom prompt.
- Its story and characters.
- Its lorebooks and background.
- Its notes and progress.
- Which Roleplay commands only its narrator may use.
- Whether Noodle may use its messages.

Advanced Parameters and image captioning (on or off, and which connection describes images) change only in chats that use the profile's connection, because they are set for that connection. Character schedules change only if they were turned on or off in the chat you save from. Knowledge Retrieval, Knowledge Router, Lorebook Keeper and Expression Engine stay on or off, with their prompt templates, as each chat has them. Each chat picks their sources, lorebook or sprites itself.
