---
name: Interactive onboarding
description: Read before writing, editing, reviewing or debugging a character's interactive onboarding: its persona template and questions.
---

# Interactive onboarding

Purpose: build or change a character's **interactive onboarding** — the persona template and
questions a player answers when a Roleplay chat with this card starts. The answers become the
player's persona.

Actions: `character.onboarding.get` and `character.onboarding.update` (one card at a time), plus
`character.update` for the card text a character question feeds.
User-facing reference: `docs_read docs/characters/interactive-onboarding.md`.

## The shape

- **Template fields** — `description`, `personality`, `backstory`, `appearance`, `scenario`. They
  read exactly like a persona's fields, written about the player, with `{{variableName}}` where an
  answer goes. `scenario` is where the card's premise meets this player.
- **Persona questions** — `variables[]`. Every answer lands in the template and the result is an
  ordinary persona the player can keep, edit, or delete.
- **Character questions** — `cardVariables[]`. Every answer is saved as a chat variable, and the
  card's **own** description, personality, backstory, appearance or scenario read it. One card, a
  different value in each chat: nobody edits or forks the card per player.
- `enabled` — set `true` whenever you write a block. A card with the switch off keeps its fields
  but never asks.

`{{user}}` and `{{char}}` are not answers: they stay macros in the created persona, so you may use
them in the fields exactly as a persona would.

The template never changes the card. A character question changes how the character treats this
player, so its `{{name}}` belongs in the card's own field, not in the onboarding template.

## Review-only requests

Reads only: report `errors`, `warnings` and `samplePersona`, and write nothing. A question that never
shows is switched off (`enabled: false`), unread (the warning below), or inside a condition that is
false for those answers — say which.

## Workflow

1. **Read both halves, then the lore.** `character.get` for the card's own five fields (what a
   character question can reach) and its `lorebooks` — the books linked to the card plus the one it
   owns, each marked `attached: "linked"` or `"owned"` — then `character.onboarding.get` for
   `onboarding`, `errors`, `warnings` and `samplePersona`. If `onboarding` is `null`, `note` says
   whether the card has none or carries a block the editor cannot read (a full replacement fixes the
   second case). Done when you can name every card field a character question can reach.

   Then the lore. When `lorebooks` is not empty, or the user names a book, read `lorebook.entries`
   with that `lorebookId` and open an entry with `lorebook.getEntry` only when its content decides a
   question. Use the books the card carries or the user named, not the rest of the library: a
   question about where the player is from can name the setting's real places and factions instead
   of a generic "where are you from?".

2. **Decide the question set before writing anything.** Ask only what changes the experience:
   who the player is, where they stand with the character, one or two scene-level choices. As many
   as the card needs — usually three to six, and none on the persona side if the card only asks
   character questions. Skip a question whose answer would only decorate the template.
3. **Write the five template fields** as a persona about the player, using each answer's
   `{{variableName}}` where it belongs. Leave a field empty if it adds nothing.
