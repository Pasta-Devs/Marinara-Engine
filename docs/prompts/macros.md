# Prompt Macros

This guide explains prompt macros in Marinara Engine. A macro is a short `{{tag}}` that Marinara replaces with a live value. The value is filled in when a prompt is built, such as your name or the current date. You will learn every built-in macro, where you can type them, and the mistakes to avoid.

## What macros are and where they work

A macro is literal text wrapped in double braces, like `{{user}}` or `{{char}}`. When Marinara builds the text it sends to the AI, it scans for these tags and swaps each one for its current value. There is no switch to turn macros on. Any field that supports them always resolves them.

Macro names are not case sensitive for built-in tags. So `{{user}}` and `{{USER}}` both work.

You can type macros in many places across the app:

- Character fields in the **Character Editor**: Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions, and the **Depth Prompt**.
- Persona fields in the **Persona Editor** (the same card fields).
- Lorebook entry Description and Content fields.
- Prompt preset sections in the **Preset Editor**.
- Regex script Find, Replace, and Trim fields.
- Agent prompt templates.
- The chat message box. Type `{{roll:1d20}}` in a message and it resolves before the message is sent.

A macro value can contain another macro, and Marinara resolves that one too.

## Before you start

You do not need to set anything up. The built-in macros work right away, with no API key and no extra connection. An API key is the secret code that lets Marinara talk to an AI provider, but macros run inside Marinara on their own.

Two macro features do depend on other parts of the app:

- Preset variables (the `{{NAME}}` catch-all) need a prompt preset that defines them. See [Preset Variables](preset-variables.md).
- The agent macro `{{agent::TYPE}}` only shows text once the matching agent has run and produced output.

## Identity, character, and persona macros

These macros pull in the names and card fields of the person speaking and the character replying. The user is you (or your active persona). The character is the bot that is answering.

| Macro | Resolves to |
| --- | --- |
| `{{user}}` / `{{userName}}` | Your current display name (or persona name). Defaults to `User` when no persona is set. |
| `{{userNamePhonetic}}` | Your persona's Phonetic name, or `{{user}}` when it is empty. |
| `{{char}}` / `{{charName}}` | The current character's name. Defaults to `Character`. |
| `{{charNamePhonetic}}` | The character's Phonetic name, or `{{char}}` when it is empty. |
| `{{characters}}` | Every character in the chat, joined by commas. |
| `{{group}}` | Every other active character in the group chat, excluding the current responder. The persona is not part of this character roster. |
| `{{persona}}` | Your persona's Description, Personality, Backstory, Appearance, and Scenario, joined by new lines. |
| `{{personaDescription}}` | Your persona's Description field. |
| `{{personaPersonality}}` | Your persona's Personality field. |
| `{{personaBackstory}}` | Your persona's Backstory field. |
| `{{personaAppearance}}` | Your persona's Appearance field. |
| `{{personaScenario}}` | Your persona's Scenario field. |

The character field macros read the current character's card:

| Macro | Character card field |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

In a chat with one character, these resolve against that character. In a group chat, they resolve against the first character by default. To repeat text for each character, put it inside a bracketed group block. See [Conditional Prompts](conditional-prompts.md) for group blocks.

`{{group}}` follows the character currently responding, including during individual group generations. For example, if Pantalone is responding in a Roleplay group containing Powers That Be, Maukie, and Pantalone, `{{group}}` resolves to `Powers That Be, Maukie`. A character card remains in this roster even if its name happens to match `{{user}}`.

The Phonetic name field has two jobs. It sets how the name is pronounced by text-to-speech. It also feeds `{{charNamePhonetic}}` and `{{userNamePhonetic}}`. You will find it in both the **Character Editor** and the **Persona Editor**.

## Conversation mode macros

These four macros only work in Conversation Mode. In every other mode they always resolve to nothing, even when the same card or preset text is shared across modes.

| Macro | Resolves to |
| --- | --- |
| `{{convo_display}}` | The character's **Convo Display Name**, or the card name when it is empty. |
| `{{char_about}}` | The character's current **About Me** (the per-chat override if set, else the card default). |
| `{{persona_about}}` | Your persona's current About Me. |
| `{{convo_behavior}}` | The character's **Convo Behavior** text, but only when its insertion setting is set to place it at this macro. |

