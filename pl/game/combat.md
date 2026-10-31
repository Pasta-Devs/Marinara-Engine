# Game Mode: walka

Ten przewodnik wyjaśnia walkę w trybie Game Mode aplikacji Marinara Engine. W kroku **World** (świat) kreatora wybierz **Classic** (walka z menu) lub **Tactical** (walka na siatce) w polu **Combat Preference** (preferowany rodzaj walki). Game Master sterowany przez AI (GM, mistrz gry) ustala starcie i opisuje wyniki, a silnik rozstrzyga akcje bojowe.

## Początek starcia

Walki nie zaczynasz samodzielnie. Robi to GM, kiedy wymaga tego fabuła – na przykład po sprowokowaniu wroga albo po wejściu w zasadzkę. Wtedy nad narracją otwiera się pełny ekran bitwy. Silnik buduje starcie na podstawie tego, co dzieje się w fabule: dobiera drużynę, przeciwników, ich statystyki i ewentualne zasady specjalne.

Ekran bitwy pokazuje drużynę po jednej stronie, a przeciwników po drugiej. Każdy walczący ma pasek zdrowia (HP, punkty życia), a jeśli korzysta z umiejętności – także pasek many (MP, punkty magii). Kolejność tur widać na górze jako **Next:** i imię tego, kto działa jako następny. Licznik rund pokazuje **Round** oraz numer bieżącej rundy.

