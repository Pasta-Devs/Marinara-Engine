# Preset Editor and Prompt Manager

A preset is a saved blueprint for the prompt, the text Marinara sends to the model for each reply. It decides what goes in and in what order: your instructions, the character card, your persona, the chat history, lorebook entries and more. Use the **Preset Editor** to build one, then assign it to a chat.

Presets build the prompt in **Roleplay** chats. **Conversation** and **Game** chats use a single prompt box instead (see [Conversation and Game chats](#conversation-and-game-chats)). Presets need no API key, but you still need a working account to send the prompt. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Assign a preset to a chat

A preset does nothing until a chat uses it. In a **Roleplay** chat, use either way. To pick one, assign it. To make your own, see [Create a preset](#create-a-preset).

From the **Presets** panel:

1. Open the chat.
2. In the **Presets** panel, find a preset row. On a computer, point at the row to show its buttons.
3. Click the check-mark **Assign to chat** button. A check mark shows the preset is in use. Click it again to unassign.

From **Chat Settings**:

1. Open the chat, then **Chat Settings**.
2. Find **Prompt Preset** and pick a preset from the dropdown.

If the preset has variables, the **Configure Preset Variables** window opens. See [Preset Variables](preset-variables.md). Switching presets clears earlier variable choices.

## Create a preset

1. Open the **Presets** panel from the sidebar.
2. Click **New** (the plus icon). The **Create Preset** window opens.
3. Type a **Name**. It is required. Add a **Description** if you want.
4. Click **Create**. The preset opens in the **Preset Editor**.
5. Build the prompt on the **Sections** tab.
6. Click **Save** in the top right.

The editor does not save by itself. Click **Save** after every change. If you leave with unsaved edits, a warning offers **Keep editing**, **Discard** and **Save & close**.

To export a preset, click the up-arrow icon in the top bar (tooltip **Export preset**). Marinara asks you to save first if you have unsaved edits. To delete it, click the trash icon.

## The Presets panel

**Prompts** is the section for presets. The other sections are **Regexes** and **Functions**. The top buttons are **New**, **Import** (load a `.json` file) and **Select** (export or delete several at once).

- **Search presets** filters the list.
- The sort menu offers **Manual order**, **A-Z**, **Z-A**, **Newest** and **Oldest**. With **Manual order**, drag a row, or press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd> on a focused row. On a touch screen, press and hold a row to pick it up.
- **New Folder** groups presets. Drag a preset onto a folder, and double-click or double-tap a folder to rename it.

Each row shows the name, wrap format, section count and author. A **DEFAULT** badge marks the starred default. Click a row to open it.

## The Preset Editor's tabs

| Tab | What it holds |
| --- | --- |
| **Overview** | Name, description, wrap format and author. |
| **Sections** | The prompt structure, built from blocks and markers. |
| **Prompts** | The mode prompts for Conversation and Game chats. |
| **Parameters** | Starting generation settings. See [Generation Parameters](generation-parameters.md). |
| **Regex** | Regex scripts linked to this preset and the **Scoped regex default**. See [Regex Scripts](../extending/regex-scripts.md). |

### Overview tab

- **Name** is the title in the **Presets** panel.
- **Description** is a short summary.
- **Wrap Format** controls how sections are formatted (see [Wrap formats](#wrap-formats)).
- **Author** is an optional creator name, useful when you share a preset.

Two read-only cards show the **Sections** and **Groups** counts.

### Prompts tab

- **Conversation Mode** is a text box for this preset's Conversation prompt. Leave it empty to use the built-in prompt.
- **Roleplay Mode** is not editable here. Roleplay uses the prompt assembled from your **Sections**.
- **Game Mode** is a text box for this preset's Game prompt. Leave it empty to use the built-in prompt.

The built-in **Marinara's Universal Preset** supplies prompt text but no generation parameters. Its older saved sampling, reasoning, formatting and token settings are ignored, and your account settings, chat overrides and app defaults apply instead. Make an editable copy to customize it.

## Sections and markers

The **Sections** tab is where you build the prompt. Sections are assembled from top to bottom.

1. Click **Add Section**.
2. Pick **Prompt Block** or a marker.

A **Prompt Block** is text you write: system instructions, tone rules, anything you want in every prompt. A marker has no text of its own. Marinara fills it with live content from the chat when it sends the prompt.

| Marker | What it inserts |
| --- | --- |
| **Character Info** | The active character card details. |
| **Persona** | Your active persona details. |
| **Chat History** | The chat messages. |
| **Chat Summary** | The compiled chat summary. |
| **Dialogue Examples** | The character's example dialogue. |
| **Lorebook Marker (All)** | All active lorebook entries. |
| **Lorebook Marker (Before)** | Lorebook entries set to go before. |
| **Lorebook Marker (After)** | Lorebook entries set to go after. |

A marker row shows a **MARKER** badge. You cannot type into most markers. Use **Lorebook Marker (All)** unless you want to split lorebook entries into before and after.

Three rarer markers:

- **Current Scene Summary** and **Recalled Scenes** place the summaries that Advanced Memory Recall makes. Without a **Recalled Scenes** marker, they appear before the chat history. See [Memory](../agents/memory.md).
- **ID Macro Cards** places character cards that you pull into a prompt by typing a character's card ID in double braces. Without this marker, they go at the default place. See [Prompt Macros](macros.md).

Without an enabled **Dialogue Examples** marker, non-empty example dialogue is added to **Character Info** after the scenario, in the preset's wrap format. Add the marker to choose the placement. Marinara never includes it twice.

If your chat has active lorebooks but the preset has no lorebook marker, a warning says: "Add a lorebook marker when this preset should receive active lorebook entries." Add one so the entries reach the model. See [Lorebooks Overview](../lorebooks/overview.md).

If you have custom agents with "inject as section" turned on, the add menu shows **Agent Sections**. Each inserts that agent's latest output, and you can add your own instructions around it.

### Edit a section

1. Click a section's name or arrow to expand it.
2. Change its **Name** or its role (**System**, **User** or **Assistant**).
3. For a **Prompt Block**, edit **Content**. It supports [macros](macros.md).
4. Click **Save** in the top right.

The row's controls:

- **Duplicate** copies the section.
- The eye icon turns it on or off.
- **Delete** removes it.
- To reorder, drag the grip handle, use the up and down arrows, or long-press on a touch screen.

### Groups

A group wraps several sections in one container.

1. On the **Sections** tab, click **Groups**, then **New Group**.
2. Click the group's name to rename it.
3. Expand a section and pick the group in its **Group** dropdown.

With **XML**, a group becomes one parent tag. With **MARKDOWN**, it becomes one heading. Deleting a group does not delete its sections. They only lose the group.

### Position and depth

Each section has a **Position** in its editor.

- **Ordered (in sequence)** places the section where it sits in the list. This is the normal choice.
- **Depth (from end of chat)** places it a set number of messages up from the end of the chat, using the **Depth** number. A depth of 0 goes after the last message. Use it for reminders the model should see near the newest messages.

## Wrap formats

**Wrap Format** on the **Overview** tab sets how each section is wrapped.

| Format | Result |
| --- | --- |
| **XML** | Each section sits in tags. Groups become parent tags. This is the default. |
| **MARKDOWN** | Each section gets a heading. Groups become higher-level headings. |
| **NONE** | No wrapping. Content is sent as written. |

XML suits most models. Try the others only if a model answers better without tags.

To send one **Prompt Block** without its tag or heading, expand it and turn on **Send without wrapper**. A group's tag can still surround it, so remove the block from its group to make it fully bare. Markers always keep their wrapper, and the switch is hidden when the format is **NONE**.

## Conversation and Game chats

These chats do not build a prompt from Sections. They use one mode prompt. In **Chat Settings**, the **Prompt Preset** section has a **Prompt source** dropdown with your presets. It starts on **Default conversation prompt** or **Default game prompt**, or says **No presets available** when you have none. In the **Presets** panel, the assign button shows "Prompt presets are not available in conversation mode."

Below the dropdown, a badge shows where the prompt comes from.

| Badge | Meaning |
| --- | --- |
| **Default** | The built-in prompt. |
| **Preset** | The chosen preset's prompt. |
| **Style** | The prompt of the selected GM prompt style. Game chats only. |
| **Custom** | A chat-local edit for this chat only. It wins over all the others. |

The text box shows the prompt in use. Edit it to make a chat-local copy. If your text matches the preset or default exactly, Marinara treats it as not customized. While a custom edit exists, a reset icon appears (tooltip **Reset to default prompt**).

Game chats add two controls. **GM prompt style** replaces only the Game prompt, and a chat-local edit still wins. **Extra instructions** adds text to the Game prompt, up to 2000 characters, such as "Write in the style of Terry Pratchett."

## Decision blocks and prompt caching

A section can hold a decision block, `{{#if decision:"..."}}`, so that part is sent only when a statement about the chat is true. See [Asking the Decision model](conditional-prompts.md#asking-the-decision-model).

Put decision blocks that change often late in the prompt, such as in post-history instructions. A changed branch can stop a provider from reusing the prompt from that point on, so an early change loses most cache savings. An unchanged earlier part can still be reused. Keep a decision near the top only when its answer rarely changes. See [Prompt caching](conditional-prompts.md#prompt-caching).

Statements in disabled sections and groups are never asked and do not count toward **Decision statements per turn**.

## Check what the AI received

**Peek Prompt** shows the fully assembled prompt for a message. It is the quickest way to debug an odd reply. See [Peek Prompt: See What the AI Received](../chats/peek-prompt.md).

## Related guides

- [Preset Variables](preset-variables.md)
- [Prompt Macros](macros.md)
- [Generation Parameters](generation-parameters.md)
- [Settings Profiles](../chats/settings-profiles.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Peek Prompt: See What the AI Received](../chats/peek-prompt.md)
