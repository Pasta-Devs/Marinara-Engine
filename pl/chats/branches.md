# Gałęzie czatu

Z tego przewodnika dowiesz się, czym jest gałąź czatu w aplikacji Marinara Engine i jak ją utworzyć. Znajdziesz tu też opis przełączania, wyświetlania grafu gałęzi, zmiany nazwy, usuwania, eksportu i importu gałęzi. Dzięki gałęzi da się sprawdzić inny przebieg czatu bez utraty oryginału.

## Czym jest gałąź

Gałąź to kopia czatu ze wspólną historią do wybranego miejsca. Gałęzie służą do sprawdzania innego kierunku fabuły, a oryginalny czat zostaje nietknięty.

Wszystkie gałęzie tego samego czatu są zgrupowane razem. Na liście czatów czat zachowuje swój wiersz i pokazuje liczbę gałęzi. Gdy co najmniej jedna gałąź w grupie ma zapisane, z którego czatu w tej grupie powstała, kliknięcie tej liczby rozwija pod nim gałęzie; gałąź o nieznanym źródle znajduje się bezpośrednio pod czatem. Sesje Game to numerowane sesje, więc grupa Game zawsze zajmuje jeden wiersz. Każda gałąź pokazuje nazwę wyświetlaną i czas ostatniej aktywności. Gałąź utworzona z gałęzi jest zagnieżdżona pod nią, więc gałęzie gałęzi tworzą drzewo. Możesz przejść prosto do gałęzi z listy albo użyć sekcji **Chat Branches** (gałęzie czatu) w **Chat Settings** do zmiany nazwy, usuwania, eksportu i importu – opis poniżej.

Każda gałąź może mieć własną nazwę wyświetlaną, więc da się je opisać na przykład jako "przyjazne zakończenie" i "mroczne zakończenie". Ta nazwa wyświetlana jest niezależna od nazwy samego czatu.

Pochodzenie gałęzi zapisuje bezpośredni czat źródłowy i wiadomość rozwidlenia. Zachowuje ID źródłowej wiadomości i jej kopii, dzięki czemu integracje rozpoznają granicę mimo nowych ID kopii. Gałąź utworzona z gałęzi wskazuje ją jako bezpośredniego rodzica, nie pierwotny czat główny. Starsze gałęzie i zaimportowane gałęzie równoległe zachowują nazwę, ale nie mają znanego pochodzenia: grupa bez znanego pochodzenia zachowuje jeden wiersz na liście czatów, a jej gałęzie nadal otwiera się w sekcji **Chat Branches**.

## Przycisk **Branch from here**

Gałąź tworzy się z dowolnej wiadomości w czacie.

1. Najedź na wiadomość (na telefonie dotknij jej), żeby pokazał się pasek akcji wiadomości.
2. Kliknij przycisk **Branch from here** (utwórz gałąź od tego miejsca). Ma on małą ikonę rozgałęzienia.

Marinara kopiuje czat do tej wiadomości włącznie i zapisuje go jako nową gałąź. Nowa gałąź:

- Zachowuje ten sam tryb, postacie, personę, preset promptu i połączenie co czat źródłowy.
- Kopiuje każdą wiadomość, w tym wszystkie swipe'y (alternatywne odpowiedzi) oraz informację o tym, który swipe był aktywny. Działanie swipe'ów opisuje przewodnik [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md).
- Kopiuje zapisane stany trackerów i stan gry powiązane ze skopiowanymi wiadomościami, więc czaty w trybie Roleplay i Game Mode zachowują swój stan.
- Zachowuje pracę Advanced Memory w czacie w trybie Roleplay, więc skopiowanej historii nie trzeba przygotowywać ponownie. Wspomnienia wcześniejszych, zakończonych scen pozostają gotowe do przywołania. Scena, od której tworzysz gałąź, znów staje się sceną w toku, a jej stare wspomnienia zostają odrzucone. Zobacz [Memory Recall i podsumowania czatu](../agents/memory.md).
- Startuje z nazwą wyświetlaną **New Branch**. Nazwę można zmienić (opis poniżej).
- Zostaje w tym samym folderze czatów co czat źródłowy.

