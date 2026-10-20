# Personas: erstellen und bearbeiten

In dieser Anleitung erfährst du, was eine Persona ist, wie du eine erstellst und bearbeitest und wie du Personas importierst, exportierst, duplizierst und löschst. Eine Persona ist deine eigene Charakterkarte: die Identität, mit der Marinara Engine dich im Chat darstellt.

## Was eine Persona ist

Eine Persona ist die Rolle, die du im Chat einnimmst. Sie hat einen Namen, eine Beschreibung und weitere optionale Angaben. Marinara schickt diese Angaben in jeden Prompt – also in den Text, den Marinara an die KI sendet –, damit die KI weiß, mit wem sie spricht.

Du kannst beliebig viele Personas anlegen und im **Personas**-Panel verwalten. Wähle für jeden Chat eine Persona oder **None** (keine), um keine Persona zu verwenden. Diese Anleitung behandelt das Erstellen und Bearbeiten. Wie du festlegst, welche Persona ein Chat verwendet, steht unter [Die Persona für einen Chat wählen](choosing-your-persona.md).

### Das Makro {{user}}

Ein Makro ist ein Platzhalter im Text, den die App vor dem Senden des Prompts durch einen echten Wert ersetzt. Für **{{user}}** setzt Marinara den Namen der Persona ein, die der Chat gerade verwendet – also die für diesen Chat ausgewählte Persona. Heißt diese Persona zum Beispiel Alex, dann steht im Prompt Alex.

Wenn für einen Chat keine Persona ausgewählt ist, spricht die KI dich mit dem allgemeinen Namen „User“ an, und es gehen keinerlei Persona-Angaben mit. Wie ein Chat seine Persona auswählt, steht unter [Die Persona für einen Chat wählen](choosing-your-persona.md). Mehr zu Makros findest du unter [Makros](../prompts/macros.md).

## Das Personas-Panel

Das **Personas**-Panel ist deine Persona-Bibliothek. Öffne es über das Personen-Symbol oben in der rechten Seitenleiste. Es steht dort neben den Schaltflächen **Lorebooks**, **Presets**, **Connections** (Verbindungen) und **Agents** (Agenten).

Diese Bedienelemente stehen bereit:

- **Download** (Herunterladen) öffnet den [Card Browser](bot-browser.md), in dem du auf PlotLight auch Personas findest.
- **Open Library** (Bibliothek öffnen) öffnet die Persona-Bibliothek als eigene, responsive Seite. Sie nutzt dasselbe Layout aus Raster und Vorschau wie die Charakter-Bibliothek – mit Persona-Beschreibungen, Kartenabschnitten, Tags und Token-Schätzungen.
- **New** (Neu) erstellt eine Persona.
- **Import** (Importieren) öffnet das Fenster **Import Persona**.
- **Select** (Auswählen) schaltet die Mehrfachauswahl ein, sodass du mehrere Personas auf einmal bearbeiten kannst.
- Das Suchfeld mit dem Platzhaltertext **Search personas** (Personas durchsuchen) durchsucht Name, Beschreibung, Kommentar und Tags.
- Das Sortier-Dropdown-Menü bietet **Manual order** (manuelle Reihenfolge), **A-Z**, **Z-A**, **Newest**, **Oldest** und **Tokens** (geschätzte Prompt-Größe). **Manual order** behält die Reihenfolge bei, die du festlegst: Zieh eine Zeile nach oben oder unten oder drück auf einer fokussierten Zeile Alt+Pfeil nach oben oder Alt+Pfeil nach unten. Auf einem Touchscreen hältst du eine Zeile gedrückt, um sie aufzunehmen.
- **New Folder** (Neuer Ordner) legt einen Ordner an, um Personas zu sortieren.
- Der Chip **Tags** klappt die Tag-Liste zum Filtern auf.

