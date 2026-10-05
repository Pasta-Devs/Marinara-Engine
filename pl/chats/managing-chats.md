# Zarządzanie listą czatów

Z tego przewodnika dowiesz się, jak działa lista czatów w aplikacji Marinara Engine. Opisuje on trzy zakładki trybów oraz tworzenie, importowanie, zmianę nazwy, usuwanie, porządkowanie, wyszukiwanie i zbiorcze zarządzanie czatami. Znajdziesz tu też opis wiersza z ostatnimi czatami na ekranie startowym.

## Lista czatów i zakładki trybów

Czaty znajdują się w panelu **Chats** (czaty), czyli na pasku bocznym po lewej stronie. U góry panelu są trzy zakładki trybów:

- **CONVO** dla trybu Conversation, czyli zwykłego czatu w stylu komunikatora.
- **RP** dla trybu Roleplay, czyli wciągającej sceny z postaciami i śledzeniem stanu świata.
- **GM** dla trybu Game, czyli gry RPG dla jednego gracza prowadzonej przez AI.

Każda zakładka pokazuje tylko czaty z danego trybu. Kliknięcie zakładki przełącza listę.

Każdy wiersz listy pokazuje nazwę czatu oraz awatar postaci biorących w nim udział. W czatach w trybie Conversation mała kolorowa kropka przy awatarze pokazuje status każdej postaci. Czerwona plakietka w wierszu to liczba nieprzeczytanych wiadomości.

Niektóre wiersze mają małą ikonę gałęzi z liczbą. Oznacza to, że czat ma więcej niż jedną gałąź, a gałęzie są zebrane w jednym wierszu. Czym są gałęzie, wyjaśnia [Gałęzie czatu](branches.md).

## Tworzenie nowego czatu

1. Wybierz zakładkę trybu (**CONVO**, **RP** albo **GM**).
2. Kliknij przycisk **+** u góry panelu. Jego podpowiedź brzmi **New Conversation**, **New Roleplay** albo **New Game** – zgodnie z aktywną zakładką.
3. Aplikacja tworzy czat, otwiera go i wyświetla panel **Chat Settings** (ustawienia czatu) razem z kreatorem konfiguracji, żeby dokończyć ustawienia.

Nowy czat nosi nazwę **New Conversation**, **New Roleplay** albo **New Game**. Nazwę da się później zmienić (zobacz sekcję Zmiana nazwy czatu poniżej).

