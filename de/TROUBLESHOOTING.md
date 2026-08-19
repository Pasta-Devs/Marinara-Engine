# Fehlerbehebung in Marinara Engine

Diese Anleitung sammelt die häufigsten Probleme in Marinara Engine samt Lösung. Such dir den Abschnitt, der zu deinem Symptom passt, und arbeite die Schritte ab. Hilft nichts davon, sieh in den letzten Abschnitt Weitere Hilfe bekommen.

## Erste Versuche

Viele Probleme lösen sich mit zwei schnellen Schritten.

1. Lade die Seite vollständig neu, also ohne Cache. Drück dafür **Ctrl+Shift+R** unter Windows oder Linux, auf dem Mac **Cmd+Shift+R**.
2. Wirf einen Blick in die Server-Konsole – das Terminal-Fenster, in dem Marinara läuft – und such nach roten Fehlerzeilen. Genau dort steht meist das eigentliche Problem.

Wenn du das Team um Hilfe bittest, schalte vorher den **Debug mode** (Debug-Modus) ein. Dann schreibt der Server Prompt und Antwort mit. Mehr dazu unter Weitere Hilfe bekommen am Ende dieser Anleitung.

## Probleme bei Installation und Start

### Windows: EPERM- oder Corepack-Signaturfehler beim Installieren von pnpm

pnpm ist der Paketmanager, mit dem Marinara seinen Code installiert. Erscheint `EPERM: operation not permitted` oder ein Fehler bei der Corepack-Signaturprüfung, konnte Corepack nicht in den Node-Installationsordner schreiben.

Wähl eine der drei Lösungen:

1. Rechtsklick auf das Terminal, „Als Administrator ausführen“ wählen und den Launcher erneut starten.
2. pnpm selbst installieren. Führ diesen Befehl aus und starte danach den Launcher erneut:

```bash
npm install -g pnpm
```

3. Corepack in einem Administrator-Terminal aktualisieren und den Launcher erneut starten:

```bash
npm install -g corepack
```

### Windows: `'pnpm' is not recognized` beim Bauen des Shared-Pakets

Marinara v2.3.0 konnte pnpm zwar über Corepack starten, scheiterte dann aber beim Bauen des Shared-Pakets: Dieser Build wollte eine zweite, globale `pnpm`-Programmdatei aufrufen. v2.3.1 braucht diese verschachtelte Variante nicht mehr. Schließ den fehlgeschlagenen Launcher und starte `start.bat` erneut, damit er vor dem Neubauen das korrigierte Build-Skript holen kann. Deine Daten musst du dafür nicht entfernen.

Lässt sich die lokale Kopie selbst nicht aktualisieren, führ `git pull` im Marinara-Ordner aus und starte erneut. Als vorübergehende Notlösung für v2.3.0 installierst du den festgelegten Paketmanager global, startest den Launcher erneut und aktualisierst anschließend ganz normal:

```bash
npm install -g pnpm@10.33.2
```

### Launcher-Update auf pnpm 10.34.5

Marinara v2.4.1 stellt den festgelegten Paketmanager auf pnpm 10.34.5 um. Ein vorhandener Launcher mit 10.33.2 kann diese einmalige Übergabe im selben Lauf abschließen; anschließend wählt der aktualisierte Launcher bei künftigen Starts 10.34.5. Corepack prüft die Version anhand des in `package.json` festgelegten SHA-512-Digests, und auch der npm-Fallback fordert exakt 10.34.5 statt einer nicht festgelegten neuesten Version an.

Falls ein früherer Staging-Build von v2.4.1 bereits mit `Expected version: >=10.34.5` und `Got: 10.33.2` abgebrochen ist, führe den Launcher noch einmal aus; dieser Build hat den aktualisierten Launcher vor dem Abbruch heruntergeladen. Kann der Launcher die festgelegte Version weiterhin nicht automatisch beziehen, installiere sie exakt und starte ihn erneut:

```bash
npm install -g pnpm@10.34.5
```

### Linux: ERR_PNPM_ENAMETOOLONG bei der Installation

Dahinter stecken überlange Ordnerpfade aus einer älteren Installation. Räum die halbfertige Installation aus dem Marinara-Ordner heraus und starte den Launcher erneut:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Starte Marinara danach wieder mit `./start.sh`. Wenn du von Hand installierst, führ nach dem Entfernen dieser Ordner `pnpm install` aus.

### ERR_PNPM_TRUST_DOWNGRADE bei der Installation

Fast immer steckt eine halbfertige Installation dahinter. Starte zuerst den Launcher erneut, damit er den Workspace reparieren kann. Wenn du von Hand installierst, genügt dieser eine Befehl im Marinara-Ordner:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Leerer, veralteter oder altmodisch wirkender Bildschirm

Manchmal läuft der Server, der Browser zeigt aber eine leere Seite – oder die App sieht nach einem Update aus wie eine alte Version. Dann hält der Browser eine zwischengespeicherte Kopie der Web-App fest.

1. Lade die Seite vollständig neu (**Ctrl+Shift+R** oder **Cmd+Shift+R**).
2. Hilft das nicht, öffne **Settings** (Einstellungen), wechsle auf den Tab **Advanced**, dann in den Bereich **Updates**, und klick auf **Refresh App**.

**Refresh App** löscht den Service Worker des Browsers – ein Hintergrundskript, das die Web-App zwischenspeichert – sowie den Browser-Cache und lädt die Seite neu. An den Daten ändert sich nichts: Chats, Einstellungen und alle anderen lokalen Daten bleiben erhalten. Der Server-Code wird dabei aber nicht aktualisiert, ein echtes Update ersetzt das also nicht. Wie du die App selbst aktualisierst, steht unter [Marinara Engine aktualisieren](UPGRADING.md).

## Probleme mit herunterladbaren Agenten

