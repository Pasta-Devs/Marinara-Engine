# Marinara sichern und wiederherstellen

Speichere eine Kopie deiner Daten aus Marinara Engine, damit du sie später wiederherstellen kannst. Tu das vor einem Update, einem Gerätewechsel oder bevor du [deine Daten löschst](clearing-data.md).

## Welche Option passt?

| Option | Ergebnis | Zweck |
| --- | --- | --- |
| **Download Backup** | Eine `.zip` mit allen Daten und Dateien. | Eine vollständige Kopie von allem. |
| **Export Profile** | Eine kleinere Datei mit deinen Kontodaten (Charaktere, Chats, Lorebooks und mehr). | Eine Kopie ohne geheime Werte oder Dateien für andere Tools. |

Eine `.zip` ist eine Datei, die viele Dateien enthält. Beide Optionen findest du unter **Settings → Advanced → Backup & Export**. Die Wiederherstellung findest du unter **Settings → Imports → Profile & Marinara**.

**Bevor du anfängst:** Auf dem Rechner, auf dem Marinara läuft, funktionieren diese Funktionen sofort. Von einem Handy, Tablet oder anderen Gerät aus musst du das Admin-Secret auf dem Server festlegen und denselben Wert unter **Settings → Advanced → Admin Access** eingeben. Das Admin-Secret ist ein Passwort in der `.env`-Datei des Servers, unter `ADMIN_SECRET`. Siehe den Abschnitt „Privileged APIs (ADMIN_SECRET)“ in der [Referenz zur Server-Konfiguration](../CONFIGURATION.md) und [Fernzugriff](../REMOTE_ACCESS.md).

## Download Backup

1. Öffne **Settings → Advanced**.
2. Klick unter **Backup & Export** auf **Download Backup**. Die Schaltfläche zeigt **Creating backup…**.
3. Speichere die Datei, wenn dein Browser danach fragt, oder suche sie im Downloads-Ordner.

Die `.zip` enthält:

- deine gespeicherten Textdaten (Charaktere, Chats, Lorebooks, Presets, Verbindungen, Einstellungen);
- deine hochgeladenen und erzeugten Dateien, etwa Avatare, Sprites, Hintergründe, Galeriebilder, Schriften, eigene Emojis und Sticker sowie deinen eigenen Benachrichtigungston;
- die Datei `.encryption-key`, sofern vorhanden;
- eine Anleitung `RESTORE.txt` zur Wiederherstellung von Hand (siehe [Von Hand wiederherstellen](#restore-by-hand)).

Die Ordnernamen stehen unter [Wo Marinara deine Daten speichert](where-data-is-stored.md).

> **Warnung:** Ein Backup enthält deine gespeicherten API-Keys und die Datei `.encryption-key`, mit der sie entschlüsselt werden können. Gib es niemals weiter. Bewahre es an einem privaten Ort auf.

Unter Android kannst du den Datenordner der App nicht öffnen. Mit **Download Backup** bekommst du eine Kopie vom Gerät.

Wenn es nicht funktioniert: Erscheint „Backup preparation timed out after one hour.“, versuche es erneut. Kann ein anderes Gerät das Backup nicht herunterladen, prüf **Admin Access** (siehe oben).

<a id="automatic-backups"></a>

## Automatische Backups

Marinara kann auf dem Rechner, auf dem es läuft, regelmäßig ein vollständiges Backup anlegen.

1. Öffne **Settings → Advanced → Backup & Export**.
2. Aktiviere **Automatic backups**.
3. Wähle **Daily**, **Weekly** oder **Monthly**.
4. Stell **Automatic backups kept** auf einen Wert von 1 bis 9999.

Marinara erstellt das erste Backup kurz nach dem Aktivieren. Nach jedem Durchlauf behält es die festgelegte Anzahl der neuesten Backups und löscht ältere automatische Backups. Backups, die du mit **Download Backup** erstellt hast, löscht es nie.

Automatische Backups liegen im Ordner `backups/` innerhalb des Datenordners. Das neueste heißt `marinara-automatic-backup.zip`. Ältere Dateien tragen Datum und Uhrzeit im Namen. Sie verwenden dasselbe Format wie **Download Backup**.

Für jeden Durchlauf muss Platz für ein weiteres vollständiges Archiv frei sein, da das alte bestehen bleibt, bis das neue fertig ist. Reicht der Platz nicht aus, überspringt Marinara den Durchlauf und zeigt den Grund neben der Einstellung an. Sobald wieder Platz frei ist, versucht Marinara es erneut.

> **Tipp:** Bewahre eine zweite Kopie außerhalb des Datenordners auf. Bei einem Festplattenausfall oder wenn die App gelöscht wird, gehen auch die automatischen Backups verloren.

<a id="export-a-profile"></a>

## Ein Profil exportieren

1. Öffne **Settings → Advanced → Backup & Export**.
2. Klick auf **Export Profile**. Ein Dialog mit demselben Titel öffnet sich.
3. Wähle ein Format.
4. Dein Browser lädt die Datei herunter.

- **Marinara Native** behält Charaktere, Personas, Chats, Lorebooks, Presets, Agenten, Themes, den Code von Personal Extensions und Medien. API-Keys, Webhook-Links und manche Chat-Einstellungen werden nicht wiederhergestellt (siehe [Keys erneut eingeben](#enter-your-keys-again)). Du kannst das Profil in Marinara wiederherstellen.
- **Compatible JSON** erstellt eine `.zip` mit einfachen Charakter-, Persona- und Lorebook-Dateien für andere Tools. Du kannst sie nicht in Marinara wiederherstellen.

Ein natives Profil wird als `marinara-profile.json` heruntergeladen. Ist es zu groß, bietet Marinara stattdessen eine ZIP-Datei an. Klick auf **Export ZIP**, um `marinara-profile.zip` herunterzuladen.

Ein natives Profil behält den Code von Personal Extensions, aber nicht den Aktivierungs- oder Freigabestatus. Jede wiederhergestellte Erweiterung ist deaktiviert. Prüfe sie erneut unter **Settings → Addons**.

Ein natives Profil behält Regex-Skripte, ihre Ordner und die Pause-Einstellung jedes Ordners. Wie du einzelne Skripte als JSON weitergibst, steht unter [Regex-Skripte](../extending/regex-scripts.md#import-and-replace-scripts).

## Mit Import Profile wiederherstellen

**Import Profile** lädt eine Profildatei oder eine `.zip` von **Download Backup**.

1. Öffne **Settings → Imports**.
2. Klick unter **Profile & Marinara** auf **Import Profile (JSON/ZIP)**.
3. Wähle `marinara-profile.json`, `marinara-profile.zip` oder eine Backup-`.zip`. Die Schaltfläche zeigt **Scanning Profile...**.
4. Lies den Dialog **Import Profile**. Er listet die gefundenen Daten auf. Elemente, die es in Marinara schon gibt, werden durch die Versionen aus der Datei ersetzt, außer du [fügst nur Fehlendes hinzu](#only-add-whats-missing).
5. Klick auf **Import** oder zum Abbrechen auf **Cancel**. Die Schaltfläche zeigt **Importing Profile...**. Marinara speichert zuerst eine Sicherheitskopie deiner Daten, danach folgt ein Fortschrittsbalken. Nach Abschluss bestätigt eine Meldung den Import.

Wenn es nicht funktioniert:

- Außer unter `localhost`, `127.0.0.1` oder `[::1]` ist für den Profilimport HTTPS erforderlich. Die Fehlermeldung lautet „Profile import requires HTTPS outside local development.“ Öffne Marinara über eine HTTPS-Adresse.
- Fehlen Mediendateien in einer `.zip`, wird der Import trotzdem abgeschlossen. Eine Warnung listet die fehlenden Dateien auf; den Rest importiert Marinara.
- Reicht der Speicherplatz für die Sicherheitskopie nicht aus, wird nichts importiert. Die Fehlermeldung beginnt mit „Nothing was imported, because a safety copy could not be saved first.“ Gib ungefähr so viel Speicherplatz frei, wie ein vollständiges Backup belegt, und importiere dann erneut.

Importierst du dasselbe Profil zweimal, aktualisiert Marinara die vorhandenen Elemente, statt Kopien anzulegen. Profile aus sehr alten Versionen können Duplikate erzeugen.

<a id="only-add-whats-missing"></a>

### Nur Fehlendes hinzufügen

Um etwas zurückzuholen, das du gelöscht hast, ohne die Änderungen zu verlieren, die du seitdem gemacht hast, aktiviere oberhalb von **Import Profile (JSON/ZIP)** die Option **Keep my current versions, only add what's missing** (aktuelle Versionen behalten, nur Fehlendes hinzufügen) und importiere dann wie oben beschrieben. Alle Elemente und Dateien, die es in Marinara schon gibt, bleiben unverändert; hinzugefügt wird nur, was Marinara noch nicht hat. Dazu gehört alles, was du seit dem Speichern der Datei gelöscht hast, etwa einzelne Nachrichten oder Lorebook-Einträge – nicht nur das Element, das du zurückhaben wolltest. Das Langzeitgedächtnis zählt als ein Element: Hat Marinara schon Daten im Langzeitgedächtnis, wird das Langzeitgedächtnis aus der Datei nicht hinzugefügt.

Da nichts ersetzt wird, speichert Marinara keine Sicherheitskopie, und **Undo Last Import** (letzten Import rückgängig machen) macht weiterhin den Import davor rückgängig.

Mit Profilen aus sehr alten Versionen geht das nicht: Sie fügen ihre Elemente immer zusätzlich zu deinen hinzu, und der Dialog **Import Profile** weist darauf hin.

### Einen Import rückgängig machen

Vor jedem Import, der Elemente ersetzt, speichert Marinara eine vollständige Kopie deiner Daten im Ordner `backups/` des Datenordners, als Datei, deren Name mit `marinara-before-import-` beginnt, gefolgt von Datum und Uhrzeit. Ist der Import abgeschlossen, wird die Kopie vom vorherigen Import gelöscht, sodass nur die neueste erhalten bleibt.

1. Öffne **Settings → Imports**.
2. Klick unter **Profile & Marinara** auf **Undo Last Import**. Die Zeile darunter zeigt, wann die Sicherheitskopie gespeichert wurde.
3. Klick zur Bestätigung im Dialog auf **Undo Last Import**.

Das Rückgängigmachen stellt deine Versionen der Elemente und Dateien wieder her, die der letzte Import ersetzt hat. Hast du eines dieser Elemente nach dem Import geändert, geht diese Änderung verloren. Alles andere bleibt unverändert, auch Elemente, die der Import hinzugefügt hat. Du kannst einen Import einmal rückgängig machen, danach wird die Sicherheitskopie gelöscht.

Was der Import zur Sicherheit ausgeschaltet hat, schaltet das Rückgängigmachen nicht wieder ein. Schalte Folgendes von Hand wieder ein:

- dein aktives Theme;
- Personal Extensions (prüfe sie erneut unter **Settings → Addons**);
- eigene Tools, die ein Skript ausführen oder einen Webhook aufrufen;
- Erinnerungen von Professor Mari.

Hat der Import den API-Key einer Verbindung geleert, gib den Key erneut ein (siehe [Keys erneut eingeben](#enter-your-keys-again)). War sie deine Standard- oder Ersatzverbindung, lege sie erneut als solche fest.

Verzweigungen, die der Import ersetzt hat, bleiben vom Chat getrennt, von dem sie abgezweigt wurden. Der Import hat diese Verknüpfung bereits entfernt, und das Rückgängigmachen kann sie nicht wiederherstellen.

Profile aus sehr alten Versionen fügen nur Elemente hinzu. Deshalb speichert Marinara für sie keine Sicherheitskopie, und es gibt nichts rückgängig zu machen.

Die Sicherheitskopie belegt so viel Speicherplatz wie ein vollständiges Backup. Um diesen Platz freizugeben, ohne den Import rückgängig zu machen, klick unter **Profile & Marinara** auf **Delete Safety Copy** (Sicherheitskopie löschen) und bestätige. Deine Daten bleiben unverändert, aber du kannst diesen Import nicht mehr rückgängig machen. Wurde ein Import unterbrochen, kann **Delete Safety Copy** auch allein erscheinen; die Kopie lässt sich dann nicht zum Rückgängigmachen verwenden, du kannst sie aber trotzdem löschen.

<a id="enter-your-keys-again"></a>

## Keys erneut eingeben

**Import Profile** stellt API-Keys und Webhook-Links nie wieder her, auch nicht aus einer `.zip` von **Download Backup**. Ein API-Key ist ein geheimer Code, den du von einem Dienst bekommst. In der Profildatei und im Profil innerhalb eines Backups sind diese Werte entfernt. Nach dem Import auf einem neuen Rechner musst du sie erneut eingeben:

1. Öffne **Connections** über die obere Leiste.
2. Öffne jedes Konto, das du nutzt, gib den API-Key ein und speichere. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).
3. Gib den Webhook-Link bei jedem eigenen Tool, das ihn verwendet, erneut ein.

Auch manche Chat-Einstellungen mit Adressen oder Keys (Discord, DeepL, Intiface) bleiben leer. Gib sie in den **Chat Settings** jedes betroffenen Chats erneut ein.

Beim Import werden bereits gesetzte Keys derselben Installation nicht gelöscht.

## Auf einen neuen Rechner umziehen

1. Installiere Marinara auf dem neuen Rechner und starte es. Siehe [Installation](../INSTALLATION.md).
2. Öffne **Settings → Imports → Profile & Marinara** und klick auf **Import Profile (JSON/ZIP)**.
3. Wähle deine `.zip` von **Download Backup** oder deine Profildatei und klick auf **Import**.
4. Gib deine API-Keys erneut ein, wie oben beschrieben.

Die Schlüsseldatei im Backup hilft nur, wenn du den gesamten Datenordner von Hand kopierst, wie unten beschrieben.

<a id="restore-by-hand"></a>

## Von Hand wiederherstellen

Nutze diesen Weg nur, wenn **Import Profile** nicht verfügbar ist. Die `.zip` enthält einen Ordner, beispielsweise `marinara-backup-...`, mit einer Anleitung `RESTORE.txt`.

1. Stoppe Marinara.
2. Entpacke das Backup.
3. Kopiere die Ordner und die Datei `.encryption-key` aus dem entpackten Ordner in deinen Datenordner. Siehe [Wo Marinara deine Daten speichert](where-data-is-stored.md).
4. Starte Marinara.

Bewahre die Datei `.encryption-key` zusammen mit dem Ordner `storage` auf. Sonst können die gespeicherten API-Keys nicht gelesen werden.

Die Liste **Existing backups** unter **Backup & Export** ist normalerweise leer. Du brauchst sie nicht.

## Verwandte Anleitungen

- [Wo Marinara deine Daten speichert](where-data-is-stored.md)
- [Daten löschen oder zurücksetzen](clearing-data.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
