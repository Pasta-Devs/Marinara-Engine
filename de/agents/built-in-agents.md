# Referenz der herunterladbaren Agenten

Diese Anleitung stellt alle 30 offiziellen Erstanbieter-Pakete vor, die über **Agents → Download Agents** (Agenten herunterladen) bereitstehen, sortiert nach Kategorie. In einer frischen Marinara-Engine-Installation sind noch keine Agenten enthalten. Paketquellen, Manifeste, Artefakte und der maschinenlesbare Katalog liegen in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Zu jedem Agenten erfährst du hier, was er tut, wann er läuft oder wo er sich einklinkt, welche Chat-Modi ihn zulassen und welche Einstellungen wichtig sind. Wie du Agenten installierst und aktivierst, steht in der [Agenten-Übersicht](agents-overview.md) – lies sie zuerst.

## So liest du diese Referenz

Ein Agent ist ein kleiner KI-Helfer, der automatisch neben der eigentlichen Chat-Antwort mitläuft. Installiere ihn zuerst aus dem Katalog, dann aktiviere und konfiguriere ihn pro Chat – nicht pro Charakterkarte. Herunterladen, Aktualisieren, Deinstallieren, die Einrichtung pro Chat und der Kostenhinweis stehen in der [Agenten-Übersicht](agents-overview.md).

Zu jedem Agenten unten gibt es drei Kurzangaben.

- **Phase oder Integration**: wann ein normaler Pipeline-Agent läuft. **Pre-Generation** (vor der Generierung) läuft vor der Antwort und kann Text in den Prompt einfügen – der Prompt ist der Text, den Marinara an die KI schickt. **Parallel** läuft gleichzeitig mit der Antwort und sieht den fertigen Text nicht. **Post-Processing** (Nachbearbeitung) läuft erst, wenn die Antwort fertig ist, und kann sie lesen; manche schreiben sie auch um. Feature-Pakete wie Maps, Calls und die Conversation-Spiele klinken sich stattdessen direkt in ihre Chat-Oberfläche ein.
- **Wo er funktioniert**: die Chat-Modi, in denen sich der Agent hinzufügen lässt. Die meisten Agenten laufen in **Roleplay**-Chats. Einige wenige laufen in anderen Modi; welche das sind, steht beim jeweiligen Eintrag.
- **Wichtige Einstellungen**: die Einstellungen, die du am ehesten anpassen wirst. Du legst sie beim Hinzufügen des Agenten fest oder später in seiner Einrichtungskarte unter **Chat Settings** (Chat-Einstellungen).

Marinara sortiert die Agenten im Panel **Agents** in drei Kategorien: **Writer Agents**, **Tracker Agents** und **Misc Agents**. Diese Referenz übernimmt dieselbe Einteilung.

Ein Laufintervall bedeutet: Der Agent läuft nur alle paar Assistenten-Nachrichten statt nach jeder Nachricht. Das Intervall lässt sich in der Einrichtung des Agenten ändern, bis maximal 100.

## Writer-Agenten

Writer-Agenten formen die Geschichte oder den Schreibstil. Entweder geben sie vor der Antwort eine Richtung vor, oder sie räumen die fertige Antwort auf.

### Prose Guardian

Schreibt die letzte Antwort um, entfernt verbotene Wörter und Wiederholungen und lässt dabei die Bedeutung unangetastet. Ideal gegen ein Modell, das ständig dieselben Formulierungen bringt oder ein Wort überstrapaziert.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: die Textfelder **Banned Words** (verbotene Wörter, Standard ist `ozone`), **Prefer In Writing** und **Remove From Writing**. Der Schalter **Hold Message Until Rewrite** (standardmäßig an) blendet die Antwort aus, bis das Aufräumen fertig ist. Ohne ihn erscheint zuerst die rohe Antwort und wird danach ausgetauscht.

### Continuity Checker

Behebt handfeste Logikfehler in der letzten Antwort – etwa ein Charakter an zwei Orten gleichzeitig oder eine widersprüchliche Zeitlinie. Gefundene Probleme zeigt er als Checkliste, aus der du die gewünschten Korrekturen auswählst.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: der Schalter **Hold Message Until Rewrite**.

