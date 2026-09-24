# Conditional Prompts ({{#if}})

This guide explains how to use `{{#if}}` blocks in Marinara Engine. A conditional block lets you include some prompt text only when a value matches a rule you set. Conditionals are part of the macro system, so they work everywhere macros work, including character cards, personas, lorebook entries, and prompt presets.

## What conditional prompts do

A macro is a `{{double-brace}}` placeholder that Marinara Engine replaces with a live value while it builds your prompt. A conditional block goes one step further. It checks a value, then keeps one piece of text and throws the rest away.

You write a condition, some text to use when the condition is true, and (optionally) text to use when it is false. Marinara reads the condition each time it builds a prompt. This means the same card or preset can behave differently for different characters, personas, or chats.

A common use is character-specific instructions inside one shared preset. Another common use is including a field only when it has content, so you do not send an empty label to the model.

## The basic syntax

A conditional block starts with `{{#if condition}}` and ends with `{{/if}}`. Everything between them is the text used when the condition is true.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

You can add an `{{else}}` branch for the false case:

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

You can also chain extra conditions with `{{else if}}`. Marinara checks each branch in order from top to bottom. It keeps the first branch whose condition is true, resolves the macros inside that branch, and discards every other branch. If no condition is true and there is no `{{else}}`, the whole block resolves to nothing.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

You can put a block on several lines, as shown above, or on a single line. You can also nest one conditional inside another branch of a bigger conditional.

## Supported operators

The condition is usually a left value, an operator, and a right value, like `char == "Alice"`. The table below lists every operator you can use. Each operator is shown in code style.

| Operator | Meaning |
| --- | --- |
| `==`, `=`, `is` | Equal. |
| `!=`, `is not` | Not equal. |
| `>` | Greater than (numbers only). |
| `<` | Less than (numbers only). |
| `>=` | Greater than or equal (numbers only). |
| `<=` | Less than or equal (numbers only). |
| `contains`, `includes` | The left value contains the right value as text. |
| `not contains`, `not includes` | The left value does not contain the right value. |

A few rules control how the comparison works:

1. For `==`, `=`, `is`, `!=`, and `is not`, if both sides look like numbers, Marinara compares them as numbers. So `5` equals `5.0`. Otherwise it compares them as text, ignoring uppercase and lowercase. So `Mari` equals `mari`.
2. For `>`, `<`, `>=`, and `<=`, both sides must be numbers. If either side is not a number, the condition is false.
3. For `contains`, `includes`, `not contains`, and `not includes`, the match is case-insensitive. So `contains "dr"` matches the text `Dr Smith`.

## Combining conditions with OR and AND

