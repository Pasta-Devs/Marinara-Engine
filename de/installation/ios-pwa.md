# Anleitung für iOS / iPadOS (PWA)

In dieser Anleitung erfährst du, wie du Marinara Engine auf einem iPhone oder iPad nutzt. iOS und iPadOS können den Marinara-Server nicht selbst betreiben. Stattdessen verbindest du dich mit einem Server auf einem anderen Gerät und legst ihn als Web-App auf dem Home-Bildschirm ab.

## Unter iOS läuft der Server auf einem anderen Gerät

Marinara Engine besteht aus zwei Teilen: einem Server, der die eigentliche Arbeit erledigt, und einer Web-App, die du im Browser ansiehst. Auf iPhone und iPad erlaubt Apple es nicht, den Server auf dem Gerät laufen zu lassen. Also läuft der Server woanders, und du öffnest ihn in Safari auf dem iPhone oder iPad.

Als Host taugt jedes dieser Systeme:

- ein Windows-PC (siehe [Installationsanleitung für Windows](windows.md)),
- ein Mac oder ein Linux-Rechner (siehe [Installationsanleitung für macOS / Linux](macos-linux.md)),
- ein Android-Handy mit Termux (siehe [Installationsanleitung für Android (Termux)](android-termux.md)),
- ein Docker- oder Podman-Container (siehe [Im Container betreiben](containers.md)).

Das iPhone oder iPad erreicht diesen Server über das Netzwerk. Das funktioniert wie das Aufrufen einer beliebigen Website – nur ist die Website dein eigener Marinara-Server.

## Verbindung aus Safari herstellen

Sobald der Server auf dem Host-Gerät läuft, geht es so weiter:

1. Achte darauf, dass das Host-Gerät und dein iPhone oder iPad im selben Netzwerk hängen oder beide im selben Tailscale-Netzwerk. LAN meint das lokale Netzwerk, also zum Beispiel das WLAN zu Hause. Tailscale ist ein kostenloses Werkzeug, das Geräte über das Internet in einem privaten Netzwerk zusammenschließt.
2. Ermittle die Adresse des Host-Servers. Sie sieht aus wie im Beispiel unten. Ersetze `<host-ip>` durch die LAN- oder Tailscale-IP-Adresse des Host-Geräts. Der Standard-Port ist `7860`.

```
http://<host-ip>:7860
```

3. Öffne **Safari** auf dem iPhone oder iPad.
4. Tippe die Adresse in die Safari-Adresszeile ein und ruf sie auf.
5. Im Browser sollte nun der Startbildschirm von Marinara erscheinen.

Lädt die Seite nicht oder erscheint eine Passwortabfrage, hilft der Abschnitt Fehlerbehebung weiter unten. Über Netzwerkzugriff und Passwörter entscheidet die Person, der der Server gehört. Diese Server-Einstellungen stehen im [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md), nicht auf dem iPhone oder iPad.

## Zum Home-Bildschirm hinzufügen

Marinara lässt sich als PWA speichern und öffnet sich dann wie eine normale App. PWA steht für Progressive Web App: eine Website, die in einem eigenen Fenster läuft und ein eigenes Symbol auf dem Home-Bildschirm bekommt.

1. Öffne den Marinara-Server in **Safari** (siehe die Schritte oben).
2. Tippe auf die Teilen-Schaltfläche – das Quadrat mit dem Pfeil nach oben.
3. Scroll im Teilen-Menü nach unten und tippe auf **Add to Home Screen** (Zum Home-Bildschirm hinzufügen).
4. Ändere bei Bedarf den Namen und tippe dann auf **Add** (Hinzufügen).
5. Auf dem Home-Bildschirm liegt jetzt ein Marinara-Symbol.

Ein Tippen auf dieses Symbol öffnet Marinara in einem eigenen Fenster, ganz ohne Safari-Adresszeile.

## Hinweis zu HTTPS

Am zuverlässigsten laufen PWAs über HTTPS. HTTPS bedeutet eine sichere, verschlüsselte Web-Verbindung, erkennbar am `https://` am Anfang der Adresse.

Für den normalen Betrieb reicht in Safari auch einfaches HTTP im LAN. Manche iOS- und iPadOS-Versionen schränken das eigenständige PWA-Verhalten bei einer reinen `http://`-Adresse allerdings ein. Passiert das, stell Marinara über HTTPS bereit.

Tailscale gibt jedem Gerät eine feste private Adresse und verbessert die Erreichbarkeit. Aus einer `http://`-Adresse wird dadurch aber noch kein HTTPS. Nutze eine Tailscale-Konfiguration, die ausdrücklich HTTPS bereitstellt, oder bitte die Person hinter dem Server darum, Marinara hinter HTTPS zu legen.

