# Slash Commands Reference

This guide lists the slash commands you can type in a Guksu Motor chat. A slash command is a shortcut you type in the message box, starting with a forward slash, to do something quickly. Some commands act on your screen right away, and some ask the AI to write something.

## How slash commands work

You run a slash command by typing it in the message box at the bottom of a chat, then pressing **Send**. Pressing Enter also sends it if **Send on Enter** is turned on for your chat mode in **Settings**. By default, Enter sends in Conversation chats but starts a new line in Roleplay chats. The message box hints at slash commands. In a Roleplay chat the placeholder reads **Write your response, / for commands**. In a Conversation chat the placeholder shows the character's name, like "Message @Alice, / for commands". A conversation with more than one character shows the chat name instead.

As soon as you type a slash, a small menu of matching commands appears above the box. Each row shows the command name and a short description. Click or tap a row to fill that command into the box, then add any extra text and send it.

Many commands have shorter aliases. For example, you can type `/continue` or its alias `/cont`, and both do the same thing. To see the full list inside the app at any time, run this command:

```
/help
```

Some commands run in your browser and change the chat right away, with no cost. Other commands ask the AI to generate text, which uses your connected provider and may use tokens. A token is the unit that most AI providers use to measure and bill text. The tables below note what each command does.

Slash commands work in the **Conversation** and **Roleplay** message boxes. In **Game** mode, only `/illustrate` works as a slash command. Anything else you type starting with a slash is sent as normal text.

Several commands use message numbers. Guksu counts messages from the first message in the chat as number 1, then 2, then 3, and so on. Commands like `/goto`, `/hide`, and `/unhide` use these numbers.

## Chat and message commands

These commands help you manage the chat and its messages. They work in **Conversation** and **Roleplay** chats.

| Command | Also works as | What it does |
|---|---|---|
| `/help` | | Lists every slash command. |
| `/continue` | `/cont` | Adds more text to the last AI reply, without sending a new message. |
| `/goto` | `/jump`, `/scroll` | Scrolls the chat to a message by its number. |
| `/hide` | | Hides one or more messages from the AI on future turns. |
| `/unhide` | | Puts hidden messages back into the AI's view. |
| `/sys` | `/system` | Adds a system message. This note appears in the chat and steers the AI, but no character speaks it. |
| `/macros` | `/macro` | Lists supported prompt macros, like `{{user}}` and `{{char}}`. |
| `/remind` | `/reminder`, `/timer` | Sets a timer, then posts a reminder message in the chat. |

To jump to message 27, type this:

```
/goto 27
```

`/hide` and `/unhide` accept a single number, a range, or a mix. For example, this hides messages 3 through 8:

```
/hide 3-8
```

You can also write `/hide 5` for one message, or `/hide 2-5,9,12` for several. Hidden messages stay in your chat, but the AI does not read them on the next turn. Use `/unhide` with the same kind of number list to bring them back.

The `/remind` command takes a time, then a message. The time uses `h` for hours, `m` for minutes, and `s` for seconds. This example reminds you in 30 minutes:

```
/remind 30m check the oven
```

The reminder lives in your browser session, so keep the tab open until it fires.

## Story and roleplay commands

These commands help you steer a story, play a character, and add art. Most of them work best in a **Roleplay** chat. The exception is `/scene`, which you run from a **Conversation** chat.

| Command | Also works as | What it does |
|---|---|---|
| `/guided` | `/narrator`, `/narrate`, `/nar` | Steers the next AI reply in a direction you describe. |
| `/as` | `/respond` | Posts a message as a character, or asks a character to reply. |
| `/emote` | `/emotion`, `/sprite` | Lists or switches a character's sprite expression. |
| `/roll` | `/r`, `/dice` | Rolls dice and posts the result. |
| `/random` | `/rand`, `/event` | Asks the AI to add a surprise event to the story. |
| `/scene` | `/rp` | Run from a Conversation chat. Starts a new Roleplay scene that branches off that conversation. |
| `/illustrate` | `/ill` | Generates a gallery image for the current chat. |
| `/impersonate` | `/imp` | Writes a reply as your persona. |
| `/impersonate_prompt` | `/imp_prompt` | Sets the instruction that `/impersonate` uses in this chat. |

To steer the next reply, add your direction after `/guided`:

```
/guided make him confess he is lying
```

The `/roll` command reads dice notation. This rolls two six-sided dice:

```
/roll 2d6
```

You can add a modifier, like `/roll 1d20+5`. If you type `/roll` with nothing after it, Guksu rolls `1d20`.

A sprite is a piece of character art that shows an expression. The `/emote` command switches which one is shown. Type `/emote` alone to see the available expressions, or name one to switch to it:

```
/emote joy
```

Sprite switching needs a Roleplay chat that has sprites uploaded. See [Character Sprites](../characters/sprites.md) for how to add them.

Your persona is the character that represents you in a chat, written as `{{user}}` in prompts. The `/impersonate` command writes a reply in your place. You can add a direction after it:

```
/impersonate ask about the weather
```

`/impersonate` and `/impersonate_prompt` are not available in **Conversation** chats. For a full walkthrough of guided generation and impersonation, see [Guided Generation and Impersonate](guided-and-impersonate.md).

## Conversation mode commands

These commands only work in a **Conversation** chat.

| Command | What it does |
|---|---|
| `/uno` | Starts a game of UNO with the characters in the chat. |
| `/chess` | Starts a one-on-one chess game with a character. |
| `/poker` | Starts a game of Texas Hold'em poker with the characters. |
| `/8ball` | Starts a one-on-one game of 8-ball pool with a character. `/pool` does the same. |
| `/status` | Sets or clears a character's presence status. |

The `/uno`, `/chess`, `/poker`, and `/8ball` commands open the setup screen for that game. You can play one game at a time in a chat. For the rules and options, see [Table Games](../conversation/table-games.md).

The `/status` command overrides a character's presence. The status can be `online`, `idle`, `dnd` (do not disturb), or `offline`. Use `clear` to remove an override. This sets the character to idle:

```
/status idle
```

In a chat with more than one character, add the character's name at the end, like `/status online Alice`.

## Related guides

- [Message Actions](messages.md)
- [Guided Generation and Impersonate](guided-and-impersonate.md)
- [Table Games](../conversation/table-games.md)
- [Macros](../prompts/macros.md)
