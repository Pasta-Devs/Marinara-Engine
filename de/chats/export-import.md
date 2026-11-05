# Chats exportieren und importieren

Speichere einen Chat als Datei, gib ihn als lesbare Geschichte weiter oder lade eine Chat-Datei aus Marinara oder SillyTavern (eine andere Roleplay-Chat-App) wieder ein. Exportieren kannst du einen einzelnen Chat, einen Teil eines Chats oder viele Chats auf einmal.

<a id="file-formats-you-will-see"></a>

## Diese Dateiformate begegnen dir

| Format | Was es ist | Wieder importierbar? |
| --- | --- | --- |
| **JSONL** | JSON Lines, eine reine Textdatei mit einer Nachricht pro Zeile. Das Standardformat. | Ja |
| **Text** | Ein lesbares Transkript als `.txt`. | Nein |
| **Markdown** | Eine lesbare `.md`-Datei. Sie beginnt mit dem Namen des Chats und dem Zeitraum, den er abdeckt, und führt dann jede Nachricht unter dem Namen ihres Absenders auf. | Nein |
| **Story** | Eine gestaltete Webseite als `.html` mit Namen und Avatar jedes Absenders. Öffne sie im Browser, um sie zu lesen, weiterzugeben oder zu drucken. | Nein |

**Markdown**- und **Story**-Dateien lassen Systemnachrichten und vor dir verborgene Nachrichten weg. Der Chat-Import akzeptiert nur `.jsonl`. Exportiere also als **JSONL**, wenn du den Chat später wieder importieren willst.

Eine **JSONL**-Datei lässt ein paar Adressen weg, die mit dem Chat gespeichert sind: den Webhook des Discord-Mirrors, die DeepLX-Adresse, den DeepL-Key und die Intiface-Adresse. Auch ein Import bringt sie nie mit. Trag sie in den **Chat Settings** (Chat-Einstellungen) des importierten Chats neu ein, wenn du sie nutzt.

## Einen einzelnen Chat exportieren

1. Öffne den Chat.
2. Öffne **Chat Settings** und klapp **Chat Branches** (Chat-Verzweigungen) unter **Chat Name** auf. Die Export-Schaltflächen liegen in diesem Abschnitt, auch wenn der Chat nur eine Verzweigung hat.
3. Tipp auf **JSONL**, **Text**, **Markdown** oder **Story**.

Der Browser lädt die Datei herunter. Sie enthält die Verzweigung, die du gerade ansiehst, samt ihrer Nachrichten.

<a id="export-part-of-a-chat"></a>

## Einen Teil eines Chats exportieren

Mit **Export a range** (Bereich exportieren) speicherst du nur einige Nachrichten. In Game-Chats gibt es diese Funktion nicht.

1. Klick in **Chat Branches** auf **Export a range**.
2. Klick zuerst die erste und dann die letzte Nachricht an. Ein Hinweis lautet „Select the first and last message to export.“
3. Klick auf **Export selected** (Auswahl exportieren).
4. Prüf im Dialog **Export messages** (Nachrichten exportieren) die Anzahl der Nachrichten sowie die erste und die letzte Nachricht und wähle dann **Text**, **Markdown**, **JSONL** oder **Story**.

Marinara exportiert alle Nachrichten von der ersten bis zur letzten, die du ausgewählt hast. Mit **Cancel** (Abbrechen) beendest du den Vorgang, ohne zu exportieren.

## Mehrere Chats auf einmal exportieren

1. Klick in der linken Seitenleiste auf den Tab des gewünschten Modus: **CONVO**, **RP** oder **GM**. Jeder Tab exportiert nur seine eigenen Chats.
2. Klick oben in der Liste auf **Select chats** (Chats auswählen).
3. Klick jeden gewünschten Chat an. Eine Leiste unten zeigt die Anzahl, etwa „3 selected“.
4. Klick in der Leiste auf **Export**.

Der Browser lädt eine `.zip`-Datei mit einem JSONL-Transkript pro Chat herunter. Der Sammelexport nutzt immer **JSONL**. Siehe [Die Chatliste verwalten](managing-chats.md#selecting-multiple-chats).

## Einen Chat als neuen Chat importieren

So entsteht ein neuer Chat aus einer `.jsonl`-Datei, die Marinara gespeichert oder SillyTavern exportiert hat.

1. Klick in der linken Seitenleiste auf den Tab des gewünschten Modus. Der importierte Chat übernimmt den Modus des geöffneten Tabs, nicht den Modus aus der Datei.
2. Klick auf die Schaltfläche **Import** neben der Schaltfläche **+**. Ihre Beschriftung lautet **Import SillyTavern or Marinara chat JSONL**.
3. Wähl deine `.jsonl`-Datei aus.

Es erscheint „Imported N messages“, und Marinara öffnet den neuen Chat. Ausführlicher zu SillyTavern-Dateien: [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

Wenn es nicht funktioniert hat: Eine kleine Meldung am unteren Bildschirmrand lautet **Import failed** und nennt den Grund. Prüf, ob die Datei auf `.jsonl` endet.

## Einen Chat als neue Verzweigung importieren

So lädst du eine `.jsonl`-Datei als neue Verzweigung in einen Chat, den du schon hast. Siehe [Chat-Verzweigungen](branches.md).

1. Öffne den Chat, der die Verzweigung bekommen soll.
2. Öffne **Chat Settings**, klapp **Chat Branches** auf und klick auf **Import**.
3. Wähl deine `.jsonl`-Datei aus.

Es erscheint „Imported N messages as a new branch“. Die Verzweigung übernimmt Charaktere, Persona, Verbindung und Prompt-Preset des geöffneten Chats.

## Reasoning und private Notizen in Exporte übernehmen

Zwei Einstellungen entscheiden, ob versteckter Text in Export-Dateien landet. Beide sind Schalter unter **Settings → Advanced → Message Tools**, und beide sind standardmäßig aus. Sie gelten für Exporte einzelner Chats und für `.zip`-Exporte.

| Einstellung | Wenn an |
| --- | --- |
| **Include reasoning in exports** | Nimmt die gespeicherten Denkschritte des Modells in jedes Format auf. In **Markdown**- und **Story**-Dateien stehen sie in einem aufklappbaren Abschnitt **Thinking** (Nachdenken) unter der Nachricht. |
| **Include private notes in exports** | Nimmt deine privaten Notizen zu Nachrichten in **JSONL**- und **Text**-Exporte auf. |

> **Warnung:** Lass beide aus, bevor du ein Transkript weitergibst. Verstecktes Reasoning und private Notizen können Dinge enthalten, die du gar nicht mitschicken wolltest.
