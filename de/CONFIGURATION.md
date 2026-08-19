# Server-Konfiguration – Referenz

In dieser Anleitung erfährst du, wie sich Einstellungen auf Server-Ebene für Marinara Engine über Umgebungsvariablen ändern lassen. Eine Umgebungsvariable ist eine Einstellung, die du in eine einfache Textdatei schreibst und die der Server ausliest. Die meisten Nutzenden brauchen diese Seite nie. Die vollständige Liste aller Variablen steht weiter unten.

## Wann lohnt sich eine Konfiguration?

Marinara Engine läuft ohne jede Konfiguration. Diese Seite brauchst du nur für ein paar wenige Aufgaben – meist dann, wenn der Server mehr als ein Gerät bedienen soll.

Anlass für eine Änderung an der Konfiguration kann sein:

- Andere Geräte im Netzwerk sollen den Server erreichen (Zugriffskontrolle).
- Ein gemeinsam genutzter Server soll per Passwort oder IP-Allowlist geschützt werden.
- Die Daten sollen woanders auf der Festplatte liegen.
- Ausführlicheres Logging soll bei der Fehlersuche helfen.
- Langsame Bild-, Video- oder Embedding-Aufträge brauchen mehr Zeit (Zeitlimits).
- Privilegierte Aktionen wie Backups oder Updates sollen von einem entfernten Gerät aus möglich sein.

Fast alles andere – etwa die Keys für den KI-Anbieter, Charaktere und Chat-Optionen – stellst du in der App ein, nicht hier. Wie du einen KI-Anbieter hinzufügst, steht unter [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md).

Auch die optionalen offiziellen Agenten verwaltest du in der App. Öffne **Agents → Download Agents** (Agenten herunterladen), um sie zu installieren oder zu deinstallieren. Marinara wählt automatisch den Katalog-Zweig von [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), der zur Hauptversion der Engine passt.

Lebenszyklus und Speicherung der Pakete:

- **Updates:** Marinara prüft bereits installierte offizielle Pakete auf passende Updates und fragt vor jedem Download nach. Bei **No** bleibt die aktuelle Version erhalten, und die manuelle Aktion **Update** steht in Download Agents weiterhin bereit. Eine frische Installation bleibt leer, bis du Pakete auswählst.
- **Plattformen:** Auf dem Desktop, unter Docker und bei Android-Installationen über Termux verhält sich alles identisch. iOS und andere Browser-Clients nutzen die Pakete des Marinara-Servers, mit dem sie verbunden sind.
- **Persistenz:** Pakete liegen unter `DATA_DIR/capability-packages`. Docker-Volumes, eigene Datenordner, Backups und normale Updates lassen sie unangetastet.
- **Offline-Betrieb:** Vorhandene Pakete laufen in der installierten Version weiter, wenn GitHub per HTTPS nicht erreichbar ist, ein Update abgelehnt wird oder die Prüfung eines Updates fehlschlägt.

### Import eigener Agenten

Externe Agent-Dateien, -Ordner und eigene Repositorys sind standardmäßig gesperrt. Um sie freizugeben, öffne **Settings → Advanced → Danger Zone** (Einstellungen → Erweitert → Gefahrenzone) und aktiviere **Allow custom Agent imports**. Anders als bei External Extensions braucht dieser vom Nutzer gesteuerte Schalter keine Umgebungsvariable. Bis zur Freigabe bleiben die Import-Bedienelemente ausgegraut.

Vor dem Speichern zeigt jeder Import, welche Fähigkeiten der Agent anfordert. Berechtigungen musst du ausdrücklich bestätigen; mitgelieferte Funktionen und Tool-Auswahlen werden nicht importiert, generiertes CSS wird bereinigt, und Ergebnis-Aktionen prüft Marinara gegen die freigegebenen Fähigkeiten. Schaltest du den Schalter wieder aus, laufen extern importierte Agenten nicht mehr. In Marinara selbst erstellte eigene Agenten und offizielle Pakete aus **Download Agents** bleiben lauffähig und nutzen diesen Schalter nicht.

### Eigene Agent-Repositorys

Eigene Repositorys sind standardmäßig deaktiviert, denn ihre Prompts und Tool-Auswahlen sind ungeprüfte Inhalte von Dritten. Setze `ENABLE_CUSTOM_AGENT_REPOS=true`, aktiviere **Allow custom Agent imports** in der Danger Zone und öffne dann **Agents → Download Agents → Custom Sources**, um ein öffentliches GitHub-Repository in der Vorschau anzusehen. Sowohl das Hinzufügen einer Quelle als auch jede spätere Inhaltsänderung musst du ausdrücklich bestätigen. Die Synchronisierung läuft manuell; Marinara klont keine Repositorys und fragt sie auch nicht im Hintergrund ab.

Im Wurzelordner des Repositorys muss ein Array `agents.json` liegen, das dasselbe Agent-Definitionsformat verwendet wie herunterladbare Agent-Pakete. Eine minimale Datei sieht so aus:

```json
[
  {
    "id": "continuity-helper",
    "name": "Continuity Helper",
    "description": "Checks recent turns for contradictions.",
    "phase": "post_processing",
    "enabledByDefault": false,
    "category": "writer",
    "defaultPromptTemplate": "Check {{messages}} for continuity errors."
  }
]
```

Marinara akzeptiert ausschließlich URLs von GitHub-Repository-Wurzeln und prüft sowohl das größenbegrenzte Archiv als auch jede einzelne Agent-Definition, bevor die Vorschau erscheint. Beim Synchronisieren ersetzen die entfernten Werte für Prompt, Einstellungen und Tools die vom Repository verwalteten Werte aus dieser Vorschau. Verbindung und Bildauswahl bleiben lokal. Verschwindet ein Agent auf der Gegenseite, behält Marinara ihn als gewöhnlichen lokalen eigenen Agenten und entfernt nur die Verknüpfung zum Repository. Beim Entfernen einer Quelle gilt dieselbe Regel.

### External Extensions

Der Import externer Erweiterungen verlangt zwei voneinander unabhängige Freigaben. Setze `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`, öffne dann **Settings → Advanced → Danger Zone**, scrolle unter die Bedienelemente zum Löschen von Daten, lies die Warnung und aktiviere **Allow third-party extension imports**. Erst danach erscheint der Bereich **External Extensions** unter **Settings → Addons**.

Die Umgebungsvariable ist die Erlaubnis des Server-Betreibers, der Schalter in der Danger Zone die ausdrückliche Zustimmung der Nutzerin. Der Bereich selbst, die Import- und Freigabe-Routen sowie beide Laufzeit-Loader setzen diese kombinierte Regel durch. Wird eine der beiden Freigaben zurückgenommen, deaktiviert Marinara externe Einträge und stoppt laufenden externen Code. Manuell abgelegte, alte und per Profil importierte Erweiterungs-Einträge gelten ebenso als extern wie solche unbekannter Herkunft – Dateien einfach in einen Erweiterungs-Ordner zu kopieren, umgeht die Freigaben also nicht.

Entwürfe von Professor Mari bleiben auch ohne dieses Flag verfügbar. Sie werden deaktiviert angelegt, und ihr exakter Code-Hash muss trotzdem freigegeben werden.

Standard bleiben Sandboxed Browser Extensions. Manche ältere Pakete Dritter sind mit **Full page access** (voller Seitenzugriff) gekennzeichnet, weil sie auf das DOM von Marinara angewiesen sind. In diesem Modus läuft genau der freigegebene Code in der Marinara-Seite und kommt an Seiteninhalte, Browser-Speicher, Netzwerk-APIs und die aktuelle Same-Origin-Sitzung heran. Verfügbar ist er nur für External Extensions, sobald beide Freigaben offen sind, und er verlangt eine eigene Bestätigung der Warnung. Hinterlässt die Erweiterung sichtbare oder funktionale Veränderungen, deaktiviere ihn und lade die Seite neu.

## Wo die .env-Datei liegt

Die Konfiguration steht in einer Datei namens `.env`. Das ist eine einfache Textdatei mit einer Einstellung pro Zeile, in der Form `KEY=value`. Zeilen, die mit `#` beginnen, sind Kommentare und werden vom Server ignoriert.

Die Datei `.env` enthält reine Daten, sie ist kein Shell-Skript. Marinara führt weder `$` noch Befehlsersetzungen wie `$(...)` oder sonstige Shell-Syntax innerhalb eines Werts aus. Die Launcher für macOS/Linux und Termux halten sich an dieselbe Regel für die wenigen Einstellungen, die sie schon vor dem Serverstart brauchen. Ein Wert, der bereits in der Umgebung des Launchers steht, hat Vorrang vor dem passenden Eintrag in `.env`.

Marinara legt beim ersten Start selbst eine leere `.env` an – du musst also keine von Hand erstellen.

- Bei normalen Installationen liegt die Datei `.env` im Wurzelordner des Projekts.
- In den offiziellen Docker- oder Podman-Images liegt sie unter `/app/data/.env`, im selben Speicher-Volume wie die Daten.

Eine Datei namens `.env.example` im selben Ordner listet jede Einstellung samt Standard auf. Um etwas zu ändern, kopiere die Zeile aus `.env.example` nach `.env` und passe den Wert hinter dem `=` an.

Diese Beispiel-`.env` ändert den Port und schaltet ein Passwort ein:

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Der Server liest `.env` von sich aus ein, ganz gleich wie du ihn startest – auch bei einem direkten `pnpm start`. Die Shell-Launcher (`start.bat`, `start.sh`, `start-termux.sh`) machen zwei Dinge zusätzlich: Sie setzen `HOST=0.0.0.0`, damit andere Geräte den Server erreichen, und öffnen den Browser für dich. Bei einem nackten `pnpm start` lauscht der Server nur auf diesem Rechner, solange du `HOST` nicht selbst setzt.

## Neustart oder Hot Reload