Jede Zeile zeigt Avatar, Name und eine kurze Vorschau der Beschreibung. Zeigst du auf eine Zeile, erscheinen die Aktionen **Duplicate** (Duplizieren) und **Delete** (Löschen). Ein Klick auf die Zeile öffnet die Persona im ganzseitigen **Persona Editor**.

Passen nicht alle Personas auf eine Seite, erscheint unten die Schaltfläche **Load more** (Mehr laden). Solange noch keine Persona existiert, zeigt das Panel den kurzen Hinweis „No personas yet“.

## Eine Persona erstellen

1. Öffne das **Personas**-Panel.
2. Klick auf **New**. Das Fenster **Create Persona** öffnet sich.
3. Trag im Feld **Name** einen Namen ein. Das ist das einzige Pflichtfeld.
4. Klick auf **Create**.

Die Persona entsteht mit leerer Beschreibung und öffnet sich sofort im vollständigen **Persona Editor**, wo du den Rest ausfüllst. Weitere Felder lassen sich im Erstellen-Fenster nicht setzen. Alles Übrige bearbeitest du danach im **Persona Editor**.

Wähle die neu erstellte Persona in dem Chat aus, in dem du sie verwenden möchtest.

## Der Persona Editor

Öffnest du eine Persona, ersetzt der ganzseitige **Persona Editor** den Chatbereich. Die Kopfzeile enthält:

- Einen Pfeil **Back** (Zurück), der den Editor schließt.
- Die Avatar-Kachel. Ein Klick darauf lädt einen neuen Avatar hoch. Ist eine Verbindung für die Bildgenerierung eingerichtet, erscheint hier zusätzlich die Zauberstab-Schaltfläche **Generate avatar** (Avatar generieren).
- Das Namensfeld und ein Kommentarfeld (für eine kurze Notiz wie „Modern AU version“).
- Eine Schaltfläche **Save** (Speichern). Sie bleibt ausgegraut, bis du etwas änderst.
- Symbolaktionen in der Kopfzeile: **Export persona** (Persona exportieren), **Add persona as character** (Persona als Charakter hinzufügen), **Duplicate persona** (Persona duplizieren) und **Delete persona** (Persona löschen).

Willst du den Editor mit ungespeicherten Änderungen verlassen, erscheint ein Banner mit dem Text „You have unsaved changes. Close without saving?“. Zur Wahl stehen **Keep editing** (Weiter bearbeiten), **Discard & close** (Verwerfen und schließen) und **Save & close** (Speichern und schließen).

Der Editor-Inhalt ist in Tabs gegliedert, in dieser Reihenfolge: **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** und **Stats**.

### Tab **Metadata**

Im Tab **Metadata** stehen Identität und Bibliotheksangaben:

- Eine Zeile **Persona ID** mit einer Schaltfläche **Copy** (Kopieren). Die meisten brauchen sie nie; für Support-Anfragen ist sie nützlich.
- Das Widget zum Zuschneiden des Avatars. Zieh am runden Ausschnitt, um ihn zu verschieben oder zu zoomen.
- **Name**: der Anzeigename der Persona. Marinara fügt ihn als deine Identität in die Prompts ein.
- **Creator**: wer diese Persona erstellt hat – für die Namensnennung beim Teilen.
- **Phonetic name**: eine optionale Aussprachevorgabe. Sie greift nur, wenn Text to Speech (TTS) den Persona-Namen vorliest. TTS ist die Sprachausgabe der App.
- **Title / Comment**: eine kurze private Notiz, die in der Bibliothek unter dem Namen steht.
- **Version**: eine frei wählbare Versionsangabe, mit der du eigene Änderungen nachhältst. Der Standard ist **1.0**.
- **Tags**: frei wählbare Schlagwörter. Drück Enter oder klick auf **Add** (Hinzufügen), um eines zu ergänzen. Sobald Tags vorhanden sind, erscheint die Schaltfläche **Remove All** (Alle entfernen). Im **Personas**-Panel kannst du nach Tags filtern.
- **Creator Notes**: eine private, mehrzeilige Notiz. Sie geht nicht an die KI.

