---
name: Interactive onboarding
description: Writing, editing, reviewing or debugging a character's interactive onboarding: the persona template, persona questions, character questions, and conditions.
---
# Interactive onboarding

Purpose: build or change a character's **interactive onboarding** — the persona template and
questions a player answers when a Roleplay chat with this card starts. The answers become the
player's persona, so the card ships a person instead of requiring one.

Actions: `character.onboarding.get` and `character.onboarding.update` (one card at a time), plus
`character.update` for the card text a character question feeds.
User-facing reference: `docs_read docs/characters/interactive-onboarding.md`.

## The shape

- **Template fields** — `description`, `personality`, `backstory`, `appearance`, `scenario`. They
  read exactly like a persona's fields, written about the player, with `{{question}}` where an
  answer goes. `scenario` is where the card's premise meets this player.
- **Persona questions** — `variables[]`. Every answer lands in the template and the result is an
  ordinary persona the player can keep, edit, or delete.
- **Character questions** — `cardVariables[]`. Every answer is saved as a chat variable, and the
  card's **own** description, personality, backstory, appearance or scenario read it. Same chat,
  different value once the card is edited: nobody has to fork the card per player.
- `enabled` — set `true` whenever you write a block. A card with the switch off keeps its fields
  but never asks.

The template never changes the card. A character question changes how the character treats this
player, so its `{{name}}` belongs in the card's own field, not in the onboarding template.

## Workflow

1. **Read both halves.** `character.get` for the card's own five fields (what a character question
   can reach), then `character.onboarding.get` for `onboarding`, `errors`, `warnings` and
   `samplePersona`. If `onboarding` is `null`, `note` says whether the card has none or carries a
   block the editor cannot read (a full replacement fixes the second case).
2. **Decide the question set before writing anything.** Ask only what changes the experience:
   who the player is, where they stand with the character, one or two scene-level choices. Three
   to six questions is a good card; a questionnaire is not. Skip a question whose answer would
   only decorate the template.
3. **Write the five template fields** as a persona about the player, using each answer's
   `{{variableName}}` where it belongs. Leave a field empty if it adds nothing.
