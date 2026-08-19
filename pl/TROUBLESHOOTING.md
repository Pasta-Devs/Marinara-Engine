# Rozwiązywanie problemów w aplikacji Marinara Engine

Ten przewodnik zbiera najczęstsze problemy z aplikacją Marinara Engine i podpowiada, jak je naprawić. Znajdź sekcję pasującą do objawu i wykonaj opisane kroki. Jeśli nic tutaj nie pomaga, zajrzyj do ostatniej sekcji: Uzyskiwanie dalszej pomocy.

## Od czego zacząć

Wiele problemów znika po dwóch szybkich krokach.

1. Odśwież stronę z pominięciem pamięci podręcznej. Naciśnij **Ctrl+Shift+R** w systemie Windows lub Linux albo **Cmd+Shift+R** na komputerze Mac.
2. Zajrzyj do konsoli serwera (okno terminala, w którym działa Marinara) i poszukaj czerwonych linii z błędami. Zwykle to właśnie one nazywają prawdziwą przyczynę.

Jeśli piszesz do zespołu po pomoc, najpierw włącz **Debug mode** (tryb diagnostyczny), żeby serwer zapisywał w logach prompt (tekst, który Marinara wysyła do AI) i odpowiedź. Zobacz sekcję Uzyskiwanie dalszej pomocy na końcu przewodnika.

## Problemy z instalacją i uruchamianiem

### Windows: błąd EPERM lub błąd podpisu corepack przy instalacji pnpm

pnpm to menedżer pakietów, którym Marinara instaluje swój kod. Komunikat `EPERM: operation not permitted` albo błąd weryfikacji podpisu corepack oznacza, że corepack nie mógł zapisać danych w folderze instalacji Node.

Wybierz jedno z rozwiązań:

1. Kliknij terminal prawym przyciskiem myszy, wybierz Uruchom jako administrator, a potem uruchom program uruchamiający ponownie.
2. Zainstaluj pnpm samodzielnie. Wykonaj to polecenie, a potem uruchom program uruchamiający ponownie:

```bash
npm install -g pnpm
```

3. Zaktualizuj corepack w terminalu administratora, a potem uruchom program uruchamiający ponownie:

```bash
npm install -g corepack
```

### Windows: `'pnpm' is not recognized` podczas budowania pakietu współdzielonego

Marinara v2.3.0 potrafiła uruchomić pnpm przez Corepack, a mimo to przerywała pracę przy budowaniu pakietu współdzielonego, ponieważ ten build próbował wywołać drugi, globalny plik wykonywalny `pnpm`. Wersja v2.3.1 usuwa ten zagnieżdżony wymóg. Zamknij nieudany program uruchamiający i wykonaj `start.bat` jeszcze raz, żeby mógł pobrać poprawiony skrypt budowania przed przebudową. Danych nie trzeba usuwać.

Jeśli sama kopia repozytorium nie potrafi się zaktualizować, wykonaj `git pull` w folderze aplikacji Marinara Engine i uruchom ją ponownie. Jako tymczasowe obejście w wersji v2.3.0 zainstaluj globalnie przypiętą wersję menedżera pakietów, uruchom program uruchamiający ponownie, a potem zaktualizuj aplikację w zwykły sposób:

```bash
npm install -g pnpm@10.33.2
```

### Aktualizacja programu uruchamiającego do pnpm 10.34.5

Marinara v2.4.1 przechodzi na przypięty menedżer pakietów pnpm 10.34.5. Istniejący program uruchamiający z wersją 10.33.2 może dokończyć to jednorazowe przekazanie w tym samym uruchomieniu; od kolejnych startów odświeżony program wybiera już 10.34.5. Corepack weryfikuje wydanie za pomocą skrótu SHA-512 przypiętego w `package.json`, a awaryjna ścieżka przez npm również żąda dokładnie 10.34.5, zamiast nieprzypiętego najnowszego wydania.

Jeśli wcześniejsza kompilacja staging v2.4.1 zatrzymała się już z komunikatami `Expected version: >=10.34.5` oraz `Got: 10.33.2`, uruchom program ponownie — przed zatrzymaniem tamta kompilacja pobrała jego odświeżoną wersję. Jeśli nadal nie może automatycznie pobrać przypiętego wydania, zainstaluj dokładną wersję i spróbuj ponownie:

```bash
npm install -g pnpm@10.34.5
```

### Linux: ERR_PNPM_ENAMETOOLONG podczas instalacji

Ten błąd oznacza, że po starszej instalacji zostały bardzo długie ścieżki folderów. W folderze aplikacji Marinara Engine usuń niedokończoną instalację i uruchom program uruchamiający ponownie:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Potem uruchom aplikację Marinara Engine ponownie poleceniem `./start.sh`. Przy instalacji ręcznej wykonaj `pnpm install` po usunięciu tych folderów.

### ERR_PNPM_TRUST_DOWNGRADE podczas instalacji

To prawie zawsze skutek niedokończonej instalacji. Najpierw uruchom program uruchamiający ponownie, żeby naprawił obszar roboczy. Przy instalacji ręcznej wykonaj w folderze aplikacji Marinara Engine to jedno polecenie:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Pusty, nieodświeżony lub staro wyglądający ekran

Bywa, że serwer działa, a przeglądarka pokazuje pustą stronę albo aplikacja po aktualizacji wygląda jak stara wersja. W takim wypadku przeglądarka trzyma kopię aplikacji zapisaną w pamięci podręcznej.

1. Odśwież stronę z pominięciem pamięci podręcznej (**Ctrl+Shift+R** lub **Cmd+Shift+R**).
2. Jeśli to nie pomaga, otwórz **Settings** (Ustawienia), przejdź do zakładki **Advanced**, potem do sekcji **Updates** i kliknij przycisk **Refresh App**.

