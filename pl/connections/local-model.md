# Konfiguracja modelu Local Model

Ten przewodnik wyjaśnia, czym jest wbudowany **Local Model** (model lokalny) – niewielki model AI, który Marinara Engine pobiera i uruchamia na twoim komputerze. Nie potrzebuje klucza API ani konta w internecie. Znajdziesz tu opis konfiguracji, sekcji **Runtime Settings** (ustawienia środowiska uruchomieniowego) oraz tego, jak Local Model napędza pomocników: agentów typu tracker, efekty scen w Game Mode i transkrypcję rozmów bez internetu.

## Czym jest Local Model

**Local Model** to kompaktowy model językowy (Gemma), który działa w całości na twoim komputerze. Klucz API to tajny kod, trochę jak hasło, dzięki któremu Marinara łączy się z usługą AI w internecie. Local Model nie potrzebuje klucza API, bo nic nie opuszcza twojego komputera.

Local Model jest celowo mały. Ma wykonywać pomocnicze zadania w tle, a nie prowadzić główny czat czy roleplay. Marinara używa go do takich prac:

- Agenci typu tracker w trybie Roleplay.
- Efekty scen w Game Mode, na przykład tła, muzyka i pogoda.
- Embeddingi lorebooków na potrzeby wyszukiwania semantycznego.
- Transkrypcja z mikrofonu w rozmowach w trybie Conversation, przez osobny model mowy.
- Odpowiadanie na pytania aktywacyjne i stwierdzenia decyzyjne, jeśli wybierzesz go jako model decyzyjny. Zobacz [Modele decyzyjne](decision-models.md).

W oknie konfiguracji funkcja nazywa się **Local AI Model**. Na listach rozwijanych z połączeniami widnieje jako **Local Model (sidecar)**. To jedno i to samo.

Nie używaj modelu Local Model do głównego czatu, roleplayu, narracji Game Master ani poprawek Professor Mari. Jest na to za mały i wyniki będą słabe. Wybierz do tych zadań mocniejsze połączenie. Zobacz [Łączenie z dostawcą AI](connecting-to-a-provider.md).

## Otwieranie karty Local Model

Local Model znajduje się w panelu **Connections** (Połączenia).

1. Otwórz panel **Connections**.
2. Znajdź kartę o nazwie **Local Model**.
3. Kliknij kartę albo jej przycisk koła zębatego o nazwie **Open local model settings**.

Przycisk koła zębatego otwiera pełne okno konfiguracji o tytule **Local AI Model**. Jeśli żaden model nie został jeszcze pobrany, karta pokazuje dodatkowo przycisk **Download now** i przycisk **Choose model options**. Oba otwierają to samo okno konfiguracji.

W oknie konfiguracji widać ramkę z ostrzeżeniem o tytule **Local Model is for helpers, not main roleplay**. Powtarza ona, że model służy wyłącznie do zadań pomocniczych.

## Obsługiwany sprzęt i systemy operacyjne

Local Model pobiera środowisko uruchomieniowe (program, który uruchamia model) oraz plik modelu. Komputer musi mieć dość wolnego miejsca na dysku i pamięci (RAM) na jedno i drugie.

Zakres obsługi zależy od systemu operacyjnego:

- **Windows (64-bit) i Linux (64-bit)**: dostajesz pełną listę **Runtime Target**, więc możesz wybrać rodzinę swojej karty graficznej (GPU) albo pracę wyłącznie na procesorze (CPU).
- **Windows na ARM i Linux na ARM**: zawężony zestaw opcji, głównie oparty na CPU.
- **macOS na Apple Silicon**: Marinara korzysta ze środowiska MLX, dostrojonego do układów Apple. Własne modele to repozytoria HuggingFace, a nie pojedyncze pliki.
- **macOS na Intel i Android**: w praktyce tylko CPU.

