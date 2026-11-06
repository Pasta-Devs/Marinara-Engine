# Roleplay Mode: Getting Started

Roleplay is the chat mode for stories. It adds a stage behind your messages (a background and character sprites) and a heads-up display (HUD) of story details. An agent is a helper that runs alongside replies, for example one that tracks the weather or picks a sprite.

Pick Roleplay for a story scene. Pick [Conversation](../conversation/getting-started.md) for plain messaging, or [Game Mode](../game/getting-started.md) for a structured game with a party, combat and dice. Roleplay works as text-only chat without image generation: sprite slots stay empty, the background is a solid color, and the HUD still tracks the story.

## Start a roleplay

Before you start: add an account in the **Connections** panel on the right side of the app. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. In the chat sidebar, click the **RP** tab.
2. Click the **+** button near the top of the sidebar. Its tooltip reads **New Roleplay**.

The chat opens with **Chat Settings** and a setup wizard of five steps. Only the account is required. You can change everything later.

1. **Name & Connection**. Name the roleplay (optional) and choose which connection answers.
2. **Pick a Preset**. A preset sets the prompt structure and generation values. The default works for most chats.
3. **Persona & Characters**. Choose your persona and the characters in the scene. In this step, a button named **Create your persona** can build a persona for you from a few questions. See [Interactive Onboarding](../characters/interactive-onboarding.md).
4. **Attach Lorebooks**. A lorebook is a set of world facts the AI reads when their keywords come up. Optional.
5. **Enable Agents**. Pick which agents run in this chat. You can change this later in **Chat Settings → Agents**.

When you finish, you see the chat with a message box. Type your first message and send it.

## The stage: background, sprites and HUD

- **Background**: a full-scene image behind your messages that fades when it changes. The **Background** agent can pick one each turn, or you can fix one per chat. See [Roleplay Backgrounds](backgrounds.md).
- **Sprites**: character pictures on the stage. Every sprite-enabled character can appear. A character needs a sprite library on its card, or its slot stays empty. See [Character Sprites](../characters/sprites.md).
- **HUD**: your trackers (date, time, weather, location, who is present, inventory, quests, stats). Turn them on in **Chat Settings → Agents**. See [Roleplay HUD and Trackers](hud-and-trackers.md).

### Sprite display controls

Open **Chat Settings** (the sliders button in the chat), go to **Agents**, and find the **Expression Engine** card. This is the agent that picks sprite expressions. These controls appear once at least one character has sprites enabled.

| Control | What it does |
| --- | --- |
| **Sprite Source** | Choose **Expressions**, **Full-body**, or both. One must stay on. |
| **Expression Size**, **Full-body Size** | Set how big each kind of sprite is. |
| **Expression Opacity**, **Full-body Opacity** | Set how see-through each kind is. |
| **Default Side** | **Left** or **Right**: the side new sprites start on. |
| **Expression Avatars** | When on, message avatars use the character's current expression sprite. |

The four size and opacity sliders are saved in this browser only. They do not sync to other devices.

To move sprites by hand:

1. Click **Arrange**, the button on the scene. It becomes **Done**.
2. Drag a sprite, then click the small check above it to confirm.
3. Click **Done** to finish. **Reset** clears all custom placements.

To set an expression by typing, send `/emote happy` for the scene, or `/emote "Aria" angry` for one character. Send `/emote` alone to list each character's expressions.

If it did not work: sprites need an uploaded sprite library on the character. Without one, the expression agent runs but has nothing to show.

## The chat tools

The chat's tools (search, branches, summary, active context, Agent activity, Author's Notes, Gallery) are sections of **Chat Settings**. Open it with the sliders button in the chat. See [Chat Settings](../chats/chat-settings.md) for what each one does, and [Popping a section out into its own window](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Author's Notes

**Author's Notes** is a note the AI reads on every reply. Use it for a standing reminder, such as a tone rule or a hidden fact.

1. Open **Chat Settings** and expand **Author's Notes**, under **Agents**.
2. Type your note, for example: "Keep the tone dark and suspenseful."
3. Leave **Injection Depth** as it is if you are unsure. It sets where the note sits in the chat: 0 is after the newest message, and 4 is four messages before the end.

For a longer note, drag the bottom corner of the box on a computer. Author's Notes works the same way in Game Mode and Conversation Mode.

## Agent activity

**Agent activity** shows what the chat's agents did. It appears once the chat uses agents or Advanced Memory. You find it as its own section directly below **Agents** in **Chat Settings**, at the bottom of the Tracker Panel, and on a computer at the bottom of the Trackers window.

- **Activity** tab: the outputs agents saved, called thought bubbles. Dismiss one, or use **Clear all**. Custom agent outputs show here too.
- While agents work, its icon turns into a spinner. If an agent fails, a dot shows on the icon until you open it.
- Failed agents are listed with a retry button. You can also stop running agents, re-run the trackers, and use **Clear Trackers**.
- **Injections** tab: shown only when **Debug mode** is on (**Settings → Advanced**). It lists the prompt snippets that writer-style agents saved before the last reply. These agents include **Prose Guardian**, which rewrites replies to match your style rules, and the **Narrative Director**, which steers the plot. You can view, edit and re-run a snippet. An edit changes only what is used when you regenerate that same reply, so regeneration stays repeatable. It does not change the reply on screen.

For all agents, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md). For the story-steering agent, see [Narrative Director and Secret Plot](narrative-director.md).

