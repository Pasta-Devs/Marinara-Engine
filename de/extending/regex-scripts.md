# Regex-Skripte

In dieser Anleitung erfährst du, wie Regex-Skripte in Marinara Engine funktionieren. Ein Regex-Skript ist eine Suchen-und-Ersetzen-Regel, die Text im Chat automatisch umschreibt. Es geht darum, was Regex-Skripte leisten, wie du eines anlegst, an welcher Stelle sie greifen und wie du sie auf einen einzelnen Charakter begrenzt.

## Was ein Regex-Skript ist

Regex steht für „regular expression“, also regulärer Ausdruck. Dahinter steckt ein Suchmuster: Es findet Text, der einer Regel entspricht, und das Regex-Skript ersetzt diesen Text durch etwas anderes. Programmierkenntnisse brauchst du dafür nicht.

Ein Regex-Skript läuft von allein, sobald eine Nachricht durch einen Chat wandert. Es kann eine KI-Antwort säubern, bevor sie bei dir ankommt. Es kann deine eigene Nachricht ändern, bevor sie rausgeht. Und es kann den Text ändern, den das Modell zu sehen bekommt. Das Muster legst du einmal fest, danach greift es in jeder passenden Nachricht.

Ein einfaches Vorher-Nachher-Beispiel: Manche Modelle setzen Handlungen in Sternchen, etwa so:

```
*She smiles* Hello there.
```

Suchst du nach dem Muster `\*([^*]+)\*` und ersetzt es durch `$1`, fallen die Sternchen weg und der Text dazwischen bleibt stehen:

```
She smiles Hello there.
```

Das `$1` in der Ersetzung bedeutet „der Text, den das Muster im ersten Klammerpaar erfasst hat“. `$1`, `$2` und ähnliche Tokens wirst du oft brauchen.

Typische Einsätze: Sternchen entfernen, Anmerkungen außerhalb der Rolle in Klammern löschen, ein Wort zensieren oder wiederkehrende Formatierungsmacken eines bestimmten Charakters geradeziehen.

## Wo die Regex-Skripte liegen

Die globalen Regex-Skripte findest du im Panel **Presets** (Presets). Öffne es über die Schaltfläche **Presets** in der oberen Leiste und geh dort zum Abschnitt **Regexes** (Regex-Skripte). Der Hinweis unter der Überschrift lautet "Find/replace patterns applied to AI output or user input".

Jede Zeile in der Liste zeigt:

- Den Namen des Skripts.
- Ein kleines Tag **AI** oder **User**, das angibt, wo das Skript greift.
- Das Muster in der Form `/pattern/flags`.
- Einen Schalter zum Ein- und Ausschalten. Er wirkt sofort, den Editor musst du dafür nicht öffnen.
- Eine Schaltfläche **Edit regex** (Regex bearbeiten, Stift-Symbol).
- Eine Schaltfläche **Delete regex** (Regex löschen, Papierkorb-Symbol).

Gibt es noch keine Skripte, steht in der Liste „No regexes yet“. Zeilen lassen sich am Griff verschieben, um die Reihenfolge der Ausführung zu ändern. Diese Liste enthält ausschließlich globale Skripte. Skripte, die an einen einzelnen Charakter gebunden sind, werden getrennt verwaltet – siehe „Charaktergebundene Regex-Skripte“ weiter unten.

In der Kopfzeile des Abschnitts sitzen außerdem drei Symbol-Schaltflächen:

- **Create regex** (Regex anlegen): öffnet ein neues, leeres Skript.
- **Import regexes from JSON** (Regex-Skripte aus JSON importieren): liest Skripte aus einer Datei ein.
- **Export regexes to JSON** (Regex-Skripte als JSON exportieren): speichert alle globalen Skripte in eine Datei.

## Ein Regex-Skript anlegen

So legst du ein neues globales Skript an:

1. Öffne das Panel **Presets** und geh zum Abschnitt **Regexes**.
2. Klick auf **Create regex**. Der vollständige Editor für Regex-Skripte öffnet sich.
3. Trag oben einen Namen ein. Ein neues Skript heißt zunächst „New Regex Script“.
4. Füll die Felder aus, die unten beschrieben sind.
5. Klick auf **Save** (Speichern). Kurz erscheint ein grüner Hinweis **Saved**.

