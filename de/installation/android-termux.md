# Installationsanleitung für Android (Termux)

In dieser Anleitung erfährst du, wie du Marinara Engine auf einem Android-Handy oder -Tablet betreibst. Marinara läuft dabei in Termux, einer kostenlosen App, die deinem Handy ein kleines Linux-System gibt. Einrichten kannst du es mit der Android-App von Marinara (am einfachsten) oder von Hand in Termux.

## Was Termux und F-Droid sind

Marinara ist ein Linux-Server und keine native Android-App, deshalb braucht es Termux, um zu laufen. F-Droid ist ein kostenloser, quelloffener App-Store. Die Einrichtung der Android-App lädt die stabile F-Droid-Version von Termux herunter. Termux gibt es außerdem als experimentelle Google-Play-Version. Ist sie bereits installiert, akzeptiert Marinara sie, diese Anleitung empfiehlt aber F-Droid.

Installiere Termux über [Termux bei F-Droid](https://f-droid.org/en/packages/com.termux/). Installiere Termux und seine Plugin-Apps nicht aus unterschiedlichen Quellen, denn ihre Signaturen müssen übereinstimmen. Siehe die [offiziellen Installationshinweise von Termux](https://github.com/termux/termux-app#installation).

## Installation mit der Android-App

Die Android-App von Marinara Engine richtet Termux ein und öffnet Marinara, sobald der lokale Server läuft. Unterwegs bittet Android dich, ein paar Systemabfragen zu bestätigen.

1. Tipp auf [Neueste Android-APK herunterladen](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Eine APK ist die Installationsdatei einer Android-App.
2. Installiere die APK und öffne dann die App.
3. Tipp auf **Install / Start Marinara** (Marinara installieren/starten).
4. Ist Termux noch nicht installiert, bestätige die Installationsabfragen von Android, damit die App Termux von F-Droid installieren kann. Dazu gehört auch, der App das Installieren von Apps zu erlauben.
5. Erteile die Berechtigung **Run commands in Termux environment** (Befehle in der Termux-Umgebung ausführen), wenn Android danach fragt.
6. Blockiert Termux die Einrichtung, kopiert die App einen `allow-external-apps`-Befehl und öffnet Termux. Halte den Termux-Bildschirm gedrückt, tipp auf **Paste** (Einfügen) und drück Enter. Geh dann zurück und tipp erneut auf **Install / Start Marinara**.
7. Warte, während Termux die Abhängigkeiten (die Bestandteile, die die App braucht) installiert und Marinara baut. Termux zeigt dabei durchlaufenden Text. Der erste Build dauert ein paar Minuten.
8. Kehr zur Marinara-Engine-App zurück, wenn Termux fertig ist. Sobald der Server bereit ist, verbindet sie sich und meldet sich von selbst an, und du siehst den Startbildschirm von Marinara.

Willst du stattdessen deinen Browser nutzen, wähle im Launcher der App **Open in browser** (im Browser öffnen). Die App merkt sich die Auswahl, und auch dort erfolgt die Anmeldung automatisch.

Wenn es nicht funktioniert hat: Erledige die Abfrage, die die Einrichtung blockiert hat, und tipp danach erneut auf **Install / Start Marinara**. Kann die App localhost nicht öffnen, aktualisiere die APK und tipp auf **Install / Start Marinara**. Siehe [Hilfe zur Android-localhost-Anmeldung](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

Die App braucht keinen Signaturschlüssel, kein Passwort und keine Änderung an `CSRF_TRUSTED_ORIGINS`. Sie erzeugt ihre eigenen privaten localhost-Zugangsdaten. Füge `null` nicht zu `CSRF_TRUSTED_ORIGINS` hinzu.

## Manuelle Installation in Termux

Nimm diesen Weg, wenn du die App nicht nutzen willst. Öffne Termux, halte den Bildschirm gedrückt und tipp auf **Paste**, um diesen Befehl einzufügen (kopiere ihn vollständig):

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Der Befehl macht der Reihe nach Folgendes:

1. Er aktualisiert alle Termux-Pakete. Ein neueres Node.js startet nicht mit älteren Termux-Bibliotheken, deshalb braucht Termux eine vollständige Aktualisierung. Fragt die Aktualisierung, ob du eine Konfigurationsdatei behalten willst, drück Enter, um deine zu behalten.
2. Er installiert Git und Node.js. Marinara unterstützt Node.js 24, 25 und 26.
3. Er lädt Marinara herunter, sofern es noch nicht vorhanden ist.
4. Er macht den Launcher (`start-termux.sh`) ausführbar und startet ihn.

Der Launcher installiert die Abhängigkeiten, baut Marinara auf deinem Gerät und startet den lokalen Server. Ist deine Node.js-Version zu alt, aktualisiert er sie. Der erste Durchlauf dauert lange, und Termux zeigt durchlaufenden Text. Spätere Durchläufe gehen schneller.

Meldet der Launcher, dass der Server läuft, öffne diese Adresse im Browser deines Android-Geräts:

```text
http://127.0.0.1:7860
```

Hast du einen anderen `PORT` gesetzt, nimm diese Nummer. Für ein App-ähnliches Symbol nutzt du den Eintrag im Browser-Menü, der die Seite zum Startbildschirm hinzufügt. Wie er heißt, ist von Browser zu Browser verschieden.

## Marinara starten und stoppen

Mit der App: Öffne sie und tipp auf **Install / Start Marinara**, wenn der Server gestoppt ist. Um zwischen App und Browser zu wechseln, nutze im Launcher **Open in browser** und danach **Retry connection** (Verbindung erneut versuchen). Aus der App heraus kommst du über **Settings → General → App Behavior → Open Android launcher (app or browser)** (Einstellungen → Allgemein → App-Verhalten → Android-Launcher öffnen (App oder Browser)) zurück zum Launcher.

Bei einer manuellen Installation öffnest du Termux und führst Folgendes aus:

```bash
cd Marinara-Engine
./start-termux.sh
```

Um den Server zu stoppen, drück in Termux <kbd>Ctrl</kbd>+<kbd>C</kbd>.

## Marinara aktualisieren

Bei jedem Aufruf von `./start-termux.sh` prüft der Launcher auf GitHub, ob es eine neuere Version gibt, und aktualisiert vor dem Start. Um ohne Update zu starten, häng `--skip-update` an. Weitere Optionen und die Schritte für ein APK-Update findest du unter [Marinara Engine aktualisieren](../UPGRADING.md#android-termux).

Bei Updates entfernt der Launcher außerdem nicht mehr benötigte Pakete aus seinem lokalen pnpm-Cache. So belegen alte Releases nicht mehrere Gigabyte Speicherplatz. Deine Chats und Einstellungen bleiben dabei unangetastet.

## Marinara von einem anderen Gerät öffnen

Der Launcher macht Marinara für andere Geräte in deinem WLAN erreichbar, blockiert sie aber, bis du eine Anmeldung einrichtest. Siehe die [FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) und [Fernzugriff](../REMOTE_ACCESS.md).

Kann sich ein anderes Gerät nach einem Update nicht anmelden, siehe [Ausgesperrt nach dem Update](../REMOTE_ACCESS.md#locked-out-after-updating). In Termux entfernt dieser Befehl die App-Anmeldung und meldet alle Browser ab:

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## Verwandte Anleitungen

- [Marinara Engine installieren](../INSTALLATION.md)
- [Anleitung für iOS / iPadOS (PWA)](ios-pwa.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Häufige Fragen](../FAQ.md)
