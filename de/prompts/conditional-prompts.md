# Bedingte Prompts ({{#if}})

In dieser Anleitung erfährst du, wie du `{{#if}}`-Blöcke in Marinara Engine einsetzt. Mit einem Bedingungsblock landet ein Stück Text nur dann im Prompt, wenn ein Wert einer Regel entspricht, die du festlegst. Bedingungen gehören zum Makro-System und funktionieren deshalb überall dort, wo auch Makros funktionieren: in Charakterkarten, Personas, Lorebook-Einträgen und Prompt-Presets.

## Wozu bedingte Prompts gut sind

Ein Makro ist ein `{{double-brace}}`-Platzhalter, den Marinara Engine beim Zusammenbauen des Prompts durch einen aktuellen Wert ersetzt. Ein Bedingungsblock geht noch einen Schritt weiter: Er prüft einen Wert, behält ein Stück Text und verwirft den Rest.

Du schreibst eine Bedingung, den Text für den zutreffenden Fall und optional den Text für den nicht zutreffenden Fall. Marinara wertet die Bedingung bei jedem Prompt-Aufbau neu aus. Dieselbe Karte und dasselbe Preset verhalten sich dadurch je nach Charakter, Persona oder Chat unterschiedlich.

Häufig genutzt wird das für charakterspezifische Anweisungen innerhalb eines gemeinsamen Presets. Ebenso häufig: ein Feld nur dann mitschicken, wenn es Inhalt hat – damit keine leere Beschriftung beim Modell ankommt.

## Die Grundsyntax

Ein Bedingungsblock beginnt mit `{{#if condition}}` und endet mit `{{/if}}`. Alles dazwischen ist der Text für den zutreffenden Fall.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

Für den nicht zutreffenden Fall lässt sich ein `{{else}}`-Zweig ergänzen:

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

Mit `{{else if}}` hängst du weitere Bedingungen an. Marinara prüft die Zweige von oben nach unten. Der erste Zweig mit zutreffender Bedingung bleibt stehen, die Makros darin werden aufgelöst, alle anderen Zweige fallen weg. Trifft keine Bedingung zu und fehlt ein `{{else}}`, ergibt der ganze Block nichts.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Ein Block darf sich wie oben über mehrere Zeilen ziehen oder in einer einzigen Zeile stehen. Und du kannst eine Bedingung in den Zweig einer größeren Bedingung verschachteln.

## Verfügbare Operatoren

Eine Bedingung besteht meist aus einem linken Wert, einem Operator und einem rechten Wert, etwa `char == "Alice"`. Die folgende Tabelle listet alle Operatoren auf, die du verwenden kannst. Jeder Operator steht in Code-Schrift.

| Operator | Bedeutung |
| --- | --- |
| `==`, `=`, `is` | Gleich. |
| `!=`, `is not` | Ungleich. |
| `>` | Größer als (nur Zahlen). |
| `<` | Kleiner als (nur Zahlen). |
| `>=` | Größer als oder gleich (nur Zahlen). |
| `<=` | Kleiner als oder gleich (nur Zahlen). |
| `contains`, `includes` | Der linke Wert enthält den rechten Wert als Text. |
| `not contains`, `not includes` | Der linke Wert enthält den rechten Wert nicht. |

Für den Vergleich gelten ein paar Regeln:

1. Bei `==`, `=`, `is`, `!=` und `is not` vergleicht Marinara beide Seiten als Zahlen, sofern beide wie Zahlen aussehen. `5` ist also gleich `5.0`. Andernfalls zählt der Textvergleich, ohne Rücksicht auf Groß- und Kleinschreibung. `Mari` ist also gleich `mari`.
2. Bei `>`, `<`, `>=` und `<=` müssen beide Seiten Zahlen sein. Ist eine Seite keine Zahl, trifft die Bedingung nicht zu.
3. Bei `contains`, `includes`, `not contains` und `not includes` spielt Groß- und Kleinschreibung keine Rolle. `contains "dr"` passt also auf den Text `Dr Smith`.

## Bedingungen mit ODER und UND verknüpfen

