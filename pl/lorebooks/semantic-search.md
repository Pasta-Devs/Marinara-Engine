# Wyszukiwanie semantyczne w lorebookach

Ten przewodnik wyjaśnia, jak działa wyszukiwanie semantyczne w lorebookach w aplikacji Marinara Engine. Dzięki niemu wpis lorebooka aktywuje się na podstawie znaczenia, a nie tylko dokładnych słów kluczowych. Zobaczysz, jak ustawić źródło embeddingów, zwektoryzować wpisy i dopracować dopasowanie.

## Co daje wyszukiwanie semantyczne

Lorebook to zbiór wpisów. Każdy wpis ma słowa wyzwalające i blok tekstu. Zwykle wpis aktywuje się tylko wtedy, gdy w ostatnich wiadomościach czatu padnie dokładnie jedno z jego słów kluczowych. Jeśli w tekście pojawi się inne słowo, wpis milczy.

Wyszukiwanie semantyczne rozwiązuje ten problem. Porównuje znaczenie ostatnich wiadomości czatu ze znaczeniem wpisów. Wpis aktywuje się wtedy nawet bez dokładnego trafienia w słowo kluczowe. Przykład: wpis ze słowem kluczowym "sword" dopasuje się także do wiadomości, w której pada tylko "blade".

Działa to dzięki embeddingom. Embedding to liczbowa reprezentacja tekstu: lista liczb, która oddaje znaczenie fragmentu. Marinara przechowuje jeden embedding, nazywany też wektorem, dla każdego wpisu. Ten etap nazywa się wektoryzacją. Podczas czatu Marinara tworzy embedding ostatnich wiadomości i szuka wpisów o najbliższym znaczeniu.

Dopasowanie po słowach kluczowych działa dalej, kiedy wyszukiwanie semantyczne jest włączone. Wyszukiwanie semantyczne dokłada dodatkowe dopasowania. Nie zastępuje słów kluczowych.

Dopasowania po słowach kluczowych i dopasowania semantyczne mają równy priorytet, gdy Marinara stosuje limity wpisów lorebooka i limity tokenów. Jeśli nie wszystkie pasujące wpisy się mieszczą, o wyborze między jednymi a drugimi decyduje ustawiona kolejność wpisów, a nie sam sposób aktywacji.

## Zanim zaczniesz: wybierz źródło embeddingów

Wyszukiwanie semantyczne potrzebuje modelu, który potrafi tworzyć embeddingi. Są dwie możliwości.

Niezależnie od wyboru możesz ustawić to źródło jako domyślne w całej aplikacji: otwórz **Connections** (połączenia), potem **Defaults** (ustawienia domyślne) i wybierz je w polu **Embeddings**. Każde połączenie, które nie ma własnego modelu embeddingów ani własnego pola **Embedding Connection** (połączenie embeddingów), korzysta wtedy z tego ustawienia. Własne ustawienie połączenia nadal ma pierwszeństwo, a wiersz pokazuje, ile połączeń używa własnych ustawień. **None** zostawia wbudowany model lokalny jako rozwiązanie zapasowe.

Opcja 1: połączenie z modelem embeddingów.

1. Otwórz panel **Connections** (Połączenia).
2. Otwórz połączenie do edycji.
3. Znajdź sekcję **Semantic Search (Embeddings)**.
4. Wpisz nazwę modelu embeddingów w polu modelu. Częsta wartość to `text-embedding-3-small`.
5. Zapisz połączenie.

Połączenie może też wysyłać żądania embeddingów przez klucz API i adres innego połączenia. W tej samej sekcji wybierz to połączenie w polu **Embedding Connection**. Domyślna wartość to **Same as this connection** (to samo połączenie). Jeśli wybrane połączenie ma własny model embeddingów, Marinara go używa; w przeciwnym razie używa nazwy modelu wpisanej tutaj. Dotyczy to zarówno wektoryzacji, jak i czatu.

Nie każdy dostawca oferuje embeddingi. Jeśli dostawca nie obsługuje embeddingów, edytor podpowiada, żeby wybrać osobne połączenie przeznaczone do embeddingów.

Opcja 2: wbudowany model lokalny.

