# Walka według zestawu zasad

Ta strona jest częścią przewodnika [Pisanie zestawów zasad Game Mode](writing-rulesets.md). Jak zestaw zasad uczestniczy w walce: blok `battle`, który udostępnia arkusz postaci systemowi walki aplikacji Marinara Engine, oraz blok `combat`, który rozstrzyga całą walkę według własnych reguł zestawu zasad, z jego bestiariuszem, planszą, reakcjami i testami przeciwstawnymi.

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

Powyższy blok `battle` udostępnia walce liczby z karty, pozostawiając matematykę Marinara. Opcjonalny blok `combat` służy do czegoś innego: określa, jak twoje zasady ROZSTRZYGAJĄ walkę. Parametryzuje należący do Engine rodzaj walki, tak jak `resolution` parametryzuje rodzaj testu; wszystkie nazwy w nim należą do ciebie. Istnieją trzy rodzaje: `attack-vs-defense`, w którym kości są sumowane i porównywane z liczbą, `dice-pool`, w którym walka rzuca własnymi pulami twojego zestawu `dice-pool` i liczy sukcesy (zobacz niżej Walka rzucana pulami), oraz `symbol-pool`, w którym walka rzuca kośćmi narracyjnymi twojego zestawu `symbol-pool` i wydaje to, co pozostaje po anulowaniu symboli (zobacz niżej Walka rzucana kośćmi symbolicznymi).

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

<a id="every-key"></a>

### Wszystkie klucze

