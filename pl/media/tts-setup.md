# Konfiguracja syntezy mowy (TTS)

Z tego przewodnika dowiesz się, jak uruchomić syntezę mowy w aplikacji Marinara Engine, żeby aplikacja czytała wiadomości i narrację gry na głos. Synteza mowy (TTS) zamienia napisany tekst czatu w mówiony dźwięk. Znajdziesz tu wybór dostawcy głosów, dobór głosów, automatyczne odtwarzanie i sterowanie odtwarzaniem przy pojedynczej wiadomości.

## Gdzie są ustawienia TTS

Prawie wszystkie ustawienia TTS mieszczą się w jednym miejscu. Otwórz panel **Connections** (Połączenia) i znajdź sekcję **Text to Speech**. Sekcja jest domyślnie zwinięta, więc kliknij jej nagłówek, żeby ją rozwinąć.

Aplikacja wysyła żądania TTS przez własny serwer. Marinara szyfruje klucz API dostawcy i tak zaszyfrowany trzyma go na serwerze. Po zapisaniu klucza pole pokazuje wartość zamaskowaną, czyli rząd kropek, a nie prawdziwy klucz. Prawdziwy klucz nigdy nie wraca do przeglądarki.

Samo włączenie TTS niczego jeszcze nie odczyta. Odsłania tylko przycisk **Speak** (Mów) przy każdej wiadomości oraz opcje **Auto-play** (automatyczne odtwarzanie). O tym, co i kiedy zostanie przeczytane, nadal decydujesz sam.

Te same ustawienia odtwarzania pozwalają też włączyć **Skip text inside HTML and custom tags** (pomijaj tekst wewnątrz znaczników HTML i własnych znaczników), **Skip fenced code blocks** (pomijaj ogrodzone bloki kodu) lub **Skip text inside square brackets** (pomijaj tekst w nawiasach kwadratowych). Bloki kodu są domyślnie pomijane; pozostałe dwa filtry są początkowo wyłączone. Filtrowanie znaczników usuwa ich zawartość, na przykład ukryty blok `<simulation>...</simulation>`, ale zachowuje znaczniki mówców używane do wyboru głosów. Filtry działają przy ręcznym i automatycznym odtwarzaniu, także dla narracji Game i rozpoznawania mówców w Roleplay.

## Krok 1: włącz TTS i wybierz Source

1. Otwórz panel **Connections** i rozwiń sekcję **Text to Speech**.
2. Kliknij przełącznik w nagłówku sekcji, żeby włączyć TTS. Najedź na przełącznik, a zobaczysz podpowiedź: **Enable TTS**, gdy jest wyłączony, i **Disable TTS**, gdy jest włączony.
3. Otwórz listę rozwijaną **Source** (źródło) i wskaż dostawcę.

Pole **Source** określa usługę, która tworzy dźwięk. Do wyboru są cztery opcje:

- **OpenAI-compatible**: OpenAI albo dowolny serwer naśladujący format TTS od OpenAI.
- **ElevenLabs**: usługa głosowa ElevenLabs.
- **PocketTTS**: darmowy serwer głosowy uruchamiany na własnym komputerze.
- **xAI Voice**: usługa głosowa xAI.

Domyślne źródło to **OpenAI-compatible**. Marinara trzyma osobny zapisany profil dla każdego źródła, razem z zaszyfrowanym kluczem API, adresem, modelem, głosami i parametrami dostawcy. Zmiana źródła przywraca poprzednią konfigurację tego źródła; źródło jeszcze nieskonfigurowane startuje z wartościami domyślnymi.

## Krok 2: wpisz Base URL, API Key i Model

Każde źródło potrzebuje adresu internetowego, a większość z nich także klucza API. Klucz API to tajny kod od dostawcy, trochę jak hasło, który potwierdza, że żądanie pochodzi od ciebie.

1. Sprawdź pole **Base URL** (adres bazowy). Każde źródło wpisuje tu sensowną wartość domyślną z tabeli poniżej. Zmieniaj ją tylko przy korzystaniu z proxy albo z własnego serwera.
2. Wklej klucz dostawcy w pole **API Key** (klucz API). Żeby zachować dotychczasowy klucz, zostaw zamaskowane kropki bez zmian. Żeby usunąć zapisany klucz, wyczyść pole.
3. Sprawdź pole **Model**. Każde źródło wpisuje tu model domyślny. Można wpisać nazwę innego modelu obsługiwanego przez dostawcę.

