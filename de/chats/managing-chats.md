# Die Chatliste verwalten

In dieser Anleitung geht es um die Chatliste in Marinara Engine. Du erfährst, was die drei Modus-Tabs bedeuten und wie du Chats anlegst, importierst, umbenennst, löschst, ordnest, durchsuchst und gleich mehrere auf einmal verwaltest. Auch das Widget mit den letzten Chats auf dem Home-Bildschirm kommt zur Sprache.

## Chatliste und Modus-Tabs

Die Chats stehen im Panel **Chats**, der Seitenleiste links. Ganz oben im Panel sitzen drei Modus-Tabs:

- **CONVO** für Conversation, einen schlichten Chat im Messenger-Stil.
- **RP** für Roleplay, eine dichte Szene mit Charakteren und Weltverfolgung.
- **GM** für Game, ein Einzelspieler-Rollenspiel unter KI-Leitung.

Jeder Tab zeigt nur die Chats des jeweiligen Modus. Ein Klick auf einen Tab schaltet die Liste um.

Jede Zeile der Liste zeigt den Chatnamen und den Avatar des Charakters oder der Charaktere. In Conversation-Chats sitzt ein kleiner farbiger Punkt am Avatar und zeigt den Status jedes Charakters. Erscheint in einer Zeile ein rotes Abzeichen, steht darin die Zahl der ungelesenen Nachrichten.

Manche Zeilen tragen ein kleines Verzweigungssymbol mit einer Zahl. Das heißt: Der Chat hat mehrere Verzweigungen, und alle sind zu einer einzigen Zeile zusammengefasst. Was Verzweigungen sind, erklärt [Chat-Verzweigungen](branches.md).

## Einen neuen Chat anlegen

1. Wähle den gewünschten Modus-Tab (**CONVO**, **RP** oder **GM**).
2. Klick auf die Schaltfläche **+** oben im Panel. Ihr Tooltip (Kurzhinweis beim Draufzeigen) lautet passend zum aktiven Tab **New Conversation**, **New Roleplay** oder **New Game**.
3. Die App legt den Chat an, öffnet ihn und blendet das Panel **Chat Settings** (Chat-Einstellungen) samt Einrichtungsassistent ein, damit du die Einrichtung abschließen kannst.

Der neue Chat heißt **New Conversation**, **New Roleplay** oder **New Game**. Umbenennen lässt er sich später jederzeit (siehe „Einen Chat umbenennen“ weiter unten).

