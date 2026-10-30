# Tischspiele im Conversation Mode

In dieser Anleitung erfährst du, wie du die sechs optionalen Tischspiel-Pakete gegen die Charaktere eines Chats im Conversation Mode spielst: **UNO**, **Chess** (Schach), **Poker**, **8-Ball Pool** (Poolbillard), **Tic-Tac-Toe** und **Rock-Paper-Scissors** (Schere, Stein, Papier). Sie erklärt, wie ein Spiel startet und was die einzelnen Einrichtungsoptionen bedeuten. Außerdem zeigt sie, wie du jedes Spielfeld bedienst und wie Charaktere von sich aus ein Spiel beginnen.

## Was Tischspiele sind

Tischspiele sind kleine Brett- und Kartenspiele, die direkt in einem Chat im Conversation Mode laufen. Marinara Engine gibt die Karten aus oder baut das Spielfeld auf und achtet auf jede Regel. Jeder Charakter am Tisch erzählt seine eigenen Züge im Rollenspiel-Ton. Während des Spiels erscheint ein lebendes Spielfeld über dem Nachrichtenfeld.

Installiere jedes gewünschte Spiel über **Agents → Agent Organizer (Agentenverwaltung)**. Es steht sofort bereit, ganz ohne Neustart von Marinara. Ein nicht installiertes Spiel taucht in der Spieleauswahl nicht auf, sein Slash-Befehl funktioniert nicht, und seine Einstellung für Charakter-Befehle bleibt ausgeblendet.

Zwei Dinge sind wichtig:

- Tischspiele laufen ausschließlich im Conversation Mode. In einem Roleplay- oder Game-Mode-Chat lässt sich keins starten. Tippst du dort einen Spielbefehl ein, erscheint ein Hinweis wie "UNO can only be played in conversation chats."
- Pro Chat ist immer nur ein Spiel aktiv. Ein neues Spiel ersetzt das laufende – auch ein bereits beendetes, das noch sein Endbanner zeigt.

Außerdem brauchst du mindestens einen Charakter im Chat. Mindestens einer davon muss als Bot am Tisch sitzen, bevor du austeilen oder starten kannst. Für die Züge der Bots und ihre Sprechzeilen gilt dieselbe Verbindung wie für normale Chat-Antworten. Ein zusätzliches Konto oder ein eigener API-Key ist nicht nötig. Ein **API key** (API-Key) ist der geheime Zugangscode, mit dem Marinara mit einem KI-Anbieter spricht.

## Ein Spiel starten

Es gibt drei Wege, ein Spiel zu starten. Alle drei funktionieren nur in einem Chat im Conversation Mode mit mindestens einem Charakter.

### Slash-Befehl tippen

Ein **Slash-Befehl** ist eine kurze Anweisung im Nachrichtenfeld, die mit einem Schrägstrich beginnt. Tippe einen dieser Befehle und drück Enter, um das Einrichtungsfenster des Spiels zu öffnen:

- **/uno** startet eine Partie UNO mit den Charakteren dieses Chats.
- **/chess** startet eine Schachpartie eins gegen eins mit einem Charakter dieses Chats.
- **/poker** startet eine Partie Texas Hold'em mit den Charakteren dieses Chats.
- **/8ball** (oder **/pool**) startet eine Partie 8-Ball Pool eins gegen eins mit einem Charakter dieses Chats.
- **/tictactoe** (oder **/ttt**) startet eine Partie Tic-Tac-Toe eins gegen eins mit einem Charakter dieses Chats.
- **/rps** startet ein Match Schere, Stein, Papier eins gegen eins mit einem Charakter dieses Chats.

### Im Chat danach fragen

Möglich ist auch eine ganz normale Nachricht. Sätze wie "let's play uno", "start a game of chess" oder "deal me into poker" öffnen das Einrichtungsfenster des jeweiligen Spiels automatisch. Die Nachricht geht trotzdem normal raus, sodass ein Charakter in derselben Antwort auf die Einladung reagieren kann. Das klappt nur, solange dieses Spiel im Chat noch nicht läuft.

### Einen Charakter einladen lassen

Ein Charakter kann von sich aus ein Spiel vorschlagen oder deinen Vorschlag annehmen. Hat er gerade Lust, startet seine Antwort das Spiel sofort mit den Standardregeln des Chats. Ein Einrichtungsfenster erscheint dann nicht. Ist er beschäftigt oder mag nicht, sagt er das einfach im Rollenspiel-Ton.

Damit dieser Weg funktioniert, muss die Einstellung **Commands** (Befehle) des Chats aktiv sein – und zusätzlich der Schalter des jeweiligen Spiels. Mehr dazu unter „Charaktere selbst Spiele starten lassen“ weiter unten.

