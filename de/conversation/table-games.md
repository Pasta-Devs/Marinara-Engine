# Tischspiele in Conversation

Spiele UNO, Schach, Poker, 8-Ball Pool, Tic-Tac-Toe und Schere, Stein, Papier gegen die Charaktere eines Conversation-Chats. Marinara teilt die Karten aus, baut das Spielfeld auf, achtet auf jede Regel, und jeder Charakter am Tisch erzählt seine Züge im Rollenspiel-Ton. Während du spielst, erscheint über dem Nachrichtenfeld ein lebendes Spielfeld.

Jedes Spiel ist ein optionales Paket. Installiere die, die du willst, über **Agents → Agent Organizer** und starte Marinara neu, wenn der Katalog dazu auffordert. Ein Spiel, das du nicht installiert hast, hat keinen Slash-Befehl, erscheint nicht in der Spieleauswahl, und sein Schalter **Commands** bleibt verborgen.

Regeln, die für jedes Spiel gelten:

- Tischspiele funktionieren nur in Conversation Mode. In einem Roleplay-Chat siehst du eine Nachricht, dass Spiele nur in Conversation-Chats gespielt werden können.
- Pro Chat kann immer nur ein Spiel aktiv sein. Ein neues Spiel zu starten ersetzt das aktuelle, auch ein beendetes, das noch sein Endbanner zeigt.
- Der Chat braucht mindestens einen Charakter, und du musst mindestens einen davon als Bot setzen. Züge der Bots nutzen dasselbe Modell wie die normalen Chat-Antworten. Ein zusätzliches Konto oder ein API-Key ist nicht nötig.

## Ein Spiel starten

Bevor du anfängst: Installiere das Spiel und öffne einen Conversation-Chat mit mindestens einem Charakter.

1. Tippe den Slash-Befehl des Spiels (eine kurze Anweisung, die mit `/` beginnt) in das Nachrichtenfeld und drücke <kbd>Enter</kbd>. Das Einrichtungsfenster des Spiels öffnet sich.
2. Wähle die Optionen (siehe jedes Spiel unten).
3. Klicke auf **Deal** oder **Start game**.

Wenn es nicht funktioniert hat: Der Befehl fehlt oder tut nichts, wenn das Spiel nicht installiert ist oder du nicht in einem Conversation-Chat bist.

| Spiel | Befehl | Mitspielende |
| --- | --- | --- |
| UNO | `/uno` | Du plus 1 bis 9 Charaktere |
| Chess | `/chess` | Du und ein Charakter |
| Poker | `/poker` | Du plus 1 bis 7 Charaktere |
| 8-Ball Pool | `/8ball` oder `/pool` | Du und ein Charakter |
| Tic-Tac-Toe | `/tictactoe` oder `/ttt` | Du und ein Charakter |
| Rock-Paper-Scissors | `/rps` | Du und ein Charakter |

Andere Wege, ein Spiel zu starten:

