# Preset Editor and Prompt Manager

This guide explains prompt presets in Marinara Engine. You will learn what they are, how to build one in the **Preset Editor**, and how to assign one to a chat. A preset controls the structure of the text that Marinara sends to the AI.

## What a preset is

A preset is a reusable blueprint. It decides what information Marinara sends to the AI and in what order. That includes system instructions you write, the character card, your persona, the chat history, lorebook entries, and more.

Presets shape the prompt for **Roleplay** and **Game** chats. **Conversation** mode works differently and uses a single prompt field. See "How Conversation and Game modes differ" below.

Presets do not need an API key or account. They only describe how a prompt is built. You still need a working connection to send the prompt. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Opening the Preset Editor

Prompt presets live in the **Presets** panel on the left side of the app.

The panel has three buttons at the top:

- **New** (plus icon): create a new preset.
- **Import** (download icon): load a preset from a `.json` file.
- **Select** (check icon): pick several presets to export or delete at once.

Below the buttons are a **Search presets** box and a sort menu with **A-Z**, **Z-A**, **Newest**, and **Oldest**. A **New Folder** button lets you group presets into folders. Drag a preset onto a folder to move it. Double-click or double-tap a folder to rename it.

Each preset row shows its name, wrap format, section count, and author. A **DEFAULT** badge appears if the preset is the starred default. Click a preset row to open it in the **Preset Editor**.

## Creating and editing a preset

Follow these steps to make a new preset.

1. Open the **Presets** panel.
2. Click the **New** button. The **Create Preset** modal opens.
3. Type a **Name**. This field is required.
4. Add an optional **Description** so you remember what the preset is for.
5. Click **Create**. The new preset opens in the **Preset Editor**.
6. Build your prompt on the **Sections** tab (covered below).
7. Click **Save** in the top right corner when you are done.

The editor does not save on its own. Your changes are only kept after you click **Save**. If you try to leave with unsaved edits, a warning appears with **Keep editing**, **Discard**, and **Save & close** buttons.

To export a preset, open it and click the export button (up-arrow icon) in the top bar. Marinara asks to save first if you have unsaved edits. To delete a preset, use the trash icon in the top bar.

## The Overview, Sections, and Prompts tabs

The **Preset Editor** has three tabs.

- **Overview**: the preset name, description, wrap format, and author.
- **Sections**: the actual prompt structure, built from blocks and markers.
- **Prompts**: the mode prompts used by Conversation and Game chats.

### Overview tab

The **Overview** tab holds four fields. **Name** is the display name shown in the **Presets** panel. **Description** is a short summary of the preset. **Wrap Format** controls how sections are formatted (see "Wrap formats"). **Author** is an optional creator name, useful when you share a preset. Two read-only cards show the **Sections** and **Groups** counts.

### Prompts tab

The **Prompts** tab holds the mode prompts.

- **Conversation Mode**: a text box used as this preset's Conversation prompt. Leave it empty to use Marinara's built-in conversation prompt.
- **Roleplay Mode**: not editable here. Roleplay uses the assembled prompt from your **Sections**.
- **Game Mode**: a text box used as this preset's Game prompt. Leave it empty to use Marinara's built-in game prompt.

## Sections and markers

The **Sections** tab is where you build the prompt. Every section becomes part of the final text sent to the AI. Sections are assembled from top to bottom.

Click **Add Section** to open the add menu. It offers two kinds of section.

A **Prompt Block** is a free-text section that you write yourself. Use it for system instructions, tone rules, or any wording you want in every prompt.

A **marker** is an auto-filled section. It has no text of its own. Instead, Marinara fills it at send time with live content from your chat. The table below lists the markers.

| Marker | What it inserts |
|---|---|
| **Character Info** | The active character card details. |
| **Persona** | Your active persona details. |
| **Chat History** | The running chat messages. |
| **Chat Summary** | The compiled chat summary for this chat. |
| **Dialogue Examples** | The character's example dialogue. |
| **Lorebook Marker (All)** | All active lorebook entries. |
| **Lorebook Marker (Before)** | Lorebook entries set to insert before. |
| **Lorebook Marker (After)** | Lorebook entries set to insert after. |

A section that is a marker shows a **MARKER** badge in its row. Expand it to see a note that names the marker type. You cannot type content into most markers, because Marinara generates them for you.

When a preset has no enabled **Dialogue Examples** marker, non-empty Example Dialogue is appended to **Character Info** after Scenario. It uses the preset's XML, Markdown, or unwrapped formatting. Add a Dialogue Examples marker when you want to control its placement explicitly; Marinara will not include it twice.

