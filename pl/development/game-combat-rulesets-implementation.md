# Wersjonowane zasady walki: dokument przekazania implementacji

> **Stan na 19 września 2026 r.** Przewidziany tu adapter `5e-2014` powstaje jako rodzaj walki STEROWANY DANYMI, a nie osobny adapter TypeScript dla każdego systemu: zestaw deklaruje opcjonalny blok `combat`, a silnik posiada mechanizm jego rozstrzygania, tak jak mechanizmy testów. Uzasadnienie, architekturę i etapy opisuje `game-rulesets-and-sheets-implementation.md`, sekcja Real ruleset combat; pracę śledzi [zadanie #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). Pozostałe ustalenia są aktualne: Traditional i zaakceptowana mechanika szybkości, kontrakt produktu, trudność należąca do zestawu i nigdy niebędąca mnożnikiem obrażeń, jeden serwerowy rejestr dyrektora, okna reakcji i legendarnych akcji oraz kontrakt zapisu, interfejsu i wdrażania.
>
> Od C3a mechanizm jest PODŁĄCZONY: walka działa na istniejącym rejestrze dyrektora jako trzeci `style` obok `classic` i `tactical`, z tą samą rewizją, idempotencją, blokadą mutex i jednym wywołaniem modelu wybierającym identyfikator kandydata. Od C3b jest NA EKRANIE: zestaw z `combat` używa powłoki Classic, własnego menu i nazewnictwa oraz rzeczywistych obliczeń w dzienniku. Arkusze zapisują się w trakcie walki, a nie po niej. Od C4a ma POZYCJE: deklaracja `combat.distance` pozwala walczyć na planszy generowanej przez silnik Tactical. Ruch, zasięg, obszary eksplozji, stożka i linii, widoczność, osłona i ataki na oddalających się przeciwników wynikają z liczb zestawu; przeciwnik także się porusza. Od C4b plansza jest NA EKRANIE: walka z pozycjami używa terenu Tactical, a dostępne pola, ich koszty, droga, sprowokowane ataki, dozwolone cele i miejsca dla obszarów pochodzą z widoku serwera i używają odległości zestawu. Reakcje i okna akcji specjalnych pozostają planem C5.
>
> Plansza jest wyświetlana od C4b. Od C5a TURA może działać jak tura gry stołowej: cios ma drugą część obrażeń, jedna akcja kupuje kilka uderzeń, zdolność może nie kosztować budżetu, zwracać go lub pozwalać kupić standardową akcję innym budżetem. Dodatkowy efekt może sam dołączyć do pierwszego trafienia spełniającego warunki w okresie. Stan może zmieniać własne rzuty obronne, dzielić każdy rodzaj obrażeń na pół, blokować atakowanie lub zbliżanie się do sprawcy, działać tylko, gdy go widać, albo kończyć się po jego upadku. Od C5b walkę można WSTRZYMAĆ: ruch poza czyjś zasięg zatrzymuje się i pyta o uderzenie, zamiast wykonywać je automatycznie. Między turami gra zatrzymuje się i pyta każdy blok z punktami, czy kupić jedną z własnych akcji. Otwarte okno blokuje dalszy ruch; walka wznawia się dokładnie w miejscu zatrzymania. Od C5c wpis katalogu określa MOMENT oczekiwania: `aimed` przed trafieniem właściciela, gdy reakcja może je odwołać, albo `harmed` po otrzymaniu obrażeń, z celem ustawionym na sprawcę. Koszt płaci się przed pytaniem, więc anulowana akcja zostaje zatrzymana, ale jej zakup nie jest cofany. Łańcuchy pozostają przyszłą pracą: istnieje jedno okno, nie stos, więc kontry nie można skontrować.


Status: propozycja implementacji, 17 września 2026 r. Przebudowa AI nie implementuje tych zestawów zasad. Wymóg dodatkowego uderzenia zależnego od szybkości w Traditional jest zaakceptowanym kierunkiem produktu; poniższe progi i pozostałe wartości domyślne są propozycjami do strojenia. Implementuj na aktualnej gałęzi `staging`, po sprawdzeniu powiązanych prac.

## Kontrakt produktu

Zachowaj niezależność czterech wyborów:

| Wybór | Czym steruje | Przykłady |
| --- | --- | --- |
| Prezentacja | Informacje przestrzenne i sterowanie | Menu Classic; siatka Tactical |
| Uczestnictwo | Kto walczy | Drużyna; przyszłe Summoning |
| Zestaw zasad | Legalne akcje, zasoby, czas tur i rozstrzyganie | Traditional; jawnie wersjonowane 5e; V20 |
| Kontroler | Kto wybiera legalną akcję | Gracz; lokalna AI; bossowie sterowani przez GM |

Cautious Mage musi zachować ostrożność w obu prezentacjach. Zmiana zasad zmienia dozwolone działania maga, a nie jego osobowość. Summoning jest systemem uczestnictwa, a nie trzecim silnikiem zasad; jego pierwsza prezentacja może nie uwzględniać przestrzeni. Żaden tryb nie może wymyślać odległości na siatce, gdy nie istnieje model pozycji.

Pokazuj czytelne opisy w interfejsie produktu. Unikaj porównań do innych gier w opisach Traditional i Tactical. Zestawy nazwane od zaimplementowanego systemu muszą wskazywać dokładną obsługiwaną edycję i zakres.

### Trudność musi należeć do zestawu zasad

Obecne mnożniki obrażeń przeciwników w silniku (Casual 0.6, Normal 1, Hard 1.3, Brutal 1.6) są przeznaczone wyłącznie dla Traditional. Przy implementacji innych zasad rozpatrz je ponownie: 5e, V20 i kolejne adaptery nie mogą automatycznie dziedziczyć tych mnożników. Określ trudność według modelu starć i rozstrzygania danego zestawu zasad. Oddziel strojenie decyzji AI przeciwników od arytmetycznego skalowania obrażeń. Dodaj regresję adaptera potwierdzającą, że wybór innych zasad nie stosuje po cichu tabeli Traditional. Ta uwaga nie przemianowuje obecnej starszej mechaniki na zaimplementowany zestaw Traditional.

## Obecny kod i ograniczenia

- `packages/shared/src/types/game.ts`: `Combatant`, `CombatSkill`, wyniki i migawki Classic. Obecne statystyki są ogólnymi liczbami; `speed` nie jest wartością Zręczności z gry stołowej ani odległością ruchu w stopach.
- `packages/server/src/services/game/combat.service.ts`: Classic rzuca na inicjatywę co rundę, rozstrzyga jedno polecenie na uczestnika i używa ogólnych wzorów obrażeń. Starsze gry przekazują stan przez klienta; nowe gry z kreatora używają rejestru reżysera walki należącego do serwera.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts`: naprzemienne fazy drużyny i przeciwników, zasięg zależny od klasy, ruch wyprowadzany z szybkości, kontrataki, jeszcze bez dodatkowego uderzenia od szybkości.
- `packages/shared/src/features/combat-ai.ts` i adaptery trybów: priorytety dostępnych akcji. Zwykła AI zachowuje granice dostępu do informacji; bossowie GM otrzymują karty drużyny i zasoby do przewidywania, ale żaden kontroler nie widzi przyszłych rzutów ani wyborów gracza przed ich zadeklarowaniem.
- `packages/server/src/routes/combat-director.routes.ts` i `services/game/combat-director.service.ts`: wersjonowany autorytatywny stan starcia, kursor aktywacji, oczekujące reakcje, limity akcji legendarnych i ochrona przed powtórzonymi lub nieaktualnymi odpowiedziami. Rozszerz tę ścieżkę zaakceptowanych akcji na adaptery zasad zamiast tworzyć drugi rejestr. Obecne prawdopodobieństwo Counterspell, opłacanie komórek i koszt anulowania są ogólnymi zasadami silnika, a nie zasadami 5e.
- `packages/server/src/routes/game.routes.ts`: walidacja rund, rozpoczęcia i akcji w starszej ścieżce. `GameCombatUI`, `TacticalCombatUI` i `use-game.ts`: sterowanie, podglądy, zaakceptowane wyniki i trwały zapis.
- `GameSurface.tsx`: wczytywanie wygenerowanych planów i migawek walki. `encounter.routes.ts`: prompt generowania starć. `game-setup-share.ts`: import i eksport konfiguracji do ponownego użycia.

Nie przemianowuj obecnego wzoru obrażeń na Traditional bez implementacji i weryfikacji zaakceptowanego działania szybkości. Nie określaj rzutu d20 z obecnymi statystykami silnika jako zgodnego z 5e.

## Minimalna architektura

Zacznij od zamkniętego rejestru wbudowanych adapterów w czystym TypeScript. Nie dodawaj języka skryptowego ani dowolnych wykonywalnych pakietów zasad. Korzystaj z istniejących typów legalnych akcji i wyników, gdzie to możliwe; wydzielaj wspólnego pomocnika dopiero wtedy, gdy potrzebują go oba miejsca wywołania.

Zapisuj przypięte odniesienie w każdym nowym starciu:

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Każdy adapter sprawdza własny zamknięty schemat opcji zamiast bez ograniczeń akceptować przykładowy rekord. Dodaj listę obsługiwanych możliwości: ruch, kontratak, komórki czarów, wydawanie krwi, przywołania, reakcje bossów. Odrzucaj jawnie ustawioną nieobsługiwaną opcję z użytecznym błędem. Brak danych zasad oznacza `engine-legacy`, nigdy automatyczną migrację do Traditional.

Niewielki interfejs powinien obejmować:

1. Walidację i normalizację karty postaci właściwej dla zasad, bez zgadywania konwersji.
2. Rozpoczęcie starcia, rzut lub ustalenie kolejności raz, we właściwym czasie określonym przez zasady.
3. Rozpoczęcie aktywacji: odnowienie dozwolonych limitów i aktualizację odpowiednich stanów.
4. Wyliczenie legalnych akcji i opcjonalnych reakcji, ich zbiorów celów, zasięgu, kosztu i okna czasowego, w tym pominięcia.
5. Utworzenie prognozy tylko do odczytu, bez zużywania RNG.
6. Przyjęcie deklaracji akcji, zapis zobowiązania zasobów i udostępnienie obsługiwanych okien wyzwalaczy przed rozstrzygnięciem efektów.
7. Rozstrzygnięcie oczekujących efektów i reakcji w uporządkowane zdarzenia oraz zmiany zasobów; udostępnienie okien bossa na początku i po zakończeniu aktywacji tylko tam, gdzie są włączone.
8. Zakończenie rundy po wykorzystaniu aktywacji uczestników; jednokrotne przesunięcie efektów ograniczonych rundą.

Ten sam adapter zasila sterowanie gracza, zwykłą AI, listy kandydatów GM i podglądy. GM nie może podać końcowego HP, wymyślonych identyfikatorów umiejętności, nowej kolejności tur ani darmowych zmian zasobów. Legalność wynika z zaakceptowanego stanu; konteksty decyzji ujawniają informacje odpowiednie dla kontrolera i okna czasowego. Bossowie GM znają umiejętności drużyny, punkty i komórki czarów, czasy odnowienia oraz użyteczny ekwipunek do przewidywania zagrożeń. Niezatwierdzone wybory i inne polecenia w kolejce pozostają prywatne do chwili deklaracji. Prognoza podaje wartości oczekiwane, nie przyszłe wyniki kości.

Przechowuj karty poszczególnych zasad w unii z wyróżnikiem. Nie wciskaj wszystkich zasobów w `mp`: MP, liczby komórek, Blood Pool, Willpower, wydatki na rundę i użycia na odpoczynek mają różną semantykę. Paski interfejsu i koszty zdolności odczytują deskryptory z wybranego adaptera. Przechowuj bieżące i maksymalne zasoby osobno; normalizuj nazwy tylko do wyświetlania, nigdy jako tożsamość zasobu.

## Traditional v1: zaakceptowane działanie szybkości

**Każdy żywy uprawniony uczestnik otrzymuje najwyżej jedną zwykłą aktywację i jedno rozpoczęcie wymiany ciosów na rundę. Dodatkowe uderzenie wynikające z szybkości jest kolejnym ciosem w tej wymianie, a nie kolejną aktywacją.**

Proponowany początkowy balans:

| Zasada | Proponowane działanie v1 |
| --- | --- |
| Inicjatywa | Malejąca efektywna szybkość, stała kolejność remisów w starciu; brak dodatkowej aktywacji za remis lub wysoką szybkość |
| Kolejność Tactical | Faza drużyny, następnie faza przeciwników; gracz wybiera członków drużyny, którzy jeszcze nie działali, a jednostki automatyczne używają kolejności szybkości |
| Kolejność Classic | Wspólna kolejność malejącej efektywnej szybkości; interfejs kolejkuje ręczne polecenia, a następnie rozstrzyga aktualnie legalne cele w każdym miejscu kolejki |
| Ruch | Jawny limit ruchu niezależny od szybkości. Sugerowana wartość domyślna: 4 pola, z ograniczonymi modyfikacjami klasy i zdolności |
| Szybkość ataku | Efektywna szybkość, tylko z jawnie modelowanymi karami i premiami; bez wymyślonej masy broni |
| Próg dodatkowego uderzenia | Szybkość ataku napastnika co najmniej o 5 większa od szybkości ataku obrońcy; konfigurowalna tylko jako walidowana opcja zasad |
| Uprawniona akcja | Atak podstawowy lub umiejętność jawnie oznaczona `allowsSpeedFollowUp`; dla umiejętności domyślnie false |
| Wymiana | Cios inicjatora → legalny kontratak żyjącego obrońcy → uprawnione dodatkowe uderzenie żyjącego inicjatora |
| Szybszy obrońca | Jeden legalny kontratak w v1; dodatkowe uderzenie obrońcy to osobna opcja balansu, domyślnie wyłączona |
| MP | Jawna pula i koszt każdej umiejętności, potrącany raz za wybraną aktywację umiejętności; koszty dodatkowego uderzenia musi określać dana umiejętność |
| Odnowienie ruchu | Raz na początku następnej zwykłej aktywacji; kontratak i dodatkowe uderzenie nigdy go nie odnawiają |

Próg 5 i kolejność wymiany są propozycjami aplikacji Marinara, a nie deklaracją odtworzenia zasad konkretnej gry. Wymaganie opiekunki projektu dotyczy dwóch uderzeń szybszej jednostki atakującej; nie wymaga podwójnego uderzenia w obronie.

Między uderzeniami sprawdzaj ponownie życie jednostki, poprawność celu, zasięg, stany uniemożliwiające działanie i pozostałe limity. Jednostka zabita kontratakiem nie może uderzyć ponownie. Chybienie pierwszego ciosu samo w sobie nie anuluje dodatkowego uderzenia od szybkości. Pokonanego celu nie można uderzyć ponownie ani po cichu zastąpić innym w tej samej wymianie. Zapobiegaj rekurencji kontrataków na kontratak. Kontratak nie zużywa zwykłego rozpoczęcia wymiany obrońcy ani nie przyznaje kolejnego. Leczenie, premie, przedmioty, przywołania i akcje legendarne nie podwajają się, chyba że jawna obsługiwana zdolność określa taki wyjątek.

Ustal uprawnienia na podstawie zaakceptowanych efektywnych statystyk na początku wymiany; natychmiast stosuj efekty uniemożliwiające działanie pojawiające się w jej trakcie, ale nie dodawaj wstecz kolejnych ciosów po premii szybkości uzyskanej podczas wymiany. Umieść wynik na liście zdarzeń, z prognozą pokazującą jeden lub dwa ciosy oraz możliwość kontrataku. Odświeżenie podczas animacji odtwarza zaakceptowane zdarzenia, nigdy nie powtarza rzutów ani wydatków.

Classic nie ma zasięgu ruchu: pomiń ruch albo zapewnij osobno zdefiniowany model związania walką. Kontrataki Traditional w Classic wymagają jawnej zasady `canCounter`; nie przenoś sprawdzania zasięgu siatki na indeksy tablicy. Zalecane v1 pozostawia kontrataki Classic wyłączone do czasu określenia podstawowych zasad walki wręcz i dystansowej, zachowując dodatkowe uderzenia szybszego napastnika.

## Profil 5e: określ edycję przed pisaniem kodu

Zalecany pierwszy cel: `5e-2014`, przypięty do SRD 5.1. Późniejszy profil 2024/SRD 5.2 potrzebuje własnego identyfikatora, wersji i testów; nie łącz edycji po cichu. Oficjalny [indeks SRD](https://www.dndbeyond.com/srd) publikuje wersje, a [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) jest źródłem pierwotnym dla pierwszego celu.

Przed implementacją sprawdź źródło pierwotne: inicjatywę opartą na Zręczności; ruch mierzony odległością; dostępność akcji, akcji dodatkowej i reakcji; komórki czarów; koncentrację i stany; oddzielne rzuty ataku i rzuty obronne. Wymagają one dedykowanych pól karty i scenariuszy rozstrzygania. Ogólne poziom, atak i obrona silnika nie mogą ich zastąpić. Punkty czarów są jawnie wybieranym wariantem z własnym sprawdzonym źródłem i limitami, a nie przemianowaną pulą komórek.

Najpierw dostarcz uczciwie opisany obsługiwany podzbiór, np. podstawowe ataki bronią, ruch, Dodge i krótką listę czarów, z niedostępnymi nieobsługiwanymi akcjami. Nie deklaruj pełnych zasad 5e na podstawie jednego wzoru inicjatywy. Podwajanie Traditional pozostaje wyłączone; dodatkowe ataki wynikają wyłącznie z zaimplementowanych zdolności profilu.

## Profil V20: wymagany osobny audyt

Celem jest Vampire: The Masquerade 20th Anniversary Edition, nie V5 ani V20 Dark Ages. Przed kodowaniem dokładnej inicjatywy, kolejności deklaracji, wielu akcji, Celerity, obrażeń i ich pochłaniania, kar za rany i limitów wydawania zasobów uzyskaj odpowiednie pierwotne źródło zasad. Ten dokument nie zatwierdza żadnego dokładnego wzoru V20.

Zarezerwuj kartę właściwą dla zasad z Attributes/Abilities, poziomami zdrowia, Blood Pool i Willpower, z ograniczeniami wydatków na turę tam, gdzie są obsługiwane. Nie konwertuj Blood Pool na ogólne MP ani Celerity na podwajanie od szybkości Traditional. Testy muszą wskazywać edycję i wykorzystany fragment zasad; odpowiedź na forum ani podgląd Dark Ages nie są wystarczającą podstawą dla współczesnych zasad V20. Przed rozpowszechnianiem skopiowanego tekstu lub bloków statystyk ustal zasady ponownego użycia treści i przypisania autorstwa dla faktycznie wybranego źródła; ten dokument takich treści nie dostarcza.

## Akcje legendarne, przewidywanie i reakcje

Zaakceptowany kierunek: bossowie GM mogą mieć akcje legendarne także w Traditional i innych zasadach spoza 5e. Jest to jawny **modyfikator starcia z bossem**, niezależny od zwykłej inicjatywy, temperamentu i uczestnictwa. Zobacz sekcję o bossach w projekcie AI.

Adapter udostępnia `afterActivation`, a włączony modyfikator przewidywania aplikacji Marinara może też udostępniać `activationStarted`, gdy uczestnik zatwierdzi rozpoczęcie tury. Oba okna legendarne zużywają **tę samą** skończoną pulę bossa. Same kliknięcia, oglądanie, anulowane menu i odświeżenia nie otwierają kolejnych okien. GM może przewidzieć Fireball na podstawie dostępnych zdolności i zasobów maga oraz rzeczywistych zasad obszaru i obrażeń sojuszników, zanim gracz zadeklaruje czar; nie może odczytać przyszłego polecenia. To przewidywanie jest zasadą domową rozszerzającą czas po turze z 5e, jawnie przypiętą do starcia. Wierny profil zachowuje oryginalny czas, chyba że modyfikator jest włączony.

Zasada jednego rozpoczęcia wymiany w Traditional dotyczy zwykłych aktywacji; autorska akcja legendarna nie przyznaje zwykłej aktywacji ani dodatkowego uderzenia od szybkości. Classic musi wstrzymać działanie w miejscu inicjatywy danego uczestnika zamiast przerywać wcześniej, gdy interfejs zbiera polecenia całej rundy. Po przerwaniu ponownie sprawdzaj polecenia w kolejce i proś o zastąpienie, jeśli stracą legalność przed zatwierdzeniem. Tactical potrzebuje odrębnego zatwierdzenia początku aktywacji, aby przeglądanie jednostek było bezpieczne, a ponowny wybór nie umożliwiał zdobywania kolejnych przerwań.

Reakcje takie jak Counterspell należą do obsługiwanych **wyzwalaczy zdarzeń**, niezależnie od statusu legendarnego. Określ co najmniej zdarzenie wyzwalające, czas przed lub po efekcie, widoczność i zasięg, koszt zasobów, limit i odnowienie reakcji, wynik oraz działanie anulowania i zwrotu kosztu pierwotnej akcji. GM bossa i zwykła AI korzystają z tych samych legalnych okien; jednostki ręczne otrzymują wybór React/Pass. AI automatycznie ocenia okno i może spasować zależnie od temperamentu, wartości zagrożenia, szansy sukcesu, niedoboru MP lub komórek oraz kosztu utraty reakcji. Sama dostępność nigdy nie wymusza wydatku. Zwykła jednostka może reagować bez stawania się bossem.

Counterspell wymaga oczekującego rzucenia czaru, nie tylko wybranego maga. Zachowaj oddzielne typy zasobów MP, punktów i komórek. [Czar z 2014 r.](https://www.dndbeyond.com/spells/2051-counterspell) korzysta z zasad poziomu czaru i testu, natomiast [czar z 2024 r.](https://www.dndbeyond.com/spells/2619072-counterspell) korzysta z rzutu obronnego Kondycji i określa, że skutecznie przerwany czar używający komórki jej nie zużywa. Nie stosuj zwrotu pierwotnego czaru z 2024 r. do wszystkich edycji ani do opłaty reagującego czarującego. Traditional potrzebuje jawnej, dostrojonej operacji przerwania; V20 powinno mapować własne zdolności reaktywne zamiast dziedziczyć Counterspell po nazwie.

Rezerwuj i zatwierdzaj zasoby atomowo z przyjętymi deklaracjami i reakcjami, osobno zapisując zwroty właściwe dla zasad. Proponowana wartość domyślna Traditional: jedna reakcja, dostępna początkowo, chyba że jawny warunek starcia to blokuje, odnawiana na początku zwykłej aktywacji jednostki. Inne adaptery określają własny limit i moment odnowienia. Akcje legendarne i dodatkowe uderzenia nigdy nie odnawiają go pośrednio. Zachowaj odrębność obecnych kontrataków w wymianie, chyba że jawnie je zmapowano. Jeśli opcja legendarna rzuca czar, udostępniaj reakcje na czar tylko zgodnie z wybranymi zasadami.

Użyj ograniczonego, zapisywanego stosu oczekujących akcji z identyfikatorami rodzica i wyzwalacza dla obsługiwanych zagnieżdżonych reakcji, stałym priorytetem reagujących i ponowną walidacją po każdej odpowiedzi. Anulowanego już czaru nie można kontrować ponownie. Spasowanie zamyka danej jednostce okazję dla tego wyzwalacza. Ograniczony adapter musi ujawniać nieobsługiwane łańcuchy kontrreakcji. Rozstrzygaj przyjęte zdarzenia raz i wyprowadzaj z nich narrację; odwracalne przerwanie tekstowe z [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) jest precedensem zapisu i kontekstu, a nie zgodą na cofanie walki przez obcinanie prozy. Pełny cykl życia i macierz akceptacji znajdują się w sekcji 16 projektu AI.

## Kontrakt zapisu, interfejsu i wdrożenia

- Przypnij w migawce starcia identyfikator i wersję zasad, efektywne opcje, kontrolery jednostek, karty, początkową kolejność, bieżącą i zatwierdzoną aktywację, limity i momenty odnawiania akcji legendarnych oraz reakcji, stos oczekujących akcji, identyfikatory wyzwalaczy i decyzji, zobowiązania i zwroty zasobów, czasy odnowienia, stan RNG i zaakceptowane decyzje przerwania.
- Przed asynchronicznymi decyzjami GM wymagaj rejestru rewizji i akcji należącego do serwera. Odrzucaj nieaktualne równoległe zgłoszenia i zapewnij idempotencję ponowień. Identyfikator kandydata zapisany w przeglądarce nie wystarczy.
- Zmiana ustawień gry wpływa na następne starcie. Zachowaj przypięte zasady aktywnej bitwy także po imporcie, przywróceniu punktu kontrolnego lub gałęzi, ponownym połączeniu i aktualizacji.
- Zachowaj `engine-legacy` dla trwających starszych walk. Zaproponuj jawną konwersję przyszłej bitwy z podglądem niezmapowanych statystyk i zasobów; nigdy nie nadpisuj po cichu kart ani zapisanych pul.
- Nieznane wersje zasad są tylko do odczytu i możliwe do odzyskania, a nie interpretowane po cichu jako najnowsza wersja.
- Wprowadź zlokalizowany wybór **Combat rules** (zasady walki) osobno od **Combat presentation** (prezentacja walki) i przyszłego **Participation** (uczestnictwo). Krótko opisz kolejność, zasoby i najważniejsze działanie; pokaż ograniczenia zgodności przed rozpoczęciem.
- Jeśli brakuje wymaganych pól karty, poproś o nie przed walką; korzystaj ze starszych zasad wyłącznie po jawnym wyborze. Nie pozwalaj generowaniu wymyślać autorytatywnych statystyk postaci.

## Kolejność implementacji i dowody zakończenia

| Etap | Praca | Najmniejszy użyteczny dowód |
| --- | --- | --- |
| 1 | Przegląd istniejących mechanizmów rozstrzygania, przypięta tożsamość i starszy adapter | Starsze zapisy i obie obecne prezentacje odtwarzają wcześniejsze działanie |
| 2 | Aktywacja i wymiana Traditional oraz jawne rozliczanie zasobów | Macierz progów szybkości; jedno rozpoczęcie wymiany na rundę; rozliczanie MP i odnowienia |
| 3 | Podglądy, wybór w interfejsie i zapis zaakceptowanych zdarzeń | Zgodność prognozy z rozstrzygnięciem; testy odświeżenia, importu i punktów kontrolnych; zrzuty komputera i telefonu |
| 4 | Granice deklaracji i efektu, opcjonalne reakcje, przewidywanie bossa i okna po turze | Brak wywoływania dodatkowych okien przez wybór i wycieku przyszłych poleceń; AI może spasować; poprawne koszty, odnowienia i zwroty; brak dodatkowej zwykłej tury lub podwajania |
| 5 | Jawnie opisany podzbiór 5e-2014 ze źródeł pierwotnych | Pozytywne i negatywne przykłady właściwe dla edycji dla każdej obsługiwanej akcji |
| 6 | Audyt i implementacja określonego podzbioru V20 | Zweryfikowane przykłady inicjatywy, limitów zasobów i obrażeń; bez przypadkowej matematyki 5e lub Traditional |
| 7 | Dostosowanie limitów Summoning i właściciela poleceń | Czas pojawienia, odwołania i śmierci, limit liczebności i brak mnożenia akcji przez przywołania |

Przypadki akceptacji Traditional: różnica szybkości 4 i 5; równa szybkość; kontratak zabija napastnika; pierwszy cios zabija cel; pierwszy cios chybia; obezwładnienie w trakcie wymiany; niedostępny kontratak dystansowy; niedostateczne MP lub niezakończone odnowienie; identyczna legalność dla gracza, AI i GM; dwie szybkie jednostki nadal inicjują po jednej wymianie; akcja legendarna nie resetuje tych znaczników; odnowienie rundy przywraca limity raz; nieznana wersja bezpiecznie odmawia działania.

Przypadki akceptacji reakcji i przewidywania: wybór uczestnika a zatwierdzona aktywacja; ponowny wybór i przeładowanie; dokładne miejsce w kolejce Classic; dostępny kosztowo Fireball a wyczerpany mag; przewidywanie może być błędne; opcjonalne pominięcie słabego czaru a wartościowa kontra; niewystarczający limit reakcji, MP lub komórek; nieudana kontra nadal jest opłacona; zwrot pierwotnego czaru zgodny z edycją; wyzwalacz poza zasięgiem lub niewidoczny; wielu reagujących; obsługiwana zagnieżdżona kontra i ograniczenie stosu; nieaktualna odpowiedź po śmierci celu; ponowna walidacja przerwanego wyboru z kolejki; oryginalny czas a zasada domowa; brak ukrytych poleceń w kolejce i przyszłego RNG w promptach kontrolerów.

Uruchom `pnpm install`, `pnpm check`, ukierunkowane testy `*.regression.ts`, regresje promptów przy zmianie promptów GM lub schematów oraz testy przeglądarkowe obu prezentacji. Postępuj zgodnie z procedurą zgłoszeń i PR repozytorium; przed przeglądem uwzględnij lokalizację interfejsu, changelog, zadanie tłumaczeń i CodeRabbit. Pozostaw pola ręcznej weryfikacji w PR niezaznaczone.
