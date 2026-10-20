# Engine-Grundlagen: Überblick über die Reihe

Diese Seite beschreibt den Beitrag zu den Engine-Grundlagen (Issue #6624). Der ursprünglich große Pull Request wurde in acht kleinere, unten A bis H genannte PRs aufgeteilt, damit jeder einzeln geprüft werden kann. Alle Teile bauen auf bereits gut funktionierendem Code in Marinara Engine auf. Keine bestehende API wird umbenannt, der gemeinsame Logger wird nicht ersetzt und Dateikonventionen bleiben erhalten. Änderungen für alle werden ausdrücklich genannt; alles andere bleibt bis zur Aktivierung ausgeschaltet.

<a id="the-pull-requests"></a>

## Die Pull Requests

| PR | Inhalt | Abhängigkeit |
| --- | --- | --- |
| **A** | Grundlagen: isolierte Regressionen, Anfrage-IDs und Startzeitleiste, zwei optionale Lorebook-Einstellungen, optionale Robustheitseinstellungen und Laufzeitdiagnose, Inject-Startsperre, Funktionsschalter, Best-Effort-Helfer | Keine (dieser PR) |
| **B** | Dev MCP für Programmierassistenten (`tools/dev-mcp/`) | Keine |
| **C** | Ctrl+K-Befehlspalette und „?“-Tastenkürzelübersicht (nur Client, kein Schalter) | Keine |
| **D** | Geprüfte Serverkorrekturen, Teil 1: Routen und Middleware; Speicherwiederherstellung, Chat- und Generierungsrouten, Importe, Sidecars und SSRF | A |
| **E** | Geprüfte Serverkorrekturen, Teil 2: Dienste und Speicherung | A |
| **F** | Prompt-Caching: Claude-Abonnement-Cache-Markierung, Agent-SDK-Update, cachefreundlicher Prompt-Aufbau, Warnung vor Versand mit geringer Cache-Nutzung, Cache-Diagnose | A |
| **G** | Generierungsaufträge laufen nach dem Schließen des Tabs weiter, Auftragsansicht und Windows-Konsolen-Tray | A (Befehlspalettenaktion außerdem C) |
| **H** | Engine-Diagnose und Launcher: Build-Integrität, Speichertelemetrie, Prompt-Debugdateien, Hintergrundaufruflimit, Launcher-Backup und Öffnen bei Bereitschaft, Wiederholung bei deaktiviertem Reasoning | A |

A, B und C sind unabhängig und in beliebiger Reihenfolge prüfbar. D bis H folgen auf A: Sie nutzen dessen Schalterregister (`isFeatureEnabled`, Settings > Advanced > Features), Protokollierung und Best-Effort-Helfer oder erweitern Startzeitleiste und Laufzeitdiagnoseroute. Jeder ergänzt eigene Schalter, CHANGELOG-Einträge und einen Abschnitt hier.

Jeder Teil von A erklärt den bisherigen Stand, Ergänzungen, unverändertes Verhalten, Prüfung sowie Abschalten oder Rücknahme.

Standardwerte: Änderungen an gespeicherten Daten, Prompts, Wiederholungen oder gestarteten Serverkomponenten sind standardmäßig aus, gesteuert durch Umgebungsvariablen oder **Settings > Advanced > Features** (Einstellungen > Erweitert > Funktionen, A6). Ohne Aktivierung bleibt das bisherige Verhalten erhalten. Fehlerkorrekturen, Testausführung und zusätzliche Helfer haben keinen Schalter; das steht jeweils dabei.

Rücknahme: Die Commits in A sind geordnet; spätere ändern teils dieselben Dateien (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Vom neuesten rückwärts zurückzunehmen vermeidet Konflikte.

Die meisten Prüfungen nutzen den vorhandenen Regression-Runner. Baue zuerst einmal das gemeinsame Paket (`pnpm build:shared`) und führe dann die Befehle im Repository-Stamm aus.

---

<a id="pr-a-foundations"></a>

# PR A: Grundlagen

> **Auf das Decision-Modell-Update rebasiert.** Decision-Aufrufe laufen bereits innerhalb ihrer auslösenden Anfrage und tragen deren `requestId`. Decision- und Utility-Sidecars starten im Stamm-Protokollkontext; spätere Zeilen tragen nicht die ID der ersten Anfrage. Ein fehlerhafter Decision-Slot erzeugt eine frequenzbegrenzte Warnung statt mehrerer pro Zug. Benutzerabbrüche erscheinen auf info, verworfene Decision-Aussagen als Anzahl auf warn, ihr Text nur auf debug. Beim Beenden werden beide Sidecars als benannte Schritte gestoppt. Decision-Aufrufe durchlaufen nicht den Provider-Wiederholungswrapper; nichts wird doppelt wiederholt.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. Testumgebung: jede Regressionsdatei in einem eigenen Datenordner

**Bisheriger Stand.** `scripts/run-regressions.mjs` findet alle Regressionen und führt sie einzeln über `runRegression()` aus, mit Timeout- und Signalbehandlung (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Jeder Kindprozess erhält das vollständige `process.env` des Entwicklers. Der Server kann `.env` bereits über `MARINARA_ENV_FILE` umleiten (`getEnvFilePath()` in `packages/server/src/config/runtime-config.ts`); `e2e/start-servers.mjs` isoliert seine Server schon so.

**Ergänzungen.** Der kleine Helfer `regressionEnvironment(scratchDir)`. `runRegression()` erstellt pro Datei einen temporären Ordner (`marinara-regression-*` im temporären Systemverzeichnis) und setzt `DATA_DIR`, `FILE_STORAGE_DIR` und `MARINARA_ENV_FILE` des Kindprozesses darauf. Nach Erfolg, Fehler, Timeout oder fehlgeschlagenem Start wird er entfernt. Nicht selbst isolierte Regressionen lesen damit weder die Entwickler-`.env` noch kollidieren sie mit der Schreibsperre des echten Datenordners.

**Unverändert.** Vorhandene Funktionen, `--filter`, `--list`, Timeouts, Zusammenfassung, `package.json`-Skripte und CI. Regressionen mit eigenen Variablenwerten behalten diese. Sichtbare Änderung: In der Shell exportierte `DATA_DIR`, `FILE_STORAGE_DIR` oder `MARINARA_ENV_FILE` werden pro Datei ersetzt. Das ist beabsichtigt und betrifft nur Tests.

**Selbst prüfen.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Im temporären Ordner darf danach kein `marinara-regression-*`-Ordner verbleiben.

**Abschalten / zurücknehmen.** Kein Schalter; Isolation ist Standard. Nimm den Test-Runner-Commit zurück, um den alten Runner wiederherzustellen, zuerst die neueren Commits; gemeinsam sind nur `CHANGELOG.md` und `CONTRIBUTING.md`. Eine Ausnahme wie `MARINARA_REGRESSION_INHERIT_STORAGE=1` wäre mit wenigen Zeilen möglich, wurde aber bewusst nicht als ungefragte Einstellung ergänzt.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. Protokollierung: eine Anfrage, einen Start und einen Fehler verfolgen

**Bisheriger Stand.** `packages/server/src/lib/logger.ts` exportiert den gemeinsamen Pino-`logger`. `protectTerminalLogger` verhindert Serverabstürze durch geschlossene Terminals; `logDebugOverride` unterstützt den Debugschalter der Oberfläche. Der Logging-Abschnitt in `CONTRIBUTING.md` verlangt den gemeinsamen Logger, Fehlerobjekt zuerst, Formatspezifizierer und vier Stufen. Diese Regeln gelten weiter. In `app.ts` übergab `buildApp()` Fastify eigene Loggeroptionen, wodurch eine zweite Pino-Instanz mit derselben Stufe entstand. Fastifys Anfragezähler `req-1`, `req-2` begann bei jedem Start neu.

**Ergänzungen.** Details stehen in `docs/development/logging.md`, jetzt im Logging-Abschnitt von `CONTRIBUTING.md` verlinkt.

- Fastify nutzt den gemeinsamen Logger (`loggerInstance: logger`). `req.log` verwendet dieselben Serialisierer und folgt Hot-Reloads von `LOG_LEVEL` über `followLogLevel`; beim Schließen wird das Abonnement beendet. Das entspricht bereits `CONTRIBUTING.md`.
- Jede durch eine Anfrage ausgelöste Zeile trägt `requestId`, auch tief in Diensten (`lib/log-context.ts` mit `AsyncLocalStorage`-Kontext und Pino-Mixin). Die ID ist eine UUID oder gültige `x-request-id`-Client-ID und wird im `x-request-id`-Header für Fehlerberichte zurückgegeben.
- Jede Zeile trägt `bootId`, damit Starts in derselben Logdatei unterscheidbar bleiben.
- Startzeitleiste (`lib/startup-timeline.ts`): Schritte in `app.ts` und `index.ts` laufen in `startup.phase("name", fn)`. Eine info-Zeile `[startup] Ready in N ms` listet die langsamsten Schritte; Startfehler nennen den fehlgeschlagenen Schritt.
- Eine Zeile pro Fehler: Provider und Werkzeuge werfen Fehler weiter, statt sie vorher zu protokollieren. Eine fehlgeschlagene Generierung schreibt damit nur eine error-Zeile. Benutzerstopps laufen über `failureLevel(err)` auf info. Die `cause`-Kette bleibt erhalten.
- Wiederholte Fehler aus Zustandsprüfungen, Scheduler-Abfragen und Prompt-Kontext-Beiträgen nutzen `logRateLimited` samt `suppressedRepeats`.
- Modellausgaben, Würfelanfragen, Spotify-Token-Antwortinhalte und Video-Abfrageinhalte wechseln zu debug; warn zeigt nur die Länge.
- Drei Regressionen: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**Unverändert.** Export und Dateiname von `logger`, `protectTerminalLogger`, `logDebugOverride`, `pid`, `hostname` sowie vorhandene `logger.*`- und `req.log`-Aufrufe. Fastifys `LogController` wird abgeleitet, nicht ersetzt. `LOG_LEVEL` (Standard `warn`) und `LOG_DISABLE_REQUEST_LOGGING` funktionieren weiter. Die `pnpm dev`-Konsole zeigt keine neuen Felder: pino-pretty blendet `bootId` wie standardmäßig `hostname` aus. `CONTRIBUTING.md` wird nur ergänzt.

Verhaltensänderungen, alle in `logging.md` beschrieben:

- `requestId` ersetzt Fastifys `reqId`; gespeicherte `reqId`-Filter benötigen den neuen Namen.
- Eingehende Anfragen und Nicht-gefunden-Zeilen enthalten keine Query-Zeichenfolge mehr, da sie Tokens enthalten kann. Andere `req`-Felder bleiben; `route` kommt hinzu.
- Neue info-Zeile `Client aborted request`, ebenfalls durch `LOG_DISABLE_REQUEST_LOGGING` abschaltbar.
- Startschritte mit Eigenzeit `selfMs` ohne Unterschritte über 15 s erscheinen auf warn, also auf der Standardstufe. Verschachtelte Schritte (`app.build` um `buildApp`) richten sich nach der eigenen Zeit; ein langsamer Schritt ergibt eine Zeile.

**Selbst prüfen.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

Oder starte den Server, sende eine Anfrage und suche den zurückgegebenen `x-request-id`-Wert mit `grep` im Protokoll.

**Abschalten / zurücknehmen.** `LOG_DISABLE_REQUEST_LOGGING=true` unterdrückt weiterhin Anfragezeilen; `LOG_LEVEL=warn` blendet bereits die neuen info-Zeilen aus. Für die vollständige Rücknahme zuerst neuere Code-Commits, dann den Logging-Commit zurücknehmen.

---

<a id="a3-performance"></a>

## A3. Leistung

Beide Optionen sind standardmäßig aus; dann bleiben Prompt und gespeicherte Daten bytegleich. Beide stehen in `.env.example` und der Lorebooks-Tabelle in `docs/CONFIGURATION.md`.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. Stabile Lorebook-Gruppenauswahl (`LOREBOOK_STABLE_GROUP_WINNERS`, Schalter `stableLorebookGroupPicks`)

**Bisheriger Stand.** `applyGroupSelection()` in `packages/server/src/services/lorebook/keyword-scanner.ts` wählt pro Einschlussgruppe gewichtet einen Gewinner (`pickWeightedGroupEntry`), mit Vorrang für haftende Einträge. Die Zufallsquelle ist injizierbar (`random`, Standard `Math.random`). Das erleichtert die Änderung. Neu würfeln pro Generierung kann ohne andere Änderungen den Gewinner wechseln lassen, verändert das Prompt-Präfix und verhindert Provider-Prompt-Caching.

**Ergänzungen.** Optionales `groupSeed` in `applyGroupSelection` und `ScanOptions`. Bei aktivierter Einstellung übergibt `processLorebooks` die Chat-ID: Dieselben aktivierten Kandidaten gewinnen in diesem Chat in jedem Zug gleich; andere Chats und Kandidatenmengen variieren weiterhin. Das vorhandene Paar `stableHash` + `createSeededRandom` aus der Vorschau Active Context (Aktiver Kontext) wurde unverändert von `lorebooks.routes.ts` nach `lorebook/seeded-random.ts` verschoben, sodass beide denselben Generator nutzen. Ab A6 auch **Stable lorebook picks** (Stabile Lorebook-Auswahl); eine gesetzte Umgebungsvariable hat Vorrang.

**Unverändert.** Funktionsnamen und Signaturen mit optionalem Zusatzparameter, Haftung und Gewichte. Injizierter Zufall steuert weiterhin Wahrscheinlichkeitsschranken; die Gruppenauswahl folgt bei Aktivierung dennoch dem Seed. Active Context und Generierung zeigen damit denselben Gewinner. Ausgeschaltet wird kein Seed übergeben; der alte Pfad bleibt.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` prüft Variable und Schalter.

**Abschalten / zurücknehmen.** `LOREBOOK_STABLE_GROUP_WINNERS` nicht setzen und Schalter auslassen.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. Gespeicherte Lorebook-Scans komprimieren (`LOREBOOK_COMPACT_STORED_SCANS`)

**Bisheriger Stand.** Jede generierte Nachricht speichert den vollständigen Text aktivierter Einträge in `extra.lorebookScan`, sowohl in der Nachrichtenzeile als auch je Swipe. Active Context kann so den exakten Antwortkontext anzeigen; lange Chats mit großen Lorebooks erzeugen jedoch deutlich größere Nachrichtentabellen.

**Ergänzungen.** Bei Aktivierung behält die neueste Assistenten- oder Erzählernachricht, die Active Context und Agentenwiederholungen lesen, den Volltext in Zeile und allen Swipes. Zurückwechseln zeigt weiterhin den ursprünglichen Kontext. Ein Scan eines imitierten Benutzerzugs wird komprimiert und übernimmt nie diese Rolle. Ältere Nachrichten behalten nur IDs, Namen, Schlüssel und Bewertungen. Die Komprimierung läuft nicht beim Speichern der Generierung, sondern für die vorherige Nachricht im Hintergrund, eine Nachrichtenwarteschlange nach der anderen. Fehler nutzen `logRateLimited` und werden beim nächsten Speichern erneut versucht. Nach Löschen neuerer Nachrichten greifen Active Context (`lorebooks.routes.ts`) und Agentenwiederholungen (`retry-agents-route.ts` über `storedContentForTextlessScanEntries`) auf den aktuell gespeicherten Eintragstext zurück. `scripts/compact-lorebook-scans.mjs` wendet dieselbe Regel auf ältere Chats an: standardmäßig Probelauf, verweigert die Ausführung bei aktiver Server-Schreibsperre und sichert beide Tabellen vor `--apply`.

**Unverändert.** Ausgeschaltet werden keine neuen Daten geschrieben; die Form bleibt identisch. Scanformat und Antworten von Active Context und Wiederholungsroute bleiben; der Ersatz greift nur ohne Scantext. Zwei kleine Standardkorrekturen betreffen alte Scans ohne Eintragstext: Active Context zeigt gespeicherten Text statt einer leeren Zeichenfolge; Agentenwiederholungen verwenden diese Einträge mit gespeichertem Text statt sie auszulassen.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` prüft unveränderte Standardform, Zurückswipen, imitierte Züge, Bereinigung älterer Nachrichten beim ersten Speichern, Active-Context-Ersatz über die echte Route und das Wartungsskript.

**Abschalten / zurücknehmen.** `LOREBOOK_COMPACT_STORED_SCANS` ungesetzt oder `false` lassen. Bereits komprimierte Nachrichten bleiben so; die neueste behält stets ihren Text. Nach `--apply` können die Tabellensicherungen die frühere Form wiederherstellen.

---

<a id="a4-robustness"></a>

## A4. Robustheit

Alle Verhaltensänderungen hier sind standardmäßig deaktivierte Umgebungsoptionen, dokumentiert in der Robustheitstabelle von `docs/CONFIGURATION.md` und in `.env.example`. Getrennte Dateien erlauben einzelne Prüfung, Aufteilung und Rücknahme. Neue Parameter und Felder sind optional; `isRateLimitError` und `base-provider.ts` bleiben in diesem Commit unverändert.

<a id="a4a-storage-writes"></a>

### A4a. Schreibvorgänge

**Bisheriger Stand.** `packages/server/src/db/file-backed-store.ts` schreibt geänderte Shards und `manifest.json` mit `serializeTableRows()` und `atomicWriteFile()` auf den Datenträger und behält `.bak` zur Wiederherstellung. Das bewährte atomare Schreib- und Sicherungsverfahren bleibt.

**Ergänzungen.**

- `STORAGE_SKIP_UNCHANGED_WRITES`: Kein erneutes Schreiben, wenn Inhalt, Dateigröße und mtime dem letzten dauerhaft gespeicherten Stand dieses Prozesses entsprechen. Aus `.bak` wiederhergestellte Dateien werden immer neu geschrieben.
- `STORAGE_YIELDING_SERIALIZE`: Große Shards werden in 12-ms-Abschnitten serialisiert, die die Ereignisschleife freigeben. Lange Chats blockieren andere Anfragen beim Speichern nicht; Ausgabe bytegleich zu `serializeTableRows`.

**Unverändert.** Beide aus: weiterhin `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile`. Jeder echte Schreibvorgang nutzt `atomicWriteFile`.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**Abschalten / zurücknehmen.** Beide Einstellungen ungesetzt lassen.

<a id="a4b-windows-boot"></a>

### A4b. Windows-Start

**Bisheriger Stand.** Die Schreibsperre erkennt den Betriebssystemstart mit `readBootId()` in `file-backed-store.ts`: PowerShell bei jedem Start (etwa 1,5 bis 2 s unter Windows) plus Identitätsabfrage mit `reg.exe`.

**Ergänzungen.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID`: Exaktes Abfrageergebnis pro Betriebssystemstart in `DATA_DIR/.writer-boot-id.json` zwischenspeichern (`db/writer-boot-id-cache.ts`). Keine Daten unter `LOCALAPPDATA`.
- Immer aktiv: `reg.exe` und PowerShell erhalten `windowsHide`. Serverstarts ohne Konsole lassen kein Fenster mehr aufblitzen; sonst keine Änderung.

**Unverändert.** Sperrlogik und Abfrage selbst; ohne Einstellung weiterhin Abfrage bei jedem Start.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**Abschalten / zurücknehmen.** Einstellung ungesetzt lassen oder `.writer-boot-id.json` löschen.

<a id="a4c-shutdown"></a>

### A4c. Beenden

**Bisheriger Stand.** `packages/server/src/index.ts` behandelt SIGINT, SIGTERM und außerhalb Windows SIGHUP mit `shutdown(signal)`, ignoriert Wiederholungen mit Warnung, aktiviert die 8-s-Frist `armShutdownDeadline` und wartet vor `closeDB()` auf alle Laufzeitstopps. Diese Reihenfolge bleibt.

**Ergänzungen.** `lib/shutdown-signals.ts` und `lib/shutdown-steps.ts`, genutzt von `index.ts` und `app.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break und Schließen der Konsole führen dieselbe geordnete Beendigung aus, innerhalb der etwa 5 s von Windows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: Ein zweites Ctrl+C mehr als 1,5 s nach dem ersten erzwingt das Beenden.
- `SHUTDOWN_EARLY_FLUSH`: Ausstehende Speicherungen beginnen sofort beim Stoppsignal. Fehler werden hier nicht doppelt protokolliert; der Store protokolliert sie bereits und versucht beim Schließen erneut.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (maximal 2500, Standard 0 = auf alle warten): Bei Stoppsignal startet `closeDB()` nach Ablauf des Budgets auch bei hängendem Laufzeitstopp. Beide letztgenannten Einstellungen betreffen nur Signale, nicht den Neustart über Advanced Settings in `admin.routes.ts`.
- Immer aktiv: Die drei Laufzeitstopps sind benannt; Fehler oder Dauer über 1 s werden mit Phase protokolliert.

**Unverändert.** Alles aus: dieselben Signale, Wiederholungen ignoriert, alle Laufzeitstopps vor `closeDB()` abgewartet, dieselbe 8-s-Frist.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**Abschalten / zurücknehmen.** Einstellungen ungesetzt lassen; die ersten beiden brauchen einen Neustart, worauf der Umgebungswächter hinweist.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. Provider-Wiederholung bei vorübergehenden Netzwerkfehlern (`PROVIDER_RETRY_TRANSIENT_ERRORS`, Schalter `providerRetry`)

**Bisheriger Stand.** `RateLimitAwareProvider` in `packages/server/src/services/llm/rate-limit-aware-provider.ts` wiederholt Ratenlimitfehler mit wachsender Wartezeit bis `MAX_RATE_LIMIT_RETRIES` und beachtet `Retry-After`. `connection-fallback-provider.ts` wechselt zur Ersatzverbindung. Beides funktioniert; abgelehnte Verbindungen oder Gateway-502 ließen die Generierung bisher scheitern.

**Ergänzungen.** Abgelehnte oder unerreichbare Verbindungen sowie Gateway-502/503 werden höchstens zweimal mit zufällig variierter Pause von 0,5 bis 2 s wiederholt (`Retry-After` bis 5 s), nur bevor Text oder Reasoning den Benutzer erreicht. Niemals bei 504 oder Socket-Reset. Nie auf der primären Verbindung mit nutzbarem Ersatz (`transientRetry: false`), damit der Wechsel schnell bleibt. Auch eine primäre Verbindung mit eigenem Wrapper, etwa von einem Capability-Paket an `llm.withFallback` übergeben, ist ausgenommen. Ab A6 auch **Retry failed provider calls** (Fehlgeschlagene Provider-Aufrufe wiederholen); gesetzte Umgebungsvariable hat Vorrang.

**Unverändert.** Ratenlimits: gleicher Zeitplan, kein Jitter, gleiche Callbacks. `isRateLimitError` und `base-provider.ts` unverändert.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**Abschalten / zurücknehmen.** Variable ungesetzt und Schalter aus lassen.

<a id="a4e-runtime-diagnostics"></a>

### A4e. Laufzeitdiagnose

**Bisheriger Stand.** `packages/server/src/routes/admin.routes.ts` bietet privilegierte Verwaltungsrouten wie `/request-timeouts`, aber keine gemeinsame schreibgeschützte Übersicht für Speicherung und Capability-Laufzeiten.

**Ergänzungen.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), geschützt durch `requirePrivilegedAccess`, `no-store` und eigenes Limit von 30 Anfragen pro Minute: im Speicher gehaltene Datenmengen, geänderte Tabellen, letzter Schreibfehler und aktive Paketlaufzeiten samt letztem Aktivierungsfehler. Neue optionale Hooks: `getStorageStats()` am Store-Controller, `getFileStoreStats()` in `db/connection.ts` und `runtimeState()` an `CapabilityModuleRuntime`.

**Unverändert.** Nur Lesen; keine bestehende Route, Antwort oder Zugriffsregel ändert sich.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` oder `/api/admin/runtime-diagnostics` auf einem lokalen Server mit privilegiertem Zugriff öffnen.

**Abschalten / zurücknehmen.** Ohne Aufruf inaktiv. Zur Entfernung die Route in `admin.routes.ts` und `lib/runtime-diagnostics.ts` löschen.

<a id="two-catches-that-used-to-be-silent"></a>

### Zwei bisher stille Fehlerbehandlungen

Entsprechend CONTRIBUTING protokollieren zwei bisher geschluckte Fehler nun auf warn: SillyTavern-Chatheader-Parsing in `import.routes.ts` (nur Fehlertyp, da JSON-Fehler Chattext zitieren können) und der Transport von Agenten-Aktivierungsfragen (frequenzbegrenzt).

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. Start: interne Anfragen warten auf abgeschlossene Routenregistrierung

Immer aktive Fehlerkorrektur, keine Einstellung.

**Bisheriger Stand.** `buildApp()` in `packages/server/src/app.ts` registriert Kernrouten, wartet auf `capabilityModuleRuntime.start(app)` mit sequenzieller Paketaktivierung über `activateOne()` in `services/capability-packages/capability-module-runtime.service.ts` und startet später `startServerAutonomousScheduler(app)`. Prozessinterne Routenaufrufe über `app.inject()` kommen aus Paketen via `runCapabilityInternalRoute()` in `capability-route-registration.service.ts`, dem autonomen Scheduler in `server-autonomous-scheduler.service.ts` und `routes/generate/prompt-preview.ts`. Das erste `inject()` startet die gesamte Fastify-Instanz; danach sind keine Routen, Hooks oder Plugins mehr hinzufügbar. Rief eine Hintergrundaufgabe (ein Paket-Timer oder ein früh gestarteter Worker) `inject()` auf, während `buildApp()` noch registrierte, scheiterte jedes spätere Paket mit "Root plugin has already booted"; das nächste `addHook` warf einen Fehler und stoppte den Server. `catch` in `activateOne()` protokolliert Aktivierungsfehler und führt `capabilityPackageManager.rollbackRuntime()` aus oder speichert Status und Bereitschaft `"error"`. Hier konnte so ein gesundes Paket auch bei späteren Starts zurückgesetzt oder als `"error"` markiert bleiben.

**Ergänzungen.**

- `lib/fastify-inject-gate.ts`: `buildApp()` ruft sofort nach Instanzerstellung `holdInjectUntilRegistered(app)` auf und gibt unmittelbar vor `return app` frei. Frühere `app.inject()`-Aufrufe mit Promise oder Callback warten bis Registrierungsende und erreichen auch später hinzugefügte Routen. Wirft ein zurückgehaltener Callback-Aufruf in `inject()`, erhält sein Callback den Fehler.
- `activate()` und `selfCheck()` gehören zur Registrierung; auf ihre eigenen internen Routen zu warten würde blockieren. `activateOne()` führt beide in `failInjectFastDuring()` aus. Direkte `inject()`-Aufrufe scheitern sofort mit `InjectDuringRegistrationError` (`code`: `MARINARA_INJECT_DURING_REGISTRATION`). Nur dieses Paket scheitert; der Start läuft weiter. Timer, die nach Rückkehr aus `activate()` auslösen, warten wie andere Hintergrundaufrufe.
- Andere wartende Aufrufe protokollieren nach 60 s eine Warnung mit Aufrufer-Stack und scheitern nach 10 Minuten mit demselben Fehler. Hängende Starts bleiben nicht lautlos hängen. Die Timer sind unref'd und halten keinen Prozess am Leben.
- `isHostLifecycleActivationError()` in `capability-module-runtime.service.ts` erkennt `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") und `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening"). Diese Aktivierungsfehler lösen weder Rollback noch gespeicherten Status/Bereitschaft `"error"` aus. Version und Status bleiben; beim nächsten Start wird normal aktiviert. Einmalige warn-Zeile und Eintrag für die Laufzeitdiagnose bleiben. Andere Fehler behalten error-Zeile, Rollback und `"error"`-Status.
- Regression: `startup-inject-gate`.

**Unverändert.** Nach Rückkehr aus `buildApp()` ist `app.inject()` wieder Fastifys Original ohne Wrapper. Verkettetes `app.inject()` ohne Argumente wartet nie. Registrierungsreihenfolge, Routen, `runCapabilityInternalRoute()`, Scheduler und Aktivierung/Update nach dem Start bleiben gleich. Eine Ausnahme im laufenden Server: Fügt ein über die Oberfläche aktiviertes Paket eine neue Route hinzu, wirft Fastify weiterhin `FST_ERR_INSTANCE_ALREADY_LISTENING`, aber die neue Version bleibt installiert und aktiviert sich nach Neustart statt zurückgerollt zu werden. Der Aufrufer erhält weiterhin den Fehler.

**Selbst prüfen.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

Prüft Freigabe und später hinzugefügte Route, Callbacks, sofortigen Fehler in `activate()`, von `activate()` gestarteten Timer, 10-Minuten-Limit mit kurzen Testwerten, Installation/Freigabe der Sperre in `buildApp()` und Rückkehr vor Rollback mit genau einer Warnung bei Host-Lebenszyklusfehlern.

**Abschalten / zurücknehmen.** Kein Schalter. `MARINARA_INJECT_DURING_REGISTRATION` ist nur der Fehlercode von `InjectDuringRegistrationError`, keine Einstellung. Zur Entfernung den Commit der Inject-Startsperre zurücknehmen.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. Funktionsschalter: Settings > Advanced > Features

**Bisheriger Stand.** Optionale Serverfunktionen werden über Umgebungsvariablen gesteuert (A3/A4), ohne zentrale Oberfläche; jede neue Option bräuchte eigene Einstellung, Route und UI.

**Ergänzungen.** Ein Register und ein Einstellungsabschnitt, später von F, G und H erweitert. Details in `docs/configuration/features.md`.

- `packages/shared/src/schemas/feature-settings.schema.ts` enthält Namen und Standardwerte. Ein JSON-Objekt in der App-Einstellung `features` speichert nur Abweichungen vom Standard.
- Zwei neue Schalter: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a) und **Retry failed provider calls** (`providerRetry`, A4d).
- Serverseitig liest `isFeatureEnabled()` in `services/features/feature-settings.ts` eine Speicherkopie ohne Zusatzaufwand auf häufigen Pfaden. Laden bei Registrierung der App-Einstellungsrouten; Aktualisierung bei Schreiben/Löschen der Zeile, entsprechenden Professor-Mari-Datenbankbefehlen und `.env`-Neuladen. `GET` und `PUT /api/app-settings/features`; `PUT` validiert strikt.
- Gesetzte Umgebungsvariablen haben für an und aus Vorrang. `LOREBOOK_STABLE_GROUP_WINNERS` und `PROVIDER_RETRY_TRANSIENT_ERRORS` fixieren nun die Schalter, statt separat gelesen zu werden.
- Der Client listet alle unter Settings > Advanced > Features. Durch Umgebungsvariablen fixierte Schalter erscheinen gesperrt mit Variablennamen. Andere Komponenten nutzen `useFeatureEnabled()`.

