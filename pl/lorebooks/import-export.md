# Importowanie i eksportowanie lorebooków

Importuj lorebooki, żeby wczytać fakty o świecie z plików, i eksportuj je, żeby je udostępnić albo zrobić ich kopię zapasową. Ten przewodnik omawia pojedyncze pliki, wiele plików naraz oraz cztery formaty eksportu. Lorebook to zbiór notatek wyzwalanych słowami kluczowymi, które Marinara dokłada do promptu (tekstu wysyłanego do AI), gdy padnie pasujące słowo. W innych narzędziach ta funkcja nazywa się World Info.

## Co można zaimportować

Marinara sama rozpoznaje rodzaj pliku. Oba rodzaje to pliki `.json` i nie potrzebujesz do nich konta ani klucza API.

- Lorebook wyeksportowany z aplikacji Marinara Engine. Zachowuje każde pole i każdy folder.
- Plik World Info z innego narzędzia, na przykład plik World Info z aplikacji SillyTavern albo format "character-book" z kart postaci V2. Marinara przekłada jego pola na własne.

## Importowanie lorebooka

1. Otwórz panel **Lorebooks** (lorebooki).
2. Kliknij ikonę strzałki pobierania w górnym rzędzie, środkową z trzech ikon. Jej podpowiedź brzmi **Import**. Ikona plusa to **New**, a ikona znacznika to **Select**.
3. W oknie **Import Lorebook** (import lorebooka) dotknij albo kliknij pole z napisem **Drop one or more lorebook files here or click to browse** i wskaż pliki `.json`. Na komputerze możesz też upuścić pliki na to pole. Możesz wybrać kilka naraz i wymieszać pliki z aplikacji Marinara Engine z plikami World Info.
4. Poczekaj na wyniki. Przy każdym pliku pojawia się zielony znacznik z napisem **Imported lorebook** albo czerwony znak z błędem. Przy kilku plikach linia podsumowania pokazuje, ile się udało, a ile nie.
5. Kliknij **Close**. Nowe lorebooki są w panelu **Lorebooks**.

Marinara zachowuje datę zapisaną w pliku jako datę utworzenia.

Jeśli to nie zadziałało: przeczytaj błąd przy pliku. Plik, który nie jest lorebookiem albo jest uszkodzony, zawodzi sam, a pozostałe pliki się importują.

## Po imporcie

Zaimportowany lorebook od razu działa ze słowami kluczowymi. Jeśli korzystasz z wyszukiwania semantycznego, zbuduj jego wektory od nowa. Zobacz [Wyszukiwanie semantyczne w lorebookach](semantic-search.md).

## Eksportowanie lorebooka

1. W panelu **Lorebooks** kliknij lorebook, żeby go otworzyć.
2. Kliknij ikonę eksportu w nagłówku edytora, blisko prawego górnego rogu. Jej podpowiedź brzmi **Export lorebook**.
3. W oknie **Export Lorebook** (eksport lorebooka) wybierz format. Przeglądarka pobiera plik.

| Format | Co dostajesz | Do czego służy |
| --- | --- | --- |
| **Marinara Native** | Każde pole wpisu i każdy folder. Nazwa pliku kończy się na `.marinara.json`. | Przeniesienie lorebooka do innej instalacji aplikacji Marinara Engine. |
| **Compatible JSON** | Plik World Info bez folderów, z nazwą kończącą się na `.json`. Część szczegółów właściwych tylko dla aplikacji Marinara Engine przepada. | Inne narzędzia do roleplayu. |
| **Markdown** | Jeden nagłówek `## Name` na każdy wpis, z linią `Keys:`. | Czytanie i edycja w edytorze tekstu. |
| **CSV** | Arkusz z kolumnami name, keys, content, folder, enabled, constant i probability. | Edycja wielu wpisów w arkuszu kalkulacyjnym. |

## Eksportowanie wielu lorebooków naraz

1. W panelu **Lorebooks** kliknij ikonę znacznika (**Select**).
2. Zaznacz każdy lorebook, który chcesz wyeksportować.
3. Kliknij **Export** na pasku na dole.

Przeglądarka pobiera plik `marinara-lorebooks.zip`. Eksport zbiorczy zawsze używa formatu **Marinara Native**, więc po imporcie wraca wszystko.

## Importowanie wpisów z plików Markdown lub CSV

Wpisy można dodać do lorebooka z pliku tekstowego Markdown lub CSV, na przykład takiego, który zmieniono po eksporcie.

1. Otwórz lorebook i kliknij **Import entries from Markdown or CSV** (import wpisów z plików Markdown lub CSV) w nagłówku edytora.
2. W oknie **Import entries** (import wpisów) kliknij **Choose file** (wybór pliku) albo wklej tekst do pola.
3. Sprawdź pole **Format**. Marinara odgaduje format na podstawie tekstu.
4. Przeczytaj podgląd. W Markdown użyj jednego nagłówka `## Name` na każdy wpis, opcjonalnej linii `Keys: a, b`, a potem tekstu. W CSV użyj wiersza nagłówka z kolumnami name, keys i content oraz opcjonalnymi kolumnami folder, enabled, constant i probability. Podgląd pokazuje, ile wpisów jest gotowych, i wypisuje błędy oraz ostrzeżenia z numerami linii.
5. W polu **Import into** (cel importu) wybierz **This lorebook** (ten lorebook) albo **New lorebook** (nowy lorebook). Dla nowego wpisz nazwę w polu **New lorebook name** (nazwa nowego lorebooka).
6. W polu **When an entry name already exists** (gdy nazwa wpisu już istnieje) wybierz **Skip the imported entry** (pominięcie importowanego wpisu), **Import as a renamed copy** (import jako kopii pod zmienioną nazwą) albo **Overwrite the existing entry** (nadpisanie istniejącego wpisu).
7. Kliknij przycisk **Import**, który pokazuje liczbę wpisów.

Podręczne powiadomienie mówi, ile wpisów dodano, nadpisano i pominięto.

Jeśli to nie zadziałało: przycisk pozostaje nieaktywny, gdy plik ma błąd dotyczący całego pliku, na przykład brak wymaganych kolumn, albo gdy żaden wpis nie jest poprawny. Popraw linie wskazane w podglądzie.

## Importowanie całego folderu SillyTavern

Import z pełnego folderu aplikacji SillyTavern, razem z postaciami, czatami i presetami, opisuje przewodnik [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Podpinanie lorebooków do postaci i person](linking-to-characters.md)
- [Wyszukiwanie semantyczne w lorebookach](semantic-search.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