Meldet **Agents → Download Agents**, der Katalog sei nicht verfügbar, dann muss der Rechner mit dem Marinara-Server – nicht nur der Browser – den offiziellen Katalog [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) über GitHub-HTTPS erreichen können. Bereits installierte Agenten laufen offline in ihrer aktuellen Version weiter. Stell die Serververbindung wieder her und klick dann auf **Refresh** oder **Try again**, um den Katalog zu durchsuchen und nach Updates zu sehen.

Taucht eine installierte Karte oder ein installierter Anruf nicht auf, beende Marinara Engine vollständig und starte es neu. Solche Pakete bringen eigene Routen mit und bleiben deshalb bis zum nächsten Prozessstart im Zustand **Restart required**. Bei Conversation-Spielen ist das anders: Aktuelle Engine-Builds aktivieren sie sofort. Aktualisiere den Katalog, falls die Installation fehlschlug, und prüf dann, ob das Spiel als bereit angezeigt wird. Es unter **Commands** in den Einstellungen eines Chats hinzuzufügen, ist nur nötig, wenn Charaktere es von sich aus starten sollen – für den manuellen Slash-Befehl des Spiels braucht es das nicht.

Wenn eine ältere Installation ihre erste Paket-Migration nicht abschließen kann, lösch weder den Ordner `data/capability-packages` noch deine Chat-Daten. Marinara lässt die Migration unvollendet und versucht es beim nächsten Start erneut. Bestehende Chat-Auswahlen und Einstellungen bleiben gespeichert, solange der Katalog nicht erreichbar ist.

Marinara weist Paket-Downloads ab, wenn Prüfsumme, angegebene Dateiliste, unterstützter Engine-Versionsbereich oder Archivpfade nicht zum offiziellen Katalog passen. Aktualisiere zuerst Marinara Engine, lade den Katalog neu und versuch es erneut. Entpack ein Artefakt niemals von Hand in das Datenverzeichnis.

Agent-Updates werden nie beim Start eingespielt. Sobald eine neuere, kompatible Version bereitsteht, fragt Marinara nach, ob sie eingespielt werden soll. Mit **No** behältst du die installierte Version; die Schaltfläche **Update** bleibt in **Agents → Download Agents** verfügbar. Auch nach einem fehlgeschlagenen Update bleibt die installierte Version registriert, und eine frisch aktualisierte Server-Laufzeit, die ihre Selbstprüfung beim Start nicht besteht, fällt auf die vorherige Version zurück.

## Zugriff auf Marinara von einem anderen Gerät

Erreichst du Marinara nicht von Handy, Tablet oder einem anderen Rechner im Netzwerk, arbeite diese Prüfpunkte ab.

- Binde den Server an eine erreichbare Adresse. Standardmäßig lauscht er auf `127.0.0.1` (Loopback, also nur auf dem eigenen Rechner). Die Shell-Launcher setzen `HOST=0.0.0.0` automatisch für dich. Hast du von Hand mit `pnpm start` gestartet, trag zuerst `HOST=0.0.0.0` in der `.env`-Datei ein.
- Prüf, ob beide Geräte im selben WLAN hängen.
- Prüf, ob eine Firewall den Port blockiert. Der Standard-Port ist `7860` oder der Wert, den du unter `PORT` gesetzt hast.
- Richte eine Zugriffskontrolle ein. Für gewöhnliche Clients im Netzwerk oder aus dem Internet setzt du `BASIC_AUTH_USER` und `BASIC_AUTH_PASS` in der `.env`. Loopback bleibt ohne Passwort. Direkter Datenverkehr über Tailscale sowie über die Docker-Bridge auf demselben Host oder ein erkanntes Container-Gateway gilt standardmäßig als vertrauenswürdig; über einen Proxy weitergeleiteter Docker-Verkehr braucht dagegen die normale Autorisierung, sofern du nicht ausdrücklich `REQUIRE_AUTH_FOR_DOCKER_PROXY=false` setzt.
- Für privilegierte Aktionen von diesem Gerät aus (Backups, Daten löschen, Updates) setzt du `ADMIN_SECRET` in der `.env` des Servers. Denselben Wert fügst du dann auf dem Gerät unter **Settings** > **Advanced** > **Admin Access** ein und klickst auf **Save**.
- Nutzt du eine öffentliche Domain oder einen Reverse-Proxy und siehst **Untrusted request host**, trag den exakten Hostnamen in `TRUSTED_HOSTS` in der `.env` ein. Direkte IP-Adressen von Handys, LAN-Rechnern und Tailscale-Peers bleiben automatisch akzeptiert.

Die komplette Anleitung findest du unter [Fernzugriff](REMOTE_ACCESS.md) und in den [Häufigen Fragen](FAQ.md).

## Speichern blockiert oder Einstellungen halten nicht

Sieht ein Speichervorgang erfolgreich aus, ist die Änderung nach dem Neuladen aber wieder verschwunden, blockiert Marinaras Schutz vor Cross-Site-Angriffen das Speichern. Der CSRF-Schutz (Cross-Site Request Forgery) sichert alle Aktionen ab, die Daten verändern, und vertraut dabei nur bestimmten Browser-Ursprüngen.

Du erkennst das an einem oder beiden dieser Anzeichen:

- Ein rotes Banner am oberen Bildschirmrand warnt, dass Speichervorgänge stillschweigend fehlschlagen, weil dieser Ursprung nicht vertrauenswürdig ist.
- Eine Toast-Meldung – eine kurz eingeblendete Hinweisbox – mit dem Titel **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** oder **Save blocked: origin not trusted**.

Loopback, private Netzwerkadressen, Tailscale und die Docker-Bridge gelten automatisch als vertrauenswürdig. Das Problem tritt daher meist nur auf, wenn du Marinara über eine öffentliche IP-Adresse oder einen Domainnamen erreichst. Trag diese Adresse in `CSRF_TRUSTED_ORIGINS` in der `.env` ein. Mehrere Adressen trennst du mit Komma, zum Beispiel:

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