### Card Evolution Auditor

Beobachtet, wie sich ein Charakter im Spiel verändert, und schlägt Änderungen an dessen Charakterkarte vor. Er ändert nie eigenmächtig etwas. Jeder Vorschlag landet im Fenster **Review Character Card Updates**, wo du zustimmst oder ablehnst.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: Standardmäßig läuft er alle 8 Assistenten-Nachrichten. Siehe [Agenten-Freigaben und die Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Gibt der Geschichte einen einmaligen Schubs – aber nur, wenn du darum bittest. Ist dieser Agent in einem Roleplay-Chat aktiv, erscheint über dem Nachrichtenfeld die Schaltfläche **Push Story**. Ein Klick darauf schaltet die nächste Antwort scharf: Sie treibt dann die Handlung voran oder bringt eine Überraschung ins Spiel.

- **Phase**: Pre-Generation.
- **Wo er funktioniert**: nur Roleplay.
- **Wichtige Einstellungen**: **Story Push Mode** (**Natural** spinnt die laufenden Handlungsfäden weiter, **Random Event** streut eine plausible Überraschung ein). Optional führt er außerdem einen verborgenen Langzeit-Handlungsbogen mit, den **Secret Plot**. Die komplette Anleitung steht unter [Narrative Director und Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Durchsucht vor der Antwort die ausgewählten Lorebooks samt hochgeladener Dateien. Er fasst die relevanten Stellen zusammen und fügt diese Zusammenfassung in den Prompt ein. Ein Lorebook ist eine Sammlung von Hintergrundwissen über die Welt und die Charaktere. Die Suche ist bewusst schlank gehalten und kommt deshalb ohne eigene Datenbank aus.

- **Phase**: Pre-Generation.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: der Schalter **Use chat-active lorebooks**, die Auswahl **Fixed Source Lorebooks** und ein Datei-Upload für die unterstützten Formate. Lass diesen Agenten und Knowledge Router nicht zusammen laufen – sie überschneiden sich. Zur Einrichtung siehe [Wissensquellen](knowledge-sources.md).

### Knowledge Router

Die günstigere Alternative zu Knowledge Retrieval. Statt zusammenzufassen, liest er die Kurzbeschreibungen der Lorebook-Einträge. Passende Einträge fügt er anschließend wortwörtlich ein. Am besten funktioniert das, wenn die Einträge gute Beschreibungen haben.

- **Phase**: Pre-Generation.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: der Schalter **Use chat-active lorebooks** und die Auswahl **Fixed Source Lorebooks**. Ein Abdeckungs-Badge zeigt, wie viel Prozent der Quelleinträge eine Beschreibung haben. Zur Einrichtung siehe [Wissensquellen](knowledge-sources.md).

## Tracker-Agenten

Tracker-Agenten führen laufend Buch über die Szene, die Charaktere und die Werte. Ihr aktueller Stand lässt sich als Abschnitt in den Prompt einfügen, damit das Modell konsistent bleibt. Bei fünf der folgenden Tracker ist **Add as Prompt Section** (als Prompt-Abschnitt einfügen) standardmäßig an: World State, Quest Tracker, Character Tracker, Persona Stats und Custom Tracker. Expression Engine und Background sind die Ausnahmen.

### World State

Führt Datum, Uhrzeit, Wetter, Ort und die anwesenden Charaktere mit. Das hält die Szene geerdet, damit das Modell nicht vergisst, wo und wann die Geschichte spielt.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### Expression Engine

Liest die Stimmung der letzten Antwort heraus und wählt ein passendes Sprite oder einen passenden Gesichtsausdruck für den Charakter. Ein Sprite ist ein Charakterbild in der Szene. Praktisch für stehende Charakterbilder, die sich mit der Stimmung ändern.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Sprite Source** (**Expressions**, **Full-body** oder beides), der Schalter **Expression Avatars**, die Auswahl **Sprite Owners** sowie Regler für Größe und Deckkraft. Siehe [Charakter-Sprites](../characters/sprites.md).

### Quest Tracker

Verwaltet Quest-Ziele, deren Abschluss und die Belohnungen. Ideal für abenteuerlastiges Spiel mit sichtbarer Aufgabenliste.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### Background

Wählt aus den hochgeladenen Hintergründen das Bild, das am besten zur aktuellen Szene passt. Bilder erzeugt er nicht – für automatisch generierte Szenenhintergründe ist Illustrator zuständig.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: die üblichen Steuerelemente für Agent-Verbindung und Kontext. Die Auswahl greift ausschließlich auf Bilder zu, die bereits in der Hintergrund-Bibliothek liegen.

### Character Tracker

Führt die anwesenden Charaktere mit, dazu Stimmung, Handlungen, Aussehen, Kleidung, Gedanken und charakterbezogene Werte wie HP. Für neue Charaktere ohne Bild kann er außerdem Porträts erzeugen.

Kehrt ein wiederkehrender Charakter in die Szene zurück, greift Character Tracker für die Kontinuität auf dessen zuletzt gespeicherte Werte und eigene Felder zurück. Charaktere mit hinterlegter Karte bekommen zusätzlich ihre konfigurierten RPG-Pools und Attribute als Grundlage mit und behalten immer Avatar und Bildausschnitt der Karte. Automatisch erzeugte Porträts bleiben auf NPCs ohne passende Charakterkarte beschränkt.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an) und die optionale Einstellung **Auto-Generate NPC Avatars** mit eigener Auswahl für die Bild-Verbindung.

### Persona Stats

Führt Statusleisten für den eigenen Charakter mit, etwa Sättigung, Energie und Hygiene, dazu beliebige eigene Leisten. Ideal für Survival- oder Lebenssimulations-Spiel.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an). Siehe [Charakterfarben und Werte](../characters/colors-and-stats.md).