Ohne mindestens eine Verbindung öffnet sich kein Chat. Eine Verbindung koppelt Marinara an einen KI-Anbieter. Fehlt sie noch, erscheint statt des Chats das Fenster **Set Up** (Einrichten) und bittet dich, zuerst eine Verbindung zu wählen. Gibt es überhaupt keine, zeigt es **No connections found** (Keine Verbindungen gefunden) und eine Schaltfläche **Open Connections**. Wie du eine einrichtest, steht in [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

Hast du für diesen Modus ein Einstellungsprofil als Standard markiert, wendet Marinara es automatisch auf den neuen Chat an. Siehe [Chat Settings im Überblick](chat-settings.md).

## Einen Chat importieren

Importieren lässt sich jeder Chatverlauf, der als `.jsonl`-Datei vorliegt – aus SillyTavern oder aus Marinara.

1. Wähle den Modus-Tab, in dem der importierte Chat landen soll.
2. Klick auf die Schaltfläche **Import** oben im Panel. Ihr Tooltip lautet **Import SillyTavern or Marinara chat JSONL**.
3. Wähle die `.jsonl`-Datei aus.

Marinara legt im Modus des aktuellen Tabs einen neuen Chat an und öffnet ihn. Es erscheint die Meldung **Imported N messages**, wobei N für die Zahl der Nachrichten steht.

Alle Wege, Chats zu importieren und zu exportieren – auch die Sammelfunktionen und die Formate –, beschreibt [Chats exportieren und importieren](export-import.md).

## Einen Chat umbenennen

Den Chatnamen siehst nur du. Er geht nicht an die KI und verändert den Chat inhaltlich nicht.

1. Öffne den Chat.
2. Öffne **Chat Settings** über die Schaltfläche im Chat.
3. Klick im Abschnitt **Chat Name** auf den aktuellen Namen – er wird dadurch zum Textfeld.
4. Tipp den neuen Namen ein und drück Enter oder klick auf die Häkchen-Schaltfläche.

Mehr zum Panel Chat Settings steht in [Chat Settings im Überblick](chat-settings.md).

## Einen Chat löschen

Um einen einzelnen Chat zu löschen, zeig auf seine Zeile und klick auf die Papierkorb-Schaltfläche. Auf dem Handy ist sie dauerhaft sichtbar. Ein Dialogfenster mit dem Titel **Delete Chat** fragt „Delete this chat?“. Klick auf **Delete**, um zu bestätigen.

Gelöschte Chats sind endgültig weg. Läuft für den Chat noch eine Antwort, bricht Marinara sie ab.

### Das Dialogfenster zur Verzweigungswahl

Hat der Chat mehrere Verzweigungen, öffnet sich stattdessen ein anderes Fenster. Es trägt ebenfalls den Titel **Delete Chat**, weist auf die mehreren Verzweigungen hin und stellt dich vor zwei Möglichkeiten:

- **Delete This Branch Only** (Nur diese Verzweigung löschen) entfernt allein die angeklickte Verzweigung.
- **Delete All N Branches** (Alle N Verzweigungen löschen) entfernt sämtliche Verzweigungen der Gruppe; N ist ihre Anzahl.

Wie du Verzweigungen verwaltest, ohne den ganzen Chat zu löschen, zeigt [Chat-Verzweigungen](branches.md).

### Löschabfragen ein- oder ausschalten

Ob diese Sicherheitsabfragen überhaupt erscheinen, steuert die appweite Einstellung **Confirm before deleting** (Vor dem Löschen nachfragen). Sie ist standardmäßig aktiv und steht in **Settings** (Einstellungen) im Tab **General**. Der Hilfetext dort rät, sie aktiv zu lassen.

## Chat-Ordner

Innerhalb jedes Modus-Tabs lassen sich Chats in Ordnern gruppieren.

1. Achte darauf, dass der aktuelle Tab mindestens einen Chat enthält. Erst dann erscheint über der Liste die Schaltfläche **New Folder** (Neuer Ordner).
2. Klick auf **New Folder**. Der Ordner heißt zunächst **unnamed** (oder **unnamed 2**, **unnamed 3** und so weiter, falls der Name schon vergeben ist).

Zum Umbenennen doppelklickst du den Ordner, tippst ihn doppelt an oder wählst ihn aus und drückst F2. Ein leerer Name wird ignoriert.

Zum Löschen klick auf die Papierkorb-Schaltfläche in der Ordnerzeile. Ein Dialogfenster mit dem Titel **Delete Folder** bestätigt den Vorgang. Die Chats darin bleiben immer erhalten – sie wandern zurück auf die oberste Ebene.

Die Reihenfolge der Ordner änderst du, indem du eine Ordnerzeile nach oben oder unten ziehst. Dort, wo sie landen wird, öffnet sich eine Lücke. Das Sortiermenü springt dann auf **Custom** (Benutzerdefiniert), das deine Ordnerreihenfolge beibehält.

Um einen Chat in einen Ordner zu legen, zieh seine Zeile auf den Ordner. Um ihn aus allen Ordnern herauszunehmen, zieh ihn auf die freie Fläche unterhalb der Ordner. Auf dem Touchscreen hältst du einen Chat rund eine halbe Sekunde gedrückt, um das Ziehen zu starten. Sind mehrere Chats ausgewählt, wandert beim Ziehen eines davon die ganze Auswahl mit.

Chats ohne Ordner stehen in einer schlichten Liste unterhalb der Ordner.

## Suchen, sortieren und nach Tags filtern

Jeder Modus-Tab hat oben in der Liste ein eigenes Suchfeld. Der Platzhaltertext wechselt je nach Tab: **Search conversations...** (Conversations durchsuchen), **Search roleplays...** oder **Search games...**. Gesucht wird im Chatnamen, in den Tags (Schlagwörtern) und in den Namen der Charaktere – nicht im Text der Nachrichten.

Neben dem Suchfeld liegt ein Sortiermenü mit dem Tooltip **Sort chats**. Es bietet diese Optionen:

- **Custom** behält deine Ordner in der Reihenfolge, in die du sie gezogen hast.
- **Manual order** (manuelle Reihenfolge) lässt dich Chats in deine eigene Reihenfolge ziehen. Mit der Tastatur fokussierst du einen Chat und drückst Alt+Pfeil nach oben oder Alt+Pfeil nach unten.
- **Recent** (Zuletzt aktiv) ist der Standard und stellt die zuletzt aktiven Chats nach vorn.
- **Newest** zeigt die zuletzt erstellten Chats zuerst.
- **Oldest** zeigt die ältesten Chats zuerst.
- **A-Z** sortiert die Namen von A bis Z.
- **Z-A** sortiert die Namen von Z bis A.

Trägt irgendein Chat im Tab Tags, erscheint eine Filterzeile. Klick auf den Chip **Tags**, um die Tag-Liste aufzuklappen. Ein Klick auf ein Tag zeigt dann nur noch die Chats mit diesem Tag. **Clear** hebt den Filter wieder auf. Bei vielen Tags blendet ein Chip **+N more** den Rest ein.

Hinweis: Dieser Bildschirm filtert nur nach Tags, die ein Chat bereits hat. Eine Schaltfläche zum Vergeben neuer Tags gibt es hier nicht.

Die Liste zeigt höchstens 100 Chats auf einmal. Bei mehr erscheint unten die Schaltfläche **Load more** und holt den nächsten Schwung.

## Mehrere Chats auswählen

Mehrere Chats lassen sich in einem Rutsch bearbeiten.

1. Klick oben im Panel auf die Schaltfläche **Select chats** (Chats auswählen) mit dem Häkchen-Symbol.
2. Klick die gewünschten Chats an. Statt den Chat zu öffnen, setzt der Klick nun ein Kontrollkästchen in der Zeile.
3. Eine Leiste am unteren Rand zeigt die Anzahl der ausgewählten Chats und zwei Schaltflächen.

**Export** lädt alle ausgewählten Chats gemeinsam als eine `.zip`-Datei herunter. **Delete** löscht sie; vorher erscheint eine Sicherheitsabfrage mit dem Titel **Delete Chats**.

Um den Auswahlmodus ohne Aktion zu verlassen, klick erneut auf die Auswahl-Schaltfläche. Auch ein Tab-Wechsel hebt die Auswahl auf.

## Recent Chats auf dem Home-Bildschirm

Der Home-Bildschirm hat ein Widget **Recent chats** (Letzte Chats) mit deinen zuletzt aktiven Chats. Jeder Chat zeigt seinen Namen, ein Modus-Abzeichen und seine letzte Nachricht. Ein Klick auf einen Chat öffnet ihn, ein Klick auf eine leere Stelle des Widgets öffnet die Chatliste. Ohne Chats steht dort **Your chats will show here**. Siehe [Home-Widgets](../home/welcome.md#home-widgets).

## Verwandte Anleitungen

- [Chat-Verzweigungen](branches.md)
- [Chats exportieren und importieren](export-import.md)
- [Chat Settings im Überblick](chat-settings.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
