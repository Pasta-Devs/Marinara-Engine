# Pasek HUD i trackery w trybie Roleplay

Pasek HUD (heads-up display) pokazuje na żywo szczegóły opowieści w czacie Roleplay: godzinę, pogodę, obecne postacie, twoje statystyki, przedmioty i zadania. Każdą wartość możesz poprawić ręcznie, zablokować, żeby AI przestała ją zmieniać, i na żądanie ponownie uruchomić tracker.

Wartości pochodzą od agentów śledzących, czyli trackerów. Agent to pomocnik, który działa obok odpowiedzi. Agent śledzący obserwuje opowieść i po każdej wiadomości aktualizuje jedną część paska HUD. Widget pojawia się tylko wtedy, gdy jego agent jest włączony w danym czacie.

## Włącz pasek HUD

1. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem z suwakami w czacie.
2. Przejdź do **Agents** (agenci) i włącz **Enable Agents** (włączenie agentów).
3. Dodaj agentów z list pod przełącznikiem. Do podstawowego paska HUD dodaj najpierw **World State**. Po więcej dodaj **Persona Stats**, **Character Tracker** albo **Quest Tracker**.
4. Wyślij wiadomość.

Po odpowiedzi pojawia się tracker. Na telefonie widzisz przycisk **World State**. Na komputerze widzisz **Tracker Panel** (panel trackerów) albo okno **Trackers** (opis niżej). Tabela widgetów pokazuje, który agent zasila który widget.

Jeśli to nie zadziałało: gdy żaden agent śledzący nie jest włączony, pasek HUD nie pokazuje widgetów. Sprawdź, czy **Enable Agents** jest włączone.

## Gdzie pojawia się pasek HUD

Na telefonie trackery to ruchome przyciski **World State** i **Player & Tracker**. Dotknij jednego z nich, żeby otworzyć jego panel, a **X**, żeby go zamknąć. Gdy World State ma już szczegóły, jego przycisk pokazuje mały baner z lokalizacją, dniem, godziną, pogodą i temperaturą. Przeciągnij przyciski w dowolne miejsce. Czat zapamiętuje, gdzie je ustawisz. Ich wygląd zależy od ustawienia **Chat widget style** (styl widgetów czatu) w **Settings → Appearance → App** (ustawienia, wygląd, aplikacja).

Na komputerze te same trackery pojawiają się w jednym z dwóch miejsc:

- **Tracker Panel**: panel boczny obok wiadomości. Domyślnie jest włączony. Włącza go i wyłącza przycisk z kostką na pasku tytułu **Chat Settings**.
- Okno **Trackers**: ruchome okno, w którym są trackery, gdy Tracker Panel jest wyłączony.

