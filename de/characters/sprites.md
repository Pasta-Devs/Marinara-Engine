# Charakter-Sprites (Gesichtsausdrücke und Ganzkörper)

Ein Sprite ist ein Bild deines Charakters für eine Stimmung, etwa fröhlich oder traurig. Marinara lässt es über der Chat-Szene schweben. Du kannst eigene Sprites hochladen, sie per KI generieren, ihre Hintergründe bereinigen und steuern, wie sie erscheinen.

Bevor du anfängst: Benenne jede Datei nach der Stimmung, etwa `happy.png`, damit Marinara sie auswählen kann. In einem Roleplay-Chat brauchen Sprites außerdem den eingeschalteten Agenten **Expression Engine** (ein Helfer, der das Sprite auswählt). Siehe [Wie Sprites im Chat erscheinen](#how-sprites-show-up-in-your-chat).

Es gibt zwei Arten von Sprites:

- **Facial Expressions** (Gesichtsausdrücke) sind Porträtbilder für Stimmungen wie fröhlich, traurig oder wütend.
- **Full-body** (Ganzkörper) sind Ganzkörperbilder für Posen wie Ruhehaltung, Gehen oder Kampfstellung.

Auf dem Bildschirm erscheinen Sprites im Roleplay Mode und im Game Mode, nicht in Conversation-Chats. Hochladen kannst du sie in jedem Modus, denn ein Charakter behält seine Sprites in jedem Chat. Eine Persona hat denselben Bereich **Sprites**.

## Die Sprites finden

1. Öffne einen Charakter (oder eine Persona) in seinem Editor.
2. Klick auf den Tab **Images** (Bilder) und dann oben auf **Sprites**.
3. Wähl oben eine Kategorie: **Facial Expressions**, **Full-body** oder **Clips** (Videoclips).

Die Abschnitte unten behandeln **Facial Expressions** und **Full-body**. **Clips** gehört zur Anruffunktion. Siehe [Audio- und Videoanrufe in Conversation](../conversation/calls.md).

<a id="upload-your-own-sprites"></a>

## Eigene Sprites hochladen

Du kannst PNG-, JPEG-, GIF-, WebP-, AVIF- und SVG-Bilder hochladen. Transparente PNG-Dateien sehen am besten aus, weil die leere Fläche rund um den Charakter durchsichtig bleibt. Ein ungültiges Ersatzbild wird abgelehnt, und das gespeicherte Sprite bleibt erhalten.

### Ein oder mehrere Sprites hochladen

1. Öffne **Images → Sprites** und wähl **Facial Expressions** oder **Full-body**.
2. Klick auf **Add sprites** (Sprites hinzufügen).
3. Klick auf **Upload images** (Bilder hochladen), öffne deinen Ordner und wähl die Bilder darin aus. Du kannst mehrere auf einmal auswählen.
4. Klick im Dialogfenster **Import images** (Bilder importieren) auf **Import** (Importieren). Mit **Cancel** (Abbrechen) wird nichts hinzugefügt.

Jeder Dateiname wird zum Namen des Sprites (seiner Bezeichnung). Umbenennen kannst du ein Sprite später, indem du es öffnest. Die neuen Sprites erscheinen im Raster, außerhalb aller Ordner. Unterordner werden nicht durchsucht. Mit **New folder** (Neuer Ordner) sortierst du die importierten Sprites in Ordner.

Im Persona-Editor nutzt du für ein einzelnes Sprite das Namensfeld unter **Add Sprite** (Sprite hinzufügen) und die Schaltfläche **Upload** (Hochladen).

### Einen ganzen Ordner hochladen

Einen ganzen Ordner hochladen kannst du im Persona-Editor. Für Charaktere nutzt du oben **Upload images** und wählst die Bilder in deinem Ordner aus.

1. Öffne den Tab **Images** der Persona und klick auf **Sprites**.
2. Klick im Bereich **Add Sprite** auf **Upload Folder** (Ordner hochladen).
3. Wähl den Ordner mit deinen Bildern aus.

Jeder Dateiname wird ohne Endung zum Sprite-Namen. Eine Fortschrittszeile meldet „Uploading X/Y sprites“. Unterordner werden zu optionalen Sprite-Ordnern. Eine `catalog.json` aus einem Export stellt außerdem Ordner und bearbeitete Namen wieder her. Ein fehlerhafter Ordnereintrag wird gemeldet, während verwendbare Bilder trotzdem importiert werden.

Wenn es nicht funktioniert hat: Ein fehlgeschlagener oder unvollständiger Import meldet den Fehler, statt einen Erfolg mit null Bildern anzuzeigen. Prüf die Dateitypen oben.

### Namensvarianten

| Dateiname | Bedeutung |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Zwei Bilder für happy. Beginne beide Namen mit `happy_`. |
| `happy_pajamas.png` | Happy, im Pyjama. Setz die Stimmung an den Anfang, dann das Outfit. |
| `angry_formalwear_soaked_01.png` | Angry, in formeller Kleidung, durchnässt. Eine Zahl am Ende markiert nur eine weitere Version desselben Bildes. |

Die Expression Engine sieht sowohl den Gesichtsausdruck (`happy`) als auch den vollständigen Namen (`happy_pajamas`). Passt kein Sprite zu allen Wörtern, fällt zuerst das letzte Wort weg. Fehlt also ein Sprite `happy_pajamas_wounded`, wird `happy_pajamas` verwendet und danach irgendein Sprite für happy.

<a id="how-sprites-show-up-in-your-chat"></a>

## Wie Sprites im Chat erscheinen

Wann und wie Sprites erscheinen, legst du in den Einstellungen des Chats fest, nicht im Charakter-Editor.

### Roleplay Mode

Im Roleplay steuert der Agent Expression Engine die Sprites. Ein Agent ist ein Helfer, der neben den Antworten mitläuft. Siehe [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md). Die Expression Engine erkennt die Stimmung jeder Nachricht und wählt ein passendes Gesichtsausdruck-Sprite. Füg den Agenten dem Chat hinzu und installier ihn über **Agent Organizer** (Agentenverwaltung), falls du ihn noch nicht hast. Siehe [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md#expression-engine).

Damit Sprites erscheinen, muss alles Folgende zutreffen:

- Der Agent Expression Engine ist für den Chat eingeschaltet.
- Mindestens ein Charakter oder die Persona ist als Sprite-Besitzer ausgewählt.
- Mindestens eine Sprite-Quelle ist eingeschaltet.

Öffne **Chat Settings → Agents** (Chat-Einstellungen → Agenten) und such die Karte **Expression Engine**:

- **Sprite Source** (Sprite-Quelle) ist **Expressions**, **Full-body** oder beides. Standardmäßig sind beide an, und mindestens eine muss an bleiben.
- **Expression Avatars** ersetzt den kleinen Avatar an der Nachricht durch das passende Gesichtsausdruck-Sprite. Standardmäßig aus und nur im Roleplay verfügbar.
- **Only show active sprites** (nur aktive Sprites anzeigen) zeigt nur die Charaktere aus dem zuletzt fertiggestellten Ergebnis und lässt die aktuellen Sprites sichtbar, während das nächste Ergebnis entsteht.

### Game Mode

Im Game Mode erscheint automatisch ein Ganzkörper-Sprite für den Charakter, der gerade spricht oder kämpft. Die Expression Engine brauchst du dafür nicht, nur Ganzkörper-Sprites für diesen Charakter. Siehe [Game Mode: Erste Schritte](../game/getting-started.md).

### Sprites verschieben und skalieren

Sobald ein Sprite-Besitzer eingeschaltet ist, zeigt die Karte **Expression Engine** den Bereich **Sprite Layout** (Sprite-Anordnung).

1. Klick auf **Arrange** (Anordnen) und zieh dann jedes Sprite an die gewünschte Stelle.
2. Klick auf **Done** (Fertig).

**Reset** (Zurücksetzen) verwirft deine Positionen und kehrt zur automatischen Anordnung zurück. **Default Side** ist **Left** oder **Right** und steht anfangs auf Left. Ein Wechsel spiegelt deine aktuelle Anordnung. Mit **Apply to** legst du die Anordnung für alle Charaktere oder für einen einzelnen fest.

Vier Regler bestimmen Größe und Durchsichtigkeit. **Expression Size** und **Full-body Size** reichen von 5 % bis 200 %. **Expression Opacity** und **Full-body Opacity** reichen von 0 % bis 100 %. Größe und Deckkraft stehen anfangs auf 100 %.

## Sprites per KI generieren

Bevor du anfängst: Füg eine Verbindung zur Bildgenerierung hinzu. Für animierte Sprites brauchst du außerdem eine Videoverbindung. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Öffne **Add sprites** und klick auf **Generate Sprite** (Sprite generieren). Im Persona-Editor liegt die Schaltfläche unter **Add Sprite**. Das Fenster **Generate Sprites** öffnet sich.
2. Wähl oben eine Quelle: **Expressions (Portrait)** oder **Full-body**.
3. Wähl eine **Image Generation Connection** (Verbindung zur Bildgenerierung).
4. Füg optional bis zu vier **Referenzbilder** hinzu, oder kreuz ein Kästchen an, um den aktuellen Avatar oder den Charakterbogen als Referenz zu verwenden. Hat der Charakter bereits Sprites, ist **Gespeichertes Sprite als Referenzbild verwenden** eingeschaltet: Ein Gesicht mit ruhendem Ausdruck (neutral, falls vorhanden) wird mit der Anfrage gesendet, damit die neuen Sprites zu den vorhandenen passen.
5. Schreib eine **Appearance Description** (Aussehensbeschreibung). Sie ist Pflicht.
6. Schalte optional **Transparenter Sprite-Hintergrund** ein. Marinara macht den Hintergrund durchsichtig. Ein Modell, das transparente Bilder erzeugt, wird um eines gebeten; seine Kanten bleiben genau wie gezeichnet erhalten. Jedes andere Modell zeichnet einen einfarbigen grünen, magentafarbenen oder cyanfarbenen Hintergrund, der sich von den Farben deiner **Aussehensbeschreibung** abhebt, und Marinara entfernt ihn. Die Zeile unter dem Kästchen zeigt, welcher Fall zutrifft. Welche Modelle transparente Bilder erzeugen, legst du an der Verbindung fest: siehe [Transparente Hintergründe](../media/image-providers.md#transparent-backgrounds).
7. Leg **Expression Count** (bei Ganzkörperbildern **Pose Count**) fest und wähl aus, welche Gesichtsausdrücke oder Posen entstehen sollen.
8. Optional für Gesichtsausdrücke: Hak **Gesichter markieren, die nicht zum Ausdruck passen** an. Ein [Decision-Modell, das Bilder liest](../connections/decision-models.md#features-that-look-at-pictures), sieht sich jedes gezeichnete Gesicht an und markiert diejenigen, die ihren Ausdruck möglicherweise nicht zeigen, mit **Prüfen**. So kannst du sie abwählen oder neu zeichnen lassen. Jedes Gesicht braucht einen Moment. Ohne ein solches Modell ist das Kästchen ausgegraut.
9. Klick auf **Generate** (Generieren).

Sind die Bilder da, schaltest du jedes ein oder aus, benennst es um und schneidest es zu. Danach speicherst du die ausgewählten Bilder in die Sprites des Charakters. Hat genau ein gespeichertes Sprite dieser Kategorie den generierten Namen, ersetzt das Speichern sein Bild und behält seinen Ordner und sein Handle. Ein Sprite, das du von diesem Namen weg umbenannt hast, bleibt erhalten. Kommt derselbe Name in verschiedenen Ordnern mehrfach vor, ersetz das gemeinte Sprite von Hand.

Hat der Charakter bereits Porträt-Gesichtsausdrücke, kreuz bei der Quelle **Full-body** das Kästchen **Match existing expression sprites** an, um Ganzkörperposen passend zu jedem Namen eines Gesichtsausdrucks zu erstellen.

Die Generierung kann einige Minuten dauern, bei langsamen Diensten länger. Warte lieber ab, statt neu zu starten. Auf manchen Geräten, etwa bestimmten Android-Installationen, stehen die KI-Sprite-Generierung und die Hintergrundbereinigung nicht zur Verfügung. Die Schaltfläche ist dann deaktiviert, und Marinara nennt den Grund.

### Animierte Porträts

Bei der Quelle **Expressions (Portrait)** erstellt **Generate animated portraits** (animierte Porträts generieren) kurze bewegte Clips und macht aus jedem ein GIF-Sprite in Endlosschleife. Ein GIF ist eine Bilddatei, die eine kurze Animation abspielt. Dafür wird eine Videoverbindung statt einer Bildverbindung genutzt. Siehe [Animierte Gesichtsausdrücke](../media/animated-expressions.md).

## Sprite-Hintergründe bereinigen

Ein Sprite sieht am besten aus, wenn nur der Charakter zu sehen ist. Generierte Sprites nutzen echte Transparenz, wenn das Modell sie unterstützt. Andernfalls entfernt Marinara eine einfarbige, adaptiv gewählte Hintergrundfarbe mit weicher Kante und rechnet diese Farbe aus Haaren, Stoffen und anderen teilweise durchsichtigen Pixeln heraus. Ältere Sprites mit weißem Hintergrund funktionieren weiterhin.

Ein Bild mit bereits transparentem Hintergrund wird nie erneut bereinigt: Eine Hintergrundentfernung würde nur die sauberen Kanten aufweichen. Liefert ein Modell, das transparente Bilder erzeugt, dennoch eines mit undurchsichtigem Hintergrund, lässt Marinara es unverändert und weist bei der Prüfung darauf hin. Klick auf **Bereinigung anwenden**, um diesen Hintergrund zu entfernen, oder behalte die Bilder, wie sie sind.

### Ein Sprite von Hand bereinigen

Öffne die Vorschau eines Charakter-Sprites und nutz dort die Bereinigung mit dem Zauberstab, oder klick auf das Bild eines Persona-Sprites. Im Bereinigungs-Editor radierst du den Hintergrund weg, malst Bereiche wieder zurück und prüfst das Ergebnis vor dunklem, hellem und kariertem Untergrund. Du kannst Schritte rückgängig machen, auf das Original zurücksetzen und die Änderungen zum Schluss übernehmen.

### Viele Sprites auf einmal bereinigen

1. Klick im Charakter-Editor auf **Select** (Auswählen) und wähl Sprites aus. Im Persona-Editor gilt die Bereinigungsschaltfläche für die ausgewählten Sprites oder, wenn keine ausgewählt sind, für die sichtbare Kategorie.
2. Klick auf **Clean Backgrounds** (Hintergründe bereinigen).
3. Stell den Regler **Cleanup strength** (Bereinigungsstärke) ein, von **Soft** bis **Aggressive**, also von 0 bis 100. Er steht anfangs auf 35. Ein höherer Wert entfernt mehr Hintergrund, kann aber in den Charakter hineinschneiden.
4. Bestätige.

Marinara legt eine Sicherheitskopie an. Eine Zeile meldet „Last cleanup has a restore point“, dazu die Schaltfläche **Undo Cleanup** (Bereinigung rückgängig machen). Ein Klick darauf setzt alle betroffenen Sprites zurück.

Die Bereinigung funktioniert bei PNG, JPG, JPEG, WEBP und AVIF. Bei GIF oder SVG funktioniert sie nicht.

Die automatische Bereinigung analysiert zuerst das Bild. Die schnelle eingebaute Bereinigung übernimmt einfarbige Flächen und alte weiße Hintergründe. Ist der Rand nicht einheitlich, kann Marinara auf die optionale KI-Hintergrundentfernung ausweichen, sofern sie installiert ist. Bei einer unruhigen Szene oder einem Motiv, dessen Farben dem Hintergrund ähneln, ist der manuelle Editor die sicherste Wahl.

## Sprites verwalten

Öffne ein Charakter-Sprite, um es in der Vorschau zu sehen und seine Aktionen aufzurufen. Bei Persona-Sprites bleiben die Aktionen auf der Kachel.

- **Frame** (Ausschnitt) schneidet das Bild so zu, dass der Charakter an der gewünschten Stelle sitzt.
- **Download** speichert die Sprite-Datei.
- **Replace** (Ersetzen) lädt ein neues Bild unter demselben Namen hoch.
- **Rename** (Umbenennen; in der Charakter-Vorschau) ändert die Bezeichnung, bis zu 160 Zeichen, und behält Datei-Handle und URL, damit bestehende Bildverweise weiter funktionieren.
- **Folder** (Ordner; in der Charakter-Vorschau) oder **Move sprite** (Sprite verschieben; auf der Persona-Kachel) wählt einen Ordner oder **No folder** (kein Ordner), ohne zu ziehen.
- **Delete** (Löschen) entfernt dieses Sprite nach einer Rückfrage. Im Persona-Editor entfernt **Delete All** mit dem Kategorienamen die ganze Kategorie, auch während eine Suche aktiv ist.

### Ordner und Auswahl

Klick auf **New folder**, um einen eingeklappten Ordner namens **unnamed** anzulegen. Mit Doppelklick oder Doppeltippen auf den Namen benennst du ihn um, über den Pfeil klappst du ihn auf. Gesichtsausdrücke und Ganzkörper-Sprites haben getrennte Ordner. Ordner stehen über den Sprites ohne Ordner und lassen sich durch Ziehen umsortieren.

Zieh Sprites in einen Ordner, oder zieh ein einsortiertes Sprite in den Bereich ohne Ordner, um es aus seinem Ordner zu nehmen. Auf dem Smartphone hältst du eine Kachel gedrückt, um das Ziehen zu beginnen. Normales Wischen scrollt weiterhin. Ordner dienen nur der Ordnung: Sie legen nie einen aktiven Satz fest und verbergen keine Bilder vor Chats oder Agenten. Wird ein Ordner gelöscht, bleiben seine Sprites ohne Ordner erhalten.

Klick auf **Select**, um Kontrollkästchen und **Select all sprites** (alle Sprites auswählen) einzublenden. Danach ziehst du die ausgewählten Sprites gemeinsam oder nutzt Bereinigen und Löschen. **Cancel** beendet den Auswahlmodus. Die Suche filtert die sichtbaren Sprites. Eine Suche ohne Treffer bedeutet nicht, dass die Sammlung leer ist.

<a id="character-sheet"></a>

### Character Sheet

Das **Character Sheet** (Charakterbogen) findest du im Tab **Images** oben über den Sprites. Klick auf **Manage** (Verwalten), um es zu öffnen. Dort erstellst oder lädst du ein Sheet hoch. Schalte **Use as reference image** (als Referenzbild verwenden) ein, damit es für die Ähnlichkeit des Charakters bevorzugt wird.

## Sprites exportieren

1. Öffne **Images → Sprites**.
2. Klick über dem Raster des Charakters auf **Export** oder im Bereich **Add Sprite** der Persona.
3. Wähl **Expressions only** oder **Full-body only**, um die aktuelle Kategorie zu exportieren, oder **All sprites** für alles.

Du bekommst ein ZIP-Archiv mit den Sprite-Dateien und einer `catalog.json` für Namen und Ordner. Native Exporte von Charakteren und Personas sowie Profil-Backups behalten diese Daten ebenfalls.

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Audio- und Videoanrufe in Conversation](../conversation/calls.md)
- [Animierte Gesichtsausdrücke](../media/animated-expressions.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)

## Referenz für Entwickler: Sprite-API und Links

`GET /api/sprites/:ownerId` liefert jedes Sprite, ob einem Ordner zugeordnet oder nicht. `GET /api/sprites/:ownerId/catalog` ergänzt Ordner und Zuordnung, für Tools, die einen Ordner nach dem anderen importieren. Jedes Sprite hat ein stabiles Handle `expression`, ein bearbeitbares `label`, eine `folderId` und eine URL. Für die Zuordnung zählen die Ordner-IDs. Das Array `folders` ist die gespeicherte Reihenfolge, die der Editor umgekehrt anzeigt, damit neue Ordner zuerst erscheinen. Die Ordnerreihenfolge legt weder Priorität noch Verfügbarkeit für Agenten fest.

Der Asset-Browser im Chat zeigt bearbeitete Namen an, fügt aber konkrete Links `card://sprites/<ownerId>/<filename>` ein, die auch nach einer Umbenennung funktionieren. Chatbezogene Links wie `card://sprites/facial/joy.png` können ebenfalls den bearbeiteten Namen auflösen. Ein vorhandener passender Dateiname hat Vorrang.

Fehlen optionale Metadaten oder sind sie unlesbar, bleiben verwendbare Bilder trotzdem sichtbar. Bearbeitungen verweigern beschädigte Metadaten, statt sie zu ersetzen. Reine Leselisten überspringen nicht zugängliche Sammlungen, und Export- und Schreibvorgänge verweigern verlinkte Besitzer-Ordner.