Unter dem Feld **Version** sitzt das Panel **Version history**. Wie es funktioniert, erklärt der Abschnitt „Versionsverlauf“ weiter unten.

### Tab **Card**

Im Tab **Card** schreibst du die zentralen Persona-Felder. Jedes Feld ist ein großes Textfeld mit laufend geschätzter Token-Zahl darunter. Über eine Leiste mit Sprungmarken springst du direkt zu jedem Abschnitt.

- **Description**: deine allgemeine Identität und Rolle. Dieser Text geht in jeden Prompt, damit die KI weiß, wer du bist.
- **Personality**: Temperament, Verhalten, Sprechgewohnheiten und emotionale Muster.
- **Backstory**: Vorgeschichte, Herkunft, Beziehungen und prägende Ereignisse.
- **Appearance**: äußere Beschreibung, Kleidung und visuelle Details, die sich das Modell merken soll.
- **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder): ein optionaler Schalter unter **Appearance**, standardmäßig aus. Schalte ihn ein, um ein zweites Feld für kurze Bild-Tags zu öffnen, die deine Persona beschreiben, etwa ein LoRA-Triggerwort. Ist der Schalter an und das Feld ausgefüllt, verwenden Bild-Prompts diese Tags genau so, wie sie dastehen, und **Appearance** dient als Hintergrund. Der Erzähler bekommt immer den vollständigen Text aus **Appearance**.
- **Scenario**: die Standardsituation oder der Rahmen für Roleplay. Damit legst du fest, wo die Persona startet.

Diese Textfelder unterstützen Makros. Anführungszeichen, die du tippst, passt die App automatisch an den eingestellten Zitatstil an.

### Tab **Convo**

Der Tab **Convo** enthält Felder, die nur im Conversation Mode gelten. In Roleplay oder Game Mode gehen sie nie mit. Dazu zählen **Convo Display Name**, **About Me** und **Convo Behavior**. Da Charaktere dieselben Felder haben, gibt es dafür eine eigene Anleitung: [Profile im Conversation Mode](../conversation/profiles.md).

### Tab **Lorebook**

Im Tab **Lorebook** hängst du Lorebook-Einträge an die Persona. Ein Lorebook ist eine Sammlung von World-Info-Einträgen, die bei passender Gelegenheit zusätzliches Hintergrundwissen liefern. Einträge, die an eine Persona gekoppelt sind, können auslösen, sobald diese Persona im Chat ist. Siehe [Lorebooks im Überblick](../lorebooks/overview.md).

### Tab **Sprites**

Im Tab **Sprites** lädst du stehende Charakterbilder für die Persona hoch. Sprites – die Charakterbilder auf der Bühne – kommen in Game Mode und Roleplay zum Einsatz. Es gibt Kategorie-Tabs für **Facial Expressions**, **Full-body** und **Clips**. Du kannst Bilder einzeln hochladen oder mit **Upload Folder** (Ordner hochladen) einen ganzen Ordner voller PNG-Bilder auf einmal einlesen. Sprites sind ein gemeinsames System; alle Details stehen unter [Charakter-Sprites](sprites.md).

### Tab **Gallery**

Im Tab **Gallery** sammelst du Referenzbilder und Videos zur Persona. Er hat die beiden Unter-Tabs **Images** und **Videos**. Über **Upload Persona Images** oder **Upload Persona Videos** fügst du Dateien hinzu. Der Unter-Tab **Videos** verwaltet außerdem die Videoclips für die Anruf-Funktion im Conversation Mode. Siehe [Galerien für Charaktere und Personas](galleries.md).

### Tab **Colors**

Der Tab **Colors** bestimmt, wie die Persona im Chat aussieht. Die Farben gelten für den Namen, die Dialogzeilen und die Nachrichtenblase.

