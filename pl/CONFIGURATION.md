# Konfiguracja serwera

Z tego przewodnika dowiesz się, jak zmieniać ustawienia serwera w aplikacji Marinara Engine za pomocą zmiennych środowiskowych. Zmienna środowiskowa to ustawienie zapisane w zwykłym pliku tekstowym, który serwer odczytuje. Większość osób nigdy nie potrzebuje tej strony. Pełna lista zmiennych znajduje się na dole.

## Kiedy warto zmieniać konfigurację?

Marinara Engine działa od razu po instalacji, bez żadnej konfiguracji. Ta strona przydaje się tylko przy kilku zadaniach. Prawie wszystkie dotyczą serwera używanego przez więcej niż jedno urządzenie.

Konfigurację zmienia się zwykle po to, żeby:

- Udostępnić serwer innym urządzeniom w sieci (kontrola dostępu).
- Chronić wspólny serwer hasłem albo listą dozwolonych adresów IP.
- Zmienić miejsce zapisu danych na dysku.
- Zwiększyć szczegółowość logów przy szukaniu przyczyny problemu.
- Dać powolnym zadaniom generowania obrazów, wideo lub embeddingów więcej czasu (limity czasu).
- Odblokować działania uprzywilejowane, takie jak kopie zapasowe czy aktualizacje ze zdalnego urządzenia.

Prawie całą resztę – klucze API dostawców AI, postacie i opcje czatu – ustawia się w aplikacji, a nie tutaj. Jak dodać dostawcę AI, opisuje przewodnik [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

Opcjonalnymi agentami od twórców aplikacji też zarządza się w aplikacji. Otwórz sekcję **Agents → Download Agents** (agenci, pobieranie agentów), żeby ich zainstalować albo odinstalować. Marinara sama wybiera z katalogu [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) ścieżkę zgodną z główną wersją silnika.

Cykl życia pakietów i ich przechowywanie:

- **Aktualizacje:** Marinara sprawdza, czy zainstalowane pakiety oficjalne mają zgodne aktualizacje, i przed pobraniem każdej nowej wersji pyta o zgodę. Odpowiedź **No** zostawia bieżącą wersję, a ręczne działanie **Update** pozostaje dostępne w Download Agents. Świeża instalacja jest pusta, dopóki nie zostaną wybrane pakiety.
- **Platformy:** Tak samo działa to na komputerze, w kontenerze Docker i w instalacji Android uruchamianej przez Termux. Urządzenia iOS i inne przeglądarki korzystają z pakietów zainstalowanych na swoim serwerze Marinara.
- **Trwałość:** Pakiety leżą w `DATA_DIR/capability-packages`. Wolumeny Docker, własne foldery danych, kopie zapasowe i zwykłe aktualizacje zachowują je bez zmian.
- **Odporność na brak sieci:** Zainstalowane pakiety działają dalej w swojej wersji, gdy połączenie HTTPS z serwisem GitHub jest niedostępne, gdy aktualizacja zostanie odrzucona albo gdy nie przejdzie weryfikacji.

### Import własnych agentów

Zewnętrzne pliki agentów, foldery i własne repozytoria są domyślnie zablokowane. Żeby je dopuścić, otwórz sekcję **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia) i włącz przełącznik **Allow custom Agent imports** (zezwolenie na import własnych agentów). W odróżnieniu od External Extensions ta blokada leży w rękach użytkownika i nie wymaga zmiennej środowiskowej. Dopóki jest wyłączona, kontrolki importu pozostają wyszarzone.

Przy każdym imporcie widać, o jakie uprawnienia prosi agent, zanim cokolwiek zostanie zapisane. Uprawnienia trzeba zatwierdzić wprost, dołączone funkcje i wybory narzędzi nie są importowane, wygenerowany kod CSS przechodzi przez filtr, a działania wynikowe są sprawdzane względem zatwierdzonego zestawu uprawnień. Wyłączenie blokady zatrzymuje agentów zaimportowanych z zewnątrz. Agenci utworzeni w aplikacji Marinara Engine oraz pakiety oficjalne zainstalowane przez **Download Agents** działają dalej i tej blokady nie dotyczą.

### Własne repozytoria agentów

