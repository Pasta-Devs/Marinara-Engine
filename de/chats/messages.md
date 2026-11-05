# Aktionen für Nachrichten: bearbeiten, löschen, Swipes, neu generieren

Jede Nachricht, deine wie die der KI, hat eine Werkzeugleiste. Darüber bearbeitest du eine einzelne Nachricht, löschst sie, generierst sie neu, verbirgst sie oder legst ab ihr eine Verzweigung an.

Die Werkzeugleiste erscheint, wenn du auf Handy oder Tablet auf eine Nachricht tippst oder am Computer auf sie zeigst.

## Die Nachrichten-Werkzeugleiste

Am häufigsten gebraucht:

- **Edit** (bearbeiten) ändert den Nachrichtentext.
- **Regenerate** (neu generieren) bittet das Modell um eine neue Fassung einer KI-Antwort. Jede Fassung heißt Swipe.
- **Delete** (löschen) entfernt die Nachricht.

Die Schaltflächen sind Symbole. Ihre Beschriftungen stehen unten. Manche erscheinen nur in bestimmten Situationen.

| Schaltfläche | Funktion |
| --- | --- |
| **Copy** (kopieren) | Kopiert den Nachrichtentext. |
| **Edit** | Öffnet die Nachricht zum Bearbeiten. |
| **Regenerate** | Erzeugt einen neuen Swipe (eine weitere Fassung der Antwort). Nur bei KI-Nachrichten. Außerdem bei deinen Nachrichten in Roleplay und bei deinen Impersonate-Nachrichten in Conversation. |
| **Delete** | Löscht die Nachricht. |
| **Translate** / **Hide translation** (Übersetzen / Übersetzung ausblenden) | Übersetzt die Nachricht in deine Sprache und blendet die Übersetzung danach wieder aus. |
| **Add reaction** (Reaktion hinzufügen) | Öffnet eine Emoji-Auswahl. Nur in Conversation. |
| **Hide from AI** / **Unhide from AI** (vor der KI verbergen / wieder für die KI sichtbar machen) | Schickt diese Nachricht nicht mehr an das Modell oder wieder mit. In einem Roleplay-Gruppenchat öffnet sich eine Charakterauswahl. |
| **Bookmark, pin or note** (Lesezeichen, anheften oder Notiz) | Setzt ein Lesezeichen auf die Nachricht, heftet sie an, damit sie auch jenseits des Verlaufslimits im Prompt bleibt (bis zu 10 pro Chat), oder fügt eine **Private note** (private Notiz) hinzu. Das Modell sieht eine Notiz nie, es sei denn, du schaltest **Show the note to the narrator character** (Notiz dem Erzählercharakter zeigen) ein. Das funktioniert in Chats mit einem Charakter und in Gruppenchats mit einzelnen Antworten. |
| **Branch from here** (ab hier verzweigen) | Kopiert den Chat bis zu dieser Nachricht in eine neue Verzweigung. Nicht in Szenen-Chats. |
| **Clone from here** (ab hier klonen) | Kopiert einen Szenen-Chat bis zu dieser Nachricht in ein neues Roleplay. Nur in Szenen-Chats. |
| **Peek prompt** (Prompt einsehen) | Zeigt genau den Prompt für diese Antwort. Nur bei der neuesten KI-Nachricht. |
| **Stored guidance** (gespeicherte Vorgabe) | Zeigt die Vorgabe, die diese Antwort gelenkt hat. Nur bei Antworten, die mit einer Vorgabe oder per Impersonate entstanden sind. |
| **View model thoughts** (Gedanken des Modells anzeigen) | Öffnet die verborgene Gedankenspur des Modells. Nur wenn das Modell eine zurückgegeben hat. |
| **Show original before rewrite** / **Show rewritten version** (Original vor der Überarbeitung anzeigen / überarbeitete Fassung anzeigen) | Wechselt zwischen ursprünglichem und überarbeitetem Text, wenn ein Agent (ein Helfer, der neben den Antworten mitläuft) die Nachricht umgeschrieben hat. |
| **Mark as new start** (als neuen Anfang markieren) | Nur in Roleplay. Lässt das Gedächtnis des Modells für diesen Chat bei dieser Nachricht beginnen, wenn Advanced Memory (die Langzeitgedächtnis-Funktion von Marinara) eingeschaltet ist. Siehe [Advanced Memory](../agents/memory.md). |
| **Pause speaking** / **Resume speaking** / **Restart speaking** (Sprachausgabe anhalten / fortsetzen / neu starten) | Steuert die gesprochene Audioausgabe, wenn Text to Speech (eine Stimme liest Nachrichten vor) eingeschaltet ist und gerade spricht. |

