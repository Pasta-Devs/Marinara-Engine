# Game Mode: mapa, czas i pogoda

Panel mapy pokazuje, gdzie jest twoja drużyna, i pozwala ją przemieszczać. Ten przewodnik opisuje też systemy, które śledzą świat wokół drużyny: dzień i godzinę, pogodę oraz morale drużyny.

## Panel mapy

Game Mode pokazuje na ekranie gry panel mapy. Panel podaje nazwę bieżącej mapy, dzień gry i ikonę nieba oznaczającą porę dnia.

- **Na komputerze** mapa jest wbudowanym panelem, który widać od razu. Panel da się przeciągać i zablokować w wybranym miejscu. Zasady działania przeciąganych paneli opisuje przewodnik [Game Mode: widgety HUD](hud-widgets.md).
- **Na telefonie** dotknij **Map** (Mapa), żeby otworzyć panel. Jego przycisk zaczyna w pobliżu lewego górnego rogu i można go przeciągać po czacie. Użyj **Lock window** (Zablokuj okno), żeby przycisk pozostał na miejscu, a **Close** (Zamknij), żeby do niego wrócić. Położenie zapisuje się razem z czatem. Mapa na telefonie korzysta ze stylu widgetów czatu z **Settings → Appearance → App** (ustawienia, wygląd, aplikacja), a jej przycisk pozostaje osobno, poza menu **Chat tools** (narzędzia czatu) z trzema kropkami.