Własne repozytoria są domyślnie wyłączone, bo ich prompty i wybory narzędzi to niesprawdzona treść z zewnątrz. Ustaw `ENABLE_CUSTOM_AGENT_REPOS=true`, włącz przełącznik **Allow custom Agent imports** w sekcji Danger Zone, a potem otwórz **Agents → Download Agents → Custom Sources**, żeby podejrzeć publiczne repozytorium GitHub. Dodanie źródła oraz każda późniejsza zmiana treści wymagają wyraźnego potwierdzenia. Synchronizacja jest ręczna; Marinara nie klonuje repozytoriów ani nie odpytuje ich w tle.

W głównym folderze repozytorium musi znaleźć się plik `agents.json` z tablicą zapisaną w tym samym formacie definicji agenta co pobierane pakiety agentów. Minimalny plik wygląda tak:

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

Marinara przyjmuje wyłącznie adresy URL wskazujące główny folder repozytorium GitHub i przed pokazaniem podglądu sprawdza zarówno ograniczone archiwum, jak i każdą definicję agenta. Podczas synchronizacji zdalne wartości promptu, ustawień i narzędzi zastępują te wartości z podglądu, którymi zarządza repozytorium. Wybór połączenia i grafiki zostaje lokalny. Jeśli agent zniknie po stronie źródła, Marinara zachowuje go jako zwykłego lokalnego agenta i usuwa tylko powiązanie z repozytorium. Przy usuwaniu źródła obowiązuje ta sama zasada zachowania kopii lokalnej.

### Rozszerzenia zewnętrzne

Import rozszerzeń zewnętrznych wymaga dwóch niezależnych zgód. Ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`, potem otwórz **Settings → Advanced → Danger Zone**, przewiń poniżej kontrolek usuwania danych, przeczytaj ostrzeżenie i włącz przełącznik **Allow third-party extension imports** (zezwolenie na import rozszerzeń od osób trzecich). Dopiero wtedy w sekcji **Settings → Addons** pojawia się sekcja **External Extensions**.

Zmienna środowiskowa to zgoda osoby prowadzącej serwer, a przełącznik w sekcji Danger Zone to wyraźna zgoda użytkownika. Wspólnej reguły pilnują zarówno sama sekcja, jak i ścieżki importu, ścieżki zatwierdzania oraz oba mechanizmy ładowania w czasie działania. Zamknięcie którejkolwiek z tych bram wyłącza wpisy zewnętrzne i zatrzymuje uruchomiony kod z zewnątrz. Wpisy rozszerzeń zapisane ręcznie, odziedziczone po starszych wersjach, zaimportowane z profilu i te o nieznanym pochodzeniu liczą się jako zewnętrzne, więc wrzucenie plików do folderu związanego z rozszerzeniami nie omija żadnej z bram.

Szkice od asystentki Professor Mari działają bez tej flagi. Powstają wyłączone i mimo to wymagają zatwierdzenia dokładnego skrótu ich kodu.

Tryb Sandboxed Browser Extensions pozostaje domyślny. Część starszych pakietów od osób trzecich ma oznaczenie **Full page access** (pełny dostęp do strony), bo opiera się na strukturze DOM aplikacji Marinara Engine. W tym trybie kod działa wewnątrz strony aplikacji Marinara Engine, dokładnie w zatwierdzonej postaci. Ma wtedy dostęp do treści strony, pamięci przeglądarki, interfejsów sieciowych i bieżącej sesji w tym samym źródle. Dostają go wyłącznie wpisy External Extensions po otwarciu obu bram, a do tego trzeba osobno potwierdzić ostrzeżenie. Jeśli rozszerzenie zostawia po sobie zmiany w wyglądzie lub w działaniu, wyłącz ten tryb i odśwież stronę.

## Gdzie leży plik .env

Konfiguracja mieści się w pliku o nazwie `.env`. To zwykły plik tekstowy z jednym ustawieniem w linii, w postaci `KEY=value`. Linie zaczynające się od `#` to komentarze, które serwer pomija.

Plik `.env` jest zbiorem danych, a nie skryptem powłoki. Marinara nie wykonuje znaku `$`, podstawień poleceń w rodzaju `$(...)` ani innej składni powłoki znalezionej w wartości. Programy uruchamiające dla systemów macOS/Linux oraz dla środowiska Termux stosują tę samą zasadę braku interpretacji przy tych nielicznych ustawieniach, których potrzebują przed startem serwera. Wartość podana wcześniej w środowisku programu uruchamiającego ma pierwszeństwo przed odpowiadającym jej wpisem w pliku `.env`.

Marinara tworzy pusty plik `.env` przy pierwszym uruchomieniu, więc nie trzeba robić tego ręcznie.

