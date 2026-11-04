# Nachrichten senden und streamen

Tipp eine Nachricht, schick sie ab und sieh zu, wie die Antwort erscheint. In dieser Anleitung erfährst du, wie du sendest, Dateien anhängst, Antworten streamst, eine Antwort stoppst, es erneut versuchst und eine Fehlermeldung liest.

## Eine Nachricht senden

Bevor du anfängst: Dein Chat braucht ein Modell. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Tipp in die Eingabeleiste unten im Chat.
2. Klick auf **Send** (Senden) oder drück <kbd>Enter</kbd>, wenn **Send on Enter** (Mit Enter senden) für diesen Chat-Modus an ist.

Deine Nachricht erscheint, dann streamt die Antwort herein. Pro Chat kann immer nur eine Antwort gleichzeitig entstehen. Während eine Antwort streamt, wird **Send** zur Stopp-Schaltfläche.

Wenn es nicht funktioniert hat: Ist für den Chat kein Modell eingestellt, schlägt die Antwort sofort fehl, mit dem Hinweis, dass keine Verbindung eingerichtet ist. Wähl eine in den [Chat Settings](chat-settings.md).

### Send on Enter

Du findest die Einstellung unter **Settings → General → Input & Editing**. Pro Chat-Modus gibt es einen Schalter.

| Chat-Modus | Standard | Wenn aus |
| --- | --- | --- |
| Roleplay | Aus | <kbd>Enter</kbd> fügt einen Zeilenumbruch ein. Klick auf **Send**. |
| Conversations | An | <kbd>Strg</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> auf dem Mac) sendet. |
| Game | An | <kbd>Strg</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> auf dem Mac) sendet. |

Bei Roleplay ist die Einstellung standardmäßig aus, weil Roleplay-Nachrichten oft lang sind und Zeilenumbrüche brauchen. Professor Mari hat einen eigenen Schalter, **Enter sends to Professor Mari** (Enter sendet an Professor Mari), unter **Settings → General → Search and Professor Mari settings**.

## Bilder und Dateien anhängen

1. Tipp in der Eingabeleiste auf die Büroklammer.
2. Wähl eine Datei. Sie erscheint als kleiner Chip über dem Eingabefeld.
3. Sende wie gewohnt.

