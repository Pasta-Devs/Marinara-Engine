# Creating and Editing Characters

A character card is the file that defines an AI character: who they are, how they talk, what they look like and how a chat with them starts. You write it in the Character Editor. The AI reads the card fields every time it replies, so clear, specific writing gives you a more consistent character.

## Create a character

1. Click **Characters** in the top navigation bar. If you do not see it, open **More** first.
2. Click **New** (the plus icon). The **Create Character** window opens.
3. Type a name in **Name \***. A name is required.
4. Click the round avatar circle to add a picture. This step is optional.
5. Click **Create**.

The card is saved with empty fields, and the Character Editor opens.

6. Open the **Card** tab and write the **Description**: who the character is. Add a **First Message** under **Dialogue & Greetings**, which is how a Roleplay chat opens.
7. Click **Save** in the header.

If you already have a card file, click **Import** instead. See [Importing and Exporting Character Cards](import-export.md).

### Start a chat with your character

Pick the character when you start a chat. See [Roleplay Mode: Getting Started](../roleplay/getting-started.md) or [Conversation Mode: Getting Started](../conversation/getting-started.md).

## The Character Editor at a glance

The Character Editor replaces the chat area with a full-page workspace. On a wide screen the tabs run down the left side. On a narrow screen they become a scrollable strip across the top. The tabs, in order, are **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Voice**, **Stats** and **Advanced**. Each tab jumps to its section of one long form, so you can also scroll.

The header holds the parts you use most:

- The **Back** arrow, the avatar tile, a name field, and a title or comment field for a short label such as `Modern AU version`. A line below shows the creator and version.
- **Save**. It is off until you change something. While it works, it reads **Uploading…** (an avatar is uploading), **Embedding…** (a lorebook is being added to the card) or **Saving…**.
- The **Favorite** star.
- **Export character**. See [Importing and Exporting Character Cards](import-export.md).
- **Import character as persona**, which copies this card into a new persona. See [Personas](personas.md).
- **Duplicate character**.
- **Delete character**.

Leaving the editor saves your changes first. If saving fails, the editor stays open with your draft so you can try again.

Tabs that have their own guide:

| Tab | Guide |
| --- | --- |
| **Onboarding** | [Interactive Onboarding](interactive-onboarding.md) |
| **Convo** | [Conversation Mode Profiles](../conversation/profiles.md) |
| **Lorebook** | [Linking Lorebooks to Characters](../lorebooks/linking-to-characters.md) |
| **Sprites** | [Character Sprites](sprites.md) |
| **Gallery** | [Character and Persona Galleries](galleries.md) |
| **Colors** and **Stats** | [Character Colors and RPG Stats](colors-and-stats.md) |

The sections below cover **Metadata**, **Card**, **Voice** and **Advanced**, plus avatars and version history.

## Metadata tab

The **Metadata** tab holds identity and organization details. They help you sort, share and track a card. Most are not sent to the AI.

- **Character ID**. Read-only. It appears after the card is saved. Click **Copy** to copy it.
- **Name**. The display name. It is `{{char}}` in prompts, a placeholder that Marinara replaces with the character's name.
- **Creator**. Who made the card, for credit when you share it.
- **Version**. A version number you set, such as `1.0`. The **Automatic versioning** switch next to it keeps earlier versions and raises this number when the card changes. Version history only saves snapshots while this switch is on.
- **Talkativeness**. A slider from 0 to 100 percent. It sets how often this character speaks in group chats. The default is 50 percent.
- **Tags**. Type tags in the add-tag field and press <kbd>Enter</kbd> or click **Add**. Separate several tags with commas. The field suggests tags your library already uses, most used first. Remove one tag with its X, or all of them with **Remove All**.
- **Creator Notes**. Private notes that are never sent to the AI.

**Split description into fields** is a button under **Version**. It moves labelled text (personality, appearance, backstory, scenario, rules, example dialogue) out of **Description** into their own fields. You see a short summary first, and applying it saves the card as a new version. The button is off while **Description** is empty.

