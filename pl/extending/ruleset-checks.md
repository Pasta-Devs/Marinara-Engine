# Testy zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Jak zestaw zasad wykonuje rzut w teście lub rzucie obronnym: pięć rodzajów rozstrzygania, przedziały wyników, testy rzucane na własny sposób oraz wydawanie zasobów lub talizmany zmieniające rzut.

<a id="resolution-kinds"></a>

## Rodzaje rozstrzygania

`resolution.kind` wybiera sposób rzutu testu. Każdy rodzaj czyta ten sam arkusz postaci i korzysta z tych samych trzech kluczy, więc zmiana rodzaju nie zmienia części pliku poniżej `resolution`:

- `abilityModifier`: jak wynik w arkuszu staje się liczbą. `identity` oznacza, że wynik jest tą liczbą. `floorHalfMinusTen` to reguła 5e. `stepTable` pozwala podać własne progi jako `[[score, number], ...]`.
- `proficiencyTiers`: poziomy wyszkolenia umiejętności lub rzutu obronnego. Pierwszy dostaje niewymieniona umiejętność. Poziom dodaje `flat`, albo `multiplier` razy premię biegłości, albo oba. Jeśli system ma premię biegłości, wskaż jej źródło przez `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcjonalne, potrzebne tylko poziomowi używającemu mnożnika.

Znaczenie otrzymanej liczby zależy od rodzaju: `dice-sum` dodaje ją do rzutu, `dice-pool` i `dice-highest` rzucają tyloma kośćmi. `symbol-pool` trzyma atrybut i wyszkolenie osobno, aby zbudować i ulepszyć kości narracyjne.

### `dice-sum`: dodawanie kości

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
- `dice.faces`: wartość każdej ścianki, od najniższej, gdy ścianki nie oznaczają własnych liczb (Capability API 1.136). Cztery kości Fudge z Fate to `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: karta rzutu pokazuje −, pustą ściankę i + i je sumuje, a prawdopodobieństwa są dokładnie takie jak w Fate. Podaj jedną wartość na każdą ściankę.
- `openEnded`: pojedyncza kość, którą rzuca się dalej (1.136). Wynik równy `high` lub wyższy rzuca się ponownie i dodaje, i znowu, dopóki nowa kość pokazuje `high` lub więcej; wynik równy `low` lub niższy rzuca się ponownie i odejmuje, a ten rzut tak samo ciągnie się dalej przy `high`. Otwarty rzut procentowy z Rolemastera to `{ "high": 96, "low": 5 }` na jednej kości d100. Jeden rzut to najwyżej 20 kości. Naturalne wyniki i przesunięcie przedziałów odczytują pierwszą kość.
- `unmodified`: wyniki pojedynczej kości, które zapis oznacza, gdy wypadną na pierwszej kości (1.136), aby dało się stosować tabele traktujące osobno "niezmodyfikowane 66": `[66, 100]`. Zapis zawiera `unmodified="66"`, karta rzutu to podaje, a instrukcje nakazują modelowi Game Master zastosować to, co mówią o tym zasady.
- `difficultyLadder`: trudności, spośród których ma wybierać Game Master. `dc` to liczba, którą suma musi osiągnąć. Zamiast liczby Game Master może podać nazwę stopnia, np. `difficulty="Hard"`, a Engine odczyta liczbę z tego stopnia.

