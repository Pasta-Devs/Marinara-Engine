# Szenen-Hintergründe und die Gallery

In dieser Anleitung erfährst du, wie Marinara Engine per KI Szenen-Hintergründe erzeugt, welche Hintergrundbilder dabei aus der **Gallery** (Galerie) entstehen und was die Gallery sonst noch kann. Dazu gibt es zwei verwandte Anleitungen: [Chat-Hintergründe](../appearance/chat-backgrounds.md) beschreibt die Bibliothek selbst hochgeladener Bilder, aus der du von Hand auswählst, und [Roleplay-Hintergründe](../roleplay/backgrounds.md) beschreibt den Agenten, der in jedem Zug automatisch einen Hintergrund setzt.

## Wo Szenen-Hintergründe funktionieren

Szenen-Hintergründe gibt es in den Modi Roleplay und Game. Im Modus Conversation stehen sie nicht zur Verfügung. Versuchst du es dort trotzdem, zeigt die App diese Meldung:

```
Scene background generation is available in Roleplay and Game modes.
```

Für einen Hintergrund brauchst du eine **Image Generation**-Verbindung (Bildgenerierung). Richte sie zuerst ein, falls noch nicht geschehen. Siehe [Anbieter für Bildgenerierung und Einrichtung](image-providers.md).

## Hintergrund aus der Gallery generieren und anwenden

Die **Gallery** enthält die Bilder und Videos eines Chats. Öffne **Chat Settings** und klapp den Abschnitt **Gallery** auf. Am Computer kannst du ihn in einem eigenen Fenster öffnen (siehe [Chat Settings im Überblick](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)). Mit der Schaltfläche **Background** (Hintergrund) erzeugst du ein Hintergrundbild für die aktuelle Szene.

So generierst du einen Hintergrund:

1. Öffne den Abschnitt **Gallery** in **Chat Settings**.
2. Klick auf die Schaltfläche **Background**.
3. Während das Bild entsteht, wechselt die Beschriftung auf **Generating...**.
4. Dazu erscheint diese Statusmeldung: "AI background generation is running. The new background will be applied when it finishes."
5. Ist die Generierung fertig, landet das neue Bild sofort in der aktuellen Szene. Die Meldung "Background generated." bestätigt das.

Als Vorlage dient die aktuelle Szene. In einem Spiel fließen Genre, Setting, Ort, Wetter und Tageszeit mit ein. Generierte Hintergründe nutzen die Leinwandgröße **Backgrounds**, standardmäßig 1280 mal 720 Pixel. Ändern lässt sich diese Größe unter **Settings** (Einstellungen), dann **Generations**, dann **Image Generation**.

### Wenn keine Bild-Verbindung eingestellt ist

Findet Marinara keine passende Bild-Verbindung, bricht der Schritt mit dieser Meldung ab:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Zur Abhilfe öffnest du das **Connections**-Panel (Verbindungen), klappst **Defaults** auf und wählst unter **Images** eine Bild-Verbindung aus. Alternativ hinterlegst du beim Agenten **Illustrator** eine eigene Bild-Verbindung.

## Der Gallery-Abschnitt

Die **Gallery** hat zwei Tabs: **Images** und **Videos**. Jeder Tab zeigt an, wie viele Einträge er enthält. Den Tab **Videos** gibt es nur, wenn für den Chat Szenenvideos aktiviert sind.

Oben im Abschnitt erscheinen Schaltflächen jeweils nur dann, wenn die passende Funktion für den Chat infrage kommt:

- **Illustrate**: startet den Agenten Illustrator für ein einzelnes Szenenbild. Siehe [Illustrator-Agent](illustrator-agent.md).
- **Selfie**: erzeugt ein Selfie eines Charakters im Modus Conversation.
- **Background**: generiert einen Szenen-Hintergrund und wendet ihn an, wie oben beschrieben.
- **Video**: macht aus der neuesten Illustration ein Szenenvideo.
- **Create storyboard**: erzeugt Keyframes für den letzten Game-Mode-Zug oder eine abgeschlossene Roleplay-Episode, sofern Storyboard aktiv ist.
- **Browse Images**: öffnet eine Übersicht gespeicherter Bilder zum Einfügen.
- **View storyboard**: öffnet das neueste Game-Mode-Storyboard.