W grze, której zestaw zasad rozstrzyga własne walki, na przykład 5e (SRD 5.1), walka przebiega według zestawu zasad, a nie według opisu na tej stronie. Zobacz [Walki według zestawu zasad](fighting-on-a-ruleset.md). Zestaw zasad, który udostępnia walkom swój arkusz postaci, zachowuje opisany tutaj system walki; zobacz [Co dzieje się w walkach](rulesets.md#what-happens-in-battles).

<a id="tactical-battles-and-terrain"></a>

## Walka taktyczna i teren

W walce taktycznej drużyna i wrogowie zajmują pola planszy. Wybierz jednostkę drużyny, sprawdź jej zasięg ruchu, wybierz cel ruchu i akcję, a następnie potwierdź. To, kto i kiedy działa, zależy od ustawienia **Turn order** (kolejność tur) bitwy (zobacz [Kolejność tur](#turn-order)). Prognoza ataku pokazuje przewidywane skutki przed zatwierdzeniem.

Przy tworzeniu gry nie ma ustawień pola bitwy do wypełnienia. Każda walka otrzymuje własną planszę, wygenerowaną na podstawie nowego ziarna i krótkiego opisu tej sceny przygotowanego przez postać GM.

GM podaje środowisko sceny, formację i krótki opis terenu. Silnik tworzy dokładny układ pól i pozycje początkowe. Opis może wskazywać obszary terenu i bariery przy środku lub krawędzi mapy. Zaakceptowane pole bitwy jest zapisywane, więc odświeżenie przywraca tę samą planszę.

Silnik sprawdza opis i wynikowy układ. Zachowuje żądany teren, zapewniając możliwość dotarcia do uczestników starcia. Jeśli ograniczeń nie da się pogodzić, walka zgłasza problem. Przycisk **Use generated terrain** (użycie wygenerowanego terenu) jawnie rozpoczyna walkę bez odrzuconych elementów; nie usuwa ich po cichu.

Świat gry może też mieć **ręcznie wykonane pola bitwy**. To plansze malowane pole po polu dla jednego z miejsc świata w edytorze takim jak Pixelforge. Jeśli walka zaczyna się, gdy drużyna jest w tym miejscu albo w miejscu położonym wewnątrz niego, korzysta z jednej z tych plansz zamiast z wygenerowanej. Plansza jest używana dokładnie tak, jak ją namalowano, w scenie, dla której powstała. Jeśli miejsce ma kilka plansz, jedną z nich wybiera ziarno walki. Opis terenu od GM nie jest wtedy używany, ale formacja nadal decyduje, gdzie zaczyna każda ze stron. GM dowiaduje się, że plansza powstała dla tego miejsca, a wiersz z informacją o polu bitwy podaje nazwę planszy.

Ręcznie wykonana plansza musi spełniać trzy zasady. Ma jeden z trzech rozmiarów plansz. Dwie kolumny po każdej stronie to równiny, na których ustawiają się strony. Każde pole, na którym może stanąć walczący, łączy się z resztą. Edytor odrzuca planszę łamiącą którąś z zasad i podaje powód. Ręcznie wykonane pola bitwy są przechowywane razem z ręcznymi zmianami świata, więc wędrują z nim w plikach świata, pakietach map i bibliotece.

| Teren | Ruch pieszy | Obrona i uniki |
| --- | --- | --- |
| Równiny | Koszt 1 punktu ruchu | Bez premii |
| Las | Koszt 2 punktów ruchu | +1 obrony, +15 punktów procentowych uniku |
| Ruiny | Koszt 1 punktu ruchu | +1 obrony, +10 punktów procentowych uniku |
| Góra, woda, ściana | Blokuje ruch pieszy | Bez premii |

Jednostki z ustaloną zdolnością lotu lub teleportacji mogą poruszać się inaczej:

- **Ruch pieszy** prowadzi przez dostępne pola gruntu. Wrogie jednostki blokują drogę; ruchu nie można zakończyć na zajętym polu.
- **Lot** pozwala przekraczać teren i jednostki po drodze za jeden punkt ruchu na pole, również w lesie. Jednostka może zawisnąć nad polem zwykle blokującym ruch, ale nie nad inną jednostką.
- **Teleportacja** ignoruje teren i jednostki po drodze. Cel musi mieścić się w zasięgu ruchu, być pusty i dostępny pieszo. Nie można zakończyć ruchu w ścianie, na górze ani nad wodą bez podłoża.

Oba specjalne rodzaje ruchu korzystają z aktualnej puli ruchu i odległości liczonej wzdłuż wierszy i kolumn. Zachowują premie terenu docelowego do obrony i uniku. Oba ignorują wysokość (zobacz niżej). Wysokość lotu, sufity oraz koszty i wymogi widoczności konkretnych zaklęć nie są modelowane.

<a id="turn-order"></a>

### Kolejność tur

Bitwa Tactical rozgrywa tury na jeden z dwóch sposobów:

- **One at a time, by initiative** (po kolei, według inicjatywy): każda jednostka dostaje miejsce w wylosowanej kolejności i działać może tylko ta jednostka, której jest tura. Plansza pokazuje kolejność tur. Tak działają nowe gry Overworld RPG.
- **Your whole party, then the enemies** (najpierw cała drużyna, potem wrogowie): każda jednostka drużyny może działać, a potem rozgrywa się faza wroga. Tak działają gry Classic.

Aby to zmienić, otwórz **Chat Settings** (ustawienia czatu), rozwiń sekcję **Combat Style** (styl walki) i wybierz **Turn order**. To ustawienie pojawia się, gdy **Battle system** (system walki) to Tactical, chyba że zestaw zasad gry sam rozstrzyga walki. Zmiana działa od następnej bitwy; trwająca bitwa zachowuje swoją kolejność.

### Widzenie, osłona i wysokość

- **Widzenie.** Ściany i góry blokują widzenie. Jednostka może zaatakować, użyć umiejętności albo przedmiotu tylko wobec celu, który widzi.
- **Osłona.** Coś między atakującym a celem chroni cel. Osłonę połowiczną daje pole lasu lub ruin na linii ataku oraz ściana lub góra, która zasłania część widoku. Ściana lub góra, która zasłania większość widoku, daje osłonę w trzech czwartych. Osłona połowiczna odejmuje od szansy trafienia 15 punktów procentowych, a osłona w trzech czwartych 30. Premia z pola, na którym stoi cel, i jego osłona się nie sumują: liczy się lepsza z nich.
- **Wysokość.** Na planszy z górami góra ma dwa poziomy wysokości, a teren wokół niej jeden. Wejście o jeden poziom wyżej kosztuje jeden dodatkowy punkt ruchu, a zejście nic nie kosztuje. Różnica dwóch poziomów lub więcej to urwisko, którego nikt nie pokona pieszo. Wyższy teren blokuje też widzenie między dwoma niższymi polami. Atak z wyższego terenu w dół dodaje 10 do szansy trafienia, atak dystansowy z wyższego terenu sięga o jedno pole dalej, a niska osłona, taka jak las, nie ukrywa celu przed atakiem z góry. Ręcznie wykonane pola bitwy mogą mieć własne urwiska.

Przywoływanie nie jest jeszcze częścią własnego systemu walki aplikacji Marinara.

## Walka klasyczna

Walka Classic nie ma planszy. Uczestniczą w niej wszyscy członkowie drużyny, ale wybrana akcja steruje pierwszym żyjącym członkiem drużyny; pozostali towarzysze działają samodzielnie. Opisane niżej menu akcji i obliczenia walki określają przebieg walk Classic.

## Menu akcji

W swojej turze wybierasz z menu jedną akcję. Do dyspozycji jest sześć:

- **Attack**: zwykły atak wymierzony w jednego przeciwnika.
- **Skills**: użycie zdolności specjalnej. Umiejętności mogą kosztować MP. Jedne leczą sojusznika, inne ranią wroga, a jeszcze inne nakładają wzmocnienie albo osłabienie.
- **Special**: wpisanie dowolnej akcji własnymi słowami i kliknięcie przycisku **Ask GM**. Na przykład: "Kopię piasek w pękniętą soczewkę Strażnika Ruin." O wyniku decyduje GM.
- **Defend**: podniesienie Defense do końca rundy, żeby otrzymywać mniejsze obrażenia.
- **Items**: użycie przedmiotu z torby. Opcja **Full inventory** (pełny ekwipunek) otwiera stąd pełną listę przedmiotów. W grze z zestawem zasad przedmioty zestawu działają tak, jak mówi zestaw: ile leczą albo ranią i jakie stany nakładają. Przedmiot z ładunkami jest oferowany, dopóki zostało mu użycie, a przedmiot, który najpierw wymaga testu, ma ten test rzucany przy użyciu: po porażce zostaje zużyty na nic. Przedmiot, któremu zestaw nie daje żadnego zastosowania, nie jest oferowany. Pozostałe przedmioty działają tak, jak ocenił Game Master na początku walki, chyba że zestaw wyłącza własne przedmioty trybu Game Mode.
- **Flee**: natychmiastowa ucieczka. Ucieczka od razu kończy walkę.

Po wyborze rozgrywa się cała runda. Wyniki widać jako unoszące się liczby obrażeń, zmieniające się paski zdrowia i wpisy w dzienniku walki.

<a id="how-combat-math-works"></a>

## Jak liczona jest walka

Po rozpoczęciu starcia o każdej rundzie decyduje stała matematyka rzutów kośćmi, a nie AI. GM tylko opisuje wyniki. Nigdy nie rozstrzyga, kto trafia ani ile obrażeń zadaje. Dzięki temu walka jest uczciwa i przewidywalna. Zapis "k20" poniżej oznacza jeden rzut kością dwudziestościenną (wynik od 1 do 20).

### Inicjatywa (kolejność tur)

Na początku każdej rundy każdy walczący rzuca k20 i dolicza premię wynikającą ze statystyki Speed. Kto ma wyższy wynik, działa wcześniej. Walczący pomija całą rundę, jeśli jest zamrożony, ogłuszony lub uwięziony, albo gdy jego Speed spadła do 0.

### Atak i obrona

Kiedy jeden walczący atakuje drugiego:

1. Atakujący rzuca k20 i dolicza premię ze statystyki Attack.
2. Broniący się rzuca k20 i dolicza premię ze statystyki Defense.
3. Jeśli wynik atakującego jest niższy niż wynik broniącego się, atak chybia.
4. Trafienie krytyczne pada przy naturalnej dwudziestce albo gdy atakujący przebije obrońcę o 10 lub więcej.

### Obrażenia

Przy trafieniu obrażenia bazowe wynikają ze statystyki Attack atakującego i rosną wraz z jego poziomem. Do tego dochodzą dodatkowe kości obrażeń, a walczący na wyższych poziomach rzucają ich więcej. Trafienie krytyczne mnoży sumę przez 1.5. Na końcu Defense broniącego się zmniejsza obrażenia, blokując do 40 procent wartości tej statystyki.

### Skalowanie trudności

Ostatni krok skaluje obrażenia według poziomu trudności gry, ustawionego w kreatorze konfiguracji. Cztery ustawienia mnożą końcowe obrażenia tak:

| Trudność | Mnożnik obrażeń |
|---|---|
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Im wyższa trudność, tym mocniej biją obie strony, więc walki są krótsze i bardziej ryzykowne.

## Efekty statusu i reakcje żywiołów

Efekt statusu to tymczasowa zmiana Attack, Defense, Speed albo HP walczącego. Wzmocnienia pomagają, osłabienia szkodzą. Status trwa określoną liczbę rund, a potem mija. Efekty w rodzaju trucizny odbierają HP co rundę, a efekty regeneracyjne je przywracają. Trzy nazwane efekty – zamrożenie, ogłuszenie i uwięzienie – sprawiają, że objęty nimi walczący pomija turę.

Część ataków i umiejętności niesie żywioł: Fire, Ice, Lightning, Poison, Holy albo Shadow. Pierwszy żywioł, który trafi w cel, zostawia aurę, czyli utrzymujący się ślad tego żywiołu. Kolejne uderzenie innym żywiołem w ten sam cel wyzwala reakcję żywiołów. Reakcja dodaje premiowe obrażenia, a często też efekt statusu.

Przykładowe reakcje to Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse i Electrotoxin. Ten system działa sam. Nie trzeba go włączać ani konfigurować. Reakcje zachodzą automatycznie, gdy w ten sam cel trafią po sobie odpowiednie żywioły.

## Żywioły

Ataki, umiejętności i przedmioty mogą nieść żywioł, a żywioł, który trafi w cel wciąż noszący aurę innego, może wywołać reakcję zadającą większe obrażenia. To, jakie żywioły istnieją, zależy od settingu: gra bez zestawu settingu albo z zestawem, który żadnych nie wymienia, walczy klasyczną szóstką (ogień, lód, błyskawica, trucizna, świętość i cień); gra wuxia pięcioma fazami (drewno, ogień, ziemia, metal i woda, z których każda pokonuje następną); gra cyberpunkowa albo space opera żywiołami kinetycznym, termicznym, EM i chemicznym lub plazmowym; a gra współczesna albo osadzona w latach dwudziestych XX wieku nie ma ich wcale. Deszcz i burze na otwartym terenie osłabiają żywioły podobne do ognia i wzmacniają te podobne do błyskawicy. W walce taktycznej żywioł uderza mocniej w żywioł, który pokonuje, i słabiej w taki, który pokonuje jego. Żywioły zestawu settingu i ich reakcje zmienisz w opcji **Change its words** (zmiana słownictwa).

## Pola bitwy

Plansza walki taktycznej jest ułożona jak miejsce, w którym toczy się walka: las ma drzewa, wśród których można się ukryć, loch ściany i korytarze, a miasto ulice. Gra z zestawem settingu nazywa własne sceny jego słowami, a każda jest ułożona jak jedna z tych plansz, więc walka cyberpunkowa toczy się na dachu albo w korytarzu megabloku, a walka wuxia w bambusowym lesie albo w herbaciarni. Pola planszy też noszą nazwy ze słownictwa settingu (osłona i gruz zamiast lasu i ruin). Mapa obszaru i drobne szczegóły, na które Game Master ma zwracać uwagę, tak samo dostosowują się do settingu. Sceny zestawu settingu i nazwy pól zmienisz w opcji **Change its words**.

## Mechaniki bossów i łupy

Silni przeciwnicy mogą mieć mechaniki bossa, czyli zasady specjalne, które GM pisze na potrzeby danego starcia. Mechanika może odpalać się według harmonogramu, na przykład co kilka rund, albo gdy zdrowie bossa spadnie poniżej ustalonego progu. Mechaniki potrafią uderzyć w całą drużynę, wzmocnić bossa albo nałożyć efekt statusu. Kiedy któraś się uruchomi, jej działanie pojawia się w dzienniku walki, więc da się zareagować.

Po wygranej walce przeciwnicy zostawiają łupy, które po zakończeniu walki trafiają prosto do toreb drużyny. Każdy przedmiot ma rzadkość, od najczęstszej do najrzadszej: common, uncommon, rare, epic i legendary. Wyższa trudność przesuwa łupy w stronę rzadszych przedmiotów i daje ich nieco więcej. To, co wypada, zależy od settingu: gra z zestawem settingu daje łupy z tego zestawu (gra współczesna daje kartę podarunkową albo apteczkę, nigdy zaczarowany miecz), a te słowa zmienisz w opcji **Change its words** zestawu. Gra bez zestawu settingu daje to, co zwykle ma jej gatunek, a gatunek bez startowego zestawu settingu, taki jak Steampunk, daje zwykłe rzeczy, które nie należą do żadnego konkretnego settingu. Powiadomienie podaje, co wypadło, a Game Master dowiaduje się, że łup jest już w twoich torbach. W grze, której zestaw zasad ma własne tabele łupów, przeciwnicy zostawiają zamiast tego przedmioty z zestawu zasad, a zestaw zasad, który wyłącza własne przedmioty trybu Game Mode, daje tylko własne. Po zwycięstwie pojawia się baner **Victory!**, a po upadku drużyny – baner **Defeat...**.

## Przerywanie wypowiedzi GM

Kiedy GM jeszcze pisze odpowiedź, można wejść mu w słowo przyciskiem **Interrupt** (przerwanie). Nic z tego, co wpiszesz, nie liczy się przed faktycznym wysłaniem. Kliknięcie przycisku **Interrupt** otwiera okno potwierdzenia zatytułowane **Attempt to Interrupt?** z trzema opcjami:

- **No**: anulowanie, GM pisze dalej.
- **Force Interrupt**: czyste wejście w słowo. GM nie dowiaduje się o przerwaniu. Pole wpisywania dostaje zielone obramowanie.
- **Yes**: próba przerwania w ramach fabuły, której GM może się oprzeć. Pole wpisywania robi się czerwone, a aplikacja podpowiada "using dice recommended" i pulsuje przyciskiem kości. Rzut kością zwiększa tu szansę powodzenia.

Po potwierdzeniu wpisz wiadomość i wyślij ją. Jeśli zmienisz zdanie, kliknij przycisk **Resume**, żeby porzucić oczekujące przerwanie i pozwolić narracji płynąć dalej. Ta kontrolka przydaje się w napiętych chwilach – na przykład wtedy, gdy trzeba zareagować sekundę przed wybuchem walki.

## Quick-Time Events

GM może wyświetlić nakładkę Quick-Time Events, w skrócie QTE, przy szybkich scenach akcji, takich jak unik czy pościg. Nakładka pokazuje kurczący się pasek odliczania, komunikat **React quickly!** oraz po jednym przycisku na każdą opcję. Każdy przycisk ma numer (1, 2, 3 i tak dalej). Kliknij przycisk odpowiadający wybranej akcji.

Wybór akcji przed upływem czasu daje premię. Im szybsza reakcja, tym większa premia. Jeśli czas minie pierwszy, zamiast premii przychodzi kara. Quick-Time Event nie korzysta z kości. Liczy się wyłącznie szybkość.

## Walka na urządzeniach mobilnych

Na telefonie ekran bitwy przestawia się tak, żeby zmieścić się na małym wyświetlaczu. Przyciski akcji trzymają się dołu ekranu. Panele, które nie mieszczą się w układzie, przenoszą się do wysuwanego panelu bocznego z czterema zakładkami:

- **Party**: członkowie drużyny i ich zdrowie.
- **Boss Mechanics**: zasady specjalne bieżącego starcia.
- **Dialogue**: kwestie wypowiadane przez walczących.
- **Combat Log**: zapis wydarzeń runda po rundzie.

Dotknij zakładki, żeby otworzyć jej panel. Aby go zamknąć, dotknij poza panelem albo dotknij przycisku zamykania.

## Powiązane przewodniki

- [Game Mode: walki według zestawu zasad](fighting-on-a-ruleset.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Starcia bojowe (Roleplay)](../roleplay/combat-encounters.md)