You edit these fields on the **Convo** tab of the **Character Editor** and the **Persona Editor**. For the full setup, see [Conversation Mode Profiles](../conversation/profiles.md).

## Conversation placement macros

Conversation Mode automatically inserts several blocks into the prompt for you. These macros let a preset **move** a block to wherever you place the macro. When you use one, Marinara renders that block at the macro and **skips** its automatic insertion, so the content is never duplicated. Each macro has one or more aliases; every alias behaves the same.

| Macro (and aliases) | Places |
| --- | --- |
| `{{context}}`, `{{status}}` | The conversation context / status block. |
| `{{commands}}`, `{{commandList}}` | The available-commands reminder. |
| `{{reactRules}}`, `{{emojiReact}}` | The custom-emoji **reaction** rules. |
| `{{replyRules}}` | The custom-emoji and sticker **reply** rules. |
| `{{memories}}`, `{{memoryRecall}}` | The memory-recall block. |
| `{{lorebook}}`, `{{lore}}` | Lorebook injections. |

These only apply in Conversation Mode. In a one-character conversation, placing the participant bios yourself with `{{char_about}}` / `{{persona_about}}` (see above) works the same way: Marinara then skips its automatic participant "about me" block so the bios are not inserted twice. Group conversations keep the automatic participant block because either singular macro covers only one participant and must not hide everyone else's bio.

## Context macros

These macros describe the current chat and the current request.

| Macro | Resolves to |
| --- | --- |
| `{{input}}` | The most recent user message available to the prompt. |
| `{{model}}` | The current model name, when one is selected. |
| `{{chatId}}` | The current chat's ID. |
| `{{lastGenerationType}}` | A label for why this reply is being generated. |
| `{{idle_duration}}` | How long since the last chat activity, as text like `8 minutes` or `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Game Mode's current **Keyframes per Turn** target, from 1 to 6. It defaults to `3`. |
| `{{agent::TYPE}}` | The saved output of an agent of the given type. |

The value of `{{lastGenerationType}}` is a plain label. Example values seen in the app include `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, and `retry_agents`. This list can grow, so treat it as examples, not a fixed set.

`{{gameStoryboardKeyframeCount}}` is supplied to Game Mode GM prompts, including the built-in **Storyboard Game Prompt**. It is a narrative target, not a demand for exactly that many paragraphs. The storyboard planner still returns fewer shots when a turn does not contain enough distinct visual moments.

The `{{agent::TYPE}}` macro inserts the saved output of an agent (a background helper that fills in things like a scene tracker). The easiest way to add it is inside the **Preset Editor**: click **Add Section**, open the **Agent Sections** group, and pick an agent. Marinara creates a section that already contains the right `{{agent::TYPE}}` tag. This macro is resolved last, so agent text cannot inject more macros into your prompt.

## Time macros

All time macros read one shared moment per resolution, so they always agree with each other. The timezone comes from your browser.

| Macro | Resolves to |
| --- | --- |
| `{{date}}` | The current date, as `YYYY-MM-DD`. |
| `{{time}}` | The current time, as `HH:MM` on a 24-hour clock. |
| `{{datetime}}` / `{{isotime}}` | A full timestamp with the timezone offset. The two names mean the same thing. |
| `{{weekday}}` | The weekday name, such as `Monday`. |
| `{{timezone}}` | The timezone name, such as `Europe/Warsaw`. |

## Random and dice macros

These macros add chance to your prompts. Use the random macro (`{{random}}`) for numbers and choices, and the roll macro (`{{roll}}`) for dice.

| Macro | Behavior |
| --- | --- |
| `{{random}}` | A random whole number from 0 to 100. |
| `{{random:X:Y}}` | A random whole number between X and Y, both included. |
| `{{random::A::B::C}}` | Picks one option at random, then resolves macros only inside the chosen option. |
| `{{random::A@2::B@0.5}}` | A weighted random choice. See the weighting rules below. |
| `{{roll:XdY}}` | A dice roll total. For example, `{{roll:2d6}}` rolls two six-sided dice and adds them. |

Here is a simple random choice you can copy:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Weighted choices

Add a final `@number` to an option to set how likely it is. The number is a relative weight. Larger means more likely.

```text
{{random::Common event@1::Rare event@0.25}}
```

