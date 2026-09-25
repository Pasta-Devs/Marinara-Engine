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
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
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
- Changing the number takes effect at once: the next check counts from the turn it was last asked.
- Between checks it reads as no, is not asked, and does not count toward **Decision statements per turn**.
- Turns count the same way as sticky and cooldown, so a regeneration or a swipe does not advance the schedule. Whether it reuses an answer follows the [answer-cache rules](#answer-reuse).
- Sticky and cooldown still hold a statement's answer; `every:` only decides when a statement they do not hold is asked.
- A statement written in several places uses the smallest `every:` given anywhere.

### Priority

When a prompt plan has more statements than its allowance under **Decision statements per turn**, `priority:` decides which are asked. The allowance applies in [several stages](#statement-allowance):

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

Any model can answer wrongly. Write for "a Decision model", never "requires Jev": a local chat model can answer these statements too. The syntax is shared, but answers and accuracy can differ between models.

### Writing statements

These come from tests on a local chat model and on Open-Jev 2B and 9B:

- **State a fact that is either true or false**, like a line in a report. Not a question ("Did the scene change?"), and not an instruction ("If the scene changed, describe it"). A local chat model answered no to an instruction every time, so the block never ran.
- **Say "in the latest message"** when you mean this turn. The model reads several messages, and "Mira asks questions" was answered yes because an earlier message asked one.
- **Name who it is about.** "He is angry" was read as the wrong character.
- **Describe something visible in the text**, an action or something said, not a mood word the model has to interpret ("The scene is intense") or a hidden intention ("Mira is lying").
- Keep it short. A plain "and" or a negation worked fine in the tests, so write whichever reads naturally.

To test your wording:

1. Select a model under **Decision model** and click **Test**. This checks the connection with a fixed sample; it does not test your statement or read your current chat.
2. Add the statement to your prompt and send representative chat messages: some where it should be true, and some where it should be false.
3. Use **Peek Prompt** to inspect the branch that was sent. If you need the statement's probability and yes/no result, enable [debug logging](../CONFIGURATION.md#logging-levels).
4. Adjust the wording and test again. Use new messages or change the statement when testing a new case: successful answers can be [reused](#answer-reuse). Opening a fresh Peek Prompt preview does not ask the model.

What the tests showed. Each wording was tried on four labelled roleplay turns (two meant as yes, two as no) on Open-Jev 2B, Open-Jev 9B and a Gemma 4 E4B local model. It is a small sample from one scene, not a general accuracy benchmark or a test of hosted Jev. The table records observations from that sample; it does not promise the same result for another model or chat.

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

The recommended wordings scored 31 of 32 on Open-Jev 2B, 31 of 32 on Open-Jev 9B and 32 of 32 on the local model. The wordings to avoid scored 26, 25 and 24. These small-sample results illustrate wording choices; use your own cases to judge which model suits your chats.

### Limits and cost

#### Statement allowance

**Decision statements per turn**, under **Decision model**, defaults to 32. Despite its name, it is not one global cap on every Decision request or on spending. Marinara applies it in stages:

1. Statements for the main chat prompt are planned within the allowance. Lorebook decisions then use what that plan leaves available.
2. For agents that run before or alongside the reply, Marinara makes a combined plan of the main prompt's statements and those agents' prompt statements, using the configured allowance again. This stage does not subtract the lorebook's earlier use, so the total can exceed the setting.
3. Post-processing agents get a separate allowance after the reply. Their statements read the completed reply.

Agent **activation questions** and **Smart response order** are separate from this setting.

Only statements the current stage can use enter its plan: enabled preset sections and groups, selected variable options, and content from activated lorebook entries. A fixed condition can rule a statement out: `{{#if char == "Dottore" && decision:"..."}}` is not asked while the character is Mira. Variables can change during prompt building, so a variable condition does not rule a statement out in advance.

A statement held by [sticky, cooldown](#sticky-and-cooldown) or [`every:`](#checking-every-few-turns) takes no slot. [Priority](#priority) chooses which statements fit within a prompt plan. Lorebook activation draws on its remaining allowance as entries are considered. Statements left out read as no, and Peek Prompt lists them.

#### Requests and time

One turn can make several billed requests on a hosted Decision connection. Statements can be batched, but lorebook activation, newly activated entry content, recursive matches and agent phases can require more batches. Activation questions batch by Scan Depth and phase; Smart order makes its own request. The statement allowance is not a request-count or currency limit.

A local chat model adds processing time instead of hosted charges. It answers a `decision_choice:` with one yes/no question per option, so a single choice can require several completions.

Each request has a [time limit](../connections/decision-models.md#time-limits): 1.5 seconds by default for a Decision connection, or the local backend's budget. Several requests can add up to a longer wait. A local model that must reason first holds off before the reply unless you turn on **Also gate agents that run before the reply**.

#### Answer reuse

Successful answers are normally reused for the same turn and Decision model, so regenerating often sends the same branches without another request. This cache lives in the running server and holds up to 200 turn keys. A restart or cache eviction can cause another request. A new or edited latest message, a different model, a changed statement or a changed choice's option set can also need a new answer.

Missing or failed answers are not cached as successful no answers: retrying the same turn can ask again and take a different branch. Sticky/cooldown timing is separate from this answer cache.

Agent prompt statements follow the same reuse rules. Before/parallel agents read the pre-reply turn; post-processing agents read the completed reply, so a changed swipe can need new answers. A manual agent re-run reuses successful answers still cached for its inputs. See [Decision statements in the agent's prompt](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

#### Prompt caching

The provider's **prompt cache** is separate from Marinara's Decision answer cache. It can reuse an unchanged prefix of the prompt sent to your chat model. Changing a decision branch can prevent reuse from that part onward; an earlier unchanged prefix may still qualify. The exact reusable portion and billing depend on the provider, cache boundaries, minimum length and cache lifetime.

**Put changing decision blocks late in the prompt**, such as post-history instructions or a shallow author's note. An early change can lose most cache savings. Keep a decision near the top only when its answer rarely changes and its instructions belong there. The same applies to preset variable options: their text lands wherever `{{name}}` appears.

On a direct Anthropic connection with **Enable prompt caching** on, Marinara marks the end of the system prompt and a chat message **Cache depth** messages back from the newest one (5 by default). A change before history can invalidate the system boundary and later history, though an earlier matching prefix may remain reusable. A change after the marked history boundary can preserve that cached prefix. A change between the two boundaries can preserve the system prefix while losing some cached history. Cache reads and cache writes have different prices.

Minimum cache lengths and supported boundaries vary by model and can change. Check the provider's current [Anthropic prompt-caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) or [OpenAI prompt-caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) for those details and billing rules.

### When a decision branch never appears

If a user reports that a decision branch never shows up, the likely causes, in order, are:

1. **No Decision model is set.** Every decision condition is false on every turn. The editor shows a warning under any field that uses one.
2. **The Decision model is not answering.** A hosted connection with a bad key, no credits or a rate limit; a local model that is stopped or too slow for the budget; or an installed decision model that did not start.
3. **It is a reasoning model** that holds off in front of the reply.
4. **Too many statements in the relevant planning stage**, past its allowance.
5. **It answers, but below its threshold.** Usually the wording, or a model that rates that turn lower than you expect.

Ask the user which Decision model they selected and what **Test** reports. **Peek Prompt** shows the branches that were actually sent. When it has to build a fresh preview, it lists any decision statements that have no answer yet, which read as no there. With the log level set to debug, each statement, its answer and whether it read as yes are logged; see [Logging levels](../CONFIGURATION.md#logging-levels).

The fix is rarely in the preset. When it is, it is usually the wording, or a branch that carries something the prompt cannot do without.

## Related guides

- [Decision Models](../connections/decision-models.md)
- [Prompt Macros](macros.md)
- [Preset Variables](preset-variables.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