## Combat and scenes

- Roleplay has a light combat layer. Add the Combat agent, then click **Encounter** above the chat box. See [Combat Encounters (Roleplay)](combat-encounters.md).
- A scene is a side branch for a flashback or side location. See [Scenes: Branching a Roleplay](scenes.md).
- To steer the plot, see [Narrative Director and Secret Plot](narrative-director.md).

## Choosing models

Your chat connection writes the character prose. A stronger model keeps a character's voice steady in long scenes. Your agent connections run small structured tasks, such as reading state or picking an expression, and small models can get these wrong. Many people run chat on a strong model and agents on a fast, cheap one. If HUD values or sprites keep going wrong, move the agents to a stronger model. For sampler settings, see [Generation Parameters](../prompts/generation-parameters.md).

## Commands

These are optional features. Commands are actions a character can take on its own, written inside its reply as short bracketed text such as `[illustrate: ...]`. Marinara reads the bracket, does the action and hides the bracket from the message.

### Turn on a command

1. Open **Chat Settings → Agents** and expand **Commands**.
2. Turn on the **Commands** switch at the top. Every command inside starts off.
3. Turn on the commands you want. A command that is greyed out shows what it still needs.

- **Illustrations**, **Video clips**: add the Illustrator agent to this chat.
- **Combat**: add the Combat agent to this chat.
- **Soundtrack**: add the Music DJ agent, and turn agents on.
- **Personal Notes**, **Reminders**, **Whisper**: use a solo chat, or a group chat with **Individual** generation.
- **Sound Cues**: choose a Music & Sound Effects connection with sound effects on.
- **Documents**, **HTML Artifacts**, **Rolls**, **Direct Messages**, **Interruptions**: nothing extra.

**Rolls**, **Combat**, **Documents** and **Whisper** also ask who may use them: **All** characters, or only the **Narrator**. The narrator is the character you choose under **Narrator character**. It can use narrator-only commands and read everyone's notes, reminders and whispers.

If it did not work: a greyed-out command is missing its agent or chat type. Read the line under its switch.

### Illustrations

Before you start: add the Illustrator agent to the chat and turn on **Illustrations**.

A character can now ask for an image with `[illustrate: subject="..." characters="..."]`. The image uses the chat's Illustrator settings and appears below the message.

Turn on **Render in-line** to show each image inside the message, where the character wrote the command. Select an image to see its prompt, or use **X** to remove it. The setting applies to new images only. Images the Illustrator agent makes on its own, and the Visual Novel layout, do not change.

You can also make an illustration yourself with `/illustrate`. In Roleplay it needs the Illustrator agent.

### Artifacts on demand

Turn on **HTML Artifacts** to let the narrator make one in-world object, such as a spellbook page, a sign, a sketch on a letter or a terminal readout. The command is `[html: prompt="..."]`. It needs no agent. You can also ask for one yourself with `/html <what you want>`.

The artifact appears where the narrator placed the command, after the reply finishes. In the Visual Novel layout you see only a marker. A reply can make at most 3 artifacts, and each is a separate model request. The request uses the **Immersive HTML** agent's connection if it has one, then your default agent connection, then the chat's connection. That connection's **Parallel requests** setting (in the account editor) sets how many run at once. For a plain styled page, the built-in **Documents** kinds are free and instant.

The narrator does not see the artifact's HTML. In later turns it sees a short plain-text version: the artifact's readable text and one line on how it looks. Open the "used html command" marker under the message to read or edit that text, or to delete the artifact, which also removes it from the narrator's memory. If a run fails, the marker says why.

### Whispers and secrets

Turn on **Whisper** for private asides, secrets and visions inside a reply. The command is `[whisper: character="name" text="the secret"]`. Name exactly one character in the chat, or your persona. Only that character and the narrator get the text in their prompts. An unknown or ambiguous name is ignored, so the secret does not leak.

