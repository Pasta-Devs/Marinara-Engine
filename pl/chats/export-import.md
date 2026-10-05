# Eksport i import czatów

Z tego przewodnika dowiesz się, jak zapisać czat do pliku i jak wczytać czat z powrotem do aplikacji Marinara Engine. Wyeksportować można jeden czat albo wiele czatów naraz. Da się też zaimportować plik czatu pochodzący z aplikacji Marinara Engine lub z aplikacji SillyTavern (innego programu do czatów roleplay).

## Formaty plików, które zobaczysz

Marinara używa dwóch formatów plików czatu.

- **JSONL**: JSONL to skrót od JSON Lines. To zwykły plik tekstowy, w którym każda wiadomość zajmuje jedną linię. To domyślny format eksportu. Plik JSONL da się później zaimportować z powrotem do aplikacji Marinara Engine.
- **Text**: zwykły, czytelny zapis rozmowy w pliku `.txt`. Łatwo go przeczytać i przekazać dalej, ale Marinara nie potrafi go zaimportować z powrotem. Format **Text** wybieraj tylko wtedy, gdy czat ma przeczytać człowiek.

Import czatu przyjmuje wyłącznie plik `.jsonl`. Jeśli czat ma się dać później zaimportować, wyeksportuj go jako **JSONL**, a nie jako **Text**.

## Eksport pojedynczego czatu

Do zapisania jednego czatu do pliku służy sekcja **Chat Branches** (gałęzie czatu) w **Chat Settings**. To najszybszy sposób na wyeksportowanie historii pojedynczej rozmowy.

1. Otwórz czat przeznaczony do eksportu.
2. Otwórz **Chat Settings** i rozwiń sekcję **Chat Branches** pod **Chat Name**.
3. Kliknij przycisk **JSONL**, żeby zapisać czat jako plik JSONL, albo przycisk **Text**, żeby zapisać go jako czytelny plik tekstowy.
4. Przeglądarka pobiera plik.

Pobrany plik zawiera aktualnie otwarty czat razem z jego wiadomościami.

## Eksport wielu czatów naraz

Można zaznaczyć wiele czatów i pobrać je razem w jednym pliku `.zip`.

1. Otwórz listę czatów na lewym pasku bocznym.
2. Wybierz zakładkę odpowiedniego trybu: **CONVO** (Conversation), **RP** (Roleplay) lub **GM** (Game). Każda zakładka eksportuje tylko własne czaty.
3. Kliknij przycisk **Select chats** (zaznaczanie czatów) u góry listy czatów.
4. Kliknij kolejno każdy czat, który ma się znaleźć w pliku. Przy każdym z nich włącza się pole wyboru.
5. Na dole pojawia się pasek z licznikiem, na przykład "3 selected".
6. Kliknij przycisk **Export** na tym pasku.
7. Przeglądarka pobiera plik `.zip` z zapisami w formacie JSONL – po jednym pliku na czat.

Eksport zbiorczy zawsze korzysta z formatu **JSONL**. Przycisk **Delete** na tym samym pasku kliknij tylko wtedy, gdy zamiast eksportu chcesz usunąć zaznaczone czaty.

## Import czatu jako nowego czatu

W ten sposób z pliku `.jsonl` powstaje zupełnie nowy czat. Przyda się do wczytania plików czatu zapisanych w aplikacji Marinara Engine lub wyeksportowanych z aplikacji SillyTavern.

1. Otwórz listę czatów na lewym pasku bocznym.
2. Wybierz zakładkę odpowiedniego trybu: **CONVO**, **RP** lub **GM**. Marinara tworzy zaimportowany czat w zakładce otwartej w danej chwili.
3. Kliknij przycisk importu obok przycisku **New** u góry listy. Jego podpowiedź brzmi **Import SillyTavern or Marinara chat JSONL**.
4. W oknie wyboru plików wskaż plik `.jsonl`.
5. Powinien pojawić się komunikat "Imported N messages", a Marinara przełącza widok na nowy czat.

Jeśli nowy czat ma działać w trybie Roleplay, otwórz zakładkę **RP** przed importem. O trybie decyduje otwarta zakładka, a nie plik.

## Import czatu jako nowej gałęzi

Plik `.jsonl` da się też wczytać do istniejącego czatu jako nową gałąź. Gałąź to osobna zapisana kopia czatu, którą można rozwijać niezależnie. Więcej o gałęziach znajdziesz w przewodniku [Gałęzie czatu](branches.md).

1. Otwórz czat, do którego ma trafić nowa gałąź.
2. Otwórz **Chat Settings** i rozwiń sekcję **Chat Branches**.
3. W tej sekcji kliknij przycisk **Import**.
4. Wskaż plik `.jsonl`.
5. Powinien pojawić się komunikat "Imported N messages as a new branch".

Nowa gałąź dołącza do otwartego czatu. Przejmuje z niego postacie, personę, połączenie i preset promptu.

## Dołączanie toku rozumowania do eksportów

Niektóre modele zapisują razem z odpowiedzią ukryty tok myślenia lub rozumowania. Osobne ustawienie decyduje o tym, czy ten ukryty tekst trafia do plików eksportu.

To ustawienie nazywa się **Include reasoning in exports** (dołączanie toku rozumowania do eksportów). Znajdziesz je w panelu **Settings** (Ustawienia), na zakładce **Advanced**, w sekcji **Message Tools**. Jest to przełącznik, domyślnie ustawiony na **off**.

- W pozycji **off** Marinara pomija zapisany tok myślenia i rozumowania zarówno w eksporcie **JSONL**, jak i **Text**.
- W pozycji **on** Marinara dopisuje ten ukryty tok myślenia i rozumowania do obu formatów.

Ustawienie działa tak samo przy eksporcie pojedynczego czatu i przy eksporcie zbiorczym do pliku `.zip`.

Zanim przekażesz komuś zapis rozmowy, zostaw **Include reasoning in exports** wyłączone. W ukrytym toku rozumowania mogą siedzieć notatki, których nie chcesz nikomu wysyłać. Włączaj je tylko wtedy, gdy pełny zapis ma zostać u ciebie.

## Powiązane przewodniki

- [Gałęzie czatu](branches.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
- [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md)
- [Przegląd ustawień](../settings/settings-overview.md)