Local Model nie jest dostępny w instalacjach "Lite". Instalacja Lite to odchudzona wersja, która pomija lokalne środowisko uruchomieniowe, żeby zaoszczędzić miejsce. W instalacji Lite karta Local Model w ogóle się nie pojawia.

## Pierwsza konfiguracja

Najpierw przygotuj środowisko uruchomieniowe, potem wybierz model.

1. Otwórz okno konfiguracji **Local AI Model**.
2. Kliknij przycisk **Install Runtime**. Na Apple Silicon przycisk nosi nazwę **Install MLX Runtime**.
3. Poczekaj, aż środowisko uruchomieniowe się zainstaluje. Postęp pobierania pokazuje pasek.
4. Wybierz model zgodnie z sekcją **Pobieranie modelu** poniżej.
5. Poczekaj na koniec pobierania modelu.
6. Kiedy status pokaże **Ready**, kliknij przycisk **Done**.

Jeśli to jeszcze nie czas na dokończenie, kliknij przycisk **Skip for Now**. Gdy model już istnieje, przycisk ten nosi nazwę **Close**.

Instalacja i ponowna instalacja środowiska uruchomieniowego to działanie chronione. W instalacjach jednym kliknięciem na Windows włącza się automatycznie. Na macOS, Linux i w kontenerze Docker trzeba je czasem dopuścić samodzielnie. Zobacz sekcję **Rozwiązywanie problemów** poniżej.

Marinara pobiera tylko te wersje llama.cpp, MLX i uv, które zatwierdzono dla zainstalowanego wydania aplikacji Marinara Engine. Przed rozpakowaniem lub uruchomieniem czegokolwiek sprawdza dokładny rozmiar pliku i sumę kontrolną SHA-256. Zestaw zależności Python dla środowiska MLX ma zablokowane wersje i też przechodzi weryfikację sum kontrolnych. Sprawdzone źródło mlx-lm instaluje się dopiero potem, bez doinstalowywania dodatkowych pakietów. Nowe wersje środowiska uruchomieniowego przychodzą więc ze sprawdzonymi aktualizacjami aplikacji Marinara Engine, a nie po cichu z najnowszej kompilacji "latest" z zewnątrz.

## Pobieranie modelu

Okno konfiguracji daje dwie drogi do zdobycia modelu.

### Gotowe presety

W sekcji **Curated Gemma 4 Presets** wybierasz jedną z dwóch gotowych opcji. Na sprzęcie innym niż Apple korzystają one z formatu GGUF:

| Preset | Rozmiar pobierania | RAM w trakcie pracy |
| --- | --- | --- |
| Q8 (Best Quality) | około 5,4 GB | około 5,8 GB |
| Q4_K_M (Smaller, Faster) | około 3,2 GB | około 3,6 GB |

Opcja Q8 ma etykietę **Recommended**. Daje najlepszą jakość. Opcja Q4_K_M jest mniejsza i szybsza, a do tego zużywa mniej pamięci.

Na Apple Silicon w ich miejsce pojawiają się presety MLX. Preset 8-bitowy MLX wymaga około 5,9 GB pobierania i około 7,5 GB RAM. Preset 4-bitowy MLX wymaga około 3,6 GB pobierania i około 4,8 GB RAM.

Aby pobrać preset:

1. Zaznacz wybrany preset.
2. Kliknij przycisk **Use Curated Preset**. Jeśli jakiś model już jest, przycisk nosi nazwę **Switch to Curated Preset**.

### Własny model

W sekcji **Use Your Own Model From HuggingFace** możesz podać własny model z serwisu HuggingFace, publicznej platformy z modelami.

1. Wpisz w polu nazwę repozytorium. Format to `owner/repo`.
2. Kliknij przycisk **List Models**. Na Apple Silicon przycisk nosi nazwę **Validate Repo**.
3. Na sprzęcie innym niż Apple wybierz konkretny plik z listy rozwijanej, a potem kliknij przycisk **Download Selected GGUF**.
4. Na Apple Silicon po sprawdzeniu repozytorium kliknij przycisk **Use Validated MLX Repo**.

