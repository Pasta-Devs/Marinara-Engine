# Marinara sichern und wiederherstellen

In dieser Anleitung erfährst du, wie du auf zwei Wegen eine Kopie von allem in Marinara Engine anlegst und diese Kopie später wieder einspielst. Nutze sie vor einem Update, vor dem Umzug auf ein neues Gerät oder bevor du die Daten zurücksetzt.

## Zwei Wege, die Daten zu sichern

Marinara bietet zwei Speicheroptionen. Sie sitzen an unterschiedlichen Stellen und haben unterschiedliche Aufgaben.

- **Download Backup** (Backup herunterladen) legt ein vollständiges **.zip**-Archiv von allem an, was auf der Festplatte liegt. Eine **.zip** ist eine einzelne komprimierte Datei, die viele Dateien in sich trägt. Das ist die vollständigste Kopie und der beste Schutz vor Datenverlust.
- **Export Profile** (Profil exportieren) erzeugt eine leichtere Datei mit den Kontodaten (Charaktere, Personas, Chats, Lorebooks, Presets, Agenten, Themes und Personal Extensions). Ein Profil ist Marinaras portable Kopie des Kontos. Es lässt sich später in Marinara wiederherstellen.

Willst du einfach eine sichere Kopie von allem, nimm **Download Backup**. **Export Profile** ist die richtige Wahl, wenn die Datei kleiner sein soll oder wenn andere Roleplay-Tools sie lesen können sollen.

Beide Speicheroptionen findest du unter **Settings** (Einstellungen) im Tab **Advanced** (Erweitert), im Abschnitt **Backup & Export**.

## Zugriff auf demselben oder einem anderen Gerät

Auf dem Computer, der Marinara ausführt, funktionieren diese Werkzeuge sofort. Das ist der Loopback-Fall: Du hast die App unter `localhost` oder `127.0.0.1` auf demselben Rechner geöffnet.

Von einem Handy, Tablet oder einem anderen Gerät aus brauchen Backup und Wiederherstellung das Geheimnis unter **Admin Access** (Administratorzugriff). Lege das Geheimnis auf dem Server fest und füge denselben Wert in **Settings** im Tab **Advanced** unter **Admin Access** ein. Siehe dazu die am Ende verlinkte Anleitung zum Fernzugriff.

## Download Backup

**Download Backup** erzeugt eine einzelne **.zip**-Datei mit der Datenbank, den Einstellungen und allen Medienordnern (Avatare, Sprites, Hintergründe, Galeriebilder, Schriften, dein eigener Benachrichtigungston und mehr).

1. Öffne **Settings**.
2. Wechsle zum Tab **Advanced**.
3. Suche den Abschnitt **Backup & Export**.
4. Klick auf **Download Backup**.
5. Während der Arbeit zeigt die Schaltfläche **Creating backup...**.
6. In Chrome oder Edge am Desktop öffnet sich ein **Save As**-Dialogfenster, in dem du den Speicherort auswählst. Wähle einen Ordner und speichere.
7. Am Ende erscheint **Backup saved!** oder **Backup downloaded!**.

In manchen Browsern gibt es das **Save As**-Dialogfenster nicht. Dann landet die Datei stattdessen im normalen Downloads-Ordner.

Besonders wichtig ist dieser Schritt auf Android und iOS. Auf diesen Geräten kommst du an den eigenen Datenordner der App meist gar nicht heran. Damit ist **Download Backup** der einzige einfache Weg, eine Kopie vom Gerät zu holen. Bewahre sie an einem sicheren, privaten Ort auf, etwa im eigenen Cloud-Speicher.

Die **.zip** enthält außerdem eine reine Textdatei namens `RESTORE.txt`. Sie erklärt, wie du die Daten notfalls von Hand wiederherstellst. Behandle das Backup als privat: Es kann geheime Dateien enthalten, mit denen sich die gespeicherten API-Keys entsperren lassen. Welcher Ordner was enthält, steht in der unten verlinkten Anleitung zu den Datenspeicherorten.

## Automatische Backups

