# Game Mode: mapa, czas i pogoda

Z tego przewodnika dowiesz się, jak działa panel mapy w trybie Game Mode i systemy, które śledzą świat wokół drużyny. Chodzi o dzień i godzinę, pogodę oraz morale drużyny. Znajdziesz tu opis widoków mapy, sposobów poruszania się i przybliżania oraz ręcznego ustawiania dnia i godziny.

## Panel mapy

Game Mode pokazuje na ekranie gry niewielki panel mapy. Panel podaje nazwę bieżącej mapy, dzień gry i ikonę nieba oznaczającą porę dnia.

Na komputerze mapa jest wbudowanym panelem, który widać od razu. Panel da się przeciągać i zablokować w wybranym miejscu. Zasady działania przeciąganych paneli opisuje przewodnik o widgetach HUD, do którego link znajdziesz niżej.

Na telefonie dotknij **Map** (Mapa), żeby otworzyć panel mapy. Jego przycisk zaczyna w pobliżu lewego górnego rogu i można go przeciągać po czacie. Użyj przycisku **Lock window** (Zablokuj okno) w panelu, żeby przycisk mapy pozostał na miejscu; **Close** (Zamknij) przywraca ten przycisk. Położenie zapisuje się razem z czatem. Mapa na telefonie korzysta ze stylu widgetów czatu z **Settings → Appearance → App** (Ustawienia, Wygląd, aplikacja), a jej przycisk pozostaje osobno, poza menu **Chat tools** (narzędzia czatu) z trzema kropkami.

<a id="the-overworld"></a>

## Mapa świata

