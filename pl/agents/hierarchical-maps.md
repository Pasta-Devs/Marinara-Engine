# World Maps: konfiguracja, tworzenie map i podróże

> **Aktualna zgodność:** Ten przewodnik opisuje pakiet World Maps w wersji
> **1.2.0** na aplikacji Marinara Engine **2.3.5**. Pakiet obsługuje czaty Roleplay i Game.

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
pasująca wiedza o świecie stanowią podstawę kolejnej odpowiedzi. Mapa potrafi też
podążyć za opisaną i zakończoną podróżą do znanego miejsca albo dodać nowo
odkryte miejsce, gdy fabuła naprawdę tam dociera.

Każdy czat dostaje własną kopię roboczą mapy. Szablony zapisane na koncie
pozwalają przygotować autorski świat lub świat z fandomu raz, a potem dodać jego
czystą kopię do dowolnego czatu Roleplay lub Game.

## Przegląd możliwości

World Maps 1.2.0 daje:

- zagnieżdżone regiony, osady, miejsca, budynki, piętra i pomieszczenia;
- ścieżki nawigacji oraz jedną wiążącą lokalizację bieżącą fabuły;
- widok listy, mapy z pozycjami i uporządkowanych warstw dla lokalizacji podrzędnych;
- podróż w górę i w dół hierarchii, bezpośrednie przejścia i trasy na wiele tur;
- zweryfikowany ruch na podstawie zakończonej narracji i odkrywanie nowych lokalizacji;
- szablony map na koncie, tworzone ręcznie, przez AI albo z importu;
- szkice i rozbudowy map tworzone przez AI na podstawie konfiguracji lub wybranej wiedzy o świecie;
- jawne opisy lokalizacji, prywatną pamięć modelu oraz wiedzę o świecie przypisaną do dokładnego miejsca;
- jeden opcjonalny obraz referencyjny z galerii dla każdej lokalizacji;
- osobne tło z galerii dla każdej mapy z pozycjami;
- zbiorcze generowanie brakujących grafik lokalizacji z podglądem przed wysłaniem;
- globalne nadpisanie promptu grafik map, oparte na zmiennych;
- obsługę referencji lokalizacji w ilustracjach Roleplay i storyboardach Game;
- import, eksport, archiwizowanie, edycję świadomą historii oraz powiązania z mapami Game;
- globalne biblioteki promptów do budowania map przez AI i do wstawki o lokalizacji w trakcie gry.

Dostępne cele podróży trafiają do kontekstu modelu. Dzięki temu przy włączonych
wyborach CYOA model może zaproponować lokalizacje podrzędne albo połączone
miejsca jako kolejne opcje. Same treści wyborów nadal tworzy model.

## Szybki start

1. Otwórz sekcję **Agents** (Agenci), kliknij przycisk **Download Agents** (pobranie agentów) i zainstaluj pakiet **World Maps**.
2. Uruchom aplikację Marinara Engine ponownie, gdy pojawi się prośba. Pakiet zawiera kod serwera.
3. Otwórz czat Roleplay lub Game.
4. Otwórz **Agents → World Maps** i włącz pakiet dla bieżącego czatu.
   Da się to zrobić także w sekcji **Chat Settings → Agents** (ustawienia czatu) tego czatu.
5. Utwórz mapę przyciskiem **Use template**, **Create with AI** albo **Build
   manually**. Do istniejącego czatu można też zaimportować plik mapy.
6. Sprawdź roboczą hierarchię, wybierz lokalizację początkową, włącz mapę
   i kliknij przycisk **Save** (zapisanie).
7. W trakcie czatu otwórz panel **Story map**. Wybierz osiągalny cel podróży
   i wyślij kolejną turę albo opisz podróż naturalnie i pozwól odpowiedzi
   zmienić lokalizację, kiedy podróż się zakończy.
8. Opcjonalnie przypisz lokalizacjom grafiki z galerii albo skorzystaj z sekcji
   **Location artwork**, żeby przejrzeć i wygenerować brakujące obrazy.

Zastosowanie szablonu, szkicu AI lub zaimportowanego pliku zmienia wyłącznie
kopię roboczą w edytorze. Na odpowiedzi wpływa dopiero hierarchia włączona
i zapisana.

## Instalacja i włączenie pakietu

Otwórz sekcję **Agents** z zakładki Sparkles na prawym pasku bocznym. Kliknij
przycisk **Download Agents**, wybierz pakiet **World Maps** i kliknij
przycisk **Install**. Jeśli katalog zaproponuje potem **Update**, zainstaluj
także tę aktualizację. Zanim zaczniesz korzystać z pakietu, wykonaj polecenie
ponownego uruchomienia.

Strona World Maps pokazuje zainstalowaną wersję pakietu i jego gotowość,
udostępnia bibliotekę szablonów przypisaną do konta oraz stan mapy w bieżącym
czacie. Instalacja pakietu tylko go udostępnia, ale nie włącza go w każdym
czacie.

