# Fehlerbehebung in Marinara Engine

Such dir dein Symptom heraus und folge dann der Lösung. Die meisten Probleme verschwinden, wenn du Marinara über seinen Launcher neu startest (`start.bat`, `start.sh` oder `start-termux.sh`).

## Erste Versuche

1. Lade die Seite vollständig neu, also ohne Cache: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> unter Windows oder Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> auf dem Mac.
2. Such in der Server-Konsole (dem Terminal-Fenster, in dem Marinara läuft) nach roten Fehlerzeilen. Sie nennen meist das eigentliche Problem.
3. Willst du um Hilfe bitten, schalte zuerst den **Debug mode** (Debug-Modus) ein. Siehe [Weitere Hilfe bekommen](#get-more-help).

<a id="my-character-does-not-reply"></a>

## Mein Charakter antwortet nicht

Prüf diese Punkte der Reihe nach.

1. Achte auf eine Toast-Meldung (eine kurze Nachricht am unteren Bildschirmrand). Sie nennt meist das Problem. Siehe [Fehler bei Verbindung und Generierung](#connection-and-generation-errors).
2. Prüf, ob der Chat ein Konto und ein Modell hat: Öffne **Chat Settings** (Chat-Einstellungen) und sieh dir die Verbindung an. Ist keine eingetragen, füg unter **Connections** (Verbindungen) ein Konto hinzu. Siehe [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md).
3. Prüf, ob der API-Key stimmt und das Konto Guthaben hat. Ein falscher Key oder ein leeres Guthaben ist eine häufige Ursache.
4. Prüf den Modellnamen und, bei einem lokalen Server wie Ollama oder LM Studio, ob der Server läuft.
5. Schick deine Nachricht noch einmal ab oder wähl ein anderes Modell.

Hilft nichts davon, schalte den **Debug mode** ein und lies die Server-Konsole. Siehe [Weitere Hilfe bekommen](#get-more-help).

## Die App lädt nicht auf dem Handy oder einem anderen Gerät

Du kannst Marinara nicht von einem Handy, Tablet oder anderen Computer aus öffnen?

Meistens liegt es an einem dieser drei Punkte:

- **Adresse.** Standardmäßig lauscht der Server auf `127.0.0.1` (nur dieser Computer). Die Launcher setzen `HOST=0.0.0.0`. Hast du mit `pnpm start` gestartet, trag zuerst `HOST=0.0.0.0` in der `.env` ein.
- **Netzwerk.** Beide Geräte müssen im selben WLAN sein, und keine Firewall darf den Port blockieren. Der Standard-Port ist `7860` oder dein Wert für `PORT`.
- **Anmeldung.** Richte eine ein. Gib auf dem blockierten Gerät den einmaligen Einrichtungscode aus dem Server-Log zusammen mit einem neuen Benutzernamen und Passwort ein. Unter Docker findest du den Code mit `docker logs <container> 2>&1 | grep "setup code"`. Oder richte sie unter **Settings → Advanced → Access** in einem Browser ein, der schon angemeldet ist. Auf einem Headless-Server führst du `ssh -L 7860:127.0.0.1:7860 user@server` aus, öffnest `http://localhost:7860` und nutzt **Settings** (Einstellungen). Siehe [Fernzugriff](REMOTE_ACCESS.md#option-1-login-recommended).

Weitere Ursachen:

- **Proxy oder Tunnel auf demselben Rechner.** Ein Reverse-Proxy oder Tunnel auf demselben Rechner braucht die Anmeldung. Direkter Tailscale-Datenverkehr gilt standardmäßig als vertrauenswürdig. Tailscale Serve oder Funnel und das standardmäßige HTTP/1.0-`proxy_pass` von nginx zählen als weitergeleitet und brauchen die Anmeldung. Datenverkehr über die Docker-Bridge auf demselben Host gilt nur so lange als vertrauenswürdig, wie weder eine Anmeldung noch `IP_ALLOWLIST` oder `TRUSTED_AUTH_PROXY` gesetzt ist.
- **Eigener Name für diesen Computer.** Ein Name, der in `/etc/hosts` auf `127.0.0.1` zeigt, zählt als weitergeleitet. Verwende stattdessen `localhost`, `127.0.0.1`, den Hostnamen des Rechners oder einen `*.localhost`-Namen.
- **Too many wrong passwords.** Warte 15 Minuten und melde dich dann an. Passwort vergessen? Führ `node scripts/reset-login.mjs` im Marinara-Ordner auf dem Computer aus, auf dem Marinara läuft. Unter Docker führst du `docker exec <container> node scripts/reset-login.mjs` aus. Auch nach einem Neustart des Servers kann das Gerät es erneut versuchen.
- **Untrusted request host.** Bei einer öffentlichen Domain oder einer Domain hinter einem Reverse-Proxy trag ihren exakten Hostnamen in `TRUSTED_HOSTS` in der `.env` ein. Direkte IP-Adressen werden weiterhin akzeptiert.
- **Riskante Aktionen blockiert** (Backups, Daten löschen, Updates) von diesem Gerät aus. Öffne auf dem Server-Rechner selbst **Settings → Advanced → Admin Access** und klick auf **Make admin secret** (Admin-Secret erstellen), oder setz `ADMIN_SECRET` in der `.env` des Servers. Tipp das Geheimnis auf dem anderen Gerät unter **Admin Access** ein und klick auf **Save** (Speichern).

Siehe [Fernzugriff](REMOTE_ACCESS.md) und die [Häufigen Fragen](FAQ.md). Wurdest du nach einem Update ausgesperrt, siehe [Ausgesperrt nach dem Update](REMOTE_ACCESS.md#locked-out-after-updating).

## Speichern blockiert oder Einstellungen bleiben nicht erhalten

Ein Speichervorgang scheint zu klappen, ist nach dem Neuladen aber wieder rückgängig gemacht. Der Schutz vor Cross-Site-Angriffen (CSRF) blockiert ihn, weil er dieser Browser-Adresse nicht vertraut. Du siehst ein rotes Banner, das warnt, dass Speichervorgänge stillschweigend fehlschlagen, oder eine Toast-Meldung mit dem Titel **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** oder **Save blocked: origin not trusted**.

Loopback, private Netzwerkadressen, Tailscale und die Docker-Bridge gelten automatisch als vertrauenswürdig. Das Problem tritt also meist bei einer öffentlichen IP-Adresse oder einem Domainnamen auf. Trag die Adresse in `CSRF_TRUSTED_ORIGINS` in der `.env` ein, mehrere durch Kommas getrennt. Das Banner hat eine Schaltfläche **Copy** (Kopieren), die die Zeile fertig ausfüllt. Ein Neustart ist nicht nötig.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## Fehler bei Verbindung und Generierung

Fehler bei der Generierung erscheinen als Toast-Meldung am unteren Bildschirmrand. Die Meldung nennt den Grund und bleibt lange genug stehen, um sie zu kopieren.

| Meldung oder Symptom | Lösung |
| --- | --- |
| **No API connection configured for this chat** | Der Chat hat kein Konto. Füg unter **Connections** eines hinzu und wähl es dann für den Chat aus. Siehe [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md). |
| Das Modell akzeptiert einen Parameter nicht | Öffne **Chat Settings → Advanced Parameters** und schalte den Schalter neben dem Parameter aus, den die Toast-Meldung nennt. |
| Das Modell verlangt einen Parameter | Schalte den Schalter dieses Parameters ein. |
| **This model's chat template needs user and assistant messages to take turns** | Manche lokalen Modelle, etwa Mistral-basierte Modelle unter llama.cpp, brauchen abwechselnde Nachrichten. Marinara führt aufeinanderfolgende Nachrichten zusammen und versucht es einmal erneut. Bleibt der Fehler, stell **Post-Processing Messages** (Nachbearbeitung der Nachrichten) unter **Chat Settings → Advanced Parameters** auf **Single User Message** (eine einzige Nutzernachricht) oder betreib das Modell mit einer weniger strengen Chat-Vorlage. |
| **The AI returned an empty response. Try sending your message again.** | Schick die Nachricht noch einmal ab. Passiert das wieder, probier ein anderes Modell oder Konto. |
| **A generation is already in progress for this chat** | Eine Antwort wird noch gestreamt. Warte oder klick auf **Stop** und versuch es dann erneut. |
| **No connections are marked for the random pool** | Das zufällige Routing ist eingeschaltet, aber kein Konto ist im Pool. Füg eines hinzu oder schalte das zufällige Routing aus. |
| Jede Nachricht scheitert mit einem Netzwerkfehler, und dein Computer erreicht das Internet nur über einen Proxy | Teile Marinara den Proxy mit. Siehe [Ausgehender HTTP-Proxy](CONFIGURATION.md#outbound-http-proxy). |

## Nach einem Update

Probleme direkt nach einem Update, zuerst in einfachen Worten:

- Der Bildschirm ist leer oder sieht alt aus: Siehe [Leerer, veralteter oder alt wirkender Bildschirm](#blank-stale-or-old-looking-screen) und [Leere Seite oder JavaScript als HTML nach einem Update](#blank-page-or-javascript-served-as-html-after-an-update).
- Chats oder Presets scheinen zu fehlen: Siehe [Nach einem Update fehlen scheinbar Daten](#data-seems-missing-after-an-update). Deine Daten liegen fast immer noch auf der Festplatte.
- Chats wirken leer, nachdem du zu einer älteren Version zurückgekehrt bist: Siehe [Nach dem Wechsel zu einer älteren Version zeigen Chats keine Nachrichten](#chats-show-no-messages-after-switching-to-an-older-version).

<a id="blank-stale-or-old-looking-screen"></a>

### Leerer, veralteter oder alt wirkender Bildschirm

Der Server läuft, aber der Browser zeigt eine leere Seite, oder die App sieht nach einem Update alt aus. Der Browser hält eine zwischengespeicherte Kopie der Web-App fest.

1. Lade die Seite vollständig neu, also ohne Cache.
2. Hilft das nicht, öffne **Settings → Advanced → Updates** und klick auf **Refresh App** (App neu laden).

**Refresh App** löscht den Service Worker des Browsers (ein Hintergrundskript, das die App zwischenspeichert) und den Cache und lädt die Seite dann neu. Deine Daten bleiben unverändert, und der Server wird nicht aktualisiert. Wie du die App selbst aktualisierst, steht unter [Marinara Engine aktualisieren](UPGRADING.md).

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### Leere Seite oder JavaScript als HTML nach einem Update

Ein Fehler wie „Failed to load module script“ mit dem Typ `text/html` bedeutet, dass der Browser eine JavaScript-Datei angefordert hat, die im Build fehlt. Deine Daten zu löschen, behebt das nicht.

1. Beende den Server.
2. Führ `start.bat`, `start.sh` oder `start-termux.sh` erneut aus. Der Launcher baut unvollständige Client-Dateien neu, bevor er startet. Bei einer manuellen Installation führst du vorher `pnpm build` im Stammverzeichnis des Repositorys aus.
3. Ist die Seite weiterhin leer, lade sie ohne Cache neu oder probier ein privates Fenster.

Scheitert es weiterhin, melde die vollständige URL der fehlerhaften Datei, den HTTP-Status, den Content-Type und die erste Antwortzeile zusammen mit der Launcher-Ausgabe.

<a id="data-seems-missing-after-an-update"></a>

### Nach einem Update fehlen scheinbar Daten

Lösch keine Datenordner. Marinara legt die aktiven Daten in einem Ordner `storage` innerhalb seines Datenordners ab. Such nach `storage` in `packages/server/data/` und in `data/`. Der Server gibt beim Start aus, welche Ordner er ermittelt hat.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### Nach dem Wechsel zu einer älteren Version zeigen Chats keine Nachrichten

Neuere Marinara-Versionen speichern die Einträge jedes Chats (Nachrichten, Swipes, Erinnerungen, Bilder) in eigenen Dateien, wodurch lange Chats schneller gespeichert werden. Ältere Versionen können dieses Layout nicht lesen, deshalb wirken Chats leer. Die Daten liegen weiterhin auf der Festplatte.

Marinara verhindert offensichtliche Downgrades. Der Launcher überspringt ein Auto-Update, das auf einer inkompatiblen Version landen würde, und der Updater in der App zeigt einen Fehler, der hierher verweist.

Hast du aktualisiert und bist dann zu einer älteren Version zurückgekehrt, stell das Backup wieder her, das du vor dem Update angelegt hast. Siehe [Downgrade auf eine ältere Version](UPGRADING.md#downgrading-to-an-older-version). Die technischen Details folgen.

Deine Daten haben jetzt Speicherformat 10. Die Formate 8, 9 und 10 fügen 3D-Avatar-Einstellungen (MMD, dann GLB und FBX) und die Verknüpfung von Verbindungen mit Konten hinzu, die ältere Builds nicht sicher lesen können. Haben deine Daten Format 8 oder neuer erreicht, stell ein vollständiges Backup von vor diesem Upgrade wieder her, um einen älteren Build zu verwenden. Der folgende Befehl konvertiert nur ältere Chat-Dateilayouts. Ändere die Formatnummer nicht von Hand. Siehe [Downgrade auf eine ältere Version](UPGRADING.md#downgrading-to-an-older-version).

Bei Daten unter Format 8 konvertierst du das Chat-Dateilayout so:

1. Beende den Marinara-Server.
2. Führ im Marinara-Ordner Folgendes aus:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Wechsle zur älteren Version und starte sie.

Der Befehl baut aus den Dateien pro Chat wieder das Layout mit einer einzigen Datei auf. Nichts wird gelöscht. Die Dateien pro Chat bleiben in Ordnern namens `<table>.post-unshard-<timestamp>` erhalten, und vorhandene `.pre-shard`-Originale bleiben ebenfalls. Wenn du wieder ein Upgrade machst, konvertiert Marinara deine Daten zurück.

Unter Docker oder Podman liegen die Daten im Volume `marinara-data`. Stopp den Container, führ den folgenden Befehl aus und starte dann das ältere Image:

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Probleme bei Installation und Start

### Termux: CANNOT LINK EXECUTABLE "node"

Termux gibt `CANNOT LINK EXECUTABLE "node"` zusammen mit `cannot locate symbol` oder `library ... not found` aus. Node.js wurde ohne den Rest von Termux aktualisiert. Die Android-App bricht dann womöglich mit **Could not verify that this Marinara Android build can safely read your stored data** ab. Deine Daten sind nicht die Ursache, und die APK erneut zu installieren, behebt das nicht.

1. Führ in Termux Folgendes aus:

   ```bash
   pkg upgrade -y
   ```

2. Tipp in der Android-App auf **Install / Start Marinara**. Bei einer manuellen Installation führst du `cd "$HOME/Marinara-Engine" && ./start-termux.sh` aus.

Fragt die Aktualisierung, ob du eine Konfigurationsdatei behalten willst, drück Enter, um deine aktuelle zu behalten. Aktuelle Launcher und Android-Apps führen diese Aktualisierung selbst aus.

### Termux: zu wenig JavaScript-Heap beim Client-Build

Vite bricht mit `Reached heap limit` oder `JavaScript heap out of memory` ab. Aktualisiere Marinara und führ dann `./start-termux.sh` erneut aus. Client-Builds nutzen einen eigenen Heap von 1.536 MiB, begrenzt auf die Hälfte des Geräte-RAMs, aber nie unter 1.280 MiB. Ein Heap-Limit, das du in `NODE_OPTIONS` gesetzt hast, hat Vorrang, also entfern eine alte Vorgabe von 1.024 MiB. Schließ andere Apps, bevor du es erneut versuchst. Auf Handys mit weniger als etwa 3 GB RAM kann der Arbeitsspeicher trotzdem ausgehen. Lösch weder deine Chats noch dein Profil, um einen Buildfehler zu beheben.

### Desktop: zu wenig JavaScript-Heap bei der Typprüfung des Clients

Der Build bricht ab und meldet `The client type-check needs about 2.5 GiB of Node.js heap`. Das Limit in deinen `NODE_OPTIONS` ist zu klein, und der Build behält ein von dir gesetztes Limit bei. Erhöhe `--max-old-space-size` auf 2560 oder mehr. Enthält `NODE_OPTIONS` die Option `--max-old-space-size-percentage`, erhöhe stattdessen diese, denn sie hat Vorrang vor der anderen. Oder entfern beide Optionen. Führ den Launcher danach erneut aus. Deine Daten bleiben unberührt.

### Termux: fehlende Mehrspieler-Gastdatei

Der Start meldet eine fehlende Datei `packages/client/dist/multiplayer/guest.js`. Aktualisiere Marinara und führ `./start-termux.sh` erneut aus. Das Skript führt den vollständigen Client-Build aus. Den Mehrspielermodus musst du dafür nicht einschalten.

### Termux: Der Server beendet sich beim Öffnen von Marinara, oder Sharp lässt sich nicht laden

Sharp ist die Bildbibliothek, die Marinara für Vorschaubilder und Sprites nutzt. Unter Android läuft sie über einen WebAssembly-Ersatz. Aktualisiere Marinara und lass den Launcher die Abhängigkeiten neu installieren. Beendet sich der Server, bevor du aktualisieren kannst, reparier die Installation von Hand in Termux:

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Deine Chats und Einstellungen bleiben unberührt. Lässt sich Sharp weiterhin nicht laden, läuft Marinara mit abgeschalteter Bildverarbeitung weiter. Vorhandene Vorschaubilder werden weiter angezeigt, für neue wird das Bild in voller Größe verwendet, und die Sprite-Generierung sowie die eingebaute Hintergrundentfernung stehen nicht zur Verfügung. Ersetze Sharp nicht durch eine andere Version. Heb die vollständige Fehlerausgabe für eine Meldung auf.

<a id="browser-opens-before-startup-finishes"></a>

### Der Browser öffnet sich vor Abschluss des Starts

Aktualisiere Marinara und starte es über den Launcher neu. Er öffnet den Browser erst, wenn der Server meldet, dass er bereit ist. Schlägt der Start fehl, öffnet sich kein Tab, also bewahre den Terminalfehler auf. Willst du die App selbst öffnen, setz `AUTO_OPEN_BROWSER=false`.

### Windows: EPERM- oder Corepack-Signaturfehler beim Installieren von pnpm

pnpm ist der Paketmanager, mit dem Marinara seinen Code installiert. `EPERM: operation not permitted` oder ein Corepack-Signaturfehler bedeutet, dass Corepack nicht in den Node-Installationsordner schreiben konnte. Probier eine dieser Lösungen und führ den Launcher danach erneut aus:

1. Klick mit der rechten Maustaste auf dein Terminal, wähl **Run as administrator** (Als Administrator ausführen) und führ den Launcher aus.
2. Installier pnpm selbst: `npm install -g pnpm@12.15.0`
3. Aktualisiere Corepack in einem Administrator-Terminal: `npm install -g corepack`

### pnpm-Versionsfehler oder `'pnpm' is not recognized`

Marinara verwendet pnpm 12.15.0. Der Launcher holt die passende Version für dich, und eine ältere globale pnpm-Version musst du vorher nicht ersetzen. Aktualisiere Marinara (mit `git pull` in seinem Ordner, falls der Launcher es nicht kann) und führ den Launcher dann erneut aus. Scheitert es weiterhin, installier genau diese Version und starte den Launcher erneut:

```bash
npm install -g pnpm@12.15.0
```

### Linux: ERR_PNPM_ENAMETOOLONG bei der Installation

Eine ältere Installation hat überlange Ordnerpfade hinterlassen. Führ im Marinara-Ordner Folgendes aus:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Führ danach `./start.sh` erneut aus. Bei einer manuellen Installation führst du `pnpm install` aus.

### Installation meldet „Ignored build scripts: @google/genai“

Der Hinweis ist harmlos. Führ nicht `pnpm approve-builds` aus, denn das ändert eine Datei, die Marinara versioniert. Erscheint der Hinweis nach einem Update weiterhin, lösch `node_modules/.modules.yaml` im Marinara-Ordner und führ den Launcher erneut aus.

### ERR_PNPM_TRUST_DOWNGRADE bei der Installation

Fast immer steckt eine halbfertige Installation dahinter. Führ den Launcher erneut aus. Bei einer manuellen Installation führst du im Marinara-Ordner diesen Befehl aus:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Probleme mit dem eingebauten Modell

Das **Built-in model** (eingebautes Modell) läuft ohne API-Key auf deinem Computer. Manche Fehlermeldungen nennen es Sidecar. Die Einrichtung beschreibt [Eingebautes Modell einrichten](connections/local-model.md).

- **Sidecar runtime install is disabled.** Auf deinem eigenen Computer setzt du `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in der `.env`. Von einem anderen Gerät aus speicherst du zuerst dein Admin-Secret unter **Settings → Advanced → Admin Access**.
- **Modell-Download oder Einrichtung scheitert von einem anderen Gerät aus** (über eine Netzwerkadresse oder Docker). Dafür kann ebenfalls das Admin-Secret nötig sein. Auf deinem eigenen Computer nicht.
- **Abweichende Größe oder SHA-256-Prüfsumme** bei einer mitgelieferten Datei von llama.cpp, MLX oder uv. Marinara hat die Datei abgelehnt, bevor sie verwendet wurde. Aktualisiere Marinara oder installier es neu und versuch es erneut. Entpack die Datei nicht, bearbeite sie nicht und umgeh die Prüfung nicht.

## Gedächtnis und Zusammenfassungen

### Memory Recall erinnert sich an nichts

**Memory Recall** durchsucht frühere Nachrichten und fügt die passendsten wieder in den Prompt ein.

1. Öffne **Chat Settings → Memory Recall** und prüf, ob **Enable Memory Recall** eingeschaltet ist.
2. Öffne **Access memories for this chat**. Sieh dir unter **Memories for This Chat** den Status jedes Abschnitts an.
3. **Waiting for vector** bedeutet, dass die Erinnerung noch verarbeitet wird. Warte und schreib dann weiter.
4. **Embedding unavailable** bedeutet, dass keine Embedding-Quelle funktioniert. Richte ein Embedding-Konto ein oder lass das eingebaute Modell laden. Soll eine Quelle für jeden Chat gelten, wähl sie unter **Embeddings** im Bereich **Defaults** (Standardwerte) von **Connections** aus.

Eine Erinnerung entsteht erst nach mindestens 5 neuen Nachrichten. Recall zeigt nur Erinnerungen, die eng zu deiner neuen Nachricht passen, und kann deshalb nichts liefern, obwohl Erinnerungen vorhanden sind.

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory meldet Szenen mit Handlungsbedarf

Ein ruhig leuchtender Punkt auf der Schaltfläche **Chat Settings** oder ein Hinweis, dass Advanced Memory Probleme gefunden hat, bedeutet: Manche Szenenerinnerungen sind unklar, veraltet oder fehlen.

1. Öffne **Chat Settings → Memory Recall** oder klick im Hinweis auf **Fix** (Beheben).
2. Klick auf **Fix**. Fix repariert mit dem Hilfsmodell jede Szene, die sich reparieren lässt, und ändert nie Zusammenfassungen, die du bearbeitet hast.
3. Wähl jede Szenennummer unter **need your review** aus, prüf ihren Text und ihre Charaktere in **Access memories for this chat** und klick auf **Save correction** (Korrektur speichern).

Bricht **Fix** mit einem Fehler ab, prüf das Konto des Hilfsmodells und klick dann auf **Resume processing** (Verarbeitung fortsetzen) oder erneut auf **Fix**. Siehe [Gedächtnisprobleme beheben](agents/memory.md#fixing-memory-problems).

### Es entstehen keine Zusammenfassungen

Zusammenfassungen brauchen ein funktionierendes Konto für Text.

- Roleplay: Öffne **Chat Settings → Chat Summary**, prüf, ob ein Konto eingetragen ist, und hol mit **Backfill Summary** einen älteren Chat nach.
- Conversation: Öffne **Automatic Summarization** und wiederhol mit **Backfill** die fehlgeschlagenen Tage.
- Verlangt dein Chat eine Freigabe für Schreibzugriffe von Agenten, wartet eine KI-Zusammenfassung auf deine Prüfung.
- Eine Zusammenfassung, die immer wieder scheitert, etwa wegen eines falschen API-Keys, wird später erneut versucht. Reparier das Konto und nutz dann **Backfill**.

## Probleme mit herunterladbaren Agenten

- **Katalog im Agent Organizer nicht verfügbar.** Der Computer, auf dem der Server läuft, und nicht nur dein Browser, muss den Katalog [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) über HTTPS erreichen. Installierte Agenten funktionieren offline weiter. Stell die Verbindung wieder her und klick dann auf **Refresh** (Aktualisieren) oder **Try again** (erneut versuchen).
- **Eine installierte Karte oder ein installierter Anruf erscheint nicht.** Beende Marinara vollständig und starte es erneut. Diese Pakete bleiben bis zum nächsten Start im Zustand **Restart required**. Conversation-Spiele werden sofort aktiv. Ist die Installation fehlgeschlagen, lade den Katalog neu und prüf, ob das Spiel als bereit angezeigt wird. Ein Spiel unter **Commands** in den Einstellungen eines Chats hinzuzufügen, ist nur nötig, damit Charaktere es selbst starten können, nicht für seinen manuellen Slash-Befehl.
- **Die erste Paket-Migration lässt sich nicht abschließen.** Lösch weder `data/capability-packages` noch deine Chat-Daten. Marinara versucht es beim nächsten Start erneut, und deine Auswahl in den Chats bleibt gespeichert.
- **`data/capability-runtime-snapshots` oder `data/capability-packages/versions` ist groß.** Aufräumen ist nicht nötig. Marinara entfernt alte Kopien beim Start und behält von jedem Agenten die aktuelle und die vorherige Version.
- **Ein Paket-Download wird abgelehnt.** Prüfsumme, Dateiliste, Marinara-Versionsbereich oder Archivpfade passen nicht zum offiziellen Katalog. Aktualisiere Marinara, lade den Katalog neu und versuch es erneut. Entpack ein Artefakt nicht von Hand in den Datenordner.
- **Updates.** Agent-Updates werden nie beim Start eingespielt. Marinara fragt zuerst nach. **Not now** (Jetzt nicht) behält die installierte Version, und **Update** bleibt unter **Agents → Agent Organizer** verfügbar. Ein fehlgeschlagenes Update lässt die installierte Version an ihrem Platz. Eine Server-Laufzeit, die ihre Startprüfung nicht besteht, fällt auf die vorherige Version zurück.

## Probleme mit dem Card Browser

Der **Card Browser** durchsucht öffentliche Charakterseiten. Öffne ihn mit der Schaltfläche **Download** (Herunterladen) oben im Panel **Characters** (Charaktere) oder **Personas**.

- **JannyAI zeigt eine Cloudflare-Sperre.** Besuch die JannyAI-Seite einmal im selben Browser, um die Prüfung zu bestehen, und versuch es dann erneut.
- **Der Pygmalion-Login funktioniert nach einem Neustart nicht mehr.** Das ist normal. Dieser Login liegt nur im Arbeitsspeicher des Servers. Öffne das Login-Fenster und füg dein Token erneut ein.
- **CharacterTavern zeigt einen Hinweis statt Ergebnissen.** Das ist normal. Die neue Website bietet den Zugang, den Marinara genutzt hat, nicht mehr an. Lade die Karte von character-tavern.com herunter und importier die Datei.

## Probleme bei der Medien-Generierung

### Die Hintergrundbereinigung beim Sprite kommt mit einer komplexen Szene nicht klar

Generierte Sprites nutzen normalerweise echte Transparenz oder einen einfarbigen Hintergrund, den Marinara entfernt. Ein fotografierter Raum, detailreiche Kulissen, kräftige Schatten oder Farben, die dem Hintergrund gleichen, brauchen womöglich die optionale KI-Rückfalllösung:

```bash
pnpm backgroundremover:install
```

Starte Marinara danach neu und klick im Fenster für die Sprite-Generierung auf **Reapply Cleanup**. Marinara versucht zuerst die eingebaute Bereinigung und greift nur dann zum KI-Modell, wenn der Rand nicht gleichmäßig aussieht. Falls die Installation scheitert:

- Prüf, ob Python 3.9 bis 3.11 installiert ist. Neuere Versionen können langsame native Builds erzwingen.
- Führ `pnpm backgroundremover:reinstall` aus.
- Willst du die KI-Rückfalllösung während der Fehlersuche überspringen, setz `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` in der `.env`.

### Storyboards im Game Mode oder Roleplay erscheinen nicht

Storyboards machen aus fertiger Erzählung Keyframe-Bilder und optional Clips. Siehe die [Anleitung zum Storyboard-Agenten](game/storyboard.md) und [Game Mode: Erste Schritte](game/getting-started.md).

- Installier **Storyboard** über **Agents → Agent Organizer** und schalte dann **Enable Agents** (Agenten aktivieren) und **Enable Storyboards** (Storyboards aktivieren) für den Chat ein.
- Keyframes brauchen ein Bildkonto. Clips brauchen zusätzlich ein Videokonto.
- Game, automatisch: Öffne **Chat Settings → Agents → Storyboards** und prüf, ob **Automatic Storyboard Illustrations** eingeschaltet ist. Für Clips schaltest du **Automatic Storyboard Animations** ein.
- Manuelles Szenenvideo: Öffne **Chat Settings → Gallery**, generier ein Bild oder lade eines hoch und nutz dann **Video** oder **Animate**. Sieh im Tab **Videos** nach.
- Roleplay: Füg den Agenten **Storyboard** zum Chat hinzu. Wähl **Still images** oder **Animations**, leg **Messages per episode** fest und wähl das Bildkonto. **Manual only** startet über **Create storyboard** im Bereich **Gallery** der **Chat Settings**.
- Funktioniert ein eigener Prompt besser, wenn alle Charaktere zusammengefasst sind, schalte **Use NovelAI Character Prompts** aus.
- Langsame Dienste können in ein Zeitlimit laufen. Erhöh `IMAGE_GEN_TIMEOUT_MS` oder `VIDEO_GEN_TIMEOUT_MS` in der `.env` und starte Marinara dann neu.
- `Outbound response exceeded 31457280 bytes`: Eine Bildantwort über 30 MiB scheitert standardmäßig. ComfyUI-Dateien, die den Workflow und die Referenzbilder einbetten, können diese Größe erreichen. Erhöh `IMAGE_GEN_MAX_RESPONSE_BYTES` in der `.env` und starte neu, oder schalte die Metadaten in ComfyUI aus.

### Die Weltgenerierung im Game Mode zeigt einen JSON-Fehler

Liefert das Modell fehlerhaftes JSON (strukturierten Text), öffnet Marinara das Fenster **Repair JSON** (JSON reparieren), statt den Zug zu verwerfen.

1. Korrigier Klammern, Kommas oder Felder im Editor. Sobald sich der Text einlesen lässt, zeigt das Banner **JSON is valid.**
2. Klick auf **Format** (formatieren), um die Darstellung aufzuräumen.
3. Klick auf **Apply Repaired JSON**, um es zu verwenden, ohne die Antwort neu zu generieren.

## Stimme, Anrufe und TTS

- **Charaktere sprechen in einem Anruf nicht.** Text to Speech (Sprachausgabe) ist nicht eingerichtet. Öffne **Connections → Text to Speech**, schalte es ein, wähl eine Quelle, trag deinen Key ein, such eine Stimme aus und speichere. Ein Charakter ohne Stimme erscheint nur als Text.
- **Die Sprachausgabe bricht mit „No audio after N s“ ab.** Dein Sprachserver ist langsamer, als Marinara wartet, was bei einem lokalen Server auf einem Laptop häufig vorkommt. `N` ist dein aktuelles Zeitlimit. Erhöh **Request timeout (seconds)** unter **Connections → Text to Speech** oder in dem Audio-Konto, das die Meldung nennt. Siehe [Zeitlimit für Anfragen](media/tts-setup.md#request-timeout).
- **Das Mikrofon funktioniert nicht.** Installier **Calls** über **Agents → Agent Organizer**. Öffne dann **Connections → Speech to text**, such unter **On this device** (auf diesem Gerät) nach **Local speech model**, wähl ein Whisper-Modell und klick auf **Download Whisper**. Firefox braucht das, weil ihm die Spracherkennung im Browser fehlt. Wenn du Calls deinstallierst, werden seine Whisper-Modelle gelöscht. Du kannst auch einen eigenen Server nutzen: Siehe [Einen eigenen Speech-to-Text-Server nutzen](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** Das Lite-Image kann das lokale Sprachmodell nicht ausführen. Nutz eine vollständige Installation.

### Der Spotify-Login des Music DJ scheitert bei einer Remote- oder Netzwerkinstallation

Der Spotify-Modus des Music-DJ-Agenten nutzt OAuth, eine Login-Übergabe, bei der Spotify dich an eine Rückrufadresse (die Redirect-URI) zurückschickt. Spotify akzeptiert nur `https://`-Adressen oder `http://127.0.0.1` und lehnt einfache Netzwerk-IP-Adressen ab.

- Unter localhost zeigt der Editor eine `127.0.0.1`-Rückrufadresse. Trag sie bei Spotify ein.
- Über HTTPS zeigt der Editor deine HTTPS-Rückrufadresse. Trag diese ein.
- Endet HTTPS vorgelagert und der Host passt nicht, setz `SPOTIFY_REDIRECT_URI` in der `.env` auf deine öffentliche Rückrufadresse.
- Bei einer Netzwerkinstallation über reines HTTP kann das Popup nicht laden, aber seine Adressleiste enthält einen gültigen Code. Kopier die vollständige URL, klapp unter der Connect-Schaltfläche **Browser couldn't reach the callback?** auf und füg sie dort ein. Die URL ist 10 Minuten lang gültig.

Am saubersten löst du das, indem du Marinara über HTTPS auslieferst.

## Speicher und Daten

### Der Server kehrt nach Restart Server nicht zurück

Starte Marinara mit `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` oder `pnpm start`. So bleibt der Server an seinen Launcher gebunden, und dieser startet einen Ersatz, sobald der alte Prozess beendet ist. Ein Neustart aus der App schließt verbleibende Verbindungen nach vier Sekunden und erzwingt nach acht Sekunden das Beenden. Ein erzwungenes Beenden kann ausstehende Schreibvorgänge unterbrechen. Direkte `node`-Starts und Watcher im Entwicklungsbetrieb werden nicht ersetzt: Stopp sie und starte sie selbst neu. Docker nutzt seine Container-Neustartrichtlinie. Drück unter Windows <kbd>Ctrl</kbd>+<kbd>C</kbd> in der Launcher-Konsole und warte auf **Shutdown complete**, bevor du sie schließt.

Starte keinen zweiten Server mit demselben Datenordner, solange der erste noch läuft. Stopp zuerst einen übrig gebliebenen Prozess.

### Beim Start heißt es, ein anderer Prozess verwende möglicherweise das Datenverzeichnis

Nur ein Server darf in einen lokalen Datenordner schreiben. Meldet der Start **Another Marinara Engine process ... may be using** für den Ordner, beende den anderen Marinara-Prozess und starte erneut.

Nach einem Absturz oder einem verschobenen Docker-Volume kann der Start **The storage writer lease ... is incomplete or invalid** melden oder einen Prozess nennen, der nicht mehr existiert.

1. Prüf, dass jeder Marinara-Prozess und jeder Container, der diesen Datenordner nutzt, beendet ist.
2. Entfern nur den in der Fehlermeldung genannten Ordner `.writer-lease`.
3. Starte Marinara neu. Entfern weder den Ordner `storage` noch Tabellendateien.

Unter Linux, Android, in Containern und unter Windows räumt Marinara eine Lease, die ein abgestürzter Prozess hinterlassen hat, von selbst ab, wenn der Datenordner auf einem lokalen Laufwerk liegt. Der manuelle Schritt ist die Notlösung für Netzwerk- oder gemeinsam genutzten Speicher, Wechsellaufwerke und (unter Windows) einen Computer, der nach dem Absturz umbenannt wurde.

### Backup oder Export liefert 403

Sitzungen auf demselben Computer können ohne Admin-Secret Backups anlegen. Anfragen von einem anderen Gerät, über eine Netzwerkadresse, aus Docker oder über einen Proxy oder Tunnel auf demselben Computer brauchen eines. Erstelle es auf dem Server-Rechner selbst unter **Settings → Advanced → Admin Access** oder setz `ADMIN_SECRET` auf dem Server, und speichere denselben Wert dann auf dem anderen Gerät unter **Admin Access**. Soll auch Loopback das Geheimnis verlangen, setz `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. Ist `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` gesetzt, bekommen weitergeleitete Besucher die lokale Ausnahme. Lass diese Option bei einem öffentlichen Proxy oder Tunnel eingeschaltet.

### Import meldet, die Datei sei kein lesbares ZIP-Archiv

Marinara liest `.charx`-Karten, `.marinara`-Pakete, Agent-Pakete und eigene Agent-Repositorys als ZIP-Archive. Ein beschädigtes Archiv oder eines, dessen Inhalt nicht zu seiner Dateiliste passt, lehnt Marinara mit **The file is not a readable ZIP archive** (oder **Could not read .marinara package**) ab. Meist steckt ein unvollständiger Download dahinter: Lade die Datei erneut herunter. Hast du das Archiv selbst erstellt, erstell es neu, mit der Komprimieren-Funktion deines Systems, mit `zip` oder mit 7-Zip.

**Package contains too many files** bedeutet, dass ein Agent-Paket oder Repository mehr als 8.192 Dateien enthält. **.marinara package has too many entries** bedeutet, dass ein `.marinara`-Paket mehr als 8 Einträge enthält. Entfern die überzähligen Dateien und versuch es erneut.

### Conversation-Zeitpläne oder Noodle nutzen die falsche Zeitzone oder zeigen `Etc/Unknown`

Für Conversation-Zeitpläne wählst du **Schedule timezone** in den Chat Settings eines Conversation-Chats oder im Zeitplan-Editor eines Charakters. **Use device** setzt sie zurück.

Für Noodle oder andere Server-Aufgaben entfernst du eine leere Zeile `TZ=` aus der `.env` und startest Marinara neu, damit es die Zeitzone des Hosts verwendet. Willst du eine festlegen, nutz einen IANA-Namen wie `TZ=Europe/Warsaw`.

## Probleme unter Android

### Die Android-App hängt bei Connecting oder Waiting for Server

Die Android-App ist eine schlanke Hülle um Termux, eine Linux-Terminal-App für Android, in der der eigentliche Marinara-Server läuft.

1. Tipp auf **Install / Start Marinara**.
2. Fragt Android, ob Termux installiert werden soll, bestätige die Abfragen.
3. Fragt Android, ob Befehle in Termux ausgeführt werden dürfen, erlaub es.
4. Warte, bis der Launcher den Server gestartet hat, und kehr dann zur App zurück.

Die App erzeugt ihre privaten localhost-Zugangsdaten und meldet sich automatisch an. Du fügst nie einen Geheimwert ein. Füg weder `null` noch `http://null` oder den Geheimwert der APK zu `CSRF_TRUSTED_ORIGINS` hinzu.

Prüf außerdem, ob App und Termux denselben Port nutzen. Der Standard ist `7860`. Hast du die App mit einem anderen Port gebaut, setz den passenden `PORT` in der `.env` von Termux.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android-localhost öffnet die Anmeldeseite oder gibt 401/503 zurück

Von der APK verwaltete Termux-Installationen schützen localhost mit einem privaten Geheimwert pro Installation, und die App meldet sich automatisch an. Erscheint die Anmeldeseite in der App, installier die [neueste APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), tipp erneut auf **Install / Start Marinara** und kehr zurück, wenn Termux fertig ist.

Ein Fehler, der den Ursprung `null` nennt, bedeutet, dass APK und Server ein älteres Paar bilden. Das lässt sich nicht durch Bearbeiten der `.env` beheben. Aktualisiere die APK und Marinara.

Um einen Browser auf demselben Handy zu öffnen, tipp im Android-Launcher auf **Open in browser** (im Browser öffnen) und dann auf **Retry connection** (Verbindung erneut versuchen). Öffne ihn nach einem Serverneustart oder einer abgelaufenen Sitzung auf diesem Weg erneut. Zurück zum Launcher kommst du über **Settings → General → App Behavior → Open Android launcher (app or browser)**.

Ältere APKs melden sich unter `/android-login` mit dem Wert aus `cat ~/.marinara-engine/android-secret` an. Ein Browser-Link funktioniert einmal und läuft nach einer Minute ab, also öffne über den Launcher einen neuen.

- **401:** Der eingefügte Geheimwert oder die Challenge wurde abgelehnt. Lade `/android-login` neu und füg den aktuellen Wert ein.
- **503:** Der Server hat einen fehlerhaften Geheimwert erhalten. Starte mit `./start-termux.sh` neu. Meldet der Launcher, seine Geheimwertdatei sei ungültig oder leer, tipp in der App auf **Install / Start Marinara**, damit sie neu angelegt wird.

Der lokale Befehl `mari` liest dieselbe Datei automatisch. Halte den Geheimwert aus Screenshots und Problemberichten heraus.

### Das Android-Update bricht mit Exit-Status 134 ab

Android ist während eines Build-Schritts der Arbeitsspeicher ausgegangen. Führ den Launcher erneut aus:

```bash
./start-termux.sh
```

Bricht es erneut ab, schließ andere Apps, öffne Termux neu und versuch es noch einmal.

### Termux schließt sich oder startet neu, während Marinara läuft

Der Launcher fordert einen Wake-Lock an, solange der Server läuft, und speichert jede Sitzung unter `~/.marinara-engine/logs/`. Füg nach einem unerwarteten Neustart die neueste Datei `server-*.log` deinem Bericht bei. Endet sie ohne Marinara- oder Node-Fehler, hat höchstwahrscheinlich Android oder der Hersteller des Handys Termux beendet.

Erlaub Termux in den Android-Einstellungen die Ausführung im Hintergrund und nimm es von der Akkuoptimierung aus. `termux-wake-lock` und `termux-wake-unlock` gehören zu jeder normalen Termux-Installation. Diese Einstellungen verhindern nicht jeden herstellerspezifischen Prozessabbruch.

### Marinara reagiert nicht mehr, bis Termux in den Vordergrund geholt wird

Chats bleiben bei „Opening chat...“ hängen, die App meldet **Server unreachable**, die Kopie aus Support Diagnostics zeigt für die Server-Felder **Unreachable (request timed out)**, und alles läuft sofort wieder, sobald du Termux öffnest. Androids Cached-App-Freezer hat den Termux-Prozess angehalten. Das Handy nimmt die Verbindung an, aber der eingefrorene Server antwortet nie. Ein Wake-Lock verhindert das nicht. Das Sitzungslog zeigt für die eingefrorene Zeit eine Lücke in den Zeitstempeln, keinen Fehler.

Nimm Termux von der Akkuoptimierung aus, erlaub ihm die Aktivität im Hintergrund, sperr Termux in der Übersicht der zuletzt genutzten Apps, falls dein Handy das unterstützt, und lass seine Benachrichtigung sichtbar. Friert es weiterhin ein, lass Termux im Vordergrund oder den Bildschirm an, solange du Marinara nutzt.

### Beim Android-Update geht während der Installation der Abhängigkeiten der Speicherplatz aus

Ein großer temporärer Platzbedarf bei einem Update kommt meist vom Abhängigkeits-Store von pnpm, nach mehreren Releases oder einer abgebrochenen Neuinstallation. Der aktuelle Launcher räumt alte Pakete weg, und Updates in der App installieren nur Android-Pakete. Hat ein älterer Launcher das Gerät vollgeschrieben, gib den Platz frei und versuch es erneut:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Lösch weder `data` noch `storage` oder `marinara-engine.db`, denn dort können deine Chats und Einstellungen liegen. Bricht es weiterhin ab, kopier die Zeilen ab `Installing dependencies` und nenn in deinem Bericht den freien Speicherplatz und den Arbeitsspeicher des Handys.

### Das Update in der App scheitert beim Wechsel zwischen Stable und Staging unter Android

Ein Kanalwechsel erzwingt eine nahezu vollständige Neuinstallation der Abhängigkeiten, was auf dem Speicher von Termux langsam ist. Der Updater in der App räumt jedem Schritt mehr Zeit ein. Scheitert ein Update trotzdem, nennt die Fehlermeldung den fehlgeschlagenen Schritt und zeigt das Ende seiner Ausgabe. Ein echter Fehler bei Abhängigkeiten oder Lockfile erscheint dort. Du kannst auch von Hand in Termux aktualisieren, mit dem Befehl aus dem Hinweis der Fehlermeldung, oder vorher Speicherplatz freigeben:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Probleme mit Docker

### Container meldet „permission denied“ bei einem Volume-Mount

- Benanntes Volume nach einem Update: Führ `docker compose pull && docker compose up -d` aus. Das offizielle Image repariert die Besitzrechte beim Start.
- Bind-Mount: Mach den Host-Ordner für Benutzer- und Gruppen-ID `1000` beschreibbar oder nutz ein benanntes Volume.
- SELinux-Systeme wie Fedora oder RHEL: Häng das Suffix `:Z` an den Volume-Mount.

### Der Lite-Container stürzt auf einem Raspberry Pi 4 ab

Startet das Lite-Image auf einem Raspberry Pi 4 oder einem ähnlichen ARM-Gerät bei jeder KI-Anfrage neu, sieh dir den Exit-Code an. Exit 132 oder SIGILL (die CPU ist auf einen Befehl gestoßen, den sie nicht ausführen kann) deutet auf ein bekanntes Upstream-Problem im Node-Build des Lite-Images auf manchen ARM-Chips hin. Nutz auf diesem Gerät das reguläre Image.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Eine Server-Erweiterung meldet, es gebe keine unterstützte Sandbox

Server-Erweiterungen und die rohen Shell-Befehle von Professor Mari laufen nur mit macOS Seatbelt oder Linux Bubblewrap. Installier `bwrap` auf einem nativen Linux-Host und starte Marinara neu. Das offizielle Docker-Image enthält Bubblewrap, aber der Standard-Container kann dessen verschachtelte Namespaces nicht erzeugen, deshalb lässt Marinara diese Funktionen ausgeschaltet.

Akzeptierst du breitere Containerrechte, speichere Folgendes als `docker-compose.override.yml` neben `docker-compose.yml` und erstelle den Container dann neu:

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Warnung:** Den Server als root mit `SYS_ADMIN` und ohne AppArmor-Profil auszuführen, ist eine weitreichende Rechteausweitung. Aktiviere das nicht nur, um diese Meldung loszuwerden.

Das Standard-Seccomp-Profil von Docker passt sich an hinzugefügte Fähigkeiten an, daher solltest du auf aktuellen Docker-Versionen kein `seccomp=unconfined` brauchen.

Windows, Android und andere nicht unterstützte Hosts verweigern die Ausführung von Server-Erweiterungen. Browser-Erweiterungen laufen weiterhin in ihrer Sandbox.

## Probleme mit Erweiterungen

### External Extensions fehlt unter Addons

Der Abschnitt bleibt verborgen, bis beide Sicherheitssperren offen sind.

1. Setz `ENABLE_EXTERNAL_EXTENSIONS=true` in der `.env` des Hosts.
2. Warte einen Moment, öffne dann **Settings → Advanced → Danger Zone**, scroll unter die Bedienelemente zum Löschen von Daten und schalte **Allow third-party extension imports** ein.

Lässt sich der Schalter nicht bedienen, steht das Host-Flag noch auf false oder die App hat die Änderung noch nicht bemerkt. Prüf, ob du die aktive `.env` bearbeitet hast, wie unter [Server-Konfiguration](CONFIGURATION.md) beschrieben. Unter Docker ist das normalerweise `/app/data/.env`.

Solange eine der beiden Sicherheitssperren geschlossen ist, erscheinen Einträge externer Erweiterungen nicht und können nicht laufen. Öffnest du die Sicherheitssperren wieder, werden sie dadurch nicht wieder eingeschaltet.

### Eine importierte Browser-Erweiterung erscheint, funktioniert aber nicht

Öffne sie unter **Settings → Addons → External Extensions** und lies **Requested access** (angeforderter Zugriff). Ältere Pakete im Format `marinara.extension` v1 ohne Capabilities-Angabe zeigen **Full page access** (Vollzugriff auf die Seite). Bestätige nur genau den Hash, den du geprüft hast und dem du vertraust.

Ein Paket, das erneut mit einer leeren Capabilities-Liste exportiert wurde, gilt als sichere Sandbox-Erweiterung, und Code, der das DOM der Seite braucht, funktioniert dann nicht. Ergänze `full_page_access` nur dann in seinem Manifest, wenn du akzeptierst, dass der Code die gesamte Seite, den Browser-Speicher, Netzwerk-APIs und deine Sitzung erhält.

Bleibt nach dem Deaktivieren einer Erweiterung mit Zugriff auf die gesamte Seite ein Eintrag in der Werkzeugleiste, ein Overlay oder ein Listener zurück, lad Marinara neu. Das Aufräumen erfolgt nach bestem Bemühen, denn Seiten-Code kann Nebenwirkungen haben, die Marinara nicht verfolgt.

<a id="multiplayer-connection-or-turn-problems"></a>

## Mehrspielerprobleme bei Verbindung oder Zügen

| Symptom | Lösung |
| --- | --- |
| Bedienelemente nicht verfügbar | Trag `MULTIPLAYER_ENABLED=true` in die `.env` der richtigen Marinara-Installation ein, starte sie neu und schalte die Einstellung dann separat ein. Der native Android-Wrapper kann nicht beitreten. |
| Host nicht erreichbar | Nutz einen separaten, erreichbaren HTTPS-Raumport, eine gültige Zertifikatskette mit passendem Hostnamen und den passenden Einladungsfingerabdruck. Schalte die TLS-Prüfung nicht ab, füg vertrauenswürdigen Origins kein `null` hinzu, veröffentliche nicht die normale API und öffne keinen vom Host gelieferten Client. |
| Wartet auf Freigabe | Der Host muss dich unter Players freigeben. Vor der Freigabe siehst du keinen Verlauf. Ist die Einladung abgelaufen, bitte um eine neue. |
| Verbindung getrennt | Lass deine eigene Marinara-Installation laufen. Sie verbindet sich wieder mit demselben Host, solange die Sitzung besteht, und ungesendete Entwürfe bleiben erhalten. Nach einem Neustart trittst du erneut bei. Willst du denselben Persona-Namen behalten, bitte den Host, zuerst deinen alten Platz zu entfernen. |
| Game wartet | Öffne Players. Getrennte Spieler passen nicht automatisch. Der Host kann **Pass**, **Kick** oder **Pause** wählen. |
| Generierung unterbrochen | Reich die Runde nicht erneut ein. Der Host soll die gespeicherte Erzählung und den Zustand prüfen und den Raum dann fortsetzen oder stoppen. Der Mehrspielermodus wiederholt nie eine unklare Anfrage und wendet ihre Welteffekte nie doppelt an. |
| Befehl gesperrt oder Medien fehlen | Räume übertragen nur Text. Siehe die [Kompatibilitätstabelle](development/multiplayer.md#command-and-feature-compatibility). Installier keine Datei oder Erweiterung, die ein anderer Teilnehmer bereitstellt. |

Nenn bei der Meldung eines Verbindungsfehlers den Modus, die Plattform, die sichtbare Fehlermeldung und ob die Freigabe geklappt hat. Veröffentliche keine Einladungen, Raumpasswörter, Sitzungstokens, privaten Verläufe oder API-Keys.

## Die Installation als PWA unter Android Chrome scheitert hinter einer Anmeldung

Verwende eine HTTPS-Adresse, melde dich an und lade nach einem Marinara-Update neu. Die App fordert ihr Manifest mit Anmeldedaten an, sodass die Anmeldung eingeschaltet bleiben kann. Ist die Installation weiterhin nicht verfügbar, prüf, ob dein Proxy `/manifest.json` als JSON ausliefert und nicht als Anmeldeseite oder Fehler.

<a id="get-more-help"></a>

## Weitere Hilfe bekommen

1. Öffne **Settings → Advanced → Message Tools** und schalte den **Debug mode** ein. Er schreibt Prompt und Antwort in die Server-Konsole.
2. Notier dein Betriebssystem, deine Node.js-Version und den vollständigen Fehlertext aus der Konsole.
3. Entfern API-Keys, Zugriffstokens, Admin-Secrets und private Chat-Inhalte, bevor du etwas teilst.

Dann frag die Community:

- Lies die [offenen Issues](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Komm in den [Discord](https://discord.com/invite/KdAkTg94ME).
- Meld einen Bug in denselben GitHub-Issues, mit den oben gesammelten Details.

## Verwandte Anleitungen

- [Häufige Fragen](FAQ.md)
- [Referenz zur Server-Konfiguration](CONFIGURATION.md)
- [Fernzugriff](REMOTE_ACCESS.md)
- [Marinara Engine aktualisieren](UPGRADING.md)
- [Verbindung zu einem KI-Anbieter herstellen](connections/connecting-to-a-provider.md)
- [Eingebautes Modell einrichten](connections/local-model.md)
- [Game Mode: Erste Schritte](game/getting-started.md)
- [Überblick über die Einstellungen](settings/settings-overview.md)

<details>
<summary>Für Maintainer: gepinnte lokale Laufzeiten aktualisieren</summary>

Von GitHub erzeugte Quellcode-Archive bleiben nicht garantiert Byte für Byte gleich, selbst wenn sich der Inhalt des Commits nicht ändert. „Repariere“ eine Abweichung bei Nutzenden deshalb nie, indem du die Bytes von deren Rechner übernimmst oder die Prüfung aufweichst. Laufzeit-Eingaben werden ausschließlich in einer geprüften Engine-Änderung neu gepinnt:

1. Wähl eine unveränderliche Upstream-Revision oder ein Release-Asset und sieh die Änderungen im Upstream durch.
2. Lad das Artefakt in einen temporären Ordner herunter, notier seine exakte Byte-Anzahl und berechne seine SHA-256-Prüfsumme unabhängig davon.
3. Trag Revision, URL, Größe und Prüfsumme in `runtime-integrity-manifest.ts` ein. Für MLX erzeugst du `packages/server/src/assets/mlx-runtime-requirements.lock` aus der zugehörigen `.in`-Datei neu, mit der gepinnten uv-Version auf Apple Silicon und Python 3.12. Prüf jede geänderte Abhängigkeit und aktualisier `requirementsLockSha256`.
4. Führ `pnpm regression:runtime-integrity`, `pnpm check` und eine echte, saubere Laufzeit-Installation auf der betroffenen Plattform aus.
5. Veröffentlich das geprüfte Engine-Update, bevor du Nutzende um einen neuen Versuch bittest. Biete keine Möglichkeit an, die Prüfsumme von Hand zu übergehen.

</details>
