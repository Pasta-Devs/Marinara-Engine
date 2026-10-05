# Limity tokenów i rekurencja w lorebookach

Z tego przewodnika dowiesz się, jak Marinara Engine ogranicza ilość tekstu z lorebooków, który trafia do AI. Omawia pola **Token Budget** (limit tokenów) i **Entry Limit** (limit wpisów) w każdym lorebooku oraz wspólny dla całego czatu **Lorebook Token Budget** (limit tokenów lorebooków). Wyjaśnia też, jak Marinara przycina wpisy po wyczerpaniu limitu i do czego służy skanowanie **Recursive** (rekurencyjne).

Token to mały kawałek tekstu, mniej więcej kilka znaków. Każdy model ma ograniczone okno kontekstu, czyli łączną ilość tekstu, jaką potrafi przeczytać naraz. Limity pilnują, żeby lorebooki nie zapełniły tego okna i nie wypchnęły z niego samej rozmowy.

## Dwa limity tokenów

Przy każdym budowaniu promptu Marinara sprawdza dwa niezależne limity tokenów. Wpis zostaje pominięty, jeśli przekroczyłby którykolwiek z nich.

1. Każdy lorebook ma własne pole **Token Budget**. Ogranicza ono, ile tekstu ten jeden lorebook może dołożyć do jednej odpowiedzi.
2. Czat ma jedno pole **Lorebook Token Budget**. Ogranicza ono łączny tekst ze wszystkich lorebooków aktywnych w tym czacie.

Oba limity działają jednocześnie. Pojedynczy wpis może zostać zablokowany przez limit lorebooka, limit czatu albo przez oba naraz.

## Ustawianie pól Token Budget i Entry Limit w lorebooku

Otwórz lorebook w panelu **Lorebooks** (lorebooki), a potem przejdź do zakładki **Overview** (przegląd). Obok ustawień skanowania widać dwa pola liczbowe.

- **Token Budget** (domyślnie **2048**): największa liczba tokenów, jaką ten lorebook może dołożyć do jednej odpowiedzi. Wartość **0** oznacza brak limitu.
- **Entry Limit** (domyślnie **100**): największa liczba wpisów, jaką ten lorebook może dołożyć do jednej odpowiedzi. Zakres to od **1** do **1000**.

Pole **Entry Limit** to limit niezależny od limitu tokenów. Liczy wpisy, a nie tokeny. Nawet gdy w limicie tokenów zostaje jeszcze miejsce, lorebook przestaje dokładać wpisy po osiągnięciu tej granicy. Odwrotnie też: limit tokenów może pomijać wpisy, choć lorebook nie dobił jeszcze do wartości **Entry Limit**.

Weź na przykład lorebook z polem **Token Budget** ustawionym na **2048** i jednym wpisem o długości 3000 tokenów. Taki lorebook nigdy nie doda tego wpisu. Zmniejszaj limit tylko wtedy, gdy lorebook zajmuje za dużo miejsca. Zwiększ go, jeśli ważne wpisy stale są pomijane.

## Wspólny dla czatu Lorebook Token Budget

Limit na poziomie czatu znajdziesz w panelu bocznym **Settings** (ustawienia) danego czatu, w sekcji **Lorebooks**.

1. Otwórz czat.
2. Otwórz panel boczny **Settings** czatu.
3. Znajdź sekcję **Lorebooks**.
4. Ustaw pole **Lorebook Token Budget**.

Domyślna wartość to **8192**. Wartość **0** oznacza brak limitu. Ten limit obejmuje wszystkie lorebooki aktywne w tym czacie. Działa dodatkowo, obok własnego pola **Token Budget** każdego lorebooka.

## Jak przebiega przycinanie wpisów

Kiedy pasujących wpisów jest więcej, niż mieści limit, Marinara zachowuje najważniejsze, a resztę odrzuca. Przed przycięciem sortuje wpisy, żeby przetrwały te najbardziej potrzebne.

