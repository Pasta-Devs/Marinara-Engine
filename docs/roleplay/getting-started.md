# Roleplay Mode: Getting Started

This guide covers what Roleplay Mode is, how to start a roleplay, and what you see on screen. It also explains sprite controls, the chat tools, Author's Notes, and where to read about deeper features.

## What Roleplay Mode is

Roleplay Mode is one of Marinara Engine's chat modes. The others are Conversation and Game. Roleplay gives you an immersive scene view built around a story.

A roleplay scene can show a background image, character sprites, and a heads-up display of world state. A sprite is a character picture that changes with emotion. A heads-up display, or HUD, shows that state: movable **World State** and **Player & Tracker** buttons on a phone, and the Tracker Panel or the Trackers window on a computer.

Roleplay also uses helpers called agents. An agent is a small automatic task that runs alongside the AI reply. Agents track world state, pick sprites, choose backgrounds, and more.

You do not need image generation to use Roleplay Mode. Without it, the mode still works as text-only chat. Sprite slots stay empty, the background shows a solid color, and the HUD still tracks everything. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) to set up a connection.

Pick Roleplay Mode when you want an immersive scene. Pick [Conversation Mode](../conversation/getting-started.md) for plain messaging chat. Pick [Game Mode](../game/getting-started.md) for a structured role-playing game with a party, combat, and dice.

## Starting a roleplay

Create a new Roleplay chat to open the setup wizard. The wizard has five steps. Only the AI connection is required. Every other step is optional and can be changed later.

1. **Name & Connection**. Name the roleplay and choose which AI connection answers. You can leave the name blank.
2. **Pick a Preset**. A preset controls the prompt structure and generation settings. The default preset works well for most chats.
3. **Persona & Characters**. Choose the persona you play and which characters join the scene.
4. **Attach Lorebooks**. A lorebook is a set of world facts that the AI reads when keywords appear. This step is optional.
5. **Enable Agents**. Pick which agents run in this chat. You can add or remove agents later in **Chat Settings**, under **Agents**.

After you finish the wizard, your scene opens and you can send your first message.

## The stage: background, sprites, and HUD

The Roleplay stage is the scene area behind and around your messages. It has three main parts.

The **background** is a full-scene image behind the message column. It crossfades smoothly when it changes. The **Background** agent can pick one each turn from your background library. You can also set a fixed background per chat. See [Roleplay Backgrounds](backgrounds.md) for the full background system.

**Sprites** are the character pictures placed on the stage. There is no fixed limit. Every sprite-enabled character in the chat can appear. Sprites need an uploaded sprite library on the character card. Without one, the sprite slot renders nothing. See [Character Sprites](../characters/sprites.md) to add sprites to a character.

The **HUD** shows your trackers. On a phone, trackers open from movable **World State** and **Player & Tracker** buttons. On a computer, the trackers show in the **Tracker Panel**, or in the **Trackers** window when the Tracker Panel is off in Settings. Each tracker belongs to a tracker agent, so it only appears when its agent is on. Trackers can show date, time, weather, location, present characters, inventory, quests, and stats, and you can edit their values. See [Roleplay HUD and Trackers](hud-and-trackers.md) for every widget and lock mode.

### Sprite display controls

Sprite controls live in **Chat Settings**, under **Agents**, on the **Expression Engine** card. They appear once at least one character has sprites enabled.

- **Sprite Source**. A toggle with **Expressions** and **Full-body**. Choose one or both. At least one must stay on.
- **Expression Size**, **Full-body Size**, **Expression Opacity**, and **Full-body Opacity**. Four sliders that set sprite size and see-through level. These settings stay on this browser and do not sync to other devices.
- **Default Side**. A **Left** or **Right** toggle that sets which side new sprites start on.
- **Expression Avatars**. When on, message avatars in the transcript use the character's current expression sprite.

To move sprites by hand, click the **Arrange** button on the stage. It becomes **Done** while active. Drag a sprite, then click the small check above it to confirm. Click **Done** to finish. The **Reset** button clears all custom placements.

You can also set an expression by typing the **/emote** command in the chat box. Two forms work:

```
/emote happy
```

```
/emote "Aria" angry
```

The first form sets the expression for the scene. The second form targets one named character. Type **/emote** with no words to list the available expressions for each character in the scene.

## The chat tools

The chat's tools are sections of **Chat Settings**. Open it with the sliders button inside the chat; the button starts at the top right and can be dragged to another spot. In a Roleplay chat you find:

