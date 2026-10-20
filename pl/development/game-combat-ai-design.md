# AI walki w Game Mode: wrogowie, towarzysze i bossowie sterowani przez GM

**Stan: zwykłe AI oraz pierwsza implementacja bossów GM i reakcji są dostępne lokalnie; Summoning i nazwane zestawy zasad pozostają propozycjami.** Dokument przygotowany 17 września 2026 na podstawie kodu walki włączonego do staging w [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266). Pierwotna baza audytu staging: `1f2e965c34f77b19a1457439f61e291300e163c7`; kopia `025442b1722b090b4640e0f078d1e08a4435f965` zawierała tę samą istotną implementację walki. Obecna implementacja lokalna wywodzi się ze staging `abe61d30a`. Przed dalszym wdrażaniem sprawdź staging ponownie; numery wierszy pierwotnego audytu dotyczą wcześniejszej bazy.

Dokument jest samodzielny i pozwala kontynuować pracę bez pierwotnej rozmowy. Zawiera wymagania opiekunki projektu, audyt źródeł, zalecane ustawienia, granice implementacji i scenariusze akceptacyjne. Proponowane liczby i pola spoza zakresu wdrożonego w sekcji 13 nie stanowią istniejących kontraktów ani potwierdzonego rozgrywką balansu. Implementacja i dokumenty przekazania są pracą lokalną; nie zgłoszono jeszcze issue ani PR.

## Aktualizacja zakresu z 17 września

Opiekunka zatwierdziła zwykłe AI w Classic i Tactical oraz opcjonalne sterowanie towarzyszami przez AI, a następnie wdrożenie bossów GM i reakcji. Zaprojektowani bossowie mogą korzystać z legendarnych akcji niezależnie od wyboru zasad 5e przez gracza. GM otrzymuje karty walki i zasoby drużyny; może przewidywać prawdopodobne działania na początku aktywacji jednostki. Reakcje zużywające zasoby, takie jak Counterspell, wymagają decyzji kontrolera, a nie bezwarunkowego użycia przy każdej okazji. Summoning pozostaje rozszerzeniem projektu. Zachowano pierwotny audyt i pełniejszy projekt; sekcje 13–17 określają bieżące decyzje i zastępują kolejność wdrażania tylko w Tactical, propozycję ośmiu przymiotników na start, wcześniejszy zakres ograniczony do analizy oraz pierwotny prompt bossa oparty wyłącznie na stanie obserwowalnym.

Kod wykonawczy to pierwsza implementacja polityki użyteczności, a nie realizacja wszystkich scenariuszy akceptacyjnych tego dokumentu. Jej granice opisują sekcje 13 i 16. Osobny [dokument wdrażania zestawów zasad](game-combat-rulesets-implementation.md) obejmuje dalsze prace nad szybkością w Traditional, kolejnością tur i ruchu, pulami zasobów oraz przyszłymi profilami konkretnych edycji.

## 1. Wymagania opiekunki projektu

- Zwykli wrogowie używają zachowania sterowanego przez silnik, opisanego **jednym przymiotnikiem i rolą bojową**, np. Reckless Bruiser lub Cautious Spellcaster.
- **Tylko wrogowie rangi bossa otrzymują sterowanie przez GM w każdej turze.** Silnik nadal ustala legalne akcje i rozstrzyga wyniki. Sterowanie bossem oznacza wybieranie działań podczas walki, nie tylko wygenerowanie wcześniejszego skryptu.
- Przypisanie przymiotnika uwzględnia wyszkolenie/poziom, rolę i znaną osobowość, z pewną losowością. Doświadczeni wrogowie częściej powinni mieć nawyki pasujące do roli, ale weterani nie mogą być identyczni.
- **Każdy Beast i Monstrosity jest Mindless.** Ściga najbliższego członka drużyny najkrótszą legalną trasą, ignorując zdrowie celu oraz zalety i wady terenu. Nie wprowadzaj ukrytych wyjątków dla bossów ani nazwanych stworzeń.
- Priorytetem są ciekawa strategia, wiarygodne zachowanie i różnorodność kolejnych rozgrywek, zwłaszcza w walce taktycznej i przyszłej grze zbliżonej do stołowych RPG. Zmiana AI nie wymaga wdrażania zasad 5e ani V20.
- Zachowaj szczegółowy projekt do późniejszej realizacji. Pierwotny zakres analityczny rozszerzono od tego czasu o zwykłe AI i sterowanie towarzyszami; patrz aktualizacja powyżej.

Powiązany kierunek opisuje [plan rozwoju walki](game-combat-roadmap.md): zasady pola bitwy, udział drużyny/przywołań oraz profile zasad stołowych są niezależnymi wyborami. Taktyka wrogów również powinna być od nich niezależna. Summoning pozostaje późniejszym priorytetem.

### Zalecane ustawienia wymagające jeszcze akceptacji projektu

1. Zacznij od ośmiu przymiotników: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Pokazuj przymiotnik i rolę w podglądzie wroga z krótkim wyjaśnieniem. Nie pokazuj w zwykłym interfejsie prawdopodobieństw, wag użyteczności ani surowej analizy osobowości.
3. Najkrótsza trasa Mindless oznacza **najmniej legalnych kroków przestrzennych**, nie najniższy koszt ruchu po terenie. Jednostka może przebrnąć krótszą trasą przez las, nawet gdy dłuższa otwarta droga byłaby szybsza. Ruch nadal zużywa rzeczywisty koszt terenu.
4. Boss typu Beast/Monstrosity pozostaje Mindless. GM wybiera wyłącznie akcje zgodne z wymaganym celem i zachowaniem pościgu.
5. Zwykłe profile są losowane raz i zapisywane. Powracający nazwany NPC zachowuje ustalony temperament; sam awans nie losuje osobowości ponownie.
6. W zmienionym zakresie wdrażaj zwykłe AI równocześnie w Tactical i Classic. Ukończenie całego żądanego systemu obejmuje rzeczywiste tury bossów GM; etapu ograniczonego do silnika nie opisuj jako całej funkcji.

## 2. Audyt źródeł sprzed przebudowy

Najbliższa rzeczywistości jest druga hipoteza opiekunki: każdy aktywny silnik walki ma wspólną politykę automatyczną. GM tworzy starcie, ale nie wybiera poszczególnych tur w aktywnych interfejsach walki Game Mode.

| Obszar                    | Classic Game Mode                                                         | Tactical Game Mode                                                            |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Kolejność tur              | Rzuty inicjatywy i szybkość; uczestniczą wszyscy walczący                   | W nowych grach według inicjatywy (po jednej jednostce, kolejność losowana raz, combat C6c); w starszych według stron (faza gracza, potem wrogowie według szybkości) |
| Polityka wrogów            | Wspólna heurystyka umiejętności, poza tym losowy żywy przeciwnik           | Wspólne priorytety: leczenie, oceniany atak, podejście                        |
| Różnice klas       | Brak polityki decyzji zależnej od klasy                                         | Sześć klas zmienia zasięg, ruch i trafienia krytyczne; polityka jest wspólna |
| Osobowość/wyszkolenie | Brak zapisanego modelu osobowości taktycznej lub wyszkolenia                          | Brak zapisanego modelu osobowości taktycznej lub wyszkolenia                              |
| Decyzje bossów          | Zwykła polityka plus obsługiwane mechaniki skryptowe                   | Zwykła polityka; etykieta bossa wpływa na rozmieszczenie/interfejs                         |
| GM w każdej turze     | Poza aktywnym rozstrzyganiem                                                | Poza aktywnym rozstrzyganiem                                                    |
| Odtwarzalność         | Losowe decyzje/rzuty bez ziarna                                      | Ziarno i licznik akcji sterują decyzjami oraz rzutami walki                   |
| Trwałość             | Klient odtwarza migawkę walki; stan rundy/animacji nie jest w pełni zapisany | Klient zapisuje pełną migawkę taktyczną w metadanych czatu               |

Istnieje też osobny system okna starcia z trasą `/encounter/action` sterowaną modelem i typami akcji bojowych. Korzysta z niego ogólne okno czatu `EncounterModal` przez `useEncounter`, a nie obecny `GameCombatUI` w Game Mode. Model może zwrócić przepisany stan walki; nie używaj go bez zmian jako proponowanego kontrolera bossa weryfikowanego przez silnik. Przed ponownym użyciem lub usunięciem czegokolwiek prześledź faktyczne miejsca wywołań.

Jawny manewr **Special** (akcja specjalna) w Classic również prosi GM o rozstrzygnięcie działania narracyjnego i dopuszcza obsługiwane tagi statusów/żywiołów. Nie rozstrzyga zwykłej rundy ani nie wybiera rutynowych tur wrogów. Zachowaj to rozróżnienie przy zmianach promptów GM; sterowanie turami tylko bossów nie zabrania generowania starć, rozstrzygania narracji ani opisu po walce.

### Polityka Classic

W `combat.service.ts` funkcja `resolveCombatRound` wywołuje `chooseAutoSkill` dla automatycznych sojuszników i wrogów:

1. Umiejętność jest dostępna przy wystarczającym MP i pomyślnym sprawdzeniu odnowienia przez modulo rundy.
2. Ulecz najbardziej rannego kwalifikującego się sojusznika, jeśli ma najwyżej 75% HP i dostępne jest leczenie.
3. W przeciwnym razie z prawdopodobieństwem 45% wybierz losową umiejętność inną niż leczenie i losowego wroga.
4. W przeciwnym razie zaatakuj losowego przeciwnika.

Wrogowie przekazują na liście sojuszników tylko siebie, więc ta polityka obecnie nie pozwala im leczyć innych wrogów. Grupa umiejętności innych niż leczenie obejmuje wzmocnienia oraz ataki/osłabienia; zamiennik musi sprawdzać docelową stronę każdej umiejętności, zamiast zachować to grupowanie. W praktyce opisany niżej brak MP u generowanych wrogów uniemożliwia im używanie umiejętności z dodatnim kosztem, pozostawiając podstawowe ataki w losowe cele. Polecenie gracza otrzymuje pierwsza żywa jednostka jego strony; pozostali sojusznicy działają automatycznie. Zmiana taktyki wrogów nie może po cichu zmieniać sterowania towarzyszami ani tożsamości gracza.

Generowane mechaniki są przetwarzane oddzielnie po zwykłych akcjach. Obecnie wykonują się tylko `round_interval` i `hp_threshold`; akceptowane wyzwalacze `on_hit`, `on_attack` i `passive` nie działają. Mechaniki progu HP powtarzają się w kolejnych kwalifikujących się rundach, a `damage_one` wybiera pierwszy przeciwny cel. Nie jest to wybieranie ruchu bossa przez GM na żywo. Przed adaptacją wyraźnie rozdziel efekty jednorazowe i cykliczne.

Classic rozstrzyga też umiejętności inne niż leczenie ścieżką nastawioną na obrażenia; wzmocnienia/osłabienia nie odpowiadają operacjom wsparcia Tactical, choć trafieniu może towarzyszyć nazwany status. Rzeczywista semantyka wsparcia/kontroli i stan odnowienia po każdym użyciu są warunkiem deklarowania tych zachowań w Classic. Automatyczna obrona/czekanie również wymaga obsługi w rozstrzyganiu; obecna obrona należy do miejsca kontrolowanego gracza w inicjatywie, więc szybsi wrogowie działają przed jej uruchomieniem. Trudność skaluje teraz obrażenia obu stron we wspólnym rozstrzyganiu, nie jakość decyzji. Zachowaj lub zmień to niezależnie od strojenia temperamentu.

Osobnego dowodu wymaga istniejąca niespójność sterowania: po KO jednostki w pozycji zero serwer przekazuje polecenia pierwszemu żywemu sojusznikowi, a indeks aktywnego gracza w UI pozostaje zerem. Niedostępny identyfikator umiejętności może wtedy skutkować podstawowym atakiem. Zapisz/napraw to osobno, bez wiązania z temperamentem wrogów.

### Polityka Tactical

Obecnie `packages/shared/src/features/tactical-combat/ai.ts`:

1. Próbuje użyć pierwszego gotowego leczenia na sojuszniku o najniższym udziale HP w promieniu dwóch pól, jeśli ma najwyżej 60% HP. Nie podchodzi wcześniej w zasięg leczenia.
2. Ocenia osiągalne pozycje ruchu względem żywych przeciwników, uwzględniając podstawowe ataki i gotowe umiejętności ataku.
3. Ocenia ataki wzorem `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. likelyKill oznacza prognozowane obrażenia co najmniej równe obecnemu HP i szansę trafienia minimum 50%, nie gwarantowaną eliminację.
4. Czasem zastępuje najlepszy atak bez eliminacji innym losowym legalnym atakiem. Prawdopodobieństwa: 60% casual, 30% normal, 10% hard, 0% brutal. Akceptacja leczenia wynosi odpowiednio 50%, 80%, 100%, 100%.
5. Gdy atak nie jest dostępny, zbliża się do przeciwnika najbliższego według odległości Manhattan, wybierając osiągalne pole najbliższe w tej metryce. Nie jest to szukanie najkrótszej trasy na całej planszy; jednostka może nie potrafić ominąć przeszkód.

Teren wpływa na ruch i prognozy obrażeń/trafienia, lecz polityka nie ocenia ogólnie narażenia jednostki w następnej fazie gracza. Nie wybiera celowo wzmocnień, osłabień, obrony ani przedmiotów. Zasięg umiejętności jest uproszczony. Wygenerowane opisy AoE nie stanowią pełnego przestrzennego rozstrzygania ataków obszarowych.

Klasy to Fighter, Knight, Rogue, Archer, Mage i Healer. Wyznaczanie klasy korzysta z jawnej wskazówki, leczenia, słów kluczowych nazw/umiejętności, ataków żywiołów i heurystyk statystyk. Sama etykieta roli nie tworzy zdolności.

### Braki podstawowe podważające system osobowości

To wyniki inspekcji źródeł, a nie twierdzenia o wykonanej reprodukcji w przeglądarce:

| Brak                                                     | Dowód i skutek                                                                                                                                                    | Wąski następny krok                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generowani wrogowie nie mają MP                            | `generatedEnemyToCombatant` pomija MP/maxMP; generowane umiejętności inne niż podstawowe mają dodatnie koszty MP. Oba silniki traktują brak MP jako zero. Wrogowie nie mogą ich używać. | Dodaj regresję obejmującą rzeczywiste odtwarzanie schematu; zachowaj jawne zasoby lub zastosuj udokumentowaną regułę zasobów generowanych wrogów. Nie przyznawaj nieograniczonych zaklęć. |
| Poziom jest wnioskowany z HP                               | Poziom generowanego wroga zwykle wynika z zaokrąglonego maxHP/20. Wytrzymałość nie oznacza wyszkolenia taktycznego.                                                       | Dodaj ograniczoną wskazówkę wyszkolenia; poziom traktuj tylko jako jawny wariant zastępczy do czasu właściwych danych z profili zasad.                                                  |
| Tożsamość bossa jest heurystyczna                              | Tactical oznacza najsilniejszego wroga w grupie co najmniej dwóch według maxHP + level\*10 + attack. Ta heurystyka nigdy nie oznacza samotnego wroga.                               | Dodaj jawną tożsamość bossa dla każdego wroga. Sam poziom muzyki starcia nie wskazuje jednostki otrzymującej tury GM.                                                               |
| Generowane mechaniki bossów nie trafiają do Tactical          | Classic otrzymuje właściwości mechanik; Tactical nie korzysta z ich wygenerowanej listy.                                                                                       | Przypisz obsługiwane mechaniki do zweryfikowanych operacji taktycznych z zapisanym stanem faz/wyzwalaczy. Oznaczaj nieobsługiwane mechaniki zamiast opisywać je jako wykonane.          |
| Typ stworzenia i osobowość nie są kontraktami wykonawczymi | Opis wroga istnieje w schemacie, ale znika przy odtwarzaniu stanu; Beast/Monstrosity nie są typowanymi kategoriami.                                                | Przenoś jawną kategorię i ograniczone dane przypisania przez wszystkie granice konwersji i zapisu.                                                                 |
| Linia widzenia i osłony w trybie Tactical są wspólne (combat C6)        | Ściana albo góra blokuje widzenie zarówno w walkach natywnych, jak i w walkach zestawu zasad, a osłona jest stopniowana tym samym testem (połowiczna, trzy czwarte): podglądy, akcje, kontry, obszary, reakcje, nakładki zagrożenia i AI używają `hasLineOfSight` i `coverTier`. | Zachowaj jeden test widzenia i jeden test osłony dla wszystkich wywołujących.                                                                     |
| Prognozy kandydatów AI odczytują pole kandydata      | Oba AI prognozują atak i kontrę, którą ryzykują, z pola, z którego zadałyby cios, więc osłona (combat C6a-2) jest ważona tak, jak zostanie rzucona. | Zachowaj prognozy i rozstrzyganie na jednym `hitChance`.                                                    |

Kolejny brak konwersji dotyczy obu silników: rodzaj generowanego ataku jest wnioskowany z angielskich słów kluczowych nazwy/opisu, chociaż tekst starcia może być w innym języku. Flaga `AoE`/`both` ze schematu również nie przechodzi w rzeczywistą obsługę wielu celów. Przyszłe wyznaczanie ról powinno korzystać z jawnych zweryfikowanych pól zdolności; przetłumaczone nazwy nie mogą decydować, czy zaklęcie leczy, czy atakuje.

Nie dołączaj pełnego przepisywania walki do tych warunków wstępnych. Dodaj najmniejsze dowody, popraw właściwy przepływ i wykorzystaj istniejące funkcje ruchu, prognozowania, gotowości umiejętności oraz rozstrzygania akcji.

## 3. Rozdziel zdolności, temperament i sterowanie

Każdy wróg wymaga odpowiedzi na różne pytania:

| Wymiar           | Znaczenie                                          | Przykład                                                                |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Kategoria stworzenia   | Stosuje obowiązkowe reguły typu                      | Beast wymusza Mindless                                                  |
| Rola                | Do czego nadaje się rzeczywisty zestaw zdolności           | Supporter ma dostępne zdolności leczenia/wzmocnień                            |
| Temperament         | Co ceni przy wyborze spośród legalnych akcji | Cautious ceni unikanie zagrożeń                                  |
| Wyszkolenie         | Jak konsekwentnie realizuje swoje nawyki          | Weteran Reckless Bruiser nadal ryzykuje, lecz marnuje mniej akcji |
| Kontroler          | Kto wybiera akcję                           | Silnik dla zwykłych wrogów; GM dla jawnie oznaczonych bossów                    |
| Cel starcia | Co strona próbuje osiągnąć               | Teraz pokonać drużynę; później ochrona/ucieczka/schwytanie                         |

Początkowo użyj jednego głównego przymiotnika. Nie wprowadzaj dowolnego łączenia cech, edytora wektorów osobowości, zależności drzew zachowań ani ogólnego systemu planowania. Wystarczy mała tabela profili nad wspólnymi legalnymi kandydatami.

### Role wynikające ze zdolności

Zachowaj istniejące klasy taktyczne jako ustawienia geometrii/statystyk. Małe mapowanie ról polityki może je doprecyzować, jeśli uzasadnia to zestaw zdolności:

| Proponowana rola | Dowody zdolności                                | Typowe zadanie                                          | Prawdopodobne przymiotniki                    |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Bruiser       | Silne ataki z bliska                         | Podejście i wymiana obrażeń                               | Reckless, Disciplined, Opportunistic |
| Bulwark       | Wytrzymały zestaw do walki wręcz                                  | Utrzymanie przydatnej pozycji przy wrażliwych sojusznikach        | Protective, Disciplined, Cautious    |
| Skirmisher    | Mobilność i skuteczne obrażenia z bliska            | Wybieranie korzystnych starć                           | Opportunistic, Cautious, Reckless    |
| Marksman      | Stałe ataki dystansowe, możliwy minimalny zasięg | Utrzymanie przydatnego dystansu strzału                    | Cautious, Disciplined, Opportunistic |
| Spellcaster   | Dostępna magia ofensywna i jej zasoby       | Presja dystansowa bez marnowania ograniczonych umiejętności | Cautious, Disciplined, Opportunistic |
| Controller    | Dostępne efekty osłabień/kontroli                     | Osłabianie istotnego zagrożenia                             | Disciplined, Opportunistic, Cautious |
| Supporter     | Dostępne leczenie/wzmocnienia                            | Utrzymanie skuteczności grupy                             | Supportive, Protective, Cautious     |

To skłonności początkowe, nie zakazy. Cowardly Fighter lub Reckless Spellcaster nadal musi być możliwy. Cleric w zbroi z walką wręcz może być Bulwark; uzdrowiciel może preferować tylną linię. Nie wnioskuj temperamentu wyłącznie ze stereotypu klasy. Chwilowy brak MP zmienia legalne akcje, nie zapisaną rolę ani przymiotnik. Nie przypisuj Supportive jednostce, która nigdy nie miała zdolności wsparcia.

## 4. Katalog przymiotników

### Pierwsza ósemka

| Przymiotnik         | Preferencja celu                                                             | Pozycja i ryzyko                                                                                    | Używanie umiejętności/zasobów                                                                                      | Czego może nauczyć się gracz                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Najbliższy żywy osiągalny członek drużyny według sekcji 6               | Najkrótsza legalna trasa przestrzenna; ignoruje korzyści terenu, narażenie i formację                           | Prosty legalny atak w ten cel; bez priorytetów leczenia, skupiania ognia i optymalizacji zasobów                   | Zwabiaj bliskością, terenem i wąskimi przejściami             |
| **Reckless**      | Natychmiastowe obrażenia i osiągalna presja; nie automatycznie najsłabsza ofiara | Agresywnie podchodzi, toleruje kontry i odsłonięte pozycje                                  | Chętnie używa silnych dostępnych ataków; rzadko zatrzymuje się dla obrony                                             | Karz nadmierne wysunięcie i prowokuj niekorzystne wymiany            |
| **Cautious**      | Cele, którym może zagrozić przy ograniczeniu obrażeń zwrotnych                          | Ceni bezpieczne pozycje, przydatny zasięg i teren obronny                                            | Oszczędza rzadkie zasoby, gdy zwykły atak jest niemal równie przydatny; leczy/broni się w razie potrzeby                | Ograniczaj bezpieczną przestrzeń; wykorzystuj niechęć do zaangażowania   |
| **Opportunistic** | Cele ranne, odsłonięte lub osłabione; pewne szanse dobicia   | Przyjmuje część ryzyka dla konkretnej okazji                                                                | Ceni umiejętność, gdy tworzy lub wykorzystuje okazję                                                      | Chroń wrażliwych sojuszników i uniemożliwiaj łatwe dobicia   |
| **Protective**    | Zagrożenia dla wyznaczonego wrażliwego sojusznika lub pobliskiej wspieranej grupy          | Pozostaje w zasięgu wsparcia; zajmuje legalne przydatne pola blokujące                                    | Chroni podopiecznego obroną/wsparciem; atakuje, gdy ochrona nie jest pilna              | Rozdzielaj grupę lub podchodź z kilku stron   |
| **Supportive**    | Zdrowie sojuszników i przydatne wzmocnienia przed własnymi obrażeniami                           | Przesuwa się w legalny zasięg wsparcia, unikając zbędnego narażenia                                        | Leczy istotne braki HP, unika nieprzydatnego nadleczenia i zdublowanych wzmocnień; atakuje, gdy wsparcie niewiele daje | Wywieraj presję na wspierającą jednostkę lub oddzielaj ją od odbiorców |
| **Disciplined**   | Cele zgodne z rolą, rozsądne szanse dobicia                      | Równoważy obrażenia, bezpieczeństwo, pozycję i zasoby; umiarkowanie trzyma się celu                            | Rzetelne podstawy roli bez specjalizacji w skrajności                                               | Zakłócaj rolę i wymuszaj niekorzystne wybory              |
| **Cowardly**      | Bezpiecznie osiągalne cele bez prowokowania odwetu                       | Instynkt samozachowawczy rośnie po zranieniu lub przy lokalnej przewadze liczebnej wroga; odwrót w bezpieczniejszą przestrzeń sojuszników | Chętniej leczy/broni siebie i unika kosztownego zaangażowania                                                | Odcinaj bezpieczny odwrót i utrzymuj presję dystansową    |

Protective nie przekierowuje magicznie obrażeń, nie prowokuje, nie przechwytuje ataków ani nie zyskuje reakcji. Obecne zajmowanie pól pozwala blokować pozycją; silniejsza ochrona wymaga rzeczywistych zdolności. Cowardly może się wycofać i bronić, ale istniejąca akcja Tactical `flee` kończy całą walkę. **Nigdy nie używaj globalnej ucieczki jako ucieczki jednego wroga.** Odwrót/poddanie pojedynczej jednostki wymaga nowych jawnych zasad.

Cautious i Cowardly powinny dawać różne wyniki: zdrowy Cautious Marksman zajmuje dobrą pozycję strzelecką; ranny Cowardly Marksman może zrezygnować z dobrego strzału, by ocalić siebie. Podobnie różnią się Protective i Supportive: pierwszy chroni osobę lub pozycję, drugi maksymalizuje przydatne akcje wsparcia.

### Rozszerzenie tylko przy odrębnym zachowaniu i dowodach

| Przymiotnik   | Odrębne zachowanie                                                                                         | Wymagania przed wydaniem                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vengeful    | Trzyma się ostatniego napastnika lub widzianego zabójcy sojusznika, nawet gdy inny cel jest trochę lepszy | Mała trwała pamięć walki; legalna zmiana niedostępnego celu      |
| Patient     | Utrzymuje wartościową pozycję i pozwala wrogom wejść w korzystny zasięg                                          | Ograniczone reguły utrzymania pozycji/wejścia w walkę i ochrona postępu przed wiecznym czekaniem           |
| Predatory   | Śledzi odizolowane cele i angażuje się przy okazji                                              | Miara izolacji; bez obchodzenia obowiązkowego Mindless u Beast/Monstrosity           |
| Fanatical   | Poświęca bezpieczeństwo dla jawnego rytuału, przywódcy lub misji                                               | Cele starcia z widocznym postępem i warunkami porażki                     |
| Methodical  | Tworzy obsługiwaną sekwencję osłabienia/ataku zamiast gonić za natychmiastowymi obrażeniami                            | Jawne zależności kombinacji, ograniczona pamięć i wyraźna różnica względem Disciplined |
| Coordinated | Uwzględnia zamiary sojuszników i ogranicza zbędne ataki/wsparcie                                      | Ograniczony zamiar drużyny, bez wszechwiedzącej doskonałej koordynacji                          |
| Territorial | Broni miejsca i przestaje ścigać poza granicą                                                    | Zapisane terytorium/cel i czytelne wycofanie z pościgu                       |
| Deceptive   | Wprowadza w błąd rzeczywistą zdolnością zwodu, wabika lub ukrycia                                              | Obsługiwane mechaniki podstępu/percepcji; sama narracja nie tworzy efektu     |

Nie wprowadzaj synonimów ocenianych identycznie. Cruel to głównie Opportunistic, chyba że zasady obsługują osobny cel. Strategic lepiej zarezerwować dla rzeczywistego ograniczonego planowania niż etykiety oznaczającej lepszą skuteczność we wszystkim. Odwaga i inteligencja nie muszą być przeciwległymi końcami jednej skali.

## 5. Przypisywanie profili: rola, doświadczenie, osobowość, potem różnorodność z ziarnem

### Kolejność pierwszeństwa

1. Zweryfikuj jawną kategorię stworzenia. Beast lub Monstrosity wymusza Mindless niezależnie od poziomu, osobowości, trudności i statusu bossa. Sprzeczne wskazówki przymiotnika z modelu są odrzucane z zapisem pochodzenia przypisania. Sprzeczny jawnie opracowany/importowany profil wynikowy jest odrzucany z użytecznym błędem; nie przepisuj po cichu zapisanego autorskiego wyboru.
2. Zachowaj już rozstrzygnięty poprawny profil przy wznowieniu starcia. Zachowaj ustalony temperament znanego powracającego NPC, jeśli istnieje stabilna tożsamość.
3. Respektuj autorski profil innych stworzeń, jeśli pasuje do ich zdolności. Nieobsługiwane lub sprzeczne jawne dane dają czytelny błąd walidacji; brak danych uruchamia wartości domyślne.
4. Wyznacz rolę z rzeczywistych zdolności, używając zweryfikowanej wskazówki roli dla niejednoznacznych zestawów.
5. Oblicz wyszkolenie, początkowe skłonności roli i ograniczone korekty osobowości.
6. Wylosuj jeden profil wyborem ważonym z ziarnem; zapisz wynik i wersję polityki.

Mindless jest początkowo wykluczony ze zwykłego losowania. Przyszłe autorskie zachowania nieumarłych/konstruktów mogą go używać, ale obowiązkowa reguła Beast/Monstrosity musi pozostać wymuszana. Dla starych wrogów bez znanej kategorii użyj jawnego `unknown`; słowo "beast" w nazwie nie jest deklaracją taksonomii.

### Wyszkolenie nie oznacza HP, trudności ani wartości moralnej

Preferuj poziom wyszkolenia z profilu zasad lub wiarygodnych danych karty NPC. Następnie użyj jawnej zweryfikowanej wskazówki starcia. Poziom stosuj zastępczo tylko przy braku obu, zapisując źródło. Obecny poziom wywodzony z HP jest słabym zamiennikiem i nie powinien po cichu stać się autorytatywną miarą inteligencji.

W pierwszej implementacji niezależnej od zasad poziomy novice/trained/veteran/master mogą odpowiadać kompetencji `c = 0, 0.35, 0.7, 1`. Konkretna tymczasowa reguła Engine: poziom 1–2 novice, 3–7 trained, 8–14 veteran, 15+ master. To regulowana krzywa projektu gry, nie zasada stołowa; oznacz źródło jako `level-fallback`, zwłaszcza gdy poziomy wynikają z HP. Powiąż mapowanie z wersją przypisania i zastąp mapowaniami profili zasad, gdy się pojawią. Nie utożsamiaj challenge rating 5e z poziomem postaci ani nie narzucaj jednej skali poziomów grom podobnym do V20.

Doświadczenie wpływa **zarówno** na szansę temperamentu odpowiedniego dla roli przy pierwszym przypisaniu, jak i na konsekwencję realizowania go. Zwykłemu lokalnemu AI nie ujawnia ukrytych zdolności gracza ani zakolejkowanych poleceń. Bossowie GM mają szerszą wiedzę o kartach drużyny z sekcji 16; żaden kontroler nie widzi przyszłych rzutów ani nie zna niezatwierdzonego wyboru gracza. Założenie o przetrwaniu doświadczonych to przydatna tendencja do budowania świata, nie prawo mówiące, że każdy doświadczony czarodziej jest ostrożny.

### Konkretny model wag

Użyj małej tabeli ról/przymiotników i jednego ograniczonego wzoru. Przykładowe wartości początkowe wymagające testów rozgrywki:

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c`: kompetencja, 0..1.
- `roleAffinity`: opracowane dopasowanie od -1..1; niektóre osobowości są skuteczne w kilku rolach.
- `personalityMatch`: ograniczone dowody od -1..1, nie nieograniczone liczby podane przez model.
- `q`: pewność znanej osobowości, 0..1; zero przy nieznanej.
- `N`: liczba zgodnych przymiotników; usuń niezgodne profile przed normalizacją. Gdy nie zostanie żaden, zastosuj zweryfikowany wariant Disciplined/podstawowy i zapisz problem danych wejściowych.
- Domieszka 6% daje każdemu zgodnemu rzadkiemu profilowi niewielką szansę. Nigdy nie osłabia twardych reguł typu.

Przykładowy **wszechstronny mag z umiejętnością wsparcia**, bez danych o osobowości:

| Przymiotnik     | Waga bazowa | Dopasowanie roli | Prawdopodobieństwo novice | Prawdopodobieństwo master |
| ------------- | ----------- | ------------- | ------------------ | ------------------ |
| Cautious      | 4           | 1             | 23.0%              | 35.8%              |
| Disciplined   | 4           | 1             | 23.0%              | 35.8%              |
| Opportunistic | 3           | 0.5           | 17.4%              | 15.2%              |
| Supportive    | 1           | 0             | 6.4%               | 3.5%               |
| Protective    | 1           | 0             | 6.4%               | 3.5%               |
| Reckless      | 2           | -1            | 11.9%              | 2.4%               |
| Cowardly      | 2           | -0.5          | 11.9%              | 3.7%               |

Zaokrąglenie może sprawić, że suma nie wyniesie dokładnie 100%. Znana lekkomyślność zwiększa wagę Reckless nawet przy wysokiej kompetencji. Nie losuj ponownie istniejącego przymiotnika nazwanego NPC przy każdej zmianie poziomu. Liczby pokazują oczekiwany trend, nie ostateczny balans.