If your chat has active lorebooks but your preset has no lorebook marker, a warning appears. It reads: "Add a lorebook marker when this preset should receive active lorebook entries." Add a lorebook marker so those entries reach the AI. See [Lorebooks Overview](../lorebooks/overview.md).

If you have set up custom agents with the "inject as section" option turned on, the add menu shows an **Agent Sections** group. Each agent section inserts that agent's latest output into the prompt. You can add your own instructions around it.

Each section row has controls on the right. **Duplicate** copies the section. The eye icon enables or disables the section. **Delete** removes it. To reorder sections, drag the grip handle, use the up and down arrows, or long-press on a touch screen.

Expand a section (click its name or the chevron) to edit it. You can change its **Name** and its role (**System**, **User**, or **Assistant**). For a **Prompt Block**, you can also edit its **Content**. The content box supports macros. See [Prompt Macros](macros.md).

## Groups and section position

### Groups

Groups wrap several sections in one container. This keeps related sections together in the final prompt.

1. On the **Sections** tab, click the **Groups** button in the toolbar.
2. Click **New Group**. A group named "New Group" appears.
3. Click the group name to rename it.
4. Expand a section and pick your group in its **Group** dropdown.

With **XML** wrap format, a group becomes one parent tag around its sections. With **Markdown**, a group becomes one heading. Deleting a group does not delete its sections. They simply lose the group.

### Position and depth

Each section has a **Position** setting inside its expanded editor.

- **Ordered (in sequence)**: the section sits where it appears in the list. This is the normal choice.
- **Depth (from end of chat)**: the section is placed a set number of messages up from the end of the chat. When you pick this, a **Depth** number appears. A depth of 0 means the section goes after the last message.

Use **Depth** for reminders you want the AI to see near the newest messages, such as a short style note.

## Wrap formats

**Wrap Format** on the **Overview** tab controls how each section is wrapped when the prompt is assembled. There are three buttons.

- **XML**: each section is wrapped in tags, for example a name tag around its content. Groups become parent tags. This is the default.
- **MARKDOWN**: each section is wrapped with a heading. Groups become higher-level headings.
- **NONE**: no wrapping is added. Section content is sent exactly as written.

XML is a good default for most models. Try **MARKDOWN** or **NONE** only if a model seems to respond better without tags.

## Assigning a preset to a chat

A preset does nothing until you assign it to a chat. There are two ways to do this in a **Roleplay** chat.

From the **Presets** panel:

1. Open the chat you want to change.
2. In the **Presets** panel, hover over a preset row.
3. Click the check-mark **Assign to chat** button. Click it again to unassign.

From **Chat Settings**:

1. Open the chat.
2. Open **Chat Settings** (the gear).
3. Find the **Prompt Preset** section.
4. Pick a preset from the dropdown.

If a preset has variables, a **Configure Preset Variables** window opens when you assign it. Fill in your choices there. See [Preset Variables](preset-variables.md). Switching to a different preset clears any variable choices you made before.

Prompt presets are not available in **Conversation** mode from the panel. Clicking the assign button in a Conversation chat shows a message: "Prompt presets are not available in conversation mode." See the next section for how Conversation and Game chats use presets instead.

## How Conversation and Game modes differ

**Conversation** and **Game** chats do not build a prompt from Sections. Instead they use one mode prompt, which you can override per chat.

In these modes, **Chat Settings** shows a **Prompt Preset** section with a **Prompt source** dropdown. The dropdown lists your presets. It defaults to "Default conversation prompt" or "Default game prompt". If you have no presets, it reads "No presets available".

Below the dropdown is a status row. It shows one of three states:

- **Default**: the built-in mode prompt is used.
- **Preset**: the prompt comes from the chosen preset.
- **Custom**: you have typed a chat-local edit for this chat only.

Click **Edit Prompt** to type a prompt just for this chat. The editor opens as **Edit Conversation Prompt** or **Edit Game Prompt**. If your edit matches the preset or default exactly, Marinara treats it as not customized. Once a custom edit exists, a **Reset to default prompt** button appears to clear it.

Game chats also have an **Extra instructions** box. Text there is added to the Game prompt. It has a limit of 2000 characters. A sample instruction is "Write in the style of Terry Pratchett."

## Checking what the AI received

To confirm which preset and sections actually reached the AI, use **Peek Prompt**. It shows the fully assembled prompt for a message. This is the fastest way to debug an odd response. See [Peek Prompt: See What the AI Received](../chats/peek-prompt.md).

## Related guides

- [Preset Variables](preset-variables.md)
- [Prompt Macros](macros.md)
- [Generation Parameters](generation-parameters.md)
- [Chat Settings Presets](chat-settings-presets.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Peek Prompt: See What the AI Received](../chats/peek-prompt.md)
