# Konfiguracja serwera

Ten przewodnik wymienia ustawienia serwera, które można zmienić za pomocą zmiennych środowiskowych, czyli ustawień odczytywanych przez serwer ze zwykłego pliku tekstowego o nazwie `.env`. Marinara działa bez żadnej konfiguracji. Większość osób potrzebuje jej tylko po to, żeby udostępnić serwer innym urządzeniom, chronić wspólny serwer, przenieść folder danych, zwiększyć szczegółowość logów albo dać powolnym zadaniom więcej czasu.

Konta AI, postacie i opcje czatu ustawia się w aplikacji. Jak dodać konto AI, opisuje przewodnik [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

<a id="edit-the-env-file"></a>

## Edycja pliku .env

Marinara tworzy pusty plik `.env` przy pierwszym uruchomieniu. Każda linia ma postać `KEY=value`. Linie zaczynające się od `#` to komentarze.

| Instalacja | Gdzie leży `.env` |
| --- | --- |
| Zwykła instalacja | Główny folder projektu |
| Oficjalny obraz Docker lub Podman | `/app/data/.env`, w tym samym wolumenie co dane |

1. Otwórz plik `.env.example` w tym samym folderze. Wymienia on wszystkie ustawienia razem z wartościami domyślnymi.
2. Skopiuj potrzebną linię do `.env`.
3. Zmień wartość po znaku `=` i zapisz plik.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Plik `.env` to dane, a nie skrypt powłoki. Marinara nie wykonuje `$`, `$(...)` ani innej składni powłoki w wartości. Wartość ustawiona już w środowisku programu uruchamiającego ma pierwszeństwo przed tym samym wpisem w `.env`.

Serwer odczytuje `.env` niezależnie od sposobu uruchomienia. Programy uruchamiające (`start.bat`, `start.sh`, `start-termux.sh`) dodatkowo ustawiają `HOST=0.0.0.0`, żeby inne urządzenia mogły się połączyć, i otwierają przeglądarkę, gdy serwer jest gotowy. `AUTO_OPEN_BROWSER=false` to wyłącza. Przy samym `pnpm start` serwer nasłuchuje tylko na tym komputerze, chyba że ustawisz `HOST`.

<a id="restart-or-hot-reload"></a>

## Ponowne uruchomienie albo przeładowanie w locie

Marinara obserwuje plik `.env` w trakcie pracy. Większość ustawień zaczyna działać niemal od razu, bez restartu. Przy każdej zmianie w logu pojawia się linia `[env-watcher]`. Jeśli obserwacji nie da się uruchomić, serwer sprawdza plik co 30 sekund i informuje o tym w logu.

Jeśli twoje zmiany nie są wykrywane, na przykład przy edycji z innego komputera albo w katalogu zamontowanym do kontenera (bind mount), ustaw `MARINARA_ENV_WATCH=poll`. Żeby wyłączyć obserwację, ustaw `MARINARA_ENV_WATCH=0`. Obie opcje są zaawansowane.

Te ustawienia są odczytywane tylko przy starcie. Zmiana któregokolwiek z nich wymaga restartu, a log cię o tym ostrzega:

- `PORT`, `HOST`, `SSL_CERT` i `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY` i `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH` i `TZ`
- `AUTO_OPEN_BROWSER` i `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING` i `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` i `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- Limity czasu i ustawienia odpytywania dla obrazów, wideo, sprite'ów i ComfyUI: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` oraz cztery ustawienia `*_VIDEO_POLL_INTERVAL_MS`

Programy uruchamiające odczytują `AUTO_UPDATE_ENABLED` przed startem serwera, więc zmiana działa od następnego uruchomienia, a log o niej nie ostrzega.

Ustawienia kontroli dostępu i sekrety (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) nie wymagają restartu.

<a id="access-control"></a>

## Kontrola dostępu

Kontrola dostępu decyduje o tym, kto może dotrzeć do działającego serwera. Instrukcje krok po kroku i przykłady zawiera przewodnik [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](REMOTE_ACCESS.md).

Logowanie można też ustawić bez `.env`: w sekcji **Settings → Advanced → Access** (ustawienia, zaawansowane, dostęp) w przeglądarce, która jest już zalogowana, albo za pomocą jednorazowego kodu konfiguracji z logu serwera. Serwer wypisuje ten kod tylko wtedy, gdy logowanie nie jest ustawione, a serwer nasłuchuje poza pętlą zwrotną. Logowanie jest zapisywane w `DATA_DIR/.remote-login.json`. Polecenie `node scripts/reset-login.mjs` (uruchomione w folderze aplikacji Marinara) usuwa je i wylogowuje każdą przeglądarkę. Logowanie ustawione w `.env` ma pierwszeństwo. Zmiana lub usunięcie logowania wymaga podania obecnego hasła. Proxy logowania opisuje sekcja [Proxy logowania (forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Pojęcia używane poniżej:

- **Pętla zwrotna** (loopback): komputer, na którym działa serwer, pod adresem `127.0.0.1` albo `localhost`.
- **Zakres CIDR**: skrótowy zapis bloku adresów IP, na przykład `192.168.1.0/24`.
- **Basic Auth**: nazwa użytkownika i hasło wysyłane z każdym żądaniem. Korzystają z niego skrypty i klienci API, a przeglądarki używają strony `/login`. Dane są tylko zakodowane, a nie zaszyfrowane, więc na serwerze publicznym używaj HTTPS.

Gdy logowanie nie jest ustawione, serwer przyjmuje połączenia tylko ze źródeł zaufanych: z pętli zwrotnej, z adresów z `IP_ALLOWLIST`, z sieci Tailscale oraz ruch mostka Docker z tego samego komputera. Wszyscy inni, łącznie z twoją siecią domową, dostają `403 Forbidden`. Żeby inne urządzenia w ogóle mogły się połączyć, serwer musi nasłuchiwać na osiągalnym adresie: ustaw `HOST=0.0.0.0`.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `BASIC_AUTH_USER` | pusta | Nazwa użytkownika do logowania. Ustaw razem z `BASIC_AUTH_PASS`. |
| `BASIC_AUTH_PASS` | pusta | Hasło do logowania. Zostaw jedno z pól puste, żeby wyłączyć logowanie. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Nazwa realm w zapytaniu Basic Auth. |
| `IP_ALLOWLIST` | pusta | Rozdzielone przecinkami adresy IP lub zakresy CIDR, które są zawsze dozwolone. Bezpośrednia pętla zwrotna jest dozwolona zawsze. Odwrotne proxy na tym samym komputerze – nie. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` zachowuje listę, ale wstrzymuje jej egzekwowanie. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Dopuszcza dostęp bez hasła z sieci prywatnych, gdy logowanie nie jest ustawione. Nie obejmuje zakresu `100.64.0.0/10`, który dostawcy internetu dzielą między klientów. Dodaj go do `TRUSTED_PRIVATE_NETWORKS` tylko wtedy, gdy mu ufasz. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Dopuszcza dostęp bez hasła z dowolnego adresu, także z internetu. Niezalecane. |
| `TRUSTED_PRIVATE_NETWORKS` | wbudowane zakresy | Zastępuje domyślne zakresy sieci prywatnych. Wpisz też te domyślne, które mają zostać. |
| `BYPASS_AUTH_TAILSCALE` | automatycznie | Puste: urządzenie pomija logowanie tylko wtedy, gdy łączy się bezpośrednio z adresem Tailscale tego komputera. Tailscale Serve, Funnel albo inne proxy nadal wymagają logowania. `true`: dawne pominięcie całego zakresu `100.64.0.0/10`. `false`: zwykła kontrola dostępu. |
| `BYPASS_AUTH_DOCKER` | automatycznie | Puste: ufa tylko wykrytemu interfejsowi kontenera i jego bramie, i to tylko dopóki nie ustawiono logowania, `IP_ALLOWLIST` ani `TRUSTED_AUTH_PROXY`. `true`: starsze lub niestandardowe sieci. `false`: zwykła kontrola dostępu. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Wymaga logowania lub listy dozwolonych adresów dla ruchu Docker, który przekazuje proxy. Ustaw `false` tylko wtedy, gdy samo proxy wymaga logowania od każdego gościa. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Traktuje żądania przekazywane przez proxy lub tunel na tym samym komputerze jako zdalne, także żądania HTTP/1.0, takie jak domyślne `proxy_pass` w nginx. Ustaw `false` tylko wtedy, gdy samo proxy wymaga logowania od każdego gościa. |
| `TRUSTED_AUTH_PROXY` | pusta | Adresy IP lub CIDR proxy forward-auth (tinyauth, Authelia, Authentik, oauth2-proxy), które wymaga logowania od każdego gościa. Jego żądania pomijają logowanie i `IP_ALLOWLIST`. Proxy musi chronić każdą ścieżkę, a aplikacja Marinara Engine nie może być osiągalna z pominięciem proxy. |
| `TRUSTED_HOSTS` | pusta | Dodatkowe nazwy publiczne lub nazwy proxy, na które Marinara odpowiada, na przykład `chat.example.com`. Bezpośrednie adresy IP, `localhost`, `.local`, `.home.arpa` oraz jednoczłonowe nazwy w sieci lokalnej działają bez tego ustawienia. Nazwy z `CSRF_TRUSTED_ORIGINS` lub `CORS_ORIGINS` też są przyjmowane. |
| `SSL_CERT` | pusta | Ścieżka do certyfikatu TLS. Ustaw razem z `SSL_KEY`, żeby serwer sam obsługiwał HTTPS. |
| `SSL_KEY` | pusta | Ścieżka do klucza prywatnego TLS. |
| `CSRF_TRUSTED_ORIGINS` | pusta | Dodatkowe źródła przeglądarki, z których wolno zapisywać zmiany, dla publicznej domeny albo nietypowego portu. Dosłowna wartość `null` jest ignorowana, także w przypadku pliku APK dla systemu Android. |

> **Ostrzeżenie:** Szeroki publiczny zakres w `IP_ALLOWLIST`, na przykład `0.0.0.0/0`, może wpuścić klientów z internetu bez logowania. Wpisuj tylko adresy, którym ufasz.

## Przechowywanie danych

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Główny folder wszystkich danych użytkownika. Obrazy Docker ustawiają `/app/data`. |
| `FILE_STORAGE_DIR` | folder `storage` wewnątrz `DATA_DIR` | Zmienia folder przechowywania plików. |
| `ENCRYPTION_KEY` | pusta | Klucz, który szyfruje zapisane klucze API. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (bez limitu); `8` w systemie SteamOS i w środowisku Termux | Największa liczba czatów trzymanych naraz w pamięci. Powyżej limitu po każdym zapisie z pamięci (nigdy z dysku) usuwany jest najdawniej używany czat bez niezapisanych zmian. Nieprawidłowy tekst powoduje powrót do wartości domyślnej platformy. Wartości dodatnie poniżej `2` są podnoszone do `2`. `0` wyłącza usuwanie z pamięci. |
| `MARINARA_EAGER_STORAGE` | wyłączone | `1` wczytuje przy starcie wszystkie czaty, jak przed wersją 2.4.5. Przy dużych profilach zużywa znacznie więcej pamięci. Wymaga restartu. |

Wygeneruj klucz szyfrujący i wklej go do `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Marinara trzyma dane w zwykłych plikach JSON, więc kopie zapasowe można kopiować i czytać. Co zawiera każdy folder, wyjaśnia przewodnik [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md).

<a id="logging-levels"></a>

## Poziomy logowania

`LOG_LEVEL` ustala, ile szczegółów wypisuje serwer. Ukrywa wszystko poniżej wybranego poziomu.

| Poziom | Co pokazuje |
| --- | --- |
| `error` | Tylko poważne awarie. |
| `warn` | Błędy i ostrzeżenia. To wartość domyślna. |
| `info` | Dodaje logi startu i poszczególnych żądań. |
| `debug` | Wszystko, łącznie z pełnymi promptami i odpowiedziami modelu. Wypisuje bardzo dużo tekstu. |

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | Poziom opisany wyżej. |
| `LOG_PRESET` | `default` | `prompt-connections` pokazuje te same szczegóły promptu i modelu co `debug`, ale ukrywa rutynowe linie żądań w rodzaju `GET /api/chats`. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` ukrywa rutynowe linie żądań i zachowuje wybrany poziom. Wymaga restartu. |
| `LOG_FORMAT` | automatycznie | `pretty` wszędzie wypisuje czytelne linie, na przykład żeby czytać w `docker logs` prompty zapisywane przez **Debug mode** (tryb diagnostyczny). `json` wypisuje jeden obiekt JSON na linię. Wymaga restartu. |

W terminalu serwer wypisuje czytelne linie. W innych miejscach, na przykład w logach kontenera Docker, serwer produkcyjny wypisuje linie JSON. Program uruchamiający dla środowiska Termux żąda czytelnych linii. Logowanie po stronie przeglądarki jest osobne i `LOG_LEVEL` nim nie steruje.

## Limity czasu

Limit czasu to najdłuższy czas, przez jaki serwer czeka na powolne zadanie. Otwórz **Settings → Advanced → Request timeouts** (ustawienia, zaawansowane, limity czasu żądań), żeby zmienić w sekundach limity dla tekstu, agentów, promptów obrazów w trybie Game, obrazów, wideo, ComfyUI i embeddingów. Wyższe limity pomagają wolnym lokalnym backendom. Nie mogą obejść limitu ustawionego przez usługę. Zapis wymaga uprawnień administratora serwera.

Te ustawienia obejmują wszystkie profile i są zapisywane obok aktywnego pliku `.env` jako `.env.timeouts.json` (lub `<custom-env-path>.timeouts.json`). Mają pierwszeństwo przed odpowiednimi zmiennymi bez edytowania `.env`. Zmiany dla tekstu, agentów, promptów obrazów w trybie Game i embeddingów obowiązują od nowych żądań. Zmiany dotyczące multimediów i zainstalowanych pakietów agentów wymagają restartu. Żeby wrócić do zmiennych, usuń ten plik i uruchom serwer ponownie.

Wartości podaje się w milisekundach, chyba że nazwa mówi inaczej. Wartości nieprawidłowe, zerowe, ujemne albo spoza zakresu w sprawdzanych limitach czatu, agentów i promptów obrazów w trybie Game powodują ostrzeżenie w logu i użycie wartości domyślnej. Więcej o zadaniach wideo znajdziesz w przewodniku [Generowanie wideo sceny](media/scene-video.md).

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 min) | Limit czasu do pierwszego tokenu i przerwy między fragmentami dla odpowiedzi w trybach Conversation, Roleplay i Game. Także budżet czasu dla zadań w tle bez własnego limitu (Professor Mari, odświeżanie zakładki Noodle, odpowiedzi w zakładce Slurp). Zakres `10000`-`3600000`. Nie zmienia limitów dla agentów, multimediów, embeddingów ani narzędzi. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 min) | Najdłuższa cisza przed jednym wywołaniem modelu przez agenta lub w jego trakcie, również dla agentów do pobrania. Napływające dane odnawiają ten limit. Zakres `10000`-`3600000`. Agent Illustrator zachowuje co najmniej swój wbudowany 30-minutowy limit bezczynności. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 s) | Górna granica łącznego czasu wywołania modelu, które zamienia scenę w trybie Game na prompt obrazu. Zakres `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 min) | Czas na jedno żądanie embeddingu. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 min) | Czas na jedno żądanie generowania obrazu. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 MiB) | Największa przyjmowana odpowiedź z obrazem. Zwiększ tę wartość, gdy lokalny ComfyUI osadza duże metadane. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 min) | Czas na jedno żądanie wideo sceny, łącznie z procesami wideo w ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Największe przyjmowane pobranie wideo sceny. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 min, w sekundach) | Czas na jeden proces generowania obrazu w ComfyUI po jego zakolejkowaniu. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Czas na jedno zadanie generowania sprite'a przez AI. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 min) | Czas na jedno wywołanie własnego narzędzia. |
| `MAX_TOOL_ROUNDS` | `100` | Największa liczba rund wywołań narzędzi, po której model musi odpowiedzieć. Tura w trybie Game dostaje najwyżej 4, agent 16, a uzupełnianie lorebooka 64, albo tę wartość, jeśli jest niższa. |

