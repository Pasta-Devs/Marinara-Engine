# Interactive Onboarding

This guide explains **interactive onboarding**, a character card feature that lets players build their persona by answering the card author's questions when they start a Roleplay chat. It covers how authors set it up in the Character Editor and what players see in the new chat wizard.

## What it does

A persona is the character that represents you in a chat. See [User Personas](personas.md). Normally you write a persona yourself before you play. With interactive onboarding, a character card ships a persona template instead. The template is the five persona fields (**Description**, **Personality**, **Backstory**, **Appearance**, and **Scenario**) with blanks for the player to fill in, plus the questions that fill them.

When a player starts a Roleplay chat with the card, they can choose **Create your persona**, answer the questions, and get a new, ordinary persona. The answers are written into the text once. The result is a normal persona that the player can edit, keep, or delete like any other. The card itself does not change.

A card can also ask **character questions**, whose answers are saved on that one chat instead of in a persona. See [Character questions](#character-questions) below.

Onboarding uses the existing macro syntax. It runs no scripts.

## Setting it up as an author

1. Open the character in the Character Editor. See [Creating and Editing Characters](creating-and-editing-characters.md).
2. Open the **Onboarding** tab, next to **Card**.
3. Turn on **Interactive onboarding**. A short **How onboarding works** guide appears under the switch.

Turning the switch off hides the onboarding fields but keeps what you wrote.

### Let Professor Mari write it

You can also ask [Professor Mari](../home/professor-mari.md) to write the onboarding, for example: "Write a fun onboarding for Queen Ayrene, with a template persona." She writes the questions and the persona fields and turns onboarding on. The app checks her work before it is saved, so a misspelled name, a `{{name}}` without a question, or a condition missing its `#` is sent back to her to fix. For a character question, she also adds its `{{name}}` to one of the card's own fields. Her changes show up on a change card you can review or undo, like her other edits.

### Add questions

Under **Persona Questions**, click **Add Question**. Each question works like a preset variable. See [Presets](../prompts/presets.md). A card can have up to 100 questions.

- **Variable Name** is the name you use in the fields, such as `faction`. Pick any name with letters, numbers, and underscores that starts with a letter or underscore. Names are case-sensitive: `Gender` and `gender` are different.
- **Question (shown to user)** is what the player reads. It can use earlier answers, such as `What does {{player}} look like?`. Here `{{char}}` is the card's name and `{{user}}` the player's name.
- **Options** turn the question into a choice. The first option is selected by default. With no options, the player types a free-text answer.
- **Value** is what goes into the persona. Upper and lower case are kept as you type them; macros in it are filled in like the rest of the fields. Leave it blank to use the option's label. Type a lowercase value, such as `ranger`, if the answer goes mid-sentence.
- **Help text for players** is optional text shown under the option.
- **Allow own answer** adds a **Write your own** choice next to your options.
- **Multi-Select** lets the player pick several options. They are joined with the separator.

A question named `player` sets the persona's name. If you don't add one, players are asked for their name first.

The editor warns you when a name is empty, invalid, used twice, or taken by a built-in macro, and when no field uses a question.

### Character questions

Lower down the same tab there is a second list, **Character Questions**. Its questions work exactly like the ones above, but the answers are saved on the **chat**, not in a persona. Put the name in one of the card's own fields: **Description**, **Personality**, **Backstory**, **Appearance**, or **Scenario**.

```
{{char}} treats {{relationshipToUser}} with open warmth.
```

Those five fields are the ones the model reads, so they are the ones a character answer can reach. A greeting can use a character question's `{{name}}` too, and shows the player's answer.

A greeting can also use a persona question's `{{name}}`, such as `Ah, so you are a {{class}}`. It fills in only when the player creates that persona in the new chat wizard, in the first message and its alternate greetings. With an existing persona or Quick Start the tag shows as written, and the Character Editor warns you about that. Click into a greeting and its **Available variables** list both kinds of question, labelled.

The answers are stored as chat variables, so the card reads a different value in every chat and never has to be edited. A card question is asked whenever the card is in the chat, whether or not the player creates a persona. The window shows an **About you** section only when one is being made.

Three things an author should know:

- **An answer that is never filled in stays a literal tag.** A free-text question with no default is not seeded, so a chat started without the wizard shows `{{name}}` as written. Choice questions seed their first option, which covers most cards.
- **If two cards in one chat declare the same name, they share one value.** A chat stores one answer per name, so the last one saved is what both cards read. The window warns about this when it happens.
- **A card that leaves a chat takes its answers with it.** When a character is removed, the chat variables its character questions own are deleted, unless another character still in the chat declares the same name. A shared name stays, because the remaining card may still read it.

### Write the persona fields

Write the five fields like a persona of your own, and put `{{name}}` where an answer belongs:

```
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

When you click into a field, its **Available variables** appear under it. Click one to insert it where your cursor is.

Use `{{#if}}` to show text only for some answers:

```
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

A question that only appears inside an `{{#if}}` is asked only when that condition is true. In the example, `relationToAna` is a follow-up question that appears once the player answers **yes**. Comparisons ignore upper and lower case.

`{{user}}` and `{{char}}` stay as macros in the created persona, so they keep working like in any persona. Other macros, such as `{{random}}`, `{{time}}` or `{{getvar}}`, are filled in once when the persona is created, or left empty if they have no value then.

The **Rendered preview** at the bottom shows the persona built from example answers, and lists the questions asked, in order.

## Answering the questions as a player

1. Start a new Roleplay chat. In the **Persona & Characters** step, cards with onboarding show a small person-with-plus icon in the character list.
2. Add the character. To get a new persona out of it, select the **Create your persona** row at the top of **Your Persona**. It names the card it belongs to. Any other choice (or **None**) skips the persona and keeps yours.
3. Click **Next**. The questions window opens whenever a card in the chat has character questions, whether or not you are creating a persona.
4. Answer the questions. **Character questions** come first, with one section per card, then **About you** when a persona is being made. Follow-up questions appear as soon as your answers make them relevant.
5. Click **Review persona** to see the name and fields your answers produce, exactly as they will be saved. The parts your answers filled in are highlighted. The preview writes nothing; only **Create persona** does.
6. Click **Create persona**, or **Save answers** when you are not making one. The character answers are saved on the chat, and the wizard continues.

Onboarding questions are asked in the Roleplay new chat wizard. Quick Start, the Conversation setup, and starting a chat straight from a character card do not ask them yet. A chat started that way still fills in each question's first option, so `{{relationshipToUser}}` resolves instead of showing the tag. Answering in the wizard replaces that default, for that chat only.

Both paths also work after setup, from **Chat Settings**:

- The **Persona** picker in a Roleplay chat lists **Create your persona** for every card in the chat that offers one. Use it when you skipped the wizard or want a new persona later.
- The onboarding marker next to a character in **Characters** reopens that card's character questions on their own. It opens on the answers the chat already holds, so saving one change leaves the others as they were; saving again also restores an answer you deleted from Chat Variables. Other cards' answers are not touched — except a name two cards share, which is one value, so both cards read the new answer.

Adding a card with character questions to a running Roleplay chat, from **Chat Settings** or by dropping it on the chat, asks its questions first. It then offers its greeting, with your answers filled in and marked.

## Sharing cards with onboarding

Onboarding is stored with the card. **Marinara Native** and **Compatible PNG Card** exports keep it, so a player who imports the card gets the questions too. **Compatible JSON** export leaves it out. A card imported with more than 100 questions keeps the first 100. See [Importing and Exporting Character Cards](import-export.md).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [User Personas: Creating and Editing](personas.md)
- [Choosing Your Persona in a Chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importing and Exporting Character Cards](import-export.md)
