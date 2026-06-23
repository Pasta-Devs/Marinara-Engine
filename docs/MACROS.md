# Prompt Macros

Marinara supports prompt macros in preset sections, character fields, lorebook entries, regex scripts, slash-command prompts, and other prompt text. Type `/macros` in chat or open the macro list in the Preset Editor to see the in-app list.

Macros use double braces:

```text
{{user}}
{{char}}
{{random::sunny::rainy::foggy}}
```

Unknown `{{name}}` macros are left unchanged unless a prompt variable with that name exists.

## Identity

| Macro | Resolves to |
| --- | --- |
| `{{user}}` | Current user or persona name. |
| `{{userName}}` | Alias for `{{user}}`. |
| `{{persona}}` | Active persona description, personality, backstory, appearance, and scenario joined by new lines. |
| `{{char}}` | Current character name. |
| `{{charName}}` | Alias for `{{char}}`. |
| `{{characters}}` | All active character names, comma-separated. |

## Character Fields

Character macros resolve against the current character in single-character chats and against each character when used inside bracketed group blocks in prompt presets.

| Macro | Resolves to |
| --- | --- |
| `{{description}}` | Current character description. |
| `{{personality}}` | Current character personality. |
| `{{backstory}}` | Current character backstory. |
| `{{appearance}}` | Current character appearance. |
| `{{scenario}}` | Current character scenario. |
| `{{example}}` | Current character example dialogue. |
| `{{charSysInfo}}` | Current character system prompt. |
| `{{charPostHistory}}` | Current character post-history instructions. |

## Context

| Macro | Resolves to |
| --- | --- |
| `{{input}}` | Most recent user message available to the prompt. |
| `{{model}}` | Current model name, when the route has selected a model. |
| `{{chatId}}` | Current chat ID. |
| `{{lastGenerationType}}` | Current generation type label. Common values include `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, and `retry_agents`. |
| `{{idle_duration}}` | Human-readable time since the last visible chat activity before this generation, such as `42 seconds`, `8 minutes`, or `1 hour 5 minutes`. Fresh user-message generations exclude the just-created user message so this reflects the pause before the turn. |
| `{{agent::TYPE}}` | Cached output for an agent or tracker type. |

## Time

| Macro | Resolves to |
| --- | --- |
| `{{date}}` | Current real date in the user's browser timezone, in `YYYY-MM-DD` format. |
| `{{time}}` | Current real time in the user's browser timezone, in `HH:MM` format. |
| `{{datetime}}` | Current timestamp in the user's browser timezone. |
| `{{isotime}}` | Alias for `{{datetime}}`. |
| `{{weekday}}` | Current weekday name in the user's browser timezone. |
| `{{timezone}}` | User/browser timezone, such as `Europe/Warsaw`. |

## Random

| Macro | Resolves to |
| --- | --- |
| `{{random}}` | Random integer from 0 to 100. |
| `{{random:X:Y}}` | Random integer between `X` and `Y`, inclusive. |
| `{{roll:XdY}}` | Dice roll total such as `2d6`. |
| `{{random::A::B::C}}` | Randomly choose one of the provided options. |
| `{{random::A@2::B@0.5}}` | Weighted random choice. Weights are relative and may be decimals. |

Example:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

Nested macros are allowed inside random choices:

```text
{{random::{{getvar::actor}} leaves.::The world ends.}}
```

### Weighted Random Choices

Add a final `@number` to an option to give it a relative weight:

```text
{{random::Common event@1::Rare event@0.25}}
```

Weights are relative. In the example above, the total weight is `1.25`:

| Option | Weight | Chance |
| --- | --- | --- |
| Common event | `1` | `1 / 1.25 = 80%` |
| Rare event | `0.25` | `0.25 / 1.25 = 20%` |

Rules:

- Missing weight means `1`.
- Decimal weights are allowed, such as `0.5` or `0.01`.
- A weight of `0` keeps the option in the macro but prevents it from being selected.
- If every option has weight `0`, the macro returns an empty string.
- Invalid weight suffixes are treated as normal text. For example, `event@rare` is just the text `event@rare`.
- Only a final top-level `@number` is treated as a weight. Other `@` symbols, such as an email address, are left alone.

The selected option is resolved after it is picked, so only macros in the chosen branch run.

## Variables

| Macro | Behavior |
| --- | --- |
| `{{getvar::name}}` | Read a dynamic variable. |
| `{{setvar::name::value}}` | Set a dynamic variable and remove the macro from output. |
| `{{addvar::name::value}}` | Append to a dynamic variable and remove the macro from output. |
| `{{incvar::name}}` | Increment a numeric variable by 1. |
| `{{decvar::name}}` | Decrement a numeric variable by 1. |
| `{{NAME}}` | Resolve a preset variable named `NAME`. |

Variable operations resolve left-to-right within a prompt pass, so later macros can read values written earlier.

## Formatting

| Macro | Behavior |
| --- | --- |
| `{{newline}}` | Insert a literal newline. |
| `{{\n}}` | Insert a literal newline. |
| `{{trim}}` | Trim final output. |
| `{{trimStart}}` | Trim whitespace at the left edge of the final output around the marker. |
| `{{trimEnd}}` | Trim whitespace at the right edge of the final output around the marker. |
| `{{uppercase}}...{{/uppercase}}` | Uppercase a wrapped block. |
| `{{lowercase}}...{{/lowercase}}` | Lowercase a wrapped block. |
| `{{#if char == "Name"}}...{{else}}...{{/if}}` | Conditional block. Supports straight or typographic quotes. |
| `{{noop}}` | No-op placeholder removed from output. |
| `{{// comment}}` | Inline author comment removed from output. |
| `{{banned "text"}}` | Accepted with straight or typographic quotes, but currently stripped from output. |

## Literal Final `@number`

If a random option really needs to end with text like `@2`, Marinara will read that as a weight. Reword the option so it does not end with a final `@number`.
