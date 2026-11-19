# Logowanie serwera

Ta strona wyjaśnia odczytywanie logów serwera Marinara Engine i pisanie użytecznych wpisów. Uzupełnia [sekcję Logging w CONTRIBUTING.md](../../CONTRIBUTING.md#logging), nie zastępuje jej. Wspólny logger Pino, obiekt błędu jako pierwszy argument, specyfikatory formatu i tabela czterech poziomów nadal obowiązują.

<a id="what-every-line-carries"></a>

## Zawartość każdego wpisu

Wszystkie wpisy serwera pochodzą z jednej instancji Pino: `logger` w `packages/server/src/lib/logger.ts`. Fastify korzysta z niej przez `loggerInstance`, więc `req.log`, `reply.log` i `app.log` są jej potomkami. Używają tych samych serializerów i uwzględniają przeładowania `LOG_LEVEL` przez obserwatora środowiska.

| Pole | Gdzie | Znaczenie |
| --- | --- | --- |
| `pid` | każdy wpis | Identyfikator procesu (domyślny Pino). |
| `hostname` | każdy wpis | Nazwa hosta (domyślna Pino). |
| `bootId` | każdy wpis | 8 znaków szesnastkowych, nowych przy starcie procesu. Rozróżnia uruchomienia w jednym pliku. |
| `requestId` | każdy wpis wywołany żądaniem | Ta sama wartość co nagłówek odpowiedzi `x-request-id`. Jest we wpisach `req.log` i wspólnego `logger` w usługach. |
| `route` | wpisy po parsowaniu treści | Dopasowany wzorzec trasy, np. `/api/chats/:id`. Nigdy surowy URL. |

<a id="request-ids"></a>

### Identyfikatory żądań

`lib/request-logging.ts` nadaje każdemu żądaniu identyfikator:

- Klient może wysłać `x-request-id`. Serwer zachowuje 8–80 znaków ze zbioru `A-Z a-z 0-9 . _ : -`; resztę zastępuje.
- W przeciwnym razie tworzy UUID. Domyślny licznik Fastify `req-1` wracał do początku przy starcie, więc identyfikatory się powtarzały.
- Identyfikator wraca w nagłówku `x-request-id`, udostępnionym przez CORS. Można podać go w zgłoszeniu, a `grep <id>` znajdzie wszystkie wpisy żądania.

Identyfikator jest w kontekście `AsyncLocalStorage` (`lib/log-context.ts`). Mixin Pino kopiuje go do każdego wpisu. Nie trzeba go przekazywać: `logger.warn(err, "...")` wewnątrz usługi pobiera go sam. Kontekst jest ustawiany ponownie po parsowaniu treści, bo parser HTTP używa własnego kontekstu asynchronicznego.

Kontekst towarzyszy wszystkiemu uruchomionemu w żądaniu, w tym timerom, nasłuchom i procesom potomnym. Start pracy żyjącej dłużej niż żądanie opakuj w `runWithRootLogContext({}, fn)`, aby późniejsze wpisy nie zachowały początkowego ID. Lokalny proces pomocniczy robi tak dla llama-server i MLX, a pomocnicze procesy Decision i Utility podobnie uruchamiają swoje procesy. Start współdzielony przez późniejsze żądania nie nosi więc ID pierwszego klienta. Inne długotrwałe zadania uruchomione w procedurze trasy zachowują jej `requestId`, dopóki nie dostaną takiego opakowania.

<a id="request-lines"></a>

### Wpisy żądań

`RequestLogController` jest domyślnym `LogController` Fastify z następującymi zmianami:

- Pole nazywa się `requestId`, nie `reqId`. Zapisane wyszukiwania i filtry po `reqId` wymagają nowej nazwy.
- Wpisy `incoming request` i `Route ... not found` pomijają parametry zapytania, mogące zawierać token lub szukany tekst. Wpis przychodzący zachowuje inne pola `req` (`method`, `version`, `host`, `remoteAddress`, `remotePort`) i dodaje `route`.
- Gdy klient zamknie żądanie przedwcześnie, powstaje jeden wpis `Client aborted request` na poziomie info. Fastify wcześniej nic tu nie zapisywał.

`LOG_DISABLE_REQUEST_LOGGING` działa jak wcześniej i wyłącza też wpis o przerwaniu.

W `pnpm dev` pino-pretty ukrywa `hostname` (domyślnie) i `bootId`. Produkcyjny JSON zachowuje oba.

<a id="startup-timeline"></a>

## Oś czasu startu

`lib/startup-timeline.ts` mierzy każdy etap:

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Każdy wpis ma `event: "startup.phase"`, `stage`, `elapsedMs` (czas rzeczywisty) i `selfMs` (czas własny bez faz zagnieżdżonych). Poziom zależy od `selfMs`: debug poniżej 1 s, info powyżej 1 s, warn powyżej 15 s. Przy domyślnym `LOG_LEVEL=warn` normalny start, nawet wolne pierwsze uruchomienie, nie drukuje faz.
- Fazy się zagnieżdżają. `app.build` w `index.ts` obejmuje fazy w `buildApp`. Dzięki `selfMs` wolny etap wewnętrzny zgłasza się raz, sam; `app.build` pozostaje na debug, chyba że jego własna praca poza fazami jest wolna.
- Nieudany etap nie loguje wewnątrz fazy. Błąd przechodzi niezmieniony wyżej, a `main().catch` w `index.ts` zapisuje jeden `startup.failed` z nazwą etapu (`startup.stageOf(err)`).
- Po rozpoczęciu nasłuchu `index.ts` zapisuje jeden wpis info `[startup] Ready in N ms`, z `event: "startup.ready"`, liczbą faz i pięcioma największymi `selfMs`.

Fazy nie dodają `stage` do kontekstu logu. Uruchomione w nich usługi zachowują timery, które inaczej nosiłyby etap przez cały czas życia procesu.

<a id="one-line-per-failure"></a>

## Jeden wpis na błąd

Błąd powinien dać dokładnie jeden wpis, zapisany przez kod decydujący, co dalej.

- **Zaloguj albo rzuć dalej, nie oba.** Jeśli rzucasz dalej, loguje wywołujący. Przydatne szczegóły trafiają do debug, np. nazwa narzędzia w `[agent-tools] ... failed`.
- **Gdzie powstaje wpis:**
  - nieznane 500: `middleware/error-handler.ts`
  - błędy agentów: `executeAgent` (warn, błąd niekrytyczny)
  - nieudane generowanie czatu: główny catch w `generate.routes.ts`
  - Odpowiedni kod dostawcy rzuca, ale nie loguje. Najwyżej dodaje debug z nazwą modelu i surowym błędem, jak Grok CLI i Claude (Subscription). Claude (Subscription) rzuca przyjazny komunikat zawierający już błąd SDK, więc nie dołącza go drugi raz jako `cause`. Błąd SSE czatu i tekst błędu agenta dopisują komunikat przyczyny, co powieliłoby tekst.
- **Anulowanie to info.** Zatrzymanie przez użytkownika, zamknięcie karty lub anulowany sygnał są oczekiwane. Użyj `failureLevel(err)` lub `failureLevel(err, "warn")` z `lib/log-context.ts`. Zwraca `"info"`, gdy `isCancellation(err)` jest true. `TimeoutError` to rzeczywisty błąd, nie anulowanie.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Zachowaj przyczynę.** Opakuj przez `new Error("Could not save chat", { cause: err })`. Serializery `err` i `error` dodają komunikat i stos przyczyny (`caused by: ...`). Error zalogowany jako `{ error }` też jest serializowany i nie pojawia się już jako `{}`.

<a id="repeating-failures"></a>

## Powtarzające się błędy

Odpytywanie, kontrole zdrowia i hooki tur mogą zawodzić tak samo co kilka sekund. Użyj `logRateLimited` z `lib/log-rate-limit.ts`:

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

Pierwsze wystąpienie klucza jest zapisywane. Następne w oknie (domyślnie 60 s) są zliczane, a kolejny wpis ma `suppressedRepeats`. W kluczu umieść zawodzący element, np. ID pakietu lub czatu, aby jeden błąd nie ukrywał drugiego.

<a id="prompt-and-model-text"></a>

## Tekst promptu i modelu

Prompty, wynik modelu, treści odpowiedzi dostawcy i odpytywania trafiają do **debug**, nigdy warn lub error. Mogą zawierać historię użytkownika, a odpowiedzi dostawcy także dane dostępu lub prompt. W warn zapisuj rozmiar (`rawLength`, `bodyLength`) i powód. Komunikat błędu parsowania JSON może cytować wadliwy tekst, więc na warn zapisuj tylko typ błędu. Błąd i tekst umieść w osobnym debug:

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

Przełącznik debugowania interfejsu nadal działa przez `logDebugOverride`. To przewidziany sposób oglądania promptów, gdy `LOG_LEVEL` ukrywa debug.

Media osadzone w tekście trafiają do logu w skróconej postaci. `debugJson` zastępuje każde dane base64 znacznikiem takim jak `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`. Zawiera on ich typ, rozmiar oraz pierwsze i ostatnie 16 znaków. Dotyczy to adresów `data:` (samodzielnych ciągów znaków lub fragmentów tekstu) oraz pól `data` bez prefiksu w częściach multimedialnych Anthropic i Google, również gdy base64 rozbito na kilka wierszy. Serializer `msg` robi to samo z adresami `data:` w zwykłych wpisach `%s` i `%j`. Pola `data` bez prefiksu skraca tylko `debugJson`. Zmienia się wyłącznie wypisana kopia, a przekazana wartość pozostaje bez zmian. Opcja `LOG_INLINE_MEDIA=full` w pliku `.env` przywraca wypisywanie pełnych danych. Obejmuje to test regresji `log-inline-media`.

<a id="checks"></a>

## Konsola w aplikacji

Wybierz **Settings → Advanced → Open Console** (ustawienia → zaawansowane → otwórz konsolę), żeby zobaczyć w aplikacji ostatnie wpisy serwera, gdy nie masz dostępu do terminala (NAS, VPS, Docker, Termux).

- `lib/log-buffer.ts` przechowuje w pamięci do 1500 ostatnich wpisów i najwyżej około 4 mln znaków. Każda wiadomość i każdy blok pól są przycinane do 16 tys. znaków. Bufor nie zapisuje nic na dysku, a ponowne uruchomienie go opróżnia.
- `logger.ts` kopiuje każdy zserializowany wpis za pomocą `hooks.streamWrite` biblioteki Pino. Bufor zawiera to, co trafiło do terminala lub pliku dziennika przy tym samym `LOG_LEVEL`. Wpisy z pominięciem Pino, na przykład komunikat `injected env` z dotenv lub surowe wyjście procesu potomnego, nie trafiają do bufora.
- `GET /api/admin/logs?afterId=` zwraca wpisy po `afterId`, a także `latestId`, `truncated` (wpisy zostały usunięte przed tym odczytem) oraz `logLevel` serwera. Trasa wymaga `requirePrivilegedAccess` i ma `no-store`. Używa `logLevel: "silent"`, więc żądania odświeżania samej konsoli nie pojawiają się w dzienniku.
- Te same zasady logowania obowiązują w konsoli. Zdalny administrator widzi w aplikacji wszystkie wpisy z poziomów warn i error, więc prompty i treści zapytań do dostawców i ich odpowiedzi zapisuj na poziomie debug.

## Kontrole

Regresje `logging-request-trail`, `logging-failure-lines` i `logging-startup-timeline` obejmują tę stronę, a `server-console-logs` sprawdza konsolę w aplikacji:

```sh
node scripts/run-regressions.mjs --filter logging-
```