4. **Check the graph before you write:**
   - every question is used by a template field (or by another question's option value) —
     otherwise it is never asked;
   - every `{{name}}` in the fields has a question, spelled exactly (names are case-sensitive);
   - names are unique across **both** lists (they are answered in one window);
   - names are letters, digits and `_`, starting with a letter or `_`, and are not built-in macro
     names (`{{user}}`, `{{char}}`, `{{random}}`, … stay macros);
   - `player` is special only in the persona list: it names the created persona.
5. **Character questions first, the card second.** In the SAME response, `character.update` the
   card field that reads the character answer (`apply: true`, as its own command), then
   `character.onboarding.update` the block. Checked the other way round, the update reports every
   such question as unused, because the card text it is checked against does not carry the
   `{{name}}` yet.
6. **Write with `apply: true`** and a one-sentence `reason` that says what the player gets ("Players
   build their newcomer with a few questions when a chat starts"). The result is a change card the
   user reviews; the template itself is not applied to any existing chat.
7. **Verify by reading back.** `character.onboarding.get` must return no `errors` and no
   `warnings`, and a `samplePersona` that reads like a person. Fix and resend until it does.

## Updating an existing block

The update **merges**: top-level keys you send replace, keys you omit stay, and a `variables` or
`cardVariables` list you send replaces that **whole list**. So to change one question, read the
block, edit that question, and send the complete list. To switch onboarding off, send
`{ "enabled": false }` — that keeps everything else. To start over, send a full block.

## Question and option fields

```json
{ "variableName": "origin", "question": "Where do you come from?",
  "options": ["Northern", "Southern"], "allowCustom": true }
```

- No `options` → free text. A free text **character** question with no answer leaves a raw
  `{{name}}` in the card, so give character questions options.
- Options are labels, or `{ "label": "…", "value": "…", "description": "…" }`. The first option is
  the default. `value` is the exact text that lands in the sentence, so give a mid-sentence answer
  a lowercase value with no article of its own: template `a {{origin}}`, value `human city`.
- `allowCustom: true` adds the player's own answer. `multiSelect: true` allows several,
  joined by `separator`. `displayMode` and `optionSort` shape the picker.
- A question also accepts `name` as an alias for `variableName`; options get ids and a missing
  `value` defaults to the label, so neither needs writing by hand.
- Each list holds at most 100 questions.

## Conditions

`{{#if name == value}}…{{else}}…{{/if}}` — with the `#`. A question used only inside a condition
is asked only while that condition is true, which is how follow-ups stay out of the way. The
comparison ignores case. `{{else if …}}` has no `#` and is correct as written. `{{if …}}` without
the `#` is not a condition: it reaches the persona verbatim, and the server rejects it.

## Worked example

Queen Ayrene's court: a newcomer persona built from three persona questions and one character
question. The card edit comes first, then the block — both from the same response.

```
{"say":"Her court could use a newcomer. I'll add the questions and let the card react to what you are to her.","commands":[{"name":"app_data","arguments":{"action":"character.update","characterId":"ayrene-id","patch":{"scenario":"...the existing scenario, plus: Ayrene treats {{user}} as her {{bond}}."},"reason":"Lets each chat decide what the player is to Ayrene","apply":true}},{"name":"app_data","arguments":{"action":"character.onboarding.update","characterId":"ayrene-id","onboarding":{"enabled":true,"description":"{{player}}, a {{origin}} newcomer to Queen Ayrene's court.{{#if origin == Northern}} Raised in the ice ports, unafraid of storms.{{/if}}","personality":"{{temper}}","variables":[{"variableName":"player","question":"What is your name?"},{"variableName":"origin","question":"Where do you come from?","options":["Northern","Southern"]},{"variableName":"temper","question":"How do you carry yourself at court?","options":["Bold and blunt","Careful and courteous"],"allowCustom":true}],"cardVariables":[{"variableName":"bond","question":"What are you to Ayrene?","options":["sworn knight","rival claimant"],"allowCustom":true}]},"reason":"Players build their newcomer with a few questions when a chat starts","apply":true}}],"stop":false}
```

After it: `character.onboarding.get` shows no errors, no warnings, and a sample persona that reads
`[player], a Northern newcomer to Queen Ayrene's court. Raised in the ice ports, unafraid of storms.`

## What the server refuses, and how to fix it

The update throws with **every** problem at once, in this wording — fix them all and resend.

| Message says | Fix |
| --- | --- |
| `Unknown onboarding key(s): …` | You sent a key that is not `enabled`, `description`, `personality`, `backstory`, `appearance`, `scenario`, `variables`, `cardVariables`. Typos are rejected, not ignored. |
| `… has unknown key(s): …` | A question or option key is misspelled (for example `allowcustom`). Question keys: `variableName` (`name`), `question`, `options`, `allowCustom`, `multiSelect`, `separator`, `displayMode`, `optionSort`. Option keys: `label`, `value`, `description`. |
| `A question has no variableName` | Fill it in. |
| `"X" is not a valid variableName` | Use letters, digits and `_`, starting with a letter or `_`. No spaces or hyphens. |
| `"X" is a built-in macro name` | Pick another name; the built-in would never be answered. |
| `More than one question is named "X"` | Names must be unique across both lists. |
| `An option value uses {{X}}, but no question has that name` | Add the question, or drop the `{{X}}` from the option value. |
| `The <field> field has {{if …}}` | Add the `#`: `{{#if name == value}}`. |
| `The <field> field uses {{X}}, but no question has that name` | Names are case-sensitive. Fix the tag or add the question. |
| `… has more than 100 questions` | Split the intent; 100 is the ceiling per list. |

Warnings do not block the save, but they mean a question does nothing:

- `Question "X" isn't used in any of the five template fields, so players won't be asked it.` → put
  `{{X}}` in a template field.
- `Character question "X" isn't used in the card's description, personality, backstory, appearance
  or scenario, so it is skipped.` → `character.update` the card field to read `{{X}}`, then send the
  block again.

## Common mistakes

- Writing the block before patching the card, so every character question comes back unused.
- Giving a character question no options: a chat started without an answer shows `{{name}}` raw.
- Explaining the feature in the reply instead of writing it; the user asked for onboarding, so
  inspect, write, verify, then report the shape in one or two sentences.
- Rewriting the whole block to change one question when the merge only needs that list resent.
- Treating `samplePersona` as the real persona: it is built from each first option to show where
  answers land.
- Using the template to change the card. Card text is `character.update`; the template only
  becomes a persona.
