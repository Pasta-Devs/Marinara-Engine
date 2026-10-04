# Pasek HUD i trackery w trybie Roleplay

Ten przewodnik wyjaśnia, czym jest pasek HUD w trybie Roleplay i jakie małe widgety trackerów pokazuje. Zobaczysz, jak zmieniać i blokować ich wartości oraz jak działa większy panel **Tracker Panel**. Dotyczy trybu Roleplay w aplikacji Marinara Engine.

## Czym jest pasek HUD

Na telefonie HUD (heads-up display) jest rzędem małych widgetów trackerów na górze czatu. Każdy widget pokazuje fragment bieżącego stanu opowieści: godzinę, statystyki albo to, kto jest obecny. Marinara sama dba o aktualność tych wartości w miarę rozwoju fabuły.

Na komputerze trackery nie znajdują się w rzędzie HUD. Są w **Tracker Panel**, gdy jest widoczny, a w przeciwnym razie w opisanym poniżej oknie **Trackers**.

Wartości pochodzą od agentów śledzących stan, czyli trackerów. Agent to mały pomocnik AI działający w tle. Każdy tracker obserwuje opowieść i po każdej wiadomości aktualizuje jeden fragment paska HUD. Nie trzeba go o to prosić.

Widget pojawia się tylko wtedy, gdy jego tracker jest włączony w danym czacie. Agentów włącza się i wyłącza w panelu **Chat Settings** (ustawienia czatu), w sekcji **Agents**. Kiedy żaden tracker nie jest włączony, na pasku HUD nie ma widgetów.

## Widgety paska HUD

Trackery mają siedem widgetów. Każdy z nich pojawia się dopiero po włączeniu własnego agenta.

| Widget                 | Wymagany agent    | Co pokazuje                                                                      |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Miejsce, datę, godzinę, pogodę, temperaturę i własne pola świata                 |
| **Persona Stats**      | Persona Stats     | Paski statusu persony (postaci, w którą się wcielasz) i linię statusu            |
| **Present Characters** | Character Tracker | Kto jest w scenie, wraz z nastrojem, wyglądem i własnymi polami danej postaci    |
| **Inventory**          | Persona Stats     | Przedmioty w ekwipunku wraz z liczbą sztuk                                       |
| **Inventory Tracker**  | Inventory Tracker | Osobne listy walut, założonego wyposażenia i noszonych przedmiotów               |
| **Active Quests**      | Quest Tracker     | Bieżący cel                                                                      |
| **Custom Tracker**     | Custom Tracker    | Własne nazwane pola, na przykład liczniki albo walutę                            |

Uwaga: widget **Inventory** zasila ten sam agent **Persona Stats**, który obsługuje widget **Persona Stats**. Włącz agenta **Persona Stats**, żeby mieć oba.

Osobny **Inventory Tracker** działa niezależnie od ekwipunku z Persona Stats. Trzyma zwięzłe wpisy złożone z nazwy i liczby sztuk w trzech grupach – **Currencies**, **Equipped** i **Inventory** – i pilnuje, żeby założone wyposażenie nie pojawiało się dodatkowo wśród noszonych przedmiotów.

Każdy wpis to mała pigułka. Pigułki układają się wzdłuż szerokości panelu i zawijają do kolejnego wiersza, więc długa lista przedmiotów pozostaje czytelna, zamiast rozciągać się w wysoką kolumnę. Liczba sztuk pojawia się tylko wtedy, gdy przekracza jeden, w postaci `×4` po nazwie; pojedynczy przedmiot pokazuje samą nazwę. W wąskim panelu pigułki układają się po jednej w wierszu.

Aby zmienić liczbę sztuk, która wynosi teraz jeden, włącz **add mode** (tryb dodawania) albo **lock mode** (tryb blokady) – oba pokazują pole liczby przy każdym wpisie.

Widget **Present Characters** pokazuje maksymalnie trzy emoji postaci, a resztę zlicza jako "+N". Widgety **Inventory** i **Custom Tracker** przewijają swoje wpisy pojedynczo.

<a id="the-trackers-window"></a>

## Okno Trackers