Marinara trzyma na dysku tylko jeden plik modelu Local Model naraz. Pobranie nowego modelu najpierw kasuje poprzedni. Dla głównego modelu Local Model nie ma osobnego przycisku usuwania. Żeby go usunąć, pobierz na jego miejsce inny model.

## Ustawienia w sekcji Runtime Settings

Otwórz sekcję **Runtime Settings** w oknie konfiguracji, żeby dostroić pracę modelu. Poszczególne pola zapisują się na różne sposoby:

- Listy rozwijane i przełącznik **Native Tool Calls** zapisują się od razu po zmianie.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P** i **Top K** działają dopiero po kliknięciu przycisku **Apply Settings**.
- Pole **Physical Batch Size** ma własny przycisk **Apply**. Tak samo pole z liczbą warstw, które pojawia się przy ustawieniu **GPU Offload** na **Custom GPU layers**.

| Ustawienie | Domyślnie | Za co odpowiada |
| --- | --- | --- |
| Runtime Target | Auto detect | Rodzina GPU, pod którą Marinara instaluje środowisko |
| GPU Offload | Auto offload | Ile pracy trafia na GPU |
| Native Tool Calls | On | Pozwala modelowi używać narzędzi i wywołań funkcji |
| Pooling Type | None | Matematyka embeddingów dla wyszukiwania w lorebookach |
| Physical Batch Size | 512 | Rozmiar partii dla zapytań o embeddingi lorebooków |
| Context Window | 8192 | Ile tekstu model czyta naraz |
| Max Response Tokens | 4096 | Najdłuższa odpowiedź, jaką model może napisać |
| Temperature | 0.3 | Jak losowe są odpowiedzi |
| Top P | 0.95 | Ograniczenie losowania przy doborze słów |
| Top K | 64 | Ograniczenie losowania przy doborze słów |

Uwagi o trudniejszych polach:

- **Runtime Target** i **GPU Offload** pojawiają się tylko w środowisku GGUF. Na Apple Silicon środowisko MLX samo dobiera akcelerator.
- **Pooling Type** i **Physical Batch Size** też pojawiają się tylko w środowisku GGUF, pod nagłówkiem **Embedding Endpoint**. Dostrajają wyłącznie embeddingi lorebooków. Nie zmieniają zwykłych odpowiedzi w czacie.
- Pole **Pooling Type** stoi domyślnie na **None**. Przestaw je na **Mean**, kiedy używasz modelu Local Model do embeddingów lorebooków.
- Pole **Physical Batch Size** decyduje o tym, ile tekstu endpoint embeddingów bierze w jednej partii. Podnieś je, gdy długie wpisy lorebooka nie dają się zwektoryzować. Aplikacja podpowiada wartość 1024 dla modelu Gemma.
- Przełącznik **Native Tool Calls** musi być włączony, żeby narzędzia działały. Ostrzeżenie mówi, że Professor Mari i własni agenci potrzebują tej opcji, zanim model lokalny będzie mógł uruchamiać narzędzia. W środowisku MLX ta opcja jest niedostępna.
- Pole **Max Response Tokens** ogranicza zwykłe odpowiedzi w czacie i odpowiedzi agentów. Nie dotyczy analizy scen w Game Mode, która ma własny wewnętrzny limit.

## Przycisk Send Test Message

Użyj przycisku **Send Test Message**, żeby sprawdzić, czy środowisko uruchomieniowe działa. Przycisk znajduje się w sekcji Runtime. Jest nieaktywny, dopóki model nie zostanie pobrany, a środowisko zainstalowane.

1. Kliknij przycisk **Send Test Message**.
2. Poczekaj na ramkę z wynikiem.
3. Ramka sukcesu pokazuje napis **Local Test Message Succeeded** i czas odpowiedzi.
4. Ramka błędu pokazuje napis **Local Test Message Failed** i treść błędu.

