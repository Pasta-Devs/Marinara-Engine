# Game Mode: pierwsze kroki

Game Mode zmienia aplikację Marinara Engine w jednoosobową grę fabularną prowadzoną przez postać Game Master sterowaną przez AI. Z tego przewodnika dowiesz się, czym jest Game Mode i co trzeba przygotować przed startem. Dalej krok po kroku omawia kreator konfiguracji i pokazuje, gdzie znaleźć każdy element rozgrywki. Przeczytaj to raz, zacznij grę, a po szczegóły sięgnij do linków na końcu.

## Czym jest Game Mode

Game Mode to jeden z trybów czatu w aplikacji Marinara Engine. Pozostałe to Conversation i Roleplay.

W trybie Game Mode historię prowadzi postać Game Master (GM) sterowana przez AI, czyli mistrz gry. To AI opowiada o świecie, wciela się w każdą spotkaną postać i decyduje, co stanie się dalej. Działa jak Dungeon Master przy stole.

Aplikacja sama pilnuje stanu gry przez kolejne tury. Obejmuje to mapę, drużynę, postacie niezależne (NPC), przedmioty, zadania, czas w świecie gry i pogodę. Rozgrywka toczy się przez wiele tur. Długą grę da się podzielić na kilka **sesji**, tak jak drużyna przy stole dzieli kampanię na kolejne wieczory. Kampania to cała ciągnąca się historia.

Nie trzeba używać każdej mechaniki. Część graczy pomija walkę i kości, a Game Mode traktuje jako wizualną zabawę fabularną. Systemy RPG czekają wtedy, aż przyjdzie na nie ochota.

## Zanim zaczniesz

