# Podstawy silnika: przegląd serii

Ta strona opisuje wkład dotyczący podstaw silnika (zgłoszenie #6624). Początkowo był to jeden duży pull request, teraz podzielony na osiem PR-ów, A–H, do osobnego przeglądu. Wszystkie wykorzystują działający już kod Marinara Engine. Nie zmieniają nazw istniejących API, wspólnego loggera ani konwencji plików. Zmiany dotyczące wszystkich są wyraźnie oznaczone; pozostałe funkcje są wyłączone do chwili ich włączenia.

<a id="the-pull-requests"></a>

## Pull requesty

| PR | Zawartość | Zależność |
| --- | --- | --- |
| **A** | Podstawy: izolowane regresje, śledzenie żądań i osi startu, dwie opcje lorebooka, opcje odporności i diagnostyka wykonania, blokada inject podczas startu, przełączniki funkcji, pomocnicze operacje best-effort | Brak (ten PR) |
| **B** | Dev MCP dla asystentów programowania (`tools/dev-mcp/`) | Brak |
| **C** | Paleta Ctrl+K i nakładka "?" ze skrótami (tylko klient, bez przełącznika) | Brak |
| **D** | Sprawdzone poprawki serwera, część 1: trasy i middleware; odzyskiwanie danych, czat i generowanie, importery, procesy sidecar i SSRF | A |
| **E** | Sprawdzone poprawki serwera, część 2: usługi i przechowywanie | A |
| **F** | Cache promptów: znacznik subskrypcji Claude, aktualizacja Agent SDK, układ sprzyjający cache, ostrzeżenie przed wysłaniem przy małym wykorzystaniu cache, diagnostyka | A |
| **G** | Generowanie działające po zamknięciu karty, widok zadań i ikona konsoli Windows w zasobniku | A (akcja palety wymaga też C) |
| **H** | Diagnostyka i launcher: integralność kompilacji, telemetria pamięci, pliki debugowania promptów, limit wywołań w tle, kopia i otwarcie po gotowości, ponowienie związane z wyłączonym rozumowaniem | A |

A, B i C są niezależne; można je przeglądać w dowolnej kolejności. D–H następują po A: korzystają z rejestru przełączników (`isFeatureEnabled`, Settings > Advanced > Features), śledzenia logów i pomocników best-effort albo rozszerzają oś startu i trasę diagnostyczną. Każdy dodaje własne przełączniki, wpisy CHANGELOG i sekcję tej strony.

Każda część A opisuje stan obecny, dodatki, niezmienione zachowanie, weryfikację oraz wyłączenie lub wycofanie.

Domyślnie zmiany danych, promptów, ponowień i uruchamianych komponentów są wyłączone, sterowane zmienną środowiskową albo **Settings > Advanced > Features** (Ustawienia > Zaawansowane > Funkcje, A6). Bez włączania zachowanie pozostaje takie samo. Poprawki, program testujący i dodatkowe pomocniki nie mają przełącznika; każda sekcja to zaznacza.

Wycofanie: commity A mają kolejność i częściowo wspólne pliki (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Wycofuj od najnowszego, aby uniknąć konfliktów.

Większość kontroli korzysta z istniejącego programu regresji. Najpierw raz zbuduj pakiet współdzielony (`pnpm build:shared`), następnie wykonuj polecenia w katalogu głównym repozytorium.

---

<a id="pr-a-foundations"></a>

# PR A: Podstawy

> **Przebazowano na aktualizację modeli Decision.** Wywołania Decision już działają w żądaniu, które ich potrzebuje, i mają jego `requestId`. Procesy sidecar decyzji i narzędzi startują w głównym kontekście logów; późniejsze wpisy nie zachowują ID pierwszego żądania. Awaria slotu Decision daje jedno ostrzeżenie z ograniczeniem częstotliwości zamiast wielu na turę. Anulowanie przez użytkownika ma poziom info; pominięte stwierdzenia są liczone na warn, ich tekst tylko na debug. Zamykanie obu procesów to nazwane kroki. Decision nie przechodzi przez wrapper ponowień dostawcy, więc nie ma podwójnych ponowień.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. Środowisko testowe: osobny katalog danych dla każdego pliku regresji

**Stan obecny.** `scripts/run-regressions.mjs` znajduje regresje i wykonuje je pojedynczo przez `runRegression()`, z obsługą limitów czasu i sygnałów (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Każdy proces potomny otrzymuje całe `process.env` programisty. Serwer pozwala już przekierować `.env` przez `MARINARA_ENV_FILE` (`getEnvFilePath()` w `packages/server/src/config/runtime-config.ts`); `e2e/start-servers.mjs` już tak izoluje serwery.

**Dodatki.** Pomocnik `regressionEnvironment(scratchDir)`. `runRegression()` tworzy katalog tymczasowy dla każdego pliku (`marinara-regression-*` w systemowym katalogu tymczasowym), ustawiając tam `DATA_DIR`, `FILE_STORAGE_DIR` i `MARINARA_ENV_FILE` procesu. Usuwa go po sukcesie, błędzie, przekroczeniu czasu lub nieudanym starcie. Nieizolowana regresja nie odczyta `.env` programisty ani nie wejdzie w konflikt z dzierżawą zapisu prawdziwych danych.

**Bez zmian.** Funkcje, `--filter`/`--list`, limity, podsumowanie, skrypty `package.json` i CI. Regresje definiujące własne zmienne zachowują wartości. Widoczna różnica: eksportowane w powłoce `DATA_DIR`, `FILE_STORAGE_DIR` i `MARINARA_ENV_FILE` są zastępowane dla każdego pliku. Celowo i tylko w testach.

**Jak sprawdzić.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

W katalogu tymczasowym nie powinien pozostać żaden `marinara-regression-*`.

**Jak wyłączyć / wycofać.** Brak przełącznika; izolacja jest domyślna. Wycofanie commitu programu testującego przywraca poprzedni; najpierw wycofaj nowsze, współdzielące tylko `CHANGELOG.md` i `CONTRIBUTING.md`. Opcja typu `MARINARA_REGRESSION_INHERIT_STORAGE=1` wymagałaby kilku linii, ale nie dodano niezamówionego ustawienia.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. Logowanie: śledzenie jednego żądania, startu i błędu

**Stan obecny.** `packages/server/src/lib/logger.ts` eksportuje wspólny `logger` Pino. `protectTerminalLogger` chroni przed awarią po zamknięciu terminala, `logDebugOverride` obsługuje debugowanie z interfejsu. Logging w `CONTRIBUTING.md` wymaga wspólnego loggera, obiektu błędu najpierw, specyfikatorów formatu i czterech poziomów; te zasady pozostają. W `app.ts` funkcja `buildApp()` przekazywała Fastify własne opcje, tworząc drugi Pino o tym samym poziomie. Licznik ID `req-1`/`req-2` resetował się przy starcie.

**Dodatki.** Szczegóły w `docs/development/logging.md`, teraz wskazywanym przez Logging w `CONTRIBUTING.md`.

- Fastify używa wspólnego loggera (`loggerInstance: logger`). `req.log` dzieli serializatory i śledzi przeładowania `LOG_LEVEL` przez `followLogLevel`, odsubskrybowywany przy zamknięciu. Tak już opisywał to `CONTRIBUTING.md`.
- Każdy wpis wywołany żądaniem ma `requestId`, także wewnątrz usług (`lib/log-context.ts`, kontekst `AsyncLocalStorage` i mixin Pino). ID to UUID albo poprawny `x-request-id` klienta, zwracany w nagłówku `x-request-id` do raportów.
- Każdy wpis ma `bootId`, rozróżniający uruchomienia w jednym pliku.
- Oś startu `lib/startup-timeline.ts`: kroki `app.ts`/`index.ts` opakowane w `startup.phase("name", fn)`. Wpis info `[startup] Ready in N ms` wskazuje najwolniejsze; nieudany start wskazuje etap awarii.
- Jeden wpis na awarię: dostawcy i narzędzia przekazują błąd dalej bez wcześniejszego logowania. Nieudane generowanie daje jeden error. Zatrzymanie użytkownika to info przez `failureLevel(err)`; łańcuch `cause` pozostaje.
- Powtarzające się błędy kontroli zdrowia, odpytywania harmonogramu i dostawców kontekstu używają `logRateLimited` z licznikiem `suppressedRepeats`.
- Odpowiedzi modeli, żądania rzutów kośćmi, treści tokenów Spotify i odpytywania wideo przechodzą na debug; warn podaje tylko długość.
- Trzy regresje: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**Bez zmian.** Eksport i plik `logger`, `protectTerminalLogger`, `logDebugOverride`, pola `pid`/`hostname` oraz wywołania `logger.*`/`req.log`. `LogController` Fastify jest rozszerzony podklasą, nie zastąpiony. `LOG_LEVEL` (domyślnie `warn`) i `LOG_DISABLE_REQUEST_LOGGING` działają jak wcześniej. Konsola `pnpm dev` nie pokazuje nowych pól: pino-pretty ukrywa `bootId` razem z `hostname`. `CONTRIBUTING.md` tylko uzupełniono.

Zmiany opisane w `logging.md`:

- `requestId` zastępuje `reqId` Fastify; zapisane filtry `reqId` wymagają nowej nazwy.
- Wpisy przychodzących żądań i nieznalezionych tras nie zawierają query string, który może ujawnić token. Inne pola `req` pozostają; dodano `route`.
- Nowy wpis info `Client aborted request`, także wyłączany przez `LOG_DISABLE_REQUEST_LOGGING`.
- Krok o czasie własnym `selfMs`, bez podkroków, ponad 15 s daje warn widoczny domyślnie. Zagnieżdżenie (`app.build` obejmuje `buildApp`) nie zmienia zasady: poziom zależy od czasu własnego, jeden wolny krok daje jeden wpis.

**Jak sprawdzić.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

Albo uruchom serwer, wyślij żądanie i znajdź zwrócone `x-request-id` przez `grep`.

**Jak wyłączyć / wycofać.** `LOG_DISABLE_REQUEST_LOGGING=true` jak wcześniej wycisza żądania; `LOG_LEVEL=warn` ukrywa nowe info. Całość usuniesz, wycofując commit logowania po nowszych commitach kodu.

---

<a id="a3-performance"></a>

## A3. Wydajność

Obie opcje są domyślnie wyłączone; wtedy prompty i dane są identyczne bajt po bajcie. Dokumentacja w `.env.example` i tabeli Lorebooks w `docs/CONFIGURATION.md`.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. Stabilni zwycięzcy grup lorebooka (`LOREBOOK_STABLE_GROUP_WINNERS`, przełącznik `stableLorebookGroupPicks`)

**Stan obecny.** `applyGroupSelection()` w `packages/server/src/services/lorebook/keyword-scanner.ts` wybiera ważonego zwycięzcę grupy włączenia (`pickWeightedGroupEntry`), preferując wpisy utrzymywane aktywnie. Źródło losowe jest wstrzykiwalne (`random`, domyślnie `Math.random`), co ułatwiło zmianę. Nowe losowanie przy każdej generacji może zmienić zwycięzcę bez innych zmian, modyfikując prefiks promptu i unieważniając cache dostawcy.

**Dodatki.** Opcjonalne `groupSeed` w `applyGroupSelection`/`ScanOptions`. Po włączeniu `processLorebooks` przekazuje ID czatu: ci sami aktywni kandydaci dają tego samego zwycięzcę w kolejnych turach tego czatu. Inne czaty i zestawy nadal się różnią. Para `stableHash` + `createSeededRandom` z Active Context (Aktywny kontekst) została przeniesiona bez zmian z `lorebooks.routes.ts` do wspólnego `lorebook/seeded-random.ts`. Od A6 także **Stable lorebook picks** (Stabilny wybór lorebooka); zmienna środowiskowa ma pierwszeństwo.

**Bez zmian.** Nazwy i sygnatury z opcjonalnym parametrem, trwałość i wagi. Wstrzyknięta losowość nadal steruje bramkami prawdopodobieństwa; po włączeniu seed decyduje jednak o zwycięzcach, więc Active Context odpowiada generacji. Po wyłączeniu brak seeda i poprzednia ścieżka.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` sprawdza zmienną i przełącznik.

**Jak wyłączyć / wycofać.** Nie ustawiaj `LOREBOOK_STABLE_GROUP_WINNERS` i pozostaw przełącznik wyłączony.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. Kompaktowanie zapisanych skanów lorebooka (`LOREBOOK_COMPACT_STORED_SCANS`)

**Stan obecny.** Każda wygenerowana wiadomość zapisuje pełny tekst aktywnych wpisów w `extra.lorebookScan`, w swoim wierszu i każdym swipe. Active Context pokazuje dokładny kontekst, lecz długie czaty z dużymi lorebookami mocno powiększają tabele.

**Dodatki.** Po włączeniu najnowsza wiadomość asystenta lub narratora, odczytywana przez Active Context i ponowienia agentów, zachowuje tekst w wierszu i wszystkich swipe. Powrót pokazuje oryginalny tekst danego wariantu. Skan z naśladowanej tury użytkownika jest kompaktowany i nigdy nie zajmuje tego miejsca. Starsze wiadomości zachowują ID, nazwy, klucze i wyniki. Kompaktowanie nie działa podczas zapisu generacji: zadanie w tle przetwarza poprzednią wiadomość, jedną kolejkę naraz. Błędy używają `logRateLimited` i ponowienia przy następnym zapisie. Po usunięciu nowszych wiadomości Active Context (`lorebooks.routes.ts`) i ponowienia (`retry-agents-route.ts` przez `storedContentForTextlessScanEntries`) używają aktualnie zapisanego tekstu wpisu. `scripts/compact-lorebook-scans.mjs` stosuje regułę do starszych czatów: domyślnie próba bez zapisu, odmowa przy dzierżawie zapisu serwera, kopie obu tabel przed `--apply`.

**Bez zmian.** Po wyłączeniu brak nowych zapisów i ta sama struktura. Format skanu i odpowiedzi tras Active Context/ponowień pozostają; zastępstwo działa tylko bez tekstu. Dwie poprawki domyślne dotyczą starszych skanów bez tekstu: Active Context pokazuje zapisany tekst zamiast pustego ciągu, a ponowienia uwzględniają wpisy zamiast je pomijać.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` obejmuje domyślną strukturę, powrót do swipe, naśladowane tury, przegląd wcześniejszych wiadomości przy pierwszym zapisie, zastępstwo przez prawdziwą trasę Active Context i skrypt konserwacji.

**Jak wyłączyć / wycofać.** `LOREBOOK_COMPACT_STORED_SCANS` nieustawione lub `false`. Już skompaktowane wiadomości pozostają takie; najnowsza zachowuje tekst. Kopie z `--apply` odtwarzają starszą strukturę.

---

<a id="a4-robustness"></a>

## A4. Odporność

Wszystkie zmiany są sterowane domyślnie wyłączonymi zmiennymi, opisanymi w tabeli odporności `docs/CONFIGURATION.md` i `.env.example`. Osobne pliki pozwalają niezależnie przeglądać, wydzielać i wycofywać. Nowe parametry/pola są opcjonalne; `isRateLimitError` i `base-provider.ts` nie zmieniają się w tym commicie.

<a id="a4a-storage-writes"></a>

### A4a. Zapis danych

**Stan obecny.** `packages/server/src/db/file-backed-store.ts` zapisuje zmienione fragmenty i `manifest.json` przez `serializeTableRows()`/`atomicWriteFile()`, zachowując `.bak` do odzyskiwania. Atomowy zapis i kopie pozostają.

**Dodatki.**

- `STORAGE_SKIP_UNCHANGED_WRITES` pomija zapis, gdy treść odpowiada ostatniemu trwałemu zapisowi procesu, a plik zachował rozmiar i mtime. Plik odzyskany z `.bak` zawsze jest nadpisywany.
- `STORAGE_YIELDING_SERIALIZE` serializuje duże fragmenty w odcinkach 12 ms, oddając sterowanie pętli zdarzeń. Długi czat nie blokuje innych żądań; wynik bajtowo zgodny z `serializeTableRows`.

**Bez zmian.** Obie wyłączone: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile` jak wcześniej. Każdy rzeczywisty zapis używa `atomicWriteFile`.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**Jak wyłączyć / wycofać.** Pozostaw obie nieustawione.

<a id="a4b-windows-boot"></a>

### A4b. Start Windows

**Stan obecny.** Dzierżawa identyfikuje start systemu przez `readBootId()` w `file-backed-store.ts`, uruchamiające PowerShell przy każdym starcie (około 1,5–2 s w Windows) i zapytanie tożsamości `reg.exe`.

**Dodatki.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` zapisuje dokładny wynik dla danego uruchomienia systemu w `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). Nic w `LOCALAPPDATA`.
- Zawsze aktywne: `reg.exe` i PowerShell dostają `windowsHide`; start bez konsoli nie powoduje mignięcia okna. Bez innych skutków.

**Bez zmian.** Logika dzierżawy i zapytanie; po wyłączeniu odpytywanie przy każdym starcie.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**Jak wyłączyć / wycofać.** Nie ustawiaj opcji albo usuń `.writer-boot-id.json`.

<a id="a4c-shutdown"></a>

### A4c. Zamykanie

**Stan obecny.** `packages/server/src/index.ts` obsługuje SIGINT, SIGTERM i poza Windows SIGHUP przez `shutdown(signal)`, ignoruje powtórzenia z warn, ustawia 8-sekundowe `armShutdownDeadline` i czeka na wszystkie runtime przed `closeDB()`. Kolejność zostaje.

**Dodatki.** `lib/shutdown-signals.ts` i `lib/shutdown-steps.ts`, używane przez `index.ts`/`app.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break i zamknięcie konsoli wykonują to samo łagodne zamknięcie w około 5 s dostępnych w Windows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: drugie Ctrl+C ponad 1,5 s po pierwszym wymusza wyjście.
- `SHUTDOWN_EARLY_FLUSH`: oczekujące zapisy ruszają natychmiast po sygnale. Błąd nie jest logowany ponownie tutaj: magazyn już go zapisał i ponowi podczas zamknięcia.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (maksimum 2500, domyślnie 0 = czekaj na wszystkie): przy sygnale `closeDB()` wykonuje się po upływie budżetu nawet przy zawieszonym runtime. Te dwie ostatnie opcje dotyczą tylko sygnałów; restart Advanced Settings w `admin.routes.ts` pozostaje bez zmian.
- Zawsze aktywne: trzy nazwane zatrzymania; błąd lub czas ponad 1 s jest logowany z etapem.

**Bez zmian.** Wszystko wyłączone: te same sygnały, ignorowane powtórzenia, wszystkie zatrzymania przed `closeDB()`, limit 8 s.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**Jak wyłączyć / wycofać.** Pozostaw opcje nieustawione; pierwsze dwie wymagają restartu, o czym informuje obserwator środowiska.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. Ponowienia przejściowych błędów sieci dostawcy (`PROVIDER_RETRY_TRANSIENT_ERRORS`, przełącznik `providerRetry`)

**Stan obecny.** `RateLimitAwareProvider` w `packages/server/src/services/llm/rate-limit-aware-provider.ts` ponawia limity szybkości z rosnącym opóźnieniem do `MAX_RATE_LIMIT_RETRIES`, respektując `Retry-After`. `connection-fallback-provider.ts` przełącza na połączenie zapasowe. Działa to poprawnie; odmowa połączenia lub 502 kończyły generację błędem.

**Dodatki.** Odmowa/niedostępność połączenia lub 502/503: maksymalnie dwa ponowienia z losowym opóźnieniem 0,5–2 s (`Retry-After` do 5 s), tylko przed dostarczeniem tekstu lub rozumowania. Nigdy 504 ani reset gniazda. Nie dotyczy głównego połączenia z działającym zapasowym (`transientRetry: false`), zachowując szybkie przełączenie. Wykluczone są też główne połączenia z własnym wrapperem, np. przekazanym przez pakiet możliwości do `llm.withFallback`. Od A6 także **Retry failed provider calls** (Ponawiaj nieudane wywołania); pierwszeństwo ma zmienna.

**Bez zmian.** Limity szybkości: ten sam harmonogram, bez losowości, te same callbacki. `isRateLimitError`/`base-provider.ts` nietknięte.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**Jak wyłączyć / wycofać.** Zmienna nieustawiona, przełącznik wyłączony.

<a id="a4e-runtime-diagnostics"></a>

### A4e. Diagnostyka wykonania

**Stan obecny.** `packages/server/src/routes/admin.routes.ts` udostępnia uprzywilejowane trasy jak `/request-timeouts`, bez wspólnego widoku tylko do odczytu dla magazynu i runtime.

**Dodatki.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), chronione przez `requirePrivilegedAccess`, `no-store` i 30 żądań na minutę. Liczby danych rezydentnych, zmienione tabele, ostatni błąd zapisu, aktywność runtime i ostatnia awaria aktywacji. Opcjonalne hooki: `getStorageStats()` kontrolera, `getFileStoreStats()` w `db/connection.ts`, `runtimeState()` w `CapabilityModuleRuntime`.

**Bez zmian.** Tylko odczyt; bez zmian istniejących tras, odpowiedzi i uprawnień.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` albo otwórz `/api/admin/runtime-diagnostics` lokalnie z uprzywilejowanym dostępem.

**Jak wyłączyć / wycofać.** Bez wywołania nie robi nic. Usuń trasę z `admin.routes.ts` i `lib/runtime-diagnostics.ts`, aby ją usunąć.

<a id="two-catches-that-used-to-be-silent"></a>

### Dwa wcześniej ciche przechwycenia

Zgodnie z CONTRIBUTING na warn trafiają parsowanie nagłówka czatu SillyTavern w `import.routes.ts` (tylko typ błędu, bo komunikat JSON może cytować czat) i transport pytań aktywacyjnych agentów (z ograniczeniem częstotliwości).

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. Start: żądania wewnętrzne czekają na rejestrację tras

Poprawka zawsze aktywna, nie ustawienie.

**Stan obecny.** `buildApp()` w `packages/server/src/app.ts` rejestruje podstawowe trasy, czeka na `capabilityModuleRuntime.start(app)`, aktywujące pakiety przez `activateOne()` w `services/capability-packages/capability-module-runtime.service.ts`, następnie uruchamia `startServerAutonomousScheduler(app)`. Wewnętrzne `app.inject()` pochodzą z pakietów przez `runCapabilityInternalRoute()` w `capability-route-registration.service.ts`, harmonogramu w `server-autonomous-scheduler.service.ts` i `routes/generate/prompt-preview.ts`. Pierwsze `inject()` uruchamia całą instancję Fastify; później nie można dodać tras, hooków ani pluginów. Wczesny timer/worker podczas `buildApp()` powodował "Root plugin has already booted" dla kolejnych pakietów, a następne `addHook` zatrzymywało serwer. `catch` w `activateOne()` loguje i wywołuje `capabilityPackageManager.rollbackRuntime()` albo zapisuje status/gotowość `"error"`. Zdrowy pakiet mógł więc pozostawać wycofany lub `"error"` przy kolejnych startach.

**Dodatki.**

- `lib/fastify-inject-gate.ts`: `buildApp()` wywołuje `holdInjectUntilRegistered(app)` zaraz po utworzeniu instancji i zwalnia przed `return app`. Wcześniejsze `app.inject()`, promise lub callback, czekają i docierają do później dodanych tras. Błąd rzucony przez zatrzymane `inject()` trafia do callbacka.
- `activate()`/`selfCheck()` są częścią rejestracji; czekanie na własną trasę blokowałoby bez końca. `activateOne()` uruchamia je w `failInjectFastDuring()`: bezpośrednie `inject()` natychmiast daje `InjectDuringRegistrationError` (`code`: `MARINARA_INJECT_DURING_REGISTRATION`). Nie aktywuje się tylko ten pakiet; start trwa dalej. Timery uruchomione po powrocie z `activate()` czekają jak inne wywołania w tle.
- Inne zatrzymane wywołania ostrzegają ze stosem wywołującego po 60 s i są odrzucane po 10 minutach z tym samym błędem. Zawieszony start zgłasza błąd zamiast milczeć. Timery bez referencji nie podtrzymują procesu.
- `isHostLifecycleActivationError()` w `capability-module-runtime.service.ts` rozpoznaje `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") i `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening"). Bez wycofania i trwałego statusu/gotowości `"error"`: wersja i status zostają, następny start aktywuje normalnie. Jeden warn i zapis diagnostyczny. Inne błędy nadal mają error, wycofanie i `"error"`.
- Regresja: `startup-inject-gate`.

**Bez zmian.** Po `buildApp()` wywołanie `app.inject()` to oryginalny Fastify bez wrappera. Forma łańcuchowa (`app.inject()` bez argumentów) nigdy nie czeka. Kolejność, trasy, `runCapabilityInternalRoute()`, harmonogram i późniejsze aktywacje/aktualizacje nie zmieniają się. Jeden przypadek na działającym serwerze: pakiet aktywowany z interfejsu dodający nową trasę nadal dostaje `FST_ERR_INSTANCE_ALREADY_LISTENING`, lecz wersja pozostaje zainstalowana do kolejnego startu, bez wycofania. Wywołujący nadal otrzymuje błąd.

**Jak sprawdzić.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

Sprawdza zwolnienie i późniejszą trasę, callbacki, natychmiastową awarię w `activate()`, timer z `activate()`, 10-minutowy limit z krótkimi wartościami, ustawienie/zwolnienie w `buildApp()` i powrót przed wycofaniem z jednym ostrzeżeniem dla błędu cyklu życia hosta.

**Jak wyłączyć / wycofać.** Bez przełącznika. `MARINARA_INJECT_DURING_REGISTRATION` to kod `InjectDuringRegistrationError`, nie ustawienie. Wycofaj commit blokady inject.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. Przełączniki: Settings > Advanced > Features

**Stan obecny.** Opcje serwera to zmienne (A3/A4), bez wspólnego miejsca w interfejsie; każda wymagałaby własnego ustawienia, trasy i UI.

**Dodatki.** Jeden rejestr i sekcja, później rozszerzane przez F/G/H. Szczegóły w `docs/configuration/features.md`.

- `packages/shared/src/schemas/feature-settings.schema.ts` definiuje nazwy i wartości domyślne; obiekt JSON w `features` przechowuje tylko odstępstwa.
- Dwa przełączniki: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a), **Retry failed provider calls** (`providerRetry`, A4d).
- `isFeatureEnabled()` w `services/features/feature-settings.ts` czyta kopię w pamięci, bez kosztu na częstych ścieżkach. Ładowana przy rejestracji tras ustawień, odświeżana po zapisie/usunięciu wiersza, odpowiednich poleceniach bazy Professor Mari i przeładowaniu `.env`. `GET` i `PUT /api/app-settings/features`; `PUT` waliduje ściśle.
- Ustawione zmienne wygrywają dla włączenia i wyłączenia. `LOREBOOK_STABLE_GROUP_WINNERS`/`PROVIDER_RETRY_TRANSIENT_ERRORS` teraz przypinają przełączniki zamiast osobnych odczytów.
- Klient pokazuje wszystko w Settings > Advanced > Features; przypięte opcje są zablokowane z nazwą zmiennej. Inne komponenty używają `useFeatureEnabled()`.

