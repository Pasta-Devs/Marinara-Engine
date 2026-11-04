# Generowanie wideo sceny

Wideo sceny to krótki klip MP4 przedstawiający scenę. Może animować obraz z galerii (Gallery), który staje się pierwszą klatką, a AI dodaje ruch. W trybie Roleplay może też powstać wyłącznie na podstawie fabuły. Z tego przewodnika dowiesz się, jak skonfigurować usługę wideo, tworzyć klipy z galerii i w trybie Game Mode oraz zmieniać ustawienia wideo.

Wideo sceny działa w czatach w trybie Roleplay i Game Mode. Czaty w trybie Conversation wysyłają zamiast tego wiadomości wideo. Zobacz [Wiadomości wideo](../conversation/selfies.md#video-messages).

Tryb Game Mode i przycisk **Animate illustration** (animowanie ilustracji) zawsze zaczynają od obrazu, więc najpierw go wygeneruj lub wgraj. W trybie Roleplay komenda `/video` i przycisk **Video** (wideo) w galerii korzystają z ustawienia **First frame** (pierwsza klatka) agenta Illustrator. Bez wybranej pierwszej klatki nie potrzebują żadnego obrazu.

Wideo sceny korzysta z osobnego rodzaju konta, **Video Generation** (generowanie wideo), a nie ze zwykłego generowania obrazów. Gotowe klipy zapisują się razem z czatem i pokazują się w galerii, gdzie można je przypiąć, pobrać lub obejrzeć.

## Konfiguracja usługi wideo

1. Kliknij **Connections** (Połączenia) na górnym pasku, a potem **Add** (dodaj). Otwiera się okno **Add account** (dodanie konta).
2. Wybierz usługę z sekcji **Images & video** (obrazy i wideo). Usługi są wymienione niżej.
3. Wklej klucz API dla usługi w chmurze. Lokalne ComfyUI go nie potrzebuje. SwarmUI potrzebuje Swarm Auth Token (token uwierzytelniający SwarmUI) tylko wtedy, gdy twój serwer wymaga konta.
4. Kliknij **Connect** (połącz), a potem wybierz model albo zostaw domyślny. NanoGPT nie ma modelu domyślnego, więc wybierz model z jego listy. Przy ComfyUI zostaw model nieustawiony, chyba że workflow używa `%model%`. Przy SwarmUI model jest opcjonalny.
5. Otwórz model wideo i kliknij **Test video** (test wideo), żeby go sprawdzić.

Każda usługa wpisuje domyślny adres, a tam, gdzie ma to zastosowanie, także domyślny model. NanoGPT nie ma modelu domyślnego, więc wybierz model samodzielnie.

| Usługa wideo | Model domyślny | Uwagi |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Uruchamia modele Gemini Omni i Veo przez API Gemini. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Wideo Grok Imagine przez API xAI Videos. |
| **OpenRouter Video** | `google/veo-3.1` | Można wpisać dowolny identyfikator modelu wideo z OpenRouter. |
| **NanoGPT** | brak, wybierz model | Modele wideo przez NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Hostowane modele text-to-video i image-to-video. |
| **Seedance 2.0** | `seedance-2-0` | Tryby: z tekstu, z pierwszej klatki oraz z pierwszej i ostatniej klatki. |
| **ComfyUI** | zależny od workflow | Lokalne WAN i inne workflow wideo w formacie API. |
| **SwarmUI** | zależny od workflow | Workflow wideo ComfyUI uruchamiane przez twój serwer SwarmUI. |

**Google AI Studio** obejmuje dwie rodziny modeli. **Gemini Omni** korzysta z `gemini-omni-flash-preview`. **Google Veo** korzysta z `veo-3.1-generate-preview`. To, która rodzina zadziała, zależy od wybranego modelu.

Przy **ComfyUI** użyj adresu `http://127.0.0.1:8188` i wklej workflow wideo w formacie API do pola **ComfyUI workflow (required)** (workflow ComfyUI, wymagany). Workflow jest wymagany. Opis symboli zastępczych i węzłów wyjściowych znajdziesz w przewodniku [Konfiguracja workflow w ComfyUI](comfyui.md#comfyui-video-workflows).

Przy **SwarmUI** Marinara wpisuje adres `http://127.0.0.1:7801`. Wklej workflow wideo w formacie API do pola **ComfyUI workflow (required)**. Workflow jest wymagany. SwarmUI nie obsługuje symboli zastępczych `%reference_image_name%`, więc użyj `%reference_image%`. Jeśli twój serwer wymaga konta, wklej Swarm Auth Token do pola **API key** (klucz API).

### Ustawienie domyślnego modelu wideo

Żeby używać modelu wideo, gdy czat nie ma własnego, ustaw zadanie **Video** w sekcji **Defaults** (ustawienia domyślne) u góry panelu **Connections**. W **Chat Settings** (ustawienia czatu) widnieje ono jako **Default video provider** (domyślny dostawca wideo). Gdy nie ma ani modelu w czacie, ani domyślnego, akcje wideo pokazują ostrzeżenie z prośbą o wybór.

### Instrukcje do promptów wideo

Każdy model wideo ma pole **Video prompting instructions** (instrukcje do promptów wideo). Napisz w nim AI, które tworzy twoje prompty wideo, czego oczekuje twój model wideo, na przykład ruchów kamery, długości promptu albo dźwięku. Te instrukcje kierują animacjami z galerii w trybie Roleplay, wiadomościami wideo w trybie Conversation oraz opcją **Image-aware shot planning** (planowanie ujęć z uwzględnieniem obrazu) agenta Storyboard. Jeśli AI skopiuje z nich do promptu całe zdanie, Marinara je usuwa. Wideo scen w trybie Game Mode, klipy z rozmów i animowane wyrazy twarzy tworzą prompty osobno i pomijają to pole.

### Ustawienia domyślne wideo dla modelu

Model wideo ma panel **Video defaults** (domyślne ustawienia wideo) z domyślną długością klipu, proporcjami obrazu i rozdzielczością. Mają one pierwszeństwo przed zapasową długością obowiązującą w całej aplikacji.

Domyślna długość, zakres, proporcje obrazu i rozdzielczość dla każdej usługi:

- Gemini Omni: 10s, od 1 do 60s, 16:9, rozdzielczość domyślna dostawcy.
- Google Veo: 8s, 4, 6 lub 8s, 16:9, 720p.
- xAI Imagine: 10s, od 1 do 15s, 16:9, 720p.
- OpenRouter Video: 10s, od 1 do 60s, 16:9, 720p.
- Atlas Cloud: 8s, od 1 do 60s, 16:9, 720p.
- Seedance 2.0: 5s, od 4 do 15s, 16:9, 720p.
- ComfyUI i SwarmUI: 5s, od 1 do 60s, 16:9, 720p.

Gemini Omni nie ma pola rozdzielczości, a długość trafia do treści promptu. Google Veo wymusza 8 sekund zawsze, gdy animuje obraz referencyjny, bo tyle czasu potrzebuje na połączenie pierwszej i ostatniej klatki.

<a id="seedance-reference-frames"></a>

### Klatki referencyjne w Seedance

Seedance musi pobrać obraz referencyjny przez publiczny link. Lokalny serwer Marinara Engine go nie ma, więc zwykła instalacja lokalna wymaga jednego dodatkowego kroku.

1. Otwórz model Seedance.
2. Włącz **Upload Seedance reference frames temporarily** (tymczasowe wgrywanie klatek referencyjnych Seedance). Klatka trafia pod tymczasowy publiczny link.
3. Opcjonalnie: ustaw **Temporary link lifetime** (czas życia tymczasowego linku). Wartość domyślna to 12 godzin.

Jeśli serwer Marinara Engine ma już publiczny adres, zamiast tego możesz ustawić zmienną środowiskową. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

## Tworzenie wideo w galerii

Czaty w trybie Roleplay i Game Mode mogą tworzyć wideo sceny z poziomu galerii. Otwórz **Chat Settings** i rozwiń sekcję **Gallery** (galeria). Galeria ma zakładkę **Images** (obrazy) i zakładkę **Videos** (filmy), każdą z licznikiem.

### W trybie Roleplay

Przycisk **Video** w rzędzie akcji na górze galerii tworzy klip z najnowszej odpowiedzi, tak samo jak `/video`. Dodaj opis po `/video`, żeby wskazać, co ma przedstawiać klip.

- **First frame**: klip korzysta z ustawienia **First frame** agenta Illustrator. To nowy obraz najnowszej odpowiedzi od agenta Illustrator (najpierw narysowany, potem animowany), awatar lub sprite postaci albo brak obrazu. Bez wybranej pierwszej klatki klip powstaje wyłącznie na podstawie fabuły.
- **Awatar**: klip zaczyna się od osoby wymienionej jako pierwsza w opisie, także od twojej persony. Wystarczy część imienia lub nazwiska, której nie ma nikt inny, zapisana wielką literą ("Lena" dla "Dr. Lena Kowalski"). Bez wskazanej osoby klip zaczyna się od postaci czatu.
- **Przegląd**: przy włączonej opcji **Expose media prompts before sending** (pokazywanie promptów mediów przed wysłaniem) możesz najpierw przejrzeć i poprawić prompt klipu.
- **Kontekst**: AI czyta tyle ostatnich wiadomości, ile agent Illustrator przy tworzeniu obrazu (ustawienie **Context Size** (rozmiar kontekstu) agenta Illustrator w sekcji **Agent Budget** (budżet agenta) na jego ekranie konfiguracji).
- **Bez obrazu**: gdy klip zaczyna się bez obrazu lub od awatara, AI samo opisuje scenę. Jego instrukcje to **Roleplay Clip Director** (reżyser klipów Roleplay) w **Settings → Generations → Video Generation Prompt Overrides** (ustawienia, generowanie, nadpisywanie promptów generowania wideo).

Gotowy klip odtwarza się bezpośrednio w czacie, pod najnowszą odpowiedzią, nawet jeśli obraz pochodzi z wcześniejszej. Klipy nie otwierają się same w pływającym okienku. Żeby wyświetlić klip w pływającym okienku, użyj przycisku **Pin video to chat** (przypięcie wideo do czatu) w zakładce **Videos**. Klip usuniesz z wiadomości jego przyciskiem **X**. Nadal zostaje w galerii.

### W trybie Game Mode

1. Sprawdź, czy w zakładce **Images** jest przynajmniej jeden obraz. Użyj przycisku **Illustrate** albo wgraj obraz.
2. Kliknij przycisk **Video** w rzędzie akcji na górze galerii.
3. Jeśli opcja **Expose media prompts before sending** jest włączona (**Settings → Generations → Overall Generations**), przejrzyj lub popraw prompt i kliknij **Generate**. Anulowanie nie wysyła żadnego żądania.
4. Przycisk pokazuje **Generating...**, a baner informuje, że generowanie wideo trwa.
5. Po zakończeniu klip pojawia się w zakładce **Videos**.

Jeśli nie ma żadnego obrazu, Marinara pokazuje komunikat "Add or generate a gallery image before generating a scene video." Wygeneruj lub wgraj obraz i spróbuj ponownie.

### Animowanie jednego obrazu

1. Otwórz zakładkę **Images**.
2. Najedź kursorem na obraz.
3. Kliknij **Animate illustration** (ikona kliszy filmowej).

Przy włączonym przeglądaniu promptu okno pokazuje dokładny skompilowany prompt, czas trwania, proporcje obrazu i rozdzielczość dla tego obrazu. Twoja poprawka dotyczy tylko tego jednego klipu. W trybie Roleplay AI planujące ruch czyta tyle ostatnich wiadomości, ile agent Illustrator, kończąc na odpowiedzi, do której należy obraz. Jego instrukcje wielokrotnego użytku to **Roleplay Gallery Animation Director** w **Settings → Generations → Video Generation Prompt Overrides**.

Każdy klip w zakładce **Videos** odtwarza się na miejscu i pokazuje swoją długość oraz nazwę modelu. Użyj przycisku **Pin video to chat** albo **Download scene video**. Dopóki nie ma żadnych klipów, zakładka pokazuje napis **No videos yet**.

## Wybór usługi

Wszystkie osiem usług tworzy krótkie klipy z obrazu.

- **Google AI Studio (Gemini Omni)**: długość do 60 sekund, wpisywana w treść promptu.
- **Google AI Studio (Veo)**: wysoka jakość, ale sztywne 4, 6 lub 8 sekund. Przy animowaniu obrazu używa 8 sekund.
- **xAI Imagine**: od 1 do 15 sekund, z krótszym limitem promptu niż pozostałe usługi.
- **OpenRouter Video**: od 1 do 60 sekund, z dowolnym modelem wideo obsługiwanym przez twoje konto.
- **NanoGPT**: od 1 do 60 sekund, bez modelu domyślnego.
- **Atlas Cloud**: wczytuje aktualny katalog modeli wideo Atlas Cloud, najpierw modele image-to-video, każdy z ceną początkową za sekundę filmu. Jeśli to się nie uda, Marinara pokazuje modele startowe Veo 3.1 i Seedance 2.0. Możesz wpisać dokładny identyfikator modelu. Ograniczenia modelu nadal obowiązują.
- **Seedance 2.0**: od 4 do 15 sekund, z trybem pierwszej klatki oraz pierwszej i ostatniej klatki. Wymaga publicznego linku do obrazu referencyjnego.
- **ComfyUI**: generowanie lokalne przez twój workflow w formacie API. Marinara wgrywa obraz referencyjny bezpośrednio, gdy workflow używa `%reference_image_name%`.
- **SwarmUI**: generowanie lokalne przez twój workflow i serwer SwarmUI. Obraz referencyjny trafia do workflow przez `%reference_image%`.

Zadania wideo trwają długo. Usługa uruchamia zadanie, a Marinara czeka i sprawdza, aż klip będzie gotowy. Jeden klip może zająć kilka minut. Duże lokalne modele WAN mogą potrzebować więcej niż domyślne 30 minut. Podnieś `VIDEO_GEN_TIMEOUT_MS` i uruchom aplikację Marinara Engine ponownie.

### Różnice między modelami Atlas Cloud

Modele Atlas Cloud nie przyjmują jednakowych ustawień. Przed każdym żądaniem Marinara odczytuje opublikowany schemat wejściowy modelu z `static.atlascloud.ai` i dopasowuje do niego twoje ustawienia domyślne.

- Obraz źródłowy trafia do pola obrazu używanego przez dany model.
- Długość klipu zmienia się na najbliższą długość oferowaną przez model. Model ograniczony do 5 lub 10 sekund zamienia domyślne 8 sekund na 10.
- Rozdzielczość zmienia się na najbliższy poziom oferowany przez model. Modele przyjmujące rozmiar w pikselach otrzymują najbliższe `width*height` dla twoich proporcji i rozdzielczości.
- Ustawienie, którego model nie ma, jest pomijane, więc obowiązuje wartość domyślna modelu.

Log serwera wymienia wszystkie zmienione wartości w wierszu zaczynającym się od `[video-gen/atlas-cloud] fitted request`. Jeśli nie da się odczytać schematu, Marinara wysyła takie samo ogólne żądanie jak wcześniej.

Do wideo scen wybierz model image-to-video. Model text-to-video nie ma pola obrazu. Pomija twój obraz i tworzy niezwiązany klip na podstawie promptu, a log serwera to odnotowuje. **Test video** wysyła zwykły gradient jako pierwszą klatkę, gdy model wymaga obrazu, więc modele image-to-video mogą przejść test.

Wiele modeli Atlas Cloud ma własne pola wejściowe, takie jak `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` lub listy LoRA.

1. Otwórz model Atlas Cloud i wybierz lub wpisz model.
2. Rozwiń **Video defaults**, a potem **Atlas Cloud setup** (konfiguracja Atlas Cloud).
3. Znajdź **Model options** (opcje modelu) pod ustawieniami długości, proporcji i rozdzielczości.

Na górze **Model options** znajduje się lista długości, rozdzielczości, rozmiarów klatek i proporcji obsługiwanych przez model. Przy modelu text-to-video pojawia się też ostrzeżenie. Każda opcja ma nazwę i opis z Atlas Cloud i zaczyna od **Model default** (wartość domyślna modelu), z wartością domyślną w nawiasach. Opcja pozostawiona na **Model default** nie jest wysyłana. Zmień opcję, żeby wysyłać własną wartość przy każdym filmie z tego modelu, także przy **Test video**. Pola list i obiektów, na przykład LoRA, przyjmują JSON.

Wybory są zapisywane osobno dla każdego modelu. **Reset model options** (zresetowanie opcji modelu) usuwa je dla bieżącego modelu. Kliknij **Save** (Zapisz), żeby zachować zmiany. Jeśli zapisana opcja przestanie pasować do modelu, Marinara pominie ją i wymieni w wierszu logu.

## Tworzenie wideo w Game Assets

Tryb Game Mode ma drugie miejsce do tworzenia wideo sceny: **Game Assets**. Kliknij jego przycisk z folderem blisko prawego górnego rogu czatu. Na komputerze otwiera się w oknie, a na telefonie jako panel na całą szerokość ekranu. Jeśli przeniesiono go do Chat Settings, otwórz tam sekcję **Game Assets**.

1. Otwórz **Game Assets**.
2. Kliknij **Generate video** ("Generate a scene video from the latest illustration").
3. Gotowy najnowszy klip odtwarza się w tym miejscu.

Przycisk **Generate video** pozostaje nieaktywny, dopóki gra nie ma zarówno modelu wideo, jak i ilustracji sceny. Po zbyt wczesnym kliknięciu może pojawić się komunikat "Choose a Video Generation connection in Game Settings first." (ustaw model wideo dla gry) albo "Generate a scene illustration before generating a scene video." Gdy klip się nie uda, panel pokazuje "Scene video generation failed." Spróbuj ponownie, a przy powtarzających się błędach sprawdź klucz.

## Wybór modelu wideo dla czatu

Każdy czat wybiera własny model wideo w **Chat Settings → Agents → Scene Videos** (ustawienia czatu, agenci, wideo scen).

- Tryb **Roleplay** pokazuje kafelek **Scene Videos** ("Generate manual MP4 scene videos from gallery images"). Ma on jedną kontrolkę, listę modeli wideo.
- Tryb **Game Mode** pokazuje kafelek **Scene Videos** ("Generate MP4 scene videos from game illustrations") z większą liczbą kontrolek. Lista modeli wideo wybiera model. **Game Video Prompt** to szablon decydujący o tym, jak animuje się obraz. Wbudowany szablon domyślny to **Cinematic Scene Video**. **Edit Video Prompt Presets** dodaje i edytuje twoje własne kopie dla tego czatu.

Szablon **Game Video Prompt** steruje ręcznymi filmami z galerii i z **Game Assets** w trybie Game Mode. Animacje z galerii w trybie Roleplay korzystają zamiast tego z ustawienia **Roleplay Gallery Animation Director**. Agent Storyboard ma własny domyślny szablon **Storyboard Video Prompt**. Każdy czat może go nadpisać w **Chat Settings → Agents → Storyboards**. Zresetowanie przywraca wartość domyślną agenta Storyboard.

Przy tworzeniu czatu w trybie Game Mode kreator konfiguracji ma wybór modelu wideo w kroku **Features**, po włączeniu generowania wizualnego.

## Ustawienia generowania wideo

Część ustawień domyślnych wideo obowiązuje w całej aplikacji. Otwórz **Settings → Generations** (ustawienia, generowanie) i znajdź sekcję **Video Generation** ("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls").

- **Scene video fallback length** (zapasowa długość wideo sceny): używana tylko wtedy, gdy wybrany model wideo nie ma własnej długości. Wartość domyślna to 10 sekund. Zakres wynosi od 1 do 60.
- **Video Generation Prompt Overrides**: edycja szablonów promptów wideo wielokrotnego użytku. **Roleplay Gallery Animation Director** ustala instrukcje wysyłane do modelu Prompt Model przed powstaniem klipu z galerii w trybie Roleplay. Jego zmienna `${durationSeconds}` zostaje zastąpiona długością klipu.
- **Videos per reply** (filmy na odpowiedź): ile wiadomości wideo postacie Conversation mogą wysłać w jednej odpowiedzi i ile klipów agent Illustrator dodaje do jednej odpowiedzi Roleplay. Wartość domyślna to 3. Zakres wynosi od 1 do 10. Każda postać Conversation wysyła najwyżej jeden klip. Ustawienie służy czatom grupowym i prośbom o kilka filmów naraz. Zwiększ wartość, żeby więcej postaci mogło wysłać klip. Zmniejsz ją, żeby oszczędzić żądania. Klipy ponad limit są pomijane. `/video` i przycisk **Video** w galerii nie wliczają się do limitu.
- **Animated expression length** należy do animowanych sprite'ów portretowych. Zobacz [Animowane wyrazy twarzy](animated-expressions.md).

## Storyboardy

Agent Storyboard do pobrania buduje uporządkowane obrazy klatek kluczowych i klipy w trybach Roleplay i Game Mode. Po włączeniu animacji Marinara animuje każdą udaną klatkę kluczową, korzystając z wybranego modelu wideo i szablonu **Storyboard Video Prompt** należącego do agenta. Zobacz [Przewodnik po agencie Storyboard](../game/storyboard.md).

## Rozwiązywanie problemów

### "Choose a Video Generation connection"

Czat nie ma modelu wideo. Otwórz **Chat Settings → Agents → Scene Videos** i wybierz model. Jeśli lista jest pusta, dodaj go w panelu **Connections**.

### "Add or generate a gallery image before generating a scene video"

Tryb Game Mode i przycisk **Animate illustration** wymagają istniejącego obrazu. Tryb Roleplay może utworzyć klip na podstawie samej fabuły, gdy nie wybrano pierwszej klatki. Użyj przycisku **Illustrate**, wgraj obraz albo kliknij **Animate illustration** na obrazie, który już masz.

### Wideo powstaje bardzo długo

To normalne. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud i Seedance uruchamiają zadanie, a Marinara czeka na jego zakończenie. Jeden klip może zająć kilka minut.

### Seedance nie potrafi odczytać obrazu referencyjnego

Seedance potrzebuje publicznego linku do obrazu. Na serwerze lokalnym włącz **Upload Seedance reference frames temporarily** w modelu Seedance. Zobacz [Klatki referencyjne w Seedance](#seedance-reference-frames).

### Żądania wideo ciągle kończą się błędem

Sprawdź, czy konto ma poprawny klucz API i dostęp do wideo. Otwórz konto w panelu **Connections** i potwierdź klucz oraz model. Limity czasu po stronie serwera opisuje [Konfiguracja serwera](../CONFIGURATION.md).

## Powiązane przewodniki

- [Animowane wyrazy twarzy](animated-expressions.md)
- [Przewodnik po agencie Storyboard](../game/storyboard.md)
- [Storyboardy LTX 2.3 w Game Mode](../game/ltx-2-3-storyboards.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
