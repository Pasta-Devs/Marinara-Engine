# Conversation Mode: Getting Started

This guide covers Conversation Mode in Guksu Motor, the messenger-style chat mode. It explains what the mode is and how the four-step setup wizard works. It also covers the Conversation-only features you get, such as autonomous messages, presence status, reactions, selfies, and table games.

## What Conversation Mode is

Conversation Mode is one of Guksu Motor's chat modes. It works like a messaging app. You get one or more characters, an input bar, and a scrolling message history.

Think of it as sending direct messages, or DMs, the way you would text a friend. There is no game master, no scene art, and no required mechanics. It is the lightest chat mode, and many users spend most of their time here.

Conversation Mode adds features that only make sense for an ongoing messenger relationship. Characters have an online or away status and weekly schedules. They can message you first, send selfies, react with emoji, and play table games. Every character and persona also gets a small Discord-style profile with a display name and an about me. See [Conversation Mode Profiles](profiles.md) for those profile fields.

None of these Conversation-only features apply in Roleplay or Game Mode, even when you reuse the same character card there.

### When to pick Conversation Mode

Pick Conversation Mode when you want any of these:

- To chat with a character the way you would DM a friend, with text in and text out.
- To talk with more than one character at once in a single thread.
- To let characters behave on their own, sending messages, following schedules, and reacting over time.

Pick Roleplay or Game Mode instead when you want scene art like sprites and backgrounds, or structured game mechanics.

## The four-step setup wizard

When you start a new Conversation chat, a four-step wizard appears. You can also close it and set things up later from the chat settings drawer. The four steps are:

1. **Name & Connection**: name the chat and choose the AI connection your characters use. A connection is a saved link to an AI provider. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
2. **Prompt Preset**: choose which preset supplies the Conversation prompt, or keep the default.
3. **Persona & Characters**: pick your persona and one or more characters.
4. **Automation**: decide how much the characters can do on their own.

Your persona is the character you play. See [User Personas](../characters/personas.md).

The number of characters you pick sets the chat shape. One character makes a private DM. Two or more characters make a group chat, with no extra mode to turn on. Group chat controls live in [Group Chats](../chats/group-chats.md).

When a connection and at least one character are set, click **Start Chatting** to open the chat.

### The Automation step

The **Automation** step always includes these controls:

| Toggle | Default | What it does |
|---|---|---|
| **Autonomous Messages** | On | Characters can message you first when you are inactive. |
| **Generate Schedules** | Off | Builds optional weekly routines. Only shown when Autonomous Messages is on. |

If you have installed an agent package that contributes Conversation commands, the step also shows **Commands**. Calls, Illustrator selfies, Music DJ, Haptic Feedback, and each table game appear only when their matching packages are installed. For calls, see [Conversation Audio and Video Calls](calls.md).

### The Commands grid

When **Commands** is available and on, a grid of up to 17 command families appears. Each one is a hidden action a character can take on its own. Package-owned choices appear only when that package is installed. Every visible family starts on. Turning a toggle off only removes that one family. Commands are model-driven actions, not things you type.

The complete set of command families is:

- **Schedule Updates**: let characters change their current status.
- **Cross-Post**: let characters redirect a message into another chat.
- **Selfies**: let characters request generated selfies.
- **Memories**: let characters create memories for other characters.
- **Scenes**: let characters start an immersive scene.
- **Music**: let characters play songs through the active Music Player.
- **Haptics**: let characters control connected haptic devices.
- **Influence**: let characters influence a connected chat.
- **Notes**: let characters save durable notes for a connected chat.
- **Calls**: let characters ring you for a Conversation call.
- **Reactions**: let characters react to messages with emoji badges.
- **UNO**: let characters start a game of UNO at the table when you agree to play.
- **Chess**: let characters accept a one-on-one chess challenge at the table.
- **Poker**: let characters sit down for a game of Texas Hold'em poker at the table.
- **8-Ball Pool**: let characters rack up a game of 8-ball pool at the table.
- **Tic-Tac-Toe**: let characters accept a one-on-one tic-tac-toe challenge.
- **Rock-Paper-Scissors**: let characters accept a one-on-one rock-paper-scissors match.

A single master **Commands** toggle gates all of them. When the master toggle is off, no command family works, even if it looks enabled.

