# Narrative Director und Secret Plot

Der Narrative Director ist ein Agent (ein Helfer, der neben den Antworten mitläuft), der die Handlung eines Roleplay-Chats lenkt. **Push Story** (Geschichte voranbringen) gibt einer einzelnen Antwort einen Schubs, wenn die Szene festzuhängen scheint. **Secret Plot** führt einen verborgenen, langfristigen Handlungsbogen, der viele Antworten prägt. Das funktioniert nur in Roleplay. Wie Agenten grundsätzlich funktionieren, steht in der [Agenten-Übersicht](../agents/agents-overview.md).

## Den Narrative Director zu einem Chat hinzufügen

1. Öffne **Chat Settings** (Chat-Einstellungen) über die Schieberegler-Schaltfläche im Chat und geh zu **Agents**.
2. Schalte **Enable Agents** (Agenten aktivieren) ein und füg dann den Agenten **Narrative Director** hinzu.

Über deinem Nachrichtenfeld erscheint jetzt die Schaltfläche **Push Story**, und unter **Agents** erscheint die Karte **Narrative Director**. Der Agent tut nichts, bis du **Push Story** nutzt oder **Secret Plot** einschaltest.

## Die Geschichte voranbringen

**Push Story** wirkt genau einmal. Es prägt nur die nächste Antwort und schaltet sich danach selbst ab. Füg zuerst den Narrative Director zum Chat hinzu (siehe oben).

1. Klick über deinem Nachrichtenfeld auf **Push Story**. Ein Menü fragt, wie der Schubs aussehen soll:
   - **Naturally** (natürlich): Die bestehende Handlung geht weiter. Die KI führt Fäden fort, die in deiner Geschichte schon angelegt sind.
   - **Randomly** (zufällig): Eine glaubwürdige Überraschung kommt in die Szene.
2. Wähle eins davon. Du siehst „The next time a character responds, they will push the story forward naturally!“ (oder „randomly!“). Die Schaltfläche lautet jetzt **Push Story: Naturally** oder **Push Story: Randomly**.
3. Schick deine nächste Nachricht ab oder lass eine neue Antwort generieren. Die KI schreibt diese eine Antwort mit dem Schubs.
4. Nach der Antwort schaltet sich **Push Story** von selbst ab.

Den Modus wählst du jedes Mal in diesem Menü. Es gibt keinen Standardmodus und keine Einstellung für den Modus in **Chat Settings**.

Um vor dem Absenden abzubrechen, klick erneut auf die scharf geschaltete Schaltfläche. Du siehst „Push Story disarmed.“

Wenn es nicht funktioniert hat: Während eine Antwort generiert wird, reagiert **Push Story** nicht. Warte, bis die Antwort fertig ist, und klick dann darauf.

## Secret Plot einschalten

**Secret Plot** ist ein verborgener Handlungsbogen über lange Strecken. Die KI führt insgeheim einen Plan, wohin die Geschichte läuft. Der Plan wandert in den Prompt, bleibt für dich aber verborgen, solange du ihn nicht aufdeckst. Standardmäßig ist die Funktion aus. Anders als **Push Story** wirkt sie über viele Antworten hinweg und aktualisiert ihren Plan nach einem Zeitplan.

1. Öffne **Chat Settings → Agents** und such die Karte **Narrative Director**.
2. Schalte den Schalter **Secret Plot** ein. Seine Beschriftung lautet „Maintain a hidden long-term arc for this roleplay.“
3. Stell bei Bedarf **Run Interval** (Aktualisierungsintervall) ein. Der Wert gibt an, wie viele Nachrichten (deine und die der KI) zwischen zwei Aktualisierungen des Handlungsbogens liegen. Der Standard ist 8. Erlaubt ist jede ganze Zahl von 1 bis 100. Je kleiner die Zahl, desto häufiger wird der Plan aktualisiert.

## Den verborgenen Handlungsbogen aufdecken und bearbeiten

Das Panel **Secret plot** liegt unter **Run Interval**.

1. Klick auf **Reveal spoilers** (Spoiler anzeigen). Hat die KI noch keinen Handlungsbogen geschrieben, lautet die Schaltfläche **Reveal empty arc**. Solange der Bogen verborgen ist, zeigt das Panel „Spoilers hidden“. Klick auf **Hide spoilers** (Spoiler ausblenden), um ihn wieder auszublenden.
2. Bearbeite die gewünschten Felder:
   - **Arc description**: die gesamte verborgene Handlung.
   - **Protagonist arc**: wohin sich dein Charakter entwickelt.
   - **Character arc**: wohin sich ein ausgewählter Charakter entwickelt.
   - **Completed**: Kreuz es an, sobald der Handlungsbogen abgeschlossen ist.
3. Sichere deine Änderungen über die Schaltfläche zum Speichern.

Willst du den Handlungsbogen verwerfen und die KI einen neuen schreiben lassen, klick auf **Regenerate** (neu generieren). Ein Dialogfenster mit dem Titel „Regenerate Secret Plot“ fragt nach einer Bestätigung. Mit **Regenerate** ersetzt du den Bogen, mit **Keep Current Arc** (aktuellen Bogen behalten) brichst du ab.

Der Handlungsbogen wird beim Agenten **Narrative Director** gespeichert. Löschst du die Agentenergebnisse des Chats, bleibt er erhalten. Gelöscht wird er nur, wenn du den Agenten aus dem Chat entfernst, und vorher weist dich eine Warnung darauf hin.

## Den Secret-Plot-Prompt ändern

Der **Secret Plot Prompt** (Prompt für den Secret Plot) enthält die Anweisungen, denen der Narrative Director folgt, wenn er den Handlungsbogen schreibt und aktualisiert. Der eingebaute Prompt legt jeden Bogen als Rätsel an, das es aufzudecken gilt. Das passt zu Abenteuer und Intrige, aber womöglich nicht zu einer Geschichte, die von ihren Charakteren getragen wird.

1. Öffne **Agents** und bearbeite den **Narrative Director**.
2. Klick im Abschnitt **Secret Plot** auf **Copy default to edit** (Standard zum Bearbeiten kopieren).
3. Ändere den Text und speichere dann den Agenten.

Klick auf **Reset to default** (auf Standard zurücksetzen), um zum eingebauten Prompt zurückzukehren, und speichere dann den Agenten.

> **Hinweis:** Lösch den letzten Teil des Prompts nicht. Er beschreibt das Antwortformat, und ohne ihn kann Marinara den Handlungsbogen nicht lesen.

Der Prompt wird beim Agenten gespeichert und gilt daher für jeden Chat, der diesen Narrative Director nutzt.

## Verwandte Anleitungen

- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Roleplay Mode: Erste Schritte](getting-started.md)
- [Geführte Generierung und Impersonate](../chats/guided-and-impersonate.md)
