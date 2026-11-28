# Guided Generation and Impersonate

Two ways to steer a chat. Guided generation points the next reply in a direction without posting a visible message. Impersonate has the model write your own reply. The Quick replies menu puts both next to **Send**.

## Steer a reply with /guided

Your direction is out of character. It shapes the reply but does not appear as a chat message.

1. Type `/guided` and your direction in the message box.
2. Press <kbd>Enter</kbd> or click **Send**.

The model writes its next reply aimed at your direction. For example:

```text
/guided make him admit he is lying
```

You can type `/narrator`, `/narrate` or `/nar` instead of `/guided`. In a group chat, aim the direction at one character with `respond as`, `reply as` or `respond for`:

```text
/guided respond as Alice make her admit she is lying
```

## Guide a regenerate

This reuses the text in your message box as a one-time direction for a regenerate.

1. Open **Settings → Chatting → Editing & Swipes** and turn on **Guide swipes/regens with chat input**. It is off by default.
2. In a chat, type a direction in the message box but do not send it.
3. Click **Regenerate** on the AI message. With text in the box, the button is labeled **Regenerate (guided)**.

Your direction stays in the box afterward, so you can adjust it and regenerate again. To clear it instead, turn off **Keep guidance after regenerating** in **Settings → Chatting → Message Box**.

If it did not work: the button must be labeled **Regenerate (guided)**. If it says only **Regenerate**, the setting is off or the box is empty.

## Read Stored guidance

Marinara saves the direction that shaped a reply.

1. Click the **Stored guidance** icon (a scroll) on the AI message.
2. A window titled **Stored guidance** shows the direction.

The window labels where the direction came from: **/guided**, **Guided regenerate**, or **Game start** (Game Mode setup). For `/guided` and guided-regenerate directions, **Copy /guided** copies a ready-to-use `/guided` command you can paste into another chat.

## Write your reply with Impersonate

Impersonate has the model write your next message in your persona's voice. A persona is the character you play, written as `{{user}}`. See [User Personas](../characters/personas.md).

Before you start: Impersonate works only in Roleplay chats. In Conversation you see "Impersonate is not available in Conversation mode." It is not available in Game either.

1. Type `/impersonate` in the message box. Add a direction after it if you want one.
2. Press <kbd>Enter</kbd> or click **Send**.

The model posts a user message as your persona. For example, this writes a message that asks about the weather:

```text
/impersonate ask about the weather
```

The short alias is `/imp`. **Regenerate** works on a message that Impersonate wrote, so you can get another version.

A posted message counts as your turn, so agents and trackers run on it as they do on a message you type (unless **Skip agents** is on). Choosing a CYOA option with **Use CYOA as direction** on also asks for the character's reply right after. To read and edit the message before any of that happens, have Impersonate write a draft instead.

### Write a draft first

A draft goes into your message box instead of the chat. It is not saved and nothing runs until you send it: no character reply, no agents, no trackers, and no world-state changes.

1. Open **Chat Settings** in a Roleplay chat and find the **Impersonate** section.
2. Set **Result goes to** to **Message draft**. The default is **Post it**.
3. Type `/impersonate` and a direction if you want one, then press <kbd>Enter</kbd>.

The draft streams into your message box. A line above the box says **Writing your next message…** while it writes; click **Stop** there, or the Stop button in the box, to keep what is written so far. When it is done, edit the text and click **Send**. Until you send it, the line above the box offers:

| Button | What it does |
| --- | --- |
| **Redo** | Writes the draft again with the same direction and replaces the one in the box. |
| **Undo** | Throws the draft away and puts back what was in the box before. |

A draft keeps writing if you switch to another chat or tab, and it is in that chat's message box when you come back. Each chat has its own draft.

To choose for one time only, without changing the setting:

| Command | What it does |
| --- | --- |
| `/impersonate_draft` | Writes a draft. Also `/impd` and `/imp_draft`. |
| `/impersonate_post` | Posts the message. Also `/impp` and `/imp_post`. |