Na komputerze trackery czatu Roleplay korzystają z okna **Trackers**, gdy **Tracker Panel** nie jest widoczny. Jeśli obok wiadomości jest miejsce, okno otwiera się po lewej stronie. W przeciwnym razie zaczyna jako mały przycisk **Trackers** w lewym górnym rogu czatu. Kliknij go, żeby otworzyć okno. Czat z zapisanym układem zachowuje wybrane rozmieszczenie.

Po aktualizacji starszego czatu jego komputerowe widgety trackerów są zgrupowane w tym oknie. Pozostałe narzędzia czatu zachowują swoje ikony jako ruchome przyciski.

Okno możesz przesunąć za pasek tytułu, zmienić jego rozmiar za krawędzie oraz użyć przycisków w prawym górnym rogu:

- **Pin** utrzymuje okno otwarte po kliknięciu w innym miejscu. Okno jest początkowo przypięte.
- **Lock** blokuje przesuwanie i zmianę rozmiaru okna oraz położenie jego przycisku. Przycisk nadal otwiera okno, w którym można zdjąć blokadę.
- **Close** zwija okno do ruchomego przycisku **Trackers**. Kliknięcie przycisku otwiera je w poprzednim miejscu.

Żeby użyć zamiast niego Tracker Panel, kliknij kostkę na pasku tytułu Chat Settings. Kiedy panel nie jest widoczny, trackery pozostają dostępne przez okno lub przycisk. **Reset View** w Chat Settings usuwa zapisany układ i wybiera początkowe okno lub przycisk zależnie od dostępnego miejsca.

Gdy agenci pracują nad czatem, obok tytułu okna i na przycisku **Chat Settings** widać małą kropkę.

Każdy tracker ma własną rozwijaną sekcję, nazywaną po angielsku drawer. Kliknij jej nagłówek, żeby zwinąć ją do małego podglądu widgetu, i kliknij ponownie, żeby zobaczyć cały tracker. Marinara zapamiętuje, które sekcje są zwinięte.

Tracker może też mieć własne okno: kliknij przycisk otwierania w osobnym oknie obok strzałki albo przeciągnij tytuł poza okno Trackers. Nowe okno nie jest początkowo przypięte. Przypnij je, aby pozostało otwarte po kliknięciu poza nim lub zamknięciu okna Trackers. Jego **X** zwija je do małego przycisku z ikoną trackera; przycisk otwiera okno w poprzednim miejscu. Żeby przywrócić tracker, kliknij **Put back in Trackers** (zakrzywiona strzałka tuż po lewej od **X**) albo przeciągnij go na okno Trackers. Każdy czat zapamiętuje, które trackery są odłączone i gdzie leżą.

Na dole **Agent activity** pokazuje, co zrobili agenci czatu. Możesz tu ponownie uruchomić trackery, ponowić działania agentów po błędzie, zatrzymać działających agentów i użyć **Clear Trackers**. Tracker Panel ma tę samą sekcję na dole.

## Zmiana wartości w panelu podręcznym

Na telefonie dotknij dowolny widget, żeby otworzyć jego panel podręczny. Na komputerze te same edytory są w rozwijanych sekcjach okna Trackers. Panel podręczny to mały pływający panel. Każde pole w nim można zmienić, więc wartość źle ustawioną przez AI da się poprawić. Zmiany zapisują się od razu.

Oto, co da się zmienić w poszczególnych panelach podręcznych:

- **World State**: pola **Location**, **Date**, **Time**, **Weather**, **Temperature** oraz wiersze własnych pól świata.
- **Persona Stats**: linia **Status** oraz nazwane paski statystyk z wartością bieżącą i maksymalną. Paski da się dodawać i usuwać.
- **Present Characters**: dodawanie i usuwanie postaci oraz zmiana emoji, imienia, pól **Mood**, **Look**, **Outfit**, **Thinks** (prywatne myśli) i wartości własnych pól każdej z nich. Do każdej postaci można wgrać awatar. Przycisk **Auto** przełącza między "Auto-generate avatars: ON" a "Auto-generate avatars: OFF".
- **Inventory**: dodawanie i usuwanie przedmiotów oraz zmiana nazwy i liczby sztuk.
- **Inventory Tracker**: dodawanie i usuwanie wpisów w grupach **Currencies**, **Equipped** i **Inventory** oraz zmiana nazwy lub liczby sztuk. Przeniesienie przedmiotu między grupami nie jest jeszcze jedną czynnością – usuń go z jednej grupy i dodaj do drugiej.
- **Active Quests**: dodawanie i usuwanie zadań. Każde zadanie ma nazwane cele z polami wyboru oznaczającymi ukończenie.
- **Custom Tracker**: dodawanie, usuwanie i zmiana pól z nazwą oraz wartością.