- Tippe `/games`, um aus den installierten Spielen zu wählen.
- Sage es in einer normalen Nachricht, etwa „let's play uno“, „start a game of chess“ oder „deal me into poker“. Das Einrichtungsfenster öffnet sich, und deine Nachricht wird trotzdem gesendet, sodass ein Charakter auf deine Einladung reagieren kann. Das geschieht nur, wenn dieses Spiel noch nicht läuft.
- Ein Charakter kann von sich aus ein Spiel anbieten oder annehmen. Seine Antwort startet das Spiel dann sofort mit den Standardregeln und ohne Einrichtungsfenster. Ist er beschäftigt oder lehnt ab, sagt er das im Rollenspiel-Ton.
- Ein Charakter kann das nur tun, wenn der Schalter **Commands** des Spiels an ist (siehe [Charaktere selbst Spiele starten lassen](#let-characters-start-games-on-their-own)).

## UNO

Das Einrichtungsfenster heißt **Start UNO**.

- **Players**: Hake jeden Charakter an, der als Bot mitspielt. Alle sind standardmäßig angehakt. **You go first** ist standardmäßig angehakt.
- **Starting hand**: Karten pro Spieler, 1 bis 10. Standard ist **7**.
- **Penalize missed UNO**: angehakt. Wer ohne Ansage von UNO erwischt wird, zieht 2 Karten, und **Catch!** ist aktiv.
- **House rules**, alle standardmäßig aus:
  - **Stacking**: +2/+4 an die nächste Person weitergeben, statt zu ziehen.
  - **Draw to match**: weiterziehen, bis du eine spielbare Karte ziehst.
  - **7-0 rule**: Eine 7 tauscht die Hand mit einer gewählten Person, eine 0 rotiert alle Hände.
  - **Jump-in**: eine identische Karte außer der Reihe spielen.
  - **Force play**: Ist eine gezogene Karte spielbar, musst du sie spielen.

**Deal** bleibt deaktiviert, bis du mindestens einen Charakter ankreuzt. Es zeigt die Zahl der Spielenden, zum Beispiel **Deal (3p)** für dich und zwei Bots.

Auf dem Spielfeld:

- Spielbare Karten heben sich ab, der Rest wird blass. Klicke auf eine Karte, um sie zu spielen.
- Eine Wildcard öffnet „Pick a color:“. Mit **7-0 rule** an öffnet eine 7 „Swap hands with:“.
- Schaltflächen erscheinen nach Bedarf: **Draw**, **Pass**, **Call UNO!** und **Catch!**.
- Spielst du deine vorletzte Karte, sagt Marinara UNO für dich an.
- Ein Banner zeigt „{winner} wins!“ oder „Game over“.

## Chess

Das Einrichtungsfenster heißt **Start Chess**. Wähle einen **Opponent** (standardmäßig der erste Charakter). In einem Gruppenchat unterhalten sich die anderen weiter. **Your color** ist **White**, **Random** (Standard) oder **Black**. Klicke auf **Start game**.

Klicke auf eine deiner Figuren, um sie auszuwählen. Legale Züge erscheinen als Punkt, Schlagzüge als Ring. Spielst du Schwarz, dreht sich das Brett. Ein Bauer auf der letzten Reihe öffnet „Promote to:“ (Queen, Rook, Bishop, Knight). Ein Banner kündigt Schachmatt an, ein Remis mit seinem Grund oder „Game over“, und ein Streifen unter dem Brett listet die letzten Züge.

## Poker

Das Einrichtungsfenster heißt **Start Poker**. Der Tisch hat Platz für 2 bis 8 Spielende.

- **Players**: Hake die Charaktere an, die sitzen sollen. Bei sieben werden die übrigen ausgegraut.
- **Dealer**: **House dealer (silent)** (Standard) gibt ohne Kommentar aus. Oder wähle einen Charakter, der Blätter und Showdowns ansagt.
- **Starting stack**: Chips pro Spieler, 100 bis 1.000.000. Standard ist **1000**.
- **Small blind**: Der Big Blind ist doppelt so hoch. Standard ist **10**.
- **Blinds double every**: Blätter, bevor die Blinds steigen. Standard ist **0**, also nie.
- **Hand limit**: Die Sitzung endet nach dieser Zahl von Blättern, und wer die meisten Chips hat, gewinnt. Standard ist **0**, das heißt: spielen, bis nur noch ein Spieler Chips hat.

Wenn du dran bist, zeigt die Leiste **Fold**, **Check**, **Call** und **All in**. Kannst du setzen oder erhöhen, fügt ein Einsatzfeld die Schaltflächen **Min**, **½ pot**, **Pot** und **All-in** hinzu. Nach jedem Blatt vergibt ein Panel **Showdown** den Pot, und **Next hand** teilt wieder aus. Am Ende nennt ein Banner den Gewinner und listet jeden letzten Stack.

## 8-Ball Pool

Das Einrichtungsfenster heißt **Start 8-Ball Pool**.

- **Opponent**: der Charakter, gegen den du spielst.
- **Announcer**: standardmäßig **Silent (no announcer)**. Optional kann ein Charakter, der die Stöße ansagt, gewählt werden.
- **Match length**: **Race to 1**, **Race to 3** oder **Race to 5** Racks (ein Rack ist eine vollständige Partie).
- **Who breaks first**: **You**, **Random** oder **Them**. Spätere Racks wechseln den Anstoß ab.

Klicke auf **Start game**. Wenn du dran bist, wähle einen der vorgeschlagenen Stöße, und die Kugeln rollen in einer Physiksimulation. Eine Zeile unter dem Tisch beschreibt den letzten Stoß.

## Tic-Tac-Toe und Rock-Paper-Scissors

Wähle bei **Tic-Tac-Toe** den Gegner und ob du **X**, **O** oder ein zufälliges Zeichen spielst. X beginnt zuerst. Klicke auf ein leeres Feld, wenn du dran bist. Unerlaubte Züge werden blockiert, und Siege und Unentschieden werden erkannt.

Wähle bei **Rock-Paper-Scissors** den Gegner und ein Match über drei, fünf oder sieben Runden. Wähle **Rock**, **Paper** oder **Scissors**. Die Wahl bleibt verborgen, bis beide gewählt haben, dann werden das Ergebnis und der Spielstand aktualisiert.

## Ein Spiel vorzeitig beenden

Jedes Spielfeld hat eine X-Schaltfläche.

- **UNO**: **End game**. Es fragt zuerst „End this game?“.
- **Chess**: **Resign**. Es fragt zuerst „Resign and end this game?“.
- **Poker**: **End game**. Es fragt zuerst „End this poker game?“. Nach dem Ende der Sitzung heißt sie **Close**.
- **8-Ball Pool**: **End game**. Es fragt zuerst „End this pool game?“. Nach dem Ende des Matches heißt sie **Close**.
- **Tic-Tac-Toe** und **Rock-Paper-Scissors**: Die Schaltfläche Close oder End des Spielfelds räumt das Match.

Ein Spiel vorzeitig zu beenden löscht seinen Stand und vermerkt keinen Sieger.

<a id="let-characters-start-games-on-their-own"></a>

## Charaktere selbst Spiele starten lassen

Öffne **Chat Settings → Agents → Commands**, oder den Schritt **Automation**, wenn du den Chat erstellst. Der Hauptschalter **Commands** steuert alle Aktionen, die Charaktere selbst auslösen, auch Tischspiele, Selfies und Anrufe. Ist er aus, beginnen Charaktere von sich aus nichts.

Jedes installierte Spiel hat einen eigenen Schalter, der an ist, solange du ihn nicht ausschaltest: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** und **Rock-Paper-Scissors**. Siehe [Wählen, welche Commands ein Charakter nutzen darf](getting-started.md#choose-which-commands-a-character-can-use).

Diese Schalter steuern nur, was Charaktere tun. Der Slash-Befehl eines Spiels und die Formulierung „let's play“ funktionieren auch, wenn sein Schalter aus ist.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Referenz der Slash-Befehle](../chats/slash-commands.md)
