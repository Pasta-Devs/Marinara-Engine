# Eksport i import czatów

Zapisz czat do pliku, udostępnij go jako czytelną opowieść albo wczytaj z powrotem plik czatu z aplikacji Marinara Engine lub z aplikacji SillyTavern (innego programu do czatów roleplay). Wyeksportować można jeden czat, część czatu albo wiele czatów naraz.

<a id="file-formats-you-will-see"></a>

## Formaty plików, które zobaczysz

| Format | Co to jest | Da się go zaimportować z powrotem? |
| --- | --- | --- |
| **JSONL** | JSON Lines, czyli zwykły plik tekstowy, w którym każda wiadomość zajmuje jedną linię. To domyślny format. | Tak |
| **Text** | Czytelny zapis rozmowy w pliku `.txt`. | Nie |
| **Markdown** | Czytelny plik `.md`. Zaczyna się od nazwy czatu i zakresu dat, których dotyczy, a potem przytacza każdą wiadomość pod imieniem jej autora. | Nie |
| **Story** | Sformatowana strona internetowa w pliku `.html` z imieniem i awatarem każdego autora. Otwórz ją w przeglądarce, żeby ją przeczytać, udostępnić lub wydrukować. | Nie |

Pliki **Markdown** i **Story** pomijają wiadomości systemowe oraz wiadomości ukryte przed tobą. Import czatu przyjmuje wyłącznie pliki `.jsonl`, więc jeśli czat ma się dać później zaimportować, wyeksportuj go jako **JSONL**.

Plik **JSONL** pomija kilka adresów zapisanych razem z czatem: webhook kopii czatu w serwisie Discord, adres DeepLX, klucz DeepL i adres Intiface. Import również nigdy ich nie przenosi. Jeśli z nich korzystasz, wpisz je ponownie w **Chat Settings** (ustawienia czatu) zaimportowanego czatu.

## Eksport pojedynczego czatu

1. Otwórz czat.
2. Otwórz **Chat Settings** i rozwiń sekcję **Chat Branches** (gałęzie czatu) pod **Chat Name**. Przyciski eksportu są w tej sekcji nawet wtedy, gdy czat ma tylko jedną gałąź.
3. Dotknij przycisku **JSONL**, **Text**, **Markdown** lub **Story**.

Przeglądarka pobiera plik. Zawiera on gałąź, którą właśnie oglądasz, razem z jej wiadomościami.

<a id="export-part-of-a-chat"></a>

## Eksport części czatu

Użyj **Export a range** (eksport zakresu), żeby zapisać tylko część wiadomości. Ta opcja nie jest dostępna w czatach Game.

1. W sekcji **Chat Branches** kliknij **Export a range**.
2. Kliknij pierwszą wiadomość, a potem ostatnią. Wyświetla się wskazówka "Select the first and last message to export."
3. Kliknij **Export selected** (eksport zaznaczonych).
4. W oknie **Export messages** (eksport wiadomości) sprawdź liczbę wiadomości oraz pierwszą i ostatnią wiadomość, a potem wybierz **Text**, **Markdown**, **JSONL** lub **Story**.

Marinara eksportuje wszystkie wiadomości od pierwszej do ostatniej z wybranych. Kliknij **Cancel** (anuluj), żeby przerwać bez eksportu.

## Eksport wielu czatów naraz

1. Na lewym pasku bocznym kliknij zakładkę odpowiedniego trybu: **CONVO**, **RP** lub **GM**. Każda zakładka eksportuje tylko własne czaty.
2. Kliknij **Select chats** (zaznaczanie czatów) u góry listy.
3. Kliknij każdy czat, który chcesz uwzględnić. Na dole pasek pokazuje licznik, na przykład "3 selected".
4. Kliknij **Export** (eksport) na tym pasku.

Przeglądarka pobiera plik `.zip` z jednym zapisem JSONL na każdy czat. Eksport zbiorczy zawsze korzysta z formatu **JSONL**. Zobacz [Zarządzanie listą czatów](managing-chats.md#selecting-multiple-chats).

## Import czatu jako nowego czatu

W ten sposób z pliku `.jsonl` zapisanego w aplikacji Marinara Engine lub wyeksportowanego z aplikacji SillyTavern powstaje nowy czat.

1. Na lewym pasku bocznym kliknij zakładkę odpowiedniego trybu. Zaimportowany czat dostaje tryb otwartej zakładki, a nie tryb zapisany w pliku.
2. Kliknij przycisk **Import** obok przycisku **+**. Jego etykieta to **Import SillyTavern or Marinara chat JSONL**.
3. Wskaż plik `.jsonl`.

Pojawia się komunikat "Imported N messages", a Marinara otwiera nowy czat. Więcej o plikach z aplikacji SillyTavern znajdziesz w przewodniku [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

Jeśli to nie zadziałało: na dole ekranu pojawia się mały komunikat **Import failed** (import nie powiódł się) z przyczyną. Sprawdź, czy nazwa pliku kończy się na `.jsonl`.

## Import czatu jako nowej gałęzi

W ten sposób plik `.jsonl` trafia do istniejącego czatu jako nowa gałąź. Zobacz [Gałęzie czatu](branches.md).

1. Otwórz czat, do którego ma trafić gałąź.
2. Otwórz **Chat Settings**, rozwiń sekcję **Chat Branches** i kliknij **Import**.
3. Wskaż plik `.jsonl`.

Pojawia się komunikat "Imported N messages as a new branch". Gałąź przejmuje z otwartego czatu postacie, personę, połączenie i preset promptu.

## Dołączanie toku rozumowania i prywatnych notatek do eksportów

Dwa ustawienia decydują o tym, czy ukryty tekst trafia do plików eksportu. Oba są przełącznikami w sekcji **Settings → Advanced → Message Tools** (ustawienia, zaawansowane, narzędzia wiadomości) i oba są domyślnie wyłączone. Działają przy eksporcie pojedynczego czatu i przy eksporcie do pliku `.zip`.

| Ustawienie | Gdy jest włączone |
| --- | --- |
| **Include reasoning in exports** (dołączanie toku rozumowania do eksportów) | Dodaje zapisany tok myślenia modelu do każdego formatu. W plikach **Markdown** i **Story** trafia on do zwijanej sekcji **Thinking** (myślenie) pod wiadomością. |
| **Include private notes in exports** (dołączanie prywatnych notatek do eksportów) | Dodaje twoje prywatne notatki przy wiadomościach do eksportów **JSONL** i **Text**. |

> **Ostrzeżenie:** Zanim udostępnisz zapis rozmowy, zostaw oba ustawienia wyłączone. Ukryty tok rozumowania i prywatne notatki mogą zawierać rzeczy, których nie zamierzasz nikomu wysyłać.
