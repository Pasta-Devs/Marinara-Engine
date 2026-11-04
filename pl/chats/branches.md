# Gałęzie czatu

Gałąź to kopia czatu do wybranej wiadomości. Pozwala sprawdzić inny przebieg, a oryginał pozostaje bezpieczny. Ten przewodnik opisuje tworzenie, przełączanie, wyświetlanie, zmianę nazwy, usuwanie, eksport i import gałęzi.

Wszystkie gałęzie jednego czatu są zgrupowane. Na liście czatów czat zachowuje jeden wiersz i pokazuje liczbę gałęzi. Gdy co najmniej jedna gałąź w grupie ma zapisane, z którego czatu powstała, kliknij tę liczbę, żeby rozwinąć drzewo; gałąź bez takiego zapisu znajduje się bezpośrednio pod czatem. Jeśli żadna gałąź w grupie nie ma tego zapisu (starsze lub zaimportowane gałęzie), grupa zostaje w jednym wierszu, a jej gałęzie otwiera się z sekcji **Chat Branches** (gałęzie czatu). Gałąź utworzona z gałęzi jest zagnieżdżona pod nią, więc widać drzewo. Każda gałąź ma nazwę wyświetlaną i czas ostatniej aktywności, więc da się je opisać na przykład jako "przyjazne zakończenie" i "mroczne zakończenie". Nazwa wyświetlana jest niezależna od nazwy czatu. Grupa Game zajmuje jeden wiersz, bo sesje Game to numerowane sesje, a nie gałęzie.

## Przycisk Branch from here

1. Dotknij wiadomości (na komputerze najedź na nią kursorem), żeby pokazać pasek akcji wiadomości.
2. Kliknij **Branch from here** (utworzenie gałęzi stąd), małą ikonę rozgałęzienia.

Marinara kopiuje czat do tej wiadomości włącznie i zapisuje go jako nową gałąź o nazwie **New Branch**. Nazwę możesz później zmienić.

Nowa gałąź:

- Zachowuje ten sam tryb, postacie, personę, preset promptu i połączenie.
- Kopiuje każdą wiadomość ze wszystkimi swipe'ami i informacją o tym, który swipe był aktywny. Zobacz [Działania na wiadomości](messages.md).
- Kopiuje stan trackerów i stan gry powiązane ze skopiowanymi wiadomościami.
- Zachowuje pracę Advanced Memory w czacie w trybie Roleplay. Wspomnienia wcześniejszych, zakończonych scen pozostają gotowe do przywołania. Scena, od której tworzysz gałąź, znów staje się sceną w toku, a jej stare wspomnienia zostają odrzucone. Zobacz [Memory Recall i podsumowania czatu](../agents/memory.md).
- Zostaje w tym samym folderze czatów co czat źródłowy.

Podsumowania dzienne i tygodniowe nie są przenoszone. Podsumowania bieżące, które w całości mieszczą się w skopiowanych wiadomościach, są przenoszone. Podsumowania, które przekraczają punkt utworzenia gałęzi, oraz stare podsumowania bez danych o wiadomościach są pomijane, a gałąź tworzy je od nowa.

Jeśli to nie zadziałało: w czacie sceny przycisk **Branch from here** się nie pojawia. Czaty sceny mają zamiast niego **Clone from here** (klonowanie od tego miejsca). Zobacz [Sceny: odgałęzienie roleplayu](../roleplay/scenes.md).

## Sekcja Chat Branches