### Wyodrębnianie osobowości bez wywołania modelu w każdej zwykłej turze

Wykorzystaj istniejące generowanie starcia do interpretacji znanej osobowości postaci/NPC jako najwyżej trzech wskazówek z zamkniętego zbioru, każdej z pewnością niską/średnią/wysoką i ograniczonym odwołaniem do źródła. Przykłady: lojalność, szukanie ryzyka, samozachowawczość, współczucie, cierpliwość. Silnik mapuje wskazówki na wagi liczbowe. Nie proś modelu o dowolne prawdopodobieństwa ani kod wykonawczy.

Gdy osobowość jest znana, korzystaj z niej. Wygląd, np. "pokryty bliznami czarodziej", nie dowodzi ostrożności. Negacja ma znaczenie: "nie jest tchórzliwy" nie może zwiększać Cowardly. Opisy wielojęzyczne i sprzeczne wymagają scenariuszy regresyjnych. Przy braku wyodrębnienia, błędnych lub nieobsługiwanych danych nie koryguj osobowości; wystarczą rola, wyszkolenie i RNG. Samego dopasowywania słów kluczowych nie przedstawiaj jako rozumienia znaczenia.

Zapisuj zaakceptowane wskazówki/pochodzenie potrzebne do wyjaśnienia przypisania, nie zapisy rozumowania modelu. Stabilna tożsamość NPC musi pochodzić z istniejących odwołań do encji, nie tylko nazw wyświetlanych. Anonimowe powtarzające się potwory mogą dostawać nowe profile starcia; powracające nazwane postacie potrzebują profilu związanego z tożsamością, zanim obiecasz spójność między sesjami.

### Granice losowości

- Ziarno przypisania AI wyprowadź z ziarna starcia, stabilnego identyfikatora wroga i wersji przypisania. Oddziel jego domenę od generowania terenu i rzutów walki.
- Nie zużywaj RNG walki podczas samego wyliczania/oceniania kandydatów ani renderowania podglądów.
- Zapisz rozstrzygnięty profil. Odświeżenie, ponowienie, import, cofnięcie do punktu kontrolnego i restart tej samej walki nie mogą przypadkowo losować nowego temperamentu.
- Nowe starcia/ziarna mogą zmieniać skład i temperamenty. Jawne przelosowanie powinno tworzyć nową rewizję starcia, nie potajemnie zmieniać obecną walkę.
- Tactical używa obecnie wspólnego kursora z ziarnem dla decyzji i wyników. Zmiana jego użycia jest wersjonowaną zmianą zachowania; zachowaj politykę trwających starych walk lub dostarcz jawną sprawdzoną migrację.
- Classic z rozstrzyganiem bez ziarna potrzebuje osobnego adaptera RNG/zapisu, zanim można będzie obiecać dokładne odtworzenie.

## 6. Mindless: ścisły kontrakt pościgu

To żądana reguła projektu dla Beast/Monstrosity, nie twierdzenie, że takie etykiety implikują to zachowanie w oficjalnych zasadach stołowych lub u rzeczywistych zwierząt.

### Cel i trasa

1. Rozważ żywych członków drużyny i legalne pozycje, z których wyznaczony prosty atak stworzenia może dosięgnąć każdego z nich. Zajęte pole celu nie jest legalnym miejscem docelowym.
2. Dla chodzenia szukaj na planszy najkrótszych legalnych tras mierzonych **krokami siatki**, ignorując dopłaty terenowe w rankingu tras. Ściany, woda i góry nadal blokują zwykłego piechura. Obecne reguły pozwalają przechodzić przez sojuszników; kończenie na zajętym polu pozostaje zabronione.
3. Preferuj członka drużyny wymagającego najmniej kroków do legalnej pozycji ataku. Przy remisie preferuj przestrzennie bliższy cel, potem stabilny identyfikator celu i kolejność współrzędnych. Nigdy nie rozstrzygaj remisu przez HP, obronę, unik, klasę ani przewidywane obrażenia.
4. Idź wybraną trasą tak daleko, jak pozwala rzeczywisty budżet ruchu tej tury. Las nadal kosztuje dwa punkty. Wybierz najdalszy legalny niezajęty punkt zatrzymania na tej trasie, nie tańszy skrót poza nią dla korzyści taktycznej.
5. Jeśli po ruchu cel jest w legalnym zasięgu, użyj przeciw niemu wyznaczonego prostego ataku. W przeciwnym razie po ruchu czekaj. Domyślny jest atak podstawowy; przy tworzeniu można wyznaczyć zweryfikowany wrodzony atak charakterystyczny. Nie szukaj najlepszej umiejętności obrażeń ani nie zmieniaj celu dla skupiska AoE.
6. Oblicz ponownie przy następnej aktywacji z aktualnej planszy. Jeśli trasa jest zablokowana, wybierz kolejny osiągalny cel. Jeśli nie ma żadnego, czekaj; nie atakuj przez nielegalny skrót ruchu i nie zapętlaj się.

Celem jest celowo nieskomplikowany prześladowca, nie awaria wyznaczania tras. Ściana w kształcie U może wymagać chwilowego oddalenia według metryki Manhattan. Przeszukanie całej planszy powinno znaleźć taką drogę.

**Przykład terenu:** trasa A ma trzy legalne kroki przez las; B pięć przez równinę. Mindless wybiera A, nawet jeśli kosztuje więcej punktów ruchu. Nadal otrzymuje obronę/unik lasu, gdy tam kończy, i płaci koszt ruchu lasu. Cautious może celowo preferować obronną pozycję w lesie; Mindless dostaje tę samą premię przypadkiem.

Lot i teleportacja korzystają z rzeczywistych kontraktów ruchu. Lot przekracza zablokowany teren i zajęte pola oraz pozwala zawisnąć nad normalnie niedostępnym terenem; teleportacja przekracza przeszkody pośrednie, lecz wymaga legalnego terenu lądowania. Żaden tryb nie kończy na zajętym polu. Obecną metryką płaskiej siatki jest odległość Manhattan, nie "jeden skok teleportacji w dowolne miejsce". W pościgu przez wiele tur teleportacja wymaga trasy przez osiągalne legalne miejsca lądowania; nie wybieraj pozornie bliskiego celu za przerwą szerszą niż wszystkie legalne skoki. Obrona/unik terenu działa przy każdym sposobie ruchu.

Nie twórz dla Mindless równoległego, nieco innego zbioru uprawnień przechodzenia. Wydziel/wykorzystaj istniejące predykaty ruchu. Preferencja trasy może ignorować koszt, ale wykonanie nadal stosuje zwykłą legalność i koszty.

### Twarde wykluczenia i pierwszeństwo reguł bossa

Mindless nie sprawdza HP przy wyborze ofiar, nie optymalizuje szansy eliminacji, nie wybiera osłon terenowych, nie koordynuje skupiania ognia, nie leczy rannych sojuszników, nie ucieka ze strachu ani nie zmienia celu z powodu cenniejszej klasy. Trudność i wyszkolenie nie mogą przywracać tych zachowań.

Dla bossa Mindless ogranicz menu GM do wybranego celu i obowiązkowego pościgu, z legalnymi opcjami charakterystycznymi/fazowymi, które nie obchodzą ograniczeń. Jeśli pozostaje jedna akcja, wykonaj ją bez zbędnego wywołania modelu. Przyszły wyjątek dla inteligentnych bossów Beast/Monstrosity byłby świadomą zmianą reguły produktu wymagającą zgody opiekunki, nie wygodą implementacyjną.

Classic nie ma odległości przestrzennej. Nie może wiernie realizować "najbliższego najkrótszą trasą". Proponowana adaptacja to zapisana kolejność zaangażowania starcia z ziarnem, bez wag HP/terenu, wybierająca pierwszy żywy wpis. **Zmieniona implementacja nieprzestrzenna używa tej abstrakcji** i musi być tak opisana; nie spełnia ścisłego wymogu przestrzennego. Nie nazywaj jej odległością; rzeczywista reguła najbliższego celu wymaga przyszłego modelu formacji/pozycji. Późniejsza formacja przód/tył mogłaby ją dostarczyć; kolejność tablicy nie może po cichu stać się odległością. Reguła tras Tactical pozostaje normatywnym zachowaniem Mindless w tej propozycji.

## 7. Decyzje zwykłych wrogów

### Wykorzystaj rozstrzyganie, zmieniaj priorytety

Najpierw generuj legalne akcje kandydackie, potem oceniaj je wagami roli i przymiotnika. Korzystaj z istniejących funkcji ruchu, prognoz i gotowości; dodaj najmniejszą wspólną funkcję legalności potrzebną AI silnika i jednostkom GM. Nie wywołuj wyłącznie mutującej funkcji `performUnitAction` z niezweryfikowanymi danymi modelu.

Kandydaci powinni obejmować:

- Atak podstawowy i dostępne umiejętności ataku, w tym legalne miejsca ruchu przed akcją.
- Leczenie, wzmocnienia i osłabienia właściwej strony, w tym podejście w zasięg wsparcia.
- Obronę, czekanie i celowy ruch, gdy nie ma przydatnego ataku/wsparcia.

Uwzględniaj tylko mechaniki rzeczywiście obsługiwane przez rozstrzyganie. Przedmioty wrogów wymagają najpierw realnego ekwipunku i rozliczania. Ocenianie nie może wymyślać geometrii AoE, przywołań, prowokacji, nowych reakcji, ataków okazyjnych, osłon ani ucieczki. Tactical ma już kontrataki i obronę/czekanie; Classic potrzebuje jawnej automatycznej obrony/czekania oraz właściwych operacji wzmocnień/osłabień, zanim zaoferuje równoważne profile. To praca nad rozstrzyganiem, nie tylko zmiana wag.

Stosuj znormalizowane czynniki oczekiwanych obrażeń, prawdopodobieństwa dobicia, przydatnego leczenia/wsparcia, natychmiastowego ryzyka kontry, narażenia w następnej fazie, postępu ku zasięgowi roli i kosztu zasobów. Pomnóż je przez małą tabelę profili. Ogromna uniwersalna premia eliminacji zatarłaby różnice temperamentu, więc nowa polityka powinna używać ograniczonej wartości dobicia zależnej od profilu.