## Uprzywilejowane API (ADMIN_SECRET)

Działania niszczące albo ryzykowne, takie jak kopie zapasowe, czyszczenie danych, wgrywanie aktualizacji i instalowanie motywów, poza zwykłymi sprawdzeniami dostępu wymagają dodatkowego sekretu. Możesz go utworzyć w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny) na komputerze, na którym działa serwer (zobacz [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)), albo ustawić na serwerze długą, losową wartość:

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Na komputerze, na którym działa serwer, te działania zwykle udają się bez sekretu. Żądanie przekazane przez proxy lub tunel na tym komputerze liczy się jako zdalne, chyba że ustawiono `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Bezpośrednie żądania z innego urządzenia wymagają sekretu. Wklej tę samą wartość w **Settings → Advanced → Admin Access**, a aplikacja będzie ją wysyłać za ciebie. `ADMIN_SECRET` w pliku `.env` ma pierwszeństwo przed sekretem utworzonym w aplikacji. Bez sekretu administratora działania uprzywilejowane kończą się błędem na każdym urządzeniu poza komputerem z serwerem, a komunikat błędu podpowiada, żeby go ustawić. Zainstalowani agenci działają na każdym urządzeniu zalogowanym danymi logowania; ich instalowanie, aktualizowanie i usuwanie wymaga sekretu.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `ADMIN_SECRET` | pusta | Sekret dla działań uprzywilejowanych ze zdalnych urządzeń. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` wymaga sekretu także na komputerze z serwerem. |
| `UPDATES_APPLY_ENABLED` | `false` | Pozwala wgrywać z przeglądarki aktualizacje z tego samego kanału (**Apply Update**, wgranie aktualizacji). Zmiana kanału wydań z przeglądarki na komputerze z serwerem działa bez tej flagi. Tylko instalacje oparte na Git. |
| `UPDATES_APPLY_DISABLED` | nieustawiona | Odmawia każdego wgrania aktualizacji po stronie serwera, łącznie ze zmianą kanału. Ma pierwszeństwo przed `UPDATES_APPLY_ENABLED`. Ustawiają ją programy uruchamiające dla trybu deweloperskiego i testów e2e. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Pozwala zdalnemu urządzeniu wgrywać aktualizacje, gdy poda prawidłowy sekret. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Pozwala zdalnemu urządzeniu uruchamiać działania haptyczne, gdy poda prawidłowy sekret. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Włącza własne narzędzia skryptowe. Przy narzędziach niesprawdzonych lub zaimportowanych zostaw wyłączone. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Pozwala uruchamiać skrypty przekształcające bazę danych asystentki Professor Mari na komputerach bez piaskownicy systemu operacyjnego (macOS Seatbelt lub Linux Bubblewrap, używanych, gdy są dostępne). Zostaw wyłączone, chyba że skrypt został przez ciebie przejrzany. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Włącza ręczny podgląd i synchronizację repozytoriów agentów z serwisu GitHub w sekcji Agent Organizer. Zobacz [Własne repozytoria agentów](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Pozwala graczom tworzyć gry Overworld (zestaw settingu i wygenerowany świat) oraz zamieniać w nie starsze gry. Gdy jest wyłączone, kreator oferuje tylko gry Classic. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Pierwsza z dwóch bram dla importu rozszerzeń od osób trzecich. Zobacz [Rozszerzenia zewnętrzne](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | pusta | Foldery, które import zbiorczy może czytać bez tokena z okna wyboru plików. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Największy pojedynczy eksport profilu w formacie JSON, jaki zbuduje serwer. |

## Zgody na adresy lokalne

Domyślnie żądania wychodzące do usług AI, usług obrazów i webhooków odrzucają adresy prywatne i lokalne. Blokuje to SSRF (server-side request forgery), czyli atak, w którym żądanie zostaje podstępem skierowane na adres wewnętrzny. Serwery modeli na pętli zwrotnej nadal działają. Włącz tylko ten przełącznik, którego potrzebujesz dla samodzielnie hostowanej usługi na innym komputerze w sieci prywatnej.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Adresy URL usług AI mogą sięgać adresów prywatnych i sieci lokalnej. W systemie Android domyślnie włączone. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Adresy URL usług obrazów mogą sięgać adresów prywatnych i sieci lokalnej. Prywatne adresy URL z wynikami i tak muszą zgadzać się dokładnie ze źródłem usługi. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Adresy URL syntezy mowy mogą sięgać adresów prywatnych i sieci lokalnej. |
| `STT_LOCAL_URLS_ENABLED` | `false` | Adres URL serwera Speech to text (zamiana mowy na tekst) może sięgać adresów prywatnych i sieci lokalnej. Serwer na tym samym komputerze działa bez tego ustawienia. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Adresy URL tłumaczenia DeepLX mogą sięgać adresów prywatnych i sieci lokalnej. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Webhooki własnych narzędzi mogą sięgać adresów prywatnych i sieci lokalnej. |

Jak podłączyć model lokalny albo samodzielnie hostowany, opisuje przewodnik [Podłączanie modelu lokalnego lub samodzielnie hostowanego](connections/local-self-hosted.md).

<a id="feature-switches"></a>

## Przełączniki funkcji

Opcjonalne zachowania serwera, na przykład ponawianie nieudanych wywołań dostawcy albo utrzymywanie stałych wyborów grup lorebooka, znajdują się w **Settings → Advanced → Features** (ustawienia, zaawansowane, funkcje). Wszystkie są domyślnie wyłączone. Kilka z nich ma zmienną, która po ustawieniu wygrywa z przełącznikiem. Zobacz [Przełączniki funkcji](configuration/features.md).

<a id="marinara-notices"></a>

## Powiadomienia Marinara

Powiadomienia to krótkie ostrzeżenia od opiekunów projektu, na przykład o problemie z bezpieczeństwem albo o ręcznym kroku, którego wymaga twoja wersja. Wyświetlają się jako baner.

- Przy starcie, a potem co godzinę, serwer pobiera jeden mały plik, `notices.json`, z gałęzi `notices` repozytorium Marinara Engine. Zachowuje tylko powiadomienia, które wymieniają twoją wersję. Twoja przeglądarka pyta o nie twój własny serwer raz przy ładowaniu strony, a potem co godzinę.
- Jeśli pobieranie się nie uda, serwer zachowuje powiadomienia, które już ma, a start się nie opóźnia.
- Żądanie nie wysyła żadnych danych o tobie, twoich czatach ani ustawieniach. Gałąź `notices` mogą zmieniać tylko opiekunowie, a każda zmiana przechodzi przegląd.
- Powiadomienie to zwykły tekst z limitem rozmiaru. Linki zostają tylko wtedy, gdy prowadzą do `https://github.com/Pasta-Devs/`. Powiadomienie nie może niczego zainstalować, uruchomić ani zmienić.
- Powiadomienia widzisz tylko ty: na komputerze z serwerem, z adresu z `IP_ALLOWLIST` albo po zalogowaniu się. Inni odwiedzający dostają pustą listę.

Żeby wyłączyć powiadomienia, ustaw `MARINARA_NOTICES_ENABLED=false`.

> **Ostrzeżenie:** Przy wyłączonych powiadomieniach Marinara nie może poinformować cię o poprawkach bezpieczeństwa ani o wymaganych krokach. Samodzielnie śledź [wydania w serwisie GitHub](https://github.com/Pasta-Devs/Marinara-Engine/releases).

Forki mogą skierować `MARINARA_NOTICES_URL` na własny plik.

<a id="optional-multiplayer"></a>

## Opcjonalna gra wieloosobowa

Gra wieloosobowa jest domyślnie wyłączona. Pozwala wspólnie korzystać z prywatnego pokoju w trybie Conversation, Roleplay albo Game bez stałego limitu uczestników. Każdy gość używa własnej, zaufanej instalacji Marinara. Goście nie potrzebują konta AI. Konta AI zapewnia gospodarz, który może czytać i zachowywać udostępniane treści. Dopóki którakolwiek z bram jest wyłączona, Marinara nie wykonuje w tle żadnych kontroli sesji, certyfikatów ani innych uczestników.

1. Ustaw `MULTIPLAYER_ENABLED=true` w pliku `.env` każdej uczestniczącej instalacji Marinara i uruchom ją ponownie. Działa tylko dokładna wartość `true`, a przeładowanie w locie jej nie stosuje.
2. Otwórz **Settings → Advanced → Multiplayer** (ustawienia, zaawansowane, gra wieloosobowa), przeczytaj ostrzeżenie i włącz to ustawienie. Nie uruchamia to nasłuchu ani nie dołącza do pokoju.
3. Żeby hostować, użyj **Create shared session** (utwórz wspólną sesję) albo **Play together** (graj razem) przy wyborze trybu lub konfiguracji. Sprawdź konfigurację, swoją nazwę wyświetlaną i udostępniany tekst persony. Istniejący czat udostępnia tylko swoje wybory konfiguracji, nigdy zapis rozmowy, notatki ani wspomnienia.
4. U gospodarza ustaw `SSL_CERT` i `SSL_KEY` dla certyfikatu ważnego dla nazwy hosta pokoju i zaufanego przez gości. Wybierz osobny adres HTTPS pokoju i port, na przykład `https://room.example.org:7861`. Ten port otwiera działanie Host. Przez zaporę lub router przekieruj tylko port pokoju. Nie wystawiaj zwykłego API aplikacji Marinara Engine. Przekierowanie portów, przekaźnik ani obejście certyfikatu nie są ustawiane za ciebie.
5. Ustaw hasło pokoju mające co najmniej 12 znaków, inne niż twoje dane logowania administratora. Wygasające zaproszenie i hasło wyślij osobno osobom, którym ufasz. Gość sprawdza odcisk przypisany do nazwy hosta, nazwę pokoju i tekst persony, a potem prosi o wejście. Gospodarz zatwierdza każdą prośbę w **Players** (gracze), zanim zostanie wysłana jakakolwiek historia.

Ograniczenia i działanie:

- Zanim hasło zostanie wysłane, TLS sprawdza łańcuch certyfikatu i nazwę hosta, a także odcisk certyfikatu z zaproszenia. Certyfikaty samopodpisane nie są przyjmowane po cichu. Odnowiony certyfikat wymaga nowego zaproszenia.
- Zaproszenia wygasają po 30 minutach. Zatwierdzone sesje trwają najwyżej 12 godzin. Zastąpienie lub cofnięcie zaproszenia unieważnia niewykorzystane zaproszenia. **Kick** (wyrzuć) usuwa przyjętego gościa.
- Gospodarz steruje odpowiedziami automatycznymi lub ręcznymi oraz kontrolkami **Pause** (wstrzymaj)/**Resume** (wznów) i **Stop** (zatrzymaj). Domyślny limit to 100 skoordynowanych tur generowania na sesję hostowania. Tura grupowa albo konfiguracja gry w trybie Game może wykonać więcej niż jedno wywołanie modelu. To limit tur, a nie szacunek kosztów.
- W trybie Game sprawdź drużynę przed **Start Game** (rozpoczęcie gry). Każdy wymagany gracz przesyła akcję albo pasuje, a GM rozstrzyga, gdy wszyscy są gotowi. Rozłączony gracz pozostaje wymagany, dopóki nie wróci albo gospodarz nie spasuje za niego lub go nie usunie. Wstrzymane lub przerwane rundy nigdy same nie powtarzają płatnego żądania ani zatwierdzonych skutków w świecie.
- **Stop**, **Leave** (wyjście), wyłączenie ustawienia i restart serwera kończą aktywną sesję. Restart nigdy sam nie hostuje ani nie dołącza.
- Własne narzędzia, narzędzia z pakietów i niebezpieczne polecenia pozostają w pokojach niedostępne. Goście nigdy nie uruchamiają harmonogramu ani lokalnych poleceń z otrzymanego tekstu. Harmonogramy w trybie Conversation korzystają z harmonogramu gospodarza.
- Nowi gracze i zmiany person obowiązują od następnej rundy.
- Pokoje przenoszą wyłącznie tekst o ograniczonym rozmiarze. Nie ma przesyłania plików, multimediów, rozszerzeń ani pakietów. Natywna aplikacja opakowująca na system Android nie może dołączać.

> **Ostrzeżenie:** Łącz się tylko z osobami, którym ufasz, i używaj własnego klienta Marinara. Nigdy nie instaluj klienta, rozszerzenia ani pliku dostarczonego przez gospodarza. Gospodarz może czytać to, co udostępniasz, a udostępniane treści mogą trafić do jego usług AI. Połączenia bezpośrednie ujawniają adresy sieciowe. Nie udostępniaj haseł, kluczy API ani danych osobowych. Jeśli coś wydaje się nie tak, od razu opuść pokój.

Dokładne ograniczenia i przetestowane platformy opisuje [rejestr zgodności i weryfikacji](development/multiplayer.md). Przy problemach zajrzyj do przewodnika [Rozwiązywanie problemów](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems).

## Agenci i rozszerzenia

Opcjonalnych agentów od twórców aplikacji instaluje się w aplikacji, w sekcji **Agents → Agent Organizer** (agenci, organizowanie agentów). Marinara wybiera katalog [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) zgodny ze swoją główną wersją.

- **Aktualizacje:** Marinara pyta o zgodę, zanim pobierze nową wersję zainstalowanego pakietu. **Not now** (nie teraz) zostawia bieżącą wersję, a działanie **Update** (aktualizacja) pozostaje dostępne w sekcji Agent Organizer. Świeża instalacja nie ma żadnych pakietów.
- **Gdzie leżą pakiety:** `DATA_DIR/capability-packages`. Wolumeny Docker, własne foldery danych, kopie zapasowe i zwykłe aktualizacje je zachowują. Dotyczy to komputera, kontenera Docker i środowiska Termux. Urządzenia iOS i inne przeglądarki korzystają z pakietów na swoim serwerze.
- **Miejsce na dysku:** Marinara trzyma bieżącą i poprzednią wersję każdego pakietu, a starsze wersje i tymczasowe kopie w `DATA_DIR/capability-runtime-snapshots` usuwa. Dane pakietów nigdy nie są usuwane.
- **Bez sieci:** Zainstalowane pakiety działają dalej w swojej wersji, gdy serwis GitHub jest nieosiągalny, gdy aktualizacja zostanie odrzucona albo gdy weryfikacja się nie powiedzie.

### Import własnych agentów

Zewnętrzne pliki agentów, foldery i repozytoria są zablokowane. Żeby je dopuścić, włącz przełącznik **Allow custom Agent imports** (zezwolenie na import własnych agentów) w **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia). Nie wymaga to zmiennej środowiskowej. Dopóki tego nie zrobisz, kontrolki importu pozostają wyszarzone.

Każdy import najpierw pokazuje, o jakie uprawnienia prosi agent. Uprawnienia trzeba zatwierdzić wprost. Dołączone funkcje i wybory narzędzi nie są importowane, wygenerowany kod CSS jest oczyszczany, a działania wynikowe są sprawdzane względem zatwierdzonych uprawnień. Wyłączenie tej blokady zatrzymuje zaimportowanych agentów. Nie dotyczy to agentów utworzonych w aplikacji Marinara Engine ani pakietów oficjalnych.

<a id="custom-agent-repositories"></a>

### Własne repozytoria agentów

Repozytoria są domyślnie wyłączone, bo ich prompty i narzędzia są niesprawdzone. Ustaw `ENABLE_CUSTOM_AGENT_REPOS=true`, włącz **Allow custom Agent imports**, a potem otwórz **Agents → Agent Organizer → Custom Sources** (agenci, organizowanie agentów, własne źródła), żeby podejrzeć publiczne repozytorium w serwisie GitHub. Dodanie źródła i zastosowanie późniejszych zmian wymagają potwierdzenia. Synchronizacja jest ręczna, a Marinara nigdy nie klonuje repozytoriów ani nie odpytuje ich w tle. Przyjmowane są tylko adresy URL głównego katalogu repozytorium w serwisie GitHub.

Repozytorium publikuje agentów, zestawy zasad dla trybu Game Mode albo jedno i drugie. W głównym katalogu:

- `agents.json` to tablica w formacie agentów do pobrania:

  ```json
  [
    {
      "id": "continuity-helper",
      "name": "Continuity Helper",
      "description": "Checks recent turns for contradictions.",
      "phase": "post_processing",
      "enabledByDefault": false,
      "category": "writer",
      "defaultPromptTemplate": "Check {{messages}} for continuity errors."
    }
  ]
  ```

- Folder `rulesets` zawiera po jednym zestawie zasad w każdym pliku `.json`, do 32 plików po 512 KB. Odczytywane są tylko pliki leżące bezpośrednio w tym folderze. Podgląd pokazuje nazwę, wersję i zakres każdego zestawu. Tekst mistrza gry z zestawu zasad trafia do modelu w każdej grze, która go używa, więc instaluj zestawy tylko od osób, którym ufasz.

Nazwy importowanych zestawów zasad zawierają nazwę właściciela repozytorium, na przykład `alice/my-5e`, więc nigdy nie zajmują nazwy oficjalnej. Każda wersja zostaje zachowana, a gra toczy się dokładnie na tej wersji, od której się zaczęła. Jeśli ta sama wersja przyjdzie z inną zawartością, Marinara zachowuje zainstalowaną i radzi poprosić autora o podniesienie numeru wersji. Plik, którego Marinara nie umie odczytać, jest wymieniany z podaniem powodu i pomijany.

Przy synchronizacji zdalne wartości promptów, ustawień i narzędzi zastępują pokazane w podglądzie wartości zarządzane z repozytorium. Twoje wybory kont i grafik pozostają lokalne. Jeśli agent zniknie u źródła, zostaje zwykłym agentem lokalnym i traci tylko powiązanie z repozytorium. Usunięcie źródła działa tak samo, a jego zestawy zasad pozostają zainstalowane.

Własni agenci mogą też włączyć **Previous output** (poprzedni wynik) w sekcji Context Sources, żeby odczytać swój ostatni pomyślny wynik. Przy włączonym **JSON context output** (wynik kontekstu w JSON) zwracaj `{"text":"main prompt content","agent-context":"private continuation context"}`. Do głównego promptu trafia tylko `text`. **Hide output as spoilers** (ukryj wynik jako spoiler) zostawia zapisane wyniki zwinięte. Regeneracja pomija zastępowaną turę, a usunięte wiadomości i nieaktywne swipe'y nie mogą dostarczać kontekstu.

<a id="external-extensions"></a>

### Rozszerzenia zewnętrzne

Import rozszerzeń od osób trzecich wymaga dwóch zgód. Zmienna środowiskowa to zgoda osoby prowadzącej serwer. Przełącznik w sekcji Danger Zone to akceptacja użytkownika.

1. Ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`.
2. Otwórz **Settings → Advanced → Danger Zone**, przewiń poniżej kontrolek usuwania danych, przeczytaj ostrzeżenie i włącz **Allow third-party extension imports** (zezwolenie na import rozszerzeń od osób trzecich).

Wtedy w **Settings → Addons** (ustawienia, dodatki) pojawia się sekcja **External Extensions** (rozszerzenia zewnętrzne). Zamknięcie którejkolwiek z bram wyłącza wpisy zewnętrzne i zatrzymuje ich kod. Wpisy zapisane ręcznie, odziedziczone po starszych wersjach, zaimportowane z profilu i te o nieznanym pochodzeniu liczą się jako zewnętrzne, więc wrzucenie plików do folderu nie omija bram. Szkice od asystentki Professor Mari nie wymagają żadnej z bram. Powstają wyłączone i wymagają zatwierdzenia dokładnego skrótu ich kodu.

Domyślnym trybem jest Sandboxed Browser Extensions. Część starszych pakietów ma oznaczenie **Full page access** (pełny dostęp do strony), bo potrzebuje strony aplikacji Marinara Engine. Ten tryb uruchamia zatwierdzony kod na stronie aplikacji Marinara Engine, z dostępem do treści strony, pamięci przeglądarki, interfejsów sieciowych i twojej sesji. Jest dostępny tylko dla wpisów External Extensions przy obu otwartych bramach i wymaga osobnego potwierdzenia ostrzeżenia. Po jego wyłączeniu odśwież stronę.

## Pełna lista zmiennych środowiskowych

Tabele powyżej obejmują kontrolę dostępu, przechowywanie danych, logowanie, limity czasu, działania uprzywilejowane i zgody na adresy lokalne. Pozostałe ustawienia są tutaj.

### Serwer i uruchamianie

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PORT` | `7860` | Port, na którym nasłuchuje serwer. W systemie Android, w kontenerze Docker i w środowisku Termux trzymaj tę samą wartość. |
| `HOST` | `127.0.0.1` (`0.0.0.0` w programach uruchamiających i obrazach Docker) | Interfejs sieciowy do nasłuchu. Do dostępu z sieci lokalnej użyj `0.0.0.0`. Domyślny plik Compose publikuje port Docker tylko na `127.0.0.1`. |
| `MARINARA_ANDROID_SECRET` | pusta | Wewnętrzny sekret dla instalacji w środowisku Termux zarządzanych przez plik APK. Tworzy go aplikacja na system Android, a program uruchamiający w środowisku Termux go eksportuje. Nigdy nie proś użytkowników o jego ustawienie. Musi mieć dokładnie 64 znaki szesnastkowe. Nieprawidłowa, niepusta wartość sprawia, że lokalne żądania urządzenia kończą się błędem HTTP 503. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Plik sekretu używany przez program uruchamiający w środowisku Termux i lokalne polecenie `mari`. Zarządzają nim APK i program uruchamiający. |
| `AUTO_OPEN_BROWSER` | `true` | Czy programy uruchamiające otwierają adres aplikacji. `false` to wyłącza. Konfiguracja zarządzana przez APK wyłącza tę opcję. |
| `AUTO_UPDATE_ENABLED` | `true` | Czy programy uruchamiające oparte na Git pobierają i wgrywają aktualizacje przed startem. `false` wyłącza to od następnego uruchomienia. Program uruchamiający nadal sprawdza w trybie tylko do odczytu, czy są nowsze wydania, i wypisuje przypomnienie. `--skip-update` pomija oba sprawdzenia przy jednym starcie. |
| `MARINARA_NOTICES_ENABLED` | `true` | Czy serwer pobiera powiadomienia od opiekunów. Zobacz [Powiadomienia Marinara](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` w gałęzi `notices` | Zastępczy plik powiadomień dla forków i mirrorów. Jest sprawdzany tak samo, a linki spoza `https://github.com/Pasta-Devs/` są usuwane. |
| `MARINARA_ENV_FILE` | plik `.env` w głównym folderze projektu | Zmiana ścieżki do pliku `.env`. Ustaw ją przed startem. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Największa liczba równoczesnych żądań obrazów lub wideo w całym serwerze. Zmniejsz do 1-2, jeśli lokalnemu ComfyUI lub SwarmUI brakuje pamięci VRAM. `0` usuwa limit. Nieprawidłowe wartości są pomijane z ostrzeżeniem. Praca wsadowa nigdy nie zajmuje ostatniego miejsca. Działa dodatkowo obok opcji **Queue media generation requests** (kolejkowanie żądań generowania mediów) w **Settings → Generations → Overall Generations** (ustawienia, generowanie, ogólne ustawienia generowania), domyślnie włączonej, która kolejkuje zadania obrazów i wideo osobno dla każdego konta. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 min) | Jak długo żądanie czeka na wolne miejsce, zanim zakończy się błędem. `0` oznacza czekanie bez końca. |
| `MARINARA_SHARED_GPU_HOSTS` | pusta | Lista adresów `host:port` oddzielonych przecinkami dla jednej karty GPU współdzielonej przez lokalny model i lokalny backend obrazów lub wideo, na przykład llama-swap. Żądania tekstu i multimediów do hosta z listy są wykonywane na zmianę, więc obraz nie czeka bez końca za odpowiedziami czatu. Obraz lub klip czeka najwyżej `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Embeddingi nie są wstrzymywane. Dotyczy nowych żądań, bez restartu. |
| `MARINARA_ENV_WATCH` | `1` | Sposób obserwowania pliku `.env`. Domyślnie: zdarzenia zmian (z opóźnieniem scalającym około 250 ms) ze sprawdzaniem co 30 sekund jako zapasem. `poll`: zawsze sprawdzanie co 30 sekund. `0`: wyłączone. Zobacz [Ponowne uruchomienie albo przeładowanie w locie](#restart-or-hot-reload). |
| `TZ` | domyślna systemowa | Zapasowa strefa czasowa komputera dla zadań serwera, na przykład `Europe/Warsaw`. Zostaw ją nieustawioną albo pustą, żeby używać strefy czasowej komputera. Zapisana w trybie Conversation strefa **Schedule timezone** (strefa czasowa harmonogramu) ma pierwszeństwo dla harmonogramów. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Źródła przeglądarki, którym wolno wysyłać żądania z innej domeny. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Flaga po starszych wersjach. Obecne wydania nie zawierają startowego klucza, więc nic nie tworzy. Dodaj własne konto w aplikacji. |

Ustawienie **Schedule timezone** domyślnie przyjmuje strefę czasową twojego urządzenia. Można je zmienić przy konfiguracji trybu Conversation, w panelu Chat Settings dla trybu Conversation albo w edytorze harmonogramu postaci. To jedno globalne ustawienie, wspólne dla wszystkich czatów w trybie Conversation i synchronizowane z innymi klientami podłączonymi do tego samego serwera.

### Multimedia i narzędzia do sprite'ów

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `FFMPEG_PATH` | pusta | Ścieżka do programu `ffmpeg`, używanego do animowanych plików GIF z wyrazami twarzy. W razie braku używany jest `ffmpeg` ze zmiennej PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 min) | Czas na przetworzenie jednego animowanego klipu z wyrazem twarzy. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` najpierw próbuje wbudowanego czyszczenia, a potem opcjonalnego narzędzia AI. `builtin` używa tylko wbudowanego czyszczenia. `backgroundremover` wymusza narzędzie AI. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` instaluje przy starcie opcjonalne narzędzie AI do usuwania tła. |
| `BACKGROUNDREMOVER_COMMAND` | pusta | Ścieżka do systemowego programu `backgroundremover`. |
| `BACKGROUNDREMOVER_PYTHON` | pusta | Ścieżka do interpretera Python, w którym zainstalowano `backgroundremover`. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 min) | Czas na jedno wywołanie usuwania tła przez AI. |

### Dostawcy wideo sceny

Konta wideo konfiguruje się w aplikacji. Te ustawienia tylko dostrajają zadania. Wartości podaje się w milisekundach.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często serwer sprawdza zadanie Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | Jak często sprawdza zadanie xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często sprawdza zadanie wideo w OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często sprawdza zadanie Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | pusta | Publiczny adres HTTPS tego serwera dla usług, które muszą pobrać obraz odniesienia po adresie URL. |

<a id="lorebooks"></a>

### Lorebooki

Oba ustawienia są domyślnie wyłączone i działają od następnego generowania po zmianie `.env`. Gdy zmienna `LOREBOOK_STABLE_GROUP_WINNERS` jest ustawiona, wygrywa z przełącznikiem **Stable lorebook picks** (stałe wybory lorebooka) w **Settings → Advanced → Features**. W przeciwnym razie decyduje przełącznik. Zobacz [Przełączniki funkcji](configuration/features.md).

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Zachowuje tego samego zwycięzcę grupy włączania w czacie, dopóki kandydaci są tacy sami, zamiast losować przy każdym generowaniu. Utrzymuje stały początek promptu dla pamięci podręcznej promptów u dostawcy. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Zapisuje pełny tekst aktywowanych wpisów tylko przy najnowszej wiadomości asystenta lub narratora. Starsze wiadomości zachowują identyfikatory wpisów, klucze i wyniki. Znacznie zmniejsza czaty z dużymi lorebookami. Jeśli nowsze wiadomości zostaną usunięte, Active Context i ponowienia agentów pokazują bieżący tekst wpisu dla wiadomości, która znów jest najnowsza. |

Skrypt `scripts/compact-lorebook-scans.mjs` stosuje tę samą regułę do starszych czatów. Najpierw zatrzymaj serwer. Bez `--apply` skrypt wykonuje tylko próbę, a przed zapisem tworzy kopię zapasową obu tabel wiadomości.

<a id="robustness"></a>

### Odporność

Wszystkie ustawienia są domyślnie wyłączone, co zachowuje dotychczasowe działanie. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` i `SHUTDOWN_FORCE_EXIT_ON_REPEAT` wymagają restartu. Pozostałe działają po zmianie `.env`. Gdy zmienna `PROVIDER_RETRY_TRANSIENT_ERRORS` jest ustawiona, wygrywa z przełącznikiem **Retry failed provider calls** (ponawiaj nieudane wywołania dostawcy) w **Settings → Advanced → Features**. W przeciwnym razie decyduje przełącznik.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Ponawia odrzucone lub nieosiągalne połączenie albo błąd 502 lub 503 najwyżej dwa razy, z przerwą nie dłuższą niż 5 s, i tylko zanim dotrze do ciebie jakikolwiek tekst. Błąd 504 i zerwane połączenie nigdy nie są ponawiane. Nie działa, gdy konto ma fallback, który jest wtedy próbowany od razu. Wolno zawodzący host może opóźnić błąd o około 20 s. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | Zapis pomija ponowne zapisanie pliku czatu lub `manifest.json`, gdy jego zawartość zgadza się z tym, co ten serwer zapisał ostatnio, a plik na dysku się nie zmienił. Plik właśnie przywrócony z `.bak` jest zawsze zapisywany ponownie. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Przygotowuje duże pliki czatów do zapisu w krótkich porcjach, żeby zapis bardzo długiego czatu nie wstrzymywał innych żądań. Zapisane bajty są takie same. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Tylko w systemie Windows. Zapamiętuje w `.writer-boot-id.json` wewnątrz `DATA_DIR`, do następnego uruchomienia systemu, kontrolę czasu rozruchu, którą blokada magazynu danych wykonuje przy każdym starcie (około 1,5 do 2 s pracy PowerShell). |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Tylko w systemie Windows. <kbd>Ctrl</kbd>+<kbd>Break</kbd> i zamknięcie konsoli również łagodnie zatrzymują serwer i zapisują oczekujące zmiany. Zamknięcie konsoli dostaje krótsze terminy, żeby zmieścić się w około 5 s, na które pozwala system Windows. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Ponowne naciśnięcie <kbd>Ctrl</kbd>+<kbd>C</kbd> lub <kbd>Ctrl</kbd>+<kbd>Break</kbd> ponad 1,5 s po pierwszym natychmiast kończy serwer. Niezapisane zmiany mogą przepaść. Bez tej opcji powtórzenia są ignorowane i obowiązuje limit zamykania 8 s. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Zaczyna zapisywać oczekujące zmiany, gdy nadejdzie sygnał zatrzymania, jeszcze w trakcie zamykania połączeń. Restart w Advanced Settings z tego nie korzysta. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | Jak długo sygnał zatrzymania czeka na środowiska w tle (pakiety, rozszerzenia, model wbudowany), zanim zamknie magazyn danych. `0` czeka na wszystkie. Najwyżej `2500`, żeby magazyn danych zamknął się w limicie 8 s. Restart w Advanced Settings nadal czeka na wszystkie. |

### Integracje i pozostałe ustawienia

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Czy konta **Claude (Subscription)** korzystają z narzędzia Claude Code zainstalowanego na tym komputerze, gdy jest ono co najmniej tak nowe jak kopia dołączona do aplikacji. W systemie Android nie ma dołączonej kopii, więc to ustawienie musi być włączone. `false` zawsze używa dołączonej kopii. Zmiana działa w ciągu pięciu minut. |
| `DOCS_I18N_BASE_URL` | oficjalna gałąź `docs-i18n` | Skąd pobierane są pakiety językowe dokumentacji i interfejsu. Pakiety interfejsu korzystają z jej poddrzewa `ui/`. Musi to być publiczny host `https://`. |
| `GIPHY_API_KEY` | pusta | Klucz Giphy do wyszukiwania plików GIF w trybie Conversation. Wyszukiwanie pozostaje wyłączone, dopóki go nie ustawisz i nie zrestartujesz serwera. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Domyślny adres aplikacji haptycznej Intiface. |
| `SPOTIFY_REDIRECT_URI` | wyliczany z żądania | Zmiana adresu zwrotnego logowania Spotify. Ustaw go, gdy TLS kończy się na warstwie przed serwerem. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Największa treść strony wiki, jaką asystentka Professor Mari czyta przed skróceniem. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Czas na jedno żądanie do wiki od asystentki Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Jak długo asystentka Professor Mari trzyma w pamięci podręcznej odczyt z wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (program uruchamiający dla systemu Windows ustawia `true`) | Pozwala zainstalować środowisko **Built-in model** (model wbudowany) bez nagłówka administracyjnego na pętli zwrotnej. |

Jak skonfigurować **Built-in model**, opisuje przewodnik [Konfiguracja modelu wbudowanego](connections/local-model.md).

<a id="outbound-http-proxy"></a>

### Wychodzące proxy HTTP

Niektóre sieci łączą się z internetem wyłącznie przez proxy HTTP, na przykład v2rayN bez trybu TUN. Marinara może wysyłać przez to proxy żądania do usług AI, usług obrazów, serwerów embeddingów i katalogu agentów. Ustaw te zmienne w środowisku, które uruchamia aplikację Marinara Engine, albo w `.env`, a potem uruchom aplikację ponownie.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | nieustawiona | `1` włącza proxy. Bez tego Marinara, tak samo jak Node.js, pomija ustawienia proxy. |
| `HTTP_PROXY` | pusta | Adres proxy, na przykład `http://127.0.0.1:10809`. Używany dla każdego żądania, gdy `HTTPS_PROXY` nie jest ustawione. |
| `HTTPS_PROXY` | pusta | Proxy dla adresów `https://`, gdy ma być inne niż `HTTP_PROXY`. |
| `NO_PROXY` | pusta | Rozdzielone przecinkami hosty, które omijają proxy. Dopisz tu serwery modeli w swojej sieci. `localhost`, `127.0.0.1` i `::1` zawsze je omijają. |

## Powiązane przewodniki

- [Przełączniki funkcji](configuration/features.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](REMOTE_ACCESS.md)
- [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
- [Generowanie wideo sceny](media/scene-video.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md)
