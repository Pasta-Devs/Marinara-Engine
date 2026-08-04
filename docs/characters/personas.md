# User Personas: Creating and Editing

This guide explains what a persona is, how to create and edit one, and how to import, export, duplicate, and delete personas. A persona is your own character card: the identity Marinara Engine uses to represent you in a chat.

## What a persona is

A persona is who you are in a chat. It has a name, a description, and other optional details. Marinara sends these details into every prompt so the AI knows who it is talking to.

You can make many personas. You keep them in the **Personas** panel. You pick one persona as your global default, called the **active persona**. You can also override the persona for a single chat. This guide covers making and editing personas. To learn how to choose which persona a chat uses, see [Choosing Your Persona in a Chat](choosing-your-persona.md).

### The {{user}} macro

A macro is a placeholder in your text that the app replaces with a real value before it sends the prompt. The **{{user}}** macro is replaced with the name of the persona the chat is using. That is the chat's own persona if you set one, otherwise your active persona. For example, if that persona is named Alex, then **{{user}}** becomes Alex in the prompt.

Sometimes a chat has no persona of its own and no persona is active. Only then does the AI call you by the generic name "User", and no persona details are sent. To learn how a chat picks its persona, see [Choosing Your Persona in a Chat](choosing-your-persona.md). To learn more about macros, see [Macros](../prompts/macros.md).

## The Personas panel

The **Personas** panel is your persona library. Open it from the person icon in the right sidebar top bar. It sits alongside the **Lorebooks**, **Presets**, **Connections**, and **Agents** buttons.

The panel gives you these controls:

- **Open Full Library** opens the responsive full-page Persona Library. It uses the same grid-and-preview layout as the Character Library, with persona descriptions, card sections, tags, token estimates, and active-persona badges.
- **New** creates a persona.
- **Import** opens the **Import Persona** window.
- **Select** turns on bulk-selection mode so you can act on many personas at once.
- The search box, with placeholder **Search personas**, matches name, description, comment, and tags.
- The sort dropdown offers **A-Z**, **Z-A**, **Newest**, **Oldest**, and **Tokens** (estimated prompt size).
- **New Folder** creates a folder to organize personas.
- Filter chips **All**, **Active**, and **Inactive** filter by whether a persona is the current active persona. A **Tags** chip expands the tag list.

Each row shows the persona's avatar, name, and a short description preview. The active persona shows a small check badge on its avatar. When you hover a row, you see row actions: **Set as active**, **Duplicate**, and **Delete**. Click a row to open that persona in the full-page **Persona Editor**.

If you have more personas than fit on one page, a **Load more** button appears at the bottom. When you have no personas yet, the panel shows a short "No personas yet" message.

### The active persona

At most one persona at a time can be the global default. This is the **active persona**. To set one, hover a persona row and click **Set as active**.

Setting a persona active turns off the active flag on every other persona first. So no more than one persona is ever active. New personas, duplicated personas, and imported personas are never active on their own. You must set the active persona yourself. It is also fine to have no active persona at all.

## Creating a persona

1. Open the **Personas** panel.
2. Click **New**. The **Create Persona** window opens.
3. Type a name in the **Name** field. This is the only required field.
4. Click **Create**.

The persona is created with an empty description. It opens right away in the full **Persona Editor** so you can fill in the rest. You cannot set other fields in the creation window. Everything else is edited afterward in the **Persona Editor**.

A brand-new persona is never made active on its own. Set it active yourself when you want to use it.

## The Persona Editor

Opening a persona replaces the chat area with the full-page **Persona Editor**. The header has:

- A **Back** arrow to close the editor.
- The avatar tile. Click it to upload a new avatar. If you have an image-generation connection set up, a wand **Generate avatar** button appears here too.
- The name field and a comment field (for a short note such as "Modern AU version").
- A **Save** button. It stays greyed out until you make a change.
- Header icon actions: **Export persona**, **Add persona as character**, **Duplicate persona**, and **Delete persona**.

