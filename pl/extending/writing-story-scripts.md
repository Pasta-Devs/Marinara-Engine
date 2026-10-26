# Pisanie skryptów fabuły Game Mode

Skrypt fabuły pozwala twórcy kierować tym, jak toczy się gra w trybie Game Mode: scenami, które odtwarzają się, gdy drużyna gdzieś dotrze, rzeczami, o które Mistrz Gry zostaje poproszony po spełnieniu warunku, celami, które gracz śledzi w dzienniku, i momentami, które Mistrz Gry może oznaczyć samodzielnie. Ten przewodnik jest dla osób, które piszą własne skrypty. Jeśli chcesz zagrać w świat, który ma fabułę, zacznij od sekcji [Tworzenie świata](../game/getting-started.md#making-a-world).

Skrypt fabuły to dane, nie kod. Nic się w nim nie wykonuje. Engine sprawdza go względem świata, dla którego powstał, odtwarza go tura po turze i odrzuca wszystko, co nie pasuje.

## Gdzie przechowywana jest fabuła

Fabuła należy do jednego świata. Wymienia miejsca i ludzi tego świata, więc ma sens tylko ze światem, dla którego ją napisano (z jego ziarnem, opisem i ręcznymi zmianami).

- W **pliku świata** (`.world.json`), jako `story` na najwyższym poziomie, obok `world`. Wersja Engine, która nie zna fabuł, nadal odczyta świat.
- W **pakiecie map** dla Experience: każdy plik świata może zawierać swoją fabułę, a nowa gra przejmuje ją razem z mapą. Zobacz przewodnik [Opcjonalne pakiety agentów i możliwości](../development/optional-agent-packages.md).
- W świecie przechowywanym w bibliotece, poza jakąkolwiek grą: `GET`, `PUT` i `DELETE /api/game-worlds/:id/story`, tak samo jak w przypadku gry. Nowa gra rozpoczęta z tego świata przejmuje razem z nim fabułę.
- W grze, gdy już się rozpocznie: `GET`, `PUT` i `DELETE /api/game/:chatId/story` odczytują, zapisują i usuwają fabułę. Zapis jest sprawdzany względem świata gry, łącznie z ręcznymi zmianami, a ręczne zmiany, które usunęłyby coś wymienionego w fabule, są odrzucane.

W konfiguracji nowej gry fabuła wczytana z pliku albo z pakietu map zostaje zachowana, dopóki ziarno i opis świata pozostają bez zmian.

## Struktura

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

Identyfikatory mają od 1 do 40 znaków (małe litery, cyfry, `_` lub `-`) i są unikalne w obrębie swojej listy. Fabuła zawiera najwyżej 256 flag (64 przed Capability API 1.353), 64 wytyczne, 256 zdarzeń (128 przed 1.349), 64 przerywniki, 32 walki, 16 zakończeń i 600 wpisów wiedzy. Żaden tekst w niej nie może zawierać znaku nowej linii, nawiasów kwadratowych ani `{{`, a nazwy wpisywane do znacznika (grupa, tło) nie mogą zawierać podwójnego cudzysłowu: nic, co mówi fabuła, nie może udawać jednego ze znaczników Mistrza Gry.

### Flagi

Flaga to wartość przechowywana przez fabułę: `"bool"` (prawda lub fałsz) albo `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` pozwala Mistrzowi Gry ją ustawiać (zobacz [Znaczniki Mistrza Gry](#the-game-masters-tags)); `note` mówi mu, co oznacza flaga.
- Flagi są ukryte przed graczem. Dzięki `quest` flaga staje się **celem zadania** w dzienniku:

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

Flaga liczbowa może mieć `min` i `max` (Capability API 1.358): każde `set` i `add` utrzymuje ją w tych granicach, także w znacznikach samego Mistrza Gry, więc wynik aprobaty pozostaje między -10 a 10 niezależnie od liczby zdarzeń, które go zwiększają. Jej `initial` musi mieścić się w tych granicach.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

Cel typu tak/nie jest wykonany, gdy jego flaga ma wartość true; cel liczbowy – gdy flaga osiągnie wartość `goal` (1, jeśli jej nie podano), a gdy `goal` jest wpisane, dziennik pokazuje postęp. Cel z `"hidden": true` czeka w dzienniku ukryty, dopóki nie odsłoni go zdarzenie.

#### Zegary

Flaga liczbowa może być **zegarem**, którego zapełnianie obserwuje gracz (Capability API 1.342): kołem złożonym z 2 do 12 segmentów, z jednym segmentem wypełnianym za każdy punkt, widocznym na pasku HUD gry i w zakładce World wraz z tytułem oraz opisem tego, co nastąpi po zapełnieniu.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Ustawiaj ją, dodawaj do niej i sprawdzaj ją w warunkach tak jak każdą flagę liczbową. Mistrz Gry dostaje informacje o zegarach w każdej turze, a raz, gdy któryś się zapełni (przez zdarzenie albo przez jego własny znacznik w następnej turze), także o tym, co ma nastąpić. Zegar z `"hidden": true` pozostaje ukryty, dopóki zdarzenie nie pokaże go przez `show`.

### Wytyczne

Wytyczna to stała instrukcja dla Mistrza Gry, obowiązująca, dopóki spełnione są jej warunki:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### Warunki

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Wszystkie warunki z listy `if` muszą być spełnione. Flagę typu tak/nie porównuje się tylko za pomocą `=` lub `!=`.

`{ "party": "<person id>", "is": "in" | "out" }` sprawdza, czy osoba ze świata podróżuje teraz z drużyną, na przykład towarzysz zwerbowany przez fabułę (Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` sprawdza liczebność drużyny: postać gracza i wszystkich podróżujących z nią towarzyszy, poza tymi, którzy nigdy nie walczą (Capability API 1.360). Warunek jest spełniony tylko wtedy, gdy Engine zna liczebność drużyny.

`{ "any": [<condition>, <condition>, ...] }` jest spełniony, gdy spełniony jest którykolwiek z jego 2 do 8 warunków (Capability API 1.358): alternatywa na jednej liście zamiast dwóch zdarzeń.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### Wiedza

To, co ludzie wiedzą i mówią o sobie, o innych i o świecie, zmieniające się wraz z fabułą (Capability API 1.348). Każdy wpis trafia do Mistrza Gry jako coś, co dana osoba może powiedzieć, jeśli pojawi się taki temat, w turze, w której:

- jego warunki są spełnione,
- jego `person` jest w scenie: wymieniona w ostatniej odpowiedzi lub wiadomości gracza albo podróżująca z drużyną,
- a jeśli ma `keys`, pada tam także jedno z nich. Wpis bez osoby wymaga słów kluczowych i trafia do promptu wyłącznie przez nie.

W jednej turze trafia do niego najwyżej 12 wpisów. Od 1.361 mają ustaloną kolejność pierwszeństwa: najpierw ludzie wymienieni w scenie, potem wpisy bez osoby przywołane przez jej słowa, a następnie towarzysze, którzy tylko podróżują z drużyną. W każdej kategorii wpisy są rozdzielane kolejno między osoby, aby jeden rozmowny towarzysz nie wypierał pozostałych. Towarzysze podróżujący z drużyną zawsze zachowują dwa z 12 miejsc, niezależnie od liczby osób w scenie, rozdzielane w ten sam sposób.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

Skrypt mieści do 600 wpisów. W jednej turze trafia do promptu najwyżej 12, w kolejności skryptu, więc najważniejsze umieść na początku.

### Zdarzenia

Zdarzenie to coś, co się dzieje: gdy jego wyzwalacz zadziała, a warunki są spełnione, wykonuje swoje akcje.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

Zdarzenie zachodzi raz, chyba że ma `"repeat": true` (co `start`, `turn` i `day` ignorują). W jednej turze może zajść najwyżej 32 zdarzenia, każde najwyżej raz, w kolejności, w jakiej wymienia je skrypt.

**Wyzwalacze** (`when.on`), wszystkie odczytywane z tego, co zapisała gra:

| Wyzwalacz | Kiedy działa |
| --- | --- |
| `start` | Przy pierwszej odpowiedzi gry. |
| `turn` | Przy odpowiedzi Mistrza Gry o numerze `turn` lub późniejszej, liczonej w całej grze, we wszystkich sesjach. |
| `day` | Gdy dzień świata (przesuwany przez upływ czasu ogłaszany przez Mistrza Gry i przez wędrówki) osiągnie wartość `day` lub ją przekroczy. |
| `arrive` | Gdy drużyna jest w miejscu `place` (identyfikator miejsca) albo w miejscu wewnątrz niego i znalazła się tam, rozpoczynając tam grę, wędrując po mapie świata, odwiedzając miasto albo dlatego, że Mistrz Gry wskazał to miejsce. Z `repeat` – ponownie przy każdym powrocie z innego miejsca. |
| `meet` | Gdy odpowiedź wymieni pełne imię osoby `person` (identyfikator osoby, np. `p11-3`, albo `p11-e1` dla osoby dodanej ręcznie). Z `repeat` – ponownie przy każdej odpowiedzi, która ją wymienia. Imiona są wyszukiwane tylko w odpowiedziach z bieżącej sesji. |
| `deed` | Gdy świat zapisze czyn drużyny rodzaju `deed`, a jeśli podano `place`, to w tym miejscu. Z `repeat` – ponownie przy każdej odpowiedzi, która zapisuje taki czyn. |
| `fight` | Gdy walka zakończy się wynikiem `outcome`: `victory`, `defeat` lub `flee`. Z `fight` (wskazującym jedną z walk skryptu, 1.358) tylko wtedy, gdy tak zakończyła się ta walka: walka rozpoczęta przez ostatnią odpowiedź Mistrza Gry, przez akcję `fight` fabuły albo uruchomienie przez samego Mistrza Gry. |
| `leave` | Gdy drużyna opuści `place` (identyfikator miejsca) i wszystkie miejsca w jego obrębie (1.358): przez wędrówkę, wizytę, miejsce wskazane przez Mistrza Gry albo fabularne `move`, w ostatniej odpowiedzi lub tej turze. Z `repeat` – ponownie za każdym razem, gdy je opuszcza. |
| `broke` | Gdy walka zniszczy obiekt o nazwie `prop` (Capability API 1.316); wielkość liter nie ma znaczenia. Wskazać można tylko obiekt namalowany na jednym z pól bitwy świata. |
| `flags` | Gdy jego warunki są spełnione. Z `repeat` – ponownie za każdym razem, gdy z niespełnionych znów staną się spełnione. |
| `gm` | Tylko wtedy, gdy uruchomi je Mistrz Gry (zdarzenie wymaga `"gm": true`). |
| `rest` | Po odpowiedzi, w której drużyna odpoczęła: przyjętym z odpowiedzi Mistrza Gry `[sheet: op="rest"]`, z odpoczynkiem zestawu zasad wskazanym przez `rest` (jego identyfikatorem lub etykietą, np. `long`) albo dowolnym (1.349). |
| `travel` | W turze, w której drużyna wyrusza z jednego miejsca do drugiego, z wnętrza `from` i do wnętrza `to`, jeśli je podano (1.349). |
| `idle` | Po `turns` kolejnych odpowiedziach, w których nic się nie dzieje: bez zdarzenia fabuły, wędrówki i walki (1.349). |
| `step` | Gdy wędrówka przechodzi przez pole `x`, `y` (liczone od 0 od lewego górnego rogu) miejsca `place`: miasta osady (ścieżka wizyty, od drzwi do drzwi) albo ręcznie wykonanej mapy miejsca (wędrówka po niej). Na pole musi dać się wejść: w mieście musi to być teren osiągalny z placu, a nie wolna działka, na której fabuła może coś zbudować; na mapie – podłoga osiągalna od wejścia. Wygenerowana mapa nie ma pól, które można wskazać. Z `repeat` – ponownie w każdej turze, w której wędrówka przez nie przechodzi. |

Ręczne zmiany, które odbierają pole zdarzeniu `step` (postawiony na nim budynek, zamurowana podłoga mapy), są przy zapisie odrzucane ze wskazaniem tego zdarzenia.

Powtarzalne zdarzenie `meet`, którego własna scena wymienia tę osobę, albo powtarzalne zdarzenie `deed`, które samo wykonuje czyn, na który czeka, uruchamiałoby się w każdej turze, dlatego Engine je odrzuca.

**Akcje** (`do`):

| Akcja | Działanie |
| --- | --- |
| `{ "set": "<flag>", "value": <value> }` | Ustawia flagę. |
| `{ "add": "<flag>", "amount": <number> }` | Dodaje wartość do flagi liczbowej. |
| `{ "tell": "<text>" }` | Prosi Mistrza Gry o coś, jednorazowo, w tej turze. |
| `{ "cutscene": "<id>" }` | Odtwarza przerywnik. |
| `{ "show": "<flag>" }` | Pokazuje w dzienniku ukryty cel zadania. |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Zapisuje czyn w świecie i dostaje taką odpowiedź, jaką dostałby czyn zapisany przez samego Mistrza Gry. |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | Daje przedmiot (1.343): przedmiot z zestawu zasad gry według identyfikatora albo dowolny inny według nazwy (z `summary` opisującym, czym jest), do torby gracza lub członka drużyny wskazanego przez `who`. Trafia tam tak samo jak przedmiot od Mistrza Gry, więc obowiązują zasady ekwipunku. Identyfikator, którego zestaw zasad gry nie oferuje, zostaje odrzucony z powodem w odpowiedzi. |
| `{ "fight": "<fight id>" }` | Rozpoczyna jedną z walk skryptu (1.343). Mistrz Gry dostaje prośbę o wprowadzenie do niej, a następująca walka ma przeciwników wskazanych przez fabułę. |
| `{ "move": "<place id>" }` | Umieszcza drużynę w miejscu świata (1.343), tak jak wędrówka; wywołane przez to zdarzenie `arrive` zachodzi w tej samej turze. |
| `{ "ending": "<ending id>" }` | Kończy grę jednym z zakończeń skryptu (1.343): odtwarza się jego scena, Mistrz Gry kończy epilogiem, a gracz widzi zakończenie i propozycję zakończenia sesji. Po nim w fabule nic więcej się nie dzieje. |
| `{ "music": "<track id>" }` lub `{ "music": null }` | Włącza utwór danego Experience zamiast muzyki miejsca (1.345), aż do następnego wskazania; `null` przywraca muzykę miejsca. Utwór musi należeć do `music` pakietu map. |
| `{ "recruit": "<person id>" }` | Przyjmuje do drużyny jednego z towarzyszy danego Experience (1.347), z jego arkuszem dla zestawu zasad gry. Mistrz Gry dostaje prośbę o pokazanie jego dołączenia. |
| `{ "dismiss": "<person id>" }` | Pozwala towarzyszowi odejść z drużyny (1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | Utrzymuje w miejscu i wszystkich miejscach w jego obrębie jedną porę roku niezależnie od daty (1.351); bez `place` – w całym świecie. `"to": null` przywraca własne `seasons` skryptu albo porę wynikającą z daty. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` lub `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | Nakłada na każdego członka drużyny stan arkusza albo go usuwa (`"off"`) lub przesuwa tor na każdym arkuszu, zatrzymując się na `upTo` (1.368): chłód Rime Edge, którego nie leczy żaden odpoczynek, przez stan, którego stan walki ma `cannot-heal-nonmagical`. Zdarzenie uruchomione przez Engine stosuje go wraz z pisaną odpowiedzią; uruchomione przez Mistrza Gry – w turze po jego oznaczeniu. |

Każda akcja może mieć własne `if` (Capability API 1.358): jest wykonywana tylko wtedy, gdy jej warunki są spełnione w chwili, gdy zdarzenie do niej dotrze, po wykonaniu wcześniejszych akcji zdarzenia. Dzięki temu jedno zdarzenie może się rozgałęziać.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

Zapis uruchomienia obejmuje to, które akcje wykonano, więc sceny i prośby zdarzenia `gm` przychodzą w następnej turze w postaci wykonanej, gdy Mistrz Gry je oznaczył.

Każda funkcja fabuły wymaga odpowiedniej wersji podrzędnej Capability API:

- zegary wymagają 1.342;
- walki, zakończenia i akcje `give`, `fight`, `move` oraz `ending` wymagają 1.343;
- wskazania muzyki wymagają 1.345;
- przyjmowanie i odprawianie towarzyszy wymaga 1.347;
- wiedza wymaga 1.348;
- zdarzenia `rest`, `travel` i `idle`, `priority`, warunek `party` lub ponad 128 zdarzeń wymagają 1.349;
- `seasons` i akcja `season` wymagają 1.351;
- ponad 64 flagi wymagają 1.353;
- `variants` walk wymagają 1.356;
- warunki `any`, zdarzenie `fight` wskazujące swoją walkę, zdarzenie `leave`, `min` lub `max` flagi oraz `if` akcji lub strony wymagają 1.358;
- warunek `partySize`, wariant dla drużyny większej niż 6 osób albo bez górnej granicy lub ponad 6 wariantów wymagają 1.360;
- akcja `season` obejmująca przez `over` wszystko w swoim obrębie wymaga 1.361;
- `exposures` wymagają 1.362;
- stworzenia w walce z `adjust` wymagają 1.363;
- `save` ekspozycji lub `upTo` toru wymaga 1.364;
- `sparedByShade` ekspozycji wymaga 1.365;
- `heldGround` wymaga 1.366;
- akcja `sheet` wymaga 1.368;
- `release` Held Ground wymaga 1.369;
- dawanie listy alternatyw wymaga 1.370 (pojedynczy identyfikator wpisu bez prefiksu, od 1.370 brany z dowolnego katalogu, który go zawiera, jest dla starszej wersji Engine nazwą);
- stworzenia w walce z `adjust` obejmującym `calls` lub `levels` wymagają 1.371.

Towarzysz to osoba oznaczona w ten sposób w pliku ludzi pakietu (zobacz opis ludzi w pakiecie map w przewodniku [Opcjonalne pakiety agentów i możliwości](../development/optional-agent-packages.md)).

Spośród zdarzeń `rest`, `travel` i `idle`, które mogłyby zajść w jednej turze, zachodzi tylko jedno: to z najwyższym `priority` (liczbą całkowitą od -100 do 100, domyślnie 0; przy remisie pierwsze w skrypcie). Rozmowa towarzysza przy ognisku, sprzeczka pary towarzyszy w drodze albo podejście towarzysza do gracza w spokojnej chwili nigdy się więc nie nakładają. Z warunkiem `party` taka scena zachodzi tylko wtedy, gdy ci towarzysze podróżują z drużyną. Od 1.349 skrypt może mieć 256 zdarzeń (wcześniej 128).

### Ekspozycje

Wpływ przebywania w miejscu na drużynę z upływem czasu (Capability API 1.362), na przykład pole południowego światła, które wyczerpuje podróżnych poza walką tak jak zasada światła planszy podczas walki:

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

Według zegara gry: pierwsza tura, w której drużyna jest w `place` (lub w jego obrębie), gdy spełnione jest `if`, rozpoczyna ekspozycję. Każda kolejna liczy, ile okresów `hours` odtąd tam upłynęło. Za każdym razem Engine przesuwa `tracks` o `by`, nakłada stany `applies` na każdego członka drużyny, stosując własne polecenia arkusza wraz z poleceniami odpowiedzi, i informuje Mistrza Gry (przez `tell`). Opuszczenie miejsca lub niespełnienie `if` kończy ekspozycję; następnym razem zaczyna się od nowa. Jest zapisywana w odpowiedzi (`[story: exposure=...]`) jeden raz.

Tor może zatrzymywać się na górnej granicy (Capability API 1.364): `{ "track": "exhaustion", "by": 1, "upTo": 3 }` nigdy nie przesuwa go powyżej 3 ani nie rusza toru, który już przekroczył tę wartość. Ekspozycja może wymagać rzutu obronnego zamiast dotykać wszystkich (1.364), w tym samym formacie co `save` zasady światła planszy walki (1.321):

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

Za każdym razem Engine wykonuje ten rzut obronny dla każdego członka drużyny na podstawie jego arkusza. Tylko ci, którym się nie powiedzie, otrzymują zmiany torów i stany, każdy przez własne polecenie arkusza. `against` określa, przeciw czemu wykonuje się rzut, więc ograniczony do tego modyfikator rzutu obronnego działa poza walką tak samo jak w walce: słomkowy kapelusz z nakładki z `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }` daje noszącej go postaci przewagę. Mistrz Gry dostaje informację, komu się udało, komu nie, i jakie były sumy.

Z `"sparedByShade": true` (Capability API 1.365) zapalone źródło cienia niesione przez kogokolwiek z drużyny powstrzymuje ekspozycję, tak jak niespełnienie `if`: przedmiot z `"shade": true` w swoim `light` noszonym lub trzymanym (Lantern of Dusk z przykładu pokazowego), a jeśli ma przełącznik – tylko gdy jest włączony. Zapalenie kończy ekspozycję; zgaszenie rozpoczyna ją od nowa.

### Held Ground

Miejsce powstrzymujące śmierć (Capability API 1.366), tak jak dolina z przykładu pokazowego:

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

Gdy drużyna jest w `place` (lub w jego obrębie; bez niego w całym świecie) i spełnione jest `if`, rozpoczęta tam walka według zestawu zasad odbywa się na Held Ground (1.323): postać, której zdrowie spadnie do zera, zostaje powalona, wypada z walki, jest stabilna i nie umiera, a później znów wstaje, chyba że powaliło ją coś, co kosi. Powalona postać otrzymuje `condition`, a tory `marks` każdej powalonej postaci przesuwają się (znak Owing). Obowiązuje pierwszy pasujący wpis. Fabuła zapisuje wejście drużyny na taki teren i zejście z niego (`[story: held=...]`), za każdym razem informując Mistrza Gry (przez `tell`); w każdej turze, gdy teren działa, przypomina mu jego znaczenie.

Held Ground może przestać działać (Capability API 1.369): w przykładzie pokazowym następuje zmiana roku. `release` określa, co wtedy trzeba rozliczyć:

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` określa los powalonych: umierają (`"die"`, domyślnie) albo padają i zaczynają umierać według własnej zasady zestawu zasad (`"down"`). `owing` każe każdemu członkowi drużyny wykonać jeden rzut obronny przeciw śmierci z zestawu zasad za każde znamię na `track` (pierwszym oznaczonym torze Held Ground, jeśli go nie podano), dodając do każdego `bonus` (liczbę albo flagę liczbową odczytaną w chwili uwolnienia), aż zabraknie znaków albo wynik zostanie rozstrzygnięty. Znaki zostają zużyte, a trzy porażki oznaczają śmierć. W trwającej tam walce według zestawu zasad uwolnienie następuje dokładnie w kroku, który je wywoła: użyciu przedmiotu zużywającym liczbę fabuły odczytywaną przez `if` (1.359), zniszczeniu obiektu obsługiwanym przez zdarzenie `broke` (1.316) i zdarzeniach flag, które one uruchomią. Powaleni i Owing zostają rozliczeni w tej rundzie według własnego uwolnienia walki (1.330). Poza walką tura fabuły zapisująca uwolnienie wykonuje rzuty Owing każdego członka na podstawie jego arkusza i mówi Mistrzowi Gry, kto przeżył, a kto umarł. Niedokończona walka na takim terenie uwalnia go w następnym kroku. To, co rozliczyła walka, nigdy nie jest losowane ponownie.

<a id="seasons"></a>

### Pory roku

Pory roku świata podążają za kalendarzem, każda trwa 90 dni. Fabuła może utrzymywać w miejscach porę roku niezależnie od daty (Capability API 1.351): dolinę uwięzioną w jesieni, wzgórze zatrzymane w zimie.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

Każdy wpis obejmuje miejsce i wszystkie miejsca w jego obrębie; bez `place` obejmuje cały świat. Decyduje najbliższe utrzymywane miejsce: wieś z zimą wewnątrz regionu z jesienią ma zimę. Akcja `season` zmienia utrzymywaną porę podczas gry albo ją zwalnia. Wyjątkiem jest utrzymanie przez `over` obejmujące wszystko w swoim obrębie (1.361): ma pierwszeństwo przed każdą tamtejszą porą roku, zarówno ze skryptu, jak i z innych utrzymań (najpierw najbardziej zewnętrzne takie utrzymanie), więc `{ "season": { "to": "spring", "over": true } }` zmienia cały świat naraz. Gdy drużyna jest w takim miejscu, Mistrz Gry dostaje informację o porze roku i jej utrzymywaniu; pogoda jest do niej dobierana; mapa świata rysuje każdą komórkę w porze roku najbliższego miejsca (kafelki `<id>@<season>` pakietu kafelków), a miasto we własnej.

Ręcznie malowane pole bitwy świata również może mieć namalowane pory roku: wiersz `seasons` na każdy wiersz kafelków, z literą lub `.` na kafelek, a `seasonKeys` nadaje literom znaczenie (`{ "a": "autumn", "w": "winter" }`). Kafelek pozostawiony jako `.` ma porę roku miejsca walki. Kafelki walki zaczynają z tymi porami roku, a zdarzenia mapy w jej rundach mogą je zmieniać, jak rozprzestrzeniający się pierścień mrozu albo przesuwająca się linia wiosny.

### Walki

Walka określona przez fabułę: z kim się walczy i gdzie, jeśli świat ma namalowaną dla niej planszę.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

Każde stworzenie pochodzi z bestiariusza zestawu zasad gry, wskazane identyfikatorem (`catalog/entry`) albo nazwą, w liczbie `count` (z numerami, jeśli jest ich kilka), a podczas walki nosi nazwę `name`, jeśli ją podano. `battlefield` to ręcznie namalowana plansza świata (`b<n>`), używana niezależnie od miejsca rozpoczęcia walki. Bez niej walka odbywa się tam, gdzie się zaczyna, jak każda inna. `note` mówi Mistrzowi Gry, jak do niej dochodzi. Identyfikator, którego nie ma w zestawie zasad gry, zostaje odrzucony: te stworzenia pomija się w walce, a odmowa trafia do dziennika. Walka pozbawiona w ten sposób wszystkich stworzeń nadal zaczyna się zgodnie z fabułą, na swoim polu bitwy, ale wrogów dobiera Mistrz Gry.

Walkę można przygotować dla drużyn różnej wielkości (Capability API 1.356). Drużyna to postać gracza i każdy podróżujący z nią towarzysz, poza towarzyszem oznaczonym jako `noncombatant` (1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

Używany jest wariant, którego `party` obejmuje liczebność drużyny, z jego własnymi stworzeniami oraz `battlefield` i `note`, jeśli je podaje (w przeciwnym razie z walki). Drużyna, do której nie pasuje żaden wariant, rozgrywa walkę w zapisanej postaci. Dwa warianty nie mogą obejmować tej samej liczebności.

Wpis stworzenia w walce albo wariancie może mieć `adjust` zmieniające je na tę walkę (Capability API 1.363), dzięki czemu boss skaluje się z drużyną bez osobnego stworzenia: `"adjust": { "legendaryResistance": 2, "maxHp": 40 }` nadaje mu taką Legendary Resistance (0 ją odbiera) i takie zdrowie (stałą liczbę zamiast całego zapisu z bloku, łącznie z kośćmi). Mistrz Gry dostaje tę informację obok stworzenia. `calls` w korekcie zmienia to, kogo przywołują akcje stworzenia (Capability API 1.371): `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`, według identyfikatora lub nazwy akcji, dla akcji przywołującej (1.325). `levels` zmienia dowolne z tych ustawień od danego poziomu drużyny wzwyż, każde nakładając na poprzednie: `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`. Poziom drużyny to najwyższy poziom osiągnięty przez jej członka, odczytany z pól poziomu wskazanych w arkuszach towarzyszy Experience dla zestawu zasad gry. Bez nich `levels` nie jest odczytywane. `party` wskazuje liczebności do 32; zakres bez `max` (`{ "min": 7 }`, Capability API 1.360) obejmuje każdą drużynę od `min` wzwyż, niezależnie od wielkości. Mistrz Gry dostaje informację o liczebności drużyny, dla której przygotowano walkę, na jej początku i ponownie po jej podsumowaniu.

### Zakończenia

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` to jedna ze scen skryptu, odtwarzana na początku zakończenia; `epilogue` to treść, którą Mistrz Gry zamyka grę i którą gracz czyta przy wyświetlaniu zakończenia.

### Przerywniki

Przerywnik jest albo pokazywany graczowi dokładnie w zapisanej postaci, albo przekazywany Mistrzowi Gry do opowiedzenia.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

Przerywnik `pages` odtwarza się przed odpowiedzią Mistrza Gry, w narracji, strona po stronie: strona bez mówiącego to narracja, a strona z mówiącym to kwestia tej osoby, podpisana jej imieniem w świecie (albo imieniem gracza w przypadku `player`), z wyrazem twarzy `expression` z listy samego Mistrza Gry. `background` to tło, które gra już ma, albo `backgrounds:generated:<words>`, aby tło zostało wygenerowane, gdy generowanie obrazów jest włączone. Mistrz Gry dowiaduje się, że scena została pokazana, i kontynuuje od niej.

Strona może mieć `if` (Capability API 1.358): jest pokazywana tylko wtedy, gdy jej warunki są spełnione podczas odtwarzania sceny, więc scena obozowa może dawać każdemu towarzyszowi kwestię tylko wtedy, gdy podróżuje on z drużyną.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

Scena, której wszystkie strony zostały wstrzymane, niczego nie pokazuje.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Przerywnik `beats` Mistrz Gry opowiada własnymi słowami, punkt po punkcie, w tej samej turze. Punkty zdarzenia `gm` Mistrz Gry dostaje razem z tym zdarzeniem i opowiada je w odpowiedzi, która oznacza dany moment. Dlatego scenę z punktami, której używa zdarzenie `gm`, Mistrz Gry zna od początku, nawet jeśli odtwarza ją też zdarzenie uruchamiane przez Engine. Ponieważ Mistrz Gry dostaje je w każdej turze, punkty wszystkich zdarzeń `gm` łącznie mogą mieć najwyżej 16 000 znaków.

<a id="the-intro-message"></a>

### Wiadomość otwierająca

`intro` (Capability API 1.339) określa, jak zaczyna się gra. To ten sam wybór, który konfiguracja GM oferuje w każdej grze:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` sprawia, że pierwsza wiadomość gry to dokładnie `text`; Mistrz Gry niczego w niej nie pisze, a ponowne wygenerowanie daje ten sam tekst. `"guided"` tylko kształtuje początek pisany przez Mistrza Gry, jako wskazówki, które czyta on wyłącznie przy tej pierwszej odpowiedzi. `text` ma od 1 do 8000 znaków i może zawierać znaki nowej linii (to jedyny tekst w fabule, który może), ale nigdy `{{`; tekst wskazówek nie może też zawierać nawiasów kwadratowych. Z `locked` gracz widzi wiadomość otwierającą w konfiguracji GM i nie może jej zmienić; bez tego wiadomość tylko wypełnia pole w konfiguracji, a gracz może ją zmienić albo wyczyścić. Gra, w której pierwsza odpowiedź została już napisana albo która przenosi drużynę z innej gry, nie ma wiadomości otwierającej. Experience może też określać wiadomość otwierającą obok pozostałych wartości konfiguracji GM (`contributions.gameSurface.setup.defaults.intro`, 1.372); ta jest odczytywana jako pierwsza.

## Jak przebiega fabuła

Raz na turę, zanim Mistrz Gry odpowie, Engine odczytuje, co fabuła zrobiła do tej pory i co przynosi ta tura (wędrówka, wizyta, koniec walki), i pozwala zajść zdarzeniom. To, co zaszło, zostaje zapisane na początku tej odpowiedzi: znacznik dla każdego zdarzenia i tego, co ustawiło, oraz każda scena pokazana w zapisanej postaci. Ponieważ fabuła jest odczytywana z powrotem z odpowiedzi, swipe albo ponowne wygenerowanie cofa to, co zrobiła dana odpowiedź, a fabuła zmieniona w trakcie gry nigdy nie przepisuje tego, co już się wydarzyło. Fabuła przechodzi do następnej sesji gry.

<a id="the-game-masters-tags"></a>

### Znaczniki Mistrza Gry

W każdej turze Mistrz Gry dostaje wartości fabuły (ukryte przed graczem) i obowiązujące wytyczne. Z reszty skryptu dostaje tylko to, co skrypt mu powierza: zdarzenia `gm` (z ich `note` i ewentualnymi `beats` do opowiedzenia razem z nimi) oraz flagi `gm`, a także informację, których z tych zdarzeń nie może teraz oznaczyć (bo już zaszły albo blokują je warunki). Oznacza je w swojej odpowiedzi:

- `[story: event="<id>"]` uruchamia zdarzenie `gm`, którego warunki są spełnione (raz, chyba że jest powtarzalne).
- `[story: flag="<id>" value="<value>"]` albo `add="<number>"` dla flagi liczbowej ustawia flagę `gm`.

Podarunki, walka i przemieszczenie zdarzenia `gm` trafiają do odpowiedzi wraz z jego znacznikiem; scena zakończenia i epilog pojawiają się na początku następnej odpowiedzi.

Engine odpowiada na każdy znacznik w miejscu jego wystąpienia, na zdarzenie najwyżej raz na turę, a wszystko inne odrzuca z podaniem powodu. W grze bez fabuły odrzucany jest każdy znacznik fabuły. To, co uruchomi Mistrz Gry, działa od razu (flagi, czyny); sceny zdarzenia i jego prośby pojawiają się na początku następnej odpowiedzi, z wyjątkiem `beats` (Mistrz Gry miał je opowiedzieć razem z danym momentem). `pages` zdarzenia `gm` pisz jako to, co następuje po danym momencie, bo sam moment Mistrz Gry już opowiedział.

## Wypróbowanie fabuły

Zapisz fabułę w grze przez `PUT /api/game/:chatId/story` z treścią `{ "story": { ... } }`: fabuła, która nie pasuje, zostanie odrzucona z podaniem wszystkich powodów. Zakładka World (świat) w grze wymienia cele i zegary, które fabuła już pokazała, a prompt Mistrza Gry zawiera w każdej turze wartości i wytyczne fabuły.
