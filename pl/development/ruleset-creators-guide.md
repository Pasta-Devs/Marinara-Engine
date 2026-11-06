# Przewodnik twórcy zestawu zasad

Ta strona pomoże ci zaplanować zestaw zasad trybu Game Mode dla własnego systemu stołowego, zanim otworzysz strony referencyjne. Wyjaśnia, jak części zestawu zasad łączą się ze sobą, które decyzje mają największe znaczenie i czego nauczyła nas konwersja 16 bardzo różnych systemów. Dokumentacja poszczególnych kluczy zaczyna się od strony [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md), a każda sekcja poniżej zawiera link do strony, którą podsumowuje.

Zestaw zasad to jeden plik JSON (lub pakiet plików), który mówi aplikacji Marinara Engine, jak działa twój system. Engine wykonuje następnie każdy test, stosuje każdą zmianę arkusza i może prowadzić całe walki według twoich zasad. Zestaw zasad nie zawiera kodu, więc projektowanie polega na uzupełnianiu mechanik, które Engine już zna. Mechanika, której nie zna, wymaga zgłoszenia prośby o funkcję w Engine.

Przy każdym kluczu poniżej podano wersję podrzędną Capability API, która go dodała. Pakiet korzystający z klucza deklaruje tę wersję podrzędną lub nowszą (zobacz [Wersjonowanie, testowanie i publikowanie](#versioning-testing-and-publishing)).

Łatwo pomylić dwa pojęcia:

- **Classic i Tactical** to _style walki_: bitwa w menu z przednim i tylnym szeregiem albo bitwa na planszy. Każda gra, z zestawem zasad lub bez niego, korzysta z jednego z nich.
- **Własne zasady aplikacji Marinara** są używane przez grę, która nie ma zestawu zasad. Zestaw zasad je zastępuje.

## Budowa zestawu zasad

Zestaw zasad to jeden plik JSON o rozmiarze najwyżej 512 KB, sprawdzany w całości przy imporcie. Większe zestawy zasad rozdzielają swoje katalogi na pliki pakietu. Zacznij od skopiowania przykładu najbliższego twoim kościom:

- [`ember-roads.json`](../examples/rulesets/ember-roads.json): 2d6 plus cecha.
- [`gravewatch.json`](../examples/rulesets/gravewatch.json): pula d10.
- Pełny [pakiet 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) w repozytorium Marinara-Agents.

Wskaż edytorowi [JSON Schema](../extending/ruleset.schema.json) przez linię `$schema`, aby uzyskać autouzupełnianie i wykrywanie literówek.

| Klucz | Zawartość | Dokumentacja |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Tożsamość. `version` to liczba całkowita zwiększana przy każdej publikacji zmian | [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md) |
| `coverage` | Co obsługuje zestaw zasad (testy, walkę itd.) i jednoliniowe podsumowanie w kreatorze | [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md) |
| `resolution` | Sposób rzutu testu: jeden z pięciu rodzajów, a także przedziały wyników, wydawanie zasobów i przerzuty | [Testy zestawu zasad](../extending/ruleset-checks.md) |
| `sheet` | Atrybuty, umiejętności, pola, listy, bieżące pule, tory, stany, tory ran, kary, migracje | [Arkusze zestawu zasad](../extending/ruleset-sheets.md) |
| `party`, `clocks` | Wspólny arkusz drużyny (załoga, statek, punkty fabuły) i zegary postępu | [Arkusze zestawu zasad](../extending/ruleset-sheets.md) |
| `rests` | Co odnawia i usuwa każdy rodzaj odpoczynku | [Arkusze zestawu zasad](../extending/ruleset-sheets.md) |
| `gm`, `gmReference` | Tekst mistrza gry, podsumowanie każdej postaci, kto prowadzi przeciwników i opis zasad o długości do 16,000 znaków | [Arkusze zestawu zasad](../extending/ruleset-sheets.md) |
| `catalogs` | Gotowe wpisy (zaklęcia, talenty, stworzenia), każdy z opcjonalnym blokiem `mechanics` | [Katalogi zestawu zasad](../extending/ruleset-catalogs.md), [Mechanika wpisów zestawu zasad](../extending/ruleset-mechanics.md), [Kreator postaci zestawu zasad](../extending/ruleset-character-builder.md) |
| `items` | Kategorie, broń, pancerz, amunicja, łupy, pieniądze, początkowy sprzęt, targi | [Przedmioty zestawu zasad](../extending/ruleset-items.md) |
| `battle` | Udostępnia liczby z twojego arkusza własnym walkom Classic i Tactical aplikacji Marinara | [Walka według zestawu zasad](../extending/ruleset-combat.md) |
| `combat` | Prowadzi całą walkę według twoich zasad, z bestiariuszem, planszą, reakcjami i testami przeciwstawnymi | [Walka według zestawu zasad](../extending/ruleset-combat.md) |
| `layers` | Warianty włączane przez gracza dla jednej gry (mało magii, sroga zima) | [Warstwy, tłumaczenia i migracje zestawu zasad](../extending/ruleset-layers-and-translations.md) |

**Identyfikatory.** Identyfikator zestawu zasad zawiera małe litery, cyfry i pojedyncze łączniki (`ember-roads`). Identyfikatory wewnątrz arkusza zawierają małe litery, cyfry i podkreślenia, a zaczynają się literą (`grit_max`). Po publikacji zachowuj stałe identyfikatory, ponieważ wskazują je zapisane postacie, inne zestawy zasad korzystające z twoich katalogów oraz nakładki Experience.

**Tekst bezpieczny dla promptu.** Wszystko, co trafia do modelu (nazwy, etykiety, tekst mistrza gry), mieści się w jednej linii, bez nawiasów kwadratowych i bez `{{` lub `}}`.

**Pakiety.** Zestaw zasad zbyt duży na jeden plik jest udostępniany jako `<id>.ruleset.json`: manifest oraz `ruleset.json`, do 12 plików `catalogs/<id>.json` po 2 MB każdy i do 40 tłumaczeń, wszystko zapisane w base64. Archiwa zip są odrzucane. Edytor zestawów zasad, np. Pixelforge, buduje ten plik za ciebie. Manifest deklaruje wersję podrzędną Capability API wymaganą przez twój zestaw zasad.

**Gdzie jest zapisywany zestaw zasad.** Zaimportowany plik trafia do `local/<id>`, zestaw z repozytorium w serwisie GitHub do `<owner>/<id>`, a zestaw z oficjalnego katalogu zachowuje sam identyfikator. Dwie osoby mogą opublikować własny zestaw `v20` bez kolizji.

## Testy, kości i arkusz

Twoją pierwszą i najważniejszą decyzją jest `resolution.kind`, ponieważ wszystko inne jest interpretowane przez jego pryzmat. Mistrz gry wskazuje tylko umiejętność i trudność. Engine rzuca kośćmi, wykonuje obliczenia na podstawie arkusza i przekazuje modelowi wynik, więc nigdy nie pisz tekstu mistrza gry, który każe modelowi liczyć.

| Rodzaj | Jak wykonuje rzut | Do jakich systemów pasuje |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `dice-sum` | Rzuć kośćmi, dodaj liczby z arkusza i osiągnij lub przekrocz trudność. Obsługuje niestandardowe ścianki, otwarte łańcuchy rzutów i eksplodujące kości | Systemy d20, 2d6 plus cecha, Fate (4dF jako ścianki −1/0/+1), Rolemaster |
| `dice-pool` | Rzuć liczbą kości wynikającą z arkusza i policz te, które osiągnęły próg. Próg może pochodzić z arkusza, być ustalany dla każdego testu i wymagać wyniku powyżej lub poniżej | World of Darkness, Exalted, systemy podobne do Shadowrun, Lasers & Feelings |
| `dice-highest` | Rzuć pulą i odczytaj najwyższą kość albo dodaj kilka najwyższych. Obsługuje regułę dla zera kości i drugi, "ciemny" zestaw | Blades in the Dark i inne gry Forged in the Dark, Trophy Dark |
| `roll-against` | Wyrzuć wynik równy liczbie z arkusza lub niższy (albo wyższy) | Call of Cthulhu, GURPS, BRP, klasyczne systemy X-in-6 |
| `symbol-pool` | Zbuduj i ulepsz kości narracyjne, anuluj przeciwstawne symbole | Genesys i podobne |

Następnie dodaj to, czego potrzebuje twój system. Wszystko opisują [Testy zestawu zasad](../extending/ruleset-checks.md):

- **Przedziały wyników** (`resolution.outcomes`, 1.135): od dwóch do ośmiu nazwanych wyników według marginesu lub sumy, takich jak stopnie sukcesu, "sukces za cenę" albo trudne i ekstremalne sukcesy. Każdy przedział może zawierać linię mówiącą mistrzowi gry, co oznacza przy stole. To była funkcja najczęściej potrzebna w konwertowanych przez nas systemach.
- **Testy rzucane na własny sposób** (`resolution.overrides`, 1.140): kilka umiejętności korzystających z innych kości, np. umiejętności złodzieja na d100 i Open Doors na d6 w systemie d20.
- **Wydawanie zasobów, aby zmienić rzut** (`resolution.spend`) i darmowe przerzuty (`resolution.reroll`): siła woli za sukces, Luck, punkty bohatera. `perCheck` ogranicza to, co można kupić dla jednego rzutu, więc pełna pula nie pozwala kupić pewnego wyniku.
- **Talizman zmieniający rzut**: umieść `mechanics.check` we wpisie katalogu wybranym przez postać, opłacanym własnym kosztem tego wpisu.

**Czego test jeszcze nie potrafi.** Przeciwstawnych pul (porównujących dwa rzuty) i pul sumowanych z dziką kością, jak w OpenD6. Oba przypadki wymagają nowego rodzaju rozstrzygania wewnątrz Engine. Jeśli twój system zależy od jednego z nich, zgłoś prośbę o funkcję w repozytorium Engine z kilkoma w pełni rozpisanymi rzutami; staną się one testami.

**Arkusz** ([Arkusze zestawu zasad](../extending/ruleset-sheets.md)) zawiera atrybuty, umiejętności, pola, listy i wartości pochodne, a także bieżący stan zmieniany przez Engine podczas gry:

- **Pule**, takie jak punkty życia, siła woli, cząstki esencji czy komórki zaklęć, wydawane i odnawiane przez komendy arkusza i odpoczynki.
- **Tory**, takie jak stres, Ruin czy XP, z wyzwalaczami uruchamianymi po ich zapełnieniu.
- **Tory ran**, dla zdrowia przedstawianego jako nazwane poziomy lub numerowane pola zamiast liczby, z karami do rzutów.
- **Stany bieżące**, takie jak forma, postawa lub anima, które mogą zmieniać rzuty, dopóki trwają.
- **Arkusz drużyny i zegary**: załoga, statek lub wspólne punkty fabuły oraz zegary postępu o 4, 6 lub 8 segmentach.

Mistrz gry zmienia arkusz przez komendy arkusza, których Engine uczy go automatycznie z użyciem twoich identyfikatorów, więc nie wyjaśniaj ich w `gm.sheetGuidance`. Trwały rozwój (XP, nowe kropki, awanse poziomów) korzysta z komend arkusza dotyczących katalogów; zobacz [Katalogi zestawu zasad](../extending/ruleset-catalogs.md).

**Tworzenie postaci.** [Kreator postaci zestawu zasad](../extending/ruleset-character-builder.md) prowadzi gracza przez zdefiniowane przez ciebie kroki: pochodzenie i klasę, wyniki (rzucane, kupowane lub przypisywane), biegłości, zaklęcia, sprzęt i początkowe monety, ze sprawdzaniem zgodności z zasadami i tworzeniem wspólnej drużyny. Katalogi mogą korzystać z katalogu innego zainstalowanego zestawu zasad przez `from` (1.220), więc wariant 5e może ponownie wykorzystać stworzenia i zaklęcia SRD zamiast je kopiować.

**Tekst mistrza gry.** `gm.checkGuidance` i `gm.sheetGuidance` (po 1,500 znaków) są wysyłane w każdej turze, więc pisz zwięźle. `gm.worldGuidance` jest odczytywane raz, przy tworzeniu świata ("bez prochu strzelniczego", "magia jest rzadka"). `gmReference` mieści do 16,000 znaków pełniejszego opisu zasad w stałym prompcie systemowym. `gm.sheetSummary` wybiera to, co model widzi dla każdej postaci, a wszystko to kosztuje tokeny w każdej turze. Całość napisz własnymi słowami, nigdy nie kopiuj tekstu podręcznika.

## Walka

Zestaw zasad uczestniczy w walkach na jednym z trzech poziomów. Możesz zacząć od najprostszego i później go pogłębiać. Wybierz go zależnie od tego, w jakim stopniu walka określa tożsamość twojego systemu.

| Poziom | Co piszesz | Co dzieje się podczas walki | Do czego pasuje |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Brak | Bez bloku `battle` ani `combat` | Własna walka Classic lub Tactical aplikacji Marinara samodzielnie tworzy walczących. Arkusz pozostaje nietknięty | Systemy narracyjne, w których walki są fikcją (Fate, Blades, Trophy) |
| Udostępnienie arkusza | Blok `battle`: pula zdrowia, opcjonalna pula energii, komórki zaklęć, do 8 list umiejętności | Obliczenia i kości aplikacji Marinara, ale początkowe zdrowie stanowi taką samą część paska jak w arkuszu, a wynik jest zapisywany z powrotem | Proste systemy, w których konsekwencje mają pozostać |
| Własne zasady | Blok `combat` | Twoje kości rozstrzygają każdy atak, rzut obronny i test przeciwstawny. Przeciwnicy pochodzą z twojego bestiariusza lub skali zagrożenia, a każdy koszt jest od razu zapisywany w arkuszu | Rozbudowane systemy taktyczne (5e, Pathfinder, Storyteller, Genesys) |

**Blok `combat`** parametryzuje jeden z trzech rodzajów znanych Engine: `attack-vs-defense` (kości przeciw wartości obrony), `dice-pool` (twoje pule, zliczanie sukcesów) lub `symbol-pool` (kości narracyjne z wydawaniem zasobów, 1.382). Podstawy to `health` (zmniejszana pula, zaznaczany tor ran lub zwykły zapełniający się tor, 1.383), `defense`, `initiative`, `attackRoll`, ekonomia akcji `economy` oraz listy, które stają się `attacks` i `abilities`. Kompletny mały blok ma około 25 linii; blok Ember Roads w przewodniku [Walka według zestawu zasad](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) to dobry szablon.

Poza podstawami dodaj to, czego potrzebuje twój system:

- **Stany**, z efektami z zamkniętej listy (obrona, rzuty ataku, rzuty obronne, testy przeciwstawne, szybkość, maksymalne zdrowie, obrażenia zadawane i otrzymywane).
- **Rzuty obronne**, koncentracja, zasady umierania i reakcje oczekujące w **oknach** (wpis może czekać na `used`, `aimed`, `hit`, `harmed`, `falls` lub `turn-start`).
- **Testy przeciwstawne** do chwytania, odpychania i uwalniania się.
- **Stworzenia**: katalog bestiariusza odczytywany przez walkę, z blokami statystyk, akcjami, zmysłami i rzucaniem zaklęć. **Skala zagrożenia** pozwala mistrzowi gry wymyślić przeciwnika na jedną walkę, a `combat.threat.budget` (1.803) tworzy starcia według budżetu doświadczenia dla danego poziomu trudności.
- **Mechanika wpisów** we wpisach katalogu: kształty obszarów, trwałe strefy, ściany, przywołania, leczenie dolegliwości i zmysły. Zobacz [Mechanika wpisów zestawu zasad](../extending/ruleset-mechanics.md).

**Classic lub Tactical.** Twoje walki otrzymują planszę tylko wtedy, gdy `combat` deklaruje `distance` (`label`, `perCell`), a arkusz lub stworzenia określają ruch. Bez nich gra Tactical nadal korzysta z twoich zasad, ale walka toczy się w wyobraźni. Jeśli twoje zasady zależą od pozycji (obszary, zasięg, flankowanie), ustaw `"styles": ["tactical"]` (1.379), aby każda gra z twoim zestawem zasad miała planszę.

**Grafika stworzeń** jest oddzielona od zasad: [pakiet stworzeń](../extending/writing-creature-packs.md) (`.creatures.json`, najłatwiej utworzyć go w edytorze Pixelforge) przedstawia twój bestiariusz na planszy Tactical przez dopasowanie identyfikatorów stworzeń. Wszystko bez grafiki zachowuje znacznik.

**Znane ograniczenia** wymienia sekcja [Jeszcze nie](../extending/ruleset-combat.md#not-yet). Podczas konwersji najczęściej napotykaliśmy przeciwstawne rzuty obrony (Dodge i Fight Back, Parry i Block), miejsca trafień, inicjatywę stron i reakcje na reakcje. Mistrz gry opisuje je w narracji wokół walki prowadzonej przez Engine.

## AI walki: umysły, temperamenty i kto prowadzi przeciwników

Engine prowadzi każdego przeciwnika i towarzysza AI, którego nie kontroluje nikt inny, bez wywołania modelu w każdej turze. Jest niezależny od zestawu zasad: testowaliśmy go na konwersjach Storyteller, Exalted, systemów klasycznych, Call of Cthulhu, GURPS i Genesys, a także 5e. Działa bez żadnego z poniższych kluczy; sprawiają one, że twoje stworzenia walczą zgodnie ze swoją naturą. Wszystkie opisuje [Mechanika wpisów zestawu zasad](../extending/ruleset-mechanics.md), a projekt przedstawia strona [AI walki w trybie Game Mode](game-combat-ai.md).

| Klucz | Czym steruje | API |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `mind` stworzenia lub poziomy `combat.minds` wyznaczane przez atrybut | Ile namysłu wkłada w walkę: `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Bestie domyślnie kierują się instynktem, a konstrukty i śluzy są bezmyślne | 1.761 |
| `behavior.temperament` | Jak walczy: reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated | 1.763 |
| Temperamenty przypisywane tylko przez fabułę | `fanatical` (nigdy się nie załamuje), `arrogant` (powstrzymuje się, wzbija się w powietrze, gdy jest legendarny i przegrywa), `territorial`, `cruel`, `honourable` (oferuje drużynie **Surrender** (poddanie się)), `hungry` (odciąga ofiarę). Nigdy nie są przydzielane losowo | Od 1.778 do 1.784 |
| `behavior.role` | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Gdy nie podano, jest przydzielana na podstawie zdolności | 1.763 |
| `behavior.targets`, `opens`, `pack`, `ambush` | Priorytety celów, ruch otwierający, taktyka stada, oczekiwanie w ukryciu | 1.763 |
| `behavior.shifts` | Temperament, który zmienia się po spadku zdrowia poniżej połowy, upadku sojusznika, upadku przywódcy lub osaczeniu | 1.779 |
| `combat.morale` | Kiedy i jak wrogowie sprawdzają odwagę (2d6 poniżej wyniku lub rzut obronny) i kto się poddaje | 1.762, 1.775 |
| `gm.opposition: "game-master"` | Mistrz gry prowadzi każdego przeciwnika, wybierając spośród dozwolonych opcji Engine, a Engine działa zastępczo | 1.774 |

`behavior` może znajdować się w całym bloku `combat`, w typie stworzenia lub w pojedynczym bloku statystyk, przy czym każde zastępuje poprzednie. Przykłady z SRD: wilk `{"targets": ["wounded"], "pack": true}`, goblin `{"temperament": "cowardly", "targets": ["weakest"]}`, ghul `{"ambush": true}`.

**Do walk na planszy AI potrzebuje** `combat.distance`, ruchu (`combat.economy.movement` lub `speed` stworzenia), `range` przy atakach dystansowych i wierszach broni oraz `area` przy wszystkim, co uderza w strefę. Bez zasięgu pistolet działa tylko na wyciągnięcie ręki. Bez obszarów AI nigdy się nie rozprasza.

**Systemy narracyjne.** Domyślnie Engine prowadzi zwykłych wrogów, a mistrz gry prowadzi bossów. W systemie, w którym przeciwników opisuje fikcja, a nie obrażenia (Fate, Blades, Trophy, Lasers & Feelings), `gm.opposition: "game-master"` pozwala modelowi prowadzić każdego przeciwnika zgodnie z jego charakterem. Działa to tylko wtedy, gdy gracz włączy podczas konfiguracji **GM directs bosses** (mistrz gry prowadzi bossów), ponieważ jest to jego zgoda na wywołania modelu podczas walk.

**Bez bloku walki** twoje gry nadal otrzymują morale w walkach Classic i Tactical: każdy wróg niebędący bossem ani bezmyślnym stworzeniem otrzymuje wynik od 2 do 12 na podstawie umysłu i temperamentu, a myślący wrogowie mogą się poddać. Osoba tworząca starcie może oznaczyć `leader` danej strony.

**Temperament drużyny.** Każdy członek drużyny otrzymuje temperament na podstawie pola **Description** (opis) na początku gry i zmienia się on tylko z powodów fabularnych podczas przeglądu na koniec sesji. Towarzysze AI walczą zgodnie z nim. Zestaw zasad go nie ustala, ale twój tekst mistrza gry może się na nim opierać.

## Warstwy, nakładki i migracje

Trzy mechanizmy zmieniają zestaw zasad bez tworzenia jego osobnej odmiany. Użyj warstwy dla wariantu wybieranego przez gracza, nakładki dla treści należących do jednej przygody, a migracji, gdy zmieniasz strukturę arkusza.

**Warstwy** (`layers`, do 12) to przełączniki w kreatorze **New Game** (nowa gra), ustalane na cały czas trwania danej gry. Warstwa może tylko zawężać zakres lub dodawać tekst, nigdy dodawać zasad:

- dopisywać wskazówki mistrza gry (`gm.guidance`, `gm.worldGuidance`; 4,000 znaków na warstwę);
- usuwać wartości z pola wyliczeniowego, zastępować drabinę trudności lub ukrywać wpisy katalogu przez zadeklarowany filtr;
- usuwać monety (1.64), usuwać sprzedawców na targach, oznaczać przedmioty jako niesprzedawane lub zamieniać tabele łupów (1.813);
- deklarować `conflicts` z innymi warstwami.

Warstwa nie może dodać pola, wartości, umiejętności, puli, odpoczynku, sprzedawcy ani tabeli łupów, zmienić rodzaju rozstrzygania ani dotknąć liczb walki. Postacie zachowują wszystko, co usuwa warstwa. Warstwa **Low magic** (mało magii) z SRD to dobry wzór: zaklęcia ograniczone do 5. poziomu, przedmioty powyżej niepospolitych są rzadsze i zwykle nie są sprzedawane, stworzenia związane z potężną magią nie trafiają do losowych starć, a wskazówki świata proszą mistrza gry o wyjaśnienie, dlaczego magia jest rzadka. Inni autorzy mogą ją kopiować. Warstwy pisane dla cudzego zestawu zasad nie są jeszcze obsługiwane.

**Nakładki** (1.355) pozwalają pakietowi map Experience dodawać do twojego zestawu zasad stworzenia, stany, stany arkusza, przedmioty i tory (1.367), dopóki to Experience jest aktywne. Potwory i łupy charakterystyczne dla przygody trzymaj w nakładce, a nie w bazowym zestawie zasad. Nakładka, która ponownie wykorzystuje jeden z twoich identyfikatorów lub nie pasuje, jest odrzucana w całości, co stanowi kolejny powód, aby utrzymywać stałe identyfikatory. Dokumentacja: [nakładki zestawu zasad](optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Migracje** (`sheet.migrations`, 1.77) określają, jak przenosić zapisane postacie, gdy zmieniasz nazwę pola, rozdzielasz jeden poziom na poziomy poszczególnych klas lub rozdzielasz pulę. Dodawanie elementów nie wymaga migracji; zwiększ `sheet.version`, gdy zmienia się struktura arkusza. Dokumentacja: [Warstwy, tłumaczenia i migracje zestawu zasad](../extending/ruleset-layers-and-translations.md).

## Tłumaczenia

Napisz zestaw zasad po angielsku, a każdy inny język udostępnij jako osobny plik tłumaczenia (1.811). Tłumaczenia służą tylko do wyświetlania: zasady, komendy arkusza i wszystko, co przekazuje się mistrzowi gry, pozostają po angielsku, więc tłumaczenie nigdy nie może zepsuć gry.

Kluczem tłumaczenia jest angielski tekst, słowo w słowo:

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Kody języków odpowiadają kodom Engine (`ru`, `pt-BR`, `zh-Hans`). Brakujący lub pusty tekst jest wyświetlany po angielsku, a `pt-BR` najpierw korzysta zastępczo z `pt`.
- **We wspólnym pliku pakietu** umieść je w `locales/<language>.json`, do 40 plików po 8 MB każdy. Import zachowuje tylko bieżący język Engine; aby go zmienić, zmień język i zaimportuj ponownie.
- **W oficjalnym katalogu** każdy język to osobny pakiet, `<id>-<version>.<language>.json`, wymieniony w `locales` wpisu katalogu wraz z adresem URL, sha256, rozmiarem oraz przetłumaczoną nazwą i opisem w katalogu. Engine pobiera tylko pakiet dla bieżącego języka i wymienia go po zmianie języka. Umieszczenie wszystkich 11 języków SRD w jednym pliku zwiększyło rozmiar pobierania z 7 MB do 34 MB, dlatego pakiety są oddzielne.
- Poprawione tłumaczenie nie wymaga nowego `version`.

Pakiet SRD udostępnia w ten sposób 11 języków i jest wzorem do kopiowania. Dokumentacja: [Tłumaczenia](../extending/ruleset-layers-and-translations.md#translations).

## Pakiet 5e (SRD 5.1): pełnowymiarowy przykład

[Pakiet ruleset-5e-2014](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) w repozytorium Marinara-Agents korzysta z niemal każdej funkcji opisanej na tej stronie, więc zajrzyj tam, gdy chcesz zobaczyć klucz w rzeczywistym użyciu. Co warto skopiować:

- **Układ**: `ruleset.json` oraz po jednym pliku na katalog w `catalogs/` (stworzenia, zaklęcia, magiczne przedmioty i inne), budowane w pakiet `.ruleset.json`. Jego README i MODELING.md wyjaśniają, jak zamodelowano każdą zasadę.
- **Licencjonowanie**: uznanie autorstwa CC BY 4.0 w `license`, linia informująca o braku powiązań i brak nazw produktów chronionych znakami towarowymi w całym pakiecie.
- **Pełna walka**: blok d20 `attack-vs-defense` z budżetami akcji, akcji dodatkowej i reakcji, koncentracją, reakcjami takimi jak Shield i Counterspell, planszą, pełnym bestiariuszem z umysłami i temperamentami oraz budżetem starcia.
- **Kreator**: rasa, klasa, rzucane lub kupowane wyniki, biegłości, zaklęcia i początkowy sprzęt.
- **Warstwa** (Low magic) i **11 tłumaczeń** jako pakiety pobierane na żądanie.
- **Stałe identyfikatory**: inne zestawy zasad korzystają z jego stworzeń i zaklęć, więc jego identyfikatory nigdy się nie zmieniają.
- **Testy regresyjne** uruchamiane jako osobne zadanie CI przy każdej zmianie.

Jeśli twój system jest wariantem d20, rozważ korzystanie z jego katalogów przez `from` (1.220) zamiast ich kopiowania.

## Projektowanie podobnych systemów: czego nauczyły nas konwersje

Przekonwertowaliśmy do tego formatu 16 systemów ze zbioru społeczności, od gier fabularnych o prostych zasadach po Rolemaster. Najważniejsza lekcja: zestaw zasad jest tutaj egzekwowany, a nie sugerowany. Engine wykonuje każdy test i stosuje każdą zmianę arkusza, więc wszystko, co pozostawisz na zasadzie "mistrz gry się tym zajmie", rzeczywiście nie jest obsługiwane. Wcześnie zdecyduj, za co odpowiada Engine, a co mistrz gry opisuje w narracji.

| Rodzina systemów | Przykłady | Rozstrzyganie | Klucze, które umożliwiły konwersję | Pozostawione mistrzowi gry |
| ------------------ | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Rozbudowane systemy d20 i d% | 5e, Pathfinder 2e, Rolemaster | `dice-sum` | Przedziały wyników dla stopni sukcesu; `openEnded` i `unmodified` dla Rolemaster; `gmReference` dla dużych tabel | Niełączące się typy premii w Pathfinder; tabele trafień krytycznych Rolemaster wykraczające poza przedziały |
| Klasyczne | OSE | `dice-sum` | `resolution.overrides` dla umiejętności złodzieja (d100) i X-in-6 (d6); morale 2d6 | Inicjatywa stron (rozgrywana jako indywidualna) |
| Rzut poniżej progu | Call of Cthulhu 7e, GURPS Lite | `roll-against` | `against`, kości premii i kary `tens`, ścianki krytyczne, przedziały trudne i ekstremalne | Przeciwstawne Dodge, Fight Back, Parry; miejsca trafień w GURPS |
| Pule Storyteller | V20, W20, Exalted 3e, Exalted WoD | `dice-pool` | Tory ran z karami, stany bieżące (formy, anima), nadpisania dla wyników 1, które nie anulują sukcesów, blok `combat` oparty na pulach | Obszarowe Dyscypliny i Dary, jeśli nie zapisano ich jako wpisów |
| Forged in the Dark | Blades in the Dark, Trophy Dark | `dice-highest` | `keep`, `zeroDice`, zestaw kości `dark`, przedziały (6 / od 4 do 5 / od 1 do 3), tory z `onFull`, zegary, arkusz drużyny dla załogi | Walki, przez `gm.opposition: "game-master"` |
| Pule z postawami | Lasers & Feelings, autorska gra | `dice-pool` | `target` odczytywany z arkusza, `stances` (poniżej lub powyżej), `exact` dla dokładnego trafienia w próg, arkusz drużyny dla statku | Walki jako fikcja |
| Fate | Fate Core | `dice-sum` | Niestandardowe ścianki dla 4dF, przedziały dla remisu i sukcesu ze stylem | Wywołania i wymuszenia jako fabuła; walki jako fikcja |
| Kości narracyjne | Genesys | `symbol-pool` | `combat.kind: "symbol-pool"` z `symbols.spends`, pochłanianie obrażeń i zdrowie na zapełniającym się torze Wounds | Wydawanie zasobów w testach poza walkami |

**Praktyczne rady z tych konwersji:**

1. **Zacznij od kości, potem arkusza, potem tekstu mistrza gry.** Doprowadź do poprawnego rzutu jednego testu, zanim dodasz katalogi lub walkę.
2. **Używaj przedziałów wyników wszędzie, gdzie ma je twój system.** `text` każdego przedziału mówi modelowi, co dzieje się przy stole, a na tym opierają się systemy narracyjne.
3. **Wybierz brak bloku walki zamiast bloku tylko częściowo poprawnego.** System narracyjny działa lepiej z własnymi walkami aplikacji Marinara (lub przeciwnikami prowadzonymi przez mistrza gry) niż z blokiem walki, który modeluje jego zasady tylko w połowie.
4. **Jeśli piszesz walkę, zapewnij jej podstawy planszy**: `distance`, ruch, zasięgi broni dystansowej i przynajmniej jeden atak obszarowy. Każdej konwersji, którą testowaliśmy z AI, brakowało części tych elementów, a jej walki grzęzły lub nigdy nie wykorzystywały pozycji.
5. **Sprawdź ruch względem swojej skali.** Przy 2 metrach na pole stworzenie o szybkości 2 nie mogło wspinać się na wzgórza i walki grzęzły.
6. **Zapisuj swoje źródła.** Dla każdego zestawu zasad prowadź plik notatek wymieniający każdą zasadę źródłową i sposób jej konwersji, zwłaszcza tam, gdzie wybierasz między sprzecznymi interpretacjami. To pierwsza rzecz, o którą pytają recenzenci.
7. **Gdy Engine rzeczywiście nie ma danej mechaniki**, pozostaw ją mistrzowi gry w `gmReference` i zgłoś prośbę o funkcję z w pełni rozpisanymi przykładami. Wiele funkcji opisanych na tej stronie (przedziały wyników, `dice-highest`, `roll-against`, walki na symbolach, zegary, arkusze drużyny) istnieje dlatego, że poproszono o nie podczas konwersji.

<a id="versioning-testing-and-publishing"></a>

## Wersjonowanie, testowanie i publikowanie

**Znaczenie mają dwa numery wersji.** `version` twojego zestawu zasad to liczba całkowita zwiększana przy każdej publikacji zmian. Zainstalowana wersja nigdy nie jest nadpisywana, a każda gra pozostaje związana z dokładną wersją, na której ją utworzono, więc trwająca kampania nigdy nie zmienia swoich obliczeń. Wersja **Capability API** określa, jakich funkcji Engine potrzebuje twój plik. Manifest pakietu deklaruje `schemaVersion: 2` i `capabilityApi: { "major": 1, "minor": N }`, gdzie N jest najwyższą wersją podrzędną spośród wszystkich używanych kluczy, więc starszy Engine nigdy nie otrzymuje oferty twojego zestawu zasad. Zestawy zasad z oficjalnego katalogu wymagają co najmniej 1.374. Zwykły importowany plik nie potrzebuje żadnej deklaracji, ponieważ sprawdza go odczytujący go Engine.

**Cykl pracy nad szkicem.** Edytuj, zwiększ `version`, zaimportuj, rozpocznij nową grę. Import tej samej wersji z inną zawartością jest odrzucany. Stare wersje pozostają zainstalowane, dopóki nie usuniesz zestawu zasad. Zwiększ `sheet.version`, gdy zmienia się struktura arkusza, i napisz migrację, gdy przenoszone są wartości.

**Testowanie.**

- Używaj linii `$schema`, aby edytor wyłapywał literówki i niewłaściwe typy podczas pisania.
- Zaimportuj plik: włącz **Settings → Advanced → Danger Zone → Allow custom Agent imports** (ustawienia, zaawansowane, strefa zagrożenia, zezwolenie na import własnych agentów), a następnie użyj **Agents → Import agents → Game Mode ruleset** (agenci, import agentów, zestaw zasad trybu Game Mode). Przegląd wymienia każdy problem wraz ze ścieżką, zanim cokolwiek zostanie zapisane, w tym nazwy, które na nic nie wskazują.
- Wykonaj kilka testów każdego zadeklarowanego rodzaju, w tym nadpisania, wydawanie zasobów i każdy przedział wyników. Dziennik pokazuje rzeczywiste obliczenia.
- Jeśli masz blok `combat`, rozegraj walki Classic i Tactical, z towarzyszami AI, przeciw stworzeniom o każdym umyśle. Obserwuj zastoje (nikt nie może do nikogo dotrzeć), rażenie sojuszników obszarami i wrogów, którzy nigdy nie używają swoich najlepszych akcji.
- Włącz i wyłącz każdą warstwę oraz zmień język Engine, jeśli udostępniasz tłumaczenia.
- Jeśli Experience nakłada treści na twój zestaw zasad, `POST /api/game/experience/check` zgłasza, co nie pasuje.
- Poproś osobę testującą rozgrywkę, która nie zna twojego systemu, o stworzenie postaci w kreatorze.

**Publikowanie.** Istnieje pięć sposobów, od najprostszego (szczegóły w sekcji [Udostępnianie zestawu zasad](../extending/writing-rulesets.md#sharing-your-ruleset)):

1. Wyślij plik `.json`.
2. Wyślij pakiet `.ruleset.json` z katalogami i tłumaczeniami wewnątrz.
3. Umieść go w publicznym repozytorium w serwisie GitHub w `rulesets/` (najwyżej 32 pliki). Użytkownicy dodają repozytorium jako własne źródło, a zestaw jest zapisywany pod twoją nazwą w serwisie GitHub.
4. Zaproponuj go do oficjalnego katalogu przez pull request do repozytorium [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), w układzie takim jak `ruleset-5e-2014`. Ta droga jest przeznaczona dla popularnych systemów z jasną licencją.
5. Udostępnij Experience, którego pakiet map nakłada na twój zestaw zasad treści przygody.

**Licencjonowanie.** Publikuj tylko tekst zasad, który masz prawo udostępniać. Wiele systemów ma dokument referencyjny na otwartej licencji; umieść jego identyfikator SPDX i wymagany tekst uznania autorstwa w `license`. Zestaw zasad potrzebuje głównie nazw i liczb, więc cały tekst mistrza gry napisz własnymi słowami.

### Zanim udostępnisz

- [ ] Identyfikatory są ostateczne i zgodne z zasadami identyfikatorów.
- [ ] `license` zawiera identyfikator SPDX i tekst uznania autorstwa, a żadne nazwy chronione znakami towarowymi nie są używane bez pozwolenia.
- [ ] Każdy rodzaj testu, nadpisanie, wydanie zasobów i przedział zostały rozegrane przynajmniej raz w grze.
- [ ] `gm.checkGuidance` i `gm.sheetGuidance` są krótkie, nigdy nie każą modelowi liczyć i są napisane własnymi słowami.
- [ ] Walki rozegrano w każdym stylu dozwolonym przez twój zestaw zasad lub ogranicza je `combat.styles`.
- [ ] Manifest pakietu deklaruje właściwą wersję podrzędną Capability API.
- [ ] `version` jest zwiększone względem ostatniego pliku, który ma ktokolwiek inny.
- [ ] Plik notatek wyjaśnia, jak przekonwertowano każdą zasadę źródłową.

## Powiązane przewodniki

- [Pisanie zestawów zasad Game Mode](../extending/writing-rulesets.md)
- [Architektura trybu Game Mode](game-mode-architecture.md), do zmieniania kodu zasad Engine
- [AI walki w trybie Game Mode](game-combat-ai.md)
- [Game Mode: gra z zestawem zasad](../game/rulesets.md)
