# Prompt-Makros

Ein Makro ist ein kurzes `{{tag}}`, das Marinara beim Bauen eines Prompts durch einen aktuellen Wert ersetzt, etwa deinen Namen oder das heutige Datum. Diese Anleitung listet alle eingebauten Makros auf, zeigt, wo du sie eintippen kannst, und nennt die Fehler, die du vermeiden solltest.

## Wo Makros funktionieren

Wenn Marinara den Text zusammenstellt, den es an die KI schickt, tauscht es jedes `{{tag}}` gegen seinen aktuellen Wert aus. Einen Schalter zum Einschalten von Makros gibt es nicht. Jedes Feld, das Makros unterstützt, löst sie immer auf. Bei den Namen eingebauter Makros spielt Groß- und Kleinschreibung keine Rolle, `{{user}}` und `{{USER}}` funktionieren also beide. Ein Makrowert kann ein weiteres Makro enthalten, und Marinara löst auch dieses auf.

An diesen Stellen kannst du Makros eintippen:

- In den Charakterfeldern im **Character Editor** (Charakter-Editor): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions und **Depth Prompt**.
- In den Persona-Feldern im **Persona Editor** (Persona-Editor) – dieselben Kartenfelder.
- In den Feldern Description und Content eines Lorebook-Eintrags.
- In den Prompt-Preset-Abschnitten im **Preset Editor** (Preset-Editor).
- In den Feldern Find, Replace und Trim eines Regex-Skripts.
- In den Prompt-Vorlagen der Agenten.
- Im Eingabefeld des Chats. Tipp `{{roll:1d20}}` in eine Nachricht, und das Makro wird vor dem Absenden aufgelöst.

Makros laufen innerhalb von Marinara und brauchen weder Einrichtung noch API-Key. Zwei Funktionen hängen von anderen Teilen der App ab:

- Preset-Variablen (das Auffangmuster `{{NAME}}`) brauchen ein Prompt-Preset, das sie definiert. Siehe [Preset-Variablen](preset-variables.md).
- Das Agent-Makro `{{agent::TYPE}}` zeigt erst dann Text, wenn der passende Agent gelaufen ist und eine Ausgabe erzeugt hat.

## Makros für Identität, Charakter und Persona

Diese Makros ziehen Namen und Kartenfelder der sprechenden Person und des antwortenden Charakters heran. Der User bist du (beziehungsweise deine aktive Persona). Der Charakter ist der Bot, der antwortet.

| Makro | Ergibt |
| --- | --- |
| `{{user}}` / `{{userName}}` | Deinen aktuellen Anzeigenamen (oder Persona-Namen). Ohne gesetzte Persona steht dort `User`. |
| `{{userNamePhonetic}}` | Den Phonetic name deiner Persona, oder `{{user}}`, wenn er leer ist. |
| `{{char}}` / `{{charName}}` | Den Namen des aktuellen Charakters. Standard ist `Character`. |
| `{{21-character-card-ID}}` | Name eines anderen Charakters. Ersetze den Platzhaltertext durch die genaue 21-stellige ID dieser Karte, um die Karte in den Kontext zu holen. |
| `{{persona-21-character-card-ID}}` | Name einer anderen Persona. Ersetze den Platzhaltertext nach `persona-` durch die genaue 21-stellige ID dieser Karte, um die Karte in den Kontext zu holen. |
| `{{charNamePhonetic}}` | Den Phonetic name des Charakters, oder `{{char}}`, wenn er leer ist. |
| `{{characters}}` | Alle Charaktere im Chat, einschließlich inaktiver Charaktere, durch Kommas getrennt. Dieses Makro fügt nur Namen hinzu; Karten inaktiver Charaktere kommen dadurch nicht in den Prompt. |
| `{{group}}` | Alle anderen aktiven Charaktere im Gruppenchat, ohne den gerade Antwortenden. Die Persona gehört nicht zu dieser Charakterliste. |
| `{{persona}}` | Description, Personality, Backstory, Appearance und Scenario deiner Persona, durch Zeilenumbrüche getrennt. |
| `{{personaDescription}}` | Das Feld Description deiner Persona. |
| `{{personaPersonality}}` | Das Feld Personality deiner Persona. |
| `{{personaBackstory}}` | Das Feld Backstory deiner Persona. |
| `{{personaAppearance}}` | Das Feld Appearance deiner Persona. |
| `{{personaScenario}}` | Das Feld Scenario deiner Persona. |