Ein Neustart ist nicht nötig. Das Banner hat eine Copy-Schaltfläche, die dir die passende Zeile fertig ausfüllt. Mehr dazu unter [Fernzugriff](REMOTE_ACCESS.md).

## Fehler bei Verbindung und Generierung

Fehler bei der Generierung erscheinen als Toast-Meldung am unteren Bildschirmrand. Ist eine Verbindung fehlgeschlagen, nennt die Meldung den Grund. Sie bleibt lange genug stehen, um sie zu lesen und zu kopieren.

- **No API connection configured for this chat**: Für den Chat ist keine Verbindung ausgewählt. Öffne das Panel **Connections**, leg eine Verbindung an und wähl sie für den Chat aus. Mehr dazu unter [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md). Ein API-Key ist ein geheimer Zugangscode vom Anbieter, ähnlich einem Passwort, mit dem Marinara dessen Modelle nutzen darf.
- Das Modell akzeptiert einen Parameter nicht: Die Meldung nennt den betroffenen Parameter. Öffne **Chat Settings** (Chat-Einstellungen) > **Advanced Parameters** und such ihn dort. Schalte den Schalter neben dem Namen aus (der Tooltip, also der Kurzhinweis beim Draufzeigen, lautet „This parameter is sent to the model“).
- Das Modell verlangt einen Parameter: Geh genauso vor, schalte den Schalter neben diesem Parameter aber ein.
- **The AI returned an empty response. Try sending your message again.**: Schick die Nachricht noch einmal ab. Passiert das immer wieder, probier ein anderes Modell oder eine andere Verbindung.
- **A generation is already in progress for this chat**: Eine Antwort wird noch gestreamt. Warte, bis sie fertig ist, oder klick auf die Stop-Schaltfläche und versuch es dann erneut.
- **No connections are marked for the random pool**: Du hast die zufällige Verbindungsauswahl eingeschaltet, aber keine Verbindung für den Pool markiert. Nimm mindestens eine Verbindung in den Pool auf oder schalte die Zufallsauswahl wieder aus.

## Probleme mit dem Local Model

Das **Local Model** ist ein KI-Modell, das ohne API-Key direkt auf deinem Rechner läuft. In manchen Fehlermeldungen heißt diese Funktion Sidecar.