Test korzysta ze stałego promptu. Pomija ustawienia Temperature i limity tokenów, więc jest czystym sprawdzeniem, czy model w ogóle odpowiada.

## Local Model jako pomocnik

Kiedy model jest już pobrany, karta Local Model pokazuje dwa przełączniki:

- **Use for tracker agents (roleplay)**. Domyślnie wyłączony.
- **Use for game scene analysis**. Domyślnie włączony.

Te dwa przełączniki decydują o tym, czy Marinara utrzymuje Local Model uruchomiony w tle. Gdy oba są wyłączone, środowisko uruchomieniowe nie startuje samo. Włączenie któregokolwiek sprawia, że Marinara automatycznie uruchamia lokalny serwer. Pierwszy start po włączeniu może chwilę potrwać.

Na karcie jest też przycisk **Use local model for all tracker agents**. Jednym kliknięciem przestawia wszystkich wbudowanych agentów typu tracker na Local Model. Linijka poniżej pokazuje, ilu agentów typu tracker wskazuje na model lokalny, na przykład "3/7 built-in tracker agents currently point at the local model." Zmienia się przy tym wyłącznie używany model. Sami agenci nie zostają włączeni. O włączaniu agentów przeczytasz w przewodniku [Memory Recall i podsumowania czatu](../agents/memory.md) oraz w przewodniku po wybranym trybie.

W Game Mode pracę nad scenami też można przekierować na Local Model. W konfiguracji gry lista rozwijana **Scene Effects Connection** zawiera pozycję **Local Model (Gemma)**. Jej wybór włącza przełącznik **Use for game scene analysis**. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

### Local Model do embeddingów lorebooków

Local Model może napędzać semantyczne wyszukiwanie w lorebookach. W ustawieniach wektoryzacji lorebooka wybierz jako połączenie **Local Model (sidecar)**. Wcześniej trzeba włączyć **Use for tracker agents (roleplay)** albo **Use for game scene analysis**. Jeśli oba są wyłączone, zapytanie kończy się błędem z informacją, że model lokalny musi być włączony dla trackerów albo dla analizy scen w grze. Ta droga korzysta ze środowiska GGUF i nie jest dostępna w środowisku MLX na Apple Silicon. Zobacz [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md).

## Local Model jako połączenie czatu

Kiedy model jest już pobrany, Local Model pojawia się na dole większości list wyboru połączenia. Widnieje jako **Local Model (sidecar)** albo jako **Local Model** z nazwą modelu w nawiasie, gdy ta nazwa jest znana.

Po wybraniu go do zwykłego czatu pojawia się ostrzeżenie. Mówi ono, że Local Model jest malutki i przeznaczony do zadań pomocniczych. Uprzedza też, że odpowiedzi w głównym czacie i w roleplayu mogą być wolne, krótkie albo słabej jakości. Ta pozycja nie jest prawdziwym zapisanym połączeniem, więc nie da się zapisać dla niej domyślnych ustawień połączenia.

Wybór modelu do czatu uruchamia lokalny serwer na żądanie, nawet gdy oba przełączniki pomocnicze są wyłączone. Lista rozwijana z głównym modelem w Game Mode go nie zawiera. Game Mode korzysta z modelu Local Model wyłącznie przez **Scene Effects Connection**.

## Local Speech Model do rozmów

**Local Speech Model** to opcjonalny plik do pobrania dla agenta Calls, odpowiadający za transkrypcję z mikrofonu bez internetu. Napędza rozmowy w trybie Conversation, kiedy głos ma być zamieniany na tekst na twoim komputerze. To model Whisper, czyli model zamieniający wypowiadane słowa na tekst.

Najpierw zainstaluj **Calls** z sekcji **Agents > Download Agents**. Potem możesz zarządzać modelem Whisper z karty **Local Model** w panelu Connections, pod nagłówkiem **Local Speech Model**. Ten nagłówek i przyciski pobierania pozostają ukryte, dopóki Calls nie jest zainstalowany.

