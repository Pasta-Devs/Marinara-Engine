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
  "cutscenes": []
}
```

Identyfikatory mają od 1 do 40 znaków (małe litery, cyfry, `_` lub `-`) i są unikalne w obrębie swojej listy. Fabuła zawiera najwyżej 64 flagi, 64 wytyczne, 128 zdarzeń i 64 przerywniki. Żaden tekst w niej nie może zawierać znaku nowej linii, nawiasów kwadratowych ani `{{`, a nazwy wpisywane do znacznika (grupa, tło) nie mogą zawierać podwójnego cudzysłowu: nic, co mówi fabuła, nie może udawać jednego ze znaczników Mistrza Gry.

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

Cel typu tak/nie jest wykonany, gdy jego flaga ma wartość true; cel liczbowy – gdy flaga osiągnie wartość `goal` (1, jeśli jej nie podano), a gdy `goal` jest wpisane, dziennik pokazuje postęp. Cel z `"hidden": true` czeka w dzienniku ukryty, dopóki nie odsłoni go zdarzenie.

### Wytyczne

Wytyczna to stała instrukcja dla Mistrza Gry, obowiązująca, dopóki spełnione są jej warunki:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Warunki

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Wszystkie warunki z listy `if` muszą być spełnione. Flagę typu tak/nie porównuje się tylko za pomocą `=` lub `!=`.

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
| `fight` | Gdy walka zakończy się wynikiem `outcome`: `victory`, `defeat` lub `flee`. |
| `broke` | Gdy walka zniszczy obiekt o nazwie `prop` (Capability API 1.316); wielkość liter nie ma znaczenia. Wskazać można tylko obiekt namalowany na jednym z pól bitwy świata. |
| `flags` | Gdy jego warunki są spełnione. Z `repeat` – ponownie za każdym razem, gdy z niespełnionych znów staną się spełnione. |
| `gm` | Tylko wtedy, gdy uruchomi je Mistrz Gry (zdarzenie wymaga `"gm": true`). |
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

Fabuła nie daje przedmiotów, nie rozpoczyna walk, nie przemieszcza drużyny ani nie kończy gry: to pozostaje w rękach Mistrza Gry i gracza. O takie rzeczy poproś Mistrza Gry przez `tell`.

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

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Przerywnik `beats` Mistrz Gry opowiada własnymi słowami, punkt po punkcie, w tej samej turze. Punkty zdarzenia `gm` Mistrz Gry dostaje razem z tym zdarzeniem i opowiada je w odpowiedzi, która oznacza dany moment. Dlatego scenę z punktami, której używa zdarzenie `gm`, Mistrz Gry zna od początku, nawet jeśli odtwarza ją też zdarzenie uruchamiane przez Engine. Ponieważ Mistrz Gry dostaje je w każdej turze, punkty wszystkich zdarzeń `gm` łącznie mogą mieć najwyżej 16 000 znaków.

### Wiadomość otwierająca

`intro` (Capability API 1.339) określa, jak zaczyna się gra. To ten sam wybór, który konfiguracja GM oferuje w każdej grze:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` sprawia, że pierwsza wiadomość gry to dokładnie `text`; Mistrz Gry niczego w niej nie pisze, a ponowne wygenerowanie daje ten sam tekst. `"guided"` tylko kształtuje początek pisany przez Mistrza Gry, jako wskazówki, które czyta on wyłącznie przy tej pierwszej odpowiedzi. `text` ma od 1 do 8000 znaków i może zawierać znaki nowej linii (to jedyny tekst w fabule, który może), ale nigdy `{{`; tekst wskazówek nie może też zawierać nawiasów kwadratowych. Z `locked` gracz widzi wiadomość otwierającą w konfiguracji GM i nie może jej zmienić; bez tego wiadomość tylko wypełnia pole w konfiguracji, a gracz może ją zmienić albo wyczyścić. Gra, w której pierwsza odpowiedź została już napisana albo która przenosi drużynę z innej gry, nie ma wiadomości otwierającej.

## Jak przebiega fabuła

Raz na turę, zanim Mistrz Gry odpowie, Engine odczytuje, co fabuła zrobiła do tej pory i co przynosi ta tura (wędrówka, wizyta, koniec walki), i pozwala zajść zdarzeniom. To, co zaszło, zostaje zapisane na początku tej odpowiedzi: znacznik dla każdego zdarzenia i tego, co ustawiło, oraz każda scena pokazana w zapisanej postaci. Ponieważ fabuła jest odczytywana z powrotem z odpowiedzi, swipe albo ponowne wygenerowanie cofa to, co zrobiła dana odpowiedź, a fabuła zmieniona w trakcie gry nigdy nie przepisuje tego, co już się wydarzyło. Fabuła przechodzi do następnej sesji gry.

<a id="the-game-masters-tags"></a>

### Znaczniki Mistrza Gry

W każdej turze Mistrz Gry dostaje wartości fabuły (ukryte przed graczem) i obowiązujące wytyczne. Z reszty skryptu dostaje tylko to, co skrypt mu powierza: zdarzenia `gm` (z ich `note` i ewentualnymi `beats` do opowiedzenia razem z nimi) oraz flagi `gm`, a także informację, których z tych zdarzeń nie może teraz oznaczyć (bo już zaszły albo blokują je warunki). Oznacza je w swojej odpowiedzi:

- `[story: event="<id>"]` uruchamia zdarzenie `gm`, którego warunki są spełnione (raz, chyba że jest powtarzalne).
- `[story: flag="<id>" value="<value>"]` albo `add="<number>"` dla flagi liczbowej ustawia flagę `gm`.

Engine odpowiada na każdy znacznik w miejscu jego wystąpienia, na zdarzenie najwyżej raz na turę, a wszystko inne odrzuca z podaniem powodu. W grze bez fabuły odrzucany jest każdy znacznik fabuły. To, co uruchomi Mistrz Gry, działa od razu (flagi, czyny); sceny zdarzenia i jego prośby pojawiają się na początku następnej odpowiedzi, z wyjątkiem `beats` (Mistrz Gry miał je opowiedzieć razem z danym momentem). `pages` zdarzenia `gm` pisz jako to, co następuje po danym momencie, bo sam moment Mistrz Gry już opowiedział.

## Wypróbowanie fabuły

Zapisz fabułę w grze przez `PUT /api/game/:chatId/story` z treścią `{ "story": { ... } }`: fabuła, która nie pasuje, zostanie odrzucona z podaniem wszystkich powodów. Zakładka World (świat) w grze wymienia cele, które fabuła już pokazała, a prompt Mistrza Gry zawiera w każdej turze wartości i wytyczne fabuły.
