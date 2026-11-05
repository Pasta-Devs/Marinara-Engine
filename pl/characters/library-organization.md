# Porządkowanie biblioteki postaci

Panel **Characters** (postacie) to lista na pasku bocznym ze wszystkimi postaciami, które utworzono lub zaimportowano. Służy do wyszukiwania, sortowania, grupowania postaci w foldery, oznaczania ulubionych, filtrowania po tagach oraz eksportowania i usuwania wielu postaci naraz.

## Panel Characters

Z górnej części panelu możesz:

- Kliknąć **Download** (pobranie), żeby otworzyć [Card Browser](bot-browser.md) i znaleźć postacie w publicznych serwisach.
- Kliknąć **Open Library** (otwarcie biblioteki), żeby otworzyć większą, pełnoekranową siatkę tych samych postaci.
- Kliknąć **New** (nowa, ikona plusa), żeby otworzyć okno **Create Character** (tworzenie postaci).
- Kliknąć **Import** (import, ikona pobierania), żeby zaimportować plik postaci. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).
- Kliknąć **Select** (zaznaczanie, ikona ptaszka), żeby włączyć tryb zaznaczania do działań zbiorczych.

Pełna biblioteka zapamiętuje zaznaczoną kartę, kolejność sortowania i pozycję przewijania, gdy otwierasz postać do edycji i wracasz.

Każdy wiersz pokazuje awatar, nazwę, opcjonalną linię z tytułem, autora i wersję, do 3 tagów oraz przybliżoną liczbę tokenów. Mała plakietka z gwiazdką oznacza ulubioną postać. Po najechaniu na wiersz pojawiają się **Duplicate** (duplikowanie) i **Delete** (usuwanie). Przy dużej liczbie postaci kliknij **Load more** (wczytanie kolejnych) na dole, żeby wczytać następną stronę.

<a id="search"></a>

## Wyszukiwanie

Wpisz tekst w pole wyszukiwania na górze. Tekst zastępczy brzmi **Search characters/tags** (szukaj postaci/tagów). Zwykły tekst jest porównywany z nazwą postaci, tytułem, opisem i tagami, bez rozróżniania wielkości liter. Po wpisaniu `knight` zobaczysz każdą postać, która ma "knight" w którymkolwiek z tych miejsc.

| Zapytanie | Co znajduje |
| --- | --- |
| `male genshin` albo `male,genshin` | Karty, które mają oba dokładne tagi. |
| `male "Modern AU"` | Tag ze spacjami lub przecinkami ujmij w cudzysłów. |
| `-tag:"slow burn"` | Ukrywa każdą kartę z tym tagiem, nawet jeśli reszta zapytania do niej pasuje. |
| `-vampire` | To samo dla tagu jednowyrazowego. Cudzysłowy można pominąć. |
| `mage -tag:"villain"` | Karty pasujące do "mage", bez tych z tagiem "villain". |

Zwykłe wyszukiwanie fraz nadal działa. Ten sam sposób wyszukiwania działa w pełnoekranowej bibliotece Character Library i dla person.

## Sortowanie

Wybierz kolejność na liście rozwijanej sortowania obok pola wyszukiwania.

| Opcja | Działanie |
| --- | --- |
| **Manual order** | Kolejność ustawiona przez ciebie. |
| **A-Z** | Nazwy od A do Z. |
| **Z-A** | Nazwy od Z do A. |
| **Newest** | Najpierw ostatnio utworzone. |
| **Oldest** | Najpierw najstarsze. |
| **Favorites** | Najpierw ulubione, potem cała reszta. |

Żeby ustawić własną kolejność, przeciągnij wiersz w górę lub w dół albo naciśnij <kbd>Alt</kbd>+<kbd>Up</kbd> lub <kbd>Alt</kbd>+<kbd>Down</kbd> na wierszu, który ma fokus. Każdy z tych sposobów przełącza sortowanie na **Manual order** (kolejność ręczna).

## Foldery

Foldery grupują pokrewne postacie, na przykład według historii albo serii, dzięki czemu długą listę łatwiej przejrzeć. Są opcjonalne.