Przycisk **Refresh App** czyści service worker przeglądarki (skrypt działający w tle, który zapisuje aplikację w pamięci podręcznej) oraz samą pamięć podręczną, a potem przeładowuje stronę. Nie zmienia danych. Czaty, ustawienia i pozostałe dane lokalne pozostają nietknięte. Nie aktualizuje też kodu serwera, więc nie zastąpi prawdziwej aktualizacji. Aby zaktualizować samą aplikację, zobacz [Aktualizacja aplikacji Marinara Engine](UPGRADING.md).

## Problemy z agentami do pobrania

Jeśli sekcja **Agents → Download Agents** informuje, że katalog jest niedostępny, komputer z serwerem Marinara Engine – a nie tylko przeglądarka – musi mieć dostęp do oficjalnego katalogu [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) przez GitHub HTTPS. Zainstalowani agenci działają dalej offline w obecnej wersji. Przywróć serwerowi dostęp do sieci, a potem kliknij przycisk **Refresh** lub **Try again**, żeby przejrzeć katalog i sprawdzić aktualizacje.

Jeśli zainstalowana mapa lub rozmowa się nie pojawia, zamknij aplikację Marinara Engine całkowicie i uruchom ją ponownie. Pakiety z własnymi trasami pozostają w stanie **Restart required** aż do kolejnego uruchomienia procesu. Z grami do trybu Conversation jest inaczej: obecne wersje aplikacji aktywują je od razu. Jeśli instalacja się nie powiodła, odśwież katalog i sprawdź, czy gra jest gotowa; dodawanie jej w ustawieniach **Commands** danego czatu jest potrzebne tylko wtedy, gdy postacie mają same ją rozpoczynać – do ręcznej komendy slash nie jest konieczne.

Jeśli starsza instalacja nie potrafi dokończyć pierwszej migracji pakietów, nie usuwaj folderu `data/capability-packages` ani danych czatów. Marinara zostawia migrację niedokończoną i ponawia ją przy kolejnym uruchomieniu. Wybory i ustawienia istniejących czatów pozostają zapisane także wtedy, gdy katalog jest nieosiągalny.

Marinara odrzuca pobierane pakiety, gdy ich suma kontrolna, zadeklarowana lista plików, zakres wersji aplikacji lub ścieżki w archiwum nie zgadzają się z oficjalnym katalogiem. Najpierw zaktualizuj aplikację Marinara Engine, odśwież katalog i spróbuj ponownie. Nie wypakowuj plików ręcznie do folderu z danymi.

Aktualizacje agentów nigdy nie instalują się przy starcie. Kiedy pojawia się nowsza zgodna wersja, Marinara pyta, czy ją zainstalować. Wybierz **No**, żeby zostać przy wersji zainstalowanej; przycisk **Update** pozostaje dostępny w sekcji **Agents → Download Agents**. Nieudana aktualizacja także zostawia zarejestrowaną wersję zainstalowaną, a świeżo zaktualizowane środowisko serwera, które nie przejdzie testu przy starcie, wraca do wersji poprzedniej.

## Dostęp do aplikacji Marinara Engine z innego urządzenia

Jeśli nie da się otworzyć aplikacji Marinara Engine na telefonie, tablecie albo innym komputerze w sieci, przejdź przez tę listę kontrolną.

- Przypisz serwer do adresu widocznego w sieci. Domyślnie serwer nasłuchuje na `127.0.0.1` (pętla zwrotna, czyli tylko ten komputer). Programy uruchamiające ustawiają `HOST=0.0.0.0` automatycznie. Przy ręcznym starcie poleceniem `pnpm start` najpierw ustaw `HOST=0.0.0.0` w pliku `.env`.
- Sprawdź, czy oba urządzenia są w tej samej sieci Wi-Fi.
- Sprawdź, czy zapora sieciowa nie blokuje portu. Domyślny port to `7860` albo ten ustawiony w `PORT`.
- Skonfiguruj kontrolę dostępu. Dla zwykłych klientów sieciowych i publicznych ustaw `BASIC_AUTH_USER` oraz `BASIC_AUTH_PASS` w pliku `.env`. Pętla zwrotna pozostaje bez hasła. Bezpośredni ruch przez Tailscale oraz przez mostek Docker na tym samym hoście lub wykrytą bramę kontenera jest domyślnie zaufany. Ruch Docker przekazywany przez proxy wymaga zwykłej autoryzacji, chyba że jawnie ustawisz `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`.
- Do działań uprzywilejowanych z takiego urządzenia (kopie zapasowe, czyszczenie danych, aktualizacje) ustaw `ADMIN_SECRET` w pliku `.env` serwera. Potem wklej tę samą wartość w **Settings** > **Advanced** > **Admin Access** na tym urządzeniu i kliknij przycisk **Save**.
- Przy domenie publicznej lub odwrotnym proxy komunikat **Untrusted request host** oznacza, że trzeba dopisać dokładną nazwę hosta do `TRUSTED_HOSTS` w pliku `.env`. Bezpośrednie adresy IP telefonów, komputerów w sieci lokalnej i urządzeń Tailscale są nadal akceptowane automatycznie.

Pełny opis krok po kroku znajdziesz w przewodnikach [Dostęp zdalny](REMOTE_ACCESS.md) i [Najczęściej zadawane pytania](FAQ.md).

## Zablokowany zapis lub ustawienia, które nie zostają

Jeśli zapis niby się udaje, ale po przeładowaniu wraca stara wartość, blokuje go ochrona przed żądaniami z innych witryn. Ochrona CSRF (cross-site request forgery) pilnuje działań, które zmieniają dane. Ufa tylko wybranym adresom źródłowym przeglądarki.

Zobaczysz jeden z tych objawów albo oba naraz:

- Czerwony baner na górze ekranu z ostrzeżeniem, że zapisy będą po cichu przepadać, bo to źródło nie jest zaufane.
- Komunikat o tytule **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** albo **Save blocked: origin not trusted**.