## UNO

### UNO einrichten

Das Einrichtungsfenster heißt **Start UNO**.

Im Abschnitt **Players** (Mitspielende) hakst du jeden Charakter an, der als Bot mitspielen soll. Standardmäßig sind alle Charaktere des Chats angehakt. Das Kontrollkästchen **You go first** ist standardmäßig aktiv und gibt dir den ersten Zug. Ohne Charaktere im Chat steht im Abschnitt "Add at least one character to this chat to play."

Der Abschnitt **House rules** (Hausregeln) enthält optionale Regeln. Alle sind standardmäßig aus. Aktiviere, was dir gefällt:

| Regel | Wirkung |
|---|---|
| **Stacking** | +2/+4 an die nächste Person weiterreichen, statt zu ziehen. |
| **Draw to match** | So lange ziehen, bis eine spielbare Karte kommt. |
| **7-0 rule** | Die 7 tauscht die Hand mit einer gewählten Person, die 0 rotiert alle Hände. |
| **Jump-in** | Eine identische Karte außer der Reihe spielen. |
| **Force play** | Eine gezogene Karte muss gespielt werden, wenn sie passt. |

Unter den Regeln legt **Starting hand** fest, mit wie vielen Karten alle starten. Der Standard ist **7**, möglich sind Werte von 1 bis 10. Das Kontrollkästchen **Penalize missed UNO** ist standardmäßig aktiv. Ist es an, zieht 2 Karten, wer beim Nicht-Ansagen von UNO erwischt wird – und der "Catch!"-Mechanismus greift. Ist es aus, gibt es keine Strafe.

Klick auf **Cancel**, um das Fenster zu schließen, oder auf **Deal**, um loszulegen. Die Schaltfläche **Deal** zeigt die Gesamtzahl der Plätze, etwa **Deal (3p)** für dich plus zwei Bots. Sie bleibt inaktiv, bis mindestens ein Charakter ausgewählt ist. An einem UNO-Tisch sitzen insgesamt 2 bis 10 Mitspielende.

### Das UNO-Spielfeld bedienen

Das Spielfeld erscheint über dem Nachrichtenfeld und trägt den Titel **UNO**. Es zeigt die aktive Farbe und einen Richtungspfeil, der sich bei einer Retourkarte umdreht. Dazu kommt der Nachziehstapel als "Draw pile: N" sowie ein "+N"-Abzeichen, sobald sich eine Ziehstrafe stapelt. Die Zugzeile zeigt "Your turn", wenn du dran bist, sonst den Namen des Charakters.

Die Plätze stehen in Spielreihenfolge. Dein Platz ist mit "(you)" markiert, der nächste mit "next", und jeder Platz mit nur noch einer Karte zeigt "UNO?". Erreicht ein Gegenüber eine Karte, ohne UNO anzusagen, kannst du es über die Schaltfläche **Catch!** ertappen. Sie erscheint nur bei aktiver Regel **Penalize missed UNO**.

Deine Hand liegt als anklickbare Karten vor dir. Spielbare Karten heben sich hervor, der Rest wird blass. Ein Klick auf eine Wildcard öffnet die Auswahl "Pick a color:". Bei aktiver **7-0 rule** öffnet ein Klick auf eine 7 die Auswahl "Swap hands with:". Je nach Situation kommen weitere Schaltflächen dazu, etwa **Draw**, **Pass** und ein hervorgehobenes **Call UNO!**, wenn du ansagen musst. Wer die vorletzte Karte spielt, sagt UNO automatisch mit an – in diesem Moment kann dich also kein Bot ertappen.

Am Ende erscheint ein Banner mit "{winner} wins!" oder "Game over", wenn es keinen klaren Sieg gibt.

## Chess

### Chess einrichten

Das Einrichtungsfenster heißt **Start Chess**. Schach läuft immer eins gegen eins, es spielen also genau zwei Plätze.

Im Abschnitt **Opponent** (Gegenüber) wählst du per Optionsfeld einen einzelnen Charakter. Vorausgewählt ist der erste. Selbst im Gruppenchat sitzt nur ein Charakter dir gegenüber. Die anderen chatten ganz normal weiter.

Im Abschnitt **Your color** wählst du **White**, **Random** oder **Black**. Der Standard ist **Random**. Ein Hinweis lautet "White moves first."

Klick auf **Cancel**, um das Fenster zu schließen, oder auf **Start game**, um zu beginnen.

### Das Chess-Spielfeld bedienen