Die Charakterfeld-Makros lesen die Karte des aktuellen Charakters aus:

| Makro | Feld der Charakterkarte |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

In einem Chat mit einem einzelnen Charakter beziehen sie sich auf genau diesen. Im Gruppenchat greifen sie standardmäßig auf den ersten Charakter zu. Soll ein Text für jeden Charakter wiederholt werden, setz ihn in einen Gruppenblock in eckigen Klammern. Gruppenblöcke beschreibt [Bedingte Prompts](conditional-prompts.md).

`{{group}}` richtet sich nach dem gerade antwortenden Charakter, auch bei einzelnen Generierungen innerhalb der Gruppe. Antwortet zum Beispiel Pantalone in einer Roleplay-Gruppe aus Powers That Be, Maukie und Pantalone, ergibt `{{group}}` den Wert `Powers That Be, Maukie`. Eine Charakterkarte bleibt selbst dann in dieser Liste, wenn ihr Name zufällig `{{user}}` entspricht.

Das Feld Phonetic name hat zwei Aufgaben. Es legt fest, wie die Sprachausgabe den Namen ausspricht. Außerdem speist es `{{charNamePhonetic}}` und `{{userNamePhonetic}}`. Du findest es sowohl im **Character Editor** als auch im **Persona Editor**.

Willst du einen Charakter ansprechen, der nicht Teil des aktuellen Chats ist, kopiere die ID seiner Karte und setz sie direkt in doppelte geschweifte Klammern, zum Beispiel `{{V1StGXR8_Z5jdHi6B-myT}}`. Füge keine wörtlichen Zeichen `<` oder `>` ein. Marinara ersetzt das Makro durch den Namen des Charakters. In Roleplay-Chats mit einem Prompt-Preset ergänzt Marinara außerdem den System-Prompt um Description, Personality, Appearance, Backstory, Scenario und Example Dialogue der referenzierten Karte; in anderen Chats wird das Makro nur zum Namen. Das funktioniert in Chatnachrichten und Prompt-Feldern, in Roleplay-Chats mit Preset auch in aktivierten Lorebook-Einträgen. Die ersten Begrüßungen der referenzierten Karte bleiben außen vor. Aktivierte Lorebooks, die an dieser Karte hängen, unterliegen weiterhin ihren normalen Regeln für Schlüsselwörter, Constant-Einträge, Filter, Wahrscheinlichkeit und Token-Budget. Ist der Charakter bereits Teil des Chats, wird das Makro trotzdem zu seinem Namen, und seine Karte wird kein zweites Mal hinzugefügt.

