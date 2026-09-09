# Dostawcy generowania obrazów i konfiguracja

Ten przewodnik wyjaśnia, jak podłączyć usługę generowania obrazów do aplikacji Marinara Engine. Opisuje też, czego wymaga każda z 17 usług. Na generowaniu obrazów opierają się ilustracje scen, selfie, tła scen oraz generowane awatary, portrety i sprite'y.

Generowanie obrazów konfiguruje się jako szczególny rodzaj połączenia. Kiedy jedno połączenie do obrazów działa, może z niego korzystać każda funkcja graficzna w aplikacji.

## Dodawanie połączenia do generowania obrazów

**Klucz API** to tajny kod od dostawcy, trochę jak hasło, dzięki któremu Marinara korzysta z twojego konta. Pole **Base URL** (adres bazowy) zawiera adres internetowy interfejsu programistycznego danej usługi. Po wybraniu usługi Marinara sama wpisuje właściwy adres w polu **Base URL**.

Wykonaj kolejno te kroki, żeby dodać połączenie do obrazów.

1. Otwórz panel **Connections** (Połączenia).
2. Kliknij przycisk **New** (Nowe), żeby otworzyć okno **Create Connection** (utworzenie połączenia).
3. Wpisz nazwę, a potem wybierz dostawcę typu **Image Generation**.
4. W edytorze połączenia wybierz usługę z siatki w polu **Service**.
5. Wklej klucz API w polu **API Key**, jeśli usługa go wymaga. Usługi darmowe i lokalne nie potrzebują klucza.
6. Wybierz model z listy **Model** albo wpisz identyfikator modelu. Część usług udostępnia przycisk **Fetch Models from API** (pobranie listy modeli), który wczytuje aktualną listę.
7. Kliknij przycisk **Save** (Zapisz).
8. Kliknij przycisk **Test Image** (test obrazu), żeby sprawdzić, czy wszystko działa. Marinara generuje wtedy mały obrazek testowy.

Jeśli po kliknięciu **Test Image** pojawi się obrazek, połączenie jest gotowe. Jeśli test się nie powiedzie, sprawdź klucz API i adres w polu **Base URL**.

## Wybór usługi

Te 17 usług dzieli się na trzy grupy. Usługi w chmurze wymagają klucza API i konta. Usługi darmowe nie potrzebują klucza. Usługi lokalne uruchamiają program do obrazów na twoim własnym komputerze.

Tabela poniżej pokazuje wszystkie usługi w skrócie. Szczegóły i haczyki opisują dalsze sekcje, po jednej na usługę.

| Usługa | Klucz API | Gdzie działa |
| --- | --- | --- |
| OpenAI (DALL-E) | Tak | Chmura |
| Stability AI | Tak | Chmura |
| Together AI | Tak | Chmura |
| NovelAI | Tak | Chmura |
| OpenRouter Images | Tak | Chmura |
| xAI / Grok Imagine | Tak | Chmura |
| Venice.ai | Tak | Chmura |
| Z.AI | Tak | Chmura |
| Atlas Cloud | Tak | Chmura |
| NanoGPT | Tak | Chmura |
| Block Entropy | Tak | Chmura |
| RunPod Serverless (ComfyUI) | Tak | Chmura |
| Pollinations | Nie | Darmowa chmura |
| Stable Horde | Opcjonalnie | Darmowa chmura |
| SD Web UI (AUTOMATIC1111 / Forge) | Nie | Lokalnie |
| ComfyUI | Nie | Lokalnie |
| Draw Things | Nie | Lokalnie |

## OpenAI (DALL-E)

Usługa w chmurze z domyślnym adresem `https://api.openai.com/v1` w polu **Base URL**. Wymaga klucza API z konta OpenAI. Udostępnia modele DALL-E oraz GPT Image. Przyjmuje do 16 obrazów referencyjnych.

## Stability AI

Usługa w chmurze z domyślnym adresem `https://api.stability.ai/v2beta` w polu **Base URL**. Wymaga klucza API do usługi Stability AI. Udostępnia modele Stable Diffusion oraz Stable Image.

## Together AI

Usługa w chmurze z domyślnym adresem `https://api.together.xyz/v1` w polu **Base URL**. Wymaga klucza API do usługi Together AI. Udostępnia modele FLUX i inne otwarte modele graficzne.

## NovelAI

Usługa w chmurze z domyślnym adresem `https://image.novelai.net` w polu **Base URL**. Wymaga klucza API do usługi NovelAI. Skupia się na grafice w stylu anime. Przy modelach V4, V4.5 i V5 Marinara Engine wysyła natywne prompty poszczególnych postaci wraz z ich pozycjami dla scen storyboardu i agenta Illustrator z wieloma postaciami. Część nowszych funkcji, na przykład precyzyjne obrazy referencyjne, działa wyłącznie na modelu V4.5.

