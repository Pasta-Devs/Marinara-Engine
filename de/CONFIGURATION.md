# Server-Konfiguration – Referenz

In dieser Anleitung erfährst du, welche Server-Einstellungen du über Umgebungsvariablen ändern kannst. Umgebungsvariablen sind Einstellungen, die der Server aus einer einfachen Textdatei namens `.env` liest. Marinara funktioniert ganz ohne Konfiguration. Die meisten brauchen sie nur, um andere Geräte zuzulassen, einen gemeinsam genutzten Server zu schützen, den Datenordner zu verschieben, ausführlicheres Logging einzuschalten oder langsamen Aufträgen mehr Zeit zu geben.

Deine KI-Konten, Charaktere und Chat-Optionen stellst du in der App ein. Wie du ein KI-Konto hinzufügst, steht unter [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md).

<a id="edit-the-env-file"></a>

## Die .env-Datei bearbeiten

Marinara legt beim ersten Start eine leere `.env` an. Jede Zeile hat die Form `KEY=value`. Zeilen, die mit `#` beginnen, sind Kommentare.

| Installation | Wo die `.env` liegt |
| --- | --- |
| Normale Installation | Im Wurzelordner des Projekts |
| Offizielles Docker- oder Podman-Image | `/app/data/.env`, im selben Volume wie deine Daten |

1. Öffne `.env.example` im selben Ordner. Dort steht jede Einstellung mit ihrem Standardwert.
2. Kopiere die gewünschte Zeile nach `.env`.
3. Ändere den Wert hinter dem `=` und speichere die Datei.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` enthält Daten, kein Shell-Skript. Marinara führt `$`, `$(...)` und sonstige Shell-Syntax in einem Wert nicht aus. Ein Wert, der bereits in der Umgebung des Launchers gesetzt ist, hat Vorrang vor dem gleichen Eintrag in `.env`.

Der Server liest `.env`, ganz gleich, wie du ihn startest. Die Launcher (`start.bat`, `start.sh`, `start-termux.sh`) setzen außerdem `HOST=0.0.0.0`, damit andere Geräte sich verbinden können, und öffnen deinen Browser, sobald der Server bereit ist. `AUTO_OPEN_BROWSER=false` schaltet das ab. Bei einem nackten `pnpm start` lauscht der Server nur auf diesem Rechner, solange du `HOST` nicht setzt.

<a id="restart-or-hot-reload"></a>

## Neustart oder Hot Reload

Marinara überwacht `.env` im laufenden Betrieb. Die meisten Einstellungen greifen fast sofort, ohne Neustart. Für jede Änderung zeigt das Log eine Zeile `[env-watcher]`. Lässt sich die Überwachung nicht starten, prüft der Server die Datei alle 30 Sekunden und vermerkt das im Log.

Werden deine Änderungen nicht übernommen, etwa weil du von einem anderen Rechner aus oder in einem Bind-Mount eines Containers bearbeitest, setze `MARINARA_ENV_WATCH=poll`. Um die Überwachung abzuschalten, setze `MARINARA_ENV_WATCH=0`. Beides sind Optionen für Fortgeschrittene.

Die folgenden Einstellungen liest der Server nur beim Start. Eine Änderung braucht einen Neustart, und das Log weist dich darauf hin:

- `PORT`, `HOST`, `SSL_CERT` und `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY` und `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH` und `TZ`
- `AUTO_OPEN_BROWSER` und `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING` und `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` und `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- Zeitlimits und Abfrage-Einstellungen für Bild, Video, Sprite und ComfyUI: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` und die vier `*_VIDEO_POLL_INTERVAL_MS`-Einstellungen

Die Launcher lesen `AUTO_UPDATE_ENABLED`, bevor der Server startet. Eine Änderung gilt daher ab dem nächsten Start, und das Log weist nicht darauf hin.

Einstellungen zur Zugriffskontrolle und Geheimnisse (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) kommen ohne Neustart aus.

<a id="access-control"></a>

## Zugriffskontrolle

Die Zugriffskontrolle entscheidet, wer einen laufenden Server erreichen darf. Schritte und Beispiele findest du unter [Fernzugriff: Anmeldung und IP-Allowlist](REMOTE_ACCESS.md).

Die Anmeldung lässt sich auch ohne `.env` einrichten: über **Settings → Advanced → Access** (Einstellungen → Erweitert → Zugriff) in einem Browser, der schon angemeldet ist, oder mit dem einmaligen Einrichtungscode aus dem Server-Log. Der Server gibt diesen Code nur aus, solange keine Anmeldung gesetzt ist und er über Loopback hinaus lauscht. Die Anmeldung wird in `DATA_DIR/.remote-login.json` gespeichert. `node scripts/reset-login.mjs` (im Marinara-Ordner ausgeführt) entfernt sie und meldet jeden Browser ab. Eine Anmeldung in `.env` hat Vorrang. Um die Anmeldung zu ändern oder zu entfernen, brauchst du das aktuelle Passwort. Zu Login-Proxys siehe [Login-Proxys (Forward-Auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Begriffe, die unten vorkommen:

- **Loopback**: der Rechner, auf dem der Server läuft, erreichbar unter `127.0.0.1` oder `localhost`.
- **CIDR-Bereich**: eine Kurzschreibweise für einen Block von IP-Adressen, etwa `192.168.1.0/24`.
- **Basic Auth**: Benutzername und Passwort, die mit jeder Anfrage mitgeschickt werden. Skripte und API-Clients nutzen das, Browser nutzen die Seite `/login`. Die Zugangsdaten sind nur kodiert, nicht verschlüsselt; nutze deshalb auf einem öffentlichen Server HTTPS.

Ohne gesetzte Anmeldung nimmt der Server nur Verbindungen aus vertrauenswürdigen Quellen an: Loopback, Adressen in `IP_ALLOWLIST`, Tailscale und Docker-Bridge-Verkehr vom selben Host. Alle anderen, auch dein Heimnetzwerk, bekommen `403 Forbidden`. Damit andere Geräte sich überhaupt verbinden können, muss der Server an eine erreichbare Adresse gebunden sein: Setze `HOST=0.0.0.0`.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `BASIC_AUTH_USER` | leer | Benutzername für die Anmeldung. Zusammen mit `BASIC_AUTH_PASS` setzen. |
| `BASIC_AUTH_PASS` | leer | Passwort für die Anmeldung. Bleibt eines der beiden Felder leer, ist die Anmeldung aus. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Realm-Name in der Basic-Auth-Abfrage. |
| `IP_ALLOWLIST` | leer | Kommagetrennte IPs oder CIDR-Bereiche, die immer erlaubt sind. Direktes Loopback ist immer erlaubt. Ein Reverse-Proxy auf demselben Rechner ist es nicht. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` behält die Liste, wendet sie aber nicht mehr an. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Erlaubt passwortlosen Zugriff aus privaten Netzwerken, wenn keine Anmeldung gesetzt ist. Ausgenommen ist `100.64.0.0/10`, das Internetanbieter unter ihren Kunden aufteilen. Trag diesen Bereich nur dann in `TRUSTED_PRIVATE_NETWORKS` ein, wenn du ihm vertraust. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Erlaubt passwortlosen Zugriff von jeder Adresse, auch aus dem Internet. Nicht empfohlen. |
| `TRUSTED_PRIVATE_NETWORKS` | eingebaute Bereiche | Ersetzt die standardmäßigen privaten Bereiche. Nimm alle Standardbereiche mit auf, die du behalten willst. |
| `BYPASS_AUTH_TAILSCALE` | automatisch | Leer: Ein Gerät überspringt die Anmeldung nur, wenn es sich direkt mit der Tailscale-Adresse dieses Rechners verbindet. Tailscale Serve, Funnel oder ein anderer Proxy brauchen weiterhin eine Anmeldung. `true`: die alte Ausnahme für den gesamten Bereich `100.64.0.0/10`. `false`: normale Zugriffskontrolle. |
| `BYPASS_AUTH_DOCKER` | automatisch | Leer: vertraut nur einer erkannten Container-Schnittstelle und ihrem Gateway, und das nur, solange weder eine Anmeldung noch `IP_ALLOWLIST` noch `TRUSTED_AUTH_PROXY` gesetzt ist. `true`: ältere oder eigene Netzwerke. `false`: normale Zugriffskontrolle. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Verlangt die Anmeldung oder die Allowlist für Docker-Verkehr, den ein Proxy weiterleitet. Setz `false` nur, wenn der Proxy selbst jeden Besucher anmeldet. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Behandelt Anfragen, die ein Proxy oder Tunnel auf demselben Rechner weiterleitet, als entfernt, auch HTTP/1.0 wie das Standard-`proxy_pass` von nginx. Setz `false` nur, wenn der Proxy selbst jeden Besucher anmeldet. |
| `TRUSTED_AUTH_PROXY` | leer | IPs oder CIDRs eines Forward-Auth-Proxys (tinyauth, Authelia, Authentik, oauth2-proxy), der jeden Besucher anmeldet. Seine Anfragen überspringen die Anmeldung und `IP_ALLOWLIST`. Er muss jeden Pfad schützen, und Marinara darf nicht an ihm vorbei erreichbar sein. |
| `TRUSTED_HOSTS` | leer | Zusätzliche öffentliche oder Proxy-Hostnamen, auf die Marinara antwortet, etwa `chat.example.com`. Direkte IPs, `localhost`, `.local`, `.home.arpa` und einteilige LAN-Namen funktionieren auch ohne diese Einstellung. Namen in `CSRF_TRUSTED_ORIGINS` oder `CORS_ORIGINS` werden ebenfalls akzeptiert. |
| `SSL_CERT` | leer | Pfad zu einem TLS-Zertifikat. Zusammen mit `SSL_KEY` liefert der Server HTTPS direkt aus. |
| `SSL_KEY` | leer | Pfad zum privaten TLS-Schlüssel. |
| `CSRF_TRUSTED_ORIGINS` | leer | Zusätzliche Browser-Ursprünge, die Änderungen speichern dürfen, für eine öffentliche Domain oder einen ungewöhnlichen Port. Der Literalwert `null` wird ignoriert, auch für die Android-APK. |