If you try to leave with unsaved changes, a banner appears that says "You have unsaved changes. Close without saving?". It gives you **Keep editing**, **Discard & close**, and **Save & close**.

The editor body has a row of tabs, in this order: **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, and **Stats**.

### Metadata tab

The **Metadata** tab holds identity and library info:

- A **Persona ID** row with a **Copy** button. Most people never need this. It is useful for support requests.
- The avatar crop widget. Drag to reposition or zoom the round avatar crop.
- **Name**: your persona's display name. It is injected into prompts as your identity.
- **Creator**: who made this persona, for credit when you share it.
- **Phonetic name**: an optional pronunciation override. It is used only when your persona name is read aloud by text-to-speech (TTS). TTS is the app feature that speaks text.
- **Title / Comment**: a short private note shown under the name in the library.
- **Version**: a free-text version string for tracking your own changes. It defaults to **1.0**.
- **Tags**: free-text labels. Press Enter or click **Add** to add one. A **Remove All** button appears once you have tags. Tags are used for filtering in the **Personas** panel.
- **Creator Notes**: a private multi-line note. It is not sent to the AI.

The **Version history** panel sits below the **Version** field. The "Version history" section below explains how it works.

### Card tab

The **Card** tab is where you write the core persona fields. Each field is a large text box with a live estimated token count under it. A jump-links bar lets you scroll to each section.

- **Description**: your general identity and role. This is sent in every prompt so the AI knows who you are.
- **Personality**: your temperament, behavior, speech habits, and emotional patterns.
- **Backstory**: your history, origin, relationships, and formative events.
- **Appearance**: physical description, clothing, and visual details the model should remember.
- **Scenario**: your default situation or context for roleplays. Use it to establish where your persona starts.

These text boxes support macros. Quote characters you type are auto-formatted to match your app quote style.

### Convo tab

The **Convo** tab holds fields that apply in Conversation mode only. They are never sent in Roleplay or Game mode. They include **Convo Display Name**, **About Me**, and **Convo Behavior**. Because these are shared with characters, they have their own guide. See [Conversation Mode Profiles](../conversation/profiles.md).

### Lorebook tab

The **Lorebook** tab lets you attach lorebook entries to your persona. A lorebook is a set of world-info entries that add extra background when they are relevant. Entries linked to a persona can activate when that persona is in the chat. See [Lorebooks Overview](../lorebooks/overview.md).

### Sprites tab

The **Sprites** tab lets you upload standing character art for your persona. Sprites are used in Game Mode and Roleplay. It has category tabs for **Facial Expressions**, **Full-body**, and **Clips**. You can upload one image at a time or use **Upload Folder** to bulk-import a folder of PNG images. Because sprites are a shared system, see [Character Sprites](sprites.md) for the full details.

### Gallery tab

The **Gallery** tab keeps reference art and videos attached to your persona. It has two sub-tabs, **Images** and **Videos**. Use **Upload Persona Images** or **Upload Persona Videos** to add files. The **Videos** sub-tab also manages video-call clips for the Conversation-mode call feature. See [Character and Persona Galleries](galleries.md).

### Colors tab

The **Colors** tab sets how your persona looks in chat. Colors apply to your name, your dialogue, and your message bubble.

- **Extract Colors from Avatar** auto-picks colors from your avatar image. It stays greyed out with "Upload an avatar first" until you have an avatar.
- **Name Display Color** sets the color of your persona name. It accepts CSS gradients.
- **Dialogue Highlight Color** sets the color of text inside quotation marks.
- **Message Box Color** sets the background color of your persona's chat bubble.

Leave any of these blank to use the app's default theme colors. For a fuller walkthrough of colors and stats, see [Character Colors and RPG Stats](colors-and-stats.md).

### Stats tab

