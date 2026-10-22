# Fernzugriff: Anmeldung und IP-Allowlist

In dieser Anleitung erfährst du, wie du Marinara Engine von einem anderen Gerät aus erreichst – vom Handy, vom Laptop oder von einem Docker-Container. Sie behandelt die wichtigste Option, eine Anmeldung. Dazu kommen die IP-Allowlist, Login-Proxys, HTTPS, Admin Access (Administrator-Zugriff) und die Meldung „save blocked“ zum Thema CSRF. Fast alles dazu steht in der `.env`-Datei des Servers, nicht in der App.

Ein paar Begriffe, die durchgehend vorkommen:

- `.env`-Datei: eine einfache Textdatei mit Einstellungen, die im Marinara-Engine-Ordner neben `package.json` liegt.
- Loopback: der Rechner, auf dem der Server tatsächlich läuft. Seine Adresse lautet `127.0.0.1` oder `localhost`.
- Fernzugriff: Marinara von einem Gerät aus öffnen, das NICHT der Rechner mit dem Server ist.

## Was Marinara standardmäßig blockiert

Zum Schutz der Daten lehnt eine frische Marinara-Installation Verbindungen von anderen Geräten ab, solange keine Zugriffskontrolle eingerichtet ist. Standardmäßig gelten nur drei Arten von Clients als vertrauenswürdig:

