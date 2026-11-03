# Conditional Prompts ({{#if}})

An `{{#if}}` block includes some prompt text only when a condition is true. Use it to give one shared preset different instructions for different characters, personas or chats, or to leave out a field that is empty. Conditionals are part of the macro system, so they work wherever [macros](macros.md) work: character cards, personas, lorebook entries and presets.

Marinara checks the condition each time it builds a prompt, keeps the matching text, and drops the rest. This is an advanced feature, and most chats never need it.

## The basic syntax

A block starts with `{{#if condition}}` and ends with `{{/if}}`. Add `{{else}}` for the false case, and `{{else if}}` to chain more conditions. Marinara checks each branch from top to bottom and keeps the first true one. If none is true and there is no `{{else}}`, the block resolves to nothing.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

A block can sit on one line or on several, and you can nest blocks.

## Operators

A condition is usually a left value, an operator and a right value, like `char == "Alice"`.

| Operator | Meaning |
| --- | --- |
| `==`, `=`, `is` | Equal. |
| `!=`, `is not` | Not equal. |
| `>`, `<`, `>=`, `<=` | Greater, less, greater or equal, less or equal (numbers only). |
| `contains`, `includes` | The left value contains the right value as text. |
| `not contains`, `not includes` | The left value does not contain the right value. |

Comparison rules:

1. For equality operators, if both sides look like numbers, Marinara compares them as numbers, so `5` equals `5.0`. Otherwise it compares text and ignores case, so `Mari` equals `mari`.
2. For `>`, `<`, `>=` and `<=`, both sides must be numbers. Otherwise the condition is false.
3. `contains` and `includes` ignore case, so `contains "dr"` matches `Dr Smith`.

### Combine conditions

Use `||` for OR and `&&` for AND. `&&` is evaluated before `||`. Use parentheses to set the order.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

For several equality choices on one value, you can leave out the repeated left side: `character == "Maukie" || "Pantalone"`. This works for `==`, `=` and `is`. Write full conditions on both sides of `&&`.

### Truthy checks

A condition with no operator is true when the value has real content. It is false when the value is empty or one of `false`, `0`, `no`, `off`, `null` or `undefined`, in any case.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### What you can compare

Either side of a condition can be:

1. A field or identity keyword, such as `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` or `reasoning`. These read the same values as the matching macros. `group` lists the other active characters, without the current responder.
2. A quoted literal, such as `"Alice"`.
3. A preset variable name, such as `length`. See [Preset Variables](preset-variables.md).
4. An explicit variable lookup, written `var:name` or `var.name`.
5. Another macro, which is resolved first.
6. A question for your Decision model: `decision:"..."` or `decision_choice:"..."`. See [Asking the Decision model](#asking-the-decision-model).

A bare word that is not a keyword is treated as a variable name. If no variable has that name, it is used as plain text. Quote literal values to avoid confusion.

### Quoting

Put fixed text in straight double or single quotes. Inside a quoted value, escape a quote with a backslash, and write `\n` for a newline. Always quote a literal with a space, such as `"Dr Smith"`. An unquoted multi-word value is read as one variable name.

## Group blocks for multiple characters

In a group chat with two or more characters, a group block repeats its text once for each character. Put `[` alone on one line, your text, then `]` alone on one line. The block must contain a character macro such as `{{char}}` or `{{description}}`, or a character-based condition.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

With Alice and Bob, the block runs twice, once per character. Outside a group block, a character macro resolves only against the current or primary character. In a chat with one character, the `[` and `]` lines stay as plain text.

## Examples

Different tone per character:

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Include a field only when it is filled in. With an empty **Backstory**, the block resolves to nothing, so no empty label is sent.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Instructions for one family of models. `model` is the model ID, such as `claude-opus-5-5`, so `contains` matches every Opus version and `==` matches one exact model.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Planning instructions that depend on thinking. With reasoning on at any level, the model gets the first line. With reasoning off, `{{reasoning}}` is `off`, which reads as false. To act on one level, compare it, as in `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

## Asking the Decision model

A condition can ask your Decision model what is happening in the chat. The Decision model is a small model that reads the last few messages and a statement you write, and says whether the statement is true. It never writes into the chat. This lets a preset, card, lorebook entry or agent prompt send an instruction only on the turns where it applies.

Before you start: choose a Decision model under **Decision model** in the **Connections** panel. See [Decision Models](../connections/decision-models.md) for what it is and how to pick one. To decide whether a whole lorebook entry activates, use the entry's [Decision](../lorebooks/entries.md#decision-activation) field instead.

Ideas: describe a new place only when the scene moved, load combat pacing rules only during a fight, hold back escalation in a slow-burn preset, or make only the addressed character answer directly in a group block.

### Yes or no: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

The condition is true when the Decision model says the statement is true. It works with `{{else}}`, `&&`, `||`, parentheses, nesting and group blocks. Macros in the statement are filled in first, so `{{user}}` and `{{char}}` work. In a group block, a statement that names `{{char}}` is asked once per character.

### One of several answers: `decision_choice:`

`decision_choice:` asks the model to pick one option. The options are the values you compare it with.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

The model chooses between "angry", "sad" and "none of these". Write the statement as a subject and the options as short answers. The short form `== "rain" || "snow"` offers both options.

To say what an option means in your story, add criteria after it, separated by a colon, with the same kind of quote on both parts: `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. The model still answers "angry". If one option has different criteria in several places, the first is used.

### Sticky and cooldown

Add `sticky:` and `cooldown:` after a statement to keep its answer for a few turns instead of asking every turn.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: after a yes, the statement stays yes for N turns without being asked.
- `cooldown:N`: starts when sticky ends, or right after the yes. For N turns the statement reads as no and is not asked.
- A turn is each new message the Decision model reads. A regeneration or swipe of the same message is the same turn, so rerolling never runs a timer down.
- A held statement is not asked and does not count toward **Decision statements per turn**.
- For `decision_choice:`, sticky keeps the chosen option, and cooldown reads every comparison as no.
- A statement written in several places uses the longest sticky and cooldown.
- Peek Prompt shows the held answer and never moves a timer on.

For a lorebook entry activated by its **Decision** field, use the entry's own **Sticky** and **Cooldown** instead.

### Until and while

To keep a block on for as long as something lasts, add `until:` or `while:` with a second statement.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- After a yes, the block stays on. The first statement is not asked. The `until` statement is asked each turn instead, and the block turns off on the turn it is true.
- `while:` works the other way: the block stays on while its statement is true, and turns off when it is false.
- Use one or the other. If both are written, only the first counts.
- When the block turns off, cooldown starts as usual. With no answer on a turn, the block stays on.
- The `until` or `while` statement counts toward **Decision statements per turn**. The first statement does not while the block is on.
- It works with `decision:`, not `decision_choice:`.

With **sticky**, add `:and` (also `:restrict`) or `:or` (also `:extend`) after the second statement to choose how the two combine.

| Written | After the yes, the block stays on |
| --- | --- |
| `until:"..." sticky:5` or `until:"...":and sticky:5` | Up to 5 more turns, and turns off sooner if the until statement is true. |
| `until:"...":or sticky:5` | At least 5 more turns, then until the until statement is true. |
| `while:"..." sticky:5` or `while:"...":or sticky:5` | At least 5 more turns, then while the while statement is true. |
| `while:"...":and sticky:5` | Up to 5 more turns, and turns off sooner if the while statement is false. |

### Checking every few turns

Add `every:N` to ask a statement only every N turns.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- It is asked the first turn it is reached, then 3 turns later, and so on. Between checks it reads as no, is not asked, and does not count toward **Decision statements per turn**.
- A regeneration or swipe does not advance the schedule.
- Sticky and cooldown still hold an answer. `every:` only decides when an unheld statement is asked.
- A statement written in several places uses the smallest `every:`.

### Priority

When a prompt plan has more statements than the **Decision statements per turn** allowance, `priority:high` or `priority:low` decides which are asked. No priority means medium.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- High statements are asked first and low statements last. Within one priority, the order in the prompt decides.
- Statements past the limit read as no, lowest priority first, and Peek Prompt lists them.
- A statement written in several places uses the highest priority.
- The prompt's own statements (preset, cards, persona, author's notes) are planned first. Lorebook statements use the slots that are left, whatever their priority.

You can combine all modifiers in any order: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### No answer means no

A decision condition is false whenever there is no answer: no Decision model is set, it did not answer in time, or it failed. For `decision_choice:`, every comparison is false. Design for that.

- Use a decision to add or trim guidance, never to carry content the story depends on.
- Give every decision block a default: nothing, or an `{{else}}` that is fine on any turn.
- Do not chain decisions so that one wrong answer changes several others.
- Do not gate consent, content warnings or safety instructions on a decision.

Any model can answer wrongly. Write for "a Decision model", not one product.

### Writing statements

- State a fact that is true or false, like a line in a report. Not a question ("Did the scene change?") and not an instruction ("If the scene changed, describe it"). Small models often answer no to an instruction, so the block never runs.
- Say "in the latest message" when you mean this turn. The model reads several messages, and an earlier one can make it answer yes.
- Name who it is about. "He is angry" can be read as the wrong character.
- Describe something visible in the text, such as an action or a spoken line. Avoid mood words ("The scene is intense") and hidden intentions ("Mira is lying").
- Keep it short. Split a long statement into parts if you want to reuse or debug them.

