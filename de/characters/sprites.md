# Charakter-Sprites (Gesichtsausdrücke und Ganzkörper)

In dieser Anleitung erfährst du, wie du Charakterbilder – sogenannte Sprites – hinzufügst und per KI generieren lässt. Außerdem geht es darum, den Hintergrund freizustellen und die Anzeige der Sprites auf dem Bildschirm zu steuern. Sprites funktionieren im Roleplay Mode und im Game Mode.

## Was Sprites sind

Ein Sprite ist ein stehendes Charakterbild: die Abbildung eines Charakters, die Marinara Engine über der Chat-Szene schweben lässt. Marinara kennt zwei Arten von Sprites:

- **Facial Expressions** (Gesichtsausdrücke): Porträtbilder für verschiedene Stimmungen, etwa fröhlich, traurig oder wütend.
- **Full-body** (Ganzkörper): Ganzkörperbilder für verschiedene Posen, etwa Ruhehaltung, Gehen oder Kampfstellung.

Auf dem Bildschirm erscheinen Sprites nur im **Roleplay Mode** und im **Game Mode**. Reine Conversation-Chats zeigen keine Sprites. Hochladen lassen sie sich trotzdem in jedem Modus, denn ein Charakter behält seine Sprites unabhängig davon, welcher Chat ihn verwendet.

Sprites werden pro Charakter gepflegt. Auch eine Persona – der Charakter, der dich selbst darstellt – kann Sprites bekommen. Der Persona-Editor enthält denselben **Sprites**-Tab, der unten beschrieben wird.

## Wo du den Sprites-Tab findest

Sprites verwaltest du im Charakter- bzw. Persona-Editor.

1. Öffne einen Charakter zum Bearbeiten.
2. Klick im Editor auf den Tab **Sprites**.
3. Wähle oben im Tab eine Kategorie: **Facial Expressions**, **Full-body** oder **Clips** (Videoclips).

Diese Anleitung behandelt die Kategorien **Facial Expressions** und **Full-body**. **Clips** ist eine eigene Funktion für Sprach- und Videoanrufe. Alles dazu steht unter [Sprach- und Videoanrufe in Conversation](../conversation/calls.md).

## Eigene Sprites hochladen

Hochladen lassen sich PNG-, JPEG-, GIF-, WebP- und AVIF-Bilder sowie passive SVG-Bilder. Am besten funktionieren transparente PNG-Dateien: Die leere Fläche rund um den Charakter bleibt über der Szene durchsichtig. Nicht unterstützte oder ungültige Ersatzbilder werden abgelehnt, ohne dass das gespeicherte Sprite verloren geht.

### Ein einzelnes Sprite hochladen

1. Öffne den Tab **Sprites** und wähle **Facial Expressions** oder **Full-body**.
2. Klick auf **Add sprites** (Sprites hinzufügen) und dann auf **Upload images** (Bilder hochladen). Du kannst mehrere Bilder auf einmal auswählen.
3. Jeder Dateiname wird zum vorläufigen Namen des Sprites. Umbenennen kannst du ein Sprite später, indem du es öffnest.

Die neuen Sprites erscheinen ohne Ordner im normalen Raster. Im Persona-Editor lädst du ein einzelnes Sprite weiterhin über das Namensfeld im Bereich **Add Sprite** (Sprite hinzufügen) und die Schaltfläche **Upload** hoch.

### Einen ganzen Ordner auf einmal hochladen

Liegen viele Sprites in einem Ordner, lassen sie sich in einem Schritt importieren.

1. Benenne die Bilddateien nach dem Gesichtsausdruck oder der Pose. Eine Datei `admiration.png` ergibt zum Beispiel den Gesichtsausdruck admiration.
2. Öffne **Add sprites** und klick auf **Import folder** (Ordner importieren). Im Persona-Editor klickst du im Bereich **Add Sprite** auf **Upload Folder** (Ordner hochladen).
3. Wähle den Ordner mit den Bildern aus.

Jeder Dateiname wird ohne Endung zum Sprite-Namen. Währenddessen meldet eine Fortschrittszeile „Uploading X/Y sprites“.

