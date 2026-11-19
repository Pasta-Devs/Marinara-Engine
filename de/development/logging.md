# Server-Logging

Diese Seite erklärt, wie du Server-Logs von Marinara Engine liest und hilfreiche Log-Zeilen schreibst. Sie ergänzt den [Logging-Abschnitt in CONTRIBUTING.md](../../CONTRIBUTING.md#logging), ersetzt ihn aber nicht. Der gemeinsame Pino-Logger, Aufrufe mit Fehlerobjekt zuerst, Formatplatzhalter und die Tabelle mit vier Log-Stufen gelten weiterhin.

<a id="what-every-line-carries"></a>

## Was jede Zeile enthält

Alle Serverzeilen stammen von einer Pino-Instanz: `logger` in `packages/server/src/lib/logger.ts`. Fastify nutzt sie über `loggerInstance`; `req.log`, `reply.log` und `app.log` sind daher ihre Kinder. Sie verwenden dieselben Serializer und übernehmen `LOG_LEVEL`-Hot-Reloads des Umgebungs-Watchers.

| Feld | Vorhanden bei | Bedeutung |
| --- | --- | --- |
| `pid` | jeder Zeile | Prozess-ID (Pino-Standard). |
| `hostname` | jeder Zeile | Hostname (Pino-Standard). |
| `bootId` | jeder Zeile | 8 Hexzeichen, bei jedem Prozessstart neu. Unterscheidet zwei Läufe in derselben Log-Datei. |
| `requestId` | jeder durch eine Anfrage ausgelösten Zeile | Identisch mit dem Antwortheader `x-request-id`. Steht sowohl auf `req.log`-Zeilen als auch auf Zeilen des gemeinsamen `logger` in Diensten. |
| `route` | Zeilen nach dem Body-Parsing | Passendes Routenmuster, etwa `/api/chats/:id`. Enthält nie die rohe URL. |

<a id="request-ids"></a>

### Anfrage-IDs

`lib/request-logging.ts` gibt jeder Anfrage eine ID:

- Ein Client darf `x-request-id` senden. Der Server übernimmt 8 bis 80 Zeichen aus `A-Z a-z 0-9 . _ : -`; alles andere ersetzt er.
- Sonst erzeugt der Server eine UUID. Fastifys standardmäßiger `req-1`-Zähler begann bei jedem Start neu, sodass sich IDs wiederholten.
- Die ID geht im durch CORS freigegebenen Header `x-request-id` an den Client zurück. Fehlerberichte können sie nennen; `grep <id>` findet dann jede Zeile dieser Anfrage.

Die ID liegt in einem `AsyncLocalStorage`-Kontext (`lib/log-context.ts`). Ein Pino-Mixin kopiert sie auf jede Zeile. Du musst sie nicht weiterreichen: Selbst `logger.warn(err, "...")` tief in einem Dienst übernimmt sie automatisch. Nach dem Body-Parsing wird der Kontext erneut gesetzt, weil das Parsing im eigenen asynchronen Kontext des HTTP-Parsers läuft.

Der Kontext folgt allem, was innerhalb der Anfrage startet, auch Timern, Listenern und Kindprozessen. Beginnt Arbeit, die die Anfrage überlebt, etwa ein Timer, Poller oder Kindprozess, wird dieser Start in `runWithRootLogContext({}, fn)` eingeschlossen. Spätere Zeilen tragen dann nicht die ID der auslösenden Anfrage. Der lokale Sidecar macht dies für seine llama-server- und MLX-Prozesse; Decision- und Utility-Sidecar starten ebenso, damit ein später gemeinsam genutzter Prozess nicht die ID des ersten Aufrufers behält. Andere langlebige Arbeit aus einem Routenhandler behält dessen `requestId`, bis ihr Start ebenfalls so eingeschlossen wird.

<a id="request-lines"></a>

### Anfragezeilen

`RequestLogController` ist Fastifys standardmäßiger `LogController` mit folgenden Änderungen:

- Das ID-Feld heißt `requestId`, nicht Fastifys `reqId`. Gespeicherte Suchen und Filter auf `reqId` brauchen den neuen Namen.
- Zeilen für `incoming request` und `Route ... not found` lassen Query-Strings weg, weil diese Tokens oder Suchtext enthalten können. Die Eingangszeile behält Fastifys andere `req`-Felder (`method`, `version`, `host`, `remoteAddress`, `remotePort`) und ergänzt `route`.
- Schließt ein Client eine Anfrage vorzeitig, erscheint eine `Client aborted request`-Zeile auf info. Fastify protokollierte hier nichts.

`LOG_DISABLE_REQUEST_LOGGING` funktioniert wie bisher und deaktiviert auch die Abbruchzeile.

Bei `pnpm dev` blendet pino-pretty `hostname` (seinen Standard) und `bootId` aus. Die produktive JSON-Ausgabe behält beide.

<a id="startup-timeline"></a>

## Startzeitablauf

`lib/startup-timeline.ts` misst jeden Startschritt:

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Jede Zeile enthält `event: "startup.phase"`, `stage`, `elapsedMs` (verstrichene Zeit) und `selfMs` (eigene Dauer ohne verschachtelte Phasen). Die Stufe folgt `selfMs`: debug unter 1 s, info über 1 s, warn über 15 s. Mit dem Standard `LOG_LEVEL=warn` erzeugt ein normaler Start keine Phasenzeilen, auch kein langsamer Erststart.
- Phasen sind verschachtelt. `app.build` in `index.ts` umfasst alle Phasen in `buildApp`. Da die Stufe von `selfMs` abhängt, meldet sich ein langsamer innerer Schritt nur einmal selbst. `app.build` bleibt auf debug, sofern seine eigene Arbeit außerhalb der inneren Phasen nicht langsam ist.
- Ein fehlgeschlagener Schritt wird nicht in der Phase protokolliert. Der Fehler wandert unverändert nach oben; `main().catch` in `index.ts` schreibt eine `startup.failed`-Zeile mit dem Schrittnamen (`startup.stageOf(err)`).
- Sobald der Server lauscht, schreibt `index.ts` eine info-Zeile `[startup] Ready in N ms` mit `event: "startup.ready"`, Phasenanzahl und den fünf größten `selfMs`-Werten.

Phasen fügen dem Log-Kontext kein `stage` hinzu. Während einer Phase gestartete Dienste behalten Timer; diese würden die Phase sonst über die gesamte Prozesslaufzeit tragen.

<a id="one-line-per-failure"></a>

## Eine Zeile pro Fehler

Ein Fehler soll genau eine Zeile erzeugen, geschrieben von dem Code, der über das weitere Vorgehen entscheidet.

- **Protokollieren oder weiterwerfen, nicht beides.** Beim Weiterwerfen protokolliert der Aufrufer. Nützliche Zusatzdetails gehören auf debug, etwa der Tool-Name in `[agent-tools] ... failed`.
- **Ort der einen Zeile:**
  - unbekannte 500er: `middleware/error-handler.ts`
  - Agentenfehler: `executeAgent` (warn, da nicht kritisch)
  - fehlgeschlagene Chat-Generierung: der Haupt-catch in `generate.routes.ts`
  - Der zugehörige Anbieter-Code wirft und protokolliert nicht. Höchstens ergänzt er eine debug-Zeile mit Modellname und rohem Fehler, wie die Anbieter Grok CLI und Claude (Subscription). Claude (Subscription) wirft eine verständliche Meldung, die den SDK-Fehlertext bereits enthält; der SDK-Fehler wird deshalb nicht zusätzlich als `cause` angehängt. SSE-Fehler des Chats und Agentenfehlertexte hängen die Ursache an und würden denselben Text sonst doppelt zeigen.
- **Abbrüche sind info.** Nutzer-Stopp, geschlossener Tab oder abgebrochenes Signal sind erwartete Ergebnisse. Nutze `failureLevel(err)` oder `failureLevel(err, "warn")` aus `lib/log-context.ts`. Bei `isCancellation(err)` gleich true liefert es `"info"`. Ein `TimeoutError` ist ein echter Fehler, kein Abbruch.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Ursache erhalten.** Umschließe mit `new Error("Could not save chat", { cause: err })`. Die Serializer für `err` und `error` ergänzen Meldung und Stack der Ursache (`caused by: ...`). Auch ein als `{ error }` protokollierter Error wird serialisiert und nicht mehr als `{}` ausgegeben.

<a id="repeating-failures"></a>

## Wiederkehrende Fehler

Poller, Zustandsprüfungen und Hooks pro Zug können alle paar Sekunden gleich scheitern. Nutze `logRateLimited` aus `lib/log-rate-limit.ts`:

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

Das erste Auftreten eines Schlüssels wird protokolliert. Weitere im Zeitfenster (standardmäßig 60 s) werden gezählt; die nächste Zeile enthält `suppressedRepeats`. Nimm die fehlschlagende Einheit, etwa Paket- oder Chat-ID, in den Schlüssel auf, damit ein defekter Eintrag keinen anderen verdeckt.

<a id="prompt-and-model-text"></a>

## Prompt- und Modelltext

Prompts, Modellausgaben, Anbieter-Antwortbodys und Polling-Bodys gehören auf **debug**, nie auf warn oder error. Sie können Geschichte des Nutzers enthalten; Anbieter-Bodys können Zugangsdaten oder Prompts wiederholen. Auf warn protokollierst du Größe (`rawLength`, `bodyLength`) und Grund. Eine JSON-Parsing-Fehlermeldung kann den problematischen Text zitieren: Auf warn deshalb nur den Fehlertyp schreiben. Fehler und Text selbst gehören auf eine separate debug-Zeile:

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

Der Debug-Schalter der Oberfläche funktioniert weiter über `logDebugOverride`. Das ist der vorgesehene Weg, Prompts auch dann zu sehen, wenn `LOG_LEVEL` debug ausblendet.

Standardmäßig landen eingebettete Medien nur gekürzt im Log. `debugJson` ersetzt jede Base64-Nutzlast durch eine Kurzangabe wie `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`. Sie enthält Typ, Größe sowie die ersten und letzten 16 Zeichen. Das gilt für `data:`-URLs, einzeln oder in einem Text, und für reine `data`-Felder in Medienelementen von Anthropic und Google. Auch Base64 über mehrere Zeilen wird gekürzt. Der `msg`-Serializer kürzt `data:`-URLs auch in einfachen `%s`- und `%j`-Zeilen. Ein reines `data`-Feld kürzt nur `debugJson`. Die Kürzung betrifft nur die Ausgabe. Der übergebene Wert bleibt unverändert. Mit `LOG_INLINE_MEDIA=full` in `.env` erscheinen die Nutzlasten wieder vollständig. Der Regressionstest `log-inline-media` prüft das.

<a id="checks"></a>

## Konsole in der App

Unter **Settings → Advanced → Open Console** (Einstellungen → Erweitert → Konsole öffnen) siehst du aktuelle Serverzeilen in der App. Das hilft bei Installationen, deren Terminal du nicht direkt erreichst (NAS, VPS, Docker, Termux).

- `lib/log-buffer.ts` hält die letzten 1.500 Zeilen im Arbeitsspeicher, höchstens etwa 4 Millionen Zeichen. Jede Meldung und jeder Feldblock wird bei 16.000 Zeichen gekürzt. Der Puffer schreibt nichts auf die Festplatte und wird beim Neustart geleert.
- `logger.ts` kopiert jede serialisierte Zeile über Pinos `hooks.streamWrite` in den Puffer. Der Puffer enthält damit dieselben Zeilen wie das Terminal oder die Logdatei beim selben `LOG_LEVEL`. Zeilen, die Pino umgehen, etwa die Zeile `injected env` von dotenv oder die Rohausgabe eines Kindprozesses, fehlen.
- `GET /api/admin/logs?afterId=` liefert die Zeilen nach `afterId` sowie `latestId`, `truncated` (vor dieser Abfrage sind Zeilen entfallen) und den `logLevel` des Servers. Die Route ist durch `requirePrivilegedAccess` geschützt und verwendet `no-store`. Sie läuft mit `logLevel: "silent"`, damit die Abfragen der Konsole selbst nicht im Puffer auftauchen.
- Die Regeln auf dieser Seite gelten auch hier. Alles, was du auf warn oder error protokollierst, kann ein Admin aus der Ferne in der App lesen. Belasse Prompts und Anbieter-Payloads deshalb auf debug.

## Prüfungen

Die Regressionen `logging-request-trail`, `logging-failure-lines` und `logging-startup-timeline` decken diese Seite ab. `server-console-logs` deckt die Konsole in der App ab:

```sh
node scripts/run-regressions.mjs --filter logging-
```
