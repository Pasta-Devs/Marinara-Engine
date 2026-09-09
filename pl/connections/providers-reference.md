# Obsługiwani dostawcy AI

Ten przewodnik zbiera wszystkich dostawców AI, z którymi Marinara Engine potrafi się połączyć. Przy każdym znajdziesz miejsce, skąd wziąć klucz API, domyślny adres bazowy oraz ewentualne haczyki. Klucz API to tajny kod od dostawcy, trochę jak hasło, dzięki któremu Marinara może korzystać z jego usługi AI.

Ogólne kroki dodawania połączenia opisuje przewodnik [Łączenie z dostawcą AI](connecting-to-a-provider.md) – zajrzyj tam najpierw. Ta strona jest materiałem źródłowym, po którym wyszukuje się szczegóły dotyczące jednego konkretnego dostawcy.

## Jak czytać tę stronę

Dostawcę wybiera się przy tworzeniu połączenia w panelu **Connections** (Połączenia). Każdy dostawca ma swój przycisk **Provider** w oknie **Create Connection** (tworzenie połączenia), podpisany dokładnie tak, jak niżej.

Większość dostawców z tej strony to usługi chmurowe, które hostują AI za ciebie. Zakładasz konto u dostawcy, kopiujesz klucz API i wklejasz go w pole **API Key**. Trzej dostawcy subskrypcyjni zamiast klucza korzystają z lokalnego logowania. Ich sekcje wyraźnie o tym mówią.

Dwa pojęcia będą się powtarzać:

- Adres bazowy (Base URL): adres internetowy, pod który Marinara wysyła zapytania. Większość dostawców wypełnia go automatycznie. Zmieniasz go tylko przy serwerach lokalnych lub własnych.
- Model: konkretny model AI, który wybierasz po wskazaniu dostawcy. Dostępne modele często się zmieniają, więc ta strona ich nie wymienia. Aktualną listę pokaże lista rozwijana **Model** albo przycisk **Fetch Models from API** (pobranie modeli z API) w edytorze połączenia.

## OpenAI

- Skąd wziąć klucz: `https://platform.openai.com/api-keys`
- Domyślny adres bazowy: `https://api.openai.com/v1`

**OpenAI** udostępnia rodzinę modeli GPT. Po wklejeniu klucza wybierz model z listy rozwijanej albo kliknij przycisk **Fetch Models from API**, żeby wczytać aktualną listę. To połączenie obsługuje wyłącznie modele czatu. Obrazy z DALL-E robi się przez dostawcę **Image Generation** i jego usługę **OpenAI (DALL-E)**.

## Anthropic

- Skąd wziąć klucz: `https://console.anthropic.com/settings/keys`
- Domyślny adres bazowy: `https://api.anthropic.com/v1`

**Anthropic** udostępnia modele Claude. Obsługuje buforowanie promptu, które potrafi obniżyć koszt długich czatów. Włącza je przełącznik **Enable prompt caching** (włączenie buforowania promptu) w edytorze połączenia.

**Anthropic** nie oferuje embeddingów. Embedding to liczbowa reprezentacja tekstu, dzięki której Marinara przeszukuje lorebooki i pamięć. Do tych funkcji użyj osobnego połączenia embeddingowego (patrz sekcja o embeddingach niżej).

## Google Gemini

- Skąd wziąć klucz: `https://aistudio.google.com/apikey`
- Domyślny adres bazowy: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** udostępnia modele Gemini przez Google AI Studio. To prostsza z dwóch opcji od Google.

## Google Vertex AI

- Dokumentacja poświadczeń: `https://cloud.google.com/vertex-ai/docs/authentication`
- Domyślny adres bazowy: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** udostępnia modele Gemini przez projekt w Google Cloud. Wymaga więcej konfiguracji niż **Google Gemini**. Trzeba samodzielnie zmienić pole **Base URL** i zastąpić `YOUR_PROJECT_ID` prawdziwym identyfikatorem projektu. Popraw też region, jeśli nie jest to `us-central1`.

Pole **API Key** przyjmuje jeden z trzech rodzajów poświadczeń, a Marinara sama rozpoznaje, który został wklejony:

1. Klucz konta usługi w formacie JSON.
2. Token dostępu OAuth, na przykład z `gcloud auth print-access-token`.
3. Klucz API Vertex.

## Mistral

- Skąd wziąć klucz: `https://console.mistral.ai/api-keys`
- Domyślny adres bazowy: `https://api.mistral.ai/v1`

**Mistral** udostępnia rodzinę modeli Mistral. Poza kluczem API nic więcej konfigurować nie trzeba.

## Cohere

- Skąd wziąć klucz: `https://dashboard.cohere.com/api-keys`
- Domyślny adres bazowy: `https://api.cohere.ai/compatibility/v1`

**Cohere** domyślnie korzysta ze swojego punktu końcowego zgodnego z OpenAI. Po wklejeniu starszego adresu Cohere v2 Marinara sama przestawia go na punkt zgodnościowy. Zapytania nadal działają.

## OpenRouter

- Skąd wziąć klucz: `https://openrouter.ai/keys`
- Domyślny adres bazowy: `https://openrouter.ai/api/v1`

**OpenRouter** to agregator. Jeden klucz otwiera dostęp do wielu modeli od wielu firm. W edytorze połączenia dochodzą dwie dodatkowe opcje:

- **Preferred Provider** (preferowany dostawca): pole tekstowe, które zmusza usługę **OpenRouter** do kierowania zapytań na jedno wskazane zaplecze. Nazwa musi się zgadzać z tą ze strony modeli OpenRouter. Puste pole oznacza dobór automatyczny.
- **Enable prompt caching**: wysyła wskazówki o buforowaniu dla modeli Claude kierowanych przez usługę **OpenRouter**. Większość pozostałych modeli w **OpenRouter** buforuje samodzielnie i tego nie potrzebuje.

## NanoGPT

- Skąd wziąć klucz: `https://nano-gpt.com/api`
- Domyślny adres bazowy: `https://nano-gpt.com/api/v1`

**NanoGPT** to również agregator. Nie ma wbudowanej listy modeli, więc lista rozwijana **Model** startuje pusta. Po wklejeniu klucza kliknij przycisk **Fetch Models from API**, żeby wczytać modele dostępne dla twojego konta.

## xAI / Grok

- Skąd wziąć klucz: `https://console.x.ai`
- Domyślny adres bazowy: `https://api.x.ai/v1`

**xAI / Grok** udostępnia modele Grok. Po wybraniu tego dostawcy w oknie **Create Connection** Marinara od razu wpisuje model Grok 4.5. Model można potem zmienić.

## Z.AI

- Skąd wziąć klucz: `https://z.ai/manage-apikey/apikey-list`
- Domyślny adres bazowy: `https://api.z.ai/api/paas/v4`

**Z.AI** udostępnia modele GLM (GLM 5.3, GLM 5.3 Flash i starsze) przez własne API. Lista rozwijana **Model** zawiera aktualne modele GLM, a przycisk **Fetch Models from API** odświeża ją na podstawie twojego konta. Modele GLM 5.3 zawsze korzystają z rozumowania: ustawienie **Reasoning Effort** (poziom rozumowania) w presecie jest przeliczane na trzy poziomy obsługiwane przez usługę Z.AI: **Low** (niski), **High** (wysoki) i **Maximum** (maksymalny). Jeśli pozostawisz je nieustawione, usługa użyje swojego poziomu domyślnego, czyli **Maximum**. Domyślny adres bazowy prowadzi do punktu końcowego rozliczanego za zużycie. Plan Coding Plan w usłudze Z.AI korzysta z innego punktu końcowego, który zgodnie z zasadami dostawcy jest zarezerwowany dla narzędzi z jego listy, więc nie należy oczekiwać, że klucz tego planu zadziała tutaj.

## Claude (Subscription)

- Klucz API: brak. Zamiast tego logujesz się w lokalnym narzędziu.

**Claude (Subscription)** korzysta z twojego planu Anthropic Pro lub Max przez narzędzie Claude Code. Narzędzie działa na komputerze, na którym stoi serwer Marinara, i logujesz się w nim raz. Pola **API Key** oraz **Base URL** są przy tym dostawcy ukryte. Embeddingów nie oferuje (patrz sekcja o embeddingach niżej).

