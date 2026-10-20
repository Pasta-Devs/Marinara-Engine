# Peek Prompt: Sieh nach, was die KI bekommen hat

Peek Prompt zeigt dir genau den Text, den Marinara Engine für eine Antwort an das KI-Modell geschickt hat. Möglich ist außerdem eine Live-Vorschau des Prompts, bevor überhaupt etwas rausgeht. In dieser Anleitung erfährst du, was das Fenster anzeigt, wie du es öffnest, wie du **Stored guidance** (gespeicherte Anweisung) liest und wie du damit Antworten analysierst.

Ein Prompt ist der komplette Block aus Anweisungen und Chatverlauf, den Marinara zusammenbaut und an das Modell schickt. Das Modell liest diesen Prompt und schreibt eine Antwort. Mit Peek Prompt siehst du den fertig zusammengesetzten Block – damit bleibt an keiner Antwort etwas rätselhaft.

## Was Peek Prompt anzeigt

Beim Öffnen von Peek Prompt erscheint ein Fenster mit dem Titel **Assembled Prompt** (zusammengesetzter Prompt). Es besteht aus drei Teilen.

Oben neben dem Titel sitzt ein Quellen-Badge. Er sagt dir, welche Version des Prompts du gerade vor dir hast:

- **Exact Text Model Request**: die wörtliche Anfrage, die an das Modell ging.
- **Live Preview**: eine Vorschau, die gerade eben neu erzeugt wurde.
- **Raw Messages**: die rohe Liste der Nachrichten.
- **Prompt Preview**: eine allgemeine Vorschau.
- **Decision test preview**: ein Prompt mit den Antworten eines ausdrücklich gestarteten Entscheidungstests. Er wurde nicht an das Chat-Modell gesendet.

Unter dem Badge liegt ein Panel mit Infos zur Generierung. Dort stehen Anbieter und Modellname, eine geschätzte Anzahl an Tokens und – sobald eine Antwort fertig ist – die echte Token-Zahl des Prompts. Ein Token ist ein kleines Textstück; Modelle zählen damit statt in Wörtern. Das Panel zeigt außerdem kleine Tags für die verwendeten Werte, etwa **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** und **Assistant Prefill**. Auch Sampling-Werte wie **Top P**, **Top K** und **Min P** können hier auftauchen.

Der Rest des Fensters ist der Prompt selbst, aufgeteilt in ausklappbare Abschnitte. Jeder Abschnitt hat eine Beschriftung und eine eigene grobe Token-Schätzung. Die Chat-Nachrichten stehen gesammelt im Abschnitt **Chat History**. Bei einer exakt gespeicherten Anfrage kann der Anbieter mehrere Chat-Züge zu einem einzigen Block zusammengefasst haben. Klapp jeden Block auf, um den gesamten für das Modell sichtbaren Text darin zu prüfen. Ein Klick auf die Abschnittsüberschrift öffnet oder schließt sie.

Willst du den ganzen Prompt woanders verwenden, klick oben im Fenster auf die Kopier-Schaltfläche neben der Schaltfläche zum Schließen. Sie kopiert jeden Abschnitt und jede Chat-Nachricht als reinen Text, in der Reihenfolge, in der sie gesendet wurden, auch Abschnitte, die du nicht aufgeklappt hast. Jede Nachricht beginnt mit einer Zeile, die ihre Rolle nennt, etwa `[system]`, `[user]` oder `[assistant]`. Bei einer exakt gespeicherten Anfrage kopiert sie diese gespeicherte Anfrage so, wie sie gesendet wurde. Das Kopieren schickt nichts an das Modell und ändert den Prompt nicht.

## Peek Prompt öffnen

Es gibt zwei Wege zum Fenster.

Der erste führt über die Aktionsleiste einer Nachricht. So geht's:

1. Zeig mit der Maus auf die neueste KI-Nachricht im Chat.
2. Such die Aktion **Peek prompt** (Prompt einsehen). Ihr Symbol ist eine Lupe.
3. Klick darauf. Das Fenster **Assembled Prompt** öffnet sich.

