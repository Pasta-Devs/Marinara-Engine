# Prompt-Makros

In dieser Anleitung erfährst du, wie Prompt-Makros in Marinara Engine funktionieren. Ein Makro ist ein kurzes `{{tag}}`, das Marinara durch einen aktuellen Wert ersetzt. Eingesetzt wird dieser Wert beim Bauen des Prompts – also des Texts, den Marinara an die KI schickt –, etwa dein Name oder das heutige Datum. Du lernst alle eingebauten Makros kennen, außerdem die Felder, in denen sie funktionieren, und die typischen Fehler.

## Was Makros sind und wo sie funktionieren

Ein Makro ist reiner Text in doppelten geschweiften Klammern, zum Beispiel `{{user}}` oder `{{char}}`. Baut Marinara den Text für die KI zusammen, sucht die Engine nach diesen Tags und tauscht jeden gegen seinen aktuellen Wert. Einen Schalter zum Aktivieren gibt es nicht: Jedes Feld, das Makros unterstützt, löst sie immer auf.

Bei eingebauten Tags spielt Groß- und Kleinschreibung keine Rolle. `{{user}}` und `{{USER}}` funktionieren also gleichermaßen.

Makros lassen sich an vielen Stellen der App eintippen:

- In den Charakterfeldern im **Character Editor** (Charakter-Editor): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions und **Depth Prompt**.
- In den Persona-Feldern im **Persona Editor** (Persona-Editor) – dieselben Kartenfelder.
- In den Feldern Description und Content eines Lorebook-Eintrags. Ein Lorebook ist eine Sammlung von Weltwissen.
- In den Prompt-Preset-Abschnitten im **Preset Editor** (Preset-Editor). Ein Preset ist eine gespeicherte Prompt-Vorlage.
- In den Feldern Find, Replace und Trim eines Regex-Skripts.
- In den Prompt-Vorlagen der Agenten.
- Im Eingabefeld des Chats. Tipp `{{roll:1d20}}` in eine Nachricht, und das Makro wird vor dem Absenden aufgelöst.

Steckt in einem Makrowert ein weiteres Makro, löst Marinara auch dieses auf.

## Bevor du loslegst

Vorbereiten musst du nichts. Die eingebauten Makros funktionieren sofort, ohne API-Key und ohne zusätzliche Verbindung. Der API-Key ist der geheime Zugangscode, über den Marinara mit einem KI-Anbieter spricht – Makros laufen jedoch komplett innerhalb von Marinara.

Zwei Makro-Funktionen hängen allerdings von anderen Teilen der App ab:

- Preset-Variablen (das Auffangmuster `{{NAME}}`) brauchen ein Prompt-Preset, das sie definiert. Siehe [Preset-Variablen](preset-variables.md).
- Das Agent-Makro `{{agent::TYPE}}` zeigt erst dann Text, wenn der passende Agent gelaufen ist und eine Ausgabe erzeugt hat.

## Makros für Identität, Charakter und Persona

Diese Makros ziehen Namen und Kartenfelder der sprechenden Person und des antwortenden Charakters heran. Der User bist du (beziehungsweise deine aktive Persona). Der Charakter ist der KI-Charakter, der antwortet.

| Makro | Ergibt |
| --- | --- |
| `{{user}}` / `{{userName}}` | Deinen aktuellen Anzeigenamen (oder Persona-Namen). Ohne gesetzte Persona steht dort `User`. |
| `{{userNamePhonetic}}` | Das Feld Phonetic deiner Persona, oder `{{user}}`, wenn es leer ist. |
| `{{char}}` / `{{charName}}` | Den Namen des aktuellen Charakters. Standard ist `Character`. |
| `{{<21-character-card-ID>}}` | Platzhalter-Syntax für den Namen einer anderen Charakterkarte. Ersetze den Text in den spitzen Klammern durch die exakte 21-stellige ID dieser Karte. |
| `{{persona-21-character-card-ID}}` | Platzhalter-Syntax für den Namen einer anderen Persona. Ersetze den Text nach `persona-` durch die exakte 21-stellige ID dieser Karte, um ihren Kartenkontext abzurufen. |
| `{{charNamePhonetic}}` | Das Feld Phonetic des Charakters, oder `{{char}}`, wenn es leer ist. |
| `{{characters}}` | Alle Charaktere im Chat, durch Kommas getrennt. |
| `{{group}}` | Alle anderen aktiven Charaktere im Gruppenchat, ohne den gerade Antwortenden. Die Persona zählt nicht zu dieser Charakterliste. |
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

