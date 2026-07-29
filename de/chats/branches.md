# Chat-Verzweigungen

In dieser Anleitung erfährst du, was eine Verzweigung in Marinara Engine ist und wie du eine anlegst. Dazu kommen Wechseln, Umbenennen, Löschen, Exportieren und Importieren. Mit einer Verzweigung probierst du einen anderen Weg im Chat aus, ohne das Original zu verlieren.

## Was eine Verzweigung ist

Eine Verzweigung ist eine Kopie des Chats, die den Verlauf bis zu einem bestimmten Punkt mitbringt. So erkundest du eine andere Richtung, während der ursprüngliche Chat unangetastet bleibt.

Alle Verzweigungen eines Chats gehören zusammen. In der Chatliste erscheint ein Chat mit mehreren Verzweigungen deshalb nur als eine Zeile. Daneben steht eine kleine Zahl mit der Anzahl der Verzweigungen. Öffnen und wechseln kannst du sie im Popover (kleines Einblendfenster) **Chat Branches** (Chat-Verzweigungen) – mehr dazu weiter unten.

Jede Verzweigung bekommt einen eigenen Anzeigenamen. Nenn sie zum Beispiel „freundliches Ende“ und „düsteres Ende“. Dieser Anzeigename ist unabhängig vom Namen des dahinterliegenden Chats.

## Die Schaltfläche „Branch from here“

Eine Verzweigung entsteht ausgehend von einer beliebigen Nachricht im Chat.

1. Zeig mit der Maus auf eine Nachricht (oder tipp sie auf dem Handy an), damit die Aktionsleiste erscheint.
2. Klick auf die Schaltfläche **Branch from here** (Ab hier verzweigen). Sie trägt ein kleines Verzweigungssymbol.

Marinara kopiert den Chat bis einschließlich dieser Nachricht in eine neue Verzweigung. Diese neue Verzweigung:

- Behält Modus, Charaktere, Persona, Prompt-Preset und Verbindung des Ursprungschats bei.
- Kopiert jede Nachricht, samt aller Swipes (alternativer Antworten) und der Angabe, welcher Swipe aktiv war. Wie Swipes funktionieren, steht in der [Anleitung zu Nachrichten-Aktionen](messages.md).
- Kopiert die Tracker- und Spielzustands-Schnappschüsse der kopierten Nachrichten, damit Roleplay- und Game-Chats ihren Zustand behalten.
- Startet mit dem Anzeigenamen **New Branch**. Umbenennen geht jederzeit (siehe unten).
- Bleibt im selben Chat-Ordner wie der Ursprungschat.

Tages- und Wochenzusammenfassungen wandern nicht mit. Laufende Zusammenfassungen mit gespeicherten Nachrichtenbereichen, die vollständig innerhalb der kopierten Verzweigung liegen, werden übernommen und auf die neuen Nachrichten-IDs der Verzweigung abgebildet. Zusammenfassungen, deren Quellbereich den Verzweigungspunkt überschreitet, sowie ältere Zusammenfassungen ohne Nachrichtenmetadaten werden ausgelassen. In der neuen Verzweigung werden diese Zusammenfassungen neu erstellt.

Szenen-Chats lassen sich nicht verzweigen. Dort fehlt die Schaltfläche **Branch from here**. Stattdessen gibt es in Szenen-Chats die eigene Aktion **Clone from here** (Ab hier klonen). Wie sie funktioniert, beschreibt [Szenen: Ein Roleplay verzweigen](../roleplay/scenes.md).

## Das Popover „Chat Branches“

Öffne das Popover über die Verzweigungs-Schaltfläche in der Chat-Werkzeugleiste. Sie trägt ein Verzweigungssymbol und zeigt die aktuelle Anzahl der Verzweigungen. Ihr Tooltip (Kurzhinweis beim Draufzeigen) lautet **Switch branch**.