Aplikacja wstawia takie wartości domyślne dla poszczególnych źródeł:

| Source            | Domyślny Base URL         | Domyślny Model         | Głos wstawiany domyślnie przez aplikację |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | brak (trzeba wybrać samodzielnie) |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

W przypadku źródła **ElevenLabs** pole **Model** wczytuje modele mowy dostępne przez twoje połączenie i po otwarciu zawsze pokazuje pełną listę. Wybierz zwykły model mowy. Identyfikatory modeli zawierające `ttv` należą do modeli projektowania głosu, a nie do modeli mowy, i nie potrafią czytać tekstu na głos. Po pomyłkowym wyborze takiego modelu odtwarzanie kończy się błędem z informacją, że trzeba użyć modelu mowy.

### PocketTTS to osobny program

PocketTTS nie jest częścią aplikacji Marinara Engine. Adapter aplikacji Marinara Engine korzysta z serwera [PocketTTS zgodnego z OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server), który udostępnia zarówno punkt końcowy mowy, jak i listę głosów. Zainstaluj i uruchom ten serwer zgodnie z jego instrukcją; Marinara go nie pobiera ani nim nie zarządza.

Zgodny serwer domyślnie działa pod adresem `http://localhost:49112`. Zostaw tę wartość w polu **Base URL**, chyba że port serwera został zmieniony. Wcześniej wpisane własne adresy PocketTTS pozostają bez zmian.

## Krok 3: wybierz głos (Voice Option)

Ustawienie **Voice Option** (opcja głosu) decyduje o tym, jak przydzielane są głosy:

- **One voice for all characters**: każda mówiąca osoba używa tego samego głosu. To ustawienie domyślne.
- **Selected per character**: wybrane postacie dostają własne głosy.

### Jeden głos dla wszystkich postaci

Wskaż głos w polu **All Characters Voice**. Źródło PocketTTS pokazuje na liście rozwijanej głosy zwrócone przez twój serwer, a obok zostawia pole tekstowe na własny identyfikator głosu, adres URL lub ścieżkę.

Żeby wczytać prawdziwą listę głosów od dostawcy, uzupełnij dane połączenia i kliknij przycisk **Refresh voices** (ikona okrągłej strzałki). Da się to zrobić jeszcze przed włączeniem odtwarzania. Odświeżenie najpierw zapisuje sekcję, więc świeżo wpisany klucz API działa od razu. Przed nawiązaniem połączenia aplikacja pokazuje krótką wbudowaną listę zastępczą, żeby pole nie było puste. Błąd dostawcy pojawia się wprost, zamiast po cichu udawać, że lista zastępcza to udane odświeżenie.

W przypadku źródła **ElevenLabs** wybór głosu jest obowiązkowy. Marinara wczytuje stronicowaną bibliotekę konta, w tym głosy osobiste, głosy przestrzeni roboczej, zapisane i domyślne. Okno wyboru ma pole wyszukiwania oraz stale widoczny pasek przewijania, gdy biblioteka jest dłuższa niż panel. Pokazuje też, ile głosów udało się wczytać. Na starcie widnieje tam "Select an ElevenLabs voice", a odtwarzanie jest zablokowane do czasu wskazania prawdziwego głosu.

### Głosy wybrane dla poszczególnych postaci

1. Ustaw **Voice Option** na **Selected per character**.
2. Pojawia się tabela **Character Voices** z kolumnami **Character** i **Voice**.
3. Kliknij przycisk **Add character voice**, żeby dodać wiersz.
4. Wskaż postać na liście rozwijanej po lewej, a głos na liście po prawej.
5. Powtórz to dla każdej postaci, która ma dostać własny głos.

Przycisk **Refresh** w ramce Character Voices wczytuje ponownie tę samą bibliotekę dostawcy, bez wracania do trybu jednego głosu. Postacie trzeba utworzyć wcześniej. Jeśli nie ma jeszcze żadnej, aplikacja poprosi o dodanie postaci w zakładce Characters przed przypisywaniem głosów. Postacie bez własnego głosu korzystają z głosu globalnego. Zobacz [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md).

## Narrator Voice

Narracja to tekst, którego nie wypowiada żadna konkretna postać, na przykład opis sceny albo kwestie mistrza gry. Można jej przypisać osobny głos.

1. W ramce **Narrator Voice** włącz opcję **Use separate narrator voice**.
2. Wskaż głos w oknie wyboru, które się pojawi.