Marinara überwacht die Datei `.env` im laufenden Betrieb. Speicherst du eine Änderung, greifen die meisten Einstellungen nach rund 2 Sekunden – ohne Neustart. Bei jeder übernommenen Änderung schreibt der Server eine Log-Zeile, die mit `[env-watcher]` beginnt.

Eine kleine Gruppe grundlegender Einstellungen wird beim Serverstart festgelegt. Änderungen daran brauchen einen vollständigen Neustart. Das sind:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- Die Zeitlimit- und Abfrage-Einstellungen für Bild, Video, Sprite und ComfyUI (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` sowie die vier `*_VIDEO_POLL_INTERVAL_MS`-Einstellungen)

Ändert sich eine davon, weist das Log per Warnung auf den nötigen Neustart hin. Einstellungen zur Zugriffskontrolle und Geheimnisse wie `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET` und `CSRF_TRUSTED_ORIGINS` kommen ohne Neustart aus.

## Zugriffskontrolle

Die Zugriffskontrolle entscheidet, wer einen laufenden Server erreichen darf. Dieser Abschnitt ist eine Kurzreferenz. Eine Schritt-für-Schritt-Anleitung mit Beispielen findest du unter [Fernzugriff: Basic Auth und IP-Allowlist](REMOTE_ACCESS.md).

Ein paar Begriffe vorweg:

- Loopback meint denselben Rechner, auf dem der Server läuft. Du erreichst ihn über `127.0.0.1` oder `localhost`.
- Ein CIDR-Bereich ist eine Kurzschreibweise für einen ganzen Block von IP-Adressen, etwa `192.168.1.0/24`. CIDR steht für Classless Inter-Domain Routing.
- RFC-1918-Bereiche sind die üblichen privaten Adressbereiche in Heim- und Büronetzwerken, zum Beispiel `10.x.x.x` und `192.168.x.x`.

Ohne gesetztes Passwort nimmt der Server standardmäßig nur Verbindungen aus vertrauenswürdigen Quellen an: Loopback, jede Adresse in `IP_ALLOWLIST`, Tailscale sowie Docker-Bridge- und Gateway-Verkehr vom selben Host. Alle anderen – auch das gewöhnliche Heimnetzwerk – bekommen ein `403 Forbidden`, bis du eine der folgenden Optionen wählst.

Die wichtigsten Einstellungen zur Zugriffskontrolle:

| Variable                                | Standard          | Wirkung                                                                                                                                                   |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASIC_AUTH_USER`                       | leer              | Benutzername für die Passwortabfrage. Zusammen mit `BASIC_AUTH_PASS` gesetzt, verlangt der Server eine Anmeldung.                                          |
| `BASIC_AUTH_PASS`                       | leer              | Passwort für die Anmeldung. Bleibt eines der beiden Felder leer, ist die Anmeldung aus.                                                                    |
| `BASIC_AUTH_REALM`                      | `Marinara Engine` | Text im Passwortfenster des Browsers.                                                                                                                      |
| `IP_ALLOWLIST`                          | leer              | Kommagetrennte IPs oder CIDR-Bereiche, die immer erlaubt sind. Loopback ist ohnehin immer erlaubt.                                                          |
| `IP_ALLOWLIST_ENABLED`                  | `true`            | Auf `false` bleibt die Liste erhalten, wird aber nicht angewendet.                                                                                          |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false`           | Erlaubt ohne gesetzte Anmeldung wieder den passwortlosen Zugriff aus privaten Netzwerken.                                                                   |
| `ALLOW_UNAUTHENTICATED_REMOTE`          | `false`           | Erlaubt passwortlosen Zugriff von jeder Adresse, auch aus dem öffentlichen Internet. Nicht empfohlen.                                                       |
| `TRUSTED_PRIVATE_NETWORKS`              | eingebaute Standards | Ersetzt die standardmäßigen privaten Netzwerkbereiche. Nimm alle Standards mit auf, die du behalten willst.                                             |
| `BYPASS_AUTH_TAILSCALE`                 | automatisch       | Leer vertraut direkten Tailscale-Sockets nur, wenn beide Endpunkte Tailnet-Adressen nutzen. `true` aktiviert die alte Ausnahme für den gesamten Bereich `100.64.0.0/10`, `false` verlangt die normale Zugriffskontrolle. |
| `BYPASS_AUTH_DOCKER`                    | automatisch       | Leer vertraut nur einer erkannten Container-Schnittstelle und ihrem exakten Gateway. `true` erhält die Kompatibilität mit älteren oder eigenen Netzwerken, `false` verlangt die normale Zugriffskontrolle. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY`         | `true`            | Verlangt normale Anmelde- und Allowlist-Prüfungen für Docker-Verkehr, den ein Proxy weiterleitet. Setz den Wert nur auf `false`, wenn du allen vorgelagerten Clients vertraust. |
| `TRUSTED_HOSTS`                         | leer              | Zusätzliche öffentliche oder Reverse-Proxy-Hostnamen, auf die Marinara antworten darf. Direkte IP, localhost, `.local`, `.home.arpa` und einteilige LAN-Namen funktionieren automatisch. |
| `SSL_CERT`                              | leer              | Pfad zu einer TLS-Zertifikatsdatei. Zusammen mit `SSL_KEY` liefert der Server HTTPS direkt aus.                                                             |
| `SSL_KEY`                               | leer              | Pfad zur Datei mit dem privaten TLS-Schlüssel.                                                                                                             |
| `CSRF_TRUSTED_ORIGINS`                  | leer              | Zusätzliche Browser-Ursprünge, die Änderungen speichern dürfen. Nützlich bei einer öffentlichen Domain oder einem ungewöhnlichen Port. Der Literalwert `null` wird ignoriert und darf nicht für die Android-APK verwendet werden; deren selbst authentifizierende Anmelderouten funktionieren, ohne einem undurchsichtigen Ursprung global zu vertrauen. |

Basic Auth ist die Kurzform von HTTP Basic Authentication, einer schlichten Abfrage von Benutzername und Passwort. Die Zugangsdaten sind dabei nur kodiert, nicht verschlüsselt – kombiniere sie deshalb immer mit HTTPS, sobald der Server im öffentlichen Internet steht. HTTPS ist die sichere, verschlüsselte Variante von HTTP. Für HTTPS direkt aus Marinara setzt du `SSL_CERT` und `SSL_KEY`; alternativ stellst du einen Reverse Proxy davor.

Damit andere Geräte den Server überhaupt erreichen, muss er an eine erreichbare Schnittstelle gebunden sein. Setze dafür `HOST=0.0.0.0`. Die Shell-Launcher erledigen das für dich, `pnpm start` bindet dagegen nur an Loopback.

Handys, Tablets, Tailscale-Peers und andere Rechner verbinden sich weiterhin über die IP-Adresse des Servers, ohne dass du sie in `TRUSTED_HOSTS` einträgst. Veröffentlichst du Marinara unter einem öffentlichen oder Reverse-Proxy-Hostnamen, trag genau diesen Namen ein, zum Beispiel `TRUSTED_HOSTS=chat.example.com`. Namen, die schon in `CSRF_TRUSTED_ORIGINS` oder `CORS_ORIGINS` stehen, akzeptiert Marinara aus Kompatibilitätsgründen ebenfalls. Diese Host-Prüfung verhindert, dass der DNS-Name einer öffentlichen Website auf die Loopback-Adresse von Marinara umgebogen wird.

## Speicherung

Die Speicher-Einstellungen legen fest, wo die lokalen Daten liegen. Dazu zählen Chats, Charaktere, Avatare und generierte Medien.

| Variable           | Standard                               | Wirkung                                                                  |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `DATA_DIR`         | `packages/server/data`                 | Wurzelordner für alle Nutzerdaten. Docker-Images setzen `/app/data`.      |
| `FILE_STORAGE_DIR` | der Ordner `storage` innerhalb von `DATA_DIR` | Überschreibt den Ordner für die Dateispeicherung.                  |
| `ENCRYPTION_KEY`   | leer                                   | Schlüssel zum Verschlüsseln gespeicherter API-Keys. Erzeuge einen mit dem Befehl unten. |

Marinara legt die Daten als einfache JSON-Dateien ab. Backups lassen sich so leicht kopieren und einsehen.

Um einen Verschlüsselungsschlüssel zu erzeugen, führe diesen Befehl aus und füge das Ergebnis bei `ENCRYPTION_KEY` ein:

```
openssl rand -hex 32
```

Was in welchem Datenordner steckt, erklärt [Wo deine Daten gespeichert werden](data/where-data-is-stored.md).

## Log-Stufen

Das Logging steuert, wie ausführlich der Server auf seine Konsole schreibt. Wichtigster Regler ist `LOG_LEVEL`. Alles unterhalb der gewählten Stufe blendet der Server aus.

| Stufe   | Was sie zeigt                                                       |
| ------- | ------------------------------------------------------------------- |
| `error` | Nur schwere, nicht behebbare Fehler.                                |
| `warn`  | Fehler plus nicht kritische Warnungen. Das ist der Standard.         |
| `info`  | Warnungen plus Start- und Anfrage-Logs.                              |
| `debug` | Alles, inklusive vollständiger Prompts und Modellantworten. Sehr geschwätzig. |

Empfehlungen:

- Für den Alltag bleibt der Standard `warn` die beste Wahl. Er ist ruhig und meldet nur echte Probleme.
- Nimm `info`, wenn du Anfragen und Meilensteine sehen willst, ohne die Konsole zu fluten.
- Nimm `debug`, wenn du den genauen Prompt an das Modell und die Antwort darauf sehen musst. Rechne mit sehr viel Ausgabe.

Willst du Prompt- und Verbindungsdetails ohne die üblichen Anfrage-Logs sehen, setze statt einer Stufe ein Preset:

```
LOG_PRESET=prompt-connections
```

Dieses Preset zeigt dieselben Prompt- und Modelldetails wie `debug`, blendet aber wiederkehrende Anfragezeilen wie `GET /api/chats` aus. Um nur diese Routinezeilen stillzulegen und die aktuelle Stufe zu behalten, setze Folgendes und starte neu:

```
LOG_DISABLE_REQUEST_LOGGING=true
```

Das Browser-Logging läuft getrennt davon und richtet sich nicht nach `LOG_LEVEL`.

## Zeitlimits

Ein Zeitlimit ist die längste Zeit, die der Server auf einen langsamen Auftrag wartet, bevor er abbricht. Medien-Aufträge wie Bild- und Videogenerierung dauern oft lange, deshalb sind ihre Zeitlimits standardmäßig großzügig. Alle Werte sind in Millisekunden angegeben, sofern der Name nichts anderes sagt.

| Variable                               | Standard                             | Wirkung                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAT_GENERATION_TIMEOUT_MS`           | `300000` (5 Minuten)                 | Zeitlimit für Anbieter-Header, das erste Token und die Pause zwischen zwei Chunks bei gewöhnlichen Generierungen in Conversation, Roleplay und Game. Gültiger Bereich: `10000`-`3600000`. Zeitlimits für Agenten, Medien, Embeddings, Tools und Hintergrundaufträge bleiben unberührt.                                        |
| `AGENT_CALL_TIMEOUT_MS`                | `300000` (5 Minuten)                 | Obergrenze für die Gesamtdauer eines LLM-Aufrufs eines Agenten (Tracker, HTML-Reformatter und andere Agenten), auch während die Antwort noch streamt. Erhöhe den Wert für langsame lokale Modelle, die pro Agent-Durchlauf länger als 5 Minuten brauchen. Gültiger Bereich: `10000`-`3600000`. Der Illustrator behält mindestens sein eingebautes 30-Minuten-Budget. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 Sekunden)                | Obergrenze für die Gesamtdauer des Modellaufrufs, der die aktuelle Game-Szene in einen dynamischen Bild-Prompt übersetzt. Erhöhe den Wert für langsamere lokale Modelle. Gültiger Bereich: `10000`-`3600000`.                                                                                                                 |
| `EMBEDDING_TIMEOUT_MS`                 | `300000` (5 Minuten)                 | Zeit für eine Embedding-Anfrage. Ein höherer Wert hilft langsamen lokalen Embedding-Servern.                                                                                                                                                                                                                                 |
| `IMAGE_GEN_TIMEOUT_MS`                 | `1800000` (30 Minuten)               | Zeit für eine Anfrage zur Bildgenerierung.                                                                                                                                                                                                                                                                                  |
| `VIDEO_GEN_TIMEOUT_MS`                 | `1800000` (30 Minuten)               | Zeit für eine Anfrage zur Szenen-Videogenerierung, inklusive lokaler ComfyUI-Video-Workflows.                                                                                                                                                                                                                                |
| `VIDEO_GEN_MAX_RESPONSE_BYTES`         | `167772160` (160 MiB)                | Größter Szenen-Video-Download, den der Server annimmt.                                                                                                                                                                                                                                                                       |
| `COMFYUI_GEN_TIMEOUT`                  | `2400` (40 Minuten, in Sekunden)     | Zeit für einen ComfyUI-Bild-Workflow, nachdem er in der Warteschlange steht.                                                                                                                                                                                                                                                 |
| `SPRITE_GENERATION_TIMEOUT_MS`         | greift auf `IMAGE_GEN_TIMEOUT_MS` zurück | Zeit für einen KI-Auftrag zur Sprite-Generierung.                                                                                                                                                                                                                                                                       |
| `CUSTOM_TOOL_TIMEOUT_MS`               | `60000` (1 Minute)                   | Zeit für einen Aufruf eines eigenen Tools.                                                                                                                                                                                                                                                                                  |
| `MAX_TOOL_ROUNDS`                      | `100`                                | Höchstzahl der Tool-Aufrufrunden, bevor das Modell eine endgültige Antwort geben muss.                                                                                                                                                                                                                                       |

Die Zeitlimits für Bild, Video, Sprite und ComfyUI werden beim Start festgelegt; eine Änderung braucht daher einen Neustart. Die Zeitlimits für Chat-Generierung, Agenten, dynamische Game-Bild-Prompts, Embeddings und eigene Tools greifen bei der nächsten Anfrage beziehungsweise beim nächsten Agent-Durchlauf, ganz ohne Neustart. Ungültige, null, negative oder außerhalb des Bereichs liegende Werte bei den geprüften Zeitlimits für Chat, Agenten und dynamische Game-Bild-Prompts erzeugen eine Warnung im Log; Marinara nutzt dann sicherheitshalber die dokumentierten Standards. Erhöhe ein Medien-Zeitlimit, wenn große oder besonders hochwertige Aufträge mittendrin scheitern. Mehr zu Video-Aufträgen steht unter [Szenen-Video](media/scene-video.md).

## Privilegierte APIs (ADMIN_SECRET)

Manche Aktionen sind zerstörerisch oder besonders riskant und brauchen deshalb zusätzlich zu den normalen Zugriffsprüfungen ein Geheimnis. Beispiele sind Backups, das Löschen von Daten, das Einspielen von Updates und das Installieren von Themes.

Setze auf dem Server einen langen, zufälligen Wert für `ADMIN_SECRET`:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Auf dem Rechner, der den Server ausführt (Loopback), funktionieren diese Aktionen meist auch ohne das Geheimnis. Von einem anderen Gerät aus muss die App es mitschicken. Füge denselben Wert in der App unter **Settings**, dann **Advanced**, dann **Admin Access** ein. Danach schickt die App ihn automatisch mit.

Verwandte privilegierte Einstellungen:

| Variable                                    | Standard              | Wirkung                                                                                                                                                                              |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_SECRET`                              | leer                  | Gemeinsames Geheimnis, das privilegierte Aktionen von entfernten Geräten verlangen.                                                                                                   |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false`               | Bei `true` ist das Geheimnis auch auf dem lokalen Rechner nötig.                                                                                                                       |
| `UPDATES_APPLY_ENABLED`                     | `false`               | Erlaubt dem Browser, gewöhnliche Updates im selben Kanal einzuspielen. Ein bewusster Wechsel des Release-Kanals aus einem Browser auf dem Server-Rechner klappt auch ohne dieses Flag. Nur bei Git-basierten Installationen. |
| `UPDATES_ALLOW_REMOTE_APPLY`                | `false`               | Erlaubt einem entfernten Gerät mit gültigem Geheimnis, Updates einzuspielen.                                                                                                          |
| `HAPTICS_ALLOW_REMOTE`                      | `false`               | Erlaubt haptische Geräteaktionen von einem entfernten Gerät aus, mit gültigem Geheimnis.                                                                                              |
| `CUSTOM_TOOL_SCRIPT_ENABLED`                | `false`               | Aktiviert eigene Skript-Tools. Bei nicht vertrauenswürdigen oder importierten Tools besser aus lassen.                                                                                 |
| `ENABLE_CUSTOM_AGENT_REPOS`                 | `false`               | Aktiviert die manuelle Vorschau und Synchronisierung von GitHub-Agent-Repositorys im Agents Manager. Agenten von Dritten sind ungeprüft und müssen vor Import oder Update ausdrücklich bestätigt werden. |
| `ENABLE_EXTERNAL_EXTENSIONS`                | `false`               | Erste von zwei Freigaben für den Import von Erweiterungen Dritter. Zusätzlich muss die Nutzerin unter Settings → Advanced → Danger Zone zustimmen.                                     |
| `IMPORT_ALLOWED_ROOTS`                      | leer                  | Ordner im Dateisystem, die ein Massenimport ohne Auswahl-Token lesen darf.                                                                                                            |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES`           | `268435456` (256 MiB) | Größter einzelner JSON-Profil-Export, den der Server erzeugt.                                                                                                                          |

Ist `ADMIN_SECRET` auf dem Server nicht gesetzt, scheitern privilegierte Aktionen von jedem Gerät außer dem lokalen Rechner. Die Fehlermeldung weist darauf hin, das Geheimnis zu setzen und in **Admin Access** einzufügen.

## Freigaben für lokale Adressen

Standardmäßig verweigern ausgehende Anfragen an Anbieter, Bilddienste und Webhooks jeden Kontakt zu privaten oder lokalen Adressen. Das blockiert eine Angriffsklasse namens SSRF (Server-Side Request Forgery), bei der eine Anfrage dazu verleitet wird, eine interne Adresse anzusprechen. Anbieter-Adressen im Loopback bleiben erlaubt, damit lokale Modell-Server weiterlaufen.

Aktiviere nur den Schalter, den du für einen selbst gehosteten Dienst auf einem anderen Rechner im privaten Netzwerk wirklich brauchst.

| Variable                      | Standard | Wirkung                                                                              |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Erlaubt KI-Anbieter-URLs den Zugriff auf private oder LAN-Adressen. Unter Android standardmäßig an. |
| `IMAGE_LOCAL_URLS_ENABLED`    | `false` | Erlaubt Bildanbieter-URLs den Zugriff auf private oder LAN-Adressen. Private Ergebnis-URLs generierter Bilder müssen weiterhin exakt dem Ursprung des eingestellten Anbieters entsprechen. |
| `TTS_LOCAL_URLS_ENABLED`      | `false` | Erlaubt Text-to-Speech-URLs den Zugriff auf private oder LAN-Adressen.                |
| `DEEPLX_LOCAL_URLS_ENABLED`   | `false` | Erlaubt DeepLX-Übersetzungs-URLs den Zugriff auf private oder LAN-Adressen.           |
| `WEBHOOK_LOCAL_URLS_ENABLED`  | `false` | Erlaubt Webhooks eigener Tools den Zugriff auf private oder LAN-Adressen.             |

Wie du ein lokales oder selbst gehostetes Modell anbindest, steht unter [Ein lokales oder selbst gehostetes Modell verbinden](connections/local-self-hosted.md).

## Vollständige Referenz der Umgebungsvariablen

Dieser Abschnitt listet die übrigen Einstellungen, nach Zweck gruppiert. Zugriffskontrolle, Speicherung, Logging, Zeitlimits, privilegierte Aktionen und Freigaben für lokale Adressen decken die Tabellen weiter oben bereits ab.

### Server und Start

| Variable                         | Standard                                       | Wirkung                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                           | `7860`                                         | Der Port, auf dem der Server lauscht. Android, Docker und Termux sollten denselben Wert nutzen.                                                                                                                                                                                                                                                                                                                                                                                   |
| `HOST`                           | `127.0.0.1` (`0.0.0.0` in den Shell-Launchern) | Die Netzwerkschnittstelle, an die gebunden wird. Für LAN-Zugriff `0.0.0.0` nehmen.                                                                                                                                                                                                                                                                                                                                                                                                |
| `MARINARA_ANDROID_SECRET`        | leer                                           | Interner Geheimwert für die lokale Authentifizierung bei von der APK verwalteten Termux-Installationen. Dies ist keine Eingabe für den Installer: Der Android-Wrapper erzeugt und überträgt ihn, der Termux-Launcher exportiert ihn automatisch. Fordere APK-Nutzer nicht zur Eingabe auf und setze ihn nicht bei gewöhnlichen Desktop- oder manuellen Termux-Installationen. Ist er gesetzt, muss er aus genau 64 Hexadezimalzeichen bestehen. Ein ungültiger, nicht leerer Wert lässt lokale Anfragen des Geräts mit HTTP 503 fehlschlagen, statt die Authentifizierung abzuschwächen. |
| `MARINARA_ANDROID_SECRET_FILE`   | `~/.marinara-engine/android-secret`            | Pfad zur privaten Geheimwertdatei, die der Termux-Launcher und die lokale `mari`-CLI nutzen. APK und Launcher verwalten diese Datei automatisch; normale APK-Nutzer müssen sie nie lesen oder kopieren. |
| `AUTO_OPEN_BROWSER`              | `true`                                         | Ob die Shell-Launcher die App-URL für dich öffnen. `false` schaltet das ab. Die APK-verwaltete Einrichtung deaktiviert das automatische Öffnen des Browsers für ihren Start, damit sich stattdessen die bereits authentifizierte Android-App verbindet. |
| `AUTO_UPDATE_ENABLED`            | `true`                                         | Ob die Git-basierten Launcher für Windows, macOS/Linux und Termux vor dem Start Engine-Updates holen und einspielen. `false` deaktiviert das dauerhaft und wirkt ab dem nächsten Start. Der Launcher prüft weiterhin nur lesend auf neuere veröffentlichte Releases und erinnert bei Bedarf an den Download; manuelle Prüfungen, das Einspielen in der App, Paket-Updates und Modell-Updates bleiben verfügbar. Mit `--skip-update` überspringst du beide Launcher-Prüfungen für einen Start. |
| `MARINARA_ENV_FILE`              | `.env` im Projekt-Wurzelordner                 | Optionaler abweichender Pfad zur Datei `.env`. Vor dem Start setzen.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `TZ`                             | Systemstandard                                 | Ersatz-Zeitzone des Hosts für serverseitige Aufträge. Zeitpläne in Conversation nutzen die global gewählte Zeitzone aus ihren Zeitplan-Bedienelementen, sobald eine gespeichert ist. Lässt du `TZ` ungesetzt, gilt die Zeitzone des Hosts; ein leeres `TZ=` zählt ebenfalls als ungesetzt.                                                                                                                                                                                          |
| `CORS_ORIGINS`                   | `http://localhost:5173,http://127.0.0.1:5173`  | Browser-Ursprünge, die Cross-Origin-Anfragen stellen dürfen.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true`                                         | Altes Flag. Aktuelle Builds enthalten keinen Starter-Key, es entsteht also nichts. Leg deine eigene Verbindung in der App an.                                                                                                                                                                                                                                                                                                                                                     |

`AUTO_CREATE_DEFAULT_CONNECTION` existiert nur noch für ältere Installationen. Neue Builds bringen keine mitgelieferte Starter-Verbindung mehr mit, eingeschaltet passiert also nichts. Zum Loslegen legst du eine Verbindung an, siehe [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md).

Die Zeitplan-Bedienelemente in Conversation nutzen standardmäßig die Zeitzone, die Browser oder App-Gerät melden. **Schedule timezone** (Zeitzone des Zeitplans) lässt sich beim Einrichten von Conversation, in den Conversation Chat Settings oder im Zeitplan-Editor des Charakters ändern. Die gewählte IANA-Zeitzone ist eine einzige globale Einstellung für alle Conversation-Chats und wird mit anderen Marinara-Clients am selben Server abgeglichen.

### Medien- und Sprite-Werkzeuge

| Variable                            | Standard              | Wirkung                                                                                                                                                                  |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FFMPEG_PATH`                       | leer                  | Pfad zu einem `ffmpeg`-Programm. Wird für animierte GIFs von Gesichtsausdrücken genutzt. Ohne Angabe greift `ffmpeg` aus dem PATH.                                        |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 Minuten)  | Zeit für die Umwandlung eines animierten Gesichtsausdruck-Clips.                                                                                                          |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE`  | `auto`                | Engine für die Sprite-Bereinigung. `auto` versucht zuerst die adaptive Matte-Bereinigung und dann die optionale KI-Variante; `builtin` nutzt nur den Matte-Weg; `backgroundremover` erzwingt das KI-Werkzeug. |
| `BACKGROUNDREMOVER_AUTO_INSTALL`    | `false`               | Bei `true` installiert Marinara den optionalen KI-Hintergrundentferner beim Start.                                                                                        |
| `BACKGROUNDREMOVER_COMMAND`         | leer                  | Pfad zu einem System-Programm `backgroundremover`.                                                                                                                        |
| `BACKGROUNDREMOVER_PYTHON`          | leer                  | Pfad zu einem Python-Programm, in dem `backgroundremover` installiert ist.                                                                                                |
| `BACKGROUNDREMOVER_TIMEOUT_MS`      | `600000` (10 Minuten) | Zeit für einen KI-Aufruf zum Entfernen des Hintergrunds.                                                                                                                  |

### Anbieter für Szenen-Videos

Anbieter für Szenen-Videos richtest du als Verbindungen in der App ein, nicht über Umgebungsvariablen. Die folgenden Einstellungen justieren lediglich die zugrunde liegenden Aufträge. Alle Werte sind in Millisekunden.

| Variable                            | Standard | Wirkung                                                                                        |
| ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Wie oft der Server einen Google-Veo-Auftrag abfragt.                                            |
| `XAI_VIDEO_POLL_INTERVAL_MS`        | `5000`  | Wie oft der Server einen xAI-Imagine-Auftrag abfragt.                                           |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Wie oft der Server einen OpenRouter-Video-Auftrag abfragt.                                      |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS`   | `10000` | Wie oft der Server einen Seedance-Auftrag abfragt.                                              |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL`   | leer    | Öffentliche HTTPS-Adresse dieses Servers, nötig, wenn ein Anbieter ein Referenzbild per URL holen muss. |

### Integrationen und Extras

| Variable                          | Standard                                   | Wirkung                                                                           |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `DOCS_I18N_BASE_URL`              | offizieller `docs-i18n`-Branch             | Woher übersetzte Dokumentations-Pakete geladen werden (Settings → General → Documentation Language). Muss ein öffentlicher `https://`-Host sein; Forks und Spiegel können auf ihre eigene Kopie des `docs-i18n`-Branch zeigen. |
| `GIPHY_API_KEY`                   | leer                                       | Giphy-Key für die GIF-Suche im Conversation Mode. Ohne Wert bleibt die Suche aus. |
| `INTIFACE_URL`                    | `ws://127.0.0.1:12345`                     | Standardadresse der Intiface-Haptik-App.                                           |
| `SPOTIFY_REDIRECT_URI`            | aus der Anfrage abgeleitet                 | Abweichende Callback-URL für die Spotify-Anmeldung. Nötig, wenn TLS vorgelagert endet. |
| `MARI_WIKI_CONTENT_MAX_BYTES`     | `50000`                                    | Größter Wiki-Seiteninhalt, den Professor Mari ungekürzt liest.                     |
| `MARI_WIKI_REQUEST_TIMEOUT_MS`    | `30000`                                    | Zeit für eine Wiki-Anfrage von Professor Mari.                                     |
| `MARI_WIKI_CACHE_TTL_MS`          | `300000`                                   | Wie lange Professor Mari einen Wiki-Abruf zwischenspeichert.                       |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (der Windows-Launcher setzt `true`) | Erlaubt die Installation der lokalen Modell-Laufzeit über Loopback ohne Admin-Header. |
| `SSL_CERT`                        | leer                                       | Pfad zu einem TLS-Zertifikat. Siehe Zugriffskontrolle weiter oben.                 |
| `SSL_KEY`                         | leer                                       | Pfad zu einem privaten TLS-Schlüssel. Siehe Zugriffskontrolle weiter oben.         |

Zum Giphy-Key: Die GIF-Suche bleibt so lange nicht verfügbar, bis du `GIPHY_API_KEY` gesetzt und neu gestartet hast. Zum eingebauten lokalen Modell siehe [Lokales Modell einrichten](connections/local-model.md).

## Verwandte Anleitungen

- [Fernzugriff: Basic Auth und IP-Allowlist](REMOTE_ACCESS.md)
- [Wo deine Daten gespeichert werden](data/where-data-is-stored.md)
- [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md)
- [Szenen-Video](media/scene-video.md)
- [Marinara Engine – Fehlerbehebung](TROUBLESHOOTING.md)
