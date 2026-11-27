# Prompt Viewer

The Prompt viewer puts a preset, lorebooks, characters and a persona side by side and shows the prompt they build, in the order Marinara sends it. Click any piece to edit it in place. Your edits save to the real preset, lorebook, card or persona, so the other editors show them straight away.

It began as kolache's AIO Prompt Viewer and Editor extension and is now part of the new layout.

## Opening it

- **Computer:** the Prompt viewer button (🥞) in the top bar, right after Search.
- **Phone or tablet:** tap the tab count in the top bar to open All Tabs, then the Prompt viewer button (🥞) beside **+**.
- **Anywhere:** open Search and type `prompt viewer`.

It opens in its own tab. Switching to another tab keeps your picks and any unsaved edit; closing the tab asks first if an edit is unsaved.

## The three columns

| Column | What it is for |
| --- | --- |
| **Sources** | Pick a preset, one or more lorebooks, a character (or several for a group) and a persona. Tick lorebook entries or folders to pull them into the prompt. **+** makes a new one; the pencil opens its settings. |
| **Prompt** | Everything you picked, in the order the engine assembles it: preset sections, lorebook entries at their positions and depths, the character and persona in their markers. **Validate** looks for unclosed XML tags and broken `{{macros}}`. Drag sections to reorder the preset. |
| **Editor** | The fields of the piece you clicked. **Save** writes it back; **Revert** drops the edit. |

On a phone, or a tablet held upright, the columns sit behind a **Sources / Prompt / Editor** switch, and clicking a block takes you to the Editor.

## Inspect, Summaries and Settings

The buttons at the top of the page open these inside the page; **Back** returns to the columns.

- **Inspect** shows the prompt as it would be sent to the model. With a chat open, **Include history** asks the engine for the exact prompt (macros resolved, history trimmed to fit); **Omit history** shows the structure with a placeholder for the chat. Copy it as text or as the JSON messages list.
- **Summaries** exports every chat summary in your library as Markdown or JSON, including disabled entries. No chat needs to be open.
- **Settings** sets what Inspect does with history, how many turns a chat without a connection shows, which badges the Prompt column shows, and the Inspect colours.

## What it does not show

- Agents are left out of the Prompt column; Inspect includes them, because it asks the engine.
- Chat history, summaries, dialogue examples and agent data are placeholders in the Prompt column: their content only exists when a chat runs.
- A group's per-turn behaviour (who replies, "Respond only as…") is described, not built, until a chat is open.
