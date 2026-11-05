# Die Chatliste verwalten

Im Panel **Chats** links liegen alle deine Chats. Dort startest, findest, sortierst, ordnest und löschst du Chats.

## Chatliste und Modus-Tabs

Oben im Panel sitzen drei Modus-Tabs. Jeder Tab listet nur die Chats seines Modus.

| Tab | Modus |
| --- | --- |
| **CONVO** | Conversation: ein Chat im Messenger-Stil. |
| **RP** | Roleplay: eine Szene mit Charakteren und Weltverfolgung. |
| **GM** | Game: ein Einzelspieler-Rollenspiel, das die KI leitet. |

Jede Zeile zeigt den Chatnamen und die Avatare seiner Charaktere. In Conversation-Chats zeigt ein farbiger Punkt an einem Avatar den Status dieses Charakters. Ein rotes Abzeichen nennt die Zahl der ungelesenen Nachrichten. Eine Zeile mit einem kleinen Verzweigungssymbol und einer Zahl ist ein Chat mit mehreren Verzweigungen, die zu einer Zeile zusammengefasst sind. Siehe [Chat-Verzweigungen](branches.md).

## Einen Chat starten

Bevor du anfängst: Füge unter **Connections** (Verbindungen) mindestens ein Konto hinzu. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Klick auf den Tab des gewünschten Modus.
2. Tipp oben im Panel auf die Schaltfläche **+**. Ihre Beschriftung lautet passend zum Tab **New Conversation**, **New Roleplay** oder **New Game**.

Marinara legt den Chat an und öffnet ihn. Daneben öffnen sich **Chat Settings** (Chat-Einstellungen) und ein Einrichtungsassistent. Der Chat heißt anfangs **New Conversation**, **New Roleplay** oder **New Game**. Hast du für Conversation oder Roleplay ein mit Stern markiertes Standard-Einstellungsprofil gespeichert, wendet Marinara es auf den neuen Chat an. Siehe [Einstellungsprofile](settings-profiles.md).

