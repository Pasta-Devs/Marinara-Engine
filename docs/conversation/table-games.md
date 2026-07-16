# Conversation Table Games

This guide covers the six optional table-game packages you can play against a chat's characters in Conversation Mode: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe**, and **Rock-Paper-Scissors**. It explains how to start a game and what each setup option means. It also shows how to play each board and how to let characters start games on their own.

## What table games are

Table games are small tabletop games that run right inside a Conversation Mode chat. Marinara Engine deals the cards or sets up the board, and it enforces every rule for you. Each seated character narrates its own moves in character. A live board appears above the message box while you play.

Install each game you want from **Agents → Download Agents**. It becomes available immediately without restarting Marinara. An uninstalled game does not appear in the games picker, its slash command is unavailable, and its character command setting stays hidden.

Two facts to keep in mind:

- Table games work in Conversation Mode only. You cannot start one in a Roleplay or Game Mode chat. If you type a game command in a Roleplay chat, you see a message such as "UNO can only be played in conversation chats."
- Only one game can be active per chat at a time. Starting a new game replaces any game already running in that chat, even a finished one still showing its end banner.

You also need at least one character in the chat. You must seat at least one of them as a bot before you can deal or start. Bot moves and in-character lines use the same connection as your normal chat replies. No extra account or API key is needed. An **API key** is the secret code that lets Marinara talk to an AI provider.

## Starting a game

There are three ways to start a game. All three work only in a Conversation Mode chat with at least one character.

### Type a slash command

A **slash command** is a short instruction you type in the message box that starts with a forward slash. Type one of these and press Enter to open that game's setup window:

- **/uno** starts a game of UNO with the characters in this chat.
- **/chess** starts a one-on-one chess game with a character in this chat.
- **/poker** starts a game of Texas Hold'em poker with the characters in this chat.
- **/8ball** (or **/pool**) starts a one-on-one game of 8-ball pool with a character in this chat.
- **/tictactoe** (or **/ttt**) starts a one-on-one game of tic-tac-toe with a character in this chat.
- **/rps** starts a one-on-one Rock-Paper-Scissors match with a character in this chat.

### Say it in chat

You can also just ask in a normal message. A message like "let's play uno", "start a game of chess", or "deal me into poker" opens that game's setup window automatically. Your message still sends as normal, so a character can react to your invite in the same reply. This only happens when that game is not already running in the chat.

### Let a character invite you

A character can offer a game (or accept your offer) on its own. When a character is willing to play right now, its reply starts the game immediately with the chat's default rules. No setup window appears. If the character is busy or does not want to play, it just says so in character.

For this path to work, the chat's **Commands** setting must be on, and that game's own toggle must be on too. See "Let characters start games on their own" below.

## UNO

### Set up UNO

The setup window is titled **Start UNO**.

In the **Players** section, tick each character you want to play as a bot. Every character in the chat is ticked by default. The **You go first** checkbox is ticked by default and gives you the opening turn. If the chat has no characters, the section reads "Add at least one character to this chat to play."

The **House rules** section holds optional rules. All of them are off by default. Turn on any you like:

| Rule | What it does |
|---|---|
| **Stacking** | Stack +2/+4 onto the next player instead of drawing. |
| **Draw to match** | Keep drawing until you draw a playable card. |
| **7-0 rule** | 7 swaps hands with a chosen player; 0 rotates all hands. |
| **Jump-in** | Play an identical card out of turn. |
| **Force play** | If a drawn card is playable, you must play it. |

Below the rules, **Starting hand** sets how many cards each player starts with. The default is **7**, and you can pick any value from 1 to 10. The **Penalize missed UNO** checkbox is ticked by default. When it is on, a player caught not declaring UNO draws 2 cards, and the "Catch!" mechanic is active. When it is off, there is no penalty.

Click **Cancel** to close the window, or click **Deal** to start. The Deal button shows the total number of seats, for example **Deal (3p)** for you plus two bots. It stays disabled until at least one character is selected. UNO seats 2 to 10 players in total.

### Play the UNO board

The board appears above the message box, titled **UNO**. It shows the active color and a direction arrow that flips on a Reverse. It also shows the draw pile count as "Draw pile: N", plus a "+N" badge when a draw penalty is stacked. The turn line reads "Your turn" on your turn or the character's name otherwise.

Seats are listed in play order. Your seat is marked "(you)", the seat about to go is marked "next", and any seat down to one card shows "UNO?". If an opponent reaches one card without declaring UNO, a **Catch!** button lets you call them out. This only appears when the **Penalize missed UNO** rule is on.

Your hand shows as clickable cards. Playable cards lift and highlight; the rest dim. Clicking a wild card opens a "Pick a color:" chooser. With the **7-0 rule** on, clicking a 7 opens a "Swap hands with:" chooser. Extra buttons appear as needed, such as **Draw**, **Pass**, and a highlighted **Call UNO!** when you must declare. Playing your second-to-last card declares UNO for you at the same time, so a bot cannot catch you in that instant.

When the game ends, a banner reads "{winner} wins!" or "Game over" if there is no clear winner.

## Chess

### Set up Chess

The setup window is titled **Start Chess**. Chess is always one-on-one, so exactly two seats play.

In the **Opponent** section, pick a single character with the radio buttons. The first character is selected by default. Even in a group chat, only one character is seated as your opponent. The others keep chatting normally.

In the **Your color** section, choose **White**, **Random**, or **Black**. **Random** is the default. A note reads "White moves first."

Click **Cancel** to close the window, or click **Start game** to begin.

### Play the Chess board

The board appears titled **Chess**, with an 8x8 grid and hand-drawn pieces. Each side's chip shows the enemy pieces it has captured and a "+N" material lead. The turn line reads "Your turn" on your turn, or shows the character's name on theirs. It adds a check warning when you are in check.