### Roleplay

1. Otwórz czat Roleplay.
2. Otwórz panel **Chat Settings** przyciskiem z zębatką.
3. Włącz przełącznik **Enable Agents**.
4. W sekcji **Tracker Agents** włącz pakiet **World Maps**.
5. Otwórz edytor **Edit hierarchical map** albo bibliotekę **Map templates**.

Biblioteka szablonów działa tak samo niezależnie od tego, czy otworzysz ją na
głównej stronie **Agents**, czy w panelu Chat Settings czatu Roleplay. Przyciskiem
**Add to chat** skopiujesz szablon do aktywnego czatu.

### Game

Podczas konfiguracji trybu Game wybierz World Maps, a następnie jedną
z dróg konfiguracji:

- **Create with AI** przygotowuje wygenerowaną hierarchię do sprawdzenia.
- **Use template** otwiera wybór szablonu jeszcze przed utworzeniem gry.
- **Build manually** zaczyna od pustej hierarchii do edycji.

Po wybraniu opcji **Use template** wskaż konkretny szablon i potwierdź wybór.
Konfiguracja tworzy kopię roboczą należącą do gry i przeznaczoną do sprawdzenia;
szablon na koncie nigdy nie jest zmieniany. Lokalizacje z wybranego szablonu
stają się hierarchicznym światem początkowym. Zwykła mapa Game nie jest wtedy
awansowana na jej miejsce.

World Maps da się też dodać do istniejącej gry później, w sekcji **Chat
Settings → Agents**.

## Tworzenie szablonów map i korzystanie z nich

Otwórz **Agents → World Maps → Open map templates**. Szablony należą do
konta, a nie do pojedynczego czatu, więc dobrze sprawdzają się przy światach
z fandomów, ustawieniach kampanii, lochach, miastach i własnych mapach
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

Szablony nie kopiują grafik z galerii czatu. Identyfikatory obrazów należą do
galerii czatu źródłowego i nie dałoby się ich przenieść. Referencje lokalizacji
i tła map w czacie roboczym dodaj albo wygeneruj po zastosowaniu szablonu.

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

World Maps obsługuje jawną podróż, zaplanowane trasy i zweryfikowane
dotarcie opisane w narracji. Ruch zapisuje się razem z turą, więc lokalizacja
podąża za wybraną historią wiadomości i wybranym swipe'em.

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

Trasa kolejkuje swój pierwszy krok. Każda kolejna tura zatwierdza jeden krok
i kolejkuje następny, aż do osiągnięcia celu. Trasę da się anulować w każdej
chwili. Jeśli mapa albo bieżąca lokalizacja zmieni się nieoczekiwanie, trasa
dostaje status **Needs review** zamiast zgadywać nową drogę.

Na przykład podróż z piętra Floor 1 do równorzędnego piętra Floor 25 zajmuje
zwykle jedną turę na wyjście do wieży i drugą na wejście na Floor 25.
Bezpośrednie przejście skraca taką drogę do jednego kroku.

### Podróż opisana w narracji i odkrywanie nowych miejsc

Model dostaje zabezpieczone instrukcje dotyczące zakończonego dotarcia na miejsce:

- Jeśli odpowiedź naprawdę doprowadza do znanej aktywnej lokalizacji,
  World Maps może przenieść tam lokalizację bieżącą. Jeśli fabuła
  odsłoniła nową drogę, zapisuje bezpośrednie dostępne połączenie.
- Jeśli odpowiedź naprawdę doprowadza do nieznanego, trwałego miejsca,
  World Maps może dodać je jako lokalizację podrzędną albo połączoną,
  przenieść tam fabułę i zachować drogę powrotną.
- Zamiary, wzmianki, nieudana lub nieukończona podróż, tymczasowe obozy, korytarze
  i pojazdy nie tworzą lokalizacji ani nie przesuwają znacznika.

Na przykład po zdaniu użytkownika "Let's get quests from the Quest Hall"
odpowiedź, która doprowadza postacie na miejsce, może przenieść kolejny stan
fabuły do Quest Hall. Zdanie "We should visit the Quest Hall later" powinno
zostawić bieżącą lokalizację bez zmian.

Aplikacja weryfikuje takie zachowanie, ale to model musi rozpoznać, że dotarcie
naprawdę nastąpiło. Kiedy potrzebny jest pewny ruch, użyj przycisku **Set
destination**.

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

Wygenerowana odpowiedź w trybie Game potrafi też zmienić lokalizację
w hierarchii po zakończonym dotarciu opisanym w narracji. Szczegóły bieżącej
lokalizacji stanowią wtedy podstawę dla postaci GM, drużyny, grafiki sceny
i pasującej referencji dla storyboardu.

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
| **Location reference image** | Ustala wizualną tożsamość dokładnego bieżącego miejsca. Wybierz obraz z galerii albo utwórz go przez AI.                                 | Tak, jeśli włączona jest opcja **Use for Roleplay illustrations and Game storyboards**, a żądanie się kwalifikuje. |
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
w żądaniu oraz referencje postaci zmniejszają liczbę referencji dodawanych
automatycznie.

