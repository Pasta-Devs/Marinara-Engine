# Preset-Variablen

Eine Preset-Variable ist eine beschriftete Auswahl, die in ein Prompt-Preset eingebaut ist. Wer das Preset erstellt, legt sie einmal an, und wer das Preset nutzt, wählt die Optionen, sobald er es einem Chat zuweist. Damit verhält sich ein einziges Preset auf verschiedene Weise, ohne dass jemand den Prompt-Text bearbeiten muss.

Du vergibst einen Namen für die Variable, formulierst eine Frage und listest Optionen auf. Dann schreibst du den Namen in doppelten geschweiften Klammern, etwa `{{tone}}`, in einen beliebigen Prompt-Abschnitt. Wenn die KI eine Antwort generiert, ersetzt Marinara `{{tone}}` durch den Wert der Option, die gewählt wurde.

Preset-Variablen brauchen ein Prompt-Preset und funktionieren deshalb in Roleplay-Chats. In Conversation- und Game-Chats gelten sie nicht, denn dort ersetzt ein einzelner Prompt-Text die Abschnitte. Mehr zu den Presets selbst steht unter [Preset-Editor und Prompt-Manager](presets.md).

## Die Arten von Preset-Variablen

Eine Variable mit mehreren Optionen ist standardmäßig eine Einfachauswahl. Gewählt wird genau eine Option, dargestellt als Radio-Schaltflächen. Drei Einstellungen ändern das.

| Art | So bekommst du sie | Verhalten |
| --- | --- | --- |
| **Boolean Toggle** | Gib der Variable genau eine Option. | Ein Ein-/Aus-Schalter. An fügt den Wert der Option ein. Aus fügt nichts ein. |
| **Multi-Select** (Mehrfachauswahl) | Schalte **Multi-Select** ein. | Es lassen sich mehrere Optionen wählen. Die Werte werden mit einem Trennzeichen verbunden, standardmäßig `, `. Aus Romance, Fantasy und Action wird „Romance, Fantasy, Action“. |
| **Random Pick** (Zufallsauswahl) | Schalte **Random Pick** ein. | Bei einer Variable mit Einfachauswahl wählt Marinara für jeden neuen Chat zufällig eine Option vor, und die Wahl bleibt fest, bis du sie änderst. Ist **Multi-Select** an, wird ein Pool aus Optionen gewählt, und jede Antwort zieht eine Option daraus. |

## Eine Preset-Variable anlegen

1. Öffne das Panel **Presets** und klick auf ein Preset, um den **Preset Editor** (Preset-Editor) zu öffnen.
2. Wechsle zum Tab **Sections** (Abschnitte) und scroll zum Panel **Preset Variables** (Preset-Variablen) ganz unten.
3. Klick auf **Add Variable** (Variable hinzufügen). Eine neue Variablen-Karte erscheint. Klick darauf, um sie aufzuklappen.
4. Leg den **Variable Name** (Variablenname) fest. Das Feld behält nur Buchstaben, Ziffern und Unterstriche. Diesen Namen schreibst du in die Klammern.
5. Fülle **Question (shown to user)** aus. Diesen Text liest, wer die Auswahl trifft.
6. Bearbeite die Liste **Options** (Optionen). Jede Option hat ein **Label** (Beschriftung), das angezeigt wird, und einen **Value** (Wert), also den Text, der in den Prompt eingefügt wird. Ein leerer Wert fügt nichts ein.
7. Wähle unter **Presentation** (Darstellung) **Auto**, eine Schaltflächen-Variante (**Radios** oder **Checkboxes**) oder eine kompakte Variante (**Dropdown** oder **Listbox**). Schalte **Alphabetical option display** ein, um die Optionen nach Beschriftung zu sortieren.
8. Drück <kbd>Escape</kbd> oder klick auf **Done** (Fertig). Änderungen werden automatisch gespeichert, und die Fußzeile zeigt „Changes auto-save. Press Escape to close.“