Die Aktion **Peek prompt** erscheint nur bei der letzten KI-Nachricht im Chat. Bei älteren Nachrichten fehlt sie.

Der zweite Weg ist ein getippter Kurzbefehl. Er funktioniert schon, bevor eine KI-Antwort existiert – so lässt sich der Prompt vorab ansehen. So geht's:

1. Klick in das Eingabefeld für Nachrichten.
2. Tipp genau diesen Text:

```
{{prompt}}
```

3. Drück Enter oder klick auf Send.

Statt eine Nachricht zu senden, leert Marinara das Feld und öffnet das Peek-Prompt-Fenster. Die Kurzbefehle `{{prompt_preview}}` und `{{preview_prompt}}` bewirken dasselbe.

## Stored guidance lesen

Mit Guided Generation steuerst du eine Antwort über eine Anweisung außerhalb der Rolle. Entstand eine Nachricht mit einer gespeicherten Anweisung, trägt sie zusätzlich die Aktion **Stored guidance**. Ihr Symbol ist eine kleine Schriftrolle. Auch Nachrichten aus dem Befehl `/impersonate` haben diese Aktion.

Ein Klick auf **Stored guidance** öffnet ein Fenster mit der Anweisung, die für diese Nachricht galt. Bei einer gesteuerten Nachricht zeigt das Fenster zugleich die Herkunft der Anweisung:

- **/guided**: du hast den Slash-Befehl `/guided` benutzt.
- **Guided regenerate**: du hast die Nachricht mit einer getippten Anweisung neu generiert.
- **Game start**: die Anweisung stammt aus der Einrichtung des Game Mode.

Die Schaltfläche **Copy /guided** (als /guided kopieren) erscheint nur bei Anweisungen vom Typ **/guided** und **Guided regenerate**. Sie kopiert die Anweisung als `/guided`-Befehl heraus. Diesen Befehl kannst du später einfügen und dieselbe Steuerung erneut verwenden. Bei **Game start** fehlt die Schaltfläche.

Bei einer Nachricht aus `/impersonate` zeigt das Fenster statt einer einzelnen Anweisung die Details der Verkörperung. Den vollständigen Ablauf von Guided Generation und Impersonate beschreibt die unten verlinkte Anleitung.

## Antworten mit Peek Prompt analysieren

Für eine unerwartete Antwort ist Peek Prompt das beste Werkzeug. Greif darauf zurück, wenn ein Charakter etwas vergisst, eine Regel ignoriert oder aus der Rolle fällt.

Öffne das Fenster **Assembled Prompt** und prüf diese Punkte:

- Halt Ausschau nach fehlenden Informationen. Steht ein Lorebook-Eintrag, eine Erinnerung oder ein Detail der Persona in keinem Abschnitt, hat das Modell es nie gesehen.
- Sieh dir die Parameter-Tags an. Ein sehr hoher Wert bei **Temperature** macht Antworten zufällig, ein niedriger bei **Max Output Tokens** schneidet sie ab.
- Klapp den Abschnitt **Chat History** auf. Prüf, ob die erwarteten Nachrichten da sind und in der richtigen Reihenfolge stehen.
- Lies nach der Antwort die echte Token-Zahl. Ein sehr großer Prompt drängt ältere Nachrichten aus dem Limit des Modells.

Sobald du weißt, was das Modell tatsächlich bekommen hat, lässt sich die Ursache beheben. Vielleicht überarbeitest du eine Charakterkarte, passt einen Lorebook-Eintrag an oder änderst einen Wert in den Parametern für die Generierung.

<a id="testing-decision-statements"></a>

## Entscheidungsaussagen testen

Öffne in Peek Prompt **Decision diagnostics** (Entscheidungsdiagnose), um die Prompt-Aussagen und Lorebook-Entscheidungen des aktuellen Chats zu prüfen. Das Öffnen des Panels oder **Preview inputs** (Eingaben ansehen) bereitet die Anfrageinhalte vor, ohne das Decision-Modell zu fragen oder ein lokales Modell zu starten. Klapp **Prepared request bodies** (vorbereitete Anfrageinhalte) auf, um die jüngsten Nachrichten, aufgelösten Aussagen, Optionen und das modellspezifische Anfrageformat zu sehen. Weitere Lorebook-Aussagen können erst erreichbar werden, nachdem eine frühere Entscheidung beantwortet wurde.

