# Wo Marinara deine Daten speichert

In dieser Anleitung erfährst du, wo Marinara Engine die Daten auf dem eigenen Rechner ablegt. Es geht um den zentralen Datenordner, um die Ordner `storage` und die Asset-Ordner darin sowie um die Schlüsseldatei, die gespeicherte API-Keys schützt.

Marinara Engine (unten kurz „Marinara“) läuft auf dem eigenen Rechner. Gespeicherte Charaktere, Chats und Einstellungen bleiben also lokal. Beachte trotzdem: Sobald eine Antwort generiert wird, schickt Marinara den Chat-Inhalt an den verbundenen KI-Anbieter.

## Der Datenordner (DATA_DIR)

Alles, was in Marinara entsteht, liegt in einem einzigen Ordner auf dem Rechner, der den Server betreibt. Dieser Ordner heißt Datenordner. Die Umgebungsvariable, die darauf zeigt, heißt `DATA_DIR`. Eine Umgebungsvariable ist ein Wert, den du außerhalb der App auf dem Server setzt. Im Panel **Settings** (Einstellungen) findest du sie deshalb nicht.

Standardmäßig ist der Datenordner ein Ordner namens `data`, den Marinara neben den Server-Dateien anlegt. Läuft Marinara in einem offiziellen Docker-Container, liegt der Datenordner unter `/app/data` im Container.

Falls du den Datenordner nicht findest, hilft das Start-Log des Servers. Beim Start gibt Marinara eine Zeile aus, die mit `[storage] DATA_DIR=` beginnt – dahinter steht der vollständige Pfad zum Datenordner.

Über ein selbst gesetztes `DATA_DIR` lässt sich der Datenordner an einen anderen Ort verlegen. Wie du die Variable setzt, steht in der [Server-Konfigurationsreferenz](../CONFIGURATION.md). Damit ein neuer `DATA_DIR`-Wert greift, muss Marinara neu starten.

## Der Ordner `storage` und die Asset-Ordner

Im Datenordner sind die Daten auf einen Ordner `storage` und mehrere Asset-Ordner verteilt.

Der Ordner `storage` enthält die Textdaten: Charaktere, Chats, Nachrichten, Lorebooks (Sammlungen von Weltwissen), Presets (gespeicherte Prompt-Vorlagen) und Verbindungen. Marinara legt sie hier als Dateien ab – in diesem Ordner steckt also der Großteil deiner Arbeit.

Bilder, Audio und andere Mediendateien liegen in eigenen Ordnern, jeweils benannt nach ihrem Inhalt. Die wichtigsten Asset-Ordner sind:

| Ordner | Inhalt |
| --- | --- |
| `avatars` | Avatare von Charakteren und Personas |
| `sprites` | Sprite-Grafiken der Charaktere |
| `backgrounds` | Selbst hochgeladene Chat-Hintergründe |
| `gallery` | Bilder der Galerie |
| `fonts` | Selbst hinzugefügte Schriftarten |
| `knowledge-sources` | Dateien, die du für Wissens-Agenten hochgeladen hast |
| `game-assets` | Assets für den Game Mode |
| `custom-emojis` | Eigene Emoji-Bilder |
| `custom-stickers` | Eigene Sticker-Bilder |

Wie der Ordner `storage` technisch funktioniert, erklärt [File-Native Storage](../development/file-storage.md) für Entwicklerinnen und Entwickler im Detail.

## Die Schlüsseldatei für die Verschlüsselung

Marinara verschlüsselt gespeicherte API-Keys (geheime Zugangscodes, ähnlich einem Passwort), damit sie nicht im Klartext auf der Festplatte liegen. Den dafür genutzten Schlüssel legt Marinara in der Datei `.encryption-key` im Datenordner ab.

Wichtig wird diese Datei, sobald du Daten verschiebst oder wiederherstellst. Angenommen, du kopierst den Datenordner auf einen neuen Rechner, lässt die Datei `.encryption-key` aber zurück: Dann kann Marinara die gespeicherten API-Keys nicht mehr entschlüsseln, und du musst sie erneut eingeben. Halte diese Datei deshalb immer bei den übrigen Daten.

Manche fortgeschrittenen Setups liefern den Schlüssel nicht über die Datei, sondern über die Umgebungsvariable `ENCRYPTION_KEY`. Wenn du diese Variable nutzt, bewahre den Wert separat sicher auf. Eine Datei `.encryption-key` gibt es dann nicht zum Mitkopieren. Details stehen in der [Server-Konfigurationsreferenz](../CONFIGURATION.md).

## Wo liegen meine Daten unter Android

Unter Android liegt der Datenordner des Servers meist im App-Speicher, an den du ohne Root-Zugriff nicht herankommst. Der Ordner lässt sich also nicht einfach vom Handy kopieren.

Um unter Android trotzdem eine Kopie der Daten zu bekommen, nutze die Schaltfläche **Download Backup** (Backup herunterladen). Du findest sie unter **Settings** im Tab **Advanced** im Bereich **Backup & Export**. Daraus entsteht eine einzelne ZIP-Datei mit allen Daten. Sofern vorhanden, enthält das ZIP auch die Datei `.encryption-key`. Zuverlässiger lassen sich Daten vom Handy nicht sichern.

Derselbe Bereich kann zusätzlich 1 bis 9999 rotierende tägliche, wöchentliche oder monatliche automatische Archive unter
`backups/` im Datenordner aufbewahren. Das neueste heißt `marinara-automatic-backup.zip`; ältere aufbewahrte automatische
Archive tragen einen Zeitstempel im Dateinamen. Diese Grenze gilt nur für automatische Backups. Kopiere wichtige Backups
zusätzlich an einen Ort außerhalb des App-Speichers: Beim Deinstallieren oder Zurücksetzen der App können sonst sowohl die
aktiven Daten als auch die lokalen automatischen Backups verschwinden.

Alle Schritte zum Sichern und Wiederherstellen auf jeder Plattform findest du unter [Marinara sichern und wiederherstellen](backup-and-restore.md).

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](backup-and-restore.md)
- [Server-Konfigurationsreferenz](../CONFIGURATION.md)
- [File-Native Storage](../development/file-storage.md)