### `dice-pool`: rzucanie kości i liczenie wyników

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
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: liczba ścianek jednej kości puli, od 2 do 100.
- `pool`: zakres, do którego ogranicza się liczbę z arkusza przed eksplozjami. `min` równe 0 pozwala pustej puli przegrać bez rzutu, a `max` może wynosić najwyżej 100. `abilityPlusAbility: true` pozwala testowi atrybutu wskazać przez `with=` drugi atrybut i rzucić kośćmi za oba, co służy systemom rzucającym dwoma atrybutami naraz; bez tego `with=` nic nie znaczy w teście atrybutu.
- `target`: wynik kości wymagany do jej zaliczenia. Ustaw `min` poniżej `max`, aby Game Master mógł zmieniać go dla testu przez `threshold=`; równe trzy wartości ustalają stały próg.
- `double`: opcjonalne. Wynik co najmniej `from` liczy się podwójnie.
- `explode`: opcjonalne. Wynik co najmniej `from` daje dodatkową kość, która także może eksplodować. Dodatkowych kości może być najwyżej `pool.max` ponad samą pulę, więc jeden test rzuca najwyżej dwukrotnością `pool.max`, a niskie `from` nie pozwala rzucać bez końca.
- Obie reguły mogą mieć `min`: najniższy wynik, do którego test może obniżyć regułę przez `explode="N"` lub `double="N"` w znaczniku albo przez wpis użyty przez postać. Z `min` można pominąć `from`; reguła działa wtedy tylko w teście, który o nią prosi. Specjalizacja, dzięki której dziesiątki dają dodatkową kość w jednej umiejętności, to `"explode": { "min": 10 }`. `from` nie może być niższe niż `min`.
- `cancel`: opcjonalne. Wynik nie większy niż `upTo` odejmuje jeden sukces. Liczba sukcesów nie spada poniżej zera.
- `botch`: opcjonalne. Jeśli **żadna** kość nie dała sukcesu, a pojawił się wynik nie większy niż `upTo`, test jest krytyczną porażką. Pula, której jedyny sukces anulowano, ponosi zwykłą, nie krytyczną porażkę. `"rule": "halfOrMore"` odczytuje to inaczej: wyniki nie większe niż `upTo` na co najmniej połowie kości rzuconych na początku (bez eksplozji) oznaczają krytyczną porażkę, gdy żadna kość nie dała sukcesu, a w przeciwnym razie zostawiają wynik bez zmian i oznaczają go `complication="true"`: obok wyniku coś idzie nie tak. Wartość domyślna to `"noSuccesses"`.
- `exceptional`: opcjonalne. Tyle sukcesów netto lub więcej w udanym teście oznacza krytyczny sukces.
- `situationalDice`: opcjonalne. Zakres kości dodawanych lub odejmowanych przez Game Master dla jednego testu przez `bonus=`, np. za wyczyny, rany lub słabe światło.
- `reroll`: opcjonalne. Ponowne rzuty przyznawane przez system bez żadnej opłaty, do sześciu, każdy z `id`, które Game Master podaje w teście przez `reroll=`. Wyniki nie większe niż `upTo` rzuca się ponownie: `"once"` oznacza, że nowy wynik zostaje, jakikolwiek jest, a `"until"`, że rzuca się nimi, aż wypadnie wyższy wynik. `upTo` wynosi od 1 do liczby o jeden mniejszej niż liczba ścianek kości, ponieważ ponowny rzut każdego wyniku nigdy by się nie skończył, a `until` i tak zatrzymuje się po stu ponownych rzutach w jednym teście. Żaden nie jest wykonywany, jeśli test go nie wskazuje. Jeden test wykonuje jeden ponowny rzut: jeśli wydatek lub wpis użyty przez postać także go kupił, wykonuje się ten, który obejmuje więcej wyników, a przy równym zasięgu `until` ma pierwszeństwo przed `once`.
- `difficultyLadder`: `successes` określa liczbę wymaganych sukcesów. Stopień może też wskazywać `target`, ale tylko gdy próg jest regulowany i w jego zakresie. Z tego progu korzysta test na danym stopniu: gdy Game Master wskazuje stopień przez `difficulty=` albo zapisuje `dc=` wymagane przez dokładnie jeden stopień. Gdy kilka stopni wymaga tej samej liczby sukcesów, samo `dc=` nie określa, o który chodzi, więc próg pozostaje domyślny; podaj nazwę stopnia.

- `target.from`: opcjonalne. Odczytuje próg każdej postaci z jej arkusza, jak Number z Lasers & Feelings, który postać wybiera raz (dowolne odwołanie do wartości: atrybut, pole, wartość pochodna). Jest utrzymywany w zakresie `min`..`max`, a `threshold=` go nie przesuwa, bo ta liczba należy do postaci; próg kupiony przez wpis użyty przez postać nadal działa. `threshold=` w zapisie podaje, jakiego progu użyto.
- `stances`: opcjonalne. Najwyżej sześć, każda z `id`, `label`, `count` (`"below"` lub `"above"`) i obejmowanymi przez nią `skills`. Test jednej z tych umiejętności liczy kości **poniżej** progu albo **powyżej** niego, zamiast kości równych progowi lub wyższych: Lasers & Feelings ma postawę Lasers liczącą poniżej i postawę Feelings liczącą powyżej, a każda umiejętność należy do jednej z nich. Umiejętność może należeć tylko do jednej postawy. Postawy pomijają `explode`, `double`, `cancel` i `botch`, które odczytuje się względem reguły "równe progowi lub wyższe".
- `exact`: opcjonalne. Kość pokazująca dokładnie próg: `label` ją nazywa (`"LASER FEELINGS"`), `text` może opisać jej skutek przy stole, a liczy się ona jako jeden sukces, chyba że `counts` ma wartość `false`. Zapis zawiera `exact="N"`, czyli liczbę takich kości, a karta rzutu pokazuje ją obok wyniku, więc Game Master może dać graczowi wgląd, który ta kość kupuje.

