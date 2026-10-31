# Warstwy, tłumaczenia i migracje zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Omawia warianty, które gracz włącza dla jednej gry, tłumaczenia tekstu zestawu zasad oraz przenoszenie wartości do nowych identyfikatorów przy zmianach arkusza postaci.

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
- `items` zmienia to, gdzie rzeczy są sprzedawane i jakie łupy wypadają, nigdy to, co istnieje. `market.removeSellers` usuwa sprzedawców z twojego targu (zawsze pozostaje co najmniej jeden: targ bez sprzedawców pozwala każdemu sprzedawać wszystko, więc usunięcie, które opróżniłoby tę listę, nawet przez dwie warstwy razem, nie jest wykonywane). `market.unsold` usuwa towary z oferty każdego sprzedawcy za pomocą filtrów takich jak filtry samego targu (są dopisywane do `unsold` targu). `lootTables` zastępuje już istniejące tabele łupów, według identyfikatora, tabelami o tej samej strukturze, więc każde stworzenie, poziom zagrożenia i `stock` sprzedawcy, które wskazują taką tabelę, losują z jej zamiennika; gdy kilka aktywnych warstw zastępuje jedną tabelę, wygrywa ostatnia. Przedmiot wyłączony ze sprzedaży nadal jest przedmiotem: można go nosić, używać, znajdować w łupach i otrzymywać od Mistrza Gry, a tabela `stock` sprzedawcy nadal może go wylosować.

```json
"items": {
  "market": { "removeSellers": ["magic_dealer", "scribe"], "unsold": [{ "tag": "magical" }] },
  "lootTables": [{ "id": "treasure_low", "label": "Pocket treasure", "entries": [{ "coins": "sp", "weight": 1, "count": "4d6" }] }]
}
```

**Czego warstwa nie może robić.** Nie może dodać wartości wyliczenia, pola, umiejętności, puli ani odpoczynku, dodać sprzedawcy ani tabeli łupów, zmienić rodzaju rozstrzygania, dotknąć bieżącego stanu lub liczb walki ani dodać wywołania modelu. Wartość _dodana_ przez warstwę byłaby nieznana wszystkim innym czytnikom karty, więc wartości mogą jedynie znikać. Wszystko poza tą listą wymaga zmiany samego zestawu zasad albo drugiego zestawu.

**Konflikty.** `conflicts` wskazuje warstwy, których nie można włączyć razem. Wystarczy zadeklarować jedną stronę pary. Kreator wyłącza drugi przełącznik; jeśli zapisany wybór mimo to zawiera obie warstwy, odrzuca zadeklarowaną **później**, więc te same dwa wybory zawsze dają te same zasady.

**Karta już zawierająca usuniętą wartość zachowuje ją.** Nic nie przepisuje postaci. Edytor przestaje jedynie oferować wartość, a postać, która już ją miała, nadal ją pokazuje. Wyłącz warstwę w nowej grze, a wartość znów będzie oferowana. Tak samo działa ukryty wpis katalogu: znika z selektora, a wcześniej wybrany wiersz pozostaje na karcie. Monety usunięte przez warstwę, które ktoś już niesie, zostają w jego torbie.

**Limity.** 12 warstw na zestaw zasad i 4000 znaków instrukcji na warstwę, łącznie dla obu tekstów. Pakiet zestawu zasad deklarujący `layers` lub bazowe `gm.worldGuidance` wymaga Capability API 1.25, taki, którego warstwy usuwają monety – 1.64, a taki, którego warstwy zmieniają jego `items` – 1.813. Importowany zestaw zasad weryfikuje odczytujący go Engine, więc niczego takiego nie potrzebuje.

**Warstwy pisane przez inne osoby** (warstwa małej ilości magii dla cudzego zestawu zasad, dostarczana w osobnym pliku) są późniejszym rozszerzeniem. Obecnie warstwa jest dostarczana wewnątrz zestawu, do którego należy.

## Tłumaczenia

