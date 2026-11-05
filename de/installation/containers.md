# Im Container betreiben (Docker / Podman)

Betreibe Marinara Engine in einem Container mit Docker oder Podman. Ein Container ist ein Paket, das die App und alles enthält, was sie braucht. Node.js musst du also nicht installieren. Willst du Marinara mit dem geringsten Einrichtungsaufwand zum Laufen bringen, fang hier an.

## Bevor du anfängst

Installiere eines dieser Programme auf dem Rechner, auf dem Marinara laufen soll:

- Docker Desktop (Windows oder macOS) oder Docker Engine (Linux).
- Podman, ein Ersatz für Docker, der keinen Hintergrunddienst braucht und ohne Root-Rechte funktioniert.

Begriffe, die unten vorkommen:

- **Image:** eine herunterladbare, schreibgeschützte Kopie von Marinara. Wenn du ein Image ausführst, entsteht daraus ein Container.
- **Volume:** ein Speicherbereich, den das Container-Werkzeug verwaltet. Es bewahrt deine Daten auf, wenn du den Container löschst und neu anlegst.

Die offiziellen Images liegen unter `ghcr.io/pasta-devs/marinara-engine`.

<a id="start-marinara"></a>

## Marinara starten

Das Projekt bringt eine fertige Datei `docker-compose.yml` mit. Compose ist der Teil von Docker, der diese Datei liest und den Container startet. Das ist der empfohlene Weg.

1. Öffne ein Terminal, also ein Fenster, in das du Befehle eintippst. Hast du Marinara schon ausgecheckt, öffne das Terminal in diesem Ordner und überspring die nächsten zwei Schritte.
2. Lade die Projektdateien herunter.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Wechsle in den neuen Ordner.

   ```bash
   cd Marinara-Engine
   ```

4. Starte den Container im Hintergrund.

   ```bash
   docker compose up -d
   ```

   Beim ersten Mal lädt dieser Befehl das Image `ghcr.io/pasta-devs/marinara-engine:latest` herunter, was ein paar Minuten dauern kann. Danach zeigt das Terminal den Container als `Started` an.

5. Öffne `http://127.0.0.1:7860` in deinem Browser. Der Home-Bildschirm von Marinara erscheint.

Wenn es nicht funktioniert hat: Vielleicht belegt ein anderes Programm den Port `7860`. Wähl einen freien Port, etwa `8080`. Leg im selben Ordner wie `docker-compose.yml` eine Datei namens `.env` mit der Zeile `PORT=8080` an und führ `docker compose up -d` erneut aus. Compose liest diese Datei jedes Mal, deshalb behalten spätere Updates den neuen Port. Öffne dann `http://127.0.0.1:8080`. Weitere Lösungen stehen unter [Fehlerbehebung](#troubleshooting).

## Marinara stoppen

Führ diesen Befehl im selben Ordner aus. Er stoppt den Container und entfernt ihn. Deine Daten bleiben im Volume.

```bash
docker compose down
```

Mit Podman nimmst du `podman compose down`.

## Wo deine Daten liegen

Marinara speichert deine Chats, Charaktere, Uploads, Schriften und Standard-Hintergründe als ganz normale Dateien in einem Compose-Volume namens `marinara-data`. Compose stellt den Namen des Projektordners davor, deshalb sieht der tatsächliche Name etwa so aus: `PROJECT_marinara-data`. So findest du den genauen Namen und den Ablageort heraus:

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

Ersetze `PROJECT_marinara-data` durch den Namen, den der erste Befehl ausgegeben hat.

Beim ersten Start legt Marinara außerdem eine leere Einstellungsdatei unter `/app/data/.env` im Volume an. Dort trägst du Server-Einstellungen ein. Sie überstehen Neustarts und Image-Updates. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).

Bei jedem Start korrigiert der Container die Besitzrechte am Datenordner, damit die App hineinschreiben kann. Er startet als Root, korrigiert die Besitzrechte und wechselt dann zu einem Benutzer ohne Root-Rechte. Das funktioniert beim Volume genauso wie bei einem Ordner, den du von deinem Rechner einbindest.

<a id="open-marinara-from-another-device"></a>

## Marinara von einem anderen Gerät öffnen

Standardmäßig lässt Compose nur diesen Rechner an Marinara heran. Um es auf einem Handy oder einem anderen Rechner zu öffnen, veröffentlichst du den Port auf allen Schnittstellen und richtest vorher eine Anmeldung ein. Gib Marinara niemals ohne Anmeldung in dein Netzwerk frei.