## OpenRouter Images

Usługa w chmurze z domyślnym adresem `https://openrouter.ai/api/v1` w polu **Base URL**. Wymaga klucza API do usługi OpenRouter. Sięga po modele graficzne przez interfejs czatu OpenRouter, więc dostępne modele różnią się w zależności od konta.

## xAI / Grok Imagine

Usługa w chmurze z domyślnym adresem `https://api.x.ai/v1` w polu **Base URL**. Wymaga klucza API do usługi xAI. Obrazy generuje przy użyciu Grok Imagine.

## Venice.ai

Usługa w chmurze z domyślnym adresem `https://api.venice.ai/api/v1` w polu **Base URL**. Wymaga klucza API do usługi Venice. Kliknij przycisk **Fetch Models from API**, żeby wczytać modele graficzne dostępne na twoim koncie. Marinara korzysta z natywnego punktu końcowego Venice, wyłącza opcjonalne rozmycie trybu bezpiecznego i sama dopasowuje żądane wymiary do formatu wielkości używanego przez dany model: pikseli, proporcji albo poziomu rozdzielczości. Mimo to zasady po stronie dostawcy lub limity modelu nadal mogą odrzucić żądanie.

## Z.AI

Usługa w chmurze z domyślnym adresem `https://api.z.ai/api/paas/v4` w polu **Base URL**. Wymaga zwykłego klucza API do usługi Z.AI. Klucze z planu GLM Coding Plan oraz punkt końcowy `/api/coding/paas/v4` nie nadają się do generowania obrazów. Kliknij przycisk **Fetch Models from API**, żeby wybrać model **GLM-Image** albo **CogView 4**. Marinara dopasowuje żądane proporcje do rozmiaru obsługiwanego przez wybrany model, wysyła żądanie do natywnego punktu końcowego Z.AI i pobiera tymczasowy adres wyniku do pamięci lokalnej. Ta pierwsza wersja obsługuje tylko zamianę tekstu na obraz i nie wysyła obrazów referencyjnych.

## Atlas Cloud

Usługa w chmurze z domyślnym adresem `https://api.atlascloud.ai/api/v1` w polu **Base URL**. Wymaga klucza API do usługi Atlas Cloud. Marinara dostarcza mały katalog startowy dla modeli Nano Banana, Gemini Flash Image i FLUX 1.1 Pro, a poza tym można wpisać dokładny identyfikator innego modelu graficznego Atlas Cloud. Zadania działają asynchronicznie: Marinara rozpoczyna generowanie i odpytuje Atlas Cloud, dopóki obraz nie będzie gotowy. Typowe ustawienia zamiany tekstu na obraz są mapowane automatycznie. Obrazy referencyjne trafiają do modeli, których identyfikatory zapowiadają obsługę zamiany obrazu na obraz, edycji albo trybu Kontext. Schematy modeli Atlas bywają różne, więc przy innym identyfikatorze modelu zajrzyj do dokumentacji Atlas Cloud dla wybranego modelu.

## NanoGPT

Usługa w chmurze z domyślnym adresem `https://nano-gpt.com/api/v1` w polu **Base URL**. Wymaga klucza API do usługi NanoGPT. NanoGPT to agregator, więc listę modeli wczytaj przyciskiem **Fetch Models from API**.

## Block Entropy

Usługa w chmurze z domyślnym adresem `https://api.blockentropy.ai` w polu **Base URL**. Wymaga klucza API. Marinara nie ma dedykowanej obsługi dla Block Entropy, więc wysyła żądania w formacie zgodnym z OpenAI. Rzeczywista zgodność nie jest potwierdzona, dlatego przetestuj usługę przyciskiem **Test Image**, zanim zaczniesz na niej polegać.

## RunPod Serverless (ComfyUI)

Usługa w chmurze z domyślnym adresem `https://api.runpod.ai/v2` w polu **Base URL**. Uruchamia workflow ComfyUI na bezserwerowym punkcie końcowym RunPod. Potrzebuje trzech rzeczy: tokena API do usługi RunPod w polu **API Key**, wartości **RunPod Endpoint ID** oraz pliku JSON w polu **ComfyUI Workflow**. Zajrzyj do sekcji o workflow ComfyUI poniżej.

## Pollinations

Darmowa usługa w chmurze z domyślnym adresem `https://image.pollinations.ai` w polu **Base URL**. Nie wymaga konta ani klucza API. To najszybszy sposób, żeby wypróbować generowanie obrazów.