- Schlägt die Installation einer Laufzeit mit **Sidecar runtime install is disabled** fehl, hat der Server diese Aktion aus Sicherheitsgründen deaktiviert. Auf dem eigenen Rechner setzt du dafür `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in der `.env`. Von einem anderen Gerät aus fügst du zuerst dein Admin-Secret unter **Settings** > **Advanced** > **Admin Access** ein.
- Schlägt der Modell-Download oder die Einrichtung von einem anderen Gerät aus fehl (Netzwerkadresse oder Docker), kann ebenfalls das Admin-Secret nötig sein. Auf dem eigenen Rechner brauchst du keines. Wo du das Secret einfügst, steht im Punkt darüber.
- Meldet die Prüfung von mitgeliefertem llama.cpp, MLX, uv oder der MLX-Abhängigkeitssperre eine abweichende Dateigröße oder SHA-256-Prüfsumme, hat Marinara die Datei schon vor dem Entpacken oder Installieren verworfen oder abgelehnt. Aktualisier Marinara oder installier es neu und versuch es dann noch einmal. Führ die abgelehnte Datei keinesfalls selbst aus, entpack sie nicht, bearbeite sie nicht und umgeh die Prüfung nicht.

### Für Maintainer: gepinnte lokale Laufzeiten aktualisieren

Von GitHub erzeugte Quellcode-Archive bleiben nicht garantiert Byte für Byte gleich, selbst wenn sich der Inhalt des Commits nicht ändert. „Repariere“ eine Abweichung bei Nutzenden deshalb nie, indem du die Bytes von deren Rechner übernimmst oder die Prüfung aufweichst. Laufzeit-Eingaben werden ausschließlich in einer geprüften Engine-Änderung neu gepinnt:

1. Wähl eine unveränderliche Upstream-Revision oder ein Release-Asset und sieh die Änderungen im Upstream durch.
2. Lad die Datei in einen temporären Ordner herunter, notier ihre exakte Byte-Anzahl und berechne die SHA-256-Prüfsumme unabhängig davon.
3. Trag Revision, URL, Größe und Prüfsumme in `runtime-integrity-manifest.ts` ein. Für MLX erzeugst du `packages/server/src/assets/mlx-runtime-requirements.lock` aus der zugehörigen `.in`-Datei neu – mit der gepinnten uv-Version auf Apple Silicon und Python 3.12. Prüf danach jede geänderte Abhängigkeit und aktualisier `requirementsLockSha256`.
4. Führ `pnpm regression:runtime-integrity`, `pnpm check` und eine echte, saubere Laufzeit-Installation auf der betroffenen Plattform aus.
5. Veröffentlich das geprüfte Engine-Update, bevor du Nutzende um einen neuen Versuch bittest. Biete keine Möglichkeit an, die Prüfsumme von Hand zu übergehen.

Die vollständige Einrichtung beschreibt [Local Model einrichten](connections/local-model.md).

## Gedächtnis und Zusammenfassungen

### Memory Recall erinnert sich an nichts

**Memory Recall** durchsucht frühere Nachrichten und fügt die passendsten unbemerkt wieder in den Prompt ein – der Prompt ist der Text, den Marinara an die KI schickt. Erinnert sich die Funktion an gar nichts, prüf diese Punkte.

1. Öffne **Chat Settings** > **Memory Recall** und prüf, ob **Enable Memory Recall** eingeschaltet ist.
2. Öffne **Access memories for this chat**. Sieh dir im Fenster **Memories for This Chat** den Status jedes Abschnitts an.
3. Der Status **Waiting for vector** bedeutet, dass die Erinnerung noch verarbeitet wird. Warte kurz und schreib dann weiter.
4. Der Status **Embedding unavailable** bedeutet, dass keine Embedding-Quelle funktioniert. Ein Embedding ist eine numerische Darstellung von Text. Richte eine Embedding-Verbindung ein oder lass das eingebaute lokale Modell laden. Mehr dazu unter [Local Model einrichten](connections/local-model.md).

Für eine Erinnerung braucht es mindestens 5 neue Nachrichten. Außerdem zeigt **Memory Recall** nur Erinnerungen, die eng zur neuen Nachricht passen – er kann also leer ausgehen, obwohl Erinnerungen vorhanden sind.

### Es entstehen keine Zusammenfassungen

Chat-Zusammenfassungen brauchen eine funktionierende Textverbindung, die sie schreibt.

- Im Roleplay Mode öffnest du das Popover **Chat Summary** – ein kleines Einblendfenster – und prüfst, ob dort eine Verbindung eingetragen ist. Mit **Backfill Summary** holst du einen älteren Chat nach.
- Im Conversation Mode öffnest du **Automatic Summarization** und wiederholst mit **Backfill** die Tage, die fehlgeschlagen sind.
- Verlangt der Chat eine Freigabe für Agent-Schreibzugriffe, wartet eine KI-Zusammenfassung erst auf deine Prüfung, bevor sie greift.
- Eine Zusammenfassung, die immer wieder scheitert (etwa wegen eines falschen API-Keys), wird mit Verzögerung erneut versucht. Reparier die Verbindung und nutze dann **Backfill**.

## Probleme mit dem Card Browser

Mit dem **Card Browser** durchsuchst du öffentliche Charakterseiten und importierst Charaktere. Öffne ihn über das **Card Browser**-Symbol in der oberen Leiste und klick dann auf **Download Cards**.

- Scheitert die Suche auf JannyAI oder eine Charakterseite an einer Cloudflare-Sperre, zeigt Marinara einen Hinweis. Er bittet dich, die JannyAI-Seite einmal im selben Browser zu besuchen, um die Prüfung zu bestehen, und es dann erneut zu versuchen.
- Wenn dein Login bei CharacterTavern oder Pygmalion nach einem Serverneustart nicht mehr funktioniert, ist das normal. Diese Logins liegen nur im Arbeitsspeicher des Servers und verfallen beim Neustart. Öffne das Login-Fenster und füg Cookie oder Token erneut ein.

## Probleme bei der Medien-Generierung

### Die Hintergrundbereinigung beim Sprite kommt mit einer komplexen Szene nicht klar

Generierte Standbild-Sprites – also Charakterbilder für die Bühne – nutzen normalerweise echte Transparenz oder eine adaptive, einfarbige Chroma-Matte. Die eingebaute Bereinigung erkennt zusätzlich ältere weiße Matten, erhält eingeschlossene Details am Motiv, glättet die Alpha-Kante und entfernt Farbschleier der Matte. Ein fotografierter Raum, detailreiche Kulissen, kräftige Schlagschatten oder ein Motiv in Hintergrundfarbe brauchen trotzdem manchmal die optionale KI-Rückfalllösung:

```bash
pnpm backgroundremover:install
```

Starte Marinara danach neu und klick im Fenster für die Sprite-Generierung auf **Reapply Cleanup**. Marinara versucht weiterhin zuerst den eingebauten Matte-Weg und greift nur dann zum KI-Modell, wenn der Rand ungleichmäßig aussieht. Falls die Installation scheitert:

- Prüf, ob Python 3.9 bis 3.11 installiert ist. Neuere Python-Versionen erzwingen mitunter langsame native Builds.
- Bau das Werkzeug mit `pnpm backgroundremover:reinstall` neu.
- Willst du während der Fehlersuche ausschließlich die automatische Matte-Bereinigung ohne KI-Rückfalllösung erzwingen, setz `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` in der `.env`.

### Storyboards im Game Mode oder Roleplay erscheinen nicht

Game-Mode-Storyboards machen aus einer abgeschlossenen GM-Erzählung Keyframe-Bilder und optional kurze Clips. Roleplay-Storyboards fassen abgeschlossene Wortwechsel zusammen und zeigen das Ergebnis direkt hinter der Antwort im Chat.

- Prüf, ob **Storyboard** über **Agents** > **Download Agents** installiert ist, und schalte dann **Enable Agents** (Agenten aktivieren) und **Enable Storyboards** (Storyboards aktivieren) für den Chat ein.
- Für ein manuelles Szenenvideo generierst du zuerst ein Bild in der **Gallery** oder lädst eines hoch und nutzt dann dessen Aktion **Video** oder **Animate**. Die **Gallery** trennt **Images** und **Videos** in Tabs – sieh also im Tab **Videos** nach.
- Für automatische Game-Mode-Storyboards öffnest du **Chat Settings** > **Agents** > **Storyboards** und prüfst, ob **Automatic Storyboard Illustrations** eingeschaltet ist. Willst du auch Clips, schalte zusätzlich **Automatic Storyboard Animations** ein.
- Im Roleplay fügst du den Agenten **Storyboard** zum Chat hinzu. Wähl **Still images** oder **Animations**, leg **Messages per episode** fest und wähl die Bildverbindung für das Storyboard. **Manual only** startet stattdessen über **Create storyboard** in der Galerie.
- Keyframe-Bilder brauchen eine Bildverbindung. Clips zusätzlich eine Videoverbindung.
- Funktioniert ein eigener Prompt besser, wenn alle Charaktere zusammengefasst sind, schalte **Use NovelAI Character Prompts** aus.
- Langsame Anbieter laufen leicht in ein Zeitlimit. Erhöh `IMAGE_GEN_TIMEOUT_MS` oder `VIDEO_GEN_TIMEOUT_MS` in der `.env` und starte Marinara neu. Der Server liest diese Werte nur beim Start.

Beide Abläufe beschreibt die [Anleitung zum Storyboard-Agenten](game/storyboard.md); die Einrichtung des Spiels beschreibt [Game Mode: Erste Schritte](game/getting-started.md).

### Die Weltgenerierung im Game Mode zeigt einen JSON-Fehler

Scheitert der Spielstart daran, dass das Modell fehlerhaftes JSON geliefert hat, öffnet Marinara das Fenster **Repair JSON**, statt den ganzen Zug zu verwerfen. JSON ist das strukturierte Textformat, das das Modell zurückgeben muss.

1. Korrigier Klammern, Kommas oder Felder im Editor. Sobald sich der Text fehlerfrei einlesen lässt, meldet das Banner **JSON is valid.**
2. Klick auf **Format**, um die Formatierung aufzuräumen.
3. Klick auf **Apply Repaired JSON**, um es zu übernehmen, ohne die ganze Antwort neu zu generieren.

## Stimme, Anrufe und TTS

- Sprechen die Charaktere während eines Anrufs nicht, ist Text to Speech (Sprachausgabe) noch nicht eingerichtet. Öffne **Connections** > **Text to Speech**, aktivier die Funktion, wähl eine Quelle, trag den Key ein, such eine Stimme aus und speichere. Ein Charakter ohne Stimme erscheint nur als Text.
- Funktioniert das Mikrofon nicht, brauchst du womöglich das lokale Sprachmodell. Installier **Calls** über **Agents > Download Agents**, öffne dann **Connections** > **Local Model**, klapp die Karte auf, such **Local Speech Model**, wähl ein Whisper-Modell und klick auf **Download Whisper**. Vor allem Firefox braucht das, weil ihm die Spracherkennung im Browser fehlt. Beim Deinstallieren von **Calls** löscht Marinara dessen Whisper-Modelle und gibt den Speicherplatz frei.
- In einem Lite-Build bedeutet die Meldung **Local Whisper is disabled in Lite mode**, dass dieser schlanke Build das lokale Sprachmodell nicht ausführen kann. Nutz dafür eine vollständige Marinara-Installation.

### Der Spotify-Login des Music DJ scheitert bei einer Remote- oder Netzwerkinstallation

Der Spotify-Modus des Music-DJ-Agenten läuft über OAuth. OAuth ist eine Login-Übergabe, bei der Spotify dich an eine Rückrufadresse zurückschickt. Eine Redirect-URI ist genau diese Rückrufadresse, und Spotify akzeptiert dafür nur `https://`-Adressen oder die Loopback-Adresse `http://127.0.0.1`. Einfache Netzwerk-IP-Adressen lehnt Spotify ab.

