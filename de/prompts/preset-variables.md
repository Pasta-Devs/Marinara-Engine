# Preset-Variablen

In dieser Anleitung geht es um **Preset Variables** (Preset-Variablen) – kleine Auswahlfelder, die sich direkt in ein Prompt-Preset einbauen lassen. Wer ein Preset erstellt, legt die Auswahl einmal an; alle anderen treffen sie dann, sobald das Preset einem Chat zugewiesen wird. Manchmal heißen Preset-Variablen auch Auswahlblöcke.

## Was Preset-Variablen sind

Ein Prompt-Preset ist eine wiederverwendbare Vorlage für den Text, der an die KI geht. Eine Preset-Variable ergänzt diese Vorlage um eine beschriftete Auswahl. Du vergibst einen Namen, formulierst eine Frage und listest ein paar Optionen auf.

In jedem Prompt-Abschnitt schreibst du den Namen der Variable in doppelte geschweifte Klammern, etwa `{{tone}}`. Bei der Generierung ersetzt Marinara Engine `{{tone}}` durch den Wert der gewählten Option. Ein einziges Preset verhält sich damit unterschiedlich, ohne dass jemand den Prompt-Text anfassen muss.

Preset-Variablen stecken im Prompt-Preset und funktionieren deshalb in allen Chat-Modi, die Prompt-Presets nutzen. Im Conversation Mode greifen sie nicht: Dort ersetzt ein einzelner Prompt-Text das abschnittsbasierte Preset – es gibt also nichts, was die Variablen füllen könnten. Mehr zu den Presets selbst findest du unter [Preset-Editor und Prompt Manager](presets.md).

## Die drei Arten von Preset-Variablen

Wie sich eine Variable verhält, hängt von ihren Optionen und zwei Schaltern ab. Standardmäßig ist eine Variable mit mehreren Optionen eine Einfachauswahl: Genau eine Option wird gewählt, dargestellt als Radio-Schaltflächen. Darüber hinaus gibt es drei benannte Arten.

**Boolean Toggle.** Hat eine Variable genau eine Option, wird daraus ein Ein-/Aus-Schalter. Ist er an, fügt Marinara den Wert der Option ein; ist er aus, passiert nichts. Im Editor tragen solche Variablen die Beschriftung **Boolean Toggle**.

**Multi-Select.** Aktiviere den Schalter **Multi-Select** (Mehrfachauswahl), damit sich mehrere Optionen gleichzeitig wählen lassen. Die gewählten Werte werden dann mit einem Trennzeichen aneinandergehängt. Das Trennzeichen steht in einem kurzen Textfeld, standardmäßig Komma plus Leerzeichen. Aus den Optionen Romance, Fantasy und Action wird mit `, ` also der Text „Romance, Fantasy, Action“.

**Random Pick** (Zufallsauswahl). Bei einer Variable mit Einfachauswahl wählt Marinara für jeden neuen Chat zufällig eine Option vor. Du kannst sie vor dem Bestätigen ändern. Die gespeicherte Auswahl bleibt bestehen, bis du sie bearbeitest. Mit aktiviertem **Multi-Select** wählt die App bei jeder Generierung zufällig eine der ausgewählten Optionen. Das sorgt für Abwechslung: Du legst einen Pool fest, und jede Antwort zieht ein Element daraus.

## Eine Preset-Variable anlegen

Variablen entstehen beim Bearbeiten eines Presets. So geht’s:

1. Öffne das Panel **Presets** und klick auf ein Preset, um den **Preset Editor** (Preset-Editor) zu öffnen.
2. Wechsle zum Tab **Sections** (Abschnitte) und scroll bis zum Panel **Preset Variables** ganz unten.
3. Klick auf **Add Variable** (Variable hinzufügen). Es erscheint eine neue Variablen-Karte. Ein Klick darauf klappt den Editor aus.
4. Trag den **Variable Name** (Variablenname) ein. Erlaubt sind nur Buchstaben, Ziffern und Unterstriche. Genau diesen Namen schreibst du später in geschweifte Klammern, etwa `{{variable_name}}`.
5. Fülle **Question (shown to user)** (Frage, die angezeigt wird) aus. Diesen Text liest, wer den Wert auswählt.
6. Bearbeite die Liste **Options** (Optionen). Jede Option besteht aus einem **Label** (der sichtbaren Beschriftung) und einem **Value** (dem Text, der in den Prompt wandert). Ein leerer Wert fügt nichts ein.
7. Wähle unter **Presentation** (Darstellung) eine Anzeigeform: **Auto**, die Schaltflächen-Variante (**Radios** oder **Checkboxes**) oder die kompakte Variante (**Dropdown** oder **Listbox**). Mit **Alphabetical option display** sortierst du die Optionen nach Beschriftung.
8. Änderungen speichert Marinara automatisch. In der Fußzeile des Editors steht „Changes auto-save. Press Escape to close.“ Zum Abschluss drückst du Esc oder klickst auf **Done**.

