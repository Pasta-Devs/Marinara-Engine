# Gry Overworld (jeszcze niedostępne)

Notatki wyłącznie dla programistów. Gry **Overworld** (zestawy realiów, wygenerowane światy, mapa świata, miasta i mapy lochów) nie są jeszcze zaimplementowane dla graczy. Nic tutaj nie jest dokumentacją użytkownika: asystentka Professor Mari i strona dokumentacji w aplikacji nie czytają `docs/development` (poza kilkoma wymienionymi w nich przewodnikami), więc trzymaj materiały o trybie Overworld w tym pliku, dopóki tryb nie zostanie wydany. Po wydaniu przenieś te sekcje z powrotem do przewodników gracza w `docs/game/`.

Tryb pozostaje zablokowany, dopóki serwer nie ustawi tej flagi. Nie opisuj jej w `docs/CONFIGURATION.md` ani `.env.example`, dopóki tryb jest niedokończony.

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Pozwala graczom tworzyć gry Overworld (zestaw realiów i wygenerowany świat) oraz zamieniać w nie starsze gry. Gdy jest wyłączone, kreator oferuje tylko gry VN. |

## Konfiguracja: tryb gry, zestaw realiów i świat

### VN czy Overworld

Nowa gra toczy się w jednym z dwóch trybów gry, wybieranym w pierwszym kroku i zachowywanym we wszystkich jej sesjach:

- **Overworld** to świat stworzony dla twojego realiów, przemierzany na mapie świata, z miastami, miejscami do zbadania i lochami. Wymaga zestawu realiów i świata. Dopóki nie wybierzesz zestawu, używany jest zestaw dla pierwszego wybranego gatunku (High fantasy, jeśli gatunek nie ma własnego), a świat jest dla niego losowany.
- **VN** to Game Mode w dotychczasowej postaci, opowiadany jak powieść wizualna: scena po scenie, z mapą sceny i walkami, bez zestawu realiów, świata, mapy świata, miast i map lochów.

Overworld jest zablokowany, dopóki właściciel serwera nie ustawi `MARINARA_OVERWORLD_GAMES`. Gdy jest zablokowany, jego karta jest wyszarzona z informacją "Gry Overworld, z zestawem realiów i wygenerowanym światem, nie są jeszcze gotowe. Nowe gry zaczynają się jako gry VN." Każda nowa gra jest wtedy grą VN, a wybory zestawu realiów i świata się nie pojawiają. Gra utworzona, zanim pojawił się ten wybór, działa tak jak dotąd: ze światem jest grą Overworld, bez świata – grą VN.

### Wybór zestawu realiów

