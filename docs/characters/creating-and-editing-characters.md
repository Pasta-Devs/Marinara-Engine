# Creating and Editing Characters

This guide shows you how to make a character in Marinara Engine. It also shows how to use the Character Editor to write, save, and manage card versions. It covers the Metadata, Card, and Advanced tabs, avatars, and saved version history.

## What a character card is

A character card is the file that defines an AI character. It holds who they are, how they talk, what they look like, and how a chat with them starts. You write these details in the Character Editor. You can build a card from scratch, import one from another app, or export yours to share.

Most of the writing you do lands in a few text fields. The AI reads those fields every time it replies, so clear, specific writing gives you a more consistent character.

## Creating a character

1. Open the **Characters** panel from the sidebar.
2. Click **New** (the plus icon). The **Create Character** window opens.
3. Click the round avatar circle to upload a picture. This step is optional.
4. Type a name in the **Name \*** field. A name is required.
5. Click **Create**.

The new card is saved with empty fields. The full Character Editor then opens so you can fill in the rest. You can also start with **Import** instead of **New** if you already have a card file. See [Importing and Exporting Character Cards](import-export.md).

## The Character Editor at a glance

The Character Editor replaces the chat area with a full-page workspace. The header runs across the top and holds the parts you use most.

At the top left you have the **Back** arrow, the avatar tile, a name field, and a title or comment field. The comment field is for a short label like `Modern AU version`. Below them is a small line showing the creator and version.

At the top right you have these buttons:

- **Save**. This button is off until you make a change. Its label shows the current state: **Uploading…**, **Embedding…**, or **Saving…**.
- The **Favorite** star, which marks the card as a favorite.
- **Export character**.
- **Import character as persona**, which copies this card into a new user persona.
- **Duplicate character**.
- **Delete character**.

If you try to leave with unsaved work, a banner reads `You have unsaved changes. Close without saving?` It gives you **Keep editing**, **Discard & close**, and **Save & close**.

The editor is split into tabs. On a wide screen the tabs run down the left side. On a narrow screen they become a scrollable strip across the top. The tabs, in order, are **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Stats**, and **Advanced**.

This guide covers **Metadata**, **Card**, and **Advanced**, plus avatars and version history. The other tabs have their own guides:

- **Convo**: [Conversation Mode Profiles](../conversation/profiles.md).
- **Lorebook**: [Linking Lorebooks to Characters](../lorebooks/linking-to-characters.md).
- **Sprites**: [Character Sprites](sprites.md).
- **Gallery**: [Character and Persona Galleries](galleries.md).
- **Colors** and **Stats**: [Character Colors and RPG Stats](colors-and-stats.md).

## Metadata tab

The **Metadata** tab holds identity and organization details. These help you sort, share, and track a card, but most of them are not sent to the AI.

- **Character ID**. A read-only value shown only after the card is saved. Click **Copy** to copy it.
- **Name**. The display name. It is used as `{{char}}` in prompts.
- **Phonetic name**. An optional spelling used only to fix pronunciation for text-to-speech. Leave it empty to use the normal name.
- **Creator**. The person who made the card, for credit when you share it.
- **Version**. A version number you set, such as `1.0`.
- **Talkativeness**. A slider from 0 to 100 percent. It sets how often this character speaks in group chats. The default is 50 percent.
- **Tags**. Type one or more tags in the add-tag field and press Enter or click **Add**. You can add several at once separated by commas. Remove one tag with its X, or clear them all with **Remove All**.
- **Creator Notes**. Private notes that are never sent to the AI. They still show as a summary in your library.

The **Version history** panel also lives on this tab. It is covered in the Saving and version history section below.

## Card tab

The **Card** tab is the main writing workspace. It holds the fields the AI reads to play the character. Jump links at the top let you skip to any section. Each field has a live character counter.

- **Description**. The character's general identity and role. This is sent in every prompt.
- **Personality**. A short summary of temperament, speech habits, and behavior patterns.
- **Backstory**. History, origin, and important relationships.
- **Appearance**. Physical description, clothing, and visual details. Marinara also uses this text to seed an AI avatar prompt.
- **Scenario**. The default setting for new chats with this character.

The **Dialogue & Greetings** section sets how a chat opens and how the character sounds:

- **First Message**. The opening message shown when a new chat starts.
- **Alternate Greetings**. Extra opening messages. When you start a chat you can pick which one to use. Use the up and down controls to reorder them, and the X to remove one.
- **Example Dialogue**. Sample exchanges that teach the character's voice. Use `<START>` to separate exchanges. Use `{{user}}` and `{{char}}` as placeholders.