Der Abschnitt **Backup & Export** kann außerdem ein rotierendes automatisches Vollbackup auf dem Gerät anlegen, das Marinara ausführt.
Aktiviere **Automatic Backups** (automatische Backups), wähle **Daily**, **Weekly** oder **Monthly** und stelle **Automatic backups kept**
auf einen Wert von 1 bis 9999. Marinara legt das erste Backup kurz nach dem Aktivieren an. Nach jedem erfolgreichen Lauf behält es
die festgelegte Anzahl der neuesten automatischen Archive und löscht das älteste überzählige automatische Archiv. Diese
Aufbewahrungsgrenze löscht niemals manuelle Backups oder Backups, die mit **Download Backup** gespeichert wurden.

Automatische Backups liegen im Ordner `backups/` im Datenordner von Marinara. Das neueste Archiv heißt
`marinara-automatic-backup.zip`; ältere aufbewahrte automatische Archive verwenden Dateinamen mit Zeitstempel. Sie nutzen
dasselbe wiederherstellbare, gestreamte Archivformat wie **Download Backup** – inklusive hochgeladener Medien und der Datei mit
dem Verschlüsselungs-Key, sofern eine existiert. Halte eine separate Kopie außerhalb des Marinara-Datenordners bereit, wenn du dich
gegen einen Festplattenausfall, gelöschten App-Speicher oder ein zurückgesetztes Gerät absichern willst.

## Export Profile

**Export Profile** erzeugt eine kleinere Datei mit den Kontodaten. Medien sind enthalten, also kommen Avatare, Bilder und der eigene Benachrichtigungston mit.

1. Öffne **Settings**.
2. Wechsle zum Tab **Advanced**.
3. Suche den Abschnitt **Backup & Export**.
4. Klick auf **Export Profile**.
5. Es öffnet sich ein Fenster mit dem Titel **Export Profile** und zwei Auswahlmöglichkeiten.
6. Wähle ein Format (Erklärung siehe unten).
7. Die Datei wird auf das Gerät heruntergeladen.

Das Fenster bietet zwei Formate:

| Format | Was es ist | In Marinara wiederherstellbar? |
| --- | --- | --- |
| **Marinara Native** | Behält Marinara-Felder, Lorebook-Ordner, Charakter- und Persona-Daten, Presets, Agenten, Themes, Entwürfe für Personal Extensions und eingebettete Medien. | Ja |
| **Compatible JSON** | Einfache Charakter-, Persona- und Lorebook-Dateien für andere Roleplay-Tools. | Nein |

Nimm **Marinara Native**, wenn du eine Kopie behalten willst, die sich später in Marinara wiederherstellen lässt. Kleinere Profile werden als
`marinara-profile.json` heruntergeladen; größere Profile kommen als gestreamte `marinara-profile.zip`, deren Daten auf begrenzte
Tabellendateien verteilt sind. So muss eine große Bibliothek nicht in einen einzigen JSON-String im Arbeitsspeicher passen.

Der Code von Personal Extensions bleibt im nativen Profil erhalten, nicht aber der Aktivierungszustand und die Ausführungsfreigabe. Jede wiederhergestellte Erweiterung kommt deaktiviert an und muss unter **Settings** > **Addons** erneut geprüft werden.

Nimm **Compatible JSON** nur, wenn du Charaktere oder Lorebooks in ein anderes Tool übertragen willst. Heruntergeladen wird eine **.zip** mit einfachen Dateien. Diese Datei lässt sich mit **Import Profile** nicht wieder in Marinara einspielen.

## Wiederherstellen mit Import Profile

Um ein gespeichertes Profil oder ein **Download Backup**-Archiv wieder einzuspielen, nutze **Import Profile** (Profil importieren). Es sitzt in einem anderen Tab als die Speicherwerkzeuge.