### Custom Tracker

Führt selbst definierte Felder mit, etwa Währungen, Zähler oder Marker. Genau richtig, wenn die eingebauten Tracker etwas nicht abdecken, das die Geschichte braucht.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Add as Prompt Section** (standardmäßig an).

### World Maps

Ergänzt die Geschichte um dauerhafte, verschachtelte Orte und räumliche Beziehungen. Du kannst Regionen, Gebiete, Räume und Verbindungen anlegen, dich zwischen Orten bewegen und die aktuelle Position als räumlichen Kontext in die Generierung einfließen lassen. Im Game Mode kommt zusätzlich die Weltkarten-Ansicht des Pakets dazu.

- **Integration**: Feature-Paket; es steuert Karten-Oberfläche und Laufzeit-Kontext im Chat bei, statt als normaler Agent in einer Generierungsphase zu laufen.
- **Wo es funktioniert**: Roleplay und Game.
- **Wichtige Einstellungen**: Aktiviere es für den Roleplay-Chat unter **Chat Settings → Agents**, oder wähle es beim Anlegen eines Spiels aus und verwalte es später in dessen Einstellungen. Installation und Entfernung erfordern einen Neustart von Marinara.
- **Komplette Anleitung**: [World Maps: Einrichtung, Bearbeitung und Reisen](hierarchical-maps.md).

## Misc-Agenten

Misc-Agenten liefern Extras wie Bilder, Musik, Publikumsreaktionen und Aktualisierungen an Charakterkarten.

### Echo Chamber

Simuliert ein Live-Publikum, das auf die Szene reagiert – sichtbar als schwebendes **Echo**-Widget im Chatbereich. Alle 30 Sekunden kommt eine neue Reaktion dazu.

- **Phase**: Parallel.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: Du wählst einen Stil aus den benannten Optionen, darunter **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** und **Harbingers**. Im Widget selbst gibt es **Re-run Echo Chamber** und **Clear messages**.

### Long-Term Memory

Extrahiert dauerhafte Erinnerungen aus Chat-Zusammenfassungen, Charakteraufzeichnungen und Lorebooks in einen paketeigenen Speicher und ruft vor der Hauptantwort passenden Kontext ab. Der Agent unterstützt das gefilterte Durchsuchen des Speichers, den Import von Quellen, die Prüfung ausstehender Entwürfe und das Platzieren abgerufenen Kontexts über eine Preset-Markierung.