- `kind`: `"attack-vs-defense"` (jedna strona rzuca kośćmi przeciw obronie drugiej; trafienie zadaje obrażenia), `"dice-pool"` (zobacz Walka rzucana pulami) lub `"symbol-pool"` (zobacz Walka rzucana kośćmi symbolicznymi). Każdy z poniższych kluczy znaczy to samo we wszystkich rodzajach i jest odczytywany tak, jak dany rodzaj odczytuje liczby.
- `health`: wymagane. To, co zabiera walka. Albo `{ "pool": "grit" }`, bieżąca pula pomniejszana liczbowo, której bufor tymczasowy, jeśli istnieje, pochłania obrażenia jako pierwszy; albo `{ "track": "harm" }`, tor ran, który jest ZAZNACZANY. Tor ran wymaga obok `damageKinds`. Można też podać `{ "track": "wounds" }`, wskazując zwykły tor (bez `levels` ani `boxes`), który WYPEŁNIA SIĘ od `min` do `max` (Capability API 1.383): obrażenia dodają punkty, leczenie je odejmuje, a tor przy `max` oznacza wyeliminowanie z walki, tak jak pula przy zerze. Tak działa Wounds z Genesys, z Wound Threshold jako `max`; system, w którym pada się dopiero PO przekroczeniu progu, ustawia `max` o jeden wyżej od niego. Zwykły tor zdrowia zaczyna od `default` (nie `startFrom`), nie może zaczynać przy `max` i nie przyjmuje `damageKinds`. `max` obliczane przez arkusz jest indywidualne dla każdej postaci, tak jak maksimum puli. Żaden tor nie przyznaje punktów tymczasowych.
- `defense`: wymagane, odwołanie do wartości. Pole wypełniane przez gracza albo obliczana przez ciebie wartość pochodna.
- `initiative`: wymagane. Kości rzucane raz na początku i opcjonalne odwołanie do modyfikatora. Remis wygrywa wyższy modyfikator, następnie kolejność tworzenia uczestników walki. `"each": "round"` ponownie rzuca inicjatywą wszystkich na początku każdej nowej rundy, z modyfikatorem w jego ówczesnej wartości (więc modyfikator odczytujący tor ran spowalnia po zranieniu), a runda zaczyna się od tego, kto jest pierwszy w nowej kolejności. Capability API 1.47. Walka `dice-pool` może zamiast tego rzucać inicjatywą jako pulą: `pool` (odwołanie do wartości) to liczba kości, a ich sukcesy plus `plus` dają wartość, bez `dice` ani `modifier` obok. `resource`, które wymaga `pool`, zachowuje tę wartość i pozwala atakom ją przesuwać (zobacz niżej "Inicjatywa przesuwana atakami"). Capability API 1.48.
- `attackRoll`: wymagane przy `attack-vs-defense` i odrzucane przy `dice-pool`, który rzuca własnymi pulami rozstrzygania. Kości, informacja, czy system rzuca dwa razy i zachowuje jeden wynik (`advantage`), działanie skrajnych ścian pojedynczej kości (`naturals.max`: `critical`, `hit` lub `none`; `naturals.min`: `miss` lub `none`) oraz wpływ trafienia krytycznego na obrażenia (`critical`: `double-dice` ponownie rzuca kośćmi obrażeń, `max-dice` dodaje raz ich najwyższe wyniki, `none` oznacza zwykłe trafienie). Szczególne wyniki naturalne wymagają jednej kości, dokładnie jak przy testach. Rzuty obronne w walce używają tych samych kości. `criticalFrom` poszerza zakres trafienia krytycznego: to wartość odczytywana z karty atakującego, będąca najniższym naturalnym wynikiem liczonym jako trafienie krytyczne, np. `{ "field": "critical_from" }` dla Championa z 5e, którego karta podaje 19. Jest ograniczana do najwyższej ścianki kości, wartość poniżej 2 oznacza brak zakresu (tylko najwyższa ścianka, jak u postaci, której pole pozostawiono na 0) i wymaga pojedynczej kości z `naturals.max` ustawionym na `critical`. Capability API 1.81.
- `economy`: wymagane. `budgets` określa dostępne elementy tury: identyfikator, etykietę, `per` (`turn` uzupełnia na początku własnej tury posiadacza, `round` na początku nowej rundy) i `count`. PIERWSZY zadeklarowany budżet jest główny i zużywa go akcja standardowa. `movement` to opcjonalne odwołanie do wartości: odległość ruchu w jednej turze, we własnej jednostce odległości. Odczytuje ją walka na planszy (zob. Pozycje).
- `attacks`: opcjonalne. Listy karty, których wiersze są bronią. `name` to kolumna tekstowa nadająca wierszowi nazwę, `damage.dice` to kolumna kości, a każde z `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` i `damage.type` wskazuje kolumnę tej samej listy. Kolumna `ability` to `enum` zawierające identyfikator jednej z twoich cech; inna wartość niczego nie dodaje. Kolumna `proficiency` to `boolean`; gdy jest włączona, dodaje premię z biegłości. Wiersz bez czytelnych kości nie jest atakiem, więc lina na tej samej liście pozostaje liną. `toHit.skill` wskazuje kolumnę `enum` zawierającą identyfikator jednej z twoich umiejętności: wiersz dodaje to, co dodaje test tej umiejętności, z własnym `ability` wiersza zamiast atrybutu umiejętności, jeśli go wskazuje, dokładnie tak jak podmienia go `with=` testu (Capability API 1.47). `abilityChoices` przypisuje wartości z kolumny atrybutu wiersza dwa lub więcej identyfikatorów twoich atrybutów (Capability API 1.793): wiersz, który ją odczytuje, wykonuje atak z tym atrybutem, który dodaje najwięcej do trafienia, i zadaje obrażenia z tym samym atrybutem. Służy to właściwości Finesse z SRD 5.1, zapisanej jako `{ "finesse": ["str", "dex"] }`, z `finesse` wśród wartości kolumny. Wartość jest odrzucana, jeśli sama jest atrybutem, wskazuje atrybut, którego nie ma w twoim arkuszu postaci, albo nie jest dostępna w kolumnie atrybutu. `toHit.sheetBonus` (Capability API 1.800) dodaje do trafienia liczbę z arkusza postaci: `value` to dowolne odwołanie do wartości, a `when: { "column": ..., "equals": ... }` ogranicza tę premię do wierszy, których kolumna zawiera tę wartość. Styl walki Archery z SRD 5.1, "+2 premii do rzutów ataku wykonywanych bronią dystansową", odczytuje `listSum` kolumny zdolności w wierszach, których `reach` wynosi 0, więc rzucony sztylet nie otrzymuje tej premii. `strikes` to opcjonalne odwołanie do wartości określające, ile uderzeń kupuje JEDNO zużycie budżetu listy: wybranie wiersza bez uderzeń w zapasie zużywa budżet i daje pozostałe uderzenia, a dopóki zapas istnieje, każdy wiersz deklarujący `strikes` nie kosztuje budżetu. Dzięki temu menu samo pozwala zmienić broń, cel i przejść między nimi. `strikesCappedBy` wskazuje kolumnę logiczną ograniczającą JEJ WŁASNY wiersz do jednego uderzenia, niezależnie od liczby kupowanej przez listę, dla broni strzelającej raz na turę bez względu na liczbę ataków właściciela: powstała dla właściwości Loading z SRD 5.1. Na liście kupującej i tak jedno uderzenie jest bez znaczenia i jest odrzucana. Zapas uderzeń należy do WALCZĄCEGO, nie do jednej listy: postać z dwiema listami broni deklarującymi `strikes` korzysta z tego samego zapasu niezależnie od użytego wiersza. Jest on zerowany na końcu tury, w której go kupiono. Lista bez deklaracji kupuje jedno uderzenie za zużycie budżetu, jak każda walka przed wprowadzeniem tej funkcji.

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
- `standardEffects`: opcjonalne, dla części akcji standardowej niewyrażonej jej flagą. Obecnie tylko `dodge` ma taki efekt: `{ "dodge": { "saves": ["dex_save"] } }` określa, które twoje rzuty obronne unikający wykonuje dwa razy z zachowaniem lepszego wyniku przez czas trwania uniku. Wskazuj tylko rzuty zadeklarowane na karcie i tylko gdy lista `standard` zawiera `dodge`. Pominięcie zachowuje dotychczasowe działanie uniku: trudniej trafić i nic więcej. `{ "help": { "beside": true } }` (Capability API 1.771) udostępnia akcję pomocy tylko obok przeciwnika, a pomoc działa tylko przeciwko przeciwnikowi, który znajdował się obok pomagającej postaci; wymaga `help` na twojej liście `standard`.
- `conditions`: opcjonalne. Mapuje TWOJE identyfikatory stanów na ich działanie, dzięki czemu stany karty i walki są jednym zapisem, a zatruta postać pozostaje zatruta po walce. Efekty tworzą zamkniętą listę: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) i `cannot-approach-source`. `failsSaves` wskazuje rzuty obronne automatycznie nieudane w tym stanie. Sześć efektów wymagających odległości lub ruchu (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) odczytuje walka na planszy; poza nią nie działają (zob. Pozycje). `cannot-react` wyklucza posiadacza z okna otwieranego przez ruch, więc nie jest pytany. Obok efektów są cztery dodatkowe klucze:
  - `modifiers`: liczby zmieniane przez stan, dopóki trwa. Zobacz niżej Liczby zmieniane przez stan.
  - `saves`: których rzutów obronnych dotyczą dwa efekty rzutów obronnych i każdy modyfikator rzutów obronnych. Pominięcie oznacza wszystkie; podanie bez żadnego z nich jest odrzucane.
  - `skills`: których umiejętności dotyczą dwa efekty testów i każdy modyfikator testów niewskazujący własnych umiejętności. Pominięcie oznacza wszystkie; podanie bez żadnego z nich jest odrzucane. Testy przeciwstawne w walce rzucają własne testy walki, a nie umiejętności, więc coś zawężonego do umiejętności nigdy do nich nie trafia; odczytuje to test jednej z tych umiejętności poza walką (zob. [Testy poza walką](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
  - `whileSourceInSight`: co działa tylko wtedy, gdy osoba nakładająca stan znajduje się w polu widzenia posiadacza. `true` uzależnia cały stan; lista jego własnych efektów uzależnia tylko je, pozostawiając resztę. Tego wymaga strach zabraniający zbliżenia niezależnie od widoczności źródła. Wskazanie efektu nieobecnego w stanie jest odrzucane. Bez planszy nie ma linii widzenia do przerwania, więc wszystko działa w obu przypadkach.
  - `endsWhenSourceDown`: stan znika natychmiast po powaleniu osoby, która go nałożyła.
  - Zmysły (Capability API 1.127): `lacks` stanu wskazuje zmysły, których posiadacz nie ma, a `mechanics.needs` wpisu katalogu lub `needs` akcji stworzenia wskazuje zmysły, które cel musi mieć, aby efekt na niego zadziałał. Dla Deafened z 5e zapisz `"lacks": ["hearing"]`; dla Command zapisz w jego mechanice `"needs": ["hearing"]`. Ogłuszony cel nie pojawia się w menu celów Command. Efekt obszarowy lub wielocelowy wymagający słuchu całkowicie pomija taki cel: bez rzutu obronnego, obrażeń i stanów. Gdy Deafened się skończy, cel znów jest dozwolony. Każda lista ma od jednego do czterech unikalnych identyfikatorów zmysłów, we własnych słowach zestawu; Engine nie zna żadnych nazw zmysłów.
  - Użycie tylko wtedy, gdy pozwala na to karta (Capability API 1.166): `mechanics.usableWhen` wpisu katalogu to `{ "value": <value reference>, "atLeast": n, "atMost": n }` (jedna granica lub obie). W walce wpis jest oferowany, w turze posiadacza lub w oknie reakcji, tylko wtedy, gdy wartość odczytana z karty, stanu bieżącego i przedmiotów posiadacza mieści się w granicach; odczytuje się ją przy każdym rysowaniu menu. Protection z 5e wymaga tarczy w ręce: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. "Bez ciężkiego pancerza" z Rage to to samo z `"atMost": 0` dla liczby ciężkich pancerzy. Stworzenie zapisane jako blok statystyk nie ma karty, więc nic go nie ogranicza.
  - Stany nakładane tylko wtedy, gdy pozwala na to karta nakładającego (Capability API 1.167): wpis `applies` w mechanice wpisu katalogu lub w użyciu przedmiotu może zawierać `"when"` o tej samej postaci co `usableWhen`. Odczytuje się je z karty, stanu bieżącego i przedmiotów tego, kto nakłada stan, w chwili nakładania, a wpis poza granicami jest pomijany; pozostałe nadal działają. Rage z 5e nakłada `raging` i jeden z trzech stanów obrażeń w granicy czterech wpisów: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, a potem `raging_damage_3` z `"atLeast": 9, "atMost": 15` i `raging_damage_4` z `"atLeast": 16`. Nakładający bez karty nakłada każdy wpis. Blok statystyk stworzenia i `onEnd` stanu nie mają karty nakładającego do odczytania, więc `when` jest tam odrzucane. Wymaga schemaVersion 2 i capabilityApi 1.167 lub nowszego.
  - Typy stworzeń i testy celu (Capability API 1.168): `combat.creatureTypes` wymienia, czym może być uczestnik walki, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    Stworzenie wskazuje własne `type` i `tags`; typ postaci to wartość pola tekstowego lub wyboru `field`, jeśli jest jednym z typów, a w przeciwnym razie `default` (postacie z 5e to humanoidy). Test celu to `{ "types": [...], "tags": [...] }` i jest spełniony przy dowolnym dopasowaniu; uczestnik walki bez typu i bez tagów nigdy nie pasuje. Umieszcza się go w trzech miejscach: `targetIs` klauzuli obrażeń zadaje tę klauzulę tylko pasującemu celowi (dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, woda święcona: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); `targetIs` wpisu `applies` nakłada ten stan tylko na pasujący cel; a `mechanics.targetTypes: { "is": test, "not": test }` określa, kogo w ogóle można wybrać lub objąć (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Obszar omija każdego, kogo wyklucza `targetTypes`. Prognoza liczy klauzulę `targetIs` tylko przeciw celowi, którego by dotyczyła; zwykła średnia na karcie ją pomija. Panel bitwy i Mistrz Gry widzą typ i tagi każdego uczestnika walki. Wymaga schemaVersion 2 i capabilityApi 1.168 lub nowszego.
  - Zakończenia stanów (Capability API 1.125): Charm Person używa `"endsWhen": ["harmed-by-source-side"]`. Obrażenia większe od zera od tego, kto nałożył stan, lub od kogokolwiek z jego strony albo wymierzenie przez nich w posiadacza ataku, rzutu obronnego lub szkodliwego stanu kończy stan po pełnym rozstrzygnięciu szkodliwej akcji, nawet jeśli atak chybi lub rzut obronny się powiedzie. `"saveWhenDamaged": true` powtarza rzut obronny z tury przy obrażeniach: każde obrażenia większe od zera powtarzają `saveEnds` nakładającej akcji z zapisaną trudnością; sukces kończy stan. Bez zapisanego rzutu obronnego lub trudności nic nie jest rzucane. Hypnotic Pattern używa `"endsWhen": ["damaged"]` i `"shakeOff": { "budget": "action" }`: dowolne obrażenia większe od zera natychmiast go kończą, a inny uczestnik walki po stronie posiadacza może w swojej turze wydać ten budżet, aby go zakończyć. `shakeOff.reach` jest w jednostce odległości zestawu i domyślnie wynosi jedno pole; bez planszy żadna odległość nie jest mierzona. Ekonomia musi deklarować ten budżet. `endsWhen` ma jeden lub dwa unikalne wpisy. Te klucze nie zmieniają zakończeń przy upadku źródła i przy końcu koncentracji. Dla rzutu obronnego wykonywanego tylko przy obrażeniach większych od zera, nigdy na początku ani na końcu tury, użyj `saveEnds.at: "damaged"` (Capability API 1.129): applies z Dominate Person to `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, które rzuca raz na cios z zapisaną trudnością nakładającej akcji, bez potrzeby `saveWhenDamaged`.
  - Ekonomia akcji (Capability API 1.76), tak jak zmieniają ją Haste i Slow:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` daje posiadaczowi w każdej turze o tyle więcej (lub mniej) jednostek budżetu tury, nigdy poniżej zera. Zmienić w ten sposób można tylko budżet uzupełniany `per` turę. Budżet można zadeklarować z `"count": 0` dla takiego, który uzupełnia tylko stan, a ekran pokazuje go tylko wtedy, gdy ktoś go ma. Wymyślony przeciwnik nigdy go nie wydaje.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }`
    określa, na co można wydać ten budżet: wskazane akcje standardowe (z własnej listy `standard` zestawu, nigdy na pierwszym budżecie, gdzie każda akcja standardowa już jest), jeden atak bronią z pojedynczym uderzeniem (niezależnie od tego, ile uderzeń dałaby akcja; dla stworzenia atak z jego bloku statystyk w jeden cel, nigdy wielokrotny atak) oraz użycie przedmiotu: `true` dla dowolnego przedmiotu albo `{ "tags": ["mundane"] }` tylko dla przedmiotu z jednym z tych tagów (Use an Object z 5e dotyczy przedmiotu zwykłego, nigdy aktywacji przedmiotu magicznego). Są oferowane, gdy budżet, który zwykle by zużywały, się wyczerpie, i tylko we własnej turze posiadacza: przyznanie nigdy nie płaci za reakcję.
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
- `damageKinds`: wymagane, gdy `health` wskazuje tor ran, a odrzucane, gdy wskazuje pulę, ponieważ tylko znacznik przechowuje rodzaj, a pula punktów nie ma na niego miejsca (zob. [Tory ran](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number)). Określa, który z `kinds` toru zaznacza cios i ile pól wypełnia. `default` jest rodzajem dla wszystkiego bez mapowania, w tym ciosu bez typu, a `byType` mapuje twoje `damageTypes` na rodzaje; klucze, jak same typy, są dopasowywane bez wielkości liter, więc `"Fire"` i `"fire"` są jednym kluczem i podanie obu jest odrzucane. `marks` nie ma wartości domyślnej, ponieważ dwie odpowiedzi są przeciwne: `"per-point"`, gdy rzut obrażeń liczy poziomy zdrowia, więc cios za trzy zaznacza trzy pola i warto złagodzić go o jeden; oraz `"per-blow"`, gdy cios albo trafia, albo nie, więc zaznacza jedno pole niezależnie od siły. Cios z kilkoma składnikami obrażeń nadal zaznacza jedno pole, używając najcięższego rodzaju, który trafił. Wskaż, jak działa twój system. `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: wymagane przy `dice-pool`, odrzucane przy `attack-vs-defense`. Zobacz Walka rzucana pulami.
- `spendLimits`: opcjonalne. Ile z bieżącej puli jeden walczący może wydać na `turn` lub na `round` w walce dowolnego rodzaju: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` jest odczytywane raz, na początku walki. Koszt przekraczający pozostałą część limitu jest niemożliwy do opłacenia, więc znika z menu, niezależnie od zawartości puli. Limit na turę odnawia się na początku własnej tury posiadacza, a limit na rundę na początku rundy. Przeciwnik zapisany zwykłymi liczbami za nic nie płaci z karty, więc limit nigdy go nie wiąże; przeciwnik zapisany jako karta płaci z własnych pul i podlega limitowi jak każdy inny. Capability API 1.47.
- `threat`: opcjonalne, wymagane przez bestiariusz. `tiers` to skala wyboru przeciwnika: identyfikator, etykieta, przedział `health`, `defense`, `toHit`, przedział `damagePerRound` i `saveDifficulty`. Każde dostarczane stworzenie wskazuje jeden z tych poziomów, a nienapisany wcześniej przeciwnik zostaje dopasowany do poziomu żądanego przez Mistrza Gry, więc nikt nie wypada poza skalę. Przedział `damagePerRound` oznacza działanie stworzenia na JEDEN cel w rundzie, łącznie z całą sekwencją. Poziom może zawierać `worth`, czyli wartość stworzenia tego poziomu w budżecie spotkania (punkty doświadczenia według stopnia wyzwania w 5e), a `threat` może zawierać `budget`, czyli dopuszczalną wartość walki dla drużyny, która do niej przystępuje (Capability API 1.803):
  - `level`: pola liczbowe, których suma jest poziomem członka drużyny (5e: po jednym na klasę).
  - `steps`: kroki trudności, od najniższego, każdy w postaci `{ "id", "label" }`.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`, po jednej wartości na krok trudności dla jednego członka drużyny na danym poziomie lub wyższym, poziomy w kolejności rosnącej.
  - `crowd`: opcjonalne, `[{ "from": 2, "times": 1.5 }]`, mnożnik wartości przeciwników stosowany, gdy ich liczba osiągnie wskazaną wartość; `smallParty` i `largeParty` powodują odczyt wiersza wyżej dla drużyny mniejszej niż pierwszy próg i wiersza niżej dla drużyny większej niż drugi próg (mnożniki z 5e 2014). Pomiń dla budżetu z SRD 5.2, który sumuje wartości bez zmian.
  - `forGame`: opcjonalne, krok, na którym rozgrywana jest walka na każdym poziomie trudności gry (`casual`, `normal`, `hard`, `brutal`). Jeśli go nie podasz, poziomy trudności korzystają z kolejnych kroków, a każdy poziom wykraczający poza ostatni krok korzysta z ostatniego.

  Mistrz gry otrzymuje wartość każdego poziomu i budżet drużyny przed napisaniem walki. Wymyślona przez niego walka o wyższej wartości zostaje osłabiona: wymyślony przeciwnik o największej wartości spada o poziom, i tak wielokrotnie, aż walka zmieści się w budżecie; walka z bossem może sięgać następnego kroku trudności. Stworzenie z bestiariusza i stworzenie powracające z wcześniejszej walki są liczone bez zmian, a walka w historii pozostaje w gestii jej autora. Informacja o tym, co osłabiono, pojawia się w korektach walki.

### Rzuty obronne przeciw stanom, obrażeniom lub magii

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
- `hardness`: odwołanie do wartości twardości walczącego, gdy inicjatywa jest liczbą przesuwaną atakami. Zobacz [Pancerz i efekty założonych przedmiotów w walce](ruleset-items.md#armor-and-worn-effects-in-a-fight).

Obrażenia każdego celu są rzucane osobno dla niego, bo to, co trafienie uzyskało ponad wymagane sukcesy, i to, co cel pochłania, należą do niego. Drugi składnik ciosu i efekt dodatkowy to osobne pule obrażeń własnego rodzaju, bez dodatkowych kości z trafienia. Menu prognozuje pulę dokładnie: szansę osiągnięcia wymaganych sukcesów i wartość kości obrażeń po tym, co pochłonie pierwszy cel.

Tak zapisano Gravewatch: jego strażnicy rzucają cechą i umiejętnością zawodową, pochłaniają stłuczenia przez Sinew, a rozdarć wcale, mogą wydać jeden punkt Resolve na turę i rzucają inicjatywą ponownie w każdej rundzie.

**Deklarowanie w odwrotnej kolejności nie jest zaimplementowane.** W niektórych systemach wszyscy deklarują akcje, zanim ktokolwiek zacznie działać, od najwolniejszego. W walce, w której każdy walczący wybiera jedną akcję, gdy nadchodzi jego tura, wcześniejsza deklaracja nie zmienia niczego, co odczytuje jakakolwiek reguła, więc klucz nie miałby czego określać.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### Walka rzucana kośćmi symbolicznymi: `symbol-pool`

Zestaw `symbol-pool` odczytuje symbole zamiast liczb i tak samo mogą działać jego walki, więc Engine prowadzi całą walkę bez pytania Mistrza Gry, co kupił symbol przewagi. `"kind": "symbol-pool"` wymaga, aby `resolution.kind` miało wartość `"symbol-pool"`, i odczytuje arkusz tak, jak już robią to twoje testy symboliczne:

- Liczba trafienia to kości atakującego. W arkuszu liczba wiersza ataku to jego atrybut i rangi umiejętności razem: większa wartość określa, iloma kośćmi się rzuca, a mniejsza – ile z nich się ulepsza, tak jak `pool.build: "larger-upgraded"` buduje test. Akcja stworzenia podaje to przez `toHit` (swoje kości) i `upgrades` (ile z nich zostaje ulepszonych), co wymaga puli z kością `upgrade`, która nie jest budowana przez `sum`.
- `defense` to liczba kości trudności rzucanych przeciw kościom atakującego. `defense` stworzenia to jego własna liczba tych kości. Osłona i modyfikator `defense` ze stanu dodają kości trudności.
- Modyfikator ataków, rzutów obronnych lub testów ze stanu oraz kara za rany wskazana w `penaltyFrom` dają kości wzmocnienia, gdy pomagają, i kości przeszkody, gdy utrudniają, więc są liczbami `flat`: modyfikator rzucany (`dice`) jest odrzucany. Rzut z utrudnieniem (daleki zasięg, utrudnienie ze stanu) otrzymuje jedną kość przeszkody więcej, a rzut z ułatwieniem – jedną kość wzmocnienia więcej.
- Sukcesy netto (w liczbie twojego `success.needed`) zapewniają trafienie. Liczba rzutu obronnego to jego kości, a trudność to kości przeciwko nim; test przeciwstawny rzuca kości każdej strony i wygrywa większa liczba sukcesów netto. Inicjatywę można rzucać jako pulę (`initiative.pool`): jej sukcesy netto dają wartość.
- Obrażenia są sumowane tak jak w walce `attack-vs-defense`. Każdy sukces netto dodaje do trafienia `damage.perSuccess` (jeden): każdy sukces (`"counts": "all"`) lub tylko te ponad wymagane do trafienia (`"beyond"`), a pochłanianie celu odejmuje się od całego ciosu, nigdy poniżej zera.
- Nic nie daje krytycznej porażki i nic nie podwaja rzutu obrażeń. Trafienie krytyczne kupuje się za symbole.

Działanie symboli określa blok `symbols`:

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: to, co cel odejmuje od każdego trafienia, odczytywane z jego arkusza. `all` to odwołanie do wartości dla dowolnego rodzaju obrażeń, a `byKind` – po jednym dla każdego rodzaju twojego toru zdrowia, z pierwszeństwem przed `all` dla swojego rodzaju. Stworzenie podaje własne jako `soak: { "all": 2 }`, co wymaga zadeklarowania tego `soak`.
- `spends`: do 16 efektów, które kupuje symbol pozostały po anulowaniu w rzucie ataku. Liczba `cost` symboli `symbol` kupuje efekt raz, a `max` (jeden) określa, ile razy można go kupić w jednym rzucie; efekt dający `condition` lub `critical` działa raz, więc jego `max` pozostaje równe jeden, a żadne dwa efekty nie nakładają tego samego stanu (ani dwóch z jednej grupy `oneAtATime`) na tę samą osobę w tym samym rzucie. Efekt nie zostaje kupiony, jeśli niczego by nie zrobił: jego stan nie zostałby nałożony (jest blokowany lub posiadacz ma już stan tego rodzaju) albo na jego torze nie ma miejsca na cały krok w danym kierunku (miejsce mógł już wykorzystać wcześniejszy efekt z tego samego rzutu). `by` określa, która strona wybiera efekt: atakujący wydaje sprzyjające mu symbole (przewagę, triumf), a cel te sprzyjające celowi (zagrożenie, rozpacz). Dany symbol wydaje jedna strona, a efektu nigdy nie kupuje się za sukcesy, które już zapewniają trafienie i zwiększają jego obrażenia.
- `when`: efekt kupuje się tylko przy `hit`, tylko przy `miss` albo przy obu (`any`, domyślnie). `damage` (obrażenia dodawane do trafienia przed pochłanianiem) i `critical` (trafienie jest krytyczne, więc działa klauzula z `onCritical`, a dziennik to odnotowuje) wymagają `"when": "hit"` i `"by": "attacker"`.
- Działanie kupionego efektu, dowolne z następujących: `condition` nakłada na kogoś jeden z twoich stanów, na `rounds` lub dopóki coś go nie zakończy; `track` przesuwa zwykły bieżący tor o `by` (napięcie, stres), nigdy tor zdrowia; `boost` i `setback` dodają tyle kości do następnego rzutu wykonanego w tej walce przez osobę, której dotyczą, a ten rzut je zużywa. `on` to `attacker`, `target`, `attacker-ally` lub `target-ally`; sojusznik to następna osoba danej strony, która będzie miała turę, a efekt bez dostępnego takiego sojusznika nie jest kupowany.
- `worth`: opcjonalne, wartość kupowanego efektu w punktach obrażeń według AI. Bez tego Engine oblicza ją na podstawie działania: obrażenia są warte tyle, ile wynoszą, stan jest wart dwa, kość w następnym rzucie nieco ponad pół, a krok toru pół – przeciw drugiej stronie lub dla własnej strony wybierającego, gdy obniża tam tor albo dodaje kości wzmocnienia. Efekt nic niewarty dla wybierającego nigdy nie jest kupowany.

Engine kupuje dla każdej strony efekty warte najwięcej za posiadane przez nią symbole, zarówno dla graczy, jak i przeciwników, i wypisuje każdy w dzienniku. Gracz może zamiast tego wybierać samodzielnie: po zaznaczeniu na ekranie walki **Choose my own symbol spends** (samodzielny wybór wydawania symboli) rzut, który zostawia coś do kupienia granemu przez niego członkowi drużyny, czeka, aż gracz wybierze efekty po jednym, przyjmie wybór Engine dla reszty lub zrezygnuje z dalszego wydawania. Jego wybór podlega tym samym zasadom co wybór Engine (koszt, `max`, `when` i to, co mogłoby zadziałać), a Engine nadal wybiera za wszystkich pozostałych. Zestaw zasad nie potrzebuje do tego żadnych zmian. Niewydane przez nikogo symbole pozostają przy rzucie do opisania przez Mistrza Gry. Prognoza menu uwzględnia każdy możliwy wynik rzutu: szansę trafienia i obrażenia trafienia z jego sukcesami i kupionymi efektami, po pochłanianiu. AI ocenia według tego każdy atak, odejmując koszt efektów, które mogłaby kupić druga strona.

**Co pozostaje Mistrzowi Gry.** Koszt efektu kupowanego za symbole należy do zestawu zasad, a nie do poszczególnej broni, więc broń z własnym progiem trafienia krytycznego zapisuje się jako efekt wspólny dla zestawu; rzut w tabeli trafień krytycznych wykonuje Mistrz Gry. Przewaga w rzucie obronnym, teście lub teście przeciwstawnym niczego nie kupuje: wydaje się tylko symbole z rzutu ataku. Ulepszanie kości trudności w walce nie jest zaimplementowane.

### Minimalne kości obrażeń

Walka pulami może zachować kości nawet przeciw silnemu pochłanianiu, tak jak **Overwhelming** z Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

To jest `combat.damage.minimum`, odwołanie do wartości odczytywane z bieżącej karty **atakującego**. Gdy statyczne pochłanianie odejmie kości od pierwszej puli obrażeń trafienia, pula jest podnoszona co najmniej do tej liczby. To pełne kości, zaokrąglone w dół i ograniczone przez zero i `resolution.pool.max`, a nie automatyczne sukcesy: każda pozostała kość może zawieść. Rzucane pochłanianie nadal odejmuje sukcesy po rzucie obrażeń; nie zmniejsza puli kości, więc minimum nie chroni przed nim sukcesów. Odporność i niewrażliwość nadal działają. Ciosy wydające inicjatywę ignorują minimum, tak jak ignorują obrażenia broni i pochłanianie; ciosy zabierające inicjatywę go używają.

Broń może zastąpić wspólne minimum przez `item.attack.damage.minimum`. Przyjmuje te same odwołania do wartości na posiadaczu albo `{ "stat": "overwhelming" }` dla jednej z własnych liczbowych statystyk przedmiotu. Zadeklarowane zero także zastępuje wspólne minimum. Różni się to od istniejącego `floor` broni, który gwarantuje określone obrażenia po pochłonięciu. Dodatkowe klauzule obrażeń i efekty dodatkowe nie otrzymują kolejnego minimum. Zapis walki i dziennik pokazują rozstrzygnięte minimum obok kości. Zarówno klucz walki, jak i klucz broni wymagają w pakiecie **Capability API 1.146**, także dla broni w zewnętrznych plikach katalogów.

### Trafienie, które oszałamia

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

### Cel wybiera rodzaj rany

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
- `resist`, `vulnerable`, `immune`: typy obrażeń, dopasowywane bez wielkości liter i sprawdzane względem `combat.damageTypes`, jeśli jakieś deklarujesz. Wpis `resist` lub `immune` może też określać, co się przez niego przebija, `{ "type": "tearing", "except": ["silver"] }`: cios bronią-przedmiotem z jednym z tych tagów przedmiotów jest przyjmowany bez zmian (Capability API 1.55, zobacz [Broń w walce](ruleset-items.md#weapons-in-a-fight)), podobnie jak akcja, której `damage.qualities`, albo wpis katalogu, którego `mechanics.qualities` wskazuje jeden z nich (Capability API 1.101). `conditionImmunities` wskazuje twoje własne stany albo tor odczytywany przez twoje `combat.levels` (Capability API 1.115).
- `tier`: szczebel `combat.threat`, do którego należy stworzenie.
- `loot` (Capability API 1.63): identyfikator tabeli łupów losowanej za nie po wygranej walce (zobacz [Łupy](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795): co stworzenie może mieć przy sobie na początku walki, do 16 wierszy. Każdy wiersz wskazuje jeden z twoich przedmiotów (`item`, jako `<catalog>/<entry>`) albo jedną z twoich tabel łupów (`table`), z `chance` (na sto, domyślnie 100) i `count` (liczba albo kości, domyślnie 1; tyle razy wykonuje się rzut z tabeli). W walce używa tego, czego może: stworzenie z `sheet` używa swoich przedmiotów tak jak członek drużyny, a zwykły blok statystyk używa przedmiotu, którego `use` zużywa go przy użyciu i nie odczytuje żadnych danych użytkownika (mikstura, olej). To, co mu zostanie, upuszcza po pokonaniu, obok swojego `loot`; jeśli ucieknie, zabiera to ze sobą. Mistrz gry może zamiast tego dać przeciwnikowi własny ekwipunek (`carrying` w starciu), który zastępuje te wiersze.
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

Testowa kopia szkicu 5e w aplikacji Engine, `docs/development/ruleset-5e-2014.example.json`, zawiera bestiariusz pięciu ręcznie napisanych stworzeń, obejmujących sekwencję, odnowienie, rzut obronny ze stanem, odporności i niewrażliwości, ograniczone użycia, punkty akcji specjalnych i jedno stworzenie zapisane jako karta. Pełny bestiariusz SRD znajduje się w pliku `catalogs/creatures.json` oficjalnego [pakietu 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014).

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

**Które style może wykorzystywać gra.** `combat.styles` wskazuje identyfikatory stylów walki, które może wykorzystywać gra z twoim zestawem zasad: `classic`, `tactical` lub styl zarejestrowany przez klienta (do 8, każdy raz, w tym co najmniej jeden z `classic` i `tactical`). Po pominięciu wszystkie style są oferowane jak wcześniej. Zestaw zasad, którego reguły wymagają planszy (obszary, zasięg, osłona, flankowanie), podaje `"styles": ["tactical"]`: kreator **New Game** (nowa gra) i ustawienia gry oferują wtedy tylko Tactical, więc jej walki zawsze mają pozycje. Gra zapisana wcześniej ze stylem, którego nie wymieniasz, używa pierwszego wymienionego stylu, który klient potrafi narysować (pierwszego wymienionego stylu wbudowanego, jeśli klient nie ma wymienionego stylu rejestrowanego), a gry nie można utworzyć ani przełączyć w ustawieniach na pominięty styl. Trwająca już walka zachowuje styl, w którym się rozpoczęła. Lista obowiązuje niezależnie od tego, czy reżyser walki jest włączony, więc ogranicza także własne bitwy Classic i Tactical aplikacji Marinara z twoim zestawem zasad. Zestaw używający `styles` wymaga Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

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

**W powietrzu** (Capability API 1.354). Na każdej planszy to, czy latający jest w powietrzu, stanowi jego osobny stan: latający bez chodzenia lub z `hover` zaczyna w powietrzu; ten na ziemi startuje darmową opcją **Take off** (start), przez lot w górę lub krok możliwy tylko dzięki lotowi (nad wodą lub tam, gdzie lot jest tańszy niż chodzenie), a ląduje darmową opcją **Land** (lądowanie; tylko jeśli umie chodzić) lub gdy zostanie przewrócony, powalony lub unieruchomiony do szybkości zero, chyba że zawisa w powietrzu. Lot w dół do ziemi pozostawia go w powietrzu na wysokości podłoża, dopóki nie wyląduje. Gdy jest w powietrzu, używa swojej grafiki lotu. Żadna inna część zasad jeszcze nie odczytuje tego stanu.

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
- **Między turami.** Po zakończeniu tury, zanim zacznie się następna, każdy przeciwnik z `signaturePoints`, którego stać na własną akcję `signature`, jest pytany o jej zakup. Można je kupować tylko wtedy, chyba że `combat.signatureAtTurnStart` stanowi inaczej: akcji specjalnej nie ma w menu niczyjej tury, także własnej.
- **Zaczyna się tura wroga** (Capability API 1.805). Przy `"combat": {"signatureAtTurnStart": true}` każdy posiadacz `signaturePoints` jest też pytany na początku tury przeciwnika, gdy już nastąpi to, co wyzwala ten początek (stany, rzuty obronne, reakcje), a zanim przeciwnik podejmie działanie: boss odpowiada bohaterowi, który zaraz zacznie działać, tak jak przy przewidywaniu w zwykłej walce. Akcje leża mają własny licznik i nie są tu oferowane. Jeśli to ustawienie pominięto, akcje specjalne kupuje się tylko między turami, tak jak legendarne akcje w 5e. Zestaw zasad, który go używa, wymaga Capability API 1.805.
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

- **Poza prostą planszą**: brak latania nad przeszkodami. Stworzenie przesuwa tylko jego własne chodzenie, chodzenie wierzchowca, teleportacja, to, co je pcha (test przeciwstawny, wpis, akcja stworzenia lub strefa), oraz ten, kto je ciągnie.
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
