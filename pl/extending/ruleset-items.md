# Przedmioty zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Co nosi drużyna: kategorie, broń, pancerz, amunicja, łupy, pieniądze, początkowy sprzęt i targi.

Pancerz, broń, mikstury, wyposażenie, amunicja i pieniądze to przedmioty. Opcjonalny blok `items` deklaruje słowa, którymi opisuje się każdy przedmiot twojego zestawu zasad, a katalog z `holds: "items"` wymienia same przedmioty. Oba wymagają Capability API 1.49; `rarityCaps` i `propose` bloku, które dotyczą przedmiotów wymyślanych przez Mistrza Gry, wymagają 1.51, wartość odczytująca przedmioty posiadane przez postać (`itemStat`) – 1.52, działanie przedmiotu na testy, gdy jest założony lub niesiony, wraz z limitami `bonus` bloku – 1.53, wymagania przedmiotu wobec noszącego i zmieniane przez niego atrybuty – 1.54, `attack` broni – 1.55, działanie przedmiotu w walce – 1.56, to, czym broń strzela i ile ma załadowane – 1.57, tryby broni, atak drugą ręką, minimum obrażeń i stany przy trafieniu – 1.58, działanie użycia przedmiotu w walce wraz z jego ładunkami – 1.59, użycie przywracające pulę – 1.60, ładunki odzyskiwane przy odpoczynku lub przedmiot niszczący się po opróżnieniu – 1.61, użycie wymagające najpierw testu (`gate`) – 1.62, tabele łupów i łupy stworzenia – 1.63, pozycja łupów dająca monety lub warstwa usuwająca monety – 1.64, targ, miejscowość `sold` przedmiotu i `service` – 1.65, dzień targowy (sakiewka, `buyBack`, `stock` sprzedawcy, liczba `limited` albo `sold` bez wskazanej miejscowości) – 1.69, efekt dodatkowy działający przy trzymanej broni (`weapons`) – 1.70, początkowy sprzęt (`startingGear`) – 1.78, a ryzykowny przedmiot, podróbka lub nieuczciwy sprzedawca – 1.79.

## Blok przedmiotów

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
- `carry`: opcjonalne. `stat` wskazuje statystykę liczbową będącą wagą przedmiotu, której `min` wynosi 0 lub więcej. `encumberedAbove` to ilość, jaką postać może nieść, zanim stanie się przeciążona, a `limit` (opcjonalne) to najwięcej, ile w ogóle może unieść. Obie wartości odczytuje się z arkusza tak jak `binding.max`. Bez `carry` waga nic nie znaczy i nikt nigdy nie jest przeciążony. `unit` (opcjonalne, do 12 liter, Capability API 1.791) to jednostka, w której podawana jest waga, np. `"lb"`: obciążenie ekwipunku, wagi w selektorze początkowego wyposażenia i waga opcji zestawu podają ją po liczbie.
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

## Przedmiot

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

## Co odczytuje przedmioty

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

## Przedmioty w arkuszu

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

## Testy poza walką

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

## Typowane obrony ze stanów, poziomów, przedmiotów i wierszy arkusza

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

## Broń w walce

Przedmiot może być bronią (Capability API 1.55). Jego `attack` ma kształt [wierszy ataków](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) bloku walki, z wartościami zamiast kolumn, a [walka według zestawu zasad](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) oferuje go jako atak, gdy przedmiot jest założony: trzymany w rękach, których wymaga, i powiązany, jeśli wymaga powiązania. Broń schowana lub tylko niesiona niczego nie oferuje, a wiersze ataków i własne akcje stworzeń działają dokładnie jak wcześniej. Toporek z Ember Roads:

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

### Amunicja i przeładowanie

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

