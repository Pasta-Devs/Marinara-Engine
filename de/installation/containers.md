# Im Container betreiben (Docker / Podman)

In dieser Anleitung erfährst du, wie du Marinara Engine in einem Container mit Docker oder Podman betreibst. Ein Container ist ein in sich geschlossenes Paket: Es enthält die App und alles, was sie zum Laufen braucht. Node.js oder andere Werkzeuge musst du dafür nicht auf dem Rechner installieren. Wenn du neu bist und Marinara einfach nur zum Laufen bringen willst, ist das der einfachste Weg.

## Voraussetzungen

Installiere vorab eines dieser beiden Programme auf dem Rechner, der Marinara betreiben soll:

- Docker Desktop (Windows oder macOS) oder Docker Engine (Linux). Docker ist das verbreitetste Container-Werkzeug.
- Oder Podman. Podman ersetzt Docker eins zu eins. Es läuft ohne Hintergrunddienst und kommt gut ohne Root-Rechte aus.

Ein paar Begriffe, die unten vorkommen:

- **Image**: eine herunterladbare, schreibgeschützte Vorlage, die Marinara Engine enthält. Aus einem Image startest du einen laufenden Container.
- **Volume**: ein Speicherbereich, den das Container-Werkzeug für dich verwaltet. Ein Volume bewahrt die Daten auf, selbst wenn du den Container löschst und neu anlegst.
- **LAN**: dein lokales Netzwerk (das WLAN oder Kabelnetz zu Hause oder im Büro).

Die offiziellen Marinara-Images liegen unter `ghcr.io/pasta-devs/marinara-engine`.

## Herunterladen und starten

Im Wurzelverzeichnis des Projekts liegt eine fertige `docker-compose.yml`. Compose liest diese Datei und startet den Container für dich. Das ist der empfohlene Weg, Marinara zu betreiben.

1. Besorg dir eine Kopie des Repositorys. Falls du Marinara Engine schon ausgecheckt hast, öffne ein Terminal in diesem Ordner. Falls nicht, klone es zuerst:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Wechsle in den Ordner:

```bash
cd Marinara-Engine
```

3. Starte den Container im Hintergrund:

```bash
docker compose up -d
```

Die `docker-compose.yml` nutzt das Image `ghcr.io/pasta-devs/marinara-engine:latest` und lädt es beim ersten Ausführen dieses Befehls herunter. Der erste Download kann ein paar Minuten dauern.

## Prüfen, ob alles läuft

1. Öffne den Webbrowser.
2. Ruf diese Adresse auf:

```text
http://127.0.0.1:7860
```

Jetzt sollte der Home-Bildschirm von Marinara Engine erscheinen. Dann läuft der Container. Die Adresse `127.0.0.1` bedeutet „genau dieser Rechner“, und `7860` ist der Standard-Port, auf dem Marinara lauscht.

Lädt die Seite nicht, hilft der Abschnitt „Fehlerbehebung“ weiter unten.

## Wo die Daten liegen

Deine Daten – Chats, Charaktere, Uploads, Schriften und Standard-Hintergründe – landen als ganz normale Dateien auf der Platte. Marinara nutzt dateibasierten Speicher: Die Daten liegen also als einzelne Dateien vor und nicht in einer einzigen Datenbankdatei. Compose bewahrt sie in einem benannten Volume namens `marinara-data` auf.

Compose stellt den Namen des Projektordners vor die Volume-Namen. Der tatsächliche Name folgt daher dem Muster `PROJECT_marinara-data`. Den genauen Namen auf deinem Rechner findest du so heraus:

```bash
docker volume ls --filter name=marinara-data
```

Danach zeigt dir dieser Befehl den Ablageort des passenden Eintrags aus der Liste:

```bash
docker volume inspect PROJECT_marinara-data
```

Ersetze `PROJECT_marinara-data` durch den Namen, den der vorige Befehl ausgegeben hat.

Bei jedem Start bereitet der Container den Datenordner vor. Standardmäßig startet er als Root. Er korrigiert die Besitzrechte am Ordner, damit die App hineinschreiben kann, und wechselt anschließend zur Sicherheit auf ein Konto ohne Root-Rechte. Das funktioniert beim benannten Volume genauso wie bei einem Ordner, den du vom Host einbindest. Ältere Installationen wechseln dadurch auf den dateibasierten Speicher, ohne dass du Besitzrechte von Hand setzen musst.

Beim ersten Start legt Marinara außerdem eine leere Einstellungsdatei unter `/app/data/.env` im Volume an. Dort trägst du später Server-Einstellungen ein. Da sie im Volume liegt, überstehen die Einstellungen Neustarts des Containers und Image-Updates. Die vollständige Liste der Einstellungen steht in der [Referenz der Server-Konfiguration](../CONFIGURATION.md).

