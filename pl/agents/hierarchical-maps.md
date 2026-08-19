# World Maps: konfiguracja, tworzenie map i podróże

> **Aktualna zgodność:** Ten przewodnik opisuje pakiet World Maps **1.3.1**.
> Pakiet obsługuje Marinara Engine **2.3.5–3.x** i działa na czatach Roleplay
> oraz Game. Marinara Engine **2.4.1** dodaje skoordynowane usuwanie dyrektyw ruchu
> ze strumienia oraz natychmiastowe odświeżenie Lorebooks po przenośnym imporcie.
> Engine **2.3.5–2.4.0** pozostaje zgodny, ale wymaga ręcznego odświeżenia Lorebooks
> po imporcie i nie zawiera tego oczyszczania strumienia.

World Maps dodaje trwały stan świata do trybów Roleplay i Game. Zamiast
jednego pola tekstowego z miejscem akcji świat opisują zagnieżdżone lokalizacje:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara pilnuje jednej wiążącej lokalizacji bieżącej w tej hierarchii. Aktualna
ścieżka nawigacji, szczegóły dokładnego miejsca, pobliskie cele podróży i
pasująca wiedza o świecie mogą stanowić podstawę kolejnej odpowiedzi. Mapa
potrafi też podążyć za wyraźnym ruchem albo odkryciem, które ustala ostatnia
wiadomość użytkownika. Widoczna narracja AI może opisać wynik, ale sama nie
przenosi mapy ani nie wymyśla lokalizacji.

Mapy mogą działać osobno w każdym czacie albo być podpięte do jednego wspólnego
świata zapisanego na koncie. Szablony tworzą czyste kopie, które z czasem mogą
się rozejść. Wspólny świat działa inaczej: trzyma jedną wiążącą hierarchię i jeden
zestaw grafik, a każdy podpięty czat zachowuje własną lokalizację bieżącą,
historię podróży, migawki i powiązania z mapami Game.

## Przegląd możliwości

World Maps 1.3.1 daje:

- zagnieżdżone regiony, osady, miejsca, budynki, piętra i pomieszczenia;
- ścieżki nawigacji oraz jedną wiążącą lokalizację bieżącą fabuły;
- widok listy, mapy z pozycjami i uporządkowanych warstw dla lokalizacji podrzędnych;
- podróż w górę i w dół hierarchii, bezpośrednie przejścia i trasy na wiele tur;
- zweryfikowany ruch i odkrycia ustalane przez ostatnią wiadomość użytkownika;
- wspólne światy zapisane na koncie, które da się podpiąć do czatów Roleplay i Game;
- sprawdzane szkice osobne dla każdego czatu, ze sterowaniem publikacją, odrzuceniem, konfliktem i odłączeniem;
- szablony map na koncie, tworzone ręcznie, przez AI albo z importu;
- szkice i rozbudowy map tworzone przez AI na podstawie konfiguracji lub wybranej wiedzy o świecie;
- jawne opisy lokalizacji, prywatną pamięć modelu oraz wiedzę o świecie przypisaną do dokładnego miejsca;
- jeden opcjonalny obraz referencyjny dla każdej lokalizacji, z galerii czatu albo z Global Gallery;
- osobne tło dla każdej mapy z pozycjami, z galerii czatu albo z Global Gallery;
- zbiorcze generowanie brakujących grafik lokalizacji z podglądem przed wysłaniem;
- globalne nadpisanie promptu grafik map, oparte na zmiennych;
- obsługę referencji lokalizacji w ilustracjach Roleplay i storyboardach Game;
- import, eksport, archiwizowanie, edycję świadomą historii oraz powiązania z mapami Game;
- globalne biblioteki promptów do budowania map przez AI i do wstawki o lokalizacji podczas zwykłych tur.

Dostępne cele podróży trafiają do kontekstu modelu. Dzięki temu przy włączonych
wyborach CYOA model może zaproponować lokalizacje podrzędne albo połączone
miejsca jako kolejne opcje. Same treści wyborów nadal tworzy model.

## Wybór właściwego powiązania mapy

Biblioteka zawiera dwa zasoby wielokrotnego użytku zapisane na koncie, a każdy
czat trzyma własną lokalizację bieżącą i własną historię. Nazwa zasobu nie jest
jego tożsamością: World Maps 1.3.1 dopisuje **(copy)** albo numer, gdy nowo
zapisany zasób miałby taką samą nazwę jak istniejący.

| Zasób albo stan                    | Właściciel                              | Kiedy wybrać                                                                        | Na co wpływają późniejsze zmiany                     |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Niezależna mapa czatu**          | Jeden czat Roleplay albo Game           | Ta fabuła ma mieć własny świat                                                      | Tylko ten czat                                       |
| **Niezależny szablon**             | Twoje konto                             | Potrzebny jest punkt wyjścia do wielokrotnego użytku                                | Tylko nowe kopie; istniejące czaty się nie zmieniają |
| **Wiążący wspólny świat**          | Twoje konto                             | Kilka czatów ma korzystać z jednej utrzymywanej hierarchii                          | Wspólną definicję, z której korzystają podpięte czaty |
| **Szkic podpiętego czatu**         | Jeden podpięty czat, aż do publikacji   | Podpięta fabuła coś odkryła albo zmieniła i może to należeć do wspólnego świata     | Żaden inny czat, dopóki nie klikniesz przycisku **Publish** |
| **Odłączona niezależna kopia**     | Jeden wcześniej podpięty czat           | Ta fabuła ma zachować bieżącą mapę, ale przestać dostawać zmiany ze wspólnego świata | Tylko odłączony czat                                 |

Kopiowanie to nie podpięcie. Przyciski **Use template**, **Add to chat**
i **Independent copy** tworzą osobne mapy. Przycisk **Use shared world** podczas
konfiguracji trybu Game oraz **Link to chat** w bibliotece podpinają czat do
wiążącego wspólnego świata.

## Szybki start

1. Otwórz sekcję **Agents** (Agenci), kliknij przycisk **Download Agents** (pobranie agentów) i zainstaluj pakiet **World Maps**.
2. Uruchom aplikację Marinara Engine ponownie, gdy pojawi się prośba. Pakiet zawiera kod serwera.
3. Otwórz czat Roleplay lub Game.
4. Otwórz osobną ikonę globusa **World Maps**, jeśli aplikacja ją udostępnia,
   albo przejdź do **Agents → World Maps**, a potem włącz pakiet dla bieżącego
   czatu. Da się to zrobić także w sekcji **Chat Settings → Agents** (ustawienia czatu) tego czatu.
5. Utwórz mapę przyciskiem **Use template**, **Create with AI** albo **Build
   manually**. Do istniejącego czatu można też zaimportować plik mapy.
6. Sprawdź roboczą hierarchię, wybierz lokalizację początkową, włącz mapę
   i kliknij przycisk **Save** (zapisanie).
7. W trakcie czatu otwórz panel **Story map**. Wybierz osiągalny cel podróży
   i wyślij kolejną turę albo wprost ustal ruch drużyny we własnej wiadomości,
   żeby pakiet mógł zweryfikować i zapisać dotarcie na miejsce.
8. Opcjonalnie przypisz lokalizacjom grafiki z galerii albo skorzystaj z sekcji
   **Location artwork**, żeby przejrzeć i wygenerować brakujące obrazy.

