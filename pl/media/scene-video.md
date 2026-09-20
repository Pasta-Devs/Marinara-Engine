# Generowanie wideo sceny

Ten przewodnik wyjaśnia, jak Marinara Engine zamienia ilustrację sceny w krótki klip wideo MP4. Znajdziesz tu opis dostawców wideo, sposób generowania klipu w panelu **Gallery** (galeria), kontrolki trybu **Game Mode** oraz ustawienia wideo. Wideo sceny to krótki animowany klip zrobiony z jednego nieruchomego obrazu.

## Do czego służy wideo sceny

Wideo sceny bierze istniejący obraz z galerii i animuje go w krótki klip MP4. Nieruchomy obraz staje się pierwszą klatką, a AI dodaje ruch. Wideo sceny działa w czatach w trybie **Roleplay** i **Game Mode**.

Najpierw zawsze potrzebny jest obraz. Generowanie wideo sceny nie ruszy z samego tekstu. Zanim cokolwiek da się zanimować, trzeba wygenerować lub wgrać obraz do galerii.

Wideo sceny korzysta z osobnego typu połączenia o nazwie **Video Generation** (generowanie wideo). To nie to samo co zwykłe generowanie obrazów. Gotowe klipy zapisują się razem z czatem i pokazują się w panelu **Gallery**, gdzie można je przypiąć, pobrać lub obejrzeć.

## Połączenia typu Video Generation

Żeby robić wideo sceny, dodaj najpierw połączenie, które potrafi generować wideo. Służy do tego ten sam panel **Connections** (połączenia) co przy połączeniach czatu i obrazów.

1. Otwórz sekcję **Settings** (ustawienia), a potem **Connections**.
2. Kliknij przycisk **Add Connection**.
3. Ustaw typ dostawcy na **Video Generation**.
4. W polu **Video Service** wybierz jedną z sześciu poniższych usług.
5. Wpisz klucz API (tajny kod, trochę jak hasło) dla usługi w chmurze. Lokalne ComfyUI go nie potrzebuje.
6. Przy usługach w chmurze wybierz model albo zostaw domyślny model dostawcy. Przy ComfyUI zostaw pole modelu puste, chyba że workflow używa `%model%`.
7. Zapisz połączenie.

Lista **Video Service** daje sześć możliwości. Każda podstawia domyślny adres internetowy, a tam, gdzie ma to zastosowanie, także domyślny model:

| Video Service        | Model domyślny                    | Uwagi                                                                        |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | Uruchamia modele wideo Gemini Omni i Veo przez API Gemini.                   |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | Wideo Grok Imagine przez API xAI Videos.                                     |
| **OpenRouter Video** | `google/veo-3.1`                  | Modele wideo przez OpenRouter. Można wpisać dowolny identyfikator modelu wideo z OpenRouter. |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | Hostowane modele text-to-video i image-to-video przez Atlas Cloud.           |
| **Seedance 2.0**     | `seedance-2-0`                    | Tryby wideo: z tekstu, z pierwszej klatki oraz z pierwszej i ostatniej klatki. |
| **ComfyUI**          | Zależny od workflow               | Lokalne WAN i inne workflow wideo wyeksportowane w formacie API.             |

**Google AI Studio** obejmuje dwie rodziny modeli. **Gemini Omni** korzysta z `gemini-omni-flash-preview`. **Google Veo** korzysta z `veo-3.1-generate-preview`. To, która rodzina zadziała, zależy od modelu wybranego w połączeniu.