1. Öffne **Settings**.
2. Wechsle zum Tab **Imports**.
3. Suche den Abschnitt **Profile & Marinara**.
4. Klick auf **Import Profile (JSON/ZIP)**.
5. Wähle die Datei aus. Möglich sind eine `marinara-profile.json`, eine `marinara-profile.zip` oder eine vollständige **Download Backup**-**.zip**.
6. Marinara prüft die Datei zuerst. Die Schaltfläche zeigt **Scanning Profile...**.
7. Es erscheint ein Fenster mit dem Titel **Import Profile**. Es listet auf, was gefunden wurde, zum Beispiel die Anzahl der Charaktere und Personas.
8. Das Fenster warnt, dass sich der Import nicht rückgängig machen lässt. Lies den Hinweis und klick dann auf **Import**, um fortzufahren, oder auf **Cancel**, um abzubrechen.
9. Der Import läuft und zeigt **Importing Profile...** mit einem Fortschrittsbalken.

Bei einem aktuellen Marinara-Profil erkennt Marinara jedes Element an seiner eigenen Identität wieder, nicht am Namen. Importierst du dasselbe Profil zweimal, aktualisiert Marinara die vorhandenen Elemente an Ort und Stelle, statt Duplikate anzulegen.

Sehr alte Profildateien (aus deutlich älteren Versionen) verhalten sich anders. Ein erneuter Import davon kann doppelte Charaktere, Personas und Lorebooks erzeugen. Wer nur aktuelle Exporte wiederherstellt, stößt nie auf dieses Problem.

Wählst du die Datei aus und änderst sie auf der Festplatte, bevor du bestätigst, bricht der Import mit einer Warnung ab. Wähle die Datei dann einfach erneut aus.

Fehlen in einer **.zip** einzelne Mediendateien, läuft der Import trotzdem durch. Eine gelbe Warnung listet die fehlenden Dateien auf, alles andere wird importiert.

## Nach dem Wiederherstellen: Keys erneut eingeben

**Export Profile** entfernt geheime Werte aus der Profildatei. Die gespeicherten API-Keys und Webhook-Links stehen darin leer. Deshalb lässt sich die Profildatei gefahrlos aufbewahren und weitergeben. Ein API-Key ist das Passwort, das Marinara mit einem KI-Anbieter verbindet.

Bei einem **Download Backup**-Archiv ist das anders. Marinara entfernt daraus keine Geheimnisse. Die Backup-**.zip** ist eine rohe Kopie der Daten. Sie enthält die gespeicherten Keys und die geheime Datei, mit der sie sich entsperren lassen. Gib eine Backup-**.zip** niemals weiter. Bewahre sie an einem privaten Ort auf.

**Import Profile** stellt aus der Profildatei wieder her, selbst wenn du eine Backup-**.zip** auswählst. Das Archiv enthält eine Kopie der Profildatei, und der Import liest genau diese Kopie. Elemente, die dabei neu entstehen, kommen deshalb ohne Keys und ohne Webhook-Links an.

Nach dem Import eines Profils gehst du so vor:

1. Öffne **Settings**.
2. Wechsle zum Tab **Connections**.
3. Gib den API-Key für jeden genutzten Anbieter erneut ein.

Nutzt du eigene Tools, die einen Webhook-Link aufrufen, trage den Link auch dort erneut ein.

Bereits gesetzte Keys löscht der Import nicht. Importierst du ein altes Profil erneut, behält Marinara die aktiven Keys und Webhook-Links bei allen Elementen, die es weiterhin gibt. Ein erneuter Import leert sie nicht.

## Die Liste Existing backups

Der Abschnitt **Backup & Export** kann eine Liste **Existing backups** (vorhandene Backups) samt Lösch-Schaltfläche anzeigen. Im normalen Betrieb bleibt diese Liste leer. **Download Backup** speichert die Datei direkt auf dem Gerät. Eine Kopie in dieser Liste hinterlässt es nicht, und die festgelegte Anzahl aufbewahrter automatischer Archive verwaltet stattdessen der Schalter **Automatic Backups**. Für ein heruntergeladenes Backup brauchst du diese Liste nicht.

## Verwandte Anleitungen

- [Wo Marinara deine Daten speichert](where-data-is-stored.md)
- [Daten löschen oder zurücksetzen](clearing-data.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
