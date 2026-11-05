# Game Mode: Sitzungen und Spielstände

Game Mode teilt dein Abenteuer in nummerierte Sitzungen, wie Spieleabende am Tisch. In dieser Anleitung erfährst du, wie du eine Sitzung beendest und startest, frühere Sitzungen nachliest, dein Setup teilst, gespeicherte Daten von Hand korrigierst und zu einem früheren Moment zurückkehrst.

Deine erste Sitzung ist **Session 1**. Beendest du sie und startest neu, entsteht **Session 2** und so weiter. Beendest du eine Sitzung, schreibt der Game Master (GM, die KI, die dein Spiel leitet) eine Zusammenfassung, die du später nachlesen kannst.

## Speichern und weiterspielen

Eine Speichern-Schaltfläche gibt es nicht. Dein Spiel speichert sich beim Spielen von selbst.

1. Um vorerst aufzuhören, schließ den Tab oder die App.
2. Um weiterzuspielen, öffne denselben Game-Chat. Du bist wieder da, wo du aufgehört hast.
3. Um ein Kapitel abzuschließen, beende die Sitzung (siehe [Eine Sitzung beenden](#end-a-session)).

Wie du zu einem früheren Moment zurückkehrst, steht unter [Wie das Spiel speichert](#how-your-game-saves).

<a id="opening-session"></a>

## Session öffnen

In **Session** (Sitzung) beendest du Sitzungen, startest neue und liest deinen Verlauf nach.

1. Öffne einen Game-Chat.
2. Klick oder tippe nahe der oberen rechten Ecke des Chats auf die Schaltfläche **Session** (das Feder-Symbol). Du kannst sie an eine andere Stelle ziehen (siehe [Steuerungsfenster und ihre Schaltflächen](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** öffnet sich am Computer als Fenster und am Handy als Panel über die ganze Breite. Die erste Zeile zeigt die aktuelle Sitzungsnummer und den Status.
4. Es gibt zwei Tabs: **Session History** (Sitzungsverlauf) und **Journal**. Bleib für die Sitzungssteuerung auf **Session History**.

Hast du dieses Fenster mit **Put back in Chat Settings** (zurück in die Chat-Einstellungen) verschoben, öffne stattdessen den Abschnitt **Session** in Chat Settings.

<a id="end-a-session"></a>

## Eine Sitzung beenden

Beende eine Sitzung, wenn du ein Kapitel abschließen und den GM zusammenfassen lassen willst.

1. Öffne **Session** und bleib auf **Session History**.
2. Ganz oben findest du die aktuelle Sitzung, beschriftet mit **Session N (Current)**.
3. Klick in dieser Zeile auf die Schaltfläche **End Session** (Sitzung beenden) – das kleine Quadrat-Symbol. Die Zeile hat mehrere kleine Symbol-Schaltflächen, also fahr mit der Maus darüber, um ihre Tooltips zu lesen. Ein Dialogfenster mit dem Titel **End Session** bittet um Bestätigung.
4. Optional: Schreib eine Notiz in das Feld **What do you want to happen in the next session (optional)?**, bis zu 5.000 Zeichen. Lass es leer, damit der GM die Geschichte lenkt.
5. Klick im Dialogfenster auf **End Session**. Mit **Cancel** (Abbrechen) brichst du ab.

Während der GM die Zusammenfassung schreibt, lautet der Titel des Dialogfensters **Ending Session**. Bleib auf diesem Bildschirm, bis sie fertig ist. Danach gilt die Sitzung als abgeschlossen und erscheint in deinem Verlauf.

Wenn es nicht funktioniert hat, prüf, ob dein GM-Modell erreichbar ist. Die Zusammenfassung ist eine Modellanfrage und kann wie jede andere fehlschlagen. Versuch es noch einmal und sieh unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md) nach.

## Eine neue Sitzung starten

Ist eine Sitzung abgeschlossen, heißt dieselbe Schaltfläche in ihrer Zeile **New Session** (neue Sitzung).

1. Öffne **Session** und wechsle zu **Session History**.
2. Klick in der Zeile der aktuellen Sitzung auf **New Session** (das Play-Symbol).

Der GM setzt die Geschichte mit der letzten Zusammenfassung fort und mit der Notiz, die du gegebenenfalls beim Beenden der Sitzung geschrieben hast. In einem Spiel mit generierter Welt geht die Welt dort weiter, wo sie zurückgelassen wurde: die vergangenen Tage, die Taten und das Ansehen der Party, die Orte und Gruppen, die die Geschichte hinzugefügt hat, und wohin die Party gezogen ist.

## Frühere Sitzungen nachlesen

**Session History** listet die abgeschlossenen Sitzungen auf, die neueste zuerst. Bevor du eine beendet hast, steht dort **No completed sessions yet**. Jede Zeile zeigt die Sitzungsnummer, das Datum und wie viele Entdeckungen sie festgehalten hat. Klick auf eine Zeile, um sie aufzuklappen. Diese Felder können erscheinen:

| Feld | Was es enthält |
| --- | --- |
| **Summary** | Was passiert ist. |
| **Resume Point** | Wie die nächste Sitzung anknüpfen soll. |
| **Party Dynamics** | Wie die Partymitglieder zueinander standen. |
| **Key Discoveries** | Wichtige Fakten, Wendungen und Enthüllungen. |
| **Character Moments** | Herausragende Momente. |
| **Little Details To Recall** | Kleine Angewohnheiten, Versprechen oder Details. |
| **NPC Updates** | Änderungen an NPCs (Nicht-Spieler-Charaktere, Personen, die der GM steuert). |
| **Next Session Request** | Die Notiz, die du beim Beenden der Sitzung hinterlassen hast. |
| **Stats Snapshot**, **Party Status** | Gespeicherte Werte und der Zustand der Party. |

### Eine Sitzung erneut abspielen

Die Wiederholung ist reine Ansicht. Sie ruft den GM nicht auf, erzeugt keine Nachrichten, ändert weder Inventar noch Werte, aktualisiert das Journal nicht und stellt keinen Checkpoint wieder her.

1. Klapp eine abgeschlossene Sitzung auf.
2. Klick auf **Replay Session** (Sitzung wiederholen).
3. Mit **Next** (weiter) und **Next turn** (nächster Zug) klickst du dich durch die ursprüngliche Erzählung und die Dialoge.
4. An einer Entscheidung ist nur die Option aktiv, die du damals gewählt hast. Klick darauf, um dem aufgezeichneten Weg zu folgen.
5. Klick zum Schluss oben auf die Schließen-Schaltfläche oder auf **Return to current session** (zurück zur aktuellen Sitzung).

Sitzungen aus der Zeit vor der Wiederholung lassen sich trotzdem abspielen, mit ihrem gespeicherten Text, ihren Effekten, Entscheidungen und Assets. Bei einem älteren Zug kann ein Szeneneffekt fehlen, der damals nicht gespeichert wurde.

### Eine frühere Sitzung bearbeiten

Bearbeite die Notizen einer abgeschlossenen Sitzung, damit spätere Sitzungen sie richtig erinnern.

1. Klapp die Sitzung auf.
2. Klick auf **Edit Details** (Details bearbeiten).
3. Ändere beliebige Felder und klick dann auf **Save Details** (Details speichern). Mit **Cancel** verwirfst du deine Änderungen.

Auf einer aufgeklappten Sitzung erscheinen zwei weitere Schaltflächen:

- **Regenerate** führt den KI-Abschluss erneut aus. Er überschreibt die Zusammenfassung und jedes andere Feld, Änderungen aus **Edit Details** gehen also verloren.
- **Update Plot Arcs** lässt die KI die verborgenen Story-Pläne des GM anhand der Ereignisse dieser Sitzung aktualisieren. Diese Pläne sind **Story Arc**, **Plot Twists** und **Party Arcs** in der Ansicht **Show Spoilers** (Spoiler anzeigen).

**Regenerate Lorebook** erscheint nur bei deiner zuletzt abgeschlossenen Sitzung und nur, wenn die Funktion Lorebook Keeper eingeschaltet ist. Ein Lorebook ist eine Sammlung von Weltwissen, auf die die KI zurückgreifen kann.

## Das Setup teilen, aus dem ein Spiel entstanden ist

Game Mode legt für jede neue Kampagne eine Momentaufnahme des Setups ab, mit dem sie erstellt wurde. Spiel erst und teil die Kombination dann, wenn sie gut funktioniert.

1. Öffne die Kampagne und dann **Session**.
2. Klapp auf **Session History** den Bereich **Initial Game Setup** (ursprüngliches Spiel-Setup) auf.
3. Sieh dir die gespeicherten Angaben an: Abenteuer, Besetzung, Modell, Prompt, Generierungsparameter sowie Optik-, Storyboard- und Weltwerkzeug-Einstellungen.
4. Klick auf **Copy setup** (Setup kopieren), um den Text zu kopieren, oder auf **Download setup** (Setup herunterladen), um eine Textdatei zu speichern.

> **Warnung:** Der Text enthält deine langen Spielerpräferenzen und eigenen GM-Anweisungen. Lies ihn, bevor du ihn postest. Zugangsdaten, Server-URLs, API-Keys und lokale Datenbank-IDs sind nie enthalten.

Charakterkarten, Personas, Lorebooks, Modelle und Konten werden genannt, aber nicht mitgeliefert. Wer damit spielen will, braucht also eigene Entsprechungen. Kampagnen aus der Zeit vor den Momentaufnahmen können Einstellungen, die nie gespeichert wurden, nicht wiederherstellen. **Initial Game Setup** erscheint deshalb nur, wenn eine verlässliche Momentaufnahme vorliegt.

## Die verborgenen Notizen des GM ansehen

**Show Spoilers** (das Augen-Symbol in der Zeile der aktuellen Sitzung) legt die privaten Notizen des GM zur aktuellen Sitzung offen. Wer sie liest, verdirbt sich womöglich die Wendungen der Geschichte.

1. Öffne **Session** und wechsle zu **Session History**.
2. Klick in der Zeile der aktuellen Sitzung auf **Show Spoilers** (das Augen-Symbol).

Die Ansicht kann **World Overview**, **Story Arc**, **Plot Twists**, **Party Arcs** und die gespeicherten **Maps**, **NPCs** und **Character Cards** zeigen. Um sie auszublenden, klick auf dieselbe Schaltfläche, die jetzt **Hide Spoilers** heißt.

Um diese Notizen zu ändern, klick auf **Edit Spoilers** (Spoiler bearbeiten), bearbeite den Text und klick auf **Save Spoilers** (Spoiler speichern). Manche Felder sind JSON, ein strukturiertes Textformat. Bearbeite sie nur, wenn du das Format kennst, denn fehlerhaftes JSON lässt sich nicht speichern.

<a id="editing-game-data-by-hand"></a>

## Spieldaten von Hand bearbeiten

Wenn der GM etwas falsch macht, etwa beim Ruf eines NPC oder bei einer Quest, die offen bleibt, kannst du die gespeicherten Daten selbst korrigieren.

1. Öffne **Game controls** (Spielsteuerung) und wähle **Edit game data** (Spieldaten bearbeiten). Am Handy steckt **Game controls** im Drei-Punkte-Menü **Chat tools**.
2. Das Fenster **Game Data** (Spieldaten) öffnet sich. Eine Warnung lautet: „Hand edits can break a game. Every change is checked before it saves, and names can't change here.“
3. Wähl einen Abschnitt aus der Liste (am Handy aus einer Reihe von Chips). Das Suchfeld findet einen Wert in allen Abschnitten gleichzeitig.
4. Ändere Werte unter **Fields** (Felder) oder wechsle für die Rohdaten zu **JSON**.
5. Klick auf **Review changes** (Änderungen prüfen), um genau zu sehen, was sich ändert, und dann auf **Save changes** (Änderungen speichern).

> **Warnung:** Änderungen von Hand können ein Spiel beschädigen. Vor jedem Speichern versucht Marinara, einen Checkpoint mit der Markierung **Before a State Editor save** anzulegen (siehe [Wie das Spiel speichert](#how-your-game-saves)). Lade ihn, um eine misslungene Änderung rückgängig zu machen. Ein Spiel, das so neu ist, dass sein erster Zug noch nicht gespeichert ist, hat noch nichts, was ein Checkpoint festhalten könnte.

Wenn es nicht funktioniert hat, nennt der Editor den Grund und behält deinen Entwurf, damit du ihn korrigieren kannst. Hat das Spiel dieselben Daten geändert, während du bearbeitet hast, wird das Speichern abgelehnt, damit es die Änderung des Spiels nicht rückgängig macht. **Reload** (neu laden) zeigt die Fassung des Spiels und verwirft deine Entwürfe.

Diese Abschnitte kannst du ändern: **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits** (Weltbearbeitungen), **Story Script** und **HUD Widgets**. Ein Abschnitt erscheint nur, wenn das Spiel diese Daten hat, ein Spiel ohne Welt hat also keine **World Edits**. Abschnitte wie **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** und **Settings** sind als **Read-only** markiert: Du kannst sie lesen und durchsuchen, aber das Spiel pflegt sie selbst. Einstellungen für Prompts, Bilder, Musik und Würfel änderst du in **Chat Settings** (Chat-Einstellungen).

Diese Regeln setzen die Prüfungen durch:

- Namen lassen sich nicht ändern, weil Karten, NPCs, die Party und Taschen einander über den Namen finden. Partymitglieder lassen sich hier weder hinzufügen noch entfernen.
- Der Ruf eines NPC reicht von -100 bis 100.
- Unter **Inventory** kannst du bei einem Gegenstand Menge, Spitznamen und Träger ändern und festlegen, ob er getragen, eingestimmt oder eingeschaltet ist. Lass einen Stapel weg, um ihn zu entfernen, oder füg einen ohne ID hinzu, um einen Gegenstand hinzuzufügen.
- Unter **Session Summaries** lässt sich nur der Text einer Sitzung ändern.
- **World Edits** enthält deine Änderungen von Hand an der Welt, etwa umbenannte Orte oder hinzugefügte Personen. Die Welt selbst ändert sich nie.

Das Fenster funktioniert wie der State Editor in Roleplay. Siehe [Der State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Wie das Spiel speichert

Game Mode speichert automatisch. Welt, Party, Karte, Inventar, Spielzeit und Sitzungszusammenfassungen bleiben beim Spielen erhalten, ganz ohne Speichern-Schaltfläche.

Marinara legt außerdem automatische Checkpoints an: beim Start und beim Ende einer Sitzung, zu Beginn und am Ende eines Kampfes, wenn du einen neuen Ort erreichst, und in festen Abständen. Von jeder Art behält es die fünf neuesten und räumt ältere auf. Auch der Spieldaten-Editor versucht, vor jedem Speichern einen anzulegen.

So kehrst du zurück:

1. Öffne **Game controls → Checkpoints**. Dort stehen die neuesten zuerst.
2. Klick beim gewünschten Moment auf **Load** (laden).

**Load** bringt das Spiel zu diesem Moment zurück. Tracker, Karte, **World Edits**, Geschichte, die Karten und Bögen der Party, NPCs, Journal, deine Notizen, Inventar, Sitzungszusammenfassungen, die Story-Pläne des GM, HUD-Widgets, Zeit, Wetter und Moral kehren alle dorthin zurück. Eine Systemnachricht markiert die Stelle, an der das Spiel zurückgesetzt wurde. Deine Einstellungen bleiben, wie sie sind. **Delete** (löschen) entfernt einen Checkpoint endgültig.

Um nur einen misslungenen Zug rückgängig zu machen, nutze **Retry turn** (Zug wiederholen) in **Game controls** oder wechsle per Swipe zu einer anderen Version der Antwort.

Wie du eine eigene Kopie deiner Daten anlegst, steht unter [Marinara sichern und wiederherstellen](../data/backup-and-restore.md).

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Marinara sichern und wiederherstellen](../data/backup-and-restore.md)
