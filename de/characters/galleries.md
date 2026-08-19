# Galerien für Charaktere und Personas

In dieser Anleitung geht es um den Tab **Gallery** (Galerie) in den Editoren für Charaktere und Personas. Du erfährst, wie du Bilder und Videos hinterlegst, die dauerhaft an einem Charakter oder einer Persona hängen. Außerdem zeigt sie, wie du ein Galerie-Bild als eigenes Emoji oder als Sticker markierst.

## Der Gallery-Tab

Jeder Charakter und jede Persona hat einen eigenen Tab **Gallery**. Öffne einen Charakter im **Character Editor** (Charakter-Editor) oder eine Persona im **Persona Editor** (Persona-Editor) und klick dann auf den Tab **Gallery** (Kamerasymbol).

Die Galerie besteht aus zwei Unter-Tabs:

- **Images** (Bilder): Bilder, die du für diesen Charakter oder diese Persona hochlädst.
- **Videos**: hochgeladene Videos, dazu Szenenvideos und Mitschnitte von Videoanrufen mit diesem Charakter.

Bei einem Charakter heißt die Galerie **Character Gallery**, bei einer Persona **Persona Gallery**. Beide funktionieren identisch.

## Unterschied zur Galerie eines Chats

Bilder aus der Galerie gehören zum Charakter oder zur Persona, nicht zu einem einzelnen Chat. Löschst du einen Chat, bleiben sie erhalten. Nutze die Galerie deshalb für Referenzbögen, Outfit-Varianten oder importierte Bildpakete zu einem Charakter.

Die Galerie eines Chats ist etwas anderes. Dort landen Illustrationen zu einzelnen Szenen und generierte Anhänge aus den Nachrichten genau dieses Chats. Kurzlebige Szenenbilder gehören in die Chat-Galerie, dauerhafte Charakterbilder in die Galerie des Charakters oder der Persona.

## Bilder hinzufügen

1. Öffne den Editor für den Charakter oder die Persona.
2. Klick auf den Tab **Gallery**.
3. Achte darauf, dass der Unter-Tab **Images** ausgewählt ist.
4. Zieh die Bilddateien auf das Feld **Upload Character Images** (Charakterbilder hochladen) oder klick darauf, um Dateien auszuwählen. Bei einer Persona heißt das Feld **Upload Persona Images**.
5. Warte, bis der Upload abgeschlossen ist. Die neuen Bilder erscheinen anschließend im Raster darunter.

Gängige Bildformate wie JPG, PNG, GIF, WebP und AVIF werden unterstützt. Ein Klick auf ein Bild öffnet es in groß. Jede Bildkachel hat außerdem eine Schaltfläche zum Herunterladen und eine zum Löschen.

## Videos hinzufügen

1. Klick auf den Tab **Gallery**.
2. Wähle den Unter-Tab **Videos**.
3. Zieh die Videodateien auf das Feld **Upload Character Videos** (Charaktervideos hochladen) oder klick darauf, um Dateien auszuwählen. Bei einer Persona heißt das Feld **Upload Persona Videos**.
4. Warte, bis der Upload abgeschlossen ist.

Unterstützt werden MP4, WebM und MOV. Der Unter-Tab **Videos** listet zusätzlich alle Szenenvideos auf, die in Chats mit diesem Charakter entstanden sind, sowie Mitschnitte von Videoanrufen. Das Neueste steht jeweils oben.

## Ein Galerie-Bild als eigenes Emoji oder Sticker markieren

Aus einem Galerie-Bild lässt sich ein eigenes Emoji oder ein Sticker für den **Conversation Mode** machen – den Chat-Modus im Messenger-Stil. Ein eigenes Emoji ist ein kleines Bild mitten im Text, geschrieben als `:name:`. Ein Sticker ist ein größeres Bild als eigener Block, geschrieben als `sticker:name:`. Beides funktioniert ausschließlich in Chats im Conversation Mode.

So markierst du ein Bild:

1. Öffne den Tab **Gallery** und wähle den Unter-Tab **Images**.
2. Such das gewünschte Bild. Oben links sitzt eine kleine Schaltfläche mit dem Tooltip **Tag as emoji or sticker** (Kurzhinweis beim Draufzeigen).
3. Klick auf diese Schaltfläche. Es öffnet sich ein Menü mit **Make emoji** und **Make sticker**.
4. Klick auf **Make emoji** oder **Make sticker**.
5. Gib im Fenster **Custom Emoji** bzw. **Custom Sticker** einen Namen ein und bestätige.

Erlaubt sind Kleinbuchstaben, Ziffern und Unterstriche, maximal 32 Zeichen. Alles andere wandelt Marinara automatisch um. Aus „Big Grin“ wird zum Beispiel `big_grin`.