Mehr dazu: [Peek Prompt](peek-prompt.md), [Chat-Verzweigungen](branches.md), [Szenen](../roleplay/scenes.md) (ein Szenen-Chat ist ein kurzes Roleplay, das von einem Chat abzweigt), [Nachrichtenübersetzung](../integrations/message-translation.md), [Text to Speech (TTS) einrichten](../media/tts-setup.md), [Geführte Generierung und Impersonate](guided-and-impersonate.md), [private Notizen](../roleplay/getting-started.md#your-private-notes).

## Eine Nachricht bearbeiten

1. Klick an der Nachricht auf **Edit**. Der Text wird zu einem bearbeitbaren Feld.
2. Ändere den Text.
3. Klick auf **Save** (Speichern) oder drück <kbd>Strg</kbd>+<kbd>Enter</kbd> (auf dem Mac <kbd>Cmd</kbd>+<kbd>Enter</kbd>).
4. Zum Abbrechen ohne Speichern klick auf **Cancel** (Abbrechen) oder drück <kbd>Esc</kbd>.

Mit zwei Einstellungen unter **Settings → General → Input & Editing** startest du eine Bearbeitung schneller. Beide sind standardmäßig an.

- **Up Arrow edits last message** (Pfeil nach oben bearbeitet die letzte Nachricht): Drück <kbd>Pfeil nach oben</kbd>, solange das Eingabefeld leer ist.
- **Double-click edits messages** (Doppelklick bearbeitet Nachrichten): Doppelklick oder Doppeltipp auf eine Roleplay-Nachricht.

## Eine Nachricht löschen

1. Klick an der Nachricht auf **Delete**. Das Dialogfenster **Delete message** (Nachricht löschen) öffnet sich.
2. Wähl eine Option.

| Option | Funktion |
| --- | --- |
| **Delete only this swipe (1/3)** | Entfernt den Swipe, den du gerade siehst. Erscheint nur bei mehr als einem Swipe. |
| **Delete all other swipes** (alle anderen Swipes löschen) | Behält den Swipe, den du gerade siehst, und entfernt den Rest. Erscheint nur bei mehr als einem Swipe. |
| **Delete this message** (diese Nachricht löschen) | Entfernt die Nachricht samt allen Swipes. |
| **Delete more** (mehr löschen) | Wählt diese Nachricht und alle darunter aus und öffnet die Auswahlleiste. |
| **Cancel** | Schließt das Dialogfenster. |

In der Auswahlleiste fügst du Nachrichten per Klick hinzu. **Select all messages above** (alle Nachrichten darüber auswählen) und **Select all messages below** (alle Nachrichten darunter auswählen) erweitern die Auswahl, **Unselect all** (Auswahl aufheben) leert sie, und **Delete selected** (ausgewählte löschen) entfernt die ausgewählten Nachrichten. Die Leiste zeigt, wie viele ausgewählt sind.

Systemnachrichten wie die Zeile „joined the chat“ löschst du mit einem Klick, ganz ohne Dialogfenster.

## Swipes: alternative Antworten

Ein Swipe ist eine Fassung einer KI-Antwort. Eine Nachricht kann mehrere davon enthalten, sodass du Antworten vergleichen und die behalten kannst, die dir gefällt. Sobald eine Nachricht zwei oder mehr hat, erscheint eine Swipe-Steuerung. Sie zeigt den aktiven Swipe und die Gesamtzahl, etwa „2/4“.

- **Previous swipe** (voriger Swipe) und **Next swipe** (nächster Swipe) blättern durch die Swipes.
- Das Zahlenfeld springt zu einem Swipe. Tipp eine Nummer ein und drück <kbd>Enter</kbd>. Seine Beschriftung lautet **Jump to swipe 1-N**.
- Beim neuesten Swipe wird die Vorwärts-Schaltfläche zu **Generate next swipe** (nächsten Swipe generieren) und erzeugt einen neuen Swipe.

Den letzten Swipe kannst du nicht löschen. Die App meldet dann „Cannot delete the last remaining swipe“. Nimm stattdessen **Delete this message**.

## Neu generieren, fortsetzen und erneut versuchen

Diese drei sehen ähnlich aus, tun aber Unterschiedliches.

| Aktion | Ergebnis |
| --- | --- |
| **Regenerate** | Ein neuer Swipe. Das Original bleibt erhalten. Auf einem Touchscreen fragt die App zuerst „Regenerate this message as a new swipe?“. Ist eine Vorgabe aktiv, heißt die Schaltfläche **Regenerate (guided)**. |
| `/continue` | Mehr Text in derselben Nachricht, ohne neuen Swipe. |
| Leeres **Send** (Senden) | Eine frische Antwort. |

### Eine Antwort fortsetzen

Tipp `/continue` (oder `/cont`) ins Eingabefeld und schick es ab. Das Modell macht dort weiter, wo seine letzte Antwort aufgehört hat.

```text
/continue
```

Marinara setzt eine Leerzeile vor den neuen Text. Soll er direkt am letzten Zeichen ansetzen, schalte **Settings → General → Responses → Add a new line before /continue text** aus.

### Mit leerem Send erneut versuchen

Ist die letzte Nachricht von dir und das Eingabefeld leer, versucht **Send** es erneut, statt etwas zu senden. In Roleplay startet ein leeres **Send** außerdem einen neuen Zug, wenn die KI schon geantwortet hat. Es ergänzt nie die vorherige Antwort. Siehe [Nachrichten senden und streamen](sending-and-streaming.md#retry-without-retyping).

## Eine Nachricht vor der KI verbergen

Klick auf **Hide from AI**, um eine Nachricht in späteren Zügen aus dem Prompt herauszuhalten. Für dich bleibt sie sichtbar, mit der Markierung **Hidden from AI**. Klick auf **Unhide from AI**, um sie wieder mitzuschicken.

In einem Roleplay-Gruppenchat öffnet **Hide from AI** eine Avatar-Auswahl. Wähl den Gruppen-Avatar, um die Nachricht vor allen zu verbergen, oder einen oder mehrere Charaktere, um sie nur vor diesen zu verbergen. Eine durchgestrichene Augenmarkierung an der Nachricht zeigt, wer sie nicht sehen kann. In einem Chat mit nur einem Charakter verbirgt die Schaltfläche die Nachricht direkt oder macht sie wieder sichtbar.

Verbirgst du eine Nachricht vor einem Charakter, erhält er eine Flüsternachricht darin trotzdem, aber nichts vom Rest. Verbirgst du sie vor allen, entfallen auch die Flüsternachrichten. Siehe [Flüstern und Geheimnisse](../roleplay/getting-started.md#whispers-and-secrets).

Einen Bereich verbirgst du mit `/hide` und `/unhide`. Siehe [Slash-Befehle](slash-commands.md). Die Nachrichtennummern beginnen bei 1 mit der ersten Nachricht.

Ist in Advanced Memory **Decide who sees new messages** (entscheiden, wer neue Nachrichten sieht) eingeschaltet, werden neue Nachrichten in einem Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, automatisch vor abwesenden Charakteren verborgen. Deine eigene Auswahl hat immer Vorrang. Siehe [Entscheiden, wer neue Nachrichten sieht](../agents/memory.md#deciding-who-sees-new-messages).

<a id="message-display-toggles"></a>

## Anzeigeschalter für Nachrichten

Diese Schalter findest du unter **Settings → Advanced → Message Tools**.

| Schalter | Standard | Was er zeigt |
| --- | --- | --- |
| **Show message numbers** (Nachrichtennummern anzeigen) | Aus | Eine Nummer an jeder Nachricht – dieselben Nummern, die `/goto`, `/hide` und `/unhide` verwenden. |
| **Show token usage on messages** (Token-Verbrauch an Nachrichten anzeigen) | Aus | Prompt- und Antwort-Tokens jeder KI-Antwort (Tokens sind kleine Textstücke, die das Modell zählt), dazu Cache-Treffer und Antwortzeit, wenn verfügbar. |
| **Show model name on messages** (Modellnamen an Nachrichten anzeigen) | Aus | Das Modell, das die jeweilige Antwort geschrieben hat. |
| **Show "older messages not sent" note** (Hinweis „ältere Nachrichten nicht gesendet“ anzeigen) | An | Einen Hinweis unter einer Antwort, etwa „1109 older messages not sent“, wenn ältere Nachrichten nicht in den Prompt gepasst haben. Hinweise auf eine abgeschnittene oder leere Antwort erscheinen immer. |