Um auf eine andere Persona als die aktive zu verweisen, stell ihrer kopierten ID `persona-` voran, zum Beispiel `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara ersetzt das Makro durch den Namen der Persona und fügt Description, Personality, Appearance, Backstory und Scenario dieser Karte zum selben Kontext der ID Macro Cards hinzu. Aktivierte Lorebooks, die an dieser Persona hängen, behalten ihre normalen Aktivierungsregeln.

## Makros für den Conversation Mode

Diese vier Makros funktionieren nur im Conversation Mode. In allen anderen Modi ergeben sie immer nichts, auch wenn derselbe Karten- oder Preset-Text modusübergreifend genutzt wird.

| Makro | Ergibt |
| --- | --- |
| `{{convo_display}}` | Den **Convo Display Name** des Charakters, oder den Kartennamen, wenn das Feld leer ist. |
| `{{char_about}}` | Das aktuelle **About Me** des Charakters (die Überschreibung für diesen Chat, falls gesetzt, sonst den Kartenstandard). |
| `{{persona_about}}` | Das aktuelle About Me deiner Persona. |
| `{{convo_behavior}}` | Den Text **Convo Behavior** des Charakters, aber nur, wenn seine Einfügeeinstellung ihn an diesem Makro platziert. |

Bearbeiten kannst du diese Felder im Tab **Convo** des **Character Editor** und des **Persona Editor**. Die komplette Einrichtung beschreibt [Conversation-Mode-Profile](../conversation/profiles.md).

## Platzierungs-Makros im Conversation Mode

Der Conversation Mode fügt mehrere Blöcke automatisch für dich in den Prompt ein. Mit diesen Makros **verschiebt** ein Preset einen solchen Block dorthin, wo du das Makro setzt. Nutzt du eines davon, stellt Marinara den Block an der Makro-Stelle dar und **überspringt** die automatische Einfügung, sodass der Inhalt nie doppelt auftaucht. Jedes Makro hat einen oder mehrere Aliasnamen; alle verhalten sich gleich.

| Makro (und Aliasnamen) | Platziert |
| --- | --- |
| `{{context}}`, `{{status}}` | Den Kontext- beziehungsweise Statusblock des Chats. |
| `{{commands}}`, `{{commandList}}` | Die Erinnerung an die verfügbaren Befehle. |
| `{{reactRules}}`, `{{emojiReact}}` | Die Regeln für **Reaktionen** mit eigenen Emojis. |
| `{{replyRules}}` | Die Regeln für **Antworten** mit eigenen Emojis und Stickern. |
| `{{memories}}`, `{{memoryRecall}}` | Den Block mit den abgerufenen Erinnerungen. |
| `{{lorebook}}`, `{{lore}}` | Die Lorebook-Einfügungen. |

Diese Makros gelten nur im Conversation Mode. In einem Chat mit einem einzigen Charakter funktioniert es genauso, wenn du die Kurzprofile der Beteiligten selbst mit `{{char_about}}` / `{{persona_about}}` setzt (siehe oben): Marinara überspringt dann seinen automatischen „About Me“-Block für die Beteiligten, damit die Profile nicht zweimal eingefügt werden. In Gruppenchats bleibt der automatische Block erhalten, denn jedes der beiden Makros deckt nur einen Beteiligten ab und darf die Profile aller anderen nicht verdecken.

## Kontext-Makros

Diese Makros beschreiben den aktuellen Chat und die aktuelle Anfrage.

| Makro | Ergibt |
| --- | --- |
| `{{input}}` | Die neueste Nachricht des Users, die dem Prompt zur Verfügung steht. |
| `{{model}}` | Den Namen des aktuellen Modells, sofern eines ausgewählt ist. |
| `{{reasoning}}` | Die Reasoning-Stufe, mit der diese Antwort erzeugt wird: `low`, `medium`, `high`, `xhigh` oder `max`, oder `off`, wenn das Modell nicht zum Nachdenken aufgefordert wird. |
| `{{chatId}}` | Die ID des aktuellen Chats. |
| `{{lastGenerationType}}` | Eine Bezeichnung dafür, warum diese Antwort generiert wird. |
| `{{idle_duration}}` | Die Zeit seit der letzten Aktivität im Chat, als Text wie `8 minutes` oder `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Den aktuellen Zielwert **Keyframes per Turn** im Game Mode, von 1 bis 6. Standard ist `3`. |
| `{{agent::TYPE}}` | Die gespeicherte Ausgabe eines Agenten des angegebenen Typs. |

`{{reasoning}}` nennt die Stufe, die das Modell erhält, nachdem deine Preset-, Konto- und Chat-Einstellungen übereinandergelegt wurden. **Maximum** erscheint als die höchste Stufe, die das Modell annimmt, und kann deshalb `max`, `xhigh` oder `high` lauten. Weil `off` als falsch gilt, behält `{{#if reasoning}}` einen Block nur, solange das Modell nachdenkt. Hat dein Preset oder Chat bereits eine eigene Variable namens `reasoning`, behält diese Variable den Namen.

