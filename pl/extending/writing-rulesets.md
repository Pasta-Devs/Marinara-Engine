# Pisanie zestawów zasad Game Mode

Zestaw zasad mówi trybowi Game Mode, jak działa system stołowy: jakie kości rzuca test, co znajduje się w arkuszu postaci, jakie zasoby są wydawane i co odnawia odpoczynek. Ten przewodnik jest dla osób chcących napisać i udostępnić własny zestaw. Jeśli chcesz grać z zestawem kogoś innego, zacznij od [Wyboru zasad](../game/getting-started.md#choosing-rules).

Zestaw zasad jest jednym plikiem JSON. Zawiera dane, nie kod. Nic się w nim nie wykonuje, więc import nie może niczego zrobić z twoim komputerem. Przed importem cudzego pliku dokładnie przeczytaj tekst Game Master: trafia do modelu w każdej grze używającej zestawu.

## Najpierw przeczytaj: co zestaw zasad może, a czego nie może

Zestaw może jedynie uzupełniać mechanikę, którą Engine już zna. Obecnie Engine zna pięć sposobów rozstrzygania testu; plik wybiera jeden przez `resolution.kind`:

- **`dice-sum`**: rzuć kośćmi, dodaj liczby z arkusza i osiągnij lub przekrocz trudność. Obejmuje systemy d20, systemy 2d6 plus cecha i wiele innych.
- **`dice-pool`**: rzuć liczbą kości wynikającą z postaci i policz te, które osiągnęły próg. Obejmuje systemy, w których wartość oznacza garść kości zamiast premii.

- **`dice-highest`**: rzuć pulą i odczytaj jej najwyższą kość albo dodaj kilka najwyższych. Obejmuje Blades in the Dark i Trophy Dark.
- **`roll-against`**: rzuć wynik równy liczbie z arkusza lub niższy (albo wyższy). Obejmuje umiejętności procentowe i testy GURPS.
- **`symbol-pool`**: zbuduj i ulepsz kości narracyjne, a potem anuluj przeciwstawne symbole. Obejmuje testy Genesys.

Wszystkie pięć rodzajów dokładnie opisuje sekcja [Rodzaje rozstrzygania](#resolution-kinds).

Mechaniki niepasującej do żadnej z tych postaci nie da się zapisać w pliku zestawu. Przykładem są przeciwstawne pule. Każda taka mechanika wymaga nowego rodzaju rozstrzygania w Engine, czyli wkładu w kod z testami, nie pliku JSON. Jeśli twój system go potrzebuje, zgłoś prośbę o funkcję w repozytorium Engine i opisz mechanikę kilkoma w pełni rozpisanymi rzutami. Te przykłady staną się testami.

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
| `items` | Opcjonalne. Słowa, którymi opisuje się twoje przedmioty: kategorie, rzadkości, statystyki, miejsca, pieniądze. |
| `battle` | Opcjonalne. Dane, które bitwa może odczytać z arkusza i zapisać po zakończeniu. |
| `combat` | Opcjonalne. Sposób rozstrzygania walki według własnych zasad i to, co pokazuje ekran bitwy. |
| `layers` | Opcjonalne. Warianty zestawu włączane przez gracza przy tworzeniu gry. |

Plik może mieć do 512 KB (256 KB przed Capability API 1.340). Tekst trafiający do promptu (nazwy, etykiety, tekst Game Master) nie może zawierać nowych linii, nawiasów kwadratowych ani podwójnych klamer.

Identyfikatory w arkuszu (atrybutów, umiejętności, pól, pul itd.) zaczynają się literą i zawierają małe litery, cyfry oraz podkreślenia, np. `grit_max`.

<a id="resolution-kinds"></a>

### Rodzaje rozstrzygania

`resolution.kind` wybiera sposób rzutu testu. Każdy rodzaj czyta ten sam arkusz postaci i korzysta z tych samych trzech kluczy, więc zmiana rodzaju nie zmienia części pliku poniżej `resolution`:

- `abilityModifier`: jak wynik w arkuszu staje się liczbą. `identity` oznacza, że wynik jest tą liczbą. `floorHalfMinusTen` to reguła 5e. `stepTable` pozwala podać własne progi jako `[[score, number], ...]`.
- `proficiencyTiers`: poziomy wyszkolenia umiejętności lub rzutu obronnego. Pierwszy dostaje niewymieniona umiejętność. Poziom dodaje `flat`, albo `multiplier` razy premię biegłości, albo oba. Jeśli system ma premię biegłości, wskaż jej źródło przez `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcjonalne, potrzebne tylko poziomowi używającemu mnożnika.

Znaczenie otrzymanej liczby zależy od rodzaju: `dice-sum` dodaje ją do rzutu, `dice-pool` i `dice-highest` rzucają tyloma kośćmi. `symbol-pool` trzyma atrybut i wyszkolenie osobno, aby zbudować i ulepszyć kości narracyjne.

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
- `dice.faces`: wartość każdej ścianki, od najniższej, gdy ścianki nie oznaczają własnych liczb (Capability API 1.136). Cztery kości Fudge z Fate to `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: karta rzutu pokazuje −, pustą ściankę i + i je sumuje, a prawdopodobieństwa są dokładnie takie jak w Fate. Podaj jedną wartość na każdą ściankę.
- `openEnded`: pojedyncza kość, którą rzuca się dalej (1.136). Wynik równy `high` lub wyższy rzuca się ponownie i dodaje, i znowu, dopóki nowa kość pokazuje `high` lub więcej; wynik równy `low` lub niższy rzuca się ponownie i odejmuje, a ten rzut tak samo ciągnie się dalej przy `high`. Otwarty rzut procentowy z Rolemastera to `{ "high": 96, "low": 5 }` na jednej kości d100. Jeden rzut to najwyżej 20 kości. Naturalne wyniki i przesunięcie przedziałów odczytują pierwszą kość.
- `unmodified`: wyniki pojedynczej kości, które zapis oznacza, gdy wypadną na pierwszej kości (1.136), aby dało się stosować tabele traktujące osobno "niezmodyfikowane 66": `[66, 100]`. Zapis zawiera `unmodified="66"`, karta rzutu to podaje, a instrukcje nakazują modelowi Game Master zastosować to, co mówią o tym zasady.
- `difficultyLadder`: trudności, spośród których ma wybierać Game Master. `dc` to liczba, którą suma musi osiągnąć. Zamiast liczby Game Master może podać nazwę stopnia, np. `difficulty="Hard"`, a Engine odczyta liczbę z tego stopnia.

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

#### Co Game Master może zapisać w teście puli

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

#### `dice-highest`: rzucanie kośćmi i odczytywanie najwyższej

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

#### `roll-against`: rzut najwyżej (lub co najmniej) równy liczbie z arkusza

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

#### `symbol-pool`: rzucanie kośćmi narracyjnymi i odczytywanie symboli

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
- `outcomes` może odczytywać liczbę sukcesów netto (`total`) albo `net successes - needed + 1` (`margin`). Przedziały nadal decydują o sukcesie w zwykły sposób; pierwotne symbole krytyczne pozostają oznaczone. `spend` kupuje tylko dodatkowe podstawowe kości postaci w granicy `pool.max`. Walka jest pominięta, tak jak przy `dice-highest`.
- Zapis zachowuje `resolution="sum"`, z `symbols="2s 1a 1t"`, `thrown=` identyfikującym każdą kość i `rolls=` zawierającym jej ściankę numerowaną od 1. Zakodowane `symbolDetails` zachowuje etykiety, symbole ścianek i oba oznaczenia krytyczne. `setback` zapisuje niezależne kości przeszkody faktycznie dodane po zastosowaniu wspólnego limitu kości przeszkody, a `upgradeOwn` – faktycznie zastosowane dodatkowe ulepszenia; zignorowane lub zerowe dodatki są pomijane. Karta rzutu i podsumowanie podają symbole netto, także pusty wynik, zamiast sumować numery ścianek. Nadpisania mogą zmieniać reguły tego rodzaju, ale nie mogą zastąpić `symbols` ani `dice`.

#### Co jest poza zakresem i dlaczego

Te mechaniki nadal wymagają własnego rodzaju rozstrzygania:

- **Pule przeciwstawne** rozstrzygają dwie postacie naraz; test ma jedną rzucającą postać.
- **Sumowane pule z dziką kością** (jak w OpenD6) sumują kości, traktując jedną szczególnie.

Obie rzeczy wcześniej pomijane przez ten rodzaj są już modelowane; poniższa sekcja Wydawanie zasobów na zmianę rzutu wyjaśnia jak. Własna reguła systemu, "wydaj punkt za sukces" albo "wydaj punkt, aby ponownie rzucić nieudanymi kośćmi", to `resolution.spend`. Ponowny rzut przyznawany przez system za darmo, gdy wymaga tego sytuacja, to opisane wyżej `resolution.reroll`. Ponowny rzut należący do czegoś wybranego przez postać zapisuje się jako `mechanics.check` wpisu katalogu i opłaca kosztem tego wpisu.

### Przedziały wyników: więcej niż sukces lub porażka

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

### Testy rzucane na własny sposób

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

### Wydawanie zasobów na zmianę rzutu

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
- `explode` i `double` przesuwają wyniki tych reguł dla tego jednego rzutu, tylko gdy reguła ma `min`, i w jego granicach: `"check": { "explode": 8 }` to wpis, dzięki któremu ósemki dają dodatkową kość. Mają pierwszeństwo przed tym, co Game Master zapisał w znaczniku, tak jak `threshold`. Capability API 1.37.
- Wymagane jest co najmniej jedno z tych pól; inaczej wpis niczego nie określa i jest odrzucany.
- Obsługuje to wyłącznie `dice-pool`, więc `dice-sum` z `mechanics.check` jest odrzucane przy imporcie.

**Koszt określa własne `cost` wpisu**, płacone dokładnie tym samym mechanizmem co użycie innych rzeczy: pula i jedno użycie każdego licznika zapisanego przez ten wpis. `perCostStep` określa SKALOWANIE; wpis z tym polem kupuje się tyle razy, ile zapłacono cenę, a bez niego jeden raz, niezależnie od zaoferowanej kwoty.

**Game Master nazywa go w teście:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Nie w osobnej komendzie arkusza, z tego samego powodu co wyżej: kości rzuca się przed wszelkimi zapisami stanu.

**Wszystko albo nic.** Jeśli pula nie wystarcza, zakup nie następuje i nic nie jest odejmowane: rzut pozostaje dokładnie taki jak bez zakupu. Punkty niebędące całkowitą wielokrotnością zakupu także nic nie kupują. Żądanie przekraczające `perCheck` jest przycinane, nie odrzucane, i płaci się tylko za limit. Wszystko oblicza Engine; Game Master podaje zadeklarowany przez gracza wydatek i nigdy nie dotyka kości. Zapis pokazuje rzeczywistą opłatę, zastosowany wpis, sukcesy uzyskane bez rzutu i liczbę ponownie rzuconych kości. Talizman niewybrany przez postać lub taki, którego katalogu Engine nie może odczytać, nie robi nic zamiast działać na zaufanie.

### Arkusz

- `sections` grupuje rzeczy w edytorze. Pola, wartości pochodne i listy wskazują przez `section` sekcję, w której się znajdują; mogą to robić także atrybuty, umiejętności i rzuty obronne. Edytor, arkusz w grze i blok arkusza dla Game Master pokazują je wtedy pod tym nagłówkiem (arkusz, który nie wskazuje dla nich sekcji, pokazuje je dokładnie tak jak wcześniej). Sekcja może też mieć regułę `untrained` (niżej).
- `abilities` to podstawowe cechy. `skills` i `saves` mogą wskazywać atrybut używany przy rzucie, `cap` i regułę `untrained` (niżej).
- `fields` to pojedyncze wartości. Typy: `number`, `text`, `longtext`, `boolean`, `enum` (stała lista wyborów) i `dice` (tekst taki jak `1d8`).
- Wartości `derived` oblicza się z innych wartości i nie można ich nadpisać ręcznie. Arkusz może mieć ich do 400 (Capability API 1.111; 240 od 1.88, 120 od 1.84, 60 wcześniej); pakiet z więcej niż 240 deklaruje 1.111. Operacje to `sum`, `min`, `max`, `scale` (mnożenie przez stałą liczbę i zaokrąglanie), `multiply` (od dwóch do sześciu wartości mnożonych przez siebie, np. modyfikator Constitution razy poziom; Capability API 1.82), `stepTable` (wyszukanie w progach, jak poziom wyznaczający premię biegłości) oraz `enumTable` (liczba dla każdej wartości pola wyliczeniowego lub stanu bieżącego; zobacz niżej Stany bieżące).
- `lists` to tabele z własnymi kolumnami, np. ekwipunek, zaklęcia lub zdolności. Lista ma do 24 kolumn; pakiet z listą mającą więcej niż 12 kolumn deklaruje Capability API 1.165. Lista z `pools` zmienia każdy wiersz w zasób z własnym maksimum, przydatny dla zdolności klasy o ograniczonej liczbie użyć. Kolumnę liczbową może wypełnić rzut: `"roll": { "count": 1, "sides": 8 }`, gdzie `sides` to liczba, inna kolumna tego samego wiersza (`{ "column": "die" }`, kolumna liczbowa lub wyliczeniowa, której wartości odczytuje się jako kości, np. `d8`) albo wartość z arkusza. Edytor arkusza pokazuje przycisk Roll, który rzuca własnymi kośćmi Engine i zapisuje sumę, utrzymaną w zakresie `min` i `max` kolumny (Capability API 1.85).
- `live` to rzeczy zmieniające się podczas gry: `pools` (punkty życia, komórki zaklęć, Grit), `tracks` (liczba na skali, np. wyczerpanie, lub tor ran z zaznaczanymi polami), `text` (krótkie notatki, np. przedmiot koncentracji), `conditions` i `states` (jedna wartość z zamkniętego zbioru, np. forma lub postawa).

Wszystko, co odczytuje liczbę, nazywa ją odwołaniem do wartości: obiektem o dokładnie jednym kluczu `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` lub `itemStat`. Przykład puli o maksimum będącym wartością pochodną: `"max": { "derived": "grit_max" }`.

- `listSum` sumuje jedną kolumnę liczbową listy: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` jest opcjonalne i wskazuje kolumnę logiczną; liczą się tylko wiersze, w których jest włączona. Pusta komórka liczy się jako wartość domyślna kolumny, a lista ukryta przez `hideWhen` nic nie dodaje. Tak Ember Roads oblicza Burden z ekwipunku spakowanego przez postać, więc wartość nigdy nie rozjedzie się z listą, jak mogłoby się stać z ręcznie wpisaną liczbą. Skalowana kolumna katalogu nie może odczytywać sumy listy, nawet przez wartość pochodną: lista może zawierać skalowane komórki, własne lub odczytujące ją z powrotem, i przeliczanie nigdy by się nie ustabilizowało.
- `livePool` odczytuje, ile zostało w jednej z twoich `live.pools` (pula wiersza listy do nich nie należy). `liveTrack` odczytuje jeden z twoich `live.tracks`, z opcjonalnym `read`: `"value"`, czyli bieżąca pozycja (domyślnie); `"filled"`, czyli odległość powyżej `min`; `"remaining"`, czyli odległość poniżej `max`; albo, tylko na torze ran, `"penalty"`, czyli obowiązująca kara. Ukryta pula lub tor dają 0. "Harm still to take" z Gravewatch to `{ "liveTrack": "harm", "read": "remaining" }`.
- Odczyt bieżący bierze bieżący stan z chwili rzutu testu, rozpoczęcia walki lub zapisu bloku arkusza dla Game Master. Gdy bieżącego stanu jeszcze nie ma (edytor arkusza, przegląd importu), odczytuje stan, od którego zaczyna się gra: pulę pełną lub pustą zgodnie z jej `start`, tor na wartości `default` i czysty tor ran.
- Nic, co oblicza się, zanim powstanie bieżący stan, nie może go odczytywać: `max` puli lub toru, premia biegłości ani skalowana kolumna lub skalowanie katalogu. Dotyczy to także odczytu przez wartość pochodną i przez umiejętność ograniczoną wartością bieżącą, a import podaje wartość, która to robi.
- Te trzy wymagają Capability API 1.39 w zestawie dostarczanym jako pakiet.
- `itemStat` odczytuje przedmioty posiadane przez postać, np. ochronę noszonego pancerza, i podlega tej samej regule co odczyt bieżący. Zobacz [Przedmioty w arkuszu](#items-on-the-sheet). Capability API 1.52.

**Co robi test bez wyszkolenia.** Umiejętność lub rzut obronny, w którym postać nie ma wyszkolenia (jej poziom wyszkolenia jest pierwszy), rzuca się normalnie, chyba że zestaw zasad stanowi inaczej przez `untrained` na umiejętności lub rzucie obronnym albo na sekcji, w której się znajdują (pierwszeństwo ma własna reguła umiejętności lub rzutu obronnego):

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: normalnie (domyślnie).
- `{ "by": -3 }`: dodawane do liczby testu, od -20 do 20: kości w puli, stała wartość przy sumie. Jest częścią liczby pokazywanej w arkuszu i używanej w każdym teście, przed jakimkolwiek `cap`.
- `"harder"`: o jeden stopień trudniej. W puli próg pojedynczej kości rośnie o jeden (i pozostaje w zakresie progu), więc wymaga zestawu z pulą, którego próg może się zmieniać; gdzie indziej jest odrzucane przy imporcie, bo nigdy nie zmieniłoby rzutu.
- `"refuse"`: test w ogóle nie jest rzucany. Engine odsyła żądanie Game Master z `reason="untrained"`, co je rozstrzyga: nic później go nie rzuca, Game Master dowiaduje się, że postać nie mogła tego spróbować, a narracja to mówi. Endpoint testów umiejętności odpowiada na taki test kodem 400 (`skill_check_untrained`), a oparte na nim rozgałęzienie na sukces i porażkę nie zachowuje żadnej z połówek. Edytor arkusza nie pokazuje dla niego liczby.
- Postać, dla której nikt nie ma arkusza, nie ma wyszkolenia do odczytania, więc nie dotyczy jej żadna reguła testów bez wyszkolenia.
- Przypomnienie dla Game Master wymienia reguły testów bez wyszkolenia według sekcji lub umiejętności, więc prosi o testy, które postać może wykonać.

Sekcje na atrybutach, umiejętnościach i rzutach obronnych oraz `untrained` w dowolnym miejscu wymagają Capability API 1.41 w zestawie dostarczanym jako pakiet.

Umiejętność lub rzut obronny może mieć `cap`, odwołanie do wartości będące najwyższą wartością, jaką może osiągnąć test: wartość, której nie da się przerosnąć, albo tor, który ją ogranicza. Gravewatch ogranicza Soothe do Resolve, które zostało strażnikowi: `"cap": { "livePool": "resolve" }`. Ograniczona liczba jest tą pokazywaną w arkuszu i używaną w każdym teście, a podmianę przez `with=` oblicza się na liczbie sprzed ograniczenia i potem ogranicza ponownie. Ograniczenie nie może odczytywać modyfikatora umiejętności ani rzutu obronnego; nie może tego również odczytywana przez nie wartość pochodna ani żadna wartość pochodna zadeklarowana nad nią, więc arkusz nadal oblicza się raz, od góry do dołu. Capability API 1.39.

`hideWhen` ukrywa pole, wartość pochodną, listę, pulę lub zwykły tor na podstawie wartości innego pola, na dokładnie jeden z trzech sposobów: `equals` jedna wartość, `notEquals` jedna wartość (ukryte, gdy pole zawiera cokolwiek innego; tak wyraża się "tylko dla tego rodzaju postaci") albo `in` lista wartości. Każda wskazana wartość musi być możliwa w tym polu, inaczej reguła nigdy by nie pasowała, i jest sprawdzana pojedynczo; dla `notEquals` i `in` obejmuje to zakres pola liczbowego i długość pola tekstowego. Reguła odczytuje wartość pokazywaną przez edytor arkusza: nieustawione pole ma wartość, od której zaczyna pusty arkusz, a wartość wyliczeniowa, której zestaw już nie oferuje, jest wartością domyślną pola. Plik 5e używa `equals`, aby ukryć komórki zaklęć u postaci nierzucających zaklęć; Gravewatch usuwa olej do latarni z arkusza każdego strażnika, który nie pełni nocnej warty, przez `"hideWhen": { "field": "watch", "notEquals": "night" }`. Warstwa nie może usunąć wartości, z którą porównuje któraś z tych reguł. Toru ran nie można ukryć, bo rzuty i walki odczytują go niezależnie od tego, co pokazuje arkusz. `notEquals` i `in` wymagają Capability API 1.39.

`max` zwykłego toru może być odwołaniem do wartości zamiast liczby, więc jego długość wyznacza wartość posiadana przez postać: `"max": { "field": "willpower_rating" }`. Jego `min` i `default` pozostają liczbami. Tor ran z nazwanymi poziomami ma `max` równe liczbie poziomów; tor z numerowanymi polami jest tak długi jak jego własne `max` (zobacz niżej Numerowane pola). `alwaysShow: true` wypisuje tor w bloku arkusza dla Game Master nawet przy wartości domyślnej, dla wartości ważnej w każdej turze; bez tego tor na wartości domyślnej jest pomijany, bo trzy rzuty przeciw śmierci na zerze niczego nie mówią. Te trzy wymagają Capability API 1.37 w zestawie dostarczanym jako pakiet.

### Stany bieżące: forma, postawa, światło

Pole wyliczeniowe wybiera się przy tworzeniu postaci i ten wybór zostaje, a stan jest tylko włączony albo wyłączony. **Stan bieżący** to jedna wartość z zamkniętego zbioru, która zmienia się podczas gry: forma zmiennokształtnego, postawa w walce, jasność latarni.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` to od dwóch do czterdziestu wartości, każda pokazywana jako jej wpis w `valueLabels` albo w niezmienionej postaci. Podlegają regule każdej etykiety (jedna linia, bez nawiasów kwadratowych i klamer makr) i nigdy nie zawierają cudzysłowu, bo komenda arkusza ujmuje je w cudzysłów. Najwyżej dwanaście stanów bieżących.
- `default` to wartość, od której zaczyna każdy arkusz; po pominięciu – pierwsza wartość. Zapisywany jest tylko stan bieżący zmieniony z wartości domyślnej, a zapisana wartość, której stan już nie oferuje, jest odczytywana jako domyślna.
- `hideWhen` usuwa stan bieżący z arkusza na podstawie wartości pola, tak jak pulę: nie jest pokazywany, nie ustawia go komenda, a tabela (niżej) odczytuje go jako brak wartości.
- Game Master ustawia go przez `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, wskazując stan przez identyfikator lub etykietę, a wartość przez nią samą lub jej etykietę. Stan lub wartość, których arkusz nie ma, są odrzucane (`unknown-state`, `unknown-value`). Engine uczy tej komendy i wymienia wszystkie wartości tylko wtedy, gdy zestaw ma stan bieżący, a każdy blok arkusza podaje wartość każdego stanu bieżącego, także domyślną, bo "w ludzkiej postaci" to fakt potrzebny narracji w każdej turze.
- Ekran arkusza w grze pokazuje selektor dla każdego stanu bieżącego.
- Odpoczynek przywraca go krokiem odnowienia, który go wskazuje: `{ "state": "stance", "to": "default" }` albo `"to"` jedna z jego wartości.

**Liczby, które za tym idą.** Wartość pochodna z `"op": "enumTable"` daje liczbę dla każdej wartości pola wyliczeniowego lub stanu bieżącego:

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` wskazuje dokładnie jedno z: `field` (pole wyliczeniowe) lub `liveState`. Każdy wiersz `table` to wartość możliwa w tym źródle, od jednej do czterdziestu. Wartość pominięta w tabeli i stan ukryty przez arkusz dają `default` (0 po pominięciu).
- Pole jest ustalane przy tworzeniu postaci, więc tabela oparta na nim może zasilać maksimum: Gravewatch daje strażnikowi na porannej warcie jeden dodatkowy punkt Resolve. Stan bieżący zmienia się podczas gry, więc tabela oparta na nim jest odczytem bieżącym, jak `liveTrack`: nic, co oblicza się, zanim powstanie bieżący stan, nie może jej odczytywać, bezpośrednio ani przez inną wartość pochodną. Dlatego klucz to `liveState`, a nie `state`: każdy odczyt bieżącego stanu ma w nazwie `live`, dzięki czemu zarówno ty, jak i import rozpoznajecie, czego maksimum nie może używać.
- Aby dodać tę liczbę do kości, wskaż ją w `resolution.adjust` (zobacz Modyfikatory z arkusza). Ember Roads dodaje swoją postawę (Stance) do każdego rzutu Brawn; Gravewatch odejmuje karę za zasłoniętą lub zgaszoną latarnię od każdego rzutu Nerve.
- Warstwa może usunąć z pola wartość, dla której tabela ma wiersz. Ten wiersz po prostu nie jest odczytywany, gdy warstwa jest włączona.

Stany bieżące, `enumTable` i krok odpoczynku wskazujący `state` wymagają Capability API 1.42 w zestawie dostarczanym jako pakiet.

### Tory ran: zdrowie jako tor zamiast liczby

Wiele systemów wcale nie liczy punktów życia. Mają kolumnę pól, każde gorsze od poprzedniego, i zaznacza się jedno po zranieniu. Dodaj do wpisu `live.tracks` `kinds` oraz nazwane `levels` albo numerowane `boxes` (niżej), aby zmienić liczbę na skali w taki tor:

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
- Oba występują razem. `kinds` bez `levels` lub `boxes` jest odrzucane, bo nie ma czego zaznaczać, a `levels` lub `boxes` bez `kinds` – bo znacznik musi mieć rodzaj. Tor ma `levels` albo `boxes`, nigdy oba.
- **Rozróżniaj te słowa.** `kinds` to rodzaje dozwolone przez zestaw. ZNACZNIK to jeden taki rodzaj umieszczony na torze podczas gry. Definicja przechowuje rodzaje; arkusz postaci znaczniki.
- Tor ran zaczyna bez znaczników, więc jego `min` to 0. Tor z nazwanymi poziomami jest tak długi jak lista poziomów, więc jego `max` to `levels.length`; inny zapis jest odrzucany, nie poprawiany po cichu, więc plik nigdy nie przechowuje dwóch sprzecznych długości. Tor z polami jest tak długi jak jego własne `max`, które może być wartością obliczaną przez arkusz (zobacz niżej Numerowane pola).

**Dokładne reguły**, bo nieprecyzyjne odczytanie daje niepoprawny tor:

- Znaczniki są posortowane, **najcięższe najpierw**. Tor siedmiu poziomów mieści najwyżej siedem znaczników.
- Znacznik **wstawia się według ciężkości** pomiędzy obecne, nigdy na końcu. Zajmuje najwyższy poziom należny ciężkości i przesuwa lżejsze w dół.
- Działa kara z **najniższego zaznaczonego poziomu**, nie suma zaznaczonych. Trzy znaczniki powyższego toru dają `-3`, nie `0 + -1 + -3`.
- `amount` to liczba znaczników jednego rodzaju **stosowanych pojedynczo**; tor zapełniający się w trakcie podlega tej samej regule co już pełny.
- Zaznaczanie **pełnego** toru **podnosi najlżejszy znacznik o jeden stopień** zamiast dodawać nowy. To jeden stopień własnej skali rodzajów, niezależnie od rodzaju dodawanego znacznika.
- Znacznik przekraczający najwyższą ciężkość pozostaje na maksimum, a niemieszczący się jest liczony jako **nadmiar**. Nadmiar jest zapisywany, więc przeładowanie nie zapomina otrzymanych obrażeń.
- **Leczenie to ta sama komenda z ujemną liczbą.** Usuwa nadmiar przed jakimkolwiek znacznikiem. Leczenie wskazujące jeden z rodzajów toru usuwa tylko znaczniki tego rodzaju, więc "obuchowe się goją, śmiertelne zostają" to `kind="bashing"` z ujemną liczbą; leczenie niewskazujące żadnego rodzaju toru usuwa najpierw najlżejsze znaczniki.

**Zaznaczanie podczas gry.** Game Master pisze `[sheet: op="damage" track="harm" kind="knock" amount="1"]` i leczy przez ujemne `amount`. Na torze zaznaczanym według pola dodaje `box="3"`, czyli pole, w które trafia cios. Wariant `damage` wskazujący `pool=` nie zmienia się. Zwykła komenda `track` jest odrzucana dla toru ran: sama liczba nie określa nowych znaczników. Gracz może też ręcznie zaznaczać i czyścić pola arkusza, zgodnie z założeniami tych systemów.

**Walka także może zaznaczać tor.** Skieruj `combat.health` na tor zamiast puli. Trafiony cios zaznacza tyle pól, ile mówi `combat.damageKinds.marks`, rodzajem przypisanym przez ten blok typowi obrażeń. Postać z pełnym torem pada, co odczytuje reguła umierania. Na torze zaznaczanym według pola obrażenia `per-point` wskazują pole, w które trafiają, a `per-blow` celują w pierwsze, a cios, którego nie może przyjąć żadne pole, powala postać, bo tak w systemach z takim torem wygląda wyeliminowanie z walki. Leczenie usuwa jeden znacznik, najlżejszy, dowolnego rodzaju. Punkty tymczasowe są odrzucane, bo tor nie ma dla nich bufora. Engine odczytuje tor jako liczbę POZOSTAŁYCH poziomów, więc reszta walki, upadek, przywrócenie, dziennik i podsumowanie nie zmieniają się.

**Odpoczynek może leczyć tor ran.** Krok odnowienia z `"to"` czyści go do podanej liczby znaczników, wraz z nadmiarem; krok z UJEMNYM `"by"` usuwa tyle znaczników, zaczynając od nadmiaru, więc `"by": { "const": -2 }` usuwa dwa. Krok, który wskazuje także `kind`, usuwa tylko znaczniki tego rodzaju: "Catch your breath" z Gravewatch to `{ "track": "harm", "kind": "knock", "to": "min" }`, co leczy stłuczenia i zostawia rozdarcia. Krok, który DODAŁBY znaczniki, nie robi nic, bo odpoczynek nie zadaje obrażeń; dotyczy to także dodatniego `"by"`: jest pomijane bez słowa, więc pamiętaj o znaku minus.

#### Numerowane pola zamiast nazwanych poziomów

Gdy tor jest tak długi, jak wytrzymała jest postać, nadaj mu `boxes` zamiast `levels`. Ma tyle pól, ile wynosi jego własne `max`, które może być wartością obliczaną przez arkusz (nigdy odczytującą bieżący stan), najwyżej 64:

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- Obowiązującą karę odczytuje się z `table` (tabeli progów, jak w wartości pochodnej, z karami nie większymi niż 0) dla liczby pól `filled` lub `remaining`, jakakolwiek jest, więc tabela może coś kosztować, nawet gdy nic nie jest zaznaczone. Kara nie zależy od tego, które pola są zaznaczone.
- Pola są numerowane: arkusz pokazuje "Box 3", a blok arkusza dla Game Master podaje, ile pól zaznaczono z ilu, zamiast nazywać poziom.

#### Zaznaczanie według pola i tory odrzucające znaczniki

- `"fill": "indexed"` umieszcza znacznik w polu wskazanym przez komendę przez `box=` (w pierwszym polu, gdy żadnego nie wskazuje) albo w najbliższym wolnym polu powyżej i nigdy nie przesuwa znacznika, który już stoi. Leczenie usuwa najwyżej położony spośród najlżejszych znaczników. Ekran arkusza pozwala graczowi kliknąć dowolne czyste pole.
- `"onFull": "refuse"` odrzuca znacznik, dla którego nie ma wolnego pola, zamiast podnosić najlżejszy znacznik. Odrzucana jest cała komenda, więc trzy znaczniki przy dwóch wolnych polach nie trafiają nigdzie. Tor zaznaczany według pola zawsze odrzuca; zaznacz to, dodając obok `"onFull": "refuse"`.

#### Poziomy dodawane przez listę

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` na torze z nazwanymi poziomami pozwala liście w arkuszu wydłużać go dla każdej postaci osobno. Każdy wiersz, po kolei, dodaje swoją liczbę poziomów (najwyżej 16) ze swoją karą, za ostatnim poziomem o karze co najmniej tak dobrej; poziomy te noszą nazwę tamtego poziomu, gdy kary są równe, a w przeciwnym razie nazwę od kary. Tak działają blizny w Gravewatch. Lista ukryta przez arkusz nic nie dodaje, a gdy usunięto wiersz, którego poziomy są zaznaczone, znaczniki, które już się nie mieszczą, zostają zachowane jako nadmiar: edycja arkusza nie cofa obrażeń.

`boxes`, `fill`, `onFull`, `extra` i `kind` w kroku odpoczynku wymagają Capability API 1.40 w zestawie dostarczanym jako pakiet.

### Kara do rzutów

`resolution.penaltyFrom` wskazuje tor ran, którego kara dotyczy każdego testu zestawu. Jest deklarowana, nie domyślna: zestaw bez niej rzuca dokładnie tak jak przed wprowadzeniem torów ran.

DZIAŁANIE kary zależy od rodzaju rozstrzygania, tak samo jak znaczenie liczby z arkusza:

- W `dice-pool` **odejmuje kości z puli**, nie poniżej własnego `pool.min`. Przy `pool.min` równym 1 nawet postać na ostatnim poziomie rzuca jedną kością; przy `pool.min` równym 0 nie rzuca żadną i przegrywa bez rzutu.
- W `dice-sum` jest **stałym modyfikatorem rzutu**, włączanym do tej samej liczby co atrybut i wyszkolenie.

Wskazany tor musi być torem ran. Zwykły tor nie ma kary i wskazanie go jest odrzucane podczas importu. Wynik podaje zastosowaną karę, aby gracz rozumiał mniejszą liczbę kości, a blok arkusza dla Game Master pokazuje poziom i jego koszt.

### Modyfikatory z arkusza

Niektóre liczby w arkuszu towarzyszą każdemu rzutowi, którego dotyczą: ciężki plecak przy każdej wspinaczce, kara za pancerz przy każdym skradaniu, błogosławieństwo przy wszystkim. `resolution.adjust` to określa, w obu rodzajach:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` to wartość z arkusza, w tej samej postaci, w jakiej odczytuje ją wartość pochodna, łącznie z bieżącym stanem. Liczba ujemna odejmuje. Ember Roads sumuje objętość ekwipunku spakowanego przez postać w Burden, a tabela progów zamienia każde trzy jednostki na jeden punkt odejmowany od każdego rzutu Brawn. Tabela oparta na stanie bieżącym to sposób, w jaki forma lub postawa trafia do kości (zobacz Stany bieżące).
- `abilities` jest opcjonalne. Z nim modyfikator dotyczy tylko testu rzucanego jednym z tych atrybutów: samego atrybutu, umiejętności lub rzutu obronnego, które go używają, umiejętności rzucanej nim przez `with=` albo pary atrybutów, która go zawiera. Bez niego dotyczy każdego testu.
- Stosuje się go tam, gdzie karę za rany: jako kości w puli, z tym samym ograniczeniem `pool.min`, i jako stałą liczbę przy sumie, wewnątrz modyfikatora sumowanego przez zapis. Najwyżej osiem wpisów, sumowanych dla każdego testu.
- Walka według zestawu zasad dodaje go do każdego rzutu budowanego z arkusza, w chwili rozpoczęcia walki: atak rzucany atrybutem lub umiejętnością, rzut obronny, test przeciwstawny i inicjatywa odczytywane z atrybutu, umiejętności lub rzutu obronnego otrzymują wpisy dla tego atrybutu, a wszystko inne otrzymuje tylko wpisy dotyczące każdego rzutu.
- Postać, dla której nikt nie ma arkusza, nic z tego nie otrzymuje, tak samo jak nie otrzymuje modyfikatora.

Wynik podaje, co dodał arkusz (`adjust="-2"` w zapisie i wiersz na karcie rzutu), aby gracz widział, dlaczego rzut wypadł tak, a nie inaczej. Wymaga Capability API 1.38 w zestawie dostarczanym jako pakiet.

### Odpoczynki

Odpoczynek jest listą kroków odnowienia i rzeczy do wyczyszczenia. Każdy wskazuje jeden cel (`pool`, `poolGroup`, `listPools`, `track` lub `state`) i ustawia go (`"to": "max"`, `"to": "min"` albo liczba) lub zmienia (`"by": { "const": 1 }` albo `"by": { "fractionOfMax": 0.5 }`). Krok wskazujący tor ran może go tylko leczyć, więc jego `by` jest ujemne; zobacz wyżej. Krok wskazujący stan bieżący tylko go ustawia, na `"default"` albo jedną z jego wartości. Krok `poolGroup` z `fractionOfMax` zmienia każdą pulę grupy o jej własny ułamek; dodaj `"shared": true` (Capability API 1.77), aby zamiast tego obliczyć ułamek od maksimum całej grupy i rozdzielić wynik między pule grupy w kolejności, w jakiej wymienia je arkusz, każdej najwyżej tyle, ile jej brakuje. Długi odpoczynek z 5e, "połowa całkowitej liczby" kości wytrzymałości postaci przechowywanych w osobnej puli dla każdego rodzaju kości, to `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Tekst Game Master

- `checkGuidance` zastępuje wbudowany akapit mówiący Game Master, jak prosić o test. Podaj system i okoliczności rzutu. Game Master wskazuje tylko umiejętność i trudność. Engine rzuca i oblicza wynik z arkusza, więc nie proś modelu o matematykę.
- `sheetGuidance` wprowadza arkusze postaci do promptu. Wyjaśnij, które zasoby są ważne i kiedy je wydawać.
- `worldGuidance` jest opcjonalne i czytane raz, przy generowaniu świata, aby wymyślone realia pasowały do zasad: brak prochu, rzadka magia, chodzący zmarli. Nigdy nie trafia do tury.
- `sheetSummary` wybiera pola, wartości pochodne i wiersze list widoczne dla Game Master dla każdej postaci. Engine zawsze pokazuje modyfikatory atrybutów, wyszkolone umiejętności i rzuty obronne oraz bieżące wartości. Resztę skróć, bo wysyłana jest w każdej turze. `nameColumn` listy w podsumowaniu może być kolumną tekstową lub wyliczeniową (kolumna wyliczeniowa pokazuje etykietę wartości), a `columns` wskazuje do trzech kolejnych kolumn wiersza wypisywanych po nazwie, więc blok brzmi `Gear: Crowbar 1d6` zamiast samych nazw. Kolumna logiczna wypisuje swoją etykietę, gdy jest włączona. Oba wymagają Capability API 1.37 w zestawie dostarczanym jako pakiet.
- Nie musisz uczyć komendy arkusza w `sheetGuidance`. Engine sam uczy każdej komendy, z nazwami zadeklarowanymi w pliku, a gdy zestaw ma tor ran, dodaje komendę `op="damage"` do jego zaznaczania i wymienia jego poziomy oraz rodzaje obrażeń. Gdy zestaw ma stany bieżące, dodaje komendę `op="state"` i wymienia wartości, które każdy może przyjąć.

### Pełny opis zasad dla Game Master (Capability API 1.145)

Opcjonalne pole **najwyższego poziomu** `gmReference` zawiera pełny opis zasad zestawu dla Game Master, do 16 000 znaków. Umieść tu rozbudowane zasady rozstrzygania, a krótkie instrukcje dotyczące testów i zasobów zostaw w `gm.checkGuidance` i `gm.sheetGuidance`. Te pola oraz `gm.worldGuidance` nadal mają limit 1500 znaków; wskazówki warstw również zachowują dotychczasowe limity.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

Opis pojawia się pod nagłówkiem **Game Master rules reference** (opis zasad dla Game Master) w stałym prompcie systemowym, raz na żądanie. Nigdy nie jest kopiowany do przypomnienia wysyłanego w każdej turze. Jak każdy inny tekst bezpieczny dla promptu musi być jedną linią, bez znaków sterujących, nawiasów kwadratowych i klamer makr (`{{` i `}}`). Gdy żądanie nadal przekracza limit kontekstu po zwykłym dopasowaniu historii i budżetu odpowiedzi, opis jest skracany z oznaczonym miejscem cięcia, zanim zostaną przycięte podstawowe instrukcje. Pozostaw to pole nieustawione, aby zachować dotychczasowe prompty. Pakiet, który go używa, musi zadeklarować w manifeście `schemaVersion: 2` i `capabilityApi: { "major": 1, "minor": 145 }` lub nowsze.

## Zegary postępu drużyny i sceny (`clocks`)

Capability API **1.143** dodaje opcjonalny obiekt najwyższego poziomu `clocks`. Pomiń go, aby polecenia zegarów pozostały wyłączone. Obiekt jest ścisły: przyjmowane są tylko te trzy klucze.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` dopuszcza od jednej do sześciu różnych liczb całkowitych oznaczających liczbę segmentów, każdą od 2 do 12; domyślnie `[4, 6, 8]`. `max` to największa liczba zegarów przechowywanych naraz, od 1 do 12, domyślnie 8. Opcjonalny `text` to jedna bezpieczna dla promptu linia do 400 znaków, wyjaśniająca, kiedy Game Master ma tworzyć zegary i zaznaczać na nich segmenty. Pusty obiekt włącza wartości domyślne.

Zegary należą do drużyny lub sceny, nie do postaci. Przypomnienie dla Game Master w każdej turze wymienia ich nazwy i wypełnienie oraz uczy tych poleceń:

- `[clock: name="Alarm raised" size="6"]` tworzy pusty zegar. Niedozwolony rozmiar, istniejąca już nazwa (bez względu na wielkość liter) lub osiągnięcie `max` powodują odmowę utworzenia.
- `[clock: name="Alarm raised" tick="2"]` dodaje segmenty. Ujemne wartości je usuwają; wypełnienie mieści się w zakresie `0..size`. Pełny zegar jest ukończony, pozostaje widoczny i wlicza się do `max`, dopóki nie zostanie usunięty. Ujemne zaznaczenie może go ponownie otworzyć.
- `[clock: name="Alarm raised" clear]` usuwa wskazany zegar.

Nazwy to pojedyncze linie o długości od 1 do 100 znaków, bez cudzysłowów, nawiasów kwadratowych, znaków sterujących i klamer makr. Każdy znacznik żąda dokładnie jednej akcji. Polecenia są stosowane w kolejności odpowiedzi, więc zegar można utworzyć i przesunąć w tej samej odpowiedzi. Engine przepisuje każdy znacznik z `result="ok" now="4/6"` (lub `now="cleared"`) albo z `result="refused" reason="..."`. Pola wyniku podane przez model są odrzucane. Nieznane zegary i błędnie sformułowane żądania są odrzucane; w jednej odpowiedzi stosuje się najwyżej 40 poleceń.

Game Mode pokazuje obok stanu drużyny koło podzielone na segmenty, nazwę i wypełnienie. Znaczniki pozostają w zapisanej odpowiedzi jako potwierdzenia i są ukryte w narracji. Zegary są zapisywane w każdej migawce stanu gry jako `rulesetClocks`; brak danych oznacza brak zegarów. Ponowne generowanie zaczyna od poprzedniej migawki, kontynuacja od bieżącej, a wybranie lub usunięcie swipe'ów lub wiadomości przywraca zegary razem z resztą tej migawki.

## Arkusz drużyny: załoga, statek lub wspólne Story Points

Capability API **1.144** dodaje obok `sheet` opcjonalne pole najwyższego poziomu `party`. Zawiera ono jeden wspólny arkusz na grę, np. załogę z Blades, statek z Lasers & Feelings albo Story Points z Genesys:

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` używa tego samego schematu pól co `sheet.fields`; `pools` używa schematu `sheet.live.pools`, łącznie z `start`, `group`, `hideWhen` i `allowTemp`. Wymagane jest co najmniej jedno pole lub pula, a ich identyfikatory muszą być unikalne w obrębie arkusza drużyny. Identyfikatory postaci i drużyny mogą się pokrywać. Arkusze drużyny w tej wersji API nie mają sekcji, list, atrybutów, wartości pochodnych ani migracji arkusza postaci. `max` puli odczytuje stałą lub liczbowe pole drużyny. Formuły postaci nie mogą odczytywać wartości drużyny, a formuły drużyny – wartości postaci. `hideWhen` także wskazuje wyłącznie pola drużyny.

`advancement.fields` wskazuje pola typu number, text lub longtext, które Game Master może trwale zmieniać. `advancement.text` i `text` przyjmują po jednej bezpiecznej dla promptu linii do 400 znaków. Opcjonalne `summary` używa formatu `gm.sheetSummary`: jego `fields` wybierają pola drużyny; `derived` i `lists` muszą być puste. Bez podsumowania pokazywane są wszystkie widoczne pola drużyny. Pule pojawiają się zawsze.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` wybiera wspólny arkusz; pomiń `who`. Dotychczasowe `who="party"` nadal dotyczy każdej **postaci** i nigdy nie zmienia wspólnego arkusza. Ta wersja API dopuszcza na arkuszu drużyny `spend`, `restore` i `advance` pola. Nieznane arkusze, nieobsługiwane operacje, niewystarczające pule, niezadeklarowany rozwój i nieprawidłowe wartości są odrzucane i przepisywane z wynikiem Engine. Pule drużyny stosują tę samą arytmetykę wartości bieżącej i maksymalnej oraz te same wartości domyślne co pule postaci.

Game Master w każdej turze otrzymuje etykietę drużyny, pola i pule obok bloków arkuszy postaci. Game Mode oferuje obok portretów postaci zwijany arkusz drużyny tylko do odczytu, w tej samej prezentacji co arkusz postaci. Trwałe wartości są przechowywane raz, w metadanych czatu (`gamePartySheet`), obok `gameCharacterCards`, i współdzielą potwierdzenia rozwoju. Pule bieżące używają zarezerwowanego wpisu `$party` w `rulesetLive`; znormalizowane imiona postaci nie mogą z nim kolidować. Ponowne generowanie zaczyna od stanu sprzed odpowiedzi, a wybór lub usunięcie swipe'a przywraca zarówno trwałe, jak i bieżące wartości przez istniejącą historię. Zestawy bez `party` zachowują dotychczasowe działanie.

**Wspólne tworzenie drużyny (Capability API 1.163).** Arkusz drużyny może zawierać `lists` (do 12, zapisanych jak listy arkusza postaci), własny prowadzony `builder` i `fromMembers`: do 8 liczbowych pól drużyny odczytywanych z postaci drużyny, każde jako `{ "field", "count": true }` (liczba postaci) albo `{ "field", "sum": "<character number field>" }` (suma ich wartości, np. kropek Totem). Pola członków są obliczane z bieżącego stanu postaci przy każdym odczycie wspólnego arkusza, więc dołączenie lub odejście postaci od razu je zmienia. Jeśli drużyna ma listy, może je wskazywać jej `summary.lists`.

Kreator zapisuje się dokładnie tak jak kreator postaci (pule, kroki, wyceniane wiersze, oferty wydatków, profile) i podlega tym samym regułom względem własnych pól i list drużyny. Jego kroki katalogu i kopiowania wierszy mogą odczytywać katalogi zestawu zasilające listy drużyny. W Game Mode każdy gracz może otworzyć opcję Edit wspólnego arkusza, która oferuje prowadzoną konfigurację, i zapisać arkusz dla całej drużyny. Każdy zapis podaje wersję, na której go otwarto (`gamePartySheetRevision` w metadanych czatu, zwiększane przy każdym zapisie i przy zmianach wprowadzanych przez samą historię): zapis otwarty, zanim trafił zapis kogoś innego, jest odrzucany, pokazywany jest nowszy arkusz, a szkic gracza pozostaje otwarty, więc ponowny zapis to jego decyzja o zastąpieniu tamtego.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```

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
- `holds`: `"rows"` (domyślnie i we wszystkich katalogach sprzed tego wydania), `"creatures"` lub `"items"`. Katalog stworzeń jest bestiariuszem czytanym przez walkę, a katalog przedmiotów wymienia rzeczy niesione przez drużynę. Żaden z nich nic nie zapisuje w arkuszu, nie deklaruje `feeds` i nie pojawia się w selektorze. Zobacz niżej [Stworzenia](#creatures-a-bestiary-a-fight-reads) i [Przedmioty](#items-what-a-party-carries).
- `feeds`: od jednej do ośmiu list arkusza, do których mogą pisać wpisy katalogu. Wymagane dla katalogu wierszy, odrzucane dla katalogu stworzeń lub przedmiotów. Wpis nigdy nie zapisze do niewymienionej listy ani wartości niedozwolonej przez jej kolumny.
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
- Wiersz z `scaled` musi być jedynym wierszem wpisu dla tej listy, aby oznaczony wiersz arkusza zawsze pasował do jednej specyfikacji, albo (Capability API 1.92) każdy wiersz zapisywany przez wpis do tej listy musi mieć własną nazwę w kolumnie nazwy listy (`nameColumn` jej pul, a w przeciwnym razie w jej pierwszej kolumnie tekstowej). Wiersz arkusza jest wtedy dopasowywany do specyfikacji po tej nazwie, więc jedna cecha może dawać dwa użycia, z których każde rośnie niezależnie; wiersza, którego nazwę zmienił gracz, nie rusza się.

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

Wpis może zawierać opcjonalny blok `mechanics`, który opisuje jego działanie liczbowo: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (kości, np. `2d6`, lub stała liczba), `amountAdd` (wartość odczytywana z arkusza użytkownika i dodawana do wielkości, np. `{ "field": "level_fighter" }` dla Second Wind o wartości 1d10 plus poziom wojownika; wymaga `amount`, jest odczytywana tylko w walkach według zestawu zasad (walki Classic i Tactical w Engine używają wielkości w zapisanej postaci) i wymaga Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (jeden z rzutów obronnych karty i skutek sukcesu), `applies` (nakładane stany), `temporary` (punkty tymczasowe puli zdrowia), `scales` (wielkość rosnąca wraz z kartą), `cost` (pula zużywana przy użyciu), `perCostStep`, `targetsPerCostStep`, `budget` (zużywana część ekonomii akcji), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` i `check`.

Atak wymierzony we wrogów może przez `summons` zostawić coś, co uderza w późniejszych turach (Capability API 1.122). Dla Spiritual Weapon umieść `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` we wpisie jego ataku. Rzucenie wykonuje pierwszy atak i po zakończeniu reakcji zostawia broń obok pierwszego celu; anulowane rzucenie niczego nie zostawia. Późniejsze uderzenia zużywają tylko zadeklarowany budżet ekonomii akcji, zachowują poziom opłaty rzucenia na potrzeby skalowania obrażeń i otwierają te same okna reakcji. Odległości używają jednostki katalogu; pominięty ruch wynosi zero, a pominięty zasięg to jedno pole. Na planszy broń może uderzyć wroga w odległości ruchu plus zasięgu, ignorując ściany, i przesuwa się obok niego. Bez planszy w zasięgu jest każdy stojący wróg. Rundy odlicza się na końcu tur posiadacza, z wyjątkiem tury rzucenia. Przywołanie kończy się po dojściu do zera, po pokonaniu posiadacza albo gdy kończy się koncentracja jego wpisu. Ponowne rzucenie tego samego wpisu zastępuje jego przywołanie.

Wpis z `area` może pozostać na polu walki dzięki `zone` (Capability API 1.172): `{ "rounds", "anchor", "triggers", "atCast" }`. Strefa trwa przez `rounds` (od 1 do 1000) tur rzucającego, liczonych tak jak w przypadku przywołania, i kończy się wcześniej, gdy skończy się podtrzymująca ją koncentracja albo rzucający zostanie pokonany. `anchor: "point"` (domyślnie) zachowuje pola, na które ją rzucono; `anchor: "caster"` to wybuch wokół rzucającego, który podąża za nim, więc jego zasięg wynosi 0. `triggers` określa, kiedy strefa ponownie wywołuje własny efekt wpisu (amount, plus, save, applies) na jednym stworzeniu: `enter` (stworzenie w nią wchodzi albo dosięga go strefa niesiona przez rzucającego), `turn-start` lub `turn-end` (zaczyna lub kończy w niej turę). Stworzenie zostaje dosięgnięte najwyżej raz na turę, bez względu na wyzwalacz, a każdy dosięgnięty przez samo rzucenie liczy się w tej turze jako już dosięgnięty. To, kogo strefa dosięga, zależy od wpisu: `friendlyFire: false` pomija stronę rzucającego, leczenie lub wpis dla sojuszników działa tylko na nią, a strefa niesiona przez rzucającego nigdy nie dosięga jego samego. `atCast: false` sprawia, że strefa nic nie robi w chwili pojawienia się. Ponowne rzucenie wpisu zastępuje jego strefę. Plansza zabarwia jej pola, walka wymienia ją z liczbą pozostałych tur, a dziennik podaje każde dosięgnięcie. Bez planszy strefa obejmuje tych, na których ją rzucono, a `turn-start` i `turn-end` ich dosięgają.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

To jest Cloudkill. Spirit Guardians to `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` z `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`; Moonbeam to wybuch o rozmiarze 5 stóp z `"triggers": ["enter", "turn-start"]`.

Strefę utrzymywaną w punkcie można przesuwać i może ona zmieniać teren (Capability API 1.173). `move: { "budget", "distance" }` pozwala rzucającemu przesunąć ją w jego turze: walka oferuje "Move <zone>" za ten budżet, wybierane na planszy jak zwykły ruch, na dowolne pole w odległości `distance` od jej środka. `drift: { "distance" }` przesuwa ją o tyle prosto od rzucającego na początku każdej jego tury, zatrzymując się na krawędzi planszy. W obu przypadkach każdy, kogo strefa teraz obejmuje, a wcześniej nie obejmowała, zostaje dosięgnięty tak, jak mówi `enter`. Przesuwać się i dryfować może tylko wybuch utrzymywany w punkcie. `terrain: { "difficult": true }` sprawia, że wejście na każde jej pole kosztuje podwójnie każdego, kogo strefa dosięga (teren już trudny nie jest podwajany ponownie), a `terrain: { "perDistance": { "every", "amount", "damageType" } }` zadaje `amount` (kości i stała wartość, jak własna wielkość wpisu) każdemu, kogo strefa dosięga, za każde `every` przebyte w jej wnętrzu, bez rzutu obronnego, licząc łącznie przez kolejne ruchy. Dziennik podaje każde przesunięcie, dryf i zranienie.

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill dodaje `"drift": { "distance": 10 }`. Spike Growth to wybuch o rozmiarze 20 stóp bez własnej wielkości, z `"triggers": []` (działa wyłącznie przez teren), `"atCast": false` i `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

Strefa może zrobić więcej temu, kogo dosięga (Capability API 1.174). `breaksConcentration: true` sprawia, że koncentrujące się stworzenie dosięgnięte przez strefę wykonuje rzut obronny koncentracji zestawu przeciw trudności rzutu obronnego samego wpisu, przed efektem wpisu, i przy porażce traci koncentrację; wpis wymaga `save`. `damageCap` kończy strefę, gdy od pojawienia się zada łącznie tyle obrażeń, licząc dosięgnięcia i teren. Sleet Storm to wybuch o rozmiarze 40 stóp z `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` i `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith to wybuch z `"friendlyFire": false`, `"amount": { "flat": 20 }` i `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

Trudność, z jaką uwalnia się od stanu nałożonego przez wpis, może być trudnością rzutu obronnego tego wpisu (1.174): `"escapeDc": "save"` we wpisie `applies`, obok testu przeciwstawnego, którego `from.holding` to ten stan. Web i Black Tentacles unieruchamiają przez `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`, a test przeciwstawny, którym unieruchomione stworzenie próbuje się uwolnić, rzuca się przeciw trudności rzutu obronnego zaklęć rzucającego. Jeśli stan nałożyło coś bez trudności rzutu obronnego, uwolnienie się rozstrzyga test przeciwstawny przeciw jego posiadaczowi.

`use` przedmiotu może też zawierać `concentration` i `zone` (1.174), tak jak wpis katalogu, więc zwój z Cloudkill lub Moonbeam zachowuje trwały obszar, podtrzymywany koncentracją czytającego.

Przesuwana strefa może taranować, a jej teren może kosztować więcej (Capability API 1.175). `move: { ..., "ram": true }` przesuwa ją pole po polu prosto do miejsca docelowego; na pierwszym polu, na którym dosięga kogoś, kogo wcześniej nie obejmowała, zatrzymuje się, dosięga go jak przy taranowaniu (bez względu na wyzwalacze) i nie można jej już przesunąć w tej turze. Stworzenia, które w nią wchodzą, są dosięgane tylko zgodnie z jej wyzwalaczami. Flaming Sphere to wybuch o rozmiarze 5 stóp z `"triggers": ["turn-end"]` i `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (od 2 do 10) sprawia, że każdy krok w strefę kosztuje tyle zwykłych kroków, a teren już trudny nie kosztuje więcej: Plant Growth to `"terrain": { "costTimes": 4 }`. Zastępuje `difficult`, które oznacza `costTimes: 2`. `terrain.halvesSpeed: true` sprawia, że każdy krok wewnątrz kosztuje jeszcze dwa razy więcej, niezależnie od trudnego terenu: Spirit Guardians to `"terrain": { "halvesSpeed": true }`.

Pochwycenia nałożone przez zaklęcie można zerwać tylko tak, jak mówi zaklęcie (także 1.175). Test przeciwstawny uwalniania się z `"from": { "holding": "restrained", "escapable": true }` jest oferowany tylko przeciw pochwyceniu, które wskazuje `escapeDc`, więc ten sam test zrywa sieć, ale nigdy skamienienia. `applies[].escapeChecks` wskazuje testy, którymi można zerwać to pochwycenie, zamiast własnych testów atakującego z testu przeciwstawnego: Black Tentacles unieruchamia przez `"escapeDc": "save", "escapeChecks": ["might", "agility"]`, a Web przez `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` zadaje swoją wielkość, bez rzutu obronnego i zamiast własnego efektu strefy, każdemu, kto zaczyna w niej turę, będąc już przytrzymywanym tym stanem nałożonym przez jej rzucającego: `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }` z Black Tentacles.

Wpis lub użycie przedmiotu może leczyć dolegliwości (Capability API 1.176). `ends: { "conditions": [...], "count"? }` zdejmuje te stany z celu w podanej kolejności, najwyżej `count` z nich: Lesser Restoration to `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` stabilizuje umierający cel, który nie wykonuje już rzutów przeciw śmierci, i wymaga bloku walki z regułą `dying`: Spare the Dying. `revives: { "withinRounds", "health" }` celuje tylko w kogoś, kto zginął nie więcej niż tyle rund temu, i przywraca go z taką wartością: Revivify to `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. Wpis, który tylko kończy stany lub stabilizuje, jest oferowany tylko przeciw komuś, komu by pomógł; wpis rodzaju `utility` bez innego działania jest oferowany, dopóki leczy.

Obszary mogą być kwadratami, a trwałe obszary – ścianami (Capability API 1.177). `area.shape: "box"` to kwadrat o boku `size`, którego bliższy narożnik leży na wskazanym polu i który rozciąga się w stronę od twórcy; wzdłuż osi, na której twórca leży w jednej linii z tym polem, jest zamiast tego wyśrodkowany na nim. Bez `range` przylega do twórcy. Web to `"area": { "shape": "box", "size": 20 }` z zasięgiem 60. `area.shape: "wall"` zawsze pozostaje na polu walki, więc wymaga `zone`: ma długość `size` i grubość `width` (bez niego jedno pole) i przebiega przez wskazane pole w poprzek linii od twórcy albo stamtąd w stronę pola `toward` z wyboru; `"ring": <diameter>` pozwala rzucającemu ułożyć ją zamiast tego jako pierścień o takiej średnicy wokół wskazanego pola, gdy wybór zawiera `"ring": true`. Ściana nie potrzebuje wyzwalacza: Wind Wall działa tylko w chwili pojawienia się. Ściana nigdy nie jest przesuwana, nie dryfuje i nie podąża za twórcą. `zone.blocks: ["move", "sight"]` zamyka jej pola dla ruchu, widzenia lub obu, dopóki stoi, a każdy, kto stoi tam, gdzie wyrasta ściana, zostaje przeniesiony na najbliższe wolne pole (po wybranej stronie, gdy pole po niej jest równie blisko): Wall of Stone blokuje oba, Wall of Force ruch, a Wall of Fire widzenie. `zone.side: { "distance", "triggers" }` sprawia, że pola w odległości `distance` od jednej strony dosięgają zgodnie z własnymi `triggers`, obok własnych pól ściany; `side` z wyboru określa, której strony: `near` od strony twórcy (wewnątrz pierścienia) lub `far` (na zewnątrz), domyślnie far. Wall of Fire to `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

Widzenie ma znaczenie (Capability API 1.178). `combat.senses` wymienia zmysły, które widzą tam, gdzie nie widzą oczy, każdy jako `{ "id", "label", "sheet"?, "blind"? }`: zasięg postaci jest odczytywany z jej arkusza przez `sheet` (przy zerze go nie ma), stworzenie ma własny jako `"senses": { "darkvision": 60 }` w jednostce odległości zestawu, a zmysł `blind` (ślepowidzenie, wyczucie drgań) działa bez oczu. Blok wymaga wtedy `combat.distance`. Strefa z `obscures` ukrywa wszystko, co jest w niej, i wszystko, co widać przez nią, przed każdym, kto nie ma w zasięgu żadnego ze zmysłów wymienionych w jej `pierced`: Fog Cloud to `"obscures": {}`, a Darkness to `"obscures": { "pierced": ["blindsight", "truesight"] }`. Taka strefa nie potrzebuje wyzwalacza, a wpis `utility`, który jedynie pozostawia obszar (Fog Cloud, Darkness, ściana), jest w menu i umieszcza się go tam, gdzie wybierze rzucający. Wpis `combat.conditions` z `unseen` ukrywa posiadacza w ten sam sposób: niewidzialność to `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` określa skutki: `unseenAttacks: true` daje atakowi ułatwienie, gdy cel nie widzi atakującego, i utrudnienie, gdy atakujący nie widzi celu, a `eyes` wskazuje zmysł będący wzrokiem (tak jak wskazuje go `lacks` stanu), więc oślepione stworzenie widzi tylko zmysłem `blind`. Wpis lub akcja stworzenia z `seen: true` może wybierać tylko cele, które twórca widzi, zgodnie z formułą "stworzenie, które widzisz w zasięgu". Wybuch lub kwadrat można umieścić kilka razy naraz przez `area.copies` (od 2 do 10), przy czym każda kopia styka się z inną, a gracz rozmieszcza każdą z nich: Fire Storm to `"area": { "shape": "box", "size": 10, "copies": 10 }`. Strefa umieszczona kilka razy pozostaje tam, gdzie ją rzucono.

Strefy mogą działać na każdego, kto w nich stoi (Capability API 1.179). `combat.components` wymienia, czego może wymagać użycie czegoś, każdy element jako `{ "id", "label" }` (komponenty werbalne, somatyczne i materialne z 5e), a wpis lub akcja stworzenia wymienia własne w `components`. `inside` strefy nakłada `conditions` na każdego, kto w niej jest, i chroni go przed typami obrażeń z `immune`, dopóki w niej pozostaje; jej `forbids: { "components": [...] }` uniemożliwia używanie wewnątrz czegokolwiek, co ich wymaga, tak jak `forbids` stanu robi to dla jego posiadacza (zakneblowanie). Silence to `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. `wards: { "catalogs": [...], "maxLevel": N }` strefy chroni każdego wewnątrz przed czymkolwiek z tych katalogów użytym spoza niej na poziomie N lub niższym, ocenianym według poziomu, na jakim to opłacono: Globe of Invulnerability to `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. Stan odbierający budżety (`budgets` z ujemnym `flat`), nałożony w trakcie tury posiadacza, odbiera je także w tej turze, więc nieudany rzut obronny przeciw Stinking Cloud na początku tury kosztuje akcję tej tury.

Zmysły i widzenie sięgają dalej (Capability API 1.180). Stan nałożony przez wpis może się kończyć, gdy posiadacz działa: `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` zdejmuje go, gdy posiadacz wykona atak lub użyje wpisu ze wskazanego katalogu, a użycie przedmiotu z `"casts": "spells"` (zwój, różdżka) liczy się jako rzucenie zaklęcia z tego katalogu. Atak lub zaklęcie, które zakończyło stan, nadal z niego korzystało, więc Invisibility daje ułatwienie temu jednemu atakowi, a potem znika. To, co stojąca strefa robi sama, nie jest działaniem rzucającego. Stan w `combat.conditions` albo efekt `worn` lub `carried` przedmiotu może dawać zmysły z zasięgiem w jednostce odległości zestawu, `"senses": { "darkvision": 60 }`; dopóki działa, liczy się dłuższy z tego zasięgu i własnego zasięgu posiadacza, więc działają zaklęcie Darkvision, True Seeing (`{ "truesight": 120 }`) i gogle nocy. Stan z `"cancelsUnseen": true` pozwala każdemu widzieć posiadacza bez względu na to, jaki stan go ukrywa, tak jak Faerie Fire obrysowuje niewidzialnych; zasłaniające strefy i ściany nadal go ukrywają.

Osłony, rzuty obronne, rzucanie zaklęć przez potwory i zwoje sięgają dalej (Capability API 1.181). `wards` strefy porównuje poziom, na jakim opłacono zaklęcie, chyba że zawiera `"by": "base"`, które porównuje własny poziom zaklęcia niezależnie od opłaty, tak jak robi to Globe of Invulnerability. `"maxLevelPerCostStep": 1` blokuje o jeden poziom więcej za każdy krok, o jaki rzucenie samej osłony opłacono powyżej jej poziomu bazowego. `save` wpisu lub akcji stworzenia może określać, przeciw czemu jeszcze się liczy, `"against": { "damage": ["poison"] }`, więc stosuje się do niego modyfikator rzutów obronnych `against` truciźnie, oraz kto odnosi sukces bez rzutu: `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (wystarczy jeden z warunków), czego wymaga Stinking Cloud. `spellcasting` stworzenia może określać, czego wymagają jego zaklęcia, zamiast własnych `components` każdego wpisu, dla całej cechy lub dla każdego zaklęcia osobno, z `[]` dla wrodzonego rzucania zaklęć, które niczego nie wymaga, więc Silence go nie powstrzymuje. Użycie przedmiotu może mieć `"kind": "utility"`, gdy jedynie pozostawia obszar (zwój Fog Cloud, Darkness, Silence lub Globe of Invulnerability); wymaga wtedy `area` i `zone`.

Odepchnięcia, wiatry i gogle (Capability API 1.182). `"push": 15` wpisu odpycha każdego, kogo trafi i kto nie obroni się rzutem, o 15 jednostek odległości katalogu prosto od twórcy, zatrzymując się na czymkolwiek twardym lub na kimkolwiek stojącym; strefa odpycha w ten sam sposób każdego, kogo dosięga. Strefa utrzymywana przez rzucającego (`"anchor": "caster"`) może teraz być także linią lub stożkiem, a nie tylko wybuchem: jest skierowana tak, jak ją rzucono, i podąża za rzucającym, a `"turn": { "budget": "bonus" }` pozwala mu w jego turze wydać ten budżet, by obrócić ją w inną stronę, dosięgając każdego, kogo teraz obejmuje, tak jakby w nią wszedł (Gust of Wind z 5e). `terrain` strefy z `"towardCaster": true` sprawia, że trudny teren liczy się tylko dla kroku zbliżającego poruszającego się do rzucającego. Zmysł dawany przez stan lub przedmiot może zamiast zasięgu mieć postać `{ "add": 60 }`, co dodaje się do własnego zasięgu tego zmysłu u posiadacza albo daje 60 komuś, kto go nie ma (gogle nocy z 5e).

Strefy, które wybuchają później lub się wypalają (Capability API 1.183). Strefa z `"detonates"` nic nie robi, dopóki stoi, ani w chwili rzucenia: gdy się kończy, bo skończyła się jej koncentracja, minęły jej rundy albo rzucono ją ponownie, raz wywołuje własny efekt wpisu na wszystkich wewnątrz. `"grows": { "dice": "1d6" }` dodaje tyle do jej wielkości na końcu każdej tury rzucającego, także tej, w której ją rzucono, więc rzuca się tymi samymi kośćmi co własną wielkością wpisu; `"touched": true` sprawia, że każdy, kto wejdzie na jej środek, wykonuje rzut obronny wpisu i odpala ją przy porażce (Delayed Blast Fireball z 5e). Pozostaje tam, gdzie ją rzucono. Strefa z `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` zapala się od obrażeń jednego z tych typów, które trafią w dowolne jej pole lub w kogokolwiek wewnątrz; wypala się, gdy znów nadejdzie tura rzucającego, kończąc zaklęcie, a w międzyczasie zadaje swoją wielkość bez rzutu obronnego każdemu innemu, kto zaczyna w niej turę (Web z 5e).

Stworzenia także odpychają (Capability API 1.184). Akcja stworzenia przyjmuje `"push": 60` w jednostce odległości zestawu, tak jak wpis katalogu: każdy, kogo trafi, zostaje odepchnięty o tyle prosto od stworzenia, a przy `save` – tylko wtedy, gdy go nie zda, więc `"onSuccess": "none"` zachowuje obrażenia i oszczędza tylko odepchnięcie i to, co nakłada `applies` (Tail żółwia smoczego). Użycie przedmiotu może nadać linii `width`, jak 60 na 10 stóp zwoju Gust of Wind.

To, czym jest stworzenie, ma większe znaczenie (Capability API 1.185). Rzut obronny może zawierać `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`, więc cel tego typu rzuca dwa razy i zachowuje gorszy wynik (Sunbeam); `"maxAgainst": { "types": ["plant"] }` wpisu zadaje celowi tego typu maksymalne obrażenia (Blight). `targetTypes` może też zawierać `"abilityAtMost": { "int": 3 }` dla celu, którego wartość wynosi najwyżej tyle (stworzenie zapisane bez tej wartości nie jest wykluczane), oraz `"notImmuneTo": ["charmed"]` (Sleep). Modyfikator stanu może sprawić, że ataki rzuca się dwa razy: `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` to własne ataki posiadacza przeciw temu, kto nałożył na niego stan (Chill Touch), a `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` to ataki wykonywane przeciw posiadaczowi przez atakujących tego typu (Protection from Evil and Good). Zmiana rzutów obronnych może mieć postać `"against": { "from": { "types": ["dragon"] } }`, co pasuje do każdego rzutu obronnego przeciw czemuś, co zrobiło stworzenie tego rodzaju (Dragon Scale Mail).

Akcje stworzenia mogą odnawiać się razem (Capability API 1.186): nadaj każdemu `"recharge"` tę samą `"group"` i te same kości, a użycie jednej akcji zużyje obie, natomiast jeden rzut na początku tury stworzenia przywraca obie (dwie bronie oddechowe metalicznego smoka). Cios może mieć `"charge"`: `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` dodaje swoje klauzule, gdy ruch stworzenia w tej turze zakończył się rozbiegiem długości co najmniej `atLeast` prosto na trafianego, przy czym każdy krok zbliżał je do niego o jedno pole; wtedy cel wykonuje rzut obronny, a przy porażce (lub zawsze, gdy rzutu nie ma) zostaje odepchnięty i otrzymuje stany (Charge minotaura). Szarża dotyczy ciosu w jeden cel i jest mierzona tylko na planszy.

`attack` przedmiotu może określać więcej o tym, w co trafia (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` dodaje do trafienia przeciw celowi tego typu (mace of smiting). Klauzula `plus` może zawierać `"not": { "types": ["construct", "undead"] }`, by pomijać cele tego typu, `"blow": "ranged"`, by liczyć się tylko przy ciosie rzuconym lub wystrzelonym (dwarven thrower), albo `"melee"`, by liczyć się tylko przy ciosie w zasięgu, oraz `"tempHp": true`, by dać władającemu tymczasowe punkty życia równe zadanym obrażeniom (sword of life stealing). Stan `onHit` może wskazywać `"targetIs"` (giant slayer przewracający olbrzyma) i `"oncePerTurn": true` (sword of wounding). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` od razu zabija cel, któremu trafienie zostawiło `healthAtMost` lub mniej, przy nieudanym rzucie obronnym, jeśli go przewidziano, i zużywa wtedy ładunki przedmiotu (nine lives stealer); `"immuneTo": ["slashing"]` oszczędza cel niewrażliwy na ten typ (vorpal sword). Zdrowie odczytuje się po obrażeniach ciosu.

`live.conditions` arkusza, `clear.conditions` odpoczynku i `combat.conditions` mieszczą do 320 wpisów (Capability API 1.269; 160 od 1.188, 80 wcześniej). Modyfikator `to: "attacks"` może wskazywać `"ability": "str"`, aby zmieniał tylko ataki wykonywane tym atrybutem (Weakening Breath złotego smoka), a modyfikator `to: "checks"` może wskazywać `"abilities": ["str"]`, aby zmieniał tylko testy jednego z tych atrybutów, łącznie z testami przeciwstawnymi i testami umiejętności tego atrybutu (Rage barbarzyńcy). Akcje z bloku statystyk stworzenia nie wskazują atrybutu, więc modyfikator ataków zawężony do atrybutu nigdy ich nie dotyczy.

Stan w `combat.conditions` może ranić posiadacza (Capability API 1.189): `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` zadaje te obrażenia na początku każdej jego tury (lub przy `"turn-end"` na końcu), w imieniu tego, kto nałożył stan, przed jakimkolwiek rzutem obronnym, który go kończy. `"stacks": 10` pozwala nałożyć go ponownie, dopóki działa, do tylu razy, a jego obrażenia zadaje się raz za każde nałożenie (sword of wounding); zakończenie stanu kończy wszystkie nałożenia. `"onePerSource": true` utrzymuje go u jednego posiadacza na źródło: nałożony na kogoś innego, opuszcza tego, kto miał go z tego samego źródła (sworn enemy z oathbow). Wpis `against` ataku przedmiotu może wskazywać `"marked": "sworn"` zamiast `is` lub obok niego, co pasuje do celu z tym stanem nałożonym przez władającego, a poza `toHit` może zawierać `"mode": "advantage"`, `"ignoresCover": true` (osłona mniejsza niż całkowita nic nie daje) i `"ignoresLongRange": true`; klauzula `plus` także może zawierać `"marked": "sworn"` (3d6 obrażeń kłutych z oathbow). Akcja z bloku statystyk stworzenia może wskazywać `"ability": "str"`, czyli atrybut, którym wykonuje się jej atak, więc dotyczą jej zmiany ataków lub obrażeń zawężone do atrybutu.

Wpis `modes` ataku przedmiotu może być zupełnie innym sposobem użycia broni (Capability API 1.190): `"range": { "normal": 120 }` to jej zasięg w tym trybie, w jednostce odległości zestawu; `"plus"` dodaje klauzule do trafienia, tak jak własne klauzule ataku; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` to błyskawica, przed którą każdy stojący między władającym a celem (poza nimi dwoma) wykonuje rzut obronny, zanim rzuci się atak; a `"charges": 1` zużywa tyle własnych ładunków przedmiotu, więc tryb jest oferowany tylko wtedy, gdy je ma (javelin of lightning: `charges.max` 1 i `stack` 1 w przedmiocie). Linia potrzebuje planszy, po której biegnie.

Stan bojowy z efektem `"cannot-heal"` blokuje wszelkie leczenie posiadacza, dopóki trwa, a dziennik to podaje (Capability API 1.191): Chill Touch z 5e. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` w stanie bojowym chroni przed tymi stanami tylko wtedy, gdy nakłada je stworzenie spełniające `from`; stan już nałożony pozostaje (Protection from Evil and Good). `targetTypes.abilityAtLeast` zaklęcia jest dolną granicą, tak jak `abilityAtMost` górną: `{ "int": 5 }` pomija stworzenie o Intelligence 4 lub niższej (Hideous Laughter), a stworzenie zapisane bez tej wartości nie jest wykluczane. `against.actions` modyfikatora rzutów obronnych wskazuje akcje po identyfikatorze, nazwie lub wspólnej grupie odnowienia, bez względu na wielkość liter, i zawęża wszystko inne, co mówi `against`: `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` to oddech smoka lub Frightful Presence, nigdy jego Wing Attack, a liczy się też powtarzany rzut obronny kończący stan nałożony przez jedną z nich.

Atak przedmiotu może mieć więcej efektów dodatkowych (Capability API 1.192). `"ignoresResistance": true` przepuszcza jego obrażenia przez odporność celu na własny typ obrażeń ataku, łącznie z odpornością na wszystko, podczas gdy klauzula `plus` innego typu nadal jest zmniejszana o połowę (obrażenia cięte vorpal sword); niewrażliwość nadal działa. `"saved"` wpisu `slay` wymienia stany, w tym samym kształcie co `applies`, które zamiast tego otrzymuje cel zdający rzut obronny przeciw zabiciu: `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` to przestraszenie biesa wobec władającego do końca następnej tury władającego z mace of disruption. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` sprawia, że każdy inny atak bronią wykonywany przez władającego jest rzucany w tym trybie, dopóki stoi stworzenie, na które nałożył `sworn`, albo tylko ataki dystansowe przy `"ranged": true` (oathbow). A w walce bez planszy akcję obszarową (stworzenia lub zaklęcia) można skierować na postacie po obu stronach, nigdy na jej twórcę, bo dosięga każdego stworzenia w obszarze; `friendlyFire: false` ogranicza ją do drugiej strony, tak jak na planszy.

Test przeciwstawny może być testem przeciw stałej liczbie zamiast porównania rzutów (Capability API 1.193). Pomiń `defender` i podaj `"difficulty": 15`; działający rzuca najlepszy ze swoich testów `attacker` i wygrywa, gdy ją osiągnie. `"targets"` określa, na kim można go wykonać: `"enemy"` (domyślnie), `"ally"` lub `"any"`, łącznie z samym działającym. `"targetHolds": "wounded"` oferuje go tylko przeciw celowi z tym stanem, a `"targetDying": true` tylko przeciw komuś, kto umiera i nie jest jeszcze ustabilizowany. `onWin.stabilizes` stabilizuje umierający cel. Test Wisdom (Medicine) o trudności 15, który kończy rany zadane przez sword of wounding, to więc `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, a test o trudności 10 ratujący umierających to `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. Walka pulami liczy sukcesy, więc odrzuca `difficulty`. `"healedOnlyByRest": true` ataku przedmiotu blokuje odebrane punkty życia: żadne leczenie nie podnosi posiadacza powyżej maksimum pomniejszonego o zablokowaną część, a każdy odpoczynek je przywraca i zdejmuje blokadę. `harms` stanu bojowego przyjmuje to samo `"healedOnlyByRest": true`, więc rany zostawiane przez miecz także blokują to, co odbierają.

Rozmiar może zajmować więcej niż jedno pole (Capability API 1.194). Nadaj wpisowi `combat.sizes.order` liczbę `"cells"`, `{ "id": "large", "label": "Large", "cells": 2 }`, a stworzenie tego rozmiaru zajmuje na planszy kwadrat o boku z tylu pól, przy czym jego własne pole to lewe górne: Large w 5e to 2, Huge 3, a Gargantuan 4. Zostaje umieszczone tam, gdzie mieści się w całości, w miejscu najbliższym temu, w którym miało stanąć. Zasięg i odległość liczy się od najbliższego zajmowanego pola i do niego, więc miecz sięga ogra z miejsca obok dowolnego z jego czterech pól; stworzenie porusza się tylko tam, gdzie mieści się w całości, i nikt nie przechodzi przez żadną jego część; obszar je obejmuje, gdy którekolwiek z jego pól jest w środku; odepchnięcie przesuwa je w całości; a widoczność i osłonę ocenia się od tego z jego pól, które jest najbardziej odsłonięte. Rozmiar bez `cells` zajmuje jedno pole, dokładnie jak wcześniej.

Stan może powiększać lub pomniejszać posiadacza (Capability API 1.195). Nadaj wpisowi `combat.conditions` `"size": { "steps": 1 }`, a dopóki stan działa, posiadacz jest o tyle rozmiarów dalej w `combat.sizes.order` albo wstecz przy liczbie ujemnej, nigdy poza pierwszy lub ostatni: Enlarge z 5e to `1`, a Reduce `-1`. Jego zasięg, to, jakie obszary go obejmują, i wszystko, co pyta o jego rozmiar, odczytuje nowy rozmiar, a gdy stan się kończy, posiadacz wraca do własnego rozmiaru. Na planszy ten, kto rośnie, zajmuje w nowym rozmiarze obszar obejmujący wszystkie pola, na których stał, o ile mieści się on na wolnym terenie z dala od innych, albo największy mniejszy rozmiar, który się mieści, więc ogr powiększony w korytarzu rośnie tylko tak bardzo, jak pozwala korytarz; ten, kto się kurczy, zachowuje swoje lewe górne pole. Dziennik podaje, kto się zmienił i w co. Wymaga `combat.sizes`; połącz go z modyfikatorem `damage` dla kości broni i trybem `checks` oraz `saves` dla Strength, aby odtworzyć resztę zaklęcia.

Wpis może wybierać cele według tego, ile zdrowia im zostało (Capability API 1.196). `"healthPool": { "dice": "5d8" }` w jego `mechanics` rzuca się raz przy użyciu i rozdziela, zaczynając od celu z najmniejszą ilością pozostałego zdrowia: każdy cel jest objęty działaniem tylko wtedy, gdy jego zdrowie nie przekracza tego, co zostało w puli, i wtedy je z niej zużywa, a pozostałe cele są całkowicie pomijane, tak jak działają Sleep i Color Spray z 5e; `perCostStep` zwiększa pulę, gdy rzuca się na wyższym poziomie. `"healthAtMost": 150` działa tylko na cel, który ma tyle zdrowia lub mniej, jak Power Word Stun; `"kills": true` od razu zabija każdego, na kogo działa, więc Power Word Kill to `"healthAtMost": 100, "kills": true`. Oba odczytują zdrowie, które zostało celowi, po tym, jak `targetTypes` określiło, kogo w ogóle może objąć. Dziennik podaje, co wyrzuciła pula i na kogo wystarczyła.

Modyfikator obrażeń może rzucać własnymi kośćmi ciosu więcej razy (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` na stanie sprawia, że 1d8 + 2 kilofa bojowego zadaje 2d8 + 2, dopóki stan działa, tak jak broń powiększonego duergara; stała część pozostaje bez zmian, trafienie krytyczne podwaja dodatkowe kości tak jak resztę, a średnia w menu je uwzględnia. Zmienia obrażenia zadawane przez cios i nic więcej. Akcja stworzenia z `"self": true` wykonana w jego własnej turze trafia teraz w samo stworzenie, jak już wcześniej działo się w reakcji, więc jej `applies` zostają nałożone.

Strefa może zadawać przy wyzwalaczach inny typ obrażeń niż w chwili pojawienia się (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` we wpisie, którego własny `damageType` to `"piercing"`, zadaje obrażenia kłute temu, wokół kogo pojawia się ściana, a cięte temu, kto wejdzie w nią później, tak jak Wall of Thorns z 5e. Wymaga własnego `amount` wpisu oraz wyzwalacza, strony lub taranowania, przy którym zadaje obrażenia, i wskazuje jeden z `combat.damageTypes`, jeśli zestaw je deklaruje.

Pula zdrowia może pomijać niektóre cele (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` obok `healthPool` pomija każdego, kto ma jeden z tych stanów, i nie zużywa na niego nic z puli, tak jak Sleep z 5e ignoruje nieprzytomnych; `"unseeing": true` robi to samo z każdym, kto nie widzi twórcy wpisu (jest oślepiony albo nie ma do niego linii wzroku), tak jak Color Spray ignoruje stworzenia, które nie widzą. Wskazuje `conditions`, `unseeing` lub oba i wymaga `healthPool`.

Ściana może składać się z segmentów, które są atakowane i niszczone pojedynczo (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` to Wall of Ice z 5e: każdy panel o boku 10 stóp ma klasę pancerza 12 i 30 punktów życia oraz otrzymuje podwójne obrażenia od ognia (`resist` i `immune` działają tak samo). Atak wymierzony w jednego wroga lub w kogokolwiek, który zadaje obrażenia, można zamiast tego skierować na segment: jego opcja wymienia pola, które może zaatakować, jako `walls`, a wybór wskazuje jedno z nich jako `wall`. Atak jest rzucany, a obrażenia zadawane tak jak przeciw stworzeniu, a dziennik podaje, ile segment otrzymał i ile mu zostało. Segment zredukowany do 0 zostaje zniszczony: przestaje blokować, a każdy, kto w niego wejdzie (albo zacznie lub skończy tam turę, zgodnie z jego `triggers`), otrzymuje jego `amount`, raz na turę, wykonując rzut obronny `save` przeciw trudności samego wpisu, by otrzymać połowę (`onSave: "none"`, by nie otrzymać nic). Segmenty wymagają ściany z `blocks`, a `save` zniszczonego segmentu wymaga własnego `save` wpisu.

Wpis może przesuwać tory bieżące arkusza i zwracać zablokowane zdrowie (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` zdejmuje poziom wyczerpania z tego, kogo trafi, tak jak Greater Restoration z 5e, a `"by": 1` we wpisie z rzutem obronnym (Sickening Radiance) dodaje jeden temu, kto go nie zda. Każdy tor pozostaje we własnych granicach, poziomy zmniejszające o połowę maksimum zdrowia działają od razu, a osiągnięcie poziomu z `defeats` zabija. `"unseals": true` zwraca zdrowie, które przywróciłby tylko odpoczynek (to, co odebrał cios z `seals`), tak jak Greater Restoration kończy zmniejszenie maksimum punktów życia. Wpis, który leczy wyłącznie w ten sposób, jest oferowany tylko przeciw komuś, komu by pomógł. `broken` segmentu ściany może mieć własne `perCostStep`, dodawane raz za każdy krok, o jaki rzucenie opłacono powyżej poziomu bazowego: mroźne powietrze Wall of Ice, `{ "dice": "1d6" }`. Tory to zwykłe tory, nie tory ran, a `unseals` wymaga zdrowia przechowywanego w punktach.

Stan nałożony przez wpis może kończyć się razem z innym stanem, który ten wpis nakłada (Capability API 1.202). W `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, czyli w Hypnotic Pattern z 5e, obezwładnienie kończy się zawsze wtedy, gdy kończy się zauroczenie: po rzucie obronnym, wyleczeniu, przerwaniu koncentracji rzucającego, gdy sojusznik obudzi ofiarę albo gdy skończy się walka. Kończy się tylko stan nałożony przez to samo użycie, a dziennik podaje przyczynę. `endsWith` wskazuje inny stan z tej samej listy `applies` (albo listy `onEnd`, `charge` lub `saved`), nigdy własny.

Akcja stworzenia może obniżać maksimum zdrowia celu (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` w Life Drain upiora każe celowi wykonać ten rzut obronny w chwili trafienia; przy porażce otrzymane obrażenia odejmuje się zarówno od zdrowia, jak i od maksimum, a żadne leczenie nie przywraca go przed odpoczynkiem. Przy `"lasting": true` (Slam glinianego golema) nie przywraca go nawet odpoczynek, a jedynie wpis z `unseals` (Greater Restoration). Cel, którego maksimum spadnie w ten sposób do 0, ginie. Arkusz przechowuje to, czego nie przywraca żaden odpoczynek, jako `lasting` swojej puli, wewnątrz `sealed`. Wymaga zdrowia przechowywanego w punktach.

Leczenie może wykonać jedno ze swoich działań zamiast wszystkich (Capability API 1.204). Przy `"cureOneOf": true` wpis, który kończy (`ends`) jakieś stany, przesuwa `tracks` i ma `unseals` (Greater Restoration z 5e: zauroczenie, skamienienie, poziom wyczerpania albo maksimum punktów życia), wykonuje dokładnie jedno z nich: każde jest oferowane jako tryb opcji (stan, tor lub pula zdrowia, według etykiety), tak jak tryby broni, a użycie bez wybranego trybu wykonuje pierwsze z nich, w tej kolejności, które ma u celu zastosowanie. Wymaga co najmniej dwóch działań do wyboru.

Obniżenie maksimum może nie wymagać własnego rzutu obronnego (Capability API 1.235). `reducesMax` bez `save` i `difficulty` obniża maksimum o obrażenia każdego trafiającego ciosu (Bite wampira z 5e); przy `"onFailedSave": true` – tylko wtedy, gdy cel nie zdał własnego rzutu obronnego wpisu (Harm z 5e, wpis katalogu z rzutem obronnym; tam `reducesMax` nigdy nie ma własnego rzutu). `damageType` liczy tylko obrażenia tego typu (nekrotyczne z Bite), a `"heals": true` zwraca twórcy tyle punktów życia, o ile obniżył maksimum. Mechanika katalogu także przyjmuje `reducesMax`, a `leavesAtLeast` nie pozwala, by obrażenia wpisu sprowadziły cel poniżej tylu punktów życia (Harm zostawia 1). `targetHolds` w akcji stworzenia lub mechanice katalogu ogranicza, w kogo można ją wymierzyć: w kogoś, kto ma jeden z jej `conditions`, albo jeden z jej `fromSelf` nałożony przez twórcę akcji (Bite: pochwycony przez wampira albo obezwładniony lub unieruchomiony).

Stan może dawać posiadaczowi własne użycia (Capability API 1.236). `actions` stanu bojowego wymienia wpisy katalogu (`spells/break-enchantment`), których posiadacz może używać, dopóki ma ten stan: są w menu tylko wtedy, nie kosztują nic z arkusza poza budżetem zużywanym przez każdy z nich i są rzucane z liczbami samego posiadacza, tak jak jego zaklęcia (stworzenie rzucające zaklęcia używa swoich wartości rzucania). Wpis z `"endsCondition": "<condition>"` po użyciu kończy ten stan u użytkownika, a także podtrzymującą go koncentrację, jeśli należy do użytkownika: Dispel Evil and Good z 5e, którego Break Enchantment i Dismissal kończą zaklęcie. `ends.from` (test typu i tagu) leczy tylko to, co nałożyło stworzenie przechodzące ten test: Break Enchantment kończy zauroczenie lub przestraszenie spowodowane przez niebianina, żywiołaka, fey, biesa lub nieumarłego, a zostawia te spowodowane przez kogokolwiek innego. `dismisses` usuwa każdego, kogo trafi i kto nie zda rzutu obronnego, z walki, żywego, poza planszę i poza kolejkę inicjatywy: `true` na stałe (Dismissal) albo `{ "while": "<condition>" }` na tak długo, jak ma ten stan, który musi nałożyć ten sam wpis (Banishment z 5e). Jego czas biegnie wtedy w turach rzucającego, a gdy się skończy, z upływem czasu, po rzucie obronnym lub przerwaniu koncentracji rzucającego, usunięty wraca tam, gdzie był, albo na najbliższe wolne miejsce, w którym się mieści. Przy `gone` (test typu i tagu) ktoś, kto przejdzie ten test i był pod wpływem stanu przez cały jego czas, już nie wraca.

Walka może zacząć się od zaskoczenia części uczestników (Capability API 1.237). Scena określa, kogo: starcie, z którego pochodzi, oznacza ich przez `"surprised": true`, zarówno w drużynie, jak i wśród wrogów. W pierwszej turze nie mogą się ruszać ani działać, a ich menu zawiera tylko zakończenie tury; nie wykonują reakcji ani użyć legendarnych, dopóki ta tura lub pierwsza runda się nie skończy, zależnie od tego, co nastąpi wcześniej. Stan bojowy z `"cannotBeSurprised": true` sprawia, że posiadacz nigdy nie zostaje zaskoczony: Foresight z 5e. Wpis katalogu z `"ignoresSurpriseWith": "<catalog>/<entry>"` wskazuje użycie, które posiadacz może wykonać nawet zaskoczony, a jego wykonanie od razu kończy zaskoczenie, więc reszta tury należy do niego: Feral Instinct z 5e, który pozwala zaskoczonemu barbarzyńcy działać normalnie, jeśli najpierw wpadnie w szał.

Wpis katalogu może dać posiadaczowi drugą turę w pierwszej rundzie walki (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` we wpisie z listy arkusza umieszcza tę drugą turę przy własnej inicjatywie posiadacza powiększonej o tę liczbę, po wszystkich z tą inicjatywą lub wyższą; każda z obu tur jest pełną turą, a od drugiej rundy posiadacz ma jak zwykle jedną turę na rundę. Posiadacz wyeliminowany przed nadejściem drugiej tury po prostu ją traci. Przy `"unlessSurprised": true` drugiej tury nie ma ten, kto zaczyna walkę zaskoczony: Thief's Reflexes z 5e.

Stan bojowy może zawęzić to, co kupuje przyznany przez niego budżet, do ciosu w zasięgu wręcz, i po zakończeniu zostawić ślad na torach posiadacza (Capability API 1.239). Przy `"grants": { "budget": "bonus", "attacks": true, "melee": true }` jedyne uderzenie opłacane z tego budżetu można wykonać tylko bronią uderzającą w zasięgu wręcz, a bronią do rzucania tylko w kogoś w jej zasięgu wręcz, bo się nią zamachuje, a nie rzuca; broń z zasięgiem dystansowym i bez zasięgu wręcz nie jest oferowana. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` przesuwa tory bieżące posiadacza o podane poziomy, gdy stan się kończy, niezależnie od tego, jak się kończy, tak jak `tracks` we wpisie katalogu; `applies` i `tracks` mogą występować razem lub osobno. `"usesOf": "<row name>"` wpisu katalogu zużywa użycia wpisu tego wiersza (jego wiersza licznika) zamiast własnych. Frenzy z 5e jest wtedy wpisem Berserkera, Frenzied Rage, z `"usesOf": "Rage"`, który nakłada szał oraz stan `frenzied` z `endsWith` wskazującym szał i zawiera oba te elementy.

Inicjatywę można rzucać dwa razy i zachować lepszy lub gorszy wynik (Capability API 1.240). `combat.initiative.checkAbility` określa, że inicjatywa jest testem tego atrybutu, więc wszystko, co każe rzucać taki test dwa razy, każe rzucać dwa razy inicjatywę: stan z `own-checks-advantage` (Foresight z 5e) albo modyfikator `checks` z `mode`, zawężony do tego atrybutu lub do żadnego (Cat's Grace z Enhance Ability dla Dexterity). Wpis katalogu z listy arkusza z `"initiativeMode": "advantage"` (lub `"disadvantage"`) każe rzucać inicjatywę posiadacza dwa razy niezależnie od tego, co posiada: Feral Instinct z 5e. Ułatwienie i utrudnienie znoszą się, jak w każdym rzucie; wpis inicjatywy w dzienniku zawiera `mode` i odrzucony rzut `dropped`. Walka, w której rzuca się inicjatywę co rundę, rzuca ją dwa razy w każdej rundzie. Dotyczy to tylko rzucanych kości: inicjatywy puli nie rzuca się dwa razy.

Reakcja może odpowiadać na WŁASNY trafiony atak posiadacza (Capability API 1.241): reakcja `"hit"` z `"by": "self"` jest oferowana atakującemu, gdy jego rzut trafi i odpowiedzą już wszyscy trafieni ciosem, i jest wymierzona w trafionego (zapisz `"at": "target"`). `"weapon": true` zawęża każdą chwilę trafienia do ciosu bronią: ataku albo jednocelowej akcji stworzenia spoza katalogu. Reakcji na własne trafienie nie blokuje to, co blokuje reakcje, bo jej wybór jest częścią ataku; oznacz ją jako `"free"`, chyba że naprawdę zużywa budżet. Stunning Strike z 5e jest taką reakcją: `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, darmowa, z kosztem ki, rzutem obronnym Constitution i stanem `stunned` do końca następnej tury mnicha. Przy `"addsToBlow": true` wielkość wpisu ataku dołącza do tego ciosu zamiast być zadawana osobno: rzuca się ją w chwili trafienia, podwaja przy trafieniu krytycznym, a jej klauzule działają tylko na cele, których dotyczą. Divine Smite z 5e to 2d8 obrażeń od światłości, `perCostStep` 1d8, klauzula 1d8 obrażeń od światłości z `targetIs` biesem lub nieumarłym oraz `"perCostStepsMax": 3`: największa liczba kroków wyższego kosztu, która się liczy, dla każdego wpisu z `perCostStep` lub `targetsPerCostStep`. Atak wykonany w innym oknie (atak okazyjny) nigdy nie jest wstrzymywany do trafienia, więc nic się do niego nie dodaje.

To, co posiada arkusz, może zmieniać jego wiersze ataków, przyznawać uderzenia i czekać na akcję ataku (Capability API 1.242). Wpis katalogu z listy arkusza z `attackRows` zmienia wiersze o wymienionych nazwach (dopasowywanych bez względu na wielkość liter), dopóki spełnione są granice z jego `when` (wartość z arkusza, np. noszony pancerz najwyżej 0): `abilities` używa najlepszego z własnego atrybutu wiersza i tych atrybutów do trafienia oraz, gdy obrażenia wiersza dodają ten sam atrybut, do obrażeń; `die` (`from` wartość z arkusza, przez `table` progów, do liczby ścianek) rzuca jedną kością tej wielkości zamiast kości wiersza, jeśli ma lepszą średnią; `qualities` dodają to, co ciosy przenoszą przez odporność. Martial Arts z 5e to `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, a Ki-Empowered Strikes to `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. `grantsStrike` posiadanego wpisu pozwala posiadaczowi kupić jedno uderzenie za inny budżet, gdy własny budżet ataku zostanie zużyty, dokładnie tak jak `grants.attacks` stanu: `names` zawęża je do tych ataków, `melee` do zasięgu wręcz, a `afterAttack` do tury, w której wykonano akcję ataku (`true` albo `{ "names": [...] }` dla akcji ataku wykonanej jednym z nich). Dodatkowe uderzenie bez broni z Martial Arts to `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. `grants` stanu przyjmuje te same `names` i `afterAttack`. Wpis z `afterAttack` jest oferowany dopiero po akcji ataku: Flurry of Blows to wpis `utility` za budżet bonus, zużywający punkt ki, z `afterAttack`, który przez `gives` daje 2 jednostki budżetu zadeklarowanego z liczbą 0, i z `grantsStrike` dla Unarmed Strike za ten budżet. Akcją ataku jest każdy atak z listy ataków lub przedmiotu opłacający własny budżet albo już kupione uderzenie, nigdy atak opłacony przez przyznanie.

Atak okazyjny jest wstrzymywany w chwili trafienia dokładnie tak jak atak w turze (Capability API 1.243): pyta się każdego, kto ma odpowiedź na to trafienie, a jego twórcę na końcu o to, co do niego dodaje (Divine Smite, Stunning Strike), a okno samego ruchu, z już obsłużonym atakującym, jest pytane dalej, gdy cios trafi. Poruszający się, który zostanie po drodze unieruchomiony (stan z `speed-zero`, np. ogłuszenie lub pochwycenie), nie idzie dalej niż pole, na którym został uderzony. Wpis będący reakcją lub dodawany do innego ciosu nigdy nie jest wybierany jako sam atak okazyjny.

Reguły ataków obejmują trzymaną broń, a lista ataków może dać każdemu arkuszowi wiersz (Capability API 1.244). `combat.attacks[].always` wymienia do 4 wierszy zapisanych w kolumnach tej listy, które walka każdego arkusza ma oprócz własnych; wiersz arkusza o tej samej nazwie jest używany zamiast nich. Uderzenie bez broni z 5e to `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. `names` reguły `attackRows` dopasowuje teraz trzymaną broń także po nazwie jej ataku, a jej `items` dopasowuje trzymaną broń po tagach: każdym z `tags` i żadnym z `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, więc liczy się dagger +1); reguła wskazuje `names`, `items` lub oba. `wielding: { "only": {...} }`, z tymi samymi `names`, `tags` i `notTags`, zachowuje regułę tylko wtedy, gdy każda trzymana broń jest jedną z nich albo nie ma żadnej: "bez broni lub dzierżąc wyłącznie broń mnicha". `grantsStrike` przyjmuje to samo `wielding` oraz `when` jak reguła `attackRows`, więc dodatkowe uderzenie z Martial Arts nie jest oferowane w pancerzu.

Kilka użyć naraz, rzut obronny sprowadzający do 0, trafienia nazwanymi atakami i obrażenia przy zakończeniu stanu (Capability API 1.245). `usesSpent` wpisu zużywa naraz tyle użyć jego wiersza (lub z `usesOf`) i jest oferowane tylko wtedy, gdy tyle zostało: 3 punkty ki z Quivering Palm. `names` reakcji `"hit"` odpowiada tylko na trafienie tymi atakami, dopasowywanymi po nazwie bez względu na wielkość liter: Quivering Palm to `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`, nakładające długotrwały stan `quivering`. `dropsOnFailedSave` we wpisie z rzutem obronnym sprowadza cel, który go nie zda, do 0 zdrowia zamiast zadawać wielkość wpisu (stworzenie jest wyeliminowane, a postać umiera, jeśli zestaw ma regułę umierania); cel, który go zda, otrzymuje wielkość zgodnie z `onSuccess` rzutu obronnego. Zakończenie wibracji to akcja z `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 obrażeń nekrotycznych, rzutem obronnym Constitution z `onSuccess: "none"` i `dropsOnFailedSave`. `onEnd.harm` stanu (`dice`, `flat`, `type`, `unless`) zadaje obrażenia posiadaczowi w chwili zakończenia stanu, w imieniu tego, kto go nałożył, chyba że posiadacz jest tym, co wskazuje `unless`: Hurl Through Hell to reakcja na trafienie z `dismisses: { "while": "hurled" }` i `hurled` trwającym `{ "rounds": 1, "of": "source" }`, a `onEnd` stanu `hurled` to `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` dopasowuje broń, którą wykonano akcję ataku, także po tagach (Capability API 1.246): `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` oznacza moment po ataku jednym z tych ataków albo trzymaną bronią, która ma każdy z `tags` i żadnego z `notTags`, niezależnie od nazwy, więc liczy się dagger +1. Wskazuje `names`, `items` lub oba, zarówno we wpisie, jak i w `grantsStrike` lub przyznaniu stanu.

Lekkomyślne i brutalne ciosy (Capability API 1.247). Wpis z `beforeAttack` jest oferowany tylko we własnej turze posiadacza, zanim w niej zaatakuje: Reckless Attack to darmowy `buff` na barbarzyńcy z `beforeAttack`, nakładający `reckless` na `{ "rounds": 1 }` i `exposed` na `{ "rounds": 1, "at": "turn-start" }`. Zmiana ataków przyjmuje `attacks` (`weapon`, `spell` lub `any`) i `blow` (`melee` lub `ranged`) tak jak zmiana obrażeń, razem z `ability`: `reckless` to `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, a `exposed` ma efekt `attacks-against-advantage`. `criticalDice` zmiany obrażeń dodaje tyle własnych kości obrażeń ciosu tylko przy trafieniu krytycznym, bez podwajania: Brutal Critical to poziom wartości pochodnej barbarzyńcy z `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, po jednym poziomie na każdą kość.

Odpowiedzi na trafienia serii ciosów (Capability API 1.248). `budget` chwili `hit` zawęża ją do trafień uderzeniem opłaconym z tego budżetu: Open Hand Technique odpowiada na `{ "on": "hit", "by": "self", "budget": "flurry" }`, czyli budżet, który daje (`gives`) Flurry of Blows i który zużywa jego `grantsStrike`. `oneOf` reakcji wskazuje grupę odpowiedzi na własne trafienie posiadacza, z których przy jednym trafieniu wybiera się tylko jedną: Open Hand Technique to trzy darmowe wpisy ze wspólnym `"oneOf": "open-hand"`: jeden z `save` Dexterity nakładający `prone`, jeden z `save` Strength i `push` równym 15 oraz jeden nakładający stan z efektem `cannot-react` na `{ "rounds": 1, "at": "turn-start" }`. Wybór jednego zużywa dwa pozostałe dla tego trafienia; następne trafienie znów oferuje wszystkie trzy. `oneOf` umieszcza się w chwili `hit` z `by` `self` i bez `also`.

Ratunek po rzucie (Capability API 1.249). Zmiana `attacks`, `saves` lub `checks` z `"rescue": true` jest wstrzymywana przy rzucie: rzuca się ją i dodaje, a stan, z którego pochodzi, zostaje zużyty, tylko wtedy, gdy własny rzut posiadacza jest za niski, a jej maksimum (stała część i każda kość na najwyższej ściance) mogłoby wyrównać różnicę. Jeśli nie mogłaby odwrócić wyniku rzutu, zostaje zachowana. Bardic Inspiration to stan nakładany na sojusznika z `{ "to": "saves", "dice": "1d6", "rescue": true }` i tym samym dla `attacks` i `checks` (jeden stan na wielkość kości, wybierany według poziomu barda jak inne progi); Guidance to `checks` z `1d4`, a Resistance `saves` z `1d4`. Naturalne chybienie nigdy nie zostaje uratowane, a walka na pulach kości niczego nie wstrzymuje. `rescue` wpisu usuwa go z menu: zostaje zużyty, wraz z użyciami i kosztem, gdy własny rzut posiadacza tego rodzaju się nie powiedzie. `{ "roll": "saves", "by": "reroll" }` powtarza rzut obronny, a nowy wynik zostaje (Indomitable z własnymi użyciami; Diamond Soul z `usesOf` Ki); `{ "roll": "attacks", "by": "success" }` zamienia chybienie w trafienie, a `{ "roll": "checks", "by": "success" }` nieudany test w sukces (Stroke of Luck). Wstrzymane zmiany są próbowane najpierw.

Cutting Words i unik (Capability API 1.250). `lowersRoll` wpisu działa, gdy trafia czyjś atak, w reakcji `hit` bez `by` (z `for` i `within`, aby odpowiadać za sojuszników): jego `dice` albo jedna kość `die`, której wielkość wyznacza wartość, jak w Martial Arts (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), są odejmowane od rzutu, który potem ponownie porównuje się z obroną; naturalne trafienie nadal trafia. Cutting Words to darmowy `debuff` z `{ "on": "hit", "for": "ally", "within": 60 }` i `usesOf` licznikiem inspiracji barda. `evasion` stanu bojowego lub poziomu wskazuje rzuty obronne: przeciw czemuś, co przy sukcesie zadaje połowę, udany rzut oznacza brak obrażeń, a nieudany połowę. Evasion to poziom na poziomie łotrzyka lub mnicha z `"evasion": ["dex_save"]`.

Lay on Hands (Capability API 1.251). `usesChosen` wpisu pozwala użytkownikowi wybrać, ile jego użyć zużywa jedno użycie, od jednego do tylu, ile zostało, i leczy tyle razy jego wielkość. Opcja zawiera `amount: { max }`, a wybór wysyła `amount`; po pominięciu zużywa tyle, ile średnio w pełni leczy pierwszy cel. Jest przeznaczone dla `heal` bez `usesSpent`. Lay on Hands to `heal` z `"amount": { "flat": 1 }` i `usesOf` licznikiem pięciu użyć na poziom paladyna, `usesChosen` oraz `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Font of Magic (Capability API 1.252). `restore` wpisu przywraca pulę tego, kogo trafi, przy `heal` lub `buff`: pulę bieżącą według identyfikatora albo pulę wiersza listy według nazwy (`"Sorcery Points"`). Przy `cost` w rodzinie pul `perCostStep` dodaje do niej za każdy krok powyżej najtańszego, więc komórka zaklęć czarownika zamienia się w Sorcery Points równe jej poziomowi: `buff` na sobie kosztujący `slots_1` z `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` i `"perCostStep": { "flat": 1 }`. `overMax` pozwala przekroczyć maksimum puli; nadwyżka jest przechowywana osobno i znika, gdy odpoczynek przywróci pulę do maksimum. Komórka zaklęć utworzona z punktów to jeden wpis na poziom, z `usesOf` punktami, `usesSpent` równym jej cenie i `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. Wpis przywracający własnemu użytkownikowi pulę, której ten nie ma, nie jest w jego menu.

Metamagia (Capability API 1.253). `alters` wpisu zmienia sposób użycia wpisu z jego `catalogs`: nigdy nie ma go w osobnym menu, ale jest oferowany przy każdym wpisie, do którego pasuje, wybierany w chwili jego użycia i opłacany własnymi użyciami (`usesOf` Sorcery Points z `usesSpent` albo `usesSpentByLevel` dla poziomu, na jakim opłacono zaklęcie, co najmniej jeden). Jest to `utility` bez reakcji. Na jedno użycie przypada tylko jeden, chyba że dołącza (`joins`) do innego. Co zmienia, przy czym każda zmiana pasuje tylko do zaklęcia, w którym ma coś do zmiany: `spares` (wartość z arkusza: tylu z użytkownika i jego sojuszników objętych zaklęciem automatycznie zdaje jego rzut obronny: Careful), `range` (`{ "times": 2, "touch": 30 }`: Distant), `rerolls` (tyle kości obrażeń poniżej średniej rzuca się ponownie, zaczynając od najniższych: Empowered, z `joins`), `lasts` (to, co zaklęcie nakłada na minutę lub dłużej, trwa tyle razy dłużej, nigdy dłużej niż dzień: Extended), `heightens` (pierwszy cel wykonuje pierwszy rzut obronny z utrudnieniem: Heightened), `budget` (`{ "from": "action", "to": "bonus" }`: Quickened), `drops` (komponenty, których wtedy nie potrzebuje, a na jego rzucenie nikt nie może odpowiedzieć: Subtle) oraz `twins` (jeden cel więcej dla zaklęcia o jednym celu, które nie dotyczy wyłącznie użytkownika i nic nie zyskuje z wyższej komórki: Twinned). Zaklęcie, które w danej chwili można rzucić tylko z jedną z nich (Quickened po zużyciu akcji, Subtle pod Silence), jest oferowane z `alterNeeded`, a wybór musi ją zawierać. Wybór wysyła `alters`, czyli identyfikatory z `alters` opcji; dziennik podaje `altered`.

Metamagia w chwili wyboru (Capability API 1.254). `rerolls` rzuca ponownie najniższe ze wszystkich kości obrażeń zaklęcia, łącznie nie więcej niż tyle: własne, kości każdej klauzuli z `plus`, a przy trafieniu krytycznym także dodatkowe, ile zostanie. Zaklęcie ataku rzuca je dla każdego trafionego celu. Gdy zmiana `spares` obejmuje więcej osób ze strony użytkownika, niż oszczędza, użytkownik wybiera, kogo: oferta `alters` opcji zawiera `spares` (ile), a wybór wysyła `spares`, identyfikatory osób ze strony użytkownika do oszczędzenia (brak identyfikatorów oznacza, że nikt nie zostaje oszczędzony). Po pominięciu oszczędza pierwszych objętych. Wybór obowiązuje także w oknie odpowiadającym na rzucenie. `spares` bez zmiany, która kogokolwiek oszczędza, więcej identyfikatorów, niż oszczędza, powtórzony identyfikator albo identyfikator z innej strony są odrzucane jako `bad-alter`.

Cel Heightened i Acid Arrow (Capability API 1.255). Gdy zmiana `heightens` obejmuje więcej niż jedną osobę, użytkownik wybiera, kto wykonuje pierwszy rzut obronny z utrudnieniem: oferta `alters` opcji zawiera `heightens: true`, a wybór wysyła `heightens`, identyfikator jednego uczestnika walki (jednego z tych, w których jest wymierzone, jeśli jest w kogoś wymierzone, i nigdy samego użytkownika). Po pominięciu jest to pierwszy objęty. Wpis z `halfOnMiss: true` (musi mieć `attackRoll` i `amount`) zadaje przy chybieniu połowę obrażeń, także obrażeń swoich klauzul, i nic poza tym z tego, co robi przy trafieniu. `harmsPerCostStep` wpisu `applies` (`{ "dice": "1d4" }`) dodaje tyle do obrażeń zadawanych przez `harms` stanu za każdy krok wyższego kosztu, z jakim go nałożono: późniejszy kwas z Acid Arrow, o 1d4 więcej za każdy poziom komórki powyżej 2.

Własne ratunki posiadacza, wpisy nigdy niedziałające na użytkownika i stany pojedynczo (Capability API 1.256). `rescue` wpisu może mieć też `by: "twenty"` (tylko z `roll: "checks"`): d20 nieudanego testu liczy się jako 20, zużywane tylko wtedy, gdy to zamienia wynik w sukces, tak jak Stroke of Luck w teście atrybutu. `by: "die"` dodaje własną kość posiadacza, gdy nic, co otrzymał od innych, nie mogłoby wyrównać różnicy, a ta kość mogłaby: `dice` (`"1d10"`, Dark One's Own Luck) albo jedną kość `die`, której wielkość wyznacza wartość z arkusza, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). Stan otrzymany od innych jest próbowany najpierw. `notSelf: true` we wpisie wymierzonym w stworzenie `ally` lub `any` nie pozwala użyć go na sobie: Bardic Inspiration. `oneAtATime` stanu bojowego wskazuje grupę (`"bardic"`): dopóki stworzenie ma jeden stan z tej grupy, żaden inny z niej, łącznie z tym samym, nie zostaje nałożony; zdarzenie stanu podaje `already`.

Odpowiedzi na więcej rodzajów rzutów (Capability API 1.257). `lowersRoll` może też wymieniać `"also": ["checks", "damage"]`: poza trafiającym rzutem ataku jego kości odejmuje się od czyjegoś testu atrybutu (testu przeciwstawnego, np. pochwycenia, testu bramki przedmiotu, testu Counterspell) albo rzutu obrażeń w chwili wykonania. Zużywa go automatycznie, wraz z budżetem, użyciami i kosztem wpisu, pierwszy z drugiej strony, którego wpis sięga rzucającego, i tylko wtedy, gdy jego maksimum mogłoby odwrócić wynik rzutu: test, który by się udał, a mógłby wtedy się nie udać, albo obrażenia, które powaliłyby kogoś ze strony posiadacza, a wtedy mógłby on ustać. Cutting Words to `{ "dice": "1d6", "also": ["checks", "damage"] }` z kością zależną od poziomu, `needs: ["hearing"]` i `targetTypes: { "notImmuneTo": ["charmed"] }`. Ratunek może wskazywać `saves` (tylko ratunek dotyczący `saves`): zużywa się go wyłącznie przy tych rzutach obronnych. Z `budget` zużywa też jednostkę tego budżetu i bez niej nie zostaje zużyty: ring of evasion to `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` z ładunkami jako użyciami. Użycie przedmiotu także może zawierać `halfOnMiss`, z `attackRoll` i `amount`: zwój Acid Arrow.

Choroby (Capability API 1.258). `kinds` stanu bojowego (`["disease"]`) określa rodzaj stanu. Rodzaj nigdy nie jest identyfikatorem samego stanu. `ends` leczenia może zamiast stanów wskazywać rodzaj: liczy się każdy stan tego rodzaju, a `count` nadal usuwa tylko tyle, więc "jedna choroba" z Lesser Restoration to `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. Niewrażliwość (`conditionImmunities` stworzenia lub przedmiotu albo stanu lub poziomu) także może wskazywać rodzaj: Divine Health to stan z `"conditionImmunities": ["disease"]`. `saveEnds` może liczyć: `successes` (od 2 do 10) to liczba sukcesów kończących stan, a `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) nakłada zamiast niego `becomes`, bez czasu trwania i bez dalszych rzutów obronnych, gdy tyle rzutów się nie powiedzie. Zdarzenie stanu podaje `worsened`. Tak działa Contagion: stan `until-save`, przeciw któremu wykonuje się rzut obronny na końcu każdej tury, z trzema rzutami w każdą stronę. Stan bez czasu trwania nie znika z końcem walki, więc choroba, która się rozwinęła, trwa dalej, dopóki coś jej nie wyleczy.

Ratunek z noszonych przedmiotów (Capability API 1.259). `use` przedmiotu może zawierać `rescue`, tak jak mechanika wpisu, łącznie z `saves` i `budget`. Nigdy nie ma go w menu i zostaje zużyty tylko wtedy, gdy przedmiot jest założony (jeśli ma miejsca) i ma `charges`, które zużywa jego użycie. Zużycie odejmuje jeden z tych ładunków. Ring of evasion to przedmiot z `"charges": { "max": 3 }` i `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. Jego ładunki wracają zgodnie z `recharge` przedmiotu.

Choroby między walkami (Capability API 1.260). Stan bojowy może zawierać `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`: za każdym razem, gdy posiadacz odbywa jeden z tych odpoczynków, mając ten stan, maksimum zdrowia spada o tyle, rzucane w miejscu odpoczynku, po tym, jak odpoczynek odnowi to, co odnawia. Bez `lasting` następny odpoczynek je przywraca; z nim – tylko coś, co zdejmuje blokadę. `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` rzuca się najpierw, tak jak testy zestawu, z własnym modyfikatorem arkusza: tylko porażka obniża maksimum, a z `cures` sukces kończy stan (choroba otyugha). Tylko zdrowie przechowywane w punktach ma maksimum do obniżenia. Mummy Rot z 5e to stan bez czasu trwania z `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. Rzut obronny liczony do zakończenia lub do zmiany stanu (1.258) nie zatrzymuje się już z końcem walki: gdy kończy się jakakolwiek walka, także zakończona ucieczką, pozostałe rzuty obronne posiadacza przypadające na tury zostają wykonane, więc do tego czasu Contagion zostaje strząśnięte albo się rozwija. Rzut obronny wykonywany tylko przy obrażeniach czeka na obrażenia.

Stadia choroby (Capability API 1.261). Stan bojowy może zawierać `onDamaged: { "applies": [...] }`, nakładane na posiadacza za każdym razem, gdy otrzyma obrażenia, z czasem trwania jak w `onEnd` (ogłuszenie z Slimy Doom do końca następnej tury posiadacza); `expires: { "becomes": conditionId }`, w który zmienia się, bez czasu trwania, gdy skończy się jego własny czas, także z końcem walki, ale nie wtedy, gdy zostanie zakończony w inny sposób (choroba z Tentacle aboletha po upływie minuty); oraz `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, więc kończy go tylko leczenie z tych katalogów opłacone na tym poziomie lub wyższym. `onRest.restoredWhenCured: true` (z `lasting`) zwraca to, co odpoczynki tego stanu odjęły od maksimum, gdy stan zostanie zdjęty, niezależnie od sposobu, łącznie z udanym własnym rzutem obronnym. Efekt `cannot-heal-nonmagical` blokuje każde leczenie poza magicznym: w walce akcję, której cechy zawierają `"magical"`, poza walką operację przywracania z `"magical": true` (taką jest mikstura z tagiem `magical`), a nigdy odpoczynek; odrzucone przywrócenie podaje `cannot-heal`. Akcja z bloku statystyk może zawierać `ends`, tak jak wpis katalogu, łącznie z rodzajami: Healing Touch jednorożca to `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. Leczenie, w którym rzucający wybiera spośród stanów jeden, np. jedną klątwę spośród kilku, to `cureOneOf` (1.204).

Cechy akcji stworzenia (Capability API 1.262). Akcja z bloku statystyk może zawierać `qualities`, czyli tagi przedmiotów zadeklarowane przez zestaw, tak jak wpis katalogu: `["magical"]` czyni jej leczenie magicznym, które przepuszcza `cannot-heal-nonmagical`, a rzut obronny przeciw niej – rzutem obronnym przeciw magii. Użycie przedmiotu w walce w ten sam sposób przenosi własne tagi przedmiotu, więc mikstura z tagiem `magical` leczy tam magicznie, tak jak na arkuszu.

Aury (Capability API 1.263). Stan bojowy może zawierać `auras`, do czterech: każda przenosi swoje `conditions` na każdego, kto stoi w odległości `distance` od posiadacza, po stronie (`side`) `allies`, `enemies` lub `all`, a także na samego posiadacza przy `self: true` (nie z `enemies`). `when` odczytuje jedną z wartości arkusza posiadacza z `atLeast` lub `atMost`, więc aura może się pojawić od jakiegoś poziomu. Posiadacz, który leży, został pokonany lub ma efekt `cannot-act`, niczego nie przenosi. To, co przenosi aura, zostaje nałożone w miarę postępu walki i zdjęte, gdy obaj się rozdzielą (dziennik podaje `aura` i `parted`), nigdy nie jest zapisywane w arkuszu i znika z końcem walki; stan przenoszony przez aurę nie może mieć własnej aury. Bez planszy aura sięga każdego po swojej stronie. Aby posiadacz zaczynał każdą walkę ze stanem, nadaj mechanice wpisu katalogu lub blokowi statystyk `keepsOn`: stany, które ma przez całą walkę, również nigdy niezapisywane w arkuszu. Aura of Protection z 5e to trwały stan `aura-of-protection`, którego aura przenosi stan dodający Charisma paladyna do rzutów obronnych; Holy Nimbus to aura działająca na wrogów, której stan rani ich na początku tury.

Wymuszone zachowanie (Capability API 1.264). Stan bojowy może zawierać `behavior`, które decyduje, co posiadacz robi w swojej turze. `only` wymienia wszystko, co tura może zawierać poza jej zakończeniem: `move` (chodzenie i wstawanie), `escape` (uwalnianie się z pochwycenia) oraz standardowe akcje zadeklarowane przez zestaw; pusta lista zostawia tylko zakończenie tury (halt z Command). `onlyWhenStuck` wskazuje standardowe akcje dozwolone tylko wtedy, gdy nie ma dokąd iść (Dodge z Turn Undead). `moves: "away"` pozwala iść tylko od tego, kto nałożył stan, nigdy o krok bliżej, i kończyć dalej od niego; `moves: "toward"` pozwala iść tylko bliżej (approach z Command, Sympathy). `table` rzuca się na początku każdej tury posiadacza, `{dice, rows: [{atMost, does}]}`, a o turze decyduje pierwszy wiersz, którego próg jest nie mniejszy niż wynik rzutu: `wander` przechodzi całą szybkość w jednym kierunku wybranym przez d8 i kończy turę, `nothing` ją kończy, `strike` pozwala tylko na atak wręcz na stworzenie w zasięgu wybrane przez kości (przyjaciela lub wroga; nic, jeśli nikogo tam nie ma), a `normal`, tak jak rzut wyższy niż każdy wiersz, zostawia turę bez zmian (Confusion, Mindfire). Dziennik pokazuje rzut jako zdarzenie `compelled`, a wszystko inne jest odrzucane jako `compelled`. Rzut obronny kończący stan może też mieć `at: "action"`: posiadacz zużywa akcję, by go wykonać (Irresistible Dance).

Więcej możliwości aur (Capability API 1.265). `conditions` aury są teraz opcjonalne, o ile aura przenosi stany, rani lub wymaga rzutu obronnego. `needs` wymienia zmysły, które musi mieć odbiorca, a ani posiadacz, ani odbiorca nie może stać w strefie, której `inside.conditions` odbierają te zmysły: Countercharm z `needs: ["hearing"]` zatrzymuje się na Silence. `harms` `{dice, flat, type}` zadaje posiadacz każdemu, kogo sięga aura, na początku każdej własnej tury (Fire Aura balora). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` wykonuje każdy, kogo sięga aura, na początku własnej tury: porażka nakłada `applies` od posiadacza z tą trudnością, `seen` wymaga rzutu tylko wtedy, gdy obaj się widzą (spojrzenie bazyliszka), a `immuneOnSuccess` po sukcesie chroni przed aurą tego posiadacza do końca walki (Fear Aura czarta z otchłani). `against.casts` modyfikatora rzutów obronnych zawęża go do rzutów obronnych przeciw temu, co rzucono z tych katalogów, łącznie z użyciem przedmiotu rzucającym z jednego z nich, a potem do wszystkiego innego, co wskazuje: ułatwienie z Holy Nimbus przeciw zaklęciom rzucanym przez biesy lub nieumarłych to `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

Więcej wymuszonego zachowania (Capability API 1.266). `behavior` może zawierać `drops` `{slots?, tags?, at, pickUp?}`: posiadacz upuszcza każdy założony przedmiot zajmujący jedno z `slots` lub mający jeden z `tags` oraz każdą akcję z bloku statystyk, której `qualities` zawierają jeden z `tags`, albo w chwili nałożenia stanu (`at: "applied"`, "upuszcza wszystko, co trzyma" z Fear), albo na początku każdej tury posiadacza (`at: "turn-start"`, "upuść" z Command). To, co upadło, leży na polu, na którym stał posiadacz: żadna z akcji przedmiotu nie należy już do niego (odrzucane jako `dropped`), przedmiot nie daje niczego, co dawał, gdy był założony, a jego udział w obronie posiadacza znika (2 z tarczy). Posiadacz podnosi go, stojąc na tym polu lub obok niego, w ramach jednego darmowego podniesienia na turę albo za budżet `pickUp`, jeśli stan go wskazuje; dziennik pokazuje `letFall` i `pickedUp`. `onlyWhenStuck: "any"` sprawia, że tura zaczynająca się bez miejsca, do którego stan pozwala posiadaczowi iść, należy w całości do niego ("chyba że nie ma dokąd się ruszyć" z Fear). `keepsOut` to odległość od tego, kto nałożył stan: wewnątrz niej posiadacz robi kroki tylko w stronę oddalenia i zatrzymuje się dopiero poza nią, o ile jakiekolwiek miejsce poza nią jest w zasięgu ("nie może dobrowolnie wejść na pole w promieniu 30 stóp od ciebie" z Turn Undead). Rzut obronny kończący stan może mieć `unseen: true`: rzuca się go tylko wtedy, gdy posiadacz nie widzi tego, kto nałożył stan (rzut obronny z Fear poza linią wzroku). `applies` wpisu może zawierać `destroysUpTo` `[{tier, when?}]`: stworzenie, które nie zda rzutu obronnego i którego poziom zagrożenia jest równy najwyższemu `tier` z `when` spełnionym na arkuszu użytkownika lub niższy, zostaje zamiast tego od razu zniszczone (Destroy Undead, od CR 1/2 na 5. poziomie kleryka do CR 4 na 17.); postać ani stworzenie bez poziomu zagrożenia nigdy nie zostaje zniszczone.

Wybieranie celów dowolnym zmysłem, cele blisko siebie, rosnące obszary, więcej użyć i trzymane rzeczy (Capability API 1.267). Wpis lub akcja stworzenia, która ma `needs` z wymaganymi zmysłami, może dodać `needsAny: true`: cel, który zachowuje którykolwiek z nich, się kwalifikuje, a odrzucany jest tylko taki, któremu brakuje wszystkich ("każdy nieumarły, który cię widzi lub słyszy" z Turn Undead). `targetsWithin` to odległość, w jakiej musi stać od siebie każda para wybranych celów, a w przeciwnym razie wybór jest odrzucany jako `targets-apart` (stworzenia "w promieniu 30 stóp od siebie" z Command na wyższym poziomie). `area` może zawierać `sizePerCostStep`, czyli odległość, o jaką rośnie jego rozmiar za każdy krok podniesienia kosztu (sfera Confusion rosnąca o 5 stóp na poziom komórki); ściana nigdy nie rośnie. Przedmiot z `use` może wymieniać `moreUses` `[{label, use}]`: każde jest kolejną pozycją menu, nazwaną od przedmiotu i jego `label`, korzysta z tych samych ładunków i upada razem z przedmiotem (różdżka kilku zaklęć). Stworzenie może wymieniać `held` `[{label, tags, defense?}]`, rzeczy, które trzyma i które nie są jego własnymi akcjami (wydrukowana w bloku statystyk tarcza): stan, którego `drops` wskazuje jeden z ich `tags`, każe je upuścić razem z akcjami z tym tagiem, ich `defense` znika z obrony stworzenia, dopóki ich nie podniesie, a każdą podnosi się jak upuszczony przedmiot.

Spojrzenia i aury zależne od tego, kogo sięgają (Capability API 1.268). Aura może zawierać `targetTypes`, odczytywane jak we wpisie: sięga tylko tych, którzy są danego typu (Horrific Appearance wiedźmy morskiej, tylko humanoidy). `sourcesOf` wskazuje stany: aura sięga tylko tego, kto nałożył jeden z nich na jej posiadacza (Barbed Hide kolczastego diabła, raniące każdego, kto go pochwyci). `save` aury może zawierać `failedBy` `{atLeast, applies}`: porażka o co najmniej tyle nakłada zamiast tego te stany (spojrzenie meduzy, od razu skamienienie przy porażce o 5 lub więcej). Rzut obronny z `seen` może zawierać `avert: true`: każdy, kogo aura sięga, może w swojej turze i za darmo odwrócić wzrok od jej posiadacza; dopóki znów nie spojrzy (to także jego darmowy wybór), pomija ten rzut obronny i nie widzi posiadacza, więc atakuje go jako niewidzianego; dziennik pokazuje `averted`, a reżyser walki trzyma oczy swoich stworzeń odwrócone, dopóki zostaje ktoś inny do walki. Rzut obronny kończący stan może zawierać `seenLean` (`"advantage"` lub `"disadvantage"`): rzuca się go w ten sposób, dopóki posiadacz widzi tego, kto nałożył stan (powtarzany rzut obronny przeciw wiedźmie morskiej, z utrudnieniem, gdy jest w zasięgu wzroku).

Kostury rzucają z liczbami posiadacza (Capability API 1.269). `use` przedmiotu może odczytywać trudność rzutu obronnego z arkusza posiadacza przez `sheetDifficulty`, wartość odczytywaną tak jak w `toHit.sheetBonus` (`{ "derived": "spell_save_dc" }`), zamiast `saveDifficulty`; premia do ataku już teraz jest odczytywana z arkusza w ten sam sposób, przez `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) i bez atrybutów. Użycie z `charges` może zawierać `chargeStep` `{max, amount?, targets?}`: użytkownik może wydać do `max` dodatkowych ładunków, z których każdy jest krokiem wyższego kosztu, dodając `amount` i `targets` tak, jak wyższa komórka dodaje `perCostStep` i `targetsPerCostStep`, i powiększając obszar przez `sizePerCostStep` (zaklęcie z Staff of Power na wyższym poziomie, 1d6 obrażeń od mocy na ładunek ze Staff of Striking). Menu oferuje je jako płatności nazwane `charges:<how many more>`, tylko tyle, ile przedmiot nadal ma. Ta sama wersja API podnosi liczbę stanów, które zestaw może zadeklarować, do 320, a `save` aury może zawierać `immuneWhenEnds: true`: gdy to, co nałożyła porażka, się skończy, niezależnie od sposobu (rzut obronny, upływ czasu, leczenie), aura tego posiadacza nie działa na nich do końca walki, tak jak `immuneOnSuccess` chroni po udanym rzucie obronnym ("jest udany lub efekt dla niego się kończy" z wiedźmy morskiej).

Rodzaj wskazywany przy rzucaniu (Capability API 1.270). `mechanics` wpisu katalogu z `applies` może zawierać `kindChoice: true`: użytkownik w chwili użycia wskazuje jeden z `combat.creatureTypes` (typ lub tag), oferowany jako tryby `kind-<id>`, a to, co wpis nakłada, zapamiętuje ten rodzaj. Aura tego, co nałożono, z `chosenKind: true` sięga tylko stworzeń tego rodzaju, a aura z `orSeen: true` sięga też każdego, kto widzi jej posiadacza, bez względu na odległość, więc Antipathy z 5e nakłada na cel stan, którego aura, `side: "all"`, przestrasza wybrany rodzaj w promieniu 60 stóp lub w zasięgu wzroku, a przestraszeni oddalają się (`moves: "away"`), natomiast zauroczeni przez Sympathy się zbliżają. `saveEnds` stanu może zawierać `beyond` w jednostce odległości zestawu: rzut obronny wykonuje się tylko wtedy, gdy posiadacz stoi dalej niż ta odległość od tego, kto nałożył stan, a z `unseen` także poza zasięgiem jego wzroku ("nie w promieniu 60 stóp od celu i nie może go widzieć" z Antipathy).

Więcej działań kosturów i pierścieni (Capability API 1.271). `use` przedmiotu może zawierać `label`, pokazywane obok nazwy przedmiotu tak jak etykieta wpisu `moreUses` ("Staff of Fire: Burning Hands"); kolejne użycie jest nazywane własnym `label`. Użycie może zawierać `amountAdd`, wartość odczytywaną z arkusza posiadacza i dodawaną do wielkości, tak jak we wpisie katalogu (Cure Wounds ze Staff of Healing, `{ "abilityModFromField": "spellcasting_ability" }`), w walce i poza nią. `chargeStep` może zawierać `push` w jednostce odległości zestawu: każdy dodatkowy ładunek odpycha cel o tyle dalej, obok własnego `push` użycia (5 stóp na ładunek z Ring of the Ram). `charges.breaksOn` przedmiotu może zawierać `regains` `{atLeast, amount}`: gdy zostanie wydany ostatni ładunek, a jego kość pokaże `atLeast` lub więcej, przedmiot zamiast tego odzyskuje `amount` ładunków (1d12 + 1 przy 20 ze Staff of the Magi), w walce, poza nią i gdy ekwipunek wydaje ładunek; `atMost` można wtedy pominąć dla przedmiotu, który nigdy się nie psuje.

Przedmiot, który staje się innym (Capability API 1.272). `charges.breaksOn` przedmiotu może zawierać `becomes`, inny przedmiot zestawu w postaci `<catalog>/<entry>`, obok `atMost`: przy wynikach, które by go zniszczyły, przedmiot staje się zamiast tego tamtym (zwykły kij ze Staff of Striking albo Staff of Power, który zachowuje tylko swoje +2 jako przedmiot zapisany wyłącznie z tą premią). W walce jego użycia znikają, a od tej chwili uderza jak nowy przedmiot, a walka zapisuje stos z powrotem jako ten przedmiot, pod jego nazwą i bez ładunków; poza walką i gdy ekwipunek wydaje ładunek, stos zmienia się w ten sam sposób. Wskazany przedmiot musi być innym przedmiotem zestawu, w dowolnym pliku katalogu.

Ładunki wydawane przy trafieniu (Capability API 1.273). `attack.spends` broni wymienia do czterech sposobów, w jakie posiadacz może wydać ładunki przedmiotu, gdy cios tą bronią trafi: każdy ma `label`, koszt w `charges`, wielkość `amount` z kości i części stałej dodawaną do ciosu z własnym typem obrażeń `type` (typem broni, jeśli żadnego nie wskazuje) oraz opcjonalnie `blow` (tylko cios `melee` lub `ranged`), `chargeStep` (`max` dodatkowych ładunków, z których każdy ponownie dodaje swoje `amount`: 1d6 obrażeń od mocy na ładunek ze Staff of Striking, do trzech) i `onHit` (do dwóch stanów, które otrzymuje trafiony, każdy z `rounds`, `save` chroniącym przed nim albo `saveEnds`: rzut obronny Constitution ze Staff of Withering). W walce każdy jest oferowany posiadaczowi przy jego własnym trafieniu tą bronią i żadną inną, po tym, jak trafiony odpowie; jego kości rzuca się razem z ciosem i podwaja przy trafieniu krytycznym, a kość ostatniego ładunku przedmiotu rzuca się tak jak przy użyciu. Przedmiot ma ładunki.

Liczby ustalane z arkusza tego, kto nałożył stan (Capability API 1.274). Stan, który wpis nakłada (`applies`), może zawierać `value`, odwołanie do wartości odczytywane z arkusza nakładającego w chwili nałożenia (`{ "abilityModFromField": "spellcasting_ability" }` z Heroism), a `temporary` stanu bojowego daje posiadaczowi punkty tymczasowe na początku lub na końcu każdej jego tury (`at`): `dice` i `flat` oraz tę wartość przy `value: true`, a z `lostWhenEnds` pozostała ich część znika wraz z końcem stanu, chyba że posiadacz ma z innego źródła więcej, niż stan dał. `save.appliedDifficulty` aury rzuca rzut obronny przeciw trudności rzutu obronnego tego, co nałożyło stan aury na posiadacza, ustalonej w chwili nałożenia (trudność rzutu obronnego zaklęć rzucającego Antipathy/Sympathy); jej `difficulty` pozostaje dla aury, której nic nie nałożyło. Rzut obronny kończący stan `at: "damaged"` może zawierać `bySource`: rzuca się go tylko przy obrażeniach od tego, kto nałożył stan (rzut obronny z Sympathy, gdy cel rani jej posiadacza). `behavior.keepsIn` stanu sprawia, że posiadacz, gdy już znajdzie się w tej odległości od tego, kto nałożył stan, nigdy nie odchodzi dalej ("nie może dobrowolnie się oddalić" z Sympathy). A `use` przedmiotu może zawierać `kindChoice`, tak jak mechanika wpisu (1.270), więc zwój Antipathy/Sympathy wskazuje swój rodzaj w chwili użycia.

Stany wstrzymywane zamiast kończonych (Capability API 1.275). Obok `whileSourceInSight` `orSourceWithin` stanu bojowego (odległość we własnych jednostkach zestawu) utrzymuje jego działanie, dopóki posiadacz stoi tak blisko tego, kto go nałożył, widząc go lub nie: poza zasięgiem wzroku i poza tą odległością stan jest wstrzymany, nadal na posiadaczu i z biegnącym czasem, a znów działa, gdy tylko któryś z warunków jest spełniony (przestraszenie z Antipathy, w promieniu 60 stóp lub w zasięgu wzroku). `suppresses` stanu bojowego wymienia inne stany, które wstrzymuje, dopóki działa: ich działanie ustaje, pozostają nałożone i znów działają, gdy on się skończy (zauroczenie i przestraszenie wstrzymywane przez Calm Emotions albo przez Mindless Rage).

Teleportacje (Capability API 1.276). `mechanics.teleport` wpisu katalogu, `use.teleport` przedmiotu lub `teleport` akcji stworzenia natychmiast przenosi użytkownika na wolne miejsce w odległości `distance` (we własnych jednostkach zestawu): bez żadnych kroków po drodze, więc nikt nie dostaje uderzenia przy jego odejściu, a strefa, w której wyląduje, dosięga go tak, jakby do niej wszedł. Działa tylko na planszy, więc wymaga `combat.distance`; bez planszy akcja, która tylko teleportuje, nie jest oferowana. Z `seen` – tylko na miejsce, które użytkownik teraz widzi (ściana, mgła lub ślepota odbierająca wzrok usuwa z listy pola za nimi): Misty Step z 5e, `{ "distance": 30, "seen": true }`. `carries` (od 1 do 8) zabiera tyle chętnych stworzeń ze strony użytkownika, nie większych od niego, z odległości `carriesWithin` (po pominięciu – dotykających go), a każde ląduje tak blisko użytkownika, jak pozwala miejsce: Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. Akcja stworzenia z teleportacją działa na samo stworzenie (Teleport psa przeskakującego). Opcja wymienia pola, na które można się przenieść, jako `teleport.cells`, a tych, którzy mogą się przenieść razem, jako `teleport.carries`; wybór wskazuje pole jako `at`, a towarzyszy jako `carries`. Teleportacja nigdy nie jest obszarem ani reakcją.

Sześć stanów naraz i widzenie, które naprawdę jest widzeniem (Capability API 1.277). `applies` mieści do 6 wpisów w mechanice wpisu katalogu, użyciu przedmiotu i akcji stworzenia (wcześniej 4): Rage i Frenzy dodają stan z Mindless Rage obok swoich czterech. A `whileSourceInSight` (z `orSourceWithin` obok) odczytuje teraz własny wzrok posiadacza, tak jak `orSeen` aury: nadal potrzebna jest wolna linia na planszy, a do tego posiadacz musi widzieć źródło oczami lub zmysłami, więc ślepota odbierająca wzrok, zasłaniająca mgła, ciemność poza zasięgiem jego widzenia albo niewidzialne dla niego źródło przerywają to tak jak ściana.

Calm Emotions (Capability API 1.278). Rzut obronny może zawierać `alliesMayFail: true` (w `save` wpisu katalogu, użycia przedmiotu lub akcji stworzenia): cel ze strony użytkownika przyjmuje efekt i nie zdaje rzutu bez rzucania, a dziennik to podaje, podczas gdy wszyscy inni rzucają jak zwykle. `effects` stanu może zawierać `cannot-target-source-side`: posiadacz nie kieruje niczego na tego, kto nałożył na niego stan, ani na nikogo z jego strony, chyba że ta strona jest stroną posiadacza (wtedy nikogo nie wyklucza). `endsWhen` przyjmuje obok `damaged` i `harmed-by-source-side` dwa kolejne zakończenia, łącznie do czterech: `attacked`, czyli rzut ataku wykonany przeciw posiadaczowi przez kogokolwiek, trafiony lub nie (akcja trafiająca bez rzutu się nie liczy), oraz `ally-harmed-in-sight`, czyli obrażenia zadane komuś innemu ze strony posiadacza, które posiadacz widzi (wolna linia na planszy i jego własne oczy lub zmysły). A `endsWhenHarmedFrom` wymienia katalogi: zranienie posiadacza czymkolwiek rzuconym z jednego z nich, przez kogokolwiek, łącznie z zaklęciem ze zwoju i stojącą strefą, kończy stan; zranienie to obrażenia albo bycie celem szkodliwej akcji, tak jak przy `harmed-by-source-side`, a ponowne rzucenie tego samego stanu odświeża go zamiast kończyć. Każde z tych zakończeń czeka, aż krok, który je spowodował, się zakończy. A stan wstrzymywany (`suppresses`) przez własny aktywny stan posiadacza nie jest już kończony przez niewrażliwość, którą daje ten sam stan: zostaje zawieszony, nie wyleczony, więc przestraszenie nałożone przed szałem dającym niewrażliwość na przestraszenie wraca, gdy szał się kończy (Mindless Rage z 5e), a nowe przestraszenia nadal nie mogą zostać nałożone.

Teleportacje poza walkę, widzący pasażerowie i dym (Capability API 1.279). `teleport` (we wpisie katalogu, użyciu przedmiotu lub akcji stworzenia) przyjmuje trzy kolejne klucze. `leaves: true`: może przenieść użytkownika całkowicie poza walkę, na milę jednorożca, zamiast na pole; wybór nie wskazuje wtedy `at` (menu pokazuje przycisk "Leave the fight"), a użytkownik i każdy, kto przenosi się razem z nim, znikają żywi (pokazywani jako "Left the fight", z zachowanym zdrowiem, i nic ich nie przywraca). Bez planszy opuszczenie walki jest jedynym możliwym celem, a przenieść się razem może każdy stojący po stronie użytkownika, bo nic nie mierzy, kto stoi blisko. Drużyna, która jest poza walką, a ktoś z niej odszedł w ten sposób, uciekła (wynik `fled`, który kończy walkę jak ucieczka); wróg, który odszedł w ten sposób, nie jest ani pokonany, ani nadal na polu walki, tylko zbiegł, a podsumowanie to podaje. Własne stworzenia reżysera walki odchodzą przy jednej czwartej zdrowia lub mniej, zabierając, kogo mogą. `carriesSeen: true` (z `carries`): przenieść się razem mogą tylko ci, których użytkownik widzi, "chętne stworzenia, które widzi" z jednorożca. A `smoke` (`{}` albo `{ "pierced": [senses] }`): chmura stoi na polach, które użytkownik opuścił, i na polach, na których ląduje, zasłaniając jak `obscures` strefy, od chwili lądowania do końca następnej tury użytkownika, czyli dym z Cape of the Mountebank.

Teleportacja z uderzeniem (Capability API 1.280). Teleportacja stworzenia może wskazywać jedną z jego własnych akcji jako `strike` (jej `id`): "Before or after teleporting, the dog can make one bite attack." z psa przeskakującego. Teleportacja pozwala wtedy, by ta akcja nastąpiła raz w tej turze za darmo (menu podaje "Free, part of the same action"), a menu oferuje ją także w odwrotnej kolejności, jako "Bite, then Teleport" za budżet teleportacji, po czym teleportacja następuje raz za darmo. Żadna z nich nie prowadzi do trzeciej. Uderzenie wykonane najpierw zużywa użycia i odnowienie teleportacji razem z własnymi i jest oferowane tylko wtedy, gdy zostały jedne i drugie. Uderzenie to inna zwykła akcja tego samego stworzenia: nie sama teleportacja, sekwencja, inna teleportacja, reakcja ani coś kupowane punktami. Wskazuje je tylko teleportacja stworzenia; teleportacja wpisu katalogu lub użycia przedmiotu z takim wskazaniem jest odrzucana. W walce, która nie mierzy odległości, teleportacja nigdzie nie prowadzi, więc nic nie jest łączone w pary. Reżyser walki także z tego korzysta: stworzenie zbyt daleko, by dojść do ofiary, teleportuje się obok niej i gryzie w tej samej turze.

Ciosy wysysające (Capability API 1.281). `mechanics` wpisu katalogu lub akcja stworzenia może zawierać `drain`: użytkownik odzyskuje zdrowie równe obrażeniom zadanym ciosem każdemu celowi, po uwzględnieniu odporności, zaokrąglone w dół i nigdy powyżej maksimum, a od maksimum celu nic nie jest odejmowane (do tego służy `reducesMax`). `share` (powyżej 0, najwyżej 1, po pominięciu całość) to część, która wraca, a `damageType` liczy tylko obrażenia tego typu: Psychic Drain aboletha to `drain: {}`, a Vampiric Touch to `drain: { "share": 0.5, "damageType": "necrotic" }`. To, co blokuje leczenie, blokuje także to. Wysysanie wymaga obrażeń, z których może oddać zdrowie, więc jest odrzucane we wpisie bez `amount`, w leczeniu albo w akcji stworzenia bez `damage`.

Wybuchy wyśrodkowane na użytkowniku (Capability API 1.282). `area` (wpisu katalogu lub akcji stworzenia) może zawierać `around: true`: wybuch o rozmiarze `size` wyśrodkowany na użytkowniku i nigdy niekierowany. W chwili użycia dosięga każdego w odległości `size` od użytkownika, zarówno przyjaciół, jak i wrogów, chyba że `friendlyFire` ma wartość false (leczący tylko stronę użytkownika), i nigdy samego użytkownika. Ściana między nimi chroni stworzenie, chyba że obszar zawiera też `throughWalls: true`: Channel Negative Energy władcy mumii, "including ones behind barriers and around corners". W walce bez planszy dosięga wszystkich. Nie jest w nikogo wymierzony, więc działa zarówno jako akcja specjalna kupiona między turami, jak i w turze. Na użytkowniku może być wyśrodkowany tylko pojedynczy wybuch (bez `copies`), `throughWalls` działa tylko z `around`, a wybuch wpisu wokół użytkownika działa natychmiast, więc nie zostawia `zone`. Channel Negative Energy to akcja stworzenia z `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` i `applies` nakładającym stan z efektem `cannot-heal` na `{ "rounds": 1, "of": "source" }`, do końca następnej tury władcy mumii. Reżyser walki ocenia taki wybuch według tego, kogo dosięga, tak jak ocenia kierowany kształt.

Legendarne ruchy (Capability API 1.283). Akcja stworzenia z kosztem `signature` może zawierać `move` i nie robić nic więcej: twórca porusza się między turami, wybierając pole na planszy tak jak przy ruchu we własnej turze, z przydziałem ruchu użyczonym tylko na ten ruch, więc ruch jego własnej tury pozostaje nienaruszony. `move: { "share": 0.5 }` to część jego szybkości (tarraska "przesuwa się o najwyżej połowę swojej szybkości"), `move: { "distance": 60 }` to odległość we własnej jednostce zestawu, a `move: {}` to cała szybkość; nie można podać naraz `share` i `distance`. Przy wyjściu z czyjegoś zasięgu można w nie uderzyć jak przy każdym ruchu, a okno, w którym go kupiono, jest pytane dalej, gdy uderzenie trafi. `noOpportunity: true` nikogo nie prowokuje (wampir "przesuwa się o najwyżej swoją szybkość bez prowokowania ataków okazyjnych"). `untouchable: true` to ruch, któremu nic nie może zaszkodzić ani go zatrzymać (Whirlwind of Sand władcy mumii, `{ "distance": 60, "untouchable": true }`): wszystko, co unieruchamia twórcę, najpierw go puszcza, nikt w niego nie uderza, a żadna strefa ani teren, przez które przechodzi, nic mu nie robią. Stworzenie unieruchomione lub bez szybkości nie może pójść nigdzie innym ruchem. Bez planszy nic nie jest oferowane. Reżyser walki kupuje taki ruch tak jak teleportację: aby odsunąć się od wroga obok, gdy jest ciężko ranny, albo zbliżyć się do niego, gdy żaden nie jest w zasięgu.

Legendarne rzucanie zaklęć (Capability API 1.284). Akcja stworzenia z kosztem `signature` może zawierać `casting` i nie robić nic więcej: między turami oferuje każde zaklęcie, które twórca mógłby rzucić we własnej turze z `budget` tej akcji, z jego `spellcasting` lub zaklęć z arkusza, nazwane "Cast a Spell: Fireball" itd. Każde jest kierowane, opłacane i rozstrzygane dokładnie tak jak w turze stworzenia (cele, pole dla obszaru, komórka lub użycie zużywane jak zawsze), a zamiast budżetu wydawane są punkty, więc jego własna tura zachowuje każdy budżet, który miała. `casting: { "cantripsOnly": true }` oferuje tylko sztuczki (zaklęcia nieopłacane z żadnej puli): Cantrip lisza, `signature: { "cost": 1 }`. Cast a Spell sfinksa to `casting: {}` z `signature: { "cost": 3 }`. Na wszystko, co otwiera zaklęcie (Counterspell, reakcja na zranienie nim), odpowiada się jak w turze, a okno, w którym je kupiono, jest pytane dalej, gdy wszystko to się zamknie. Reżyser walki kupuje takie rzucenie, gdy zaklęcie jest warte punktów, tak jak ocenia każdą inną akcję specjalną.

Ruch po akcji i na jednej szybkości (Capability API 1.285). Akcja specjalna, która coś robi (obrażenia, obszar, rzut obronny, stan), może zawierać też `move`: najpierw działa to, co robi, a potem twórca może przejść na pole oferowane przez menu, wybrane razem z akcją; niewybranie żadnego to także wybór, a pole, do którego po tym, co zrobiła akcja, nie da się już dojść, po prostu nie zostaje osiągnięte. `move` może też wskazywać jeden sposób poruszania się przez `speed` (`walk`, `fly`, `swim`, `climb` lub `burrow`): jego `share` odczytuje się wyłącznie z tej szybkości, porusza się tylko w ten sposób, a stworzenie bez tej szybkości nie może pójść nigdzie. Wing Attack smoka to wybuch wokół niego (`area: { "shape": "burst", "size": 10, "around": true }`, jego rzut obronny i powalenie) z `move: { "share": 0.5, "speed": "fly" }`: "The dragon can then fly up to half its flying speed." `move` nadal nie zawiera `teleport`, `sequence`, `reaction` ani `charge`. Reżyser walki odlatuje po uderzeniu skrzydłami, gdy jest ciężko ranny obok wroga, albo zbliża się do wroga poza zasięgiem.

Lekkie zasłonięcie i wiatr (Capability API 1.286). `obscures` strefy lub `smoke` teleportacji może zawierać `light: true`: wtedy nikogo nie ukrywa, a jedynie lekko zasłania każdego widzianego przez nie lub w nich, tak jak przyćmione światło z 5e albo dym z Cape of the Mountebank (Engine wie, kto jest widziany w ten sposób; korzystają z tego Hide i Perception). Może też zawierać `dispersed: true`: strefa, której reguła zawiera `disperses: true`, kończy ją wtedy wszędzie, gdzie się zetkną, po każdej akcji, razem z podtrzymującą ją koncentracją. Fog Cloud z 5e to `obscures: { "dispersed": true }`, a Gust of Wind to strefa z `disperses: true`; Darkness nie zawiera żadnego z nich, więc wiatr jej nie rusza. Strefa, która tylko rozprasza, nie potrzebuje wyzwalacza.

Ukrywanie się, Search i Detect (Capability API 1.287). `combat.hiding` sprawia, że akcja standardowa `hide` naprawdę działa: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` wskazuje dwa z `combat.checks` oraz opcjonalnie `passive` (10), `lightly` (5) i `combat.components`, które robią hałas. Hide rzuca `stealth` własnymi kośćmi walki; użytkownik jest wtedy ukryty przed każdym przeciwnikiem, który nie widzi go wyraźnie (za ścianą, we mgle, niewidzialny albo widziany tylko jako lekko zasłonięty), a którego pasywną Perception osiąga suma rzutu; pasywna Perception to `passive` plus jego test `perception`, pomniejszona o `lightly`, gdy widzi użytkownika tylko lekko zasłoniętego. Przeciwnik, przed którym użytkownik jest ukryty, nie widzi go, więc nie może niczego na niego skierować, użytkownik atakuje go jako niewidziany, a `combat.sight.unseenAttacks` daje temu atakowi ułatwienie. Ukrycie trwa przez kolejne tury i kończy się: dla wszystkich, gdy użytkownik zaatakuje, wykona test przeciwstawny, kogoś zrani lub wymusi rzut obronny albo użyje czegokolwiek wymagającego komponentu z `noisy` (zaklęcie bez komponentu werbalnego albo rozstawienie mgły zachowuje ukrycie); oraz dla każdego przeciwnika, który zacznie widzieć użytkownika wyraźnie lub którego pasywna wartość pokonuje teraz sumę, po każdym kroku i na każdym polu ruchu. Akcja standardowa `search` (dodaj ją do `combat.standard`; wymaga `combat.hiding`) rzuca `perception` i znajduje, dla szukającego, każdego ukrytego przed nim, którego sumę osiąga. Akcja stworzenia z `search: true` robi to samo i nic więcej: legendarne Detect to `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. Stworzenie odczytuje oba testy z własnych `checks`. Reżyser walki szuka, gdy każdy jego przeciwnik jest przed nim ukryty, i używa Detect między turami, gdy ukryty jest którykolwiek. Bez planszy nikt nie może być ukryty inaczej niż przez stan, który już go ukrywa.

Ready (Capability API 1.288). `combat.readying: { "budget": "reaction" }` sprawia, że akcja Ready naprawdę działa: dla każdej opcji, którą użytkownik mógłby teraz wykonać ze swoim budżetem `standard` (atak, zaklęcie, akcja stworzenia), i dla ruchu menu oferuje dwie pozycje, przygotowane na chwilę, gdy przeciwnik wejdzie w zasięg (`comes`), albo gdy przeciwnik zadziała (`acts`). Wybór jednej z nich zużywa budżet standardowy i wstrzymuje tę opcję do początku następnej tury użytkownika. Gdy ruch przeciwnika, na dowolnym kroku, doprowadzi go tam, gdzie wstrzymana opcja mogłaby zostać na niego skierowana (a jej posiadacz go widzi), albo przeciwnik zakończy tam jakiekolwiek działanie, okno pyta posiadacza, który wykonuje opcję nazwaną `readied` z `budget` (reakcja z 5e) albo z niej rezygnuje i podczas tego ruchu nie jest już pytany. Wstrzymany ruch sięga tak daleko, jak cała szybkość posiadacza, a wyjście przy nim z czyjegoś zasięgu daje ataki okazyjne jak każdy ruch. Przy `"concentrates": true` (wymaga `combat.concentration`) zaklęcie jest opłacane w chwili przygotowania i podtrzymywane koncentracją: przy uwolnieniu nie płaci się ponownie, utrata koncentracji oznacza jego utratę, a zaklęcie, które nigdy nie zostanie uwolnione, pozostaje zużyte. Przygotowanie czegokolwiek innego niczego nie kosztuje, dopóki nie zostanie uwolnione. W 5e to `{ "budget": "reaction", "concentrates": true }`.

Powolne rozpraszanie (Capability API 1.289). `dispersed` mgły może mieć postać `{ "after": N }` zamiast `true`: wiatr, który jej dosięga, kończy ją dopiero wtedy, gdy wieje na nią przez N pełnych rund z rzędu, liczonych od tury, w której pierwszy raz jej dosięgnął. Wiatr, który przestanie jej dosięgać wcześniej, bo został przesunięty, zakończył się lub zniknął, sprawia, że odliczanie zaczyna się od nowa, gdy któryś znów jej dosięgnie. Stinking Cloud z 5e, który silny wiatr, np. Gust of Wind, rozprasza po 1 rundzie, to `"obscures": { "dispersed": { "after": 1 } }`.

Szukanie ukrytych, z uwzględnieniem modyfikatorów (Capability API 1.290). Test walki odczytywany z umiejętności (`{ "skillMod": "stealth" }`) liczy się teraz przy rzucie jako test tej umiejętności, więc zmiana zawężona do niej przez `skills` działa przy Hide, Search i testach przeciwstawnych: utrudnienie do Stealth od ciężkiego pancerza, +10 z Pass without Trace, ułatwienie do Perception z Eyes of the Eagle. `combat.hiding.passiveMode` (w 5e 5) dodaje się do pasywnej Perception z ułatwieniem i odejmuje od pasywnej Perception z utrudnieniem; bez niego wartość pasywna nie odczytuje trybu. Zmiana `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` nakłada ten tryb na testy wykonywane, by znaleźć posiadacza, zarówno na pasywną wartość przeciwnika, jak i jego Search; przyjmuje `mode` i nic więcej. Cloak of Elvenkind z 5e. Gdy Search ustali, że ktoś zmienia sposób rzutu względem niego, rzuca ponownie tylko dla niego, a dziennik pokazuje także ten rzut.

Własne sposoby ukrywania się i wypatrywania u stworzenia (Capability API 1.291). Akcja stworzenia może być pozwoleniem, `"standard": { "actions": ["disengage", "hide"] }`: te akcje standardowe (z `combat.standard`) wykonywane za własny budżet tej akcji, tak jak Nimble Escape goblina z 5e za akcję dodatkową. Z `"while": "obscured"` obowiązuje tylko wtedy, gdy stworzenie stoi we mgle lub oparach albo walka toczy się w przyćmionym świetle lub w ciemności: Shadow Stealth cienia. `checkModes` stworzenia każą rzucać dwa razy jego własne testy niektórych umiejętności: `{ "skills": ["perception"], "mode": "advantage", "sight": true }` tylko wtedy, gdy widzi (Keen Sight), z `"light": ["sunlight"]` tylko w tym świetle (Sunlight Sensitivity, z `"mode": "disadvantage"`), a z `"terrain": ["snow"]` tylko na polu planszy lub w rodzaju miejsca, które wskazuje (Snow Camouflage; miejsca pochodzą z generatora walki taktycznej: snow, cave, mountains, water i inne). `passive` stworzenia to jego wydrukowana pasywna Perception, używana zamiast `hiding.passive` plus jego test (wymaga `combat.hiding`). Światło, w którym toczy się walka, zależy od pory dnia sceny: światło słoneczne za dnia na zewnątrz, przyćmione światło o świcie i zmierzchu, ciemność w nocy, a jasne światło niepochodzące od słońca wewnątrz budynków albo gdy pora dnia nie mówi niczego, co odczytuje Engine. Światło wpływa tylko na to, co je odczytuje (te tryby i `while: "obscured"`). Bez `combat.sight.darkness` (1.294) nie zmienia tego, kto kogo widzi.

Własne sposoby ukrywania się i znajdowania ukrytych (Capability API 1.292). `mechanics.hiding` wpisu katalogu (dowolnego rodzaju, łącznie z `utility`) i `hiding` stworzenia to pozwolenia odczytywane tam, gdzie `combat.hiding` naprawdę ukrywa. `"behindLarger": true` pozwala posiadaczowi ukryć się za kimś co najmniej o jeden rozmiar większym, stojącym między nim a patrzącym, na każdej linii między nimi (Naturally Stealthy niziołka; wymaga `combat.sizes`). `"still": 10` dodaje tyle do sumy Stealth przy ukrywaniu się, odejmowane ponownie, gdy posiadacz się poruszy lub wykona akcję (Hide in Plain Sight tropiciela). `"slow": "advantage"` każe rzucać Hide z ułatwieniem, gdy w tej turze przeszedł nie więcej niż połowę swojej szybkości (Supreme Sneak złodzieja). `"aware": { "within": 10, "lostWith": ["deafened"] }` oznacza, że nikt w tej odległości, we własnej jednostce zestawu, nie jest przed nim ukryty, chyba że ma jeden z tych stanów (Blindsense łotrzyka). `"starts": 15` stworzenia sprawia, że zaczyna walkę ukryte na widoku z tą sumą, przed każdym, czyja pasywna Perception jej nie pokonuje, niezależnie od tego, czy widzi je wyraźnie, dopóki się nie poruszy, i ukrywa się tak ponownie akcją Hide (Transparent galaretowatego sześcianu).

Własne rzuty ataku stworzenia rzucane dwa razy (Capability API 1.293). `attackModes` stworzenia obowiązują tam, gdzie obowiązywałyby jego `checkModes`: `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` to Sunlight Sensitivity z 5e, utrudnienie do ataków, dopóki widzi, a walka toczy się w świetle słonecznym. Każdy tryb określa, gdzie obowiązuje, przez `sight`, `light` lub `terrain`. Tryb łączy się z każdym innym ułatwieniem i utrudnieniem rzutu, więc oba nadal się znoszą.

Ciemność (Capability API 1.294). Z `combat.sight.darkness` światło, w którym toczy się walka, ogranicza widzenie oczami: `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. Nikogo w ciemności nie widać, a nikogo w przyćmionym świetle nie widać wyraźnie, chyba że przez zmysł z `seeIn` w jego zasięgu, który widzi ciemność jak przyćmione światło, a przyćmione światło jak jasne, albo przez zmysł `blind` lub jeden z `pierced` w ich zasięgu, które widzą niezależnie od światła. Co rozświetla ciemność: `carried`, światło niesione przez każdego walczącego z arkusza, chyba że sięga po nie zmysł z `seeIn` (pochodnia); `light` w stanie (sztuczka Light), w efekcie `worn` lub `carried` przedmiotu (latarnia) albo w stworzeniu (bandyci z pochodniami, żywiołak ognia). Każde to `{ "bright": N, "dim": N }` we własnej jednostce odległości zestawu: jasne światło na tę odległość i przyćmione na drugie tyle. Ściany nie przepuszczają światła, a ktoś powalony go nie rzuca. Tam, gdzie ciemność jest prawdziwa, wszystko, co odczytuje światło, odczytuje je w miejscu, w którym ktoś stoi: kto kogo widzi (ataki na niewidzianych, ukrywanie się, stworzenie, które widzisz), stanie w zasłonięciu (`while: "obscured"`) oraz `checkModes` i `attackModes` stworzenia. Walka w jaskini lub lochu toczy się w ciemności o każdej porze.

Gaszenie i ponowne zapalanie światła (Capability API 1.295). Każdy, kto niesie światło `carried`, ma w menu przełącznik dla niego, nazwany jego `label` (`"Torch"`; "Light", gdy żadnej nie podano). Kosztuje swój `budget`, jeśli go wskazuje, a w przeciwnym razie jest darmowy raz na turę. Zgaszone światło niczego nie oświetla, więc jego posiadacz może pozostać niewidziany w ciemności; po ponownym zapaleniu jest widziany i znaleziony, jeśli się ukrywał. Przedmiot z `toggle` rzuca `light` swojego efektu tylko wtedy, gdy jest włączony, jak latarnia z przesłoną.

Światła przełączane przez stworzenia i przedmioty (Capability API 1.296). Akcja stworzenia z `"sheds": { "bright": 10, "dim": 10 }` ustawia od tej chwili światło rzucane przez użytkownika, a `"sheds": "out"` je gasi. Nie robi nic więcej i w nikogo nie jest wymierzona: Ignited Illumination magmina to dwie takie akcje za jego akcję dodatkową, a Variable Illumination błędnego ognika to jedna akcja na każdy zasięg. Stworzenie z `"unlit": true` zaczyna walkę ze zgaszonym `light`, które trzeba zapalić jedną z jego akcji. `toggle.offLight` przedmiotu to światło, które rzuca, gdy jest wyłączony, zamiast światła z jego efektu: latarnia z opuszczoną przesłoną rzuca `{ "bright": 0, "dim": 5 }`. Światło bez zasięgu jasnego światła rzuca tylko przyćmione światło, nawet w miejscu, w którym się je trzyma.

Światło ze stref oraz światło, które kończy ciemność lub ujawnia niewidzialnych (Capability API 1.297). `lights` strefy zaklęcia (w stopach, jak każde `light`) rzuca światło tylko na własne pola strefy, mierzone od jej środka: punktu, w który rzucono wybuch, albo rzucającego w przypadku strefy przez niego utrzymywanej, więc latarnia kierunkowa to 60-stopowy stożek zakotwiczony na rzucającym z `"lights": { "bright": 60, "dim": 60 }`, który nie oświetla niczego za nim. Dancing Lights to jedna ruchoma strefa punktowa z `{ "bright": 0, "dim": 10 }`. Zasłaniająca strefa z `"obscures": { "darkness": true }` to magiczna ciemność, a strefa z `"dispelsDark": { "upTo": 3 }` kończy każdą taką ciemność, z którą stykają się jej pola, jeśli jej komórka była tego poziomu lub niższa, w chwili rzucenia którejkolwiek z nich: Daylight. Światło z `"reveals": true`, w strefie, efekcie przedmiotu, stanie lub stworzeniu, pokazuje każdego niewidzianego z powodu stanu, kto stoi w jego jasnym świetle: latarnia ujawniania. Każde z tych pól wymaga Capability API 1.297.

Światło ukryte pod stanem i światło słoneczne (Capability API 1.298). `"lightOutWhile": ["invisible"]` stworzenia gasi jego własne światło, niezależnie od tego, co ostatnio ustawiły jego akcje, dopóki ma którykolwiek z tych stanów, i przywraca je, gdy stan się kończy: Invisibility błędnego ognika ukrywa także jego światło. Światło z `"sunlight": true`, w stworzeniu, efekcie przedmiotu, stanie lub strefie, czyni swoje jasne światło światłem słonecznym, które odczytuje `"light": ["sunlight"]` w trybie testu lub ataku: sun blade przeciw Sunlight Sensitivity. Jego światło słoneczne liczy się także na planszy, która już jest jasna.

Magiczna ciemność przeciw światłu (Capability API 1.299). Strefa magicznej ciemności (`"obscures": { "darkness": true }`) z `"dispelsLight": { "upTo": 2 }` gasi światło stworzone przez zaklęcie tego poziomu lub niższego, wszędzie tam, gdzie się stykają, niezależnie od tego, które było pierwsze: `lights` strefy albo `light` stanu nałożonego przez zaklęcie, który kończy się wraz z koncentracją zaklęcia, jeśli to ona go podtrzymuje (Darkness z 5e na Flame Blade). Pola magicznej ciemności rozświetla tylko magiczne światło, niezależnie od tego, w jakim świetle toczy się walka: światło zaklęcia w strefie lub stanie zawsze jest magiczne, a każde inne światło jest magiczne, gdy zawiera `"magical": true` (światło sun blade); pochodnia wewnątrz ciemności niczego tam nie oświetla. `dispelsDark` z `"within": 60` kończy tylko ciemność tak blisko swojego środka: jasną sferę Daylight, a nie jego przyćmione światło dalej. Każde z tych pól wymaga Capability API 1.299.

Więcej z wyższego kosztu tylko co określoną liczbę kroków (Capability API 1.300). `"perCostStepsEvery": 2` dodaje `perCostStep` raz na każde dwa kroki wyższego kosztu zamiast za każdy krok. Akcja dawana przez stan (1.236) rośnie teraz według kosztu, za jaki opłacono zaklęcie, które nałożyło ten stan, z własnymi `perCostStep`, `perCostStepsEvery` i `perCostStepsMax`: uderzenie Flame Blade z 5e to `3d6` z `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`, więc ostrze przywołane komórką 4. poziomu uderza za 4d6. Użycie `perCostStepsEvery` wymaga Capability API 1.300.

Strefy noszone z kimś i kopie rozmieszczane osobno (Capability API 1.301). `"carried": "any"` strefy sprawia, że wybuch umieszczony na polu, na którym ktoś stoi, podąża za nim, wyśrodkowany na nim: Darkness lub Daylight z 5e rzucone na trzymany przez niego przedmiot. Przy `"own"` liczy się tylko pole, na którym stoi rzucający, dla zaklęcia, które można rzucić wyłącznie na przedmiot trzymany przez samego rzucającego. Umieszczona na pustym polu strefa pozostaje na nim. Noszona strefa to pojedynczy wybuch w punkcie i nigdy nie przesuwa się sama. `"copiesWithin": 20` obszaru rozmieszcza jego `copies` tak, że środek każdej kopii leży w odległości 20 stóp od środka innej, zamiast się stykać, a strefa z kopiami, którą rzucający może przesuwać (`move`), przesuwa wszystkie w ten sam sposób: Dancing Lights z 5e to wybuch o rozmiarze 10 stóp z `"copies": 4, "copiesWithin": 20` i `"lights": { "bright": 0, "dim": 10 }`. Każde z nich wymaga Capability API 1.301.

Wpisy, które zmieniają inne (Capability API 1.302). Wpis z listy arkusza z `"amends": [{ "entry": "spells/eldritch-blast", ... }]` zmienia ten wpis posiadacza przy każdym jego użyciu, a kilka takich zmian się sumuje. `"damageAdd"` (wartość, np. `{ "abilityMod": "cha" }`) dodaje się do obrażeń przy każdym trafieniu: Agonizing Blast. `"range"` (w jednostce odległości zestawu) to jego zasięg, jeśli jest większy: 300 stóp z Eldritch Spear. `"push"` odpycha trafionego o tyle prosto od użytkownika, a `"pushOptional": true` oferuje też wersję "Eldritch Blast (no push)": Repelling Blast. Zasięg lub odepchnięcie wymaga `combat.distance`, a wskazany wpis musi istnieć. Wymaga Capability API 1.302.

Użycia tylko w pewnym świetle i stany kończone przez ruch lub działanie (Capability API 1.303). Wpis z `"usableIn": { "light": ["dark", "dim"] }` jest oferowany tylko wtedy, gdy użytkownik stoi w jednym z tych rodzajów światła: One with Shadows. `endsWhenHolder` stanu może też zawierać `"moves": true` (kończy się, gdy posiadacz się poruszy) lub `"acts": true` (kończy się, gdy posiadacz wykona akcję, zaatakuje lub rzuci zaklęcie), obok `attacks` i `casts`: cienie ukrywają czarnoksiężnika, który się nie rusza. Wymaga Capability API 1.303.

Raz na stworzenie aż do odpoczynku (Capability API 1.304). Wpis z `"oncePerTarget": { "until": "long" }` (odpoczynek zadeklarowany przez zestaw) nie jest oferowany przeciw stworzeniu, na którym już go użyto, dopóki użytkownik nie odbędzie tego odpoczynku, niezależnie od liczby walk w międzyczasie: Chains of Carceri. To, na kim go użyto, jest przechowywane według nazwy w bieżącym arkuszu użytkownika i czyści to tylko ten odpoczynek. Nie dotyczy obszaru ani wpisu wymierzonego w użytkownika. Wymaga Capability API 1.304.

Cele rosnące wraz z arkuszem i ten sam cel ponownie (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` dodaje tyle celów na każdym progu odczytywanej wartości, tak jak `scales` dodaje kości. Z `"targetsRepeat": true` ten sam cel można wybrać więcej niż raz, a każdy wybór jest osobnym atakiem z własnym rzutem, przenoszącym wszystko, co zmienia wpis: promienie eldritch blast z obrażeniami z Agonizing Blast i odepchnięciem z Repelling Blast na każdym. Selektor celów walki dodaje promień przy każdym kliknięciu, dopóki jest miejsce, a Engine prowadzący uczestnika walki kieruje pozostałe promienie na wybrany przez siebie cel. Żadne z nich nie dotyczy obszaru ani wpisu wymierzonego w użytkownika. Wymaga Capability API 1.305.

Broń wkładana do ręki (Capability API 1.306). Wpis `"utility"` z `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` wkłada jedną z tych broni do walki wręcz do ręki użytkownika do końca walki, wybieraną przy użyciu tak jak tryb broni; `binds` oferuje też każdą trzymaną broń, do której pasuje, a która liczy się wtedy jako ta broń. Z `proficient` używa się jej z biegłością, a jej ciosy przenoszą `qualities`. Kolejne użycie ją zastępuje, a związana broń wraca do poprzedniego stanu. Zmiany wpisu przywołującego obejmują broń: `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` zmiany dodaje przy trafieniu obrażenia własnego typu (Lifedrinker), a `"strikes": 2` sprawia, że jedno wydanie budżetu ataku kupuje tyle ataków (Thirsting Blade). Engine prowadzący uczestnika walki raz wkłada mu do ręki broń, która uderza najmocniej. Wymaga Capability API 1.306: Pact of the Blade.

To, co podtrzymuje sam użytkownik (Capability API 1.307). Własna akcja stworzenia może zawierać `"concentration": true`, tak jak wpis katalogu: to, co nakłada, kończy się wraz z tą koncentracją, a obrażenia ją sprawdzają jak zwykle. Invisibility chochlika lub quasita. `endsWhenHolder` stanu może też zawierać `"uses": ["scare", "spells/bolt"]`: stan kończy się, gdy posiadacz użyje jednego z nich, czyli własnych akcji stworzenia według identyfikatora lub wpisów katalogu w postaci `<catalog>/<entry>`. Niewidzialność quasita kończy się, gdy użyje Scare. `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` wpisu nakłada te stany na samego użytkownika w chwili użycia, niezależnie od tego, co dzieje się z celami, podtrzymywane jego koncentracją, jeśli ją ma, na poziomie, na jakim go rzucono: drobina z Sunbeam, stan bojowy z `light` i `"actions": ["spells/sunbeam-line"]` dla późniejszych promieni. Stworzenie zawsze niewidzialne nie potrzebuje niczego nowego: `keepsOn: ["invisible"]` (1.263) utrzymuje ten stan. Wymaga Capability API 1.307.

Uzupełnienia wersji od 1.303 do 1.306 (Capability API 1.308). `use` zwoju lub różdżki może zawierać `targetsScale` i `targetsRepeat`, odczytywane z arkusza użytkownika: zwój eldritch blast wystrzeliwuje dodatkowy promień na 5. poziomie czytającego, a pociski z różdżki mogą wszystkie trafić w jedno stworzenie. Wymaga Capability API 1.308. Trzy zmiany nie wymagają nowego klucza. Reakcja jest działaniem: stan, którego `endsWhenHolder` zawiera `"acts": true`, kończy się też przy każdej reakcji posiadacza, tak jak One with Shadows kończy się przy "reakcji". `oncePerTarget` odróżnia dwa stworzenia o tej samej nazwie: Chains of Carceri na jednym chochliku nie dotyczy drugiego, a chochlik z późniejszej walki jest wykluczony tylko wtedy, gdy nazwa należała do tego jednego stworzenia. Broń wkładana do ręki (1.306) może być bronią do walki wręcz, którą można rzucać (atak mający zarówno `reach`, jak i `range`, np. sztylet lub oszczep). Odwołuje się ją bez akcji z menu walki i znika, gdy jej twórca zginie. Nigdy nie jest dalej niż 5 stóp od twórcy, bo walka nigdy nie wyjmuje jej z jego ręki.

Wymagania ukrywania się, Feral Senses, zaskoczenie i rytuał wiązania (Capability API 1.309). `hiding` ze `still` może zawierać `"stillWhile": { "holds": "camouflaged", "wall": true }`: premia liczy się tylko wtedy, gdy posiadacz ma ten stan (kamuflaż przygotowany wcześniej, wpisem utility trwającym minutę albo ustawiony przed walką), a z `wall` – gdy stoi obok pola blokującego widzenie. Tak działa Hide in Plain Sight. `"unseenStrikes": true` usuwa utrudnienie przy atakowaniu kogoś, kogo posiadacz nie widzi, co stanowi pierwszą połowę Feral Senses. Druga połowa niczego nie wymaga, bo walka już wie, gdzie jest każde nieukryte stworzenie. `hiding` stworzenia ze `starts` może zawierać `"surprises": true`: każdy, przed kim zaczyna ukryte, zaczyna walkę zaskoczony, tak jak przy Transparent galaretowatego sześcianu. `conjures` z `binds` może wskazywać bieżące pole tekstowe w `"boundIn"`: związana jest tylko zapisana tam trzymana broń, a gdy pole jest puste, żadna. Wpisanie tam nazwy to godzinny rytuał wykonany poza walką, w czasie krótkiego odpoczynku. Wymaga Capability API 1.309.

Powtórzenia i stany kończące się na odległość (Capability API 1.310). Mechanika wpisu z koncentracją może zawierać `"repeats": { "budget": "action" }`: dopóki użytkownik się na nim koncentruje, jego efekt jest ponownie oferowany za ten budżet, nic nie kosztuje z arkusza, nie rozpoczyna nowej koncentracji i niczego ponownie nie nakłada na użytkownika, na poziomie i kroku kosztu, za jakie opłacono rzucenie. Menu pokazuje to jako "Vampiric Touch again". `"notSaved": true` nigdy nie oferuje go przeciw stworzeniu, które zdało rzut obronny przeciw temu rzuceniu (Eyebite), a `"sameTargets": true` oferuje go tylko przeciw tym, w których wymierzono rzucenie (Heat Metal, za akcję dodatkową). `repeats` wymaga `concentration` i znanego budżetu. `applies` może zawierać `"endsAway": { "beyond": 60, "unseen": true }`: stan znika, gdy posiadacz stanie dalej niż ta odległość od tego, kto go nałożył, a z `unseen` – gdy dodatkowo go nie widzi. Tak działa panika z Eyebite. Sprawdza się to na każdym kroku każdego ruchu, czyjegokolwiek, i na końcu każdej tury. Wymaga Capability API 1.310.

Uzupełnienia wersji 1.307 i 1.309 (Capability API 1.311). `use` przedmiotu może zawierać `appliesSelf`, tak jak mechanika wpisu: zwój Sunbeam zostawia drobinę, a wraz z nią późniejsze promienie, w ręce czytającego, podtrzymywaną koncentracją z odczytania. Akcja stworzenia może zawierać `"dyingOnly": true` (można wybrać tylko stworzenie bez zdrowia, które nadal żyje), `"slaysOnFailedSave": true` (cel, który nie zda własnego rzutu obronnego akcji, ginie) i `"healsOnSlay": { "dice": "3d6" }` (stworzenie odzyskuje tyle za każdego, kto zginie). Tak działa Consume Life błędnego ognika. `slaysOnFailedSave` wymaga `save`, a `healsOnSlay` wymaga `slaysOnFailedSave`. Reguła w `combat.conditions` może zawierać `"endsWhenHolder": { "moves": true, "acts": true }`: stan znika z posiadacza i z jego arkusza przy pierwszym kroku (`moves`) albo przy czymkolwiek, co zrobi poza Hide, łącznie z reakcjami (`acts`), niezależnie od tego, jak go nałożono. To kamuflaż z Hide in Plain Sight, zaznaczany w arkuszu przed walką. Wymaga Capability API 1.311.

Grzmot wokół trafienia (Capability API 1.312). Tryb broni może zawierać `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`. Trafienie w tym trybie sprawia, że trafiony i każdy, kto stoi w odległości `within` od niego, wykonuje rzut obronny albo otrzymuje `condition`. Obejmuje to sojuszników i władającego, jeśli stoją tak blisko. `rounds` liczy ich własne tury, a z `of: "source"` tury władającego, więc `rounds: 1, of: "source"` oznacza "do końca twojej następnej tury". `of` wymaga `rounds`. Bez planszy rzut obronny wykonuje tylko trafiony. Razem z `range` i `charges` trybu to Hammer of Thunderbolts rzucony za ładunek. Jego Giant's Bane to `slay` broni z `when: "critical"`. Wymaga Capability API 1.312.

Maze, Expeditious Retreat, wybory rzucania i ograniczone dodatki do atrybutów (Capability API 1.313). `dismisses` z `while` może zawierać `"turns": true`. Stworzenie jest poza walką, ale nadal wykonuje swoje tury, a w nich oferowane jest mu tylko to, co kończy trzymający je z dala stan, albo zakończenie tury. `applies` może zawierać `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`: posiadacz może wydać budżet standardowy na ten test `combat.checks` przeciw tej liczbie, aby zakończyć stan. Stworzenie spełniające `passes` odnosi sukces bez rzutu. Razem to Maze z 5e i jego minotaur, wracający tam, gdzie był, gdy test się powiedzie. Mechanika wpisu może zawierać `"takes": ["dash"]` (lub `disengage`, `dodge`), a użytkownik wykonuje te akcje standardowe w chwili użycia: Expeditious Retreat wykonuje Dash przy rzuceniu. Późniejsze Dash za akcję dodatkową pochodzą z `grants` jego stanu. `repeats` może wskazywać `group`: wpisy jednej grupy to wybory jednego rzucenia, a dopóki trwa koncentracja na którymkolwiek z nich, każdy z nich jest ponownie oferowany. `notSaved` i poziom rzucenia są wspólne, tak jak przy uśpieniu, panice i chorobie z Eyebite. Zmiana atrybutu przez przedmiot `{ "add": 4, "max": 30 }` dodaje się do wartości pozostawionej przez każde `set`, najwyżej do `max`, i nigdy nie obniża wartości już wyższej. Bez `max` dodatek działa jak wcześniej. `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` przedmiotu pozwala go związać tylko wtedy, gdy ta sama postać nosi po jednym przedmiocie z każdej grupy, związanym tam, gdzie ten przedmiot wymaga związania, i rozwiązuje go, gdy tylko jeden z nich zostanie zdjęty, rozwiązany lub opuści torbę. Z `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }` to Hammer of Thunderbolts. Wymaga Capability API 1.313.

Resilient Sphere (Capability API 1.314). Wpis `combat.conditions` może zawierać `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`. Dopóki stan działa, posiadacz jest odcięty od wszystkich innych. Nikt inny nie może w niego niczego wymierzyć, obszar lub wybuch go omija, a nic od nikogo innego go nie rani, nie leczy ani nie nakłada na niego stanu, łącznie ze strefami i aurami. Nic, co należy do niego, nie sięga też nikogo innego, nikt nie uderza w niego, gdy się porusza, ani on w nikogo. Jego własny ruch wynosi zero, ale z `rolls` może wydać ten budżet, aby przesunąć się o najwyżej `share` swojej szybkości. Z `lifted` ktoś stojący obok może wydać ten budżet, aby go podnieść. Potem posiadacz podąża wszędzie tam, dokąd idzie niosący, dopóki niosący go nie postawi, co jest darmowe, albo stan się nie skończy. Wpisy z `brokenBy` nadal można wymierzyć w posiadacza, a zamiast swojego działania kończą stan i podtrzymującą go koncentrację: Disintegrate na sferze. Mechanika wpisu może zawierać `"targetsUpTo": "large"`, jeden z `combat.sizes`, a wtedy wpis jest wymierzany tylko w stworzenia tego rozmiaru lub mniejsze. To "rozmiaru Large lub mniejszego" z Resilient Sphere. Wymaga Capability API 1.314.

Akcje legowiska (Capability API 1.315). Akcja stworzenia może zawierać `"lair": true`, a stworzenie `"lairInitiative"` (po pominięciu 20). Dopóki stworzenie walczy we własnym legowisku (`"inLair": true` Mistrza Gry przy tym wrogu albo lista `inLair` starcia), wykonuje jedną akcję legowiska na rundę, gdy licznik walki minie wartość inicjatywy legowiska, przegrywając remisy: między dwiema turami, pomiędzy którymi wypada ta wartość, po ostatniej turze rundy, gdy wszyscy mają tę wartość lub wyższą, albo przed pierwszą turą, gdy wszyscy mają niższą. Nie może wykonać tej samej akcji legowiska w dwóch kolejnych rundach. Akcję legowiska kieruje się i rozstrzyga jak we własnej turze, z użyczonym na nią `budget`, i nie zużywa ona niczego z własnej tury stworzenia. Nigdy nie ma jej w menu własnej tury stworzenia i nie jest wykonywana, gdy stworzenie leży lub nie może działać. Akcja legowiska nie jest reakcją ani nie kupuje się jej punktami, sekwencja nigdy jej nie wskazuje, a `lairInitiative` wymaga co najmniej jednej akcji legowiska. Smoki z 5e wykonują swoje przy wartości inicjatywy 20.

Obiekty (Capability API 1.316). Walka na planszy może mieć na niej obiekty, które da się zniszczyć: `board.props` starcia albo `props` pola bitwy świata, tak jak je namalowano. Każdy ma `label`, zajmowane pola `cells`, swoje `health`, `defense` (po pominięciu 10) i opcjonalne typy obrażeń `resist`, `vulnerable` i `immune`. `blocks` zamyka jego pola dla ruchu (`move`), widzenia (`sight`) lub obu, dopóki stoi, a nikt nie zaczyna walki wewnątrz niego. Obiekt `fragile` niszczy wszystko, co w niego trafi. Atak, który może uderzyć w segment ściany, może zamiast tego uderzyć w obiekt: jest on wymieniony wśród `walls` opcji, a `wall` wyboru wskazuje jego pole. Obszar dosięga każdego obiektu w swoim zasięgu i zadaje te same obrażenia, które rzuca dla wszystkich innych; obiekt nigdy nie wykonuje rzutu obronnego. Obiekt z 0 jest zniszczony: niczego już nie zamyka, a jego etykieta zostaje dodana do listy `broken` planszy, podsumowania walki i podsumowania czytanego przez Mistrza Gry (`Broken: Sluice Gate; Oil Jar`). Wyzwala to wyzwalacz `broke` fabuły.

Legendary Resistance (Capability API 1.317). `"legendaryResistance": 3` stworzenia zamienia jego pierwsze trzy nieudane rzuty obronne w walce w sukcesy, "If the dragon fails a saving throw, it can choose to succeed instead" (3/Day) z 5e. Engine zawsze z tego korzysta, przy każdym rzucie obronnym, łącznie z takim, którego stan każe od razu nie zdać; nigdy, gdy stworzenie leży. Rzut obronny trafia do dziennika tak, jak go rzucono, a po nim wiersz informujący, że zamiast tego się powiódł, i ile użyć zostało. Liczba całkowita od 1 do 20.

Użycie przedmiotu także może zawierać `"targetsUpTo"` (Capability API 1.317), tak jak mechanika wpisu od 1.314: `"targetsUpTo": "large"` zwoju Resilient Sphere sięga tylko stworzenia tego rozmiaru lub mniejszego. Odczytuje `combat.sizes` i jest przeznaczone dla użycia wymierzonego w stworzenie, nie w obszar.

Zdarzenia planszy i roślinność (Capability API 1.318). Plansza walki może zmieniać się sama wraz z upływem rund: `board.events` starcia albo `events` pola bitwy świata, tak jak je namalowano. Każde zdarzenie ma `id`, opcjonalną `label` i zachodzi `at` `"round-start"` lub `"round-end"`, `from` rundy (po pominięciu 2 na początku rundy, 1 na końcu), `every` tyle rund (1) i `until` rundy, jeśli ją podano. `where` wskazuje jego pola: `cells`, `block` (`x`, `y`, `w`, `h`), `ring` wokół pola (`x`, `y`), który za pierwszym razem sięga `start` pól, a za każdym kolejnym o `step` pól dalej, `sweep` od jednej krawędzi (`from` `north`, `south`, `east` lub `west`) z tymi samymi `start` i `step` albo `{"spread": "growth"}`, czyli każde wolne pole obok roślinności. Pierścień lub zamiatanie obejmuje tylko swój najnowszy pas, głęboki na `step` pól (co najmniej jedno), także za pierwszym razem, więc pierścień ze `start` 3 nie rusza swojego środka; `filled` obejmuje wszystko wewnątrz. `onlyOn` ogranicza je do pól tych rodzajów terenu. `change` określa, co się tam dzieje, co najmniej jedno z: `terrain`, `height` (od 0 do 3), `light` (`bright`, `dim`, `dark`, `sunlight` lub `clear`), `obscured` (`light`, `heavy` lub `clear`), `growth` (true lub false), `season` (nazwa albo null, aby ją usunąć), `rotate` (tylko kwadratowy `block`, obrócony o 1, 2 lub 3 ćwierćobroty zgodnie z ruchem wskazówek zegara razem z kafelkami, wysokościami, podłożem, obiektami leżącymi w nim w całości i każdym, kto stoi w nim w całości) oraz `tell`, czyli wiersz, który dziennik podaje zamiast zwykłego. Każdy, kto zostaje w miejscu, w którym nikt nie może stać (lód pękający w wodę), zostaje przeniesiony na najbliższe wolne pole. Plansza mieści do 32 zdarzeń.

Unoszeni z prądem (Capability API 1.329). `change` zdarzenia planszy może też zawierać `push`, `{"toward": "east", "squares": 3}` (krawędź `north`, `south`, `east` lub `west` i od 1 do 6 pól): każdy, kto stoi na ziemi na jego polach, zostaje przeniesiony w tę stronę pole po polu, nigdy poza planszę, w ścianę lub zamknięty obiekt, na podłoże, na którym nikt nie może stać, ani na kogoś innego, i nikt nie uderza go z tego powodu; najpierw przesuwają się ci najbliżej tej krawędzi, a ktoś w powietrzu pozostaje na miejscu. Dziennik podaje, kogo przeniosło. Młynówka z Mill of Hours. Albo `drift` o tej samej postaci: wszystko, co zasłania jego pola (lekko lub mocno), zostaje zdmuchnięte w tę stronę i wraca po przeciwnej stronie jego `block` albo planszy przy każdym innym `where`; nic innego na polach się nie przesuwa, a mocne zasłonięcie pozostaje tam, gdzie nawiewane jest lekkie. Zaspy z Leaffall. Namalowane zdarzenia pola bitwy przyjmują oba.

Wejście na pole z roślinnością kosztuje podwójnie (nie więcej niż inny trudny teren), a roślinność lekko zasłania każdego, kto w niej stoi. Cios, którego typ obrażeń tnie roślinność (cięte, chyba że `growth.cutBy` planszy stanowi inaczej), można skierować na pole z roślinnością w swoim zasięgu, wymienione wśród `walls` opcji: oczyszcza to pole bez rzutu i zużywa akcję. Obrażenia typu, który pali roślinność (ogień, chyba że `growth.burnedBy` stanowi inaczej), wypalają ją na każdym polu, na które trafiają, w całym zasięgu obszaru albo na polu trafionego. Mechanika wpisu lub użycie przedmiotu z `"clears": "growth"` i `area` usuwa roślinność z tego obszaru: sekator, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. `board.ground` starcia maluje na polach początkową roślinność, światło, zasłonięcie i pory roku; pole bitwy świata maluje roślinność jako wiersze `growth` ze znaków `g` i `.`, a pory roku tak jak Experiences.

Cień, reguły światła, dzwonki i stworzenia unikające światła (Capability API 1.319). Światło z `"shade": true` rzuca cień: przyćmione światło tak daleko, jak sięga jego `dim`, a jasne światło i światło słoneczne są tam także przyćmione, niezależnie od tego, co jeszcze je oświetla. Nie ma jasnego światła i nie jest ani `reveals`, ani `sunlight`. Cień nigdy nie sięga do magicznej ciemności. Lantern of Dusk z przykładowej gry to przedmiot noszony z `{"light": {"bright": 0, "dim": 15, "shade": true}}`. Własne światło pola (1.318) i cień są też tym, co odczytują tam oczy: na jasnej planszy stworzenie stojące na ciemnym polu jest widziane tylko przez zmysł widzący w ciemności.

Plansza walki może mieć regułę światła: `board.lightRule` starcia albo `lightRule` pola bitwy świata, tak jak je namalowano. Na końcu każdej rundy każdy, kto stoi w całości w jednym z jej rodzajów światła (`in`, domyślnie jasne światło i światło słoneczne; jasne światło obejmuje światło słoneczne), dolicza tam jeden kolejny koniec rundy, a przy co `rounds`-tym (domyślnie 1) jej `tracks` przesuwają się o `by`, a stany z jej `applies` zostają na niego nałożone. Wyjście, nawet w cień jednego pola, zaczyna odliczanie od nowa. `spares` wskazuje `types` i `tags` stworzeń, których nigdy nie dotyczy. Reguła, która nie przesuwa żadnego toru istniejącego w arkuszu i nie nakłada żadnego stanu znanego walce, nic nie robi i jest pomijana. Noonfield to `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`: poziom wyczerpania za minutę w słońcu.

Rzuty obronne reguły światła (Capability API 1.321). `save` reguły światła (`save`, `difficulty`) wykonuje każde stworzenie, którego reguła ma właśnie dotyczyć, a udany rzut tym razem pozwala jej uniknąć; odliczanie i tak zaczyna się od nowa. Jej `against` (`conditions` znane walce, typy `damage`) określa, przeciw czemu liczy się rzut obronny, więc stosuje się modyfikator rzutów obronnych z pasującym `against`: słomkowy kapelusz noszony lub niesiony z `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. `upTo` wpisu toru to granica, do której reguła go przesuwa, więc wyczerpanie, które by ją przekroczyło, zatrzymuje się na niej, a po jej osiągnięciu nie jest już dodawane. Noonfield w pełnej postaci: `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, ze stanem `noon_light`, który dodaje doświadczenie, aby kapelusz mógł go wskazać.

Użycia przedmiotów jako reakcje (Capability API 1.322). `use` przedmiotu (lub jedno z jego `moreUses`) może zawierać `reaction`, zapisane tak jak we wpisie katalogu, i jest wtedy oferowane tylko wtedy, gdy otwiera się ta chwila, opłacane z `budget` (reakcja niosącego) oraz z ładunków lub samego przedmiotu, jak każde użycie. Liesl's Coffin, raz dziennie, gdy stworzenie w odległości 5 stóp od niosącego zostaje trafione, +5 do klasy pancerza tego stworzenia do początku następnej tury niosącego, także przeciw temu trafieniu: `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` w przedmiocie z `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. Straw Proxy: atak wymierzony we właściciela przepada, a zastępca spala się: `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. Użycie przedmiotu wskazuje swoją chwilę: `"reaction": true` jest odrzucane.

Held Ground i koszenie (Capability API 1.323). Walka może toczyć się na Held Ground, w miejscu, w którym śmierć jest wstrzymana: `heldGround` walki (`label`, `condition` i `marks` w postaci `[{"track", "by"}]`), przekazywane przez regułę regionu fabuły. Tam każdy, kto straci całe zdrowie, zostaje powalony zamiast zginąć lub upaść: przeciwnik wypada z walki; postać leży ustabilizowana, nigdy nie wykonuje rzutów przeciw śmierci, nie otrzymuje porażek od zranienia i można ją normalnie uleczyć. Powaleni otrzymują jej `condition` (a postać także własny stan zestawu oznaczający leżenie), a każdy z arkuszem przesuwa swoje tory `marks`: znak Owing z przykładowej gry. To, co zabiłoby od razu, zamiast tego powala. Cios z `reaps`, w akcji stworzenia lub ataku przedmiotu, kosi każdego, kogo powali: koszony pozostaje powalony, nie otrzymuje stanu ani znaku, a skoszona postać jest martwa. Reaping Hook to broń, której `attack` ma `"reaps": true`. Powaleni i skoszeni uczestnicy walki mają `felled` i `reaped`, aby fabuła mogła później podnieść powalonych.

Uwolnienie Held Ground (Capability API 1.330). Fabuła może uwolnić Held Ground w trakcie walki, gdy obraca się rok: `releaseRulesetHeldGround(definition, state, release)` reżysera (pod spodem wspólne `rulesetReleaseHeldGround`). Od tej chwili każdy, kto straci całe zdrowie, ginie lub upada tak jak wszędzie indziej. Powaleni, których nie skoszono, giną, zarówno przeciwnicy, jak i postacie, chyba że `release.felled` ma wartość `"down"`; wtedy postać zamiast tego upada i zaczyna umierać zgodnie z regułą zestawu. Z `release.owing` (`{"track"?, "bonus"?}`, gdzie torem jest po pominięciu pierwszy tor oznaczany przez Held Ground) znaki każdej postaci na nim stają się wymagalne: jeden rzut przeciw śmierci zestawu za każdy znak, z `bonus` dodanym do każdego (Debts Settled drużyny), rzucany, dopóki znaki się nie skończą albo wynik nie zostanie rozstrzygnięty, z naturalnymi wynikami zgodnie z regułą umierania; znaki są potem zużywane. Trzy porażki (szczyt toru porażek) oznaczają śmierć. Dziennik podaje, kto zginął, kto upadł, i rzuty każdej postaci. Walka, która nie toczy się na Held Ground, pozostaje bez zmian.

Obszary i podłoże stworzeń (Capability API 1.324). Akcja stworzenia z `area` może pozostawić ten obszar przez `zone`, zapisane tak jak strefa wpisu katalogu (`rounds`, `triggers`, `obscures`, `terrain` i reszta): Freezing Fog z The Owed, sześcian mąki ze Scatter Flour, ziemia zamarzająca w trudny teren. Strefa z `"untilLair": true` kończy się też, gdy znów nadejdzie licznik legowiska jej twórcy, przed wybraniem tej akcji legowiska, jeśli wcześniej nie zakończyły jej `rounds`: "do następnej akcji legowiska". Akcja stworzenia może zamiast tego trwale zmienić podłoże w swoim obszarze przez `ground`, zapisane tak jak `change` zdarzenia planszy (`terrain`, `height` od 0 do 3, `light`, `obscured`, `growth`, `season` i `tell` dla dziennika): ognisko przygasa (`"light": "dark"`), lód pęka (`"terrain": "water"`); każdy, kto zostaje na polu, na którym nikt nie może stać, zostaje przeniesiony na najbliższe wolne. Oba wymagają `area` akcji, a `ground` musi coś zmieniać. Zestaw używający któregokolwiek z nich albo `untilLair` w dowolnym miejscu wymaga Capability API 1.324.

Stworzenia przywoływane do walki (Capability API 1.325). Akcja stworzenia może zawierać `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`: w chwili użycia tyle wskazanych stworzeń z bestiariusza (`"<catalogId>/<entryId>"` z katalogów zestawu lub z bestiariusza przekazanego walce; `count` to `{"dice"}`, `{"flat"}` lub oba, najwyżej osiem za każdym razem) dołącza do walki po stronie użytkownika, zbudowanych tak, jak walka zbudowała własne, i nazwanych po kolei ("Zombie 1", "Zombie 2"). Z `area` zostają umieszczone tam, gdzie wycelowano obszar, a gdy jest pełny, tak blisko niego, jak pozwala miejsce; bez niego – obok przywołującego, a akcja nie jest w nikogo wymierzona. Rzucają własną inicjatywę i zajmują miejsce w kolejności: miejsce, które tury tej rundy już minęły, przypada w następnej rundzie. Z `"initiative": "after"` ich tury następują zamiast tego bezpośrednio po turze przywołującego. Akcja legowiska może przywoływać (Shelves Lean), a tura, między którą wypadł jej licznik, trwa dalej jak wcześniej. Stworzenie, którego nie można znaleźć na początku walki, nikogo nie przywołuje, a walka mieści najwyżej 40 uczestników. Dziennik podaje, kto przybył. Zestaw używający `calls` wymaga Capability API 1.325.

Przyciąganie do stworzenia (Capability API 1.326). Akcja stworzenia może zawierać `"draws": { "spends": "reaction" }`: każdy, kogo trafi (przy `save` – tylko przy nieudanym rzucie), od razu wydaje ten budżet, aby przejść najwyżej swoją szybkość w stronę stworzenia, wolną drogą do osiągalnego pola najbliższego stworzeniu, nie prowokując uderzeń. Ktoś, komu nie zostało nic z tego budżetu albo kto nie mógłby się zbliżyć, nic nie wydaje i zostaje na miejscu. Whisper a Name z The Owed. `spends` to jeden z budżetów ekonomii. Zestaw używający `draws` wymaga Capability API 1.326.

Czas akcji legowiska (Capability API 1.327). Akcję stworzenia z `"actedOnly": true` można wymierzyć tylko w kogoś, kto już zaczął swoją turę w tej rundzie, łącznie z tym, którego tura trwa; przed pierwszą turą walki, gdy legowisko działa przed wszystkimi, nikt jeszcze jej nie zaczął. To "jedno stworzenie, które już działało w tej rundzie" z Hour Bell. Czas trwania stanu może dodać do `rounds` `"untilLair": true`: stan znika też, gdy ten, kto go nałożył, znów dojdzie do licznika swojego legowiska, przed wybraniem tej akcji legowiska ("do następnej akcji legowiska" z Hour Bell). Akcja stworzenia podtrzymywana swoją `concentration` może wskazywać `"brokenNextLair"`, jedną z własnych akcji legowiska: gdy ta koncentracja zostanie przerwana (zranieniem, upadkiem lub działaniem strefy, nigdy przez to, że posiadacz ją kończy lub zaczyna inną), ta akcja legowiska jest następną, którą wykona, i jedyną oferowaną, niezależnie od tego, co wykonało w poprzedniej rundzie; po jej wykonaniu wybór znów jest wolny. Litany of Keeping ojca Ivo i przechylające się regały. Zestaw używający któregokolwiek z nich wymaga Capability API 1.327.

Trudność rzutów obronnych zmieniana przez stan (Capability API 1.328). Zmiana stanu `{ "to": "save-difficulty", "flat": -2 }` przesuwa trudność każdego rzutu obronnego, którego wymaga posiadacz, dopóki ma ten stan: własnych rzutów obronnych jego akcji i trudności rzutów obronnych kończących to, co te akcje nakładają. Przyjmuje wartość `flat` i nic więcej, nigdy nie dotyczy trudności testu, rzutu obronnego koncentracji (wyznaczanego przez obrażenia) ani stworzeń przywoływanych do walki przez akcję. Un-age z Miller of Hours: trudność rzutu obronnego zaklęć niższa o 2. Zestaw, który tego używa, wymaga Capability API 1.328.

Obiekty i karmienie (Capability API 1.331). Stan bojowy może zawierać `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`: działa tylko wtedy, gdy posiadacz stoi w tej odległości (w jednostkach zestawu) od stojącego obiektu planszy o tej etykiecie, a w każdym innym miejscu lub po zniszczeniu obiektu jest wstrzymany, nie zakończony; walka bez planszy go utrzymuje. Wheel's Favour. Wybuch `area` akcji stworzenia może zawierać `"aroundProp": "Shelf"`: gdziekolwiek zostanie wycelowany, obejmuje każde pole w odległości `size` od stojącego obiektu o tej etykiecie, także za nim. Shelves Lean wokół rzędów regałów w Granary. Aura może zawierać `"feeds": 15`: posiadacz odzyskuje tyle punktów życia za każdym razem, gdy ktoś, kogo aura sięga, zostanie powalony, upadnie lub zginie, a aura może robić tylko to. Collector z The Owed. Zestaw używający któregokolwiek z nich wymaga Capability API 1.331.

Ponowne zapalanie, wpadanie i użycia obok obiektu (Capability API 1.332). Obiekt planszy (`board.props` starcia albo namalowany na polu bitwy) może zawierać `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`: dopóki którekolwiek pole w odległości `squares` od niego nie jest w tym świetle w odczycie walki, ktoś stojący obok otrzymuje ofertę "Light it again" za ten budżet (po pominięciu `action`), która nakłada to światło na każde z tych pól. Ognisko z The Owed po Bonfire Gutters. `ground` akcji stworzenia może zawierać `"occupants": "stay"` ze swoim `terrain`: każdy, kto stoi tam, gdzie podłoże zmienia się w coś, na czym nikt nie stoi, zostaje tam, wpadając przez lód do wody, zamiast zostać przeniesiony na najbliższe wolne pole (`"shove"`, domyślnie). Wpis katalogu lub użycie przedmiotu może zawierać `"usableNear": {"prop": "Year-Wheel", "within": 5}`: jest oferowane tylko wtedy, gdy użytkownik stoi w tej odległości od stojącego obiektu wskazanego identyfikatorem lub etykietą, nigdy w walce bez planszy. Hymnal Fennicka przy Year-Wheel. Od 1.332 `whileNearProp`, `aroundProp` i `usableNear` wskazują obiekt w ten sam sposób: po identyfikatorze (`"p1"`) albo po etykiecie odczytywanej swobodnie, bez względu na wielkość liter, początkowe "the" i wszystko poza literami i cyframi, więc `"Year-Wheel"` znajduje obiekt z etykietą "The Year-Wheel". Zestaw używający `usableNear` lub `occupants` wymaga Capability API 1.332.

Grafika planszy walki (Capability API 1.333). Planszę walki można rysować z pakietu planszy: arkuszy PNG na siatce pól (48 pikseli dla wyglądu RPG Maker) z kafelkami pod stałymi identyfikatorami, tworzonych w Pixelforge i przechowywanych w bibliotece (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` i `bt_wall` to rodzaje terenu, każdy z najwyżej ośmioma wariantami wybieranymi dla każdego pola osobno albo z jednym wzorem większym niż pole, nakładanym na planszę; `bt_edge_water` i `bt_edge_wall` to bloki podwójnej siatki z szesnastu elementów, cztery na cztery pola, ułożone tak jak bloki `edge_` w Pixelforge, które łączą wodę i ściany z sąsiednimi równinami; `bt_height1` do `bt_height3` to krawędzie nad podwyższonym terenem. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (pole zimą), `bo_zone`, `bo_aim` i `bo_reach` są rysowane na polu zamiast dzisiejszych zabarwień. Sprite obiektu to `bp_<name>` na jego polach (`"art": "bp_bonfire"` w obiekcie albo, po pominięciu, jego etykieta małymi literami ze słowami połączonymi `_` i bez początkowego "the", więc "The Year-Wheel" to `bp_year_wheel`), a po zniszczeniu `bp_<name>_broken`. Namalowane pole bitwy lub plansza starcia może wskazać swój pakiet przez `"pack": "local/<id>"`; bez niego plansza jest rysowana pakietem z biblioteki dla jej środowiska (`environment` pakietu), potem wbudowanym `board/<environment>`, a potem tak jak dziś, a obiekty są też wyszukiwane w pakiecie obiektów biblioteki (`"environment": "props"`), a potem we wbudowanym `board/props`. Kafelek, którego brakuje w pakiecie, jest rysowany tak jak dziś. Strefa katalogu może zawierać `"art": "bz_<name>"`: każde pole, które obejmuje, jest rysowane tym kafelkiem z pakietu planszy, a w przeciwnym razie `bo_zone`. Zestaw używający `art` strefy wymaga Capability API 1.333.

Więcej tury z przedmiotu (Capability API 1.334). Użycie przedmiotu może zawierać `"gives": [{"budget": "action", "count": 1}]`, tak jak mechanika wpisu katalogu (Action Surge): użycie od razu daje użytkownikowi tyle więcej tury, z ograniczeniem w chwili dodania, więc niczego nie da się zachować na później. Time-Flour Loaf, zjedzony za akcję dodatkową, od razu daje jedną akcję więcej. Zestaw, który tego używa, wymaga Capability API 1.334.

Kości wydawane podczas odpoczynku (Capability API 1.335). Odpoczynek może zawierać `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`: `[sheet: op="rest" rest="short" dice="2"]` Mistrza Gry (albo jedno polecenie dla całej drużyny) najpierw wydaje tyle z `pool`, rzuca każdą kością (`die` to dowolna wartość albo pole wyliczeniowe zapisane jako "d8") plus `add`, nigdy poniżej 0 na kość, i przywraca tyle do `heals` jako leczenie niemagiczne, zanim odpoczynek zrobi to, co określa. `extra` to jedna dodatkowa kość dla każdego, kto jakąś wyda: członek drużyny, którego `die` ma najwięcej ścianek, rzuca nią dla każdego, plus własny `add`. Song of Rest z 5e i +1 do każdej kości z Pell's Brown Teapot jako statystyka przedmiotu odczytywana przez `add`. Zestaw używający `dice` odpoczynku wymaga Capability API 1.335.

Kości odpoczynku z kilku pul (Capability API 1.337). `"dice"` odpoczynku może być listą, z jednym wpisem na pulę, każdy z własnymi `die`, `add`, `heals` i `extra`: `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`, więc wojownik 1 / czarodziej 1 wydaje kość d10 i kość d6. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` wydaje tylko z tej puli; bez `pool` kości pochodzą z pierwszej wymienionej puli, która jakieś ma, potem z następnej, a zbyt mała łączna liczba jest odrzucana bez wydawania czegokolwiek. Dodatkowa kość (Song of Rest) należy do pierwszego wpisu, który ją ma, jest rzucana raz dla całego wydatku i leczy to, co leczy pierwsza pula, z której wydano kości; pojawia się nawet wtedy, gdy płaci tylko późniejsza pula. W grze kości odpoczynku odczytują, co niesie każda postać, więc liczy się `itemStat` w `add` lub w `add` dodatkowej kości: Pell's Teapot, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. Zestaw z listą w tym miejscu wymaga Capability API 1.337.

Ikony (Capability API 1.338). Wpis katalogu i stan arkusza mogą wskazywać swoją ikonę, `"icon": "ic_poison_cloud"`: kafelek z pakietu ikon gry (pakiet planszy rodzaju `icons`; zobacz packages/server/src/assets/board-packs/README.md). Bez tego Engine szuka nazwy wywiedzionej: stan `ic_cond_<id>`, przedmiot `ic_item_<entry id>` (albo `ic_item_<name>` dla przedmiotu wymyślonego przez Mistrza Gry), każdy inny wpis katalogu `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), z łącznikami zapisanymi jako `_`. Bez żadnej z nich pokazywana jest dzisiejsza litera lub tekst. Zestaw, który wskazuje ikonę, wymaga Capability API 1.338.

Lista akcji legowiska po przerwanej koncentracji (Capability API 1.336). `"brokenNextLair"` może być listą własnych akcji legowiska, każda wymieniona raz, zamiast jednej: `["shelves_lean_north", "shelves_lean_south"]`. Gdy ta koncentracja zostanie przerwana, następną akcją legowiska jest jedna z nich i żadna inna, niezależnie od tego, co wykonało w poprzedniej rundzie, a to, którą, wybiera ten, kto prowadzi stworzenie. Stworzenie prowadzone przez Engine wybiera tę, która dosięgnie najwięcej wrogów; spośród równych waży je tak jak wszystko inne. Po jej wykonaniu wybór znów jest wolny. Zestaw z listą w tym miejscu wymaga Capability API 1.336.

Stan albo przedmiot noszony lub niesiony z `"alerts": 15` zdradza każdego, kto porusza się w ukryciu w tej odległości od posiadacza: nie jest on ukryty przed nikim, a dziennik zapisuje, że zdradził go posiadacz. Wind-Chime z przykładowej gry to przedmiot niesiony z `{"alerts": 15}`. `"stillIn": ["bright"]` stworzenia nie pozwala mu się ruszać, dopóki którekolwiek z jego pól jest w jednym z tych rodzajów światła: w jego menu nie ma wtedy ruchu. Lantern-Shy z przykładowej gry.

Rosnące aury, przytrzymania z limitem, wyrywanie się i trzymanie się przy życiu (Capability API 1.320). `"grows": {"by": 10, "upTo": 40}` aury sięga o `by` dalej na początku każdej tury posiadacza, nie dalej niż `upTo`, które jest większe od jej `distance`; dziennik podaje, jak daleko sięga teraz. Jej `harms` może zawierać `"on": "their-turn"`: obrażenia zadaje się na początku każdej tury każdego, kogo sięga, zamiast wszystkich naraz na początku tury posiadacza. `"lingers": true` zostawia to, co przenosi, na każdym, kogo już nie sięga, do początku jego następnej tury, a aura znów to utrzymuje, jeśli sięgnie go wcześniej. Frost Debt z The Owed to `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

To, co nakłada akcja, może zawierać `"heldAtMost": 2`: dopóki źródło przytrzymuje nim tylu innych, stan nie zostaje nałożony na trzeciego (dziennik zapisuje, że nie został nałożony), jak w Grasps z The Owed. `shakeOff` stanu z `"self": true` pozwala także posiadaczowi zakończyć stan, wydając budżet bez testu: Seed Hopper, `{"budget": "action", "self": true}`, z którego wyrywa się przytrzymany albo sojusznik obok niego. `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` stworzenia sprawia, że zostaje z 1 punktem życia zamiast spaść do 0, `uses` razy na walkę, ale nie przeciw temu, co zabija od razu; z `extraTurn` wykonuje własną turę zaraz po tej, w której to się stało, a po jej zakończeniu kolejność wraca do poprzedniej.

Selektor pokazuje ten blok w jednym wierszu. To, kto odczytuje resztę, zależy od bloku włączonego przez zestaw zasad:

- Z [blokiem `combat`](#combat-a-fight-your-own-rules-resolve) walka odczytuje efekty bojowe. `range`, `area` i `friendlyFire` działają na polu bitwy z pozycjami; `reaction` oznacza wpis odpowiadający na coś, a nie wykonywany w turze, i wskazuje chwilę, na którą czeka (zobacz [Okna](#windows-holding-the-fight-open)); wpis oznaczony zwykłym `true` nie wskazuje żadnej i nie ma go w żadnym menu. `check` dotyczy testów umiejętności opisanych wyżej.
- Tylko z [blokiem `battle`](#battles-lending-the-sheet-to-marinaras-combat) bitwa odczytuje `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` i `cost`, ponieważ własny system walki Marinara ma zastosowanie właśnie dla tych części.

Słownik jest zamknięty: klucz lub wartość spoza powyższej listy jest odrzucana, zamiast być po cichu ignorowana.

`cost` określa też koszt płacony poza bitwą przez polecenie `use` Mistrza Gry, opisane w następnej sekcji.

### Polecenia arkusza: trwały rozwój (Capability API 1.142)

Zestaw może włączyć zmiany trwałej budowy postaci przez `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Podaj tylko identyfikatory pól, które arkusz deklaruje jako liczbowe lub tekstowe (`text` lub `longtext`), najwyżej 24. Wartości logiczne zezwalają odpowiednio na zmianę wszystkich atrybutów, umiejętności lub rzutów obronnych; pominięcie lub false oznacza brak zgody. Pusty zestaw uprawnień, nieznane pole, nieobsługiwany typ pola lub nieznany klucz są odrzucane przy imporcie. `text` to opcjonalna wskazówka o długości najwyżej 400 znaków bezpiecznych dla promptu. Bez `advancement` istniejące polecenia działają jak wcześniej, a każde żądanie `advance` jest odrzucane.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Wskaż dokładnie jeden cel. Pola i atrybuty przyjmują dokładnie jedno z `by` lub `to`; tekst przyjmuje tylko `to`. Nazwy i poziomy są dopasowywane do identyfikatorów lub etykiet bez względu na wielkość liter. Umiejętności i rzuty obronne przyjmują każdy poziom zadeklarowany w `resolution.proficiencyTiers`. Pola liczbowe respektują `integer`, `min` i `max`; atrybuty respektują swoje całkowite granice; tekst respektuje `maxLength`. Nieprawidłowa wartość jest odrzucana z powodem `bad-amount`, który podaje granicę, i nigdy nie jest po cichu przycinana. Wyłączony rozwój, niedozwolone cele, nieznane nazwy i nieznane poziomy także są odrzucane. Przepisany znacznik zawiera `result` i nową wartość w `now`. Pomiń `who` dla gracza albo użyj `who="party"` dla każdej jednoznacznej karty drużyny; częściowe odmowy wskazują, których kart nie dało się rozwinąć.

Engine zapisuje budowę postaci na karcie gry przez ten sam magazyn metadanych co edycja gracza, zachowując wersję arkusza i przeliczając wartości pochodne z nowej budowy. Karty w bibliotece się nie zmieniają. Tak jak przy poleceniach bieżących, alternatywny swipe lub ponownie wygenerowana odpowiedź zaczyna od stanu sprzed zmian wychodzącej odpowiedzi. Każda odpowiedź zapisuje budowę postaci z chwili swojego zakończenia, także odpowiedzi bez rozwoju. Wybranie swipe'a przywraca jego migawkę; usunięcie najnowszej odpowiedzi odsłania poprzednią migawkę. Usunięcie starszej odpowiedzi pozostawia późniejszą migawkę w mocy, dopóki ta późniejsza odpowiedź nie zostanie usunięta. Kontynuacja aktualizuje migawkę tej samej odpowiedzi. Cofnięcie zmienia tylko wartości nadal zgodne z zapisanym wynikiem, więc późniejsze edycje gracza zostają zachowane, a niezwiązane edycje nie przeszkadzają w cofnięciu przyznania XP.

### Polecenie `use`: Mistrz Gry płaci zdefiniowaną przez ciebie cenę

Podczas narracji Mistrz Gry aktualizuje każdą kartę poleceniami `[sheet: ...]`: `spend`, `restore` (`heal` oznacza to samo), `damage`, `temp`, `track`, `condition`, `note` i `rest`. Zestaw zasad dostarczający katalogi otrzymuje jeszcze jedno:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` oznacza to samo co `op="use"`, a `spell=` to samo co `name=`, więc sformułowanie wybrane przez Mistrza Gry działa, choć format nie musi znać słowa "zaklęcie".

Nazwa jest dopasowywana bez uwzględniania wielkości liter do wierszy karty tej postaci pochodzących z jednego z twoich katalogów. Wiersz odpowiada na nazwę pokazaną Mistrzowi Gry (kolumna nazwy `sheetSummary` tej listy, następnie jej `pools.nameColumn`, następnie pierwsza kolumna tekstowa) oraz na `label` źródłowego wpisu, więc gracz nadal ma do niego dostęp po zmianie nazwy wiersza. Nazwa bez dopasowania i nazwa pasująca do dwóch różnych wpisów są odrzucane.

Co zużywa:

- Każdy składnik `mechanics.cost` wpisu. Składnik wskazujący pulę bieżącą pobiera z niej koszt; składnik wskazujący GRUPĘ pul pobiera go z pierwszej puli tej grupy, w kolejności deklaracji, która może go pokryć. Nie przechodzi automatycznie do wyższej puli, ponieważ grupa nie zawsze jest drabiną.
- Dodatkowo jeden punkt z każdej puli w wierszu listy zapisanej przez ten sam wpis, np. licznika użyć zdolności. To drugi wiersz powyższego wpisu `Last Ember`. Licznik o maksimum 0 nie ma użyć do wydania, więc polecenie jest odrzucane, zamiast wykonywać się za darmo.

`pool=` oznacza użycie na wyższym poziomie: ta sama pojedyncza cena, płacona z innej puli tej samej grupy. Jest akceptowane tylko wtedy, gdy koszt ma dokładnie jeden składnik, a wskazana pula należy do grupy tego składnika lub za nią płaci. Wszystko inne jest odrzucane zamiast reinterpretowane.

**Pula płacąca za inną grupę** (Capability API 1.171). `pays` puli bieżącej wskazuje do czterech innych grup, których koszty także może opłacać, na własnym poziomie (swoim `level` albo zgodnie ze swoim miejscem we własnej grupie), i nigdy za koszt wyższego poziomu niż własny. Komórki paktu z 5e płacą za zaklęcia, których koszt podano w komórkach zaklęć, tak jak może to robić wieloklasowy czarnoksiężnik:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Walka oferuje taką pulę obok wyższych pul własnej grupy zaklęcia, a płatność z niej powiększa zaklęcie o tyle kroków, o ile jej poziom przewyższa poziom zaklęcia: komórka paktu 3. poziomu płaci za Magic Missile tak jak komórka 3. poziomu. Użycie, którego własna pula jest pusta, nadal jest oferowane, opłacane tylko z wyższej puli lub z puli, która za nie płaci, więc zaklęcie 1. poziomu rzuca się z komórki 2. poziomu, gdy skończą się komórki 1. poziomu. `targetsPerCostStep` (1.171, od 1 do 10) w `mechanics` wpisu dodaje tyle celów za każdy krok, o jaki je opłacono, najwyżej do 20: Hold Person to `"targetCount": 1, "targetsPerCostStep": 1`.

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

Osobne pliki katalogów trafiają do pakietu: publikowanego przez oficjalny katalog albo pliku pakietu zestawu zasad importowanego samodzielnie (zobacz [Udostępnianie zestawu zasad](#sharing-your-ruleset)). Pakiet wymienia plik w `contributions.assets.paths` obok `ruleset.json` i wymaga Capability API 1.21. Katalog stworzeń, wewnętrzny lub osobny, wymaga Capability API 1.27, a katalog przedmiotów – 1.49. **Zestaw zasad importowany jako pojedynczy plik lub udostępniany przez repozytorium GitHub zawiera katalogi wewnątrz definicji**, więc muszą mieścić się w limicie 512 KB całego pliku zestawu zasad. To wystarcza na kilkaset krótkich wpisów.

Limity to 12 katalogów na zestaw zasad, 2000 wpisów na katalog w obu formach i 2 MB na osobny plik katalogu. Pakiet, którego `ruleset.json` przekracza 256 KB albo którego plik katalogu przekracza 1 MB, wymaga Capability API 1.340, w którym podniesiono oba limity.

### Prowadzony kreator: tworzenie postaci krok po kroku

Arkusz może deklarować `sheet.builder` (Capability API 1.86). Edytor arkusza, w edytorach postaci i person oraz w opcji **Edit sheet** (edytuj arkusz) w grze, otwiera się wtedy na widoku **Guided** (prowadzony) obok pełnego formularza **All fields** (wszystkie pola): kroki u góry, każdy z plakietką liczącą wybory, na które jeszcze czeka, przyciski **Back** (wstecz) i **Next** (dalej), które nigdy nie blokują (gracz może zostawić wybory na później), a obok nich postać w obecnym stanie: to, co zapisały kroki, wartości atrybutów, wartości wskazane przez `gm.sheetSummary` (klasa pancerza, premia biegłości) oraz wyszkolone rzuty obronne i umiejętności.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Do 24 kroków, każdy jako `{ id, label, kind, ... }`; pakiet z więcej niż 16 krokami deklaruje Capability API 1.112:

- `catalog`: wpisy katalogu wierszy, pokazywane jako kafelki z `summary` pod przyciskiem **Info** (informacje). `min` (domyślnie 1) to liczba wyborów wymaganych przez krok, a `max` (domyślnie 1) – największa liczba, jaką przyjmuje; przy `max` 1 nowy wybór zastępuje stary. Oba mogą wynosić do 40; pakiet z którymkolwiek powyżej 20 deklaruje Capability API 1.110. `field` wskazuje pole tekstowe lub wyliczeniowe, do którego zapisywane są etykiety wybranych wpisów (pole wyliczeniowe przyjmuje identyfikator lub etykietę wpisu, zależnie od tego, które jest jedną z jego wartości). `filters` ustala wartości filtrów katalogu, a `within: { step, filter }` oferuje tylko wpisy, których `filter` wskazuje wpis wybrany we wcześniejszym kroku, tak jak podrasa wskazuje swoją rasę; po odznaczeniu rasy jej podrasa przestaje się liczyć. `upTo: { filter, value }` (Capability API 1.87) oferuje tylko wpisy, których liczbowy `filter` wynosi najwyżej `value`, czyli wartość odczytaną z arkusza w obecnym stanie, np. zdolności do poziomu postaci (`{ "filter": "level", "value": { "derived": "level" } }`); wpis bez tego filtra jest oferowany zawsze, a wybór, poniżej którego arkusz od tego czasu spadł, przestaje się liczyć, ale zostaje zachowany. Wybór zmieniający odczytywaną wartość (klasa ustawiająca poziom) jest rozstrzygany w tej samej zmianie, podobnie jak wartość zmieniona w **All fields** (obniżenie tam poziomu od razu odbiera to, co dała zdolność z wyższego poziomu). `countFrom` (Capability API 1.90) to wartość odczytywana z arkusza w ten sam sposób, która zastępuje zarówno `min`, jak i `max`: ile wpisów krok wymaga i ile najwyżej przyjmuje, zaokrąglone w dół i nigdy powyżej `max`, np. zaklęcia znane klasie na poziomie postaci (`{ "derived": "spells_known" }`). Wybory ponad tę liczbę są zachowywane, ale nie liczą się, dopóki liczba znów nie wzrośnie. Krok katalogu może też zawierać `stamp` (Capability API 1.108), od 1 do 4 wartości kolumn zapisywanych w każdym dodawanym wierszu, np. `"stamp": { "class": "wizard" }` w kroku zaklęć czarodzieja i `"stamp": { "class": "cleric" }` w kroku kleryka. Każdy klucz musi być kolumną w każdej liście zasilanej przez katalog; wartości to ciągi znaków, liczby lub wartości logiczne. Stempel zastępuje wartość początkową katalogu. Istniejące wiersze i późniejsze edycje w **All fields** pozostają w gestii gracza. Z Capability API 1.130 wartość stempla może być zamiast tego obiektem, którego `fromWithin` to `"id"`, `"label"` lub identyfikator filtra zadeklarowany przez katalog nadrzędny: odczytuje pierwszy pasujący wpis nadrzędny w kolejności wyboru, zapisuje ciąg znaków lub liczbę raz, przy dodaniu wiersza, i zostawia tę kolumnę bez stempla, jeśli żaden wpis nadrzędny nie pasuje albo jego filtra brakuje lub jest on tablicą.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: krótki formularz nazwanych pól. Jego plakietka liczy pola wciąż puste, z wyjątkiem wymienionych w `optional` (podklasa wybierana na późniejszym poziomie). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) pokazuje i liczy nazwane pole kroku tylko wtedy, gdy jego odwołanie do wartości daje na arkuszu w obecnym stanie wynik powyżej 0; ukryte pola zachowują wartości. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) utrzymuje co najmniej dwa pola liczbowe kroku w łącznym maksimum (liczba całkowita od 1 do 1000), obniżając maksimum każdego pola o bieżące wartości pozostałych, ale nie poniżej jego własnego minimum, i dodaje jeden do plakietki, jeśli suma przekracza limit; **Next** nadal działa.
- `abilities`: wartości atrybutów (`abilities`, po pominięciu wszystkie), ustawiane dowolną z metod `methods`: `pointBuy` (`budget` nie większy niż koszt podniesienia każdej wartości do maksimum oraz koszt każdej wartości, od najniższej, od której zaczyna każda wartość, w górę po jednej; wartość wpisana ręcznie zaczyna od najbliższej wartości w tabeli), `standardArray` (po jednej wartości dla każdego atrybutu), `roll` (`count` kości o `sides` ściankach z zachowaniem `keep` najwyższych, rzucanych własnymi kośćmi Engine, jeden rzut na każdy atrybut, a potem rozdawanych tak jak zestaw standardowy) oraz `manual`. `manual: true` zachowuje istniejące granice wartości; `manual: { min, max }` (Capability API 1.110) ogranicza wpisane wartości bazowe przed przyznaniami do tych całkowitych granic, przy czym min wynosi co najmniej -100, max najwyżej 1000, a min nie przekracza max, podczas gdy własne granice każdego atrybutu nadal ograniczają sumę. `default` (1.87) to metoda, od której zaczyna postać tworzona przez kreator od pustego arkusza (i którą zachowuje, nawet jeśli domyślna metoda zestawu później się zmieni), więc początkujący widzi np. kupowanie punktów, dopóki nie wybierze innej metody; opisana postać nigdy jej nie przyjmuje, a jej wartości pozostają bez zmian, dopóki gracz po opisaniu nie wybierze metody; **Manual entry** (wpis ręczny) pozostaje edycją wpisywaną w granicach, a **All fields** jest zawsze dostępne. To, co dodają wybory, dolicza się na wierzchu: krok pokazuje wartość bazową, premię, sumę i modyfikator. Najwyżej jeden krok atrybutów.
- `allocate` (Capability API 1.152): etapowe rozdzielanie kropek z przydziałami według priorytetów lub budżetami grup, opisane niżej.
- `trained`: wybory umiejętności i rzutów obronnych, które oferują dokonane wybory, a także własne `choose: [{ "what": "skills", "count": 2, "from": [...] }]` kroku (dowolne z nich, gdy pominięto `from`).
- `startingGear`: wymienia początkowy sprzęt zestawu. Sprzęt otrzymuje się w grze, z ekwipunku, jak zawsze.
- `choices` (Capability API 1.91): `catalog` wskazuje katalog wierszy, a krok jest miejscem, w którym wybiera się wpisy przyznawane z niego przez wybory (`grants.entries`, niżej), np. dowolnie wybrany język.

Krok początkowego sprzętu może zawierać `"strict": true` (Capability API 1.109). W trybie wyłącznie dozwolonych opcji, który jest domyślny, oferuje tylko sprzęt, którego `fits` daje prawdę na arkuszu w obecnym stanie, bez stanu bieżącego, oraz sprzęt bez `fits`; nie ma listy Other gear. Dla 5e umieść `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` w komplecie Wizard i odpowiednie pole poziomu klasy w każdym innym komplecie klasy; pomiń `fits` w komplecie Acolyte, aby pasował do każdego. Tryb swobodnej edycji znów oferuje każdy komplet. Selektor ekwipunku czyści wybór, który przestaje pasować po zmianie klasy lub wyjściu ze swobodnej edycji, i podaje powód; sprawdza też dopasowanie przed pobraniem sprzętu. Bez pasującego sprzętu krok pokazuje stan pusty, a Next pozostaje dostępne. Kroki bez `strict` nadal oferują każdy komplet. Tryb jest lokalny dla każdego ekranu i nie jest zapisywany razem z zapisaną budową postaci ani wysyłany na serwer.

To, co daje wybór, to `grants` jego wpisu, odczytywane wyłącznie przez kreator:

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` dodaje do wartości atrybutów; `abilities.choose` pozwala graczowi wybrać `count` atrybutów (nigdy jednego dwa razy ani żadnego z `except`), które otrzymują po `amount`. Z `"repeat": true` (Capability API 1.93) jeden atrybut można wybrać więcej niż raz, za każdym razem z `amount`, więc `{ "count": 2, "amount": 1, "repeat": true }` to +2 do jednego atrybutu lub +1 do dwóch ze zwiększenia wartości atrybutu; krok pokazuje minus obok atrybutu, aby cofnąć jeden wybór. Tak czy inaczej żadna wartość nie przekracza swojego `max`. `upTo` (Capability API 1.96) ogranicza, do jakiej wartości sam wybór może podnieść atrybut, po uwzględnieniu wszystkich innych przyznań: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` to zwiększenie z SRD, które "nie może podnieść wartości atrybutu powyżej 20"; krok wyłącza atrybut, który osiągnął tę wartość. Wybór jest pokazywany w kroku atrybutów albo tam, gdzie wybrano wpis, jeśli takiego kroku nie ma.
- `trained` szkoli umiejętności i rzuty obronne oraz oferuje wybory, pokazywane w pierwszym kroku wyszkolenia albo tam, gdzie wybrano wpis. Są one szkolone do `tier` przyznania, w przeciwnym razie do `tier` kreatora, a w przeciwnym razie do pierwszego poziomu powyżej braku wyszkolenia, jaki arkusz oferuje dla umiejętności lub rzutów obronnych. Wybór nigdy nie oferuje tego, co wybory już szkolą do jego poziomu lub wyżej, bezpośrednio lub przez wcześniejszy wybór (Capability API 1.104): pochodzenie szkolące Insight zostawia wybór umiejętności klasy innym umiejętnościom, jak wymaga SRD. Wybór zapisany, zanim go w ten sposób zajęto, nie liczy się, więc krok prosi o inny, a wybór, który nie ma już nic do zaoferowania, nie jest pokazywany. Wybór może zawierać `"held": "<tier>"` (Capability API 1.105): oferuje tylko to, co wybory szkolą do tego poziomu lub wyżej, albo to, co utrzymuje na nim wybór poniżej jego własnego poziomu, tak jak Expertise z 5e to dwie umiejętności, w których masz biegłość: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` jest niższy niż poziom, do którego szkoli wybór.
- `sets` zapisuje wartości pól: kość wytrzymałości klasy, jej atrybut rzucania zaklęć.
- Wpis katalogu może określać, kiedy oferuje go krok kreatora: `offeredWhen` (Capability API 1.99) to wartość odczytywana z arkusza w obecnym stanie, a wpis jest oferowany tylko wtedy, gdy daje ona wynik powyżej 0, tak jak 5e oferuje drugą klasę tylko wtedy, gdy spełnione są wymagania wieloklasowości (wartość pochodna dla każdej klasy). Wybór, który później daje 0, przestaje się liczyć i zostaje zachowany, tak jak przy `upTo`. Wpis, którego własny wybór zmienia odczyt jego `offeredWhen` (podnoszony atrybut, ustawiane pole, szkolona umiejętność, zapisywana lista, bezpośrednio lub przez wartość pochodną), jest odrzucany, bo oferowałby sam siebie, cofał się i oferował ponownie. Wpis z grupą `exclusive` jest odczytywany na arkuszu bez wszystkich wyborów, które krok zapisał w tej grupie (Capability API 1.100), bo jego wybranie je usuwa: atut wybrany zamiast zwiększenia wartości atrybutu i wymagający Strength 13 nie jest oferowany na podstawie Strength, którą dało to zwiększenie. Wybór przyznawany przez wpis (`grants.entries.choose`) w ten sam sposób ogranicza swoje opcje do ich `offeredWhen` (Capability API 1.106). Selektor katalogu w **All fields** jak zawsze oferuje każdy wpis.
- Wpis katalogu może wskazywać grupę `exclusive` (Capability API 1.94): krok kreatora zachowuje jeden wybór z każdej grupy, więc wybranie jednego usuwa inny wybór kroku z tej grupy i liczy się tylko najnowszy. Atut wybrany zamiast zwiększenia wartości atrybutu dzieli z nim grupę: `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) oferuje do wyboru wpisy innego katalogu wierszy: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, najwyżej sześć wyborów. `filters` ustala wartości filtrów tego katalogu, a `ids` wymienia jedyne oferowane wpisy (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Wybiera się je w kroku `choices` kreatora dla tego katalogu (przyznanie wskazujące katalog bez takiego kroku jest odrzucane), oferowane są tylko wpisy zapisujące wiersze, a ich wiersze trafiają do arkusza, przy czym wpis wybrany dla jednego przyznania nie jest oferowany innemu. Ich własne przyznania nie są stosowane.
- Wybór zapisuje też jednorazowo `rows` wpisu. Wpis może mieć `grants` i w ogóle nie mieć `rows` (klasa, której zdolności pochodzą z innego katalogu), a katalog, którego wpisy jedynie przyznają, nie potrzebuje `feeds`; selektor katalogu nigdy nie oferuje takich wpisów.

Odznaczenie odbiera to, co dał wybór, i tylko to: jego zwiększenia (w takim zakresie, w jakim granice wartości pozwoliły na wzrost), wyszkolenie, wartości pól i wiersze. To, co arkusz już miał od samego gracza (umiejętność wyszkolona ręcznie, wiersz dodany z selektora katalogu), pozostaje jego, a edycja w **All fields** pozostaje, dopóki nie zmieni się odpowiedź kreatora dla tej wartości. Wpis wybrany w dwóch krokach z jednego katalogu przyznaje raz, a wpis ukryty przez warstwy gry nadal liczy się za to, co dał. Pole ustawiane przez wybór (`sets`) jest zapisywane tylko wtedy, gdy jest jeszcze puste lub kreator już za nie odpowiada, więc poziom wpisany ręcznie nigdy nie zostaje nadpisany; wartość, za którą odpowiada kreator, a którą gracz zmienia w jego kroku pól, pozostaje wartością kreatora i znika, gdy późniejszy wybór przestaje jej wymagać. Wybory gracza są przechowywane obok arkusza, więc krok można później ponownie otworzyć.

**Etapowe rozdzielanie kropek (Capability API 1.152).** Krok `allocate` kupuje jedną kropkę za punkt, z własnym budżetem i limitami przy tworzeniu postaci. Nie zmienia metody ani zapisanych odpowiedzi pojedynczego kroku `abilities`. Użyj osobnych kroków dla atrybutów, cnót (Virtues) i późniejszych darmowych punktów:

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

Grup jest od 1 do 12, każda ze stałym `id`, `label` i od 1 do 120 celów. Cele nie mogą się powtarzać w obrębie całego kroku. Cel wskazuje dokładnie jedno istniejące `{ ability }`, liczbowe `{ field }`, `{ skill }`, `{ save }` lub `{ bonus }`; premia to liczbowy wpis `build.bonuses` dla istniejącej umiejętności lub rzutu obronnego. Grupy używają dokładnie jednego trybu budżetu: `priorities` ma jeden nieujemny całkowity przydział na grupę (duplikaty są dozwolone) albo **każda** grupa deklaruje `budget: Ref`. Miejsca priorytetów przypisuje się jawnie, a przypisanie zajętego miejsca zamienia grupy. Kolejność tablicy wyznacza priorytety: główny, drugorzędny, trzeciorzędny, a dalej numerowane; umieść większe przydziały na początku, jeśli te nazwy mają odpowiadać wielkości. Budżety wynoszą najwyżej 1 200 000 punktów.

`base` jest opcjonalne; `min` i `max` są wymagane. Każde przyjmuje liczbę całkowitą lub niebieżące `Ref`, np. `{ "derived": "archetype_floor" }`. Wartości muszą dawać liczby całkowite od 0 do 10 000 i mieścić się w granicach przechowywania celu lub w jego mapie poziomów. Pierwsza wartość bazowa zastępuje domyślną wartość pustego celu, zachowując istniejące wartości z metody i przyznania; późniejsza wartość bazowa jest dolną granicą dla wcześniejszych etapów. Bez wartości bazowej etap zaczyna od istniejącej wartości. Równe min i max ustalają wartość przy tworzeniu postaci: `base: 0, min: 0, max: 0` wyraża stały Appearance. Minima nie kupują kropek automatycznie. Budżety i granice mogą używać istniejących operatorów wartości pochodnych, ale nie mogą odczytywać celów zmienianych przez ten lub późniejszy krok, nawet przez wartości pochodne. Warunki darmowych przyznań także nie mogą odczytywać wartości w grupie rozdzielania, którą mogą zmienić, łącznie z połączonymi grupami na innych etapach. Ceny z formuł nie są obsługiwane: każdy opłacony przyrost kosztuje jeden punkt. Nierozstrzygnięte lub nieprawidłowe źródło jest pokazywane jako **not configured** (nieskonfigurowane).

Cele umiejętności i rzutów obronnych wymagają `sheet.builder.ratingTiers`, osobno dla każdego celu:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

Indeks tablicy to liczbowa wartość. Mapy mają od 1 do 12 istniejących, rosnących identyfikatorów oferowanych poziomów, zaczynając od poziomu braku wyszkolenia zestawu; nigdy nie są wywodzone z premii poziomów. Różne cele mogą używać różnych map. Umieść cele z różnymi limitami przy tworzeniu postaci w osobnych grupach.

Katalogowe `grants.ratings` dają darmowe kropki, przed **wszystkimi** płatnymi etapami:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Każde przyznanie ma albo dodatnie `add`, albo nieujemne `set`, nigdy oba. Wszystkie przyznania `set` są dolnymi granicami: wygrywa najwyższe, a potem sumują się wszystkie dodatki, zatrzymując się na limicie przechowywania celu. Dwa darmowe dodatki rangi dają więc rangę drugą bez obciążania płatnego budżetu. Istniejące wyszkolenie i przyznania pól lub atrybutów składają się przed tymi przyznaniami wartości. Wybory wpisów nadal tylko zapisują wiersze; nigdy nie stosują rekurencyjnie przyznań wybranego wpisu.

Interfejs pokazuje wartości bazowe lub wcześniejsze, darmowe, kupione i łączne, zakres przy tworzeniu postaci i pozostały budżet. Plus jest wyłączony przy limicie, bez budżetu albo gdy nieprawidłowe zakupy lub ręczne nadpisania wymagają uwagi. Niewydany budżet, niemożliwe minima i nadpisania dostają plakietki; Back i Next pozostają dostępne. Ponowne przypisanie priorytetu zachowuje zapisane przyrosty grupy. Grupa z przekroczonym budżetem staje się w całości nieaktywna; zakup powyżej limitu celu staje się nieaktywny dla tego celu. Zmniejsz lub wyczyść te odpowiedzi, aby je naprawić, albo przywróć wcześniejszy przydział, aby je reaktywować. Późniejsze etapy mogą przekraczać wcześniejsze limity tworzenia postaci. **All fields** pozostaje swobodną edycją, a nadpisania są pokazywane jawnie zamiast przycinane do reguł tworzenia.

Zapisane `builder.allocations[stepId]` przechowuje indeksy miejsc priorytetów według identyfikatora grupy, płatne przyrosty `bought` i opcjonalne `notes` według stałych kluczy celów `kind/id` (na przykład `ability/strength`). `annotations: true` oferuje do 1000 znaków na cel na objaśnienia dziedzictwa lub specjalizacje; kreator nie ocenia tego tekstu. Zastosowane przyrosty należą osobno do każdego etapu. Ponowne otwarcie nigdy nie przyznaje ponownie przyznań ani nie uzupełnia zasobów, a opisanie istniejącego arkusza zapisuje wybory bez jego przepisywania, także po zakończeniu opisywania. Odznaczenie przelicza darmowe wartości i płatne etapy, zachowując ręczne różnice.

**Wspólne budżety i wyceniane zakupy (Capability API 1.153).** Zadeklaruj do 12 pul tworzenia postaci w `sheet.builder.pools`. Kilka kroków `spend` może używać jednej puli; osobne pule utrzymują niezależność punktów zawodu i zainteresowań osobistych. Budżety to niebieżące odwołania do wartości, łącznie z istniejącymi obliczeniami `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` i `listSum`. Ich rozstrzygnięta wartość musi być skończona i mieścić się między 0 a 100 000. Brakujące źródło jest oznaczane jako "not configured".

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Każdy krok ma do 120 ofert ze stałymi `id` i `label`. Cele używają tej samej umowy co etapy rozdzielania: dokładnie jedno `ability`, liczbowe `field`, zmapowane `skill`/`save` albo `bonus`. Zakupy wierszy list są zarezerwowane dla funkcji tożsamości wierszy (F4); to API nie identyfikuje wierszy według pozycji w tablicy. Granice muszą mieścić się w granicach przechowywania celu. Wartości początkowe i darmowe przyznania są zachowywane i nigdy ponownie nie obciążane: Background z dwiema darmowymi kropkami i pięcioma płatnymi ma siedem.

Koszt to dokładnie jedno z:

- `{ "flat": 1 }`: jeden punkt za każdy przyrost wartości.
- `{ "perRank": 5 }`: pięciokrotność następnej rangi, więc podniesienie z 2 do 3 kosztuje 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: skumulowane ceny przy rosnących wartościach. Następny zakup przechodzi do sąsiedniej wartości i kosztuje różnicę (tutaj 5, a potem 7). Wartości ułamkowe wymagają niecałkowitego pola liczbowego; tabele obejmują obie granice oferty.

Opcjonalne `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` zawiera najwyżej 12 wpisów. Wygrywa pierwszy dodatni warunek. Warunki odczytują arkusz sprzed zakupów; brak dopasowania oznacza cenę bazową. Budżety i warunki nie mogą odczytywać kupowanych celów, także przez wartości pochodne, ani zależeć od późniejszych wyborów. Darmowe przyznania i etapy rozdzielania są stosowane przed wycenianymi zakupami.

Ceny są dodatnie, z wyjątkiem jawnie zadeklarowanych kredytów. Dla wady, której wartość rośnie, użyj `"credit": true, "cost": { "flat": -1 }`. Dla obniżenia od zadeklarowanej wartości wyjściowej użyj `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`: zakup obniża 10 do 9 i zapisuje kredyt jednego punktu. Wartość początkowa musi odpowiadać wartości wyjściowej. Cel z kredytem ma w całym kreatorze tylko jedną ofertę, co zapobiega cyklom kupowania i kredytu.

Pule domyślnie nie dopuszczają kredytu. Ustaw `creditLimit` na maksymalny łączny kredyt i opcjonalnie dodaj do 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Filtry wskazują `tags: ["flaw"]` oferty, więc kredyty za wady (flaw) i słabości (disadvantage) mogą mieć osobne limity. Limity liczą kredyty brutto, niezależnie od dodatnich wydatków. Odrębne liczby dziwactw pozostają ograniczeniami wyborów lub wierszy.

**Zliczane wiersze i pasujące wiersze (Capability API 1.205).** `listSum` może zawierać `where: { "column", "equals" }`, aby odczytywać tylko wiersze, których komórka jest równa wartości (pusta komórka ma wartość domyślną kolumny), oraz `count: true` zamiast `column`, aby liczyć wiersze zamiast sumować kolumnę. Piramida talentów z Genesys to dwie pochodne liczby i reguła tworzenia postaci:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

z regułą, której `value` odczytuje `tier2`, a `max` odczytuje liczbę z poziomu 1 pomniejszoną o jeden.

**Ceny wierszy obliczane dla każdego wiersza (Capability API 1.206).** Obiektowy `cost` kroku wierszy może mnożyć swoją `column` przez `times` i dodawać `add`, więc `{ "column": "tier", "times": 5 }` wycenia talent Genesys na 5 XP za poziom; samo `add` to stała cena zapisana jako obiekt. `overrides` (do 4) podaje cenę używaną zamiast tego, gdy wartość pochodna wskazana przez prefiks i własną komórkę wiersza daje na arkuszu wynik powyżej 0: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` wycenia Charm z Exalted na 4 Bonus Points, gdy `affinity_<its Ability>` jest powyżej 0. Komórka wyliczeniowa musi mieć wartość pochodną dla każdej wartości, jaką może przyjąć.

**Oferty bez ceny (Capability API 1.207).** `cost` oferty wydatku (lub nadpisania) może mieć postać `{ "unpriced": true }`, dopóki źródło nie podało ceny: oferta jest pokazywana z notatką, blokuje pulę, nic nie kosztując, i nigdy nie zostaje kupiona. Zakup zapisany z ceną, która później przestaje być określona, staje się nieaktywny i zostaje zachowany do naprawy.

**Więcej pól (Capability API 1.208).** Arkusz może deklarować do 240 pól; przed 1.208 limit wynosi 160. Rangi umiejętności, rangi kategorii, potencjały i sumy z Rolemastera wymagają tego miejsca.

**Rzuty zapisywane do atrybutu (Capability API 1.209).** Rzut kroku `roll` może wskazywać `ability` zamiast `field` (dokładnie jedno z nich). Wynik jest utrzymywany we własnych granicach atrybutu. Z `gain` rzuca się test przeciw wartości i tylko wynik wyższy od niej dodaje przyrost, który kreator zachowuje następnie jako zwiększenie: ponowne rzucenie lub kupienie wartości zachowuje poprawę na wierzchu. Bez `gain` wynik jest zapisywany jak wartość wpisana ręcznie i zachowywany, dopóki nie zmieni się własna odpowiedź kreatora dla tej wartości. Obliczanego atrybutu nie można rzucać, a każdy atrybut rzuca się najwyżej raz na krok.

**Obliczane kolumny list (Capability API 1.210).** Kolumna liczbowa może wskazywać `sum`: do sześciu innych kolumn liczbowych tego samego wiersza, sumowanych (pusta komórka ma wartość domyślną kolumny) i utrzymywanych w zakresie `min` i `max` kolumny. Komórka jest pokazywana tylko do odczytu, wypełniana przy każdym odczycie zapisanego arkusza i odczytywana przez sumy, testy wierszy i wszystko inne jak komórka wpisana ręcznie. Obliczanej kolumny się nie rzuca i nigdy nie sumuje ona innej obliczanej kolumny. Wartość specjalizacji w CoC to `"sum": ["base", "occupation", "interest"]`.

**Częściowe zwiększenia wartości (Capability API 1.211).** `abilities.choose` przyznania może wskazywać `partialFrom`. Wartość, która w chwili wyboru jest już na tym progu lub wyżej, otrzymuje częściowe zwiększenie, a dwa częściowe dają `amount` raz. Wybory liczą się w kolejności, w jakiej dokonuje ich kreator, po każdym pełnym zwiększeniu, więc późniejsze wzmocnienia z Pathfinder 2e mają postać `"amount": 1, "partialFrom": 4`: modyfikator +4 potrzebuje dwóch wzmocnień, aby osiągnąć +5. Łączy się z `upTo`.

**Testy wierszy w postawie (Capability API 1.212).** Wpis `checks[]` listy może wskazywać `stance`, jedną z `resolution.stances` puli kości. Test każdego wiersza jest wtedy w tej postawie, tak jak umiejętność wymieniona przez postawę: zajęcia ze Stewpot liczą kości na sposób STILLNESS. Przypomnienie dla Mistrza Gry wymienia wiersze razem z umiejętnościami postawy.

**Specjalizacje atrybutów (Capability API 1.213).** `contextual` listy może ustawiać `"abilities": true`. Jej komórka `skill` może wtedy wskazywać atrybut (po identyfikatorze, etykiecie lub skrócie), a nie tylko umiejętność, a wiersz dotyczy każdego testu rzucanego tym atrybutem: zwykłego testu atrybutu, umiejętności, której to jest własny atrybut, lub umiejętności podmienionej na niego przez `with=`. Specjalizacja atrybutu z World of Darkness, "Strength: lifting", to wiersz nazwany "lifting", którego komórka umiejętności zawiera "Strength".

**Wyłączone anulowanie (Capability API 1.214).** Kontekstowy `check` (w `contextual` listy lub w `mechanics.contextual` wpisu) może ustawiać `"cancel": false`. W rzucie, do którego jest stosowany, wyniki równe `resolution.cancel.upTo` lub niższe nie odbierają sukcesów; krytyczna porażka nadal je odczytuje. Zestaw musi mieć `resolution.cancel`, aby było co wyłączyć.

**Przedmioty dostępne bez noszenia (Capability API 1.215).** `grants.itemAccess` wpisu katalogu wymienia do 48 przedmiotów zestawu (`<catalog>/<entry>`, nigdy usługi). Wybranie wpisu w prowadzonym kreatorze udostępnia je postaci: arkusz i blok arkusza dla Mistrza Gry wymieniają je jako nienoszone, a nic nie trafia do torby. Mistrz Gry dodaje przedmiot do ekwipunku, gdy zostanie wzięty, tak jak postać w Blades deklaruje obciążenie na początku skoku.

**Kropki wierszy przy tworzeniu postaci (Capability API 1.216).** Grupa `allocate` może wskazywać `rows`, do czterech par `{list, column}`: kropki w tej kolumnie liczbowej we wszystkich wierszach listy liczą się do budżetu grupy obok jej celów. Wiersze edytuje się na liście; grupa z większą liczbą kropek w wierszach niż jej budżet czeka na gracza. Nadpisanie kosztu kroku wierszy może podawać `times`, stawkę za jednostkę dla kolumny kosztu, zamiast stałego `cost`. Wiersze Craft z Exalted liczą "dots" do 28 kropek Ability, a kropki "bought" wyceniają na `times: 2`, nadpisane na `times: 1` tam, gdzie ustawiono `affinity_<ability>`; obliczana kolumna wartości (1.210) sumuje obie.

**Najlepsza wartość (Capability API 1.217).** Kontekstowy `check` może ustawiać `"best": true`: test umiejętności, do którego jest stosowany, rzuca najlepszą wartość umiejętności postaci, jeśli jest wyższa niż wymagana. Zestaw `dice-highest` może używać kontekstowego testu, który robi tylko to; każdy inny efekt testu nadal wymaga puli kości. Rook's Gambit z Blades to wiersz specjalnej zdolności z `"check": {"best": true}`, stosowany po nazwie.

**Koszty zaznaczające tor (Capability API 1.218).** Kontekstowy wpis `cost` może mieć postać `{"track": "<id>", "by": N}`, a nie tylko `{"pool", "amount"}`: zastosowanie wiersza lub wpisu przesuwa ten zwykły tor bieżący o N, na ile pozwalają jego granice (toru ran nie zaznacza się w ten sposób). `contextual` listy także może zawierać `cost`. Rook's Gambit z Blades to wiersz z `"check": {"best": true}` i `"cost": [{"track": "stress", "by": 2}]`. Nazwy stosowane przez `apply=` traktują tak samo apostrofy i cudzysłowy zakrzywione i proste.

**Pożyczone katalogi (Capability API 1.220).** Katalog może pożyczyć katalog innego zainstalowanego zestawu zamiast zawierać własny: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. Zestaw użyczający jest odnajdywany po identyfikatorze, samym lub w przestrzeni nazw społeczności, a jego wpisy są odczytywane względem zestawu pożyczającego, więc wpis wskazujący coś, czego pożyczający nie deklaruje (stan, poziom zagrożenia, zmysł), jest pomijany i odnotowywany, a reszta przechodzi. `entries` obok `from` dodają się do pożyczonych lub zastępują wpis o tym samym identyfikatorze; są sprawdzane przy odczycie zestawu, więc nagłówek wskazuje wszelkie `filters`, które zawierają (nagłówek bez nich przejmuje filtry użyczającego). Pożyczone stworzenie zapisane jako arkusz używa identyfikatorów użyczającego; `from.sheet` określa, jak odczytuje się je u pożyczającego: `fields` mapuje pole na inny identyfikator (albo `null`, aby je pominąć), `values` mapuje wartości pola, a `tiers` mapuje poziomy biegłości (stworzenia oraz te, które przyznaje lub których wymaga dowolny wpis), jak w `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Każdy pożyczony wpis, łącznie z przedmiotami, może przyjąć jeszcze dwa klucze: `refs` odczytuje wartość pochodną użyczającego jako jedną z wartości pożyczającego (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), a `slots` umieszcza miejsce przedmiotu pod nazwą pożyczającego (`"slots": { "body": "armor" }`). Katalog nie może pożyczać z własnego zestawu ani z katalogu, który sam pożycza. Grafika pożyczonego stworzenia jest dopasowywana tak jak grafika użyczającego (`5e-2014/creatures/<id>` w pakiecie stworzeń). Odwołania do pożyczonego katalogu, np. zaklęcia stworzenia, są sprawdzane przy odczycie katalogu, a nie zestawu.

**Dłuższe listy rozwoju (Capability API 1.219).** `sheet.advancement.fields` przyjmuje do 64 pól (wcześniej 24), więc gra, w której poziom podnosi wiele pól, np. komórki dla każdego poziomu zaklęć i listy biegłości, może pozwolić Mistrzowi Gry podnieść je wszystkie. Lista z więcej niż 24 polami wymaga 1.219.

**Zakupy dwukierunkowe, posiadane i wymieniane (Capability API 1.164).** `"direction": "both"` pozwala jednej ofercie podnosić i obniżać swoją wartość od punktu startowego (jej `baseline`, jeśli zadeklarowano, musi odpowiadać arkuszowi): każdy krok w górę kosztuje cenę z krzywej, a każdy krok w dół poniżej startu zwraca ją jako kredyt, w granicach `creditLimit` i limitów puli. Rejestr działa zawsze tylko w jedną stronę, więc obniżenie kupionej wartości cofa ostatni zakup po cenie, jaką zapłacono, a podniesienie obniżonej spłaca jej kredyt; kupowanie i obniżanie nigdy nie tworzy kredytu. Taki cel ma w całym kreatorze jedną ofertę. ST z GURPS to `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14, "cost": { "flat": 10 } }`; koszt z tabeli wycenia kroki ułamkowe, np. Basic Speed. `"direction": "increase"` i `"decrease"` jawnie oznaczają ofertę jednokierunkową (`"decrease"` to opisane wyżej obniżenie, z wartością wyjściową i kredytem).

`"effect": "ownership"` wycenia ofertę na jej własnej drabinie, od jej `baseline` (lub `min`) w górę, a arkusz zachowuje wyższą z własnej wartości i kupionego poziomu: jednopunktowa znajomość (familiarity) z GURPS jest opłacana i wymieniana, nawet gdy wartość domyślna jest już lepsza, a jej zwrot nic arkusza nie kosztuje.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` czyni ofertę zamkniętą wymianą przy tworzeniu postaci: każdy zakup obniża `from` o `units` i podnosi cel o `gain` (domyślnie 1), nigdy nie obniżając `from` poniżej `floor` ani nie podnosząc celu powyżej `max`. Nic nie kosztuje puli, więc pomija `cost`. Wymienionych punktów nie wymienia się dalej: gdy wymiana podniosła wartość, żadna inna wymiana jej nie obniża, a gdy jedna ją obniżyła, żadna inna jej nie podnosi. Wymiany niedostępne dla klasy (`when`) mogą wskazywać te same wartości w odwrotną stronę. Zwrot przywraca obie wartości. Wymiana głównego wymagania z OSE to jedna oferta na każdą obniżaną wartość:

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

Kreator przechowuje płatne zmiany ze znakiem i ich pierwotne ceny pod stałymi identyfikatorami kroków i ofert, z najwyżej 1000 wierszami zakupów na ofertę. Zwrot usuwa ostatni wiersz i dokładnie odwraca jego wkład i zapisaną cenę, łącznie z usunięciem kredytu. Nigdy nie zwraca darmowej wartości. Nie wydaje się bieżącego XP, ekwipunku, waluty ani zasobów drużyny.

Zmiana profesji, darmowych przyznań lub źródeł budżetu zachowuje rejestr. Nieprawidłowe zakupy są nieaktywne; pula pokazuje pierwotne wydatki, ujemną liczbę pozostałych punktów przy przekroczeniu i proponowaną nową cenę. Wspólne cele zawieszają też zależne zakupy w innych pulach. **Reprice saved purchases** (przelicz ceny zapisanych zakupów) jawnie przyjmuje dozwoloną nową cenę dla puli; w przeciwnym razie zwróć wiersze zakupów, aby ją naprawić. Żaden zakup nie jest po cichu usuwany ani sprzedawany. Niewydane punkty mają charakter informacyjny. Back i Next pozostają dostępne, a **All fields** zachowuje widoczne ręczne nadpisania w granicach schematu. Opisanie istniejącej postaci i ponowne otwarcie zapisanych wyborów nigdy nie przyznaje kropek ponownie.

**Nazwane wiersze (Capability API 1.154).** Krok `rows` pozwala graczowi podczas tworzenia postaci dodawać, edytować i usuwać własne wiersze na jednej z list arkusza: sługi, kontakty, rytuały i ich składniki albo cokolwiek innego, czego nie wymienia katalog.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` to podzbiór kolumn listy edytowanych przez krok (po pominięciu wszystkie). `required` wskazuje kolumny, które wiersz musi wypełnić, aby się liczyć. Plakietka liczy całe wiersze wciąż brakujące do `min` (od 0 do 20) oraz każdy wiersz z pustą wymaganą komórką, więc w połowie zapisany składnik pozostaje nierozstrzygnięty. `max` blokuje **Add a row** (dodaj wiersz) i nigdy nie przekracza `maxItems` listy. Nowy wiersz zaczyna od własnych wartości domyślnych kolumn, a potem od `defaults`, które muszą pasować do każdej kolumny.

Krok edytuje listę tam, gdzie znajduje się każdy wiersz, więc dwóch sług o tym samym imieniu to nadal dwa wiersze, a usunięcie jednego zachowuje drugi. Wiersze zapisane przez wybór z katalogu są pokazywane tylko do odczytu z notatką "Added by a pick" i pojawiają się oraz znikają razem z wyborem. **All fields** edytuje każdy wiersz jak wcześniej.

**Oferty warunkowe, granice odczytywane z arkusza i reguły tworzenia postaci (Capability API 1.155).** Oferta wydatku może też zawierać:

- `when: Ref`: oferta jest dostępna tylko wtedy, gdy wartość daje na arkuszu sprzed zakupów wynik powyżej 0, np. własne umiejętności zawodu albo Background, który może wziąć plemię. Oferta nigdy niekupiona zostawia pulę bez zmian; zapisane zakupy w ofercie, której postać nie może już wziąć, zostają, nieaktywne, do naprawy.
- `minFrom: Ref` i `maxFrom: Ref`: dolna i górna granica odczytywana z arkusza, utrzymywana w zakresie `min` i `max`. Credit Rating przyjmuje zakres swojego zawodu; Dodge zatrzymuje się na DEX. Wartość poniżej dolnej granicy jest kupowana do niej jednym zakupem.
- `allowedRatings: number[]`: jedyne wartości, na których może kończyć się zakup, np. Merit sprzedawany po 1, 3 lub 5 kropek. Każdy zakup przechodzi od razu do następnej dozwolonej wartości po cenie z krzywej.

Tak jak budżety i nadpisania, nie mogą one odczytywać kupowanego celu. Wybór wyszkolenia z `onDuplicate: "replace"` może wskazywać `replacementFrom`, czyli umiejętności (lub rzuty obronne), którymi można zastąpić duplikat, zamiast każdej, jaką ma arkusz; obowiązuje to dla tego, co jest pokazywane, zapisywane i stosowane.

`sheet.builder.constraints` mieści do 40 reguł tworzenia postaci. Każda wskazuje `step`, którego plakietka ją pokazuje, `label` wyświetlaną tam, dopóki reguła nie jest spełniona, opcjonalne `when: Ref` i dokładnie jedno z:

- `value: Ref` z `min` lub `max` albo obydwoma (każde to liczba lub Ref).
- `rows: { list, filter?, sum? }` z `min` lub `max` albo obydwoma: liczba wierszy listy albo suma kolumny liczbowej `sum` w wierszach zachowanych przez `filter` (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: żadne dwa wiersze nie mają tej samej wypełnionej wartości (bez względu na wielkość liter i spacje).
- `approved: fieldId`: pole logiczne, które musi być włączone, np. zatwierdzenie przez Storytellera.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

Niespełniona reguła nigdy nie blokuje Back, Next ani **All fields**.

**Obliczane wartości atrybutów i efekty stosowane do jednego rzutu (Capability API 1.156).** Atrybut może zawierać `value: Ref[]` (od 1 do 8): jego wartość to suma tych odwołań, utrzymywana w zakresie `min` i `max` i pokazywana tylko do odczytu. Atrybut z Blades to suma jego zaznaczonych akcji; Perception z GURPS to `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, a umiejętności rzucane z nim podążają za tym, co kupiono. Wartości pochodne, ograniczenia i umiejętności mogą odczytywać obliczaną wartość atrybutu, ale żadna z nich nie może odczytywać innej, nawet przez wartość pochodną. Kreator nigdy jej nie ustawia, a cokolwiek dla niej zapisano, jest ignorowane.

Lista może deklarować `contextual`, aby jej wiersze stosowały się do rzutu, gdy Mistrz Gry je wskaże:

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` to kolumna, po której Mistrz Gry wskazuje wiersz. `skill` (opcjonalne) zawiera umiejętność, do której stosuje się wiersz, po identyfikatorze lub etykiecie; pusta komórka dotyczy każdego testu. `bonus` (kolumna liczbowa) i `dice` (kolumna kości) dodają do testu, w zestawie z pulą jako kości. `to: "saves"` stosuje wiersze zamiast tego do rzutów obronnych. W zestawie z pulą `check: { dice?, successes?, double?, explode? }` daje każdemu zastosowanemu wierszowi ten sam efekt na pulę, np. specjalizacja, w której dziesiątki eksplodują.

Wpis katalogu może zawierać `mechanics.contextual` z `effects` (`own-checks-advantage` i inne efekty testów i rzutów obronnych), `modifiers` dla `checks` lub `saves`, zawężającymi `skills` i `saves`, efektem puli `check` oraz `cost: [{ "pool": "...", "amount": 1 }]`, płaconym raz przy rzucie, do którego jest stosowany. Mistrz Gry zapisuje w teście `apply="Strong Back; Quick Eye"` (do czterech nazw). Test zmieniają tylko nazwy, które się do niego stosują: wiersz innej umiejętności, nazwa dzielona przez dwa wiersze i koszt, którego pula nie może pokryć, niczego nie zmieniają. Samo posiadanie wiersza nigdy nie zmienia rzutu. Zapis wymienia w `from`, co zastosowano.

**Losowane i odczytywane z arkusza monety początkowe (Capability API 1.157).** Pozycja monet w początkowym sprzęcie może zawierać `roll` (kości, np. `"2d6"`) lub `countFrom` (Ref odczytywane z arkusza posiadacza) zamiast `count`, nigdy oba, a `times` (od 1 do 10000) mnoży każde z nich:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

Selektor pokazuje kości ("5d4 gold, rolled when taken"). Rzut następuje raz, gdy grupa lub posiadacz bierze pakiet, więc ponowne otwarcie selektora nie może rzucić ponownie. `countFrom` odczytuje własny arkusz posiadacza, np. pole Credit Rating; posiadacz bez arkusza jest odrzucany, a liczba 0 niczego nie dodaje. Pozycje przedmiotów zachowują stałe `count`.

**Wartości początkowe ustawiane raz (Capability API 1.158).** Krok kreatora `kind: "initialize"` zapisuje wartości początkowe, gdy gracz je zatwierdzi, i nigdy więcej sam z siebie:

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Każdy zapis wskazuje pole arkusza i albo `value` (stałą wartość lub Ref dla pola liczbowego), albo `remaining`, czyli to, co zostało niewydane w puli kreatora. Krok pokazuje każde pole teraz i wartość, na jaką zostanie ustawione; jego plakietka czeka, aż gracz je ustawi. Zapisane wartości są zachowywane razem z kreatorem, więc ponowne otwarcie, import postaci ani późniejsza zmiana POW nigdy ich ponownie nie zapisują. Gdy arkusz od tego czasu się zmienił, krok pokazuje, co zastąpiłoby ponowne ustawienie, a robi to tylko przycisk **Set again** (ustaw ponownie) gracza. Postać opisywana tak, jaka już jest, nigdy nie jest nadpisywana.

Pula bieżąca może deklarować `startFrom: Ref`, aby zaczynać od wartości odczytanej z arkusza zamiast od pełnej lub pustej, utrzymywanej między 0 a jej maksimum, a zwykły tor może deklarować `startFrom` zamiast `default`. Wskazując pole zapisane przez krok inicjalizacji, SAN zaczyna od POW, z którego go ustawiono, i pozostaje tam, gdzie zostawi go gra: zapisana wartość bieżąca zawsze ma pierwszeństwo przed punktem startowym puli.

**Wyceniane wybory i wiersze (Capability API 1.159).** Krok katalogu lub krok wierszy może wskazywać `pool` kreatora i `cost`, więc to, co gracz wybiera lub zapisuje, jest opłacane z tej samej puli co kroki wydatków. Koszt kroku katalogu to liczba lub `{ "filter": "tier" }`, własny filtr liczbowy wpisu. Koszt kroku wierszy to liczba lub `{ "column": "cost" }`, odczytywane z każdego wiersza; ujemna cena to kredyt, utrzymywany w granicy `creditLimit` puli, więc wada finansuje cechy. Krok wierszy może też wskazywać `from`, katalog wierszy zasilający jego listę: gracz dodaje kopię wiersza wpisu tyle razy, ile chce, a każda kopia jest jego własnym wierszem, osobno wycenianym i usuwanym:

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

Wybór, za który pula nie może zapłacić, nie jest oferowany. Wyceniane wybory i wiersze są opłacane najpierw i nigdy nie są sprzedawane za gracza: gdy usunięcie wady przekracza budżet puli, zakupy z kroków wydatków przestają działać, dopóki gracz tego nie naprawi, a plakietka każdego wycenianego kroku liczy naprawę. Suma, której kolumna nie może przekroczyć (poziomy Rite), to reguła tworzenia postaci (1.155) z `rows.sum` i `max`.

**Profile tworzenia postaci i wcześniejsze fazy (Capability API 1.160).** `sheet.builder.profiles` (do 16) pozwala typowi postaci, profesji lub pakietowi wnieść własne kroki i budżety:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

Profilem postaci jest pierwszy profil, którego `when` daje wynik powyżej 0, a kreator podaje, który to profil. Krok wymieniany przez jakikolwiek profil jest pokazywany tylko wtedy, gdy profilem postaci jest profil, który go wymienia; jego odpowiedzi są zachowywane, gdy jest ukryty, i niczego nie przyznają. `budgets` profilu zastępują budżety tych pul, więc zmiana typu nigdy nie zachowuje budżetu innego typu: zakupy, których już nie pokrywa, przestają działać, dopóki gracz ich nie naprawi.

Krok katalogu lub krok inicjalizacji może deklarować `reads: { "before": "step_id" }`. `offeredWhen` jego wpisów i jego `upTo` (albo wartości kroku inicjalizacji) odczytują wtedy arkusz w takim stanie, w jakim tworzą go kroki przed tym krokiem: wszystko, co późniejsze kroki wybrały, przyznały lub kupiły, jest cofane, a to, co wpisał gracz, zostaje zachowane. Krok wieloklasowości odczytuje wartości atrybutów sprzed zwiększenia z tego poziomu; migawka Humanity odczytuje cnoty sprzed darmowych punktów, niezależnie od tego, jak gracz przechodził tam i z powrotem między krokami.

**Wiersze, które same są testami (Capability API 1.161).** Lista może deklarować do czterech `checks`, więc każdy wiersz zapisany przez gracza jest testem, którego Mistrz Gry może zażądać po nazwie:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` to kolumna tekstowa, po której wywołuje się wiersz, a `rating` to kolumna liczbowa będąca jego wartością; `ability` (opcjonalne) dodaje się tak, jak atrybut umiejętności. Science (Physics) i Science (Biology) to dwa wiersze i dwa testy, każdy z własną wartością. Dwa testy na jednej liście to dwie postawy oparte na jednej wartości, każda z `label`, które Mistrz Gry podaje po nazwie wiersza: "Fire stew (bold)" i "Fire stew (careful)". Własne umiejętności, rzuty obronne i atrybuty arkusza są dopasowywane najpierw. Nazwa dzielona przez dwa wiersze nie jest żadnym testem, dopóki jeden z nich nie zmieni nazwy, a test usuniętego wiersza znika razem z nim. Blok arkusza dla Mistrza Gry wymienia każdy test wiersza z jego liczbą, a `with=` działa tak jak przy umiejętności. Krok wierszy wyceniany według kolumny wartości (1.159) kupuje wartości z puli tworzenia postaci.

**Rzuty przy tworzeniu postaci zachowywane z kośćmi (Capability API 1.162).** Kości tworzenia postaci to `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: najwyższe `keep` wyniki plus `add`, razy `multiplier`, więc `(2d6+6) x 5` z CoC to `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

`methods.rolls` kroku atrybutów rzuca każdą wartość po kolei, każdą kośćmi jej własnej grupy, i nigdy nie pozwala przenieść rzutu na inną wartość (metoda `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Krok `kind: "roll"` wymienia do 12 `rolls`, każdy zapisywany do liczbowego `field`: Luck, punkty życia, pieniądze początkowe. `best` (2 lub 3) rzuca tyle razy i zachowuje najlepszy wynik; `floor` (liczba lub Ref) to najniższy dopuszczalny wynik, np. 1 punkt życia albo potencjał nigdy niższy niż jego statystyka; `gain` czyni z niego zamiast tego test poprawy, rzucany przeciw polu i dodający `gain` tylko wtedy, gdy wynik jest wyższy, tak jak poprawa EDU w CoC. Każdy rzut jest zachowywany z wynikami kości i z nimi pokazywany. Wykonany rzut pozostaje; ponowne otwarcie kreatora nigdy nie rzuca ponownie, a oferuje to tylko krok z `retry: true`. Dla postaci opisywanej nigdy się nie rzuca.

**Liczone wybory i ograniczenia tworzenia postaci (Capability API 1.151).** Każdy krok może zawierać `when: Ref` (pokazuj go i stosuj tylko wtedy, gdy niebieżąca wartość arkusza jest powyżej zera) oraz `requiredWhen: Ref` (licz niedokończone wybory w jego plakietce tylko wtedy, gdy wartość jest powyżej zera). Ukryte kroki zachowują zapisane odpowiedzi. Next i Back pozostają dostępne nawet przy niepełnych lub nieprawidłowych wyborach; All fields pozostaje swobodną edycją.

Kroki katalogu mogą deklarować do 12 `quotas`, każde używające jednego z typowanych filtrów katalogu:

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

To piramida w stylu Fate, gdy katalog oferuje każdą umiejętność na każdym poziomie wartości. Wpisy deklarują swoje przyznania wyszkolenia jawnymi identyfikatorami poziomów biegłości; liczbowe wartości filtrów nigdy nie tworzą mapowania poziomów. Kwota spełnia `0 <= min <= max <=` maksimum kroku. Minima wpływają na plakietkę; maksima wyłączają kolejne pasujące wybory. `distinctBy` wskazuje istniejący filtr: wybory nie mogą mieć tej samej jego wartości (ani żadnego wspólnego tagu w przypadku filtra tagów), a wpis bez tego filtra nie może się liczyć. W przeciwnym razie odrębność ocenia się według identyfikatora wpisu. `quotaBelow: { "filter": "tier" }` wymaga ściśle więcej aktywnych wyborów na poziomie n−1 niż na poziomie n dla dodatnich całkowitych poziomów powyżej 1. Poziom 1 jest podstawą. Usunięcie wyboru podtrzymującego sprawia, że nadmiarowe wyższe wybory stają się nieaktywne, odbierając ich przyznania, ale zachowując odpowiedzi do naprawy.

Miejsca wyboru `abilities.choose`, `trained.choose`, `choose` kroku wyszkolenia i `entries.choose` przyjmują:

- `id`: stały identyfikator arkusza. Nowe miejsca powinny go używać; zapisane odpowiedzi przetrwają wtedy zmianę kolejności. Stare miejsca bez identyfikatorów zachowują klucze pozycyjne. Identyfikatory są unikalne wśród wszystkich wyborów oferowanych przez krok źródłowy.
- `countFrom: Ref`, z jawnym `max` (od 1 do 20, najwyżej 6 dla atrybutów). `count` pozostaje stałą liczbą, gdy brak `countFrom`. Dynamiczna liczba jest zaokrąglana w dół i utrzymywana między zerem a `max`. Odczytuje istniejące operatory wartości pochodnych, nigdy wykonywalne wyrażenia.
- `excludeChoices: ["background/restricted"]`: identyfikatory wcześniejszych wyborów tego samego rodzaju, zapisane jako `source_step/choice_id`. Wykluczają aktywne odpowiedzi wcześniejszego wyboru, łącznie z zastąpieniami. Odwołania muszą dać się zweryfikować w definicji lub w tym samym pliku katalogu. Wcześniejsze wybory przyznań wewnątrz definicji lub jawne kroki wyszkolenia mogą więc zasilać późniejszy plik katalogu; odwołania do innego zewnętrznego pliku katalogu są odrzucane. Identyfikatory wyborów we wpisach alternatywnych jednego kroku także muszą być unikalne.

Wybory atrybutów przyjmują dodatkowo `from`, przecinane z atrybutami arkusza i `except`. Dla odrębnych wzmocnień PF2e wybór `restricted` może oferować `["str", "dex"]`, a po nim wybór `free_boost` wykluczający `background/restricted`. Wybory wpisów przyjmują te same `quotas`, `distinctBy` i `quotaBelow` co kroki katalogu, ograniczone przez `max` lub `count`; nadal zapisują wiersze bez stosowania własnych przyznań wybranych wpisów.

Wybory wyszkolenia przyjmują dodatkowo `tier` (oferowany poziom powyżej braku wyszkolenia, nadpisujący poziom przyznania lub kreatora), `only: "any" | "trained" | "untrained"` i `onDuplicate: "replace"`. Kwalifikowalność odczytuje ręczne wyszkolenie i wcześniejsze aktywne przyznania, z wyłączeniem wcześniejszych zapisów samego kreatora. Wybrana umiejętność, którą te źródła już wyszkoliły, otwiera osobne miejsce zastępcze wśród niewyszkolonych umiejętności tego samego rodzaju, zachowując pierwotną odpowiedź. Zastąpienia respektują wykluczenia i poziom wyboru. Ich zapisany klucz to klucz pierwotnego miejsca plus `/replacement`. Rangi spoza profesji u człowieka mogą wykluczać wcześniejszy wybór profesji i używać `only: "untrained"`; zmiana profesji zachowuje nieprawidłowe późniejsze odpowiedzi.

Warunki i nowe liczby miejsc mogą odczytywać tylko wartości zmieniane przez wcześniejsze kroki, co zapobiega przyznaniom włączającym same siebie lub cyklicznym. Liczba miejsc nie może odczytywać wartości arkusza, gdy mógłby je zmienić późniejszy zewnętrzny plik katalogu; przenieś jej krok źródłowy wcześniej albo zachowaj ten katalog wewnątrz definicji. Warunek może używać istniejącej pochodnej `enumTable`, aby krok podrasy był wymagany tylko dla jednego pochodzenia. `requiredWhen` wpływa tylko na plakietki i może odczytywać dowolną prawidłową niebieżącą wartość. Nowe ograniczone wybory pozostają nierozstrzygnięte, gdy brakuje kwalifikującej się zawartości, z wyjaśnieniem "not configured". Nigdy po cichu nie obniżają wymaganej liczby do dostępnej zawartości. Ręczne edycje arkusza i opisane postacie zachowują istniejące zasady własności kreatora.

Postać utworzona bez kreatora (arkusz, który nie jest pusty i nie ma jeszcze wyborów kreatora) otwiera się jako **described** (opisana): wybory zapisują, czym postać już jest (zwiększenia z jej rasy uznaje się za już zawarte w jej wartościach), i niczego nie zmieniają w arkuszu, dopóki gracz nie wybierze **Done: let picks change the sheet** (gotowe: niech wybory zmieniają arkusz). Od tej chwili zmiana wyboru odbiera to, co dał wybór z opisu.

Bez `tier` wyszkolenie trafia na pierwszy poziom powyżej braku wyszkolenia oferowany przez arkusz; arkusz oferujący poziom połowiczny (jak umiejętności w 5e) ustawia `"tier": "proficient"`.

<a id="items-what-a-party-carries"></a>

## Przedmioty: co niesie drużyna

Pancerz, broń, mikstury, wyposażenie, amunicja i pieniądze to przedmioty. Opcjonalny blok `items` deklaruje słowa, którymi opisuje się każdy przedmiot twojego zestawu zasad, a katalog z `holds: "items"` wymienia same przedmioty. Oba wymagają Capability API 1.49; `rarityCaps` i `propose` bloku, które dotyczą przedmiotów wymyślanych przez Mistrza Gry, wymagają 1.51, wartość odczytująca przedmioty posiadane przez postać (`itemStat`) – 1.52, działanie przedmiotu na testy, gdy jest założony lub niesiony, wraz z limitami `bonus` bloku – 1.53, wymagania przedmiotu wobec noszącego i zmieniane przez niego atrybuty – 1.54, `attack` broni – 1.55, działanie przedmiotu w walce – 1.56, to, czym broń strzela i ile ma załadowane – 1.57, tryby broni, atak drugą ręką, minimum obrażeń i stany przy trafieniu – 1.58, działanie użycia przedmiotu w walce wraz z jego ładunkami – 1.59, użycie przywracające pulę – 1.60, ładunki odzyskiwane przy odpoczynku lub przedmiot niszczący się po opróżnieniu – 1.61, użycie wymagające najpierw testu (`gate`) – 1.62, tabele łupów i łupy stworzenia – 1.63, pozycja łupów dająca monety lub warstwa usuwająca monety – 1.64, targ, miejscowość `sold` przedmiotu i `service` – 1.65, dzień targowy (sakiewka, `buyBack`, `stock` sprzedawcy, liczba `limited` albo `sold` bez wskazanej miejscowości) – 1.69, efekt dodatkowy działający przy trzymanej broni (`weapons`) – 1.70, początkowy sprzęt (`startingGear`) – 1.78, a ryzykowny przedmiot, podróbka lub nieuczciwy sprzedawca – 1.79.

### Blok przedmiotów

Blok trafia do `items` na najwyższym poziomie pliku. Oto blok Ember Roads, nieco skrócony:

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: od jednej do 24. Każdy przedmiot ma dokładnie jedną, np. pancerz, broń lub mikstura.
- `rarities`: opcjonalne, do 12. Wymień je od najpospolitszej do najrzadszej.
- `tags`: opcjonalne, do 48. Właściwości, które może mieć przedmiot, np. miotany lub posrebrzany.
- `stats`: opcjonalne, do 24. Liczby i słowa opisujące przedmiot, deklarowane dokładnie jak kolumna listy: `number`, `text`, `boolean`, `enum` lub `dice`, z zakresem, wartościami i wartością domyślną tam, gdzie typ je ma. `promptVisible` (domyślnie `true`) określa, czy Mistrz Gry widzi statystykę obok przedmiotu. Ustaw `false` dla czegoś, co powinien widzieć tylko gracz, np. miejsca, w którym ukryto przedmiot.
- `slots`: opcjonalne, do 12. Miejsca, w których przedmiot się nosi lub trzyma, oraz ile takich miejsc ma postać, od 1 do 20.
- `binding`: opcjonalne. Dostrojenie, inwestytura lub cokolwiek innego, co ogranicza liczbę przedmiotów, które jedna postać może mieć jednocześnie powiązane. `label` to nazwa tego mechanizmu, a `max` to wartość odczytywana z arkusza postaci, np. `{ "abilityScore": "nerve" }` lub wartość pochodna. Nie może odczytywać bieżącego stanu, bo liczba przedmiotów, które postać może powiązać, nie zmienia się z każdym ciosem.
- `carry`: opcjonalne. `stat` wskazuje statystykę liczbową będącą wagą przedmiotu, której `min` wynosi 0 lub więcej. `encumberedAbove` to ilość, jaką postać może nieść, zanim stanie się przeciążona, a `limit` (opcjonalne) to najwięcej, ile w ogóle może unieść. Obie wartości odczytuje się z arkusza tak jak `binding.max`. Bez `carry` waga nic nie znaczy i nikt nigdy nie jest przeciążony.
- `currencies`: opcjonalne, do sześciu rodzin, każda z od jednej do dziesięciu monet.
  - Monety jednej rodziny wymienia się na siebie według `value`, liczonego w najmniejszej monecie rodziny. Najmniejsza moneta jest więc warta 1, a żadne dwie monety rodziny nie mają tej samej wartości.
  - Dwóch rodzin nigdy nie wymienia się na siebie. Moneta innego kraju albo przysługi w danym świecie to osobna rodzina.
  - Identyfikator monety jest unikalny we wszystkich rodzinach, bo koszt przedmiotu wskazuje samą monetę.
  - `label` monety to jej nazwa dla dowolnej liczby sztuk (`pennies`); `one` (Capability API 1.89) to jej nazwa dla dokładnie jednej sztuki (`penny`), używana wszędzie tam, gdzie cena, sakiewka lub targ wymienia jedną monetę. Bez niego `label` oznacza także jedną sztukę.
  - `perWeight` (opcjonalne i tylko obok `carry`) to liczba monet rodziny ważących jedną jednostkę statystyki udźwigu.
  - Monety to pieniądze drużyny, noszone w torbach jak każdy przedmiot (zobacz niżej Pieniądze).
- `rarityCaps`: opcjonalne, najwyżej jeden na rzadkość. Najwięcej, ile może dać przedmiot wymyślony przez Mistrza Gry przy tej rzadkości: największa wartość każdej statystyki liczbowej wskazanej w `stats`, w jej własnym zakresie i jako liczba całkowita dla statystyki przyjmującej liczby całkowite, oraz `bonus` (Capability API 1.53), największa stała premia, jaką może dodać jeden z jego modyfikatorów działających, gdy przedmiot jest założony lub niesiony. Przy rzadkości z `bonus` premia w kościach jest pomijana, bo kości nie da się ograniczyć do liczby; kara nigdy nie jest ograniczana. Wymyślony przedmiot jest do tego dopasowywany; przedmioty wymienione w twoich katalogach należą do ciebie i nigdy nie są ograniczane.
- `propose`: domyślnie `true`. `false` zabrania Mistrzowi Gry wymyślania przedmiotów twojego zestawu zasad.
- `native`: domyślnie `true`. `false` wyłącza własne, nietypowane przedmioty trybu Game Mode w grach z twoim zestawem zasad (zobacz **Co odczytuje przedmioty**). Mistrz Gry nadal może wymyślać przedmioty, opisane słowami twojego zestawu.
- `freeform`: czym staje się przedmiot wpisany przez gracza. `"plain"` (domyślnie) zachowuje go jako przedmiot bez zasad, jak dotąd. `"refuse"` dopuszcza tylko przedmioty twojego zestawu zasad.
- `lootTables` (Capability API 1.63): opcjonalne, do 24. Co zostawiają stworzenia z wygranej walki i co daje `[loot:]` Mistrza Gry (zobacz niżej Łupy).

### Przedmiot

Katalog przedmiotów nie deklaruje `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Każdy wpis zawiera `item` zamiast `rows` lub `creature`:

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` i `filters` działają jak w każdym wpisie. Etykieta jest nazwą przedmiotu.
- `category` jest wymagane. `rarity` i `tags` są opcjonalne, a wszystkie trzy wskazują identyfikatory z bloku. Przedmiot może mieć rzadkość tylko wtedy, gdy blok jakieś deklaruje.
- `stats`: wartości statystyk bloku. Każda jest wartością dopuszczalną dla swojej statystyki.
- `slots`: ile miejsc każdego rodzaju zajmuje przedmiot, nigdy więcej, niż ma postać.
- `stack`: najwięcej, ile mieści jeden stos, od 1 do 999 999. Bez tego stos mieści tyle, co każdy stos w trybie Game Mode. Przedmiot z `charges` występuje w stosie pojedynczo.
- `cost`: całkowita liczba `amount` jednej monety, wskazanej przez identyfikator `unit`. Pokazuje go selektor, a Mistrz Gry widzi go obok przedmiotu (zobacz niżej Pieniądze).
- `sold` (Capability API 1.65): `{ "place": "city" }`, najmniejsza z miejscowości twojego targu, w której przedmiot jest sprzedawany, z pierwszeństwem przed każdą regułą mówiącą co innego; od 1.69 może zamiast tego lub dodatkowo określać, ile sztuk miejscowość ma do sprzedania w ciągu dnia (`"limited": 2` lub `"limited": "1d3"`) (zobacz niżej Targi).
- `service` (Capability API 1.65): `true` dla noclegu, przejazdu, błogosławieństwa: kupowanych jak przedmiot i nigdy nienoszonych. Zakup usługi tylko płaci; nic innego nie umieszcza jej w torbie (dodanie usługi jest odrzucane jako `service`), a selektor pomija usługi. Usługa ma `cost` i nic, co dotyczy noszenia lub używania (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: przedmiot trzeba powiązać, zanim zacznie działać jako założony. `restriction` (opcjonalne) opisuje słowami, kto może go powiązać, a `cursed: true` oznacza przedmiot, który nie puszcza. Tylko zestaw zasad z `binding` może mieć przedmioty wymagające powiązania.
- `worn` i `carried` (opcjonalne, Capability API 1.53): działanie przedmiotu na testy i rzuty obronne posiadacza, gdy jest założony i gdy jest tylko niesiony, (1.54) atrybuty, które ustawia lub podnosi, oraz (1.56) jego działanie w walce. Zobacz [Testy poza walką](#checks-outside-a-fight) i [Pancerz i efekty założonych przedmiotów w walce](#armor-and-worn-effects-in-a-fight).
- `requires` (opcjonalne, Capability API 1.54): czego przedmiot wymaga od noszącego i co obowiązuje, dopóki ten nie spełnia wymagań. Zobacz [Testy poza walką](#checks-outside-a-fight).
- `attack` (opcjonalne, Capability API 1.55): działanie przedmiotu jako broni w walce, gdy jest założony, (1.57) czym strzela i ile ma załadowane oraz (1.58) jego inne tryby, atak drugą ręką, minimum obrażeń i stany nakładane przy trafieniu. Zobacz [Broń w walce](#weapons-in-a-fight), [Amunicja i przeładowanie](#ammunition-and-reloading) oraz [Tryby, druga broń, minimum obrażeń i stany przy trafieniu](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (opcjonalne, Capability API 1.170): przełącznik przedmiotu, `{ "label", "budget" }`. Walka oferuje go jako opcję za ten budżet ("Turn on Flame Tongue: Flames"), ekwipunek jako przycisk z etykietą, a ustawienie, w jakim go zostawiono, pozostaje na stosie między walkami; na początku jest wyłączony. Przedmiot z przełącznikiem, dopóki jest włączony, tworzy osobny stos. Klauzula `plus` broni z `when: "toggled"` działa tylko wtedy, gdy przełącznik jest włączony. Flame tongue z 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` i `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` i `charges` (opcjonalne, Capability API 1.59): działanie użycia przedmiotu w walce i poza nią, ładunki, które to użycie wydaje, oraz (1.60) przywracana przez niego pula. Zobacz [Używanie przedmiotów w walce](#using-items-in-a-fight) i [Używanie przedmiotów poza walką](#using-items-outside-a-fight).

Przedmiot nie ma `mechanics`: jego działanie zapisuje się w bloku `item`.

### Co odczytuje przedmioty

Wszystko powyższe jest sprawdzane przy imporcie zestawu zasad, a twoje katalogi przedmiotów są dostarczane razem z nim. W grze odczytuje je ekwipunek trybu Game Mode:

- **Twoje przedmioty są w torbie.** Stos może być jednym z twoich przedmiotów i pozostaje nim, jakkolwiek nazwie go gracz. Przycisk **From the ruleset** (z zestawu zasad) w ekwipunku otwiera selektor wszystkich przedmiotów z twoich katalogów, z wyszukiwaniem i filtrami katalogu, a warstwa ukrywająca wpis ukrywa go także tam.
- **Nazwy odnajdują twoje przedmioty.** Nazwa wpisana przez gracza lub zapisana przez Mistrza Gry w `[inventory: action="add"]`, będąca `label` jednego z twoich przedmiotów, niezależnie od wielkości liter, dodaje ten przedmiot. Gdy dwa przedmioty mają tę samą etykietę, nazwa odnajduje ten, który twoje katalogi wymieniają jako pierwszy.
- **`stack`** jest przestrzegane: dodanie, ustawienie, połączenie lub przekazanie ponad ten limit wypełnia stos i zaczyna nowy.
- **`freeform: "refuse"`** zostawia graczowi tylko twoje przedmioty: selektor i nazwy, które są twoimi przedmiotami.
- **`native: false`** zostawia Mistrzowi Gry tylko twoje przedmioty i te, które sam wymyśli: nazwa, która nie jest żadnym z nich, jest odrzucana (`not-ruleset-item`), choć nadal można dodać więcej czegoś, co już jest w posiadaniu, o czym mówią jego instrukcje. Walka nie pyta już modelu, co robią przedmioty z ekwipunku, więc walczą tylko twoje przedmioty: w walce według zestawu zasad trzymana broń i użycia twoich przedmiotów (zobacz niżej Broń w walce), a w bitwie Classic lub Tactical twoje przedmioty z `use` (zobacz niżej Przedmioty w bitwach Classic i Tactical). To, co wpisuje gracz, nadal podlega `freeform`, a rzeczy niesione przez drużynę w obu przypadkach wracają w nowej sesji.
- **Czym jest przedmiot**, widać na wybranym stosie: jego kategorię, rzadkość i tagi według etykiet, dawane statystyki, opis i pojemność jednego stosu. Selektor pokazuje też jego `cost`. Mistrz Gry widzi każdy twój przedmiot z ekwipunku z kategorią, rzadkością, tagami i statystykami pozostawionymi jako `promptVisible`, np. `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: przedmiot zajmujący miejsca może założyć ten, kto go niesie, jeśli ma te miejsca wolne, a jedna sztuka z większego stosu trafia do osobnego stosu, aby można ją było założyć. Ekwipunek pokazuje zajęte miejsca każdej postaci.
- **`binding`**: przedmiot z `binds` można powiązać, do `binding.max` odczytanego z arkusza jego posiadacza (postać bez arkusza odczytuje pusty arkusz). Przedmiot `cursed` po powiązaniu pozostaje powiązany: gracz nie może zerwać powiązania, zdjąć go, oddać ani usunąć, a klątwę może zakończyć tylko Mistrz Gry.
- **`carry`**: przedmiot waży tyle, ile wynosi jego `carry.stat` (przedmiot bez tej statystyki nic nie waży), a obciążenie postaci to waga jej torby, porównywana z `encumberedAbove` i `limit` odczytanymi z jej arkusza. Przedmiot dodany do wspólnego widoku ekwipunku, przez gracza lub przez Mistrza Gry bez `who=`, trafia do tego, kto może go nieść bez przeciążenia (najpierw gracz, potem drużyna po kolei), a gdy nikt nie może wziąć całości, jest dzielony według wolnego miejsca każdego. Nic nie przekracza niczyjego `limit`: to, czego nikt nie uniesie, zostaje na miejscu, a Mistrz Gry jest o tym informowany. Nadaj statystyce wagi `"integer": false` dla wag takich jak ćwierć funta.
- **Mistrz Gry wymyśla przedmioty twoimi słowami.** Jeśli nie ustawisz `propose: false`, jego `[inventory: action="add"]` może opisać nowy przedmiot: `like=` jeden z twoich przedmiotów jako punkt wyjścia, a następnie dowolne z `category=`, `rarity=`, `tags=`, `stats=` (pary `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` lub `no`), `worn=` i `carried=` (zmiany rozdzielone `;`, każda to `+N`, `-N`, `advantage`, `disadvantage` lub `fails` dla rzutów obronnych, na umiejętnościach lub rzutach obronnych wskazanych nazwą albo na `checks` lub `saves` dla wszystkich, `+N` lub `-N` na nazwie atrybutu, aby go podnieść lub obniżyć, a tam, gdzie masz walki, `+N`, `-N`, ułatwienie lub utrudnienie na atakach oraz `+N` lub `-N` na obronie lub twoim słowie na nią: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` albo `none`) i `summary=`, każdą część przez identyfikator lub etykietę. Statystyka przedmiotu, którą twoja obrona już liczy (Guard w Ember Roads sumuje `guard` założonych rzeczy), to sposób, w jaki pancerz ją podnosi, więc zmiana obrony przy założeniu obok takiej statystyki jest pomijana, a odpowiedź o tym informuje: mały model pisze `guard=1` i `+1 Guard` dla jednego +1. Engine odczytuje też to, co mały model zwykle pisze zamiast tego: liczbę po nazwie (`Brawn +1`), "bonus" po atakach lub obronie (`+1 attack roll bonus`), `none` dla pustej listy tagów, statystyk lub miejsc oraz `worn=`, `carried=` lub `summary=` wewnątrz `stats=`, gdy nie masz statystyki o takiej nazwie. Engine zachowuje tylko to, co jest w twoim bloku: nieznana kategoria, tag, statystyka, miejsce, umiejętność lub rzut obronny są pomijane, rzadkość, której nie masz, staje się twoją najniższą, liczba jest dopasowywana do zakresu statystyki, a potem do `rarityCaps` swojej rzadkości, premia przy założeniu lub niesieniu – do `bonus` swojej rzadkości (także część przejęta przez `like`), a nazwa będąca jednym z twoich przedmiotów oznacza po prostu ten przedmiot. Odpowiedź mówi Mistrzowi Gry, co zmieniono (nigdy w odniesieniu do statystyki, której mu nie pokazujesz), a szczegóły przedmiotu pokazują graczowi każdą zmianę. Gra przechowuje przedmiot, więc ta sama nazwa oznacza go do końca gry, a nowa sesja zachowuje go, dopóki ktoś go jeszcze ma.
- Mistrz Gry może zakładać i zdejmować twoje przedmioty (`equip` i `unequip`) swoją komendą ekwipunku, gdy masz `slots`, oraz wiązać je i zrywać powiązanie (`bind` i `unbind`), gdy masz `binding`: dowiaduje się tylko o tych, które ma twój zestaw zasad. Widzi obciążenie każdej postaci, powiązane przedmioty i miejsca oraz to, co jest założone lub powiązane.

- **Działanie przedmiotu założonego lub niesionego** widać na wybranym stosie i w selektorze ("While worn: -1 on checks (Sneak)"), a Mistrz Gry widzi je obok przedmiotu (`worn: -1 on checks (Sneak)`). Testy poza walką je uwzględniają (zobacz niżej Testy poza walką).
- **Działanie broni** widać tak samo ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), a walka oferuje broń, gdy jest trzymana (zobacz niżej Broń w walce).
- **Działanie użycia przedmiotu** widać tak samo ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), wraz z pozostałymi ładunkami. Oferuje je walka, a także przycisk **Use** (użyj) w ekwipunku i `[inventory: action="use"]` Mistrza Gry (zobacz niżej Używanie przedmiotów w walce i Używanie przedmiotów poza walką).

W bitwie Classic lub Tactical każdy twój przedmiot z `use` robi to, co tam zapisano, a przedmiot bez niego nie jest oferowany (zobacz niżej Przedmioty w bitwach Classic i Tactical). Niezależnie od `native` arkusz może odczytywać twoje przedmioty (niżej), trzymana broń jest atakiem w walce według zestawu zasad i strzela tym, co pobiera z torby, działanie przedmiotu założonego lub niesionego liczy się w takiej walce (zobacz niżej Pancerz i efekty założonych przedmiotów w walce), przedmiot z `use` jest używany według własnych zasad, w walce i poza nią (zobacz niżej Używanie przedmiotów w walce i Używanie przedmiotów poza walką), a twoje `currencies` są pieniędzmi drużyny (zobacz niżej Pieniądze).

<a id="items-on-the-sheet"></a>

### Przedmioty w arkuszu

Odwołanie do wartości może odczytywać przedmioty posiadane przez postać przez `itemStat` (Capability API 1.52). Ember Roads dodaje ochronę pancerza noszonego przez podróżnika do jego Guard, którą musi pokonać cios:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` to przedmioty na postaci: przedmiot zajmujący miejsca, gdy jest założony, przedmiot z `binds`, gdy jest powiązany, a przedmiot z jednym i drugim, gdy spełnia oba warunki. Przedmiot bez żadnego z nich nigdy nie jest założony. `"carried"` to reszta tego, co postać ma, a `"all"` to jedno i drugie.
- `pick`: `"sum"` dodaje wartość każdego przedmiotu pomnożoną przez liczbę sztuk, `"max"` i `"min"` odczytują najwyższą lub najniższą pojedynczą wartość, a `"count"` liczy przedmioty według liczby sztuk.
- `stat` wskazuje jedną ze statystyk twoich przedmiotów. `sum`, `max` i `min` wymagają statystyki `number`. `count` może ją pominąć, aby policzyć każdy przedmiot, albo wskazać dowolną statystykę, aby liczyć tylko przedmioty, które ją dają.
- `slot`, `category` i `tag` (każde opcjonalne) zostawiają tylko przedmioty zajmujące to miejsce, należące do tej kategorii lub mające ten tag.
- `default` (opcjonalne, 0 po pominięciu) to wartość odczytywana, gdy nie wybrano żadnego przedmiotu albo żaden nie daje tej statystyki.

Przedmioty zmieniają się podczas gry, więc `itemStat` podlega tej samej regule co odczyt bieżący: `max` puli lub toru, premia biegłości, `binding.max`, liczby `carry` oraz skalowana kolumna lub skalowanie katalogu nie mogą go odczytywać, nawet przez wartość pochodną. Wszędzie indziej, gdzie odczytuje się liczbę, jest to możliwe: w wartości pochodnej, `adjust` testu, `cap` umiejętności, obronie, pochłanianiu lub inicjatywie w walce.

Przedmioty postaci to te w jej własnej torbie. Karta gracza (ta nazwana tak jak persona czatu, a w przeciwnym razie pierwsza) odczytuje torbę gracza, a każda inna karta – własną. Liczą się tylko przedmioty twojego zestawu zasad, bo zwykły przedmiot nie ma statystyk do odczytania. Arkusz na ekranie, test, blok arkusza dla Mistrza Gry i rozpoczynająca się walka odczytują to, co każda postać ma w danej chwili. Poza grą, w edytorze arkusza lub przeglądzie importu, nikt nic nie ma, a `itemStat` odczytuje swoje `default`.

<a id="checks-outside-a-fight"></a>

### Testy poza walką

Test lub rzut obronny, o który Mistrz Gry prosi poza walką, odczytuje więcej niż arkusz: aktywne stany postaci, osiągnięte przez nią poziomy, działanie jej przedmiotów założonych lub niesionych oraz koszt niespełnionego wymagania założonego przedmiotu. To ten sam słownik, którego używają stany w walce (Capability API 1.53 dla kluczy przedmiotów i zawężania).

Przedmiot określa swoje działanie przez `worn`, obowiązujące, gdy jest założony (i powiązany, jeśli wymaga powiązania), oraz `carried`, obowiązujące, gdy jest tylko niesiony. Skórzany płaszcz z Ember Roads skrzypi przy skradaniu, a kamień drogowy sprawia, że ludzie z karawan ci ufają:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Każde przyjmuje te części stanu, które odczytuje test:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` i `own-saves-disadvantage`.
- `modifiers`: zmiany `to` testów lub rzutów obronnych, z `flat`, `dice` (i `minus`), `mode` oraz własnymi `skills` lub `saves`, dokładnie jak w stanie.
- `failsSaves`: rzuty obronne automatycznie nieudane dla posiadacza, bez rzutu.
- `skills` i `saves`: których umiejętności lub rzutów obronnych dotyczą efekty i modyfikatory niewskazujące własnych.
- `abilities` (Capability API 1.54): zmieniane atrybuty, według identyfikatora, każdy jako `{ "set": N }` (co najmniej N: wyższa wartość zostaje) lub `{ "add": N }` (liczba ujemna obniża). Działają przed obliczeniem arkusza, więc wszystko, co odczytuje atrybut, odczytuje zmienioną wartość: arkusz na ekranie, wartości pochodne, testy, blok arkusza dla Mistrza Gry i rozpoczynająca się walka. Najpierw stosuje się dodawanie, potem najwyższe `set`, a własne `min` i `max` atrybutu nadal obowiązują. Maksimum puli lub toru i premię biegłości oblicza się z samego arkusza, więc przedmiot ich nie zmienia.

Rękawice z wołowej skóry z Ember Roads dają słabemu uściskowi siłę poganiacza bydła:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

Działanie przedmiotu w walce (obronę, ataki, szybkość, inne efekty walki oraz obrażenia i stany, przed którymi chroni) opisuje [Pancerz i efekty założonych przedmiotów w walce](#armor-and-worn-effects-in-a-fight); test poza walką odczytuje tylko powyższe części. Jeden przedmiot działa raz, niezależnie od tego, ile jego stosów ktoś ma.

Przedmiot może też czegoś wymagać od noszącego przez `requires`: wartości z jego arkusza (`value`, dowolne odwołanie do wartości, odczytywane jak wszystko podczas gry), jej minimum (`atLeast`) i tego, co obowiązuje, dopóki wymaganie nie jest spełnione (`otherwise`, w tym samym słowniku, z tym że nie może zmieniać atrybutu, bo wymaganie może go odczytywać). Najwyżej cztery. Łopata grabarska z Gravewatch to ciężka praca dla słabego strażnika:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Wymaganie odczytuje atrybut po zmianach wprowadzonych przez przedmioty noszącego, więc rękawice ustawiające Sinew na 3 spełniają wymaganie łopaty.

W teście:

- Każdy modyfikator, który go dotyczy, dodaje swoją liczbę, a jego kości są rzucane: stała liczba w teście sumowanym, kości w puli. Test atrybutu i test, którego zestaw zasad nie potrafi nazwać, odczytują tylko to, co nie jest do niczego zawężone, a rzut obronny odczytuje tylko to, co dotyczy rzutów obronnych.
- Ułatwienia i utrudnienia ze wszystkich źródeł, w tym `mode=` Mistrza Gry, znoszą się: przy choćby jednym z każdego test rzuca się raz. Przechyla się tylko zestaw zasad, który w ogóle rzuca dwa razy (`resolution.advantage`).
- Rzut obronny automatycznie nieudany z powodu stanu lub przedmiotu jest nieudany bez rzutu i nic się na niego nie wydaje.
- Zapis podaje, co go zmieniło: `effects="-1"` dla liczby, `from="Leather coat"` dla źródła zmiany i `automatic="true"` dla rzutu obronnego nieudanego bez rzutu. Karta rzutu pokazuje to samo, a Mistrz Gry odczytuje to w następnej turze. Wie, że Engine stosuje te zmiany, więc nie dodaje ich ponownie.

Gravewatch pokazuje to samo w puli: powiązany Dawn bell (dzwonek świtu) dodaje kość do Ward, a Rattled odejmuje jedną od Soothe i Barter.

### Typowane obrony ze stanów, poziomów, przedmiotów i wierszy arkusza (Capability API 1.132)

`combat.conditions[]` i `combat.levels[]` mogą przyznawać `resist`, `vulnerable`, `immune` (od 1 do 30 wpisów każde) i `conditionImmunities` (od 1 do 40 identyfikatorów stanów). Działają, dopóki trwa stan lub dopóki osiągnięty jest próg poziomu. Nowo uzyskana niewrażliwość na stan kończy ten stan, jeśli jest już aktywny, i zapobiega jego ponownemu nałożeniu. Niewrażliwość wygrywa z odpornością; odporność i podatność się znoszą. Kilka odporności nigdy nie zmniejsza obrażeń o połowę dwa razy.

`resist` i `immune` używają postaci znanej ze stworzeń: słowa obrażeń albo `{ "type": "bludgeoning", "except": ["magical"] }`. Każdy wskazany tag ciosu omija ten wpis. `vulnerable` pozostaje zwykłymi słowami obrażeń. Ta sama postać z wyjątkiem działa w efektach `worn` i `carried` przedmiotów. Zadeklaruj tagi wyjątków w `items.tags` i umieść je w cechach broni lub zaklęcia. Na przykład Stoneskin to takie mapowanie stanu:

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Armor of invulnerability używa tej samej tablicy `resist` w swoim efekcie `worn`. Protection from Energy może przyznawać `resist: ["fire"]`; cecha podobna do Brave może przyznawać `conditionImmunities: ["frightened"]`. Poziom może przyznawać `resist: ["poison"]` przy swoim progu. Nieznane statyczne słowa obrażeń są zgłaszane, gdy `combat.damageTypes` deklaruje słownik, tak jak w przypadku stworzeń; bez tej deklaracji słowa obrażeń są dowolnym tekstem.

Dla cech pochodzenia lub katalogu `combat.sheetHides` mieści do ośmiu źródeł (pusta tablica jest dozwolona). Każde wskazuje listę arkusza, jedną kolumnę tekstową lub wyliczeniową tej listy i jeden z czterech rodzajów. Dla krasnoluda, którego wiersz cech zawiera `"poison"` w kolumnie `resistance`:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Każdy wiersz wnosi słowa rozdzielone przecinkami, przycięte i dopasowywane bez względu na wielkość liter; puste słowa są pomijane. Dodanie wiersza z `"fire"` dodaje odporność na ogień; jego usunięcie usuwa to źródło. Słowa odporności i niewrażliwości mogą zawierać `except`, jak w `"bludgeoning except magical silvered"`. Podatności i niewrażliwości na stany to zwykłe słowa. Nieznane zadeklarowane słowa obrażeń w tekście arkusza są ignorowane, podobnie jak nieznane identyfikatory stanów; kolumna wyliczeniowa dla niewrażliwości na stany musi przy imporcie deklarować wyłącznie identyfikatory stanów. Podsumowania arkusza, bitwy i dla Mistrza Gry zawierają te obrony i ich wyjątki.

<a id="weapons-in-a-fight"></a>

### Broń w walce

Przedmiot może być bronią (Capability API 1.55). Jego `attack` ma kształt [wierszy ataków](#combat-a-fight-your-own-rules-resolve) bloku walki, z wartościami zamiast kolumn, a [walka według zestawu zasad](#combat-a-fight-your-own-rules-resolve) oferuje go jako atak, gdy przedmiot jest założony: trzymany w rękach, których wymaga, i powiązany, jeśli wymaga powiązania. Broń schowana lub tylko niesiona niczego nie oferuje, a wiersze ataków i własne akcje stworzeń działają dokładnie jak wcześniej. Toporek z Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: zużywany budżet, jeden z `combat.economy.budgets`.
- `toHit`: co dodaje do trafienia. `abilities` to jeden lub więcej identyfikatorów atrybutów, a liczy się najlepszy z nich (broń finezyjna wymienia dwa). `skill` dodaje to, co dodaje test tej umiejętności, z atrybutem ataku zamiast własnego atrybutu umiejętności, tak jak w wierszu ataku. `proficiency` to wartość z arkusza posiadacza: gdy jest większa od 0, dodaje się premię biegłości zestawu zasad (`{ "const": 1 }`, aby zawsze). `bonus` to liczba. `sheetBonus` to liczba odczytywana z arkusza posiadacza i dodawana w obecnej postaci, dla tego, co posiadacz wnosi do każdej broni danego rodzaju, a nie tego, czym jest broń: styl walki Archery z 5e daje każdej broni dystansowej `{ "derived": "archery" }`, wartość pochodną równą 2 dla łucznika i 0 dla każdego innego (Capability API 1.95; opis przedmiotu podaje ją pod nazwą z arkusza). `target` to własny próg pojedynczej kości dla ataku tą bronią w walce pulami (łopata z Gravewatch liczy każdą kość od 6 zamiast od 7 jak pula) i może go podać tylko zestaw `dice-pool`, którego `target` może się zmieniać; w walce sumowanej to samo wyraża `bonus`.
- `damage`: zadawane `dice`, dodany najlepszy z jej `abilities` obrażeń, `bonus` i `type`. Walka sumowana wymaga `dice`; w walce pulami trafienie zadaje swoje sukcesy, a `dice` dodaje tyle kolejnych kości puli. `sheetBonus` (Capability API 1.97) to liczba z arkusza posiadacza dodawana do obrażeń tak jak w `toHit`, a z `"oneHanded": true` liczy się tylko wtedy, gdy broń jest trzymana w jednej ręce: nie dotyczy broni `versatile` trzymanej oburącz ani broni zajmującej dwa miejsca tego samego rodzaju. Dueling z 5e daje `{ "derived": "dueling" }`, 2 dla pojedynkowicza trzymającego jedną broń. `rerollUpTo` (Capability API 1.98) to wartość z arkusza posiadacza: własne kości obrażeń broni z wynikiem równym jej lub niższym rzuca się raz ponownie, a nowy wynik zostaje, także dodatkowe kości trafienia krytycznego, tylko wtedy, gdy broń jest trzymana oburącz (broń `versatile` z wolnymi rękami albo broń zajmująca dwa miejsca tego samego rodzaju), i tylko w walce sumowanej. Great Weapon Fighting z 5e daje `{ "derived": "great_weapon_fighting" }`, 2 przy tym stylu.
- `reach` i `range` (`normal` oraz `long` dla tego, dokąd broń jeszcze sięga dalej) są w jednostce `combat.distance` i wymagają jej. Broń z obydwoma jest rzucana, tak jak wiersz ataku: z bliska zamach, dalej rzut. Bez żadnego sięga jednego pola.
- `versatile`: `dice` zadawane zamiast tego, gdy w każdym zajmowanym przez nią miejscu wśród rzeczy założonych przez posiadacza jest drugie tyle wolnego miejsca: włócznia w jednej ręce przy wolnej drugiej.
- `strikes`: ile uderzeń kupuje jedno zużycie, odczytywane z arkusza posiadacza, tak jak `strikes` wiersza ataku. Broń bez tego daje jedno uderzenie za zużycie, niezależnie od liczby ataków jej właściciela.

Każda z tych liczb lub słów może zamiast tego odczytywać własną statystykę przedmiotu: `{ "stat": "damage" }` to `damage` przedmiotu, a statystyka, której przedmiot nie daje, działa tak, jakby wartości nie zapisano. `abilities` i `skill` odczytują statystykę wyliczeniową, której słowa są identyfikatorami atrybutów lub umiejętności, a `type` – statystykę tekstową lub wyliczeniową. Przedmiot wymyślony przez Mistrza Gry przez `like=` na wzór broni też jest więc bronią, walczącą własnymi statystykami, dopasowanymi do `rarityCaps` jak każda statystyka (wartość zapisana wprost jest kopiowana bez zmian). Przedmiot wymyślony bez miejsca i powiązania nigdy nie jest założony, więc powstaje bez ataku. Mały model zwykle opisuje broń i pomija `like=`, więc broń wymyślona w kategorii twoich broni bez punktu wyjścia walczy jak ta twoja broń z tej kategorii, która jest do niej najbardziej podobna z nazwy (słowo zawarte w którejkolwiek z nazw, więc "crossbow" przypomina "bow"), albo jak pierwsza z nich, przejmując każdą odczytywaną przez atak statystykę, której propozycja nie podała, a odpowiedź o tym informuje ("It fights as Hand axe does."). Formularz propozycji Mistrza Gry również mówi mu, że broń utworzona na wzór innej walczy jak ona.

Tagi broni są przenoszone przez jej ciosy. Wpis `resist` lub `immune` stworzenia może określać, co się przez niego przebija: `{ "type": "tearing", "except": ["silver"] }` jest przyjmowane w całości od broni z tagiem `silver`, a od wszystkiego innego – z odpornością. Tak zapisano upiora grobowego z Gravewatch, a srebrny gwóźdź trumienny z tego zestawu przebija się przez jego odporność. Obrażenia, które nie pochodzą z przedmiotu będącego bronią, wskazują przenoszone tagi przez `qualities` (Capability API 1.101), w tych samych tagach przedmiotów: w `mechanics` wpisu katalogu (zaklęcie) i w `damage` akcji stworzenia (buzdygan devy). "Odporność na obrażenia obuchowe, kłute i cięte od niemagicznych ataków" z 5e to `{ "type": "slashing", "except": ["magical"] }` obok takich samych wpisów dla dwóch pozostałych typów, z `magical` w tagach magicznych broni oraz `"qualities": ["magical"]` w zaklęciach i atakach stworzeń, które SRD nazywa magicznymi.

Szczegóły broni i wiersz dla Mistrza Gry podają jej działanie: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, z `1d8 with a hand free` dla oszczepu na dziki z Ember Roads i `at 6` obok łopaty z Gravewatch.

<a id="ammunition-and-reloading"></a>

#### Amunicja i przeładowanie

Broń może czymś strzelać i może mieć własną liczbę załadowanych pocisków (Capability API 1.57). Łuk myśliwski z Ember Roads strzela strzałami, a pistolet strażniczy z Gravewatch mieści jedną kulę, ładowaną z kul i prochu strażnika:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: czym strzela broń, według jednego z `tags` twoich przedmiotów. Każdy atak zabiera `perAttack` (1, gdy nic nie podano) przedmiotów z tym tagiem niesionych przez posiadacza, założonych lub nie, z pierwszego takiego stosu w jego torbie, potem z następnego. Broń jest oferowana tylko wtedy, gdy ma ich dość, a menu walki podaje, ile zostało. Po walce wygranej przez drużynę `recover` (od 0 do 1) tego, co każdy wystrzelił, wraca do stosu, z którego pochodziło: udział jest sumowany przez całą walkę i zaokrąglany w dół raz dla każdego stosu, więc połowa z pięciu strzał wystrzelonych z jednego kołczanu to dwie. Przegrana walka lub ucieczka nic nie zwraca.
- `clip`: liczba załadowanych pocisków przechowywana w samej broni. `max` to jej pojemność, zapisana wprost lub odczytana ze statystyki liczbowej przedmiotu, a `reload` to budżet zużywany przy przeładowaniu. Atak zużywa to, co załadowane, zamiast brać z torby, a broń jest oferowana tylko wtedy, gdy ma załadowane dość na jeden atak. Opcja **Reload** (przeładowanie) w menu walki zużywa `reload` i ładuje broń: z torby, gdy broń ma `ammo` (tyle, ile torba jeszcze ma, jeśli to mniej), a do pełna, gdy go nie ma. Liczba jest przechowywana na stosie broni w ekwipunku, więc pistolet opróżniony w jednej walce jest pusty także w następnej. Broń, z której nikt jeszcze nie strzelał, jest załadowana; tak samo broń, którą gracz dołoży do stosu kilku takich samych, bo liczba załadowanych pocisków należy do jednej broni. Pocisków z magazynka nie zbiera się po walce, więc `recover` dotyczy broni bez magazynka.

To, co walka wystrzeliwuje, ładuje i zbiera, jest zapisywane w ekwipunku przy każdym kroku, tak jak zdrowie drużyny, a dziennik przygody (Adventure Journal) podaje, co zużyto. Krok, którego stos zniknął lub zawiera mniej, niż zakładała walka, jest odrzucany, tak jak zużyty przedmiot, którego walka nie może znaleźć. Dziennik walki podaje każdy strzał, przeładowanie i zebranie ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), a szczegóły przedmiotu i wiersz dla Mistrza Gry podają, czym broń strzela i ile mieści: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` i `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### Tryby, druga broń, minimum obrażeń i stany przy trafieniu

Broń może mieć inne sposoby wykonania ataku, partnerkę w drugiej ręce, minimalne zadawane obrażenia i stany nakładane na trafiony cel (Capability API 1.58). Łuk myśliwski z Ember Roads może wypuścić salwę, a srebrny gwóźdź trumienny z Gravewatch można trzymać w każdej ręce i naznacza on to, w co wbije się głęboko:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: do sześciu innych sposobów wykonania ataku, każdy z `id`, `label` i tym, co zmienia. `ammo` to liczba pocisków wystrzeliwanych przez jeden atak w tym trybie, więc broń musi mieć `ammo` lub `clip`, z których strzela. `toHit` to dodatek do trafienia: kości w walce pulami i liczba w walce sumowanej. `target` przesuwa próg pojedynczej kości w walce pulami o tyle (od własnego progu broni, a w przeciwnym razie od progu puli; `+1` oznacza trudniej), jeśli próg puli może się zmieniać. `targets` to liczba celów, w które można wycelować, każdy z własnym rzutem ataku. Po wybraniu ataku menu walki pyta o sposób (po stylu inicjatywy, jeśli są style), podając przy każdym spodziewany efekt, i oferuje tylko tryby, na które posiadacz ma pociski. Członek drużyny prowadzony przez Engine rozważa każdy tryb wymierzony w jeden cel, a tryb na kilka celów zostawia graczowi. W oknie atak jest wykonywany w zwykłej postaci.
- `offHand`: broń do drugiej ręki. Blok walki wskazuje budżet zużywany przez drugi atak i to, czy jego obrażenia zachowują dodatni atrybut:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Gdy posiadacz zaatakował w tej turze jedną bronią oznaczoną `offHand`, każda inna taka założona broń oferuje drugi atak za ten budżet, nazwany w menu "Silver coffin nail, off hand". `ability` to `full` (domyślnie) lub `penalty-only`, które dodaje atrybut obrażeń tylko wtedy, gdy coś odejmuje, jak walka dwiema broniami w 5e. Atak drugą ręką to jeden cios, niezależnie od liczby uderzeń kupionych przez główny atak, i nigdy nie jest uderzeniem w odchodzącego. Broń oznaczona `offHand` wymaga `offHand` w bloku walki. `fullWhen` (Capability API 1.97) to wartość z arkusza walczącego: powyżej 0 druga ręka tego walczącego zachowuje pełny atrybut niezależnie od `ability`, tak jak styl Two-Weapon Fighting z 5e.

- `floor`: najmniej, ile zadaje trafienie, zapisane wprost lub odczytane ze statystyki liczbowej przedmiotu. Obrażenia w walce pulami po pochłonięciu albo obrażenia w walce sumowanej są do niego podnoszone, zanim odporność zmniejszy je o połowę, a dziennik to odnotowuje. Cios wydający rzuca liczbą swojego wykonawcy i nigdy nie jest podnoszony.
- `onHit`: do czterech twoich stanów, które cel otrzymuje, gdy zadane przez cios obrażenia osiągnęły `atLeast`, na `rounds` jego własnych tur lub, bez tego, dopóki coś ich nie zdejmie. Obrażenia to to, co do niego dotarło po pochłonięciu i odpornościach; cios zabierający odbiera inicjatywę, a nie zdrowie, więc nie nakłada żadnego stanu. Wpis może też zawierać `save: { "save": <save id>, "difficulty": n }`, który cel wykonuje w chwili nakładania stanu, a sukces chroni przed nim, oraz `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, dzięki któremu stan trwa, dopóki posiadacz nie zda tego rzutu obronnego na początku lub na końcu każdej swojej tury albo przy obrażeniach większych od zera (wtedy nie ma `rounds`). Oba liczą się jako rzuty obronne przeciw temu stanowi, a także przeciw magii, gdy broń jest magiczna (Capability API 1.169). Sword of wounding z 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: do trzech dodatkowych wielkości przy każdym trafieniu, każda jako `{ "dice", "flat", "type", "save", "targetIs", "when" }`, rzucana, typowana i redukowana przez odporność osobno (Capability API 1.169). `save` wskazuje własne `difficulty` i `onSuccess` (`half` lub `none`). `targetIs` zadaje ją tylko celowi tych typów stworzeń lub z tymi tagami (zobacz Typy stworzeń i testy celu). `when: "critical"` zadaje ją tylko przy trafieniu krytycznym; kości każdej klauzuli są przy trafieniu krytycznym podwajane tak jak kości broni. Javelin of lightning to `{ "dice": "4d6", "type": "lightning" }`; dragon slayer to `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; sword of sharpness to `{ "flat": 14, "type": "slashing", "when": "critical" }`. Prognoza liczy klauzulę tylko przeciw celowi, którego dotyczy, i nigdy nie liczy klauzuli działającej wyłącznie przy trafieniu krytycznym. `when: "toggled"` zadaje ją tylko wtedy, gdy przełącznik przedmiotu jest włączony (Capability API 1.170, zobacz niżej `toggle`).

Szczegóły broni i wiersz dla Mistrza Gry podają to wszystko: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` i `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

### Pancerz i efekty założonych przedmiotów w walce

Działanie przedmiotu założonego lub niesionego może też zmieniać walkę (Capability API 1.56) dla jego posiadacza, obok jego stanów i poziomów. Każde przyjmuje te części stanu, które odczytuje walka:

- `effects`: dowolne efekty stanu oprócz pięciu, których nie może mieć poziom (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), ponieważ nikt nie nałożył przedmiotu na posiadacza i przedmiot nigdy nie kończy działania sam: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` i pozostałe.
- `modifiers`: zmiany `to` obrony, ataków i szybkości, a także testów i rzutów obronnych, dokładnie jak w stanie; w walce `dice-pool` zmiana ataków to stała liczba kości, tak jak w stanie.
- `resist`, `vulnerable` i `immune`: rodzaje obrażeń, z których posiadacz otrzymuje połowę, podwójną wartość lub nic, tak jak u stworzenia (i sprawdzane względem `combat.damageTypes`, jeśli jakieś deklarujesz). `conditionImmunities`: twoje własne stany, które nigdy nie są nakładane na posiadacza.

Przeklęty pierścień wdowy z Gravewatch kosztuje jedną kość przy każdym ataku, powiązany Dawn bell chroni posiadacza przed stanem Rattled, a niesiony kamień drogowy z Ember Roads chroni przed żarem:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Walka odczytuje każdy przedmiot raz, pod nazwą stosu ("Widow's ring" obok rzutu w dzienniku i przy obronie), tak jak test; `otherwise` niespełnionego wymagania liczy się także w walce, więc pancerz zbyt ciężki dla noszącego może kosztować szybkość. Szczegóły przedmiotu i wiersz dla Mistrza Gry podają to wszystko ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Pancerz, który po prostu dodaje do obrony lub pochłaniania, to statystyka przedmiotu odczytywana przez `itemStat` (zobacz Przedmioty w arkuszu), tak jak Guard w Ember Roads odczytuje założony płaszcz.

**Twardość.** Gdy inicjatywa jest liczbą przesuwaną atakami, `combat.pool.hardness` to twardość walczącego, odczytywana z jego arkusza na początku walki (twardość jego pancerza, przez `itemStat`), a stworzenie podaje własne `hardness`. Cios wydający, którego kości są poniżej tej wartości, trafia i nic nie robi: liczba wykonawcy i tak wraca do wartości bazowej, dziennik to odnotowuje ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), a menu nie prognozuje dla niego obrażeń. Może ją mieć tylko zestaw zasad ze stylem wydającym, a stworzenie zapisane jako arkusz bierze ją z arkusza.

<a id="using-items-in-a-fight"></a>

### Używanie przedmiotów w walce

Przedmiotu można użyć w walce (Capability API 1.59): okład przyłożony do rany, wypity tonik, dzwonek, w który się dzwoni. Jego `use` określa działanie użycia słowami `mechanics` wpisu katalogu (zobacz [Co walka odczytuje z `mechanics`](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` lub `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, a od Capability API 1.174 także `concentration` i `zone`, ze zużywanym `budget` albo `free`. Okład z Ember Roads oraz rozgrzewający tonik i dzwonek świtu z Gravewatch:

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Użycie jest w menu walki w grupie **Items** (przedmioty), pod nazwą przedmiotu ("Poultice"), niezależnie od nazwy stosu. Przedmiotu zajmującego miejsca lub wymagającego powiązania używa się, gdy jest założony (i powiązany, jeśli tego wymaga), jak dzwonka; każdego innego – gdy jest niesiony.
- Zużywa budżet albo jest `free` i płaci samym sobą: `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` i `rider` są dla wpisu katalogu w arkuszu, a w użyciu są odrzucane.
- `toHit` w użyciu z `attackRoll` to dodatek do trafienia, wyrażany tak jak `toHit` broni (zobacz Broń w walce): atrybuty, umiejętność, premia oraz, w walce pulami, próg pojedynczej kości. Bez tego rzut niczego nie dodaje.
- `saveDifficulty`: liczba, przeciw której wykonuje się wymagany rzut obronny (własny, kończący nakładany stan lub składnika bez `difficulty`), zapisana wprost lub odczytana ze statystyki liczbowej przedmiotu. Wpis w arkuszu odczytuje tę liczbę ze źródła swojego katalogu; przedmiot go nie ma, więc podaje własną.
- `consumes: true` odejmuje jedną sztukę ze stosu przy każdym użyciu, a menu podaje, ile zostało. Ostatnia użyta sztuka zabiera ze sobą stos.
- `restore` (Capability API 1.60) przywraca część puli każdego arkusza, na który trafia, tak jak worek krwi przywraca krew: `{ "pool": "resolve", "amount": { "flat": 1 } }`, z `dice` i `flat` jak w `amount`. Wskazuje jedną z twoich bieżących pul, nigdy pulę zdrowia (zdrowie wraca przez leczenie), i występuje w użyciu pomocnym: `heal` lub `buff`. Stworzenie nie ma pul, więc nic nie otrzymuje. Dziennik to odnotowuje ("Ada gets back 1 Resolve, and is on 3 of 4."), a członek drużyny prowadzony przez Engine nie rusza pełnej puli. Rozgrzewający tonik z Gravewatch przywraca punkt Resolve obok leczenia.
- `charges` zużywa tyle własnych `charges` przedmiotu, których `max` to pojemność, od 1 do 100, zapisana wprost lub odczytana ze statystyki liczbowej przedmiotu (przedmiot, którego ta statystyka wynosi mniej niż 1, jest odrzucany, a powyżej 100 mieści 100). Liczba jest przechowywana na stosie przedmiotu w ekwipunku, więc dzwonek użyty dwa razy w jednej walce ma w następnej jeden ładunek, a dzwonek, którego nikt nie użył, jest pełny. Ładunki należą do jednego przedmiotu, więc przedmiot, który je ma, ma `stack` równe 1. Użycie albo zużywa przedmiot, albo wydaje ładunki, nigdy oba naraz, a ładunki przedmiotu zawsze wydaje jego użycie. Dochodzą dwa klucze `charges` (Capability API 1.61), takie jak w dzwonku świtu z Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: które z twoich `rests` przywracają ładunki i ile: `"max"` napełnia przedmiot, a ilość (`{ "dice": "1d6", "flat": 1 }`) przywraca tyle, nigdy ponad `max`. Odpoczynek przywraca ładunki każdego niesionego przez postać przedmiotu, który go wskazuje, niezależnie od tego, czy uruchamia go przycisk odpoczynku w arkuszu, czy `[sheet: op="rest"]` Mistrza Gry; arkusz i torba są zapisywane razem, a ponownie wygenerowana odpowiedź odnawia ładunki tylko raz. Arkusz podaje, co wróciło po odpoczynku ("Dawn bell 3/3 charges"), a Mistrz Gry widzi pozostałe ładunki każdego przedmiotu obok niego w ekwipunku ("2 of 3 charges left").
  - `breaksOn`: gdy użycie wydaje ostatni ładunek, Engine rzuca kością d`die`, a przy wyniku nie większym niż `atMost` przedmiot się niszczy i znika z torby, w walce i poza nią. Dziennik walki to odnotowuje ("Dawn bell breaks (a 1 on its die)."), raport przycisku Use również ("Its last charge spent, it breaks."), a dziennik przygody liczy go jako utracony.

- `gate` (Capability API 1.62) to test, który użytkownik musi zdać, zanim przedmiot zadziała, tak jak zwój z zaklęciem powyżej poziomu czytającego wymaga testu. `check` wskazuje, czym się rzuca: `{ "skill": "ward" }`, `{ "ability": "wits" }` albo wartość z arkusza (`{ "value": { "derived": "spell_mod" } }`, dla liczby różnej u każdej postaci, jak modyfikator rzucania zaklęć u czarującego w 5e). `difficulty` wynosi od 1 do 100, zapisane wprost lub odczytane ze statystyki liczbowej przedmiotu (przedmiot, który jej nie daje, nie pojawia się w menu, a jego przycisk Use mówi to wprost). `unless` pomija test, gdy wartość w arkuszu użytkownika wynosi co najmniej `atLeast`. Nieudany test zużywa przedmiot (lub wydaje jego ładunki) na nic. W walce test jest rzucany w chwili wydania przedmiotu, kośćmi samej walki (pulą w walce pulami, gdzie `difficulty` to wymagane sukcesy) i z wartością arkusza odczytaną na początku walki, a liczy się to, co stany i założone przedmioty użytkownika dodają do tego testu, w tym modyfikatory samej umiejętności. Dziennik to odnotowuje ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). Ma go stronica litanii czuwania z Gravewatch:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

To, co walka zużywa, i pozostawione ładunki są zapisywane w ekwipunku przy każdym kroku, tak jak strzały broni, a dziennik przygody podaje, co zużyto. Dziennik walki podaje każde użycie ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Członek drużyny prowadzony przez Engine leczy tylko kogoś rannego, a nikt nie używa przedmiotu do uderzenia w odchodzącego. Szczegóły przedmiotu i wiersz dla Mistrza Gry podają działanie użycia: "Use (Action): heals 1d4 + 1, range 0 paces, used up" i `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, a szczegóły pokazują pozostałe ładunki. Przedmiot wymyślony przez Mistrza Gry przez `like=` na wzór jednego z twoich jest używany tak jak tamten, łącznie z ładunkami.

### Przedmioty w bitwach Classic i Tactical

Zestaw zasad, który nie rozstrzyga własnych walk, zostawia je bitwom Classic i Tactical trybu Game Mode, w których na początku walki model jest pytany, co robią przedmioty z ekwipunku. Działanie twoich przedmiotów nie jest zgadywane: każdy z `use` robi to, co tam zapisano, na liczbach samego Engine, a Mistrza Gry pyta się tylko o przedmioty, które nie są twoje (i o żadne przy `native: false`).

- `heal` leczy, a `attack` rani o część maksymalnego zdrowia celu wyznaczoną ze średniej `amount`: średnia 7, czyli `1d8+3` podstawowej broni, to nieco ponad jedna piąta, nigdy mniej niż jedna dwudziesta i najwyżej całość. W tej skali pomost walki odczytuje liczby wpisu katalogu. `damageType` jest żywiołem.
- Pierwszy stan w `applies` jest nakładany jako status pod własną nazwą, na swoje `rounds` (2, jeśli ich nie podano), a `buff` lub `debuff` to sam ten status, który podnosi lub obniża obronę jak własne statusy Engine.
- `targets` określa, na kim się go używa. Bez tego leczenie lub wzmocnienie trafia do sojusznika, a atak lub osłabienie – do wroga.
- `consumes: true` odejmuje jedną sztukę ze stosu, a użycie bez tego zostawia przedmiot na miejscu.
- Rzut na trafienie, rzut obronny, obszar, punkty tymczasowe i przywracana pula nie mają miejsca w tych bitwach, tak jak `mechanics` wpisu katalogu: opis przedmiotu w menu nadal je podaje.
- Przedmiot zajmujący miejsca jest używany tylko wtedy, gdy jest założony, a wymagający powiązania – tylko gdy jest powiązany, tak jak w walce według zestawu zasad. Przedmiot zużywany jest zabierany z rzeczy założonych, nigdy z zapasowej sztuki w torbie.
- Przedmiot, którego użycie wydaje `charges`, jest oferowany, dopóki zostało jakieś użycie, a menu Items liczy jego użycia. Każde użycie wydaje je ze stosu przedmiotu, najpierw z własnego stosu gracza, a ostatni wydany ładunek rzuca jego `breaksOn`: zniszczony przedmiot znika z torby, a dziennik przygody liczy go jako utracony.
- Test przedmiotu, który go najpierw wymaga (`gate`), jest rzucany na serwerze, gdy przedmiotu używa członek drużyny, z arkuszem tego członka i tym, co ma na sobie (towarzysz bez własnej karty rzuca na pustym arkuszu, a tylko własna jednostka gracza korzysta zastępczo z karty gracza), tak jak rzuca go przycisk Use, i pomijany, gdy spełnione jest `unless`. Po porażce przedmiot (lub jego ładunki) zostaje wydany i nic nie robi, a dziennik to odnotowuje: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Przedmiot bez `use` nie jest oferowany w tych bitwach, podobnie jak leczenie bez `amount`.

Engine sam oblicza działanie każdego przedmiotu, więc to, co wysyła ekran, nigdy nie decyduje o działaniu twojego przedmiotu.

### Łupy

Wygrana walka daje łupy w każdej grze w trybie Game Mode, jednorazowo, do toreb drużyny. Bez zestawu zasad pochodzą z własnych tabel trybu Game Mode (więcej i rzadszych w trudniejszej grze); tak samo jest w zestawie, który nie deklaruje tabel łupów i zostawia włączone `native`. Zestaw deklarujący tabele łupów daje zamiast tego własne przedmioty, a zestaw z `native: false` i bez tabel nie daje nic.

Wymienia je `lootTables` w bloku `items` (Capability API 1.63), tak jak dary grobowe z Gravewatch:

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` to liczba losowań z tabeli: liczba od 0 do 20 lub kości (`"1d2"`), domyślnie 1.
- Każde losowanie wybiera jedną pozycję według `weight` (domyślnie 1) względem pozostałych. Pozycja wskazuje jeden z twoich przedmiotów jako `<catalog>/<entry>`, `filter` według `rarity`, `category` i `tag`, który losuje równo spośród wszystkich pasujących przedmiotów, albo (Capability API 1.64) `coins`, jedną z twoich monet według identyfikatora. `count` to liczba sztuk, liczba lub kości, domyślnie 1. Przedmiot lub moneta usunięte przez warstwę nic nie dają; tak samo filtr, który niczego nie znajduje.
- Stworzenie z bestiariusza wskazuje swoją tabelę przez `loot` (zobacz niżej Stworzenia). Wygrana walka według zestawu zasad losuje z tabeli każdego pokonanego stworzenia, a walka, której Engine nie rozstrzyga według twoich zasad, nie ma stworzeń z bestiariusza, więc nic nie daje.
- Łupy trafiają do wspólnego widoku tak jak dodanie przedmiotu, najpierw do torby gracza, a to, czego nikt nie uniesie, zostaje na miejscu. Podsumowanie otrzymywane przez Mistrza Gry podaje, co wypadło i że jest już w torbach; dziennik przygody to odnotowuje, a powiadomienie to pokazuje.
- Mistrz Gry losuje z tabeli w opowieści przez `[loot: table="grave_goods" who="Ada"]` (`who=` dla torby jednej postaci), mierzone od początku tury jak jego znaczniki ekwipunku, więc ponownie wygenerowana odpowiedź daje łupy raz. Każdy wypadający przedmiot otrzymuje odpowiedź jak przy dodaniu, a instrukcje tej komendy wymieniają twoje tabele.

### Pieniądze

Twoje `currencies` to pieniądze drużyny. Moneta jest przedmiotem w torbach, stosem każdej monety jak każdy inny, nazwanym jej `label`:

- Waży jedną jednostkę twojej statystyki udźwigu na każde `perWeight` monet swojej rodziny, liczy się do obciążenia posiadacza i przy otrzymaniu jest rozmieszczana według reguły noszenia. Rodzina bez `perWeight` nic nie waży.
- Gracz dodaje monety z listy **Coins** (monety) w selektorze, a dzieli, przekazuje i łączy je jak każdy stos.
- Wiersz nad stosami ekwipunku pokazuje widoczne monety każdej rodziny i ich wartość w najmniejszej monecie rodziny. Mistrz Gry widzi tę wartość obok każdej torby (`Coin worth 432 pennies` albo `no coins` dla pustej sakiewki, przy czym torba gracza jest wymieniana nawet wtedy, gdy nic nie zawiera), a `cost` przedmiotu obok przedmiotu (`costs 3 shillings`).
- Mistrz Gry płaci przez `[inventory: action="pay" amount="3 shillings" who="Ada"]` i otrzymuje zapłatę przez `action="earn"`. `amount` to liczba i moneta, przez identyfikator lub etykietę, w liczbie pojedynczej lub mnogiej, bez względu na wielkość liter (`1 penny`, `12 pennies`). Płatność pochodzi z jednej torby (gracza, bez `who=`) i tylko z rodziny danej monety: najpierw idą największe pasujące monety, potem rozmieniana jest najmniejsza pozostała moneta pokrywająca resztę należności, a reszta wraca w mniejszych monetach rodziny, od największych. Odpowiedź podaje, co zapłacono i co wróciło: 3 szylingi z sakiewki z jedną koroną to `Paid with crowns ×1; shillings ×2 back.` Płatność, której torba nie pokryje, jest odrzucana (`cannot-afford`), tak samo moneta, której nie masz (`unknown-coin`), i każda płatność w zestawie bez walut (`no-currencies`). Zarobek to dodanie tej monety do torby `who` albo rozdzielenie jej według reguły noszenia. Dziennik przygody wymienia wydatki i zarobki, a powiadomienie je pokazuje. Instrukcje tych komend wymieniają twoje monety i dostaje je tylko zestaw zasad, który jakieś ma.
- Zakup to płatność, a potem dodanie przedmiotu albo, w zestawie z targiem, `buy` (niżej). Nie ma ekranu sklepu.

### Początkowy sprzęt

`items.startingGear` (Capability API 1.78) wymienia sprzęt, który postać może na początku wziąć do torby: komplet klasy, pochodzenia, powołania. Nigdy nie jest przyznawany sam z siebie. Ekwipunek pokazuje wiersz **Starting gear** (początkowy sprzęt), a gracz wybiera komplet sprzętu, opcję dla każdego z jego wyborów i przedmiot z każdej listy, a potem bierze go do swojej torby lub do torby członka drużyny. Sprzęt, do którego pasuje arkusz postaci (`fits`), jest wymieniany najpierw, a po nim sprzęt bez `fits` (dla każdej postaci, np. komplet pochodzenia); oferowany jest każdy komplet, bo koncepcję postaci uzgadniają gracz i Mistrz Gry.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Pozycja to jeden z przedmiotów zestawu (`item`), monety (`coins`, identyfikator jednostki), jeden przedmiot wybierany przez gracza ze stałej listy (`oneOf`, od 2 do 48 przedmiotów) albo zwykły przedmiot według nazwy (`name`, tam, gdzie `freeform` dopuszcza zwykłe przedmioty; podlega regułom etykiety, więc bez nawiasów, `{{` i nowych linii). `count` wynosi od 1 do 999; `equip: true` zakłada przedmiot w chwili wzięcia, jeśli jego miejsca są wolne, więc pancerz liczy się od początku.
- `choices` to od 0 do 8 wyborów, każdy z od 2 do 6 opcjami złożonymi z własnych pozycji.
- `group`: sprzęt, który postać bierze raz z każdej grupy (komplet klasy i komplet pochodzenia). Ponowne wzięcie tej samej grupy to wybór, którego gracz dokonuje w oknie dialogowym, i dodaje do tego, co już jest w torbie. Sprzęt bez grupy stanowi własną grupę, nigdy tożsamą z grupą o tej samej nazwie.
- `fits` odczytuje arkusz bez stanu bieżącego, tak jak noszenie. Wpływa tylko na kolejność listy.
- Wzięcie jest typu wszystko albo nic: sprzęt zbyt ciężki dla niosącego jest odrzucany w całości, a okno dialogowe podaje jego wagę w porównaniu z tym, co niosący może jeszcze unieść. Przedmiot usunięty z gry przez warstwę jest pomijany i wymieniany z nazwy, podobnie jak lista, której wszystkie przedmioty warstwa usuwa; monety rodzaju usuniętego przez warstwę są wypłacane w największej pozostałej monecie o tej samej wartości, a okno dialogowe tak je pokazuje. Sprzęt, z którego nic nie zostało, jest odrzucany, więc nigdy nie jest oznaczany jako wzięty na próżno. Usługa nigdy nie jest oferowana z listy.
- Import sprawdza każdy przedmiot (w katalogu wewnątrz definicji; katalog we własnym pliku jest sprawdzany przy wzięciu sprzętu), monetę, zwykły przedmiot i odwołanie `fits`, odrzuca usługę i odrzuca liczbę, która wymagałaby więcej stosów, niż torba mieści naraz.

### Targi

`market` w bloku `items` (Capability API 1.65) określa, co sprzedaje miejscowość i za jaką cenę, zamiast tego, by każdy sklep sprzedawał wszystko po cenie katalogowej. Oto targ z Gravewatch, nieco skrócony:

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: od jednego do ośmiu poziomów, każdy będący mnożnikiem (`times`, powyżej 0) `cost` przedmiotu, a jeden z nich jest `default`. Cena to koszt w najmniejszej monecie rodziny pomnożony przez poziom i zaokrąglony w tej monecie (nigdy poniżej jednej monety dla czegoś, co cokolwiek kosztuje), podawany w monecie, w której zapisano koszt, jeśli ta moneta pokrywa go dokładnie, a w przeciwnym razie w największej monecie pozostawionej przez twoje warstwy, która to potrafi: przy `dear` płaszcz kosztujący 8 szylingów kosztuje 12 szylingów, a mikstura z 5e za 50 gp kosztuje 50 sztuk złota, nigdy 5 sztuk platyny. Targowanie się lub humor sprzedawcy zmieniają poziom, nigdy liczbę.
- `places`: od jednej do dwunastu wielkości miejscowości, od najmniejszej, twoimi słowami.
- `sold`: reguły określające najmniejszą miejscowość sprzedającą to, co wybiera filtr. Filtr wskazuje `rarity`, `category` i `tag`, dowolne z nich, i pasuje do przedmiotu, który ma wszystkie wskazane; decyduje pierwsza reguła pasująca do przedmiotu. Własne `sold` przedmiotu ma pierwszeństwo przed regułami, a przedmiot, którego nic nie wskazuje, jest sprzedawany wszędzie.
- `sellers`: rodzaje sprzedawców, każdy z tym, co sprzedaje (`sells`: filtry, z których każdy może wybrać przedmiot), najmniejszą miejscowością (`place`), w której występuje (bez tego – wszędzie), i opcjonalnie tym, komu sprzedaje wyłącznie (`only`): wartość z arkusza kupującego, uwzględniająca jego bieżący stan i niesione rzeczy, wynosząca co najmniej `atLeast`, przekazywana Mistrzowi Gry jako `label`. Bez `sellers` każdy w danej miejscowości sprzedaje wszystko, co ta miejscowość sprzedaje.
- Przedmiot bez `cost` nie jest na sprzedaż, podobnie jak przedmiot ukryty przez warstwę lub taki, którego monety warstwa usunęła.

**Gdzie jest drużyna.** Mistrz Gry podaje miejscowość sceny i jej wielkość przez `[place: name="Millbrook" size="market town"]`, wielkość przez identyfikator lub etykietę, a pomija wielkość dla miejsca bez targu (droga, dzicz). Engine odpowiada na każdy znacznik na miejscu, odrzucając wielkość, której nie masz, a ostatnia miejscowość, na którą odpowiedział we własnych odpowiedziach widocznych dla gracza, licząc od najnowszego początku rozmowy, obowiązuje, dopóki nie padnie inna. Znacznik miejscowości wpisany przez gracza nigdy się nie liczy. Ponownie wygenerowana odpowiedź odczytuje tylko to, co było przed zastępowaną wypowiedzią.

**Kupowanie.** Mistrz Gry kupuje przez `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, przy czym `level` (bez niego domyślny) i `seller` (bez niego dowolny tutejszy sprzedawca, który sprzedaje przedmiot) są opcjonalne. Engine wycenia przedmiot w miejscowości obowiązującej na końcu odpowiedzi, pobiera cenę z sakiewki kupującego (gracza, bez `who=`) tak jak płatność, z resztą, i wkłada przedmiot do jego torby albo tylko płaci za usługę. Albo dzieje się jedno i drugie, albo nic. Odpowiedź podaje koszt (`price="12 shillings"`) oraz to, co zapłacono i wydano jako resztę, a powiadomienie to pokazuje. Zakup jest odrzucany i niczego nie zmienia, gdy nie podano miejscowości (`no-place`), gdy nie masz takiego poziomu, przedmiotu lub sprzedawcy (`unknown-level`, `unknown-item`), gdy brak ceny (`not-for-sale`), gdy miejscowość jest za mała na ten przedmiot (`not-here`), gdy nikt tutaj go nie sprzedaje (`no-seller`), gdy kupujący nie spełnia `only` sprzedawcy (`not-to-you`), gdy sakiewka nie wystarcza (`cannot-afford`) albo gdy torba go nie uniesie.

**Co widzi Mistrz Gry.** Gdy scena rozgrywa się w miejscowości z targiem, blok MARKET podaje miejscowość i jej wielkość, poziomy cen oraz każdego tamtejszego sprzedawcę z tuzinem sprzedawanych rzeczy w domyślnej cenie, od najtańszych; wszystko, co sprzedaje, można kupić po nazwie. Jego instrukcje uczą `[place:]` i `buy`, a ma je tylko zestaw zasad z targiem.

#### Dzień targowy

Dzień targowy (Capability API 1.69) sprawia, że towar w miejscowości zmienia się i wyczerpuje, a drużyna może odsprzedawać rzeczy. Oto dzień targowy z Gravewatch, nieco skrócony:

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **Dzień.** Dzień w miejscowości trwa, dopóki Mistrz Gry nie wskaże innej miejscowości; nowy dzień w tej samej miejscowości zaczyna, podając ją ponownie z `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Wszystko poniżej oblicza się dla każdego dnia z odpowiedzi Mistrza Gry widocznych dla gracza, więc swipe, ponownie wygenerowana odpowiedź ani gałąź nie wymagają niczego zapisanego, a dany dzień zawsze losuje ten sam towar.
- **`limited`** w regule `sold` lub własnym `sold` przedmiotu: ile sztuk miejscowość ma do sprzedania w ciągu dnia, liczba lub kości rzucane na dany dzień. Reguła może podać limit bez miejscowości (sprzedawane wszędzie, po kilka sztuk); miejscowość przedmiotu pochodzi z pierwszej reguły wskazującej miejscowość, a limit z pierwszej wskazującej limit. Gdy zostaną wykupione, zakup jest odrzucany (`sold-out`) aż do nowego dnia.
- **`stock`** u sprzedawcy: jedna z twoich tabel łupów, losowana raz dziennie, określająca, co sprzedawca ma w zapasie oprócz tego, co zwykle sprzedaje. To, co wylosuje (tylko przedmioty, nigdy monety), sprzedaje wyłącznie ten sprzedawca, w wylosowanej liczbie, niezależnie od `sells` i `sold`; `only` sprzedawcy nadal obowiązuje.
- **`buyBack`**: część (powyżej 0, najwyżej 1) domyślnej ceny przedmiotu, którą płaci za niego sprzedawca. Kupuje go tutejszy sprzedawca handlujący takimi rzeczami (bez sprzedawców – ktokolwiek). Bez `buyBack` nikt niczego nie odkupuje.
- **`purse`** przy wielkości miejscowości: najwięcej, ile jej sprzedawcy łącznie wypłacają w ciągu dnia, w jednej z twoich monet. Liczą się do tego sprzedaże opłacane w rodzinie tej monety; bez sakiewki sprzedawcy kupują bez limitu.
- **Sprzedawanie.** Mistrz Gry sprzedaje przez `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. Engine wycenia przedmiot, wyjmuje go z torby sprzedającego (gracza, bez `who=`; nigdy powiązanego przeklętego przedmiotu) i wpłaca monety, od największych, albo odmawia i niczego nie zmienia, gdy nie podano miejscowości, nikt tutaj tego nie kupuje (`not-bought`), brak ceny (`not-for-sale`), dzisiejsza sakiewka jest wyczerpana (`purse-spent`), nikt nie ma przedmiotu albo torba nie uniesie monet. Odpowiedź podaje uzyskaną kwotę (`price="4 shillings"`), dziennik przygody odnotowuje sprzedaż, a powiadomienie ją pokazuje.
- Blok MARKET dodaje, co każdy sprzedawca ma dziś w zapasie, ile zostało przedmiotów o ograniczonej liczbie oraz ile płacą tutejsi sprzedawcy i ile zostało z dzisiejszej sakiewki; jego instrukcje uczą `sell` i `day="new"`.

#### Uczciwi i nieuczciwi sprzedawcy

Capability API 1.79 pozwala, by przedmiot był ryzykowny lub był podróbką, a sprzedawca – nieuczciwy.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** w przedmiocie: przed czym uczciwy sprzedawca ostrzega przed sprzedażą. Blok MARKET wymienia to z "(warn the buyer first: ...)" obok towaru uczciwego sprzedawcy; nieuczciwy sprzedawca nic nie mówi.
- **`passesFor`** w przedmiocie czyni go podróbką innego przedmiotu (`<catalog>/<entry>`): prawdziwego przedmiotu tej samej kategorii, który można sprzedać, zakładanego w tych samych miejscach i wiążącego się, jeśli wiąże się podróbka. Jest sprawdzane przy imporcie, gdy oba są czytelne, przy instalacji dla każdego pliku katalogu i ponownie, gdy targ ją oferuje, więc podróbka, której przedmiot docelowy nie istnieje lub jest ukryty przez warstwę, nigdy nie jest sprzedawana. Przeklęty przedmiot (`binds.cursed`) ani podróbka nigdy nie są wśród niczyich towarów ani w zapasie uczciwego sprzedawcy.
- **`honest: false`** u sprzedawcy: podróbka wylosowana przez jego tabelę `stock` jest oferowana jako przedmiot, który udaje, po cenie tego przedmiotu, a blok MARKET pokazuje obok niej prawdę Mistrzowi Gry. Zakup wskazujący tego sprzedawcę i ten przedmiot daje podróbkę; zakup bez wskazania sprzedawcy nigdy jej nie daje.
- **Podróbka w torbie** wygląda jak przedmiot, który udaje, wszędzie tam, gdzie patrzy gracz (torba, dziennik przygody, powiadomienia, walki), i zachowuje to, czym naprawdę jest. Blok ekwipunku dla Mistrza Gry oznacza ją `[FAKE: really ...]` i prosi, aby nadal nazywał ją tak, jak jest pokazywana.
- **Wykrycie**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, związanie (dostrojenie ujawnia klątwę), użycie (dzieje się to, co naprawdę robi; gdy według zasad nic się nie dzieje, mówi o tym Mistrz Gry) albo sprzedaż uczciwemu kupcowi, który mówi, czym przedmiot naprawdę jest, i płaci tyle, ile jest wart (jego własne `cost`), albo odmawia, gdy przedmiot go nie ma. Nieuczciwy kupiec bierze podróbkę za to, czym się wydaje. Od tej chwili jest swoim prawdziwym przedmiotem.
- **Założona lub niesiona**: podróbka robi na arkuszu postaci to, co naprawdę robi (jej efekty `worn` lub `carried` i statystyki). Pierwsza zmiana ekwipunku, po której arkusz pokazuje liczbę lub dodatek do testu, jakich nie dałby udawany przedmiot, ujawnia ją, a dziennik przygody i ekran podają, czym była. Różnica odczytywana tylko w walce (odporność) jej nie ujawnia, podobnie jak sama zmiana arkusza aż do następnej zmiany ekwipunku. W walce założona podrobiona broń nadal atakuje jak broń, którą udaje.
- W trybie zaufania dla jednego gracza Peek Prompt pokazuje widok Mistrza Gry, łącznie z prawdą.

<a id="using-items-outside-a-fight"></a>

### Używanie przedmiotów poza walką

To samo `use` działa poza walką (Capability API 1.60 dla `restore`; reszta nie wymaga niczego nowego). Przycisk **Use** w ekwipunku, na twoim przedmiocie z `use`, oraz `[inventory: action="use" item="Poultice" who="Juno"]` Mistrza Gry wykonują działanie przedmiotu na tym, kto go niesie, kośćmi Engine:

- Leczenie przywraca zdrowie: ilość w puli zdrowia albo jeden usunięty znacznik na torze ran, tak jak leczenie w walce. Punkty `temporary` trafiają do puli zdrowia, `restore` przywraca swoją pulę, a każdy stan z `applies` zostaje nałożony, dopóki coś go nie zdejmie.
- Użycie raniące lub wymierzone w drugą stronę (`kind` `attack` lub `debuff` albo `targets` `enemy`) nikogo nie trafia: poza walką na planszy nie ma nikogo do trafienia. Przedmiot i tak zostaje użyty, a Mistrz Gry dowiaduje się, co robi, aby to opisać.
- Odejmuje jedną sztukę ze stosu lub wydaje ładunki dokładnie tak jak walka, a przedmiot bez pozostałych ładunków albo zajmujący miejsce lub wymagający powiązania i niezałożony jest odrzucany i niczego nie zmienia. Arkusz i torba są zapisywane razem.
- Najpierw rzuca się `gate`, tak jak test: kośćmi zestawu zasad, z wartością z arkusza, karą za rany użytkownika i działaniem jego stanów oraz przedmiotów założonych lub niesionych na ten test. Nieudany zużywa przedmiot na nic, a wiersz to odnotowuje ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

To, co się stało, podaje jeden wiersz: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Przycisk Use wysyła go Mistrzowi Gry w bloku `[item_used]` po "I use my Poultice.", który czat pokazuje jako plakietkę; na własny znacznik Mistrza Gry odpowiada się tym wierszem, mierzonym od początku tury jak jego inne znaczniki, więc ponownie wygenerowana odpowiedź nigdy nie użyje przedmiotu dwa razy. Przedmiot bez `use` albo w grze bez zestawu zasad jest nadal po prostu opisywany: "I use my rope."

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

Powyższy blok `battle` udostępnia walce liczby z karty, pozostawiając matematykę Marinara. Opcjonalny blok `combat` służy do czegoś innego: określa, jak twoje zasady ROZSTRZYGAJĄ walkę. Parametryzuje należący do Engine rodzaj walki, tak jak `resolution` parametryzuje rodzaj testu; wszystkie nazwy w nim należą do ciebie. Istnieją dwa rodzaje: `attack-vs-defense`, w którym kości są sumowane i porównywane z liczbą, oraz `dice-pool`, w którym walka rzuca własnymi pulami twojego zestawu `dice-pool` i liczy sukcesy (zobacz niżej Walka rzucana pulami).

**Gra, której zestaw zasad deklaruje `combat`, prowadzi walki według twojego bloku.** Liczby drużyny są odczytywane z jej własnych kart, przeciwnicy pochodzą z twojego bestiariusza lub skali zagrożenia, każdą turę rozstrzygają twoje kości, a wszystkie wydatki i straty postaci są natychmiast zapisywane na jej karcie, więc zamknięcie zakładki w trakcie walki niczego nie gubi. Ekran bitwy używa twoich słów: twoje ataki i zdolności w menu, twoje budżety, twoje stany i dziennik z rzeczywistymi obliczeniami. To, czego jeszcze nie robi, opisano w sekcji "Jeszcze niedostępne".

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

- `kind`: `"attack-vs-defense"` (jedna strona rzuca kośćmi przeciw obronie drugiej; trafienie zadaje obrażenia) lub `"dice-pool"` (zobacz Walka rzucana pulami). Każdy z poniższych kluczy znaczy to samo w obu rodzajach i jest odczytywany tak, jak dany rodzaj odczytuje liczby.
- `health`: wymagane. To, co zabiera walka. Albo `{ "pool": "grit" }`, bieżąca pula pomniejszana liczbowo, której bufor tymczasowy, jeśli istnieje, pochłania obrażenia jako pierwszy; albo `{ "track": "harm" }`, tor ran, który jest ZAZNACZANY. Tor wymaga obok `damageKinds` i nie przyznaje punktów tymczasowych.
- `defense`: wymagane, odwołanie do wartości. Pole wypełniane przez gracza albo obliczana przez ciebie wartość pochodna.
- `initiative`: wymagane. Kości rzucane raz na początku i opcjonalne odwołanie do modyfikatora. Remis wygrywa wyższy modyfikator, następnie kolejność tworzenia uczestników walki. `"each": "round"` ponownie rzuca inicjatywą wszystkich na początku każdej nowej rundy, z modyfikatorem w jego ówczesnej wartości (więc modyfikator odczytujący tor ran spowalnia po zranieniu), a runda zaczyna się od tego, kto jest pierwszy w nowej kolejności. Capability API 1.47. Walka `dice-pool` może zamiast tego rzucać inicjatywą jako pulą: `pool` (odwołanie do wartości) to liczba kości, a ich sukcesy plus `plus` dają wartość, bez `dice` ani `modifier` obok. `resource`, które wymaga `pool`, zachowuje tę wartość i pozwala atakom ją przesuwać (zobacz niżej "Inicjatywa przesuwana atakami"). Capability API 1.48.
- `attackRoll`: wymagane przy `attack-vs-defense` i odrzucane przy `dice-pool`, który rzuca własnymi pulami rozstrzygania. Kości, informacja, czy system rzuca dwa razy i zachowuje jeden wynik (`advantage`), działanie skrajnych ścian pojedynczej kości (`naturals.max`: `critical`, `hit` lub `none`; `naturals.min`: `miss` lub `none`) oraz wpływ trafienia krytycznego na obrażenia (`critical`: `double-dice` ponownie rzuca kośćmi obrażeń, `max-dice` dodaje raz ich najwyższe wyniki, `none` oznacza zwykłe trafienie). Szczególne wyniki naturalne wymagają jednej kości, dokładnie jak przy testach. Rzuty obronne w walce używają tych samych kości. `criticalFrom` poszerza zakres trafienia krytycznego: to wartość odczytywana z karty atakującego, będąca najniższym naturalnym wynikiem liczonym jako trafienie krytyczne, np. `{ "field": "critical_from" }` dla Championa z 5e, którego karta podaje 19. Jest ograniczana do najwyższej ścianki kości, wartość poniżej 2 oznacza brak zakresu (tylko najwyższa ścianka, jak u postaci, której pole pozostawiono na 0) i wymaga pojedynczej kości z `naturals.max` ustawionym na `critical`. Capability API 1.81.
- `economy`: wymagane. `budgets` określa dostępne elementy tury: identyfikator, etykietę, `per` (`turn` uzupełnia na początku własnej tury posiadacza, `round` na początku nowej rundy) i `count`. PIERWSZY zadeklarowany budżet jest główny i zużywa go akcja standardowa. `movement` to opcjonalne odwołanie do wartości: odległość ruchu w jednej turze, we własnej jednostce odległości. Odczytuje ją walka na planszy (zob. Pozycje).
- `attacks`: opcjonalne. Listy karty, których wiersze są bronią. `name` to kolumna tekstowa nadająca wierszowi nazwę, `damage.dice` to kolumna kości, a każde z `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` i `damage.type` wskazuje kolumnę tej samej listy. Kolumna `ability` to `enum` zawierające identyfikator jednej z twoich cech; inna wartość niczego nie dodaje. Kolumna `proficiency` to `boolean`; gdy jest włączona, dodaje premię z biegłości. Wiersz bez czytelnych kości nie jest atakiem, więc lina na tej samej liście pozostaje liną. `toHit.skill` wskazuje kolumnę `enum` zawierającą identyfikator jednej z twoich umiejętności: wiersz dodaje to, co dodaje test tej umiejętności, z własnym `ability` wiersza zamiast atrybutu umiejętności, jeśli go wskazuje, dokładnie tak jak podmienia go `with=` testu (Capability API 1.47). `strikes` to opcjonalne odwołanie do wartości określające, ile uderzeń kupuje JEDNO zużycie budżetu listy: wybranie wiersza bez uderzeń w zapasie zużywa budżet i daje pozostałe uderzenia, a dopóki zapas istnieje, każdy wiersz deklarujący `strikes` nie kosztuje budżetu. Dzięki temu menu samo pozwala zmienić broń, cel i przejść między nimi. `strikesCappedBy` wskazuje kolumnę logiczną ograniczającą JEJ WŁASNY wiersz do jednego uderzenia, niezależnie od liczby kupowanej przez listę, dla broni strzelającej raz na turę bez względu na liczbę ataków właściciela: powstała dla właściwości Loading z SRD 5.1. Na liście kupującej i tak jedno uderzenie jest bez znaczenia i jest odrzucana. Zapas uderzeń należy do WALCZĄCEGO, nie do jednej listy: postać z dwiema listami broni deklarującymi `strikes` korzysta z tego samego zapasu niezależnie od użytego wiersza. Jest on zerowany na końcu tury, w której go kupiono. Lista bez deklaracji kupuje jedno uderzenie za zużycie budżetu, jak każda walka przed wprowadzeniem tej funkcji.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcjonalne. Listy karty, których wiersze oznaczone katalogiem są zdolnościami, filtrowane przez `onlyWhen` i `alwaysWhen` tak samo jak `battle.skills`. Działanie każdej określa `mechanics` jej wpisu; blok wskazuje domyślny `budget`, dodawane `toHit` dla wpisu z rzutem na trafienie oraz `saveDifficulty`, przeciwko któremu wykonuje się rzut obronny wpisu. Wpis wymagający rzutu obronnego, własnego lub kończącego nakładany stan, jest odrzucany, jeśli lista docelowa nie ma `saveDifficulty`: rzut przeciwko niczemu zawsze byłby udany. Z Capability API 1.108 `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` wybiera odwołania według klasy wiersza. Kleryk 3 / czarodziej 2 może wywieść atak kleryka z biegłości plus Wisdom, a trudność z 8 plus tego ataku, a odpowiednie wartości czarodzieja z Intelligence. Kolumna musi istnieć na liście źródła, a `values` zawiera od 1 do 20 wpisów. Każdy wpis może zastąpić dowolne z odwołań; pominięte odwołanie, brak wartości kolumny lub wartość spoza listy zachowuje własne odwołanie źródła. Walka, podsumowanie wiersza na karcie i podsumowanie dla Mistrza Gry odczytują te same liczby dla każdego wiersza. Zarówno `stamp`, jak i `byColumn` wymagają schemaVersion 2 i capabilityApi 1.108 lub nowszego.
- `standard`: opcjonalne, z zamkniętej listy `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (ataki przeciw unikającemu rzuca się dwa razy i zachowuje gorszy wynik) i `help` (następny atak wspieranego sojusznika rzuca się dwa razy i zachowuje lepszy wynik) są zawsze rozstrzygane. `dash` (ponowny przydział tego samego ruchu) i `disengage` (nikt nie uderza cię za odejście w tej turze) są rozstrzygane na planszy, a poza nią odnotowywane. `hide` i `ready` są akceptowane, ale jeszcze nic nie robią.
- `standardEffects`: opcjonalne, dla części akcji standardowej niewyrażonej jej flagą. Obecnie tylko `dodge` ma taki efekt: `{ "dodge": { "saves": ["dex_save"] } }` określa, które twoje rzuty obronne unikający wykonuje dwa razy z zachowaniem lepszego wyniku przez czas trwania uniku. Wskazuj tylko rzuty zadeklarowane na karcie i tylko gdy lista `standard` zawiera `dodge`. Pominięcie zachowuje dotychczasowe działanie uniku: trudniej trafić i nic więcej.
- `conditions`: opcjonalne. Mapuje TWOJE identyfikatory stanów na ich działanie, dzięki czemu stany karty i walki są jednym zapisem, a zatruta postać pozostaje zatruta po walce. Efekty tworzą zamkniętą listę: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) i `cannot-approach-source`. `failsSaves` wskazuje rzuty obronne automatycznie nieudane w tym stanie. Sześć efektów wymagających odległości lub ruchu (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) odczytuje walka na planszy; poza nią nie działają (zob. Pozycje). `cannot-react` wyklucza posiadacza z okna otwieranego przez ruch, więc nie jest pytany. Obok efektów są cztery dodatkowe klucze:
  - `modifiers`: liczby zmieniane przez stan, dopóki trwa. Zobacz niżej Liczby zmieniane przez stan.
  - `saves`: których rzutów obronnych dotyczą dwa efekty rzutów obronnych i każdy modyfikator rzutów obronnych. Pominięcie oznacza wszystkie; podanie bez żadnego z nich jest odrzucane.
  - `skills`: których umiejętności dotyczą dwa efekty testów i każdy modyfikator testów niewskazujący własnych umiejętności. Pominięcie oznacza wszystkie; podanie bez żadnego z nich jest odrzucane. Testy przeciwstawne w walce rzucają własne testy walki, a nie umiejętności, więc coś zawężonego do umiejętności nigdy do nich nie trafia; odczytuje to test jednej z tych umiejętności poza walką (zobacz niżej Testy poza walką). Capability API 1.53.
  - `whileSourceInSight`: co działa tylko wtedy, gdy osoba nakładająca stan znajduje się w polu widzenia posiadacza. `true` uzależnia cały stan; lista jego własnych efektów uzależnia tylko je, pozostawiając resztę. Tego wymaga strach zabraniający zbliżenia niezależnie od widoczności źródła. Wskazanie efektu nieobecnego w stanie jest odrzucane. Bez planszy nie ma linii widzenia do przerwania, więc wszystko działa w obu przypadkach.
  - `endsWhenSourceDown`: stan znika natychmiast po powaleniu osoby, która go nałożyła.
  - Zmysły (Capability API 1.127): `lacks` stanu wskazuje zmysły, których posiadacz nie ma, a `mechanics.needs` wpisu katalogu lub `needs` akcji stworzenia wskazuje zmysły, które cel musi mieć, aby efekt na niego zadziałał. Dla Deafened z 5e zapisz `"lacks": ["hearing"]`; dla Command zapisz w jego mechanice `"needs": ["hearing"]`. Ogłuszony cel nie pojawia się w menu celów Command. Efekt obszarowy lub wielocelowy wymagający słuchu całkowicie pomija taki cel: bez rzutu obronnego, obrażeń i stanów. Gdy Deafened się skończy, cel znów jest dozwolony. Każda lista ma od jednego do czterech unikalnych identyfikatorów zmysłów, we własnych słowach zestawu; Engine nie zna żadnych nazw zmysłów.
  - Użycie tylko wtedy, gdy pozwala na to karta (Capability API 1.166): `mechanics.usableWhen` wpisu katalogu to `{ "value": <value reference>, "atLeast": n, "atMost": n }` (jedna granica lub obie). W walce wpis jest oferowany, w turze posiadacza lub w oknie reakcji, tylko wtedy, gdy wartość odczytana z karty, stanu bieżącego i przedmiotów posiadacza mieści się w granicach; odczytuje się ją przy każdym rysowaniu menu. Protection z 5e wymaga tarczy w ręce: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. "Bez ciężkiego pancerza" z Rage to to samo z `"atMost": 0` dla liczby ciężkich pancerzy. Stworzenie zapisane jako blok statystyk nie ma karty, więc nic go nie ogranicza.
  - Stany nakładane tylko wtedy, gdy pozwala na to karta nakładającego (Capability API 1.167): wpis `applies` w mechanice wpisu katalogu lub w użyciu przedmiotu może zawierać `"when"` o tej samej postaci co `usableWhen`. Odczytuje się je z karty, stanu bieżącego i przedmiotów tego, kto nakłada stan, w chwili nakładania, a wpis poza granicami jest pomijany; pozostałe nadal działają. Rage z 5e nakłada `raging` i jeden z trzech stanów obrażeń w granicy czterech wpisów: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, a potem `raging_damage_3` z `"atLeast": 9, "atMost": 15` i `raging_damage_4` z `"atLeast": 16`. Nakładający bez karty nakłada każdy wpis. Blok statystyk stworzenia i `onEnd` stanu nie mają karty nakładającego do odczytania, więc `when` jest tam odrzucane. Wymaga schemaVersion 2 i capabilityApi 1.167 lub nowszego.
  - Typy stworzeń i testy celu (Capability API 1.168): `combat.creatureTypes` wymienia, czym może być uczestnik walki, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id": "devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. Stworzenie wskazuje własne `type` i `tags`; typ postaci to wartość pola tekstowego lub wyboru `field`, jeśli jest jednym z typów, a w przeciwnym razie `default` (postacie z 5e to humanoidy). Test celu to `{ "types": [...], "tags": [...] }` i jest spełniony przy dowolnym dopasowaniu; uczestnik walki bez typu i bez tagów nigdy nie pasuje. Umieszcza się go w trzech miejscach: `targetIs` klauzuli obrażeń zadaje tę klauzulę tylko pasującemu celowi (dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, woda święcona: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); `targetIs` wpisu `applies` nakłada ten stan tylko na pasujący cel; a `mechanics.targetTypes: { "is": test, "not": test }` określa, kogo w ogóle można wybrać lub objąć (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Obszar omija każdego, kogo wyklucza `targetTypes`. Prognoza liczy klauzulę `targetIs` tylko przeciw celowi, którego by dotyczyła; zwykła średnia na karcie ją pomija. Panel bitwy i Mistrz Gry widzą typ i tagi każdego uczestnika walki. Wymaga schemaVersion 2 i capabilityApi 1.168 lub nowszego.
  - Zakończenia stanów (Capability API 1.125): Charm Person używa `"endsWhen": ["harmed-by-source-side"]`. Obrażenia większe od zera od tego, kto nałożył stan, lub od kogokolwiek z jego strony albo wymierzenie przez nich w posiadacza ataku, rzutu obronnego lub szkodliwego stanu kończy stan po pełnym rozstrzygnięciu szkodliwej akcji, nawet jeśli atak chybi lub rzut obronny się powiedzie. `"saveWhenDamaged": true` powtarza rzut obronny z tury przy obrażeniach: każde obrażenia większe od zera powtarzają `saveEnds` nakładającej akcji z zapisaną trudnością; sukces kończy stan. Bez zapisanego rzutu obronnego lub trudności nic nie jest rzucane. Hypnotic Pattern używa `"endsWhen": ["damaged"]` i `"shakeOff": { "budget": "action" }`: dowolne obrażenia większe od zera natychmiast go kończą, a inny uczestnik walki po stronie posiadacza może w swojej turze wydać ten budżet, aby go zakończyć. `shakeOff.reach` jest w jednostce odległości zestawu i domyślnie wynosi jedno pole; bez planszy żadna odległość nie jest mierzona. Ekonomia musi deklarować ten budżet. `endsWhen` ma jeden lub dwa unikalne wpisy. Te klucze nie zmieniają zakończeń przy upadku źródła i przy końcu koncentracji. Dla rzutu obronnego wykonywanego tylko przy obrażeniach większych od zera, nigdy na początku ani na końcu tury, użyj `saveEnds.at: "damaged"` (Capability API 1.129): applies z Dominate Person to `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, które rzuca raz na cios z zapisaną trudnością nakładającej akcji, bez potrzeby `saveWhenDamaged`.
  - Ekonomia akcji (Capability API 1.76), tak jak zmieniają ją Haste i Slow:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` daje posiadaczowi w każdej turze o tyle więcej (lub mniej) jednostek budżetu tury, nigdy poniżej zera. Zmienić w ten sposób można tylko budżet uzupełniany `per` turę. Budżet można zadeklarować z `"count": 0` dla takiego, który uzupełnia tylko stan, a ekran pokazuje go tylko wtedy, gdy ktoś go ma. Wymyślony przeciwnik nigdy go nie wydaje.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true, "items": true }` określa, na co można wydać ten budżet: wskazane akcje standardowe (z własnej listy `standard` zestawu, nigdy na pierwszym budżecie, gdzie każda akcja standardowa już jest), jeden atak bronią z pojedynczym uderzeniem (niezależnie od tego, ile uderzeń dałaby akcja; dla stworzenia atak z jego bloku statystyk w jeden cel, nigdy wielokrotny atak) oraz użycie przedmiotu: `true` dla dowolnego przedmiotu albo `{ "tags": ["mundane"] }` tylko dla przedmiotu z jednym z tych tagów (Use an Object z 5e dotyczy przedmiotu zwykłego, nigdy aktywacji przedmiotu magicznego). Są oferowane, gdy budżet, który zwykle by zużywały, się wyczerpie, i tylko we własnej turze posiadacza: przyznanie nigdy nie płaci za reakcję.
    - `exclusive`: `["action", "bonus"]`, dwa budżety, z których tura zużywa tylko jeden: wydanie któregokolwiek opróżnia drugi.
    - `attacksPerTurn`: ile ataków (akcji z rzutem na trafienie, każdej atakującej części sekwencji i testu przeciwstawnego zastępującego uderzenie, np. pochwycenia) posiadacz wykonuje we własnej turze, niezależnie od tego, co dałaby akcja. Reakcja w turze kogoś innego nie jest ani ograniczana, ani liczona.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, to, co stan zostawia po sobie, gdy kończy się na dobre (upływa jego czas, kończy go rzut obronny lub obrażenia, przerwana zostaje koncentracja), nigdy gdy zostaje nałożony ponownie. Trwa pewną liczbę `rounds` (nigdy `"until-save"` ani `"instant"`). Pozostawiony w środku tury posiadacza zaczyna odliczać rundy od następnej tury, więc jedna runda to cała następna tura.
  - Gdy walka się kończy, niezależnie od tego jak, każdy stan, który nałożyła z czasem trwania, `endsAfter` lub koncentracją, znika z karty, niczego nie zostawiając, a koncentracja się kończy. Stan bez czasu trwania (powalenie po upadku) pozostaje.

  `own-saves-advantage` i jego przeciwieństwo rzucają obronę dwa razy z zachowaniem jednego wyniku, dokładnie jak atak, i wzajemnie się znoszą. `own-checks-advantage` i jego przeciwieństwo robią to samo ze stroną posiadacza w teście przeciwstawnym, bo tam walka wykonuje testy atrybutów, oraz z jego testami poza walką. `resist-all` zmniejsza o połowę każdy rodzaj obrażeń, oprócz działania własnej ochrony celu, i tak samo znosi się z podatnością. `cannot-target-source` zabrania posiadaczowi kierowania czegokolwiek na osobę, która nałożyła stan (`cannot-target-source-side`, 1.278: ani na nikogo z jej strony, chyba że jest to strona posiadacza), a `cannot-approach-source` zabrania zbliżenia się do niej bardziej niż z obecnego pola, także na trasie: obejście do równie odległego pola jest nadal oferowane, ale trasa przechodząca bliżej i wychodząca po drugiej stronie już nie.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Obrażenia zmieniane przez stan (Capability API 1.133).** `damage` zmienia to, co zadaje posiadacz; `damage-taken` zmienia to, co otrzymuje. Oba przyjmują `flat`, `dice` (i `minus`) albo `times: 0.5 | 2`. Dodatki działają raz na trafienie atakiem, nawet gdy trafienie ma kilka klauzul obrażeń; trafienia krytyczne podwajają dodane kości tak, jak zestaw podwaja inne kości. Rzuty obronne i automatyczne trafienia ich nie dostają. `times` zmienia całe trafienie po dodatkach i przed odpornością, zaokrąglając sumę w dół raz dla wszystkich jego klauzul. Dodane wielkości są redukowane przez odporność według własnego `damageType`, a po jego pominięciu według typu trafienia. Dodatki tego samego typu łączą się z tą wielkością przed odpornością.

  `attacks` to `weapon`, `spell` lub `any` (domyślnie). Wiersze listy ataków i ataki założonych przedmiotów to broń, podobnie jak jednocelowe rzuty ataku z bloku statystyk; zdolności z katalogu (łącznie z rzucaniem zaklęć przez stworzenia) i użycia przedmiotów to ataki zaklęciami lub inne. `blow: "melee" | "ranged"` działa zgodnie z 1.118, więc broń do rzucania użyta w zasięgu wręcz to atak wręcz. `ability` wskazuje atrybut faktycznie wybrany do rzutu ataku: atrybut wiersza albo pierwszy najlepszy atrybut oferowany przez przedmiot (łącznie z finezją). Zwykłe akcje z bloku statystyk go nie mają i nigdy nie pasują do ograniczenia atrybutu. Te klucze i `damageType` są odrzucane przy innych celach modyfikatorów. `fromSource: true` dotyczy tylko `damage-taken`: trafienie musi pochodzić od tego, kto nałożył śledzony stan. Nieśledzony stan, poziom lub przedmiot nie ma nakładającego źródła i nie może do niego pasować.

  W 5e zadeklaruj te identyfikatory stanów na karcie, a potem umieść te wpisy w `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor i Rage nakłada się na rzucającego; Ray of Enfeeblement i Hunter's Mark na cel. Hex używa wpisu `damage-taken` znaku z `attacks: "any"` i `damageType: "necrotic"`. Poziomy oraz efekty przedmiotów `worn`, `carried` i `otherwise` wymagań korzystają z tych samych modyfikatorów. Menu ataku liczy tylko własne dodatki i mnożniki posiadacza; znak na celu nigdy nie jest tam obiecywany. Podsumowania karty i promptu opisują własne modyfikatory obrażeń posiadacza, a widok bitwy opisuje też przychodzące. Pakiety używające któregokolwiek z tych celów wymagają schemaVersion 2 i capabilityApi 1.133 lub nowszego, także wtedy, gdy przedmiot znajduje się w osobnym pliku katalogu.

  **Liczby zmieniane przez stan.** Każdy wpis w `modifiers` wskazuje, co zmienia (`to`) i o ile:
  - `defense`: liczba, którą musi osiągnąć atak przeciw posiadaczowi. Tylko stała liczba.
  - `attacks`, `saves`, `checks`: własne rzuty ataku, rzuty obronne i testy przeciwstawne posiadacza. Stała liczba albo `dice` rzucane przy każdym rzucie (`"1d4"`); `minus: true` odejmuje kości zamiast je dodawać.
  - `speed`: zasięg ruchu posiadacza we własnej jednostce odległości (`flat`) albo `times` 0.5 lub 2 dla połowy lub podwojenia, stosowane po wszystkich zmianach stałych. Odczytywane tylko na planszy, tak jak `speed-zero`.
  - `health-max`: samo `times` 0.5 zmniejsza o połowę maksimum zdrowia posiadacza, z zaokrągleniem w dół i nigdy poniżej 1 (Capability API 1.115). Tor zdrowia z polami nie ma maksimum, które można by zmniejszyć. Zdrowie powyżej zmniejszonego maksimum przepada na początku walki, a leczenie nigdy go nie przekracza.

  Modyfikator `checks` może wskazywać własne `skills`, a modyfikator `saves` własne `saves`, które zawężają go zamiast zawężenia stanu. Każdy może rzucać dwa razy przez `mode: "advantage"` lub `"disadvantage"`, liczone razem z efektami o tej samej nazwie i znoszące się tak jak one, z liczbą obok albo bez niej; jeden stan może więc jednocześnie utrudniać Sneak i ułatwiać Climb. Te trzy klucze wymagają Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Stała liczba ma własny znak, a 0 jest odrzucane. Każdy modyfikator jest pokazywany w dzienniku obok zmienionego rzutu, z nazwą stanu ("12 + 5 + 3 (Blessed) = 20"), a szansa trafienia i szansa wygranej w menu go uwzględniają. Stany kumulują się ze sobą; ten sam stan nałożony dwa razy to nadal jeden stan.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: opcjonalne. Poziomy bieżącego toru liczone jako stany, gdy tor jest dostatecznie wysoko; tak wyraża się stan pogarszający się stopniowo, np. wyczerpanie. Każdy wpis wskazuje zwykły `track` (nie tor ran), poziom `at`, od którego działa, i jego działanie, z tymi samymi `effects`, `modifiers`, `failsSaves`, `saves` i `skills` co stan. Liczy się każdy osiągnięty przez tor poziom, więc sumują się w miarę wzrostu toru. Poziom nie ma źródła i kończy się tylko wtedy, gdy spada odczytywana przez niego wartość, więc `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` i `cannot-approach-source` są w nim odrzucane. Tory ma tylko walczący z kartą. Dziennik nazywa poziom torem i numerem ("- 1 (Heat 3)").

  Zamiast `track` poziom może odczytywać wartość `derived` (Capability API 1.54), obliczaną z bieżącym stanem i przedmiotami postaci, więc nikt nie musi niczego zaznaczać: Ember Roads spowalnia każdego, kto niesie 10 lub więcej jednostek objętości.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Próg różny dla każdej postaci ("więcej niż pięciokrotność Strength") to wartość pochodna, która go odejmuje: `scale` przez -1 daje część do odjęcia, a `sum` obu wartości jest tym, co odczytuje poziom.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` od razu na początku walki, zanim ktokolwiek się ruszy, eliminuje posiadacza z walki na dobre (Capability API 1.115). To i utrata zdrowia przy zmniejszonym maksimum są rozstrzygane raz, na początku walki; każdy inny poziom jest odczytywany zawsze wtedy, gdy odczytywana jest zmieniana przez niego liczba.

  Przeciwnicy także mają tory (Capability API 1.115). Przeciwnik bez karty zaczyna z przekazanymi mu `tracks`, według identyfikatorów twoich torów: stworzenie proponowane przez Mistrza Gry może je wskazywać (`"tracks": { "exhaustion": 2 }`), podobnie jak przeciwnik z bestiariusza wprowadzony do walki. `conditionImmunities` stworzenia może wskazywać tor odczytywany przez poziom, a wtedy żaden z poziomów tego toru go nie dotyczy, z kartą czy bez: nieumarli i konstrukty z 5e, niewrażliwi na wyczerpanie.

  Modyfikatory, poziomy i efekty testów wymagają Capability API 1.45.

- `checks` i `contests`: opcjonalne. Co odczytuje test przeciwstawny i jakie testy przeciwstawne może rozpocząć każdy uczestnik walki: chwytanie, pchnięcie, uwolnienie się. Zobacz niżej Testy przeciwstawne. Capability API 1.43.
- `concentration`: opcjonalne. Bieżące pole `text` zapisujące podtrzymywany efekt, `save` wymuszany obrażeniami, dolna granica trudności `floor` i `fromDamage`, czyli część otrzymanych obrażeń wyznaczająca trudność, gdy jest wyższa. Uruchomienie drugiej zdolności wymagającej koncentracji kończy pierwszą; nieudany rzut obronny kończy ją wraz z podtrzymywanymi stanami.
- `dying`: opcjonalne, `kind: "saves"`. Dwa tory liczące rzuty (wymaganą liczbę określa maksimum każdego toru), `dice`, `succeedAt`, działanie skrajnych wyników (`naturals.max`: `revive-1` lub `success`; `naturals.min`: `one-failure` lub `two-failures`), koszt obrażeń po powaleniu (`damageWhileDown`, `criticalWhileDown`) oraz `condition` powalonej postaci. Bez tego bloku postać z zerem jest po prostu powalona, a leczenie przywraca ją do walki.
- `damageTypes`: opcjonalne. Typy twojego systemu, dopasowywane bez uwzględniania wielkości liter.
- `damageKinds`: wymagane, gdy `health` wskazuje tor ran, a odrzucane, gdy wskazuje pulę, ponieważ tylko znacznik przechowuje rodzaj, a pula punktów nie ma na niego miejsca (zob. Tory ran powyżej). Określa, który z `kinds` toru zaznacza cios i ile pól wypełnia. `default` jest rodzajem dla wszystkiego bez mapowania, w tym ciosu bez typu, a `byType` mapuje twoje `damageTypes` na rodzaje; klucze, jak same typy, są dopasowywane bez wielkości liter, więc `"Fire"` i `"fire"` są jednym kluczem i podanie obu jest odrzucane. `marks` nie ma wartości domyślnej, ponieważ dwie odpowiedzi są przeciwne: `"per-point"`, gdy rzut obrażeń liczy poziomy zdrowia, więc cios za trzy zaznacza trzy pola i warto złagodzić go o jeden; oraz `"per-blow"`, gdy cios albo trafia, albo nie, więc zaznacza jedno pole niezależnie od siły. Cios z kilkoma składnikami obrażeń nadal zaznacza jedno pole, używając najcięższego rodzaju, który trafił. Wskaż, jak działa twój system. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: wymagane przy `dice-pool`, odrzucane przy `attack-vs-defense`. Zobacz Walka rzucana pulami.
- `spendLimits`: opcjonalne. Ile z bieżącej puli jeden walczący może wydać na `turn` lub na `round` w walce dowolnego rodzaju: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` jest odczytywane raz, na początku walki. Koszt przekraczający pozostałą część limitu jest niemożliwy do opłacenia, więc znika z menu, niezależnie od zawartości puli. Limit na turę odnawia się na początku własnej tury posiadacza, a limit na rundę na początku rundy. Przeciwnik zapisany zwykłymi liczbami za nic nie płaci z karty, więc limit nigdy go nie wiąże; przeciwnik zapisany jako karta płaci z własnych pul i podlega limitowi jak każdy inny. Capability API 1.47.
- `threat`: opcjonalne, wymagane przez bestiariusz. `tiers` to skala wyboru przeciwnika: identyfikator, etykieta, przedział `health`, `defense`, `toHit`, przedział `damagePerRound` i `saveDifficulty`. Każde dostarczane stworzenie wskazuje jeden z tych poziomów, a nienapisany wcześniej przeciwnik zostaje dopasowany do poziomu żądanego przez Mistrza Gry, więc nikt nie wypada poza skalę. Przedział `damagePerRound` oznacza działanie stworzenia na JEDEN cel w rundzie, łącznie z całą sekwencją.

### Rzuty obronne przeciw stanom, obrażeniom lub magii (Capability API 1.134)

Modyfikator z `to: "saves"` może zawierać `against`. Wymaga co najmniej jednego z: `conditions` (identyfikatory stanów karty), `damage` (typy obrażeń) lub `magic: true`. Wystarczy jedno dopasowanie; `saves` nadal zawęża, który rzut obronny, jako warunek łączny. Aby zawęzić w ten sposób ułatwienie, użyj `mode: "advantage"` modyfikatora, a nie `effects`. Te modyfikatory działają w stanach, osiągniętych poziomach torów lub wartości pochodnych oraz w efektach przedmiotów. Dla cech rasy wywiedź wartość z wyboru rasy na karcie i dołącz modyfikator do poziomu osiąganego, gdy ta wartość wynosi 1. Przykładowe modyfikatory:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave używa `conditions: ["frightened"]`. Magic Resistance używa `magic: true` bez `saves`, na poziomie wywiedzionym z karty stworzenia lub na poziomie toru. `applies` akcji liczy się, nawet jeśli rzut obronny zapobiega stanowi; jej obrażenia obejmują każdą klauzulę `plus`. Nazwy obrażeń są dopasowywane bez względu na wielkość liter. Magia oznacza cechę `"magical"` z 1.101: `mechanics.qualities` katalogu (nawet bez obrażeń), `damage.qualities` akcji stworzenia albo tagi przedmiotu będącego bronią. Zaklęcie musi mieć tę cechę; sama jego nazwa lub katalog nie czyni go magicznym. Rzut obronny kończący stan, łącznie z `saveWhenDamaged` i `saveEnds.at: "damaged"`, jest rzutem tylko przeciw temu stanowi. Rzuty obronne koncentracji i przeciw śmierci nie są przeciw niczemu. Poza walką żądania rzutów obronnych od Mistrza Gry nie zawierają uporządkowanego źródła ani stanu; `against` nigdy do nich nie pasuje. Karta, szczegóły przedmiotu, szczegóły bitwy i podsumowanie karty dla Mistrza Gry pokazują te ograniczenia. Wymaga schemaVersion 2 i capabilityApi 1.134 lub nowszego.

### Walka rzucana pulami: `dice-pool`

Zestaw `dice-pool` liczy sukcesy zamiast sumować kości, a jego walki też mogą tak działać. `"kind": "dice-pool"` wymaga, aby `resolution.kind` miało wartość `"dice-pool"`, i odczytuje kartę tak, jak już robią to twoje testy puli: **każda liczba dodawana przez rzut to liczba kości, a każda liczba, którą rzut musi osiągnąć, to liczba sukcesów.** Nic więc nie zmienia nazwy:

- Liczba trafienia (wiersza ataku, `toHit` listy zdolności, akcji stworzenia) to pula rzucana przez atak. Kość, próg, który musi osiągnąć kość, oraz wyniki, przy których kości liczą się podwójnie, eksplodują, anulują sukcesy i dają krytyczną porażkę, pochodzą z twojego `resolution`. Tor ran wskazany w `resolution.penaltyFrom` odejmuje swoją karę od puli, tak jak w teście.
- `defense` to liczba sukcesów wymagana przez atak, nigdy mniejsza niż jeden. Dodaje się do niej modyfikator `defense` ze stanu oraz osłonę (`cover.bonus` lub `cover.threeQuarters`).
- Każdy sukces ponad wymagane dodaje jedną kość obrażeń. Krytyczna porażka chybia, niezależnie od zliczonych sukcesów. Nie ma trafień krytycznych: mocne trafienie jest warte swoich dodatkowych kości.
- Liczba rzutu obronnego to jego pula, a trudność to wymagane sukcesy. Test przeciwstawny rzuca test każdej strony jako pulę i wygrywa strona z większą liczbą sukcesów.
- Modyfikator ataków, rzutów obronnych lub testów ze stanu to dodawane lub odejmowane kości, więc jest liczbą `flat`: modyfikator rzucany (`dice`) jest odrzucany.
- Obrażenia to kości twojego rodzaju: `dice` ilości (stworzenia, wpisu) określa, ile ich jest, i musi używać twojej kości, a część `flat` to automatyczne sukcesy, nigdy nierzucane. Z kolumny kości obrażeń wiersza ataku odczytuje się liczbę kości, `damage.ability` dodaje wartość tego atrybutu jako kości, a `damage.bonus` dodaje automatyczne sukcesy. `perCostStep` i `scales` dodają kości, jak zawsze. Leczenie i punkty tymczasowe to ilości sumowane jak wcześniej.
- Inicjatywa jest sumą (`initiative.dice` i `modifier`) albo pulą, jeśli o nią poprosisz (`initiative.pool`, niżej), a reguła umierania zachowuje własne kości.

To, co walka pulami rzuca poza tym, określa jej blok `pool`:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: czy rzut przechylony przez ułatwienie lub utrudnienie jest wykonywany dwa razy z zachowaniem tego z większą liczbą sukcesów (krytyczna porażka liczy się jako mniej niż każdy rzut bez krytycznej porażki). Bez tego walka rzuca raz, niezależnie od stanu.
- `damageTarget`: próg pojedynczej kości dla kości obrażeń i pochłaniania. Po pominięciu – domyślny próg twojego rozstrzygania. Te kości liczą raz każdy wynik równy progowi lub wyższy i nic poza tym: nic się na nich nie podwaja, nie eksploduje, nie anuluje ani nie daje krytycznej porażki.
- `soak`: co cel odejmuje od obrażeń trafienia, według rodzaju obrażeń. `all` to odwołanie do wartości dla dowolnego rodzaju, a `byKind` – po jednym dla każdego rodzaju twojego toru zdrowia, z pierwszeństwem przed `all` dla swojego rodzaju; rodzaj niewskazany przez żadne z nich nie jest pochłaniany. Przy `"roll": true` cel rzuca tyloma kośćmi przeciw progowi obrażeń, a każdy sukces odejmuje jeden. Przy `"roll": false` liczba jest odejmowana od kości obrażeń przed rzutem, więc nigdy nie dotyka automatycznych sukcesów, które pochłanianie rzucane odejmuje jak wszystkie inne. Nic nie spada poniżej zera i nic nie jest rzucane, by pochłonąć cios, który nic nie zliczył. Stworzenie podaje własne liczby jako `soak: { "all": 1, "byKind": { "knock": 3 } }`, co wymaga `soak` w bloku, określającego sposób pochłaniania. Odporność, podatność, niewrażliwość i `resist-all` działają po pochłonięciu, na to, co zostało.
- `hardness`: odwołanie do wartości twardości walczącego, gdy inicjatywa jest liczbą przesuwaną atakami. Zobacz [Pancerz i efekty założonych przedmiotów w walce](#armor-and-worn-effects-in-a-fight).

Obrażenia każdego celu są rzucane osobno dla niego, bo to, co trafienie uzyskało ponad wymagane sukcesy, i to, co cel pochłania, należą do niego. Drugi składnik ciosu i efekt dodatkowy to osobne pule obrażeń własnego rodzaju, bez dodatkowych kości z trafienia. Menu prognozuje pulę dokładnie: szansę osiągnięcia wymaganych sukcesów i wartość kości obrażeń po tym, co pochłonie pierwszy cel.

Tak zapisano Gravewatch: jego strażnicy rzucają cechą i umiejętnością zawodową, pochłaniają stłuczenia przez Sinew, a rozdarć wcale, mogą wydać jeden punkt Resolve na turę i rzucają inicjatywą ponownie w każdej rundzie.

**Deklarowanie w odwrotnej kolejności nie jest zaimplementowane.** W niektórych systemach wszyscy deklarują akcje, zanim ktokolwiek zacznie działać, od najwolniejszego. W walce, w której każdy walczący wybiera jedną akcję, gdy nadchodzi jego tura, wcześniejsza deklaracja nie zmienia niczego, co odczytuje jakakolwiek reguła, więc klucz nie miałby czego określać.

### Minimalne kości obrażeń (Capability API 1.146)

Walka pulami może zachować kości nawet przeciw silnemu pochłanianiu, tak jak **Overwhelming** z Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

To jest `combat.damage.minimum`, odwołanie do wartości odczytywane z bieżącej karty **atakującego**. Gdy statyczne pochłanianie odejmie kości od pierwszej puli obrażeń trafienia, pula jest podnoszona co najmniej do tej liczby. To pełne kości, zaokrąglone w dół i ograniczone przez zero i `resolution.pool.max`, a nie automatyczne sukcesy: każda pozostała kość może zawieść. Rzucane pochłanianie nadal odejmuje sukcesy po rzucie obrażeń; nie zmniejsza puli kości, więc minimum nie chroni przed nim sukcesów. Odporność i niewrażliwość nadal działają. Ciosy wydające inicjatywę ignorują minimum, tak jak ignorują obrażenia broni i pochłanianie; ciosy zabierające inicjatywę go używają.

Broń może zastąpić wspólne minimum przez `item.attack.damage.minimum`. Przyjmuje te same odwołania do wartości na posiadaczu albo `{ "stat": "overwhelming" }` dla jednej z własnych liczbowych statystyk przedmiotu. Zadeklarowane zero także zastępuje wspólne minimum. Różni się to od istniejącego `floor` broni, który gwarantuje określone obrażenia po pochłonięciu. Dodatkowe klauzule obrażeń i efekty dodatkowe nie otrzymują kolejnego minimum. Zapis walki i dziennik pokazują rozstrzygnięte minimum obok kości. Zarówno klucz walki, jak i klucz broni wymagają w pakiecie **Capability API 1.146**, także dla broni w zewnętrznych plikach katalogów.

### Trafienie, które oszałamia (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` jest przeznaczone dla walk pulami. `over` odczytuje bieżącą kartę **celu** bezpośrednio przed trafieniem. Jedno trafienie musi zadać **ściśle więcej** obrażeń niż ta liczba, po pochłanianiu, rzutach obronnych i odporności. Jego klauzule obrażeń liczą się razem; osobne trafienia nigdy nie sumują się na potrzeby oszołomienia. Na torze zaznaczanym za cios trafienie zadające obrażenia liczy się jako jeden poziom. Cios zabierający inicjatywę zamiast zdrowia nie może oszołomić. `measure` to obecnie tylko `"damage"`.

Cel pomija dokładnie swoją następną turę. Kolejne oszałamiające trafienia przed tą turą nie dodają kolejnych pominięć. Pominięta tura nadal przesuwa zegary stanów i inne rozliczenia tury, łącznie ze zmianami rund i ponownym rzutem inicjatywy. Zapisanie i ponowne wczytanie walki zachowuje oczekujące pominięcie. `condition`, jeśli występuje, wskazuje zadeklarowany stan karty. Walka oznacza nim cel, dopóki pominięta tura nie minie albo walka się nie skończy. Stan już obecny pozostaje na miejscu; niewrażliwość na stan zapobiega oznaczeniu, ale nie pominięciu. `text` to opcjonalna narracja, a nie kolejny efekt. Dziennik i kontekst walki dla Mistrza Gry zapisują trafienie i pominięcie. Klucz wymaga **Capability API 1.147**.

### Cel wybiera rodzaj rany (Capability API 1.148)

Dodaj `remap` do istniejącego mapowania `combat.damageKinds`; zachowaj jego `default`, `byType` i `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Walka pulami najpierw wybiera rodzaj ataku według jego zwykłego mapowania, a potem odczytuje `when` każdego przemapowania na **celu**. Liczba różna od zera włącza regułę. `from` i `to` muszą być rodzajami na torze ran zdrowia. Wygrywa pierwsza pasująca reguła; przemapowania nie łączą się w łańcuchy. Można ich podać najwyżej 12. Z `tags` co najmniej jeden musi pasować do ataku: broń już ma `item.tags`, a mechanika katalogu i obrażenia stworzeń już mają `qualities`. Te nazwy pochodzą z `items.tags`. Bez `tags` może pasować każdy atak tego rodzaju. Nie potrzeba nowego pola tagów ataku.

Wynikowy rodzaj decyduje zarówno o **pochłanianiu**, jak i o znacznikach ran. Śmiertelne trafienie z broni palnej może więc wobec wampira stać się obuchowym i używać pochłaniania obuchowego; ta sama broń palna wobec kogoś innego albo ostrze wobec tego wampira zachowuje swój zwykły rodzaj. Pierwotny _typ_ obrażeń ataku nie zmienia się na potrzeby odporności i niewrażliwości. Każda klauzula obrażeń używa własnego rodzaju i tagów ataku. Zapis walki i dziennik pokazują pierwotne i przemapowane rodzaje, a prognoza obrażeń odczytuje tę samą regułę. Zwykłe stworzenie bez karty może spełnić stałe odwołanie, ale nie może dostarczyć wartości z karty dla tych reguł; daj mu w tym celu kartę stworzenia. Tylko nowy klucz `remap` wymaga **Capability API 1.148**; starsze mapowania rodzajów obrażeń zachowują dotychczasową zgodność.

### Inicjatywa przesuwana atakami

Niektóre systemy pul utrzymują inicjatywę jako liczbę przez całą walkę i pozwalają atakom ją przesuwać: jeden sposób ataku odbiera ją celowi, inny wydaje inicjatywę atakującego jako obrażenia, a kto spadnie do ustalonej granicy, ulega załamaniu. Walka `dice-pool` może to wyrazić (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **Otwarcie.** Na początku walki każdy rzuca `pool` kośćmi, a sukcesy plus `plus` dają jego wartość, więc `resource` wymaga `pool`: zsumowane kości wyznaczają kolejność, a nie liczbę kości. `initiativeModifier` stworzenia to jego pula, bo każda liczba dodawana w walce pulami to kości. Wartość jest zachowywana: nigdy nie rzuca się nią ponownie (`each` obok `resource` jest odrzucane), a na początku każdej rundy kolejność jest sortowana według bieżących wartości.
- **Style.** Każdy atak (wiersz ataku, zdolność lub wpis katalogu z rzutem na trafienie zadający obrażenia, akcja stworzenia, która to robi, oraz akcja złożona z innych akcji) jest oferowany raz dla każdego stylu, a gracz wybiera styl przed celem. Najwyżej cztery, każdy albo zabiera, albo wydaje, i co najmniej jeden zabiera. Wybór niewskazujący stylu jest wykonywany w pierwszym; wybór stylu, w którym atak nie jest oferowany, jest odrzucany. Atak zachowuje styl, w którym go wykonano, do swojego końca, nawet gdy odpowiedź zmieni wartość wykonawcy, zanim cios dosięgnie celu.
- **Styl zabierający.** Przy trafieniu obrażenia rzuca się jak zwykle (dodatkowe kości z trafienia, kości broni, pochłanianie według rodzaju, automatyczne sukcesy), a zliczony wynik jest odejmowany od wartości celu zamiast od jego zdrowia. Atakujący zyskuje całość plus `gain`.
- **Styl wydający.** Oferowany tylko wtedy, gdy wartość atakującego jest powyżej granicy załamania (0, gdy nie podasz `crash`), i nigdy dla akcji złożonej z innych akcji, bo wartość wydaje się na jeden cios. Przy trafieniu obrażenia to wartość atakującego z chwili ataku, rzucana jako kości przeciw progowi obrażeń, i nic poza tym: bez kości broni, bez dodatkowych kości z trafienia, bez automatycznych sukcesów, bez pochłaniania. Zaznacza zdrowie własnym rodzajem obrażeń ataku. Po zakończeniu ataku wartość, która gdziekolwiek trafiła, wraca do `base`, a wartość, która nigdzie nie trafiła, traci tyle, ile określa `onMiss` dla wartości, z którą wykonano atak (tabela progów: pary `[at least, lose]`, rosnąco; poniżej pierwszego progu nic).
- **Załamanie.** Wartość, która spadnie do `crash.at` lub niżej, oznacza załamanie: na walczącego zostaje nałożony `condition` (jeden z twoich stanów, opcjonalny), a ten, kto go tam zepchnął, zyskuje `bonus`. Chybienie, które załamuje samego wykonawcę, nikomu nie daje premii. Załamany walczący nie może wydawać. Załamanie ustępuje, razem ze stanem, gdy jego wartość znów wzrośnie powyżej granicy, po `recoverAfter` jego własnych tur (jego wartość wraca do `base` na początku tej tury) oraz gdy walka się skończy, jakkolwiek się skończy. Ktoś, czyj rzut otwierający jest na granicy lub poniżej, zaczyna walkę załamany. `base` musi być powyżej `crash.at`, inaczej powrót do tej wartości ponownie by go załamał.

Menu pokazuje osobną prognozę każdego stylu: szansę trafienia oraz to, co zabrałby styl zabierający, lub obrażenia, które zadałby styl wydający. Panel statusu pokazuje wartości wszystkich, a dziennik podaje każdą zmianę i jej przyczynę: "Ada gains 5 initiative for crashing Rats, and is on 14." Mechanizm wyboru Engine ocenia cios zabierający z wyprzedzeniem o jedną turę: zabranie, a potem wydanie, wobec wydania teraz i ponownie od wartości bazowej.

<a id="what-a-fight-reads-from-mechanics"></a>

### Co walka odczytuje z `mechanics`

`kind` określa, czy `amount` to obrażenia czy leczenie; wszystko oznaczone `reaction` jest pomijane w menu, podobnie jak wpis `utility`, chyba że zmienia możliwości samej tury (zob. niżej). `attackRoll` wymusza rzut przeciw obronie celu z `toHit` listy; `autoHit` całkowicie go pomija. `save` wykonuje własny rzut obronny celu przeciw `saveDifficulty` listy, a `onSuccess` określa, czy sukces pozostawia połowę, czy nic. `targetCount` określa dozwoloną liczbę celów. Zdolność bez rzutu ataku (obszar, przeciw któremu wszyscy się bronią, lub coś trafiającego automatycznie) rzuca kośćmi RAZ dla wszystkich, a zdolność rzucająca na trafienie każdego celu rzuca obrażenia ponownie przy każdym trafieniu. `applies` nakłada stany na objęte cele, każdy z `duration`: `instant` (bez własnego zegara: trwa, dopóki coś go nie zdejmie), `until-save` (wymaga obok `saveEnds`) lub `{ "rounds": n }`, oraz opcjonalnym `saveEnds` wskazującym rzut obronny i powtarzanie przy `turn-end` lub `turn-start`. Rundy odliczają własne tury posiadacza w chwili zakończenia każdej z nich; `{ "rounds": 1, "at": "turn-start" }` odlicza je na początku każdej, co wyraża "do początku twojej następnej tury". `"of": "source"` (Capability API 1.119) odlicza zamiast tego tury tego, kto nałożył stan, zaczynając od jego następnej, co wyraża "do końca twojej następnej tury" w odniesieniu do kogoś innego. `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` z Guiding Bolt daje ułatwienie następnemu rzutowi ataku przeciw celowi przed końcem następnej tury rzucającego. Jeśli źródło opuści walkę, rundy liczą się we własnych turach posiadacza. `delays` stanu bojowego (Capability API 1.120) wstrzymuje to, czego używa posiadacz: akcja z jednego z jego `catalogs`, opłacona jego `budget`, rzuca kością o `chance.sides` ściankach, a przy wyniku `chance.atLeast` lub wyższym jeszcze nie następuje. Na początku następnej tury posiadacza zostaje dokończona z tym samym budżetem i przebiega tak, jak by przebiegła, łącznie z odpowiedziami, a jeśli posiadacz nie może działać lub nie ma nic z tego budżetu, przepada. Koszt i tak pozostaje zużyty. Slow z 5e to `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` zdejmuje stan po pierwszym `own-attack` (następnym rzucie ataku posiadacza), `attacked` (następnym rzucie ataku wykonanym przeciw posiadaczowi) lub `own-save` (następnym rzucie obronnym posiadacza), niezależnie od jego zegara, więc `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` oznacza "przy jego następnym ataku przed końcem jego następnej tury". Stan trwający jeden atak trwa przez cały atak, łącznie z obrażeniami, a nowy stan nałożony przez ten sam cios zostaje. Oba wymagają Capability API 1.45. `temporary` przyznaje tymczasowe punkty puli zdrowia; nie kumulują się – pozostaje większy bufor. `scales` zwiększa wielkość o dodatkowe KOŚCI z tabeli dla odczytanej wartości. `cost` jest płacony przez własne polecenie `use` karty, a `budget` zastępuje domyślną część ekonomii akcji.

`plus` to do trzech DODATKOWYCH wielkości tego samego ciosu, obok `amount`, każda z osobnym rzutem i typem ("and 2d6 fire"). Składnik ma postać `{ "dice": "2d6", "flat": 1, "type": "fire" }` i może mieć własny `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, który CEL wykonuje niezależnie od pozostałych wymagań akcji: `none` usuwa cały ten składnik przy sukcesie, `half` pozostawia połowę, a reszta ciosu pozostaje niezmieniona. Bez `difficulty` używa liczby własnego rzutu obronnego akcji, a następnie `saveDifficulty` listy. Trafienie krytyczne podwaja kości każdego składnika według tej samej zasady co pierwszą wielkość; składnik bez `type` ma własny rodzaj obrażeń ciosu, a cały cios nadal oznacza JEDEN test koncentracji z sumą obrażeń i jeden test powalenia. Składnik wymaga bazowego `amount`; `heal` nie może mieć takich składników.

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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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

`sources` wskazuje listy ataków, z których pochodzi, a `requires` jedną kolumnę ich wierszy o wartości prawdziwej, więc dodatkowy efekt działający tylko z niektórymi broniami określa je bez znajomości pojęcia broni przez Engine; pominięcie obu oznacza każde trafienie posiadacza. Broń trzymana z torby nie jest wierszem, więc `weapons` (Capability API 1.70) wskazuje także tagi przedmiotów, przy których efekt działa: `"weapons": { "tags": ["finesse", "ranged"] }` działa przy trafieniu trzymaną bronią z którymkolwiek z tych tagów, łącznie z uderzeniem drugą ręką. Wskazanie tylko `weapons` nie działa przy żadnym wierszu, a wskazanie tylko wierszy nie działa przy żadnej trzymanej broni. `when` oznacza DOWOLNY z warunków: `advantage` to ostateczna przewaga rzutu ataku, a `ally-adjacent` to stojący sojusznik atakującego zdolny do działania, oddalony od celu o najwyżej jedno pole na planszy lub znajdujący się gdziekolwiek bez planszy. `ally-adjacent-no-disadvantage` (Capability API 1.126) dodatkowo wymaga, aby ostateczny rzut nie był z utrudnieniem po wzajemnym zniesieniu ułatwienia i utrudnienia; przykład powyżej używa go dla Sneak Attack. `oncePer` to `turn` (odnawia się na początku każdej tury, więc uderzenie podczas cudzego działania również może go otrzymać) albo `round`. `amount` rośnie zgodnie z własnym `scales` wpisu, a `type` określa rodzaj obrażeń, domyślnie taki jak ciosu.

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

Poniższe liczby to prosty sposób zapisania stworzenia. Stworzenie zapisane we własnych pojęciach zestawu zasad, jako `sheet`, pobiera zamiast tego `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` i `hardness` z tej karty (zob. "Stworzenie zapisane we własnych pojęciach zestawu zasad" poniżej).

- `health`: liczba lub `{ "dice": "3d6", "flat": 2 }` rzucane raz przy tworzeniu walki. Prognoza odczytuje średnią, więc menu nigdy nie obiecuje wyniku kości, której nikt nie rzucił.
- `defense`, `initiativeModifier`, `speed`: wartość, przeciw której wykonuje się atak, dodatek do inicjatywy (albo, gdy inicjatywą rzuca się jako pulą, liczba rzucanych kości) i odległość ruchu w turze we własnej jednostce odległości.
- `abilities` i `saves`: klucze odpowiadają identyfikatorom cech i rzutów obronnych zadeklarowanych na karcie. Niewskazany rzut obronny ma wartość zero.
- `checks`: co stworzenie dodaje w teście przeciwstawnym, z kluczami będącymi identyfikatorami `combat.checks`. Niewskazany test ma wartość zero. Capability API 1.43.
- `soak`: tylko w walce `dice-pool` – co stworzenie pochłania: `all` dla dowolnych obrażeń, `byKind` dla rodzaju twojego toru zdrowia. Capability API 1.47.
- `hardness`: gdy inicjatywa jest liczbą przesuwaną atakami, cios wydający, którego kości są poniżej tej wartości, nic nie robi. Capability API 1.56.
- `speeds` i `hover`: jak porusza się poza chodzeniem (zobacz Inne sposoby poruszania się, w sekcji Pozycje). Capability API 1.113.
- `shield: true`: ma zajęte ręce, więc alternatywa `twoHanded` akcji nie obowiązuje. Capability API 1.102.
- `size`: jeden z `combat.sizes`, według identyfikatora, odczytywany przez `maxSizeAbove` testu przeciwstawnego (zobacz Rozmiary i trudności uwolnienia się). Capability API 1.103.
- `type` i `tags`: jeden z `combat.creatureTypes.types` i do ośmiu jego `tags`, według identyfikatorów, odczytywane przez testy celu (zobacz Typy stworzeń i testy celu). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: typy obrażeń, dopasowywane bez wielkości liter i sprawdzane względem `combat.damageTypes`, jeśli jakieś deklarujesz. Wpis `resist` lub `immune` może też określać, co się przez niego przebija, `{ "type": "tearing", "except": ["silver"] }`: cios bronią-przedmiotem z jednym z tych tagów przedmiotów jest przyjmowany bez zmian (Capability API 1.55, zobacz [Broń w walce](#weapons-in-a-fight)), podobnie jak akcja, której `damage.qualities`, albo wpis katalogu, którego `mechanics.qualities` wskazuje jeden z nich (Capability API 1.101). `conditionImmunities` wskazuje twoje własne stany albo tor odczytywany przez twoje `combat.levels` (Capability API 1.115).
- `tier`: szczebel `combat.threat`, do którego należy stworzenie.
- `loot` (Capability API 1.63): identyfikator tabeli łupów losowanej za nie po wygranej walce (zobacz wyżej Łupy).
- `traits`: krótkie pary nazwy i tekstu pokazywane Mistrzowi Gry. Nigdy nie są rozstrzygane, więc wszystko zawierające liczby należy do akcji.
- `signaturePoints`: punkty zwracane na początku własnej tury, wydawane na akcje `signature`.
- `riders`: do czterech, to samo co `rider` wpisu katalogu, zapisane w bloku. Każdy ma postać `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, z opcjonalnym `type` i opcjonalnym `actions` wskazującym własne akcje bloku, przy których działa. Dodatkowy efekt bloku nie odczytuje list karty, więc nie ma dwóch kluczy: `sources` i `requires`. Stworzenie zapisane jako karta otrzymuje efekty dodatkowe ze swoich list, dokładnie jak postać.
- `actions`: do dwunastu, każda z własnym `id`. Akcja zawiera to, co ręcznie napisany blok statystyk (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), oraz cztery rzeczy dostępne tylko stworzeniom. `reach` określa zasięg uderzenia, `range` zasięg rzutu lub strzału, a `area` kształt obszaru działania, wszystko we własnej jednostce odległości; `range` może być zwykłą liczbą albo `{ "normal": 30, "long": 120 }`, gdy dalszy zasięg wiąże się z karą, a `area` ma postać `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (zob. Pozycje):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Po wyczerpaniu użyć akcja znika z menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Na początku walki jest dostępna, użycie ją zużywa, a na początku własnej tury stworzenia wykonuje rzut: `from` lub więcej przywraca ją. Dziennik zapisuje kości w obu przypadkach.
  - `damage.alternatives` (Capability API 1.102): do czterech wielkości zadawanych zamiast pierwszej, każda jako `{ "when": ..., "dice": "1d10", "flat": 3 }`; wygrywa pierwsza spełniona. Typ, klauzule i cechy pozostają własne akcji. `"when": "twoHanded"` obowiązuje, chyba że stworzenie ma `"shield": true`, co odpowiada "lub 8 (1d10 + 3) obrażeń ciętych przy użyciu oburącz" z 5e; `"when": { "selfHealthAtMost": 0.5 }` obowiązuje, dopóki jego zdrowie wynosi najwyżej taką część maksimum, co odpowiada "lub 5 (2d4) obrażeń kłutych, jeśli rój ma połowę punktów życia lub mniej". Prognoza w menu i sam cios odczytują to w bieżącym stanie.
  - `sequence`: inne akcje tego samego bloku, po kolei, każda z własnym celem. **Tak zapisuje się stworzenie uderzające dwa razy w jednej akcji.** Jeden budżet opłaca całą sekwencję. Sekwencja nie ma własnego efektu i nigdy nie może wskazywać kolejnej sekwencji.
  - `signature`: `{ "cost": n }`, opłacane własnymi punktami stworzenia zamiast budżetu i dostępne tylko podczas działania kogoś innego: walka oferuje je w oknie między turami (zob. Okna).
  - `reaction`: ten sam obiekt co `mechanics.reaction` wpisu katalogu (zob. Okna): akcji nie ma w menu żadnej tury, a zamiast tego jest oferowana w chwili, którą wskazuje. Reakcja nie jest jednocześnie akcją specjalną i żadna sekwencja nie może jej zawierać.
  - `self: true`: działa na samo stworzenie, a nie na kogoś innego, więc nie przyjmuje `targetCount` ani `area`. Oba wymagają Capability API 1.46. Parry jest jednym i drugim, ze stanem `parrying`, który dodaje 2 do obrony:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- Rzut obronny wymaga trudności na samej akcji: `save.difficulty` dla rzutu wymuszanego przez akcję lub `saveDifficulty` dla stanu kończonego rzutem obronnym, gdy akcja nie ma własnego rzutu. Akcja bloku jest zapisywana zwykłymi liczbami nawet u stworzenia z kartą, więc liczba należy do akcji. Własny rzut obronny składnika może pominąć `difficulty` i skorzystać z tej samej liczby.
- `damage.plus` to ta sama lista składników co `plus` wpisu katalogu, odczytywana identycznie: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` to ugryzienie z osobną ilością obrażeń od żaru, osobno redukowaną przez odporność i osobno podwajaną.

Akcja stworzenia może przywracać punkty życia przez `heal` (kości, stała wartość lub oba), najwyżej do maksimum celu. `targets: "ally"` sięga własnej strony, łącznie z samym stworzeniem; `targets: "any"` sięga obu stron. Bez `targets` sięga drugiej strony jak wcześniej. Te klucze wymagają Capability API 1.121. Leczenie nie zawiera `damage`, `toHit`, `save` ani `area`; `targets` nie przyjmuje `self` ani `sequence`, a sekwencja nie zawiera żadnego z tych kluczy. Healing Touch devy wygląda tak:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

`spellcasting` stworzenia (Capability API 1.123) rzuca zaklęcia z katalogu bez wydawania komórek ani punktów. Jego `saveDifficulty` i `toHit` dostarczają liczb zaklęcia; stworzenie z `sheet` może je pominąć, aby użyć liczb rzucania zaklęć ze swojej karty. Zwykłe stworzenie musi podać każdą liczbę potrzebną jego zaklęciom. Każde `entry` wskazuje istniejący wpis katalogu z `mechanics`. Pominięte `uses` oznacza użycie bez ograniczeń; `level` to poziom rzucenia dla skalowania `perCostStep`, a po pominięciu poziom bazowy wpisu. Wpis nadal dostarcza budżet, cele, koncentrację, reakcje, obszary i przywołania. Listę driady można zapisać w ten sposób; te identyfikatory zaklęć są przykładowe i muszą zostać dostarczone w katalogu `spells`:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Dla sabatu wiedźm dodaj `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` obok `spells` oraz `"coven": true` przy każdym wspólnym zaklęciu. Te zaklęcia są oferowane tylko wtedy, gdy co najmniej trzech stojących uczestników walki po stronie rzucającego ma ten identyfikator sabatu, każdy w odległości 30 jednostek odległości zestawu od rzucającego, mierzonej zwykłą odległością pól. Bez planszy liczą się wszyscy stojący członkowie. Użycia każdego zaklęcia stanowią jedną pulę wspólną dla sabatu, kluczowaną identyfikatorem sabatu i wpisem. Blok sabatu wymaga zaklęcia sabatu, a zaklęcie sabatu wymaga bloku; zduplikowane wpisy są odrzucane. Stworzenie zaproponowane przez Mistrza Gry traci `spellcasting` przy przycinaniu, bo skala zagrożenia nie może ograniczyć listy zaklęć.

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
- **Każda liczba ma jedno źródło.** Stworzenie z kartą nie podaje jednocześnie `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` ani `checks`; jeśli to zrobi, Engine odrzuca plik. Może nie mieć żadnych własnych `actions`, ponieważ jego działania wynikają z list. Stworzenie bez karty nadal podaje pierwsze trzy wartości i co najmniej jedną akcję.
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
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**Inne sposoby poruszania się** (Capability API 1.113). `speeds` stworzenia podaje, jak porusza się poza chodzeniem, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` w twojej jednostce, a `"hover": true` oznacza, że latający nie musi się ruszać, aby utrzymać się w powietrzu (wymaga szybkości `fly`). Wartości członka drużyny pochodzą z karty przez `economy.movementModes`, odwołania do wartości z takimi samymi kluczami, jak szybkość pływania z rasy albo szybkość lotu z zaklęcia; zero oznacza brak takiego sposobu poruszania się. `speed` i `economy.movement` pozostają chodzeniem. Na planszy:

- przydział ruchu to najszybszy sposób poruszania się, a każde przebyte pole odejmuje się od wszystkich sposobów naraz, więc stworzenie, które chodzi z szybkością 30 i lata z szybkością 60, może przejść 10, a potem przelecieć 40, ale nigdy nie przejdzie więcej niż 30;
- latający wchodzi za cenę jednego pola na każde pole, które nie jest lite, łącznie z wodą i stopniem dowolnej wysokości;
- pływający przekracza wodę za cenę jednego pola, a po lądzie chodzi;
- wspinający się pokonuje stopień dowolnej wysokości za cenę podłoża, na które wchodzi;
- szybkość kopania jest przekazywana Mistrzowi Gry, a na planszy działa jak chodzenie, bo plansza nie ma podłoża, w którym można drążyć tunele.

Każdy krok jest wykonywany najtańszym sposobem, który ma jeszcze dość zapasu. Walka bez planszy nic z tego nie odczytuje, a ktoś, kto tylko chodzi, porusza się dokładnie jak wcześniej.

**Wysokość lotu** (Capability API 1.114). Na planszy, dla której zestaw podaje `combat.elevation.levelHeight` i `combat.distance.perCell`, latający otrzymuje opcje Fly up i Fly down w miejscu, w którym się znajduje, każdą kosztującą równowartość jednego poziomu lotu (poziom 5 stóp na polach 5-stopowych to jedno pole). Może wznieść się do 20 poziomów nad podłożem, nad którym się znajduje. Dopóki jest w powietrzu:

- tylko lata, pole na krok, nad wszystkim, co nie jest lite;
- odległość między nim a kimkolwiek innym to większa z odległości płaskiej i różnicy wysokości, więc miecz o zasięgu 5 stóp nie dosięgnie smoka 30 stóp w górze, a jego ugryzienie nie dosięgnie rycerza;
- ma przewagę wysokości nad każdym niżej, tak jak dałoby mu ją wzgórze;
- wyjście z zasięgu kogoś, dla kogo jest za wysoko, nie prowokuje uderzenia;
- powalony, przewrócony lub unieruchomiony do szybkości zero spada na podłoże pod sobą zgodnie z `falling`, chyba że ma `hover`.

Wlot na podłoże tak wysokie jak on lub wyższe oznacza lądowanie, tak jak latający na ziemi wlatuje na klif. Nie ma nowego klucza: Engine sprzed 1.114 trzyma latających na ziemi, więc pakiet polegający na wysokości deklaruje 1.114.

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

Linia w `mechanics.area` wpisu lub w `area` akcji stworzenia może zawierać `width` w tej samej jednostce co `size`, zaokrąglane do pól z minimum jednego pola (Capability API 1.128), np. `{ "shape": "line", "size": 60, "width": 10 }` dla linii o długości 60 stóp i szerokości 10 stóp; pomiń je dla szerokości jednego pola, a parzysta szerokość w polach umieszcza dodatkową kolumnę po lewej stronie rzucającego.

**Linia widzenia i osłona.** Prosta linia pól między uczestnikami: ściana lub góra na niej blokuje strzał i rozchodzenie się obszaru za nią, a celu po prostu nie ma w menu. Przez wodę widać: strzał przelatuje nad rzeką, a obszar w kształcie linii biegnie nad nią dalej. Własne walki Engine używają tego samego testu widoczności.

Osłonę odczytuje się z miejsca atakującego, według linii narożnikowych z opcjonalnej reguły siatki z DMG: z najlepszego narożnika atakującego jedna linia do każdego narożnika pola celu. Trzy lub cztery linie przechodzące przez ścianę lub górę to osłona trzech czwartych; dowolna linia przechodząca przez nie albo przez teren stanowiący osłonę (las, ruiny) to połowiczna osłona; sam niski teren nigdy nie daje więcej niż połowę. Cel, którego atakujący w ogóle nie widzi, ma pełną osłonę i nie ma go w menu. Przeciw atakowi cel stojący na terenie stanowiącym osłonę ma co najmniej połowiczną osłonę, jak zawsze; rzutowi obronnemu pomaga tylko to, co leży między celem a efektem.

- `cover.bonus` to wartość, jaką połowiczna osłona dodaje do obrony, przeciw której wykonuje się atak; dziennik to odnotowuje.
- `cover.threeQuarters` (Capability API 1.74) to wartość dodawana przez osłonę trzech czwartych; bez niego `bonus` służy obu.
- `cover.saves` (1.74) wskazuje rzuty obronne, którym także pomaga osłona, przeciw własnemu rzutowi obronnemu akcji (nigdy rzutowi kończącemu stan ani podtrzymującemu koncentrację): od miejsca, w którym ląduje wybuch, a od twórcy w przypadku wszystkiego innego. Dziennik także to odnotowuje.
- `cover.creatures` (1.74) sprawia, że każdy stojący na drodze, przyjaciel czy wróg, daje połowiczną osłonę.
- Rzut obronny, którego tekst mówi, że cel nic nie zyskuje z osłony (Sacred Flame z 5e), zawiera `"ignoresCover": true` (1.74), w `mechanics.save` wpisu, `save` akcji stworzenia lub `save` użycia przedmiotu.

**Wysokość.** Plansza może mieć wysokość, do trzech poziomów, a każda walka z pozycjami chodzi i widzi według niej niezależnie od zestawu: wejście o poziom wyżej kosztuje jedno pole więcej, zejście nic nie kosztuje, stopień o dwa poziomy lub więcej to klif, po którym nikt nie chodzi (i na który nikt nie zostaje wepchnięty), a teren wyższy niż oba końce blokuje widoczność. Przy strzale w dół z wyższego terenu niska osłona pomiędzy niczego nie ukrywa. Zestaw określa, co dodaje jego system, przez `elevation` (Capability API 1.75; wymaga `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` to wysokość jednego poziomu we własnej jednostce odległości zestawu.
- `highGround` to to, co daje rzutowi ataku uderzenie z wyższego terenu: `"advantage"` albo `{ "bonus": n }`, odejmowane od obrony, przeciw której wykonuje się atak. Pominięte nic nie daje.
- `rangeBonus` to liczba pól, o którą dalej sięga strzał z wyższego terenu.
- `falling` to skutek upadku: ktoś zepchnięty ze stopnia o dwa poziomy lub więcej ląduje niżej i otrzymuje `dice` za każde `per` wysokości upadku (poziomy razy `levelHeight`), najwyżej `max` kości, typu `type`, a potem stan `prone`, jeśli taki istnieje. Kośćmi rzuca się tak, jak system rzuca obrażenia: sumuje się je albo przy `dice-pool` liczy jako sukcesy pomniejszone o pochłanianie. Upadek jest ciosem jak każdy inny, więc może kogoś powalić lub przerwać jego koncentrację. Dziennik podaje, z jakiej wysokości ktoś spadł. Bez `falling` upadek jest odnotowywany i nic nie robi.

**Uderzenia w odchodzących.** Zadeklaruj `opportunity.budget`; gdy walczący wychodzi z zasięgu stojącego wroga, który może działać, ma ten budżet i coś do uderzenia wręcz, ruch ZATRZYMUJE SIĘ w bieżącym miejscu, a wróg otrzymuje pytanie o uderzenie. Przyjęcie zużywa budżet i rozstrzyga ten sam atak dokładnie jak we własnej turze; przepuszczenie nic nie kosztuje. Potem ruch wznawia się z miejsca zatrzymania, płacąc za każde rzeczywiście przebyte pole, a uderzenie powalające poruszającego się kończy ruch tam, gdzie upadł. Każdy ma jedną okazję na cały ruch, niezależnie od liczby wyjść trasy z tego samego zasięgu. `disengage` zapobiega temu przez resztę tury; zestaw zasad bez `opportunity` nie ma żadnej z tych mechanik.

Pytanie jest OKNEM i zatrzymuje całą walkę: nic nie rusza, dopóki wszyscy pytani nie odpowiedzą. Za członka drużyny odpowiada gracz, wybierając uderzenie lub sąsiednie Pass; za pozostałych odpowiada ich prowadzący, a za bossa Mistrza Gry – jego własna decyzja. Zob. Okna poniżej.

**Co przeciwnik robi z planszą.** Przeciwnik nieprowadzony przez nikogo ocenia każde osiągalne pole względem każdej dostępnej z niego opcji, odejmuje wartość za każde uderzenie wywołane ruchem i woli pozostać w miejscu, jeśli już może wykonać najlepszą akcję. Gdy nic nie jest w zasięgu, skraca dystans; najpierw sprintem, jeśli lista `standard` zawiera `dash`.

**Możliwe odmowy.** `out-of-reach` (poza zasięgiem), `no-line-of-sight` (stała przeszkoda na drodze), `unreachable` (pole, którego ruch nie może opłacić lub na którym nie może się zakończyć) i `bad-cell` (obszar skierowany w niedozwolone miejsce).

### Co walka robi z twoim blokiem na serwerze

Gra, której zestaw zasad deklaruje `combat`, otrzymuje walkę rozstrzyganą przez ten blok, w tym samym zapisanym obiekcie bitwy, którego Engine używał dotychczas:

- **Kto uczestniczy.** Mistrz Gry wskazuje walczących; Engine odczytuje liczby każdego członka drużyny z jego własnej karty. Członek bez karty dla twojego zestawu zasad jest odrzucany imiennie, zamiast otrzymać liczby, których nie ma w twoim zestawie.
- **Skąd pochodzą liczby przeciwnika**, w tej kolejności: stworzenie wskazane przez Mistrza Gry w bestiariuszu, następnie stworzenie o etykiecie pasującej do imienia przeciwnika, potem blok statystyk zaproponowany przez Mistrza Gry dla tej walki i ograniczony do skali zagrożenia, a na końcu zwykłe stworzenie zbudowane z liczb poziomu. Każdy wariant zastępczy i każde ograniczenie jest zapisywane zwykłymi słowami, by walka mogła wyjaśnić działanie. Zestaw zasad bez wpisu bestiariusza, propozycji i skali zagrożenia odrzuca walkę zamiast ją wymyślać.
- **Karty są zapisem stanu.** Zdrowie, pule, stany, koncentracja i liczniki zasad umierania są zapisywane przez własne reguły karty po każdej zaakceptowanej akcji, więc ponowne wczytanie w trakcie walki pokazuje dokładnie jej ostatni stan; nie ma końcowego rozliczenia bitwy, które mogłoby się z nim nie zgadzać.
- **Menu określa jedyne dozwolone działania.** Każdy działający, gracz lub przeciwnik, wybiera identyfikator z tego samego menu generowanego przez blok. Przeciwnik prowadzony przez Engine wybiera z niego według własnej taktyki Engine, a przeciwnik prowadzony przez Mistrza Gry otrzymuje prośbę o wybór jednego identyfikatora z tego samego menu, z twoimi liczbami i bez ujawniania wyników kości.
- **Twoje kości.** Walka przechowuje własne ziarno i kursor, więc po odczycie z dysku kontynuuje z kośćmi, którymi i tak by rzuciła.

### Na ekranie

Walka odbywa się na ekranie bitwy w twoich słowach. Menu zawiera twoje ataki, zdolności, testy przeciwstawne i wymienione akcje standardowe; każda wskazuje koszt z twoich budżetów i pul. Widać kolejność tur, rundę, każdy nazwany stan z pozostałymi rundami, punkty tymczasowe, koncentrację i dwa liczniki zasad umierania. Dziennik pokazuje rzeczywiste obliczenia w twoich pojęciach: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Każda zaakceptowana akcja jest natychmiast zapisywana na karcie, więc ponowne wczytanie w trakcie walki jest dokładne, a Mistrz Gry otrzymuje później informację, by nie zmieniać tych liczb ponownie.

Walka z pozycjami jest rysowana na planszy zamiast na scenie z portretami; działania gracza opisuje sekcja Pozycje. Każda odległość na planszy, w menu i dzienniku jest podawana w TWOJEJ jednostce: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Testy przeciwstawne: chwytanie, pchanie, uwalnianie się

Niektóre ruchy nie są atakiem przeciw obronie, lecz testem przeciwstawnym: obie strony rzucają, a ta, której pójdzie lepiej, dopina swego. Chwycenie kogoś, przewrócenie go lub odepchnięcie oraz uwolnienie się mają ten sam kształt, więc zestaw zasad zapisuje każde z nich jako dane:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** to liczby odczytywane przez test przeciwstawny, każda będąca wartością z karty, odczytywaną raz na początku walki, tak jak obrona lub rzut obronny. Stworzenie zapisane zwykłymi liczbami podaje własne (`"checks": { "brawn": 2 }`); stworzenie z kartą odczytuje je z niej. Najwyżej dwanaście.
- **Rzut.** Obie strony rzucają twoimi `attackRoll.dice` i dodają najlepszy z testów, których mogą tu użyć (`attacker.checks`, `defender.checks`). Wygrywa wyższa suma; remis wygrywa broniący się, chyba że `ties` ma wartość `"attacker"`. Dziennik podaje obie strony: "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Wygrana** robi to, co określa `onWin`, co najmniej jedną rzecz:
  - `applies` nakłada stany na przegranego, ze zwycięzcą jako ich źródłem, więc stan oznaczony `endsWhenSourceDown` kończy się, gdy trzymający padnie. `rounds` nadaje stanowi zegar; bez niego stan trwa, dopóki coś go nie zakończy.
  - `ends` zdejmuje stany z wykonawcy lub celu.
  - `push` przesuwa przegranego prosto od zwycięzcy, o tyle we własnej jednostce odległości, zatrzymując się przed czymkolwiek stałym, kimkolwiek stojącym, krawędzią planszy i narożnikiem zbyt ciasnym, by się przecisnąć. Jest wymuszony: nie zużywa ruchu przegranego i nikt w niego nie uderza. Walka bez planszy nikogo nie przesuwa. Przegrana nic nie robi; tak wygląda nieudany chwyt.
- **`from: { "holding": "held" }`** sprawia, że test przeciwstawny celuje tylko w tego, kto nałożył ten stan na wykonawcę, i pojawia się w menu tylko wtedy, gdy stan trwa: tak wyraża się uwolnienie.
- **`reach`**, we własnej jednostce odległości, to zasięg; po pominięciu – sąsiednie pole. `reach` i `push` wymagają `combat.distance`.
- **`strike: true`** pozwala testowi zastąpić jedno uderzenie, gdy akcja kupuje kilka, tak jak atak: wykonany jako pierwszy zużywa budżet i zostawia resztę uderzeń w zapasie; wykonany przy uderzeniach w zapasie kosztuje jedno z nich. Tak chwyta i pcha przykład referencyjny 5e.
- **W menu** test przeciwstawny ma własną grupę i podaje szansę wygranej. Przeciwnik prowadzony przez Engine rozważa go jak wszystko inne, ale umiarkowanie: chwyt lub pchnięcie coś przygotowują, a uwolnienie jest warte najwięcej, ale tylko w czasie trzymania. Mistrz Gry prowadzący przeciwnika wybiera z tego samego menu.
- Testy przeciwnika wymyślonego przez Mistrza Gry są ograniczane do jego poziomu, tak jak jego szansa trafienia.

Testy przeciwstawne wymagają Capability API 1.43 w zestawie dostarczanym jako pakiet.

<a id="windows-holding-the-fight-open"></a>

### Okna: wstrzymywanie walki

Niektóre chwile należą do kogoś innego niż bieżący wykonawca. Engine pozostawia dla niego walkę otwartą, zamiast decydować za niego; ta pauza jest oknem.

Otwiera je siedem sytuacji, z których dwie wynikają z już zadeklarowanych danych:

- **Ktoś odchodzi.** Ruch wychodzący z zasięgu wroga zdolnego do uderzenia zatrzymuje się na tym kroku i pyta wroga. Zob. Uderzenia w odchodzących powyżej.
- **Między turami.** Po zakończeniu tury, zanim zacznie się następna, każdy przeciwnik z `signaturePoints`, którego stać na własną akcję `signature`, jest pytany o jej zakup. Można je kupować tylko wtedy: akcji specjalnej nie ma w menu niczyjej tury, także własnej.
- **Ktoś czegoś używa.** Przed rozstrzygnięciem pytana jest każda osoba z DRUGIEJ strony mająca wpis oczekujący takiej chwili, niezależnie od tego, w kogo wycelowano, o ile ten wpis sięga używającego. Akcja standardowa i test przeciwstawny nie otwierają takiej chwili.
- **Coś zostaje w kogoś wycelowane.** Przed rozstrzygnięciem pytana jest każda osoba z DRUGIEJ strony, w którą wycelowano i która ma wpis oczekujący takiej chwili. Leczący sojusznik nie stanowi zagrożenia wymagającego odpowiedzi, więc jego akcja nie otwiera okna.
- **Rzut ataku kogoś trafia.** Przed obrażeniami pytany jest trafiony, jeśli ma wpis oczekujący takiej chwili. To, co wykona, liczy się dla tego ataku: zobacz niżej Chwila po trafieniu.
- **Coś kogoś zraniło.** Po rozstrzygnięciu pytana jest każda zraniona osoba mająca wpis oczekujący TEJ chwili, niezależnie od sprawcy. Otrzymanie obrażeń jest faktem dotyczącym ciebie; wpis kierowany z powrotem na sprawcę nadal nie może być skierowany na sojusznika.
- **Ktoś spada.** Przed obrażeniami i powaleniem, dla każdego, kto ma reakcję sięgającą spadającego i dopuszczającą jego stronę (Capability API 1.124).

- **Ktoś zaczyna swoją turę.** Zanim zadziała, dla wpisu, który sięga go po stronie swoich celów (Capability API 1.131).

Sześć ostatnich sytuacji wpis katalogu lub własna akcja stworzenia mogą zamówić, wskazując oczekiwaną chwilę. Gdy jedna akcja otwiera zarówno `used`, jak i `aimed`, najpierw pyta się o użycie; jeśli nikt go nie odwoła, następnie pyta się tych, w których wycelowano, a akcja rozstrzyga się po obu odpowiedziach. O trafienie pyta się przy każdym trafiającym rzucie, a o zranienie po zakończeniu całej akcji.

Działanie okna, niezależnie od przyczyny otwarcia:

- **Gdy jest otwarte, nic innego nie rusza.** Ani wykonawca bieżącej tury, ani jej zakończenie, ani inne okno. Walka czeka. Upadek wstrzymuje lądowanie, dopóki nie zakończy się krok akcji, który go spowodował; o kolejne upadki pyta się potem.
- **Pyta po jednej osobie**, w kolejności tur, każdą raz. Pasowanie zawsze jest odpowiedzią i nic nie kosztuje. Osoba bez dostępnego działania jest pomijana zamiast pytana.
- **Wznawia dokładnie od miejsca zatrzymania.** Ruch kończy się na pozostałych polach, płacąc za każde rzeczywiście przebyte.
- **Odpowiada ten, kto prowadzi.** Okno własnego członka drużyny należy do ciebie, z opcją i sąsiednim Pass w menu; za przeciwnika odpowiada prowadzący, a o bossa Mistrza Gry pytany jest Mistrz Gry, z możliwością przepuszczenia chwili jako jedną z odpowiedzi.
- **Jest zapisywane razem z walką.** Gra zamknięta w trakcie ruchu wraca z tymi samymi osobami do zapytania i polami do przejścia.

Dla pierwszych dwóch niczego dodatkowo nie deklarujesz: zestaw zasad z `opportunity.budget` otrzymuje jedno, bestiariusz z `signaturePoints` drugie, a zestaw bez obu nigdy ich nie widzi.

**Wskazanie chwili oczekiwanej przez wpis.** Zapisz `mechanics.reaction` jako obiekt zamiast `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` to `used`, `aimed`, `hit`, `harmed`, `falls` albo `turn-start` i umieszcza wpis w menu tego okna. Tylko te sześć chwil Engine obserwuje. Wpis nadal podający `"reaction": true` mówi jedynie, że nie wykonuje się go w turze; to za mało, by gdziekolwiek go zaoferować, więc nie pojawia się w żadnym menu.
- `at` to `source` (domyślne), `target` albo `chosen`. `source` kieruje wykonywaną akcję na sprawcę chwili i uzupełnia cel, więc nikt go nie wybiera; `chosen` zachowuje własne cele wpisu i pyta o wybór. `target` wskazuje stworzenie, którego dotyczy chwila. Odpowiedź na `falls` trafia w wybranych spadających.
- `cancels` całkowicie zatrzymuje wydarzenie wstrzymane przez okno. Może je podać tylko wpis `used` lub `aimed`: nie można odwołać tego, co już się wydarzyło, a trafienie zostało już rzucone.
- `against` zawęża to, na co wpis odpowiada, do rzeczy użytych z określonych katalogów: `"against": { "catalogs": ["spells"] }` odpowiada na zaklęcie i na nic innego. Akcja bez wpisu za sobą (broń na liście, własna akcja stworzenia) nie pochodzi z żadnego katalogu, więc nigdy nie otwiera tej chwili dla wpisu wskazującego katalogi. Pomiń `against`, a wpis będzie odpowiadał na wszystko.

Nadaj też `budget`, inaczej zostanie wydany domyślny budżet listy. Reakcja niemal zawsze zużywa własny budżet, który uniemożliwia kilka reakcji w jednej turze.

**Koszt jest wydawany, zanim ktokolwiek zostanie zapytany.** Anulowana akcja nie dochodzi do skutku, ale została już kupiona: budżet i pule są już zużyte. Jeśli twój system je zwraca, nie potrafi jeszcze tego zadeklarować.

Kontrę zapisuje się tak; na planszy odpowiada ona tylko komuś w obrębie własnego `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Kontra sięgająca tylko do pewnego poziomu** (Capability API 1.116). `"upTo": "paid"` w reakcji `used` anulującej akcję zatrzymuje tylko to, co opłacono na poziomie nie wyższym niż sama odpowiedź, a `"above": { "check": <value>, "dc": 10 }` to test, który mimo to zatrzymuje coś wyższego, przeciw `dc` plus jego poziom. Counterspell z 5e, który zatrzymuje zaklęcie o poziomie swojej komórki lub niższym, a powyżej wymaga testu atrybutu rzucania zaklęć przeciw 10 + poziom zaklęcia, rzucany na wyższym poziomie jak każde zaklęcie:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

Poziom wszystkiego, co opłacono, to poziom puli, z której pochodzi: własny `level` puli, wartość odczytywana z karty posiadacza, jeśli go podaje (komórki paktu z 5e, rzucane na poziomie komórki czarnoksiężnika), a w przeciwnym razie jej miejsce w grupie, przy czym pierwsza pula ma poziom 1. Coś, co nic nie kosztowało albo pochodzi z puli spoza grupy, ma poziom 0, więc każda taka kontra to zatrzymuje. Test używa własnych kości walki ze stanami odpowiadającego dotyczącymi testów; walka `dice-pool` nie ma trudności do osiągnięcia i odrzuca `above`. Stworzenie bez karty zapisuje swój test jako `{ "const": n }`. Dziennik podaje poziom i rzut zawsze, gdy odpowiedź sięga ponad siebie, a gdy zatrzymuje akcję, następuje zwykły wiersz. Bez `above` coś wyższego po prostu nie zostaje zatrzymane, a koszt odpowiedzi i tak zostaje poniesiony.

**Chwila po trafieniu.** Wpis z `hit` to sposób zapisania Shield, Parry i Uncanny Dodge. Atak zostaje wstrzymany po rzucie, a trafiony jest pytany, zanim zostaną zadane jakiekolwiek obrażenia. To, co wykona, liczy się dla tego ataku: jego rzut nie jest powtarzany, lecz ponownie sprawdzany względem obecnej obrony trafionego, więc stan dodający do obrony może zamienić trafienie w chybienie, a naturalny wynik, który zawsze trafia, nadal trafia. Stan trwający jeden atak (`endsAfter: "attacked"`) nałożony w odpowiedzi obejmuje ten atak, łącznie z obrażeniami, i zostaje przez niego zużyty; tak wyraża się "zmniejsz obrażenia tego ataku o połowę": `resist-all` na jeden atak.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

Atak wznawia się dokładnie tam, gdzie go wstrzymano: z pozostałymi celami, a w przypadku akcji stworzenia złożonej z innych akcji – z pozostałymi częściami. Każdy rzut trafiający kogoś, kto ma taką odpowiedź, zostaje po kolei wstrzymany, a walka zapisana przy otwartym oknie wraca w tym samym stanie. Atak wykonany wewnątrz okna (uderzenie w odchodzącego, akcja specjalna, odpowiedź) nigdy nie jest wstrzymywany, bo nic otwartego wewnątrz okna nie otwiera kolejnego. Gdy okno się otwiera, dziennik pokazuje rzut i to, przeciw czemu go wykonano, a gdy odpowiedź zmieniła obronę – czy atak teraz chybia. Przeciwnicy prowadzeni przez Engine bronią się tylko wtedy, gdy zamienia to trafienie w chybienie.

Pakiet wskazujący chwilę wymaga Capability API 1.33, a używający `used` lub `against` – 1.44. Pakiet czekający na `hit` wymaga 1.46.

**Odpowiedź na jedno zaklęcie wskazane z nazwy** (Capability API 1.117). `against` może wskazywać `entries` w postaci `<catalog>/<entry>` obok `catalogs`, a dopasowanie któregokolwiek otwiera chwilę. `also` przyjmuje tę samą odpowiedź w maksymalnie trzech kolejnych chwilach, każdej z własnym `against`. `noDamageFrom` stanu całkowicie chroni posiadacza przed obrażeniami od tych wpisów, dopóki stan działa, niezależnie od rodzaju obrażeń. Shield z 5e wykonuje się, gdy atak trafia i gdy w rzucającego wycelowano Magic Missile, a pod jego działaniem Magic Missile nic nie robi:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Anulować może tylko pierwsza chwila, więc reakcja anulująca nie ma `also`. Katalog wskazany przez wpis musi istnieć w zestawie. Wpis, którego w nim nie ma, po prostu nigdy nie otwiera chwili. Cios zatrzymany w ten sposób jest pokazywany w dzienniku jako taki, na który cel jest niewrażliwy.

**Odpowiedź tylko na niektóre ciosy** (Capability API 1.118). Chwila `hit` może zawierać `"blow": "melee"` lub `"blow": "ranged"`. Cios jest ciosem wręcz, dopóki cel stoi w zasięgu wręcz broni, więc sztylet rzucony z daleka to cios dystansowy, a ten sam sztylet użyty obok celu to cios wręcz. Broń z zasięgiem wręcz i bez zasięgu dystansowego jest zawsze bronią do walki wręcz, a broń z zasięgiem dystansowym i bez zasięgu wręcz zawsze dystansową. W walce bez planszy broń z zasięgiem wręcz traktuje się jak trzymaną w ręce. `"seesSource": true`, w dowolnej chwili poza `falls`, otwiera ją tylko wtedy, gdy posiadacz widzi sprawcę. Oznacza to linię wzroku między nimi na planszy (bez planszy wszyscy widzą wszystkich), a nigdy kogoś, kto wykonał akcję standardową Hide, dopóki jej działanie nie minie na początku jego następnej tury. Parry z 5e używa obu:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Oba klucze można też zapisać w chwili w `also`, a `blow` tylko w chwili `hit`.

**Łapanie spadających** (Capability API 1.124). Reakcja na `falls`, także w `also`, odpowiada na stworzenie spadające z krawędzi lub latającego zmuszonego do zejścia na ziemię, zanim upadek zada obrażenia lub go przewróci. Jej zasięg i strona celu są sprawdzane względem spadającego, a odpowiedź trafia w to stworzenie. Dla Feather Fall nadaj wpisowi taką mechanikę i zadeklaruj `feather_falling` w stanach bieżących karty:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Jego wpis `combat.conditions` to `{ "condition": "feather_falling", "fallsSafely": true }`. Dopóki ten stan trwa, zapobiega obrażeniom od upadku i stanowi prone, który nałożyłby upadek; nie usuwa stanu, który upadek spowodował. Użyj `targets: "self"` dla odpowiedzi tylko na upadek samego rzucającego. Upadek nie ma wpisu źródłowego, więc reakcja na niego nie może zawierać `cancels`, `blow`, `seesSource` ani `against`. Wpis jednocelowy pyta o każdy upadek osobno. To rozstrzyga lądowanie; nie śledzi spowolnionego opadania.

**Odpowiedź za inne stworzenie** (Capability API 1.131). `for` ma domyślnie wartość `self`; `ally` wyklucza posiadacza, a `any` go obejmuje. Oba pytają posiadaczy po stronie celu w wymaganej odległości `within`, w jednostce odległości katalogu, i tylko przy `aimed` lub `hit`. Te klucze działają też w każdej chwili w `also`. `seesSource` nadal wymaga widzenia atakującego. Protection nakłada `own-attacks-disadvantage` na źródło przed rzutem kośćmi ataku. Jego czas trwania `this-action` kończy się, gdy akcja się rozstrzygnie lub zostanie anulowana. Bez jawnego zasięgu wobec źródła odpowiedź postronnego sięga tego źródła; `within` mierzy odległość do chronionego stworzenia. Zadeklaruj `protected_attack` na karcie i nadaj jego stanowi bojowemu ten efekt:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Kierowanie odpowiedzi na cel.** `at: "target"` dotyczy atakowanego stworzenia, a `source` pozostaje atakującym. Shield Guardian modeluje noszącego amulet jako sojusznika w odległości 5; `parrying` daje `+2` do obrony. Wstrzymane trafienie po odpowiedzi ponownie sprawdza obronę tego sojusznika:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**Na początku tury.** `on: "turn-start"` pyta, gdy stworzenie po stronie celów wpisu zaczyna turę w jego zasięgu, zanim to stworzenie zadziała. To stworzenie jest `source`. Szkodliwy wpis odpowiada drugiej stronie, a pomocny własnej. Nie może zawierać `cancels`, `blow`, `against` ani `upTo`. Akcja stworzenia Unnerving Mask wymaga rzutu obronnego Wisdom; jedna runda na zegarze objętego stworzenia trwa przez tę turę i wygasa na jej końcu (pomiń `of: "source"`):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Anulowanie przy rzucie obronnym.** `cancelSave: { save, dc }` wymaga `cancels`; posiadacz rzuca ze swoimi zwykłymi modyfikatorami rzutów obronnych. Sukces anuluje, porażka pozwala rozstrzygnąć się pierwotnej akcji, a w obu przypadkach reakcja zostaje zużyta. `against.actions` wskazuje od jednej do dwunastu akcji z bloku statystyk, dopasowując całą nazwę bez względu na wielkość liter (każda do 80 znaków). Rock Catching modeluje łapanie skały przez anulowanie całego ataku, łącznie ze wszystkimi jego obrażeniami, a nie tylko obrażeń obuchowych. Identyfikatory rzutów obronnych pochodzą z twojego zestawu (tutaj `dex`; w dołączonym przykładzie 5e `dex_save`):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Łapanie kilku spadających.** Wpis `falls` z `targetCount` większym niż jeden oferuje kwalifikujące się stworzenia spadające wskutek jednego ciosu lub efektu, w zasięgu i po stronie jego celów. Menu i reżyser walki domyślnie wybierają wszystkie kwalifikujące się do tej liczby, zaczynając od najbliższych; gracz może zmienić wybór. Późniejszy upadek to osobne zdarzenie. Feather Fall używa tego samego stanu `fallsSafely` co wyżej:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Jeszcze niedostępne

Wprost, ponieważ zestaw zasad nie powinien przypisywać Engine nieistniejących możliwości:

- **Poza prostą planszą**: brak latania nad przeszkodami, przeciskania się i wierzchowców. Stworzenie przesuwa tylko jego własny ruch, teleportacja i to, co je pcha (test przeciwstawny, wpis, akcja stworzenia lub strefa). Nikt nie ciągnie trzymanego stworzenia.
- **Test przeciwstawny jest prosty.** Jego rzut nie otwiera okna, ale na spowodowany przez niego upadek można odpowiedzieć.
- **Wpis może oczekiwać tylko sześciu chwil**, `used`, `aimed`, `hit`, `harmed`, `falls` i `turn-start` (zob. Okna powyżej). Te chwile Engine obserwuje w imieniu wpisu; dwa pozostałe okna, odejście i pauza między turami, otwiera sama walka, więc wpis nie może o nie prosić. Nie ma chwili rzutu obronnego ani śmierci.
- **Bez łańcucha okien.** Walka przechowuje jedno okno zamiast stosu, więc nic wewnątrz okna nie otwiera kolejnego: kontry nie można skontrować, obrażenia reakcji nie otwierają następnej chwili, a atak wykonany wewnątrz okna nie jest wstrzymywany, gdy trafia. Upadek, na który można odpowiedzieć, spowodowany w trakcie okna jest wstrzymywany do jego zamknięcia, a potem pyta się o niego po kolei.
- **Trafieniem jest tylko rzut ataku.** Coś, co trafia bez niego (pociski, które po prostu trafiają, obszar, przeciw któremu wszyscy wykonują rzut obronny), nie otwiera chwili `hit`.
- **Modyfikatory obrażeń dotyczą trafień atakiem.** Odpowiedź może nałożyć modyfikator obrażeń na posiadacza albo zmniejszyć o połowę przychodzące obrażenia przez `resist-all`; modyfikatory obrażeń nigdy nie zmieniają efektu opartego wyłącznie na rzucie obronnym.
- **Nie ma zwrotów.** Koszt anulowanej akcji pozostaje wydany.
- **To, co zmienia stan, jest zamkniętą listą.** Obrona, rzuty ataku, rzuty obronne, testy przeciwstawne, szybkość, maksimum zdrowia, zadawane obrażenia i otrzymywane obrażenia (także dla poziomów i efektów przedmiotów). Modyfikatory obrażeń zmieniają tylko trafienia atakiem; nigdy nie dodają się do obrażeń opartych na rzutach obronnych ani do automatycznych trafień.
- **Stworzenie zapisane zwykłymi liczbami nie ma toru ran.** W zestawie zasad ze zdrowiem jako torem takie stworzenie nadal traci punkty; nadaj mu `sheet`, by ciosy zaznaczały pola po wcześniejszym uwzględnieniu jego `resist`, `vulnerable` i `immune`.
- **Efekt dodatkowy uruchamia się sam.** `on` ma jedną wartość, `hit`, więc otrzymuje go pierwsze kwalifikujące trafienie okresu; nie ma chwili, w której pojawia się pytanie, czy go zużyć.
- **Wartość przesuwana atakami jest prosta.** Cios wydający rzuca tą wartością i niczym więcej, więc żadna broń jej nie zmienia, łącznie z jej `floor` (wytrzymały cel pochłania cios zabierający, a jego twardość zatrzymuje cios wydający, ale nic innego nie zmniejsza żadnego z nich); załamanie ustępuje po stałej liczbie tur, niezależnie od jego głębokości; a atak wykonany w oknie (uderzenie w odchodzącego, reakcja, akcja specjalna) jest wykonywany w pierwszym stylu.
- **Wymyślony przeciwnik niczego nie pochłania i nie ma twardości.** Stworzenie wymyślone przez Mistrza Gry na jedną walkę jest dopasowywane do twojej skali zagrożenia, która nic nie mówi o pochłanianiu ani twardości, więc nie ma żadnego z nich.

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
- `currencies` usuwa monety: `removeUnits` wskazuje pojedyncze monety, a `removeFamilies` całe rodziny. Najmniejsza moneta rodziny znika tylko razem z rodziną, więc każda pozostała rodzina nadal może płacić i wydawać resztę. Gdy warstwa jest włączona, nikt nie zarabia usuniętej monety, nie płaci nią, nie wybiera jej ani nie znajduje jej w łupach, a wiersz sakiewki ją pomija. Cena podana w takiej monecie jest wyrażana w największej pozostałej monecie, która pokrywa ją dokładnie, przy tej samej wartości: długa noc z Gravewatch usuwa koronę, więc pistolet strażniczy za 3 korony kosztuje 15 szylingów. Przedmiot, którego cała rodzina monet zniknęła, nie ma ceny.

**Czego warstwa nie może robić.** Nie może dodać wartości wyliczenia, pola, umiejętności, puli ani odpoczynku, zmienić rodzaju rozstrzygania, dotknąć bieżącego stanu lub liczb walki ani dodać wywołania modelu. Wartość _dodana_ przez warstwę byłaby nieznana wszystkim innym czytnikom karty, więc wartości mogą jedynie znikać. Wszystko poza tą listą wymaga zmiany samego zestawu zasad albo drugiego zestawu.

**Konflikty.** `conflicts` wskazuje warstwy, których nie można włączyć razem. Wystarczy zadeklarować jedną stronę pary. Kreator wyłącza drugi przełącznik; jeśli zapisany wybór mimo to zawiera obie warstwy, odrzuca zadeklarowaną **później**, więc te same dwa wybory zawsze dają te same zasady.

**Karta już zawierająca usuniętą wartość zachowuje ją.** Nic nie przepisuje postaci. Edytor przestaje jedynie oferować wartość, a postać, która już ją miała, nadal ją pokazuje. Wyłącz warstwę w nowej grze, a wartość znów będzie oferowana. Tak samo działa ukryty wpis katalogu: znika z selektora, a wcześniej wybrany wiersz pozostaje na karcie. Monety usunięte przez warstwę, które ktoś już niesie, zostają w jego torbie.

**Limity.** 12 warstw na zestaw zasad i 4000 znaków instrukcji na warstwę, łącznie dla obu tekstów. Pakiet zestawu zasad deklarujący `layers` lub bazowe `gm.worldGuidance` wymaga Capability API 1.25, a taki, którego warstwy usuwają monety – 1.64. Importowany zestaw zasad weryfikuje odczytujący go Engine, więc niczego takiego nie potrzebuje.

**Warstwy pisane przez inne osoby** (warstwa małej ilości magii dla cudzego zestawu zasad, dostarczana w osobnym pliku) są późniejszym rozszerzeniem. Obecnie warstwa jest dostarczana wewnątrz zestawu, do którego należy.

<a id="trying-your-ruleset"></a>

## Wypróbowanie zestawu zasad

Zestawy zasad społeczności używają tego samego przełącznika co importowani agenci. Otwórz **Settings** (ustawienia) > **Advanced** (zaawansowane) > **Danger Zone** (strefa niebezpieczna) i upewnij się, że **Allow custom Agent imports** (zezwalaj na import własnych agentów) jest włączone. Import wymaga też dostępu przez localhost lub skonfigurowanego **Admin Access** (dostępu administratora).

1. Otwórz panel **Agents** i wybierz przycisk **Import agents** (importuj agentów; ikona pobierania w rzędzie przycisków u góry panelu).
2. Wybierz **Game Mode ruleset** (zestaw zasad trybu Game) i swój plik JSON albo plik pakietu zestawu zasad z końcówką `.ruleset.json` (zobacz [Udostępnianie zestawu zasad](#sharing-your-ruleset)).
3. Przeczytaj podgląd. Pokazuje nazwę, wersję, licencję, zakres obsługi zestawu zasad i tekst Mistrza Gry. Wybierz **Import** (importuj).

Twój zestaw zasad pojawi się w sekcji **Rules** (zasady) panelu oraz w wyborze **Rules** kreatora nowych gier. Zestaw importowany z pliku jest zapisywany jako `local/<your id>`, więc nie można pomylić go z oficjalnym zestawem ani z cudzym.

### Zmiana już zaimportowanego zestawu zasad

Zaimportowana wersja nigdy nie jest nadpisywana. Jeśli zmienisz plik i zaimportujesz go ponownie z tym samym `version`, import zostanie odrzucony z prośbą o zwiększenie numeru. To celowe: gra jest związana z dokładną wersją, na której ją utworzono, więc trwająca kampania nigdy nie obudzi się z inną matematyką.

Cykl podczas tworzenia wygląda więc tak: edytuj, zwiększ `version`, importuj, rozpocznij nową grę. Stare wersje pozostają zainstalowane obok nowej, dopóki nie usuniesz zestawu z sekcji **Rules**. Usunięcie zestawu nadal używanego przez grę sprawia, że gra zgłasza jego brak aż do ponownego importu.

Jeśli zmienisz kształt karty (dodasz, usuniesz lub zmienisz nazwy elementów), zwiększ też `sheet.version`. Istniejące karty są odczytywane tolerancyjnie: wartości nieznane nowej karcie zostają zachowane, a brakujące otrzymują wartości domyślne.

### Przenoszenie wartości do nowych identyfikatorów: `sheet.migrations`

Dodawanie elementów nie wymaga niczego więcej. Gdy nowy układ przenosi wartość w inne miejsce (pole o zmienionej nazwie, jeden poziom, który staje się poziomem dla każdej klasy, jedna pula kości wytrzymałości, która staje się pulą dla każdej kości), opisz to w `sheet.migrations` (Capability API 1.77), aby każda postać utworzona w starym układzie zachowała swoje liczby: w bibliotece, w grach, w starych zapisach, gałęziach i punktach kontrolnych oraz w zaimportowanych kartach.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Każdy wpis przenosi zapisaną kartę z wersji `from` do `from + 1` i działa dla każdej karty zapisanej w tej wersji lub starszej, po kolei. Nigdy nie usuwaj wpisu, który już został opublikowany: karta zapisana dawno temu nadal go potrzebuje. Wersja, która tylko dodaje, nie potrzebuje żadnego wpisu.
- `rename` (`ability`, `skill`, `save` lub `field`): wartość jest kopiowana pod nowy identyfikator. Umiejętność lub rzut obronny zabiera ze sobą swoją premię. Zmiana nazwy może kontynuować zmianę z wcześniejszego wpisu albo zasilać pole, które późniejsze `route` przekazuje dalej; import podąża łańcuchem do jego końca.
- `route`: wartość jednego pola trafia do pola wskazanego tekstem innego pola. Przypadek wygrywa, gdy jego słowa pojawiają się w tekście `by` jako całe słowa (słowo tworzą tylko litery, więc "Fighter3" wskazuje fightera), bez względu na wielkość liter, i gdy pasuje dokładnie jeden przypadek. Jeśli nie pasuje żaden albo pasuje kilka ("Fighter 3 / Wizard 2", między które nie da się podzielić jednej liczby bez pytania), wartość trafia do `else`. `default` zastępuje wartość w karcie, która nigdy jej nie zapisała. `by` to pole, które karta ma, albo takie, którego nazwę zmienił wcześniejszy układ. Celami są pola liczbowe lub tekstowe bez wartości domyślnej albo z wartością domyślną 0 lub pustą: wartość trafia do jednego z nich, a każde inne zachowuje wartość domyślną, więc każda inna wartość domyślna wyglądałaby jak poziom, którego nikt nie przyznał. Cel, który późniejsza zmiana nazwy przenosi dalej, jest śledzony do nowego miejsca.
- `routeLive` (`pool` lub `track` stanu bieżącego): zapisana wartość trafia do tego z `cases`, który pokazuje zmigrowana karta (pula z maksimum powyżej 0, tor, którego karta nie ukrywa), a w przeciwnym razie do `else`. Tory, do których trafia wartość, są albo wszystkie torami ran (przenosi znaczniki), albo wszystkie zwykłymi torami (przenosi liczbę).
- Każdy krok budowy kopiuje: stara wartość pozostaje na miejscu, więc starsza wersja twojego zestawu zasad nadal odczytuje kartę tak jak wcześniej. Krok nigdy nie nadpisuje wartości, która już jest w jego celu.
- Import odrzuca wpis z wersją równą `sheet.version` lub wyższą, dwa wpisy z tej samej wersji, krok zapisujący do identyfikatora, którego karta nie ma, przypadek wymieniony dwa razy oraz `rename` lub `routeLive` odczytujące identyfikator, który karta nadal ma (przeniesiony identyfikator nigdy nie jest ponownie używany, i to sprawia, że te kroki można bezpiecznie uruchamiać wielokrotnie).
- Karty są migrowane przy każdym odczycie, a nowy układ zostaje zapisany przy następnej edycji. Stan bieżący nie ma własnej wersji, więc `routeLive` działa przy każdym odczycie: stary klucz jest usuwany, a jego wartość przenoszona tylko wtedy, gdy nowego klucza jeszcze nie ma, więc wartość wydana lub odnowiona odpoczynkiem od tego czasu nigdy nie zostaje nadpisana. To, dokąd trafiła, rozstrzyga pierwszy zapis po aktualizacji: karta poprawiona później (poziom klasy przeniesiony ręcznie) nie przenosi jej ponownie. Walka już trwająca, gdy pojawi się nowa wersja, nadal kończy się jak wcześniej.

<a id="sharing-your-ruleset"></a>

## Udostępnianie zestawu zasad

**Jako plik.** Wyślij znajomemu plik JSON. Zaimportuje go tak samo jak ty.

**Jako plik pakietu.** Zestaw zasad zbyt duży na jeden plik, z katalogami we własnych plikach, przenosi się jako jeden zwykły plik JSON o nazwie `<name>.ruleset.json`. Zawiera manifest pakietu i dokumenty zestawu, każdy jako dokładne bajty zakodowane w base64:

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

Manifest wymienia `ruleset.json` i każdy `catalogs/<id>.json` w `contributions.assets.paths` oraz w `files`, z rozmiarem i sha256 każdego z nich. Tworzy go edytor zestawów zasad, np. Pixelforge. **Import agents** → **Game Mode ruleset** przyjmuje plik i pokazuje ten sam podgląd co dla pliku zestawu zasad, z każdym katalogiem i liczbą jego wpisów. Nic w nim nie jest skompresowane, więc nigdy nie zawiera więcej niż własny rozmiar. Jest odczytywany jako dane i nigdy nie jest instalowany jako pakiet: zostaje odrzucony, z podaniem powodu, jeśli zawiera cokolwiek innego (inny klucz, jakikolwiek inny plik, dokument, który nie jest ściśle zakodowany w base64 lub nie jest tekstem UTF-8), jeśli jego manifest zawiera więcej niż zestaw zasad (jakikolwiek kod, uprawnienia lub inne elementy), jeśli plik nie jest tym, który wymienia manifest, jeśli `$comment` jest dłuższy niż 2000 znaków albo `$schema` wskazuje cokolwiek poza własnym schematem Engine, albo jeśli zestawu zasad lub katalogu nie da się odczytać. Jest zapisywany jako `local/<its id>` tak jak plik zestawu zasad, ma najwyżej 24 MB i najwyżej 12 plików katalogów po 2 MB każdy. Wersja to zestaw zasad razem z katalogami, więc zmieniony katalog także wymaga wyższego `version`. Pakiety zestawów zasad nie są przyjmowane jako archiwa zip.

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
