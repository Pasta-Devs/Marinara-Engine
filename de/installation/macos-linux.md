# Installationsanleitung für macOS und Linux

In dieser Anleitung erfährst du, wie du Marinara Engine unter macOS oder Linux installierst und startest. Du installierst zwei nötige Werkzeuge, startest die App über das Startskript und lernst, wie Updates später ablaufen. Marinara Engine (ab hier kurz Marinara) läuft komplett auf dem eigenen Rechner.

## Voraussetzungen

Zwei kostenlose Werkzeuge müssen vorher installiert sein:

- **Node.js**: das Programm, das Marinara ausführt. Nimm Version 24, 25 oder 26 (empfohlen ist die LTS-Version 24).
- **Git**: das Werkzeug, das Marinara herunterlädt und Updates holt.

pnpm musst du nicht selbst installieren. pnpm ist der Paketmanager, mit dem Marinara seine Bestandteile holt. Das Startskript installiert die passende pnpm-Version automatisch.

### Installation unter macOS

Am einfachsten geht es mit Homebrew. Ein einziger Befehl installiert beide Werkzeuge:

```bash
brew install node git
```

Ohne Homebrew lädst du das Node.js-Installationsprogramm von https://nodejs.org herunter. Git kommt anschließend über die Xcode Command Line Tools dazu:

```bash
xcode-select --install
```

### Installation unter Linux

Nutze den Paketmanager der Distribution. Unter Ubuntu oder Debian ist das mitgelieferte Node.js oft älter als Version 24. Binde deshalb zuerst die neuere NodeSource-Version ein:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Danach installierst du Node.js und Git:

```bash
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

Prüfe, ob beide Werkzeuge bereitstehen. Führe diesen Befehl aus:

```bash
node -v
```

Angezeigt werden sollte `v24` oder eine höhere Nummer. Führe danach diesen Befehl aus:

```bash
git --version
```

Angezeigt werden sollte eine Version wie `git version 2.40` oder höher. Meldet einer der Befehle „command not found“, ist das Werkzeug nicht korrekt installiert.

## Schnellstart über das Startskript

Das Startskript `start.sh` ist der empfohlene Weg, Marinara zu starten. Es installiert alles, baut die App und öffnet sie im Browser.

1. Lade Marinara herunter. Führe diesen Befehl aus:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Wechsle in den neuen Ordner. Führe diesen Befehl aus:

```bash
cd Marinara-Engine
```

3. Mach das Startskript ausführbar. Führe diesen Befehl aus:

```bash
chmod +x start.sh
```

4. Starte Marinara. Führe diesen Befehl aus:

```bash
./start.sh
```

Der erste Start dauert ein paar Minuten, weil dabei alles heruntergeladen und gebaut wird. Ist er fertig, öffnet sich Marinara im Browser unter http://127.0.0.1:7860. Die 7860 ist der Standard-Port – also die Tür, über die die App auf dem Rechner erreichbar ist.

Öffnet sich der Browser nicht von allein, ruf die Adresse einfach selbst auf.

### Was das Startskript bei jedem Start tut

Bei jedem `./start.sh` aus einem Git-Download macht das Startskript Folgendes:

1. Es sucht nach einer neueren Version und aktualisiert sich selbst, falls es eine gibt.
2. Es prüft, ob Node.js und die passende pnpm-Version bereitstehen.
3. Es installiert fehlende Bestandteile.
4. Es baut die App neu, sobald sich der Code geändert hat.
5. Es bereitet den lokalen Speicher für die Daten vor.
6. Es startet den Server und öffnet die App im Browser.

### Automatisches Öffnen des Browsers abschalten

Standardmäßig öffnet das Startskript den Browser. Um das zu unterbinden, legst du im Marinara-Ordner eine Datei namens `.env` an und trägst diese Zeile ein:

```bash
AUTO_OPEN_BROWSER=false
```

Eine `.env`-Datei ist eine reine Textdatei mit Einstellungen, eine pro Zeile. Ein kleiner Anfang sieht so aus:

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

`PORT` legt den Port der Adresse fest (standardmäßig 7860). Außerdem lässt das Startskript standardmäßig zu, dass andere Geräte im LAN den Server erreichen. LAN steht für Local Area Network, also das Netzwerk zu Hause oder im Büro. Marinara blockiert diese Geräte trotzdem, bis du ein Passwort oder eine andere Zugriffsoption einrichtest. Wie das geht, zeigt die Anleitung [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md).

## Manuelle Einrichtung

Für die meisten ist das Startskript oben die bessere Wahl. Wer jeden Schritt lieber selbst ausführt, nimmt stattdessen diese Befehle. Für die manuelle Einrichtung muss pnpm verfügbar sein. Node.js 24 bringt Corepack mit, Node.js 25 dagegen nicht.

1. Unter Node.js 24 aktivierst du pnpm über Corepack:

```bash
corepack enable pnpm
```

Unter Node.js 25 oder 26 installierst du zuerst das separate Corepack-Paket und aktivierst dann pnpm:

```bash
npm install --global corepack
corepack enable pnpm
```

2. Lade Marinara herunter. Führe diesen Befehl aus:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Wechsle in den Ordner. Führe diesen Befehl aus:

```bash
cd Marinara-Engine
```

4. Installiere die Bestandteile. Führe diesen Befehl aus:

```bash
pnpm install --force
```

5. Baue die App. Führe diesen Befehl aus:

```bash
pnpm build
```

6. Starte den Server. Führe diesen Befehl aus:

```bash
pnpm start
```

Öffne nun http://127.0.0.1:7860 im Browser. Mit `pnpm start` lauscht der Server standardmäßig nur auf dem eigenen Rechner. Alles läuft lokal, und der Datenspeicher wird beim ersten Start vorbereitet.

### Wenn die Installation unter Linux scheitert

Manche Linux-Systeme lehnen sehr lange Dateipfade bei der Installation ab. Erscheint ein Fehler mit `ERR_PNPM_ENAMETOOLONG`, lösch die halbfertigen Ordner und fang mit dem Startskript neu an. Führe diesen Befehl aus:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Führe danach diesen Befehl aus:

```bash
./start.sh
```

## Optionale Hintergrundentfernung

Marinara kann den Hintergrund aus Charakter-Sprites entfernen. Ein Sprite ist das Charakterbild auf der Bühne in Roleplay und Game Mode. Native Transparenz und die eingebaute adaptive Matte-Bereinigung funktionieren ohne diesen Download. Installier die zusätzliche KI-Variante nur, wenn du zusätzlich eine Rückfalllösung für Sprites vor detaillierter Kulisse, Schatten oder anderen unruhigen Hintergründen brauchst; sie lädt große Dateien herunter.

Das Zusatzwerkzeug ist ein Python-Programm. Bei der Installation entsteht ein Python-venv (eine virtuelle Umgebung, also ein eigener Ordner für Python-Pakete). Dazu kommt PyTorch, eine Bibliothek für maschinelles Lernen. Zuletzt lädt es die U2Net-Modelle herunter – die Dateien, die das Motiv im Bild finden.

Für die einmalige Installation führst du diesen Befehl im Marinara-Ordner aus:

```bash
pnpm backgroundremover:install
```

Unter macOS läuft Python 3.11 am zuverlässigsten. Installier es zuerst mit Homebrew:

```bash
brew install python@3.11
```

Führe danach den Installationsbefehl erneut aus:

```bash
pnpm backgroundremover:install
```

Soll das Startskript das Werkzeug beim nächsten Start selbst installieren, trag diese Zeile in die `.env`-Datei ein:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Updates

Startest du Marinara mit `./start.sh` aus einem Git-Download, sucht das Startskript nach einer neueren Version. Es aktualisiert sich vor dem Start automatisch. Chats, Charaktere und Einstellungen bleiben erhalten.

Mit `./start.sh --skip-update` überspringst du eine einzelne Prüfung. Damit die installierte Engine-Version über alle Starts hinweg gleich bleibt, trägst du `AUTO_UPDATE_ENABLED=false` in die `.env` ein. Prüfen und aktualisieren kannst du weiterhin von Hand – über **Settings → Advanced → Updates** oder per Git-Befehl.

Das geht auch in der App selbst. Öffne **Settings** (Einstellungen), wechsle auf den Tab **Advanced** (Erweitert) und such den Bereich **Updates**. Ein Klick auf **Check for Updates** (Nach Updates suchen) zeigt, ob eine neuere Version vorliegt. Die Schaltfläche **Apply Update** (Update anwenden) ist standardmäßig deaktiviert. Um sie freizuschalten, setzt du einige Server-Optionen. Danach hinterlegst du ein Admin-Geheimnis unter **Settings**, **Advanced**, **Admin Access**. Ohne diese Freischaltung genügt ein Neustart mit `./start.sh`, um zu aktualisieren.

Alle Update-Schritte – inklusive vorherigem Backup und Wechsel des Release-Kanals – stehen in der unten verlinkten Update-Anleitung.

## Wichtige Begriffe

- **pnpm**: der Paketmanager, mit dem Marinara seine Bestandteile herunterlädt und ordnet.
- **Corepack**: ein Helfer in Node.js, der pnpm aktiviert.
- **LAN**: Local Area Network, das private Netzwerk zu Hause oder im Büro.
- **.env**: eine reine Textdatei mit Einstellungen im Marinara-Ordner, eine Einstellung pro Zeile.
- **venv**: eine virtuelle Python-Umgebung, also ein eigener Ordner für Python-Pakete.
- **PyTorch**: eine Bibliothek für maschinelles Lernen, die die optionale Hintergrundentfernung nutzt.
- **U2Net**: die Modelldateien, mit denen die Hintergrundentfernung das Motiv im Bild findet.

## Verwandte Anleitungen

- [Marinara Engine installieren](../INSTALLATION.md): die passende Installationsmethode für dein Gerät finden.
- [Marinara Engine aktualisieren](../UPGRADING.md): vollständige Update- und Backup-Schritte für jede Plattform.
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md): ein Passwort einrichten, damit andere Geräte Marinara erreichen.
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md): Lösungen für Probleme bei Installation und Start.
