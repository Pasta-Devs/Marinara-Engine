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

## Related guides

- [Prompt Macros](macros.md)
- [Preset Variables](preset-variables.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
