# Katalogi zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Gotowe wpisy oferowane przez edytor arkusza postaci w selektorze: nagłówek katalogu, wpisy, wartości utrzymywane przez zestaw zasad, polecenia arkusza postaci i polecenie użycia.

Wpisywanie zaklęć, ekwipunku lub strony zdolności klasy wiersz po wierszu jest uciążliwe. Katalog to nazwany zbiór gotowych wpisów dostarczany z zestawem. Edytor proponuje je w selektorze każdej zasilanej listy; wybór wypełnia wiersz.

Katalogi są opcjonalne. Zestaw może mieć ich do dwunastu, a Engine nie zna ich tematyki: wszystkie ID, kolumny, filtry i słowa pochodzą z pliku.

## Nagłówek

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
- `holds`: `"rows"` (domyślnie i we wszystkich katalogach sprzed tego wydania), `"creatures"` lub `"items"`. Katalog stworzeń jest bestiariuszem czytanym przez walkę, a katalog przedmiotów wymienia rzeczy niesione przez drużynę. Żaden z nich nic nie zapisuje w arkuszu, nie deklaruje `feeds` i nie pojawia się w selektorze. Zobacz niżej [Stworzenia](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) i [Przedmioty](ruleset-items.md).
- `feeds`: od jednej do ośmiu list arkusza, do których mogą pisać wpisy katalogu. Wymagane dla katalogu wierszy, odrzucane dla katalogu stworzeń lub przedmiotów. Wpis nigdy nie zapisze do niewymienionej listy ani wartości niedozwolonej przez jej kolumny.
- `filters`: opcjonalne, do ośmiu. Pola zawężania listy w selektorze: `number`, wartość `text` lub `tags` (kilka słów). `startFrom` wskazuje pole arkusza ustawiane przy otwarciu, więc postać z Calling równym Tinker widzi najpierw wpisy Tinker.
- `units`: opcjonalne. Znaczenie zasięgu lub wielkości obszaru w bloku `mechanics` wpisu w twoim systemie.

## Wpis

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

## Jeden wpis, kilka list

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

## Wartości aktualizowane przez zestaw

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

## Wybrane wiersze są kopiami

Każdy wybrany wiersz jest kopiowany do arkusza z dodatkowym kluczem `_catalog`, zawierającym `<catalog id>/<entry id>`. ID kolumn zawsze zaczynają się literą, więc ten klucz nie może być twoją kolumną.

Kopia należy do postaci. Gracz może później edytować wszystko, arkusz działa bez zainstalowanego zestawu, a publikacja nowej wersji nigdy nie przepisuje cudzej postaci. Znacznik pozwala selektorowi pokazać posiadane wpisy i jest czytany przez opisane niżej odświeżanie.

## Odświeżanie z zestawu zasad

Ponieważ wybrany wiersz zachowuje znacznik, edytor karty może powiadomić gracza, że twój nowszy tekst różni się od zawartości wiersza. Krótka informacja pod listą podaje liczbę wierszy z nowszym tekstem, a przycisk **Review** (przejrzyj) pokazuje je, zestawiając zawartość karty z treścią zestawu zasad i udostępniając pole wyboru przy każdym wierszu. Zapis następuje dopiero po kliknięciu **Update selected** (aktualizuj wybrane); obejmuje wyłącznie różniące się kolumny w zaznaczonych wierszach. Reszta wiersza, w tym znacznik, pozostaje bez zmian.

Zakres porównania jest celowo wąski:

- Istniejące wartości są porównywane tylko w kolumnach `text`, `longtext`, `dice` i `enum`. Wartości `number` i `boolean` należą do gracza i są zachowywane, również 0 i false. Kolumnę, której wiersz jeszcze nie zawiera, można zaproponować z wartością odpowiedniego typu, także liczbą lub przełącznikiem. Kolumny skalowane są wyłączone, ponieważ już podążają za kartą.
- Tylko kolumny ustawiane przez twój wpis. Kolumna pominięta we wpisie nigdy nie jest zmieniana, niezależnie od zawartości karty.
- Wartość, której sama kolumna by nie przyjęła, np. nieoferowana już wartość `enum` albo tekst przekraczający `maxLength`, jest pomijana zamiast zapisywana.
- Wiersz jest dopasowywany do źródłowego wiersza wpisu według pozycji wśród wierszy tej listy z tym samym znacznikiem, o ile karta nadal ma ich tyle, ile zapisuje wpis. W przeciwnym razie dopasowanie działa tylko wtedy, gdy wpis zapisuje pojedynczy wiersz w tej liście. Jeżeli gracz usunął jeden z dwóch wierszy wpisu, wpis pozostaje bez zmian, bez zgadywania.
- Wiersz, którego wpisu nie ma już w katalogu, pozostaje bez zmian i bez powiadomienia.

Zmiana sformułowania lub nazwy wpisu może więc dotrzeć do postaci, które już go wybrały, jeśli zaakceptują aktualizację. Zmiana znaczenia liczby nie może i nie będzie tak działać: gdy wiersz należy do gracza, ta kolumna również należy do niego.

## Polecenia arkusza: trwały rozwój

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

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## Polecenie `use`: Mistrz Gry płaci zdefiniowaną przez ciebie cenę

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

## Wewnątrz definicji lub we własnym pliku

Mały katalog umieszcza się bezpośrednio w `ruleset.json`, w `entries` nagłówka. Długi katalog ma własny plik wskazany w nagłówku przez `asset`. Katalog ma dokładnie jedną z tych dwóch form.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Ścieżka ma zawsze postać `catalogs/<the catalog's id>.json`. Sam plik wygląda tak:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Osobne pliki katalogów trafiają do pakietu: publikowanego przez oficjalny katalog albo pliku pakietu zestawu zasad importowanego samodzielnie (zobacz [Udostępnianie zestawu zasad](writing-rulesets.md#sharing-your-ruleset)). Pakiet wymienia plik w `contributions.assets.paths` obok `ruleset.json` i wymaga Capability API 1.21. Katalog stworzeń, wewnętrzny lub osobny, wymaga Capability API 1.27, a katalog przedmiotów – 1.49. **Zestaw zasad importowany jako pojedynczy plik lub udostępniany przez repozytorium GitHub zawiera katalogi wewnątrz definicji**, więc muszą mieścić się w limicie 512 KB całego pliku zestawu zasad. To wystarcza na kilkaset krótkich wpisów.

Limity to 12 katalogów na zestaw zasad, 2000 wpisów na katalog w obu formach i 2 MB na osobny plik katalogu. Pakiet, którego `ruleset.json` przekracza 256 KB albo którego plik katalogu przekracza 1 MB, wymaga Capability API 1.340, w którym podniesiono oba limity.
