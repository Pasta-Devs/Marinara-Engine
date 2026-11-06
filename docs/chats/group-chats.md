# Group Chats and Group Conversations

A group chat is any Conversation or Roleplay chat with two or more characters. This guide shows how to create one, manage its members and choose who speaks. Game Mode has its own party system and is not covered here.

There is no separate "group chat" button. A chat becomes a group chat when you add a second character. A group chat is not a **Folder** (a saved list of characters you can reuse) and not a **Chat Branch** (an alternate version of one chat).

## Create a group chat

1. In the **Chats** panel, click the **+** button for the mode you want (**New Conversation** or **New Roleplay**).
2. A setup wizard opens. In the step **Persona & Characters**, type in **Search characters...** and click a character to add it.
3. Add a second character the same way.
4. Finish the wizard to open the chat.

The label above the picker changes. In Conversation it reads **Group Chat** and the member count. In Roleplay it reads **Characters** and the count. If you do not rename the chat, Marinara names it after the characters, such as "Alice, Bob, Carol".

There is no fixed limit on characters. More characters mean a longer prompt and a higher cost per reply, so add only the characters the scene needs.

To add a whole Folder at once, open **Add from Folder** in the same step, pick a Folder, and click **Add**. Characters already in the chat are skipped. The control appears only if you have at least one Folder. See [Organizing Your Character Library](../characters/library-organization.md). The **Random** row (labeled **Dice pick**) adds one random character who is not already in the chat.

## Manage members

Open **Chat Settings** and find the **Characters** section. It is not in Game Mode. Each member row has an avatar, a name, a drag handle, an eye icon and a trash icon.

| To do this | Do this |
| --- | --- |
| Add a character | Click **Add Character** and search. |
| Add a Folder | Click **Add Character**, then **Add all** on the folder row. |
| Change several at once | Click a member's name. The same picker opens. |
| Remove a character | Click the trash icon (**Remove from chat**). |
| Reorder | Drag the handle (**Drag to reorder**). In **Sequential** order, characters reply in this order. |
| Turn off for a while | Click the eye (**Disable in chat**). Click again to turn on (**Enable in chat**). |

