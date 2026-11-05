# Chat-Verzweigungen

Eine Verzweigung ist eine Kopie eines Chats bis zu einer bestimmten Nachricht. Damit probierst du einen anderen Weg aus, während das Original sicher bleibt. In dieser Anleitung erfährst du, wie du Verzweigungen anlegst, zwischen ihnen wechselst, sie ansiehst, umbenennst, löschst, exportierst und importierst.

Alle Verzweigungen eines Chats sind gruppiert. In der Chatliste behält der Chat eine Zeile und zeigt die Anzahl seiner Verzweigungen. Ist bei mindestens einer Verzweigung der Gruppe festgehalten, aus welchem Chat sie stammt, öffnet ein Klick auf die Zahl den Baum; eine Verzweigung ohne diese Angabe steht direkt unter dem Chat. Hat keine Verzweigung der Gruppe diese Angabe (ältere oder importierte Verzweigungen), bleibt die Gruppe bei einer Zeile; ihre Verzweigungen öffnest du dann über **Chat Branches** (Chat-Verzweigungen). Eine Verzweigung, die von einer Verzweigung abgeht, ist unter dieser eingerückt, sodass du einen Baum siehst. Jede Verzweigung hat einen Anzeigenamen und eine Zeit der letzten Aktivität, sodass du sie etwa „freundliches Ende“ und „düsteres Ende“ nennen kannst. Der Anzeigename ist unabhängig vom Chatnamen. Eine Game-Gruppe behält eine Zeile, weil Game-Sitzungen nummerierte Sitzungen sind und keine Verzweigungen.

## Die Schaltfläche „Branch from here“

1. Tipp auf die Nachricht (am Computer zeigst du darauf), damit die Aktionsleiste der Nachricht erscheint.
2. Klick auf **Branch from here** (ab hier verzweigen), das kleine Verzweigungssymbol.

Marinara kopiert den Chat bis einschließlich dieser Nachricht in eine neue Verzweigung namens **New Branch**. Umbenennen kannst du sie später.

Die Verzweigung:

- Behält Modus, Charaktere, Persona, Prompt-Preset und Verbindung bei.
- Kopiert jede Nachricht samt allen Swipes und der Angabe, welcher Swipe aktiv war. Siehe [Aktionen für Nachrichten](messages.md).
- Kopiert den Tracker- und Spielzustand, der an den kopierten Nachrichten hängt.
- Behält in einem Roleplay-Chat die Arbeit von Advanced Memory bei. Erinnerungen an frühere, abgeschlossene Szenen bleiben abrufbereit. Die Szene, von der du abzweigst, wird wieder zur laufenden Szene, und ihre alten Erinnerungen werden verworfen. Siehe [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md).
- Bleibt im selben Chat-Ordner wie die Quelle.

Tages- und Wochenzusammenfassungen wandern nicht mit. Laufende Zusammenfassungen, die vollständig innerhalb der kopierten Nachrichten liegen, werden übernommen. Zusammenfassungen, die über den Verzweigungspunkt hinausreichen, und alte Zusammenfassungen ohne Nachrichtendaten werden ausgelassen; die Verzweigung beginnt diese neu.

Wenn es nicht funktioniert hat: In einem Szenen-Chat erscheint **Branch from here** nicht. Szenen-Chats haben stattdessen **Clone from here** (ab hier klonen). Siehe [Szenen: Ein Roleplay verzweigen](../roleplay/scenes.md).

## Der Abschnitt „Chat Branches“

