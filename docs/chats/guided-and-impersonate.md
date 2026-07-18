# Guided Generation and Impersonate

This guide covers two ways to steer a chat in Guksu Motor. Guided generation points the AI in a direction without posting a visible message. Impersonate has the AI write your own reply for you. It also covers the Quick replies menu that puts both actions next to the Send button.

## Guided generation

Guided generation lets you tell the AI where to take the next reply. Your instruction is out of character. It steers the reply but does not appear as a normal chat message.

### Steering a reply with /guided

The main way to guide a reply is the `/guided` slash command.

1. Type `/guided` followed by your direction in the message box.
2. Press Enter or click Send.
3. The AI generates its next reply, aimed in the direction you gave.

For example, this direction pushes the next reply toward a confession:

```
/guided make him admit he is lying
```

The command has short aliases. You can type `/narrator`, `/narrate`, or `/nar` instead of `/guided`.

In a group chat you can aim the direction at one character. Type `/guided respond for <character> <direction>`. Replace `<character>` with the character name and `<direction>` with your instruction. For example:

```
/guided respond for Alice make her admit she is lying
```

### Guided regenerate

You can also guide a reply while you regenerate it. This reuses whatever text you have typed in the message box as a one-time direction.

1. Open **Settings**, then **Advanced**, then **Message Tools**.
2. Turn on **Guide swipes/regens with chat input**. This setting is off by default.
3. Go back to a chat and type a direction in the message box, but do not send it.
4. Click **Regenerate** on the AI message.

When the setting is on and you have text in the box, the **Regenerate** button changes its tooltip to **Regenerate (guided)**. The AI makes a new version of the reply using your typed text as the direction.

### Reading Stored guidance

When a reply was made with a direction, Guksu saves that direction so you can see it later. A **Stored guidance** action (a scroll icon) appears on the message.

1. Click the **Stored guidance** icon on the AI message.
2. A window titled **Stored guidance** opens and shows the direction that produced the reply.

The window labels the direction by where it came from:

- **/guided**: the direction came from the `/guided` command.
- **Guided regenerate**: the direction came from a guided **Regenerate** click.
- **Game start**: the direction came from Game Mode setup.

For `/guided` and guided-regenerate directions, a **Copy /guided** button copies the direction back out as a ready-to-use `/guided` command. You can paste it into another chat to reuse the same steer.

## Impersonate

Impersonate has the AI write your next message for you, in the voice of your persona. Your persona is the character you play, written into the chat as `{{user}}`. See [User Personas](../characters/personas.md) for how to set one up.

Impersonate works only in Roleplay chats. It is not available in Conversation or Game chats. If you try it in a Conversation chat, you see the message "Impersonate is not available in Conversation mode."

### Using /impersonate

1. Type `/impersonate` in the message box. You can add an optional direction after it.
2. Press Enter or click Send.
3. The AI writes a user message as your persona and posts it in the chat.

For example, this makes the AI write a message in your voice that asks about the weather:

```
/impersonate ask about the weather
```

The command has a short alias. You can type `/imp` instead of `/impersonate`.

You can redo a message that Impersonate wrote. The **Regenerate** action works on user messages that were created by Impersonate, so you can get a different version.

### The Impersonate settings

Impersonate has a settings section that applies to every `/impersonate` you run, across all your chats. You open it from the per-chat settings.

1. Open the **Chat Settings** panel for a Roleplay chat.
2. Find the **Impersonate** section.

The section has these controls:

- **Prompt Template**: an optional instruction sent to the model every time you impersonate. Leave it empty to use the chat's own prompt, or the built-in default when the chat has none. It supports the macros `{{user}}`, `{{persona_description}}`, and `{{impersonate_direction}}`. A macro is a placeholder that Guksu replaces with real text before sending. Click **Built-in default** to read the default text. A **Reset** button clears a custom template back to empty.
- **Preset**: use a specific prompt preset for impersonate replies only. A preset is a saved bundle of prompt settings. See [Presets](../prompts/presets.md). The default is **Use chat default**. Presets apply in Roleplay only.
- **Connection**: route impersonate replies to a specific connection, such as a cheaper or faster model. A connection is a saved link to an AI provider. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md). The default is **Use chat default**. You can also choose **Random**.
- **Skip agents**: when on, Guksu skips the agent pipeline (trackers, lorebook routers, and similar helpers) during impersonate. This keeps impersonate fast and stops it from changing world state. It is off by default. See [Agents](../agents/agents-overview.md).
- **Use CYOA as direction**: when on, clicking a CYOA option uses it as the impersonate direction instead of posting it as a normal message. CYOA means choose your own adventure, a set of clickable choices some chats show after a reply. This setting is off by default.

### Setting a custom impersonate prompt

You can also set an impersonate prompt for one chat only, using a slash command.

1. Type `/impersonate_prompt` followed by your prompt in quotes.
2. Press Enter.

For example:

```
/impersonate_prompt "You will now play as my OC:"
```

To clear the per-chat prompt and go back to the default, type:

```
/impersonate_prompt reset
```

The command has a short alias, `/imp_prompt`.

## The Quick replies menu

The Quick replies menu adds extra send actions next to the normal Send button. It gives you one-click access to guided generation and Impersonate without typing a slash command.

You choose which actions show from settings.

1. Open **Settings**, then **Advanced**, then **Message Tools**.
2. Turn on **Quick replies**. It is off by default.
3. Expand it to pick which actions appear. Once the menu is enabled, the three actions are on by default.

The three actions are:

- **Post only**: add your typed message to the chat without triggering an AI reply.
- **Guide reply**: send your typed text as a `/guided` direction instead of a normal message.
- **Impersonate**: generate a reply as your persona, using your typed text as the direction. This action is hidden in Conversation chats, because Impersonate does not work there.

When only one action is on, its button shows directly next to Send. When more than one is on, they collapse into a small menu. Click the three-dots button (labeled **Quick replies**) to open it.

## Related guides

- [Message Actions: Edit, Delete, Swipe, Regenerate](messages.md)
- [Peek Prompt: See What the AI Received](peek-prompt.md)
- [User Personas: Creating and Editing](../characters/personas.md)
- [Presets](../prompts/presets.md)