**Unverändert.** Alle standardmäßig aus; ohne Besuch des Abschnitts bleibt alles gleich. Bestehende Umgebungsvariablen behalten ihre Wirkung.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter feature-settings` prüft Register, Standards, Normalisierung, Variablenvorrang, Routen, Speicherung, Mari-Invalidierung und Listener. In der App: Settings > Advanced > Features oder nach `features` suchen.

**Abschalten / zurücknehmen.** Beide Schalter auslassen oder Umgebungsvariablen entfernen. Rücknahme des Schalter-Commits entfernt den Mechanismus; beide Variablen arbeiten dann wieder eigenständig.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. Protokollierende Best-Effort-Helfer

Zusätzlicher Helfer ohne Schalter und ohne eigene Verhaltensänderung.

**Bisheriger Stand.** Manche Fehler werden absichtlich mit leerem `catch` ignoriert, etwa bei Bereinigung, Cursorfortschritt oder Cache-Schreiben. Das ist richtig, hinterlässt aber keine Protokollspur.

**Ergänzungen.** `packages/server/src/lib/best-effort.ts` mit `logSuppressed`, `orFallback` und `bestEffort`. Absichtlich geschluckte Fehler nutzen `logRateLimited` (A2), höchstens eine Zeile pro Minute je Ereignis, Chat und Phase. Die geprüften Korrekturen D/E ersetzen damit leere Fehlerbehandlungen.

**Unverändert.** In diesem PR ruft noch nichts die Helfer auf; keine bestehenden Pfade ändern sich.

**Selbst prüfen.** `node scripts/run-regressions.mjs --filter best-effort`.

**Abschalten / zurücknehmen.** Kein Schalter; Rücknahme des Helfer-Commits entfernt die Datei.

---

<a id="coming-in-later-pull-requests"></a>

# Spätere Pull Requests

Diese Abschnitte sind bewusst kurz. Jeder PR ergänzt beim Öffnen seinen Abschnitt mit denselben fünf Teilen.

Stand: PR A wurde als #6647 gemergt und PR B als #6648. PR C (#6649) wurde ohne Merge geschlossen, und die PRs D bis H wurden nicht als eigene Pull Requests geöffnet. Die Abschnitte zu C bis H unten beschreiben den Plan so, wie er geschrieben wurde; lies sie nicht als Funktionen, die in dieser Form ausgeliefert wurden.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: Dev MCP für Programmierassistenten

Optionaler lokaler Dev-MCP-Server unter `tools/dev-mcp`, außerhalb von pnpm-Workspace und Docker-Image. Nutzt die Anfrage-ID-Spur aus A2. Einrichtung und Prüfungen stehen in `tools/dev-mcp/README.md`, hinzugefügt durch B.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: Befehlspalette und Tastenkürzelübersicht

Folgt in C: Ctrl+K-Palette und „?“-Übersicht der App-Tastenkürzel. Nur Client, kein Schalter, bestehende Belegungen unverändert.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: Geprüfte Serverkorrekturen, Teil 1

Folgt in D: Routen, Middleware, Speicherwiederherstellung, Chat/Generierung, Importe, Sidecars und SSRF, jeweils mit Regression. Fehlerkorrekturen ohne Schalter.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: Geprüfte Serverkorrekturen, Teil 2

Folgt in E: Dienste und Speicherung mit jeweils eigener Regression. Fehlerkorrekturen ohne Schalter.

<a id="pr-f-prompt-caching"></a>

## PR F: Prompt-Caching

Folgt in F: Claude-Abonnement-Verlaufs-Cache-Markierung korrigieren, Claude Agent SDK aktualisieren, cachefreundlicher Prompt-Aufbau (Schalter, standardmäßig aus), chatbezogene Warnung vor Versand mit geringer Cache-Nutzung (standardmäßig aus) und optionale Cache-Diagnose.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: Generierungsaufträge und Konsolen-Tray

Folgt in G: Bild-, Sprite- und Videoaufträge laufen bei geschlossenem Tab weiter, mit Auftragsansicht (Schalter, standardmäßig aus) und Windows-Konsolen-Tray-Symbol (Schalter, standardmäßig aus).

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Engine-Diagnose und Launcher

Folgt in H: Build-Integritätsprüfung beim Start, Laufzeit-Speichertelemetrie, optionale Prompt-Debugdateien, Hintergrundaufruflimit (Schalter, standardmäßig aus), Launcher-Sicherheitsmaßnahmen und Wiederholung ohne Reasoning-Deaktivierung für stets nachdenkende Modelle.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## Testergebnisse für PR A auf dem Entwicklungsrechner

Geprüft auf `staging`-Basiscommit `dd876831a`. Keine kostenpflichtigen Modellaufrufe.

- **Linux-Node-Regressionen**, wie CI-Job `complete-node-regressions` (Ubuntu 24.04 unter WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): alle 384 Dateien bestanden. Bei höherer Auslastung erreichte `server-signal-shutdown` teils das 30-s-Limit, auch auf unverändertem `staging`. Zeitabhängige Dateien `smart-group-decision`, `agent-activation-questions`, `advanced-memory-core` scheiterten je einmal und bestanden jede Wiederholung.
- **Windows-Node-Regressionen**: 379 von 384 bestanden. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown` und `storage-writer-lock` scheitern auf dem Windows-Testrechner ebenso auf unverändertem `staging`; lokale Ursachen sind Dateisperren, Konsolensignale und eine Speicherplatzprüfung.
- **Typprüfung, Lint, Formatierung und Builds**: `tsc --noEmit` für shared, server, client, Stamm- und Token-Schätzprojekt; Lint ohne Fehler; Prettier für `packages/**/*.{ts,tsx}`; Locale- und statische JSX-Lokalisierungsprüfungen; Client- und Server-Builds.
- **Browsertests** der Einstellungen (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) in `mobile-chromium`: 171 bestanden, 0 fehlgeschlagen. Verbleibende Fehler nach Wiederholung in `mobile-webkit` (WebKit unter Windows) treten ebenso auf unverändertem `staging` auf.
- **Features-Abschnitt** visuell mit Standard- und SillyTavern-Thema, hell/dunkel, auf Desktop- und Handygrößen geprüft.