Zastosowanie szablonu, szkicu AI lub zaimportowanego pliku zmienia wyłącznie
kopię roboczą w edytorze. Na odpowiedzi wpływa dopiero hierarchia włączona
i zapisana.

## Instalacja i włączenie pakietu

Otwórz sekcję **Agents** z zakładki Sparkles na prawym pasku bocznym. Kliknij
przycisk **Download Agents**, wybierz pakiet **World Maps** i kliknij
przycisk **Install**. Jeśli katalog zaproponuje potem **Update**, zainstaluj
także tę aktualizację. Zanim zaczniesz korzystać z pakietu, uruchom aplikację
ponownie zgodnie z komunikatem.

Strona World Maps pokazuje zainstalowaną wersję pakietu i jego gotowość,
udostępnia bibliotekę map świata przypisaną do konta, nazywa bieżący czat
docelowy oraz pokazuje stan mapy w tym czacie. Instalacja pakietu tylko go
udostępnia, ale nie włącza go w każdym czacie.

### Roleplay

1. Otwórz czat Roleplay.
2. Otwórz panel **Chat Settings** przyciskiem z zębatką.
3. Włącz przełącznik **Enable Agents**.
4. W sekcji **Tracker Agents** włącz pakiet **World Maps**.
5. Otwórz edytor **Edit world map** albo bibliotekę **World map library**.
   W nowszych wydaniach aplikacji tę samą bibliotekę otwiera ikona globusa
   na górnym pasku na komputerze, a na telefonie – globus w panelu bocznym
   **Chats**.

Biblioteka działa tak samo niezależnie od tego, czy otworzysz ją na głównej
stronie **Agents**, czy w panelu Chat Settings czatu Roleplay. Przycisk **Add to
chat** tworzy niezależną kopię szablonu, a przycisk **Link to chat** podpina
trwały wspólny świat.

### Game

Podczas konfiguracji trybu Game wybierz World Maps, a następnie jedną
z dróg konfiguracji:

- **Create with AI** przygotowuje wygenerowaną hierarchię do sprawdzenia.
- **Use template** otwiera bibliotekę światów jeszcze przed utworzeniem gry.
- **Build manually** zaczyna od pustej hierarchii do edycji.

Po wybraniu opcji **Use template** okno wyboru pokazuje najpierw sekcję
**Shared worlds**, a pod nią **Independent templates**:

- **Use shared world** podpina nową grę do wiążącego świata zapisanego na
  koncie. Gra i tak zachowuje własną lokalizację bieżącą, historię, migawki,
  powiązania oraz nieopublikowane odkrycia.
- **Use template** tworzy kopię roboczą należącą do gry i przeznaczoną do
  sprawdzenia. Szablon na koncie nigdy nie jest zmieniany.

Lokalizacje z wybranego zasobu stają się hierarchicznym światem początkowym.
Zapasowa zwykła mapa Game nie jest wtedy awansowana na jej miejsce.

World Maps da się też dodać do istniejącej gry później, w sekcji **Chat
Settings → Agents**.

## Tworzenie szablonów map i korzystanie z nich

Otwórz **World Maps → Open world library**. Szablony należą do
konta, a nie do pojedynczego czatu, więc dobrze sprawdzają się przy światach
z fandomów, realiach kampanii, lochach, miastach i własnych mapach
startowych.

W bibliotece można:

- utworzyć szablon ręcznie;
- naszkicować go przyciskiem **Create with AI**;
- zaimportować plik `.hierarchical-map.json`;
- wyszukać szablon, obejrzeć go, edytować, wyeksportować lub usunąć;
- użyć przycisku **Add to chat** przy otwartym czacie Roleplay lub Game;
- wybrać **Use template** podczas konfiguracji trybu Game.

Każde zastosowanie tworzy niezależną kopię roboczą. Późniejsze zmiany w szablonie
nie zmieniają czatów, które go już skopiowały, a zmiany w czacie nie zmieniają
szablonu.

Szablony zachowują odwołania do grafik z Global Gallery, wspólnej dla całego
konta. Po użyciu przycisku **Save as template** w czacie World Maps przenosi
wskazane grafiki czatu do Global Gallery, a gdy identyczny wspólny obraz już tam
jest, korzysta z niego ponownie. Każdy czat, w którym zastosujesz szablon,
wskazuje potem tę samą wspólną grafikę, bez tworzenia kolejnej kopii w galerii.

Wspólne są tylko grafiki. Każda zastosowana definicja mapy nadal jest niezależną
kopią roboczą, a edycja szablonu nie zmienia map dodanych wcześniej do czatów.

## Podpięcie czatów do jednego wspólnego świata

Kiedy kilka czatów Roleplay lub Game ma czytać tę samą wiążącą hierarchię,
skorzystaj z sekcji **Shared worlds** (wspólne światy) w bibliotece World map
library. Utwórz pusty wspólny świat, zaimportuj gotowy, awansuj istniejący
szablon przyciskiem **Make shared** albo otwórz zapisaną mapę czatu i wybierz
**Make shared**. Ta ostatnia droga przenosi wskazane grafiki czatu do Global
Gallery, tworzy świat zapisany na koncie i podpina do niego pierwotny czat.

Przyciskiem **Link to chat** podepniesz czat, który biblioteka pokazuje jako
docelowy. Lokalizacja bieżąca oraz wszystkie identyfikatory lokalizacji używane
już przez historię kampanii muszą istnieć we wspólnym świecie. W przeciwnym
razie użyj opcji **Independent copy** albo najpierw przenieś bieżącą mapę czatu
do nowego wspólnego świata.

Podpięte czaty dzielą wyłącznie definicję mapy i grafiki z Global Gallery. Nie
dzielą wiadomości, lokalizacji bieżących, migawek podróży, stanu gry, powiązań
z mapami Game, połączeń z dostawcami ani danych logowania.

Zmiany i odkrycia z podpiętego czatu zapisują się jako nieopublikowany szkic tego
czatu. Nie zmieniają wiążącego świata ani innych czatów, dopóki nie klikniesz
przycisku **Publish**. Szkic można też odrzucić przyciskiem **Discard** albo
przerwać współdzielenie przyciskiem **Detach and keep copy**, zachowując bieżącą
wersję czatu. Jeśli wiążący świat zmieni się w czasie, gdy szkic czeka na
publikację, World Maps zgłasza konflikt i wymaga odłączenia albo odrzucenia,
zamiast po cichu nadpisać którąkolwiek wersję.

Edycja wspólnego świata z poziomu biblioteki zmienia wiążącą definicję od razu.
Edytor wspólnego świata nie pozwala trwale usuwać lokalizacji, więc archiwizuj
je, aby ich stałe identyfikatory pozostały dostępne. Podpięty czat też nie usunie
trwale żadnej lokalizacji, dopóki nie wybierzesz opcji **Detach and keep copy**.
Samego wspólnego świata nie da się usunąć, dopóki wszystkie podpięte czaty nie
zostaną odłączone albo podpięte gdzie indziej.

Wspólne światy i szablony zachowują odwołania do grafik z Global Gallery, bez
kopiowania pliku obrazu do każdego czatu. Marinara blokuje usunięcie obrazu
z Global Gallery, dopóki odwołuje się do niego zapisany szablon, wspólny świat,
niezależna mapa czatu albo szkic podpiętego czatu. Jeśli chcesz usunąć sam plik,
najpierw skasuj odwołania do grafiki.

