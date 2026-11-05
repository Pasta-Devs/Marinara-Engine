# Dostawcy generowania obrazów i konfiguracja

Na generowaniu obrazów opierają się ilustracje scen, selfie, tła scen oraz generowane awatary, portrety i sprite'y. Ten przewodnik pokazuje, jak dodać usługę do generowania obrazów i czego wymaga każda z usług. Kiedy działa jeden model obrazów, może z niego korzystać każda funkcja graficzna w aplikacji.

## Dodawanie usługi do generowania obrazów

Klucz API to tajny kod od usługi, dzięki któremu Marinara może korzystać z twojego konta. Marinara sama wpisuje adres internetowy każdej usługi, więc rzadko trzeba go wpisywać.

1. Kliknij **Connections** (Połączenia) na górnym pasku, a potem **Add** (dodaj). Otwiera się okno **Add account** (dodanie konta).
2. Znajdź usługę. Lista ma sekcję **Images & video** (obrazy i wideo), a pole **Search providers** (wyszukiwanie dostawców) pomaga ją odnaleźć.
3. Wklej klucz w pole **API key** (klucz API). Usługi darmowe i lokalne go nie potrzebują. Przy serwerze, który uruchamiasz u siebie, wypełnij pole adresu.
4. Kliknij **Connect** (połącz). Marinara testuje konto.
5. Wybierz model obrazów z listy albo wpisz identyfikator modelu. To jest twój model obrazów. Pojawia się pod kontem w panelu **Connections**.
6. Otwórz model obrazów i kliknij **Test image** (test obrazu). Marinara tworzy mały obrazek testowy.
7. Żeby aplikacja używała tego modelu do obrazów, ustaw zadanie **Images** (obrazy) w sekcji **Defaults** (ustawienia domyślne) u góry panelu **Connections**.

