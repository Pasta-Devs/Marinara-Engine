# Game Mode: Sitzungen und Spielstände

In dieser Anleitung erfährst du, wie Marinara Engine deinen Fortschritt im Game Mode über mehrere Sitzungen hinweg mitführt. Es geht ums Beenden und Starten einer Sitzung und ums Nachlesen früherer Sitzungen in **Session History** (Sitzungsverlauf). Außerdem lernst du die Ansicht **Show Spoilers** (Spoiler anzeigen) kennen und erfährst, wie du die Daten des Spiels von Hand korrigierst und wie das Spiel deine Daten speichert.

## Was eine Sitzung ist

Game Mode teilt dein Abenteuer in nummerierte Sitzungen. Eine Sitzung ist ein zusammenhängender Spielabschnitt – vergleichbar mit einem Abend am Spieltisch. Der Game Master (GM, die KI, die das Spiel leitet) erzählt jede Sitzung. Beendest du eine Sitzung, schreibt der GM eine Zusammenfassung, die du später nachlesen kannst.

Die erste Sitzung ist **Session 1**. Beendest du sie und startest neu, entsteht **Session 2** – und so weiter.

<a id="opening-session"></a>

## Session öffnen

In **Session** (Sitzung) beendest du Sitzungen, startest neue und liest den Verlauf nach.