## Odłączenie, wymiana i zaczynanie od nowa

Każde z tych działań odpowiada na inne pytanie:

- Żeby przerwać współdzielenie, ale zachować bieżącą hierarchię podpiętego
  czatu, zapisz albo odrzuć oczekujące zmiany w edytorze, a potem wybierz
  **Detach and keep copy**. Czat staje się niezależny i przestaje dostawać
  wiążące aktualizacje.
- Żeby dalej współdzielić mapę, ale z innym wiążącym światem, otwórz bibliotekę
  światów dla wskazanego czatu docelowego i kliknij przycisk **Link to chat**
  przy nowym świecie. Kontrola zgodności z historią nadal obowiązuje.
- Żeby wymienić niezależną mapę czatu, otwórz jej edytor i wybierz **Replace /
  start over**. Można najpierw zapisać szablon albo wyeksportować kopię
  zapasową, a potem wybrać **Create with AI**, **Use template or shared world**,
  **Import map file** albo **Start blank**.
- Żeby dać czatowi zupełnie niepowiązaną mapę, skorzystaj z tej samej drogi
  wymiany. Usunięcie i ponowne dodanie agenta nie resetuje mapy.

Wymiana pozostaje kopią roboczą do momentu kliknięcia przycisku **Save**. Zapis
wymiany kasuje zakolejkowany cel podróży albo trasę. Kiedy historia wiadomości
odwołuje się już do identyfikatorów lokalizacji, World Maps może odrzucić
niepowiązaną wymianę, żeby zachować dotychczasowe ścieżki nawigacji. W takim
wypadku zostań przy niezależnej kopii i rozbuduj albo zarchiwizuj istniejącą
mapę.

## Jak działa edytor map

Na komputerze edytor pokazuje trzy panele. Na wąskim ekranie przełączaj się
między zakładkami **Hierarchy**, **Local** i **Details**.

- **Hierarchy** pokazuje całe drzewo. Wybranie lokalizacji otwiera ją do edycji.
  Przycisk **Enter** zmienia oglądany fragment hierarchii, ale nie przenosi
  fabuły.
- **Local** pokazuje bezpośrednie lokalizacje podrzędne bieżącego miejsca jako
  listę, mapę z pozycjami albo uporządkowane warstwy.
- **Details** służy do edycji tekstów lokalizacji, hierarchii, wiedzy o świecie,
  grafik, przejść, statusu i powiązań z mapami Game.

W nagłówku edytora znajdziesz sterowanie budowaniem przez AI, przyciski
**Templates**, **Export** i **Import**, przełącznik Enabled oraz przycisk
**Save**. Niezapisane zmiany są oznaczone słowem **Unsaved**. Wyjście
z niezapisaną pracą kończy się pytaniem, czy ją odrzucić.

### Co może zawierać lokalizacja

Każda lokalizacja może mieć:

- jedną lokalizację nadrzędną i dowolnie wiele podrzędnych;
- typ Region, Settlement, Place, Building, Floor lub Room;
- nazwę i ikonę;
- jawny opis oraz prywatną pamięć modelu;
- krótkie podsumowanie tego, co widać na miejscu;
- powiązania z wpisami lorebooków przypisane do dokładnego miejsca;
- jedno- lub dwukierunkowe bezpośrednie przejścia do innych lokalizacji;
- sposób prezentacji lokalizacji podrzędnych: List, Map albo Layers;
- obraz referencyjny lokalizacji i opcjonalny przełącznik jego użycia;
- osobne tło mapy podrzędnej przy prezentacji Map;
- status aktywny albo zarchiwizowany.

Przy prezentacji **Map** przeciągnij lokalizacje podrzędne na miejsce albo wpisz
dokładne pozycje X i Y z zakresu od 0 do 100. Wybrana lokalizacja nadrzędna może
mieć też obraz z galerii w tle swoich lokalizacji podrzędnych. Przy prezentacji
**Layers** nadaj każdej lokalizacji podrzędnej inną kolejność warstwy.

Bezpośrednie przejścia mogą łączyć dowolne poprawne miejsca w hierarchii: prom
między miastami, schody między wybranymi piętrami, portal między światami albo
tajne przejście między pomieszczeniami w różnych budynkach.

Wieżę o 25 piętrach zwykle lepiej opisać tak, żeby piętra były równorzędne pod
jedną wieżą, a nie tworzyły łańcucha zagnieżdżeń o głębokości 25. Mapa
dopuszcza do 500 lokalizacji i 20 poziomów hierarchii.

## Szkic i rozbudowa mapy przez AI

Przy pustej mapie kliknij przycisk **Create with AI** albo **Draft with AI**.
Przy istniejącej mapie kliknij przycisk **Expand with AI**.

### Wybór materiału dla generatora

W sekcji **Build from** wskaż jedno ze źródeł:

- **Game setup** korzysta z bieżącej konfiguracji i postaci. W trybie Game obejmuje
  to opis świata i postacie z drużyny.
- **Selected lore** korzysta z wybranych lorebooków. Opcja **Strict canon**
  tworzy wyłącznie miejsca oparte na wiedzy o świecie. Opcja **Canon +
  expansion** dopuszcza pasujące uzupełnienia.

Generator nie czyta historii tur. Wszystko, czego brakuje w konfiguracji i wiedzy
o świecie, dopisz w polu **What should this world include?** albo **What should
be added?**

Wybierz rozmiar:

| Rozmiar    | Orientacyjny wynik |
| ---------- | ------------------ |
| **Small**  | 8 miejsc           |
| **Medium** | 16 miejsc          |
| **Large**  | 28 miejsc          |

Generowanie tworzy szkic, a nie zapisaną mapę. Przeszukaj albo rozwiń cały
podgląd, zaznacz lokalizacje i sprawdź ich ścieżki, opisy, prywatną pamięć modelu
oraz źródła w wiedzy o świecie. Zanim przejdziesz dalej, skorzystaj z przycisków
**Edit prompt**, **Regenerate** albo **Discard draft**.

Kliknij przycisk **Continue to editor** przy nowej mapie albo **Add to working
map** przy rozbudowie. Kiedy historia kampanii odwołuje się już do identyfikatorów
lokalizacji, World Maps chroni te odwołania i pozwala na rozbudowę zamiast
niepowiązanej wymiany całej mapy.

## Ręczne budowanie i edycja mapy

Przy pustej mapie kliknij przycisk **Build manually**. World Maps tworzy
jedną szeroką lokalizację startową. Zaznacz ją w hierarchii i użyj:

- przycisku **Add child**, żeby dodać miejsce wewnątrz zaznaczonej lokalizacji;
- przycisku **Add sibling**, żeby dodać miejsce obok niej, pod tą samą lokalizacją nadrzędną;
- przycisku **Duplicate**, żeby skopiować poddrzewo lokalizacji i potem je edytować;
- przycisku **Archive**, żeby wycofać miejsce bez kasowania odwołań z historii.

Miejsce, w którym zaczyna się fabuła, ustaw przyciskiem **Set as starting
location**. Zanim hierarchię da się włączyć, musi mieć aktywną lokalizację
startową. Włącz przełącznik **Enabled** i kliknij przycisk **Save**, kiedy
znikną wszystkie problemy zgłoszone przez edytor.

