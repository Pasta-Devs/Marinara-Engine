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

Na obu opcjach od Google Marinara wyłącza regulowane filtry bezpieczeństwa Google, z wyjątkiem kategorii, które ustawisz samodzielnie w polu **Custom Parameters** (parametry własne), ale podstawowe zabezpieczenia Google, takie jak ochrona dzieci, nadal obowiązują.

## Google Vertex AI

- Dokumentacja poświadczeń: `https://cloud.google.com/vertex-ai/docs/authentication`
- Domyślny adres bazowy: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** udostępnia modele Gemini przez projekt w Google Cloud. Wymaga więcej konfiguracji niż **Google Gemini**. Trzeba samodzielnie zmienić pole **Base URL** i zastąpić `YOUR_PROJECT_ID` prawdziwym identyfikatorem projektu. Popraw też region, jeśli nie jest to `us-central1`.

Pole **API Key** przyjmuje jeden z trzech rodzajów poświadczeń, a Marinara sama rozpoznaje, który został wklejony:

1. Klucz konta usługi w formacie JSON.
2. Token dostępu OAuth, na przykład z `gcloud auth print-access-token`.
3. Klucz API Vertex.

**Gemini 4 Argon** działa tylko w lokalizacjach `global`, `us` i `eu`, a nie w pojedynczym regionie, takim jak `us-central1`. Aby z niego korzystać, ustaw w polu **Base URL** adres `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Przy każdej innej lokalizacji Google zwraca błąd, a Marinara go pokazuje.

Odpowiedź modelu Argon może zająć kilka minut na każdym z dwóch połączeń Google. Jeśli odpowiedzi w czacie przekraczają limit czasu, zwiększ `CHAT_GENERATION_TIMEOUT_MS`. Jeśli wywołania agentów przekraczają limit czasu, zwiększ `AGENT_CALL_TIMEOUT_MS` (zobacz [Konfiguracja serwera](../CONFIGURATION.md)). Google zaleca co najmniej 15 minut, czyli `900000`.

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

Marinara odczytuje szczegółowy katalog modeli NanoGPT, więc lista rozwijana pokazuje, które modele obejmuje twoja subskrypcja i które zużywają większą część jej limitu:

- Model objęty subskrypcją ma etykietę z **mnożnikiem tokenów wejściowych**: zielone `1x` przy zwykłym zużyciu limitu lub wyższą wartość, np. `2x`, gdy każdy wysłany token zużywa tyle tokenów wejściowych z limitu. Model *nieobjęty* subskrypcją ma etykietę **Paid** (płatny), ponieważ jego użycie obciąża płatne saldo. Brak etykiety oznacza brak danych o subskrypcji dla tego modelu.

### Zużycie subskrypcji

Jeśli masz subskrypcję NanoGPT, połączenie może pokazywać jej bieżące zużycie:

1. Włącz **Show subscription usage** (pokaż zużycie subskrypcji) w edytorze połączenia i zapisz.
2. Opcjonalnie najpierw wklej **Management Token** (token zarządzania).

Widżet odczytuje punkt końcowy zużycia NanoGPT i pokazuje tygodniowy oraz dzienny limit tokenów wejściowych. Dostęp można uwierzytelnić na dwa sposoby:

- **Management Token** (zalecany): utwórz go pod adresem `https://nano-gpt.com/settings#management-api-tokens` z zakresem **Usage only** (tylko odczyt zużycia). Pozwala odczytywać limity, ale nie uruchamia modeli ani nie wydaje środków z salda, więc jest bezpieczniejszym wyborem do wyświetlania zużycia. Marinara zapisuje go w postaci zaszyfrowanej i wysyła tylko do punktu końcowego zarządzania NanoGPT.
- **Twój klucz API**: używany automatycznie, gdy nie zapisano tokenu zarządzania. To działa, ale odczyt zużycia korzysta wtedy z tych samych danych uwierzytelniających, które pozwalają wydawać środki z salda.

Pod każdym paskiem widżet podaje, ile zostało i kiedy okno się resetuje, na przykład `42M remaining · resets in 4d`.

Limit, którego NanoGPT nie może obecnie podać, jest oznaczony jako **nieznany**, a nie jako niewykorzystany. Nieaktywna subskrypcja jest wyraźnie oznaczona, zamiast pokazywać pełny dostępny limit. Przycisk odświeżania aktualizuje widżet na żądanie.

