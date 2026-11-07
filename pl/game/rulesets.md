# Game Mode: gra z zestawem zasad

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakimi kośćmi rzuca test, co jest w arkuszu postaci, jakie zasoby się wydaje, co daje odpoczynek, a w niektórych zestawach także jak rozgrywa się całą walkę. Ten przewodnik opisuje, jak zdobyć zestaw zasad, wybrać go dla gry i co zmienia się w rozgrywce. Gra bez zestawu zasad korzysta z własnych zasad aplikacji Marinara Engine, opisanych w pozostałych przewodnikach po trybie Game Mode.

## Uzyskanie zestawu zasad

Żeby zainstalować oficjalny zestaw zasad, na przykład 5e (SRD 5.1):

1. Kliknij ikonę Sparkles, żeby otworzyć panel **Agents** (agenci).
2. Wybierz **Agent Organizer** (organizowanie agentów).
3. Znajdź zestaw zasad. Zestawy zasad mają oznaczenie **Rules**.
4. Kliknij **Install** (instalacja).

Potem rozpocznij nową grę i wybierz zestaw (zobacz niżej). Zestawy zasad pochodzą z dwóch miejsc:

- Zestawy **Official** (oficjalne) instaluje się tak, jak opisano wyżej.
- Zestawy **Community** (społeczność) importuje się z pliku albo z repozytorium GitHub autora. Są zapisywane według pochodzenia, na przykład `local/ember-roads` albo `alice/v20`.

Import korzysta z tego samego przełącznika **Allow custom Agent imports** (zezwolenie na import własnych agentów) co importowani agenci. Gdy jest wyłączony, zaimportowane zestawy są pomijane w nowych grach, a gry, które już z nich korzystają, działają dalej. Gra na zaimportowanym zestawie zawsze korzysta z dokładnie tej wersji, z którą powstała. Pisanie własnego zestawu opisuje przewodnik [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md).

Własny tekst zestawu zasad, na przykład nazwy umiejętności, zaklęcia i tekst mistrza gry (GM, Game Master), jest w języku ustawionym w **Settings** (Ustawienia). Oficjalny zestaw zasad pobiera tylko tłumaczenie na ten język, po zmianie języka pobiera nowe, a dla języka, którego nie ma, używa tekstu angielskiego. Zestaw zasad zaimportowany z pliku zachowuje tylko tłumaczenie na język wybrany w chwili importu. Żeby zmienić język, zaimportuj plik ponownie.

## Wybór zestawu zasad dla gry

Pole **Rules** (zasady) pojawia się w kroku **World** (świat) kreatora tylko wtedy, gdy jest zainstalowany przynajmniej jeden zestaw zasad, i tylko przy nowej grze. Jest niezależne od **Combat Preference** (preferowany rodzaj walki): **Rules** decyduje o działaniu testów i arkuszy, a **Combat Preference** o tym, jak pokazywane są walki.