Unter den Schaltflächen liegt die Ablagefläche **Upload Images** (Bilder hochladen). Zieh Bilder darauf, um eigene Motive in die Gallery dieses Chats zu legen.

### Aktionen pro Bild

Zeig mit dem Mauszeiger auf ein Bild im Tab **Images** oder tipp es auf dem Handy an – schon erscheinen die zugehörigen Aktionen:

- Bild in voller Größe öffnen (**Open gallery image**).
- **Pin to chat**: heftet das Bild an den Chat.
- **Download image**: speichert das Bild auf dem Gerät.
- **Animate illustration**: macht aus dem Bild ein Szenenvideo.
- **Copy prompt**: kopiert den gespeicherten Bild-Prompt, also den Text, den Marinara an die KI geschickt hat. Fehlt ein gespeicherter Prompt, steht dort **No prompt saved** und die Aktion ist deaktiviert.
- **Delete gallery image**: löscht das Bild nach einer Rückfrage.

## Den Prompt vor dem Senden prüfen

Du kannst den Prompt kontrollieren und bearbeiten, bevor Marinara die Hintergrund-Anfrage an den Bild-Anbieter schickt.

1. Öffne **Settings**, dann **Generations**, dann **Image Generation**.
2. Aktiviere **Expose media prompts before sending**.

Ist die Einstellung aktiv, öffnet sich vor jeder Anfrage das Fenster **Review Image Prompt**. Der Hilfetext lautet: "Edit the prompt below before Marinara sends the image request to your provider."

In diesem Fenster kannst du:

- den Prompt-Text und den negativen Prompt bearbeiten.
- Bildart und Größe sehen, dazu eine laufende Zeichenzählung.
- auf **Cancel** klicken, um abzubrechen, oder auf **Generate**, um zu senden.

Ist eines der Prompt-Felder leer, bleibt **Generate** deaktiviert und dieser Hinweis erscheint: "Every image request needs a prompt." Der eingetippte Text geht exakt so raus, wie du ihn schreibst.

## Gespeicherte Hintergründe verwalten

Jeder generierte Szenen-Hintergrund landet in der Hintergrund-Bibliothek. Dorthin kannst du auch eigene Bilder legen. Hochgeladene Hintergründe dürfen JPG, PNG, GIF, WebP und AVIF sein, jeweils bis 20 MB.

Selbst hinzugefügte Hintergründe lassen sich mit Tags (Schlagwörtern) versehen, umbenennen und löschen. Tags werden kleingeschrieben und dürfen Buchstaben, Zahlen, Leerzeichen, Bindestriche und Unterstriche enthalten, höchstens 40 Zeichen pro Tag. Mitgelieferte Hintergründe aus den Spiel-Assets stehen gleichberechtigt daneben, lassen sich aber weder umbenennen noch taggen oder löschen.

Verwaltet wird diese Bibliothek in den Darstellungseinstellungen; dort legst du auch einen Hintergrund pro Chat oder einen Standard fest. Die komplette Bibliothek, die Auswahl und **Background Blur** beschreibt [Chat-Hintergründe](../appearance/chat-backgrounds.md).

## Verwandte Anleitungen

- [Chat-Hintergründe](../appearance/chat-backgrounds.md): die Bibliothek hochgeladener Bilder, aus der du von Hand auswählst.
- [Roleplay-Hintergründe](../roleplay/backgrounds.md): der Agent, der in jedem Zug automatisch einen Hintergrund setzt.
- [Illustrator-Agent](illustrator-agent.md): Szenen-Illustrationen für die Modi Roleplay und Game.
- [Anbieter für Bildgenerierung und Einrichtung](image-providers.md): eine Bild-Verbindung einrichten.
- [Szenenvideos generieren](scene-video.md): ein Bild aus der Gallery in ein Video verwandeln.
