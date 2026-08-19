# Marinara Engine aktualisieren

In dieser Anleitung erfährst du, wie du Marinara Engine auf eine neuere Version bringst. Sie behandelt jede Installationsart, die Update-Funktionen in der App und das Vorgehen, wenn ein Update fehlschlägt. Chats und Einstellungen bleiben dabei erhalten.

## Deine Daten bleiben erhalten

Ein Update von Marinara Engine löscht keine Daten. Chats, Charaktere, Personas, Lorebooks, Presets, Verbindungen und Einstellungen bleiben unverändert bestehen.

Marinara legt die Daten in einem lokalen Datenordner auf dem Rechner ab, der den Server ausführt. Docker und Podman bewahren sie im Volume `marinara-data` auf. Ein Update tauscht nur den Programmcode aus – der Datenordner und das Volume bleiben unangetastet.

Kommst du von einer Version, die Erstanbieter-Agenten, Karten, Anrufe oder Conversation-Spiele mitgeliefert hat, lädt Marinara beim ersten Start die passenden optionalen Pakete aus dem offiziellen Katalog herunter. Bestehende Chat-Auswahlen, Agent-Einstellungen, gespeicherte Laufzeitdaten und der Verlauf bleiben erhalten. Lass den Server für diesen ersten Start online. Ist der Katalog nicht erreichbar, wiederholt Marinara die Migration beim nächsten Start, statt die gespeicherte Konfiguration zu löschen oder zu deaktivieren.

Nutzt du eine heruntergeladene Doku-Sprache (**Settings** (Einstellungen) → **General** → **Documentation Language**), prüft Marinara beim ersten Start nach einem Update auch dieses Sprachpaket auf Änderungen und frischt es automatisch auf. Ist die Download-Quelle nicht erreichbar, behält Marinara das installierte Paket (fehlende Anleitungen erscheinen dann auf Englisch) und versucht es beim nächsten Start erneut. Ein Update setzt die Sprachwahl nie zurück.