1. W kreatorze konfiguracji otwórz krok **World**.
2. W polu **Rules** zostaw **Marinara's own rules** (własne zasady aplikacji Marinara Engine, czyli wbudowane testy d20 i arkusz sześciu atrybutów) albo wybierz zestaw zasad, na przykład **5e (SRD 5.1)**.
3. Przeczytaj podsumowanie. Wymienia, co obejmuje zestaw, i zawiera jedną linię o walkach (zobacz [Co dzieje się podczas walk](#what-happens-in-battles)).
4. Opcjonalnie: włącz **layers** (warstwy, zobacz niżej).
5. W kroku **Party** (drużyna) sprawdź, kto **Has a sheet** (ma arkusz), a kto **Starts on a blank sheet** (zaczyna z pustym arkuszem). Arkusz to liczby postaci dla tego zestawu zasad, na przykład wartości cech i punkty życia. Pusty arkusz korzysta z domyślnych wartości zestawu. Możesz go wypełnić później.

Zestaw zasad ustala się przy tworzeniu gry. Nie da się go później zmienić ani dodać.

**Layers** to nazwane warianty zestawu zasad, na przykład Low magic albo Hard winter. Pokazują się jako przełączniki pod zestawem, z linią opisującą działanie każdego z nich. Warstwa może:

- zaostrzyć trudności,
- zawęzić wybór w arkuszu,
- ukryć część gotowych wpisów w selektorze edytora arkusza,
- zmienić to, co sprzedają sklepy i jakie skarby wypadają,
- dać GM dodatkowe instrukcje, także dotyczące budowanego świata.

Niektóre warstwy się wykluczają, a kreator wyłącza tę, której nie można wybrać. Po rozpoczęciu gry warstwy są ustalone. Arkusz, który już korzysta z czegoś, co warstwa usuwa, zachowuje to.

Arkusz dodaje się w sekcji **Stats** (statystyki) w edytorze postaci lub persony (zobacz [Arkusze zestawów zasad](../characters/colors-and-stats.md#ruleset-sheets)). Gra kopiuje każdy arkusz przy generowaniu świata i nic, co zmienisz w grze, nie wraca do postaci ani persony. Członek drużyny bez arkusza dostaje pusty arkusz z każdą wartością ustawioną na domyślną wartość zestawu. Generowanie świata nigdy nie wymyśla wartości cech.

Udostępniony plik konfiguracji zapamiętuje swój zestaw zasad. Jeśli go zaimportujesz, a nie masz tego zestawu albo masz jego starszą wersję, kreator informuje, o jaki zestaw chodziło, a gra korzysta z własnych zasad aplikacji Marinara Engine, chyba że zainstalujesz ten zestaw i go wybierzesz.

<a id="what-happens-in-battles"></a>

## Co dzieje się podczas walk

To, co zestaw zasad robi w walce, zależy od tego, jak został napisany. Linia pod zestawem zasad w kreatorze wskazuje, który wiersz ma zastosowanie.

| Zestaw zasad | Walki |
| --- | --- |
| Sam rozstrzyga walki, jak 5e (SRD 5.1) | Rozgrywane według zasad zestawu, na jego własnym ekranie walki. Zobacz [Game Mode: walki z zestawem zasad](fighting-on-a-ruleset.md). |
| Udostępnia swój arkusz do walk | Własny system walki aplikacji Marinara Engine, korzystający ze zdrowia, komórek zaklęć i zdolności z arkusza (zobacz niżej). |
| Nic nie mówi o walkach | Własny system walki aplikacji Marinara Engine, dokładnie jak w grze bez zestawu zasad. Zobacz [Game Mode: walka](combat.md). |

Gdy zestaw zasad udostępnia swój arkusz, system walki aplikacji Marinara Engine korzysta z arkusza tak:

- Każdy członek drużyny zaczyna walkę z tą pulą zasobu i tymi komórkami zaklęć, które zestaw przygotował na bitwy, w takim stanie, w jakim ma je teraz w arkuszu.
- Zdolności wybrane z katalogów zestawu stają się umiejętnościami, gdy system walki aplikacji Marinara Engine potrafi ich użyć. Pomijany jest wpis, który opisuje tylko coś poza walką, reakcja oraz zdolność, której kosztu bitwa nie umie pobrać.
- Punkty życia są przenoszone jako część maksimum, a nie jako liczba z arkusza. Postać z połową zdrowia zaczyna z połową paska zdrowia na ekranie bitwy, więc arkusz z 9 punktami zdrowia nigdy nie trafi do walki, w której jeden cios zadaje 12.
- Po walce utracone lub odzyskane zdrowie wraca do arkusza w ten sam sposób, a wydane komórki i zasoby zapisują się bez zmian.

Reszta się nie zmienia. Matematyka rzutów nadal należy do aplikacji Marinara Engine (zobacz [Jak liczona jest walka](combat.md#how-combat-math-works)), a rzuty ataku, rzuty obronne i koncentracja z systemu stołowego nie są stosowane. Walka opuszczona przez usunięcie wiadomości, w której się zaczęła, niczego nie zapisuje z powrotem.

<a id="checks-on-a-ruleset"></a>

## Testy z zestawem zasad

GM prosi o testy tak samo jak w każdej grze (zobacz [Testy umiejętności](dice-and-skill-checks.md#skill-checks)), ale o tym, jak się je rzuca, decyduje zestaw zasad.

- GM tylko wskazuje umiejętność albo rzut obronny i ustala trudność. Dostaje przy tym skalę trudności zestawu, a nie wbudowaną. Trudność może sięgać tak daleko jak ta skala, nawet poza zakres od 1 do 40 z własnych zasad aplikacji Marinara Engine. Jedna ścieżka zostaje przy zakresie od 1 do 40: mechanizm awaryjny, który rzuca za test wciąż zaległy w zapisanej turze.
- Marinara rzuca kośćmi zestawu i dodaje modyfikator z **ruleset sheet** (arkusz zestawu zasad) postaci: modyfikator cechy, gdy umiejętność albo rzut obronny wskazuje cechę, premię za poziom wyszkolenia (wielokrotność premii biegłości, stałą liczbę albo jedno i drugie) oraz dodatkową premię z arkusza. Wbudowane premie umiejętności i atrybuty nie są używane.
- Wyniki zależą od zestawu. W 5e (SRD 5.1) naturalna 20 i naturalna 1 nie mają specjalnego skutku w testach i rzutach obronnych, więc naturalna 20, która nie osiąga trudności, oznacza porażkę.
- Jeśli pakietu zestawu brakuje albo jest starszy niż ten, z którym utworzono grę, testy są zapisywane bez liczb i pozostają zaległe. Nigdy nie są rzucane według zasad innego systemu.

Marinara nie ufa liczbom, które wpisuje GM. Znacznik wyglądający na gotowy zostaje rzucony ponownie i zastąpiony, gdy jego modyfikator nie jest tym z arkusza, gdy rzucono w nim inną liczbą albo innym rozmiarem kości niż w zestawie, gdy policzona kość nie jest tą, którą zachowuje tryb rzutu, albo gdy deklaruje wynik naturalny, którego zestaw nie ma.

### Co GM może dodać do testu

| GM wpisuje | Skutek |
| --- | --- |
| `who="Name"` | Test korzysta z arkusza tego członka drużyny. Bez tego test dotyczy gracza. Członek drużyny bez arkusza rzuca na pustym arkuszu. Nazwa, która nie pasuje do nikogo albo którą nosi dwóch członków drużyny, daje rzut bez modyfikatora. Jeśli członek drużyny nosi imię twojej postaci, to imię nadal oznacza ciebie. Marinara nigdy nie pożycza cudzego arkusza. |
| `with="Ability"` | Rzut umiejętności albo rzut obronny z inną cechą. Liczy się tylko cecha zadeklarowana przez zestaw. Każda inna jest ignorowana. |
| `difficulty="Hard"` | Nazwa stopnia skali zamiast liczby. Marinara rzuca przeciwko liczbie tego stopnia, a zapisany test pokazuje tę liczbę. Nieznana nazwa jest ignorowana. |
| Znaczniki rzutów | Mogą wskazywać cechy, umiejętności i rzuty obronne zestawu oraz `PROF` dla premii biegłości, jeśli zestaw ją ma. |

Kość rzucona przez ciebie przed testem jest używana tylko wtedy, gdy zestaw rzuca pojedynczą d20. Zestaw, który rzuca innymi kośćmi, na przykład 2d6 albo pulą, ją pomija.

### Wpływ arkusza na rzut

- **Talizmany, które zmieniają rzut.** GM wskazuje talizman przy teście, a Marinara pobiera jego koszt, stosuje jego działanie i rzuca. Talizman, którego nie wybrano albo za który nie da się zapłacić, nic nie robi i nic nie kosztuje.
- **Wydanie zasobu na pewniejszy rzut.** GM zaznacza to przy teście. Marinara pobiera punkty, dodaje to, co za nie kupiono, i rzuca. Jeśli pula nie wystarcza, nic nie zostaje wydane. Zapis pokazuje to, co naprawdę zapłacono. Ile można kupić w jednym teście, ustala zestaw: stałą liczbę, liczbę z twojego arkusza albo tyle, ile kości ma test.
- **Liczby doliczane do rzutów.** Jeśli zestaw mówi, że jakaś liczba z arkusza dotyczy określonych rzutów, na przykład ciężki plecak przy każdym rzucie na Brawn, Marinara dodaje ją do każdego testu, którego dotyczy, a karta rzutu podaje, co dodał arkusz.
- **Umiejętności bez wyszkolenia.** Zestaw może sprawić, że test bez wyszkolenia kosztuje kości albo punkty, jest o jeden stopień trudniejszy albo jest niemożliwy. Test, którego nie da się podjąć, nie jest rzucany, a narracja o tym mówi. Arkusz nie pokazuje żadnej liczby dla takiej umiejętności, dopóki jej nie wyszkolisz.
- **Rany.** Jeśli zestaw ma tor ran i mówi, że jego kara dotyczy rzutów, rany utrudniają każdy test. W zestawie z pulą kości kara odbiera tyle kości z puli, nigdy nie schodząc poniżej najmniejszej puli dozwolonej przez zestaw (niektóre pozwalają na pustą). W zestawie, który sumuje kości, jest to stała kara. Test podaje, ile zastosowano. Zobacz [Arkusz zestawu zasad](#the-ruleset-sheet).

GM na bieżąco aktualizuje też w arkuszu zasoby, stany i odpoczynki każdej postaci, a Marinara odrzuca zmianę, na którą arkusz nie pozwala.

### Zestawy z pulą kości

Niektóre systemy liczą kości zamiast dodawać premię. Liczba w arkuszu określa, iloma kośćmi rzucasz, a liczą się te, które wypadły wystarczająco wysoko.

- **Liczba w arkuszu to kości.** Cecha 3 i fach wart 2 dają rzut pięcioma kośćmi. Arkusz pokazuje "5 dice" zamiast "+5".
- **Trudność to liczba sukcesów.** Trudne zadanie wymaga trzech sukcesów, a nie sumy 15. Skala trudności zestawu mówi, ilu sukcesów potrzebuje każdy stopień.
- **Marinara rzuca kośćmi i je liczy.** Zestaw decyduje, które ścianki się liczą, czy wysoki wynik daje rzut dodatkową kością albo liczy się podwójnie, czy niskie wyniki znoszą sukcesy i co uznaje się za pecha albo wyjątkowy sukces. Karta rzutu pokazuje każdą kość, wyróżniając te, które osiągnęły próg, i podaje liczbę sukcesów wobec liczby wymaganej. Duża pula przechodzi do kolejnych wierszy, a karta nigdy nie pokazuje sumy, jeśli kości nie były sumowane.
- **GM może dostosować pojedynczy test**, jeśli zestaw na to pozwala: ustawić trudniejszy albo łatwiejszy próg dla pojedynczej kości, dodać albo odjąć kości za okoliczności i obniżyć ściankę, od której kość rzuca się ponownie albo liczy podwójnie. Każda z tych zmian mieści się w zakresie zestawu. Stopień skali może mieć własny próg dla pojedynczej kości. Karta rzutu informuje, gdy test korzystał z innej ścianki niż zwykła ścianka zestawu.
- **Kośćmi można rzucić ponownie**, jeśli zestaw ma na to zasadę. GM wskazuje ją przy teście, a kości, które wypadły nisko, są rzucane ponownie raz albo do skutku, aż wypadną wyżej. To samo może kupić wydany zasób. Jeden rzut jest powtarzany tylko w jeden sposób. Gdy pasowałyby dwa, używany jest ten, który obejmuje więcej kości.
- **Dwie cechy mogą być rzucane razem**, jeśli zestaw tak stanowi: dwie wartości są rzucane jako jedna pula.
- **Pech może przyjść razem z wynikiem.** W zestawie, który traktuje niskie wyniki na co najmniej połowie kości jako pecha, test, który mimo to zdobył swoje sukcesy, zachowuje wynik, a karta rzutu dodaje, że coś poszło nie tak. Bez żadnego sukcesu jest to porażka krytyczna.
- **GM nigdy nie podaje liczb.** Wynik puli wpisany w narrację zostaje zastąpiony własnym rzutem aplikacji Marinara Engine. Ułatwienie i kość rzucona z wyprzedzeniem nie mają tu zastosowania.
- **Pokazywanie jednej kości każdego rozmiaru nie ma tu zastosowania.** Kości, które widzi GM, są dwudziestościenne. Test z pulą jest rzucany w ciemno i opisywany tak jak każdy rzut w ciemno.

### Inne sposoby rzucania w zestawach zasad

Kośćmi nadal rzuca Marinara, a karta rzutu dostosowuje się do zestawu:

- **Zachowanie najwyższych kości.** Rzut garścią kości i odczyt najwyższej jednej, dwóch albo trzech.
- **Rzut przeciwko arkuszowi.** Rzut na wynik równy liczbie z arkusza albo niższy, na przykład procentowi umiejętności.
- **Kości z własnymi ściankami.** Ścianki mogą mieć inną wartość niż ich liczba, na przykład minus, puste pole i plus, albo nosić symbole, na przykład sukces, przewagę i ich przeciwieństwa.
- **Wyniki w przedziałach.** Test może trafić w przedział, na przykład sukces krytyczny albo sukces za cenę, zamiast zwykłego sukcesu lub porażki. Karta rzutu nazywa przedział, a GM go opisuje.
- **Kilka testów rzucanych inaczej.** Zestaw może rozstrzygać większość testów w jeden sposób i wskazać kilka, w których rzuca się inaczej.

<a id="the-ruleset-sheet"></a>

## Arkusz zestawu zasad

W grze z zestawem zasad każdy arkusz postaci zaczyna się od bloku **Ruleset sheet**. Jego układ pochodzi z zestawu, więc arkusz 5e i arkusz innego systemu wyglądają inaczej. Gra bez zestawu zasad nie ma tego bloku. Zobacz też [Okno Character Profiles](party-and-npcs.md#character-profiles).

| Część | Jak działa |
| --- | --- |
| **Resources** (zasoby) | Punkty życia, komórki zaklęć albo zasób klasy pokazują, ile zostało z maksimum. Użyj przycisków minus i plus albo wpisz liczbę. Zasób z tymczasowym buforem pokazuje też pole **Temp**. |
| **Tracks** (liczniki) | Na przykład wyczerpanie. Przesuwają się w górę i w dół w swoim zakresie. |
| **Notes** (notatki) | Krótkie pola tekstowe, na przykład na to, na czym postać się koncentruje. |
| **Conditions** (stany) | Przyciski, które włącza się i wyłącza. |
| **States** (stany z listy) | Forma albo postawa: naraz jedna wartość z listy. Stan z listy może zmieniać liczby, które od niego zależą, na przykład kości dodawane do rzutów, a odpoczynek może przywrócić jego wartość początkową. |
| **Przyciski odpoczynku** | Stosują jeden z odpoczynków zestawu. To, co przywraca odpoczynek, określa zestaw. Może też przywrócić ładunki przedmiotów, na przykład różdżki, a linia pod przyciskami podaje, co wróciło. W 5e (SRD 5.1) długi odpoczynek przywraca punkty życia i komórki zaklęć oraz połowę kości wytrzymałości, co najmniej jedną. |
| Podsumowanie konfiguracji | Modyfikatory cech, wyszkolone umiejętności i rzuty obronne oraz wartości wybrane przez zestaw, na przykład klasa pancerza. |

**Wound tracks** (tory ran) to rząd pól zamiast liczby, dla systemów, które zaznaczają obrażenia, zamiast je liczyć. Każde pole podaje nazwę danego stopnia zranienia i to, ile odejmuje od twoich rzutów.

1. Jeśli zestaw ma więcej niż jeden rodzaj obrażeń, najpierw wybierz rodzaj.
2. Kliknij **Mark** (zaznacz) albo **Clear one** (usuń jedno). Możesz też kliknąć następne puste pole, żeby dodać znacznik, albo ostatnie zaznaczone pole, żeby jeden usunąć. Inne pola nie reagują na kliknięcia.

Cięższy znacznik zajmuje wyższe pole i przesuwa lżejsze niżej. Linia pod torem podaje, która kara obowiązuje, oraz wszystko, co nie zmieściło się na torze. Niektóre zestawy numerują pola zamiast je nazywać, czasem tyle, ile wynosi twoja własna wartość cechy, a niektóre umieszczają każdy znacznik na polu, w które jest wymierzony. W takich zestawach możesz kliknąć dowolne puste pole, **Clear one** usuwa najlżejszy znacznik z najwyższego pola, a pełny tor odrzuca kolejny znacznik, zamiast pogarszać dawny. Zestaw może dodawać pola z listy w twoim arkuszu, a odpoczynek albo leczenie może usuwać tylko jeden rodzaj obrażeń.

### Jak GM zmienia arkusz

GM na bieżąco aktualizuje arkusz podczas narracji. Gdy postać wydaje zasób, otrzymuje obrażenia, leczy się, zyskuje lub traci stan, zmienia stan z listy albo odpoczywa, GM zapisuje zmianę, a Marinara sprawdza ją względem arkusza. Zmiana niemożliwa, na przykład zaklęcie rzucone bez wolnej komórki, zostaje odrzucona. Nic się nie zmienia, a komunikat cię o tym informuje.

Gdy postać używa czegoś wybranego z katalogów zestawu, na przykład zaklęcia albo cechy klasy, GM to nazywa, a Marinara pobiera całą cenę: to, ile według zestawu to kosztuje, oraz po jednym użyciu każdego licznika, który się z tym wiąże. Zaklęcie wymagające komórki jest opłacane z komórki poziomu, który wskazuje zestaw, a GM może poprosić o wyższy. Marinara nigdy sama nie sięga po wyższą komórkę. Jeśli którejś części ceny nie da się zapłacić, całość zostaje odrzucona i nic nie jest wydawane. Coś darmowego, na przykład sztuczka, jest tylko opisywane w narracji.

Niektóre liczby w arkuszu należą do zestawu: maksimum zasobu klasy, które zależy od twojego poziomu, albo liczbę użyć zależną od wartości cechy ustala zestaw i pilnuje, żeby pozostały poprawne, gdy edytujesz arkusz. Zestaw może też wyliczać liczbę z bieżącego stanu zasobu albo licznika, podawać liczbę dla każdej wartości stanu z listy, sumować kolumnę listy (na przykład wagę spakowanego wyposażenia) albo ograniczać umiejętność do takiej liczby, więc umiejętność może się zmniejszać, gdy zasób jest niski. Arkusz gry pokazuje te bieżące wartości, a test albo walka korzysta z wartości z danej chwili. Edytor arkusza na karcie postaci nie ma gry do odczytu, więc pokazuje je tak, jak wyglądają na początku gry.

Bieżące wartości należą do wiadomości, w której powstały. Jeśli przełączysz się swipe'em na inną wersję tury albo wygenerujesz ją ponownie, arkusz wraca do stanu sprzed tej tury, więc nic nie zostaje wydane dwa razy.

### Edycja arkusza zestawu zasad

Tu zmieniasz samą konfigurację postaci, na przykład po awansie.

1. Otwórz arkusz postaci i kliknij **Edit ruleset sheet** (edycja arkusza zestawu zasad).
2. Zmień wartości cech, pola, listy takie jak zaklęcia oraz wyszkolenie umiejętności i rzutów obronnych. Wyliczane wartości aktualizują się w trakcie pisania. Gdy zestaw ma kreator krok po kroku, wybierz **Guided** (z przewodnikiem), żeby przejść przez każdy wybór (wartości cech, umiejętności, wyposażenie początkowe), albo **All fields** (wszystkie pola), żeby zobaczyć wszystko naraz.
3. Kliknij **Save sheet** (zapisz arkusz).

To ten sam edytor co na karcie postaci. Można dodawać wiersze z katalogów zestawu, pola, którymi zarządza zestaw, są widoczne, ale nie da się w nich pisać, a lista, której tekst w zestawie się zmienił, oferuje przycisk **Review** (przejrzyj). Zapis zmienia tylko kopię arkusza w tej grze. Arkusz zapisany przy postaci albo personie nigdy nie jest zmieniany przez grę.

Osobny przycisk **Edit card** (edycja karty, zobacz [Ręczna edycja arkusza](party-and-npcs.md#edit-a-sheet-by-hand)) edytuje ogólny arkusz (klasę, zdolności, mocne strony) i nie zmienia arkusza zestawu zasad.

Jeśli to nie zadziałało, a pakiet zestawu został usunięty albo jest starszy niż ten, z którym utworzono grę, blok pokazuje zamiast tego komunikat. Testów nie da się rzucać, dopóki pakiet nie zostanie ponownie zainstalowany.

## Arkusz drużyny i zegary postępu

Niektóre zestawy prowadzą arkusz całej drużyny, na przykład załogi albo kompanii. Jest widoczny na ekranie gry w pobliżu mapy, pod nazwą, jaką nadaje mu zestaw. Kliknij nazwę, żeby go otworzyć. GM aktualizuje go tak samo jak arkusz każdej postaci, a gdy zestaw na to pozwala, możesz go też edytować. Jeśli ktoś inny zapisał arkusz drużyny w trakcie twojej edycji, widzisz jego wersję. **Save** (zapisz) zastępuje ją twoją, a **Cancel** (anuluj) zachowuje tamtą.

Zestaw może też używać **Progress clocks** (zegary postępu): kół podzielonych na segmenty, które GM wypełnia, gdy coś narasta, na przykład gdy ktoś podnosi alarm. Są widoczne w pobliżu mapy, każdy z liczbą wypełnionych segmentów, a po wypełnieniu pokazują **Done** (gotowe).

## Powiązane przewodniki

- [Game Mode: walki z zestawem zasad](fighting-on-a-ruleset.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Kolory postaci i statystyki fabularne: arkusze zestawu zasad](../characters/colors-and-stats.md#ruleset-sheets)
- [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md)