- **Integration**: Funktionspaket; es liefert Kontext vor der Generierung und eine Oberfläche zur Speicherverwaltung, statt wie ein gewöhnlicher Tracker nach der Generierung zu laufen.
- **Wo er funktioniert**: Conversation, Roleplay, Visual Novel und Game. Visual Novel verwendet das Extraktionsprofil von Roleplay.
- **Wichtige Einstellungen**: Aktivierung, Token-Budget für den Abruf (128–16.384), Höchstzahl abgerufener Abschnitte (1–100), Bewertungsschwelle, Kontext der letzten Nachrichten (1–20), Abrufstil sowie semantische, lexikalische, Graph- und Schlüsselwortgewichtung, Einbeziehung erledigter Erinnerungen, Abruf-Präambel, Reasoning und Ausführlichkeit der Extraktion, Generierungsgrenzen, Quellengrenzen, Prompt-Vorlagen, KI-Schlüsselwortextraktion und Extraktion im Game Mode.
- **Datenlebenszyklus**: Mit den Backup-Bedienelementen unter Memory Settings exportierst oder ersetzt du Speicher, Entwürfe und Einstellungen. **Delete all data** löscht Erinnerungen, Entwürfe, Aktivität und abgeleitete Indizes dauerhaft, behält aber die Einstellungen. Beim Deinstallieren bleibt der Long-Term-Memory-Speicher für eine spätere Neuinstallation erhalten. Installation, Aktualisierung und Entfernung erfordern einen Neustart von Marinara.
- **Kompatibilität**: Engine `2.3.3` bis ausschließlich `2.4.0`. Das Paket verwendet die Berechtigungen `agent-runtime`, `chat-read`, `routes`, `storage` und `ui`.

### Illustrator

Zuständig für Bild- und Videogenerierung. Er schreibt visuelle Prompts für wichtige Momente und schickt sie an den eingerichteten Medien-Anbieter.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: Standardmäßig läuft er alle 5 Assistenten-Nachrichten. Zu den Einstellungen gehören **Prompt Model**, **Image Style**, **Attach Card Appearance** und **Send Avatar References**. Die komplette Einrichtung steht unter [Illustrator-Agent](../media/illustrator-agent.md).

### Lorebook Keeper

Legt Lorebook-Einträge aus wichtigen Fakten des Chats an und aktualisiert sie, sodass die Weltnotizen mit dem Spiel mitwachsen.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay. Im Game Mode erledigt die Variante **Game Session Keeper** dieselbe Aufgabe am Ende einer Sitzung.
- **Wichtige Einstellungen**: Standardmäßig läuft er alle 8 Assistenten-Nachrichten. Die Auswahl **Target Lorebook** bestimmt, wo die Einträge landen – wahlweise automatisch.

### Combat

Verwaltet den Kampf samt Initiative, HP und Zugreihenfolge. Ist er aktiv, erscheint über dem Nachrichtenfeld die Schaltfläche **Encounter**.

- **Phase**: Parallel.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: Er bringt ein Würfelwurf-Werkzeug für die Auflösung der Züge mit.

### Immersive HTML

Ergänzt die letzte Antwort um visuelle Elemente aus der Spielwelt, etwa eine gestaltete Notiz oder einen Bildschirm – die Geschichte selbst bleibt unverändert.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: nur Roleplay.
- **Wichtige Einstellungen**: der Schalter **Hold Message Until Rewrite**.

### Music DJ

Liest die Stimmung der Szene und spielt passende Musik. Möglich sind Spotify, YouTube oder lokale Audiodateien.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay und Game.
- **Wichtige Einstellungen**: Die Einstellung **Music Player** wählt den Anbieter, und jeder Anbieter braucht seine eigene Einrichtung. Alle Schritte für Spotify, YouTube und lokale Musik stehen unter [Music DJ](../media/music.md).

### Haptic Feedback

Liest die Erzählung mit und steuert daraus in Echtzeit angeschlossene Intim-Spielzeuge über Intiface Central. Intiface Central muss bereits laufen und ein Spielzeug verbunden sein, bevor du diesen Agenten aktivierst.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: die Auswahl **Touch Sensitivity** (**Subtle**, **Standard** oder **Intense**) und das Feld **Intiface URL**. Die komplette Einrichtung steht unter [Haptic Feedback einrichten](../integrations/haptic-feedback.md).

