# Porządkowanie biblioteki postaci

Ten przewodnik opisuje panel **Characters** (Postacie) – pasek boczny, w którym mieszkają wszystkie postacie. Zobaczysz, jak szukać, sortować, grupować postacie w foldery, oznaczać ulubione, filtrować po tagach oraz eksportować i usuwać wiele postaci naraz.

## Panel Characters

Panel **Characters** to lista postaci w panelu bocznym. Trzyma każdą postać utworzoną lub zaimportowaną w aplikacji Marinara Engine. Z górnej części panelu da się:

- Kliknąć przycisk **Download** (pobranie), żeby otworzyć [Card Browser](bot-browser.md) i znaleźć postacie w publicznych serwisach.
- Kliknąć przycisk **Open Library** (otwarcie biblioteki), żeby zobaczyć te same postacie w większym widoku siatki na całą stronę.
- Kliknąć przycisk **New** (ikona plusa), żeby otworzyć okno **Create Character** (tworzenie postaci).
- Kliknąć przycisk **Import** (ikona pobierania), żeby zaimportować plik postaci.
- Kliknąć przycisk **Select** (zaznaczanie), czyli ikonę ptaszka, żeby włączyć tryb wielokrotnego zaznaczania i działać na wielu postaciach naraz.

Pełna biblioteka używa koloru tekstu chroma wybranego w sekcji **Settings** (Ustawienia). Zapamiętuje też zaznaczoną kartę postaci, kolejność sortowania i pozycję przewijania, więc po otwarciu postaci do edycji i powrocie wszystko jest na swoim miejscu.

Każdy wiersz postaci pokazuje awatar, nazwę, opcjonalną linię z tytułem, autora i wersję, do 3 tagów oraz przybliżoną liczbę tokenów. Mała gwiazdka oznacza ulubioną postać. Po najechaniu na wiersz pojawiają się przyciski **Duplicate** (duplikowanie) i **Delete** (usuwanie).

Przy dużej liczbie postaci na dole pojawia się przycisk **Load more** (wczytanie kolejnych). Kliknij go, żeby wczytać następną stronę postaci.

## Wyszukiwanie

Wpisz tekst w pole wyszukiwania na górze panelu, żeby przefiltrować listę. Tekst zastępczy brzmi **Search characters or -tag:"tag name"**.

Zwykły tekst porównywany jest z nazwą postaci, tytułem, opisem i tagami. Po wpisaniu `knight` zobaczysz każdą postać, która ma "knight" w którymkolwiek z tych pól.

Da się też ukryć postacie z określonym tagiem. Postaw przed tagiem znak minus:

```
-tag:"tag name"
```

O wykluczaniu tagów warto wiedzieć kilka rzeczy:

- Gdy tag zawiera spację, użyj cudzysłowów, na przykład `-tag:"slow burn"`.
- Przy tagu jednowyrazowym cudzysłowy można pominąć, na przykład `-vampire`.
- Wykluczenie tagu ukrywa każdą postać z tym tagiem, nawet jeśli reszta wpisanego tekstu do niej pasuje.

Zwykły tekst i wykluczenie można łączyć w jednym polu. Zapytanie `mage -tag:"villain"` znajduje postacie pasujące do "mage" i jednocześnie ukrywa te z tagiem "villain".

## Sortowanie

Obok pola wyszukiwania jest lista rozwijana sortowania. Wybierz jedną z kolejności:

| Opcja         | Działanie                              |
| ------------- | -------------------------------------- |
| **Manual order** | Kolejność ustawiona przez ciebie.   |
| **A-Z**       | Nazwy od A do Z.                       |
| **Z-A**       | Nazwy od Z do A.                       |
| **Newest**    | Najpierw ostatnio utworzone.           |
| **Oldest**    | Najpierw najstarsze.                   |
| **Favorites** | Najpierw ulubione, potem cała reszta.  |

Żeby ustawić własną kolejność, przeciągnij wiersz postaci w górę lub w dół. Możesz też nacisnąć Alt+strzałka w górę albo Alt+strzałka w dół na wierszu, który ma fokus. Każdy z tych sposobów przełącza sortowanie na **Manual order** (kolejność ręczna).

## Foldery

Dzięki folderom pokrewne postacie da się zgrupować wewnątrz panelu. Foldery są opcjonalne. Wszystkie postacie mogą też cały czas leżeć na jednej płaskiej liście.

Tworzenie folderu:

1. Kliknij przycisk **New Folder** (nowy folder).
2. Pojawia się nowy folder o domyślnej nazwie **unnamed**.
3. Zmień jego nazwę od razu albo później (patrz niżej).

Żeby zmienić nazwę folderu, kliknij go dwukrotnie, dotknij go dwukrotnie albo zaznacz go i naciśnij klawisz F2. Wpisz nową nazwę i naciśnij Enter.

