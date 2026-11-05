# Regex-Skripte

Ein Regex-Skript ist eine Suchen-und-Ersetzen-Regel, die Text im Chat automatisch umschreibt. Damit kannst du eine KI-Antwort säubern, deine eigene Nachricht umformen oder den Text ändern, den das Modell erhält. Programmierkenntnisse brauchst du dafür nicht.

Regex steht für „regular expression“, also regulärer Ausdruck: ein Suchmuster, das Text findet, der einer Regel entspricht. Du legst das Muster einmal fest, danach greift es in jeder passenden Nachricht.

Beispiel: Manche Modelle setzen Handlungen in Sternchen.

```text
*She smiles* Hello there.
```

Übernimm dieses Muster genau so: `\*([^*]+)\*`. Ersetze es durch `$1`, dann fallen die Sternchen weg und der Text dazwischen bleibt stehen:

```text
She smiles Hello there.
```

`$1` bedeutet „der Text, den das erste Klammerpaar erfasst hat“. Weitere typische Einsätze: Anmerkungen außerhalb der Rolle in Klammern löschen, ein Wort zensieren oder die Formatierungsmacken eines bestimmten Charakters geradeziehen.

## Ein Regex-Skript anlegen

Deine globalen Skripte liegen im Panel **Presets**, im Abschnitt **Regexes** (Regex-Skripte). Öffne das Panel über die Schaltfläche **Presets** in der oberen Leiste.

### So legst du ein Regex-Skript an