**Bez zmian.** Wszystkie domyślnie wyłączone; bez otwierania sekcji zachowanie identyczne. Istniejące zmienne zachowują działanie.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter feature-settings` obejmuje rejestr, domyślne wartości, normalizację, priorytet, trasy, zapis, unieważnianie typu Mari i nasłuchiwanie. W aplikacji Settings > Advanced > Features albo wyszukaj `features`.

**Jak wyłączyć / wycofać.** Pozostaw oba wyłączone lub usuń zmienne. Wycofanie commitu usuwa mechanizm; zmienne działają samodzielnie jak wcześniej.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. Logowane operacje best-effort

Dodatek bez przełącznika i samodzielnej zmiany zachowania.

**Stan obecny.** Niektóre błędy są celowo ignorowane pustym `catch`: sprzątanie, przesunięcie kursora, zapis cache. To poprawne, lecz bez śladu.

**Dodatki.** `packages/server/src/lib/best-effort.ts` z `logSuppressed`, `orFallback`, `bestEffort`. Pominięte błędy używają `logRateLimited` (A2), najwyżej jeden wpis/minutę dla zdarzenia, czatu i etapu. Poprawki D/E zastępują tym puste przechwycenia.

**Bez zmian.** Ten PR jeszcze ich nie wywołuje; istniejące ścieżki bez zmian.

**Jak sprawdzić.** `node scripts/run-regressions.mjs --filter best-effort`.

**Jak wyłączyć / wycofać.** Bez przełącznika; wycofanie commitu usuwa plik.

---

<a id="coming-in-later-pull-requests"></a>

# Kolejne pull requesty

Sekcje są celowo krótkie. Każdy PR uzupełni swoją o te same pięć części przy otwarciu.

Status: PR A został scalony jako #6647, a PR B jako #6648. PR C (#6649) zamknięto bez scalenia, a PR od D do H nie zostały otwarte jako osobne pull requesty. Poniższe sekcje od C do H opisują plan w takiej postaci, w jakiej go zapisano; nie traktuj ich jako funkcji wydanych w tej formie.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: Dev MCP dla asystentów programowania

Opcjonalny lokalny serwer w `tools/dev-mcp`, poza workspace pnpm i obrazem Docker. Używa śledzenia A2. Konfiguracja/kontrole w `tools/dev-mcp/README.md`, dodanym przez B.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: Paleta i nakładka skrótów

W C: paleta Ctrl+K i panel "?". Tylko klient, bez przełącznika ani zmian skrótów.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: Sprawdzone poprawki serwera, część 1

W D: trasy, middleware, odzyskiwanie, czat/generowanie, importery, sidecary i SSRF, każdy z regresją. Poprawki bez przełącznika.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: Sprawdzone poprawki serwera, część 2

W E: usługi i przechowywanie, każda poprawka z regresją, bez przełącznika.

<a id="pr-f-prompt-caching"></a>

## PR F: Cache promptów

W F: znacznik historii subskrypcji Claude, aktualizacja Claude Agent SDK, układ sprzyjający cache (przełącznik wyłączony), ostrzeżenie dla czatu przed wysłaniem z małym cache (wyłączone), opcjonalna diagnostyka.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: Zadania generowania i zasobnik konsoli

W G: obrazy, sprite'y i wideo po zamknięciu karty, z widokiem zadań (przełącznik wyłączony) i ikoną konsoli Windows (przełącznik wyłączony).

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Diagnostyka i launcher

W H: integralność przy starcie, telemetria pamięci, opcjonalne pliki debugowania, limit wywołań w tle (przełącznik wyłączony), zabezpieczenia launchera i ponowienie bez wyłączania rozumowania dla modeli zawsze rozumujących.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## Wyniki PR A na komputerze deweloperskim

Sprawdzono na `staging`, commit `dd876831a`. Bez płatnych wywołań modeli.

- **Regresje Node Linux**, jak CI `complete-node-regressions` (Ubuntu 24.04 w WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): 384 pliki zaliczone. Przy obciążeniu `server-signal-shutdown` czasem przekraczał 30 s, także na niezmienionym `staging`. `smart-group-decision`, `agent-activation-questions`, `advanced-memory-core` raz zawiodły przez zależności czasowe, potem zawsze przechodziły.
- **Regresje Node Windows**: 379 z 384. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`, `storage-writer-lock` zawodzą identycznie na niezmienionym `staging` tego komputera: lokalne blokady plików, sygnały konsoli i kontrola miejsca na dysku.
- **Typy, lint, format i kompilacje**: `tsc --noEmit` dla shared, server, client, projektu głównego i estymacji tokenów; lint bez błędów; Prettier na `packages/**/*.{ts,tsx}`; kontrole lokalizacji i statycznego JSX; kompilacje klienta/serwera.
- **Testy przeglądarki** ustawień (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) w `mobile-chromium`: 171 zaliczonych, 0 błędów. Pozostałe po ponowieniu błędy `mobile-webkit` (WebKit Windows) występują też na niezmienionym `staging`.
- **Sekcja Features** sprawdzona wzrokowo w motywach domyślnym i SillyTavern, jasnym/ciemnym, na komputerze i telefonie.
