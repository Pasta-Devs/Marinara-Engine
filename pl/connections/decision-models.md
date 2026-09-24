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

## Wybór modelu decyzyjnego

Otwórz **Connections** (połączenia), następnie **Connection defaults** (domyślne połączenia) i wybierz model w **Decision model**. Lista ma trzy grupy:

- **None** (brak), ustawienie domyślne. Żadne pytania nie są wysyłane, a pola pytań aktywacyjnych w edytorze agenta pozostają wyłączone.
- **Local models** (modele lokalne): uruchomiony już **Primary local model** (główny model lokalny) lub **Utility local model** (pomocniczy model lokalny). Nic nie jest pobierane i nic nie opuszcza komputera. Zainstalowany **Decision sidecar** (osobny proces decyzyjny) też znajduje się w tej grupie.
- **Connections**: dowolne utworzone połączenie Decision, zdalne lub uruchamiane samodzielnie.

Pozycje, które nie mogą teraz odpowiadać, pozostają na liście wyszarzone wraz z przyczyną, dzięki czemu wiadomo, co naprawić. Po wyborze kliknij **Test** (test). Test wysyła stały przykład, a nie twój czat.

### Co wybrać

Jeśli masz już uruchomiony model lokalny, zacznij od niego. W małym teście sformułowań z jednej sceny roleplay Gemma 4 E4B poprawnie oceniła 32 z 32 zalecanych stwierdzeń, a Open-Jev 2B i 9B po 31. To przykład znaczenia sformułowań, a nie ogólny ranking dokładności. Sprawdź reprezentatywne tury własnych czatów; zobacz [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

**Jev i Open-Jev to różne modele.** Jev to zdalny model firmy TypeSafe, dostępny bezpośrednio lub przez OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) to osobno opublikowany model oparty na Qwen, który Marinara może uruchomić lokalnie. Testy sformułowań Open-Jev nie mierzą dokładności zdalnego Jev.

| Opcja | Koszty | Wymagania | Dla kogo |
| --- | --- | --- | --- |
| Już uruchomiony model | Bez dodatkowych kosztów | Model lokalny w **Local Model** (model lokalny) | Większość osób używających lokalnego modelu |
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

<a id="set-up-a-decision-connection"></a>

## Konfiguracja połączenia Decision

1. W **Connections** utwórz połączenie z dostawcą **Decision** (decyzje).
2. Wybierz **TypeSafe**, **OpenRouter** albo **Custom System One endpoint** (własny punkt końcowy System One). Źródła zdalne wymagają klucza API. Custom obsługuje już uruchomiony serwer System One, w tym Open-Jev; wpisz jego bazowy adres URL bez `/v1/systemone` i obsługiwaną nazwę modelu.
3. Dla OpenRouter wybierz zapisane połączenie OpenRouter w **API key source** (źródło klucza API) albo wpisz osobny klucz. Jego edytor oferuje też **Use this key for decisions (Jev)** (użyj tego klucza do decyzji Jev). Powiązane klucze automatycznie uwzględniają późniejsze zmiany. Własne połączenia mogą pożyczyć klucz własnego połączenia czatu tylko wtedy, gdy oba adresy mają to samo pochodzenie (schemat, host i port).
4. Zapisz, wybierz połączenie w **Decision model** i kliknij **Test**. Udany wynik pokazuje prawdopodobieństwo, czas odpowiedzi i limit czasu połączenia. Test czeka co najmniej 10 sekund, a przy dłuższym limicie 5 sekund ponad niego, żeby podać rzeczywisty czas powolnej odpowiedzi. Jeśli przekroczyła limit, wynik to zaznacza: na czacie zostałaby potraktowana jako brak odpowiedzi.

Domyślne połączenie Decision jest niezależne od domyślnych połączeń czatu, agentów, obrazów, filmów i dźwięku. Wybór **None** wyłącza decyzje bez usuwania pytań aktywacyjnych ani stwierdzeń decyzyjnych.

