# Group Chats and Group Conversations

This guide covers group chats in Marinara Engine, which are chats that hold two or more characters at once. It explains how to create a group chat and how to add or remove members. It also shows how to control who speaks in Conversation mode and in Roleplay mode.

## What a group chat is

A group chat is any chat that has two or more characters in it. There is no separate "group chat" button. A normal chat simply becomes a group chat as soon as you add a second character.

Group chats work in two modes: **Conversation** and **Roleplay**. Game Mode has its own separate party system and is not covered here.

The word "group" is used for a few different things in Marinara. A group chat means many characters in one chat. That is different from **Folders**, which are saved lists of characters you can reuse. It is also different from **Chat Branches**, which are alternate versions of the same chat. This guide is only about group chats.

## Creating a group chat

You make a group chat with the same New Chat wizard you use for any chat. You just pick more than one character.

1. In the sidebar, click the new chat button for the mode you want. The button says **New Conversation** or **New Roleplay**.
2. Go to the wizard step titled **Persona & Characters**.
3. Use the **Search characters...** box to find a character, then click their avatar or name to add them.
4. Add a second character the same way. You can add as many as you want.
5. Finish the wizard to open the chat.

Once you add a second character, the label above the picker updates. In Conversation mode it reads **Group Chat** followed by the member count. In Roleplay mode it reads **Characters** followed by the count.

There is no fixed limit on the number of characters. In practice, more characters means a longer prompt and a higher cost per reply. Add only the characters the scene needs.

If you do not rename the chat, Marinara names it after the characters, joined with commas. An example is "Alice, Bob, Carol".

### Adding many characters at once with Folders

If you have made a Folder of characters, you can add the whole Folder in one step. Folders are saved character rosters you build in the **Characters** panel. They are the fastest way to set up a group chat you plan to reuse.

1. In the **Persona & Characters** step, open the **Add from Folder** dropdown.
2. Pick a Folder from the list.
3. Click **Add** next to the dropdown.

Every character in that Folder who is not already in the chat gets added. The **Add from Folder** control only appears if you have at least one Folder. To learn how to build and manage Folders, see the guide below on organizing your character library.

You can also click the **Random** row (labeled **Dice pick**) to add one random character who is not already in the chat.

## Managing members after creation

You add, remove, and reorder characters from the **Chat Settings** drawer. Open it with the gear icon in the chat header. The gear tooltip reads **Chat Settings**.

Inside the drawer, find the **Characters** section. It shows a member count and the help text "Characters in this chat. Each character has their own personality that the AI roleplays as." Each member row has an avatar, the character name, a drag handle, an eye icon, and a trash icon.

- To add one more character, click **Add Character** and search for them.
- To add a whole Folder, click **Add from Folder** and pick one.
- To remove a character, click the trash icon. Its tooltip reads **Remove from chat**.
- To reorder characters, drag a member up or down using the drag handle. Its tooltip reads **Drag to reorder**.

Member order matters. In the **Sequential** response order (explained below), characters reply in the order they appear here. Drag a member to change when they speak.

The **Characters** section does not appear in Game Mode. Game Mode manages its party in a different place.

### Turning a member off without removing them

Sometimes you want a character to sit out for a while but stay in the roster. Use the eye icon on their member row.

- Click the eye to disable a character. The tooltip changes to **Disable in chat** and the eye shows a slash.
- Click it again to bring them back. The tooltip reads **Enable in chat**.

A disabled character stays in the member list but is left out of every reply. Their character card is not sent to the model, and they cannot be picked to speak.

There is one safety fallback. If you disable every character in the chat, Marinara treats all of them as active again. This prevents a reply with zero characters.

This on and off state is saved per chat. It does not change the character anywhere else in the app.

## Who speaks: Roleplay mode

In Roleplay mode, a group chat gets a **Group Chat** section in **Chat Settings**. It appears only when the chat has two or more characters. Use it to control how the characters reply.

### Merged (Narrator) or Individual

The **Mode** setting is a two-button toggle.

- **Merged (Narrator)** is the default. One reply voices every character, plus any narration, all at once.
- **Individual** makes each character generate their own separate reply.

### Color Dialogues (Merged only)

When **Mode** is **Merged (Narrator)**, you can turn on **Color Dialogues**. It is off by default. When on, each character's lines are shown in that character's own colors. Those colors come from the **Colors** tab of the Character Editor. That tab sets the name color, dialogue color, and box color. See the character editing guide for how to set those.