- **Search messages**, an expandable section near the top. Finds a message by its words or its number, with tabs for bookmarks and deleted messages.
- **Chat Branches**. Switches, renames, exports and imports the chat's branches. See [Chat Branches](../chats/branches.md).
- **Chat Summary**. Shows and edits the rolling summary of the chat.
- **Active Context**. Lists the linked characters, lorebook entries, and preset that fed the last reply. It shows which lorebook entries matched and were injected.
- **Agent activity**, just below **Agents**. See below.
- **Author's Notes**. A free-text note added to the prompt every turn. See below.
- **Gallery**. The chat's images and videos, where you can generate an illustration or background.

You can pop out any of these sections, including Search, to keep it in a separate window. On a phone, open popped-out sections from the **Chat tools** three-dot menu; tracker buttons stay separate. Older chats keep their familiar tools outside Chat Settings. Open one and choose **Put back in Chat Settings** to move it inside. See [Chat Settings Overview](../chats/chat-settings.md).

### Author's Notes

**Author's Notes** is a note you write that the AI reads on every generation. Use it for a standing reminder, like a tone rule or a hidden fact. Open **Chat Settings** and expand **Author's Notes**, under **Agents**.

Type your note in the box. For example: "Keep the tone dark and suspenseful. The villain is secretly an ally."

Below the note is an **Injection Depth** number field. It sets how far up the chat history the note is placed. The in-app help reads: "Depth 0 = after the latest message, 4 = four messages from the end." Depth 0 keeps the note closest to the newest reply.

Author's Notes also works the same way in Game Mode and Conversation Mode. This guide is its main reference.

## Agent activity

**Agent activity** shows what the chat's agents did. It appears once the chat uses agents or Advanced Memory. Find its own section just below **Agents** in **Chat Settings**. It is also at the bottom of the **Tracker Panel** and, on a computer, of the **Trackers** window.

Its **Activity** tab lists agent outputs, called thought bubbles. You can dismiss each one or use **Clear all**. Custom agent outputs also appear here.

If an agent failed on the last turn, a failed list appears with a retry button. You can also stop running agents, re-run all tracker agents, and use **Clear Trackers** from here. For a plain-language tour of the whole agent system, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

An **Injections** tab appears only when **Debug mode** is on. Turn it on in **Settings**, under **Advanced**. This tab shows the prompt snippets that writer-style agents saved before the last reply. Writer-style agents include **Prose Guardian**, which rewrites replies to match your style rules, and the **Narrative Director**, which steers the plot.

You can view, edit, and re-run a saved snippet. An edit changes only what is used when you regenerate that same reply. It does not change the reply already on screen. This keeps regeneration steady and repeatable.

The Narrative Director has a **Push Story** button above the chat box. It arms the Director for the next reply only. The Narrative Director can also hold a hidden long-term arc called **Secret Plot**. See [Narrative Director and Secret Plot](narrative-director.md) for both.

## Whispers and secrets

In **Chat Settings → Agents → Roleplay Commands**, enable **Whisper** to allow private asides, secrets, or visions inside a reply. It starts off. Choose whether **All** characters or only the appointed **Narrator** can use it. Like Personal Notes, it requires a solo chat or **Individual** group generation.

The command is `[whisper: character="name" text="the secret"]`. Name exactly one character in the chat or your selected persona. Only that recipient and the appointed narrator receive the text in their prompts. An unknown or ambiguous name is ignored without exposing the secret. Shared agents do not receive whispers.

A whisper stays at its place in the message. Whispers addressed to your persona are visible immediately; otherwise, choose **Reveal a secret** to read one. Revealing only changes your screen, not what any character knows. Secrets follow their message and active swipe, and leave the prompt when that message is hidden or falls outside the selected history.

Once a whisper is visible, choose **Edit whisper**, change the text, then **Save**. The correction stays with that message's swipe and is used in later prompts for its original recipient and the narrator. **Cancel** leaves it unchanged.

You can also write `[whisper: character="name" text="the secret"]` in your own Roleplay message to whisper to one chat character. Your own whispers are visible to you immediately. This works in ordinary chats without enabling multiplayer.

The same command works when you edit a character's or the narrator's message: after you save, it becomes that message's whisper. Whisper text can span several lines and quote dialogue as is, for example `text=""I love you.""`.

### Your private notes

With **Personal Notes** enabled under **Roleplay Commands**, write `[notes: content="your private note"]` in your own message. These notes belong to you and are included only for the appointed narrator, not ordinary characters or shared agents. Use the message's command details to edit or delete them.