Pętla zwrotna, adresy sieci prywatnych, Tailscale i mostek Docker są zaufane automatycznie. Problem pojawia się zwykle tylko wtedy, gdy aplikacja Marinara Engine jest otwierana przez publiczny adres IP albo nazwę domeny. Dopisz taki adres do `CSRF_TRUSTED_ORIGINS` w pliku `.env`. Kilka adresów oddziel przecinkami, na przykład:

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

Restart nie jest potrzebny. Baner ma przycisk Copy, który wpisuje gotową linię. Więcej informacji w przewodniku [Dostęp zdalny](REMOTE_ACCESS.md).

## Błędy połączeń i generowania

Błędy generowania pojawiają się jako komunikat na dole ekranu. Jeśli połączenie zawiodło, komunikat podaje przyczynę. Wisi na ekranie wystarczająco długo, żeby dało się go przeczytać i skopiować.

- **No API connection configured for this chat**: czat nie ma wybranego połączenia. Otwórz panel **Connections** (Połączenia), utwórz połączenie, a potem przypisz je do czatu. Zobacz [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md). Klucz API to tajny kod od dostawcy, trochę jak hasło, dzięki któremu Marinara może korzystać z jego modeli.
- Model nie przyjmuje jakiegoś parametru: komunikat podaje jego nazwę. Otwórz **Chat Settings** (ustawienia czatu) > **Advanced Parameters** i znajdź ten parametr. Wyłącz przełącznik obok jego nazwy (podpowiedź brzmi "This parameter is sent to the model").
- Model zgłasza, że parametr jest wymagany: zrób to samo, ale przełącznik obok tego parametru włącz.
- **The AI returned an empty response. Try sending your message again.**: wyślij wiadomość jeszcze raz. Jeśli to się powtarza, spróbuj innego modelu lub innego połączenia.
- **A generation is already in progress for this chat**: jedna odpowiedź wciąż się generuje. Poczekaj na jej koniec albo kliknij przycisk Stop i spróbuj ponownie.
- **No connections are marked for the random pool**: losowe kierowanie połączeń jest włączone, ale żadne połączenie nie trafiło do puli. Dodaj do puli co najmniej jedno połączenie albo wyłącz losowe kierowanie.

## Problemy z funkcją **Local Model**

**Local Model** to model AI, który działa na twoim komputerze bez klucza API. W części komunikatów o błędach ta funkcja nazywa się sidecar.

- Jeśli instalacja środowiska uruchomieniowego kończy się komunikatem **Sidecar runtime install is disabled**, serwer ma to działanie wyłączone ze względów bezpieczeństwa. Na własnym komputerze ustaw `SIDECAR_RUNTIME_INSTALL_ENABLED=true` w pliku `.env`. Z innego urządzenia najpierw wklej sekret administratora w **Settings** > **Advanced** > **Admin Access**.
- Jeśli pobieranie modelu albo konfiguracja zawodzi z innego urządzenia (adres sieciowy lub kontener Docker), sekret administratora również może być potrzebny. Na własnym komputerze nie jest wymagany. Miejsce na wklejenie sekretu opisuje punkt wyżej.
- Jeśli kontrola dołączonego pliku llama.cpp, MLX, uv albo blokady zależności MLX zgłasza niezgodność rozmiaru pliku lub sumy SHA-256, Marinara odrzuciła go jeszcze przed rozpakowaniem lub instalacją. Zaktualizuj albo zainstaluj ponownie aplikację Marinara Engine i spróbuj jeszcze raz. Odrzuconego pliku nie uruchamiaj, nie rozpakowuj, nie edytuj i nie omijaj kontroli ręcznie.

### Dla opiekunów projektu: aktualizacja przypiętych lokalnych środowisk uruchomieniowych

Archiwa źródeł generowane przez GitHub nie muszą pozostawać identyczne bajt po bajcie, nawet jeśli zawartość commita się nie zmienia. Nigdy nie "naprawiaj" niezgodności zgłoszonej przez użytkownika, przyjmując bajty z jego komputera ani osłabiając weryfikację. Dane wejściowe środowiska uruchomieniowego przypinaj ponownie wyłącznie w zmianie kodu aplikacji Marinara Engine, która przeszła recenzję:

1. Wybierz niezmienną rewizję lub plik wydania z repozytorium źródłowego i przejrzyj zmiany po stronie źródła.
2. Pobierz plik do katalogu tymczasowego, zapisz jego dokładny rozmiar w bajtach i niezależnie oblicz skrót SHA-256.
3. Wpisz rewizję, adres URL, rozmiar i skrót do pliku `runtime-integrity-manifest.ts`. W przypadku MLX wygeneruj ponownie plik `packages/server/src/assets/mlx-runtime-requirements.lock` z pliku `.in`, używając przypiętej wersji uv na Apple Silicon i Python 3.12, przejrzyj każdą zmianę zależności i zaktualizuj `requirementsLockSha256`.
4. Uruchom `pnpm regression:runtime-integrity`, `pnpm check` oraz prawdziwą, czystą instalację środowiska uruchomieniowego na platformie, której dotyczy zmiana.
5. Wydaj sprawdzoną aktualizację aplikacji Marinara Engine, zanim poprosisz użytkowników o ponowną próbę. Nie udostępniaj ręcznego obejścia sumy kontrolnej.

Pełną konfigurację opisuje przewodnik [Konfiguracja modelu Local Model](connections/local-model.md).

## Pamięć i podsumowania

### Funkcja Memory Recall niczego nie przywołuje

**Memory Recall** przeszukuje wcześniejsze wiadomości i po cichu dodaje najbardziej pasujące z powrotem do promptu. Jeśli wygląda na to, że nic nie pamięta, sprawdź poniższe punkty.

