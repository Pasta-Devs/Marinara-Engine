# Preset Variables

This guide explains **Preset Variables**, the small form-like choices you can build into a prompt preset. A preset author defines the choices once, and anyone using the preset picks the options when the preset is assigned to a chat. Preset variables are sometimes called choice blocks.

## What preset variables are

A prompt preset is a reusable blueprint for the text sent to the AI. A preset variable adds a labeled choice to that blueprint. You give the choice a name, write a question, and list some options.

Inside any prompt section you type the variable's name in double braces, like `{{tone}}`. When the AI generates a reply, Guksu Motor replaces `{{tone}}` with the option value the user picked. This lets one preset produce different behavior without editing the prompt text.

Preset variables live inside a prompt preset, so they work in the chat modes that use prompt presets. They do not apply in Conversation mode. That mode uses a single prompt-text override instead of the section-based preset, so there is nothing for the variables to fill in. To learn about presets themselves, see [Preset Editor and Prompt Manager](presets.md).

## The three kinds of preset variable

A variable's behavior depends on its options and two toggles. By default a variable with several options is a single choice: the user picks exactly one option, shown as radio buttons. On top of that baseline there are three named kinds.

**Boolean Toggle.** If a variable has exactly one option, it becomes an on/off switch. When the user turns it on, the option value is inserted. When it is off, nothing is inserted. The editor shows a **Boolean Toggle** label on these variables.

**Multi-Select.** Turn on the **Multi-Select** toggle to let users pick more than one option. By default the selected values are joined together with a separator. The separator is a short text field, and the default is a comma and a space. For example, options Romance, Fantasy, and Action joined with `, ` become the text "Romance, Fantasy, Action".

**Random Pick.** When **Multi-Select** is on, a **Random Pick** toggle appears. With **Random Pick** on, the app picks one of the user's selected options at random each time it generates. This is useful for variety: the user chooses a pool of options, and each reply draws one from that pool.

## Adding a preset variable

You add variables while editing a preset. Follow these steps.

1. Open the **Presets** panel and click a preset to open the **Preset Editor**.
2. Go to the **Sections** tab and scroll to the **Preset Variables** panel at the bottom.
3. Click **Add Variable**. A new variable card appears. Click it to expand the editor.
4. Set the **Variable Name**. It must use only letters, numbers, and underscores. This is the name you type in braces, like `{{variable_name}}`.
5. Fill in **Question (shown to user)**. This is the prompt the user reads when picking a value.
6. Edit the **Options** list. Each option has a **Label** (what the user sees) and a **Value** (the text inserted into the prompt). A blank value inserts nothing.
7. Choose a display style under **Presentation**: **Auto**, or the button style (**Radios** or **Checkboxes**), or the compact style (**Dropdown** or **Listbox**). Turn on **Alphabetical option display** to sort options by label.
8. Your changes save automatically. The editor footer reads "Changes auto-save. Press Escape to close." Press Escape or click **Done** when you are finished.

To use the variable, type its name in braces inside any prompt section's content. For example, put `{{tone}}` in a section, then create a variable named `tone` with a **Gentle** option and a **Harsh** option. When the user picks Harsh, the section receives the harsh value.

A variable must always keep at least one option. If you try to delete the last option, Guksu keeps it.

## The Configure Preset Variables modal

When you assign a preset that has variables to a chat, the **Configure Preset Variables** modal opens automatically. Its intro reads: "This preset has configurable variables. Select option(s) for each to customize your experience."

Each variable shows its question, the token it maps to (like `{{tone}}`), and a small badge saying **Boolean toggle**, **Multi-select**, or **Random pick** where it applies. Pick a value for every variable.

- **Save as default** stores your picks back onto the preset, so they are pre-filled next time.
- **Skip** closes the modal without saving your choices.
- **Confirm Choices** saves your choices. It stays disabled until every single-choice variable has a value. **Boolean toggle** and **Multi-select** variables do not block it, even when nothing is picked.

Switching to a different preset clears any variable choices you made for the current preset.

## Changing your answers later

You do not have to reopen a preset from scratch to change your answers. In the chat settings drawer, the **Prompt Preset** section shows a pencil button labeled **Edit preset variables** whenever the selected preset has variables. Click it to reopen the **Configure Preset Variables** modal with your current choices filled in.

## The {{NAME}} catch-all

Guksu resolves many built-in macros, such as `{{user}}` and `{{char}}`. After those, any leftover placeholder in the form `{{NAME}}` (letters, numbers, and underscores only) is matched against your preset variables.

If a variable with that exact name exists, the placeholder becomes the chosen value. If no variable matches, the `{{NAME}}` text is left exactly as typed. This is why an unknown placeholder shows up unchanged in the output instead of raising an error. For the full macro list, see [Prompt Macros](macros.md).

## Related guides

- [Preset Editor and Prompt Manager](presets.md)
- [Prompt Macros](macros.md)
