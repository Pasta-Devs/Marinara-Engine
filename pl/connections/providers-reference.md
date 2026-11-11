# Obsługiwani dostawcy AI

Ta strona to materiał źródłowy o głównych usługach, z którymi Marinara Engine potrafi się połączyć: skąd wziąć klucz API, jaki jest domyślny adres i jakie są haczyki. Żeby dodać konto krok po kroku, przeczytaj najpierw przewodnik [Łączenie z dostawcą AI](connecting-to-a-provider.md).

Usługę wybiera się w oknie **Add account** (dodanie konta), w sekcji odpowiadającej temu, co robi: **Chat** (czat), **Images & video** (obrazy i wideo), **Voice** (głos) albo **Decisions** (decyzje). Kafelek ma nazwę podaną niżej. Adres to adres internetowy, pod który Marinara wysyła żądania. W edytorze konta nazywa się **Address** (adres), a w edytorze modelu **Base URL** (adres bazowy). Dla znanych usług Marinara wypełnia go sama. Zmieniaj go tylko przy serwerze proxy albo serwerze, który uruchamiasz.

Modele często się zmieniają, więc ta strona ich nie wymienia. Po połączeniu lista modeli wczytuje się w selektorze. Kliknij **Refresh model list** (odświeżenie listy modeli) w selektorze, żeby wczytać ją ponownie.

## Usługi czatu

Te usługi korzystają z klucza API, z wyjątkiem trzech usług subskrypcyjnych, które korzystają z logowania na twoim komputerze.

| Usługa | Skąd wziąć klucz |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication` (przewodnik po poświadczeniach) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | Brak strony z kluczami. Zobacz uwagi niżej. |

Domyślne adresy, które Marinara wpisuje za ciebie:

- LinkAPI: `https://linkapi.ai/v1` (bramka zgodna z OpenAI, z własnym kluczem)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI:
  `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatible i usługi subskrypcyjne: brak. Adres wpisujesz samodzielnie albo nie jest potrzebny.

Wszystkie strony z kluczami zaczynają się od `https://`.

Trzy usługi subskrypcyjne ukrywają pola **API key** (klucz API) i adresu. Nie oferują embeddingów. Kroki instalacji i logowania opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md), który omawia też zużycie planu.

Agregator to usługa, w której jeden klucz daje dostęp do modeli wielu firm. Agregatorami są OpenRouter i NanoGPT. Bramka to ten sam pomysł w wersji serwera proxy, który uruchamiasz samodzielnie albo wynajmujesz.

## Uwagi o usługach

### OpenAI

**OpenAI** udostępnia modele GPT. Do obrazów z DALL-E dodaj **OpenAI** i wybierz modele **Image** (obraz) na tym samym koncie. Dotyczy to także innych usług, które tworzą obrazy tym samym kluczem.

### Anthropic

