# Preset Variables

A preset variable is a labeled choice built into a prompt preset. The preset's author defines it once, and whoever uses the preset picks the options when assigning it to a chat. Use one to let a single preset behave in different ways without editing the prompt text.

You name the variable, write a question, and list options. Then you type the name in double braces, like `{{tone}}`, in any prompt section. When the AI generates a reply, Marinara replaces `{{tone}}` with the option value the user picked.

Preset variables need a prompt preset, so they work in Roleplay chats. They do not apply in Conversation or Game chats, which use a single prompt text instead of sections. For presets themselves, see [Preset Editor and Prompt Manager](presets.md).

## The kinds of preset variable

A variable with several options is a single choice by default. The user picks one option, shown as radio buttons. Three settings change that.

| Kind | How you get it | Behavior |
| --- | --- | --- |
| **Boolean Toggle** | Give the variable exactly one option. | An on/off switch. On inserts the option value. Off inserts nothing. |
| **Multi-Select** | Turn on **Multi-Select**. | The user picks several options. The values are joined with a separator, `, ` by default. Romance, Fantasy and Action become "Romance, Fantasy, Action". |
| **Random Pick** | Turn on **Random Pick**. | On a single-select variable, Marinara preselects a random option for each new chat, and the choice stays fixed until you change it. With **Multi-Select** on, the user chooses a pool and each reply draws one option from it. |

## Adding a preset variable

1. Open the **Presets** panel and click a preset to open the **Preset Editor**.
2. Go to the **Sections** tab and scroll to the **Preset Variables** panel at the bottom.
3. Click **Add Variable**. A new variable card appears. Click it to expand it.
4. Set the **Variable Name**. The field keeps only letters, numbers and underscores. This is the name you type in braces.
5. Fill in **Question (shown to user)**. The user reads this when picking.
6. Edit the **Options** list. Each option has a **Label**, which the user sees, and a **Value**, the text inserted into the prompt. A blank value inserts nothing.
7. Under **Presentation**, pick **Auto**, a button style (**Radios** or **Checkboxes**), or a compact style (**Dropdown** or **Listbox**). Turn on **Alphabetical option display** to sort options by label.
8. Press <kbd>Escape</kbd> or click **Done**. Changes save automatically, and the footer says "Changes auto-save. Press Escape to close."

Now type the name in braces in a prompt section. For example, put `{{tone}}` in a section, and create a variable named `tone` with a **Gentle** option and a **Harsh** option. When the user picks **Harsh**, the section receives its value.

A variable always keeps at least one option. Marinara keeps the last one if you try to delete it.

## Answer the variables

When you assign a preset that has variables to a chat, the **Configure Preset Variables** window opens. It says: "This preset has configurable variables. Select option(s) for each to customize your experience."

Each variable shows its question, its token such as `{{tone}}`, and a badge (**Boolean toggle**, **Multi-select** or **Random pick**) where it applies.

1. Pick a value for each variable.
2. Click **Confirm Choices**.

The other buttons:

- **Save as default** stores your picks on the preset, so they are filled in next time.
- **Skip** closes the window without saving.

**Confirm Choices** stays off until every single-choice variable has a value. **Boolean toggle** and **Multi-select** variables do not block it, even with nothing picked. Switching to a different preset clears your choices for the old one.

## Change your answers later

In **Chat Settings**, the **Prompt Preset** section shows a pencil button, **Edit preset variables**, when the selected preset has variables. Click it to reopen the window with your current choices.

## Names that are not variables

Marinara resolves built-in macros such as `{{user}}` and `{{char}}` first. Then it matches any other `{{NAME}}` (letters, numbers and underscores) against your preset variables. If none matches, it tries the chat's own variables from the **Chat Variables** section of **Chat Settings**. A preset variable wins when both share a name. If neither has the name, the text stays exactly as typed, without an error. See [Prompt Macros](macros.md).

## Decision blocks in options

An option's value can hold a decision block, `{{#if decision:"..."}}`, like any other prompt text. Only the options the chat selected are asked about, and they count toward **Decision statements per turn**. For a **Random Pick** variable, every option in the pool is asked about, because any could be drawn. See [Asking the Decision model](conditional-prompts.md#asking-the-decision-model).

A variable's value lands wherever its `{{name}}` sits. If a decision changes that value near the top of a preset, you can lose much of the service's prompt-cache reuse. Put frequently changing content later. See [Decision blocks and prompt caching](presets.md#decision-blocks-and-prompt-caching).

## Greetings

Preset variables also resolve in character greetings, including choices confirmed after a greeting was created. The original greeting stays editable with its macros intact.

## Related guides

- [Preset Editor and Prompt Manager](presets.md)
- [Prompt Macros](macros.md)