A short Example Dialogue entry looks like this:

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Adding an avatar

An avatar is the picture shown for the character in chat and in your library. You can upload one, adjust its framing, or generate one with AI.

### Upload a picture

1. Click the avatar tile in the editor header.
2. Pick an image file. The new picture appears right away.

Once a character has an avatar, an avatar crop tool appears on the **Metadata** tab. Use it to reposition or zoom the picture inside its circle without uploading the file again. The crop tool also has a control to remove the avatar.

### Generate an avatar with AI

The AI avatar option appears only when you have at least one image-generation connection set up. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Hover the avatar tile and click the small **Generate avatar** wand button.
2. The **Generate Character Avatar** window opens.
3. Pick an **Image Generation Connection**.
4. Review or edit the **Avatar Prompt**. It is pre-filled from your Appearance text. If Appearance is empty, it uses Description, then Personality.
5. If the card already has an avatar, you can check **Use current avatar as a reference**.
6. Click **Generate**. To try again, click **Regenerate**.
7. When you like the result, click **Use Avatar**.

The picture size comes from the **Portraits** image-size setting in the image-generation settings, which defaults to 1024 by 1024. If you have turned on **Expose media prompts before sending**, a prompt-review step appears before each request.

## Advanced tab

The **Advanced** tab holds prompt controls for advanced users. You can leave all of these empty for a normal character.

These character-authored prompt controls apply in Conversation, Roleplay, and Game modes. A selected Conversation or Game preset changes the surrounding prompt, but does not disable the character's Post-History Instructions or Depth Prompt.

- **System Prompt**. Character-specific instructions added through the active preset's character block, Conversation character context, or Game character/GM card as appropriate. This does not replace the chat's main system prompt.
- **Post-History Instructions**. Text placed near the end of the prompt, close to generation. A common use is a short reminder like "Stay in character".
- **Depth Prompt**. Text injected at a chosen point in the chat history. **Depth** sets how many messages back it goes. Depth 0 is right after the latest message, and depth 4 is four messages back. The default depth is 4. **Role** sets whether the text is inserted as **System**, **User**, or **Assistant**. The default role is System.

The **Regex Scripts** section on this tab holds find-and-replace scripts scoped to this one character. Those use the shared regex engine. See [Regex Scripts](../extending/regex-scripts.md) to learn how they work.

## Saving and version history

Click **Save** in the header to store your changes. The button stays off until you edit something, then turns on.

Every save can add a snapshot to **Version history**, found on the **Metadata** tab. Before your first extra edit the panel reads `Previous card states will appear here after the next edit.` A counter shows how many snapshots you have saved.

To compare a saved version with your current card:

1. Open the **Metadata** tab.
2. In **Version history**, click a saved version.
3. A **Compare** window opens. It lists fields such as Name, Description, Personality, Scenario, First Message, and Example Dialogue side by side. It marks each field that changed.

To go back to an older version:

1. Open the **Compare** window for the version you want, or click its restore icon in the list.
2. Click **Restore this version**, then confirm.

Restoring replaces your current card with that snapshot. It does not add a new history entry. Use the pencil icon to correct a saved snapshot's card-version label without restoring it. You can also delete a saved snapshot from the list; deleting one does not change your current card.

Use **Reset** in the **Version history** header when you want to restart the card's versioning. After confirmation, Marinara deletes every saved snapshot and sets the current card version to `0.0`. This cannot be undone.

## Reviewing agent-proposed card updates

During a Roleplay chat, an optional agent can suggest small edits to card fields based on what happened in the scene. When it does, a **Review Character Card Updates** window appears so you stay in control. You choose what to keep.

For each proposed edit you can:

- **Approve**. Apply the change. This also bumps the version number and adds a version-history entry.
- **Regenerate**. Ask the agent to try again.
- **Reject**. Dismiss the proposal.

If the underlying text changed since the proposal was made, the app warns you before it lets you force the edit. To learn how to turn these agents on or off, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## A note on Professor Mari

**Professor Mari** is a built-in assistant character that ships with Marinara. You cannot delete her. If you try, the app blocks it and tells you she is a built-in character. To learn what she does, see [Professor Mari, Your In-App Assistant](../home/professor-mari.md).

## Related guides

- [User Personas: Creating and Editing](personas.md)
- [Character Sprites](sprites.md)
- [Character and Persona Galleries](galleries.md)
- [Importing and Exporting Character Cards](import-export.md)
- [Character Colors and RPG Stats](colors-and-stats.md)
- [Conversation Mode Profiles](../conversation/profiles.md)
- [Linking Lorebooks to Characters](../lorebooks/linking-to-characters.md)
