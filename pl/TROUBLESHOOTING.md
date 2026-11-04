# Rozwiązywanie problemów w aplikacji Marinara Engine

Znajdź swój objaw i wykonaj opisaną naprawę. Większość problemów znika po ponownym uruchomieniu aplikacji Marinara przez jej program uruchamiający (`start.bat`, `start.sh` lub `start-termux.sh`).

## Od czego zacząć

1. Odśwież stronę z pominięciem pamięci podręcznej: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> w systemie Windows lub Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> na komputerze Mac.
2. Zajrzyj do konsoli serwera (okna terminala, w którym działa Marinara) i poszukaj czerwonych linii z błędami. Zwykle nazywają one prawdziwy problem.
3. Jeśli chcesz poprosić o pomoc, najpierw włącz **Debug mode** (tryb diagnostyczny). Zobacz [Uzyskiwanie dalszej pomocy](#get-more-help).

<a id="my-character-does-not-reply"></a>

## Postać nie odpowiada

Sprawdź po kolei poniższe punkty.

1. Poszukaj powiadomienia (krótkiego komunikatu na dole ekranu). Zwykle nazywa ono problem. Zobacz [Błędy połączeń i generowania](#connection-and-generation-errors).
2. Sprawdź, czy czat ma konto i model: otwórz **Chat Settings** (ustawienia czatu) i spójrz na połączenie. Jeśli połączenia nie ma, dodaj konto w panelu **Connections** (Połączenia). Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md).
3. Sprawdź, czy klucz API jest poprawny i czy na koncie są środki. Błędny klucz albo puste saldo to częsta przyczyna.
4. Sprawdź nazwę modelu, a przy serwerze lokalnym, takim jak Ollama albo LM Studio, to, czy serwer działa.
5. Wyślij wiadomość jeszcze raz albo wybierz inny model.

Jeśli nic nie pomaga, włącz **Debug mode** i przeczytaj konsolę serwera. Zobacz [Uzyskiwanie dalszej pomocy](#get-more-help).

## Aplikacja nie wczytuje się na telefonie / innym urządzeniu

Nie możesz otworzyć aplikacji Marinara na telefonie, tablecie albo innym komputerze?

Najczęściej chodzi o jedną z tych trzech rzeczy:

- **Adres.** Domyślnie serwer nasłuchuje na `127.0.0.1` (tylko ten komputer). Programy uruchamiające ustawiają `HOST=0.0.0.0`. Przy starcie poleceniem `pnpm start` najpierw ustaw `HOST=0.0.0.0` w pliku `.env`.
- **Sieć.** Oba urządzenia muszą być w tej samej sieci Wi-Fi, a żadna zapora sieciowa nie może blokować portu. Domyślny port to `7860` albo ten ustawiony w `PORT`.
- **Logowanie.** Ustaw je. Na zablokowanym urządzeniu wpisz jednorazowy kod konfiguracji z logu serwera razem z nową nazwą użytkownika i hasłem. W kontenerze Docker znajdziesz kod poleceniem `docker logs <container> 2>&1 | grep "setup code"`. Możesz też ustawić logowanie w **Settings → Advanced → Access** (ustawienia, zaawansowane, dostęp) w przeglądarce, która jest już zalogowana. Na serwerze bez interfejsu graficznego uruchom `ssh -L 7860:127.0.0.1:7860 user@server`, otwórz `http://localhost:7860` i użyj **Settings** (Ustawienia). Zobacz [Dostęp zdalny](REMOTE_ACCESS.md#option-1-login-recommended).

Więcej przyczyn:

- **Proxy albo tunel na tym samym komputerze.** Odwrotne proxy albo tunel na tym samym komputerze wymaga logowania. Bezpośredni ruch przez Tailscale jest domyślnie zaufany. Tailscale Serve lub Funnel oraz domyślne `proxy_pass` HTTP/1.0 w nginx liczą się jako ruch przekazywany i wymagają logowania. Ruch przez mostek Docker na tym samym hoście jest zaufany tylko dopóty, dopóki nie ustawiono logowania, `IP_ALLOWLIST` ani `TRUSTED_AUTH_PROXY`.
- **Własna nazwa tego komputera.** Nazwa, która w `/etc/hosts` wskazuje na `127.0.0.1`, liczy się jako ruch przekazywany. Zamiast niej użyj `localhost`, `127.0.0.1`, nazwy hosta komputera albo nazwy `*.localhost`.
- **Too many wrong passwords** (zbyt wiele błędnych haseł). Odczekaj 15 minut, a potem się zaloguj. Nie pamiętasz hasła? Uruchom `node scripts/reset-login.mjs` w folderze aplikacji Marinara na komputerze, na którym działa Marinara. W kontenerze Docker uruchom `docker exec <container> node scripts/reset-login.mjs`. Ponowną próbę umożliwia też restart serwera.
- **Untrusted request host** (niezaufany host żądania). W przypadku domeny publicznej albo domeny odwrotnego proxy dopisz jej dokładną nazwę hosta do `TRUSTED_HOSTS` w pliku `.env`. Bezpośrednie adresy IP są nadal akceptowane.
- **Zablokowane ryzykowne działania** (kopie zapasowe, czyszczenie danych, aktualizacje) z tego urządzenia. Na komputerze, na którym działa serwer, otwórz **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny) i kliknij **Make admin secret** (utworzenie sekretu administratora) albo ustaw `ADMIN_SECRET` w pliku `.env` serwera. Wpisz sekret w **Admin Access** na drugim urządzeniu i kliknij **Save** (zapis).

Zobacz [Dostęp zdalny](REMOTE_ACCESS.md) i [Najczęściej zadawane pytania](FAQ.md). Jeśli po aktualizacji dostęp został zablokowany, zobacz [Zablokowany dostęp po aktualizacji](REMOTE_ACCESS.md#locked-out-after-updating).

## Zablokowany zapis lub ustawienia, które nie zostają

Zapis niby się udaje, ale po przeładowaniu wraca stara wartość. Blokuje go ochrona przed żądaniami z innych witryn (CSRF), bo nie ufa temu adresowi przeglądarki. Widzisz czerwony baner z ostrzeżeniem, że zapisy będą po cichu przepadać, albo powiadomienie o tytule **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** lub **Save blocked: origin not trusted**.

Pętla zwrotna, adresy sieci prywatnych, Tailscale i mostek Docker są zaufane automatycznie. Problem dotyczy głównie publicznego adresu IP albo nazwy domeny. Dopisz adres do `CSRF_TRUSTED_ORIGINS` w pliku `.env`, oddzielając kolejne adresy przecinkami. Baner ma przycisk **Copy** (kopiowanie), który wpisuje gotową linię. Restart nie jest potrzebny.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## Błędy połączeń i generowania

Błędy generowania pojawiają się jako powiadomienie na dole ekranu. Podaje ono przyczynę i zostaje na ekranie wystarczająco długo, żeby dało się je skopiować.

| Komunikat lub objaw | Rozwiązanie |
| --- | --- |
| **No API connection configured for this chat** | Czat nie ma konta. Dodaj je w panelu **Connections**, a potem wybierz je dla czatu. Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md). |
| Model nie przyjmuje jakiegoś parametru | Otwórz **Chat Settings → Advanced Parameters** (ustawienia czatu, parametry zaawansowane) i wyłącz przełącznik obok parametru, który podaje powiadomienie. |
| Model zgłasza, że parametr jest wymagany | Włącz przełącznik tego parametru. |
| **This model's chat template needs user and assistant messages to take turns** | Niektóre modele lokalne, na przykład modele z rodziny Mistral uruchamiane przez llama.cpp, wymagają wiadomości na przemian. Marinara łączy wiadomości następujące bezpośrednio po sobie i jeden raz próbuje ponownie. Jeśli problem nie znika, ustaw **Post-Processing Messages** (przetwarzanie wiadomości) na **Single User Message** (jedna wiadomość użytkownika) w **Chat Settings → Advanced Parameters** albo udostępnij model z mniej restrykcyjnym szablonem czatu. |
| **The AI returned an empty response. Try sending your message again.** | Wyślij wiadomość ponownie. Jeśli to się powtarza, spróbuj innego modelu albo konta. |
| **A generation is already in progress for this chat** | Odpowiedź wciąż się generuje. Poczekaj albo kliknij **Stop** (zatrzymaj), a potem spróbuj ponownie. |
| **No connections are marked for the random pool** | Losowe kierowanie jest włączone, ale w puli nie ma żadnego konta. Dodaj konto albo wyłącz losowe kierowanie. |
| Każda wiadomość kończy się błędem sieci, a komputer łączy się z internetem tylko przez proxy | Wskaż to proxy aplikacji Marinara. Zobacz [Wychodzące proxy HTTP](CONFIGURATION.md#outbound-http-proxy). |

## Po aktualizacji

Problemy tuż po aktualizacji, najpierw w prostych słowach:

- Ekran jest pusty albo wygląda staro: zobacz [Pusty, nieodświeżony lub staro wyglądający ekran](#blank-stale-or-old-looking-screen) oraz [Pusta strona lub JavaScript zwracany jako HTML po aktualizacji](#blank-page-or-javascript-served-as-html-after-an-update).
- Czaty albo presety wyglądają na zniknięte: zobacz [Po aktualizacji wydaje się, że brakuje danych](#data-seems-missing-after-an-update). Dane prawie zawsze nadal są na dysku.
- Czaty wyglądają na puste po powrocie do starszej wersji: zobacz [Po przejściu na starszą wersję czaty nie pokazują wiadomości](#chats-show-no-messages-after-switching-to-an-older-version).

<a id="blank-stale-or-old-looking-screen"></a>

### Pusty, nieodświeżony lub staro wyglądający ekran

Serwer działa, ale przeglądarka pokazuje pustą stronę albo aplikacja po aktualizacji wygląda staro. Przeglądarka trzyma kopię aplikacji internetowej zapisaną w pamięci podręcznej.

1. Odśwież stronę z pominięciem pamięci podręcznej.
2. Jeśli to nie pomaga, otwórz **Settings → Advanced → Updates** (ustawienia, zaawansowane, aktualizacje) i kliknij **Refresh App** (odświeżenie aplikacji).

**Refresh App** czyści service worker przeglądarki (skrypt działający w tle, który zapisuje aplikację w pamięci podręcznej) oraz pamięć podręczną, a potem przeładowuje stronę. Nie zmienia danych i nie aktualizuje serwera. Aby zaktualizować samą aplikację, zobacz [Aktualizacja aplikacji Marinara Engine](UPGRADING.md).

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### Pusta strona lub JavaScript zwracany jako HTML po aktualizacji

Błąd taki jak "Failed to load module script" z typem `text/html` oznacza, że przeglądarka zażądała pliku JavaScript, którego brakuje w kompilacji. Usunięcie danych tego nie naprawi.

1. Zatrzymaj serwer.
2. Uruchom ponownie `start.bat`, `start.sh` lub `start-termux.sh`. Program uruchamiający przed startem odbudowuje niekompletne pliki klienta. Przy instalacji ręcznej najpierw wykonaj `pnpm build` w głównym folderze repozytorium.
3. Jeśli strona nadal jest pusta, odśwież ją z pominięciem pamięci podręcznej albo spróbuj w prywatnym oknie przeglądarki.

Jeśli nadal się nie udaje, zgłoś pełny URL pliku, którego nie udało się wczytać, status HTTP, Content-Type i pierwszy wiersz odpowiedzi, razem z wynikiem programu uruchamiającego.

<a id="data-seems-missing-after-an-update"></a>

### Po aktualizacji wydaje się, że brakuje danych

Nie usuwaj żadnych folderów z danymi. Marinara trzyma bieżące dane w folderze `storage` wewnątrz swojego folderu z danymi. Poszukaj folderu `storage` w `packages/server/data/` i w `data/`. Serwer wypisuje przy starcie foldery, które rozpoznał.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### Po przejściu na starszą wersję czaty nie pokazują wiadomości

Nowsze wersje aplikacji Marinara przechowują rekordy każdego czatu (wiadomości, swipe'y, wspomnienia, obrazy) w osobnych plikach, dzięki czemu zapisywanie długich czatów jest szybsze. Starsze wersje nie potrafią odczytać takiego układu, więc czaty wyglądają na puste. Dane nadal są na dysku.

Marinara blokuje oczywiste obniżenia wersji. Program uruchamiający pomija automatyczną aktualizację, która prowadziłaby do niezgodnej wersji, a aktualizator w aplikacji pokazuje błąd odsyłający tutaj.

Jeśli po aktualizacji wrócono do starszej wersji, przywróć kopię zapasową zrobioną przed tą aktualizacją. Zobacz [Powrót do starszej wersji](UPGRADING.md#downgrading-to-an-older-version). Szczegóły techniczne znajdziesz poniżej.

Twoje dane mają teraz format przechowywania 10. Formaty 8, 9 i 10 dodają ustawienia awatarów 3D (najpierw MMD, potem GLB i FBX) oraz powiązania połączeń z kontami, których starsze kompilacje nie potrafią bezpiecznie odczytać. Jeśli twoje dane osiągnęły format 8 lub nowszy, a chcesz użyć starszej kompilacji, przywróć pełną kopię zapasową zrobioną przed tą aktualizacją. Poniższe polecenie przekształca tylko starsze układy plików czatu. Nie zmieniaj ręcznie numeru formatu. Zobacz [Powrót do starszej wersji](UPGRADING.md#downgrading-to-an-older-version).

W przypadku danych w formacie niższym niż 8 przekształć układ plików czatu:

1. Zatrzymaj serwer aplikacji Marinara.
2. W folderze aplikacji Marinara uruchom:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Przejdź na starszą wersję i uruchom ją.

Polecenie odtwarza układ pojedynczych plików z plików poszczególnych czatów. Niczego nie usuwa. Pliki poszczególnych czatów pozostają w folderach o nazwach `<table>.post-unshard-<timestamp>`, a wszystkie oryginały `.pre-shard` również zostają. Przy ponownej aktualizacji Marinara przekształci dane z powrotem.

W kontenerze Docker lub Podman dane znajdują się w wolumenie `marinara-data`. Zatrzymaj kontener, wykonaj poniższe polecenie, a potem uruchom starszy obraz:

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Problemy z instalacją i uruchamianiem

### Termux: CANNOT LINK EXECUTABLE "node"

Środowisko Termux wypisuje `CANNOT LINK EXECUTABLE "node"` razem z `cannot locate symbol` lub `library ... not found`. Node.js zaktualizowano bez reszty pakietów środowiska Termux. Aplikacja na system Android może się wtedy zatrzymać z komunikatem **Could not verify that this Marinara Android build can safely read your stored data**. Przyczyną nie są twoje dane, a ponowna instalacja pliku APK tego nie naprawi.

1. W środowisku Termux uruchom:

   ```bash
   pkg upgrade -y
   ```

2. Dotknij **Install / Start Marinara** (instalacja i uruchomienie) w aplikacji na system Android. Przy instalacji ręcznej uruchom `cd "$HOME/Marinara-Engine" && ./start-termux.sh`.

Jeśli aktualizacja zapyta, czy zachować plik konfiguracyjny, naciśnij Enter, żeby zachować obecny. Aktualne programy uruchamiające i aplikacje na system Android same przeprowadzają tę aktualizację.

### Termux: brak pamięci podczas budowania klienta

Vite zatrzymuje się z `Reached heap limit` lub `JavaScript heap out of memory`. Zaktualizuj aplikację, a potem ponownie uruchom `./start-termux.sh`. Budowanie klienta korzysta z własnej sterty 1536 MiB, ograniczonej do połowy pamięci RAM urządzenia, ale nigdy mniejszej niż 1280 MiB. Ustawiony przez ciebie limit sterty w `NODE_OPTIONS` ma pierwszeństwo, więc usuń stare ograniczenie 1024 MiB. Przed ponowną próbą zamknij inne aplikacje. Na telefonach z mniej niż około 3 GB RAM nadal może zabraknąć pamięci. Nie usuwaj czatów ani profilu, aby naprawić błąd budowania.

### Komputer: brak pamięci podczas sprawdzania typów klienta

Budowanie zatrzymuje się z komunikatem `The client type-check needs about 2.5 GiB of Node.js heap`. Limit w `NODE_OPTIONS` jest za mały, a budowanie zachowuje ustawiony przez ciebie limit. Zwiększ `--max-old-space-size` do 2560 lub więcej. Jeśli `NODE_OPTIONS` zawiera `--max-old-space-size-percentage`, zwiększ tę wartość, bo ma ona pierwszeństwo przed drugą opcją. Możesz też usunąć obie opcje. Potem ponownie uruchom program uruchamiający. Dane pozostają nienaruszone.

### Termux: brak pliku klienta gościa w trybie wieloosobowym

Uruchamianie zgłasza brak pliku `packages/client/dist/multiplayer/guest.js`. Zaktualizuj aplikację Marinara i ponownie uruchom `./start-termux.sh`, który wykonuje pełne budowanie klienta. Nie musisz włączać trybu wieloosobowego.

### Termux: serwer zatrzymuje się po otwarciu aplikacji Marinara albo Sharp nie może się załadować

Sharp to biblioteka obrazów, której Marinara używa do tworzenia miniatur i sprite'ów. W systemie Android działa przez zapasowy mechanizm oparty na WebAssembly. Zaktualizuj aplikację Marinara i pozwól programowi uruchamiającemu ponownie zainstalować zależności. Jeśli serwer zatrzymuje się, zanim zdążysz przeprowadzić aktualizację, napraw instalację ręcznie w środowisku Termux:

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Czaty i ustawienia pozostają nienaruszone. Jeśli Sharp nadal nie może się załadować, Marinara działa dalej z wyłączonym przetwarzaniem obrazów. Istniejące miniatury nadal się wyświetlają, zamiast nowych pojawia się obraz w pełnym rozmiarze, a generowanie sprite'ów i wbudowane usuwanie tła są niedostępne. Nie zastępuj biblioteki Sharp inną wersją. Zachowaj pełny komunikat błędu do zgłoszenia.

<a id="browser-opens-before-startup-finishes"></a>

### Przeglądarka otwiera się przed zakończeniem uruchamiania

Zaktualizuj aplikację i uruchom ją ponownie przez program uruchamiający. Otwiera on przeglądarkę dopiero wtedy, gdy serwer zgłosi gotowość. Jeśli start się nie powiedzie, żadna karta się nie otworzy, więc zachowaj błąd z terminala. Aby otwierać aplikację samodzielnie, ustaw `AUTO_OPEN_BROWSER=false`.

### Windows: błąd EPERM lub błąd podpisu corepack przy instalacji pnpm

pnpm to menedżer pakietów, którym Marinara instaluje swój kod. Komunikat `EPERM: operation not permitted` albo błąd podpisu corepack oznacza, że corepack nie mógł zapisać danych w folderze instalacji Node. Wypróbuj jedno z rozwiązań, a potem ponownie uruchom program uruchamiający:

1. Kliknij terminal prawym przyciskiem myszy, wybierz **Run as administrator** (uruchom jako administrator) i uruchom program uruchamiający.
2. Zainstaluj pnpm samodzielnie: `npm install -g pnpm@12.15.0`
3. W terminalu administratora zaktualizuj corepack: `npm install -g corepack`

### Błąd wersji pnpm albo `'pnpm' is not recognized`

Marinara używa pnpm 12.15.0. Program uruchamiający pobiera właściwą wersję za ciebie, a starszej, globalnej instalacji pnpm nie trzeba najpierw zastępować. Zaktualizuj aplikację Marinara (`git pull` w jej folderze, jeśli program uruchamiający tego nie potrafi), a potem ponownie uruchom program uruchamiający. Jeśli nadal się nie udaje, zainstaluj dokładną wersję i ponownie uruchom program uruchamiający:

```bash
npm install -g pnpm@12.15.0
```

### Linux: ERR_PNPM_ENAMETOOLONG podczas instalacji

Po starszej instalacji zostały długie ścieżki folderów. W folderze aplikacji Marinara uruchom:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Potem ponownie uruchom `./start.sh`. Przy instalacji ręcznej wykonaj `pnpm install`.

### Instalacja pokazuje "Ignored build scripts: @google/genai"

Ten komunikat jest nieszkodliwy. Nie uruchamiaj `pnpm approve-builds`, bo zmienia to plik śledzony przez aplikację Marinara. Jeśli komunikat nadal pojawia się po aktualizacji, usuń `node_modules/.modules.yaml` w folderze aplikacji Marinara i ponownie uruchom program uruchamiający.

### ERR_PNPM_TRUST_DOWNGRADE podczas instalacji

To prawie zawsze skutek niedokończonej instalacji. Ponownie uruchom program uruchamiający. Przy instalacji ręcznej wykonaj to polecenie w folderze aplikacji Marinara:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Problemy z wbudowanym modelem

**Built-in model** (model wbudowany) działa na twoim komputerze bez klucza API. Niektóre komunikaty o błędach nazywają go sidecar. Konfigurację opisuje przewodnik [Konfiguracja modelu wbudowanego](connections/local-model.md).

- **Sidecar runtime install is disabled.** Na własnym komputerze ustaw `SIDECAR_RUNTIME_INSTALL_ENABLED=true` w pliku `.env`. Z innego urządzenia najpierw zapisz sekret administratora w **Settings → Advanced → Admin Access**.
- **Pobieranie modelu albo konfiguracja zawodzi z innego urządzenia** (adres sieciowy lub kontener Docker). Również tu może być potrzebny sekret administratora. Na własnym komputerze nie jest wymagany.
- **Niezgodność rozmiaru lub sumy SHA-256** w dołączonym pliku llama.cpp, MLX albo uv. Marinara odrzuciła plik, zanim go użyła. Zaktualizuj albo zainstaluj ponownie aplikację Marinara i spróbuj jeszcze raz. Nie rozpakowuj, nie edytuj i nie omijaj tego pliku.

## Pamięć i podsumowania

### Funkcja Memory Recall niczego nie przywołuje

**Memory Recall** przeszukuje wcześniejsze wiadomości i dodaje najbardziej pasujące z powrotem do promptu (tekstu, który Marinara wysyła do AI).

1. Otwórz **Chat Settings → Memory Recall** i sprawdź, czy przełącznik **Enable Memory Recall** (włączenie Memory Recall) jest włączony.
2. Otwórz **Access memories for this chat** (dostęp do wspomnień tego czatu). W oknie **Memories for This Chat** (wspomnienia tego czatu) sprawdź status każdego fragmentu.
3. **Waiting for vector** oznacza, że wspomnienie jest jeszcze przetwarzane. Poczekaj, a potem napisz kolejną wiadomość.
4. **Embedding unavailable** oznacza, że żadne źródło embeddingów nie działa. Skonfiguruj konto do embeddingów albo pozwól wczytać wbudowany model. Aby używać jednego źródła we wszystkich czatach, wybierz je w polu **Embeddings** (embeddingi) w sekcji **Defaults** (ustawienia domyślne) panelu **Connections**.

Wspomnienie powstaje dopiero po co najmniej 5 nowych wiadomościach. Funkcja pokazuje tylko wspomnienia, które mocno pasują do nowej wiadomości, więc może nie zwrócić nic nawet wtedy, gdy wspomnienia istnieją.

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory zgłasza sceny wymagające uwagi

Stale świecąca kropka na przycisku **Chat Settings** albo powiadomienie o problemach wykrytych przez Advanced Memory oznacza, że niektóre wspomnienia scen są niejasne, nieaktualne lub ich brakuje.

1. Otwórz **Chat Settings → Memory Recall** albo kliknij **Fix** (napraw) w powiadomieniu.
2. Kliknij **Fix**. Naprawia każdą scenę, którą da się naprawić modelem pomocniczym (Helper model), i nigdy nie zmienia podsumowań edytowanych przez ciebie.
3. Wybierz numer każdej sceny pod **need your review** (do twojego sprawdzenia), sprawdź jej tekst i postacie w **Access memories for this chat** i kliknij **Save correction** (zapisz poprawkę).

Jeśli **Fix** zatrzyma się z błędem, sprawdź konto modelu pomocniczego, a potem kliknij **Resume processing** (wznów przetwarzanie) albo ponownie **Fix**. Zobacz [Naprawianie problemów z pamięcią](agents/memory.md#fixing-memory-problems).

### Podsumowania nie powstają

Podsumowania wymagają działającego konta tekstowego.

- Tryb Roleplay: otwórz **Chat Settings → Chat Summary** i sprawdź, czy konto jest ustawione. Przyciskiem **Backfill Summary** (uzupełnienie podsumowania) nadrobisz starszy czat.
- Tryb Conversation: otwórz **Automatic Summarization** (automatyczne podsumowywanie) i przyciskiem **Backfill** (uzupełnienie) ponów nieudane dni.
- Jeśli czat wymaga zatwierdzania zapisów agenta, podsumowanie od AI czeka na twoje sprawdzenie.
- Podsumowanie, które ciągle zawodzi, na przykład przez błędny klucz API, jest ponawiane później. Napraw konto, a potem użyj przycisku **Backfill**.

## Problemy z agentami do pobrania

- **Katalog niedostępny w sekcji Agent Organizer.** Komputer, na którym działa serwer, a nie tylko przeglądarka, musi mieć dostęp do katalogu [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) przez HTTPS. Zainstalowani agenci działają dalej offline. Przywróć połączenie, a potem kliknij **Refresh** (odświeżenie) lub **Try again** (ponowna próba).
- **Zainstalowana mapa lub rozmowa się nie pojawia.** Zamknij aplikację Marinara całkowicie i uruchom ją ponownie. Te pakiety pozostają w stanie **Restart required** (wymagany restart) aż do następnego uruchomienia. Gry do trybu Conversation aktywują się od razu. Jeśli instalacja się nie powiodła, odśwież katalog i sprawdź, czy gra jest oznaczona jako gotowa. Dodawanie gry w ustawieniach **Commands** (komendy) czatu jest potrzebne tylko po to, żeby postacie mogły same ją rozpocząć, a nie do jej ręcznej komendy slash.
- **Pierwsza migracja pakietów nie może się zakończyć.** Nie usuwaj folderu `data/capability-packages` ani danych czatów. Marinara ponowi migrację przy następnym uruchomieniu, a wybory w czatach pozostają zapisane.
- **Duży folder `data/capability-runtime-snapshots` lub `data/capability-packages/versions`.** Czyszczenie nie jest potrzebne. Marinara usuwa stare kopie przy uruchomieniu i zachowuje bieżącą oraz poprzednią wersję każdego agenta.
- **Pobierany pakiet zostaje odrzucony.** Suma kontrolna, lista plików, zakres wersji aplikacji Marinara albo ścieżki w archiwum nie zgadzają się z oficjalnym katalogiem. Zaktualizuj aplikację Marinara, odśwież katalog i spróbuj ponownie. Nie wypakowuj artefaktu ręcznie do folderu z danymi.
- **Aktualizacje.** Aktualizacje agentów nigdy nie instalują się przy starcie. Marinara najpierw pyta. **Not now** (nie teraz) zachowuje zainstalowaną wersję, a przycisk **Update** (aktualizacja) pozostaje dostępny w **Agents → Agent Organizer** (agenci, organizowanie agentów). Nieudana aktualizacja zostawia zainstalowaną wersję na miejscu. Środowisko serwera, które nie przejdzie testu przy starcie, wraca do poprzedniej wersji.

## Problemy z panelem Card Browser

Panel **Card Browser** (przeglądarka kart) przeszukuje publiczne serwisy z postaciami. Otwórz go przyciskiem **Download** (pobranie) u góry panelu **Characters** (postacie) albo **Personas** (persony).

- **Serwis JannyAI pokazuje blokadę Cloudflare.** Odwiedź raz stronę JannyAI w tej samej przeglądarce, żeby przejść weryfikację, a potem spróbuj ponownie.
- **Logowanie do serwisu Pygmalion przestaje działać po restarcie.** Tak ma być. Te dane logowania żyją wyłącznie w pamięci serwera. Otwórz okno logowania i wklej token jeszcze raz.
- **Źródło CharacterTavern pokazuje komunikat zamiast wyników.** Tak ma być. Nowa strona tego serwisu nie udostępnia już połączenia, z którego korzystała Marinara. Pobierz kartę ze strony character-tavern.com i zaimportuj plik.

## Problemy z generowaniem multimediów

### Czyszczenie tła sprite'a nie radzi sobie ze złożoną sceną

Wygenerowane sprite'y zwykle korzystają z natywnej przezroczystości albo z jednolitego tła, które Marinara usuwa. Zdjęcie pokoju, szczegółowe otoczenie, mocne cienie albo kolory zbliżone do tła mogą wymagać opcjonalnego mechanizmu awaryjnego opartego na AI:

```bash
pnpm backgroundremover:install
```

Potem uruchom aplikację Marinara ponownie i kliknij **Reapply Cleanup** (ponowne czyszczenie) w oknie generowania sprite'ów. Marinara najpierw próbuje wbudowanego czyszczenia, a model AI włącza tylko wtedy, gdy krawędź nie wygląda jednolicie. Jeśli instalacja się nie powiedzie:

- Sprawdź, czy jest zainstalowany Python w wersji od 3.9 do 3.11. Nowsze wersje mogą wymusić powolne kompilowanie natywne.
- Uruchom `pnpm backgroundremover:reinstall`.
- Aby na czas diagnozy pominąć mechanizm awaryjny AI, ustaw `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` w pliku `.env`.

### Storyboardy w trybie Game Mode lub Roleplay się nie pojawiają

Storyboardy zamieniają zakończoną narrację w obrazy klatek kluczowych i opcjonalne klipy. Zobacz [Przewodnik po agencie Storyboard](game/storyboard.md) i [Game Mode: pierwsze kroki](game/getting-started.md).

- Zainstaluj agenta **Storyboard** z **Agents → Agent Organizer**, a potem włącz dla czatu **Enable Agents** (włączenie agentów) i **Enable Storyboards** (włączenie storyboardów).
- Klatki kluczowe wymagają konta do generowania obrazów. Klipy wymagają dodatkowo konta wideo.
- Tryb Game Mode, storyboardy automatyczne: otwórz **Chat Settings → Agents → Storyboards** i sprawdź, czy **Automatic Storyboard Illustrations** jest włączone. Jeśli mają powstawać klipy, włącz **Automatic Storyboard Animations**.
- Ręczne wideo sceny: otwórz **Chat Settings → Gallery** (ustawienia czatu, galeria), wygeneruj lub wgraj obraz, a potem użyj **Video** (wideo) albo **Animate** (animuj). Sprawdź zakładkę **Videos** (filmy).
- Tryb Roleplay: dodaj do czatu agenta **Storyboard**. Wybierz **Still images** (obrazy statyczne) albo **Animations** (animacje), ustaw **Messages per episode** (wiadomości na odcinek) i wybierz konto do generowania obrazów. Opcja **Manual only** (tylko ręcznie) uruchamia storyboard przyciskiem **Create storyboard** (utworzenie storyboardu) w sekcji **Gallery** w **Chat Settings**.
- Jeśli własny prompt działa lepiej ze wszystkimi postaciami naraz, wyłącz **Use NovelAI Character Prompts**.
- Wolne usługi mogą przekroczyć limit czasu. Zwiększ `IMAGE_GEN_TIMEOUT_MS` lub `VIDEO_GEN_TIMEOUT_MS` w pliku `.env`, a potem uruchom aplikację Marinara ponownie.
- `Outbound response exceeded 31457280 bytes`: odpowiedź z obrazem większa niż 30 MiB domyślnie kończy się błędem. Taki rozmiar mogą osiągnąć pliki ComfyUI, które zapisują w sobie workflow i obrazy referencyjne. Zwiększ `IMAGE_GEN_MAX_RESPONSE_BYTES` w pliku `.env` i uruchom aplikację ponownie albo wyłącz metadane w ComfyUI.

### Generowanie świata w trybie Game Mode pokazuje błąd JSON

Jeśli model zwróci uszkodzony JSON (ustrukturyzowany tekst), Marinara otwiera okno **Repair JSON** (naprawa formatu JSON), zamiast odrzucać turę.

1. Popraw w edytorze nawiasy, przecinki lub pola. Gdy tekst da się poprawnie odczytać, baner pokazuje **JSON is valid.**
2. Kliknij **Format** (formatuj), żeby uporządkować układ.
3. Kliknij **Apply Repaired JSON** (zastosowanie naprawionego JSON), żeby użyć poprawionej treści bez ponownego generowania odpowiedzi.

## Głos, rozmowy i TTS

- **Postacie nie mówią podczas rozmowy.** Funkcja Text to Speech (synteza mowy) nie jest skonfigurowana. Otwórz **Connections → Text to Speech** (połączenia, synteza mowy), włącz ją, wybierz źródło, wpisz klucz, wybierz głos i zapisz. Postać bez głosu pojawia się wyłącznie jako tekst.
- **Mowa urywa się z komunikatem "No audio after N s".** Twój serwer głosu działa wolniej, niż Marinara na niego czeka. Lokalny serwer na laptopie często tak działa. `N` to twój obecny limit czasu. Zwiększ **Request timeout (seconds)** (limit czasu żądania w sekundach) w **Connections → Text to Speech** albo w koncie audio wskazanym w komunikacie. Zobacz [Limit czasu żądania](media/tts-setup.md#request-timeout).
- **Mikrofon nie działa.** Zainstaluj agenta **Calls** z **Agents → Agent Organizer**. Potem otwórz **Connections → Speech to text** (połączenia, zamiana mowy na tekst), znajdź **Local speech model** (lokalny model mowy) w grupie **On this device** (na tym urządzeniu), wybierz model Whisper i kliknij **Download Whisper** (pobranie modelu Whisper). Firefox tego wymaga, bo nie ma wbudowanego w przeglądarkę rozpoznawania mowy. Odinstalowanie agenta Calls usuwa jego modele Whisper. Możesz też użyć własnego serwera: zobacz [Użyj własnego serwera zamiany mowy na tekst](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** Obraz lite nie potrafi uruchomić lokalnego modelu mowy. Użyj pełnej instalacji.

### Logowanie do Spotify w agencie Music DJ zawodzi przy instalacji zdalnej lub sieciowej

Tryb Spotify w agencie Music DJ korzysta z OAuth, czyli przekazania logowania, w którym serwis Spotify odsyła cię na adres zwrotny (redirect URI). Spotify przyjmuje tylko adresy `https://` albo `http://127.0.0.1` i odrzuca zwykłe adresy IP w sieci.

- Przy adresie localhost edytor pokazuje adres zwrotny `127.0.0.1`. Zarejestruj go w serwisie Spotify.
- Przy dostępie przez HTTPS edytor pokazuje twój adres zwrotny HTTPS. Zarejestruj właśnie ten.
- Jeśli HTTPS kończy się wcześniej, na serwerze pośredniczącym, a host się nie zgadza, ustaw `SPOTIFY_REDIRECT_URI` w pliku `.env` na swój publiczny adres zwrotny.
- Przy instalacji sieciowej po zwykłym HTTP wyskakujące okno się nie wczyta, ale w jego pasku adresu jest poprawny kod. Skopiuj cały adres URL, rozwiń **Browser couldn't reach the callback?** (przeglądarka nie dotarła do adresu zwrotnego?) pod przyciskiem Connect i wklej go. Adres URL jest ważny przez 10 minut.

Najczystsze rozwiązanie to udostępnianie aplikacji Marinara przez HTTPS.

## Pamięć masowa i dane

### Restart Server nie uruchamia serwera ponownie

Uruchamiaj aplikację Marinara za pomocą `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` lub `pnpm start`. Utrzymują one serwer pod kontrolą programu uruchamiającego i uruchamiają nowy proces, gdy stary się zakończy. Restart z aplikacji zamyka utrzymujące się połączenia po czterech sekundach i wymusza zakończenie po ośmiu. Wymuszone zakończenie może przerwać oczekujące zapisy. Procesy uruchomione bezpośrednio przez `node` i procesy obserwujące pliki w trybie deweloperskim nie są zastępowane: zatrzymaj je i uruchom ponownie samodzielnie. W kontenerze Docker obowiązuje jego polityka restartu. W systemie Windows naciśnij <kbd>Ctrl</kbd>+<kbd>C</kbd> w konsoli programu uruchamiającego i zaczekaj na **Shutdown complete** (zamykanie zakończone), zanim ją zamkniesz.

Nie uruchamiaj drugiego serwera z tym samym folderem z danymi, gdy pierwszy nadal działa. Najpierw zatrzymaj pozostały proces.

### Przy uruchamianiu pojawia się informacja, że inny proces może używać folderu z danymi

Tylko jeden serwer może zapisywać w lokalnym folderze z danymi. Jeśli przy uruchamianiu pojawi się komunikat **Another Marinara Engine process ... may be using** wskazujący ten folder, zamknij drugi proces aplikacji Marinara i uruchom ją ponownie.

Po awarii albo przeniesieniu wolumenu Docker uruchamianie może zgłosić **The storage writer lease ... is incomplete or invalid** albo wskazać proces, który już nie istnieje.

1. Upewnij się, że wszystkie procesy i kontenery aplikacji Marinara korzystające z tego folderu z danymi są zatrzymane.
2. Usuń wyłącznie folder `.writer-lease` wskazany w błędzie.
3. Uruchom aplikację Marinara ponownie. Nie usuwaj folderu `storage` ani żadnych plików tabel.

Marinara samodzielnie usuwa dzierżawę pozostawioną przez proces, który uległ awarii, w systemach Linux i Android, w kontenerach oraz w systemie Windows, gdy folder z danymi leży na lokalnym dysku. Ręczny krok to rozwiązanie awaryjne dla sieciowej lub współdzielonej pamięci masowej, dysków wymiennych oraz (w systemie Windows) komputera, którego nazwę zmieniono po awarii.

### Kopia zapasowa lub eksport zwraca błąd 403

Sesje na tym samym komputerze mogą tworzyć kopie zapasowe bez sekretu administratora. Żądania z innego urządzenia, spod adresu sieciowego, z kontenera Docker albo przez proxy lub tunel na tym samym komputerze go wymagają. Utwórz go w **Settings → Advanced → Admin Access** na komputerze, na którym działa serwer, albo ustaw `ADMIN_SECRET` na serwerze, a potem zapisz tę samą wartość w **Admin Access** na drugim urządzeniu. Jeśli sekret ma być wymagany także na pętli zwrotnej, ustaw `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. Przy `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` przekazywani goście korzystają z lokalnego pominięcia. Przy publicznym proxy lub tunelu zostaw to zabezpieczenie włączone.

### Import zgłasza, że plik nie jest czytelnym archiwum ZIP

Marinara odczytuje karty `.charx`, pakiety `.marinara`, pakiety agentów i własne repozytoria agentów jako archiwa ZIP. Archiwum uszkodzone albo takie, którego zawartość nie zgadza się z jego listą plików, odrzuca z komunikatem **The file is not a readable ZIP archive** (albo **Could not read .marinara package**). Zwykle przyczyną jest niepełne pobranie: pobierz plik ponownie. Jeśli archiwum przygotowujesz samodzielnie, utwórz je jeszcze raz opcją kompresji w systemie, narzędziem `zip` albo 7-Zip.

**Package contains too many files** oznacza, że pakiet agenta lub repozytorium zawiera więcej niż 8 192 pliki. **.marinara package has too many entries** oznacza, że pakiet `.marinara` zawiera więcej niż 8 elementów. Usuń nadmiarowe pliki i spróbuj ponownie.

### Harmonogramy w trybie Conversation albo Noodle używają złej strefy czasowej lub pokazują `Etc/Unknown`

W przypadku harmonogramów w trybie Conversation wybierz **Schedule timezone** (strefa czasowa harmonogramu) w ustawieniach czatu (Chat Settings) w trybie Conversation albo w edytorze harmonogramu postaci. **Use device** (użyj ustawień urządzenia) przywraca ustawienie domyślne.

W przypadku Noodle i innych zadań serwera usuń z pliku `.env` pustą linię `TZ=` i uruchom aplikację Marinara ponownie, żeby używała strefy czasowej hosta. Aby ustawić strefę samodzielnie, użyj nazwy IANA, na przykład `TZ=Europe/Warsaw`.

## Problemy w systemie Android

### Aplikacja na system Android stoi na Connecting albo Waiting for Server

Aplikacja na system Android to niewielka nakładka na środowisko Termux, linuksową aplikację terminala dla systemu Android, w której działa właściwy serwer aplikacji Marinara.

1. Dotknij **Install / Start Marinara**.
2. Jeśli system Android prosi o instalację aplikacji Termux, zatwierdź kolejne pytania.
3. Jeśli system Android prosi o zgodę na uruchamianie poleceń w aplikacji Termux, udziel jej.
4. Poczekaj, aż program uruchamiający wystartuje serwer, a potem wróć do aplikacji.

Aplikacja tworzy własne prywatne poświadczenie localhost i loguje się automatycznie. Nigdy nie wklejasz żadnego sekretu. Nie dodawaj `null`, `http://null` ani sekretu APK do `CSRF_TRUSTED_ORIGINS`.

Sprawdź też, czy aplikacja i Termux używają tego samego portu. Domyślnie jest to `7860`. Jeśli aplikację zbudowano z innym portem, ustaw pasujący `PORT` w pliku `.env` środowiska Termux.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android localhost otwiera stronę logowania albo zwraca 401/503

Instalacje środowiska Termux zarządzane przez plik APK chronią localhost prywatnym sekretem osobnym dla każdej instalacji, a aplikacja loguje się automatycznie. Jeśli strona logowania pojawia się wewnątrz aplikacji, zainstaluj [najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), ponownie dotknij **Install / Start Marinara** i wróć, gdy Termux skończy pracę.

Błąd wymieniający źródło `null` oznacza starszą parę APK i serwera. Edycja `.env` tego nie naprawi. Zaktualizuj plik APK i aplikację Marinara.

Żeby otworzyć przeglądarkę na tym samym telefonie, dotknij **Open in browser** (otwórz w przeglądarce) na ekranie uruchamiania Android, a potem **Retry connection** (ponów połączenie). Po restarcie serwera albo wygaśnięciu sesji otwórz ją ponownie w ten sam sposób. Aby wrócić na ekran uruchamiania, użyj **Settings → General → App Behavior → Open Android launcher (app or browser)** (ustawienia, ogólne, zachowanie aplikacji, otwórz ekran uruchamiania Android: aplikacja lub przeglądarka).

Starsze pliki APK logują się pod `/android-login` wartością z `cat ~/.marinara-engine/android-secret`. Odnośnik dla przeglądarki działa tylko raz i wygasa po minucie, więc otwórz nowy z ekranu uruchamiania.

- **401:** wklejony sekret albo wezwanie uwierzytelniające zostało odrzucone. Odśwież `/android-login` i wklej bieżącą wartość.
- **503:** serwer dostał sekret w złym formacie. Uruchom ponownie za pomocą `./start-termux.sh`. Jeśli program uruchamiający zgłosi, że jego plik sekretu jest nieprawidłowy albo pusty, dotknij **Install / Start Marinara** w aplikacji, żeby utworzyć go ponownie.

Lokalne polecenie `mari` automatycznie odczytuje ten sam plik. Nie umieszczaj sekretu na zrzutach ekranu ani w zgłoszeniach problemów.

### Aktualizacja w systemie Android zatrzymuje się z kodem wyjścia 134

Systemowi Android zabrakło pamięci na którymś kroku budowania. Ponownie uruchom program uruchamiający:

```bash
./start-termux.sh
```

Jeśli znowu się zatrzyma, zamknij inne aplikacje, otwórz Termux ponownie i spróbuj jeszcze raz.

### Termux zamyka się albo uruchamia ponownie podczas działania aplikacji Marinara

Program uruchamiający prosi o blokadę uśpienia na czas działania serwera i zapisuje każdą sesję w `~/.marinara-engine/logs/`. Po nieoczekiwanym restarcie dołącz do zgłoszenia najnowszy plik `server-*.log`. Jeśli kończy się on bez błędu aplikacji Marinara lub Node, najprawdopodobniej to system Android albo producent telefonu zakończył Termux.

W ustawieniach systemu Android zezwól aplikacji Termux na działanie w tle i wyłącz dla niej optymalizację baterii. Polecenia `termux-wake-lock` i `termux-wake-unlock` są częścią standardowej instalacji Termux. Te ustawienia nie zapobiegną każdemu zamknięciu procesu przez oprogramowanie producenta.

### Aplikacja Marinara przestaje odpowiadać, dopóki Termux nie jest na pierwszym planie

Czaty zawieszają się na komunikacie "Opening chat...", aplikacja zgłasza **Server unreachable** (serwer nieosiągalny), kopia z sekcji Support Diagnostics pokazuje przy polach serwera **Unreachable (request timed out)** (nieosiągalny, przekroczono limit czasu żądania), a wszystko wraca do działania w chwili otwarcia Termux. Mechanizm zamrażania aplikacji w pamięci podręcznej w systemie Android wstrzymał proces Termux. Telefon przyjmuje połączenie, ale zamrożony serwer nigdy nie odpowiada. Blokada uśpienia temu nie zapobiega. W logu sesji zamiast błędu widać lukę w znacznikach czasu obejmującą okres zamrożenia.

Wyłącz dla aplikacji Termux optymalizację baterii, zezwól jej na działanie w tle, zablokuj Termux na ekranie ostatnich aplikacji, jeśli telefon to obsługuje, i zostaw widoczne powiadomienie Termux. Jeśli zamrożenia się powtarzają, trzymaj Termux na pierwszym planie albo włączony ekran przez cały czas korzystania z aplikacji Marinara.

### Podczas aktualizacji w systemie Android kończy się miejsce przy instalacji zależności

Duży chwilowy narzut miejsca podczas aktualizacji bierze się zwykle z magazynu zależności pnpm po kilku wydaniach albo po przerwanej reinstalacji. Obecny program uruchamiający usuwa stare pakiety, a aktualizacje z aplikacji instalują tylko pakiety dla systemu Android. Jeśli starszy program uruchamiający zapełnił urządzenie, zwolnij miejsce i spróbuj ponownie:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Nie usuwaj `data`, `storage` ani `marinara-engine.db`, bo mogą zawierać czaty i ustawienia. Jeśli aktualizacja nadal się zatrzymuje, skopiuj linie od `Installing dependencies` dalej i dołącz do zgłoszenia informacje o wolnym miejscu i pamięci telefonu.

### Aktualizacja w aplikacji zawodzi przy przełączaniu między Stable i Staging w systemie Android

Zmiana kanału wymusza niemal pełną reinstalację zależności, co na pamięci w środowisku Termux trwa długo. Aktualizator w aplikacji daje każdemu krokowi więcej czasu. Jeśli aktualizacja mimo to zawodzi, błąd nazywa krok, który się nie powiódł, i pokazuje końcówkę jego wyniku. Prawdziwy błąd zależności albo pliku blokady pojawia się właśnie tam. Możesz też zaktualizować aplikację ręcznie w środowisku Termux poleceniem ze wskazówki w komunikacie błędu albo najpierw zwolnić miejsce:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Problemy z kontenerem Docker

### Odmowa uprawnień do zamontowanego wolumenu w kontenerze

- Wolumen nazwany po aktualizacji: uruchom `docker compose pull && docker compose up -d`. Oficjalny obraz naprawia prawa własności przy starcie.
- Montowanie folderu hosta (bind mount): nadaj folderowi hosta prawo zapisu dla użytkownika i grupy o identyfikatorze `1000` albo użyj wolumenu nazwanego.
- Systemy z SELinux, takie jak Fedora czy RHEL: dodaj do montowania wolumenu przyrostek `:Z`.

### Kontener Lite przestaje działać na Raspberry Pi 4

Jeśli obraz lite restartuje się przy każdym żądaniu do AI na Raspberry Pi 4 albo podobnym urządzeniu ARM, sprawdź kod wyjścia. Kod 132 lub SIGILL (procesor trafił na instrukcję, której nie potrafi wykonać) wskazuje na znany problem po stronie źródła w kompilacji Node w obrazie lite na części układów ARM. Na tym urządzeniu używaj zwykłego obrazu.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Rozszerzenie Server Extension zgłasza brak obsługiwanej piaskownicy

Rozszerzenia Server Extensions i surowe polecenia powłoki Professor Mari działają wyłącznie z mechanizmem Seatbelt w systemie macOS albo Bubblewrap w systemie Linux. Na natywnym hoście z systemem Linux zainstaluj `bwrap` i uruchom aplikację Marinara ponownie. Oficjalny obraz Docker zawiera Bubblewrap, ale domyślny kontener nie może tworzyć jego zagnieżdżonych przestrzeni nazw, więc Marinara pozostawia te funkcje wyłączone.

Jeśli akceptujesz szersze uprawnienia kontenera, zapisz poniższy plik jako `docker-compose.override.yml` obok `docker-compose.yml`, a potem utwórz kontener ponownie:

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

> **Ostrzeżenie:** Uruchamianie serwera jako root z `SYS_ADMIN` i bez profilu AppArmor to szerokie podniesienie uprawnień. Nie włączaj tego tylko po to, by ukryć ten komunikat.

Domyślny profil seccomp platformy Docker dostosowuje się do dodanych uprawnień, więc w aktualnych wersjach platformy Docker ustawienie `seccomp=unconfined` nie powinno być potrzebne.

Systemy Windows, Android i inne nieobsługiwane hosty odmawiają uruchamiania rozszerzeń Server Extension. Rozszerzenia Browser Extensions nadal działają w swojej piaskownicy.

## Problemy z rozszerzeniami

### W sekcji Addons brakuje External Extensions

Sekcja pozostaje ukryta, dopóki obie blokady nie zostaną otwarte.

1. Ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env` hosta.
2. Odczekaj chwilę, potem otwórz **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia), przewiń poniżej opcji usuwania danych i włącz **Allow third-party extension imports** (zezwolenie na import rozszerzeń od osób trzecich).

Jeśli przełącznik jest nieaktywny, flaga hosta nadal ma wartość false albo aplikacja nie zauważyła jeszcze zmiany. Upewnij się, że edytowany plik `.env` jest tym aktywnym, opisanym w przewodniku [Konfiguracja serwera](CONFIGURATION.md). W kontenerze Docker jest to zwykle `/app/data/.env`.

Gdy któraś blokada jest zamknięta, wpisy rozszerzeń zewnętrznych się nie pojawiają i nie mogą działać. Ponowne otwarcie blokad nie włącza ich z powrotem.

### Zaimportowane rozszerzenie przeglądarki jest widoczne, ale nie działa

Otwórz je w **Settings → Addons → External Extensions** (ustawienia, dodatki, rozszerzenia zewnętrzne) i przeczytaj pole **Requested access** (żądany zakres dostępu). Starsze pakiety `marinara.extension` v1 bez deklaracji uprawnień pokazują **Full page access** (pełny dostęp do strony). Zatwierdź wyłącznie ten dokładny skrót, który sprawdzono i któremu ufasz.

Pakiet ponownie wyeksportowany z pustą listą uprawnień jest traktowany jak bezpieczne rozszerzenie w piaskownicy, a kod, który potrzebuje struktury strony (DOM), nie zadziała. Dodaj `full_page_access` do jego manifestu tylko wtedy, gdy akceptujesz, że kod uzyska dostęp do całej strony, pamięci przeglądarki, sieciowych API i twojej sesji.

Po wyłączeniu rozszerzenia z pełnym dostępem do strony odśwież aplikację Marinara, jeśli pozostał element paska narzędzi, nakładka albo nasłuch zdarzeń. Sprzątanie odbywa się w miarę możliwości, bo kod strony może wywołać skutki uboczne, których Marinara nie śledzi.

<a id="multiplayer-connection-or-turn-problems"></a>

## Problemy z połączeniem lub turami wieloosobowymi

| Objaw | Rozwiązanie |
| --- | --- |
| Niedostępne kontrolki | Wpisz `MULTIPLAYER_ENABLED=true` do pliku `.env` właściwej instalacji aplikacji Marinara, uruchom ją ponownie, a potem osobno włącz ustawienie. Natywna aplikacja opakowująca na system Android nie może dołączać. |
| Gospodarz niedostępny | Użyj osobnego, osiągalnego portu HTTPS pokoju, ważnego łańcucha certyfikatów i nazwy hosta oraz zgodnego odcisku zaproszenia. Nie wyłączaj kontroli TLS, nie dodawaj `null` do zaufanych źródeł, nie wystawiaj zwykłego API ani nie otwieraj klienta dostarczonego przez gospodarza. |
| Oczekiwanie na zatwierdzenie | Gospodarz musi cię zatwierdzić w panelu Players. Przed zatwierdzeniem nie widzisz historii. Jeśli zaproszenie wygasło, poproś o nowe. |
| Rozłączenie | Nie zamykaj swojej aplikacji Marinara. Łączy się ona ponownie z tym samym gospodarzem, dopóki sesja trwa, a niewysłane szkice zostają. Po restarcie dołącz ponownie. Aby zachować tę samą nazwę persony, poproś najpierw gospodarza o usunięcie twojego dawnego miejsca. |
| Gra czeka | Otwórz panel Players. Rozłączeni gracze nie są automatycznie pomijani. Gospodarz może użyć **Pass** (pominięcie), **Kick** (wyrzucenie) albo **Pause** (wstrzymanie). |
| Przerwane generowanie | Nie przesyłaj rundy ponownie. Gospodarz powinien sprawdzić zapisaną narrację i stan, a potem wznowić albo zatrzymać pokój. Gra wieloosobowa nigdy nie powtarza niejasnego żądania ani nie stosuje dwukrotnie jego skutków w świecie gry. |
| Zablokowana komenda lub brak multimediów | Pokoje przenoszą tylko tekst. Zobacz [tabelę zgodności](development/multiplayer.md#command-and-feature-compatibility). Nie instaluj plików ani rozszerzeń od innych uczestników. |

Zgłaszając błąd połączenia, podaj tryb, platformę, widoczny błąd i informację, czy zatwierdzenie zadziałało. Nie publikuj zaproszeń, haseł pokoju, tokenów sesji, prywatnych historii ani kluczy API.

## Instalacja jako PWA w przeglądarce Chrome w systemie Android zawodzi przy włączonym logowaniu

Użyj adresu HTTPS, zaloguj się i odśwież stronę po aktualizacji aplikacji Marinara. Aplikacja pobiera manifest z danymi uwierzytelniającymi, więc logowanie może pozostać włączone. Jeśli instalacja nadal jest niedostępna, sprawdź, czy proxy zwraca `/manifest.json` jako JSON, a nie stronę logowania lub błąd.

<a id="get-more-help"></a>

## Uzyskiwanie dalszej pomocy

1. Otwórz **Settings → Advanced → Message Tools** (ustawienia, zaawansowane, narzędzia wiadomości) i włącz **Debug mode**. Zapisuje on prompt i odpowiedź w konsoli serwera.
2. Zanotuj system operacyjny, wersję Node.js i pełną treść błędu z konsoli.
3. Zanim cokolwiek udostępnisz, usuń klucze API, tokeny dostępu, sekrety administratora i prywatną treść czatów.

Potem odezwij się do społeczności:

- Przejrzyj [otwarte zgłoszenia](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Dołącz do serwera [Discord](https://discord.com/invite/KdAkTg94ME).
- Zgłoś błąd w tym samym systemie zgłoszeń w serwisie GitHub, dołączając powyższe informacje.

## Powiązane przewodniki

- [Najczęściej zadawane pytania](FAQ.md)
- [Konfiguracja serwera](CONFIGURATION.md)
- [Dostęp zdalny](REMOTE_ACCESS.md)
- [Aktualizacja aplikacji Marinara Engine](UPGRADING.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
- [Konfiguracja modelu wbudowanego](connections/local-model.md)
- [Game Mode: pierwsze kroki](game/getting-started.md)
- [Przegląd ustawień](settings/settings-overview.md)

<details>
<summary>Dla opiekunów projektu: aktualizacja przypiętych lokalnych środowisk uruchomieniowych</summary>

Archiwa źródeł generowane przez serwis GitHub nie muszą pozostawać identyczne bajt po bajcie, nawet jeśli zawartość commita się nie zmienia. Nigdy nie "naprawiaj" niezgodności zgłoszonej przez użytkownika, przyjmując bajty z jego komputera ani osłabiając weryfikację. Dane wejściowe środowiska uruchomieniowego przypinaj ponownie wyłącznie w zmianie kodu aplikacji Marinara Engine, która przeszła recenzję:

1. Wybierz niezmienną rewizję lub plik wydania z repozytorium źródłowego i przejrzyj zmiany po stronie źródła.
2. Pobierz artefakt do katalogu tymczasowego, zapisz jego dokładny rozmiar w bajtach i niezależnie oblicz skrót SHA-256.
3. Wpisz rewizję, adres URL, rozmiar i skrót do pliku `runtime-integrity-manifest.ts`. W przypadku MLX wygeneruj ponownie plik `packages/server/src/assets/mlx-runtime-requirements.lock` z pliku `.in`, używając przypiętej wersji uv na Apple Silicon i Python 3.12, przejrzyj każdą zmianę zależności i zaktualizuj `requirementsLockSha256`.
4. Uruchom `pnpm regression:runtime-integrity`, `pnpm check` oraz prawdziwą, czystą instalację środowiska uruchomieniowego na platformie, której dotyczy zmiana.
5. Wydaj sprawdzoną aktualizację aplikacji Marinara Engine, zanim poprosisz użytkowników o ponowną próbę. Nie udostępniaj ręcznego obejścia sumy kontrolnej.

</details>