Wyniki `cancel` i `botch` muszą być niższe niż najniższy próg, a każdy wynik wskazany przez te reguły musi istnieć na kości. Regułę, która nigdy nie zadziała, odrzuca import, zamiast wykrywać problem podczas gry.

Zestaw z pulą dostarczany jako pakiet wymaga Capability API 1.24; `min` w `explode` lub `double`, `pool.abilityPlusAbility` i `botch.rule` wymagają 1.37, `reroll` – 1.38, a `target.from`, `stances` i `exact` – 1.137. Importowany zestaw społecznościowy sprawdza czytający go Engine, więc dodatkowa deklaracja nie jest potrzebna.

### Co Game Master może zapisać w teście puli

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` to liczba wymaganych **sukcesów**, nie próg pojedynczej kości. Może wynosić od 1 do maksimum możliwego do zliczenia: maksimum puli, podwojonego przy eksplozjach i ponownie podwojonego przy podwójnych sukcesach.
- `threshold=` zmienia próg pojedynczej kości i jest dostępne tylko, gdy `target.min` jest mniejsze od `target.max`.
- `bonus=` dodaje lub odejmuje kości i jest dostępne tylko przy zadeklarowanym `situationalDice`.
- `with=` wykonuje test umiejętności lub rzut obronny z innym atrybutem. Działa w obu rodzajach, więc zestaw 5e uzyskuje "Strength (Intimidation)" tym samym atrybutem. W teście atrybutu dodaje zamiast tego drugi atrybut, jeśli włączono `pool.abilityPlusAbility`.
- `difficulty=` wskazuje stopień drabiny zamiast `dc=`, w obu rodzajach: jego sukcesy (lub trudność przy sumie) i, przy puli, jego próg. `dc=` zapisane obok nadal decyduje o liczbie, a `threshold=` o progu. Nazwa, której nie ma żaden stopień albo którą dzielą dwa stopnie, jest ignorowana.
- `explode=` i `double=` przesuwają wyniki tych reguł w danym teście i są dostępne tylko wtedy, gdy reguła ma `min`.
- `reroll=` wskazuje jeden z twoich wpisów `reroll` dla danego testu i jest dostępne tylko wtedy, gdy jakieś zadeklarowano. Nazwa, której nie odpowiada żaden z nich, jest ignorowana.

Każde pole respektuje deklarację pliku: wartość poza zakresem jest przycinana do bliższego końca, a nieoferowany atrybut jest ignorowany zamiast odrzucać test. Zapis pokazuje rzeczywiście użyte wartości: trudność i próg jako liczby, dodatkowe kości po ograniczeniu, `with=` tylko wtedy, gdy atrybut faktycznie podmieniono lub dodano, wynik reguły tylko wtedy, gdy test go przesunął, `reroll=` tylko wtedy, gdy wskazany ponowny rzut był tym wykonanym i coś przerzucił, oraz `complication="true"`, gdy reguła krytycznej porażki `halfOrMore` dała komplikację obok wyniku. Engine zawsze sam rzuca kośćmi. Zastępuje wynik puli napisany przez model, ignoruje `mode="advantage"`, bo ten rodzaj nie ma ułatwienia, i nie używa kości rzuconej przez gracza przed turą.

### `dice-highest`: rzucanie kośćmi i odczytywanie najwyższej

Blades in the Dark i Trophy Dark rzucają garścią kości d6 i odczytują tylko najwyższą z nich. Capability API 1.138.

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- Liczba z arkusza to liczba kości, jak w puli, utrzymywana w zakresie `pool` (najwyżej 20). Rany, `adjust`, stany i przedmioty dodają lub odejmują kości.
- `keep`: opcjonalne, od 1 do 3, domyślnie 1. Liczba najwyższych kości, które się sumuje: 1 to Blades, 2 to walki w Trophy Dark.
- `zeroDice`: co robi postać bez kości. `"lowest-of-two"` (domyślnie) rzuca dwiema kośćmi i zachowuje niższą, i nigdy nie daje wyniku krytycznego; `"fail"` oznacza porażkę bez rzutu.
- `critical`: opcjonalne. `count` kości pokazujących najwyższą ściankę (albo `face` lub wyższą) oznacza krytyczny sukces: dwie szóstki w Blades.
- `dark`: opcjonalne, ciemne kości z Trophy Dark. `label`, `max` (od 1 do 10) i `text`. Game Master dodaje je do jednego testu przez `dark="N"`. `outcome` ma domyślnie wartość `"all"`: ciemne kości odczytuje się razem z resztą. Przy `"outcome": "light"` (Capability API **1.149**) o zachowanych kościach, sumie, przedziałach wyników i wynikach krytycznych decydują tylko jasne kości. Brak jasnych kości stosuje `zeroDice` do strony jasnej: rzuć dwiema jasnymi kośćmi i zachowaj niższą albo ponieś porażkę, nadal rzucając ciemnymi kośćmi. Ciemnymi kośćmi rzuca się zawsze i zapisuje się je na końcu; `darkHighest="true"` oznacza, że ciemna kość pokonała każdą jasną kość wynikiem ściśle wyższym (łącznie z zastępczymi jasnymi kośćmi; jeśli nie rzucono żadnej, wygrywa każda ciemna kość). Koszt tego (Ruin) stosuje Game Master. Zadeklarowanie `dark.outcome`, także jako `"all"`, wymaga capabilityApi 1.149.
- `situationalDice`: opcjonalne, kości, które Game Master może dodać lub odjąć przez `bonus=` (pomoc, forsowanie się).
- `spend` może kupować tylko kości.
- `difficultyLadder`: stopnie z `dc`, czyli liczbą, którą muszą osiągnąć zachowane kości. `dc=` w teście to ta liczba, od 1 do `keep` razy liczba ścianek kości.
- `outcomes` odczytuje `by: "total"` z zachowanych kości, a przedział z `on: "critical-success"` wyłapuje krytyczny sukces.

Zapis zachowuje postać sumy (`resolution="sum"`, `modifier="0"`, zachowane kości jako suma) i dodaje `highest="1"`, a tam, gdzie to ma zastosowanie, `zeroDice="true"` i `dark="N"`; ciemne kości są ostatnie w `rolls`. Wynik oparty wyłącznie na jasnych kościach zapisuje też `darkOutcome="light"`, więc karta rzutu wyróżnia tylko zachowane jasne kości, także po ponownym wczytaniu. Zestaw tego rodzaju nie ma własnej walki, więc `combat` obok niego jest odrzucane.

### `roll-against`: rzut najwyżej (lub co najmniej) równy liczbie z arkusza

Call of Cthulhu, GURPS i procenty złodzieja ze starej szkoły rzucają przeciw liczbie z arkusza, zamiast dodawać ją do kości. Capability API 1.139.

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- Liczba z arkusza dla testu jest progiem. Procent umiejętności to premia arkusza dla danej umiejętności (`bonusRange` sięga 100), bez atrybutu i bez premii z poziomu wyszkolenia; umiejętność GURPS to jej atrybut plus ta premia.
- `dice`: co się rzuca i sumuje, domyślnie 1d100 (3d6 w GURPS, 1d20 dla rzutu obronnego).
- `against`: `"at-most"` (domyślnie) oznacza sukces przy wyniku równym progowi lub niższym, a `"at-least"` – przy równym lub wyższym.
- `difficultyLadder`: `dc` każdego stopnia przesuwa próg, a `divide` (od 2 do 10) najpierw dzieli liczbę z arkusza. Game Master wskazuje stopień przez `difficulty=`; `dc=` w znaczniku przesuwa liczbę, od -100 do 100. `dc` w zapisie to liczba, względem której odczytano rzut, a zapis zawiera `against="at-most"`.
- `criticalSuccess` i `criticalFailure`: do sześciu reguł każde. Reguła wskazuje wyniki (`from`, `to`; każde z nich można zostawić otwarte) albo, dla porażki, `pastTarget`, czyli rzut tak daleko lub dalej po stronie porażki. `whenTarget` (`atLeast`, `below`) ogranicza regułę do niektórych progów: 5 w GURPS jest krytycznym sukcesem tylko przy progu 15 lub wyższym. Krytyczny sukces zawsze się udaje, a krytyczna porażka zawsze zawodzi.
- `tens`: opcjonalne, tylko przy pojedynczej kości d100. `bonus="+N"` rzuca N dodatkowymi kośćmi dziesiątek i zachowuje najlepszy rzut, a `bonus="-N"` – najgorszy, najwyżej do `max`.
- `outcomes` może odczytywać `by: "fraction"` przy rzucie `at-most`: `atLeast` każdego przedziału dzieli próg, a rzut równy tej części lub niższy trafia do tego przedziału. Działają też miary `margin` (jak daleko poniżej progu) i `total`.

### `symbol-pool`: rzucanie kośćmi narracyjnymi i odczytywanie symboli

Genesys buduje pulę z cechy i rangi umiejętności, a potem dodaje przeciwstawne kości. Ścianki zamiast liczb mają sukces, przewagę, triumf, porażkę, zagrożenie i rozpacz. Capability API 1.141.

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`: od 2 do 10 nazwanych symboli. `counts` dodaje też jeden inny symbol przed anulowaniem: triumf dodaje sukces i pozostaje triumfem. Wskazuje symbol bez własnego `counts`; łańcuchy i odwołania do samego siebie są odrzucane. `cancels` łączy dwa symbole w pary jeden do jednego, z najwyżej jednym partnerem dla każdego. Deklaracja odwrotna jest opcjonalna. `text` objaśnia symbol dla Game Master.
- `dice`: od 2 do 8 nazwanych kości, każda mająca od 2 do 20 ścianek. Ścianki to tablice z najwyżej trzema identyfikatorami symboli; `[]` to pusta ścianka, a powtórzone identyfikatory liczą się podwójnie. Wszystkie odwołania muszą istnieć.
- `pool`: `larger-upgraded` (domyślnie) rzuca tyloma kośćmi, ile wynosi większa z wartości atrybutu i rangi, i ulepsza tyle z nich, ile wynosi mniejsza, gdy zadeklarowano `upgrade`. `sum` dodaje obie wartości i niczego nie ulepsza. `max` wynosi domyślnie 6 i nie może przekroczyć 12. Atrybut używa `abilityModifier`, więc dla cech Genesys użyj `identity`. Ranga pochodzi z poziomu wyszkolenia umiejętności lub rzutu obronnego; zwykły test atrybutu ma rangę zero. `with=` podmienia cechę jak w innych testach. Premie z arkusza, rany, modyfikatory i efekty dodają kości wzmocnienia lub przeszkody przez opisaną niżej premię ze znakiem.
- `difficulty`: `dc=` liczy przeciwstawne kości od 0 do `max` (domyślnie 5, najwyżej 12). `difficulty=` wskazuje zamiast tego stopień drabiny. `upgrade="N"` zastępuje tyle przeciwstawnych kości kością ulepszenia, ale nie więcej, niż faktycznie rzucono. Nigdy nie dodaje kości ponad trudność.
- `boost` i `setback`: opcjonalne kości dodawane odpowiednio przez `bonus="+N"` i `bonus="-N"`, najwyżej do `max` każdej z nich (domyślnie 3, najwyżej 6). Modyfikatory ze znakiem łączą się przed zastosowaniem tego limitu. Capability API **1.150** przyjmuje też niezależne `setback="N"`: `bonus="2" setback="1"` rzuca kośćmi po obu stronach. Ujemna premia dodaje się do `setback`, a łączna liczba kości przeszkody jest utrzymywana w granicy `setback.max`; kości wzmocnienia pozostają ograniczone przez `boost.max`.
- `allowOwnUpgrade`: opcjonalne, domyślnie false. Przy `true` `upgradeOwn="N"` ulepsza N kolejnych kości postaci do `pool.upgrade` (które musi być zadeklarowane), po ulepszeniach z arkusza i kupionych kościach. Gdy wszystkie istniejące kości są już ulepszone, każde dodatkowe ulepszenie dodaje jedną ulepszoną kość, nadal w granicy `pool.max`. Działa to także z `pool.build: "sum"`. Zadeklarowanie tego klucza, nawet jako `false`, wymaga capabilityApi **1.150**. Nazwy pól znacznika zapisuje się w stylu camel case, jak `zeroDice`; `upgradeOwn` dotyczy rzucającego, a `upgrade` nadal dotyczy tylko kości trudności. Zarówno `setback`, jak i `upgradeOwn` przyjmują nieujemne liczby całkowite i są ignorowane poza pulami symboli; `upgradeOwn` jest ignorowane, jeśli nie zostało włączone.
- `success`: wymaga tylu symboli tego rodzaju po anulowaniu, domyślnie jednego. Krytyczny sukces i krytyczna porażka oznaczają każde wystąpienie wskazanego symbolu, nawet jeśli dodany przez niego sukces lub porażka zostaną anulowane. Oba oznaczenia mogą wystąpić razem i żadne z nich nie zmienia tego, czy sukcesy netto zaliczyły test.
- `outcomes` może odczytywać liczbę sukcesów netto (`total`) albo `net successes - needed + 1` (`margin`). Przedziały nadal decydują o sukcesie w zwykły sposób; pierwotne symbole krytyczne pozostają oznaczone. `spend` kupuje tylko dodatkowe podstawowe kości postaci w granicy `pool.max`. Walki w tym zestawie używają `symbol-pool` (Capability API 1.382, zobacz [Walkę rzucaną kośćmi symbolicznymi](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)); każdy inny rodzaj walki jest przy nim odrzucany.
- Poza testem gra korzystająca z tego zestawu zasad może rzucać jego kośćmi po nazwie: pole własnego rzutu kośćmi w pasku wpisywania wiadomości i narzędzie `roll_dice` postaci Game Master odczytują `2 ability 1 proficiency vs 2 difficulty` (`id` lub `label` każdej kości, bez rozróżniania wielkości liter) oraz liczą i anulują symbole tak jak w teście, bez arkusza, ulepszeń ani drabiny trudności. Nie trzeba tego włączać żadnym kluczem.
- Zapis zachowuje `resolution="sum"`, z `symbols="2s 1a 1t"`, `thrown=` identyfikującym każdą kość i `rolls=` zawierającym jej ściankę numerowaną od 1. Zakodowane `symbolDetails` zachowuje etykiety, symbole ścianek i oba oznaczenia krytyczne. `setback` zapisuje niezależne kości przeszkody faktycznie dodane po zastosowaniu wspólnego limitu kości przeszkody, a `upgradeOwn` – faktycznie zastosowane dodatkowe ulepszenia; zignorowane lub zerowe dodatki są pomijane. Karta rzutu i podsumowanie podają symbole netto, także pusty wynik, zamiast sumować numery ścianek. Nadpisania mogą zmieniać reguły tego rodzaju, ale nie mogą zastąpić `symbols` ani `dice`.

