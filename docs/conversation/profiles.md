# Conversation Mode Profiles (Display Name, About Me, Behavior)

Every character and persona has a small chat-app profile for Conversation Mode: a display name, an "about me" bio and a behavior instruction. These fields are never used in Roleplay or Game Mode.

This is not a settings profile (a saved set of chat options, see [Settings Profiles](../chats/settings-profiles.md)). New to the mode? Read [Conversation Mode: Getting Started](getting-started.md) first. A persona is the character card that stands for you.

## Where these fields live

The fields are on a tab named **Convo**.

1. Open the character in the **Character Editor**, or the persona in the **Persona Editor**. To get there, open the **Characters** panel from the sidebar, or the **Personas** panel from the person icon in the right sidebar top bar, then click the card (see [Creating and Editing Characters](../characters/creating-and-editing-characters.md) and [User Personas](../characters/personas.md)).
2. Click the **Convo** tab.

The tab holds **Convo Display Name**, **About Me** and **Convo Behavior**. On a character it also has **Weekly schedule** (with **Edit schedule** or **Create schedule**, see [schedules](schedules.md)) and **Image generation instructions**, optional directions for that character's selfies (see [Selfies](selfies.md)).

## Set a display name

**Convo Display Name** is the name shown in Conversation chats. Leave it blank to use the card name. Existing messages update right away.

Characters also have **Declare this name on the card in the prompt**. When on, Marinara adds a line like "Conversation display name: X" to the card text in the prompt (the text Marinara sends to the model), so the model knows which card uses which name. It needs a display name first.

## Write an About Me

**About Me** is a short bio: a line or two, an emoji, a joke, or nothing. Marinara adds the **About Me** of every present character and persona to the prompt on each turn, so the model knows how each one presents itself. You do nothing for this.

To fill it in:

- Type it yourself. The emoji button in the toolbar inserts an emoji. **Revert** restores the text from before your current edit.
- On a saved character, click the wand button (**Generate About Me from this card**).
- Ask **Professor Mari** on the Home screen, for example `Write Luna's About Me as a cryptic one-line bio.` She reads the saved profile, writes the bio in that person's voice and saves it. You can keep or restore her change in the usual review flow.

If it did not work: the wand button is missing on a card that is not saved yet. Save the card first.

## Set Convo Behavior

**Convo Behavior** is an instruction for how the character or persona acts in Conversation Mode, for example: keep replies short and lowercase, and text like a real person. Post-history instructions are prompt text placed after the recent chat history. Keep the default if you are not writing custom prompts. Use **Insertion** to choose where the instruction goes in the prompt:

| Option | Where the instruction goes |
| --- | --- |
| **Constant — after the card** (default) | Always, right after the card text. |
| **Constant — before the card** | Always, right before the card text. |
| **Append to post-history** | At the end of the post-history instructions. |
| **Prepend to post-history** | At the start of the post-history instructions. |
| **Replace post-history** | In place of the post-history instructions. |
| **Only where {{convo_behavior}} is placed** | Only where you put the macro in a custom prompt. |

## Chat-specific About Me overrides

The card **About Me** is the default everywhere. You can set a different bio for one chat only.

1. In a Conversation chat, click a character's or persona's avatar or name. A profile card opens beside it (from the bottom on a phone).
2. Read the card. It shows the avatar, the name and the current **About Me**. A badge reads **Default** or **Chat-specific**. Characters also show **Online**, **Away**, **Busy** or **Offline**.
3. Click **Edit**.
4. Type the bio for this chat. An emoji picker with a **Custom emojis** tab is available.
5. Click **Save**. You see "Chat-specific about me saved".

**Cancel** closes edit mode without saving. **Revert** undoes unsaved changes. **Clear** removes an existing override and returns to the card default. Saving an empty bio also clears it.

## Let a character change its own About Me

This is an advanced option. A tool called `update_about_me` lets a character edit its own bio during a chat. It is off by default. To use it, open **Chat Settings → Function Calling**, turn on **Enable Tool Use**, then add the `update_about_me` tool.

The character picks one of two choices:

- Public changes the real bio seen in every chat. You approve it first.
- Chat changes a bio private to the current chat.

## Macros for custom prompts

You do not need macros for profiles to reach the model. Use them only to place a value in an exact spot in a custom prompt. Each is empty outside Conversation Mode. See [Macros](../prompts/macros.md).

| Macro | Value |
| --- | --- |
| `{{convo_display}}` | The responding character's display name. |
| `{{char_about}}` | The character's effective **About Me**. |
| `{{persona_about}}` | The persona's effective **About Me**. |
| `{{convo_behavior}}` | The character's **Convo Behavior**. |

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [User Personas: Creating and Editing](../characters/personas.md)
- [Macros](../prompts/macros.md)
