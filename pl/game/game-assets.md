# Zasoby gry: muzyka, dźwięki, sprite'y i tła

Ten przewodnik wyjaśnia, jak działa biblioteka zasobów gry, z której Game Mode korzysta przy muzyce, dźwiękach, grafice postaci i tłach scen. Opisuje wbudowany zestaw startowy, menedżer plików **Asset Browser** (przeglądarka zasobów), wgrywanie własnych plików oraz wybór zasobów dostępnych dla poszczególnych gier.

## Czym są zasoby gry

Zasoby gry to pliki multimedialne, które Game Mode odtwarza i pokazuje w trakcie sesji. Marinara Engine dzieli je na pięć kategorii:

- **Music**: ścieżki muzyki w tle, zmieniające się razem ze sceną.
- **Ambient**: zapętlone dźwięki otoczenia, na przykład natura, miasto lub wnętrza.
- **Sound Effects** (nazywane też SFX): krótkie dźwięki do menu, walki i eksploracji.
- **Sprites**: grafika postaci i obiektów pokazywana na ekranie.
- **Backgrounds**: obrazy scen widoczne za historią.

Game Mode czyta tę bibliotekę samodzielnie. Muzykę, dźwięki otoczenia i tła dobiera automatycznie do sceny, więc w trakcie gry nie trzeba przypisywać zasobów ręcznie.

## Wbudowany zestaw startowy

Marinara instaluje darmową bibliotekę startową przy pierwszym uruchomieniu serwera. Przy kolejnych uruchomieniach odświeża te pliki, jeśli wbudowany zestaw się zmienił. Zestaw startowy zawiera:

- Pięć ścieżek **Music**, po jednej dla kilku różnych nastrojów sceny.
- Zestaw pętli **Ambient** w folderach nature, urban i interior.
- Efekty **Sound Effects** do menu, walki i eksploracji.

Wbudowanych plików **Backgrounds** nie ma. Foldery teł na starcie są puste. Zapełniają się dopiero wtedy, gdy wgrasz obrazy albo gdy Game Mode wygeneruje grafikę scen.
Wbudowanych **Sprites** postaci też nie ma. Dodaj tylko taką grafikę postaci, która pasuje do własnych gier.

Wszystkie wbudowane pliki mają licencję CC0, czyli należą do domeny publicznej i można ich używać bez ograniczeń. Pełne informacje o autorach każdego pliku znajdują się w pliku tekstowym `CREDITS.md`, który trafia na dysk razem z zasobami. Aplikacja go nie wyświetla.

Wbudowane pliki i foldery są chronione. Nie da się ich usunąć ani przenieść z poziomu panelu **Asset Browser**, więc biblioteka startowa pozostaje nienaruszona. Zmiana nazwy i kopiowanie nadal działają.

## Otwieranie panelu Asset Browser

**Asset Browser** to menedżer plików dla zasobów gry. Można go otworzyć na dwa sposoby.

Z poziomu panelu **Settings** (Ustawienia):

1. Otwórz panel **Settings**.
2. Przejdź do zakładki **Imports**.
3. Znajdź sekcję **Game Assets**.
4. Kliknij przycisk **Asset Browser**.

Z poziomu gry:

1. Otwórz czat w trybie Game Mode.
2. Kliknij lub dotknij przycisk **Game Assets** (ikona folderu). Domyślnie znajduje się blisko prawego górnego rogu czatu. Możesz przeciągnąć go w inne miejsce na komputerze lub telefonie.

Przycisk pojawia się tylko w czatach korzystających z trybu Game Mode. Otwiera **Game Assets**, a w nim **Asset Browser**: w ruchomym oknie na komputerze lub panelu na całą szerokość ekranu na telefonie.

Jeśli okno zostało przeniesione przyciskiem **Put back in Chat Settings**, otwórz zamiast niego sekcję **Game Assets** w Chat Settings.

Na górnym pasku narzędzi jest ścieżka nawigacji zaczynająca się od **Game Assets**. Obok niej stoją przełączniki **Grid view** i **List view**, przycisk **Upload** oraz przycisk **New**. Znajdziesz tam także przycisk **Rescan**, przycisk **Open in system folder** i pole **Search in folder**. Na szerszych ekranach drzewo folderów po lewej stronie pozwala przeskakiwać między kategoriami.

## Wgrywanie własnych zasobów