- Erreichst du Marinara über localhost, zeigt der Editor eine `127.0.0.1`-Rückrufadresse. Trag sie bei Spotify ein, dann klappt der Login.
- Erreichst du Marinara über HTTPS, zeigt der Editor deine HTTPS-Rückrufadresse. Trag diese ein.
- Wird HTTPS vorgelagert terminiert und der Host passt nicht, setz `SPOTIFY_REDIRECT_URI` in der `.env` auf deine öffentliche Rückrufadresse.
- Bei einer Netzwerkinstallation über reines HTTP kann das Popup nicht laden, in der Adressleiste steht aber trotzdem ein gültiger Code. Kopier die vollständige URL aus dem Popup. Klapp anschließend unter der Connect-Schaltfläche **Browser couldn't reach the callback?** auf und füg sie dort ein. Die eingefügte URL ist 10 Minuten lang gültig.

Am saubersten löst du das langfristig, indem du den Server hinter HTTPS setzt. Zuletzt geprüft mit Marinara Engine 2.2.0. Spotify hat diese Regeln im Februar 2025 verschärft.

## Speicher und Daten

### Beim Start heißt es, ein anderer Prozess verwende möglicherweise das Datenverzeichnis

Nur ein laufender Marinara-Server darf in ein lokales Datenverzeichnis schreiben. Meldet der Start **Another Marinara Engine process ... may be using** für das Verzeichnis, beende den anderen Marinara-Prozess und starte erneut.

Nach einem Absturz oder einem verschobenen Docker-Datenvolume kann stattdessen **The storage writer lease ... is incomplete or invalid** erscheinen oder ein Prozess genannt werden, der auf diesem Host nicht mehr existiert. Prüfe zuerst, dass alle Marinara-Prozesse und -Container mit diesem Datenverzeichnis beendet sind. Entferne dann ausschließlich das in der Fehlermeldung genannte Verzeichnis `.writer-lease` und starte Marinara neu. Entferne weder das umgebende Verzeichnis `storage` noch Tabellendateien.

### Nach einem Update fehlen scheinbar Daten

Wirken Chats oder Presets nach einem Update verschwunden, lösch erst einmal keine Datenordner. Marinara legt die aktiven Daten in einem Ordner `storage` innerhalb seines Datenverzeichnisses ab.

Sieh an diesen beiden lokalen Stellen nach einem Ordner `storage`:

1. `packages/server/data/`
2. `data/`

Der Server gibt beim Start aus, welches Daten- und welches Storage-Verzeichnis er ermittelt hat.

### Nach dem Wechsel zu einer älteren Version zeigen Chats keine Nachrichten

