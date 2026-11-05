# Peek Prompt: Sieh nach, was die KI bekommen hat

Peek Prompt zeigt genau den Text, den Marinara Engine für eine Antwort an das Modell geschickt hat, oder eine Live-Vorschau der nächsten. Nutze es, wenn eine Antwort nicht deinen Erwartungen entspricht und du wissen willst, was das Modell gesehen hat.

Der Prompt ist der komplette Block aus Anweisungen und Chatverlauf, den Marinara zusammenstellt und abschickt. Das Modell liest ihn und schreibt die Antwort.

## Peek Prompt öffnen

Das Fenster **Assembled Prompt** (zusammengesetzter Prompt) öffnest du auf zwei Wegen.

Über eine Nachricht:

1. Tipp auf die neueste KI-Nachricht, damit ihre Aktionsleiste erscheint.
2. Klick auf **Peek prompt** (Prompt einsehen), eine Lupe.

Die Aktion erscheint nur bei der letzten KI-Nachricht. Ältere Nachrichten zeigen sie nicht.

Über das Eingabefeld – das klappt auch, bevor es überhaupt eine KI-Antwort gibt:

1. Tipp genau diesen Text ins Nachrichtenfeld: `{{prompt}}`
2. Drück <kbd>Enter</kbd> oder klick auf **Send** (Senden).

Marinara leert das Feld und öffnet das Fenster, statt eine Nachricht zu senden. `{{prompt_preview}}` und `{{preview_prompt}}` bewirken dasselbe.

## Was das Fenster zeigt

Ein Badge neben dem Titel sagt dir, welche Version des Prompts du liest.

| Badge | Bedeutung |
| --- | --- |
| **Exact Text Model Request** | Die wörtliche Anfrage, die an das Modell ging. |
| **Live Preview** | Eine Vorschau, die gerade eben erstellt wurde. |
| **Raw Messages** | Die rohe Liste der Nachrichten. |
| **Prompt Preview** | Eine allgemeine Vorschau. |
| **Decision test preview** | Ein Prompt mit den Antworten aus einem Entscheidungstest. Er wurde nicht an das Chat-Modell gesendet. |

Darunter kann ein Info-Panel den Dienst und das Modell zeigen, eine geschätzte Token-Zahl und, sobald eine Antwort fertig ist, die echte Token-Zahl des Prompts. Ein Token ist ein kleines Textstück; Modelle zählen in Tokens statt in Wörtern. Außerdem zeigt das Panel Tags für die verwendeten Werte, etwa **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** und **Assistant Prefill**, sowie Sampling-Werte wie **Top P**, **Top K** und **Min P**. Tags wie **Service Tier** und **Assistant Prefill** und die Sampling-Werte sind fortgeschrittene Modelleinstellungen. Am Anfang kannst du sie ignorieren. Ist das erste Modell gescheitert und hat dein Fallback-Modell die Antwort geschrieben, nennt das Panel das gescheiterte Modell und einen kurzen Grund, etwa „key rejected“ oder „rate limited“.

Der Rest ist der Prompt in ausklappbaren Abschnitten, jeder mit seiner eigenen groben Token-Schätzung. Chat-Nachrichten stehen gesammelt unter **Chat History**. Bei einer exakt gespeicherten Anfrage kann der Dienst mehrere Chat-Züge zu einem Block zusammengefasst haben; klapp also jeden Block auf, um den ganzen Text zu sehen. Ein Klick auf eine Abschnittsüberschrift öffnet oder schließt den Abschnitt.

Eine **Exact Text Model Request** ist die Anfrage, so wie sie für diese Antwort gesendet wurde. Sie wurde gespeichert, bevor irgendetwas lief, was nach der Antwort kam, etwa eine automatische Zusammenfassung oder das Ausblenden von Nachrichten. Deshalb kann sie Nachrichten enthalten, die die nächste Antwort nicht bekommt. Klick auf **Show current context** (aktuellen Kontext anzeigen), um den Prompt aus dem Chat in seinem jetzigen Stand zusammenzustellen, ohne ihn zu senden. Klick auf **Show sent request** (gesendete Anfrage anzeigen), um zurückzukehren.

