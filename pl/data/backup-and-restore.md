# Kopia zapasowa i przywracanie danych aplikacji Marinara

Z tego przewodnika dowiesz się, jak na dwa sposoby zapisać wszystko, co masz w aplikacji Marinara Engine, i jak później wgrać taki zapis z powrotem. Przyda się przed aktualizacją, przed przesiadką na nowe urządzenie i przed resetem danych.

## Dwa sposoby na zapisanie danych

Marinara daje dwie opcje zapisu. Każda leży w innym miejscu i służy do czegoś innego.

- **Download Backup** (pobranie kopii zapasowej) tworzy pełne archiwum **.zip** ze wszystkim, co leży na dysku. Plik **.zip** to jeden skompresowany plik, który mieści w sobie wiele innych plików. To najbardziej kompletny zapis i najlepsze zabezpieczenie przed utratą danych.
- **Export Profile** (eksport profilu) tworzy lżejszy plik z danymi konta: postaciami, personami, czatami, lorebookami, presetami, agentami, motywami i rozszerzeniami Personal Extensions. Profil to przenośna kopia konta w formacie aplikacji Marinara Engine. Da się ją później przywrócić w samej aplikacji.

Jeśli chodzi tylko o jeden bezpieczny zapis całości, wybierz **Download Backup**. Opcja **Export Profile** przyda się wtedy, gdy potrzebny jest mniejszy plik albo wersja czytelna dla innych narzędzi do roleplayu.

Obie opcje zapisu znajdziesz w sekcji **Backup & Export** w panelu **Settings** (Ustawienia), na zakładce **Advanced**.

## Dostęp na tym samym urządzeniu i na innym

Na komputerze, który uruchamia aplikację Marinara Engine, obie funkcje działają od razu. To przypadek pętli zwrotnej, czyli sytuacja, w której aplikacja została otwarta pod adresem `localhost` albo `127.0.0.1` na tej samej maszynie.

Z telefonu, tabletu i każdego innego urządzenia kopia zapasowa oraz przywracanie wymagają sekretu **Admin Access** (dostęp administratora). Ustaw sekret na serwerze, a potem wklej tę samą wartość w panelu **Settings**, na zakładce **Advanced**, w polu **Admin Access**. Zajrzyj do przewodnika o dostępie zdalnym podlinkowanego na końcu.

## Download Backup

Opcja **Download Backup** tworzy jeden plik **.zip** z bazą danych, ustawieniami i wszystkimi folderami multimediów: awatarami, sprite'ami, tłami, obrazami z galerii, czcionkami, własnym dźwiękiem powiadomień i resztą.

1. Otwórz panel **Settings**.
2. Przejdź na zakładkę **Advanced**.
3. Znajdź sekcję **Backup & Export**.
4. Kliknij przycisk **Download Backup**.
5. W trakcie pracy na przycisku widnieje napis **Creating backup…**.
6. Kiedy archiwum jest gotowe, Marinara przesyła je strumieniowo prosto do przeglądarki, bez przechowywania całego pliku w pamięci strony.
7. Zależnie od ustawień pobierania przeglądarka otwiera zwykłe okno **Save As** albo umieszcza plik w folderze pobranych plików.

Ten krok ma największe znaczenie w systemach Android i iOS. Na tych urządzeniach folder z danymi aplikacji zwykle pozostaje poza zasięgiem. Dlatego opcja **Download Backup** to jedyny prosty sposób, żeby przenieść kopię poza urządzenie. Zapisz ją w bezpiecznym i prywatnym miejscu, na przykład we własnej chmurze.

W pliku **.zip** znajduje się też zwykły plik tekstowy `RESTORE.txt`. Wyjaśnia, jak w razie potrzeby odzyskać dane ręcznie. Traktuj kopię zapasową jak coś prywatnego: może zawierać tajne pliki, które odblokowują zapisane klucze API. Opis zawartości poszczególnych folderów znajdziesz w przewodniku o lokalizacji danych podlinkowanym niżej.

## Automatyczne kopie zapasowe

