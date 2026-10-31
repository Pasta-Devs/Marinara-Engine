# Game Mode: gra z zestawem zasad

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakie kości rzuca test, co znajduje się w arkuszu postaci, jakie zasoby są wydawane, co odnawia odpoczynek, a w przypadku niektórych zestawów także jak rozgrywa się całą walkę. Ten przewodnik opisuje, jak uzyskać zestaw zasad, wybrać go dla gry i co zmienia się podczas gry z nim. Gra bez zestawu zasad korzysta z własnych zasad aplikacji Marinara Engine, opisanych w pozostałych przewodnikach po trybie Game Mode.

<a id="getting-a-ruleset"></a>

## Uzyskanie zestawu zasad

Zestawy zasad pochodzą z dwóch miejsc. Oficjalne, takie jak 5e (SRD 5.1), instaluje się z **Agent Organizer (organizowanie agentów)**, gdzie mają oznaczenie **Rules**. Zestawy społeczności importuje się z pliku albo z repozytorium GitHub autora i są zapisywane pod nazwą źródła, na przykład `local/ember-roads` albo `alice/v20`. Import korzysta z tego samego przełącznika **Allow custom Agent imports** co importowani agenci. Gdy ten przełącznik jest wyłączony, zaimportowane zestawy są pomijane w nowych grach, a gry, które już z nich korzystają, działają dalej. Gra na zaimportowanym zestawie zawsze korzysta z dokładnie tej wersji, z którą powstała. Pisanie własnego zestawu opisuje przewodnik [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md).

### Język

Tekst zestawu zasad, na przykład nazwy umiejętności, zaklęcia i tekst mistrza gry, jest w języku wybranym w **Settings** (Ustawienia). Oficjalny zestaw zasad pobiera tylko tłumaczenie na ten język, pobiera nowe po zmianie języka, a dla języka, na który go nie przetłumaczono, używa tekstu angielskiego. Zestaw zasad zaimportowany z pliku zachowuje tylko tłumaczenie na język wybrany w chwili importu; aby zmienić język, zaimportuj plik ponownie.

<a id="choosing-a-ruleset-for-a-game"></a>

## Wybór zestawu zasad dla gry

Pole **Rules** (zasady) pojawia się tylko wtedy, gdy jest zainstalowany przynajmniej jeden zestaw zasad, i tylko przy nowej grze. Jest niezależne od **Combat Preference**: jedno decyduje o działaniu testów i arkuszy postaci, drugie o tym, jak pokazywana jest walka.

- **Marinara's own rules** (własne zasady aplikacji Marinara Engine) to wartość domyślna: wbudowane testy d20 i arkusz sześciu atrybutów.
- **Zestaw zasad**, na przykład **5e (SRD 5.1)**, pokazuje krótkie podsumowanie tego, co obejmuje, oraz jedną linię o tym, jak będą przebiegać walki. Zestaw, który sam rozstrzyga walki, mówi o tym. Zestaw, który tylko udostępnia arkusz, informuje, że walki korzystają z systemu walki aplikacji Marinara Engine ze zdrowiem, energią i zdolnościami z arkusza. Zestaw, który nie robi żadnej z tych rzeczy, informuje, że walki korzystają z systemu walki aplikacji Marinara Engine, i podaje wybrane **Combat Preference**.

Zestaw zasad ustala się przy tworzeniu gry i zostaje on przy tej grze. Nie da się go później zmienić ani dodać.

Niektóre zestawy oferują **layers** (warstwy): nazwane warianty, na przykład Low magic albo Hard winter, pokazywane jako przełączniki pod zestawem, z linią opisującą działanie każdego z nich. Warstwa może zaostrzyć trudności, zawęzić wybór w arkuszu postaci, pominąć część gotowych wpisów w selektorze edytora arkusza i dać postaci Game Master dodatkowe instrukcje, także dotyczące świata budowanego przy konfiguracji. Niektóre warstwy się wykluczają, a kreator wyłącza tę, której nie można wybrać. Po rozpoczęciu gry warstwy są ustalone, dokładnie tak jak sam zestaw, a arkusz, który już używa czegoś odebranego przez warstwę, zachowuje to.

