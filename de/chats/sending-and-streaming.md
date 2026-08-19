# Nachrichten senden und streamen

In dieser Anleitung erfährst du, wie jeder Chat in Marinara Engine im Kern funktioniert: wie du eine Nachricht abschickst, wie die KI-Antwort nach und nach auf dem Bildschirm erscheint und wie du sie stoppst oder neu anstößt. Dazu kommen Anhänge, die „Thinking“-Anzeigen und der richtige Umgang mit Fehlern bei der Generierung.

## Eine Nachricht senden

Die Eingabeleiste sitzt in jedem Chat ganz unten. Tipp den Text ins Feld und starte die KI-Antwort auf eine von zwei Arten:

1. Klick auf die Schaltfläche **Send** (Senden) rechts in der Eingabeleiste.
2. Oder drück Enter, sofern **Send on Enter** (Mit Enter senden) für diesen Chat-Modus aktiviert ist.

Deine Nachricht erscheint daraufhin in der Liste, gefolgt von der KI-Antwort, während sie entsteht.

Pro Chat läuft immer nur eine Generierung. Solange eine Antwort streamt, wird aus **Send** eine Stopp-Schaltfläche – so startest du nicht versehentlich eine zweite Antwort.

Zum Senden braucht Marinara eine funktionierende Verbindung. Über eine Verbindung erreicht Marinara einen KI-Anbieter (siehe die verwandte Anleitung unten). Fehlt sie, schlägt die Antwort sofort fehl, mit dem Hinweis, dass für den Chat keine Verbindung eingerichtet ist.

### Send on Enter

Die Einstellung **Send on Enter** findest du unter **Settings** (Einstellungen) im Tab **General** (Allgemein), im Abschnitt **Input & Editing** (Eingabe und Bearbeitung). Es gibt einen Schalter pro Chat-Modus:

| Chat-Modus | Standard | Was Enter bewirkt, wenn aktiviert |
|---|---|---|
| Roleplay | Off | Enter sendet die Nachricht |
| Conversations | On | Enter sendet die Nachricht |
| Game | On | Enter sendet die Nachricht |

Ist der Schalter für einen Modus aus, fügt Enter stattdessen einen Zeilenumbruch ein. Die Nachricht schickst du dann per Klick auf **Send** ab. Bei Roleplay ist die Einstellung standardmäßig aus, weil Roleplay-Nachrichten oft lang sind und Zeilenumbrüche brauchen.

## Bilder und Dateien anhängen

Häng Bilder oder Dateien an, damit die KI sie sehen oder lesen kann. Klick auf die Büroklammer in der Eingabeleiste und wähl eine Datei aus. Angehängte Dateien erscheinen vor dem Senden als kleine Chips über dem Eingabefeld.

Marinara akzeptiert diese Dateitypen:

- Bilder.
- PDF-Dateien.
- Reine Textdateien: `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml` und `.yml`.

Jede Datei darf höchstens 20 MB groß sein. Größere Dateien lehnt Marinara mit dem Hinweis ab, dass die Datei zu groß ist. Bei einem nicht unterstützten Dateityp nennt der Hinweis die erlaubten Typen.

Ein Bild „sieht“ die KI nur, wenn das verbundene Modell Bilder verarbeiten kann. Bei einem reinen Textmodell aktivierst du **Image Captioning** (Bildbeschreibung). Diese Einstellung sitzt in den **Chat Settings** (Chat-Einstellungen) des jeweiligen Chats, im Abschnitt **Advanced Parameters** (Erweiterte Parameter), und ist standardmäßig aus. Ist sie an, beschreibt Marinara jedes angehängte Bild über eine Verbindung deiner Wahl in Textform und schickt diese Beschreibung statt des Bildes.

## Ein Galerie-Bild in eine Nachricht einfügen

Anhänge sind für die KI zum *Sehen*. Galerie-Verweise sind für Leserinnen und Leser zum *Sehen*: Sie zeigen ein Bild aus einer Galerie direkt im Nachrichtentext.

Nachrichten unterstützen Markdown-Bildsyntax. Marinara löst spezielle `card://`-Links zu Galerie-Dateien auf:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

