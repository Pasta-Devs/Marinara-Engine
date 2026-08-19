# Installationsanleitung für Android (Termux)

In dieser Anleitung erfährst du, wie Marinara Engine auf einem Android-Handy oder -Tablet läuft. Marinara arbeitet dabei in Termux, einer kostenlosen Linux-Umgebung für Android. Zwei Wege führen zum Ziel: bequem über die Android-App oder von Hand im Termux-Terminal.

## Was Termux und F-Droid sind

Termux ist eine kostenlose App, die dem Handy ein kleines Linux-System samt Kommandozeile verpasst. Marinara Engine braucht sie, weil Marinara ein Linux-Server ist und keine native Android-App.

F-Droid ist ein kostenloser, quelloffener App-Store für Android. Marinaras automatische Einrichtung lädt die stabile F-Droid-Version von Termux herunter. Termux hat außerdem eine separate experimentelle Google-Play-Version; ist sie bereits installiert, erkennt Marinara ihre offizielle Signatur, für diese Anleitung bleibt F-Droid aber der empfohlene Weg.

Hier geht es zur Installation von Termux über F-Droid: [Termux bei F-Droid](https://f-droid.org/en/packages/com.termux/). Vermische Termux und seine Plugin-Apps nicht aus verschiedenen Quellen, da ihre Signaturen übereinstimmen müssen. Einzelheiten zu den Quellen stehen in den [offiziellen Installationshinweisen von Termux](https://github.com/termux/termux-app#installation).

## Installation über die Android-App (APK)

Am einfachsten geht es mit der Android-App von Marinara Engine. Eine APK ist die Installationsdatei einer Android-App. Diese App ist nur ein kleiner Helfer: Sie richtet Termux ein und öffnet Marinara, sobald der lokale Server läuft. Die eigentliche Arbeit erledigt weiterhin Termux – deshalb musst du unterwegs ein paar Systemabfragen bestätigen. Für die Installation der fertigen APK brauchst du weder Signaturschlüssel noch Passwort, lokalen Zugriffsgeheimwert oder eine Änderung an `CSRF_TRUSTED_ORIGINS`. Die App erzeugt und überträgt ihre privaten localhost-Zugangsdaten automatisch. Füge `null` nicht zu `CSRF_TRUSTED_ORIGINS` hinzu; es wird absichtlich wie nicht gesetzt behandelt und ist für den APK-Handshake unnötig.

1. Tipp auf [Neueste Android-APK herunterladen](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Installiere die APK und öffne die App.
3. Tippe auf **Install / Start Marinara** (Marinara installieren/starten).
4. Falls Termux noch fehlt, bestätige die Installationsabfragen von Android, damit die App Termux aus F-Droid herunterladen und installieren kann.
5. Erteile die Berechtigung **Run commands in Termux environment** (Befehle in der Termux-Umgebung ausführen), sobald Android danach fragt.
6. Blockiert Termux die Einrichtung, kopiert die App einen `allow-external-apps`-Befehl für dich. Füge ihn einmal in Termux ein und tippe danach erneut auf **Install / Start Marinara**.
7. Warte, bis Termux die Abhängigkeiten installiert und Marinara gebaut hat. Der erste Build dauert ein paar Minuten.
8. Kehr zur Marinara-Engine-App zurück, wenn Termux fertig ist. Sobald der lokale Server bereit ist, verbindet sich die App und meldet sich automatisch an.

Du hättest gern ein Symbol auf dem Startbildschirm, das Marinara wie eine gewöhnliche App öffnet? Genau das liefert diese Android-App mit. Sie ist allerdings nur eine Hülle um den Termux-Server, der also zuerst eingerichtet sein muss. Die Installations- und Berechtigungsabfragen von Android lassen sich damit nicht umgehen, aber du musst keinen Marinara-Installationsgeheimwert konfigurieren.

## Manuelle Installation in Termux

Ohne App geht es genauso. Öffne Termux und füge diesen einen Befehl ein:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Dieser eine Befehl erledigt fünf Dinge:

1. Er aktualisiert die Termux-Pakete.
2. Er installiert Git und Node.js. Marinara unterstützt die Node.js-Versionen 24, 25 und 26.
3. Er lädt Marinara Engine herunter, sofern es nicht schon installiert ist.
4. Er macht den Starter (das Skript `start-termux.sh`) ausführbar.
5. Er ruft den Starter zum ersten Mal auf.

Der Starter installiert die Abhängigkeiten der App, baut Marinara direkt auf dem Gerät und startet den lokalen Server. Ist die Node.js-Version zu alt, aktualisiert er sie gleich mit. Der erste Durchlauf dauert, weil die App gebaut wird. Danach geht es deutlich schneller.

Ist alles fertig, öffne diese Adresse im Android-Browser:

```
http://127.0.0.1:7860
```

Marinara lauscht auf dem Port aus `PORT` (dem Netzwerk-Port der App). Der Standard ist 7860. Bei einem abweichenden `PORT` nimmst du entsprechend diese Nummer.

Tipp: Für ein App-ähnliches Symbol öffnest du das Browser-Menü und wählst dort den Eintrag, der Marinara zum Startbildschirm hinzufügt. Wie der Eintrag genau heißt, ist von Browser zu Browser verschieden.

## Marinara erneut starten

Nach der ersten Einrichtung entfällt die Installation. Öffne Termux und führe aus:

```
cd Marinara-Engine
./start-termux.sh
```

Der Starter sucht nach Updates und startet danach Marinara. Soll die vorhandene Version ohne Blick auf GitHub starten, hängst du `--skip-update` an:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

Beim Aktualisieren der Abhängigkeiten räumt der Starter außerdem nicht mehr benötigte Pakete aus dem lokalen pnpm-Cache. So sammeln sich keine alten Releases im Gigabyte-Bereich auf dem Handy an; Chats, Einstellungen und andere Nutzerdaten von Marinara bleiben unangetastet.

## Zugriff von einem anderen Gerät

Standardmäßig macht der Starter Marinara im lokalen Netzwerk erreichbar. Ein Laptop oder ein zweites Handy im selben WLAN kann es also öffnen. Wie du die passende Adresse Schritt für Schritt findest, steht in den [Häufig gestellten Fragen](../FAQ.md).

## Aktualisieren

Bei jedem Start des Starters (`./start-termux.sh`) prüft dieser GitHub auf eine neuere Version und aktualisiert vor dem Start. Am einfachsten bleibst du also aktuell, indem du Marinara ganz normal startest.

Soll die installierte Version ohne Update starten, nimm den Skip-Schalter:

```
./start-termux.sh --skip-update
```

Damit die installierte Engine-Version über Neustarts hinweg erhalten bleibt, trag `AUTO_UPDATE_ENABLED=false` in die `.env` des Projekts ein. Manuelle Update-Befehle und **Settings → Advanced → Updates** bleiben davon unberührt.

Auch in der App selbst lässt sich nach Updates suchen. Öffne **Settings** (Einstellungen), wechsle auf den Tab **Advanced** (Erweitert) und klapp den Bereich **Updates** auf. Über **Check for Updates** (nach Updates suchen) erfährst du, ob ein neueres Release vorliegt. Die Schaltfläche **Apply Update** (Update anwenden) in der App ist standardmäßig deaktiviert und muss erst eingerichtet werden. Wie du sie aktivierst und nutzt, steht unter [Marinara Engine aktualisieren](../UPGRADING.md).

## Verwandte Anleitungen

- [Installation von Marinara Engine](../INSTALLATION.md)
- [PWA-Anleitung für iOS/iPadOS](ios-pwa.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Häufig gestellte Fragen](../FAQ.md)