In einem Chat mit einem einzelnen Charakter beziehen sie sich auf genau diesen. Im Gruppenchat greifen sie standardmäßig auf den ersten Charakter zu. Soll ein Text für jeden Charakter wiederholt werden, setz ihn in einen Gruppenblock in eckigen Klammern. Mehr dazu unter [Bedingte Prompts](conditional-prompts.md).

`{{group}}` richtet sich nach dem gerade antwortenden Charakter, auch bei einzelnen Generierungen innerhalb der Gruppe. Antwortet also Pantalone in einer Roleplay-Gruppe aus Powers That Be, Maukie und Pantalone, ergibt `{{group}}` den Wert `Powers That Be, Maukie`. Eine Charakterkarte bleibt selbst dann in dieser Liste, wenn ihr Name zufällig `{{user}}` entspricht.

Das Feld Phonetic hat zwei Aufgaben. Es legt fest, wie die Sprachausgabe den Namen ausspricht. Und es speist `{{charNamePhonetic}}` und `{{userNamePhonetic}}`. Du findest es sowohl im **Character Editor** als auch im **Persona Editor**.

Willst du einen Charakter ansprechen, der nicht Teil des aktuellen Chats ist, kopiere die ID seiner Karte und setz sie direkt in doppelte geschweifte Klammern, zum Beispiel `{{V1StGXR8_Z5jdHi6B-myT}}`. Marinara ersetzt das Makro durch den Namen der Karte und ergänzt den System-Prompt um den Charakterkontext der referenzierten Karte. Begrüßungen und Beispieldialoge dieser Karte bleiben außen vor. Aktivierte Lorebooks, die an dieser Karte hängen, unterliegen weiterhin ihren normalen Regeln für Schlüsselwörter, **Constant**-Einträge, Filter, Wahrscheinlichkeit und Token-Budget.