Przy **ComfyUI** użyj zwykłego adresu lokalnego `http://127.0.0.1:8188` i wklej workflow wideo w formacie API do pola **ComfyUI Workflow**. Workflow jest wymagany. Opis symboli zastępczych i wymagań dotyczących węzła wyjściowego znajdziesz w przewodniku [Konfiguracja workflow w ComfyUI](comfyui.md#comfyui-video-workflows).

### Ustawienie domyślnego połączenia wideo

Edytor połączenia typu Video Generation pokazuje grupę **Default for Videos**. Włącz przełącznik **Use as default video connection**, żeby Marinara mogła sięgać po to połączenie, gdy czat nie ma własnego połączenia wideo. Jako domyślne połączenie wideo oznacz tylko jedno połączenie.

### Ustawienia domyślne wideo w połączeniu

Połączenie typu Video Generation ma w edytorze własny panel **Video Generation Defaults**. Ustawiasz tu domyślną długość klipu, proporcje obrazu i rozdzielczość dla tego połączenia. Te ustawienia domyślne mają pierwszeństwo przed zapasową długością obowiązującą w całej aplikacji.

| Usługa           | Długość domyślna | Zakres długości | Proporcje obrazu | Rozdzielczość     |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10s            | od 1 do 60s  | 16:9         | Domyślna dostawcy |
| Google Veo       | 8s             | 4, 6 lub 8s  | 16:9         | 720p             |
| xAI Imagine      | 10s            | od 1 do 15s  | 16:9         | 720p             |
| OpenRouter Video | 10s            | od 1 do 60s  | 16:9         | 720p             |
| Atlas Cloud      | 8s             | od 1 do 60s  | 16:9         | 720p             |
| Seedance 2.0     | 5s             | od 4 do 15s  | 16:9         | 720p             |
| ComfyUI          | 5s             | od 1 do 60s  | 16:9         | 720p             |

Gemini Omni nie ma pola rozdzielczości, a długość trafia do treści promptu zamiast do osobnego ustawienia. Google Veo wymusza 8 sekund zawsze, gdy animuje obraz referencyjny, bo tyle czasu potrzebuje na zmiksowanie pierwszej i ostatniej klatki.

### Klatki referencyjne w Seedance

Seedance musi pobrać obraz referencyjny przez publiczny adres internetowy, zanim go zanimuje. Lokalny serwer Marinara Engine nie ma publicznego adresu, więc zwykła instalacja lokalna wymaga jednego dodatkowego kroku.

Otwórz połączenie Seedance i włącz przełącznik **Upload Seedance reference frames temporarily**. Klatka referencyjna trafia wtedy pod tymczasowy publiczny adres, z którego Seedance może ją odczytać. Czas życia tego adresu wybierasz w polu **Temporary link lifetime**, a domyślnie wynosi on 12 godzin.

Jeśli serwer Marinara Engine ma już publiczny adres internetowy, zamiast tymczasowego wgrywania da się ustawić zmienną środowiskową. Ustawienie obrazu referencyjnego dla wideo opisuje [Konfiguracja serwera](../CONFIGURATION.md).

## Wybór dostawcy

Wszystkie sześć usług robi krótkie klipy z obrazu. Różnią się szybkością, długością klipu i sposobem obsługi obrazów referencyjnych.

- **Google AI Studio (Gemini Omni)**: elastyczna długość do 60 sekund. Długość wpisuje się w treść promptu, nie ma osobnej kontrolki.
- **Google AI Studio (Veo)**: wysoka jakość, ale sztywne 4, 6 lub 8 sekund. Przy animowaniu obrazu używa 8 sekund.
- **xAI Imagine**: klipy od 1 do 15 sekund. Ma krótszy limit długości promptu niż pozostałe usługi.
- **OpenRouter Video**: od 1 do 60 sekund, z możliwością wpisania dowolnego modelu wideo obsługiwanego przez konto OpenRouter.
- **Atlas Cloud**: **Fetch Models** (Pobierz modele) wczytuje aktualny katalog modeli wideo Atlas Cloud, pokazując najpierw modele image-to-video i cenę początkową za sekundę filmu dla każdego modelu. Jeśli katalog jest niedostępny, Marinara pokazuje modele startowe Veo 3.1 i Seedance 2.0. Możesz też wpisać dokładny identyfikator modelu wideo Atlas Cloud; nadal obowiązują ograniczenia czasu trwania, rozdzielczości i obrazów referencyjnych danego modelu.
- **Seedance 2.0**: klipy od 4 do 15 sekund, z trybem pierwszej klatki oraz pierwszej i ostatniej klatki. Wymaga publicznego adresu do obrazu referencyjnego.
- **ComfyUI**: generowanie lokalne przez własny workflow w formacie API. Marinara wgrywa obraz referencyjny prosto do ComfyUI, gdy workflow używa `%reference_image_name%`.

Zadania wideo trwają. Dostawca uruchamia zadanie, a potem Marinara czeka i sprawdza, aż klip będzie gotowy. Jeden klip może zająć kilka minut, czyli dłużej niż nieruchomy obraz. Duże lokalne modele WAN mogą potrzebować więcej niż domyślne 30 minut; w takim wypadku podnieś `VIDEO_GEN_TIMEOUT_MS` i uruchom aplikację Marinara Engine ponownie.

### Różnice między modelami Atlas Cloud

Modele Atlas Cloud nie przyjmują jednakowych ustawień. Przed każdym żądaniem Marinara odczytuje opublikowany schemat wejściowy modelu z `static.atlascloud.ai` i dopasowuje do niego domyślne ustawienia połączenia:

- Ilustracja źródłowa trafia do pola obrazu używanego przez dany model.
- Długość klipu zmienia się na najbliższą obsługiwaną wartość. Model ograniczony do 5 lub 10 sekund zamieni domyślne 8 sekund na 10.
- Rozdzielczość zmienia się na najbliższy obsługiwany poziom. Modele przyjmujące rozmiar w pikselach otrzymują najbliższe `width*height` dla wybranych proporcji i rozdzielczości.
- Ustawienia nieobsługiwane przez model są pomijane, aby zadziałała wartość domyślna modelu.

Log serwera wymienia wszystkie zmienione wartości w wierszu zaczynającym się od `[video-gen/atlas-cloud] fitted request`. Jeśli nie da się odczytać schematu, Marinara wysyła takie samo ogólne żądanie jak wcześniej.

Do filmów ze scen wybierz model **image-to-video** (obraz na wideo). Model text-to-video nie ma pola obrazu, więc pomija ilustrację i tworzy osobny klip wyłącznie na podstawie promptu. Serwer odnotowuje taką sytuację w logu.

**Test Video** (Testuj wideo) wysyła zwykły gradient jako pierwszą klatkę, jeśli wybrany model Atlas Cloud wymaga obrazu. Dzięki temu modele image-to-video mogą przejść test połączenia.

### Opcje modelu Atlas Cloud

Wiele modeli Atlas Cloud ma własne pola wejściowe, takie jak `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` lub listy LoRA. Edytor połączenia pokazuje pola wybranego modelu:

1. Otwórz połączenie Atlas Cloud i wybierz lub wpisz model.
2. Rozwiń **Video Defaults** (Domyślne ustawienia wideo), a następnie **Atlas Cloud setup** (Konfiguracja Atlas Cloud).
3. Znajdź **Model options** (Opcje modelu) pod ustawieniami długości klipu, proporcji i rozdzielczości.

Na górze **Model options** znajduje się lista długości klipów, rozdzielczości, rozmiarów klatek i proporcji obsługiwanych przez model. Przy modelu text-to-video pojawia się też ostrzeżenie, ponieważ taki model nie może użyć obrazu z galerii.

Nazwy i opisy opcji pochodzą bezpośrednio z Atlas Cloud. Każda opcja zaczyna z ustawieniem **Model default** (Domyślna wartość modelu), a wartość domyślna dostawcy jest pokazana w nawiasach. Opcja pozostawiona na **Model default** nie jest wysyłana: decyduje Atlas Cloud. Zmień opcję, aby wysyłać własną wartość przy każdym filmie generowanym przez to połączenie, także przez **Test Video**. Pola list i obiektów, na przykład LoRA, przyjmują JSON.

Wybory są zapisywane osobno dla każdego modelu. Przełączenie na inny model i z powrotem zachowuje opcje obu. **Reset model options** (Resetuj opcje modelu) usuwa wybory dla bieżącego modelu. Kliknij **Save** (Zapisz) w połączeniu, aby zachować zmiany.

Jeśli zapisana opcja przestanie pasować do modelu, na przykład po zmianie jego pól wejściowych przez Atlas Cloud, Marinara pominie ją w żądaniu i wymieni w wierszu logu `[video-gen/atlas-cloud] fitted request`.

## Generowanie wideo w panelu Gallery

Czaty w trybie **Roleplay** i **Game Mode** robią wideo sceny z poziomu panelu **Gallery**. Otwiera go ikona obrazu lub galerii w czacie. Czaty w trybie **Game Mode** mają jeszcze drugie miejsce do tego samego, czyli panel **Game Assets**, opisany dalej w tym przewodniku.

Panel **Gallery** ma zakładkę **Images** i zakładkę **Videos**, każdą z licznikiem. Nieruchome obrazy znajdują się w zakładce **Images**. Gotowe klipy trafiają do zakładki **Videos**.

Żeby zanimować najnowszy obraz:

1. Sprawdź, czy w zakładce **Images** jest przynajmniej jeden obraz. Użyj wcześniej przycisku **Illustrate** albo wgraj obraz.
2. Kliknij przycisk **Video** w rzędzie akcji na górze panelu **Gallery**.
3. Jeśli w sekcji **Settings**, **Generations**, **Overall Generations** włączono opcję **Expose media prompts before sending**, przejrzyj lub popraw skompilowany prompt animacji i kliknij przycisk **Generate**. Anulowanie tego okna nie wysyła do dostawcy żadnego żądania.
4. Przycisk zmienia się w **Generating...**, a baner informuje, że generowanie wideo trwa.
5. Po zakończeniu klip pojawia się w zakładce **Videos**.

Żeby zanimować konkretny obraz zamiast najnowszego:

1. Otwórz zakładkę **Images**.
2. Najedź kursorem na wybrany obraz.
3. Kliknij przycisk **Animate illustration** (ikona kliszy filmowej) wśród kontrolek, które się wtedy pokazują.

Przy włączonym przeglądaniu promptu to samo okno **Review Video Prompt** pojawia się także dla przycisku **Animate illustration**. Pokazuje dokładny prompt skompilowany przez serwer, czas trwania, proporcje obrazu i rozdzielczość, które zostaną użyte dla wybranego obrazu. Poprawka działa tylko dla tego jednego generowania. W trybie **Roleplay** wielokrotnymi instrukcjami, które tworzą ten prompt, steruje osobno ustawienie **Roleplay Gallery Animation Director** w sekcji **Settings**, **Generations**, **Video Generation Prompt Overrides**.

W zakładce **Videos** każdy klip odtwarza się na miejscu i pokazuje swoją długość oraz nazwę modelu. Klip można przypiąć przyciskiem **Pin video to chat** albo zapisać przyciskiem **Download scene video**. Dopóki nie ma żadnych klipów, zakładka pokazuje napis **No videos yet**.

Przy próbie zrobienia wideo bez żadnego obrazu w czacie Marinara pokazuje komunikat: "Add or generate a gallery image before generating a scene video." Wygeneruj lub wgraj obraz, a potem spróbuj ponownie.

## Wideo sceny w trybie Game Mode

Tryb **Game Mode** ma drugie miejsce do robienia wideo sceny: panel **Game Assets**. Otwiera go przycisk **Game Assets** wśród kontrolek gry.

1. Otwórz panel **Game Assets**.
2. Kliknij przycisk **Generate video**. Jego podpowiedź brzmi "Generate a scene video from the latest illustration."
3. Gotowy najnowszy klip odtwarza się w panelu.

Przycisk **Generate video** pozostaje nieaktywny, dopóki gra nie ma zarówno połączenia wideo, jak i ilustracji sceny. Po zbyt wczesnym kliknięciu może pojawić się jeden z tych komunikatów:

- "Choose a Video Generation connection in Game Settings first." Ustaw połączenie wideo dla gry.
- "Generate a scene illustration before generating a scene video." Zrób najpierw obraz.

Gdy klip się nie uda, panel pokazuje napis "Scene video generation failed." Spróbuj ponownie, a przy powtarzających się błędach sprawdź połączenie i klucz API.

## Wybór połączenia wideo dla czatu

Każdy czat wybiera własne połączenie wideo. Ustawia się je w sekcji **Chat Settings** (ustawienia czatu), następnie **Agents**, następnie **Scene Videos**.

Czaty w trybie **Roleplay** pokazują kafelek **Scene Videos** z opisem "Generate manual MP4 scene videos from gallery images." Ma on jedną kontrolkę, listę rozwijaną **Video Connection**. Wybierz tutaj swoje połączenie typu Video Generation.

Czaty w trybie **Game Mode** pokazują kafelek **Scene Videos** z opisem "Generate MP4 scene videos from game illustrations." Ma on więcej kontrolek:

- **Video Connection**: połączenie typu Video Generation, z którego korzysta ta gra.
- **Game Video Prompt**: szablon promptu decydujący o tym, jak animuje się obraz. Wbudowany domyślny szablon to **Cinematic Scene Video**.
- **Edit Video Presets**: dodawanie i edycja własnych kopii szablonu promptu wideo dla tego czatu.

Szablon **Game Video Prompt** nadal steruje ręcznymi filmami z panelu **Gallery** i **Game Assets** w trybie **Game Mode**. Animacje z panelu **Gallery** w trybie **Roleplay** korzystają zamiast tego z ustawienia **Roleplay Gallery Animation Director**. Zainstalowany agent Storyboard ma własny domyślny szablon **Storyboard Video Prompt**, a każdy czat w trybie Roleplay lub Game Mode może go nadpisać w **Chat Settings > Agents > Storyboards**. Wyczyszczenie tego wyboru przywraca wartość domyślną agenta Storyboard, a nie prompt z innego czatu.

Przy pierwszym tworzeniu czatu w trybie **Game Mode** kreator konfiguracji też ma listę **Video Generation Connection**. Znajduje się w kroku **Features** i pojawia się po włączeniu opcji **Visual Generation**.

Jeśli czat nie ma własnego połączenia wideo, Marinara sięga po połączenie oznaczone przełącznikiem **Use as default video connection**. Gdy nie ma ani połączenia w czacie, ani domyślnego, akcje wideo pokazują ostrzeżenie z prośbą o wybór.

## Ustawienia generowania wideo

Część ustawień domyślnych wideo mieszka w ustawieniach aplikacji, nie w połączeniu. Otwórz sekcję **Settings**, następnie **Generations**, a potem sekcję **Video Generation**. Jej opis brzmi "Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls."

Głównym ustawieniem wideo sceny jest tutaj **Scene video fallback length**, domyślnie 10 sekund. Działa tylko wtedy, gdy wybrane połączenie wideo nie ma własnej długości. Da się je ustawić w zakresie od 1 do 60 sekund.

W tej samej sekcji jest też **Video Generation Prompt Overrides**, gdzie edytuje się wielokrotne szablony promptów wideo. Ustawienie **Roleplay Gallery Animation Director** steruje instrukcjami wysyłanymi do wybranego modelu Prompt Model, zanim powstanie klip z panelu **Gallery** w trybie **Roleplay**. Zmienna `${durationSeconds}` zostaje w nich zastąpiona wybraną długością klipu. To zaawansowany sposób na zmianę ruchu w klipach bez ruszania kodu.

Ta sama sekcja zawiera ustawienie **Animated expression length**. Należy ono do osobnej funkcji, czyli animowanych sprite'ów portretowych. Opisuje ją przewodnik [Animowane wyrazy twarzy](animated-expressions.md).

## Storyboardy

Agent Storyboard do pobrania buduje uporządkowane obrazy klatek kluczowych oraz klipy w trybach Roleplay i Game Mode. Tryb Game Mode korzysta z jednej zakończonej tury postaci GM, a tryb Roleplay łączy zakończone wymiany zdań w odcinek osadzony w czacie. Po włączeniu animacji Marinara animuje każdą udaną klatkę kluczową, korzystając z wybranego połączenia wideo i szablonu **Storyboard Video Prompt** należącego do agenta.

Storyboardy mają własne kontrolki i własny przewodnik. Instalację i sposób pracy w obu trybach opisuje [Przewodnik po agencie Storyboard](../game/storyboard.md).

## Rozwiązywanie problemów

### "Choose a Video Generation connection"

Czat nie ma wybranego połączenia wideo. Otwórz sekcję **Chat Settings**, następnie **Agents**, następnie **Scene Videos**, i wybierz połączenie. Jeśli lista rozwijana jest pusta, dodaj połączenie w sekcji **Settings**, a potem **Connections**.

### "Add or generate a gallery image before generating a scene video"

Wideo sceny zawsze animuje istniejący obraz. Użyj przycisku **Illustrate**, wgraj obraz albo kliknij przycisk **Animate illustration** na obrazie, który już masz.

### Wideo powstaje bardzo długo

To normalne. Dostawca uruchamia zadanie, a Marinara czeka i sprawdza, aż klip będzie gotowy. Veo, xAI, OpenRouter, Atlas Cloud i Seedance działają tak samo, a jeden klip potrafi zająć kilka minut.

### Seedance nie potrafi odczytać obrazu referencyjnego

Seedance potrzebuje publicznego adresu do obrazu. Na serwerze lokalnym otwórz połączenie Seedance i włącz przełącznik **Upload Seedance reference frames temporarily**. Zajrzyj do sekcji o Seedance powyżej.

### Żądania wideo ciągle kończą się błędem

Sprawdź, czy połączenie ma poprawny klucz API i czy konto ma dostęp do wideo. Otwórz połączenie w sekcji **Settings**, a potem **Connections**, i potwierdź klucz oraz model. Limity czasu po stronie serwera opisuje [Konfiguracja serwera](../CONFIGURATION.md).

## Powiązane przewodniki

- [Animowane wyrazy twarzy](animated-expressions.md)
- [Przewodnik po agencie Storyboard](../game/storyboard.md)
- [Storyboardy LTX 2.3 w Game Mode](../game/ltx-2-3-storyboards.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