Neuere Marinara-Versionen speichern die Daten jedes Chats (Nachrichten, Swipes, Erinnerungen, Bilder und weitere chatbezogene Einträge) in eigenen Dateien statt in einer großen Datei pro Tabelle. Dadurch werden lange Chats wesentlich schneller gespeichert. Ältere Versionen verstehen dieses Layout nicht. Nach einem Wechsel zu einer älteren Version wirken Chats leer — die Daten liegen weiterhin auf der Festplatte, die ältere Version kann sie nur nicht lesen.

Marinara verhindert offensichtliche Downgrades selbst: Der Launcher überspringt ein Auto-Update auf eine inkompatible Version, und der Updater in der App blockiert es mit einem Fehler, der hierher verweist.

So führst du den Downgrade trotzdem aus:

1. Beende den Marinara-Server.
2. Führe im Marinara-Ordner Folgendes aus:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Wechsle zur älteren Version und starte sie wie gewohnt.

Der Befehl stellt aus den Dateien pro Chat das alte Layout mit einer Datei pro Tabelle wieder her. Nichts wird gelöscht: Die Chatdateien bleiben neben jeder neu aufgebauten Datei in Ordnern namens `<table>.post-unshard-<timestamp>` erhalten (zum Beispiel `messages.post-unshard-…`), und ursprüngliche Dateien vor der Migration bleiben als `.pre-shard` bestehen. Bei einem späteren Upgrade konvertiert Marinara die Daten automatisch wieder zurück.

Docker und Podman speichern Daten im Volume `marinara-data`. Führe den Befehl deshalb in einem einmaligen Container aus: Stoppe den laufenden Container, führe `docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard` aus und starte anschließend das ältere Image.

### Backup oder Export liefert 403

Loopback-Sitzungen dürfen Backups ohne Admin-Secret anlegen. Von einem anderen Gerät, über eine Netzwerkadresse oder aus Docker heraus braucht es mehr: Setz `ADMIN_SECRET` auf dem Server und speichere denselben Wert unter **Settings** > **Advanced** > **Admin Access**. Soll auch Loopback das Secret verlangen, setz `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android und Docker

### Die Android-App hängt bei Connecting oder Waiting for Server

Die Android-App ist nur eine schlanke Hülle um Termux. Termux ist eine Linux-Terminal-App für Android, und darin läuft der eigentliche Marinara-Server.

1. Tipp auf **Install / Start Marinara**.
2. Fragt Android, ob Termux installiert werden soll, bestätige die Abfragen.
3. Fragt Android, ob Befehle in Termux laufen dürfen, erlaub es.
4. Warte, bis der Launcher durchgelaufen ist und den Server gestartet hat, und kehr dann zur App zurück.

Der normale APK-Weg verlangt nie, dass du einen Marinara-Geheimwert einfügst. Die App erzeugt ihre privaten localhost-Zugangsdaten, überträgt sie an Termux und meldet sich automatisch an. Die Installations- und Termux-Berechtigungsdialoge von Android bleiben notwendige Systemabfragen. Füge weder `null` noch `http://null` oder den APK-Geheimwert zu `CSRF_TRUSTED_ORIGINS` hinzu; nichts davon ist ein gültiger oder nötiger Android-Einrichtungsschritt.

Prüf außerdem, ob App und Termux denselben Port nutzen. Der Standard ist `7860`. Hast du die App mit einem anderen Port gebaut, trag den passenden `PORT` auch in der `.env` von Termux ein.

### Android-localhost öffnet die Anmeldeseite oder gibt 401/503 zurück

Von der APK verwaltete Termux-Installationen schützen localhost mit einem privaten Geheimwert pro Installation. Die Android-App authentifiziert sich automatisch und sollte während der Einrichtung keine Anmeldeseite anzeigen. Erscheint sie innerhalb der Marinara-Engine-App, installiere die [neueste APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), tipp erneut auf **Install / Start Marinara** und kehr nach Abschluss von Termux zur App zurück.

Ein Fehler, der den Ursprung `null` nennt, bedeutet, dass ein älteres APK/Server-Paar den undurchsichtigen WebView-Ursprung von Android vor dem privaten Handshake an die allgemeine CSRF-Prüfung weitergegeben hat. Das lässt sich nicht durch Bearbeiten von `.env` beheben: Der Literalwert `null` wird absichtlich ignoriert, und globales Vertrauen in einen undurchsichtigen Ursprung würde jede unsichere API-Route schwächen. Aktualisiere APK und Engine; aktuelle Android-Anmelderouten prüfen ihren eigenen einmaligen Nachweis oder installationsbezogenen Geheimwert, während `null` überall sonst abgelehnt bleibt.

Nur ein separater Browser auf demselben Handy braucht die manuelle lokale Browser-Authentifizierung. Öffne darin `/android-login` und füge den Wert aus diesem Termux-Befehl ein:

```bash
cat ~/.marinara-engine/android-secret
```

Die lokale `mari`-CLI liest dieselbe Datei automatisch. 401 bedeutet, dass der eingefügte Geheimwert oder eine Authentifizierungs-Challenge abgelehnt wurde; lade `/android-login` neu und füge den aktuellen Wert ein. 503 bedeutet, dass der Server einen fehlerhaft konfigurierten Geheimwert erhalten hat. Starte über `./start-termux.sh` neu. Meldet der Launcher, seine Geheimwertdatei sei ungültig oder leer, kehr zur Android-App zurück und tipp auf **Install / Start Marinara**, damit die APK sie neu anlegt. Zeig diesen Geheimwert nie in Screenshots oder Problemberichten.

### Das Android-Update bricht mit Exit-Status 134 ab

Exit-Status 134 heißt meist, dass Android während eines Build-Schritts der Arbeitsspeicher ausgegangen ist. Aktualisiere erneut über den neuesten Launcher:

```bash
./start-termux.sh
```

Bricht es weiterhin ab, schließ andere Android-Apps, öffne Termux neu und führ den Befehl noch einmal aus.

### Termux schließt sich oder startet neu, während Marinara läuft