Schreib nun den Namen in Klammern in einen Prompt-Abschnitt. Setz zum Beispiel `{{tone}}` in einen Abschnitt und leg eine Variable namens `tone` mit den Optionen **Gentle** und **Harsh** an. Wird **Harsh** gewählt, erhält der Abschnitt deren Wert.

Eine Variable behält immer mindestens eine Option. Versuchst du, die letzte zu löschen, behält Marinara sie.

## Die Variablen beantworten

Weist du einem Chat ein Preset mit Variablen zu, öffnet sich das Fenster **Configure Preset Variables** (Preset-Variablen konfigurieren). Darin steht: „This preset has configurable variables. Select option(s) for each to customize your experience.“

Jede Variable zeigt ihre Frage, ihren Platzhalter, etwa `{{tone}}`, und gegebenenfalls ein Abzeichen (**Boolean toggle**, **Multi-select** oder **Random pick**).

1. Wähle für jede Variable einen Wert.
2. Klick auf **Confirm Choices** (Auswahl bestätigen).

Die anderen Schaltflächen:

- **Save as default** (als Standard speichern) speichert deine Auswahl im Preset, sodass sie beim nächsten Mal schon eingetragen ist.
- **Skip** (überspringen) schließt das Fenster, ohne zu speichern.

**Confirm Choices** bleibt gesperrt, bis jede Variable mit Einfachauswahl einen Wert hat. Variablen vom Typ **Boolean toggle** und **Multi-select** blockieren die Schaltfläche nicht, auch wenn dort nichts gewählt ist. Wechselst du zu einem anderen Preset, verwirft Marinara deine Auswahl für das bisherige.

## Antworten nachträglich ändern

In **Chat Settings** (Chat-Einstellungen) zeigt der Abschnitt **Prompt Preset** eine Stift-Schaltfläche, **Edit preset variables** (Preset-Variablen bearbeiten), wenn das gewählte Preset Variablen hat. Klick darauf, um das Fenster mit deiner aktuellen Auswahl erneut zu öffnen.

## Namen, die keine Variablen sind

Marinara löst zuerst eingebaute Makros wie `{{user}}` und `{{char}}` auf. Danach gleicht es jeden anderen Platzhalter `{{NAME}}` (Buchstaben, Ziffern und Unterstriche) mit deinen Preset-Variablen ab. Passt keine, probiert es die eigenen Variablen des Chats aus dem Abschnitt **Chat Variables** (Chat-Variablen) in **Chat Settings**. Haben beide denselben Namen, hat die Preset-Variable Vorrang. Kommt der Name in keiner der beiden vor, bleibt der Text genau so stehen, wie er eingegeben wurde, ohne Fehler. Siehe [Prompt-Makros](macros.md).

## Decision-Blöcke in Optionen

Der Wert einer Option kann wie jeder andere Prompt-Text einen Decision-Block `{{#if decision:"..."}}` enthalten. Nur die Optionen, die im Chat ausgewählt sind, werden abgefragt, und sie zählen zu **Decision statements per turn** (Decision-Aussagen pro Zug). Bei einer Variable vom Typ **Random Pick** wird jede Option im Pool abgefragt, weil jede gezogen werden könnte. Siehe [Das Decision-Modell fragen](conditional-prompts.md#asking-the-decision-model).

Der Wert einer Variable landet dort, wo ihr `{{name}}` steht. Ändert eine Decision diesen Wert weit oben in einem Preset, kann viel von der Prompt-Cache-Wiederverwendung des Dienstes verloren gehen. Setz häufig wechselnde Inhalte weiter nach hinten. Siehe [Decision-Blöcke und Prompt-Caching](presets.md#decision-blocks-and-prompt-caching).

## Begrüßungen

Preset-Variablen werden auch in Charakter-Begrüßungen aufgelöst, auch mit einer Auswahl, die erst nach dem Erstellen einer Begrüßung bestätigt wurde. Die ursprüngliche Begrüßung bleibt mit ihren Makros bearbeitbar.

## Verwandte Anleitungen

- [Preset-Editor und Prompt-Manager](presets.md)
- [Prompt-Makros](macros.md)
