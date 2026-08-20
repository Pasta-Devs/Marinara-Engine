# Dateibasierte Speicherung

Diese Anleitung beschreibt, wie Marinara Engine Daten lokal ablegt. Wie die Ordner für Nutzende aussehen, steht unter [Wo deine Daten liegen](../data/where-data-is-stored.md).

## Verbindliche Datenquelle

Marinara legt die Datensätze der Anwendung als JSON-Abbilder unter `DATA_DIR/storage` ab:

```text
storage/
├── manifest.json
└── tables/
    ├── chats/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── characters/
    │   ├── <encoded-character-id>.json
    │   └── ...
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

Mit `FILE_STORAGE_DIR` lässt sich das Verzeichnis `storage` überschreiben. Jede Tabellendatei enthält ein JSON-Array. In `manifest.json` stehen die Version des Speicherformats, der Speicherzeitpunkt, die Backend-Kennung und die Anzahl der Datensätze jeder registrierten Tabelle.

### Aufgeteilte Tabellen

Speicherformat 5 speichert **jede dateibasierte Tabelle als nach Besitzschlüssel aufgeteilte Dateien**, statt eine tabellenweite JSON-Datei neu zu schreiben. Untergeordnete Zeilen werden nach der Entität gruppiert, die ihren Lebenszyklus und Zugriff bestimmt: Nachrichten, Speicher, Agent-Läufe und Spielzustand nach Chat; Kartenverlauf und Galerien nach Charakter oder Persona; Lorebook-Einträge, Ordner und Verknüpfungen nach Lorebook; Prompt-Kinder nach Preset; soziale Zeilen nach Konto oder Beitrag. Eigenständige Datensätze verwenden eine Datei pro Primärschlüssel. Nur `message_swipes` wird indirekt über die übergeordnete Nachricht zugeordnet. `FILE_BACKED_TABLES` und `getFileTableShardStrategy()` in `file-backed-store.ts` sind verbindlich; für sichere Downgrades spiegelt der Offline-Befehl `unshard` in `scripts/protect-launcher-data.mjs` die vollständige Tabellenliste, und ein Regressionstest hält beide Listen synchron.

Die Änderungsverfolgung arbeitet pro aufgeteilter Datei, sodass ein Flush nur geänderte Besitzer berührt. Erreicht die Zeilenzahl einer Datei null, wird sie gelöscht, statt als leeres Array gespeichert zu werden. Dateinamen werden aus dem Besitzschlüssel prozentkodiert; bei zu langen oder reservierten Namen kommen Hash-Fallbacks zum Einsatz. Diese Kodierung ist eine Sicherheitsgrenze, weil importierte Profile beliebige IDs enthalten können. Die Dateien sind nur Behälter; die Zeilen tragen weiterhin ihre eigenen Schlüssel.

Beim ersten Start mit neu aufgeteilten Tabellen werden vorhandene große Dateien automatisch migriert: Die Zeilen werden nach Besitzer gruppiert und als einzelne Dateien geschrieben, danach werden die große Datei **und ihre `.bak`-Datei** in `.pre-shard` umbenannt. Diese Dateien bilden die automatische Sicherung vor der Migration und werden vom Engine nie gelöscht. Eine `.migrating`-Markierung ermöglicht eine eindeutige Wiederherstellung nach einem Absturz. Erstellt ein älterer Build später neben den aufgeteilten Dateien erneut eine große Datei, gewinnen die aufgeteilten Dateien und der Konflikt wird mit einem Zeitstempel-Suffix `.post-downgrade-` isoliert, niemals zusammengeführt. Verwaiste untergeordnete Zeilen landen in der Datei `orphaned-rows`, statt verloren zu gehen. Ein Manifest aus einem neueren Speicherformat wird nicht geladen.

## Laufzeitmodell

`packages/server/src/db/file-backed-store.ts` lädt die Tabellen-Abbilder beim Start in den Arbeitsspeicher. Lesen und Ändern erledigt der Server über die dateibasierten Operationen aus `db/file-query.ts`. `db/file-schema.ts` liefert kollisionssichere Metadaten zu Tabellen und Spalten für die Definitionen in `db/schema/`.

Die verkettbare API aus `select`, `insert`, `update` und `delete` hält die Speicherdienste schlank und bleibt dabei unabhängig von einer externen Datenbank oder einem ORM. Filter und Sortierung sind ausdrücklich als Ausdrucksobjekte definiert. Der Store wertet deshalb nie Abfragetexte aus.

Tabellen deklarieren natürliche Schlüssel über `fileTable(..., { uniqueBy: [...] })`. Vor jeder Einfügung oder Änderung prüft der Store die Primärschlüssel und die deklarierten natürlichen Schlüssel gegen den vollständigen Änderungsvorschlag – erst danach ändert er die Datensätze im Arbeitsspeicher. Eine verletzte Bedingung lässt die Tabelle also unangetastet. Gilt die Eindeutigkeit nur für einen Teil der Datensätze, ergänzt eine Regel das Prädikat `when`.

Heruntergeladene Capability-Pakete können eigene Instanzen von Dateitabellen mitbringen. Der Store löst sie zuerst über die Objektidentität und danach über den registrierten Tabellennamen auf. So kann Speichercode aus einem Paket gefahrlos auf Tabellen der Engine zugreifen.

## Speichern und Wiederherstellen

Schreibvorgänge markieren die betroffenen Tabellen als geändert. Eine kurze Entprellzeit fasst dicht aufeinanderfolgende Änderungen zusammen, und ein Sicherheitstimer schreibt Ausstehendes regelmäßig weg. Beim geordneten Herunterfahren wartet Marinara laufende Schreibvorgänge ab und sichert anschließend alle Datensätze, die sich währenddessen geändert haben.

Jedes Abbild landet zunächst in einer temporären Datei, wird geleert und dann atomar umbenannt. Vor dem Ersetzen frischt Marinara das letzte intakte Abbild als `.bak`-Datei auf. Ist die Hauptdatei beim Start unlesbar, stellt Marinara sie nach Möglichkeit aus dem Backup wieder her. Taugt keine der beiden Kopien, verschiebt Marinara die beschädigten Dateien mit einem Zeitstempel-Suffix in Quarantäne und startet nur diese eine Tabelle leer – die Oberfläche bleibt so für die Wiederherstellung erreichbar.

## Transaktionen

Transaktionen arbeiten mit Copy-on-write-Abbildern, deren Gültigkeitsbereich `AsyncLocalStorage` festlegt. Eine Tabelle wird erst kopiert, wenn die Transaktion sie zum ersten Mal ändert. Wirft der Callback einen Fehler, setzt Marinara nur die Tabellen dieser Transaktion zurück; parallele Schreibvorgänge an anderen Tabellen bleiben erhalten.

## Eine Tabelle hinzufügen

So gehst du vor, wenn neue Daten dauerhaft gespeichert werden sollen:

1. Definiere die Tabelle in `packages/server/src/db/schema/` mit `fileTable` und den dateibasierten Spalten-Buildern.
2. Exportiere sie aus `db/schema/index.ts`.
3. Deklariere natürliche Schlüssel über die Tabellenoption `uniqueBy`.
4. Trage den Namen in `FILE_BACKED_TABLES` ein; füge die stabile übergeordnete Spalte zu `SHARD_KEY_COLUMNS` hinzu, wenn die Zeilen nach einem Besitzer statt nach ihrem Primärschlüssel gruppiert werden sollen.
5. Lege bei Bedarf Cascade- oder Set-null-Beziehungen in `file-backed-store.ts` fest.
6. Ergänze Metadaten zu JSON-Spalten in `services/mari-db/mari-db.service.ts`, sobald ein Textfeld strukturiertes JSON enthält.
7. Prüfe, ob Backup und Wiederherstellung des Profils weiterhin funktionieren.
8. Führe `pnpm check` und die passenden Speicher-Regressionstests aus.

Halte Tabellendefinitionen, Beziehungs-Metadaten, Profil-Portabilität und die Mari-DB-Validierung in derselben Änderung auf einem Stand.