## Co dokładnie trafia do modelu

Przy każdym generowaniu z włączoną i zapisaną mapą model dostaje jeden wiążący
blok kontekstu przestrzennego, a w nim:

- aktualną ścieżkę nawigacji;
- dokładny identyfikator bieżącej lokalizacji i jej jawny opis;
- prywatną pamięć modelu dokładnej bieżącej lokalizacji, jeśli została uzupełniona;
- cele podróży osiągalne w jednym ruchu;
- ograniczony spis aktywnych znanych lokalizacji wraz z ich dokładnymi identyfikatorami.

Spis znanych lokalizacji pozwala odpowiedzi rozpoznać dotarcie w inne miejsce
zapisanego świata. Pobliskie cele podróży mogą też zasilić zwykłą narrację albo
wybory CYOA.

Nazwy lokalizacji nadrzędnych dają orientację, ale ich opisy, prywatna pamięć
modelu, grafiki i powiązana z nimi wiedza o świecie nie są dziedziczone. Jeśli
bieżąca lokalizacja to `Tower → Floor 7 → Alchemy Lab`, aktywne są szczegóły
laboratorium, a wieża i piętro wnoszą do ścieżki nawigacji tylko swoje nazwy.

**Private model memory** to zapisana notatka wyłącznie dla AI, a nie pamięć, która
sama się uzupełnia. Użyj jej do sekretów, nastroju, stałych zagrożeń, lokalnych
zasad albo faktów, które mają działać tylko w tym dokładnym miejscu. Informacje,
które muszą dotrzeć do modelu, wpisuj w jawnym opisie albo w prywatnej pamięci
modelu, a nie licz na samo krótkie podsumowanie.

## Poruszanie się w trakcie fabuły

World Maps obsługuje zakolejkowaną podróż, zaplanowane trasy i zweryfikowane
dotarcie prowadzone przez użytkownika. Ruch zapisuje się razem z turą, więc
lokalizacja podąża za wybraną historią wiadomości i wybranym swipe'em. Ponowne
uruchomienie aplikacji Marinara Engine nie resetuje celowo lokalizacji bieżącej,
a przełączenie na inną gałąź wiadomości albo inny swipe przywraca migawkę
przestrzenną zapisaną razem z tą historią.

### Kolejkowanie wskazanego celu

Wybranie celu ustawia ruch w kolejce, ale nie przenosi postaci od razu. Ruch
zostaje zatwierdzony razem z kolejną wysłaną wiadomością, dzięki czemu
lokalizacja i tura pozostają zgodne.

Cele osiągalne w jednym ruchu to:

- lokalizacja nadrzędna wobec bieżącej;
- aktywne lokalizacje podrzędne bieżącego miejsca;
- lokalizacje połączone dostępnym bezpośrednim przejściem.

Z jedną turą można zatwierdzić tylko jeden krok w hierarchii. Oczekujący cel
anulujesz ikoną X. Jeśli przed wysłaniem zmieni się wersja mapy albo bieżąca
lokalizacja, oczekujący ruch dostaje status **Needs review**.

### Planowanie trasy na wiele tur

Wybierz odległą aktywną lokalizację na mapie świata. Jeśli w grafie zależności
nadrzędna-podrzędna oraz dostępnych przejść istnieje droga, World Maps
pokazuje najkrótszą trasę i proponuje przycisk **Plan route**.

Trasa kolejkuje swój pierwszy krok. Każda kolejna wysłana tura użytkownika
zatwierdza jeden krok i kolejkuje następny, aż do osiągnięcia celu; nie ma
osobnego przycisku przejścia dalej. Trasę da się anulować w każdej chwili. Jeśli
mapa albo bieżąca lokalizacja zmieni się nieoczekiwanie, trasa dostaje status
**Needs review** zamiast zgadywać nową drogę.

Na przykład podróż z piętra Floor 1 do równorzędnego piętra Floor 25 zajmuje
zwykle jedną turę na wyjście do wieży i drugą na wejście na Floor 25.
Bezpośrednie przejście skraca taką drogę do jednego kroku.

### Podróż prowadzona przez użytkownika i odkrywanie nowych miejsc

O automatycznych zmianach mapy decyduje ostatnia wiadomość użytkownika:

- Bezpośredni ruch drużyny w czasie teraźniejszym albo w trybie rozkazującym
  ustala dotarcie na miejsce. Zdania "We go to the Kitchen" oraz "She moves into
  the outdoor section; we follow her" mogą przenieść fabułę do pasujących
  znanych lokalizacji.
- Wyraźne dotarcie do ważnego, nazwanego i trwałego miejsca, do którego da się
  wrócić, albo odkrycie takiego miejsca może dodać je do świata. Zdanie "We
  discover a hidden room" może utworzyć taką lokalizację i przenieść tam fabułę.
- Widoczna odpowiedź może opisać skutek, ale sama narracja AI nigdy nie zezwala
  na ruch ani na utworzenie nowej lokalizacji.
- Przyszłe zamiary, nieudana lub nieukończona podróż, wzmianki, ruch samych
  postaci NPC, miejsca wyobrażone, tymczasowe obozy, korytarze, pojazdy i inne
  przejściowe szczegóły nie tworzą lokalizacji ani nie przesuwają znacznika.

Model nadal musi zinterpretować sformułowanie użytkownika i wysłać ukrytą
dyrektywę pakietu, którą aplikacja weryfikuje. Różne modele językowe radzą sobie
z niejednoznaczną prozą różnie. Kiedy kolejna tura ma przenieść fabułę na pewno,
użyj przycisku **Set destination**, a do poprawienia już zapisanego stanu –
opcji **Set current story location**.

Zweryfikowane dotarcie prowadzone przez użytkownika może pominąć wymóg
osiągalności w jednym kroku: World Maps zapisuje wtedy w razie potrzeby dostępne
bezpośrednie przejście z lokalizacji bieżącej. Jeśli cel był już zakolejkowany,
ten ruch zapisuje się najpierw razem z wiadomością użytkownika, a dotarcie
prowadzone przez użytkownika staje się końcową lokalizacją wygenerowanej
odpowiedzi; jednorazowa kolejka zostaje wyczyszczona. Na zaplanowanej trasie
dotarcie do następnego zaplanowanego kroku przesuwa trasę normalnie. Dotarcie
gdzie indziej, w tym przeskok do dalszego kroku trasy, ustawia trasie status
**Needs review**, żeby pakiet nie przepisał planu po cichu. Anuluj taką trasę
albo zaplanuj ją ponownie z lokalizacji, w której fabuła się znalazła.

### Lokalizacja startowa a bieżąca lokalizacja fabuły

**Lokalizacja startowa** to miejsce domyślne na początku nowej fabuły. **Bieżąca
lokalizacja fabuły** to miejsce, w którym ten konkretny czat jest teraz. Zmiana
lokalizacji startowej nie naprawia bieżącej pozycji w istniejącym czacie.

Żeby poprawić zapisany stan, zaznacz aktywną lokalizację w panelu **Details**
edytora i wybierz **Set current story location**. To poprawka administracyjna,
a nie podróż opisana w narracji. Zaczyna działać po kliknięciu przycisku
**Save**, kasuje zakolejkowany cel podróży albo trasę i nie zmienia
wcześniejszych wiadomości.

