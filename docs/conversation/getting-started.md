# Conversation Mode: Getting Started

Conversation Mode is the messenger-style chat mode: one or more characters, an input bar and a scrolling history, like texting a friend. It has no game master and no scene art. Characters can also message you first, follow weekly schedules, send selfies and play table games, and these features exist only in this mode.

## Start a Conversation chat

Before you start: add an account in **Connections** (see [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)) and have at least one character. A persona, the character card that stands for you, is optional (see [User Personas](../characters/personas.md)).

1. In the chat sidebar, open the **CONVO** tab and click **New Conversation**. A setup wizard with four pages opens.
2. On the first page, **Name & Connection**, name the chat and pick the account that writes the replies.
3. On the second page, **Prompt Preset**, pick the preset for the Conversation prompt, or keep the default.
4. On the third page, **Persona & Characters**, pick your persona and one or more characters.
5. On the last page, **Automation**, choose how much the characters do on their own (see the table below).
6. Click **Start Chatting**.

One character makes a private chat. Two or more make a group chat; no extra mode is needed. See [Group Chats](../chats/group-chats.md) for turn-taking.

If it did not work: **Start Chatting** needs an account and at least one character. You can close the wizard and set everything later in **Chat Settings**.

## Choose Automation options

| Option | Default | What it does |
| --- | --- | --- |
| **Autonomous Messages** | On | Characters message you first when you have been quiet for a while. |
| **Generate Schedules** | Off | Builds a weekly routine for each character. Shown only when **Autonomous Messages** is on. |
| **Commands** | Off | Master switch for actions a character takes on its own. |

Turn **Generate Schedules** on, then pick your time zone in the field that appears. In **Chat Settings** the same switch is called **Schedules**. Schedules and check-in limits are in [Character Schedules and Autonomous Messaging](schedules.md).

Change these later in **Chat Settings → Autonomous Messaging**. If characters write too often, turn **Autonomous Messages** off there, or set your presence to **Do Not Disturb**.

## Choose which Commands a character can use

Commands are actions the character decides to do by itself. You do not type them. After setup, open **Chat Settings → Agents → Commands**. The master **Commands** switch gates all families: when it is off, no family works.

Each family has its own switch. All start on except **Videos**, which you must turn on yourself. Families that belong to an optional agent show only when you install that agent from **Agents → Agent Organizer**.

| Family | What a character can do | Needs an agent |
| --- | --- | --- |
| **Schedule Updates** | Change its current status. | No |
| **Cross-Post** | Send a message into another chat. | No |
| **Memories** | Create memories for other characters. | No |
| **Scenes** | Start an immersive scene. | No |
| **Influence** | Influence a connected chat. | No |
| **Notes** | Save durable notes for a connected chat. | No |
| **Reactions** | React to messages with emoji badges. | No |
| **Selfies** | Request a generated selfie. | Illustrator |
| **Videos** | Send short video messages. | Illustrator |
| **Music** | Play songs through the active Music Player. | Music DJ |
| **Haptics** | Control connected haptic devices. | Haptic Feedback |
| **Calls** | Ring you for a call. | Calls |
| **UNO** | Start or accept a game of UNO. | UNO |
| **Chess** | Accept a chess challenge. | Chess |
| **Poker** | Sit down for Texas Hold'em. | Poker |
| **8-Ball Pool** | Rack up a game of pool. | 8-Ball Pool |
| **Tic-Tac-Toe** | Accept a tic-tac-toe challenge. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Accept a match. | Rock-Paper-Scissors |

For **Influence** and **Notes**, see [Connected Chats](../chats/connected-chats.md). The last column names the agent to install from **Agent Organizer**.

## Your presence status

Your presence is a colored pill in the sidebar footer. It is the same in every chat. Click it to choose:

| Status | Meaning |
| --- | --- |
| **Active** | You are online. |
| **Idle** | You are away. |
| **Do Not Disturb** | Stops autonomous messages. |
| **Invisible** | Hides your status from the models. |

If you stay **Active** and do nothing for 10 minutes, Marinara sets **Idle** and sets **Active** again when you return. If you pick a status yourself, this automatic change stops until you pick **Active** again. **Idle** does not stop check-ins.

Next to the pill is the status box, which shows "What's up?" when it is empty. Type your current activity there (up to 120 characters) so characters know. Recent entries appear under **Recent status** so you can reuse them.

## React and get notified

Use **Add reaction** on a message to react with an emoji. Later replies can see your reaction. With the **Reactions** command on, characters can react to your messages and to each other's.

When a character writes in a chat you are not viewing, an avatar bubble appears at the edge of the screen. Click it to open that chat, or click its X to dismiss it. On a phone, several bubbles collapse into one group you can tap.

## Good to know

A Conversation chat does not use the character card's **First Message** or its **Dialogue Highlight Color** and **Message Box Color**. The **Name Display Color** still colors the name above each message. See [Where your colors show](../characters/colors-and-stats.md#where-your-colors-show).

## Related features

- [Selfies](selfies.md): characters send generated photos of themselves.
- [Conversation Audio and Video Calls](calls.md)
- [Table Games](table-games.md): start a game with `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` or `/rps`.
- [Character Schedules and Autonomous Messaging](schedules.md)
- [Conversation Mode Profiles](profiles.md)
- [Custom Emojis, Stickers, and GIFs](emoji-stickers-gifs.md)
- [Connected Chats](../chats/connected-chats.md)

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Characters message too often | Turn off **Autonomous Messages**, set **Do Not Disturb**, or mark more hours as away in [schedules](schedules.md). |
| One character answers everything in a group | Set who speaks in [Group Chats](../chats/group-chats.md). |
| A character forgets earlier chat | Use a model with a larger context window (how much text it reads at once), or add key facts to a lorebook entry. |
| A selfie does not look like the character | See [Selfies](selfies.md). |

More help: [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).