- **Extract Colors from Avatar** (Farben aus dem Avatar übernehmen) wählt die Farben automatisch aus dem Avatarbild. Ohne Avatar bleibt die Schaltfläche ausgegraut und zeigt „Upload an avatar first“.
- **Name Display Color** setzt die Farbe des Persona-Namens. CSS-Verläufe sind erlaubt.
- **Dialogue Highlight Color** setzt die Farbe des Textes innerhalb von Anführungszeichen.
- **Message Box Color** setzt die Hintergrundfarbe der Chatblase deiner Persona.

Bleibt eines dieser Felder leer, gelten die Standardfarben des Themes. Ausführlich beschreiben Farben und Werte die [Charakterfarben und RPG-Werte](colors-and-stats.md).

### Tab **Stats**

Der Tab **Stats** besteht aus zwei getrennten Blöcken. Beide speisen die Werteanzeige (HUD) im Chat – die Info-Leiste am oberen Chatrand.

- **Enable Persona Stats** (Persona-Werte aktivieren) schaltet Statusbalken für Bedürfnisse wie Hunger, Energie und Stimmung frei. Beim ersten Aktivieren bekommst du Startbalken für Satiety, Energy, Hygiene und Mood, jeweils bei 100 von 100. Der Agent **Persona Stats** passt diese Werte im Lauf der Geschichte an.
- **Enable RPG Attributes** (RPG-Attribute aktivieren) schaltet Pools und Attribute im RPG-Stil frei. Beim ersten Aktivieren bekommst du die Start-Pools HP und MP bei 100 von 100 und die Startattribute STR, DEX, CON, INT, WIS und CHA bei 10. Diese Werte werden für Kampf und Game Mode sowie für optionale Würfe in Roleplay oder Game Mode mit der Persona-Karte gesendet. Tracker-Agenten aktualisieren sie nicht.

