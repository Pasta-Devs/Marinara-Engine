# Chat-Verzweigungen

In dieser Anleitung erfährst du, was eine Verzweigung in Marinara Engine ist und wie du eine anlegst. Dazu kommen Wechseln, der Verzweigungsgraph, Umbenennen, Löschen, Exportieren und Importieren. Mit einer Verzweigung probierst du einen anderen Weg im Chat aus, ohne das Original zu verlieren.

## Was eine Verzweigung ist

Eine Verzweigung ist eine Kopie des Chats, die den Verlauf bis zu einem bestimmten Punkt mitbringt. So erkundest du eine andere Richtung, während der ursprüngliche Chat unangetastet bleibt.

Alle Verzweigungen eines Chats gehören zusammen. In der Chatliste behält der Chat seine Zeile und zeigt die Anzahl seiner Verzweigungen. Sobald bei mindestens einer Verzweigung der Gruppe festgehalten ist, aus welchem Chat der Gruppe sie entstanden ist, klappt ein Klick auf diese Zahl die Verzweigungen darunter auf. Eine Verzweigung mit unbekannter Herkunft steht direkt unter dem Chat. Game-Sitzungen sind nummerierte Sitzungen und keine Verzweigungen, deshalb behält eine Game-Gruppe immer ihre einzelne Zeile. Jede Verzweigung zeigt ihren Anzeigenamen und wann sie zuletzt aktiv war. Die Verzweigung einer Verzweigung ist unter dieser eingerückt, sodass sie als Baum statt als flache Liste erscheinen. Du kannst direkt aus der Liste zu einer Verzweigung wechseln oder im Abschnitt **Chat Branches** (Chat-Verzweigungen) der **Chat Settings** Verzweigungen umbenennen, löschen, exportieren oder importieren – mehr dazu weiter unten.

Jede Verzweigung bekommt einen eigenen Anzeigenamen. Nenn sie zum Beispiel „freundliches Ende“ und „düsteres Ende“. Dieser Anzeigename ist unabhängig vom Namen des dahinterliegenden Chats.

Die Herkunft einer Verzweigung hält den unmittelbaren Quellchat und die Nachricht fest, an der sie entstand. Sowohl die ursprüngliche Nachrichten-ID als auch die ID ihrer Kopie bleiben erhalten. Integrationen können dadurch die Grenze erkennen, obwohl kopierte Nachrichten neue IDs bekommen. Die Verzweigung einer Verzweigung nennt diese als unmittelbaren Elternchat, nicht den ursprünglichen Stammchat. Ältere Verzweigungen und importierte Geschwister behalten ihren Anzeigenamen, haben aber keine bekannte Herkunft: Eine Gruppe ohne bekannte Herkunft behält ihre einzelne Zeile in der Chatliste, und ihre Verzweigungen erreichst du weiterhin über den Abschnitt **Chat Branches**.

## Die Schaltfläche „Branch from here“

Eine Verzweigung entsteht ausgehend von einer beliebigen Nachricht im Chat.

1. Zeig mit der Maus auf eine Nachricht (oder tipp sie auf dem Handy an), damit die Aktionsleiste erscheint.
2. Klick auf die Schaltfläche **Branch from here** (Ab hier verzweigen). Sie trägt ein kleines Verzweigungssymbol.

Marinara kopiert den Chat bis einschließlich dieser Nachricht in eine neue Verzweigung. Diese neue Verzweigung:

- Behält Modus, Charaktere, Persona, Prompt-Preset und Verbindung des Ursprungschats bei.
- Kopiert jede Nachricht, samt aller Swipes (alternativer Antworten) und der Angabe, welcher Swipe aktiv war. Wie Swipes funktionieren, steht in der [Anleitung zu Nachrichten-Aktionen](messages.md).
- Kopiert die Tracker- und Spielzustands-Schnappschüsse der kopierten Nachrichten, damit Roleplay- und Game-Chats ihren Zustand behalten.
- Behält in einem Roleplay-Chat die Arbeit von Advanced Memory bei, sodass du den kopierten Verlauf nicht erneut vorbereiten musst. Erinnerungen an frühere, abgeschlossene Szenen bleiben abrufbereit. Die Szene, von der du abzweigst, wird wieder zur laufenden Szene, und ihre alten Erinnerungen werden verworfen. Siehe [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md).
- Startet mit dem Anzeigenamen **New Branch**. Umbenennen geht jederzeit (siehe unten).
- Bleibt im selben Chat-Ordner wie der Ursprungschat.