Wenn es nicht funktioniert hat: Ist noch kein Konto gespeichert, öffnet sich statt eines Chats das Fenster **Add account** (Konto hinzufügen). Wähl einen Dienst, klick auf **Connect** (Verbinden) und wähl dann ein Modell. Die vollständigen Schritte stehen in [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

## Einen Chat importieren

Du kannst einen `.jsonl`-Chatverlauf aus SillyTavern oder Marinara importieren.

1. Klick auf den Tab des Modus, in dem der Chat landen soll.
2. Tipp oben im Panel auf die Schaltfläche **Import** (Importieren). Ihre Beschriftung lautet **Import SillyTavern or Marinara chat JSONL**.
3. Wähl deine `.jsonl`-Datei.

Marinara legt den Chat an, öffnet ihn und zeigt **Imported N messages**. Zu Exportformaten und zum Sammelexport siehe [Chats exportieren und importieren](export-import.md).

Wenn es nicht funktioniert hat: Eine kleine Meldung unten am Bildschirm lautet **Import failed** und nennt den Grund. Nur `.jsonl`-Dateien werden akzeptiert.

## Einen Chat umbenennen

Den Chatnamen siehst nur du. Er wird nicht an das Modell gesendet.

1. Öffne den Chat und dann **Chat Settings**.
2. Klick unter **Chat Name** (Chatname) auf den aktuellen Namen.
3. Tipp den neuen Namen ein und drück <kbd>Enter</kbd> oder klick auf das Häkchen.

Wie du das Panel öffnest, steht in [Chat Settings](chat-settings.md).

<a id="delete-a-chat"></a>

## Einen Chat löschen

1. Tipp in der Zeile des Chats auf die Papierkorb-Schaltfläche. Am Computer erscheint sie, wenn du auf die Zeile zeigst.
2. Klick im Dialogfenster **Delete Chat** auf **Delete** (Löschen).

Löschen ist endgültig. Es stoppt außerdem eine Antwort, die für diesen Chat noch geschrieben wird.

Hat der Chat mehrere Verzweigungen, nennt das Dialogfenster ihre Zahl und bietet zwei Möglichkeiten:

- **Delete This Branch Only** (Nur diese Verzweigung löschen) entfernt die Verzweigung, die du angeklickt hast.
- **Delete All N branches** (Alle N Verzweigungen löschen) entfernt jede Verzweigung der Gruppe.

Um Verzweigungen zu verwalten, ohne den Chat zu löschen, siehe [Chat-Verzweigungen](branches.md).

Die appweite Einstellung **Confirm before deleting** (Vor dem Löschen nachfragen) steuert diese Dialogfenster. Sie ist standardmäßig an. Du findest sie unter **Settings → General**.

## Chat-Ordner

Ordner gruppieren Chats innerhalb eines Modus-Tabs.

1. Öffne einen Tab mit mindestens einem Chat. Nur dann erscheint unter den Tabs **New Folder** (Neuer Ordner).
2. Klick auf **New Folder**. Der Ordner heißt **unnamed** (danach **unnamed 2**, **unnamed 3**).

| Vorhaben | So geht's |
| --- | --- |
| Einen Ordner umbenennen | Doppelklick oder Doppeltipp darauf, oder fokussiere ihn und drück <kbd>F2</kbd>. Ein leerer Name wird ignoriert. |
| Einen Ordner löschen | Klick in der Ordnerzeile auf die Papierkorb-Schaltfläche. Enthält der Ordner Chats, erscheint ein Dialogfenster **Delete Folder**. Die Chats wandern auf die oberste Ebene und werden nicht gelöscht. |
| Ordner umsortieren | Zieh einen Ordner nach oben oder unten. Das Sortiermenü springt auf **Custom** (Benutzerdefiniert). |
| Einen Chat in einen Ordner legen | Zieh die Chatzeile auf den Ordner. Auf einem Touchscreen hältst du den Chat zuerst etwa eine halbe Sekunde gedrückt. |
| Einen Chat aus einem Ordner nehmen | Zieh ihn auf die freie Fläche unterhalb der Ordner. |

Sind mehrere Chats ausgewählt, verschiebt das Ziehen eines davon die ganze Auswahl. Chats außerhalb von Ordnern stehen unterhalb der Ordner.

## Suchen, sortieren und filtern

### Einen Chat nach Namen finden

Jeder Tab hat ein Suchfeld. Sein Platzhalter lautet **Search conversations**, **Search roleplays** oder **Search games**. Tipp ein Wort ein. Gesucht wird in Chatnamen, Tags und Charakternamen, nicht im Nachrichtentext.

### Eine Nachricht in allen Chats finden

1. Tipp auf **Search all chats** (alle Chats durchsuchen), die Schaltfläche neben dem Sortiermenü.
2. Tipp deine Suchbegriffe ein.

Die Suche läuft über jeden Chat und kann nach Modus, Charakter, Absender und Datum filtern.

Das Sortiermenü (**Sort chats**) bietet diese Optionen:

| Option | Reihenfolge |
| --- | --- |
| **Custom** | Deine Ordnerreihenfolge. |
| **Manual order** (manuelle Reihenfolge) | Chats in der Reihenfolge, in die du sie ziehst. Mit der Tastatur fokussierst du einen Chat und drückst <kbd>Alt</kbd>+<kbd>Pfeil nach oben</kbd> oder <kbd>Alt</kbd>+<kbd>Pfeil nach unten</kbd>. |
| **Recent** (zuletzt aktiv) | Zuletzt aktive Chats zuerst. Das ist der Standard. |
| **Newest** | Zuletzt erstellte Chats zuerst. |
| **Oldest** | Älteste Chats zuerst. |
| **A-Z** und **Z-A** | Nach Name. |

Hat irgendein Chat im Tab ein Tag, erscheint ein Chip **Tags (N)**. Klick darauf, um die Tags aufzuklappen, und dann auf ein Tag, um nur Chats mit diesem Tag zu zeigen. Klick auf **Clear** (Zurücksetzen), um den Filter zu entfernen. In diesem Panel kannst du einem Chat keine Tags hinzufügen.

Die Liste zeigt 100 Chats auf einmal. Klick auf **Load more** (Mehr laden), um den nächsten Schwung zu sehen.

<a id="selecting-multiple-chats"></a>

## Mehrere Chats auswählen

1. Klick oben im Panel auf die Häkchen-Schaltfläche **Select chats** (Chats auswählen).
2. Klick jeden gewünschten Chat an. Statt sich zu öffnen, zeigen die Zeilen nun ein Kontrollkästchen.
3. Nutze die Leiste unten, die anzeigt, wie viele Chats ausgewählt sind.

**Export** (Exportieren) lädt die ausgewählten Chats als eine `.zip`-Datei mit `.jsonl`-Dateien herunter. **Delete** fordert dich in einem Dialogfenster **Delete Chats** zur Bestätigung auf und entfernt sie dann. Klick erneut auf die Häkchen-Schaltfläche, um den Auswahlmodus zu verlassen. Auch ein Tab-Wechsel hebt die Auswahl auf.

## Recent chats auf dem Home-Bildschirm

Der Home-Bildschirm hat ein Widget **Recent chats** (Letzte Chats) mit deinen neuesten Chats. Jeder zeigt seinen Namen, ein Modus-Abzeichen und seine letzte Nachricht. Klick auf einen Chat, um ihn zu öffnen. Ohne Chats steht dort **Your chats will show here**. Siehe [Home-Widgets](../home/welcome.md#home-widgets).