Zasoby można wgrać na dwa sposoby. Wybierz wygodniejszy.

### Wgrywanie z panelu **Asset Browser**

1. Otwórz panel **Asset Browser**.
2. Wejdź do jednego z pięciu folderów kategorii albo do podfolderu w jego środku.
3. Kliknij przycisk **Upload** i wskaż pliki albo przeciągnij je na obszar plików.

Najpierw trzeba wejść do folderu kategorii. Przy upuszczeniu plików na najwyższym poziomie aplikacja prosi o otwarcie folderu kategorii przed wgraniem.

### Wgrywanie z poziomu panelu **Settings**

1. Otwórz panel **Settings** i przejdź do zakładki **Imports**.
2. Znajdź sekcję **Game Assets**.
3. Wybierz kategorię z listy rozwijanej **Type**: **Music**, **Ambient**, **Sound Effects**, **Sprites** albo **Backgrounds**.
4. Ustaw miejsce docelowe w polu **Folder** albo zostaw podpowiadaną wartość domyślną.
5. Kliknij przycisk **Choose Files** i zaznacz pliki.
6. Kliknij przycisk **Upload to Server**.

Każdy wybór w polu **Type** wypełnia pole **Folder** sensowną wartością domyślną. Wartości domyślne to:

- **Music**: `exploration/fantasy/calm`
- **Ambient**: `nature`
- **Sound Effects**: `exploration`
- **Sprites**: `generic-fantasy`
- **Backgrounds**: `custom`

### Zasady dotyczące typów i rozmiarów plików

Serwer sprawdza każdy wgrywany plik pod kątem tych zasad. Obowiązują one przy obu sposobach wgrywania.

| Kategoria                     | Dopuszczalne typy plików             |
| ----------------------------- | ------------------------------------ |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM  |
| Sprites                       | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds                   | PNG, JPG, JPEG, GIF, WebP, AVIF      |

Pliki audio i obrazy mogą mieć do 50 MB każdy. Pliki tekstowe – do 10 MB. Serwer odrzuca typy plików, które nie pasują do kategorii. Komunikat błędu wymienia dopuszczalne typy.

### Zasada folderów muzycznych

Muzyka ma ścisły układ folderów. Każda ścieżka muzyczna musi leżeć w trzypoziomowej ścieżce `state/genre/intensity`, na przykład `exploration/fantasy/calm`. Jeśli ścieżka nie pasuje, wgrywanie kończy się błędem.

Dozwolone wartości to:

- Stan: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Gatunek: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`.
- Intensywność: `calm`, `tense`, `intense`.

Dzięki temu układowi Game Mode wie, kiedy odtworzyć każdą ścieżkę. Foldery dźwięków otoczenia, efektów dźwiękowych, sprite'ów i teł nie mają tej zasady. Ich podfoldery można nazywać dowolnie.

## Porządkowanie zasobów

Panel **Asset Browser** pomaga utrzymać porządek w plikach. Kliknij plik lub folder prawym przyciskiem myszy na komputerze albo użyj jego menu "...", żeby zobaczyć dostępne działania.

Działania na pliku:

- **Rename**: nadanie plikowi nowej nazwy. Operacja nie powiedzie się, gdy taka nazwa jest już zajęta w tym folderze.
- **Move** i **Copy**: przeniesienie lub skopiowanie pliku do innego folderu przez okno wyboru folderu.
- **Delete**: usunięcie pliku.
- **Download**: zapisanie pliku na urządzeniu.

Działania na folderze:

- **Create subfolder**: utworzenie nowego folderu w jego środku.
- **Open in system folder**: pokazanie folderu w menedżerze plików komputera.
- **Delete folder**: usunięcie folderu. Jeśli są w nim jeszcze pliki, trzeba najpierw zaznaczyć pole wyboru **Delete everything inside**.

Przycisk **New** na pasku narzędzi także tworzy elementy w bieżącym folderze. Do wyboru są **New folder**, **New text file** i **New markdown file**.

Żeby zadziałać na wielu plikach naraz, użyj pól wyboru przy plikach. Pasek pokazuje liczbę zaznaczonych plików oraz przyciski **Select all**, **Move**, **Copy** i **Delete**. Duże foldery pokazują naraz tylko część zawartości, z przyciskiem **Load more**.

Do każdego folderu można dopisać krótką notatkę. Kliknij opis folderu albo podpowiedź **Add description...**, żeby ją napisać. Pięć folderów kategorii ma stałe opisy, których nie da się zmienić.

Pamiętaj, że wbudowane pliki startowe są chronione. Można zmieniać ich nazwy i je kopiować, ale nie da się ich przenieść ani usunąć.

## Ponowne skanowanie po zmianach spoza aplikacji

Marinara trzyma wewnętrzną listę zasobów, żeby Game Mode szybko je odnajdywał. Przy wgrywaniu przez aplikację lista aktualizuje się sama.

Jeśli skopiujesz pliki do folderu zasobów gry bezpośrednio na komputerze, poza aplikacją, aplikacja od razu tego nie zauważy. Kliknij przycisk **Rescan**, żeby ponownie odczytała folder i wykryła nowe pliki. Przycisk **Rescan** jest zarówno na pasku narzędzi panelu **Asset Browser**, jak i w sekcji **Game Assets** w panelu **Settings**.

## Wybór zasobów dostępnych dla gry

Każdy czat w trybie Game Mode może ograniczyć się tylko do części folderów zasobów. Przydaje się to na przykład wtedy, gdy gra grozy ma pomijać wesołą muzykę.

W trakcie konfiguracji rozwiń sekcję **Adjust Game Assets for this Game** w kroku **Features**. W istniejącej grze otwórz okno **Game Assets**.

Następnie:

1. Kliknij przycisk **Game assets**. Po włączeniu napis zmienia się na **Selecting**.
2. Użyj małej kontrolki stanu przy każdym folderze, żeby go włączyć lub wykluczyć.

Pasek pokazuje "All folders included" albo liczbę wykluczonych folderów, razem z przyciskiem **Reset to all**, który przywraca wszystkie. Ten wybór zapisuje się tylko dla tego jednego czatu. Zmienia zestaw folderów, z których Game Mode może wybierać, ale nie usuwa ani nie ukrywa żadnych plików. Poza tym czatem w trybie Game Mode nie ma żadnego wpływu.

## Własny folder muzyki dla agenta Music DJ

**Music DJ** to pomocniczy agent, który potrafi odtwarzać muzykę w trakcie gry. W trybie Custom odtwarza ścieżki z wybranego folderu. Ten folder da się ustawić w dwóch miejscach.

Po włączeniu agenta **Music DJ** dla czatu formularz konfiguracji trzyma się źródła zapisanego w agencie Music DJ. Opcja **Game Assets** pokazuje ścieżkę wewnątrz zasobów gry, na przykład `music` albo `music/combat`. Opcja **Folder on this device** pokazuje zapisaną ścieżkę na urządzeniu serwera oraz przycisk **Choose Folder**.

Pełny edytor agenta **Music DJ** ma sekcję **Custom Music Library**. Przełącznik **Use Game Assets music folder** wybiera jeden z dwóch trybów:

- Przełącznik włączony: pole **Game Assets music folder** wskazuje folder wewnątrz zasobów gry, na przykład `music` albo `music/combat`. Przycisk **Open Folder** otwiera ten folder na maszynie serwera.
- Przełącznik wyłączony: pole **Music folder on this device** pozwala trybowi Custom odtwarzać muzykę z dowolnego folderu na komputerze, na którym działa serwer. Kliknij przycisk **Select Folder**, żeby otworzyć systemowe okno wyboru folderu, albo wklej ścieżkę folderu do pola.

Wybór folderu spoza aplikacji wymaga podwyższonych uprawnień. Na tym samym komputerze co serwer działa bez dodatkowej konfiguracji. Z innego urządzenia lub przez zdalny dostęp trzeba najpierw skonfigurować dostęp administracyjny. Sposób włączenia opisuje przewodnik [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md). Wszystko pozostałe o odtwarzaczu muzyki znajdziesz w przewodniku [Music DJ](../media/music.md).

## Otwieranie folderu na komputerze

Przycisk **Open in system folder** otwiera zaznaczony folder zasobów w zwykłym menedżerze plików komputera. Działa to tylko wtedy, gdy aplikacja jest używana na tym samym komputerze, na którym działa serwer. Na telefonie, tablecie lub innym komputerze aplikacja informuje, że foldery systemowe można otworzyć wyłącznie z urządzenia hostującego Marinara.

## Powiązane przewodniki

- [Music DJ: Spotify, YouTube i muzyka lokalna](../media/music.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
