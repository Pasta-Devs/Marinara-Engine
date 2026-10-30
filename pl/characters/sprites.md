# Sprite'y postaci (wyrazy twarzy i całe sylwetki)

Z tego przewodnika dowiesz się, jak dodać do postaci grafiki zwane sprite'ami i jak wygenerować je przy pomocy AI. Opisuje też czyszczenie tła i sterowanie tym, jak sprite'y pokazują się na ekranie. Sprite'y działają w trybie Roleplay Mode i Game Mode.

## Czym są sprite'y

Sprite to grafika stojącej postaci: obrazek, który Marinara Engine wyświetla nad sceną czatu. Marinara używa dwóch rodzajów sprite'ów:

- **Facial Expressions** (wyrazy twarzy): portrety dla różnych nastrojów, na przykład radości, smutku albo złości.
- **Full-body** (całe sylwetki): obrazy całej postaci w różnych pozach, na przykład idle, walk albo battle stance.

Sprite'y widać na ekranie tylko w trybie **Roleplay Mode** i **Game Mode**. Zwykłe czaty w trybie Conversation nie pokazują grafik sprite'ów. Wgrywać sprite'y można w każdym trybie, bo postać zachowuje swoje sprite'y niezależnie od tego, który czat z niej korzysta.

Sprite'y dodaje się osobno dla każdej postaci. Można je też dodać do persony, czyli postaci, w którą się wcielasz. Edytor persony ma tę samą zakładkę **Sprites** (sprite'y), opisaną niżej.

## Gdzie znaleźć zakładkę Sprites

Sprite'ami zarządza się w edytorze postaci (albo persony).

1. Otwórz postać do edycji.
2. Kliknij zakładkę **Sprites** w edytorze.
3. Na górze zakładki wybierz kategorię: **Facial Expressions**, **Full-body** albo **Clips**.

Ten przewodnik opisuje kategorie **Facial Expressions** i **Full-body**. Kategoria **Clips** (klipy) to osobna funkcja, przeznaczona do rozmów głosowych i wideo. Klipy opisuje przewodnik [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).

## Wgrywanie własnych sprite'ów

Można wgrać grafiki, które już masz. Marinara przyjmuje popularne pliki graficzne. Najlepszy efekt dają pliki PNG z przezroczystością, bo puste miejsce wokół postaci pozostaje przezroczyste na tle sceny.

### Wgrywanie pojedynczego sprite'a

1. Otwórz zakładkę **Sprites** i wybierz **Facial Expressions** albo **Full-body**.
2. W sekcji **Add Sprite** (dodawanie sprite'a) wpisz nazwę w polu tekstowym. Przy wyrazach twarzy tekst zastępczy brzmi "Expression name (e.g. happy, sad, angry)". Przy pozach brzmi "Pose name (e.g. idle, walk, battle_stance)".
3. Kliknij przycisk **Upload** i wskaż jeden plik graficzny.

Nowy sprite pojawia się w siatce poniżej pod nadaną mu nazwą.

### Szybkie dodawanie popularnych wyrazów twarzy

W kategorii **Facial Expressions** wiersz **Quick add** (szybkie dodawanie) pokazuje propozycje nazw wyrazów twarzy, których jeszcze nie ma – na przykład happy albo angry. Kliknij jedną z nich, a okno wyboru pliku otworzy się z już wpisaną nazwą. Dzięki temu nie trzeba wpisywać nazwy ręcznie.

### Wgrywanie całego folderu naraz

Jeśli w folderze czeka wiele sprite'ów, da się je zaimportować za jednym razem.

1. Nazwij pliki graficzne tak jak wyraz twarzy albo pozę. Na przykład plik `admiration.png` tworzy wyraz twarzy o nazwie admiration.
2. W sekcji **Add Sprite** kliknij przycisk **Upload Folder**.
3. Wskaż folder z obrazami.

Nazwa każdego pliku (bez rozszerzenia) staje się nazwą sprite'a. W trakcie pracy widać linię "Uploading X/Y sprites".

Żeby zrobić kilka wersji tego samego wyrazu twarzy, użyj wspólnej nazwy przed podkreśleniem. Na przykład `happy_01.png` i `happy_blush.png` liczą się jako warianty happy.

### Zarządzanie sprite'em

Najedź myszą na kafelek sprite'a w siatce, żeby zobaczyć dostępne działania:

- **Frame** (kadrowanie): przytnij obraz tak, żeby postać stała tam, gdzie trzeba.
- **Download** (pobranie): zapisz plik sprite'a na komputerze.
- **Replace** (zamiana): wgraj nowy obraz pod tą samą nazwą.
- **Delete** (usunięcie): skasuj ten sprite.

Przy usuwaniu Marinara prosi o potwierdzenie komunikatem "Delete sprite for" i nazwą. Kiedy widoczny jest więcej niż jeden sprite, to samo okno oferuje też przyciski **Delete All Expressions** i **Delete All Full-Body**.

## Generowanie sprite'ów przy pomocy AI

Jeśli połączenie do generowania obrazów jest już skonfigurowane, Marinara narysuje sprite'y za ciebie. Połączenie to łącznik między aplikacją Marinara Engine a usługą AI. Do generowania sprite'ów potrzebne jest połączenie obrazowe, a do sprite'ów animowanych – połączenie wideo. Konfigurację opisuje przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Na początek kliknij przycisk **Generate Sprite** (generowanie sprite'a) w sekcji **Add Sprite**. Otwiera się okno **Generate Sprites**. Na górze wybierasz źródło: **Expressions (Portrait)** albo **Full-body**.