> **Warnung:** Ein breiter öffentlicher `IP_ALLOWLIST`-Bereich wie `0.0.0.0/0` kann Internet-Clients ohne Anmeldung hereinlassen. Trag nur Adressen ein, denen du vertraust.

## Speicherung

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Wurzelordner für alle Nutzerdaten. Docker-Images setzen `/app/data`. |
| `FILE_STORAGE_DIR` | `storage` innerhalb von `DATA_DIR` | Überschreibt den Ordner für die Dateispeicherung. |
| `ENCRYPTION_KEY` | leer | Schlüssel, der gespeicherte API-Keys verschlüsselt. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (unbegrenzt); `8` unter SteamOS und Termux | Höchstzahl der Chats, die gleichzeitig im Arbeitsspeicher bleiben. Ist die Grenze überschritten, entfernt der Server nach jedem Speichern den am längsten nicht genutzten Chat ohne ungespeicherte Änderungen aus dem Arbeitsspeicher (nie von der Festplatte). Ungültiger Text fällt auf den Plattform-Standard zurück. Positive Werte unter `2` werden zu `2`. `0` schaltet das Entfernen ab. |
| `MARINARA_EAGER_STORAGE` | aus | `1` lädt beim Start jeden Chat, wie vor 2.4.5. Braucht bei großen Profilen deutlich mehr Arbeitsspeicher. Erfordert einen Neustart. |

Erzeuge einen Verschlüsselungsschlüssel und füge ihn bei `ENCRYPTION_KEY` ein:

```bash
openssl rand -hex 32
```

Marinara legt deine Daten als einfache JSON-Dateien ab, sodass du Backups kopieren und lesen kannst. Was in welchem Ordner steckt, erklärt [Wo Marinara deine Daten speichert](data/where-data-is-stored.md).

<a id="logging-levels"></a>

## Log-Stufen

`LOG_LEVEL` legt fest, wie viel der Server ausgibt. Alles unterhalb der gewählten Stufe blendet er aus.