Do wyboru są dwie opcje:

- **Whisper Tiny (Multilingual)**: około 180 MB pobierania, około 350 MB RAM. Najlepszy wybór na start dla telefonów i starszych komputerów.
- **Whisper Base (Multilingual)**: około 320 MB pobierania, około 650 MB RAM. Lepsza dokładność przy niewyraźnej mowie, ale wolniejszy start.

Aby go skonfigurować:

1. Otwórz kartę **Local Model** i rozwiń ją.
2. Pod nagłówkiem **Local Speech Model** wybierz model z listy rozwijanej.
3. Kliknij przycisk **Download Whisper**.
4. Gdy pojawi się status **Ready**, wszystko jest gotowe.

Żeby usunąć tylko wybrany model, kliknij przycisk kosza o nazwie **Delete Local Whisper**. Odinstalowanie agenta Calls automatycznie usuwa wszystkie pobrane modele Whisper wraz z zapisanym wyborem i odzyskuje zajmowane przez nie miejsce na dysku. Po ponownej instalacji agenta Calls ustawienia Local Speech Model wracają i model Whisper można pobrać jeszcze raz.

Nagrany dźwięk nigdy nie opuszcza twojego komputera. Do wybranego połączenia czatu trafia wyłącznie tekst transkrypcji. Żeby użyć go w rozmowie, ustaw tryb wejścia audio rozmowy na opcję Local Whisper. Zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).

## Rozwiązywanie problemów

**"Sidecar runtime install is disabled."** Instalacja i ponowna instalacja środowiska uruchomieniowego to działanie chronione. Instalacje jednym kliknięciem na Windows włączają je za ciebie. Na macOS, Linux i w kontenerze Docker masz dwie możliwości. Ustaw `SIDECAR_RUNTIME_INSTALL_ENABLED=true` w pliku `.env` serwera, na przykład:

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

Druga opcja: wpisz raz sekret Admin Access w **Settings -> Advanced -> Admin Access** i spróbuj ponownie. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

**Środowisko uruchomieniowe nie wystartowało.** Okno konfiguracji pokazuje ramkę o tytule **Local runtime failed to start**, a w niej treść błędu i ścieżkę do pliku z logami. Kliknij przycisk **Retry Startup**. Jeśli to nie pomoże, kliknij przycisk **Reinstall Runtime** albo wypróbuj inny **Runtime Target**. Przycisk **Continue Without Local AI** pozwala korzystać z aplikacji Marinara Engine bez modelu Local Model. Karta w panelu Connections sygnalizuje ten sam problem napisem **Local runtime unavailable**.

**Pobieranie środowiska uruchomieniowego zgłasza niezgodny rozmiar albo sumę kontrolną SHA-256.** Marinara odrzuciła pobrany plik jeszcze przed rozpakowaniem. Zaktualizuj najpierw aplikację Marinara Engine, a potem spróbuj ponownie, żeby zatwierdzona lista środowisk i pobierany plik znów się zgadzały. Jeśli to samo wydanie dalej zawodzi, nie rozpakowuj ani nie uruchamiaj archiwum ręcznie – zgłoś opiekunom projektu wybrane środowisko uruchomieniowe i treść błędu.

**Wyszukiwanie w lorebooku zgłasza, że model lokalny nie jest włączony.** Włącz na karcie Local Model przełącznik **Use for tracker agents (roleplay)** albo **Use for game scene analysis**, a potem ponów wektoryzację.

**Baner w Game Mode pokazuje "Local scene helper failed to start."** Kliknij w banerze **Open Local AI Model**, żeby spróbować ponownie, zmienić model albo wyłączyć lokalną analizę scen.

Więcej pomocy znajdziesz w [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Modele decyzyjne](decision-models.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Memory Recall i podsumowania czatu](../agents/memory.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md)
