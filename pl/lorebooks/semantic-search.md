# Wyszukiwanie semantyczne w lorebookach

Dzięki wyszukiwaniu semantycznemu wpis lorebooka aktywuje się na podstawie znaczenia, a nie tylko dokładnych słów kluczowych. Wpis ze słowem kluczowym "sword" dopasuje się wtedy także do wiadomości, w której pada "blade". Przydaje się, gdy w tekście na tę samą rzecz używasz wielu różnych słów.

Działa to dzięki embeddingom, czyli listom liczb, które oddają znaczenie tekstu. Marinara przechowuje jeden embedding, nazywany też wektorem, dla każdego wpisu. Budowanie ich nazywa się wektoryzacją. Podczas czatu Marinara tworzy embedding ostatnich wiadomości i szuka najbliższych wpisów.

Wyszukiwanie semantyczne dokłada dopasowania. Słowa kluczowe działają dalej. Dopasowania po słowach kluczowych i dopasowania semantyczne mają równy priorytet w limitach, więc gdy nie wszystko się mieści, decyduje ustawienie **Order** (kolejność) wpisu.

## Konfiguracja wyszukiwania semantycznego

Najpierw potrzebujesz źródła embeddingów, potem przełącznika **Vectors** (Wektory), a na końcu wektoryzacji.

### Krok 1: wybierz źródło embeddingów

Zanim zaczniesz: potrzebujesz konta, którego usługa oferuje embeddingi, albo modelu wbudowanego. Nie każda usługa oferuje embeddingi. Jeśli twoja ich nie ma, edytor podpowiada, żeby wybrać osobne konto przeznaczone do embeddingów.

Opcja 1: konto z modelem embeddingów.

1. Otwórz panel **Connections** (Połączenia) i otwórz konto do edycji.
2. Otwórz **Advanced** (zaawansowane), potem **More** (więcej) i znajdź **Semantic search (embeddings)**.
3. Wpisz nazwę modelu embeddingów, na przykład `text-embedding-3-small`. Jeśli nie znasz nazwy, sprawdź dokumentację usługi albo użyj zamiast tego modelu wbudowanego.
4. Zapisz konto.
5. Kliknij **Test embedding** (test embeddingu), żeby to sprawdzić. Marinara najpierw zapisuje zmiany, tworzy embedding krótkiego przykładu i pokazuje rozmiar wektora, na przykład "1536 dimensions", albo błąd zwrócony przez usługę.

Żeby wysyłać żądania embeddingów przez klucz i adres innego konta, wybierz to konto w polu **Embedding provider** (dostawca embeddingów). Domyślna wartość to **Same as this provider** (ten sam dostawca). Jeśli wybrane konto ma własny model embeddingów, Marinara go używa. W przeciwnym razie używa nazwy modelu wpisanej tutaj.

Opcja 2: model wbudowany. Działa na twoim komputerze bez klucza API, a na liście wyboru nazywa się **Built-in model** (model wbudowany). Pojawia się po pobraniu i jest ukryty w wersjach Lite. Zobacz [Konfiguracja modelu wbudowanego](../connections/local-model.md).

Żeby jedno źródło stało się domyślne dla każdego konta, które nie ustawia własnego, otwórz **Connections** i wybierz je w zadaniu **Embeddings** (embeddingi). Własne ustawienie konta nadal ma pierwszeństwo. Domyślna pozycja, **Marinara's own search** (własne wyszukiwanie aplikacji Marinara), zachowuje wbudowane rozwiązanie zapasowe.

### Krok 2: włącz Vectors

W nowych lorebookach wyszukiwanie semantyczne jest wyłączone.

1. Otwórz lorebook i zostań na zakładce **Overview** (Przegląd).
2. Włącz **Vectors**. Gdy przełącznik jest włączony, wpisy można znaleźć także po znaczeniu. Gdy jest wyłączony, słowa kluczowe działają dalej, a lorebook nie jest wektoryzowany.

Kiedy **Vectors** jest wyłączony, panel pokazuje napis "Semantic search is disabled by the lorebook-level Vectors toggle."

### Krok 3: zwektoryzuj wpisy