### Den Prompt kopieren

Klick auf die Kopier-Schaltfläche neben der Schaltfläche zum Schließen. Sie kopiert jeden Abschnitt und jede Nachricht als reinen Text in der gesendeten Reihenfolge, auch zugeklappte Abschnitte. Jede Nachricht beginnt mit einer Zeile, die ihre Rolle nennt, etwa `[system]`, `[user]` oder `[assistant]`. Bei einer exakt gespeicherten Anfrage kopiert sie die Anfrage so, wie sie gesendet wurde. Das Kopieren sendet nichts.

### Text im Prompt suchen

Nutze das Feld **Find** (Suchen) oben oder drück im Fenster <kbd>Strg</kbd>+<kbd>F</kbd> (auf dem Mac <kbd>Cmd</kbd>+<kbd>F</kbd>). Die Suche ignoriert Groß- und Kleinschreibung und durchsucht den ganzen Prompt, auch zugeklappte Abschnitte und den Chatverlauf. Der Zähler zeigt den aktuellen Treffer, etwa „2 of 5“. Mit den Schaltflächen nach oben und unten oder mit <kbd>Enter</kbd> und <kbd>Shift</kbd>+<kbd>Enter</kbd> wechselst du zwischen den Treffern. Nach dem letzten Treffer springt die Suche wieder zum ersten und umgekehrt. Solange in **Find** Text steht, zeigt das Fenster den vollständigen Nachrichtentext. Leere das Feld, um zu den Abschnitten zurückzukehren.

## Eine Antwort mit Reply checkup prüfen

Erkennt Marinara eine wahrscheinliche Ursache für eine schwache Antwort, zeigt das Fenster über dem Prompt das Panel **Reply checkup** (Antwortprüfung). Es kann melden:

- Die Charakterkarte ist groß und belegt einen großen Teil des Prompt-Budgets (**Large character card**).
- Die Antwort hat ihr Token-Limit erreicht und mitten im Satz aufgehört (**Cut off**).
- Das Modell hat keinen sichtbaren Text zurückgeschickt (**Empty reply**).
- Ältere Nachrichten wurden nicht gesendet, weil der Prompt nicht gepasst hat (**N older messages not sent**).
- Lorebook-Einträge haben gegriffen, passten aber nicht ins Budget (**N lorebook entries left out**).
- Das Antwortlimit wurde gesenkt, um Platz für den Prompt zu schaffen (**Reply limit cut**).

Wo es hilft, springt ein Link zu der Einstellung, die du ändern solltest, etwa **Max output tokens** oder **Lorebook token budget**.

## Eine unerwartete Antwort analysieren

Öffne **Assembled Prompt** und prüf:

- **Fehlende Informationen.** Steht ein Lorebook-Eintrag, eine Erinnerung oder ein Detail der Persona in keinem Abschnitt, hat das Modell es nie gesehen.
- **Parameter-Tags.** Ein hoher Wert bei **Temperature** kann Antworten zufällig machen, ein niedriger bei **Max Output Tokens** kann sie abschneiden.
- **Chat History.** Prüf, ob die erwarteten Nachrichten da sind, in der richtigen Reihenfolge.
- **Token-Zahl.** Ein großer Prompt kann ältere Nachrichten aus dem Limit des Modells drängen.

Behebe dann die Ursache: Überarbeite eine Charakterkarte, pass einen Lorebook-Eintrag an oder ändere eine Generierungseinstellung. Siehe [Generierungsparameter](../prompts/generation-parameters.md).