Wypełnij okno:

1. Wybierz połączenie z listy rozwijanej **Image Generation Connection** (połączenie do generowania obrazów).
2. Dodaj maksymalnie cztery **Reference Images** (obrazy referencyjne), jeśli grafika ma trzymać się konkretnego wyglądu. Można też zaznaczyć pole wyboru, żeby użyć bieżącego awatara jako referencji.
3. Wpisz w polu **Appearance Description** (opis wyglądu), jak wygląda postać. To pole jest wymagane.
4. Opcjonalnie włącz **Transparent sprite background** (przezroczyste tło sprite'a). Marinara najpierw prosi o natywną przezroczystość PNG. Jeśli dostawca nie zwraca kanału alfa, wybiera nasycone tło zielone, magentowe albo cyjanowe, które najmniej pokrywa się z kolorami z pola **Appearance Description**, a potem usuwa je automatycznie.
5. Ustaw liczbę obrazów w polu **Expression Count** (liczba wyrazów twarzy) lub **Pose Count** (liczba póz) przy sylwetkach, a potem zaznacz, które wyrazy twarzy albo pozy wypełnić.
6. Kliknij przycisk **Generate**.

Gotowe obrazy trafiają do przeglądu. Każdy z nich można włączyć albo wyłączyć, zmienić mu nazwę i wykadrować przed zapisem. Kiedy wynik jest zadowalający, zapisz zaznaczone obrazy do zestawu sprite'ów postaci.

W źródle **Full-body**, jeśli postać ma już portretowe wyrazy twarzy, można zaznaczyć **Match existing expression sprites**. Powstaną wtedy pozy całej sylwetki odpowiadające każdej istniejącej nazwie wyrazu twarzy.

Dwie uwagi o generowaniu przez AI:

- Generowanie potrafi zająć kilka minut, nawet jeśli tekst w aplikacji sugeruje krótszy czas. Wolne usługi AI potrzebują więcej czasu. Poczekaj, zamiast zaczynać od nowa.
- Na niektórych urządzeniach, na przykład w części instalacji na systemie Android, generowanie sprite'ów przez AI i czyszczenie tła są niedostępne. W takiej sytuacji przycisk jest nieaktywny, a Marinara pokazuje na ekranie powód.

### Animowane sprite'y portretowe

W źródle **Expressions (Portrait)** jest pole wyboru **Generate animated portraits** (generowanie animowanych portretów). Po jego włączeniu zamiast nieruchomych obrazków powstają krótkie ruchome klipy, a każdy klip zamienia się w zapętlonego sprite'a GIF. GIF to plik graficzny, który odtwarza krótką animację. Animowane portrety korzystają z połączenia wideo zamiast z połączenia obrazowego.

## Czyszczenie tła sprite'ów

Sprite wygląda najlepiej, kiedy widać samą postać, a tło jest przezroczyste. Nieruchome sprite'y z generowania korzystają z natywnej przezroczystości, o ile dostawca ją obsługuje. W pozostałych przypadkach Marinara usuwa jednolite dobrane tło kolorowe z miękką krawędzią i wypłukuje jego barwę z włosów, tkanin oraz innych częściowo przezroczystych pikseli. Starsze sprite'y z białym tłem nadal działają.

### Ręczne czyszczenie jednego sprite'a

Kliknij obrazek sprite'a w siatce, żeby otworzyć edytor czyszczenia. Można w nim wymazać tło, domalować fragmenty z powrotem i sprawdzić efekt na tle ciemnym, jasnym oraz w szachownicę. Zmiany da się cofać, przywrócić oryginał i na koniec zatwierdzić.

### Czyszczenie wielu sprite'ów naraz

Przycisk **Clean Backgrounds** (czyszczenie teł) usuwa tło ze wszystkich sprite'ów widocznych w danej chwili w siatce.

1. Ustaw suwak **Cleanup strength** (siła czyszczenia). Skala biegnie od Soft do Aggressive, od 0 do 100, i startuje na 35. Wyższa wartość usuwa więcej tła, ale potrafi podgryźć samą postać.
2. Kliknij przycisk **Clean Backgrounds** i potwierdź.

Po czyszczeniu wsadowym Marinara zachowuje kopię bezpieczeństwa. Pojawia się linia "Last cleanup has a restore point" z przyciskiem **Undo Cleanup** (cofnięcie czyszczenia). Kliknij go, żeby przywrócić każdy zmieniony sprite do stanu sprzed czyszczenia.

Czyszczenie tła działa na obrazach PNG, JPG, JPEG, WEBP i AVIF. Nie działa na plikach GIF ani SVG.

Automatyczne czyszczenie najpierw bada obraz, a dopiero potem wybiera silnik. Szybkie wbudowane czyszczenie jednolitego tła radzi sobie w pierwszej kolejności z płaskim kolorem i dawnymi białymi tłami. Jeśli obramowanie nie jest w rzeczywistości jednolite, Marinara może sięgnąć po opcjonalny moduł AI do usuwania tła, o ile jest zainstalowany. Przy zatłoczonej scenie albo postaci w kolorach niemal identycznych z tłem najbezpieczniejszy pozostaje ręczny edytor czyszczenia.

## Eksportowanie sprite'ów

Sprite'y postaci można zapisać na komputerze w pliku zip. Zip to jeden plik, który mieści w sobie wiele innych plików.

1. Otwórz zakładkę **Sprites**.
2. Kliknij przycisk **Export** w sekcji **Add Sprite**.
3. Wybierz **Expressions only** albo **Full-body only**, żeby wyeksportować bieżącą kategorię, albo **All sprites**, żeby wyeksportować wszystko.

Pobrany plik zawiera jeden folder nazwany tak jak postać, a w nim pliki graficzne sprite'ów.

## Jak sprite'y pokazują się na czacie

Wgranie sprite'ów to dopiero połowa pracy. Trzeba jeszcze zdecydować, kiedy i jak mają się pojawiać w trakcie czatu. Ustawia się to w ustawieniach czatu, a nie w edytorze postaci.

### Roleplay Mode

W trybie **Roleplay Mode** wyświetlaniem sprite'ów steruje opcjonalny agent **Expression Engine**. Pobierz go z sekcji **Agents → Agent Organizer (organizowanie agentów)**, a potem dodaj do czatu. Agent odczytuje nastrój każdej wiadomości i dobiera pasujący sprite z wyrazem twarzy. Szczegóły opisuje [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md).

Żeby sprite'y pojawiły się w czacie Roleplay, muszą być spełnione wszystkie poniższe warunki:

- Agent **Expression Engine** jest włączony dla czatu.
- Przynajmniej jedna postać albo aktywna persona jest wybrana jako właściciel sprite'ów.
- Przynajmniej jedno źródło sprite'ów jest włączone.

Otwórz ustawienia czatu i znajdź kafelek agenta **Expression Engine**. Tam ustawia się sposób wyświetlania sprite'ów:

- **Sprite Source** (źródło sprite'ów): wybierz **Expressions**, **Full-body** albo oba. Domyślnie oba są włączone. Przynajmniej jedno musi zostać włączone.
- **Expression Avatars** (awatary z wyrazami twarzy): zamiast pływającej nakładki podmienia mały awatar przy wiadomości na pasujący sprite z wyrazem twarzy. Domyślnie wyłączone, dostępne tylko w trybie Roleplay Mode.

### Game Mode

W trybie **Game Mode** sprite całej sylwetki pokazuje się automatycznie dla postaci, która mówi albo walczy. Agent Expression Engine nie jest do tego potrzebny. Wystarczy, że postać ma wgrane sprite'y całej sylwetki. Szerszą konfigurację opisuje [Game Mode: pierwsze kroki](../game/getting-started.md).

### Przesuwanie i zmiana rozmiaru sprite'ów (tryb Arrange)

Kiedy właściciel sprite'ów jest już włączony, na kafelku agenta **Expression Engine** pojawia się sekcja **Sprite Layout** (układ sprite'ów).

- Kliknij przycisk **Arrange** (rozmieszczanie), żeby wejść w tryb przeciągania, a potem przeciągnij każdego sprite'a na wybrane miejsce. Na koniec kliknij przycisk **Done**.
- Przycisk **Reset** czyści własne pozycje i przywraca układ automatyczny.
- **Default Side** (domyślna strona) decyduje o tym, czy nowe sprite'y ciążą ku stronie **Left**, czy **Right**. Domyślna jest lewa. Zmiana strony odwraca bieżący układ.
- Rozmiar i stopień przezroczystości ustawiają cztery suwaki: **Expression Size** i **Full-body Size** działają w zakresie od 5% do 200%. **Expression Opacity** i **Full-body Opacity** działają w zakresie od 15% do 100%. Wszystkie startują na 100%.

## Klipy do rozmów wideo

Kategoria **Clips** w zakładce **Sprites** to zupełnie inna funkcja. Tworzy krótkie zapętlone filmy, które w trakcie rozmowy głosowej lub wideo w trybie Conversation pełnią rolę kamery postaci. Ponieważ należy do funkcji rozmów, jest opisana osobno – zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Animowane wyrazy twarzy](../media/animated-expressions.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