Ten sam wskaźnik znajduje się pod wskaźnikiem kontekstu w selektorze połączenia czatu oraz w ustawieniach **Connection** (połączenie), więc możesz śledzić zużycie bez opuszczania czatu. Dotyczy aktywnego połączenia: pojawia się tylko dla połączenia NanoGPT z włączonym **Show subscription usage** i nie pojawia się przy **Random**, które nie wskazuje jednego połączenia do odczytu. W selektorze wygląda podobnie do paska kontekstu powyżej i odczytuje się go tak samo: zużycie względem tygodniowego limitu, np. `8.9M / 60M tokens`, a obok wartości procentowej widać czas resetu.

## xAI / Grok

- Skąd wziąć klucz: `https://console.x.ai`
- Domyślny adres bazowy: `https://api.x.ai/v1`

**xAI / Grok** udostępnia modele Grok. Po wybraniu tego dostawcy w oknie **Create Connection** Marinara od razu wpisuje model Grok 4.5. Model można potem zmienić. Modele Grok 4.6 i 4.7 mają okno kontekstu wynoszące 500 000 tokenów i obsługują rozumowanie do poziomu **Maximum** (`xhigh`). Obsługują istniejące narzędzia czatu, w tym **Web Search** (wyszukiwanie w internecie), więc wyniki wyszukiwania mogą zostać wykorzystane w końcowej odpowiedzi.

## Arli AI

- Skąd wziąć klucz: `https://www.arliai.com/account`
- Domyślny adres bazowy: `https://api.arliai.com/v1`

**Arli AI** to hostowana usługa czatu. Nie ma wbudowanej listy modeli, więc lista rozwijana **Model** jest na początku pusta. Po wklejeniu klucza kliknij przycisk **Fetch Models from API**, żeby wczytać aktualne modele. Do obrazów z Arli AI użyj zamiast tego dostawcy **Image Generation** i jego usługi **Arli AI**.

## Z.AI

- Skąd wziąć klucz: `https://z.ai/manage-apikey/apikey-list`
- Domyślny adres bazowy: `https://api.z.ai/api/paas/v4`

**Z.AI** udostępnia modele GLM (GLM 5.3, GLM 5.3 Flash i starsze) przez własne API. Lista rozwijana **Model** zawiera aktualne modele GLM, a przycisk **Fetch Models from API** odświeża ją na podstawie twojego konta. Modele GLM 5.3 zawsze korzystają z rozumowania: ustawienie **Reasoning Effort** (poziom rozumowania) w presecie jest przeliczane na trzy poziomy obsługiwane przez usługę Z.AI: **Low** (niski), **High** (wysoki) i **Maximum** (maksymalny). Jeśli pozostawisz je nieustawione, usługa użyje swojego poziomu domyślnego, czyli **Maximum**. Domyślny adres bazowy prowadzi do punktu końcowego rozliczanego za zużycie. Plan Coding Plan w usłudze Z.AI korzysta z innego punktu końcowego, który zgodnie z zasadami dostawcy jest zarezerwowany dla narzędzi z jego listy, więc nie należy oczekiwać, że klucz tego planu zadziała tutaj.

## DeepSeek

- Skąd wziąć klucz: `https://platform.deepseek.com/api_keys`
- Domyślny adres bazowy: `https://api.deepseek.com/v1`

**DeepSeek** udostępnia własne modele czatu, `deepseek-flash` i `deepseek-v4-pro`. Po wklejeniu klucza lista rozwijana **Model** zawiera oba te modele, a przycisk **Fetch Models from API** odświeża ją na podstawie twojego konta.

Usługa DeepSeek domyślnie korzysta z myślenia. Ustawienie **Reasoning Effort** używa tu własnych poziomów usługi DeepSeek – **Low**, **High** i **Maximum** – a **Off** (wyłączone) wyłącza myślenie w danym zapytaniu. Poziomu **Medium** (średni) nie ma: zapytanie o średni poziom usługa DeepSeek obsługuje jak **High**, więc Marinara oferuje **High** zamiast drugiego przycisku, który robiłby to samo. Myślenie modelu widać w odpowiedzi, w zwykłym podglądzie myśli.