Unter Docker Desktop, OrbStack und rootless Docker (Docker ohne Root-Rechte) erscheint jedes Gerät mit derselben Gateway-Adresse. Ohne Anmeldung lässt ein auf allen Schnittstellen veröffentlichter Port jeden hinein. Sobald eine Anmeldung gesetzt ist, wird auch dieser Rechner danach gefragt. Siehe [Ausnahme für Tailscale und Docker](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Öffne `docker-compose.yml` im Marinara-Ordner in einem Texteditor.
2. Entferne in der Liste `ports:` den Teil `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. Ergänze in der Liste `environment:` ein Admin-Secret. Nimm einen eigenen langen, zufälligen Wert.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. Ergänze in derselben Liste eine Anmeldung. Nimm deinen eigenen Benutzernamen und ein langes, zufälliges Passwort.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Speichere die Datei und starte den Container neu.

   ```bash
   docker compose up -d
   ```

6. Öffne auf dem anderen Gerät `http://YOUR_COMPUTER_IP:7860`. Hast du `PORT` gesetzt, nimm diesen Port. Die Seite fragt nach deiner Anmeldung.

Lässt du `BASIC_AUTH_USER` und `BASIC_AUTH_PASS` weg, fragt die Seite stattdessen nach einem einmaligen Einrichtungscode. Such ihn in den Logs und gib ihn dann zusammen mit einem neuen Benutzernamen und Passwort auf der Seite ein.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

Eine App-Anmeldung kannst du später in einem angemeldeten Browser unter **Settings → Advanced → Access** ändern. Vergisst du das Passwort, führ `docker exec <container> node scripts/reset-login.mjs` aus. Dieser Befehl ändert keine Anmeldung aus `BASIC_AUTH_USER` und `BASIC_AUTH_PASS`. Diese bearbeitest du in der Compose-Datei und legst den Container dann neu an.

Unter Docker Desktop, OrbStack und rootless Docker öffnest du Marinara auf diesem Rechner unter `http://localhost:7860`, um die Anmeldung in **Settings** (Einstellungen) einzurichten. Eine IP-Allowlist kann die Geräte dort nicht unterscheiden, nutze also eine Anmeldung. Weitere Wege, den Zugriff zu beschränken, und was das Admin-Secret bewirkt, stehen unter [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md).

## Marinara aktualisieren

Container aktualisieren sich nicht selbst. Leg zuerst ein Backup an (siehe [Marinara sichern und wiederherstellen](../data/backup-and-restore.md)), hol dann das neue Image und starte neu. Führ diesen Befehl in dem Ordner aus, in dem `docker-compose.yml` liegt:

```bash
docker compose pull && docker compose up -d
```

Mit Podman nimmst du stattdessen `podman compose`. In der App zeigt **Settings → Advanced → Updates → Check for Updates** das Image-Tag und diesen Befehl. Bei einem Container kann die App das Update nicht selbst einspielen.

Um zu einem älteren Release zurückzukehren, trag dessen Tag in der Zeile `image:` der `docker-compose.yml` ein und führ dann `docker compose up -d` aus. Lies vorher [Zurück zu einer älteren Version](../UPGRADING.md#downgrading-to-an-older-version). Ältere Builds können Daten, die neuere Builds gespeichert haben, nicht öffnen.

## Ein Image-Tag wählen

| Tag | Was es ist |
| --- | --- |
| `latest` | Das stabile Release. `docker-compose.yml` verwendet es. |
| `X.Y.Z` | Eine feste Version, etwa `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | Ein instabiler Testbuild mit unveröffentlichtem Code. Er kann kaputtgehen, und deine Daten lassen sich womöglich nicht zu einem stabilen Build zurückbringen. |
| `lite` | Ein kleineres Image. Siehe unten. |
| `X.Y.Z-lite` | Eine feste Version des lite-Images. |

Betreibst du `staging`, nimm ein eigenes Volume, damit der Build deine stabilen Daten nicht verändern kann:

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### Das lite-Image

Das lite-Image ist ein kleinerer Download auf Basis von Wolfi, einem minimalen Linux-System für Container. Es lässt Funktionen weg, die große lokale Dateien brauchen:

| Fehlt in lite | Was dir entgeht |
| --- | --- |
| Eingebautes Modell | Du kannst kein KI-Modell auf deiner eigenen Hardware ausführen. |
| Lokales Embedding-Modell | Keine Text-Embeddings auf dem Gerät. |
| Memory Recall (semantische Suche) | Hängt vom lokalen Embedding-Modell ab. |
| Lokale Spracheingabe mit Whisper | Keine Sprache-zu-Text-Umsetzung für Conversation-Anrufe. |
| Stimmungserkennung für Avatare | 2D- und 3D-Avatare wählen Gesichter anhand einer Wortliste statt mit dem kleinen lokalen Emotionsmodell. |

Alles andere funktioniert: Chat, Roleplay, Game Mode, Agenten, Lorebooks, Charaktere und entfernte KI-Dienste. Für KI-Funktionen musst du ein Konto bei einem externen Dienst hinzufügen. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Manche älteren lite-Images stürzen auf einem Raspberry Pi 4 und ähnlichen ARM-Rechnern während ausgehender KI-Aufrufe mit einem `SIGILL`-Fehler ab (einer unerlaubten Prozessoranweisung). Nutz auf solchen Geräten das reguläre Image `latest`. Den aktuellen Stand findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Podman

Podman führt dieselben Images aus. In den meisten Befehlen ersetzt du `docker` durch `podman`.

```bash
podman compose up -d
```

Einen einzelnen Container ohne Compose startest du so:

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` braucht das Hilfsprogramm `podman-compose`. Installier es mit einem dieser Befehle:

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

Die erste Zeile gilt für Fedora, die zweite für Debian oder Ubuntu, und die dritte funktioniert überall, wo es pip gibt.

## Image selbst bauen

Um das Image aus dem Quellcode zu bauen, statt es herunterzuladen:

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Für das lite-Image nimmst du die lite-Build-Datei:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## Fehlerbehebung

**Die Seite lädt nicht, oder der Port ist belegt.** Siehe die Port-Lösung unter [Marinara starten](#start-marinara).

**Marinara kann keine Dateien schreiben, oder es erscheinen Rechtefehler.** Der Container korrigiert bei jedem Start die Besitzrechte am Ordner. Auf manchen Host-Dateisystemen kann die Korrektur fehlschlagen, und mit `MARINARA_SKIP_DATA_CHOWN=true` wird sie übersprungen. Halten die Fehler an, nimm das Standard-Volume `marinara-data`. Es ist am zuverlässigsten.

**Das lite-Image stürzt auf einem Raspberry Pi 4 ab.** Nutz das reguläre Image `latest`.

Weitere Hilfe findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