To małe podejście oparte na użyteczności: porównuj legalne akcje na spójnych skalach i zmieniaj priorytety według osobowości. Ogólne podejście i bezwładność decyzji opisuje David "Rez" Graham w [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Konkretne profile, wzór, ustawienia i plan integracji tutaj to zalecenia projektowe właściwe dla Marinara.

### Praktyczne zabezpieczenia

- Obliczaj prognozy z hipotetycznej pozycji docelowej, uwzględniając teren, bez zmiany aktywnego stanu i zużycia RNG. Prawdopodobieństwo kontry musi odpowiadać faktycznym regułom trafienia/przetrwania/kontry; nie opisuj strzału 50% jako pewnej eliminacji.
- Szacuj zagrożenie następnej fazy z obecnie obserwowalnych pozycji i znanych ataków. Bez podglądania przyszłego RNG lub oczekującego polecenia gracza. Zacznij od ograniczonego szacowania jednej aktywacji przed głębszym przeszukiwaniem.
- Unikaj ciągłego leczenia: oceniaj skuteczne leczenie, pilność, koszt utraconej okazji i MP. Zadrapanie jednego HP nie może automatycznie przeważać ważnej akcji. Nie odświeżaj nadal przydatnego wzmocnienia bez korzyści.
- Unikaj miotania się: zachowuj poprawny cel/podopiecznego, chyba że inna opcja jest istotnie lepsza. Zapisuj tylko faktycznie używaną niewielką pamięć. Mindless stosuje kontrakt najbliższego celu zamiast tej taktycznej stabilności.
- Unikaj niekończącego się ostrzału w odwrocie/obrony: bez istotnego wsparcia lub postępu odwrotu preferuj użyteczne zaangażowanie. Użyj ograniczonego zabezpieczenia przed stagnacją; nie wymuszaj samobójczej szarży Cowardly tylko dla krótkich tur.
- Nie pozwalaj każdej jednostce wybierać identycznego z góry obliczonego planu fazy. Rozstrzygaj w obecnej kolejności i oceniaj następną jednostkę na zaktualizowanym stanie, ograniczając zmarnowane leczenie i ataki na pokonanych.
- Protective wybiera żywego sojusznika według roli/potrzeby i zachowuje podopiecznego, dopóki ten nie stanie się niepoprawny lub wyraźnie nieodpowiedni. Ochrona konkretnego bossa może być wskazówką konfiguracji, nie uniwersalnym zachowaniem wszystkich pomocników.
- Używaj małej zmienności z ziarnem wśród prawie najlepszych akcji **w obrębie wybranego temperamentu**. Nie używaj obecnego jednostajnego losowania wszystkich pozostałych ataków, które może zatrzeć osobowość.

Proponowane strojenie początkowe: znormalizuj użyteczność do stałej skali; novice wybiera opcje w odległości do 0.15 od najlepszego wyniku profilu, master do 0.03, z interpolacją pośredniej kompetencji. Dodaj niewielką udokumentowaną korektę trudności ograniczoną tak, by nie zmieniała temperamentu. Progi wymagają symulacji i testów rozgrywki; nie stanowią potwierdzonego balansu.

## 8. Tury bossów sterowane przez GM

### Tożsamość i odpowiedzialność

Dodaj jawną tożsamość bossa dla każdej jednostki w danych starcia. Nie zmieniaj automatycznie najsilniejszego członka każdej grupy w bossa GM. Proponowane rangi: ordinary, elite, boss; elite pozostaje sterowany przez silnik, dopóki nie zostanie jawnie oznaczony jako boss. Istniejąca klasyfikacja muzyki całego starcia może pozostać oddzielna.

GM wybiera legalną akcję dla bossa na podstawie ustalonej osobowości, zamiaru starcia, bieżącej planszy, umiejętności/zasobów/przedmiotów drużyny i obsługiwanych mechanik. Szersza wiedza umożliwia przewidywanie, nie znajomość niezatwierdzonego wyboru gracza; sekcja 16 określa kontrakt informacji i przerwań. Silnik odpowiada za zasięg, ruch, zasoby, rzuty, obrażenia, stany i budżety tur. Zwykli pomocnicy pozostają sterowani przez silnik, także przy obecności bossa.

Zalecana konfiguracja: przy wydaniu pełnej funkcji włącz nowy system taktyki dla nowych gier i zaoferuj jasno wyjaśnione ustawienie "GM directs bosses" korzystające ze skonfigurowanego połączenia GM. Wyjaśnij, że tury bossa mogą czekać na odpowiedź modelu i zużywać zwykłe środki użytkownika u dostawcy. Istniejące gry zachowują zachowanie do świadomego włączenia; utrwal wybór przy rozpoczęciu starcia. Opcja tylko silnika/offline używa tych samych profili dla bossów. Nie dodawaj dla niej osobnej wartości stylu walki i nie zmieniaj kontrolera po cichu w połowie walki.

### Orkiestracja tur

Wywołania dostawców pozostaw w serwisie orkiestracji serwera, poza czystym wspólnym silnikiem:

1. Przyjmij akcję gracza z tożsamością starcia, identyfikatorem akcji i oczekiwaną rewizją. Zweryfikuj względem zaakceptowanego stanu walki.
2. Przejdź do następnej zwykłej akcji lub decyzji przerwania w istniejącej kolejności. Oddziel deklarację od rozstrzygania efektu, aby reakcja mogła przerwać oczekujące zaklęcie; nie rozstrzygaj całej rundy, by potem ją przepisać.
3. Zapisz oczekującą aktywację/okno: ID jednostki, rewizję, kursor tury, akcję wyzwalającą/oczekującą, wersję polityki i ograniczone menu legalnych kandydatów.
4. Poproś połączenie GM o strukturalny identyfikator kandydata lub pominięcie. Dołącz bieżącą migawkę kart drużyny, zamiar bossa, obsługiwane mechaniki i tylko informacje o akcji właściwe dla okna, zgodnie z sekcją 16. Krótka opcjonalna narracja nie może zmienić stanu.
5. Zweryfikuj odpowiedź, bieżącą rewizję, jednostkę, przynależność kandydata do menu i aktualną legalność. Atomowo zapisz decyzję i zastosuj akcję raz.
6. Wznów zawieszoną akcję/aktywację z aktualnego stanu, potem pozostałych uczestników. Po przerwaniach sprawdź ponownie legalność; aktualizuj każdy budżet/efekt dokładnie raz na granicy wskazanej przez zasady, a następnie oddaj sterowanie graczowi.

Identyfikatory kandydatów powinny wskazywać w pełni określone akcje wygenerowane przez silnik, nie dowolne współrzędne z modelu. Duża plansza może tworzyć wielu niemal identycznych kandydatów. Zbuduj deterministyczne ograniczone menu zachowujące przydatne rodziny akcji: ruchy charakterystyczne, cele ataku, wsparcie, obronę i ruch. Około 8–16 zróżnicowanych kandydatów to początkowy cel pomiarów. Nie odcinaj wszystkich alternatyw jednym ogólnym profilem, zanim zobaczy je GM.

### Opóźnienia, awarie i powtarzane żądania

Początkowy limit to jedno wywołanie dostawcy na odrębne okno decyzji bossa; bez wywołań dla zwykłych pomocników, samych kliknięć wyboru lub okien bez przydatnego legalnego wyboru. Zwykłe tury, przewidywanie, legendarne akcje po turze i wyzwolone reakcje mogą tworzyć różne okna, więc ogranicz łączne opóźnienie aktywacji/fazy przy wielu bossach. Zacznij od konfigurowalnego miękkiego celu około pięciu sekund i twardego limitu około dziesięciu sekund na wywołanie, następnie dostosuj do faktycznie obsługiwanych dostawców. To cele projektowe, nie zmierzone gwarancje odpowiedzi. Po wyczerpaniu łącznego budżetu zapisz deterministyczny wariant zastępczy lub pominięcie zamiast nieograniczonych wywołań.

Przekroczenie czasu, niedostępny dostawca, błędny wynik lub nieprawidłowy kandydat powinny uruchamiać tę samą zapisaną deterministyczną politykę zastępczą. Zapisz ją jako decyzję; spóźniona odpowiedź modelu nie może jej zastąpić ani dodać tury. Zachowaj responsywny UI, pokaż prosty stan namysłu bossa i pozwól anulować do zaakceptowanego wariantu zastępczego bez restartu całego starcia.

Ponowienia tego samego ID akcji zwracają zapisany wynik. Odświeżona karta dołącza do oczekującej decyzji. Równoległe karty nie mogą przesunąć tego samego bossa dwukrotnie. Zmiana czatu nie może przypisać odpowiedzi innemu starciu. Cofnięcie/rozgałęzienie punktu kontrolnego tworzy lub odtwarza spójną tożsamość walki i historię decyzji; nie powtarzaj wywołań zewnętrznych tylko z powodu restartu animacji.

**Warunek zapisu:** obecne żądania taktyczne przyjmują stan klienta i zwracają nową migawkę; nie ma autorytatywnego rejestru tur na serwerze. Classic również przyjmuje pełnych uczestników/mechaniki z klienta bez porównania z autorytatywną zapisaną rundą. Sam ID kandydata zapisany w przeglądarce nie rozwiązuje ponowień i współbieżności. Przed wydaniem zewnętrznych decyzji bossów w obu trybach dodaj minimalny magazyn rewizji/decyzji walki należący do serwera, wykorzystując właściwe istniejące kolejki zapisu. O dopuszczeniu wywołania modelu muszą decydować ustawienia starcia serwera i zaakceptowana tożsamość bossa; flaga klienta nie może go włączać. Przed uznaniem `game_engine_state` za właściwy magazyn sprawdź przestrzenie nazw gier turowych/Experience. To ograniczona zmiana stanu walki, nie powód przebudowy całego przechowywania gier.

### Mechaniki bossów i czytelność

Przekształcaj w operacje strukturalne tylko obsługiwane generowane mechaniki. Nadaj jednorazowym przejściom faz stabilne ID i zapisany stan wyzwolenia. Rozróżniaj zwykłą akcję, przejście fazy i jawnie obsługiwaną dodatkową akcję; barwny opis bossa nie uprawnia do darmowych obrażeń.

Zapowiadaj duże ataki w UI/dzienniku przed rozstrzygnięciem, gdy mechanika wymaga ostrzeżenia. GM może improwizować opis wokół zaakceptowanych zdarzeń, ale musi opisywać rzeczywiste wyniki. Poznana osobowość bossa i charakterystyczne zdolności powinny pozostawać rozpoznawalne w powtórkach mimo różnic legalnych wyborów.

Jeśli sterowanie GM jest wyłączone lub niedostępne, pokaż użycie wariantu silnika zamiast twierdzić, że decyzję podjął GM. Odtwarzalność z GM oznacza odtwarzanie zapisanych wyborów i rzutów, nie oczekiwanie identycznych nowych odpowiedzi modelu z tego samego ziarna.

## 9. Kontrakt danych i integracji

Preferuj jeden mały wspólny obiekt metadanych przenoszony przez istniejący przepływ walki. Przykładowy kształt wynikowy:

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

Minimalna kategoria rozróżnia wymagane reguły, nie udając pełnej taksonomii stworzeń 5e. Zachowaj bogatszą kategorię kanoniczną, jeśli pojawi się gdzie indziej. Jawną rangę starcia zapisuj oddzielnie, aby osobowość nie kodowała tożsamości bossa. Kontroler wynika z rangi i utrwalonego ustawienia sterowania bossem w starciu; unikaj dwóch niezależnie edytowalnych źródeł prawdy.

Wskazówki przypisania schematu i wynikowe dane wykonawcze to różne kontrakty. Schemat może zawierać ograniczone wskazówki roli/wyszkolenia/osobowości i stabilne odwołanie do NPC. Silnik rozstrzyga je raz w zapisany profil. Pochodzenie przypisania zapisuj raz przy starciu, a małą pamięć decyzji tylko dla polityk, które jej potrzebują. Nie duplikuj surowych opisów osobowości na każdej jednostce w każdej turze.

Classic potrzebuje dodatkowo propagacji profilu przez `sanitizeCombatantForRound`, schemat żądania rundy i `CombatantStats`. Obecna migawka celowo pomija stan rundy/inicjatywy/kolejki akcji, więc sam temperament nie zapewni wznawialnych tur GM, rzeczywistych odnowień ani deterministycznego odtworzenia. Zapisuj wymagany przez te funkcje autorytatywny stan rundy/aktywacji; animacje mają odtwarzać zaakceptowane wyniki, nie powodować kolejnego rozstrzygnięcia.

Prześledź całą granicę:

```text
known NPC/card data + scene
  -> encounter prompt/schema and generated blueprint
  -> accepted assignment inputs and explicit boss identity
  -> generatedEnemyToCombatant / fallback encounter construction
  -> Classic request OR Tactical start request
  -> resolved units + pinned AI version + encounter identity
  -> action resolution / optional server boss decision
  -> snapshot, checkpoint/branch restore, import/export, post-combat summary
```

Sprawdzaj wartości wyliczeniowe i ograniczenia na każdej granicy zewnętrznej. `.passthrough()` nie waliduje nowych pól AI. Zachowuj brakujące pola starych zapisów; odrzucaj błędne jawne wartości użytecznym błędem zamiast cichej zmiany temperamentu. Nowa wersja polityki nie może przypadkowo reinterpretować starej migawki.

Dla starych trwających starć domyślnie zachowaj starą politykę i stosuj nowy system do nowych walk. Starych migawek bez taksonomii nie da się wiarygodnie sklasyfikować wstecz; nie udawaj sprawdzenia obowiązkowej reguły typu. Nowo rozpoznany Beast/Monstrosity wchodzący do nowej polityki musi otrzymać Mindless.

Liczy się każda ścieżka tworzenia wroga: generowane starcia, walka ręczna/zastępcza, odtworzone zapisy i przyszłe przywołania. Nie dodawaj pól wyłącznie do interfejsu TypeScript, by potem zgubić je przy jawnym kopiowaniu właściwości.

## 10. Sprawdzanie frajdy, realizmu i różnorodności

**Frajda:** wrogowie powinni mieć nawyki rozpoznawalne i możliwe do wykorzystania. Wygrana przez oddzielenie strażnika Protective od uzdrowiciela Supportive daje więcej satysfakcji niż wygrana dzięki losowemu złemu ruchowi uniwersalnego oceniania. Nie zmieniaj wszystkich wrogów w idealne maszyny skupiające ogień.

**Realizm:** używaj wiarygodnych celów, ograniczonej wiedzy i kompetencji właściwej wrogowi. Tchórzostwo, lojalność, agresja i wyszkolenie to różne cechy. Mindless to zamówione uproszczenie dwóch kategorii stworzeń. Przyszłe systemy morale/celów mogą dodać poddanie, obronę terytorium i ucieczkę bez udawania, że już istnieją.

**Różnorodność:** zmieniaj profile i skład starć między ziarnami, zachowując tożsamość w walce i dla powracających NPC. Teren, kombinacje ról, zasoby wrogów i cele powinny dawać więcej różnic niż inny rzut krytyczny. Trudność ma przewidywalnie zmieniać wyzwanie, nie sprawiać, że Mindless Beast nagle poluje na uzdrowicieli.

Przykładowe starcie na tej samej mapie:

- Reckless Bruiser opuszcza bezpieczne pole, by naciskać osiągalną jednostkę przedniej linii.
- Protective Bulwark zostaje przy magu Supportive zamiast dołączyć do szarży.
- Cautious Marksman utrzymuje linię ostrzału i unika odsłoniętej pozycji.
- Mindless Beast wybiera krótszą drogę przez las do najbliższego osiągalnego członka drużyny, ignorując dalszego rannego maga.
- Nazwany humanoidalny boss otrzymuje turę GM, by wybrać legalną presję charakterystyczną lub ochronę drogi odwrotu. Pomocnicy nadal używają własnych profili.

Inne ziarno może dać Cowardly Bruiser i Opportunistic Marksman, zmieniając przebieg. Odświeżenie nie może tego zrobić. Późniejsze pojawienie się tego samego nazwanego bossa powinno zachować jego nawyki, chyba że zmieni je fabuła lub jawna edycja.

## 11. Sugerowane etapy implementacji

To duża funkcja: zmienia trwałe kontrakty, prompty, decyzje wrogów i orkiestrację asynchroniczną. Uzgodnij projekt, potem wdrażaj małe etapy możliwe do przeglądu względem bieżącego staging.

| Etap                                  | Rezultat                                                                                                                    | Dowód ukończenia                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A. Podstawy zdolności i tożsamości | Dowód/naprawa utraty zasobów generowanych wrogów; jawne wskazówki kategorii/rangi/wyszkolenia; zachowanie pól na wszystkich ścieżkach tworzenia  | Generowany mag używa i zużywa rzeczywiste zasoby; tożsamość samotnego bossa przetrwa odtworzenie |
| B. Przypisanie i zapis          | Skłonności ról, wskazówki osobowości, zapisany przymiotnik z ziarnem, wersjonowane zachowanie starszych zapisów                                              | Trendy przypisania, twarde pierwszeństwo typu, stabilność po odświeżeniu/imporcie/punkcie kontrolnym                  |
| C. Zwykli wrogowie Tactical           | Wspólni legalni kandydaci, ścisły pościg Mindless, osiem odrębnych profili, tekst podglądu                                      | Macierz scenariuszy zachowań, zgodność prognoz, dowody mobilne/przeglądarkowe, ograniczony koszt obliczeń           |
| D. Tury bossów GM                       | Granica rewizji/idempotencji serwera, wznawialna faza wroga, zweryfikowana odpowiedź kandydata, zapisany wariant zastępczy, obsługiwane mechaniki | Testy czasu/ponowień/współbieżności/odtworzenia i ręczna walka z bossem przez rzeczywistego dostawcę                        |
| E. Adaptacja Classic                  | Nieprzestrzenna semantyka profili, właściwe pule sojuszników/wsparcia, stan decyzji/rzutów z ziarnem i integracja inicjatywy bossa           | Regresje rund/zasobów Classic i dowód odtwarzania; bez fałszywych deklaracji zachowania siatki        |

Etapy A–C to przydatny pierwszy kamień milowy, lecz **same nie realizują bossów sterowanych przez GM**. W Classic decyzję bossa trzeba zamówić we właściwym miejscu inicjatywy po wcześniejszych akcjach, nie z nieaktualnej planszy początku rundy. Wykorzystuj tabele profili i logikę przypisania bez wtłaczania silników przestrzennych i nieprzestrzennych w jeden wielki mechanizm rozstrzygający.

Późniejsze osobno ograniczone zadania: wspólne LOS/osłony, rzeczywiste celowanie AoE, morale/ucieczka jednostki, cele, więcej przymiotników, koordynacja, AI przywołań, ekonomia akcji konkretnych profili zasad. Zasady stołowe powinny określać legalność; temperament wroga decydować o wykorzystaniu legalnych opcji.

### Mapa źródeł dla implementacji

| Plik / symbol                                                                                                                                                                                                                                    | Znaczenie                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [wspólne typy walki](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot`                                                                                                                                           | Metadane wykonawcze i kontrakt odtwarzania Classic                                              |
| [typy starcia](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState`                                                                                                                                         | Generowany schemat, mechaniki i osobne typy okna starcia                          |
| [trasy starcia](../../packages/server/src/routes/encounter.routes.ts)                                                                                                                                                                         | Prompty/schematy generowania i istniejący kontekst postaci; osobna trasa akcji okna     |
| [prompty GM](../../packages/server/src/services/game/gm-prompts.ts)                                                                                                                                                                              | Obecnie informują GM, że mechanikami walki zajmuje się UI                             |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant`                                                                                                                                            | Gubi opis i pomija MP wroga; jawne odtwarzanie danych oraz ścieżki przywracania/tworzenia        |
| [UI Classic](../../packages/client/src/components/game/GameCombatUI.tsx) i [hooki gry](../../packages/client/src/hooks/use-game.ts)                                                                                                           | Aktywne żądania Classic, runda/animacja i przepływ akcji gracza                   |
| [serwis Classic](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound`                                                                                                                            | Wspólna polityka automatyczna, RNG, mechaniki i inicjatywa                                     |
| [trasy gry](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action`                                                                                                             | Schematy i granica orkiestracji; przesyłanie stanu klienta w obie strony                                |
| [AI Tactical](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase`                                                                                                                                               | Obecna polityka i pętla fazy wszystkich wrogów naraz                                          |
| [silnik Tactical](../../packages/shared/src/features/tactical-combat/engine.ts)                                                                                                                                                                  | Konwersja jednostek, heurystyka bossa, ruch, legalność, rozstrzyganie, prognozy i aktualizacje rund |
| [klasy Tactical](../../packages/shared/src/features/tactical-combat/classes.ts)                                                                                                                                                                | Sześć istniejących klas i wyznaczanie zdolności                                             |
| [typy Tactical](../../packages/shared/src/features/tactical-combat/types.ts), [matematyka](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts)                              | Kontrakty migawek/akcji, prognozy terenu i strumień deterministyczny                      |
| [UI Tactical](../../packages/client/src/components/game/TacticalCombatUI.tsx) i [metadane czatu](../../packages/shared/src/types/chat.ts)                                                                                                       | Zapisana migawka taktyczna, stany zajętości i odzyskiwanie oczekującego bossa                             |
| [istniejące regresje terenu](../../scripts/regressions/hybrid-terrain.regression.ts), [dowód tras](../../scripts/regressions/hybrid-terrain-route.regression.ts), [dowód konfiguracji](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Istniejące wzorce wykonywalnych dowodów do rozszerzania w odpowiednich miejscach                                  |

Przed implementacją przeszukaj issues, otwarte/szkicowe PR-y, powiązane gałęzie i elementy projektu, by nie dublować pracy. Wcześniejszy plan walki odwołuje się do zamkniętego/niescalonego PR #4391 jako wcześniejszego rozwiązania; sprawdź ponownie status i właściciela, nie włączaj całego rozszerzenia jako warunku wstępnego. Stosuj aktualne `AGENTS.md`, `CONTRIBUTING.md`, instrukcje pakietów i nakładkę przepływu Chai. Nie wdrażaj wyłącznie na podstawie starych numerów wierszy.

## 12. Plan akceptacji i walidacji

Używaj małych wykonywalnych dowodów `*.regression.ts` w istniejącym runnerze. Nie zachowuj tymczasowych plików `.test.ts`. Asercje powinny wykazywać zachowanie, nie tylko odtwarzać stałe wag.

| Scenariusz                                                                                        | Wymagany wynik                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Beast/Monstrosity ze sprzecznym przymiotnikiem, kompetencją master, znaną osobowością lub rangą bossa | Generowane wskazówki zawsze dają Mindless; sprzeczne autorskie/importowane profile wynikowe są odrzucane użytecznym błędem |
| Najbliższy zdrowy obrońca kontra dalszy ranny mag                                              | Mindless ściga obrońcę; Opportunistic może wybrać maga                                                            |
| Krótka droga przez las kontra dłuższa otwarta                                                     | Mindless wybiera mniej kroków, płaci rzeczywisty koszt i normalnie otrzymuje przypadkowe premie terenu              |
| Ściana wymagająca chwilowego oddalenia; nieosiągalny przeciwnik                                      | Pościg znajduje legalne obejście lub inny osiągalny cel; brak utknięcia przez metrykę Manhattan                                         |
| Latające/teleportujące jednostki Mindless                                                               | Zachowane odrębne reguły przechodzenia/lądowania/zajęcia i zasięgu na turę; bez niemożliwej sekwencji lądowań                       |
| Ranny sojusznik poza bieżącym zasięgiem leczenia                                                      | Supportive może legalnie podejść i leczyć; brak MP/odnowienie blokuje umiejętność                                               |
| Protective bez prowokacji lub przechwycenia                                           | Tylko pozycjonowanie; bez wymyślonego przekierowania obrażeń                                                                          |
| Ranny wróg Cowardly                                                                          | Może się wycofać/bronić; nigdy nie wyzwala globalnej ucieczki drużyny                                                                      |
| Wysoka kompetencja na stałym dużym zestawie ziaren                                                     | Profile pasujące do roli częstsze, rzadkie zgodne pozostają; wyniki danego ziarna stabilne                |
| Znana osobowość, zanegowana cecha, sprzeczne wskazówki, brak/błędne wskazówki, tekst nieangielski  | Ograniczone udokumentowane korekty; bez dowolnego sterowania liczbami ani przypadkowego założenia wyłącznie angielskiego                             |
| Chwilowy brak MP                                                                         | Rola/przymiotnik bez zmian; zmieniają się tylko legalne wybory                                                                |
| Dwóch wrogów celuje w ranną jednostkę, pierwszy ją pokonuje                                             | Drugi ocenia aktualny stan; bez ataku na martwy cel lub podwójnie zarezerwowanego leczenia                                |
| Teren docelowy różny od początkowego                                               | Prognozy kandydatów i faktyczne kontry są zgodne co do pozycji, terenu i zasad                                             |
| GM wymyśla współrzędne, umiejętności, darmowe akcje, ID celów lub nielegalne zasoby                   | Bez mutacji; tylko zapisany legalny wariant zastępczy lub poprawny kandydat                                                                 |
| Timeout GM, potem spóźniony sukces, odświeżenie, duplikat lub równoległe karty            | Dokładnie jedna zaakceptowana akcja bossa i jedno odliczenie zasobów; stara odpowiedź odrzucona                                     |
| Zwycięstwo/porażka drużyny przy zawieszonej fazie wroga                                          | Poprawny wynik końcowy; brak dalszej tury bossa/pomocnika po końcu walki                                                     |
| Punkt kontrolny, rozgałęzienie, import/eksport, stary zapis, powracający NPC                        | Zachowane profile i właściwa tożsamość walki; bez przypadkowych przelosowań i zdublowanych decyzji zewnętrznych             |
| Classic Mindless i boss GM                                                                    | Jawna nieprzestrzenna reguła celu i właściwe miejsce inicjatywy; bez twierdzeń o siatce/terenie                        |

Zmierz koszt decyzji przy obsługiwanych granicach żądania 40 jednostek / 64 na 64, mieszanym ruchu, wielu umiejętnościach i gęstych przeszkodach. Buforuj obliczenia ruchu/zagrożeń dla decyzji, gdy jest to uzasadnione; unieważniaj po zmianie stanu. Ustal mierzalny budżet czasu zwykłej fazy po profilowaniu obecnego silnika na komputerze i reprezentatywnym urządzeniu mobilnym. Nie deklaruj konkretnych milisekund bez pomiaru ani nie dodawaj głębokiego planowania przed profilowaniem.

Implementację zacznij od `pnpm install`; uruchom `pnpm check`, ukierunkowane regresje walki/tras, `pnpm regression:prompt` po zmianach promptów i `pnpm localization:check` dla tekstu UI. Użyj regresji przeglądarkowych dla rzeczywistego przepływu walki, odświeżenia, oczekiwania/awarii bossa, klawiatury, małych ekranów i jasnego/ciemnego motywu. Dodaj właściwe wpisy `[Unreleased]` w changelogu. Przed edycjami klienta przeczytaj `packages/client/.instructions.md`. Loguj prompty/wyniki dostawcy przez istniejące narzędzia debugowania i Pino bez ujawniania niepowiązanych sekretów.

Przed prośbą o przegląd PR uruchom lokalnie CodeRabbit, napraw istotne uwagi i powtórz sprawdzenie. Dokumentuj odrzucenia fałszywych alarmów lub czysto pedantycznych sugestii na podstawie kodu; nie zapętlaj pracy. Pola planu testów PR zostaw niezaznaczone dla człowieka. Publikując ten dokument w PR, dodaj wymagane zadanie `[docs-i18n]` lub odpowiednie aktualizacje tłumaczeń.

### Co sprawdziła pierwotna analiza

Opisy obecnego zachowania wynikają ze śledzenia źródeł aktywnego klienta, tras i rozstrzygania, z osobnymi audytami Classic/Tactical. Przykład prawdopodobieństwa obliczono bezpośrednio. Nie zmieniono kodu AI walki, nie symulowano nowych polityk i nie sprawdzono przepływu bossa w przeglądarce ani u rzeczywistego dostawcy. To wymagania akceptacyjne implementacji, nie dowody dostarczone przez projekt.

## 13. Granica obecnej implementacji zwykłego AI

Wdrożone słownictwo polityki: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical i Coordinated**. Pozostałe przymiotniki poniżej to pomysły, nie ukryte ustawienia wykonawcze.

Wspólny kontrakt `features/combat-ai.ts` oddziela zapisane rolę, przymiotnik, wyszkolenie i ziarno od sterowania. Nowe walki dostają zapisane przypisania; odtworzone bez profilu zachowują poprzednią automatyczną politykę. Zmiana kontrolera towarzysza nie losuje przymiotnika ponownie. Generowane skończone pule MP i jawne rodzaje/koszty umiejętności trafiają do stanu wykonawczego; brak MP wroga daje tę samą tymczasową pulę `20 + 3 × level` co u sojuszników bez statystyk, z zachowaniem jawnego zera. To ogólny wariant zastępczy Engine, nie stołowa reguła zasobów.

Przypisanie v1 jest celowo mniejsze od wzoru z sekcji 5: zgodne profile zaczynają z dodatnią wagą, faworyzowane przez rolę otrzymują premię zależną od wyszkolenia, a opcjonalna wskazówka osobowości z zamkniętego zbioru dodaje ograniczoną preferencję. Pierwszeństwo kategorii wymusza Mindless; jawna wskazówka Mindless wybiera to zachowanie także dla innych kategorii. Istniejące generowanie starcia dostarcza wskazówki niezależnie od języka; sam silnik nie interpretuje prozy osobowości. Inne wskazówki temperamentu są preferencjami, nie gwarancją, a rozumienie negacji i wielojęzycznej charakterystyki przez model nadal wymaga oceny dostawców. Pełne pochodzenie i osobowość powracających NPC powiązana z tożsamością między starciami pozostają dalszą pracą. Zastępczy poziom wywodzony z HP pozostaje słabą miarą wyszkolenia przy braku wskazówki.

Każdy tryb wylicza wykonalne ataki podstawowe, umiejętności i opcje obronne, następnie ocenia obrażenia, dobicia, skuteczne leczenie, wsparcie, koszt i właściwe czynniki taktyczne. Nie dodaje wywołania modelu w zwykłej turze. Profile nigdy nie przyznają niedostępnej zdolności, nieograniczonego MP, dodatkowej aktywacji ani nieistniejącej mechaniki terenu.

- **Classic:** bez oceny przestrzennej. Mindless stosuje stabilną kolejność żywych przeciwników z ziarnem, niezależną od HP. Wsparcie korzysta z właściwej puli sojuszników. Wzmocnienia/osłabienia stosują rzeczywisty nazwany modyfikator obrony zamiast przybliżenia samymi obrażeniami. Nowe profile mają odnowienia po każdym użyciu. Ręczni towarzysze kolejkują atak/umiejętność/obronę na własne miejsca inicjatywy; ekwipunek drużyny i działania narracyjne pozostają przy aktywnym liderze. Inni domyślnie używają AI, zgodnie z dotychczasową interakcją Classic. Polecenia wskazują wykonawcę, także po KO pierwotnego lidera.
- **Tactical:** polityka otrzymuje legalne osiągalne pozycje ataku/wsparcia. Mindless idzie trasą najmniejszej liczby kroków, płacąc rzeczywisty koszt ruchu; lot i teleport zachowują własne ograniczenia przechodzenia/lądowania. Wsparcie może ruszyć się przed rzuceniem zaklęcia. Nowe szacunki kontry używają przyszłej pozycji. Ostrożny szacunek zasięgu na stanie publicznym określa narażenie; nie jest pełnym wyznaczaniem tras następnej tury. Ściana albo góra blokuje widzenie przy każdym ciosie (combat C6).
- **Patient:** preferuje ograniczone utrzymanie obrony zamiast niekorzystnego starcia; Classic czeka na bliskie odnowienie zamiast fikcyjnego ruchu. Nie może utrzymywać pozycji bez końca, gdy istnieje przydatna akcja.
- **Methodical:** preferuje obsługiwane przygotowanie przez redukcję obrony, zachowuje cel i atakuje, gdy status jest przydatny. Bez wymyślonego drzewa kombinacji lub przeszukiwania przyszłych rzutów.
- **Coordinated:** uwzględnia zapisane cele sojuszników i przydatne osłabienia, przeliczając po każdej zaakceptowanej akcji. Brak wszechwiedzącego planera drużyny i rezerwacji niezgłoszonych akcji gracza.
- **Towarzysze:** zlokalizowany wybór Player/AI dla każdego członka podczas walki; aktywny lider pozostaje ręczny. Towarzysze Tactical działają po pozostałych ręcznych poleceniach lub po wybraniu End Turn. Ręczna zmiana pozostaje możliwa, zanim towarzysz zadziała. Kontroler, profile i pamięć są zapisywane wraz z uczestnikami/migawkami taktycznymi.
- **Zapis Classic:** zaakceptowane wyniki rundy i numer następnej trafiają do istniejącego callbacku migawki przed animacją kosmetyczną. Rzeczywiste odnowienia po użyciu przetrwają ten zapis/odczyt. Classic nadal używa dotychczasowych losowych rzutów walki; nie jest to dokładne odtwarzanie rzutów ani idempotentny rejestr akcji serwera. Gwarancje równoległych kart należą do przyszłych prac nad autorytatywnymi bossami.

Pierwszy etap kończył się przed wywołaniami dostawcy dla bossów i reakcjami; sekcja 16 zapisuje ich późniejszą implementację. Pozostałe ograniczenia obejmują ucieczkę jednostki, prowokację, bogatsze cele, inicjatywę poszczególnych zasad, pełną normalizację zasobów kart i rejestr profili powracających NPC. Niewdrożone fragmenty pierwotnej propozycji pozostają pracą akceptacyjną, nie domyślnie wydaną funkcjonalnością. Syntetyczne pomiary komputerowe nie stanowią kalibracji na rzeczywistym urządzeniu mobilnym.

## 14. Więcej przymiotników z zachowaniem zależnym od klasy

Zachowaj jeden widoczny przymiotnik i rolę wynikającą ze zdolności. To różne priorytety, nie synonimy "inteligentny". Dopuszczaj niezwykłe, ale mechanicznie poprawne kombinacje.

| Przymiotnik | Fighter / Knight | Rogue / Archer | Mage / Healer | Różnica i warunek wstępny |
| --- | --- | --- | --- | --- |
| **Frugal** | Zwykły cios przed zużyciem ograniczonej techniki | Oszczędza specjalną amunicję lub silne zdolności na ważne cele | Efektywne zaklęcia; kosztowne leczenie dla dużych braków HP | Oszczędność zasobów także w bezpieczeństwie, inaczej niż Cautious. Wymaga rzeczywistych skończonych kosztów |
| **Relentless** | Utrzymuje presję na wybranym wrogu | Ściga lub stale ostrzeliwuje jeden cel | Kontynuuje obsługiwaną sekwencję obrażeń/kontroli wobec tego samego zagrożenia | Silne trzymanie się celu, nie ryzyko Reckless; wymaga zapisanego celu oraz wyjścia przy niepoprawnym celu/braku postępu |
| **Disruptive** | Używa dostępnego rozbrojenia, przerwania lub obezwładniającego ciosu | Przerywa obsługiwane podtrzymywanie zaklęcia odsłoniętego maga lub nakłada osłabienie | Priorytet dla przydatnego rozproszenia, ciszy, oczyszczenia lub kontroli | Zapobiega istotnym akcjom zamiast maksymalizować obrażenia. Tylko rzeczywiście obsługiwane efekty; bez udawanej ciszy z nazwy |
| **Vengeful** | Odpłaca wrogowi, który zranił jednostkę lub pokonał podopiecznego | Oznacza ostatniego napastnika i szuka legalnej okazji | Przeklina agresora lub chroni jego zamierzoną ofiarę | Uraza wynikająca ze zdarzenia, nie wybór najsłabszego. Wymaga ograniczonej pamięci ostatniego napastnika/pokonania sojusznika |
| **Adaptive** | Zmienia taktykę po zaobserwowanej odporności lub nieudanym starciu | Przestaje powtarzać nieskuteczne ataki | Zmienia żywioł lub plan wsparcia według wyników | Uczy się tylko z publicznych danych. Wymaga ograniczonej historii obserwacji; bez ukrytych tabel odporności |
| **Opportunistic** (już obecny) | Bezpieczne dobicie zamiast dłuższego pojedynku | Wykorzystuje ranny/odsłonięty cel | Używa zaklęcia dla rzeczywistej okazji | Istniejący profil jest bazą; nie dodawaj "Cruel" z tym samym ocenianiem |
| **Resolute** | Kontynuuje rolę mimo niskiego zdrowia | Utrzymuje przydatną pozycję strzału pod presją | Kończy ważne leczenie lub obsługiwane podtrzymywanie | Opanowanie przy niskim HP, nie agresja Reckless; wymaga zamiaru/zaangażowania i awaryjnego unieważniania |
| **Territorial** | Utrzymuje wyznaczoną bramę lub chroniony obiekt | Pilnuje podejścia i kończy pościg poza granicą | Wspiera sojuszników w bronionym obszarze | Rzeczywisty cel/granica pościgu w Tactical. W Classic broń nazwanego celu, nie fikcyjnych współrzędnych |
| **Zealous** | Stawia wskazanego przywódcę lub sprawę ponad własne przetrwanie | Zużywa rzadki silny atak na zagrożenia celu | Poświęca wsparcie/zasoby misji mimo ryzyka osobistego | Wierność celowi, inaczej niż ogólne Supportive; wymaga metadanych celu/rangi |
| **Deceptive** | Obsługiwany zwód lub zmiana postawy | Rzeczywiste ukrycie, wabiki lub zmylenie celu | Obsługiwana iluzja lub przynęta | Mechaniki percepcji/podstępu z czytelnymi kontrami. Sama narracja nic nie robi |
| **Merciful** | Obsługiwane zakończenie bez zabijania | Obezwładnia zamiast zabijać, gdy możliwe jest poddanie | Powściągliwość/kontrola i przyjęcie poddania | Wymaga wyników bez śmierci i zasad poddania; bez atakowania pokonanych lub wymyślonego efektu łaski |
| **Selective** | Przywołuje wytrzymałego obrońcę tylko w potrzebie | Przywołuje pościgową lub dystansową jednostkę dla okazji | Dobiera przywołanie żywiołowe/wsparcia do widocznych zagrożeń | Przyszła polityka puli przywołań, nie kolejna ogólna preferencja obrażeń; wymaga rozliczania przywołań |

Najlepsze następne dodatki po obecnych jedenastu: **Frugal, Relentless, Disruptive i Vengeful**. Frugal i Relentless pasują do istniejących zdolności po małych zmianach stanu. Disruptive potrzebuje faktycznej semantyki obezwładniania/rozpraszania; Vengeful pamięci zdarzeń walki. Adaptive i Territorial dają dużą różnorodność, ale mają większe wymagania. Resolute i Zealous traktuj jako kandydatów do sprawdzenia nakładania się zachowań przed rozszerzeniem publicznego słownictwa.

Trzy zamówione dodatki również różnią się zależnie od klasy:

| Przymiotnik | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Broni się, czekając na lepszą wymianę; w Tactical utrzymuje wartościowe podejście | Czeka na legalny przydatny zasięg zamiast wymuszać słaby strzał | Zachowuje turę dla prawie gotowego zaklęcia lub unika zmarnowanego leczenia; nigdy nie czeka na nieistniejącą regenerację many |
| Methodical | Stosuje rzeczywistą technikę osłabienia, potem atakuje tego wroga | Przygotowuje obsługiwaną podatność przed silnym atakiem | Osłabia przed zadaniem obrażeń lub przygotowuje obsługiwaną sekwencję obronną; nie nakłada ponownie przydatnych aktywnych efektów |
| Coordinated | Naciska bieżący cel sojusznika lub zapewnia przydatne przygotowanie | Dobija cel już zagrożony przez drużynę | Zapewnia niepowielone wsparcie lub osłabienie do wykorzystania przez sojuszników; przelicza po każdej akcji |

Te opisy są celami strojenia. Pierwsza implementacja używa ogólnego obsługiwanego modelu wzmocnienia/osłabienia obrony; bogatsze kombinacje zależne od klasy wymagają właściwych zdolności i scenariuszy regresyjnych.

## 15. Rozszerzenie projektu Summoning

Zacznij bez siatki. Przywołanie to rzeczywisty uczestnik walki ze stabilnym ID starcia, odwołaniem do właściciela, stroną, profilem, kontrolerem, czasem trwania, kosztem zasobów i jawnym budżetem aktywacji. Klasa zmienia legalny zestaw zdolności; przymiotnik zmienia priorytety jak w Classic.

Rozdziel **wybór przywołania** przywołującego od **polityki walki** przywołanej jednostki. Przywołujący Patient może zachować miejsce na późniejsze zagrożenie; przywołany Knight Protective osłania obsługiwanymi akcjami; Mage Methodical przygotowuje osłabienie; uzdrowiciel Coordinated unika powielania leczenia. Przywołania Beast/Monstrosity pozostają Mindless zgodnie z obecną regułą projektu, także po stronie sojuszniczej.

Zestaw zasad określa, czy polecenia zużywają akcję właściciela, czy przywołanie działa natychmiast lub w następnej rundzie, czy dzieli inicjatywę i co robi bez polecenia. Zalecane ogólne ustawienie: przywołanie zużywa zwykłą akcję właściciela, nowa jednostka aktywuje się po raz pierwszy w następnej rundzie i używa AI silnika, chyba że jest jawnie sterowalna. Odwołanie i ponowne przywołanie tej samej jednostki nie może przyznawać świeżej zwykłej tury. Przed zdolnościami rojów wymuś limit liczebności i stabilne rozliczanie jednej aktywacji na rundę.

KO właściciela, urok/zmiana strony, odwołanie, wygaśnięcie czasu, porażka drużyny i koniec starcia wymagają jawnych reguł sprzątania. Zachowuj właściciela i pozostały czas po odświeżeniu/imporcie. Pokonane przywołanie nie jest przedmiotem ani stałym członkiem drużyny. Koszt zaklęcia/MP odejmuj raz przy zaakceptowanym utworzeniu. Akcje przywołań nie mogą tworzyć okien legendarnych poza regułami uprawnienia utrwalonego modyfikatora bossa.

## 16. Bossowie GM, legendarne akcje i reakcje

### Wdrożony ogólny adapter Engine

Nowe gry tworzone kreatorem mają włączoną walkę prowadzoną przez serwer. **GM directs bosses** (GM steruje bossami) kontroluje użycie dostawcy; zwykli przeciwnicy i towarzysze AI nadal działają lokalnie. Istniejące gry bez `combatDirector` pozostają przy starym rozstrzyganiu. Konfiguracja starcia utrwala przełącznik GM, trudność, ziarno, teren i zdolności, więc zmiana ustawień podczas walki nie przepisuje zaakceptowanych zasad. Generator musi jawnie nadać `boss`; wysokie HP lub wizualna etykieta bossa nie przyznaje dodatkowych akcji. Samotny boss jest obsługiwany.

`combat-director.routes.ts` zapisuje wersjonowaną migawkę należącą do serwera w istniejącym magazynie stanu silnika gry pod `experience:marinara-engine.combat`, zakotwiczoną w wiadomości rozpoczynającej starcie. Migawka zawiera kursor inicjatywy, stos oczekujących efektów, dostępne wybory, budżety reakcji/legendarnych akcji, zasoby, zaakceptowane ID żądań i ostatnie zdarzenia. Polecenia przenoszą ID starcia, ID instancji magazynu i rewizję; duplikaty lub stare zgłoszenia zwracają zaakceptowany stan. Zużycie ekwipunku i zapis walki mają wspólną transakcję. Odpowiedzi dostawcy są też sprawdzane względem tożsamości zapisanego wiersza, rewizji i okna, więc spóźniona odpowiedź nie przekroczy wariantu zastępczego, odtworzenia punktu kontrolnego ani rozgałęzienia.

- **Classic:** pojedyncze miejsca inicjatywy zatrzymują się teraz na decyzji ręcznej postaci lub bossa. Reżyser walki rozstrzyga jednego wykonawcę naraz, potem jednokrotnie wykonuje istniejące mechaniki/statusy końca rundy. Stare gry zachowują pierwotne sterowanie zakolejkowaną rundą.
- **Tactical:** oglądanie/wybieranie żetonu jest darmowe. **Begin [name]'s turn** (rozpocznij turę wskazanej postaci) zatwierdza aktywację i otwiera możliwość przewidywania. Sam ruch nie daje kolejnej aktywacji ani okna legendarnego. Towarzysze AI i wrogowie zachowują strukturę faz. Zaakceptowane opisy terenu, ziarna starć i rozmiar konfiguracji pozostają autorytatywne. Nowe starcia ignorują przestarzałe preferencje ziarna kampanii.
- **Bossowie:** początkowy autorski budżet to zwykle trzy punkty legendarne; każda oferowana dodatkowa akcja ma dodatni koszt. Punkty odnawiają się przy zwykłej aktywacji bossa. Przewidywanie i okazje po turze dzielą pulę; dodatkowe akcje i reakcje nigdy nie tworzą własnego łańcucha legendarnego. Generator określa legalne koszty ataku/obrony/ruchu i umiejętności. Boss Mindless przestrzega ograniczeń pościgu; pojedyncza legalna akcja wykonuje się lokalnie.
- **Dostawca:** używaj skonfigurowanego połączenia narzędzia GM, zastępczo połączenia czatu. Dostarczaj bieżące umiejętności, zasoby, liczby przedmiotów, stany, profile, pozycje i zaakceptowane zdarzenia drużyny/przeciwników. Nie wysyłaj prywatnych oczekujących poleceń, stanu RNG ani wpisywanych/wskazywanych kursorem wyborów. GM zwraca jeden legalny ID kandydata, nigdy przepisany stan. Logowanie promptów/wyników używa istniejących narzędzi hosta. Decyzja ma limit dziesięciu sekund; obecny łączny limit to dwanaście wywołań na rundę. Zwykły wariant zastępczy używa lokalnego AI; opcjonalne okna legendarne są pomijane. UI oznacza zdarzenia zastępcze i oferuje lokalny wariant podczas oczekiwania na GM. To stałe limity początkowe, nie konfigurowalne gwarancje opóźnienia.
- **Reakcje:** jawnie oznaczone umiejętności `counterspell` i `guard` mają okna wyzwalane. Ręczne postacie dostają wybór zdolności/celu/kosztu i **Pass** (pomiń); lokalne AI ocenia zagrożenie i niedobór zasobów, a bossowie GM wybierają przez ten sam kontrakt dostawcy. Jednostka ma jedną reakcję odnawianą przy aktywacji; jawne odnowienia nadal obowiązują. Kontrzaklęcia mogą same być zaklęciami i podlegać skontrowaniu. Stabilna kolejność jednostek i zapisany stos rodziców ograniczają rozstrzyganie do limitu czterdziestu jednostek. Pominięcie niczego nie zużywa.
- **Koszty:** zarezerwuj/zużyj MP zadeklarowanej umiejętności lub jeden slot zaklęcia dokładnego poziomu przed reakcjami, bez ponownego naliczenia przy rozstrzyganiu. Ogólny adapter zużywa koszt także po niepowodzeniu zaklęcia lub Counterspell. Reakcja zużywa też swój przydział; legendarne umiejętności płacą zarówno autorski koszt zdolności, jak i punkty legendarne. Sloty to opcjonalne jawne dane zdolności, nie wniosek z klasy lub nazwy. Nie wdrożono rzucania na wyższym poziomie ani zwrotów właściwych edycji.
- **Efekty ogólne:** Counterspell ma szansę z ziarnem `clamp(65% + 3% × level difference, 20%, 95%)`; anuluje tylko oczekujące efekty. Guard tymczasowo nakłada istniejącą redukcję obrażeń podczas obrony na jednego zagrożonego sojusznika na ten atak. Reakcje Tactical sprawdzają autorski zasięg i wspólną linię widzenia (combat C6), tak samo jak zwykłe ataki. Jawne `areaRadius` i `friendlyFire` włączają obszary ataku Tactical, a Classic `targetScope: all-enemies` stosuje jedno opłacone zaklęcie do przeciwnej grupy. To celowo ogólne zasady, nie Counterspell z którejkolwiek edycji 5e.
- **Sterowanie:** istniejące ekrany walki pokazują autorytatywny zaakceptowany stan, budżety reakcji/legendarnych akcji i skupiony panel wyboru dostępny z klawiatury. Ekwipunek Tactical oferuje faktycznie obsługiwane przedmioty zamiast starej nieograniczonej mikstury zastępczej. Odświeżenie odtwarza oczekującą decyzję. Naprawa resetowania przed odtworzeniem zachowuje kotwicę starcia i mechaniki, także przy powtórnym montowaniu React w trybie developerskim. Podsumowanie walki zawiera sumy zasobów.

**Obecne ograniczenia:** reżyser nie oferuje starego dowolnego manewru **Special** ani restartu walki w miejscu, bo nie mają jeszcze autorytatywnego kontraktu akcji/cofania; stare walki zachowują te kontrolki. Do odtwarzania używaj istniejących kontrolek fabuły/punktów kontrolnych. Menu GM ma limit szesnastu zwykłych/legendarnych wyborów; oferuje tylko mały zbiór pozycji przemieszczenia. Guard redukuje obrażenia, nie jest ruchem/przechwyceniem ani atakiem okazyjnym. Dotychczasowa kontra Tactical pozostaje własną automatyczną wymianą, nie reakcją zaklęcia. Classic zachowuje obecne losowe kości i zakres mechanik skryptowych; Tactical nie zyskuje skryptowych mechanik Classic. Brak pełnego adaptera stołowego, wskrzeszenia, własności przywołań, ogólnej koncentracji, rzucania na wyższym poziomie lub rejestru powracających NPC. Pełna normalizacja kart i trwałe zasoby między starciami nadal należą do pracy nad zasadami. Jakość dostawców i tempo na rzeczywistych urządzeniach wymagają testów rozgrywki.

### Zaakceptowane wymagania projektu

**Zaakceptowano:** autorscy bossowie powinni mieć legendarne akcje niezależnie od zasad 5e. GM zna bojowe zdolności/zasoby drużyny i może działać na podstawie wiarygodnego przewidywania przed zwykłą akcją. Jednostki AI oceniają opcjonalne reakcje i mogą odmówić, by oszczędzić zasoby. Istnieje teraz ich pierwsza ogólna implementacja Engine, oddzielna od polityki zwykłych tur.

### Wiedza GM i przewidywanie

Daj GM migawkę związaną z rewizją: umiejętności/zaklęcia członków drużyny, legalne zasięgi i obsługiwane kształty obszarów, bieżące/maksymalne HP i MP/punkty zaklęć, sloty według poziomu, odnowienia, stany, wyposażenie, liczby użytecznych przedmiotów i pozostałe użycia. Dołącz własność/dostęp do wspólnego ekwipunku, bieżące pozycje tam, gdzie dotyczą, przywołania, ostatnie zaakceptowane akcje i jednostkę rozpoczynającą aktywację. Brak danych oznacza niewiedzę, nie zero ani nieskończoność. Pobieraj je z zaakceptowanych kart i ekwipunku, nie wymyślonego podsumowania modelu. Odczyt przedmiotów drużyny nie daje bossowi prawa używania ani usuwania ich.

GM może wykorzystać szerszą wiedzę o starciu do przewidywania zagrożeń, zachowując zachowanie właściwe osobowości i wyszkoleniu bossa. Zwykłe lokalne AI zachowuje swoją granicę informacji. Żadne nie dostaje przyszłego RNG, prywatnych szkiców, wskazywanych kursorem umiejętności/celów ani zakolejkowanych poleceń innych jednostek przed ich deklaracją. Rzeczywiście zadeklarowane zaklęcie ujawnia tylko dozwolone szczegóły wyzwalacza; znajomość listy zaklęć nie dowodzi, które zostanie wybrane. Serwer może sprawdzać pełny stan, filtrując kontekst decyzji kontrolera.

**Przykład Fireball:** wybrany mag ma Fireball, dość zasobów i legalny wybuch zagrażający bossowi bez trafienia sojuszników maga. GM może przewidzieć wysokie prawdopodobieństwo Fireball i wydać punkt legendarny na legalne przemieszczenie, osłonę lub presję. Może się pomylić; musi też uwzględnić, dlaczego zaklęcie pojedynczego celu lub inna akcja mogłyby być lepsze. Nie może wymyślić uniku, ciszy ani darmowego ruchu. Używaj rzeczywistych reguł AoE, przyjaznego ognia i widoczności silnika; pierwotne przybliżenie pojedynczego celu nie pozwalało na taką prognozę przestrzenną. Reżyser obsługuje teraz jawnie opracowane obszary ataku. W Classic/Summoning używaj rzeczywistych nieprzestrzennych grup celów i zagrożeń zamiast fikcyjnego zasięgu siatki.

### Trzy odrębne okna czasowe

Wzorzec: [zasady legendarnych akcji z 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) umieszczają je po turze innego stworzenia i odnawiają budżet w turze bossa. Uprzedzenie nowo wybranego maga **przed** jego akcją to świadome rozszerzenie Marinara, nie standardowy czas 5e. Zachowaj je niezależnie od zasad przez jawny modyfikator bossa utrwalony przy starciu; wierny profil 5e używa natywnego czasu, chyba że ta reguła domowa jest włączona. Nie mieszaj tego po cichu z [zasadami potworów z 2024](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Okno | Wyzwalacz i dostępne informacje | Budżet i kontynuacja |
| --- | --- | --- |
| Wyprzedzająca legendarna akcja | Zaczyna się aktywacja innej jednostki; GM widzi wykonawcę, karty i obecny stan, nie niezatwierdzoną akcję | Wydaj z istniejącej puli legendarnej, potem pozwól wykonawcy wybrać/zweryfikować akcję |
| Wyzwolona reakcja | Zachodzi obsługiwane zdarzenie, np. początek rzucania zaklęcia; ujawnij tylko dozwolone dane wyzwalacza | Zużyj przydział reakcji i koszt MP/slotu/użycia, potem zgodnie z zasadą wznów lub anuluj oczekującą akcję |
| Legendarna akcja po turze | Inna jednostka kończy zwykłą aktywację | Wydaj z tej samej puli legendarnej, potem przejdź do następnej zwykłej aktywacji |

W Tactical odróżniaj oglądanie/wybieranie jednostki od **rozpoczęcia jej aktywacji**. Pierwszy zatwierdzony wybór do działania może otworzyć okno przewidywania przed ruchem/akcją, raz na aktywację wykonawcy. Po akceptacji zmiana zaznaczenia, anulowanie menu, odświeżenie lub zmiana metody wejścia nie może go otworzyć ponownie ani przełączyć wykonawcy dla wymuszania decyzji. Sam podgląd pozostaje darmowy. Pokaż zobowiązanie wyraźnie; po przerwaniu jednostka nadal ma zwykłą akcję, chyba że rzeczywisty efekt obezwładniający ją uniemożliwia. Krótkie wyjaśnienie jest lepsze niż atak bossa po każdym kliknięciu.

Classic obecnie zbiera polecenia przed rozstrzygnięciem całej rundy inicjatywy. Wybór przy wpisywaniu polecenia nie jest faktyczną aktywacją jednostki. Przyszłe rozstrzyganie musi zatrzymać się na jej miejscu inicjatywy, ujawnić aktywnego wykonawcę bez zakolejkowanego polecenia, rozstrzygnąć przewidywanie, potem sprawdzić/przetworzyć deklarację polecenia. Jeśli przerwanie czyni wybór nielegalnym, poproś o nowy ręczny wybór (lub przelicz AI), zanim zacznie się rzucanie. Nie wywołuj GM przy każdym wyborze menu i nie wykonuj przedwcześnie późniejszego miejsca inicjatywy. Ten sam cykl stosuj do towarzyszy AI i przyszłych przywołań.

Proponowane ogólne ustawienia modyfikatora:

- Opracuj jawną tożsamość bossa i małe legalne menu legendarne; nie wnioskuj uprawnień GM z najwyższego HP.
- Zacznij od widocznego budżetu 3 punktów, akcji kosztujących 1–3 i odnowienia na początku zwykłej aktywacji bossa. Utrwal początkowy budżet i politykę zaskoczenia/obezwładnienia przy starcie. To proponowane strojenie Marinara, nie wymóg kopiowania opublikowanego potwora.
- Dopuść najwyżej jeden wybór wyprzedzający i jeden po turze na bossa na kwalifikującą się aktywację innej jednostki, z tej samej skończonej puli. Pozwala to na żądane przewidywanie bez dodatkowych punktów. Pominięcie też zamyka okno. Rozstrzygnij poprzednie okno po turze przed początkiem następnej aktywacji.
- W Tactical okno po turze następuje po ruchu z akcją lub Wait, nie po kliknięciu ruchu, każdym ciosie, kontrze, klatce animacji lub całej fazie gracza. W Classic po rozstrzygniętym miejscu inicjatywy. End Turn zamyka każdą kwalifikującą się pominiętą aktywację najwyżej raz; przywołania stosują utrwalone reguły uprawnienia.
- Oferuj `pass` i tylko legalnych kandydatów w budżecie. Żadna legendarna akcja nie otwiera kolejnego okna legendarnego ani nie podwaja szybkości. Zaklęcie legendarne może wyzwolić Counterspell tylko przy obsłudze takiej reakcji przez wybrany adapter; budżety pozostają oddzielne.
- Przed żądaniem i przed akceptacją sprawdź, czy boss żyje/może działać, legalność celu i wynik walki. Pokonany boss nie może wydać spóźnionej odpowiedzi. Ograniczenia kategorii Mindless nadal dotyczą celowania/pościgu, także opcji legendarnych.
- Rozróżniaj zwykłą akcję, reakcję, legendarną akcję i zdarzenie legowiska/fazy. To różne budżety/wyzwalacze; opis nie może tworzyć nowych obrażeń lub darmowych aktywacji.
- Zwykli pomocnicy pozostają lokalnym AI. Wywołania GM dotyczą tylko okien bossa z istotnym wyborem. Wykorzystaj skonfigurowane połączenie GM, logowanie debugowania, zapisany wariant zastępczy i łączny limit opóźnienia z sekcji 8.

### Counterspell i inne opcjonalne reakcje

**Oceniaj automatycznie, wydawaj wybiórczo.** Posiadanie Counterspell nie oznacza rzucania go przeciw każdemu zaklęciu. Wyzwalacz otwiera wybór uprawnionych reakcji i `pass`. Towarzysze AI i zwykli wrogowie wybierają lokalnie według zdolności, przymiotnika, wyszkolenia, obecnych rezerw i wartości zatrzymania konkretnego efektu. Bossowie GM używają kontrolera GM w tym samym legalnym oknie. Jednostki gracza otrzymują wybór React/Pass z kosztem; nie zużywaj po cichu rzadkich slotów tylko dlatego, że mają zdolność. Obowiązkowe efekty pasywne stosują własne reguły, bez udawania dobrowolnych reakcji.

Oceniaj oczekiwane zapobieżenie obrażeniom/kontroli, unikniętą porażkę sojusznika, udaremnione cenne leczenie/przygotowanie wroga, szansę sukcesu oraz koszt utraconej okazji zasobu i reakcji przed odnowieniem. Counterspell może celować w leczenie lub zaklęcie użytkowe, jeśli pozwalają zasady, nie tylko w ataki. Nie sprawdzaj przyszłych rzutów ani nadal prywatnych wyborów. Kosztowna reakcja na nieszkodliwe zaklęcie może przegrać z pominięciem; ostatni slot może być wart wydania dla uratowania drużyny. Preferencje rezerw są miękkimi priorytetami, chyba że gracz jawnie ustali twardy limit.

| Styl / zdolności | Przykładowy priorytet reakcji |
| --- | --- |
| Protective Knight lub Mage | Przechwyć cios zagrażający sojusznikowi lub skontruj śmiertelne zaklęcie, tylko z odpowiednią realną zdolnością |
| Cautious lub Patient Mage | Pomiń słabe zaklęcie, zachowując reakcję i rzadkie zasoby na poważne zagrożenie |
| Methodical Mage | Udaremnij obsługiwane oczyszczenie, leczenie lub kontrolę, które zniszczyłyby ustalony plan |
| Mag wsparcia Coordinated | Przelicz po reakcji innego sojusznika; nie kontruj już zanegowanego zaklęcia i nie rezerwuj reakcji dwukrotnie |
| Mag Reckless | Wydawaj chętniej dla presji ofensywnej; nadal nie rzucaj po wyczerpaniu zasobów/budżetu reakcji |
| Mag Frugal (propozycja) | Preferuj tańszą wystarczającą odpowiedź lub pominięcie; porównuj ostatni slot z przyszłą potrzebą leczenia/obrażeń |

Używaj ID zdolności i jawnych metadanych wyzwalacza/efektu, nigdy przetłumaczonego słowa "Counterspell". Każda reakcja potrzebuje wyzwalacza, czasu, wymagań celu/widoczności, kosztu zasobów, kosztu/reguły odnowienia reakcji i operacji rozstrzygnięcia. Oddziel MP, punkty zaklęć i sloty. Counterspell wyzwala początek rzucania przed efektami; sam wybór maga lub otwarcie jego menu nie wystarcza. [Counterspell z 2014](https://www.dndbeyond.com/spells/2051-counterspell) i [Counterspell z 2024](https://www.dndbeyond.com/spells/2619072-counterspell) różnią się sukcesem i skutkami dla zasobów; adapter musi je jawnie określać. Traditional potrzebuje własnego udokumentowanego wzoru/kosztu przerwania, nie przypadkowej mieszanki.

Przed zatwierdzeniem sprawdź ponownie wyzwalacz, życie/zdolność działania, widoczność/zasięg, cel i środki. Koszt wybranej reakcji odejmij raz także przy nieudanej kontrze, chyba że wdrożona reguła daje zwrot. Koszt i zużycie akcji pierwotnego oczekującego zaklęcia wynikają z jego zasad, oddzielnie od płatności kontrującego. Pominięcie nie wydaje żadnego z nich. Anulowanie animacji nie daje automatycznego zwrotu. Proponowane Traditional: jeden przydział reakcji na jednostkę, początkowo dostępny, chyba że jawny warunek starcia zabrania, odnawiany na początku zwykłej aktywacji tej jednostki. Inne adaptery definiują własną liczbę/granicę odnowienia; przerwanie ani dodatkowy atak szybkości nie odnawia go domyślnie. Istniejące kontry wymiany Tactical nie są automatycznie reakcjami zaklęć; zachowaj semantykę, dopóki zasady nie zmapują ich jawnie.

### Rozstrzyganie przerwań i zapis

[PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) daje przydatny wzorzec: zachowaj pierwotną próbę akcji, pokaż zaakceptowane przerwanie, natychmiast aktualizuj dalszy kontekst i chroń odtworzenie/ponowienie przed nadpisaniem późniejszych zmian. Implementacja Roleplay ucina tekst przy zweryfikowanej dosłownej frazie; parser nie jest silnikiem czasu ani zasobów walki. Wykorzystaj zasady zapisu/widoczności, nie obcinanie tekstu do ustalania, czy zaszły obrażenia.

Przedstaw zwykłą akcję jako zapisaną deklarację, oczekujące efekty i wynik rozstrzygnięcia. Proponowana kolejność: początek aktywacji i odnowienie budżetu → opcjonalne przewidywanie → legalna deklaracja/zatwierdzenie zasobów → uprawnione okna reakcji → pozostałe efekty → koniec aktywacji → legendarne okno po turze. Counterspell może anulować oczekujące efekty, nigdy cofnąć zaakceptowane obrażenia. Po zmianie stanu sprawdź pozostałą akcję, w tym cele, zasięg i obezwładnienie. Przed rozpoczęciem rzucania unieważniony wybór można zastąpić bez kosztu; po rozpoczęciu anulowanie/zwroty podlegają wybranej regule. Dzienniki i narracja GM opisują zaakceptowane zdarzenia, nie niewykonaną końcówkę próby manewru.

Wielu uprawnionych reagujących stosuje stabilny priorytet zasad, sprawdzając legalność po każdej przyjętej odpowiedzi. Obsługuj zagnieżdżone reakcje, np. skontrowanie Counterspell, tylko przez jawną zdolność zestawu zasad i ograniczony stos oczekujących akcji. Wpis ma ID rodzica/wyzwalacza; jednostka może odpowiedzieć raz na wyzwalacz i potrzebuje pozostałej reakcji. Zamykaj wyzwalacze wyczerpane, anulowane lub już rozstrzygnięte. Bez nieograniczonej rekurencji, powtarzanych pytań po pominięciu, wielokrotnego kosztu lub łańcuchów legendarnych. Celowo ograniczony pierwszy adapter musi ujawnić nieobsługiwane łańcuchy zamiast deklarować pełne zachowanie 5e.

Minimalny zapisany kontrakt: ID starcia, rewizja, ID/kursor aktywacji, zatwierdzony wykonawca, rodzaj/ID okna, wyzwalające zdarzenie i ID oczekującej akcji/rodzica, rewizja kontekstu kontrolera, rewizja kandydatów, kolejność uprawnionych/rozstrzygniętych reagujących, budżety legendarne i reakcji, zarezerwowane/zatwierdzone/zwrócone zmiany zasobów, zaakceptowany wybór/pominięcie, status rozstrzygnięcia, wynik żądania dostawcy/wariantu zastępczego i pozostałe efekty. Akceptuj decyzje atomowo z kosztami/wynikami. Spóźniona lub zdublowana odpowiedź nie może ponownie wydawać zasobów. Odtworzenie wznawia oczekujące okno lub odtwarza zaakceptowany wynik; rozgałęzienie/cofnięcie izoluje cały rejestr walki, nie samą narrację. Samo przywrócenie tekstu nie zwraca zaakceptowanej reakcji. Opisany niżej rejestr serwera dostarcza początkową implementację; sekcja 8 zachowuje kontrakt długoterminowy.

UI: pokaż pozostałe punkty legendarne, dostępność reakcji i koszt oferowanej zdolności; oznacz przewidywanie względem reakcji wyzwolonej. Pokaż powód przerwania i czy pierwotne zaklęcie wykonuje się, zawodzi czy wymaga nowego wyboru. Udostępnij dostępnie namysł/oczekiwanie, ponowienie/wariant zastępczy i anulowanie. Zapowiadaj ładowane ataki, gdy wymagają tego zasady. Nie twierdź, że lokalny wariant zastępczy wybrał GM. Wewnętrzne wyniki oceniania/prompty pozostaw poza menu akcji gracza.

Wymagane dowody: poprawne zaklęcia/zasoby/przedmioty drużyny w kontekście GM; prognoza przy wyczerpanych zasobach; wiarygodne, ale błędne przewidywanie Fireball; brak wycieku szkiców/kolejki poleceń; brak wymuszania decyzji klikaniem/ponownym wyborem; legalna zmiana akcji gracza po przewidywaniu; natywny czas 5e względem włączonej reguły domowej; Counterspell dopiero po legalnym wyzwalaczu rzucania; pominięcie słabego zaklęcia i reakcja na śmiertelne; brak MP/slotu/reakcji; jednokrotny koszt nieudanej kontry; zwrot pierwotnego zaklęcia właściwy zasadom; zabroniona widoczność/zasięg; wielu reagujących i kontrowane kontry; brak dodatkowego okna legendarnego od ruchu/dodatkowego ataku/reakcji; poprawne miejsce inicjatywy Classic; unieważniona zakolejkowana akcja ręczna; pominięte jednostki Tactical/uprawnienia przywołań; wyczerpany budżet legendarny; odnowienie dokładnie raz; śmierć/wynik podczas oczekiwania; duplikaty żądań; timeout i spóźniony sukces; odświeżenie, równoległe karty, rozgałęzienie/cofnięcie i zmiana ustawień. Po deterministycznych testach tras dodaj sprawdzenie rzeczywistego dostawcy i reprezentatywnego tempa mobilnego.

## 17. Przekazanie prac nad Agentem środowiska starcia

Usunięto pole tekstowe **Terrain guidance** (wskazówki terenu) i wiersz podsumowania przy tworzeniu gry. Stare pliki konfiguracji mogą zachowywać pole dla zgodności, ale generator nie wstrzykuje go już do każdej walki. Battlefield Size pozostaje preferencją wielokrotnego użycia. Nowe walki dostają własne wewnętrzne ziarna; zapisane mapy i restarty zachowują zaakceptowane. Etykieta Tactical opisuje ruch, teren i prognozy bez nazwy innej gry.

Przyszły Agent **Battlefield Scout** powinien działać podczas przygotowania starcia, korzystając z obecnego miejsca gracza, ostatniej sceny/środowiska, autorskich szczegółów mapy, pogody i istotnych ostatnich zdarzeń. Wysyła GM zwięzły opis środowiska przed generowaniem starcia, nie przy tworzeniu świata ani w każdej zwykłej turze.

Granica odpowiedzialności:

| Właściciel | Praca |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definicja Agenta, domyślny prompt, kod pakietu, katalog/manifest, zasoby i ustawienia należące do Agenta |
| Marinara Engine, `staging` | Punkt integracji przygotowania starcia, ograniczony kontrakt danych sceny, dostarczenie zweryfikowanego wyniku Agenta, routing skonfigurowanego dostawcy, buforowanie i wariant zastępczy, zapisane pochodzenie terenu |

Dane wejściowe muszą przenosić rewizję starcia/lokalizacji i odróżniać zaobserwowane fakty od niepewnych sugestii. Wynik: krótki opis obsługiwanego środowiska, ograniczone cechy terenu z istniejącym schematem `TacticalBattlefieldBrief` tam, gdzie dotyczy, i odwołania do źródeł. Bez wykonywalnych zasad, dowolnych współrzędnych pól, wymyślonych zasobów, uprawnień bossa lub zmian HP. Classic może otrzymać opisowe zagrożenia/kontekst, ale bez modyfikatorów siatki nieobsługiwanych przez rozstrzyganie.

GM dostaje zaakceptowany kontekst i nadal tworzy starcie; Engine sprawdza końcowy teren. Buforuj według rewizji starcia/lokalizacji, odrzucaj stare odpowiedzi po podróży lub zmianie sceny i unikaj ponownych płatnych wywołań przy ponowieniu. Przy wyłączeniu, braku lub przekroczeniu czasu użyj obecnego kontekstu generowania ze zwykłym proceduralnym terenem zastępczym. Zapisuj zaakceptowany teren zamiast generować go po odświeżeniu. Dodaj logowanie promptów i testy schematu/limitu czasu/starej lokalizacji. Agent jest tutaj opisany, nie wdrożony wewnątrz Engine ani po cichu instalowany.

### Zapis walidacji pierwszej implementacji

Lokalna baza `pnpm check` przechodzi, podobnie jak ukierunkowana regresja AI walki, istniejące regresje tras/konfiguracji/silnika terenu hybrydowego i `pnpm regression:prompt`. Testy przeglądarkowe przez rzeczywiste trasy Classic/Tactical obejmują wybór towarzyszy, kolejkę ręcznych poleceń, automatyczne akcje towarzyszy, zapis zaakceptowanej rundy i odświeżenie. Sprawdzenia konfiguracji/odtwarzania danych obejmują usunięcie wskazówek terenu, ziarno zero, jawne nieangielskie rodzaje zaklęć i jawne zero MP. Przeszedł Chromium na komputerze w jasnym motywie i w rozmiarze Androida w ciemnym; WebKit nie uruchomił się z powodu brakujących bibliotek systemowych. Zrzuty są lokalnymi artefaktami testów, nie zasobami dokumentacji w repozytorium.

Syntetyczna otwarta plansza 40 jednostek, 64×64, z chodzeniem/lotem/teleportacją i wsparciem potrzebowała około 400–440 ms na zwykłą fazę wrogów na tym hoście. Nie jest to budżet najgorszego przypadku gęstych przeszkód ani pomiar fizycznego telefonu. Balans i pełne tempo starcia nadal wymagają testów rozgrywki. Pomiary dotyczą tylko pierwszego etapu; nie ustalają opóźnienia okien bossa ani przyszłych zasad.


### Zapis walidacji implementacji bossów/reakcji

`pnpm check` i `pnpm regression:prompt` przechodzą. Pozostaje wcześniejsze niepowiązane ostrzeżenie hooka `GameNarration`. Ukierunkowane regresje zwykłego AI, reżysera, tras i dostawcy obejmują zatwierdzanie aktywacji, zachowanie zwykłej tury, zagnieżdżone kontry, pominięcie, koszt nieudanej kontry, puste MP/sloty, ochronę obszarową, reakcje blokowane ścianą, wyłączone tury, transakcje ekwipunku, duplikaty/stare polecenia, rzeczywisty twardy timeout, limit wywołań na rundę i tożsamość punktu kontrolnego/gałęzi. Adapter dostawcy sprawdzono na lokalnym serwerze HTTP, w tym rzeczywisty wysyłany kontekst i odrzucanie błędnych/nieznanych wyborów. Dowodzi to integracji, nie jakości strategii płatnego modelu.

Szesnaście testów przeglądarkowych Chromium na komputerze/mobile przechodzi dla starych i kierowanych przez reżysera kontrolek towarzyszy Classic/Tactical, rzeczywistych akcji menu, końca zwykłej rundy, odświeżenia oczekującej reakcji, zużycia ostatniego slotu dokładnie raz, odtwarzania generowanych umiejętności i porządkowania konfiguracji. Obejrzano zrzuty w jasnym motywie komputerowym i ciemnym mobilnym; panel reakcji jest widoczny, ma fokus i daje się obsłużyć. Wydajność fizycznych urządzeń, obecne pokrycie WebKit oraz jakość/tempo rzeczywistego dostawcy pozostają niesprawdzone. Rozszerzony dowód trasy wykonuje też faktyczny dziesięciosekundowy timeout i odrzuca późniejsze odpowiedzi. Walidacja nie używała działającego modelu rozgrywki. Opiekunka później zatwierdziła zewnętrzny przegląd CodeRabbit jako oczekiwany przepływ projektu; pierwszy lokalny przegląd zakończył się 15 uwagami.


### Dalsze działania po lokalnym CodeRabbit

Pierwszy przegląd doprowadził do napraw zużycia zaakceptowanych przedmiotów Classic po ponowieniu/pominiętej turze, prognoz mocy umiejętności Tactical, publicznego wejścia AI bezpiecznego dla starych ścieżek, metadanych bossa tylko dla wrogów, błędnych zapytań stanu i importowanych kosztów decyzji, brakujących zdarzeń automatycznej fazy wrogów, normalizacji maksymalnego MP, błędnych ID sterowanych jednostek, menu umiejętności tylko reakcyjnych, sprzątania testu dostawcy i współdzielenia wyboru połączenia w warstwie serwisu. Uwaga o przedmiotach zakładała wiele menu ekwipunku drużyny; obecnie ma je tylko lider, ale usunięcie starego odwołania do przedmiotu naprawia rzeczywisty problem porzuconego ponowienia. Zużycie wynika teraz z zaakceptowanych poleceń i rzeczywistych wyników akcji.

Sugestie pozostawione bez zmian z uzasadnieniem w kodzie:

- Sloty zaklęć celowo dopuszczają wyłącznie poziomy 1–9. Ciche odrzucanie nieobsługiwanych kluczy ze schematów generowanych mogłoby ukryć błędny autorski zestaw; istniejący schemat go odrzuca. Cantripy i nazwane zasady należą do osobnego kontraktu zasad.
- Koszt zwykłego AI korzysta teraz z bieżącego MP, gdy brakuje maksymalnego. Rzadkość zasobów reakcji celowo dzieli przez **pozostałe** MP: Counterspell wydający ostatnie punkty musi być drogi nawet przy dużej pierwotnej puli.
- Wyliczanie kandydatów bossa już tworzy listę osiągalnych pól raz. Każdy kandydat nadal przechodzi autorytatywny walidator akcji. Usunięcie powtórnej legalności lub osobny cache wymaga dowodów wydajności i zachowania granicy; była to sugestia wydajnościowa, nie zaobserwowany błąd nielegalnej akcji.
- `CombatAttackResult` nie ma istniejącego znacznika powodu nieudanej akcji. Nowe rozstrzyganie profilowane odrzuca niedostępne umiejętności przed wykonaniem, a reżyser sprawdza przed płatnością. Nowy protokół wyniku/UI tylko dla starego wariantu bez efektu odłożono jako poprawę prezentacji; wariant nie stosuje efektu ani nie wydaje zasobów.

Drugi pełny lokalny przegląd zakończył się sześcioma uwagami. Naprawiono scalanie zaakceptowanych slotów i resetowanie starych właściwości w samodzielnym ekranie Classic, przypisano profile bezpośrednio przy budowie jednostek, wyodrębniono charakterystykę GM z pól karty zamiast serializowanych metadanych, zablokowano reakcje w obu starych ścieżkach zwykłych poleceń i automatycznym wyborze oraz dodano odzyskiwalny błąd niepoprawnego odczytu zapisanego stanu.

Pozostała sugestia schematu nie ma zastosowania: `CombatAttack[]` we wspólnych typach starcia, prompt generowania i `combatSkillsFromGeneratedAttacks` wymagają obiektów ataku z nazwą. Wpisy będące wyłącznie tekstem nie mają obsługiwanej ścieżki odtwarzania. Schemat pozostaje ścisły zamiast przyjmować dane bezużyteczne dla ekranu walki.

Po naprawach `pnpm check` i `pnpm regression:prompt` przechodzą. Przechodzą cztery regresje walki i regresja trasy terenu hybrydowego, w tym rzeczywiste wyodrębnianie kontekstu dostawcy bez komentarzy/notatek edycji karty. Szesnaście komputerowych/mobilnych testów walki przeszło po pierwszych naprawach; końcowe osiem testów Classic również przechodzi z jawnym ponowieniem przedmiotu, pominiętym przedmiotem i wyczerpaniem ostatniego slotu. Konflikt odświeżenia po buildzie przerwał wcześniejszy przebieg; udane ponowienie wykonano po zakończeniu buildu. Trzeci przegląd wskazał pusty panel umiejętności Classic przy samych reakcjach, teraz poprawiony w obu układach. Odpowiednia stara ścieżka leczenia/rozstrzygania Tactical też odrzuca umiejętności tylko reakcyjne. Końcowa weryfikacja przeglądu jest poniżej.


Dodatkowe rozstrzygnięcia uwag:

- Endpoint akcji Tactical już kieruje zmianę sterowania przez `applyTacticalTurn` i `applyAction`; `applyAction` odrzuca AI dla pierwszej żywej jednostki drużyny. Regresja trasy wykonuje teraz takie żądanie i sprawdza HTTP 400 z błędem ręcznego lidera. Powielenie reguły w trasie stworzyłoby drugie źródło prawdy.
- Wskazówki AI i pola przerwań mogą być pominięte. Podane muszą spełniać jawne schematy. Ciche łapanie i odrzucanie błędnych zdolności zamieniłoby wygenerowane Counterspell, koszt lub zestaw bossa w inne zasady bez wyjaśnienia. Tolerowanie błędów każdej opcjonalnej zdolności to świadoma zmiana zachowania, nie brak zabezpieczenia.
- Węższy eksportowany alias `TacticalUnitAction` to sugestia porządkowania typów. Obsługa sterowania już wraca z `applyAction` przed zwykłą walidacją/wykonaniem, a schematy akcji reżysera wykluczają sterowanie. Nie blokuje to funkcji; przyszłe porządki API mogą zawęzić unię bez zmiany zachowania.


Trwałość starego ekwipunku pozostaje osobnym dalszym zadaniem. Przegląd zauważył, że `GameCombatUI` odłącza callback ekwipunku po wyniku starej rundy. Tak działała już baza, także używająca `void onInventoryItemUsed?.(usedItemName)`. Samo oczekiwanie na callback nie daje idempotencji: `handleUseCombatInventoryItem` obsługuje błędy wewnętrznie, a stare rundy nie mają autorytatywnej zapisanej transakcji żądania/wyniku do ponowienia. Nowe kierowane walki omijają callback i używają atomowego odliczenia ekwipunku wraz z zapisem zaakceptowanego stanu w rejestrze serwera. Stare walki zachowują dawną granicę; wspólna migracja zapisu rund i ekwipunku wymaga jawnej migracji zgodności. Ograniczenie jest udokumentowane; poprawki ponowienia przedmiotu/kolejki poleceń nie deklarują jego naprawy.

Etykieta dostępności reakcji używa teraz wariantów liczby pojedynczej/mnogiej katalogu lokalizacji. Końcowe regresje walki, typy klienta, lint workspace i dowód trasy sterowania liderem przechodzą po małych zabezpieczeniach reakcji; pozostaje wcześniejsze ostrzeżenie hooka `GameNarration`.


Końcowa weryfikacja doprowadziła również do deterministycznych wariantów podstawowej akcji/obrony dla jednostek Classic bez zapisanego profilu lub pozostałych wrogów oraz ograniczonych ID poleceń drużyny wskazujących żywych uczestników strony gracza. Ukierunkowane regresje i typy serwera przechodzą; lokalizacja liczby mnogiej reakcji jest poprawna.

Pozostałe sugestie bez wpływu na zachowanie odłożono: deduplikację identycznych schematów slotów, zwracanie ID oczekującej akcji zamiast użycia najnowszego rekordu bezpośrednio po synchronicznej deklaracji, zawężanie wewnętrznych typów i zastąpienie sortowania frontu teleportacji wyszukiwaniem minimum. Kod ma jawne granice i zachowuje walidację każdej akcji; między dodaniem a wyborem tego rekordu nie zachodzi przeplatana deklaracja. Sugestie nie wykazują zmiany wyniku walki. Podobnie stare odnowienie 0/brak jest tymczasowo zapisywane jako 1 i zmniejszane na końcu tego samego rozstrzygania całej rundy; jest dostępne przy następnej aktywacji. Reżyser używa osobnej płatności na aktywację bezpośrednio z 0. Wyrównanie wartości pośrednich nie jest konieczne dla tej samej dostępności.


Proponowana zmiana cache zakłada nieidempotentne `/director/start`. Dla zaakceptowanego czatu/kotwicy jest idempotentne: serializowana trasa ładuje i zwraca istniejący rejestr przed tworzeniem lub płatnością, a regresja sprawdza, że ponowienie startu ze starymi uczestnikami klienta zwraca dokładnie zaakceptowaną sesję. Odświeżenia przy ponownym montowaniu/łączeniu pozwalają klientowi zobaczyć odtworzony lub zaktualizowany stan serwera. Ich wyłączenie zachowałoby stare walki w cache; jawne odświeżenie pozostaje dostępne, a ponowienia są wyłączone.

Czwarty lokalny przegląd zakończył się 15 uwagami, w tym powtórzeniami i opcjonalnymi porządkami. Pozostała poprawka zachowania respektuje jawne wskazówki Mindless dla kategorii other/unknown; regresja odtworzyła ignorowanie wskazówki przed naprawą. Zapisane profile nadal zachowują zachowanie. Proponowany limit mapy oczekujących 40 odrzucałby poprawny końcowy wpis stosu: deklaracja najpierw dodaje wpis, potem blokuje dalsze zadania reakcji powyżej 40, więc granica zapisu wynosi 41. Promień obszaru 0 celowo oznacza brak rozszerzenia, zgodnie z oboma rozstrzyganiami. Zmiana odziedziczonego dynamicznego importu dostawcy w funkcji połączenia na statyczny jest opcjonalnym porządkiem. Nie deklaruje się zera uwag; wcześniejsze dalsze zadanie trwałości starego ekwipunku pozostaje otwarte.

Końcowa weryfikacja wszystkich poprawek przeglądu: `pnpm check` przechodzi, w tym lokalizacja, formatowanie, typy, lint i buildy produkcyjne; regresja AI walki przechodzi po wykazaniu błędu wskazówki Mindless przed naprawą. Wcześniejsze wyniki promptów, reżysera/tras/dostawcy i przeglądarek komputerowych/mobilnych pozostają jak opisano wyżej. Ostatnie małe poprawki sprawdzono lokalnie, potem wykonano kolejny zewnętrzny przegląd przy przygotowaniu PR.


### Przegląd przygotowania PR

Własność implementacji i zakres śledzi [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299); zgodność tłumaczeń tych dwóch dokumentów śledzi [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). Wspólny symlink umiejętności działa, a wszystkie 52 pliki porównano bajtowo z poprzednią zawartością Git. `pnpm check` przechodzi po przeniesieniu. `AGENTS.md` jest osobną adaptacją `CLAUDE.md` dla Codex, z jawnym przejściem od szkicu do gotowości po implementacji, wymaganej lokalnej walidacji i lokalnym przeglądzie.

Rozstrzygnięcia rundy publikacyjnej:

- Umiejętność Impeccable znajduje się w `.agents/skills/impeccable`. Kopię w `.claude/skills` i jej alias `.agents/skills` usunięto 2026-10-07; zabezpieczenie projektu Impeccable odczytuje umiejętność z `.agents/skills`.
- Uwagi o przykładach Impeccable, sformułowaniach, pochodzeniu dołączonego pakietu i istniejących wnętrzach narzędzi dotyczą plików przeniesionych bez zmiany zawartości. Nie są regresjami PR. Migracja zachowuje zainstalowaną umiejętność, nie włącza osobnego projektu utrzymania umiejętności upstream.
- Zakres przedmiotu Tactical `any` jest jawnie obsługiwany przez `CombatItemEffect`, walidację trasy i sprawdzanie celów reżysera. Zastąpienie każdego zakresu poza self/enemy przez `ally` zepsułoby to zachowanie. Istniejąca wartość domyślna dotyczy tylko braku zakresu.
- Wyprzedzające obliczanie pościgu jest ograniczone i nie zmienia zwycięskiej legalnej akcji. Leniwe obliczanie to opcjonalne usprawnienie wydajności; zapisany pomiar fazy mieszanego ruchu pozostaje obecnym dowodem, nie twierdzeniem, że dalsza optymalizacja jest niemożliwa.
- Zdolności generowanego ataku są sprawdzane przez schemat starcia i ponownie przez schematy startu/akcji reżysera. Podstawienie wartości domyślnych za błędne jawne koszty/zdolności podczas odtwarzania po cichu zmieniłoby autorski zestaw. Zachowaj zgodność brakujących pól i walidację podanych, zgodnie z opisem wyżej.
- Ponowny wniosek o wyłączenie odświeżeń zapytania startu odrzucono z opisanych powodów idempotencji i starego stanu; dowodem pozostaje rzeczywiste ponowienie trasy.

Przegląd publikacyjny zakończył się 34 uwagami: 30 w niezmienionej przeniesionej umiejętności i czterema w walce. Wszystkie cztery obejmują powyższe uzasadnienia (leniwy pościg, obsługiwane cele przedmiotów `any`, idempotentne odświeżenia startu i jawna walidacja zdolności). Runda nie wymagała dalszej zmiany implementacji. Wcześniejsze zaakceptowane uwagi pozostają naprawione i sprawdzone. To wynik przeglądu z uzasadnionymi rozstrzygnięciami, nie deklaracja zera uwag.

## Dalsze prace nad trudnością i pogodą

Zobacz [Trudność walki i pogoda](game-combat-difficulty-weather.md), gdzie opisano implementację #6305: normalizację trudności, modyfikatory obrażeń Traditional tylko dla wrogów, konsekwencję decyzji z ziarnem, zaakceptowaną pogodę w obu trybach, jawne cechy ataków, neutralność osłoniętego/nieznanego otoczenia i stałe warunki po odświeżeniu. Alternatywne zestawy zasad muszą określić własną politykę trudności przed przejęciem skalowania obrażeń.