1. W panelu **Semantic search (embeddings)** wybierz źródło z listy rozwijanej. Pierwsza opcja to **No semantic search**. Zaraz po niej stoi **Built-in model**, o ile jest dostępny, a dalej twoje pasujące konta.
2. Kliknij **Vectorize N missing**, na przykład "Vectorize 5 missing".
3. Zaczekaj. Kafelek pokazuje postęp, na przykład "8/12 entries vectorized", i robi się zielony, gdy wszystkie wpisy są gotowe.

Jeśli to nie zadziałało: gdy żadne konto nie ma modelu embeddingów, panel pokazuje napis "No connections with an embedding model configured. Set an Embedding Model on a connection first." Wykonaj krok 1 i spróbuj ponownie.

## Panel Semantic search (embeddings)

Po włączeniu przełącznika **Vectors** panel pojawia się na zakładce **Overview** z takimi ustawieniami.

| Ustawienie | Do czego służy | Domyślnie | Zakres |
| --- | --- | --- | --- |
| **Query Messages** | Ilu ostatnich wiadomości użytkownika używa wyszukiwanie. 0 oznacza wszystkie dostępne wiadomości. | 10 | 0 do 100 |
| **Score Threshold** | Podobieństwo, jakiego wpis potrzebuje, żeby się aktywować. Wyższa wartość jest bardziej wymagająca. | 0.3 | 0 do 1 |
| **Vector Limit** | Najwięcej wpisów, jakie ten lorebook może dodać po znaczeniu w jednej odpowiedzi. | 10 | 1 do 100 |

**Include character context** (uwzględnianie kontekstu postaci) przeszukuje też ostatnie odpowiedzi postaci, osobno od twoich wiadomości, i zachowuje silniejsze dopasowanie. Tworzy embedding dodatkowego tekstu i domyślnie jest wyłączone. **Query Messages** obejmuje wtedy także odpowiedzi postaci.

Niski **Score Threshold**, na przykład 0.2, przepuszcza więcej wpisów, ale grozi dopasowaniami nie na temat. Wysoki, na przykład 0.5, łapie tylko bliskie znaczenia. Zacznij od wartości domyślnej.

**Vector Limit** liczy tylko dopasowania po znaczeniu. Zwykłe limity tokenów nadal obowiązują.

## Ponowna wektoryzacja, usuwanie i pomijanie

- **Re-vectorize N entries** pojawia się, gdy każdy wpis ma wektor. Po potwierdzeniu buduje od nowa wszystkie wektory.
- **Re-vectorize all** pojawia się, gdy część wpisów ma wektory, a część nie. Przebudowuje wszystko za jednym razem.
- **Delete vectors** usuwa tylko zapisane wektory. Treść wpisów i słowa kluczowe zostają, a słowa kluczowe działają dalej.
- **No Vector** we wpisie pomija ten wpis. Tekst pomocy mówi, że zbiorcza wektoryzacja pomija wpis i usuwa zapisany embedding. Wpis nadal aktywuje się po słowie kluczowym.

### Po zmianie modelu embeddingów

Zapisane wektory należą do modelu, który je stworzył. Po zmianie modelu użyj **Re-vectorize N entries** albo **Re-vectorize all**, żeby wszystkie wpisy korzystały z tego samego modelu. Wektoryzacja w trybie "tylko brakujące", która zwraca inny rozmiar wektora, zostaje odrzucona z komunikatem "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Jedna awaria jest cicha. Podczas czatu Marinara tworzy embedding twoich wiadomości modelem embeddingów aktywnego konta albo modelem z jego pola **Embedding provider**. Jeśli konto nie ustawia żadnego z nich, używa źródła z zadania **Embeddings** albo modelu wbudowanego. Jeśli rozmiar wektora tego modelu różni się od wektorów twoich wpisów, Marinara pomija te wpisy przy dopasowaniu semantycznym i nie pokazuje żadnego błędu. Wektoryzuj tym samym źródłem, którego używasz w czacie, i powtarzaj wektoryzację po każdej zmianie modelu.

## Wyszukiwanie semantyczne a agent Knowledge Router

Gdy lorebook jest zwektoryzowany, agent **Knowledge Router** także korzysta z dopasowań po znaczeniu, żeby zbudować listę kandydatów. Bez wektorów korzysta tylko z dopasowań po słowach kluczowych. Zobacz [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md).

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Konfiguracja modelu wbudowanego](../connections/local-model.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