Wo die Daten liegen und wie du eine Kopie sicherst, steht unter [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

## Vorher ein Backup anlegen

Updates sind sicher, aber ein Backup kostet wenig und schützt viel. Leg vor jedem großen Versionssprung eines an.

1. Öffne **Settings**.
2. Wechsle zum Tab **Advanced** (Erweitert).
3. Such den Abschnitt **Backup & Export**.
4. Klick auf **Download Backup** (Backup herunterladen).
5. Speichere die `.zip`-Datei an einem sicheren Ort.

Während der Arbeit wechselt die Beschriftung der Schaltfläche zu **Creating backup…**. Danach speichert der Browser ein `.zip`-Archiv mit deinen Daten.

Alle Schritte zum Sichern und Wiederherstellen findest du unter [Marinara sichern und wiederherstellen](data/backup-and-restore.md).

## Update nach Plattform

Wähl den Abschnitt, der zu deiner Installation passt. Ein „git checkout“ ist im Folgenden eine mit dem Werkzeug Git installierte Kopie. Ein „Clone“ ist eine mit Git heruntergeladene Kopie.

### Windows

Nach einer Installation über das Windows-Installationsprogramm oder per git checkout aktualisiert der Launcher automatisch.

1. Beende Marinara Engine.
2. Starte es erneut über die Verknüpfung im Startmenü oder mit `start.bat`.

Der Launcher holt den neuesten Code, installiert Geändertes neu, baut die App neu und startet die neue Version. Das gilt für das Installationsprogramm ebenso wie für einen manuellen Clone.

Für einen einzelnen Start gibt es `start.bat --skip-update`. Soll die installierte Engine-Version dauerhaft bleiben, setz `AUTO_UPDATE_ENABLED=false` in der `.env` des Projekts. Das deaktiviert nur die automatischen Engine-Updates; manuelle Befehle und **Settings → Advanced → Check for Updates** bleiben verfügbar.

Meldet der Launcher, dass Node.js zu alt ist, installier Node.js 24 LTS und starte Marinara erneut. LTS steht für Long Term Support, also die empfohlene stabile Ausgabe von Node.js.

Möglich ist außerdem, das neueste Installationsprogramm von der GitHub-Releases-Seite herunterzuladen und auszuführen. Es nutzt denselben Git-Weg, sodass künftige Updates weiterhin über den Launcher laufen.

### macOS und Linux

Beende Marinara Engine und starte dann den Launcher aus dem Marinara-Ordner.

```bash
./start.sh
```

Der Launcher holt den neuesten Code, installiert geänderte Abhängigkeiten neu, baut die App neu und startet die neue Version.

Für einen einzelnen Start nimm `./start.sh --skip-update`, für einen dauerhaften Verzicht setz `AUTO_UPDATE_ENABLED=false` in der `.env`. Manuelle Update-Befehle und die Update-Bedienelemente in der App bleiben verfügbar.

Heißt es, Node.js sei zu alt, installier Node.js 24 LTS und starte den Launcher erneut.

### Docker oder Podman

Container-Installationen aktualisieren über ein neues Image, nicht über den Launcher. Führ die Befehle in dem Ordner aus, in dem die Compose-Datei liegt.

```bash
docker compose down && docker compose pull && docker compose up -d
```

Für Podman gelten dieselben Befehle mit `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

Release-Images erscheinen als `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` und `:latest`, dazu die passenden `-lite`-Tags. Hol `:latest` oder das neueste Versions-Tag, sofern du nicht bewusst auf einer älteren Ausgabe bleiben willst. Die Daten im Volume `marinara-data` bleiben von einem Pull unberührt.

### Android (Termux)

Termux ist eine Terminal- und Linux-Umgebung für Android. Sein Launcher aktualisiert Marinara bei jedem Start.

1. Öffne Termux.
2. Starte den Launcher.

```bash
cd Marinara-Engine
./start-termux.sh
```

Der Launcher aktualisiert den Code, hebt Node.js bei Bedarf an, baut die App neu und startet den lokalen Server.

Ist ein Update fehlerhaft und du willst auf der aktuellen Kopie bleiben, überspring stattdessen die Update-Prüfung.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

Für einen dauerhaften Verzicht setz `AUTO_UPDATE_ENABLED=false` in der `.env` des Projekts. Das betrifft nur die vom Launcher verwalteten Engine-Updates; manuelle Updates und die Update-Bedienelemente in der App bleiben verfügbar.

Nutzt du das Android-App-Symbol (die APK), [lade die neueste APK herunter](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) und öffne die Datei, damit Android den Wrapper selbst aktualisiert. Öffne danach Marinara Engine und tipp auf **Install / Start Marinara**, um die Termux-Kopie dahinter zu aktualisieren und zu starten. Die App bewahrt und überträgt ihre privaten localhost-Zugangsdaten automatisch; ein Update fragt nie nach Signaturdaten oder diesem Geheimwert.

### iPhone und iPad

iPhone und iPad führen den Marinara-Server nicht aus. Sie öffnen über Safari einen Server, der auf einem anderen Gerät läuft. Die Kopie auf dem Home-Bildschirm ist eine PWA, kurz für Progressive Web App. Eine PWA ist eine Website, die du zum Home-Bildschirm hinzufügst, damit sie sich wie eine App öffnet.

1. Aktualisiere den Rechner, den Docker-Host oder das Android-Gerät, auf dem der Marinara-Server tatsächlich läuft. Nutz dafür den passenden Abschnitt oben.
2. Lad die PWA auf dem Home-Bildschirm oder den Safari-Tab auf dem iPhone bzw. iPad neu.

Zeigt Safari nach dem Update des Hosts weiterhin einen älteren Stand, setz die zwischengespeicherte Kopie zurück.

1. Entferne das Symbol vom Home-Bildschirm.
2. Lösch die Safari-Website-Daten für den Marinara-Host.
3. Füg die Seite erneut zum Home-Bildschirm hinzu.

## Updates in der App prüfen und einspielen

Marinara kann direkt aus der App heraus bei GitHub nach einer neueren Version suchen. Manche Installationen spielen das Update sogar aus dem Browser ein.

1. Öffne **Settings**.
2. Wechsle zum Tab **Advanced**.
3. Such den Abschnitt **Updates**.

### Release Channel

Das Dropdown-Menü **Release Channel** (Release-Kanal) legt fest, welche Builds du verfolgst. Es gibt zwei Möglichkeiten.

- **Latest Stable**: folgt den getaggten `vX.Y.Z`-Releases. Für die meisten Nutzenden die richtige Wahl.
- **Staging/UAT**: folgt Vorab-Builds für Testende. Diese können unfertig sein. Sichere deine Daten, bevor du sie verwendest.

Bei der Wahl von **Staging/UAT** erscheint der Hinweis „Staging builds are pre-release tester builds. Back up your app data before applying them.“

Ein Kanalwechsel gilt als bewusste Entscheidung. Wählst du in einem Browser auf dem Rechner mit dem Server einen anderen Kanal, wird aus der Update-Schaltfläche **Switch to** gefolgt vom Kanalnamen – und das funktioniert selbst dann, wenn gewöhnliche Updates in der App abgeschaltet sind. Währenddessen zeigt sie **Switching…**. Normale Updates im selben Kanal brauchen weiterhin die unter „Apply Update“ beschriebene Einrichtung, entfernte Geräte ohnehin immer.

### Check for Updates

Klick auf **Check for Updates** (nach Updates suchen). Während der Prüfung zeigt die Schaltfläche **Checking…**.

Darunter erscheinen die Version unter **Release** und der Commit-Code unter **Build**. Ist der Branch bekannt, kommt zusätzlich eine Zeile **Branch** dazu.

- Bist du aktuell, meldet eine grüne Häkchen-Zeile „You're on the latest ... target“ samt Versionsnummer.
- Gibt es eine neuere Version, zeigt eine Karte „vX.Y.Z available“ mit einem Link **Release notes**.
- Hängt eine Git-Installation lediglich hinterher, steht dort stattdessen „N commits behind“. Ein Commit ist eine gespeicherte Änderung am Code, deshalb kann diese Zahl auch unveröffentlichte Arbeit enthalten.

Marinara speichert die Ergebnisse der Update-Prüfung zwischen. Die Release-Version bleibt rund 15 Minuten im Zwischenspeicher, die Zahl der „commits behind“ rund 5 Minuten. Ein sofortiger erneuter Klick auf **Check for Updates** kann also dieselben Zahlen liefern.

### Apply Update

Die Schaltfläche **Apply Update** (Update einspielen) erscheint nur, wenn sich die Installation aus dem Browser heraus aktualisieren kann. Dafür müssen beide Punkte erfüllt sein.

- Eine Git-basierte Installation (Docker und paketierte Installationen können das nicht).
- Der Server-Betreiber hat `UPDATES_APPLY_ENABLED=true` in der `.env` des Servers gesetzt. Eine `.env`-Datei enthält die Server-Einstellungen.

Klickst du **Apply Update** auf dem Rechner, der den Server ausführt, reicht das bereits. Ein Geheimnis brauchst du dort nicht.

Das Einspielen von einem anderen Gerät aus ist standardmäßig deaktiviert. Dafür müssen alle drei Punkte erfüllt sein.

- Der Server-Betreiber hat `UPDATES_ALLOW_REMOTE_APPLY=true` in der `.env` gesetzt.
- Der Server-Betreiber hat `ADMIN_SECRET` (ein Passwort für geschützte Aktionen) in der `.env` gesetzt.
- Du hast dasselbe Geheimnis auf deinem Gerät unter **Settings -> Advanced -> Admin Access** hinterlegt.

Nach einem Klick auf **Apply Update** zeigt die Schaltfläche **Updating...**. Der Server holt den neuen Code, installiert die Abhängigkeiten neu, baut die App neu und fährt anschließend herunter. Dann erscheint: „Update applied successfully. Please relaunch the app to use the new version.“ Starte Marinara erneut, um den Vorgang abzuschließen.

Steht **Apply Update** nicht zur Verfügung, nennt Marinara den Grund und den passenden Weg.

- Bei Container-Installationen erscheinen das Image-Tag und der Befehl `docker compose pull && docker compose up -d` für den Host.
- Bei Git-Installationen mit abgeschaltetem Einspielen erscheint ein manueller Update-Befehl zum Kopieren.
- Bei allen anderen Installationen erscheint ein Link **Download** zum GitHub-Release.

Schlägt schon die Prüfung fehl, erscheint: „Could not check for updates. Try again later.“ Meist steckt ein Netzwerk- oder GitHub-Problem dahinter – versuch es gleich noch einmal.

## Die Schaltfläche Refresh App

Die Schaltfläche **Refresh App** (App neu laden) sitzt im selben Abschnitt **Updates**. Sie aktualisiert nicht den Server, sondern nur die App im aktuellen Browser.

**Refresh App** meldet den Service Worker ab, leert die Browser-Zwischenspeicher und lädt die Seite neu. Ein Service Worker ist ein kleines Skript, mit dem der Browser die App schnell und offline lädt. Gespeicherte Chats, Einstellungen und andere lokale Daten bleiben unversehrt.

Nutz **Refresh App**, wenn die App nach einem Update veraltet wirkt oder eine leere Seite zeigt, der Server aber bereits die neue Version ausführt. Es behebt eine festhängende Webseite. Am Server-Code ändert sich nichts – ein echtes Update ersetzt es also nicht.

Während der Arbeit zeigt die Schaltfläche **Refreshing…**, danach lädt die App neu.

## Downgrade auf eine ältere Version

Upgrades sind immer sicher, doch ein direkter Rückweg ist nicht immer möglich. Neuere Marinara-Versionen speichern Chatnachrichten in einem neueren Format auf der Festplatte, das ältere Versionen nicht lesen können. Zum Schutz deines Chatverlaufs überspringt der Launcher Auto-Updates auf eine inkompatible Version, und der Updater in der App verweigert sie.

Falls du trotzdem eine ältere Version brauchst, bringt ein einzelner Konvertierungsbefehl deine Daten zuerst wieder in das alte Format. Die Schritte stehen unter [Nach dem Wechsel zu einer älteren Version zeigen Chats keine Nachrichten](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

## Wenn ein Update fehlschlägt

Die meisten Update-Probleme kommen von einer alten Node.js-Version, einem unvollständigen Download oder einem veralteten Browser-Zwischenspeicher.

- Meldet der Launcher, Node.js sei zu alt, installier Node.js 24 LTS und starte erneut.
- Wirkt die App nach dem Server-Update kaputt, probier die Schaltfläche **Refresh App** von oben.
- Lässt sich eine Git-Installation nicht sauber aktualisieren, führ die manuellen Update-Befehle deiner Plattform aus der jeweiligen Installationsanleitung aus.

Fehlermeldungen und Schritt-für-Schritt-Lösungen findest du unter [Marinara Engine: Problembehebung](TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](data/backup-and-restore.md)
- [Marinara Engine: Problembehebung](TROUBLESHOOTING.md)
- [Installationsanleitung für Windows](installation/windows.md)
- [Installationsanleitung für macOS / Linux](installation/macos-linux.md)
- [Betrieb im Container (Docker / Podman)](installation/containers.md)
- [Installationsanleitung für Android (Termux)](installation/android-termux.md)
- [PWA-Anleitung für iOS / iPadOS](installation/ios-pwa.md)
