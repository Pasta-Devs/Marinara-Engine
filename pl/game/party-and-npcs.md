# Game Mode: drużyna i postacie NPC

Ten przewodnik opisuje osoby z twojej kampanii w trybie Game Mode: członków drużyny oraz postacie NPC (postacie niezależne), które wprowadza mistrz gry (Game Master, w skrócie GM). Dowiesz się z niego, jak otwierać i edytować arkusze postaci, zarządzać ekwipunkiem, czytać Adventure Journal (dziennik przygody) i wybrać tryb GM. Konfigurację i podstawy opisuje przewodnik [Game Mode: pierwsze kroki](getting-started.md).

## Sprawdzanie drużyny i ekwipunku

1. Kliknij **Character Profiles** (profile postaci) i wybierz portret, żeby zobaczyć arkusz tej postaci.
2. Kliknij **Inventory** (ekwipunek) nad tekstem opowieści, żeby zobaczyć, co kto niesie.

Szczegóły obu opisano niżej.

<a id="character-profiles"></a>

## Character Profiles

**Character Profiles** to przycisk z portretem, który pokazuje, kto podróżuje razem z tobą. Zostaje poza menu **Chat tools** (narzędzia czatu; zobacz [Kontrolki gry](getting-started.md#the-games-controls)). Przy kilku członkach drużyny pokazuje po kolei ich portrety i plakietkę z liczbą. Zanim opowieść kogokolwiek doda, drużyna składa się tylko z twojej persony.

1. Kliknij albo dotknij przycisku **Character Profiles**.
2. Kliknij albo dotknij portretu, żeby otworzyć arkusz tej postaci.

Żeby usunąć towarzysza, na komputerze najedź na jego portret i kliknij **X**. Działa to przy każdym towarzyszu zwerbowanym przez GM, zarówno podczas konfiguracji, jak i później. Twoja persona (postać, w którą się wcielasz) nie ma przycisku **X**.

Ten przycisk możesz przeciągać po czacie na komputerze i na telefonie. Otwórz go i użyj **Lock window** (Zablokuj okno), żeby pozostał na miejscu. Na komputerze możesz też przesuwać okno i zmieniać jego rozmiar, a **Close** (Zamknij) zmienia je z powrotem w przycisk. Jego położenie zapisuje się razem z czatem, a wygląd dopasowuje się do stylu widgetów czatu z **Settings → Appearance → App** (ustawienia, wygląd, aplikacja). Na telefonie pozostaje osobno, poza menu **Chat tools** z trzema kropkami.

## Arkusze postaci

Arkusz postaci to podsumowanie jednego członka drużyny na potrzeby gry, oddzielne od karty postaci. GM pisze go na podstawie twojej postaci i bieżącej historii. Arkusz pokazuje te sekcje, które mają treść:

| Sekcja | Zawartość |
| --- | --- |
| **Attributes** (atrybuty) | Wartości takie jak STR, DEX i CON z modyfikatorem oraz paski zasobów, na przykład HP albo MP. |
| **Stats** (statystyki) | Inne paski statystyk. |
| **Abilities** (zdolności) | To, co postać potrafi zrobić. |
| **Strengths** (mocne strony), **Weaknesses** (słabe strony) | Krótkie listy. |
| **Details** (szczegóły) | Dodatkowe fakty, na przykład Skills, Weapon albo Faction. |
| **Inventory** | Przedmioty, które postać ma przy sobie. |
| **Traits** (cechy) | Pozostałe własne pola. |

Przy nowej postaci może pojawić się napis "Character data will populate as the story progresses." Arkusz uzupełnia się w trakcie gry.

<a id="edit-a-sheet-by-hand"></a>

### Ręczna edycja arkusza

Przyciski **Retry** (ponów), **Save Sheet** (zapisanie arkusza) i **Cancel** (anuluj) pojawiają się dopiero po kliknięciu **Edit card** (edycja karty).

1. Otwórz arkusz postaci i kliknij **Edit card**.
2. Zmień to, czego potrzebujesz:
   - **Class** (klasa) i krótki opis w sekcji **Sheet Details** (szczegóły arkusza).
   - **RPG Attributes** (atrybuty RPG): włącz **Enable** (włącz), żeby śledzić pule i atrybuty. **Add Pool** (dodanie puli) dodaje pasek (nazwa, wartość bieżąca, wartość maksymalna, kolor). **Add Attribute** (dodanie atrybutu) dodaje wartość taką jak STR.
   - **Abilities**, **Strengths** i **Weaknesses**: **Add** (dodaj) dopisuje kolejną linię.
   - **Details**: **Add Detail** (dodanie szczegółu) dodaje opisany fakt.
3. Kliknij **Save Sheet**. Kliknij **Cancel**, żeby odrzucić zmiany.

Żeby AI utworzyła arkusz od nowa, kliknij **Retry** w trakcie edycji. Korzysta przy tym z postaci i bieżącej historii gry, a także wysyła żądanie do twojego modelu. Tworzy szkic: "new sheet draft is ready. Review it, then save to apply." Przejrzyj szkic, a potem kliknij **Save Sheet**. Przydaje się to wtedy, gdy historia mocno odmieniła postać. Na wąskim ekranie przycisk pokazuje tylko ikonę.

<a id="the-ruleset-sheet"></a>

### Arkusz zestawu zasad

W grze z zestawem zasad każdy arkusz zaczyna się od bloku **Ruleset sheet** (arkusz zestawu zasad) o układzie określonym przez zestaw zasad: jego zasoby, tory, stany, odpoczynki i podsumowanie budowy postaci, które GM aktualizuje na bieżąco podczas narracji. Zobacz [Arkusz zestawu zasad](rulesets.md#the-ruleset-sheet).

## Werbowanie i usuwanie członków drużyny

O składzie drużyny decyduje GM przez narrację. Nie ma przycisku "dodaj towarzysza".

Gdy GM dodaje postać NPC, której imię dokładnie pasuje do jednej z twoich kart postaci albo do kilku z nich, okno pyta, która ma dołączyć. Pokazuje imię, tytuł i awatar każdej karty. Wybierz kartę albo opcję **Keep the game's own** (zachowaj postać z gry) z imieniem postaci NPC (na przykład **Keep the game's own Emma**), żeby wprowadzić postać utworzoną przez grę. Zamknięcie okna działa tak samo. Karta, której imię jest tylko podobne, na przykład **Samantha** przy postaci NPC o imieniu Sam, nigdy nie zostaje dodana.

Experience może dostarczać własnych towarzyszy: mieszkańców swojego świata, którzy mogą do ciebie dołączyć, każdy z gotowym arkuszem. Opowieść może sprowadzić taką postać albo ją odesłać, a GM może werbować tylko tych towarzyszy (twoje postacie z biblioteki nadal mogą dołączyć). Towarzysz dołącza na najwyższym poziomie w twojej drużynie i awansuje razem z nią.

## Ekwipunek

Kliknij przycisk **Inventory** nad tekstem opowieści. Otworzy się siatka kwadratów. Każdy kwadrat to stos: przedmiot i liczba jego sztuk. Kliknij stos, żeby go zaznaczyć.

Każdy członek drużyny ma własną torbę. Ekwipunek otwiera się na zakładce **All** (wszystko), która pokazuje wszystkie torby razem, z imieniem osoby niosącej przy każdym stosie. Kliknij zakładkę członka drużyny, żeby zobaczyć tylko jego torbę. Dopóki nikt inny niczego nie niesie, zakładek nie ma.

- **Zmiana liczby.** Użyj **-** i **+**, żeby odjąć albo dodać jedną sztukę. Możesz też wpisać liczbę w pole między nimi i nacisnąć <kbd>Enter</kbd>.
  - Liczba ustawia liczbę sztuk: `300`.
  - Znak dodaje albo odejmuje tyle sztuk: `+100`, `-50`.
  - Ustawienie 0 usuwa stos, a gdy sztuk jest więcej niż jedna, aplikacja najpierw pyta.
- **Dzielenie stosu.** Kliknij **Split** (podziel), wpisz, ile sztuk ma trafić do nowego stosu, i ponownie kliknij **Split**.
- **Przekazanie.** Kliknij **Give** (przekaż), wybierz, kto dostaje przedmiot i ile sztuk, i ponownie kliknij **Give**. Możesz też przeciągnąć cały stos na zakładkę tej osoby.
- **Dodawanie.** Wpisz nazwę przedmiotu i kliknij **Add**. Przedmiot trafia do torby z otwartej zakładki, a z zakładki **All** do twojej torby. Dodanie przedmiotu, który torba już ma, dodaje jedną sztukę do jego pierwszego stosu.
- **Łączenie.** Przeciągnij stos na inny stos tego samego przedmiotu. Połączony stos zostaje u osoby, która niosła stos, na który go upuszczono.
- **Zamiana.** Przeciągnij stos na inny przedmiot, żeby zamienić je miejscami.
- **Użycie.** Kliknij **Use** (użyj), żeby poinformować GM, że używasz przedmiotu.
- **Przydomek.** Wpisz nową nazwę i kliknij **Save** (zapis). Przedmiot zachowuje własną nazwę, widoczną obok, a przydomek nigdy nie łączy stosów. Żeby usunąć przydomek, wpisz z powrotem własną nazwę.

### Jak GM zmienia ekwipunek

GM w miarę rozwoju opowieści dodaje, usuwa i przekazuje przedmioty, podając, kto je niesie.

- Gdy zabiera przedmiot bez wskazania, kto go ma, bierze go najpierw z twojej torby, a potem od drużyny.
- Zmiana niemożliwa, na przykład zabranie czegoś, czego nikt nie ma, zostaje odrzucona, a GM dostaje o tym informację.
- Zmiany następują przy zapisie odpowiedzi. Ponowne wygenerowanie odpowiedzi zaczyna od stanu z początku tej tury. Przejście swipe'em wstecz pokazuje to, co zostawiła tamta wersja. Gałąź zachowuje ekwipunek każdej wersji.
- Jeśli coś zmienisz samodzielnie, nowa odpowiedź dokłada swoje zmiany na wierzch i nic z twoich działań nie zostaje cofnięte.
- Walka korzysta z przedmiotów przez akcję **Items** (przedmioty) i liczy razem wszystkie stosy danego przedmiotu.
- Każda torba, każdy podział i każdy przydomek przechodzą do następnej sesji.

## Panel Adventure Journal

Panel Adventure Journal to bieżąca kronika kampanii. Powstaje z zapisanych zdarzeń gry, a nie z tekstu pisanego przez AI, więc trzyma się faktów.

1. Otwórz **Session** (sesja; zobacz [Otwieranie Session](sessions-and-saves.md#opening-session)).
2. Wybierz zakładkę **Journal** (dziennik).

| Zakładka | Co pokazuje |
| --- | --- |
| **Timeline** (oś czasu) | To, co się wydarzyło: odkryte lokacje, spotkania z postaciami NPC, wyniki walk, zadania i zdarzenia dotyczące przedmiotów. |
| **NPCs** | Napotkane postacie NPC z portretami i etykietami reputacji. |
| **Map** (mapa) | Zwykła lista nazw odkrytych lokacji. |
| **Items** | Rejestr przedmiotów zdobytych, użytych, zgubionych i usuniętych. |
| **Library** (biblioteka) | Notatki i księgi ze świata gry, które pokazał ci GM, zapisane do ponownego czytania. |
| **Notes** (notatki) | Twój własny notatnik. |
| **World** (świat) | W grze z wygenerowanym światem: świat taki, jakim zna go twoja drużyna. |

Zakładka **World** pokazuje, gdzie jesteś i jak dobrze znana jest drużyna, jej pozycję wobec każdej grupy, czego dokonała, wieści, które do niej dotarły (plotki są oznaczone), nadciągające kłopoty, o których słyszała, oraz przeszłość, o której opowiedziałby każdy miejscowy. Pokazuje tylko to, co drużyna mogła wiedzieć. Sekrety znane tylko GM pozostają ukryte. Podąża za opowieścią przez swipe'y i gałęzie.

### Notatki gracza

Na zakładce **Notes** wpisuj tekst po lewej, a po prawej pojawia się sformatowany podgląd. Podpis ostrzega, że notatki widzą GM i członkowie drużyny, więc wszystko, co napiszesz, może wpłynąć na historię. Notatki zapisują się chwilę po przerwie w pisaniu. Etykieta pokazuje **Saving...** (zapisywanie), a potem **Saved** (zapisano).

### Etykiety reputacji postaci NPC

Przy każdej postaci NPC na zakładce **NPCs** widać portret, imię i etykietę reputacji, która zmienia się wraz z twoimi poczynaniami. Postać NPC pojawia się tam, gdy GM ją opisze, nada jej reputację albo zapisze notatkę o relacji. Etykieta pojawia się dopiero wtedy, gdy reputacja odsunie się od wartości początkowej, więc zupełnie nowa postać NPC nie ma żadnej.

| Etykieta | Znaczenie |
| --- | --- |
| **Devoted** | Głęboko ci oddana |
| **Allied** | Silny sojusznik |
| **Friendly** | Nastawiona pozytywnie |
| **Neutral** | Bez wyraźnych uczuć |
| **Unfriendly** | Nastawiona negatywnie |
| **Hostile** | Zwrócona przeciwko tobie |
| **Enemy** | Czynnie wroga |

W każdym wierszu postaci NPC możesz też wgrać albo podmienić portret, wygenerować portret przez AI (jeśli generowanie obrazów jest włączone) i usunąć postać NPC z dziennika.

## Tryby mistrza gry

To, kto prowadzi grę, wybierasz w kreatorze konfiguracji, w kroku **Party** (drużyna), w sekcji **Game Master Mode** (tryb mistrza gry). Tryb ustawia się przy tworzeniu gry.

- **Standalone GM** (domyślnie): Marinara buduje mistrza gry za ciebie. Kreator opisuje go słowami "A snarky narrator running the show". Karta postaci nie jest potrzebna.
- **Character GM**: mistrzem gry jest jedna z twoich własnych kart postaci. Model wciela się w tę postać i jednocześnie prowadzi grę. Wybierz tę opcję, gdy chcesz mieć konkretny głos narratora.

Przy pierwszej grze wybierz **Standalone GM**.

## Informacje: ekwipunek w grach z zestawem zasad

Te części dotyczą tylko gier, które korzystają z zestawu zasad albo z zestawu settingu z pieniędzmi. Zobacz [Gra z zestawem zasad](rulesets.md).

### Przedmioty z zestawu zasad

Te kontrolki pojawiają się tylko wtedy, gdy gra korzysta z zestawu zasad, który ma przedmioty.

- **From the ruleset** (z zestawu zasad) otwiera okno wyboru przedmiotów zestawu z jego wyszukiwaniem i filtrami. Zaznacz przedmioty i kliknij **Add**: po jednej sztuce każdego trafia tam, gdzie **Add** umieszcza przedmiot. Wpisana nazwa, która jest nazwą przedmiotu zestawu, dodaje ten przedmiot. Niektóre zestawy przyjmują wyłącznie własne przedmioty i wtedy nie ma pola do wpisania nazwy.
- **Starting gear** (wyposażenie początkowe) otwiera wyposażenie, które zestaw oferuje na start. W polu **For** (dla) wybierz, dla kogo jest, dokonaj wyborów, o które prosi zestaw wyposażenia, i kliknij **Take** (weź). Wyposażenie pasujące do arkusza postaci jest na liście jako pierwsze. Branie wyposażenia jest opcjonalne. Gdy wszystko zostanie wzięte, przycisk pokazuje **Starting gear (taken)** (wyposażenie początkowe wzięte).
- Kliknięcie **Use** przy przedmiocie zestawu, który określa swoje działanie, na przykład przy okładzie leczniczym, sprawia, że Marinara najpierw sama go stosuje:
  - Rzuca na to, co przedmiot przywraca, i zapisuje wynik w arkuszu osoby, która go niesie.
  - Odejmuje jedną sztukę ze stosu albo zużywa ładunek i informuje GM, co się stało.
  - To, co przedmiot robi komuś innemu, pozostawia GM.
  - Przedmiot bez pozostałych użyć zostaje odrzucony, a przedmiot, który trzeba nosić, działa tylko wtedy, gdy jest noszony.
  - Niektóre przedmioty najpierw wymagają testu, na przykład zwój powyżej poziomu, który potrafisz odczytać. Marinara wykonuje rzut, a jeśli test się nie uda, przedmiot zostaje zużyty na nic.
- Zaznaczony przedmiot z zestawu pokazuje swój rodzaj, rzadkość, tagi, statystyki i opis. Stos mieści tylko tyle sztuk, ile określa zestaw, a nadmiar zaczyna nowy stos.
- GM może wymyślić przedmiot w słownictwie zestawu, na przykład ostrze z własną nazwą. Działa on jak przedmiot zestawu, a jego szczegóły podają, że został wymyślony, i co Marinara zmieniła, żeby pasował do zestawu, na przykład premię ograniczoną do tego, na co pozwala jego rzadkość.
- Niektóre zestawy wyłączają własne przedmioty trybu Game Mode. GM daje wtedy tylko przedmioty zestawu i te, które wymyśli, a ty nadal możesz wpisywać własne przedmioty, chyba że zestaw przyjmuje wyłącznie własne.

### Noszenie, wiązanie i dźwiganie

Zestaw zasad może określać, jak jego przedmioty się nosi i dźwiga.

- **Equipped** (założony). Przedmiot zajmujący miejsca, na przykład zbroja na ciele albo łuk w obu rękach, ma przycisk **Equipped**. Jego właściciel może go założyć, dopóki te miejsca są wolne. Zakładka torby pokazuje zajęte miejsca, na przykład **Hands 2/2**. Założenie jednej sztuki z większego stosu przenosi ją do osobnego stosu oznaczonego jako noszony.
- **Wiązanie.** Przedmiot, który trzeba ze sobą związać, żeby działał (zestrojenie, inwestytura), ma przycisk nazwany słowem, którego używa zestaw, na przykład **Bound** (związany). Postać może związać tylko tyle przedmiotów, na ile pozwala arkusz, co widać jako **Bound 1/3**. Przeklętego przedmiotu raz związanego nie da się rozwiązać, zdjąć, oddać ani wyrzucić. Klątwę może zakończyć tylko opowieść, przez GM.
- **Dźwiganie.** Gdy zestaw określa wagi i udźwig, każda torba pokazuje swoje obciążenie, na przykład **Load 5/6, at most 12**, a po przekroczeniu tego, co jej właściciel niesie bez trudu, **Encumbered** (obciążony). Przedmiot dodany z zakładki **All** trafia do kogoś, kto może go nieść bez przeciążenia: najpierw do ciebie, potem do członków drużyny po kolei. Jeśli nikt nie może, przedmioty są rozdzielane według wolnego miejsca każdego z nich i nikt nie dostaje więcej, niż w ogóle może unieść. To, czego nikt nie uniesie, zostaje na miejscu, a aplikacja cię o tym informuje. **Give** albo przeciągnięcie stosu do torby, która przekroczyłaby swój limit, zostaje odrzucone.

Przekazanie noszonego albo związanego przedmiotu komuś innemu zdejmuje go i zrywa więź. W zestawie z tymi zasadami GM także zakłada i zdejmuje przedmioty, wiąże je i rozwiązuje oraz widzi obciążenie, miejsca i związane przedmioty każdej postaci.

### Pieniądze i rynki

Zestaw zasad może mieć własne pieniądze: rodziny monet, na przykład pensy, szylingi i korony, w których każda większa moneta jest warta określoną liczbę najmniejszych. Monety są stosami jak każdy przedmiot. Ważą tyle, ile określa zestaw, liczą się do obciążenia osoby, która je niesie, i można je dzielić, przekazywać i łączyć. **From the ruleset** ma listę **Coins** (monety) do ręcznego dodawania monet. Nad stosami wiersz pokazuje każdą rodzinę monet z otwartej zakładki i jej łączną wartość, na przykład **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

- GM pobiera od drużyny opłaty i płaci jej w tych monetach. Wygrana walka albo wylosowany skarb też mogą je dawać. Płatność pochodzi z sakiewki jednej postaci, twojej, chyba że GM wskaże czyją.
- Cenę płaci się tylko w rodzinie, w której ją podano, więc cenę w soli płaci się solą. Najpierw idą największe monety, a gdy dokładnej kwoty nie ma, większa moneta jest rozmieniana, a reszta wraca w mniejszych.
- Cena, której sakiewka nie pokryje, zostaje odrzucona, a GM dostaje o tym informację. Każda płatność i każdy zarobek pojawiają się jako powiadomienie.
- Wariant zestawu może pomijać jakąś monetę. Wtedy nikt nie płaci tą monetą ani nie dostaje w niej zapłaty, a cena w niej podana jest pokazywana w pozostałych monetach, w tej samej wartości.

Zestaw może też mieć rynki, więc to, co można kupić, zależy od miejsca, w którym jesteś.

- GM określa, w jakim miejscu toczy się scena i jak duże jest to miejsce – przysiółek czy miasto w słownictwie zestawu. Małe miejsce sprzedaje mniej: rzadkie rzeczy mogą być dostępne dopiero w miasteczku, a niektórzy sprzedawcy prowadzą sklep tylko w większych miejscach albo obsługują tylko niektórych kupujących, na przykład kaplica, która sprzedaje tylko wiernym.
- Gdy kupujesz, Marinara wylicza cenę z kosztu przedmiotu i tego, czy transakcja jest tania, czy droga, pobiera ją z sakiewki kupującego i wkłada przedmiot do jego torby. Za nocleg, przejazd i inne usługi tylko się płaci.
- Zakup, na który nie pozwala miejsce, sprzedawca albo sakiewka, zostaje odrzucony, a GM dowiaduje się dlaczego.
- Zestaw może sprawić, że każdy dzień w danym miejscu jest inny: miejsce może mieć tylko kilka sztuk czegoś rzadkiego, sprzedawca może trafić na coś nietypowego, a rzeczy możesz odsprzedać za część ceny, dopóki sprzedawcy nie wydadzą tego, co wypłacają w ciągu dnia. Nowy dzień w tym samym miejscu, który GM rozpoczyna, gdy drużyna zostaje dłużej, znów zapełnia półki i sakiewki.

Gra bez zestawu zasad też ma pieniądze i rynek, gdy ma je jej zestaw settingu. Ma je każdy startowy zestaw settingu, na przykład miedź, srebro i złoto w high fantasy, miedziane monety i taele srebra w wuxia, dolary i centy we współczesności oraz kredyty w cyberpunku i space operze. Sklep zestawu settingu wymienia codzienne towary z ceną i najmniejszym miejscem, w którym sprzedaje się każdy z nich, więc wioska ma kawiarnię, ale apteczkę ma dopiero miasteczko. Pieniądze i sklep możesz zmienić w opcji **Change its words** (zmiana słownictwa) zestawu albo usunąć pieniądze. Zobacz [Wybór zestawu settingu](getting-started.md#choosing-a-setting-kit).

## Powiązane przewodniki

- [Game Mode: gra z zestawem zasad](rulesets.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md)