1. Otwórz **Chat Settings** > **Memory Recall** i sprawdź, czy przełącznik **Enable Memory Recall** jest włączony.
2. Otwórz **Access memories for this chat**. W oknie **Memories for This Chat** sprawdź status każdego fragmentu.
3. Status **Waiting for vector** oznacza, że wspomnienie jest jeszcze przetwarzane. Poczekaj i napisz kolejną wiadomość.
4. Status **Embedding unavailable** oznacza, że żadne źródło embeddingów nie działa. Embedding to liczbowa reprezentacja tekstu. Skonfiguruj połączenie z embeddingami albo pozwól wczytać wbudowany model lokalny. Zobacz [Konfiguracja modelu Local Model](connections/local-model.md).

Wspomnienie powstaje dopiero po co najmniej 5 nowych wiadomościach. Funkcja pokazuje ponadto tylko te wspomnienia, które mocno pasują do nowej wiadomości, więc może nie zwrócić nic nawet wtedy, gdy wspomnienia istnieją.

### Podsumowania nie powstają

Podsumowania czatu wymagają działającego połączenia tekstowego.

- W trybie Roleplay otwórz panel podręczny **Chat Summary** i sprawdź, czy połączenie jest ustawione. Przycisk **Backfill Summary** uzupełnia starszy czat.
- W trybie Conversation otwórz **Automatic Summarization** i przyciskiem **Backfill** ponów nieudane dni.
- Jeśli czat wymaga zatwierdzania zapisów agenta, podsumowanie od AI czeka na twoją akceptację.
- Podsumowanie, które ciągle zawodzi (na przykład przez błędny klucz API), jest ponawiane z opóźnieniem. Napraw połączenie, a potem użyj przycisku **Backfill**.

## Problemy z panelem Card Browser

**Card Browser** służy do przeszukiwania publicznych serwisów z postaciami i importowania postaci. Otwórz go ikoną **Card Browser** na górnym pasku, a potem kliknij przycisk **Download Cards**.

- Jeśli wyszukiwanie w serwisie JannyAI albo strona postaci kończy się blokadą Cloudflare, Marinara pokazuje komunikat. Prosi o jednorazowe odwiedzenie strony JannyAI w tej samej przeglądarce, żeby przejść weryfikację, a potem o ponowną próbę.
- Jeśli logowanie do serwisu CharacterTavern lub Pygmalion przestaje działać po restarcie serwera, tak ma być. Te dane logowania żyją wyłącznie w pamięci serwera i znikają przy restarcie. Otwórz okno logowania i wklej cookie albo token jeszcze raz.

## Problemy z generowaniem multimediów

### Czyszczenie tła sprite'a nie radzi sobie ze złożoną sceną

Wygenerowane statyczne sprite'y (obrazki postaci na obszarze sceny) zwykle korzystają z natywnej przezroczystości albo z adaptacyjnej jednolitej maty chroma. Wbudowane czyszczenie rozpoznaje też starsze białe maty, zachowuje detale wewnątrz postaci, wygładza krawędź kanału alfa i usuwa refleksy koloru maty. Zdjęcie pokoju, drobiazgowe otoczenie, mocne cienie albo postać w kolorach zbliżonych do tła mogą jednak wymagać opcjonalnego mechanizmu awaryjnego opartego na AI:

```bash
pnpm backgroundremover:install
```

Potem uruchom aplikację Marinara Engine ponownie i kliknij przycisk **Reapply Cleanup** w oknie generowania sprite'ów. Marinara nadal najpierw spróbuje wbudowanej ścieżki z matą, a model AI włączy tylko wtedy, gdy krawędź nie wygląda jednolicie. Jeśli instalacja się nie powiedzie:

- Sprawdź, czy jest zainstalowany język Python w wersji od 3.9 do 3.11. Nowsze wersje mogą wymusić powolne kompilowanie natywne.
- Zbuduj narzędzie ponownie poleceniem `pnpm backgroundremover:reinstall`.
- Aby na czas diagnozy wymusić automatyczne czyszczenie maty bez mechanizmu awaryjnego AI, ustaw `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` w pliku `.env`.

### Storyboardy w trybie Game Mode lub Roleplay się nie pojawiają

Storyboardy w trybie Game Mode zamieniają zakończoną narrację postaci GM w obrazy klatek kluczowych i opcjonalne klipy. Storyboardy w trybie Roleplay łączą zakończone wymiany zdań i pokazują wynik bezpośrednio pod odpowiedzią asystenta.

- Sprawdź, czy agent **Storyboard** jest zainstalowany z **Agents** > **Download Agents**, a potem włącz dla czatu przełączniki **Enable Agents** i **Enable Storyboards**.
- Aby ręcznie zrobić wideo sceny, najpierw wygeneruj lub wgraj obraz w sekcji **Gallery** (Galeria), a potem użyj przy nim akcji **Video** albo **Animate**. Sekcja **Gallery** rozdziela **Images** i **Videos** na zakładki, więc zajrzyj do zakładki **Videos**.
- Przy automatycznych storyboardach w trybie Game Mode otwórz **Chat Settings** > **Agents** > **Storyboards** i sprawdź, czy **Automatic Storyboard Illustrations** jest włączone. Jeśli mają powstawać także klipy, włącz również **Automatic Storyboard Animations**.
- W trybie Roleplay dodaj do czatu agenta **Storyboard**. Wybierz **Still images** albo **Animations**, ustaw **Messages per episode** i wskaż połączenie do generowania obrazów dla storyboardu. Opcja **Manual only** uruchamia storyboard dopiero przyciskiem **Create storyboard** w sekcji **Gallery**.
- Klatki kluczowe wymagają połączenia do generowania obrazów. Klipy potrzebują dodatkowo połączenia wideo.
- Jeśli własny prompt działa lepiej ze wszystkimi postaciami naraz, wyłącz **Use NovelAI Character Prompts**.
- U wolnych dostawców może zostać przekroczony limit czasu. Zwiększ `IMAGE_GEN_TIMEOUT_MS` lub `VIDEO_GEN_TIMEOUT_MS` w pliku `.env`, a potem uruchom aplikację Marinara Engine ponownie. Serwer odczytuje te wartości tylko przy starcie.