### Podróż w trybie Roleplay

Nad polem wiadomości pojawia się kontrolka **Story location**.

1. Otwórz mapę fabuły, żeby obejrzeć hierarchię i aktualną ścieżkę nawigacji.
2. Zaznacz lokalizację, żeby przeczytać jej opis.
3. Przeglądaj mapę bez przenoszenia fabuły przyciskami **Explore inside**
   i **Browse up** albo ścieżką nawigacji.
4. Kliknij przycisk **Set destination** przy osiągalnym miejscu albo **Plan route**
   przy osiągalnym odległym celu.
5. Wyślij kolejną wiadomość, żeby zatwierdzić zakolejkowany krok.

### Podróż w trybie Game

Game Mode dodaje **Hierarchical world map**. Napis **You are here** oznacza
bieżącą lokalizację fabuły. Przeglądanie, centrowanie i oglądanie szczegółów nie
przenoszą drużyny. Zakolejkuj cel albo trasę, a potem wyślij kolejną turę gry.

Kiedy ostatnia wiadomość użytkownika ustala dotarcie drużyny na miejsce,
wygenerowana odpowiedź w trybie Game może wysłać ukrytą komendę zmieniającą
lokalizację w hierarchii. Szczegóły bieżącej lokalizacji stanowią wtedy podstawę
dla postaci GM, drużyny, grafiki sceny i pasującej referencji dla storyboardu.

## Hierarchical world map a zwykła mapa Game

Tryb Game może zawierać dwa systemy map:

- **World Maps** to wiążąca lokalizacja fabuły albo świata, na przykład
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Zwykła mapa Game, siatkowa albo węzłowa, to lokalny lub taktyczny szczegół
  wewnątrz tej lokalizacji fabuły; uczestniczy też w czasie i pogodzie gry.

Kiedy start gry należy do World Maps, świat początkowy pochodzi
z wybranego szablonu albo sprawdzonego szkicu. Zwykła mapa Game nie jest wtedy
używana ponownie jako materiał do promptu ani awansowana na zapasową hierarchię.

W zaawansowanych konfiguracjach lokalizacja w hierarchii może być powiązana
z całą mapą Game, jedną komórką siatki albo jednym węzłem. Wybranie powiązanej
pozycji na mapie Game przygotowuje odpowiedni ruch w hierarchii, a pozycje bez
powiązania zachowują zwykłe zachowanie taktyczne. Przed edycją powiązań zapisz
hierarchię. Usunięcie powiązania nie kasuje żadnej z map.

## Nadanie lokalizacjom wizualnej tożsamości

Referencje lokalizacji i tła map podrzędnych są od siebie niezależne, nawet gdy
korzystają z tego samego obrazu z galerii.

| Grafika                      | Do czego służy                                                                                                                          | Czy trafia do generowania obrazów?                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Location reference image** | Ustala wizualną tożsamość dokładnego bieżącego miejsca. Wybierz grafikę z galerii czatu albo ze wspólnej Global Gallery, albo utwórz ją przez AI. | Tak, jeśli włączona jest opcja **Use for Roleplay illustrations and Game storyboards**, a żądanie się kwalifikuje. |
| **Child map background**     | Wyświetla się za przesuwalnymi lokalizacjami podrzędnymi przy prezentacji Map. Każda warstwa mapy może mieć własne tło.                  | Nie. Służy wyłącznie do wyświetlania.                                                                             |

Referencje postaci i persony pilnują tego, kto jest obecny, a referencja
lokalizacji pilnuje tego, gdzie dzieje się scena. U dostawców, którzy to
obsługują, połączenie obu pomaga zachować spójność postaci i teł na kolejnych
obrazach.

Kiedy dołączona jest pasująca referencja lokalizacji, potok generowania obrazów
dodaje taką instrukcję:

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Każdy dostawca ma własne limity obrazów referencyjnych. Referencje podane wprost
w żądaniu oraz referencje postaci mogą zmniejszyć liczbę referencji dodawanych
automatycznie.

### Ustawienie jednej referencji lokalizacji

Zaznacz lokalizację w edytorze i otwórz sekcję **Location reference image**.

- **Choose artwork** przypisuje sprawdzony obraz z bieżącego czatu albo ze
  wspólnej Global Gallery. Okno wyboru opisuje każde źródło.
- **Create with AI** otwiera prompt obrazu ustanawiającego scenę do edycji
  i zapisuje wynik w galerii, zanim zdecydujesz, czy go użyć.
- **Use for Roleplay illustrations and Game storyboards** decyduje o tym, czy
  wybrany obraz bierze udział w kwalifikującym się generowaniu.

Przy lokalizacji nadrzędnej z prezentacją Map otwórz osobno sekcję **Child map
background**. Wybierz obraz z galerii, a potem ustaw go za znacznikami lokalizacji
podrzędnych. Sam fakt, że obraz jest widoczny na mapie, nigdy nie powoduje
wysłania go do dostawcy.

### Zbiorcze generowanie brakujących grafik lokalizacji

Sekcja **Location artwork** w edytorze wyszukuje lokalizacje bez referencji albo
bez tła mapy podrzędnej.

1. Kliknij przycisk **Review requests**.
2. Sprawdź liczbę żądań, zanim zużyjesz je u dostawcy.
3. Potwierdź połączenie do generowania obrazów, model, styl Engine, stan stylu
   grafik kampanii, zapisane instrukcje obrazu i rozmiar wyniku.
4. W razie potrzeby popraw każdy prompt pozytywny i negatywny.
5. Anuluj przegląd albo kliknij przycisk **Generate N images**, żeby potwierdzić.
6. Obejrzyj wygenerowane grafiki na mapie roboczej i kliknij przycisk **Save**.

Każdy brakujący obraz to osobne żądanie do dostawcy. W dużych światach bywa to
wolne i kosztowne, dlatego przegląd da się przewijać, a liczba żądań pozostaje
widoczna. Istniejące grafiki są w miarę możliwości używane ponownie, bez
kolejnego żądania. Nowy obraz staje się referencją lokalizacji, a także tłem mapy
podrzędnej, jeśli ta mapa go potrzebuje.

Do dostawcy trafiają dokładnie te prompty pozytywne i negatywne, które widać
w przeglądzie po edycji. Treść promptu pozytywnego nie jest kopiowana do promptu
negatywnego.

## Dostosowanie automatycznego promptu grafik

Otwórz **Settings → Generations → Prompt Overrides** (Ustawienia) i wybierz
pozycję **Maps location artwork**. To globalny szablon używany przy podglądzie
i generowaniu automatycznych grafik lokalizacji. Zmienne mają składnię
`${variableName}` i można je wstawiać z poziomu edytora.