With **Quick replies** on, the menu next to **Send** has both as well: **Impersonate** follows the setting and the second action does the other one. A draft can start from an empty box, and the model then picks what you say.

With **Use CYOA as direction** on and **Result goes to** set to **Message draft**, clicking a CYOA option writes a draft that uses the option as its direction. The options stay on screen until you send.

### The Impersonate settings

These settings apply to every `/impersonate` in all your chats, on every window and device. Open **Chat Settings** in a Roleplay chat and find the **Impersonate** section. See [Chat Settings](chat-settings.md) for how to open the panel.

| Control | What it does |
| --- | --- |
| **Result goes to** | **Post it** adds the message to the chat right away. **Message draft** writes it into your message box to edit and send yourself. See [Write a draft first](#write-a-draft-first). Default: **Post it**. |
| **Prompt Template** | An optional instruction sent every time you impersonate. Empty uses the chat's own prompt, or the built-in default. It supports `{{user}}`, `{{persona_description}}` and `{{impersonate_direction}}`, placeholders Marinara replaces with real text. Pick **Built-in default** to read the default, **Copy built-in default to edit** to start a copy, **Save as** to keep a named template, and **Delete template** to remove one. |
| **Preset** | A prompt preset for impersonate replies only. Default: **Use chat default**. See [Presets](../prompts/presets.md). |
| **Connection** | The model for impersonate replies, such as a cheaper or faster one. Default: **Use chat default**. You can also pick **Random**. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md). |
| **Skip agents** | Skips agents (trackers, lorebook routers and similar helpers) during impersonate. This keeps it fast and stops it from changing world state. Off by default. A draft always skips them. See [Agents](../agents/agents-overview.md). |
| **Send Public Faces** | In Roleplay chats, a character with a **Public Face** appears in the impersonate prompt as its name and Public Face alone, so your reply knows only what you could know. That replaces everything else its card sends: Description, Personality, Backstory, Appearance, Scenario, System Prompt, example dialogue, RPG attributes, Post-History Instructions and Depth Prompt. A character with an empty Public Face keeps its full card. Macros you put in an impersonate preset or prompt template, such as `{{description}}`, still send what they name. **Regenerate** keeps the setting the message was written with. Off by default. See [Card tab](../characters/creating-and-editing-characters.md#card-tab). |
| **Use CYOA as direction** | Clicking a CYOA (choose your own adventure) option uses it as the impersonate direction instead of posting it. Off by default. If **Add CYOA choices to the message box instead of sending them** is on in **Settings → Chatting → Message Box**, a click only adds the text to your message box and this setting has no effect. |

### Set a prompt for one chat

1. Type `/impersonate_prompt` and your prompt in quotes.
2. Press <kbd>Enter</kbd>.

```text
/impersonate_prompt "You will now play as my OC:"
```

To go back to the default, type `/impersonate_prompt reset`. The alias is `/imp_prompt`.

## Add Quick replies next to Send

Quick replies add one-click **Send** alternatives, so you do not need to type a slash command.

1. Open **Settings → Chatting → Message Box**.
2. Turn on **Quick replies**. It is off by default.
3. Expand it to pick which actions appear. Once it is on, all three actions are on by default.

| Action | What it does |
| --- | --- |
| **Post only** | Adds your typed message to the chat without a reply. The command `/send <message>` does the same. |
| **Guide reply** | Sends your typed text as a `/guided` direction. |
| **Impersonate** | Generates a persona-side reply, using your typed text as the direction. It follows **Result goes to**, and in Roleplay a second action next to it does the other one (**Impersonate as draft** or **Impersonate and post**). It is hidden in Conversation chats. |

With one action on, its button sits next to **Send**. With more than one, they collapse into a three-dots button (**Quick replies**) that opens a menu.