Ist ein Game-Mode-Regelsatz installiert oder enthält die Persona noch einen Bogen für einen Regelsatz, den du nicht mehr hast, erscheint unter diesen beiden Blöcken der Block **Ruleset sheets** (Regelsatzbögen). Er enthält die Startkonfiguration deiner Persona für jeden Regelsatz, die ein neues Spiel mit diesem Regelsatz übernimmt. Siehe [Regelsatzbögen](colors-and-stats.md#ruleset-sheets).

Die Werte hier sind die Startvorgaben für neue Chats. Die Persona-Statusbalken können sich automatisch aktualisieren, wenn der Agent Persona Stats aktiviert ist; Pools und Attribute im RPG-Stil der Persona verwaltet kein Agent. Die vollständige Erklärung steht unter [Charakterfarben und RPG-Werte](colors-and-stats.md).

## Versionsverlauf

Speicherst du eine Änderung an den Kartenfeldern einer Persona, legt Marinara automatisch einen Schnappschuss an. Das Panel **Version history** im Tab **Metadata** listet diese gespeicherten Versionen mit Zeitstempel auf.

Zu jeder gespeicherten Version kannst du:

1. Auf den Titel klicken, um sie mit der aktuellen Persona zu vergleichen.
2. Auf **Rename this saved version** (Stiftsymbol) klicken, um die Versionsbezeichnung zu korrigieren, ohne die Version wiederherzustellen.
3. Auf **Restore this version** klicken, um die aktuelle Persona mit der gespeicherten Version zu überschreiben. Ein Dialogfenster fragt vorher nach.
4. Auf **Delete this saved version** klicken, um den Eintrag aus dem Verlauf zu entfernen. An der aktuellen Persona ändert das nichts.

Vor der ersten Bearbeitung steht im Panel „Previous persona states will appear here after the next edit.“.

Mit **Reset** (Zurücksetzen) in der Panel-Kopfzeile löschst du alle gespeicherten Persona-Schnappschüsse und setzt die aktuelle Kartenversion auf `0.0`. Marinara fragt vorher nach, denn ein gelöschter Verlauf lässt sich nicht zurückholen.

## Eine Persona duplizieren

Klick in einer Persona-Zeile auf **Duplicate** oder in der Kopfzeile des **Persona Editor** auf das Symbol **Duplicate persona**. Das erzeugt eine vollständige Kopie mit dem Namen „{original name} (Copy)“. Übernommen werden alle Kartenfelder, Farben, Werte und Convo-Felder. Das Duplizieren einer Persona ändert die Persona-Auswahl keines Chats.

## Personas löschen

Um eine einzelne Persona zu löschen, klick in ihrer Zeile auf das Papierkorb-Symbol oder in der Kopfzeile des **Persona Editor** auf **Delete persona**. Es erscheint ein Dialogfenster zur Bestätigung. Eine gelöschte Persona lässt sich nicht zurückholen.

Für mehrere auf einmal klick im **Personas**-Panel auf **Select** und hak die gewünschten Personas ab. Lösch sie anschließend über **Delete** in der Auswahlleiste. Schlägt eine Löschung fehl, bleiben die betroffenen Einträge ausgewählt, sodass du es erneut versuchen kannst.

## Personas importieren und exportieren

### Import

Klick im **Personas**-Panel auf **Import**, um das Fenster **Import Persona** zu öffnen. Zieh Dateien hinein oder klick, um sie auszuwählen. Mehrere Dateien auf einmal sind möglich. Zwei Dateitypen werden akzeptiert:

- Native Paketdateien **.marinara**. Sie stellen alle Persona-Details, Sprites und die Struktur der Galerie wieder her.
- **.json**-Dateien. Ein JSON-Export aus Marinara wird vollständig importiert. Eine allgemeine JSON-Datei aus einem anderen Werkzeug ordnet Marinara Feld für Feld einer neuen Persona zu. Der Name ist Pflicht. Weitere erkannte Felder übernimmt Marinara, sofern sie vorhanden sind.

Jede Datei zeigt ein Symbol für Erfolg oder Fehlschlag samt Meldung. Eine Zusammenfassungszeile nennt, wie viele Dateien geklappt haben und wie viele nicht.

### Export

Exportieren kannst du über das Symbol **Export persona** im **Persona Editor** oder über die Sammelaktion **Export** im Auswahlmodus des Panels. Das Fenster **Export Persona** bietet zwei Formate:

- **Marinara Native**: behält alle Marinara-Persona-Details, Sprites und angehängten Lorebooks. Nimm dieses Format, um eine Persona zwischen zwei Marinara-Installationen umzuziehen.
- **Compatible JSON**: exportiert nur die einfachen Persona-Felder. Nimm dieses Format für andere Werkzeuge, die Marinaras Format nicht kennen.

Ein Sammelexport lädt eine einzelne ZIP-Datei herunter, mit je einer Datei pro ausgewählter Persona.

## Persona als Charakter hinzufügen

In der Kopfzeile des **Persona Editor** sitzt das Symbol **Add persona as character**. Es legt eine neue Charakterkarte in der Charakter-Bibliothek an. Die neue Karte übernimmt Name, Beschreibung, Persönlichkeit, Szenario, Vorgeschichte, Aussehen, Tags, Ersteller, Version und Avatar der Persona.

Praktisch ist das, wenn du eine frühere Persona lieber als Charakter spielen willst. Die ursprüngliche Persona bleibt unverändert und wird nicht gelöscht. Wie du Charaktere bearbeitest, steht unter [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md).

## Verwandte Anleitungen

- [Die Persona für einen Chat wählen](choosing-your-persona.md)
- [Charakterfarben und RPG-Werte](colors-and-stats.md)
- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Profile im Conversation Mode](../conversation/profiles.md)
- [Makros](../prompts/macros.md)