Unterordner werden zu optionalen Sprite-Ordnern. Eine exportierte `catalog.json` stellt außerdem die Ordnerzuordnung und bearbeitete Namen wieder her. Ungültige Ordnerangaben werden gemeldet, verwendbare Bilder aber trotzdem importiert. Schlägt ein Import ganz oder teilweise fehl, meldet Marinara den Fehler, statt einen Erfolg mit null Bildern anzuzeigen.

Mehrere Varianten desselben Gesichtsausdrucks entstehen über einen gemeinsamen Namensteil vor dem Unterstrich. `happy_01.png` und `happy_blush.png` gelten beide als Varianten von happy.

### Ein Sprite verwalten

Öffne ein Charakter-Sprite, um die Vorschau mit seinen Aktionen zu sehen. Bei Persona-Sprites bleiben die Aktionen auf der Kachel:

- **Frame** (Ausschnitt): das Bild so zuschneiden, dass der Charakter an der gewünschten Stelle sitzt.
- **Download**: die Sprite-Datei auf dem Computer speichern.
- **Replace** (Ersetzen): ein neues Bild unter demselben Namen hochladen.
- **Rename** (Umbenennen; in der Charakter-Vorschau): den Namen ändern, bis zu 160 Zeichen. Datei-Handle und URL bleiben erhalten, bestehende konkrete Bildverweise funktionieren also weiter.
- **Folder** (Ordner; in der Charakter-Vorschau) oder **Move sprite** (Sprite verschieben; auf der Persona-Kachel): einen Ordner oder **No folder** (kein Ordner) wählen, ohne zu ziehen.
- **Delete** (Löschen): dieses Sprite entfernen.

Vor dem Löschen erscheint eine Rückfrage. Im Persona-Editor entfernen **Delete All Expressions** oder **Delete All Full-Body** die ganze Kategorie, auch wenn gerade eine Suche aktiv ist.

### Optionale Ordner und Auswahl

Klick auf **New folder** (Neuer Ordner), um einen eingeklappten Ordner namens **unnamed** anzulegen. Mit Doppelklick oder Doppeltippen auf den Namen benennst du ihn um, über den Pfeil klappst du ihn auf. Gesichtsausdrücke und Ganzkörper-Sprites haben getrennte Ordner. Ordner stehen über den Sprites ohne Ordner und lassen sich durch Ziehen umsortieren.

Ziehe einzelne Sprites in auf- oder eingeklappte Ordner. Auf dem Smartphone hältst du eine Kachel gedrückt, um das Ziehen zu beginnen; normales Wischen scrollt weiterhin. Ziehst du ein einsortiertes Sprite in den Bereich ohne Ordner, wird es aus seinem Ordner genommen. Der hervorgehobene Bereich zeigt das Ziel. Die Steuerung **Folder** in der Vorschau und die Schaltfläche **Move sprite** auf der Persona-Kachel sind die Alternative für die Tastatur.

Klick auf **Select** (Auswählen), um Kontrollkästchen und **Select all sprites** (alle Sprites auswählen) einzublenden. Danach ziehst du die ausgewählten Sprites gemeinsam oder nutzt die verfügbaren Bereinigungs- und Löschwerkzeuge. **Cancel** (Abbrechen) beendet den Auswahlmodus. Die Suche filtert die sichtbaren Sprites; eine Suche ohne Treffer bedeutet nicht, dass die Sammlung leer ist.

Ordner sortieren Sprites nur. Sie legen nie einen aktiven Satz fest und verbergen keine Bilder vor Chats oder Agenten. Wird ein Ordner gelöscht, bleiben seine Sprites ohne Ordner erhalten.

### Character Sheet

Die kompakte Zeile **Character Sheet** im Charakter-Editor öffnest du über **Manage** (Verwalten). Dort erstellst oder lädst du ein Sheet hoch und aktivierst **Use as reference image** (als Referenzbild verwenden), wenn es für die Ähnlichkeit des Charakters bevorzugt werden soll. Referenzauswahl und Avatar-Rückfall funktionieren wie bisher.

## Sprites per KI generieren