Um auf eine inaktive Persona zu verweisen, stell ihrer kopierten ID `persona-` voran, zum Beispiel `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara ersetzt das Makro durch den Namen der Persona und fügt ihre Felder Description, Personality, Appearance, Backstory und Scenario zu den ID Macro Cards hinzu. Angehängte Lorebooks folgen weiterhin ihren normalen Aktivierungsregeln.

## Makros für den Conversation Mode

Diese vier Makros funktionieren ausschließlich im Conversation Mode. In allen anderen Modi ergeben sie immer nichts – auch dann, wenn derselbe Karten- oder Preset-Text modusübergreifend genutzt wird.

| Makro | Ergibt |
| --- | --- |
| `{{convo_display}}` | Den **Convo Display Name** des Charakters, oder den Kartennamen, wenn das Feld leer ist. |
| `{{char_about}}` | Das aktuelle **About Me** des Charakters (die Überschreibung für diesen Chat, sonst den Kartenstandard). |
| `{{persona_about}}` | Das aktuelle About Me deiner Persona. |
| `{{convo_behavior}}` | Den Text **Convo Behavior** des Charakters, aber nur, wenn dessen Einfügeeinstellung ihn an diesem Makro platziert. |

Bearbeiten kannst du diese Felder im Tab **Convo** des **Character Editor** und des **Persona Editor**. Die komplette Einrichtung beschreibt [Conversation-Mode-Profile](../conversation/profiles.md).

## Platzierungs-Makros im Conversation Mode

Der Conversation Mode fügt mehrere Blöcke automatisch in den Prompt ein. Mit diesen Makros **verschiebt** ein Preset einen solchen Block dorthin, wo du das Makro setzt. Marinara stellt den Block dann an der Makro-Stelle dar und **überspringt** die automatische Einfügung – der Inhalt taucht also nie doppelt auf. Jedes Makro hat einen oder mehrere Aliasnamen; alle verhalten sich identisch.

| Makro (und Aliasnamen) | Platziert |
| --- | --- |
| `{{context}}`, `{{status}}` | Den Kontext- beziehungsweise Statusblock des Chats. |
| `{{commands}}`, `{{commandList}}` | Die Erinnerung an die verfügbaren Befehle. |
| `{{reactRules}}`, `{{emojiReact}}` | Die Regeln für **Reaktionen** mit eigenen Emojis. |
| `{{replyRules}}` | Die Regeln für **Antworten** mit eigenen Emojis und Stickern. |
| `{{memories}}`, `{{memoryRecall}}` | Den Block mit den abgerufenen Erinnerungen. |
| `{{lorebook}}`, `{{lore}}` | Die Lorebook-Einfügungen. |

Das alles gilt nur im Conversation Mode. In einem Chat mit einem einzigen Charakter funktioniert es genauso, wenn du die Kurzprofile der Beteiligten selbst per `{{char_about}}` / `{{persona_about}}` setzt (siehe oben): Marinara überspringt dann seinen automatischen „About Me“-Block, damit die Profile nicht zweimal erscheinen. In Gruppenchats bleibt der automatische Block erhalten, denn jedes der beiden Makros deckt nur einen Beteiligten ab und darf die Profile aller anderen nicht verstecken.

## Kontext-Makros

Diese Makros beschreiben den aktuellen Chat und die aktuelle Anfrage.

| Makro | Ergibt |
| --- | --- |
| `{{input}}` | Die neueste Nachricht des Users, die dem Prompt zur Verfügung steht. |
| `{{model}}` | Den Namen des aktuellen Modells, sofern eines ausgewählt ist. |
| `{{chatId}}` | Die ID des aktuellen Chats. |
| `{{lastGenerationType}}` | Eine Bezeichnung dafür, warum diese Antwort generiert wird. |
| `{{idle_duration}}` | Die Zeit seit der letzten Aktivität im Chat, als Text wie `8 minutes` oder `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | Den aktuellen Zielwert **Keyframes per Turn** im Game Mode, von 1 bis 6. Standard ist `3`. |
| `{{agent::TYPE}}` | Die gespeicherte Ausgabe eines Agenten des angegebenen Typs. |

Der Wert von `{{lastGenerationType}}` ist eine schlichte Bezeichnung. In der App tauchen zum Beispiel `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` und `retry_agents` auf. Die Liste kann wachsen – betrachte sie also als Beispiele, nicht als feste Auswahl.

`{{gameStoryboardKeyframeCount}}` steht den GM-Prompts im Game Mode zur Verfügung, auch dem eingebauten **Storyboard Game Prompt**. Der Wert ist ein erzählerischer Richtwert, keine Vorgabe für exakt so viele Absätze. Enthält ein Zug zu wenige eigenständige visuelle Momente, liefert die Storyboard-Planung weiterhin weniger Aufnahmen.

Das Makro `{{agent::TYPE}}` fügt die gespeicherte Ausgabe eines Agenten ein – also eines Helfers im Hintergrund, der etwa einen Szenen-Tracker füllt. Am einfachsten geht das im **Preset Editor**: Klick auf **Add Section** (Abschnitt hinzufügen), öffne die Gruppe **Agent Sections** und wähl einen Agenten aus. Marinara legt daraufhin einen Abschnitt an, der bereits das passende `{{agent::TYPE}}`-Tag enthält. Dieses Makro wird zuletzt aufgelöst, damit Agent-Text keine weiteren Makros in den Prompt einschleusen kann.

## Lorebook-Outlet-Makros