A disabled character stays in the list but is left out of every reply. Their card is not sent to the model and they cannot be picked to speak. If you disable every character, Marinara treats all of them as active so a reply is never empty. This is saved per chat and changes nothing elsewhere. In a Merged Roleplay group, [Automate active characters](#automate-active-characters-merged-only) can set it for you.

## Choose who speaks

Open **Chat Settings → Group Chat**. The section appears only when the chat has two or more characters. Both modes use the same **Mode** toggle.

- One reply voices every character. It is **Merged (Narrator)** in Roleplay and **Grouped** in Conversation. This is the default. In Roleplay, the narrator is a voice that describes the scene, and it is part of the same reply.
- **Individual** gives each character their own reply.

In Conversation, switching to **Individual** shows a warning, **Individual replies can use many tokens**. Each responding character uses a separate model request, and large groups with Autonomous Messaging use tokens quickly.

### Automate active characters (Roleplay, Merged only)

This setting turns characters on and off for you in a large cast. See [Automate active characters](#automate-active-characters-merged-only) at the end of this guide.

### Color Dialogues (Roleplay, Merged only)

**Color Dialogues** is off by default. When on, each character's lines use that character's own colors from the **Colors** tab of the Character Editor. In a Conversation group, lines are colored by speaker automatically and there is no toggle.

### Response Order (Individual only)

When **Mode** is **Individual**, **Response Order** appears. **Sequential** is the default.

| Order | What happens |
| --- | --- |
| **Sequential** | Characters reply in turn, in the **Characters** list order. In Conversation, characters who are offline are skipped. |
| **Smart** | A short hidden model call picks who replies next, usually one character. An `@Alice` mention in your message overrides it. In Conversation it uses the conversation, schedule status and talkativeness. |
| **Manual** | Nobody replies on their own. In Roleplay, use the **Trigger Response** picker. In Conversation, `@mention` one or more characters or use the picker. |

With **Smart** order, the model can line up several characters. Only the first replies right away. Use the **Trigger Response** picker, or send an empty message, to generate the next queued character.

If you chose a [Decision model](../connections/decision-models.md), you can turn on **Also use it to pick who speaks in Smart response order** under it. Smart order then asks for a yes-or-no score for each candidate.

- The questions share the last five messages and a roster with each candidate's name, status, activity, talkativeness and a short personality excerpt. A hosted service receives that roster too. See [What the model sees](../connections/decision-models.md#what-the-model-sees).
- Speed and cost depend on the model and the candidate count.
- In Roleplay, Marinara picks the most likely speaker. In Conversation, everyone with a reason replies, most likely first. The character who just spoke waits if someone else has a reason to answer.
- If the Decision model gives no answer, Smart order makes its usual model call.

In Roleplay **Individual** mode with **Smart** or **Manual** order, the picker's first option is **Smart**, marked with a people icon. It asks the model to choose the next speaker for that one reply. Your saved order stays unchanged.

### Trigger a reply by hand

Use the **Trigger Response** picker to choose a speaker. On a computer it is a button beside **Send**, labeled **Trigger character response**. On a phone it is under **Trigger Response** in the tools tray you open from the message bar. To name a speaker in text, type `@` and the character name. An autocomplete list appears.

### More Individual settings

- **Add Turn To Prompt** is on by default. It adds a short instruction naming which character should reply.
- **Name Prefix History** (Roleplay only) is off by default. It changes how past messages are labeled with speaker names. Leave it off unless a character keeps mixing up who said what.

### Scenario Override (Roleplay)

**Scenario Override** gives the whole group one shared scenario. Text in the box replaces each character's own scenario in the prompt. An empty box leaves each scenario as it is. There is no switch. To edit in a larger window, click the expand icon (**Expand editor**, titled **Group Scenario Override**). This text stays with one chat and is left out of settings profiles.

### Character Exchanges (Conversation)

Turn on **Character Exchanges** in **Chat Settings → Autonomous Messaging** to let characters talk to each other while you are away. It is off by default and appears only in a group chat. It runs only while Marinara is open in your browser, and it shares the daily message limit of autonomous messages. It works with or without character schedules. In an **Individual** group, exchanges and `@mention` replies never use the group's last check-in of the day.

## Settings and defaults

| Setting | Where | Default |
| --- | --- | --- |
| **Mode** | Group Chat section | **Merged (Narrator)** in Roleplay, **Grouped** in Conversation |
| **Color Dialogues** | Roleplay, Merged | Off |
| **Automate active characters** | Roleplay, Merged | Off |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | On |
| **Name Prefix History** | Roleplay, Individual | Off |
| **Scenario Override** | Roleplay | Empty |
| **Character Exchanges** | Conversation, Autonomous Messaging | Off |

Settings profiles save these, except **Scenario Override** and automation pins. See [Settings Profiles](settings-profiles.md).

## Reference

### Automate active characters (Merged only)

In Merged mode every active character's card is in the prompt on every reply. In Roleplay, **Automate active characters** can turn cards on and off for you, so a big cast does not fill the context. It has three options and is **Off** by default.

| Option | What it does |
| --- | --- |
| **Off** | You choose who is active with the eye toggles. |
| **Decision model** | Before each reply, your [Decision model](../connections/decision-models.md) answers one yes-or-no question per character: is this character in the scene the reply continues, or entering it? A character who is only mentioned or remembered stays off. |
| **Character Tracker** | The [Character Tracker](../agents/built-in-agents.md#character-tracker)'s present characters from the last reply set who is active. It needs no extra model call but runs one turn behind: a character who walks in now is turned on for the next reply. |

A hint under the setting tells you when something is missing: no Decision model chosen, the Character Tracker off in this chat, or a tracker that runs manually, which changes the list only after you run it.

- **Pins.** While automation is on, each character row shows a pin left of its eye. Click it to pin the character as they are now, on or off, so automation leaves them alone. Toggling an eye by hand pins that character too. Click a pin again to unpin. Turning automation **Off** clears every pin.
- **The narrator stays active.** The appointed Narrator is never turned off.
- **No answer keeps the list.** In **Decision model** mode, if the model gives no answer, the Character Tracker's last scene is used when there is one. This also covers a model that thinks first, unless **Also gate agents that run before the reply** is on, and a cast too big for the Decision model's input. With no answer from either, the list stays as it is.
- **Nobody active is ignored.** A result that would turn everyone off is not applied.
- **A Character Activity agent wins.** A chat with a custom agent using the **Character Activity** result type keeps that agent in charge.

The Character Tracker writes its own name for each character. Marinara matches it to a card by card id, then name, then the name aliases on the **Colors** tab. A tracker list that names none of the chat's characters keeps the current list. Automation runs before every reply, swipe and regenerate, and skips **Continue** and impersonation. The setting is saved in settings profiles. Pins stay with the one chat.