Bei einem leeren Chat sind die Nachrichtenanker null. Das Löschen eines Elternchats ändert die historische Herkunft seiner Kinder nicht. Das Löschen der gesamten Verzweigungsgruppe entfernt weiterhin jeden Chat dieser Gruppe.

Tages- und Wochenzusammenfassungen wandern nicht mit. Laufende Zusammenfassungen mit gespeicherten Nachrichtenbereichen, die vollständig innerhalb der kopierten Verzweigung liegen, werden übernommen und auf die neuen Nachrichten-IDs der Verzweigung abgebildet. Zusammenfassungen, deren Quellbereich den Verzweigungspunkt überschreitet, sowie ältere Zusammenfassungen ohne Nachrichtenmetadaten werden ausgelassen. In der neuen Verzweigung werden diese Zusammenfassungen neu erstellt.

Szenen-Chats lassen sich nicht verzweigen. Dort fehlt die Schaltfläche **Branch from here**. Stattdessen gibt es in Szenen-Chats die eigene Aktion **Clone from here** (Ab hier klonen). Wie sie funktioniert, beschreibt [Szenen: Ein Roleplay verzweigen](../roleplay/scenes.md).

## Der Abschnitt „Chat Branches“

Öffne **Chat Settings** und klapp den Abschnitt **Chat Branches** unter **Chat Name** auf. Die Überschrift zeigt die aktuelle Anzahl der Verzweigungen. Am Computer kannst du den Abschnitt in einem eigenen Fenster öffnen (siehe [Chat Settings im Überblick](chat-settings.md#popping-a-section-out-into-its-own-window)).

Der Abschnitt listet alle Verzweigungen des aktuellen Chats auf, die gerade geöffnete zuerst. Jede Zeile nennt den Anzeigenamen und den Zeitpunkt der letzten Änderung.

### Zu einer anderen Verzweigung wechseln

Klick auf eine beliebige Verzweigungs-Zeile, um sie zu öffnen. Die Chatansicht springt zur gewählten Verzweigung.

### Den Verzweigungsgraphen ansehen

Der Verzweigungsgraph zeigt, wo jede Verzweigung abgezweigt ist. Das kann die Liste nicht darstellen.

1. Öffne den Abschnitt **Chat Branches**.
2. Klick auf **Branch graph** (Verzweigungsgraph), die lange Schaltfläche über den Export-Schaltflächen. Ein erneuter Klick schließt den Graphen.

Der Graph öffnet sich in einem eigenen Fenster, das du verschieben und in der Größe ändern kannst. Auf dem Handy öffnet er sich als Panel. Der Graph füllt das Fenster: Ein größeres Fenster klappt weniger Abschnitte zusammen; hat der Graph Platz übrig, vergrößert er sich und rückt auseinander. Ein etwas zu breiter Graph verkleinert sich bis auf drei Viertel seiner Größe, um hineinzupassen. Reicht das nicht, lässt er sich seitlich scrollen. Die Zeilen teilen sich die Fensterhöhe und lassen sich scrollen, wenn nicht alle Chats hineinpassen.

- Jeder Chat der Gruppe bekommt eine Zeile, in derselben Baumreihenfolge wie in der Chatliste. Nachrichten laufen von links nach rechts, ein Punkt pro Nachricht. Graue Punkte sind deine Nachrichten, Punkte in Akzentfarbe sind Charakterantworten und hohle Ringe sind Erzähler- oder Systemnachrichten.
- Eine Verzweigung zeichnet nur ihre eigenen Nachrichten. Eine Linie verbindet sie mit der Nachricht, von der sie abgezweigt wurde, sodass du den Verzweigungspunkt genau erkennst.
- Ältere Verzweigungen und solche, deren Quellchat gelöscht wurde, haben keinen gespeicherten Verzweigungspunkt. Eine gestrichelte Linie verbindet sie mit dem obersten Chat, und in der Legende steht **Fork not recorded**.
- Lange Abschnitte ohne Verzweigungspunkt in der Nähe werden zu einer Markierung **··· N ···** zusammengeklappt. N ist die Anzahl der verborgenen Nachrichten. Klick darauf, um sie anzuzeigen, oder nutze **Expand all** (alle aufklappen), um jeden Abschnitt aufzuklappen. **Collapse long runs** (lange Abschnitte zusammenklappen) klappt sie wieder zusammen.
- Verzweigungspunkte und die neueste Nachricht jeder Verzweigung haben einen Ring. Zeig mit der Maus darauf, tipp ihn an oder fokussiere ihn mit der Tastatur, um die Nachrichtennummer, den Verfasser und den Textanfang zu sehen.
- Klick auf den Namen oder die Zeile einer Verzweigung, um zu ihr zu wechseln. Die geöffnete Verzweigung ist hervorgehoben, und beim Öffnen ist der Graph zu ihrer neuesten Nachricht gescrollt.

Der Graph aktualisiert sich, wenn du einen Chat verzweigst, umbenennst oder löschst, und kurz nach dem Eintreffen neuer Nachrichten.

### Eine Verzweigung umbenennen

1. Öffne den Abschnitt **Chat Branches**.
2. Klick in der jeweiligen Zeile auf die Stift-Schaltfläche zum Umbenennen.
3. Es öffnet sich ein Fenster mit dem Titel **Rename Branch** und dem Hinweis „Set a display name for this chat branch.“
4. Gib einen neuen Namen ein und bestätige mit der Schaltfläche **Rename**.

Ein leerer oder unveränderter Name wird ignoriert.

### Eine Verzweigung löschen

1. Öffne den Abschnitt **Chat Branches**.
2. Klick in der Zeile auf die Papierkorb-Schaltfläche zum Löschen.
3. Ein Fenster mit dem Titel **Delete Branch** fragt „Delete this branch? Messages will be lost.“
4. Bestätige mit der Schaltfläche **Delete**.

Gelöscht werden nur diese eine Verzweigung und ihre Nachrichten. Die übrigen Verzweigungen bleiben erhalten.

### Alle Verzweigungen löschen

Hat ein Chat zwei oder mehr Verzweigungen, erscheint unten im Abschnitt die Schaltfläche **Delete All Branches** (Alle Verzweigungen löschen). Sie fragt „Delete all N branches? This cannot be undone.“ Mit der Schaltfläche **Delete All** entfernst du alle Verzweigungen der Gruppe auf einmal.

Das geht auch direkt aus der Chatliste heraus. Lösch dort einen Chat mit Verzweigungen über das Papierkorb-Symbol. Daraufhin fragt ein Fenster mit dem Titel **Delete Chat**, was genau verschwinden soll. Zur Wahl stehen die Schaltflächen **Delete This Branch Only** (Nur diese Verzweigung löschen) und **Delete All N Branches** (Alle N Verzweigungen löschen). Mehr zum Löschen aus der Liste steht unter [Die Chatliste verwalten](managing-chats.md).

## Eine Verzweigung exportieren

Oben im Abschnitt **Chat Branches** sitzen die Export-Schaltflächen. Sie exportieren immer die gerade geöffnete Verzweigung.

- **JSONL**: lädt die Verzweigung als JSONL-Datei herunter. JSONL heißt: eine Nachricht pro Textzeile. Dieses Format versteht auch SillyTavern.
- **Text**: lädt die Verzweigung als reines Text-Protokoll herunter.
- **Markdown** und **Story**: laden die Verzweigung als gut lesbare Markdown-Datei oder als gestaltete Webseite herunter. Siehe [Diese Dateiformate begegnen dir](export-import.md#file-formats-you-will-see).

Willst du viele Chats auf einmal exportieren, hilft [Chats exportieren und importieren](export-import.md) weiter. Dort steht auch, wie du die Gedankengänge des Modells in den Export aufnimmst.

## Eine JSONL-Datei als neue Verzweigung importieren

Ein gespeichertes Chat-Protokoll lässt sich als neue Verzweigung in den geöffneten Chat holen.

1. Öffne den Abschnitt **Chat Branches**.
2. Klick auf die Schaltfläche **Import** (Importieren).
3. Wähl eine JSONL-Datei (`.jsonl`), die aus SillyTavern oder aus Marinara stammt.

Marinara hängt die Datei als neue Verzweigung an die Gruppe des aktuellen Chats an. Es erscheint eine Meldung wie „Imported N messages as a new branch“. Danach wechselt die App zur neuen Verzweigung.

## Verwandte Anleitungen

- [Nachrichten-Aktionen: Bearbeiten, Löschen, Swipe, Neu generieren](messages.md)
- [Chats exportieren und importieren](export-import.md)
- [Die Chatliste verwalten](managing-chats.md)