## Marinara im LAN erreichbar machen

Standardmäßig erlaubt Compose den Zugriff auf Marinara nur vom selben Rechner aus. Das ist die sichere Grundeinstellung. Willst du Marinara auf dem Handy oder einem anderen Rechner im Netzwerk öffnen, sind zwei Dinge nötig: die Port-Zuordnung ändern und eine Anmeldung aktivieren, damit Fremde nicht herankommen.

Basic Auth ist eine einfache Abfrage von Benutzername und Passwort, die die App schützt. Gib Marinara niemals ohne diesen Schutz ins Netzwerk frei.

1. Öffne `docker-compose.yml` in einem Texteditor.

2. Such die Port-Zeile. Sie sieht so aus:

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Entferne den Teil `127.0.0.1:`, damit andere Geräte die App erreichen:

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. Ergänze in derselben Datei eine Anmeldung und ein Admin-Geheimnis in der Liste `environment:`. Trag eigene Werte ein:

```yaml
environment:
  - BASIC_AUTH_USER=yourname
  - BASIC_AUTH_PASS=a-long-random-password
  - ADMIN_SECRET=another-long-random-value
```

5. Speichere die Datei und starte den Container neu:

```bash
docker compose up -d
```

Andere Geräte im Netzwerk erreichen Marinara nun unter `http://YOUR_COMPUTER_IP:7860`, sofern `PORT` nicht gesetzt ist. Hast du `PORT` gesetzt, ersetze `7860` durch diesen Host-Port. Benutzername und Passwort müssen die Geräte dabei eingeben.

Unter Docker Desktop, OrbStack und rootless Docker erreicht jedes Gerät den Container über dieselbe Adresse, auch dein eigener Browser. Sobald die Anmeldung gesetzt ist, fragt also auch dieser Computer danach, und eine IP-Allowlist kann die Geräte nicht unterscheiden. Entferne `127.0.0.1:` nie ohne Anmeldung: Unter diesen Laufzeitumgebungen kann Marinara andere Geräte nicht von diesem Computer unterscheiden. Wie du den Zugriff auf bestimmte Geräte beschränkst und was das Admin-Geheimnis bewirkt, steht unter [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md).

## Das passende Image: latest, staging oder lite

Marinara veröffentlicht mehrere Image-Tags. Wähl das Tag, das zu deinem Vorhaben passt.

- `latest` ist die empfohlene stabile Version. Die `docker-compose.yml` verwendet sie standardmäßig.
- `X.Y.Z` ist eine feste Version, etwa `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Nimm sie, wenn du dich auf genau eine Version festlegen willst.
- `staging` ist ein instabiler Testbuild aus dem aktuellen Entwicklungsstand. Nutz ihn nur, um unveröffentlichte Änderungen auszuprobieren. Er kann kaputtgehen, sein Verhalten unangekündigt ändern und einen Rückweg der Daten zu einem stabilen Build verbauen.
- `lite` ist ein kleineres Image. Der nächste Abschnitt beschreibt es.

Wenn du das `staging`-Image betreibst, nimm ein eigenes Volume – so kann ein instabiler Build die stabilen Daten nicht verändern:

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### Das lite-Image

Das lite-Image ist eine kleinere Variante: Sie verzichtet auf einige Offline-Funktionen und ist dafür deutlich schneller heruntergeladen. Als Basis dient Wolfi, ein minimales Linux-System für Container.

Im lite-Image fehlen die Funktionen, die große lokale Dateien benötigen:

| Fehlt in lite | Was dir entgeht |
| --- | --- |
| Local Model (Gemma, läuft auf dem eigenen Rechner) | Ein KI-Modell auf eigener Hardware ist nicht möglich. |
| Lokales Embedding-Modell | Keine Text-Embeddings auf dem Gerät. |
| Memory Recall (semantische Suche) | Hängt vom lokalen Embedding-Modell ab. |
| Lokale Spracheingabe mit Whisper | Die Sprache-zu-Text-Umsetzung für Conversation-Anrufe entfällt. |
| Stimmungserkennung für Avatare | 2D Avatars und 3D Avatars wählen Gesichter anhand einer Wortliste statt mit dem kleinen lokalen Emotionsmodell. |

Alles andere funktioniert unverändert: Chat, Roleplay, Game Mode, Agenten, Lorebooks, Charaktere und Verbindungen zu entfernten KI-Anbietern. Für KI-Funktionen brauchst du beim lite-Image zwingend einen externen Anbieter, etwa OpenRouter, OpenAI oder ein selbst gehostetes Modell. Mehr dazu unter [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Das lite-Tag lautet `ghcr.io/pasta-devs/marinara-engine:lite`; zu jeder Version erscheint zusätzlich ein versionsgebundenes lite-Tag der Form `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. So startest du es:

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Auf dem Raspberry Pi 4 und ähnlichen ARM-Rechnern stürzen manche älteren lite-Images ab. Der Absturz meldet einen `SIGILL`-Fehler – eine unerlaubte Prozessoranweisung – während ausgehender Aufrufe an KI-Anbieter. Nutz auf solchen Geräten lieber das reguläre `latest`-Image. Den aktuellen Stand dazu findest du unter [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md).

