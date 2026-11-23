# Coming from SillyTavern

Most of what you used in SillyTavern is in Marinara Engine (Marinara from here on), sometimes under another name. Find the word you know in the table, then press **Show me** to open that spot in the app, or the name to read its guide.

You can also type the SillyTavern word into search (**Ctrl+K**, or tap the title on a phone). "chat completion preset", "world info", "regex" and "author's note" all lead to the Marinara feature.

To bring your characters, chats, presets and World Info over, see [Importing from SillyTavern](importing-from-sillytavern.md). Chats keep their message dates, Author's Note and persona, and presets keep their sampler settings.

## Same thing, Marinara name

| In SillyTavern                                                | In Marinara                                                            | Where                                                                                                |                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| Chat Completion presets, AI Response Configuration (samplers) | [Presets](../prompts/presets.md)                                       | Library → **Presets**. Temperature, Top P/K, Min P and the penalties are the preset's **Parameters** | [Show me](#show-presets)          |
| Prompt Manager                                                | [Preset sections](../prompts/presets.md)                               | Library → **Presets**, open a preset → **Sections**                                                  | [Show me](#show-presets)          |
| Saved chat setups, chat defaults                              | [Settings profiles](../chats/settings-profiles.md)                     | Library → **Settings profiles**, or New Roleplay → **Use a Profile**                                 | [Show me](#show-settingsProfiles) |
| World Info, World Book                                        | [Lorebooks](../lorebooks/overview.md)                                  | Library → **Lorebooks**                                                                              | [Show me](#show-lorebooks)        |
| Author's Note                                                 | [Author's Notes](../roleplay/getting-started.md)                       | Chat Settings (Roleplay)                                                                             | [Show me](#show-authorsNotes)     |
| Regex                                                         | [Regex scripts](../extending/regex-scripts.md)                         | Library → **Regex scripts**                                                                          | [Show me](#show-regexScripts)     |
| Group chats                                                   | [Group chats](../chats/group-chats.md)                                 | Add two or more characters to a chat                                                                 | [Show me](#show-groupChats)       |
| Character cards, alternate greetings                          | [Character cards](../characters/import-export.md)                      | Library → **Characters** → **Import**. You pick an alternate greeting when you start a Roleplay chat |                                   |
| Quick Replies, STscript                                       | [Quick replies and slash commands](../chats/guided-and-impersonate.md) | Next to **Send**, or type `/`                                                                        | [Show me](#show-quickReplies)     |
| Extensions (Summarize, Image Generation…)                     | [Agents](../agents/agents-overview.md)                                 | Library → **Agents**, then on per chat                                                               | [Show me](#show-agents)           |
| Summarize, Vector Storage, Data Bank                          | [Memory recall and summaries](../agents/memory.md)                     | Chat Settings → **Memory Recall**                                                                    | [Show me](#show-memory)           |
| API Connections, Connection Profiles                          | [Connections](../connections/connecting-to-a-provider.md)              | Library → **Connections**                                                                            | [Show me](#show-connections)      |
| Prompt Itemization                                            | [Peek prompt](../chats/peek-prompt.md)                                 | The newest AI reply → **Peek prompt**                                                                | [Show me](#show-peekPrompt)       |
| Checkpoints, branches                                         | [Branches](../chats/branches.md)                                       | A message → **Branch from here**                                                                     | [Show me](#show-branches)         |
| Swipes, reroll                                                | [Swipes](../chats/messages.md)                                         | The arrows under a reply, or swipe on a touch screen                                                 | [Show me](#show-swipes)           |
| Persona Management                                            | [Personas](../characters/personas.md)                                  | Library → **Personas**                                                                               | [Show me](#show-personas)         |
| UI Themes, Custom CSS                                         | [Themes and CSS themes](../appearance/custom-css-themes.md)            | Settings → **Appearance**                                                                            | [Show me](#show-themes)           |

**Show me** opens the page or starts the step when it can. For things that live inside a chat (Peek prompt, Memory), open a chat first; otherwise it opens the guide.

## Things that work differently

- **No instruct or context templates.** Marinara sends chat messages, and the model's server applies the model's own template, so there is nothing to pick under SillyTavern's **Advanced Formatting**. A preset's sections take the place of the story string.
- **Samplers.** A preset's settings are the starting values for chats that use it. Values set on the connection or in a chat win. Max response length and context size belong to the connection. Top A and repetition penalty have no setting here.
- **Author's Note.** It goes into the chat at its depth on every reply. With **Post-processing messages** set to **Apply** (the default), it is sent inside the nearby user message. SillyTavern's frequency, position and role settings have no match here. **Peek prompt** marks where it went.
- **Group chats.** In Roleplay, one narrator voices every character by default, which uses fewer tokens. To have each character reply in turn, like SillyTavern, open Chat Settings → **Group Chat** and switch the mode. Groups imported from SillyTavern already use **Individual** mode.
- **Keys.** Enter adds a new line in a chat and **Ctrl+Enter** sends. Turn on **Send on Enter** in Settings → **Chatting** to send with Enter. The arrow keys move between swipes only after you turn on **Intuitive swipe navigation** in the same tab.
- **Quick Replies.** Here they are the one-click actions next to **Send** (impersonate, guided replies). SillyTavern's Quick Reply sets do not import.

- **Three chat modes.** Marinara splits chats into **Conversation** (texting, like DMs), **Roleplay** (long scenes with narration) and **Game** (a game master runs a world with rules). Each new chat asks which one you want, and its setup only shows what that mode uses.
- **Starting a chat.** A new chat opens a short setup. Save a setup you use often as a settings profile, and the next one is a single step: **Use a Profile**, then **Apply & Start**. Star a profile to make it the default for new chats of that mode.
- **Search finds everything.** **Ctrl+K** finds chats, characters, settings and guides, runs commands, and answers questions with Professor Mari's help.
- **Professor Mari.** Marinara's built-in assistant answers questions about the app and can build characters, lorebooks and agents for you. Open her from Home.

## Related guides

- [Importing from SillyTavern](importing-from-sillytavern.md)
- [Settings Profiles](../chats/settings-profiles.md)
- [Chat Settings](../chats/chat-settings.md)