Nimm `||`, wenn eine der Bedingungen zutreffen darf. Nimm `&&`, wenn alle zutreffen müssen.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` wird vor `||` ausgewertet. Mit Klammern legst du die Reihenfolge ausdrücklich fest:

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Prüfst du denselben Wert auf mehrere Alternativen, darfst du die wiederholte linke Seite nach `||` weglassen:

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

Diese Kurzform bedeutet `character == "Maukie" || character == "Pantalone"`. Sie gilt für die Gleichheitsoperatoren `==`, `=` und `is`. Rund um `&&` schreibst du besser vollständige Bedingungen, denn ein Wert entspricht kaum je zwei verschiedenen Alternativen gleichzeitig.

### Truthy-Prüfungen (ohne Operator)

Steht in der Bedingung kein Operator, führt Marinara eine Truthy-Prüfung durch. Sie beantwortet eine einfache Frage: Steckt in diesem Wert überhaupt echter Inhalt?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

Eine Truthy-Prüfung trifft zu, wenn der Wert nicht leer ist und keines dieser Wörter ist: `false`, `0`, `no`, `off`, `null` oder `undefined`. Groß- und Kleinschreibung spielt dabei keine Rolle. Nimm eine Truthy-Prüfung, wenn ein Text nur bei ausgefülltem Feld mitgehen soll.

### Was sich vergleichen lässt

Links oder rechts in einer Bedingung steht eines der folgenden Elemente:

1. Ein Feld- oder Identitäts-Schlüsselwort wie `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input` oder `model`. Diese lesen dieselben Werte wie die passenden Makros. `group` listet die übrigen aktiven Charaktere im Chat auf, ohne den gerade antwortenden Charakter.
2. Ein Literal in Anführungszeichen, etwa `"Alice"`.
3. Der Name einer Preset-Variablen, etwa `length`. Eine Preset-Variable ist ein benannter Wert, den du in einem Prompt-Preset festlegst. Siehe [Preset-Variablen](preset-variables.md).
4. Ein ausdrücklicher Variablenzugriff in der Form `var:name` oder `var.name`.
5. Ein weiteres Makro, dessen Wert zuerst aufgelöst und dann verglichen wird.
6. Eine Frage an dein Decision-Modell als `decision:"..."` oder `decision_choice:"..."`. Siehe [Das Decision-Modell fragen](#asking-the-decision-model).

Schreibst du ein bloßes Wort, das kein Schlüsselwort ist, behandelt Marinara es als Variablennamen. Existiert keine Variable dieses Namens, gilt das Wort als schlichter Text. Anführungszeichen um feste Werte räumen diese Unklarheit aus – setz sie im Zweifel.

## Regeln für Anführungszeichen

Vergleichst du mit einem festen Text, gehört dieser in Anführungszeichen. Das sagt Marinara, dass es sich um ein exaktes Literal handelt und nicht um ein Schlüsselwort oder eine Variable.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

Erlaubt sind gerade doppelte oder gerade einfache Anführungszeichen. Marinara akzeptiert auch typografische Anführungszeichen, doch gerade Zeichen sind am sichersten und entsprechen allen Beispielen in der App. Innerhalb eines Werts in Anführungszeichen maskierst du ein Anführungszeichen mit einem Backslash, und `\n` steht für einen Zeilenumbruch.

Ein Literal mit Leerzeichen gehört immer in Anführungszeichen, etwa `"Dr Smith"`. Ein mehrteiliger Wert ohne Anführungszeichen gilt als ein einziger Variablenname – und das ist so gut wie nie gewollt.

## Gruppenblöcke für mehrere Charaktere

In einem Gruppenchat mit zwei oder mehr Charakteren wiederholt ein Gruppenblock denselben Text einmal pro Charakter. So beschreibt ein einziger Block jeden Charakter in der Szene.

Für einen Gruppenblock setzt du ein einzelnes `[` in eine eigene Zeile, darunter den Text und darunter ein einzelnes `]` in eine eigene Zeile. Der Block muss ein Charakter-Makro wie `{{char}}` oder `{{description}}` enthalten oder eine charakterbezogene Bedingung wie `{{#if char == "Alice"}}`. Marinara wiederholt den Block dann einmal pro Charakter und löst die Charakter-Makros nacheinander gegen jeden davon auf.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

In einem Gruppenchat mit Alice und Bob läuft der Block zweimal durch. Der erste Durchlauf setzt Alices Namen ein und wählt ihren Zweig. Der zweite setzt Bobs Namen ein und wählt seinen Zweig. Außerhalb eines Gruppenblocks bezieht sich ein Charakter-Makro nur auf den aktuellen oder den primären Charakter.

Gruppenblöcke greifen nur in Chats mit zwei oder mehr Charakteren. Im Einzelchat bleiben die Zeilen mit `[` und `]` schlichter Text.

## Beispiele aus der Praxis (vorher und nachher)

Es folgen drei vollständige Beispiele samt dem Ergebnis, das beim Modell ankommt.

Charakterspezifischer Ton innerhalb eines gemeinsamen Presets:

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Beim Charakter `Dottore` erhält das Modell `Speak in a cold, clinical tone.` Bei allen anderen Charakteren erhält es `Speak warmly and casually.`

Ein Feld nur mitschicken, wenn es ausgefüllt ist:

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Hat der Charakter eine **Backstory** (Vorgeschichte), bekommt das Modell diese Zeile samt Text. Ist das Feld **Backstory** leer, ergibt der ganze Block nichts, und es geht keine leere Beschriftung mit.

Einen Teil des Nutzernamens treffen:

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

Enthält der Name der Persona `Dr`, wird das Modell angewiesen, dich mit Doktor anzusprechen. Andernfalls ergibt der Block nichts.

<a id="asking-the-decision-model"></a>

## Das Decision-Modell fragen

Eine Bedingung kann auch dein **Decision model** (Entscheidungsmodell) dazu befragen, was im Chat passiert. Das ist das Modell, das du unter **Decision model** im Panel Connections ausgewählt hast: ein bereits laufendes lokales Modell, eine gehostete Decision-Verbindung oder ein installiertes Entscheidungsmodell. Es liest die letzten Nachrichten und deine Aussage und entscheidet, ob sie wahr ist. Es schreibt nie etwas in den Chat. [Decision-Modelle](../connections/decision-models.md) erklärt die Funktion und Auswahl.

So kann ein Preset, eine Karte, ein Lorebook-Eintrag oder ein Agenten-Prompt eine Anweisung nur in passenden Zügen senden, statt jeden Zug „falls X passiert, tu Y“ mitzugeben. Soll der ganze Lorebook-Eintrag aktiviert werden, statt nur seinen Text zu kürzen, verwende sein Feld [Decision](../lorebooks/entries.md#decision-activation). Einige Ideen:

- **Szenenwechsel.** Einen neuen Ort oder Zeitsprung nur beschreiben, wenn die Szene tatsächlich gewechselt hat.
- **Szenentypen.** Regeln für Kampf, Intimität oder Spannung nur während entsprechender Szenen laden.
- **Die Frage zuerst beantworten.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Stimmungen auf Karten.** Eine Charakterkarte kann Verhalten für Verlegenheit oder Wut enthalten, das nur bei entsprechenden jüngsten Nachrichten erscheint.
- **Tempo begrenzen.** Ein Slow-Burn-Preset kann Eskalationsanweisungen zurückhalten, bis sich die Beziehung sichtbar entwickelt hat.
- **Gruppenszenen.** In einem Gruppenblock weist `{{#if decision:"{{char}} is addressed in the latest message"}}` nur den Abschnitt des angesprochenen Charakters zu einer direkten Antwort an.

### Ja oder nein: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Die Bedingung ist wahr, wenn das Decision-Modell die Aussage für wahr hält. Sie funktioniert mit allem anderen in dieser Anleitung: `{{else}}`, `{{else if}}`, `&&`, `||`, Klammern, Verschachtelung und Gruppenblöcken.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

Makros in der Aussage werden zuerst aufgelöst; `{{user}}` und `{{char}}` funktionieren also. In einem Gruppenblock wird eine Aussage mit `{{char}}` für jeden Charakter einzeln gestellt.

### Eine von mehreren Antworten: `decision_choice:`

`decision_choice:` bittet das Decision-Modell um eine Auswahl. Die Optionen sind alle Werte, mit denen du sie irgendwo im Prompt vergleichst:

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Hier wählt das Modell zwischen „angry“, „sad“ und „keine davon“. Auch die Kurzform funktioniert: `decision_choice:"The weather in the latest message" == "rain" || "snow"` bietet beide Optionen. Formuliere die Aussage als Thema, etwa „Kaelens Stimmung in der neuesten Nachricht“, und die Optionen als kurze Antworten darauf.

<a id="sticky-and-cooldown"></a>

### Sticky und Cooldown

Eine Aussage kann ihre Antwort einige Züge behalten, statt jeden Zug erneut gefragt zu werden. Schreib `sticky:` und `cooldown:` hinter die Aussage:

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** Nach einem ja bleibt die Aussage für die nächsten N Züge ohne Nachfrage wahr; der von ihr gesteuerte Text bleibt im Prompt.
- **cooldown:N.** Beginnt nach Sticky oder, ohne Sticky, direkt nach dem ja. Für N Züge gilt die Aussage als nein und wird nicht gefragt. Danach wird wieder geprüft.
- Als Zug zählt jede neue Nachricht, die das Decision-Modell liest. Neugenerierung oder Swipe derselben Nachricht sind derselbe Zug; erneutes Würfeln einer Antwort lässt keinen Timer ablaufen.
- Während Sticky oder Cooldown wird nicht gefragt; die Aussage zählt nicht zu **Decision statements per turn** (Decision-Aussagen pro Zug) und lässt ihren Platz einer anderen Aussage.
- Bei `decision_choice:` hält Sticky die ausgewählte Option. Während Cooldown gelten alle Vergleiche als nein. Die Auswahl keiner der Optionen startet nichts.
- Steht dieselbe Aussage an mehreren Stellen, gelten die längsten irgendwo angegebenen Sticky- und Cooldown-Zeiten.
- Peek Prompt zeigt die gehaltene Antwort und bewegt keinen Timer weiter.

Zusammen passt das zu einmaligen Szenenwechseln oder Erinnerungen mit anschließender Pause sowie Stimmungen, die einige Züge anhalten sollen. Bei einem über **Decision** aktivierten Lorebook-Eintrag nutze dessen eigene Einstellungen **Sticky** und **Cooldown**: Ein gehaltener Eintrag bleibt ohne Nachfrage enthalten; ein pausierender wird nicht geprüft.

<a id="checking-every-few-turns"></a>

### Alle paar Züge prüfen

Manche Aussagen müssen nicht jeden Zug geprüft werden. Schreib `every:` hinter die Aussage, um sie nur alle N Züge zu fragen:

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Sie wird beim ersten Erreichen gefragt, dann wieder 3 Züge später und so weiter.
- Eine Änderung der Zahl gilt sofort: Die nächste Prüfung zählt ab dem Zug der letzten Anfrage.
- Dazwischen gilt sie als nein, wird nicht gefragt und zählt nicht zu **Decision statements per turn**.
- Züge zählen wie bei Sticky und Cooldown; Neugenerierung oder Swipe verschieben den Zeitplan nicht. Für die Wiederverwendung einer Antwort gelten die [Cache-Regeln](#answer-reuse).
- Sticky und Cooldown halten die Antwort weiterhin; `every:` entscheidet nur über Prüfungen, die nicht von ihnen gehalten werden.
- Steht dieselbe Aussage mehrfach, gilt das kleinste irgendwo angegebene `every:`.

<a id="priority"></a>

### Priorität

Enthält ein Prompt-Plan mehr Aussagen, als **Decision statements per turn** erlaubt, bestimmt `priority:` die Auswahl. Das Kontingent gilt in [mehreren Phasen](#statement-allowance):

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Aussagen mit `priority:high` werden zuerst gefragt, solche mit `priority:low` zuletzt. Ohne Angabe gilt mittlere Priorität.
- Bei gleicher Priorität entscheidet weiterhin die Reihenfolge im Prompt.
- Über dem Limit fallen die Aussagen mit niedrigster Priorität zuerst weg. Sie gelten als nein; Peek Prompt listet sie auf.
- Steht eine Aussage mehrfach, gilt die höchste irgendwo angegebene Priorität.
- Die eigenen Aussagen des Prompts aus Preset, Karten, Persona und Autorennotizen werden zuerst geplant. Aussagen im Text von Lorebook-Einträgen folgen nach Feststellung der aktiven Einträge mit den verbleibenden Plätzen. Eine Lorebook-Aussage verdrängt daher unabhängig von ihrer Priorität keine Prompt-Aussage.

Alle Zusätze lassen sich in beliebiger Reihenfolge kombinieren: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Keine Antwort bedeutet nein

Eine Decision-Bedingung ist **falsch**, wenn keine Antwort vorliegt: kein ausgewähltes Modell, zu späte Antwort oder Fehler. Bei `decision_choice:` sind dann alle Vergleiche falsch. Ohne Decision-Modell erhält man also den `{{else}}`-Zweig oder keinen Text.

Plane dafür:

- Nutze Decisions, um **Anweisungen zu ergänzen oder zu kürzen**, nie für unverzichtbare Inhalte der Geschichte. Ein verpasster Zweig soll eine Antwort etwas weniger passend machen, nicht unbrauchbar.
- Gib jedem Block einen sinnvollen Standard: entweder keinen Zusatz oder einen `{{else}}`-Zweig, der in jedem Zug passt.
- Verkette Decisions nicht so, dass eine falsche Antwort mehrere weitere verändert.
- Mache Einverständnis, Inhaltshinweise oder Sicherheitsanweisungen nicht von einer Decision abhängig. Sie sollen immer enthalten sein.

Jedes Modell kann falsch antworten. Schreib für „ein Decision-Modell“, niemals mit „benötigt Jev“; auch ein lokales Chat-Modell kann die Aussagen beantworten. Die Syntax ist gemeinsam, Antworten und Genauigkeit können abweichen.

<a id="writing-statements"></a>

### Aussagen formulieren

Diese Hinweise stammen aus Tests mit einem lokalen Chat-Modell sowie Open-Jev 2B und 9B:

- **Formuliere eine wahre oder falsche Tatsache**, wie in einem Bericht. Keine Frage („Hat die Szene gewechselt?“) und keine Anweisung („Falls die Szene gewechselt hat, beschreibe sie“). Das lokale Chat-Modell beantwortete eine Anweisung jedes Mal mit nein; der Block wurde nie aktiv.
- **Sag „in der neuesten Nachricht“**, wenn du diesen Zug meinst. Das Modell liest mehrere Nachrichten; „Mira stellt Fragen“ wurde mit ja beantwortet, weil eine frühere Nachricht eine Frage enthielt.
- **Benenne die Person.** „Er ist wütend“ wurde dem falschen Charakter zugeordnet.
- **Beschreibe sichtbaren Text**, eine Handlung oder etwas Gesagtes, keine interpretationsbedürftige Stimmung („Die Szene ist intensiv“) oder verborgene Absicht („Mira lügt“).
- Halte es kurz. Ein einfaches „und“ oder eine Verneinung funktionierten im Test gut; formuliere natürlich.

So prüfst du die Formulierung:

1. Wähle unter **Decision model** ein Modell und klick auf **Test**. Das prüft die Verbindung mit einem festen Beispiel, weder deine Aussage noch den aktuellen Chat.
2. Ergänze die Aussage im Prompt und sende typische Nachrichten: einige, bei denen sie wahr sein soll, und einige, bei denen sie falsch sein soll.
3. Prüfe mit **Peek Prompt**, welcher Zweig gesendet wurde. Für Wahrscheinlichkeit und Ja/Nein-Ergebnis aktiviere [Debug-Logging](../CONFIGURATION.md#logging-levels).
4. Passe den Text an und teste erneut. Verwende für einen neuen Fall neue Nachrichten oder ändere die Aussage: Erfolgreiche Antworten können [wiederverwendet](#answer-reuse) werden. Eine neue Peek-Prompt-Vorschau fragt das Modell nicht.

Was die Tests zeigten: Jede Formulierung wurde an vier markierten Roleplay-Zügen geprüft, zweimal mit erwartetem ja und zweimal mit erwartetem nein, jeweils auf Open-Jev 2B, Open-Jev 9B und einem lokalen Gemma 4 E4B. Das ist eine kleine Stichprobe aus einer Szene, kein allgemeiner Genauigkeitstest und kein Test des gehosteten Jev. Die Tabelle beschreibt Beobachtungen dieser Stichprobe und verspricht kein gleiches Ergebnis bei anderen Modellen oder Chats.

| So schreiben | Vermeiden | Beobachtung bei der ungünstigen Formulierung |
| --- | --- | --- |
| Die neueste Nachricht verlegt die Szene an einen neuen Ort. | Hat die Szene gewechselt? | Die Frage hob Open-Jev 2Bs „nein“-Züge über seine Schwelle. Das lokale Modell blieb unbeeinflusst. |
| In der neuesten Nachricht zieht ein Charakter eine Waffe oder greift jemanden an. | Die Szene ist intensiv. | Alle drei nannten einen hitzigen Streit „intensiv“. Bei einem vagen Wort entscheidet das Modell über die Bedeutung, nicht du. |
| In der neuesten Nachricht stellt Mira Kaelen eine direkte Frage. | Mira stellt Fragen. | Das lokale Modell und Open-Jev 9B sagten ja, obwohl Miras neueste Nachricht nichts fragte, weil eine frühere es tat. |
| Kaelen ist in der neuesten Nachricht wütend. | Er ist wütend. | Das lokale Modell verstand „er“ als den wütenden Wirt. |
| In der neuesten Nachricht sagt Mira etwas, das einer früheren Aussage widerspricht. | Mira lügt. | Kein Modell nannte einen Widerspruch zuverlässig eine Lüge. |
| Die neueste Nachricht verlegt die Szene an einen neuen Ort. | Falls die Szene gewechselt hat, beschreibe den neuen Ort in zwei Sätzen. | Das lokale Modell antwortete auf die Anweisung jedes Mal mit nein; der Block wurde nie aktiv. |
| Jemand ist in der neuesten Nachricht verletzt. | Ein Kampf beginnt, jemand wird verletzt und die Stadtwache kommt. | Richtig verarbeitet. Getrennte Aussagen lassen sich trotzdem leichter wiederverwenden und untersuchen. |
| In der neuesten Nachricht bleiben die Charaktere am selben Ort. | Die Charaktere haben den Raum nicht verlassen. | Kein Unterschied. Schreib, was natürlicher klingt. |

Die empfohlenen Formulierungen erreichten 31 von 32 bei Open-Jev 2B, 31 von 32 bei Open-Jev 9B und 32 von 32 beim lokalen Modell. Die ungünstigen erreichten 26, 25 und 24. Diese kleinen Stichproben veranschaulichen Formulierungsentscheidungen; beurteile anhand eigener Fälle, welches Modell zu deinen Chats passt.

<a id="limits-and-cost"></a>

### Grenzen und Kosten

<a id="statement-allowance"></a>

#### Aussagenkontingent

**Decision statements per turn** unter **Decision model** ist standardmäßig 32. Trotz des Namens ist das keine globale Grenze für alle Decision-Anfragen oder Ausgaben. Marinara wendet das Kontingent in Phasen an:

1. Die Aussagen des Haupt-Chat-Prompts werden innerhalb des Kontingents geplant. Lorebook-Decisions verwenden dessen verbleibenden Anteil.
2. Für Agenten vor oder parallel zur Antwort erstellt Marinara einen gemeinsamen Plan der Haupt-Prompt-Aussagen und der Prompt-Aussagen dieser Agenten. Dabei gilt das konfigurierte Kontingent erneut. Der frühere Lorebook-Verbrauch wird nicht abgezogen; die Summe kann die Einstellung deshalb überschreiten.
3. Nachverarbeitende Agenten erhalten nach der Antwort ein eigenes Kontingent. Ihre Aussagen lesen die fertige Antwort.

**Aktivierungsfragen** und **Smart-Antwortreihenfolge** sind von dieser Einstellung unabhängig.

Nur in der aktuellen Phase nutzbare Aussagen kommen in den Plan: aktivierte Preset-Abschnitte und -Gruppen, ausgewählte Variablenoptionen und Inhalte aktivierter Lorebook-Einträge. Eine feste Bedingung kann eine Aussage ausschließen: `{{#if char == "Dottore" && decision:"..."}}` wird für Mira nicht gefragt. Variablen können sich beim Prompt-Aufbau ändern; eine Variablenbedingung schließt deshalb vorab nichts aus.

Durch [Sticky, Cooldown](#sticky-and-cooldown) oder [`every:`](#checking-every-few-turns) gehaltene Aussagen belegen keinen Platz. [Priorität](#priority) bestimmt die Auswahl im Prompt-Plan. Lorebook-Aktivierung greift beim Prüfen der Einträge auf dessen Restkontingent zurück. Ausgelassene Aussagen gelten als nein und erscheinen in Peek Prompt.

#### Anfragen und Zeit

Ein Zug kann über eine gehostete Decision-Verbindung mehrere berechnete Anfragen verursachen. Aussagen lassen sich bündeln; Lorebook-Aktivierung, neu aktivierte Eintragstexte, rekursive Treffer und Agentenphasen können aber weitere Bündel benötigen. Aktivierungsfragen werden nach Scan Depth und Phase gebündelt; Smart stellt eine eigene Anfrage. Das Aussagenkontingent ist keine Grenze für Anfragezahl oder Geldkosten.

Ein lokales Chat-Modell kostet stattdessen Rechenzeit. Es beantwortet `decision_choice:` mit einer Ja/Nein-Frage pro Option; eine einzige Auswahl kann deshalb mehrere Generierungen brauchen.

Jede Anfrage hat ein [Zeitlimit](../connections/decision-models.md#time-limits): standardmäßig 1,5 Sekunden bei einer Decision-Verbindung oder das Budget des lokalen Backends. Mehrere Anfragen können zusammen länger dauern. Ein lokales Modell, das zuerst nachdenken muss, hält sich vor der Antwort zurück, sofern **Also gate agents that run before the reply** (auch Agenten vor der Antwort prüfen) nicht aktiviert ist.

<a id="answer-reuse"></a>

#### Antworten wiederverwenden

Erfolgreiche Antworten werden normalerweise für denselben Zug und dasselbe Decision-Modell wiederverwendet. Eine Neugenerierung sendet daher oft dieselben Zweige ohne neue Anfrage. Dieser Cache liegt im laufenden Server und hält bis zu 200 Zugschlüssel. Neustart oder Entfernung aus dem Cache können eine neue Anfrage auslösen. Auch eine neue oder bearbeitete letzte Nachricht, ein anderes Modell, eine geänderte Aussage oder ein geänderter Optionssatz können eine neue Antwort benötigen.

Fehlende oder fehlgeschlagene Antworten werden nicht als erfolgreiche Nein-Antworten gespeichert. Eine Wiederholung desselben Zuges kann erneut fragen und einen anderen Zweig wählen. Sticky/Cooldown-Zeitsteuerung ist von diesem Antwort-Cache getrennt.

Für Aussagen in Agenten-Prompts gelten dieselben Regeln. Agenten vor und parallel zur Antwort lesen den vorherigen Zug, nachverarbeitende Agenten die fertige Antwort; ein geänderter Swipe kann deshalb neue Antworten benötigen. Ein manueller Agentenlauf verwendet noch gespeicherte erfolgreiche Antworten zu seinen Eingaben erneut. Siehe [Decision-Bedingungen im Agenten-Prompt](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Prompt-Caching

Der **Prompt-Cache** des Anbieters ist unabhängig von Marinaras Decision-Antwort-Cache. Er kann ein unverändertes Präfix des an dein Chat-Modell gesendeten Prompts wiederverwenden. Ein wechselnder Decision-Zweig kann die Wiederverwendung ab dieser Stelle verhindern; ein früheres unverändertes Präfix kann weiter passen. Nutzbarer Anteil und Abrechnung hängen vom Anbieter, Cache-Grenzen, Mindestlänge und Lebensdauer ab.

**Setze wechselnde Decision-Blöcke spät im Prompt ein**, etwa nach dem Verlauf oder in einer Autorennotiz mit geringer Tiefe. Eine frühe Änderung kann fast alle Cache-Ersparnisse kosten. Lass eine Decision nur weit oben, wenn ihre Antwort selten wechselt und ihre Anweisungen dorthin gehören. Dasselbe gilt für Variablenoptionen eines Presets: Ihr Text landet dort, wo `{{name}}` steht.

Bei einer direkten Anthropic-Verbindung mit **Enable prompt caching** (Prompt-Caching aktivieren) markiert Marinara das Ende des System-Prompts und eine Chat-Nachricht **Cache depth** (Cache-Tiefe) Nachrichten vor der neuesten, standardmäßig 5. Eine Änderung vor dem Verlauf kann die System-Grenze und späteren Verlauf ungültig machen, auch wenn ein früheres passendes Präfix nutzbar bleibt. Eine Änderung nach der markierten Verlaufsgrenze kann dieses Präfix erhalten. Eine Änderung zwischen beiden Grenzen kann das System-Präfix erhalten, während ein Teil des Verlaufs-Cache verloren geht. Cache-Lesen und -Schreiben haben unterschiedliche Preise.

Mindestlängen und unterstützte Grenzen hängen vom Modell ab und können sich ändern. Die aktuellen Einzelheiten und Abrechnungsregeln stehen in den Anleitungen zum [Anthropic-Prompt-Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) und [OpenAI-Prompt-Caching](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Wenn ein Decision-Zweig nie erscheint

Erscheint ein Decision-Zweig nie, sind die wahrscheinlichsten Ursachen in dieser Reihenfolge:

1. **Kein Decision-Modell ausgewählt.** Jede Decision-Bedingung ist in jedem Zug falsch. Der Editor warnt unter jedem entsprechenden Feld.
2. **Das Decision-Modell antwortet nicht.** Etwa eine gehostete Verbindung mit falschem Key, fehlendem Guthaben oder Anfragelimit; ein gestopptes oder zu langsames lokales Modell; oder ein installiertes Entscheidungsmodell, das nicht gestartet ist.
3. **Es ist ein nachdenkendes Modell**, das vor der Antwort keine Entscheidungen liefert.
4. **Zu viele Aussagen in der jeweiligen Planungsphase**, mehr als ihr Kontingent erlaubt.
5. **Es antwortet unterhalb seiner Schwelle.** Meist liegt es an der Formulierung oder daran, dass das Modell den Zug niedriger bewertet als erwartet.

Prüfe das ausgewählte Decision-Modell und das Ergebnis von **Test**. **Peek Prompt** zeigt die tatsächlich gesendeten Zweige. Bei einer neuen Vorschau listet es Aussagen ohne bisherige Antwort; dort gelten sie als nein. Mit Log-Level debug werden jede Aussage, Antwort und Ja/Nein-Auswertung protokolliert; siehe [Logging-Level](../CONFIGURATION.md#logging-levels).

Selten liegt die Lösung im Preset. Wenn doch, geht es meist um die Formulierung oder um einen Zweig mit unverzichtbarem Prompt-Inhalt.

## Verwandte Anleitungen

- [Decision-Modelle](../connections/decision-models.md)

- [Prompt-Makros](macros.md)
- [Preset-Variablen](preset-variables.md)
- [Gruppenchats und Group Conversations](../chats/group-chats.md)