Der Wert von `{{lastGenerationType}}` ist eine schlichte Bezeichnung. In der App tauchen zum Beispiel `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` und `retry_agents` auf. Die Liste kann wachsen, betrachte sie also als Beispiele, nicht als feste Auswahl.

`{{gameStoryboardKeyframeCount}}` steht den GM-Prompts im Game Mode zur Verfügung, auch dem eingebauten **Storyboard Game Prompt**. Der Wert ist ein erzählerischer Richtwert, keine Vorgabe für exakt so viele Absätze. Enthält ein Zug zu wenige eigenständige visuelle Momente, liefert die Storyboard-Planung weiterhin weniger Aufnahmen.

Das Makro `{{agent::TYPE}}` fügt die gespeicherte Ausgabe eines Agenten ein, also eines Helfers im Hintergrund, der etwa einen Szenen-Tracker füllt. Am einfachsten fügst du es im **Preset Editor** hinzu: Klick auf **Add Section** (Abschnitt hinzufügen), öffne die Gruppe **Agent Sections** und wähl einen Agenten aus. Marinara legt einen Abschnitt an, der bereits das passende `{{agent::TYPE}}`-Tag enthält. Dieses Makro wird zuletzt aufgelöst, deshalb kann Agent-Text keine weiteren Makros in deinen Prompt einschleusen.

## Lorebook-Outlet-Makros

`{{outlet::name}}` fügt Inhalte aus den Lorebook-Einträgen ein, deren **Position** auf **Outlet** steht und deren **Outlet name** exakt `name` entspricht. Bei Outlet-Namen zählt die Groß- und Kleinschreibung: `{{outlet::character_rules}}` passt zum Beispiel nicht auf ein Outlet namens `Character_Rules`.

Auch Outlet-Einträge werden ganz normal aktiviert. Schlüsselwörter, der Constant-Modus, Wahrscheinlichkeit, Filter, Timing, Eintragslimits und Token-Budgets entscheiden, ob ein Eintrag für die aktuelle Generierung aktiv ist. Aktive Einträge mit demselben Outlet-Namen werden in ihrer **Order** aneinandergehängt und durch Zeilenumbrüche getrennt. Eingefügt werden sie nur am Makro, nicht zusätzlich an einer normalen Lorebook-Position.

Outlet-Makros kannst du in Prompt-Abschnitten im Conversation Mode, im Roleplay Mode oder im Game Mode einsetzen. Das Makro funktioniert selbst dann, wenn es vor dem Lorebook-Marker des Presets steht, und ein Preset braucht keinen Lorebook-Marker, solange es nur Outlet-Einträge nutzt. Ein unbekanntes oder inaktives Outlet ergibt nichts. Ein Outlet-Eintrag kann kein weiteres Outlet-Makro auflösen, verschachtelte Outlets laufen also nicht rekursiv.

## Makro für die Lorebook-Größe

`{{lorebooksize::ID}}` ergibt die Gesamtzahl der Einträge im Lorebook mit dieser ID. Ersetze `ID` durch die ID des Lorebooks, die du im Panel **Lorebooks** kopieren kannst. Hat etwa ein Lorebook die ID `V1StGXR8_Z5jdHi6B-myT` und enthält 151 Einträge, ergibt `{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}` den Wert `151`.

Unbekannte Lorebook-IDs ergeben `0`. Gezählt werden alle Einträge, unabhängig davon, ob sie aktiviert, deaktiviert oder in Ordnern liegen.

Verwende dieses Makro in Prompt-Abschnitten, Charakterkartenfeldern, Lorebook-Eintragstexten oder überall sonst, wo Makros aufgelöst werden.

<a id="lorebook-include-macro"></a>

## Makro zum Einbinden von Lorebook-Einträgen

`{{include::ENTRY}}` fügt den Text eines Lorebook-Eintrags genau dort ein, wo du das Makro schreibst. Leg einen gemeinsam genutzten Text wie Hausregeln in einem einzigen Eintrag ab und verwende ihn in anderen Einträgen, Prompt-Abschnitten oder Karten wieder, dann gibt es nur eine Kopie, die du bearbeiten musst. Ersetze `ENTRY` durch die ID oder den Namen des Eintrags. Bei Namen spielt Groß- und Kleinschreibung keine Rolle.