4. **Check the two lists against their own readers before you write:**
   - a persona question is asked only while a template field reads its `{{name}}` (or another
     question's option value does), and a character question only while one of the card's own five
     fields reads it; anything unread is skipped with a warning;
   - every `{{variableName}}` in a template field must match a persona question exactly
     (case-sensitive). The validator only checks the template side, so the card side is yours: a
     `{{name}}` in a card field with no character question is not reported;
   - names are unique across **both** lists (they are answered in one window);
   - names are letters, digits and `_`, starting with a letter or `_`, and are not built-in macro
     names (`{{user}}`, `{{char}}`, `{{random}}`, … stay macros);
   - `player` is special only in the persona list: it names the created persona.
5. **Patch the card first, then write the block.** When the block has character questions, in the
   SAME response `character.update` the card field that reads each one (`apply: true`, as its own
   command), then `character.onboarding.update`. A patch replaces the whole field you send, so
   include the card's existing text with the `{{name}}` spliced into it — never send only the new
   sentence. Checked the other way round, the update reports every such question as unused,
   because the card text it is checked against does not carry the `{{name}}` yet. With no
   character questions, skip the card patch.
   When the output limit is small (your workspace rules say so, or a reply was cut at it), send the card patch and the block in separate replies, the patch first, and the block
   only once the patch has applied (its `readBack`, or the user's Accept when it is held). The block
   itself cannot go in parts, since each question list you send replaces the whole list: keep it short.
6. **Write with `apply: true`** and a one-sentence `reason` that says what the player gets ("Players
   build their newcomer with a few questions when a chat starts"). The result is a change card the
   user reviews; the template itself is not applied to any existing chat. Report the shape in one or
   two sentences afterward — never explain the feature instead of writing it.
7. **Verify by reading back.** `character.onboarding.get` must return no `errors`, no `warnings`,
   and a `samplePersona` with no question `{{…}}` left in it (`{{user}}`, `{{char}}` and the other built-in macros stay, as allowed above; never strip them to clean the sample) — a `[name]` from a free-text persona question
   is expected; any `{{tag}}` there is a tag the persona will carry. If the block writes persona
   fields, the sample must also read like a person. A block with only character questions has an
   empty sample, which is correct: check instead that each `{{name}}` sits in a card field. Fix and
   resend until it passes.

## Updating an existing block

The update **merges**: top-level keys you send replace, keys you omit stay, and a `variables` or
`cardVariables` list you send replaces that **whole list**. So to change one question, read the
block, edit that question, and send the complete list. To switch onboarding off, send
`{ "enabled": false }` — that keeps everything else. To start over, send a full block.

## Question and option fields

```json
{
  "variableName": "origin",
  "question": "Where do you come from?",
  "options": ["Northern", "Southern"],
  "allowCustom": true
}
```

- No `options` → free text. A free text **character** question with no answer leaves a raw
  `{{name}}` in the card, so give character questions options.
- Options are labels, or `{ "label": "…", "value": "…", "description": "…" }`. The first option is
  the default. `value` is the exact text that lands in the sentence, so give a mid-sentence answer
  a lowercase value with no article of its own: template `a {{origin}}`, value `human city`.
- `allowCustom: true` adds the player's own answer. `multiSelect: true` allows several,
  joined by `separator`. `displayMode` is `auto`, `buttons` or `listbox`; `optionSort` is `manual`
  or `alphabetical`. Leave both unset unless the user asks.
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
question. Two `app_data` argument objects, the card edit first, both in the same response — send them
as two calls; the runtime decides whether that is a native tool call or a textual tag.

```
{"action":"character.update","characterId":"ayrene-id","patch":{"scenario":"...the existing scenario, plus: Ayrene treats {{user}} as her {{bond}}."},"reason":"Lets each chat decide what the player is to Ayrene","apply":true}
{"action":"character.onboarding.update","characterId":"ayrene-id","onboarding":{"enabled":true,"description":"{{player}}, a {{origin}} newcomer to Queen Ayrene's court.{{#if origin == Northern}} Raised in the ice ports, unafraid of storms.{{/if}}","personality":"{{temper}}","variables":[{"variableName":"player","question":"What is your name?"},{"variableName":"origin","question":"Where do you come from?","options":["Northern","Southern"]},{"variableName":"temper","question":"How do you carry yourself at court?","options":["Bold and blunt","Careful and courteous"],"allowCustom":true}],"cardVariables":[{"variableName":"bond","question":"What are you to Ayrene?","options":["sworn knight","rival claimant"],"allowCustom":true}]},"reason":"Players build their newcomer with a few questions when a chat starts","apply":true}
```

After it: `character.onboarding.get` shows no errors, no warnings, and a `samplePersona` with no
`{{…}}` left: `[player], a Northern newcomer to Queen Ayrene's court. Raised in the ice ports,
unafraid of storms.`

## What the server refuses, and how to fix it

The update reports every problem in the first failing group — unknown keys first, then the JSON
shape, then the 100-question cap, then the name and condition rules. Fix that group and resend; the
next send can reveal the next group.

| Message says                                                  | Fix                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Onboarding not saved, the block doesn't match the shape:`    | A value has the wrong JSON type: `enabled`, `allowCustom` and `multiSelect` are booleans; `variables`, `cardVariables` and `options` are arrays; the five fields are strings.                                                                            |
| `Unknown onboarding key(s): …`                                | You sent a key that is not `enabled`, `description`, `personality`, `backstory`, `appearance`, `scenario`, `variables`, `cardVariables`. Typos are rejected, not ignored.                                                                                |
| `The block is nested one level too deep`                      | The error follows `Unknown onboarding key(s): onboarding` (or `patch`, `data`). Send the fields (`enabled`, `variables`, …) directly as the `onboarding` argument, not inside another object.                                                            |
| `… has unknown key(s): …`                                     | A question or option key is misspelled (for example `allowcustom`). Question keys: `variableName` (`name`), `question`, `options`, `allowCustom`, `multiSelect`, `separator`, `displayMode`, `optionSort`. Option keys: `label`, `value`, `description`. |
| `A question has no variableName`                              | Fill it in.                                                                                                                                                                                                                                              |
| `"X" is not a valid variableName`                             | Use letters, digits and `_`, starting with a letter or `_`. No spaces or hyphens.                                                                                                                                                                        |
| `"X" is a built-in macro name`                                | Pick another name; the built-in would never be answered.                                                                                                                                                                                                 |
| `More than one question is named "X"`                         | Names must be unique across both lists.                                                                                                                                                                                                                  |
| `An option value uses {{X}}, but no question has that name`   | Add the question, or drop the `{{X}}` from the option value.                                                                                                                                                                                             |
| `The <field> field has {{if …}}`                              | Add the `#`: `{{#if name == value}}`.                                                                                                                                                                                                                    |
| `The <field> field uses {{X}}, but no question has that name` | Names are case-sensitive. Fix the tag or add the question.                                                                                                                                                                                               |
| `… has more than 100 questions`                               | Split the intent; 100 is the ceiling per list.                                                                                                                                                                                                           |
| `character.onboarding.update needs an onboarding object.`     | Send the block as the `onboarding` argument.                                                                                                                                                                                                             |

Warnings do not block the save, but they mean a question does nothing:

- `Question "X" isn't used in any of the five template fields, so players won't be asked it.` → put
  `{{X}}` in a template field.
- `Character question "X" isn't used in the card's description, personality, backstory, appearance
or scenario, so it is skipped.` → `character.update` the card field to read `{{X}}`, then send the
  block again.