- W zwykłych instalacjach plik `.env` leży w głównym folderze projektu.
- W oficjalnych obrazach Docker i Podman znajduje się w `/app/data/.env`, w tym samym wolumenie co dane.

Plik `.env.example` w tym samym folderze wymienia wszystkie ustawienia razem z wartościami domyślnymi. Żeby zmienić ustawienie, skopiuj jego linię z `.env.example` do `.env`, a potem popraw wartość po znaku `=`.

Oto przykładowy plik `.env`, który zmienia port i włącza hasło:

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Serwer sam odczytuje plik `.env`, niezależnie od sposobu uruchomienia. Dotyczy to również bezpośredniego wywołania `pnpm start`. Programy uruchamiające (`start.bat`, `start.sh`, `start-termux.sh`) dodają dwie rzeczy. Ustawiają `HOST=0.0.0.0`, żeby inne urządzenia mogły dotrzeć do serwera, oraz otwierają przeglądarkę. Przy samym `pnpm start` serwer nasłuchuje tylko na tym komputerze, chyba że zmienna `HOST` zostanie ustawiona ręcznie.

## Ponowne uruchomienie albo przeładowanie w locie

Marinara obserwuje plik `.env` w trakcie pracy. Po zapisaniu zmiany większość ustawień zaczyna działać w ciągu mniej więcej 2 sekund, bez restartu. Przy każdej zastosowanej zmianie serwer wpisuje do logu linię zaczynającą się od `[env-watcher]`.

Niewielka grupa ustawień niskopoziomowych zostaje ustalona przy starcie serwera. Ich zmiana wymaga pełnego restartu. Chodzi o te ustawienia:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- Ustawienia limitu czasu i odpytywania dla obrazów, wideo, sprite'ów oraz ComfyUI (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` oraz cztery ustawienia `*_VIDEO_POLL_INTERVAL_MS`)

Po zmianie któregokolwiek z nich w logu pojawia się ostrzeżenie o konieczności restartu. Ustawienia kontroli dostępu i sekrety, czyli `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET` i `CSRF_TRUSTED_ORIGINS`, restartu nie wymagają.

## Kontrola dostępu

Kontrola dostępu decyduje o tym, kto może dotrzeć do działającego serwera. Ta sekcja jest krótkim przypomnieniem. Krok po kroku i z przykładami opisuje to przewodnik [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](REMOTE_ACCESS.md).

Kilka pojęć używanych poniżej:

- Pętla zwrotna, czyli loopback, to ten sam komputer, na którym działa serwer. Dociera się do niego pod adresem `127.0.0.1` albo `localhost`.
- Zakres CIDR to skrótowy zapis całego bloku adresów IP, na przykład `192.168.1.0/24`. Skrót CIDR pochodzi od Classless Inter-Domain Routing.
- Zakresy RFC 1918 to standardowe prywatne zakresy adresów używane w sieciach domowych i biurowych, na przykład `10.x.x.x` i `192.168.x.x`.

Domyślnie, gdy hasło nie jest ustawione, serwer przyjmuje połączenia wyłącznie ze źródeł zaufanych. Są to pętla zwrotna, dowolny adres z `IP_ALLOWLIST`, sieć Tailscale oraz ruch mostka i bramy Docker z tego samego komputera. Każdy inny ruch, łącznie ze zwykłą siecią domową, dostaje odpowiedź `403 Forbidden`, dopóki nie wybierzesz jednej z opcji poniżej.