### CYOA Choices

Hängt nach jeder Antwort anklickbare „Was tust du?“-Schaltflächen an – Spielbuch-Feeling inklusive. Hinter jeder Schaltfläche steckt eine vollständige Handlung, die du mit einem Klick abschickst.

- **Phase**: Post-Processing.
- **Wo er funktioniert**: Roleplay.
- **Wichtige Einstellungen**: **Edit** schreibt die Auswahlmöglichkeiten um, **Re-roll** erzeugt neue.

### Calls

Ergänzt Conversation-Charaktere um Live-Audio- und Videoanrufe, inklusive selbst gestarteter und eingehender Anrufe, reiner Anruf-Transkripte, Sprachausgabe, Mikrofoneingabe und Charakter-Videoclips.

- **Integration**: Conversation-Feature-Paket; es ergänzt Steuerelemente in Toolbar, Chat-Oberfläche und Chat Settings, statt als normaler Agent in einer Generierungsphase zu laufen.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Öffne **Chat Settings → Agents → Calls**, um Anrufe zu aktivieren und Sprachausgabe, Mikrofon, Klingeln und Videoverhalten festzulegen. Siehe [Audio- und Videoanrufe in Conversation](../conversation/calls.md). Installation und Entfernung erfordern einen Neustart von Marinara.

### UNO

Bringt einen regelgetreuen UNO-Tisch für dich und Conversation-Charaktere, mit einstellbaren Hausregeln und Platz für insgesamt zwei bis zehn Mitspielende.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/uno`; in der Einrichtung legst du Mitspielende und Hausregeln fest. Installation und Entfernung erfordern einen Neustart von Marinara.

### Chess

Bringt ein Schachbrett für zwei, das nur legale Züge zulässt, Schach und Schachmatt erkennt, geschlagene Figuren zeigt und den Gegner im Charakter bleiben lässt.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/chess` und wähle dann den Gegner und deine Farbe. Installation und Entfernung erfordern einen Neustart von Marinara.

### Poker

Bringt einen Texas-Hold'em-Tisch für insgesamt zwei bis acht Mitspielende, mit Blinds, Setzrunden, Side Pots, Showdown-Auswertung und Gegnern, die im Charakter bleiben.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/poker` und wähle dann Mitspielende, Start-Chips und Blind-Höhe. Installation und Entfernung erfordern einen Neustart von Marinara.

### 8-Ball Pool

Bringt einen Billardtisch für zwei mit vollen und halben Kugeln, Zielen und Stoßstärke, Fouls, Ball-in-Hand und Stößen des Gegners im Charakter.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/8ball` und wähle dann den Gegner. Installation und Entfernung erfordern einen Neustart von Marinara.

### Tic-Tac-Toe

Bringt ein Tic-Tac-Toe-Feld für zwei, mit frei wählbaren oder zufälligen Zeichen, korrekter Zugabwicklung sowie Sieg- und Unentschieden-Erkennung.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/tictactoe` (alternativ `/ttt`) und wähle dann Gegner und Zeichen. Installation und Entfernung erfordern einen Neustart von Marinara.

### Rock-Paper-Scissors

Bringt eine Partie Schere-Stein-Papier für zwei, bei der beide Entscheidungen bis zur Auflösung verborgen bleiben.

- **Integration**: Conversation-Spielepaket.
- **Wo es funktioniert**: Conversation.
- **Wichtige Einstellungen**: Starte es über die Spieleauswahl oder mit `/rps` und wähle dann den Gegner sowie ein Match über drei, fünf oder sieben Partien. Installation und Entfernung erfordern einen Neustart von Marinara.

## Verwandte Anleitungen

- [Agenten-Übersicht](agents-overview.md)
- [Illustrator-Agent](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback einrichten](../integrations/haptic-feedback.md)
- [Wissensquellen](knowledge-sources.md)
- [Narrative Director und Secret Plot](../roleplay/narrative-director.md)
- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Conversation-Tischspiele](../conversation/table-games.md)