Zwykła gra Classic ma opisaną tu mapę sceny. Mapa świata, miasta i mapy lochów należą do gier Overworld RPG, które nie są jeszcze dostępne (zobacz [Classic czy Overworld RPG](getting-started.md#classic-or-overworld-rpg)).

### Widok siatki i widok węzłów

Marinara sama dobiera widok do rodzaju miejsca, które pokazuje mapa. Widoków nie przełącza się ręcznie.

- Widok **grid** (siatka) służy do otwartych przestrzeni, takich jak region albo miasto. Pokazuje kwadraty pokolorowane według terenu: trawa, las, woda, góry, pustynia, śnieg, miasteczko, droga i jaskinia.
- Widok **node** (węzły) służy do zamkniętych przestrzeni, takich jak lochy i wnętrza. Pokazuje lokalizacje jako kółka połączone liniami. Nieodkryta lokalizacja ma znak zapytania. Linia przerywana to ścieżka jeszcze nieprzebyta, a linia ciągła to ścieżka już przebyta.

## Poruszanie drużyną

Wybrać można tylko niektóre miejsca. Na mapie siatki kwadrat musi sąsiadować z drużyną i być już odkryty. Na mapie węzłów węzeł musi łączyć się z bieżącą lokalizacją albo być już odkryty. Pozostałe kwadraty i węzły nie reagują na kliknięcie.

1. Kliknij kwadrat siatki albo węzeł na mapie węzłów.
2. Nad polem wiadomości pojawia się kafelek **Map position:** (pozycja na mapie) z nazwą miejsca.
3. Wpisz wiadomość i wyślij ją. Marinara dopisuje na jej początku krótką linijkę w rodzaju `*moves to <place>*`.

Żeby zrezygnować, kliknij przycisk czyszczenia (X) na kafelku **Map position:**. Jego podpowiedź brzmi **Clear destination** (wyczyszczenie celu).

Na telefonie dotknij węzła raz, żeby go zaznaczyć, a potem dotknij **Set destination** (ustawienie celu) na dole. Węzeł oznaczony jako **You are here** to twoja bieżąca lokalizacja.

Jeśli to nie zadziałało, sprawdź, czy kwadrat sąsiaduje z drużyną i jest odkryty albo czy węzeł łączy się z miejscem, w którym jesteś.

### Przybliżanie, przełączanie i generowanie map

- **Przybliżanie.** Użyj przycisków **Zoom in** (plus) i **Zoom out** (minus) w prawym górnym rogu. Powiększenie mieści się w zakresie od 75% do 180%, ze skokiem co 25%.
- **Przełączanie map.** Gdy gra ma więcej niż jedną mapę albo region, lista rozwijana u góry panelu pozwala obejrzeć inną. Mapa, na której jesteś, ma dopisek **(Current)**.
- **Generowanie mapy.** Kliknij przycisk z różdżką **Generate another map** (wygenerowanie kolejnej mapy) w lewym górnym rogu, żeby zastąpić bieżącą mapę nową. Gra bez mapy pokazuje napis **No map yet** i przycisk **Generate**, który robi to samo.

## Ręczne ustawianie dnia i godziny

Sterowanie dniem i godziną znajduje się u góry panelu mapy. Widać tam napis **Day** z liczbą oraz ikonę nieba.

1. Kliknij pole **Day** (dzień).
2. Wpisz numer dnia od 1 do 9999.
3. Wybierz porę dnia: **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** albo **Midnight**.
4. Kliknij poza polem albo naciśnij <kbd>Enter</kbd>, żeby zapisać.

To ustawienie ręczne, niezależne od automatycznego zegara. Zegar potrafi też sam pokazać **Noon**, ale tej pory nie da się wybrać ręcznie.

## Jak płynie czas

Zegar gry opiera się na sztywnych obliczeniach, a nie na AI. Każda nowa gra zaczyna się w dniu 1 o godzinie 08:00. Każde działanie przesuwa zegar do przodu:

| Działanie | Doliczany czas |
| --- | --- |
| Rozmowa | 15 minut |
| Eksploracja | 30 minut |
| Runda walki | 5 minut |
| Krótki odpoczynek | 1 godzina |
| Długi odpoczynek | 8 godzin |
| Podróż | 2 godziny |

Kiedy zegar minie północ, numer dnia rośnie o jeden.

W grze ze światem czas płynie też sam:

- Gdy na pierwszym planie jest mapa świata, a gra czeka na ciebie, co pięć sekund rzeczywistych mija minuta gry. Zegar staje, gdy GM pisze, zanim przeczytasz jego odpowiedź, gdy na pierwszym planie jest widok sceny i gdy aplikacja działa w tle.
- Podczas marszu po mapie świata mija tyle dni, ile zajmuje jego trasa.
- Gdy Game Master (GM, mistrz gry) mówi, że mijają dni (podróż, długi odpoczynek, oczekiwanie), zegar przesuwa się o te dni. Ponownie wygenerowana odpowiedź nie przesuwa go drugi raz. Jeśli nowa wersja opowieści zajmuje inny czas, ustaw dzień ręcznie.

## Pogoda

Gra prowadzi pogodę na sztywnych obliczeniach, a nie przez AI. Pogoda zależy od biomu (rodzaju miejsca, w którym przebywa drużyna, na przykład pustyni, arktyki, wybrzeża albo gór) i pory roku. Przykłady to bezchmurne niebo, zachmurzenie, deszcz, burza, śnieg, zamieć, mgła i burza piaskowa. Pogoda zmienia się najczęściej podczas podróży i długiego odpoczynku, czasem przy eksploracji, a poza tym rzadko. Nadaje koloryt opisom scen tworzonym przez GM.

Żeby zobaczyć pogodę na ekranie, włącz w ustawieniach wyglądu przełącznik **Dynamic weather effects (rain, snow, fog, etc.)**. Domyślnie jest włączony. Nad grą pojawiają się wtedy cząsteczki deszczu, śniegu i mgły, dopasowane do pogody i pory dnia. Zobacz [Ustawienia wyglądu](../appearance/appearance-settings.md).

## Morale drużyny

Gra prowadzi ukryty wskaźnik morale drużyny w skali od 0 do 100. Ma on pięć poziomów, od najniższego do najwyższego: Broken, Low, Steady, High i Inspired.

Morale rośnie, gdy drużyna wygrywa walkę, kończy zadanie albo znajduje skarb. Spada, gdy drużyna przegrywa walkę, nie wykonuje zadania albo traci sojusznika. Z czasem morale wraca w okolice środka skali. Gra nie pokazuje go jako liczby. Morale zabarwia opisy nastroju drużyny tworzone przez GM. Nie zmienia twoich rzutów kośćmi.

## Mapa świata i inne mapy Overworld RPG

Poniższe sekcje opisują gry **Overworld RPG**, które nie są jeszcze dostępne. Dotyczą tylko sytuacji, w której na twoim serwerze włączono tę funkcję.

<a id="the-overworld"></a>

### Mapa świata

Gra z wygenerowanym światem (zobacz [Tworzenie świata](getting-started.md#making-a-world)) otwiera się na **mapie świata** (overworld): ziemi świata narysowanej jako mapa pikselowa za narracją, z lasami, wzgórzami, wybrzeżami i morzami, drogami i duktami między osadami, każdą osadą narysowaną według jej wielkości oraz twoją drużyną. Podpisane są większe miejsca, a także to, w którym jesteś. Przeciągnij mapę, żeby się rozejrzeć.

1. Dotknij albo kliknij osadę albo wybierz ją z listy **Places** (miejsca; najbliższe są na początku, z czasem drogi).
2. Sprawdź jej wielkość i podróż z miejsca, w którym jesteś: ile dni albo godzin zajmuje i którędy prowadzi.
3. Kliknij **Walk there** (przejście tam). Drużyna idzie drogami świata najszybszą trasą, a dni marszu od razu mijają na zegarze.

Twoja następna tura informuje GM, dokąd drużyna przeszła, ile to trwało i którędy, żeby GM mógł opisać przybycie. Drugi marsz przed twoją następną turą zaczyna się tam, gdzie skończył się pierwszy.

Jaskinie, kopalnie, krypty i ruiny kilka kroków za osadą są rysowane jako **lokacje**. Nowy świat ma jedną albo dwie w każdym regionie, nazwane od sąsiedniej osady ("Hollin Caves", "Ashby Ruins"). **Walk there** prowadzi drogami do jej osady, a potem pieszo poza drogą. W lokacji przycisk **Enter** (wejście) otwiera jej mapę (zobacz [Lochy, jaskinie i stacje](#dungeons-caves-and-stations)). Lokacja ważna dla fabuły pozostaje **zamknięta** (wyblakła, bez podróży i bez wejścia), dopóki GM jej nie otworzy. Twórca świata może też do tego czasu ukryć lokację albo udostępnić ją od początku.

Zrujnowane miejsce jest rysowane jako ruina. Po zmroku mapa ciemnieje, a w oknach zapalają się światła. Każda rodzina stylistyczna settingu (fantasy, wuxia, współczesność, lata dwudzieste XX wieku, science fiction, pustkowia) ma własne kafelki. Zestaw settingu bez rodziny rysuje zwykłe kafelki.

Do przełączania widoków służą **Show the scene** (pokazanie sceny) i **Show the overworld** (pokazanie mapy świata) w **Game controls** (Kontrolki gry; na telefonie w menu **Chat tools** z trzema kropkami). Gra pamięta twój wybór. Walka i odtwarzanie sesji korzystają z własnych ekranów.

### Pakiety kafelków

Pakiety kafelków zawierają paletę i każdy kafelek (każdy rodzaj gruntu, osady według wielkości, drużynę oraz ulice, dachy i mieszkańców miasta) zapisany jako rzędy pikseli. Każda rodzina stylistyczna settingu ma wbudowany pakiet. Otwórz panel **Agents** (Agenci) i znajdź **Tile packs** (pakiety kafelków), żeby:

- wybrać, którym pakietem rysowany jest każdy setting (**Built in** (wbudowany) to jego własny pakiet),
- zaimportować pakiet przyciskiem **Import a tile pack** (import pakietu kafelków) z pliku `.tilepack.json`,
- wyeksportować pakiet przyciskiem **Export** (eksport), żeby go udostępnić, albo usunąć go przyciskiem **Remove** (usunięcie), co przywraca każdemu settingowi rysowanemu tym pakietem jego własne kafelki.

Pakiet potrzebuje tylko tych kafelków, które zmienia, a wszystko, czego nie zawiera, jest rysowane w zwykły sposób. Pakiet, który podaje kafelek nierysowany przez aplikację Marinara Engine, zachowuje resztę i informuje, co pominął.

<a id="the-town"></a>

### Miasto

Gdy drużyna jest w osadzie, wybierz ją na mapie świata i kliknij **Enter**, żeby zobaczyć miasto. Jego układ wynika ze świata: ulice i plac, miejsca, które ma w nim świat albo opowieść (podpisane na budynkach), ratusz w większej miejscowości, warsztaty rzemiosł, z których miejscowość słynie, oraz domy. Mieszkańcy są tam, gdzie o tej godzinie powinni być: w pracy za dnia, na placu o zmierzchu, w domu nocą.

Wybierz budynek albo plac albo wybierz miejsce z listy **Places in town** (miejsca w mieście), żeby zobaczyć, kto tam jest i ile minut zajmie dojście. **Walk there** prowadzi drużynę przez miasto ulicami, wokół budynków i wszystkiego, co namalowano w ręcznym układzie, przez jego mosty. Minuty mijają na zegarze, a twoja następna tura informuje GM, dokąd poszła drużyna i kto tam jest. Wizyta w nazwanym miejscu, na przykład w gospodzie dodanej przez opowieść, sprawia, że staje się ono bieżącym miejscem drużyny. **Leave town** (opuszczenie miasta) wraca na mapę świata. Gra pamięta, w którym widoku jesteś.

Miasto można **ułożyć ręcznie** w edytorze świata takim jak Pixelforge, w ramach ręcznych zmian świata.

- Budynki można przenosić na inne działki. Budynek przeniesiony na działkę innego zamienia się z nim miejscami, a każdy budynek nadal stoi frontem do ulicy.
- Grunt można pomalować ulicami, brukiem, otwartym terenem, drzewami albo studnią, ale nigdy pod budynkiem, przed jego drzwiami, na środku placu ani pod straganem.
- To, kto gdzie mieszka i pracuje, nigdy się nie zmienia, a czas dojścia do przeniesionego budynku liczy się od jego nowych drzwi.
- Edytor odrzuca układ, który nie pasuje do miasta, i podaje powód. Miejsca dodane przez opowieść w trakcie gry nadal znajdują działkę.
- Układ może też stawiać budynki poza działkami, malować pola, polne drogi, wodę z mostami i żywopłoty oraz rozmieszczać ozdoby. Widok miasta rysuje je wszystkie (ozdoby tylko z pakietem obrazów, który je zawiera).

<a id="dungeons-caves-and-stations"></a>

### Lochy, jaskinie i stacje

Gdy opowieść schodzi pod ziemię albo na pokład, GM może otworzyć **mapę miejsca**: loch, jaskinię albo stację, narysowaną nad sceną. Jej układ wynika z gry i nazwy miejsca, więc to samo miejsce ma zawsze te same pomieszczenia, a powrót zachowuje mapę taką, jaka była. GM wybiera wygląd spośród jedenastu: jaskinie skalne, lodowe, kryształowe i lawowe; krypta, kanały i świątynia; a także korytarze stacji, laboratorium, pokład maszynowni i hydroponika. Z pakietem kafelków do tego wyglądu mapa korzysta z jego grafiki. Bez niego jest rysowana zwykłymi kolorami.

Miejsce w mieście, do którego drużyna może zejść (jaskinia, kopalnia, krypta, kanały albo ruina, sądząc po nazwie, a w science fiction wrak albo bunkier), pokazuje przycisk **Go down** (zejście w dół), gdy drużyna tam jest.

- Za każdym razem otwiera tę samą mapę, a wyjście z niej przenosi drużynę z powrotem do miasta.
- Gdy drużyna jest na innej mapie, najpierw ją opuść.
- Miejsce może też mieć mapę przygotowaną ręcznie w edytorze świata takim jak Pixelforge. **Go down** otwiera wtedy tę mapę, niezależnie od nazwy miejsca, rysowaną pakietem, który wskazuje. Na takiej mapie wyjście jest tam, gdzie drużyna weszła, rekwizyty nigdy nie zagradzają drogi, a ludzie stoją w nazwanych punktach o godzinach, które podaje mapa. GM dowiaduje się, kto tam jest.

Kliknij miejsce na mapie albo użyj klawiszy strzałek, żeby przejść tam najkrótszą drogą. Minuty mijają na zegarze (mniej więcej minuta na trzydzieści kroków), a twoja następna tura informuje GM, z którego obszaru do którego przeszła drużyna. Etykieta u góry podaje bieżący obszar. **Show the scene** i **Show the map** (pokazanie mapy) w **Game controls** przełączają między sceną a mapą.

Aby wyjść, wróć do wyjścia (schodów, drabiny albo włazu) i wybierz **Leave** (wyjście). GM może też zamknąć mapę, gdy opowieść opuszcza to miejsce. Ponowne wygenerowanie tury, w której otwarto mapę, przechodzono po niej albo ją opuszczono, przywraca mapę do stanu sprzed tej tury.

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: widgety HUD](hud-widgets.md)
- [Ustawienia wyglądu](../appearance/appearance-settings.md)