Um die Variable zu verwenden, schreibst du ihren Namen in geschweiften Klammern in den Inhalt eines beliebigen Prompt-Abschnitts. Setz zum Beispiel `{{tone}}` in einen Abschnitt und leg dann eine Variable namens `tone` mit den Optionen **Gentle** und **Harsh** an. Fällt die Wahl auf Harsh, erhält der Abschnitt den zugehörigen Wert.

Mindestens eine Option muss eine Variable immer behalten. Beim Versuch, die letzte zu löschen, bleibt sie erhalten.

## Das Fenster Configure Preset Variables

Weist du einem Chat ein Preset mit Variablen zu, öffnet sich automatisch das Fenster **Configure Preset Variables** (Preset-Variablen konfigurieren). Der Einleitungstext lautet: „This preset has configurable variables. Select option(s) for each to customize your experience.“

Zu jeder Variable siehst du die Frage, das zugehörige Token (etwa `{{tone}}`) und gegebenenfalls ein kleines Abzeichen mit **Boolean toggle**, **Multi-select** oder **Random pick**. Wähle für jede Variable einen Wert.

- **Save as default** (als Standard speichern) schreibt die Auswahl zurück ins Preset, sodass sie beim nächsten Mal schon vorbelegt ist.
- **Skip** (überspringen) schließt das Fenster, ohne etwas zu speichern.
- **Confirm Choices** (Auswahl bestätigen) übernimmt die Auswahl. Die Schaltfläche bleibt gesperrt, solange noch eine Einfachauswahl offen ist. Variablen vom Typ **Boolean toggle** und **Multi-select** blockieren sie nicht, auch wenn dort nichts gewählt ist.

Beim Wechsel auf ein anderes Preset verwirft Marinara alle Variablen-Antworten des bisherigen Presets.

## Antworten nachträglich ändern

Du musst kein Preset neu öffnen, um deine Antworten zu ändern. Im Panel der Chat-Einstellungen zeigt der Bereich **Prompt Preset** eine Stift-Schaltfläche mit der Beschriftung **Edit preset variables** (Preset-Variablen bearbeiten), sobald das gewählte Preset Variablen hat. Ein Klick darauf öffnet **Configure Preset Variables** erneut, mit der aktuellen Auswahl bereits eingetragen.

## Der Auffangmechanismus {{NAME}}

Marinara löst zahlreiche eingebaute Makros auf, etwa `{{user}}` und `{{char}}`. Danach gleicht die App jeden übrig gebliebenen Platzhalter der Form `{{NAME}}` (nur Buchstaben, Ziffern und Unterstriche) mit den Preset-Variablen ab.

Gibt es eine Variable mit genau diesem Namen, wird der Platzhalter zum gewählten Wert. Passt keine Variable, bleibt `{{NAME}}` unverändert stehen. Deshalb taucht ein unbekannter Platzhalter unverändert in der Ausgabe auf, statt einen Fehler auszulösen. Die vollständige Liste der Makros steht unter [Prompt-Makros](macros.md).

## Verwandte Anleitungen

- [Preset-Editor und Prompt Manager](presets.md)
- [Prompt-Makros](macros.md)

Preset-Variablen werden auch in Charakter-Begrüßungen aufgelöst, einschließlich einer Auswahl, die erst nach dem Erstellen der Begrüßung bestätigt wurde. Die ursprüngliche Begrüßung bleibt mit ihren Makros bearbeitbar.