Gra z wygenerowanym światem (zobacz [Tworzenie świata](getting-started.md#making-a-world)) otwiera się na **mapie świata** (overworld): ziemi świata narysowanej jako mapa pikselowa za narracją, z lasami, wzgórzami, wybrzeżami i morzami, drogami i duktami między osadami, każdą osadą narysowaną według jej wielkości oraz twoją drużyną. Na mapie są podpisane większe miejsca, a także to, w którym jesteś. Przeciągnij mapę, żeby się rozejrzeć.

Dotknij albo kliknij osadę albo wybierz ją z listy **Places** (miejsca; najbliższe są na początku, z czasem drogi), żeby zobaczyć jej wielkość i podróż z miejsca, w którym jesteś: ile dni albo godzin zajmuje droga i którędy prowadzi. **Walk there** (przejście tam) wysyła drużynę do niej drogami świata, najszybszą trasą, a dni marszu od razu mijają na zegarze. Od tej chwili drużyna jest na miejscu, a **twoja następna tura informuje postać Game Master**, dokąd drużyna przeszła, ile to trwało i którędy, żeby GM mógł opisać przybycie. Razem z tym mijają własne dni świata, tak jak wtedy, gdy Game Master mówi, że upływa czas. Drugi marsz przed twoją następną turą zaczyna się tam, gdzie skończył się pierwszy.

Jaskinie, kopalnie, krypty i ruiny kilka kroków za osadą są rysowane na mapie świata jako **lokacje**: nowy świat ma jedną albo dwie w każdym regionie, nazwane od sąsiedniej osady ("Hollin Caves", "Ashby Ruins"), a twórca świata może dodać kolejne, z taką nazwą albo z mapą przygotowaną specjalnie dla nich. Świat utworzony, zanim pojawiły się lokacje, zachowuje swoje miejsca bez zmian. **Walk there** prowadzi do lokacji tak jak do osady: drogami świata do jej osady, a potem pieszo poza drogą. W lokacji jej karta oferuje **Enter** (wejście), które otwiera mapę lokacji (zobacz [Lochy, jaskinie i stacje](#dungeons-caves-and-stations)); wyjście z niej przenosi drużynę z powrotem na mapę świata, do lokacji. Lokacja ważna dla fabuły gry pozostaje **zamknięta** (narysowana wyblakłymi kolorami, bez podróży do niej i bez wejścia), dopóki Game Master nie otworzy jej, gdy opowieść do niej dotrze; twórca świata może też do tego czasu ukryć lokację na mapie albo udostępnić ją od początku.

Zrujnowane miejsce jest rysowane jako ruina. Po zmroku mapa ciemnieje, a w oknach osad zapalają się światła. Każda rodzina stylistyczna settingu ma własne kafelki: fantasy, wuxia, współczesność, lata dwudzieste XX wieku, science fiction i pustkowia mają własne kolory i budynki. Zestaw settingu bez rodziny rysuje zwykłe kafelki.

Mapa świata to widok, a widok sceny (tła gry i grafika postaci) jest o jedno przełączenie dalej: **Show the scene** (pokazanie sceny) w **Game controls** (Kontrolki gry; na telefonie w menu **Chat tools** z trzema kropkami) oraz **Show the overworld** (pokazanie mapy świata), żeby wrócić. Gra pamięta, który widok wybrano. Walka i odtwarzanie sesji korzystają z własnych ekranów.

### Pakiety kafelków

Mapa świata i miasta są rysowane z **pakietów kafelków**: palety i każdego kafelka (każdego rodzaju gruntu, osad według wielkości, drużyny oraz ulic, dachów i mieszkańców miasta) zapisanego jako rzędy pikseli. Każda rodzina stylistyczna settingu ma własny wbudowany pakiet. Otwórz panel **Agents** (Agenci) i znajdź **Tile packs** (pakiety kafelków), żeby:

- wybrać, którym pakietem rysowany jest każdy setting (**Built in** (wbudowany) to jego własny pakiet);
- zaimportować pakiet przyciskiem **Import a tile pack** (import pakietu kafelków) z pliku `.tilepack.json`, który ktoś udostępnił;
- wyeksportować pakiet przyciskiem **Export** (eksport), żeby go udostępnić, albo usunąć go przyciskiem **Remove** (usunięcie), co przywraca każdemu settingowi rysowanemu tym pakietem jego własne kafelki.

Pakiet potrzebuje tylko tych kafelków, które zmienia: wszystko, czego nie zawiera, jest rysowane w zwykły sposób. Pakiet, który podaje kafelek nierysowany przez aplikację Marinara Engine, zachowuje resztę i informuje, co pominął.

<a id="the-town"></a>

### Miasto

Gdy drużyna jest w osadzie, wybierz ją na mapie świata i kliknij **Enter**, żeby zobaczyć miasto. Jego układ wynika ze świata: ulice i plac, miejsca, które ma w nim świat albo opowieść (podpisane na budynkach), ratusz w większej miejscowości, warsztaty rzemiosł, z których miasto słynie, oraz domy. Mieszkańcy są tam, gdzie o tej godzinie powinni być: w pracy za dnia, na placu o zmierzchu, w domu nocą.

Miasto można też **ułożyć ręcznie** w edytorze takim jak Pixelforge, w ramach ręcznych zmian świata: przenieść budynki na inne działki (budynek przeniesiony na działkę innego zamienia się z nim miejscami, a każdy budynek nadal stoi frontem do ulicy) i pomalować grunt ulicami, brukiem, otwartym terenem, drzewami albo studnią (nigdy pod budynkiem ani przed jego drzwiami, na środku placu ani pod straganem). To, kto gdzie mieszka i pracuje, nigdy się nie zmienia, a czas dojścia do przeniesionego budynku liczy się od jego nowych drzwi. Edytor odrzuca układ, który nie pasuje do miasta, i podaje powód; miejsca dodane przez opowieść w trakcie gry nadal znajdują działkę. Układ może też stawiać budynki poza działkami, malować pola, polne drogi, wodę z mostami i żywopłoty oraz rozmieszczać ozdoby w mieście; widok miasta rysuje je wszystkie (ozdoby tylko z pakietem obrazów, który je zawiera).

Wybierz budynek albo plac albo wybierz miejsce z listy **Places in town** (miejsca w mieście), żeby zobaczyć, kto tam teraz jest i ile minut zajmie dojście. **Walk there** prowadzi drużynę przez miasto ulicami, wokół budynków (oraz wokół drzew, studni, wody i żywopłotów namalowanych w ręcznym układzie, przez jego mosty): minuty drogi mijają na zegarze, a **twoja następna tura informuje postać Game Master**, dokąd poszła drużyna i kto tam jest. Wizyta w nazwanym miejscu, na przykład w gospodzie dodanej przez opowieść, sprawia, że drużyna jest właśnie w tym miejscu. **Leave town** (opuszczenie miasta) wraca na mapę świata. Gra pamięta, w którym widoku jesteś.

<a id="dungeons-caves-and-stations"></a>

### Lochy, jaskinie i stacje

W grze Overworld RPG (zobacz [Classic czy Overworld RPG](getting-started.md#classic-or-overworld-rpg)), gdy opowieść schodzi pod ziemię albo na pokład, Game Master może otworzyć **mapę miejsca**: loch, jaskinię albo stację, narysowaną nad sceną. Każda jest układana na podstawie gry i nazwy miejsca, więc to samo miejsce ma zawsze te same pomieszczenia, a powrót do miejsca, w którym drużyna już jest, zachowuje mapę taką, jaka była. Game Master wybiera też jej wygląd spośród jedenastu: jaskinie skalne, lodowe, kryształowe i lawowe; krypta, kanały i świątynia; a także korytarze stacji, laboratorium, pokład maszynowni i hydroponika. Gdy w bibliotece pakietów kafelków jest pakiet do tego wyglądu, mapa jest rysowana z jego grafiką; bez niego – zwykłymi kolorami.

Miejsce w mieście, do którego drużyna może zejść (jaskinia, kopalnia, krypta, kanały albo ruina, sądząc po nazwie; w settingu science fiction wrak albo bunkier), ma przycisk **Go down** (zejście w dół), gdy drużyna tam jest. Otwiera on mapę tego miejsca w ten sam sposób, za każdym razem tę samą, a wyjście z niej przenosi drużynę z powrotem do miasta, tam, gdzie zeszła. Gdy drużyna jest na innej mapie, najpierw ją opuść. Miejsce może też mieć mapę **przygotowaną ręcznie** w edytorze takim jak Pixelforge: wtedy Go down otwiera tę mapę, niezależnie od nazwy miejsca, rysowaną pakietem, który wskazuje. Na takiej mapie wyjście jest tam, gdzie drużyna weszła, jej rekwizyty nigdy nie zagradzają drogi, a ludzie stoją w nazwanych punktach o godzinach, które podaje mapa; Game Master dowiaduje się, kto tam jest.

Kliknij miejsce na mapie albo użyj klawiszy strzałek, żeby przejść tam najkrótszą drogą. Minuty mijają na zegarze (mniej więcej minuta na każde trzydzieści kroków), a **twoja następna tura informuje postać Game Master**, z którego obszaru do którego przeszła drużyna. Etykieta u góry podaje, w którym obszarze jest drużyna. **Show the scene** i **Show the map** (pokazanie mapy) w **Game controls** przełączają między mapą a sceną; gra pamięta, w którym widoku jesteś.

Aby wyjść, wróć do wyjścia (schodów, drabiny albo włazu, zależnie od wyglądu miejsca) i wybierz **Leave** (wyjście). Game Master może też zamknąć mapę, gdy opowieść opuszcza to miejsce. Ponowne wygenerowanie tury, w której otwarto mapę, przechodzono po niej albo ją opuszczono, przywraca mapę do stanu sprzed tej tury. Gry bez mapy działają jak dotąd.

## Widok siatki i widok węzłów

Mapa ma dwa widoki. Marinara Engine sama dobiera widok do rodzaju miejsca, które mapa przedstawia. Widoków nie przełącza się ręcznie.

- Widok **grid** (siatka) obsługuje otwarte przestrzenie: świat zewnętrzny, region albo miasto. Pokazuje kwadraty pokolorowane według terenu, na przykład trawa, las, woda, góry, pustynia, śnieg, miasteczko, droga i jaskinia.
- Widok **node** (węzły) obsługuje zamknięte przestrzenie, czyli lochy i wnętrza. Pokazuje lokalizacje jako kółka połączone liniami. Lokalizacja jeszcze nieodkryta ma ikonę znaku zapytania. Linia przerywana to ścieżka, którą nikt jeszcze nie przeszedł. Linia ciągła to ścieżka już przebyta.

## Poruszanie drużyną

Żeby ruszyć w drogę, wskaż miejsce na mapie. Wybrać można tylko niektóre miejsca. Na mapie siatki kwadrat musi sąsiadować z drużyną i być już odkryty. Na mapie węzłów węzeł musi łączyć się z bieżącą lokalizacją albo być już odkryty. Pozostałe kwadraty i węzły nie reagują na kliknięcie.

1. Kliknij kwadrat siatki albo węzeł na mapie węzłów.
2. Nad polem wiadomości pojawia się kafelek **Destination:** (cel podróży) z nazwą miejsca.
3. Wpisz wiadomość i wyślij ją. Marinara dopisuje na jej początku krótką linijkę w rodzaju `*moves to <place>*`.

Żeby zrezygnować, kliknij mały przycisk czyszczenia (X) na kafelku **Destination:**.

Na telefonie wygląda to nieco inaczej. Dotknij węzła raz, żeby go zaznaczyć, a potem dotknij przycisku **Set destination** (ustawienie celu) na dole. Węzeł oznaczony jako **You are here** to bieżąca lokalizacja.

## Przybliżanie mapy

Każda mapa ma w prawym górnym rogu sterowanie powiększeniem.

- Kliknij przycisk **Zoom in** (plus), żeby przybliżyć obraz.
- Kliknij przycisk **Zoom out** (minus), żeby zobaczyć więcej.

Powiększenie mieści się w zakresie od 75% do 180%, ze skokiem co 25%.

## Przełączanie map

Niektóre gry mają więcej niż jedną mapę albo region. Kiedy map jest kilka, u góry panelu mapy pojawia się mała lista rozwijana. Wybierz z niej mapę, którą chcesz obejrzeć. Mapa, na której faktycznie stoi drużyna, ma dopisek **(Current)**.

## Generowanie nowej mapy

W lewym górnym rogu panelu mapy jest przycisk z różdżką o nazwie **Generate another map** (wygenerowanie kolejnej mapy). Kliknij go, żeby zastąpić bieżącą mapę zupełnie nową.

Jeśli gra nie ma jeszcze żadnej mapy, panel pokazuje napis **No map yet** oraz przycisk **Generate**, który robi dokładnie to samo.

## Ręczne ustawianie dnia i godziny

Sterowanie dniem i godziną znajduje się u góry panelu mapy. Widać tam napis **Day** wraz z liczbą oraz małą ikonę nieba oznaczającą porę dnia.

1. Kliknij pole **Day** (dzień).
2. Wpisz w polu nowy numer dnia. Dozwolony zakres to od 1 do 9999.
3. Wybierz porę dnia z listy rozwijanej. Do wyboru są **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** i **Midnight**.
4. Kliknij poza polem albo naciśnij Enter, żeby zapisać.

To ustawienie ręczne, które ma pierwszeństwo. Dzień i godzinę ustawiasz samodzielnie, niezależnie od automatycznego zegara opisanego niżej. Zegar potrafi też sam pokazać **Noon**, ale tej pory nie ma na liście do ręcznego wyboru.

## Jak czas płynie automatycznie

Zegar gry chodzi sam. Opiera się na sztywnych obliczeniach, a nie na AI, więc zawsze jest spójny. Każda nowa gra zaczyna się w dniu 1 o godzinie 08:00 rano. Każde działanie przesuwa zegar o ustaloną wartość.

| Działanie | Doliczany czas |
|---|---|
| Rozmowa | 15 minut |
| Eksploracja | 30 minut |
| Runda walki | 5 minut |
| Krótki odpoczynek | 1 godzina |
| Długi odpoczynek | 8 godzin |
| Podróż | 2 godziny |

Kiedy zegar minie północ, numer dnia rośnie o jeden.

W grze ze światem czas płynie też sam:

- Gdy na pierwszym planie jest mapa świata, a gra czeka na ciebie, co pięć sekund rzeczywistych mija minuta gry. Zegar staje, gdy Game Master pisze, zanim przeczytasz jego odpowiedź, gdy na pierwszym planie jest widok sceny i gdy aplikacja działa w tle.
- Marsz po mapie świata trwa tyle dni, ile wymaga jego trasa.
- Gdy Game Master mówi, że mijają dni (podróż, długi odpoczynek, oczekiwanie), zegar też przesuwa się o te dni. Ponownie wygenerowana odpowiedź nie przesuwa go drugi raz; jeśli nowa wersja opowieści zajmuje inny czas, ustaw dzień ręcznie.

## Pogoda

Pogodę gra również prowadzi sama, na sztywnych obliczeniach i bez udziału AI. Pogoda zależy od biomu i pory roku. Biom to rodzaj miejsca, w którym przebywa drużyna, na przykład pustynia, arktyka, wybrzeże albo góry. Pogoda bywa bezchmurna albo pochmurna, może pojawić się deszcz, burza, śnieg, zamieć, mgła i burza piaskowa.

Pogoda potrafi zmienić się po twoim działaniu. Najczęściej zmienia się podczas podróży i długiego odpoczynku, czasem przy eksploracji, a poza tym rzadko. Nadaje ona koloryt opisom scen tworzonym przez postać Game Master.

Żeby zobaczyć pogodę na ekranie, włącz ustawienie **Dynamic weather effects (rain, snow, fog, etc.)** w ustawieniach wyglądu aplikacji. Domyślnie jest włączone. Po włączeniu nad grą pojawiają się animowane cząsteczki deszczu, śniegu czy mgły. Pasują one do bieżącej pogody i pory dnia. Więcej opcji wyświetlania opisuje przewodnik po ustawieniach wyglądu, do którego link znajdziesz niżej.

## Morale drużyny

Gra prowadzi ukryty wskaźnik morale drużyny w skali od 0 do 100. Ma on pięć poziomów, od najniższego do najwyższego: Broken, Low, Steady, High i Inspired.

Morale zmienia się wraz z wydarzeniami w historii. Wygrana walka, ukończone zadanie albo znaleziony skarb je podnoszą. Przegrana walka, nieudane zadanie albo utrata sojusznika je obniżają. Z czasem morale samo wraca w okolice środka skali.

Gra nie pokazuje morale jako liczby. Wskaźnik działa w tle. Wpływa na rzuty kością, od plus 2 przy poziomie Inspired do minus 2 przy poziomie Broken. Zabarwia też opisy nastroju drużyny tworzone przez postać Game Master.

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: widgety HUD](hud-widgets.md)
- [Ustawienia wyglądu](../appearance/appearance-settings.md)