## Autonomous messages and your presence status

Autonomous messages let a character reach out to you first. When **Autonomous Messages** is on, a character can send you a message after you have been quiet for a while. The character weighs its own talkativeness and, if schedules are on, its availability. Autonomous messages default to on when you finish the wizard.

You can change this toggle later. Open the chat settings drawer and find the **Autonomous Messaging** section.

### Your presence status

You have a presence status that shapes when characters reach out. It lives in the sidebar footer as a colored pill with your current status. Click the pill to pick one of four options:

- **Active**: you are online and available.
- **Idle**: set automatically when you are away.
- **Do Not Disturb**: suppresses autonomous messages.
- **Invisible**: hides your status from the characters.

Next to the pill is a **What are you doing?** field. Type a short custom activity here if you want the characters to know what you are up to. Your presence status is global, so it stays the same across every chat.

## Reactions and notifications

Any Conversation message can get an emoji reaction. Use the reaction button on a message to add your own. Guksu saves your reaction as a note like `[User reacted with ...]`, and future replies can see it. This lets a character notice that you reacted.

When the **Reactions** command family is on, characters can react too. They can react to your messages or to each other's messages. Reactions are handy in group chats, since a character can respond lightly without a full message.

When a character messages you in a chat you are not currently viewing, a floating avatar bubble appears at the edge of the screen. Click the bubble to jump to that chat, or dismiss it with the X. On mobile, several pending bubbles collapse into one tappable group.

## Selfies

Characters can send you selfies, which are AI-generated photos of the character. Selfies differ from the scene art used in Roleplay and Game Mode, because a selfie is tied to one character.

To use selfies, install **Illustrator** from **Agents → Download Agents**. Then open the chat settings drawer, go to **Agents → Illustrator Settings**, and set a **Selfie Connection**. A selfie connection is an image-generation provider. Each selfie costs one image-generation call.

Full setup, including style, resolution, and the manual request button, lives in [Selfies](selfies.md).

## Table games

Conversation Mode has six optional table-game packages: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe**, and **Rock-Paper-Scissors**. Install the games you want from **Agents → Download Agents**. The app deals the board, enforces the rules, and has each character narrate its own moves in character. Table games only run in Conversation chats.

You can start a game three ways:

1. Type a slash command in the message box, then press Enter.
2. Type a normal message like "let's play uno".
3. Let a character invite you, when its command family is on.

The slash commands are:

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Each game has its own setup box with options. For the full rules, setup boxes, and boards, see [Table Games](table-games.md).

## Character schedules

Each character in a Conversation chat can have a weekly schedule. A schedule sets the character's status and activity across a 7-day, 24-hour grid. It makes autonomous messages feel routine-aware, so a character marked away will not reach out during those hours.

You can build a schedule during setup by turning on **Generate Schedules**. You can also create or edit one later from the **Autonomous Messaging** section of the chat settings drawer. [Character Schedules and Autonomous Messaging](schedules.md) covers the full schedule editor, the daily limits, and the `/status` override command.

## Troubleshooting

### Autonomous messages are too frequent

Open the chat settings drawer and turn off **Autonomous Messages** in the **Autonomous Messaging** section. You can also set your presence status to **Do Not Disturb**, which suppresses autonomous messages. If you use schedules, mark more hours as away in [Character Schedules and Autonomous Messaging](schedules.md).

### One character replies to everything in a group chat

Group chats have controls for turn-taking, like **Reply When Mentioned**. Open [Group Chats](../chats/group-chats.md) to set who speaks and when.

### A character forgets things from earlier

Long chats fill the model's memory. Try a model with a larger context window, or add key facts to a lorebook entry so they stay in context. You can also start a fresh chat with the same character and persona. For more help, see [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md).

### A selfie does not look like the character

Open the **Selfies** settings and turn on **Attach Card Appearance**. If your image provider supports reference images, also turn on **Send Avatar References**. See [Selfies](selfies.md) for details.

## Related guides

- [Conversation Audio and Video Calls](calls.md)
- [Character Schedules and Autonomous Messaging](schedules.md)
- [Conversation Mode Profiles](profiles.md)
- [Selfies](selfies.md)
- [Custom Emojis, Stickers, and GIFs](emoji-stickers-gifs.md)
- [Table Games](table-games.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