### Ustawienie jednej referencji lokalizacji

Zaznacz lokalizację w edytorze i otwórz sekcję **Location reference image**.

- **Choose from Gallery** przypisuje istniejący, sprawdzony obraz.
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
2. Sprawdź liczbę żądań, zanim zużyjesz żądania u dostawcy.
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

Żeby dołączyć wiedzę o świecie działającą w trakcie gry, zaznacz lokalizację,
otwórz sekcję **Linked lore**, przeszukaj dostępne wpisy, dołącz wybrane
i zapisz zmiany.

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
  nadrzędne.

Pole **Connection Override** na tej samej stronie wpływa na szkice i rozbudowy
map tworzone przez AI. Zostaw je puste, żeby korzystać z połączenia bieżącego
czatu. Te ustawienia nie zastępują osobnego nadpisania **Maps location artwork**
w globalnych ustawieniach generowania.

Te kontrolki są przeznaczone do zaawansowanych zmian. Zachowaj wymagane zmienne
i przed zapisem korzystaj z rozwiniętych podglądów.

## Bezpieczny import, eksport i archiwizowanie

Przyciskiem **Export** pobierzesz roboczą hierarchię jako plik
`.world-map.json`. Pozostaw opcję **Include map artwork** włączoną, aby w tym
samym pliku umieścić referencje grafik lokalizacji i tła map lokalizacji
podrzędnych. Wyłącz ją, jeśli potrzebujesz mniejszej kopii zawierającej tylko
definicję. Starsze pliki `.hierarchical-map.json` nadal można importować.

Przyciskiem **Import** wczytasz hierarchię do kopii roboczej. Dołączone grafiki
zostaną odtworzone w Gallery czatu docelowego, a ich odwołania zostaną
przypisane ponownie. Sprawdź wynik i kliknij przycisk **Save**, żeby stał się
wiążący. Import nie zapisuje mapy od razu.

Kiedy historia kampanii odwołuje się już do mapy, importowane zmiany muszą
zachować dotychczasowe identyfikatory lokalizacji. Dodawaj i aktualizuj
lokalizacje, zamiast zastępować hierarchię inną, z niepowiązanymi
identyfikatorami.

Archiwizowanie chroni stare odwołania. Zanim zarchiwizujesz lokalizację:

- przenieś albo zarchiwizuj jej aktywne lokalizacje podrzędne;
- w razie potrzeby wybierz inną aktywną lokalizację startową;
- wybierz aktywne zastępstwo, jeśli jest to bieżąca lokalizacja w grze.

Zarchiwizowane lokalizacje da się przywrócić z panelu Details.

## Rozwiązywanie problemów

### Brakuje pakietu World Maps w panelu Chat Settings

Sprawdź, czy pakiet jest zainstalowany, a aplikacja Marinara Engine została
uruchomiona ponownie. Aktywny czat musi być typu Roleplay albo Game. Włącz
przełącznik **Enable Agents**, a potem pakiet **World Maps** w sekcji
**Tracker Agents**.

### Brakuje przycisku Add to chat w bibliotece szablonów

Zanim otworzysz bibliotekę, otwórz obsługiwany czat Roleplay albo Game.
Biblioteka pokazuje przycisk **Add to chat** zarówno z głównej strony
World Maps, jak i z ustawień danego czatu. Podczas konfiguracji trybu Game
odpowiednikiem jest **Use template**.

### Konfiguracja gry użyła złych albo zapasowych lokalizacji

Wybierz **Use template**, wskaż konkretny szablon i potwierdź go przed
zakończeniem konfiguracji gry. Sprawdź kopię roboczą należącą do gry i zapisz ją.
Szablon na koncie pozostaje bez zmian.

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

### Bieżąca lokalizacja nie zmieniła się po wiadomości

Automatyczny ruch wymaga tego, żeby wygenerowana odpowiedź faktycznie kończyła
podróż i zawierała poprawną ukrytą dyrektywę pakietu. Zamiar, rozmowa, nieudana
podróż i miejsca przejściowe nie przesuwają znacznika. Kiedy kolejna tura ma
przenieść fabułę na pewno, użyj przycisku **Set destination**.

### Cel albo trasa ma status Needs review

Po zakolejkowaniu ruchu zmieniła się wersja mapy albo bieżąca lokalizacja.
Otwórz mapę fabuły, sprawdź aktualną ścieżkę i wybierz cel albo trasę jeszcze
raz.

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

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Lorebooki](../lorebooks/overview.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Game Mode: mapa, czas i pogoda](../game/map-time-weather.md)
