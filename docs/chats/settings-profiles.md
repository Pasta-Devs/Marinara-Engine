# Settings Profiles

A settings profile is a named bundle of reusable chat settings. It can hold a chat's connection, prompt preset, agents, tools, translation, memory recall, advanced parameters, and other per-chat options. Apply the profile to another chat instead of configuring those options again.

You manage profiles at the top of **Chat Settings**. They work in Conversation and Roleplay modes. Game mode does not show the profile controls.

## Settings profiles and prompt presets

Marinara uses **preset** for prompt templates only:

- A **prompt preset** controls the system prompt structure and generation parameters. You edit it in the Presets panel. See [Preset Editor and Prompt Manager](../prompts/presets.md).
- A **settings profile** is the wider reusable configuration. It can include the selected prompt preset along with the connection, agents, and other chat settings.

A prompt preset can therefore be one item inside a settings profile.

## What a profile includes

A profile stores how the chat talks to the AI:

- Connection
- Prompt preset (called the prompt source in Conversation mode)
- Agents and tools
- Translation
- Memory Recall
- Advanced Parameters
- Window and button layout: window positions and sizes, pins and locks, which tools are inside Chat Settings or popped out, open control windows, and button positions on computers and phones. Profiles without a saved layout, such as **Default**, leave the chat's layout as it is.
- Whether the layout tips in Chat Settings are hidden. Applying **Default**, or an older profile without this choice, shows the tips again.
- Other reusable chat options

A profile does not replace chat-owned content such as characters, persona, lorebooks, sprites, summary, tags, or scene prompt. It also does not contain the conversation history.

## Applying a profile

The profile dropdown sits at the top of **Chat Settings**. Its tooltip reads **Apply a settings profile to this chat**.

1. Open the chat you want to change.
2. Open **Chat Settings**.
3. Open the **Profile** dropdown.
4. Choose a profile by name.

The chat updates immediately. When its current values do not match a saved profile, the dropdown shows **Custom settings profile**. If a previously applied profile no longer exists, it shows **Missing profile - choose a profile**.

## Saving a profile

The icon row below the dropdown contains these actions:

| Button | Tooltip | Result |
|---|---|---|
| Save | **Save current chat settings into this profile** | Replaces the selected profile's saved values |
| Rename | **Rename profile** | Changes the selected profile's name |
| Save As | **Save current chat settings as a new profile** | Creates another profile from the current chat |
| Import | **Import settings profile (.json)** | Loads a profile file |
| Export | **Export settings profile (.json)** | Downloads the selected profile |
| Delete | **Delete profile** | Permanently removes the selected profile |

To create your first profile, configure a chat and choose **Save current chat settings as a new profile**. To update it later, apply the profile, change the chat, then choose **Save current chat settings into this profile**.

## Choosing the default profile

The star beside the dropdown marks the profile used automatically for new chats in that mode. Only one profile per mode can be the default.

Its tooltips describe the current state:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Favorite window layouts

The star beside **Reset View** in the Chat Settings title bar saves a favorite window layout for new chats in the current mode. It also remembers whether you hid the layout tips. You can use this star in Conversation, Roleplay and Game. The star beside the **Profile** dropdown still chooses the default settings profile.

Upgrading an existing installation makes the familiar tool-button layout the favorite for new chats in all three modes. This happens once and keeps any favorite you already saved or cleared. The layout stays the default until you change it yourself. A fresh installation starts with the chat tools inside Chat Settings and no favorite layout selected.

Arrange your windows and buttons, then click the title-bar star to save them. The star fills in while the current arrangement and tips match the favorite. If you move a window or change the arrangement, click the star again to replace the favorite. Click the filled star to clear it and use the standard layout for future chats. These changes leave existing chats as they are.

When a new chat uses a default settings profile, that profile's saved layout takes priority over the favorite layout. Profiles without a saved layout keep the chat's arrangement, including one supplied by a favorite. A profile still applies its own layout tips setting; older profiles without that setting show the tips.

See [Choosing a layout for new chats](chat-settings.md#choosing-a-layout-for-new-chats) for the steps.

## Importing and exporting profiles

**Export settings profile (.json)** downloads a `.marinara-settings-profile.json` file that you can keep as a backup or share. **Import settings profile (.json)** creates a new profile from a compatible file without overwriting an existing one. Older profile exports remain importable.

Profiles store settings, not provider secrets.

## The Default profile

Conversation and Roleplay modes each have a built-in **Default** profile. Applying it restores the profile-controlled settings to Marinara's defaults for that mode.

The Default profile cannot be renamed, overwritten, or deleted. The disabled controls explain this with **Cannot save into the Default profile**, **Cannot rename the Default profile**, and **Cannot delete the Default profile**.

## Related guides

- [Chat Settings Overview](chat-settings.md)
- [Preset Editor and Prompt Manager](../prompts/presets.md)
- [Generation Parameters](../prompts/generation-parameters.md)
