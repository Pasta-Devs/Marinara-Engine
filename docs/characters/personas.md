# Personas

A persona is the character card that stands for you in a chat: your name, your description and other optional details. Marinara sends them in every prompt so the AI knows who it is talking to. You can keep many personas and pick one per chat.

## What a persona does

Choose which persona a chat uses, or choose **None** to use no persona. See [Choosing Your Persona in a Chat](choosing-your-persona.md).

The `{{user}}` macro is a placeholder that Marinara replaces with a real value before it sends the prompt. `{{user}}` becomes the name of the chat's persona. If the persona is named Alex, `{{user}}` becomes Alex. With no persona, the AI calls you "User" and no persona details are sent. See [Macros](../prompts/macros.md).

## Create a persona

1. Open the **Personas** panel from the sidebar.
2. Click **New**. The **Create Persona** window opens.
3. Type a name in **Name**. It is the only required field.
4. Click **Create**.

The persona is created with an empty description and opens in the Persona Editor so you can fill in the rest. Then select it in the chat where you want to use it.

## The Personas panel

The **Personas** panel is your persona library. Click a row to open that persona in the Persona Editor.

| Control | What it does |
| --- | --- |
| **Download** | Opens the [Card Browser](bot-browser.md), where you can also find personas on PlotLight. |
| **Open Library** | Opens the full-page Persona Library, with the same grid and preview as the Character Library. |
| **New** | Creates a persona. |
| **Import** | Opens the **Import Persona** window. |
| **Select** | Turns on selection mode for bulk delete and export. |
| Search box | Placeholder **Search personas/tags**. It matches name, description, comment and tags. See [Organizing Your Character Library](library-organization.md#search) for tag searches such as `male genshin`. |
| Sort dropdown | **Manual order**, **A-Z**, **Z-A**, **Newest**, **Oldest** or **Tokens** (estimated prompt size). |
| **New Folder** | Creates a folder. |
| **Tags** | Expands the tag list for filtering. |

In **Manual order**, drag a row, or press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd> on a focused row. On a touch screen, press and hold a row to pick it up. Hover a row to see **Duplicate** and **Delete**. A **Load more** button appears when there are more personas than one page shows. With none, the panel says **No personas yet**.

## The Persona Editor

Opening a persona replaces the chat area with the full-page Persona Editor. The header has:

- A **Back** arrow.
- The avatar tile. Click it to upload a picture. With an image-generation connection set up, a wand button generates one too.
- The name field and a comment field, for a short label such as `Modern AU version`.
- **Save**, which is off until you change something.
- **Export persona**, **Add persona as character**, **Duplicate persona** and **Delete persona**.

Leaving the editor saves your changes first. If saving fails, the editor stays open with your draft.

The tabs, in order, are **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** and **Stats**. Each tab jumps to its section of one long form.

The persona editor works like the [Character Editor](creating-and-editing-characters.md). The notes below cover what is different.

| Tab | Persona-specific notes |
| --- | --- |
| **Metadata** | Shows **Persona ID** (with **Copy**), the avatar crop, **Name**, **Creator**, **Phonetic name** (used only when text-to-speech reads your name), **Title / Comment**, **Version** (default `1.0`, with an **Automatic versioning** switch), **Tags** and **Creator Notes** (never sent to the AI). |
| **Card** | See [Card tab](#card-tab) below. |
| **Convo** | Fields used in Conversation mode only. See [Conversation Mode Profiles](../conversation/profiles.md). |
| **Lorebook** | Attach lorebook entries that activate when this persona is in the chat. See [Lorebooks Overview](../lorebooks/overview.md). |
| **Sprites** | Standing art for Game and Roleplay. Has **Facial Expressions**, **Full-body** and **Clips**, and **Upload Folder**. See [Character Sprites](sprites.md). |
| **Gallery** | Reference images and videos, with **Upload Persona Images** and **Upload Persona Videos**. See [Character and Persona Galleries](galleries.md). |
| **Colors** | Name, dialogue and message box colors. See [Character Colors and RPG Stats](colors-and-stats.md). |
| **Stats** | Status bars and RPG attributes. See [Stats tab](#stats-tab) below. |

### Card tab

The **Card** tab holds the fields that describe you to the AI. Each has a live token estimate.

| Field | What to write | Sent to the AI |
| --- | --- | --- |
| **Summary** | An overview for the library and previews. | No |
| **Description** | Your general identity and role. | Every prompt |
| **Personality** | Temperament, behavior, speech habits. | Yes |
| **Backstory** | History, origin, relationships. | Yes |
| **Appearance** | Looks, clothing, visual details. | Yes |
| **Scenario** | Your default situation in roleplays. | Yes |
| **Example Dialogue** | Sample exchanges. Separate them with `<START>`. Use `{{user}}` for your persona and `{{char}}` for the other character. | Yes |

**Image Appearance Override**, under **Appearance**, works as it does for characters. See [Card tab](creating-and-editing-characters.md#card-tab). The text boxes support macros.

These features work the same as on characters, with the persona as the subject:

- The wand button above each field writes it for you. See [Write a card field with the wand](creating-and-editing-characters.md#write-a-card-field-with-the-wand).
- **Add Alternative Field** under each field gives selected chats a different version. The **Active in** list shows only chats that use this persona, and assignments pause when a chat selects another persona. See [Use an alternative field in selected chats](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats).
- **Version history** is on the **Metadata** tab. Before your first edit it reads `Previous persona states will appear here after the next edit.` **Reset** deletes every snapshot and sets the version to 1.0. See [Version history](creating-and-editing-characters.md#version-history).

### Stats tab

The **Stats** tab has two separate blocks. Both feed the HUD (the on-screen stat display) during chat.

- **Enable Persona Stats** turns on status bars. A fresh one starts with Satiety, Energy, Hygiene and Mood, each at 100 of 100. The **Persona Stats** agent adjusts them as the story goes.
- **Enable RPG Attributes** turns on Pools and Attributes. A fresh one starts with HP and MP at 100 of 100 and STR, DEX, CON, INT, WIS and CHA at 10. They are sent with the persona for combat and Game Mode, and for optional rolls. Agents do not update them.

A **Game Mode Icon** block sets your token picture in a Game Mode fight. See [Game Mode Icon](colors-and-stats.md#game-mode-icon). When a ruleset is installed, a **Ruleset sheets** block holds your starting build for it. See [Ruleset sheets](colors-and-stats.md#ruleset-sheets). The values you set are the starting defaults for new chats.

## Import and export personas

To import, click **Import** in the **Personas** panel. The **Import Persona** window takes `.marinara` and `.json` files, and several at once. A Marinara file restores full details, sprites and gallery structure. A generic JSON file from another tool is mapped field by field into a new persona. A name is required. Each file shows a success or failure mark.

To export, click **Export persona** in the editor, or use **Export** in selection mode. The **Export Persona** window offers two formats:

| Format | What you get |
| --- | --- |
| **Marinara Native** | All Marinara persona details, sprites and attached lorebooks. Use it to move a persona between Marinara installs. |
| **Compatible JSON** | Plain persona fields only, for other tools. |

A bulk export downloads one zip with one file per persona.

## Duplicate or delete a persona

To duplicate, click **Duplicate** on a row or **Duplicate persona** in the editor. The copy is named "{original name} (Copy)" and keeps all card fields, colors, stats and convo fields. No chat changes its persona.

To delete, click **Delete** on a row or **Delete persona** in the editor, then confirm. You cannot undo it. To delete many, click **Select**, tick the personas, and use **Delete** in the selection bar. If a deletion fails, those personas stay selected so you can try again.

## Add a persona as a character

**Add persona as character** in the editor header creates a new card in your characters. It copies the name, description, personality, scenario, backstory, appearance, tags, creator, version and avatar. The persona stays as it was. To edit the new card, see [Creating and Editing Characters](creating-and-editing-characters.md).

## Related guides

- [Choosing Your Persona in a Chat](choosing-your-persona.md)
- [Character Colors and RPG Stats](colors-and-stats.md)
- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Conversation Mode Profiles](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