Najważniejsze ustawienia kontroli dostępu:

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `BASIC_AUTH_USER` | pusta | Nazwa użytkownika do okna logowania. Ustaw razem z `BASIC_AUTH_PASS`, żeby wymusić logowanie. |
| `BASIC_AUTH_PASS` | pusta | Hasło do okna logowania. Zostaw jedno z pól puste, żeby wyłączyć logowanie. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Tekst wyświetlany w oknie hasła w przeglądarce. |
| `IP_ALLOWLIST` | pusta | Rozdzielone przecinkami adresy IP lub zakresy CIDR, które są zawsze dozwolone. Pętla zwrotna jest dozwolona zawsze. |
| `IP_ALLOWLIST_ENABLED` | `true` | Ustaw `false`, żeby zachować listę, ale wstrzymać jej egzekwowanie. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Przywraca dostęp bez hasła z sieci prywatnych, gdy logowanie nie jest ustawione. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Dopuszcza dostęp bez hasła z dowolnego adresu, także z publicznego internetu. Niezalecane. |
| `TRUSTED_PRIVATE_NETWORKS` | wbudowane wartości domyślne | Zastępuje domyślne zakresy sieci prywatnych. Wpisz też te domyślne, które mają zostać. |
| `BYPASS_AUTH_TAILSCALE` | automatycznie | Pusta wartość ufa bezpośrednim gniazdom Tailscale tylko wtedy, gdy oba końce używają adresów sieci Tailscale. Ustaw `true`, żeby zachować dawne pominięcie całego zakresu `100.64.0.0/10`, albo `false`, żeby wymagać zwykłej kontroli dostępu. |
| `BYPASS_AUTH_DOCKER` | automatycznie | Pusta wartość ufa tylko wykrytemu interfejsowi kontenera i jego dokładnej bramie. Ustaw `true`, żeby zachować zgodność ze starszymi lub własnymi sieciami, albo `false`, żeby wymagać zwykłej kontroli dostępu. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Wymaga zwykłego logowania i sprawdzenia listy dozwolonych adresów dla ruchu Docker przekazanego przez proxy. Ustaw `false` tylko wtedy, gdy każdy klient po stronie nadrzędnej jest zaufany. |
| `TRUSTED_HOSTS` | pusta | Dodatkowe nazwy publiczne lub nazwy odwrotnego proxy, na które Marinara może odpowiadać. Bezpośredni adres IP, `localhost`, `.local`, `.home.arpa` oraz jednoczłonowe nazwy w sieci lokalnej działają same z siebie. |
| `SSL_CERT` | pusta | Ścieżka do pliku certyfikatu TLS. Ustaw razem z `SSL_KEY`, żeby serwer sam obsługiwał HTTPS. |
| `SSL_KEY` | pusta | Ścieżka do pliku klucza prywatnego TLS. |
| `CSRF_TRUSTED_ORIGINS` | pusta | Dodatkowe źródła przeglądarki, z których wolno zapisywać zmiany. Przydaje się przy publicznej domenie albo nietypowym porcie. Dosłowna wartość `null` jest ignorowana i nie wolno jej używać dla pliku APK na Android; jego samouwierzytelniające trasy logowania działają bez globalnego zaufania nieprzejrzystemu źródłu. |

Basic Auth to skrót od HTTP Basic Authentication, czyli prostego okna z nazwą użytkownika i hasłem. Dane logowania są tam tylko zakodowane, a nie zaszyfrowane, więc przy serwerze wystawionym do publicznego internetu zawsze łącz je z HTTPS. HTTPS to bezpieczna, szyfrowana wersja protokołu HTTP. Żeby włączyć ją bezpośrednio, ustaw jednocześnie `SSL_CERT` i `SSL_KEY` albo postaw przed serwerem Marinara odwrotne proxy.

Żeby inne urządzenia w ogóle dotarły do serwera, musi on nasłuchiwać na osiągalnym interfejsie. Ustaw `HOST=0.0.0.0`. Programy uruchamiające robią to za ciebie, ale `pnpm start` nasłuchuje wyłącznie na pętli zwrotnej.

Telefony, tablety, urządzenia w sieci Tailscale i inne komputery mogą nadal łączyć się po adresie IP serwera, bez dopisywania go do `TRUSTED_HOSTS`. Jeśli aplikacja Marinara Engine jest publikowana pod nazwą publiczną albo nazwą odwrotnego proxy, dopisz tę nazwę dokładnie, na przykład `TRUSTED_HOSTS=chat.example.com`. Nazwy obecne już w `CSRF_TRUSTED_ORIGINS` lub `CORS_ORIGINS` też są przyjmowane, dla zgodności. To sprawdzenie nagłówka Host nie pozwala przypisać nazwy DNS publicznej witryny do adresu pętli zwrotnej serwera Marinara.

## Przechowywanie danych

Ustawienia przechowywania decydują o tym, gdzie leżą dane lokalne. Należą do nich czaty, postacie, awatary i wygenerowane multimedia.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Główny folder wszystkich danych użytkownika. Obrazy Docker ustawiają `/app/data`. |
| `FILE_STORAGE_DIR` | folder `storage` wewnątrz `DATA_DIR` | Zmienia folder przechowywania plików. |
| `ENCRYPTION_KEY` | pusta | Klucz do szyfrowania zapisanych kluczy API. Wygeneruj go poleceniem poniżej. |

Marinara trzyma dane w zwykłych plikach JSON. Dzięki temu kopie zapasowe łatwo skopiować i przejrzeć.