**Anthropic** udostępnia modele Claude. Zapisywanie promptu w pamięci podręcznej (prompt caching) pozwala usłudze ponownie wykorzystać początek twojego promptu, co może obniżyć koszt długich czatów. Włącz je przełącznikiem **Enable prompt caching** (włączenie zapisywania promptu w pamięci podręcznej) w edytorze modelu. **Anthropic** nie oferuje embeddingów (zobacz [Embeddingi](#embeddings)).

### Google Gemini i Google Vertex AI

**Google Gemini** udostępnia modele Gemini przez Google AI Studio. To prostsza z opcji od Google. Na obu opcjach od Google Marinara wyłącza regulowane filtry bezpieczeństwa Google, z wyjątkiem kategorii, które ustawisz samodzielnie w polu **Custom Parameters** (parametry własne). Podstawowe zabezpieczenia Google, takie jak ochrona dzieci, nadal obowiązują.

**Google Vertex AI** udostępnia modele Gemini przez projekt w Google Cloud i wymaga więcej konfiguracji. Zmień adres i zastąp `YOUR_PROJECT_ID` identyfikatorem swojego projektu. Zmień też region, jeśli nie jest to `us-central1`. Pole **API key** przyjmuje dowolne z poniższych poświadczeń, a Marinara sama rozpoznaje, które zostało wklejone:

1. Klucz konta usługi w formacie JSON (plik od Google Cloud, który wskazuje konto usługi).
2. Token dostępu OAuth, na przykład z `gcloud auth print-access-token`.
3. Klucz API Vertex.

**Gemini 4 Argon** i **Gemini 4 Carbon** działają tylko w lokalizacjach `global`, `us` i `eu`, a nie w pojedynczym regionie, takim jak `us-central1`, według uwagi w kodzie aplikacji Marinara, która opiera się na dokumentacji Google. Żeby skorzystać z któregokolwiek z nich, ustaw adres `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Przy innej lokalizacji Google zwraca błąd, a Marinara go pokazuje.

### Cohere

**Cohere** korzysta ze swojego punktu końcowego zgodnego z OpenAI. Jeśli wkleisz starszy adres Cohere v2, Marinara sama przestawi go na punkt końcowy zgodności.

### OpenRouter

**OpenRouter** to agregator z dwiema dodatkowymi opcjami w edytorze modelu:

- **Preferred provider** (preferowany dostawca) wymusza kierowanie żądań do jednego wskazanego zaplecza. Nazwa musi zgadzać się z nazwą na stronie modeli OpenRouter. Zostaw pole puste, żeby dobór był automatyczny.
- **Enable prompt caching** wysyła wskazówki dotyczące pamięci podręcznej dla modeli Claude kierowanych przez usługę OpenRouter. Większość pozostałych modeli korzysta z pamięci podręcznej samodzielnie.

### NanoGPT

**NanoGPT** to agregator bez wbudowanej listy modeli. Po połączeniu selektor wczytuje modele dostępne dla twojego konta. Odczytuje szczegółowy katalog NanoGPT i oznacza, które modele obejmuje twoja subskrypcja:

| Plakietka | Znaczenie |
| --- | --- |
| Zielone `1x` | Objęty subskrypcją, przy zwykłym zużyciu limitu. |
| Wyższa wartość, na przykład `2x` | Objęty subskrypcją, ale każdy token wejściowy kosztuje tyle tokenów z twojego limitu. |
| **Paid** (płatny) | Nieobjęty subskrypcją. Użycie obciąża twoje płatne saldo. |
| Brak plakietki | Usługa NanoGPT nie miała dla niego danych o subskrypcji. |

#### Zużycie subskrypcji

Przy subskrypcji NanoGPT konto może pokazywać twój bieżący limit.

1. Kliknij **⋯** w wierszu konta, wybierz **Edit account** (edycja konta) i otwórz **Usage and balance** (zużycie i saldo).
2. Jeśli odczyty zewnętrzne są wyłączone, kliknij **Turn on** (włączenie). Żeby dodać klucz zarządzania, kliknij **Add a usage-only key** (dodanie klucza tylko do odczytu zużycia), wklej go i kliknij **Show usage** (pokazanie zużycia).
3. Włącz **Show the usage meter on the card** (pokazywanie wskaźnika zużycia na karcie) i zapisz.

Wskaźnik pokazuje tygodniowy i dzienny limit tokenów wejściowych, z informacją, ile zostało i kiedy każdy z nich się resetuje, na przykład `42M remaining · resets in 4d`. Limit, którego usługa NanoGPT nie potrafi podać, jest pokazywany jako nieznany, a nie jako niewykorzystany. Nieaktywna subskrypcja jest wyraźnie oznaczona, zamiast wyglądać na pełny limit. Przycisk odświeżania odczytuje dane ponownie.

Zużycie można odczytać za pomocą dwóch rodzajów danych uwierzytelniających:

- **Management key** (klucz zarządzania, zalecany). Utwórz go pod adresem `https://nano-gpt.com/settings#management-api-tokens` tylko do odczytu zużycia. Odczytuje limity, ale nie może uruchamiać modeli ani wydawać twojego salda. Marinara przechowuje go w postaci zaszyfrowanej i wysyła tylko do punktu końcowego zarządzania NanoGPT.
- **Twój klucz API**, używany, gdy nie zapisano klucza zarządzania. To działa, ale odczyt limitu korzysta wtedy z klucza, który może wydawać twoje saldo.

Ten sam wskaźnik pojawia się pod paskiem kontekstu w selektorze połączenia czatu i w ustawieniach **Connection** (połączenie) czatu. Pokazuje się tylko wtedy, gdy model czatu pochodzi z NanoGPT i ma włączony wskaźnik, i nie pojawia się przy **Shuffle** (losowanie).

### xAI / Grok

**xAI / Grok** udostępnia modele Grok. Grok 4.6 i 4.7 mają okno kontekstu wynoszące 500 000 tokenów i rozumowanie do poziomu **Extra high** (bardzo wysoki). Obsługują narzędzia czatu, w tym **Web Search** (wyszukiwanie w internecie), więc wyniki wyszukiwania mogą trafić do końcowej odpowiedzi.

### Arli AI

**Arli AI** to hostowana usługa czatu bez wbudowanej listy modeli. Po połączeniu selektor wczytuje jej modele. Do obrazów z Arli AI dodaj **Arli AI** i wybierz modele **Image** na tym samym koncie.

### Z.AI

**Z.AI** udostępnia modele GLM (GLM 5.3, GLM 5.3 Flash i starsze) przez własne API. Modele GLM 5.2 i 5.3 przyjmują poziom rozumowania **Maximum** (maksymalny). Domyślny adres prowadzi do punktu końcowego rozliczanego za zużycie. Plan Coding Plan w usłudze Z.AI korzysta z innego punktu końcowego, więc klucz tego planu może tu nie działać.

### DeepSeek

**DeepSeek** udostępnia modele `deepseek-flash` i `deepseek-v4-pro`. Usługa DeepSeek domyślnie korzysta z myślenia. Jej ustawienie **Reasoning Effort** (poziom rozumowania) używa własnych poziomów usługi DeepSeek, a **Off** (wyłączone) wyłącza myślenie w danym żądaniu. Żądanie o średni poziom usługa DeepSeek obsługuje jak High. Myślenie widać w odpowiedzi, w zwykłym podglądzie myśli.

Część parametrów nie ma zastosowania, więc panel je pomija: ustawienia **Verbosity**, **Top K** i kary za powtórzenia zostały wycofane i są ignorowane. Parametry **Temperature** (losowość) i **Top P** tworzą parę, bo usługa DeepSeek używa naraz tylko jednego z nich. **Temperature** widzisz przy wyłączonym myśleniu, a **Top P** przy włączonym.

Połącz się z usługą DeepSeek przez jej własny kafelek, a nie przez skierowanie **OpenAI** na adres usługi DeepSeek. Usługa OpenAI oczekuje modeli OpenAI, więc przy modelu DeepSeek ukrywa opcje generowania i nie wysyła prawie żadnego z twoich ustawień.

### OpenAI-compatible

**OpenAI-compatible** łączy serwer lub serwer proxy, który przyjmuje format żądań OpenAI, taki jak Ollama, LM Studio czy KoboldCpp. W oknie **Add account** ta opcja nazywa się **OpenAI-compatible address** (adres zgodny z OpenAI). Przy większości serwerów lokalnych klucz może zostać pusty. Adres wpisujesz samodzielnie. Zobacz [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md). Mały model, który Marinara uruchamia samodzielnie, opisuje przewodnik [Konfiguracja modelu wbudowanego](local-model.md).

## Obrazy i wideo

W sekcji **Images & video** każdy kafelek ma własny adres i własną zasadę co do tego, czy potrzebny jest klucz. Kafelki to Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0 oraz serwery lokalne: ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things i Block Entropy. Draw Things, ComfyUI, SwarmUI, SD Web UI i RunPod mają oznaczenie **Self-hosted** (samodzielnie hostowane).

Modele obrazów i wideo od OpenAI, OpenRouter, xAI, NanoGPT, Arli AI, Z.AI i Google pochodzą z twojego konta czatu w danej usłudze. Dodaj konto czatu, a potem wybierz na nim modele **Image** albo **Video** (wideo).

Zobacz [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md) oraz [Generowanie wideo sceny](../media/scene-video.md).

## Decision

W sekcji **Decisions** są kafelki **TypeSafe** (domyślny adres `https://api.typesafe.ai`), **Own decision server** (własny serwer decyzyjny) i **Built-in model (decisions)** (model wbudowany, decyzje). Usługi czatu korzystające z formatu czatu OpenAI też mogą obsługiwać decyzje, ale tylko z modelem, który zwraca logarytmy prawdopodobieństw (oceny każdej możliwej odpowiedzi). Model decyzyjny odpowiada na pytania typu tak lub nie dotyczące twojego czatu. Zobacz [Modele decyzyjne](decision-models.md).

## Audio

W sekcji **Voice** usługa audio odpowiada za głosy postaci i narrację. Wybierz **Audio source** (źródło dźwięku):

| Źródło | Co to jest |
| --- | --- |
| ElevenLabs | Głosy postaci i narracja. |
| OpenAI-compatible | OpenAI albo dowolny serwer naśladujący format mowy OpenAI. |
| PocketTTS | Darmowy serwer głosowy uruchamiany na własnym komputerze. |
| xAI Voice | Usługa głosowa xAI. |

Każde źródło wpisuje domyślny adres i model. **Default voice** (domyślny głos) to głos używany wtedy, gdy nie ustawiono nic bardziej szczegółowego, na przykład głosu dla konkretnej postaci. **Request timeout (seconds)** (limit czasu żądania w sekundach) to czas, przez jaki Marinara czeka na jedną wypowiadaną kwestię. Przy wolnym serwerze głosu zwiększ tę wartość.

Żeby wybrać konto mowy, którego Marinara używa domyślnie, kliknij wiersz **Voice (Text to Speech)** (głos, synteza mowy) w sekcji **Jobs** (zadania). Żeby czytać nim wiadomości na głos, wybierz je jako **Source** (źródło) w sekcji **Text to Speech** (synteza mowy). Zobacz [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md) i [Korzystanie z połączenia Audio](../media/tts-setup.md#use-an-audio-connection).

<a id="music--sound-effects"></a>

## Muzyka i efekty dźwiękowe

Ten typ konta generuje instrumentalną muzykę i efekty dźwiękowe, niezależnie od mowy. Okno **Add account** nie ma dla niego kafelka. Takie konta powstają przy aktualizacji (zobacz niżej) albo przez import. Edytujesz je przez **Edit model** (edycja modelu), gdzie wybierasz usługę i włączasz **Music generation** (generowanie muzyki), **Sound-effect generation** (generowanie efektów dźwiękowych) albo oba przełączniki. Konfiguracja gry w trybie Game Mode prosi o takie konto w polu **Music & Sound Effects account** (konto muzyki i efektów dźwiękowych), a jego domyślny wybór to **Use the default Music & Sound Effects account** (użycie domyślnego konta muzyki i efektów dźwiękowych).

Usługi:

- **ElevenLabs**: domyślny adres `https://api.elevenlabs.io`. Wymaga klucza ElevenLabs. Muzyka i efekty dźwiękowe mają osobne pola modeli.
- **SunoAPI**: domyślny adres `https://apibox.erweima.ai`. Wymaga klucza z serwisu [sunoapi.org](https://sunoapi.org/), a przy włączonej muzyce także publicznego adresu HTTPS w polu **SunoAPI music callback URL** (adres zwrotny muzyki SunoAPI). To własna usługa SunoAPI, a nie logowanie do subskrypcji Suno.
- **Custom compatible server** (własny zgodny serwer): adres twojego serwera. Wymaga jawnej ścieżki endpointu muzyki lub efektów dźwiękowych i obsługiwanego formatu żądania. Zobacz [kontrakty zgodnych serwerów audio](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server).

Uwagi:

- SunoAPI wymaga adresu zwrotnego, choć Marinara sama sprawdza, czy utwór jest gotowy. Adres podajesz ty. Marinara go nie tworzy.
- Prompty stylu muzyki mogą mieć do 1 000 znaków. Prompty efektów dźwiękowych mogą mieć do 500.
- Każde żądanie może kosztować u twojego dostawcy. Zobacz dokumentację [API muzyki](https://docs.sunoapi.org/suno-api/generate-music) i [API efektów dźwiękowych](https://docs.sunoapi.org/suno-api/generate-sounds). Efekty dźwiękowe SunoAPI nie zostały zweryfikowane z użyciem płatnego konta.

Podczas aktualizacji każde konto Audio z włączonym generowaniem zyskuje osobne konto Music & Sound Effects. Dawne samodzielne ustawienia ElevenLabs dla trybu Game Mode mogą utworzyć własne konto, więc może być ich więcej niż jedno. Konta mowy i przypisania głosów pozostają bez zmian, a zapisane identyfikatory kont Game się nie zmieniają. Generowanie działa tylko wtedy, gdy odpowiednie przeniesione konto jest dostępne i ma włączoną opcję muzyki lub efektów dźwiękowych. W przeciwnym razie wybierz inne odpowiednie konto. Usunięcie przeniesionego konta nie odtwarza go przy ponownym uruchomieniu. Endpointy odtworzone z profilu pozostają niedostępne, dopóki ich nie sprawdzisz i nie zapiszesz lokalnie.

Włącz generowany dźwięk osobno dla każdej gry albo włącz **Sound effects** (efekty dźwiękowe) w ustawieniach komend trybu Roleplay, żeby używać `[sound: description]`. Gacha Forge ma własne ustawienie generowania dźwięku. Wbudowane dźwięki Game pozostają dostępne przy wyłączonym generowaniu.

<a id="embeddings"></a>

## Embeddingi

Embeddingi zamieniają tekst na listy liczb, dzięki czemu Marinara może znajdować powiązany tekst. Napędzają wyszukiwanie semantyczne w lorebookach i funkcję Memory Recall. Większość usług czatu pozwala ustawić model embeddingów i opcjonalne pole **Embedding endpoint URL** (adres URL endpointu embeddingów) w sekcji **Semantic search (embeddings)** w edytorze modelu.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** i **Grok CLI (Subscription)** nie potrafią tworzyć embeddingów. W ich przypadku użyj listy rozwijanej **Embedding provider** (dostawca embeddingów), żeby pożyczyć inne konto, na przykład zgodne z OpenAI, **Google Gemini** albo **Built-in model** (model wbudowany).

Żeby używać jednego źródła embeddingów dla każdego konta bez własnych ustawień embeddingów, kliknij wiersz **Embeddings** (embeddingi) w sekcji **Jobs**. **Marinara's own search** (własne wyszukiwanie aplikacji Marinara) zachowuje wbudowany model embeddingów. Własny model embeddingów konta albo jego **Embedding provider** nadal ma pierwszeństwo. Po zmianie ponownie zwektoryzuj lorebooki i wspomnienia. Zobacz [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md).

## Limity czasu

Wolne modele mogą przekraczać limity czasu serwera dla odpowiedzi czatu i wywołań agentów. Ustawienia serwera dla tych limitów opisuje przewodnik [Konfiguracja serwera](../CONFIGURATION.md).

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo sceny](../media/scene-video.md)
- [Modele decyzyjne](decision-models.md)
- [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md)
