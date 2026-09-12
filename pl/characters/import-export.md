# Importowanie i eksportowanie kart postaci

Z tego przewodnika dowiesz się, jak wczytać karty postaci do aplikacji Marinara Engine i jak wyeksportować własne postacie na zewnątrz. Opisuje on typy plików obsługiwane przez Marinara, opcje dostępne w oknie importu oraz trzy formaty eksportu.

Karta postaci to pojedynczy plik z jedną postacią: jej nazwą, opisem, osobowością, powitaniami (pierwszymi wiadomościami postaci), a często też awatarem. Dzięki kartom przenosisz postać między aplikacją Marinara Engine a innymi programami do roleplayu.

## Formaty importu

Okno **Import Character** (import postaci) przyjmuje cztery typy plików. Można upuścić kilka plików naraz, nawet różnych typów.

| Typ pliku | Co to jest |
| --- | --- |
| **.json** | Zwykła karta postaci w formie tekstowej (Chara Card V2). |
| **.png** | Obrazek karty postaci z danymi karty ukrytymi wewnątrz obrazu. |
| **.charx** | Pakiet Character Card V3 (CharX), format oparty na zipie, używany przez RisuAI. |
| **.marinara** | Natywny eksport aplikacji Marinara Engine (spotykany też jako `.marinara.json`). |

Plik **.marinara** zachowuje najwięcej szczegółów, bo to własny format aplikacji Marinara Engine. Pozostałe trzy pochodzą z SillyTavern, Chub, Risu i podobnych narzędzi.

## Importowanie postaci

Wykonaj kolejno te kroki, aby dodać do biblioteki jedną kartę lub więcej.

1. Otwórz panel **Characters** (postacie).
2. Kliknij przycisk **Import** (import) na pasku narzędzi. To przycisk z ikoną strzałki pobierania. Otwiera się okno **Import Character**.
3. Przeciągnij pliki na okno albo kliknij je, żeby wskazać pliki na dysku. Powinien pojawić się napis "Drop one or more files here or click to browse".
4. Ustaw dwie opcje importu (opisane niżej). Obowiązują dla każdego pliku w tej partii.
5. Poczekaj na listę wyników. Przy każdym pliku widać zielony znaczek z napisem "Imported" i nazwą albo czerwony znak z błędem.

### Wybór tagów do zachowania

Opcja **Imported card tags** (tagi importowanej karty) decyduje o tym, co stanie się z tagami wczytywanej karty. Nazywa się to trybem importu tagów. Do wyboru są trzy możliwości:

- **All tags**: zachowanie wszystkich tagów z karty źródłowej. To ustawienie domyślne.
- **No tags**: pominięcie tagów źródłowych.
- **Existing only**: zachowanie tylko tych tagów, które już są w bibliotece.

### Wybór zasięgu skryptów regex

Niektóre karty mają dołączone skrypty regex, czyli wyrażenia regularne – małe reguły zamiany tekstu. Opcja **Imported regex scripts** (importowane skrypty regex) decyduje o ich zasięgu:

- **Character only**: skrypty działają tylko dla tej postaci. To ustawienie domyślne.
- **Global**: skrypty trafiają do sekcji **Regexes** w panelu **Presets** i działają w każdym czacie.

Wybierz **Character only**, chyba że reguły mają obowiązywać naprawdę wszędzie.

### Karty z wbudowanym lorebookiem

Lorebook to zbiór faktów o twoim świecie, do których AI może sięgnąć w trakcie czatu. Jeśli importowana karta ma lorebook w środku, import zatrzymuje się i pokazuje panel **Embedded lorebook found** (znaleziono wbudowany lorebook). Wypisuje on każdy plik oraz liczbę wpisów w środku. Wybierz jedną opcję dla całej partii:

- **Import Lorebook**: utworzenie dodatkowo osobnego lorebooka Marinara Engine powiązanego z postacią.
- **No Import**: pozostawienie lorebooka wyłącznie wewnątrz karty.

### Importowanie wielu kart naraz

To samo okno **Import Character** obsługuje import partiami. Wskaż kilka plików, a Marinara zaimportuje je jeden po drugim. Lista wyników ma jeden wiersz na plik, więc od razu widać, które karty się udały, a które nie.

## Eksportowanie postaci

Otwórz postać w edytorze, a potem kliknij przycisk **Export character** (eksport postaci) na górnym pasku narzędzi. Okno **Export Character** proponuje trzy formaty.

| Format | Co otrzymujesz | Najlepszy do |
| --- | --- | --- |
| **Marinara Native** | Plik `.marinara.json`, który zachowuje metadane aplikacji Marinara Engine, sprite'y, obrazy z galerii i dołączone lorebooki. | Przenoszenia postaci między instalacjami Marinara Engine z pełnią szczegółów. |
| **Compatible JSON** | Zwykły plik JSON w formacie Chara Card V2, bez nakładki aplikacji Marinara Engine. | Udostępniania innym aplikacjom, które czytają karty JSON. |
| **Compatible PNG Card** | Obrazek Chara Card V2 z danymi karty zapisanymi wewnątrz obrazu. | Aplikacji i stron, które oczekują karty PNG, takich jak SillyTavern, Chub i Risu. |

Wybierz **Marinara Native**, jeśli chcesz zachować wszystko. Wybierz jeden z formatów **Compatible**, jeśli plik trafia do innego narzędzia. Oba formaty zgodne pomijają dodatki charakterystyczne dla aplikacji Marinara Engine, takie jak sprite'y i obrazy z galerii. Niepuste pola **Backstory** (historia postaci) i **Appearance** (wygląd) są dopisywane do standardowego pola Description, żeby inne aplikacje odczytujące format V2 zachowały te informacje o postaci. Pola te są usuwane z eksportowanych rozszerzeń, aby nie dublowały się przy ponownym imporcie. Zapisana karta pozostaje bez zmian; format **Marinara Native** zachowuje osobne pola.

## Eksportowanie wielu postaci naraz

Całą partię postaci da się wyeksportować jako jeden plik zip.

1. Otwórz panel **Characters**.
2. Kliknij przycisk **Select** (wybór) na pasku narzędzi, aby włączyć tryb zaznaczania. To przycisk z ikoną znaczka.
3. Zaznacz wybrane postacie.
4. Kliknij przycisk **Export** (eksport) na pasku akcji na dole. Marinara pobiera plik zip o nazwie `marinara-characters.zip`.

W pliku zip jest jeden plik **Marinara Native** na każdą postać. Eksport zbiorczy nie oferuje formatu PNG ani zgodnego JSON, więc gdy potrzeba tych formatów, użyj eksportu pojedynczej postaci.

## Importowanie całego folderu SillyTavern

Powyższe kroki dotyczą kart wskazywanych ręcznie. Aby przenieść całą instalację SillyTavern za jednym razem, użyj zbiorczego importera folderów. Przenosi on jednocześnie postacie, czaty, presety i lorebooki. Znajdziesz go w panelu **Settings** (ustawienia), w zakładce **Imports**. Pełny opis krok po kroku znajduje się w przewodniku [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Card Browser: wyszukiwanie i importowanie postaci](bot-browser.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