Wie groß das Bild sein darf, hängt von der gewählten Art ab, nicht von der Galerie. Ein Emoji-Bild darf höchstens 256 mal 256 Pixel messen, ein Sticker-Bild höchstens 512 mal 512 Pixel. Ist das Bild zu groß, erscheint eine Fehlermeldung und die Markierung greift nicht.

### Ein markiertes Bild verwalten

Sobald ein Bild markiert ist, zeigt die eingeblendete Schaltfläche den vergebenen Namen. Ein Klick darauf öffnet ein Menü mit weiteren Optionen:

- **Rename** (Umbenennen): den Namen ändern.
- **Switch to sticker** oder **Switch to emoji**: die Art wechseln. Dabei prüft Marinara das Größenlimit der neuen Art erneut. Ein Sticker-Bild größer als 256 mal 256 Pixel ist zu groß für ein Emoji. In dem Fall erscheint eine Fehlermeldung und die Art bleibt unverändert.
- **Remove emoji** oder **Remove sticker**: die Markierung aufheben. Das Bild selbst bleibt in der Galerie.

### Wo diese Emojis und Sticker gelten

Ein in der Galerie markiertes Emoji oder Sticker gilt nur für genau diesen Charakter bzw. diese Persona. Es funktioniert nur in Chats im Conversation Mode, an denen der Charakter oder die Persona beteiligt ist. Davon getrennt sind die globalen Sammlungen für Emojis und Sticker im Nachrichtenfeld.

Trägt ein Galerie-Bild denselben Namen wie ein Eintrag aus der globalen Sammlung, gewinnt in diesem Chat die Galerie-Version. Namen werden nicht auf Eindeutigkeit geprüft. Vergib deshalb pro Bild einen eigenen Namen, dann gibt es keine Überraschungen.

## Ein Galerie-Bild in Nachrichten und Begrüßungen wiederverwenden

Jedes Bild in der Galerie einer Figur lässt sich direkt im Chattext anzeigen: in einer Begrüßung, einer Beispielnachricht oder einer Nachricht der Figur. Fahre über das Galerie-Bild und klicke auf **Copy image reference** (das Link-Symbol). Dadurch wird ein kurzes Markdown-Stück kopiert, das du überall einfügen kannst, wo die Figur spricht:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

Die eine Regel lautet: **`self` bezeichnet die Figur, die diese Nachricht spricht.** Beim Rendern ersetzt Marinara `self` durch diese Figur und zeigt das Bild aus ihrer Galerie.

Es funktioniert in **First Message**, **Alternate Greetings** und **Example Dialogue** auf der Figurenkarte, in jeder von einer Figur gesendeten Nachricht in Roleplay und Conversation sowie in Gruppenchats. Bei Antworten mit mehreren Sprechern wird `self` für jeden Sprecher einzeln aufgelöst. Fehlt die Datei in dessen Galerie, durchsucht Marinara die Galerien der anderen Chatfiguren.

Bewusst nicht unterstützt werden eigene Nachrichten, da sie keine sprechende Figur haben, sowie Systemnachrichten, die keine Markdown-Bilder rendern. Verwende für eigene Nachrichten den Asset-Browser des Chats mit der vollständigen Form `card://characters/<id>/...`. Bilder aus Persona-Galerien benötigen stattdessen `card://personas/<id>/gallery/<file>`.

Haben zwei Figuren dieselben Dateinamen, gewinnt immer das Bild der sprechenden Figur. Fehlt es dort, wird der erste Treffer in der Figurenreihenfolge des Chats verwendet. Vergib eindeutige Namen, wenn eine bestimmte Version erscheinen soll.

### Warum `self` statt des vollständigen Links

Ein vollständiger Link enthält die interne Figuren-ID (`card://characters/<id>/gallery/<file>`). Diese wird bei jedem Import neu erzeugt, sodass vollständige Links beim Teilen brechen. Die Form mit `self` enthält weder ID noch Serveradresse und überlebt einen **nativen JSON-Export und -Import**: Galerie-Bilder reisen mit und behalten ihre Dateinamen.

Eine Einschränkung: **PNG-Kartenexporte enthalten die Galerie nicht**. Teile den nativen `.json`-Export, wenn eine Figur Galerie-Verweise verwendet.

## Verwandte Anleitungen

- [Charaktere erstellen und bearbeiten](creating-and-editing-characters.md)
- [Personas erstellen und bearbeiten](personas.md)
- [Eigene Emojis, Sticker und GIFs](../conversation/emoji-stickers-gifs.md)
- [Szenenhintergründe und die Galerie](../media/scene-backgrounds.md)