Die Vorgabe hinter einer gelenkten Antwort liest du über **Stored guidance** (gespeicherte Vorgabe) an der Nachricht. Siehe [Geführte Generierung und Impersonate](guided-and-impersonate.md#read-stored-guidance).

<a id="testing-decision-statements"></a>

## Entscheidungsaussagen testen

Ein [Decision-Modell](../connections/decision-models.md) beantwortet Ja-Nein-Fragen für Funktionen wie Lorebooks. Mit **Decision diagnostics** (Entscheidungsdiagnose) in Peek Prompt prüfst und testest du diese Fragen für den aktuellen Chat.

1. Öffne Peek Prompt und such **Decision diagnostics**.
2. Öffnest du den Bereich oder klickst du auf **Preview inputs** (Eingaben ansehen), werden die Anfrageinhalte vorbereitet, ohne ein Modell zu fragen. Klapp **Prepared request bodies** (vorbereitete Anfrageinhalte) auf, um die jüngsten Nachrichten, die aufgelösten Aussagen, die Optionen und das Anfrageformat zu sehen.
3. Klick auf **Test decisions** (Entscheidungen testen), um deinem Decision-Modell die zulässigen Fragen zu stellen.

**Test decisions** stellt echte Anfragen, für die ein gehostetes Modell Gebühren berechnen kann. Der Test schreibt keine Chat-Antwort, führt keine Agenten aus, ändert keinen Spielzustand und speichert weder seine Antworten noch seine Timer im Chat. Spätere Lorebook-Aussagen werden womöglich erst erreichbar, nachdem eine frühere beantwortet ist. Ein ausdrücklich gestarteter Test kann auf ein lokales Reasoning-Modell warten, selbst wenn gewöhnliche Entscheidungen vor der Antwort aufgeschoben werden. Deine Einstellung für laufende Antworten ändert das nicht.

Jedes Ergebnis zeigt seinen Wert, sofern es einen gibt, den Schwellenwert für eine Ja-Nein-Aussage und die Antwort. Ein Modell, das nur „Ja“ oder „Nein“ zurückgibt, wird entsprechend gekennzeichnet, und seine Antwort erscheint nicht als Wahrscheinlichkeit. Choice-Ergebnisse zeigen die gewählte Option. Gehaltene, aufgeschobene, über dem Limit liegende, nicht verfügbare und fehlgeschlagene Entscheidungen haben jeweils ihre eigene Erklärung.

Nach einem Test verwendet der Prompt darunter die Antworten des Tests. Klick auf **Show original prompt** (ursprünglichen Prompt anzeigen), um zu dem zurückzukehren, was du geöffnet hast, oder auf **Show tested prompt** (getesteten Prompt anzeigen), um wieder zurückzuwechseln. **Requests sent and results** (gesendete Anfragen und Ergebnisse) zeigt die tatsächlichen Anfrageinhalte und Ergebnisse, ohne Authentifizierungsheader.

Wenn es nicht funktioniert hat: **Could not prepare the decision test. Check the chat connection and try again.** Prüf, ob der Chat ein funktionierendes Modell hat, und versuch es dann erneut.

Tests verwenden den aktuellen Chat und die aktuellen Einstellungen, auch wenn du Peek Prompt über eine ältere Antwort geöffnet hast. Sie bauen die ursprünglichen Entscheidungsanfragen nicht nach. Sie decken Prompt-Aussagen und Lorebook-Entscheidungen ab, nicht die Agentenaktivierung oder Entscheidungen nach der Antwort.

Ist **Use Decision model** (Entscheidungsmodell verwenden) für Advanced Memory eingeschaltet (die Langzeitgedächtnis-Funktion von Marinara, siehe [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md)), zeigt das Panel außerdem **Advanced Memory activity** (Advanced-Memory-Aktivität). Diese gespeicherten Berichte zeigen den letzten Abruf und die letzte Prüfung auf ein Szenenende mit Modell, Zeit, Werten, Auswahl und Fallback-Status. Sie beschreiben vergangene Aufrufe, nicht die aktuelle Vorschau, und können auch erscheinen, wenn der Prompt keine Entscheidungsaussagen enthält. Kompatible Swipes können einen früheren Abrufbericht wiederverwenden. Jeder Bericht behält bis zu 128 Ergebnisse, ausgewählte zuerst, und zählt den Rest. Neue Berichte erscheinen nach dem nächsten zulässigen Aufruf des Decision-Modells. Ihre Anzeige stellt keine Modellanfragen.