## Stable Horde

Darmowa usługa w chmurze z domyślnym adresem `https://stablehorde.net/api/v2` w polu **Base URL**. Działa jako sieć zasilana przez społeczność. Klucz API jest opcjonalny. Darmowy klucz daje wyższy priorytet w kolejce.

## SD Web UI (AUTOMATIC1111 / Forge)

Usługa lokalna z domyślnym adresem `http://localhost:7860` w polu **Base URL**. Rozmawia z programem Stable Diffusion Web UI działającym na twoim własnym komputerze. Ten program trzeba uruchomić z włączonym interfejsem programistycznym. Klucz API nie jest potrzebny.

## ComfyUI

Usługa lokalna z domyślnym adresem `http://127.0.0.1:8188` w polu **Base URL**. Rozmawia z serwerem ComfyUI działającym na twoim własnym komputerze. Obsługuje własny workflow, opisany niżej. Klucz API nie jest potrzebny.

## Draw Things

Usługa lokalna z domyślnym adresem `http://localhost:7860` w polu **Base URL**. Rozmawia z aplikacją Draw Things na systemie macOS lub iOS. Marinara traktuje ją jak serwer AUTOMATIC1111. Klucz API nie jest potrzebny.

## Usługi lokalne w twojej sieci

Słowo `localhost` (nazywane też pętlą zwrotną) oznacza ten sam komputer, na którym działa Marinara. Lokalne serwery obrazów na tym samym komputerze działają bez dodatkowej konfiguracji.

Jeśli serwer obrazów działa na innym komputerze w sieci domowej, w konfiguracji serwera trzeba zezwolić na adresy z sieci lokalnej. Sposób opisuje dokument [Konfiguracja serwera](../CONFIGURATION.md).

Bywa, że dostawca zwraca adres URL zamiast samych danych obrazu. Publiczne adresy sieci CDN Marinara pobiera przez zwykłe kontrole bezpieczeństwa ruchu wychodzącego. Adres wyniku z sieci prywatnej lub z pętli zwrotnej Marinara przyjmuje tylko wtedy, gdy protokół, nazwa hosta i port zgadzają się dokładnie z ustawionym dostawcą obrazów. Przekierowanie z takiego prywatnego pochodzenia nie może prowadzić do innej usługi lokalnej. Jeśli lokalne proxy trzyma wyniki pod innym prywatnym pochodzeniem, ustaw je tak, żeby udostępniało te pliki spod tego samego pochodzenia, co jego interfejs API do obrazów.

## Plik JSON z workflow ComfyUI a RunPod

Przy usługach **ComfyUI** oraz **RunPod Serverless (ComfyUI)** pojawia się pole **ComfyUI Workflow**. Wklej do niego plik JSON z workflow wyeksportowany z programu ComfyUI opcją **Save (API Format)**, **Export (API)** albo **Export to API**, zależnie od wersji interfejsu. Dla usługi **ComfyUI** pole jest oznaczone jako Optional, a dla **RunPod Serverless (ComfyUI)** jako Required.

Marinara uzupełnia workflow za pomocą znaczników zastępczych. Wstaw te znaczniki tekstowe w tych miejscach workflow, w których ma trafić wartość.

