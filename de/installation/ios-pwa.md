# Anleitung für iOS / iPadOS (PWA)

Nutze Marinara Engine auf einem iPhone oder iPad. Apple lässt den Marinara-Server auf diesen Geräten nicht laufen, deshalb öffnest du in Safari einen Server, der auf einem anderen Gerät läuft. Danach kannst du ihn als PWA auf deinem Home-Bildschirm ablegen. Eine PWA (Progressive Web App) ist eine Website, die sich wie eine App in einem eigenen Fenster öffnet.

## Der schnelle Weg

1. Installiere und starte Marinara auf einem Rechner, einem Heimserver oder einem Android-Handy (siehe die Liste unten). Lass es laufen.
2. Richte auf diesem Rechner eine Anmeldung ein. Siehe [Fernzugriff](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Ermittle die IP-Adresse des Rechners (siehe unten).
4. Öffne auf deinem iPhone oder iPad **Safari** und ruf `http://` auf, gefolgt von dieser IP-Adresse und `:7860`.

Nimm auf deinem iPhone oder iPad nicht `127.0.0.1`. Diese Adresse bezeichnet das iPhone selbst.

## Wo der Server läuft

Der Server kann auf einem dieser Geräte laufen:

- Ein Windows-PC: [Installationsanleitung für Windows](windows.md).
- Ein Mac oder Linux-Rechner: [Installationsanleitung für macOS und Linux](macos-linux.md).
- Ein Android-Handy mit Termux: [Installationsanleitung für Android (Termux)](android-termux.md).
- Ein Docker- oder Podman-Container: [Im Container betreiben](containers.md).

## Verbindung aus Safari herstellen

Bevor du anfängst: Der Server muss laufen und dein Gerät hereinlassen, meist über eine Anmeldung. Siehe [Fernzugriff](../REMOTE_ACCESS.md).

1. Bring das Server-Gerät und dein iPhone oder iPad ins selbe Netzwerk, etwa dein WLAN zu Hause. Um dich von anderswo zu verbinden, nutz Tailscale, ein kostenloses Werkzeug, das deine Geräte über das Internet in einem privaten Netzwerk verbindet.
2. Ermittle die IP-Adresse des Server-Geräts. Führ auf dem Server-Rechner einen Befehl in einem Terminal aus (einem Fenster, in das du Befehle eintippst) und lies die Adresse ab. Sie sieht etwa so aus: `192.168.1.42`.

   - Windows (Eingabeaufforderung): `ipconfig`. Lies die **IPv4 Address** (IPv4-Adresse) ab.
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. Öffne **Safari** und ruf diese Adresse auf. Ersetze `<host-ip>` durch diese IP-Adresse. Der Standard-Port ist `7860`.

```text
http://<host-ip>:7860
```

4. Der Startbildschirm von Marinara erscheint.

Siehst du eine Anmeldeseite, melde dich mit Benutzername und Passwort des Servers an. Siehst du eine Einrichtungsseite, gib den einmaligen Einrichtungscode aus dem Log des Servers ein und wähl einen Benutzernamen und ein Passwort. Siehe [Fernzugriff](../REMOTE_ACCESS.md).

Wenn es nicht funktioniert hat: Prüf, ob der Server noch läuft und ob beide Geräte im selben Netzwerk oder in Tailscale sind. Prüf die IP-Adresse und den Port. Siehe [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Zum Home-Bildschirm hinzufügen

1. Öffne deinen Marinara-Server in **Safari**.
2. Tipp auf die Teilen-Schaltfläche, das Quadrat mit dem Pfeil nach oben.
3. Scroll im Teilen-Menü nach unten und tipp auf **Add to Home Screen** (Zum Home-Bildschirm hinzufügen).
4. Ändere bei Bedarf den Namen und tipp dann auf **Add** (Hinzufügen).

Auf deinem Home-Bildschirm erscheint ein Marinara-Symbol. Tipp darauf, um Marinara in einem eigenen Fenster zu öffnen, ohne Safari-Adressleiste.

## HTTPS nutzen, wenn die App Probleme macht

Eine PWA funktioniert am besten über HTTPS, eine sichere Verbindung, die mit `https://` beginnt. Eine einfache `http://`-Adresse funktioniert in Safari. Manche iOS- und iPadOS-Versionen schränken eine Home-Bildschirm-App auf einer einfachen `http://`-Adresse aber ein. Passiert das, stell Marinara über HTTPS bereit oder behalte es als Safari-Lesezeichen.

Tailscale allein macht aus einer Adresse noch kein HTTPS. Nutze eine Tailscale-Konfiguration, die HTTPS bereitstellt, oder bitte den Server-Betreiber, Marinara hinter HTTPS zu legen. Siehe [Fernzugriff](../REMOTE_ACCESS.md#serving-over-https).

<a id="clearing-and-reinstalling-the-pwa"></a>

## Die PWA löschen und neu installieren

Manchmal behält Safari eine ältere Version der App, oder die gespeicherte App hängt fest. Eine Neuinstallation behebt das meist. Deine Chats, Charaktere und Einstellungen liegen auf dem Server, deshalb löscht eine Neuinstallation sie nicht.

1. Halte das Marinara-Symbol auf deinem Home-Bildschirm gedrückt.
2. Tipp auf die Option zum Entfernen der App und bestätige.
3. Öffne die App **Settings** (Einstellungen) auf deinem iPhone oder iPad.
4. Tipp auf **Safari**. In neueren iOS- und iPadOS-Versionen liegt der Eintrag eventuell unter **Apps** und dann **Safari**.
5. Tipp auf **Advanced** (Erweitert) und dann auf **Website Data** (Website-Daten).
6. Such den Eintrag für deine Marinara-Adresse. Siehst du ihn nicht, tipp auf **Show All Sites** (Alle Websites anzeigen).
7. Wisch auf dem Eintrag nach links und tipp auf **Delete** (Löschen).
8. Öffne Marinara erneut in **Safari** und füg es mit den Schritten oben wieder zum Home-Bildschirm hinzu.

## Fehlerbehebung

**Die Seite lädt in Safari nicht.** Prüf, ob der Server läuft, ob beide Geräte im selben Netzwerk oder in Tailscale sind und ob IP-Adresse und Port `7860` stimmen. Siehe [Fernzugriff](../REMOTE_ACCESS.md) und [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

**Safari zeigt nach einem Update eine Anmelde- oder Einrichtungsseite.**

- Melde dich auf `/login` mit Benutzername und Passwort des Servers an.
- Gibt es noch keine Anmeldung, gib auf der Einrichtungsseite den einmaligen Einrichtungscode aus dem Server-Log ein.
- Gibt der Server keinen Code aus, richte die Anmeldung auf dem Server-Gerät unter **Settings → Advanced → Access** ein.
- Ein **403** kann bedeuten, dass dein iPhone nicht in `IP_ALLOWLIST` steht. Diese Liste ändert der Server-Betreiber.
- Die PWA kann die Server-Anmeldung nicht zurücksetzen. Der Server-Betreiber führt dafür auf dem Server im Marinara-Ordner `node scripts/reset-login.mjs` aus (in Docker: `docker exec <container> node scripts/reset-login.mjs`) oder ändert eine in `.env` gesetzte Anmeldung.

Siehe [Ausgesperrt nach dem Update](../REMOTE_ACCESS.md#locked-out-after-updating).

**Safari zeigt weiterhin einen alten Build.** Lad die Seite neu. Sieht sie danach immer noch alt aus, installier die PWA mit den Schritten oben neu.

**Die Home-Bildschirm-App schließt sich oder wird während der Generierung leer.** Öffne sie erneut und kehr zum Chat zurück. Ein gesunder Server arbeitet weiter: Chat-Antworten und Bildanfragen an Illustrator laufen auf dem Server weiter, und der wieder geöffnete Chat aktualisiert sich, sobald sie fertig sind. **Stop** bricht die Generierung im gewählten Chat weiterhin ab. Kommt der leere Bildschirm immer wieder, melde es zusammen mit deinen Support Diagnostics.

**Ein rotes Banner meldet, dass Speichervorgänge stillschweigend fehlschlagen.** Das ist eine Vertrauenswarnung des Servers zum Netzwerk, kein Problem deines iPhones oder iPads. Der Server-Betreiber muss deine Adresse als vertrauenswürdig eintragen. Siehe [Fernzugriff](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**Privilegierte Aktionen werden blockiert.** Manche Wartungsaktionen brauchen das Admin-Secret (ein zweites Passwort) vom Server-Betreiber. Speichere es auf deinem iPhone oder iPad unter **Settings → Advanced → Admin Access**. Siehe [Fernzugriff](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Verwandte Anleitungen

- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
- [Häufige Fragen](../FAQ.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
- [Installationsanleitung für Android (Termux)](android-termux.md)