Der Launcher fordert einen Android-Wake-Lock an, solange der Server läuft, und speichert jede Serversitzung unter `~/.marinara-engine/logs/`. Füg nach einem unerwarteten Neustart die neueste Datei `server-*.log` dem Bericht bei. Endet sie ohne Marinara- oder Node-Fehler, hat Android oder der Gerätehersteller Termux höchstwahrscheinlich außerhalb des Serverprozesses beendet.

Erlaub Termux in den Android-Einstellungen die Ausführung im Hintergrund und nimm es von der Akkuoptimierung aus. Unterstützt das Gerät das Add-on Termux:API, installier es zusammen mit dem Paket `termux-api`, damit `termux-wake-lock` verfügbar ist. Das verhindert nicht jeden herstellerspezifischen Prozessabbruch, beseitigt aber die häufige Ruhestands-Ursache und bewahrt in den dauerhaften Logs Hinweise auf Fehler innerhalb der Anwendung.

### Beim Android-Update geht während der Installation der Abhängigkeiten der Speicher aus

Die fertige Marinara-App ist nicht mehrere Gigabyte groß, und Noodle lädt auch keine eigenen KI-Modelle herunter. Ein großer temporärer Platzbedarf beim Update kommt fast immer vom Paket- und vom virtuellen Store von pnpm – besonders nach mehreren Releases oder einer abgebrochenen erzwungenen Neuinstallation.

Der aktuelle Launcher räumt Pakete aus älteren Releases weg und baut den Paket-Store pro Update nur noch einmal auf. Hat ein älterer Launcher das Gerät bereits vollgeschrieben, aktualisiere den Launcher und gib den nicht mehr referenzierten Cache frei, bevor du es erneut versuchst:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Lösch niemals `data`, `storage` oder `marinara-engine.db` – dort können deine Chats und Einstellungen liegen. Bricht der Befehl weiterhin ab, kopier die Ausgabe ab der Zeile `Installing dependencies` und nenn im Bericht zusätzlich den freien Speicher und den Arbeitsspeicher des Handys.

### Das Update in der App scheitert beim Wechsel zwischen Stable und Staging unter Android

Ein Kanalwechsel (Stable ↔ Staging) erzwingt eine nahezu vollständige Neuinstallation der Abhängigkeiten. Auf dem langsameren Speicher von Termux dauert das deutlich länger als ein normales Update. Der Updater in der App räumt jedem Schritt unter Android inzwischen mehr Zeit ein – ein Kanalwechsel, der früher mit einem nackten `Update failed: Command failed: corepack pnpm ... install` stehen blieb, sollte jetzt durchlaufen.

Scheitert ein Update trotzdem, nennt die Fehlermeldung jetzt den Schritt, der fehlgeschlagen ist, und zeigt das Ende seiner Ausgabe. Lies diese Meldung: Ein echter Fehler bei Abhängigkeiten oder Lockfile steht genau dort. Alternativ führst du das Update von Hand in Termux aus – mit dem Befehl aus dem Hinweis in der Fehlermeldung – oder gibst vorher Speicher frei:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle zeigt `Etc/Unknown` oder Zeitpläne laufen in der falschen Zeitzone

Für Conversation-Zeitpläne öffnest du die Chat Settings im Conversation Mode oder den Zeitplan-Editor eines Charakters und wählst dort **Schedule timezone**. Diese globale Auswahl gilt für jeden Conversation-Chat, auch für autonome Nachrichten im Hintergrund, und lässt sich mit **Use device** zurücksetzen.

Für Noodle oder Server-Jobs ohne Conversation-Vorgabe entfernst du eine leere Zeile `TZ=` aus der `.env` und startest Marinara neu, damit der Server die Zeitzone des Hosts übernimmt. Willst du eine Host-Rückfallzeitzone ausdrücklich festlegen, trag einen gültigen IANA-Namen ein, etwa `TZ=Europe/Warsaw` oder `TZ=America/New_York`. Aktuelle Releases behandeln einen leeren Wert als nicht gesetzt, ein Neustart bleibt aber nötig, damit der Zeitzonen-Zustand von Node und die geplanten Jobs einheitlich neu aufgebaut werden.

### Container meldet „permission denied“ bei einem Volume-Mount

Wenn ein Docker- oder Podman-Container mit Rechtefehlern am Daten-Volume abbricht:

- Bei benannten Volumes nach einem Update holst du das neueste Image und startest neu mit `docker compose pull && docker compose up -d`. Das offizielle Image repariert die Besitzrechte beim Start.
- Bei Bind-Mounts machst du den Host-Ordner für Benutzer- und Gruppen-ID `1000` beschreibbar – oder du nimmst stattdessen ein benanntes Volume.
- Auf SELinux-Systemen wie Fedora oder RHEL hängst du das Suffix `:Z` an den Volume-Mount.

### Der Lite-Container stürzt auf einem Raspberry Pi 4 ab

Startet der Lite-Container auf einem Raspberry Pi 4 oder einem ähnlichen ARM-Gerät bei jeder KI-Anfrage neu, sieh dir den Exit-Code an. Exit 132 oder SIGILL deutet auf ein bekanntes Upstream-Problem im Node-Build des Lite-Images auf manchen ARM-Chips hin. SIGILL heißt, dass das Programm auf einen Befehl gestoßen ist, den die CPU nicht ausführen kann.

Das reguläre Image (also nicht Lite) ist davon nicht betroffen. Bis die Korrektur upstream ankommt, nutz auf diesem Gerät das reguläre Image. Bekannt betroffen sind unter anderem die Lite-Images `1.5.7-lite` und `1.5.8-lite`. Zuletzt geprüft mit Marinara Engine 2.2.0.

### External Extensions fehlt unter Addons

Der Abschnitt bleibt absichtlich verborgen, bis beide Sicherheitsschranken offen sind:

1. Setz `ENABLE_EXTERNAL_EXTENSIONS=true` in der `.env` des Hosts.
2. Warte etwa zwei Sekunden auf den Konfigurations-Watcher, öffne dann **Settings → Advanced → Danger Zone**, scroll unter die Bedienelemente zum Löschen von Daten und aktivier **Allow third-party extension imports**.

Lässt sich der Schalter in der Danger Zone nicht bedienen, steht das Host-Flag noch auf false oder die App hat die Änderung noch nicht bemerkt. Prüf, ob du wirklich die aktive `.env` bearbeitet hast, wie sie unter [Server-Konfiguration](CONFIGURATION.md) beschrieben ist. Unter Docker ist das normalerweise `/app/data/.env`.

Solange eine der beiden Schranken zu ist, tauchen externe, veraltete, per Profil importierte und manuell abgelegte Erweiterungs-Einträge ebenso wenig auf wie solche unbekannter Herkunft – und laufen auch nicht. Werden die Schranken wieder geöffnet, aktiviert Marinara sie nicht automatisch erneut.

### Eine importierte Browser Extension erscheint, funktioniert aber nicht

Öffne die Erweiterung unter **Settings → Addons → External Extensions** und sieh dir **Requested access** (angeforderte Zugriffsrechte) an. Ältere Pakete im Format `marinara.extension` v1 ohne Capabilities-Angabe sollten dort **Full page access** (Zugriff auf die gesamte Seite) zeigen. Bestätige nur genau den Hash, den du geprüft hast und dem du vertraust.

Wurde ein älteres Paket erneut mit einer ausdrücklich leeren Capabilities-Liste exportiert, behandelt Marinara es als sichere Sandbox-Erweiterung. Code, der auf das DOM zugreift, läuft dort nicht. Ergänze `full_page_access` nur dann im Manifest, wenn dir klar ist: Der Code erhält damit Zugriff auf die gesamte Marinara-Seite, auf den Browser-Speicher, auf Netzwerk-APIs und auf die Sitzung derselben Herkunft.

Bleibt nach dem Deaktivieren einer Erweiterung mit Zugriff auf die gesamte Seite ein Eintrag in der Symbolleiste, ein Overlay, ein Listener oder eine sichtbare Änderung zurück, lad Marinara neu. Das Aufräumen erfolgt nach bestem Bemühen, denn Seiten-Code kann Nebenwirkungen außerhalb der von Marinara überwachten Kompatibilitäts-API hinterlassen.

### Eine Server Extension meldet, es gebe keine unterstützte Sandbox

Server Extensions und rohe Shell-Befehle von Professor Mari laufen ausschließlich mit macOS Seatbelt oder Linux Bubblewrap. Das offizielle Docker-Image enthält Bubblewrap bereits, doch der standardmäßig minimal privilegierte Container darf dessen verschachtelte Namespaces und Mounts nicht erzeugen. Marinara erkennt diesen Zustand und deaktiviert OS-Sandbox-Funktionen, statt defekte Befehle zu versuchen.

Wenn du die breiteren Containerrechte akzeptierst und diese Funktionen in Docker brauchst, speichere Folgendes als `docker-compose.override.yml` neben `docker-compose.yml`:

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

Erstelle den Container danach neu. Der Serverprozess muss dabei root bleiben, damit die Fähigkeit nicht verloren geht, wenn Marinaras Einstiegspunkt normalerweise zum Benutzer `node` wechselt. root mit `SYS_ADMIN` ist eine weitreichende Rechteausweitung; das Abschalten von AppArmor schwächt die äußere Sicherheitsgrenze zusätzlich. Aktiviere dies nicht nur, um die Meldung zu beseitigen. Ein pauschales `seccomp=unconfined` sollte auf aktuellen Docker-Versionen nicht nötig sein.

Server Extensions laufen ausschließlich mit macOS Seatbelt oder Linux Bubblewrap. Installier `bwrap` auf dem Linux-Host und starte Marinara neu. Windows, Android und andere nicht unterstützte Hosts verweigern die Ausführung von Server Extensions bewusst, statt auf den Hauptprozess des Servers auszuweichen. Browser Extensions können ihre Worker-Sandbox mit undurchsichtigem Ursprung weiterhin nutzen.

## Weitere Hilfe bekommen

Wenn du weiter Hilfe brauchst, sammle zuerst brauchbare Details.

1. Öffne **Settings** > **Advanced** > **Message Tools** und schalte den **Debug mode** ein. Marinara schreibt dann Prompt- und Antwort-Payloads in die Server-Konsole, sodass du sie teilen kannst.
2. Notier dein Betriebssystem, deine Node.js-Version und den vollständigen Fehlertext aus der Server-Konsole.

Bevor du Debug-Ausgaben teilst: Entferne API-Keys, Zugriffstokens, Admin-Secrets, private Prompts und private Chat-Inhalte.

Und dann ab in die Community:

- Lies die offenen Issues unter https://github.com/Pasta-Devs/Marinara-Engine/issues
- Komm für Hilfe aus der Community in den Discord unter https://discord.com/invite/KdAkTg94ME
- Meld einen Bug unter https://github.com/Pasta-Devs/Marinara-Engine/issues und häng die oben gesammelten Details an.

## Verwandte Anleitungen

- [Häufige Fragen](FAQ.md)
- [Referenz zur Server-Konfiguration](CONFIGURATION.md)
- [Fernzugriff](REMOTE_ACCESS.md)
- [Marinara Engine aktualisieren](UPGRADING.md)
- [Mit einem KI-Anbieter verbinden](connections/connecting-to-a-provider.md)
- [Local Model einrichten](connections/local-model.md)
- [Game Mode: Erste Schritte](game/getting-started.md)
- [Einstellungen im Überblick](settings/settings-overview.md)