Część ustawień w panelu parametrów nie dotyczy usługi DeepSeek, więc panel je pomija, zamiast udawać, że działają. Należą do nich ustawienia **Verbosity** i **Top K** oraz kary za powtórzenia: usługa DeepSeek wycofała je i ignoruje. Parametry **Temperature** (losowość) i **Top P** tworzą parę – usługa DeepSeek używa naraz tylko jednego z nich, zależnie od tego, czy myśli – więc przy wyłączonym myśleniu widzisz **Temperature**, a przy włączonym **Top P**.

Połącz się z usługą DeepSeek tutaj, zamiast kierować dostawcę **OpenAI** na adres usługi DeepSeek. Dostawca **OpenAI** oczekuje własnych modeli OpenAI, więc przy modelu DeepSeek ukrywa opcje generowania i nie wysyła prawie żadnego z twoich ustawień.

## Claude (Subscription)

- Klucz API: brak. Zamiast tego logujesz się w lokalnym narzędziu.

**Claude (Subscription)** korzysta z twojego planu Anthropic Pro lub Max przez narzędzie Claude Code. Narzędzie działa na komputerze, na którym stoi serwer Marinara, i logujesz się w nim raz. Pola **API Key** oraz **Base URL** są przy tym dostawcy ukryte. Embeddingów nie oferuje (patrz sekcja o embeddingach niżej).

Instalację i logowanie opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md).

### Zużycie planu

To połączenie może pokazać, jaka część limitów twojego planu Claude została zużyta:

1. Włącz **Show subscription usage** (pokaż zużycie subskrypcji) w edytorze połączenia.
2. Zostaw zaznaczone **5-hour window** (okno 5-godzinne) i **Weekly window** (okno tygodniowe) albo odznacz to, którego nie chcesz widzieć.
3. Zapisz połączenie.

Każde okno ma pasek z procentem zużycia i czasem resetu, na przykład `58% · resets in 2h`. Te same paski pojawiają się pod wskaźnikiem kontekstu w selektorze połączeń czatu i w ustawieniach **Connection** czatu, gdy to połączenie jest aktywne. Nie pojawiają się przy **Random**, które nie wskazuje jednego połączenia do odczytu.

Warto wiedzieć:

- Paski liczą wszystko na twoim planie Claude, na przykład Claude Code i claude.ai, nie tylko Marinarę.
- Claude podaje procent dla każdego okna i nie podaje liczby tokenów, więc żadna nie jest pokazywana.
- Odczyt prosi narzędzie Claude Code na hoście Marinary o te same dane, które pokazuje jego polecenie `/usage`. Nie wysyła żadnej wiadomości do Claude i nie zużywa nic z twojego planu. Trwa sekundę lub dwie, a przycisk odświeżania czyta dane ponownie.
- Nazwa planu obok tytułu, na przykład **Pro**, to ta, którą Claude podaje dla zalogowanego konta.
- Claude Code oznacza te dane o użyciu jako eksperymentalne. Jeśli przyszła wersja je zmieni, paski pokażą błąd z przyciskiem ponowienia zamiast błędnej liczby.

## OpenAI (ChatGPT)

- Klucz API: brak. Zamiast tego logujesz się w lokalnym narzędziu.

**OpenAI (ChatGPT)** korzysta z twojego konta ChatGPT przez narzędzie Codex. Narzędzie działa na komputerze, na którym stoi serwer Marinara, i logujesz się w nim raz. Pola **API Key** oraz **Base URL** są przy tym dostawcy ukryte. Embeddingów nie oferuje (patrz sekcja o embeddingach niżej). Poziom myślenia tego dostawcy to ustawienie **Reasoning Effort** w parametrach połączenia albo czatu; dopóki nie wybierzesz konkretnego poziomu, Codex korzysta z własnego ustawienia domyślnego dla danego modelu.

Instalację i logowanie opisuje przewodnik [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md).

### Zużycie planu

To połączenie może pokazać, jaka część limitów Codex twojego planu ChatGPT została zużyta. Działa jak opisane wyżej połączenie Claude (Subscription): włącz **Show subscription usage**, zostaw zaznaczone **5-hour window** i **Weekly window** albo je odznacz, i zapisz. Paski pojawiają się w edytorze połączenia, w selektorze połączeń czatu i w ustawieniach **Connection** czatu.

Warto wiedzieć:

- Paski liczą całe użycie Codex na twoim planie ChatGPT, na przykład w Codex CLI, nie tylko Marinarę. Czaty na chatgpt.com mają własne limity i nie wchodzą do tych pasków.
- ChatGPT podaje procent dla każdego okna i nie podaje liczby tokenów, więc żadna nie jest pokazywana.
- Odczyt prosi ChatGPT o te same dane, które Codex CLI pokazuje jako swoje limity, używając logowania Codex na hoście Marinary. Nie wysyła żadnej wiadomości do modelu i nie zużywa nic z twojego planu.
- Plan z tylko jednym z dwóch okien pokazuje jeden pasek.

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

**Video Generation** to również dostawca szczególny, z własną listą **Video Service**. Marinara używa go do tworzenia krótkich filmów MP4 ze scenami. Dostępne usługi to **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **NanoGPT**, **Atlas Cloud**, **Seedance 2.0**, **ComfyUI** i **SwarmUI**. Usługi w chmurze wymagają klucza API. **ComfyUI** i **SwarmUI** działają na twoim własnym komputerze i zwykle go nie potrzebują.

Pełną konfigurację i ograniczenia każdej usługi wideo opisuje przewodnik [Generowanie wideo scen](../media/scene-video.md).

## Decision

- Domyślny adres bazowy: `https://api.typesafe.ai` dla źródła **TypeSafe**.

**Decision** to opcjonalny dostawca szczególny dla modelu, który odpowiada na pytania typu tak lub nie dotyczące twojego czatu. Może na przykład zdecydować, czy własny agent ma się uruchomić. Jego odpowiedzi kierują działaniem aplikacji Marinara Engine i nie trafiają do czatu. Po wybraniu tego dostawcy wskaż źródło: **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (własny punkt końcowy System One) lub **OpenAI-compatible chat model** (model czatu zgodny z OpenAI). Źródła hostowane wymagają klucza API.

Czym jest model decyzyjny, jak go wybrać i jak go w pełni skonfigurować, wyjaśnia przewodnik [Modele decyzyjne](decision-models.md).

## Audio

**Audio** to dostawca szczególny dla głosów i generowanego dźwięku. Po jego wybraniu wskaż **Audio Source** (źródło dźwięku):

- **ElevenLabs**: mowa, efekty dźwiękowe i muzyka.
- **OpenAI-compatible**: OpenAI albo dowolny serwer naśladujący format mowy od OpenAI.
- **PocketTTS**: darmowy serwer głosowy uruchamiany na własnym komputerze.
- **xAI Voice**: usługa głosowa xAI.

Każde źródło wpisuje domyślny adres bazowy i model. **Default Voice** (domyślny głos) to głos używany wtedy, gdy nie ustawiono nic bardziej szczegółowego, na przykład głosu dla konkretnej postaci. Żeby wybrać połączenie audio, którego Marinara używa domyślnie, otwórz panel **Connections**, rozwiń sekcję **Defaults** (ustawienia domyślne) i wybierz je w polu **Audio**.

Przy źródle **ElevenLabs** pojawiają się dwa dodatkowe przełączniki: **Game sound effects** (efekty dźwiękowe w grze) i **Game music** (muzyka w grze). Dzięki nim Game Mode tworzy przez to połączenie efekty dźwiękowe i muzykę. Zobacz [Generowane efekty dźwiękowe i muzyka](../game/game-assets.md#generated-sound-effects-and-music). Głosy i czytanie wiadomości na głos opisuje przewodnik [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md).

## Embeddings

Embeddingi napędzają wyszukiwanie znaczeniowe w lorebookach oraz funkcję **Memory Recall**. Zamieniają tekst na listy liczb, dzięki czemu Marinara znajduje powiązane wpisy. Przy większości dostawców czatu w edytorze połączenia da się ustawić pole **Embedding Model** oraz opcjonalne **Embedding Endpoint URL**.

Część dostawców nie potrafi tworzyć embeddingów. Nie oferują ich **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** ani **Grok CLI (Subscription)**. W ich przypadku skorzystaj z listy rozwijanej **Embedding Connection**, żeby pożyczyć inne połączenie – na przykład zgodne z OpenAI, **Google Gemini** albo wbudowany **Local Model**.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Dostawcy generowania obrazów i konfiguracja](../media/image-providers.md)
- [Generowanie wideo scen](../media/scene-video.md)
- [Modele decyzyjne](decision-models.md)
- [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md)
