# Game Mode: drużyna i postacie NPC

Ten przewodnik opisuje osoby, które towarzyszą Ci w kampanii w trybie Game Mode: członków drużyny oraz postacie NPC (postacie niezależne) wprowadzane przez postać Game Master. Dowiesz się, jak otworzyć arkusz postaci członka drużyny, jak go poprawić albo wygenerować ponownie i jak czytać panel **Adventure Journal** (dziennik przygody) razem z etykietami reputacji postaci NPC. Na koniec opisane są dwa tryby pracy postaci Game Master.

Game Mode to jeden z trybów czatu w aplikacji Marinara Engine. Prowadzi jednoosobową grę RPG (fabularną) z postacią Game Master (mistrz gry) sterowaną przez AI, w skrócie GM. Konfigurację i podstawy opisuje przewodnik [Game Mode: pierwsze kroki](getting-started.md).

## Okno Character Profiles

Kliknij albo dotknij przycisku z awatarem **Character Profiles** (profile postaci), żeby zobaczyć postacie, które podróżują razem z tobą. Przy kilku członkach drużyny przycisk pokazuje po kolei ich portrety i plakietkę z liczbą.

Ten przycisk możesz przeciągać po czacie na komputerze i na telefonie. Otwórz go i użyj **Lock window** (Zablokuj okno), żeby pozostał na miejscu. Na komputerze możesz też przesuwać okno i zmieniać jego rozmiar. **Close** (Zamknij) zmienia je z powrotem w przycisk. Jego położenie zapisuje się razem z czatem, a wygląd dopasowuje się do stylu widgetów czatu z **Settings → Appearance → App** (Ustawienia, Wygląd, aplikacja). Na telefonie pozostaje osobno, poza menu **Chat tools** (narzędzia czatu) z trzema kropkami.

Oto, co możesz zrobić w oknie **Character Profiles**:

1. Kliknij albo dotknij portretu, żeby otworzyć arkusz tej postaci.
2. Najedź na portret (na komputerze), żeby odsłonić mały przycisk **X**.
3. Kliknij przycisk **X**, żeby usunąć tę postać z drużyny.

Usunąć da się każdego towarzysza zwerbowanego przez postać Game Master – i tego z konfiguracji gry, i tego, który dołączył później w trakcie historii. Persona (postać, w którą się wcielasz) to postać prowadzona przez Ciebie. Nie ma przy niej przycisku **X**, więc siebie z drużyny usunąć się nie da.

## Arkusze postaci

Arkusz postaci to podsumowanie jednego członka drużyny na potrzeby gry. To coś innego niż karta postaci. Arkusz pisze postać Game Master na podstawie danej postaci i bieżącej historii.

Otwórz **Character Profiles**, a potem kliknij albo dotknij portretu tej postaci. Arkusz pokazuje te sekcje, które mają jakąkolwiek treść:

- **Attributes** (atrybuty): wartości w stylu gier stołowych, na przykład STR, DEX i CON, każda z modyfikatorem.
- **Stats** (statystyki): paski zasobów, na przykład HP albo MP.
- **Abilities** (zdolności): to, co postać potrafi zrobić.
- **Strengths** (mocne strony) i **Weaknesses** (słabe strony): krótkie listy.
- **Details** (szczegóły): dodatkowe fakty, na przykład Skills, Weapon albo Faction.
- **Inventory** (ekwipunek): przedmioty, które postać ma przy sobie.
- **Traits** (cechy): pozostałe własne pola.

Przy zupełnie nowej postaci może pojawić się napis "Character data will populate as the story progresses.". Arkusz uzupełnia się w trakcie gry.

### Ponowne wygenerowanie arkusza przez AI

Kliknij przycisk **Regenerate Sheet** (ponowne wygenerowanie arkusza), żeby AI napisała arkusz tej postaci od nowa. Korzysta przy tym z opisu postaci i z bieżącego kontekstu gry. Przydaje się to wtedy, gdy historia mocno odmieniła postać.

<a id="edit-a-sheet-by-hand"></a>

### Ręczna edycja arkusza

Kliknij przycisk **Edit Sheet** (edycja arkusza), żeby poprawić arkusz samodzielnie. W trybie edycji ustawisz następujące rzeczy:

- **Class** (klasa) i krótki opis w sekcji **Sheet Details**.
- **RPG Attributes**: włącz przełącznik **Enable**, żeby śledzić atrybuty i pule w stylu HP. Przyciskiem **Add Pool** dodasz pasek (nazwa, wartość bieżąca, wartość maksymalna i kolor). Przyciskiem **Add Attribute** dodasz wartość taką jak STR.
- **Abilities**, **Strengths** i **Weaknesses**: przyciskiem **Add** dopiszesz kolejną linię.
- **Details**: przyciskiem **Add Detail** dodasz opisany fakt.

Na koniec kliknij przycisk **Save Sheet** (zapisanie arkusza). Przycisk **Cancel** odrzuca wprowadzone zmiany.

<a id="the-ruleset-sheet"></a>

### Arkusz zestawu zasad

W grze z zestawem zasad każdy arkusz postaci zaczyna się od bloku **Ruleset sheet** (arkusz zestawu zasad) o układzie określonym przez zestaw zasad, zawierającego jego zasoby, tory, stany, odpoczynki i podsumowanie budowy postaci; mistrz gry aktualizuje ten blok na bieżąco podczas narracji. Niektóre zestawy zasad utrzymują też arkusz postaci dla całej drużyny i zegary postępu obok mapy. Zobacz [Arkusz zestawu zasad](rulesets.md#the-ruleset-sheet).

## Ekwipunek

Kliknij **Inventory** nad narracją, żeby go otworzyć. Każdy kwadrat to stos: przedmiot i liczba jego sztuk. Kliknij stos, żeby go zaznaczyć.

Każdy członek drużyny nosi własne rzeczy. Ekwipunek otwiera się na zakładce **All** (wszystko), która pokazuje wszystkie torby razem, z imieniem osoby niosącej dany stos w jego rogu. Kliknij zakładkę członka drużyny, żeby zobaczyć tylko jego torbę. Dopóki nikt inny niczego nie niesie, zakładek nie ma, a każdy stos należy do ciebie.

- **Zmiana liczby.** Użyj **-** i **+**, żeby odjąć albo dodać jedną sztukę. Żeby zmienić liczbę o więcej, wpisz wartość w pole między nimi i naciśnij Enter: liczba ustawia liczbę sztuk (`300`), a znak dodaje albo odejmuje tyle sztuk (`+100`, `-50`). Ustawienie stosu na 0 usuwa go, a gdy sztuk jest więcej niż jedna, aplikacja najpierw pyta.
- **Dzielenie stosu.** Kliknij **Split** (podziel), wpisz, ile sztuk ma trafić do nowego stosu, i ponownie kliknij **Split**. Oddzielenie 100 z 300 jabłek zostawia stos 200 i nowy stos 100 obok niego.
- **Przekazanie.** Kliknij **Give** (przekaż), wybierz, kto dostaje przedmiot i ile sztuk, i ponownie kliknij **Give**. Żeby przekazać cały stos, możesz też przeciągnąć go na zakładkę tej osoby.
- **Dodawanie.** Wpisz nazwę przedmiotu i kliknij **Add** (dodaj). Przedmiot trafia do torby z otwartej zakładki, a z zakładki **All** do twojej torby, chyba że zestaw zasad określa, ile kto może nieść (zobacz niżej). Dodanie przedmiotu, który ta torba już ma, dodaje jedną sztukę do jego pierwszego stosu.
- **Łączenie i zmiana kolejności.** Przeciągnij stos na inny stos tego samego przedmiotu, żeby je połączyć, niezależnie od ich nazw. Połączony stos zostaje u osoby, która niosła stos, na który go upuszczono. Przeciągnij stos na inny przedmiot, żeby zamienić je miejscami.
- **Z zestawu zasad.** W grze, której zestaw zasad wymienia własne przedmioty, **From the ruleset** (z zestawu zasad) otwiera okno wyboru tych przedmiotów z wyszukiwaniem i filtrami zestawu. Zaznacz wybrane przedmioty i kliknij **Add**: po jednej sztuce każdego trafia tam, gdzie **Add** umieszcza przedmiot, czyli do torby z otwartej zakładki albo, z zakładki **All**, do twojej torby, chyba że zestaw określa, ile kto może nieść. Wpisana nazwa, która jest nazwą przedmiotu zestawu, też dodaje ten przedmiot. Zestaw może przyjmować wyłącznie własne przedmioty i wtedy nie ma pola do wpisania nazwy.
- **Wyposażenie początkowe.** Gdy zestaw oferuje wyposażenie na start, otwiera je przycisk **Starting gear** (wyposażenie początkowe). W polu **For** (dla) wybierz, dla kogo jest, dokonaj wyborów, o które prosi dany zestaw wyposażenia, i kliknij jego przycisk **Take** (weź), żeby włożyć wyposażenie do torby tej postaci. Wyposażenie pasujące do arkusza tej postaci jest na liście jako pierwsze; inne postać może wziąć, jeśli Game Master się zgodzi. Branie wyposażenia jest opcjonalne. Gdy wszystko, co oferowano, zostanie wzięte, przycisk pokazuje **Starting gear (taken)** (wyposażenie początkowe wzięte).
- **Użycie.** Kliknij **Use** (użyj), żeby przekazać postaci Game Master, że używasz przedmiotu. W przypadku przedmiotu z zestawu, który określa skutek użycia, na przykład okładu leczniczego, silnik najpierw sam go wykonuje: rzuca na to, co przedmiot przywraca, zapisuje to w arkuszu osoby, która go niesie, odejmuje jedną sztukę ze stosu albo zużywa ładunek i informuje postać Game Master, co się stało, żeby opowieść za tym podążyła. To, co przedmiot robi komuś innemu, opisuje w narracji Game Master. Przedmiot bez pozostałych użyć zostaje odrzucony, a przedmiot, który trzeba nosić, działa tylko wtedy, gdy jest noszony. Niektóre przedmioty najpierw wymagają testu, na przykład zwój powyżej poziomu, który postać potrafi odczytać: silnik rzuca, a jeśli test się nie uda, przedmiot zostaje zużyty na nic.
- **Przydomek.** Wpisz nową nazwę stosu i kliknij **Save**. To tylko twoja nazwa dla tego stosu: przedmiot pozostaje tym samym przedmiotem, Game Master nadal może go nazywać jego własną nazwą, a nadanie przydomka nigdy nie łączy go z innym stosem. Własna nazwa przedmiotu jest widoczna obok przydomka. Żeby usunąć przydomek, wpisz z powrotem własną nazwę.

Przedmiot z zestawu po zaznaczeniu pokazuje, czym jest: rodzaj, rzadkość, tagi, statystyki i opis. Jeden jego stos mieści tylko tyle sztuk, ile określa zestaw, a nadmiar zaczyna nowy stos. Game Master może też wymyślić przedmiot w słownictwie zestawu, na przykład ostrze z własną nazwą. Działa on jak przedmioty zestawu, a jego szczegóły podają, że został wymyślony, i co silnik zmienił, żeby pasował do zestawu, na przykład premię ograniczoną do tego, na co pozwala jego rzadkość. Niektóre zestawy wyłączają własne przedmioty trybu Game Mode: wtedy Game Master daje tylko przedmioty zestawu i te, które wymyśli, a ty nadal możesz wpisywać własne przedmioty, chyba że zestaw przyjmuje wyłącznie własne.

### Noszenie, wiązanie i dźwiganie

Zestaw zasad może też określać, jak jego przedmioty się nosi i dźwiga:

- **Equipped** (założony). Przedmiot zajmujący miejsca, na przykład zbroja na ciele albo łuk w obu rękach, ma przycisk **Equipped**. Jego właściciel może go założyć, dopóki te miejsca są wolne; zakładka torby pokazuje każde zajęte miejsce, na przykład **Hands 2/2**. Założenie jednej sztuki z większego stosu przenosi ją do osobnego stosu oznaczonego jako noszony.
- **Wiązanie.** Przedmiot, który trzeba ze sobą związać, żeby działał (zestrojenie, inwestytura), ma przycisk nazwany słowem, którego używa zestaw, na przykład **Bound** (związany). Postać może związać ze sobą tylko tyle przedmiotów, na ile pozwala jej arkusz, co widać na przykład jako **Bound 1/3**. Przeklęty przedmiot raz związany pozostaje związany: nie da się go rozwiązać, zdjąć, oddać ani wyrzucić. Klątwę może zakończyć tylko opowieść prowadzona przez postać Game Master.
- **Dźwiganie.** Gdy zestaw określa wagę wszystkiego i to, ile może dźwigać każda postać, każda torba pokazuje swoje obciążenie, na przykład **Load 5/6, at most 12**, a po przekroczeniu tego, co jej właściciel niesie bez trudu, **Encumbered** (obciążony). Przedmiot dodany z zakładki **All** trafia do kogoś, kto może go nieść bez przeciążenia: najpierw do ciebie, potem do członków drużyny po kolei. Gdy nikt nie może unieść całości, przedmioty są rozdzielane według wolnego miejsca każdego z członków drużyny i nikt nigdy nie dostaje więcej, niż w ogóle może unieść. To, czego nikt nie uniesie, zostaje na miejscu, a aplikacja cię o tym informuje. Przekazanie komuś więcej, niż może unieść, zostaje odrzucone, czy to przez **Give**, czy przez przeciągnięcie stosu na stos w jego torbie.

Przekazanie noszonego albo związanego przedmiotu komuś innemu zdejmuje go i zrywa więź.

Arkusz postaci członka drużyny wymienia to, co niesie.

Game Master w miarę rozwoju opowieści dodaje, usuwa i przekazuje przedmioty, podając, kto je niesie. Przedmiot, który nazwie, a który jest jednym z przedmiotów zestawu, jest właśnie tym przedmiotem, a GM dowiaduje się, czym jest każdy przedmiot zestawu, który masz. Używa przedmiotów zestawu tak samo jak przycisk **Use**. W zestawie, który określa noszenie i dźwiganie, GM także zakłada i zdejmuje przedmioty, wiąże je i rozwiązuje oraz widzi obciążenie, miejsca i związane przedmioty każdej postaci; przedmiot, który doda bez wskazania odbiorcy, jest rozdzielany tak samo jak twój. Każda zmiana następuje przy zapisie odpowiedzi, a jej powiadomienie pojawia się, gdy dojdziesz do tego fragmentu opowieści. Gdy Game Master zabiera przedmiot, nie mówiąc komu, bierze go najpierw z twojej torby, a potem od reszty drużyny. Zmiana niemożliwa, na przykład zabranie czegoś, czego nikt nie ma, zostaje odrzucona, a Game Master dostaje o tym informację. Gdy generujesz odpowiedź ponownie, jej zmiany zaczynają się od nowa od stanu z początku tej tury, a przejście swipe'em do wcześniejszej wersji pokazuje to, co zostawiła tamta wersja. Usunięcie bieżącej wersji pokazuje to, co zostawiła następna, a gałąź czatu zabiera ze sobą ekwipunek każdej wersji. Dzieje się tak tylko wtedy, gdy ekwipunek jest dokładnie taki, jakim zostawiła go odpowiedź: gdy coś w nim zmienisz, nowa odpowiedź dokłada swoje zmiany na wierzch i nic z twoich działań nie zostaje cofnięte. Walka korzysta z przedmiotów przez akcję **Items** i liczy razem wszystkie stosy danego przedmiotu, niezależnie od tego, kto go niesie i jak się nazywa. Każda torba, łącznie z podziałami i przydomkami, przechodzi do następnej sesji.

### Pieniądze

Zestaw zasad może mieć własne pieniądze: jedną albo kilka rodzin monet, na przykład pensy, szylingi i korony, w których każda większa moneta jest warta określoną liczbę najmniejszych. Monety są stosami jak każdy przedmiot. Ważą tyle, ile określa zestaw, i liczą się do obciążenia osoby, która je niesie, a dzielić, przekazywać i łączyć je można jak wszystko inne. **From the ruleset** ma listę **Coins** (monety) do ręcznego dodawania monet.

Nad stosami wiersz pokazuje każdą rodzinę monet z otwartej zakładki i ich łączną wartość, na przykład **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

Game Master pobiera od drużyny opłaty i płaci jej w tych monetach, a wygrana walka albo wylosowany skarb też może je dawać. Płatność pochodzi z sakiewki jednej postaci, twojej, chyba że GM wskaże czyją, i tylko w rodzinie, w której podano cenę: najpierw idą największe monety, a gdy dokładnej kwoty nie ma, większa moneta jest rozmieniana, a reszta wraca w mniejszych. Cena, której sakiewka nie pokryje, zostaje odrzucona, a Game Master dostaje o tym informację. Ceny w jednej rodzinie nigdy nie płaci się w innej, więc cenę w soli płaci się solą. Pieniądze zarobione przez drużynę trafiają do toreb jak każdy przedmiot. Każda płatność i każdy zarobek pojawia się jako powiadomienie.

Wariant zestawu może pomijać jakąś monetę, jak długa noc, w której do kurhanów nie docierają żadne korony. Wtedy nikt nie dostaje zapłaty w tej monecie ani nią nie płaci, a cena w niej podana jest pokazywana w pozostałych monetach, w tej samej wartości.

Zestaw może też mieć rynki, więc to, co można kupić, zależy od miejsca, w którym jesteś. Game Master określa, w jakim miejscu toczy się scena i jak duże jest to miejsce – przysiółek czy miasto w słownictwie zestawu – a małe miejsce sprzedaje mniej: rzadkie rzeczy mogą być dostępne dopiero w miasteczku, a niektórzy sprzedawcy prowadzą sklep tylko w większych miejscach albo obsługują tylko niektórych kupujących, na przykład kaplica, która sprzedaje tylko wiernym. Gdy coś kupujesz, silnik wylicza cenę z kosztu przedmiotu i tego, czy transakcja jest tania, czy droga, pobiera ją z sakiewki kupującego i wkłada przedmiot do jego torby. Za nocleg, przejazd i inne usługi tylko się płaci. Powiadomienie pokazuje, co kupiono i za ile, a zakup, na który nie pozwala miejsce, sprzedawca albo sakiewka, zostaje odrzucony, a Game Master dowiaduje się dlaczego. Zestaw może też sprawić, że każdy dzień w danym miejscu jest inny: miejsce może mieć tylko kilka sztuk czegoś rzadkiego, sprzedawca może danego dnia trafić na coś nietypowego, a rzeczy możesz odsprzedać sprzedawcy, który nimi handluje, za część ceny, dopóki sprzedawcy w tym miejscu nie wydadzą tego, co wypłacają w ciągu dnia. Nowy dzień w tym samym miejscu, który Game Master rozpoczyna, gdy drużyna zostaje dłużej, znów zapełnia półki i sakiewki.

Gra bez zestawu zasad też ma pieniądze i rynek, gdy ma je jej zestaw settingu: ma je każdy startowy zestaw settingu, na przykład miedź, srebro i złoto w high fantasy, miedziane monety i taele srebra w wuxia, dolary i centy we współczesności oraz kredyty w cyberpunku i space operze. Sklep zestawu settingu wymienia codzienne rzeczy, które sprzedaje się w danym settingu, każdą z ceną i najmniejszym miejscem, w którym się ją sprzedaje, więc wioska ma kawiarnię, ale apteczkę ma dopiero miasteczko. Pieniądze i sklep możesz zmienić w opcji **Change its words** (zmiana słownictwa) zestawu albo całkiem usunąć pieniądze. Kupowanie, płacenie i zarabianie działają wtedy tak jak powyżej, w monetach settingu.

## Werbowanie i usuwanie członków drużyny

O składzie drużyny decyduje postać Game Master w miarę rozwoju historii. Nie ma osobnego przycisku dodawania towarzysza. Zamiast tego postać GM dodaje i usuwa członków drużyny przez samą narrację, zgodnie z tym, co dzieje się w scenie.

Gdy postać GM dodaje postać NPC, która ma dokładnie takie samo imię jak jedna z twoich kart postaci albo imię wspólne dla kilku twoich kart, okno pyta, która z nich ma dołączyć. Pokazuje imię, tytuł i awatar każdej karty. Wybierz kartę albo opcję **Keep the game's own** (zachowaj postać z gry) z imieniem postaci NPC, na przykład **Keep the game's own Emma**, żeby wprowadzić postać utworzoną przez grę. Zamknięcie okna działa tak samo. Karta, której imię jest tylko podobne, na przykład **Samantha** przy postaci NPC o imieniu Sam, nigdy nie zostaje dodana.

Żeby pożegnać towarzysza samodzielnie, użyj przycisku **X** przy jego portrecie w oknie **Character Profiles**, jak opisano wyżej. Własnej persony w ten sposób nie usuniesz.

Experience może dostarczać własnych towarzyszy: mieszkańców swojego świata, którzy mogą do ciebie dołączyć, każdy z gotowym arkuszem postaci dla zasad danej gry. Opowieść może sprowadzić taką postać albo ją odesłać, a Game Master może werbować tylko tych towarzyszy (twoje postacie z biblioteki nadal mogą dołączyć). Towarzysz dołącza na najwyższym poziomie w twojej drużynie i awansuje wraz z nią.

## Panel Adventure Journal

Panel **Adventure Journal** to bieżąca kronika kampanii. Powstaje z zapisanych zdarzeń gry, a nie z tekstu pisanego przez AI, więc trzyma się faktów.

Otwórz **Session** (sesja; zobacz [Otwieranie Session](sessions-and-saves.md#opening-session)), a potem wybierz zakładkę **Journal**. Dziennik ma następujące zakładki:

- **Timeline** (oś czasu): lista tego, co się wydarzyło – odkryte lokacje, spotkania z postaciami NPC, wyniki walk, zadania i zdarzenia dotyczące przedmiotów.
- **NPCs**: napotkane postacie NPC z portretami i etykietami reputacji (opis niżej).
- **Map** (mapa): zwykła lista nazw odkrytych lokacji.
- **Items** (przedmioty): rejestr przedmiotów zdobytych, użytych, zgubionych i usuniętych.
- **Library** (biblioteka): notatki i księgi ze świata gry pokazane przez postać Game Master, zapisane po to, żeby dało się do nich wrócić.
- **Notes** (notatki): twój własny notatnik z dowolnym tekstem.
- **World** (świat): w grze z wygenerowanym światem – świat taki, jakim zna go twoja drużyna. Pokazuje:
  - gdzie jesteś i jak dobrze znana jest drużyna
  - pozycję drużyny wobec każdej grupy, z którą miała do czynienia
  - czego dokonała drużyna
  - wieści, które do niej dotarły, z oznaczonymi plotkami
  - nadciągające kłopoty, o których słyszała
  - przeszłość, o której opowiedziałby każdy miejscowy

  Pokazuje tylko to, co drużyna mogła wiedzieć. Sekrety znane tylko postaci Game Master pozostają ukryte. Podąża za opowieścią przez swipe'y i gałęzie.

### Notatki gracza

Zakładka **Notes** to osobisty notatnik. Po lewej wpisuje się tekst, po prawej widać sformatowany podgląd. Podpis nad notatnikiem ostrzega, że notatki widzą postać Game Master i członkowie drużyny. Wszystko, co tu trafi, może więc wpłynąć na historię.

Notatki zapisują się same chwilę po przerwie w pisaniu. Mała etykieta pokazuje **Saving...** w trakcie zapisu i **Saved** po jego zakończeniu.

## Etykiety reputacji postaci NPC

Zakładka **NPCs** panelu **Adventure Journal** śledzi, co każda postać NPC do Ciebie czuje. Przy każdej wypisanej postaci NPC widać portret, imię i etykietę reputacji.

Etykieta reputacji zmienia się wraz z Twoimi poczynaniami w historii. Przyjmuje jedną z siedmiu wartości, od najlepszej do najgorszej:

| Etykieta | Znaczenie |
|---|---|
| **Devoted** | Głęboko Ci oddana |
| **Allied** | Silny sojusznik |
| **Friendly** | Nastawiona pozytywnie |
| **Neutral** | Bez wyraźnych uczuć |
| **Unfriendly** | Nastawiona negatywnie |
| **Hostile** | Zwrócona przeciwko Tobie |
| **Enemy** | Czynnie wroga |

Etykieta pojawia się dopiero wtedy, gdy reputacja postaci NPC odsunie się od wartości początkowej. Zupełnie nowa postać NPC z niezmienioną reputacją nie ma jeszcze żadnej etykiety.

Postać NPC trafia do tej zakładki wtedy, gdy postać Game Master ją opisze, nada jej reputację albo zapisze notatkę o relacji. Każdy wiersz postaci NPC daje też takie możliwości:

- Wgranie portretu postaci NPC albo jego podmiana.
- Wygenerowanie portretu przez AI, jeśli generowanie obrazów jest włączone.
- Usunięcie postaci NPC z dziennika.

## Tryby pracy postaci Game Master

To, kto prowadzi grę, wybiera się w kreatorze konfiguracji, w kroku **Party** (drużyna), w sekcji **Game Master Mode**. Do wyboru są dwie opcje:

- **Standalone GM**: opcja domyślna. Marinara buduje mistrza gry za Ciebie. Kreator opisuje go słowami "A snarky narrator running the show". Karta postaci nie jest potrzebna.
- **Character GM**: rolę postaci Game Master przejmuje jedna z twoich własnych kart postaci. Aplikacja poleca modelowi wcielić się w tę postać i jednocześnie dalej prowadzić grę. Wybierz to wtedy, gdy narracja ma mieć konkretny głos.

Przy pierwszej grze najlepiej sprawdzi się **Standalone GM**. Tryb ustawia się w momencie tworzenia gry. Pełny opis konfiguracji krok po kroku znajdziesz w przewodniku [Game Mode: pierwsze kroki](getting-started.md).

## Powiązane przewodniki

- [Game Mode: gra z zestawem zasad](rulesets.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md)