| Zmienna                                             | Znaczenie                                                     |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `${locationName}`                                   | Nazwa lokalizacji                                             |
| `${locationDescription}`                            | Jawny opis dokładnej lokalizacji                              |
| `${locationType}`                                   | Region, Settlement, Place, Building, Floor albo Room          |
| `${locationPrompt}`                                 | Pełny zapasowy prompt ustanawiający scenę, przygotowany przez pakiet |
| `${parentLocationName}`                             | Nazwa bezpośredniej lokalizacji nadrzędnej albo pusty tekst w korzeniu |
| `${parentLocationDescription}`                      | Jawny opis bezpośredniej lokalizacji nadrzędnej albo pusty tekst |
| `${locationPath}`                                   | Pełna ścieżka nawigacji od korzenia do lokalizacji            |
| `${genre}` / `${genreLine}`                         | Gatunek gry, surowy albo z interpunkcją; poza trybem Game pusty |
| `${campaignArtStyle}` / `${campaignArtStyleLine}`   | Styl kampanii, tylko przy włączonej opcji **Use campaign art style** |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instrukcje obrazu zapisane w panelu Chat Settings, surowe albo sformatowane |

Wbudowany szablon korzysta z promptu dokładnej lokalizacji oraz opcjonalnie
z gatunku, stylu kampanii i zapisanych instrukcji obrazu. Domyślnie celowo nie
zawiera opisu lokalizacji nadrzędnej ani pełnej ścieżki, dzięki czemu punkt
orientacyjny w rodzaju wieży nie wciska się na każdy obraz lokalizacji podrzędnej
ani piętra.

Częste zmiany:

- Usuń `${genreLine}`, jeśli gatunek gry nie ma się pojawiać na automatycznych
  grafikach map.
- Zostaw `${campaignArtStyleLine}` tylko wtedy, gdy o tym materiale ma decydować
  przełącznik **Use campaign art style** ustawiany dla czatu. Przy wyłączonym
  przełączniku zmienna jest pusta.
- Dodaj `${parentLocationName}`, `${parentLocationDescription}` albo
  `${locationPath}` tylko wtedy, gdy dostawca potrzebuje tak szerokiego kontekstu.
- Przyciskiem **Reset to default** przywrócisz wbudowany szablon.

Profil stylu Engine oraz globalne ustawienia obrazu pozytywne i negatywne
nakładają się po tym szablonie. Pozostają częścią wspólnego procesu ilustracji,
a nie ustawieniami samego pakietu World Maps. Jeśli w prompcie negatywnym
zostaje nieoczekiwany tekst, sprawdź globalne negatywne ustawienie obrazu oraz
pole do edycji w przeglądzie.

## Powiązanie wiedzy o świecie z lokalizacjami

World Maps korzysta z wiedzy o świecie na dwa sposoby:

1. Generator AI może czytać wybrane lorebooki podczas szkicowania i rozbudowy.
2. Zapisana lokalizacja może aktywować wpisy, dopóki jest lokalizacją bieżącą.

Żeby dołączyć wiedzę o świecie działającą w trakcie czatu, zaznacz lokalizację,
otwórz sekcję **Linked lore**, przeszukaj dostępne wpisy, dołącz wybrane
i zapisz zmiany.

Otwarcie powiązanego wpisu lorebooka wyprowadza z edytora map. Jeśli inne
oczekujące zmiany mają przetrwać, najpierw zapisz mapę albo świadomie potwierdź,
że da się je odrzucić. World Maps 1.3.1 ostrzega, zanim to działanie odrzuci
niezapisane zmiany mapy.

Dołączone wpisy nie przechodzą z lokalizacji nadrzędnej na podrzędną. Wiedza
dołączona do Brinewatch nie aktywuje się w Tideglass Inn, o ile nie zostanie
dołączona także tam.

Wiedza przypisana do bieżącej lokalizacji nie wymaga dopasowania słowa
kluczowego, ale nie omija ustawień lorebooków. Wyłączone albo wykluczone
z czatu lorebooki i wpisy pozostają niedostępne, a warunki wpisu, moment
wstawiania, prawdopodobieństwo i limity tokenów nadal obowiązują. Brakujące
odwołania pozostają widoczne w edytorze, więc da się je naprawić albo odłączyć.

## Zaawansowane ustawienia promptów pakietu

Główna strona **Agents → World Maps** zarządza dwoma globalnymi systemami
promptów:

- **Generation prompt** to nazwana biblioteka dla trybów Roleplay i Game,
  używana przy szkicach i rozbudowach map przez AI. Każdy czat wybiera opcję
  niezależnie. Rozwinięty podgląd korzysta z bieżącej konfiguracji, postaci,
  wiedzy o świecie i kontekstu mapy, bez wysyłania żądania do modelu.
- **Turn prompt insert** steruje globalnym tekstem systemowym dla trybów Roleplay
  i Game, który przedstawia bieżącą lokalizację podczas zwykłych tur. Marinara
  zachowuje wokół niego własne opakowanie `<spatial_context>` i wymagane zmienne
  wiążące.

Pole **Connection Override** na tej samej stronie wpływa na szkice i rozbudowy
map tworzone przez AI. Zostaw je puste, żeby korzystać z połączenia bieżącego
czatu. Te ustawienia nie zastępują osobnego nadpisania **Maps location artwork**
w globalnych ustawieniach generowania.

Te kontrolki są przeznaczone do zaawansowanych zmian. Zachowaj wymagane zmienne
i przed zapisem korzystaj z rozwiniętych podglądów.

## Bezpieczny import, eksport i archiwizowanie

### Eksport przenośnej mapy

Przyciskiem **Export** w edytorze czatu, szablonu albo wspólnego świata pobierzesz
roboczą hierarchię jako plik `.world-map.json`. Najpierw wybierz, ile powiązanej wiedzy ma podróżować z mapą:

| Wariant wiedzy | Zawartość pliku |
| --- | --- |
| **Map only** | Hierarchia i czytelne pochodzenie powiązań lokalizacji z wiedzą, bez zawartości lorebooków. Brakujących wpisów nie da się odtworzyć. |
| **Map + linked entries** | Tylko wpisy powiązane z mapą i ścieżki folderów potrzebne do ich uporządkowania. To zalecany wariant przenośny. |
| **Map + complete lorebooks** | Wszystkie wpisy i foldery każdego powiązanego lorebooka, także niezwiązane z mapą. |

Przed udostępnieniem sprawdź listę lorebooków, liczbę wpisów, szacowany rozmiar oraz rozwijaną mapę powiązań. Kompletne lorebooki mogą zawierać prywatne lub niepowiązane notatki.
Pozostaw opcję **Include map artwork** włączoną, aby w tym
samym pliku umieścić powiązane grafiki lokalizacji i tła map lokalizacji
podrzędnych. Wyłącz ją, jeśli potrzebujesz mniejszej kopii. Starsze pliki `.hierarchical-map.json` nadal można importować.

### Import mapy i przywracanie przenośnej wiedzy

Przyciskiem **Import** wczytasz hierarchię do kopii roboczej czatu, niezależnego
szablonu albo wspólnego świata. Jeśli plik zawiera lorebooki, **Restore portable map lore** pokazuje grupy **Exact IDs**, **Unique content**, **Need a choice** i **New entries**.

Dokładny identyfikator wpisu jest wiążący wyłącznie w docelowym lorebooku. Identyfikator z innego źródła jest niejednoznaczny: wybierz właściwy wiersz `Lorebook → Entry (ID)` albo **Import a new copy**. Bez identyfikatora World Maps używa wpisu ponownie tylko wtedy, gdy cała jego przenośna treść i ustawienia mają jedno dopasowanie; sama nazwa nie wystarcza.