`{{outlet::name}}` fügt Inhalte aus den Lorebook-Einträgen ein, deren **Position** auf **Outlet** steht und deren **Outlet name** exakt `name` entspricht. Ein Outlet ist eine benannte Ausgabestelle im Prompt. Bei Outlet-Namen zählt die Groß- und Kleinschreibung: `{{outlet::character_rules}}` passt zum Beispiel nicht auf ein Outlet namens `Character_Rules`.

Auch Outlet-Einträge werden ganz normal aktiviert. Schlüsselwörter, der Constant-Modus, Wahrscheinlichkeit, Filter, Timing, Eintragslimits und Token-Budgets entscheiden, ob ein Eintrag für die aktuelle Generierung aktiv ist. Aktive Einträge mit demselben Outlet-Namen werden in ihrer **Order** aneinandergehängt und durch Zeilenumbrüche getrennt. Eingefügt werden sie nur am Makro – nicht zusätzlich an einer normalen Lorebook-Position.

Outlet-Makros kannst du in Prompt-Abschnitten im Conversation Mode, im Roleplay Mode oder im Game Mode einsetzen. Das Makro funktioniert selbst dann, wenn es vor dem Lorebook-Marker des Presets steht, und ein Preset braucht gar keinen Lorebook-Marker, solange es nur Outlet-Einträge nutzt. Ein unbekanntes oder inaktives Outlet ergibt nichts. Ein Outlet-Eintrag kann kein weiteres Outlet-Makro auflösen, verschachtelte Outlets laufen also nicht rekursiv.

## Zeit-Makros

Alle Zeit-Makros lesen pro Auflösung denselben Zeitpunkt und stimmen daher immer miteinander überein. Die Zeitzone kommt aus dem Browser.

| Makro | Ergibt |
| --- | --- |
| `{{date}}` | Das aktuelle Datum im Format `YYYY-MM-DD`. |
| `{{time}}` | Die aktuelle Uhrzeit als `HH:MM` im 24-Stunden-Format. |
| `{{datetime}}` / `{{isotime}}` | Einen vollständigen Zeitstempel samt Zeitzonen-Offset. Beide Namen bedeuten dasselbe. |
| `{{weekday}}` | Den Namen des Wochentags, etwa `Monday`. |
| `{{timezone}}` | Den Namen der Zeitzone, etwa `Europe/Warsaw`. |

## Zufalls- und Würfel-Makros

Diese Makros bringen Zufall in den Prompt. Für Zahlen und Auswahlmöglichkeiten nimmst du das Zufalls-Makro (`{{random}}`), für Würfel das Wurf-Makro (`{{roll}}`).

| Makro | Verhalten |
| --- | --- |
| `{{random}}` | Eine zufällige ganze Zahl von 0 bis 100. |
| `{{random:X:Y}}` | Eine zufällige ganze Zahl zwischen X und Y, beide eingeschlossen. |
| `{{random::A::B::C}}` | Wählt zufällig eine Option und löst Makros nur innerhalb der gewählten Option auf. |
| `{{random::A@2::B@0.5}}` | Eine gewichtete Zufallsauswahl. Die Regeln dazu stehen weiter unten. |
| `{{roll:XdY}}` | Die Summe eines Würfelwurfs. `{{roll:2d6}}` würfelt zum Beispiel zwei sechsseitige Würfel und addiert sie. |

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
| `{{addvar::name::value}}` | Addiert numerisch, wenn beide Werte Zahlen sind; andernfalls wird Text angehängt. |
| `{{addnumvar::name::value}}` | Marinara-Erweiterung, die immer numerisch addiert. Fehlende oder ungültige Werte gelten als 0; ein Überlauf wird ignoriert. |
| `{{incvar::name}}` | Zählt 1 zu einer numerischen Variablen hinzu und fügt den neuen Wert ein. |
| `{{decvar::name}}` | Zieht 1 von einer numerischen Variablen ab und fügt den neuen Wert ein. |

