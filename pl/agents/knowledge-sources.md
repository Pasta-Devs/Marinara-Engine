# Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router

Ten przewodnik wyjaśnia, jak działają dwaj agenci wiedzy w aplikacji Marinara Engine: **Knowledge Retrieval** (pobieranie wiedzy) i **Knowledge Router** (dobór wpisów). Obaj przenoszą fakty z lorebooków do czatu dopiero wtedy, gdy scena ich potrzebuje. Dzięki temu nie trzeba upychać każdego szczegółu w treści każdego promptu.

## Co robią ci agenci

Lorebook to zbiór notatek o świecie lub o postaciach, przygotowany z wyprzedzeniem. Każda taka notatka to wpis. Im dłuższy czat, tym bardziej wysyłanie wszystkich wpisów w każdej turze marnuje tokeny. Token to mały kawałek tekstu, który czyta AI, a więcej tokenów oznacza wyższy koszt. Wysyłanie wszystkiego potrafi też zdezorientować AI.

Agenci wiedzy rozwiązują to metodą RAG. Skrót RAG pochodzi od retrieval-augmented generation, czyli generowania wspomaganego wyszukiwaniem. Aplikacja znajduje wpisy pasujące do bieżącej sceny i tylko je dokłada do promptu na tę jedną turę.

Marinara oferuje do tego dwóch opcjonalnych agentów:

- **Knowledge Retrieval** czyta wybrane źródła, streszcza istotne fakty i dokłada streszczenie do promptu.
- **Knowledge Router** czyta krótką listę wpisów, wybiera te pasujące do sceny i dokłada je słowo w słowo.

Obaj agenci działają wyłącznie na czatach w trybie **Roleplay**. W trybie Conversation Mode ani w trybie Game Mode nie da się ich dodać. Żaden z nich nie jest włączony domyślnie – wybranego agenta trzeba dodać do czatu samodzielnie.

## Knowledge Retrieval a Knowledge Router

Ta tabela pomaga wybrać. Przed decyzją przeczytaj też uwagi pod nią.

| Pytanie | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| Jak dodaje treść | Najpierw streszcza źródła | Dodaje wybrane wpisy słowo w słowo |
| Koszt jednej tury | Wyższy | Niższy |
| Czyta wgrane pliki | Tak | Nie |
| Najlepszy do | Mniejszych źródeł albo sytuacji, gdy przyda się zwięzłe streszczenie | Dużych lorebooków z dobrymi opisami wpisów |

**Knowledge Retrieval** czyta każdy włączony wpis z wybranych lorebooków, a do tego treść wgranych plików. Następnie prosi AI o krótkie streszczenie faktów pasujących do ostatnich wiadomości. Koszt jednej tury jest przez to wyższy, bo AI czyta cały materiał źródłowy.

**Knowledge Router** to tańsza opcja. Buduje mały katalog wpisów. Każda linia katalogu zawiera identyfikator, nazwę, kilka słów kluczowych i krótkie streszczenie. AI czyta ten katalog, wybiera wpisy pasujące do sceny, a Marinara dokłada je w całości. AI nigdy nie czyta wszystkich wpisów w całości, więc ten agent pozostaje tani nawet przy dużym lorebooku.

Do jednego czatu można dodać obu agentów naraz, ale treść potrafi się wtedy powielać i podnosi koszt w tokenach. Edytor agentów ostrzega, kiedy oba są skonfigurowane. Prompty będą czytelniejsze, jeśli wybierzesz jednego.

## Dodawanie agenta wiedzy do czatu

Rób to na czacie w trybie **Roleplay**.

1. Otwórz panel **Chat Settings** (ustawienia czatu).
2. Znajdź sekcję **Agents**.
3. Włącz przełącznik **Enable Agents**. Lista agentów się odblokuje.
4. Kliknij przycisk **Add Agent**.
5. Rozwiń grupę **Writer Agents**.
6. Wybierz agenta **Knowledge Retrieval** albo **Knowledge Router**.

Otwiera się okno konfiguracji, w którym od razu można wskazać źródła. Po dodaniu agenta jego karta ustawień pojawia się w sekcji **Agents**. Od tej pory agent uruchamia się sam w każdej nowej turze.

Kiedy pracuje agent **Knowledge Retrieval**, wskaźnik postępu może pokazywać fazę **Retrieving knowledge...**.

Uwaga: ci agenci nie uruchamiają się ponownie przy ponownym generowaniu istniejącej odpowiedzi. Działają tylko w nowych turach.

## Wgrywanie plików dla agenta Knowledge Retrieval

Tylko **Knowledge Retrieval** czyta wgrane pliki. **Knowledge Router** korzysta wyłącznie z lorebooków.

W ustawieniach agenta **Knowledge Retrieval** widać listę plików i przycisk **Upload file**. Wgrane pliki pozostają dostępne dla każdego czatu, który używa agenta **Knowledge Retrieval**, nie tylko dla bieżącego.

Obsługiwane typy plików to .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv oraz .pdf. Okno wyboru plików blokuje pozostałe typy. Przy każdym pliku na liście widać jego nazwę i rozmiar, a obok przycisk usuwania.