Das Spielfeld trägt den Titel **Chess** und zeigt ein 8x8-Raster mit handgezeichneten Figuren. Der Chip jeder Seite listet die geschlagenen gegnerischen Figuren und einen Materialvorsprung als "+N". Die Zugzeile zeigt "Your turn", wenn du dran bist, sonst den Namen des Charakters. Stehst du im Schach, kommt eine Warnung dazu.

Klick auf eine eigene Figur, um sie auszuwählen. Erlaubte Züge erscheinen als Punkt auf leeren Feldern und als Ring bei Schlagzügen. Der letzte Zug und ein Schachgebot werden hervorgehoben, die Ränder tragen Reihen- und Linienbezeichnungen. Spielst du Schwarz, dreht sich das Spielfeld, sodass deine Seite unten liegt. Erreicht ein Bauer die letzte Reihe, öffnet sich die Auswahl "Promote to:" mit Dame, Turm, Läufer und Springer.

Am Ende verkündet ein Banner den Sieg durch Schachmatt, ein Remis samt Grund (etwa Patt oder die Fünfzig-Züge-Regel) oder "Game over". Unter dem Spielfeld listet ein schmaler Verlaufsstreifen die letzten Züge in Standardnotation.

## Poker

### Poker einrichten

Das Einrichtungsfenster heißt **Start Poker**. Am Tisch ist Platz für 2 bis 8 Mitspielende, also für dich plus bis zu sieben Charaktere.

Im Abschnitt **Players** hakst du die Charaktere an, die mitspielen sollen. Sobald sieben angehakt sind, werden die übrigen ausgegraut. Ein Hinweis lautet "8 seats max (you + up to 7 characters)."

Der Abschnitt **Dealer** ist ein Dropdown-Menü. Der Standard ist **House dealer (silent)** – er teilt kommentarlos aus. Stattdessen kannst du jeden Charakter Blätter, Flops und Showdowns mit eigener Stimme ansagen lassen. Fair ausgeteilt wird in beiden Fällen, und wer austeilt, muss nicht selbst am Tisch sitzen.

Der Abschnitt **Stakes** (Einsätze) hat vier Zahlenfelder:

| Einstellung | Standard | Hinweise |
|---|---|---|
| **Starting stack** | **1000** | Chips, mit denen alle starten (100 bis 1.000.000). |
| **Small blind** | **10** | Der Big Blind ist immer doppelt so hoch. |
| **Blinds double every** | **0** | Anzahl der Blätter zwischen zwei Blind-Erhöhungen. 0 bedeutet nie. |
| **Hand limit** | **0** | 0 bedeutet: spielen, bis nur noch eine Person Chips hat. |

Setzt du ein **Hand limit**, endet die Sitzung nach dieser Anzahl Blätter, und wer die meisten Chips hat, gewinnt.

Klick auf **Cancel**, um das Fenster zu schließen, oder auf **Deal**, um loszulegen. Die Schaltfläche **Deal** zeigt die Zahl der Plätze, etwa **Deal (4p)**.

### Das Poker-Spielfeld bedienen

Die Kopfzeile zeigt das aktuelle Blatt, die Setzrunde und die Blinds sowie den gesamten Pot. Die Zugzeile zeigt "Your turn" oder den Namen des Charakters, der dran ist. Über den Plätzen liegen fünf Felder für die Gemeinschaftskarten.

Jeder Platz zeigt den Namen, bei dir "(you)", ein "D"-Abzeichen für den Dealer-Button und "SB" oder "BB" für die Blinds. Dazu kommen Chipstand und Status, etwa der aktuelle Einsatz, "folded", "all in" oder "busted". Deine beiden verdeckten Karten erscheinen größer unter "Your hand". Sobald ein Blatt zustande kommt, steht darunter eine Klartext-Beschreibung, zum Beispiel "Full house, kings over nines".

Bist du dran, bietet dir eine Aktionsleiste **Fold**, **Check**, **Call** und ein hervorgehobenes **All in**. Kannst du setzen oder erhöhen, erscheint ein Einsatzfeld mit den Schnellschaltflächen **Min**, **½ pot**, **Pot** und **All-in** plus einer Bestätigungsschaltfläche.

Nach jedem Blatt deckt ein **Showdown**-Panel die Karten auf und vergibt den Pot. Die Schaltfläche **Next hand** teilt das nächste Blatt aus. Ist die ganze Sitzung vorbei, nennt ein Banner die Siegerin oder den Sieger und listet den Chipstand jedes Platzes.

## 8-Ball Pool

### 8-Ball Pool einrichten

Das Einrichtungsfenster heißt **Start 8-Ball Pool**. Pool läuft eins gegen eins, du spielst also gegen einen einzelnen Charakter.

