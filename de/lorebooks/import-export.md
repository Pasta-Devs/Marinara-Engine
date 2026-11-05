# Lorebooks importieren und exportieren

Importiere Lorebooks, um Fakten über deine Welt aus Dateien zu übernehmen, und exportiere sie, um sie weiterzugeben oder zu sichern. Diese Anleitung behandelt einzelne Dateien, viele Dateien auf einmal und die vier Exportformate. Ein Lorebook ist eine Sammlung von Notizen mit Schlüsselwörtern, die Marinara in den Prompt einfügt, sobald ein passendes Wort fällt. Andere Tools nennen diese Funktion World Info.

## Was sich importieren lässt

Marinara erkennt den Dateityp selbst. Beide Arten sind `.json`-Dateien, und du brauchst weder ein Konto noch einen API-Key.

- Ein Lorebook, das aus Marinara exportiert wurde. Hier bleiben alle Felder und alle Ordner erhalten.
- Eine World-Info-Datei aus einem anderen Tool, etwa World Info aus SillyTavern oder das „character-book“-Format der V2-Charakterkarten. Marinara ordnet die Felder den eigenen zu.

## Ein Lorebook importieren

1. Öffne das Panel **Lorebooks**.
2. Klick in der oberen Leiste auf das Symbol mit dem Download-Pfeil, das mittlere von drei Symbolen. Sein Tooltip lautet **Import** (Importieren). Das Plus-Symbol ist **New** (Neu), das Häkchen-Symbol **Select** (Auswählen).
3. Tippe oder klick im Fenster **Import Lorebook** (Lorebook importieren) auf das Feld mit dem Text **Drop one or more lorebook files here or click to browse** und wähle deine `.json`-Dateien aus. Am Computer kannst du Dateien auch auf das Feld ziehen. Du kannst mehrere auf einmal wählen und dabei Marinara- und World-Info-Dateien mischen.
4. Warte die Ergebnisse ab. Jede Datei bekommt ein grünes Häkchen mit **Imported lorebook** oder eine rote Markierung mit einem Fehler. Bei mehreren Dateien zeigt eine Zusammenfassung, wie viele Importe geklappt haben und wie viele fehlgeschlagen sind.
5. Klick auf **Close** (Schließen). Die neuen Lorebooks stehen im Panel **Lorebooks**.

Als Erstellungsdatum übernimmt Marinara das Datum aus der Datei.

Wenn es nicht funktioniert hat: Lies den Fehler neben der Datei. Eine Datei, die kein Lorebook oder beschädigt ist, schlägt für sich allein fehl, während die anderen Dateien importiert werden.

## Nach dem Import

Ein importiertes Lorebook funktioniert sofort mit Schlüsselwörtern. Nutzt du die semantische Suche, bau seine Vektoren neu auf. Siehe [Semantische Suche für Lorebooks](semantic-search.md).

## Ein Lorebook exportieren

1. Klick im Panel **Lorebooks** auf ein Lorebook, um es zu öffnen.
2. Klick im Kopfbereich des Editors oben rechts auf das Export-Symbol. Sein Tooltip lautet **Export lorebook** (Lorebook exportieren).
3. Wähle im Fenster **Export Lorebook** ein Format. Dein Browser lädt die Datei herunter.

| Format | Was du bekommst | Wofür |
| --- | --- | --- |
| **Marinara Native** | Jedes Feld der Einträge und jeden Ordner. Die Datei endet auf `.marinara.json`. | Ein Lorebook in eine andere Marinara-Installation bringen. |
| **Compatible JSON** | Eine ordnerlose World-Info-Datei, die auf `.json` endet. Einige Marinara-eigene Details gehen verloren. | Andere Roleplay-Tools. |
| **Markdown** | Eine Überschrift `## Name` pro Eintrag mit einer Zeile `Keys:`. | Lesen und Bearbeiten in einem Texteditor. |
| **CSV** | Eine Tabelle mit den Spalten name, keys, content, folder, enabled, constant und probability. | Viele Einträge in einer Tabellenkalkulation bearbeiten. |

## Viele Lorebooks auf einmal exportieren

1. Klick im Panel **Lorebooks** auf das Häkchen-Symbol (**Select**).
2. Hak jedes Lorebook an, das du exportieren willst.
3. Klick in der Leiste unten auf **Export** (Exportieren).

Dein Browser lädt `marinara-lorebooks.zip` herunter. Der Massenexport nutzt immer **Marinara Native**, damit beim Import alles wieder zurückkommt.

## Einträge aus Markdown oder CSV importieren

Du kannst einem Lorebook Einträge aus einer Markdown- oder CSV-Textdatei hinzufügen, etwa aus einer Datei, die du nach dem Export bearbeitet hast.

1. Öffne das Lorebook und klick im Kopfbereich des Editors auf **Import entries from Markdown or CSV** (Einträge aus Markdown oder CSV importieren).
2. Klick im Fenster **Import entries** (Einträge importieren) auf **Choose file** (Datei auswählen) oder füge Text in das Feld ein.
3. Prüf **Format**. Marinara errät es aus dem Text.
4. Lies die Vorschau. Für Markdown nimmst du pro Eintrag eine Überschrift `## Name`, optional eine Zeile `Keys: a, b` und dann den Text. Für CSV nimmst du eine Kopfzeile mit name, keys und content sowie optional den Spalten folder, enabled, constant und probability. Die Vorschau zeigt, wie viele Einträge bereit sind, und listet Fehler und Warnungen nach Zeile auf.
5. Wähle unter **Import into** (importieren in) **This lorebook** (dieses Lorebook) oder **New lorebook** (neues Lorebook). Für ein neues Lorebook gib unter **New lorebook name** einen Namen ein.
6. Wähle unter **When an entry name already exists** (wenn ein Eintragsname schon existiert) **Skip the imported entry** (importierten Eintrag überspringen), **Import as a renamed copy** (als umbenannte Kopie importieren) oder **Overwrite the existing entry** (vorhandenen Eintrag überschreiben).
7. Klick auf die Schaltfläche **Import**, die die Zahl der Einträge zeigt.

Eine Toast-Meldung sagt dir, wie viele Einträge hinzugefügt, überschrieben und übersprungen wurden.

Wenn es nicht funktioniert hat: Die Schaltfläche bleibt gesperrt, wenn die Datei einen Fehler hat, der die ganze Datei betrifft, etwa fehlende Pflichtspalten, oder wenn kein Eintrag gültig ist. Korrigiere die Zeilen, die die Vorschau auflistet.

## Einen kompletten SillyTavern-Ordner importieren

Wie du aus einem vollständigen SillyTavern-Ordner importierst, mit Charakteren, Chats und Presets, steht unter [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

## Verwandte Anleitungen

- [Lorebooks – Überblick](overview.md)
- [Lorebooks mit Charakteren und Personas verknüpfen](linking-to-characters.md)
- [Semantische Suche für Lorebooks](semantic-search.md)
- [Aus SillyTavern importieren](../data/importing-from-sillytavern.md)
