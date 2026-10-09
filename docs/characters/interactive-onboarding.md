# Interactive Onboarding

This guide explains **interactive onboarding**, a character card feature that lets players build their persona by answering the card author's questions when they start a Roleplay chat. It covers how authors set it up in the Character Editor and what players see in the new chat wizard.

## What it does

A persona is the character that represents you in a chat. See [User Personas](personas.md). Normally you write a persona yourself before you play. With interactive onboarding, a character card ships a persona template instead. The template is the five persona fields (**Description**, **Personality**, **Backstory**, **Appearance**, and **Scenario**) with blanks for the player to fill in, plus the questions that fill them.

When a player starts a Roleplay chat with the card, they can choose **Create your persona**, answer the questions, and get a new, ordinary persona. The answers are written into the text once. The result is a normal persona that the player can edit, keep, or delete like any other. The card itself does not change.

Onboarding uses the existing macro syntax. It runs no scripts.

## Setting it up as an author

1. Open the character in the Character Editor. See [Creating and Editing Characters](creating-and-editing-characters.md).
2. Open the **Onboarding** tab, next to **Card**.
3. Turn on **Interactive onboarding**. A short **How onboarding works** guide appears under the switch.

Turning the switch off hides the onboarding fields but keeps what you wrote.

### Add questions

Under **Onboarding Questions**, click **Add Question**. Each question works like a preset variable. See [Presets](../prompts/presets.md). A card can have up to 100 questions.

- **Variable Name** is the name you use in the fields, such as `faction`. Pick any name with letters, numbers, and underscores. Names are case-sensitive: `Gender` and `gender` are different.
- **Question (shown to user)** is what the player reads. It can use earlier answers, such as `What does {{player}} look like?`. Here `{{char}}` is the card's name and `{{user}}` the player's name.
- **Options** turn the question into a choice. The first option is selected by default. With no options, the player types a free-text answer.
- **Value** is what goes into the persona. Upper and lower case are kept as you type them; macros in it are filled in like the rest of the fields. Leave it blank to use the option's label. Type a lowercase value, such as `ranger`, if the answer goes mid-sentence.
- **Help text for players** is optional text shown under the option.
- **Allow own answer** adds a **Write your own** choice next to your options.
- **Multi-Select** lets the player pick several options. They are joined with the separator.

A question named `player` sets the persona's name. If you don't add one, players are asked for their name first.

The editor warns you when a name is empty, invalid, used twice, or taken by a built-in macro, and when no field uses a question.

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

## Creating a persona as a player

1. Start a new Roleplay chat. In the **Persona & Characters** step, cards with onboarding show a small person-with-plus icon in the character list.
2. Add the character. A **Create your persona** row appears at the top of **Your Persona**, naming the card it belongs to.
3. Select that row and click **Next**.
4. A **Create your persona** window shows the card's questions. Follow-up questions appear as soon as your answers make them relevant.
5. Click **Create persona**. The new persona is saved and selected for the chat, and the wizard continues.

If you choose any other persona or **None** (Stay anonymous), no questions are asked. **Back** in the questions window returns to the persona picker. Each card with onboarding in the chat gets its own **Create your persona** row.

Onboarding is offered in the Roleplay new chat wizard. Quick Start, the Conversation setup, and starting a chat straight from a character card do not offer it yet.

## Sharing cards with onboarding

Onboarding is stored with the card. **Marinara Native** and **Compatible PNG Card** exports keep it, so a player who imports the card gets the questions too. **Compatible JSON** export leaves it out. A card imported with more than 100 questions keeps the first 100. See [Importing and Exporting Character Cards](import-export.md).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [User Personas: Creating and Editing](personas.md)
- [Choosing Your Persona in a Chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importing and Exporting Character Cards](import-export.md)