1. Starte oder öffne einen Game-Mode-Chat, damit die Spieloberfläche sichtbar ist.
2. Klick oder tippe auf **Session** (das Feder-Symbol). Die Schaltfläche liegt anfangs nahe der oberen rechten Ecke des Chats. Du kannst sie an eine andere Stelle ziehen (siehe [Steuerungsfenster und ihre Schaltflächen](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** öffnet sich am Computer als Fenster und am Telefon als Panel über die ganze Breite. Die erste Zeile zeigt **Session** mit der aktuellen Nummer und dem Status.
4. Es gibt zwei Tabs: **Session History** und **Journal**. Bleib auf **Session History** – dort liegen die Sitzungssteuerung und das Teilen des Setups.

Hast du dieses Fenster mit **Put back in Chat Settings** verschoben, öffne stattdessen den Abschnitt **Session** in Chat Settings.

## Das Setup teilen, aus dem ein Spiel entstanden ist

Game Mode legt für jede neue Kampagne eine unveränderliche Momentaufnahme des verwendeten Setups ab. So kannst du erst spielen, dann entscheiden, dass die Kombination gut funktioniert, und sie hinterher teilen – ohne vor dem Start jedes Feld von Hand zu notieren.

1. Öffne die Game-Mode-Kampagne, die du teilen möchtest.
2. Öffne **Session** (die Schaltfläche mit der Feder).
3. Bleib auf **Session History** und klapp dann **Initial Game Setup** (ursprüngliches Spiel-Setup) auf.
4. Sieh dir die gespeicherten Angaben an: Abenteuer, Besetzung, Modell, Prompt, tatsächlich wirksame Generierungs-Parameter sowie Optik-, Storyboard- und Weltwerkzeug-Einstellungen.
5. Klick auf **Copy setup** (Setup kopieren), um den Text in die Zwischenablage zu legen, oder auf **Download .txt**, um eine teilbare Textdatei zu speichern.

Der kopierte Text enthält auch lange Spielerpräferenzen und eigene GM-Anweisungen. Lies ihn durch, bevor du ihn öffentlich postest – diese Felder können Privates enthalten. Zugangsdaten von Verbindungen, Server-URLs, API-Keys und lokale Datenbank-IDs landen nie darin. Charakterkarten, Personas, Lorebooks, Modelle und Anbieter-Konten werden nur namentlich genannt, nicht mitgeliefert. Wer damit spielen will, braucht also eigene lokale Entsprechungen oder muss sie selbst auswählen.

Kampagnen aus der Zeit vor den Setup-Momentaufnahmen können Präferenzen nicht rekonstruieren, die nie gespeichert wurden. **Initial Game Setup** erscheint deshalb nur, wenn eine verlässliche Momentaufnahme der Erstellung vorliegt.

## Eine Sitzung beenden

Beende eine Sitzung, wenn du das aktuelle Kapitel abschließen und den GM zusammenfassen lassen willst.

1. Öffne **Session** und bleib auf dem Tab **Session History**.
2. Ganz oben steht die aktuelle Sitzung, beschriftet mit **Session N (Current)**.
3. Klick in dieser Zeile auf die Schaltfläche **End Session** (Sitzung beenden) – das kleine Quadrat-Symbol neben **Show Spoilers**.
4. Ein Fenster mit dem Titel **End Session** öffnet sich und bittet um Bestätigung.
5. Wenn du magst, schreib etwas in das Feld **What do you want to happen in the next session (optional)?**. Bis zu 5000 Zeichen sind möglich.
6. Lass das Feld leer, damit der GM die Geschichte frei weiterführt.
7. Klick im Fenster auf **End Session**, um zu bestätigen, oder auf **Cancel** (Abbrechen), um abzubrechen.

Nach der Bestätigung erzeugt die Engine eine Zusammenfassung. Bleib so lange auf diesem Bildschirm, bis sie fertig ist. Währenddessen lautet der Fenstertitel **Ending Session**. Danach gilt die Sitzung als abgeschlossen und taucht im Verlauf auf.

## Eine neue Sitzung starten

Sobald die aktuelle Sitzung abgeschlossen ist, heißt dieselbe Schaltfläche **New Session** (neue Sitzung).

1. Öffne **Session** und wechsle zum Tab **Session History**.
2. Klick in der Zeile der aktuellen Sitzung auf die Schaltfläche **New Session** (das Play-Symbol).
3. Der GM nimmt die Geschichte wieder auf. Grundlage sind die Zusammenfassung der letzten Sitzung und die Notiz für die nächste Sitzung, die du beim Beenden hinterlassen hast.

In einem Spiel mit generierter Welt geht die Welt dort weiter, wo die letzte Sitzung sie zurückgelassen hat: Die vergangenen Tage, die Taten und das Ansehen der Party, die Orte und Gruppen, die die Geschichte hinzugefügt hat, und wohin die Party gezogen ist – all das wird in die neue Sitzung übernommen.

## Frühere Sitzungen nachlesen

Der Tab **Session History** listet die abgeschlossenen Sitzungen auf, die neueste zuerst. Solange keine einzige fertig ist, steht dort **No completed sessions yet** („noch keine abgeschlossenen Sitzungen“).

Jede Zeile zeigt die Sitzungsnummer, das Datum und die Anzahl der festgehaltenen Entdeckungen. Klick auf eine Zeile, um sie aufzuklappen. Eine aufgeklappte Sitzung kann diese Felder zeigen:

- **Summary**: was in der Sitzung passiert ist.
- **Resume Point**: wie die nächste Sitzung anknüpfen soll.
- **Party Dynamics**: wie die Partymitglieder zueinander standen.
- **Key Discoveries**: wichtige Fakten, Wendungen und Enthüllungen.
- **Character Moments**: herausragende Momente einzelner Charaktere.
- **Little Details To Recall**: kleine Angewohnheiten, Versprechen oder Details.
- **NPC Updates**: Änderungen an NPCs (Nicht-Spieler-Charaktere, die der GM steuert).
- **Next Session Request**: die Notiz, die du beim Beenden der Sitzung hinterlassen hast.
- **Stats Snapshot** und **Party Status**: gespeicherte Werte und der Zustand der Party.

### Eine abgeschlossene Sitzung erneut abspielen

Abgeschlossene Sitzungen lassen sich noch einmal abspielen, ohne dass sich an der Kampagne etwas ändert.

1. Klapp eine abgeschlossene Sitzung in **Session History** auf.
2. Klick auf **Replay Session** (Sitzung wiederholen).
3. Mit **Next** (weiter) und **Next turn** (nächster Zug) klickst du dich durch die ursprüngliche Erzählung und die Dialoge.
4. Kommt die Wiederholung an eine Entscheidung, ist nur die Option aktiv, die du damals gewählt hast. Klick darauf, um dem aufgezeichneten Weg zu folgen.
5. Klick zum Schluss oben auf die Schließen-Schaltfläche oder auf **Return to current session** (zurück zur aktuellen Sitzung).

Die Wiederholung ist reine Ansicht. Sie ruft den GM nicht auf, erzeugt keine Nachrichten, ändert weder Inventar noch Werte, aktualisiert das Journal nicht und stellt keinen Checkpoint wieder her. Sitzungen aus der Zeit vor dieser Funktion nutzen weiterhin ihren gespeicherten Text, die eingebetteten Effekte, die Entscheidungen und die vorhandenen Assets. Bei einem älteren Zug kann ein Szeneneffekt fehlen, der beim ursprünglichen Spielen nicht mitgespeichert wurde.

### Eine frühere Sitzung bearbeiten

Die Notizen einer abgeschlossenen Sitzung lassen sich von Hand korrigieren, damit spätere Sitzungen sie richtig erinnern.

1. Klapp die Sitzung auf, die du ändern willst.
2. Klick auf **Edit Details** (Details bearbeiten).
3. Ändere beliebige Felder und klick dann auf **Save Details** (Details speichern). Mit **Cancel** verwirfst du die Änderungen.

Auf einer aufgeklappten Sitzung erscheinen zwei weitere Schaltflächen:

- **Regenerate**: erzeugt den KI-Abschluss dieser Sitzung neu. Dabei werden die Zusammenfassung und alle anderen Felder des Eintrags überschrieben. Änderungen aus **Edit Details** gehen dabei verloren.
- **Update Plot Arcs**: lässt die KI die verborgenen Story-Pläne des GM anhand der Ereignisse dieser Sitzung aktualisieren. Diese Pläne sind **Story Arc**, **Plot Twists** und **Party Arcs** aus der Ansicht **Show Spoilers**.

Eine Schaltfläche **Regenerate Lorebook** erscheint nur bei der zuletzt abgeschlossenen Sitzung – und nur, wenn die optionale Funktion Lorebook Keeper aktiviert ist. Ein Lorebook ist eine Sammlung von Weltwissen, auf das die KI zurückgreifen kann.

## Die Ansicht Show Spoilers

**Show Spoilers** legt die geheimen Notizen des GM zur aktuellen Sitzung offen. Normalerweise bleiben sie dir während des Spiels verborgen. Wer sie liest, verdirbt sich womöglich die Wendungen der Geschichte.

1. Öffne **Session** und wechsle zum Tab **Session History**.
2. Klick in der Zeile der aktuellen Sitzung auf **Show Spoilers** (das Augen-Symbol).
3. Der private Zustand des GM erscheint.

Die Spoiler-Ansicht kann diese Abschnitte enthalten:

- **World Overview**: die Welt im Überblick.
- **Story Arc**: die geplante Richtung der Geschichte.
- **Plot Twists**: Überraschungen, die der GM noch zurückhält.
- **Party Arcs**: geplante Entwicklungen für die Party.
- **Maps**, **NPCs** und **Character Cards**: die gespeicherten Spieldaten.

Ein erneuter Klick auf dieselbe Schaltfläche blendet die Notizen wieder aus. Sie heißt dann **Hide Spoilers**.

Diese Geheimnisse lassen sich auch bearbeiten – das wirkt wie ein Cheat-Panel für den Game Master. Klick auf **Edit Spoilers**, ändere den Text und klick dann auf **Save Spoilers**. Manche Felder erscheinen als JSON, ein strukturiertes Textformat. Bearbeite JSON-Felder nur, wenn du das Format kennst: Fehlerhaftes JSON lässt sich nicht speichern.

<a id="editing-game-data-by-hand"></a>

## Spieldaten von Hand bearbeiten

Wenn der Game Master etwas falsch macht, etwa beim Ruf eines NPC oder bei einer Quest, die offen bleibt, kannst du die gespeicherten Daten des Spiels selbst korrigieren.

1. Öffne **Game controls** (Spielsteuerung) und wähle **Edit game data** (Spieldaten bearbeiten). Am Telefon steckt **Game controls** im Drei-Punkte-Menü **Chat tools**.
2. Das Fenster **Game Data** (Spieldaten) öffnet sich. Oben steht die Warnung „Hand edits can break a game. Every change is checked before it saves, and names can't change here.“ Sie bedeutet: Änderungen von Hand können ein Spiel kaputt machen, jede Änderung wird vor dem Speichern geprüft, und Namen lassen sich hier nicht ändern.
3. Wähl einen Abschnitt aus der Liste oder am Telefon aus der Reihe von Chips. Du kannst auch etwas in das Suchfeld eingeben, um einen Wert in allen Abschnitten gleichzeitig zu finden.
4. Ändere Werte unter **Fields** (Felder) oder wechsle zu **JSON**, um die Rohdaten zu bearbeiten.
5. Klick auf **Review changes** (Änderungen prüfen), um genau zu sehen, was sich ändert, und dann auf **Save changes** (Änderungen speichern).

Ändern kannst du **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits** (Weltbearbeitungen), **Story Script** und **HUD Widgets**. Ein Abschnitt erscheint nur, wenn das Spiel diese Daten hat. Ein Spiel ohne Welt hat also keine **World Edits**. Die übrigen Abschnitte, etwa **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** und **Settings**, sind als **Read-only** markiert. Du kannst sie lesen und durchsuchen, aber das Spiel pflegt sie selbst. Einstellungen für Prompts, Bilder, Musik und Würfel änderst du in **Chat Settings** (Chat-Einstellungen).

Jede Änderung wird vor dem Speichern geprüft:

- Namen lassen sich nicht ändern, weil Karten, NPCs, die Party und Taschen einander über den Namen finden. Partymitglieder lassen sich hier weder hinzufügen noch entfernen.
- Der Ruf eines NPC reicht von -100 bis 100.
- Unter **Inventory** kannst du bei einem Gegenstand Menge, Spitznamen und Träger ändern und festlegen, ob er getragen, eingestimmt oder eingeschaltet ist. Lass einen Stapel weg, um ihn zu entfernen, oder füg einen ohne ID hinzu, um einen Gegenstand hinzuzufügen.
- Unter **Session Summaries** lässt sich nur der Text einer Sitzung ändern.
- **World Edits** enthält deine Änderungen von Hand an der Welt, etwa umbenannte Orte oder hinzugefügte Personen. Die Welt selbst wird nie verändert.

Lässt sich eine Änderung nicht speichern, nennt der Editor den Grund, und der Abschnitt behält deinen Entwurf, damit du ihn korrigieren kannst. Hat das Spiel dieselben Daten geändert, während du bearbeitet hast, wird das Speichern abgelehnt, damit es die Änderung des Spiels nicht rückgängig macht. **Reload** (neu laden) zeigt die Fassung des Spiels und verwirft deine Entwürfe.

Vor jedem Speichern versucht das Spiel, einen Checkpoint anzulegen. Er ist unter **Checkpoints** mit **Before a State Editor save** markiert. Geht eine Änderung schief, lade diesen Checkpoint, um sie rückgängig zu machen (siehe unten).

Das Fenster funktioniert wie der State Editor in Roleplay. Siehe [Der State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Wie das Spiel speichert

Game Mode speichert deinen Fortschritt automatisch. Eine Speichern-Schaltfläche brauchst du nicht. Welt, Party, Karte, Inventar, Spielzeit und Sitzungszusammenfassungen bleiben beim Spielen von selbst erhalten.

Im Hintergrund legt die App außerdem automatische Checkpoints an: beim Start und beim Ende einer Sitzung, zu Beginn und am Ende eines Kampfes, wenn du einen neuen Ort erreichst, und in automatischen Abständen. Auch der [Spieldaten-Editor](#editing-game-data-by-hand) versucht, vor jedem Speichern einen anzulegen; ein Spiel, das so neu ist, dass sein erster Zug noch nicht gespeichert ist, hat allerdings noch nichts, was ein Checkpoint festhalten könnte. Unter **Game controls → Checkpoints** siehst du sie, die neuesten zuerst. **Load** (laden) bringt das Spiel zu diesem Moment zurück: Der Tracker, die Karte, die **World Edits** aus dem Spieldaten-Editor und die Geschichte ab diesem Moment werden wiederhergestellt, und eine Systemnachricht markiert die Stelle, an der das Spiel zurückgesetzt wurde. Auch die Karten und Bögen der Party, die NPCs, das Journal, deine Notizen, das Inventar, die Sitzungszusammenfassungen, die Story-Pläne des GM, die HUD-Widgets sowie Zeit, Wetter und Moral kehren zu diesem Moment zurück. Deine Einstellungen bleiben, wie sie sind. **Delete** (löschen) entfernt einen Checkpoint endgültig.

Von jeder Art automatischer Checkpoints bleiben nur die fünf neuesten erhalten, ältere werden beim Spielen also aufgeräumt.

Um einen einzelnen misslungenen Zug rückgängig zu machen, nutze stattdessen **Retry turn** (Zug wiederholen) in **Game controls** oder einen Swipe. Das Laden eines Checkpoints setzt auch die Geschichte auf diesen Moment zurück.

Für eine eigene Kopie der Daten nutzt du die Backup-Werkzeuge der App. Siehe [Backup und Wiederherstellung](../data/backup-and-restore.md).

## Verwandte Anleitungen

- [Game Mode: Erste Schritte](getting-started.md)
- [Backup und Wiederherstellung](../data/backup-and-restore.md)
