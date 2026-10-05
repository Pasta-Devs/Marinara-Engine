# Kampfbegegnungen (Roleplay)

In dieser Anleitung erfährst du, wie Kampfbegegnungen im Roleplay Mode funktionieren. Du lernst, wie du den **Combat**-Agenten einschaltest, einen Kampf startest und ihn im Encounter-Fenster spielst. Außerdem erfährst du, worin sich diese Funktion vom Kampfsystem im Game Mode unterscheidet.

Kampfbegegnungen sind eine optionale Roleplay-Funktion. Sie geben der Szene einen strukturierten, zugbasierten Kampfbildschirm mit Lebensbalken, Gegner- und Party-Listen sowie einem Kampflog. Bleibt die Funktion aus, laufen Roleplay-Chats genau wie bisher.

## Den Combat-Agenten aktivieren

Ein Agent ist ein Helfer, der während der Generierung einer Nachricht automatisch mitläuft. Der **Combat**-Agent (Kampf) bringt die Kampffunktion in einen Roleplay-Chat. Standardmäßig ist er aus – du aktivierst ihn also pro Chat.

1. Öffne den Chat, den du um Kämpfe erweitern willst.
2. Öffne **Chat Settings** (Chat-Einstellungen) über die Schaltfläche im Chat; anfangs liegt sie oben rechts.
3. Öffne den Bereich **Agents** (Agenten).
4. Aktiviere **Enable Agents** (Agenten einschalten), falls noch nicht geschehen.
5. Füge dem Chat den **Combat**-Agenten hinzu.

In der Aktionsleiste über dem Nachrichtenfeld erscheint daraufhin die Schaltfläche **Encounter** (Begegnung) mit gekreuzten Schwertern. Ihr Tooltip – der Kurzhinweis beim Draufzeigen – lautet **Start Combat Encounter**. Fehlt die Schaltfläche, ist der **Combat**-Agent in diesem Chat nicht aktiv.

