# Game Mode: klasy MRPG

Każda nowa gra korzysta z klas **MRPG** (Marinara RPG), również gra utworzona z Experience. Każdy członek drużyny ma klasę, zdobywa poziomy za wygrane przez drużynę walki i w miarę rozwoju odblokowuje nowe klasy. Ta strona to przewodnik gracza po klasach: ich wybieraniu, znaczeniu statystyk, działaniu poziomów i awansów klas oraz arkuszu postaci.

Klasy MRPG nie są używane w dwóch rodzajach gier:

- **Gry Legacy.** Gry utworzone przed wprowadzeniem klas MRPG zachowują arkusze **Legacy**, dopóki nie zdecydujesz się ich przenieść. Zobacz [Przenoszenie gry Legacy do MRPG](#move-a-legacy-game-to-mrpg).
- **Gry z zestawem zasad.** Gra rozgrywana z zestawem zasad, na przykład 5e (SRD 5.1), korzysta z własnych arkuszy zestawu zasad. Zobacz [Gra z zestawem zasad](rulesets.md).

Przebieg walki z klasami MRPG opisuje część [Walki w grze MRPG](combat.md#battles-in-an-mrpg-game).

<a id="how-it-works"></a>

## Jak to działa

- Każda postać szkoli się w dwóch z ośmiu **drzewek**: wybranym przez ciebie **głównym drzewku** i **siostrzanym drzewku**, które otwiera jej temperament.
- Rozpoczyna grę w podstawowej klasie swojego głównego drzewka, na poziomie 1.
- Wygrywanie walk daje doświadczenie. Statystyki postaci wynikają z jej **aktywnej klasy** i rosną, gdy ta klasa zdobywa poziomy.
- Na poziomie klasy 10 klasę można awansować do klasy zaawansowanej, a na poziomie 20 do klasy mistrzowskiej. Najwyższy poziom to 30.
- Poza walką postać może przełączyć się na dowolną odblokowaną klasę i przenieść maksymalnie cztery umiejętności z innych klas, w których się szkoliła.

<a id="the-eight-trees"></a>

## Osiem drzewek

| Drzewko | Szereg | Styl walki | Siostrzane drzewko dla tych temperamentów |
| --- | --- | --- | --- |
| **Blade** | Przedni | Wojownicy posługujący się bronią, którzy stają z wrogiem twarzą w twarz. | Reckless |
| **Guard** | Przedni | Obrońcy z tarczami, którzy przyjmują ciosy wymierzone w sojuszników i zmuszają wroga, żeby skupił się na nich. | Protective, Honourable |
| **Scout** | Przedni | Szybcy oportuniści, którzy uderzają, unikają ciosów i kradną. | Opportunistic, Cowardly |
| **Marksman** | Tylny | Łucznicy, którzy zmieniają amunicję, żeby dopasować ją do celu. | Patient, Cautious |
| **Channeler** | Tylny | Magowie ognia, lodu, błyskawic, wiatru, drewna, ziemi, wody i metalu. | Arrogant, Methodical |
| **Hexer** | Tylny | Miotający klątwy, którzy osłabiają przeciwników i wysysają ich HP. | Cruel |
| **Mender** | Tylny | Uzdrowiciele, którzy utrzymują drużynę na nogach i leczą jej dolegliwości. | Supportive |
| **Herald** | Tylny | Dowódcy, którzy wydają rozkazy i śpiewają pieśni wzmacniające drużynę. | Coordinated, Disciplined |

Najlepiej radzi sobie drużyna z mieszanką drzewek. Trafienia wręcz w tylny szereg zadają połowę obrażeń, więc drzewka tylnego szeregu polegają na przednim szeregu, który utrzymuje linię (zobacz [Szeregi](combat.md#rows)).

<a id="classes-in-each-tree"></a>

### Klasy w każdym drzewku

Każde drzewko ma siedem klas. Klasa podstawowa awansuje na poziomie klasy 10 do jednej z dwóch klas zaawansowanych, a każda z nich na poziomie klasy 20 do swojej klasy mistrzowskiej. Trzecia ścieżka, w ostatniej kolumnie, jest dostępna tylko dla postaci **Pure**: takiej, której temperament wskazuje z powrotem na jej własne główne drzewko, przez co nie ma siostrzanego drzewka i szkoli się wyłącznie w tym jednym.

| Drzewko | Klasa podstawowa | Zaawansowana (10) → mistrzowska (20) | Tylko Pure |
| --- | --- | --- | --- |
| Blade | Blade | Duelist → Headsman; Bloodsworn → Cleaver | Weaponmaster → Paragon of Arms |
| Guard | Guard | Sentinel → Stonewall; Warden → Elder Warden | Aegis → Bulwark |
| Scout | Scout | Rogue → Phantom; Skirmisher → Harrier | Shade → Shroud |
| Marksman | Marksman | Sharpshooter → Farshot; Tracker → Huntsmaster | Artillerist → Siegebreaker |
| Channeler | Channeler | Elementalist → Stormcaller; Rune Scholar → Runelord | Astral Adept → Starweaver |
| Hexer | Hexer | Witch → Carrion Lord; Dreamcaller → Dreamweaver | Nullifier → Void Sovereign |
| Mender | Mender | Cleric → Saint; Apothecary → Panacean | Lifebinder → Lightbearer |
| Herald | Herald | Cantor → Maestro; Field Captain → Marshal | Standard-Bearer → Lodestar |

Zakładka **Classes** (klasy) arkusza postaci opisuje każdą klasę i wymienia jej umiejętności wraz z poziomem klasy, na którym postać się ich uczy.

<a id="choose-a-characters-trees"></a>

## Wybieranie drzewek postaci

**Główne drzewko.** Wybierz je przed grą w sekcji **Game Mode** zakładki **Stats** na karcie postaci z biblioteki albo persony (zobacz [Wybory MRPG na karcie](../characters/colors-and-stats.md#mrpg-picks-on-a-card)). Po pozostawieniu opcji **Auto** drzewko jest odczytywane z opisu postaci, a w grze również z jej klasy i zdolności. Postać, której karta nie wskazuje żadnego drzewka, zaczyna jako Blade. Dopóki postać nie zdobędzie pierwszego punktu doświadczenia, drzewko można też zmienić w grze na zakładce **Classes** jej arkusza, w polu **Main tree** (główne drzewko).

**Mocne i słabe statystyki.** Ta sama sekcja karty pozwala wybrać maksymalnie dwie statystyki, w których postać jest **Strong in** (mocna), i jedną, w której jest **Weak in** (słaba). Każda gra od nowa losuje ukryty rozwój każdej postaci, a te wybory wpływają na rzut. Nie ustawiają żadnych liczb.

**Siostrzane drzewko.** Gdy gra tworzy kartę postaci do gry, Game Master odczytuje jej temperament z pól Description i personality: sposób, w jaki podchodzi do walki. Ten temperament otwiera siostrzane drzewko z powyższej tabeli. Jeśli zależy ci na konkretnym siostrzanym drzewku, napisz pole Description z myślą o odpowiednim temperamencie. Arkusz pokazuje temperament obok siostrzanego drzewka, na przykład "from Cautious". Fabuła może później zmienić temperament postaci, ale jej siostrzane drzewko pozostaje takie jak na początku.

Postać, której temperament otwiera jej własne główne drzewko, na przykład Reckless Blade, jest **Pure**: szkoli się tylko w jednym drzewku i uzyskuje dostęp do jego ścieżki przeznaczonej wyłącznie dla Pure.

<a id="what-the-stats-mean"></a>

## Co oznaczają statystyki

| Statystyka | Działanie |
| --- | --- |
| **HP** | Zdrowie. Postać, której HP spadnie do 0, pada. Pasek HP w walce jest większy od statystyki i rośnie wraz z poziomem. |
| **Strength** (Str) | Obrażenia zadawane bronią. Zwiększa też Stamina. |
| **Magic** (Mag) | Obrażenia zaklęć, kosturów, różdżek i magicznych katalizatorów oraz moc leczenia. Ustala też MP. |
| **Skill** (Skl) | Celność i trafienia krytyczne. |
| **Speed** (Spd) | Częstotliwość działania postaci i skuteczność uników. Zwiększa też Stamina. |
| **Defense** (Def) | Zmniejsza obrażenia od broni i innych ataków fizycznych. |
| **Resistance** (Res) | Zmniejsza obrażenia od magii. |
| **Luck** (Lck) | Nieznacznie zwiększa celność i uniki oraz chroni przed trafieniami krytycznymi. |

Za umiejętności płaci się dwoma zasobami:

- **MP** opłaca magię. Wynosi 8 plus dwukrotność Magic i nie odnawia się podczas walki.
- **Stamina** (ST) opłaca wszystko inne. Wynosi 10 plus Strength plus połowa Speed. Część odnawia się co turę, a więcej w turze poświęconej na obronę.

Te same statystyki są używane w testach umiejętności poza walką. Zobacz [Testy umiejętności](#skill-checks).

<a id="levels-and-experience"></a>

## Poziomy i doświadczenie

**Doświadczenie.** Wygrana walka daje doświadczenie za każdego pokonanego przeciwnika, w tym takiego, który się poddał albo uciekł. Połowa jest dzielona równo między wszystkich uczestników walki, a druga połowa według wkładu każdej postaci: obrażeń, leczenia i wsparcia. Przeciwnicy poniżej poziomu postaci dają mniej doświadczenia, a powyżej jej poziomu więcej. Postać poniżej średniego poziomu drużyny dostaje dodatkowo połowę tej wartości. Przegrana walka lub ucieczka nie daje nic.

**Poziom postaci.** Każde 100 punktów doświadczenia daje poziom, maksymalnie do 30. Panel końcowy ekranu walki **What the party gained** (co zdobyła drużyna) pokazuje doświadczenie, każdy zdobyty poziom i statystyki, które wzrosły.

**Poziom klasy.** Aktywna klasa dostaje tyle samo doświadczenia na poczet własnego poziomu klasy. Klasa trenowana poniżej połowy poziomu postaci dostaje podwójne doświadczenie, dzięki czemu klasa podjęta później nadrabia zaległości. Statystyki postaci wynikają z aktywnej klasy na jej poziomie klasy: na każdym poziomie klasy losowany jest wzrost każdej statystyki zgodnie z rozwojem klasy i ukrytymi predyspozycjami postaci, a za każdym razem rosną co najmniej dwie statystyki.

Oznacza to, że nowo podjęta klasa zaczyna z możliwościami poziomu 1. Przełącz się na świeżą klasę między walkami, na które możesz sobie z nią pozwolić, a gdy potrzebujesz wypracowanej siły, wróć do poprzedniej.

**Awans klasy.** Gdy klasa osiąga poziom klasy 10, otwierają się jej klasy zaawansowane; na poziomie klasy 20 otwiera się klasa mistrzowska. Panel końcowy pokazuje **A promotion is open** (dostępny awans klasy). Awansuj na zakładce **Classes**, wybierając **Promote to** (awansuj do) i nazwę klasy. Klasa po awansie zaczyna na poziomie klasy swojego poprzednika, dostaje jednorazową premię do statystyk i wypełnia wolne miejsca na przeniesione umiejętności aktywnymi umiejętnościami klas, z których powstała.

Tempo rozwoju jest ukryte. Po włączeniu opcji **Debug** (debugowanie) zakładka **Status** pokazuje dokładną szansę wzrostu każdej statystyki.

<a id="switch-classes-and-carry-skills"></a>

## Zmienianie klas i przenoszenie umiejętności

Klasy zmienia się poza walką, na zakładce **Classes**. Wybierz klasę, żeby zobaczyć jej umiejętności i to, co postać straci po zmianie, a następnie wybierz **Take up** (podejmij), jeśli postać jeszcze nie szkoliła się w tej klasie, albo **Switch to** (przełącz na), jeśli szkoliła się w niej wcześniej i zachowała osiągnięty poziom klasy.

Postać korzysta tylko z umiejętności swojej aktywnej klasy oraz maksymalnie czterech umiejętności **przeniesionych** z innych klas, w których się szkoliła. Wybierz je na zakładce **Skills** w sekcji **Carry from other classes** (przenieś z innych klas). Przeniesiona umiejętność korzysta z własnych statystyk postaci. Niektóre umiejętności należą do całego drzewka, na przykład Cover klasy Guard, i każda klasa z tego drzewka zachowuje je bez zajmowania miejsca. Gdy zmiana klasy usunęłaby używaną umiejętność, arkusz najpierw ostrzega, aby można ją było przenieść.

<a id="the-character-sheet"></a>

## Arkusz postaci

Otwórz arkusz członka drużyny z panelu **Character Profiles**. Ma cztery zakładki:

- **Status** (stan): poziom, doświadczenie, aktywna klasa, statystyki z uwzględnieniem wyposażenia oraz HP, MP i Stamina na początku walki. Pole **Row** (szereg) ustala, czy postać stoi w przednim, czy tylnym szeregu w walkach Turn-Based. Każda klasa ma ustawienie domyślne.
- **Classes**: dwa drzewka i wszystkie ich klasy wraz z informacją o tym, co jest odblokowane, czego wymaga każda klasa i jak przebiegają awanse klas.
- **Skills**: umiejętności aktywnej klasy i umiejętności przeniesione wraz z ich kosztami.
- **Gear** (wyposażenie): miejsce na **Weapon** (broń), **Armour** (pancerz) i dwa **Accessory** (akcesoria), wypełniane tym, co niesie drużyna i czego może używać klasa. Każdy przedmiot pokazuje swoje statystyki przed założeniem. Postać z pustym miejscem na broń albo pancerz walczy standardowym przedmiotem swojej klasy odpowiednim dla poziomu.

Broń decyduje o statystykach ataku: kostur, różdżka albo magiczny katalizator uderza z Magic przeciwko Resistance, a każda inna broń ze Strength przeciwko Defense.

**Oswojeni towarzysze.** Tracker może oswoić w walce osłabioną dziką bestię. Trafia ona do jego towarzyszy widocznych na zakładce **Status**, których może być maksymalnie osiem. Aktywny towarzysz podnosi statystykę, w której jest najlepszy, gdy aktywna jest klasa Tracker albo Huntsmaster; premia jest większa dla bestii na wyższym poziomie i bestii elite. Gdy stajnia jest pełna, wypuść jedną bestię, żeby zatrzymać nową. Towarzyszy zmienia się poza walką.

**Trwała śmierć.** Gdy opcja **Permadeath** (trwała śmierć; opcja konfiguracji w kroku **World** kreatora, domyślnie wyłączona) jest włączona, członek drużyny, który padnie w walce i nie zostanie uratowany przed jej końcem, przepada na zawsze. Gdy jest wyłączona, polegli wstają po walce.

<a id="skill-checks"></a>

## Testy umiejętności

Testy poza walką korzystają ze statystyk MRPG postaci, które daje jej aktywna klasa. Każda umiejętność opiera się na jednej statystyce, na przykład Stealth na Speed, a Persuasion na Luck. Pełną listę i premię zapewnianą przez każdą statystykę znajdziesz w przewodniku [Rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md#how-the-result-is-decided).

<a id="new-party-members-and-shared-games"></a>

## Nowi członkowie drużyny i gry współdzielone

**Osoba dołączająca do trwającej gry.** Towarzysz, który dołącza po rozpoczęciu gry, wchodzi do niej na poziomie nadanym przez Game Master. Większość zaczyna na niskim poziomie, ale doświadczony wojownik może zacząć blisko poziomu drużyny. Game Master może też dać mu szybszy rozwój niektórych statystyk, jeśli ma surowy talent i szybko nadrobi zaległości, albo lepsze statystyki początkowe, jeśli już wiele potrafi. Nowa osoba, o której Game Master nic nie powie, zaczyna na poziomie 1.

**Goście w grze współdzielonej.** Każdy gość tworzy własną postać, gdy dołącza do pokoju: nadaje jej nazwę, opisuje ją, podaje **koncepcję postaci** dla mistrza gry oraz dokonuje tych samych wyborów w sekcji **Game Mode** co na karcie (drzewko początkowe, mocne statystyki i słaba statystyka). Wybranie jednej ze swoich person uzupełnia te pola jej danymi. W koncepcji powiedz mistrzowi gry, kim jest twoja postać i jak ma wejść do historii. Game Master wpisuje postać w historię i wybiera jej siostrzane drzewko.

- **Nowa gra.** Wszyscy – gospodarz i goście – zaczynają na poziomie 1.
- **Trwająca gra.** Game Master ustala też poziom początkowy, rozwój i statystyki gościa, tak jak w przypadku każdego nowego członka drużyny.
- **Powracający gość.** Po wyjściu gościa jego postać pozostaje w grze wraz ze swoim poziomem, wyposażeniem i oswojonymi bestiami. Pod nieobecność gracza postać nie bierze udziału w walkach, nie zdobywa doświadczenia i jest pomijana w scenach. Po powrocie gość gra tą samą postacią na poziomie, na którym ją zostawił.

Testy umiejętności każdego gracza korzystają ze statystyk jego własnej postaci.

<a id="move-a-legacy-game-to-mrpg"></a>

## Przenoszenie gry Legacy do MRPG

Gra Legacy zachowuje swoje arkusze Legacy tak długo, jak chcesz. Aby ją przenieść, otwórz **Journal** (dziennik), a na zakładce **All** (wszystko) znajdź kartę **MRPG classes** (klasy MRPG). Wybierz **Upgrade** (ulepszenie).

Dla każdego członka drużyny karta pokazuje:

- **Class** (klasa). Drzewko początkowe, uzupełnione na podstawie wyboru na karcie z biblioteki albo, jeśli go nie ma, klasy Legacy. Możesz je zmienić.
- **Sister tree** (siostrzane drzewko). Drzewko otwierane przez temperament postaci. Postać, która nie ma jeszcze temperamentu, podczas ulepszania otrzymuje temperament odczytany ze swojego opisu.
- **Gear** (wyposażenie). Każda broń i część pancerza Legacy noszona przez postać oraz element MRPG, w który się zmieni. Wyczyść pole wyboru, aby pozostawić dany element bez zmian.

Po potwierdzeniu przyciskiem **Upgrade the party** (ulepszenie drużyny):

- Każdy członek drużyny zaczyna na poziomie 10, czyli najwyższym poziomie swojej klasy początkowej, ze statystykami z każdego poziomu wylosowanymi tak jak przy zdobywaniu poziomu. Pierwszy awans klasy jest od razu dostępny.
- Klasa na jego karcie zmienia się w klasę MRPG. Klasa i zdolności Legacy trafiają do notatki **Before the upgrade** (przed ulepszeniem) na karcie, dzięki czemu fabuła nadal je zna. Statystyki Legacy także pozostają na karcie, ale testy i walki już z nich nie korzystają.
- Każda zaakceptowana broń lub część pancerza zmienia się w swój odpowiednik MRPG i zachowuje nazwę, a postać zakłada ją, jeśli pozwala na to jej klasa.

> **Ostrzeżenie:** Ulepszenie jest jednokierunkowe. Gra przeniesiona do klas MRPG nie może wrócić do arkuszy Legacy.

Ulepszenie nie jest dostępne podczas walki. Najpierw zakończ walkę. Gry rozgrywanej z zestawem zasad nie można ulepszyć: zachowuje arkusze swojego zestawu zasad.

<a id="related-guides"></a>

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Kolory postaci i Statystyki Roleplay](../characters/colors-and-stats.md)
