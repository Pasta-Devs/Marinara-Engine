# Game Mode: walka

Walka w trybie Game Mode występuje w dwóch odmianach: **Turn-Based** (walka z menu) i **Tactical** (walka na siatce). Wybierasz między nimi w polu **Combat Preference** (preferowany rodzaj walki) w kroku **World** (świat) kreatora konfiguracji. Aby zmienić wybór później, otwórz **Chat Settings** (ustawienia czatu), rozwiń sekcję **Combat Style** (styl walki) i wybierz **Battle system** (system walki). Zestaw zasad, który prowadzi własne walki, może ograniczyć dostępne opcje. Game Master (GM, czyli AI prowadzące grę) przygotowuje starcie i opisuje wynik. Marinara rozstrzyga akcje bojowe stałą matematyką rzutów kośćmi, więc AI nigdy nie decyduje, kto trafia.

## Początek starcia

Walki nie zaczynasz samodzielnie. Robi to GM, kiedy wymaga tego fabuła – na przykład po sprowokowaniu wroga albo po wejściu w zasadzkę. Wtedy nad narracją otwiera się pełny ekran bitwy, zbudowany na podstawie tego, co dzieje się w fabule: twojej drużyny, przeciwników, ich statystyk i ewentualnych zasad specjalnych.

Ekran pokazuje drużynę po jednej stronie, a przeciwników po drugiej. Każdy walczący ma pasek zdrowia (HP, punkty życia), a jeśli korzysta z umiejętności – także pasek many (MP, punkty magii). Na górze widać **Next:** (następny) i imię tego, kto działa jako następny, oraz **Round** (runda) z numerem rundy.

