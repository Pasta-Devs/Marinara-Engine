# Arkusze zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Co znajduje się w arkuszu postaci zestawu zasad: atrybuty, umiejętności, pola i listy, stany bieżące, tory ran, kary, odpoczynki i tekst mistrza gry, a także arkusz drużyny i zegary postępu.

## Arkusz

- `sections` grupuje rzeczy w edytorze. Pola, wartości pochodne i listy wskazują przez `section` sekcję, w której się znajdują; mogą to robić także atrybuty, umiejętności i rzuty obronne. Edytor, arkusz w grze i blok arkusza dla Game Master pokazują je wtedy pod tym nagłówkiem (arkusz, który nie wskazuje dla nich sekcji, pokazuje je dokładnie tak jak wcześniej). Sekcja może też mieć regułę `untrained` (niżej).
- `abilities` to podstawowe cechy. `skills` i `saves` mogą wskazywać atrybut używany przy rzucie, `cap` i regułę `untrained` (niżej).
- `fields` to pojedyncze wartości. Typy: `number`, `text`, `longtext`, `boolean`, `enum` (stała lista wyborów) i `dice` (tekst taki jak `1d8`). Pole lub kolumna listy typu `text` może dodać `suggestions` (Capability API 1.796): do 40 słów oferowanych pod nim jako kafelki, z których każdy dodaje się do wpisanego tekstu, a w polu nadal można pisać dowolnie, np. wybierając ulubionych wrogów łowcy spośród typów stworzeń. Takie pole może też określać liczbę słów do wybrania przez `pick` (Capability API 1.797), wartość odczytywaną z arkusza postaci, np. wartość pochodną określającą liczbę rosnącą wraz z poziomem klasy: edytor wyświetla "Choose N", pokazuje, ile wybrano, i przestaje oferować kolejne kafelki po wybraniu N słów, choć nigdy nie odrzuca wpisywanego tekstu.
- Wartości `derived` oblicza się z innych wartości i nie można ich nadpisać ręcznie. Arkusz może mieć ich do 800 (Capability API 1.729; 400 od 1.111, 240 od 1.88, 120 od 1.84, 60 wcześniej); pakiet z więcej niż 240 deklaruje 1.111, a pakiet z więcej niż 400 deklaruje 1.729. Operacje to `sum`, `min`, `max`, `scale` (mnożenie przez stałą liczbę i zaokrąglanie), `multiply` (od dwóch do sześciu wartości mnożonych przez siebie, np. modyfikator Constitution razy poziom; Capability API 1.82), `stepTable` (wyszukanie w progach, jak poziom wyznaczający premię biegłości) oraz `enumTable` (liczba dla każdej wartości pola wyliczeniowego lub stanu bieżącego; zobacz niżej Stany bieżące).
- `lists` to tabele z własnymi kolumnami, np. ekwipunek, zaklęcia lub zdolności. Lista ma do 24 kolumn; pakiet z listą mającą więcej niż 12 kolumn deklaruje Capability API 1.165. Lista z `pools` zmienia każdy wiersz w zasób z własnym maksimum, przydatny dla zdolności klasy o ograniczonej liczbie użyć. Kolumnę liczbową może wypełnić rzut: `"roll": { "count": 1, "sides": 8 }`, gdzie `sides` to liczba, inna kolumna tego samego wiersza (`{ "column": "die" }`, kolumna liczbowa lub wyliczeniowa, której wartości odczytuje się jako kości, np. `d8`) albo wartość z arkusza. Edytor arkusza pokazuje przycisk Roll, który rzuca własnymi kośćmi Engine i zapisuje sumę, utrzymaną w zakresie `min` i `max` kolumny (Capability API 1.85).
- `live` to rzeczy zmieniające się podczas gry: `pools` (punkty życia, komórki zaklęć, Grit), `tracks` (liczba na skali, np. wyczerpanie, lub tor ran z zaznaczanymi polami), `text` (krótkie notatki, np. przedmiot koncentracji), `conditions` i `states` (jedna wartość z zamkniętego zbioru, np. forma lub postawa).

Wszystko, co odczytuje liczbę, nazywa ją odwołaniem do wartości: obiektem o dokładnie jednym kluczu `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` lub `itemStat`. Przykład puli o maksimum będącym wartością pochodną: `"max": { "derived": "grit_max" }`.