To test your wording:

1. Select a model under **Decision model** and click **Test**. This checks the connection with a fixed sample. It does not test your statement.
2. Add the statement to your prompt and send messages where it should be true and messages where it should be false.
3. Use **Peek Prompt** to see which branch was sent. Open **Decision diagnostics**, then choose **Test decisions** to get fresh answers without generating a reply. Hosted tests may cost money. See [Testing decision statements](../chats/peek-prompt.md#testing-decision-statements).
4. Adjust the wording and test again. To see answers from live generations, turn on Debug Mode or [debug logging](../CONFIGURATION.md#logging-levels).

### Limits and cost

#### Statement allowance

**Decision statements per turn**, under **Decision model**, defaults to 32. It is not one cap on every Decision request or on spending. Marinara applies it in stages.

1. The main chat prompt's statements are planned within the allowance. Lorebook decisions use what is left.
2. Agents that run before or alongside the reply get a combined plan with the main prompt, using the allowance again. This stage does not subtract the lorebook's use, so the total can exceed the setting.
3. Post-processing agents get a separate allowance after the reply.

Agent activation questions and Smart response order are separate from this setting.

Only statements a stage can use enter its plan: enabled preset sections and groups, selected variable options and content from activated lorebook entries. A fixed condition can rule a statement out, such as `{{#if char == "Dottore" && decision:"..."}}` while the character is Mira. A variable condition does not, because variables can change while the prompt is built. Statements held by sticky, cooldown or `every:` take no slot. Statements left out read as no.

#### Requests and time

On a hosted Decision account, one turn can make several billed requests. Statements can be batched, but lorebook activation, newly activated entry content, recursive matches and agent phases can need more batches. A local chat model adds processing time instead of charges, and answers a `decision_choice:` with one yes/no question per option.

Each request has a time limit, 1.5 seconds by default for a hosted Decision account, or 4 seconds for an OpenAI-compatible chat model account or a local model. See [Time limits](../connections/decision-models.md#time-limits). A local reasoning model holds off before the reply unless you turn on **Also gate agents that run before the reply**.

#### Answer reuse

Marinara normally reuses successful answers for the same turn and Decision model, so a regeneration often sends the same branches without a new request. The cache lives in the running server and holds up to 200 turns. A restart, eviction, a new or edited latest message, a different model, or a changed statement or option set can need a new answer.

Missing or failed answers are not cached, so a retry can ask again and take a different branch. Agent prompt statements follow the same rules. A manual agent re-run reuses answers still cached for its inputs. See [Decision statements in the agent's prompt](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

#### Prompt caching

The provider's prompt cache is separate from Marinara's answer cache. It can reuse an unchanged start of the prompt sent to your chat model. Changing a decision branch can stop reuse from that point on, though an earlier unchanged part may still qualify. Billing depends on the provider.

Put decision blocks that change often late in the prompt, such as post-history instructions or a shallow author's note. Keep a decision near the top only when its answer rarely changes. Preset variable options work the same way, because their text lands wherever `{{name}}` appears.

On a direct Anthropic account with **Enable prompt caching** on, Marinara marks the end of the system prompt and a chat message **Cache depth** messages back from the newest (5 by default). A change before history can invalidate the system boundary and later history. A change after the marked history boundary can keep the cached part. Minimum cache lengths vary by model. See the provider's current [Anthropic prompt-caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) or [OpenAI prompt-caching guide](https://developers.openai.com/api/docs/guides/prompt-caching).

### When a decision branch never appears

Likely causes, in order:

1. No Decision model is set. Every decision condition is false. The editor shows a warning under any field that uses one.
2. The Decision model is not answering: a bad key, no credits or a rate limit on a hosted account, a local model that is stopped or too slow, or an installed decision model that did not start.
3. It is a reasoning model that holds off before the reply.
4. Too many statements in the planning stage, past the allowance.
5. It answers, but below its threshold. This is usually the wording.

Check what **Test** reports, and use **Peek Prompt** to see the branches that were sent. It lists statements with no answer yet, which read as no. With the log level on debug, each statement, its answer and whether it read as yes are logged. See [Logging levels](../CONFIGURATION.md#logging-levels). The fix is rarely in the preset. It is usually the wording, or a branch that carries something the prompt cannot do without.

## Related guides

- [Decision Models](../connections/decision-models.md)
- [Prompt Macros](macros.md)
- [Preset Variables](preset-variables.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