Żeby wygenerować klucz szyfrujący, uruchom to polecenie i wklej wynik do `ENCRYPTION_KEY`:

```
openssl rand -hex 32
```

Co mieści się w poszczególnych folderach danych, wyjaśnia przewodnik [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md).

## Poziomy logowania

Logowanie steruje tym, ile szczegółów serwer wypisuje na konsolę. Główna kontrolka to `LOG_LEVEL`. Serwer ukrywa wszystko poniżej wybranego poziomu.

| Poziom | Co pokazuje |
| --- | --- |
| `error` | Tylko poważne awarie, po których nie da się kontynuować. |
| `warn` | Błędy oraz ostrzeżenia niekrytyczne. To wartość domyślna. |
| `info` | Ostrzeżenia plus logi startu i poszczególnych żądań. |
| `debug` | Wszystko, łącznie z pełnymi promptami i odpowiedziami modelu. Bardzo dużo tekstu. |

Zalecane wybory:

- Do zwykłej pracy zostaw domyślny `warn`. Jest cichy i pokazuje tylko prawdziwe problemy.
- Wybierz `info`, gdy chcesz widzieć żądania i najważniejsze zdarzenia, ale bez zalewania konsoli.
- Wybierz `debug`, gdy potrzebujesz zobaczyć dokładny prompt wysłany do modelu oraz odpowiedź. Tekstu będzie bardzo dużo.

Żeby czytać szczegóły promptów i połączeń bez rutynowych logów żądań, zamiast poziomu ustaw preset:

```
LOG_PRESET=prompt-connections
```

Ten preset pokazuje te same szczegóły promptu i modelu co `debug`, ale ukrywa powtarzalne linie żądań w rodzaju `GET /api/chats`. Żeby wyciszyć wyłącznie te rutynowe linie żądań i zachować bieżący poziom, ustaw to i zrestartuj serwer:

```
LOG_DISABLE_REQUEST_LOGGING=true
```

Logowanie po stronie przeglądarki jest osobne i `LOG_LEVEL` nie ma na nie wpływu.

## Limity czasu