- Najpierw idą wpisy **Constant** (stałe). To wpisy ustawione tak, aby były wstawiane zawsze, gdy lorebook jest aktywny.
- Dalej wpisy, które pasowały do twojej ostatniej wiadomości.
- Na końcu pozostałe wpisy w swojej zwykłej kolejności wstawiania.

Marinara przechodzi tę listę od góry i dodaje każdy wpis, który jeszcze się mieści. Jeśli wpis przekroczyłby limit, Marinara go pomija i przechodzi dalej. Sprawdza przy tym wszystkie wpisy poniżej pominiętego. Dzięki temu mniejszy wpis może się zmieścić nawet po odrzuceniu większego.

<a id="seeing-skipped-entries-in-active-context"></a>

## Podgląd pominiętych wpisów w Active Context

Nie musisz zgadywać, które wpisy zostały odrzucone. Otwórz **Chat Settings** i rozwiń sekcję **Active Context** (aktywny kontekst). Pokazuje ona aktualny wynik ostatniego skanowania lorebooków.

Jeśli pominięto jakieś pasujące wpisy, na górze pojawia się bursztynowy komunikat. Jego treść to "N matching lore entries were skipped by token budget." Rozwiń go, żeby zobaczyć każdy pominięty wpis.

Przy każdym pominiętym wpisie widać, z którego lorebooka pochodzi i co go zablokowało. Powód jest jeden z trzech:

- **lorebook budget**: wpis nie zmieścił się w polu **Token Budget** tego jednego lorebooka.
- **chat budget**: wpis nie zmieścił się we wspólnym dla czatu polu **Lorebook Token Budget**.
- **lorebook and chat budgets**: oba limity były już wyczerpane.

Rozwiń pominięty wpis, żeby poznać szczegóły. Zobaczysz dopasowane słowa kluczowe, szacowany rozmiar w tokenach oraz to, ile limitu było już zajęte. Jeśli duże lorebooki stale są pomijane, **Active Context** podpowiada agentów **Knowledge Retrieval** i **Knowledge Router**. Zwykle radzą sobie z obszernymi lorebookami lepiej niż podnoszenie limitów.

## Skanowanie rekurencyjne

Normalnie Marinara szuka słów kluczowych tylko w twoich ostatnich wiadomościach. Przy włączonym skanowaniu **Recursive** przegląda dodatkowo treść wpisów, które właśnie się aktywowały. Dzięki temu aktywny wpis może wciągnąć kolejne wpisy, których słowa kluczowe padają w jego treści.

Włącz tę opcję w zakładce **Overview** lorebooka.

1. Otwórz lorebook.
2. Otwórz zakładkę **Overview**.
3. Włącz przełącznik **Recursive**. Domyślnie jest wyłączony.
4. Ustaw pole **Max Depth** (maksymalna głębokość), jeśli chcesz zmienić zasięg takiego łańcucha.

Pole **Max Depth** (domyślnie **3**) decyduje o tym, ile dodatkowych przebiegów skanowania się wykonuje. Każdy przebieg szuka kolejnych dopasowań słów kluczowych w świeżo aktywowanych wpisach. Zakres to od **1** do **10**. Wyższe wartości wyłapują więcej powiązanej wiedzy, ale wymagają więcej przetwarzania.

Rekurencję trzeba włączyć osobno także dla każdego wpisu. W rozwiniętym panelu bocznym wpisu przełącznik **Recursion** (rekurencja) decyduje, czy treść tego wpisu może wyzwalać kolejne wpisy. Domyślnie jest wyłączony. Zostaw go wyłączonego, chyba że ten wpis ma prowadzić do innej wiedzy. Pełny opis ustawień wpisu znajdziesz w przewodniku [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md).

Rekurencja nie omija limitów. Wpisy znalezione w przebiegu rekurencyjnym liczą się do pól **Token Budget**, **Entry Limit** i wspólnego dla czatu **Lorebook Token Budget** tak samo jak każdy inny wpis.

## Powiązane przewodniki

- [Wpisy lorebooka: słowa kluczowe, pozycja i czas działania](entries.md)
- [Lorebooki – przegląd](overview.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