Po podglądzie wybierz strategię:

- **Import separate copies** nie używa istniejących wpisów i tworzy niezależne lorebooki, na przykład `Original Lorebook - Map Name (World Map)`, dodając **(copy)** lub **(copy N)** przy kolizji nazw.
- **Reuse matches & import the rest** zachowuje dokładne i jednoznaczne dopasowania, stosuje wybory dla niejednoznacznych wierszy i tworzy lorebooki tylko dla pozostałych wpisów.

Maps wymienia wykorzystane i utworzone lorebooki. Nowe kopie pozostają w bibliotece po usunięciu mapy. Engine **2.4.1** lub nowszy odświeża Lorebooks natychmiast; na **2.3.5–2.4.0** odśwież Marinara Engine raz po przywróceniu.

Dołączone grafiki również zostają odtworzone i przypisane ponownie. Grafiki czatu wracają do galerii docelowej, a wspólne są używane z Global Gallery lub dodawane tam raz. Sprawdź wynik i kliknij **Save**; sam import nie zapisuje mapy. **Map only** zachowuje czytelne pochodzenie i istniejące dokładne łącza ID, lecz bez treści nie odtworzy usuniętych lorebooków ani wpisów.

Kiedy historia kampanii odwołuje się już do mapy, importowane zmiany muszą
zachować dotychczasowe identyfikatory lokalizacji. Dodawaj i aktualizuj
lokalizacje, zamiast zastępować hierarchię inną, z niepowiązanymi
identyfikatorami.

### Archiwizowanie albo trwałe usuwanie lokalizacji

Archiwizowanie chroni stare odwołania. Zanim zarchiwizujesz lokalizację:

- przenieś albo zarchiwizuj jej aktywne lokalizacje podrzędne;
- w razie potrzeby wybierz inną aktywną lokalizację startową;
- wybierz aktywne zastępstwo, jeśli jest to bieżąca lokalizacja fabuły.

Zarchiwizowane lokalizacje da się przywrócić z panelu Details. World Maps 1.3.1
udostępnia też opcję **Delete permanently** dla zarchiwizowanej lokalizacji albo
w pełni zarchiwizowanej gałęzi, o ile jej usunięcie jest bezpieczne. Edytor
wyłącza to działanie, gdy lokalizacja jest zapisaną lokalizacją startową albo
bieżącą lokalizacją fabuły, występuje w historii wiadomości, ma powiązanie
z mapą Game, bierze udział w zakolejkowanym celu podróży lub w trasie albo należy
do czatu wciąż podpiętego do wspólnego świata. Edytor wspólnego świata i edytor
szablonu w ogóle nie pozwalają trwale usuwać lokalizacji. Najpierw rozwiąż
wskazaną zależność, w razie potrzeby odłącz podpięty czat albo zostaw lokalizację
w archiwum.

Trwałe usunięcie kasuje lokalizację ze szkicu roboczego i porządkuje odwołania
w hierarchii oraz w bezpośrednich przejściach dopiero po kliknięciu przycisku
**Save**. Zamknięcie edytora bez zapisu nadal odrzuca takie usunięcie. Usunięte
lokalizacje nie trafiają już do eksportu, a chronione lokalizacje z archiwum
nadal w nim są, żeby ich stałe identyfikatory wspierały historię i powiązane
dane. Nie edytuj wyeksportowanego pliku JSON, żeby obejść te zabezpieczenia.

## Rozwiązywanie problemów

### Brakuje pakietu World Maps w panelu Chat Settings

Sprawdź, czy pakiet jest zainstalowany, a aplikacja Marinara Engine została
uruchomiona ponownie. Aktywny czat musi być typu Roleplay albo Game. Włącz
przełącznik **Enable Agents**, a potem pakiet **World Maps** w sekcji
**Tracker Agents**.

### Brakuje przycisku Add to chat albo Link to chat w bibliotece światów

Zanim otworzysz bibliotekę, otwórz obsługiwany czat Roleplay albo Game.
Biblioteka nazywa czat docelowy i pokazuje przycisk **Add to chat** przy
szablonach oraz **Link to chat** przy wspólnych światach. Podczas konfiguracji
trybu Game odpowiednikami są **Use template** i **Use shared world**.

Jeśli podczas konfiguracji trybu Game biblioteka wymienia wspólne światy, ale nie
pokazuje przycisku **Use shared world**, przeglądarka może nadal korzystać ze
starszej wersji pakietu sprzed aktualizacji. W każdym otwartym edytorze map
zapisz mapę albo świadomie odrzuć jej szkic, a potem zamknij edytor. Zapisz
niezwiązaną pracę, raz odśwież aplikację Marinara Engine z pominięciem pamięci
podręcznej i otwórz konfigurację gry ponownie. Nowsze wydania aplikacji wprost
informują, kiedy aktualizacja pakietu wymaga takiego odświeżenia.

### Konfiguracja gry użyła złych albo zapasowych lokalizacji

Wybierz **Use template**, a potem – przed zakończeniem konfiguracji gry –
potwierdź opcję **Use template** dla niezależnej kopii albo **Use shared world**
dla podpięcia do wiążącego świata. Sprawdź i zapisz mapę gry. Szablon pozostaje
bez zmian, a podpięta gra trzyma zmiany jako nieopublikowane, dopóki nie
klikniesz przycisku **Publish**.

### Podpięty czat nadal pokazuje starszy wspólny świat

Czyste edytory podpiętych czatów zapisane w karcie przeglądarki, w której publikujesz, odświeżają się automatycznie. Czat z niezapisanymi lub nieopublikowanymi zmianami zachowuje szkic i pokazuje konflikt. Otwórz ponownie czaty w innych kartach lub oknach, aby pobrały nową wiążącą wersję.

### Nie da się włączyć mapy

Utwórz co najmniej jedną aktywną lokalizację i ustaw aktywną lokalizację
startową. Rozwiąż wszystkie problemy wypisane na górze edytora, a potem włącz
mapę i zapisz ją ponownie.

### Generowanie mapy przez AI jest niedostępne

Sprawdź, czy czat albo pole **Connection Override** w ustawieniach pakietu ma
działające połączenie z modelem językowym. Przed ponownym otwarciem generatora AI
zapisz albo odrzuć zmiany w edytorze. Przy rozbudowie wskaż aktywny cel. Przy
generowaniu opartym na wiedzy o świecie wybierz co najmniej jeden włączony
i niewykluczony lorebook.

### Generowanie mapy przez AI zgłasza niepełny albo niepoprawny JSON

Jeśli odpowiedź skończyła się przed uzyskaniem pełnego JSON, zwiększ **Max Output Tokens** połączenia albo wybierz mniejszy rozmiar mapy i wygeneruj ponownie. World Maps nie zużywa kolejnego żądania na naprawę niepełnej odpowiedzi.

Przy niepoprawnym JSON została już podjęta jedna próba naprawy samej składni. Wygeneruj ponownie; jeśli model stale zawodzi, użyj innego połączenia lub modelu. Zmiana **Max Output Tokens** służy przypadkowi niepełnego wyjścia.

### Bieżąca lokalizacja nie zmieniła się po wiadomości

