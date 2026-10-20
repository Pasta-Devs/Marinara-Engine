# Fernzugriff: Basic Auth und IP-Allowlist

In dieser Anleitung erfährst du, wie du Marinara Engine von einem anderen Gerät aus erreichst – vom Handy, vom Laptop oder aus einem Docker-Container. Sie beschreibt die zwei wichtigsten Wege: Basic Auth und die Allowlist (Liste erlaubter Adressen) für IP-Adressen. Dazu kommen die Ausnahme für private Netzwerke, HTTPS, **Admin Access** (Administrator-Zugriff) und die Meldung „save blocked“ zum Thema CSRF. Fast alles davon steht in der `.env`-Datei des Servers, nicht in der App.

Ein paar Begriffe, die durchgehend vorkommen:

- `.env`-Datei: eine einfache Textdatei mit Einstellungen, die im Marinara-Engine-Ordner neben `package.json` liegt.
- Loopback: der Rechner, auf dem der Server tatsächlich läuft. Seine Adresse lautet `127.0.0.1` oder `localhost`.
- Fernzugriff: Marinara von einem Gerät aus öffnen, das NICHT der Rechner mit dem Server ist.

## Was Marinara standardmäßig blockiert

Zum Schutz der Daten lehnt eine frische Marinara-Installation Verbindungen von anderen Geräten ab, solange keine Zugriffskontrolle eingerichtet ist. Standardmäßig gelten nur drei Arten von Clients als vertrauenswürdig:

1. Loopback (`127.0.0.1` oder `::1`), also der Rechner mit dem Server selbst. Besucher, die ein Reverse-Proxy oder Tunnel auf demselben Rechner weiterreicht, zählen nicht dazu; siehe [Reverse-Proxys und Tunnel auf demselben Rechner](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Tailscale-Geräte im eigenen Tailnet. Tailscale ist ein Werkzeug für private Netzwerke, seine Adressen liegen im Bereich `100.64.0.0/10`.
3. Docker-Clients auf demselben Host. Marinara erkennt den üblichen Bridge-Bereich `172.16.0.0/12` sowie das exakte Standard-Gateway des Containers – damit sind auch Docker Desktop und eigene Adresspools abgedeckt.

Alles andere ist blockiert, bis du eine der Optionen unten wählst: das Handy im selben WLAN genauso wie ein Client aus dem öffentlichen Internet. Öffnet ein blockiertes Gerät Marinara im Browser, erscheint eine dunkle Einrichtungsseite. Ihr Titel lautet **This Marinara Engine install needs access control before remote devices can connect.** Die Seite zeigt die eigene IP-Adresse des Geräts und zwei `.env`-Schnipsel zum Kopieren.

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

Die Start-Skripte (`start.bat`, `start.sh`) setzen `HOST=0.0.0.0` automatisch. Wer `pnpm start` direkt aufruft, bekommt das nicht.

## Welche Option passt zu dir

Lies die Liste der Reihe nach und halte beim ersten Punkt an, der auf dich zutrifft.

1. Du verbindest dich nur über Tailscale oder nur aus Docker-Containern auf demselben Host. Dann ist nichts zu tun, es funktioniert bereits.
2. Du willst Marinara vom Handy, Tablet oder Laptop im heimischen WLAN erreichen. Nimm Basic Auth (Option 1 unten).
3. Du stellst Marinara ins öffentliche Internet. Nimm Basic Auth zusammen mit HTTPS.
4. Deine Geräte haben feste IP-Adressen und du möchtest kein Passwort tippen. Nimm die IP-Allowlist (Option 2 unten).
5. Dein ganzes Netzwerk ist vertrauenswürdig und ein Passwort kommt für dich nicht infrage. Nimm die Ausnahme für private Netzwerke (Option 3 unten). Lies dort zuerst die Warnung.

Basic Auth ist die flexibelste Wahl. Es funktioniert von jeder IP-Adresse aus, braucht keine Einrichtung pro Gerät, und der Browser merkt sich die Anmeldung.

## Option 1: Basic Auth (empfohlen)

Bei Basic Auth fragt der Browser nach Benutzername und Passwort, bevor er dich hineinlässt. Zum Aktivieren kommen zwei Zeilen in die `.env`:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Wähle ein starkes, einmaliges Passwort. Basic Auth schickt die Anmeldedaten bei jeder Anfrage mit, behandle sie also wie jedes andere Kontopasswort. Ein zufälliges lässt sich so erzeugen:

```bash
openssl rand -base64 24
```

Speichere die `.env`. Die Änderung greift innerhalb weniger Sekunden, ganz ohne Neustart. Danach geht es am entfernten Gerät weiter.

1. Öffne Marinara im Browser über die Adresse des Servers, zum Beispiel `http://192.168.1.50:7860`.
2. Gib Benutzername und Passwort ein, sobald der Browser danach fragt.
3. Die App sollte nun laden. Der Browser merkt sich die Anmeldung für den Rest der Sitzung.

Nach 10 verschiedenen falschen Passwörtern innerhalb von 15 Minuten lehnt Marinara Anmeldungen von dieser Adresse mit **429 Too Many Requests** ab, bis die 15 Minuten um sind. Ein richtiges Passwort vor Ablauf dieser Zeit setzt den Zähler zurück. Besucher, die ein Reverse-Proxy oder Tunnel auf dem Host weiterreicht, teilen sich einen Zähler, und wenn sich einer von ihnen anmeldet, wird er nicht zurückgesetzt. Auch ein Neustart des Servers setzt ihn zurück. Ein Browser, der sich schon einmal angemeldet hat, kommt mit dem richtigen Passwort weiterhin hinein. Falsche Passwörter anderer Leute können dich also nicht von einem Gerät aussperren, das du bereits nutzt.

Im Browser-Dialog steht standardmäßig **Marinara Engine**. Diesen Text kannst du mit `BASIC_AUTH_REALM` ändern.

Manche Clients umgehen das Passwort auch bei aktiviertem Basic Auth:

- Loopback (`127.0.0.1`, `::1`) – auf dem Rechner mit dem Server brauchst du also nie ein Passwort. Besucher, die ein Reverse-Proxy oder Tunnel auf diesem Rechner weiterreicht, brauchen es trotzdem.
- Jede Adresse in `IP_ALLOWLIST`. Achtung: Eine gesetzte Allowlist blockiert zugleich jede nicht gelistete Adresse (siehe Option 2).
- Direkter Tailscale-Verkehr (`100.64.0.0/10`), solange du dessen Ausnahme nicht abschaltest.
- Docker-Bridge- und Gateway-Verkehr, aber nur, wenn du `BYPASS_AUTH_DOCKER=true` setzt. Bei aktivem Basic Auth ist das automatische Vertrauen in Docker aus (siehe [Ausnahme für Tailscale und Docker](#tailscale-and-docker-bypass)).
- Die Adresse `/api/health`, damit Verfügbarkeitsprüfungen weiterlaufen. Ohne Passwort meldet sie nur den grundlegenden Status, nicht deine lokalen Modelle oder deine Grafikkarte.

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
- Auch direkter Tailscale-Verkehr überspringt die Liste, solange du dessen Ausnahme nicht abschaltest. Docker-Bridge- und Gateway-Verkehr überspringt sie nur, wenn du `BYPASS_AUTH_DOCKER=true` setzt (siehe [Ausnahme für Tailscale und Docker](#tailscale-and-docker-bypass)).
- Ungültige Einträge werden ignoriert und protokolliert. Der Server stürzt deswegen nicht ab.
- Die Allowlist bleibt auch mit aktivem Basic Auth strikt. Gelistete Adressen überspringen die Passwortabfrage. Jede andere Adresse bleibt mit **403 Forbidden** blockiert und bekommt nie einen Anmeldedialog zu sehen.

Ein gemischter Aufbau ist damit nicht möglich, bei dem gelistete Geräte das Passwort überspringen und alle anderen sich anmelden. Sollen sich andere Geräte per Passwort anmelden, lass `IP_ALLOWLIST` leer und nutze allein Basic Auth.

Du kannst die Prüfung vorübergehend abschalten, ohne die Liste zu löschen. Praktisch, wenn du von einer neuen IP-Adresse aus Fehler suchst. Setze den Schalter auf false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Option 3: Ausnahme für private Netzwerke (ohne Passwort)

Vielleicht ist dein ganzes Netzwerk vertrauenswürdig, etwa ein Heim-LAN (lokales Netzwerk) ohne Portweiterleitung. Dann lässt sich die Sperre auch ohne Passwort aufheben:

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

Damit kehrt das alte Verhalten zurück: im LAN offen, aus dem öffentlichen Internet blockiert. Es gilt nur für die üblichen privaten Adressbereiche, zum Beispiel `10.0.0.0/8`, `172.16.0.0/12` und `192.168.0.0/16`. Der CGNAT-Bereich `100.64.0.0/10` zählt ebenfalls dazu. CGNAT ist ein System gemeinsam genutzter Adressen, das manche Internetanbieter einsetzen – Tailscale verwendet denselben Bereich. Adressen aus dem öffentlichen Internet bleiben mit einem 403 blockiert.

Warnung: Jede Person im selben Netzwerk erreicht Marinara dann ohne Passwort. In einem Netzwerk, das dir gehört, ist das unproblematisch. Im gemeinsam genutzten WLAN eines Cafés, Flughafens oder Wohnheims ist es das nicht. Im Zweifel lieber Basic Auth.

Daneben gibt es den weiter gefassten Schalter `ALLOW_UNAUTHENTICATED_REMOTE=true`, der passwortlosen Zugriff von JEDER Adresse erlaubt, auch aus dem öffentlichen Internet. Schalte ihn nicht ein. Wenn du wirklich öffentlichen Zugriff brauchst, nimm Basic Auth plus HTTPS – oder setze einen Reverse-Proxy davor, der die Anmeldung übernimmt.

<a id="tailscale-and-docker-bypass"></a>

## Ausnahme für Tailscale und Docker

Zwei Schalter lassen direkten Tailscale- und Docker-Verkehr sowohl die IP-Allowlist als auch Basic Auth überspringen, genau wie Loopback. Lass sie für die automatische Erkennung leer:

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

Im automatischen Modus wird einem Tailscale-Peer nur vertraut, wenn beide Enden seines direkten Sockets Tailnet-Adressen nutzen. Docker-Verkehr wird nur dann vertraut, wenn Marinara in einem Container läuft und die Quelle einer erkannten Container-Schnittstelle oder ihrem exakten Gateway entspricht. So funktionieren übliche private Tailscale- und Docker-Konfigurationen auf demselben Host weiter, ohne fremden CGNAT-, LAN-, Host-Netzwerk- oder Proxy-Verkehr als authentifiziert zu behandeln.

Das automatische Vertrauen in Docker gilt nur, solange weder Basic Auth noch `IP_ALLOWLIST` gesetzt ist. Docker Desktop, OrbStack und rootless Docker leiten jedes Gerät, das einen veröffentlichten Port öffnet, über das Gateway des Containers, sodass Marinara deinen eigenen Browser nicht von einem Handy oder einer fremden Person im Netzwerk unterscheiden kann. Sobald du ein Passwort oder eine Allowlist setzt, muss jeder Docker-Client sie passieren, auch der Browser auf dem Host. Setze `BYPASS_AUTH_DOCKER=true` nur, wenn du jedem Gerät vertraust, das den veröffentlichten Port erreichen kann.

Setze einen Schalter auf `false`, wenn für diese Clients die normalen Prüfungen von Basic Auth und IP-Allowlist gelten sollen. Mit `true` behältst du die ältere breite Ausnahme, falls die automatische Erkennung nicht verfügbar ist: Tailscale vertraut dann dem gesamten Bereich `100.64.0.0/10`, Docker zusätzlich seinen erkannten Schnittstellen und Gateways sowie dem alten Bereich `172.16.0.0/12`. Nutze diesen Kompatibilitätsmodus nur, wenn jeder passende Peer vertrauenswürdig ist.

Gehören zu deinem Tailnet beispielsweise weniger vertrauenswürdige Peers, schalte die Tailscale-Ausnahme ab:

```env
BYPASS_AUTH_TAILSCALE=false
```

Sollen erkannte Docker-Peers die Authentifizierung nicht umgehen, schalte die Docker-Ausnahme ab und füge bei Bedarf bestimmte Clients zu `IP_ALLOWLIST` hinzu:

```env
BYPASS_AUTH_DOCKER=false
```

Möglich ist außerdem, dass Marinara hinter einem Reverse-Proxy- oder Tunnel-Container auf der Docker-Bridge oder dem erkannten Gateway steht. Weiterleitungs-Header wie `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host` oder `X-Forwarded-Proto` zeigen an, dass der Docker-Peer für einen anderen Client steht. Deshalb wendet Marinara standardmäßig die normalen Prüfungen von Basic Auth und IP-Allowlist an:

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

Um die alte Ausnahme wiederherzustellen, setze den Schalter auf `false`. Tu das nur, wenn jeder Client, der den Proxy erreichen kann, vertrauenswürdig ist – weitergeleitete Clients erben sonst den passwortlosen Status von Docker.

Der Server protokolliert eine `[auth-bypass]`-Warnung, sobald eine dieser Ausnahmen zum ersten Mal eine Anfrage durchlässt. Die Warnung bestätigt, dass die Ausnahme aktiv ist.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Reverse-Proxys und Tunnel auf demselben Rechner

Ein Reverse-Proxy oder Tunnel auf dem Rechner, auf dem Marinara läuft – etwa nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve oder Funnel oder ngrok –, verbindet sich über Loopback mit Marinara. Marinara erkennt das an den Weiterleitungs-Headern, die der Proxy hinzufügt: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, die Identitäts-Header von Tailscale oder `Via`. Dann behandelt es jede Anfrage als das, was sie ist: ein entfernter Besucher.

- Basic Auth greift, setze also `BASIC_AUTH_USER` und `BASIC_AUTH_PASS`. Ohne diese Werte sehen Besucher die Einrichtungsseite.
- `IP_ALLOWLIST` blockiert die weitergeleiteten Besucher, weil der Proxy ihre echten Adressen verbirgt.
- Privilegierte Aktionen brauchen das Admin-Secret, und Funktionen, die nur über Loopback gehen, bleiben gesperrt.

Dein eigener Browser auf diesem Rechner, geöffnet unter `http://127.0.0.1:7860` oder `http://localhost:7860`, bleibt ohne Passwort.

Caddy, Traefik, Cloudflare Tunnel, Tailscale und ngrok fügen Weiterleitungs-Header von sich aus hinzu. Bei nginx gehört diese Zeile in den `location`-Block:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Werkzeuge, die rohe Verbindungen weiterleiten, etwa `socat` oder `ssh -R`, fügen keine Header hinzu, ihr Verkehr sieht also lokal aus. Veröffentliche Marinara nicht damit.

Verlangt dein Proxy bereits von jedem Besucher eine Anmeldung, bevor er überhaupt etwas weiterleitet, kannst du die eigenen Prüfungen von Marinara für seinen Verkehr abschalten:

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

Besucher bekommen dann denselben vollen Zugriff wie der Host-Rechner, einschließlich privilegierter Aktionen ohne Admin-Secret. Tu das nur, wenn die Anmeldung des Proxys jede Route schützt.

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
2. Wähle eine der Zugriffsoptionen oben. Für ein Handy im heimischen WLAN ist Basic Auth am einfachsten.
3. Ermittle die lokale IP-Adresse des Server-Rechners (zum Beispiel `192.168.1.50`).
4. Öffne auf dem Handy `http://192.168.1.50:7860` im Browser. Der Standard-Port ist `7860`.
5. Falls du Basic Auth eingerichtet hast, gib Benutzername und Passwort ein, sobald danach gefragt wird.

Lädt die Seite gar nicht, ist der Server vermutlich nicht erreichbar. Prüfe `HOST=0.0.0.0` und den Wert von `PORT`. Kommt stattdessen ein 403, ist dein Gerät zwar erreichbar, aber noch nicht zugelassen. Sieh die gewählte Option oben noch einmal durch.

## Verwandte Anleitungen

- [Referenz der Server-Konfiguration](CONFIGURATION.md) für die vollständige Liste der `.env`-Einstellungen und Sonderfälle.
- [Fehlerbehebung in Marinara Engine](TROUBLESHOOTING.md) für Verbindungsfehler, mobilen Zugriff und mehr.
- [Häufige Fragen](FAQ.md) für eine kurze Schritt-für-Schritt-Anleitung zum Zugriff von einem anderen Gerät.