Oba sposoby pracy opisuje [Przewodnik po agencie Storyboard](game/storyboard.md), a konfigurację gry – [Game Mode: pierwsze kroki](game/getting-started.md).

### Generowanie świata w trybie Game Mode pokazuje błąd JSON

Jeśli start gry zawodzi, bo model zwrócił uszkodzony JSON, Marinara otwiera okno **Repair JSON**, zamiast wyrzucać całą turę. JSON to ustrukturyzowany format tekstowy, który model musi zwrócić.

1. Popraw nawiasy, przecinki lub pola w edytorze. Gdy tekst da się poprawnie odczytać, baner pokazuje **JSON is valid.**
2. Kliknij przycisk **Format**, żeby uporządkować układ.
3. Kliknij przycisk **Apply Repaired JSON**, żeby użyć poprawionej treści bez generowania całej odpowiedzi od nowa.

## Głos, rozmowy i TTS

- Jeśli postacie nie mówią podczas rozmowy, nie jest skonfigurowana funkcja Text to Speech. Otwórz **Connections** > **Text to Speech**, włącz ją, wybierz źródło, wpisz klucz, wybierz głos i zapisz. Postać bez głosu pojawia się wyłącznie w formie tekstu.
- Jeśli mikrofon nie działa, może być potrzebny lokalny model mowy. Zainstaluj agenta **Calls** z sekcji **Agents > Download Agents**, potem otwórz **Connections** > **Local Model**, rozwiń panel, znajdź **Local Speech Model**, wybierz model Whisper i kliknij przycisk **Download Whisper**. Szczególnie Firefox tego wymaga, bo nie ma wbudowanego rozpoznawania mowy. Odinstalowanie agenta **Calls** usuwa jego modele Whisper i zwalnia miejsce na dysku.
- W wersji Lite komunikat **Local Whisper is disabled in Lite mode** oznacza, że ta odchudzona wersja nie uruchomi lokalnego modelu mowy. Użyj pełnej instalacji aplikacji Marinara Engine.

### Logowanie do Spotify w agencie Music DJ zawodzi przy instalacji zdalnej lub sieciowej

Tryb Spotify w agencie Music DJ korzysta z OAuth. OAuth to przekazanie logowania, w którym Spotify odsyła użytkownika na adres zwrotny. Redirect URI to właśnie ten adres zwrotny, a Spotify przyjmuje tylko adresy `https://` albo adres pętli zwrotnej `http://127.0.0.1`. Zwykłe adresy IP w sieci są odrzucane.

- Przy otwieraniu aplikacji Marinara Engine pod adresem localhost edytor pokazuje adres zwrotny `127.0.0.1`. Zarejestruj go w Spotify, a logowanie dojdzie do końca.
- Przy dostępie przez HTTPS edytor pokazuje adres zwrotny HTTPS. Zarejestruj właśnie ten.
- Jeśli HTTPS kończy się wcześniej, na serwerze pośredniczącym, a host się nie zgadza, ustaw `SPOTIFY_REDIRECT_URI` w pliku `.env` na publiczny adres zwrotny.
- Przy instalacji sieciowej po zwykłym HTTP wyskakujące okno się nie wczyta, ale w pasku adresu wciąż jest poprawny kod. Skopiuj z tego okna cały adres URL. Potem rozwiń **Browser couldn't reach the callback?** pod przyciskiem Connect i wklej go. Wklejony adres URL jest ważny przez 10 minut.

Najczystsze rozwiązanie na dłuższą metę to postawienie serwera za HTTPS. Ostatnio sprawdzone w wersji Marinara Engine 2.2.0. Spotify zaostrzył te zasady w lutym 2025 roku.

## Pamięć masowa i dane

### Przy uruchamianiu pojawia się informacja, że inny proces może używać katalogu danych

Marinara Engine pozwala tylko jednemu działającemu serwerowi zapisywać w lokalnym katalogu danych. Jeśli przy uruchamianiu pojawi się komunikat **Another Marinara Engine process ... may be using** wskazujący ten katalog, zamknij drugi proces Marinara Engine i uruchom ponownie.

Po awarii lub przeniesieniu wolumenu danych Dockera może zamiast tego pojawić się **The storage writer lease ... is incomplete or invalid** albo wskazanie procesu, który już nie istnieje na tym hoście. Najpierw upewnij się, że wszystkie procesy i kontenery Marinara Engine korzystające z tego katalogu danych są zatrzymane. Następnie usuń wyłącznie katalog `.writer-lease` wskazany w błędzie i uruchom Marinara Engine ponownie. Nie usuwaj otaczającego go katalogu `storage` ani żadnych plików tabel.

### Po aktualizacji brakuje danych

Jeśli po aktualizacji czaty albo presety wyglądają na zniknięte, nie usuwaj jeszcze żadnych folderów z danymi. Marinara trzyma bieżące dane w folderze `storage` wewnątrz swojego folderu z danymi.

Poszukaj folderu `storage` w obu tych lokalizacjach:

1. `packages/server/data/`
2. `data/`

Serwer wypisuje przy starcie, który folder z danymi i który folder `storage` rozpoznał.

### Po przejściu na starszą wersję czaty nie pokazują wiadomości

Nowsze wersje Marinara Engine przechowują dane każdego czatu (wiadomości, warianty, wspomnienia, obrazy i inne rekordy powiązane z czatem) w osobnych plikach, zamiast w jednym dużym pliku na tabelę. Dzięki temu zapisywanie długich czatów jest znacznie szybsze. Starsze wersje nie rozumieją takiego układu. Po przejściu na starszą wersję czaty wyglądają na puste — dane nadal są na dysku, lecz starsza wersja ich nie widzi.

