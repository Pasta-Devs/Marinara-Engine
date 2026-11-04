# Marinara Engine aktualisieren

Bring Marinara Engine auf eine neuere Version, such in der App nach Updates und geh zurück, wenn etwas kaputtgeht. Chats und Einstellungen bleiben bei einem Update erhalten.

## Welcher Update-Weg passt zu mir?

| So hast du installiert | So aktualisierst du |
| --- | --- |
| Windows-Installer oder `start.bat` | Schließ Marinara und öffne es wieder. Siehe [Windows](#windows). |
| macOS oder Linux | Führ `./start.sh` erneut aus. Siehe [macOS und Linux](#macos-and-linux). |
| Docker oder Podman | Hol das neue Image und starte neu. Siehe [Docker oder Podman](#docker-or-podman). |
| Android-App | Aktualisiere die APK und tipp dann auf **Install / Start Marinara**. Siehe [Android (Termux)](#android-termux). |
| iPhone oder iPad | Aktualisiere das Gerät, auf dem der Server läuft. Siehe [iPhone und iPad](#iphone-and-ipad). |

<a id="back-up-first"></a>

## Vorher ein Backup anlegen

Leg vor jedem großen Versionssprung ein Backup an, und immer dann, wenn du vielleicht zu einer älteren Version zurückkehren willst.

1. Öffne **Settings** (Einstellungen).
2. Wechsle zum Tab **Advanced** (Erweitert).
3. Such den Abschnitt **Backup & Export**.
4. Klick auf **Download Backup** (Backup herunterladen).
5. Speichere die `.zip`-Datei an einem sicheren Ort.

Während der Arbeit zeigt die Schaltfläche **Creating backup…**. Danach speichert dein Browser eine `.zip` mit deinen Daten. Wie du sie wiederherstellst, steht unter [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

## Update nach Plattform

Wähl den Abschnitt, der zu deiner Installation passt. Eine Git-Kopie ist eine Kopie, die mit dem Werkzeug Git installiert wurde. Dazu zählen der Windows-Installer und jeder `git clone`.

### Windows

Der Launcher aktualisiert Marinara, wenn du es startest.

1. Beende Marinara Engine.
2. Öffne es erneut über die Verknüpfung auf dem Desktop oder im Startmenü, oder führ `start.bat` aus.

Der Launcher holt den neuesten Code, installiert Geändertes neu, baut die App neu und startet die neue Version. Hast du den Code selbst geändert, legt er deine Änderungen beiseite und holt sie nach dem Update zurück. Gelingt das nicht, behält er deine aktuelle Version und gibt einen Hinweis aus. Vor dem Update kopiert er deine Daten, und er überspringt ein Update, das auf einer Version landen würde, die älter ist als deine Daten (siehe [Downgrade auf eine ältere Version](#downgrading-to-an-older-version)).

Um das Update einmal zu überspringen, führ `start.bat --skip-update` aus. Soll deine installierte Version über mehrere Starts hinweg bleiben, setz `AUTO_UPDATE_ENABLED=false` in der `.env` des Projekts. Das schaltet nur die automatischen Updates ab. Manuelle Befehle und **Settings → Advanced → Check for Updates** funktionieren weiterhin.

Meldet der Launcher, dass Node.js zu alt ist, installier Node.js 24 LTS (Long Term Support, die empfohlene stabile Ausgabe) und starte Marinara danach erneut. Du kannst auch den neuesten Installer von der GitHub-Releases-Seite herunterladen und ausführen.

<a id="macos-and-linux"></a>

### macOS und Linux

1. Beende Marinara Engine.
2. Starte den Launcher aus deinem Marinara-Ordner.

```bash
./start.sh
```

Der Launcher holt den neuesten Code, installiert geänderte Abhängigkeiten neu, baut die App neu und startet die neue Version. Mit `./start.sh --skip-update` überspringst du das Update einmal, mit `AUTO_UPDATE_ENABLED=false` in der `.env` schaltest du automatische Updates ab. Ist Node.js zu alt, installier Node.js 24 LTS und starte den Launcher erneut.

<a id="docker-or-podman"></a>

### Docker oder Podman

Container werden über ein neues Image aktualisiert, nicht über den Launcher. Leg ein Backup an und führ dann diesen Befehl in dem Ordner aus, in dem deine Compose-Datei liegt.

```bash
docker compose pull && docker compose up -d
```

Mit Podman nimmst du stattdessen `podman compose`. Release-Images erscheinen als `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` und `:latest`, dazu die passenden `-lite`-Tags. Ein Pull lässt deine Daten im Volume `marinara-data` unberührt. Siehe [Installation im Container](installation/containers.md).

### Android (Termux)

Termux ist die Android-App, die ein kleines Linux-System für Marinara ausführt. Der Launcher darin aktualisiert Marinara bei jedem Start.

1. Öffne Termux.
2. Starte den Launcher.

```bash
cd Marinara-Engine
./start-termux.sh
```

Der Launcher aktualisiert den Code, hebt Node.js bei Bedarf an, baut die App neu und startet den Server. Macht ein Update etwas kaputt und willst du auf deiner aktuellen Kopie bleiben, häng `--skip-update` an. Um automatische Updates abzuschalten, setz `AUTO_UPDATE_ENABLED=false` in der `.env` des Projekts.

Nutzt du die Android-App (APK), [lade die neueste APK herunter](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) und öffne sie, damit Android die App aktualisiert. Öffne danach Marinara Engine und tipp auf **Install / Start Marinara**, um die Termux-Kopie zu aktualisieren und zu starten. Ein Update fragt dich nie nach Signaturdaten oder einem Geheimwert.

<a id="iphone-and-ipad"></a>

### iPhone und iPad

Diese Geräte führen den Server nicht aus. Das Symbol auf dem Home-Bildschirm ist eine PWA, also eine Website, die auf dem Home-Bildschirm gespeichert ist und sich wie eine App öffnet.

1. Aktualisiere den Rechner, den Container-Host oder das Android-Gerät, auf dem dein Marinara-Server läuft. Nutz dafür den passenden Abschnitt oben.
2. Lad die App auf dem Home-Bildschirm oder den Safari-Tab neu.

Zeigt Safari weiterhin einen älteren Build, installier die PWA neu. Siehe [Die PWA löschen und neu installieren](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

<a id="manual-update-git-copy-no-launcher"></a>

### Manuelles Update (Git-Kopie, ohne Launcher)

Nimm diesen Weg, wenn du eine Git-Kopie mit `pnpm start` statt über den Launcher startest. Führ die Befehle im Marinara-Ordner aus.

1. Hol den neuesten stabilen Code.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Wechsle darauf.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Installier die Abhängigkeiten neu, bau die App neu und starte sie.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

Für die Staging-Version (für Testende) führst du statt der Schritte 1 und 2 diese beiden Befehle aus:

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Warnung:** Staging-Builds sind Vorab-Builds für Testende. Sichere deine Daten, bevor du sie verwendest.

## Update aus der App heraus

Marinara kann bei GitHub nach einer neueren Version suchen. Manche Installationen können das Update auch aus dem Browser einspielen.

1. Öffne **Settings**.
2. Wechsle zum Tab **Advanced**.
3. Such den Abschnitt **Updates**.

### Einen Release-Kanal wählen

**Release Channel** (Release-Kanal) legt fest, welche Builds du verfolgst.

- **Latest Stable:** getaggte `vX.Y.Z`-Releases. Das ist die übliche Wahl.
- **Staging/UAT:** Vorab-Builds für Testende, die unfertig sein können. Bei dieser Wahl erscheint die Warnung „Staging builds are pre-release tester builds. Back up your app data before applying them.“

Wählst du in einem Browser auf dem Rechner des Servers einen anderen Kanal, heißt die Update-Schaltfläche **Switch to**, gefolgt vom Kanalnamen. Sie funktioniert selbst dann, wenn gewöhnliche Updates in der App abgeschaltet sind, und zeigt **Switching…**, solange der Wechsel läuft. Entfernte Geräte können das nur, wenn sie die Bedingungen für **Apply Update** (Update einspielen) unten erfüllen.

### Check for Updates

Klick auf **Check for Updates** (nach Updates suchen). Während der Prüfung zeigt die Schaltfläche **Checking…**. Darunter siehst du deine Version unter **Release**, deinen Commit-Code unter **Build** und, sofern bekannt, deinen **Branch**.

- Bist du aktuell, meldet eine grüne Zeile „You're on the latest“ samt deiner Version.
- Gibt es ein neueres Release, zeigt eine Karte „vX.Y.Z available“ mit einem Link **Release notes**.
- Hängt eine Git-Kopie hinterher, zeigt die Karte „N commits behind“. Ein Commit ist eine gespeicherte Änderung am Code, deshalb kann die Zahl auch unveröffentlichte Arbeit enthalten.

Die Release-Prüfung bleibt rund 15 Minuten zwischengespeichert, die Zahl der Commits rund 5 Minuten. Ein zweiter Klick direkt danach kann also dieselben Zahlen zeigen.

Schlägt die Prüfung fehl, erscheint „Could not check for updates. Try again later.“ Meist steckt ein Netzwerk- oder GitHub-Problem dahinter.

### Apply Update

**Apply Update** aktualisiert eine Git-Kopie aus dem Browser heraus. Die Schaltfläche erscheint nur, wenn alle diese Punkte zutreffen:

- Die Installation ist eine Git-Kopie. Container und andere Installationen können Updates nicht auf diesem Weg einspielen.
- Der Branch ist `main`, `master` oder `staging`, oder die Kopie steht ohne Branch auf einem Commit (detached). Eine Kopie auf einem anderen Branch gilt als Entwicklungs-Installation, und Marinara verweigert das Update.
- Der Server-Betreiber hat `UPDATES_APPLY_ENABLED=true` in der `.env`-Datei des Servers gesetzt.
- `UPDATES_APPLY_DISABLED` ist nicht gesetzt. Diese Variable sperrt jedes Einspielen, auch den Kanalwechsel, und Launcher für Entwickler setzen sie.

Auf dem Rechner, der den Server ausführt, brauchst du zum Einspielen kein Admin-Secret. Öffne Marinara dort unter `http://127.0.0.1:7860` oder `http://localhost:7860`.

Zwei Einstellungen ändern das:

- Eine Adresse, die ein Reverse-Proxy oder Tunnel bereitstellt, zählt als anderes Gerät. Mit `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` gelten diese Besucher als lokal, auch für die lokale Ausnahme vom Admin-Secret. Lass die Einstellung bei einem öffentlichen Proxy oder Tunnel eingeschaltet.
- Mit `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` brauchen auch lokale Anfragen das Geheimnis.

Das Einspielen von einem anderen Gerät aus ist standardmäßig abgeschaltet. Dafür braucht es alle drei Punkte:

- `UPDATES_ALLOW_REMOTE_APPLY=true` in der `.env` des Servers.
- `ADMIN_SECRET` ist in der `.env` des Servers gesetzt. Das ist ein zweites Passwort für riskante Aktionen.
- Dasselbe Geheimnis ist auf deinem Gerät unter **Settings → Advanced → Admin Access** gespeichert.

Klick auf **Apply Update**. Die Schaltfläche zeigt **Updating…**, während der Server den Code holt, neu installiert, die App neu baut und herunterfährt. Danach erscheint „Update applied successfully. Please relaunch the app to use the new version.“ Starte Marinara erneut, um das Update abzuschließen.

Wenn es nicht funktioniert hat: Fehlt **Apply Update**, zeigt Marinara den Grund an.

- Container-Installationen zeigen das Image-Tag und den Befehl `docker compose pull && docker compose up -d`, den du auf dem Host ausführst.
- Git-Kopien mit abgeschaltetem Einspielen zeigen einen manuellen Befehl zum Kopieren.
- Andere Installationen zeigen einen Link **Download** zum GitHub-Release.

## Die App im Browser neu laden

**Refresh App** (App neu laden) sitzt im selben Abschnitt **Updates**. Die Schaltfläche aktualisiert nicht den Server. Sie entfernt den Service Worker (ein kleines Skript, mit dem dein Browser die App schnell lädt), leert die Browser-Caches und lädt die Seite dann neu. Deine Chats und Einstellungen bleiben erhalten.

Nutz sie, wenn die App veraltet oder leer aussieht, obwohl der Server schon aktualisiert ist. Während der Arbeit zeigt die Schaltfläche **Refreshing…**.

## Deine Daten und optionale Downloads

Ein Update ersetzt den Programmcode, nicht deinen Datenordner oder das Volume `marinara-data`. Chats, Charaktere, Personas, Lorebooks, Presets, Verbindungen und Einstellungen bleiben, wo sie sind. Wo die Daten liegen, steht unter [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

- **Optionale Pakete.** Kommst du von einer Version, die Erstanbieter-Agenten, Karten, Anrufe oder Conversation-Spiele mitgeliefert hat, lädt der erste Start die passenden optionalen Pakete herunter. Deine Auswahl, deine Einstellungen und der Verlauf bleiben erhalten. Lass den Server für diesen ersten Start online. Ist die Download-Quelle nicht erreichbar, versucht Marinara es beim nächsten Start erneut und löscht nichts.
- **Sprache der Anleitungen.** Nutzt du eine heruntergeladene Doku-Sprache (**Settings → General → Documentation Language**), frischt der erste Start nach einem Update sie auf. Ist die Quelle nicht erreichbar, behält Marinara dein installiertes Paket, zeigt fehlende Anleitungen auf Englisch und versucht es beim nächsten Start erneut.
- **Sprache der Oberfläche.** Sprachpakete für die Oberfläche lädst du separat und von Hand herunter. Beim ersten Update von einer Version mit mitgelieferten Übersetzungen kehrt die Oberfläche zu Englisch zurück. Wähl deine Sprache unter **Settings → General → Language** erneut aus. Spätere Updates behalten heruntergeladene Pakete. Mit **Refresh language pack** (Sprachpaket aktualisieren) holst du neue Übersetzungen. Fehlende Übersetzungen erscheinen auf Englisch.

## Update von 2.5.0

Die Schritte oben bleiben dieselben. Ein paar Änderungen betreffen einen Server, den andere Geräte oder Personen nutzen. Klapp die Details auf, wenn das auf dich zutrifft.

<details>
<summary>Änderungen für gemeinsam genutzte Server</summary>

- **Ein Reverse-Proxy oder Tunnel auf demselben Computer.** Besucher, die nginx, Caddy, Cloudflare Tunnel, Tailscale Serve oder ngrok an Marinara weiterreichen, zählen jetzt als entfernt. Ohne Anmeldung sehen sie die Einrichtungsseite, und Backups und andere geschützte Aktionen brauchen das Admin-Secret. Siehe [Reverse-Proxys und Tunnel auf demselben Rechner](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Tailscale-Anmeldeausnahme.** Direkte Verbindungen zur Tailscale-Adresse dieses Computers überspringen die Anmeldung weiterhin. Andere Verbindungen aus `100.64.0.0/10` überspringen sie nicht mehr, und Besucher über Tailscale Serve und Funnel brauchen eine Anmeldung. Siehe [Ausnahme für Tailscale und Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker mit Passwort oder Allowlist.** Ist eine Anmeldung gesetzt (eine App-Anmeldung oder Basic Auth), fragt jetzt auch der Browser auf dem Host-Computer danach. Dasselbe gilt für `TRUSTED_AUTH_PROXY`, außer der Proxy ist der, der sich verbindet. Ist nur `IP_ALLOWLIST` gesetzt, wird der Browser auf dem Host abgewiesen, solange du das Gateway des Containers nicht einträgst. Nutze also eine Anmeldung. Siehe [Ausnahme für Tailscale und Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Chats und Profile, die in eine andere Installation umziehen.** Ein Chat-Verlauf, ein Einstellungsprofil oder ein vollständiges Profil nimmt **Discord Mirror**, **DeepLX URL**, **DeepL API Key** und **Intiface URL** nicht mehr in eine andere Installation mit. Trag sie dort neu ein. Deine eigenen Profile und ein vollständiges Profil, das in derselben Installation wiederhergestellt wird, behalten sie.
- **Ausgesperrt nach dem Update?** Siehe [Ausgesperrt nach dem Update](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

<a id="downgrading-to-an-older-version"></a>

## Downgrade auf eine ältere Version

Ein Rückweg ist nicht immer möglich. Neuere Versionen speichern Daten in einem neueren Speicherformat, und ein Build verweigert Daten in einem Format, das neuer ist als das, das er kennt. Aktuelle Builds verwenden Speicherformat 10. Die Formate 8, 9 und 10 haben MMD-Avatare, die Verknüpfung von Verbindungen mit Konten und GLB/FBX-Avatare hinzugefügt. Ein Build, der nur ein älteres Format kennt, kann Daten in diesen Formaten nicht öffnen.

Der Launcher überspringt ein Auto-Update, das auf einer inkompatiblen Version landen würde, und der Updater in der App verweigert das Einspielen. Um zu einem älteren Build zurückzukehren, stoppe Marinara und stelle ein vollständiges Backup von vor dem Update wieder her. Der Befehl zur Konvertierung von Chat-Dateien unten kann MMD-Avatar-Einstellungen nicht umwandeln. Ändere die Formatnummer nicht von Hand.

Sind deine Daten älter als Speicherformat 8, kann ein einzelner Konvertierungsbefehl die Chat-Dateien in das alte Layout zurückversetzen. Siehe [Nach dem Wechsel zu einer älteren Version zeigen Chats keine Nachrichten](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

<a id="going-back-to-250"></a>

### Zurück zu 2.5.0

Version 2.5.0 kann keine Daten öffnen, die auf Speicherformat 8 oder neuer aktualisiert wurden. Verwende ein Backup von vor dem Update.

Bei älteren Daten, die 2.5.0 öffnen kann, kennt die Version nicht, was neuere Funktionen hinzugefügt haben: einige Verbindungseinstellungen, die Angaben zum Neugenerieren von Chat-Bildern sowie Teile von Game-Checkpoints, Uhren aus Regelsätzen und Szenenvideos. Sobald 2.5.0 einen Chat oder eine Verbindung speichert, etwa wenn du eine Nachricht sendest, einen Spielzug machst, ein Bild erstellst oder eine Verbindung änderst, entfernt es diese neueren Daten aus dem gesamten Chat beziehungsweise der gesamten Verbindung. Ein erneutes Update holt sie nicht zurück.

Damit du genau dorthin zurückkehren kannst, wo du warst, leg vor dem Update ein Backup an. Siehe [Vorher ein Backup anlegen](#back-up-first).

## Wenn ein Update fehlschlägt

Die meisten Fehlschläge kommen von einer alten Node.js-Version, einem unvollständigen Download oder einem veralteten Browser-Cache.

- Meldet der Launcher, Node.js sei zu alt, installier Node.js 24 LTS und starte erneut.
- Wirkt die App nach dem Server-Update kaputt, klick auf **Refresh App**.
- Lässt sich eine Git-Kopie nicht sauber aktualisieren, nimm die Befehle für das [manuelle Update](#manual-update-git-copy-no-launcher).

Fehlermeldungen und Lösungen findest du unter [Fehlerbehebung in Marinara Engine](TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](data/backup-and-restore.md)
- [Fehlerbehebung in Marinara Engine](TROUBLESHOOTING.md)
- [Installationsanleitung für Windows](installation/windows.md)
- [Installationsanleitung für macOS und Linux](installation/macos-linux.md)
- [Im Container betreiben (Docker / Podman)](installation/containers.md)
- [Installationsanleitung für Android (Termux)](installation/android-termux.md)
- [Anleitung für iOS / iPadOS (PWA)](installation/ios-pwa.md)