| Stufe | Was sie zeigt |
| --- | --- |
| `error` | Nur schwere Fehler. |
| `warn` | Fehler und Warnungen. Der Standard. |
| `info` | Zusätzlich Start- und Anfrage-Logs. |
| `debug` | Alles, inklusive vollständiger Prompts und Modellantworten. Erzeugt sehr viel Ausgabe. |

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | Die Stufe aus der Tabelle oben. |
| `LOG_PRESET` | `default` | `prompt-connections` zeigt dieselben Prompt- und Modelldetails wie `debug`, blendet aber routinemäßige Anfragezeilen wie `GET /api/chats` aus. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` blendet routinemäßige Anfragezeilen aus und behält deine Stufe. Erfordert einen Neustart. |
| `LOG_FORMAT` | automatisch | `pretty` gibt überall lesbare Zeilen aus, etwa um Prompts aus dem **Debug mode** (Debug-Modus) in `docker logs` zu lesen. `json` gibt ein JSON-Objekt pro Zeile aus. Erfordert einen Neustart. |

In einem Terminal gibt der Server lesbare Zeilen aus. Anderswo, etwa in Docker-Logs, gibt ein Produktionsserver JSON-Zeilen aus. Der Termux-Launcher fordert lesbare Zeilen an. Das Browser-Logging läuft getrennt davon und richtet sich nicht nach `LOG_LEVEL`.

## Zeitlimits

Ein Zeitlimit ist die längste Zeit, die der Server auf einen langsamen Auftrag wartet. Unter **Settings → Advanced → Request timeouts** stellst du die Limits für Text, Agenten, Game-Bildprompts, Bilder, Videos, ComfyUI und Embeddings in Sekunden ein. Höhere Limits helfen langsamen lokalen Backends. Ein Limit, das der Dienst selbst setzt, können sie nicht aufheben. Zum Speichern brauchst du Administrationszugriff auf den Server.

Diese Einstellungen gelten für alle Profile und werden neben der aktiven `.env` als `.env.timeouts.json` gespeichert (oder als `<custom-env-path>.timeouts.json`). Sie überschreiben die passenden Variablen, ohne `.env` zu ändern. Änderungen für Text, Agenten, Game-Bildprompts und Embeddings gelten für neue Anfragen. Medienänderungen und installierte Agentenpakete brauchen einen Neustart. Um wieder die Variablen zu nutzen, lösch diese Datei und starte neu.

Die Werte sind in Millisekunden angegeben, sofern der Name nichts anderes sagt. Ungültige Werte, null, negative Werte oder Werte außerhalb des Bereichs erzeugen bei den geprüften Zeitlimits für Chat, Agenten und Game-Bildprompts eine Warnung im Log, und der Standard gilt. Mehr zu Video-Aufträgen steht unter [Szenenvideos generieren](media/scene-video.md).

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 Minuten) | Zeit bis zum ersten Token und Pause zwischen zwei Chunks bei Antworten in Conversation, Roleplay und Game. Auch das Zeitbudget für Hintergrundaufträge ohne eigenes Zeitlimit (Professor Mari, Noodle-Aktualisierung, Slurp-Antworten). Bereich `10000`–`3600000`. Ändert keine Zeitlimits für Agenten, Medien, Embeddings oder Tools. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 Minuten) | Längste Stille vor oder während eines einzelnen Modellaufrufs eines Agenten, auch bei herunterladbaren Agenten. Eingehende Daten setzen das Limit zurück. Bereich `10000`–`3600000`. Der Illustrator behält mindestens sein eingebautes Zeitbudget von 30 Minuten ohne Aktivität. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 Sekunden) | Obergrenze für die Gesamtdauer des Modellaufrufs, der eine Game-Szene in einen Bild-Prompt übersetzt. Bereich `10000`–`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 Minuten) | Zeit für eine Embedding-Anfrage. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 Minuten) | Zeit für eine Anfrage zur Bildgenerierung. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 MiB) | Größte Bildantwort, die angenommen wird. Erhöhe den Wert, wenn ein lokales ComfyUI große Metadaten einbettet. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 Minuten) | Zeit für eine Anfrage zur Szenen-Videogenerierung, inklusive ComfyUI-Video-Workflows. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Größter Szenen-Video-Download, der angenommen wird. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 Minuten, in Sekunden) | Zeit für einen ComfyUI-Bild-Workflow, nachdem er in der Warteschlange steht. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Zeit für einen KI-Auftrag zur Sprite-Generierung. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 Minute) | Zeit für einen Aufruf eines eigenen Tools. |
| `MAX_TOOL_ROUNDS` | `100` | Höchstzahl der Tool-Aufrufrunden, bevor das Modell antworten muss. Ein Game-Zug bekommt höchstens 4, ein Agent 16 und ein Lorebook-Backfill 64, oder diesen Wert, wenn er niedriger ist. |

## Privilegierte APIs (ADMIN_SECRET)

