# Aktionen für Nachrichten: bearbeiten, löschen, Swipes, neu generieren

In dieser Anleitung erfährst du, was sich mit einer einzelnen Nachricht im Chat alles anstellen lässt. Sie erklärt die Nachrichten-Werkzeugleiste, das Bearbeiten und Löschen einer Nachricht sowie die Funktionsweise von Swipes und Neugenerieren. Dazu kommen die Anzeigeschalter für Token-Zahlen und Nachrichtennummern.

Jede Nachricht in Marinara Engine hat eine kleine Werkzeugleiste – egal, ob du sie geschrieben hast oder die KI. Am Computer erscheint sie, sobald der Mauszeiger über der Nachricht liegt; auf Handy oder Tablet beim Antippen.

## Die Nachrichten-Werkzeugleiste

Die folgenden Schaltflächen tauchen auf Nachrichten auf. Manche nur in bestimmten Situationen – die Tabelle sagt, wann. Zu jeder Schaltfläche gehört ein Tooltip (Kurzhinweis beim Draufzeigen) mit genau der hier genannten Beschriftung.

| Schaltfläche | Funktion | Wann sie erscheint |
| --- | --- | --- |
| **Copy** (kopieren) | Kopiert den Nachrichtentext. Das Symbol wird kurz zu einem Häkchen. | Immer |
| **Add reaction** (Reaktion hinzufügen) | Öffnet eine Emoji-Auswahl und schaltet die eigene Reaktion auf der Nachricht an oder aus. | Nur im Conversation Mode |
| **Translate** / **Hide translation** (übersetzen / Übersetzung ausblenden) | Übersetzt die Nachricht in deine Sprache und blendet die Übersetzung wieder aus. | Immer |
| **Edit** (bearbeiten) | Öffnet die Nachricht zum Bearbeiten. Mehr dazu weiter unten. | Immer |
| **Regenerate** (neu generieren) | Erzeugt einen neuen Swipe, also eine alternative Antwort. Mehr dazu weiter unten. | Bei KI-Nachrichten. Im Roleplay Mode auch bei deinen eigenen. Im Conversation Mode auch bei deinen Nachrichten, die per Impersonate entstanden sind |
| **Show original before rewrite** / **Show rewritten version** (Original vor der Überarbeitung anzeigen / überarbeitete Fassung anzeigen) | Wechselt zwischen dem ursprünglichen und dem überarbeiteten Text. Beide Fassungen bleiben erhalten, sodass du sie vergleichen und die bessere behalten kannst. | Nur nachdem ein Agent die Nachricht überarbeitet hat |
| **Hide from AI** / **Unhide from AI** (vor der KI verbergen / wieder sichtbar machen) | Schickt diese Nachricht in späteren Zügen nicht mehr an die KI – oder eben wieder. In einem Roleplay-Gruppenchat öffnet sich dabei eine Charakterauswahl. | Immer |
| **Peek prompt** (Prompt einsehen) | Zeigt genau den Prompt, den die KI für diese Antwort erhalten hat. | Nur bei der neuesten KI-Nachricht |
| **Stored guidance** (gespeicherte Vorgabe) | Zeigt die Vorgabe, die diese Antwort gelenkt hat. | Nur wenn die Antwort einer gelenkten Vorgabe folgte oder per Impersonate entstand |
| **Branch from here** (ab hier verzweigen) | Kopiert den Chat bis zu dieser Nachricht in eine neue Verzweigung. | Immer |
| **View model thoughts** (Gedanken des Modells anzeigen) | Öffnet den verborgenen Denktext des Modells. | Nur wenn das Modell einen Denktext geliefert hat |
| **Delete** (löschen) | Löscht die Nachricht. Mehr dazu weiter unten. | Immer |
| **Pause speaking** / **Resume speaking** / **Restart speaking** (Sprachausgabe anhalten / fortsetzen / neu starten) | Steuert die gesprochene Audioausgabe einer Nachricht. | Nur wenn Text to Speech aktiv ist und gerade spricht |

