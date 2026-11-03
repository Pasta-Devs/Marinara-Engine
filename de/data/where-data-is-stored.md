# Wo Marinara deine Daten speichert

Finde den Ordner, in dem Marinara Engine deine Daten speichert, und erfahre, was du beim Umzug oder Kopieren mitnehmen musst.

Marinara läuft auf deinem eigenen Rechner und speichert dort deine Charaktere, Chats und Einstellungen. Wenn du eine Antwort erzeugst, sendet Marinara den Chat-Inhalt trotzdem an den verbundenen KI-Dienst.

## Den Datenordner finden

Alles, was du erstellst, liegt in einem Ordner auf dem Rechner, auf dem der Server läuft. Das ist der Datenordner. Die Einstellung dafür heißt `DATA_DIR`: eine Umgebungsvariable, die du vor dem Start des Servers setzt. Sie steht nicht unter **Settings**.

- Standardmäßig heißt der Ordner `data` und liegt neben den Server-Dateien.
- Im offiziellen Docker-Container lautet der Pfad `/app/data`.
- Den genauen Pfad findest du im Fenster, in dem du Marinara gestartet hast (Terminal oder Konsole). Beim Start erscheint eine Zeile, die mit `[storage] DATA_DIR=` beginnt; danach folgt der Pfad. Findest du das Fenster nicht mehr, suche im Marinara-Ordner nach einem Ordner namens `data`.

Um den Ordner zu verlegen, setze `DATA_DIR` und starte Marinara neu. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

## Was im Datenordner liegt

Deine Textdaten liegen im Ordner `storage`: Charaktere, Chats, Nachrichten, Lorebooks, Presets und Verbindungen. Marinara speichert sie in vielen kleinen Dateien. Nach einem Upgrade von einer älteren Ordnerstruktur können unter `storage/tables/` noch alte Kopien mit der Endung `.pre-shard` liegen. Marinara löscht sie nie. Sobald alles funktioniert, kannst du sie selbst löschen, um Platz freizugeben.

Bilder, Audio und andere Dateien liegen in eigenen Ordnern neben `storage`:

| Ordner | Inhalt |
| --- | --- |
| `avatars` | Avatare von Charakteren und Personas |
| `sprites` | Sprite-Grafiken der Charaktere |
| `avatar-models` | Dateien für die Agenten **2D Avatars** und **3D Avatars**, etwa PNGTuber-Bilder und 3D-Modelle |
| `backgrounds` | Hochgeladene Chat-Hintergründe |
| `gallery` | Galeriebilder |
| `fonts` | Eigene Schriftarten |
| `knowledge-sources` | Dateien für Wissens-Agenten |
| `game-assets` | Assets für Game Mode |
| `game-scene-videos` | Szenenvideos für Game Mode |
| `conversation-call-character-videos` | Charaktervideos für Anrufe in Conversation |
| `custom-emojis` | Eigene Emoji-Bilder |
| `custom-stickers` | Eigene Sticker-Bilder |
| `notification-sounds` | Dein eigener Benachrichtigungston |
| `long-term-memory` | Daten des Agenten für Langzeitgedächtnis |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Bilder für Lorebooks, Presets, Agenten und Konten |

Der Datenordner enthält außerdem `backups/` (deine [automatischen Backups](backup-and-restore.md#automatic-backups)) und die Schlüsseldatei. **Download Backup** enthält alle Ordner in der Tabelle, `storage` und die Schlüsseldatei. Für Entwickler gibt es die Anleitung [File-Native Storage](../development/file-storage.md).

## Die Schlüsseldatei aufbewahren

Marinara verschlüsselt deine gespeicherten API-Keys. Der Schlüssel dafür liegt in der Datei `.encryption-key` im Datenordner.

Kopierst du deine Daten ohne diese Datei auf einen neuen Rechner, kann Marinara die gespeicherten API-Keys nicht lesen. Du musst sie erneut eingeben. Kopiere die Datei daher zusammen mit dem übrigen Datenordner.

Manche Installationen beziehen den Schlüssel stattdessen aus der Umgebungsvariable `ENCRYPTION_KEY`. Dann gibt es keine Datei zum Kopieren. Bewahre den Wert separat sicher auf. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

## Daten von Android kopieren

Unter Android liegt der Datenordner im App-Speicher. Ohne Root-Zugriff kannst du ihn nicht öffnen und daher nicht kopieren. Nutze **Settings → Advanced → Backup & Export → Download Backup**. Die `.zip` enthält die Datei `.encryption-key`, sofern vorhanden. Siehe [Marinara sichern und wiederherstellen](backup-and-restore.md).

Automatische Backups liegen im selben App-Speicher. Wenn du die App deinstallierst oder zurücksetzt, können sie zusammen mit den aktiven Daten verloren gehen. Bewahre deshalb eine Kopie an einem anderen Ort auf.

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](backup-and-restore.md)
- [Daten löschen oder zurücksetzen](clearing-data.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
- [File-Native Storage](../development/file-storage.md)
