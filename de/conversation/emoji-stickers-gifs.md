# Eigene Emojis, Sticker und GIFs

Lade eigene Emojis und Sticker hoch, suche GIFs und steuere, welche eigenen Emojis und Sticker ein Charakter in seinen Antworten verwenden darf. Diese Werkzeuge gibt es nur in Conversation Mode. Roleplay und Game Mode haben nur die einfache Emoji-Auswahl.

## Wo du diese Werkzeuge findest

Klicke in einem Conversation-Chat auf die runde Smiley-Schaltfläche **Emoji, GIFs & stickers** neben dem Nachrichtenfeld. (Auf dem Handy liegt über der Tastatur ein Panel.) Darüber öffnet sich ein Panel. Seine Tabs sind:

- **Emoji**: das übliche Emoji-Raster, dazu ein Stern-Tab **Custom emojis** für deine hochgeladenen Bilder.
- **GIFs**: Live-Suche nach GIFs.
- **Kaomoji**: Textgesichter wie `(^_^)`.
- **Stickers**: deine hochgeladenen Sticker.

Ein Tab **Tools** erscheint auch, wenn weitere Eingabewerkzeuge an sind.

## Ein eigenes Emoji hochladen

Ein eigenes Emoji ist ein kleines Bild, das du einmal hochlädst und in jedem Conversation-Chat verwenden kannst. In einer Nachricht schreibst du es als Shortcode: den Namen zwischen Doppelpunkten, etwa `:kekw:`.

1. Öffne das Panel, gehe zu **Emoji** und dann zum Stern-Tab **Custom emojis**.
2. Klicke auf **Upload** und wähle eine oder mehrere Bilddateien.
3. Tippe im Dialogfenster **Name this emoji** einen Namen ein und klicke auf **Add**.

Das Emoji erscheint im Raster **Custom emojis**.

Regeln:

- Ein Name ist 1 bis 32 Zeichen lang: Kleinbuchstaben, Ziffern und Unterstriche. Die App ändert andere Zeichen für dich.
- Das Bild darf höchstens 256 mal 256 Pixel groß sein. Animierte GIF-Dateien funktionieren und laufen im Chat ab.
- Namen müssen eindeutig sein. Ein vergebener Name zeigt `An emoji named ":name:" already exists.`

Wenn es nicht funktioniert hat: Prüfe den Namen und die Bildgröße anhand der Regeln oben.

## Ein eigenes Emoji verwenden

Klicke im Raster **Custom emojis** auf eine Kachel. Das fügt den Shortcode in deine Nachricht ein und sendet sie nicht. Du kannst den Shortcode auch selbst tippen, in Kleinbuchstaben, genau so wie gespeichert.

In einem Conversation-Chat erscheint ein Shortcode als kleines Inline-Bild. Eine Nachricht nur aus Emoji-Shortcodes zeigt sie größer. Gibt es den Namen nicht mehr, zum Beispiel nachdem du ihn gelöscht hast, zeigt die Nachricht den einfachen Text `:kekw:`.

## Umbenennen, löschen, exportieren und importieren

Klicke oben im Tab **Custom emojis** auf **Edit**, um den Bearbeitungsmodus einzuschalten.

- Klicke auf eine Kachel, um **Rename emoji** zu öffnen, und dann auf **Rename**.
- Klicke auf das Papierkorb-Badge einer Kachel, um sie zu löschen. **Delete emoji** warnt, dass Nachrichten, die es verwendet haben, stattdessen den Text zeigen.
- Klicke auf **Export**, um alle deine eigenen Emojis als `marinara-custom-emojis.json` herunterzuladen. Die Bilder liegen in der Datei.
- Klicke auf **Import**, um eine exportierte Datei zu laden. Sie überspringt Emojis, die gegen die Regeln für Name oder Größe verstoßen oder mit einem vorhandenen Namen kollidieren.

## Eigene Sticker

Ein Sticker ist ein größeres Bild, das in einer eigenen Zeile erscheint. Du klickst normalerweise darauf im Tab **Stickers**. Der Text `sticker:name:` wird eingefügt. Klicke im Tab **Stickers** auf **Upload** und nutze **Edit**, **Export** und **Import** wie bei Emojis. Die Unterschiede:

- Das Upload-Dialogfenster heißt **Name this sticker**.
- Das größte Bild ist 512 mal 512 Pixel groß (bei Emojis: 256 mal 256).
- Die Exportdatei heißt `marinara-custom-stickers.json`.

Um einen Sticker zu senden, klicke auf seine Kachel. Das Dialogfenster **Send sticker** bietet:

- **Send & reply**: sendet den Sticker als eigene Nachricht und lässt den Charakter antworten.
- **Add to message**: fügt den Text `sticker:name:` in deine Nachricht ein, damit du weiterschreiben kannst.

