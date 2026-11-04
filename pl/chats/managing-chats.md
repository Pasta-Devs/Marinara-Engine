# Zarządzanie listą czatów

Panel **Chats** (czaty) po lewej stronie zawiera wszystkie twoje czaty. Służy do zakładania, wyszukiwania, sortowania, porządkowania i usuwania czatów.

## Lista czatów i zakładki trybów

U góry panelu są trzy zakładki trybów. Każda zakładka pokazuje tylko czaty z danego trybu.

| Zakładka | Tryb |
| --- | --- |
| **CONVO** | Conversation: czat w stylu komunikatora. |
| **RP** | Roleplay: scena z postaciami i śledzeniem stanu świata. |
| **GM** | Game: gra RPG dla jednego gracza prowadzona przez AI. |

Każdy wiersz pokazuje nazwę czatu i awatary jego postaci. W czatach w trybie Conversation kolorowa kropka na awatarze pokazuje status postaci. Czerwona plakietka to liczba nieprzeczytanych wiadomości. Wiersz z małą ikoną gałęzi i liczbą to czat z kilkoma gałęziami, zebranymi w jednym wierszu. Zobacz [Gałęzie czatu](branches.md).

## Zakładanie czatu

Zanim zaczniesz: dodaj co najmniej jedno konto w **Connections** (Połączenia). Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Kliknij zakładkę wybranego trybu.
2. Dotknij przycisku **+** u góry panelu. Jego etykieta to **New Conversation**, **New Roleplay** albo **New Game**, zgodnie z zakładką.

Marinara tworzy czat i go otwiera. Obok otwierają się panel **Chat Settings** (ustawienia czatu) i kreator konfiguracji. Czat startuje z nazwą **New Conversation**, **New Roleplay** albo **New Game**. Jeśli dla trybu Conversation lub Roleplay zapisano domyślny profil ustawień oznaczony gwiazdką, Marinara stosuje go do nowego czatu. Zobacz [Profile ustawień](settings-profiles.md).