- **Opponent**: Wähle den Charakter, gegen den du antrittst.
- **Announcer** (Kommentar): optional. Der Standard ist **Silent (no announcer)**. Wähle einen Charakter, der die Stöße mit eigener Stimme kommentiert.
- **Match length**: **Race to 1**, **Race to 3** oder **Race to 5**. So viele Racks brauchst du für den Matchsieg. Ein Rack ist eine komplette Partie Pool.
- **Who breaks first**: **You**, **Random** oder **Them**. Ein Hinweis lautet "Later racks alternate the break."

Klick auf **Start game**, um zu beginnen. Während der Tisch aufgebaut wird, steht auf der Schaltfläche "Racking up...".

### Das 8-Ball-Pool-Spielfeld bedienen

Das Spielfeld zeigt den Pooltisch von oben mit der echten Position jeder Kugel. Bist du dran, steht in der Zugzeile "Your turn". Ist der Charakter dran, erscheint sein Name mit "is thinking...". Du stößt, indem du einen der vorgeschlagenen Stöße auswählst; danach rollen die Kugeln in einer Physiksimulation über den Tisch. Eine Zeile unter dem Tisch beschreibt den letzten Stoß oder zeigt zwischen zwei Racks "Rack over.".

## Tic-Tac-Toe

Tic-Tac-Toe läuft eins gegen eins. Bei der Einrichtung wählst du das Gegenüber und ob du **X**, **O** oder ein zufälliges Zeichen spielst. X beginnt. Wenn du dran bist, klick auf ein leeres Feld. Marinara verhindert unerlaubte Züge, fragt den Charakter im Rollenspiel-Ton nach seinem Zug und erkennt Siege und Unentschieden automatisch.

## Rock-Paper-Scissors

Schere, Stein, Papier läuft eins gegen eins. Bei der Einrichtung wählst du das Gegenüber und ein Match über drei, fünf oder sieben Runden. Wähle in jeder Runde **Rock**, **Paper** oder **Scissors**. Die Wahl des Gegenübers bleibt verdeckt, bis beide Seiten gewählt haben – dann zeigt Marinara das Ergebnis und aktualisiert den Matchstand.

## Ein Spiel beenden

Jedes Spielfeld hat eine Schaltfläche mit X-Symbol, um vorzeitig abzubrechen.

- Auf dem UNO-Spielfeld heißt sie **End game** und fragt vorher "End this game?".
- Auf dem Chess-Spielfeld heißt sie **Resign** und fragt vorher "Resign and end this game?".
- Auf dem Poker-Spielfeld heißt sie während eines laufenden Blatts **End game** und fragt vorher "End this poker game?". Nach dem Ende der Sitzung wird daraus **Close**, ganz ohne Rückfrage.
- Auf dem 8-Ball-Pool-Spielfeld heißt sie **End game** und fragt vorher "End this pool game?". Nach dem Ende des Matches wird daraus **Close**, ganz ohne Rückfrage.
- Bei Tic-Tac-Toe und Rock-Paper-Scissors räumst du das laufende Match über das Schließen- bzw. Beenden-Element des Spielfelds ab.

Beim Beenden verschwindet der Spielstand. Auf diesem Weg vorzeitig beendete Spiele zählen keinen Sieg.

## Charaktere selbst Spiele starten lassen

Ob ein Charakter ein Spiel vorschlagen oder annehmen darf, legst du unter **Chat Settings → Agents** (Chat-Einstellungen) bei den **Commands**-Reglern fest. Möglich ist das auch im Einrichtungsassistenten für neue Chats, im Schritt **Automation** (Automatisierung).

Der übergeordnete Schalter **Commands** ist standardmäßig an. Er steuert alle Befehle, die Charaktere selbst auslösen – die Tischspiele ebenso wie Selfies, Erinnerungen und Anrufe. Schaltest du ihn aus, beginnen Charaktere gar nichts mehr von sich aus.

Unter Commands hat jedes installierte Spiel einen eigenen Schalter, und alle sechs sind standardmäßig an:

- **UNO**: "Let characters start a game of UNO at the table when you agree to play."
- **Chess**: "Let characters accept a one-on-one chess challenge at the table."
- **Poker**: "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool**: "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe**: "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors**: "Let characters accept a one-on-one rock-paper-scissors match at the table."

Diese Schalter steuern nur den Weg über die Charaktere. Slash-Befehl und die „let's play“-Formulierung im Chat funktionieren bei einem installierten Spiel auch dann, wenn sein Charakter-Schalter aus ist.

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Referenz der Slash-Befehle](../chats/slash-commands.md)