- `listSum` sumuje jedną kolumnę liczbową listy: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` jest opcjonalne i wskazuje kolumnę logiczną; liczą się tylko wiersze, w których jest włączona. Pusta komórka liczy się jako wartość domyślna kolumny, a lista ukryta przez `hideWhen` nic nie dodaje. Tak Ember Roads oblicza Burden z ekwipunku spakowanego przez postać, więc wartość nigdy nie rozjedzie się z listą, jak mogłoby się stać z ręcznie wpisaną liczbą. Skalowana kolumna katalogu nie może odczytywać sumy listy, nawet przez wartość pochodną: lista może zawierać skalowane komórki, własne lub odczytujące ją z powrotem, i przeliczanie nigdy by się nie ustabilizowało.
- `livePool` odczytuje, ile zostało w jednej z twoich `live.pools` (pula wiersza listy do nich nie należy). `liveTrack` odczytuje jeden z twoich `live.tracks`, z opcjonalnym `read`: `"value"`, czyli bieżąca pozycja (domyślnie); `"filled"`, czyli odległość powyżej `min`; `"remaining"`, czyli odległość poniżej `max`; albo, tylko na torze ran, `"penalty"`, czyli obowiązująca kara. Ukryta pula lub tor dają 0. "Harm still to take" z Gravewatch to `{ "liveTrack": "harm", "read": "remaining" }`.
- Odczyt bieżący bierze bieżący stan z chwili rzutu testu, rozpoczęcia walki lub zapisu bloku arkusza dla Game Master. Gdy bieżącego stanu jeszcze nie ma (edytor arkusza, przegląd importu), odczytuje stan, od którego zaczyna się gra: pulę pełną lub pustą zgodnie z jej `start`, tor na wartości `default` i czysty tor ran.
- Nic, co oblicza się, zanim powstanie bieżący stan, nie może go odczytywać: `max` puli lub toru, premia biegłości ani skalowana kolumna lub skalowanie katalogu. Dotyczy to także odczytu przez wartość pochodną i przez umiejętność ograniczoną wartością bieżącą, a import podaje wartość, która to robi.
- Te trzy wymagają Capability API 1.39 w zestawie dostarczanym jako pakiet.
- `itemStat` odczytuje przedmioty posiadane przez postać, np. ochronę noszonego pancerza, i podlega tej samej regule co odczyt bieżący. Zobacz [Przedmioty w arkuszu](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

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

## Stany bieżące: forma, postawa, światło

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

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## Tory ran: zdrowie jako tor zamiast liczby

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

### Numerowane pola zamiast nazwanych poziomów

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

### Zaznaczanie według pola i tory odrzucające znaczniki

- `"fill": "indexed"` umieszcza znacznik w polu wskazanym przez komendę przez `box=` (w pierwszym polu, gdy żadnego nie wskazuje) albo w najbliższym wolnym polu powyżej i nigdy nie przesuwa znacznika, który już stoi. Leczenie usuwa najwyżej położony spośród najlżejszych znaczników. Ekran arkusza pozwala graczowi kliknąć dowolne czyste pole.
- `"onFull": "refuse"` odrzuca znacznik, dla którego nie ma wolnego pola, zamiast podnosić najlżejszy znacznik. Odrzucana jest cała komenda, więc trzy znaczniki przy dwóch wolnych polach nie trafiają nigdzie. Tor zaznaczany według pola zawsze odrzuca; zaznacz to, dodając obok `"onFull": "refuse"`.

### Poziomy dodawane przez listę

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` na torze z nazwanymi poziomami pozwala liście w arkuszu wydłużać go dla każdej postaci osobno. Każdy wiersz, po kolei, dodaje swoją liczbę poziomów (najwyżej 16) ze swoją karą, za ostatnim poziomem o karze co najmniej tak dobrej; poziomy te noszą nazwę tamtego poziomu, gdy kary są równe, a w przeciwnym razie nazwę od kary. Tak działają blizny w Gravewatch. Lista ukryta przez arkusz nic nie dodaje, a gdy usunięto wiersz, którego poziomy są zaznaczone, znaczniki, które już się nie mieszczą, zostają zachowane jako nadmiar: edycja arkusza nie cofa obrażeń.

`boxes`, `fill`, `onFull`, `extra` i `kind` w kroku odpoczynku wymagają Capability API 1.40 w zestawie dostarczanym jako pakiet.

## Kara do rzutów

`resolution.penaltyFrom` wskazuje tor ran, którego kara dotyczy każdego testu zestawu. Jest deklarowana, nie domyślna: zestaw bez niej rzuca dokładnie tak jak przed wprowadzeniem torów ran.

DZIAŁANIE kary zależy od rodzaju rozstrzygania, tak samo jak znaczenie liczby z arkusza:

- W `dice-pool` **odejmuje kości z puli**, nie poniżej własnego `pool.min`. Przy `pool.min` równym 1 nawet postać na ostatnim poziomie rzuca jedną kością; przy `pool.min` równym 0 nie rzuca żadną i przegrywa bez rzutu.
- W `dice-sum` jest **stałym modyfikatorem rzutu**, włączanym do tej samej liczby co atrybut i wyszkolenie.

Wskazany tor musi być torem ran. Zwykły tor nie ma kary i wskazanie go jest odrzucane podczas importu. Wynik podaje zastosowaną karę, aby gracz rozumiał mniejszą liczbę kości, a blok arkusza dla Game Master pokazuje poziom i jego koszt.

## Modyfikatory z arkusza

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

## Odpoczynki

Odpoczynek jest listą kroków odnowienia i rzeczy do wyczyszczenia. Każdy wskazuje jeden cel (`pool`, `poolGroup`, `listPools`, `track` lub `state`) i ustawia go (`"to": "max"`, `"to": "min"` albo liczba) lub zmienia (`"by": { "const": 1 }` albo `"by": { "fractionOfMax": 0.5 }`). Krok wskazujący tor ran może go tylko leczyć, więc jego `by` jest ujemne; zobacz wyżej. Krok wskazujący stan bieżący tylko go ustawia, na `"default"` albo jedną z jego wartości. Krok `poolGroup` z `fractionOfMax` zmienia każdą pulę grupy o jej własny ułamek; dodaj `"shared": true` (Capability API 1.77), aby zamiast tego obliczyć ułamek od maksimum całej grupy i rozdzielić wynik między pule grupy w kolejności, w jakiej wymienia je arkusz, każdej najwyżej tyle, ile jej brakuje. Długi odpoczynek z 5e, "połowa całkowitej liczby" kości wytrzymałości postaci przechowywanych w osobnej puli dla każdego rodzaju kości, to `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Tekst Game Master

- `checkGuidance` zastępuje wbudowany akapit mówiący Game Master, jak prosić o test. Podaj system i okoliczności rzutu. Game Master wskazuje tylko umiejętność i trudność. Engine rzuca i oblicza wynik z arkusza, więc nie proś modelu o matematykę.
- `sheetGuidance` wprowadza arkusze postaci do promptu. Wyjaśnij, które zasoby są ważne i kiedy je wydawać.
- `worldGuidance` jest opcjonalne i czytane raz, przy generowaniu świata, aby wymyślone realia pasowały do zasad: brak prochu, rzadka magia, chodzący zmarli. Nigdy nie trafia do tury.
- `opposition` określa, kto rozgrywa drugą stronę walki (Capability API 1.774). `"game-master"` przekazuje turę każdego przeciwnika mistrzowi gry, który wybiera jedną z opcji oferowanych przez Engine; gdy nie odpowie, Engine korzysta z własnego mechanizmu wyboru. Działa to tylko w grze, w której gracz pozwolił mistrzowi gry rozgrywać bossów, i w każdym stylu walki, także w walce Classic lub Tactical zestawu zasad bez bloku `combat`. Użyj tego w systemie narracyjnym, w którym przeciwników rozgrywa się jako element fikcji zamiast jako sumę obrażeń: Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"` lub pominięcie tego pola zachowuje mechanizm wyboru Engine, przekazując mistrzowi gry bossów (a na życzenie gracza także imiennych przeciwników i przeciwników o genialnym umyśle). Zestaw zasad korzystający z tego klucza wymaga Capability API 1.774.
- `sheetSummary` wybiera pola, wartości pochodne i wiersze list widoczne dla Game Master dla każdej postaci. Engine zawsze pokazuje modyfikatory atrybutów, wyszkolone umiejętności i rzuty obronne oraz bieżące wartości. Resztę skróć, bo wysyłana jest w każdej turze. `nameColumn` listy w podsumowaniu może być kolumną tekstową lub wyliczeniową (kolumna wyliczeniowa pokazuje etykietę wartości), a `columns` wskazuje do trzech kolejnych kolumn wiersza wypisywanych po nazwie, więc blok brzmi `Gear: Crowbar 1d6` zamiast samych nazw. Kolumna logiczna wypisuje swoją etykietę, gdy jest włączona. Oba wymagają Capability API 1.37 w zestawie dostarczanym jako pakiet.
- Nie musisz uczyć komendy arkusza w `sheetGuidance`. Engine sam uczy każdej komendy, z nazwami zadeklarowanymi w pliku, a gdy zestaw ma tor ran, dodaje komendę `op="damage"` do jego zaznaczania i wymienia jego poziomy oraz rodzaje obrażeń. Gdy zestaw ma stany bieżące, dodaje komendę `op="state"` i wymienia wartości, które każdy może przyjąć.

## Pełny opis zasad dla Game Master

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
