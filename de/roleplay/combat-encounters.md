# Kampfbegegnungen (Roleplay)

Eine Kampfbegegnung gibt einer Roleplay-Szene einen zugbasierten Kampfbildschirm mit Lebensbalken, Gegner- und Party-Listen und einem Kampfprotokoll. Sie ist optional. Ein Chat ohne sie läuft wie bisher. Game Mode hat ein eigenes, davon getrenntes Kampfsystem: siehe [Game Mode: Kampf](../game/combat.md).

## Kämpfe einschalten

Ein Agent ist ein Helfer, der neben den Antworten mitläuft. Der Agent **Combat** (Kampf) bringt die Kampffunktion mit. Standardmäßig ist er aus, du schaltest ihn also pro Chat ein.

1. Öffne den Chat. Öffne **Chat Settings** (Chat-Einstellungen) über die Schieberegler-Schaltfläche im Chat.
2. Wechsle zu **Agents** (Agenten).
3. Schalte **Enable Agents** (Agenten aktivieren) ein, falls es aus ist.
4. Füge den Agenten **Combat** aus den Listen unter dem Schalter hinzu.

Über dem Nachrichtenfeld erscheint jetzt die Schaltfläche **Encounter** (Begegnung) mit den gekreuzten Schwertern. Ihr Tooltip lautet **Start Combat Encounter**.

Wenn es nicht funktioniert hat: Fehlt die Schaltfläche, ist der Agent **Combat** in diesem Chat nicht aktiv. Wie Agenten funktionieren, liest du unter [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Eine Begegnung starten

1. Klick auf **Encounter**. Das Fenster **Configure Combat Narrative** öffnet sich. Es legt den Schreibstil fest, den die KI verwendet.
2. Wähl den Stil für **Combat Narration** (während der Kampf läuft) und für **Summary Narration** (die Zusammenfassung, die am Ende in den Chat geschrieben wird). Beide Gruppen haben dieselben vier Einstellungen, die unten aufgeführt sind. Die Standardwerte funktionieren, du kannst also auch gleich auf **Begin Combat** klicken.
3. Optional: Wähl ein **Spellbook** (Zauberbuch). Ein Spellbook ist ein Lorebook (eine gespeicherte Sammlung von Weltwissen), das die Zauber und Fähigkeiten auflistet, die im Kampf zur Verfügung stehen. Nutzt du keins, lass die Auswahl auf **None**.
4. Klick auf **Begin Combat**. Mit **Cancel** (Abbrechen) schließt du das Fenster, ohne einen Kampf zu starten.

Während die KI die Gegner, deine Party sowie deren Angriffe und Gegenstände aufbaut, siehst du „Initializing combat encounter...“. Das kann ein paar Sekunden dauern.

| Stileinstellung | Auswahl |
| --- | --- |
| Zeitform | **Present Tense** (Präsens), **Past Tense** (Präteritum) |
| Person | **First Person**, **Second Person**, **Third Person** (erste, zweite oder dritte Person) |
| Erzählweise | **Omniscient**: Die Erzählstimme weiß alles. **Limited**: Sie weiß, was ein einzelner Charakter weiß. |
| Perspektive | Ein Textfeld dafür, durch wessen Augen die Szene erzählt wird. Lass es leer, damit eine neutrale Stimme erzählt. |

## Deinen Zug spielen

Der Bildschirm **Combat Encounter** besteht aus vier Teilen:

- **Enemies** (Gegner): Karten mit Lebensbalken und Statuseffekten.
- **Party**: deine Seite. Dein eigener Charakter ist mit **(You)** markiert.
- **Combat Log**: ein Protokoll jedes Zuges.
- **Your Actions** (deine Aktionen): deine Schaltflächen.

In deinem Zug wählst du unter **Attacks** (Angriffe) einen Angriff, setzt unter **Items** (Gegenstände) einen Gegenstand ein oder tippst eine freie Aktion in **Custom Action** (eigene Aktion) und schickst sie ab, zum Beispiel „I kick sand into the guard's eyes“.

Braucht eine Aktion ein Ziel, öffnet sich **Select Target** (Ziel wählen). Wähl einen Gegner oder Verbündeten oder **All Enemies** für einen Flächenangriff. Aktionen, die nur flächig wirken, überspringen diesen Schritt.

Während die KI den Zug berechnet, siehst du „Processing action...“, und deine Schaltflächen sind gesperrt. Sobald der Zug fertig ist, werden sie wieder freigegeben.

Wenn es nicht funktioniert hat: Liefert die KI Daten, die die App nicht lesen kann, erscheint der Bildschirm **Combat Error**. Klick auf **Close Encounter** (Begegnung schließen), um den Kampf gefahrlos zu verlassen, und starte dann einen neuen.

## Eine Begegnung beenden

- **Conclude** (abschließen) in der Kopfleiste beendet den Kampf vorzeitig. Ein Fenster fragt nach einer Bestätigung, danach wird eine Kampfzusammenfassung in den Chat geschrieben.
- Das **X** in der Kopfleiste schließt und verwirft den Kampf, nach einer Rückfrage im Fenster **End Combat**. Eine Zusammenfassung wird nicht geschrieben.
- Gewinnt eine Seite, zeigt ein Banner **VICTORY**, **DEFEAT**, **FLED** oder **INTERRUPTED**. Eine Zusammenfassung wird in deinem Stil aus **Summary Narration** in den Chat geschrieben. Sobald sie fertig ist, klick auf **Close Combat Window** (Kampffenster schließen).

Schlägt die Zusammenfassung fehl, heißt die Schaltfläche **Close Anyway**. Klick darauf, um ohne Zusammenfassung in die Szene zurückzukehren.

## Unterschiede zum Kampf im Game Mode

- Eine Roleplay-Begegnung startest du selbst über **Encounter**. Im Game Mode startet der Game Master den Kampf, sobald die Geschichte es verlangt.
- Der Roleplay-Kampf braucht den Agenten **Combat**. Der Kampf im Game Mode braucht ihn nicht.
- Die beiden Systeme nutzen unterschiedliche Kampfbildschirme.

## Verwandte Anleitungen

- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Game Mode: Kampf](../game/combat.md)