Instalację i logowanie opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md).

## OpenAI (ChatGPT)

- Klucz API: brak. Zamiast tego logujesz się w lokalnym narzędziu.

**OpenAI (ChatGPT)** korzysta z twojego konta ChatGPT przez narzędzie Codex. Narzędzie działa na komputerze, na którym stoi serwer Marinara, i logujesz się w nim raz. Pola **API Key** oraz **Base URL** są przy tym dostawcy ukryte. Embeddingów nie oferuje (patrz sekcja o embeddingach niżej).

Instalację i logowanie opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md).

## Grok CLI (Subscription)

- Klucz API: brak. Zamiast tego logujesz się w lokalnym narzędziu.

**Grok CLI (Subscription)** korzysta z twojego konta SuperGrok lub X Premium+ przez narzędzie Grok CLI. Narzędzie działa na komputerze, na którym stoi serwer Marinara, i logujesz się w nim raz. Pola **API Key** oraz **Base URL** są przy tym dostawcy ukryte. Embeddingów nie oferuje (patrz sekcja o embeddingach niżej).

Instalację i logowanie opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md).

## Custom (OAI-Compatible)

- Domyślny adres bazowy: brak. Trzeba go wpisać samodzielnie.

Wybierz opcję **Custom (OAI-Compatible)**, żeby podłączyć lokalny lub własny serwer modeli, taki jak Ollama, LM Studio czy KoboldCpp. Sprawdza się też przy dowolnym serwerze pośredniczącym, który mówi formatem czatu OpenAI. Pole **API Key** przy większości serwerów lokalnych może zostać puste. W polu **Base URL** wpisz adres swojego serwera.

Konfigurację krok po kroku i przełącznik **Treat as local/custom endpoint** (traktuj jako punkt końcowy lokalny lub własny) opisuje przewodnik [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md). O małym modelu dołączonym do aplikacji Marinara Engine przeczytasz w przewodniku [Konfiguracja modelu Local Model](local-model.md).

## Image Generation

**Image Generation** to dostawca szczególny. Po jego wybraniu wskazujesz jeszcze pozycję **Service**, czyli zaplecze, które faktycznie generuje obrazy. Każda usługa ma własny domyślny adres bazowy i własną zasadę co do tego, czy klucz API jest wymagany. Wśród usług są płatne API chmurowe, takie jak **OpenAI (DALL-E)**, **Stability AI**, **NovelAI** i **Z.AI**. Są też opcje darmowe: **Pollinations** i **Stable Horde**. Działają również serwery lokalne, na przykład **ComfyUI** oraz **SD Web UI (AUTOMATIC1111 / Forge)**.

Pełną listę usług graficznych, ich konfigurację i ustawienia generowania znajdziesz w przewodniku [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md).

## Video Generation

**Video Generation** to również dostawca szczególny, z własną listą **Video Service**. Game Mode używa go do tworzenia krótkich filmów MP4 ze scenami. Dostępne usługi to **Google AI Studio**, **xAI Imagine**, **OpenRouter Video** i **Seedance 2.0**. Każda z nich wymaga klucza API.

Pełną konfigurację i ograniczenia każdej usługi wideo opisuje przewodnik [Generowanie wideo scen](../media/scene-video.md).

## Embeddings

Embeddingi napędzają wyszukiwanie znaczeniowe w lorebookach oraz funkcję **Memory Recall**. Zamieniają tekst na listy liczb, dzięki czemu Marinara znajduje powiązane wpisy. Przy większości dostawców czatu w edytorze połączenia da się ustawić pole **Embedding Model** oraz opcjonalne **Embedding Endpoint URL**.

Część dostawców nie potrafi tworzyć embeddingów. Nie oferują ich **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** ani **Grok CLI (Subscription)**. W ich przypadku skorzystaj z listy rozwijanej **Embedding Connection**, żeby pożyczyć inne połączenie – na przykład zgodne z OpenAI, **Google Gemini** albo wbudowany **Local Model**.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo scen](../media/scene-video.md)