The **Stats** tab has two separate blocks. Both feed the on-screen stat display (HUD) during chat.

- **Enable Persona Stats** turns on status bars for needs like hunger, energy, and mood. When you enable it fresh, you get starter bars for Satiety, Energy, Hygiene, and Mood, each at 100 of 100. The **Persona Stats** agent adjusts these values as the story goes.
- **Enable RPG Attributes** turns on RPG-style Pools and Attributes. When you enable it fresh, you get starter HP and MP Pools at 100 out of 100 and starter Attributes STR, DEX, CON, INT, WIS, and CHA at 10. These values are sent with the persona card for Combat and Game Mode, and for optional rolls in Roleplay or Game Mode. Tracker agents do not update them.

The values you set here are the starting defaults for new chats. Persona Status Bars can update automatically when the Persona Stats agent is enabled; persona RPG Pools and Attributes are not agent-managed. For the full explanation, see [Character Colors and RPG Stats](colors-and-stats.md).

## Version history

Every time you save a change to a persona's card fields, Marinara saves a snapshot automatically. The **Version history** panel on the **Metadata** tab lists these saved versions with a timestamp.

For each saved version you can:

1. Click its title to open a compare view against the current persona.
2. Click **Rename this saved version** (pencil icon) to correct its card-version label without restoring it.
3. Click **Restore this version** to overwrite the current persona with that saved version. A confirmation dialog asks you to confirm.
4. Click **Delete this saved version** to remove that entry from history. This does not change the current persona.

Before your first edit, the panel says "Previous persona states will appear here after the next edit.".

Use **Reset** in the panel header to delete every saved persona snapshot and set the current card version to `0.0`. Marinara asks for confirmation because the deleted history cannot be recovered.

## Duplicating a persona

Click **Duplicate** on a persona row, or the **Duplicate persona** icon in the **Persona Editor** header. This makes a full copy of the persona, named "{original name} (Copy)". It copies all card fields, colors, stats, and convo fields. The copy is never made active on its own, even if the original was active.

## Deleting personas

To delete one persona, click the trash icon on its row or the **Delete persona** icon in the **Persona Editor** header. A confirmation dialog appears. Deleting a persona cannot be undone.

To delete many at once, click **Select** in the **Personas** panel and check the personas you want. Then use the selection bar to **Delete** them. If any deletion fails, the failed items stay selected so you can retry.

## Importing and exporting personas

### Import

Click **Import** in the **Personas** panel to open the **Import Persona** window. You can drag files in or click to browse. You can import many files at once. It accepts two file types:

- **.marinara** native package files. These restore full persona details, sprites, and gallery structure.
- **.json** files. A Marinara JSON export imports fully. A generic JSON file from another tool is mapped field by field into a new persona. The name is required. Other recognized fields are pulled in when present.

Each file shows a success or failure icon and a message. A summary line shows how many succeeded and how many failed.

### Export

You can export from the **Export persona** icon in the **Persona Editor**, or with the bulk **Export** action in the panel's selection mode. The **Export Persona** window offers two formats:

- **Native**: keeps all Marinara persona details, sprites, and attached lorebooks. Use this to move a persona between Marinara installs.
- **Compatible**: exports plain persona fields only. Use this for other tools that do not understand Marinara's format.

A bulk export downloads a single zip file with one file per selected persona.

## Add persona as character

The **Persona Editor** header has an **Add persona as character** icon. It creates a new character card in your Characters library. The new card copies your persona's name, description, personality, scenario, backstory, appearance, tags, creator, version, and avatar.

This is useful when you want to play a former persona as a character instead. It does not delete or change the original persona. To learn about editing characters, see [Creating and Editing Characters](creating-and-editing-characters.md).

## Related guides

- [Choosing Your Persona in a Chat](choosing-your-persona.md)
- [Character Colors and RPG Stats](colors-and-stats.md)
- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Conversation Mode Profiles](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