- Innerhalb eines Lorebook-Eintrags wird ein Name im eigenen Lorebook dieses Eintrags gesucht.
- Überall sonst wird ein Name in den Lorebooks gesucht, die dieser Chat nutzt: in denen, die dem Chat hinzugefügt sind, in denen, die mit seinen Charakteren und seiner Persona verknüpft sind, und in den globalen.
- Über eine ID wird der Eintrag in jedem Lorebook gefunden.

`{{include::BOOK::ENTRY}}` holt den Eintrag aus dem Lorebook, das du per ID oder Namen angibst. Dieses Lorebook muss weder dem Chat hinzugefügt noch überhaupt eingeschaltet sein.

```text
{{include::Rules of the arena}}
{{include::Shared lore::Rules of the arena}}
```

Der eingebundene Eintrag muss nicht selbst aktiviert werden und darf sogar ausgeschaltet sein. So kannst du Einträge anlegen, die nur zum Einbinden da sind. Makros im eingebundenen Text funktionieren wie gewohnt, und er kann seinerseits weitere Einträge einbinden. Führt eine Einbindung zurück zu einem Eintrag, in dem sie bereits steckt, etwa bei einem Eintrag, der sich selbst einbindet, ergibt diese Einbindung nichts, statt sich endlos zu wiederholen. Ein Eintrag oder Lorebook, der nicht gefunden wird, ergibt ebenfalls nichts.

Schreib Namen und IDs als reinen Text. Makros darin, etwa `{{include::{{char}}}}`, werden nicht aufgelöst.

## Zeit-Makros

Die Zeit-Makros für die reale Welt lesen pro Auflösung denselben Zeitpunkt und stimmen daher immer miteinander überein. Die Zeitzone kommt aus deinem Browser.

| Makro | Ergibt |
| --- | --- |
| `{{date}}` | Das aktuelle Datum im Format `YYYY-MM-DD`. |
| `{{time}}` | Die aktuelle Uhrzeit als `HH:MM` im 24-Stunden-Format. |
| `{{datetime}}` / `{{isotime}}` | Einen vollständigen Zeitstempel samt Zeitzonen-Offset. Beide Namen bedeuten dasselbe. |
| `{{weekday}}` | Den Namen des Wochentags, etwa `Monday`. |
| `{{timezone}}` | Den Namen der Zeitzone, etwa `Europe/Warsaw`. |
| `{{date.world_state}}` | Das von World State erfasste aktuelle Datum der Welt, in seinem ursprünglichen Format. |
| `{{time.world_state}}` | Die von World State erfasste aktuelle Uhrzeit der Welt, in ihrem ursprünglichen Format. |
| `{{weekday.world_state}}` | Ein eigenes Weltfeld namens Weekday oder Day of Week, ein im erfassten Datum ausgeschriebener Wochentag oder der Wochentag eines gültigen erfassten Datums im Format `YYYY-MM-DD`. |

Die `.world_state`-Makros funktionieren in Prompts und Agentenvorlagen. Sie lesen das Datum und die Uhrzeit der Welt, die für den aktuellen Erzählzug angezeigt werden. Wechselst du den Swipe, ändert sich, aus welchem Zug sie ihre Werte nehmen; beim erneuten Generieren gilt der Erzählzustand, von dem die Ersatzantwort ausgeht. Ein fehlender Wert bleibt leer und fällt nie auf die heutige reale Uhrzeit zurück. Fiktive Kalender behalten ihren eigenen Datums- und Zeittext. Für einen fiktiven Wochentag legst du in World State ein eigenes Feld namens Weekday oder Day of Week an.

Zum Beispiel liest `{{#if weekday.world_state == "Monday"}}Use the weekday routine.{{/if}}` den erfassten Wochentag statt des realen.

## Zufalls- und Würfel-Makros

Diese Makros bringen Zufall in deine Prompts. Für Zahlen und Auswahlmöglichkeiten nimmst du das Zufalls-Makro (`{{random}}`), für Würfel das Wurf-Makro (`{{roll}}`).

