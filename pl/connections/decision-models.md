# Modele decyzyjne

Ten przewodnik opisuje **Decision model** (model decyzyjny): czym jest, trzy sposoby jego uzyskania, konfigurację każdego z nich i miejsca, w których używa go Marinara. To funkcja opcjonalna. Bez niej czaty nadal generują odpowiedzi, ale każda funkcja korzysta z zachowania zastępczego opisanego poniżej.

## Czym jest model decyzyjny

Model decyzyjny odpowiada na jeden rodzaj pytań. Otrzymuje ostatnie wiadomości czatu i stwierdzenie, na przykład "The latest message moves the scene to a new place", po czym określa prawdopodobieństwo jego prawdziwości liczbą od 0 do 1. Marinara porównuje tę liczbę z progiem i traktuje wynik jako tak lub nie. Model może też wybrać jedną odpowiedź z krótkiej listy, na przykład "angry", "sad" albo "none of these".

Odpowiedzi sterują zachowaniem aplikacji Marinara; nie są publikowane jako odpowiedzi na czacie. Wyspecjalizowany model decyzyjny bezpośrednio ocenia stwierdzenia. Lokalny model czatu zwykle dostaje prośbę o pojedynczy token tak/nie, choć niektóre modele muszą najpierw rozumować. Decyzje mogą być szybsze niż pełna odpowiedź, ale wiele stwierdzeń lub model rozumujący mogą zauważalnie wydłużyć oczekiwanie.

<a id="where-marinara-uses-it"></a>

## Gdzie Marinara go używa

