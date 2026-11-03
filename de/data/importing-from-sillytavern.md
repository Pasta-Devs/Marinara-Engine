# Aus SillyTavern importieren

Hol deine SillyTavern-Daten in Marinara Engine. Importiere jeweils eine Datei oder lass einen ganzen SillyTavern-Ordner durchsuchen und importiere alles auf einmal.

## Was du übernehmen kannst

| SillyTavern-Daten | In Marinara |
| --- | --- |
| Charaktere | Charaktere |
| Chats und Gruppenchats | Chats |
| Presets (ein gespeichertes Bündel mit Generierungseinstellungen) | Presets |
| World Info | Lorebooks (Notizen, die die KI liest, wenn bestimmte Wörter vorkommen) |
| Hintergründe | Chat-Hintergründe |
| Personas | Personas (das Profil, das dich vertritt) |

## Schneller Import einzelner Dateien

1. Öffne **Settings → Imports**.
2. Klicke unter **SillyTavern Import** auf die Schaltfläche für deinen Dateityp.
3. Wähle die Datei.

| Schaltfläche | Datei |
| --- | --- |
| **Import Character (JSON/PNG)** | Eine `.json`- oder `.png`-Charakterkarte. |
| **Import Chat (JSONL)** | Ein `.jsonl`-Chatprotokoll (ein JSON-Eintrag pro Zeile, das Format, in dem SillyTavern Chats speichert). |
| **Import Preset (JSON)** | Ein `.json`-Preset. |
| **Import Lorebook (JSON)** | Eine `.json`-World-Info-Datei. |

Die Schaltflächen haben keine Optionen. Ein Charakterimport behält alle Tags der Quelle und beschränkt jedes Regex-Skript auf diesen Charakter. Ein Regex-Skript ist eine Suchen-und-Ersetzen-Regel für Text. Um diese Optionen selbst zu wählen, nimm **Import** im Panel Characters. Siehe [Charakterkarten importieren und exportieren](../characters/import-export.md).

Enthält eine Charakterkarte ein Lorebook, fragt dein Browser, ob er es als eigenes Lorebook importieren soll. Klicke auf **OK**, um es als wiederverwendbares Lorebook zu behalten, oder auf **Cancel**, um nur den Charakter zu importieren.

**Import Chat (JSONL)** erstellt einen Roleplay-Chat, sofern die Datei keinen anderen Modus festhält, und öffnet ihn.

### Einen Chat in einen Modus deiner Wahl importieren

Um den Modus zu wählen, nutze die Import-Schaltfläche oben in der Chatliste. Ihr Tooltip lautet **Import SillyTavern or Marinara chat JSONL**. Sie importiert in den Modus-Tab, den du gerade geöffnet hast (Conversation, Roleplay oder Game). Siehe [Chats exportieren und importieren](../chats/export-import.md).

## Einen SillyTavern-Ordner importieren

Bevor du anfängst: Der Assistent liest Dateien auf dem Server-Rechner. Liegt SillyTavern auf einem anderen Rechner, kopiere zuerst seinen Ordner (den, in dem du SillyTavern installiert hast) auf den Marinara-Rechner. Auf dem Rechner mit Marinara funktioniert der Assistent sofort. Von einem anderen Gerät aus musst du das Admin-Secret auf dem Server festlegen und unter **Settings → Advanced → Admin Access** eingeben. Siehe [Marinara sichern und wiederherstellen](backup-and-restore.md) und den Abschnitt „Privileged APIs (ADMIN_SECRET)“ der [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

1. Öffne **Settings → Imports → SillyTavern Import**.
2. Klicke auf **Import from SillyTavern Folder**.
3. Wähle deinen SillyTavern-Ordner. Nimm den Hauptordner, meist den, der `data/` oder `public/` enthält. Nutze einen dieser Wege:
   - Klicke auf **Browse** und wähle den Ordner.
   - Gibt es keine Ordnerauswahl (ein entfernter Server), öffnet sich ein Ordner-Browser in der App. Er listet nur Ordner im Home-Ordner des Benutzers, der den Server betreibt. Klicke auf **Select This Folder**.
   - Tippe den Pfad in **SillyTavern Folder Path** ein, zum Beispiel `/path/to/SillyTavern`. Ein getippter Pfad funktioniert nur, wenn die Einstellung `IMPORT_ALLOWED_ROOTS` des Servers einen Ordner auflistet, der ihn enthält.
4. Klicke auf **Scan Folder**. Marinara zeigt, wie viele Elemente es in jeder Kategorie gefunden hat.
5. Wähle unter **Choose exactly what to import** die gewünschten Elemente aus. Jede Kategorie hat die Schaltflächen **All** und **None** sowie einen Schalter **Show** oder **Hide** für die einzelnen Elemente.
6. Klicke auf **Import Selected**. Ein Fortschrittsbalken zeigt das aktuelle Element und eine Zahl pro Kategorie.
7. Bei **Import complete!** liest du die Zahl pro Kategorie und klickst auf **Done**.

Die meisten Elemente sind vorausgewählt. Die Standard-Presets von SillyTavern, etwa `deterministic`, `neutral` und die `universal-*`-Presets, lässt Marinara unmarkiert, und ein Banner weist darauf hin. Lass sie unmarkiert, solange du keine Kopien willst.

Findet die Suche Charaktere, erscheinen zwei weitere Optionen:

- **Imported character tags** (Standard **All tags**):
  - **All tags** behält die Tags der Quelle.
  - **No tags** überspringt sie.
  - **Existing only** behält nur Tags, die du schon hast.
- **Imported regex scripts** (Standard **Character only**):
  - **Character only** wendet die Skripte auf den jeweiligen Charakter an.
  - **Global** fügt sie für jeden Charakter zu **Presets → Regexes** hinzu.

Wenn es nicht funktioniert hat:

- „Could not find SillyTavern data directory.“ heißt, dass Marinara diesen Ordner nicht lesen kann. Wähle den SillyTavern-Hauptordner.
- „folderPath is not allowed“ heißt, dass der Server den Pfad abgelehnt hat. Klicke auf **Browse** und wähle stattdessen den Ordner. Der Betreiber des Servers kann mit der Einstellung `IMPORT_ALLOWED_ROOTS` begrenzen, welche Ordner importiert werden dürfen. Ist sie gesetzt, muss auch ein gewählter Ordner in einem dieser Ordner liegen. Frage den Betreiber des Servers oder lies die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).
- Schlägt ein Element fehl, überspringt Marinara es, macht weiter und listet es im letzten Schritt unter den Warnungen auf, zum Beispiel `Character "Foo": error message`.

## Was mit deinen Daten passiert

- Chatdateien, die zu einem Charakter gehören, werden als Verzweigungen eines Chats importiert. Eine Verzweigung ist eine Kopie eines Chats, die du getrennt fortsetzt.
- Gruppenchats werden als Roleplay-Chats importiert.
- Importierte Elemente behalten das Änderungsdatum der Quelldatei, nicht das Datum des Imports.

## Was sich nicht übernehmen lässt

Der Assistent liest nur die Kategorien aus der ersten Tabelle. Andere SillyTavern-Daten, etwa globale App-Einstellungen und Quick Replies, werden nicht importiert.

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](../characters/import-export.md)
- [Lorebooks importieren und exportieren](../lorebooks/import-export.md)
- [Chats exportieren und importieren](../chats/export-import.md)
- [Regex-Skripte](../extending/regex-scripts.md)