Marinara Engine sam odrzuca oczywiste obniżenia wersji: program uruchamiający pomija automatyczną aktualizację prowadzącą do niezgodnej wersji, a aktualizator w aplikacji blokuje ją z błędem odsyłającym tutaj.

Aby mimo to obniżyć wersję:

1. Zatrzymaj serwer Marinara Engine.
2. W katalogu Marinara Engine uruchom:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Przejdź na starszą wersję i uruchom ją normalnie.

Polecenie odtwarza dawny układ pojedynczych plików z plików poszczególnych czatów. Niczego nie usuwa: pliki czatów pozostają obok każdego odbudowanego pliku w katalogach o nazwie `<table>.post-unshard-<timestamp>` (na przykład `messages.post-unshard-…`), a oryginały sprzed migracji pozostają jako pliki `.pre-shard`. Przy późniejszej ponownej aktualizacji Marinara Engine automatycznie przekonwertuje dane z powrotem.

Docker i Podman przechowują dane w wolumenie `marinara-data`, dlatego uruchom polecenie w jednorazowym kontenerze: zatrzymaj działający kontener, wykonaj `docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard`, a następnie uruchom starszy obraz.

### Kopia zapasowa lub eksport zwraca błąd 403

Sesje na pętli zwrotnej tworzą kopie zapasowe bez sekretu administratora. Z innego urządzenia, spod adresu sieciowego albo z kontenera Docker kopie zapasowe i eksport profilu wymagają więcej. Ustaw `ADMIN_SECRET` na serwerze i zapisz tę samą wartość w **Settings** > **Advanced** > **Admin Access**. Jeśli sekret ma być wymagany także na pętli zwrotnej, ustaw `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android i Docker

### Aplikacja na system Android stoi na Connecting albo Waiting for Server

Aplikacja na system Android to cienka nakładka na Termux. Termux to linuksowy terminal na system Android, w którym działa prawdziwy serwer Marinara Engine.

1. Dotknij przycisku **Install / Start Marinara**.
2. Jeśli system Android prosi o instalację aplikacji Termux, zatwierdź kolejne pytania.
3. Jeśli system Android prosi o zgodę na uruchamianie poleceń w aplikacji Termux, udziel jej.
4. Poczekaj, aż program uruchamiający skończy pracę i wystartuje serwer, a potem wróć do aplikacji.

Zwykła instalacja z pliku APK nigdy nie prosi o wklejenie sekretu Marinara. Aplikacja tworzy prywatne poświadczenie localhost, przekazuje je do Termux i loguje się automatycznie. Systemowe okna instalacji aplikacji i uprawnień Termux są nadal wymagane. Nie dodawaj `null`, `http://null` ani sekretu APK do `CSRF_TRUSTED_ORIGINS`; żadna z tych czynności nie jest prawidłowym ani potrzebnym krokiem konfiguracji Androida.

Sprawdź też, czy aplikacja i Termux używają tego samego portu. Domyślnie jest to `7860`. Jeśli aplikacja została zbudowana z innym portem, ustaw pasujący `PORT` także w pliku `.env` w aplikacji Termux.

### Android localhost otwiera stronę logowania albo zwraca 401/503

Instalacje środowiska Termux zarządzane przez plik APK chronią localhost prywatnym sekretem osobnym dla każdej instalacji. Aplikacja na system Android uwierzytelnia się automatycznie i podczas konfiguracji nie powinna wyświetlać strony logowania. Jeśli strona logowania pojawia się wewnątrz aplikacji Marinara Engine, zainstaluj [najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), ponownie dotknij **Install / Start Marinara** i wróć do aplikacji po zakończeniu pracy Termux.

Błąd wymieniający źródło `null` oznacza, że starsza para APK/serwer przepuściła nieprzejrzyste źródło WebView Androida do ogólnej kontroli CSRF przed prywatnym uzgadnianiem. Edycja `.env` tego nie naprawi: dosłowna wartość `null` jest celowo ignorowana, a globalne zaufanie nieprzejrzystemu źródłu osłabiłoby każdą trasę API zmieniającą dane. Zaktualizuj APK i Engine; obecne trasy logowania Androida sprawdzają własny jednorazowy dowód albo sekret instalacji, a `null` wszędzie indziej pozostaje odrzucane.

Ręcznego uwierzytelniania lokalnej przeglądarki wymaga tylko osobna przeglądarka na tym samym telefonie. Otwórz w niej `/android-login` i wklej wartość wyświetloną przez to polecenie w aplikacji Termux:

```bash
cat ~/.marinara-engine/android-secret
```

Lokalne narzędzie `mari` CLI automatycznie odczytuje ten sam plik. Kod 401 oznacza, że wklejony sekret albo wezwanie uwierzytelniające zostało odrzucone; odśwież `/android-login` i wklej bieżącą wartość. Kod 503 oznacza, że serwer dostał skonfigurowany sekret w złym formacie. Uruchom ponownie za pomocą `./start-termux.sh`. Jeśli program uruchamiający zgłosi, że plik sekretu jest nieprawidłowy albo pusty, wróć do aplikacji na system Android i dotknij **Install / Start Marinara**, żeby APK utworzył go ponownie. Nie umieszczaj tego sekretu na zrzutach ekranu ani w zgłoszeniach problemów.

### Aktualizacja w systemie Android zatrzymuje się z kodem wyjścia 134

Kod wyjścia 134 zwykle oznacza, że systemowi Android zabrakło pamięci na którymś kroku budowania. Zaktualizuj ponownie z najnowszego programu uruchamiającego:

```bash
./start-termux.sh
```

Jeśli nadal się zatrzymuje, zamknij inne aplikacje, otwórz Termux ponownie i wykonaj polecenie jeszcze raz.

### Termux zamyka się albo uruchamia ponownie podczas działania Marinara Engine