1. Kliknij **New Folder** (nowy folder). Pojawia się folder o nazwie **unnamed**.
2. Zmień jego nazwę: kliknij go dwukrotnie, dotknij go dwukrotnie albo zaznacz go i naciśnij <kbd>F2</kbd>. Wpisz nową nazwę i naciśnij <kbd>Enter</kbd>.
3. Przeciągnij wiersz postaci na folder, żeby umieścić ją w środku. Gdy masz już folder, wyświetla się wskazówka **Drag and drop characters to folders, double-click or double-tap to rename**.

Żeby wyjąć postać z folderu, najedź na jej wiersz wewnątrz folderu i kliknij przycisk usuwania z folderu albo przeciągnij ją na zewnątrz. Kliknięcie folderu rozwija go lub zwija. Liczba obok jego nazwy mówi, ile postaci jest w środku.

Na ekranie dotykowym naciśnij i przytrzymaj wiersz, żeby go podnieść, a potem przeciągnij. Zwykłe przesunięcie palcem nadal przewija listę.

Żeby przenieść kilka postaci naraz, przytrzymaj jeden wiersz i stuknij drugim palcem inne wiersze, żeby zabrać je razem jako stos. Potem upuść stos na folder.

Żeby usunąć folder, najedź na niego i kliknij jego przycisk kosza. Folder z postaciami prosi o potwierdzenie: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Pusty folder znika od razu. Usunięcie folderu nigdy nie usuwa postaci, które są w środku.

### Folder jako skład czatu grupowego

Każdy folder jest też zapisanym składem postaci do czatów grupowych. Podczas przygotowywania czatu z więcej niż jedną postacią **Add from Folder** (dodanie z folderu) dodaje wszystkie postacie z folderu w jednym kroku. Zobacz [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md).

## Ulubione i tagi

### Ulubione

Otwórz postać i kliknij jej gwiazdkę **Favorite** (ulubione), żeby włączyć lub wyłączyć oznaczenie. Nie da się go ustawić z listy w panelu. Ulubione postacie mają małą plakietkę z gwiazdką. Pod polem wyszukiwania są trzy przyciski filtrujące listę:

- **All** pokazuje wszystkie postacie.
- **Favs** pokazuje tylko ulubione.
- **Non-favs** pokazuje tylko postacie, które nie są ulubione.

Możesz też wybrać **Favorites** na liście rozwijanej sortowania, żeby przenieść ulubione na górę.

### Tagi

Tagi to etykiety takie jak `fantasy` albo `slow burn`. Dodaje się je w edytorze postaci. Zobacz [Tworzenie i edycja postaci](creating-and-editing-characters.md#metadata-tab). W panelu kliknij kafelek tagu w dowolnym wierszu, żeby zawęzić listę do postaci z tym samym tagiem.

Gdy postacie mają tagi, pojawia się przycisk **Tags** (tagi) z liczbą, na przykład **Tags (12)**. Kliknij go, żeby rozwinąć pełną listę:

- Kliknij tag, żeby dodać go do filtrów. Przy kilku zaznaczonych tagach pasuje postać, która ma którykolwiek z nich.
- Kliknij X przy tagu, żeby usunąć ten tag ze wszystkich postaci, które go mają. Pojawia się prośba o potwierdzenie: **Remove tag "name" from all characters?**
- **Clear** (wyczyszczenie) pojawia się, gdy filtr tagów jest aktywny. Kliknij go, żeby wyczyścić filtry tagów.

Żeby zamiast tego wykluczyć tag, użyj `-tag:` w polu wyszukiwania, jak pokazano w sekcji [Wyszukiwanie](#search).

<a id="export-or-delete-many-characters"></a>

## Eksport i usuwanie wielu postaci

1. Kliknij **Select** na górze panelu. W każdym wierszu pojawia się pole wyboru.
2. Kliknij postacie, które chcesz zaznaczyć. Nagłówek panelu pokazuje, ile jest zaznaczonych.
3. Skorzystaj z paska akcji na dole.

Pasek akcji ma dwa przyciski:

- **Export** (eksport) pobiera zaznaczone postacie jako jeden plik zip o nazwie `marinara-characters.zip`, w natywnym formacie aplikacji Marinara Engine.
- **Delete** usuwa zaznaczone postacie. Najpierw pojawia się pytanie: **Delete N characters?**

W trybie zaznaczania da się też przeciągnąć zaznaczone postacie razem do folderu. Formaty plików opisuje przewodnik [Importowanie i eksportowanie kart postaci](import-export.md).

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md)
