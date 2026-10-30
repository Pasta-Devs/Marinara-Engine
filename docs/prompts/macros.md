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
| `{{21-character-card-ID}}` | Name of another character. Replace the placeholder text with that card's exact 21-character ID to pull the card into context. |
| `{{persona-21-character-card-ID}}` | Name of another persona. Replace the placeholder text after `persona-` with that card's exact 21-character ID to pull the card into context. |
| `{{charNamePhonetic}}` | The character's Phonetic name, or `{{char}}` when it is empty. |
| `{{characters}}` | Every character in the chat, including inactive characters, joined by commas. This macro adds names only; it does not add inactive character cards to the prompt. |
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

To reference a character who is not part of the current chat, copy that card's ID and place it directly inside double braces, such as `{{V1StGXR8_Z5jdHi6B-myT}}`. Do not include literal `<` or `>` characters. Marinara replaces the macro with the character's name. In Roleplay chats that use a prompt preset, it also adds the referenced card's Description, Personality, Appearance, Backstory, Scenario, and Example Dialogue to the system prompt; in other chats the macro only becomes the name. This works in chat messages and prompt fields, and in Roleplay chats with a preset also in activated lorebook entries. The referenced card's initial greetings are excluded. Enabled lorebooks attached to that card remain subject to their normal keyword, constant, filter, probability, and token-budget rules. If the character is already in the chat, the macro still turns into their name, and their card is not added a second time.

To reference a persona other than the active one, prefix its copied ID with `persona-`, such as `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara replaces the macro with the persona's name and adds that card's Description, Personality, Appearance, Backstory, and Scenario to the same ID Macro Cards context. Enabled lorebooks attached to that persona keep their normal activation rules.

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
| `{{reasoning}}` | The reasoning level this reply is generated with: `low`, `medium`, `high`, `xhigh`, or `max`, or `off` when the model is not asked to think. |
| `{{chatId}}` | The current chat's ID. |
| `{{lastGenerationType}}` | A label for why this reply is being generated. |
| `{{idle_duration}}` | How long since the last chat activity, as text like `8 minutes` or `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Game Mode's current **Keyframes per Turn** target, from 1 to 6. It defaults to `3`. |
| `{{agent::TYPE}}` | The saved output of an agent of the given type. |

`{{reasoning}}` names the level the model is actually sent, after your preset, connection, and chat settings are layered. **Maximum** shows as the highest level the model takes, so it can read `max`, `xhigh`, or `high`. Because `off` reads as false, `{{#if reasoning}}` keeps a block only while the model thinks. If your preset or chat already has its own variable named `reasoning`, that variable keeps the name.