Aplikacja sięga po ten głos, kiedy mówiącym jest Narrator, GM, Game Master albo System. Działa to w wiadomościach trybu Roleplay i trybu Conversation. Obejmuje też wiersze narracji w trybie Game Mode, które nie mają wskazanej mówiącej postaci. Przy korzystaniu ze źródła ElevenLabs wskaż tutaj głos narratora. Pozostawione puste pole sprawia, że narracja korzysta z zastępczego głosu tylko wtedy, gdy ustawiony jest głos globalny.

## Random NPC Voices (tylko w trybie Game Mode)

Ta funkcja przydziela zapasowe głosy pobocznym postaciom w grze. Działa wyłącznie w trybie Game Mode i tylko dla postaci NPC, które ten tryb śledzi. W trybie Roleplay ani Conversation nie ma żadnego efektu.

1. W ramce **Random NPC Voices** włącz opcję **Use default voices for random NPCs**.
2. Pojawiają się dwie siatki pól wyboru: **Male NPC defaults** i **Female NPC defaults**.
3. Zaznacz głosy, z których ma korzystać każda z pul.

Śledzona postać NPC bez własnego głosu dostaje stały wybór z pasującej puli. W trakcie jednej sesji ta sama postać NPC zachowuje ten sam głos. Postać NPC z przypisanym głosem postaci zawsze zostaje przy tym przypisanym głosie. Jeśli aplikacja nie rozpozna głosów oznaczonych jako męskie i żeńskie, każda pula korzysta z pełnej listy głosów.

## Audio Format i Speed

Ustawienie **Audio Format** pozwala wybrać **MP3** (wartość domyślna) albo **WAV**. Format WAV przydaje się przy serwerach lokalnych lub własnych, które nie potrafią tworzyć plików MP3. Dwie uwagi:

- Kontrolka **Audio Format** jest ukryta dla źródła ElevenLabs, które zawsze używa formatu MP3.
- Dla źródła xAI Voice kontrolka jest widoczna, ale nic nie zmienia. xAI Voice zawsze zwraca format MP3.

Suwak **Speed** decyduje o tempie mowy. Dopuszczalny zakres zależy od źródła:

- OpenAI-compatible i PocketTTS: od 0.25 do 4.0 normalnej prędkości.
- ElevenLabs: od 0.7 do 1.2.
- xAI Voice: od 0.7 do 1.5.

Jeśli zapisana prędkość wykracza poza zakres bieżącego źródła, aplikacja przy odczycie sprowadza ją do najbliższej dozwolonej wartości.

Tylko dla źródła **ElevenLabs** pojawiają się dwie dodatkowe kontrolki. Pole **Language** wymusza język mowy albo zostaje na wartości **Auto detect**. Suwak **Stability** przesuwa mowę między większą ekspresją a większą powtarzalnością.

## Auto-play: automatyczne czytanie wiadomości

Pod nagłówkiem **Auto-play** każdy przełącznik każe aplikacji czytać jeden rodzaj nowej wiadomości od razu po jej wygenerowaniu. Wszystkie wymagają wcześniejszego włączenia **Enable TTS**. Każdy przełącznik startuje wyłączony.

- **Roleplay messages**: czyta nowe odpowiedzi w trybie Roleplay.
- **Conversation messages**: czyta nowe odpowiedzi w trybie Conversation.
- **Game narration**: czyta nową narrację i wiersze walki w trybie Game Mode.
- **Progressive playback**: gdy odpowiedź ma kilka wierszy, odtwarza pierwszy od razu, bez czekania na całość.
- **Only read dialogues**: czyta wyłącznie kwestie ujęte w cudzysłów lub oznaczone jako mówione i pomija zwykłą narrację.

Automatyczne odtwarzanie uruchamia się tylko raz, przy najnowszej odpowiedzi, w chwili jej zakończenia. Nie czyta ponownie starych wiadomości po ponownym otwarciu czatu ani przy przewijaniu.

## Odczytanie pojedynczej wiadomości

Kiedy TTS jest włączony, na pasku narzędzi pod każdą wiadomością postaci lub narratora pojawia się przycisk **Speak** (ikona mikrofonu). Czyta on tę jedną wiadomość na żądanie.

- Kliknij przycisk **Speak**, żeby odczytać wiadomość. W czasie pobierania dźwięku przycisk pokazuje stan wczytywania.
- Kliknij go ponownie w trakcie odtwarzania, żeby przerwać. Podpowiedź brzmi wtedy **Stop speaking**.
- Wiadomość bez tekstu do odczytania, na przykład sam obrazek, pokazuje **No dialogue to speak** i pozostaje nieaktywna.