Innerhalb eines Prompt-Aufbaus werden Variablen von links nach rechts aufgelöst und im aktuellen Chat gespeichert. Ein früh gesetzter Wert – etwa in einem Lorebook-Eintrag, der vorn steht – lässt sich später im selben Prompt auslesen. Wie bei lokalen Variablen in SillyTavern bleibt er außerdem über spätere Züge und Neustarts erhalten, ohne in andere Chats zu gelangen.

Jedes `{{NAME}}`, das kein eingebautes Makro ist, gilt als Preset-Variable und wird über den Namen nachgeschlagen. Existiert keine Variable dieses Namens, bleibt das Tag exakt so im Text stehen, wie du es getippt hast. Wie du solche Variablen definierst, steht unter [Preset-Variablen](preset-variables.md).

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

Ein Escape-Zeichen für Makros gibt es nicht. Sollen doppelte geschweifte Klammern im Text stehen bleiben, nimm einfach einen Namen, den Marinara nicht kennt. Jedes unbekannte `{{name}}` bleibt genau so stehen, wie du es getippt hast – solange keine Preset-Variable denselben Namen trägt. Brauchst du eine private Notiz, die nie bei der KI landet, nimm stattdessen `{{// like this}}`.

## Die Makro-Referenz und /macros

Jedes Feld mit Makro-Unterstützung hat zwei kleine Schaltflächen in der Ecke:

- **Expand editor** (Editor vergrößern) öffnet ein größeres Bearbeitungsfenster für das Feld.
- **Macro reference** (Makro-Referenz) öffnet ein Fenster mit dem Titel **Macro reference**, das alle eingebauten Makros nach Kategorie auflistet, jeweils mit der exakten Syntax. Die Liste stammt aus derselben Quelle, die auch die Engine nutzt, und stimmt deshalb immer.

Alternativ tippst du `/macros` ins Chatfeld (die Kurzform `/macro` geht ebenfalls). Der Befehl gibt die vollständige Makro-Liste direkt im Chat aus, als schnelles Nachschlagewerk.

In bedingten Blöcken lassen sich Vergleiche mit `||` (ODER), `&&` (UND) und Klammern verknüpfen. Für Gleichheitslisten gibt es die kompakte Form `{{#if character == "Maukie" || "Pantalone"}}`. Vorrangregeln, Beispiele für Gruppenchats und die vollständige Operatorenliste findest du unter [Bedingte Prompts](conditional-prompts.md).

## Typische Fehler

- Schreib keine Variablen in einen `{{random::...}}`-Block. Ein `{{setvar}}` in einer Zufallsoption läuft für jede Option, bevor die Wahl fällt – nicht nur für die gezogene.
- Verwende eine lokale Variable nicht als globale Variable. Werte aus `{{setvar}}` bleiben nur im aktuellen Chat erhalten; jeder andere Chat hat einen eigenen Wert.
- `{{prompt}}` ist kein Makro. Besteht deine gesamte Nachricht aus `{{prompt}}`, öffnet Marinara stattdessen die Ansicht **Peek Prompt**, statt die Nachricht zu senden. Siehe [Peek Prompt](../chats/peek-prompt.md).
- Custom Tools arbeiten nicht mit `{{macro}}`-Text. Füg also kein `{{roll:1d20}}` in ein Tool-Feld ein in der Erwartung, dass es aufgelöst wird.
- Die Prompt-Vorlage **Impersonate** akzeptiert nur wenige Platzhalter, nicht die komplette Makro-Liste. Auch die Namen weichen ab – ein Makro, das auf einer Karte funktioniert, tut es dort womöglich nicht.
- Sehr umfangreiche oder tief verschachtelte Makro-Ausgaben werden stillschweigend abgeschnitten. Eine Fehlermeldung gibt es nicht, halte die Makro-Auflösungen also in einem vernünftigen Rahmen.

## Verwandte Anleitungen

- [Bedingte Prompts](conditional-prompts.md)
- [Preset-Variablen](preset-variables.md)
- [Preset-Editor und Prompt Manager](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Charaktere erstellen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Conversation-Mode-Profile](../conversation/profiles.md)