Zum Betrachter hinter **Peek prompt** siehe [Prompt einsehen](peek-prompt.md). Zu **Branch from here** siehe [Chat-Verzweigungen](branches.md). Zu **Translate** siehe [Nachrichten übersetzen](../integrations/message-translation.md). Zu den Sprachausgabe-Schaltflächen siehe [Text to Speech (TTS) einrichten](../media/tts-setup.md). Zu gelenkten Vorgaben, **Stored guidance** und Impersonate siehe [Gelenkte Generierung und Impersonate](guided-and-impersonate.md).

## Eine Nachricht bearbeiten

Der Text jeder Nachricht lässt sich bearbeiten – deiner ebenso wie der der KI.

1. Klick auf **Edit** an der Nachricht. Der Text wird zu einem Eingabefeld.
2. Ändere den Text.
3. Klick auf **Save** (speichern) oder drück Strg und Enter gleichzeitig (auf dem Mac Cmd und Enter). Der Tooltip lautet **Save (Cmd+Enter)**.
4. Zum Abbrechen ohne Speichern klick auf **Cancel** (abbrechen) oder drück die Esc-Taste. Der Tooltip lautet **Cancel (Esc)**.

Zwei Einstellungen bringen dich noch schneller in den Bearbeitungsmodus. Beide findest du unter **Settings** (Einstellungen) im Tab **General**, im Abschnitt **Input & Editing**.

- **Up Arrow edits last message** (Pfeiltaste nach oben bearbeitet die letzte Nachricht, standardmäßig an): Drück die Pfeiltaste nach oben, solange das Eingabefeld leer ist. Damit öffnet sich die jüngste Nachricht zum Bearbeiten.
- **Double-click edits messages** (Doppelklick bearbeitet Nachrichten, standardmäßig an): Ein Doppelklick oder Doppeltipp auf eine Roleplay-Nachricht öffnet sie zum Bearbeiten.

## Eine Nachricht löschen

Beim Löschen erscheint ein Fenster mit dem Titel **How to proceed?** (Wie soll es weitergehen?). Zur Auswahl stehen:

- **Delete only this swipe (1/3)**: Entfernt nur den gerade angezeigten Swipe. Diese Option gibt es nur, wenn die Nachricht mehr als einen Swipe hat. Die Zahlen zeigen den aktiven Swipe und die Gesamtzahl.
- **Delete this message**: Entfernt die ganze Nachricht samt allen Swipes.
- **Delete more**: Wählt diese Nachricht und alle darunter aus und schaltet die Mehrfachauswahl ein. So lässt sich die Auswahl vor dem Löschen noch anpassen.
- **Cancel**: Schließt das Fenster, ohne etwas zu löschen.

Systemnachrichten, etwa die Zeile „joined the chat“, haben eine einfache Löschschaltfläche ganz ohne Fenster.

## Swipes: alternative Antworten

Ein Swipe ist eine Fassung einer KI-Antwort. Eine einzelne Nachricht kann mehrere Swipes enthalten. So vergleichst du verschiedene Antworten auf denselben Zug und behältst die beste.

Sobald eine Nachricht zwei oder mehr Swipes hat, erscheint an ihr eine Swipe-Steuerung. Sie zeigt den aktiven Swipe und die Gesamtzahl, etwa „2/4“, und bietet:

- **Previous swipe** (voriger Swipe) und **Next swipe** (nächster Swipe): einen Schritt zurück oder vor durch die Swipes.
- Ein Zahlenfeld: Tipp eine Swipe-Nummer ein und drück Enter, um direkt dorthin zu springen. Der Tooltip lautet **Jump to swipe 1-N**, wobei N die Gesamtzahl ist.
- **Generate next swipe** (nächsten Swipe generieren): Beim neuesten Swipe verwandelt sich die Vorwärts-Schaltfläche in diese Funktion und erzeugt einen brandneuen Swipe.