Marinara potrafi uruchomić mały model embeddingów na własnym komputerze, bez klucza API (to tajny kod, trochę jak hasło). Na liście wyboru w lorebooku ta opcja nazywa się **Local Model (sidecar)**. Pojawia się dopiero po pobraniu modelu lokalnego. Instrukcję instalacji znajdziesz w przewodniku [Konfiguracja modelu Local Model](../connections/local-model.md).

W wersji Marinara Lite opcja **Local Model (sidecar)** jest ukryta. Tam wyszukiwanie semantyczne wymaga połączenia z modelem embeddingów.

## Włączanie przełącznika Vectors w lorebooku

W nowych lorebookach wyszukiwanie semantyczne jest domyślnie wyłączone. Włącza się je osobno dla każdego lorebooka.

1. Otwórz lorebook, który ma być przeszukiwany po znaczeniu.
2. Zostań na zakładce **Overview** (Przegląd).
3. Znajdź przełącznik **Vectors** (Wektory) i włącz go.

Tekst pomocy przy przełączniku **Vectors** brzmi: "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook."

Kiedy przełącznik **Vectors** jest wyłączony, panel semantyczny pokazuje notkę: "Semantic search is disabled by the lorebook-level Vectors toggle."

## Panel Semantic Search (Embeddings)

Po włączeniu przełącznika **Vectors** na zakładce **Overview** pojawia się panel **Semantic Search (Embeddings)**. Kafelek stanu pokazuje, ile wpisów ma już wektory, na przykład "8/12 entries vectorized". Gdy gotowe są wszystkie wpisy, kafelek robi się zielony i dostaje znaczek potwierdzenia.

Panel ma trzy ustawienia liczbowe.

| Ustawienie | Do czego służy | Domyślnie | Zakres |
|---|---|---|---|
| **Query Messages** | Ile ostatnich wiadomości czatu trafia do embeddingu przy przeszukiwaniu tego lorebooka. | 10 | 0 do 100 |
| **Score Threshold** | Minimalne skalibrowane podobieństwo, jakiego wpis potrzebuje, żeby się aktywować. Wyższa wartość jest bardziej wymagająca. | 0.3 | 0 do 1 |
| **Vector Limit** | Najwięcej dopasowań semantycznych, jakie ten lorebook dokłada do jednego generowania. | 10 | 1 do 100 |

Ustaw **Query Messages** na 0, żeby przeszukiwać całą historię czatu zamiast ostatniego fragmentu.

**Score Threshold** decyduje o tym, jak bliskie musi być znaczenie. Niska wartość, na przykład 0.2, przepuszcza więcej wpisów, ale grozi dopasowaniami nie na temat. Wysoka wartość, na przykład 0.5, jest bardziej wymagająca i łapie tylko bliskie znaczenia. Zacznij od wartości domyślnej i zmieniaj ją, jeśli dopasowań jest za dużo albo za mało.

Marinara kalibruje ten wynik względem kilku niepowiązanych, neutralnych fragmentów tekstu z tego samego modelu embeddingów. Dzięki temu znika nienaturalnie wysoki wspólny próg cosinusowy. Produkują go niektóre lokalne i zgodne z OpenAI silniki embeddingów: niepowiązane teksty potrafią tam wszystkie dostawać wynik około 0.95 albo wyższy. To ustawienie pozostaje więc użyteczne przy różnych modelach embeddingów, zamiast wymagać progu blisko 1.0 dobieranego pod konkretny model.

**Vector Limit** ogranicza wyłącznie dopasowania semantyczne. Zwykłe limity tokenów obowiązują niezależnie od niego.

## Wektoryzacja wpisów

Wektoryzacja polega na zbudowaniu i zapisaniu embeddingu dla każdego wpisu. Bez tego kroku dopasowanie semantyczne nie zadziała.

1. Włącz przełącznik **Vectors** dla lorebooka.
2. W panelu **Semantic Search (Embeddings)** wybierz źródło embeddingów z listy rozwijanej. Pierwsza opcja to **No semantic search**. Zaraz po niej stoi **Local Model (sidecar)**, o ile jest dostępna. Dalej idą pasujące połączenia.
3. Kliknij przycisk wektoryzacji. Gdy części wpisów brakuje wektora, na przycisku widnieje **Vectorize N missing**, na przykład "Vectorize 5 missing".
4. Poczekaj na koniec przetwarzania. Kafelek stanu zmienia się i pokazuje, że wszystkie wpisy mają wektory.

