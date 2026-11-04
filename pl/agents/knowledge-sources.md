# Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router

Agenci **Knowledge Retrieval** (pobieranie wiedzy) i **Knowledge Router** (dobór wpisów) przenoszą fakty z lorebooków do czatu dopiero wtedy, gdy scena ich potrzebuje. Nie trzeba upychać każdego szczegółu w każdym prompcie. Obaj agenci działają wyłącznie w czatach w trybie Roleplay i żaden z nich nie jest domyślnie włączony.

## Po co ich używać

Lorebook to zbiór notatek o świecie lub o postaciach. Każda notatka to wpis. Wysyłanie wszystkich wpisów w każdej turze marnuje tokeny (małe kawałki tekstu, które czyta model i za które płacisz) i może zdezorientować AI.

Ci agenci korzystają z metody RAG (retrieval-augmented generation, czyli generowania wspomaganego wyszukiwaniem): Marinara znajduje wpisy pasujące do bieżącej sceny i dokłada do promptu na tę turę tylko je.

## Wybór: Retrieval czy Router

| Pytanie | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| Jak dodaje treść | Najpierw streszcza źródła | Dodaje wybrane wpisy słowo w słowo |
| Koszt jednej tury | Wyższy | Niższy |
| Czyta wgrane pliki | Tak | Nie |
| Najlepszy do | Mniejszych źródeł albo zwięzłego streszczenia | Dużych lorebooków z dobrymi opisami wpisów |

- **Knowledge Retrieval** czyta każdy włączony wpis z wybranych lorebooków oraz wgrane pliki i prosi AI o streszczenie faktów pasujących do ostatnich wiadomości. Kosztuje to więcej, bo AI czyta cały tekst źródłowy.
- **Knowledge Router** buduje mały katalog wpisów. Każda linia zawiera identyfikator, nazwę, kilka słów kluczowych i krótkie streszczenie. AI wybiera wpisy z katalogu, a Marinara dokłada je w całości. AI nigdy nie czyta wszystkich wpisów, więc router pozostaje tani nawet przy dużym lorebooku.

Do jednego czatu można dodać obu agentów, ale ich działanie się pokrywa i podnosi koszt. Edytor agentów ostrzega, kiedy oba są skonfigurowane. Wybierz jednego.

## Dodawanie agenta wiedzy do czatu

Zanim zaczniesz: zainstaluj agenta z sekcji **Agent Organizer** (organizowanie agentów). Zobacz [Agenci: pomocnicy AI w czatach](agents-overview.md).

1. W czacie Roleplay otwórz **Chat Settings** (ustawienia czatu).
2. Znajdź sekcję **Agents** i włącz **Enable Agents** (włączenie agentów).
3. Kliknij **Add Agent**.
4. Rozwiń grupę **Writer Agents** i wybierz **Knowledge Retrieval** albo **Knowledge Router**.
5. W oknie konfiguracji wybierz źródła (opis niżej).

Karta ustawień agenta pojawia się wtedy w sekcji **Agents**, a agent uruchamia się w każdej nowej turze. Kiedy pracuje Knowledge Retrieval, wskaźnik postępu może pokazywać **Retrieving knowledge...**.

> **Uwaga:** Ci agenci działają tylko w nowych turach. Nie uruchamiają się ponownie, gdy generujesz odpowiedź jeszcze raz.

## Wybór źródeł

Obaj agenci mają te same kontrolki źródeł.

- Przełącznik **Use chat-active lorebooks** (używaj lorebooków aktywnych na czacie) jest domyślnie włączony. W edytorze agentów ten sam przełącznik nazywa się **Use this chat's active lorebooks**. Kiedy jest włączony i nie wybierzesz żadnych stałych lorebooków, agent czyta lorebooki aktywne w bieżącym czacie.
- **Fixed source override** (w oknie konfiguracji **Fixed Source Lorebooks**) przypina agenta do wybranych lorebooków. Stały wybór zawsze ma pierwszeństwo przed lorebookami aktywnymi w czacie, w każdym czacie z tym agentem.

Stałe źródła sprawdzają się, gdy jeden agent ma zawsze czytać ten sam lorebook referencyjny. Zostaw przełącznik włączony, bez stałego wyboru, jeśli agent ma podążać za tym, czego używa czat.

## Wgrywanie plików (tylko Knowledge Retrieval)

W ustawieniach agenta **Knowledge Retrieval** kliknij **Upload file**. Wgrane pliki są dostępne w każdym czacie, który używa agenta Knowledge Retrieval.

Obsługiwane typy to `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` i `.pdf`. Okno wyboru plików blokuje pozostałe typy. Przy każdym pliku widać jego nazwę i rozmiar oraz przycisk usuwania.

- Każdy plik poza PDF jest czytany jako zwykły tekst. Plik, który nie jest tekstem, na przykład obrazek z rozszerzeniem zmienionym na `.txt`, wgra się, ale doda nieczytelną treść.
- Zeskanowany PDF albo PDF złożony z samych obrazów nie ma warstwy tekstowej. Agent wstawia wtedy tekst zastępczy zamiast treści. Używaj plików PDF z zaznaczalnym tekstem.

## Pisanie dobrych opisów wpisów

Ma to największe znaczenie dla agenta Knowledge Router, który wybiera wpisy na podstawie pola **Description**.

1. Otwórz wpis w edytorze lorebooka.
2. Wypełnij pole **Description** krótkim, konkretnym streszczeniem tego, czego dotyczy wpis.

Router używa opisu wyłącznie do wyboru wpisów. Opis nie trafia do głównego modelu AI jako treść opowieści. Jeśli wpis nie ma opisu, router posiłkuje się początkiem treści wpisu, co jest mniej precyzyjne.

Kiedy wybierasz źródłowe lorebooki dla routera, obok opcji **Fixed source override** pojawia się plakietka pokrycia, na przykład **75% described (9/12)**. Kropka jest zielona od 75% w górę, bursztynowa od 25% do 74% i czerwona poniżej 25%. Przy pustych lorebookach plakietka pokazuje **No entries yet**. Celuj w zielony.

## Opcjonalnie: wstępny wybór po znaczeniu

Knowledge Router potrafi też znajdować kandydatów na wpisy po znaczeniu, a nie tylko po słowach kluczowych. Służy do tego model embeddingów, czyli mały model, który zamienia tekst na liczby, żeby Marinara mogła porównywać znaczenie. Router działa także bez niego.

1. Otwórz edytor lorebooka i znajdź **Semantic search (embeddings)**.
2. Wybierz konto, które ma model embeddingów. Jeśli w **Connections → Defaults** (połączenia, ustawienia domyślne) ustawisz domyślne źródło dla **Embeddings** (embeddingi), zostanie ono wybrane automatycznie, chyba że wcześniej wybrano inne źródło.
3. Używaj tego samego źródła embeddingów co konto czatu. Wektory o innym rozmiarze są pomijane.
4. Kliknij przycisk wektoryzacji. Pokazuje on, ile wpisów nadal potrzebuje wektorów. **Re-vectorize all** przelicza od nowa każdy wpis.

Jeśli lorebook nie ma wektorów albo model embeddingów jest niedostępny, router buduje listę kandydatów wyłącznie na podstawie słów kluczowych. Nic się nie psuje. Zobacz [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md).

## Powiązane przewodniki

- [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md)
- [Lorebooki – przegląd](../lorebooks/overview.md)
- [Agenci: pomocnicy AI w czatach](agents-overview.md)
