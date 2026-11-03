# Interactive Onboarding

You only need this if you make cards for other people to play. Interactive onboarding lets a character card ask the player questions when they start a Roleplay chat, then builds a persona from the answers. Authors set it up in the Character Editor. Players answer in the new chat wizard.

## What it does

A persona is the character card that stands for you in a chat. See [Personas](personas.md). Normally you write one yourself before you play. With onboarding, the card ships a persona template instead: the five persona fields (**Description**, **Personality**, **Backstory**, **Appearance** and **Scenario**) with blanks for the player, plus the questions that fill them.

When a player starts a Roleplay chat with the card, they can choose **Create your persona**, answer the questions and get a new, ordinary persona. The answers are written into the text once. The player can edit, keep or delete the persona like any other. The card does not change.

A card can also ask character questions, whose answers are saved on that one chat instead of in a persona. See [Character questions](#character-questions). Onboarding uses the existing macro syntax and runs no scripts.

## Setting it up as an author

1. Open the character in the Character Editor. See [Creating and Editing Characters](creating-and-editing-characters.md).
2. Open the **Onboarding** tab, next to **Card**.
3. Turn on **Interactive onboarding**. A short **How onboarding works** guide appears under the switch.

Turning the switch off hides the onboarding fields but keeps what you wrote.

### Let Professor Mari write it

Ask [Professor Mari](../home/professor-mari.md), for example: "Write a fun onboarding for Queen Ayrene, with a template persona." She writes the questions and the persona fields and turns onboarding on. The app checks her work before it saves. A misspelled name, a `{{name}}` without a question, or a condition missing its `#` is sent back to her to fix. For a character question she also adds its `{{name}}` to one of the card's own fields. Her changes show on a change card you can review or undo.

### Add persona questions

Under **Persona Questions**, click **Add Question**. Each question works like a preset variable, a named blank that an answer fills in. See [Presets](../prompts/presets.md). A card can have up to 100 questions.

| Field | What it does |
| --- | --- |
| **Variable Name** | The name you use in the fields, such as `faction`. Use letters, numbers and underscores, starting with a letter or underscore. Names are case-sensitive: `Gender` and `gender` differ. |
| **Question (shown to user)** | What the player reads. It can use earlier answers, such as `What does {{player}} look like?`. `{{char}}` is the card's name and `{{user}}` the player's name. |
| **Options** | Turn the question into a choice. The first option is selected by default. With no options, the player types a free-text answer. |
| **Value** | What goes into the persona. Upper and lower case are kept as you type them, and macros in it are filled in. Leave it blank to use the option's label. Use a lowercase value such as `ranger` if the answer goes mid-sentence. |
| **Help text for players** | Optional text under the option. |
| **Allow own answer** | Adds a **Write your own** choice next to your options. |
| **Multi-Select** | Lets the player pick several options, joined with the separator. |

A question named `player` sets the persona's name. Without one, players are asked for their name first. The editor warns you when a name is empty, invalid, used twice or taken by a built-in macro, and when no field uses a question.

### Write the persona fields

Write the five fields like a persona of your own, and put `{{name}}` where an answer belongs. Click into a field to see its **Available variables**, and click one to insert it at your cursor.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Use `{{#if}}` to show text only for some answers:

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

A question that appears only inside an `{{#if}}` is asked only when the condition is true. Here, `relationToAna` is a follow-up that appears once the player answers **yes**. Comparisons ignore upper and lower case.

`{{user}}` and `{{char}}` stay as macros in the created persona. Other macros (placeholders that Marinara fills in, such as `{{random}}` for a random number or `{{time}}` for the time) are filled in once when the persona is created, or left empty if they have no value then.

The **Rendered preview** at the bottom shows the persona built from example answers and lists the questions asked, in order.

### Character questions

The same tab has a second list, **Character Questions**. They work like persona questions, but the answers are saved on the chat, not in a persona. Put the name in one of the card's own fields (**Description**, **Personality**, **Backstory**, **Appearance** or **Scenario**), because those are the fields the model reads.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

A greeting can use a character question's `{{name}}` and shows the player's answer. A greeting can also use a persona question's `{{name}}`, such as `Ah, so you are a {{class}}`, but it fills in only when the player creates that persona in the new chat wizard, in the first message and its alternate greetings. With an existing persona or Quick Start, the tag shows as written, and the Character Editor warns you. Click into a greeting and its **Available variables** list both kinds, labelled.

The answers are stored as chat variables, so the card reads a different value in every chat and never needs editing. A character question is asked whenever the card is in the chat, whether or not the player creates a persona. The window shows **About you** only when a persona is being made.

Three things to know:

- **An answer that is never filled in stays a literal tag.** A free-text question with no default is not seeded, so a chat started without the wizard shows `{{name}}` as written. Choice questions seed their first option, which covers most cards.
- **Two cards in one chat that declare the same name share one value.** The last answer saved is what both read. The window warns you.
- **A card that leaves a chat takes its answers with it.** When a character is removed, the chat variables its character questions own are deleted, unless another character in the chat declares the same name.

## Answer the questions as a player

1. Start a new Roleplay chat. In the **Persona & Characters** step, cards with onboarding show a small person-with-plus icon in the character list.
2. Add the character. To get a new persona, select **Create your persona** at the top of **Your Persona**. It names the card it belongs to. Any other choice, including **None**, skips the persona.
3. Click **Next**. The questions window opens whenever a card in the chat has character questions, whether or not you are creating a persona.
4. Answer the questions. Character questions come first, one section per card, then **About you** when a persona is being made. Follow-up questions appear as your answers make them relevant.
5. Click **Review persona** to see the name and fields your answers produce. The parts your answers filled in are highlighted. The preview saves nothing.
6. Click **Create persona**, or **Save answers** when you are not making one. The character answers are saved on the chat, and the wizard continues.

If it did not work: if the persona was created but not picked, choose it under **Your Persona**. If answers could not be saved, the chat uses each card's own default text instead.

Onboarding questions are asked in the Roleplay new chat wizard. Quick Start, the Conversation setup and starting a chat straight from a character card do not ask them yet. A chat started that way fills in each question's first option, so `{{relationshipToUser}}` resolves instead of showing the tag. Answering in the wizard replaces that default for that chat only.

You can also answer after setup, from **Chat Settings**:

- The **Persona** picker in a Roleplay chat lists **Create your persona** for every card in the chat that offers one. Use it when you skipped the wizard or want a new persona later. See [Choosing Your Persona in a Chat](choosing-your-persona.md).
- The onboarding marker next to a character in **Characters** reopens that card's character questions on their own. It opens on the answers the chat already holds, so saving one change leaves the others as they were. Saving also restores an answer you deleted from **Chat Variables**. Other cards' answers are not touched, except a name two cards share, which is one value, so both cards read the new answer.

Adding a card with character questions to a running Roleplay chat, from **Chat Settings** or by dropping it on the chat, asks its questions first. It then offers its greeting with your answers filled in and marked.

## Sharing cards with onboarding

Onboarding is stored with the card. **Marinara Native** and **Compatible PNG Card** exports keep it, so a player who imports the card gets the questions too. **Compatible JSON** leaves it out. A card imported with more than 100 questions keeps the first 100. See [Importing and Exporting Character Cards](import-export.md).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Choosing Your Persona in a Chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importing and Exporting Character Cards](import-export.md)