Jeśli to nie zadziałało: gdy nie ma zapisanego konta, zamiast czatu otwiera się okno **Add account** (dodanie konta). Wybierz usługę, kliknij **Connect** (połącz), a potem wybierz model. Pełny opis krok po kroku znajdziesz w przewodniku [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

## Importowanie czatu

Możesz zaimportować zapis czatu w pliku `.jsonl` z aplikacji SillyTavern lub Marinara Engine.

1. Kliknij zakładkę trybu, w którym ma się znaleźć czat.
2. Dotknij przycisku **Import** (import) u góry panelu. Jego etykieta to **Import SillyTavern or Marinara chat JSONL**.
3. Wybierz plik `.jsonl`.

Marinara tworzy czat, otwiera go i pokazuje **Imported N messages**. Formaty eksportu i eksport zbiorczy opisuje przewodnik [Eksport i import czatów](export-import.md).

Jeśli to nie zadziałało: na dole ekranu pojawia się krótki komunikat **Import failed** z przyczyną. Przyjmowane są tylko pliki `.jsonl`.

## Zmiana nazwy czatu

Nazwa czatu jest tylko dla ciebie. Nie trafia do modelu.

1. Otwórz czat, a potem panel **Chat Settings**.
2. W sekcji **Chat Name** (nazwa czatu) kliknij bieżącą nazwę.
3. Wpisz nową nazwę, a potem naciśnij <kbd>Enter</kbd> albo kliknij znak zaznaczenia.

Jak otworzyć ten panel, opisuje [Panel **Chat Settings** – przegląd](chat-settings.md).

<a id="delete-a-chat"></a>

## Usuwanie czatu

1. Dotknij przycisku kosza w wierszu czatu. Na komputerze pojawia się on po najechaniu kursorem na wiersz.
2. W oknie **Delete Chat** (usunięcie czatu) kliknij **Delete** (usuń).

Usunięcie jest nieodwracalne. Zatrzymuje też odpowiedź, która wciąż się pisze w tym czacie.

Jeśli czat ma kilka gałęzi, okno podaje ich liczbę i daje dwie możliwości:

- **Delete This Branch Only** (usunięcie tylko tej gałęzi) usuwa klikniętą gałąź.
- **Delete All N branches** (usunięcie wszystkich N gałęzi) usuwa wszystkie gałęzie w grupie.

Jak zarządzać gałęziami bez usuwania czatu, opisuje [Gałęzie czatu](branches.md).

O tych oknach decyduje ustawienie całej aplikacji **Confirm before deleting** (potwierdzanie przed usunięciem). Domyślnie jest włączone. Znajdziesz je w **Settings → General** (ustawienia, ogólne).

## Foldery czatów

Foldery grupują czaty w obrębie jednej zakładki trybu.

1. Otwórz zakładkę, która ma co najmniej jeden czat. Dopiero wtedy pod zakładkami pojawia się **New Folder** (nowy folder).
2. Kliknij **New Folder**. Folder dostaje nazwę **unnamed** (a kolejne **unnamed 2**, **unnamed 3**).

| Cel | Co zrobić |
| --- | --- |
| Zmiana nazwy folderu | Kliknij go dwukrotnie albo dotknij dwukrotnie, albo ustaw na nim fokus i naciśnij <kbd>F2</kbd>. Pusta nazwa jest ignorowana. |
| Usunięcie folderu | Kliknij przycisk kosza w wierszu folderu. Gdy folder zawiera czaty, pojawia się okno **Delete Folder** (usunięcie folderu). Czaty przechodzą na poziom główny i nie są usuwane. |
| Zmiana kolejności folderów | Przeciągnij folder w górę lub w dół. Menu sortowania przełącza się na **Custom** (własna). |
| Przeniesienie czatu do folderu | Przeciągnij wiersz czatu na folder. Na ekranie dotykowym najpierw naciśnij i przytrzymaj czat przez mniej więcej pół sekundy. |
| Wyjęcie czatu z folderu | Przeciągnij go na pusty obszar pod folderami. |

Gdy zaznaczonych jest kilka czatów, przeciągnięcie jednego przenosi całe zaznaczenie. Czaty spoza folderów są wypisane pod folderami.

## Wyszukiwanie, sortowanie i filtrowanie

### Wyszukiwanie czatu po nazwie

Każda zakładka ma pole wyszukiwania. Jego tekst zastępczy to **Search conversations**, **Search roleplays** albo **Search games**. Wpisz słowo. Wyszukiwanie dopasowuje nazwy czatów, tagi i imiona postaci, ale nie treść wiadomości.

### Wyszukiwanie wiadomości we wszystkich czatach

1. Dotknij **Search all chats** (przeszukiwanie wszystkich czatów), przycisku obok menu sortowania.
2. Wpisz szukane słowa.

Wyszukiwanie obejmuje każdy czat i może filtrować po trybie, postaci, nadawcy i dacie.

Menu sortowania **Sort chats** (sortowanie czatów) ma takie opcje:

| Opcja | Kolejność |
| --- | --- |
| **Custom** | Twoja kolejność folderów. |
| **Manual order** (kolejność ręczna) | Czaty w kolejności, w jakiej je przeciągniesz. Z klawiatury ustaw fokus na czacie i naciśnij <kbd>Alt</kbd>+<kbd>Up</kbd> albo <kbd>Alt</kbd>+<kbd>Down</kbd>. |
| **Recent** (ostatnie) | Najpierw ostatnio aktywne. To opcja domyślna. |
| **Newest** (najnowsze) | Najpierw ostatnio utworzone. |
| **Oldest** (najstarsze) | Najpierw najstarsze. |
| **A-Z** i **Z-A** | Według nazwy. |

Gdy którykolwiek czat w zakładce ma tag, pojawia się kafelek **Tags (N)** (tagi). Kliknij go, żeby rozwinąć tagi, a potem kliknij tag, żeby zobaczyć tylko czaty z tym tagiem. Kliknij **Clear** (wyczyszczenie), żeby usunąć filtr. W tym panelu nie da się dodać tagów do czatu.

Lista pokazuje naraz 100 czatów. Kliknij **Load more** (wczytanie kolejnych), żeby zobaczyć następną porcję.

<a id="selecting-multiple-chats"></a>

## Zaznaczanie wielu czatów

1. Kliknij przycisk **Select chats** (wybór czatów) ze znakiem zaznaczenia u góry panelu.
2. Kliknij każdy czat, który chcesz zaznaczyć. Zamiast się otwierać, wiersze pokazują pole wyboru.
3. Użyj paska na dole, który pokazuje liczbę zaznaczonych czatów.

**Export** (eksport) pobiera zaznaczone czaty jako jeden plik `.zip` z plikami `.jsonl`. **Delete** prosi o potwierdzenie w oknie **Delete Chats** (usunięcie czatów), a potem je usuwa. Kliknij ponownie przycisk ze znakiem zaznaczenia, żeby wyjść z trybu zaznaczania. Przełączenie zakładki też czyści zaznaczenie.

## Ostatnie czaty na ekranie startowym

Ekran startowy ma widget **Recent chats** (ostatnie czaty) z twoimi najnowszymi czatami. Każdy czat pokazuje swoją nazwę, plakietkę trybu i ostatnią wiadomość. Kliknij czat, żeby go otworzyć. Gdy nie ma czatów, widget pokazuje napis **Your chats will show here**. Zobacz [Widgety ekranu głównego](../home/welcome.md#home-widgets).
