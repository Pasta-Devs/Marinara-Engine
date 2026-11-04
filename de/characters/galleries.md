# Galerien für Charaktere und Personas

Der Tab **Gallery** (Galerie) in den Editoren für Charaktere und Personas bewahrt Bilder und Videos auf, die an einem Charakter oder einer Persona hängen. So bleiben sie erhalten, auch wenn du Chats löschst. Nutze ihn für Referenzbögen, Outfit-Varianten und importierte Bildpakete. Außerdem kannst du ein Galerie-Bild als eigenes Emoji oder als Sticker markieren.

## Der Tab „Gallery“

Jeder Charakter und jede Persona hat einen eigenen Tab **Gallery** (Kamerasymbol). Öffne den Charakter im Charakter-Editor oder die Persona im Persona-Editor und klick dann auf **Gallery**. Bei einem Charakter heißt die Galerie **Character Gallery**, bei einer Persona **Persona Gallery**. Beide funktionieren gleich.

Die Galerie hat zwei Unter-Tabs:

- **Images** (Bilder) enthält Bilder, die du hochlädst.
- **Videos** enthält Videos, die du hochlädst, dazu Szenenvideos und Clips von Videoanrufen, die zu diesem Charakter gehören.

Die Galerie eines Chats ist etwas anderes. Sie enthält Szenenillustrationen und generierte Anhänge für genau diesen einen Chat. Kurzlebige Szenenbilder gehören dorthin, dauerhafte Bilder hierher.

### Bilder hinzufügen

1. Öffne den Tab **Gallery** und wähle **Images**.
2. Zieh Bilddateien auf **Upload Character Images** (Charakterbilder hochladen) oder klick darauf, um Dateien auszuwählen. Bei einer Persona heißt das Feld **Upload Persona Images**.
3. Warte, bis der Upload abgeschlossen ist. Die neuen Bilder erscheinen im Raster.

Klick auf ein Bild, um es größer zu sehen. Jede Kachel hat ein Bedienelement zum Herunterladen und eines zum Löschen.

### Videos hinzufügen

1. Öffne den Tab **Gallery** und wähle **Videos**.
2. Zieh Videodateien auf **Upload Character Videos** (Charaktervideos hochladen) oder klick darauf, um Dateien auszuwählen. Bei einer Persona heißt das Feld **Upload Persona Videos**.
3. Warte, bis der Upload abgeschlossen ist.