## Aktualisieren

Container-Images aktualisieren sich nicht selbst. Du lädst ein neueres Image herunter und startest den Container von Hand neu. Leg vorher ein Backup an, damit du genau dorthin zurückkehren kannst, wo du warst. Siehe [Marinara sichern und wiederherstellen](../data/backup-and-restore.md).

Für Docker Compose genügt ein Befehl:

```bash
docker compose pull && docker compose up -d
```

Für Podman Compose genügt ebenfalls ein Befehl:

```bash
podman compose pull && podman compose up -d
```

Die Version lässt sich auch in der App nachsehen. Öffne **Settings** (Einstellungen), wechsle auf den Tab **Advanced** (Erweitert) und such den Bereich **Updates**. Klick auf **Check for Updates** (Nach Updates suchen). Bei Container-Installationen erkennt Marinara, dass es in Docker läuft, und zeigt dir das Image-Tag der Version samt dem passenden Befehl für den Host an. Das Update selbst kann es aus dem Browser heraus nicht einspielen – den Befehl von oben führst du also weiterhin auf dem Host aus.

Um zu einer älteren Version zurückzukehren, trag ihr Versions-Tag in der Zeile `image:` der `docker-compose.yml` ein, zum Beispiel `ghcr.io/pasta-devs/marinara-engine:2.5.0`, und führ dann `docker compose up -d` aus. Der Weg zurück zu 2.5.0 funktioniert, und deine Chats öffnen sich ganz normal. Die Einstellungen und Spieldaten, die neuere Funktionen hinzugefügt haben, kennt 2.5.0 allerdings nicht. Jeder Chat und jede Verbindung, die 2.5.0 speichert, verliert diese Daten, und ein erneutes Update holt sie nicht zurück. Siehe [Zurück zu 2.5.0](../UPGRADING.md#going-back-to-250).

## Podman

Podman führt dieselben Images aus wie Docker. Meist reicht es, in den obigen Befehlen `docker` durch `podman` zu ersetzen.

Start mit Compose:

```bash
podman compose up -d
```

Einzelnen Container ohne Compose starten:

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

Der Befehl `podman compose` setzt das Hilfsprogramm `podman-compose` voraus. Installier es mit dem Befehl für dein System.

Unter Fedora:

```bash
sudo dnf install podman-compose
```

Unter Debian oder Ubuntu:

```bash
sudo apt install podman-compose
```

Mit pip:

```bash
pip install podman-compose
```

## Image selbst bauen

Falls du das Image lieber aus dem Quellcode baust, statt es herunterzuladen:

```bash
docker build -t marinara-engine .
```

Danach startest du den eigenen Build:

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Für das lite-Image aus dem Quellcode zeigst du Docker auf die lite-Build-Datei:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Fehlerbehebung

**Die Seite lädt nicht, oder der Port ist bereits belegt.** Womöglich belegt ein anderes Programm den Port `7860`. Ändere die Port-Zuordnung auf einen freien Port, etwa `8080:7860` in der Liste `ports:`. Starte danach mit `docker compose up -d` neu und öffne `http://127.0.0.1:8080`.

**Marinara kann keine Dateien schreiben, oder es erscheinen Rechtefehler.** Der Container korrigiert bei jedem Start die Besitzrechte am Datenordner. Das klappt bei benannten Volumes ebenso wie bei Ordnern, die du vom Host einbindest. Auf manchen Host-Dateisystemen schlägt die Korrektur fehl; mit `MARINARA_SKIP_DATA_CHOWN=true` wird sie ganz übersprungen. Halten die Fehler an, nimm das standardmäßige benannte Volume `marinara-data` – das ist die zuverlässigste Variante.

**Das lite-Image stürzt auf einem Raspberry Pi 4 ab.** Siehe den Hinweis zum lite-Image weiter oben. Nutz auf dieser Hardware das reguläre `latest`-Image.

Weitere Hilfe findest du unter [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Referenz der Server-Konfiguration](../CONFIGURATION.md)
- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
- [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md)
