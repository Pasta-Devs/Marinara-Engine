# Konfiguracja syntezy mowy (TTS)

Synteza mowy (TTS) czyta na głos wiadomości czatu i narrację gry. Z tego przewodnika dowiesz się, jak ją włączyć, wybrać usługę głosową i głosy, ustawić automatyczne odtwarzanie i korzystać ze sterowania przy pojedynczej wiadomości.

## Szybki start

1. Otwórz sekcję syntezy mowy (kroki niżej) i włącz **Use text to speech** (używanie syntezy mowy).
2. Wybierz **Source** (źródło) i wklej klucz w pole **API key** (klucz API).
3. Kliknij **Preview** (Odsłuchaj), żeby usłyszeć próbkę.
4. W czacie kliknij **Speak** (Mów) pod wiadomością.

## Włączanie syntezy mowy

Prawie wszystkie ustawienia TTS mieszczą się w jednej sekcji. Samo włączenie TTS niczego jeszcze nie odczyta. Odsłania tylko przycisk **Speak** przy każdej wiadomości oraz opcje **Auto-play** (automatyczne odtwarzanie). O tym, co i kiedy zostanie przeczytane, nadal decydujesz ty.

1. Kliknij **Connections** (Połączenia) na górnym pasku, a potem **Add** (dodaj). Otwiera się okno **Add account** (dodanie konta).
2. W grupie **Voice** (głos) wybierz **Text to speech** (synteza mowy). Otwiera się sekcja. Jeśli już korzystasz z PocketTTS, ta sama sekcja jest też w grupie **On this device** (na tym urządzeniu).
3. Włącz **Use text to speech**. Dopóki jest wyłączone, nic nie jest czytane na głos.
4. Otwórz listę **Source** i wybierz usługę.

**Source** to usługa, która tworzy dźwięk.

- **OpenAI-compatible**: OpenAI albo dowolny serwer naśladujący format TTS od OpenAI. To ustawienie domyślne.
- **ElevenLabs**: usługa głosowa ElevenLabs.
- **PocketTTS**: darmowy serwer głosowy uruchamiany na własnym komputerze.
- **xAI Voice**: usługa głosowa xAI.

Marinara trzyma osobny zapisany profil dla każdego źródła: jego klucz, adres, model, głosy i parametry. Zmiana źródła przywraca wcześniejszą konfigurację tego źródła. Źródło jeszcze nieskonfigurowane startuje z wartościami domyślnymi.

Żądania przechodzą przez własny serwer aplikacji Marinara Engine. Klucz API jest przechowywany na serwerze w postaci zaszyfrowanej. Po zapisaniu klucza pole pokazuje zamaskowane kropki, a prawdziwy klucz nigdy nie wraca do przeglądarki.

<a id="use-an-audio-connection"></a>

### Korzystanie z połączenia Audio