Pamiętaj o ograniczeniach:

- Każdy plik poza PDF jest czytany jako zwykły tekst. Plik, który tekstem tak naprawdę nie jest – na przykład obrazek z rozszerzeniem zmienionym na .txt – wgra się, ale doda nieczytelne krzaki.
- Zeskanowany PDF albo PDF złożony z samych obrazów nie ma warstwy tekstowej, więc agent go nie przeczyta. Kiedy odczyt się nie uda, agent wstawia tekst zastępczy zamiast prawdziwej treści. Używaj plików PDF z zaznaczalnym tekstem.

## Wybór źródeł: stała lista czy lorebooki czatu

Obaj agenci mają w karcie ustawień te same kontrolki wyboru źródeł.

Przełącznik **Use chat-active lorebooks** jest domyślnie włączony. W edytorze agentów ten sam przełącznik nosi nazwę **Use this chat's active lorebooks**. Kiedy jest włączony i nie wskazano żadnych stałych lorebooków, agent korzysta z tych lorebooków, które są aktywne na bieżącym czacie.

Pod przełącznikiem znajduje się opcja **Fixed source override**, w oknie konfiguracji opisana jako **Fixed Source Lorebooks**. Wybierz tutaj jeden lorebook lub więcej, żeby przypiąć agenta dokładnie do tego zestawu. Stały wybór zawsze ma pierwszeństwo przed lorebookami aktywnymi na czacie, i to na każdym czacie z tym agentem.

Stałe źródła sprawdzają się wtedy, gdy jeden agent ma zawsze czytać ten sam lorebook referencyjny. Zostaw sam włączony przełącznik, bez stałego wyboru, jeśli agent ma podążać za tym, czego używa dany czat.

## Jak pisać dobre opisy wpisów

Ta sekcja ma największe znaczenie dla agenta **Knowledge Router**. Decyduje on o tym, co dodać, na podstawie pola **Description** każdego wpisu. To właśnie dobry opis pozwala mu trafić we właściwy wpis.

Opis wpisuje się w edytorze wpisu lorebooka, w polu **Description**. Niech to będzie krótkie, konkretne streszczenie tego, czego wpis dotyczy. Ten tekst służy agentowi wyłącznie do wyboru wpisów. Nie trafia do głównego modelu AI jako treść opowieści.

Jeśli wpis nie ma opisu, agent posiłkuje się początkiem treści wpisu. Taki zamiennik jest mniej precyzyjny. Uzupełnij więc opis w każdym wpisie, który ma być odnajdywany.

Po wybraniu źródłowych lorebooków obok opcji **Fixed source override** pojawia się mały kafelek pokrycia. Pokazuje, ile wpisów ma opis – w procentach i sztukach, na przykład **75% described (9/12)**. Kropka jest zielona od 75 procent w górę, bursztynowa między 25 a 74 procent i czerwona poniżej 25 procent. Kiedy wybrane lorebooki są puste, kafelek pokazuje **No entries yet**. Celuj w zielony.

## Opcjonalny wybór wstępny po znaczeniu

**Knowledge Router** potrafi też szukać wpisów po znaczeniu, a nie tylko po słowach kluczowych. Nazywa się to dopasowaniem semantycznym. Korzysta z modelu embeddingów, czyli małego modelu, który zamienia tekst na liczby, żeby aplikacja mogła porównywać znaczenie. Ten krok jest opcjonalny. Bez niego agent działa dalej.

Żeby to włączyć, poddaj lorebook wektoryzacji. Wektoryzacja polega na tym, że aplikacja raz przepuszcza każdy wpis przez model embeddingów i zapisuje wyniki. Otwórz edytor lorebooka i znajdź sekcję **Semantic Search (Embeddings)**. Wybierz połączenie, które ma model embeddingów, albo **Embedding Connection** (połączenie embeddingów). Jeśli w panelu **Connections** w sekcji **Defaults** (ustawienia domyślne) wybrano domyślne **Embeddings** (embeddingi), zostanie ono wybrane automatycznie, chyba że wcześniej wybrano inne źródło. Przed wektoryzacją sprawdź wybrane źródło i używaj tego samego źródła embeddingów co połączenie czatu; wektory o innym rozmiarze są pomijane przy dopasowaniu semantycznym. Następnie kliknij przycisk **Vectorize N missing**, gdzie N to liczba wpisów bez wektorów. Przycisk **Re-vectorize** przelicza wszystkie wpisy od nowa. Szczegóły opisuje przewodnik po wyszukiwaniu semantycznym, do którego link znajdziesz niżej.

Jeśli lorebook nie ma wektorów albo model embeddingów jest niedostępny, agent buduje listę kandydatów na podstawie samych słów kluczowych. Nic się nie psuje. Po prostu liczą się wtedy wyłącznie słowa kluczowe.

## Powiązane przewodniki

- [Wyszukiwanie semantyczne w lorebookach](../lorebooks/semantic-search.md)
- [Lorebooki – przegląd](../lorebooks/overview.md)
- [Agenci: pomocnicy AI w czatach](agents-overview.md)