Po wybraniu zestawu krok **Party** pokazuje pod selektorami twoją personę i członków drużyny oraz informuje, kto **Has a sheet** (ma arkusz) dla tego zestawu, a kto **Starts on a blank sheet** (zaczyna z pustym arkuszem). Arkusz dodaje się w sekcji **Stats** w edytorze postaci lub persony (zobacz [Arkusze zestawów zasad](../characters/colors-and-stats.md#ruleset-sheets)). Gra kopiuje każdy arkusz przy generowaniu świata. Nic, co zmienisz w grze, nie wraca do postaci ani persony. Członek drużyny bez arkusza dostaje pusty arkusz z każdą wartością ustawioną na domyślną wartość zestawu; generowanie świata nigdy nie wymyśla wyników.

Udostępniony plik konfiguracji zapamiętuje swój zestaw zasad. Jeśli go zaimportujesz, a nie masz tego zestawu albo masz jego starszą wersję, kreator informuje, o jaki zestaw chodziło, a gra korzysta z własnych zasad aplikacji Marinara Engine, chyba że go zainstalujesz i wybierzesz.

<a id="what-happens-in-battles"></a>

## Co dzieje się podczas walk

To, co zestaw zasad robi w walce, zależy od tego, jak został napisany. Wiersz pod zestawem zasad w kreatorze konfiguracji wskazuje, który z poniższych przypadków ma zastosowanie.

| Zestaw zasad | Walki |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sam rozstrzyga walki, jak 5e (SRD 5.1) | Rozgrywane według zasad zestawu na jego własnym ekranie walki. Zobacz [Walki z zestawem zasad](fighting-on-a-ruleset.md). |
| Udostępnia swój arkusz do walk | Własny system walki aplikacji Marinara Engine, korzystający ze zdrowia, komórek zaklęć i zdolności z arkusza. Zobacz niżej. |
| Nic nie mówi o walkach | Własny system walki aplikacji Marinara Engine, dokładnie jak w grze bez zestawu zasad. Zobacz [Game Mode: walka](combat.md). |

Gdy zestaw zasad udostępnia swój arkusz do walk, każdy członek drużyny zaczyna walkę z tą pulą zasobu i tymi komórkami zaklęć, które zestaw przygotował na bitwy, w takim stanie, w jakim ma je teraz w arkuszu. Zdolności wybrane z katalogów zestawu stają się umiejętnościami, gdy walka aplikacji Marinara Engine potrafi ich użyć: pomijany jest wpis, który opisuje tylko coś poza walką, reakcja oraz zdolność, której kosztu bitwa nie umie pobrać. Punkty życia są przenoszone jako część maksimum, a nie jako liczba z arkusza: postać, która ma w arkuszu połowę zdrowia, zaczyna walkę z połową paska zdrowia, jaki daje jej ekran bitwy, bo liczby w bitwie należą do aplikacji Marinara Engine. Arkusz z 9 punktami zdrowia nie trafia do walki, w której jeden cios zadaje 12. Po walce utracone lub odzyskane zdrowie wraca do arkusza w ten sam sposób, a wydane komórki i zasoby zapisują się bez zmian. Reszta bitwy działa jak dotąd: matematyka rzutów nadal należy do aplikacji Marinara Engine (zobacz [Jak działają obliczenia w walce](combat.md#how-combat-math-works)), a rzuty ataku, rzuty obronne i koncentracja z systemu stołowego nie są stosowane. Walka opuszczona przez usunięcie wiadomości, w której się zaczęła, niczego nie zapisuje z powrotem, bo się nie wydarzyła.

<a id="checks-on-a-ruleset"></a>

## Testy z zestawem zasad

W grze z zestawem zasad mistrz gry prosi o testy tak samo jak w każdej innej grze (zobacz [Testy umiejętności](dice-and-skill-checks.md#skill-checks)), ale o sposobie ich wykonywania decyduje zestaw zasad:

- Game Master nadal tylko wskazuje umiejętność albo rzut obronny i ustala trudność. Dostaje przy tym skalę trudności zestawu zamiast wbudowanej. Trudność może sięgać tak daleko jak ta skala, nawet poza zakres od 1 do 40 dozwolony przez własne zasady aplikacji Marinara Engine. Jedna ścieżka nawet w grze z zestawem zasad zostaje przy zakresie od 1 do 40: mechanizm awaryjny, który rzuca za test wciąż zaległy w zapisanej turze.
- Silnik rzuca kośćmi zestawu i dodaje modyfikator z **arkusza zestawu zasad** postaci, złożony z tych części, które deklaruje zestaw: modyfikatora cechy, gdy umiejętność albo rzut obronny wskazuje cechę, premii za poziom wyszkolenia (wielokrotność premii biegłości, stała liczba albo jedno i drugie) oraz dodatkowej premii wpisanej w arkuszu. Wbudowane premie umiejętności i atrybuty nie są używane.
- Test może dotyczyć członka drużyny. Game Master dodaje do znacznika `who="Name"`, a silnik używa arkusza tej postaci. Bez `who` test dotyczy gracza. Członek drużyny, który nie ma jeszcze arkusza, rzuca na pustym arkuszu, z każdą wartością ustawioną na domyślną wartość zestawu. Nazwa, która nie pasuje do nikogo w drużynie albo którą nosi dwóch członków drużyny, daje rzut bez żadnego modyfikatora. Jedynym wyjątkiem jest imię twojej postaci: jeśli nosi je też członek drużyny, to imię nadal oznacza ciebie i korzysta z twojego arkusza. Silnik nigdy nie pożycza cudzego arkusza.
- Wyniki naturalne zależą od zestawu. W 5e (SRD 5.1) naturalna 20 i naturalna 1 nie mają specjalnego skutku w testach i rzutach obronnych, więc naturalna 20, która nie osiąga trudności, oznacza porażkę. To celowo różni się od własnych zasad aplikacji Marinara Engine.
- Liczby, które Game Master wpisze sam, nie są uznawane za wiarygodne. Znacznik wyglądający na gotowy zostaje rzucony ponownie i zastąpiony, gdy jego modyfikator nie jest tym z arkusza, gdy rzucono w nim inną liczbą albo innym rozmiarem kości niż w zestawie, gdy policzona kość nie jest tą, którą zachowuje tryb rzutu, albo gdy deklaruje wynik naturalny, którego zestaw nie ma.
- Kość rzucona przez ciebie przed testem jest używana tylko wtedy, gdy zestaw rzuca pojedynczą d20. Zestaw, który rzuca innymi kośćmi, na przykład 2d6 albo pulą, pomija ją i rzuca normalnie.
- Game Master może wykonać test umiejętności albo rzut obronny z inną cechą niż zwykle, dodając do znacznika `with="Ability"`. Liczy się tylko cecha zadeklarowana przez twój zestaw; każda inna jest ignorowana, a umiejętność zachowuje własną.
- Game Master może podać nazwę stopnia ze skali trudności zamiast liczby, na przykład `difficulty="Hard"`. Silnik rzuca przeciwko liczbie tego stopnia, a zapisany test pokazuje tę liczbę. Nazwa, której skala nie zawiera, jest ignorowana.
- Znaczniki rzutów mogą wskazywać cechy, umiejętności i rzuty obronne zestawu oraz `PROF` dla premii biegłości, jeśli zestaw ją ma.
- Jeśli pakietu zestawu brakuje albo jest starszy niż ten, z którym utworzono grę, testy są zapisywane bez liczb i pozostają zaległe. Nigdy nie są rzucane według zasad innego systemu.
- Jeśli coś w twoim arkuszu zmienia rzut, na przykład talizman, który pozwala ponownie rzucić kośćmi, które wypadły źle, Game Master wskazuje to przy teście, a resztą zajmuje się silnik: pobiera koszt talizmanu, stosuje jego działanie i rzuca. Talizman, którego nie wybrano, albo taki, za który nie da się zapłacić, nic nie robi i nic nie kosztuje.
- Jeśli zestaw pozwala wydać zasób, żeby poprawić rzut, Game Master zaznacza to przy samym teście, a silnik robi obie rzeczy naraz: pobiera punkty, dodaje to, co za nie kupiono, i rzuca. Jeśli zasobu nie wystarcza, nic nie zostaje wydane, a rzut jest taki, jaki byłby bez tego. Zapis pokazuje to, co naprawdę zapłacono, a nie to, o co poproszono. Ile można kupić w jednym teście, ustala zestaw: stałą liczbę, liczbę z twojego arkusza albo tyle, ile kości ma test.
- Jeśli zestaw mówi, że jakaś liczba z twojego arkusza dolicza się do określonych rzutów, na przykład ciężki plecak przy każdym rzucie na Brawn, silnik dodaje ją do każdego testu, którego dotyczy, a karta rzutu podaje, co dodał arkusz.
- Zestaw może określić, co się dzieje przy teście umiejętności, w której nie masz wyszkolenia: test może kosztować kości albo punkty, być o jeden stopień trudniejszy albo w ogóle niemożliwy. Test, którego nie da się podjąć bez wyszkolenia, nie jest rzucany, a narracja mówi o tym zamiast pokazywać wynik. Arkusz nie pokazuje żadnej liczby dla takiej umiejętności, dopóki jej nie wyszkolisz.
- Jeśli zestaw ma tor ran i mówi, że jego kara dotyczy rzutów, rany utrudniają każdy test. W zestawie z pulą kości kara odbiera tyle kości z puli, nigdy nie schodząc poniżej najmniejszej puli dozwolonej przez zestaw, którą niektóre systemy ustawiają na zero. W zestawie, który sumuje kości, jest to stała kara do rzutu. W obu przypadkach test podaje, ile zastosowano, więc widać, dlaczego kości było mniej. Zobacz [Arkusz zestawu zasad](#the-ruleset-sheet).
- Game Master na bieżąco aktualizuje też w arkuszu zasoby, stany i odpoczynki każdej postaci, a silnik odrzuca zmianę, na którą arkusz nie pozwala. Zobacz [Arkusz zestawu zasad](#the-ruleset-sheet).

### Zestawy z pulą kości

Niektóre systemy nie dodają premii do rzutu. Zamiast tego liczba w arkuszu określa, iloma kośćmi rzucasz, a liczą się te, które wypadły wystarczająco wysoko. Zestaw zasad może działać właśnie tak, a gra z takim zestawem zachowuje się trochę inaczej:

- **Liczba w arkuszu to kości.** Cecha 3 i fach wart 2 dają rzut pięcioma kośćmi. Arkusz pokazuje to jako "5 dice" zamiast "+5", zarówno w edytorze, jak i w tekście, który czyta Game Master.
- **Trudność to liczba sukcesów.** Trudne zadanie wymaga trzech sukcesów, a nie sumy 15. Skala trudności zestawu mówi, ilu sukcesów potrzebuje każdy stopień.
- **Silnik rzuca kośćmi i je liczy.** To, które ścianki się liczą, czy wysoki wynik daje rzut dodatkową kością albo liczy się podwójnie, czy niskie wyniki znoszą sukcesy i co uznaje się za pecha albo wyjątkowy sukces – wszystko to pochodzi z zestawu. Karta rzutu pokazuje każdą rzuconą kość, odróżniając te, które osiągnęły próg, od tych, które go nie osiągnęły, i podaje, ile sukcesów wypadło wobec liczby wymaganej przez test. Duża pula przechodzi do kolejnych wierszy zamiast się zmniejszać, a karta nigdy nie pokazuje sumy, jeśli kości nie były sumowane.
- **Game Master może dostosować pojedynczy test**, jeśli zestaw na to pozwala: ustawić trudniejszy albo łatwiejszy próg dla pojedynczej kości, dodać albo odjąć kości za okoliczności i obniżyć ściankę, od której kość rzuca się ponownie albo liczy podwójnie. Każda z tych zmian mieści się w zakresie zadeklarowanym przez zestaw. Stopień skali trudności może mieć własny próg dla pojedynczej kości, który obowiązuje, gdy Game Master wybierze ten stopień. Karta rzutu informuje, gdy test rzucał ponownie albo liczył podwójnie od innej ścianki niż zwykła ścianka zestawu.
- **Kośćmi można rzucić ponownie**, jeśli zestaw ma na to zasadę: Game Master wskazuje ją przy teście, gdy sytuacja tego wymaga, a kości, które wypadły nisko, są rzucane ponownie raz albo do skutku, aż wypadną wyżej. To samo może kupić wydany zasób. Jeden rzut jest powtarzany tylko w jeden sposób; gdy pasowałyby dwa, używany jest ten, który obejmuje więcej kości.
- **Dwie cechy mogą być rzucane razem**, jeśli zestaw tak stanowi: test cechy może dodać kości drugiej cechy, więc dwie wartości są rzucane jako jedna pula.
- **W niektórych zestawach obok wyniku coś może pójść nie tak.** W zestawie, który traktuje niskie wyniki na co najmniej połowie kości jako pecha, test, który mimo to zdobył swoje sukcesy, zachowuje wynik, a karta rzutu dodaje, że coś przy tym poszło nie tak. Bez żadnego sukcesu jest to porażka krytyczna.
- **Game Master nigdy nie podaje liczb.** Wynik puli wpisany w narrację zawsze zostaje zastąpiony własnym rzutem silnika. Ułatwienie nie ma tu zastosowania, podobnie jak kość rzucona przez ciebie przed testem.
- **Pokazywanie GM jednej kości każdego rozmiaru nie dotyczy tych testów.** Kości, które GM widzi, są 20-ścienne; test z pulą silnik rzuca w ciemno, a jego wynik jest opisywany tak jak każdy inny rzut w ciemno.

### Inne sposoby rzucania w zestawach zasad

Zestaw zasad może też rozstrzygać testy na inne sposoby. Kośćmi nadal rzuca silnik, a karta rzutu dostosowuje się do zestawu:

- **Zachowanie najwyższych kości.** Rzut garścią kości i odczyt najwyższej jednej, dwóch albo trzech, zależnie od zestawu.
- **Rzut przeciwko arkuszowi.** Rzut na wynik równy liczbie z arkusza albo niższy, na przykład procentowi umiejętności, zamiast dodawania premii do kości.
- **Kości z własnymi ściankami.** Ścianki mogą mieć inną wartość niż ich liczba, na przykład minus, puste pole i plus. Niektóre kości mają zamiast liczb symbole, na przykład sukces, przewagę i ich przeciwieństwa.
- **Wyniki w przedziałach.** Test może trafić w jeden z kilku wyników, na przykład sukces krytyczny albo sukces za cenę, zamiast zwykłego sukcesu lub porażki. Karta rzutu nazywa przedział, a Game Master go opisuje.
- **Kilka testów rzucanych inaczej.** Zestaw może rozstrzygać większość testów w jeden sposób i wskazać kilka, w których rzuca się inaczej.

<a id="the-ruleset-sheet"></a>

## Arkusz zestawu zasad

W grze z zestawem zasad każdy arkusz postaci zaczyna się od bloku **Ruleset sheet** (arkusz zestawu zasad). Jego układ pochodzi z zestawu, więc arkusz 5e i arkusz innego systemu wyglądają inaczej. Gra bez zestawu zasad nie ma tego bloku.

- **Resources** (zasoby), takie jak punkty życia, komórki zaklęć albo zasób klasy, pokazują, ile zostało z maksimum. Użyj przycisków minus i plus albo wpisz liczbę. Zasób z tymczasowym buforem pokazuje też pole **Temp**.
- **Tracks** (liczniki), takie jak wyczerpanie, przesuwają się w górę i w dół w swoim zakresie.
- **Wound tracks** (tory ran) to rząd pól zamiast liczby, dla systemów, które zaznaczają obrażenia, zamiast je liczyć. Każde pole podaje nazwę danego stopnia zranienia i to, ile odejmuje od twoich rzutów. Jeśli zestaw ma więcej niż jeden rodzaj obrażeń, najpierw wybierz rodzaj, a potem użyj **Mark** (zaznacz) albo **Clear one** (usuń jedno). Możesz też kliknąć następne puste pole, żeby dodać znacznik, albo ostatnie zaznaczone pole, żeby jeden usunąć; inne pola nie reagują na kliknięcia. Cięższy znacznik zajmuje wyższe pole i przesuwa lżejsze niżej, a wiersz pod torem podaje, która kara obowiązuje, oraz wszystko, co w ogóle nie zmieściło się na torze. Niektóre zestawy numerują pola zamiast je nazywać, czasem tyle, ile wynosi wartość cechy postaci, a niektóre umieszczają każdy znacznik na polu, w które jest wymierzony: w takich zestawach możesz kliknąć dowolne puste pole, **Clear one** usuwa najlżejszy znacznik z najwyższego pola, a pełny tor odrzuca kolejny znacznik, zamiast pogarszać dawny. Zestaw może też dodawać pola do toru z listy w twoim arkuszu, a odpoczynek albo leczenie może usuwać tylko jeden rodzaj obrażeń. Jeśli zestaw tak stanowi, ta kara odejmuje się od twoich rzutów: zabiera kości z puli albo dolicza się do sumowanego rzutu, a karta rzutu podaje, ile zastosowano.
- **Notes** (notatki), na przykład to, na czym postać się koncentruje, to krótkie pola tekstowe.
- **Conditions** (stany) to przyciski, które włącza się i wyłącza.
- **States** (stany z listy), takie jak forma albo postawa, przyjmują naraz jedną wartość z listy. Wybierz wartość z listy. Stan z listy może zmieniać liczby, które od niego zależą, na przykład kości, które postawa dodaje do twoich rzutów, a odpoczynek może przywrócić jego początkową wartość.
- **Przyciski odpoczynku** stosują jeden z odpoczynków zestawu. To, co przywraca odpoczynek, określa zestaw, a odpoczynek może też przywrócić ładunki przedmiotów noszonych przez postać, na przykład różdżki; wiersz pod przyciskami podaje wtedy, co wróciło. W 5e (SRD 5.1) długi odpoczynek przywraca punkty życia i komórki zaklęć oraz połowę kości wytrzymałości postaci, co najmniej jedną.
- Niżej znajduje się krótkie podsumowanie konfiguracji postaci: modyfikatory cech, wyszkolone umiejętności i rzuty obronne oraz kilka wartości wybranych przez zestaw, na przykład klasa pancerza.

Game Master na bieżąco aktualizuje ten sam arkusz podczas narracji. Gdy postać wydaje zasób, otrzymuje obrażenia, leczy się, zyskuje lub traci stan, zmienia stan z listy albo odpoczywa, GM zapisuje zmianę, a silnik sprawdza ją względem arkusza. Zmiana niemożliwa, na przykład zaklęcie rzucone bez wolnej komórki, zostaje odrzucona: nic się nie zmienia, a komunikat cię o tym informuje.

Gdy postać używa czegoś wybranego z katalogów zestawu, na przykład zaklęcia albo cechy klasy, Game Master to nazywa, a silnik pobiera całą cenę: to, ile według zestawu to kosztuje, oraz po jednym użyciu każdego licznika, który się z tym wiąże. Zaklęcie wymagające komórki jest opłacane z komórki poziomu, który wskazuje dla niego zestaw, a Game Master może zamiast tego poprosić o wyższy. Silnik nigdy sam nie sięga po wyższą komórkę. Jeśli którejś części ceny nie da się zapłacić, cała operacja zostaje odrzucona i nic nie jest wydawane. Coś, co nic nie kosztuje, na przykład sztuczka, jest po prostu opisywane w narracji.

Niektóre liczby w arkuszu należą do zestawu, a nie do ciebie. Zestaw ustala maksimum zasobu klasy, które zależy od poziomu, albo liczbę użyć zależną od wartości cechy i pilnuje, żeby pozostały poprawne, gdy edytujesz arkusz.

Niektóre wyliczane wartości zależą od samej gry: zestaw może wyliczać liczbę z bieżącego stanu zasobu albo licznika, podawać liczbę dla każdej wartości stanu z listy albo sumować kolumnę listy, na przykład wagę spakowanego wyposażenia. Może też ograniczać umiejętność do takiej liczby, więc umiejętność może się zmniejszać, gdy zasób jest niski. Arkusz gry pokazuje ich bieżącą wartość, a test albo walka korzysta z wartości z chwili, w której się odbywa. Edytor arkusza na karcie postaci, który nie ma gry do odczytu, pokazuje je tak, jak wyglądałyby na początku gry.

Te bieżące wartości należą do wiadomości, w której powstały. Jeśli przełączysz się swipe'em na inną wersję tury albo wygenerujesz ją ponownie, arkusz wraca do stanu sprzed tej tury, więc nic nie zostaje wydane dwa razy.

Kliknij **Edit sheet** (edytuj arkusz), żeby zmienić samą konfigurację postaci, na przykład po awansie: wartości, pola, listy takie jak zaklęcia oraz wyszkolenie umiejętności i rzutów obronnych. Wyliczane wartości aktualizują się w trakcie pisania. To ten sam edytor co na karcie postaci, więc i tu można dodawać wiersze z katalogów zestawu, pola, którymi zarządza zestaw, są widoczne, ale nie da się w nich pisać, a lista, której tekst w zestawie się zmienił, oferuje przycisk **Review** (przejrzyj). Gdy zestaw ma kreator krok po kroku, edytor oferuje **Guided** (z przewodnikiem) obok **All fields** (wszystkie pola). **Guided** prowadzi przez każdy wybór, na przykład wartości, umiejętności i wyposażenie początkowe, i podaje, na co dany krok jeszcze czeka. **All fields** pokazuje wszystko naraz. Na koniec kliknij **Save sheet** (zapisz arkusz). Zmienia to tylko kopię arkusza w tej grze. Arkusz zapisany przy postaci albo personie nigdy nie jest zmieniany przez grę.

Osobny przycisk **Edit Sheet** (zobacz [Ręczna edycja arkusza](party-and-npcs.md#edit-a-sheet-by-hand)) nadal edytuje ogólny arkusz (klasę, zdolności, mocne strony i tak dalej) i nie zmienia arkusza zestawu zasad.

Jeśli pakiet zestawu został usunięty albo zainstalowana kopia jest starsza niż ta, z którą utworzono grę, blok pokazuje zamiast tego komunikat, a testów nie da się rzucać, dopóki pakiet nie zostanie ponownie zainstalowany.

## Arkusz drużyny i zegary postępu

Niektóre zestawy prowadzą arkusz całej drużyny, na przykład załogi albo kompanii. Jest widoczny na ekranie gry w pobliżu mapy, pod nazwą, jaką nadaje mu zestaw. Kliknij nazwę, żeby go otworzyć. Game Master aktualizuje go tak samo jak arkusz każdej postaci, a gdy zestaw na to pozwala, możesz go też edytować. Jeśli ktoś inny zapisał arkusz drużyny w trakcie twojej edycji, widzisz jego wersję: **Save** (zapisz) zastępuje ją twoją, a **Cancel** (anuluj) zachowuje tamtą.

Zestaw może też używać **Progress clocks** (zegary postępu): kół podzielonych na segmenty, które Game Master wypełnia, gdy coś narasta, na przykład gdy ktoś podnosi alarm. Są widoczne w pobliżu mapy, każdy z liczbą wypełnionych segmentów, a po wypełnieniu pokazują **Done** (gotowe).

## Powiązane przewodniki

- [Game Mode: walki z zestawem zasad](fighting-on-a-ruleset.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Kolory postaci i statystyki RPG: arkusze zestawu zasad](../characters/colors-and-stats.md#ruleset-sheets)
- [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md)