**Tłumaczenia** (Capability API 1.811). Teksty zestawu zasad wyświetlane w innym języku tworzą jedno tłumaczenie na język, nazwane kodem tego języka tak jak własne pakiety językowe Engine (`ru`, `pt-BR`, `zh-Hans`). W oficjalnym katalogu agentów każde jest pakietem językowym obok pliku zestawu zasad (poniżej). Udostępniany plik pakietu zestawu zasad może zamiast tego zawierać je wewnątrz, po jednym pliku na język obok `ruleset.json`: `locales/<language>.json`, wymienionym w manifeście tak jak pozostałe pliki. W obu przypadkach każde tłumaczenie to katalog lokalizacji pakietu z sekcją `ruleset`: każdy klucz jest tekstem wyświetlanym przez zestaw zasad lub jego katalogi, zapisanym słowo w słowo po angielsku, a jego wartość to ten tekst w języku pliku.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` musi wskazywać język, którym nazwano plik, a plik zawiera wyłącznie `$schema`, `_meta`, `package` i `ruleset`, przy czym każda wartość jest tekstem. Pusty tekst nie jest jeszcze przetłumaczony i wyświetla się po angielsku; plik bez sekcji `ruleset` (własny angielski opis pakietu, `locales/en.json`) niczego nie tłumaczy. Tłumaczenia dotyczą tylko wyświetlania: zasady, polecenia arkusza postaci i wszystko, co jest przekazywane mistrzowi gry, nadal odczytują wersję angielską. Ekran walki (nazwy, stany, akcje, zaklęcia, dziennik i kolejność tur) pokazuje każdy tekst w języku gracza, jeśli tłumaczenie zestawu zasad go zawiera, korzystając najpierw z pliku tego języka, a potem z pliku języka, którego jest odmianą (`pt` dla `pt-BR`), a w przeciwnym razie po angielsku; "Goblin 2" odczytuje tłumaczenie "Goblin" z jego liczbą. Plik pakietu z tłumaczeniami wymaga Capability API 1.811. Import zachowuje tylko tłumaczenie w języku ustawionym w Engine (albo w języku, którego jest odmianą), a pozostałe odrzuca; aby odczytywać zestaw zasad w innym języku, zmień język Engine i ponownie zaimportuj plik, co zastąpi zachowane tłumaczenie. Tłumaczenia nie są częścią wersji, więc ponowny import tej samej wersji z poprawionym tłumaczeniem również je zastępuje, a plik tej wersji bez tłumaczeń pozostawia zachowane tłumaczenie.

Zestaw zasad z katalogu nigdy nie zawiera `locales/<language>.json` wewnątrz swojego pliku (jeśli zawiera, zostaje odrzucony przed pobraniem). Jego tłumaczenia to pakiety językowe (Capability API 1.811): po jednym pliku JSON na język, `<id>-<version>.<language>.json`, opublikowanym obok `<id>-<version>.ruleset.json` i zawierającym dokładnie to samo co `locales/<language>.json` (`_meta.locale` wskazujące język, którym nazwano plik, oraz sekcję `ruleset`). Wpis katalogu wymienia je obok swojego `artifact`:

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Każdy pakiet ma adres URL https o tej samej postaci co adres artefaktu, nazwany zgodnie z jego wersją i językiem, wraz z sha256 i rozmiarem (najwyżej 8 MB); zestaw zasad wymienia ich najwyżej 40, nigdy `en` (wersją angielską jest sam zestaw zasad), a jego manifest deklaruje Capability API 1.811. `name` i `description` to nazwa i opis karty w sklepie w tym języku, więc kartę można odczytać w języku Engine bez pobierania pakietu. Instalacja pobiera plik zestawu zasad, a następnie tylko pakiet w języku ustawionym w Engine (albo w języku, którego jest odmianą), sprawdza jego rozmiar, sumę kontrolną i język, a potem zachowuje go wraz z zainstalowaną wersją. Gdy język Engine się zmienia (i przy każdym otwarciu w nim strony), każdy zainstalowany zestaw zasad z katalogu, który wymienia pakiet w nowym języku, pobiera go, a pakiet w poprzednim języku zostaje usunięty. Jeśli nie da się uzyskać pakietu (brak połączenia z siecią, nie wymieniono żadnego albo plik jest inny niż wskazany w katalogu), zestaw zasad pozostaje po angielsku; kolejna instalacja lub zmiana języka ponawia próbę. Aktualizacja zachowuje poprzednią wersję na wypadek przywrócenia, bez jej pakietu: po przywróceniu kolejna zmiana języka ponownie pobiera pakiet tej wersji, jeśli katalog nadal go wymienia.

## Przenoszenie wartości do nowych identyfikatorów: `sheet.migrations`

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
- `setColumn` (Capability API 1.794): `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` ustawia jedną kolumnę w każdym wierszu listy, w którym każda z kolumn `where` zawiera jedną z wymienionych wartości (tekst jest dopasowywany bez względu na wielkość liter i spacje na jego końcach; liczba musi pasować dokładnie). Użyj go do poprawienia wierszy utworzonych, zanim twój zestaw zasad uwzględniał właściwą regułę, na przykład wierszy ataków utworzonych, zanim istniał wybór atrybutu broni. Lista i każda wskazana kolumna muszą znajdować się na arkuszu postaci.
- Każdy inny krok budowy kopiuje: stara wartość pozostaje na miejscu, więc starsza wersja twojego zestawu zasad nadal odczytuje kartę tak jak wcześniej, a krok nigdy nie nadpisuje wartości, która już jest w jego celu. `setColumn` to jedyny krok, który nadpisuje.
- Import odrzuca wpis z wersją równą `sheet.version` lub wyższą, dwa wpisy z tej samej wersji, krok zapisujący do identyfikatora, którego karta nie ma, przypadek wymieniony dwa razy oraz `rename` lub `routeLive` odczytujące identyfikator, który karta nadal ma (przeniesiony identyfikator nigdy nie jest ponownie używany, i to sprawia, że te kroki można bezpiecznie uruchamiać wielokrotnie).
- Karty są migrowane przy każdym odczycie, a nowy układ zostaje zapisany przy następnej edycji. Stan bieżący nie ma własnej wersji, więc `routeLive` działa przy każdym odczycie: stary klucz jest usuwany, a jego wartość przenoszona tylko wtedy, gdy nowego klucza jeszcze nie ma, więc wartość wydana lub odnowiona odpoczynkiem od tego czasu nigdy nie zostaje nadpisana. To, dokąd trafiła, rozstrzyga pierwszy zapis po aktualizacji: karta poprawiona później (poziom klasy przeniesiony ręcznie) nie przenosi jej ponownie. Walka już trwająca, gdy pojawi się nowa wersja, nadal kończy się jak wcześniej.
