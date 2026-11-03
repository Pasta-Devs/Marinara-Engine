# Conversation Table Games

Play UNO, Chess, Poker, 8-Ball Pool, Tic-Tac-Toe and Rock-Paper-Scissors against the characters of a Conversation chat. Marinara deals the cards or sets up the board, enforces every rule and has each seated character narrate its moves in character. A live board appears above the message box while you play.

Each game is an optional package. Install the ones you want from **Agents → Agent Organizer**, and restart Marinara if the catalog asks. A game you have not installed has no slash command, does not appear in the games picker, and its **Commands** switch stays hidden.

Rules that apply to every game:

- Table games work in Conversation Mode only. In a Roleplay chat you see a message that games can only be played in Conversation chats.
- One game can be active per chat. Starting a new game replaces the current one, even a finished game still showing its end banner.
- The chat needs at least one character, and you must seat at least one as a bot. Bot moves use the same model as your normal chat replies. No extra account or API key is needed.

## Start a game

Before you start: install the game and open a Conversation chat with at least one character.

1. Type the game's slash command (a short instruction that starts with `/`) in the message box and press <kbd>Enter</kbd>. The game's setup window opens.
2. Choose the options (see each game below).
3. Click **Deal** or **Start game**.

If it did not work: the command is missing or does nothing when the game is not installed or you are not in a Conversation chat.

| Game | Command | Players |
| --- | --- | --- |
| UNO | `/uno` | You plus 1 to 9 characters |
| Chess | `/chess` | You and one character |
| Poker | `/poker` | You plus 1 to 7 characters |
| 8-Ball Pool | `/8ball` or `/pool` | You and one character |
| Tic-Tac-Toe | `/tictactoe` or `/ttt` | You and one character |
| Rock-Paper-Scissors | `/rps` | You and one character |

Other ways to start a game:

- Type `/games` to pick from the installed games.
- Say it in a normal message, such as "let's play uno", "start a game of chess" or "deal me into poker". The setup window opens and your message still sends, so a character can react to your invite. This happens only when that game is not already running.
- A character can offer or accept a game on its own. Its reply then starts the game at once with the default rules and no setup window. If it is busy or declines, it says so in character.
- A character can only do this when the game's **Commands** switch is on (see [Let characters start games](#let-characters-start-games-on-their-own)).

## UNO

The setup window is titled **Start UNO**.

- **Players**: tick each character who plays as a bot. All are ticked by default. **You go first** is ticked by default.
- **Starting hand**: cards per player, 1 to 10. The default is **7**.
- **Penalize missed UNO**: ticked by default. A player caught without declaring UNO draws 2 cards, and **Catch!** is active.
- **House rules**, all off by default:
  - **Stacking**: stack +2/+4 onto the next player instead of drawing.
  - **Draw to match**: keep drawing until you draw a playable card.
  - **7-0 rule**: a 7 swaps hands with a chosen player; a 0 rotates all hands.
  - **Jump-in**: play an identical card out of turn.
  - **Force play**: if a drawn card is playable, you must play it.

**Deal** stays disabled until you pick at least one character. It shows the number of players, for example **Deal (3p)** for you and two characters.

On the board:

- Playable cards lift and the rest dim. Click a card to play it.
- A wild card opens "Pick a color:". With **7-0 rule** on, a 7 opens "Swap hands with:".
- Buttons appear as needed: **Draw**, **Pass**, **Call UNO!** and **Catch!**.
- Playing your second-to-last card declares UNO for you.
- A banner reads "{winner} wins!" or "Game over".

## Chess

The setup window is titled **Start Chess**. Pick one **Opponent** (the first character by default). In a group chat the others keep chatting. **Your color** is **White**, **Random** (default) or **Black**. Click **Start game**.

Click one of your pieces to select it. Legal moves show as a dot, and captures as a ring. Playing Black flips the board. A pawn on the last rank opens "Promote to:" (Queen, Rook, Bishop, Knight). A banner announces checkmate, a draw with its reason, or "Game over", and a strip below the board lists recent moves.

## Poker

The setup window is titled **Start Poker**. The table seats 2 to 8 players.

- **Players**: tick the characters to seat. At seven, the rest gray out.
- **Dealer**: **House dealer (silent)** (default) deals without commentary. Or pick a character to announce hands and showdowns.
- **Starting stack**: chips per player, 100 to 1,000,000. The default is **1000**.
- **Small blind**: the big blind is double. The default is **10**.
- **Blinds double every**: hands between blind increases. The default is **0**, which means never.
- **Hand limit**: the session ends after this many hands, and the most chips wins. The default is **0**, which plays until one player has chips.

On your turn the bar shows **Fold**, **Check**, **Call** and **All in**. When you can bet or raise, a bet box adds **Min**, **½ pot**, **Pot** and **All-in** buttons. After each hand a **Showdown** panel awards the pot, and **Next hand** deals again. At the end a banner names the winner and lists every final stack.

## 8-Ball Pool

The setup window is titled **Start 8-Ball Pool**.

- **Opponent**: the character you play against.
- **Announcer**: **Silent (no announcer)** by default, or a character who calls the shots.
- **Match length**: **Race to 1**, **Race to 3** or **Race to 5** racks (a rack is one full game).
- **Who breaks first**: **You**, **Random** or **Them**. Later racks alternate the break.

Click **Start game**. On your turn, pick one of the suggested shots and the balls roll with a physics simulation. A line under the table describes the last shot.

## Tic-Tac-Toe and Rock-Paper-Scissors

In **Tic-Tac-Toe**, choose the opponent and whether you play **X**, **O** or a random mark. X moves first. Click an empty square on your turn. Illegal moves are blocked, and wins and draws are detected for you.

In **Rock-Paper-Scissors**, choose the opponent and a best-of-three, five or seven match. Pick **Rock**, **Paper** or **Scissors** each round. Choices stay hidden until both are in, then the result and score update.

## End a game early

Every board has an X button.

- **UNO**: **End game**. It asks "End this game?" first.
- **Chess**: **Resign**. It asks "Resign and end this game?" first.
- **Poker**: **End game**. It asks "End this poker game?" first. After the session ends it reads **Close**.
- **8-Ball Pool**: **End game**. It asks "End this pool game?" first. After the match ends it reads **Close**.
- **Tic-Tac-Toe** and **Rock-Paper-Scissors**: use the board's close or end button to clear the match.

Ending a game early deletes its state and records no winner.

## Let characters start games on their own

Open **Chat Settings → Agents → Commands**, or use the **Automation** step when you create the chat. The master **Commands** switch gates all character-run actions, including table games, selfies and calls. With it off, characters start nothing on their own.

Each installed game has its own switch, on unless you turn it off: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** and **Rock-Paper-Scissors**. See [Choose which Commands a character can use](getting-started.md#choose-which-commands-a-character-can-use).

These switches control only what characters do. A game's slash command and the "let's play" phrase work even when its switch is off.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Slash Commands Reference](../chats/slash-commands.md)