Den letzten verbliebenen Swipe einer Nachricht kannst du nicht löschen. Beim Versuch meldet die App „Cannot delete the last remaining swipe“. Nimm stattdessen **Delete this message**, um die ganze Nachricht zu entfernen.

## Neu generieren, fortsetzen und erneut versuchen

Diese drei Aktionen ähneln sich, tun aber Unterschiedliches. Nimm die, die zu deinem Ziel passt.

**Regenerate** erzeugt einen neuen Swipe. Ein Klick darauf an einer KI-Nachricht erzeugt eine weitere Fassung dieser Antwort. Der ursprüngliche Swipe bleibt erhalten. Auf einem Touchscreen fragt die App zuerst „Regenerate this message as a new swipe?“, damit du es nicht versehentlich auslöst. Ist eine gelenkte Vorgabe aktiv, heißt die Schaltfläche **Regenerate (guided)**.

Der Befehl **/continue** verlängert dieselbe Nachricht. Tipp `/continue` (oder die Kurzform `/cont`) ins Eingabefeld und schick es ab. Die KI setzt dort an, wo die letzte Antwort aufhörte, und hängt weiteren Text an dieselbe Nachricht – statt einen neuen Swipe anzulegen.

Standardmäßig setzt Marinara eine Leerzeile vor den ergänzten Text. Soll die Fortsetzung direkt am letzten Zeichen der vorherigen Antwort ansetzen, deaktiviere **Settings → General → Responses → Add a new line before /continue text**. Marinara weist das Modell dann an, exakt an der Abbruchstelle ohne Trenner weiterzuschreiben.

```
/continue
```

Ein leeres Absenden startet dagegen eine frische Antwort. Stammt die letzte Nachricht im Chat von dir und ist das Eingabefeld leer, versucht dieselbe Schaltfläche **Send** (senden) es erneut, statt etwas zu senden. Ihr Aussehen ändert sich dabei nicht. Ein Klick darauf oder Enter holt eine Antwort, ohne dass du deine Nachricht neu tippen musst. Im Roleplay Mode kann ein leeres **Send** die KI außerdem dazu anstupsen, die Szene mit einem neuen Zug weiterzuführen. Das ist etwas anderes als **/continue**: Ein leeres Absenden erzeugt immer eine neue Antwort, **/continue** ergänzt die vorhandene.

## Eine Nachricht vor der KI verbergen

Der KI-Kontext ist die Menge an Nachrichten, die die App in jedem Zug an die KI schickt. Ein Klick auf **Hide from AI** hält eine Nachricht in künftigen Zügen aus diesem Kontext heraus. Für dich bleibt sie sichtbar und trägt die Markierung **Hidden from AI**. Mit **Unhide from AI** wandert sie wieder mit.

In einem Roleplay-Gruppenchat mit mehreren Charakteren öffnet **Hide from AI** eine kompakte Avatar-Auswahl. Wähl den Gruppen-Avatar, um die Nachricht vor allen zu verbergen, oder einen oder mehrere Charakter-Avatare, um sie nur vor diesen Charakteren zu verbergen. Die Auswahl „alle“ hebt einzelne Markierungen auf; wählst du einen einzelnen Charakter, schaltet sich „alle“ ab. Die durchgestrichene Augenmarkierung an der Nachricht zeigt die Avatare der Charaktere, die sie nicht sehen. In einem Chat mit nur einem Charakter verbirgt die Schaltfläche die Nachricht weiterhin direkt oder macht sie wieder sichtbar.