Im Roleplay Mode kann der Asset-Browser des Chats einen solchen Link einfügen. Du kannst ihn auch überall einfügen, wo Text geschrieben wird: in Nachrichten, Begrüßungen und Beispieldialogen.

Für Bilder aus der **eigenen Galerie einer Figur** ist die portable Form `card://self/gallery/<filename>` besser; sie funktioniert auch nach Export und Import der Figur. Die Figurengalerie bietet dafür **Copy image reference**. Einzelheiten stehen unter [Figurengalerien → Ein Galerie-Bild in Nachrichten und Begrüßungen wiederverwenden](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Die Antwort streamen

Beim Streaming erscheint die Antwort Wort für Wort, statt erst am Stück nach dem Ende der Generierung. Die zugehörigen Einstellungen liegen unter **Settings** im Tab **General**, im Abschnitt **Responses** (Antworten):

| Einstellung | Standard | Wirkung |
|---|---|---|
| **Enable streaming** | On | Zeigt die Antwort Wort für Wort, während sie entsteht |
| **Streaming speed** | 50 | Legt fest, wie schnell gestreamter Text auf dem Bildschirm erscheint |
| **Trim incomplete model endings** | Off | Schneidet einen angefangenen Schlusssatz vor dem Speichern ab |

**Streaming speed** ist ein Regler von 1 bis 100. Ein niedriger Wert erzeugt einen langsamen Schreibmaschinen-Effekt, sodass du mitlesen kannst. Ein hoher Wert zeigt den Text fast sofort. Marinara glättet ungleichmäßig eintreffende Tokens (kleine Textstücke), solange das Modell schreibt, und beendet die Antwort dann mit der eingestellten Geschwindigkeit. Wie schnell das Modell selbst schreibt, ändert diese Einstellung nicht.

Ist **Enable streaming** aus, erscheint die vollständige Antwort auf einen Schlag, sobald das Modell fertig ist.

**Trim incomplete model endings** betrifft nur die gespeicherte Nachricht. Ist die Einstellung an, entfernt Marinara einen angefangenen Schlusssatz aus der Antwort. Vollständige Antworten und befehlsartige Schlusszeilen bleiben unangetastet.

## Tipp- und Fortschrittsanzeigen

Bevor das erste Wort einer Antwort eintrifft, zeigt Marinara, dass der Charakter arbeitet. Zu sehen ist der Charaktername mit drei animierten Punkten. In einem Gruppenchat stehen die Namen aller antwortenden Charaktere zusammen.

Während der Server den Prompt (den Text, den Marinara an die KI schickt) vorbereitet, läuft eine kurze Fortschrittszeile durch diese Beschriftungen:

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Jede Beschriftung steht für einen Schritt, den Marinara vor oder während der Antwort ausführt. Sobald das erste Wort der Antwort hereinstreamt, verschwindet die Zeile. Manche Schritte laufen nur, wenn ein Chat die jeweilige Funktion nutzt – du siehst also nicht zwangsläufig jede Beschriftung.

Steht der Anwesenheitsstatus eines Charakters auf beschäftigt oder abwesend, erscheint statt der Tipp-Punkte eine Warteanzeige. Die Antwort startet, sobald der Charakter wieder verfügbar ist.

## Das Thinking des Modells ansehen

Manche Modelle geben eine verborgene Gedankenspur aus, oft „Thinking“ genannt. Marinara hält sie von der sichtbaren Antwort getrennt.

Hängt an einer Antwort ein Thinking, erscheint bei dieser Nachricht die Aktion **View thoughts** (Gedanken ansehen, ein Gehirn-Symbol). Ein Klick darauf öffnet ein Panel mit dem erfassten Text.

Angezeigt wird nur, was das Modell auch tatsächlich zurückgibt. Manche Modelle verpacken ihre Gedanken in einfache Text-Tags. Setz dafür eigene **Thinking Tags** (Thinking-Tags) an der Verbindung, damit Marinara die verborgenen Gedanken von der sichtbaren Antwort trennen kann. Mehrere gängige Tag-Paare erkennt Marinara bereits. Wie du **Thinking Tags** einträgst, steht in der Anleitung zu den Generierungsparametern unten.

## Eine Antwort stoppen

Um eine laufende Antwort zu stoppen, klick auf die Stopp-Schaltfläche. Das ist dieselbe Schaltfläche wie **Send**: Während eine Antwort streamt, wird ihr Symbol zum Stopp-Zeichen.

Der Text, der bis dahin hereingestreamt ist, bleibt in der Regel stehen. Ein absichtlicher Stopp gilt nie als Fehler.

## Neu versuchen, ohne noch mal zu tippen

Ist die letzte Nachricht im Chat von dir und die KI hat nie geantwortet, musst du nichts erneut tippen. Lass das Eingabefeld leer. Klick dann auf **Send** (oder drück Enter), um eine frische Antwort zu starten, ohne die Nachricht doppelt einzutragen. Im Conversation Mode zeigt die Schaltfläche in diesem Zustand einen kreisförmigen Wiederholungspfeil.

Das funktioniert nur bei leerem Eingabefeld. Steht dort ein Entwurf, schickt die Schaltfläche stattdessen diesen Entwurf ab.

Im Roleplay Mode gibt es eine verwandte Abkürzung. Drück **Send** bei leerem Feld, um die KI zu einer weiteren Antwort anzustoßen – auch dann, wenn sie bereits geantwortet hat. Das startet immer eine komplett neue Antwort und hängt nichts an die vorherige an. Um die vorherige Antwort weiterzuschreiben, nimm den Befehl `/continue`, beschrieben in der Anleitung zu den Nachrichtenaktionen unten.

## Wenn ein Fehler bei der Generierung erscheint

Schlägt eine Antwort fehl, zeigt Marinara unten am Bildschirm eine Toast-Benachrichtigung. Sie bleibt rund 15 Sekunden stehen, und du kannst ihren Text kopieren. Eine gestoppte Antwort gilt nicht als Fehler.

Bei einigen häufigen Problemen formuliert Marinara den Rohfehler in einen klaren nächsten Schritt um:

- Lehnt das Modell einen Parameter ab, den es nicht unterstützt, nennt der Hinweis die Lösung. Geh in die **Chat Settings**, öffne **Advanced Parameters** und schalte **Send** für diesen Parameter aus.
- Verlangt das Modell einen Parameter, der ausgeschaltet ist, fordert der Hinweis dich auf, ihn wieder zu aktivieren. Geh an dieselbe Stelle und schalte **Send** für diesen Parameter ein.
- Kommt die Antwort völlig leer zurück, schlägt der Hinweis vor, die Nachricht noch einmal zu senden.

Weitere verständliche Meldungen, die dir begegnen können:

- Für diesen Chat läuft bereits eine Generierung. Warte, bis sie fertig ist, oder stopp sie mit der Stopp-Schaltfläche.
- Für diesen Chat ist keine Verbindung eingerichtet. Richte zuerst eine ein (siehe die verwandte Anleitung unten).

Tritt ein Fehler immer wieder auf, findest du in der Anleitung zur Fehlerbehebung unten weitere Lösungen zu Verbindungs- und Generierungsfehlern.

## Langsame Verbindungen und Tabs auf dem Handy

Eine lange Antwort kann dauern, und das ist normal. Mit der Stopp-Schaltfläche kannst du sie jederzeit abbrechen.

Auf dem Handy pausiert der Browser einen Chat-Tab womöglich, sobald du wegwechselst. Streamte die Antwort noch, zeigt Marinara den Zustand **Finishing in background...** an. Anschließend prüft Marinara, ob die Antwort auf dem Server fertig geworden ist. Dauert es länger, erscheint ein Hinweis, dass die Antwort im Hintergrund noch läuft. Lade den Chat kurz darauf neu, falls sie nicht auftaucht.

## Verwandte Anleitungen

- [Nachrichtenaktionen: Bearbeiten, Löschen, Swipe, Neu generieren](messages.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Generierungsparameter](../prompts/generation-parameters.md)
- [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md)