Jeśli żadne połączenie nie ma modelu embeddingów ani ustawionego pola **Embedding Connection**, zamiast listy rozwijanej panel pokazuje notkę: "No connections with an embedding model configured. Set an Embedding Model on a connection first." Najpierw ustaw źródło embeddingów, według kroków powyżej.

Kiedy każdy wpis ma już wektor, główny przycisk zmienia się w **Re-vectorize N entries**. Buduje on od nowa wszystkie zapisane wektory. Przed nadpisaniem prosi o potwierdzenie.

Osobny przycisk **Re-vectorize all** pojawia się wtedy, gdy część wpisów ma wektory, a innym wciąż ich brakuje. Użyj go, żeby przebudować wszystko za jednym razem.

Żeby usunąć zapisane wektory, kliknij przycisk **Delete vectors**. Usuwa on wyłącznie embeddingi. Nie zmienia treści wpisów ani słów kluczowych. Po usunięciu wektorów dopasowanie po słowach kluczowych działa dalej.

### Pomijanie pojedynczego wpisu

Da się wyłączyć jeden wpis z wektoryzacji, zostawiając resztę bez zmian. Otwórz wpis i włącz w nim przełącznik **No Vector**. Tekst pomocy brzmi: "When enabled, bulk vectorization skips this entry and removes any stored embedding." Taki wpis nadal aktywuje się po słowie kluczowym. Nie dopasuje się tylko po znaczeniu.

## Ponowna wektoryzacja po zmianie modelu

Zapisane wektory są związane z modelem embeddingów, który je stworzył. Po przejściu na inny model embeddingów stare wektory mogą już nie pasować.

Po zmianie modelu embeddingów przebuduj każdy wektor. Użyj przycisku **Re-vectorize N entries** albo **Re-vectorize all**, żeby wszystkie wpisy korzystały z tego samego modelu.

Po zmianie modelu nie uruchamiaj samej częściowej wektoryzacji. Jeśli przetwarzanie w trybie "tylko brakujące" zwróci inny rozmiar wektora niż zapisane wektory, serwer je odrzuca i pokazuje komunikat: "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Warto znać jeszcze jeden cichy tryb awarii. Podczas czatu Marinara tworzy embedding ostatnich wiadomości modelem zapytań. Model zapytań to model embeddingów ustawiony w aktywnym połączeniu albo model z pola **Embedding Connection**, jeśli je ustawiono. Jeśli połączenie nie ma żadnego z nich, Marinara używa domyślnego ustawienia **Embeddings** z sekcji **Defaults** w panelu **Connections**, a gdy jest tam **None**, wbudowanego modelu lokalnego. Model zapytań może dawać inny rozmiar wektora niż model, którym zwektoryzowano wpisy. Marinara pomija wtedy takie wpisy przy dopasowaniu semantycznym. Nie widać żadnego błędu. Dlatego wektoryzuj wpisy tym samym źródłem embeddingów, którego używasz podczas czatu. Pomaga ustawienie domyślne **Embeddings**: lista wektoryzacji zaczyna od niego, o ile wcześniej nie wybrano czegoś innego, a połączenia bez własnych ustawień embeddingów odpytują właśnie nim. Po każdej zmianie modelu powtórz wektoryzację.

## Jak to zasila agenta Knowledge Router

Wyszukiwanie semantyczne pomaga też agentowi **Knowledge Router**. Przy dużych lorebookach ten agent wybiera pasujące wpisy lorebooka i wstawia je do promptu (to tekst, który Marinara wysyła do AI). Gdy lorebook jest zwektoryzowany, router buduje listę kandydatów na podstawie dopasowań semantycznych, obok dopasowań po słowach kluczowych.

Dla routera ten etap jest opcjonalny. Jeśli lorebook nie jest zwektoryzowany albo nie ma dostępnego źródła embeddingów, router opiera się wyłącznie na dopasowaniach po słowach kluczowych. Wektoryzacja daje mu po prostu lepszą listę kandydatów. Działanie tego agenta opisuje przewodnik [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md).

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Konfiguracja modelu Local Model](../connections/local-model.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