| Makro | Verhalten |
| --- | --- |
| `{{random}}` | Eine zufällige ganze Zahl von 0 bis 100. |
| `{{random:X:Y}}` | Eine zufällige ganze Zahl zwischen X und Y, beide eingeschlossen. |
| `{{random::A::B::C}}` | Wählt zufällig eine Option und löst danach Makros nur innerhalb der gewählten Option auf. |
| `{{random::A@2::B@0.5}}` | Eine gewichtete Zufallsauswahl. Die Regeln dazu stehen weiter unten. |
| `{{roll:XdY}}` | Die Summe eines Würfelwurfs. `{{roll:2d6}}` würfelt zum Beispiel zwei sechsseitige Würfel und addiert sie. `{{roll:d20}}` würfelt einen Würfel, und `{{roll:1d8+3}}` addiert 3 zum Wurf. |

Hier eine einfache Zufallsauswahl zum Kopieren:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Gewichtete Auswahl

Häng ein abschließendes `@number` an eine Option, um festzulegen, wie wahrscheinlich sie ist. Die Zahl ist ein relatives Gewicht: größer heißt wahrscheinlicher.

```text
{{random::Common event@1::Rare event@0.25}}
```

In diesem Beispiel beträgt das Gesamtgewicht 1,25, die Chancen verteilen sich also so:

| Option | Gewicht | Chance |
| --- | --- | --- |
| Common event | 1 | 80 % |
| Rare event | 0.25 | 20 % |

Regeln für die Gewichtung:

- Ein fehlendes Gewicht zählt als 1.
- Dezimalwerte sind erlaubt, etwa 0.5 oder 0.01.
- Ein Gewicht von 0 behält die Option, sie wird aber nie gezogen.
- Haben alle Optionen das Gewicht 0, ergibt das Makro nichts.
- Nur ein abschließendes `@number` zählt als Gewicht. Ein `@` an anderer Stelle, etwa in einer E-Mail-Adresse, bleibt unangetastet.

## Dynamische Variablen

Mit Variablen speichert eine Stelle im Prompt einen Wert, den eine spätere Stelle wieder ausliest.

| Makro | Verhalten |
| --- | --- |
| `{{setvar::name::value}}` | Speichert einen Wert und hinterlässt nichts im Text. |
| `{{getvar::name}}` | Liest einen gespeicherten Wert (nichts, wenn er nie gesetzt wurde). |
| `{{addvar::name::value}}` | Addiert die Zahlen, wenn beide Werte numerisch sind; andernfalls wird der neue Text angehängt. |
| `{{addnumvar::name::value}}` | Marinara-Erweiterung: addiert immer eine Zahl zu einem gespeicherten Zahlenwert. Fehlende oder ungültige Zahlen zählen als 0; eine Addition mit Überlauf wird ignoriert. |
| `{{incvar::name}}` | Zählt 1 zu einer numerischen Variablen hinzu und fügt den neuen Wert ein. |
| `{{decvar::name}}` | Zieht 1 von einer numerischen Variablen ab und fügt den neuen Wert ein. |

Innerhalb eines Prompt-Aufbaus werden Variablen von links nach rechts aufgelöst. Ein früh gesetzter Wert, etwa in einem Lorebook-Eintrag, der zuerst kommt, lässt sich später im selben Prompt auslesen. Marinara speichert sie außerdem im aktuellen Chat, so wie SillyTavern lokale Variablen behandelt: Sie bleiben über spätere Züge und Neustarts der App erhalten, während ein anderer Chat eigene, getrennte Werte hat.

Jedes `{{NAME}}`, das kein eingebautes Makro ist, wird nach seinem Namen gesucht: zuerst unter den Preset-Variablen, dann unter den Variablen des Chats. Kommt der Name in keiner der beiden Gruppen vor, bleibt der Tag genau so im Text stehen, wie du ihn eingegeben hast. Wenn beide denselben Namen verwenden, hat die Preset-Variable Vorrang. Den Preset-Teil erklärt [Preset-Variablen](preset-variables.md).