Wie das Agents-Panel im Detail funktioniert, liest du unter [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Eine Begegnung starten

Klick auf **Encounter**, um das Einrichtungsfenster zu öffnen. Es trägt den Titel **Configure Combat Narrative** und bestimmt den Schreibstil, den die KI während und nach dem Kampf verwendet.

Das Einrichtungsfenster hat zwei Stilgruppen:

- **Combat Narration**: der Schreibstil während des Kampfes.
- **Summary Narration**: der Schreibstil der Zusammenfassung, die am Ende des Kampfes in den Chat geschrieben wird.

Jede Gruppe hat dieselben vier Einstellungen:

- Zeitform: **Present Tense** (Präsens) oder **Past Tense** (Präteritum).
- Person: **First Person**, **Second Person** oder **Third Person** – also erste, zweite oder dritte Person.
- Erzählung: **Omniscient** (die Erzählstimme weiß alles) oder **Limited** (die Erzählstimme weiß nur, was ein einzelner Charakter weiß).
- Ein Textfeld für die Perspektive: Trag ein, durch wessen Augen die Szene erzählt wird. Bleibt das Feld leer, erzählt eine neutrale Stimme.

Unter den Stilgruppen sitzt das optionale Dropdown-Menü **Spellbook** (Zauberbuch). Ein Spellbook ist ein besonderes Lorebook – eine Sammlung von Weltwissen-Einträgen – und listet die Zauber und Fähigkeiten auf, die im Kampf zur Verfügung stehen. Häng eines an, damit die KI weiß, was die Charaktere wirken können. Ohne Spellbooks bleibt die Einstellung auf **None**.

Klick zum Schluss auf **Begin Combat**. Mit **Cancel** schließt du die Einrichtung, ohne einen Kampf zu starten.

Nach dem Klick auf **Begin Combat** zeigt die App "Initializing combat encounter...", während die KI den Kampf aufbaut. Sie erzeugt die Gegner, die Party, deren Angriffe und deren Gegenstände. Das dauert ein paar Sekunden.

## Die Begegnung spielen (das Encounter-Fenster)

Der komplette Kampfbildschirm – das Encounter-Fenster – trägt den Titel **Combat Encounter** und besteht aus diesen Teilen:

- **Enemies** (Gegner): ein Raster aus Gegnerkarten. Jede Karte zeigt einen Lebensbalken und aktive Statuseffekte.
- **Party**: deine Seite des Kampfes, also deine Abenteuergruppe. Dein eigener Charakter ist mit **(You)** markiert.
- **Combat Log**: ein laufendes Protokoll dessen, was in jedem Zug passiert.
- **Your Actions** (deine Aktionen): die Schaltflächen für deinen Zug.

Unter **Your Actions** hast du drei Möglichkeiten:

- Wähl einen deiner **Attacks** (Angriffe).
- Setz einen deiner **Items** (Gegenstände) ein.
- Tipp eine freie Aktion in das Feld **Custom Action** (eigene Aktion) und schick sie ab. Das deckt alles ab, wofür es keine Schaltfläche gibt, zum Beispiel "I kick sand into the guard's eyes".

Braucht ein Angriff oder Gegenstand ein Ziel, öffnet sich das Fenster **Select Target** (Ziel wählen). Wähl einen einzelnen Gegner oder Verbündeten – oder **All Enemies** für einen Flächenangriff, der alle Gegner gleichzeitig trifft. Manche Aktionen wirken ausschließlich flächig und überspringen die Einzelziel-Auswahl.

Während die KI einen Zug berechnet, zeigt der Bildschirm "Processing action..." und die Schaltflächen sind gesperrt. Sobald der Zug fertig ist, geben sie wieder nach.

Liefert die KI Daten, die die App nicht lesen kann, erscheint statt einer kaputten Oberfläche der Bildschirm **Combat Error**. Über **Close Encounter** verlässt du den Kampf von dort aus gefahrlos.

## Eine Begegnung beenden

Ein Kampf lässt sich auf zwei Arten vorzeitig beenden – dazu kommt das natürliche Ende, sobald eine Seite gewinnt.

- Klick in der Kopfleiste auf **Conclude** (abschließen), um den Kampf vorzeitig zu beenden. Erst kommt eine Rückfrage. Danach schreibt die App eine Kampfzusammenfassung in den Chat.
- Klick in der Kopfleiste auf **X**, um den Kampf zu schließen und zu verwerfen. Erst kommt eine Rückfrage im Fenster **End Combat**. Eine Zusammenfassung entsteht dabei nicht.

Endet ein Kampf von allein, erscheint ein Ergebnisbanner: **VICTORY**, **DEFEAT**, **FLED** oder **INTERRUPTED**. Anschließend schreibt die App eine Kampfzusammenfassung in den Chat, und zwar im gewählten Stil aus **Summary Narration**. Sobald sie fertig ist, bringt dich **Close Combat Window** zurück in die Szene.

Scheitert die Generierung der Zusammenfassung, heißt die Schaltfläche stattdessen **Close Anyway**. Ein Klick darauf bringt dich ohne Zusammenfassung zurück in die Szene.

## Unterschiede zum Kampf im Game Mode

Kampfbegegnungen sind eine leichtgewichtige, eigenständige Kampfebene für den Roleplay Mode. Der Game Mode bringt sein eigenes Kampfsystem mit.

Die wichtigsten Unterschiede:

- Eine Roleplay-Begegnung startest du selbst über **Encounter**. Im Game Mode startet der Game Master (GM) – die KI, die das Spiel leitet – den Kampf, sobald die Geschichte es verlangt.
- Der Roleplay-Kampf braucht den eingeschalteten **Combat**-Agenten. Der Game-Mode-Kampf nutzt den **Combat**-Agenten nicht und läuft auch ohne ihn.
- Beide Systeme nutzen unterschiedliche Kampfbildschirme und teilen sich nichts.

Das Kampfsystem des Game Mode beschreibt [Game-Mode-Kampf](../game/combat.md).

## Verwandte Anleitungen

- [Roleplay Mode: erste Schritte](getting-started.md)
- [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Game-Mode-Kampf](../game/combat.md)