1. Loopback (`127.0.0.1` oder `::1`), also der Rechner mit dem Server selbst. Besucher, die ein Reverse-Proxy oder Tunnel auf demselben Rechner weiterreicht, zählen nicht dazu; siehe [Reverse-Proxys und Tunnel auf demselben Rechner](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Tailscale-Geräte im eigenen Tailnet. Tailscale ist ein Werkzeug für private Netzwerke, seine Adressen liegen im Bereich `100.64.0.0/10`.
3. Docker-Clients auf demselben Host. Marinara erkennt den üblichen Bridge-Bereich `172.16.0.0/12` sowie das exakte Standard-Gateway des Containers – damit sind auch Docker Desktop und eigene Adresspools abgedeckt.

Alles andere, etwa dein Handy im selben WLAN oder ein Client aus dem öffentlichen Internet, ist blockiert, bis du eine Anmeldung einrichtest. Öffnet ein blockiertes Gerät Marinara im Browser, erscheint eine dunkle Einrichtungsseite. Ihr Titel lautet **This Marinara Engine install needs a login before remote devices can connect.** Die Seite hat ein Formular für den einmaligen Einrichtungscode aus dem Server-Log, sodass du die Anmeldung von diesem Gerät aus einrichten kannst.

Wenn du nichts tust und nie ein Passwort setzt, bleibt Marinara auf diese drei vertrauenswürdigen Quellen beschränkt. Das ist der sichere Standard.

## Wo die .env-Datei liegt

Alle Zugriffseinstellungen stehen in der `.env`-Datei im Projekt-Wurzelordner, direkt neben `package.json`. Falls noch keine existiert, kopiere die Beispieldatei:

```bash
cp .env.example .env
```

Öffne `.env` mit einem beliebigen Texteditor. Die meisten Zugriffseinstellungen greifen innerhalb weniger Sekunden ohne Neustart – dazu zählen Basic Auth, die IP-Allowlist, das Admin-Secret und die CSRF-Herkünfte. Ein paar hardwarenahe Einstellungen brauchen weiterhin einen Neustart, darunter `PORT`, `HOST` und die Pfade zum HTTPS-Zertifikat.

Manchmal erreichen andere Geräte den Server überhaupt nicht: Statt eines 403 läuft die Verbindung in ein Zeitlimit. Dann lauscht der Server womöglich nur auf dem lokalen Rechner. Lass ihn auf allen Netzwerkschnittstellen lauschen:

```env
HOST=0.0.0.0
```

Standard-Bind-Adresse je nach Startweg:

| Startweg | `HOST`-Standard |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, Windows-Installer, `start-termux.sh` | `0.0.0.0` |
| Docker-Image | `0.0.0.0` im Container |
| `docker-compose.yml` | Veröffentlicht den Port nur auf `127.0.0.1` |

## Welche Option passt zu dir

Lies die Liste der Reihe nach und halte beim ersten Punkt an, der auf dich zutrifft.

1. Du verbindest dich nur über Tailscale oder nur aus Docker-Containern auf demselben Host. Dann ist nichts zu tun, es funktioniert bereits.
2. Du willst Marinara vom Handy, Tablet oder Laptop im heimischen WLAN erreichen. Richte eine Anmeldung ein (Option 1 unten).
3. Du stellst Marinara ins öffentliche Internet. Richte eine Anmeldung ein und nutze HTTPS.
4. Ein Login-Proxy in deinem Netzwerk, etwa tinyauth, Authelia oder Authentik, lässt bereits jeden Besucher sich anmelden. Lies [Login-Proxys (Forward-Auth)](#login-proxies-forward-auth).

Eine Anmeldung ist die flexibelste Wahl. Sie funktioniert von jeder IP-Adresse aus, braucht keine Einrichtung pro Gerät, und jeder Browser bleibt angemeldet.

<a id="option-1-login-recommended"></a>

## Option 1: Anmeldung (empfohlen)

Eine Anmeldung besteht aus Benutzername und Passwort, die jedes entfernte Gerät braucht. Du kannst sie auf drei Wegen einrichten:

- **In Settings.** Gehe in einem Browser, der schon angemeldet ist oder auf dem Computer läuft, auf dem Marinara läuft (öffne `http://localhost:7860`), zu **Settings → Advanced → Access**. Lege unter **Remote login** Benutzername und Passwort fest. Solange noch keine Anmeldung existiert, kann ein Gerät, das Marinara abweist, etwa der Browser auf einem Docker-Host, den Einrichtungscode aus dem Server-Log am selben Ort eingeben.
- **Mit dem Einrichtungscode, von jedem Gerät aus.** Solange keine Anmeldung gesetzt ist und der Server über Loopback hinaus lauscht, gibt er einen einmaligen Einrichtungscode in sein Log aus. Die Log-Zeile beginnt mit `[login] One-time setup code:`. Du findest sie im Terminal, in dem Marinara läuft. Unter Docker führst du `docker logs <container> 2>&1 | grep "setup code"` aus. Die Warnung zur Zugriffsverweigerung im Log wiederholt den Code, solange keine Anmeldung existiert. Öffne dann Marinara auf einem beliebigen Gerät. Die Seite, die das Gerät blockiert, hat ein Formular für den Einrichtungscode, einen Benutzernamen und ein Passwort. Der Code sieht aus wie `XXXX-XXXX-XXXX-XXXX`. Großbuchstaben, Leerzeichen und Bindestriche spielen keine Rolle. Jeder Code funktioniert nur einmal; ein Neustart oder Reset gibt einen neuen aus. Unter Docker zeigt die Seite außerdem, wie du die Anmeldung in der `.env`-Datei im Datenordner (`/app/data/.env`) oder in der Liste `environment:` deiner Compose-Datei festlegst (danach `docker compose up -d` ausführen). Nutze diesen Weg für Docker- und NAS-Installationen ohne Browser auf dem Host. Marinara zeigt lokalen Besuchern und angemeldeten Sitzungen ein Banner zur fehlenden Anmeldung, als Karte am unteren Bildschirmrand.
- **In `.env`.** Füge zwei Zeilen hinzu:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Eine Anmeldung in `.env` hat Vorrang vor einer in der App eingerichteten, und du änderst sie nur in `.env`. Speichere `.env`; die Änderung greift innerhalb weniger Sekunden, ganz ohne Neustart.

Wähle ein starkes, einmaliges Passwort. Die App verlangt mindestens 10 Zeichen. Ein zufälliges lässt sich so erzeugen:

```bash
openssl rand -base64 24
```

Folge dann diesen Schritten vom entfernten Gerät aus.

1. Öffne Marinara in deinem Browser über die Adresse des Servers, zum Beispiel `http://192.168.1.50:7860`.
2. Melde dich auf der Anmeldeseite mit Benutzername und Passwort an.
3. Die App sollte nun laden. Der Browser bleibt bis zu einem Jahr angemeldet, bis du dich abmeldest. Skripte und API-Clients senden Benutzername und Passwort bei jeder Anfrage mit (Basic Auth).

Um ein weiteres Gerät ohne Passworteingabe anzumelden, nutze einen Kopplungscode. Öffne auf einem angemeldeten Gerät **Settings → Advanced → Access** und wähle **Add a device**. Gib den Code dann auf der Anmeldeseite des neuen Geräts ein. Der Code gilt einmal und nur wenige Minuten. Ein abgelaufener Code erhält eine eigene Meldung; erzeuge dann einen neuen. Unter **Signed-in devices** siehst du jedes Gerät mit seiner Anmeldeart und dem Datum der ersten Anmeldung. Du kannst jedes Gerät abmelden, auch das, an dem du gerade sitzt. Du kannst auch das Passwort ändern oder entfernen. Dafür fragt Marinara nach dem aktuellen Passwort, außer du arbeitest auf dem Computer, auf dem Marinara läuft, oder hast `ADMIN_SECRET` gesetzt.

Wenn du das Passwort vergisst, führe `pnpm reset-login` auf dem Computer aus, auf dem Marinara läuft. Unter Docker führst du `docker exec <container> node scripts/reset-login.mjs` aus. Das entfernt die in der App eingerichtete Anmeldung und meldet jeden Browser ab. Lauscht der Server über Loopback hinaus, gibt er danach einen neuen Einrichtungscode aus. Nur wenn dieser Befehl nicht funktioniert, lösche stattdessen `.remote-login.json` und `.remote-sessions.json` aus dem Datenordner. Mit dem Standardordner `/app/data` führst du `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json` aus; hast du `DATA_DIR` geändert, nutze diesen Ordner. Eine Anmeldung in `.env` änderst du in `.env`.

**Headless-Server ohne Browser?** Eine native Installation auf einem Headless-Server lauscht nur auf Loopback und gibt keinen Einrichtungscode aus. Führe auf deinem eigenen Computer `ssh -L 7860:127.0.0.1:7860 user@server` aus. Öffne dann dort `http://localhost:7860` und nutze **Settings**.

Nach 10 verschiedenen falschen Passwörtern oder Codes innerhalb von 15 Minuten lehnt Marinara Anmeldungen von dieser Adresse mit **429 Too Many Requests** ab, bis die 15 Minuten vorbei sind. Ein richtiges Passwort vor Ablauf dieser Zeit setzt den Zähler zurück. Besucher, die ein Reverse-Proxy oder Tunnel auf dem Host weiterreicht, teilen sich einen Zähler, und wenn sich einer von ihnen anmeldet, wird er nicht zurückgesetzt. Auch ein Neustart des Servers setzt ihn zurück. Ein Browser, der sich schon einmal angemeldet hat, kommt mit dem richtigen Passwort weiterhin hinein, falsche Passwörter anderer Leute können dich also nicht von einem Gerät aussperren, das du bereits nutzt. Die Anmeldeseite zeigt dir, wie viele Minuten du warten musst. Wenn du das Passwort vergisst, hat die Anmeldeseite einen Hinweis **Forgot the password?**.

Im Browser-Dialog steht standardmäßig **Marinara Engine**. Diesen Text kannst du mit `BASIC_AUTH_REALM` ändern.

Manche Clients umgehen das Passwort auch bei aktiviertem Basic Auth:

- Loopback (`127.0.0.1`, `::1`) – auf dem Rechner mit dem Server brauchst du also nie ein Passwort. Besucher, die ein Reverse-Proxy oder Tunnel auf diesem Rechner weiterreicht, brauchen es trotzdem.
- Jede Adresse in `IP_ALLOWLIST`. Achtung: Eine gesetzte Allowlist blockiert zugleich jede nicht gelistete Adresse (siehe Option 2).
- Direkter Tailscale-Verkehr (`100.64.0.0/10`), solange du dessen Ausnahme nicht abschaltest.
- Docker-Bridge- und Gateway-Verkehr, aber nur, solange weder Anmeldung noch Allowlist noch `TRUSTED_AUTH_PROXY` gesetzt ist (siehe [Ausnahme für Tailscale und Docker](#tailscale-and-docker-bypass)).
- Die Adresse `/api/health`, damit Verfügbarkeitsprüfungen weiterlaufen. Wer die App nicht öffnen darf, erhält nur `{"status": "ok"}`; Versions-, System- und Modelldetails bleiben diesem Rechner, vertrauenswürdigen Netzwerken und angemeldeten Browsern vorbehalten.

Wichtig: Basic Auth kodiert das Passwort nur, verschlüsselt wird es nicht. Wer eine unverschlüsselte Verbindung mitliest, kann es lesen. Wenn Marinara aus dem öffentlichen Internet erreichbar ist, kombiniere Basic Auth mit HTTPS (siehe unten).

## Option 2: IP-Allowlist

Die IP-Allowlist lässt bestimmte Adressen ohne Passwort durch. Das passt gut, wenn deine Geräte stabile IP-Adressen haben. Trage eine kommagetrennte Liste aus Adressen oder Bereichen ein:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

Das `/24` im Beispiel ist CIDR-Schreibweise. CIDR ist eine Kurzform, um einen ganzen Adressbereich in einem einzigen Eintrag zu notieren. `192.168.1.0/24` umfasst etwa jede Adresse von `192.168.1.0` bis `192.168.1.255`. Eine nackte Adresse ohne Schrägstrich wie `203.0.113.42` trifft dagegen nur genau dieses eine Gerät.

So verhält sich die IP-Allowlist:

- Jede Adresse außerhalb der Liste wird mit **403 Forbidden** abgewiesen.
- Loopback ist immer erlaubt, du kannst dich also nicht vom lokalen Zugriff aussperren. Besucher, die ein Reverse-Proxy oder Tunnel auf demselben Rechner weiterreicht, sind kein Loopback, die Allowlist blockiert sie also. Nutze hinter einem Proxy Basic Auth.
- Unter Docker Desktop, OrbStack und rootless Docker erreicht jedes Gerät den Container über dieselbe Gateway-Adresse, die Allowlist kann die Geräte also nicht unterscheiden. Nutze dort Basic Auth.
- Auch direkter Tailscale-Verkehr überspringt die Liste. Docker-Bridge- und Gateway-Verkehr überspringt sie nur, solange weder Anmeldung noch Allowlist noch ein gültiger `TRUSTED_AUTH_PROXY` gesetzt ist (siehe [Ausnahme für Tailscale und Docker](#tailscale-and-docker-bypass)).
- Ungültige Einträge werden ignoriert und protokolliert. Der Server stürzt deswegen nicht ab.
- Die Allowlist bleibt auch mit aktivem Basic Auth strikt. Gelistete Adressen überspringen die Passwortabfrage. Jede andere Adresse bleibt mit **403 Forbidden** blockiert und bekommt nie einen Anmeldedialog zu sehen.

Ein gemischter Aufbau ist damit nicht möglich, bei dem gelistete Geräte das Passwort überspringen und alle anderen sich anmelden. Sollen sich andere Geräte per Passwort anmelden, lass `IP_ALLOWLIST` leer und nutze allein Basic Auth.

Du kannst die Prüfung vorübergehend abschalten, ohne die Liste zu löschen. Praktisch, wenn du von einer neuen IP-Adresse aus Fehler suchst. Setze den Schalter auf false:

```env
IP_ALLOWLIST_ENABLED=false
```

<a id="private-network-bypass-reference"></a>

## Ausnahme für private Netzwerke (Referenz)

Einige Schalter heben die Sperre für ein vertrauenswürdiges privates Netzwerk auf. Sie sind für Sonderfälle gedacht. Eine Anmeldung ist die bessere Wahl. Die Schalter und ihre Risiken findest du unter [Zugriffskontrolle](CONFIGURATION.md#access-control).

<a id="tailscale-and-docker-bypass"></a>

## Ausnahme für Tailscale und Docker

Standardmäßig vertraut Marinara einem Gerät, das sich direkt über dein Tailscale-Netzwerk verbindet. Es vertraut außerdem dem eigenen Host eines Docker-Containers. Eine Anmeldung, eine IP-Allowlist oder `TRUSTED_AUTH_PROXY` beendet das automatische Docker-Vertrauen, sodass dann jedes Gerät seine Anmeldung oder seinen Platz auf der Allowlist braucht. Die Schalter, die das ändern, stehen unter [Zugriffskontrolle](CONFIGURATION.md#access-control).

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Reverse-Proxys und Tunnel auf demselben Rechner

Ein Reverse-Proxy oder Tunnel auf dem Rechner, auf dem Marinara läuft – etwa nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve oder Funnel oder ngrok –, verbindet sich über Loopback mit Marinara. Marinara erkennt das an den Weiterleitungs-Headern, die der Proxy hinzufügt: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, die Identitäts-Header von Tailscale oder `Via`. Marinara erkennt außerdem eine Anfrage, die über HTTP/1.0 eintrifft, weil Browser das nie verwenden, das Standard-`proxy_pass` von nginx aber schon. Marinara erkennt außerdem eine Anfrage, deren Host einen anderen Rechner angibt, etwa eine Domain oder eine LAN-Adresse, auch wenn der Proxy keine Header hinzufügt. Dann behandelt es jede Anfrage als das, was sie ist: ein entfernter Besucher.

- Die Anmeldung greift (siehe [Option 1](#option-1-login-recommended)). Ohne sie sehen Besucher die Einrichtungsseite. Richte die Anmeldung in **Settings** auf diesem Computer oder in `.env` ein.
- `IP_ALLOWLIST` blockiert die weitergeleiteten Besucher, weil der Proxy ihre echten Adressen verbirgt.
- Privilegierte Aktionen brauchen das Admin-Secret, und Funktionen, die nur über Loopback gehen, bleiben gesperrt.

Dein eigener Browser auf diesem Rechner, geöffnet unter `http://127.0.0.1:7860` oder `http://localhost:7860`, bleibt ohne Passwort.

Caddy, Traefik, Cloudflare Tunnel, Tailscale und ngrok fügen Weiterleitungs-Header von sich aus hinzu. Bei nginx empfiehlt sich diese Zeile weiterhin im `location`-Block:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Werkzeuge, die rohe Verbindungen weiterleiten, etwa `socat` oder `ssh -R`, fügen keine Header hinzu, ihr Verkehr sieht also lokal aus. Veröffentliche Marinara nicht damit.

Wenn dein Proxy schon jeden Besucher sich anmelden lässt, bevor er etwas weiterleitet, siehe [Login-Proxys (Forward-Auth)](#login-proxies-forward-auth).

<a id="login-proxies-forward-auth"></a>

## Login-Proxys (Forward-Auth)

Ein Forward-Auth-Proxy, etwa [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io) oder oauth2-proxy, lässt jeden Besucher sich anmelden, bevor er die Anfrage weiterleitet. Ist ein solcher Proxy der einzige Weg zu Marinara, kannst du die zweite Marinara-Anmeldung überspringen. Setze das nicht ohne einen solchen Proxy.

Trage die Adresse des Proxys in `.env` ein:

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara lässt dann jede Anfrage durch, deren Verbindung von dieser Adresse kommt. Marinara fragt dafür nicht nach einer eigenen Anmeldung und gibt keinen Einrichtungscode aus. Marinara prüft die Adresse der Verbindung selbst. Weiterleitungs-Header wie `X-Forwarded-For` ignoriert es dafür. Anfragen vom Proxy überspringen auch `IP_ALLOWLIST`, weil der Proxy entscheidet, wer hineinkommt. Sie zählen nicht als lokal, privilegierte Aktionen brauchen also weiterhin das Admin-Secret. **Settings → Advanced → Access** zeigt **Trusted login proxy: Set**, solange die Einstellung aktiv ist.

Bevor du sie setzt:

- **Der Proxy muss auf jedem Pfad nach einer Anmeldung fragen.** Dazu gehören `/api/`, WebSocket-Verbindungen und statische Dateien. Ein Pfad, den der Proxy ohne Anmeldung durchlässt, steht jedem offen.
- **Marinara darf nicht am Proxy vorbei erreichbar sein.** Binde Marinara an eine Adresse, die nur der Proxy erreicht, oder sperre den Port per Firewall. Unter Docker stellst du Proxy und Marinara in dasselbe Docker-Netzwerk, gibst dem Proxy eine feste Adresse darin und veröffentlichst den Port von Marinara nicht. Läuft der Proxy stattdessen auf dem Docker-Host, veröffentliche den Port nur auf Loopback (`127.0.0.1:7860:7860`): Docker Desktop und OrbStack zeigen jeden LAN-Client eines veröffentlichten Ports an der Docker-Gateway-Adresse, derselben Adresse wie der Proxy. Kann ein anderes Gerät Marinara direkt erreichen, überspringt es die Anmeldung des Proxys.
- **Trage nur die eigene Adresse des Proxys ein.** Ein Bereich muss innerhalb privater Adressen liegen; Marinara ignoriert andere Bereiche. Es protokolliert für jeden Bereich eine Warnung, weil jedes Gerät in einem Bereich die Anmeldung überspringt.
- **Füge den öffentlichen Namen hinzu wie bei jedem anderen Proxy.** Trage den Hostnamen in `TRUSTED_HOSTS` und den Origin in `CSRF_TRUSTED_ORIGINS` ein (siehe [Warum wird mein Speichern blockiert (CSRF)](#why-is-my-save-blocked-csrf)).

Ist `TRUSTED_AUTH_PROXY` gesetzt, beendet Marinara auch das automatische Docker-Vertrauen. Direkte Besucher, die nicht der Proxy sind, brauchen die Marinara-Anmeldung oder die IP-Allowlist. Marinara zeigt dann auch kein Banner „no login yet“.

Läuft der Proxy auf demselben Rechner wie Marinara, nutze `TRUSTED_AUTH_PROXY=127.0.0.1` und richte den Proxy auf `127.0.0.1:7860`, nicht auf `localhost:7860`. Ein Proxy, der `localhost` anwählt, kann sich von `::1` aus verbinden, was nicht zu `127.0.0.1` passt. Dann wird jeder andere Proxy oder Tunnel auf diesem Computer ebenfalls vertraut, nutze es also nur, wenn der Login-Proxy der einzige ist. Das gibt weitergeleiteten Besuchern nicht den Zugriff des lokalen Rechners.

Ein Caddy-Beispiel mit Marinara unter `192.168.1.20:7860`:

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Für Authelia nutzt du `forward_auth authelia:9091` mit `uri /api/authz/forward-auth`. Authentik liefert außerdem eigene Anmeldeseiten über den Proxy aus. Lege seine Zeilen in einen `route`-Block, damit Caddy ihre Reihenfolge einhält und der Outpost-Pfad nicht selbst durch Forward-Auth läuft:

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Für Traefik und nginx folge der Forward-Auth-Anleitung deines Proxys. Marinara braucht nicht mehr als die Adresse des Proxys.

## Betrieb über HTTPS

HTTPS verschlüsselt die Verbindung mit TLS. TLS ist die Verschlüsselung, die aus einer einfachen `http`-Adresse eine sichere `https`-Adresse macht. Nutze HTTPS immer dann, wenn die Installation außerhalb eines vollständig vertrauenswürdigen privaten Netzwerks erreichbar ist – erst recht zusammen mit Basic Auth.

Dafür gibt es zwei Wege.

1. Eingebautes TLS. Verweise den Server auf eine Zertifikats- und eine Schlüsseldatei:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Reverse-Proxy. Stelle Marinara hinter nginx, Caddy, Traefik oder einen Cloudflare Tunnel. Der Proxy übernimmt HTTPS und leitet auf demselben Rechner per einfachem HTTP an Marinara weiter. Lies vorher [Reverse-Proxys und Tunnel auf demselben Rechner](#reverse-proxies-and-tunnels-on-the-same-computer).

Zertifikat und Schlüssel müssen vorliegen, bevor du `SSL_CERT` und `SSL_KEY` setzt. Erzeugen lassen sie sich für den lokalen Einsatz etwa mit `mkcert`, für eine öffentliche Domain mit `certbot`. Fehlen die Dateien oder sind sie nicht lesbar, bricht der Server beim Start ab und nennt die genauen Pfade, die er versucht hat.

## Admin Access und heikle Aktionen

Manche Aktionen sind besonders heikel: Daten löschen, Backups erstellen oder herunterladen, Profile importieren und exportieren, Themes installieren und die Local-Model-Laufzeitumgebung installieren. Sie brauchen zusätzlich zur gewählten Zugriffsoption ein eigenes gemeinsames Geheimnis, das Admin-Secret.

Auf dem Loopback-Rechner funktionieren diese Aktionen meist ohne Admin-Secret. Von einem entfernten Gerät aus musst du es einrichten. So geht's:

1. Setze in der `.env` einen starken Zufallswert und speichere. Er greift innerhalb weniger Sekunden, ohne Neustart.

```env
ADMIN_SECRET=some-long-random-string
```

2. Öffne Marinara auf dem entfernten Gerät und geh zu **Settings** (Einstellungen), dann zum Tab **Advanced** (Erweitert) und dort zum Abschnitt **Admin Access**.
3. Füge denselben Wert in das Feld ein (sein Platzhalter lautet **ADMIN_SECRET**) und klick auf **Save** (Speichern).
4. Es sollte die Meldung **Admin secret saved for this browser** erscheinen.

Ein paar Dinge zum Admin-Secret:

- Es liegt nur in genau diesem Browser und wird nicht zwischen Geräten synchronisiert. Jeder Browser, der heikle Aktionen ausführen soll, braucht seine eigene Eingabe.
- Ein Klick auf **Save** bei leerem Feld löscht den Wert und zeigt **Admin secret cleared**.
- Setzt der Serverbetreiber `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, braucht sogar der Loopback-Rechner das Geheimnis.
- Es ist unabhängig von Basic Auth, beides lässt sich kombinieren. Basic Auth sichert die gesamte App ab, das Admin-Secret die gefährlichen Aktionen.

Schlägt eine heikle Aktion auf einem entfernten Gerät fehl, zeigt Marinara eine Fehlermeldung mit zwei Lösungswegen. Entweder du öffnest die App über localhost. Oder du setzt `ADMIN_SECRET` in der `.env` des Servers und fügst denselben Wert unter **Settings** > **Advanced** > **Admin Access** ein.

<a id="why-is-my-save-blocked-csrf"></a>

## Warum wird mein Speichern blockiert (CSRF)

CSRF steht für Cross-Site Request Forgery. Es ist ein Schutz, der verhindert, dass eine andere geöffnete Website unbemerkt Änderungen in Marinara vornimmt. Er läuft automatisch, eine Einstellung zum Einschalten gibt es nicht.

Manchmal blockiert CSRF auch dein eigenes Speichern. Das passiert meist, wenn du Marinara über einen öffentlichen Domainnamen oder einen ungewöhnlichen Port erreichst, dem der Server noch nicht vertraut. Zwei Hinweise machen darauf aufmerksam.

- Ein rotes Banner am oberen Rand warnt mit **Saves will silently fail**, weil diese Herkunft nicht vertrauenswürdig ist. Das Banner zeigt die genaue `.env`-Zeile, die fehlt, und hat eine Schaltfläche **Copy** (Kopieren).
- Wird ein Speichern tatsächlich abgelehnt, erscheint ein kleines Einblendfenster. Sein Titel lautet **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** oder **Save blocked: origin not trusted**.

Zur Abhilfe trägst du die eigene Adresse in der `.env` als vertrauenswürdig ein:

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Bei einer öffentlichen Domain oder einer Reverse-Proxy-Domain erlaube zusätzlich den Hostnamen:

```env
TRUSTED_HOSTS=chat.example.com
```

Direkte LAN-, Tailscale-, IPv4- und IPv6-Adressen brauchen kein `TRUSTED_HOSTS`. Lokale `.local`-/`.home.arpa`-Namen und einteilige Rechnernamen werden automatisch akzeptiert. Ein exakter Hostname, der bereits in `CSRF_TRUSTED_ORIGINS` steht, wird ebenfalls akzeptiert.

Loopback, normale LAN-Adressen, Tailscale (`100.64.0.0/10`) und die Docker-Bridge (`172.16.0.0/12`) gelten automatisch als vertrauenswürdige Herkunft. Eintragen musst du nur öffentliche IP-Adressen und Domainnamen. Die Änderung greift innerhalb weniger Sekunden, ein Neustart ist nicht nötig.

## Hinweis zu blockierten lokalen Anbietern

Angenommen, du verbindest Marinara mit einem lokalen KI-Anbieter, der etwa auf dem eigenen Rechner läuft. Dann wird die Anfrage womöglich abgelehnt, mit einem Hinweis auf einen „private, loopback, metadata, or reserved IP range“. Dahinter steckt eine andere Sicherheitsprüfung namens SSRF-Schutz. SSRF steht für Server-Side Request Forgery und verhindert, dass der Server private Adressen aufruft, solange du es nicht erlaubst. Die Fehlermeldung nennt die genaue `.env`-Variable, die du setzen musst, zum Beispiel `PROVIDER_LOCAL_URLS_ENABLED`. Die vollständige Liste findest du in der [Referenz der Server-Konfiguration](CONFIGURATION.md).

## Zugriff vom Handy oder Tablet

So öffnest du Marinara vom Handy oder Tablet im selben Netzwerk:

1. Achte darauf, dass der Server mit `HOST=0.0.0.0` in der `.env` auf allen Schnittstellen lauscht.
2. Richte eine Anmeldung ein (Option 1 oben). Vom Handy aus kannst du das auf der Seite tun, die dich blockiert, mit dem Einrichtungscode aus dem Server-Log.
3. Ermittle die lokale IP-Adresse des Server-Rechners (zum Beispiel `192.168.1.50`).
4. Öffne auf dem Handy `http://192.168.1.50:7860` im Browser. Der Standard-Port ist `7860`.
5. Melde dich mit Benutzername und Passwort an.

Lädt die Seite gar nicht, ist der Server vermutlich nicht erreichbar. Prüfe `HOST=0.0.0.0` und den Wert von `PORT`. Kommt stattdessen ein 403, ist dein Gerät zwar erreichbar, aber noch nicht zugelassen. Sieh die gewählte Option oben noch einmal durch.

<a id="locked-out-after-updating"></a>

## Ausgesperrt nach dem Update

Neuere Versionen verlangen eine Anmeldung, wenn ein Besuch über einen Reverse-Proxy, einen Tunnel, Tailscale Serve oder Tailscale Funnel kommt. Ältere Versionen ließen diese Besuche ohne Passwort herein. Siehst du jetzt eine Anmeldeseite, eine Einrichtungsseite oder einen **403**, liegt es daran.

**Hinweis zum Update:** Wenn du Tailscale Serve oder einen anderen Proxy auf demselben Rechner nutzt und nie ein Passwort gesetzt hast, sind deine anderen Geräte nach dem Update ausgesperrt. Ein Proxy auf demselben Rechner spricht meist mit einem Server, der nur auf Loopback lauscht, deshalb gibt der Server keinen Einrichtungscode aus. Richte stattdessen die Anmeldung auf dem Computer ein, auf dem Marinara läuft.

So kommst du wieder hinein:

1. Öffne Marinara auf dem Computer, auf dem es läuft, unter `http://localhost:7860` (oder deinem eigenen `PORT`). Lokal brauchst du kein Passwort. Auf einem Headless-Server führst du zuerst `ssh -L 7860:127.0.0.1:7860 user@server` auf deinem eigenen Computer aus und öffnest dort `http://localhost:7860`. Unter Docker gilt das nur, solange weder eine Anmeldung noch `IP_ALLOWLIST` gesetzt ist. Sonst gib den Einrichtungscode aus dem Server-Log (`docker logs <container> 2>&1 | grep "setup code"`) auf der Seite ein, die dich blockiert, oder in **Settings → Advanced → Access**, oder nutze einen Browser, der noch angemeldet ist.
2. Gehe zu **Settings → Advanced → Access** und lege unter **Remote login** Benutzername und Passwort fest. Oder öffne die `.env`-Datei auf diesem Computer und setze `BASIC_AUTH_USER` und `BASIC_AUTH_PASS`. Ist `IP_ALLOWLIST` gesetzt, trage die Adresse deines anderen Geräts dort ein oder entferne die Einstellung, denn ein Gerät, das nicht auf der Liste steht, bekommt auch mit Anmeldung einen **403**.
3. Melde dich von deinem anderen Gerät aus mit diesem Benutzernamen und Passwort an.

## Suchmaschinen

Marinara bittet Suchmaschinen, seine Seiten nicht zu indexieren (`X-Robots-Tag: noindex, nofollow`). Das schützt deine Installation nicht und entfernt Seiten, die bereits indexiert sind, nicht aus den Suchergebnissen. Nutze die Zugriffskontrollen oben, um deine Installation privat zu halten.

## Verwandte Anleitungen

- [Referenz der Server-Konfiguration](CONFIGURATION.md) für die vollständige Liste der `.env`-Einstellungen und Sonderfälle.
- [Fehlerbehebung in Marinara Engine](TROUBLESHOOTING.md) für Verbindungsfehler, mobilen Zugriff und mehr.
- [Häufige Fragen](FAQ.md) für eine kurze Schritt-für-Schritt-Anleitung zum Zugriff von einem anderen Gerät.