Wähle **Test decisions** (Entscheidungen testen), um die zulässigen Fragen an dein ausgewähltes Decision-Modell zu senden. Dabei werden echte Entscheidungsanfragen gestellt, für die ein gehostetes Modell Gebühren berechnen kann. Der Test erzeugt keine Chat-Antwort, führt keine Agenten aus, verändert keinen Spielzustand und speichert weder seine Antworten noch seine Zeitsteuerung im Chat.

Ein ausdrücklich gestarteter Test kann auf ein lokales Reasoning-Modell warten, selbst wenn gewöhnliche Entscheidungen vor der Antwort aufgeschoben werden. Deine Einstellung für laufende Antworten bleibt dabei erhalten; die Eingabevorschau sendet weiterhin keine Modellanfragen.

Jedes Ergebnis zeigt, soweit verfügbar, seinen Wert, den Schwellenwert für eine Ja/Nein-Aussage und die daraus folgende Antwort. Gibt ein Modell nur ein Ja/Nein-Wort zurück, wird das entsprechend gekennzeichnet; seine Antwort wird nicht als Wahrscheinlichkeit dargestellt. Choice-Ergebnisse zeigen die gewählte Option. Für gehaltene, aufgeschobene, über dem Limit liegende, nicht verfügbare und fehlgeschlagene Entscheidungen gibt es eigene Erklärungen, damit eine fehlende Antwort nicht mit einem niedrigen Wert verwechselt wird.

Nach einem Test verwendet der Prompt darunter dessen Antworten. Mit **Show original prompt** (ursprünglichen Prompt anzeigen) kehrst du zum ursprünglich geöffneten Inhalt zurück; **Show tested prompt** (getesteten Prompt anzeigen) wechselt wieder zur Testfassung. **Requests sent and results** (gesendete Anfragen und Ergebnisse) zeigt die tatsächlichen Entscheidungsanfragen und ihre Ergebnisse, ohne Authentifizierungsheader.

Tests verwenden den aktuellen Chat und die aktuellen Einstellungen, auch wenn du Peek Prompt über eine ältere Antwort geöffnet hast. Sie rekonstruieren die ursprünglichen Entscheidungsanfragen nicht. Tests prüfen Prompt-Aussagen und Lorebook-Entscheidungen; Agentenaktivierung und Entscheidungen nach der Antwort werden nicht ausgeführt. Gewöhnliches Peek Prompt bleibt passiv, bis du ausdrücklich **Test decisions** wählst.

Ist **Use Decision model** (Decision-Modell verwenden) für Advanced Memory aktiviert, zeigt das Panel außerdem **Advanced Memory activity** (Advanced-Memory-Aktivität). Diese gespeicherten Berichte beschreiben den letzten Abruf und die letzte Prüfung auf ein Szenenende mit Modell, Zeit, Werten, Auswahl und verwendetem Ersatzverfahren. Sie können auch ohne Entscheidungsaussagen im Prompt erscheinen. Sie beschreiben tatsächlich erfolgte Aufrufe, nicht die aktuelle Vorschau oder eine Wiederholung der ausgewählten historischen Antwort. Kompatible Swipes können einen früheren Abrufbericht wiederverwenden. Pro Bericht werden bis zu 128 Ergebnisse gespeichert, ausgewählte Ergebnisse zuerst; ausgelassene Ergebnisse werden gezählt. Neue Berichte erscheinen nach dem nächsten zulässigen Decision-Modell-Aufruf. Ihre Anzeige stellt keine Modellanfragen.

## Verwandte Anleitungen

- [Parameter für die Generierung](../prompts/generation-parameters.md)
- [Preset-Editor und Prompt Manager](../prompts/presets.md)
- [Decision-Modelle](../connections/decision-models.md)
- [Guided Generation und Impersonate](guided-and-impersonate.md)
- [Nachrichten-Aktionen: Bearbeiten, Löschen, Swipe, Neu generieren](messages.md)