Der Editor enthält diese Felder.

### Find Pattern (Regex)

**Find Pattern (Regex)** (Suchmuster) ist das Muster, nach dem gesucht wird. Schreib es ohne Schrägstriche als Begrenzer. Der Platzhalter zeigt ein Beispiel: `\*([^*]+)\*`. Ist das Muster ungültig oder unsicher, erscheint unter dem Feld ein roter Fehler und das Speichern wird blockiert. Mehr dazu unter „Sicherheit und Geschwindigkeit“ weiter unten.

### Replace With

**Replace With** (Ersetzen durch) ist der Text, der jeden Treffer ersetzt. Lass das Feld leer, um den gefundenen Text zu löschen. Erfassten Text greifst du mit `$1`, `$2` und so weiter wieder auf. Umwandlungszeichen vor einer Erfassung ändern deren Groß- und Kleinschreibung:

- `\u$1` schreibt den ersten Buchstaben der Erfassung groß.
- `\U$1\E` schreibt die komplette Erfassung in Großbuchstaben.
- `\l$1` schreibt den ersten Buchstaben der Erfassung klein.
- `\L$1\E` schreibt die komplette Erfassung in Kleinbuchstaben.

Wörtlicher Text mit Backslash, etwa ein Windows-Pfad wie `C:\Users`, bleibt genau so stehen, wie du ihn schreibst.

### Regex Flags

**Regex Flags** (Regex-Schalter) sind Umschalter, die das Verhalten des Musters steuern. Bei einem neuen Skript sind `g` und `i` aktiv:

- `g` (global): ersetzt jeden Treffer, nicht nur den ersten.
- `i` (case-insensitive): ignoriert Groß- und Kleinschreibung.
- `m` (multiline): `^` und `$` passen auch an Zeilenumbrüchen.
- `s` (dotAll): `.` passt auch auf Zeilenumbruchzeichen.
- `u` (unicode), `y` (sticky) und `d` (match indices) sind Schalter für Spezialfälle.

### Trim Strings

**Trim Strings** (Zeichenfolgen entfernen) ist eine optionale Liste einfacher Zeichenfolgen, die nach der Ersetzung entfernt werden. Über **Add trim string** (Zeichenfolge hinzufügen) legst du eine Zeile an, über die Schaltfläche **X** entfernst du sie wieder. Praktisch für feste Textstücke, die sich leichter tippen als über ein Muster erfassen lassen.

### Live Test

Mit **Live Test** (Live-Test) prüfst du das Muster schon vor dem Speichern. Füg Beispieltext in das Feld ein – das Ergebnis erscheint darunter bei **Result:**. Der Live Test belegt allerdings nur die Logik aus Suchen, Ersetzen und Entfernen. Platzierung, Ein-/Aus-Zustand, Charakterbindung und Tiefe prüft er nicht. Genau das sagt der Hinweis unter dem Feld: "Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime".

Im Muster, in der Ersetzung und in den Trim Strings kannst du Makros wie `{{user}}` und `{{char}}` verwenden. Im Live Test lösen sie sich zu Beispielwerten auf, im echten Chat zu den tatsächlichen Namen und Texten. Mehr über Makros steht unter [Makros](../prompts/macros.md).

## Platzierung: AI Output oder User Input

Das Feld **Apply To** (Anwenden auf) legt fest, welche Seite des Chats ein Skript beobachtet. Mindestens eine Option muss ausgewählt bleiben, beide gehen ebenfalls.

- **AI Output** (KI-Ausgabe): Das Skript läuft auf KI-Antworten, bevor sie angezeigt werden.
- **User Input** (Nutzereingabe): Das Skript läuft auf deinen Nachrichten, bevor sie verschickt werden.

Nimm **AI Output**, um aufzuräumen, was das Modell schreibt. Nimm **User Input**, um deinen eigenen Text zu korrigieren oder umzuformen.

