# Slash Commands Reference

A slash command is a shortcut you type in the message box, starting with `/`, to do something quickly. Some change the screen at once. Others ask the model to write something.

## How slash commands work

1. Type the command in the message box at the bottom of a chat.
2. Click **Send**, or press <kbd>Enter</kbd> if **Send on Enter** is on for your chat mode. See [Sending and Streaming](sending-and-streaming.md#send-on-enter).

As soon as you type `/`, a menu of matching commands appears above the box. Each row shows the command format and a short description. Click a row to fill it into the box, add any extra text, and send. The box hint also mentions commands: **Write your response, / for commands** in Roleplay, and "Message @Alice, / for commands" in Conversation.

In the tables, the format of each command is in its row. Replace bracketed labels such as `[name]` or `[range]` with your own values and do not type the brackets. Inputs marked `(optional)` can be left out. A `|` separates alternatives. Many commands have shorter aliases, such as `/cont` for `/continue`. To see every command in the app, type:

```text
/help
```

Some commands run in your browser and cost nothing. Others ask the model to write text, which uses your account and may use tokens (the units that services count and bill).

Slash commands work in the Conversation and Roleplay message boxes. In Game, only a bare `/illustrate` (or `/ill`) with no range or prompt works, and only when Game illustrations are set up with an image account. Anything else that starts with a slash is sent as normal text. In Roleplay and Conversation, the commands `/illustrate`, `/selfie` and `/video` need the Illustrator agent and appear only when it is installed.

Several commands use message numbers. Marinara counts from the first message in the chat as number 1. `/goto`, `/hide` and `/unhide` use these numbers. **Show message numbers** displays them. See [Message Actions](messages.md#message-display-toggles).

## Chat and message commands

These work in Conversation and Roleplay.

| Command | What it does |
| --- | --- |
| `/help` | Lists every slash command. |
| `/send` | Posts a message as your persona without asking for a reply. Macros are filled in, as with **Send**. Format: `/send [message]`. |
| `/continue` | Adds more text to the last AI reply, without a new message. Also `/cont`. **Settings → General → Responses → Add a new line before /continue text** sets whether the text starts after a blank line or at the cutoff. |
| `/goto` | Scrolls the chat to a message number. Also `/jump`, `/scroll`. Format: `/goto [number]`. |
| `/hide` | Hides messages from the model on future turns. Format: `/hide [range] [name (optional)]`. |
| `/unhide` | Puts globally hidden messages back. Format: `/unhide [range]`. |
| `/sys` | Adds a system message. It shows in the chat and steers the model, but no character speaks it. Also `/system`. Format: `/sys [message]`. |
| `/macros` | Lists prompt macros such as `{{user}}` and `{{char}}`. Also `/macro`. |
| `/remind` | Sets a timer, then posts a reminder in the chat. Also `/reminder`, `/timer`. Format: `/remind [time] [message]`. |

Examples:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` and `/unhide` take one number, a range, or a mix: `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. Hidden messages stay in the chat but the model does not read them.

In Roleplay, add a character name after the range to hide the messages only from that character. Other characters keep access.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Quote names that contain spaces. The older name-first forms such as `/hide Maukie 3-8` still work. If a name matches several characters, use the full name. Quote numeric names to tell them from message numbers, such as `/hide 1 "123"`. To review or undo character-specific hiding, use the message's **Hide from AI** avatar chooser in a group Roleplay chat, or **Unhide from AI** in a one-character chat. `/unhide` restores global hiding only.

`/remind` takes a time with `h` (hours), `m` (minutes) or `s` (seconds), then a message. The reminder lives in your browser session, so keep the tab open until it fires.

## Story and roleplay commands

| Command | What it does |
| --- | --- |
| `/guided` | Steers the next reply. Also `/narrator`, `/narrate`, `/nar`. Format: `/guided [direction]`. |
| `/as` | Posts a message as a character, or asks that character to reply. Also `/respond`. Format: `/as [name] [message (optional)]`. |
| `/emote` | Lists or switches a sprite expression. Also `/emotion`, `/sprite`. Format: `/emote [expression]`. |
| `/roll` | Rolls dice and posts the result. Also `/r`, `/dice`. Format: `/roll [dice (optional)]`. |
| `/random` | Asks the model to add a surprise event. Also `/rand`, `/event`. |
| `/scene` | Starts a Roleplay scene that branches off the conversation. Also `/rp`. Format: `/scene [description (optional)]`. |
| `/illustrate` | Roleplay only. Generates a gallery image. Needs the Illustrator agent. Also `/ill`. Format: `/illustrate [range=N-M] [prompt]`. |
| `/html` | Roleplay only. Makes one in-world artifact, such as `a spellbook page`, at the end of the latest reply. Format: `/html [what you want]`. |
| `/video` | Roleplay only. Makes a short clip of the latest reply, or of your description, under that reply. Follows Illustrator's **First frame** setting. Needs Illustrator. Format: `/video [description]`. |
| `/impersonate` | Writes a reply as your persona. Also `/imp`. Format: `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Sets the instruction `/impersonate` uses in this chat. Also `/imp_prompt`. Format: `/impersonate_prompt [prompt or reset]`. |

Most of these work best in Roleplay. `/scene` is run from a Conversation. `/impersonate` and `/impersonate_prompt` are not available in Conversation.

### Steer a reply

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`reply as` and `respond for` also work in place of `respond as`. See [Guided Generation and Impersonate](guided-and-impersonate.md).

### Post as a character

Leave out the message to have the model write that character's next response.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Roll dice

`/roll 2d6` rolls two six-sided dice. Add a modifier, as in `/roll 1d20+5`. With nothing after it, `/roll` rolls `1d20`. To keep only some dice, add `kh` (keep highest) or `kl` (keep lowest) and a number: `/roll 4d6kh3` adds the highest three, and `/roll 2d20kl1` keeps the lower of two. `dl` and `dh` drop the lowest or highest instead, as in `/roll 4d6dl1`. The dice that do not count are still shown, dimmed.

### Switch a sprite

A sprite is a piece of character art that shows an expression. Type `/emote` alone to see the available expressions, or name one:

```text
/emote joy
/emote "Powers That Be" joy
```

With a name and no expression, it lists that character's expressions. It needs a Roleplay chat with sprites uploaded. See [Character Sprites](../characters/sprites.md).

### Illustrate and make artifacts

`/illustrate range=12` illustrates message 12. `/illustrate range=12-18` sends messages 12 through 18 to the Illustrator. Use the same message numbers as `/goto`, in ascending order, with at most 200 messages. Hidden messages stay out. The image attaches to the last visible message in the range. Earlier messages stay available with Advanced Memory on. Without `range=`, the command works on the current scene. A prompt you type is used as written.

`/html a terminal readout` needs no agent and works whether or not **HTML Artifacts** is on. The narrator can ask for the same with `[html: prompt="..."]` when **HTML Artifacts** is on under **Roleplay Commands**. See [Artifacts on demand](../roleplay/getting-started.md#artifacts-on-demand).

### Write your reply

`/impersonate ask about the weather` writes a reply in your persona's voice. Your persona is the character that stands for you, written `{{user}}` in prompts. These two commands are not available in Conversation.

## Conversation mode commands

These work only in a Conversation chat.

| Command | What it does |
| --- | --- |
| `/games` | Opens the installed game picker. `/game` and `/play` do the same. |
| `/selfie` | Generates a selfie with the Illustrator agent. Add a name to choose a character. Format: `/selfie [name (optional)]`. |
| `/video` | Has a character send a short video message, using the chat's **Video messages** settings. See [Video messages](../conversation/selfies.md#video-messages). Format: `/video [name (optional)]`. |
| `/uno` | Starts UNO with the characters in the chat. |
| `/chess` | Starts a one-on-one chess game with a character. |
| `/poker` | Starts Texas Hold'em with the characters. |
| `/8ball` | Starts one-on-one 8-ball pool with a character. `/pool` does the same. |
| `/status` | Sets or clears a character's presence status. Format: `/status [online, idle, dnd, offline or clear] [name]`. |

The game commands open that game's setup screen, and each appears only when its game agent is installed. You can play one game at a time in a chat. See [Table Games](../conversation/table-games.md).

`/status` overrides a character's presence. The status can be `online`, `idle`, `dnd` (do not disturb) or `offline`. `clear` removes the override. In a chat with several characters, add the name at the end.

```text
/status idle
/status online Alice
```