## Tryb blokady

Trackery nadpisują wartości na pasku HUD po każdej turze. Zwykle to pomaga, ale czasem jakaś wartość uparcie się rozjeżdża i trzeba ją przypiąć ręcznie. Od tego jest tryb blokady.

Zablokowanego pola kolejne automatyczne uruchomienie trackera już nie rusza. Zablokowane pola są oznaczone, więc widać je od razu.

Blokowanie pola:

1. Otwórz panel podręczny widgetu.
2. Kliknij przełącznik kłódki przy górnej krawędzi panelu podręcznego. Jego podpowiedź (tekst po najechaniu kursorem) brzmi **Enter lock mode**.
3. Obok każdej edytowalnej wartości pojawia się teraz mały przycisk kłódki.
4. Kliknij przycisk kłódki przy wartości, którą chcesz przypiąć. Jego podpowiedź brzmi **Lock field**.

Żeby odblokować, kliknij ten sam przycisk ponownie (podpowiedź **Unlock field**). Żeby wyjść z trybu blokady, kliknij ponownie górny przełącznik (podpowiedź **Exit lock mode**). Tryb blokady obejmuje cały pasek HUD, więc włączenie go w jednym panelu podręcznym odsłania przyciski kłódki wszędzie.

## Ponowne uruchomienie trackera

Tracker da się zaktualizować od razu, bez czekania na kolejną wiadomość.

W każdym panelu podręcznym jest mały przycisk odświeżania z okrągłą strzałką. Kliknij go, żeby uruchomić ponownie tylko ten jeden tracker dla ostatniej tury. Podpowiedzi wymieniają nazwę trackera, na przykład **Re-run world state tracker only** albo **Re-run quest tracker only**.

W panelu **Chat Settings → Agents** przełącznik **Manual Trackers** przestawia wszystkie włączone trackery na sterowanie ręczne. Można też zostawić go wyłączonym i ustawić ręcznie tylko wybranych agentów w sekcji **Individual tracker schedule**. Gdy przynajmniej jeden tracker działa ręcznie, pojawia się przycisk odświeżania: na telefonie w rzędzie HUD, a na komputerze obok tytułu okna Trackers. Kliknij go, żeby uruchomić komplet ręcznych trackerów dla bieżącej tury. Przycisk odświeżania wewnątrz danego trackera nadal uruchamia go pojedynczo.

**Agent activity** ma własną sekcję tuż pod **Agents** w **Chat Settings**, na dole Tracker Panel, a na komputerze również na dole okna Trackers. Stamtąd da się uruchomić ponownie wszystkie trackery, powtórzyć próbę dla agentów, którym się nie udało, oraz użyć przycisku **Clear Trackers** do skasowania całego śledzonego stanu świata w czacie. Działania **Clear Trackers** nie da się cofnąć, więc korzystaj z niego ostrożnie.

## Panel **Tracker Panel**

**Tracker Panel** to większy panel boczny z tymi samymi danymi trackerów, co kompaktowe widgety na pasku HUD. Daje kartom trackerów więcej miejsca i dokłada portrety oraz myśli postaci. Konfiguruje się go w panelu **Settings** (Ustawienia), w zakładce **Appearance**, w sekcji **Tracker Panel**.

Żeby włączyć panel w czacie Roleplay, otwórz **Chat Settings** i kliknij przycisk **Tracker Panel** (kostka) na pasku tytułu, obok przypięcia i kłódki. Przycisk pozostaje wyróżniony, gdy panel jest włączony, a panel pojawia się obok czatu. Kliknij ponownie, żeby go wyłączyć i ukryć. Na komputerze trackery pojawią się wtedy w oknie Trackers.

