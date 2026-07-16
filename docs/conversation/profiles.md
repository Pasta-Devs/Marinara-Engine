# Conversation Mode Profiles (Display Name, About Me, Behavior)

This guide covers the small profile that every character and persona gets in Conversation Mode. The profile has three parts: a display name, an "about me" bio, and a behavior directive. These fields work like a chat-app profile (think Discord). They only apply in Conversation Mode and are never used in Roleplay or Game Mode.

Conversation Mode is the DM or messenger style chat. If you are new to it, read [Conversation Mode: Getting Started](getting-started.md) first. A persona is the profile that stands in for you (the `{{user}}`) in a chat.

## Where these fields live

Every profile field appears on a tab named **Convo**. Both characters and personas have it.

1. To edit a character's profile, open the character in the **Character Editor** and click the **Convo** tab.
2. To edit your persona's profile, open the persona in the **Persona Editor** and click the **Convo** tab.

The **Convo** tab holds three fields: **Convo Display Name**, **About Me**, and **Convo Behavior**. They are the same for characters and personas, with one small difference noted below.

## Convo Display Name

**Convo Display Name** is the name shown for this character or persona in Conversation Mode chats. Leave it blank to use the card name instead. Changing it updates the name on existing messages right away. It only affects Conversation Mode.

Characters (not personas) also have a checkbox: **Declare this name on the card in the prompt**. When you turn it on, Marinara adds a short line to the character's card text. That line tells the model which card is shown under which display name. This checkbox needs a display name to be set first.

The `{{convo_display}}` macro puts the responding character's display name into a custom prompt. A macro is a placeholder like `{{convo_display}}` that gets replaced with real text. It resolves to nothing outside Conversation Mode. See [Macros](../prompts/macros.md).

## About Me

**About Me** is a short self-written bio for the character or persona, shown in Conversation Mode. It can be a line or two, a single emoji, a joke, or nothing at all. An emoji button sits in the text box toolbar so you can drop an emoji into the bio.

The bio is not just decoration. By default, Marinara adds the **About Me** of every present character and persona to the prompt on each turn. The bios go in as a short list of participant profiles. This way, the model always knows how each person presents themselves. You do not need to do anything for this to work.

### Writing an About Me with Professor Mari

You do not have to write the bio yourself. Open Professor Mari from the Home screen and ask her to write or revise the **About Me** for a named character or persona. She reads the saved profile first, writes a short self-authored bio in that person's voice, and saves it directly to the real **About Me** field.

For example, ask: `Write Luna's About Me as a cryptic one-line bio.` You can also ask for a revision, such as making an existing bio funnier, shorter, warmer, or more faithful to the card.

Professor Mari uses her normal configured model. There is no separate About Me connection, source picker, or generation button in the character and persona editors. Her saved change appears in the usual review flow, where you can keep or restore it. Manual edits in the editor still show **Revert**, which restores the text from before your current edit.

## Convo Behavior

**Convo Behavior** is a free-text instruction for how the character or persona should act in Conversation Mode. For example: keep replies short and lowercase, and text like a real person rather than a narrator. It is never sent in Roleplay or Game Mode.

### Insertion (where the directive goes)

Below the **Convo Behavior** box is an **Insertion** dropdown. It controls where your directive is placed in the prompt. The choices are:

- The **Constant** option marked "after the card" (the default): always added, right after the card text.
- The **Constant** option marked "before the card": always added, right before the card text.
- **Append to post-history**: added at the end of the post-history instructions.
- **Prepend to post-history**: added at the start of the post-history instructions.
- **Replace post-history**: used in place of the post-history instructions.
- **Only where `{{convo_behavior}}` is placed**: inserted only where you put the `{{convo_behavior}}` macro in a custom prompt.

Post-history instructions are prompt text that the app places after the recent chat history. If you are not writing custom prompts, keep the default.

## Chat-specific About Me overrides

The **About Me** on the card is the default bio used everywhere. You can also set a different bio for one single chat. This is the chat-specific override, and it opens through a profile popout.

1. In a Conversation Mode chat, click a character's or persona's avatar or name.
2. A small profile card opens next to the avatar. On mobile it slides up from the bottom.
3. The card shows the enlarged avatar, the name, and the current **About Me**.
4. A badge reads **Default** when the card bio is shown, or **Chat-specific** when a per-chat override is in use. Characters also show a status here: **Online**, **Away**, **Busy**, or **Offline**.

To set an override:

1. Click **Edit** in the popout.
2. Type the bio for this chat. You get an emoji picker, including a **Custom emojis** tab.
3. Click **Save**. You should see a note that a chat-specific about me was saved.

While editing, a **Revert** button undoes unsaved changes, and **Cancel** closes edit mode without saving. When an override exists, a **Clear** button removes it and returns to the card default. Saving an empty bio also clears the override. Remember: the default **About Me** is edited on the card, and an override only applies in that one chat.

## Letting a character update its own About Me on demand

There is also a tool a character can call in the moment to change its own bio. It is named **update_about_me**. It is off by default. Turn it on in **Chat Settings** under the **Function Calling** section: turn on **Enable Tool Use** and add the **update_about_me** tool.

When enabled, a character can update its own bio in one of two ways:

- Public scope changes the real bio seen in every chat. This is shown to you for approval first.
- Chat scope changes a bio that is private to the current conversation.

## Using the profiles in custom prompts

You do not need macros for the profiles to reach the model. The **About Me** bios are added to the prompt automatically, and **Convo Behavior** follows its **Insertion** setting. Macros are for custom prompts, when you want to place a value in an exact spot yourself.

Four macros drop these profile values inline. Each resolves to nothing outside Conversation Mode:

- `{{convo_display}}`: the responding character's display name.
- `{{char_about}}`: the character's effective **About Me**.
- `{{persona_about}}`: the persona's effective **About Me**.
- `{{convo_behavior}}`: the character's **Convo Behavior** directive.

See [Macros](../prompts/macros.md) for the full macro list.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [User Personas: Creating and Editing](../characters/personas.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Macros](../prompts/macros.md)
