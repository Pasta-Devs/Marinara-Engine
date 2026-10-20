# Game Mode: walka

Ten przewodnik wyjaśnia walkę w trybie Game Mode aplikacji Marinara Engine. W kroku **World** (świat) kreatora wybierz **Classic** (walka z menu) lub **Tactical** (walka na siatce) w polu **Combat Preference** (preferowany rodzaj walki). Game Master sterowany przez AI (GM, mistrz gry) ustala starcie i opisuje wyniki, a silnik rozstrzyga akcje bojowe.

<a id="tactical-battles-and-terrain"></a>

## Walka taktyczna i teren

W walce taktycznej drużyna i wrogowie zajmują pola planszy. Wybierz jednostkę drużyny, sprawdź jej zasięg ruchu, wybierz cel ruchu i akcję, a następnie potwierdź. To, kto i kiedy działa, zależy od ustawienia **Turn order** (kolejność tur) bitwy (zobacz [Kolejność tur](#turn-order)). Prognoza ataku pokazuje przewidywane skutki przed zatwierdzeniem.

Przy tworzeniu gry Tactical opcjonalne ustawienia pola bitwy pozwalają wybrać ziarno, rozmiar oraz wskazówki dotyczące terenu dla postaci GM. Puste pole ziarna oznacza wygenerowanie go automatycznie. Ziarno to liczba całkowita od 0 do 4294967295, włącznie z zerem. Odtwarza planszę przy tych samych uczestnikach starcia, opisie terenu i pozostałych danych generatora; nie wymusza tej samej historii ani tych samych wrogów u postaci GM.

GM podaje środowisko sceny, formację i krótki opis terenu. Silnik tworzy dokładny układ pól i pozycje początkowe. Opis może wskazywać obszary terenu i bariery przy środku lub krawędzi mapy. Wskazówki to prośba do postaci GM, a nie gwarancja przełożenia każdego słowa na pole. Zaakceptowane pole bitwy jest zapisywane, więc odświeżenie przywraca tę samą planszę.

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

Pełny system walki przywoływanych stworzeń to osobna przyszła praca.

## Walka klasyczna

Dalsze sekcje o menu akcji i matematyce rzutów opisują walkę Classic. Uczestniczy w niej cała drużyna, ale wybrane polecenie steruje pierwszym żyjącym członkiem drużyny; pozostali towarzysze działają automatycznie.

## Początek starcia

Walki nie zaczynasz samodzielnie. Robi to GM, kiedy wymaga tego fabuła – na przykład po sprowokowaniu wroga albo po wejściu w zasadzkę. Wtedy nad narracją otwiera się pełny ekran bitwy. Silnik buduje starcie na podstawie tego, co dzieje się w fabule: dobiera drużynę, przeciwników, ich statystyki i ewentualne zasady specjalne.

Ekran bitwy pokazuje drużynę po jednej stronie, a przeciwników po drugiej. Każdy walczący ma pasek zdrowia (HP, punkty życia), a jeśli korzysta z umiejętności – także pasek many (MP, punkty magii). Kolejność tur widać na górze jako **Next:** i imię tego, kto działa jako następny. Licznik rund pokazuje **Round** oraz numer bieżącej rundy.

<a id="games-whose-ruleset-resolves-its-own-fights"></a>

### Gry, w których zestaw zasad sam rozstrzyga walkę

Zestaw zasad może rozstrzygać całą walkę, zamiast tylko przekazywać kilka liczb systemowi walki aplikacji Marinara Engine. Wtedy ekran bitwy należy do zestawu: menu zawiera ataki i zdolności twojej postaci, obowiązują jego budżety akcji i stany, a dziennik pokazuje rzeczywiste obliczenia. Wszystko zapisuje się w arkuszu postaci od razu po rozstrzygnięciu.

Zestaw określa także, co mieści się w jednej turze. Cios może zadawać kilka rodzajów obrażeń jednocześnie; każda część ma własny rzut, odporność i rzut obronny, ale razem nadal stanowią jeden cios. Jeden wydatek akcji może dać kilka uderzeń. Dopóki zostają, menu oferuje je bez dodatkowego kosztu i podaje ich liczbę, więc możesz zmienić broń albo przejść między uderzeniami. Zdolność może nic nie kosztować, dać drugą akcję tylko na tę turę albo pozwolić na sprint, wycofanie lub ukrycie mniejszym kosztem. Stały efekt postaci, np. dodatkowe obrażenia przy pierwszym trafieniu spełniającym warunki w turze, dodaje się sam i pojawia w dzienniku. Stan może utrudniać lub ułatwiać własne rzuty obronne, zmniejszać o połowę wszystkie obrażenia, zabraniać atakowania albo zbliżania się do tego, kto go nałożył, lub znikać, gdy tamten padnie. Stan może też zmieniać liczbę: dodawać do obrony, dodawać albo odejmować kości w rzutach ataku, rzutach obronnych i testach przeciwstawnych albo cię spowalniać. Dziennik pokazuje każdy taki stan obok rzutu, który zmienił, a szanse w menu go uwzględniają. Niektóre stany trwają do początku twojej następnej tury albo tylko do najbliższego ataku lub rzutu obronnego, którego dotyczą. Zestaw może też liczyć coś takiego jak wyczerpanie na torze w twoim arkuszu, tak że każdy osiągnięty poziom nieco pogarsza sytuację, dopóki trwa.

Zestaw, którego testy polegają na rzucie garścią kości i liczeniu tych, które osiągnęły próg, może walczyć w ten sam sposób. Wtedy atak rzuca twoją pulą i do trafienia potrzebuje określonej liczby sukcesów, nigdy mniej niż jednego, a każdy sukces ponad tę liczbę dodaje kość do obrażeń. Obrażenia też rzuca się kośćmi, a trafiona postać może część z nich pochłonąć zależnie od rodzaju obrażeń: albo rzuca kośćmi pochłaniania, z których każda odejmuje jeden punkt, albo odejmuje kości przed rzutem na obrażenia; to, co zostanie, zaznacza jej rany. Twoja kara za rany odejmuje kości z twoich pul tak samo jak z testów, a stan dodaje albo odejmuje kości. Rzuty obronne i testy przeciwstawne też są pulami. Dziennik podaje, ile kości weszło do rzutu, jaki próg miały osiągnąć, ile sukcesów dały i ile odjęło pochłanianie. Taki zestaw może też rzucać na inicjatywę od nowa na początku każdej rundy i ograniczać, ile zasobu można wydać w jednej turze, tak że coś, co przekroczyłoby limit, po prostu nie pojawia się w menu aż do twojej następnej tury. Zestaw z pulą może też prowadzić inicjatywę jako liczbę na całą walkę, którą przesuwają ataki: przy każdym ataku wybierasz, czy zamiast zadawać obrażenia, zabierasz dla siebie część liczby celu, czy wydajesz własną liczbę jako kości obrażeń. Atak z wydaniem, który trafi, resetuje twoją liczbę; chybiony kosztuje cię jej tyle, ile określa zestaw. Kto spadnie do progu załamania zestawu, ulega załamaniu i nie może wydawać, dopóki nie dojdzie do siebie. Kolejność w każdej rundzie wynika z tych liczb, a liczba każdej postaci jest widoczna obok jej zdrowia.

Zestaw może też pozwolić każdemu uczestnikowi walki rozpocząć test przeciwstawny: chwycić kogoś, przewrócić go albo odepchnąć lub wyrwać się z chwytu. Obie strony rzucają i dodają własną wartość, wygrywa wyższa suma, a menu przed wyborem pokazuje twoją szansę na wygraną. Wygrany chwyt unieruchamia przeciwnika, dopóki się nie wyrwie albo ty nie padniesz; przegrany nic nie zmienia. Wyrwanie się pojawia się w menu tylko wtedy, gdy coś cię trzyma, i tylko wobec tego, kto trzyma. Odepchnięcie przesuwa kogoś tylko na polu bitwy i zatrzymuje się na ścianach oraz na każdym, kto stoi na drodze.

Niektóre zdolności są odpowiedzią na ruch kogoś innego, zamiast być używane we własnej turze. Gdy przeciwnik zamierza czegoś użyć, gdy coś jest wymierzone w ciebie, gdy atak właśnie cię trafił albo gdy coś właśnie zadało ci obrażenia, a masz odpowiedź na ten moment, walka zatrzymuje się, a menu oferuje ją obok przycisku **Pass** (pominięcie). Po trafieniu dziennik podaje wynik rzutu ataku i wartość, przeciwko której go wykonano, więc widać, czy odpowiedź taka jak Shield zamieniłaby go w chybienie; jeśli jej użyjesz, ten sam rzut jest sprawdzany ponownie, a dziennik podaje, czy nadal trafia. Przeciwnicy też mogą tak odpowiadać, na przykład własną paradą. Kontra może powstrzymać zdolność przeciwnika, zanim zadziała, niezależnie od tego, w kogo była wymierzona, o ile przeciwnik jest w zasięgu kontry; zestaw może określić, że kontra odpowiada tylko na niektóre rodzaje zdolności, na przykład zaklęcia. Koszt powstrzymanej zdolności i tak zostaje wydany, a na kontrę nic nie może odpowiedzieć.

Zestaw może też określać długość pola planszy we własnych jednostkach: stopach, krokach lub innych. Jeżeli tak jest, a **Combat Preference** twojej gry to **Tactical**, walka odbywa się na polu bitwy: z tymi samymi planszami, wygenerowanymi albo ręcznie wykonanymi dla danego miejsca, z tym samym terenem i rozstawieniem co opisane wyżej walki Tactical. Preferencja znów ma znaczenie. Zestaw bez odległości lub gra z **Classic** działa jak wcześniej, bez ograniczeń wyboru celu wynikających z pozycji.

Na tym polu wszystko zależy od liczb zestawu. Zasięg ruchu wynika z jego reguły ruchu lub szybkości stworzenia, zasięg broni z jej wpisów, a obszar zdolności staje się rzeczywistą eksplozją, stożkiem lub linią. Ściana zatrzymuje strzał, osłona daje premię określoną w zasadach, a opuszczenie czyjegoś zasięgu pozwala mu uderzyć, gdy zestaw przypisuje takiemu atakowi koszt. Ruch odbywa się w ośmiu kierunkach po jednym polu, tak jak na planszach stołowych, dla których napisano te zasady; nie używa czterech kierunków własnych walk Tactical aplikacji.

Plansza jest widoczna na ekranie. Każde pole to przycisk: poruszasz się wskaźnikiem lub klawiszami strzałek, a pole opisuje teren, stojącą tam postać i koszt dojścia. **Move** (ruch) podświetla dostępne pola i koszt w jednostkach zestawu, pokazuje drogę po najechaniu lub ustawieniu fokusu oraz oznacza bursztynowo pola, których droga sprowokuje atak; pod planszą podaje napastników. Akcja wymagająca celu podświetla dozwolone postacie i pozwala wybrać je na planszy lub liście. Atak bez celu w zasięgu pokazuje **Nobody is in reach. Move closer.** (nikt nie jest w zasięgu; podejdź bliżej). Obszar celuje w pole: dozwolone pola są podświetlone, a pole pod wskaźnikiem wskazuje wszystkich trafionych, także sojuszników. Ruch można dzielić przed akcją i po niej; menu wraca z pozostałymi możliwościami, a panel **Movement** pokazuje resztę ruchu w jednostce zestawu. Escape porzuca niedokończony wybór i przenosi obsługę klawiatury do menu.

Zestaw może też korzystać z większej części pola bitwy: stopniowanej osłony, aż do osłony w trzech czwartych; wyższego terenu, który zmienia ataki i upadki; stworzeń, które latają, pływają, wspinają się albo ryją w ziemi; akcji **Hide** (ukrycie) i **Search** (szukanie) w menu; a gdy ktoś odrywa się od przeciwnika – pauzy, w której przeciwnik decyduje, czy uderzyć. To, z których z tych możliwości korzysta walka, zależy od zestawu. Przelatywanie nad przeszkodami, przeciskanie się przez ciasne przejścia, wierzchowce i ciągnięcie trzymanej postaci to osobne przyszłe prace.

<a id="games-that-use-a-ruleset"></a>

### Gry z zestawem zasad

Jeżeli gra korzysta z zestawu zasad (zobacz [Arkusz zestawu zasad](party-and-npcs.md#the-ruleset-sheet)), a zestaw pozwala bitwom odczytywać arkusz, każdy członek drużyny zaczyna walkę z tą pulą zasobu i tymi komórkami zaklęć, które zestaw przygotował na bitwy, w takim stanie, w jakim ma je teraz w arkuszu. Zdolności wybrane z katalogów zestawu stają się umiejętnościami, gdy walka aplikacji Marinara Engine potrafi ich użyć: pomijany jest wpis, który opisuje tylko coś poza walką, reakcja oraz zdolność, której kosztu bitwa nie umie pobrać. Punkty życia są przenoszone jako część maksimum, a nie jako liczba z arkusza: postać, która ma w arkuszu połowę zdrowia, zaczyna walkę z połową paska zdrowia, jaki daje jej ekran bitwy, bo liczby w bitwie należą do aplikacji Marinara Engine. Arkusz z 9 punktami zdrowia nie trafia do walki, w której jeden cios zadaje 12. Po walce utracone lub odzyskane zdrowie wraca do arkusza w ten sam sposób, a wydane komórki i zasoby zapisują się bez zmian. Reszta bitwy działa jak dotąd: matematyka rzutów z tej strony nadal należy do aplikacji Marinara Engine, a rzuty ataku, rzuty obronne i koncentracja z systemu stołowego nie są stosowane. Walka opuszczona przez usunięcie wiadomości, w której się zaczęła, niczego nie zapisuje z powrotem, bo się nie wydarzyła. Zestaw, który nic nie mówi o bitwach, pozostawia walkę dokładnie taką, jak opisano ją tutaj.

## Menu akcji

W swojej turze wybierasz z menu jedną akcję. Do dyspozycji jest sześć:

- **Attack**: zwykły atak wymierzony w jednego przeciwnika.
- **Skills**: użycie zdolności specjalnej. Umiejętności mogą kosztować MP. Jedne leczą sojusznika, inne ranią wroga, a jeszcze inne nakładają wzmocnienie albo osłabienie.
- **Special**: wpisanie dowolnej akcji własnymi słowami i kliknięcie przycisku **Ask GM**. Na przykład: "I kick sand into the Ruin Guard's cracked lens." O wyniku decyduje GM.
- **Defend**: podniesienie Defense do końca rundy, żeby otrzymywać mniejsze obrażenia.
- **Items**: użycie przedmiotu z torby. Opcja **Full inventory** (pełny ekwipunek) otwiera stąd pełną listę przedmiotów. W grze z zestawem zasad przedmioty zestawu działają tak, jak mówi zestaw: ile leczą albo ranią i jakie stany nakładają. Przedmiot z ładunkami jest oferowany, dopóki zostało mu użycie, a przedmiot, który najpierw wymaga testu, ma ten test rzucany przy użyciu: po porażce zostaje zużyty na nic. Przedmiot, któremu zestaw nie daje żadnego zastosowania, nie jest oferowany. Pozostałe przedmioty działają tak, jak ocenił Game Master na początku walki, chyba że zestaw wyłącza własne przedmioty trybu Game Mode.
- **Flee**: natychmiastowa ucieczka. Ucieczka od razu kończy walkę.

Po wyborze rozgrywa się cała runda. Wyniki widać jako unoszące się liczby obrażeń, zmieniające się paski zdrowia i wpisy w dzienniku walki.

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

- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Starcia bojowe (Roleplay)](../roleplay/combat-encounters.md)