In that example the total weight is 1.25, so the chances are:

| Option | Weight | Chance |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

Weighting rules:

- A missing weight counts as 1.
- Decimal weights are allowed, such as 0.5 or 0.01.
- A weight of 0 keeps the option but it can never be picked.
- If every option has weight 0, the macro resolves to nothing.
- Only a final `@number` counts as a weight. An `@` elsewhere, like in an email address, is left alone.

## Dynamic variables

Variables let one part of your prompt store a value and let a later part read it.

| Macro | Behavior |
| --- | --- |
| `{{setvar::name::value}}` | Stores a value and leaves nothing in the text. |
| `{{getvar::name}}` | Reads a stored value (nothing if it was never set). |
| `{{addvar::name::value}}` | Adds text to the end of a stored value. |
| `{{incvar::name}}` | Adds 1 to a numeric variable. |
| `{{decvar::name}}` | Takes 1 away from a numeric variable. |

Variables resolve from left to right in one prompt build. A value set early, for example in a lorebook entry that comes first, can be read later in the same prompt.

Important scope limit: these variables only live for a single reply. Marinara does not save them anywhere. When the next reply is generated, every variable starts empty again. Do not expect `{{setvar}}` to remember a value across turns.

Any `{{NAME}}` that is not a built-in macro is treated as a preset variable and looked up by name. If no variable with that name exists, the tag is left in the text exactly as you typed it. See [Preset Variables](preset-variables.md) for how to define these.

## Formatting macros

These macros shape the text around them.

| Macro | Behavior |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Inserts a line break. |
| `{{trim}}` | Removes itself and trims whitespace around that spot. |
| `{{trimStart}}` | Trims whitespace at the start of the surrounding text. |
| `{{trimEnd}}` | Trims whitespace at the end of the surrounding text. |
| `{{uppercase}}...{{/uppercase}}` | Makes the wrapped text UPPERCASE. |
| `{{lowercase}}...{{/lowercase}}` | Makes the wrapped text lowercase. |
| `{{noop}}` | Removed from the output. Useful as a harmless placeholder while you edit. |
| `{{// comment}}` | An author note that is removed from the output. |
| `{{banned "text"}}` | Removed from the output. It does not filter or block anything. |

## Showing literal double braces

There is no escape character for macros. If you want double braces to stay in the text, use a name that Marinara does not know. Any unknown `{{name}}` is left exactly as typed, as long as no preset variable shares that name. If you need a private note that never reaches the AI, use `{{// like this}}` instead.

## The Macro reference and /macros

Every macro-enabled field has two small buttons in its corner:

- **Expand editor** opens a larger editor window for that field.
- **Macro reference** opens a window titled **Macro reference** that lists every built-in macro by category, each with its exact syntax. This list is generated from the same source the engine uses, so it is always accurate.

You can also type `/macros` in the chat box (the short form `/macro` works too). It prints the full macro list right in the chat as a quick reminder.

Conditional blocks can combine comparisons with `||` (OR), `&&` (AND), and parentheses. Equality lists may use the compact form `{{#if character == "Maukie" || "Pantalone"}}`. See [Conditional Prompts](conditional-prompts.md) for precedence, group-chat examples, and the full operator list.

## Common mistakes

- Do not write variables inside a `{{random::...}}` block. A `{{setvar}}` inside a random option runs for every option before the choice is made, not just the chosen one.
- Do not expect variables to persist. Values set with `{{setvar}}` reset on the next reply.
- `{{prompt}}` is not a macro. If your whole message is `{{prompt}}`, Marinara opens the **Peek Prompt** viewer instead of sending it. See [Peek Prompt](../chats/peek-prompt.md).
- Custom Tools do not use `{{macro}}` text. Do not paste `{{roll:1d20}}` into a tool field expecting it to resolve.
- The **Impersonate** prompt template accepts only a few placeholders, not the full macro list. Its names differ too, so a macro that works in a card may not work there.
- Very large or deeply nested macro output is cut off silently. There is no error, so keep macro expansions reasonable.

## Related guides

- [Conditional Prompts](conditional-prompts.md)
- [Preset Variables](preset-variables.md)
- [Preset Editor and Prompt Manager](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Conversation Mode Profiles](../conversation/profiles.md)
