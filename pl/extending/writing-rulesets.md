# Pisanie zestawów zasad Game Mode

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakie kości rzuca test, co znajduje się w arkuszu postaci, jakie zasoby są wydawane i co odnawia odpoczynek. Ten przewodnik jest dla osób chcących napisać i udostępnić własny zestaw. Jeśli chcesz grać z zestawem kogoś innego, zacznij od [Wyboru zasad](../game/getting-started.md#choosing-rules).

Zestaw zasad jest jednym plikiem JSON. Zawiera dane, nie kod. Nic się w nim nie wykonuje, więc import nie może niczego zrobić z twoim komputerem. Przed importem cudzego pliku dokładnie przeczytaj tekst Game Master: trafia do modelu w każdej grze używającej zestawu.

## Najpierw przeczytaj: co zestaw zasad może, a czego nie może

Zestaw może jedynie uzupełniać mechanikę, którą Engine już zna. Obecnie Engine zna dwa sposoby rozstrzygania testu; plik wybiera jeden przez `resolution.kind`:

- **`dice-sum`**: rzuć kośćmi, dodaj liczby z arkusza i osiągnij lub przekrocz trudność. Obejmuje systemy d20, systemy 2d6 plus cecha i wiele innych.
- **`dice-pool`**: rzuć liczbą kości wynikającą z postaci i policz te, które osiągnęły próg. Obejmuje systemy, w których wartość oznacza garść kości zamiast premii.

Oba dokładnie opisuje sekcja [Rodzaje rozstrzygania](#resolution-kinds).

Mechaniki niepasującej do żadnej z tych postaci nie da się zapisać w pliku zestawu. Przykłady to branie najwyższej kości puli, testy procentowe z wynikiem poniżej progu, kości z symbolami i przeciwstawne pule. Każda wymaga nowego rodzaju rozstrzygania w Engine, czyli wkładu w kod z testami, nie pliku JSON. Jeśli twój system go potrzebuje, zgłoś prośbę o funkcję w repozytorium Engine i opisz mechanikę kilkoma w pełni rozpisanymi rzutami. Te przykłady staną się testami.

Game Mode może rozstrzygać walkę według własnych zasad Marinara albo twojego zestawu. Opcjonalny blok `battle` przekazuje walce Marinara liczby z arkuszy postaci: zobacz [Bitwy](#battles-lending-the-sheet-to-marinaras-combat). Opcjonalny `combat` zamiast tego definiuje rozstrzyganie walki według zestawu: zobacz [Walkę](#combat-a-fight-your-own-rules-resolve). Engine już stosuje te zasady. Ustawienie **Combat Preference** (preferowany rodzaj walki) gry wybiera prezentację Classic lub, gdy zestaw definiuje odległość, pole bitwy Tactical.

## Szybki start

1. Skopiuj przykład pasujący do rzutów twojego systemu. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) to niewielki system 2d6 z trzema cechami, pokazujący, że format nie zakłada d20 ani sześciu atrybutów. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) to mała pula kości dziesięciościennych z trzema cechami i sześcioma umiejętnościami zawodowymi. Pełnowymiarowy przykład 5e (SRD 5.1) znajdziesz w [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Zmień `id` na własne. Identyfikator zawiera małe litery, cyfry i pojedyncze łączniki, np. `ember-roads`.
3. Edytuj arkusz, odpoczynki i tekst Game Master.
4. Zaimportuj plik (zobacz [Wypróbowanie zestawu](#trying-your-ruleset)). Import sprawdza cały plik i wskazuje błędy wiersz po wierszu, zanim cokolwiek zapisze.
5. Utwórz nową grę, wybierz zestaw w **Rules** (zasady) i wykonaj kilka testów.

Aby uzyskać pomoc podczas pisania, wskaż edytorowi JSON Schema, dodając tę pierwszą linię wewnątrz zewnętrznych klamer pliku:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

Schemat podczas pisania wyłapuje błędne nazwy kluczy i typy. Nie sprawdza, czy nazwy w pliku wskazują istniejące rzeczy, np. czy umiejętność podaje istniejący atrybut. Robi to import.

Do dowolnego obiektu pliku możesz dodać linię `"$comment": "..."` z własną notatką. Engine ją ignoruje.

## Części pliku

| Klucz | Zawartość |
| --- | --- |
| `schemaVersion` | Zawsze `1`. |
| `id`, `version` | Nazwa zestawu dla Engine i liczba całkowita zwiększana przy każdej publikacji zmian. |
| `name` | To, co gracze widzą w kreatorze konfiguracji. |
| `edition` | Opcjonalne. Jedna linia określająca wydanie lub szkic. |
| `license` | Opcjonalne. Identyfikator SPDX i wymagany przez źródło tekst uznania autorstwa. |
| `coverage` | Zakres zestawu i jednoliniowy opis widoczny w kreatorze. |
| `resolution` | Sposób rzutu testu lub rzutu obronnego. |
| `sheet` | Cała zawartość arkusza postaci. |
| `rests` | Co odnawia i usuwa każdy rodzaj odpoczynku. |
| `gm` | Tekst dla modelu Game Master i wartości arkusza widoczne dla każdej postaci. |
| `catalogs` | Opcjonalne. Gotowe wpisy oferowane przez edytor arkusza, aby gracze nie przepisywali długich list. |
| `battle` | Opcjonalne. Dane, które bitwa może odczytać z arkusza i zapisać po zakończeniu. |
| `combat` | Opcjonalne. Sposób rozstrzygania walki według własnych zasad i to, co pokazuje ekran bitwy. |
| `layers` | Opcjonalne. Warianty zestawu włączane przez gracza przy tworzeniu gry. |

Plik może mieć do 256 KB. Tekst trafiający do promptu (nazwy, etykiety, tekst Game Master) nie może zawierać nowych linii, nawiasów kwadratowych ani podwójnych klamer.

Identyfikatory w arkuszu (atrybutów, umiejętności, pól, pul itd.) zaczynają się literą i zawierają małe litery, cyfry oraz podkreślenia, np. `grit_max`.

<a id="resolution-kinds"></a>

### Rodzaje rozstrzygania

`resolution.kind` wybiera sposób rzutu testu. Oba rodzaje czytają ten sam arkusz postaci i współdzielą trzy klucze, więc zmiana rodzaju nie zmienia części pliku poniżej `resolution`:

- `abilityModifier`: jak wynik w arkuszu staje się liczbą. `identity` oznacza, że wynik jest tą liczbą. `floorHalfMinusTen` to reguła 5e. `stepTable` pozwala podać własne progi jako `[[score, number], ...]`.
- `proficiencyTiers`: poziomy wyszkolenia umiejętności lub rzutu obronnego. Pierwszy dostaje niewymieniona umiejętność. Poziom dodaje `flat`, albo `multiplier` razy premię biegłości, albo oba. Jeśli system ma premię biegłości, wskaż jej źródło przez `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcjonalne, potrzebne tylko poziomowi używającemu mnożnika.

Znaczenie otrzymanej liczby zależy od rodzaju: `dice-sum` dodaje ją do rzutu, `dice-pool` rzuca tyloma kośćmi.

#### `dice-sum`: dodawanie kości

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`: liczba kości i ich ścianek. Sumę porównuje się z trudnością.
- `advantage`: czy Game Master może poprosić o dwa rzuty i zachowanie jednego.
- `naturals`: wpływ najwyższej i najniższej ścianki pojedynczej kości na testy i rzuty obronne: `none`, `both`, `max-only` lub `min-only`. Pomiń dla samej arytmetyki. Wymaga pojedynczej kości, więc system 2d6 musi używać `none`.
- `difficultyLadder`: trudności, spośród których ma wybierać Game Master. `dc` to liczba, którą suma musi osiągnąć.

#### `dice-pool`: rzucanie kości i liczenie wyników

Liczba z arkusza to **wielkość puli**, a nie premia dodawana do niej. Cecha 3 i umiejętność zawodowa warta 2 dają pięć kości. To cała zasada: bez nowego słownika arkusza, bez nowego edytora; system, którego wartości są garściami kości, zapisuje się tymi samymi `abilities`, `skills` i `proficiencyTiers` co każdy inny.

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: liczba ścianek jednej kości puli, od 2 do 100.
- `pool`: zakres, do którego ogranicza się liczbę z arkusza przed eksplozjami. `min` równe 0 pozwala pustej puli przegrać bez rzutu, a `max` może wynosić najwyżej 100.
- `target`: wynik kości wymagany do jej zaliczenia. Ustaw `min` poniżej `max`, aby Game Master mógł zmieniać go dla testu przez `threshold=`; równe trzy wartości ustalają stały próg.
- `double`: opcjonalne. Wynik co najmniej `from` liczy się podwójnie.
- `explode`: opcjonalne. Wynik co najmniej `from` daje dodatkową kość, która także może eksplodować. Dodatkowych kości może być najwyżej `pool.max` ponad samą pulę, więc jeden test rzuca najwyżej dwukrotnością `pool.max`, a niskie `from` nie pozwala rzucać bez końca.
- `cancel`: opcjonalne. Wynik nie większy niż `upTo` odejmuje jeden sukces. Liczba sukcesów nie spada poniżej zera.
- `botch`: opcjonalne. Jeśli **żadna** kość nie dała sukcesu, a pojawił się wynik nie większy niż `upTo`, test jest krytyczną porażką. Pula, której jedyny sukces anulowano, ponosi zwykłą, nie krytyczną porażkę.
- `exceptional`: opcjonalne. Tyle sukcesów netto lub więcej w udanym teście oznacza krytyczny sukces.
- `situationalDice`: opcjonalne. Zakres kości dodawanych lub odejmowanych przez Game Master dla jednego testu przez `bonus=`, np. za wyczyny, rany lub słabe światło.
- `difficultyLadder`: `successes` określa liczbę wymaganych sukcesów. Stopień może też wskazywać `target`, ale tylko gdy próg jest regulowany i w jego zakresie.

Wyniki `cancel` i `botch` muszą być niższe niż najniższy próg, a każdy wynik wskazany przez te reguły musi istnieć na kości. Regułę, która nigdy nie zadziała, odrzuca import, zamiast wykrywać problem podczas gry.

Zestaw z pulą dostarczany jako pakiet wymaga Capability API 1.24. Importowany zestaw społecznościowy sprawdza czytający go Engine, więc dodatkowa deklaracja nie jest potrzebna.

#### Co Game Master może zapisać w teście puli

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` to liczba wymaganych **sukcesów**, nie próg pojedynczej kości. Może wynosić od 1 do maksimum możliwego do zliczenia: maksimum puli, podwojonego przy eksplozjach i ponownie podwojonego przy podwójnych sukcesach.
- `threshold=` zmienia próg pojedynczej kości i jest dostępne tylko, gdy `target.min` jest mniejsze od `target.max`.
- `bonus=` dodaje lub odejmuje kości i jest dostępne tylko przy zadeklarowanym `situationalDice`.
- `with=` wykonuje test umiejętności lub rzut obronny z innym atrybutem. Działa w obu rodzajach, więc zestaw 5e uzyskuje "Strength (Intimidation)" tym samym atrybutem.

Każde pole respektuje deklarację pliku: wartość poza zakresem jest przycinana do bliższego końca, a nieoferowany atrybut jest ignorowany zamiast odrzucać test. Zapis pokazuje rzeczywiście użyte wartości: próg i dodatkowe kości po ograniczeniu oraz `with=` tylko wtedy, gdy atrybut faktycznie podmieniono. Engine zawsze sam rzuca kośćmi. Zastępuje wynik puli napisany przez model, ignoruje `mode="advantage"`, bo ten rodzaj nie ma ułatwienia, i nie używa kości rzuconej przez gracza przed turą.

#### Co jest poza zakresem i dlaczego

Każda z tych mechanik wymaga własnego rodzaju rozstrzygania, bo żadnej nie da się wyrazić liczeniem kości osiągających próg:

- **Najwyższa kość** (jak w Blades in the Dark) wymaga stopnia częściowego sukcesu, którego wynik testu nie ma.
- **Pule postawy porównywane z cechą** (jak w Lasers and Feelings) ustalają "powyżej czy poniżej" osobno dla testu, co jest innym porównaniem.
- **Kości z symbolami** (jak w Genesys) w ogóle nie dają liczb.
- **Pule przeciwstawne** rozstrzygają dwie postacie naraz; test ma jedną rzucającą postać.
- **Rzuty poniżej progu i otwarte testy procentowe** porównują w drugą stronę.
- **Sumowane pule z dziką kością** (jak w OpenD6) sumują kości, traktując jedną szczególnie.

Obie rzeczy wcześniej pomijane przez ten rodzaj są już modelowane; poniższa sekcja Wydawanie zasobów na zmianę rzutu wyjaśnia jak. Własna reguła systemu "wydaj punkt za sukces" to `resolution.spend`, kupujące sukcesy lub kości, nigdy ponowny rzut. Ponowny rzut należy do czegoś wybranego przez postać, więc zapisuje się go jako `mechanics.check` wpisu katalogu i opłaca kosztem tego wpisu.

### Wydawanie zasobów na zmianę rzutu

Niektóre systemy pozwalają graczowi zapłacić za nadchodzący rzut, np. punkt woli za automatyczny sukces. `resolution.spend` opisuje to jako stałą regułę systemu, nie rzecz kupioną przez postać:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` to jedna z `live.pools`. Nie może początkowo być pusta, bo na początku gry nie byłoby czego wydawać.
- `amount` to koszt JEDNEGO zakupu. `successes` i `dice` określają, co daje; zakup musi dawać przynajmniej jedno z nich. Sukcesy dodaje się po zliczeniu kości i anulowaniu, bo nie pochodzą z rzutów. Kości rzuca się razem z pulą, w jej własnym zakresie.
- `perCheck` ogranicza liczbę zakupów jednego testu, więc maksymalna wartość zakupu to `amount * perCheck` punktów. Limit zapobiega kupowaniu pewnego zwycięstwa za pełną pulę.
- Tylko `dice-pool` może mieć tę regułę: sumowany rzut nie ma sukcesów ani puli, do której można dodać kości. `dice-sum` deklarujące `spend` jest odrzucane podczas importu.
- Dwa wpisy nie mogą nazywać tej samej puli, bo test nie mógłby wskazać, o który chodzi.

**Wpisuje się to w sam test.** Game Master pisze `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, nie osobną komendę `[sheet:]`, ponieważ kości rzuca się przed wykonaniem komend arkusza i później nie byłoby już czego zmieniać. Jedno rozstrzygnięcie rzuca kośćmi i płaci za to, co je zmieniło.

### Talizman zmieniający rzut

`resolution.spend` jest regułą systemu. Wpis rzeczywiście WYBRANY przez postać także może zmienić test, przez `mechanics.check` we wpisie katalogu:

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` ponownie rzuca kości z wynikiem nie większym niż `upTo`. `once` podmienia każdą raz i nowy wynik zostaje; `until` kontynuuje. `upTo` musi być niższe od najwyższej ścianki, inaczej cała pula byłaby rzucana bez końca; Engine ogranicza liczbę ponownych rzutów testu niezależnie od pliku.
- `dice` dodaje kości przed rzutem, `successes` dodaje sukcesy po ich zliczeniu, a `threshold` ustala próg pojedynczej kości tego rzutu w zakresie dozwolonym przez `target`.
- Wymagane jest co najmniej jedno z czterech pól; inaczej wpis niczego nie określa i jest odrzucany.
- Obsługuje to wyłącznie `dice-pool`, więc `dice-sum` z `mechanics.check` jest odrzucane przy imporcie.

**Koszt określa własne `cost` wpisu**, płacone dokładnie tym samym mechanizmem co użycie innych rzeczy: pula i jedno użycie każdego licznika zapisanego przez ten wpis. `perCostStep` określa SKALOWANIE; wpis z tym polem kupuje się tyle razy, ile zapłacono cenę, a bez niego jeden raz, niezależnie od zaoferowanej kwoty.

**Game Master nazywa go w teście:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Nie w osobnej komendzie arkusza, z tego samego powodu co wyżej: kości rzuca się przed wszelkimi zapisami stanu.

**Wszystko albo nic.** Jeśli pula nie wystarcza, zakup nie następuje i nic nie jest odejmowane: rzut pozostaje dokładnie taki jak bez zakupu. Punkty niebędące całkowitą wielokrotnością zakupu także nic nie kupują. Żądanie przekraczające `perCheck` jest przycinane, nie odrzucane, i płaci się tylko za limit. Wszystko oblicza Engine; Game Master podaje zadeklarowany przez gracza wydatek i nigdy nie dotyka kości. Zapis pokazuje rzeczywistą opłatę, zastosowany wpis, sukcesy uzyskane bez rzutu i liczbę ponownie rzuconych kości. Talizman niewybrany przez postać lub taki, którego katalogu Engine nie może odczytać, nie robi nic zamiast działać na zaufanie.

### Arkusz

- `sections` grupuje rzeczy w edytorze.
- `abilities` to podstawowe cechy. `skills` i `saves` mogą wskazywać atrybut używany przy rzucie.
- `fields` to pojedyncze wartości. Typy: `number`, `text`, `longtext`, `boolean`, `enum` (stała lista wyborów) i `dice` (tekst taki jak `1d8`).
- Wartości `derived` oblicza się z innych wartości i nie można ich nadpisać ręcznie. Operacje to `sum`, `min`, `max`, `scale` (mnożenie i zaokrąglanie) oraz `stepTable` (wyszukanie w progach, jak poziom wyznaczający premię biegłości).
- `lists` to tabele z własnymi kolumnami, np. ekwipunek, zaklęcia lub zdolności. Lista z `pools` zmienia każdy wiersz w zasób z własnym maksimum, przydatny dla zdolności klasy o ograniczonej liczbie użyć.
- `live` to rzeczy zmieniające się podczas gry: `pools` (punkty życia, komórki zaklęć, Grit), `tracks` (liczba na skali, np. wyczerpanie, lub tor ran z zaznaczanymi polami), `text` (krótkie notatki, np. przedmiot koncentracji) i `conditions`.

Wszystko, co odczytuje liczbę, nazywa ją odwołaniem do wartości: obiektem o dokładnie jednym kluczu `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod` lub `saveMod`. Przykład puli o maksimum będącym wartością pochodną: `"max": { "derived": "grit_max" }`.

`hideWhen` ukrywa pole, listę lub pulę, gdy inne pole ma określoną wartość. Plik 5e ukrywa tak komórki zaklęć u postaci nierzucających zaklęć.

### Tory ran: zdrowie jako tor zamiast liczby

Wiele systemów wcale nie liczy punktów życia. Mają kolumnę pól, każde gorsze od poprzedniego, i zaznacza się jedno po zranieniu. Dodaj `levels` i `kinds` do wpisu `live.tracks`, aby zmienić liczbę na skali w taki tor:

**Jakiej formy potrzebuje twój system?** Pula zapisuje, ILE obrażeń zadano; tor zapisuje, ile ORAZ jakiego rodzaju była każda ich część. Jeśli twój system rozróżnia rany obuchowe, śmiertelne i spotęgowane, a rodzaj pozostaje ważny po ciosie, ponieważ spotęgowane goją się wolniej, nie mogą być pochłaniane albo ostatecznie zabijają, ten rodzaj musi gdzieś przetrwać po rzucie, a przechowuje go tylko znacznik. Pula punktów tego nie potrafi: po odjęciu obrażeń jest tylko mniejszą liczbą, a karta nie pamięta rodzaju poszczególnych punktów. Dlatego `combat.damageKinds` jest odrzucane w zestawie zasad ze zdrowiem jako pulą, zamiast być po cichu ignorowane. Pula nadal może mieć `damageTypes`, a przeciwnik może być na nie odporny lub niewrażliwy, ponieważ to kwestia wielkości otrzymanego ciosu, a nie rodzaju późniejszej rany.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` to 1–16 poziomów, od najlepszego do najgorszego. Każdy ma `label` i całkowity `penalty` nie większy niż 0. Duża ujemna liczba oznacza w takich systemach wyłączenie z działania, więc `-99` jest poprawne.
- `kinds` to 1–6 rodzajów obrażeń przyjmowanych przez tor, każdy z `id`, krótkim `label` pola i `severity`. Stopnie ciężkości muszą być różne; liczby znaczą tylko kolejność, więc odstępy są dowolne.
- Oba występują razem. `kinds` bez `levels` jest odrzucane, bo nie ma czego zaznaczać, a `levels` bez `kinds` – bo znacznik musi mieć rodzaj.
- **Rozróżniaj te słowa.** `kinds` to rodzaje dozwolone przez zestaw. ZNACZNIK to jeden taki rodzaj umieszczony na torze podczas gry. Definicja przechowuje rodzaje; arkusz postaci znaczniki.
- Długość toru wynika z poziomów: `min` to 0, `max` to `levels.length`. Inny zapis jest odrzucany, nie poprawiany po cichu, więc plik nigdy nie przechowuje dwóch sprzecznych długości.

**Dokładne reguły**, bo nieprecyzyjne odczytanie daje niepoprawny tor:

- Znaczniki są posortowane, **najcięższe najpierw**. Tor siedmiu poziomów mieści najwyżej siedem znaczników.
- Znacznik **wstawia się według ciężkości** pomiędzy obecne, nigdy na końcu. Zajmuje najwyższy poziom należny ciężkości i przesuwa lżejsze w dół.
- Działa kara z **najniższego zaznaczonego poziomu**, nie suma zaznaczonych. Trzy znaczniki powyższego toru dają `-3`, nie `0 + -1 + -3`.
- `amount` to liczba znaczników jednego rodzaju **stosowanych pojedynczo**; tor zapełniający się w trakcie podlega tej samej regule co już pełny.
- Zaznaczanie **pełnego** toru **podnosi najlżejszy znacznik o jeden stopień** zamiast dodawać nowy. To jeden stopień własnej skali rodzajów, niezależnie od rodzaju dodawanego znacznika.
- Znacznik przekraczający najwyższą ciężkość pozostaje na maksimum, a niemieszczący się jest liczony jako **nadmiar**. Nadmiar jest zapisywany, więc przeładowanie nie zapomina otrzymanych obrażeń.
- **Leczenie to ta sama komenda z ujemną liczbą.** Usuwa najlżejsze znaczniki najpierw, a nadmiar przed jakimkolwiek znacznikiem.

**Zaznaczanie podczas gry.** Game Master pisze `[sheet: op="damage" track="harm" kind="knock" amount="1"]` i leczy przez ujemne `amount`. Wariant `damage` wskazujący `pool=` nie zmienia się. Zwykła komenda `track` jest odrzucana dla toru ran: sama liczba nie określa nowych znaczników. Gracz może też ręcznie zaznaczać i czyścić pola arkusza, zgodnie z założeniami tych systemów.

**Walka także może zaznaczać tor.** Skieruj `combat.health` na tor zamiast puli. Trafiony cios zaznacza tyle pól, ile mówi `combat.damageKinds.marks`, rodzajem przypisanym przez ten blok typowi obrażeń. Postać z pełnym torem pada, co odczytuje reguła umierania. Leczenie usuwa jeden znacznik. Punkty tymczasowe są odrzucane, bo tor nie ma dla nich bufora. Engine odczytuje tor jako liczbę POZOSTAŁYCH poziomów, więc reszta walki, upadek, przywrócenie, dziennik i podsumowanie nie zmieniają się.

**Odpoczynek może leczyć tor ran.** Krok odnowienia z `"to"` czyści go do podanej liczby znaczników, wraz z nadmiarem; krok z `"by"` usuwa tyle znaczników, zaczynając od nadmiaru. Krok, który DODAŁBY znaczniki, nie robi nic, bo odpoczynek nie określa ich rodzaju.

### Kara do rzutów

`resolution.penaltyFrom` wskazuje tor ran, którego kara dotyczy każdego testu zestawu. Jest deklarowana, nie domyślna: zestaw bez niej rzuca dokładnie tak jak przed wprowadzeniem torów ran.

DZIAŁANIE kary zależy od rodzaju rozstrzygania, tak samo jak znaczenie liczby z arkusza:

- W `dice-pool` **odejmuje kości z puli**, nie poniżej własnego `pool.min`. Przy `pool.min` równym 1 nawet postać na ostatnim poziomie rzuca jedną kością; przy `pool.min` równym 0 nie rzuca żadną i przegrywa bez rzutu.
- W `dice-sum` jest **stałym modyfikatorem rzutu**, włączanym do tej samej liczby co atrybut i wyszkolenie.

Wskazany tor musi być torem ran. Zwykły tor nie ma kary i wskazanie go jest odrzucane podczas importu. Wynik podaje zastosowaną karę, aby gracz rozumiał mniejszą liczbę kości, a blok arkusza dla Game Master pokazuje poziom i jego koszt.

### Odpoczynki

Odpoczynek jest listą kroków odnowienia i rzeczy do wyczyszczenia. Każdy wskazuje jeden cel (`pool`, `poolGroup`, `listPools` lub `track`) i ustawia go (`"to": "max"`, `"to": "min"` albo liczba) lub zmienia (`"by": { "const": 1 }` albo `"by": { "fractionOfMax": 0.5 }`). Krok wskazujący tor ran może go tylko leczyć; zobacz wyżej.

### Tekst Game Master

- `checkGuidance` zastępuje wbudowany akapit mówiący Game Master, jak prosić o test. Podaj system i okoliczności rzutu. Game Master wskazuje tylko umiejętność i trudność. Engine rzuca i oblicza wynik z arkusza, więc nie proś modelu o matematykę.
- `sheetGuidance` wprowadza arkusze postaci do promptu. Wyjaśnij, które zasoby są ważne i kiedy je wydawać.
- `worldGuidance` jest opcjonalne i czytane raz, przy generowaniu świata, aby wymyślone realia pasowały do zasad: brak prochu, rzadka magia, chodzący zmarli. Nigdy nie trafia do tury.
- `sheetSummary` wybiera pola, wartości pochodne i wiersze list widoczne dla Game Master dla każdej postaci. Engine zawsze pokazuje modyfikatory atrybutów, wyszkolone umiejętności i rzuty obronne oraz bieżące wartości. Resztę skróć, bo wysyłana jest w każdej turze.

## Katalogi: gotowe wpisy list arkusza

Wpisywanie zaklęć, ekwipunku lub strony zdolności klasy wiersz po wierszu jest uciążliwe. Katalog to nazwany zbiór gotowych wpisów dostarczany z zestawem. Edytor proponuje je w selektorze każdej zasilanej listy; wybór wypełnia wiersz.

Katalogi są opcjonalne. Zestaw może mieć ich do dwunastu, a Engine nie zna ich tematyki: wszystkie ID, kolumny, filtry i słowa pochodzą z pliku.

### Nagłówek

Nagłówek trafia do `catalogs` na najwyższym poziomie pliku, obok `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` i `label`: ID przestrzega reguł identyfikatorów arkusza; etykieta nazywa selektor.
- `holds`: `"rows"` (domyślnie i we wszystkich katalogach sprzed tego wydania) lub `"creatures"`. Katalog stworzeń jest bestiariuszem czytanym przez walkę: nic nie zapisuje w arkuszu, nie deklaruje `feeds` i nie pojawia się w selektorze. Zobacz [Stworzenia](#creatures-a-bestiary-a-fight-reads) niżej.
- `feeds`: od jednej do ośmiu list arkusza, do których mogą pisać wpisy katalogu. Wymagane dla katalogu wierszy, odrzucane dla stworzeń. Wpis nigdy nie zapisze do niewymienionej listy ani wartości niedozwolonej przez jej kolumny.
- `filters`: opcjonalne, do ośmiu. Pola zawężania listy w selektorze: `number`, wartość `text` lub `tags` (kilka słów). `startFrom` wskazuje pole arkusza ustawiane przy otwarciu, więc postać z Calling równym Tinker widzi najpierw wpisy Tinker.
- `units`: opcjonalne. Znaczenie zasięgu lub wielkości obszaru w bloku `mechanics` wpisu w twoim systemie.

### Wpis

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: małe litery, cyfry i pojedyncze łączniki; unikalne w katalogu.
- `label` i `summary`: to, co pokazuje selektor. Podsumowanie jest opcjonalne, jednoliniowe, do 300 znaków.
- `filters`: wartości filtrów nagłówka. Filtr `number` przyjmuje liczbę, `text` jeden tekst, a `tags` listę tekstów.
- `rows`: zapis po wybraniu wpisu, od jednego do sześciu wierszy. `list` należy do `feeds` katalogu, a kluczami `values` są ID kolumn tej listy.
- `creature`: przeciwnik zamiast wierszy, w katalogu, którego `holds` wskazuje stworzenia. Wpis ma dokładnie jedno z `rows` lub `creature`; stworzenie nie ma `mechanics`, bo opisuje działanie we własnych akcjach.

Każda wartość jest sprawdzana według kolumn docelowej listy, więc błędna nazwa kolumny lub liczba poza zakresem jest zgłaszana z wpisem źródłowym. Wpisy wewnątrz pliku zestawu sprawdza się przy wczytywaniu, czyli podczas importu pliku. Osobny plik katalogu pakietu sprawdza się przy pierwszym żądaniu selektora; błędny plik pokazuje tam przyczyny zamiast wpisów.

### Jeden wpis, kilka list

Zdolność z ograniczonymi użyciami to dwa wiersze arkusza: sama zdolność i jej licznik. Nadal wybiera się ją raz.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

### Wartości aktualizowane przez zestaw

Po wyborze liczby wiersza należą do gracza. Przydatny wyjątek to maksimum podążające za postacią, np. użycia równe atrybutowi lub zasób klasy rosnący z poziomem. Wiersz może nazwać do czterech własnych kolumn liczbowych w mapie `scaled`, a edytor utrzymuje ich poprawność.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- Klucz jest jedną z kolumn `number` listy.
- `from` to zwykłe odwołanie do wartości, z tego samego zamkniętego słownika co wszędzie. Bardziej złożone obliczenie jest wartością `derived` deklarowaną przez arkusz, do której odwołuje się `from` (`"from": { "derived": "lay_on_hands_max" }`). Nie dochodzi nowa arytmetyka.
- `table` jest opcjonalne. Pozwala wyszukać wartość odwołania w tabeli progów, np. uzyskać liczbę z poziomu: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` nadal musi zawierać zwykłą liczbę kolumny; jej brak odrzuca wiersz. To wartość przed poznaniem arkusza i zachowywana przez arkusz bez wskazanego odwołania.
- Wiersz z `scaled` musi być jedynym wierszem wpisu dla tej listy, aby oznaczony wiersz arkusza zawsze pasował do jednej specyfikacji.

Wartość oblicza się przy edycji arkusza, nigdy przy odczycie, więc zapisany wiersz zawsze zawiera podaną liczbę. Wynik dopasowuje się do kolumny: przycina do `min` i `max` oraz zaokrągla w dół dla liczb całkowitych. W przykładzie Heart 3 daje trzy użycia, a Heart 0 lub mniej – zero. Wiersz pozostaje w arkuszu z 0 użyć; licznik o maksimum 0 nie jest pulą, więc w grze nie ma czego wydać.

Skalowane kolumny w pakiecie wymagają Capability API 1.23. Importowany zestaw społecznościowy sprawdza czytający go Engine, więc nie potrzebuje dodatkowej deklaracji.

### Wybrane wiersze są kopiami

Każdy wybrany wiersz jest kopiowany do arkusza z dodatkowym kluczem `_catalog`, zawierającym `<catalog id>/<entry id>`. ID kolumn zawsze zaczynają się literą, więc ten klucz nie może być twoją kolumną.

Kopia należy do postaci. Gracz może później edytować wszystko, arkusz działa bez zainstalowanego zestawu, a publikacja nowej wersji nigdy nie przepisuje cudzej postaci. Znacznik pozwala selektorowi pokazać posiadane wpisy i jest czytany przez opisane niżej odświeżanie.

### Odświeżanie z zestawu zasad

Ponieważ wybrany wiersz zachowuje znacznik, edytor karty może powiadomić gracza, że twój nowszy tekst różni się od zawartości wiersza. Krótka informacja pod listą podaje liczbę wierszy z nowszym tekstem, a przycisk **Review** (przejrzyj) pokazuje je, zestawiając zawartość karty z treścią zestawu zasad i udostępniając pole wyboru przy każdym wierszu. Zapis następuje dopiero po kliknięciu **Update selected** (aktualizuj wybrane); obejmuje wyłącznie różniące się kolumny w zaznaczonych wierszach. Reszta wiersza, w tym znacznik, pozostaje bez zmian.

Zakres porównania jest celowo wąski:

- Istniejące wartości są porównywane tylko w kolumnach `text`, `longtext`, `dice` i `enum`. Wartości `number` i `boolean` należą do gracza i są zachowywane, również 0 i false. Kolumnę, której wiersz jeszcze nie zawiera, można zaproponować z wartością odpowiedniego typu, także liczbą lub przełącznikiem. Kolumny skalowane są wyłączone, ponieważ już podążają za kartą.
- Tylko kolumny ustawiane przez twój wpis. Kolumna pominięta we wpisie nigdy nie jest zmieniana, niezależnie od zawartości karty.
- Wartość, której sama kolumna by nie przyjęła, np. nieoferowana już wartość `enum` albo tekst przekraczający `maxLength`, jest pomijana zamiast zapisywana.
- Wiersz jest dopasowywany do źródłowego wiersza wpisu według pozycji wśród wierszy tej listy z tym samym znacznikiem, o ile karta nadal ma ich tyle, ile zapisuje wpis. W przeciwnym razie dopasowanie działa tylko wtedy, gdy wpis zapisuje pojedynczy wiersz w tej liście. Jeżeli gracz usunął jeden z dwóch wierszy wpisu, wpis pozostaje bez zmian, bez zgadywania.
- Wiersz, którego wpisu nie ma już w katalogu, pozostaje bez zmian i bez powiadomienia.

Zmiana sformułowania lub nazwy wpisu może więc dotrzeć do postaci, które już go wybrały, jeśli zaakceptują aktualizację. Zmiana znaczenia liczby nie może i nie będzie tak działać: gdy wiersz należy do gracza, ta kolumna również należy do niego.

### `mechanics`: liczbowe działanie wpisu

Wpis może zawierać opcjonalny blok `mechanics`, który opisuje jego działanie liczbowo: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (kości, np. `2d6`, lub stała liczba), `damageType`, `attackRoll`, `autoHit`, `save` (jeden z rzutów obronnych karty i skutek sukcesu), `applies` (nakładane stany), `temporary` (punkty tymczasowe puli zdrowia), `scales` (wielkość rosnąca wraz z kartą), `cost` (pula zużywana przy użyciu), `perCostStep`, `budget` (zużywana część ekonomii akcji), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` i `check`.

Selektor pokazuje ten blok w jednym wierszu. To, kto odczytuje resztę, zależy od bloku włączonego przez zestaw zasad:

- Z [blokiem `combat`](#combat-a-fight-your-own-rules-resolve) walka odczytuje efekty bojowe. `range`, `area` i `friendlyFire` działają na polu bitwy z pozycjami; `reaction` oznacza wpis odpowiadający na coś i dopóki wpis nie może wskazać oczekiwanego wyzwalacza, tak oznaczonego wpisu nie ma w żadnym menu. `check` dotyczy testów umiejętności opisanych wyżej.
- Tylko z [blokiem `battle`](#battles-lending-the-sheet-to-marinaras-combat) bitwa odczytuje `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` i `cost`, ponieważ własny system walki Marinara ma zastosowanie właśnie dla tych części.

Słownik jest zamknięty: klucz lub wartość spoza powyższej listy jest odrzucana, zamiast być po cichu ignorowana.

`cost` określa też koszt płacony poza bitwą przez polecenie `use` Mistrza Gry, opisane w następnej sekcji.

### Polecenie `use`: Mistrz Gry płaci zdefiniowaną przez ciebie cenę

Podczas narracji Mistrz Gry aktualizuje każdą kartę poleceniami `[sheet: ...]`: `spend`, `restore` (`heal` oznacza to samo), `damage`, `temp`, `track`, `condition`, `note` i `rest`. Zestaw zasad dostarczający katalogi otrzymuje jeszcze jedno:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` oznacza to samo co `op="use"`, a `spell=` to samo co `name=`, więc sformułowanie wybrane przez Mistrza Gry działa, choć format nie musi znać słowa „zaklęcie”.

Nazwa jest dopasowywana bez uwzględniania wielkości liter do wierszy karty tej postaci pochodzących z jednego z twoich katalogów. Wiersz odpowiada na nazwę pokazaną Mistrzowi Gry (kolumna nazwy `sheetSummary` tej listy, następnie jej `pools.nameColumn`, następnie pierwsza kolumna tekstowa) oraz na `label` źródłowego wpisu, więc gracz nadal ma do niego dostęp po zmianie nazwy wiersza. Nazwa bez dopasowania i nazwa pasująca do dwóch różnych wpisów są odrzucane.

Co zużywa:

- Każdy składnik `mechanics.cost` wpisu. Składnik wskazujący pulę bieżącą pobiera z niej koszt; składnik wskazujący GRUPĘ pul pobiera go z pierwszej puli tej grupy, w kolejności deklaracji, która może go pokryć. Nie przechodzi automatycznie do wyższej puli, ponieważ grupa nie zawsze jest drabiną.
- Dodatkowo jeden punkt z każdej puli w wierszu listy zapisanej przez ten sam wpis, np. licznika użyć zdolności. To drugi wiersz powyższego wpisu `Last Ember`. Licznik o maksimum 0 nie ma użyć do wydania, więc polecenie jest odrzucane, zamiast wykonywać się za darmo.

`pool=` oznacza użycie na wyższym poziomie: ta sama pojedyncza cena, płacona z innej puli tej samej grupy. Jest akceptowane tylko wtedy, gdy koszt ma dokładnie jeden składnik, a wskazana pula należy do grupy tego składnika. Wszystko inne jest odrzucane zamiast reinterpretowane.

Wszystko albo nic. Jeśli którejkolwiek części nie można opłacić, całe polecenie zostaje odrzucone, nic się nie zmienia, a gracz otrzymuje informację. Wpis bez jakiegokolwiek kosztu, np. sztuczka lub pasywna zdolność, jest akceptowany i niczego nie zmienia.

### Wewnątrz definicji lub we własnym pliku

Mały katalog umieszcza się bezpośrednio w `ruleset.json`, w `entries` nagłówka. Długi katalog ma własny plik wskazany w nagłówku przez `asset`. Katalog ma dokładnie jedną z tych dwóch form.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Ścieżka ma zawsze postać `catalogs/<the catalog's id>.json`. Sam plik wygląda tak:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Osobne pliki katalogów służą pakietom publikowanym przez oficjalny katalog: pakiet wymienia plik w `contributions.assets.paths` obok `ruleset.json` i wymaga Capability API 1.21. Katalog stworzeń, wewnętrzny lub osobny, wymaga Capability API 1.27. **Zestaw zasad importowany jako pojedynczy plik lub udostępniany przez repozytorium GitHub zawiera katalogi wewnątrz definicji**, więc muszą mieścić się w limicie 256 KB całego pliku zestawu zasad. To wystarcza na kilkaset krótkich wpisów.

Limity to 12 katalogów na zestaw zasad, 2000 wpisów na katalog w obu formach i 1 MB na osobny plik katalogu.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Bitwy: udostępnienie karty systemowi walki Marinara

Domyślnie bitwa nic nie wie o karcie. Tworzy walczących tak jak dotychczas, a postać może wyjść z walki z niezmienionymi punktami wytrzymałości na karcie.

Opcjonalny blok `battle` zmienia to tylko w jednym kierunku: udostępnia walce liczby z karty i zapisuje jej wynik z powrotem. **Nie sprawia, że walka stosuje twoje zasady.** Matematyka kości nadal należy do Marinara, podobnie jak ustalanie, kto kogo trafia i za ile. Dlatego zdrowie jest przenoszone jako ułamek maksimum, a nie twoja własna liczba: postać z połową zdrowia na karcie zaczyna walkę z połową paska zdrowia utworzonego dla niej przez Marinara. Twoja 9-punktowa pula zdrowia nigdy nie trafia bezpośrednio do walki, w której jeden cios zadaje 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: wymagane. Bieżąca pula stanowiąca punkty wytrzymałości postaci w walce. Musi należeć do pul w `sheet.live.pools`, a nie być listą, której wiersze są pulami.
- `energy`: opcjonalne. Bieżąca pula zużywana przez walkę, stająca się paskiem MP. Musi być inna niż `health`, ponieważ walka nie może zużywać punktów wytrzymałości jako paliwa.
- `slots`: opcjonalne. Bieżące pule zużywane przez walkę po jednym punkcie, każda z `level` od 1 do 9: `[{ "pool": "slots_1", "level": 1 }]`. Każdy poziom i każda pula mogą wystąpić tylko raz.
- `skills`: opcjonalne, do ośmiu. Listy karty, których wiersze stają się umiejętnościami bojowymi postaci. Liczą się tylko wiersze z twoich katalogów i tylko wtedy, gdy ich wpis źródłowy ma blok `mechanics`: wiersz wpisany ręcznie nie opisuje działania liczbowego. `onlyWhen` wskazuje kolumnę logiczną, która musi być włączona w wierszu, np. przygotowane zaklęcie. `alwaysWhen` wskazuje kolumnę i wartość przepuszczającą wiersz mimo tego warunku, np. zaklęcia rzucane bez przygotowania. Jest wyjątkiem od `onlyWhen`, więc bez niego jest odrzucane.

### Co trafia do walki i co wraca na kartę

**Do walki**, dla każdego członka drużyny, którego kartę ma gra: udział puli zdrowia w jej maksimum ustala początkowy stan własnego paska zdrowia Marinara, pula energii staje się MP, każda pula komórek staje się komórkami danego poziomu, a oznaczone wiersze stają się umiejętnościami. Maksymalne punkty wytrzymałości, atak, obrona, szybkość i poziom pozostają własnymi liczbami Marinara. Postać z zerem w puli zdrowia zaczyna walkę powalona, ponieważ tak mówi karta, a postać z wartością dodatnią nigdy nie zaczyna poniżej jednego punktu wytrzymałości, więc zaokrąglenie małego ułamka nie może nikogo znokautować.

**Na kartę**, po zakończeniu walki: końcowy udział zdrowia walczącego jest przeliczany na skalę jego puli zdrowia, a różnica wobec początku walki jest stosowana jako obrażenia lub leczenie. Energia i komórki są licznikami, nie ułamkami, więc zapisuje się je bez przeliczania. Wszystko podlega tym samym zasadom co przyciski karty; zmiana odrzucona przez kartę jest pomijana i zgłaszana, zamiast wymuszana. Walka, która nie zmieniła punktów wytrzymałości walczącego, nie zapisuje żadnej zmiany zdrowia, więc same dwa przeliczenia nie mogą zmienić karty.

**W żadną stronę**: rzuty ataku, rzuty obronne, koncentracja i dodatkowe efekty wyższego kosztu. Są w bloku `mechanics`, by kiedyś odczytał je właściwy system walki; ten pomost ich nie stosuje i zestaw zasad nie powinien twierdzić inaczej.

Porzucona bitwa niczego nie zapisuje. Jeżeli usuniesz wiadomość rozpoczynającą walkę lub walka nie dojdzie do końca, karta pozostaje dokładnie taka jak wcześniej: walka nie miała miejsca.

### Jak wpis staje się umiejętnością

Blok `mechanics` wpisu katalogu jest odczytywany następująco:

- `kind` staje się typem umiejętności. Wpisy `utility` i wszystko oznaczone jako `reaction` są pomijane, ponieważ system walki Marinara nie ma dla nich miejsca.
- `amount` ustala siłę efektu jako mnożnik własnego ataku walczącego, a nie liczbę obrażeń. Większe kości nigdy nie dają słabszego efektu, a mnożnik pozostaje w zakresie już używanym przez generowane umiejętności.
- `range` i `area.size` są dzielone przez `units.distance.perCell` katalogu, by uzyskać pola siatki, i nigdy nie są zaokrąglane do zera. Wybuch staje się swoim promieniem, stożek połową tej wartości, a linia jednym polem. Wszystko z obszarem obejmuje każdego znajdującego się w nim wroga; `friendlyFire` jest respektowane.
- `damageType` staje się żywiołem umiejętności. `targets` nie jest przenoszone: system walki Marinara ustala dozwolone cele leczenia, wzmocnienia lub ataku na podstawie typu umiejętności.
- `cost` puli energii staje się kosztem MP, a kilka kosztów energii jest sumowanych. `cost` dokładnie jednej komórki zużywa jedną komórkę tego poziomu. System walki Marinara pobiera jedną ilość energii albo jedną komórkę, nigdy oba naraz, więc wpis kosztujący dwie komórki, komórki dwóch poziomów lub komórkę i energię nie trafia do walki. Tak samo koszt z dowolnej innej puli, np. punktów wytrzymałości lub zasobu klasowego, ponieważ inaczej Engine udostępniałby go za darmo.
- `buff` lub `debuff` staje się własnym wzmocnieniem lub osłabieniem Marinara. Inne obietnice tekstu wpisu, np. usunięcie stanu z karty, nie są wykonywane w walce. Nie dodawaj `mechanics` do wpisu, którego efekt ma sens wyłącznie poza bitwą.

`coverage.combat` jest osobne i nadal oznacza to samo: ustawiaj je tylko wtedy, gdy bitwy rzeczywiście stosują zasady twojego systemu.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Walka: starcie rozstrzygane przez twoje własne zasady

Powyższy blok `battle` udostępnia walce liczby z karty, pozostawiając matematykę Marinara. Opcjonalny blok `combat` służy do czegoś innego: określa, jak twoje zasady ROZSTRZYGAJĄ walkę. Parametryzuje należący do Engine rodzaj walki, tak jak `resolution` parametryzuje rodzaj testu; wszystkie nazwy w nim należą do ciebie. Obecnie istnieje jeden rodzaj.

**Gra, której zestaw zasad deklaruje `combat`, prowadzi walki według twojego bloku.** Liczby drużyny są odczytywane z jej własnych kart, przeciwnicy pochodzą z twojego bestiariusza lub skali zagrożenia, każdą turę rozstrzygają twoje kości, a wszystkie wydatki i straty postaci są natychmiast zapisywane na jej karcie, więc zamknięcie zakładki w trakcie walki niczego nie gubi. Ekran bitwy używa twoich słów: twoje ataki i zdolności w menu, twoje budżety, twoje stany i dziennik z rzeczywistymi obliczeniami. To, czego jeszcze nie robi, opisano w sekcji „Jeszcze niedostępne”.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

To cały blok Ember Roads, według którego walczy gra używająca Ember Roads. Szkic 5e używa tych samych kluczy dla systemu d20:

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### Wszystkie klucze

- `kind`: `"attack-vs-defense"`. Jedna strona rzuca kośćmi przeciw obronie drugiej; trafienie zadaje obrażenia.
- `health`: wymagane. To, co zabiera walka. Albo `{ "pool": "grit" }`, bieżąca pula pomniejszana liczbowo, której bufor tymczasowy, jeśli istnieje, pochłania obrażenia jako pierwszy; albo `{ "track": "harm" }`, tor ran, który jest ZAZNACZANY. Tor wymaga obok `damageKinds` i nie przyznaje punktów tymczasowych.
- `defense`: wymagane, odwołanie do wartości. Pole wypełniane przez gracza albo obliczana przez ciebie wartość pochodna.
- `initiative`: wymagane. Kości rzucane raz na początku i opcjonalne odwołanie do modyfikatora. Remis wygrywa wyższy modyfikator, następnie kolejność tworzenia uczestników walki.
- `attackRoll`: wymagane. Kości, informacja, czy system rzuca dwa razy i zachowuje jeden wynik (`advantage`), działanie skrajnych ścian pojedynczej kości (`naturals.max`: `critical`, `hit` lub `none`; `naturals.min`: `miss` lub `none`) oraz wpływ trafienia krytycznego na obrażenia (`critical`: `double-dice` ponownie rzuca kośćmi obrażeń, `max-dice` dodaje raz ich najwyższe wyniki, `none` oznacza zwykłe trafienie). Szczególne wyniki naturalne wymagają jednej kości, dokładnie jak przy testach. Rzuty obronne w walce używają tych samych kości.
- `economy`: wymagane. `budgets` określa dostępne elementy tury: identyfikator, etykietę, `per` (`turn` uzupełnia na początku własnej tury posiadacza, `round` na początku nowej rundy) i `count`. PIERWSZY zadeklarowany budżet jest główny i zużywa go akcja standardowa. `movement` to opcjonalne odwołanie do wartości: odległość ruchu w jednej turze, we własnej jednostce odległości. Odczytuje ją walka na planszy (zob. Pozycje).
- `attacks`: opcjonalne. Listy karty, których wiersze są bronią. `name` to kolumna tekstowa nadająca wierszowi nazwę, `damage.dice` to kolumna kości, a każde z `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` i `damage.type` wskazuje kolumnę tej samej listy. Kolumna `ability` to `enum` zawierające identyfikator jednej z twoich cech; inna wartość niczego nie dodaje. Kolumna `proficiency` to `boolean`; gdy jest włączona, dodaje premię z biegłości. Wiersz bez czytelnych kości nie jest atakiem, więc lina na tej samej liście pozostaje liną. `strikes` to opcjonalne odwołanie do wartości określające, ile uderzeń kupuje JEDNO zużycie budżetu listy: wybranie wiersza bez uderzeń w zapasie zużywa budżet i daje pozostałe uderzenia, a dopóki zapas istnieje, każdy wiersz deklarujący `strikes` nie kosztuje budżetu. Dzięki temu menu samo pozwala zmienić broń, cel i przejść między nimi. `strikesCappedBy` wskazuje kolumnę logiczną ograniczającą JEJ WŁASNY wiersz do jednego uderzenia, niezależnie od liczby kupowanej przez listę, dla broni strzelającej raz na turę bez względu na liczbę ataków właściciela: powstała dla właściwości Loading z SRD 5.1. Na liście kupującej i tak jedno uderzenie jest bez znaczenia i jest odrzucana. Zapas uderzeń należy do WALCZĄCEGO, nie do jednej listy: postać z dwiema listami broni deklarującymi `strikes` korzysta z tego samego zapasu niezależnie od użytego wiersza. Jest on zerowany na końcu tury, w której go kupiono. Lista bez deklaracji kupuje jedno uderzenie za zużycie budżetu, jak każda walka przed wprowadzeniem tej funkcji.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcjonalne. Listy karty, których wiersze oznaczone katalogiem są zdolnościami, filtrowane przez `onlyWhen` i `alwaysWhen` tak samo jak `battle.skills`. Działanie każdej określa `mechanics` jej wpisu; blok wskazuje domyślny `budget`, dodawane `toHit` dla wpisu z rzutem na trafienie oraz `saveDifficulty`, przeciwko któremu wykonuje się rzut obronny wpisu. Wpis wymagający rzutu obronnego, własnego lub kończącego nakładany stan, jest odrzucany, jeśli lista docelowa nie ma `saveDifficulty`: rzut przeciwko niczemu zawsze byłby udany.
- `standard`: opcjonalne, z zamkniętej listy `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (ataki przeciw unikającemu rzuca się dwa razy i zachowuje gorszy wynik) i `help` (następny atak wspieranego sojusznika rzuca się dwa razy i zachowuje lepszy wynik) są zawsze rozstrzygane. `dash` (ponowny przydział tego samego ruchu) i `disengage` (nikt nie uderza cię za odejście w tej turze) są rozstrzygane na planszy, a poza nią odnotowywane. `hide` i `ready` są akceptowane, ale jeszcze nic nie robią.
- `standardEffects`: opcjonalne, dla części akcji standardowej niewyrażonej jej flagą. Obecnie tylko `dodge` ma taki efekt: `{ "dodge": { "saves": ["dex_save"] } }` określa, które twoje rzuty obronne unikający wykonuje dwa razy z zachowaniem lepszego wyniku przez czas trwania uniku. Wskazuj tylko rzuty zadeklarowane na karcie i tylko gdy lista `standard` zawiera `dodge`. Pominięcie zachowuje dotychczasowe działanie uniku: trudniej trafić i nic więcej.
- `conditions`: opcjonalne. Mapuje TWOJE identyfikatory stanów na ich działanie, dzięki czemu stany karty i walki są jednym zapisem, a zatruta postać pozostaje zatruta po walce. Efekty tworzą zamkniętą listę: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` i `cannot-approach-source`. `failsSaves` wskazuje rzuty obronne automatycznie nieudane w tym stanie. Sześć efektów wymagających odległości lub ruchu (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) odczytuje walka na planszy; poza nią nie działają (zob. Pozycje). `cannot-react` wyklucza posiadacza z okna otwieranego przez ruch, więc nie jest pytany. Obok efektów są trzy dodatkowe klucze:
  - `saves`: których rzutów obronnych dotyczą dwa efekty rzutów obronnych. Pominięcie oznacza wszystkie; podanie bez jednego z tych dwóch efektów jest odrzucane.
  - `whileSourceInSight`: co działa tylko wtedy, gdy osoba nakładająca stan znajduje się w polu widzenia posiadacza. `true` uzależnia cały stan; lista jego własnych efektów uzależnia tylko je, pozostawiając resztę. Tego wymaga strach zabraniający zbliżenia niezależnie od widoczności źródła. Wskazanie efektu nieobecnego w stanie jest odrzucane. Bez planszy nie ma linii widzenia do przerwania, więc wszystko działa w obu przypadkach.
  - `endsWhenSourceDown`: stan znika natychmiast po powaleniu osoby, która go nałożyła.

`own-saves-advantage` i jego przeciwieństwo rzucają obronę dwa razy z zachowaniem jednego wyniku, dokładnie jak atak, i wzajemnie się znoszą. `resist-all` zmniejsza o połowę każdy rodzaj obrażeń, oprócz działania własnej ochrony celu, i tak samo znosi się z podatnością. `cannot-target-source` zabrania posiadaczowi kierowania czegokolwiek na osobę, która nałożyła stan, a `cannot-approach-source` zabrania zbliżenia się do niej bardziej niż z obecnego pola, także na trasie: obejście do równie odległego pola jest nadal oferowane, ale trasa przechodząca bliżej i wychodząca po drugiej stronie już nie.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: opcjonalne. Bieżące pole `text` zapisujące podtrzymywany efekt, `save` wymuszany obrażeniami, dolna granica trudności `floor` i `fromDamage`, czyli część otrzymanych obrażeń wyznaczająca trudność, gdy jest wyższa. Uruchomienie drugiej zdolności wymagającej koncentracji kończy pierwszą; nieudany rzut obronny kończy ją wraz z podtrzymywanymi stanami.
- `dying`: opcjonalne, `kind: "saves"`. Dwa tory liczące rzuty (wymaganą liczbę określa maksimum każdego toru), `dice`, `succeedAt`, działanie skrajnych wyników (`naturals.max`: `revive-1` lub `success`; `naturals.min`: `one-failure` lub `two-failures`), koszt obrażeń po powaleniu (`damageWhileDown`, `criticalWhileDown`) oraz `condition` powalonej postaci. Bez tego bloku postać z zerem jest po prostu powalona, a leczenie przywraca ją do walki.
- `damageTypes`: opcjonalne. Typy twojego systemu, dopasowywane bez uwzględniania wielkości liter.
- `damageKinds`: wymagane, gdy `health` wskazuje tor ran, a odrzucane, gdy wskazuje pulę, ponieważ tylko znacznik przechowuje rodzaj, a pula punktów nie ma na niego miejsca (zob. Tory ran powyżej). Określa, który z `kinds` toru zaznacza cios i ile pól wypełnia. `default` jest rodzajem dla wszystkiego bez mapowania, w tym ciosu bez typu, a `byType` mapuje twoje `damageTypes` na rodzaje; klucze, jak same typy, są dopasowywane bez wielkości liter, więc `"Fire"` i `"fire"` są jednym kluczem i podanie obu jest odrzucane. `marks` nie ma wartości domyślnej, ponieważ dwie odpowiedzi są przeciwne: `"per-point"`, gdy rzut obrażeń liczy poziomy zdrowia, więc cios za trzy zaznacza trzy pola i warto złagodzić go o jeden; oraz `"per-blow"`, gdy cios albo trafia, albo nie, więc zaznacza jedno pole niezależnie od siły. Cios z kilkoma składnikami obrażeń nadal zaznacza jedno pole, używając najcięższego rodzaju, który trafił. Wskaż, jak działa twój system. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: opcjonalne, wymagane przez bestiariusz. `tiers` to skala wyboru przeciwnika: identyfikator, etykieta, przedział `health`, `defense`, `toHit`, przedział `damagePerRound` i `saveDifficulty`. Każde dostarczane stworzenie wskazuje jeden z tych poziomów, a nienapisany wcześniej przeciwnik zostaje dopasowany do poziomu żądanego przez Mistrza Gry, więc nikt nie wypada poza skalę. Przedział `damagePerRound` oznacza działanie stworzenia na JEDEN cel w rundzie, łącznie z całą sekwencją.

### Co walka odczytuje z `mechanics`

`kind` określa, czy `amount` to obrażenia czy leczenie; wszystko oznaczone `reaction` jest pomijane w menu, podobnie jak wpis `utility`, chyba że zmienia możliwości samej tury (zob. niżej). `attackRoll` wymusza rzut przeciw obronie celu z `toHit` listy; `autoHit` całkowicie go pomija. `save` wykonuje własny rzut obronny celu przeciw `saveDifficulty` listy, a `onSuccess` określa, czy sukces pozostawia połowę, czy nic. `targetCount` określa dozwoloną liczbę celów. Zdolność bez rzutu ataku (obszar, przeciw któremu wszyscy się bronią, lub coś trafiającego automatycznie) rzuca kośćmi RAZ dla wszystkich, a zdolność rzucająca na trafienie każdego celu rzuca obrażenia ponownie przy każdym trafieniu. `applies` nakłada stany na objęte cele, każdy z `duration`: `instant` (bez własnego zegara: trwa, dopóki coś go nie zdejmie), `until-save` (wymaga obok `saveEnds`) lub `{ "rounds": n }`, oraz opcjonalnym `saveEnds` wskazującym rzut obronny i powtarzanie przy `turn-end` lub `turn-start`. `temporary` przyznaje tymczasowe punkty puli zdrowia; nie kumulują się – pozostaje większy bufor. `scales` zwiększa wielkość o dodatkowe KOŚCI z tabeli dla odczytanej wartości. `cost` jest płacony przez własne polecenie `use` karty, a `budget` zastępuje domyślną część ekonomii akcji.

`plus` to do trzech DODATKOWYCH wielkości tego samego ciosu, obok `amount`, każda z osobnym rzutem i typem („and 2d6 fire”). Składnik ma postać `{ "dice": "2d6", "flat": 1, "type": "fire" }` i może mieć własny `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, który CEL wykonuje niezależnie od pozostałych wymagań akcji: `none` usuwa cały ten składnik przy sukcesie, `half` pozostawia połowę, a reszta ciosu pozostaje niezmieniona. Bez `difficulty` używa liczby własnego rzutu obronnego akcji, a następnie `saveDifficulty` listy. Trafienie krytyczne podwaja kości każdego składnika według tej samej zasady co pierwszą wielkość; składnik bez `type` ma własny rodzaj obrażeń ciosu, a cały cios nadal oznacza JEDEN test koncentracji z sumą obrażeń i jeden test powalenia. Składnik wymaga bazowego `amount`; `heal` nie może mieć takich składników.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Trzy klucze określają wpływ wpisu na ekonomię samej tury; wpis `utility` deklarujący którykolwiek z nich jest oferowany zamiast pomijany:

- `free`: nie zużywa żadnego budżetu. Nadal płaci wskazany `cost` i nie może jednocześnie wskazywać `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, do czterech. W chwili użycia zwiększa te budżety, ograniczając ich wynik do pojemności tury powiększonej o przyznany dodatek, więc niczego nie można zachować na późniejszą turę.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Posiadacz może wykonywać te akcje standardowe za TEN budżet. Są oferowane obok zwykłych jako `standard:<id>@<budget>`, a sam wpis nie pojawia się w menu, gdy jest wyłącznie tym uprawnieniem, ponieważ uprawnienia się nie wykonuje.

Wpis nowego rodzaju `kind: "rider"` jest PASYWNY: nikt go nie wykonuje, nigdy nie ma go w menu i automatycznie dodaje kolejny składnik obrażeń do pierwszego kwalifikującego się trafienia w danym okresie. Zawiera `rider` i nic innego, co można wykonywać:

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` wskazuje listy ataków, z których pochodzi, a `requires` jedną kolumnę ich wierszy o wartości prawdziwej, więc dodatkowy efekt działający tylko z niektórymi broniami określa je bez znajomości pojęcia broni przez Engine; pominięcie obu oznacza każde trafienie posiadacza. `when` oznacza DOWOLNY z warunków: `advantage` to ostateczna przewaga rzutu ataku, a `ally-adjacent` to stojący sojusznik atakującego zdolny do działania, oddalony od celu o najwyżej jedno pole na planszy lub znajdujący się gdziekolwiek bez planszy. `oncePer` to `turn` (odnawia się na początku każdej tury, więc uderzenie podczas cudzego działania również może go otrzymać) albo `round`. `amount` rośnie zgodnie z własnym `scales` wpisu, a `type` określa rodzaj obrażeń, domyślnie taki jak ciosu.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Stworzenia: bestiariusz odczytywany przez walkę

Katalog deklarujący `"holds": "creatures"` zawiera przeciwników zamiast wierszy karty. Nie zasila żadnej listy, selektor edytora karty nigdy go nie oferuje, a wszystkie liczby są zapisane w kluczach już zadeklarowanych przez blok `combat`. Wymaga bloku `combat` i skali `threat`, ponieważ stworzenie należy do jednego z twoich poziomów.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Poniższe liczby to prosty sposób zapisania stworzenia. Stworzenie zapisane we własnych pojęciach zestawu zasad, jako `sheet`, pobiera zamiast tego `health`, `defense`, `initiativeModifier`, `speed`, `abilities` i `saves` z tej karty (zob. „Stworzenie zapisane we własnych pojęciach zestawu zasad” poniżej).

- `health`: liczba lub `{ "dice": "3d6", "flat": 2 }` rzucane raz przy tworzeniu walki. Prognoza odczytuje średnią, więc menu nigdy nie obiecuje wyniku kości, której nikt nie rzucił.
- `defense`, `initiativeModifier`, `speed`: wartość, przeciw której wykonuje się atak, dodatek do inicjatywy i odległość ruchu w turze we własnej jednostce odległości.
- `abilities` i `saves`: klucze odpowiadają identyfikatorom cech i rzutów obronnych zadeklarowanych na karcie. Niewskazany rzut obronny ma wartość zero.
- `resist`, `vulnerable`, `immune`: typy obrażeń, dopasowywane bez wielkości liter i sprawdzane względem `combat.damageTypes`, jeśli jakieś deklarujesz. `conditionImmunities` wskazuje twoje własne stany.
- `tier`: szczebel `combat.threat`, do którego należy stworzenie.
- `traits`: krótkie pary nazwy i tekstu pokazywane Mistrzowi Gry. Nigdy nie są rozstrzygane, więc wszystko zawierające liczby należy do akcji.
- `signaturePoints`: punkty zwracane na początku własnej tury, wydawane na akcje `signature`.
- `riders`: do czterech, to samo co `rider` wpisu katalogu, zapisane w bloku. Każdy ma postać `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, z opcjonalnym `type` i opcjonalnym `actions` wskazującym własne akcje bloku, przy których działa. Dodatkowy efekt bloku nie odczytuje list karty, więc nie ma dwóch kluczy: `sources` i `requires`. Stworzenie zapisane jako karta otrzymuje efekty dodatkowe ze swoich list, dokładnie jak postać.
- `actions`: do dwunastu, każda z własnym `id`. Akcja zawiera to, co ręcznie napisany blok statystyk (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), oraz cztery rzeczy dostępne tylko stworzeniom. `reach` określa zasięg uderzenia, `range` zasięg rzutu lub strzału, a `area` kształt obszaru działania, wszystko we własnej jednostce odległości; `range` może być zwykłą liczbą albo `{ "normal": 30, "long": 120 }`, gdy dalszy zasięg wiąże się z karą, a `area` ma postać `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (zob. Pozycje):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Po wyczerpaniu użyć akcja znika z menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Na początku walki jest dostępna, użycie ją zużywa, a na początku własnej tury stworzenia wykonuje rzut: `from` lub więcej przywraca ją. Dziennik zapisuje kości w obu przypadkach.
  - `sequence`: inne akcje tego samego bloku, po kolei, każda z własnym celem. **Tak zapisuje się stworzenie uderzające dwa razy w jednej akcji.** Jeden budżet opłaca całą sekwencję. Sekwencja nie ma własnego efektu i nigdy nie może wskazywać kolejnej sekwencji.
  - `signature`: `{ "cost": n }`, opłacane własnymi punktami stworzenia zamiast budżetu i dostępne tylko podczas działania kogoś innego: walka oferuje je w oknie między turami (zob. Okna).
- Rzut obronny wymaga trudności na samej akcji: `save.difficulty` dla rzutu wymuszanego przez akcję lub `saveDifficulty` dla stanu kończonego rzutem obronnym, gdy akcja nie ma własnego rzutu. Akcja bloku jest zapisywana zwykłymi liczbami nawet u stworzenia z kartą, więc liczba należy do akcji. Własny rzut obronny składnika może pominąć `difficulty` i skorzystać z tej samej liczby.
- `damage.plus` to ta sama lista składników co `plus` wpisu katalogu, odczytywana identycznie: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` to ugryzienie z osobną ilością obrażeń od żaru, osobno redukowaną przez odporność i osobno podwajaną.

Bestiariusz szkicu 5e zawiera pięć ręcznie napisanych stworzeń w `docs/development/ruleset-5e-2014.example.json`, obejmujących sekwencję, odnowienie, rzut obronny ze stanem, odporności i niewrażliwości, ograniczone użycia, punkty akcji specjalnych i jedno stworzenie zapisane jako karta.

#### Stworzenie zapisane we własnych pojęciach zestawu zasad

Nie musisz zapisywać stworzenia zwykłymi liczbami. Nadaj mu zamiast tego `sheet` o dokładnie takim kształcie jak karta postaci, a walka zbuduje je jak członka drużyny: zdrowie, obrona, rzuty obronne, inicjatywa, szybkość oraz każdy atak i zdolność z list wynikają z twoich własnych formuł karty. Tak zestaw zasad określa, że przeciwnicy mają te same cechy, umiejętności i listy co postacie, niezależnie od tego, czym są. Toll Warden z Ember Roads:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Każda część jest opcjonalna**: `abilities`, `skills`, `saves`, `bonuses`, `fields` i `lists`, z kluczami będącymi identyfikatorami zadeklarowanymi na karcie. Wszystko pominięte przyjmuje własną wartość domyślną karty, dokładnie jak na pustej karcie postaci. Grit strażnika wynosi 9, ponieważ `grit_max` dodaje 4, jego Toughness i Brawn; Guard wynosi 7 z podobnego powodu.
- **Każda liczba ma jedno źródło.** Stworzenie z kartą nie podaje jednocześnie `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ani `saves`; jeśli to zrobi, Engine odrzuca plik. Może nie mieć żadnych własnych `actions`, ponieważ jego działania wynikają z list. Stworzenie bez karty nadal podaje pierwsze trzy wartości i co najmniej jedną akcję.
- **Jest sprawdzane jak autorskie dane, którymi jest.** Każdy identyfikator musi być zadeklarowany na karcie, umiejętność lub rzut obronny musi należeć do oferowanych dla niego poziomów biegłości, pole, wynik, premia lub kolumna muszą zawierać deklarowany typ wartości (liczbę całkowitą w zakresie, jedną z dopuszczalnych wartości itd.), a lista nie może przekraczać limitu wierszy. Nie ma części `live`, ponieważ wydatki stworzenia przechowuje walka.
- **Wiersz może pochodzić z katalogu.** `_catalog: "<catalog>/<entry>"` wskazuje wpis, z którego wybrano wiersz, tak jak na karcie postaci; tam walka odczytuje koszt i działanie wiersza. Katalog musi zasilać tę listę. Jeśli jest zapisany wewnątrz definicji, musi zawierać wpis; jeśli ma osobny plik, wiersz wskazujący nieobecny w nim wpis po prostu niczego stworzeniu nie daje. Katalogi wskazywane przez karty bestiariusza są ładowane do walki razem z bestiariuszem.
- **Informacje wpisu obok karty nadal się liczą**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` i `conditionImmunities`.
- **Płaci z własnych pul.** Zaczynają pełne, wydaje je na działania z list i otrzymuje droższe warianty płacenia (zaklęcie z wyższej komórki) dokładnie jak członek drużyny, niezależnie od tego, czy decyduje Engine czy Mistrz Gry. Hold the Line strażnika kosztuje go Luck.
- **Przy torze ran jego zdrowiem jest tor.** Cios zaznacza własny tor stworzenia według `damageKinds`, po uwzględnieniu jego `resist`, `vulnerable` i `immune`, więc stworzenie niewrażliwe na dany rodzaj obrażeń nie otrzymuje od niego znacznika.
- **Nadal jest przeciwnikiem.** Przy zerze wypada z walki zamiast umierać, nigdy nie wykonuje rzutów przeciw śmierci, ekran pokazuje to samo co zawsze dla przeciwnika i nic z jego karty, a jego wydatki nie są nigdzie zapisywane z powrotem, nawet gdy postać ma to samo imię.
- **Karta nie dająca żadnego zdrowia** jest pomijana w walce; dziennik początkowy podaje powód, zamiast wpuszczać kogoś, kogo nie można zranić.
- Warstwa usuwająca wartość z jednego z pól wyliczeniowych nigdy nie odbiera stworzenia, które jej używa: gdy warstwa jest aktywna, pole przyjmuje dla stworzenia wartość domyślną, dokładnie jak u postaci, i stworzenie nie jest z tego powodu odrzucane.
- Mistrz Gry też może takie wymyślić; zostaje ograniczone do swojego poziomu (zob. Przeciwnicy, których nikt nie napisał).
- Pakiet dostarczający takie stworzenie deklaruje Capability API 1.34.

Toll Sergeant ze szkicu 5e robi to samo na karcie d20: jego Klasa Pancerza, punkty wytrzymałości, rzuty obronne i dwa zamachy na akcję wynikają z własnych pól i listy ataków.

#### Przeciwnicy, których nikt nie napisał

Gdy Mistrz Gry wymyśla przeciwnika, Engine dopasowuje propozycję do skali `threat` przed jakimkolwiek rzutem: zdrowie do przedziału poziomu, obronę, premię trafienia i trudności rzutów obronnych do najwyżej dwóch powyżej wartości poziomu, a obrażenia zmniejsza, aż najlepsza runda stworzenia (najsilniejsza sekwencja lub pojedyncza akcja, mierzona wobec jednego celu) mieści się w `damagePerRound` poziomu. Najpierw zmniejsza liczbę kości, potem stały składnik, następnie uderzenie z sekwencji, a dopiero potem rozmiar kości; nigdy nie zmniejsza niczego do zera. Nieistniejące w zestawie zasad nazwy są usuwane: nieznane typy obrażeń, stany i rzuty obronne oraz wszystko poza pierwszymi sześcioma akcjami. Niezadeklarowany poziom wraca do najniższego szczebla skali. Każda zmiana wraca jako zwykłe zdanie, by dziennik mógł opisać działanie.

Wymyślone stworzenie też można zapisać jako `sheet`, tak samo jak stworzenie bestiariusza; tak wymyślony mag otrzymuje komórki i zaklęcia. Mistrz Gry widzi identyfikatory karty i dozwoloną zawartość każdego, listy odczytywane przez walkę oraz nazwy oferowane dla nich przez katalogi, więc wskazuje zaklęcie nazwą zamiast opisem: wiersz wskazujący wpis katalogu, niezależnie od wielkości liter, staje się tym wpisem, a własne wartości Mistrza Gry (np. przygotowanie zaklęcia) są nakładane na wierzch. Kartę odczytuje się tolerancyjnie, ponieważ napisał ją model: nieznana nazwa jest usuwana, wartość dopasowywana do pola lub kolumny, a liczby zapisane obok karty nie są używane.

Wymyślone stworzenie niebędące bossem jest ograniczone do tego, co otwiera przed nim zestaw zasad. Filtr katalogu z `startFrom` wskazuje pole karty porządkujące wpisy (lista zaklęć pakietu 5e według `class`), a stworzenie zachowuje tylko wpisy, których filtr pasuje do jego własnej wartości tego pola, według dopasowania otwierającego selektor. Czarownik nie ma więc całej listy zaklęć, a stworzenie bez klasy nie otrzymuje nic z katalogu uporządkowanego według klasy. Pozostawione wybory są następnie uzupełniane bez ponownego pytania Mistrza Gry: dla każdej listy, której wiersze liczą się dopiero po wybraniu (`onlyWhen` źródła zdolności bojowych), spośród dostępnych i możliwych do opłacenia z własnych pul wpisów uzupełnia się dla każdej puli niewielką liczbę wpisów (więcej dla bardziej kompetentnego stworzenia), podobnie jak działania dostępne dowolnie. Dobór zależy od temperamentu i kompetencji, tych samych co w walce: stworzenie opiekuńcze lub wspierające sięga po to, co wspomaga jego stronę, lekkomyślne po obrażenia, metodyczne lub cierpliwe po ograniczanie wroga; im większa kompetencja, tym większa szansa na reakcję, kontrę lub coś innego zmieniającego turę. Losowanie używa ziarna samej walki, więc ta sama walka zawsze uzupełnia tak samo. Wiersz wskazany przez Mistrza Gry z takiej listy liczy się jako wybrany.

Bossa Mistrz Gry opisuje w całości, jako dopuszczalny wyjątek: nic nie jest odbierane ani uzupełniane.

Następnie oba warianty są ograniczane do swojego poziomu:

- Zdrowie trafia do przedziału poziomu przez jedyne pole, z którego jest odczytywane: maksimum puli jest tym polem albo `sum` zawierającym dokładnie jedno pole (maksimum punktów wytrzymałości w 5e, Toughness w Ember Roads). Formuła zdrowia bez takiego pojedynczego pola pozostaje zapisana bez zmian, a dziennik o tym informuje. Długość toru ran należy do ciebie i nigdy się nie zmienia.
- Po utworzeniu stworzenia obrona, premia trafienia i trudności rzutów obronnych są ograniczane do wartości poziomu plus dwa, a obrażenia zmniejszane, aż najlepsza runda mieści się w `damagePerRound` poziomu, z uwzględnieniem największej możliwej do opłacenia ceny. Najpierw ustępuje to, co kupuje droższy wariant, potem kości, stały składnik, uderzenie i dopiero na końcu rozmiar kości.

Twój własny bestiariusz nigdy nie jest ograniczany. To napisane przez ciebie dane, więc Engine przyjmuje je w zapisanej postaci.

### Pozycje: walka na planszy

Walka jest teatrem wyobraźni, dopóki blok nie określi wartości jednego pola planszy. Zadeklaruj `distance`, by można było walczyć na siatce; wtedy ruch, zasięg, obszary, linia widzenia, osłona i uderzenia w odchodzących nabierają znaczenia. Każda z tych wartości jest twoją liczbą; Engine dostarcza wyłącznie planszę.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads deklaruje jedną linię i nic więcej – właśnie o to chodzi: reszta nie jest wymagana.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**Pole.** `distance.perCell` określa, ile TWOICH jednostek odpowiada polu, a `label` jest nazwą jednostki. Używa jej każda odległość w świecie bloku: `economy.movement`, `speed` stworzenia, `reach` i `range` broni oraz `reach` i `range` akcji stworzenia. Katalog z własnym `units.distance` przelicza własne `mechanics.range` i `area.size` swoim `perCell`; katalog bez niego używa tej definicji. Dodatnia odległość jest zaokrąglana do najbliższego pola i nigdy do zera, więc wszystko z podaną liczbą sięga co najmniej jednego. Zero nie jest krótką odległością, lecz zachowuje własne znaczenie: `mechanics.range` równe 0 oznacza siebie lub dotyk (a dotyk innej osoby sięga sąsiedniego pola), zaś 0 w kolumnie `reach` lub `range` broni oznacza brak tego rodzaju zasięgu w wierszu.

**Czy walka odbywa się na planszy.** Dwa warunki muszą być spełnione: blok deklaruje `distance`, a gra gracza używa stylu walki Tactical. W stylu Classic lub zestawie zasad bez `distance` walka pozostaje teatrem wyobraźni jak dotychczas: każdy może celować w każdego i nic poniżej nie jest odczytywane.

**Co widzi gracz.** Plansza jest rysowana z terenem stylu taktycznego. Każde pole jest przyciskiem dostępnym wskaźnikiem lub strzałkami i opisuje, czym jest, kto na nim stoi oraz co oznacza dla niego częściowo dokonywany wybór. Ruch podświetla pola oferowane przez menu, każde z kosztem W TWOJEJ JEDNOSTCE, rysuje trasę i oznacza bursztynowo każde pole, którego trasa wywołałaby uderzenie, podając napastników pod planszą. Opcja wymagająca celu jednocześnie podświetla dozwolone osoby na planszy i liście. Opcja z `area` jest kierowana na pole, a pole pod wskaźnikiem wskazuje objęte osoby, w tym sojuszników. Pozostały ruch jest pokazywany obok budżetów, ponownie w twojej jednostce. Ekran niczego z tego nie mierzy: każde pole, koszt, trasa, cel i punkt celowania przychodzą z serwera.

**Ruch.** Przydział na turę to `economy.movement` członka drużyny albo własne `speed` stworzenia, podzielone przez `perCell` i zaokrąglone W DÓŁ, zawsze co najmniej jedno pole, jeśli ruch jest w ogóle możliwy. Odnawia się na początku własnej tury posiadacza i można go wydawać przed akcjami, między nimi i po nich: ruch, uderzenie, kolejny ruch. Wejście na pole kosztuje jeden lub więcej na trudnym terenie. Osiem kierunków kosztuje tyle samo, ponieważ tak gra się na siatkach stołowych, dla których powstał ten system. Można przejść przez sojusznika, ale nie zatrzymać się na nikim; przeciwnik jest ścianą; nie można wejść w stałą przeszkodę ani ściąć narożnika między dwoma zablokowanymi polami.

**Zasięg wręcz i dystansowy.** Wiersz broni pobiera je z `combat.attacks[].reach` i `.range`, każde z kolumny tej samej listy lub tej samej liczby dla wszystkich wierszy:

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Kolumna o wartości 0 oznacza brak danego rodzaju zasięgu w wierszu, dzięki czemu zwykły miecz może być na jednej liście z toporem do rzucania. Wiersz zupełnie bez zasięgu wręcz sięga jednego pola. Akcja stworzenia używa własnego `reach` lub `range`, a zdolność katalogu – `mechanics.range` (0 oznacza siebie lub dotyk, czyli jedno pole przy wskazaniu innej osoby).

Wiersz z OBU zasięgami jest bronią rzucaną: w zasięgu wręcz jest zamachem, dalej strzałem. Poniższe zasady strzału nie dotyczą więc broni trzymanej w dłoni, można też uderzyć nią przechodzącego przeciwnika, czego nie da się zrobić łukiem.

Akcja stworzenia może też zawierać swój `area`, we własnej jednostce: `{ "shape": "cone",
"size": 15 }`, z `"friendlyFire": false` chroniącym własną stronę. Dzięki temu broń oddechowa jest rzeczywistym stożkiem na planszy, a nie liczbą celów. Sekwencja nie ma własnego kształtu; mają go wskazywane akcje. Walka bez planszy ignoruje kształt i używa `targetCount`, więc wpis stworzenia może podać oba i pozostać zgodny z prawdą w obu trybach.

**Jak daleko można posłać obszar.** Określa to `range`: kula rzucana na sto stóp ma tę wartość. Bez zasięgu wybuch następuje tam, gdzie go umieszczono, na własnym polu wykonawcy, a stożek lub linię można skierować na dowolne pole w obrębie rysowanej długości, ponieważ pole określa tu tylko kierunek. Dotyczy to zarówno `mechanics.area` wpisu katalogu, jak i stworzenia.

`ranged` określa koszt strzału ponad zwykłą odległość `normal` lub przy przeciwniku na sąsiednim polu. Każdy wariant to `"disadvantage"` albo `"normal"`; pominięcie bloku usuwa oba koszty. Zamach nigdy nie jest strzałem, więc nie dotyczą go żadne z tych zasad, podobnie jak broni rzucanej użytej w zasięgu wręcz.

**Obszary.** `mechanics.area` wpisu staje się rzeczywistym kształtem na planszy, kierowanym na pole, a nie osobę; `targetCount` go nie dotyczy: to kształt określa liczbę objętych osób. Obejmuje wszystkich na polach, przyjaciół i wrogów, chyba że wpis podaje `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Wybuch obejmuje każde pole w odległości jego rozmiaru od wskazanego pola. Stożek biegnie od wykonawcy w kierunku tego pola, na każdym kroku szeroki tak samo jak odległy. Linia biegnie tak samo, z szerokością jednego pola. Wszystkie trzy zatrzymują się na stałych przeszkodach.

**Linia widzenia i osłona.** Prosta linia pól między uczestnikami: każda stała przeszkoda blokuje strzał i rozchodzenie się obszaru za nią, a celu po prostu nie ma w menu. Teren stanowiący osłonę dodaje `cover.bonus` do obrony, przeciw której wykonuje się atak; dziennik to odnotowuje. Nie ma osłony trzech czwartych, pełnej osłony ani wysokości.

**Uderzenia w odchodzących.** Zadeklaruj `opportunity.budget`; gdy walczący wychodzi z zasięgu stojącego wroga, który może działać, ma ten budżet i coś do uderzenia wręcz, ruch ZATRZYMUJE SIĘ w bieżącym miejscu, a wróg otrzymuje pytanie o uderzenie. Przyjęcie zużywa budżet i rozstrzyga ten sam atak dokładnie jak we własnej turze; przepuszczenie nic nie kosztuje. Potem ruch wznawia się z miejsca zatrzymania, płacąc za każde rzeczywiście przebyte pole, a uderzenie powalające poruszającego się kończy ruch tam, gdzie upadł. Każdy ma jedną okazję na cały ruch, niezależnie od liczby wyjść trasy z tego samego zasięgu. `disengage` zapobiega temu przez resztę tury; zestaw zasad bez `opportunity` nie ma żadnej z tych mechanik.

Pytanie jest OKNEM i zatrzymuje całą walkę: nic nie rusza, dopóki wszyscy pytani nie odpowiedzą. Za członka drużyny odpowiada gracz, wybierając uderzenie lub sąsiednie Pass; za pozostałych odpowiada ich prowadzący, a za bossa Mistrza Gry – jego własna decyzja. Zob. Okna poniżej.

**Co przeciwnik robi z planszą.** Przeciwnik nieprowadzony przez nikogo ocenia każde osiągalne pole względem każdej dostępnej z niego opcji, odejmuje wartość za każde uderzenie wywołane ruchem i woli pozostać w miejscu, jeśli już może wykonać najlepszą akcję. Gdy nic nie jest w zasięgu, skraca dystans; najpierw sprintem, jeśli lista `standard` zawiera `dash`.

**Możliwe odmowy.** `out-of-reach` (poza zasięgiem), `no-line-of-sight` (stała przeszkoda na drodze), `unreachable` (pole, którego ruch nie może opłacić lub na którym nie może się zakończyć) i `bad-cell` (obszar skierowany w niedozwolone miejsce).

### Co walka robi z twoim blokiem na serwerze

Gra, której zestaw zasad deklaruje `combat`, otrzymuje walkę rozstrzyganą przez ten blok, w tym samym zapisanym obiekcie bitwy, którego Engine używał dotychczas:

- **Kto uczestniczy.** Mistrz Gry wskazuje walczących; Engine odczytuje liczby każdego członka drużyny z jego własnej karty. Członek bez karty dla twojego zestawu zasad jest odrzucany imiennie, zamiast otrzymać liczby, których nie napisałeś.
- **Skąd pochodzą liczby przeciwnika**, w tej kolejności: stworzenie wskazane przez Mistrza Gry w bestiariuszu, następnie stworzenie o etykiecie pasującej do imienia przeciwnika, potem blok statystyk zaproponowany przez Mistrza Gry dla tej walki i ograniczony do skali zagrożenia, a na końcu zwykłe stworzenie zbudowane z liczb poziomu. Każdy wariant zastępczy i każde ograniczenie jest zapisywane zwykłymi słowami, by walka mogła wyjaśnić działanie. Zestaw zasad bez wpisu bestiariusza, propozycji i skali zagrożenia odrzuca walkę zamiast ją wymyślać.
- **Karty są zapisem stanu.** Zdrowie, pule, stany, koncentracja i liczniki zasad umierania są zapisywane przez własne reguły karty po każdej zaakceptowanej akcji, więc ponowne wczytanie w trakcie walki pokazuje dokładnie jej ostatni stan; nie ma końcowego rozliczenia bitwy, które mogłoby się z nim nie zgadzać.
- **Menu określa jedyne dozwolone działania.** Każdy działający, gracz lub przeciwnik, wybiera identyfikator z tego samego menu generowanego przez blok. Przeciwnik prowadzony przez Engine wybiera z niego według własnej taktyki Engine, a przeciwnik prowadzony przez Mistrza Gry otrzymuje prośbę o wybór jednego identyfikatora z tego samego menu, z twoimi liczbami i bez ujawniania wyników kości.
- **Twoje kości.** Walka przechowuje własne ziarno i kursor, więc po odczycie z dysku kontynuuje z kośćmi, którymi i tak by rzuciła.

### Na ekranie

Walka odbywa się na ekranie bitwy w twoich słowach. Menu zawiera twoje ataki, zdolności i wymienione akcje standardowe; każda wskazuje koszt z twoich budżetów i pul. Widać kolejność tur, rundę, każdy nazwany stan z pozostałymi rundami, punkty tymczasowe, koncentrację i dwa liczniki zasad umierania. Dziennik pokazuje rzeczywiste obliczenia w twoich pojęciach: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Każda zaakceptowana akcja jest natychmiast zapisywana na karcie, więc ponowne wczytanie w trakcie walki jest dokładne, a Mistrz Gry otrzymuje później informację, by nie zmieniać tych liczb ponownie.

Walka z pozycjami jest rysowana na planszy zamiast na scenie z portretami; działania gracza opisuje sekcja Pozycje. Każda odległość na planszy, w menu i dzienniku jest podawana w TWOJEJ jednostce: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Okna: wstrzymywanie walki

Niektóre chwile należą do kogoś innego niż bieżący wykonawca. Engine pozostawia dla niego walkę otwartą, zamiast decydować za niego; ta pauza jest oknem.

Otwierają je cztery sytuacje, z których dwie wynikają z już zadeklarowanych danych:

- **Ktoś odchodzi.** Ruch wychodzący z zasięgu wroga zdolnego do uderzenia zatrzymuje się na tym kroku i pyta wroga. Zob. Uderzenia w odchodzących powyżej.
- **Między turami.** Po zakończeniu tury, zanim zacznie się następna, każdy przeciwnik z `signaturePoints`, którego stać na własną akcję `signature`, jest pytany o jej zakup. Można je kupować tylko wtedy: akcji specjalnej nie ma w menu niczyjej tury, także własnej.
- **Coś zostaje w kogoś wycelowane.** Przed rozstrzygnięciem pytana jest każda osoba z DRUGIEJ strony, w którą wycelowano i która ma wpis oczekujący takiej chwili. Leczący sojusznik nie stanowi zagrożenia wymagającego odpowiedzi, więc jego akcja nie otwiera okna.
- **Coś kogoś zraniło.** Po rozstrzygnięciu pytana jest każda zraniona osoba mająca wpis oczekujący TEJ chwili, niezależnie od sprawcy. Otrzymanie obrażeń jest faktem dotyczącym ciebie; wpis kierowany z powrotem na sprawcę nadal nie może być skierowany na sojusznika.

Dwie ostatnie sytuacje wpis katalogu może zamówić, wskazując oczekiwaną chwilę.

Działanie okna, niezależnie od przyczyny otwarcia:

- **Gdy jest otwarte, nic innego nie rusza.** Ani wykonawca bieżącej tury, ani jej zakończenie, ani inne okno. Walka czeka.
- **Pyta po jednej osobie**, w kolejności tur, każdą raz. Pasowanie zawsze jest odpowiedzią i nic nie kosztuje. Osoba bez dostępnego działania jest pomijana zamiast pytana.
- **Wznawia dokładnie od miejsca zatrzymania.** Ruch kończy się na pozostałych polach, płacąc za każde rzeczywiście przebyte.
- **Odpowiada ten, kto prowadzi.** Okno własnego członka drużyny należy do ciebie, z opcją i sąsiednim Pass w menu; za przeciwnika odpowiada prowadzący, a o bossa Mistrza Gry pytany jest Mistrz Gry, z możliwością przepuszczenia chwili jako jedną z odpowiedzi.
- **Jest zapisywane razem z walką.** Gra zamknięta w trakcie ruchu wraca z tymi samymi osobami do zapytania i polami do przejścia.

Dla pierwszych dwóch niczego dodatkowo nie deklarujesz: zestaw zasad z `opportunity.budget` otrzymuje jedno, bestiariusz z `signaturePoints` drugie, a zestaw bez obu nigdy ich nie widzi.

**Wskazanie chwili oczekiwanej przez wpis.** Zapisz `mechanics.reaction` jako obiekt zamiast `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` to `aimed` albo `harmed` i umieszcza wpis w menu tego okna. Tylko te dwie chwile Engine obserwuje. Wpis nadal podający `"reaction": true` mówi jedynie, że nie wykonuje się go w turze; to za mało, by gdziekolwiek go zaoferować, więc nie pojawia się w żadnym menu.
- `at` to `source` (domyślne) albo `chosen`. `source` kieruje wykonywaną akcję na sprawcę chwili i uzupełnia cel, więc nikt go nie wybiera; `chosen` zachowuje własne cele wpisu i pyta o wybór.
- `cancels` całkowicie zatrzymuje wydarzenie wstrzymane przez okno. Może je podać tylko wpis `aimed`: nie można odwołać tego, co już się wydarzyło.

Nadaj też `budget`, inaczej zostanie wydany domyślny budżet listy. Reakcja niemal zawsze zużywa własny budżet, który uniemożliwia kilka reakcji w jednej turze.

**Koszt jest wydawany, zanim ktokolwiek zostanie zapytany.** Anulowana akcja nie dochodzi do skutku, ale została już kupiona: budżet i pule są już zużyte. Jeśli twój system je zwraca, nie potrafi jeszcze tego zadeklarować.

Pakiet wskazujący chwilę wymaga Capability API 1.33.

### Jeszcze niedostępne

Wprost, ponieważ zestaw zasad nie powinien przypisywać Engine nieistniejących możliwości:

- **Poza prostą planszą**: brak osłony trzech czwartych i pełnej osłony, wysokości, latania nad przeszkodami, przeciskania się, wierzchowców, ruchu przez chwytanie lub pchanie, ukrywania i zaskoczenia; nic nikogo nigdzie nie odpycha.
- **Wpis może oczekiwać tylko dwóch chwil**, `aimed` i `harmed` (zob. Okna powyżej). Te chwile Engine obserwuje w imieniu wpisu; dwa pozostałe okna, odejście i pauza między turami, otwiera sama walka, więc wpis nie może o nie prosić. Nie ma chwili rzutu obronnego, rzucenia zaklęcia jako takiego, śmierci, początku tury ani upadku czegokolwiek.
- **Bez łańcucha okien.** Walka przechowuje jedno okno zamiast stosu, więc nic wewnątrz okna nie otwiera kolejnego: kontry nie można skontrować, a obrażenia reakcji nie otwierają następnej chwili.
- **Reakcja coś zatrzymuje albo wykonuje; nie może zmienić liczby danego działania.** Nie ma sposobu wyrażenia „trudniej trafić do następnej tury”, ponieważ stan jest nazwą z zamkniętej listy, a nie modyfikatorem. To ograniczenie stanów, nie reakcji.
- **Nie ma zwrotów.** Koszt anulowanej akcji pozostaje wydany.
- Stany robią tylko to, co potrafi wyrazić zamknięta lista efektów. Stan dający utrudnienie TESTÓW cech albo pogarszający się stopniowo jak wyczerpanie jest dziś zwykłym zapisem na karcie.
- **Stworzenie zapisane zwykłymi liczbami nie ma toru ran.** W zestawie zasad ze zdrowiem jako torem takie stworzenie nadal traci punkty; nadaj mu `sheet`, by ciosy zaznaczały pola po wcześniejszym uwzględnieniu jego `resist`, `vulnerable` i `immune`.
- **Efekt dodatkowy uruchamia się sam.** `on` ma jedną wartość, `hit`, więc otrzymuje go pierwsze kwalifikujące trafienie okresu; nie ma chwili, w której pojawia się pytanie, czy go zużyć.

## Warstwy: warianty twojego zestawu zasad

Warstwa to nazwany wariant zestawu zasad, włączany przez gracza przy tworzeniu gry: mało magii, ciężka zima, bardziej surowy poziom trudności. Warstwy znajdują się w pliku zestawu zasad, w opcjonalnej tablicy `layers`, więc podróżują z nim i nigdy nie znikają z gry, która ich używała. Kreator pokazuje je jako przełączniki pod zestawem zasad, a wybór pozostaje stały przez cały czas istnienia gry, dokładnie jak sam zestaw.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**Co może robić warstwa.** Lista jest zamknięta; każdy efekt coś zawęża albo dodaje tekst:

- `gm.guidance` jest dopisywane do `gm.checkGuidance`, po twoim tekście i tekście wcześniejszych warstw. `gm.worldGuidance` jest tak samo dopisywane do `gm.worldGuidance`.
- `fields` usuwa wartości z pola **enum**. `removeValues` wskazuje już istniejące wartości; co najmniej jedna musi pozostać, a jeśli `default` pola jest usuwane, warstwa wskazuje w zamian pozostające `default`.
- `difficultyLadder` zastępuje drabinę inną, w formacie twojego rodzaju rozstrzygania: `{label, dc}` dla `dice-sum` i `{label, successes, target?}` dla `dice-pool`. Podlega dokładnie tym samym kontrolom co własna drabina. Gdy kilka aktywnych warstw ją deklaruje, wygrywa ostatnia.
- `catalogs` ukrywa wpisy w selektorze edytora karty. Każda reguła wskazuje jeden z zadeklarowanych `filters` katalogu i dokładnie jedno porównanie: `above` albo `below` dla filtra `number`, `equals` albo `notIn` dla `text` lub `tags`. Wpis, który w ogóle nie ustawia tego filtra, nigdy nie jest ukrywany.

**Czego warstwa nie może robić.** Nie może dodać wartości wyliczenia, pola, umiejętności, puli ani odpoczynku, zmienić rodzaju rozstrzygania, dotknąć bieżącego stanu lub liczb walki ani dodać wywołania modelu. Wartość _dodana_ przez warstwę byłaby nieznana wszystkim innym czytnikom karty, więc wartości mogą jedynie znikać. Wszystko poza tą listą wymaga zmiany samego zestawu zasad albo drugiego zestawu.

**Konflikty.** `conflicts` wskazuje warstwy, których nie można włączyć razem. Wystarczy zadeklarować jedną stronę pary. Kreator wyłącza drugi przełącznik; jeśli zapisany wybór mimo to zawiera obie warstwy, odrzuca zadeklarowaną **później**, więc te same dwa wybory zawsze dają te same zasady.

**Karta już zawierająca usuniętą wartość zachowuje ją.** Nic nie przepisuje postaci. Edytor przestaje jedynie oferować wartość, a postać, która już ją miała, nadal ją pokazuje. Wyłącz warstwę w nowej grze, a wartość znów będzie oferowana. Tak samo działa ukryty wpis katalogu: znika z selektora, a wcześniej wybrany wiersz pozostaje na karcie.

**Limity.** 12 warstw na zestaw zasad i 4000 znaków instrukcji na warstwę, łącznie dla obu tekstów. Pakiet zestawu zasad deklarujący `layers` lub bazowe `gm.worldGuidance` wymaga Capability API 1.25. Importowany zestaw zasad weryfikuje odczytujący go Engine, więc niczego takiego nie potrzebuje.

**Warstwy pisane przez inne osoby** (warstwa małej ilości magii dla cudzego zestawu zasad, dostarczana w osobnym pliku) są późniejszym rozszerzeniem. Obecnie warstwa jest dostarczana wewnątrz zestawu, do którego należy.

<a id="trying-your-ruleset"></a>

## Wypróbowanie zestawu zasad

Zestawy zasad społeczności używają tego samego przełącznika co importowani agenci. Otwórz **Settings** (ustawienia) > **Advanced** (zaawansowane) > **Danger Zone** (strefa niebezpieczna) i upewnij się, że **Allow custom Agent imports** (zezwalaj na import własnych agentów) jest włączone. Import wymaga też dostępu przez localhost lub skonfigurowanego **Admin Access** (dostępu administratora).

1. Otwórz panel **Agents** i wybierz przycisk **Import agents** (importuj agentów; ikona pobierania w rzędzie przycisków u góry panelu).
2. Wybierz **Game Mode ruleset** (zestaw zasad trybu Game) i swój plik JSON.
3. Przeczytaj podgląd. Pokazuje nazwę, wersję, licencję, zakres obsługi zestawu zasad i tekst Mistrza Gry. Wybierz **Import** (importuj).

Twój zestaw zasad pojawi się w sekcji **Rules** (zasady) panelu oraz w wyborze **Rules** kreatora nowych gier. Zestaw importowany z pliku jest zapisywany jako `local/<your id>`, więc nie można pomylić go z oficjalnym zestawem ani z cudzym.

### Zmiana już zaimportowanego zestawu zasad

Zaimportowana wersja nigdy nie jest nadpisywana. Jeśli zmienisz plik i zaimportujesz go ponownie z tym samym `version`, import zostanie odrzucony z prośbą o zwiększenie numeru. To celowe: gra jest związana z dokładną wersją, na której ją utworzono, więc trwająca kampania nigdy nie obudzi się z inną matematyką.

Cykl podczas tworzenia wygląda więc tak: edytuj, zwiększ `version`, importuj, rozpocznij nową grę. Stare wersje pozostają zainstalowane obok nowej, dopóki nie usuniesz zestawu z sekcji **Rules**. Usunięcie zestawu nadal używanego przez grę sprawia, że gra zgłasza jego brak aż do ponownego importu.

Jeśli zmienisz kształt karty (dodasz, usuniesz lub zmienisz nazwy elementów), zwiększ też `sheet.version`. Istniejące karty są odczytywane tolerancyjnie: wartości nieznane nowej karcie zostają zachowane, a brakujące otrzymują wartości domyślne.

## Udostępnianie zestawu zasad

**Jako plik.** Wyślij znajomemu plik JSON. Zaimportuje go tak samo jak ty.

**Z repozytorium GitHub.** Jeśli przechowujesz pracę w publicznym repozytorium GitHub, umieść każdy zestaw zasad w folderze `rulesets` w głównym katalogu repozytorium, po jednym pliku na zestaw:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Użytkownik dodaje twoje repozytorium raz przez listę własnych repozytoriów agentów, przegląda zawartość i może później synchronizować nowe wersje. Lista własnych repozytoriów to zaawansowana funkcja włączana przez osobę prowadzącą serwer za pomocą `ENABLE_CUSTOM_AGENT_REPOS=true`. Zestawy z repozytorium są zapisywane pod nazwą właściciela repozytorium, np. `alice/ember-roads`, więc dwóch autorów może opublikować zestaw `v20` bez kolizji.

Obowiązują dwa limity. Repozytorium może zawierać najwyżej 32 pliki JSON bezpośrednio w `rulesets`; większa liczba powoduje odrzucenie. Konto o nazwie `local` nie może publikować zestawów, ponieważ `local/` jest zarezerwowane dla importów z pliku.

**W oficjalnym katalogu.** Popularny system z jasną licencją może być oferowany wszystkim przez **Download Agents** (pobierz agentów). Wymaga to pull requestu do repozytorium [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Układ można sprawdzić w tamtejszym pakiecie `ruleset-5e-2014`.

## Licencjonowanie

Publikuj tylko tekst zasad, który masz prawo udostępniać. Wiele systemów publikuje dokument referencyjny na otwartej licencji i właśnie z niego można kopiować. Umieść identyfikator licencji oraz wymagany przez nią tekst uznania autorstwa w `license`. Nie kopiuj tekstu z podręczników bez otwartej licencji. Zestaw zasad potrzebuje głównie nazw i liczb, a tekst Mistrza Gry powinien być napisany twoimi słowami.

## Rozwiązywanie problemów

- **Import mówi, że nazwa nie istnieje.** Coś w pliku wskazuje niezadeklarowany identyfikator, np. umiejętność wskazująca usuniętą cechę. Komunikat podaje ścieżkę do wiersza.
- **Import mówi, że wersja jest już zainstalowana z inną zawartością.** Zwiększ `version` i importuj ponownie.
- **Mojego zestawu zasad nie ma w kreatorze.** Sprawdź, czy **Allow custom Agent imports** jest włączone. Gdy jest wyłączone, importowane zestawy nie są dostępne dla nowych gier. Gry już ich używające nadal działają.
- **Gra mówi, że brakuje zestawu zasad.** Dokładna wersja, na której utworzono grę, nie jest zainstalowana. Zaimportuj ponownie tę wersję pliku.