Ist eine Bild-Verbindung eingerichtet, zeichnet Marinara die Sprites für dich. Eine Verbindung verknüpft Marinara mit einem KI-Dienst. Für Sprites brauchst du eine Bild-Verbindung, für animierte Sprites zusätzlich eine Video-Verbindung. Wie du eine einrichtest, steht unter [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Los geht es mit einem Klick auf **Generate Sprite** (Sprite generieren) im Bereich **Add Sprite**. Es öffnet sich das Fenster **Generate Sprites**. Oben wählst du die Quelle: **Expressions (Portrait)** oder **Full-body**.

Fülle das Fenster aus:

1. Wähle im Dropdown-Menü eine **Image Generation Connection** (Verbindung für die Bildgenerierung).
2. Füge bis zu vier **Reference Images** (Referenzbilder) hinzu, wenn das Ergebnis einem bestimmten Look folgen soll. Ein Kontrollkästchen nutzt außerdem den aktuellen Avatar als Referenz.
3. Beschreibe im Feld **Appearance Description** (Aussehen), wie der Charakter aussieht. Diese Angabe ist Pflicht.
4. Optional aktivierst du **Transparent sprite background** (transparenter Sprite-Hintergrund). Marinara fordert zuerst echte PNG-Transparenz an. Liefert der Anbieter keinen Alphakanal, wählt Marinara eine kräftige grüne, magentafarbene oder cyanfarbene Hintergrundfläche – und zwar die, die sich am wenigsten mit den Farben aus der **Appearance Description** überschneidet. Diese Fläche entfernt Marinara anschließend automatisch.
5. Lege über **Expression Count** (Anzahl der Gesichtsausdrücke) fest, wie viele Bilder entstehen sollen – bei Ganzkörperbildern über **Pose Count**. Wähle danach aus, welche Gesichtsausdrücke oder Posen belegt werden.
6. Klick auf die Schaltfläche **Generate**.

Sind die Bilder fertig, prüfst du sie. Jedes Bild lässt sich vor dem Speichern ein- oder ausschalten, umbenennen und zuschneiden. Passt alles, speicherst du die ausgewählten Bilder in die Sprite-Sammlung des Charakters.

Hat genau ein gespeichertes Sprite dieser Kategorie den generierten Namen, ersetzt das Speichern sein Bild und behält Ordner und Handle bei. Ein Sprite, das von diesem Namen weg umbenannt wurde, bleibt unangetastet. Kommt derselbe Name in verschiedenen Ordnern mehrfach vor, wähl das zu ersetzende Sprite ausdrücklich, damit zuverlässig das richtige getroffen wird.

Hat der Charakter bereits Porträt-Gesichtsausdrücke, steht bei der Quelle **Full-body** das Kontrollkästchen **Match existing expression sprites** zur Verfügung. Damit entstehen Ganzkörperposen passend zu jedem vorhandenen Namen eines Gesichtsausdrucks.

Zwei Hinweise zur KI-Generierung:

- Die Generierung dauert unter Umständen einige Minuten, auch wenn der Text in der App kürzere Zeiten nahelegt. Langsame KI-Dienste brauchen länger. Warte lieber ab, statt neu zu starten.
- Auf manchen Geräten – etwa bestimmten Android-Installationen – stehen die KI-Sprite-Generierung und die Hintergrundbereinigung nicht zur Verfügung. Dann ist die Schaltfläche deaktiviert und Marinara nennt den Grund auf dem Bildschirm.

### Animierte Porträt-Sprites

Bei der Quelle **Expressions (Portrait)** gibt es das Kontrollkästchen **Generate animated portraits**. Aktiviert entstehen kurze bewegte Clips statt Standbildern, aus denen Marinara jeweils ein GIF-Sprite in Endlosschleife macht. Ein GIF ist eine Bilddatei, die eine kurze Animation abspielt. Animierte Porträts nutzen eine Video-Verbindung statt einer Bild-Verbindung.

## Sprite-Hintergründe bereinigen

Am besten wirkt ein Sprite, wenn nur der Charakter zu sehen und der Hintergrund durchsichtig ist. Generierte Standbild-Sprites nutzen echte Transparenz, sofern der Anbieter sie unterstützt. Andernfalls entfernt Marinara eine einfarbige, adaptiv gewählte Chroma-Fläche mit weicher Kante und rechnet deren Farbe aus Haaren, Stoffen und anderen halbtransparenten Pixeln heraus. Ältere Sprites mit weißem Hintergrund funktionieren weiterhin.

### Ein Sprite von Hand bereinigen

Öffne die Vorschau eines Charakter-Sprites und dort die Bereinigung mit dem Zauberstab, oder klick auf das Bild eines Persona-Sprites, um den Bereinigungs-Editor zu öffnen. Dort radierst du den Hintergrund weg, malst Bereiche wieder zurück und prüfst das Ergebnis vor dunklem, hellem und kariertem Untergrund. Schritte lassen sich rückgängig machen, das Original wiederherstellen und die Änderungen zum Schluss übernehmen.

### Viele Sprites auf einmal bereinigen

Im Charakter-Editor klickst du auf **Select**, wählst Sprites aus und klickst auf **Clean Backgrounds** (Hintergründe bereinigen). Im Persona-Editor gilt die Bereinigungsschaltfläche für die ausgewählten Sprites oder, wenn nichts ausgewählt ist, für die sichtbare Kategorie.

1. Stell den Regler **Cleanup strength** (Bereinigungsstärke) ein. Er reicht von Soft bis Aggressive, also von 0 bis 100, und steht anfangs auf 35. Ein höherer Wert entfernt mehr Hintergrund, greift dafür aber schneller den Charakter an.
2. Klick auf **Clean Backgrounds** und bestätige.

Nach einer Sammelbereinigung legt Marinara eine Kopie zur Sicherheit an. Eine Zeile meldet „Last cleanup has a restore point“, daneben steht die Schaltfläche **Undo Cleanup**. Ein Klick darauf versetzt alle betroffenen Sprites in den vorherigen Zustand zurück.

Die Hintergrundbereinigung funktioniert bei PNG-, JPG-, JPEG-, WEBP- und AVIF-Bildern. Bei GIF- oder SVG-Dateien funktioniert sie nicht.

Die automatische Bereinigung analysiert das Bild, bevor sie ein Verfahren wählt. Zuerst greift die schnelle eingebaute Matte-Bereinigung für einfarbige Chroma-Flächen und alte weiße Hintergründe. Ist der Rand nicht wirklich einheitlich, kann Marinara ersatzweise auf die optionale KI-Hintergrundentfernung ausweichen, sofern sie installiert ist. Bei einer unruhigen Szene oder einem Motiv, dessen Farben dem Hintergrund stark ähneln, bleibt der manuelle Bereinigungs-Editor die sicherste Wahl.

## Sprites exportieren

Die Sprites eines Charakters lassen sich als ZIP-Datei auf dem Computer speichern. Eine ZIP-Datei fasst viele Dateien zu einer einzigen zusammen.

1. Öffne den Tab **Sprites**.
2. Klick über dem Raster des Charakters auf **Export** oder im Bereich **Add Sprite** der Persona.
3. Wähle **Expressions only** oder **Full-body only** für die aktuelle Kategorie oder **All sprites** für alles zusammen.

Der Download enthält die Sprite-Bilddateien und eine `catalog.json` mit Namen und Ordnerstruktur. Unterstützte native Übertragungen von Charakteren und Personas sowie Profil-Backups behalten diese Metadaten ebenfalls.

### Ordnerfähige Integrationen

`GET /api/sprites/:ownerId` liefert weiterhin jedes Sprite, ob einem Ordner zugeordnet oder nicht. `GET /api/sprites/:ownerId/catalog` ergänzt Ordner und Zuordnung für Integrationen, die Ordner einzeln erkennen oder importieren wollen. Jedes Sprite enthält sein stabiles Handle `expression`, das bearbeitbare `label`, `folderId` und die URL. Für die Zuordnung zählen die Ordner-IDs; das Array `folders` ist die gespeicherte Reihenfolge, die der Editor umgekehrt anzeigt, damit neue Ordner oben stehen. Die Ordnerreihenfolge legt weder Priorität noch Verfügbarkeit für Agenten fest.

Der Asset-Browser im Chat zeigt bearbeitete Namen an, fügt aber konkrete Links `card://sprites/<ownerId>/<filename>` ein, die auch nach einer Umbenennung funktionieren. Chatbezogene Links wie `card://sprites/facial/joy.png` können ebenfalls den bearbeiteten Namen auflösen; ein vorhandener passender Dateiname hat Vorrang.

Fehlen optionale Metadaten oder sind sie unlesbar, bleiben verwendbare Bilder trotzdem sichtbar. Bearbeitungen verweigern beschädigte Metadaten, statt sie stillschweigend zu ersetzen. Reine Leselisten überspringen nicht zugängliche Sammlungen; Export- und Schreibvorgänge verweigern weiterhin verlinkte Besitzer-Ordner.

## Wie Sprites im Chat erscheinen

Mit dem Hochladen ist erst die Hälfte getan. Wann und wie die Sprites während eines Chats auftauchen, legst du getrennt fest – in den Chat-Einstellungen, nicht im Charakter-Editor.

### Roleplay Mode

Im **Roleplay Mode** steuert der optionale Agent **Expression Engine** die Anzeige der Sprites. Lade ihn über **Agents → Agent Organizer (Agentenverwaltung)** herunter und füge ihn dem Chat hinzu. Er erkennt die Stimmung jeder Nachricht und wählt das passende Gesichtsausdruck-Sprite. Details stehen in der [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md).

Damit Sprites in einem Roleplay-Chat erscheinen, müssen alle folgenden Punkte zutreffen:

- Der Agent **Expression Engine** ist für den Chat aktiviert.
- Mindestens ein Charakter oder die aktive Persona ist als Sprite-Besitzer ausgewählt.
- Mindestens eine Sprite-Quelle ist eingeschaltet.

Öffne die **Chat Settings** (Chat-Einstellungen) und such die Agent-Karte **Expression Engine**. Dort steuerst du die Darstellung:

- **Sprite Source** (Sprite-Quelle): Wähle **Expressions**, **Full-body** oder beides. Standardmäßig sind beide aktiv. Mindestens eine muss aktiv bleiben.
- **Expression Avatars**: ersetzt den kleinen Avatar an der Nachricht durch das passende Gesichtsausdruck-Sprite, statt ein schwebendes Overlay einzublenden. Standardmäßig aus und nur im Roleplay Mode verfügbar.

### Game Mode

Im **Game Mode** erscheint automatisch ein Ganzkörper-Sprite für den Charakter, der gerade spricht oder kämpft. Den Agenten Expression Engine brauchst du dafür nicht. Nötig sind allein hochgeladene Ganzkörper-Sprites für diesen Charakter. Die gesamte Einrichtung des Game Mode beschreibt [Game Mode: Erste Schritte](../game/getting-started.md).

### Sprites verschieben und skalieren (Arrange-Modus)

Sobald ein Sprite-Besitzer aktiviert ist, zeigt die Agent-Karte **Expression Engine** den Abschnitt **Sprite Layout** (Sprite-Anordnung).

- Klick auf **Arrange** (Anordnen), um in den Ziehmodus zu wechseln, und schieb jedes Sprite an die gewünschte Stelle. Zum Abschluss klick auf **Done**.
- **Reset** verwirft die eigenen Positionen und stellt die automatische Anordnung wieder her.
- **Default Side** legt fest, ob neue Sprites nach **Left** oder nach **Right** tendieren. Standard ist Left. Ein Wechsel der Seite spiegelt die aktuelle Anordnung.
- Vier Regler bestimmen Größe und Durchsichtigkeit: **Expression Size** und **Full-body Size** reichen von 5 % bis 200 %, **Expression Opacity** und **Full-body Opacity** von 15 % bis 100 %. Alle stehen anfangs auf 100 %.

## Clips für Videoanrufe

Die Kategorie **Clips** im Tab **Sprites** ist eine eigene Funktion. Damit entstehen kurze Videos in Endlosschleife, die während eines Sprach- oder Videoanrufs im Conversation Mode als Kamerabild des Charakters dienen. Da sie zur Anruffunktion gehört, ist sie getrennt dokumentiert: [Sprach- und Videoanrufe in Conversation](../conversation/calls.md).

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Sprach- und Videoanrufe in Conversation](../conversation/calls.md)
- [Animierte Gesichtsausdrücke](../media/animated-expressions.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