### Chat-Variablen

Du musst keine Variable mit `{{setvar}}` anlegen. Im Abschnitt **Chat Variables** (Chat-Variablen) des Panels **Chat Settings** (Chat-Einstellungen) kannst du direkt einen Namen und einen Wert eingeben und den Namen dann überall verwenden, wo Makros funktionieren, auch in deinen eigenen Nachrichten. Leg `char1` mit dem Wert `Mary` an, schreib `{{char1}} walks in.`, und die KI liest „Mary walks in.“

Regeln für Chat-Variablen:

- Namen dürfen Buchstaben, Zahlen und Unterstriche enthalten und müssen mit einem Buchstaben oder Unterstrich beginnen. Namen mit genau 21 Zeichen sind für Charakterverweise reserviert. Einen Namen mit Punkt oder Bindestrich kannst du weiterhin mit `{{setvar}}` setzen und mit `{{getvar}}` lesen, aber er wird nicht als bloßes `{{name}}` aufgelöst.
- Der Name eines eingebauten Makros ist nicht erlaubt. `{{char}}` steht immer für den Charakter.
- Deine eigene Nachricht zeigt weiterhin den eingegebenen Tag. Der Wert wird beim Aufbau des Prompts eingesetzt. Änderst du ihn später, ändern sich also auch die früheren Züge, die ihn verwendet haben.
- Der Abschnitt listet auch Variablen aus `{{setvar}}` auf, da sie sich denselben Speicher pro Chat teilen.

Das Panel selbst beschreibt [Chat Settings im Überblick](../chats/chat-settings.md).

## Formatierungs-Makros

Diese Makros formen den Text um sie herum.

| Makro | Verhalten |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Fügt einen Zeilenumbruch ein. |
| `{{trim}}` | Entfernt sich selbst und schneidet Leerraum an dieser Stelle weg. |
| `{{trimStart}}` | Schneidet Leerraum am Anfang des umgebenden Texts weg. |
| `{{trimEnd}}` | Schneidet Leerraum am Ende des umgebenden Texts weg. |
| `{{uppercase}}...{{/uppercase}}` | Schreibt den eingeschlossenen Text in GROSSBUCHSTABEN. |
| `{{lowercase}}...{{/lowercase}}` | Schreibt den eingeschlossenen Text in Kleinbuchstaben. |
| `{{noop}}` | Verschwindet aus der Ausgabe. Praktisch als harmloser Platzhalter beim Bearbeiten. |
| `{{// comment}}` | Eine Autorennotiz, die aus der Ausgabe entfernt wird. |
| `{{banned "text"}}` | Verschwindet aus der Ausgabe. Es filtert oder blockiert nichts. |

## Doppelte geschweifte Klammern sichtbar lassen

Ein Escape-Zeichen für Makros gibt es nicht. Sollen doppelte geschweifte Klammern im Text stehen bleiben, nimm einen Namen, den Marinara nicht kennt. Jedes unbekannte `{{name}}` bleibt genau so stehen, wie du es getippt hast, solange weder eine Preset-Variable noch eine Chat-Variable denselben Namen trägt. Brauchst du eine private Notiz, die nie bei der KI landet, nimm stattdessen `{{// like this}}`.

## Die Makro-Referenz und /macros

Jedes Feld mit Makro-Unterstützung hat zwei kleine Schaltflächen in der Ecke:

- **Expand editor** (Editor vergrößern) öffnet ein größeres Bearbeitungsfenster für das Feld.
- **Macro reference** (Makro-Referenz) öffnet ein Fenster mit dem Titel **Macro reference**, das alle eingebauten Makros nach Kategorie auflistet, jeweils mit der exakten Syntax. Die Liste stammt aus derselben Quelle, die auch die Engine nutzt, und stimmt deshalb immer.

Diese Felder vervollständigen außerdem Makronamen für dich. Tippst du `{{ch` am Ende einer Zeile, erscheint der Rest, `ar}}`, in blasser Schrift. Drück Tab oder tipp auf den blassen Text, um ihn zu übernehmen. Tipp einfach weiter, um ihn zu ignorieren. Bei einem Makro, das einen Wert erwartet, etwa `{{getvar::`, hört die Ergänzung dort auf, wo du den Wert eintippst.

