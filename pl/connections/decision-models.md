# Modele decyzyjne

Model decyzyjny to mały model, który odpowiada aplikacji Marinara na pytania typu tak lub nie, na przykład "Does the latest message move the scene to a new place?". Korzystają z niego lorebooki, niestandardowi agenci, prompty i czaty grupowe. Jest opcjonalny. Bez niego czaty nadal działają, a każda funkcja korzysta z zachowania zastępczego opisanego w sekcji [Gdzie Marinara go używa](#where-marinara-uses-it).

Jego odpowiedzi sterują działaniem aplikacji Marinara i nigdy nie trafiają na czat. Model ocenia stwierdzenie liczbą od 0 do 1. Marinara porównuje tę liczbę z progiem i traktuje wynik jako tak lub nie. Model może też wybrać jedną odpowiedź z krótkiej listy, na przykład "angry", "sad" albo "none of these".

Nasza rada: jeśli nie masz pewności, zostaw ustawienie **None** (brak). Jeśli chcesz korzystać z decyzji, użyj modelu wbudowanego, który być może już masz, albo modelu czatu na serwerze, który już uruchamiasz. Żadna z tych opcji nie kosztuje nic dodatkowo.

## Wybór modelu decyzyjnego

Zanim zaczniesz, przeczytaj sekcję [Co wybrać](#which-one-to-pick).

1. Kliknij **Connections** (Połączenia) na górnym pasku i otwórz sekcję **Jobs** (zadania).
2. W grupie **Behind the scenes** (za kulisami) kliknij wiersz **Decision** (decyzje). Otworzy się lista.
3. Wybierz model. Lista ma trzy grupy:
   - **None (decisions off)** (brak, decyzje wyłączone) to ustawienie domyślne. Żadne pytania nie są wysyłane, a pola pytań aktywacyjnych w edytorze agenta pozostają wyłączone.
   - **Built-in model** (model wbudowany) wymienia modele, które Marinara uruchamia na twoim komputerze: **Built-in model**, **Built-in model (utility)** (model wbudowany, pomocniczy) i **Built-in model (decisions)** (model wbudowany, decyzje). Nic nie opuszcza twojego komputera.
   - **Connections** wymienia twoje konta, które mogą odpowiadać na pytania decyzyjne: hostowane albo z modelem czatu na serwerze, który już uruchamiasz.
4. Żeby go przetestować, kliknij ikonę zębatki **Decision settings** (ustawienia decyzji) w tym wierszu, a potem **Test** (test). Ten przycisk pojawia się przy pozycjach modelu wbudowanego. Przy koncie TypeSafe lub OpenRouter otwórz **Edit model** (edycja modelu) przy jego modelu i kliknij **Test provider** (test dostawcy). Przy koncie **Own decision server** (własny serwer decyzyjny) użyj opcji **Test** w menu **⋯** konta.

Udany test pokazuje prawdopodobieństwo odpowiedzi tak i czas odpowiedzi. Przy modelu na twoim komputerze podaje też, czy dostępne były logarytmy prawdopodobieństw i czy model odpowiada bezpośrednio. Logarytmy prawdopodobieństw to liczby, którymi model wyraża pewność co do każdego słowa, jakie mógłby napisać. Test wysyła stały przykład, a nie twój czat.

Jeśli test się nie uda, komunikat podaje przyczynę. Częste przyczyny: odrzucony klucz, ograniczanie liczby żądań przez usługę, nieuruchomiony model wbudowany albo odpowiedź po przekroczeniu limitu czasu. Zobacz [Rozwiązywanie problemów](#troubleshooting).

Pozycje, które nie mogą teraz odpowiadać, pozostają na liście, wyszarzone, wraz z przyczyną. Wybór **None** wyłącza decyzje bez usuwania pytań aktywacyjnych ani stwierdzeń decyzyjnych.

<a id="which-one-to-pick"></a>

### Co wybrać

- **Model, który już działa w ramach modelu wbudowanego.** Bez dodatkowych kosztów. Najlepszy wybór dla większości osób korzystających z modelu wbudowanego.
- **Model czatu na własnym serwerze** (Ollama, LM Studio, llama.cpp lub inny serwer zgodny z OpenAI). Bez dodatkowych kosztów. Dobry wybór, gdy model działa poza aplikacją Marinara, bo nie jest ładowany dwa razy.
- **Hostowane konto Decision** (klucz TypeSafe lub OpenRouter). Płatne za każde żądanie, a jedna tura może wysłać ich kilka. Dobry wybór dla telefonów i komputerów bez lokalnego modelu.
- **Wbudowany model decyzyjny.** Zajmuje osobne miejsce na dysku i osobną pamięć GPU. Wymaga systemu Linux x86-64 i obsługiwanej karty graficznej NVIDIA. Dla osób, które chcą mieć osobny model decyzyjny obok modelu czatu.

Jeśli masz już uruchomiony model lokalny, wypróbuj najpierw jego i testuj tury z własnych czatów. Sformułowania mają duże znaczenie. Zobacz [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

Jev i Open-Jev to różne modele. Jev to hostowany model firmy TypeSafe, dostępny bezpośrednio lub przez usługę OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) to osobno opublikowany model oparty na Qwen, który Marinara może uruchomić lokalnie. Testy Open-Jev nie mierzą hostowanego modelu Jev.

W systemie Android (Termux) **Built-in decision model** (wbudowany model decyzyjny) nie działa, a mały model lokalny na procesorze telefonu może być zbyt wolny. Praktycznym wyborem jest konto hostowane, na przykład Jev przez usługę OpenRouter. Zobacz [Konfiguracja połączenia Decision](#set-up-a-decision-connection).

Presety, karty i agentów pisz z myślą o "modelu decyzyjnym", nigdy jako "wymaga Jev". Z każdym modelem używają tej samej składni stwierdzeń, ale różne modele mogą dawać różne odpowiedzi. Przy imporcie treści korzystającej z decyzji, w tym niestandardowych agentów i instalacji z sekcji Agent Organizer, Marinara pokazuje informację z linkiem do tego przewodnika. Przywrócenie całego profilu z pliku ZIP jej nie pokazuje.

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

1. Kliknij **⋯** przy tym modelu w panelu **Connections** i wybierz **Use this model for decisions** (używaj tego modelu do decyzji). Otworzy się okno **Add account** (dodanie konta) na kroku decyzji, z tym samym adresem, modelem i kluczem.
2. Wybierz model, a potem kliknij **Test decision** (test decyzji). Udany test podaje, czy serwer zwrócił logarytmy prawdopodobieństw i czy model musiał najpierw rozumować. Kliknij **Done** (gotowe).
3. Kliknij wiersz **Decision** w grupie **Behind the scenes** i wybierz nowy model.

Możesz też utworzyć je samodzielnie. Użyj konta Decision ze źródłem **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (model czatu zgodny z OpenAI), tym samym adresem co konto czatu (na przykład `http://localhost:11434/v1` dla serwera Ollama) i nazwą modelu, której używa serwer.

Odpytywanie wygląda tak samo jak przy modelu wbudowanym: jedno słowo tak/nie na stwierdzenie. Stwierdzenia są wysyłane pojedynczo, bo Marinara nie może wiedzieć, ile żądań naraz obsługuje twój serwer. **Thinking** dla konta to zawsze **Auto** (automatycznie). Serwer na innym komputerze wymaga `PROVIDER_LOCAL_URLS_ENABLED`. Zobacz [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Konfiguracja połączenia Decision

Hostowane konto Decision wysyła wybrane ostatnie wiadomości i stwierdzenia do usługi i może generować koszty. Smart response order wysyła też [listę postaci](#what-the-model-sees).

1. Kliknij **Connections** na górnym pasku, a potem **Add** (dodaj).
2. W sekcji **Decisions** (decyzje) kliknij **TypeSafe** albo **Own decision server**. W przypadku OpenRouter kliknij **OpenRouter** w sekcji **Chat** (czat), połącz konto, a potem użyj opcji **Use this key for decisions** (używaj tego klucza do decyzji) w menu **⋯** modelu.
3. Wpisz **API key** (klucz API), a przy **Own decision server** – **Server address** (adres serwera). Kliknij **Connect** (połącz). Okno się zamknie, a panel pokaże nowe konto.
4. Kliknij wiersz **Decision** w grupie **Behind the scenes** i wybierz nowy model.
5. Żeby go przetestować, kliknij model w panelu, żeby otworzyć **Edit model**, a potem kliknij **Test provider** w sekcji **Provider tests** (testy dostawcy). Model **Own decision server** nie ma tam przycisku **Test provider**. Zamiast tego otwórz menu **⋯** konta w panelu i kliknij **Test**.

Udany **Test provider** pokazuje prawdopodobieństwo, czas odpowiedzi i limit czasu konta. **Test** konta w menu **⋯** podaje tylko, czy się udało i ile to trwało. Test czeka co najmniej 10 sekund, a przy dłuższym limicie 5 sekund ponad niego. Jeśli odpowiedź przekroczyła limit, wynik to zaznacza: na czacie taka odpowiedź liczyłaby się jako brak odpowiedzi.

Jeśli test się nie uda, zobacz [Rozwiązywanie problemów](#troubleshooting).

Edytor Decision (**Edit model** przy modelu decyzyjnym) ma te pola:

| Pole | Działanie |
| --- | --- |
| **Decision source** (źródło decyzji) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (własny punkt końcowy System One) albo **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Zostaje na stałe ustalone przy tworzeniu modelu. |
| **API key source** (źródło klucza API) | **Enter a separate key (optional for local servers)** (wpisanie osobnego klucza, opcjonalne dla serwerów lokalnych) albo **Use key from …** (użycie klucza z innego konta). Powiązane klucze uwzględniają późniejsze zmiany klucza. Własny model System One lub zgodny z OpenAI może pożyczyć klucz własnego konta czatu tylko wtedy, gdy oba adresy mają ten sam schemat, host i port. |
| **Recent-message token budget** (limit tokenów ostatnich wiadomości) | Ile szacowanych tokenów czatu wysłać. Od 1 do 30 000. Domyślnie 30 000 dla TypeSafe i OpenRouter oraz 3 500 dla własnych serwerów. Marinara najpierw odrzuca starsze wiadomości, potem przycina najstarszą część najnowszej wiadomości. Odrzucone albo przekraczające limit żądanie nie daje odpowiedzi. |
| **Time limit (seconds)** (limit czasu w sekundach) | Jak długo czekać na każde stwierdzenie podczas czatu. Od 0,5 do 30. Domyślnie 1,5, a dla modelu czatu zgodnego z OpenAI 4. Zobacz [Limity czasu](#time-limits). |

TypeSafe wysyła żądania do `https://api.typesafe.ai`. Jego pole **Base URL** (adres bazowy) możesz zastąpić adresem innego serwera, który udostępnia API firmy TypeSafe, bez `/v1/systemone`. Nadal potrzebny jest twój klucz TypeSafe, który trafia do tego serwera. **Custom System One endpoint** przyjmuje uruchomiony przez ciebie serwer System One, na przykład Open-Jev albo [Strands decider](#run-strands-decider-yourself). Wpisz jego adres bez `/v1/systemone`. Serwer modeli czatu, taki jak Ollama, nie obsługuje System One. Użyj dla niego **OpenAI-compatible chat model**.

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

Pytanie aktywacyjne decyduje, czy agent się uruchomi. Stwierdzenie decyzyjne w jego prompcie decyduje, jakie instrukcje dostanie uruchomiony agent. Używaj `{{#if decision:"..."}}` do warunków tak/nie i `{{#if decision_choice:"..." == "..."}}` do wyboru spośród odpowiedzi.

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
- **Konto TypeSafe, OpenRouter lub Custom System One:** 0,5
- **Built-in decision model:** zalecenie z manifestu modelu: 0,1 dla Open-Jev 2B i 9B

Ustawienie agenta **Run when probability is at least** (uruchom, gdy prawdopodobieństwo wynosi co najmniej) nadpisuje tę wartość. Gdy zapisana wartość jest inna, edytor proponuje przywrócenie zalecenia modelu. Sprawdzaj je po każdej zmianie modelu. Stwierdzenia w promptach i pola Decision w lorebookach używają domyślnego progu modelu, a próg agenta go nie zmienia.

Samodzielnie hostowany Open-Jev za kontem Custom System One nadal używa progu 0,5, bo Marinara nie potrafi skalibrować dowolnych własnych punktów końcowych. Jego wyniki mogą różnić się od wbudowanego Open-Jev, w tym przez odczytanie pozytywnego wyniku poniżej 0,5 jako nie.

<a id="time-limits"></a>

## Limity czasu

Decyzja, która nie dotrze na czas, oznacza brak odpowiedzi, a generowanie trwa dalej z zachowaniem zastępczym danej funkcji (zobacz [Gdzie Marinara go używa](#where-marinara-uses-it)). Każdy limit dotyczy pojedynczego stwierdzenia. Żądanie z kilkoma stwierdzeniami dostaje limit na każde z nich, a każda odpowiedź Choice liczy się jako stwierdzenie. Model lokalny obsługuje naraz tylko kilka żądań, więc stwierdzenia czekają w kolejce, a czas stwierdzenia zaczyna biec, gdy model zaczyna je przetwarzać.

- **Konto TypeSafe, OpenRouter lub Custom System One:** 1,5 sekundy albo twój **Time limit**
- **Konto z modelem czatu zgodnym z OpenAI:** 4 sekundy albo twój **Time limit**. Model, który musi najpierw rozumować, dostaje co najmniej 20 sekund.
- **Built-in model:** 4 sekundy. Model, który musi najpierw rozumować, dostaje 20 sekund.
- **Built-in decision model:** 4 sekundy na pierwsze stwierdzenie. Każde kolejne dostaje zmierzony czas modelu: 0,35 sekundy dla Open-Jev 2B i 0,8 sekundy dla Open-Jev 9B. Model zainstalowany z repozytorium dostaje po 4 sekundy na każde.

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

- **Test kończy się błędem.** Komunikat podaje przyczynę: odrzucony klucz, ograniczanie liczby żądań przez usługę, nieuruchomiony model wbudowany, niezainstalowany model decyzyjny, odpowiedź inna niż tak lub nie albo przekroczony czas.
- **Serwer nie ma takiego punktu końcowego.** Źródło Decision nie pasuje do serwera. Ollama, LM Studio i inne serwery modeli czatu wymagają **OpenAI-compatible chat model**. **Custom System One endpoint** jest tylko dla serwerów System One, takich jak Open-Jev.
- **Odpowiedź przekroczyła limit czasu albo decyzje działają tylko czasami.** Usługa czasem odpowiada wolniej, niż pozwala **Time limit**. Przetestuj kilka razy i podnieś limit powyżej najwolniejszej odpowiedzi.
- **Agent z pytaniem aktywacyjnym działa w każdej turze.** Model decyzyjny nie jest ustawiony albo nie odpowiada, więc agent działa tak, jakby nie miał pytania. Uruchom test.
- **Gałąź decyzyjna w prompcie nigdy się nie pojawia.** Zobacz [Gdy gałąź decyzyjna nigdy się nie pojawia](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order nadal wykonuje zwykłe wywołanie AI.** Przełącznik jest wyłączony albo model decyzyjny nie odpowiedział w tej turze.
- **Automate active characters idzie za agentem Character Tracker.** Model nie odpowiedział dla każdej postaci, najpierw rozumuje, a **Also gate agents that run before the reply** jest wyłączone, albo obsada jest zbyt duża na dane wejściowe modelu nawet w postaci samych imion.

Żeby zobaczyć wyniki i dane wyjściowe decyzji podczas generowania, włącz Debug Mode albo ustaw poziom logowania na debug. Zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels). Żeby przetestować własne stwierdzenia bez generowania odpowiedzi, otwórz **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt, diagnostyka decyzji, testowanie decyzji). Jawne testy wywołują wybrany model i w usłudze hostowanej mogą kosztować. Zobacz [Testowanie stwierdzeń decyzyjnych](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Instalacja modelu decyzyjnego przez aplikację Marinara

**Built-in decision model** to eksperymentalny, wyspecjalizowany model decyzyjny, który Marinara pobiera i uruchamia jako osobny lokalny proces obok twojego modelu czatu. Jego zużycie pamięci dodaje się do zużycia modelu czatu. Jeśli masz już model lokalny, najpierw wypróbuj jego decyzje.

Modele Open-Jev wymagają systemu Linux **x86-64**, karty graficznej NVIDIA o compute capability 7.5 lub wyższym (Turing, seria RTX 20 lub nowsza) i sterownika w wersji 580 lub nowszej. Linux ARM i starsze karty nie są obsługiwane. Gdy model nie może działać, opcja pozostaje widoczna, wyjaśnia przyczynę i proponuje **Set up a Decision provider instead** (konfiguracja dostawcy Decision zamiast tego).

| Model | Pobierany model | Dysk ze środowiskiem uruchomieniowym | Pamięć GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Około 4,6 GB | Około 10 GB | Około 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Około 19,4 GB | Około 25,3 GB | Około 23,6 GB (22 GiB) |

To szacunki katalogu. Model 9B pozostawia niewielki zapas na karcie 24 GB. Sprawdź ocenę instalatora dla swojej karty.

1. Kliknij **Add** w panelu **Connections**, a potem **Built-in model (decisions)** w sekcji **Decisions**. Otworzy się okno **Built-in decision model**. Możesz je też otworzyć ze strony bloku **Built-in model**.
2. Przeczytaj ostrzeżenie, a potem włącz **Use the built-in decision model** (używanie wbudowanego modelu decyzyjnego). Okno **Turn on the built-in decision model?** (włączyć wbudowany model decyzyjny?) pokazuje ocenę twojego komputera. Kliknij **Enable** (włącz) albo **Enable anyway** (włącz mimo to), gdy ocena jest ostrzeżeniem.
3. W sekcji **Available decision models** (dostępne modele decyzyjne) wybierz **Open-Jev 2B** albo **Open-Jev 9B**. Kliknij **Download and install** (pobierz i zainstaluj) i potwierdź rozmiar, ocenę sprzętu i licencje. Wcześniej nic nie jest pobierane.
4. Kliknij wiersz **Decision** w grupie **Behind the scenes** i wybierz **Built-in model (decisions)**.

Inne kontrolki w tym oknie:

- **Install from a repository** (instalacja z repozytorium) przyjmuje model decyzyjny z serwisu HuggingFace w postaci `owner/model-name`. Kliknij **Check** (sprawdź). Marinara czyta manifest repozytorium, sprawdza, czy odpowiada on środowisku uruchomieniowemu dostarczanemu w tej wersji aplikacji, i pokazuje wagi bazowe oraz łączny rozmiar. Repozytorium, za które nie może poręczyć, zostaje odrzucone z podaniem przyczyny. Potem kliknij **Download and install this one** (pobierz i zainstaluj ten model).
- **GPU** wybiera kartę na komputerze z kilkoma kartami graficznymi NVIDIA. Zmiana karty zatrzymuje model, który uruchamia się ponownie na nowej karcie.
- **Start this model when Marinara starts** (uruchamianie tego modelu przy starcie aplikacji Marinara) jest opcjonalne. Gdy jest wyłączone, model uruchamia się wtedy, gdy agent pierwszy raz go potrzebuje.
- **Remove files** (usuń pliki) usuwa model i jego środowisko uruchomieniowe. Wyłączenie modelu zatrzymuje proces i zachowuje pliki.

Pierwsza odpowiedź modelu po uruchomieniu jest wolniejsza, więc podczas ładowania Marinara zadaje jedno pytanie rozgrzewające. Jeśli się nie uda, model i tak się uruchamia, a opóźnienie spada na pierwsze prawdziwe pytanie. Tura z wieloma stwierdzeniami w długim czacie trwa dłużej. Open-Jev 2B potrzebuje w długim czacie około ćwierci sekundy na stwierdzenie.

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
