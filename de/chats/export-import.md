# Chats exportieren und importieren

In dieser Anleitung erfährst du, wie du einen Chat als Datei speicherst und wieder in Marinara Engine lädst. Exportieren lässt sich ein einzelner Chat oder gleich mehrere auf einmal. Importieren kannst du außerdem Chat-Dateien aus Marinara selbst oder aus SillyTavern (eine andere Roleplay-Chat-App).

## Diese Dateiformate begegnen dir

Marinara arbeitet mit zwei Chat-Dateiformaten.

- **JSONL**: JSONL steht für JSON Lines. Das ist eine reine Textdatei, die pro Zeile eine Nachricht speichert. Sie ist das Standardformat für den Export. Eine JSONL-Datei lässt sich später wieder in Marinara importieren.
- **Text**: Ein schlichtes, gut lesbares Transkript als `.txt`. Es liest und teilt sich leicht, aber Marinara kann es nicht wieder importieren. Nimm **Text** nur, wenn ein Mensch den Chat lesen soll.

Der Chat-Import akzeptiert ausschließlich `.jsonl`-Dateien. Wenn du einen Chat später erneut einlesen willst, exportiere ihn als **JSONL** und nicht als **Text**.

## Einen einzelnen Chat exportieren

Für den Export eines einzelnen Chats nutzt du den Abschnitt **Chat Branches** (Chat-Verzweigungen) in **Chat Settings**. Das ist der schnellste Weg, den Chatverlauf eines einzelnen Chats zu sichern.

1. Öffne den Chat, den du exportieren willst.
2. Öffne **Chat Settings** und klapp den Abschnitt **Chat Branches** unter **Chat Name** auf.
3. Klick auf **JSONL**, um den Chat als JSONL-Datei zu speichern, oder auf **Text** für eine lesbare Textdatei.
4. Der Browser lädt die Datei herunter.

Gespeichert wird der gerade geöffnete Chat samt seiner Nachrichten.

## Mehrere Chats auf einmal exportieren

Du kannst mehrere Chats auswählen und gemeinsam als eine `.zip`-Datei herunterladen.

1. Öffne die Chatliste in der linken Seitenleiste.
2. Wähl den gewünschten Modus-Tab: **CONVO** (Conversation), **RP** (Roleplay) oder **GM** (Game). Jeder Tab exportiert nur seine eigenen Chats.
3. Klick oben in der Chatliste auf die Schaltfläche **Select chats** (Chats auswählen).
4. Klick jeden Chat an, der dabei sein soll. Für jeden erscheint ein aktiviertes Kontrollkästchen.
5. Unten erscheint eine Leiste mit der Anzahl, zum Beispiel "3 selected".
6. Klick in dieser Leiste auf **Export**.
7. Der Browser lädt eine `.zip`-Datei mit JSONL-Transkripten herunter – eine Datei pro Chat.

Der Sammelexport nutzt immer das Format **JSONL**. Die Schaltfläche **Delete** in derselben Leiste löscht die ausgewählten Chats stattdessen – klick sie also nur an, wenn du genau das willst.

## Einen Chat als neuen Chat importieren

So entsteht aus einer `.jsonl`-Datei ein völlig neuer Chat. Das funktioniert mit Chat-Dateien aus Marinara ebenso wie mit Exporten aus SillyTavern.

1. Öffne die Chatliste in der linken Seitenleiste.
2. Wähl den gewünschten Modus-Tab: **CONVO**, **RP** oder **GM**. Marinara legt den importierten Chat in dem Tab an, der gerade offen ist.
3. Klick oben in der Liste auf die Import-Schaltfläche neben **New**. Ihr Tooltip lautet **Import SillyTavern or Marinara chat JSONL**.
4. Wähl im Dateiauswahl-Fenster die `.jsonl`-Datei aus.
5. Es erscheint die Meldung "Imported N messages", und Marinara wechselt direkt in den neuen Chat.

Soll der neue Chat im Roleplay Mode landen, öffne vor dem Import den Tab **RP**. Den Modus bestimmt der geöffnete Tab, nicht die Datei.

## Einen Chat als neue Verzweigung importieren

Eine `.jsonl`-Datei lässt sich auch als neue Verzweigung in einen bestehenden Chat laden. Eine Verzweigung ist eine eigenständig gespeicherte Kopie eines Chats, die du getrennt weiterspielen kannst. Mehr dazu steht unter [Chat-Verzweigungen](branches.md).

1. Öffne den Chat, dem du die Verzweigung hinzufügen willst.
2. Öffne **Chat Settings** und klapp den Abschnitt **Chat Branches** auf.
3. Klick in diesem Abschnitt auf **Import**.
4. Wähl die `.jsonl`-Datei aus.
5. Es erscheint die Meldung "Imported N messages as a new branch".

Die neue Verzweigung gehört ab sofort zum geöffneten Chat. Sie übernimmt dessen Charaktere, Persona, Verbindung und Prompt-Preset.

## Reasoning in Exporte übernehmen

Manche Modelle speichern zu einer Antwort einen versteckten Denk- oder Reasoning-Text. Eine Einstellung entscheidet, ob dieser versteckte Text in den Export-Dateien landet.

Die Einstellung heißt **Include reasoning in exports** (Reasoning in Exporte übernehmen). Du findest sie unter **Settings** (Einstellungen) im Tab **Advanced** im Abschnitt **Message Tools**. Es ist ein Schalter, und standardmäßig steht er auf **off**.

- Steht er auf **off**, lässt Marinara gespeicherte Denk- und Reasoning-Texte sowohl beim **JSONL**- als auch beim **Text**-Export weg.
- Steht er auf **on**, schreibt Marinara diese versteckten Texte in beide Formate.

Die Einstellung gilt für einzelne Chat-Exporte genauso wie für Sammelexporte als `.zip`.

Lass **Include reasoning in exports** ausgeschaltet, bevor du ein Transkript weitergibst. Im versteckten Reasoning können Notizen stecken, die du gar nicht mitschicken wolltest. Schalt die Einstellung nur ein, wenn du für dich selbst eine vollständige Aufzeichnung brauchst.

## Verwandte Anleitungen

- [Chat-Verzweigungen](branches.md)
- [Aus SillyTavern importieren](../data/importing-from-sillytavern.md)
- [Backup und Wiederherstellung](../data/backup-and-restore.md)
- [Überblick über die Einstellungen](../settings/settings-overview.md)