## GIFs suchen

Der Tab **GIFs** durchsucht Giphy, eine Online-GIF-Bibliothek. Tippe einen Suchbegriff in das Suchfeld oder stöbere in der Trendliste und klicke dann auf ein GIF, um es zu senden.

Bevor du anfängst: Die GIF-Suche braucht einen kostenlosen Giphy-API-Key. Ein Key ist ein geheimer Code, mit dem Marinara Giphy für dich nutzen darf. Ohne einen zeigt der Tab eine Einrichtungskarte. Ihn einzurichten heißt, die Datei `.env` zu bearbeiten, Marinaras einfache Textdatei für Einstellungen. Sie liegt im Marinara-Projektordner oder unter `/app/data/.env` in Docker (siehe [Die Datei .env bearbeiten](../CONFIGURATION.md#edit-the-env-file)).

1. Öffne das Giphy-Developer-Dashboard unter `https://developers.giphy.com/dashboard/`.
2. Erstelle einen API-Key für eine Web-App und kopiere ihn.
3. Öffne die Datei `.env` in einem Texteditor.
4. Füge diese Zeile am Ende ein, mit deinem Key anstelle von `your_key_here`, und speichere die Datei:

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Starte Marinara neu. Das heißt: Stoppe es und starte es so wieder, wie du es normalerweise startest (siehe [Installation](../INSTALLATION.md)).

GIF-Ergebnisse nutzen Giphys Freigabestufe für nicht jugendfreie Inhalte. Du kannst sie in der App nicht ändern, also können Ergebnisse GIFs für Erwachsene enthalten. Es gibt keine rein jugendfreie GIF-Quelle.

## Ein Galeriebild als Emoji oder Sticker markieren

Jedes Bild in einer Charakter-Galerie oder Persona-Galerie kann ein eigenes Emoji oder ein Sticker werden. Es funktioniert nur in Chats, die diesen Charakter oder diese Persona enthalten.

1. Öffne den **Character Editor** oder den **Persona Editor**.
2. Öffne den Tab **Gallery** und dann den Unter-Tab **Images**.
3. Zeige auf ein Bild und klicke auf die Tag-Schaltfläche oben links.
4. Wähle **Make emoji** oder **Make sticker**.
5. Tippe im Dialogfenster **Custom Emoji** oder **Custom Sticker** einen Namen ein.

Die Tag-Schaltfläche zeigt nun den Namen. Es gelten dieselben Größenlimits, und ein zu großes Bild zeigt einen roten Fehler. Um es später zu ändern, klicke erneut auf die Tag-Schaltfläche, für **Rename**, eine Umschaltoption wie **Switch to sticker** oder eine Entfernen-Option wie **Remove emoji**. Das Bild bleibt außerdem ein normales Galeriebild.

## Auswahl-Einstellungen

Marinara teilt dem antwortenden Charakter mit, welche eigenen Emojis und Sticker er verwenden darf. Um zu ändern, wie es sie auswählt, klicke oben im Tab **Custom emojis** oder **Stickers** auf das Zahnrad **Selection preferences**. Beide öffnen dieselbe Einstellung, die pro Chat gespeichert wird.

- **Semantic** (Standard): bietet die an, die am besten zum aktuellen Gespräch passen. Es nutzt ein kleines Modell auf deinem eigenen Rechner. Ist es nicht verfügbar, wählt es zufällig aus. Wenn ein einzelner Charakter antwortet, werden seine eigenen Emojis und Sticker zusammen mit den gemeinsam verfügbaren bewertet. Bei annähernd gleicher Eignung haben seine eigenen Vorrang.
- **Random**: bietet bei jeder Antwort eine zufällige Auswahl an.
- **Tool-call**: Ein Modell wählt bei jeder Antwort die passenden aus. Wähle ein Modell unter **Select a model...**. Ist keines gesetzt oder schlägt es fehl, nutzt es Semantic. Es wird übersprungen, wenn in einem Gruppenzug mehrere Charaktere antworten.

**Max offered (each)** legt fest, wie viele Emoji-Namen und wie viele Sticker-Namen pro Zug angeboten werden. Standard ist 20, von 1 bis 100.

Wenn ein Charakter den Namen eines Stickers wie ein Emoji schreibt, etwa `:hug:` statt `sticker:hug:`, erscheint in der Antwort der Sticker. Das passiert nur, wenn kein eigenes Emoji diesen Namen hat.

<a id="describe-emojis-and-stickers"></a>

### Emojis und Sticker beschreiben

Eine Beschreibung sagt, was ein Emoji oder Sticker zeigt und welches Gefühl es vermittelt, zum Beispiel „Katze schaut hinter einem Kissen hervor; schüchtern, verlegen“. Das hilft, wenn der Name nicht verrät, was das Bild bedeutet.

- Um selbst eine zu schreiben, klick im Tab **Custom emojis** oder **Stickers** auf **Edit** (Bearbeiten) und dann auf die kleine Beschreibungsschaltfläche in der Ecke einer Kachel. Bei einem in der Galerie markierten Emoji oder Sticker klick auf die Tag-Schaltfläche und wähle **Add description** (Beschreibung hinzufügen).
- Um die Beschreibungen von der KI schreiben zu lassen, klick auf **Edit** und dann auf **Describe with AI** (Mit KI beschreiben). Das Modell unter **Image reading** (Bildbeschreibungen) sieht sich jedes Bild an und schreibt eine kurze Beschreibung. Wenn einige schon eine haben, wähle **Describe only the … without** (nur die ohne Beschreibung) oder **Describe all … again** (alle erneut beschreiben).

Bevor du anfängst: KI-Beschreibungen brauchen ein Modell, das Bilder lesen kann. Marinara nutzt das Modell unter **Image reading**, wenn du auf der Seite **Jobs** (Aufgaben) in **Connections** (Verbindungen) eines festgelegt hast, sonst das Modell deiner Agenten.

Zwei Einstellungen unter **Selection preferences** (Auswahleinstellungen) nutzen die Beschreibungen:

- **Use descriptions** (Beschreibungen verwenden, standardmäßig an): berücksichtigt bei **Semantic** und **Tool-call** neben dem Namen auch die Beschreibung, um auszuwählen, welche Emojis und Sticker angeboten werden. Dem Prompt wird nichts hinzugefügt.
- **Show descriptions to the model** (Dem Modell die Beschreibungen zeigen, standardmäßig aus): führt zusätzlich zu jedem angebotenen Namen die Beschreibung auf, damit das Modell weiß, was er bedeutet. Bei der Standardauswahl von 20 kommen pro Antwort ungefähr 1.000 bis 1.800 Eingabe-Tokens hinzu.

Wenn Beschreibungen nur zur Auswahl dienen, erfährt das Modell dadurch nicht, was ein Name bedeutet. Wenn ein Name das Gegenteil des vermittelten Gefühls ausdrückt, etwa ein sarkastisches `:fine:`, schalte **Show descriptions to the model** oder **Show them to the model** (dem Modell die Bilder zeigen) ein.

### Dem Modell die Bilder zeigen

Normalerweise sieht das Modell nur die Namen deiner eigenen Emojis und Sticker. Wenn das Chat-Modell Bilder lesen kann, sendet ihm **Show them to the model** (dem Modell die Bilder zeigen) im selben Panel auch die Bilder, damit es weiß, wie sie aussehen. Das hilft besonders bei Namen, die das Bild nicht beschreiben.

- **Aus** (Standard): nur Namen.
- **Last message** (letzte Nachricht): zeigt die eigenen Emojis und Sticker aus der neuesten Nachricht.
- **Recent** (letzte Nachrichten): zeigt die aus den letzten paar Nachrichten. **Messages to look at** (zu berücksichtigende Nachrichten) legt fest, wie viele: 2 bis 20. Standard ist 6.

**Offered ones on the sheet** (angebotene Emojis und Sticker auf dem Übersichtsbild) fügt den Bildern jeweils die eingestellte Anzahl angebotener Emojis und Sticker hinzu, von 0 bis 30. Standard ist 6. Ein Übersichtsbild fasst bis zu 30 Emojis und 12 Sticker. Die aus dem Chat haben Vorrang; die angebotenen füllen den verbleibenden Platz.

Das Modell erhält bei jeder Antwort ein Bild mit nummerierten Emojis und eines mit nummerierten Stickern, dazu die genauen Namen als Text. Das kostet bei jeder Antwort zusätzliche Eingabe-Tokens (Tokens sind die kleinen Text- und Bildbestandteile, die ein Dienst abrechnet), mit den Standardeinstellungen ungefähr 1.000. Die Funktion hat keine Wirkung, wenn das Chat-Modell keine Bilder lesen kann oder **Bildbeschreibungen** eingeschaltet ist. Wenn das Modell Bilder ablehnt, sendet Marinara nur die Namen.

## Reaktionen nutzen nur deine Haupt-Emojis

Du kannst auf eine Nachricht mit einem eigenen Emoji reagieren, aber nur aus den Emojis, die du im Tab **Custom emojis** hochgeladen hast. Galerie-markierte Emojis, Sticker und GIFs sind als Reaktionen nicht verfügbar. Wenn ein Charakter mit dem Namen eines Stickers reagiert, zeigt die Reaktion diesen Sticker. Siehe [Reagieren und benachrichtigt werden](getting-started.md#react-and-get-notified).

## Verwandte Anleitungen

- [Conversation Mode: Erste Schritte](getting-started.md)
- [Charakter- und Persona-Galerien](../characters/galleries.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