Du kannst auch `/macros` ins Chatfeld tippen (die Kurzform `/macro` geht ebenfalls). Der Befehl gibt die vollständige Makro-Liste direkt im Chat aus, als schnelle Gedächtnisstütze.

## Bedingungen mit Makros

Bedingte Blöcke (`{{#if ...}}`) können Vergleiche mit `||` (ODER), `&&` (UND) und Klammern verknüpfen. Für Gleichheitslisten gibt es die kompakte Form `{{#if character == "Maukie" || "Pantalone"}}`. Vorrangregeln, Beispiele für Gruppenchats und die vollständige Operatorenliste findest du unter [Bedingte Prompts](conditional-prompts.md).

Eine Bedingung kann auch dein Decision-Modell zur Szene befragen, zum Beispiel `{{#if decision:"The latest message moves the scene to a new place"}}` für ja oder nein und `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, um eine Option auszuwählen. Ohne Decision-Modell oder ohne Antwort zählen sie als Nein. Siehe [Das Decision-Modell fragen](conditional-prompts.md#asking-the-decision-model). Diese Optionen kannst du hinter einer Aussage ergänzen:

- `sticky:3 cooldown:5` hält ein Ja drei Züge lang und pausiert es dann für fünf. Siehe [Sticky und Cooldown](conditional-prompts.md#sticky-and-cooldown).
- `until:"..."` oder `while:"..."` hält ein Ja so lange, wie eine zweite Aussage es zulässt. Siehe [Until und While](conditional-prompts.md#until-and-while).
- `every:3` fragt eine Aussage nur alle drei Züge ab. Siehe [Alle paar Züge prüfen](conditional-prompts.md#checking-every-few-turns).
- `priority:high` oder `priority:low` bestimmt, welche Aussagen in einen Prompt-Plan passen. Siehe [Priorität](conditional-prompts.md#priority) und [Grenzen und Kosten](conditional-prompts.md#limits-and-cost).

## Typische Fehler

- Schreib keine Variablen in einen `{{random::...}}`-Block. Ein `{{setvar}}` in einer Zufallsoption läuft für jede Option, bevor die Wahl fällt, nicht nur für die gezogene.
- Nutze eine lokale Variable nicht als globalen Zustand. Sie bleibt nur in dem Chat erhalten, in dem sie gesetzt wurde.
- Ein Prompt-Abschnitt oder Lorebook-Eintrag, der `{{setvar}}` ausführt, überschreibt eine gleichnamige Chat-Variable, da beide denselben Speicher pro Chat nutzen. Gib ihnen unterschiedliche Namen, wenn du beide behalten möchtest.
- `{{prompt}}` ist kein Makro. Besteht deine gesamte Nachricht aus `{{prompt}}`, öffnet Marinara die Ansicht **Peek Prompt**, statt die Nachricht zu senden. Siehe [Peek Prompt](../chats/peek-prompt.md).
- Custom Tools arbeiten nicht mit `{{macro}}`-Text. Füg also kein `{{roll:1d20}}` in ein Tool-Feld ein in der Erwartung, dass es aufgelöst wird.
- Die Prompt-Vorlage **Impersonate** akzeptiert nur wenige Platzhalter, nicht die komplette Makro-Liste. Auch ihre Namen weichen ab, ein Makro, das auf einer Karte funktioniert, tut es dort also womöglich nicht.
- Große oder tief verschachtelte Makro-Ausgaben werden stillschweigend abgeschnitten. Eine Fehlermeldung gibt es nicht, halte die Makro-Auflösungen also in einem vernünftigen Rahmen.

## Verwandte Anleitungen

- [Bedingte Prompts](conditional-prompts.md)
- [Preset-Variablen](preset-variables.md)
- [Preset-Editor und Prompt-Manager](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Conversation-Mode-Profile](../conversation/profiles.md)
