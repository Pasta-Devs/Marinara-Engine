# Konfiguracja modelu wbudowanego

**Built-in model** (model wbudowany) to mały model AI, który Marinara pobiera i uruchamia na twoim komputerze. Nie potrzebuje klucza API ani konta w internecie, a nic nie opuszcza twojego komputera.

Jest mały, więc nadaje się do pomocniczej pracy w tle: agentów typu tracker (pomocników, którzy śledzą szczegóły fabuły), efektów scen w trybie Game Mode, embeddingów lorebooków i sprawdzeń decyzyjnych. Na dobry roleplay czy poprawki Professor Mari jest za słaby. Do nich użyj mocniejszego konta. Zobacz [Łączenie z dostawcą AI](connecting-to-a-provider.md).

Jeśli brakuje karty **Built-in model**, masz instalację "Lite", czyli odchudzoną wersję bez lokalnego środowiska uruchomieniowego.

## Pobieranie modelu wbudowanego

Zanim zaczniesz, upewnij się, że masz wolne miejsce na dysku i pamięć (RAM) na model. Rozmiary podaje tabela poniżej.

1. Kliknij **Connections** (Połączenia) na górnym pasku.
2. Znajdź kartę **Built-in model** pod sekcją **Jobs** (zadania). Widnieje na niej **Not downloaded** (nie pobrano).
3. Kliknij kartę albo jej przycisk **Download** (pobranie). Otwiera się okno o tytule **Built-in model**.
4. W sekcji **Which model?** (który model?) wybierz model. **Gemma 4 E2B — Q8 (Best Quality)** ma etykietę **Recommended** (zalecany). Jeśli twój komputer ma mało pamięci, wybierz **Q4_K_M**. Potrzebuje około 3,4 GB RAM zamiast 5,4 GB.
5. Kliknij przycisk **Download** na dole. Pokazuje rozmiar modelu, na przykład **Download 5.0 GB**.
6. Poczekaj. Okno pokazuje trzy kroki: **Install runtime** (instalacja środowiska uruchomieniowego), **Download model** (pobranie modelu) i **Start and test** (uruchomienie i test). Środowisko uruchomieniowe to program, który uruchamia model. Jeśli go brakuje, Marinara najpierw je instaluje.
7. Gdy okno pokaże nazwę modelu z zieloną kropką, kliknij **Test** (test). Ramka o tytule **Local test message** (lokalna wiadomość testowa) pokazuje **Succeeded** (udało się) i czas odpowiedzi.
8. Kliknij **Done** (gotowe).

Karta pokazuje teraz **Ready** (gotowy) razem z rozmiarem modelu i zadaniami, które wykonuje.

Jeśli to nie zadziałało:

- **Sidecar runtime install is disabled** (komunikat o błędzie). Instalacja środowiska uruchomieniowego to działanie chronione. Zobacz [Zezwolenie na instalację środowiska uruchomieniowego](#allow-runtime-installs).
- **Local runtime failed to start.** Zobacz [Rozwiązywanie problemów](#troubleshooting).
- **Download failed.** Okno pokazuje błąd. Sprawdź połączenie z internetem i wolne miejsce na dysku, a potem ponownie kliknij przycisk pobierania.

To okno otworzysz też przyciskiem **Add** (dodaj) w panelu **Connections**: w oknie **Add account** (dodanie konta) znajdziesz je pod pozycją **Built-in model**.

### Gotowe presety

Okno proponuje dwa gotowe presety modelu Gemma 4 E2B, niewielkiego modelu firmy Google. Komputery z układem Apple Silicon dostają zamiast plików GGUF wersje MLX. GGUF i MLX to dwa formaty plików dla modeli lokalnych. Rozmiary poniżej to wartości, które pokazuje okno (w GB, gdzie 1 GB to 1024 × 1024 × 1024 bajtów).

| Preset | Pobieranie | RAM w trakcie pracy |
| --- | --- | --- |
| Q8 (Best Quality) | 5,0 GB | 5,4 GB |
| Q4_K_M (Smaller, Faster) | 3,0 GB | 3,4 GB |

Na Apple Silicon pojawiają się zamiast nich dwa presety MLX:

| Preset | Pobieranie | RAM w trakcie pracy |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5,5 GB | 7,0 GB |
| 4-bit MLX (Smaller, Faster) | 3,4 GB | 4,5 GB |

Marinara trzyma na dysku jeden model wbudowany naraz. Wybór innego modelu zastępuje poprzedni. Żeby później zmienić model, otwórz kartę i kliknij **Change model** (zmiana modelu) w oknie **Built-in model**. Na stronie karty przyciski obok pola **Model** (model) przełączają między presetami i najpierw proszą o potwierdzenie rozmiaru pobierania.

### Własny model

W sekcji **Your own model** (własny model) możesz użyć modelu GGUF z serwisu Hugging Face (publicznej platformy z modelami) albo pliku na komputerze, na którym działa Marinara.

1. Kliknij **Your own model**, a potem wybierz zakładkę: **Hugging Face** albo **File on the server** (plik na serwerze).
2. Na zakładce **Hugging Face** wpisz nazwę repozytorium w formacie `owner/repo`, a potem kliknij **Find files** (znajdź pliki). Wybierz jeden plik z listy.
3. Na zakładce **File on the server** wpisz pełną ścieżkę do pliku `.gguf`. Marinara używa pliku tam, gdzie leży, i go nie kopiuje.
4. Kliknij przycisk na dole: **Download** albo, dla pliku na serwerze, **Use this file** (użyj tego pliku).

Na Apple Silicon przycisk **Find files** nosi nazwę **Validate repo** (sprawdź repozytorium), a repozytorium musi być natywnie w formacie MLX. Plik GGUF na serwerze nadal tam działa i korzysta z llama.cpp zamiast z MLX.

## Używanie modelu wbudowanego do zadań pomocniczych

Po pobraniu modelu otwórz kartę **Built-in model**. Jej strona pokazuje stan modelu, zużycie pamięci i pole **Used by** (używany przez) oraz ma te kontrolki:

| Kontrolka | Co robi |
| --- | --- |
| **Use for tracker agents (roleplay)** | Utrzymuje model uruchomiony dla agentów typu tracker. Domyślnie wyłączony. |
| **Use for game scene analysis** | Utrzymuje model uruchomiony dla efektów scen w trybie Game Mode, takich jak tła, muzyka i pogoda. Domyślnie włączony. |
| **Use the built-in model for all tracker agents** | Kieruje wszystkich wbudowanych agentów typu tracker na ten model. Nie włącza samych agentów. |
| **Change in Defaults** | Otwiera sekcję **Jobs**, w której możesz przydzielić mu inne zadania. |

Gdy oba przełączniki są wyłączone, model nie uruchamia się sam. Startuje, gdy włączysz jeden z nich albo gdy użyje go czat lub zadanie. O włączaniu agentów przeczytasz w przewodniku [Memory Recall i podsumowania czatu](../agents/memory.md).

W konfiguracji trybu Game Mode pole **Scene effects model** (model efektów scen) może korzystać z modelu wbudowanego. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

### Embeddingi lorebooków

Embeddingi to liczby, dzięki którym lorebook może wyszukiwać po znaczeniu. Żeby tworzył je model wbudowany, wybierz **Built-in model (on this device)** (model wbudowany, na tym urządzeniu) jako model wektoryzacji lorebooka. Najpierw włącz **Use for tracker agents (roleplay)** albo **Use for game scene analysis**, bo inaczej zapytanie kończy się błędem. Ta droga wymaga środowiska GGUF, więc nie działa w środowisku MLX na Apple Silicon. Zobacz [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md).

### Model decyzyjny

Model wbudowany możesz też wybrać jako swój model decyzyjny. Zobacz [Modele decyzyjne](decision-models.md).

### Model czatu

Żeby czatować z modelem wbudowanym:

1. Otwórz czat i kliknij przycisk modelu w polu wiadomości (ikona linku).
2. W oknie **Model for this chat** (model dla tego czatu) wybierz **Built-in model (on this device)**. Ta pozycja jest na dole listy i pojawia się, gdy model jest już pobrany.
3. Wyślij wiadomość. Ostrzeżenie informuje, że model jest mały, więc odpowiedzi mogą być wolne, krótkie albo słabej jakości.

## Ustawienia środowiska uruchomieniowego

Żeby je otworzyć, kliknij **Runtime settings** (ustawienia środowiska uruchomieniowego) na stronie karty albo **Settings** (Ustawienia) w oknie **Built-in model**. Są podzielone na cztery grupy. Listy rozwijane i przełączniki zapisują się od razu. Pola liczbowe zapisują się po kliknięciu **Apply settings** (zastosowanie ustawień). **Physical batch size** i **Custom GPU layers** mają własne przyciski **Apply** (zastosowanie).

**Speed** (szybkość)

| Ustawienie | Domyślnie | Co robi |
| --- | --- | --- |
| **Runtime target** | Auto detect | Rodzina kart graficznych, pod którą Marinara instaluje środowisko. |
| **GPU offload** | Auto offload | Ile pracy trafia na kartę graficzną. Wybierz **Auto offload**, **CPU only** albo **Custom GPU layers** (od 1 do 1024). |

**Memory** (pamięć)

| Ustawienie | Domyślnie | Co robi |
| --- | --- | --- |
| **Context window** | 8192 | Ile tekstu model czyta naraz, w tokenach. Co najmniej 512. |
| **KV cache type** | f16 | Jak model przechowuje to, co przeczytał. Wybierz f16, q8_0 albo q4_0. Dwa ostatnie zużywają mniej pamięci i wymagają obsługi Flash Attention. |

**Replies** (odpowiedzi)

| Ustawienie | Domyślnie | Co robi |
| --- | --- | --- |
| **Max response tokens** | 4096 | Najdłuższa odpowiedź, jaką model może napisać. Co najmniej 64. |
| **Temperature** | 0.3 | Jak losowe są odpowiedzi. Od 0 do 2. |
| **Top P** | 0.95 | Ograniczenie doboru słów. Powyżej 0, najwyżej 1. |
| **Top K** | 64 | Ograniczenie doboru słów. Od 0 do 500. |

**Expert** (ustawienia eksperckie)

| Ustawienie | Domyślnie | Co robi |
| --- | --- | --- |
| **Native tool calls** | On | Pozwala modelowi używać narzędzi. Professor Mari i własni agenci wymagają, żeby było włączone. |
| **Max parallel agent jobs** | 2 | Ile zadań działa naraz. Od 1 do 16. |
| **Pooling type** | None | Jak model zamienia tekst na liczby na potrzeby wyszukiwania w lorebookach. Do embeddingów lorebooków wybierz **Mean**. |
| **Physical batch size** | 512 | Ilość tekstu w jednej partii embeddingów lorebooka. Od 128 do 32768. Podnieś tę wartość, gdy długie wpisy się nie udają. Gemma często działa z 1024. |

Niektóre ustawienia zależą od systemu:

- **Runtime target** w systemach Windows i Linux (x64) oferuje Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only i System llama-server. Inne systemy oferują mniej opcji.
- Na Apple Silicon akcelerator wybiera za ciebie MLX. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type** i **Physical batch size** się nie pojawiają.
- **Max response tokens** nie ogranicza analizy scen w trybie Game Mode, która ma własny limit.
- **Diagnostics** (diagnostyka) w grupie **Expert** pokazuje kompilację środowiska uruchomieniowego, wykrytą kartę graficzną i ostatnie polecenie uruchomienia.

<a id="allow-runtime-installs"></a>

### Zezwolenie na instalację środowiska uruchomieniowego

Instalacja i ponowna instalacja środowiska uruchomieniowego to działanie chronione. Instalacje jednym kliknięciem w systemie Windows zezwalają na nie za ciebie. W systemach macOS i Linux oraz w kontenerze Docker zrób jedną z tych rzeczy, a potem spróbuj ponownie:

- Wpisz sekret administratora w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny). Sekret administratora to drugie hasło do ryzykownych działań. Tworzysz go w sekcji **Admin Access** na komputerze, na którym działa serwer, albo ustawiasz jako `ADMIN_SECRET` w pliku `.env` serwera. Zobacz [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Dodaj `SIDECAR_RUNTIME_INSTALL_ENABLED=true` do pliku `.env` serwera, a potem uruchom ponownie aplikację Marinara Engine. Plik `.env` to plik tekstowy w folderze aplikacji Marinara Engine. Zobacz [Edycja pliku .env](../CONFIGURATION.md#edit-the-env-file).

Marinara pobiera tylko te wersje llama.cpp, MLX i uv, które zatwierdzono dla twojego wydania, i przed uruchomieniem czegokolwiek sprawdza rozmiar i sumę kontrolną SHA-256 każdego pliku.

## Lokalny model mowy

**Local speech model** (lokalny model mowy) zamienia twój głos na tekst na twoim komputerze na potrzeby rozmów w trybie Conversation. To model Whisper, czyli model zamiany mowy na tekst. Wymaga pakietu agenta **Calls**, który instalujesz w **Agents → Agent Organizer** (agenci, organizowanie agentów).

1. Otwórz panel **Connections** i kliknij pozycję **Speech to text** (zamiana mowy na tekst) w sekcji **On this device** (na tym urządzeniu).
2. W sekcji **Local speech model** wybierz model z listy rozwijanej.
3. Kliknij **Download Whisper** (pobranie modelu Whisper).
4. Poczekaj na **Ready**. Zanim użyjesz Calls, uruchom aplikację Marinara Engine całkowicie od nowa.

| Model | Pobieranie | RAM w trakcie pracy |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | około 180 MB | około 350 MB |
| Whisper Base (Multilingual) | około 320 MB | około 650 MB |

Tiny to najlepszy pierwszy wybór dla telefonów i starszych komputerów. Base dokładniej rozpoznaje niewyraźną mowę, ale wolniej startuje. Kliknij **Delete Local Whisper** (usunięcie modelu Local Whisper, przycisk kosza), żeby usunąć pobrany model. Odinstalowanie Calls też go usuwa.

Twój dźwięk zostaje na twoim komputerze. Do modelu czatu trafia tylko tekst. Żeby użyć tego modelu w rozmowie, ustaw wejście audio rozmowy na Local Whisper. Zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md). Jeśli zamiast tego włączysz serwer **Speech to text**, rozmowy wysyłają twoją mowę na ten serwer. Zobacz [Użyj własnego serwera zamiany mowy na tekst](../conversation/calls.md#use-your-own-speech-to-text-server).

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

| Objaw | Rozwiązanie |
| --- | --- |
| **Sidecar runtime install is disabled** (komunikat o błędzie). | Zobacz [Zezwolenie na instalację środowiska uruchomieniowego](#allow-runtime-installs). |
| **Local runtime failed to start.** Okno pokazuje błąd i ścieżkę do pliku z logami. Karta pokazuje **Local runtime unavailable**. | Kliknij **Retry startup** (ponowne uruchomienie). Jeśli to nie pomoże, kliknij **Reinstall runtime** (ponowna instalacja środowiska) albo wybierz inny **Runtime target**. **Continue without local AI** (kontynuacja bez lokalnej AI) wyłącza przełączniki pomocnicze i pozwala dalej korzystać z aplikacji Marinara Engine bez modelu. |
| Pobieranie środowiska uruchomieniowego zgłasza niezgodny rozmiar albo sumę kontrolną SHA-256. | Marinara odrzuciła plik. Zaktualizuj aplikację Marinara Engine i spróbuj ponownie. Jeśli dalej się nie udaje, nie otwieraj pliku samodzielnie. Zgłoś wybrane docelowe środowisko uruchomieniowe i treść błędu. |
| Wyszukiwanie w lorebooku zgłasza, że model lokalny nie jest włączony. | Włącz **Use for tracker agents (roleplay)** albo **Use for game scene analysis**, a potem ponów wektoryzację. |
| Baner w trybie Game Mode pokazuje **Local scene helper failed to start**. | Kliknij w banerze **Open Local AI Model**, żeby spróbować ponownie, zmienić model albo wyłączyć lokalną analizę scen. |

Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Modele decyzyjne](decision-models.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Memory Recall i podsumowania czatu](../agents/memory.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md)