Sekcja **Backup & Export** potrafi też tworzyć rotacyjną, automatyczną pełną kopię zapasową na urządzeniu z aplikacją Marinara Engine.
Włącz przełącznik **Automatic Backups** (automatyczne kopie zapasowe), wybierz **Daily**, **Weekly** albo **Monthly** i ustaw pole
**Automatic backups kept** na wartość od 1 do 9999. Pierwszą kopię Marinara tworzy krótko po włączeniu tej opcji. Po każdym
udanym przebiegu zachowuje tyle najnowszych automatycznych archiwów, ile wynosi ustawienie, i usuwa najstarsze nadmiarowe
archiwum automatyczne. Ten limit nigdy nie kasuje kopii ręcznych ani kopii zapisanych przez **Download Backup**.

Automatyczne kopie zapasowe lądują w folderze `backups/` wewnątrz folderu danych aplikacji Marinara Engine. Najnowsze archiwum to
`marinara-automatic-backup.zip`; zachowane starsze archiwa automatyczne mają w nazwie znacznik czasu. Format archiwum jest ten sam,
strumieniowy i gotowy do przywrócenia, co przy **Download Backup** – razem z wgranymi multimediami i plikiem klucza szyfrowania,
jeśli taki istnieje. Trzymaj osobną kopię poza folderem danych aplikacji Marinara Engine, jeśli chcesz zabezpieczyć się przed awarią
dysku, wyczyszczeniem pamięci aplikacji albo resetem urządzenia.

## Export Profile

Opcja **Export Profile** tworzy mniejszy plik z danymi konta. Multimedia też się w nim znajdują, więc awatary, obrazy i własny dźwięk powiadomień wędrują razem z resztą.

1. Otwórz panel **Settings**.
2. Przejdź na zakładkę **Advanced**.
3. Znajdź sekcję **Backup & Export**.
4. Kliknij przycisk **Export Profile**.
5. Otwiera się okno **Export Profile** z dwiema możliwościami.
6. Wybierz format (opis niżej).
7. Plik pobiera się na urządzenie.

Okno oferuje dwa formaty:

| Format | Co to jest | Da się przywrócić w aplikacji Marinara Engine? |
| --- | --- | --- |
| **Marinara Native** | Zachowuje pola aplikacji Marinara Engine, foldery lorebooków, dane postaci i person, presety, agentów, motywy, wersje robocze rozszerzeń Personal Extensions oraz multimedia osadzone w pliku. | Tak |
| **Compatible JSON** | Zwykłe pliki postaci, person i lorebooków dla innych narzędzi do roleplayu. | Nie |

Wybierz **Marinara Native**, żeby zachować kopię możliwą do późniejszego przywrócenia w aplikacji Marinara Engine. Mniejsze profile
pobierają się jako `marinara-profile.json`; większe trafiają do strumieniowego pliku `marinara-profile.zip`, w którym dane dzielą się
na ograniczone rozmiarem pliki tabel, dzięki czemu duża biblioteka nie musi zmieścić się w jednym ciągu JSON w pamięci.

Kod rozszerzeń Personal Extensions zostaje zachowany w profilu natywnym, ale stan włączenia i zgoda na uruchamianie już nie. Każde przywrócone rozszerzenie trafia do aplikacji wyłączone i wymaga ponownego przejrzenia w **Settings** > **Addons**.

Format **Compatible JSON** wybieraj tylko wtedy, gdy chcesz przenieść postacie albo lorebooki do innego narzędzia. Pobiera się jako plik **.zip** ze zwykłymi plikami. Takiego pliku nie da się przywrócić w aplikacji Marinara Engine przez **Import Profile**.

## Przywracanie przez Import Profile

Żeby wgrać z powrotem zapisany profil albo archiwum z **Download Backup**, użyj opcji **Import Profile** (import profilu). Znajdziesz ją na innej zakładce niż narzędzia do zapisu.