Unterstützt werden MP4, WebM und MOV. Die neuesten Videos stehen oben. Welche Szenenvideos und Clips bei welchem Charakter erscheinen, steht unter [Welche Videos aufgelistet werden](#which-videos-are-listed).

## Ein Galerie-Bild als eigenes Emoji oder Sticker markieren

Ein eigenes Emoji ist ein kleines Bild mitten im Text, geschrieben als `:name:`. Ein Sticker ist ein größeres Bild als eigener Block, geschrieben als `sticker:name:`. Beides funktioniert nur in Chats im Conversation Mode, dem Chat-Modus im Messenger-Stil.

1. Öffne den Tab **Gallery** und wähle **Images**.
2. Klick auf die kleine Tag-Schaltfläche oben links im Bild (Tooltip **Tag as emoji or sticker**).
3. Klick auf **Make emoji** oder **Make sticker**.
4. Gib im Dialogfenster **Custom Emoji** bzw. **Custom Sticker** einen Namen ein und bestätige.

Ein Name besteht aus 1 bis 32 Kleinbuchstaben, Ziffern und Unterstrichen. Andere Zeichen wandelt Marinara für dich um, sodass aus „Big Grin“ `big_grin` wird.

Wenn es nicht funktioniert hat: Ein Emoji-Bild darf höchstens 256 mal 256 Pixel messen, ein Sticker höchstens 512 mal 512. Ist das Bild zu groß, erscheint eine Fehlermeldung, und nichts wird markiert.

### Ein markiertes Bild verwalten

Sobald ein Bild markiert ist, zeigt seine eingeblendete Schaltfläche den Namen. Klick darauf für weitere Optionen:

- **Rename** (Umbenennen) ändert den Namen.
- **Switch to sticker** oder **Switch to emoji** wechselt die Art. Dabei wird das Größenlimit der neuen Art geprüft, sodass ein Sticker größer als 256 mal 256 kein Emoji werden kann. Es erscheint eine Fehlermeldung, und die Art bleibt.
- **Remove emoji** oder **Remove sticker** hebt die Markierung auf. Das Bild bleibt in der Galerie.

Ein in der Galerie markiertes Emoji oder Sticker gilt nur für genau diesen einen Charakter oder diese Persona, und zwar in Chats im Conversation Mode, an denen sie beteiligt sind. Davon getrennt sind die globalen Sammlungen für Emojis und Sticker im Nachrichtenfeld. Trägt ein Galerie-Bild denselben Namen wie ein globaler Eintrag, gewinnt in diesem Chat die Galerie-Version. Namen werden nicht auf Eindeutigkeit geprüft, vergib deshalb pro Bild einen eigenen Namen.

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Ein Galerie-Bild in Nachrichten und Begrüßungen wiederverwenden

Jedes Bild in der Galerie eines Charakters kann im Chattext erscheinen: in einer Begrüßung, einer Beispielnachricht oder einer Nachricht, die der Charakter sendet. Zeig auf ein Galerie-Bild und klick auf **Copy image reference** (das Link-Symbol). Dadurch wird ein Stück Markdown kopiert, das du überall einfügen kannst, wo der Charakter spricht:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` bezeichnet den Charakter, der diese Nachricht spricht. Wenn die Nachricht angezeigt wird, ersetzt Marinara `self` durch diesen Charakter und lädt das Bild aus seiner Galerie.

Es funktioniert:

- In **First Message**, **Alternate Greetings** und **Example Dialogue** auf der Charakterkarte. Die Markdown-Vorschau des Felds zeigt das Bild schon beim Bearbeiten.
- In jeder Nachricht, die ein Charakter sendet, in Roleplay und im Conversation Mode.
- In Gruppenchats. Bei einer Antwort mit mehreren Sprechern wird `self` für jeden Sprecher aufgelöst. Fehlt die Datei in der Galerie des Sprechers, prüft Marinara die anderen Charaktere im Chat, in der Reihenfolge des Chats. Haben zwei Charaktere denselben Dateinamen, gewinnt das eigene Bild des Sprechers.

Es funktioniert nicht:

- **In deinen eigenen Nachrichten**. Sie haben keinen sprechenden Charakter, deshalb erscheint ein Verweis mit `self` als defektes Bild. Willst du selbst ein Bild eines Charakters posten, nutze die Einfügefunktion des Asset-Browsers im Chat. Sie schreibt die vollständige Form `card://characters/<id>/...`.
- **In Systemnachrichten**. Sie zeigen keine Markdown-Bilder, deshalb erscheint der Verweis als Text.
- **In Persona-Galerien**. Deine Nachrichten haben keinen Sprecher, verwende deshalb die Persona-Form `card://personas/<id>/gallery/<file>`.

Ein vollständiger Link enthält die interne ID des Charakters, und IDs werden beim Import eines Charakters neu erzeugt. Vollständige Links brechen deshalb bei allen, mit denen du den Charakter teilst. Die Form mit `self` enthält keine ID. Sie überlebt einen Export und Import als **Marinara Native**, weil die Galerie-Bilder mit ihren Dateinamen im Export mitreisen. Exporte als **Compatible PNG Card** und **Compatible JSON** enthalten die Galerie nicht, sodass nach dem Teilen auf diesem Weg kein Galerie-Verweis funktionieren kann. Nimm **Marinara Native**, wenn ein Charakter Galerie-Bilder verwendet.

<a id="save-web-images-from-greetings"></a>

### Webbilder aus Begrüßungen speichern

Viele Karten zeigen in ihren Begrüßungen Bilder von anderen Websites, und solche Links können ins Leere laufen. Zeigen **First Message** oder **Alternate Greetings** Webbilder, hat **Dialogue & Greetings** die Schaltfläche **Save images locally** (Bilder lokal speichern).

1. Öffne den Tab **Card** und such **Dialogue & Greetings**.
2. Klick auf **Save images locally**. Marinara lädt die Bilder in die Galerie herunter und ersetzt jeden Link durch einen Verweis `card://self/gallery/...`.
3. Klick auf **Save** (Speichern), um die neuen Links zu behalten.

Heruntergeladen wird erst, wenn du auf die Schaltfläche klickst. Gespeichert werden nur PNG-, JPEG-, GIF- und WebP-Bilder bis 10 MB und 40 Megapixel. Links auf deinen eigenen Rechner oder dein Heimnetz werden abgelehnt. Ein Bild, das sich nicht speichern lässt, behält seinen Weblink, und ein Hinweis nennt den Grund.

**Restore web links** (Weblinks wiederherstellen) setzt die ursprünglichen Links wieder in die Begrüßungen ein. Die gespeicherten Kopien bleiben in der Galerie, bis du sie löschst. Bilder aus Lorebooks sind davon nicht erfasst.

<a id="which-videos-are-listed"></a>

## Welche Videos aufgelistet werden

Der Unter-Tab **Videos** listet Szenenvideos auf, die in Chats mit diesem Charakter erzeugt wurden, sowie Clips von Videoanrufen. Bei welchem Charakter ein Video erscheint, hängt davon ab, woher es stammt:

- Eine Videonachricht in einem Conversation-Chat erscheint bei den Charakteren, die sie zeigt: beim Charakter, der sie geschickt hat, und bei allen, die sie namentlich nennt. Ein Vorname genügt, wenn ihn niemand sonst im Chat trägt und er großgeschrieben ist. Bittet der Text um ein Gruppenfoto oder Gruppen-Selfie, gehören alle im Chat dazu. Namen in Anführungszeichen zählen nicht.
- Die Galerie deiner Persona listet einen Clip nur, wenn er deine Persona nennt.
- Ältere Videos und Videos aus Roleplay- und Game-Chats erscheinen bei jedem Charakter und bei der Persona ihres Chats.

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Eigene Emojis, Sticker und GIFs](../conversation/emoji-stickers-gifs.md)
- [Szenen-Hintergründe und die Gallery](../media/scene-backgrounds.md)