Das Popover heißt **Chat Branches** und trägt den Untertitel „Switch, import, export, or clean up this chat's branches.“ Es listet alle Verzweigungen des aktuellen Chats auf, die gerade geöffnete zuerst. Jede Zeile nennt den Anzeigenamen und den Zeitpunkt der letzten Änderung.

### Zu einer anderen Verzweigung wechseln

Klick im Popover auf eine beliebige Verzweigungs-Zeile, um sie zu öffnen. Das Popover schließt sich, und die Chatansicht springt zur gewählten Verzweigung.

### Eine Verzweigung umbenennen

1. Öffne das Popover **Chat Branches**.
2. Klick in der jeweiligen Zeile auf die Stift-Schaltfläche zum Umbenennen.
3. Es öffnet sich ein Fenster mit dem Titel **Rename Branch** und dem Hinweis „Set a display name for this chat branch.“
4. Gib einen neuen Namen ein und bestätige mit der Schaltfläche **Rename**.

Ein leerer oder unveränderter Name wird ignoriert.

### Eine Verzweigung löschen

1. Öffne das Popover **Chat Branches**.
2. Klick in der Zeile auf die Papierkorb-Schaltfläche zum Löschen.
3. Ein Fenster mit dem Titel **Delete Branch** fragt „Delete this branch? Messages will be lost.“
4. Bestätige mit der Schaltfläche **Delete**.

Gelöscht werden nur diese eine Verzweigung und ihre Nachrichten. Die übrigen Verzweigungen bleiben erhalten.

### Alle Verzweigungen löschen

Hat ein Chat zwei oder mehr Verzweigungen, erscheint unten im Popover die Schaltfläche **Delete All Branches** (Alle Verzweigungen löschen). Sie fragt „Delete all N branches? This cannot be undone.“ Mit der Schaltfläche **Delete All** entfernst du alle Verzweigungen der Gruppe auf einmal.

Das geht auch direkt aus der Chatliste heraus. Lösch dort einen Chat mit Verzweigungen über das Papierkorb-Symbol. Daraufhin fragt ein Fenster mit dem Titel **Delete Chat**, was genau verschwinden soll. Zur Wahl stehen die Schaltflächen **Delete This Branch Only** (Nur diese Verzweigung löschen) und **Delete All N Branches** (Alle N Verzweigungen löschen). Mehr zum Löschen aus der Liste steht unter [Die Chatliste verwalten](managing-chats.md).

## Eine Verzweigung exportieren

Oben im Popover **Chat Branches** sitzen die Export-Schaltflächen. Sie exportieren immer die gerade geöffnete Verzweigung.

- **JSONL**: lädt die Verzweigung als JSONL-Datei herunter. JSONL heißt: eine Nachricht pro Textzeile. Dieses Format versteht auch SillyTavern.
- **Text**: lädt die Verzweigung als reines Text-Protokoll herunter.

Willst du viele Chats auf einmal exportieren, hilft [Chats exportieren und importieren](export-import.md) weiter. Dort steht auch, wie du die Gedankengänge des Modells in den Export aufnimmst.

## Eine JSONL-Datei als neue Verzweigung importieren

Ein gespeichertes Chat-Protokoll lässt sich als neue Verzweigung in den geöffneten Chat holen.

1. Öffne das Popover **Chat Branches**.
2. Klick auf die Schaltfläche **Import** (Importieren).
3. Wähl eine JSONL-Datei (`.jsonl`), die aus SillyTavern oder aus Marinara stammt.

Marinara hängt die Datei als neue Verzweigung an die Gruppe des aktuellen Chats an. Es erscheint eine Meldung wie „Imported N messages as a new branch“. Danach wechselt die App zur neuen Verzweigung.

## Verwandte Anleitungen

- [Nachrichten-Aktionen: Bearbeiten, Löschen, Swipe, Neu generieren](messages.md)
- [Chats exportieren und importieren](export-import.md)
- [Die Chatliste verwalten](managing-chats.md)