- `%prompt%` i `%negative_prompt%` dla promptów.
- `%width%`, `%height%` i `%seed%` dla rozmiaru obrazu oraz ziarna losowości.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` i `%denoise%` dla ustawień generowania.
- `%reference_image%` oraz `%reference_image_01%` do `%reference_image_04%` do wstawiania danych obrazów referencyjnych.
- `%reference_image_name%` oraz `%reference_image_name_01%` do `%reference_image_name_04%` do wgrania obrazów referencyjnych i wstawienia ich nazw plików dla lokalnego węzła LoadImage w programie ComfyUI.

Najważniejszy jest znacznik `%prompt%`. Edytor ostrzega, kiedy go brakuje. Przy usłudze **ComfyUI** puste pole oznacza użycie wbudowanego workflow domyślnego. Przy **RunPod Serverless (ComfyUI)** workflow jest wymagany, bo punkt końcowy nie ma żadnego domyślnego. Obie usługi przyjmują do 4 surowych obrazów referencyjnych w formacie base64, a znaczniki z nazwami wgranych plików działają wyłącznie przy lokalnym ComfyUI.

Pełny proces eksportu, przykłady plików JSON, zasady cudzysłowów wokół znaczników, przygotowanie obrazów referencyjnych, workflow dla konkretnych postaci, dostęp przez sieć LAN i rozwiązywanie problemów opisuje przewodnik [Konfiguracja workflow w ComfyUI](comfyui.md).

## Panel Local Image Defaults w połączeniu

Kiedy wybraną usługą jest **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI** albo **Draw Things**, w połączeniu pojawia się panel **Local Image Defaults** (domyślne ustawienia obrazów lokalnych). Przy usłudze **Draw Things** panel pokazuje te same pola i wartości domyślne co przy **SD Web UI (AUTOMATIC1111 / Forge)**. Te ustawienia działają tylko wtedy, gdy obraz generuje to konkretne połączenie. Przycisk **Reset** przywraca wartości wbudowane.

Każda z tych czterech usług pokazuje pole **Seed**. Wartość -1 sprawia, że każdy obraz jest losowy. Dowolna inna liczba oznacza użycie za każdym razem dokładnie tego samego ziarna losowości.

Pozostałe pola zależą od usługi.

| Usługa | Pole | Domyślnie |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Każda usługa ma też pola tekstowe **Prompt Prefix** oraz **Negative Prefix**. Wpisany tam tekst trafia na początek każdego promptu w tym połączeniu. AUTOMATIC1111 / Forge i ComfyUI mają dodatkowo pole **Clip Skip**. AUTOMATIC1111 / Forge dokłada przełącznik **Restore faces**. ComfyUI dokłada przełącznik **Upload a 1x1 placeholder when no reference image is provided**. Ma on znaczenie tylko przy własnych workflow ze znacznikami obrazów referencyjnych. NovelAI dokłada pola **Guidance Rescale** oraz **UC Preset**.

## Obsługa obrazów referencyjnych zależy od dostawcy

**Obraz referencyjny** to gotowy obrazek wysyłany razem z promptem. Pomaga on zachować w nowym obrazie twarz postaci albo styl graficzny. Dostawcy różnią się tym, ile takich obrazów przyjmują.

| Dostawca | Obrazy referencyjne |
| --- | --- |
| OpenAI (DALL-E) | Do 16 |
| NovelAI | Do 16, tylko model V4.5 |
| xAI / Grok Imagine | Do 3 |
| Venice.ai | Nieobsługiwane przy zamianie tekstu na obraz |
| Z.AI | Nieobsługiwane w obecnej integracji zamiany tekstu na obraz |
| Atlas Cloud | Pierwszy obraz, przy zgodnych identyfikatorach modeli do zamiany obrazu na obraz, edycji lub trybu Kontext |
| NanoGPT | Do 3 |
| Stability AI | Tylko pierwszy obraz, użyty do zamiany obrazu na obraz |
| OpenRouter Images | Obsługiwane, bez stałego limitu |
| ComfyUI i RunPod Serverless (ComfyUI) | Do 4, przez znaczniki w workflow |
| Together AI, Pollinations, Stable Horde | Nieobsługiwane |

Precyzyjne obrazy referencyjne w usłudze NovelAI działają wyłącznie na modelu V4.5, na przykład `nai-diffusion-4-5-full`. Usługa NovelAI nie udostępniła jeszcze funkcji Precise Reference dla V5. Przy żądaniu obrazów referencyjnych na innym modelu Marinara Engine generuje obraz bez nich i zapisuje ostrzeżenie w logu serwera.

## Kolejkowanie żądań generowania obrazów

Przełącznik **Queue image generation requests** (kolejkowanie żądań generowania obrazów) znajdziesz w **Settings** (Ustawienia), dalej **Generations**, dalej **Image Generation**. Domyślnie jest włączony.

Kiedy jest włączony, Marinara wysyła zadania graficzne pojedynczo. Zostaw go włączonego przy usługach, które odrzucają dwa żądania naraz. Wyłącz go tylko wtedy, gdy usługa obsługuje wiele żądań jednocześnie, a zależy ci na szybszym efekcie.

## Powiązane przewodniki

- [Konfiguracja workflow w ComfyUI](comfyui.md) krok po kroku wyjaśnia pliki JSON z workflow dla instalacji lokalnej i dla RunPod.
- [Agent Illustrator](illustrator-agent.md) opisuje konfigurację automatycznych ilustracji scen.
- [Profile stylu obrazów](style-profiles.md) kształtują wygląd każdego generowanego obrazu.
- [Tła scen i galeria](scene-backgrounds.md) opisuje generowane tła scen.
- [Selfie](../conversation/selfies.md) to komenda do zdjęć postaci w trybie Conversation.
- [Obsługiwani dostawcy AI](../connections/providers-reference.md) wymienia wszystkich dostawców czatu, obrazów i wideo.
