# Modele decyzyjne

Model decyzyjny to mały model, który odpowiada dla aplikacji Marinara Engine na krótkie pytania o twój czat, na przykład "Czy ostatnia wiadomość przenosi scenę w nowe miejsce?" albo "Jaki nastrój ma Kaelen: zły, smutny czy spokojny?". Niektóre potrafią też oglądać obrazy i klipy z czatu. Korzystają z niego lorebooki, własni agenci, prompty, czaty grupowe i agent Illustrator. Jest opcjonalny. Bez niego czaty nadal działają, a każda funkcja korzysta z zachowania zastępczego opisanego w sekcji [Gdzie Marinara go używa](#where-marinara-uses-it).

Jego odpowiedzi sterują działaniem aplikacji Marinara Engine i nigdy nie pojawiają się na czacie. Rodzaje pytań i przykłady znajdziesz w sekcji [Na co może odpowiedzieć model decyzyjny](#what-a-decision-model-can-answer).

Nasza rada: jeśli nie masz pewności, zostaw ustawienie **None** (brak). Jeśli chcesz korzystać z decyzji, użyj modelu wbudowanego, który być może już masz, albo modelu czatu na serwerze, który już uruchamiasz. Żadna z tych opcji nie kosztuje nic dodatkowo.

## Na co może odpowiedzieć model decyzyjny

Każda odpowiedź wraca jako liczba od 0 do 1: określa, jak pewny jest model. Marinara zamienia tę liczbę na odpowiedź potrzebną danej funkcji.

### Tak lub nie

Model czyta stwierdzenie i ocenia, na ile prawdopodobne jest, że jest ono prawdziwe. Marinara porównuje tę ocenę z [progiem](#thresholds): wynik równy progowi lub wyższy oznacza tak. To najczęstszy rodzaj, używany przez pytania aktywacyjne, pola **Decyzja** w lorebookach, `{{#if decision:"..."}}` i sprawdzanie przez agenta Illustrator.

| Stwierdzenie | Co może przełączać |
| --- | --- |
| `In the latest message, the characters move to a different location` | Tracker aktualizuje miejsce tylko w turach, w których się ono zmieniło. |
| `In the latest message, a dragon is physically present` | Wpis lorebooka o smokach dołącza do promptu. |
| `{{user}} asked a question that {{char}} has not answered yet` | Wiersz promptu przypomina modelowi, żeby na nie odpowiedział. |
| `The latest message describes a fight` | Agent walki uruchamia się tylko w tej turze. |

### Jedna z kilku odpowiedzi

Model wybiera najlepiej pasującą odpowiedź z krótkiej listy, którą napiszesz. Marinara pyta o każdą opcję i zachowuje tę z najwyższą oceną, więc dostajesz jedną odpowiedź, a nie kilka. Użyj `{{#if decision_choice:"..." == "..."}}`:

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

Inne listy, które dobrze się sprawdzają: rodzaj sceny (`combat`, `dialogue`, `exploration`, `rest`), pora dnia (`morning`, `afternoon`, `evening`, `night`) albo pomieszczenie w domu, w którym toczy się scena. Zadbaj, żeby opcje wyraźnie się różniły, i dodaj opcję taką jak `none of these`, jeśli żadna może nie pasować. Agenci używają tego samego mechanizmu do wybierania jednego z kilku zestawów instrukcji, a agent Illustrator do wybierania rodzaju pogody.

### Ocena

Niektóre funkcje używają samej liczby zamiast odpowiedzi tak lub nie. [Inteligentna kolejność odpowiedzi](../chats/group-chats.md#response-order-individual-only) ocenia prawdopodobieństwo, że każda postać zabierze głos jako następna, i wybiera najwyższą ocenę. [Advanced Memory](../agents/memory.md#optional-decision-model) ocenia istotność każdej wcześniejszej sceny. Opcja **Testuj decyzje** w podglądzie promptu pokazuje ocenę każdego stwierdzenia, co pomaga wybrać próg. Zobacz [Testowanie stwierdzeń decyzyjnych](../chats/peek-prompt.md#testing-decision-statements).

### Obrazy i klipy

Wbudowany model decyzyjny odczytujący obrazy może odpowiadać na te same rodzaje pytań o obrazy z czatu, na przykład `The picture shows the character at the beach`. Liquid d1, Valen i Winnow odczytują obrazy, a pełna wersja Valen odczytuje też krótkie klipy. Pozostałe modele oraz wszystkie konta usług hostowanych i serwerów odczytują tylko tekst i nigdy nie otrzymują obrazów.

Obrazy są wysyłane wyłącznie na twoje żądanie, bo każdy z nich spowalnia odpowiedź:

- W stwierdzeniu dodaj `pictures:1` (do 3) lub `clips:1`. Dodaj `media_within:2`, żeby pytać tylko wtedy, gdy jedna z 2 najnowszych wiadomości zawiera obraz. Zobacz [Obrazy i klipy](../prompts/conditional-prompts.md#pictures-and-clips).
- We wpisie lorebooka ustaw **Pokaż modelowi decyzyjnemu** pod polem **Decyzja**. Zobacz [Aktywacja decyzyjna](../lorebooks/entries.md#decision-activation).
- W pytaniu aktywacyjnym własnego agenta ustaw **Pokaż modelowi decyzyjnemu**. Zobacz [Pytania aktywacyjne](../agents/custom-agents.md#activation-questions).
- Własne funkcje obrazów aplikacji Marinara Engine: zobacz [Funkcje oglądające obrazy](#features-that-look-at-pictures).

### Co pokazuje strona modelu

Strona każdego wbudowanego modelu decyzyjnego pokazuje dwa wiersze:

- **Odpowiedzi** wymienia rodzaje odpowiedzi, do których model został stworzony: **Tak/nie**, **Wybór ważony**, **Ocena na skali**, a dla niektórych także **Ramki na obrazie** (gdzie coś znajduje się na obrazie). Marinara zadaje pytania tak lub nie oraz pytania z wyborem i odczytuje ich oceny. Nie pyta jeszcze o ramki, więc ten wiersz tylko opisuje model.
- **Odczytuje** wymienia **Tekst**, **Obrazy** i **Wideo**. Rodzaj odczytywany tylko przez inną wersję modelu jest wymieniany po pozostałych, na przykład "Wideo w pełnej wersji".

## Wybór modelu decyzyjnego

Zanim zaczniesz, przeczytaj sekcję [Co wybrać](#which-one-to-pick).

1. Kliknij **Connections** (Połączenia) na górnym pasku i otwórz sekcję **Jobs** (zadania).
2. W grupie **Behind the scenes** (za kulisami) kliknij wiersz **Decision** (decyzje). Otworzy się lista.
3. Wybierz model. Lista ma trzy grupy:
   - **None (decisions off)** (brak, decyzje wyłączone) to ustawienie domyślne. Żadne pytania nie są wysyłane, a pola pytań aktywacyjnych w edytorze agenta pozostają wyłączone.
   - **Built-in model** (model wbudowany) wymienia modele, które Marinara uruchamia na twoim komputerze: **Built-in model**, **Built-in model (utility)** (model wbudowany, pomocniczy) i **Built-in model (decisions)** (model wbudowany, decyzje). Nic nie opuszcza twojego komputera.
   - **Connections** wymienia twoje konta, które mogą odpowiadać na pytania decyzyjne: hostowane albo z modelem czatu na serwerze, który już uruchamiasz.

   Kliknij konto po lewej, żeby przejrzeć jego modele. Konta NanoGPT, OpenRouter i Google Gemini pokazują najpierw własne modele decyzyjne pod **Decision models** (modele decyzyjne), a poniżej modele czatu pod **Chat models** (modele czatu). Konto Google Gemini pokazuje tylko modele decyzyjne, ponieważ jego modele czatu nie odpowiadają na pytania decyzyjne. Wcześniej wybrany model decyzyjny pojawia się nad sekcją **Starred** (oznaczone gwiazdką), z nazwą konta pod spodem.
4. Żeby przetestować model, kliknij ikonę zębatki **Decision settings** (ustawienia decyzji) w wierszu, a potem **Test** (test). Ten przycisk pojawia się przy pozycjach modelu wbudowanego. Przy modelu decyzyjnym TypeSafe, OpenRouter, NanoGPT lub Google Gemini otwórz **Edit model** (edycja modelu) i kliknij **Test provider** (test dostawcy). Przy koncie **Own decision server** (własny serwer decyzyjny) użyj opcji **Test** w menu **⋯** konta.

Udany test pokazuje prawdopodobieństwo odpowiedzi tak i czas odpowiedzi. Przy modelu na twoim komputerze podaje też, czy dostępne były logarytmy prawdopodobieństw i czy model odpowiada bezpośrednio. Logarytmy prawdopodobieństw to liczby, którymi model wyraża pewność co do każdego słowa, jakie mógłby napisać. Test wysyła stały przykład, a nie twój czat.

Jeśli test się nie uda, komunikat podaje przyczynę. Częste przyczyny: odrzucony klucz, ograniczanie liczby żądań przez usługę, nieuruchomiony model wbudowany albo odpowiedź po przekroczeniu limitu czasu. Zobacz [Rozwiązywanie problemów](#troubleshooting).

Pozycje, które nie mogą teraz odpowiadać, pozostają na liście, wyszarzone, wraz z przyczyną. Wybór **None** wyłącza decyzje bez usuwania pytań aktywacyjnych ani stwierdzeń decyzyjnych.

<a id="which-one-to-pick"></a>

### Co wybrać

- **Model, który już działa w ramach modelu wbudowanego.** Bez dodatkowych kosztów. Najlepszy wybór dla większości osób korzystających z modelu wbudowanego.
- **Model czatu na własnym serwerze** (Ollama, LM Studio, llama.cpp lub inny serwer zgodny z OpenAI). Bez dodatkowych kosztów. Dobry wybór, gdy model działa poza aplikacją Marinara, bo nie jest ładowany dwa razy.
- **Hostowany model decyzyjny** (TypeSafe, OpenRouter, NanoGPT lub Google Gemini). Opłata jest naliczana za każde żądanie, a jedna tura może wysłać ich kilka. Subskrypcja NanoGPT obejmuje niektóre modele decyzyjne, a OpenRouter oferuje też modele bezpłatne. Dobry wybór dla telefonów i komputerów bez lokalnego modelu.
- **Wbudowany model decyzyjny.** Model przeznaczony specjalnie do decyzji, który Marinara pobiera i uruchamia obok twojego modelu czatu, z własnym miejscem na dysku i w pamięci. Większość działa na niemal każdym komputerze, niektóre na samym procesorze. To jedyna opcja, która może oglądać obrazy i klipy. Zobacz [Pozwól aplikacji Marinara Engine zainstalować model decyzyjny](#let-marinara-install-a-decision-model).

Jeśli masz już uruchomiony model lokalny, wypróbuj najpierw jego i testuj tury z własnych czatów. Sformułowania mają duże znaczenie. Zobacz [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

Jev i Open-Jev to różne modele. Jev to hostowany model firmy TypeSafe, dostępny bezpośrednio lub przez usługę OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) to osobno opublikowany model oparty na Qwen, który Marinara może uruchomić lokalnie. Testy Open-Jev nie mierzą hostowanego modelu Jev.

W systemie Android (środowisko Termux) jako **Wbudowany model decyzyjny** dostępne są tylko JevK5 i Liquid d1, a procesor telefonu może być dla nich zbyt wolny. Praktycznym wyborem jest konto usługi hostowanej, na przykład Jev przez OpenRouter. Zobacz [Konfiguracja konta Decision](#set-up-a-decision-account).

Pisz presety, karty i agentów dla "modelu decyzyjnego", nigdy jako "wymaga Jev". Stwierdzenie proszące o obrazy nadal działa z modelem odczytującym tylko tekst: dostaje on sam tekst. Składnia stwierdzeń jest taka sama dla każdego modelu, ale modele mogą dawać różne odpowiedzi. Gdy importujesz treści korzystające z decyzji, w tym własnych agentów i instalacje z Agent Organizer, Marinara pokazuje informację z linkiem tutaj. Przywrócenie całego profilu z pliku ZIP jej nie pokazuje.

## Używanie modelu wbudowanego

Jeśli masz pobrany model wbudowany, możesz używać go do decyzji bez konta i bez kosztów. Zobacz [Konfiguracja modelu wbudowanego](local-model.md).

1. Kliknij wiersz **Decision** w grupie **Behind the scenes** w sekcji **Jobs**.
2. Wybierz **Built-in model** (albo **Built-in model (utility)**, jeśli go masz).
3. Kliknij zębatkę **Decision settings**, a potem **Test**.

Marinara zadaje modelowi jedno pytanie tak/nie, pozwala mu napisać jeden token i odczytuje odpowiedź z prawdopodobieństw tego tokenu. Żadna odpowiedź czatu nie powstaje, więc żądanie jest krótkie. Wybór spośród kilku odpowiedzi jest zadawany jako osobne pytanie tak/nie dla każdej z nich.

Ustawienie **Thinking** (rozumowanie) określa, co się dzieje, gdy model nie potrafi odpowiedzieć jednym słowem. Niektóre modele zawsze najpierw rozumują.

| Thinking | Działanie |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** (automatycznie: próba jednym słowem, rozumowanie, gdy model tak nie potrafi) | Ustawienie domyślne. Po dwóch nieudanych odpowiedziach jednym słowem z rzędu model może najpierw rozumować, a Marinara cię o tym informuje. |
| **Off (always answer in one word)** (wyłączone: zawsze odpowiedź jednym słowem) | Model, który nie potrafi odpowiedzieć jednym słowem, nie daje odpowiedzi. |
| **Allowed (let the model think first)** (dozwolone: model może najpierw rozumować) | Nigdy nie prosi modelu o pominięcie rozumowania. |

Model, który najpierw rozumuje, potrzebuje kilku sekund, więc domyślnie odpowiada tylko na potrzeby sprawdzeń wykonywanych po wyświetleniu odpowiedzi, na przykład agentów przetwarzania końcowego. Żeby decydował też o agentach działających przed odpowiedzią, włącz **Also gate agents that run before the reply** (sprawdzaj także agentów działających przed odpowiedzią). Każda odpowiedź czeka wtedy na niego.

Prawdopodobieństwa tak/nie ogólnego modelu czatu nadają się do porównania z progiem, ale model nie był uczony ich kalibracji tak jak wyspecjalizowany model decyzyjny. Środowisko, które nie zwraca logarytmów prawdopodobieństw, odpowiada po prostu 1 albo 0. Dostosuj progi na podstawie własnych czatów.

<a id="on-a-server-you-already-run"></a>

### Na już działającym serwerze

Jeśli twój model czatu działa na serwerze Ollama, LM Studio, llama.cpp albo innym serwerze zgodnym z OpenAI, może odpowiadać na pytania decyzyjne bez ładowania drugiej kopii przez aplikację Marinara.

1. Kliknij wiersz **Decision** w grupie **Behind the scenes** w sekcji **Jobs**. Selektor pokazuje modele ze wszystkich kont, w tym twój model czatu. Możesz też kliknąć **⋯** przy modelu i wybrać **Use for…** → **Decision**.
2. Kliknij koło zębate w wierszu **Decision**, a potem **Test**. Udany test podaje, czy serwer zwrócił logarytmy prawdopodobieństw i czy model musiał najpierw rozumować. Kliknij **Done**.
Możesz też utworzyć je samodzielnie. Użyj konta Decision ze źródłem **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (model czatu zgodny z OpenAI), tym samym adresem co konto czatu (na przykład `http://localhost:11434/v1` dla serwera Ollama) i nazwą modelu, której używa serwer.

Odpytywanie wygląda tak samo jak przy modelu wbudowanym: jedno słowo tak/nie na stwierdzenie. Stwierdzenia są wysyłane pojedynczo, bo Marinara nie może wiedzieć, ile żądań naraz obsługuje twój serwer. **Thinking** dla konta to zawsze **Auto** (automatycznie). Serwer na innym komputerze wymaga `PROVIDER_LOCAL_URLS_ENABLED`. Zobacz [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

<a id="set-up-a-decision-account"></a>

## Konfiguracja konta Decision

Hostowane konto Decision wysyła wybrane ostatnie wiadomości i stwierdzenia do usługi i może generować koszty. Smart response order wysyła też [listę postaci](#what-the-model-sees).

1. Kliknij **Connections** na górnym pasku, a potem **Add** (dodaj).
2. W filtrach typu kliknij **Decision**, a potem wybierz **TypeSafe** lub **Own decision server**. W przypadku NanoGPT zobacz [Przez usługę NanoGPT](#through-nanogpt). W przypadku OpenRouter lub Google Gemini zobacz [Przez usługę OpenRouter lub Google Gemini](#through-openrouter-or-google-gemini).
3. Wpisz **API key** (klucz API), a przy **Own decision server** – **Server address** (adres serwera). Kliknij **Connect** (połącz).
4. Pod **Found in TypeSafe — use it for:** zaznacz **Decision**, a potem kliknij **Done**. Wiersz **Decision** w grupie **Behind the scenes** w sekcji **Jobs** pokazuje teraz model.
5. Żeby go przetestować, kliknij model w panelu, żeby otworzyć **Edit model**, a potem kliknij **Test provider** w sekcji **Provider tests** (testy dostawcy). Model **Own decision server** nie ma tam przycisku **Test provider**. Zamiast tego otwórz menu **⋯** konta w panelu i kliknij **Test**.

Udany **Test provider** pokazuje prawdopodobieństwo, czas odpowiedzi i limit czasu konta. **Test** konta w menu **⋯** podaje tylko, czy się udało i ile to trwało. Test czeka co najmniej 10 sekund, a przy dłuższym limicie 5 sekund ponad niego. Jeśli odpowiedź przekroczyła limit, wynik to zaznacza: na czacie taka odpowiedź liczyłaby się jako brak odpowiedzi.

Jeśli test się nie uda, zobacz [Rozwiązywanie problemów](#troubleshooting).

Model decyzyjny ma poniższe pola. Kliknij model w panelu, aby otworzyć **Edit model**, lub kliknij koło zębate przy **Decision** w sekcji **Jobs**, aby otworzyć **Decision settings** aktywnego modelu.

| Pole | Działanie |
| --- | --- |
| **Decision source** (źródło decyzji) | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint** (własny punkt końcowy System One) albo **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Zostaje na stałe ustalone przy tworzeniu modelu. |
| **API key source** (źródło klucza API) | **Enter a separate key (optional for local servers)** (wpisanie osobnego klucza, opcjonalne dla serwerów lokalnych) albo **Use key from …** (użycie klucza z innego konta). Powiązane klucze uwzględniają późniejsze zmiany klucza. Własny model System One lub zgodny z OpenAI może pożyczyć klucz własnego konta czatu tylko wtedy, gdy oba adresy mają ten sam schemat, host i port. |
| **Recent-message token budget** (limit tokenów ostatnich wiadomości) | Ile szacowanych tokenów czatu wysłać. Od 1 do 30 000. Domyślnie 30 000 dla TypeSafe, OpenRouter, NanoGPT i Google Gemini oraz 3 500 dla własnych serwerów. Model decyzyjny z konta NanoGPT, OpenRouter lub Google Gemini, który ma mniejszy limit danych wejściowych, dostaje trzy czwarte swojego limitu. Marinara najpierw odrzuca starsze wiadomości, potem przycina najstarszą część najnowszej wiadomości. Odrzucone żądanie lub żądanie przekraczające limit nie daje odpowiedzi. |
| **Time limit (seconds)** (limit czasu w sekundach) | Jak długo czekać na każde stwierdzenie podczas czatu. Od 0,5 do 30. Domyślnie 1,5 sekundy, a dla NanoGPT i modeli czatu zgodnych z OpenAI 4 sekundy. Zobacz [Limity czasu](#time-limits). |
| **Custom Request Headers** (własne nagłówki żądania) | Dodatkowe nagłówki wysyłane z każdym żądaniem decyzyjnym jako obiekt JSON, np. `{"x-billing-mode": "paygo"}`. Nagłówki uwierzytelniania są odrzucane, więc nie wpisuj tu kluczy. |

TypeSafe wysyła żądania do `https://api.typesafe.ai`. Jego pole **Base URL** (adres bazowy) możesz zastąpić adresem innego serwera, który udostępnia API firmy TypeSafe, bez `/v1/systemone`. Nadal potrzebny jest twój klucz TypeSafe, który trafia do tego serwera. **Custom System One endpoint** przyjmuje uruchomiony przez ciebie serwer System One, na przykład Open-Jev albo [Strands decider](#run-strands-decider-yourself). Wpisz jego adres bez `/v1/systemone`. Serwer modeli czatu, taki jak Ollama, nie obsługuje System One. Użyj dla niego **OpenAI-compatible chat model**.

<a id="through-nanogpt"></a>

### Przez usługę NanoGPT

NanoGPT udostępnia własne modele decyzyjne, takie jak Jev Latest, i odpowiada na pytania przez własne API Decisions z użyciem twojego klucza NanoGPT. Część modeli obejmuje subskrypcja, a pozostałe obciążają saldo.

1. Połącz usługę NanoGPT jak zwykle. W **Add** znajdziesz ją też pod filtrem typu **Decision**.
2. Pod **Found in NanoGPT — use it for:** (znaleziono w NanoGPT – użyj do) zaznacz **Decision**. Marinara wybierze model decyzyjny z twojego planu, dając pierwszeństwo Jev Latest.
3. Żeby wybrać inny model, kliknij **⋯** przy koncie NanoGPT, następnie **Add model** (dodaj model) i zakładkę **Decision**. Zawiera ona tylko modele decyzyjne. Plakietka **Plan** oznacza modele objęte subskrypcją. Wybierz model i kliknij **Test decision**.

Modele decyzyjne nie pojawiają się na listach modeli czatu, ponieważ nie prowadzą rozmów.

Domyślnie NanoGPT rozstrzyga, czy żądanie rozliczyć w ramach subskrypcji, czy z salda. Żeby zawsze używać salda, otwórz **Edit model** przy modelu decyzyjnym i wpisz `{"x-billing-mode": "paygo"}` w polu **Custom Request Headers**.

<a id="through-openrouter-or-google-gemini"></a>

### Przez usługę OpenRouter lub Google Gemini

Konta OpenRouter i Google Gemini także pokazują własne modele decyzyjne. Marinara odpytuje API decyzyjne usługi kluczem danego konta. OpenRouter udostępnia wiele modeli, w tym bezpłatne (ich nazwy kończą się na `:free`). Google Gemini udostępnia jeden model, **Gemini Decision 1**.

1. Połącz usługę OpenRouter lub Google Gemini jak zwykle.
2. Kliknij wiersz **Decision** w grupie **Behind the scenes** w sekcji **Jobs**, a potem kliknij konto po lewej. Wybierz model w sekcji **Decision models**.
3. Żeby go przetestować, otwórz **Edit model** i kliknij **Test provider**.

Na koncie OpenRouter pod **Chat models** znajdziesz także działające modele czatu, które zwracają logarytmy prawdopodobieństw. Konto Google Gemini udostępnia wyłącznie model decyzyjny.

Konto dodane przed tą wersją może początkowo nie pokazywać sekcji **Decision models**, jeśli zapisano listę, zanim pojawiły się te modele. Kliknij przycisk odświeżania w oknie wyboru lub poczekaj na automatyczne odświeżenie. Marinara odświeża zapisane listy modeli raz dziennie.

Osobne konto decyzyjne **OpenRouter** utworzone w **Add** nadal działa. Odpytuje to samo API za pomocą własnego klucza.

Niektóre usługi hostowane czasem odpowiadają wolniej niż w 1,5 sekundy, przez co decyzje wyglądają na losowo zepsute. Przetestuj kilka razy i ustaw limit powyżej najwolniejszej odpowiedzi. Stwierdzenia sprawdzane przed odpowiedzią, takie jak decyzje presetu albo pytanie aktywacyjne agenta działającego przed odpowiedzią, mogą wstrzymać odpowiedź każde nawet na cały ten czas.

Usunięcie konta, którego klucz służy do decyzji, pokazuje ostrzeżenie. Konto Decision trzeba wtedy ponownie powiązać, a do tego czasu decyzje nie dają odpowiedzi. Importowane pliki połączeń nigdy nie zawierają kluczy API ani powiązań z kontami, od których pożyczono klucz, więc odtwórz je ręcznie.

<a id="where-marinara-uses-it"></a>

## Gdzie Marinara go używa

- [Pytania aktywacyjne](../agents/custom-agents.md#activation-questions) decydują, czy niestandardowy agent się uruchomi. Bez odpowiedzi: pytanie go nie zatrzymuje. Nadal obowiązują słowa kluczowe i **Trigger Cadence** (częstotliwość uruchamiania).
- [Stwierdzenia w promptach](../prompts/conditional-prompts.md#asking-the-decision-model) wybierają tekst podczas budowania promptu czatu lub agenta. Bez odpowiedzi: decyzja oznacza nie, więc blok decyzyjny używa swojej gałęzi `{{else}}`, jeśli ją ma.
- [Pola Decision w lorebooku](../lorebooks/entries.md#decision-activation) sprawdzają Require lub Trigger podczas skanowania lorebooka. Bez odpowiedzi: Require nie może dopuścić nowego wpisu, a Trigger nie dodaje drogi aktywacji. Nadal obowiązują okresy Sticky i zwykłe drogi aktywacji Trigger.
- [Smart response order](../chats/group-chats.md#response-order-individual-only) ocenia, kto mówi następny w czacie grupowym, jeśli ta opcja jest włączona. Bez odpowiedzi: kolejność Smart wykonuje zwykłe wywołanie AI.
- [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only) przed każdą odpowiedzią w grupie Merged w trybie Roleplay pyta, kto jest w scenie, jeśli ustawiono **Decision model** (model decyzyjny). Bez odpowiedzi: jeśli żadna postać nie dostanie odpowiedzi, funkcja używa ostatniej sceny agenta Character Tracker albo zostawia listę bez zmian.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) może używać własnego modelu decyzyjnego do wykrywania granic scen i wybierania wspomnień w trybie Roleplay. Włącz **Use Decision model** (używaj modelu decyzyjnego) w ustawieniach Advanced Memory tego czatu. Bez odpowiedzi: nieudane decyzje przechodzą na zwykłe przywoływanie lub sprawdzenia scen. Podsumowania nadal pisze model pomocniczy.

- [Funkcje oglądające obrazy](#features-that-look-at-pictures) po włączeniu sprawdzają nowe obrazy, pomijają powtórki, ponownie wykorzystują tła i oznaczają twarze sprite'ów. Wymagają modelu decyzyjnego odczytującego obrazy.

Pytanie aktywacyjne decyduje, czy agent się uruchomi. Stwierdzenie decyzyjne w jego prompcie decyduje, jakie instrukcje dostanie uruchomiony agent. Używaj `{{#if decision:"..."}}` do warunków tak/nie i `{{#if decision_choice:"..." == "..."}}` do wyboru spośród odpowiedzi.

### Funkcje oglądające obrazy

Wymagają wbudowanego modelu decyzyjnego odczytującego obrazy (Liquid d1, Valen lub Winnow). Wszystkie pozostają wyłączone, dopóki ich nie włączysz. Bez takiego modelu są wyszarzone, a ⓘ wyjaśnia dlaczego. Wcześniej włączoną opcję nadal można wyłączyć.

| Funkcja | Gdzie | Co robi |
| --- | --- | --- |
| **Sprawdzanie obrazów** | **Ustawienia czatu → Agenci → Illustrator** | Ogląda każdy nowy obraz i selfie agenta Illustrator oraz sprawdza, czy przedstawia to, o co proszono. Selfie jest też porównywane z awatarem postaci. **Utwórz kolejny, jeśli nie pasuje** rysuje jeszcze raz po nietrafionym wyniku. **Zawsze twórz dwa i zachowuj lepszy** rysuje dwa obrazy i zachowuje ten, który lepiej pasuje. Każdy dodatkowy obraz kosztuje kolejne generowanie obrazu. |
| **Sprawdź też** | W sekcji **Sprawdzanie obrazów** | Własne warunki, po jednym w wierszu, najwyżej 6, na przykład `Kaelen has short red hair`. Zacznij wiersz od `not:`, jeśli opisujesz coś, czego obraz nie powinien przedstawiać, na przykład `not: The picture has writing or a watermark`. |
| **Pomiń obraz, jeśli najnowszy już to przedstawia** | Sekcja Illustrator | Przed rysowaniem porównuje najnowszy obraz z czatu z tym, co ma zostać narysowane, i pomija go, gdy przedstawiałby ponownie tę samą scenę. Obrazy, o które prosisz, są tworzone zawsze. |
| **Użyj ponownie tła z biblioteki, które wygląda jak to miejsce** | Sekcja Illustrator | Gdy żadne tło w bibliotece nie ma nazwy nowego miejsca, ogląda najwyżej 4 tła, których nazwy mają z nim wspólne słowa, i pokazuje pasujące zamiast rysować nowe. Zobacz [Sprawdzanie obrazów modelem decyzyjnym](../media/illustrator-agent.md#check-pictures-with-a-decision-model). |
| **Oznacz twarze, które nie pasują do przypisanej miny** | Okno **Generuj sprite'y**, tylko wyrazy twarzy | Ogląda każdą twarz po narysowaniu i oznacza te, które mogą nie oddawać przypisanego wyrazu twarzy, żeby można było je odznaczyć lub narysować ponownie. Zobacz [Generowanie sprite'ów z AI](../characters/sprites.md#generate-sprites-with-ai). |

Sprawdzenie, którego nie da się wykonać, bo model jest wyłączony, zbyt wolny albo zawiedzie, jest uznawane za zaliczone: obraz zostaje zachowany bez zmian.

<a id="what-the-model-sees"></a>

## Co widzi model

Przy pytaniach aktywacyjnych oraz stwierdzeniach w promptach i lorebookach model dostaje stwierdzenie i ostatnie wiadomości w postaci zapisanej na czacie. Nie dostaje twojego presetu, karty postaci, persony, wpisów lorebooka (także Constant), podsumowań ani wyników agentów. Pomijany jest też tekst wstawiony między wiadomości, na przykład wpis ustawiony na **@ Depth** (na wskazanej głębokości). Stwierdzenie zależne od jednej z tych rzeczy musi samo podawać ten fakt.

- Stwierdzenia w promptach i lorebookach, Smart response order i Automate active characters czytają ostatnie 5 wiadomości. Ta liczba jest stała.
- Pytania aktywacyjne czytają tyle wiadomości, ile wynosi **Scan Depth** (głębokość skanowania) agenta, domyślnie 5.
- Każda wiadomość ma imię swojego autora. Wiadomości ukryte przed AI są pomijane.
- Sprawdzenie wykonywane po odpowiedzi, na przykład pytanie agenta przetwarzania końcowego, widzi także napisaną odpowiedź.
- Makra w stwierdzeniu są najpierw rozwijane, więc `{{char}}` dociera jako imię postaci.
- Gdy wiadomości nie mieszczą się w limicie modelu, najpierw odrzucane są starsze.

**Smart response order** wysyła też listę postaci: imię, status, aktywność i rozmowność każdego kandydata, jeśli są znane, oraz do 300 znaków osobowości albo, jeśli jest pusta, opisu.

**Automate active characters** wysyła też listę postaci: imię każdej postaci i do 300 znaków opisu albo, jeśli jest pusty, osobowości, skrócone do 100 znaków albo do samych imion, gdy duża obsada się nie mieści, a do tego imiona, które Character Tracker ostatnio widział. Jeśli nawet same imiona zostawiają za mało miejsca na wiadomości, model nie jest pytany, a jego miejsce zajmuje Character Tracker. Odpowiedzi w grupie Merged są oznaczane jako "the narrator", ponieważ jedna odpowiedź mówi głosem wszystkich.

Hostowana usługa decyzyjna otrzymuje te listy postaci razem z wiadomościami.

**Advanced Memory** używa własnego modelu decyzyjnego ustawianego dla każdego czatu i nie stosuje reguły ostatnich 5 wiadomości. Sprawdzenia scen czytają odpowiednie okno transkryptu. Przywoływanie wysyła tekst niedawnej rozmowy i do 24 wstępnie wybranych archiwalnych podsumowań – więcej, jeśli **Maximum recalled scenes** (maksymalna liczba przywołanych scen) ma wyższą wartość – a potem oryginalne wiadomości ze scen wybranych przez model, po sprawdzeniu dostępu postaci. Usługi hostowane otrzymują te teksty, czasem w kilku partiach. Każdy przebieg przywoływania dostaje zwykle od 10 do 25 sekund, zależnie od szybkości modelu. Oba przebiegi dzielą 40 sekund na odpowiedź, więc przebieg może dostać mniej niż 10 sekund. Wspomnienia bez odpowiedzi na czas przechodzą na zwykłe przywoływanie. Zobacz [Opcjonalny model decyzyjny](../agents/memory.md#optional-decision-model).

<a id="thresholds"></a>

## Progi

Prawdopodobieństwa nie są porównywalne między modelami. Ten sam przykład może uzyskać 0,99 w jednym modelu i 0,2 w innym. Domyślny próg tak/nie zależy od modelu:

- **Built-in model albo konto z modelem czatu zgodnym z OpenAI:** 0,5
- **Konto TypeSafe, OpenRouter, NanoGPT, Google Gemini lub Custom System One:** 0,5
- **Wbudowany model decyzyjny:** własne zalecenie modelu, oparte na pomiarach na turach roleplay tam, gdzie było to możliwe: 0,3 dla JevK5, Liquid d1 i Valen-Decision 1.5 4B; 0,5 dla pełnej wersji Valen i Winnow (jeszcze niezmierzone); 0,1 dla Open-Jev 2B i 9B

Ustawienie agenta **Run when probability is at least** (uruchom, gdy prawdopodobieństwo wynosi co najmniej) nadpisuje tę wartość. Gdy zapisana wartość jest inna, edytor proponuje przywrócenie zalecenia modelu. Sprawdzaj je po każdej zmianie modelu. Stwierdzenia w promptach i pola Decision w lorebookach używają domyślnego progu modelu, a próg agenta go nie zmienia.

Samodzielnie hostowany Open-Jev za kontem Custom System One nadal używa progu 0,5, bo Marinara nie potrafi skalibrować dowolnych własnych punktów końcowych. Jego wyniki mogą różnić się od wbudowanego Open-Jev, w tym przez odczytanie pozytywnego wyniku poniżej 0,5 jako nie.

<a id="time-limits"></a>

## Limity czasu

Decyzja, która nie dotrze na czas, oznacza brak odpowiedzi, a generowanie trwa dalej z zachowaniem zastępczym danej funkcji (zobacz [Gdzie Marinara go używa](#where-marinara-uses-it)). Każdy limit dotyczy pojedynczego stwierdzenia. Żądanie z kilkoma stwierdzeniami dostaje limit na każde z nich, a każda odpowiedź Choice liczy się jako stwierdzenie. Model lokalny obsługuje naraz tylko kilka żądań, więc stwierdzenia czekają w kolejce, a czas stwierdzenia zaczyna biec, gdy model zaczyna je przetwarzać.

- **Konto TypeSafe, OpenRouter, Google Gemini lub Custom System One:** 1,5 sekundy albo wartość **Time limit**. W pomiarach OpenRouter i Google Gemini odpowiadały w ciągu 0,2–0,5 sekundy.
- **Model decyzyjny NanoGPT:** 4 sekundy albo wartość **Time limit**. W pomiarach odpowiadał w ciągu 0,4–2,5 sekundy.
- **Konto z modelem czatu zgodnym z OpenAI:** 4 sekundy albo twój **Time limit**. Model, który musi najpierw rozumować, dostaje co najmniej 20 sekund.
- **Built-in model:** 4 sekundy. Model, który musi najpierw rozumować, dostaje 20 sekund.
- **Wbudowany model decyzyjny:** Open-Jev dostaje 4 sekundy na pierwsze stwierdzenie, a na każde kolejne zmierzony czas: 0,35 sekundy dla 2B i 0,8 sekundy dla 9B. Pozostałe modele mierzą szybkość odczytu przy każdym uruchomieniu i dostosowują do niej limity, więc wolny procesor dostaje więcej czasu. Każdy obraz lub klip, o który prosi stwierdzenie, dodaje kolejny czas. Przed pierwszym uruchomieniem model dostaje po 4 sekundy na stwierdzenie, 30 sekund na obraz i 60 na klip.

Anulowanie generowania zatrzymuje żądania decyzyjne.

## Inne ustawienia

Te ustawienia znajdują się pod zębatką **Decision settings**:

- **Also use it to pick who speaks in Smart response order** (używaj także do wyboru mówiącego w kolejności Smart) jest domyślnie wyłączone. Zobacz [Czaty grupowe](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (stwierdzenia decyzyjne na turę) ogranicza planowanie stwierdzeń w promptach i lorebookach. Domyślnie 32, maksymalnie 255. Limit działa na kilku etapach i nie jest jednym limitem wszystkich żądań ani wydatków w turze. Pytania aktywacyjne agentów i Smart response order są liczone osobno. Zobacz [Limity i koszty](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** i **Thinking** pojawiają się przy pozycjach modelu wbudowanego, które potrafią rozumować. **Built-in decision model** nigdy nie rozumuje, więc nie ma żadnej z tych opcji.

## Uwzględnij błędne odpowiedzi

Każdy model może odpowiedzieć błędnie, a poprawne odpowiedzi tak mogą wypadać blisko progu.

- Używaj decyzji do dopracowania odpowiedzi, nigdy do czegoś niezbędnego dla czatu. Pominięta decyzja powinna uczynić odpowiedź mniej dopasowaną, a nie ją zepsuć.
- Nie uzależniaj zgody, ostrzeżeń o treści ani instrukcji bezpieczeństwa od decyzji.
- Dla agenta działającego tylko na podstawie pytania aktywacyjnego ustaw **Bypass the question after this many messages** (pomiń pytanie po tylu wiadomościach), żeby model, który ciągle odpowiada przecząco, nie mógł go wyciszyć na zawsze.

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

- **Konto nie pokazuje modeli w sekcji Decision models w oknie wyboru.** Listę zapisano przed dodaniem modeli decyzyjnych. Kliknij przycisk odświeżania obok nazwy konta w oknie wyboru.
- **Test kończy się błędem.** Komunikat podaje przyczynę: odrzucony klucz, ograniczanie liczby żądań przez usługę, nieuruchomiony model wbudowany, niezainstalowany model decyzyjny, odpowiedź inna niż tak lub nie albo przekroczony czas.
- **Serwer nie ma takiego punktu końcowego.** Źródło Decision nie pasuje do serwera. Ollama, LM Studio i inne serwery modeli czatu wymagają **OpenAI-compatible chat model**. **Custom System One endpoint** jest tylko dla serwerów System One, takich jak Open-Jev.
- **Odpowiedź przekroczyła limit czasu albo decyzje działają tylko czasami.** Usługa czasem odpowiada wolniej, niż pozwala **Time limit**. Przetestuj kilka razy i podnieś limit powyżej najwolniejszej odpowiedzi.
- **Agent z pytaniem aktywacyjnym działa w każdej turze.** Model decyzyjny nie jest ustawiony albo nie odpowiada, więc agent działa tak, jakby nie miał pytania. Uruchom test.
- **Gałąź decyzyjna w prompcie nigdy się nie pojawia.** Zobacz [Gdy gałąź decyzyjna nigdy się nie pojawia](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order nadal wykonuje zwykłe wywołanie AI.** Przełącznik jest wyłączony albo model decyzyjny nie odpowiedział w tej turze.
- **Ustawienia obrazów są wyszarzone i mają ikonę ⓘ.** Wybrany model decyzyjny odczytuje tylko tekst albo nie ustawiono żadnego modelu decyzyjnego. Wybierz Liquid d1, Valen lub Winnow jako **Wbudowany model decyzyjny**. Zobacz [Który wbudowany model decyzyjny wybrać](#which-built-in-decision-model).
- **Stwierdzenie z `pictures:` jest odczytywane jako nie.** Przy `media_within:` żadna z najnowszych wiadomości nie zawierała obrazu. W przeciwnym razie obraz spowolnił odpowiedź tak, że przekroczyła limit czasu. Wiersz **Na tym komputerze** na stronie modelu pokazuje, ile czasu zajmuje obraz.
- **Model informuje, że nie może tu działać.** Powód pod listą wskazuje, czego brakuje, na przykład funkcji procesora, odpowiedniej generacji karty graficznej albo biblioteki. Wybierz inny model; Liquid d1 i JevK5 działają na niemal każdym komputerze.
- **Automate active characters idzie za agentem Character Tracker.** Model nie odpowiedział dla każdej postaci, najpierw rozumuje, a **Also gate agents that run before the reply** jest wyłączone, albo obsada jest zbyt duża na dane wejściowe modelu nawet w postaci samych imion.

Żeby zobaczyć wyniki i dane wyjściowe decyzji podczas generowania, włącz Debug Mode albo ustaw poziom logowania na debug. Zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels). Żeby przetestować własne stwierdzenia bez generowania odpowiedzi, otwórz **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt, diagnostyka decyzji, testowanie decyzji). Jawne testy wywołują wybrany model i w usłudze hostowanej mogą kosztować. Zobacz [Testowanie stwierdzeń decyzyjnych](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Instalacja modelu decyzyjnego przez aplikację Marinara

**Wbudowany model decyzyjny** to model przeznaczony specjalnie do decyzji, który Marinara pobiera i uruchamia na twoim komputerze obok modelu czatu. Nic nie opuszcza twojego komputera. Jego zużycie pamięci dodaje się do zużycia modelu czatu. Jeśli już uruchamiasz model lokalny, najpierw wypróbuj jego decyzje.

### Który wbudowany model decyzyjny wybrać

| Model | Pobieranie | Odczytuje | Języki | Działa na |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | Około 2,7 GB | Tekst | Angielski | Niemal każdy komputer: grafika NVIDIA, AMD, Intel lub Apple albo sam procesor. Używa tego samego środowiska uruchomieniowego co model wbudowany. |
| **JevK5 2B** | Około 2 GB | Tekst | Angielski | Tak samo jak 4B. Szybszy na procesorze lub małej karcie graficznej, nieco mniej dokładny. |
| **Liquid d1 3B** | Około 2,3 GB | Tekst, obrazy | 16, w tym japoński, chiński, koreański, niemiecki, hiszpański i rosyjski | Niemal każdy komputer. Wybór do czatów w językach innych niż angielski. Bezpłatny dla osób prywatnych i firm z przychodem poniżej 10 milionów dolarów rocznie. |
| **Valen-Decision 1.5 4B** | Około 5,8 GB | Tekst, obrazy | 8 sprawdzonych | System Linux na 64-bitowym procesorze Intel lub AMD, tylko na procesorze. |
| **Valen-Decision 1.5 2B (pełna wersja)** | Około 6,4 GB | Tekst, obrazy, klipy | Nie podano | System Windows, macOS na układach Apple silicon i Linux, na procesorze. Wymaga około 6 GB pamięci. |
| **Valen-Decision 1.5 4B (pełna wersja)** | Około 11,8 GB | Tekst, obrazy, klipy | 8 sprawdzonych | Tak samo jak 2B. Wymaga około 12 GB pamięci; jest wolniejszy, ale dokładniejszy. |
| **Winnow E4B** | Około 9 GB | Tekst, obrazy | Nie podano | Tylko system Linux z kartą NVIDIA RTX z serii 50, bibliotekami CUDA 13 i procesorem z AVX-512 (takim jak AMD Ryzen 7000 lub 9000; obecne procesory Intel do laptopów i komputerów stacjonarnych go nie mają). Wymaga około 11 GB pamięci karty graficznej. |
| **Open-Jev 2B** | Około 4,6 GB | Tekst | Angielski | System Linux z kartą NVIDIA z serii RTX 20 lub nowszej i sterownikiem 580 lub nowszym. Używa około 4,8 GB pamięci karty graficznej i 10 GB miejsca na dysku. |
| **Open-Jev 9B** | Około 19,4 GB | Tekst | Angielski | Tak samo jak 2B. Używa około 23,6 GB pamięci karty graficznej, więc na karcie 24 GB nic innego się obok niego nie zmieści. |

W 20 turach roleplay w 8 językach JevK5 4B, Liquid d1 i Valen-Decision 1.5 4B odpowiedziały poprawnie na wszystkie 20. Jeśli nie wiesz, co wybrać, wybierz Liquid d1, a jeśli chcesz odczytywać klipy – pełną wersję Valen.

Zanim cokolwiek zostanie pobrane, Marinara sprawdza, czy twój komputer może uruchomić model: system, funkcje procesora, kartę graficzną i jej biblioteki oraz wolną pamięć. Model, który nie może się uruchomić, pozostaje na liście z oznaczeniem **(nie może tu działać)** i podaje powód.

### Instalacja modelu

1. Kliknij **Połączenia** na górnym pasku. W sekcji **Na tym urządzeniu** kliknij **Model wbudowany (decyzje)**. Możesz też kliknąć **Dodaj** w panelu **Połączenia** i wybrać **Model wbudowany (decyzje)** w sekcji **Decyzje**.
2. Wybierz model z listy **Model**. Pod nią zobaczysz jego opis, potem **Odpowiedzi** i **Odczytuje** (zobacz [Co pokazuje strona modelu](#what-a-model-page-lists)), języki i licencje.
3. Kliknij **Pobierz** z nazwą i rozmiarem modelu. Potwierdź rozmiar, ocenę sprzętu i licencje. Wcześniej nic się nie pobiera.
4. Kliknij **Używaj do Decyzji** albo kliknij wiersz **Decyzja** w grupie **Za kulisami** w sekcji **Zadania** i wybierz **Model wbudowany (decyzje)**.

Po uruchomieniu modelu jego strona pokazuje też wiersz **Na tym komputerze** z czasami przetwarzania: kilku tur czatu, obrazu i klipu w przypadku modeli, które je odczytują. Te czasy pochodzą z twojego komputera, więc pokazują, o ile wolniejsza staje się ocena stwierdzenia, gdy prosi ono o obraz.

Aby zmienić model, wybierz inny z listy. Wcześniej pobrany model ma oznaczenie **(pobrany)**, a **Użyj tego modelu** przełącza na niego bez ponownego pobierania.

Inne kontrolki na stronie:

- **Wyłącz** zatrzymuje model i zachowuje jego pliki. **Włącz** uruchamia go ponownie.
- **Runs on** (uruchamianie na) wybiera kartę na komputerze z kilkoma kartami NVIDIA. Zmiana zatrzymuje model, który uruchamia się ponownie na nowej karcie.
- **Uruchamia się** ma domyślną wartość **Gdy agent pierwszy raz go potrzebuje** albo **Razem z Marinarą**.
- **Zainstaluj z repozytorium** przyjmuje model decyzyjny z serwisu Hugging Face w postaci `owner/model-name`: checkpoint Open-Jev, GGUF deklarujący się jako model decyzyjny albo pakiet GGUF Valen. Dodaj `:Q8_0` po nazwie, żeby wybrać jeden rozmiar GGUF. Kliknij **Sprawdź**. Marinara odczytuje, co pliki mówią o sobie, i pokazuje rozmiar oraz licencje. Repozytorium, którego nie może zweryfikować, zostaje odrzucone z podaniem powodu. Potem kliknij **Pobierz i zainstaluj ten**.
- **Usuń pliki** usuwa model i jego środowisko uruchomieniowe.
- **Reinstall** (ponowna instalacja) pojawia się, gdy zainstalowany model nie może się uruchomić, bo brakuje jego plików lub środowiska uruchomieniowego albo są one nieaktualne, zwykle po aktualizacji. Model ma oznaczenie **Needs reinstall**. Ponowna instalacja zachowuje pliki, które są już pobrane i kompletne, więc zwykle ponownie pobiera się tylko środowisko uruchomieniowe.

Pierwsza odpowiedź modelu po uruchomieniu jest wolniejsza, więc Marinara zadaje jedno pytanie na rozgrzewkę podczas wczytywania. Jeśli się nie powiedzie, model i tak się uruchamia, a opóźnienie dotyka pierwszego prawdziwego pytania. Jeśli model zatrzyma się zaraz po uruchomieniu, strona podaje powód, na przykład brak wymaganej funkcji procesora.

<a id="run-strands-decider-yourself"></a>

### Samodzielne uruchamianie Strands decider

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) to kolejny otwarty model decyzyjny (Apache-2.0) obsługujący System One. Marinara nie może go zainstalować, ale działa on jako **Custom System One endpoint**, dopóki utrzymujesz go w działaniu.

1. W środowisku z Python 3.10 lub nowszym zainstaluj go i uruchom jego serwer:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Jeśli znajdzie kartę graficzną NVIDIA lub Apple silicon, używa tego sprzętu; w przeciwnym razie działa wolniej na procesorze. Pierwsze uruchomienie pobiera model i około 4,6 GB wag bazowych, a jego pakiety Python zajmują około 5,5 GB. Serwer nie ma hasła, więc pozostaw go na `127.0.0.1`.

2. Dodaj konto **Own decision server** z adresem `http://127.0.0.1:8000` w polu **Server address**. Działa dowolna nazwa modelu.
3. Wybierz je w wierszu **Decision**, a potem przetestuj opcją **Test** w menu **⋯** konta. Pierwsza odpowiedź po uruchomieniu zajmuje około 2 sekund, dłużej niż domyślny limit czasu, więc przetestuj model raz przed rozpoczęciem czatu.

Jego prawdopodobieństwa są skalibrowane, więc pasuje do niego domyślny próg 0,5, inaczej niż do samodzielnie hostowanego Open-Jev (zobacz [Progi](#thresholds)). Jego odpowiedzi zależą od sformułowań, więc stosuj się do wskazówek z sekcji [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

## Powiązane przewodniki

- [Tworzenie własnych agentów](../agents/custom-agents.md)
- [Prompty warunkowe](../prompts/conditional-prompts.md)
- [Czaty grupowe](../chats/group-chats.md)
- [Konfiguracja modelu wbudowanego](local-model.md)
- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