- **[Pytania aktywacyjne](../agents/custom-agents.md#activation-questions)** decydują, czy niestandardowy agent uruchomi się, przed jego pracą w danej fazie. Brak odpowiedzi nie zatrzymuje agenta; nadal obowiązują słowa kluczowe i **Trigger Cadence** (częstotliwość uruchamiania).
- **[Stwierdzenia w promptach](../prompts/conditional-prompts.md#asking-the-decision-model)** wybierają tekst podczas przygotowywania promptu czatu lub agenta. Przy braku odpowiedzi decyzja oznacza nie, więc prosty blok decyzyjny używa gałęzi `{{else}}`, jeśli istnieje.
- **[Pola Decision w lorebooku](../lorebooks/entries.md#decision-activation)** sprawdzają Require lub Trigger podczas skanowania lorebooka czatu. Bez odpowiedzi Require nie może dopuścić nowego wpisu, a Trigger nie dodaje drogi aktywacji. Nadal obowiązują istniejące okresy Sticky i zwykłe drogi aktywacji wpisu Trigger.
- **[Smart response order](../chats/group-chats.md#response-order-individual-only)** ocenia, kto powinien odezwać się następny w czacie grupowym, jeśli opcja jest włączona. Bez odpowiedzi kolejność Smart korzysta ze zwykłego wywołania AI.
- **[Advanced Memory Recall](../agents/memory.md#optional-decision-model)** może używać osobno wybranego modelu lokalnego lub połączenia decyzyjnego do wykrywania granic scen i wybierania pamięci w Roleplay. Włącz **Use Decision model** w ustawieniach tego czatu. Podsumowania nadal pisze model pomocniczy. Nieudane decyzje uruchamiają zwykłe przywoływanie lub kontrolę scen.

Pytanie aktywacyjne steruje uruchomieniem agenta; stwierdzenie decyzyjne w jego prompcie steruje instrukcjami otrzymywanymi przez uruchomionego agenta. Używaj `{{#if decision:"..."}}` do warunków tak/nie i `{{#if decision_choice:"..." == "..."}}` do wyboru odpowiedzi.

<a id="what-the-model-sees"></a>

## Co widzi model

Przy pytaniach aktywacyjnych i stwierdzeniach w promptach lub lorebookach model otrzymuje stwierdzenie oraz ostatnie wiadomości w postaci zapisanej na czacie. Nie otrzymuje reszty złożonego promptu: presetu, karty postaci, opisu persony, wpisów lorebooka (także Constant), podsumowań ani wyników agentów. Pomijany jest też tekst wstawiony między wiadomościami, na przykład preset lub wpis lorebooka umieszczony **@ Depth** (na wskazanej głębokości). Stwierdzenie zależne od takiego faktu musi samo zawierać ten fakt.

**Smart response order wysyła również listę postaci.** Zawiera imię, status, aktywność i rozmowność każdego kandydata, jeśli są dostępne, oraz do 300 znaków osobowości albo opisu, jeśli osobowość jest pusta. Zdalny dostawca Decision otrzymuje tę listę wraz z ostatnimi wiadomościami.

- Stwierdzenia decyzyjne w promptach i wpisach lorebooka oraz Smart response order czytają ostatnie 5 wiadomości. Ta liczba jest stała.
- Pytania aktywacyjne czytają liczbę wiadomości ustawioną przez **Scan Depth** (głębokość skanowania) agenta, domyślnie 5.
- Każda wiadomość ma etykietę z imieniem autora. Wiadomości ukryte przed AI są pomijane.
- Każde sprawdzenie po odpowiedzi, na przykład pytanie aktywacyjne agenta przetwarzania końcowego lub stwierdzenie w jego prompcie, widzi także właśnie napisaną odpowiedź.
- Makra w stwierdzeniu są rozwijane wcześniej, więc `{{char}}` dociera jako imię postaci.
- Gdy wiadomości nie mieszczą się w limicie modelu, najpierw usuwane są starsze. Limit zdalnego połączenia opisuje [Konfiguracja połączenia Decision](#set-up-a-decision-connection).

**Advanced Memory używa własnego modelu decyzyjnego dla każdego czatu.** Kontrola scen odczytuje odpowiednie okno transkryptu. Przywoływanie wysyła niedawną rozmowę oraz do 24 wstępnie wybranych podsumowań archiwalnych, a potem oryginalne wiadomości ze scen wybranych przez model, po sprawdzeniu dostępu postaci; nie obowiązuje tu reguła ostatnich 5 wiadomości. Podsumowań może być więcej, jeśli ustawienie **Maximum recalled scenes** (maksymalna liczba przywołanych scen) ma wyższą wartość. Zewnętrzny dostawca otrzymuje te teksty, czasem w kilku ograniczonych partiach. Po 10 sekundach każdy przebieg przywoływania przechodzi na zwykłe przywoływanie. Zobacz [Opcjonalny model decyzyjny](../agents/memory.md#optional-decision-model).

## Wybór modelu decyzyjnego

Otwórz **Connections** (połączenia), następnie **Connection defaults** (domyślne połączenia) i wybierz model w **Decision model**. Lista ma trzy grupy:

- **None** (brak), ustawienie domyślne. Żadne pytania nie są wysyłane, a pola pytań aktywacyjnych w edytorze agenta pozostają wyłączone.
- **Local models** (modele lokalne): uruchomiony już **Primary local model** (główny model lokalny) lub **Utility local model** (pomocniczy model lokalny). Nic nie jest pobierane i nic nie opuszcza komputera. Zainstalowany **Decision sidecar** (osobny proces decyzyjny) też znajduje się w tej grupie.
- **Connections**: utworzone połączenia Decision: usługa hostowana, własny serwer System One lub model czatu na działającym już serwerze, takim jak Ollama albo LM Studio.

Pozycje, które nie mogą teraz odpowiadać, pozostają na liście wyszarzone wraz z przyczyną, dzięki czemu wiadomo, co naprawić. Po wyborze kliknij **Test** (test). Test wysyła stały przykład, a nie twój czat.

### Co wybrać

Jeśli masz już uruchomiony model lokalny, zacznij od niego. W małym teście sformułowań z jednej sceny roleplay Gemma 4 E4B poprawnie oceniła 32 z 32 zalecanych stwierdzeń, a Open-Jev 2B i 9B po 31. To przykład znaczenia sformułowań, a nie ogólny ranking dokładności. Sprawdź reprezentatywne tury własnych czatów; zobacz [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

**Jev i Open-Jev to różne modele.** Jev to zdalny model firmy TypeSafe, dostępny bezpośrednio lub przez OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) to osobno opublikowany model oparty na Qwen, który Marinara może uruchomić lokalnie. Testy sformułowań Open-Jev nie mierzą dokładności zdalnego Jev.

| Opcja | Koszty | Wymagania | Dla kogo |
| --- | --- | --- | --- |
| Już uruchomiony model | Bez dodatkowych kosztów | Model lokalny w **Local Model** (model lokalny) | Większość osób używających lokalnego modelu |
| Model czatu na własnym serwerze | Bez dodatkowych kosztów | Działający serwer Ollama, LM Studio, llama.cpp lub inny zgodny z OpenAI | Model uruchomiony poza Marinara, bez ładowania go dwa razy |
| Zdalne połączenie Decision | Płatne żądania; jedna tura może wysłać kilka | Klucz API (TypeSafe lub OpenRouter) | Telefony i komputery bez lokalnego modelu |
| Instalowany model decyzyjny | Osobne miejsce na dysku i pamięć GPU; zobacz [rozmiary modeli](#let-marinara-install-a-decision-model) | Linux x86-64 i obsługiwany procesor graficzny NVIDIA | Osobny model decyzyjny obok modelu czatu |

**W systemie Android (Termux)** instalowany model decyzyjny nie działa, ponieważ wymaga komputera z procesorem graficznym NVIDIA. Mały model lokalny na procesorze telefonu także może być zbyt wolny, by zmieścić się w limicie czasu. Na telefonie praktycznym wyborem jest zdalne połączenie Decision, na przykład Jev przez OpenRouter. Zobacz [Konfiguracja połączenia Decision](#set-up-a-decision-connection).

Presety, karty i agenci powinny być pisane dla "modelu decyzyjnego", nigdy jako "wymaga Jev". Używają tej samej składni stwierdzeń niezależnie od wyboru użytkownika, ale różne modele mogą dawać różne odpowiedzi.

Przy imporcie treści korzystającej z decyzji Marinara pokazuje informację z linkiem do tego przewodnika. Dotyczy to niestandardowych agentów i instalacji z katalogu agentów. Bez wybranego modelu decyzyjnego informacja wyjaśnia zachowanie zastępcze: stwierdzenia w promptach oznaczają nie, wpisy lorebooka nie mogą aktywować się na podstawie decyzji, a pytania aktywacyjne przepuszczają agenta, kiedy pozwalają na to słowa kluczowe i **Trigger Cadence**. Ustaw agentowi także częstotliwość, jeśli bez modelu decyzyjnego nie powinien działać w każdej turze. Przywracanie całego profilu z ZIP nie pokazuje tej informacji importowej.

<a id="use-a-model-you-already-run"></a>

## Użycie już uruchomionego modelu

Jeśli masz lokalny model w **Local Model**, możesz używać go do decyzji bez tworzenia połączenia i opłat za żądania.

1. W **Connections** otwórz **Connection defaults** i ustaw **Decision model** na **Primary local model** albo **Utility local model**, jeśli jest skonfigurowany.
2. Kliknij **Test**. Udany wynik pokazuje prawdopodobieństwo i czas żądania oraz dwie informacje właściwe modelowi lokalnemu: dostępność logarytmów prawdopodobieństw i to, czy model odpowiada bezpośrednio.

Marinara zadaje jedno pytanie tak/nie, pozwala wygenerować jeden token i odczytuje odpowiedź z jego prawdopodobieństw. Żadna odpowiedź czatu nie powstaje, więc żądanie jest krótkie. Wybór spośród wielu odpowiedzi jest zadawany jako osobne pytanie tak/nie dla każdej opcji. Liczba mieszczących się ostatnich wiadomości jest wyliczana z rozmiaru kontekstu danego slotu.

**Rozumowanie.** Większość modeli odpowiada jednym słowem. Niektóre zawsze najpierw rozumują, niezależnie od pytania. Steruje tym ustawienie **Thinking** (rozumowanie) pod listą rozwijaną:

- **Auto** (automatycznie, domyślnie) próbuje szybkiej metody jednego słowa, a jeśli model dwa razy z rzędu tak nie odpowie, pozwala mu najpierw rozumować i informuje cię o tym.
- **Off** (wyłączone) zawsze używa metody jednego słowa. Model, który tak nie potrafi odpowiedzieć, nie daje odpowiedzi.
- **Allowed** (dozwolone) nigdy nie prosi modelu o pominięcie rozumowania.

Model rozumujący przed odpowiedzią potrzebuje sekund, więc domyślnie odpowiada tylko na potrzeby działań po wyświetleniu odpowiedzi, na przykład agentów przetwarzania końcowego. Przed odpowiedzią nie daje wyniku, chyba że włączysz **Also gate agents that run before the reply** (sprawdzaj także agentów działających przed odpowiedzią), przez co każda odpowiedź musi na niego czekać.

**Znaczenie liczb.** Prawdopodobieństwa tak/nie ogólnego modelu czatu nadają się do porównania z progiem, ale model nie był uczony kalibracji tak jak wyspecjalizowany model decyzyjny. Środowisko, które nie zwraca logarytmów prawdopodobieństw, odpowiada po prostu 1 lub 0. Dostosuj progi do własnych czatów zamiast ufać wartości domyślnej.

<a id="on-a-server-you-already-run"></a>

### Na już działającym serwerze

Model czatu uruchomiony w Ollama, LM Studio, llama.cpp lub innym serwerze zgodnym z OpenAI może odpowiadać na pytania decyzyjne bez ładowania drugiej kopii przez Marinara.

1. Otwórz połączenie **Custom** tego serwera i kliknij **Use this model for decisions** (używaj tego modelu do decyzji). Powstanie połączenie Decision ze źródłem **OpenAI-compatible chat model** (model czatu zgodny z OpenAI), z tym samym bazowym URL-em, modelem i kluczem. Możesz też utworzyć je ręcznie: połączenie Decision, to źródło, bazowy URL połączenia czatu (np. `http://localhost:11434/v1` dla Ollama) i nazwa udostępnianego modelu.
2. Wybierz je w **Decision model** i kliknij **Test**. Wynik wskazuje również, czy serwer zwrócił logarytmy prawdopodobieństw i czy model musiał najpierw rozumować.

Sposób odpytywania jest taki jak dla modelu lokalnego: jedno słowo tak/nie na stwierdzenie, odczytywane z jego prawdopodobieństw. Stwierdzenia są wysyłane pojedynczo, bo Marinara nie zna liczby równoległych żądań obsługiwanych przez serwer. **Thinking** dla połączenia to zawsze **Auto**: po dwóch nieudanych odpowiedziach model wymagający rozumowania przełącza się na ten tryb i ocenia tylko warunki po odpowiedzi, chyba że włączysz **Also gate agents that run before the reply**. Serwer na innym komputerze w sieci wymaga też `PROVIDER_LOCAL_URLS_ENABLED`, jak każdy lokalny dostawca; zobacz [Podłączanie lokalnego lub samodzielnie hostowanego modelu](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Konfiguracja połączenia Decision

1. W **Connections** utwórz połączenie z dostawcą **Decision** (decyzje).
2. Wybierz **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (własny punkt końcowy System One) lub **OpenAI-compatible chat model**. Źródła hostowane wymagają klucza API. TypeSafe wysyła żądania do `https://api.typesafe.ai`, chyba że w jego polu **Base URL** wpiszesz zamiast tego adres innego serwera udostępniającego API firmy TypeSafe, bez `/v1/systemone`; nadal potrzebuje twojego klucza TypeSafe, który trafia do tego serwera. Serwer na innym komputerze w sieci lokalnej wymaga `PROVIDER_LOCAL_URLS_ENABLED`, jak każdy lokalny dostawca; w systemie Android to ustawienie jest domyślnie włączone. Custom obsługuje działający serwer System One, w tym Open-Jev lub [Strands decider](#run-strands-decider-yourself): podaj bazowy URL bez `/v1/systemone` i obsługiwaną nazwę modelu. Serwery czatu, np. Ollama i LM Studio, nie używają System One: wybierz **OpenAI-compatible chat model**, zgodnie z [Na już działającym serwerze](#on-a-server-you-already-run).
3. Dla OpenRouter wybierz zapisane połączenie w **API key source** (źródło klucza API) lub wpisz oddzielny klucz. Edytor oferuje też **Use this key for decisions** (używaj tego klucza do decyzji), co konfiguruje Jev przez OpenRouter. Powiązane klucze automatycznie uwzględniają późniejsze zmiany. Połączenia Custom System One i OpenAI-compatible chat model mogą korzystać z klucza własnego połączenia czatu tylko wtedy, gdy oba URL-e mają to samo pochodzenie (schemat, host i port).
4. Zapisz, wybierz połączenie w **Decision model** i kliknij **Test**. Udany wynik pokazuje prawdopodobieństwo, czas odpowiedzi i limit czasu połączenia. Test czeka co najmniej 10 sekund, a przy dłuższym limicie 5 sekund ponad niego, żeby podać rzeczywisty czas powolnej odpowiedzi. Jeśli przekroczyła limit, wynik to zaznacza: na czacie zostałaby potraktowana jako brak odpowiedzi.

Domyślne połączenie Decision jest niezależne od domyślnych połączeń czatu, agentów, obrazów, filmów i dźwięku. Wybór **None** wyłącza decyzje bez usuwania pytań aktywacyjnych ani stwierdzeń decyzyjnych.

Zdalne decyzje wysyłają wybrane ostatnie wiadomości i stwierdzenia do wybranego dostawcy i mogą powodować opłaty. Smart response order dołącza też [listę postaci](#what-the-model-sees). **Recent-message token budget** (limit tokenów ostatnich wiadomości) wynosi domyślnie 30 000 szacowanych tokenów dla źródeł zdalnych i 3 500 dla własnych serwerów. Zmniejsz go, jeśli serwer ma mniejszy limit kontekstu. Marinara najpierw odrzuca starsze wiadomości, potem przycina najstarszą część najnowszej wiadomości. Szacunki tokenów mogą różnić się od tokenizera serwera; odrzucone lub zbyt duże żądanie nie daje odpowiedzi.

**Time limit (seconds)** (limit czasu w sekundach) określa, jak długo połączenie Decision czeka na odpowiedź dla każdego stwierdzenia podczas czatu: od 0,5 do 30 sekund, domyślnie 1,5 lub 4 dla **OpenAI-compatible chat model**. Żądanie z kilkoma stwierdzeniami otrzymuje ten czas na każde z nich. Późniejsza odpowiedź liczy się jako brak odpowiedzi. Niektórzy hostowani dostawcy czasem przekraczają 1,5 sekundy, co wygląda jak losowe awarie: uruchom **Test** kilka razy i ustaw limit powyżej najwolniejszego wyniku. Ceną jest opóźnienie odpowiedzi czatu: każde stwierdzenie sprawdzane wcześniej, np. decyzja w presecie lub pytanie aktywacyjne agenta działającego przed odpowiedzią, może ją wstrzymać na cały ten czas.

Usunięcie połączenia dostarczającego powiązany klucz pokazuje ostrzeżenie i wymaga ponownego powiązania połączenia Decision. Importowane samodzielne pliki połączeń także wymagają odtworzenia kluczy lub powiązań; nigdy nie zawierają kluczy API ani identyfikatorów połączeń użyczających klucza.

<a id="run-strands-decider-yourself"></a>

### Samodzielne uruchamianie Strands decider

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) to kolejny otwarty model decyzyjny (Apache-2.0) obsługujący System One. Marinara nie może go zainstalować, ale działa on jako **Custom System One endpoint**, dopóki utrzymujesz go w działaniu.

1. W środowisku z Python 3.10 lub nowszym zainstaluj go i uruchom serwer:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Jeśli znajdzie GPU NVIDIA lub Apple silicon, używa tego sprzętu; w przeciwnym razie działa wolniej na procesorze. Pierwsze uruchomienie pobiera model i około 4,6 GB wag bazowych, a pakiety Python zajmują około 5,5 GB. Serwer nie ma hasła, więc pozostaw go na `127.0.0.1`.
2. Utwórz połączenie decyzyjne ze źródłem **Custom System One endpoint** i bazowym URL-em `http://127.0.0.1:8000`. Działa dowolna nazwa modelu.
3. Wybierz je w **Decision model** i kliknij **Test**. Pierwsza odpowiedź po uruchomieniu zajmuje około 2 sekund, dłużej niż domyślny **Time limit**, więc przetestuj model raz przed rozpoczęciem czatu.

Jego prawdopodobieństwa są skalibrowane, więc domyślny próg 0,5 dla własnego połączenia jest odpowiedni, inaczej niż przy samodzielnie hostowanym Open-Jev (zobacz [Progi](#thresholds)). W małym teście Roleplay obejmującym 80 stwierdzeń na RTX 5090 odpowiedział poprawnie na 73, wobec 74 dla Open-Jev 2B, i zużył około 5,1 GB (4,7 GiB) pamięci GPU. Od jednego do ośmiu stwierdzeń zajęło mu od 0,04 do 0,1 sekundy, wobec 0,1 do 0,14 dla Open-Jev 2B; przy długim czacie oba modele potrzebowały około 0,3 sekundy. Jego odpowiedzi silniej zależą od sformułowania, więc stosuj wskazówki z [Pisania stwierdzeń](../prompts/conditional-prompts.md#writing-statements) i testuj tury z własnych czatów.

Aby przełączać się między nim a Decision sidecar, wybierz jeden z nich w **Decision model**. Oba pozostają skonfigurowane.

<a id="let-marinara-install-a-decision-model"></a>

## Instalacja modelu decyzyjnego przez aplikację Marinara

Marinara może również pobrać i uruchomić wyspecjalizowany model decyzyjny. Działa on jako osobny lokalny proces niezależnie od tego, czy uruchamiasz też lokalny model czatu. Jego zużycie pamięci dodaje się do zużycia modelu czatu. Jeśli masz już lokalny model, sprawdź jego decyzje przed pobraniem kolejnego.

Wbudowane modele Open-Jev wymagają systemu Linux **x86-64**, procesora graficznego NVIDIA o compute capability 7.5 lub nowszym (Turing, seria RTX 20 lub późniejsza) i sterownika 580 lub nowszego. Te pakiety nie obsługują urządzeń Linux ARM ani kart Pascal i starszych. Gdy model nie może działać, opcja pozostaje widoczna, wyjaśnia przyczynę i proponuje zamiast tego konfigurację połączenia Decision.

| Wbudowany model | Pobierany model | Dysk ze środowiskiem uruchomieniowym | Pamięć GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Około 4,6 GB | Około 10 GB | Około 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Około 19,4 GB | Około 25,3 GB | Około 23,6 GB (22 GiB) |

To szacunki katalogu oparte na przypiętych wersjach modeli i zmierzonych obciążeniach. Zużycie GPU i szybkość zależą od obciążenia. Model 9B pozostawia niewielki zapas na karcie 24 GB; sprawdź ocenę instalatora dla wybranej karty i innych uruchomionych modeli.

1. Otwórz **Connections**, rozwiń **Local Model** i wybierz **Decision sidecar (experimental)** (eksperymentalny osobny proces decyzyjny).
2. Przeczytaj ostrzeżenie i włącz **Enable decision sidecar** (włącz osobny proces decyzyjny). Potwierdzenie pokazuje ocenę komputera, a przy ostrzeżeniu przycisk ma etykietę **Enable anyway** (włącz mimo to).
3. Wybierz model i potwierdź jego rozmiar, ocenę sprzętu i licencje. Do tego momentu nic nie jest pobierane. **Open-Jev 2B** wymaga znacznie mniej pamięci niż **Open-Jev 9B**; żaden nie gwarantuje poprawnych odpowiedzi dla twojego czatu.
4. Wybierz **Decision sidecar** w **Decision model**.

**Szybkość.** Pierwsza odpowiedź po uruchomieniu modelu jest wolniejsza, więc Marinara podczas ładowania zadaje pytanie rozgrzewające. Jeśli się powiedzie, **Test** i pierwsza tura pokazują normalną szybkość. Jeśli nie, model i tak się uruchamia, a opóźnienie dotyczy pierwszego pytania. Każde stwierdzenie ponownie czyta ostatni czat, dlatego wiele stwierdzeń w długim czacie wydłuża turę: Open-Jev 2B potrzebuje wtedy około ćwierci sekundy na stwierdzenie.

Możesz też wkleić repozytorium modelu decyzyjnego z serwisu HuggingFace. Marinara czyta jego manifest, sprawdza, czy typ artefaktu odpowiada środowisku dostarczanemu w tej wersji aplikacji, i pokazuje bazowe wagi do pobrania oraz łączny rozmiar przed zaproponowaniem instalacji. Repozytorium, którego nie potrafi zweryfikować, zostaje odrzucone z podaniem przyczyny zamiast instalacji na próbę.

Na komputerze z kilkoma procesorami graficznymi NVIDIA menu **GPU** wybiera kartę, na której model się ładuje. Oceny dotyczą tej karty, a jej zmiana zatrzymuje model, żeby uruchomił się na nowej.

Wyłączenie procesu sidecar zatrzymuje go i zachowuje pliki. **Remove files** (usuń pliki) usuwa model i jego środowisko uruchomieniowe; opcja pozostaje dostępna, gdy sidecar jest wyłączony.

<a id="thresholds"></a>

## Progi

Prawdopodobieństwa nie są bezpośrednio porównywalne między modelami. Ten sam pozytywny przykład może uzyskać 0,99 w jednym modelu i 0,2 w innym. Domyślny próg w aplikacji Marinara zależy od sposobu połączenia modelu:

| Wybrany backend | Domyślny próg tak/nie |
| --- | --- |
| Lokalny model czatu Primary lub Utility albo połączenie z modelem czatu zgodnym z OpenAI | 0,5 |
| Połączenie Decision TypeSafe, OpenRouter lub Custom System One | 0,5 |
| Zarządzany Decision sidecar | Zalecenie z manifestu modelu; 0,1 dla wbudowanych Open-Jev 2B i 9B |

Ustawienie **Run when probability is at least** (uruchom, gdy prawdopodobieństwo wynosi co najmniej) agenta może nadpisać tę wartość. Edytor proponuje przywrócenie zalecenia backendu, gdy zapisana wartość jest inna. Sprawdzaj ustawienie po każdej zmianie modelu.

Stwierdzenia w promptach i pola Decision lorebooka używają domyślnego progu backendu; zmiana progu agenta ich nie zmienia. **Samodzielnie uruchomiony Open-Jev przez połączenie Custom System One nadal używa 0,5.** Marinara nie rozpoznaje i nie kalibruje automatycznie dowolnych własnych punktów końcowych. Wyniki mogą więc różnić się od zarządzanego Open-Jev sidecar, w tym traktować pozytywny wynik poniżej 0,5 jako nie.

<a id="time-limits"></a>

## Limity czasu

Decyzja, która nie dotrze na czas, oznacza brak odpowiedzi. Generowanie trwa dalej z [zachowaniem zastępczym danej funkcji](#where-marinara-uses-it); może to pominąć gałąź promptu albo wymagany wpis lorebooka.

Każdy limit dotyczy pojedynczego stwierdzenia. Żądanie z kilkoma stwierdzeniami otrzymuje limit na każde; każda odpowiedź Choice liczy się jako stwierdzenie. Model lokalny obsługuje tylko kilka żądań naraz: stwierdzenia czekają w kolejce, a czas zaczyna biec dopiero po rozpoczęciu ich przetwarzania.

- **1,5 sekundy** na stwierdzenie dla połączenia Decision TypeSafe, OpenRouter lub Custom System One, chyba że zmienisz **Time limit**. Zobacz [Konfiguracja połączenia Decision](#set-up-a-decision-connection).
- **4 sekundy** na stwierdzenie dla połączenia z modelem czatu zgodnym z OpenAI, chyba że zmienisz **Time limit**. Model wymagający rozumowania otrzymuje co najmniej 20 sekund.
- **4 sekundy** na stwierdzenie dla modelu lokalnego.
- **4 sekundy** na pierwsze stwierdzenie pomocniczego procesu decyzyjnego. Każde kolejne otrzymuje zmierzony czas modelu: 0,35 sekundy dla Open-Jev 2B i 0,8 dla Open-Jev 9B. Model zainstalowany przez wklejenie repozytorium otrzymuje po 4 sekundy.
- **20 sekund** na stwierdzenie dla modelu lokalnego wymagającego rozumowania.

Anulowanie generowania zatrzymuje żądania decyzyjne.

## Inne ustawienia w sekcji Decision model

- **Also use it to pick who speaks in Smart response order.** (używaj także do wyboru mówiącego w kolejności Smart). Domyślnie wyłączone. Zobacz [Czaty grupowe](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (stwierdzenia decyzyjne na turę). Ogranicza planowanie stwierdzeń w promptach i lorebookach, domyślnie do 32, maksymalnie do 255. Limit stosuje się na kilku etapach; nie jest jednym limitem wszystkich żądań Decision ani wydatków w turze. Pytania aktywacyjne agentów i Smart response order są oddzielne. Zakres, grupowanie i priorytety opisuje [Limity i koszty](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** i **Thinking** pojawiają się dla **Primary local model** oraz **Utility local model**. Pomocniczy proces decyzyjny nigdy nie rozumuje, więc nie ma tych opcji. Zobacz [Używanie już uruchomionego modelu](#use-a-model-you-already-run).

## Dokładność: uwzględnij błędne odpowiedzi

Każdy model może się mylić. W małym teście sformułowań opisanym wyżej kilka poprawnych odpowiedzi "tak" modelu Open-Jev 2B mieściło się tylko nieznacznie powyżej progu. Uwzględnij pominięte i błędne odpowiedzi:

- Używaj decyzji do dopracowania odpowiedzi, nigdy do czegoś niezbędnego dla czatu. Pominięta decyzja powinna uczynić odpowiedź trochę mniej dopasowaną, a nie ją zepsuć.
- Nie uzależniaj zgody, ostrzeżeń o treści ani instrukcji bezpieczeństwa od decyzji.
- Dla agenta działającego tylko na podstawie pytania aktywacyjnego ustaw **Bypass the question after this many messages** (pomiń pytanie po tylu wiadomościach), żeby model stale odpowiadający "nie" nie wyciszył go na zawsze.

Przykłady sformułowań i sposób sprawdzania ich na własnych czatach znajdziesz w [Pisaniu stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

## Rozwiązywanie problemów

- **Test kończy się błędem.** Komunikat podaje przyczynę: odrzucony klucz, limit żądań dostawcy, nieuruchomiony model lokalny, niezainstalowany model decyzyjny, odpowiedź inna niż tak/nie lub przekroczony czas.
- **Test zgłasza brak takiego punktu końcowego na serwerze.** Źródło Decision nie pasuje do serwera. Ollama, LM Studio i inne serwery czatu wymagają **OpenAI-compatible chat model**; **Custom System One endpoint** jest tylko dla serwerów System One, takich jak Open-Jev.
- **Test zgłasza przekroczony limit czasu albo decyzje działają tylko czasami.** Dostawca przynajmniej czasami odpowiada wolniej niż **Time limit** połączenia. Wykonaj kilka testów i zwiększ limit ponad najwolniejszy wynik.
- **Agent z pytaniem aktywacyjnym działa w każdej turze.** Model decyzyjny nie jest wybrany albo nie odpowiada, więc agent działa tak, jakby nie miał pytania. Sprawdź **Test**.
- **Gałąź decyzyjna promptu nigdy się nie pojawia.** Zobacz [Gdy gałąź decyzyjna nigdy się nie pojawia](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order nadal wykonuje zwykłe wywołanie AI.** Przełącznik jest wyłączony albo model decyzyjny nie odpowiedział w tej turze.
- **Aby zobaczyć wyniki i dane wyjściowe decyzji podczas generowania**, włącz Debug Mode lub poziom logowania debug. Logi decyzji promptu zawierają progi, wyniki i informację o ponownym użyciu lub podtrzymaniu odpowiedzi przez reguły czasowe. Zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels).
- **Aby przetestować własne stwierdzenia bez generowania odpowiedzi**, otwórz **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnostyka decyzji → testuj decyzje). Podglądy wejścia są pasywne; jawne testy wywołują wybrany model i mogą powodować opłaty u dostawcy hostowanego. Zobacz [Testowanie stwierdzeń decyzyjnych](../chats/peek-prompt.md#testing-decision-statements).

## Powiązane przewodniki

- [Tworzenie własnych agentów](../agents/custom-agents.md)
- [Prompty warunkowe](../prompts/conditional-prompts.md)
- [Czaty grupowe](../chats/group-chats.md)
- [Konfiguracja modelu lokalnego](local-model.md)
- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