Pusty czat ma kotwice wiadomości null. Usunięcie czatu nadrzędnego nie zmienia historycznego pochodzenia dzieci. Usunięcie całej grupy gałęzi nadal usuwa każdy jej czat.

Podsumowania dzienne i tygodniowe nie są przenoszone. Podsumowania bieżące z zapisanymi zakresami wiadomości w całości zawartymi w kopiowanej gałęzi są przenoszone i przypisywane do nowych identyfikatorów wiadomości tej gałęzi. Podsumowania, których zakres źródłowy przekracza punkt utworzenia gałęzi, oraz starsze podsumowania bez metadanych wiadomości są pomijane. Nowa gałąź tworzy te podsumowania od nowa.

Czatu sceny nie da się rozgałęzić. W czacie sceny przycisk **Branch from here** się nie pojawia. Czaty sceny mają zamiast niego osobną akcję **Clone from here** (klonowanie od tego miejsca). Jej działanie opisuje przewodnik [Sceny: odgałęzienie roleplayu](../roleplay/scenes.md).

## Sekcja **Chat Branches**

Otwórz **Chat Settings** i rozwiń sekcję **Chat Branches** pod **Chat Name**. Nagłówek pokazuje aktualną liczbę gałęzi. Na komputerze możesz otworzyć ją w osobnym oknie (zobacz [Panel **Chat Settings** – przegląd](chat-settings.md#popping-a-section-out-into-its-own-window)).

Sekcja wypisuje wszystkie gałęzie bieżącego czatu, a oglądana w danej chwili gałąź stoi na pierwszym miejscu. W każdym wierszu widać nazwę wyświetlaną gałęzi i czas ostatniej aktualizacji.

### Przełączanie na inną gałąź

Kliknij dowolny wiersz gałęzi, żeby ją otworzyć. Widok czatu przechodzi na wybraną gałąź.

### Wyświetlanie grafu gałęzi

Graf gałęzi pokazuje, w którym miejscu każda gałąź się oddzieliła, czego nie widać na liście.

1. Otwórz sekcję **Chat Branches**.
2. Kliknij przycisk **Branch graph** (graf gałęzi), długi przycisk nad przyciskami eksportu. Kliknij go ponownie, aby zamknąć graf.

Graf otwiera się we własnym oknie, które można przenosić i skalować. Na telefonie otwiera się jako wysuwany panel. Graf wypełnia okno: w większym oknie zwija mniej odcinków, a przy zapasie miejsca powiększa się i rozsuwa elementy. Nieco zbyt szeroki graf pomniejsza się do rozmiaru okna, ale nie poniżej trzech czwartych pierwotnego rozmiaru; przy większej szerokości przewija się w poziomie. Wiersze dzielą między siebie wysokość okna i przewijają się, gdy czatów jest zbyt wiele, by się zmieściły.

- Każdy czat w grupie ma jeden wiersz, w tej samej kolejności drzewa co lista czatów. Wiadomości biegną od lewej do prawej, po jednej kropce na wiadomość. Szare kropki to twoje wiadomości, kropki w kolorze akcentu to odpowiedzi postaci, a puste kółka to wiadomości narratora lub systemowe.
- Gałąź rysuje tylko własne wiadomości. Linia łączy ją z wiadomością, od której powstała, więc widać dokładne miejsce rozwidlenia.
- Starsze gałęzie i gałęzie, których czat źródłowy usunięto, nie mają zapisanego punktu rozwidlenia. Przerywana linia łączy je z czatem na górze, a legenda pokazuje **Fork not recorded** (nie zapisano rozwidlenia).
- Długie odcinki bez pobliskiego rozwidlenia zwijają się do znacznika **··· N ···**, gdzie N to liczba ukrytych wiadomości. Kliknij go, aby pokazać te wiadomości, lub użyj **Expand all** (rozwiń wszystko), aby rozwinąć każdy odcinek. **Collapse long runs** (zwiń długie odcinki) zwija je ponownie.
- Punkty rozwidleń i ostatnia wiadomość każdej gałęzi mają obwódkę. Najedź na obwódkę, dotknij jej lub ustaw na niej fokus klawiaturą, aby zobaczyć numer wiadomości, jej autora i początek tekstu.
- Kliknij nazwę lub wiersz gałęzi, aby do niej przejść. Oglądana gałąź jest wyróżniona, a graf otwiera się przewinięty do jej ostatniej wiadomości.

Graf aktualizuje się po utworzeniu gałęzi, zmianie nazwy lub usunięciu czatu oraz krótko po pojawieniu się nowych wiadomości.

### Zmiana nazwy gałęzi

1. Otwórz sekcję **Chat Branches**.
2. W wierszu wybranej gałęzi kliknij przycisk z ołówkiem (zmiana nazwy).
3. Otwiera się okno **Rename Branch** z komunikatem "Set a display name for this chat branch."
4. Wpisz nową nazwę i zatwierdź przyciskiem **Rename**.

Marinara ignoruje pustą nazwę oraz nazwę, która się nie zmieniła.

### Usuwanie gałęzi

1. Otwórz sekcję **Chat Branches**.
2. W wierszu gałęzi kliknij przycisk z koszem (usuwanie).
3. Okno **Delete Branch** pyta "Delete this branch? Messages will be lost."
4. Zatwierdź przyciskiem **Delete**.

Usunięcie gałęzi kasuje tylko tę jedną gałąź i jej wiadomości. Pozostałe gałęzie zostają.

### Usuwanie wszystkich gałęzi

Kiedy czat ma co najmniej dwie gałęzie, na dole sekcji pojawia się przycisk **Delete All Branches**. Pyta on "Delete all N branches? This cannot be undone." Zatwierdź przyciskiem **Delete All**, żeby usunąć naraz wszystkie gałęzie w grupie.

Da się to też zrobić z poziomu listy czatów. Usuń czat z gałęziami ikoną kosza. Pojawia się wtedy okno **Delete Chat** z pytaniem, co dokładnie usunąć. Do wyboru są przycisk **Delete This Branch Only** oraz przycisk **Delete All N Branches**. Więcej o usuwaniu z listy znajdziesz w przewodniku [Zarządzanie listą czatów](managing-chats.md).

## Eksport gałęzi

Sekcja **Chat Branches** ma u góry przyciski eksportu. Eksportują one gałąź oglądaną w danej chwili.

- **JSONL**: pobiera gałąź jako plik JSONL. Format JSONL zapisuje jedną wiadomość w jednej linii tekstu i jest zgodny z aplikacją SillyTavern.
- **Text**: pobiera gałąź jako zwykły zapis tekstowy czatu.
- **Markdown** i **Story**: pobierają gałąź jako czytelny plik Markdown albo sformatowaną stronę internetową. Zobacz [Formaty plików, które zobaczysz](export-import.md#file-formats-you-will-see).

Zbiorczy eksport wielu czatów naraz opisuje przewodnik [Eksport i import czatów](export-import.md). Ten sam przewodnik omawia opcję dołączania rozumowania modelu do eksportu.

## Import pliku JSONL jako nowej gałęzi

Plik z zapisanym czatem można wczytać jako nową gałąź otwartego czatu.

1. Otwórz sekcję **Chat Branches**.
2. Kliknij przycisk **Import**.
3. Wskaż plik JSONL (`.jsonl`) wyeksportowany z aplikacji SillyTavern lub Marinara Engine.

Marinara dodaje ten plik jako nową gałąź w grupie bieżącego czatu. Powinien pokazać się komunikat "Imported N messages as a new branch". Aplikacja przełącza się potem na nową gałąź.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
- [Eksport i import czatów](export-import.md)
- [Zarządzanie listą czatów](managing-chats.md)