Do rozpoczęcia gry potrzebna jest tylko jedna rzecz: połączenie z dostawcą AI dla postaci GM. Dzięki połączeniu aplikacja Marinara Engine sięga do dostawcy AI i może generować tekst. Jeśli nie ma jeszcze żadnego połączenia, zajrzyj do przewodnika [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Cała reszta jest opcjonalna i domyślnie wyłączona. Te elementy można dodać później:

- **Generowanie obrazów.** Game Mode ma wizualny układ ekranu z tłami i grafikami postaci. Do jego wypełnienia potrzebne jest połączenie do generowania obrazów. Ustawienie **Visual Generation** (generowanie grafiki) w kreatorze jest domyślnie wyłączone, więc trzeba włączyć je samodzielnie. Bez niego nadal działa historia, śledzenie stanu i walka, ale obszary wizualne pozostają puste.
- **Model lokalny do efektów scenicznych.** Marinara Engine potrafi uruchomić mały model na twoim komputerze, opisany jako **Local Model (Gemma)**. Podpowiada on tła i muzykę bez dodatkowych kosztów. W kreatorze jest wyborem domyślnym. Zobacz [Konfiguracja modelu Local Model](../connections/local-model.md).
- **Agent Storyboard.** Zainstaluj go z **Agents > Download Agents**, a potem włącz w gotowej grze w panelu **Chat Settings > Agents** (ustawienia czatu), kiedy potrzebne są nieruchome albo animowane storyboardy.
- **Połączenie do generowania wideo.** Przydaje się wyłącznie przy filmach ze scen i animowanych storyboardach.
- **Muzyka.** Agent **Music DJ** potrafi puszczać muzykę w grze. Wymaga usługi Spotify albo lokalnego folderu z muzyką i jest domyślnie wyłączony.

## Kreator konfiguracji

Przy tworzeniu czatu w trybie Game Mode otwiera się **kreator konfiguracji**. Ma siedem kroków. Jedyne wymagane pole to połączenie dla postaci GM w pierwszym kroku. Każde inne pole ma rozsądną wartość domyślną. Przez kreator da się przejść szybko, a resztę uzupełni aplikacja Marinara Engine.

Siedem kroków wygląda tak:

1. **Connection.** Wybierz **Game Mode**: **Overworld RPG** albo **Classic**. Overworld RPG nie jest jeszcze gotowy, więc na razie nowe gry zaczynają się jako **Classic**. Zobacz [Classic czy Overworld RPG](#classic-or-overworld-rpg). Ustaw nazwę gry, wybierz połączenie dla postaci GM i opcjonalnie połączenie do efektów scenicznych. Efekty sceniczne domyślnie korzystają z opcji **Local Model (Gemma)**.
2. **World.** Ustaw gatunek, realia, ton, poziom trudności, klasyfikację treści i język. Pomysły podsuwane przy realiach, a później przy celach, pochodzą z różnych rodzajów settingu, za każdym otwarciem kreatora w nowym zestawieniu. Wybierz **Classic** (walka z menu) lub **Tactical** (walka na siatce) w polu **Combat Preference** (preferowany rodzaj walki). Gry Tactical oferują też opcjonalne ziarno pola bitwy, rozmiar i wskazówki dotyczące terenu. Gdy jest zainstalowany zestaw zasad Game Mode, niżej pojawia się **Rules**: pozostaw **Marinara's own rules** albo wybierz zestaw. Zobacz [Wybór zasad](#choosing-rules). W grze Overworld RPG niżej znajdują się **Setting kit** (zestaw settingu) i **Your world** (twój świat). Zobacz [Wybór zestawu settingu](#choosing-a-setting-kit) i [Tworzenie świata](#making-a-world).
3. **Party.** Wybierz personę (postać, w którą się wcielasz), tryb **Game Master Mode** oraz członków drużyny. **GM intro message** (wiadomość otwierająca GM) ustala pierwszą wiadomość gry. Zobacz [Wiadomość otwierająca GM](#the-gm-intro-message).
4. **Goals.** Powiedz postaci GM, czego oczekujesz od przygody.
5. **Lorebooks.** Podłącz lorebooki, których fakty postać GM ma traktować jako kanon. Lorebook to zbiór faktów o twoim świecie. Zobacz [Lorebooki](../lorebooks/overview.md).
6. **Features.** Włącz opcjonalne systemy, takie jak Visual Generation, Music DJ i widgety HUD. Agentów do zainstalowania da się włączyć w panelu Chat Settings po utworzeniu gry.
7. **GM.** Wybierz styl prezentacji i przejrzyj zaawansowane instrukcje dla postaci GM, zanim świat powstanie.

Na koniec kliknij przycisk **Start Game** (rozpoczęcie gry).

W grach Tactical puste opcje pola bitwy pozwalają postaci GM dobrać opis do sceny, a silnikowi wygenerować planszę. Stałe ziarno pozwala odtworzyć wynik dla tych samych danych starcia; wskazówki dotyczące terenu proszą postać GM o elementy takie jak zrujnowana ściana czy polana. Zasady ruchu, premie terenu i błędy generowania opisuje przewodnik [Game Mode: walka](combat.md#tactical-battles-and-terrain).

<a id="classic-or-overworld-rpg"></a>

### Classic czy Overworld RPG

Nowa gra toczy się w jednym z dwóch trybów Game Mode, wybieranym w pierwszym kroku i zachowywanym we wszystkich sesjach gry:

- **Overworld RPG** (wartość domyślna, gdy będzie gotowy): świat stworzony dla twojego settingu, przemierzany na mapie świata, z miastami do odwiedzenia, miejscami do zbadania i lochami, do których można zejść. Wymaga zestawu settingu i świata; dopóki nie wybierzesz zestawu, używany jest zestaw dla pierwszego wybranego gatunku (High fantasy dla gatunku, który nie ma własnego), a świat jest dla niego losowany.
- **Classic**: Game Mode w dotychczasowej postaci. Historia toczy się scena po scenie, z mapą sceny i walkami, bez zestawu settingu, świata, mapy świata, miast i map lochów.

Gra utworzona, zanim pojawił się ten wybór, działa tak jak dotąd: ze światem jest grą Overworld, bez świata – grą Classic.

Overworld RPG jest jeszcze w trakcie dopracowywania. Dopóki nie jest gotowy, jego karta jest wyszarzona z informacją "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games." Każda nowa gra jest wtedy grą Classic, a opisane niżej wybory zestawu settingu i świata się nie pojawiają. Opisują one gry Overworld RPG.

<a id="choosing-rules"></a>

### Wybór zasad

Pole **Rules** (zasady) pojawia się tylko wtedy, gdy jest zainstalowany przynajmniej jeden zestaw zasad, i tylko przy nowej grze. Jest niezależne od **Combat Preference**: jedno decyduje o działaniu testów i arkuszy postaci, drugie o tym, jak pokazywana jest walka.

- **Marinara's own rules** (własne zasady aplikacji Marinara Engine) to wartość domyślna: wbudowane testy d20 i arkusz sześciu atrybutów.
- Zestaw zasad, na przykład **5e (SRD 5.1)**, pokazuje krótkie podsumowanie tego, co obejmuje, oraz jedną linię o tym, jak będą przebiegać walki. Zestaw, który sam rozstrzyga walki, mówi o tym. Zestaw, który tylko udostępnia arkusz, informuje, że walki korzystają z systemu walki aplikacji Marinara Engine ze zdrowiem, energią i zdolnościami z arkusza. Zestaw, który nie robi żadnej z tych rzeczy, informuje, że walki korzystają z systemu walki aplikacji Marinara Engine, i podaje wybrane **Combat Preference**.

Gdy zestaw sam rozstrzyga walki, ekran walki należy do tego zestawu: menu to ataki i zdolności twojej postaci, każda z informacją, co zużywa z ekonomii akcji i pul zestawu; panel poniżej pokazuje kolejność tur, rundę, stany wszystkich uczestników pod nazwami z zestawu i to, co zostało z każdego budżetu; a dziennik wypisuje rzeczywiste obliczenia, na przykład "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Każde działanie zapisuje się w arkuszu postaci w chwili, gdy dochodzi do skutku, więc zamknięcie karty przeglądarki w trakcie walki niczego nie gubi, a postać Game Master dostaje potem informację, że liczby są już rozstrzygnięte. Jeżeli zestaw określa też, ile jest warte jedno pole planszy we własnej jednostce odległości, o sposobie pokazania walki decyduje **Combat Preference**: **Classic** rozgrywa ją bez pozycji, a **Tactical** na planszy, po której chodzisz, mierzysz zasięg w jednostkach zestawu i celujesz kształtem w pole. Zobacz [Game Mode: walka](combat.md#games-whose-ruleset-resolves-its-own-fights). Zestaw, który nic nie mówi o odległości, zachowuje preferencję, ale z niej nie korzysta.

Zestaw zasad ustala się przy tworzeniu gry i zostaje on przy tej grze. Nie da się go później zmienić ani dodać.

Niektóre zestawy oferują **layers** (warstwy): nazwane warianty, na przykład Low magic albo Hard winter, pokazywane jako przełączniki pod zestawem, z linią opisującą działanie każdego z nich. Warstwa może zaostrzyć trudności, zawęzić wybór w arkuszu postaci, pominąć część gotowych wpisów w selektorze edytora arkusza i dać postaci Game Master dodatkowe instrukcje, także dotyczące świata budowanego przy konfiguracji. Niektóre warstwy się wykluczają, a kreator wyłącza tę, której nie można wybrać. Po rozpoczęciu gry warstwy są ustalone, dokładnie tak jak sam zestaw, a arkusz, który już używa czegoś odebranego przez warstwę, zachowuje to.

Zestawy zasad pochodzą z dwóch miejsc. Oficjalne instaluje się z **Download Agents**, gdzie mają oznaczenie **Rules**. Zestawy społeczności importuje się z pliku albo z repozytorium GitHub autora i są zapisywane pod nazwą źródła, na przykład `local/ember-roads` albo `alice/v20`. Import korzysta z tego samego przełącznika **Allow custom Agent imports** co importowani agenci. Gdy ten przełącznik jest wyłączony, zaimportowane zestawy są pomijane w nowych grach, a gry, które już z nich korzystają, działają dalej. Gra na zaimportowanym zestawie zawsze korzysta z dokładnie tej wersji, z którą powstała. Pisanie własnego zestawu opisuje przewodnik [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md).

Po wybraniu zestawu krok **Party** pokazuje pod selektorami twoją personę i członków drużyny oraz informuje, kto **Has a sheet** (ma arkusz) dla tego zestawu, a kto **Starts on a blank sheet** (zaczyna z pustym arkuszem). Arkusz dodaje się w sekcji **Stats** w edytorze postaci lub persony (zobacz [Arkusze zestawów zasad](../characters/colors-and-stats.md#ruleset-sheets)). Gra kopiuje każdy arkusz przy generowaniu świata. Nic, co zmienisz w grze, nie wraca do postaci ani persony. Członek drużyny bez arkusza dostaje pusty arkusz z każdą wartością ustawioną na domyślną wartość zestawu; generowanie świata nigdy nie wymyśla wyników.

Udostępniony plik konfiguracji zapamiętuje swój zestaw zasad. Jeśli go zaimportujesz, a nie masz tego zestawu albo masz jego starszą wersję, kreator informuje, o jaki zestaw chodziło, a gra korzysta z własnych zasad aplikacji Marinara Engine, chyba że go zainstalujesz i wybierzesz.

<a id="choosing-a-setting-kit"></a>

### Wybór zestawu settingu

**Setting kit** (zestaw settingu) daje postaci Game Master słownictwo, którym opisany jest twój rodzaj świata: jak nazywają się jego miejsca i jak duża może być osada, jakie ma rodzaje grup, z czego może słynąć dane miejsce, jak podróżują ludzie, jak nazywa się rok i dzień, jak jego ludy nazywają same siebie, co może wypaść z wygranej walki, jego pieniądze i codzienne towary na sprzedaż, jego żywioły, miejsca, w których toczą się walki, oraz z jakiej rodziny grafiki, muzyki i dźwięków korzysta (zobacz [Zasoby gry](game-assets.md#a-settings-own-art-and-music)). Określa też, jakie rodzaje zmian zachodzą w świecie, na przykład rywalizacje, przestępczość, wojny albo katastrofy, i jak szybko świat zmienia się sam z siebie. Wyłączony rodzaj zmian nigdy nie pojawia się jako wydarzenie w tle, a scena nie eskaluje w jego stronę, więc kłótnia może pozostać kłótnią.

Zestaw jest dostępny tylko przy nowej grze Overworld RPG, która zawsze go ma: dopóki nie wybierzesz zestawu, używany jest zestaw dla pierwszego wybranego gatunku. Na start jest osiem zestawów: high fantasy, wuxia i xianxia, współczesność, współczesność z elementami nadprzyrodzonymi, lata dwudzieste XX wieku, cyberpunk, space opera i postapokalipsa. Współczesność jest domyślnie łagodna, bez przestępczości, konfliktów i katastrof, w wolnym tempie, do opowieści o codziennym życiu (slice of life).

Wybór zestawu, zanim wybierzesz gatunek, ustawia pasujący gatunek, na przykład **Cyberpunk** dla cyberpunku albo **Wuxia** dla wuxia i xianxia, a pomysły na realia i cele zaczynają się wtedy od pomysłów z zestawu. Gatunek wybrany samodzielnie pozostaje bez zmian.

Po wybraniu zestawu przycisk **Write it for my setting** (dopasowanie do mojego settingu) prosi połączenie postaci Game Master o przepisanie go pod wybrany gatunek, realia i ton. Jeśli to, co napisze model, nie jest spójne, model dostaje jeszcze jedną prośbę z podanymi powodami, a potem kreator informuje, co było nie tak, i zachowuje dotychczasowy zestaw. **Change its words** (zmiana słownictwa) otwiera do edycji każde słowo zestawu. Listę wpisuje się w jednej linii, oddzielając elementy przecinkami. Zestaw z problemem, na przykład z pustą nazwą albo bez osad, informuje, co jest nie tak, a gry nie da się rozpocząć, dopóki problem nie zostanie naprawiony.

Gra zachowuje zestaw, z którym ją utworzono. Postać Game Master czyta go w każdej turze, a generowanie świata korzysta z jego słownictwa. Udostępniony plik konfiguracji również zawiera zestaw.

Experience może dostarczać własny **map pack** (pakiet map): zestaw settingu, gotowe mapy i własne kafelki. Gdy to Experience jest włączone, konfiguracja pokazuje jego zestaw jako ustawiony (bez wyboru zestawu), a jeśli dostarcza mapy – pole **Map** (Mapa) do wyboru; gra toczy się na tej mapie i jest rysowana kafelkami tego Experience. Wyłączenie Experience przywraca twoje własne wybory.

**Download this kit** (pobranie zestawu) zapisuje zestaw jako plik (`.worldkit.json`) do udostępnienia, a **Import a kit file** (import pliku zestawu) wczytuje go z powrotem. **Import a world file** (import pliku świata) wczytuje od razu cały świat (zobacz niżej).

<a id="making-a-world"></a>

### Tworzenie świata

Po wybraniu zestawu settingu sekcja **Your world** (twój świat) rozkłada przed startem gry cały świat w słownictwie zestawu: jego regiony, osady każdej wielkości ze skali zestawu, to, z czego słynie każde miejsce, oraz szlaki między nimi (drogi, rzeki, szlaki morskie, korytarze skokowe) wraz z liczbą dni każdej podróży. Każda nowa gra Overworld RPG ma taki świat, wylosowany z ziarna, które można zmienić.

Świat powstaje z pola **World seed** (ziarno świata). To samo ziarno, zestaw i opis świata zawsze dają ten sam świat, więc **Roll** (losowanie) daje inny, a wpisanie liczby z powrotem przywraca dawny. Podgląd pod spodem to świat, w którym będzie toczyć się gra: mała mapa terenu i osad, miejsce startu drużyny oraz lista wszystkich osad według regionów.

- **Start from this lore** (rozpoczęcie od tego lore) odczytuje z zaznaczonych lorebooków podane w nich miejsca i zapisane w nich datowane wydarzenia, każde dokładnie tak, jak mówi lore, razem z wpisami, z których pochodzi. **Build around the lore** (budowanie świata wokół lore) uzupełnia świat wokół nich; **Only the lore's places** (tylko miejsca z lore) nie tworzy niczego poza nimi.
- **Write the world's brief** (napisanie opisu świata) prosi połączenie postaci Game Master o resztę: teraźniejszość w chwili rozpoczęcia gry, najważniejsze miejsca, grupy, wokół których toczy się teraźniejszość (czego chce każda z nich, kto jest jej sojusznikiem, a kto rywalem), oraz nazwy miejsc i ludzi rysowanych przez świat, zgodne z brzmieniem i szykiem nazw każdego z ludów zestawu. Miejsca z lore zostają zachowane bez względu na to, co napisze model, a wszystko, co nie pasuje do zestawu, jest pomijane i liczone, podobnie jak kilka nazw, po które modele sięgają w kółko. **Change the brief** (zmiana opisu świata) otwiera jego słowa do edycji, łącznie z imionami i nazwiskami każdego ludu.

Bez opisu świata świat to sam zestaw i miejsca z lore, a rysowane przez niego miejsca są numerowane, dopóki opis nie nada im nazw.

Świat ma też przeszłość. Przed rozpoczęciem gry własny silnik świata przewija ją rok po roku od założenia: każda osada zostaje założona i rośnie do obecnej wielkości, grupy z opisu powstają w swoich siedzibach, zyskują i tracą przywódców, zbliżają się do siebie i skłócają, a tam, gdzie świat je ma, bandyci, wojny i klęski głodu zostawiają ślady, a niektóre miejsca przez nie przepadają. Poważna zmiana przychodzi dopiero po tym, jak przez jakiś czas narastała (napięcie przed wojną, susza przed głodem), i korzysta tylko z rodzajów zmian, na które pozwala zestaw: przeszłość łagodnego świata też jest łagodna. Datowane wydarzenia podane w twoim lore albo wymienione w opisie świata dzieją się wtedy i tam, gdzie mówią. To samo ziarno i opis zawsze dają tę samą przeszłość.

Postać Game Master dowiaduje się o najważniejszych wydarzeniach z przeszłości, o tym, która grupa sprawuje władzę nad miejscem, w którym jest drużyna, i kto jej przewodzi, oraz o przeszłości samego tego miejsca. O każde inne miejsce albo grupę może zapytać i dostaje odpowiedź w następnej turze.

Każda osada ma swoich mieszkańców, losowanych z ziarna, gdy drużyna tam dotrze: więcej w większych miejscach, każdy z imieniem z listy własnej kultury, zajęciem pasującym do tego, z czego słynie miejsce, temperamentem, tym, na czym mu zależy, sposobem mówienia i wyglądem, a część z nich przybyła skądinąd. Postać Game Master widzi kilka osób z bieżącego miejsca, których drużyna jeszcze nie poznała, i wprowadza jedną z nich, gdy na scenie pojawia się ktoś nowy. Osoba, którą Game Master nazwie pełnym imieniem, dołącza do śledzonych postaci gry razem z tym, czym się zajmuje i jak wygląda, dzięki czemu dwie osoby o tym samym imieniu da się odróżnić. Bez list imion z opisu świata ludzie występują pod nazwą swojego zajęcia.

W trakcie gry postać Game Master zawsze wie, gdzie jest drużyna, dokąd może się stamtąd udać i ile trwa każda droga. Miejsce, do którego idzie drużyna, wskazuje znacznikiem miejsca. Miejsce wymienione przez świat zachowuje wielkość nadaną mu przez świat. W zestawie zasad z rynkami dostaje też odpowiadającą wielkość na skali rynku, więc stolica świata jest największym miejscem rynku. Miejsce, którego świat nie wymienia, na przykład zagroda albo obóz, zachowuje nazwę nadaną przez Game Master. Po rozpoczęciu gry przeszłość świata jest ustalona. Jego układ też, z wyjątkiem ręcznych zmian (zobacz niżej). Udostępniony plik konfiguracji zawiera świat w postaci, w jakiej pierwotnie powstał.

To, co drużyna zrobi światu, pozostaje. Gdy drużyna pomoże jakiejś grupie albo jej zaszkodzi, sprawi, że dwie grupy zostaną przyjaciółmi lub wrogami, stanie po stronie grupy albo ją zdradzi, poprawi albo zniszczy jakieś miejsce, zdobędzie miejsce dla grupy, zniszczy grupę, postawi kogoś na czele grupy albo doprowadzi miejsce do ruiny, postać Game Master zapisuje to w swojej odpowiedzi, tak samo jak miejsce lub grupę wprowadzoną przez opowieść. Każda taka zmiana jest sprawdzana względem świata: zmiana rodzaju wyłączonego w zestawie, na przykład wojna w przytulnym świecie współczesnym, albo zmiana dotycząca miejsca lub grupy, których świat nie ma, jest odrzucana. Od tej chwili postać Game Master dostaje świat w stanie, w jakim zostawiła go opowieść: jak się ma dane miejsce, kto nim rządzi i kto im przewodzi, co zrobiła tam drużyna, jaką pozycję ma drużyna u każdej grupy, z którą miała do czynienia, i co się zmieniło od początku gry. Miejsce dodane przez opowieść jest miejscem, do którego drużyna może się udać. Zmiana należy do odpowiedzi, która ją wprowadziła, więc swipe, ponowne wygenerowanie albo usunięta wiadomość cofają ją razem z tą odpowiedzią.

Świat żyje też bez drużyny. Gdy postać Game Master mówi, że mija czas (podróż, nocny odpoczynek, długie czekanie), świat wykonuje własne kroki, po tygodniu naraz, i tylko w rodzajach zmian, które ma zestaw: majątki rosną i maleją, osiedlają się przybysze, grupy zbliżają się do siebie albo stają się rywalami, przywódcy ustępują, a tam, gdzie świat je ma, kłopoty spadają na podupadające miejsca, a napięcie między dwiema grupami może po sezonie narastania przerodzić się w wojnę. Katastrofy nigdy nie przychodzą same; tylko postać Game Master może opowiedzieć o katastrofie, tak jak o każdym wydarzeniu poza drużyną, które jest odrzucane, jeśli jego rodzaj jest wyłączony. Nic nie rozstrzyga się tam, gdzie jest drużyna: to, co ma się tam wydarzyć, zostaje do rozegrania w scenie. Wieści podróżują: postać Game Master dowiaduje się o zmianie, gdy miną dni potrzebne na drogę, jako o plotce z daleka, i widzi, co się szykuje w pobliżu, więc drużyna może się wtrącić. Może wstrzymać szykującą się wojnę tylko wtedy, gdy nie ma ona sensu dla świata albo zrujnowałaby grę bez realnej szansy, by drużyna ją powstrzymała. Czyny drużyny ważą tym więcej, im bardziej jest znana: pomoc nieznajomych zmienia niewiele, pomoc słynnej drużyny – bardzo dużo.

Świat może też zachowywać **hand edits** (ręczne zmiany). To zmiany wprowadzone w edytorze świata, czyli narzędziu, które zmienia świat po jego utworzeniu. Możesz zmieniać nazwy miejsc i je przenosić, malować teren oraz dodawać miejsca i ludzi. Możesz też namalować taktyczne pole bitwy dla miejsca (zobacz [Game Mode: walka](combat.md#tactical-battles-and-terrain)) i ręcznie ułożyć miasto (zobacz [Miasto](map-time-weather.md#the-town)). Każda część gry widzi zmiany od razu: postać Game Master, mapa świata, miasta i zakładka World. Miejsce o zmienionej nazwie nadal reaguje na starą nazwę, a postać Game Master dowiaduje się, jak się kiedyś nazywało.

Ręczne zmiany zmieniają świat od teraz, nigdy jego przeszłość. Historia świata i zmiany, które wprowadził sam, pozostają takie, jakie były. Dodana przez ciebie osada pozostaje taka, jaką ją dodano. Miasto zachowuje swój układ, więc dodane miejsca i ludzie trafiają na jego następne wolne działki budowlane i do następnych wolnych domów.

Świat może podróżować jako plik. **Download this world** (pobranie tego świata) w sekcji **Your world** zapisuje tworzony świat, a **Download the world** (pobranie świata) na zakładce World gry zapisuje świat tej gry, łącznie z ręcznymi zmianami, jako plik `.world.json`. **Import a world file** (obok zestawu settingu) wczytuje taki plik do konfiguracji nowej gry: wybiera zestaw settingu z pliku i tworzy jego świat z ręcznymi zmianami. **Your worlds** (twoje światy) robi to samo ze światem przechowywanym w twojej bibliotece, na przykład utworzonym poza jakąkolwiek grą w edytorze takim jak Pixelforge.

Plik świata może też zawierać **story** (fabułę) świata: wydarzenia i sceny napisane do niego przez twórcę. Fabuła przychodzi razem ze światem i jest przechowywana na tych samych zasadach. W trakcie gry sceny fabuły pojawiają się w narracji przed odpowiedzią postaci Game Master, dokładnie tak, jak je napisano. Cele zadań z fabuły są wymienione w sekcji **Story** (opowieść) na zakładce World dziennika, gdy fabuła je pokaże. Jak napisać fabułę, opisuje przewodnik [Pisanie skryptów fabuły Game Mode](../extending/writing-story-scripts.md).

Ręczne zmiany i fabuła powstały dla określonego ziarna i opisu świata, więc są pomijane, jeśli zmienisz którekolwiek z nich. Plik, którego nie da się odczytać, jest odrzucany, a kreator podaje powód. Plik świata zawiera też świat w postaci, w jakiej powstał, więc świat utworzony przez inną wersję generatora światów otwiera się dokładnie tak, jak go utworzono. Starszy plik bez tych danych jest odrzucany. Jeśli coś w pliku nie pasuje do zestawu settingu, zostaje pominięte, a kreator mówi, co to było.

Grze utworzonej bez świata, zanim pojawił się wybór trybu Game Mode, można później dodać świat, tylko jeśli tego chcesz: zakładka **World** (świat) dziennika oferuje **Make a world for this game** (utworzenie świata dla tej gry) z tymi samymi wyborami zestawu settingu i świata co przy nowej grze. Świat działa od następnej tury; wcześniejsze tury, mapa i ludzie w grze pozostają bez zmian. Dopóki Overworld RPG nie jest gotowy, przycisk jest wyszarzony z tą samą informacją co w konfiguracji.

Gra zachowuje swój świat w postaci, w jakiej powstał. Miejsca, ludzie, miasta i historia zapisują się razem z grą w chwili jej rozpoczęcia i przy każdym zapisie ręcznych zmian, więc aktualizacja, która zmienia sposób tworzenia światów, nigdy nie zmienia świata, w którym już toczy się gra. Nowa sesja, gałąź i wyeksportowany czat zachowują ten sam świat, a to, jak świat zmieniał się we wcześniejszych sesjach (majątki, władcy i wojny), zostaje zachowane tak, jak się rozegrało. Świat utworzony przez wcześniejszą wersję generatora światów działa dalej tak, jak go utworzono, ale nie da się go już edytować.

Gra ze światem otwiera się na **mapie świata** (overworld), czyli świecie narysowanym jako mapa pikselowa, na której możesz prowadzić drużynę od osady do osady drogami świata i wejść do miasta, w którym się znajduje; widok sceny jest o jedno przełączenie dalej. Zobacz [Mapa świata](map-time-weather.md#the-overworld).

<a id="the-gm-intro-message"></a>

### Wiadomość otwierająca GM

Pole **GM intro message** w kroku **Party** decyduje o tym, jak zaczyna się gra:

- **None** (brak, wartość domyślna): postać Game Master otwiera grę tak, jak uzna za stosowne.
- **Defined** (określona): wpisz pierwszą wiadomość dokładnie tak, jak ma brzmieć. Gra zaczyna się dokładnie od tej wiadomości, a jej ponowne wygenerowanie daje ten sam tekst.
- **Guided** (z przewodnikiem): opisz, jak ma wyglądać początek, na przykład gdzie się zaczyna, kto tam jest i co dzieje się najpierw. Postać Game Master pisze otwarcie na tej podstawie.

Tekst może mieć do 8000 znaków. Nie może zawierać podwójnych nawiasów klamrowych, a tekst **Guided** nie może też zawierać nawiasów kwadratowych. Pole informuje, gdy tekstu nie da się użyć. Fabuła świata może mieć własne wprowadzenie. Gdy fabuła je blokuje, pole pokazuje je z komunikatem "Set by this Experience and locked, so the game opens as its creator meant." i nie da się go zmienić.

### Wartości domyślne, które warto znać

Oto wartości startowe w krokach **World**, **Party** i **Features**. Każdą z nich można zmienić.

| Ustawienie | Domyślnie | Uwagi |
|---|---|---|
| Genre | Fantasy | Wybór wielokrotny, można też dopisać własne wpisy; zestaw settingu wybrany wcześniej ustawia własny gatunek |
| Tone | Heroic | Wybór wielokrotny |
| Difficulty | Normal | Casual, Normal, Hard lub Brutal; wyższe ustawienia zaostrzają walkę |
| Content Rating | SFW | SFW lub NSFW; NSFW tylko dopuszcza treści dla dorosłych, wcale ich nie wymusza |
| Language | English | W tym języku powstaje cały tekst w grze |
| Game Master Mode | Standalone GM | Standalone GM buduje postać GM za ciebie; Character GM robi postać GM z jednej z twoich kart |
| Visual Generation | Off | Włącz, aby mieć obrazy; wymaga połączenia do generowania obrazów |
| Game Presentation | Standard | **Storyboard Optimized** kształtuje narrację postaci GM promptem Storyboard Game Prompt; nie instaluje agenta Storyboard ani go nie włącza |
| Music DJ | Off | Wymaga usługi Spotify albo lokalnego folderu z muzyką |
| Custom HUD Widgets | On | Korzysta z widgetów stanu przygotowanych przez AI dla nowego świata |
| Start Muted | Off | Gra zaczyna się z wyciszonym dźwiękiem |

Pierwszy raz w trybie Game Mode? Zostaw opcję **Game Master Mode** na wartości **Standalone GM**. Marinara Engine zbuduje sprawiedliwą, lekko złośliwą postać GM, dzięki czemu można poznać tryb, zanim powstanie własna karta postaci GM.

W ostatnim kroku wybierz opcję **Storyboard Optimized**, jeśli tury postaci GM mają być pisane jak gotowe do sfilmowania sceny. Ta opcja wybiera do narracji postaci GM wbudowany preset **Storyboard Game Prompt**. Nie instaluje agenta Storyboard ani go nie włącza. Nie włącza też generowania obrazów ani wideo, nie zmienia wybranych połączeń i nie podmienia domyślnego planera ani formatera w agencie. Po utworzeniu gry zainstaluj i włącz agenta Storyboard osobno, a jego ustawienia klatek kluczowych, planera, obrazów i wideo skonfiguruj w **Chat Settings > Agents > Storyboards**.

Alternatywne zestawienie w stylu anime pozostaje dostępne po konfiguracji: wybierz **Anime Episode Director** dla planera animacji i **Anime Game Video** dla promptu wideo storyboardu.

Edytor **GM Prompt** pokazuje podgląd promptu obowiązującego dla wybranej prezentacji. Przy wybranej opcji **Storyboard Optimized** edytor wyświetla prompt Storyboard Game Prompt razem z makrem liczby klatek kluczowych. Nietknięty tekst oznacza, że nadal działa wbudowany preset. Edycja tworzy własny prompt, który zastępuje preset prezentacji.

## Trzy rodzaje zapytań do AI

Game Mode wysyła do AI trzy różne rodzaje zapytań. Ich znajomość pomaga zrozumieć, skąd biorą się koszty i błędy.

1. **Generowanie świata.** Dzieje się raz, po kliknięciu przycisku **Start Game**. Połączenie postaci GM zwraca jeden duży, uporządkowany dokument w formacie JSON. Ten dokument zawiera opis świata, mapę startową, postacie NPC, arkusze postaci twojej drużyny oraz widgety widoczne na ekranie. JSON to ścisły format tekstowy, który AI musi zwrócić bezbłędnie, inaczej gra go nie odczyta. To najbardziej wymagający krok i właśnie dlatego wybór modelu ma tu największe znaczenie.
2. **Tury rozgrywki.** Każda wysłana wiadomość buduje świeży prompt z aktualnym stanem gry. Potem postać GM opowiada dalszy ciąg i aktualizuje świat. Matematykę rund walki liczy sama aplikacja, a nie model, więc wyniki są uczciwe i spójne.
3. **Podsumowania sesji.** Po zakończeniu sesji postać GM pisze uporządkowane streszczenie i notatki o ciągłości. Na starcie nowej sesji powstaje krótka wiadomość pomostowa, żeby kolejny rozdział ruszył gładko. Starsze sesje są kompresowane do streszczeń, dzięki czemu długie kampanie nie przytłaczają modelu.

## Tryby adresowania: do kogo mówisz

Na pasku wpisywania, obok przycisku dołączania plików, jest mały przycisk z dymkiem. Jego podpowiedź brzmi **Choose who to address**. Ten przycisk decyduje o tym, do kogo trafia wiadomość, i ma trzy stany.

- Domyślnie wiadomość trafia do sceny. To zwykłe działanie w grze albo kwestia dialogowa. Postać GM i drużyna odpowiadają w ramach historii.
- Opcja **Talk to Party** dodaje znacznik `[To the party]` i kieruje wypowiedź wprost do towarzyszy. Użyj jej do rozmów taktycznych w stylu "What should we do here?". Ta opcja pojawia się tylko wtedy, gdy drużyna nie jest pusta.
- Opcja **Talk to GM** dodaje znacznik `[To the GM]` i zwraca się do postaci GM poza rolą. Użyj jej do pytań w rodzaju "Does my character know about the temple?" albo do próśb o zmianę tempa.

Aktywny tryb ma w menu znacznik **On**. Aby wyłączyć opcję **Talk to Party** albo **Talk to GM**, kliknij tę samą pozycję menu jeszcze raz. Wiadomości wracają wtedy do sceny.

<a id="optional-tool-planning-and-lore-searches"></a>

## Opcjonalne planowanie narzędzi i wyszukiwanie w lorebookach

Podczas gry otwórz **Chat Settings → Function Calling** (ustawienia czatu → wywoływanie funkcji). Opcja **Let the GM search lore** (pozwól postaci GM przeszukiwać lorebooki) umożliwia wyszukiwanie informacji według znaczenia bez włączania wszystkich pozostałych narzędzi opcjonalnych. Najpierw włącz wektoryzację odpowiednich lorebooków i zwektoryzuj ich wpisy. Wyszukiwanie uwzględnia włączone książki, foldery i przełączniki wpisów dla danego czatu. Korzysta ze skonfigurowanego połączenia do embeddingów i może wymagać dodatkowego zapytania do modelu.

W czatach Game wyszukiwanie w lorebookach przez narzędzia wymaga **Let the GM search lore**, nawet gdy **Enable Tool Use** jest włączone. Przy wyłączonej opcji `search_lorebook` jest niedostępne w selektorze narzędzi. Wcześniej wybrana pozycja pozostaje widoczna z wyjaśnieniem, aby można było ją usunąć lub ponownie włączyć wyszukiwanie lore.

Ustawienie **Game tool connection** (połączenie dla narzędzi gry) ma domyślną wartość **Same as narrator** (takie samo jak narrator), która zachowuje zwykłą pętlę narzędzi. Wybór innego połączenia uruchamia jedno osobne zapytanie planujące przed narracją. Ten model wybiera narzędzia, a narrator otrzymuje ich rzeczywiste wyniki jako tekst. Koszt dodatkowego zapytania obciąża wybrane połączenie; tańszy model może obniżyć koszty narzędzi, lecz wybrać inne narzędzia. Ten pojedynczy przebieg planowania nie może uruchomić drugiego wyszukiwania na podstawie pierwszego wyniku. Użyj **Same as narrator**, jeśli narrator ma rozumować przez kilka rund narzędzi (najwyżej cztery na turę, po czym prowadzi narrację z wynikami, które już ma).

Połączenia subskrypcyjne Claude i Grok nie obsługują natywnych wywołań narzędzi. Odpowiednie kontrolki wyjaśniają to i są wyłączone, dopóki nie wybierzesz obsługiwanego połączenia narzędzi gry. Polecenia tekstowe i znaczniki kości nadal działają. Jeśli osobnego połączenia brakuje lub zapytanie do niego się nie powiedzie, tura zgłasza błąd zamiast po cichu kontynuować narrację bez żądanej pracy narzędzi.

**Finish rolled turns in one request** (kończenie tur z rzutami jednym żądaniem) zmienia drugi opisany wyżej rodzaj wywołania. Tura z rzutem zwykle kosztuje dwa żądania: szkic i przepisanie wyniku z rzeczywistymi liczbami. Po włączeniu GM pisze wynik w ciemno, a silnik uzupełnia liczby później, więc wystarcza jedno żądanie. Domyślnie opcja jest wyłączona. Dwa przypadki nadal dodają żądanie: wywołanie narzędzia kości przy włączonym **Enable Tool Use** oraz osobne **Game tool connection**, które zawsze wysyła własne żądanie planowania. Zobacz [Game Mode: kości i testy umiejętności](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Jeśli lokalne modele współdzielą ograniczoną pamięć GPU, otwórz **Chat Settings → Agents** i włącz **Run Game tasks one at a time** (wykonuj zadania Game pojedynczo). Narracja, agenci i multimedia sceny czekają na siebie w obrębie tego czatu Game. Opcja jest domyślnie wyłączona i nie rezerwuje GPU względem innych czatów ani aplikacji. Obecne przyciski anulowania pozostają dostępne podczas pracy i oczekiwania.

## Włączanie agentów

Agenci to opcjonalni pomocnicy AI, którzy działają obok postaci GM. Aby użyć ich w grze, otwórz podczas rozgrywki panel **Chat Settings**, przejdź do sekcji **Agents** i włącz opcję **Enable Agents**. Działający agenci podnoszą koszty, bo wysyłają dodatkowe zapytania.

W trybie Game Mode warto znać dwóch agentów:

- **Game Session Keeper** pomaga utrzymać ciągłość między sesjami.
- **Music DJ** dobiera muzykę w tle. Wymaga usługi Spotify albo lokalnego folderu z muzyką.

Game Mode korzysta też z opcji **Review Agent Outputs**, dzięki czemu można sprawdzić, co wytworzył dany agent. Pełny obraz agentów znajdziesz w przewodniku [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Wybór modelu

Generowanie świata to najtrudniejsza część trybu Game Mode. Wymaga od modelu jednego długiego, ścisłego dokumentu JSON bez brakujących pól. Model, który świetnie radzi sobie ze zwykłym czatem, i tak może polec na tym kroku.

Do generowania świata użyj mocnego, aktualnego modelu z najwyższej półki na płatnym połączeniu. W 2026 roku gracze zgłaszają dobre wyniki z flagowych modeli największych dostawców. Przykłady to Anthropic Claude, OpenAI GPT i Google Gemini. Konkretne nazwy modeli zmieniają się często, więc traktuj je jako przykłady, a nie stałą listę.

Do bieżących tur rozgrywki czasem wystarcza tańszy model, bo tury wymagają narracji, a nie ścisłego formatu JSON. Jeśli postać GM zaczyna zapominać o postaciach NPC albo przeczyć wcześniejszym faktom, wróć do mocniejszego modelu.

Unikaj darmowych modeli i automatycznego doboru modelu przy generowaniu świata. Zapytanie może trafić do mniejszego modelu, który nie utworzy poprawnego formatu JSON dla świata. Małe modele z otwartymi wagami zwykle też nie dają rady na tym kroku.

Pełny opis parametrów znajdziesz w przewodniku [Parametry generowania](../prompts/generation-parameters.md).

<a id="the-games-controls"></a>

## Kontrolki gry

Na komputerze kontrolki gry otwierają się przyciskami blisko prawego górnego rogu czatu. Na telefonie znajdziesz je w ruchomym menu **Chat tools** (narzędzia czatu) z trzema kropkami:

- **Game controls** (Kontrolki gry, ikona kontrolera do gier):
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ**, gdy Music DJ odtwarza muzykę gry, oraz **Retry assets image generation**.
  - Gdy storyboard jest tłem gry, są tu też przyciski ponownego odtwarzania, odtwarzania/pauzy i wyciszenia.
  - W grze ze światem **Show the scene** (pokazanie sceny) i **Show the overworld** (pokazanie mapy świata) przełączają widoki, a **Show the map** (pokazanie mapy) wraca do otwartej mapy lochu, jaskini albo stacji.
  - **Edit game data** (edycja danych gry) pozwala ręcznie poprawić zapisane dane gry (zobacz [Ręczna edycja danych gry](sessions-and-saves.md#editing-game-data-by-hand)), a **Checkpoints** (punkty kontrolne) cofa grę do wcześniejszego momentu (zobacz [Jak gra zapisuje postępy](sessions-and-saves.md#how-your-game-saves)).
- **Session** (pióro): historia sesji, dziennik i kontrolki sesji. Zobacz [Game Mode: sesje i zapisy gry](sessions-and-saves.md).
- **Volume** (głośnik): głośność **Master**, **Music**, **Sound Effects**, **TTS** i **Ambient**.
- **Game Assets** (folder): materiały sceny i Asset Browser. Zobacz [Zasoby gry](game-assets.md).
- **Connected chat**, gdy gra jest połączona z czatem Conversation. Zobacz [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md#switching-between-connected-chats).

Wybierz narzędzie, żeby otworzyć jego kontrolki w ruchomym oknie na komputerze albo w panelu na całą szerokość ekranu na telefonie. Na komputerze przeciągnij przycisk, żeby go przenieść. Na telefonie przesuń menu z trzema kropkami albo je odblokuj, żeby zmienić kolejność narzędzi w środku. Po zamknięciu okna lub panelu narzędzie da się ponownie otworzyć z tego samego miejsca. Zobacz [Okna narzędzi i ich przyciski](../chats/chat-settings.md#control-windows-and-their-buttons).

Możesz też trzymać te kontrolki wewnątrz **Chat Settings**. Otwórz okno kontrolki i wybierz **Put back in Chat Settings**; pojawi się tam jako rozwijana sekcja. Przycisk otwierania sekcji w osobnym oknie pozwala ponownie ją odłączyć. Każda gra zapisuje twój wybór, a **Reset View** przywraca początkowy układ: przyciski na komputerze albo pozycje menu Chat tools na telefonie.

**Character Profiles** (profile postaci) zostaje poza menu Chat tools zarówno na komputerze, jak i na telefonie. Przeciągnij przycisk z portretem w dowolne miejsce, a potem otwórz go, żeby wybrać członka drużyny i obejrzeć albo edytować jego arkusz postaci. Na telefonach **Map** też ma własny ruchomy przycisk. Oba przyciski korzystają z twojego stylu widgetów czatu, zapisują swoje położenie dla tej gry i można je zablokować z poziomu otwartego okna. Mapa na komputerze zachowuje dotychczasowe kontrolki panelu mapy.

## Gdzie szukać poszczególnych tematów

Ten przewodnik wprowadza do gry. Każdy głębszy temat ma własny przewodnik:

- [Game Mode: walka](combat.md) omawia starcia, menu akcji, obliczanie obrażeń i wydarzenia na czas.
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md) omawia Character Profiles, arkusze postaci i Adventure Journal.
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md) omawia kończenie i rozpoczynanie sesji oraz historię sesji.
- [Game Mode: mapa, czas i pogoda](map-time-weather.md) omawia widoki mapy oraz automatyczny zegar i pogodę.
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md) omawia menu kości i zasady testów umiejętności.
- [Game Mode: widgety HUD](hud-widgets.md) omawia widgety stanu widoczne na ekranie.
- [Zasoby gry](game-assets.md) omawia bibliotekę muzyki, dźwięków, sprite'ów i teł.
- [Przewodnik po agencie Storyboard](storyboard.md) omawia instalację oraz storyboardy w trybach Roleplay i Game Mode.

Pole **Author's Notes** (notatki autora) działa tu tak samo jak w pozostałych trybach. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).

## Rozwiązywanie problemów

### Generowanie świata kończy się błędem formatu JSON albo błędem 422

Najczęstsza przyczyna: model nie zdołał utworzyć kompletnego dokumentu JSON. Wypróbuj kolejno te kroki.

1. Sprawdź, z jakiego połączenia korzysta postać GM. Jeśli wskazuje ono na model darmowy albo dobierany automatycznie, przełącz się na mocny model płatny.
2. Spróbuj jeszcze raz. Część błędów zdarza się jednorazowo, a ta sama konfiguracja działa za drugim podejściem.
3. Skróć bardzo długie pole realiów albo preferencji. Długie dane wejściowe zostawiają modelowi mniej miejsca na wynik w formacie JSON.

Jeśli zapytanie prawie się udało, a format JSON jest tylko lekko popsuty, Marinara Engine proponuje okno **Repair JSON** (naprawa formatu JSON). Otwiera się edytor z numerami linii i surowym wynikiem modelu. Linia stanu mówi, czy JSON jest poprawny, albo pokazuje błąd odczytu. Kliknij przycisk **Format**, aby uporządkować poprawny JSON. Potem kliknij przycisk **Apply Repaired JSON**, aby użyć poprawionej wersji bez płacenia za pełne ponowienie. Opcja **Repair JSON** pojawia się także przy podsumowaniach sesji i innych uporządkowanych zapytaniach.

Więcej objawów i sposobów naprawy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

### Postać GM opowiada pogodnie mimo wybranego mrocznego tonu

Część modeli trzyma radosny ton niezależnie od ustawień. Są dwa wyjścia. Dopisz wyraźną instrukcję w polu preferencji w kreatorze, na przykład "keep narration grim, do not soften failures". Albo przełącz się na model, którego domyślny głos pasuje do wybranego tonu.

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md)
- [Game Mode: mapa, czas i pogoda](map-time-weather.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: widgety HUD](hud-widgets.md)
- [Zasoby gry](game-assets.md)
- [Przewodnik po agencie Storyboard](storyboard.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Parametry generowania](../prompts/generation-parameters.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