1. Otwórz panel **Settings**.
2. Przejdź na zakładkę **Imports**.
3. Znajdź sekcję **Profile & Marinara**.
4. Kliknij przycisk **Import Profile (JSON/ZIP)**.
5. Wskaż plik. Może to być `marinara-profile.json`, `marinara-profile.zip` albo pełny plik **.zip** z **Download Backup**.
6. Marinara najpierw sprawdza zawartość pliku. Na przycisku widnieje wtedy napis **Scanning Profile...**.
7. Pojawia się okno **Import Profile**. Wypisuje, co udało się znaleźć, na przykład liczbę postaci i person.
8. Okno ostrzega, że importu nie da się cofnąć. Przeczytaj treść, a potem kliknij przycisk **Import**, żeby kontynuować, albo **Cancel**, żeby przerwać.
9. Import rusza i pokazuje napis **Importing Profile...** wraz z paskiem postępu.

Niedawno utworzony profil z aplikacji Marinara Engine przywraca się przez dopasowanie tożsamości każdego elementu, a nie jego nazwy. Dlatego import tego samego profilu po raz drugi aktualizuje istniejące elementy w miejscu, zamiast tworzyć duplikaty.

Bardzo stare pliki profilu, z dużo wcześniejszych wersji, nie mają tej właściwości. Ponowny import takiego pliku potrafi utworzyć zduplikowane postacie, persony i lorebooki. Przy przywracaniu wyłącznie świeżych eksportów ten problem w ogóle nie występuje.

Jeśli po wskazaniu pliku zmieni się on na dysku, zanim import zostanie potwierdzony, operacja zatrzymuje się z ostrzeżeniem. Wystarczy wskazać plik jeszcze raz.

Kiedy w pliku **.zip** brakuje części plików multimedialnych, import mimo to dobiega końca. Pokazuje bursztynowe ostrzeżenie z listą brakujących plików i importuje całą resztę.

## Po przywróceniu: wpisz klucze od nowa

Opcja **Export Profile** usuwa tajne wartości z pliku profilu. Zapisane klucze API i adresy webhooków są w nim puste. Dzięki temu plik profilu można bezpiecznie przechowywać i udostępniać. Klucz API to hasło, które łączy aplikację Marinara Engine z dostawcą AI.

Z archiwum **Download Backup** sprawa wygląda inaczej. Marinara nie usuwa z niego tajnych danych. Plik **.zip** z kopią zapasową to surowy zapis danych. Zawiera zapisane klucze i tajny plik, który potrafi je odblokować. Nigdy nie udostępniaj tego pliku **.zip**. Trzymaj go w prywatnym miejscu.

Opcja **Import Profile** przywraca dane z pliku profilu, nawet gdy wskażesz plik **.zip** z kopią zapasową. Archiwum ma w środku kopię pliku profilu i to właśnie ją czyta import. Dlatego elementy utworzone przez import mają puste klucze i adresy webhooków.

Po zaimportowaniu profilu zrób tak:

1. Otwórz panel **Settings**.
2. Przejdź na zakładkę **Connections**.
3. Wpisz od nowa klucz API dla każdego używanego dostawcy.

Jeśli używasz własnych narzędzi wywołujących adres webhooka, wpisz ten adres od nowa również przy każdym narzędziu.

Import nie kasuje kluczy, które są już wpisane. Przy ponownym imporcie starego profilu Marinara zachowuje aktualne klucze i adresy webhooków przy elementach, które nadal istnieją. Ponowny import ich nie wyczyści.

## Lista Existing backups

Sekcja **Backup & Export** może pokazywać listę **Existing backups** (istniejące kopie zapasowe) razem z przyciskiem usuwania. Przy zwykłym używaniu aplikacji lista pozostaje pusta. Opcja **Download Backup** zapisuje plik prosto na urządzenie. Nie zostawia kopii na tej liście, a pojedynczym rotacyjnym archiwum automatycznym zarządza osobno przełącznik **Automatic Backups**. Ta lista nie jest potrzebna do utworzenia ani przechowania pobranej kopii zapasowej.

## Powiązane przewodniki

- [Gdzie Marinara przechowuje dane](where-data-is-stored.md)
- [Czyszczenie i resetowanie danych](clearing-data.md)
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