Bei **Only Prompt** und **Both** in einem **Roleplay**-Chat mit dem Gruppenmodus **Individual** (einzelne Antworten) richtet sich der Anwendungsbereich nach dem Charakter, der den Prompt erhält: Deine Nachrichten und die Nachrichten anderer Charaktere fallen unter **User Input**, die eigenen Antworten des antwortenden Charakters unter **AI Output**. Das gilt auch für Antworten früher im selben Gruppenzug. Die Charakterbeschränkungen bestimmen weiterhin, wer den umgeschriebenen Prompt erhält. Ein Erzähler, der von einem Skript zum Ausblenden von Gedanken ausgenommen ist, erhält deshalb die ursprünglichen Gedanken. Wähle **Only Prompt**, damit der gespeicherte Chattext unverändert bleibt.

## Apply Mode: Only Display, Only Prompt oder Both

Die Auswahl **Apply Mode** (Wirkungsbereich) sitzt in den **Advanced Options** (Erweiterte Optionen). Sie bestimmt, wann die Umschreibung greift – unabhängig von der Platzierung. Ein neues Skript startet mit **Only Display**.

- **Only Display** (nur Anzeige): ändert nur, was du im Chat siehst. Die gespeicherte Nachricht und der Text, den das Modell in späteren Zügen erhält, bleiben unverändert.
- **Only Prompt** (nur Prompt): ändert nur, was beim Modell ankommt. Anzeige und gespeicherte Nachricht bleiben unverändert. Genau das zeigt auch die Prompt-Vorschau der App.
- **Both** (beides): ändert Anzeige und Prompt-Text.

### Welcher Apply Mode passt

Als schnelle Orientierung:

- Du willst nur aufhübschen, wie eine Antwort auf dem Bildschirm aussieht: **Only Display**. Für rein kosmetische Korrekturen die sicherste Wahl.
- Du willst ändern, was das Modell liest, etwa ein Tag entfernen, das es ständig kopiert: **Only Prompt**.
- Die Änderung soll auf dem Bildschirm und im Kontext des Modells wirken: **Both**.

Eine Besonderheit bei den eigenen Nachrichten: Steht ein **User Input**-Skript auf **Only Display** oder **Both**, greift die Umschreibung direkt vor dem Absenden. Sie verändert also die Nachricht, die tatsächlich gespeichert und verschickt wird – nicht bloß deren Aussehen im Nachhinein. Einen reinen Anzeigemodus für ausgehende eigene Nachrichten gibt es nicht.

## Execution Order und Tiefe

Beide Einstellungen sitzen in den **Advanced Options**.

**Execution Order** (Ausführungsreihenfolge) ist eine Zahl: Kleinere Zahlen laufen zuerst. Das zählt, sobald mehrere Skripte denselben Text treffen können. Ein neues Skript startet bei 0, und beim Speichern vergibt die App die nächste freie Zahl – so kollidieren frische Skripte nicht. Alternativ ziehst du die Zeilen in der Liste **Regexes** in die gewünschte Reihenfolge.

**Depth Range** (Tiefenbereich) begrenzt über die beiden Zahlenfelder **Min** und **Max**, wie weit zurück im Chat ein Skript arbeitet. Die Tiefe zählt rückwärts ab der neuesten Nachricht: Die neueste hat Tiefe 0, die davor Tiefe 1 und so weiter. Lass beide Felder leer, damit das Skript in jeder Tiefe läuft. Ist der Minimalwert größer als der Maximalwert, wird das Speichern blockiert.

## Charaktergebundene Regex-Skripte

Ein Regex-Skript muss nicht überall laufen – es kann zu einem oder mehreren bestimmten Charakteren gehören. Dafür gibt es zwei Wege.

Der erste Weg führt über den Editor. Aktivier im Bereich **Apply To** den Schalter **Specific Characters** (bestimmte Charaktere) und wähl im Raster einen oder mehrere Charaktere aus. Ist der Schalter aus, gilt „Applies to all characters“. Bei aktivem Schalter musst du mindestens einen Charakter auswählen.

Der zweite Weg führt über den Charakter selbst. Öffne einen Charakter, wechsel zum Tab **Advanced** (Erweitert) und such den Bereich **Regex Scripts** (Regex-Skripte). Dort stehen nur die Skripte dieses Charakters, mit eigenen Schaltflächen für **Create regex**, Import und Export. Den Charakter musst du erst speichern, bevor du gebundene Skripte hinzufügen kannst. Ist er noch ungespeichert, weist der Bereich darauf hin.