**Zestaw realiów** daje postaci GM słownictwo, którym opisany jest twój rodzaj świata: nazwy miejsc i wielkości osad, rodzaje grup, sposoby podróżowania, nazwy roku i dnia, to, jak ludy nazywają same siebie, pieniądze i towary, żywioły, miejsca walk oraz rodzinę grafiki i muzyki, z której korzysta (zobacz [Zasoby gry](#art-and-music-families)). Określa też, jakie rodzaje zmian dopuszcza świat, na przykład rywalizacje, przestępczość, wojny albo katastrofy, i jak szybko się zmienia. Wyłączony rodzaj zmian nigdy się nie pojawia, więc kłótnia może pozostać kłótnią.

Jest osiem zestawów: high fantasy, wuxia i xianxia, współczesność, współczesność z elementami nadprzyrodzonymi, lata dwudzieste XX wieku, cyberpunk, space opera i postapokalipsa. Współczesność jest domyślnie łagodna, bez przestępczości, konfliktów i katastrof, w wolnym tempie.

- Wybór zestawu przed wyborem gatunku ustawia pasujący gatunek. Gatunek wybrany samodzielnie pozostaje bez zmian.
- **Napisz go dla moich realiów** prosi twój model GM o przepisanie zestawu pod wybrany gatunek, realia i ton. Jeśli wynik nie jest spójny, model dostaje jeszcze jedną prośbę z podanymi powodami. Jeśli i wtedy się nie uda, kreator informuje, co było nie tak, i zachowuje dotychczasowy zestaw.
- **Zmień jego słowa** otwiera do edycji każde słowo zestawu. Listę wpisuje się w jednej linii, oddzielając elementy przecinkami. Zestaw z problemem, na przykład z pustą nazwą albo bez osad, informuje, co jest nie tak, a gry nie da się rozpocząć, dopóki problem nie zostanie naprawiony.
- **Pobierz ten zestaw** zapisuje plik `.worldkit.json` do udostępnienia. **Importuj plik zestawu** wczytuje go z powrotem.

Gra zachowuje zestaw, z którym ją utworzono, a udostępniony plik konfiguracji go zawiera. Experience może dostarczać własny pakiet map (zestaw realiów, gotowe mapy i kafelki). Gdy to Experience jest włączone, konfiguracja pokazuje jego zestaw jako ustawiony, a jeśli dostarcza mapy – pole **Mapa** do wyboru. Wyłączenie Experience przywraca twoje wybory.

### Tworzenie świata

Po wybraniu zestawu sekcja **Twój świat** rozkłada przed startem gry świat w słownictwie zestawu: regiony, osady każdej wielkości, to, z czego słynie każde miejsce, oraz szlaki między nimi (drogi, rzeki, szlaki morskie, korytarze skokowe) wraz z czasem podróży w dniach.

Świat powstaje na podstawie wartości w polu **Ziarno świata**. To samo ziarno, zestaw i opis świata zawsze dają ten sam świat. **Losuj** daje inny, a wpisanie liczby z powrotem przywraca dawny. Podgląd pokazuje małą mapę terenu i osad, miejsce startu drużyny oraz listę osad według regionów.

- **Zacznij od tej wiedzy** odczytuje z zaznaczonych lorebooków podane w nich miejsca i datowane wydarzenia, zachowane dokładnie tak, jak je zapisano. **Buduj wokół wiedzy** uzupełnia świat wokół nich. **Tylko miejsca z wiedzy** nie tworzy niczego poza nimi.
- **Napisz opis świata** prosi twój model GM o teraźniejszość, najważniejsze miejsca, grupy, wokół których toczy się teraźniejszość (czego chce każda z nich, kto jest jej sojusznikiem, a kto rywalem), oraz nazwy miejsc i ludzi zgodne z brzmieniem nazw każdego ludu. Miejsca z lore zostają zachowane bez względu na to, co napisze model. Wszystko, co nie pasuje do zestawu, jest pomijane i liczone. **Zmień opis** otwiera jego słowa do edycji, łącznie z imionami i nazwiskami każdego ludu. Bez opisu świata miejsca są numerowane, a ludzie występują pod nazwą swojego zajęcia.

**Świat ma przeszłość.** Przed rozpoczęciem gry świat przewija się rok po roku od swojego założenia. Osady rosną, grupy powstają, zyskują i tracą przywódców, zbliżają się do siebie i skłócają. Tam, gdzie świat je ma, bandyci, wojny i klęski głodu zostawiają ślady. Poważna zmiana przychodzi dopiero wtedy, gdy przez jakiś czas narastała, i tylko w rodzajach, na które pozwala zestaw. Datowane wydarzenia z twojego lore albo z opisu świata dzieją się wtedy i tam, gdzie mówią. To samo ziarno i opis dają tę samą przeszłość.

**Co wie postać GM.** Postać GM zawsze wie, gdzie jest drużyna, dokąd może się udać i ile trwa każda droga. Dowiaduje się o najważniejszych wydarzeniach z przeszłości, o tym, kto przewodzi bieżącemu miejscu, i o historii tego miejsca. O każde inne miejsce albo grupę może zapytać i dostaje odpowiedź w następnej turze. Miejsce, do którego idzie drużyna, wskazuje znacznikiem miejsca. Miejsce wymienione przez świat zachowuje wielkość nadaną mu przez świat. Miejsce, którego świat nie wymienia, na przykład zagroda, zachowuje nazwę nadaną przez postać GM. Każda osada ma mieszkańców losowanych z ziarna, gdy drużyna tam dotrze: z imieniem z własnej kultury, zajęciem pasującym do miejsca, temperamentem, sposobem mówienia i wyglądem. Gdy postać GM nazwie kogoś pełnym imieniem, ta osoba dołącza do śledzonych postaci.

**To, co zrobi drużyna, pozostaje.** Gdy drużyna pomaga jakiejś grupie albo jej szkodzi, zmienia stosunek dwóch grup do siebie, zdobywa albo rujnuje jakieś miejsce lub stawia kogoś na czele grupy, postać GM zapisuje to w swojej odpowiedzi. Każda zmiana jest sprawdzana względem świata. Zmiana rodzaju wyłączonego w zestawie albo zmiana dotycząca miejsca lub grupy, których świat nie ma, jest odrzucana. Od tej chwili postać GM dostaje świat w stanie, w jakim zostawiła go opowieść. Miejsce dodane przez opowieść jest miejscem, do którego drużyna może się udać. Swipe, ponowne wygenerowanie albo usunięta wiadomość cofają zmianę razem z jej odpowiedzią.

**Świat żyje też bez drużyny.** Gdy postać GM mówi, że mija czas, świat wykonuje kroki po tygodniu naraz, tylko w rodzajach zmian, które ma zestaw. Katastrofy nigdy nie przychodzą same: tylko postać GM może opowiedzieć o katastrofie, a ta jest odrzucana, jeśli jej rodzaj jest wyłączony. Nic nie rozstrzyga się tam, gdzie jest drużyna. Wieści podróżują: postać GM dowiaduje się o odległej zmianie, gdy miną dni potrzebne na drogę. Czyny drużyny ważą tym więcej, im bardziej jest znana.

**Ręczne zmiany.** W edytorze świata możesz zmieniać nazwy miejsc i je przenosić, malować teren, dodawać miejsca i ludzi, namalować taktyczne pole bitwy dla miejsca (zobacz [Game Mode: walka](../game/combat.md#tactical-battles-and-terrain)) i ułożyć miasto (zobacz [Miasto](#the-town)). Każda część gry widzi zmiany od razu. Miejsce o zmienionej nazwie nadal reaguje na starą nazwę. Zmiany wpływają na świat od teraz, nigdy na jego przeszłość. Miasto zachowuje swój układ, więc dodane przez ciebie miejsca i ludzie trafiają na jego następne wolne działki i do następnych wolnych domów.

**Pliki świata.** **Pobierz ten świat** (w sekcji **Twój świat**) zapisuje tworzony świat, a **Pobierz świat** na zakładce Świat gry zapisuje świat tej gry razem z ręcznymi zmianami jako plik `.world.json`. **Importuj plik świata** (obok zestawu realiów) wczytuje taki plik do konfiguracji nowej gry: wybiera zestaw realiów z pliku i tworzy jego świat. **Twoje światy** robi to samo ze światem z twojej biblioteki. Plik może też zawierać fabułę świata: wydarzenia i sceny napisane przez twórcę. Sceny fabuły pojawiają się w narracji przed odpowiedzią postaci GM, dokładnie tak, jak je napisano, a cele zadań z fabuły są wymienione w sekcji **Historia** na zakładce Świat dziennika. Jak napisać fabułę, opisuje przewodnik [Pisanie skryptów fabuły Game Mode](writing-story-scripts.md). Ręczne zmiany i fabuła należą do określonego ziarna i opisu świata, więc są pomijane, jeśli zmienisz którekolwiek z nich. Plik, którego nie da się odczytać, jest odrzucany, a kreator podaje powód. Z pliku, którego treść nie pasuje do zestawu, część zostaje pominięta, a kreator mówi, co to było.

**Dodawanie świata później i zapis.** Grze utworzonej bez świata można później dodać świat na zakładce **Świat** dziennika przyciskiem **Utwórz świat dla tej gry**. Świat działa od następnej tury, a wcześniejsze tury, mapa i ludzie pozostają. Przycisk jest wyszarzony, dopóki Overworld RPG jest zablokowany. Gra zachowuje swój świat w postaci, w jakiej powstał, więc nowa sesja, gałąź i wyeksportowany czat zachowują ten sam świat. Świat utworzony przez wcześniejszą wersję generatora działa dalej, ale nie da się go już edytować.

Gra ze światem otwiera się na **mapie świata** (overworld), czyli mapie pikselowej, na której prowadzisz drużynę od osady do osady i wchodzisz do miast. Zobacz [Mapa świata](#the-overworld).

## Mapy

### Mapa świata

Gra z wygenerowanym światem (zobacz [Tworzenie świata](#making-a-world)) otwiera się na **mapie świata** (overworld): ziemi świata narysowanej jako mapa pikselowa za narracją, z lasami, wzgórzami, wybrzeżami i morzami, drogami i duktami między osadami, każdą osadą narysowaną według jej wielkości oraz twoją drużyną. Podpisane są większe miejsca, a także to, w którym jesteś. Przeciągnij mapę, żeby się rozejrzeć.

1. Dotknij albo kliknij osadę albo wybierz ją z listy **Miejsca** (najbliższe są na początku, z czasem drogi).
2. Sprawdź jej wielkość i podróż z miejsca, w którym jesteś: ile dni albo godzin zajmuje i którędy prowadzi.
3. Kliknij **Idź tam**. Drużyna idzie drogami świata najszybszą trasą, a dni marszu od razu mijają na zegarze.

Twoja następna tura informuje GM, dokąd drużyna przeszła, ile to trwało i którędy, żeby GM mógł opisać przybycie. Drugi marsz przed twoją następną turą zaczyna się tam, gdzie skończył się pierwszy.

Jaskinie, kopalnie, krypty i ruiny kilka kroków za osadą są rysowane jako **lokacje**. Nowy świat ma jedną albo dwie w każdym regionie, nazwane od sąsiedniej osady ("Hollin Caves", "Ashby Ruins"). **Idź tam** prowadzi drogami do jej osady, a potem pieszo poza drogą. W lokacji przycisk **Wejdź** otwiera jej mapę (zobacz [Lochy, jaskinie i stacje](#dungeons-caves-and-stations)). Lokacja ważna dla fabuły pozostaje **zamknięta** (wyblakła, bez podróży i bez wejścia), dopóki GM jej nie otworzy. Twórca świata może też do tego czasu ukryć lokację albo udostępnić ją od początku.

Zrujnowane miejsce jest rysowane jako ruina. Po zmroku mapa ciemnieje, a w oknach zapalają się światła. Każda rodzina stylistyczna realiów (fantasy, wuxia, współczesność, lata dwudzieste XX wieku, science fiction, pustkowia) ma własne kafelki. Zestaw realiów bez rodziny rysuje zwykłe kafelki.

Do przełączania widoków służą **Pokaż scenę** i **Pokaż mapę świata** w menu **Kontrolki gry** (na telefonie w menu **Narzędzia czatu** z trzema kropkami). Gra pamięta twój wybór. Walka i odtwarzanie sesji korzystają z własnych ekranów.

### Pakiety kafelków

Pakiety kafelków przechowują paletę i każdy kafelek (każdy rodzaj terenu, osady według wielkości, drużynę oraz ulice, dachy i mieszkańców miasta) jako wiersze pikseli. Każda rodzina realiów ma wbudowany pakiet. Otwórz panel **Agenci** i znajdź **Pakiety kafelków**, aby:

- wybrać, którym pakietem rysowany jest każdy zestaw realiów (**Wbudowane** to jego własny pakiet),
- zaimportować pakiet przyciskiem **Importuj pakiet kafelków** z pliku `.tilepack.json`,
- wyeksportować pakiet przyciskiem **Eksportuj**, żeby go udostępnić, albo usunąć go przyciskiem **Usuń**, co przywraca każdemu realiom rysowanemu tym pakietem jego własne kafelki.

Pakiet potrzebuje tylko tych kafelków, które zmienia, a wszystko, czego nie zawiera, jest rysowane w zwykły sposób. Pakiet, który podaje kafelek nierysowany przez aplikację Marinara Engine, zachowuje resztę i informuje, co pominął.

### Miasto

Gdy drużyna jest w osadzie, wybierz ją na mapie świata i kliknij **Wejdź**, żeby zobaczyć miasto. Jego układ wynika ze świata: ulice i plac, miejsca, które ma w nim świat albo opowieść (podpisane na budynkach), ratusz w większej miejscowości, warsztaty rzemiosł, z których miejscowość słynie, oraz domy. Mieszkańcy są tam, gdzie o tej godzinie powinni być: w pracy za dnia, na placu o zmierzchu, w domu nocą.

Wybierz budynek albo plac albo wybierz miejsce z listy **Miejsca w mieście**, żeby zobaczyć, kto tam jest i ile minut zajmie dojście. **Idź tam** prowadzi drużynę przez miasto ulicami, wokół budynków i wszystkiego, co namalowano w ręcznym układzie, przez jego mosty. Minuty mijają na zegarze, a twoja następna tura informuje GM, dokąd poszła drużyna i kto tam jest. Wizyta w nazwanym miejscu, na przykład w gospodzie dodanej przez opowieść, sprawia, że staje się ono bieżącym miejscem drużyny. **Opuść miasto** wraca na mapę świata. Gra pamięta, w którym widoku jesteś.

Miasto można **ułożyć ręcznie** w edytorze świata takim jak Pixelforge, w ramach ręcznych zmian świata.

- Budynki można przenosić na inne działki. Budynek przeniesiony na działkę innego zamienia się z nim miejscami, a każdy budynek nadal stoi frontem do ulicy.
- Grunt można pomalować ulicami, brukiem, otwartym terenem, drzewami albo studnią, ale nigdy pod budynkiem, przed jego drzwiami, na środku placu ani pod straganem.
- To, kto gdzie mieszka i pracuje, nigdy się nie zmienia, a czas dojścia do przeniesionego budynku liczy się od jego nowych drzwi.
- Edytor odrzuca układ, który nie pasuje do miasta, i podaje powód. Miejsca dodane przez opowieść w trakcie gry nadal znajdują działkę.
- Układ może też stawiać budynki poza działkami, malować pola, polne drogi, wodę z mostami i żywopłoty oraz rozmieszczać ozdoby. Widok miasta rysuje je wszystkie (ozdoby tylko z pakietem obrazów, który je zawiera).

### Lochy, jaskinie i stacje

Gdy opowieść schodzi pod ziemię albo na pokład, GM może otworzyć **mapę miejsca**: loch, jaskinię albo stację, narysowaną nad sceną. Jej układ wynika z gry i nazwy miejsca, więc to samo miejsce ma zawsze te same pomieszczenia, a powrót zachowuje mapę taką, jaka była. GM wybiera wygląd spośród jedenastu: jaskinie skalne, lodowe, kryształowe i lawowe; krypta, kanały i świątynia; a także korytarze stacji, laboratorium, pokład maszynowni i hydroponika. Z pakietem kafelków do tego wyglądu mapa korzysta z jego grafiki. Bez niego jest rysowana zwykłymi kolorami.

Miejsce w mieście, do którego drużyna może zejść (jaskinia, kopalnia, krypta, kanały albo ruina, sądząc po nazwie, a w science fiction wrak albo bunkier), pokazuje przycisk **Zejdź w dół**, gdy drużyna tam jest.

- Za każdym razem otwiera tę samą mapę, a wyjście z niej przenosi drużynę z powrotem do miasta.
- Gdy drużyna jest na innej mapie, najpierw ją opuść.
- Miejsce może też mieć mapę przygotowaną ręcznie w edytorze świata takim jak Pixelforge. **Zejdź w dół** otwiera wtedy tę mapę, niezależnie od nazwy miejsca, rysowaną pakietem, który wskazuje. Na takiej mapie wyjście jest tam, gdzie drużyna weszła, rekwizyty nigdy nie zagradzają drogi, a ludzie stoją w nazwanych punktach o godzinach, które podaje mapa. GM dowiaduje się, kto tam jest.

Kliknij miejsce na mapie albo użyj klawiszy strzałek, żeby przejść tam najkrótszą drogą. Minuty mijają na zegarze (mniej więcej minuta na trzydzieści kroków), a twoja następna tura informuje GM, z którego obszaru do którego przeszła drużyna. Etykieta u góry podaje bieżący obszar. **Pokaż scenę** i **Pokaż mapę** w menu **Kontrolki gry** przełączają między sceną a mapą.

Aby wyjść, wróć do wyjścia (schodów, drabiny albo włazu) i wybierz **Wyjdź**. GM może też zamknąć mapę, gdy opowieść opuszcza to miejsce. Ponowne wygenerowanie tury, w której otwarto mapę, przechodzono po niej albo ją opuszczono, przywraca mapę do stanu sprzed tej tury.

## Czas

W grze ze światem czas płynie też sam:

- Gdy na pierwszym planie jest mapa świata, a gra czeka na ciebie, co pięć sekund rzeczywistych mija minuta gry. Zegar staje, gdy GM pisze, zanim przeczytasz jego odpowiedź, gdy na pierwszym planie jest widok sceny i gdy aplikacja działa w tle.
- Podczas marszu po mapie świata mija tyle dni, ile zajmuje jego trasa.
- Gdy Game Master (GM, mistrz gry) mówi, że mijają dni (podróż, długi odpoczynek, oczekiwanie), zegar przesuwa się o te dni. Ponownie wygenerowana odpowiedź nie przesuwa go drugi raz. Jeśli nowa wersja opowieści zajmuje inny czas, ustaw dzień ręcznie.

## Walka

### Żywioły

To, jakie żywioły istnieją, zależy od realiów:

- Brak zestawu realiów albo zestaw, który żadnych nie wymienia: klasyczna szóstka (ogień, lód, błyskawica, trucizna, świętość, cień).
- Wuxia: pięć faz (drewno, ogień, ziemia, metal, woda), z których każda pokonuje następną.
- Cyberpunk i space opera: żywioł kinetyczny, termiczny, EM oraz chemiczny lub plazmowy.
- Współczesność i lata dwudzieste XX wieku: brak.

Deszcz i burze na otwartym terenie osłabiają żywioły podobne do ognia i wzmacniają te podobne do błyskawicy. W walce taktycznej żywioł uderza mocniej w żywioł, który pokonuje, i słabiej w taki, który pokonuje jego. Żywioły i reakcje zestawu zmienisz w opcji **Zmień jego słowa**. Zobacz [Wybór zestawu realiów](#choosing-a-setting-kit).

### Łupy

To, co wypada, zależy od realiów. Gra z zestawem realiów daje łupy z tego zestawu (gra współczesna daje kartę podarunkową albo apteczkę, nigdy zaczarowany miecz), a te słowa zmienisz w opcji **Zmień jego słowa**. Gra bez zestawu daje to, co zwykle ma jej gatunek. Gatunek bez startowego zestawu, taki jak Steampunk, daje zwykłe rzeczy, które nie należą do żadnego realiów. W grze, której zestaw zasad ma własne tabele łupów, przeciwnicy zostawiają zamiast tego przedmioty zestawu zasad, a zestaw zasad, który wyłącza własne przedmioty trybu Game Mode, daje tylko własne.

### Ręcznie wykonane pola bitwy

Świat może też mieć ręcznie wykonane pola bitwy: plansze malowane pole po polu dla jednego z jego miejsc w edytorze świata, takim jak Pixelforge. Gdy walka zaczyna się w tym miejscu albo wewnątrz niego, korzysta z jednej z tych plansz zamiast z wygenerowanej.

- Plansza jest używana dokładnie tak, jak ją namalowano. Jeśli miejsce ma kilka plansz, wybiera ziarno walki (liczba, która wskazuje jedną z nich).
- Opis terenu od GM nie jest wtedy używany, ale formacja nadal decyduje, gdzie zaczyna każda ze stron. GM dowiaduje się, że plansza powstała dla tego miejsca.
- Ręcznie wykonana plansza musi spełniać trzy zasady: ma jeden z trzech rozmiarów plansz, dwie kolumny po każdej stronie to równiny, na których ustawiają się strony, a każde pole, na którym może stanąć walczący, łączy się z resztą. Edytor odrzuca planszę łamiącą którąś z zasad i podaje powód.

Te plansze są przechowywane razem z ręcznymi zmianami świata, więc wędrują w plikach świata, pakietach map i bibliotece.

### Sceny pól bitwy

Gra z zestawem realiów nazywa własne sceny jego słowami, więc walka cyberpunkowa toczy się na dachu albo w korytarzu megabloku, a walka wuxia w bambusowym lesie albo w herbaciarni. Pola planszy też noszą nazwy ze słownictwa realiów (osłona i gruz zamiast lasu i ruin). Sceny zestawu i nazwy pól zmienisz w opcji **Zmień jego słowa**.

## Dziennik, pieniądze i sesje

Zakładka **Świat** pokazuje, gdzie jesteś i jak dobrze znana jest drużyna, jej pozycję wobec każdej grupy, czego dokonała, wieści, które do niej dotarły (plotki są oznaczone), nadciągające kłopoty, o których słyszała, oraz przeszłość, o której opowiedziałby każdy miejscowy. Pokazuje tylko to, co drużyna mogła wiedzieć. Sekrety znane tylko GM pozostają ukryte. Podąża za opowieścią przez swipe'y i gałęzie.

Gra bez zestawu zasad też ma pieniądze i rynek, gdy ma je jej zestaw realiów. Ma je każdy startowy zestaw realiów, na przykład miedź, srebro i złoto w high fantasy, miedziane monety i taele srebra w wuxia, dolary i centy we współczesności oraz kredyty w cyberpunku i space operze. Sklep zestawu realiów wymienia codzienne towary z ceną i najmniejszym miejscem, w którym sprzedaje się każdy z nich, więc wioska ma kawiarnię, ale apteczkę ma dopiero miasteczko. Pieniądze i sklep możesz zmienić w opcji **Zmień jego słowa** zestawu albo usunąć pieniądze. Zobacz [Wybór zestawu realiów](#choosing-a-setting-kit).

W grze z wygenerowanym światem świat toczy się dalej od miejsca, w którym go zostawiono: dni, które minęły, czyny i reputacja drużyny, miejsca i grupy dodane przez opowieść oraz to, dokąd drużyna dotarła.

## Rodziny stylistyczne grafiki i muzyki

Gra rozpoczęta z zestawem realiów ma rodzinę stylistyczną, widoczną w sekcji **Grafika i muzyka**, gdy zmieniasz słownictwo zestawu: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` albo jedną z własnych rodzin zestawu. Gra korzysta z folderów nazwanych tak jak jej rodzina i z każdego folderu, którego nazwa nie jest nazwą żadnej rodziny, a foldery innych rodzin pomija. Gra cyberpunkowa nigdy nie zagra muzyki do bitew fantasy ani nie pokaże zaczarowanego lasu. Gdy nic z jej rodziny ani ze wspólnych folderów nie pasuje, nic nie gra – gra nie sięga po ścieżkę innej rodziny. Gra bez zestawu realiów korzysta ze wszystkich folderów.

- **Muzyka**: ścieżki realiów umieść w `music/<state>/<family>/<intensity>`, na przykład `combat/wuxia/intense`. Mają pierwszeństwo przed wspólnymi ścieżkami.
- **Tła**: `backgrounds/<family>`. Tła wygenerowane w grze z zestawem realiów też trafiają do tego folderu.
- **Dźwięki walki**: dźwięk w `sfx/combat/<family>` o tej samej nazwie co wbudowany, na przykład `sword-swing`, zastępuje go w grach tej rodziny. Wbudowane dźwięki walki są w stylu fantasy, więc walki innych rodzin są ciche, dopóki nie dodasz dla nich własnych.

Wbudowane tła startowe liczą się jako wspólne, z wyjątkiem teł fantasy (`ancient_library`, `castle_cliff`, `enchanted_forest`) i współczesnego `city_night`. Zestaw realiów zapisany, zanim pojawiły się rodziny stylistyczne, nadal działa: zestaw utworzony na podstawie zestawu startowego korzysta z rodziny tamtego zestawu, a każdy inny korzysta ze wszystkich folderów, dopóki nie wybierzesz rodziny w sekcji **Grafika i muzyka**. Opisany wyżej pasek wyboru podaje rodzinę otwartej gry.

## World Maps: Ze świata

- **Ze świata** pojawia się, gdy gra tworzy świat (zobacz [Tworzenie świata](#making-a-world)). Układa ten świat jako mapę: jego regiony, osady i miejsca oraz drogi między nimi wraz z czasem podróży. Przed zapisaniem możesz to sprawdzić. Ta droga nie wymaga generowania przez AI, a miejsca na mapie są miejscami świata. W trakcie gry jedno i drugie pozostaje zgodne. Mistrz gry i rynki używają miejsca, w którym mapa umieszcza drużynę. Gdy mistrz gry nazwie miejsce ze świata, mapa przenosi tam drużynę. W World Maps 1.6.0 lub nowszym wybiera najkrótszą trasę. Wcześniejsze wersje przenoszą drużynę tylko o jeden krok: do miejsca wewnątrz, do miejsca, które je otacza, albo do miejsca, z którym łączy je droga.

## Skrypty fabuły

Światy mogą zawierać skrypty fabuły. Zobacz [Pisanie skryptów fabuły Game Mode](writing-story-scripts.md).