### Response Order (Individual only)

When **Mode** is **Individual**, a **Response Order** setting appears. It is a three-button toggle.

- **Sequential** is the default. Every character replies in turn, in the order they appear in the **Characters** list. Reorder the members to change the turn order.
- **Smart** uses a short hidden AI call to decide which character or characters should reply next. It reads the recent messages and each character's details, and usually picks one speaker. If you write an at-mention like `@Alice` in your message, that overrides its choice.
- **Manual** stops any automatic reply. You choose exactly who replies using the **Trigger Response** picker in the message bar.

With **Smart** order, the AI can line up more than one character. Only the first one replies right away. To pick who speaks next, use the **Trigger Response** picker in the message bar. You can also send an empty message to generate the next queued character.

Two more toggles appear in **Individual** mode:

- **Add Turn To Prompt** is on by default. It adds a short instruction naming which character should reply this turn.
- **Name Prefix History** is off by default. It changes how past messages are labeled with speaker names before they are sent to the model. Leave it off unless a character keeps mixing up who said what.

### Scenario Override

The **Scenario Override** box lets you give the whole group one shared scenario. Type any text into it and that text replaces each character's own scenario in the prompt. Leave it empty and each character keeps their own scenario as normal.

There is no on and off switch. Typing text turns it on. Clearing the text turns it off. To edit in a bigger window, click the expand icon (tooltip **Expand editor**). The larger editor is titled **Group Scenario Override**.

One note for reuse: the **Scenario Override** text is tied to this one chat. It is left out of settings profiles, so it will not follow a profile to a new chat.

### Settings and defaults (Roleplay)

| Setting | Where | Default |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | Group Chat section | Merged (Narrator) |
| **Color Dialogues** | Group Chat section, Merged mode | Off |
| **Response Order** (Sequential / Smart / Manual) | Group Chat section, Individual mode | Sequential |
| **Add Turn To Prompt** | Group Chat section, Individual mode | On |
| **Name Prefix History** | Group Chat section, Individual mode | Off |
| **Scenario Override** | Group Chat section | Empty (off) |

Most of these settings are saved into settings profiles, so you can reuse them. The one exception is **Scenario Override**, which stays with the single chat.

## Who speaks: Conversation mode

Conversation mode supports the same group chats, but it does not show the **Group Chat** section. Its controls live in the **Autonomous Messaging** section of **Chat Settings** instead.

By default, a group conversation acts like Merged mode. One reply can voice several characters at once, and their lines are colored by speaker automatically. There is no separate color toggle to set in Conversation mode.

### Reply When Mentioned

Turn on **Reply When Mentioned** to switch the chat to one character at a time. When it is on, characters only reply when you name them or trigger them by hand. The toggle description reads "Characters wait for direct mentions or manual response triggers."

You name a character with an at-mention. Type `@` followed by the character name in the message box, and an autocomplete list appears. The characters you mention are the ones who reply.

To pick a speaker without typing a mention, use the **Trigger Response** picker.

- On desktop, it is a button next to Send.
- On mobile, it is under the **Trigger Response** heading in the tools tray you open from the message bar.

The button tooltip reads "Trigger character response".

### Character Exchanges

Turn on **Character Exchanges** to let characters talk to each other on their own. It is off by default. The description reads "Characters chat with each other in group chats."

When it is on, the characters can reply to each other while you are away, not only to you. This runs only while Marinara is open in your browser. If you close the app, the exchanges stop. It also shares the same daily message limit that autonomous messages use.

## Turn handling at a glance

| Mode and setting | What happens | How you steer it |
|---|---|---|
| Roleplay, Merged | One reply voices all characters | Always all characters together |
| Roleplay, Individual, Sequential | Each character replies in member order | Drag to reorder members |
| Roleplay, Individual, Smart | AI picks the next speaker or speakers | `@Name` mention overrides the pick |
| Roleplay, Individual, Manual | Nobody replies on their own | Use the **Trigger Response** picker |
| Conversation, default | One reply can voice several characters | `@Name` mention targets a character |
| Conversation, Reply When Mentioned on | Nobody replies without a mention or trigger | `@Name` mention or **Trigger Response** picker |
| Conversation, Character Exchanges on | Characters can also message each other | Turn it off to stop |

## Related guides

- [Organizing Your Character Library](../characters/library-organization.md)
- [Conversation Mode: Getting Started](../conversation/getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