Na telefonie włączenie panelu dodaje do czatu przycisk Tracker Panel, który można dowolnie przeciągać. Dotknij go, żeby otworzyć panel; zamknięcie panelu przywraca przycisk. Przy wyłączonym panelu widgety trackerów pozostają w rzędzie HUD.

Dzięki kontrolkom w nagłówku panelu można też zmienić strukturę trackerów:

- Kliknij przycisk **+**, żeby włączyć tryb dodawania. W sekcji World pojawia się **Add world field**, a na karcie każdej obecnej postaci – **Add custom field**. Nazwy pól są widoczne także w trybie normalnym, więc ich wartości zawsze da się zrozumieć.
- Kliknij ikonę kosza, żeby włączyć tryb usuwania, a potem usuń własne pola świata lub postaci. Razem z polem znikają też zapisane blokady tego pola.
- Kliknij ikonę kłódki, żeby włączyć tryb blokady. Wartości własnych pól zachowują się przy blokowaniu tak samo jak wbudowane wartości trackerów.
- Kliknij ikonę przekreślonego oka, żeby włączyć tryb ukrywania, a potem wybierz **Mood**, **Look**, **Outfit** albo **Thoughts** na karcie postaci. Ukryte pola znikają z panelu **Tracker Panel** i z paska HUD w trybie Roleplay, zostają wyczyszczone i pozostają zablokowane, więc trackery ich nie uzupełniają. Włącz tryb ukrywania ponownie, żeby przywrócić ukryte pole jako puste.

Nazwy własnych pól wyznaczają strukturę i nie zmieniają się między uruchomieniami trackerów. Trackery aktualizują wartości, kiedy zmienia je fabuła, a pominięcie pola w odpowiedzi agenta nie kasuje pól utworzonych ręcznie.

Odpowiadają za to następujące ustawienia:

- **Tracker Panel**: główny przełącznik panelu, ten sam, którym steruje kostka w Chat Settings. Domyślnie jest włączony. Po włączeniu etykieta brzmi "Shown in the Roleplay HUD". Po wyłączeniu na komputerze trackery pojawiają się w oknie Trackers.
- **Replace tracker HUD icons**: ukrywa kompaktowy pasek ikon na telefonach i pozwala umieścić panel przy krawędzi ekranu.
- **Use expression sprites for tracker portraits**: sprawia, że portrety trackerów korzystają ze sprite'a wyrazu twarzy postaci (portretu z bieżącą emocją) zamiast zwykłego awatara, o ile taki istnieje. Sprite'y wyrazu twarzy opisuje przewodnik [Sprite'y postaci](../characters/sprites.md).
- **Panel background**: wybór koloru lub gradientu tła panelu.
- **Desktop size**: wybór szerokości panelu. Dostępne opcje to **Compact**, **Standard** i **Expanded**.
- **Thought display mode**: wybór sposobu wyświetlania myśli postaci. Opcja **Docked** otwiera je wewnątrz karty postaci. Opcja **Floating** otwiera je jako dymek obok portretu.
- **Always show Docked thoughts**: przy ustawieniu **Thought display mode** na **Docked** myśl każdej wyróżnionej postaci pozostaje widoczna, zamiast chować się pod przyciskiem.
- **Temperature unit**: przełącza wyświetlanie temperatury między **Celsius** a **Fahrenheit**. Domyślnie jest to Celsius. Zmienia się tylko sposób wyświetlania, a nie zapisana wartość stanu świata.

## Którzy agenci zasilają pasek HUD

Każdy widget na pasku HUD wypełnia tracker uruchamiany po każdej turze. Tabela widgetów na początku tego przewodnika pokazuje, który agent zasila który widget.

Startowe paski statystyk i atrybuty RPG persony albo postaci ustawia się w zakładce **Stats** w edytorze postaci lub persony. Trackery dostosowują potem te wartości w miarę rozwoju fabuły.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Kolory postaci i statystyki RPG](../characters/colors-and-stats.md)
- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Game Mode: widgety HUD](../game/hud-widgets.md)