Zdalne decyzje wysyłają wybrane ostatnie wiadomości i stwierdzenia do wybranego dostawcy i mogą powodować opłaty. Smart response order dołącza też [listę postaci](#what-the-model-sees). **Recent-message token budget** (limit tokenów ostatnich wiadomości) wynosi domyślnie 30 000 szacowanych tokenów dla źródeł zdalnych i 3 500 dla własnych serwerów. Zmniejsz go, jeśli serwer ma mniejszy limit kontekstu. Marinara najpierw odrzuca starsze wiadomości, potem przycina najstarszą część najnowszej wiadomości. Szacunki tokenów mogą różnić się od tokenizera serwera; odrzucone lub zbyt duże żądanie nie daje odpowiedzi.

**Time limit (seconds)** (limit czasu w sekundach) określa, jak długo każde połączenie Decision czeka na odpowiedź na czacie: od 0,5 do 30 sekund (domyślnie 1,5). Późniejszy wynik oznacza brak odpowiedzi. Niektórzy zdalni dostawcy bywają wolniejsi niż 1,5 sekundy, co może wyglądać jak losowe awarie decyzji, więc kliknij **Test** kilka razy i ustaw limit powyżej najwolniejszej odpowiedzi. Koszt takiej zmiany: stwierdzenie zadane przed odpowiedzią, na przykład w presecie lub pytaniu aktywacyjnym wcześniejszego agenta, może opóźnić odpowiedź o cały ten czas.

Usunięcie połączenia dostarczającego powiązany klucz pokazuje ostrzeżenie i wymaga ponownego powiązania połączenia Decision. Importowane samodzielne pliki połączeń także wymagają odtworzenia kluczy lub powiązań; nigdy nie zawierają kluczy API ani identyfikatorów połączeń użyczających klucza.

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

Możesz też wkleić repozytorium modelu decyzyjnego z serwisu HuggingFace. Marinara czyta jego manifest, sprawdza, czy typ artefaktu odpowiada środowisku dostarczanemu w tej wersji aplikacji, i pokazuje bazowe wagi do pobrania oraz łączny rozmiar przed zaproponowaniem instalacji. Repozytorium, którego nie potrafi zweryfikować, zostaje odrzucone z podaniem przyczyny zamiast instalacji na próbę.

Na komputerze z kilkoma procesorami graficznymi NVIDIA menu **GPU** wybiera kartę, na której model się ładuje. Oceny dotyczą tej karty, a jej zmiana zatrzymuje model, żeby uruchomił się na nowej.

Wyłączenie procesu sidecar zatrzymuje go i zachowuje pliki. **Remove files** (usuń pliki) usuwa model i jego środowisko uruchomieniowe; opcja pozostaje dostępna, gdy sidecar jest wyłączony.

<a id="thresholds"></a>

## Progi

Prawdopodobieństwa nie są bezpośrednio porównywalne między modelami. Ten sam pozytywny przykład może uzyskać 0,99 w jednym modelu i 0,2 w innym. Domyślny próg w aplikacji Marinara zależy od sposobu połączenia modelu:

| Wybrany backend | Domyślny próg tak/nie |
| --- | --- |
| Główny lub pomocniczy lokalny model czatu | 0,5 |
| Połączenie Decision TypeSafe, OpenRouter lub Custom System One | 0,5 |
| Zarządzany Decision sidecar | Zalecenie z manifestu modelu; 0,1 dla wbudowanych Open-Jev 2B i 9B |

Ustawienie **Run when probability is at least** (uruchom, gdy prawdopodobieństwo wynosi co najmniej) agenta może nadpisać tę wartość. Edytor proponuje przywrócenie zalecenia backendu, gdy zapisana wartość jest inna. Sprawdzaj ustawienie po każdej zmianie modelu.

Stwierdzenia w promptach i pola Decision lorebooka używają domyślnego progu backendu; zmiana progu agenta ich nie zmienia. **Samodzielnie uruchomiony Open-Jev przez połączenie Custom System One nadal używa 0,5.** Marinara nie rozpoznaje i nie kalibruje automatycznie dowolnych własnych punktów końcowych. Wyniki mogą więc różnić się od zarządzanego Open-Jev sidecar, w tym traktować pozytywny wynik poniżej 0,5 jako nie.

<a id="time-limits"></a>

## Limity czasu

Decyzja, która nie dotrze na czas, oznacza brak odpowiedzi. Generowanie trwa dalej z [zachowaniem zastępczym danej funkcji](#where-marinara-uses-it); może to pominąć gałąź promptu albo wymagany wpis lorebooka.

- **1,5 sekundy** dla połączenia Decision, chyba że zmienisz jego **Time limit** (limit czasu). Zobacz [Konfiguracja połączenia Decision](#set-up-a-decision-connection).
- **4 sekundy** dla modelu lokalnego lub procesu decyzyjnego sidecar. Gdy jedna tura zadaje wiele stwierdzeń, Open-Jev 9B otrzymuje trochę więcej czasu na każde dodatkowe.
- **20 sekund** dla modelu lokalnego, który musi najpierw rozumować.

Anulowanie generowania zatrzymuje żądania decyzyjne.

## Inne ustawienia w sekcji Decision model

- **Also use it to pick who speaks in Smart response order.** (używaj także do wyboru mówiącego w kolejności Smart). Domyślnie wyłączone. Zobacz [Czaty grupowe](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (stwierdzenia decyzyjne na turę). Ogranicza planowanie stwierdzeń w promptach i lorebookach, domyślnie do 32, maksymalnie do 255. Limit stosuje się na kilku etapach; nie jest jednym limitem wszystkich żądań Decision ani wydatków w turze. Pytania aktywacyjne agentów i Smart response order są oddzielne. Zakres, grupowanie i priorytety opisuje [Limity i koszty](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** i **Thinking** pojawiają się dla modelu lokalnego. Zobacz [Użycie już uruchomionego modelu](#use-a-model-you-already-run).

## Dokładność: uwzględnij błędne odpowiedzi

Każdy model może się mylić. W małym teście sformułowań opisanym wyżej kilka poprawnych odpowiedzi "tak" modelu Open-Jev 2B mieściło się tylko nieznacznie powyżej progu. Uwzględnij pominięte i błędne odpowiedzi:

- Używaj decyzji do dopracowania odpowiedzi, nigdy do czegoś niezbędnego dla czatu. Pominięta decyzja powinna uczynić odpowiedź trochę mniej dopasowaną, a nie ją zepsuć.
- Nie uzależniaj zgody, ostrzeżeń o treści ani instrukcji bezpieczeństwa od decyzji.
- Dla agenta działającego tylko na podstawie pytania aktywacyjnego ustaw **Bypass the question after this many messages** (pomiń pytanie po tylu wiadomościach), żeby model stale odpowiadający "nie" nie wyciszył go na zawsze.

Przykłady sformułowań i sposób sprawdzania ich na własnych czatach znajdziesz w [Pisaniu stwierdzeń](../prompts/conditional-prompts.md#writing-statements).

## Rozwiązywanie problemów

- **Test kończy się błędem.** Komunikat podaje przyczynę: odrzucony klucz, limit żądań dostawcy, nieuruchomiony model lokalny, niezainstalowany model decyzyjny, odpowiedź inna niż tak/nie lub przekroczony czas.
- **Test zgłasza przekroczony limit czasu albo decyzje działają tylko czasami.** Dostawca przynajmniej czasami odpowiada wolniej niż **Time limit** połączenia. Wykonaj kilka testów i zwiększ limit ponad najwolniejszy wynik.
- **Agent z pytaniem aktywacyjnym działa w każdej turze.** Model decyzyjny nie jest wybrany albo nie odpowiada, więc agent działa tak, jakby nie miał pytania. Sprawdź **Test**.
- **Gałąź decyzyjna promptu nigdy się nie pojawia.** Zobacz [Gdy gałąź decyzyjna nigdy się nie pojawia](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order nadal wykonuje zwykłe wywołanie AI.** Przełącznik jest wyłączony albo model decyzyjny nie odpowiedział w tej turze.
- **Aby zobaczyć każde stwierdzenie i jego odpowiedź**, ustaw poziom logowania na debug. Zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels).

## Powiązane przewodniki

- [Tworzenie własnych agentów](../agents/custom-agents.md)
- [Prompty warunkowe](../prompts/conditional-prompts.md)
- [Czaty grupowe](../chats/group-chats.md)
- [Konfiguracja modelu lokalnego](local-model.md)
- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