Automatyczny ruch wymaga tego, żeby ostatnia wiadomość użytkownika wprost
ustaliła dotarcie drużyny na miejsce, a model wysłał poprawną ukrytą dyrektywę
pakietu. Sama narracja AI, zamiar, dyskusja, nieudana podróż, ruch samych postaci
NPC i miejsca przejściowe nie przesuwają znacznika. Spróbuj wprost, na przykład
"We go to the Kitchen." Kiedy kolejna tura ma przenieść fabułę na pewno, użyj
przycisku **Set destination**.

### Bieżąca lokalizacja zmieniła się po ponownym otwarciu czatu

Sprawdź, która gałąź wiadomości i który swipe są wybrane: lokalizacja bieżąca
podąża za migawką przestrzenną zapisaną razem z tą historią. Jeśli wybrana
historia jest właściwa, a znacznik nie, otwórz edytor map, zaznacz właściwą
aktywną lokalizację, wybierz **Set current story location** i kliknij przycisk
**Save**.

### Cel albo trasa ma status Needs review

Po zakolejkowaniu ruchu zmieniła się wersja mapy albo bieżąca lokalizacja.
Otwórz mapę fabuły, sprawdź aktualną ścieżkę i wybierz cel albo trasę jeszcze
raz. Jeśli pokazany cel nadal jest zakolejkowany, anuluj go przed ponownym
wyborem.

### Zaplanowana trasa nie przesuwa się dalej

Każda tura użytkownika powinna zatwierdzić pokazany następny krok i zakolejkować
kolejny. Nie ma osobnej kontrolki przejścia dalej. Jeśli jedna ukończona tura nie
przesuwa trasy, anuluj ją i zaplanuj ponownie z bieżącej lokalizacji. Jeśli
zapisana lokalizacja jest już błędna, użyj opcji **Set current story location**
i kliknij przycisk **Save**; ta poprawka administracyjna kasuje nieaktualną trasę.

### Ten czat ma korzystać z zupełnie innej mapy

Otwórz edytor map i wybierz **Replace / start over**. W razie potrzeby najpierw
zachowaj szablon albo eksport, a potem utwórz, zaimportuj, skopiuj albo podepnij
mapę zastępczą. Jeśli czat jest podpięty i ma zachować bieżącą hierarchię,
najpierw użyj opcji **Detach and keep copy**. Usunięcie i ponowne dodanie pakietu
World Maps nie kasuje jego mapy.

### Nie da się wybrać odległej lokalizacji

Skorzystaj z przycisku **Plan route**, jeśli istnieje aktywna droga przez
lokalizacje nadrzędne, podrzędne i przejścia. W przeciwnym razie dodaj dostępne
bezpośrednie przejście albo podróżuj przez osiągalne miejsca, po jednej turze
naraz. Kontrolki przeglądania nigdy nie przenoszą fabuły.

### Automatyczny prompt grafik zawsze zawiera gatunek gry

Otwórz **Settings → Generations → Prompt Overrides → Maps location artwork**
i usuń `${genreLine}` z szablonu. Zapisz nadpisanie, a potem otwórz przegląd
grafik ponownie.

### Styl kampanii pojawia się, choć ma być wyłączony

Sprawdź opcję **Chat Settings → Illustrator → Use campaign art style**. Przy
wyłączonym przełączniku zmienne `${campaignArtStyle}` i `${campaignArtStyleLine}`
są puste. Podsumowanie przeglądu powinno pokazywać styl grafik kampanii jako
**Off**.

### Punkt orientacyjny lokalizacji nadrzędnej pojawia się na każdym obrazie podrzędnym

Unikaj zmiennych `${parentLocationDescription}` i `${locationPath}` w globalnym
szablonie grafik, o ile nie są naprawdę potrzebne. Domyślny prompt lokalizacji
ogranicza się do dokładnego miejsca i pomija te szerokie pola.

### Negatywny prompt obrazu zawiera nieoczekiwane treści

Przed potwierdzeniem sprawdź i popraw pole negatywne. Potem zajrzyj do
wspólnego, globalnego negatywnego ustawienia obrazu. Szablon grafik pakietu buduje
prompt pozytywny i nie kopiuje go do pola negatywnego.

### Referencja lokalizacji nie jest używana na obrazach ani w storyboardach

Sprawdź, czy obraz nadal istnieje w galerii i czy na dokładnej bieżącej
lokalizacji włączona jest opcja **Use for Roleplay illustrations and Game
storyboards**. Tło mapy podrzędnej służy tylko do wyświetlania i nie zastąpi
referencji, o ile ten sam obraz z galerii nie zostanie przypisany także jako
referencja lokalizacji.

### Model ignoruje mapę

Sprawdź, czy pakiet World Maps jest aktywny w czacie, czy hierarchia ma
włączony przełącznik **Enabled**, czy ostatnie zmiany zostały zapisane i czy
bieżąca lokalizacja widnieje w kontrolce Story location. Do zaawansowanej
diagnozy użyj rozwiniętego podglądu w sekcji **Turn prompt insert**.

### Powiązana wiedza o świecie nie aktywuje się

Sprawdź, czy wpis jest dołączony do dokładnej bieżącej lokalizacji. Upewnij się
też, że wpis i lorebook są włączone, a lorebook nie jest wykluczony z czatu.

**Pozostałe zasady World Maps 1.3.1:** generowanie prowadzone, ponowne generowanie i kontynuacja nie tworzą tury użytkownika, więc nie zużywają zakolejkowanego celu ani kroku trasy. **Impersonate** tworzy wiadomość użytkownika: udana tura zatwierdza ruch raz, błąd dostawcy nie zatwierdza niczego, a nieaktualny ruch przechodzi do **Needs review**.

Marinara Engine **2.4.1** lub nowszy usuwa kompletne dyrektywy ruchu i odkryć Maps ze strumienia i zapisanych wiadomości, nie zmieniając zwykłego tekstu w nawiasach ani odstępów. Jeśli pojawi się surowa dyrektywa Maps, zaktualizuj Engine i World Maps, uruchom ponownie, gdy pojawi się prośba, i wygeneruj albo usuń wadliwą wiadomość.

Gdy jeden obraz Gallery pełni obie role, **Remove reference only** pozostawia go jako tło mapy podrzędnej, **Reject both and create replacement** wymienia oba zastosowania, a **Use for both** przypisuje nowy obraz do obu. Za brak uznawane jest też zapisane łącze Gallery, którego obraz już nie istnieje. Wynik generowania zakończonego podczas edycji uzupełnia tylko nadal puste role i nie nadpisuje nowego obrazu, przełącznika referencji, położenia tła, stanu archiwum ani innych zmian szkicu.

Przycisk **Open** przy powiązanej wiedzy opuszcza obszar mapy i otwiera lorebook. Czysty szkic zamyka się od razu; przy niezapisanych zmianach najpierw zapisz albo jawnie potwierdź odrzucenie. Jeśli importowana wiedza się nie aktywuje, sprawdź podsumowanie: **Map only** nie zawiera treści do odtworzenia. Użyj **Map + linked entries** albo **Map + complete lorebooks** i wybierz dokładne dopasowanie, niejednoznaczny cel lub osobną kopię. Wiedza powiązana z lokalizacją nadrzędną nie jest dziedziczona przez podrzędne.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Lorebooki](../lorebooks/overview.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Game Mode: mapa, czas i pogoda](../game/map-time-weather.md)
