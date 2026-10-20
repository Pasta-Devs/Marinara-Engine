# Narrative Director und Secret Plot

In dieser Anleitung erfährst du, wie der Agent **Narrative Director** in Marinara Engine arbeitet. Es geht um die Schaltfläche **Push Story** (Story anschieben), die Modi **Natural** und **Random Event** sowie um den verborgenen Handlungsbogen **Secret Plot**. Diese Funktionen gibt es nur im Roleplay Mode.

## Was der Narrative Director macht

Ein Agent ist ein KI-Helfer, der im Hintergrund deines Chats eine bestimmte Aufgabe übernimmt. Der Narrative Director ist so ein Agent. Er schreibt eine einmalige Regieanweisung für die nächste Antwort, damit sich die Geschichte in die gewünschte Richtung bewegt. Wie Agenten grundsätzlich funktionieren, steht in der [Übersicht zu Agenten](../agents/agents-overview.md).

Der Narrative Director läuft ausschließlich im Roleplay Mode. Von allein tut er nichts. Er wird erst aktiv, wenn du ihn mit der Schaltfläche **Push Story** scharf schaltest (also für genau eine Antwort einschaltest) oder wenn du die Funktion **Secret Plot** (geheimer Handlungsbogen) aktivierst.

Zuerst fügst du den Agenten dem Chat hinzu. Öffne dazu **Chat Settings** (Chat-Einstellungen), wechsle in den Bereich **Agents** (Agenten) und aktiviere den Agenten **Narrative Director**. Sobald er aktiv ist, erscheint über dem Nachrichtenfeld die Schaltfläche **Push Story**, und im Bereich **Agents** taucht die Einstellungskarte **Narrative Director** auf.

## Push Story

**Push Story** wirkt genau einmal. Die Schaltfläche prägt nur die nächste Antwort und schaltet sich danach selbst wieder ab. Nutze sie, wenn die Szene festhängt und die KI die Handlung voranbringen soll.

Und so funktioniert’s:

1. Öffne einen Roleplay-Chat, in dem der Agent **Narrative Director** aktiv ist.
2. Suche über dem Nachrichtenfeld die Schaltfläche **Push Story**.
3. Klick auf **Push Story**. Im Modus **Natural** erscheint die Meldung "The next time a character responds, they will push the story forward naturally!" Im Modus **Random Event** endet die Meldung stattdessen mit "randomly!".
4. Schick deine nächste Nachricht ab oder lass eine neue Antwort generieren.
5. Die KI schreibt genau diese eine Antwort mit dem gewünschten Schub.
6. Danach schaltet sich **Push Story** von selbst wieder ab.

Überlegst du es dir vor dem Absenden anders, klick einfach erneut auf **Push Story**. Dann erscheint die Meldung "Push Story disarmed."

Während eine Antwort noch generiert wird, ist die Schaltfläche **Push Story** gesperrt. Warte, bis die laufende Antwort fertig ist, und schalte sie erst dann scharf.

## Die Modi Natural und Random Event

**Push Story** kennt zwei Modi. Den Modus wählst du auf der Karte **Narrative Director** in den **Chat Settings**. Er bestimmt, welche Art von Schub du bekommst.

Die beiden Modi sind:

- **Natural**: Die bestehende Handlung geht weiter. Die KI führt die Fäden fort, die in der Geschichte schon angelegt sind.
- **Random Event**: Eine glaubwürdige Überraschung kommt dazu. Die KI bringt eine neue Wendung ins Spiel, die trotzdem zur Szene passt.

Standardmäßig ist **Natural** eingestellt. Zum Wechseln öffnest du **Chat Settings**, gehst zu **Agents**, suchst die Karte **Narrative Director** und klickst auf den gewünschten Modus.

Der Tooltip (Kurzhinweis beim Draufzeigen) der Schaltfläche **Push Story** verrät dir, welcher Modus scharf geschaltet ist. Im Modus **Natural** lautet er "Arm a natural Narrative Director push for the next response." Im Modus **Random Event** lautet er "Arm a random Narrative Director event for the next response."

## Secret Plot

**Secret Plot** ist ein verborgener Handlungsbogen über lange Strecken. Die KI führt insgeheim einen Plan mit, wohin die Geschichte laufen soll. Dieser Plan wandert in den Prompt – also in den Text, den Marinara an die KI schickt –, bleibt für dich aber unsichtbar, solange du ihn nicht selbst aufdeckst. Standardmäßig ist die Funktion aus.