Öffne **Chat Settings** (Chat-Einstellungen) und klapp **Chat Branches** unter **Chat Name** auf. Die Überschrift zeigt die Anzahl der Verzweigungen. Am Computer kannst du den Abschnitt in ein eigenes Fenster lösen. Siehe [Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

Der Abschnitt listet alle Verzweigungen des Chats auf, die gerade geöffnete zuerst. Jede Zeile zeigt den Anzeigenamen und den Zeitpunkt der letzten Änderung. Klick auf eine Zeile, um zu dieser Verzweigung zu wechseln.

Schaltflächen über der Liste:

| Schaltfläche | Funktion |
| --- | --- |
| **Branch graph** (Verzweigungsgraph) | Öffnet das Fenster mit dem Graphen. Siehe unten. |
| **JSONL**, **Text**, **Markdown**, **Story** | Exportieren die Verzweigung, die du gerade siehst. Siehe [Chats exportieren und importieren](export-import.md). |
| **Export a range** (Bereich exportieren) | Exportiert einen Teil des Chats. Nicht in Game. Siehe [Chats exportieren und importieren](export-import.md#export-part-of-a-chat). |
| **Import** (Importieren) | Fügt eine `.jsonl`-Datei als neue Verzweigung hinzu. Siehe unten. |
| **Stats** (Statistik) | Öffnet die Chat-Statistik für die Verzweigung, die du gerade siehst. |

### Den Verzweigungsgraphen ansehen

Der Graph zeigt, wo jede Verzweigung abgezweigt ist – das kann die Liste nicht.

1. Öffne **Chat Branches** und klick auf **Branch graph**. Ein erneuter Klick schließt den Graphen.

Der Graph öffnet sich in einem eigenen Fenster, das du verschieben und in der Größe ändern kannst. Auf dem Handy öffnet er sich als Panel. Jeder Chat der Gruppe bekommt eine Zeile, in derselben Reihenfolge wie in der Chatliste. Nachrichten laufen von links nach rechts, ein Punkt pro Nachricht.

- Graue Punkte sind deine Nachrichten, Punkte in Akzentfarbe sind Charakterantworten und hohle Ringe sind Erzähler- oder Systemnachrichten.
- Eine Verzweigung zeichnet nur ihre eigenen Nachrichten. Eine Linie verbindet sie mit der Nachricht, von der sie abgezweigt wurde.
- Eine Verzweigung ohne gespeicherten Verzweigungspunkt wird mit einer gestrichelten Linie vom obersten Chat aus gezeichnet, und in der Legende steht **Fork not recorded**. Das betrifft ältere Verzweigungen und Verzweigungen, deren Quellchat gelöscht wurde.
- Lange Abschnitte ohne Verzweigungspunkt werden zu einer Markierung **··· N ···** zusammengeklappt; N ist die Anzahl der verborgenen Nachrichten. Klick darauf, um sie anzuzeigen. **Expand all** (alle aufklappen) klappt jeden Abschnitt auf, **Collapse long runs** (lange Abschnitte zusammenklappen) klappt sie wieder zusammen.
- Verzweigungspunkte und die neueste Nachricht jeder Verzweigung haben einen Ring. Tipp ihn an, zeig darauf oder fokussiere ihn mit der Tastatur, um die Nachrichtennummer, den Verfasser und den Textanfang zu sehen.
- Klick auf den Namen oder die Zeile einer Verzweigung, um zu ihr zu wechseln. Die Verzweigung, die du gerade siehst, ist hervorgehoben.

Der Graph aktualisiert sich, wenn du einen Chat verzweigst, umbenennst oder löschst, und kurz nach dem Eintreffen neuer Nachrichten.

### Eine Verzweigung umbenennen

1. Klick in **Chat Branches** in der Zeile der Verzweigung auf die Stift-Schaltfläche.
2. Gib im Dialogfenster **Rename Branch** („Set a display name for this chat branch.“) einen neuen Namen ein.
3. Klick auf **Rename** (Umbenennen).

Ein leerer oder unveränderter Name wird ignoriert.

### Eine Verzweigung löschen

1. Klick in **Chat Branches** in der Zeile der Verzweigung auf die Papierkorb-Schaltfläche.
2. Klick im Dialogfenster **Delete Branch** („Delete this branch? Messages will be lost.“) auf **Delete** (Löschen).

Das entfernt nur diese Verzweigung und ihre Nachrichten. Die anderen Verzweigungen bleiben erhalten.

Ab zwei Verzweigungen erscheint unten im Abschnitt **Delete All Branches** (Alle Verzweigungen löschen). Es fragt „Delete all N branches? This cannot be undone.“ Bestätige mit **Delete All** (Alle löschen). Du kannst auch in der Chatliste beginnen: Löschst du dort einen Chat mit Verzweigungen, bietet das Dialogfenster **Delete This Branch Only** (Nur diese Verzweigung löschen) und **Delete All N branches** (Alle N Verzweigungen löschen) an. Siehe [Die Chatliste verwalten](managing-chats.md#delete-a-chat).

### Eine Datei als neue Verzweigung importieren

1. Klick in **Chat Branches** auf **Import**.
2. Wähl eine `.jsonl`-Datei, die aus SillyTavern oder Marinara exportiert wurde.

Marinara fügt sie als neue Verzweigung in die Gruppe des aktuellen Chats ein, zeigt „Imported N messages as a new branch“ und wechselt zu ihr.

## So sind Verzweigungen verknüpft

Dieser Abschnitt richtet sich an alle, die auf Verzweigungsdaten aufbauen.

- Jede Verzweigung hält ihren unmittelbaren Quellchat und die Nachricht fest, an der sie abgezweigt wurde. Sowohl die ID der Quellnachricht als auch die ID ihrer Kopie bleiben erhalten, sodass Integrationen die Grenze der Verzweigung finden, obwohl kopierte Nachrichten neue IDs bekommen.
- Wird eine Verzweigung verzweigt, gilt diese Verzweigung als Elternchat, nicht der ursprüngliche Stammchat.
- Sobald mindestens eine Verzweigung einer Gruppe ihre Quelle festhält, öffnet ein Klick auf die Zahl in der Chatliste den Baum. Eine Verzweigung mit unbekannter Quelle steht direkt unter dem Chat. Eine Gruppe ohne bekannte Quelle behält eine Zeile, und ihre Verzweigungen erreichst du über **Chat Branches**.
- Das Löschen eines Elternchats ändert die gespeicherte Quelle seiner Kinder nicht. Das Löschen der ganzen Gruppe löscht jeden Chat darin.
