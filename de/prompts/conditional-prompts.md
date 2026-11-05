# Bedingte Prompts ({{#if}})

Ein `{{#if}}`-Block nimmt einen Teil des Prompt-Textes nur dann auf, wenn eine Bedingung zutrifft. Damit gibst du einem gemeinsamen Preset unterschiedliche Anweisungen für verschiedene Charaktere, Personas oder Chats, oder du lässt ein leeres Feld weg. Bedingungen gehören zum Makro-System und funktionieren deshalb überall dort, wo auch [Makros](macros.md) funktionieren: in Charakterkarten, Personas, Lorebook-Einträgen und Presets.

Marinara prüft die Bedingung bei jedem Prompt-Aufbau, behält den passenden Text und verwirft den Rest. Das ist eine Funktion für Fortgeschrittene, und die meisten Chats brauchen sie nie.

## Die Grundsyntax

Ein Block beginnt mit `{{#if condition}}` und endet mit `{{/if}}`. Mit `{{else}}` ergänzt du den Fall, dass die Bedingung nicht zutrifft, und mit `{{else if}}` hängst du weitere Bedingungen an. Marinara prüft die Zweige von oben nach unten und behält den ersten, der zutrifft. Trifft keiner zu und fehlt ein `{{else}}`, ergibt der Block nichts.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Ein Block kann in einer einzigen Zeile stehen oder sich über mehrere Zeilen ziehen, und du kannst Blöcke verschachteln.

## Operatoren

Eine Bedingung besteht meist aus einem linken Wert, einem Operator und einem rechten Wert, etwa `char == "Alice"`.

| Operator | Bedeutung |
| --- | --- |
| `==`, `=`, `is` | Gleich. |
| `!=`, `is not` | Ungleich. |
| `>`, `<`, `>=`, `<=` | Größer, kleiner, größer oder gleich, kleiner oder gleich (nur Zahlen). |
| `contains`, `includes` | Der linke Wert enthält den rechten Wert als Text. |
| `not contains`, `not includes` | Der linke Wert enthält den rechten Wert nicht. |

Für den Vergleich gelten diese Regeln:

1. Bei den Gleichheitsoperatoren vergleicht Marinara beide Seiten als Zahlen, sofern beide wie Zahlen aussehen. `5` ist also gleich `5.0`. Andernfalls vergleicht es Text, ohne Rücksicht auf Groß- und Kleinschreibung. `Mari` ist also gleich `mari`.
2. Bei `>`, `<`, `>=` und `<=` müssen beide Seiten Zahlen sein. Andernfalls trifft die Bedingung nicht zu.
3. Bei `contains` und `includes` spielt Groß- und Kleinschreibung keine Rolle. `contains "dr"` passt also auf `Dr Smith`.

### Bedingungen kombinieren

Nimm `||` für ODER und `&&` für UND. `&&` wird vor `||` ausgewertet. Mit Klammern legst du die Reihenfolge fest.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Prüfst du einen Wert auf mehrere Gleichheitsalternativen, kannst du die wiederholte linke Seite weglassen: `character == "Maukie" || "Pantalone"`. Das funktioniert bei `==`, `=` und `is`. Auf beiden Seiten von `&&` schreibst du vollständige Bedingungen.

### Truthy-Prüfungen

Eine Bedingung ohne Operator trifft zu, wenn der Wert echten Inhalt hat. Sie trifft nicht zu, wenn der Wert leer ist oder eines dieser Wörter ist, in beliebiger Groß- und Kleinschreibung: `false`, `0`, `no`, `off`, `null` oder `undefined`.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### Was sich vergleichen lässt

Auf jeder Seite einer Bedingung kann Folgendes stehen:

1. Ein Feld- oder Identitäts-Schlüsselwort wie `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` oder `reasoning`. Diese lesen dieselben Werte wie die passenden Makros. `group` listet die übrigen aktiven Charaktere auf, ohne den gerade antwortenden Charakter.
2. Ein Literal in Anführungszeichen, etwa `"Alice"`.
3. Der Name einer Preset-Variablen, etwa `length`. Siehe [Preset-Variablen](preset-variables.md).
4. Ein ausdrücklicher Variablenzugriff in der Form `var:name` oder `var.name`.
5. Ein weiteres Makro, das zuerst aufgelöst wird.
6. Eine Frage an dein Decision-Modell: `decision:"..."` oder `decision_choice:"..."`. Siehe [Das Decision-Modell fragen](#asking-the-decision-model).

Ein bloßes Wort, das kein Schlüsselwort ist, behandelt Marinara als Variablennamen. Gibt es keine Variable dieses Namens, gilt das Wort als schlichter Text. Setz feste Werte in Anführungszeichen, damit es keine Verwechslung gibt.

### Anführungszeichen

Setz festen Text in gerade doppelte oder gerade einfache Anführungszeichen. Innerhalb eines Werts in Anführungszeichen maskierst du ein Anführungszeichen mit einem Backslash, und `\n` steht für einen Zeilenumbruch. Ein Literal mit Leerzeichen gehört immer in Anführungszeichen, etwa `"Dr Smith"`. Ein mehrteiliger Wert ohne Anführungszeichen gilt als ein einziger Variablenname.

## Gruppenblöcke für mehrere Charaktere

In einem Gruppenchat mit zwei oder mehr Charakteren wiederholt ein Gruppenblock seinen Text einmal pro Charakter. Setz ein einzelnes `[` in eine eigene Zeile, darunter deinen Text und darunter ein einzelnes `]` in eine eigene Zeile. Der Block muss ein Charakter-Makro wie `{{char}}` oder `{{description}}` enthalten oder eine charakterbezogene Bedingung.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Mit Alice und Bob läuft der Block zweimal durch, einmal pro Charakter. Außerhalb eines Gruppenblocks bezieht sich ein Charakter-Makro nur auf den aktuellen oder den primären Charakter. In einem Chat mit nur einem Charakter bleiben die Zeilen mit `[` und `]` schlichter Text.

## Beispiele

Unterschiedlicher Ton pro Charakter:

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Ein Feld nur mitschicken, wenn es ausgefüllt ist. Ist **Backstory** (Vorgeschichte) leer, ergibt der Block nichts, und es geht keine leere Beschriftung mit.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Anweisungen für eine Modellfamilie. `model` ist die Modell-ID, etwa `claude-opus-5-5`. `contains` trifft also auf jede Opus-Version zu, `==` nur auf ein bestimmtes Modell.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Planungsanweisungen, die vom Nachdenken abhängen. Ist Reasoning auf irgendeiner Stufe aktiv, bekommt das Modell die erste Zeile. Ist Reasoning aus, lautet `{{reasoning}}` gleich `off`, was als falsch gilt. Um auf eine bestimmte Stufe zu reagieren, vergleichst du sie, etwa mit `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Das Decision-Modell fragen

Eine Bedingung kann dein Decision-Modell fragen, was im Chat passiert. Das Decision-Modell ist ein kleines Modell, das die letzten Nachrichten und eine von dir geschriebene Aussage liest und sagt, ob die Aussage wahr ist. Es schreibt nie etwas in den Chat. So kann ein Preset, eine Karte, ein Lorebook-Eintrag oder ein Agenten-Prompt eine Anweisung nur in den Zügen senden, in denen sie passt.

Bevor du anfängst: Wähle unter **Decision model** (Entscheidungsmodell) im Panel **Connections** (Verbindungen) ein Decision-Modell aus. [Decision-Modelle](../connections/decision-models.md) erklärt, was es ist und wie du eines auswählst. Soll entschieden werden, ob ein ganzer Lorebook-Eintrag aktiviert wird, nutze stattdessen das Feld [Decision](../lorebooks/entries.md#decision-activation) des Eintrags.

Ideen: einen neuen Ort nur beschreiben, wenn die Szene gewechselt hat; Regeln für das Kampftempo nur während eines Kampfes laden; in einem Slow-Burn-Preset die Eskalation zurückhalten; oder in einem Gruppenblock nur den angesprochenen Charakter direkt antworten lassen.

### Ja oder nein: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Die Bedingung ist wahr, wenn das Decision-Modell die Aussage für wahr hält. Sie funktioniert mit `{{else}}`, `&&`, `||`, Klammern, Verschachtelung und Gruppenblöcken. Makros in der Aussage werden zuerst aufgelöst; `{{user}}` und `{{char}}` funktionieren also. In einem Gruppenblock wird eine Aussage, die `{{char}}` nennt, für jeden Charakter einzeln gestellt.

### Eine von mehreren Antworten: `decision_choice:`

`decision_choice:` bittet das Modell, eine Option auszuwählen. Die Optionen sind die Werte, mit denen du es vergleichst.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Das Modell wählt zwischen „angry“, „sad“ und „keine davon“. Formuliere die Aussage als Thema und die Optionen als kurze Antworten. Die Kurzform `== "rain" || "snow"` bietet beide Optionen an.

Um festzulegen, was eine Option in deiner Geschichte bedeutet, hängst du nach ihr Kriterien an, getrennt durch einen Doppelpunkt und mit derselben Art von Anführungszeichen um beide Teile: `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. Das Modell antwortet trotzdem mit „angry“. Hat eine Option an mehreren Stellen unterschiedliche Kriterien, gelten die ersten.

<a id="sticky-and-cooldown"></a>

### Sticky und Cooldown

Schreib `sticky:` und `cooldown:` hinter eine Aussage, damit ihre Antwort einige Züge lang erhalten bleibt, statt jeden Zug neu gefragt zu werden.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: Nach einem Ja bleibt die Aussage N Züge lang wahr, ohne gefragt zu werden.
- `cooldown:N`: Beginnt, wenn Sticky endet, oder direkt nach dem Ja. N Züge lang gilt die Aussage als nein und wird nicht gefragt.
- Als Zug zählt jede neue Nachricht, die das Decision-Modell liest. Eine Neugenerierung oder ein Swipe derselben Nachricht ist derselbe Zug; erneutes Würfeln lässt also nie einen Timer ablaufen.
- Eine gehaltene Aussage wird nicht gefragt und zählt nicht zu **Decision statements per turn** (Decision-Aussagen pro Zug).
- Bei `decision_choice:` hält Sticky die ausgewählte Option, und während Cooldown gilt jeder Vergleich als nein.
- Steht eine Aussage an mehreren Stellen, gelten die längsten Sticky- und Cooldown-Zeiten.
- Peek Prompt zeigt die gehaltene Antwort und bewegt nie einen Timer weiter.

Bei einem Lorebook-Eintrag, der über sein Feld **Decision** aktiviert wird, nutzt du stattdessen die eigenen Einstellungen **Sticky** und **Cooldown** des Eintrags.

<a id="until-and-while"></a>

### Until und While

Soll ein Block so lange aktiv bleiben, wie etwas andauert, schreib `until:` oder `while:` mit einer zweiten Aussage dahinter.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- Nach einem Ja bleibt der Block aktiv. Die erste Aussage wird nicht gefragt. Stattdessen wird jeden Zug die `until`-Aussage gefragt, und in dem Zug, in dem sie wahr ist, schaltet sich der Block ab.
- `while:` funktioniert umgekehrt: Der Block bleibt aktiv, solange seine Aussage wahr ist, und schaltet sich ab, sobald sie falsch ist.
- Verwende nur einen der beiden Zusätze. Stehen beide da, zählt nur der erste.
- Schaltet sich der Block ab, beginnt wie gewohnt die Cooldown-Zeit. Ohne Antwort in einem Zug bleibt der Block aktiv.
- Die `until`- oder `while`-Aussage zählt zu **Decision statements per turn**. Die erste Aussage zählt nicht dazu, solange der Block aktiv ist.
- Das funktioniert mit `decision:`, nicht mit `decision_choice:`.

Mit **sticky** setzt du `:and` (auch `:restrict`) oder `:or` (auch `:extend`) hinter die zweite Aussage, um festzulegen, wie beide zusammenwirken.

| Schreibweise | Nach dem Ja bleibt der Block aktiv |
| --- | --- |
| `until:"..." sticky:5` oder `until:"...":and sticky:5` | Für bis zu 5 weitere Züge; er schaltet sich früher ab, wenn die Until-Aussage wahr ist. |
| `until:"...":or sticky:5` | Für mindestens 5 weitere Züge, danach so lange, bis die Until-Aussage wahr ist. |
| `while:"..." sticky:5` oder `while:"...":or sticky:5` | Für mindestens 5 weitere Züge, danach so lange, wie die While-Aussage wahr ist. |
| `while:"...":and sticky:5` | Für bis zu 5 weitere Züge; er schaltet sich früher ab, wenn die While-Aussage falsch ist. |

<a id="checking-every-few-turns"></a>

### Alle paar Züge prüfen

Schreib `every:N` hinter eine Aussage, um sie nur alle N Züge zu fragen.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Sie wird im ersten Zug gefragt, in dem sie erreicht wird, dann wieder 3 Züge später und so weiter. Zwischen den Prüfungen gilt sie als nein, wird nicht gefragt und zählt nicht zu **Decision statements per turn**.
- Eine Neugenerierung oder ein Swipe verschiebt den Zeitplan nicht.
- Sticky und Cooldown halten eine Antwort weiterhin. `every:` entscheidet nur, wann eine nicht gehaltene Aussage gefragt wird.
- Steht eine Aussage an mehreren Stellen, gilt das kleinste `every:`.

<a id="priority"></a>

### Priorität

Enthält ein Prompt-Plan mehr Aussagen, als das Kontingent **Decision statements per turn** erlaubt, entscheidet `priority:high` oder `priority:low`, welche gefragt werden. Ohne Angabe gilt mittlere Priorität.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Aussagen mit hoher Priorität werden zuerst gefragt, solche mit niedriger zuletzt. Bei gleicher Priorität entscheidet die Reihenfolge im Prompt.
- Aussagen über dem Limit gelten als nein, die mit der niedrigsten Priorität zuerst, und Peek Prompt listet sie auf.
- Steht eine Aussage an mehreren Stellen, gilt die höchste Priorität.
- Die eigenen Aussagen des Prompts (Preset, Karten, Persona, Autorennotizen) werden zuerst geplant. Lorebook-Aussagen nutzen die verbleibenden Plätze, unabhängig von ihrer Priorität.

Alle Zusätze lassen sich in beliebiger Reihenfolge kombinieren: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Keine Antwort bedeutet nein

Eine Decision-Bedingung ist falsch, sobald keine Antwort vorliegt: Es ist kein Decision-Modell ausgewählt, es hat nicht rechtzeitig geantwortet, oder es ist fehlgeschlagen. Bei `decision_choice:` ist dann jeder Vergleich falsch. Plane dafür.

- Nutze eine Decision, um Anweisungen zu ergänzen oder zu kürzen, nie für Inhalte, auf die die Geschichte angewiesen ist.
- Gib jedem Decision-Block einen Standard: nichts oder ein `{{else}}`, das in jedem Zug passt.
- Verkette Decisions nicht so, dass eine falsche Antwort mehrere weitere verändert.
- Mach Einverständnis, Inhaltshinweise oder Sicherheitsanweisungen nicht von einer Decision abhängig.

Jedes Modell kann falsch antworten. Schreib für „ein Decision-Modell“, nicht für ein bestimmtes Produkt.

<a id="writing-statements"></a>

### Aussagen formulieren

- Formuliere eine Tatsache, die wahr oder falsch ist, wie eine Zeile in einem Bericht. Keine Frage („Hat die Szene gewechselt?“) und keine Anweisung („Falls die Szene gewechselt hat, beschreibe sie“). Kleine Modelle beantworten eine Anweisung oft mit nein, und der Block wird nie aktiv.
- Sag „in der neuesten Nachricht“, wenn du diesen Zug meinst. Das Modell liest mehrere Nachrichten, und eine frühere kann es zu einem Ja bringen.
- Benenne, um wen es geht. „Er ist wütend“ kann auf den falschen Charakter bezogen werden.
- Beschreib etwas, das im Text sichtbar ist, etwa eine Handlung oder einen gesprochenen Satz. Vermeide Stimmungswörter („Die Szene ist intensiv“) und verborgene Absichten („Mira lügt“).
- Halte es kurz. Teile eine lange Aussage auf, wenn du die Teile wiederverwenden oder einzeln auf Fehler untersuchen willst.

So testest du deine Formulierung:

1. Wähle unter **Decision model** ein Modell aus und klick auf **Test**. Das prüft die Verbindung mit einem festen Beispiel. Deine Aussage wird dabei nicht getestet.
2. Ergänze die Aussage in deinem Prompt und sende Nachrichten, bei denen sie wahr sein soll, und Nachrichten, bei denen sie falsch sein soll.
3. Nutze **Peek Prompt**, um zu sehen, welcher Zweig gesendet wurde. Öffne **Decision diagnostics** (Entscheidungsdiagnose) und wähle dann **Test decisions** (Entscheidungen testen), um neue Decision-Antworten zu bekommen, ohne eine Chat-Antwort zu generieren. Gehostete Tests können Geld kosten. Siehe [Entscheidungsaussagen testen](../chats/peek-prompt.md#testing-decision-statements).
4. Passe die Formulierung an und teste erneut. Um die Antworten laufender Generierungen zu sehen, schalte Debug Mode oder das [Debug-Logging](../CONFIGURATION.md#logging-levels) ein.

<a id="limits-and-cost"></a>

### Grenzen und Kosten

<a id="statement-allowance"></a>

#### Aussagenkontingent

**Decision statements per turn** unter **Decision model** steht standardmäßig auf 32. Das ist keine einzelne Grenze für alle Decision-Anfragen oder für die Ausgaben. Marinara wendet das Kontingent in Phasen an.

1. Die Aussagen des Haupt-Chat-Prompts werden innerhalb des Kontingents geplant. Lorebook-Decisions nutzen, was übrig bleibt.
2. Agenten, die vor oder parallel zur Antwort laufen, bekommen einen gemeinsamen Plan mit dem Haupt-Prompt, für den das Kontingent erneut gilt. In dieser Phase wird der Lorebook-Verbrauch nicht abgezogen; die Summe kann die Einstellung deshalb überschreiten.
3. Nachverarbeitende Agenten bekommen nach der Antwort ein eigenes Kontingent.

Aktivierungsfragen von Agenten und die Smart-Antwortreihenfolge sind von dieser Einstellung unabhängig.

In den Plan einer Phase kommen nur Aussagen, die sie nutzen kann: aktivierte Preset-Abschnitte und -Gruppen, ausgewählte Variablenoptionen und Inhalte aktivierter Lorebook-Einträge. Eine feste Bedingung kann eine Aussage ausschließen, etwa `{{#if char == "Dottore" && decision:"..."}}`, solange der Charakter Mira ist. Eine Variablenbedingung tut das nicht, weil sich Variablen beim Prompt-Aufbau ändern können. Aussagen, die von Sticky, Cooldown oder `every:` gehalten werden, belegen keinen Platz. Ausgelassene Aussagen gelten als nein.

#### Anfragen und Zeit

Bei einem gehosteten Decision-Konto kann ein Zug mehrere berechnete Anfragen verursachen. Aussagen lassen sich bündeln, doch Lorebook-Aktivierung, neu aktivierte Eintragsinhalte, rekursive Treffer und Agentenphasen können weitere Bündel brauchen. Ein lokales Chat-Modell verursacht statt Gebühren zusätzliche Rechenzeit und beantwortet `decision_choice:` mit einer Ja/Nein-Frage pro Option.

Jede Anfrage hat ein Zeitlimit: standardmäßig 1,5 Sekunden bei einem gehosteten Decision-Konto oder 4 Sekunden bei einem Konto für ein OpenAI-kompatibles Chat-Modell oder einem lokalen Modell. Siehe [Zeitlimits](../connections/decision-models.md#time-limits). Ein lokales Modell, das zuerst nachdenkt, hält sich vor der Antwort zurück, sofern du **Also gate agents that run before the reply** (auch Agenten vor der Antwort prüfen) nicht einschaltest.

<a id="answer-reuse"></a>

#### Antworten wiederverwenden

Marinara verwendet erfolgreiche Antworten normalerweise für denselben Zug und dasselbe Decision-Modell wieder. Eine Neugenerierung sendet daher oft dieselben Zweige ohne neue Anfrage. Der Cache liegt im laufenden Server und hält bis zu 200 Züge. Ein Neustart, eine Entfernung aus dem Cache, eine neue oder bearbeitete letzte Nachricht, ein anderes Modell oder eine geänderte Aussage oder Optionsmenge können eine neue Antwort nötig machen.

Fehlende oder fehlgeschlagene Antworten werden nicht zwischengespeichert. Eine Wiederholung kann deshalb erneut fragen und einen anderen Zweig nehmen. Für Aussagen in Agenten-Prompts gelten dieselben Regeln. Ein manuell wiederholter Agentenlauf verwendet Antworten wieder, die zu seinen Eingaben noch im Cache liegen. Siehe [Decision-Bedingungen im Agenten-Prompt](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Prompt-Caching

Der Prompt-Cache des Anbieters ist unabhängig von Marinaras Antwort-Cache. Er kann einen unveränderten Anfang des Prompts wiederverwenden, der an dein Chat-Modell geht. Ein wechselnder Decision-Zweig kann die Wiederverwendung ab dieser Stelle verhindern, auch wenn ein früherer unveränderter Teil weiterhin infrage kommen kann. Die Abrechnung hängt vom Anbieter ab.

Setze Decision-Blöcke, die oft wechseln, spät in den Prompt, etwa in Post-History-Anweisungen oder eine Autorennotiz mit geringer Tiefe. Lass eine Decision nur dann weit oben, wenn ihre Antwort selten wechselt. Für Variablenoptionen eines Presets gilt dasselbe, weil ihr Text dort landet, wo `{{name}}` steht.

Bei einem direkten Anthropic-Konto mit eingeschaltetem **Enable prompt caching** (Prompt-Caching aktivieren) markiert Marinara das Ende des System-Prompts und eine Chat-Nachricht, die **Cache depth** (Cache-Tiefe) Nachrichten vor der neuesten liegt (standardmäßig 5). Eine Änderung vor dem Verlauf kann die System-Grenze und den späteren Verlauf ungültig machen. Eine Änderung nach der markierten Verlaufsgrenze kann den zwischengespeicherten Teil erhalten. Die Mindestlänge für den Cache hängt vom Modell ab. Siehe die aktuelle Anleitung des Anbieters zum [Anthropic-Prompt-Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) oder zum [OpenAI-Prompt-Caching](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Wenn ein Decision-Zweig nie erscheint

Die wahrscheinlichsten Ursachen, in dieser Reihenfolge:

1. Es ist kein Decision-Modell ausgewählt. Jede Decision-Bedingung ist falsch. Der Editor zeigt unter jedem Feld, das eine verwendet, eine Warnung.
2. Das Decision-Modell antwortet nicht: ein falscher Key, kein Guthaben oder ein Anfragelimit bei einem gehosteten Konto, ein gestopptes oder zu langsames lokales Modell oder ein installiertes Entscheidungsmodell, das nicht gestartet ist.
3. Es ist ein Modell, das zuerst nachdenkt und sich vor der Antwort zurückhält.
4. Zu viele Aussagen in der Planungsphase, mehr als das Kontingent erlaubt.
5. Es antwortet, aber unterhalb seiner Schwelle. Meist liegt das an der Formulierung.

Prüfe, was **Test** meldet, und sieh mit **Peek Prompt** nach, welche Zweige gesendet wurden. Peek Prompt listet Aussagen auf, die noch keine Antwort haben; sie gelten als nein. Mit Log-Level debug werden jede Aussage, ihre Antwort und ob sie als ja galt protokolliert. Siehe [Log-Stufen](../CONFIGURATION.md#logging-levels). Selten liegt die Lösung im Preset. Meist geht es um die Formulierung oder um einen Zweig mit Inhalt, auf den der Prompt nicht verzichten kann.

## Verwandte Anleitungen

- [Decision-Modelle](../connections/decision-models.md)
- [Prompt-Makros](macros.md)
- [Preset-Variablen](preset-variables.md)
- [Gruppenchats und Gruppen-Conversations](../chats/group-chats.md)