Limit czasu to najdłuższy czas, jaki serwer czeka na powolne zadanie, zanim je przerwie. Zadania multimedialne, takie jak generowanie obrazów i wideo, bywają powolne, więc ich limity są domyślnie wysokie. Wszystkie wartości limitów podaje się w milisekundach, chyba że nazwa mówi inaczej.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 minut) | Limit czasu na nagłówki dostawcy i pierwszy token oraz limit przerwy między fragmentami przy zwykłym generowaniu w trybach Conversation, Roleplay i Game, a także budżet czasu na pierwszy bajt dla generowania w tle, które nie ma własnego limitu (odświeżanie osi czasu w zakładce Noodle, odpowiedzi kont Noodler). Dozwolony zakres: `10000`-`3600000`. Nie zmienia limitów dla agentów, multimediów, embeddingów ani narzędzi. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 minut) | Górna granica łącznego czasu jednego wywołania modelu przez agenta (trackery, agent przebudowujący HTML i pozostali agenci), stosowana nawet wtedy, gdy odpowiedź wciąż się streamuje. Zwiększ ją dla powolnych modeli lokalnych, którym jedno przejście agenta zajmuje ponad 5 minut. Dozwolony zakres: `10000`-`3600000`. Agent Illustrator zachowuje co najmniej swój wbudowany budżet 30 minut. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 sekund) | Górna granica łącznego czasu wywołania modelu, które zamienia bieżącą scenę w trybie Game na dynamiczny prompt obrazu. Zwiększ ją dla wolniejszych modeli lokalnych. Dozwolony zakres: `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 minut) | Czas na jedno żądanie embeddingu. Wyższa wartość pomaga powolnym lokalnym serwerom embeddingów. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 minut) | Czas na jedno żądanie generowania obrazu. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 minut) | Czas na jedno żądanie generowania wideo sceny, łącznie z lokalnymi procesami wideo w ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Największe wideo sceny, jakie serwer przyjmie przy pobieraniu. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 minut, w sekundach) | Czas na jeden proces generowania obrazu w ComfyUI po jego zakolejkowaniu. |
| `SPRITE_GENERATION_TIMEOUT_MS` | wartość z `IMAGE_GEN_TIMEOUT_MS` | Czas na jedno zadanie generowania sprite'a przez AI. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 minuta) | Czas na jedno wywołanie własnego narzędzia. |
| `MAX_TOOL_ROUNDS` | `100` | Największa liczba rund wywołań narzędzi, po której model musi dać ostateczną odpowiedź. |

Limity czasu dla obrazów, wideo, sprite'ów i ComfyUI zostają ustalone przy starcie, więc ich zmiana wymaga restartu. Limity dla generowania czatu, agentów, dynamicznego promptu obrazu w trybie Game, embeddingów i własnych narzędzi działają od następnego żądania albo następnego przebiegu agenta, bez restartu. Wartości nieprawidłowe, zerowe, ujemne albo spoza zakresu w sprawdzanych limitach czatu, agenta i dynamicznego promptu obrazu w trybie Game powodują ostrzeżenie w logu i bezpieczny powrót do wartości domyślnych opisanych wyżej. Zwiększ limit multimedialny, gdy duże albo bardzo dokładne zadania przerywają się w połowie. Więcej o zadaniach wideo znajdziesz w przewodniku [Generowanie wideo sceny](media/scene-video.md).

## Uprzywilejowane API (ADMIN_SECRET)

Część działań jest niszcząca albo ryzykowna, więc poza zwykłymi sprawdzeniami dostępu wymaga dodatkowego sekretu. To na przykład kopie zapasowe, czyszczenie danych, wgrywanie aktualizacji i instalowanie motywów.

Ustaw na serwerze długą, losową wartość `ADMIN_SECRET`:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Na komputerze, na którym działa serwer (pętla zwrotna), te działania zwykle udają się bez sekretu. Z innego urządzenia aplikacja musi go wysłać. Wklej tę samą wartość w aplikacji w **Settings**, dalej **Advanced**, dalej **Admin Access** (dostęp administracyjny). Od tej pory aplikacja wysyła ją za ciebie.

Powiązane ustawienia uprzywilejowane:

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `ADMIN_SECRET` | pusta | Wspólny sekret wymagany przy działaniach uprzywilejowanych ze zdalnych urządzeń. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | Wartość `true` wymusza sekret nawet na komputerze lokalnym. |
| `UPDATES_APPLY_ENABLED` | `false` | Pozwala wgrywać zwykłe aktualizacje z tego samego kanału prosto z przeglądarki. Świadoma zmiana kanału wydań z przeglądarki na komputerze z serwerem działa bez tej flagi. Tylko instalacje oparte na Git. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Pozwala wgrać aktualizację ze zdalnego urządzenia, gdy poda ono prawidłowy sekret. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Pozwala sterować urządzeniem haptycznym ze zdalnego urządzenia, gdy poda ono prawidłowy sekret. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Włącza własne narzędzia skryptowe. Przy narzędziach niesprawdzonych lub zaimportowanych zostaw wyłączone. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Włącza ręczny podgląd i synchronizację repozytorium agentów z serwisu GitHub w menedżerze agentów. Agenci z zewnątrz są niesprawdzeni i wymagają wyraźnego potwierdzenia przed importem lub aktualizacją. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Pierwsza z dwóch bram dla importu rozszerzeń od osób trzecich. Użytkownik musi dodatkowo wyrazić zgodę w Settings → Advanced → Danger Zone. |
| `IMPORT_ALLOWED_ROOTS` | pusta | Foldery, które import zbiorczy może czytać bez tokena z okna wyboru plików. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Największy pojedynczy eksport profilu w formacie JSON, jaki serwer zbuduje. |

Jeśli `ADMIN_SECRET` nie jest ustawiony na serwerze, działania uprzywilejowane kończą się błędem na każdym urządzeniu poza komputerem lokalnym. Komunikat błędu podpowiada, żeby ustawić sekret i wkleić go w **Admin Access**.

## Zgody na adresy lokalne

Domyślnie żądania wychodzące do dostawców, usług obrazów i webhooków nie mogą sięgać adresów prywatnych ani lokalnych. Blokuje to rodzaj ataku zwany SSRF (server-side request forgery), w którym żądanie zostaje podstępem skierowane na adres wewnętrzny. Adresy dostawców na pętli zwrotnej pozostają dozwolone, żeby lokalne serwery modeli działały dalej.

Włącz tylko ten przełącznik, którego naprawdę potrzebujesz dla własnej usługi na innym komputerze w sieci prywatnej.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Pozwala adresom URL dostawców AI sięgać adresów prywatnych i sieci lokalnej. W systemie Android domyślnie włączone. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Pozwala adresom URL dostawców obrazów sięgać adresów prywatnych i sieci lokalnej. Prywatne adresy URL z wygenerowanymi obrazami i tak muszą zgadzać się dokładnie ze źródłem skonfigurowanego dostawcy. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Pozwala adresom URL syntezy mowy sięgać adresów prywatnych i sieci lokalnej. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Pozwala adresom URL tłumaczenia DeepLX sięgać adresów prywatnych i sieci lokalnej. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Pozwala webhookom własnych narzędzi sięgać adresów prywatnych i sieci lokalnej. |

Jak podłączyć model lokalny albo własny, opisuje przewodnik [Podłączanie modelu lokalnego lub samodzielnie hostowanego](connections/local-self-hosted.md).

## Pełna lista zmiennych środowiskowych

Ta sekcja wymienia pozostałe ustawienia, pogrupowane według przeznaczenia. Tabele powyżej obejmują już kontrolę dostępu, przechowywanie danych, logowanie, limity czasu, działania uprzywilejowane i zgody na adresy lokalne.

### Serwer i uruchamianie

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PORT` | `7860` | Port, na którym nasłuchuje serwer. W systemie Android, w kontenerze Docker i w środowisku Termux trzymaj tę samą wartość. |
| `HOST` | `127.0.0.1` (`0.0.0.0` w programach uruchamiających) | Interfejs sieciowy do nasłuchu. Do dostępu z sieci lokalnej użyj `0.0.0.0`. |
| `MARINARA_ANDROID_SECRET` | pusta | Wewnętrzny sekret uwierzytelniania lokalnego dla instalacji środowiska Termux zarządzanych przez plik APK. Nie jest daną wejściową instalatora: nakładka na system Android tworzy go i przekazuje, a program uruchamiający w środowisku Termux eksportuje automatycznie. Nie proś użytkowników APK o jego podanie ani nie ustawiaj go w zwykłych instalacjach komputerowych i ręcznych instalacjach środowiska Termux. Ustawiony sekret musi mieć dokładnie 64 znaki szesnastkowe. Nieprawidłowa, niepusta wartość powoduje błąd HTTP 503 dla lokalnych żądań urządzenia zamiast osłabienia uwierzytelniania. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Ścieżka do prywatnego pliku sekretu używanego przez program uruchamiający w środowisku Termux i lokalne narzędzie `mari` CLI. Plikiem automatycznie zarządzają APK i program uruchamiający; zwykli użytkownicy APK nigdy nie muszą go odczytywać ani kopiować. |
| `AUTO_OPEN_BROWSER` | `true` | Decyduje, czy programy uruchamiające otwierają adres aplikacji. Ustaw `false`, żeby tego nie robiły. Konfiguracja zarządzana przez APK wyłącza automatyczne otwieranie przeglądarki dla tego uruchomienia, aby połączyła się już uwierzytelniona aplikacja na Android. |
| `AUTO_UPDATE_ENABLED` | `true` | Decyduje, czy programy uruchamiające oparte na Git dla systemów Windows i macOS/Linux oraz dla środowiska Termux pobierają i wgrywają aktualizacje silnika przed startem. Ustaw `false`, żeby zrezygnować na stałe; zadziała to przy następnym uruchomieniu. Program uruchamiający nadal sprawdza w trybie tylko do odczytu, czy są nowsze opublikowane wydania, i wypisuje przypomnienie o pobraniu, gdy takie się pojawi. Ręczne sprawdzanie, wgrywanie z aplikacji, aktualizacje pakietów i aktualizacje modeli pozostają dostępne. Użyj `--skip-update`, żeby pominąć oba sprawdzenia przy jednym starcie. |
| `MARINARA_ENV_FILE` | plik `.env` w korzeniu projektu | Opcjonalna zmiana ścieżki do pliku `.env`. Ustaw ją przed startem. |
| `TZ` | domyślna systemowa | Zapasowa strefa czasowa komputera dla zadań po stronie serwera. Harmonogramy w trybie Conversation korzystają z globalnej strefy czasowej wybranej w swoich kontrolkach harmonogramu, o ile została zapisana. Zostaw `TZ` nieustawione, żeby dziedziczyć strefę czasową komputera; puste `TZ=` też liczy się jako nieustawione. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Źródła przeglądarki, którym wolno wysyłać żądania z innej domeny. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Flaga po starszych wersjach. Obecne wydania nie zawierają startowego klucza, więc nic nie tworzy. Dodaj własne połączenie w aplikacji. |