Enthält eine Nachricht eine Flüsternachricht, erreicht diese ihren Empfänger auch dann, wenn du die Nachricht nur vor diesem Charakter verbirgst. Er erhält die Flüsternachricht, aber nichts vom Rest der Nachricht. Verbirgst du die Nachricht vor allen, entfallen auch ihre Flüsternachrichten. Mehr dazu unter [Flüstern und Geheimnisse](../roleplay/getting-started.md#whispers-and-secrets).

Du kannst Nachrichten auch mit `/hide [range] [name (optional)]` verbergen, zum Beispiel `/hide 3-8`. In Roleplay verbirgt `/hide 3-8 Maukie` sie nur vor Maukie; ohne Namen werden sie vor allen verborgen. `/unhide [range]` stellt global verborgene Nachrichten wieder her. Um das Verbergen vor einzelnen Charakteren aufzuheben, verwende die Avatar-Auswahl in einem Roleplay-Gruppenchat oder **Unhide from AI** an der Nachricht in einem Roleplay-Chat mit nur einem Charakter. Die Nummerierung beginnt bei 1, gezählt ab der ersten Nachricht im Chat. Formate und Beispiele findest du in der [Referenz der Slash-Befehle](slash-commands.md).

Ist in Advanced Memory **Decide who sees new messages** (entscheiden, wer neue Nachrichten sieht) eingeschaltet, werden neue Nachrichten in einem Gruppenchat, in dem die Charaktere einzeln nacheinander antworten, automatisch vor abwesenden Charakteren verborgen, mit derselben Markierung. Änderst du die Auswahl einer Nachricht selbst, hat das immer Vorrang; siehe [Entscheiden, wer neue Nachrichten sieht](../agents/memory.md#deciding-who-sees-new-messages).

## Anzeigeschalter für Nachrichten

Zwei Schalter steuern, welche Zusatzinfos an Nachrichten erscheinen. Beide findest du unter **Settings** im Tab **Advanced**, im Abschnitt **Message Tools**. Beide sind standardmäßig aus.

- **Show message numbers** (Nachrichtennummern anzeigen): Blendet an jeder Nachricht eine Nummer ein. Gezählt wird ab 1, beginnend bei der ersten Nachricht im Chat. Es sind dieselben Nummern, die die Befehle `/goto`, `/hide` und `/unhide` verwenden. Schalte das ein, wenn du eine Nachrichtennummer brauchst.
- **Show token usage on messages** (Token-Verbrauch an Nachrichten anzeigen): Ergänzt KI-Antworten um eine Token-Zahl pro Nachricht. Ein Token ist ein kleines Textstück, das die KI liest und schreibt. Angezeigt werden die Tokens des Prompts und die der Antwort. Wenn verfügbar, kommen noch Cache-Treffer und die Dauer der Antwort dazu.

Ein verwandter Schalter im selben Abschnitt **Message Tools** ist **Show model name on messages** (Modellnamen an Nachrichten anzeigen). Er ergänzt den Namen des KI-Modells, das die jeweilige Antwort geschrieben hat, und ist ebenfalls standardmäßig aus.

Mussten ältere Nachrichten aus dem Prompt herausbleiben, damit er passt, nennt ein kurzer Hinweis unter der Antwort ihre Zahl, zum Beispiel „1109 older messages not sent“. Um diesen Hinweis unter der Antwort auszublenden, schalte im selben Abschnitt **Show "older messages not sent" note** (Hinweis „ältere Nachrichten nicht gesendet“ anzeigen) aus. Öffnest du den Checkup, kann er dort weiterhin erscheinen. Standardmäßig ist der Hinweis an. Hinweise auf eine abgeschnittene oder leer zurückgekommene Antwort erscheinen weiterhin.

## Verwandte Anleitungen

- [Nachrichten senden und Streaming](sending-and-streaming.md)
- [Gelenkte Generierung und Impersonate](guided-and-impersonate.md)
- [Prompt einsehen](peek-prompt.md)
- [Chat-Verzweigungen](branches.md)
- [Text to Speech (TTS) einrichten](../media/tts-setup.md)
- [Nachrichten übersetzen](../integrations/message-translation.md)
- [Einstellungen im Überblick](../settings/settings-overview.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