The narrator also stops receiving a character's notes when that character is disabled or removed from the group. Disabling does not delete the saved notes; re-enabling the character makes them available again.

You can also keep a note on a single message. Choose **Bookmark, pin or note** under the message and write a **Private note**. It stays private and is never sent to the model unless you turn on **Show the note to the narrator character** and pick a character. That character then receives the note next to that message, and no other character does. Sharing needs a solo chat or **Individual** group generation, because a merged group reply is written for every character at once. **Remove note** also stops sharing it.

## Character interruptions

In **Chat Settings → Agents → Roleplay Commands**, enable **Interruptions** to let characters cut off the latest message when a verbal or physical intervention is plausible. It starts off and does not need a downloadable agent.

The model uses `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara matches that phrase only in the message immediately before the reply, retains text through the phrase, and replaces the ending with an interruption dash. Dialogue keeps its closing quote; actions do not gain one. A missing or ambiguous match leaves the message unchanged.

Open the reply's command information and choose **Restore original message** to recover the original message. Rerolling first restores the full original input, so the new reply can choose whether to interrupt. Selecting an existing swipe applies that swipe's interruption unless you explicitly restored it. Later manual edits are preserved instead of being overwritten by an old interruption.

## Echo Chamber

**Echo Chamber** is an optional agent that adds a live audience reacting to your scene. It works like a streaming chat that posts a new reaction on a timer. Turn it on in **Chat Settings**, under **Agents**, on the **Echo Chamber** card. On a computer, drag its title bar to move it, resize it from an edge, or pin it to keep it open. **X** closes it to a movable button. On a phone, Echo starts as a compact window above the messages. Drag its title bar to move it, or drag an edge or corner to resize it. Pin it to keep it open when you tap elsewhere, or lock it to prevent accidental moves. **X** closes it to a movable button there too. Echo follows your **Chat widget style** in **Settings → Appearance → App**, and each chat remembers its layout.

## CYOA choices

**CYOA** stands for Choose Your Own Adventure. The **CYOA Choices** agent is off by default. When on, it adds clickable choice buttons after a reply. Clicking a choice sends it as your next message. It works only in Roleplay Mode.

## Combat encounters

Roleplay Mode has a light combat layer. Enable the **Combat** agent, then click the **Encounter** button above the chat box (its tooltip reads "Start Combat Encounter"). This opens a setup modal and then a combat screen with health bars and action buttons. This is separate from Game Mode's own combat. See [Combat Encounters (Roleplay)](combat-encounters.md) for the full flow.

## Scenes

A **scene** is a side branch of a roleplay. Use it for a flashback, a side location, or an alternate path, without losing the main thread. A scene does not pull context from a connected Conversation, even when the parent roleplay does. See [Scenes: Branching a Roleplay](scenes.md).

## Choosing models

Defaults work well for Roleplay Mode. Two general tips help most setups.

Your chat connection writes the character prose. A mid-tier model or better keeps voice steady across long scenes. Your agent connections run small structured tasks, like reading state or picking an expression. Very weak models can produce wrong state or bad sprite choices.

You can set a cheaper model for agents than for chat. Many users run chat on a strong model and agents on a fast, low-cost one. If your HUD values or sprites keep going wrong, move the agent connection to a more capable model. For sampler settings, see [Generation Parameters](../prompts/generation-parameters.md).

## Troubleshooting

**HUD widgets show the wrong value.** A tracker agent fills each widget. Open the widget panel and edit the value by hand. If values keep drifting, switch the agent connection to a stronger model. You can also lock a field so the next automatic run does not overwrite it.

**Sprite expressions do not change.** Check that the character has an uploaded sprite library. Image generation is needed only when you want Marinara to create new sprites. Without sprites to show, the expression agent runs but has nothing to display. You can also set an expression by hand with the **/emote** command.

**The background never changes.** The **Background** agent picks from your background library. With only one or two backgrounds, it keeps picking those. Add more backgrounds so the agent has more choices. See [Roleplay Backgrounds](backgrounds.md).

**A regenerated reply keeps the wrong direction.** Turn on **Debug mode** in **Settings**, under **Advanced**. Open **Agent activity**, find the **Injections** tab, then edit or re-run the saved snippet before you regenerate. For more help, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Roleplay Backgrounds](backgrounds.md)
- [Roleplay HUD and Trackers](hud-and-trackers.md)
- [Combat Encounters (Roleplay)](combat-encounters.md)
- [Narrative Director and Secret Plot](narrative-director.md)
- [Scenes: Branching a Roleplay](scenes.md)
- [Character Sprites](../characters/sprites.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