Zerstörerische oder riskante Aktionen wie Backups, das Löschen von Daten, das Einspielen von Updates und das Installieren von Themes brauchen zusätzlich zu den normalen Zugriffsprüfungen ein Geheimnis. Du kannst eines auf dem Server-Rechner selbst unter **Settings → Advanced → Admin Access** erstellen (siehe [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)) oder auf dem Server einen langen, zufälligen Wert setzen:

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Auf dem Rechner, auf dem der Server läuft, funktionieren diese Aktionen meist auch ohne das Geheimnis. Eine Anfrage, die ein Proxy oder Tunnel auf diesem Rechner weiterleitet, zählt als entfernt, außer bei `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Direkte Anfragen von einem anderen Gerät brauchen das Geheimnis. Füge denselben Wert unter **Settings → Advanced → Admin Access** ein, dann schickt die App ihn für dich mit. `ADMIN_SECRET` in der `.env` hat Vorrang vor einem in der App erstellten Geheimnis. Ohne Admin-Secret scheitern privilegierte Aktionen von jedem Gerät außer dem Server-Rechner selbst, und die Fehlermeldung fordert dich auf, eines einzurichten. Installierte Agenten funktionieren auf jedem Gerät, das mit der Anmeldung angemeldet ist; zum Installieren, Aktualisieren und Entfernen brauchst du das Geheimnis.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `ADMIN_SECRET` | leer | Geheimnis für privilegierte Aktionen von entfernten Geräten. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` verlangt das Geheimnis auch auf dem Server-Rechner selbst. |
| `UPDATES_APPLY_ENABLED` | `false` | Erlaubt dem Browser, Updates im selben Kanal mit **Apply Update** (Update einspielen) einzuspielen. Ein Wechsel des Release-Kanals aus einem Browser auf dem Server-Rechner klappt auch ohne diese Einstellung. Nur bei Git-Installationen. |
| `UPDATES_APPLY_DISABLED` | nicht gesetzt | Verweigert jedes serverseitige Einspielen von Updates, auch den Kanalwechsel. Setzt sich gegen `UPDATES_APPLY_ENABLED` durch. Die Launcher für Entwicklung und e2e-Tests setzen es. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Erlaubt einem entfernten Gerät mit gültigem Geheimnis, Updates einzuspielen. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Erlaubt einem entfernten Gerät mit gültigem Geheimnis haptische Aktionen. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Aktiviert eigene Skript-Tools. Bei nicht vertrauenswürdigen oder importierten Tools aus lassen. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Lässt die Datenbank-Transformationsskripte von Professor Mari auch auf Hosts ohne Sandbox des Betriebssystems laufen (macOS Seatbelt oder Linux Bubblewrap, die genutzt werden, wo vorhanden). Lass das aus, solange du das Skript nicht geprüft hast. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Aktiviert die manuelle Vorschau und Synchronisierung von GitHub-Agent-Repositorys in Agent Organizer. Siehe [Eigene Agent-Repositorys](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Erlaubt Spielern, Overworld-Spiele (ein Setting-Kit und eine generierte Welt) anzulegen und ein älteres Spiel in eines umzuwandeln. Ist die Variable aus, bietet der Assistent nur Classic-Spiele an. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Erste von zwei Sicherheitssperren für den Import von Erweiterungen Dritter. Siehe [External Extensions](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | leer | Ordner, die ein Massenimport ohne Auswahl-Token lesen darf. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Größter einzelner JSON-Profil-Export, den der Server erzeugt. |

## Freigaben für lokale Adressen

Standardmäßig verweigern ausgehende Anfragen an KI-Dienste, Bilddienste und Webhooks private oder lokale Adressen. Das blockiert SSRF (Server-Side Request Forgery), bei der eine Anfrage dazu verleitet wird, eine interne Adresse anzusprechen. Modell-Server im Loopback funktionieren weiterhin. Aktiviere nur den Schalter, den du für einen selbst gehosteten Dienst auf einem anderen Rechner im privaten Netzwerk brauchst.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | URLs von KI-Diensten dürfen private oder LAN-Adressen erreichen. Unter Android standardmäßig an. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | URLs von Bilddiensten dürfen private oder LAN-Adressen erreichen. Private Ergebnis-URLs müssen weiterhin exakt dem Ursprung des Dienstes entsprechen. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Text-to-Speech-URLs dürfen private oder LAN-Adressen erreichen. |
| `STT_LOCAL_URLS_ENABLED` | `false` | Die Server-URL für Speech to Text darf private oder LAN-Adressen erreichen. Ein Server auf demselben Rechner funktioniert auch ohne diese Einstellung. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | DeepLX-Übersetzungs-URLs dürfen private oder LAN-Adressen erreichen. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Webhooks eigener Tools dürfen private oder LAN-Adressen erreichen. |

Wie du ein lokales oder selbst gehostetes Modell anbindest, steht unter [Ein lokales oder selbst gehostetes Modell verbinden](connections/local-self-hosted.md).

<a id="feature-switches"></a>

## Funktionsschalter

Optionale Serverfunktionen, etwa das Wiederholen fehlgeschlagener Anbieteraufrufe oder stabile Lorebook-Gruppenauswahlen, findest du unter **Settings → Advanced → Features** (Einstellungen → Erweitert → Funktionen). Alle sind standardmäßig aus. Einige haben eine Variable, die Vorrang vor dem Schalter hat, wenn sie gesetzt ist. Siehe [Funktionsschalter](configuration/features.md).

<a id="marinara-notices"></a>

## Marinara-Hinweise

Hinweise sind kurze Warnungen der Maintainer, etwa zu einem Sicherheitsproblem oder zu einem manuellen Schritt, den deine Version braucht. Sie erscheinen als Banner.

- Beim Start und danach jede Stunde lädt der Server eine kleine Datei, `notices.json`, aus dem Branch `notices` des Marinara-Engine-Repositorys herunter. Er behält nur die Hinweise, die deine Version nennen. Dein Browser fragt sie einmal beim Laden der Seite und danach stündlich bei deinem eigenen Server ab.
- Schlägt ein Download fehl, behält der Server die Hinweise, die er schon hat, und der Start verzögert sich nicht.
- Die Anfrage sendet keine Daten über dich, deine Chats oder deine Einstellungen. Nur Maintainer können den Branch `notices` ändern, und jede Änderung wird geprüft.
- Ein Hinweis ist reiner Text mit Größenbegrenzung. Links bleiben nur erhalten, wenn sie auf `https://github.com/Pasta-Devs/` zeigen. Ein Hinweis kann nichts installieren, ausführen oder ändern.
- Nur du siehst Hinweise: auf dem Server-Rechner selbst, von einer Adresse in `IP_ALLOWLIST` aus oder nachdem du dich angemeldet hast. Andere Besucher bekommen eine leere Liste.

Zum Abschalten der Hinweise setze `MARINARA_NOTICES_ENABLED=false`.

> **Warnung:** Sind die Hinweise aus, kann Marinara dir keine Sicherheitskorrekturen oder erforderlichen Schritte mitteilen. Behalte die [GitHub-Releases](https://github.com/Pasta-Devs/Marinara-Engine/releases) dann selbst im Blick.

Forks können `MARINARA_NOTICES_URL` auf ihre eigene Datei zeigen lassen.

Um den Server der Hinweise zu finden, und ebenso den Proxy, wenn ein [ausgehender Proxy](#outbound-http-proxy) eingeschaltet ist, liest Marinara die Hosts-Datei und fragt die DNS-Server direkt ab. Namen, die nur dein lokales Netzwerk kennt, etwa `.local`-Namen oder kurze Namen ohne Domain außer `localhost`, funktionieren nicht. In Termux stehen die DNS-Server in `$PREFIX/etc/resolv.conf`: `8.8.8.8` und `8.8.4.4` von Google, sofern du diese Datei nicht änderst.

<a id="optional-multiplayer"></a>

## Optionaler Mehrspielermodus

Der Mehrspielermodus ist standardmäßig aus. Mit ihm teilen sich mehrere Personen einen privaten Conversation-, Roleplay- oder Game-Raum, ohne feste Obergrenze für die Teilnehmerzahl. Jeder Gast nutzt sein eigenes vertrauenswürdiges Marinara. Gäste brauchen kein KI-Konto. Der Host stellt die KI-Konten bereit und kann geteilte Inhalte lesen und aufbewahren. Solange eine der beiden Sicherheitssperren geschlossen ist, führt Marinara keine Sitzungs-, Zertifikats- oder Gegenstellenprüfungen im Hintergrund durch.

1. Setze `MULTIPLAYER_ENABLED=true` in der `.env` jedes teilnehmenden Marinara und starte es neu. Nur der exakte Wert `true` wirkt, und Hot Reload übernimmt ihn nicht.
2. Öffne **Settings → Advanced → Multiplayer** (Einstellungen → Erweitert → Mehrspieler), lies die Warnung und schalte die Einstellung ein. Das startet weder einen Listener noch einen Raumbeitritt.
3. Zum Hosten nutzt du **Create shared session** (geteilte Sitzung erstellen) oder **Play together** (zusammen spielen) im Modus- oder Einrichtungsablauf. Prüfe die Einrichtung, deinen Anzeigenamen und den Persona-Text, den du teilst. Ein bestehender Chat teilt nur seine Einrichtungsauswahlen, nie seinen Verlauf, seine Notizen oder Erinnerungen.
4. Setze auf dem Host `SSL_CERT` und `SSL_KEY` für ein Zertifikat, das für den Raum-Hostnamen gültig ist und dem die Gäste vertrauen. Wähle eine eigene HTTPS-Raumadresse mit eigenem Port, etwa `https://room.example.org:7861`. Die Host-Aktion öffnet diesen Port. Leite nur den Raum-Port durch Firewall oder Router. Veröffentliche nicht die normale Marinara-API. Portweiterleitung, Relay oder eine Umgehung der Zertifikatsprüfung werden nicht für dich eingerichtet.
5. Lege ein Raumpasswort mit mindestens 12 Zeichen fest, das sich von deinen Admin-Zugangsdaten unterscheidet. Schick die ablaufende Einladung und das Passwort getrennt an Personen, denen du vertraust. Der Gast prüft Hostnamen-Fingerabdruck, Raumnamen und Persona-Text und bittet dann um Aufnahme. Der Host bestätigt jede Anfrage unter **Players** (Spieler), bevor Verlauf gesendet wird.

Grenzen und Verhalten:

- TLS prüft Zertifikatskette und Hostnamen sowie den Zertifikatsfingerabdruck der Einladung, bevor ein Passwort gesendet wird. Selbst signierte Zertifikate werden nicht stillschweigend akzeptiert. Ein erneuertes Zertifikat braucht eine neue Einladung.
- Einladungen verfallen nach 30 Minuten. Zugelassene Sitzungen dauern höchstens 12 Stunden. Ersetzen oder Widerrufen stoppt unbenutzte Einladungen. **Kick** (hinauswerfen) entfernt einen aufgenommenen Gast.
- Der Host steuert automatische oder manuelle Antworten, **Pause**/**Resume** (pausieren/fortsetzen) und **Stop** (stoppen). Standardmäßig gibt es 100 koordinierte Generierungszüge pro Host-Sitzung. Ein Gruppenzug oder eine Game-Einrichtung kann mehr als einen Modellaufruf auslösen. Das ist ein Zuglimit, keine Preisschätzung.
- Prüfe in Game vor **Start Game** (Spiel starten) die Gruppe. Jeder erforderliche Spieler reicht eine Aktion ein oder passt, und der GM wertet aus, wenn alle bereit sind. Ein getrennter Spieler bleibt erforderlich, bis er zurückkehrt oder der Host für ihn passt oder ihn entfernt. Pausierte oder unterbrochene Runden wiederholen nie von selbst eine kostenpflichtige Anfrage oder bereits gespeicherte Welteffekte.
- **Stop**, **Leave** (verlassen), das Ausschalten der Einstellung und ein Serverneustart beenden die laufende Sitzung. Ein Neustart hostet nie von selbst und tritt keinem Raum von selbst bei.
- Eigene Tools, Paket-Tools und unsichere Befehle bleiben in Räumen gesperrt. Gäste führen nie einen Scheduler oder lokale Befehle aus empfangenem Text aus. Conversation-Zeitpläne nutzen den Scheduler des Hosts.
- Neue Spieler und Persona-Änderungen gelten ab der nächsten Runde.
- Räume übertragen nur begrenzten Text. Es gibt keine Übertragung von Dateien, Medien, Erweiterungen oder Paketen. Der native Android-Wrapper kann nicht beitreten.

> **Warnung:** Verbinde dich nur mit Personen, denen du vertraust, und nutze deinen eigenen Marinara-Client. Installiere nie einen vom Host gelieferten Client, eine Erweiterung oder Datei. Der Host kann lesen, was du teilst, und geteilte Inhalte können an seine KI-Dienste gehen. Direkte Verbindungen legen Netzwerkadressen offen. Teile keine Passwörter, API-Keys oder persönlichen Daten. Verlasse den Raum sofort, wenn dir etwas seltsam vorkommt.

Genaue Einschränkungen und getestete Plattformen nennt der [Kompatibilitäts- und Prüfbericht](development/multiplayer.md). Bei Problemen hilft [Fehlerbehebung](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems) weiter.

## Agenten und Erweiterungen

Optionale offizielle Agenten installierst du in der App: **Agents → Agent Organizer** (Agenten → Agentenverwaltung). Marinara wählt den Katalog von [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), der zu seiner Hauptversion passt.

- **Updates:** Marinara fragt nach, bevor es eine neue Version eines installierten Pakets herunterlädt. **Not now** (jetzt nicht) behält die aktuelle Version, und **Update** bleibt in Agent Organizer verfügbar. Eine frische Installation hat keine Pakete.
- **Speicherort der Pakete:** `DATA_DIR/capability-packages`. Docker-Volumes, eigene Datenordner, Backups und normale Updates lassen sie unangetastet. Das gilt für Desktop, Docker und Termux. iOS und andere Browser nutzen die Pakete auf ihrem Host-Server.
- **Speicherplatz:** Marinara behält von jedem Paket die aktuelle und die vorherige Version und löscht ältere Versionen sowie die temporären Kopien in `DATA_DIR/capability-runtime-snapshots`. Paketdaten werden nie gelöscht.
- **Offline:** Installierte Pakete laufen in ihrer Version weiter, wenn GitHub nicht erreichbar ist, ein Update abgelehnt wird oder die Prüfung fehlschlägt.

### Import eigener Agenten

Externe Agent-Dateien, -Ordner und -Repositorys sind gesperrt. Um sie zu erlauben, schalte **Allow custom Agent imports** (Import eigener Agenten erlauben) unter **Settings → Advanced → Danger Zone** (Einstellungen → Erweitert → Gefahrenbereich) ein. Dafür brauchst du keine Umgebungsvariable. Bis dahin bleiben die Import-Bedienelemente ausgegraut.

Jeder Import zeigt zuerst, welche Fähigkeiten der Agent anfordert. Berechtigungen musst du ausdrücklich bestätigen. Mitgelieferte Funktionen und Tool-Auswahlen werden nicht importiert, generiertes CSS wird bereinigt, und Ergebnis-Aktionen werden gegen die freigegebenen Fähigkeiten geprüft. Schaltest du die Freigabe aus, laufen importierte Agenten nicht mehr. In Marinara erstellte Agenten und offizielle Pakete sind davon nicht betroffen.

<a id="custom-agent-repositories"></a>

### Eigene Agent-Repositorys

Repositorys sind standardmäßig aus, weil ihre Prompts und Tools ungeprüft sind. Setze `ENABLE_CUSTOM_AGENT_REPOS=true`, schalte **Allow custom Agent imports** ein und öffne dann **Agents → Agent Organizer → Custom Sources**, um ein öffentliches GitHub-Repository in der Vorschau anzusehen. Sowohl das Hinzufügen einer Quelle als auch das Übernehmen späterer Änderungen musst du bestätigen. Die Synchronisierung läuft manuell, und Marinara klont Repositorys nie und fragt sie nie im Hintergrund ab. Akzeptiert werden nur GitHub-URLs zum Stammverzeichnis eines Repositorys.

Ein Repository veröffentlicht Agenten, Game-Mode-Regelsätze oder beides. Im Stammverzeichnis:

- `agents.json` ist ein Array im Format herunterladbarer Agenten:

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

- `rulesets` enthält einen Regelsatz pro `.json`-Datei, höchstens 32 Dateien mit je bis zu 512 KB. Gelesen werden nur Dateien direkt darin. Die Vorschau listet für jeden Regelsatz Name, Version und Abdeckung auf. Der Game-Master-Text eines Regelsatzes geht in jedem Spiel, das ihn nutzt, an das Modell; installiere deshalb nur von Leuten, denen du vertraust.

Importierte Regelsätze werden nach dem Eigentümer des Repositorys benannt, etwa `alice/my-5e`, und nehmen so nie einen offiziellen Namen an. Jede Version bleibt erhalten, und ein Spiel läuft mit genau der Version, mit der es begonnen hat. Kommt dieselbe Version mit anderem Inhalt an, behält Marinara die installierte und weist dich darauf hin, den Autor um eine höhere Versionsnummer zu bitten. Eine Datei, die Marinara nicht lesen kann, wird mit Begründung aufgeführt und übersprungen.

Bei der Synchronisierung ersetzen die Prompt-, Einstellungs- und Tool-Werte aus dem Repository die vom Repository verwalteten Werte, die die Vorschau zeigt. Deine Auswahl von Konten und Bildern bleibt lokal. Verschwindet ein Agent aus dem Repository, bleibt er als normaler lokaler Agent erhalten und verliert nur seine Repository-Verknüpfung. Beim Entfernen einer Quelle gilt dasselbe, und ihre Regelsätze bleiben installiert.

Eigene Agenten können außerdem unter Context Sources die Option **Previous output** (vorherige Ausgabe) einschalten, um ihre eigene letzte erfolgreiche Ausgabe zu lesen. Gib bei **JSON context output** (Kontextausgabe als JSON) `{"text":"main prompt content","agent-context":"private continuation context"}` zurück. Nur `text` kommt in den Haupt-Prompt. **Hide output as spoilers** (Ausgabe als Spoiler verbergen) hält gespeicherte Ausgaben eingeklappt. Beim Neugenerieren bleibt der ersetzte Zug außen vor, und gelöschte Nachrichten oder inaktive Swipes können keinen Kontext liefern.

### External Extensions

Der Import von Erweiterungen Dritter braucht zwei Freigaben. Die Umgebungsvariable ist die Erlaubnis des Server-Betreibers. Der Schalter in der Danger Zone ist die Zustimmung des Nutzers.

1. Setze `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`.
2. Öffne **Settings → Advanced → Danger Zone**, scrolle unter die Bedienelemente zum Löschen von Daten, lies die Warnung und schalte **Allow third-party extension imports** (Importe von Fremdanbietern erlauben) ein.

Danach erscheint der Bereich **External Extensions** unter **Settings → Addons**. Wird eine der beiden Sicherheitssperren geschlossen, deaktiviert Marinara externe Einträge und stoppt ihren Code. Manuell abgelegte, alte und per Profil importierte Einträge gelten ebenso als extern wie solche unbekannter Herkunft; Dateien einfach in einen Ordner zu legen, umgeht die Sicherheitssperren also nicht. Für Entwürfe von Professor Mari muss keine der beiden Sicherheitssperren offen sein. Sie werden deaktiviert angelegt, und ihr exakter Code-Hash muss freigegeben werden.

Standard sind Browser-Erweiterungen in der Sandbox. Manche älteren Pakete zeigen **Full page access** (Vollzugriff auf die Seite), weil sie die Marinara-Seite brauchen. In diesem Modus läuft der freigegebene Code in der Marinara-Seite und hat Zugriff auf Seiteninhalte, Browser-Speicher, Netzwerk-APIs und deine Sitzung. Er steht nur External Extensions offen, wenn beide Sicherheitssperren offen sind, und verlangt eine eigene Bestätigung der Warnung. Lade die Seite neu, nachdem du ihn deaktiviert hast.

## Vollständige Referenz der Umgebungsvariablen

Die Tabellen weiter oben decken Zugriffskontrolle, Speicherung, Logging, Zeitlimits, privilegierte Aktionen und Freigaben für lokale Adressen ab. Die übrigen Einstellungen stehen hier.

### Server und Start

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `PORT` | `7860` | Der Port, auf dem der Server lauscht. Halte Android, Docker und Termux auf demselben Wert. |
| `HOST` | `127.0.0.1` (`0.0.0.0` in den Launchern und Docker-Images) | Die Netzwerkschnittstelle, an die gebunden wird. Für LAN-Zugriff `0.0.0.0` nehmen. Die Standard-Compose-Datei veröffentlicht den Docker-Port nur auf `127.0.0.1`. |
| `MARINARA_ANDROID_SECRET` | leer | Interner Geheimwert für APK-verwaltete Termux-Installationen. Die Android-App erzeugt ihn, der Termux-Launcher exportiert ihn. Fordere Nutzer nie auf, ihn zu setzen. Muss aus genau 64 Hexadezimalzeichen bestehen. Ein ungültiger, nicht leerer Wert lässt lokale Anfragen des Geräts mit HTTP 503 fehlschlagen. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Geheimwertdatei, die der Termux-Launcher und der lokale Befehl `mari` nutzen. APK und Launcher verwalten sie. |
| `AUTO_OPEN_BROWSER` | `true` | Ob die Launcher die App-URL öffnen. `false` schaltet das ab. Die APK-verwaltete Einrichtung schaltet es aus. |
| `AUTO_UPDATE_ENABLED` | `true` | Ob Git-basierte Launcher vor dem Start Updates holen und einspielen. `false` schaltet das ab dem nächsten Start ab. Der Launcher prüft weiterhin nur lesend auf neuere Releases und gibt eine Erinnerung aus. `--skip-update` überspringt beide Prüfungen für einen Start. |
| `MARINARA_NOTICES_ENABLED` | `true` | Ob der Server Hinweise der Maintainer abruft. Siehe [Marinara-Hinweise](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` im Branch `notices` | Überschreibt die Hinweisdatei, für Forks und Spiegel. Sie wird genauso geprüft, und Links außerhalb von `https://github.com/Pasta-Devs/` werden verworfen. Der Hostname der URL muss in der Hosts-Datei oder im DNS stehen. Siehe [Marinara-Hinweise](#marinara-notices). |
| `MARINARA_ENV_FILE` | `.env` im Projekt-Wurzelordner | Abweichender Pfad zur Datei `.env`. Vor dem Start setzen. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Höchstzahl gleichzeitiger Bild- oder Videoanfragen auf dem ganzen Server. Senke sie auf 1–2, wenn einem lokalen ComfyUI oder SwarmUI der VRAM ausgeht. `0` hebt die Obergrenze auf. Ungültige Werte werden mit einer Warnung ignoriert. Stapelaufträge belegen nie den letzten Platz. Gilt zusätzlich zu **Queue media generation requests** (Anfragen zur Mediengenerierung in die Warteschlange stellen; **Settings → Generations → Overall Generations**, standardmäßig an), das Bild- und Videoaufträge pro Konto in die Warteschlange stellt. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 Minuten) | Wie lange eine Anfrage auf einen freien Platz wartet, bevor sie fehlschlägt. `0` wartet unbegrenzt. |
| `MARINARA_SHARED_GPU_HOSTS` | leer | Kommagetrennte `host:port`-Liste für eine GPU, die sich ein lokales Modell und ein lokales Bild- oder Video-Backend teilen, etwa mit llama-swap. Text- und Medienanfragen an einen aufgeführten Host wechseln sich ab, sodass ein Bild nicht endlos hinter Chat-Antworten wartet. Ein Bild oder Clip wartet höchstens `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Embeddings werden nicht aufgehalten. Gilt ohne Neustart für neue Anfragen. |
| `MARINARA_ENV_WATCH` | `1` | Wie `.env` überwacht wird. Standard: Änderungsereignisse (rund 250 ms Entprellung) mit einer Prüfung alle 30 Sekunden als Rückfall. `poll`: immer die 30-Sekunden-Prüfung. `0`: aus. Siehe [Neustart oder Hot Reload](#restart-or-hot-reload). |
| `TZ` | Systemstandard | Ersatz-Zeitzone des Hosts für serverseitige Aufträge, etwa `Europe/Warsaw`. Lass die Variable ungesetzt oder leer, um die Zeitzone des Hosts zu nutzen. Eine gespeicherte **Schedule timezone** (Zeitzone des Zeitplans) aus Conversation hat für Zeitpläne Vorrang. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser-Ursprünge, die Cross-Origin-Anfragen stellen dürfen. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Altes Flag. Aktuelle Builds enthalten keinen Starter-Key, es entsteht also nichts. Füge in der App dein eigenes Konto hinzu. |

**Schedule timezone** nutzt standardmäßig die Zeitzone deines Geräts. Du kannst sie bei der Einrichtung von Conversation, in den Conversation Chat Settings oder im Zeitplan-Editor des Charakters ändern. Sie ist eine einzige globale Einstellung für alle Conversation-Chats und wird mit anderen Clients am selben Server abgeglichen.

### Medien- und Sprite-Werkzeuge

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `FFMPEG_PATH` | leer | Pfad zu `ffmpeg`, genutzt für animierte GIFs von Gesichtsausdrücken. Ohne Angabe greift `ffmpeg` aus deinem PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 Minuten) | Zeit für die Umwandlung eines animierten Gesichtsausdruck-Clips. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` versucht zuerst die eingebaute Bereinigung, dann das optionale KI-Werkzeug. `builtin` nutzt nur die eingebaute Bereinigung. `backgroundremover` erzwingt das KI-Werkzeug. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` installiert den optionalen KI-Hintergrundentferner beim Start. |
| `BACKGROUNDREMOVER_COMMAND` | leer | Pfad zu einem System-Programm `backgroundremover`. |
| `BACKGROUNDREMOVER_PYTHON` | leer | Pfad zu einem Python, in dem `backgroundremover` installiert ist. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 Minuten) | Zeit für einen KI-Aufruf zum Entfernen des Hintergrunds. |

### Anbieter für Szenen-Videos

Video-Konten richtest du in der App ein. Diese Einstellungen justieren nur die Aufträge. Die Werte sind in Millisekunden.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Wie oft der Server einen Google-Veo-Auftrag abfragt. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | Wie oft er einen xAI-Imagine-Auftrag abfragt. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Wie oft er einen OpenRouter-Video-Auftrag abfragt. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Wie oft er einen Seedance-Auftrag abfragt. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | leer | Öffentliche HTTPS-Adresse dieses Servers, für Dienste, die ein Referenzbild per URL holen müssen. |

<a id="lorebooks"></a>

### Lorebooks

Beide Einstellungen sind standardmäßig aus und gelten nach einer `.env`-Änderung ab der nächsten Generierung. Ist `LOREBOOK_STABLE_GROUP_WINNERS` gesetzt, hat die Variable Vorrang vor dem Schalter **Stable lorebook picks** (stabile Lorebook-Auswahl) unter **Settings → Advanced → Features**. Sonst entscheidet der Schalter. Siehe [Funktionsschalter](configuration/features.md).

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Behält pro Chat denselben Gewinner einer Einschlussgruppe, solange die Kandidaten gleich bleiben, statt bei jeder Generierung neu auszulosen. Hält den Anfang des Prompts stabil für den Prompt-Cache des Anbieters. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Speichert den vollständigen Text aktivierter Einträge nur an der neuesten Assistenten- oder Erzählernachricht. Ältere Nachrichten behalten Eintrags-IDs, Schlüssel und Scores. Macht Chats mit großen Lorebooks deutlich kleiner. Werden neuere Nachrichten gelöscht, zeigen Active Context und Agentenwiederholungen für die wieder neueste Nachricht den aktuellen Text des Eintrags. |

`scripts/compact-lorebook-scans.mjs` wendet dieselbe Regel auf ältere Chats an. Stoppe zuerst den Server. Ohne `--apply` bleibt es ein Probelauf, und vor dem Schreiben sichert es beide Nachrichtentabellen.

<a id="robustness"></a>

### Robustheit

Alle sind standardmäßig aus und behalten so das bisherige Verhalten bei. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` und `SHUTDOWN_FORCE_EXIT_ON_REPEAT` brauchen einen Neustart. Die übrigen gelten nach einer `.env`-Änderung. Ist `PROVIDER_RETRY_TRANSIENT_ERRORS` gesetzt, hat die Variable Vorrang vor dem Schalter **Retry failed provider calls** (fehlgeschlagene Anbieteraufrufe wiederholen) unter **Settings → Advanced → Features**. Sonst entscheidet der Schalter.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Wiederholt eine abgelehnte oder nicht erreichbare Verbindung oder einen 502 oder 503 höchstens zweimal mit einer Wartezeit von maximal 5 s, und nur, bevor Text bei dir angekommen ist. Ein 504 oder eine abgebrochene Verbindung wird nie wiederholt. Nicht genutzt, wenn das Konto einen Fallback hat; dieser wird sofort versucht. Ein langsam scheiternder Host kann die Fehlermeldung um etwa 20 s verzögern. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | Eine Speicherung überspringt das Neuschreiben einer Chat-Datei oder von `manifest.json`, wenn der Inhalt dem entspricht, was dieser Server zuletzt geschrieben hat, und die Datei auf der Festplatte unverändert ist. Eine gerade aus ihrer `.bak` wiederhergestellte Datei wird immer neu geschrieben. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Bereitet große Chat-Dateien in kurzen Abschnitten zum Speichern vor, sodass das Speichern eines sehr langen Chats andere Anfragen nicht anhält. Die geschriebenen Bytes bleiben gleich. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Nur Windows. Merkt sich die Prüfung der Startzeit, die die Speichersperre bei jedem Start ausführt (etwa 1,5 bis 2 s PowerShell), bis zum nächsten Neustart des Systems in `.writer-boot-id.json` in `DATA_DIR`. |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Nur Windows. Auch <kbd>Ctrl</kbd>+<kbd>Break</kbd> und das Schließen der Konsole beenden den Server sauber und schreiben ausstehende Speicherungen. Beim Schließen der Konsole gelten kürzere Fristen, damit alles in die ungefähr 5 s passt, die Windows erlaubt. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Drückst du <kbd>Ctrl</kbd>+<kbd>C</kbd> oder <kbd>Ctrl</kbd>+<kbd>Break</kbd> mehr als 1,5 s nach dem ersten Mal erneut, beendet sich der Server sofort. Noch nicht geschriebene Speicherungen können verloren gehen. Ohne diese Option werden Wiederholungen ignoriert, und die Beendigungsfrist von 8 s gilt. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Beginnt beim Eintreffen eines Stoppsignals mit dem Schreiben ausstehender Speicherungen, während Verbindungen noch schließen. Der Neustart über Advanced Settings nutzt das nicht. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | Wie lange ein Stoppsignal auf Hintergrund-Runtimes (Pakete, Erweiterungen, eingebautes Modell) wartet, bevor es den Datenspeicher schließt. `0` wartet auf alle. Höchstens `2500`, damit der Datenspeicher innerhalb der Frist von 8 s schließt. Der Neustart über Advanced Settings wartet weiterhin auf alle. |

### Integrationen und Extras

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Ob Konten vom Typ **Claude (Subscription)** das auf diesem Rechner installierte Claude Code verwenden, sofern es mindestens so neu ist wie die mitgelieferte Kopie. Unter Android gibt es keine mitgelieferte Kopie, dort muss die Einstellung an bleiben. `false` verwendet immer die mitgelieferte Kopie. Greift innerhalb von fünf Minuten. |
| `DOCS_I18N_BASE_URL` | offizieller `docs-i18n`-Branch | Woher die Sprachpakete für Dokumentation und Oberfläche geladen werden. Oberflächenpakete nutzen das Unterverzeichnis `ui/`. Muss ein öffentlicher `https://`-Host sein. |
| `GIPHY_API_KEY` | leer | Giphy-Key für die GIF-Suche in Conversation. Die Suche bleibt aus, bis du ihn setzt und neu startest. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Standardadresse der Intiface-Haptik-App. |
| `SPOTIFY_REDIRECT_URI` | aus der Anfrage abgeleitet | Abweichende Callback-URL für die Spotify-Anmeldung. Setz sie, wenn TLS vorgelagert endet. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Größter Wiki-Seiteninhalt, den Professor Mari liest, bevor gekürzt wird. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Zeit für eine Wiki-Anfrage von Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Wie lange Professor Mari einen Wiki-Abruf zwischenspeichert. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (der Windows-Launcher setzt `true`) | Erlaubt die Installation der Laufzeit für das **Built-in model** (eingebautes Modell) über Loopback ohne Admin-Header. |

Zum **Built-in model** siehe [Eingebautes Modell einrichten](connections/local-model.md).

<a id="outbound-http-proxy"></a>

### Ausgehender HTTP-Proxy

Manche Netzwerke erreichen das Internet nur über einen HTTP-Proxy, zum Beispiel v2rayN ohne TUN-Modus. Marinara kann seine Anfragen an KI-Dienste, Bilddienste, Embedding-Server und den Agenten-Katalog über diesen Proxy schicken. Setze die folgenden Werte in der Umgebung, die Marinara startet, oder in `.env` und starte dann neu.

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | nicht gesetzt | `1` schaltet den Proxy ein. Ohne die Variable ignoriert Marinara die Proxy-Einstellungen, wie Node.js. |
| `HTTP_PROXY` | leer | Adresse des Proxys, etwa `http://127.0.0.1:10809`. Gilt für jede Anfrage, wenn `HTTPS_PROXY` nicht gesetzt ist. |
| `HTTPS_PROXY` | leer | Proxy für `https://`-Adressen, wenn er sich von `HTTP_PROXY` unterscheidet. |
| `NO_PROXY` | leer | Kommagetrennte Hosts, die den Proxy umgehen. Trag hier Modell-Server in deinem Netzwerk ein. `localhost`, `127.0.0.1` und `::1` umgehen ihn immer. |

## Verwandte Anleitungen

- [Funktionsschalter](configuration/features.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](REMOTE_ACCESS.md)
- [Wo Marinara deine Daten speichert](data/where-data-is-stored.md)
- [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md)
- [Szenenvideos generieren](media/scene-video.md)
- [Fehlerbehebung in Marinara Engine](TROUBLESHOOTING.md)
