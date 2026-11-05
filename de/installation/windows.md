# Installationsanleitung für Windows

Installiere Marinara Engine auf einem Windows-PC, entweder mit dem Installer (die wenigsten Schritte) oder aus dem Quellcode. Marinara läuft danach auf deinem eigenen PC.

## Bevor du anfängst

Du brauchst Windows 10 oder Windows 11 (64 Bit), ein paar Gigabyte freien Speicherplatz und für die Installation eine Internetverbindung. Der Installer empfiehlt rund 2,5 GB freien Platz.

Außerdem brauchst du zwei Werkzeuge:

- **Node.js** 24, 25 oder 26. Node.js führt die App aus. Version 24 ist die empfohlene LTS-Version (Long Term Support).
- **Git**. Git lädt den Code herunter und ermöglicht Marinara, sich selbst zu aktualisieren.

Nutzt du den Installer, musst du sie nicht installieren: Er holt beide für dich. Installierst du aus dem Quellcode, installierst du sie selbst. pnpm (das Werkzeug, das die Bestandteile der App installiert) musst du nicht installieren. Der Installer und `start.bat` richten es ein.

## Mit dem Windows-Installer installieren

1. Öffne die [Releases-Seite von Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Lade den neuesten Windows-Installer herunter. Er heißt `Marinara-Engine-Installer-`, gefolgt von der Version.
3. Starte den Installer. Zeigt Windows „Windows protected your PC“, wähl **More info** (Weitere Informationen) und dann **Run anyway** (Trotzdem ausführen), aber nur bei einer Datei von der Releases-Seite.
4. Folge den Anweisungen. Fehlt Node.js oder Git, lass den Installer es installieren.
5. Wähl den Installationsordner oder übernimm den Standard (`%LOCALAPPDATA%\Marinara-Engine`).
6. Warte, während er die App herunterlädt und baut. Eine Fortschrittsliste zeigt jeden Schritt. Das dauert ein paar Minuten.
7. Meldet er, dass die Installation abgeschlossen ist, klick doppelt auf die Desktop-Verknüpfung **Marinara Engine**.

Ein Konsolenfenster (ein schwarzes Textfenster) öffnet sich und zeigt den Fortschritt. Danach öffnet dein Browser Marinara. Falls nicht, ruf `http://127.0.0.1:7860` auf.

Der Installer legt eine Git-Kopie des neuesten stabilen Releases an, damit Marinara sich bei jedem Start selbst aktualisieren kann.

> **Tipp:** Manche Antivirenprogramme schlagen beim Installer Alarm, weil er Node.js und Git herunterlädt. Starte den Installer nur, wenn du ihn von der oben verlinkten Releases-Seite hast.

## Marinara starten und stoppen

- **Starten:** Klick doppelt auf die Desktop-Verknüpfung oder den Eintrag im Startmenü. Bei einer Installation aus dem Quellcode führst du `start.bat` im Marinara-Ordner aus.
- **Stoppen:** Die Verknüpfung öffnet ein Konsolenfenster. Drück darin <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Läuft Marinara schon, öffnet die Verknüpfung es erneut in deinem Browser.

## Aus dem Quellcode installieren

Nimm diesen Weg, wenn du die Befehle lieber selbst ausführst oder die Staging-Version (für Testende) willst.

1. Installiere [Node.js](https://nodejs.org/en/download) und [Git for Windows](https://git-scm.com/download/win).
2. Öffne ein neues Fenster der Eingabeaufforderung (ein Textfenster, in das du Befehle eintippst).
3. Prüf beide Werkzeuge. `node -v` muss Version 24, 25 oder 26 anzeigen.

   ```bat
   node -v
   git --version
   ```

   Wird ein Befehl nicht gefunden, schließ die Eingabeaufforderung und öffne sie neu, oder installier das fehlende Werkzeug noch einmal.

4. Lade den Code herunter.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Wechsle in seinen Ordner.

   ```bat
   cd Marinara-Engine
   ```

6. Optional: Wechsle vor dem ersten Start auf die Staging-Version. Überspring diesen Schritt, um bei der stabilen Version zu bleiben. Sichere deine Daten, bevor du Staging verwendest.

   ```bat
   git checkout staging
   ```

   Der Launcher bleibt dann bei Updates auf Staging.

7. Starte den Launcher, also das Skript, das Marinara einrichtet und startet.

   ```bat
   start.bat
   ```

Der erste Start dauert ein paar Minuten, weil dabei alles installiert und gebaut wird. Ein Konsolenfenster zeigt den Fortschritt. Sobald alles bereit ist, öffnet dein Browser Marinara. Für spätere Starts führst du `start.bat` erneut im selben Ordner aus.

Wenn es nicht funktioniert hat: `[ERROR] Node.js 24 LTS or newer is required` bedeutet, dass dein Node.js zu alt ist. Installier Node.js 24 oder neuer von [nodejs.org](https://nodejs.org) und führ `start.bat` dann erneut aus.

### Manuelle Einrichtung ohne Launcher

Dieser Weg braucht den Befehl `pnpm`. Führ die Befehle im Ordner `Marinara-Engine` aus.

1. Installier pnpm einmalig.

   ```bat
   npm install -g pnpm
   ```

2. Installier die Abhängigkeiten (die Bestandteile, die die App braucht), bau die App und starte den Server.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Öffne `http://127.0.0.1:7860`.

Mit `pnpm start` erreicht nur dieser PC Marinara. Damit sich andere Geräte verbinden können, leg im Ordner `Marinara-Engine` eine Datei namens `.env` an, trag diese Zeile ein und starte den Server neu.

```env
HOST=0.0.0.0
```

## Marinara von einem anderen Gerät öffnen

Der Installer, seine Verknüpfung und `start.bat` lassen andere Geräte in deinem Netzwerk an Marinara heran, doch Marinara blockiert sie, bis du eine Anmeldung einrichtest. Die Schritte stehen unter [Fernzugriff](../REMOTE_ACCESS.md) und in den [Häufigen Fragen](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Marinara aktualisieren

Jedes Mal, wenn du Marinara über die Verknüpfung oder `start.bat` startest, sucht der Launcher nach Updates, installiert sie, baut die App neu und startet sie. Deine Chats, Charaktere und Einstellungen bleiben, wo sie sind. Hast du den Code selbst geändert, legt der Launcher deine Änderungen beiseite und holt sie nach dem Update zurück. Gelingt das nicht, behält er deine aktuelle Version und gibt einen Hinweis aus. Zur Schaltfläche **Apply Update** (Update einspielen) in der App, zum Überspringen eines Updates und zu manuellen Befehlen siehe [Marinara Engine aktualisieren](../UPGRADING.md#windows).

## Deine Daten finden oder deinstallieren

Deine Daten liegen im Ordner `packages\server\data` innerhalb des Marinara-Ordners. Zum Deinstallieren öffnest du den Startmenü-Eintrag **Uninstall Marinara Engine** (Marinara Engine deinstallieren). Das Deinstallationsprogramm fragt, ob es auch deine Daten löschen soll. Wähl **No** (Nein), um sie für eine spätere Neuinstallation zu behalten. Siehe [Marinara sichern und wiederherstellen](../data/backup-and-restore.md).

## Optional: KI-Freistellung für Sprites

Marinara fordert für generierte Sprites transparente Hintergründe an und bereinigt flache Hintergründe selbst. Als Rückfalllösung für detaillierte Kulissen kannst du das optionale Werkzeug `backgroundremover` installieren. Es lädt große Machine-Learning-Dateien herunter und ist deshalb standardmäßig aus.

1. Installiere Python 3.11 von [python.org](https://www.python.org/downloads/windows/). Python 3.9 bis 3.11 funktioniert.
2. Führ diesen Befehl im Ordner `Marinara-Engine` aus.

   ```bat
   pnpm backgroundremover:install
   ```

Das legt unter deinem Datenordner einen eigenen Python-Ordner an (ein venv). Marinara nutzt ihn automatisch.

Soll `start.bat` das Werkzeug beim nächsten Start installieren, trag diese Zeile in deine `.env`-Datei ein:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Wenn etwas schiefgeht

Prüf, ob Node.js in Version 24, 25 oder 26 vorliegt und ob Git installiert ist. Weitere Lösungen findest du unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Marinara Engine installieren](../INSTALLATION.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
- [Häufige Fragen](../FAQ.md)
