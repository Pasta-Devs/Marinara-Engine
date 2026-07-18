# Chat Settings Overview

This guide covers the **Chat Settings** panel, the place where you tune one chat on its own. It explains the basics you set here: chat name, connection, and saved setting bundles. It then points you to the deeper guides for everything else the panel holds.

Every setting in this panel applies to the current chat only. Changing it does not affect your other chats.

## Opening the Chat Settings panel

You open the panel from inside an open chat.

1. Open any chat.
2. Click the chat settings gear button in the chat toolbar (its tooltip reads **Chat Settings**).
3. The **Chat Settings** panel slides open.

You should see a panel titled **Chat Settings** with a gear icon. When you create a brand new chat, this panel opens automatically so you can set it up right away.

## Chat Name

The **Chat Name** section holds the name shown in your chat list. This name is only visible to you. It is not sent to the AI and does not change the conversation in any way.

1. In the **Chat Name** section, click the current name.
2. The name turns into a text box.
3. Type a new name.
4. Press Enter, or click the checkmark button to confirm.

## Connection

The **Connection** section picks which AI provider and model answers in this chat. A connection is a saved link to an AI provider, including its API key and chosen model. An API key is a secret code that lets Guksu Motor use your account with that provider.

Pick a saved connection from the dropdown. You can also pick **Random**. It chooses a different connection each time from the connections you marked for your random pool.

To learn how to create a connection in the first place, see [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Chat Settings Presets

At the top of the panel is a **Chat Settings Presets** bar. A Chat Settings Preset is a saved bundle of a chat's settings that you can reuse on other chats. Choose a saved preset from the dropdown to apply it to the current chat.

A preset bundles this chat's connection, prompt preset, agents, tools, translation, memory recall, advanced parameters, and other settings. It never touches your characters, persona, lorebooks, sprites, summary, tags, or scene prompt. Those stay tied to the chat itself.

The bar has a row of small icon buttons with no text labels. Each button shows its name in a tooltip when you hover over it:

- The disk icon (**Save current chat settings into this preset**) writes the current chat's settings into the selected preset.
- The pencil icon (**Rename preset**) renames the selected preset.
- The file-plus icon (**Save current chat settings as a new preset**) saves the current chat's settings as a brand new preset.
- The down-arrow icon (**Import preset (.json)**) loads a preset from a `.json` file.
- The up-arrow icon (**Export preset (.json)**) saves the selected preset to a `.json` file.
- The trash icon (**Delete preset**) removes the selected preset.

Next to the dropdown is a star button. Click it to mark a preset as the default for new chats in this mode. When you create a new chat in that mode, Guksu applies the starred preset for you. Only one preset per mode can be the starred default at a time.

Each mode that supports this feature has a built-in **Default** preset. You cannot rename, save into, or delete the **Default** preset. Applying it resets the chat's preset-controlled settings back to the app defaults.

The **Chat Settings Presets** bar does not appear in Game mode.

Chat Settings Presets are a different system from prompt presets. A prompt preset shapes the system prompt structure and generation parameters. A Chat Settings Preset only bundles the settings listed above. For the full rules, see [Chat Settings Presets](../prompts/chat-settings-presets.md).

## Other sections in the panel

The **Chat Settings** panel is also the home for many per-chat features. Each has its own guide:

- **Persona** picks who you play in this chat. It appears in Conversation and Roleplay chats. See [Choosing Your Persona in a Chat](../characters/choosing-your-persona.md).
- **Characters** manages the characters in Conversation and Roleplay chats. For chats with two or more characters, see [Group Chats and Group Conversations](group-chats.md).
- **Party** appears only in Game chats. It replaces the **Persona** and **Characters** sections and combines both in one place.
- **Lorebooks** attaches world info to this chat. See [Lorebooks Overview](../lorebooks/overview.md).
- **Agents** turns on AI helpers for this chat. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).
- **Translation** sets up automatic message translation. See [Message Translation](../integrations/message-translation.md).
- **Advanced Parameters** overrides the generation settings, such as temperature and max tokens, for this chat. See [Generation Parameters](../prompts/generation-parameters.md).

Which sections you see depends on the chat mode. Some sections appear only in Roleplay, Conversation, or Game chats.

## Related guides

- [Managing Your Chat List](managing-chats.md)
- [Choosing Your Persona in a Chat](../characters/choosing-your-persona.md)
- [Lorebooks Overview](../lorebooks/overview.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Chat Settings Presets](../prompts/chat-settings-presets.md)
- [Generation Parameters](../prompts/generation-parameters.md)