The value of `{{lastGenerationType}}` is a plain label. Example values seen in the app include `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, and `retry_agents`. This list can grow, so treat it as examples, not a fixed set.

`{{gameStoryboardKeyframeCount}}` is supplied to Game Mode GM prompts, including the built-in **Storyboard Game Prompt**. It is a narrative target, not a demand for exactly that many paragraphs. The storyboard planner still returns fewer shots when a turn does not contain enough distinct visual moments.

The `{{agent::TYPE}}` macro inserts the saved output of an agent (a background helper that fills in things like a scene tracker). The easiest way to add it is inside the **Preset Editor**: click **Add Section**, open the **Agent Sections** group, and pick an agent. Marinara creates a section that already contains the right `{{agent::TYPE}}` tag. This macro is resolved last, so agent text cannot inject more macros into your prompt.

## Lorebook Outlet macros

`{{outlet::name}}` inserts content from lorebook entries whose **Position** is **Outlet** and whose **Outlet name** exactly matches `name`. Outlet names are case-sensitive. For example, `{{outlet::character_rules}}` does not match an Outlet named `Character_Rules`.

Outlet entries still use normal lorebook activation. Keywords, Constant mode, probability, filters, timing, entry limits, and token budgets decide whether an entry is active for the current generation. Active entries with the same Outlet name are joined in their **Order**, separated by new lines. They are inserted only at the macro; they are not also added at a normal lorebook position.

Use Outlet macros in prompt sections in Conversation, Roleplay, or Game mode. The macro works even when it appears before the preset's lorebook marker, and a preset does not need a lorebook marker when it uses only Outlet entries. An unknown or inactive Outlet resolves to nothing. An Outlet entry cannot expand another Outlet macro, so nested Outlets do not recurse.

## Lorebook size macro

`{{lorebooksize::ID}}` resolves to the total number of entries in the lorebook with the given ID. Replace `ID` with the lorebook's actual ID — copy it from the Lorebooks panel. For example, if a lorebook has the ID `V1StGXR8_Z5jdHi6B-myT` and contains 151 entries, `{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}` resolves to `151`.

Unknown lorebook IDs resolve to `0`. The count includes all entries regardless of whether they are enabled, disabled, or in folders.

Use this macro in prompt sections, character card fields, lorebook entry content, or anywhere else macros are resolved.

## Lorebook include macro

`{{include::ENTRY}}` puts the text of a lorebook entry where you write it. Keep a shared piece of text, such as house rules, in one entry and reuse it in other entries, prompt sections, or cards, so there is only one copy to edit. Replace `ENTRY` with the entry's ID or its name. Names ignore uppercase and lowercase.

- Inside a lorebook entry, a name is looked up in that entry's own lorebook.
- Anywhere else, a name is looked up in the lorebooks this chat uses: the ones added to the chat, the ones linked to its characters and persona, and global ones.
- An ID finds the entry in any lorebook.

`{{include::BOOK::ENTRY}}` takes the entry from the lorebook you name, by its ID or name. That lorebook does not have to be added to the chat or even turned on.

```text
{{include::Rules of the arena}}
{{include::Shared lore::Rules of the arena}}
```

The included entry does not have to activate, and it can be turned off, so you can keep entries that exist only to be included. Macros in the included text work as usual, and it can include other entries too. If an include leads back to an entry it is already inside, such as an entry that includes itself, that include becomes nothing instead of repeating forever. An entry or lorebook that is not found also becomes nothing.

Write names and IDs as plain text. Macros inside them, such as `{{include::{{char}}}}`, are not filled in.

## Time macros

The real-world time macros read one shared moment per resolution, so they always agree with each other. The timezone comes from your browser.

| Macro | Resolves to |
| --- | --- |
| `{{date}}` | The current date, as `YYYY-MM-DD`. |
| `{{time}}` | The current time, as `HH:MM` on a 24-hour clock. |
| `{{datetime}}` / `{{isotime}}` | A full timestamp with the timezone offset. The two names mean the same thing. |
| `{{weekday}}` | The weekday name, such as `Monday`. |
| `{{timezone}}` | The timezone name, such as `Europe/Warsaw`. |
| `{{date.world_state}}` | The current in-world date tracked by World State, kept in its original format. |
| `{{time.world_state}}` | The current in-world time tracked by World State, kept in its original format. |
| `{{weekday.world_state}}` | A custom world field named Weekday or Day of Week, a weekday written in the tracked date, or the weekday of a valid `YYYY-MM-DD` tracked date. |

The `.world_state` macros work in prompts and agent templates. They read the world date and time shown for the current story turn. Switching swipes changes which turn's values they use; regenerating uses the story state that the replacement reply starts from. A missing value becomes empty; it never falls back to today's real-world clock. Fictional calendars keep their own date and time text. For a fictional weekday, add a World State custom field named Weekday or Day of Week.

For example, `{{#if weekday.world_state == "Monday"}}Use the weekday routine.{{/if}}` reads the tracked weekday instead of the real one.

## Random and dice macros

These macros add chance to your prompts. Use the random macro (`{{random}}`) for numbers and choices, and the roll macro (`{{roll}}`) for dice.

| Macro | Behavior |
| --- | --- |
| `{{random}}` | A random whole number from 0 to 100. |
| `{{random:X:Y}}` | A random whole number between X and Y, both included. |
| `{{random::A::B::C}}` | Picks one option at random, then resolves macros only inside the chosen option. |
| `{{random::A@2::B@0.5}}` | A weighted random choice. See the weighting rules below. |
| `{{roll:XdY}}` | A dice roll total. For example, `{{roll:2d6}}` rolls two six-sided dice and adds them. `{{roll:d20}}` rolls one die, and `{{roll:1d8+3}}` adds 3 to the roll. |

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
| `{{addvar::name::value}}` | Adds numbers when both values are numeric; otherwise appends the new text. |
| `{{addnumvar::name::value}}` | Marinara extension: always adds a number to a stored numeric value. Missing or invalid numbers count as 0; an overflowing addition is ignored. |
| `{{incvar::name}}` | Adds 1 to a numeric variable and inserts the new value. |
| `{{decvar::name}}` | Takes 1 away from a numeric variable and inserts the new value. |

Variables resolve from left to right in one prompt build. A value set early, for example in a lorebook entry that comes first, can be read later in the same prompt. Marinara also saves them in the current chat, matching SillyTavern local-variable behavior: later turns and app restarts retain them, while another chat has its own separate values.

Any `{{NAME}}` that is not a built-in macro is looked up by name: first among the preset variables, then among the chat's own variables. If neither has that name, the tag is left in the text exactly as you typed it. A preset variable wins when both use the same name. See [Preset Variables](preset-variables.md) for the preset side.

### Chat variables

You do not have to use `{{setvar}}` to create a variable. The **Chat Variables** section of the **Chat Settings** panel lets you type a name and a value directly, then use the name anywhere macros work, including your own messages. Add `char1` with the value `Mary`, type `{{char1}} walks in.` and the AI reads "Mary walks in."

Rules worth knowing:

- Names use letters, numbers, and underscores, and must start with a letter or underscore. Names with exactly 21 characters are reserved for character references. A name with a dot or a dash can still be set and read with `{{setvar}}` and `{{getvar}}`, but it will not resolve as a bare `{{name}}`.
- A built-in macro name cannot be used. `{{char}}` always means the character.
- Your own message keeps showing the tag you typed. The value is filled in when the prompt is built, so changing a value later also changes the earlier turns that used it.
- The section lists variables set by `{{setvar}}` too, because they share one storage per chat.

See [Chat Settings Overview](../chats/chat-settings.md) for the panel itself.

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

There is no escape character for macros. If you want double braces to stay in the text, use a name that Marinara does not know. Any unknown `{{name}}` is left exactly as typed, as long as no preset variable and no chat variable shares that name. If you need a private note that never reaches the AI, use `{{// like this}}` instead.

## The Macro reference and /macros

Every macro-enabled field has two small buttons in its corner:

- **Expand editor** opens a larger editor window for that field.
- **Macro reference** opens a window titled **Macro reference** that lists every built-in macro by category, each with its exact syntax. This list is generated from the same source the engine uses, so it is always accurate.

These fields also finish macro names for you. Type `{{ch` at the end of a line and the rest, `ar}}`, appears in faint text. Press Tab, or tap the faint text, to accept it. Keep typing to ignore it. For a macro that takes a value, such as `{{getvar::`, it stops where you type the value.

You can also type `/macros` in the chat box (the short form `/macro` works too). It prints the full macro list right in the chat as a quick reminder.

Conditional blocks can combine comparisons with `||` (OR), `&&` (AND), and parentheses. Equality lists may use the compact form `{{#if character == "Maukie" || "Pantalone"}}`. See [Conditional Prompts](conditional-prompts.md) for precedence, group-chat examples, and the full operator list.

A condition can also ask your Decision model about the scene: `{{#if decision:"The latest message moves the scene to a new place"}}` for yes or no, and `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}` to pick one option. With no Decision model, or no answer, these read as no. See [Asking the Decision model](conditional-prompts.md#asking-the-decision-model). Add `sticky:3 cooldown:5` after a statement to keep a yes for three turns and then rest it for five; see [Sticky and cooldown](conditional-prompts.md#sticky-and-cooldown). Add `until:"..."` or `while:"..."` to keep a yes for as long as a second statement allows; see [Until and while](conditional-prompts.md#until-and-while). `every:3` asks a statement only every three turns, and `priority:high` or `priority:low` chooses which statements fit within a prompt plan; see [Checking every few turns](conditional-prompts.md#checking-every-few-turns), [Priority](conditional-prompts.md#priority), and [Limits and cost](conditional-prompts.md#limits-and-cost).

## Common mistakes

- Do not write variables inside a `{{random::...}}` block. A `{{setvar}}` inside a random option runs for every option before the choice is made, not just the chosen one.
- Do not use a local variable as global state. It persists only inside the chat where it was set.
- A prompt section or lorebook entry that runs `{{setvar}}` overwrites a chat variable of the same name, because both use one storage per chat. Give them different names if you want both.
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