Aby dodać kolejny model obrazów do konta, otwórz jego menu **⋯** (trzy kropki) i kliknij **Add image model** (dodanie modelu obrazów). Pełny opis tego okna znajdziesz w przewodniku [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Jeśli się nie udało: **Test image** kończy się błędem, gdy klucz lub adres jest nieprawidłowy. Najpierw sprawdź oba. **Test provider** (test dostawcy) sprawdza tylko, czy Marinara może połączyć się z usługą. **Test image** tworzy prawdziwy obraz i może zużywać kredyty.

## Zamawianie obrazu w czacie

Gdy model obrazów jest już ustawiony w zadaniu **Images**, poproś o obraz w czacie.

1. Dodaj agenta Illustrator do czatu w trybie Roleplay. Zobacz [Agent Illustrator](illustrator-agent.md).
2. Otwórz **Chat Settings** (ustawienia czatu), rozwiń sekcję **Gallery** (galeria) i kliknij **Illustrate** (zilustruj).
3. Poczekaj, aż skończy się etap **Generating...** (generowanie). Obraz pojawi się w galerii.

W czacie w trybie Roleplay możesz też użyć komendy `/illustrate`. Opisuje ją przewodnik [Lista komend slash](../chats/slash-commands.md).

## Wybór usługi

Marinara sama wpisuje adres każdej usługi. Usługi w chmurze wymagają konta, a większość z nich także klucza API. Usługi darmowe nie potrzebują klucza. Usługi lokalne uruchamiają program do obrazów na twoim własnym komputerze.

**Najłatwiejszy start:** wybierz **Pollinations**. To usługa darmowa, bez konta i bez klucza. Jeśli chcesz lepszych obrazów, wybierz później mocniejszą usługę.

| Usługa | Klucz API | Gdzie działa |
| --- | --- | --- |
| OpenAI (DALL-E) | Tak | Chmura |
| ChatGPT (Codex login) | Nie, korzysta z `codex login` | Chmura |
| Stability AI | Tak | Chmura |
| Together AI | Tak | Chmura |
| Arli AI | Tak | Chmura |
| NovelAI | Tak | Chmura |
| OpenRouter Images | Tak | Chmura |
| xAI / Grok Imagine | Tak | Chmura |
| Venice.ai | Tak | Chmura |
| Z.AI | Tak | Chmura |
| Atlas Cloud | Tak | Chmura |
| fal.ai | Tak | Chmura |
| SpicyAPI | Tak | Chmura |
| NanoGPT | Tak | Chmura |
| Block Entropy | Tak | Chmura |
| RunPod Serverless (ComfyUI) | Tak | Chmura |
| Pollinations | Nie | Darmowa chmura |
| Stable Horde | Opcjonalnie | Darmowa chmura |
| SD Web UI (AUTOMATIC1111 / Forge) | Nie | Lokalnie |
| ComfyUI | Nie | Lokalnie |
| SwarmUI | Opcjonalnie | Lokalnie |
| Draw Things | Nie | Lokalnie |

Uwagi o prostych usługach:

- **OpenAI (DALL-E)**: udostępnia modele DALL-E i GPT Image.
- **Stability AI**: modele Stable Diffusion i Stable Image.
- **Together AI**: FLUX i inne otwarte modele graficzne.
- **OpenRouter Images**: sięga po modele graficzne przez interfejs czatu OpenRouter, więc dostępne modele zależą od konta.
- **xAI / Grok Imagine**: korzysta z Grok Imagine.
- **NanoGPT**: agregator, więc korzystaj z jego listy modeli.
- **Pollinations**: najszybszy sposób, żeby wypróbować generowanie obrazów. Konto nie jest potrzebne.
- **Stable Horde**: sieć zasilana przez społeczność. Darmowy klucz daje wyższy priorytet w kolejce.
- **SD Web UI** i **Draw Things**: uruchom program z włączonym interfejsem programistycznym. Marinara traktuje Draw Things jak serwer AUTOMATIC1111 (ta aplikacja działa w systemie macOS lub iOS).
- **Block Entropy**: Marinara nie ma dla tej usługi dedykowanej obsługi, więc wysyła żądania w formacie zgodnym z OpenAI. Zgodność nie jest potwierdzona. Przetestuj usługę przyciskiem **Test image**, zanim zaczniesz na niej polegać.

## Usługi wymagające specjalnej konfiguracji

### ChatGPT (Codex login)

Ta usługa zamiast klucza API korzysta z twojego planu ChatGPT, więc obrazy nie wymagają kredytów API OpenAI.

1. Na komputerze, na którym działa Marinara, zainstaluj narzędzie Codex CLI i jeden raz uruchom polecenie `codex login`. Z tego samego logowania korzysta konto czatu ChatGPT. Zobacz [Połączenia abonamentowe z Claude, ChatGPT i Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Wybierz usługę. Nie trzeba wpisywać klucza ani adresu. Marinara sama wpisuje model `gpt-image-2`, czyli ten, którego Codex używa do obrazów.

**Test provider** sprawdza tylko, czy Marinara może odczytać twoje logowanie Codex. **Test image** tworzy prawdziwy obraz i wlicza się do twoich limitów obrazów w ChatGPT. Przy obrazach referencyjnych Marinara wysyła żądanie edycji i dołącza najwyżej 16 z nich. ChatGPT może zwrócić obraz o innym rozmiarze w pikselach, dlatego Marinara podaje też w prompcie oczekiwane proporcje. Ta usługa korzysta z punktu końcowego ChatGPT do obrazów, którego używa Codex, a nie z publicznego API OpenAI, więc OpenAI może go zmienić bez zapowiedzi.

### Arli AI

Udostępnia hostowane modele Stable Diffusion. Model jest wymagany, więc wpisz nazwę wybranego modelu graficznego Arli AI. Korzysta z tych samych pól **Local Image Defaults** (domyślne ustawienia obrazów lokalnych) co SD Web UI (zobacz [Panel Local Image Defaults](#local-image-defaults-per-connection)). Pierwszy obraz referencyjny służy jako obraz początkowy. Ta usługa służy wyłącznie do obrazów. Modele czatu Arli AI opisuje przewodnik [Obsługiwani dostawcy AI](../connections/providers-reference.md#arli-ai).

### NovelAI

Usługa NovelAI skupia się na grafice w stylu anime. Przy modelach V4, V4.5 i V5 Marinara wysyła natywne prompty poszczególnych postaci wraz z ich pozycjami dla storyboardów i scen agenta Illustrator z wieloma postaciami. Precyzyjne obrazy referencyjne działają wyłącznie na modelu V4.5.

### Venice.ai

Marinara korzysta z natywnego punktu końcowego Venice do obrazów, wyłącza opcjonalne rozmycie trybu bezpiecznego Venice i dopasowuje żądane wymiary do formatu rozmiaru każdego modelu. Zasady samej usługi Venice lub limity modelu nadal mogą odrzucić żądanie.

### Z.AI

Użyj zwykłego klucza API do usługi Z.AI. Klucze z planu GLM Coding Plan i adres `/api/coding/paas/v4` nie nadają się do obrazów. Wybierz **GLM-Image** albo **CogView 4**. Marinara dopasowuje proporcje do rozmiaru obsługiwanego przez model, pobiera tymczasowy wynik i zapisuje go lokalnie. Usługa obsługuje tylko zamianę tekstu na obraz i nie wysyła obrazów referencyjnych.

### Atlas Cloud

Marinara wczytuje aktualny katalog modeli text-to-image i image-to-image usługi Atlas Cloud. Jeśli się nie uda, pokazuje listę startową (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Zawsze możesz też wpisać dokładny identyfikator modelu. Zadania działają asynchronicznie, więc Marinara uruchamia zadanie i odpytuje usługę, aż obraz będzie gotowy. Obrazy referencyjne trafiają do modeli, których identyfikatory wskazują obsługę image-to-image, edycji lub Kontext. Schematy modeli Atlas się różnią, więc przy innych identyfikatorach sprawdź dokumentację danego modelu w Atlas Cloud.

### fal.ai

Utwórz klucz API w serwisie [fal.ai](https://fal.ai/dashboard/keys). Lista startowa zawiera `fal-ai/flux/schnell` i `fal-ai/flux/dev`. Możesz wpisać identyfikator innego punktu końcowego text-to-image ze zgodnym wejściem i wyjściem. **Test provider** sprawdza tylko konfigurację. **Test image** wysyła prawdziwe żądanie i zużywa kredyty fal.ai.

Marinara wysyła prompt i wymiary, a potem pobiera pierwszy zwrócony obraz. Negatywne prompty są dopisywane jako tekst. Do opcji modelu, takich jak `seed`, `num_inference_steps` czy `image_size`, użyj pola **Custom Parameters** (parametry niestandardowe). Integracja korzysta z synchronicznych żądań text-to-image, nie wysyła obrazów referencyjnych i nie wznawia przerwanych zadań. Zobacz [dokumentację API](https://fal.ai/models/fal-ai/flux/schnell/api) modelu.

### SpicyAPI

Utwórz klucz w [konsoli SpicyAPI](https://spicyapi.ai/console/keys) i wybierz **SpicyAPI**. Marinara sama wpisuje model `alibaba/z-image-spicy-pro/text-to-image`. Możesz wpisać inny identyfikator, na przykład `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** odczytuje listę modeli, więc nic nie kosztuje. **Test image** tworzy prawdziwy obraz i zużywa twoje saldo.

Wybierz usługę **SpicyAPI**. Nie używaj usługi **OpenAI (DALL-E)** ani konta zgodnego z OpenAI z adresem SpicyAPI. Adres SpicyAPI w stylu OpenAI obsługuje tylko tekst.

Każdy model przyjmuje własne ustawienia. Marinara pyta usługę SpicyAPI, które z nich przyjmuje dany model, i wysyła tylko te, w najbliższym formacie, jaki model oferuje (proporcje obrazu, szerokość i wysokość albo stały rozmiar). Jeśli model nie ma pola na negatywny prompt, negatywny prompt jest dopisywany na końcu promptu. Do innych opcji, takich jak `seed`, `resolution` czy `loras`, użyj pola **Custom Parameters**.

Każdy obraz to osobne zadanie. Marinara czeka, sprawdza je ponownie po mniej więcej minucie, a potem pobiera wynik. Jeśli połączenie zostanie przerwane, wraca do tego samego zadania, zamiast płacić za nowe. Modele do edycji (identyfikatory kończące się na `/edit`) dostają twoje obrazy referencyjne. Usługa SpicyAPI przyjmuje do 1 MB na obraz i do 2 MB na żądanie, więc Marinara zmniejsza większe obrazy i pomija nadmiarowe, które się nie mieszczą.

### SwarmUI

SwarmUI potrafi rozdzielać pracę ComfyUI w ramach własnej kolejki. Lokalny serwer bez kont nie potrzebuje klucza. Jeśli twój serwer wymaga konta, wklej Swarm Auth Token (token uwierzytelniający SwarmUI) do pola **API key**. Lista modeli pokazuje modele z twojego serwera SwarmUI.

Pole **ComfyUI workflow (optional)** (workflow ComfyUI, opcjonalny) może zostać puste. Zostaw je puste, żeby korzystać z ustawień obrazów samego SwarmUI, albo wklej workflow (opis niżej). Włącz **Save images in SwarmUI** (zapisywanie obrazów w SwarmUI) w panelu **Local Image Defaults**, żeby dodatkowo zachowywać każdy obraz w folderze wyjściowym SwarmUI. Marinara i tak trzyma własną kopię.

### Usługi lokalne w twojej sieci

`localhost` oznacza komputer, na którym działa Marinara. Lokalne serwery obrazów na tym komputerze działają bez dodatkowej konfiguracji. Jeśli serwer działa na innym komputerze w twojej sieci, zezwól na adresy z sieci lokalnej w konfiguracji serwera. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

Gdy usługa zwraca adres URL zamiast danych obrazu, Marinara pobiera publiczne adresy sieci CDN przez zwykłe kontrole ruchu wychodzącego. Adres wyniku z sieci prywatnej lub z pętli zwrotnej jest przyjmowany tylko wtedy, gdy protokół, nazwa hosta i port zgadzają się dokładnie z ustawioną usługą obrazów. Przekierowania z takiego pochodzenia nie mogą prowadzić do innej usługi lokalnej. Jeśli lokalne proxy trzyma wyniki pod innym prywatnym pochodzeniem, ustaw je tak, żeby udostępniało te pliki spod tego samego pochodzenia co jego API do obrazów.

## Plik JSON z workflow ComfyUI a RunPod

Przy usługach **ComfyUI**, **SwarmUI** i **RunPod Serverless (ComfyUI)** pojawia się pole **ComfyUI workflow (optional)** albo **(required)**. Wklej do niego plik JSON z workflow wyeksportowany z ComfyUI opcją **Save (API Format)**, **Export (API)** albo **Export to API**, zależnie od wersji ComfyUI. Pole jest opcjonalne przy ComfyUI i SwarmUI, a wymagane przy RunPod. RunPod potrzebuje tokena API do usługi RunPod jako klucza API, wartości **RunPod endpoint ID** (identyfikator punktu końcowego RunPod) oraz workflow.

Wstaw te znaczniki tekstowe w miejscach workflow, w których Marinara ma wpisać wartość:

- `%prompt%` i `%negative_prompt%` dla promptów.
- `%width%`, `%height%` i `%seed%` dla rozmiaru i ziarna losowości.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` i `%denoise%` dla ustawień generowania.
- `%reference_image%` oraz `%reference_image_01%` do `%reference_image_04%` dla danych obrazów referencyjnych.
- `%reference_image_name%` oraz `%reference_image_name_01%` do `%reference_image_name_04%` do wgrania obrazów referencyjnych i wpisania ich nazw plików dla lokalnego węzła LoadImage w ComfyUI.

Najważniejszy jest znacznik `%prompt%`. Edytor ostrzega, kiedy go brakuje. Przy ComfyUI puste pole oznacza użycie wbudowanego workflow domyślnego. Przy SwarmUI oznacza użycie ustawień samego SwarmUI. RunPod nie ma workflow domyślnego, więc workflow jest wymagany. Wszystkie trzy usługi przyjmują do 4 surowych obrazów referencyjnych w formacie base64. Znaczniki z wgrywaniem plików i ich nazwami działają wyłącznie przy lokalnym ComfyUI.

Pełne kroki eksportu, przykłady, zasady cudzysłowów, obrazy referencyjne, workflow dla konkretnych postaci, dostęp przez sieć i rozwiązywanie problemów opisuje przewodnik [Konfiguracja workflow w ComfyUI](comfyui.md).

<a id="local-image-defaults-per-connection"></a>

## Panel Local Image Defaults w połączeniu

Panel **Local image defaults** (domyślne ustawienia obrazów lokalnych) pojawia się w modelu obrazów przy usługach **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** i **RunPod Serverless (ComfyUI)**. Draw Things i Arli AI pokazują pola SD Web UI. SwarmUI i RunPod pokazują pola ComfyUI. Te ustawienia działają tylko wtedy, gdy obraz tworzy ten model. Przycisk **Reset** przywraca wartości wbudowane.

Każda usługa ma pole **Seed** (ziarno). Wartość -1 sprawia, że każdy obraz jest losowy. Każda inna liczba oznacza użycie tego samego ziarna za każdym razem. Pozostałe pola zależą od usługi.

| Usługa | Pole | Domyślnie |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Każda usługa ma też pola **Prompt prefix** i **Negative prefix**. Wpisany tam tekst trafia na początek każdego promptu w tym modelu. AUTOMATIC1111 / Forge i ComfyUI mają pole **Clip skip**. AUTOMATIC1111 / Forge dokłada przełącznik **Restore faces**. ComfyUI dokłada przełącznik, który wgrywa obrazek zastępczy 1x1, gdy nie podano obrazu referencyjnego. Ma on znaczenie tylko przy własnych workflow ze znacznikami obrazów referencyjnych. NovelAI dokłada pola **Guidance rescale** i **UC preset**.

## Obsługa obrazów referencyjnych zależy od usługi

Obraz referencyjny to gotowy obrazek wysyłany razem z promptem, dzięki któremu nowy obraz zachowuje twarz postaci albo styl graficzny.

| Usługa | Obrazy referencyjne |
| --- | --- |
| OpenAI (DALL-E) | Do 16, tylko modele GPT Image |
| ChatGPT (Codex login) | Do 16 |
| NovelAI | Do 16, tylko model V4.5 |
| xAI / Grok Imagine | Do 3 |
| NanoGPT | Do 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Do 4, przez znaczniki w workflow |
| Stability AI, Arli AI, SD Web UI, Draw Things | Tylko pierwszy obraz, do zamiany obrazu na obraz |
| Atlas Cloud | Pierwszy obraz, przy zgodnych identyfikatorach modeli image-to-image, edycji lub Kontext |
| SpicyAPI | Tylko modele do edycji, do limitu modelu; obrazy są zmniejszane, żeby się zmieściły |
| OpenRouter Images | Obsługiwane, bez stałego limitu |
| Venice.ai, Z.AI | Nieobsługiwane przy zamianie tekstu na obraz |
| Together AI, Pollinations, Stable Horde, fal.ai | Nieobsługiwane |

Precyzyjne obrazy referencyjne w usłudze NovelAI działają wyłącznie na modelu V4.5, na przykład `nai-diffusion-4-5-full`. Usługa NovelAI nie udostępniła jeszcze funkcji Precise Reference dla V5. Jeśli zażądasz obrazów referencyjnych na innym modelu, Marinara wygeneruje obraz bez nich i zapisze ostrzeżenie w logu serwera.

## Kolejkowanie żądań generowania mediów

Przełącznik **Queue media generation requests** (kolejkowanie żądań generowania mediów) znajduje się w **Settings → Generations → Overall Generations** (ustawienia, generowanie, ogólne ustawienia generowania). Domyślnie jest włączony.

Kiedy jest włączony, Marinara wysyła zadania graficzne do każdego konta obrazów pojedynczo, a zadania wideo do każdego konta wideo również pojedynczo, w osobnych kolejkach. Obraz i wideo dla tego samego konta mogą powstawać jednocześnie. Dotyczy to każdej funkcji, która je zleca: agenta Illustrator, trackerów, komend, galerii, zasobów trybu Game Mode i pobranych agentów, takich jak Slurp. Dwa modele z tym samym adresem i kluczem API dzielą kolejkę. Różne konta nadal działają jednocześnie. Usługa NovelAI dostaje też krótką przerwę między zadaniami, a gdy odpowiada, że jest zajęta, Marinara czeka i próbuje jeszcze dwa razy.

Zostaw go włączonego przy usługach, które odrzucają dwa żądania naraz. Wyłącz go tylko wtedy, gdy twoja usługa obsługuje wiele żądań jednocześnie, a zależy ci na szybkości.

## Powiązane przewodniki

- [Konfiguracja workflow w ComfyUI](comfyui.md)
- [Agent Illustrator](illustrator-agent.md)
- [Profile stylu obrazów](style-profiles.md)
- [Tła scen i galeria](scene-backgrounds.md)
- [Selfie](../conversation/selfies.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