Otwórz **Chat Settings** (ustawienia czatu) i rozwiń sekcję **Chat Branches** pod **Chat Name** (nazwa czatu). Jej nagłówek pokazuje liczbę gałęzi. Na komputerze możesz wydzielić ją do osobnego okna. Zobacz [Panel **Chat Settings** – przegląd](chat-settings.md#popping-a-section-out-into-its-own-window).

Sekcja wypisuje wszystkie gałęzie czatu, a oglądana gałąź jest na pierwszym miejscu. Każdy wiersz pokazuje nazwę wyświetlaną i czas ostatniej aktualizacji. Kliknij wiersz, żeby przełączyć się na tę gałąź.

Przyciski nad listą:

| Przycisk | Do czego służy |
| --- | --- |
| **Branch graph** (graf gałęzi) | Otwiera okno grafu. Opis poniżej. |
| **JSONL**, **Text**, **Markdown**, **Story** | Eksportują oglądaną gałąź. Zobacz [Eksport i import czatów](export-import.md). |
| **Export a range** (eksport zakresu) | Eksportuje część czatu. Niedostępne w trybie Game. Zobacz [Eksport i import czatów](export-import.md#export-part-of-a-chat). |
| **Import** (import) | Dodaje plik `.jsonl` jako nową gałąź. Opis poniżej. |
| **Stats** (statystyki) | Otwiera statystyki czatu dla oglądanej gałęzi. |

### Wyświetlanie grafu gałęzi

Graf pokazuje, w którym miejscu oddzieliła się każda gałąź, czego lista nie potrafi pokazać.

1. Otwórz sekcję **Chat Branches** i kliknij **Branch graph**. Kliknij go ponownie, aby zamknąć graf.

Graf otwiera się we własnym oknie, które można przenosić i skalować. Na telefonie otwiera się jako wysuwany panel. Każdy czat w grupie ma jeden wiersz, w tej samej kolejności co lista czatów. Wiadomości biegną od lewej do prawej, po jednej kropce na wiadomość.

- Szare kropki to twoje wiadomości, kropki w kolorze akcentu to odpowiedzi postaci, a puste kółka to wiadomości narratora lub systemowe.
- Gałąź rysuje tylko własne wiadomości. Linia łączy ją z wiadomością, od której powstała.
- Gałąź bez zapisanego punktu rozwidlenia jest rysowana od czatu na górze przerywaną linią, a legenda pokazuje **Fork not recorded** (nie zapisano rozwidlenia). Dotyczy to starszych gałęzi i gałęzi, których czat źródłowy usunięto.
- Długie odcinki bez rozwidlenia zwijają się do znacznika **··· N ···**, gdzie N to liczba ukrytych wiadomości. Kliknij go, aby je pokazać. **Expand all** (rozwiń wszystko) rozwija każdy odcinek, a **Collapse long runs** (zwiń długie odcinki) zwija je ponownie.
- Punkty rozwidleń i ostatnia wiadomość każdej gałęzi mają obwódkę. Dotknij jej, najedź na nią kursorem lub ustaw na niej fokus klawiaturą, aby zobaczyć numer wiadomości, jej autora i początek tekstu.
- Kliknij nazwę lub wiersz gałęzi, aby się na nią przełączyć. Oglądana gałąź jest wyróżniona.

Graf aktualizuje się po utworzeniu gałęzi, zmianie nazwy lub usunięciu czatu oraz krótko po pojawieniu się nowych wiadomości.

### Zmiana nazwy gałęzi

1. W sekcji **Chat Branches** kliknij przycisk z ołówkiem w wierszu gałęzi.
2. W oknie **Rename Branch** (zmiana nazwy gałęzi) z komunikatem "Set a display name for this chat branch." wpisz nową nazwę.
3. Kliknij **Rename** (zmień nazwę).

Pusta albo niezmieniona nazwa jest ignorowana.

### Usuwanie gałęzi

1. W sekcji **Chat Branches** kliknij przycisk z koszem w wierszu gałęzi.
2. W oknie **Delete Branch** (usunięcie gałęzi) z pytaniem "Delete this branch? Messages will be lost." kliknij **Delete** (usuń).

Usuwa to tylko tę gałąź i jej wiadomości. Pozostałe gałęzie zostają.

Przy co najmniej dwóch gałęziach na dole sekcji pojawia się przycisk **Delete All Branches** (usunięcie wszystkich gałęzi). Pyta on "Delete all N branches? This cannot be undone." Potwierdź przyciskiem **Delete All** (usuń wszystkie). Możesz też zacząć od listy czatów: przy usuwaniu czatu z gałęziami są tam do wyboru **Delete This Branch Only** (usunięcie tylko tej gałęzi) i **Delete All N branches** (usunięcie wszystkich N gałęzi). Zobacz [Zarządzanie listą czatów](managing-chats.md#delete-a-chat).

### Importowanie pliku jako nowej gałęzi

1. W sekcji **Chat Branches** kliknij **Import**.
2. Wybierz plik `.jsonl` wyeksportowany z aplikacji SillyTavern lub Marinara Engine.

Marinara dodaje go jako nową gałąź w grupie bieżącego czatu, pokazuje komunikat "Imported N messages as a new branch" i przełącza się na nią.

## Jak gałęzie są ze sobą powiązane

Ta sekcja jest dla osób, które budują rozwiązania na danych gałęzi.

- Każda gałąź zapisuje swój bezpośredni czat źródłowy i wiadomość, przy której powstało rozwidlenie. Zachowywane jest zarówno ID wiadomości źródłowej, jak i ID jej kopii, więc integracje znajdą granicę rozwidlenia, mimo że skopiowane wiadomości dostają nowe ID.
- Utworzenie gałęzi z gałęzi zapisuje tę gałąź jako rodzica, a nie pierwotny czat główny.
- Gdy co najmniej jedna gałąź w grupie ma zapisane źródło, kliknięcie liczby na liście czatów rozwija drzewo. Gałąź o nieznanym źródle znajduje się bezpośrednio pod czatem. Grupa bez żadnego znanego źródła zajmuje jeden wiersz, a do jej gałęzi przechodzi się z sekcji **Chat Branches**.
- Usunięcie czatu nadrzędnego nie zmienia zapisanego źródła jego dzieci. Usunięcie całej grupy usuwa każdy jej czat.