Use `||` when either condition may match. Use `&&` when every condition must match.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` is evaluated before `||`. Add parentheses when you want to control the order explicitly:

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

For several equality choices on the same value, you may omit the repeated left side after `||`:

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

This shorthand means `character == "Maukie" || character == "Pantalone"`. It applies to the equality operators `==`, `=`, and `is`. Write complete conditions on both sides of `&&`, since one value usually cannot equal two different choices at once.

### Truthy checks (no operator)

If you write a condition with no operator, Marinara does a truthy check. This asks a simple question: does this value have real content in it?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

A truthy check is true when the value is not empty and is not one of these words: `false`, `0`, `no`, `off`, `null`, or `undefined`. The word check ignores case. Use a truthy check when you only want to include text when a field is filled in.

### What you can compare

The left or right side of a condition can be any of these:

1. A field or identity keyword, such as `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, or `model`. These read the same values as the matching macros. `group` lists the other active chat characters after excluding the current responder.
2. A quoted literal, such as `"Alice"`.
3. A preset variable name, such as `length`. A preset variable is a named value you define in a Prompt Preset. See [Preset Variables](preset-variables.md).
4. An explicit variable lookup written as `var:name` or `var.name`.
5. Another macro, whose value is resolved first and then compared.
6. A question for your Decision model, written as `decision:"..."` or `decision_choice:"..."`. See [Asking the Decision model](#asking-the-decision-model).

If you write a bare word that is not a keyword, Marinara treats it as a variable name. If no variable by that name exists, it uses the word as its own plain text. Quoting your literal values avoids this confusion, so quote them when in doubt.

## Quoting rules

When you compare against a fixed piece of text, put it in quotes. This tells Marinara to treat it as an exact literal and not as a keyword or a variable.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

You can use straight double quotes or straight single quotes. Marinara also accepts curly (typographic) quotes, but straight quotes are safest and match every in-app example. Inside a quoted value you can escape a quote with a backslash, and you can write `\n` for a newline.

Always quote a literal that has a space in it, such as `"Dr Smith"`. An unquoted multi-word value is read as one variable name, which is almost never what you want.

## Group blocks for multiple characters

In a group chat with two or more characters, a group block repeats the same text once for each character. This lets you write one block that describes every character in the scene.

To make a group block, put a single `[` on its own line, then your text, then a single `]` on its own line. The block must contain a character macro, such as `{{char}}` or `{{description}}`, or a character-based condition like `{{#if char == "Alice"}}`. Marinara then repeats the block once per character and resolves the character macros against each one in turn.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

In a group chat with Alice and Bob, the block runs twice. The first pass fills in Alice's name and picks her branch. The second pass fills in Bob's name and picks his branch. Outside a group block, a character macro resolves only against the current or primary character.

Group blocks only expand in a chat with two or more characters. In a solo chat, the `[` and `]` lines stay as plain text.

## Worked examples (before and after)

Here are three full examples with the result the model receives.

Character-specific tone inside a shared preset:

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

For a character named `Dottore`, the model receives `Speak in a cold, clinical tone.` For every other character, it receives `Speak warmly and casually.`

Include a field only when it is filled in:

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

If the character has a **Backstory**, the model gets that line with the backstory text. If the **Backstory** field is empty, the whole block resolves to nothing, so no empty label is sent.

Match part of the user name:

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

If your persona name contains `Dr`, the model is told to address you as Doctor. If not, the block resolves to nothing.

## Asking the Decision model

A condition can also ask your **Decision model** about what is happening in the chat. The Decision model is whatever you picked under **Decision model** in the Connections panel: the local model you already run, a hosted Decision connection, or an installed decision model. It reads the last few messages and a statement you write, and says whether the statement is true. It never writes anything into the chat. [Decision Models](../connections/decision-models.md) explains what it is and how to choose one.

This lets a preset, card, lorebook entry or agent prompt send an instruction only on the turns where it applies, instead of sending "if X happens, do Y" on every turn. To decide whether a whole lorebook entry activates, rather than trimming its text, use the entry's [Decision](../lorebooks/entries.md#decision-activation) field instead. Some ideas:

- **Scene changes.** Describe a new location or time skip only when the scene actually moved.
- **Scene types.** Load combat, intimacy or tension pacing rules only while that kind of scene is happening.
- **Answer the question first.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Card moods.** A character card can hold "when flustered" or "when angry" behavior that only appears when the recent messages show it.
- **Pacing guards.** A slow-burn preset can hold back escalation instructions until the relationship has visibly moved on.
- **Group scenes.** In a group block, `{{#if decision:"{{char}} is addressed in the latest message"}}` tells only the addressed character's section to respond directly.

### Yes or no: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

The condition is true when the Decision model says the statement is true. It works with everything else in this guide: `{{else}}`, `{{else if}}`, `&&`, `||`, parentheses, nesting and group blocks.

```
{{#if char == "Dottore" && decision:"{{user}} is lying or hiding something"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

Macros inside the statement are filled in first, so `{{user}}` and `{{char}}` work. In a group block, a statement that names `{{char}}` is asked once for each character.

### One of several answers: `decision_choice:`

`decision_choice:` asks the Decision model to pick one option. The options are the values you compare it with, anywhere in the prompt:

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Here the model chooses between "angry", "sad" and "none of these". The short form works too: `decision_choice:"The weather in the latest message" == "rain" || "snow"` offers both options. Write the statement as a subject, such as "Kaelen's mood in the latest message", and the options as short answers to it.

### Sticky and cooldown

A statement can keep its answer for a few turns instead of being asked every turn. Write `sticky:` and `cooldown:` after the statement:

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** After a yes, the statement stays yes for the next N turns without being asked, so what it gates stays in the prompt.
- **cooldown:N.** Starts when sticky ends, or right after the yes when there is no sticky. For N turns the statement reads as no and is not asked. Then it is asked again.
- A turn is each new message the Decision model reads. A regeneration or a swipe of the same message is the same turn, so rerolling a reply never runs a timer down.
- While sticky or cooldown holds a statement, it is not asked and does not count toward **Decision statements per turn**, so it leaves its slot to another statement.
- For `decision_choice:`, sticky keeps the chosen option, and cooldown reads every comparison as no. A choice of none of the options starts nothing.
- A statement written in several places uses the longest sticky and cooldown given anywhere.
- Peek Prompt shows the held answer and never moves a timer on.

Together, they suit anything that should come in once and then rest: a scene transition, a one-time reminder, or a mood that should last a few turns. For a lorebook entry activated by its **Decision** field, use the entry's own **Sticky** and **Cooldown** instead: a sticky entry stays in without its statement being asked, and an entry on cooldown is not asked about.

### Checking every few turns

Some statements do not need asking every turn. Write `every:` after the statement to ask it only every N turns:

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- It is asked the first turn it is reached, then again 3 turns later, and so on.
- Between checks it reads as no, is not asked, and does not count toward **Decision statements per turn**.
- Turns count the same way as sticky and cooldown, so a regeneration or a swipe reads the same answer.
- Sticky and cooldown still hold a statement's answer; `every:` only decides when a statement they do not hold is asked.
- A statement written in several places uses the smallest `every:` given anywhere.

### Priority

When a turn has more statements than **Decision statements per turn** allows, `priority:` decides which are asked:

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- `priority:high` statements are asked first, and `priority:low` statements last. A statement with no priority is medium.
- Within the same priority, the order the statements appear in the prompt still decides.
- Past the limit, the lowest-priority statements are dropped first: they read as no, and Peek Prompt lists them.
- A statement written in several places uses the highest priority given anywhere.
- The prompt's own statements (preset, cards, persona, author's notes) are planned first. Statements in lorebook entries' text are planned once the scan knows which entries activate, with the slots that are left, so a lorebook statement never takes a slot from the prompt's, whatever its priority.

Every modifier can be combined, in any order: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### No answer means no

A decision condition is **false** whenever there is no answer: no Decision model is set, the model did not answer in time, or it failed. For `decision_choice:`, every comparison is false. So the `{{else}}` branch, or nothing, is what a user without a Decision model gets.

Design for that:

- Use a decision to **add or trim guidance**, never to carry content the story depends on. A missed branch should make a reply slightly less tailored, not break it.
- Give every decision block a sensible default: either nothing, or an `{{else}}` that is fine on any turn.
- Do not chain decisions so that one wrong answer changes several others.
- Do not gate consent, content warnings or safety instructions on a decision. Keep those always present.

Any model will sometimes answer wrongly, and small decision models more often. Nobody needs a particular service to use this: a capable local model is often as good as or better than a small purpose-built decision model. Write for "a Decision model", never "requires Jev".

### Writing statements

These come from tests on a local chat model and on Open-Jev 2B and 9B:

- **State a fact that is either true or false**, like a line in a report. Not a question ("Did the scene change?"), and not an instruction ("If the scene changed, describe it"). A local chat model answered no to an instruction every time, so the block never ran.
- **Say "in the latest message"** when you mean this turn. The model reads several messages, and "Mira asks questions" was answered yes because an earlier message asked one.
- **Name who it is about.** "He is angry" was read as the wrong character.
- **Describe something visible in the text**, an action or something said, not a mood word the model has to interpret ("The scene is intense") or a hidden intention ("Mira is lying").
- Keep it short. A plain "and" or a negation worked fine in the tests, so write whichever reads naturally.

Use **Test** next to **Decision model**, and try the statement on your own chats: the same statement can score differently on different models.

What the tests showed. Each wording was tried on four labelled roleplay turns (two meant as yes, two as no) on Open-Jev 2B, Open-Jev 9B and a Gemma 4 E4B local model. It is a small sample from one scene, so read it as direction, not as a benchmark.

| Write | Avoid | What happened with the wording to avoid |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | The question pushed Open-Jev 2B's "no" turns over its threshold. The local model was unaffected. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | All three called a heated argument "intense". With a vague word, the model decides what it means, not you. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | The local model and Open-Jev 9B said yes when Mira's latest message asked nothing, because an earlier one did. |
| Kaelen is angry in the latest message. | He is angry. | The local model read "he" as the angry barkeep. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | No model reliably called a contradiction a lie. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | The local model answered no to the instruction every time, so the block never ran. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | Handled correctly. Splitting is still easier to reuse and debug. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | No difference. Write whichever reads naturally. |

The recommended wordings scored 31 of 32 on Open-Jev 2B, 31 of 32 on Open-Jev 9B and 32 of 32 on the local model. The wordings to avoid scored 26, 25 and 24.

### Limits and cost

- **Statements per turn.** At most the number set under **Decision model** as **Decision statements per turn** (32 by default) are asked each turn. Only statements the turn can actually use count toward it:
  - statements in enabled preset sections and groups, not disabled ones;
  - statements in the preset variable options the chat has selected, not the others;
  - statements in lorebook entries that activate this turn, not the rest of the lorebook;
  - statements in blocks that something fixed for the turn has not already ruled out. In `{{#if char == "Dottore" && decision:"..."}}`, the statement is not asked while the character is Mira. A variable can change while the prompt is built, so a condition on a variable never rules a statement out.

  A statement that [sticky, cooldown](#sticky-and-cooldown) or [`every:`](#checking-every-few-turns) holds does not count at all. Past the limit, the [lowest-priority](#priority) statements read as no, a warning is logged, and Peek Prompt lists them. On a hosted Decision connection each statement adds to a billed request; on a local model it only adds time.
- **Time.** The same budgets as activation questions apply: the Decision connection's **Time limit** (1.5 seconds by default), and 4 seconds for a local model. A model that has to reason first holds off in front of the reply unless you turned on **Also gate agents that run before the reply**.
- **Once per turn.** Answers are kept for the turn, so a regeneration or a swipe sends the same branches. The Decision model is only asked again when a new message arrives, or when you edit the newest message and regenerate. The one exception is post-processing agents, below: they read the finished reply, so their statements are asked once per reply.
- **Prompt caching.** A provider's cache reuses the prompt only up to the first thing that changed since the last request; everything from there on is billed again at full price. A branch that changes from turn to turn is such a change, so where it sits decides how much stays cached. Put decision blocks late in the prompt, such as post-history instructions or author's notes, rather than at the top.

  On a direct Anthropic connection with **Enable prompt caching** on, Marinara caches two points: the end of the system prompt (the preset text before the chat history), and the chat message **Cache depth** messages back from the newest one (5 by default). So a decision block:

  - **above the chat history** changes the system prompt, and the whole prompt is billed as new, plus the cost of writing the cache again;
  - **inside the last Cache depth messages**, such as post-history instructions or an author's note at a shallower depth, costs no cached tokens;
  - **in between**, such as an injection at depth 10 with the default Cache depth, keeps the system prompt cached but loses the cached history.

  **If you make presets, be very careful and very purposeful with decision blocks near the top of a preset.** Every turn a block there changes its answer, the system prompt changes with it, and a caching provider bills the whole prompt as new. Keep decision blocks in post-history instructions or a shallow author's note where you can. Put one near the top only when its answer rarely changes and what it adds belongs there. The same goes for decision blocks inside preset variable options, since a variable's value lands wherever its `{{name}}` sits.

  Providers also have a minimum below which nothing is cached, for example 512 tokens on Claude Opus 5.5, 1,024 on Claude Sonnet 5 and on OpenAI's GPT-5.6, and 4,096 on Claude Haiku 4.5. Almost any preset is longer than that, so in practice where the first change sits matters far more.
- **Agents.** In an agent's prompt, decisions for agents that run before or with the reply read the same turn as the prompt. For post-processing agents they read the finished reply as the latest message, so they are asked after the reply, and again when a regenerated swipe changes it. Re-running an agent, for example with a tracker's refresh button or by retrying a failed agent, reuses the answers its turn already has. See [Decision statements in the agent's prompt](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).
- **Choices on a local model.** A local chat model answers a `decision_choice:` as one yes/no per option, so each option counts as a statement's worth of time.

### When a decision branch never appears

If a user reports that a decision branch never shows up, the likely causes, in order, are:

1. **No Decision model is set.** Every decision condition is false on every turn. The editor shows a warning under any field that uses one.
2. **The Decision model is not answering.** A hosted connection with a bad key, no credits or a rate limit; a local model that is stopped or too slow for the budget; or an installed decision model that did not start.
3. **It is a reasoning model** that holds off in front of the reply.
4. **Too many statements in one turn**, past the per-turn limit.
5. **It answers, but below its threshold.** Usually the wording, or a model that rates that turn lower than you expect.

Ask the user which Decision model they selected and what **Test** reports. **Peek Prompt** shows the branches that were actually sent. When it has to build a fresh preview, it lists any decision statements that have no answer yet, which read as no there. With the log level set to debug, each statement, its answer and whether it read as yes are logged; see [Logging levels](../CONFIGURATION.md#logging-levels).

The fix is rarely in the preset. When it is, it is usually the wording, or a branch that carries something the prompt cannot do without.

## Related guides

- [Decision Models](../connections/decision-models.md)
- [Prompt Macros](macros.md)
- [Preset Variables](preset-variables.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