The **Version history** panel is also on this tab. See [Version history](#version-history).

## Card tab

The **Card** tab is the main writing workspace. Jump links at the top skip to any section, and each field has a live character counter.

| Field | What to write | Sent to the AI |
| --- | --- | --- |
| **Summary** | A short overview for your library and card preview. | No |
| **Description** | The character's general identity and role. | Every prompt |
| **Personality** | Temperament, speech habits, behavior patterns. | Yes |
| **Backstory** | History, origin, important relationships. | Yes |
| **Appearance** | Looks, clothing, visual details. Also seeds an AI avatar prompt. | Yes |
| **Scenario** | The default setting for new chats with this character. | Yes |

**Image Appearance Override** sits under **Appearance** and is off by default. Turn it on to show a second box for short image tags, such as a LoRA trigger word (a keyword that switches on a custom image style). While it is on and filled, image prompts use those tags exactly as written, with **Appearance** kept as background. An AI avatar prompt is seeded from it too. The narrator always sees the full **Appearance** text.

The **Dialogue & Greetings** section sets how a chat opens and how the character sounds:

- **First Message**. The opening message of a new Roleplay chat. Conversation and Game chats do not start with a greeting.
- **Alternate Greetings**. Extra opening messages. When you start a Roleplay chat you can pick which one to use. Use the up and down controls to reorder them and the X to remove one.
- **Example Dialogue**. Sample exchanges that teach the character's voice. Use `<START>` to separate exchanges and `{{user}}` and `{{char}}` as placeholders.

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

Greetings and example messages can show images from the character's Gallery. See [Reuse a gallery image in messages and greetings](galleries.md#reuse-a-gallery-image-in-messages-and-greetings). When greetings show images from other websites, **Save images locally** keeps a copy in the Gallery. See [Save web images from greetings](galleries.md#save-web-images-from-greetings).

### Write a card field with the wand

**Summary**, **Description**, **Personality**, **Backstory**, **Appearance**, **Scenario**, **Example Dialogue**, **First Message** and each **Alternate Greeting** have an icon-only wand button above the field. Its tooltip names the field it writes.

Before you start: set up a working text connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Write any ideas you want to keep in the field, such as `smart, scientist, handsome`, or leave it empty.
2. Fill in any other card fields you want the AI to use as reference. You do not need to save first.
3. Click the field's wand. Marinara asks for 100–300 words for that field, using your text as the starting details. Example Dialogue asks for sample exchanges. **First Message** and each **Alternate Greeting** ask for one opening message that leaves your reply open.
4. Edit the result, then click **Save**.

The wand uses your default agent text connection, or your default text connection if there is none. A configured agent fallback connection still applies.

The wand replaces only the chosen field in your unsaved draft. If generation fails, your text stays. If you edit that field while waiting, or switch to another card, a late result does not overwrite your work. You do not need Professor Mari to use the wand.

## Add an avatar

An avatar is the picture shown for the character in chat and in your library.

### Upload a picture

1. Click the avatar tile in the editor header.
2. Pick an image file. The new picture appears right away.

Once a character has an avatar, an avatar crop tool appears on the **Metadata** tab. Use it to move or zoom the picture inside its circle, or to remove the avatar.

### Generate an avatar with AI

Before you start: add an image-generation connection. The AI avatar button appears only when you have one. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Hover the avatar tile and click the wand button. The **Generate Character Avatar** window opens.
2. Pick an **Image Generation Connection**.
3. Check or edit the **Avatar Prompt**. It starts from **Image Appearance Override** when that is on and filled. Otherwise it uses **Appearance**, then **Description**, then **Personality**, whichever has text first.
4. If the card already has an avatar, you can tick **Use current avatar as a reference**.
5. Click **Generate**. To try again, click **Regenerate**.
6. Click **Use Avatar** when you like the result.

The picture size comes from the **Portraits** image size in the image-generation settings. It defaults to 1024 by 1024. If **Expose media prompts before sending** is on, a prompt review step appears before each request.

## Voice tab

The **Voice** tab sets how the character sounds when Text to Speech reads it aloud.

- **Voice**. The voice for this character. A change saves right away, without **Save**. It is the same setting as this character's row in **Connections → Text to Speech**. Leave it empty to use the default voice. When a card with a matching name has a voice, such as the original of an AU copy, the empty field names that voice, because this card uses it too.
- **Preview**. Plays a short line in that voice. The line says the character's name, or the **Phonetic name** when one is set.
- **Phonetic name**. An optional spelling used only to fix pronunciation. It is part of the card, so click **Save** to keep it.

If Text to Speech is off, or every character shares one voice, a short note replaces the **Voice** field. With one shared voice, the note offers **Use a voice per character**. **Open Text to Speech settings** opens Connections. See [Text to Speech (TTS) Setup](../media/tts-setup.md).

## Advanced tab

The **Advanced** tab holds prompt controls. Leave them empty for a normal character. They apply in Conversation, Roleplay and Game modes. A Conversation or Game preset changes the surrounding prompt but does not turn off the character's Post-History Instructions or Depth Prompt.

- **System Prompt**. Character-specific instructions added through the active preset's character block, Conversation character context, or Game character card. It does not replace the chat's main system prompt.
- **Post-History Instructions**. Text placed after the chat history, right before the AI writes, such as "Stay in character".
- **Depth Prompt**. Text injected into the chat history. **Depth** is how many messages back: 0 is right after the latest message. The default is 4. **Role** is **System**, **User** or **Assistant**. The default is System.

The **Regex Scripts** section holds find-and-replace scripts for this one character. See [Regex Scripts](../extending/regex-scripts.md).

## Use an alternative field in selected chats

An alternative field gives the same character a different description, appearance, backstory or other detail in chosen chats, while everyone else keeps the original. Each of the seven card fields has **Add Alternative Field** below it.

1. Click **Add Alternative Field** under the field you want to vary. Marinara copies the field's text into a new alternative.
2. Edit the alternative. It has its own wand, which uses the alternative's text as the starting details and does not change the original field.
3. Open **Active in 0 chats** and tick the chats that should use it. Only chats that include this character are listed.
4. Click **Save**.

Rules:

- A chat can use only one alternative per field. Ticking a chat in another alternative moves it there.
- With no chats ticked, the alternative stays inactive for later.
- An empty alternative clears that field in its chats.
- Chat-specific scenario and image appearance overrides still win.
- **Summary** alternatives stay metadata and are not sent to the AI.
- If the character leaves a chat, its assignment pauses and resumes when you add the character again.
- Card export, import, duplication and conversion between characters and personas keep the alternative text but clear the chat ticks. Whole-profile backups keep the ticks.

To remove an alternative, click its trash button, confirm **Delete**, then **Save**. Its chats go back to the original field. The original field is never deleted with an alternative.

## Version history

While **Automatic versioning** is on, each save can add a snapshot to **Version history** on the **Metadata** tab. Until then it reads `Previous card states will appear here after the next edit.` A counter shows how many snapshots are saved.

To compare a saved version with your current card:

1. Open the **Metadata** tab.
2. In **Version history**, click a saved version. A comparison window lists the card fields side by side and marks each one that changed.

To go back to an older version:

1. Open the comparison window for that version, or click its restore icon in the list.
2. Click **Restore this version**, then confirm.

Marinara saves your current card to version history first (unless it already matches that version), so you can switch back later.

Other controls in the panel:

- The pencil icon changes a snapshot's card version number without restoring it.
- The trash icon deletes a snapshot. Your current card does not change.
- **Reset** deletes every saved snapshot and sets the card version to 1.0. Marinara asks you to confirm, and you cannot undo it. **Reset** is off while you have unsaved edits.

## Review card updates from an agent

In a Roleplay chat, an optional agent can suggest small edits to card fields based on the scene. A **Review Character Card Updates** window opens so you decide what to keep. For each proposed edit:

- **Approve** applies it, raises the version number and adds a version-history entry.
- **Regenerate** asks the agent to try again.
- **Reject** dismisses it.

If the text changed since the proposal was made, the app warns you before it lets you force the edit. To turn these agents on or off, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## If it did not work

- **The wand does nothing or fails.** Check that you have a working text connection. Your draft is never overwritten on failure.
- **No AI avatar button.** Add an image-generation connection first.
- **Professor Mari cannot be deleted.** She is a built-in character that Marinara resets on every start. See [Professor Mari, Your In-App Assistant](../home/professor-mari.md).

## Related guides

- [Personas](personas.md)
- [Importing and Exporting Character Cards](import-export.md)
- [Organizing Your Character Library](library-organization.md)