Zmienna `AUTO_CREATE_DEFAULT_CONNECTION` została tylko ze względu na starsze instalacje. Nowe wydania nie mają już dołączonego połączenia startowego, więc pozostawienie jej włączonej nic nie zmienia. Żeby zacząć rozmawiać, dodaj połączenie zgodnie z przewodnikiem [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).

Kontrolki harmonogramu w trybie Conversation przyjmują domyślnie strefę czasową zgłoszoną przez przeglądarkę albo urządzenie z aplikacją. Ustawienie **Schedule timezone** (strefa czasowa harmonogramu) można zmienić przy konfiguracji trybu Conversation, w panelu Chat Settings dla trybu Conversation albo w edytorze harmonogramu postaci. Wybrana strefa czasowa IANA to jedno globalne ustawienie, wspólne dla wszystkich czatów w trybie Conversation i synchronizowane z innymi klientami Marinara podłączonymi do tego samego serwera.

### Multimedia i narzędzia do sprite'ów

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `FFMPEG_PATH` | pusta | Ścieżka do programu `ffmpeg`. Służy do animowanych plików GIF z wyrazami twarzy. W razie braku używany jest `ffmpeg` ze zmiennej PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minuty) | Czas na przetworzenie jednego animowanego klipu z wyrazem twarzy. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | Mechanizm czyszczenia sprite'ów. `auto` najpierw próbuje adaptacyjnego czyszczenia maski, a dopiero potem opcjonalnego wsparcia AI; `builtin` zostawia samą ścieżkę maski; `backgroundremover` wymusza narzędzie AI. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | Wartość `true` instaluje przy starcie opcjonalne narzędzie AI do usuwania tła. |
| `BACKGROUNDREMOVER_COMMAND` | pusta | Ścieżka do systemowego programu `backgroundremover`. |
| `BACKGROUNDREMOVER_PYTHON` | pusta | Ścieżka do programu Python, w którym zainstalowano `backgroundremover`. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 minut) | Czas na jedno wywołanie usuwania tła przez AI. |