### Co jest poza zakresem i dlaczego

Te mechaniki nadal wymagają własnego rodzaju rozstrzygania:

- **Pule przeciwstawne** rozstrzygają dwie postacie naraz; test ma jedną rzucającą postać.
- **Sumowane pule z dziką kością** (jak w OpenD6) sumują kości, traktując jedną szczególnie.

Obie rzeczy wcześniej pomijane przez ten rodzaj są już modelowane; poniższa sekcja Wydawanie zasobów na zmianę rzutu wyjaśnia jak. Własna reguła systemu, "wydaj punkt za sukces" albo "wydaj punkt, aby ponownie rzucić nieudanymi kośćmi", to `resolution.spend`. Ponowny rzut przyznawany przez system za darmo, gdy wymaga tego sytuacja, to opisane wyżej `resolution.reroll`. Ponowny rzut należący do czegoś wybranego przez postać zapisuje się jako `mechanics.check` wpisu katalogu i opłaca kosztem tego wpisu.

## Przedziały wyników: więcej niż sukces lub porażka

Wiele systemów odczytuje test jako jeden z kilku wyników, a nie samo zaliczenie lub porażkę: cztery stopnie sukcesu w Pathfinder, "ledwo", które udaje się kosztem czegoś, trudne i ekstremalne sukcesy w Call of Cthulhu, "sukces ze stylem" w Fate. `resolution.outcomes` nazywa te przedziały, a Engine przy każdym teście podaje, do którego trafił (Capability API 1.135). Działa z każdym rodzajem rozstrzygania.

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`: z czego odczytuje się przedziały. `"margin"` (domyślnie) oznacza, o ile wynik przekroczył wymaganie testu: suma minus trudność albo sukcesy netto puli minus wymagane sukcesy. `"total"` to sam wynik: suma albo sukcesy netto, bez względu na trudność.
- `tiers`: od dwóch do ośmiu przedziałów, **od najlepszego**. `atLeast` to najniższa liczba trafiająca do przedziału; wartość każdego przedziału jest niższa niż poprzedniego, a ostatni przedział jej nie ma, bo wyłapuje wszystko poniżej. `success` określa, czy przedział jest sukcesem, a `critical` oznacza go jako krytyczny w swoim rodzaju (krytyczny sukces, gdy `success` jest prawdą, krytyczna porażka, gdy nie jest). Co najmniej jeden przedział musi być sukcesem i co najmniej jeden porażką. `text` to opcjonalna linia do 200 znaków, która mówi Game Master, co przedział znaczy przy stole ("You do it, but the Game Master adds a complication").
- `on`: `"critical-success"` lub `"critical-failure"` sprawia, że do przedziału trafia wynik krytyczny, niezależnie od liczby, i nic innego nigdy tam nie trafia. Taki przedział nie ma `atLeast`; przedział krytycznego sukcesu jest sukcesem, a przedział krytycznej porażki nie, i może być najwyżej po jednym z każdego. "Dwie szóstki" w Blades in the Dark to przedział krytycznego sukcesu nad przedziałem pojedynczej szóstki; pozostałe przedziały, odczytywane z liczby, stosują między sobą powyższe reguły.
- `naturals: "shift"`: najwyższa ścianka pojedynczej kości przesuwa wynik o jeden przedział w górę, a najniższa o jeden w dół, nigdy poza skrajne przedziały. Wymaga jednej kości i zastępuje `resolution.naturals`, więc ustaw obok niego obie jego wartości na `none`.

O wyniku decyduje przedział: sukces i oba wyniki krytyczne pochodzą z niego, nigdy z samego porównania. Gdy `naturals` zestawu z sumą czynią ściankę automatycznym sukcesem lub porażką, ta ścianka trafia do przedziału danego wyniku krytycznego, a w przeciwnym razie do najlepszego lub najgorszego przedziału, i pozostaje wynikiem krytycznym. Krytyczna porażka puli działa tak samo na dole, a pula z przedziałami pomija `exceptional`, bo przedziały już określają, czym jest krytyczny sukces.

Pula odczytywana `by: "total"` to sposób, w jaki system o stałej trudności podaje swoje wyniki: "1 sukces: ledwo ci się udaje, 2: robisz to dobrze, 3: krytyczny sukces" z Lasers & Feelings to trzy przedziały przy 3, 2 i 1 sukcesie oraz chybienie poniżej.

Zapis nazywa przedział przez `outcome="Critical success"`, karta rzutu pokazuje go zamiast zwykłego słowa, a Game Master poznaje przedziały i ich `text`, a instrukcje nakazują mu opisać przedział w narracji. Zestaw dostarczany jako pakiet, który deklaruje przedziały, wymaga Capability API 1.135.

## Testy rzucane na własny sposób

Niektóre gry rzucają większość testów w jeden sposób, a kilka w inny: gra w starym stylu rzuca d20 poniżej wartości atrybutu, ale umiejętności złodzieja na d100, a Open Doors na d6. `resolution.overrides` wskazuje te testy i klucze rozstrzygania, którymi są rzucane zamiast domyślnych. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Każde nadpisanie wskazuje `skills`, `saves` lub `abilities` (jedno lub więcej z tych trzech), `label` i opcjonalny `text` dla Game Master.
- `set` zawiera klucze rozstrzygania tego samego rodzaju co zestaw, które w tych testach zastępują klucze zestawu. `null` usuwa klucz: jedynki z exwod, które nie anulują sukcesów przy preferowanym atrybucie, to `"cancel": null`. Nie można zmienić rodzaju, matematyki arkusza (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) ani `difficultyLadder`. Pula symboli blokuje też swoje `symbols` i `dice`. Rozstrzygnięcie utworzone przez nadpisanie jest sprawdzane tak jak własne rozstrzygnięcie zestawu, więc wskazana w nim ścianka musi istnieć na jego kościach.
- `when`: opcjonalne. Wartość z arkusza rzucającego; nadpisanie obowiązuje tylko tam, gdzie nie wynosi ona 0, np. pole liczbowe 0 lub 1 dla preferowanego atrybutu. Bez niego nadpisanie obowiązuje zawsze.
- Używa się pierwszego nadpisania, które wskazuje test i którego `when` jest spełnione. Test pojawia się w najwyżej jednym nadpisaniu bez `when`.

## Wydawanie zasobów na zmianę rzutu

Niektóre systemy pozwalają graczowi zapłacić za nadchodzący rzut, np. punkt woli za automatyczny sukces. `resolution.spend` opisuje to jako stałą regułę systemu, nie rzecz kupioną przez postać:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` to jedna z `live.pools`. Nie może początkowo być pusta, bo na początku gry nie byłoby czego wydawać.
- `amount` to koszt JEDNEGO zakupu. `successes`, `dice` i `reroll` określają, co daje; zakup musi dawać przynajmniej jedno z nich. Sukcesy dodaje się po zliczeniu kości i anulowaniu, bo nie pochodzą z rzutów. Kości rzuca się razem z pulą, w jej własnym zakresie. `reroll` ma postać `{ "upTo": 6, "mode": "once" }`, odczytywaną tak jak `resolution.reroll`, i kupuje się go raz, niezależnie od liczby zakupów w teście: kość rzucona ponownie dwa razy to nadal jeden ponowny rzut.
- `perCheck` ogranicza liczbę zakupów jednego testu, więc maksymalna wartość zakupu to `amount * perCheck` punktów. Limit zapobiega kupowaniu pewnego zwycięstwa za pełną pulę. To liczba od 1 do 10, wartość z arkusza w tej samej postaci, w jakiej odczytuje ją wartość pochodna (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`), albo `"pool"`: tyle, ile kości ma test, czyli wartość arkusza dla niego przed ranami, dodatkowymi kośćmi i modyfikatorami. Wartość z arkusza jest odczytywana dla rzucającego, zaokrąglana w dół i utrzymywana w zakresie od 0 do 100, a postać, której limit wynosi 0, niczego nie kupuje i za nic nie płaci.
- Zestaw `dice-pool` może kupować sukcesy, kości lub ponowne rzuty. `dice-highest` i `symbol-pool` kupują tylko kości. Pozostałe rodzaje nie mogą deklarować `spend`.
- Najwyżej cztery wpisy, a dwa nie mogą nazywać tej samej puli, bo test nie mógłby wskazać, o który chodzi.
- Wydatek kupujący `reroll`, `perCheck` niebędące liczbą i więcej niż dwa wpisy wymagają Capability API 1.38 w zestawie dostarczanym jako pakiet.

**Wpisuje się to w sam test.** Game Master pisze `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, nie osobną komendę `[sheet:]`, ponieważ kości rzuca się przed wykonaniem komend arkusza i później nie byłoby już czego zmieniać. Jedno rozstrzygnięcie rzuca kośćmi i płaci za to, co je zmieniło.

## Talizman zmieniający rzut

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
- `explode` i `double` przesuwają wyniki tych reguł dla tego jednego rzutu, tylko gdy reguła ma `min`, i w jego granicach: `"check": { "explode": 8 }` to wpis, dzięki któremu ósemki dają dodatkową kość. Mają pierwszeństwo przed tym, co Game Master zapisał w znaczniku, tak jak `threshold`. Capability API 1.37.
- Wymagane jest co najmniej jedno z tych pól; inaczej wpis niczego nie określa i jest odrzucany.
- Obsługuje to wyłącznie `dice-pool`, więc `dice-sum` z `mechanics.check` jest odrzucane przy imporcie.

**Koszt określa własne `cost` wpisu**, płacone dokładnie tym samym mechanizmem co użycie innych rzeczy: pula i jedno użycie każdego licznika zapisanego przez ten wpis. `perCostStep` określa SKALOWANIE; wpis z tym polem kupuje się tyle razy, ile zapłacono cenę, a bez niego jeden raz, niezależnie od zaoferowanej kwoty.

**Game Master nazywa go w teście:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Nie w osobnej komendzie arkusza, z tego samego powodu co wyżej: kości rzuca się przed wszelkimi zapisami stanu.

**Wszystko albo nic.** Jeśli pula nie wystarcza, zakup nie następuje i nic nie jest odejmowane: rzut pozostaje dokładnie taki jak bez zakupu. Punkty niebędące całkowitą wielokrotnością zakupu także nic nie kupują. Żądanie przekraczające `perCheck` jest przycinane, nie odrzucane, i płaci się tylko za limit. Wszystko oblicza Engine; Game Master podaje zadeklarowany przez gracza wydatek i nigdy nie dotyka kości. Zapis pokazuje rzeczywistą opłatę, zastosowany wpis, sukcesy uzyskane bez rzutu i liczbę ponownie rzuconych kości. Talizman niewybrany przez postać lub taki, którego katalogu Engine nie może odczytać, nie robi nic zamiast działać na zaufanie.