- **Reveal a secret** shows a whisper on your screen. It changes only what you see, not what characters know. Whispers to your persona are visible at once.
- **Edit whisper** lets you change the text, then **Save**. To remove a whisper, clear its text and **Save**. **Cancel** leaves it as it was.
- You can write a whisper in your own message to whisper to one character. The same bracket works when you edit a character's or narrator's message. The text can span lines and keep quotes, such as `text=""I love you.""`.
- A message that holds only a whisper is hidden from the characters it does not reach.
- If you use **Hide from AI** on a message for some characters, the whisper's recipient still gets the whisper but none of the rest of the message.

Agents can read whispers too:

- These agents read them: Echo Chamber, trackers, Lorebook Keeper and Long-Term Memory. In group chats, **Smart** response order reads them too, so a whisper can make that character reply next.
- Each whisper is marked private and names its recipient. What an agent writes from it, such as a lorebook entry or a tracker note, can still reach other characters.
- In a hosted multiplayer room, agents and **Smart** response order get no whispers.
- Relationship Tracker and Memory Nag read the chat themselves and do not see whispers yet.

### Your private notes

Turn on **Personal Notes**, then write `[notes: content="your private note"]` in your own message. Only the narrator gets these notes, not other characters or shared agents. Use the message's command details to edit or delete one. If a character is disabled or removed from the group, the narrator stops receiving that character's notes. Turning the character back on restores them.

You can also keep a note on one message:

1. Choose **Bookmark, pin or note** under the message.
2. Write a **Private note**. By default it stays private and is not sent to the model.
3. To share it with the model, turn on **Show the note to the narrator character** and pick a character. Only that character gets the note, next to that message. Sharing needs a solo chat or **Individual** group generation.

**Remove note** also stops sharing it.

### Video clips

Before you start: add the Illustrator agent to the chat and choose a video connection under Illustrator's **Scene Videos**.

Turn on **Video clips** to let characters ask for a short clip of a key moment with `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`. The model is told to prefer it over `[illustrate]` when the moment is about motion. The clip starts from the picture set by Illustrator's **First frame** (a new Illustrator picture, the character's avatar or sprite, or none). It plays in the reply when ready. A clip is offered only while the **Video Run Interval** allows it, and it counts toward **Videos per reply**.

### Character interruptions

Turn on **Interruptions** to let a character cut off the latest message when an interruption fits. The command is `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara finds that phrase in the message just before the reply, keeps the text up to it, and ends it with a dash. Dialogue keeps its closing quote. If the phrase is missing or matches twice, the message stays as it is.

To get the original back, open the reply's command information and choose **Restore original message**. Rerolling first restores the full original, so the new reply can choose again. Picking an existing swipe applies that swipe's interruption unless you restored it. Your later manual edits are kept.

## Echo Chamber

**Echo Chamber** is an optional agent that adds a live audience reacting to your scene, like a streaming chat that posts a new reaction on a timer. Turn it on in **Chat Settings → Agents**, on the **Echo Chamber** card.

- On a computer, drag its title bar to move it and an edge to resize it. Pin it to keep it open. **X** closes it to a movable button.
- On a phone, it starts as a compact window above the messages. Drag its title bar to move it, or an edge or corner to resize it. Pin keeps it open when you tap elsewhere, and lock stops accidental moves.
- It follows your **Chat widget style** in **Settings → Appearance → App**. Each chat remembers its layout.

## CYOA choices

CYOA means Choose Your Own Adventure. The CYOA Choices agent is off by default, and works only in Roleplay. When on, it adds clickable choice buttons after a reply, and clicking one sends it as your next message. To combine choices or edit one first, turn on **Add CYOA choices to the message box instead of sending them** in **Settings → General → Input & Editing**. Clicking a choice then adds its text to your message box.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| A HUD value is wrong. | Edit it by hand and lock it so the next run leaves it alone. See [Roleplay HUD and Trackers](hud-and-trackers.md). If values keep drifting, use a stronger agent model. |
| Sprites do not change. | Check that the character has a sprite library. You can also use `/emote`. |
| The background never changes. | The **Background** agent picks from your library, so add more backgrounds. See [Roleplay Backgrounds](backgrounds.md). |
| A regenerated reply keeps the wrong direction. | Turn on **Debug mode**, open **Agent activity → Injections**, then edit or re-run the saved snippet before you regenerate. |

For more help, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Roleplay Backgrounds](backgrounds.md)
- [Roleplay HUD and Trackers](hud-and-trackers.md)
- [Combat Encounters (Roleplay)](combat-encounters.md)
- [Narrative Director and Secret Plot](narrative-director.md)
- [Scenes: Branching a Roleplay](scenes.md)
- [Character Sprites](../characters/sprites.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