Sposób rozstrzygania walki zależy od systemu postaci w grze. Każda nowa gra korzysta z klas **MRPG**: każdy walczący używa statystyk, umiejętności i wyposażenia swojej klasy (zobacz [Walki w grze MRPG](#battles-in-an-mrpg-game)). Gra **Legacy**, utworzona przed wprowadzeniem klas MRPG, korzysta ze starszych zasad Attack i Defense opisanych w części [Jak liczona jest walka](#how-combat-math-works). Opisane niżej ekrany i przyciski są takie same w obu przypadkach.

> **Uwaga:** W grze z zestawem zasad, który rozstrzyga własne walki, na przykład 5e (SRD 5.1), walka przebiega według zestawu zasad, a nie według tej strony. Zobacz [Walki z zestawem zasad](fighting-on-a-ruleset.md). Zestaw zasad, który tylko użycza walkom swojego arkusza, zachowuje opisany tutaj system walki. Zobacz [Co dzieje się podczas walk](rulesets.md#what-happens-in-battles).

## Rozgrywanie walki Turn-Based

Walka Turn-Based nie ma planszy. Biorą w niej udział wszyscy członkowie drużyny. Akcję wybierasz dla jednej postaci: pierwszego żyjącego członka drużyny. Pozostali towarzysze działają samodzielnie.

W swojej turze wybierz jedną akcję:

| Akcja | Co robi |
| --- | --- |
| **Attack** | Uderza jednego przeciwnika zwykłym atakiem. |
| **Skills** | Używa zdolności specjalnej. Umiejętności mogą kosztować MP. Jedne leczą sojusznika, inne ranią wroga, a jeszcze inne nakładają wzmocnienie albo osłabienie. |
| **Special** | Wpisz dowolną akcję własnymi słowami, a potem naciśnij **Ask GM** (zapytaj GM), na przykład "Kopię piasek w pękniętą soczewkę Strażnika Ruin." O wyniku decyduje GM. |
| **Defend** | Podnosi Defense do końca rundy, więc otrzymujesz mniejsze obrażenia. |
| **Items** | Używa przedmiotu z torby. **Full inventory** (pełny ekwipunek) otwiera pełną listę przedmiotów. |
| **Flee** | Natychmiast opuszcza walkę. Zawsze się udaje i od razu kończy walkę. |

Po wyborze rozgrywa się runda. Wyniki widać jako unoszące się liczby obrażeń, zmieniające się paski zdrowia i wpisy w **Combat Log** (dziennik walki). Po wygranej pojawia się baner **Victory!**, a gdy drużyna padnie – baner **Defeat...**.

W grze z zestawem zasad **Items** obsługuje własne przedmioty zestawu tak, jak mówi zestaw: ile leczą albo ranią i jakie stany nakładają. Przedmiot z ładunkami jest oferowany, dopóki zostało mu jakieś użycie. Jeśli przedmiot najpierw wymaga testu, test zostaje rzucony, a po porażce przedmiot zostaje zużyty na nic. Przedmiot, któremu zestaw nie daje żadnego zastosowania, nie jest oferowany. Pozostałe przedmioty działają tak, jak ocenił GM na początku walki, chyba że zestaw zasad wyłącza własne przedmioty trybu Game Mode.

## Rozgrywanie walki Tactical

Walka Tactical umieszcza drużynę i wrogów na polu bitwy podzielonym na siatkę. Każdy kwadrat to pole, na przykład **Plains** (równiny) albo **Forest** (las).

1. Gdy nadejdzie twoja tura (**Player Phase**, czyli faza gracza, albo przy imieniu jednostki widać "'s turn"), kliknij jedną ze swoich jednostek na siatce. Na planszy pojawi się jej zasięg ruchu.
2. Kliknij pole docelowe, a potem **Confirm Move** (potwierdzenie ruchu). Kliknij **Reset Move** (cofnięcie ruchu), żeby wybrać ponownie.
3. Po ruchu plansza wyświetla "Already moved — choose an action." Wybierz **Attack**, **Defend** albo **Item**. Jest tu też **Flee**.
4. Przy **Attack** plansza wyświetla **Select an enemy** (wybierz wroga). Kliknij jednego. Prognoza ataku pokazuje spodziewany wynik. Kliknij **Confirm** (potwierdzenie), żeby zatwierdzić. **← Back** (wstecz) cofa o jeden krok.
5. Gdy skończysz, kliknij **End Turn** (koniec tury). W kolejności tur, w której drużyna działa pierwsza, rozgrywa się potem **Enemy Phase** (faza wroga).

Jeśli plansza pokazuje **Resolving…** (rozstrzyganie), poczekaj chwilę. **Restart** po potwierdzeniu zaczyna bitwę od początku na tym samym polu bitwy.

To, kto i kiedy działa, zależy od ustawienia **Turn order** (kolejność tur). Zobacz [Kolejność tur](#turn-order). Ręcznie wykonane plansze i zasady terenu opisuje część [Walka taktyczna i teren](#tactical-battles-and-terrain).

<a id="battles-in-an-mrpg-game"></a>

## Walki w grze MRPG

W grze korzystającej z klas MRPG każdy członek drużyny walczy swoją aktywną klasą: jej statystykami, umiejętnościami i wyposażeniem z arkusza (zobacz [Klasy MRPG](mrpg-classes.md)). Przeciwnicy walczą według kategorii: minion, standard, elite albo boss. Panel obok walki pokazuje, kto działa jako następny, klasę, poziom, szereg i zasoby każdego walczącego, a na końcu także to, co zdobyła drużyna.

<a id="turns-skills-and-resources"></a>

### Tury, umiejętności i zasoby

- **Kolejność tur.** Nie ma rzutów na inicjatywę. Walczący działają na osi czasu, a każda akcja odsuwa następną turę postaci tym mniej, im wyższa jest jej Speed, więc szybcy walczący działają częściej.
- **Umiejętności.** Sekcja **Skills** pokazuje umiejętności aktywnej klasy oraz przeniesione umiejętności, każdą z kosztem i szacowanym działaniem. Umiejętności magiczne kosztują **MP**, które nie odnawia się podczas walki. Pozostałe kosztują **Stamina**, która odnawia się trochę co turę.
- **Obrona.** Akcja **Defend** podnosi Defense o połowę do następnej tury walczącego i przywraca więcej Stamina.
- **Amunicja i żywioły.** Marksman ładuje rodzaj amunicji, a Channeler skupia żywioł, korzystając z panelu obok walki. Obie zmiany są darmowe. Jeśli pozostawisz wybór grze, AI dobierze najlepszą opcję dla danego celu.

<a id="hitting-and-damage"></a>

### Trafienia i obrażenia

- **Szansa trafienia** rośnie wraz ze Skill i Luck atakującego, a maleje wraz ze Speed i Luck celu. Nigdy nie spada poniżej 25%.
- **Trafienia krytyczne** wynikają ze Skill atakującego przeciwko Luck celu i zadają podwójne obrażenia.
- **Obrażenia.** Atak bronią zadaje obrażenia równe Strength plus moc ataku, pomniejszone o Defense celu. Zaklęcie albo trafienie kosturem, różdżką lub magicznym katalizatorem korzysta zamiast tego z Magic przeciwko Resistance. Moc rośnie nieco wraz z poziomem, tak jak w przypadku lepszego wyposażenia.
- **Rodzaje obrażeń.** Każde trafienie ma rodzaj: cięte, kłute lub obuchowe dla broni; żywioł (ogień, lód, błyskawica, wiatr, drewno, ziemia, woda albo metal); światło lub mrok. Przeciwnik może być podatny na dany rodzaj (obrażenia większe o połowę), odporny na niego (połowa obrażeń), niewrażliwy albo może go pochłaniać. Podatność lub odporność pojawia się przy przeciwniku, gdy trafienie ją odkryje, a drużyna zapamiętuje ją dla każdego przeciwnika tego rodzaju. Podatności na żywioły wynikają z cyklu pięciu faz, w którym każdy żywioł pokonuje następny: drewno rozsadza ziemię, ziemia tamuje wodę, woda gasi ogień, ogień topi metal, a metal ścina drewno.

<a id="rows"></a>

### Szeregi

Walka Turn-Based ma po każdej stronie szereg przedni i tylny. Trafienie wręcz w tylny szereg zadaje połowę obrażeń w obie strony, natomiast ataki dystansowe i zaklęcia zadają pełne obrażenia w obu szeregach. Gdy po jednej stronie nikt nie stoi w przednim szeregu, jej tylny szereg staje się przednim. Każda klasa ma domyślny szereg, który można zmienić na zakładce **Status** jej arkusza. Walki Tactical nie mają szeregów: to pozycje na planszy decydują, kto może kogo dosięgnąć.

<a id="taunts-yielding-and-taming"></a>

### Prowokowanie, poddawanie się i oswajanie

- **Provoke.** Umiejętność Provoke klasy Sentinel sprawia, że każdy przeciwnik przez 2 tury obiera za cel postać Sentinel. Na planszy przeciwnik, który nie może do niej dotrzeć, podchodzi tak blisko, jak może, i zamiast tego przygotowuje akcję.
- **Poddanie się.** Inteligentny przeciwnik, który przegrywa, może się poddać albo uciec. Gdy pozostają tylko przeciwnicy, którzy się poddali, gra pyta o **Spare them** (oszczędź ich) albo **Finish them** (wykończ ich). W obu przypadkach drużyna dostaje łupy i doświadczenie. Przeciwnik z łupem, który ucieknie, zabiera zdobycz ze sobą.
- **Oswajanie.** Tracker może oswoić dziką bestię, której zostało mniej niż 30% HP. Bestia opuszcza walkę i staje się towarzyszem, którego postać zachowuje nawet po przegranej walce.

<a id="after-the-fight"></a>

### Po walce

Wygrana walka daje doświadczenie wszystkim, którzy w niej uczestniczyli (zobacz [Poziomy i doświadczenie](mrpg-classes.md#levels-and-experience)), a panel końcowy pokazuje każdy zdobyty poziom, statystyki, które wzrosły, oraz nowo dostępny awans klasy. Przegrana walka lub ucieczka nie daje nic. Gdy opcja **Permadeath** jest włączona, członek drużyny, który leży pokonany po zakończeniu walki, przepada na zawsze.

W grze MRPG ustawienie **Difficulty** decyduje o liczbie i sile przeciwników, zamiast mnożyć zadawane przez nich obrażenia. Na poziomie **Brutal** przeciwnicy mogą mieć o kilka poziomów więcej od drużyny.

## Przerywanie wypowiedzi GM

Kiedy GM pisze, możesz wejść mu w słowo przyciskiem **Interrupt** (przerwanie). Nic z tego, co wpiszesz, nie liczy się, dopóki tego nie wyślesz.

1. Kliknij **Interrupt**. Otworzy się okno zatytułowane **Attempt to Interrupt?** (próba przerwania).
2. Wybierz jedną z opcji:
   - **No** (nie) anuluje i pozwala GM pisać dalej.
   - **Force Interrupt** (wymuszone przerwanie) czysto wchodzi w słowo. GM nie dowiaduje się o przerwaniu. Pole wpisywania dostaje zielone obramowanie.
   - **Yes** (tak) próbuje przerwać w ramach fabuły, a GM może się temu oprzeć. Pole wpisywania robi się czerwone, aplikacja podpowiada "using dice recommended", a przycisk kości pulsuje. Rzut kośćmi może pomóc.
3. Wpisz wiadomość i wyślij ją.

Jeśli zmienisz zdanie, naciśnij **Resume** (wznowienie). Oczekujące przerwanie zostaje porzucone, a narracja toczy się dalej.

## Quick-Time Events

GM może wywołać Quick-Time Event (QTE) przy szybkich momentach akcji, takich jak unik czy pościg. Nakładka pokazuje kurczący się pasek odliczania, komunikat **React quickly!** (reaguj szybko) i po jednym ponumerowanym przycisku na każdą opcję. Kliknij wybraną akcję, zanim skończy się czas, żeby zdobyć premię. Im szybciej zareagujesz, tym większa premia. Jeśli czas się skończy, zamiast premii dostajesz karę. QTE nie korzysta z kości.

Aby wyłączyć QTE, na przykład do gry z czytnikiem ekranu albo bez limitów czasu, wyłącz **Quick Time Events** w kroku **Features** (funkcje) kreatora.

## Walka na telefonie

Na telefonie przyciski akcji trzymają się dołu ekranu. Panele, które się nie mieszczą, przenoszą się do wysuwanej od dołu szuflady z czterema zakładkami: **Party** (członkowie drużyny i ich zdrowie), **Boss Mechanics** (zasady specjalne walki), **Dialogue** (kwestie wypowiadane przez walczących w bitwie) i **Combat Log** (zapis runda po rundzie). Dotknij zakładki, żeby otworzyć jej szufladę. Aby ją zamknąć, dotknij miejsca poza szufladą albo jej przycisku zamykania.

<a id="how-combat-math-works"></a>

## Jak liczona jest walka

Zasady w tej części dotyczą gier **Legacy** oraz gier, których zestaw zasad użycza arkusza walkom aplikacji Marinara. Gra korzystająca z klas **MRPG**, czyli każda nowa gra, walczy zamiast tego według zasad opisanych w części [Walki w grze MRPG](#battles-in-an-mrpg-game).

O każdej rundzie decyduje stała matematyka rzutów kośćmi, a nie AI. Dzięki temu walka jest uczciwa i spójna. d20 to kość dwudziestościenna (wynik od 1 do 20). W przypadku walk Tactical zobacz też części [Kolejność tur](#turn-order) i [Widzenie, osłona i wysokość](#sight-cover-and-height).

**Inicjatywa.** Na początku każdej rundy każdy walczący rzuca d20 i dolicza premię ze statystyki Speed (Speed podzielona przez 5, zaokrąglona w dół). Kto ma wyższy wynik, działa wcześniej. Walczący pomija rundę, jeśli jest zamrożony, ogłuszony lub uwięziony albo gdy jego Speed spadła do 0.

**Atak i obrona.** Kiedy jeden walczący atakuje drugiego:

1. Atakujący rzuca d20 i dolicza premię ze statystyki Attack.
2. Broniący się rzuca d20 i dolicza premię ze statystyki Defense.
3. Jeśli wynik atakującego jest niższy, atak chybia.
4. Trafienie krytyczne pada przy naturalnej dwudziestce albo gdy atakujący przebije obrońcę o 10 lub więcej.

**Obrażenia.** Przy trafieniu obrażenia bazowe wynikają ze statystyki Attack atakującego i rosną wraz z poziomem. Do tego dochodzą dodatkowe kości d6, a walczący na wyższych poziomach rzucają ich więcej. Trafienie krytyczne mnoży sumę przez 1,5. Następnie Defense broniącego się blokuje z tych obrażeń do 40 procent własnej wartości.

<a id="difficulty-scaling"></a>

### Skalowanie trudności

W grze Legacy obrażenia są następnie skalowane według poziomu **Difficulty** (trudność) ustawionego w kreatorze konfiguracji. Po nim działają modyfikatory pogody i efektów statusu. Mnożnik dotyczy tylko ataków wrogów, więc w trudniejszej grze wrogowie biją mocniej, a obrażenia twojej drużyny pozostają takie same.

| Trudność | Mnożnik obrażeń wrogów |
| --- | --- |
| Casual | 0,6 |
| Normal | 1,0 |
| Hard | 1,3 |
| Brutal | 1,6 |

Te mnożniki należą do własnych zasad aplikacji Marinara. Zestaw zasad ma własne reguły trudności.

## Efekty statusu i reakcje żywiołów

Ta część opisuje walki Legacy. Gra MRPG ma własne rodzaje obrażeń (zobacz [Trafienia i obrażenia](#hitting-and-damage)), a działanie jej umiejętności, na przykład Poisoned, Asleep czy Slowed, opisano przy każdej umiejętności.

Efekt statusu to tymczasowa zmiana Attack, Defense, Speed albo HP walczącego. Wzmocnienia pomagają, a osłabienia szkodzą. Status trwa określoną liczbę rund, a potem mija. Efekty w rodzaju trucizny odbierają HP co rundę, a efekty w rodzaju regeneracji je przywracają. Zamrożenie, ogłuszenie i uwięzienie sprawiają, że walczący pomija turę.

Część ataków i umiejętności niesie żywioł. Pierwszy żywioł, który trafi w cel, zostawia aurę, czyli utrzymujący się ślad. Inny żywioł, który trafi w ten sam cel, wyzwala reakcję żywiołów, która dodaje premiowe obrażenia, a często też efekt statusu. Reakcje to między innymi Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse i Electrotoxin. Zachodzą automatycznie i nie trzeba ich włączać.

### Żywioły

To, jakie żywioły istnieją, zależy od settingu:

- Brak zestawu settingu albo zestaw, który żadnych nie wymienia: klasyczna szóstka (ogień, lód, błyskawica, trucizna, świętość, cień).
- Wuxia: pięć faz (drewno, ogień, ziemia, metal, woda), z których każda pokonuje następną.
- Cyberpunk i space opera: żywioł kinetyczny, termiczny, EM oraz chemiczny lub plazmowy.
- Współczesność i lata dwudzieste XX wieku: brak.

Deszcz i burze na otwartym terenie osłabiają żywioły podobne do ognia i wzmacniają te podobne do błyskawicy. W walce taktycznej żywioł uderza mocniej w żywioł, który pokonuje, i słabiej w taki, który pokonuje jego. Żywioły i reakcje zestawu zmienisz w opcji **Change its words** (zmiana słownictwa). Zobacz [Wybór zestawu settingu](getting-started.md#choosing-a-setting-kit).

## Mechaniki bossów i łupy

Silni przeciwnicy mogą mieć mechaniki bossa, czyli zasady specjalne, które GM pisze na potrzeby danej walki. Mechanika uruchamia się według harmonogramu, na przykład co kilka rund, albo gdy zdrowie bossa spadnie poniżej ustalonego progu. Może uderzyć w całą drużynę, wzmocnić bossa albo nałożyć efekt statusu. Kiedy się uruchomi, **Combat Log** to pokazuje, więc możesz zareagować.

Po wygranej przeciwnicy zostawiają łupy, które trafiają prosto do toreb drużyny. Przedmioty mają rzadkość: od common przez uncommon, rare i epic po legendary. Wyższa trudność przesuwa łupy w stronę rzadszych przedmiotów i daje ich nieco więcej. Powiadomienie podaje, co wypadło, a GM dowiaduje się, że łup jest już w twoich torbach.

To, co wypada, zależy od settingu. Gra z zestawem settingu daje łupy z tego zestawu (gra współczesna daje kartę podarunkową albo apteczkę, nigdy zaczarowany miecz), a te słowa zmienisz w opcji **Change its words**. Gra bez zestawu daje to, co zwykle ma jej gatunek. Gatunek bez startowego zestawu, taki jak Steampunk, daje zwykłe rzeczy, które nie należą do żadnego settingu. W grze, której zestaw zasad ma własne tabele łupów, przeciwnicy zostawiają zamiast tego przedmioty zestawu zasad, a zestaw zasad, który wyłącza własne przedmioty trybu Game Mode, daje tylko własne.

## Informacje: walka taktyczna

<a id="tactical-battles-and-terrain"></a>

### Walka taktyczna i teren

Przy tworzeniu gry nie ma ustawień pola bitwy do wypełnienia. Każda walka dostaje własną planszę, wygenerowaną z nowego ziarna i krótkiego opisu sceny przygotowanego przez GM. GM podaje środowisko, formację i krótki opis terenu, który może prosić o obszary terenu i bariery przy środku albo przy krawędzi. Marinara tworzy dokładny układ pól i pozycje początkowe. Zaakceptowane pole bitwy jest zapisywane, więc odświeżenie przywraca tę planszę.

Marinara sprawdza opis i układ. Zachowuje żądany teren, a jednocześnie dba o to, żeby uczestnicy starcia mogli do siebie dotrzeć.

Jeśli ograniczeń nie da się pogodzić, walka zgłasza problem. Wtedy **Use generated terrain** (użycie wygenerowanego terenu) rozpoczyna walkę bez odrzuconych elementów terenu. Nigdy nie usuwa ich po cichu.

Świat może też mieć ręcznie wykonane pola bitwy: plansze malowane pole po polu dla jednego z jego miejsc w edytorze świata, takim jak Pixelforge. Gdy walka zaczyna się w tym miejscu albo wewnątrz niego, korzysta z jednej z tych plansz zamiast z wygenerowanej.

- Plansza jest używana dokładnie tak, jak ją namalowano. Jeśli miejsce ma kilka plansz, wybiera ziarno walki (liczba, która wskazuje jedną z nich).
- Opis terenu od GM nie jest wtedy używany, ale formacja nadal decyduje, gdzie zaczyna każda ze stron. GM dowiaduje się, że plansza powstała dla tego miejsca.
- Ręcznie wykonana plansza musi spełniać trzy zasady: ma jeden z trzech rozmiarów plansz, dwie kolumny po każdej stronie to równiny, na których ustawiają się strony, a każde pole, na którym może stanąć walczący, łączy się z resztą. Edytor odrzuca planszę łamiącą którąś z zasad i podaje powód.

Te plansze są przechowywane razem z ręcznymi zmianami świata, więc wędrują w plikach świata, pakietach map i bibliotece.

| Teren | Ruch pieszy | Obrona i uniki |
| --- | --- | --- |
| Równiny | Koszt 1 punktu ruchu | Bez premii |
| Las | Koszt 2 punktów ruchu | +1 obrony, +15 punktów procentowych uniku |
| Ruiny | Koszt 1 punktu ruchu | +1 obrony, +10 punktów procentowych uniku |
| Góra, woda, ściana | Blokuje ruch pieszy | Bez premii |

Jednostki z ustaloną zdolnością lotu albo teleportacji poruszają się inaczej:

- **Ruch pieszy** prowadzi przez dostępne pola gruntu. Wrogie jednostki blokują drogę, a ruchu nie można zakończyć na zajętym polu.
- **Lot** przekracza teren i jednostki za jeden punkt ruchu na pole, również w lesie. Latająca jednostka może zawisnąć nad polem, które inaczej blokuje ruch, ale nie może zakończyć ruchu na innej jednostce.
- **Teleportacja** ignoruje teren i jednostki po drodze. Cel musi mieścić się w zasięgu ruchu, być wolny i dostępny pieszo. Nie można zakończyć jej w ścianie, na górze ani nad wodą bez podłoża.

Oba specjalne rodzaje ruchu korzystają z bieżącej puli ruchu i odległości liczonej w liniach prostych (nie po przekątnej). Zachowują premie terenu docelowego do obrony i uniku oraz ignorują wysokość. Wysokość lotu, sufity oraz koszty i wymogi widoczności właściwe konkretnym zaklęciom nie są modelowane. Przywoływanie nie jest jeszcze częścią własnego systemu walki aplikacji Marinara.

<a id="turn-order"></a>

### Kolejność tur

Bitwa Tactical rozgrywa tury na jeden z dwóch sposobów:

- **One at a time, by initiative** (po kolei, według inicjatywy): każda jednostka dostaje miejsce w wylosowanej kolejności i działać może tylko ta jednostka, której jest tura. Plansza pokazuje kolejność. Tak działają nowe gry Overworld.
- **Your whole party, then the enemies** (najpierw cała drużyna, potem wrogowie): każda jednostka drużyny może działać, a potem rozgrywa się faza wroga. Tak działają gry VN.

Aby to zmienić, otwórz **Chat Settings**, rozwiń sekcję **Combat Style** i wybierz **Turn order**. To ustawienie pojawia się, gdy **Battle system** to Tactical, chyba że zestaw zasad gry prowadzi własne walki. Zmiana obowiązuje od następnej bitwy. Trwająca bitwa zachowuje swoją kolejność.

<a id="sight-cover-and-height"></a>

### Widzenie, osłona i wysokość

- **Widzenie.** Ściany i góry blokują widzenie. Jednostka może zaatakować, użyć umiejętności albo przedmiotu tylko wobec celu, który widzi.
- **Osłona.** Coś między atakującym a celem chroni cel. Osłonę połowiczną daje pole lasu lub ruin na linii ataku oraz ściana lub góra, która zasłania część widoku. Ściana lub góra, która zasłania większość widoku, daje osłonę w trzech czwartych. Osłona połowiczna odejmuje od szansy trafienia 15 punktów procentowych, a osłona w trzech czwartych 30. Premia z pola, na którym stoi cel, i jego osłona się nie sumują: liczy się lepsza z nich.
- **Wysokość.** Na planszy z górami góra ma dwa poziomy wysokości, a teren wokół niej jeden. Wejście o jeden poziom wyżej kosztuje jeden dodatkowy punkt ruchu, a zejście nic nie kosztuje. Różnica dwóch poziomów lub więcej to urwisko, którego nikt nie pokona pieszo. Wyższy teren blokuje też widzenie między dwoma niższymi polami. Atak z wyższego terenu w dół dodaje 10 do szansy trafienia, atak dystansowy z wyższego terenu sięga o jedno pole dalej, a niska osłona, taka jak las, nie ukrywa celu przed atakiem z góry. Ręcznie wykonane pola bitwy mogą mieć własne urwiska.

### Sceny pól bitwy

Plansza walki taktycznej jest ułożona jak miejsce, w którym toczy się walka: las ma drzewa, wśród których można się ukryć, loch ma ściany i korytarze, a miasto ulice. Gra z zestawem settingu nazywa własne sceny jego słowami, więc walka cyberpunkowa toczy się na dachu albo w korytarzu megabloku, a walka wuxia w bambusowym lesie albo w herbaciarni. Pola planszy też noszą nazwy ze słownictwa settingu (osłona i gruz zamiast lasu i ruin). Sceny zestawu i nazwy pól zmienisz w opcji **Change its words**.

## Powiązane przewodniki

- [Game Mode: walki z zestawem zasad](fighting-on-a-ruleset.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Starcia bojowe (Roleplay)](../roleplay/combat-encounters.md)