Jeśli masz już dodane konto **Audio** (zobacz [Obsługiwani dostawcy AI](../connections/providers-reference.md#audio)), nie musisz ponownie wpisywać jego danych. Pojawia się na liście **Source** w grupie **Audio providers** (dostawcy audio), z typem źródła w nawiasie.

1. Otwórz listę **Source** i wybierz konto.
2. Wybierz jego głosy i pozostałe ustawienia opisane niżej.

Marinara używa wtedy adresu, klucza, modelu i wartości **Request timeout (seconds)** (limit czasu żądania w sekundach) tego konta, więc sekcja ukrywa te pola. Klucz zostaje w koncie: nigdy nie jest kopiowany do sekcji ani wysyłany do przeglądarki. Zmiany w koncie, na przykład nowy klucz, działają od razu.

Głosy, prędkość i pozostałe ustawienia mowy są zapisywane osobno dla każdego konta. Dwa konta tego samego typu nigdy ich nie współdzielą. Twoje ustawienia czterech zwykłych źródeł pozostają bez zmian. Przełącznik sekcji nadal włącza i wyłącza zwykłe TTS.

Jeśli wybrane konto zostanie usunięte albo nie da się go użyć, sekcja pokazuje **Missing Audio provider** (brak dostawcy audio) i nic nie jest odczytywane, dopóki nie wybierzesz innego źródła. Marinara nigdy nie przełącza się sama. Jeśli konto udostępnia listę swoich głosów, sekcja wskazuje każdy zapisany głos, którego nie ma na tej liście.

## Ustawianie adresu, klucza i modelu

Pomiń ten krok, jeśli wybrano konto Audio. Te dane pochodzą z konta.

1. Sprawdź pole **Base URL** (adres bazowy). Każde źródło wpisuje tu wartość domyślną (tabela niżej). Zmieniaj ją tylko przy korzystaniu z serwera proxy albo z serwera uruchamianego samodzielnie.
2. Wklej klucz w pole **API key**. Żeby zachować dotychczasowy klucz, zostaw zamaskowane kropki. Żeby go usunąć, wyczyść pole.
3. Sprawdź pole **Model**. Każde źródło wpisuje tu model domyślny. Można wpisać inny model obsługiwany przez usługę.

| Source | Domyślny Base URL | Model domyślny | Głos domyślny |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | brak, trzeba wybrać samodzielnie |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

W przypadku źródła **ElevenLabs** lista **Model** wczytuje modele mowy dostępne na twoim koncie. Wybierz zwykły model mowy. Identyfikatory modeli zawierające `ttv` należą do modeli projektowania głosu, które nie potrafią czytać tekstu. Po wyborze takiego modelu odtwarzanie kończy się błędem z informacją, że trzeba użyć modelu mowy.

### PocketTTS

PocketTTS nie jest wbudowany w aplikację Marinara Engine. Zainstaluj osobno [oficjalny serwer PocketTTS](https://github.com/kyutai-labs/pocket-tts) i uruchom go poleceniem `uvx pocket-tts serve`. Marinara nie pobiera go ani nim nie zarządza. Oficjalny serwer używa `http://localhost:8000`. Zostaw tę wartość **Base URL**, chyba że zmienisz host lub port. Marinara wykrywa oficjalne wieloczęściowe API `/tts`. Własne adresy [adaptera PocketTTS zgodnego z OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server) nadal działają.

<a id="request-timeout"></a>

### Limit czasu żądania

Marinara czeka na każdą wypowiadaną kwestię do 60 sekund. Serwer głosu działający na twoim komputerze, zwłaszcza na laptopie, może potrzebować więcej czasu na długą kwestię. Zwiększ **Request timeout (seconds)** pod polem **Model**. Zakres wynosi od 10 do 3 600 sekund.

Konto Audio ma własne pole **Request timeout (seconds)** pod polem **Default voice** (domyślny głos) w swoim edytorze. Czaty, które mówią przez konto Audio, także wybrane jako **Source**, używają tego limitu. Limit z sekcji dotyczy mowy z jej własnych ustawień, w tym przycisku **Preview**. Jeśli kwestia trwa zbyt długo, komunikat błędu podaje, ile sekund Marinara czekała i które ustawienie trzeba zwiększyć.

## Wybór głosów

Ustawienie **Voice option** (opcja głosu) decyduje o tym, jak przydzielane są głosy.

- **One voice for all** (jeden głos dla wszystkich): każda mówiąca osoba używa tego samego głosu. To ustawienie domyślne.
- **Selected per character or persona** (wybór dla każdej postaci lub persony): wybrane postacie i persony dostają od ciebie własne głosy.

### Jeden głos dla wszystkich

Wybierz głos w polu **Shared voice** (wspólny głos). Żeby wczytać prawdziwą listę głosów usługi, wpisz jej dane i kliknij **Refresh voices from provider** (odświeżenie głosów od dostawcy, ikona okrągłej strzałki). Odświeżenie najpierw zapisuje sekcję, więc świeżo wpisany klucz działa od razu. Przed nawiązaniem połączenia aplikacja pokazuje krótką wbudowaną listę, żeby pole nie było puste. Błąd usługi jest pokazywany wprost, zamiast przedstawiać listę zastępczą jako udane odświeżenie.

Oficjalny serwer PocketTTS nie ma punktu końcowego listy głosów, więc Marinara pokazuje wbudowane głosy i zachowuje obok listy pole tekstowe na inną wbudowaną nazwę lub obsługiwany URL głosu. Zgodne serwery adapterów mogą zwracać własną listę i przyjmować własne identyfikatory lub ścieżki.

W przypadku źródła **ElevenLabs** wybór głosu jest obowiązkowy. Marinara wczytuje całą bibliotekę konta: głosy osobiste, głosy przestrzeni roboczej, zapisane i domyślne. Okno wyboru ma pole wyszukiwania i licznik wczytanych głosów. Na starcie widnieje w nim "Select an ElevenLabs voice", a odtwarzanie jest zablokowane do czasu wybrania prawdziwego głosu.

### Głosy wybrane dla postaci i person

1. Ustaw **Voice option** na **Selected per character or persona**.
2. W ramce **Character and persona voices** (głosy postaci i person) kliknij **Add voice** (dodanie głosu).
3. Wskaż postać lub personę na liście po lewej, a głos na liście po prawej.
4. Powtórz to dla każdej z nich.

Głos postaci można też ustawić na zakładce **Voice** w oknie **Character Editor**. Ten wybór zmienia ten sam wiersz. Przycisk **Refresh** (odświeżenie) w tej ramce wczytuje ponownie listę głosów. Postacie trzeba utworzyć wcześniej. Jeśli nie ma żadnej, aplikacja poprosi o dodanie postaci lub persony przed przypisywaniem głosów.

Postać bez własnego głosu korzysta z głosu karty o pasującej nazwie, na przykład oryginału kopii AU. W przeciwnym razie używa wspólnego głosu. Zobacz [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md).

### Głos narratora

Narracja to tekst, którego nie wypowiada żadna konkretna postać, na przykład opis sceny albo kwestie mistrza gry.

1. W ramce **Narrator voice** (głos narratora) włącz **Use separate narrator voice** (osobny głos narratora).
2. Wybierz głos.

Aplikacja używa go, gdy mówiącym w danej kwestii jest Narrator, GM, Game Master albo System, w wiadomościach trybu Roleplay i trybu Conversation, a także w narracji trybu Game Mode bez wskazanego mówcy. Przy źródle ElevenLabs wybierz tu głos narratora. Jeśli zostawisz to pole puste, narracja korzysta z głosu zastępczego tylko wtedy, gdy ustawiony jest głos globalny.

### Losowe głosy postaci NPC (tylko w trybie Game Mode)

Ta funkcja przydziela zapasowe głosy pobocznym postaciom w grze, które śledzi tryb Game Mode. W trybie Roleplay ani Conversation nie ma żadnego efektu.

1. W ramce **Random NPC voices** (losowe głosy postaci NPC) włącz **Use default voices for random NPCs** (domyślne głosy dla losowych postaci NPC).
2. Zaznacz głosy w polach **Male NPC defaults** (domyślne głosy męskie) i **Female NPC defaults** (domyślne głosy żeńskie).

Śledzona postać NPC bez własnego głosu dostaje stały wybór z pasującej puli i zachowuje go przez całą sesję. Postać NPC z przypisanym głosem zostaje przy tym głosie. Postacie NPC o niejasnej płci wybierają z obu pul. Jeśli aplikacja nie znajdzie głosów oznaczonych jako męskie lub żeńskie, każda pula korzysta z pełnej listy.

## Format dźwięku i prędkość

Ustawienie **Audio format** (format dźwięku) to **MP3** (wartość domyślna) albo **WAV**. Format WAV przydaje się przy serwerach lokalnych, które nie potrafią tworzyć plików MP3. Ta kontrolka jest ukryta dla źródła ElevenLabs, które zawsze używa formatu MP3. Dla źródła xAI Voice jest widoczna, ale nic nie zmienia, bo xAI zawsze zwraca MP3.

Zakres suwaka **Speed** (prędkość) zależy od źródła:

| Source | Zakres |
| --- | --- |
| OpenAI-compatible | od 0,25 do 4,0 normalnej prędkości |
| PocketTTS | od 0,25 do 4,0 przy zgodnych adapterach. Oficjalny serwer sam steruje prędkością. |
| ElevenLabs | od 0,7 do 1,2 normalnej prędkości |
| xAI Voice | od 0,7 do 1,5 normalnej prędkości |

Zapisana prędkość spoza zakresu jest sprowadzana do najbliższej dozwolonej wartości. Dla źródła ElevenLabs są jeszcze dwie kontrolki: **Language** (język; wymusza język albo zostaje na **Auto detect**, czyli automatycznym wykrywaniu) i **Stability** (stabilność; od większej ekspresji do większej powtarzalności).

## Auto-play: automatyczne odtwarzanie

Każdy przełącznik **Auto-play** każe aplikacji czytać jeden rodzaj nowej wiadomości od razu po jej wygenerowaniu. Wszystkie wymagają włączonego **Use text to speech**. Każdy startuje wyłączony.

- **Roleplay messages**: nowe odpowiedzi w trybie Roleplay.
- **Conversation messages**: nowe odpowiedzi w trybie Conversation.
- **Game narration**: nowa narracja i wiersze walki w trybie Game Mode.
- **Progressive playback**: gdy odpowiedź ma kilka wierszy, odtwarza pierwszy od razu, bez czekania na całą odpowiedź.
- **Only read dialogues**: czyta wyłącznie kwestie ujęte w cudzysłów lub oznaczone jako mówione i pomija zwykłą narrację.

Automatyczne odtwarzanie uruchamia się raz, przy najnowszej odpowiedzi, w chwili jej zakończenia. Nie czyta ponownie starych wiadomości po ponownym otwarciu czatu ani przy przewijaniu.

W trybie Roleplay przygotowanie głosu zaczyna się zaraz po zapisaniu głównej odpowiedzi. Jeśli włączony agent przepisuje odpowiedź, na przykład Prose Guardian, Marinara czeka na ostateczny tekst.

### Filtry tekstu i wskazówki dotyczące emocji

Te filtry działają przy ręcznym i automatycznym odtwarzaniu, także dla narracji Game i rozpoznawania mówców w trybie Roleplay. Bloki kodu są domyślnie pomijane. Pozostałe dwa filtry są początkowo wyłączone.

- **Skip text inside HTML and custom tags** (pomijaj tekst wewnątrz znaczników HTML i własnych znaczników): usuwa zawartość znaczników, na przykład ukryty blok `<simulation>...</simulation>`. Znaczniki mówców używane do wyboru głosów zostają.
- **Skip fenced code blocks** (pomijaj ogrodzone bloki kodu).
- **Skip text inside square brackets** (pomijaj tekst w nawiasach kwadratowych).

Włącz **Roleplay speaker extractor** (rozpoznawanie mówców w trybie Roleplay), aby zobaczyć opcję **Enable emotion indicators** (włącz oznaczenia emocji). Dodaje ona wskazówki dotyczące głosu bez zmiany słów kwestii. Gdy oznaczenia emocji są włączone, tekst w nawiasach kwadratowych trafia do usługi syntezy mowy nawet przy włączonej opcji **Skip text inside square brackets**. Dotyczy to także notatek. Aby notatki w nawiasach nie były odczytywane, wyłącz oznaczenia emocji i zostaw pomijanie włączone. Wskazówki takie jak `[Low, steady voice, restrained urgency]` pozostają w całości, gdy długa kwestia jest dzielona. Znane oznaczenia mówców i scen nadal są usuwane. O tym, jak wykorzystać daną wskazówkę, decyduje model mowy. Gdy **Use text to speech**, **Game narration** i oznaczenia emocji są włączone, wskazówki mogą też trafiać do dialogów w scenach, w drużynie i podczas walki w trybie Game Mode.

## Odczytanie pojedynczej wiadomości

Kiedy TTS jest włączony, na pasku narzędzi pod każdą wiadomością postaci lub narratora pojawia się przycisk **Speak** (ikona mikrofonu).

- Kliknij **Speak**, żeby odczytać wiadomość. W czasie pobierania dźwięku przycisk pokazuje stan wczytywania.
- Kliknij go ponownie w trakcie odtwarzania, żeby przerwać. Podpowiedź brzmi wtedy **Stop speaking**.
- Wiadomość bez tekstu do odczytania, na przykład sam obrazek, pokazuje **No dialogue to speak** i pozostaje nieaktywna.

W trakcie odczytywania wiadomości pojawiają się przyciski **Pause speaking**, **Resume speaking** i **Restart speaking**. Przycisk z ikoną głośnika otwiera suwak **Line volume** w zakresie od 0 do 100 procent (domyślnie 50). Ta głośność jest niezależna od miksera w trybie Game Mode i od głośności rozmowy w trybie Conversation.

Jeśli to nie zadziałało, zobacz [Rozwiązywanie problemów](#troubleshooting).

## Zapisane nagrania

Marinara zapisuje wygenerowany dźwięk w przeglądarce, żeby nie tworzyć tej samej kwestii dwa razy. Panel **Cached clips** pokazuje na bieżąco ich liczbę i łączny rozmiar. Kliknij **Export cached TTS clips** (ikona pobierania), żeby zapisać wszystkie zachowane nagrania jako osobne pliki dźwiękowe. Pamięć podręczna sama usuwa najstarsze nagrania. W aplikacji nie ma przycisku czyszczenia. Żeby ją opróżnić, wyczyść dane przeglądarki.

## TTS w poszczególnych trybach czatu

- Tryb **Roleplay** korzysta z przełącznika **Roleplay messages** i z przycisków **Speak**. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).
- Tryb **Conversation** korzysta z przełącznika **Conversation messages** i z tych samych przycisków. Rozmowy audio opisuje przewodnik [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).
- Tryb **Game Mode** korzysta z przełącznika **Game narration**. Jego mikser ma kanał **TTS** obok kanałów **Master**, **Music**, **Sound Effects** i **Ambient**. Ten kanał ustawia głośność mówionego dźwięku w grze i startuje na 100 procent. Zobacz [Kontrolki gry](../game/getting-started.md#the-games-controls).

### Phonetic name (wymowa w rozmowach)

Jeśli głos przekręca nazwę postaci albo persony, uzupełnij pole **Phonetic name** (nazwa fonetyczna) i wpisz, jak nazwa ma brzmieć. W oknie **Character Editor** pole to jest na zakładce **Voice**. W oknie **Persona Editor** znajduje się przy polach z podstawowymi informacjami. Działa wyłącznie podczas rozmów audio i wideo w trybie Conversation. Przycisk **Speak**, automatyczne odtwarzanie i narracja w trybie Game Mode je pomijają.

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

- **Nic nie jest odczytywane**: sprawdź, czy **Use text to speech** jest włączone. Potem sprawdź właściwy przełącznik **Auto-play** albo użyj przycisku **Speak** przy wiadomości.
- **Sekcja pokazuje Missing Audio provider**: konto wybrane jako **Source** zostało usunięte albo nie da się go użyć. Wybierz inne źródło. Zobacz [Korzystanie z połączenia Audio](#use-an-audio-connection).
- **Brak głosów na liście**: zapisz sekcję z włączonym TTS i poprawnym kluczem, a potem kliknij **Refresh voices from provider**. Oficjalny serwer PocketTTS korzysta z wbudowanej listy aplikacji Marinara Engine. W przypadku zgodnego adaptera PocketTTS sprawdź, czy `<Base URL>/v1/voices` odpowiada.
- **ElevenLabs nie mówi**: wybierz prawdziwy głos, a nie tekst zastępczy "Select an ElevenLabs voice". Sprawdź, czy w polu **Model** jest model mowy, a nie model projektowania głosu z `ttv` w identyfikatorze.
- **Kwestia urywa się z komunikatem "No audio after 60 s"**: serwer głosu potrzebuje więcej czasu. Zwiększ **Request timeout (seconds)** w miejscu wskazanym w komunikacie. Zobacz [Limit czasu żądania](#request-timeout).
- **Własny serwer pod adresem lokalnym jest blokowany**: włącz `TTS_LOCAL_URLS_ENABLED` w pliku `.env`. Dzięki temu Marinara sięgnie po adres lokalny lub prywatny w przypadku serwerów zgodnych z OpenAI albo serwerów w stylu ElevenLabs. Źródło PocketTTS tego nie potrzebuje. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).
- **Szybki test**: kliknij **Preview** w sekcji, żeby odtworzyć krótką próbkę z bieżącymi ustawieniami.

## Odniesienie: muzyka, efekty dźwiękowe i Gacha Forge

Te sekcje dotyczą zaawansowanych konfiguracji.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### Muzyka i efekty dźwiękowe Game na zgodnym serwerze audio

1. W panelu **Connections** otwórz konto **Music & Sound Effects** (muzyka i efekty dźwiękowe) przez **Edit model** (edycja modelu) i wybierz **Custom compatible server** (własny zgodny serwer). Okno **Add account** nie ma kafelka dla tego typu konta. Takie konto powstaje przy aktualizacji albo przez import (zobacz [opis kont](../connections/providers-reference.md#music--sound-effects)).
2. Wpisz adres, klucz i model serwera muzyki lub efektów dźwiękowych.
3. Ustaw **Generation API format** (format API generowania) i wpisz ścieżki endpointów udostępnianych przez serwer. Pusta ścieżka oznacza, że dana funkcja jest niedostępna.
4. Włącz **Music generation** (generowanie muzyki), **Sound-effect generation** (generowanie efektów dźwiękowych) albo oba przełączniki.
5. Wybierz to konto podczas konfiguracji gry albo w jej ustawieniach audio. W sekcji TTS pozostaw osobno wybrane konto do mowy.

Ścieżki endpointów są dopisywane do Base URL konta. Dla `http://localhost:8002/v1` użyj `chat/completions`, aby otrzymać `/v1/chat/completions`. Lokalne endpointy HTTP wymagają `TTS_LOCAL_URLS_ENABLED=true` w `.env`, tak jak inne lokalne żądania do zgodnych serwerów audio.

Obsługiwane są dwa formaty API:

- **Prompt JSON → MP3 audio** wysyła `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` i oczekuje bajtów MP3. Muzyka Game używa długości utworu kontekstowego (domyślnie 120 sekund). Efekty dźwiękowe żądają 5 sekund.
- **Chat Completions → inline audio (ACE-Step compatible)** wysyła `model`, jeden wpis użytkownika w `messages`, `stream: false` oraz `audio_config` z polami `duration`, `instrumental: true` i `format: "mp3"`. Przyjmuje osadzone audio MP3 z `choices[0].message.audio`: tablicę adresów audio ACE-Step zawierającą URL danych base64 albo obiekt z polem `data` w base64. Zobacz [kontrakt API zgodnego z ACE-Step](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Zdalne adresy wyników i asynchroniczne API zadań nie są obsługiwane.

Włączaj tylko funkcje faktycznie obsługiwane przez serwer. Sam endpoint mowy zgodny z OpenAI nie oznacza obsługi muzyki ani efektów dźwiękowych. Usługa taka jak Infermatic musi udostępniać jeden z tych formatów albo adapter. Jej działający endpoint muzyczny nie został tu zweryfikowany. Do natywnego generowania przez ElevenLabs lub SunoAPI użyj odpowiedniego źródła w kategorii **Music & Sound Effects**. Zobacz [opis kont](../connections/providers-reference.md#music--sound-effects).

Wygenerowana muzyka kontekstowa powstaje raz na obszar lub poziom starcia i jest używana ponownie. Powtarzane efekty dźwiękowe korzystają z pamięci podręcznej audio. Błąd generowania pozostawia pamięć podręczną dostępną do ponownej próby.

<a id="gacha-forge-dialogue-and-audio"></a>

### Dialogi i dźwięk w pakiecie Gacha Forge

Gacha Forge w wersji 1.11.0 lub nowszej korzysta z konta wybranego w sekcji TTS i jego przypisań głosów do postaci. - Włącz **Read character dialogue** (czytanie dialogów postaci), żeby odczytywać dialogi zaimportowanych postaci z przypisanym głosem. Ta opcja jest w kroku **Lore** (wiedza o świecie) podczas tworzenia nowego świata albo we własnych ustawieniach świata pakietu Gacha Forge dla istniejącego świata. Narracja, myśli, wygenerowane jednostki bez identyfikatora postaci w aplikacji Marinara Engine oraz postacie bez głosu pozostają nieme. Sama nazwa nigdy nie pożycza głosu innej postaci.
- Wybranego konta Audio można używać, gdy przełącznik TTS świata jest włączony. Przy bezpośrednim korzystaniu z własnych ustawień źródła w sekcji musi być też włączone **Use text to speech**.
- Wbudowana muzyka i efekty dźwiękowe Game nie wymagają konta do generowania. Żeby tworzyć nowe utwory, włącz **Generate music and sound effects** (generowanie muzyki i efektów dźwiękowych) w pakiecie Gacha Forge i wybierz konto Music & Sound Effects w polu **Audio connection** (połączenie audio). To pole pojawia się po włączeniu generowania. Utwory ekranu głównego, walki, bossów, scen fabularnych i historii postaci są generowane przy pierwszej potrzebie, a potem używane ponownie. Te żądania korzystają z twojego konta w usłudze.
- Przycisk wyciszenia w prawym górnym rogu wycisza jednocześnie muzykę, dialogi i efekty dźwiękowe. Ustawienia wizualne pakietu Gacha Forge mają osobne regulatory głośności tych trzech kanałów, w tym głośność zerową, oraz pauzę automatycznego odtwarzania (domyślnie **3 sekundy**, po zakończeniu odsłaniania tekstu i ewentualnej wypowiadanej kwestii). Wybory nadal czekają na gracza. Opuszczenie sceny anuluje wypowiadany dialog. Opuszczenie świata zatrzymuje jego dźwięk.

Zaktualizuj zarówno zainstalowany pakiet Gacha Forge, jak i aplikację Marinara Engine, żeby otrzymać te opcje.

## Powiązane przewodniki

- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Synchronizacja ust z syntezą mowy](../agents/avatars.md#lip-sync-with-text-to-speech) dla awatarów 2D i 3D
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