Żeby umieścić postać w folderze, przeciągnij wiersz postaci i upuść go na folderze. Gdy istnieje przynajmniej jeden folder, wyświetla się podpowiedź **Drag and drop characters to folders, double-click or double-tap to rename**. Żeby wyjąć postać z folderu, najedź na jej wiersz wewnątrz folderu i kliknij przycisk usuwania z folderu albo po prostu przeciągnij ją na zewnątrz.

Na ekranie dotykowym naciśnij i przytrzymaj wiersz, żeby go podnieść, a potem go przeciągnij. Zwykłe przesunięcie palcem nadal przewija listę. Trzymając jeden wiersz, stuknij drugim palcem inne wiersze, żeby zabrać je razem jako stos, a potem upuść stos na folder.

Kliknięcie folderu rozwija go lub zwija. Liczba obok nazwy folderu mówi, ile postaci jest w środku.

Żeby usunąć folder, najedź na niego i kliknij przycisk kosza. Jeśli w folderze są postacie, pojawia się prośba o potwierdzenie: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Pusty folder znika od razu, bez pytania. Usunięcie folderu nigdy nie usuwa postaci ze środka. Wracają one po prostu na główną listę.

## Ulubione i kafelki tagów

### Ulubione

Oznaczenie postaci jako ulubionej ułatwia późniejsze jej odnalezienie. Gwiazdkę ulubionych ustawia się wewnątrz samej postaci, a nie z poziomu listy w panelu. Otwórz postać i kliknij jej gwiazdkę **Favorite** (ulubione), żeby włączyć lub wyłączyć oznaczenie. Ulubione postacie mają w panelu małą gwiazdkę na awatarze.

Pod obszarem wyszukiwania są trzy przyciski filtrowania:

- **All** pokazuje wszystkie postacie.
- **Favs** pokazuje tylko ulubione.
- **Non-favs** pokazuje tylko postacie, które nie są ulubione.

Inna opcja: wybierz **Favorites** na liście rozwijanej sortowania, żeby wypchnąć wszystkie ulubione na górę listy.

### Tagi

Tagi to etykiety dodawane do postaci, żeby ją opisać – na przykład `fantasy` albo `slow burn`. Tagi postaci dodaje się i edytuje w edytorze postaci.

W panelu każdy wiersz postaci pokazuje do 3 jej tagów. Kliknij kafelek tagu w dowolnym wierszu, żeby zawęzić listę do postaci z tym samym tagiem.

Kiedy postacie mają tagi, w wierszu filtrów pojawia się przycisk **Tags** (tagi) z łączną liczbą tagów w nawiasie, na przykład **Tags (12)**. Kliknij go, żeby rozwinąć pełną listę tagów:

- Kliknij tag na rozwiniętej liście, żeby dodać go do filtrów. Po kliknięciu więcej niż jednego tagu pasują postacie, które mają dowolny z zaznaczonych tagów.
- Każdy tag na rozwiniętej liście ma mały znak X. Jego kliknięcie usuwa ten tag ze wszystkich postaci, które go mają. Marinara prosi wtedy o potwierdzenie: **Remove tag "name" from all characters?**
- Gdy filtr tagów jest aktywny, pojawia się przycisk **Clear** (wyczyszczenie). Kliknij go, żeby usunąć filtry tagów.

Żeby tag wykluczyć, a nie dodać do filtrów, użyj składni `-tag:` opisanej wyżej w sekcji Wyszukiwanie.

## Zaznaczanie, eksport i usuwanie wielu postaci

Kiedy trzeba zadziałać na kilku postaciach naraz, użyj trybu zaznaczania.

1. Kliknij przycisk **Select** na górze panelu.
2. W każdym wierszu postaci pojawia się pole wyboru.
3. Kliknij postacie, które mają wejść do zaznaczenia. Nagłówek panelu pokazuje, ile jest zaznaczonych.
4. Skorzystaj z paska akcji na dole panelu.

Pasek akcji ma dwa przyciski:

- **Export** pobiera wszystkie zaznaczone postacie razem, jako jeden plik zip o nazwie `marinara-characters.zip`. To eksport zbiorczy we własnym formacie aplikacji Marinara Engine.
- **Delete** usuwa wszystkie zaznaczone postacie. Najpierw pojawia się prośba o potwierdzenie: **Delete N characters?**

W trybie zaznaczania da się też przeciągnąć wszystkie zaznaczone postacie do folderu za jednym razem, zamiast przenosić je pojedynczo.

Pełną listę formatów plików importu i eksportu znajdziesz w przewodniku o importowaniu i eksportowaniu, podlinkowanym niżej.

## Foldery to jednocześnie składy czatów grupowych

Tworzone tu foldery mają drugie zastosowanie. Każdy folder jest też zapisanym składem postaci, który da się wrzucić do czatu grupowego.

Podczas przygotowywania czatu z więcej niż jedną postacią poszukaj opcji **Add from Folder** (dodanie z folderu). Dodaje ona wszystkie postacie z wybranego folderu w jednym kroku. To najszybszy sposób na rozpoczęcie czatu grupowego ze stałym zestawem postaci. O tym, jak działają czaty grupowe, mówi podlinkowany niżej przewodnik.

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md)