### Dostawcy wideo sceny

Dostawców wideo sceny konfiguruje się jako połączenia w aplikacji, a nie jako zmienne środowiskowe. Ustawienia poniżej tylko dostrajają same zadania. Wszystkie wartości podaje się w milisekundach.

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często serwer sprawdza zadanie Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | Jak często serwer sprawdza zadanie xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często serwer sprawdza zadanie wideo w OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Jak często serwer sprawdza zadanie Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | pusta | Publiczny adres HTTPS tego serwera, używany wtedy, gdy dostawca musi pobrać obraz odniesienia po adresie URL. |

### Integracje i dodatki

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `DOCS_I18N_BASE_URL` | oficjalna gałąź `docs-i18n` | Miejsce, z którego pobierają się pakiety przetłumaczonej dokumentacji (Settings → General → Documentation Language). Musi to być publiczny host `https://`; forki i kopie mogą wskazać własną wersję gałęzi `docs-i18n`. |
| `GIPHY_API_KEY` | pusta | Klucz Giphy do wyszukiwania plików GIF w trybie Conversation. Bez niego wyszukiwanie jest wyłączone. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Domyślny adres aplikacji haptycznej Intiface. |
| `SPOTIFY_REDIRECT_URI` | wyliczany z żądania | Zmiana adresu zwrotnego logowania Spotify. Ustaw go, gdy TLS obsługuje warstwa przed serwerem. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Największa treść strony wiki, jaką asystentka Professor Mari czyta przed skróceniem. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Czas na jedno żądanie do wiki od asystentki Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Jak długo asystentka Professor Mari trzyma w pamięci podręcznej odczyt z wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (program uruchamiający dla Windows ustawia `true`) | Pozwala zainstalować środowisko modelu lokalnego bez nagłówka administracyjnego na pętli zwrotnej. |
| `SSL_CERT` | pusta | Ścieżka do certyfikatu TLS. Zobacz sekcję Kontrola dostępu powyżej. |
| `SSL_KEY` | pusta | Ścieżka do klucza prywatnego TLS. Zobacz sekcję Kontrola dostępu powyżej. |

Co do klucza Giphy: wyszukiwanie plików GIF pozostaje niedostępne, dopóki nie ustawisz `GIPHY_API_KEY` i nie zrestartujesz serwera. O wbudowanym modelu lokalnym opowiada przewodnik [Konfiguracja modelu Local Model](connections/local-model.md).

## Powiązane przewodniki

- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](REMOTE_ACCESS.md)
- [Gdzie Marinara przechowuje dane](data/where-data-is-stored.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
- [Generowanie wideo sceny](media/scene-video.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md)