Öffnest du von dort aus den vollständigen Editor, verlässt du den Character Editor. Hat der Charakter ungespeicherte Änderungen, warnt die App vorher, damit nichts verloren geht.

### Die Chat-Einstellung Scoped Regex Scripts

Charaktergebundene Skripte laufen nicht automatisch in jedem Chat, sondern werden pro Chat gesteuert. Öffne dazu das Panel **Chat Settings** (Chat-Einstellungen). Der Abschnitt **Scoped Regex Scripts** (gebundene Regex-Skripte) taucht nur auf, wenn mindestens ein Charakter im Chat gebundene Skripte hat. Er bietet drei Modi:

- **Disabled** (Standard): Charaktergebundene Skripte sind aus, nur globale Skripte laufen.
- **Exclusive**: Jedes gebundene Skript ändert nur Nachrichten des Charakters, zu dem es gehört.
- **Chat**: Jedes gebundene Skript ändert jede Nachricht im Chat.

Unter den Modus-Schaltflächen listet das Panel jeden Charakter mit gebundenen Skripten auf, und du schaltest dort jedes Skript für diesen Chat einzeln ein oder aus. Gesteuert wird damit die Anzeigeseite. Prompt-Skripte richten sich immer nach dem Charakter, der die Antwort tatsächlich generiert.

## Regex-Skripte aus SillyTavern importieren

Marinara liest auch Regex-Skripte, die in einer SillyTavern-Charakterkarte mitgeliefert werden. Beim Import einer Karte erscheint der Abschnitt **Imported regex scripts** (importierte Regex-Skripte) mit zwei Möglichkeiten:

- **Character only** (Standard): Die Skripte bleiben an diesen einen Charakter gebunden.
- **Global**: Die Skripte landen unter **Presets** und laufen in jedem Chat.

Diese Auswahl erscheint sowohl im Fenster für den Import einzelner Charaktere als auch im Sammelimport über **Import from SillyTavern Folder**. Mitgelieferte Skripte ohne Muster oder mit einem Muster, das die Sicherheitsprüfung nicht besteht, überspringt der Import. Eine einfache JSON-Datei mit Skripten importierst du über die Schaltfläche **Import regexes from JSON** im Abschnitt **Regexes**. Der komplette Ablauf steht unter [Import aus SillyTavern](../data/importing-from-sillytavern.md).

## Sicherheit und Geschwindigkeit

Jedes Muster wird geprüft, bevor es gespeichert oder ausgeführt wird. Marinara blockiert Muster, die sehr wahrscheinlich langsam laufen und die App aufhängen. Ein blockiertes Muster meldet: "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns." Bis zur Korrektur bleibt das Speichern gesperrt.

Vermeide also diese Formen:

- Muster mit mehr als 1000 Zeichen.
- Eine wiederholte Gruppe innerhalb einer weiteren wiederholten Gruppe, etwa `(a+)+`.
- Zwei breite Platzhalter direkt hintereinander, etwa `.*.*` oder `\s*\w*`. Ein breiter Platzhalter ist ein Token wie `.*`, `\s*` oder `\w+`, das beliebig viel Text erfassen kann.
- Drei oder mehr breite Platzhalter irgendwo in einem Muster, auch mit anderem Text dazwischen.

Eine einzelne Wiederholung wie `a+` oder `(a+)` ist unproblematisch. Ein einzelner breiter Platzhalter, etwa ein alleinstehendes `.*`, ebenfalls.

Selbst bei einem sicheren Muster begrenzt die App, wie lange eine einzelne Ersetzung auf einer längeren Nachricht dauern darf. Braucht ein Skript bei einer Nachricht zu lange, überspringt die App es nur für diese eine Nachricht und macht weiter. Das Skript bleibt aktiv und versucht es bei der nächsten Nachricht erneut. Sicherheitshalber gilt: Teste ein neues Muster im **Live Test** an kurzem Beispieltext, bevor du es einschaltest.

## Verwandte Anleitungen

- [Makros](../prompts/macros.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Import aus SillyTavern](../data/importing-from-sillytavern.md)