1. Öffne **Presets** und such den Abschnitt **Regexes**.
2. Klick auf **Create regex** (Regex anlegen). Der vollständige Editor öffnet sich.
3. Trag oben einen Namen ein. Ein neues Skript heißt zunächst „New Regex Script“.
4. Gib unter **Find Pattern (Regex)** `\*([^*]+)\*` ein (siehe [Felder im Editor](#editor-fields)).
5. Gib unter **Replace With** (Ersetzen durch) `$1` ein.
6. Lass unter **Apply To** (Anwenden auf) **AI Output** (KI-Ausgabe) ausgewählt. Der standardmäßig gewählte Modus **Only Display** (nur Anzeige) ist die sichere Wahl (siehe [Festlegen, wo ein Skript läuft](#choose-where-a-script-runs)).
7. Füg `*She smiles* Hello there.` in **Live Test** (Live-Test) ein. Unter **Result:** sollte `She smiles Hello there.` stehen.
8. Klick auf **Save** (Speichern). Kurz erscheint ein grüner Hinweis **Saved**.
9. Prüf es in einem Chat: Enthält eine KI-Antwort Text zwischen Sternchen, sind die Sternchen nicht mehr zu sehen.

Wenn es nicht funktioniert hat: Ein roter Fehler unter **Find Pattern (Regex)** blockiert das Speichern. Das Muster ist ungültig oder unsicher; siehe [Sicherheit und Geschwindigkeit](#safety-and-performance).

### Deine Skripte verwalten

Jede Zeile der Liste **Regexes** zeigt den Namen des Skripts, ein Tag **AI** oder **User**, das Muster als `/pattern/flags`, einen Ein-/Aus-Schalter (wirkt sofort), **Edit regex** (Regex bearbeiten, Stift-Symbol) und **Delete regex** (Regex löschen, Papierkorb-Symbol). Gibt es noch keine Skripte, steht in der Liste „No regexes yet“. Zieh eine Zeile an ihrem Griff, um die Reihenfolge der Ausführung zu ändern.

Die Kopfzeile des Abschnitts hat drei Symbol-Schaltflächen: **Create regex**, **Import regexes from JSON** (Regex-Skripte aus JSON importieren) und **Export regexes to JSON** (Regex-Skripte als JSON exportieren). Die letzte speichert alle deine globalen Skripte in einer Datei. Skripte, die an einen einzelnen Charakter gebunden sind, werden getrennt verwaltet; siehe [Ein Skript auf einen Charakter begrenzen](#limit-a-script-to-one-character).

<a id="editor-fields"></a>

## Felder im Editor

### Find Pattern (Regex)

Das Suchmuster. Schreib nur das Muster, ohne Schrägstrich am Anfang oder Ende. Der Platzhalter zeigt ein Beispiel: `\*([^*]+)\*`.

### Replace With

Der Text, der jeden Treffer ersetzt. Lass das Feld leer, um den Treffer zu löschen. Erfassten Text verwendest du mit `$1`, `$2` und so weiter wieder. Diese Umwandlungen der Groß- und Kleinschreibung wirken vor einer Erfassung:

| Eingabe | Ergebnis |
| --- | --- |
| `\u$1` | Schreibt den ersten Buchstaben der Erfassung groß |
| `\U$1\E` | Schreibt die ganze Erfassung in Großbuchstaben |
| `\l$1` | Schreibt den ersten Buchstaben der Erfassung klein |
| `\L$1\E` | Schreibt die ganze Erfassung in Kleinbuchstaben |

Wörtlicher Text mit Backslash, etwa ein Windows-Pfad wie `C:\Users`, bleibt so stehen, wie du ihn schreibst.

### Regex Flags

Umschalter, die steuern, wie das Muster Treffer findet. Bei einem neuen Skript sind `g` und `i` eingeschaltet.

| Flag | Bedeutung |
| --- | --- |
| `g` | Global: ersetzt jeden Treffer, nicht nur den ersten |
| `i` | Case-insensitive: ignoriert Groß- und Kleinschreibung |
| `m` | Multiline: `^` und `$` passen auch an Zeilenumbrüchen |
| `s` | dotAll: `.` passt auch auf Zeilenumbruchzeichen |
| `u`, `y`, `d` | Unicode, sticky und match indices, für Spezialfälle |

### Trim Strings

Eine optionale Liste einfacher Zeichenfolgen, die nach der Ersetzung entfernt werden. Mit **Add trim string** (Zeichenfolge hinzufügen) fügst du eine Zeile hinzu, mit der Schaltfläche **X** entfernst du eine. Das eignet sich für ein festes Textstück, das sich leichter eintippen als mit einem Muster treffen lässt.

### Live Test

Füg Beispieltext ein, und das Ergebnis erscheint unter **Result:**. Live Test prüft nur die Logik aus Suchen, Ersetzen und Entfernen. Platzierung, Ein-/Aus-Zustand, Charakterbindung und Tiefe werden erst in einem echten Chat ausgewertet. Im Muster, in der Ersetzung und in den Trim Strings kannst du Makros wie `{{user}}` und `{{char}}` verwenden. Im Live Test verwenden sie Beispielwerte. Siehe [Makros](../prompts/macros.md).

<a id="choose-where-a-script-runs"></a>

## Festlegen, wo ein Skript läuft

### Apply To

**Apply To** legt fest, welche Seite des Chats ein Skript beobachtet. Mindestens eine Option muss ausgewählt bleiben. Du kannst auch beide wählen.

- **AI Output**: läuft auf KI-Antworten, bevor sie angezeigt werden.
- **User Input** (Nutzereingabe): läuft auf deinen Nachrichten, bevor sie gesendet werden.

### Apply Mode

**Apply Mode** (Wirkungsbereich) sitzt in den **Advanced Options** (erweiterte Optionen). Er bestimmt, was die Umschreibung ändert. Ein neues Skript startet mit **Only Display**.

- **Only Display**: ändert, was du im Chat siehst. Die gespeicherte Nachricht und der spätere Kontext des Modells bleiben gleich. Die sicherste Wahl, um aufzuräumen, wie eine Antwort aussieht.
- **Only Prompt** (nur Prompt): ändert, was das Modell erhält, und das zeigt auch die Prompt-Vorschau. Anzeige und gespeicherte Nachricht bleiben gleich. Nutze es, um etwas zu entfernen, das das Modell ständig kopiert.
- **Both** (beides): ändert die Anzeige und den Prompt-Text.

Bei deinen eigenen Nachrichten schreibt ein **User Input**-Skript auf **Only Display** oder **Both** die Nachricht direkt vor dem Senden um. Dabei ändert sich die gespeicherte und gesendete Nachricht, nicht nur ihr Aussehen. Einen reinen Anzeigemodus für ausgehende Nachrichten gibt es nicht.

### Execution Order und Depth Range

Beide sitzen in den **Advanced Options**.

- **Execution Order** (Ausführungsreihenfolge) ist eine Zahl. Kleinere Zahlen laufen zuerst. Das zählt, wenn mehrere Skripte denselben Text treffen können. Ein neues Skript startet bei 0, und beim Speichern vergibt die App die nächste freie Zahl. Du kannst die Zeilen auch in der Liste **Regexes** verschieben.
- **Depth Range** (Tiefenbereich) begrenzt mit **Min** und **Max**, wie weit zurück ein Skript läuft. Die neueste Nachricht hat Tiefe 0, die davor Tiefe 1 und so weiter. Lass beide Felder leer, damit das Skript in jeder Tiefe läuft. Ist **Min** größer als **Max**, wird das Speichern blockiert.

### Gruppenchats

Das gilt für **Only Prompt** und **Both** in einem **Roleplay**-Chat mit dem Gruppenmodus **Individual** (einzelne Antworten).

- Die Platzierung richtet sich nach dem Charakter, der den Prompt erhält.
- Deine Nachrichten und die Nachrichten anderer Charaktere zählen als **User Input**.
- Die eigenen Antworten des antwortenden Charakters zählen als **AI Output**, auch frühere Antworten im selben Gruppenzug.
- Die Charakterbeschränkungen bestimmen weiterhin, wer den umgeschriebenen Prompt erhält. Ein Erzähler, der von einem Skript zum Ausblenden von Gedanken ausgenommen ist, behält die ursprünglichen Gedanken.

<a id="limit-a-script-to-one-character"></a>

## Ein Skript auf einen Charakter begrenzen

Ein Skript kann zu bestimmten Charakteren gehören, statt überall zu laufen. Dafür gibt es zwei Wege.

- Im Editor: Schalte in der Karte **Apply To** den Schalter **Specific Characters** (bestimmte Charaktere) ein und wähl einen oder mehrere Charaktere aus. Ist der Schalter aus, gilt für das Skript „Applies to all characters“. Ist er an, wähl mindestens einen Charakter aus.
- Am Charakter: Öffne den Charakter, wechsel zum Tab **Advanced** (Erweitert) und such die Karte **Regex Scripts** (Regex-Skripte). Sie listet nur die Skripte dieses Charakters und hat eigene Schaltflächen für **Create regex**, Import und Export. Speichere den Charakter zuerst, sonst meldet die Karte, dass sie noch keine Skripte hinzufügen kann.

Öffnest du von dieser Karte aus den vollständigen Editor, verlässt du den Character Editor. Hat der Charakter ungespeicherte Änderungen, warnt dich die App vorher.

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### Die Chat-Einstellung Scoped Regex Scripts

Gebundene Skripte laufen nicht von selbst in jedem Chat. Eine Einstellung pro Chat steuert sie. Öffne **Chat Settings** (Chat-Einstellungen). Der Abschnitt **Scoped Regex Scripts** (gebundene Regex-Skripte) erscheint nur, wenn mindestens ein Charakter in diesem Chat gebundene Skripte hat.

| Modus | Was passiert |
| --- | --- |
| **Disabled** (Standard) | Gebundene Skripte sind aus. Nur globale Skripte laufen. |
| **Exclusive** | Jedes gebundene Skript ändert nur Nachrichten seines eigenen Charakters. |
| **Chat** | Jedes gebundene Skript ändert jede Nachricht im Chat. |

**Use preset default** (Preset-Standard verwenden) folgt dem **Scoped regex default** (Standard für bereichsbezogene Regex-Skripte) des Prompt-Presets. Wählst du einen Modus, gilt stattdessen dieser für den Chat. Damit neue Chats mit einem Modus starten, hast du diese Möglichkeiten:

- Leg ihn als Standard des Presets fest.
- Speichere ihn in deinem [Standard-Einstellungsprofil](../chats/settings-profiles.md#choosing-the-default-profile).
- Wähl ihn und klick dann auf den Stern für die Lieblingsanordnung neben **Reset View** (Ansicht zurücksetzen). Die Schritte stehen unter [Eine Anordnung für neue Chats wählen](../chats/chat-settings.md#choosing-a-layout-for-new-chats).

Unter den Modi listet das Panel die gebundenen Skripte jedes Charakters, jedes mit einem eigenen Schalter. Dieser Schalter gehört zum Skript selbst und ändert es deshalb in jedem Chat. Der Modus steuert die Skripte auf der Anzeigeseite. Prompt-Skripte richten sich immer nach dem Charakter, der die Antwort generiert.

## Skripte importieren und ersetzen

### Aus SillyTavern importieren

Marinara liest Regex-Skripte, die in einer SillyTavern-Charakterkarte mitgeliefert werden. Beim Import einer Karte bietet der Abschnitt **Imported regex scripts** (importierte Regex-Skripte) zwei Möglichkeiten:

- **Character only** (Standard): Die Skripte bleiben an diesen Charakter gebunden.
- **Global**: Die Skripte landen unter **Presets** und laufen in jedem Chat.

Die Auswahl erscheint im Importdialog für einzelne Charaktere und im Sammelimport über **Import from SillyTavern Folder**. Skripte mit leerem Muster oder mit einem Muster, das die Sicherheitsprüfung nicht besteht, werden übersprungen. Eine einfache JSON-Datei mit Skripten importierst du über **Import regexes from JSON** in **Regexes**. Siehe [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

### Ein Regex-Paket ersetzen

1. Wähle unter **Presets → Regexes** **Select regex scripts** (Regex-Skripte auswählen).
2. Markiere die Einträge des alten Pakets oder wähle **Select all regex scripts** (alle Regex-Skripte auswählen).
3. Nutze **Export** (Exportieren) oder **Delete** (Löschen) in der Aktionsleiste. Das Löschen fragt einmal nach und lässt sich nicht rückgängig machen.
4. Importiere das aktualisierte Paket.

Fehlgeschlagene Löschungen bleiben ausgewählt, damit du es erneut versuchen kannst. Nicht ausgewählte Skripte bleiben, wo sie sind. Preset-Zuordnungen bleiben im Regex-Editor verfügbar.

<a id="safety-and-performance"></a>

## Sicherheit und Geschwindigkeit

Jedes Muster wird geprüft, bevor es gespeichert oder ausgeführt werden kann. Ein Muster, das wahrscheinlich langsam läuft und die App aufhängt, wird mit dieser Meldung blockiert, und das Speichern bleibt gesperrt, bis du es korrigierst:

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

Siehst du diese Meldung, mach das Muster kürzer und einfacher. Vermeide diese Formen:

- Muster mit mehr als 1.000 Zeichen.
- Eine wiederholte Gruppe innerhalb einer weiteren wiederholten Gruppe, etwa `(a+)+`.
- Zwei breite Platzhalter direkt hintereinander, etwa `.*.*` oder `\s*\w*`. Ein breiter Platzhalter ist ein Token wie `.*`, `\s*` oder `\w+`, das beliebig viel Text erfassen kann.
- Drei oder mehr breite Platzhalter irgendwo in einem Muster, auch mit anderem Text dazwischen.

Eine einzelne Wiederholung wie `a+` oder `(a+)` oder ein einzelner breiter Platzhalter, etwa ein alleinstehendes `.*`, ist unproblematisch.

Selbst ein sicheres Muster hat auf einer langen Nachricht ein Zeitlimit pro Ersetzung. Braucht ein Skript bei einer Nachricht zu lange, überspringt die App das Skript nur für diese Nachricht. Das Skript bleibt eingeschaltet und versucht es bei der nächsten Nachricht erneut. Teste ein neues Muster zuerst im **Live Test** an kurzem Beispieltext.

## Verwandte Anleitungen

- [Makros](../prompts/macros.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Aus SillyTavern importieren](../data/importing-from-sillytavern.md)
