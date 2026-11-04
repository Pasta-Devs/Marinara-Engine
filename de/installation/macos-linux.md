# Installationsanleitung für macOS und Linux

Installiere Marinara Engine auf einem Mac oder einem Linux-Rechner und starte es mit dem Launcher `start.sh`. Marinara läuft danach auf deinem eigenen Rechner.

## Bevor du anfängst

Du brauchst zwei Werkzeuge:

- **Node.js** 24, 25 oder 26. Node.js führt Marinara aus. Version 24 ist die empfohlene LTS-Version (Long Term Support).
- **Git**. Git lädt Marinara herunter und holt Updates.

pnpm (das Werkzeug, das die Bestandteile der App installiert) musst du nicht installieren. Der Launcher richtet die passende Version ein.

### Node.js und Git unter macOS installieren

Mit Homebrew installiert ein einziger Befehl beide:

```bash
brew install node git
```

Ohne Homebrew lädst du den Node.js-Installer von [nodejs.org](https://nodejs.org) herunter. Git installierst du dann mit den Xcode Command Line Tools:

```bash
xcode-select --install
```

### Node.js und Git unter Linux installieren

Nutze deinen Paketmanager. Unter Ubuntu oder Debian ist das mitgelieferte Node.js oft älter als Version 24. Binde deshalb zuerst die NodeSource-Version ein:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Unter Fedora:

```bash
sudo dnf install -y nodejs git
```

Unter Arch:

```bash
sudo pacman -S nodejs npm git
```

### Werkzeuge prüfen

```bash
node -v
git --version
```

`node -v` muss `v24` oder höher anzeigen. Meldet einer der Befehle „command not found“, ist das Werkzeug nicht korrekt installiert.

## Marinara installieren und starten

1. Öffne ein Terminal, also ein Fenster, in das du Befehle eintippst. Auf dem Mac drückst du <kbd>Cmd</kbd>+<kbd>Leertaste</kbd>, tippst Terminal ein und drückst Enter. Unter Linux öffnest du deine Terminal-App.
2. Lade Marinara herunter.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Wechsle in den neuen Ordner.

   ```bash
   cd Marinara-Engine
   ```

4. Starte Marinara mit dem Launcher, also dem Skript, das es einrichtet und startet.

   ```bash
   ./start.sh
   ```

Der erste Start dauert ein paar Minuten, weil dabei alles heruntergeladen und gebaut wird. Das Terminal zeigt den Fortschritt und dann `Press Ctrl+C to stop`. Marinara öffnet sich in deinem Browser unter `http://127.0.0.1:7860`. Öffnet sich der Browser nicht, ruf die Adresse selbst auf.

Wenn es nicht funktioniert hat:

- `permission denied`: Führ `chmod +x start.sh` aus und dann erneut `./start.sh`.
- `[ERROR] Node.js 24 LTS or newer is required`: Dein Node.js ist zu alt. Installier eine neuere Version und führ dann erneut `./start.sh` aus.

## Marinara starten und stoppen

- **Erneut starten:** Führ `./start.sh` im Marinara-Ordner aus. Läuft Marinara schon, öffnet der Launcher es erneut in deinem Browser.
- **Stoppen:** Drück <kbd>Ctrl</kbd>+<kbd>C</kbd> im Terminal.

Jedes Mal, wenn du `./start.sh` aus einem Git-Download ausführst, macht der Launcher Folgendes:

1. Er sucht nach einer neueren Version und aktualisiert, wenn er eine findet.
2. Er prüft Node.js und die passende pnpm-Version.
3. Er installiert fehlende Bestandteile und baut die App neu, wenn sich der Code geändert hat.
4. Er startet den Server und öffnet deinen Browser.

## Launcher-Einstellungen ändern

Die Einstellungen des Launchers stehen in einer `.env`-Datei im Marinara-Ordner. Eine `.env`-Datei ist eine reine Textdatei mit einer Einstellung pro Zeile. Damit der Launcher deinen Browser nicht öffnet, trag diese Zeile ein:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` legt den Port fest, also die Zahl nach dem Doppelpunkt in der Adresse (standardmäßig 7860). Der Launcher lässt andere Geräte in deinem lokalen Netzwerk an Marinara heran, doch Marinara blockiert sie, bis du eine Anmeldung einrichtest. Siehe [Fernzugriff](../REMOTE_ACCESS.md).

## Marinara aktualisieren

`./start.sh` aktualisiert Marinara zuerst. Deine Chats, Charaktere und Einstellungen bleiben, wo sie sind. Hast du den Code selbst geändert, legt der Launcher deine Änderungen beiseite und holt sie nach dem Update zurück. Zum Überspringen eines Updates, zur Schaltfläche **Apply Update** (Update einspielen) in der App und zu manuellen Befehlen siehe [Marinara Engine aktualisieren](../UPGRADING.md#macos-and-linux).

## Manuelle Einrichtung ohne Launcher

Für die meisten ist der Launcher die richtige Wahl. Willst du jeden Schritt selbst ausführen, brauchst du pnpm. Node.js 24 bringt Corepack mit, ein Werkzeug, das pnpm aktiviert. Node.js 25 bringt es nicht mit.

1. Unter Node.js 24 aktivierst du pnpm:

   ```bash
   corepack enable pnpm
   ```

   Unter Node.js 25 oder 26 installierst du zuerst Corepack:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Lade Marinara herunter.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Wechsle in seinen Ordner.

   ```bash
   cd Marinara-Engine
   ```

4. Installier die Bestandteile, bau die App und starte den Server.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Öffne `http://127.0.0.1:7860`.

Mit `pnpm start` lauscht der Server nur auf deinem eigenen Rechner. Damit sich andere Geräte verbinden können, trag `HOST=0.0.0.0` in die `.env` ein und starte neu.

## Optional: Hintergrundentfernung

Marinara fordert für generierte Sprites (Charakterbilder) transparente Hintergründe an und bereinigt flache Hintergründe selbst. Als Rückfalllösung für detaillierte Kulissen oder Schatten kannst du die optionale KI-Hintergrundentfernung installieren. Sie richtet ein Python-venv ein (einen eigenen Ordner für Python-Pakete) und lädt große Dateien herunter: PyTorch (eine Bibliothek für maschinelles Lernen) und die U2Net-Modelle (Dateien, die das Motiv eines Bildes finden).

1. Unter macOS läuft Python 3.11 am besten. Installier es zuerst. Python 3.9 bis 3.11 funktioniert.

   ```bash
   brew install python@3.11
   ```

2. Führ im Marinara-Ordner Folgendes aus:

   ```bash
   pnpm backgroundremover:install
   ```

Soll der Launcher sie beim nächsten Start installieren, trag diese Zeile in die `.env` ein:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Wenn etwas schiefgeht

Auf manchen Linux-Systemen schlägt die Installation mit einem Fehler fehl, der `ERR_PNPM_ENAMETOOLONG` enthält (Dateipfade zu lang). Lösch die halbfertigen Ordner und starte den Launcher erneut:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

Weitere Lösungen findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Marinara Engine installieren](../INSTALLATION.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
