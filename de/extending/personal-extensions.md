# Personal Extensions

Eine **Personal Extension** (persönliche Erweiterung) ist ein kleines Stück Code, das Marinara um eine Schaltfläche, ein Panel oder eine Hilfsfunktion ergänzt. Professor Mari kann eine für dich schreiben, und du entscheidest, ob sie überhaupt jemals läuft. In dieser Anleitung erfährst du, wie du Erweiterungen prüfst, aktivierst, exportierst und im Notfall wiederherstellst. Wie du eigene schreibst, steht unter [Eigene Personal Extensions schreiben](writing-personal-extensions.md).

## Die Arten von Erweiterungen

| Name | Was es ist |
| --- | --- |
| Personal Extension | Eine Erweiterung, die Professor Mari für dich geschrieben hat. Sie erscheint als Entwurf unter **Settings → Addons**. |
| External Extension (externe Erweiterung) | Eine Erweiterung von jemand anderem oder eine, die du selbst geschrieben hast. Sie braucht die zusätzlichen Schritte unter [Importe von Fremdanbietern erlauben](#allow-third-party-imports). |
| Browser Extension (Browser-Erweiterung) | Läuft in deinem Browser in einer Sandbox. Standardmäßig sicher. |
| Server Extension (Server-Erweiterung) | Läuft auf dem Rechner, auf dem Marinara läuft, in einer Betriebssystem-Sandbox. Braucht eine unterstützte Plattform. |
| Full page access (Vollzugriff auf die Seite) | Eine Berechtigung, die die Sandbox aufhebt. Nur für Code, dem du voll vertraust. |

## Eine geteilte Erweiterung installieren

Bevor du anfängst: Erledige die beiden Schritte unter [Importe von Fremdanbietern erlauben](#allow-third-party-imports). Ohne sie sind die Import-Schaltflächen ausgeblendet.

1. Öffne **Settings → Addons**. Wähle unter **External Extensions** (externe Erweiterungen) für eine `.zip`-, `.json`-, `.css`- oder `.js`-Datei **Import Extension File** (Erweiterungsdatei importieren) oder für einen Ordner **Import Extension Folder** (Erweiterungsordner importieren).
2. Öffne den neuen Entwurf. Er ist deaktiviert und zeigt seinen Code und einen Hash, einen kurzen Fingerabdruck genau dieses Codes (Marinara verwendet SHA-256).
3. Lies den Code und die Liste **Requested access** (angeforderter Zugriff).
4. Wähle **Review and Run** (prüfen und ausführen) nur, wenn du genau diese Version akzeptierst. Danach wird die Erweiterung als aktiviert angezeigt.

Wenn es nicht funktioniert hat: Fehlen die Import-Schaltflächen, ist einer der beiden Schritte nicht erledigt. Denk daran, Marinara neu zu starten, nachdem du `.env` geändert hast.

## Eine Erweiterung von Professor Mari prüfen

Bevor du anfängst: Bitte [Professor Mari](../home/professor-mari.md), eine Erweiterung zu erstellen. Sie kann den Code speichern, ihn aber weder freigeben noch aktivieren. In diesem Bereich gibt es keine Schaltfläche **New Draft** (neuer Entwurf) und kein Bedienelement zum Importieren.

1. Öffne **Settings → Addons → Personal Extensions**. Ohne Entwürfe steht dort: „Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.“
2. Öffne den Entwurf und lies den Code. Prüf den Hash und die Liste **Requested access**.
3. Wähle **Review and Run** nur, wenn du genau diese Version akzeptierst.

Jeder Entwurf ist zunächst deaktiviert. Jede Änderung am Code, jede geänderte Berechtigung und jede wiederhergestellte Fassung deaktiviert die Erweiterung und verlangt eine neue Freigabe.

> **Warnung:** Eine Sandbox schränkt ein, was Code tun kann, macht ihn aber nicht vertrauenswürdig. Eine schädliche Erweiterung kann trotzdem Prozessorzeit verschwenden, bis ein Watchdog (ein Timer, der außer Kontrolle geratenen Code stoppt) sie beendet, ihren eigenen Speicher bis zum Limit füllen oder dich über Logs in die Irre führen. Erweiterungen mit Vollzugriff auf die Seite geben die Sandbox bewusst auf. Lies den Code, bevor du ihn aktivierst, und prüf bei Code von Fremdanbietern jede einzelne Zeile.

Wenn es nicht funktioniert hat: Änderungen von Professor Mari und jede wiederhergestellte Fassung setzen den Entwurf wieder auf deaktiviert. Prüf ihn erneut und achte darauf, dass der Hash im Dialog derjenige ist, den du gelesen hast.

## Was eine Erweiterung kann

Eine Browser-Erweiterung läuft in einer Sandbox (einem abgeschotteten Bereich) in deinem Browser. Sie kommt nicht an Marinaras Seite, Cookies, den Browser-Speicher oder das Netzwerk heran. Sie kann:

- privaten Speicher nutzen und Logs schreiben
- Schaltflächen, Menüeinträge und Panels hinzufügen, die Marinara in deinem Theme zeichnet
- die IDs des geöffneten Chats lesen
- ausgewählte Felder der aktiven Charaktere oder der Persona lesen, aber nur, wenn du diese Berechtigungen freigibst

Die vollständige Liste steht unter [Eigene Personal Extensions schreiben](writing-personal-extensions.md#what-a-browser-extension-can-do).

Eine Server-Erweiterung läuft in einem separaten Node-Prozess (einem Programm auf dem Server-Rechner) innerhalb einer Betriebssystem-Sandbox. Sie kommt nicht an Marinaras Dateien, deine Dateien, Server-Geheimnisse, das Netzwerk, Kindprozesse, Worker oder native Addons heran.

<a id="platform-support"></a>

### Unterstützte Plattformen

Browser-Erweiterungen sperrt der Browser in eine Sandbox, deshalb laufen sie überall. Server-Erweiterungen brauchen eine unterstützte Betriebssystem-Sandbox. Wo es keine gibt, bleiben sie deaktiviert, und Marinara führt sie nie ohne Sandbox aus.

| Plattform | Server-Erweiterungen |
| --- | --- |
| macOS | In einer Sandbox mit Seatbelt, der Sandbox von macOS |
| Linux mit Bubblewrap | In einer Sandbox mit Bubblewrap, einem Sandbox-Werkzeug für Linux |
| Linux ohne `bwrap` | Deaktiviert: `bwrap` installieren |
| Docker (Standard) | Deaktiviert: Container-Berechtigungen |
| Windows | Deaktiviert: Browser-Erweiterung nutzen |
| Android | Deaktiviert: Browser-Erweiterung nutzen |

Browser-Erweiterungen laufen auf jeder Plattform in einer Sandbox. Externe Erweiterungen mit Vollzugriff auf die Seite laufen nirgends in einer Sandbox und brauchen immer dein ausdrückliches Vertrauen.

Das offizielle Docker-Image enthält Bubblewrap, doch sein Standard-Container kann die verschachtelten Namespaces und Mounts nicht anlegen, die Bubblewrap braucht. Marinara prüft die Sandbox zur Laufzeit und lässt Server-Erweiterungen deaktiviert, wenn der Container sie verweigert. Unter [Fehlerbehebung](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) findest du die Anpassung der Docker-Berechtigungen und die damit verbundene Sicherheitsabwägung.

Unter Windows und Android gibt es keine unterstützte Prozess-Sandbox, deshalb stehen Server-Erweiterungen dort nicht zur Verfügung. Nimm eine Browser-Erweiterung oder betreibe den Marinara-Server unter macOS oder Linux mit `bwrap`.

<a id="allow-third-party-imports"></a>

## Importe von Fremdanbietern erlauben

Importe von Fremdanbietern sind standardmäßig gesperrt und ausgeblendet, weil sie Code ausführen, den andere geschrieben haben. Zwei Schritte geben sie frei:

1. Setze auf dem Rechner, auf dem Marinara läuft, `ENABLE_EXTERNAL_EXTENSIONS=true` in der Datei `.env` und starte Marinara danach neu. Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md).
2. Öffne **Settings → Advanced → Danger Zone**, scroll unter die Bedienelemente zum Löschen von Daten, lies die Warnung und schalte **Allow third-party extension imports** (Importe von Fremdanbietern erlauben) ein.

Danach zeigt **Settings → Addons** den Bereich **External Extensions** mit Bedienelementen für den Import von Dateien und Ordnern. Unterstützte Formate:

- `.personal-extension.zip` und kompatible `.zip`-Pakete
- `.json`-Manifeste
- `.css`
- `.js`, `.mjs` und `.cjs`
- `.server.js`, `.server.mjs` und `.server.cjs`

Ein Import bringt nie eine Freigabe mit und kann sich nicht selbst aktivieren. Die meisten Browser-Erweiterungen sollten in der sicheren Sandbox bleiben. Ein Paket mit der Kennzeichnung **Full page access** ist anders:

- Sein Code läuft in Marinaras Seite, ohne Sandbox.
- Es kann Chats und Karten lesen, den Browser-Speicher nutzen, Netzwerkanfragen stellen und Marinaras eigene APIs aufrufen.
- Aktiviere es erst, wenn du genau diese Version geprüft hast und ihr vertraust.
- Entwürfe von Professor Mari können diese Berechtigung nicht anfordern.

Als extern gelten außerdem alte Einträge, aus einem Profil importierte, von Hand abgelegte und solche unbekannter Herkunft. Sie bleiben ausgeblendet, lassen sich nicht freigeben und laufen nicht, bis beide Schritte erledigt sind.

Schaltest du einen der beiden Schritte wieder aus, werden alle importierten Erweiterungen deaktiviert. Schaltest du ihn wieder ein, laufen sie dadurch nicht erneut. Lade die Seite neu, falls eine Erweiterung mit Vollzugriff auf die Seite Änderungen hinterlassen hat.

Wenn es nicht funktioniert hat: Erscheinen die Bedienelemente zum Importieren nicht, prüf, ob beide Schritte erledigt sind und ob du am Server-Rechner arbeitest oder das Admin-Secret unter **Settings → Advanced → Admin Access** gespeichert hast.

## Export, Fassungen und Notfallhilfe

Über die Export-Aktion einer Erweiterung lädst du ein portables Paket herunter. Exportierte und wiederhergestellte Pakete bleiben deaktiviert. Stellst du eine frühere Fassung wieder her, wird daraus ebenfalls wieder ein deaktivierter Entwurf.

**Settings → Addons → Extension revision history** legt für jede Personal Extension und jede externe Erweiterung fest, wie viele frühere Code-Fassungen erhalten bleiben. Der Standard ist **10**. Wähle **0** bis **10**; **0** schaltet den Verlauf ab. Senkst du das Limit, wirst du um Bestätigung gebeten, bevor ältere Fassungen endgültig gelöscht werden. Aktueller Code, Freigaben, der Aktivierungszustand und gespeicherte Erweiterungsdaten bleiben erhalten. Änderungen über Professor Mari halten sich an dasselbe Limit.

Verhält sich eine Erweiterung daneben, wähle **Disable** (deaktivieren). Ist die Oberfläche nicht erreichbar, beende Marinara und setze im passenden `installed_extensions`-Eintrag den Wert `enabled` auf `"false"`. Setze `approvedHash` niemals von Hand.

## Verwandte Anleitungen

- [Eigene Personal Extensions schreiben](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Server-Konfiguration](../CONFIGURATION.md)
- [Marinara sichern und wiederherstellen](../data/backup-and-restore.md)
- [Fernzugriff](../REMOTE_ACCESS.md)