### Tryby, druga broń, minimum obrażeń i stany przy trafieniu

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
- `plus`: do trzech dodatkowych wielkości przy każdym trafieniu, każda jako `{ "dice", "flat", "type", "save", "targetIs", "when" }`, rzucana, typowana i redukowana przez odporność osobno (Capability API 1.169). `save` wskazuje własne `difficulty` i `onSuccess` (`half` lub `none`). `targetIs` zadaje ją tylko celowi tych typów stworzeń lub z tymi tagami (zobacz Typy stworzeń i testy celu w sekcji [Wszystkie klucze](ruleset-combat.md#every-key) na stronie o walce). `when: "critical"` zadaje ją tylko przy trafieniu krytycznym; kości każdej klauzuli są przy trafieniu krytycznym podwajane tak jak kości broni. Javelin of lightning to `{ "dice": "4d6", "type": "lightning" }`; dragon slayer to `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; sword of sharpness to `{ "flat": 14, "type": "slashing", "when": "critical" }`. Prognoza liczy klauzulę tylko przeciw celowi, którego dotyczy, i nigdy nie liczy klauzuli działającej wyłącznie przy trafieniu krytycznym. `when: "toggled"` zadaje ją tylko wtedy, gdy przełącznik przedmiotu jest włączony (Capability API 1.170, zobacz niżej `toggle`).

Szczegóły broni i wiersz dla Mistrza Gry podają to wszystko: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` i `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

## Pancerz i efekty założonych przedmiotów w walce

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

## Używanie przedmiotów w walce

Przedmiotu można użyć w walce (Capability API 1.59): okład przyłożony do rany, wypity tonik, dzwonek, w który się dzwoni. Jego `use` określa działanie użycia słowami `mechanics` wpisu katalogu (zobacz [Co walka odczytuje z `mechanics`](ruleset-combat.md#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` lub `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire`, a od Capability API 1.174 także `concentration` i `zone`, ze zużywanym `budget` albo `free`. Okład z Ember Roads oraz rozgrzewający tonik i dzwonek świtu z Gravewatch:

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

## Przedmioty w bitwach Classic i Tactical

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

<a id="loot"></a>

## Łupy

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
- Stworzenie z bestiariusza wskazuje swoją tabelę przez `loot` (zobacz [Stworzenia](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). Wygrana walka według zestawu zasad losuje z tabeli każdego pokonanego stworzenia, a walka, której Engine nie rozstrzyga według twoich zasad, nie ma stworzeń z bestiariusza, więc nic nie daje.
- Łupy trafiają do wspólnego widoku tak jak dodanie przedmiotu, najpierw do torby gracza, a to, czego nikt nie uniesie, zostaje na miejscu. Podsumowanie otrzymywane przez Mistrza Gry podaje, co wypadło i że jest już w torbach; dziennik przygody to odnotowuje, a powiadomienie to pokazuje.
- Mistrz Gry losuje z tabeli w opowieści przez `[loot: table="grave_goods" who="Ada"]` (`who=` dla torby jednej postaci), mierzone od początku tury jak jego znaczniki ekwipunku, więc ponownie wygenerowana odpowiedź daje łupy raz. Każdy wypadający przedmiot otrzymuje odpowiedź jak przy dodaniu, a instrukcje tej komendy wymieniają twoje tabele.

## Pieniądze

Twoje `currencies` to pieniądze drużyny. Moneta jest przedmiotem w torbach, stosem każdej monety jak każdy inny, nazwanym jej `label`:

- Waży jedną jednostkę twojej statystyki udźwigu na każde `perWeight` monet swojej rodziny, liczy się do obciążenia posiadacza i przy otrzymaniu jest rozmieszczana według reguły noszenia. Rodzina bez `perWeight` nic nie waży.
- Gracz dodaje monety z listy **Coins** (monety) w selektorze, a dzieli, przekazuje i łączy je jak każdy stos.
- Wiersz nad stosami ekwipunku pokazuje widoczne monety każdej rodziny i ich wartość w najmniejszej monecie rodziny. Mistrz Gry widzi tę wartość obok każdej torby (`Coin worth 432 pennies` albo `no coins` dla pustej sakiewki, przy czym torba gracza jest wymieniana nawet wtedy, gdy nic nie zawiera), a `cost` przedmiotu obok przedmiotu (`costs 3 shillings`).
- Mistrz Gry płaci przez `[inventory: action="pay" amount="3 shillings" who="Ada"]` i otrzymuje zapłatę przez `action="earn"`. `amount` to liczba i moneta, przez identyfikator lub etykietę, w liczbie pojedynczej lub mnogiej, bez względu na wielkość liter (`1 penny`, `12 pennies`). Płatność pochodzi z jednej torby (gracza, bez `who=`) i tylko z rodziny danej monety: najpierw idą największe pasujące monety, potem rozmieniana jest najmniejsza pozostała moneta pokrywająca resztę należności, a reszta wraca w mniejszych monetach rodziny, od największych. Odpowiedź podaje, co zapłacono i co wróciło: 3 szylingi z sakiewki z jedną koroną to `Paid with crowns ×1; shillings ×2 back.` Płatność, której torba nie pokryje, jest odrzucana (`cannot-afford`), tak samo moneta, której nie masz (`unknown-coin`), i każda płatność w zestawie bez walut (`no-currencies`). Zarobek to dodanie tej monety do torby `who` albo rozdzielenie jej według reguły noszenia. Dziennik przygody wymienia wydatki i zarobki, a powiadomienie je pokazuje. Instrukcje tych komend wymieniają twoje monety i dostaje je tylko zestaw zasad, który jakieś ma.
- Zakup to płatność, a potem dodanie przedmiotu albo, w zestawie z targiem, `buy` (niżej). Nie ma ekranu sklepu.

## Początkowy sprzęt

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

## Targi

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

### Dzień targowy

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

### Uczciwi i nieuczciwi sprzedawcy

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

<a id="spotting-fakes"></a>

### Rozpoznawanie podróbek

Capability API 1.802 pozwala postaci rozpoznać podróbkę dzięki wykonanemu testowi lub zauważeniu jej, zanim ktokolwiek zapłaci. Engine nie zna nazw żadnych testów: zapisuje je zestaw zasad.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** na podróbce (do sześciu): każdy wpis to test, który może wykonać każdy (`check` to umiejętność, atrybut lub wartość z arkusza postaci, tak jak wskazuje je `gate` użycia), jego trudność `dc` oraz to, co ujawnia sukces (`says`). `needs` określa wymagania, które arkusz postaci musi spełniać, aby w ogóle można było wykonać test (z `needsAny` wystarczy dowolne z nich), a `carries` – przedmiot, który postać wykonująca test musi mieć we własnej torbie, np. zestaw, za pomocą którego wykonuje się test narzędzia. Jeśli spełniona jest dowolna pozycja z `advantageIf`, test wykonuje się z ułatwieniem, a jeśli dowolna z `disadvantageIf` – z utrudnieniem.
- **`manner`** u nieuczciwego sprzedawcy: test dotyczący sprzedawcy zamiast przedmiotu, z tymi samymi elementami. Sukces mówi, że coś jest nie tak z tym, co sprzedaje, ale nigdy nie mówi, co to jest.
- **Badanie**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` ogląda przedmiot w torbie Miry, a `seller="Fence"` ogląda towar, który obecny tu sprzedawca pokazuje dzisiaj, zanim ktokolwiek go kupi. Przycisk **Inspect** (Zbadaj) w ekwipunku, dostępny w zestawie zasad, którego podróbki można wykryć, przekazuje tekst "Uważnie oglądam swoją miksturę Potion of Healing, zanim jej zaufam.", aby mistrz gry zapisał tag. Engine wykonuje najlepszy test, jaki postać może wykonać w tej sprawie, używając kości zestawu zasad: oznak podróbki oraz zachowania nieuczciwego sprzedawcy. Sukces w przypadku podróbki wzbudza podejrzenia: odpowiedź mówi, co postać dostrzegła, a torba pokazuje "Mira uważa, że to podróbka", choć przedmiot nadal nazywa się tak, jak przedmiot, który udaje. Sukces w teście oznaki o `items.namesItAt` lub więcej ponad trudność (5 w 5e) ujawnia także jego nazwę i od tej chwili jest on swoim prawdziwym przedmiotem. Dla prawdziwego przedmiotu wykonuje się testy oznak podróbek, które go udają, więc samo żądanie testu niczego nie zdradza, a sukces mówi, że przedmiot wygląda na autentyczny. Każda postać próbuje raz na przedmiot (stos pamięta, kto już próbował; towar jest pamiętany przez dzień targowy); porażka mówi, że postać nie potrafi tego rozstrzygnąć. Próba zbadania przedmiotu, którego nic nie mogłoby zdradzić, lub takiego, którego postać w ogóle nie może sprawdzić, jest odrzucana z `nothing-to-check` i nie zużywa próby.
- **Zauważenie przed zakupem**: gdy zakup dałby podróbkę od nieuczciwego sprzedawcy, każdy inny członek drużyny ocenia każdy test, który może wykonać w sprawie przedmiotu i sprzedawcy, bez rzucania kośćmi: `items.passiveBase` (domyślnie 10) plus swoją wartość, o 5 więcej z ułatwieniem i o 5 mniej z utrudnieniem. Pierwsza osoba, która osiąga trudność, zauważa coś podejrzanego: nic nie jest płacone, a odpowiedź na zakup zawiera `reason="held"` oraz informację, kto co zauważył. Mistrz gry otrzymuje prośbę, aby odegrać to jako ostrzeżenie kupującego przez tę osobę z drużyny, zgodnie z jej postacią, bez oskarżania sprzedawcy wprost, chyba że wynikałoby to z jej osobowości, i pozostawić decyzję kupującemu. Gracz nie dowiaduje się niczego więcej. Ponowna prośba o ten sam zakup od tego sprzedawcy tego samego dnia dochodzi do skutku. `items.warnBy: "roll"` zamiast tego wykonuje te testy rzutami kośćmi.
- **Przejrzenie podróbek**: `items.revealsFakes` wymienia sposoby przejrzenia podróbek, które postać może rzucić na przedmiot (zaklęcie, rytuał), każdy z `id`, własną etykietą `label` oraz, jeśli wykrywa tylko niektóre podróbki, ich tagami `tags` albo odwołaniami do samych podróbek (`items`, którymi mogą być tylko podróbki). Wskazanie podróbek pozwala nie umieszczać na nich zdradzającego je tagu: mikstura trucizny z tagiem "poison" zdradziłaby się obok mikstury leczenia, którą udaje. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` wskazuje jeden z tych sposobów: podróbka, którą wykrywa, zostaje nazwana, ta, której `foolsReveal` go wymienia, pokazuje się jako przedmiot, który udaje, a podróbka, której nie potrafi wykryć, lub prawdziwy przedmiot nie ujawnia niczego ("autentyczny" w przypadku sposobu wykrywającego każdą podróbkę, w przeciwnym razie "brak pewności"). Nie zużywa to próby; wszelki koszt rzucenia rozstrzyga mistrz gry, jak przy każdym zaklęciu.
- Zestaw zasad korzystający z dowolnej z tych funkcji wymaga Capability API 1.802. `tells` lub `foolsReveal` podróbki na przedmiocie, który nie jest podróbką, przedmiot `carries` lub przedmiot `revealsFakes`, który nie należy do zestawu zasad (w przypadku `items` musi to być podróbka), oraz identyfikator `foolsReveal`, którego nie wymienia `revealsFakes`, są odrzucane przy instalacji.

<a id="using-items-outside-a-fight"></a>

## Używanie przedmiotów poza walką

To samo `use` działa poza walką (Capability API 1.60 dla `restore`; reszta nie wymaga niczego nowego). Przycisk **Use** w ekwipunku, na twoim przedmiocie z `use`, oraz `[inventory: action="use" item="Poultice" who="Juno"]` Mistrza Gry wykonują działanie przedmiotu na tym, kto go niesie, kośćmi Engine:

- Leczenie przywraca zdrowie: ilość w puli zdrowia lub na zwykłym torze zdrowia albo jeden usunięty znacznik na torze ran, tak jak leczenie w walce. Punkty `temporary` trafiają do puli zdrowia, `restore` przywraca swoją pulę, a każdy stan z `applies` zostaje nałożony, dopóki coś go nie zdejmie.
- Użycie raniące lub wymierzone w drugą stronę (`kind` `attack` lub `debuff` albo `targets` `enemy`) nikogo nie trafia: poza walką na planszy nie ma nikogo do trafienia. Przedmiot i tak zostaje użyty, a Mistrz Gry dowiaduje się, co robi, aby to opisać.
- Odejmuje jedną sztukę ze stosu lub wydaje ładunki dokładnie tak jak walka, a przedmiot bez pozostałych ładunków albo zajmujący miejsce lub wymagający powiązania i niezałożony jest odrzucany i niczego nie zmienia. Arkusz i torba są zapisywane razem.
- Najpierw rzuca się `gate`, tak jak test: kośćmi zestawu zasad, z wartością z arkusza, karą za rany użytkownika i działaniem jego stanów oraz przedmiotów założonych lub niesionych na ten test. Nieudany zużywa przedmiot na nic, a wiersz to odnotowuje ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

To, co się stało, podaje jeden wiersz: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." Przycisk Use wysyła go Mistrzowi Gry w bloku `[item_used]` po "I use my Poultice.", który czat pokazuje jako plakietkę; na własny znacznik Mistrza Gry odpowiada się tym wierszem, mierzonym od początku tury jak jego inne znaczniki, więc ponownie wygenerowana odpowiedź nigdy nie użyje przedmiotu dwa razy. Przedmiot bez `use` albo w grze bez zestawu zasad jest nadal po prostu opisywany: "I use my rope."