W trakcie odczytywania wiadomości pojawiają się jeszcze dwa przyciski. **Pause speaking** i **Resume speaking** wstrzymują i wznawiają odtwarzanie. **Restart speaking** zaczyna wiadomość od początku.

Przycisk z ikoną głośnika otwiera suwak **Line volume** w zakresie od 0 do 100 procent, domyślnie 50. Ta głośność ma własne zapisane ustawienie. Jest niezależna od miksera w trybie Game Mode i od głośności rozmowy w trybie Conversation, więc zmiana jednej wartości nie rusza pozostałych.

## Zapisane nagrania

Aplikacja zapisuje wygenerowany dźwięk w przeglądarce, żeby nie tworzyć tej samej kwestii dwa razy. Panel **Cached clips** pokazuje na bieżąco ich liczbę i łączny rozmiar.

Kliknij przycisk **Export cached TTS clips** (ikona pobierania), żeby zapisać na urządzeniu wszystkie zachowane nagrania jako osobne pliki dźwiękowe. Pamięć podręczna sama usuwa najstarsze nagrania. W aplikacji nie ma przycisku ręcznego czyszczenia, więc do jej opróżnienia wyczyść dane przeglądarki.

## TTS w poszczególnych trybach czatu

Ta sama konfiguracja TTS obsługuje każdy tryb, a każdy z nich dokłada kilka własnych elementów:

- Tryb Roleplay korzysta z przełącznika **Roleplay messages** i z przycisków **Speak** przy pojedynczych wiadomościach. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).
- Tryb Conversation korzysta z przełącznika **Conversation messages** i z tych samych przycisków **Speak**. Mówione rozmowy audio to osobna, większa funkcja, opisana w przewodniku [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).
- Tryb Game Mode korzysta z przełącznika **Game narration**. Ma też własny mikser dźwięku z kanałem **TTS** obok kanałów **Master**, **Music**, **Sound Effects** i **Ambient**. Ten kanał ustawia ogólną głośność mówionego dźwięku w grze i startuje na 100 procent. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

## Phonetic name (wymowa w rozmowach)

Jeśli nazwa postaci albo persony jest zapisana tak, że głos ją przekręca, uzupełnij pole **Phonetic name** (nazwa fonetyczna). W oknie **Character Editor** pole to sąsiaduje z polem **Name** postaci. W oknie **Persona Editor** znajduje się przy pozostałych podstawowych informacjach. Wpisz, jak nazwa ma brzmieć.

Ta zmiana działa wyłącznie podczas rozmów audio i wideo w trybie Conversation. Zwykły przycisk **Speak** przy wiadomości, automatyczne odtwarzanie w czacie ani narracja w trybie Game Mode nie sięgają po to pole.

## Rozwiązywanie problemów

- Nic nie jest odczytywane: sprawdź, czy przełącznik **Enable TTS** jest włączony. Potem sprawdź właściwy dla danego trybu przełącznik **Auto-play** albo użyj przycisku **Speak** przy wiadomości. Przycisk **Speak** i opcje automatycznego odtwarzania pojawiają się dopiero po włączeniu TTS.
- Brak głosów na liście rozwijanej: zapisz sekcję z włączonym TTS i poprawnym kluczem API, a potem kliknij przycisk **Refresh voices**. W przypadku źródła PocketTTS sprawdź dodatkowo, czy zgodny serwer odpowiada pod adresem `<Base URL>/v1/voices`.
- ElevenLabs nie mówi: sprawdź, czy wybrany jest prawdziwy głos, a nie tekst zastępczy "Select an ElevenLabs voice". Sprawdź też, czy w polu **Model** stoi model mowy, a nie model projektowania głosu z `ttv` w identyfikatorze.
- Własny serwer TTS pod adresem lokalnym jest blokowany: włącz na serwerze ustawienie `TTS_LOCAL_URLS_ENABLED`. Dzięki temu aplikacja sięgnie po adres lokalny lub prywatny w przypadku serwerów zgodnych z OpenAI oraz serwerów w stylu ElevenLabs. Źródło PocketTTS tego ustawienia nie potrzebuje. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).
- Szybki test konfiguracji: kliknij przycisk **Preview** w sekcji, żeby odtworzyć krótką próbkę z bieżącymi ustawieniami.

## Powiązane przewodniki

- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
