# AI walki w trybie Game Mode

Jak Engine decyduje o działaniach przeciwników i towarzyszy sterowanych przez AI w walkach Classic, Tactical oraz walkach zestawu zasad i jak mistrz gry prowadzi bossów. Kod znajduje się w `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`, `tactical-combat/ai.ts` i `tactical-combat/profile-ai.ts`, a część serwerowa w `packages/server/src/services/game/combat-director.service.ts`, `combat-ai.service.ts`, `combat-boss.service.ts` i `ruleset-combat-director.service.ts`. Miejsce walki w całym trybie Game Mode opisuje [Architektura trybu Game Mode](game-mode-architecture.md).

Liczby w sekcjach dotyczących implementacji ([Granica obecnej implementacji zwykłego AI](#current-ordinary-ai-implementation-boundary) i sekcje powiązane z nazwanymi stałymi) to bieżące parametry dostrojenia Engine. Liczby oznaczone jako przykład, propozycja, wartość tymczasowa lub cel projektowy nimi nie są, a żadna z nich nie stanowi twierdzenia o balansie sprawdzonym w rozgrywce. Przywoływanie we własnych systemach walki Classic i Tactical aplikacji Marinara nadal jest propozycją ([Rozszerzenie projektu Summoning](#summoning-design-extension)); walki zestawu zasad korzystają przy przywoływaniu z własnych reguł `summons`.

## Rozdziel zdolności, temperament i sterowanie

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

## Katalog przymiotników

### Pierwsza ósemka

| Przymiotnik         | Preferencja celu                                                             | Pozycja i ryzyko                                                                                    | Używanie umiejętności/zasobów                                                                                      | Czego może nauczyć się gracz                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Najbliższy żywy osiągalny członek drużyny według zasady z sekcji [Mindless: ścisły kontrakt pościgu](#mindless-an-exact-pursuit-contract)               | Najkrótsza legalna trasa przestrzenna; ignoruje korzyści terenu, narażenie i formację                           | Prosty legalny atak w ten cel; bez priorytetów leczenia, skupiania ognia i optymalizacji zasobów                   | Zwabiaj bliskością, terenem i wąskimi przejściami             |
| **Reckless**      | Natychmiastowe obrażenia i osiągalna presja; nie automatycznie najsłabsza ofiara | Agresywnie podchodzi, toleruje kontry i odsłonięte pozycje                                  | Chętnie używa silnych dostępnych ataków; rzadko zatrzymuje się dla obrony                                             | Karz nadmierne wysunięcie i prowokuj niekorzystne wymiany            |
| **Cautious**      | Cele, którym może zagrozić przy ograniczeniu obrażeń zwrotnych                          | Ceni bezpieczne pozycje, przydatny zasięg i teren obronny                                            | Oszczędza rzadkie zasoby, gdy zwykły atak jest niemal równie przydatny; leczy/broni się w razie potrzeby                | Ograniczaj bezpieczną przestrzeń; wykorzystuj niechęć do zaangażowania   |
| **Opportunistic** | Cele ranne, odsłonięte lub osłabione; pewne szanse dobicia   | Przyjmuje część ryzyka dla konkretnej okazji                                                                | Ceni umiejętność, gdy tworzy lub wykorzystuje okazję                                                      | Chroń wrażliwych sojuszników i uniemożliwiaj łatwe dobicia   |
| **Protective**    | Zagrożenia dla wyznaczonego wrażliwego sojusznika lub pobliskiej wspieranej grupy          | Pozostaje w zasięgu wsparcia; zajmuje legalne przydatne pola blokujące                                    | Chroni podopiecznego obroną/wsparciem; atakuje, gdy ochrona nie jest pilna              | Rozdzielaj grupę lub podchodź z kilku stron   |
| **Supportive**    | Zdrowie sojuszników i przydatne wzmocnienia przed własnymi obrażeniami                           | Przesuwa się w legalny zasięg wsparcia, unikając zbędnego narażenia                                        | Leczy istotne braki HP, unika nieprzydatnego nadleczenia i zdublowanych wzmocnień; atakuje, gdy wsparcie niewiele daje | Wywieraj presję na wspierającą jednostkę lub oddzielaj ją od odbiorców |
| **Disciplined**   | Cele zgodne z rolą, rozsądne szanse dobicia                      | Równoważy obrażenia, bezpieczeństwo, pozycję i zasoby; umiarkowanie trzyma się celu                            | Rzetelne podstawy roli bez specjalizacji w skrajności                                               | Zakłócaj rolę i wymuszaj niekorzystne wybory              |
| **Cowardly**      | Bezpiecznie osiągalne cele bez prowokowania odwetu                       | Instynkt samozachowawczy rośnie po zranieniu lub przy lokalnej przewadze liczebnej wroga; odwrót w bezpieczniejszą przestrzeń sojuszników | Chętniej leczy/broni siebie i unika kosztownego zaangażowania                                                | Odcinaj bezpieczny odwrót i utrzymuj presję dystansową    |

Protective nie przekierowuje magicznie obrażeń, nie prowokuje, nie przechwytuje ataków ani nie zyskuje reakcji. Obecne zajmowanie pól pozwala blokować pozycją; silniejsza ochrona wymaga rzeczywistych zdolności. Cowardly może się wycofać i bronić, ale istniejąca akcja Tactical `flee` kończy całą walkę. **Nigdy nie używaj globalnej ucieczki jako ucieczki jednego wroga.** Pojedynczy przeciwnik opuszcza walkę tylko poprzez morale ("Utrata ducha walki w Classic i Tactical", w sekcji [Praktyczne zabezpieczenia](#practical-guardrails)) lub ucieczkę przewidzianą przez zestaw zasad.

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

<a id="assigning-profiles-role-experience-personality-then-seeded-variety"></a>

## Przypisywanie profili: rola, doświadczenie, osobowość, potem różnorodność z ziarnem

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

Doświadczenie wpływa **zarówno** na szansę temperamentu odpowiedniego dla roli przy pierwszym przypisaniu, jak i na konsekwencję realizowania go. Zwykłemu lokalnemu AI nie ujawnia ukrytych zdolności gracza ani zakolejkowanych poleceń. Bossowie GM mają szerszą wiedzę o kartach drużyny opisaną w sekcji [Bossowie GM, legendarne akcje i reakcje](#gm-bosses-legendary-actions-and-reactions); żaden kontroler nie widzi przyszłych rzutów ani nie zna niezatwierdzonego wyboru gracza. Założenie o przetrwaniu doświadczonych to przydatna tendencja do budowania świata, nie prawo mówiące, że każdy doświadczony czarodziej jest ostrożny.

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
- To, jak bardzo jednostka się waha, stanowi część tego, co może zyskać w swojej turze; wahanie osiąga pełną skalę, gdy najlepszy kandydat daje zysk równy mniej więcej jednej trzeciej wroga. Wobec drużyny zbyt wytrzymałej, by pojedynczy cios mógł ją nadwątlić, każdy cios stanowi niewielką część wroga, a wahanie o stałej wielkości rozstrzygałoby między pełnym Multiattack a dwoma sztyletami rzuconymi z utrudnieniem. Przyciąganie jednostki methodical do jej ostatniego celu maleje w ten sam sposób, a także wraz ze spadkiem wartości ciosu w ten cel.
- Cios, który daje wyraźnie mniejszy zysk niż najlepszy dostępny (poniżej 97 setnych) i już ma od niego niższą ocenę, w ogóle nie podlega wahaniom, więc jednostka novice nigdy wskutek wahania nie stawia dwóch sztyletów wartych 93 setne Multiattack ponad nim.
- To, co jednostka ceni w celu (ukierunkowanie jej umysłu: najgroźniejszy, najsłabszy), przechyla wybór tylko między ciosami zadającymi podobną krzywdę: cios zadający mniej niż 97 setnych krzywdy jej najmocniejszego ciosu niczego na tym nie zyskuje.
- W walkach zestawu zasad ocena zagrożenia jednostki w miejscu, w którym zostaje, by walczyć, traktuje przeciwnika mogącego do niej podejść i ją tam uderzyć jako niemal równie niebezpiecznego jak stojącego obok (o jedną dziesiątą mniej na końcu jego dystansu chodzenia), więc odejście sześć pól od rycerza, by rzucać z daleka, nigdy nie wygląda bezpieczniej niż podejście do niego. Przy ucieczce koniec dystansu chodzenia nadal jest oceniany jako znacznie bezpieczniejszy, a jednostka nigdy nie wbiega w szczelinę wymagającą przeciskania się, jeśli może stanąć tam, gdzie mieści się w całości.
- Ochroniarz poza granicą oddalenia nie wykonuje żadnej sekwencji podejścia i uderzenia kończącej się poza tą granicą, nawet bliżej niż jego obecne miejsce: zamiast tego wraca.
- Multiattack, którego cel zostaje powalony w trakcie wykonywania, kieruje pozostałe części w najbliższego innego przeciwnika w zasięgu każdej z nich (jeśli nie ma takiego przeciwnika, nie są wykonywane); skierowany w kogoś już powalonego jest wykonywany zgodnie z wyborem, a okrutne stworzenie dalej atakuje powalonego.
- Dziennik walki podaje przyczynę testu morale przed rzutem, zmianę temperamentu i jej przyczynę, kogo pociągnięto za sobą podczas chodzenia, pozostanie stworzenia terytorialnego na swoim terenie oraz poddanie się drużyny. Stworzenie, które się poddało, pozostaje na planszy w miejscu poddania.
- W walkach zestawu zasad ocena obrażeń ciosu to oczekiwana krzywda względem średniego zdrowia strony celu, niezależnie od tego, kto go otrzymuje, więc wyższe zdrowie rycerza nie obniża wartości Multiattack przeciw niemu w porównaniu z taką samą krzywdą zadaną czarodziejowi. Cios, który powaliłby cel, jest ważony względem zdrowia tego celu, ale nigdy nie traktuje się go jako mniej wytrzymałego niż trzy czwarte tej średniej.

<a id="mindless-an-exact-pursuit-contract"></a>

## Mindless: ścisły kontrakt pościgu

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

## Decyzje zwykłych wrogów

### Wykorzystaj rozstrzyganie, zmieniaj priorytety

Najpierw generuj legalne akcje kandydackie, potem oceniaj je wagami roli i przymiotnika. Korzystaj z istniejących funkcji ruchu, prognoz i gotowości; dodaj najmniejszą wspólną funkcję legalności potrzebną AI silnika i jednostkom GM. Nie wywołuj wyłącznie mutującej funkcji `performUnitAction` z niezweryfikowanymi danymi modelu.

Kandydaci powinni obejmować:

- Atak podstawowy i dostępne umiejętności ataku, w tym legalne miejsca ruchu przed akcją.
- Leczenie, wzmocnienia i osłabienia właściwej strony, w tym podejście w zasięg wsparcia.
- Obronę, czekanie i celowy ruch, gdy nie ma przydatnego ataku/wsparcia.

Uwzględniaj tylko mechaniki rzeczywiście obsługiwane przez rozstrzyganie. Przedmioty wrogów wymagają najpierw realnego ekwipunku i rozliczania. Ocenianie nie może wymyślać geometrii AoE, przywołań, prowokacji, nowych reakcji, ataków okazyjnych, osłon ani ucieczki. Tactical ma już kontrataki i obronę/czekanie; Classic potrzebuje jawnej automatycznej obrony/czekania oraz właściwych operacji wzmocnień/osłabień, zanim zaoferuje równoważne profile. To praca nad rozstrzyganiem, nie tylko zmiana wag.

Stosuj znormalizowane czynniki oczekiwanych obrażeń, prawdopodobieństwa dobicia, przydatnego leczenia/wsparcia, natychmiastowego ryzyka kontry, narażenia w następnej fazie, postępu ku zasięgowi roli i kosztu zasobów. Pomnóż je przez małą tabelę profili. Ogromna uniwersalna premia eliminacji zatarłaby różnice temperamentu, więc nowa polityka powinna używać ograniczonej wartości dobicia zależnej od profilu.

To małe podejście oparte na użyteczności: porównuj legalne akcje na spójnych skalach i zmieniaj priorytety według osobowości. Ogólne podejście i bezwładność decyzji opisuje David "Rez" Graham w [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Konkretne profile, wzór, ustawienia i plan integracji tutaj to zalecenia projektowe właściwe dla Marinara.

<a id="practical-guardrails"></a>

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

**Utrata odwagi w Classic i Tactical (combat AI E1, E2).** Kierowana walka Classic lub Tactical stosuje regułę morale ze starych gier wobec każdego przeciwnika, który nie jest bossem ani bezmyślny. Każdy przeciwnik ma wynik morale w skali od 2 do 12: `aiHints.morale` ze schematu, gdy fabuła go podaje, a w przeciwnym razie 7 dla umysłu instinct lub cunning, 8 dla tactical i 9 dla genius, zmodyfikowany przez temperament (cowardly −3, cautious −1, protective +1, reckless i disciplined +2) i o jeden więcej dla przywódcy. Na początku jednej ze swoich tur sprawdza, po jednym razie i w tej kolejności: zaskoczenie (`surprised` w schemacie), powalenie przywódcy (`aiHints.leader` lub bossa), powalenie połowy swojej strony, powalenie pierwszego ze swojej strony oraz zranienie poniżej połowy zdrowia. Suma na dwóch kościach przekraczająca jego wynik załamuje go. Myślący przeciwnik z wrogiem obok (zawsze w Classic, gdzie nie ma planszy) poddaje się; zwierzę lub ktoś, kto ma miejsce, ucieka, idąc do najbliższej krawędzi planszy i opuszczając walkę, gdy rozpocznie tam swoją turę. W obu przypadkach opuszcza walkę żywy: walka jest wygrana, gdy nie pozostaje żaden przeciwnik, podsumowanie mówi mistrzowi gry, kto uciekł, a kto się poddał, a łupy przeciwnika, który się poddał, wypadają wraz z łupami poległych. To samo `aiHints.leader` oznacza przeciwnika w walce zestawu zasad jako przywódcę na potrzeby testów morale `leader-down` tego zestawu zasad. Walki zapisane przed wprowadzeniem morale nadal toczą się bez niego.

**Działanie poszczególnych ról (combat AI A1-A3).** Rola modyfikuje teraz wspólne ważenie we wszystkich trzech stylach, chyba że przeciwnik jest bezmyślny: bulwark najbardziej ceni ochronę i dostaje premię za zakończenie chodzenia obok zagrożonego przyjaciela; skirmisher bardziej ceni dobijanie i koordynację i dostaje premię za uderzenie w cel z przeciwnej strony niż przyjaciel, który już przy nim stoi; marksman bardziej zważa na zagrożenie; spellcaster zachowuje kosztowne opcje na chwile, gdy mają znaczenie; controller najbardziej ceni przygotowanie; supporter bardziej ceni pomoc i dostaje premię za zakończenie obok rannego przyjaciela; a solo (stworzenie zestawu zasad z akcjami specjalnymi lub legendarną odpornością albo boss Classic/Tactical) wydaje bez ograniczania się, uderza mocniej i mniej zważa na zagrożenie. Rola stworzenia zestawu zasad wynika z tego, co potrafi (zobacz akapity dotyczące 1.763/1.776 w writing-rulesets.md), a jego temperament jest losowany ponownie z tą rolą, gdy różni się ona od pierwszego przypuszczenia, chyba że fabuła lub dane wskazują temperament albo jest to przeciwnik z arkuszem postaci (którego otwarte wybory wypełniono z uwzględnieniem podanego temperamentu).

**Podejście i ponowne wycofanie (combat AI A4).** Stworzenie zestawu zasad, które uderzyło z bliska w tej turze i ma rolę skirmisher albo temperament cautious lub cowardly, wykorzystuje pozostałe chodzenie, by się oddalić: najpierw Disengage, na które jeszcze je stać (akcja dodatkowa z Nimble Escape), a potem pole ucieczki; bez Disengage wybiera tylko pole, które niczego nie prowokuje i nie sąsiaduje z żadnym przeciwnikiem. Informacja jest pamiętana przez okno wymagające odpowiedzi człowieka (`turnSoFar.struckClose`).

**Ochroniarze (combat AI A5, Capability API 1.777).** Przeciwnik, którego `behavior.guards` wskazuje `leader`, `casters` lub `healers`, otrzymuje rozkaz towarzysza `protect` wobec najbliższego przyjaciela danego rodzaju, który jest na nogach (`rulesetBodyguardOrders`): tę samą granicę oddalenia o trzy pola, skupienie na każdym, kto zagraża jego podopiecznemu, i powrót do niego, gdy nie ma nic do zrobienia. Bezmyślny ochroniarz także zachowuje rozkaz: przed zastosowaniem reguły najbliższego celu dla bezmyślnych jego kandydaci zostają zawężeni do ciosów w każdego, kto stoi obok podopiecznego, jeśli są tacy kandydaci. Preferencja celu `leader` obejmuje teraz także uczestnika walki oznaczonego przez fabułę jako przywódca (E2).

**Przywódcy (combat AI A6).** W walkach zestawu zasad przywódca (`block.leader` lub `leader` z E2) dodaje pomocy obejmującej całą stronę (opcjom dla sojuszników z co najmniej dwoma celami lub obszarem) +0.6 do skupienia w rundach 1-2 (`weighRulesetLeadership`); pozostali po jego stronie (tylko przeciwnicy; towarzysze mają rozkaz podążania) dostają +0.3 do skupienia na jego ostatnim celu; a gdy przywódca zaczyna turę, uciekający sojusznicy w promieniu sześciu pól tracą `routed`, a wyzwalacz, który ich załamał, zostaje usunięty z `moraleChecked`, więc testują ponownie w następnej turze (`rallyRulesetSide`). Pomoc obejmująca całą stronę uwzględnia też opcję nakładającą na siebie stan, którego `auras` dosięgają własnej strony (Leadership z 5e), a `rulesetEffectWorth` wycenia taką aurę jako wartość podanych w niej stanów za każdego przyjaciela w zasięgu; premia za otwarcie wynosi +1 do skupienia. Morale w Classic i Tactical nie ma jeszcze podnoszenia na duchu.

**Zdyscyplinowani i fanatyczni (combat AI T1, T2).** `disciplined` ma teraz wagę koordynacji 1 (szyk), +0.6 zamiast +0.3 do skupienia na ostatnim celu przywódcy i pomija wyzwalacz morale `first-fall` zestawu zasad. `fanatical` (w `COMBAT_NAMED_TEMPERAMENTS`, nigdy nie jest losowany bez wskazówki lub danych, które go wskazują) ma wagę obrażeń 2, ryzyka 0.05 i ochrony 1, nie ma wyniku morale w Classic/Tactical i nigdy nie wykonuje testu morale zestawu zasad. Mechanizm kierowania odzwierciedla odgrywany temperament w `RulesetCombatant.temperament` na potrzeby tych testów zasad.

**Zmiany temperamentu (combat AI T7, Capability API 1.779).** `aiHints.shifts` (fabuła) lub `behavior.shifts` zestawu zasad wskazuje do czterech `{on, to}`; `shiftCombatTemperament` stosuje pierwszą zmianę, której wyzwalacz wystąpił, jeden raz (`tactics.shifted`), na początku tury jednostki: `shiftTurn` w Classic/Tactical (osaczenie oznacza tam zdrowie poniżej jednej czwartej z członkiem drużyny obok; w Classic sąsiedztwo jest przyjmowane zawsze) i `shiftRulesetTemperament` w walkach zestawu zasad (osaczenie wymaga też braku pola odwrotu). Jednostka po zmianie zachowuje nowy temperament zamiast temperamentu z danych, a jego odzwierciedlenie w zestawie zasad podąża za tą zmianą.

**Arogancki (combat AI T5, Capability API 1.780).** Temperament dostępny tylko po jawnym wskazaniu (`COMBAT_NAMED_TEMPERAMENTS`): ryzyko 0.2, przygotowanie 0.05, koszt 2 (rola `solo` zachowuje ten koszt zamiast go zerować), utrzymywanie pozycji skłaniające się ku ofensywie. Bez własnych `shifts` korzysta z `COMBAT_ARROGANT_SHIFTS` (poważne zranienie lub powalenie sojusznika → methodical); `tactics.shiftedFrom` to zapamiętuje. W walkach zestawu zasad `retreatAloft` wznosi legendarne aroganckie (lub dawniej aroganckie) stworzenie latające, gdy jego zdrowie spadnie poniżej jednej czwartej, i powstrzymuje je przed podchodzeniem do kogokolwiek.

**Terytorialny (combat AI T4, Capability API 1.781).** Temperament dostępny tylko po jawnym wskazaniu. `syncRulesetCombatants` zapisuje w `tactics.home` miejsce, w którym jednostka stoi po raz pierwszy; `rulesetTerritoryLeash` przekształca `behavior.territory` (domyślnie 6) wokół tego miejsca w tę samą granicę oddalenia, jaką ma towarzysz pełniący straż (z zastępczym uczestnikiem walki w punkcie początkowym), używaną przez `walkTowardsTrouble` i do odrzucania kandydatów, którzy oddalają jednostkę jeszcze bardziej od jej terenu. Granica nie obowiązuje, dopóki `harmedBy` stoi poza jej terenem. Bezmyślne stworzenie, którego dane podają `territorial`, pozostaje na swoim terenie (`rulesetTerritorial`), a `tactics.home` przetrwa ponowne losowanie taktyki.

**Okrutny (combat AI T3, Capability API 1.782).** Temperament dostępny tylko po jawnym wskazaniu: dobijanie 3 (jak opportunistic), przygotowanie 0.8. `cruelOpponents` w konfiguracji gry (domyślnie wyłączone) staje się `CombatDirectorState.cruel`; `syncRulesetCombatants` odzwierciedla `cruel` w uczestniku walki zestawu zasad tylko wtedy (w przeciwnym razie `opportunistic`), a `rulesetCandidatesFrom` pozwala uczestnikowi walki, którego odzwierciedlony temperament to `cruel`, oceniać krzywdzące ciosy we wroga, który jest powalony i nie jest pokonany. Walki Classic i Tactical nie mają stanu powalenia z zachowaniem życia, więc działają tam tylko wagi.

**Honorowy (combat AI T6, Capability API 1.783).** Temperament dostępny tylko po jawnym wskazaniu: dobijanie 0.2. W walkach zestawu zasad jego mechanizm wyboru odrzuca kandydatów wymierzonych we wroga uciekającego, powalonego lub takiego, który się poddał (gdy pozostaje cokolwiek innego), i daje +0.6 do skupienia na wrogu, który ostatnio go zranił, oraz +0.3 na wrogu obok. Polecenie drużyny `yield` (oferowane jako `DirectedRulesetView.canYield`, gdy każdy przeciwnik na nogach jest honorowy) kończy walkę jako `defeat` z `CombatSummary.yielded`, co podsumowanie przekazuje mistrzowi gry jako przyjęte poddanie się.

**Głodny (combat AI T8, Capability API 1.784).** Temperament dostępny tylko po jawnym wskazaniu: dobijanie 2, przygotowanie 1. Jego mechanizm wyboru daje +0.6 do skupienia na `tactics.targetId`. Na początku jego tury zestawu zasad `dragOffPrey` znajduje wrogów, których ciągnie (`rulesetDragging`), ustawia pierwszego jako cel i idzie do `rulesetRetreatCell`, ignorując ich, dzięki czemu ciągnięcie zabiera ich ze sobą; potem w tej turze nie podchodzi już do nikogo.

**Latający utrzymują wysokość (combat AI A7).** Gdy tura latającego stworzenia zestawu zasad przechodzi w bezczynność na ziemi (`keepAloft`), a stworzenie może latać, ma dostępną akcję zadającą obrażenia z dystansu, nie ma roli bruiser ani temperamentu reckless i nie jest bezmyślne i pozostaje na nogach przeciwnik, który nie może latać, wykonuje Fly w górę, jeśli plansza ma poziomy, a następnie kontynuuje turę (strzał, odskok) z powietrza.

**Pola wody, ciasne szczeliny, ofiara i strzały z daleka.** Zapisana pozycja na polu wody wczytuje się (kontrola zapisu nie uznaje już wody za zablokowaną). Ucieczka (`rulesetRetreatCell`) nigdy nie kończy się w szczelinie wymagającej przeciskania się w przypadku stworzenia większego niż jedno pole. Głodne stworzenie ciągnie tylko ofiarę na nogach, a gdy każdy inny wróg na nogach znajduje się poza dystansem jego chodzenia powiększonym o jedno pole, zostaje w miejscu zamiast ciągnąć dalej. Uczestnik walki, który się poddał, ma białą flagę na swoim znaczniku i "Surrendered" na swojej karcie zamiast czaszki oznaczającej pokonanie. Myślące stworzenie, którego najlepszy cios z bliska zadaje średnio ponad półtora raza tyle co jego strzał (`rulesetShotFromAfar`), strzela tylko wtedy, gdy nie może dosięgnąć celu, a potem podchodzi zamiast pozostawać na swojej pozycji. Liczą się tylko akcje, które może wykonać teraz: przyznane uderzenie Flame Blade, którego jeszcze nie przywołało, nie jest liczone.

**Puszczanie powalonych i jeńcy.** Posiadacz puszcza za darmo (`rulesetLetGoOfHeld`) trzymanych wrogów, którzy są powaleni, gdy inny wróg jest jeszcze na nogach, chyba że jest okrutny, a gra pozwala uderzać powalonych. Odepchnięcie lub pochwycenie kogoś, kogo już trzyma, nie ma wartości, podobnie jak odepchnięcie, gdy nie ma dokąd kogoś przesunąć, więc krokodyl gryzie tego, kogo ma w szczękach. Skupienie głodnego stworzenia na trzymanej ofierze liczy się tylko przy ciosach. Jeniec zachowuje swoje pole: można przez nie przejść, ale nie można się na nim zatrzymać, tak jak na polu powalonego uczestnika walki; jego znacznik ma białą obwódkę i większą flagę.

**Strzały Multiattack i otwarty teren.** Porównanie strzałów z daleka liczy każdy cios Multiattack tyle razy, ile jest wykonywany, i zestawia najlepszy możliwy do użycia atak wręcz z najlepszym możliwym do użycia atakiem dystansowym, więc dwa strzały Longbow zwiadowcy przeważają nad jego dwoma Shortsword. Stworzenie większe niż jedno pole wybiera otwarty teren zamiast szczeliny wymagającej przeciskania się w tej samej odległości; ciosy ze szczeliny, do której musiałoby się wcisnąć, są warte 0.6 takich samych ciosów z otwartego terenu (`RULESET_SQUEEZED_BLOWS`), a gdy już się przeciska, ciosy z otwartego terenu są warte odpowiednio więcej, więc wychodzi, by uderzyć.

<a id="boss-turns-controlled-by-the-gm"></a>

## Tury bossów sterowane przez GM

### Tożsamość i odpowiedzialność

Dodaj jawną tożsamość bossa dla każdej jednostki w danych starcia. Nie zmieniaj automatycznie najsilniejszego członka każdej grupy w bossa GM. Proponowane rangi: ordinary, elite, boss; elite pozostaje sterowany przez silnik, dopóki nie zostanie jawnie oznaczony jako boss. Istniejąca klasyfikacja muzyki całego starcia może pozostać oddzielna.

GM wybiera legalną akcję dla bossa na podstawie ustalonej osobowości, zamiaru starcia, bieżącej planszy, umiejętności/zasobów/przedmiotów drużyny i obsługiwanych mechanik. Szersza wiedza umożliwia przewidywanie, nie znajomość niezatwierdzonego wyboru gracza; sekcja [Bossowie GM, legendarne akcje i reakcje](#gm-bosses-legendary-actions-and-reactions) określa kontrakt informacji i przerwań. Silnik odpowiada za zasięg, ruch, zasoby, rzuty, obrażenia, stany i budżety tur. Zwykli pomocnicy pozostają sterowani przez silnik, także przy obecności bossa.

**Przeciwnicy z imieniem i genialni (combat AI P9).** Gra może też powierzać GM prowadzenie każdego przeciwnika z imieniem (`aiHints.named` w schemacie starcia, nadawane tylko konkretnym osobom z imieniem w fabule) i każdego przeciwnika z umysłem `genius` (według `aiHints.mind` fabuły, a w przeciwnym razie jego własnych danych zestawu zasad). `aiHints.mind` fabuły może wyłącznie ograniczyć zdolność myślenia względem tego, co podają własne dane stworzenia (zdominowanego lub oszalałego), albo zastąpić brak określenia umysłu w danych: przypadkowa wskazówka nigdy nie zrobi z wilka taktyka. Opcja konfiguracji to `gmNamedControl`, oferowana pod kontrolą bossów i utrwalana wraz z nią na początku walki; jej brak oznacza tylko bossów. Tych przeciwników obowiązuje ten sam kontrakt jednego identyfikatora z menu, limit czasu i wariant zastępczy co bossów, ale nie dostają żadnego budżetu legendarnego, którego nie posiadają. W walce zestawu zasad prompt zawiera też profil przeciwnika (umysł, temperament, rolę, biegłość i jego `behavior` zestawu zasad), drugą stronę uszeregowaną według zagrożenia oraz rozkazy towarzyszy drużyny.

**Własne sugestie Engine.** W turze mistrza gry w walce zestawu zasad Engine ocenia kandydatów przeciwnika dokładnie tak, jak zrobiłby to jego własny mechanizm wyboru (`rankRulesetChoices`, te same wagi co w `chooseCombatCandidate`), i oznacza najlepszych trzech w opcjach decyzji jako `suggested: { rank, reason }`, dodając tych, których pominięto na krótkiej liście. Prompt przekazuje ich jako `engineSuggestions`, po jednym wierszu w ustalonej składni: `1. CANDIDATE: <id> ACTION: <label> -> <targets> REASON: <why>`. Uzasadnienie podaje największe składniki oceny (obrażenia z prognozą, prawdopodobne zabicie, kogo najbardziej chce powalić, przygotowanie, pomoc, ponoszony koszt, zagrożenie w miejscu, w którym stoi) oraz chodzenie wykonywane najpierw. Model, który nie zna zestawu zasad, nadal widzi więc, dlaczego jedno zaklęcie wygrywa z innym; może wybrać dowolnego oferowanego kandydata, a instrukcje nakazują mu stosować się do sugestii, chyba że osobowość przeciwnika, fabuła lub lepsze zagranie przemawiają za czymś innym. Nie wymaga to żadnych wywołań narzędzi. Walki Classic i Tactical robią to samo: gdy otwiera się zwykłe okno mistrza gry, `chooseClassicAction` lub `decideProfileAction` szereguje kandydatów jednostki bez dokonywania wyboru, a trzy najlepsze pasujące opcje mają `suggested`, pokazywane w tym prompcie jako `engineSuggestions` w tej samej składni.

Zalecana konfiguracja: przy wydaniu pełnej funkcji włącz nowy system taktyki dla nowych gier i zaoferuj jasno wyjaśnione ustawienie "GM directs bosses" korzystające ze skonfigurowanego połączenia GM. Wyjaśnij, że tury bossa mogą czekać na odpowiedź modelu i zużywać zwykłe środki użytkownika u dostawcy. Istniejące gry zachowują zachowanie do świadomego włączenia; utrwal wybór przy rozpoczęciu starcia. Opcja tylko silnika/offline używa tych samych profili dla bossów. Nie dodawaj dla niej osobnej wartości stylu walki i nie zmieniaj kontrolera po cichu w połowie walki.

### Orkiestracja tur

Wywołania dostawców pozostaw w serwisie orkiestracji serwera, poza czystym wspólnym silnikiem:

1. Przyjmij akcję gracza z tożsamością starcia, identyfikatorem akcji i oczekiwaną rewizją. Zweryfikuj względem zaakceptowanego stanu walki.
2. Przejdź do następnej zwykłej akcji lub decyzji przerwania w istniejącej kolejności. Oddziel deklarację od rozstrzygania efektu, aby reakcja mogła przerwać oczekujące zaklęcie; nie rozstrzygaj całej rundy, by potem ją przepisać.
3. Zapisz oczekującą aktywację/okno: ID jednostki, rewizję, kursor tury, akcję wyzwalającą/oczekującą, wersję polityki i ograniczone menu legalnych kandydatów.
4. Poproś połączenie GM o strukturalny identyfikator kandydata lub pominięcie. Dołącz bieżącą migawkę kart drużyny, zamiar bossa, obsługiwane mechaniki i tylko informacje o akcji właściwe dla okna, zgodnie z sekcją [Bossowie GM, legendarne akcje i reakcje](#gm-bosses-legendary-actions-and-reactions). Krótka opcjonalna narracja nie może zmienić stanu.
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

## Kontrakt danych i integracji

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

## Sprawdzanie frajdy, realizmu i różnorodności

**Frajda:** wrogowie powinni mieć nawyki rozpoznawalne i możliwe do wykorzystania. Wygrana przez oddzielenie strażnika Protective od uzdrowiciela Supportive daje więcej satysfakcji niż wygrana dzięki losowemu złemu ruchowi uniwersalnego oceniania. Nie zmieniaj wszystkich wrogów w idealne maszyny skupiające ogień.

**Realizm:** używaj wiarygodnych celów, ograniczonej wiedzy i kompetencji właściwej wrogowi. Tchórzostwo, lojalność, agresja i wyszkolenie to różne cechy. Mindless to zamówione uproszczenie dwóch kategorii stworzeń. Morale (poddanie i ucieczka) oraz temperament terytorialny już istnieją i są opisane w sekcji [Praktyczne zabezpieczenia](#practical-guardrails); bogatsze cele jeszcze nie.

**Różnorodność:** zmieniaj profile i skład starć między ziarnami, zachowując tożsamość w walce i dla powracających NPC. Teren, kombinacje ról, zasoby wrogów i cele powinny dawać więcej różnic niż inny rzut krytyczny. Trudność ma przewidywalnie zmieniać wyzwanie, nie sprawiać, że Mindless Beast nagle poluje na uzdrowicieli.

Przykładowe starcie na tej samej mapie:

- Reckless Bruiser opuszcza bezpieczne pole, by naciskać osiągalną jednostkę przedniej linii.
- Protective Bulwark zostaje przy magu Supportive zamiast dołączyć do szarży.
- Cautious Marksman utrzymuje linię ostrzału i unika odsłoniętej pozycji.
- Mindless Beast wybiera krótszą drogę przez las do najbliższego osiągalnego członka drużyny, ignorując dalszego rannego maga.
- Nazwany humanoidalny boss otrzymuje turę GM, by wybrać legalną presję charakterystyczną lub ochronę drogi odwrotu. Pomocnicy nadal używają własnych profili.

Inne ziarno może dać Cowardly Bruiser i Opportunistic Marksman, zmieniając przebieg. Odświeżenie nie może tego zrobić. Późniejsze pojawienie się tego samego nazwanego bossa powinno zachować jego nawyki, chyba że zmieni je fabuła lub jawna edycja.

<a id="current-ordinary-ai-implementation-boundary"></a>

## Granica obecnej implementacji zwykłego AI

Wdrożone słownictwo polityki: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical i Coordinated**. Pozostałe przymiotniki poniżej to pomysły, nie ukryte ustawienia wykonawcze.

Wspólny kontrakt `features/combat-ai.ts` oddziela zapisane rolę, przymiotnik, wyszkolenie i ziarno od sterowania. Nowe walki dostają zapisane przypisania; odtworzone bez profilu zachowują poprzednią automatyczną politykę. Zmiana kontrolera towarzysza nie losuje przymiotnika ponownie. Generowane skończone pule MP i jawne rodzaje/koszty umiejętności trafiają do stanu wykonawczego; brak MP wroga daje tę samą tymczasową pulę `20 + 3 × level` co u sojuszników bez statystyk, z zachowaniem jawnego zera. To ogólny wariant zastępczy Engine, nie stołowa reguła zasobów.

Przypisanie v1 jest celowo mniejsze od wzoru proponowanego w sekcji [Przypisywanie profili: rola, doświadczenie, osobowość, potem różnorodność z ziarnem](#assigning-profiles-role-experience-personality-then-seeded-variety): zgodne profile zaczynają z dodatnią wagą, faworyzowane przez rolę otrzymują premię zależną od wyszkolenia, a opcjonalna wskazówka osobowości z zamkniętego zbioru dodaje ograniczoną preferencję. Pierwszeństwo kategorii wymusza Mindless; jawna wskazówka Mindless wybiera to zachowanie także dla innych kategorii. Istniejące generowanie starcia dostarcza wskazówki niezależnie od języka; sam silnik nie interpretuje prozy osobowości. Inne wskazówki temperamentu są preferencjami, nie gwarancją, a rozumienie negacji i wielojęzycznej charakterystyki przez model nadal wymaga oceny dostawców. Pełne pochodzenie i osobowość powracających NPC powiązana z tożsamością między starciami pozostają dalszą pracą. Zastępczy poziom wywodzony z HP pozostaje słabą miarą wyszkolenia przy braku wskazówki.

Każdy tryb wylicza wykonalne ataki podstawowe, umiejętności i opcje obronne, następnie ocenia obrażenia, dobicia, skuteczne leczenie, wsparcie, koszt i właściwe czynniki taktyczne. Nie dodaje wywołania modelu w zwykłej turze. Profile nigdy nie przyznają niedostępnej zdolności, nieograniczonego MP, dodatkowej aktywacji ani nieistniejącej mechaniki terenu.

- **Classic:** bez oceny przestrzennej. Mindless stosuje stabilną kolejność żywych przeciwników z ziarnem, niezależną od HP. Wsparcie korzysta z właściwej puli sojuszników. Wzmocnienia/osłabienia stosują rzeczywisty nazwany modyfikator obrony zamiast przybliżenia samymi obrażeniami. Nowe profile mają odnowienia po każdym użyciu. Ręczni towarzysze kolejkują atak/umiejętność/obronę na własne miejsca inicjatywy; ekwipunek drużyny i działania narracyjne pozostają przy aktywnym liderze. Inni domyślnie używają AI, zgodnie z dotychczasową interakcją Classic. Polecenia wskazują wykonawcę, także po KO pierwotnego lidera.
- **Tactical:** polityka otrzymuje legalne osiągalne pozycje ataku/wsparcia. Mindless idzie trasą najmniejszej liczby kroków, płacąc rzeczywisty koszt ruchu; lot i teleport zachowują własne ograniczenia przechodzenia/lądowania. Wsparcie może ruszyć się przed rzuceniem zaklęcia. Nowe szacunki kontry używają przyszłej pozycji. Ostrożny szacunek zasięgu na stanie publicznym określa narażenie; nie jest pełnym wyznaczaniem tras następnej tury. Ściana albo góra blokuje widzenie przy każdym ciosie (combat C6).
- **Patient:** preferuje ograniczone utrzymanie obrony zamiast niekorzystnego starcia; Classic czeka na bliskie odnowienie zamiast fikcyjnego ruchu. Nie może utrzymywać pozycji bez końca, gdy istnieje przydatna akcja.
- **Methodical:** preferuje obsługiwane przygotowanie przez redukcję obrony, zachowuje cel i atakuje, gdy status jest przydatny. Bez wymyślonego drzewa kombinacji lub przeszukiwania przyszłych rzutów.
- **Coordinated:** uwzględnia zapisane cele sojuszników i przydatne osłabienia, przeliczając po każdej zaakceptowanej akcji. Brak wszechwiedzącego planera drużyny i rezerwacji niezgłoszonych akcji gracza.
- **Towarzysze:** zlokalizowany wybór Player/AI dla każdego członka podczas walki; aktywny lider pozostaje ręczny. Towarzysze Tactical działają po pozostałych ręcznych poleceniach lub po wybraniu End Turn. Ręczna zmiana pozostaje możliwa, zanim towarzysz zadziała. Kontroler, profile i pamięć są zapisywane wraz z uczestnikami/migawkami taktycznymi.
- **Zapis Classic:** zaakceptowane wyniki rundy i numer następnej trafiają do istniejącego callbacku migawki przed animacją kosmetyczną. Rzeczywiste odnowienia po użyciu przetrwają ten zapis/odczyt. Classic nadal używa dotychczasowych losowych rzutów walki; nie jest to dokładne odtwarzanie rzutów ani idempotentny rejestr akcji serwera. Gwarancje równoległych kart należą do przyszłych prac nad autorytatywnymi bossami.

Pierwszy etap kończył się przed wywołaniami dostawcy dla bossów i reakcjami; sekcja [Bossowie GM, legendarne akcje i reakcje](#gm-bosses-legendary-actions-and-reactions) zapisuje ich późniejszą implementację. Pozostałe ograniczenia obejmują prowokację, bogatsze cele, inicjatywę poszczególnych zasad, pełną normalizację zasobów kart i rejestr profili powracających NPC. Niewdrożone fragmenty pierwotnej propozycji pozostają pracą akceptacyjną, nie domyślnie wydaną funkcjonalnością. Syntetyczne pomiary komputerowe nie stanowią kalibracji na rzeczywistym urządzeniu mobilnym.

## Więcej przymiotników z zachowaniem zależnym od klasy

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

Najlepsze następne dodatki po obecnych jedenastu: **Frugal, Relentless, Disruptive i Vengeful**. Frugal i Relentless pasują do istniejących zdolności po małych zmianach stanu. Disruptive potrzebuje faktycznej semantyki obezwładniania/rozpraszania; Vengeful pamięci zdarzeń walki. Adaptive daje dużą różnorodność, ale ma większe wymagania. Territorial od tego czasu trafił do walk zestawu zasad jako temperament dostępny tylko po jawnym wskazaniu (combat AI T4, powyżej). Resolute i Zealous traktuj jako kandydatów do sprawdzenia nakładania się zachowań przed rozszerzeniem publicznego słownictwa.

Trzy zamówione dodatki również różnią się zależnie od klasy:

| Przymiotnik | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Broni się, czekając na lepszą wymianę; w Tactical utrzymuje wartościowe podejście | Czeka na legalny przydatny zasięg zamiast wymuszać słaby strzał | Zachowuje turę dla prawie gotowego zaklęcia lub unika zmarnowanego leczenia; nigdy nie czeka na nieistniejącą regenerację many |
| Methodical | Stosuje rzeczywistą technikę osłabienia, potem atakuje tego wroga | Przygotowuje obsługiwaną podatność przed silnym atakiem | Osłabia przed zadaniem obrażeń lub przygotowuje obsługiwaną sekwencję obronną; nie nakłada ponownie przydatnych aktywnych efektów |
| Coordinated | Naciska bieżący cel sojusznika lub zapewnia przydatne przygotowanie | Dobija cel już zagrożony przez drużynę | Zapewnia niepowielone wsparcie lub osłabienie do wykorzystania przez sojuszników; przelicza po każdej akcji |

Te opisy są celami strojenia. Pierwsza implementacja używa ogólnego obsługiwanego modelu wzmocnienia/osłabienia obrony; bogatsze kombinacje zależne od klasy wymagają właściwych zdolności i scenariuszy regresyjnych.

<a id="summoning-design-extension"></a>

## Rozszerzenie projektu Summoning

Zacznij bez siatki. Przywołanie to rzeczywisty uczestnik walki ze stabilnym ID starcia, odwołaniem do właściciela, stroną, profilem, kontrolerem, czasem trwania, kosztem zasobów i jawnym budżetem aktywacji. Klasa zmienia legalny zestaw zdolności; przymiotnik zmienia priorytety jak w Classic.

Rozdziel **wybór przywołania** przywołującego od **polityki walki** przywołanej jednostki. Przywołujący Patient może zachować miejsce na późniejsze zagrożenie; przywołany Knight Protective osłania obsługiwanymi akcjami; Mage Methodical przygotowuje osłabienie; uzdrowiciel Coordinated unika powielania leczenia. Przywołania Beast/Monstrosity pozostają Mindless zgodnie z obecną regułą projektu, także po stronie sojuszniczej.

Zestaw zasad określa, czy polecenia zużywają akcję właściciela, czy przywołanie działa natychmiast lub w następnej rundzie, czy dzieli inicjatywę i co robi bez polecenia. Zalecane ogólne ustawienie: przywołanie zużywa zwykłą akcję właściciela, nowa jednostka aktywuje się po raz pierwszy w następnej rundzie i używa AI silnika, chyba że jest jawnie sterowalna. Odwołanie i ponowne przywołanie tej samej jednostki nie może przyznawać świeżej zwykłej tury. Przed zdolnościami rojów wymuś limit liczebności i stabilne rozliczanie jednej aktywacji na rundę.

KO właściciela, urok/zmiana strony, odwołanie, wygaśnięcie czasu, porażka drużyny i koniec starcia wymagają jawnych reguł sprzątania. Zachowuj właściciela i pozostały czas po odświeżeniu/imporcie. Pokonane przywołanie nie jest przedmiotem ani stałym członkiem drużyny. Koszt zaklęcia/MP odejmuj raz przy zaakceptowanym utworzeniu. Akcje przywołań nie mogą tworzyć okien legendarnych poza regułami uprawnienia utrwalonego modyfikatora bossa.

<a id="gm-bosses-legendary-actions-and-reactions"></a>

## Bossowie GM, legendarne akcje i reakcje

<a id="implemented-generic-engine-adapter"></a>

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
- Zwykli pomocnicy pozostają lokalnym AI. Wywołania GM dotyczą tylko okien bossa z istotnym wyborem. Wykorzystaj skonfigurowane połączenie GM, logowanie debugowania, zapisany wariant zastępczy i łączny limit opóźnienia z sekcji [Tury bossów sterowane przez GM](#boss-turns-controlled-by-the-gm).

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

Minimalny zapisany kontrakt: ID starcia, rewizja, ID/kursor aktywacji, zatwierdzony wykonawca, rodzaj/ID okna, wyzwalające zdarzenie i ID oczekującej akcji/rodzica, rewizja kontekstu kontrolera, rewizja kandydatów, kolejność uprawnionych/rozstrzygniętych reagujących, budżety legendarne i reakcji, zarezerwowane/zatwierdzone/zwrócone zmiany zasobów, zaakceptowany wybór/pominięcie, status rozstrzygnięcia, wynik żądania dostawcy/wariantu zastępczego i pozostałe efekty. Akceptuj decyzje atomowo z kosztami/wynikami. Spóźniona lub zdublowana odpowiedź nie może ponownie wydawać zasobów. Odtworzenie wznawia oczekujące okno lub odtwarza zaakceptowany wynik; rozgałęzienie/cofnięcie izoluje cały rejestr walki, nie samą narrację. Samo przywrócenie tekstu nie zwraca zaakceptowanej reakcji. Rejestr serwera opisany w sekcji [Wdrożony ogólny adapter Engine](#implemented-generic-engine-adapter) dostarcza początkową implementację; sekcja [Tury bossów sterowane przez GM](#boss-turns-controlled-by-the-gm) zachowuje kontrakt długoterminowy.

UI: pokaż pozostałe punkty legendarne, dostępność reakcji i koszt oferowanej zdolności; oznacz przewidywanie względem reakcji wyzwolonej. Pokaż powód przerwania i czy pierwotne zaklęcie wykonuje się, zawodzi czy wymaga nowego wyboru. Udostępnij dostępnie namysł/oczekiwanie, ponowienie/wariant zastępczy i anulowanie. Zapowiadaj ładowane ataki, gdy wymagają tego zasady. Nie twierdź, że lokalny wariant zastępczy wybrał GM. Wewnętrzne wyniki oceniania/prompty pozostaw poza menu akcji gracza.

Wymagane dowody: poprawne zaklęcia/zasoby/przedmioty drużyny w kontekście GM; prognoza przy wyczerpanych zasobach; wiarygodne, ale błędne przewidywanie Fireball; brak wycieku szkiców/kolejki poleceń; brak wymuszania decyzji klikaniem/ponownym wyborem; legalna zmiana akcji gracza po przewidywaniu; natywny czas 5e względem włączonej reguły domowej; Counterspell dopiero po legalnym wyzwalaczu rzucania; pominięcie słabego zaklęcia i reakcja na śmiertelne; brak MP/slotu/reakcji; jednokrotny koszt nieudanej kontry; zwrot pierwotnego zaklęcia właściwy zasadom; zabroniona widoczność/zasięg; wielu reagujących i kontrowane kontry; brak dodatkowego okna legendarnego od ruchu/dodatkowego ataku/reakcji; poprawne miejsce inicjatywy Classic; unieważniona zakolejkowana akcja ręczna; pominięte jednostki Tactical/uprawnienia przywołań; wyczerpany budżet legendarny; odnowienie dokładnie raz; śmierć/wynik podczas oczekiwania; duplikaty żądań; timeout i spóźniony sukces; odświeżenie, równoległe karty, rozgałęzienie/cofnięcie i zmiana ustawień. Po deterministycznych testach tras dodaj sprawdzenie rzeczywistego dostawcy i reprezentatywnego tempa mobilnego.

<a id="encounter-environment-agent-handoff"></a>

## Przekazanie prac nad Agentem środowiska starcia

Usunięto pole tekstowe **Terrain guidance** (wskazówki terenu) i wiersz podsumowania przy tworzeniu gry. Stare pliki konfiguracji mogą zachowywać pole dla zgodności, ale generator nie wstrzykuje go już do każdej walki. Battlefield Size pozostaje preferencją wielokrotnego użycia. Nowe walki dostają własne wewnętrzne ziarna; zapisane mapy i restarty zachowują zaakceptowane. Etykieta Tactical opisuje ruch, teren i prognozy bez nazwy innej gry.

Przyszły Agent **Battlefield Scout** powinien działać podczas przygotowania starcia, korzystając z obecnego miejsca gracza, ostatniej sceny/środowiska, autorskich szczegółów mapy, pogody i istotnych ostatnich zdarzeń. Wysyła GM zwięzły opis środowiska przed generowaniem starcia, nie przy tworzeniu świata ani w każdej zwykłej turze.

Granica odpowiedzialności:

| Właściciel | Praca |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definicja Agenta, domyślny prompt, kod pakietu, katalog/manifest, zasoby i ustawienia należące do Agenta |
| Marinara Engine, `staging` | Punkt integracji przygotowania starcia, ograniczony kontrakt danych sceny, dostarczenie zweryfikowanego wyniku Agenta, routing skonfigurowanego dostawcy, buforowanie i wariant zastępczy, zapisane pochodzenie terenu |

Dane wejściowe muszą przenosić rewizję starcia/lokalizacji i odróżniać zaobserwowane fakty od niepewnych sugestii. Wynik: krótki opis obsługiwanego środowiska, ograniczone cechy terenu z istniejącym schematem `TacticalBattlefieldBrief` tam, gdzie dotyczy, i odwołania do źródeł. Bez wykonywalnych zasad, dowolnych współrzędnych pól, wymyślonych zasobów, uprawnień bossa lub zmian HP. Classic może otrzymać opisowe zagrożenia/kontekst, ale bez modyfikatorów siatki nieobsługiwanych przez rozstrzyganie.

GM dostaje zaakceptowany kontekst i nadal tworzy starcie; Engine sprawdza końcowy teren. Buforuj według rewizji starcia/lokalizacji, odrzucaj stare odpowiedzi po podróży lub zmianie sceny i unikaj ponownych płatnych wywołań przy ponowieniu. Przy wyłączeniu, braku lub przekroczeniu czasu użyj obecnego kontekstu generowania ze zwykłym proceduralnym terenem zastępczym. Zapisuj zaakceptowany teren zamiast generować go po odświeżeniu. Dodaj logowanie promptów i testy schematu/limitu czasu/starej lokalizacji. Agent jest tutaj opisany, nie wdrożony wewnątrz Engine ani po cichu instalowany.

## Trudność i pogoda

### Konfiguracja i trudność

Usuń pole **Battlefield Seed** (ziarno pola bitwy) i jego podsumowanie, zachowując **Battlefield Size** (rozmiar pola bitwy). Nowe starcia otrzymują wewnętrzne losowe ziarna. Przy rozpoczynaniu kolejnych bitew ignoruj nieaktualne ustawienie ziarna kampanii; zachowaj zaakceptowane ziarna bitew, siatki i działanie ponownego rozpoczęcia. Zmień opis Classic na "Cinematic menu battles."

Normalizuj poziom trudności za pomocą jednego wspólnego pomocnika, również w starszych konfiguracjach z nazwami pisanymi wielką literą. Zachowaj mnożniki obrażeń przeciwników: Casual 0.6, Normal 1, Hard 1.3 i Brutal 1.6. Classic, podobnie jak Tactical, ma skalować wyłącznie obrażenia przeciwników. Sprawdź występowanie tego samego błędu wielkości liter w starciach i łupach. Ustal trudność przy tworzeniu starcia; zmiana ustawień podczas walki nie może jej zmienić.

Te mnożniki obrażeń należą wyłącznie do Traditional, czyli obecnej starszej mechaniki silnika. Przy implementacji 5e, V20 lub innego zestawu zasad ponownie określ trudność zgodnie z polityką danego zestawu. Nie dziedzicz domyślnie mnożników Traditional. Strojenie decyzji AI jest niezależne od skalowania obrażeń.

### Pogoda

Korzystaj z istniejącej pogody kampanii i ekspozycji starcia wynikającej z otoczenia. Zapisuj zaakceptowaną pogodę wraz ze starciem; brak pola w starszym zapisie walki oznacza neutralną mechanikę. Nieznana ekspozycja jest neutralna. Zamknięte otoczenie zapewnia osłonę. Obecne aliasy pogody muszą być normalizowane do istniejących typów, a ustawienie typu musi tworzyć zgodne wartości wiatru i widoczności.

Początkowe zasady dotyczą jednakowo obu stron: deszcz umiarkowanie zmniejsza obrażenia od ognia i zwiększa obrażenia od błyskawic; silny wiatr osłabia ataki jawnie oznaczone jako pociski; słaba widoczność osłabia ataki jawnie wymagające widzenia; śnieg zwiększa koszt chodzenia w Tactical. Lot i teleportacja zachowują swoje zasady ruchu. Dla nieoznaczonych zdolności nie wywnioskuj cechy pocisku ani wymogu widzenia z nazwy. Pogoda bezchmurna lub pochmurna jest zwykle neutralna. Prognozy, rozstrzyganie i oceny AI muszą korzystać ze wspólnych pomocników bez zużywania przyszłych rzutów walki.

Pokazuj zaakceptowane warunki i efekty w obu interfejsach walki. Kosmetyczne ustawienia pogody nie mogą wyłączać mechaniki. Pogoda pozostaje stała przez całe starcie; zdolności zmieniające pogodę, okresowe zmiany warunków, losowe uderzenia pioruna i wyczerpanie od upału są odłożone na później. Summoning i przyszłe zestawy zasad mogą korzystać ze wspólnego kontraktu pogody bez dodawania niedokończonego trybu interfejsu.

### Decyzje przeciwników

Zachowaj rolę, przymiotnik, biegłość, legalność i rozliczanie zasobów. Trudność zmienia ograniczoną zmienność decyzji opartą na ziarnie: Casual dopuszcza więcej wiarygodnych błędów, Normal pozostaje blisko obecnego punktu odniesienia, Hard zwiększa konsekwencję, a Brutal minimalizuje błędy, zachowując różnice biegłości. Strojenie decyzji towarzyszy zawsze korzysta ze stałego poziomu Normal; towarzysze nadal reagują na rzeczywistą pogodę i zagrożenia. Ograniczenia Mindless pozostają w mocy.

Uwzględniaj pogodę przy ocenie ataków, wsparcia, pozycji i reakcji. Counterspell i osłona konkurują z pominięciem reakcji zależnie od zagrożenia, kosztu i osobowości. Żaden poziom trudności nie udostępnia ukrytych poleceń, przyszłych rzutów, darmowych zasobów ani dodatkowych akcji. Prompt GM sterującego bossem otrzymuje zaakceptowaną trudność i pogodę oraz wskazówki dotyczące wywierania presji i wyboru okazji; silnik nadal egzekwuje udostępnione legalne wybory i limity. Awaria dostawcy pozostawia lokalną ścieżkę zastępczą.

### Szczegóły implementacji

Wspólne warunki znajdują się w `packages/shared/src/features/combat-conditions.ts`. Trudność jest normalizowana przy imporcie i tworzeniu konfiguracji oraz w kodzie starć, łupów, Classic i Tactical. Zmienność decyzji przeciwników jest mnożona przez 2.5 / 1 / 0.4 / 0.15 odpowiednio dla Casual / Normal / Hard / Brutal; zapisana biegłość i osobowość pozostają w mocy. Oceny Classic używają tego samego prawdopodobieństwa trafienia w przeciwstawnym rzucie d20 co rozstrzyganie, a Tactical korzysta ze wspólnej prognozy ataku. Pościg w Tactical szereguje trasy według kosztów terenu i pogody dla zwykłych profili. Jednostki Mindless wybierają natomiast legalną trasę o najmniejszej liczbie kroków; obie strategie płacą rzeczywiste koszty terenu i pogody podczas ruchu. Reakcje uwzględniają oczekiwane zagrożenie i niedobór zasobów, z tą samą polityką zmienności dotyczącą wyłącznie przeciwników.

Deszcz, ulewa i burze przy ekspozycji na pogodę mnożą obrażenia od ognia przez 0.85, a od błyskawic przez 1.15. Jawnie oznaczone pociski tracą 10 punktów celności przy silnym wietrze i 15 przy wichurze. Ataki jawnie wymagające widzenia tracą 5 punktów przy ograniczonej widoczności i 15 przy słabej. Łączna kara nie przekracza 25 punktów. Classic przelicza ją na modyfikatory przeciwstawnych rzutów ataku, po jednym punkcie na pięć punktów celności, i nazywa te kary w opisie warunków. W Tactical śnieg lub zamieć przy ekspozycji na pogodę dodają jeden punkt kosztu chodzenia za wejście na każde pole; lot i teleportacja pozostają bez zmian. Przedmioty zadające obrażenia od żywiołów również otrzymują modyfikatory deszczu; leczenie i czas trwania stanów nie.

Generowanie starcia określa wartości logiczne `projectile` / `requiresSight` dla ataków podstawowych i umiejętności oraz `battlefield.terrainBrief.exposure`. Brak cech ataku oznacza neutralność. Jawna ekspozycja ma pierwszeństwo; rozpoznane zamknięte otoczenie jest osłonięte, rozpoznane otwarte otoczenie jest odsłonięte, a niejednoznaczne pozostaje nieznane. Pogoda kampanii pochodzi z zapisanego systemu pogody, a gdy jej brakuje, z zatwierdzonej wartości pogody sceny. Tagi wiadomości rozpoczynającej walkę wstrzymują rozwój pogody w tle, zanim renderowany tryb nadąży za zmianą. Zaakceptowane warunki są zapisywane w stanie reżysera i Tactical; sprzeczne lub uszkodzone importy są odrzucane. Istniejące zapisy bez pogody pozostają neutralne. Ponowne rozpoczęcie starszej walki Tactical przekazuje zaakceptowane warunki, w tym ich neutralny brak, zamiast odczytywać zmienioną pogodę kampanii.

Konfiguracja nadal sprawdza wycofane pola przy imporcie ze względu na zgodność i bezpieczeństwo, ale usuwa je z normalizowanych eksportów. Silnik zachowuje jawne ziarna starć do przywracania, ponownego rozpoczęcia i odtwarzania regresji. Nie usuwa to ziaren świata Experience, które mają inne zastosowanie.