Diese Möglichkeiten erklärt der [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md). Macht eine reine HTTP-Adresse als Home-Bildschirm-App Ärger, behalte sie lieber als Safari-Lesezeichen.

## PWA löschen und neu einrichten

Manchmal zeigt Safari hartnäckig eine ältere Version der App, oder die gespeicherte Web-App hakt. Meist hilft es, die Home-Bildschirm-App neu einzurichten.

1. Halte das Marinara-Symbol auf dem Home-Bildschirm gedrückt.
2. Tippe auf die Option zum Entfernen oder Löschen der App und bestätige.
3. Öffne die App **Settings** (Einstellungen) auf dem iPhone oder iPad.
4. Tippe auf **Safari**. In neueren iOS- und iPadOS-Versionen steckt der Eintrag unter Umständen unter **Apps** und dann **Safari**.
5. Tippe auf **Advanced** (Erweitert) und dann auf **Website Data** (Website-Daten).
6. Such den Eintrag für die Adresse deines Marinara-Hosts. Fehlt er in der Liste, tippe auf **Show All Sites** (Alle Websites anzeigen).
7. Wisch auf dem Eintrag nach links und tippe auf **Delete** (Löschen). Damit verschwinden die alten gespeicherten Dateien dieses Servers.
8. Öffne Marinara erneut in **Safari**, wie unter Verbindung aus Safari herstellen beschrieben.
9. Leg es wieder auf dem Home-Bildschirm ab, wie unter Zum Home-Bildschirm hinzufügen beschrieben.

Chats, Charaktere und Einstellungen liegen auf dem Server, nicht auf dem iPhone oder iPad. Beim Neueinrichten der Home-Bildschirm-App geht davon nichts verloren.

## Fehlerbehebung

**Die Home-Screen-App schließt sich oder wird während der Generierung leer.** Öffne sie erneut und kehre zum Chat zurück. Einen gesunden Server musst du nicht neu starten. Automatische Chat-Antworten und manuelle oder wiederholte Bildanfragen ausschließlich über Illustrator laufen nach einem verlorenen Browserkontakt auf dem Server weiter. Der wieder geöffnete Chat prüft auf laufende Arbeit und lädt gespeicherte Nachrichten und Galeriebilder nach deren Abschluss neu. **Stop** bricht die Generierung des gewählten Chats weiterhin ab. Tritt der leere Bildschirm erneut auf, melde deine Support Diagnostics und ob erneutes Öffnen den Chat zurückbringt. Diese Wiederherstellung erkennt oder verhindert nicht jeden iOS-Browserfehler.

**Die Seite lädt in Safari nicht.** Prüf, ob der Server auf dem Host-Gerät noch läuft. Prüf, ob beide Geräte im selben Netzwerk oder im selben Tailscale-Netzwerk sind. Kontrollier IP-Adresse und Port `7860`. Bei tiefer gehenden Netzwerkfragen helfen der [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md) und die [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md).

**Safari fragt nach Benutzername und Passwort.** Dann ist der Passwortschutz für entfernte Geräte aktiviert. Hol dir Benutzername und Passwort bei der Person, die den Server betreibt. Die Einrichtung beschreibt der [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md).

**Safari zeigt weiterhin einen alten Stand.** Lad die Seite zuerst neu. Sieht sie danach immer noch alt aus, folge den Schritten unter PWA löschen und neu einrichten weiter oben.

**Ein rotes Banner meldet, dass Speichervorgänge stillschweigend fehlschlagen.** Das ist eine Vertrauenswarnung des Servers zum Netzwerk, kein Problem des iPhones oder iPads. Die Person hinter dem Server muss deine Adresse als vertrauenswürdig eintragen. Siehe [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md) und [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md).

**Privilegierte Aktionen werden blockiert.** Manche Wartungsaktionen brauchen ein Admin-Secret vom Server-Betreiber. Auf dem iPhone oder iPad hinterlegst du diesen Wert unter **Settings**, dann **Advanced**, dann **Admin Access**. Was das Admin-Secret ist und wie du eines bekommst, erklärt der [Leitfaden zum Fernzugriff](../REMOTE_ACCESS.md).

## Verwandte Anleitungen

- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
- [Häufig gestellte Fragen](../FAQ.md)
- [Fehlerbehebung für Marinara Engine](../TROUBLESHOOTING.md)
- [Installationsanleitung für Android (Termux)](android-termux.md)