Program uruchamiający prosi o blokadę uśpienia Androida na czas działania serwera i zapisuje każdą sesję serwera w `~/.marinara-engine/logs/`. Po nieoczekiwanym restarcie dołącz do zgłoszenia najnowszy plik `server-*.log`. Jeśli plik kończy się bez błędu Marinara lub Node, najprawdopodobniej system Android albo producent telefonu zakończył Termux poza procesem serwera.

W ustawieniach Androida zezwól aplikacji Termux na działanie w tle i wyłącz dla niej optymalizację baterii. Na urządzeniach obsługujących dodatek Termux:API zainstaluj ten dodatek oraz pakiet `termux-api`, aby udostępnić `termux-wake-lock`. Te ustawienia nie zapobiegną każdemu zamknięciu procesu przez oprogramowanie producenta, ale usuwają typową przyczynę uśpienia przy bezczynności, a trwały log zachowuje ślady awarii na poziomie aplikacji.

### Podczas aktualizacji w systemie Android kończy się miejsce przy instalacji zależności

Zbudowana aplikacja Marinara Engine nie waży kilku gigabajtów, a Noodle nie pobiera własnych modeli AI. Duży chwilowy narzut w czasie aktualizacji bierze się zwykle z magazynu zależności pnpm i magazynu wirtualnego, zwłaszcza po kilku wydaniach albo po przerwanej wymuszonej reinstalacji.

Obecny program uruchamiający usuwa pakiety pozostałe po starszych wydaniach i nie przebudowuje magazynu zależności więcej niż raz na tę samą aktualizację. Jeśli starszy program zdążył zapełnić urządzenie, zaktualizuj go i zwolnij jego nieużywaną pamięć podręczną przed kolejną próbą:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Nie usuwaj `data`, `storage` ani `marinara-engine.db`; w tych miejscach mogą być czaty i ustawienia. Jeśli polecenie nadal się zatrzymuje, skopiuj linie od `Installing dependencies` i dołącz do zgłoszenia informacje o wolnym miejscu i pamięci telefonu.

### Aktualizacja w aplikacji zawodzi przy przełączaniu między Stable i Staging w systemie Android

Zmiana kanału (Stable ↔ Staging) wymusza niemal pełną reinstalację zależności, a na wolniejszej pamięci w aplikacji Termux trwa to znacznie dłużej niż zwykła aktualizacja. Wbudowany mechanizm aktualizacji daje teraz każdemu krokowi więcej czasu w systemie Android, więc zmiana kanału, która wcześniej kończyła się suchym `Update failed: Command failed: corepack pnpm ... install`, powinna dojść do końca.

Jeśli aktualizacja mimo to zawodzi, komunikat błędu nazywa teraz krok, który się nie powiódł, i dołącza końcówkę jego wyniku. Przeczytaj ten komunikat: prawdziwy błąd zależności albo pliku blokady jest opisany właśnie tam. Aktualizację można też wykonać ręcznie w aplikacji Termux poleceniem podanym w podpowiedzi przy błędzie albo najpierw zwolnić miejsce:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle pokazuje `Etc/Unknown` albo harmonogramy używają złej strefy czasowej

W przypadku harmonogramów w trybie Conversation otwórz **Chat Settings** dla trybu Conversation albo edytor harmonogramu postaci i wybierz **Schedule timezone**. Ten globalny wybór obowiązuje we wszystkich czatach w trybie Conversation, także w wiadomościach autonomicznych w tle, i można go wyzerować przyciskiem **Use device**.

W przypadku zadań sieci Noodle i zadań serwera bez ustawienia z trybu Conversation usuń z pliku `.env` pustą linię `TZ=` i uruchom aplikację Marinara Engine ponownie, żeby serwer przejął strefę czasową hosta. Aby wybrać rezerwową strefę hosta samodzielnie, wpisz poprawną nazwę IANA, na przykład `TZ=Europe/Warsaw` albo `TZ=America/New_York`. Obecne wydania traktują pustą wartość jako brak ustawienia, ale restart i tak jest potrzebny, żeby stan stref czasowych w Node i zaplanowane zadania odtworzyły się spójnie.

### Odmowa uprawnień do zamontowanego wolumenu w kontenerze

Jeśli kontener Docker albo Podman zgłasza błędy uprawnień do wolumenu z danymi:

- Przy wolumenach nazwanych po aktualizacji pobierz najnowszy obraz i uruchom wszystko ponownie poleceniem `docker compose pull && docker compose up -d`. Oficjalny obraz naprawia prawa własności przy starcie.
- Przy montowaniu folderu hosta nadaj mu prawo zapisu dla użytkownika i grupy o identyfikatorze `1000` albo użyj wolumenu nazwanego.
- W systemach z SELinux, takich jak Fedora czy RHEL, dodaj do montowania wolumenu przyrostek `:Z`.

### Kontener Lite przestaje działać na Raspberry Pi 4

Jeśli kontener lite restartuje się przy każdym żądaniu do AI na Raspberry Pi 4 albo podobnym urządzeniu ARM, sprawdź kod wyjścia. Kod 132 lub SIGILL wskazuje na znany problem po stronie źródła, w kompilacji Node w obrazie lite, na części układów ARM. SIGILL oznacza, że program trafił na instrukcję, której procesor nie potrafi wykonać.

Zwykły obraz (nie lite) nie ma tego problemu. Zanim poprawka trafi do źródła, używaj na tym urządzeniu zwykłego obrazu. Wiadomo o problemie w obrazach lite `1.5.7-lite` i `1.5.8-lite`. Ostatnio sprawdzone w wersji Marinara Engine 2.2.0.

### W sekcji Addons brakuje External Extensions

Ta sekcja jest celowo ukryta, dopóki nie zostaną otwarte obie blokady bezpieczeństwa:

1. Ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env` hosta.
2. Odczekaj około dwóch sekund, aż zadziała mechanizm śledzący konfigurację, potem otwórz **Settings → Advanced → Danger Zone**, przewiń poniżej opcji usuwania danych i włącz **Allow third-party extension imports**.

Jeśli przełącznik w sekcji **Danger Zone** jest nieaktywny, flaga hosta wciąż ma wartość false albo aplikacja nie zauważyła jeszcze zmiany. Sprawdź, czy edytowany plik `.env` leży w aktywnej ścieżce opisanej w przewodniku [Konfiguracja serwera](CONFIGURATION.md). W kontenerze Docker jest to zwykle `/app/data/.env`.

Gdy któraś blokada jest zamknięta, wpisy rozszerzeń zewnętrznych, starszych, zaimportowanych z profilu, zapisanych ręcznie i o nieznanym pochodzeniu nie pojawiają się i nie działają. Ponowne otwarcie blokad nie włącza ich automatycznie.

### Zaimportowane rozszerzenie przeglądarki jest widoczne, ale nie działa

Otwórz rozszerzenie w sekcji **Settings → Addons → External Extensions** i sprawdź pole **Requested access** (żądany zakres dostępu). Starsze pakiety w formacie `marinara.extension` v1 bez deklaracji uprawnień powinny pokazywać **Full page access**. Zatwierdź wyłącznie ten dokładny skrót, który sprawdzono i uznano za godny zaufania.

Jeśli starszy pakiet wyeksportowano ponownie z jawnie pustą listą uprawnień, Marinara traktuje go jak bezpieczne rozszerzenie w piaskownicy. Kod zależny od struktury strony (DOM) w takim rozszerzeniu nie zadziała. Wpis `full_page_access` dodaj do manifestu tylko wtedy, gdy jasne jest, że kod zyska dostęp do całej strony aplikacji Marinara Engine, pamięci przeglądarki, sieciowych API oraz sesji w tym samym źródle.

Po wyłączeniu rozszerzenia z dostępem do całej strony odśwież aplikację Marinara Engine, jeśli został jakiś element paska narzędzi, nakładka, nasłuch zdarzeń albo zmiana wyglądu. Marinara sprząta najlepiej, jak potrafi, bo kod strony może zostawić skutki poza śledzonym API zgodności.

### Rozszerzenie **Server Extension** zgłasza brak obsługiwanej piaskownicy

Rozszerzenia **Server Extensions** i surowe polecenia powłoki Professor Mari działają wyłącznie z mechanizmem Seatbelt w macOS albo Bubblewrap w systemie Linux. Oficjalny obraz Docker zawiera już Bubblewrap, ale domyślny kontener o minimalnych uprawnieniach nie może tworzyć jego zagnieżdżonych przestrzeni nazw i montowań. Marinara Engine wykrywa ten stan i wyłącza funkcje piaskownicy systemowej, zamiast wykonywać polecenia skazane na błąd.

Jeśli akceptujesz szersze uprawnienia kontenera i potrzebujesz tych funkcji w Dockerze, zapisz poniższy plik jako `docker-compose.override.yml` obok `docker-compose.yml`:

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

Następnie utwórz kontener ponownie. Serwer musi pozostać uruchomiony jako root, aby dodatkowe uprawnienie nie zniknęło, gdy punkt wejścia Marinara zwykle przechodzi na użytkownika `node`. root z `SYS_ADMIN` oznacza szerokie podniesienie uprawnień, a wyłączenie AppArmor dodatkowo osłabia zewnętrzną granicę bezpieczeństwa. Nie włączaj tego tylko po to, by ukryć komunikat. Ogólne ustawienie `seccomp=unconfined` nie powinno być potrzebne we współczesnym Dockerze.

Rozszerzenia **Server Extensions** działają wyłącznie z mechanizmem Seatbelt w systemie macOS albo Bubblewrap w systemie Linux. Zainstaluj `bwrap` na hoście z systemem Linux, a potem uruchom aplikację Marinara Engine ponownie. Windows, Android i inne nieobsługiwane systemy celowo odmawiają uruchomienia rozszerzenia **Server Extension**, zamiast wykonywać je w głównym procesie serwera. Rozszerzenia **Browser Extensions** nadal mogą korzystać ze swojej piaskownicy opartej na Worker z nieprzezroczystym źródłem.

## Uzyskiwanie dalszej pomocy

Jeśli problem nadal występuje, zbierz najpierw porządne informacje.

1. Otwórz **Settings** > **Advanced** > **Message Tools** i włącz **Debug mode**. Dzięki temu w konsoli serwera zapisują się pełne dane promptu i odpowiedzi, którymi można się podzielić.
2. Zanotuj system operacyjny, wersję Node.js i pełną treść błędu z konsoli serwera.

Zanim udostępnisz dane diagnostyczne, usuń klucze API, tokeny dostępu, sekrety administratora, prywatne prompty i prywatną treść czatów.

Potem odezwij się do społeczności:

- Przejrzyj otwarte zgłoszenia pod adresem https://github.com/Pasta-Devs/Marinara-Engine/issues
- Dołącz do serwera Discord po pomoc społeczności: https://discord.com/invite/KdAkTg94ME
- Zgłoś błąd pod adresem https://github.com/Pasta-Devs/Marinara-Engine/issues, dołączając zebrane wyżej informacje.

## Powiązane przewodniki

- [Najczęściej zadawane pytania](FAQ.md)
- [Konfiguracja serwera](CONFIGURATION.md)
- [Dostęp zdalny](REMOTE_ACCESS.md)
- [Aktualizacja aplikacji Marinara Engine](UPGRADING.md)
- [Łączenie z dostawcą AI](connections/connecting-to-a-provider.md)
- [Konfiguracja modelu Local Model](connections/local-model.md)
- [Game Mode: pierwsze kroki](game/getting-started.md)
- [Przegląd ustawień](settings/settings-overview.md)