Anders als **Push Story**, das nur einmal wirkt, läuft **Secret Plot** über viele Antworten hinweg. Der verborgene Plan wird nach einem festen Zeitplan aktualisiert, während der Chat weitergeht.

### Secret Plot einschalten

1. Öffne **Chat Settings** und wechsle in den Bereich **Agents**.
2. Suche die Karte **Narrative Director**.
3. Aktiviere den Schalter **Secret Plot**. Seine Beschriftung lautet "Maintain a hidden long-term arc for this roleplay."

### Run Interval

Ist **Secret Plot** aktiv, erscheint das Feld **Run Interval** (Aktualisierungsintervall). Es legt fest, wie viele User- und Assistant-Nachrichten zwischen zwei Aktualisierungen des verborgenen Handlungsbogens liegen.

Der Standard ist 8. Erlaubt ist jede ganze Zahl von 1 bis 100. Je kleiner die Zahl, desto häufiger aktualisiert die KI den Plan. Je größer, desto seltener.

### Den verborgenen Handlungsbogen aufdecken und bearbeiten

Unter dem Feld **Run Interval** liegt das Panel **Secret plot**. Dort siehst du den verborgenen Plan und kannst ihn ändern.

Klick auf die Schaltfläche zum Aufdecken. Sie heißt **Reveal spoilers** (Spoiler anzeigen), sobald ein Handlungsbogen existiert, und **Reveal empty arc**, solange die KI noch keinen geschrieben hat. Mit **Hide spoilers** blendest du ihn wieder aus. Ist er ausgeblendet, zeigt das Panel "Spoilers hidden".

Im aufgedeckten Zustand lassen sich diese Felder bearbeiten:

- **Arc description**: die gesamte verborgene Handlung.
- **Protagonist arc**: wohin sich dein Charakter entwickelt.
- **Character arc**: wohin sich ein ausgewählter Charakter im Roleplay entwickelt.
- **Completed**: ein Kontrollkästchen, das du ankreuzt, sobald der Handlungsbogen abgeschlossen ist.

Nach dem Bearbeiten sicherst du die Änderungen über die Schaltfläche zum Speichern.

Willst du den aktuellen Handlungsbogen verwerfen und die KI einen neuen schreiben lassen, klick auf **Regenerate** (neu generieren). Ein Dialogfenster mit dem Titel "Regenerate Secret Plot" fragt nach einer Bestätigung. Mit **Regenerate** ersetzt du den Bogen, mit **Keep Current Arc** brichst du ab.

### Der Handlungsbogen hängt am Agenten

Der verborgene Handlungsbogen wird beim Agenten **Narrative Director** gespeichert. Löschst du die Agentenläufe und das Gedächtnis des Chats, bleibt er erhalten. Erst wenn du den Agenten **Narrative Director** aus dem Chat entfernst, verschwindet auch der Bogen. Vor dem Entfernen warnt dich Marinara: Der verborgene Handlungsbogen wird gelöscht, und das lässt sich nicht rückgängig machen.

### Der Secret-Plot-Prompt

Der **Secret Plot Prompt** (Prompt für den Secret Plot) enthält die Anweisungen, denen der Narrative Director folgt, wenn er den verborgenen Handlungsbogen schreibt und aktualisiert. Der eingebaute Prompt legt jeden Bogen als Rätsel an, das es aufzudecken gilt. Das passt zu Abenteuer und Intrige, aber womöglich nicht zu einer Geschichte, die von den Charakteren getragen wird.

So nutzt du eigene Anweisungen:

1. Öffne **Agents** (Agenten) und bearbeite den **Narrative Director**.
2. Klick im Abschnitt **Secret Plot** auf **Copy default to edit** (Standard zum Bearbeiten kopieren).
3. Ändere den Text und speichere dann den Agenten.

Klick auf **Reset to default** (auf Standard zurücksetzen), um zum eingebauten Prompt zurückzukehren, und speichere dann den Agenten.

Behalte das JSON-Antwortformat am Ende des Prompts bei: ein Objekt `overarchingArc` mit `description`, `protagonistArc`, einem optionalen `characterArc` und `completed`. Ohne dieses Format lässt sich der Handlungsbogen nicht lesen.

Dieser Prompt wird beim Agenten gespeichert und gilt daher für jeden Chat, der diesen Narrative Director nutzt.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Guided Generation und Impersonate](../chats/guided-and-impersonate.md)
