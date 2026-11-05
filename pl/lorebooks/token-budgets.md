# Limity tokenów i rekurencja w lorebookach

Limity ograniczają, ile tekstu z lorebooków trafia do AI, żeby lorebooki nie wypierały samego czatu. Ten przewodnik omawia pola **Token Budget** (limit tokenów) i **Entry Limit** (limit wpisów) każdego lorebooka, pole **Lorebook Token Budget** (limit tokenów lorebooków) czatu, sposób, w jaki Marinara przycina wpisy, oraz skanowanie **Recursive** (rekurencyjne).

Tokeny to małe kawałki tekstu, które liczą modele. Okno kontekstu modelu to ilość tekstu, jaką model potrafi przeczytać naraz, liczona w tokenach. Tekst z lorebooków dzieli to okno z resztą promptu (tekstu, który Marinara wysyła do AI).

## Dwa limity tokenów

Marinara stosuje dwa limity przy każdym budowaniu promptu. Wpis zostaje pominięty, jeśli przekroczyłby którykolwiek z nich.

- Każdy lorebook ma własne pole **Token Budget**: największa liczba tokenów, jaką ten lorebook może dodać do jednej odpowiedzi.
- Każdy czat ma jedno pole **Lorebook Token Budget**: największa liczba tokenów, jaką wszystkie aktywne lorebooki mogą dodać łącznie.

## Ustawianie pól Token Budget i Entry Limit w lorebooku

1. Otwórz lorebook z panelu **Lorebooks** (lorebooki).
2. Kliknij zakładkę **Overview** (przegląd).
3. Ustaw pola **Token Budget** i **Entry Limit**.

| Ustawienie | Domyślnie | Działanie |
| --- | --- | --- |
| **Token Budget** | 2048 | Największa liczba tokenów, jaką ten lorebook dodaje w jednej odpowiedzi. 0 oznacza brak limitu. |
| **Entry Limit** | 100 | Największa liczba wpisów, jaką ten lorebook dodaje w jednej odpowiedzi. Zakres od 1 do 1000. |

Pole **Entry Limit** liczy wpisy, a nie tokeny. Lorebook przestaje dodawać wpisy, gdy osiągnie którykolwiek z limitów.

Przykładowo przy polu **Token Budget** ustawionym na 2048 pojedynczy wpis o długości 3000 tokenów nigdy nie zostanie dodany. Zmniejsz limit, jeśli lorebook zajmuje za dużo miejsca. Zwiększ go, jeśli ważne wpisy stale są pomijane.

## Ustawianie pola Lorebook Token Budget w czacie

1. Otwórz czat.
2. Otwórz **Chat Settings** (ustawienia czatu).
3. Znajdź sekcję **Lorebooks** i ustaw pole **Lorebook Token Budget**.

Domyślna wartość to 8192, a 0 oznacza brak limitu. To łączny limit dla wszystkich lorebooków aktywnych w tym czacie, działający dodatkowo, obok własnego pola **Token Budget** każdego lorebooka.

## Jak przebiega przycinanie wpisów

Kiedy pasujących wpisów jest więcej, niż mieści limit, Marinara dodaje wpisy w tej kolejności.

1. Wpisy **Constant** (stałe).
2. Wpisy, które pasowały do ostatnich wiadomości.
3. Pozostałe wpisy, w kolejności wstawiania (pole **Order** wpisu).

Marinara dodaje każdy wpis, który jeszcze się mieści. Gdy któryś się nie mieści, Marinara go pomija i dalej sprawdza pozostałe, więc mniejszy wpis nadal może się zmieścić po pominięciu większego.

<a id="seeing-skipped-entries-in-active-context"></a>

## Podgląd pominiętych wpisów w Active Context

1. Otwórz **Chat Settings**.
2. Rozwiń sekcję **Active Context** (aktywny kontekst). Pokazuje ona wynik ostatniego skanowania lorebooków.

Jeśli pominięto jakieś pasujące wpisy, na górze pojawia się komunikat "N matching lore entries were skipped by token budget." Wymienia on każdy limit, przez który pominięto wpisy, i podaje, gdzie go zmienić. Rozwiń go, żeby zobaczyć każdy pominięty wpis, jego lorebook, dopasowane słowa kluczowe, szacowany rozmiar i to, ile limitu było już zajęte. Powód jest jeden z poniższych.

| Powód | Znaczenie |
| --- | --- |
| **lorebook budget** | Wpis nie zmieścił się w polu **Token Budget** tego lorebooka. |
| **chat budget** | Wpis nie zmieścił się w polu **Lorebook Token Budget** czatu. |
| **lorebook and chat budgets** | Oba limity były już wyczerpane. |
| **current-location context cap** | Wpis jest przypięty do bieżącej lokalizacji na mapie, która ma własny, stały limit 2 048 tokenów. |

Wpis z pustą treścią albo z treścią, którą makra zamieniają w nic, nie trafia na tę listę. Jego makra nadal się wykonują, więc `{{setvar}}` w takim wpisie wciąż ustawia zmienną. Gdy oba limity mają wartość 0, pominięte wpisy może tu pokazać tylko limit lokalizacji.

Jeśli duże lorebooki stale są pomijane, **Active Context** proponuje agentów **Knowledge Retrieval** lub **Knowledge Router**. Zobacz [Źródła wiedzy](../agents/knowledge-sources.md). Często radzą sobie z dużymi lorebookami lepiej niż wyższy limit.

## Skanowanie rekurencyjne

Normalnie Marinara szuka słów kluczowych tylko w twoich ostatnich wiadomościach. Przy włączonej opcji **Recursive** przegląda też treść wpisów, które właśnie się aktywowały, więc jeden wpis może wciągnąć powiązane wpisy.

1. Otwórz lorebook i kliknij **Overview**.
2. Włącz przełącznik **Recursive**. Domyślnie jest wyłączony.
3. Ustaw pole **Max Depth** (maksymalna głębokość), jeśli chcesz zmienić zasięg łańcucha.

Pole **Max Depth** to liczba dodatkowych przebiegów skanowania. Domyślnie wynosi 3, a zakres to od 1 do 10. Wyższe wartości wyłapują więcej powiązanej wiedzy i wymagają więcej przetwarzania.

Każdy wpis ma też własny przełącznik **Recursion** (rekurencja), domyślnie wyłączony, który decyduje, czy treść tego wpisu może wyzwalać kolejne wpisy. Zostaw go wyłączony, chyba że wpis ma prowadzić do kolejnych wpisów. Zobacz [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md).

Rekurencja nie omija limitów. Wpisy znalezione w przebiegu rekurencyjnym liczą się do pól **Token Budget** i **Entry Limit** oraz do pola **Lorebook Token Budget** czatu.

## Powiązane przewodniki

- [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md)
- [Lorebooki – przegląd](overview.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
