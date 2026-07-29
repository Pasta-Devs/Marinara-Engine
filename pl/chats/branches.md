# Gałęzie czatu

Z tego przewodnika dowiesz się, czym jest gałąź czatu w aplikacji Marinara Engine i jak ją utworzyć. Znajdziesz tu też opis przełączania, zmiany nazwy, usuwania, eksportu i importu gałęzi. Dzięki gałęzi da się sprawdzić inny przebieg czatu bez utraty oryginału.

## Czym jest gałąź

Gałąź to kopia czatu ze wspólną historią do wybranego miejsca. Gałęzie służą do sprawdzania innego kierunku fabuły, a oryginalny czat zostaje nietknięty.

Wszystkie gałęzie tego samego czatu są zgrupowane razem. Na liście czatów czat z więcej niż jedną gałęzią zajmuje jeden wiersz. Obok niego widać małą liczbę gałęzi. Gałęzie otwiera się i przełącza w panelu podręcznym **Chat Branches** (gałęzie czatu) – opis poniżej.

Każda gałąź może mieć własną nazwę wyświetlaną, więc da się je opisać na przykład jako "przyjazne zakończenie" i "mroczne zakończenie". Ta nazwa wyświetlana jest niezależna od nazwy samego czatu.

## Przycisk **Branch from here**

Gałąź tworzy się z dowolnej wiadomości w czacie.

1. Najedź na wiadomość (na telefonie dotknij jej), żeby pokazał się pasek akcji wiadomości.
2. Kliknij przycisk **Branch from here** (utwórz gałąź od tego miejsca). Ma on małą ikonę rozgałęzienia.

Marinara kopiuje czat do tej wiadomości włącznie i zapisuje go jako nową gałąź. Nowa gałąź:

- Zachowuje ten sam tryb, postacie, personę, preset promptu i połączenie co czat źródłowy.
- Kopiuje każdą wiadomość, w tym wszystkie swipe'y (alternatywne odpowiedzi) oraz informację o tym, który swipe był aktywny. Działanie swipe'ów opisuje przewodnik [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md).
- Kopiuje zapisane stany trackerów i stan gry powiązane ze skopiowanymi wiadomościami, więc czaty w trybie Roleplay i Game Mode zachowują swój stan.
- Startuje z nazwą wyświetlaną **New Branch**. Nazwę można zmienić (opis poniżej).
- Zostaje w tym samym folderze czatów co czat źródłowy.

Podsumowania dzienne i tygodniowe nie są przenoszone. Podsumowania bieżące z zapisanymi zakresami wiadomości w całości zawartymi w kopiowanej gałęzi są przenoszone i przypisywane do nowych identyfikatorów wiadomości tej gałęzi. Podsumowania, których zakres źródłowy przekracza punkt utworzenia gałęzi, oraz starsze podsumowania bez metadanych wiadomości są pomijane. Nowa gałąź tworzy te podsumowania od nowa.

Czatu sceny nie da się rozgałęzić. W czacie sceny przycisk **Branch from here** się nie pojawia. Czaty sceny mają zamiast niego osobną akcję **Clone from here** (klonowanie od tego miejsca). Jej działanie opisuje przewodnik [Sceny: odgałęzienie roleplayu](../roleplay/scenes.md).

## Panel podręczny **Chat Branches**

Panel otwiera się przyciskiem gałęzi na pasku narzędzi czatu. Przycisk ma ikonę rozgałęzienia i pokazuje aktualną liczbę gałęzi. Jego podpowiedź brzmi **Switch branch**.

Panel nosi tytuł **Chat Branches**, a pod nim widnieje podtytuł "Switch, import, export, or clean up this chat's branches." Wypisuje wszystkie gałęzie bieżącego czatu, a oglądana w danej chwili gałąź stoi na pierwszym miejscu. W każdym wierszu widać nazwę wyświetlaną gałęzi i czas ostatniej aktualizacji.

### Przełączanie na inną gałąź

Kliknij dowolny wiersz gałęzi w panelu, żeby ją otworzyć. Panel się zamyka, a widok czatu przechodzi na wybraną gałąź.

### Zmiana nazwy gałęzi

1. Otwórz panel **Chat Branches**.
2. W wierszu wybranej gałęzi kliknij przycisk z ołówkiem (zmiana nazwy).
3. Otwiera się okno **Rename Branch** z komunikatem "Set a display name for this chat branch."
4. Wpisz nową nazwę i zatwierdź przyciskiem **Rename**.

Marinara ignoruje pustą nazwę oraz nazwę, która się nie zmieniła.

### Usuwanie gałęzi

1. Otwórz panel **Chat Branches**.
2. W wierszu gałęzi kliknij przycisk z koszem (usuwanie).
3. Okno **Delete Branch** pyta "Delete this branch? Messages will be lost."
4. Zatwierdź przyciskiem **Delete**.

Usunięcie gałęzi kasuje tylko tę jedną gałąź i jej wiadomości. Pozostałe gałęzie zostają.

### Usuwanie wszystkich gałęzi

Kiedy czat ma co najmniej dwie gałęzie, na dole panelu pojawia się przycisk **Delete All Branches**. Pyta on "Delete all N branches? This cannot be undone." Zatwierdź przyciskiem **Delete All**, żeby usunąć naraz wszystkie gałęzie w grupie.

Da się to też zrobić z poziomu listy czatów. Usuń czat z gałęziami ikoną kosza. Pojawia się wtedy okno **Delete Chat** z pytaniem, co dokładnie usunąć. Do wyboru są przycisk **Delete This Branch Only** oraz przycisk **Delete All N Branches**. Więcej o usuwaniu z listy znajdziesz w przewodniku [Zarządzanie listą czatów](managing-chats.md).

## Eksport gałęzi

Panel **Chat Branches** ma u góry przyciski eksportu. Eksportują one gałąź oglądaną w danej chwili.

- **JSONL**: pobiera gałąź jako plik JSONL. Format JSONL zapisuje jedną wiadomość w jednej linii tekstu i jest zgodny z aplikacją SillyTavern.
- **Text**: pobiera gałąź jako zwykły zapis tekstowy czatu.

Zbiorczy eksport wielu czatów naraz opisuje przewodnik [Eksport i import czatów](export-import.md). Ten sam przewodnik omawia opcję dołączania rozumowania modelu do eksportu.

## Import pliku JSONL jako nowej gałęzi

Plik z zapisanym czatem można wczytać jako nową gałąź otwartego czatu.

1. Otwórz panel **Chat Branches**.
2. Kliknij przycisk **Import**.
3. Wskaż plik JSONL (`.jsonl`) wyeksportowany z aplikacji SillyTavern lub Marinara Engine.

Marinara dodaje ten plik jako nową gałąź w grupie bieżącego czatu. Powinien pokazać się komunikat "Imported N messages as a new branch". Aplikacja przełącza się potem na nową gałąź.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
- [Eksport i import czatów](export-import.md)
- [Zarządzanie listą czatów](managing-chats.md)