Click one of your own pieces to select it. Legal moves show as a dot on empty squares and a ring on captures. The last move and any check are highlighted, and the edges are labeled with ranks and files. When you play Black, the board flips so your side sits at the bottom. A pawn that reaches the last rank opens a "Promote to:" picker with Queen, Rook, Bishop, and Knight.

When the game ends, a banner announces the winner by checkmate, a draw with its reason (such as stalemate or the fifty-move rule), or "Game over". A short move-history strip below the board lists recent moves in standard notation.

## Poker

### Set up Poker

The setup window is titled **Start Poker**. The table seats 2 to 8 players, meaning you plus up to seven characters.

In the **Players** section, tick the characters you want seated. Once seven are ticked, the rest gray out. A note reads "8 seats max (you + up to 7 characters)."

The **Dealer** section is a dropdown. The default is **House dealer (silent)**, which deals without commentary. You can instead pick any character to announce the hands, flops, and showdowns in their own voice. The cards are dealt fairly either way, and a dealer does not have to be a seated player.

The **Stakes** section has four number boxes:

| Setting | Default | Notes |
|---|---|---|
| **Starting stack** | **1000** | Chips each player starts with (100 to 1,000,000). |
| **Small blind** | **10** | The big blind is always double this. |
| **Blinds double every** | **0** | Number of hands between blind increases. 0 means never. |
| **Hand limit** | **0** | 0 means play until only one player has chips. |

When you set a **Hand limit**, the session ends after that many hands and the player with the most chips wins.

Click **Cancel** to close the window, or click **Deal** to start. The Deal button shows the seat count, for example **Deal (4p)**.

### Play the Poker board

The board header shows the current hand, street, and blinds, along with the total pot. The turn line reads "Your turn" or the current character's name. Five community-card slots sit above the seats.

Each seat shows the player's name, "(you)" on yours, a "D" badge for the dealer button, and "SB" or "BB" for the blinds. It also shows chip count and status, such as a current bet, "folded", "all in", or "busted". Your own two hole cards appear larger under "Your hand". A plain-English label shows once you have a hand, for example "Full house, kings over nines".

On your turn, an action bar gives you **Fold**, **Check**, **Call**, and a highlighted **All in**. When you can bet or raise, a bet box appears with **Min**, **½ pot**, **Pot**, and **All-in** quick buttons plus a submit button.

At the end of each hand, a **Showdown** panel reveals the hands and awards the pot. A **Next hand** button deals the next round. When the whole session ends, a banner names the session winner and lists every seat's final chip count.

## 8-Ball Pool

### Set up 8-Ball Pool

The setup window is titled **Start 8-Ball Pool**. Pool is one-on-one, so you play against a single character.

- **Opponent**: pick the character you play against.
- **Announcer**: optional. The default is **Silent (no announcer)**. Pick a character to call the shots in their own voice.
- **Match length**: **Race to 1**, **Race to 3**, or **Race to 5**. This is how many racks you need to win the match. A rack is one full game of pool.
- **Who breaks first**: **You**, **Random**, or **Them**. A note reads "Later racks alternate the break."

Click **Start game** to begin. The button reads "Racking up..." while the table is set.

### Play the 8-Ball Pool board

The board shows a top-down pool table with the real position of every ball. On your turn, the turn line reads "Your turn". On the character's turn it shows their name with "is thinking...". You shoot by picking one of the suggested shots, and the balls then roll on the table using a physics simulation. A line under the table describes the last shot, or reads "Rack over." between racks.

## Tic-Tac-Toe

Tic-Tac-Toe is one-on-one. The setup chooses the opponent and whether you play **X**, **O**, or a random mark. X moves first. During your turn, click an empty square. Marinara blocks illegal moves, asks the character for its move in character, and detects wins and draws automatically.

## Rock-Paper-Scissors

Rock-Paper-Scissors is one-on-one. The setup chooses the opponent and a best-of-three, best-of-five, or best-of-seven match. Pick **Rock**, **Paper**, or **Scissors** each round. Your opponent's choice stays hidden until both choices are ready, then Marinara reveals the result and updates the match score.

## Ending a game

Every board has a button to end the game early, marked with an X icon.

- On the UNO board it is labeled **End game** and asks "End this game?" first.
- On the Chess board it is labeled **Resign** and asks "Resign and end this game?" first.
- On the Poker board it is labeled **End game** while a hand is in play and asks "End this poker game?" first. Once the whole session has finished, it changes to **Close** and needs no confirmation.
- On the 8-Ball Pool board it is labeled **End game** and asks "End this pool game?" first. Once the match has finished, it changes to **Close** and needs no confirmation.
- On Tic-Tac-Toe and Rock-Paper-Scissors, use the board's close or end control to clear the current match.

Ending a game deletes its state. No winner is recorded when you end a game early this way.

## Let characters start games on their own

You control whether a character can offer or accept a game in **Chat Settings → Agents**, in the **Commands** controls. You can also set these during the new-chat setup wizard, in its **Automation** step.

The master **Commands** toggle is on by default. It controls all character-run commands, including the table games, selfies, memories, and calls. Turning it off stops characters from starting anything on their own.

Under Commands, each installed game has its own toggle, and all six are on by default:

- **UNO**: "Let characters start a game of UNO at the table when you agree to play."
- **Chess**: "Let characters accept a one-on-one chess challenge at the table."
- **Poker**: "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool**: "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe**: "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors**: "Let characters accept a one-on-one rock-paper-scissors match at the table."

These toggles only control the character-run path. An installed game's slash command and "let's play" chat phrase still work when its character toggle is off.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Slash Commands Reference](../chats/slash-commands.md)