Marinara akzeptiert Bilder, PDF-Dateien und reine Textdateien (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Jede Datei darf höchstens 20 MB groß sein. Eine größere Datei oder einen nicht unterstützten Typ lehnt Marinara mit einem Hinweis ab.

Ein Bild sieht ein Modell nur, wenn es Bilder verarbeiten kann (Vision). Bei einem reinen Textmodell schalte **Image captioning** (Bildbeschreibung) unter **Chat Settings → Advanced Parameters** ein. Standardmäßig ist es aus. Marinara beschreibt dann jedes Bild mit einem Modell deiner Wahl in Textform und schickt diese Beschreibung statt des Bildes.

## Ein Galerie-Bild in einer Nachricht anzeigen

Anhänge sind dafür da, dass das Modell sie sieht. Ein Galerie-Link zeigt dir ein Bild direkt im Nachrichtentext. Nachrichten verstehen Markdown-Bildsyntax, und Marinara löst `card://`-Links zu Galerie-Dateien auf:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

In Roleplay kann der Asset-Browser des Chats einen solchen Link für dich einfügen. Du kannst ihn auch selbst in Nachrichten, Begrüßungen und Beispieldialoge einfügen.

Für die eigene Galerie eines Charakters nimm die portable Form `card://self/gallery/<filename>`. Sie funktioniert auch nach Export und Import des Charakters weiter. Die Schaltfläche **Copy image reference** (Bildverweis kopieren) der Galerie erzeugt sie. Siehe [Charaktergalerien](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Die Antwort streamen

Beim Streaming erscheint die Antwort Wort für Wort statt auf einmal. Diese Einstellungen liegen unter **Settings → General → Responses**.

| Einstellung | Standard | Funktion |
| --- | --- | --- |
| **Enable streaming** (Streaming aktivieren) | An | Zeigt die Antwort, während sie geschrieben wird. Ist es aus, erscheint die ganze Antwort, sobald das Modell fertig ist. |
| **Streaming speed** (Streaming-Geschwindigkeit) | 50 | Regler von 1 bis 100. Ein niedrigerer Wert ergibt einen langsameren Schreibmaschinen-Effekt. Wie schnell das Modell schreibt, ändert er nicht. |
| **Trim incomplete sentences from the response** (unvollständige Sätze aus der Antwort entfernen) | Aus | Entfernt einen unvollständigen letzten Satz, bevor die Antwort gespeichert wird. Vollständige Antworten und befehlsartige Schlusszeilen bleiben, wie sie sind. |

## Tipp- und Fortschrittsanzeigen

Bevor das erste Wort eintrifft, siehst du den Namen des Charakters mit drei animierten Punkten. In einem Gruppenchat erscheint der Name jedes antwortenden Charakters. Während der Server den Prompt vorbereitet, läuft eine Fortschrittszeile durch diese Beschriftungen. Manche Schritte laufen nur, wenn der Chat die jeweilige Funktion nutzt – du siehst also womöglich nicht alle.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Steht der Status eines Charakters auf beschäftigt oder abwesend, erscheint statt der Punkte eine Warteanzeige. Die Antwort startet, sobald der Charakter verfügbar ist.

## Das Thinking des Modells ansehen

Manche Modelle geben eine verborgene Gedankenspur zurück, „Thinking“ genannt. Hat eine Antwort eine, erscheint an der Nachricht ein Gehirn-Symbol, **View model thoughts** (Gedanken des Modells anzeigen). Klick darauf, um die Gedanken zu lesen.

Damit das funktioniert, muss das Modell seine Gedanken auch zurückgeben. Manche Modelle verpacken sie in einfache Text-Tags. Setz für diese Modelle **Thinking Tags** in den Generierungseinstellungen, damit Marinara die Gedanken von der Antwort trennen kann. Siehe [Generierungsparameter](../prompts/generation-parameters.md).

## Eine Antwort stoppen

Klick auf die Stopp-Schaltfläche – das ist die Schaltfläche **Send**, solange eine Antwort streamt. Bereits hereingestreamter Text bleibt in der Regel erhalten. Ein absichtlicher Stopp zeigt nie einen Fehler.

<a id="retry-without-retyping"></a>

## Erneut versuchen, ohne neu zu tippen

Ist die letzte Nachricht von dir und hat die KI nie geantwortet, lass das Eingabefeld leer und klick auf **Send** (oder drück <kbd>Enter</kbd>). Marinara startet eine neue Antwort und legt keine doppelte Nachricht an. In Conversation zeigt die Schaltfläche in diesem Zustand einen kreisförmigen Pfeil. Steht ein Entwurf im Feld, schickt **Send** stattdessen den Entwurf ab.

In Roleplay startet ein leeres **Send** auch dann eine komplett neue Antwort, wenn die KI schon geantwortet hat. Es ergänzt die vorherige Antwort nicht. Um die vorherige Antwort zu verlängern, nimm `/continue`. Siehe [Aktionen für Nachrichten](messages.md).

## Wenn ein Fehler bei der Generierung erscheint

Bei einer fehlgeschlagenen Antwort erscheint unten am Bildschirm für etwa 15 Sekunden ein Toast (eine kurze Einblendung). Du kannst seinen Text kopieren. Manche Fehler formuliert Marinara in einen nächsten Schritt um:

| Ursache | Was der Toast dir sagt |
| --- | --- |
| Das Modell lehnt einen Parameter ab, den es nicht unterstützt | Öffne **Chat Settings → Advanced Parameters** und schalte **Send** für diesen Parameter aus. |
| Das Modell verlangt einen Parameter, der aus ist | Schalte **Send** an derselben Stelle wieder ein. |
| Die Antwort kam leer zurück | Sende deine Nachricht noch einmal. |
| Es entsteht bereits eine Antwort | Warte oder stopp sie mit der Stopp-Schaltfläche. |
| Es ist keine Verbindung eingerichtet | Richte eine für den Chat ein. |

Tritt ein Fehler immer wieder auf, siehe [Fehlerbehebung](../TROUBLESHOOTING.md).

## Langsame Verbindungen und Tabs auf dem Handy

Eine lange Antwort kann eine Weile dauern. Du kannst sie jederzeit stoppen. Auf dem Handy pausiert der Browser einen Chat-Tab womöglich, wenn du zu etwas anderem wechselst. Streamte gerade eine Antwort, zeigt Marinara **Finishing in background...** und prüft dann, ob die Antwort auf dem Server fertig geworden ist. Ist sie nicht aufgetaucht, lade den Chat kurz darauf neu.