Naraz korzystasz tylko z jednego z nich. Zobacz [Panel **Tracker Panel**](#the-tracker-panel) i [Okno Trackers](#the-trackers-window).

## Widgety paska HUD

| Widget | Wymagany agent | Co pokazuje |
| --- | --- | --- |
| **World State** | World State | Miejsce, datę, godzinę, pogodę, temperaturę i własne pola świata |
| **Persona Stats** | Persona Stats | Paski statusu persony (postaci, w którą się wcielasz) i linię statusu |
| **Present Characters** | Character Tracker | Kto jest w scenie, wraz z nastrojem, wyglądem i własnymi polami |
| **Inventory** | Persona Stats | Przedmioty, które nosisz, wraz z liczbą sztuk |
| **Inventory Tracker** | Inventory Tracker | Osobne listy walut, założonego wyposażenia i noszonych przedmiotów |
| **Active Quests** | Quest Tracker | Bieżący cel |
| **Custom Tracker** | Custom Tracker | Własne nazwane pola, na przykład liczniki albo walutę |

Widget **Inventory** pochodzi od agenta **Persona Stats**, więc włącz tego agenta, żeby mieć oba. **Inventory Tracker** działa osobno. Trzyma wpisy w trzech grupach – **Currencies** (waluty), **Equipped** (założone) i **Inventory** (ekwipunek) – i nigdy nie pokazuje założonego wyposażenia dwa razy.

Każdy wpis to mała pigułka. Liczba sztuk pojawia się jako `×4` tylko wtedy, gdy przekracza jeden. Aby zmienić liczbę sztuk, która wynosi jeden, włącz tryb dodawania albo tryb blokady: oba pokazują pole liczby przy każdym wpisie. Tryb dodawania włącza przycisk **+** w nagłówku Tracker Panel. [Tryb blokady](#lock-mode) opisuje sekcja niżej.

**Present Characters** pokazuje maksymalnie trzy emoji postaci i licznik "+N". **Inventory** i **Custom Tracker** pokazują swoje wpisy pojedynczo.

## Zmień wartość trackera

Każde pole można edytować, więc wartość źle ustawioną przez AI da się poprawić. Zmiana zapisuje się od razu. Kolejna odpowiedź wychodzi od poprawionej wartości, także wtedy, gdy ponownie generujesz poprawioną odpowiedź albo tworzysz jej nowy swipe.

1. Otwórz tracker: na telefonie dotknij jego przycisku, a na komputerze otwórz jego sekcję w Tracker Panel albo w oknie Trackers.
2. Kliknij wartość i wpisz nową.

- **World State**: pola **Location**, **Date**, **Time**, **Weather**, **Temperature** oraz własne pola świata.
- **Persona Stats**: linia **Status** oraz nazwane paski z wartością bieżącą i maksymalną. Paski da się dodawać i usuwać.
- **Present Characters**: dodawanie i usuwanie postaci. Każdej z nich da się zmienić emoji, imię, pola **Mood**, **Look**, **Outfit**, **Thinks** (prywatne myśli) i własne pola. Do każdej postaci można wgrać awatar. Przycisk **Auto** włącza i wyłącza "Auto-generate avatars".
- **Inventory**: dodawanie i usuwanie przedmiotów oraz zmiana nazw i liczby sztuk.
- **Inventory Tracker**: dodawanie i usuwanie wpisów w grupach **Currencies**, **Equipped** i **Inventory**. Aby przenieść przedmiot do innej grupy, usuń go i dodaj w tamtej grupie.
- **Active Quests**: dodawanie i usuwanie zadań. Każde zadanie ma cele z polami wyboru.
- **Custom Tracker**: dodawanie, usuwanie i zmiana pól z nazwą i wartością.

Aby poprawić wiele wartości naraz, skorzystaj z edytora [State Editor](#the-state-editor).

<a id="lock-mode"></a>

## Tryb blokady

Agenci śledzący nadpisują wartości na pasku HUD po każdej turze. Tryb blokady pozwala przypiąć wartość. Zablokowanego pola kolejne automatyczne uruchomienie nie rusza. Korzystaj z niego, gdy jakaś wartość uparcie się rozjeżdża.

1. Otwórz tracker.
2. Kliknij przełącznik kłódki przy górnej krawędzi trackera (podpowiedź **Enter lock mode**). Obok każdej edytowalnej wartości pojawia się mały przycisk kłódki.
3. Kliknij przycisk kłódki przy wartości (podpowiedź **Lock field**). Zablokowane pola są oznaczone.

Aby odblokować, kliknij ten sam przycisk ponownie (podpowiedź **Unlock field**). Aby wyjść z trybu blokady, kliknij ponownie górny przełącznik (podpowiedź **Exit lock mode**). Tryb blokady obejmuje cały pasek HUD, więc włączenie go w jednym trackerze pokazuje przyciski kłódki wszędzie.

## Ponownie uruchom tracker

Aby zaktualizować tracker od razu, bez czekania na kolejną wiadomość, kliknij przycisk z okrągłą strzałką w jego wnętrzu. Uruchamia on ponownie tylko ten tracker dla ostatniej tury. Podpowiedź wymienia nazwę trackera, na przykład **Re-run world state tracker only**.

Aby tracker uruchamiał się tylko na twoje żądanie, otwórz **Chat Settings → Agents → Trackers Control** (ustawienia czatu, agenci, sterowanie trackerami) i włącz ten tracker w sekcji **Individual tracker schedule** (harmonogram poszczególnych trackerów). Ręczny tracker nie uruchamia się po każdej odpowiedzi. Czat, w którym był włączony dawny przełącznik **Manual Trackers**, pokazuje tam wszystkie trackery jako włączone.

Gdy przynajmniej jeden tracker działa ręcznie, pojawia się przycisk odświeżania: na telefonie w rzędzie HUD, a na komputerze obok tytułu okna Trackers. Kliknij go, żeby uruchomić ręczne trackery dla bieżącej tury.

W **Agent activity** (aktywność agentów) uruchomisz ponownie wszystkie trackery, ponowisz działanie agentów, którym się nie udało, i użyjesz **Clear Trackers** (wyczyszczenie trackerów). Zobacz [Agent activity](getting-started.md#agent-activity).

> **Ostrzeżenie:** **Clear Trackers** kasuje cały śledzony stan świata w czacie i nie da się tego cofnąć.

<a id="the-trackers-window"></a>

## Okno Trackers

Na komputerze trackery korzystają z okna **Trackers**, gdy Tracker Panel jest wyłączony. Jeśli obok wiadomości jest miejsce, okno otwiera się po lewej stronie. W przeciwnym razie zaczyna jako mały przycisk **Trackers** w lewym górnym rogu czatu. Kliknij przycisk, żeby otworzyć okno. Czat z zapisanym układem zachowuje twoje rozmieszczenie.

Okno przesuwasz za pasek tytułu, a jego rozmiar zmieniasz za krawędzie. W prawym górnym rogu ma przyciski:

- **Pin** (przypięcie): utrzymuje okno otwarte po kliknięciu w innym miejscu. Okno jest początkowo przypięte.
- **Lock** (blokada): blokuje przesuwanie i zmianę rozmiaru okna oraz unieruchamia jego przycisk. Przycisk nadal otwiera okno.
- **Close** (zamknięcie): zwija okno do ruchomego przycisku **Trackers**.

**Reset View** (przywrócenie widoku) w Chat Settings usuwa zapisane rozmieszczenie i wybiera początkowe okno lub przycisk zależnie od dostępnego miejsca.

Każdy tracker ma własną zwijaną sekcję. Kliknij jej nagłówek, żeby zwinąć ją do małego podglądu, i kliknij ponownie, żeby ją otworzyć. Marinara zapamiętuje, które sekcje są zwinięte.

Aby dać jednemu trackerowi własne okno, kliknij przycisk wydzielania obok jego strzałki albo przeciągnij jego tytuł poza okno Trackers. Nowe okno nie jest początkowo przypięte. Przypnij je, żeby pozostało otwarte. **X** zwija je do małego przycisku z ikoną trackera. **World State** zwija się natomiast do banera z tą samą lokalizacją, datą, godziną i pogodą co na telefonie, więc możesz przeciągnąć go w dowolne miejsce, na przykład na środek górnej krawędzi czatu. Aby przywrócić tracker, kliknij **Put back in Trackers** (zakrzywiona strzałka tuż po lewej od **X**) albo przeciągnij go na okno Trackers. Każdy czat zapamiętuje, które trackery są wydzielone i gdzie leżą.

<a id="the-tracker-panel"></a>

## Panel **Tracker Panel**

**Tracker Panel** to większy panel boczny z tymi samymi danymi. Pokazuje też portrety i myśli postaci.

1. Otwórz **Chat Settings**.
2. Kliknij przycisk **Tracker Panel** (kostka) na jego pasku tytułu, obok przypięcia i kłódki. Przycisk pozostaje wyróżniony, dopóki panel jest włączony.
3. Kliknij go ponownie, żeby ukryć panel. Na komputerze trackery pojawią się wtedy w oknie Trackers.

Na komputerze panel mieści się obok wiadomości, maksymalnie do szerokości ustawionej w **Desktop size** (rozmiar na komputerze). Gdy okno jest za wąskie na jedno i drugie, na przykład przy otwartym pasku bocznym czatów, wiadomości i pole wiadomości nieco się zwężają. Na telefonie lub tablecie włączenie panelu dodaje przycisk Tracker Panel, który można przeciągać. Dotknij go, żeby otworzyć panel, i dotknij ponownie, żeby go zamknąć. Gdy panel lub inny ekran zasłania czat, ruchome przyciski czatu są ukryte i wracają potem na te same miejsca.

### Dostosuj pola trackerów

Przyciski w nagłówku panelu zmieniają strukturę trackera:

- **+** włącza tryb dodawania. W sekcji World pojawia się **Add world field** (dodanie pola świata), a na karcie każdej obecnej postaci – **Add custom field** (dodanie własnego pola). Nazwy pól pozostają widoczne w trybie normalnym.
- Ikona kosza włącza tryb usuwania, w którym usuwasz własne pola świata lub postaci. Usunięcie pola usuwa też jego blokady.
- Ikona kłódki włącza tryb blokady. Własne pola blokują się tak samo jak wbudowane.
- Ikona przekreślonego oka włącza tryb ukrywania. Wybierz **Mood**, **Look**, **Outfit** albo **Thoughts** na karcie postaci. Ukryte pole znika z Tracker Panel i z paska HUD, zostaje wyczyszczone i pozostaje zablokowane, więc agenci go nie uzupełniają. Włącz tryb ukrywania ponownie, żeby pokazać je jako puste pole.

Agenci aktualizują wartości twoich własnych pól. Nigdy nie usuwają utworzonych przez ciebie pól.

### Utwórz nowy portret

Na dużej karcie postaci da się utworzyć nowy portret, gdy agent Character Tracker ma połączenie do obrazów. Na kompaktowej karcie kliknij **Feature character card** (wyróżnienie karty postaci), żeby otworzyć dużą kartę. Okno Trackers zawsze pokazuje duże karty. Najedź na portret i kliknij przycisk z ikoną oka, żeby utworzyć portret na podstawie pola **Look**, albo przycisk z ikoną koszuli, żeby utworzyć go na podstawie pól **Look** i **Outfit**. Przycisk z ikoną koszuli pojawia się tylko wtedy, gdy postać ma strój. Stary portret zostaje, dopóki nowy nie będzie gotowy. Jeśli tworzenie się nie powiedzie, zostaje stary portret. Postacie pokazywane z awatarem karty albo ze sprite'em wyrazu twarzy nie mają tych przycisków.

### Ustawienia Tracker Panel

Otwórz **Settings → Appearance** (ustawienia, wygląd), rozwiń grupę **Roleplay** i znajdź sekcję **Tracker Panel**.

| Ustawienie | Co robi |
| --- | --- |
| **Tracker Panel** | Przełącznik włączający i wyłączający panel, ten sam, którym steruje kostka. Domyślnie włączony. Po włączeniu etykieta brzmi "Shown in the Roleplay HUD". |
| **Dock Tracker Panel to edge** (zadokowanie Tracker Panel przy krawędzi) | Umieszcza panel przy krawędzi ekranu i odsuwa od niego pobliskie kontrolki czatu. |
| **Use expression sprites for tracker portraits** (sprite'y wyrazów twarzy jako portrety trackerów) | Używa aktualnego sprite'a wyrazu twarzy postaci zamiast zwykłego awatara, o ile taki istnieje. Zobacz [Sprite'y postaci](../characters/sprites.md). |
| **Panel background** (tło panelu) | Kolor lub gradient panelu. |
| **Desktop size** | Szerokość panelu: **Compact**, **Standard** albo **Expanded**. |
| **Thought display mode** (sposób wyświetlania myśli) | **Docked** otwiera myśli wewnątrz karty postaci. **Floating** otwiera je jako dymek obok portretu. |
| **Always show Docked thoughts** (zawsze widoczne zadokowane myśli) | Przy ustawieniu **Docked** myśl każdej wyróżnionej postaci pozostaje widoczna, zamiast chować się pod przyciskiem. |
| **Stat display mode** (sposób wyświetlania statystyk) | Pokazuje statystyki jako paski albo okrągłe wskaźniki. |
| **Temperature unit** (jednostka temperatury) | **°C** (domyślnie) albo **°F**. Zmienia się tylko sposób wyświetlania, a nie zapisana wartość. |

<a id="the-state-editor"></a>

## State Editor

**State Editor** pokazuje wszystkie trackery bieżącej tury w jednym oknie, więc możesz znaleźć wartość i ją poprawić bez otwierania każdego trackera z osobna. Działa także na telefonie.

Możesz go otworzyć z każdego z tych miejsc:

- Zębatka (**Tracker panel settings**) w nagłówku Tracker Panel, a potem przycisk **{ }** (**Open in State Editor**).
- Przycisk **{ }** na pasku tytułu okna **Trackers** albo wydzielonego trackera.
- Na telefonie przycisk **{ }** w panelach **World State** i **Player & Tracker**.
- Link **Open in State Editor** pod nagłówkiem **Tracker Data** w **Agent Suite**.

Edytor otwiera się na sekcji trackera, z którego go otwarto. Na przykład World State otwiera go na sekcji **Scene**.

- **Linia tury**: pod polem wyszukiwania. Podaje wiadomość i swipe, które edytujesz, na przykład "Editing message #12 · swipe 2 of 3". **Latest** (najnowsza) oznacza najnowszą turę. Każdy swipe ma własny stan, więc żeby edytować inny, najpierw przełącz swipe'a.
- **Sekcje**: **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** i **Active Quests**. Na telefonie są chipami nad edytorem. Kropka oznacza sekcję ze zmianami.
- **Wyszukiwanie**: wpisz klucz lub wartość, na przykład `mood`. Kliknij wynik, aby od razu do niego przejść.
- **Fields** (pola): każda sekcja otwiera się jako **Fields**, z polami na tekst, liczby i wartości włącz/wyłącz.
- **No value** (brak wartości): puste pole pokazuje wybór między **Text** (tekst), **Number** (liczba) i **On/off** (włącz/wyłącz).
- **Add item** (dodanie elementu): dodaje wpis, kopiując ten powyżej.
- **Add** (dodaj): dodaje nazwane pole do sekcji albo do pustej karty.
- **×**: usuwa wpis albo czyści wartość.
- **JSON**: edycja surowych danych. **Format** (formatuj) porządkuje dane. Sekcji z błędnym kodem JSON nie da się zapisać, dopóki go nie naprawisz.
- **Revert** (cofnij): cofa twoje zmiany w jednej sekcji.

Postacie i zadania należą do opowieści, więc nie da się tu dodawać ich kart. Możesz natomiast edytować listy w ich wnętrzu, na przykład statystyki postaci.

Aby zapisać:

1. Kliknij **Review changes** (przejrzyj zmiany), żeby zobaczyć każdą zmianę linia po linii.
2. Kliknij **Save changes** (zapisz zmiany). Wszystkie sekcje zapisują się naraz w turze, którą edytujesz.

Do tego czasu szkice zostają w oknie, a przy zamykaniu okno pyta, zanim je odrzuci.

Jeśli to nie zadziałało: gdy historia posunęła się naprzód podczas edycji, edytor jej nie nadpisze. Nowa odpowiedź lub swipe albo aktualizacja trackera w zmienianej przez ciebie sekcji sprawia, że zapis zostaje odrzucony z przyciskiem **Reload** (wczytaj ponownie). **Reload** pokazuje najnowszy stan i odrzuca twoje szkice.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Kolory postaci i statystyki fabularne](../characters/colors-and-stats.md): zakładka **Stats** (statystyki) ustawia paski i atrybuty, z którymi startuje persona lub postać.
- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Game Mode: widgety HUD](../game/hud-widgets.md)