Zanim czat się otworzy, potrzebne jest co najmniej jedno połączenie. Połączenie łączy aplikację Marinara Engine z dostawcą AI. Jeśli nie ma jeszcze żadnego połączenia, zamiast czatu pojawia się okno **Set Up** (konfiguracja). Prosi ono o wybranie połączenia. Gdy nie ma żadnego, pokazuje komunikat **No connections found** i przycisk **Open Connections**. Jak skonfigurować połączenie, opisuje [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Jeśli dla danego trybu jest zapisany oznaczony gwiazdką domyślny profil ustawień, Marinara stosuje go do nowego czatu automatycznie. Zobacz [Panel **Chat Settings** – przegląd](chat-settings.md).

## Importowanie czatu

Czat zapisany jako plik `.jsonl` można zaimportować – z aplikacji SillyTavern albo z aplikacji Marinara Engine.

1. Wybierz zakładkę trybu, w którym ma wylądować zaimportowany czat.
2. Kliknij przycisk **Import** (import) u góry panelu. Jego podpowiedź brzmi **Import SillyTavern or Marinara chat JSONL**.
3. Wskaż plik `.jsonl`.

Marinara tworzy nowy czat w trybie bieżącej zakładki i otwiera go. Powinien pojawić się komunikat **Imported N messages**, gdzie N to liczba wiadomości.

Wszystkie sposoby importowania i eksportowania czatów, w tym import zbiorczy oraz formaty eksportu, opisuje [Eksport i import czatów](export-import.md).

## Zmiana nazwy czatu

Nazwę czatu widzisz tylko ty. Nie trafia ona do AI i nie zmienia przebiegu czatu.

1. Otwórz czat.
2. Otwórz **Chat Settings** przyciskiem w czacie.
3. W sekcji **Chat Name** kliknij bieżącą nazwę, żeby zamieniła się w pole tekstowe.
4. Wpisz nową nazwę, a potem naciśnij Enter albo kliknij przycisk z ptaszkiem.

Więcej o panelu **Chat Settings** znajdziesz w przewodniku [Panel **Chat Settings** – przegląd](chat-settings.md).

## Usuwanie czatu

Aby usunąć pojedynczy czat, najedź na jego wiersz i kliknij przycisk kosza. Na urządzeniu mobilnym przycisk kosza jest widoczny zawsze. Okno o tytule **Delete Chat** (usunięcie czatu) pyta "Delete this chat?". Kliknij przycisk **Delete**, żeby potwierdzić.

Usunięcie czatu jest nieodwracalne. Zatrzymuje też odpowiedź, która akurat jest generowana w tym czacie.

### Okno wyboru gałęzi

Jeśli usuwany czat ma więcej niż jedną gałąź, otwiera się inne okno. Nosi tytuł **Delete Chat** i informuje, że czat ma kilka gałęzi. Do wyboru są dwie opcje:

- **Delete This Branch Only** usuwa tylko klikniętą gałąź.
- **Delete All N Branches** usuwa wszystkie gałęzie w grupie, gdzie N to ich liczba.

Jak zarządzać gałęziami bez usuwania całego czatu, opisuje [Gałęzie czatu](branches.md).

### Włączanie i wyłączanie potwierdzeń usunięcia

O tym, czy te okna z potwierdzeniem się pojawiają, decyduje obejmujące całą aplikację ustawienie **Confirm before deleting** (potwierdzanie przed usunięciem). Domyślnie jest włączone, a znajdziesz je w **Settings** (Ustawienia) w zakładce **General**. Jego własny opis pomocy zaleca, żeby je zostawić włączone.

## Foldery czatów

Czaty można grupować w foldery osobno w każdej zakładce trybu.

1. Zadbaj o to, żeby bieżąca zakładka miała co najmniej jeden czat. Dopiero wtedy nad listą pojawia się przycisk **New Folder** (nowy folder).
2. Kliknij przycisk **New Folder**. Folder powstaje z nazwą **unnamed** (albo **unnamed 2**, **unnamed 3** i tak dalej, jeśli ta nazwa jest zajęta).

Aby zmienić nazwę folderu, kliknij go dwukrotnie, dotknij dwukrotnie albo zaznacz i naciśnij F2. Pusta nazwa jest ignorowana.

Aby usunąć folder, kliknij przycisk kosza w jego wierszu. Potwierdza to okno o tytule **Delete Folder**. Usunięcie folderu nigdy nie usuwa czatów, które są w środku. Te czaty wracają na poziom główny.

Aby zmienić kolejność folderów, przeciągaj je w górę i w dół za uchwyt.

Aby przenieść czat do folderu, przeciągnij jego wiersz na ten folder. Aby wyjąć czat ze wszystkich folderów, przeciągnij go na pusty obszar pod folderami. Na ekranie dotykowym naciśnij i przytrzymaj czat przez mniej więcej pół sekundy, żeby zacząć przeciąganie. Gdy zaznaczonych jest kilka czatów, przeciągnięcie jednego z nich przenosi całe zaznaczenie.

Czaty, które nie należą do żadnego folderu, są na zwykłej liście pod folderami.

## Wyszukiwanie, sortowanie i filtrowanie po tagach

Każda zakładka trybu ma własne pole wyszukiwania u góry listy. Tekst zastępczy zmienia się zależnie od zakładki: **Search conversations...**, **Search roleplays...** albo **Search games...**. Wyszukiwanie obejmuje nazwę czatu, jego tagi oraz imiona postaci. Nie przeszukuje treści wiadomości.

Obok pola wyszukiwania jest menu sortowania z podpowiedzią **Sort chats**. Ma cztery opcje:

- **Newest**, opcja domyślna, pokazuje najpierw czaty ostatnio aktywne.
- **Oldest** pokazuje najpierw te najdawniej aktywne.
- **A-Z** sortuje nazwy od A do Z.
- **Z-A** sortuje nazwy od Z do A.

Jeśli którykolwiek czat w zakładce ma tagi, pojawia się wiersz filtrowania po tagach. Kliknij kafelek **Tags**, żeby rozwinąć listę tagów. Potem kliknij tag, aby zobaczyć tylko czaty z tym tagiem. Kliknij przycisk **Clear**, żeby usunąć filtr. Przy dużej liczbie tagów resztę odsłania kafelek **+N more**.

Uwaga: ten ekran filtruje wyłącznie po tagach, które czat już ma. Nie ma tu przycisku dodającego tag do czatu.

Lista pokazuje jednorazowo do 100 czatów. Przy większej liczbie na dole pojawia się przycisk **Load more**, który odsłania kolejną porcję.

## Zaznaczanie wielu czatów

Na kilku czatach można działać naraz.

1. Kliknij przycisk **Select chats** (wybór czatów) u góry panelu – ten z ikoną ptaszka.
2. Kliknij każdy czat, który ma być zaznaczony. Zamiast otwierać czat, klikanie włącza pole wyboru w wierszu.
3. Pasek na dole pokazuje liczbę zaznaczonych czatów i dwa przyciski.

Przycisk **Export** pobiera wszystkie zaznaczone czaty razem, w jednym pliku `.zip`. Przycisk **Delete** je usuwa. Usuwanie najpierw pokazuje potwierdzenie o tytule **Delete Chats**.

Aby wyjść z trybu zaznaczania bez żadnej akcji, kliknij przycisk wyboru ponownie. Przełączenie zakładki też czyści zaznaczenie.

## Ostatnie czaty na ekranie startowym

Ekran startowy pokazuje kompaktowy wiersz **Recent Chats** (ostatnie czaty) z trzema ostatnio aktywnymi czatami. Każdy czat to mały kafelek z awatarem, plakietką trybu i nazwą czatu. Kliknij kafelek, żeby otworzyć ten czat. Gdy nie ma jeszcze żadnych czatów, w wierszu widnieje **No chats yet**.

## Powiązane przewodniki

- [Gałęzie czatu](branches.md)
- [Eksport i import czatów](export-import.md)
- [Panel **Chat Settings** – przegląd](chat-settings.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
