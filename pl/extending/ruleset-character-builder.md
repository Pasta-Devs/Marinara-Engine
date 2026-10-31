# Kreator postaci zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Prowadzony kreator: tworzenie postaci krok po kroku, od rasy i klasy po wyniki, biegłości, zaklęcia i sprzęt.

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

Do 32 kroków, każdy jako `{ id, label, kind, ... }`; pakiet z więcej niż 16 krokami deklaruje Capability API 1.112, a z więcej niż 24 – Capability API 1.768:

- `catalog`: wpisy katalogu wierszy, pokazywane jako kafelki z `summary` pod przyciskiem **Info** (informacje). `min` (domyślnie 1) to liczba wyborów wymaganych przez krok, a `max` (domyślnie 1) – największa liczba, jaką przyjmuje; przy `max` 1 nowy wybór zastępuje stary. Oba mogą wynosić do 60; pakiet z którymkolwiek powyżej 20 deklaruje Capability API 1.110, a z którymkolwiek powyżej 40 – Capability API 1.768 (księga zaklęć czarodzieja na 20. poziomie mieści 44 zaklęcia). `field` wskazuje pole tekstowe lub wyliczeniowe, do którego zapisywane są etykiety wybranych wpisów (pole wyliczeniowe przyjmuje identyfikator lub etykietę wpisu, zależnie od tego, które jest jedną z jego wartości). `filters` ustala wartości filtrów katalogu, a `within: { step, filter }` oferuje tylko wpisy, których `filter` wskazuje wpis wybrany we wcześniejszym kroku, tak jak podrasa wskazuje swoją rasę; po odznaczeniu rasy jej podrasa przestaje się liczyć. `upTo: { filter, value }` (Capability API 1.87) oferuje tylko wpisy, których liczbowy `filter` wynosi najwyżej `value`, czyli wartość odczytaną z arkusza w obecnym stanie, np. zdolności do poziomu postaci (`{ "filter": "level", "value": { "derived": "level" } }`); wpis bez tego filtra jest oferowany zawsze, a wybór, poniżej którego arkusz od tego czasu spadł, przestaje się liczyć, ale zostaje zachowany. Wybór zmieniający odczytywaną wartość (klasa ustawiająca poziom) jest rozstrzygany w tej samej zmianie, podobnie jak wartość zmieniona w **All fields** (obniżenie tam poziomu od razu odbiera to, co dała zdolność z wyższego poziomu). `countFrom` (Capability API 1.90) to wartość odczytywana z arkusza w ten sam sposób, która zastępuje zarówno `min`, jak i `max`: ile wpisów krok wymaga i ile najwyżej przyjmuje, zaokrąglone w dół i nigdy powyżej `max`, np. zaklęcia znane klasie na poziomie postaci (`{ "derived": "spells_known" }`). Wybory ponad tę liczbę są zachowywane, ale nie liczą się, dopóki liczba znów nie wzrośnie. Krok katalogu może też zawierać `stamp` (Capability API 1.108), od 1 do 4 wartości kolumn zapisywanych w każdym dodawanym wierszu, np. `"stamp": { "class": "wizard" }` w kroku zaklęć czarodzieja i `"stamp": { "class": "cleric" }` w kroku kleryka. Każdy klucz musi być kolumną w każdej liście zasilanej przez katalog; wartości to ciągi znaków, liczby lub wartości logiczne. Stempel zastępuje wartość początkową katalogu. Istniejące wiersze i późniejsze edycje w **All fields** pozostają w gestii gracza. Z Capability API 1.130 wartość stempla może być zamiast tego obiektem, którego `fromWithin` to `"id"`, `"label"` lub identyfikator filtra zadeklarowany przez katalog nadrzędny: odczytuje pierwszy pasujący wpis nadrzędny w kolejności wyboru, zapisuje ciąg znaków lub liczbę raz, przy dodaniu wiersza, i zostawia tę kolumnę bez stempla, jeśli żaden wpis nadrzędny nie pasuje albo jego filtra brakuje lub jest on tablicą.

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
- Wpis katalogu może wskazywać grupę `exclusive` (Capability API 1.94): krok kreatora zachowuje jeden wybór z każdej grupy, więc wybranie jednego usuwa inny wybór kroku z tej grupy i liczy się tylko najnowszy. Atut wybrany zamiast zwiększenia wartości atrybutu dzieli z nim grupę: `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) sprawia, że wpis jest tym, który krok przyjmujący wszystko, co oferuje, przyjmuje ze swojej grupy, dopóki gracz nie wybierze innego.
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

Krok wierszy może określać, ilu wierszy wymaga, przez `countFrom` (Capability API 1.799), wartość odczytywaną z arkusza postaci: rzuty punktów wytrzymałości z 5e, po jednym na każdy poziom po 1. Gdy krok jest wyświetlany, kreator dodaje wiersze, każdy tak jak przycisk **Add a row** (dodanie wiersza), aż liczba własnych wierszy gracza osiągnie tę wartość, nigdy nie przekraczając `max` ani `maxItems` listy; nigdy nie odbiera wiersza, a wiersz usunięty w tym kroku pozostaje usunięty do ponownego wyświetlenia kroku. Postać, która jest opisywana, nie otrzymuje wierszy przez samo oglądanie kroku. Krok czeka następnie na taką liczbę kompletnych wierszy, jak w przypadku `min`, większą z tych dwóch wartości, gdy podano obie, i pokazuje ten sam licznik "N z M". Zestaw zasad, który tego używa, wymaga Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
