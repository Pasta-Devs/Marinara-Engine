# Architektura trybu Game Mode: zestawy zasad, testy i walka

To mapa dla każdego, kto zamierza zmieniać kod zasad trybu Game Mode: gdzie odczytywany jest zestaw zasad, jak rozstrzyga się test i walkę, gdzie przechowywany jest stan i czego wymaga nowy klucz zestawu zasad. Dokumentacja dla graczy znajduje się w `docs/game/`, przewodnik dla autorów zestawów zasad zaczyna się w [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), a AI walki ma własną stronę: [AI walki w trybie Game Mode](game-combat-ai.md).

## Gdzie co się znajduje

| Obszar | Kod |
| --- | --- |
| Format zestawu zasad | `packages/shared/src/schemas/ruleset.schema.ts`: schemat zod, `RulesetRef` (przypięcie) i kontrole wzajemnej zgodności wykonywane przy imporcie. Schemat JSON Schema dla edytora, `docs/extending/ruleset.schema.json`, jest z niego generowany poleceniem `pnpm ruleset:schema`. |
| Capability API | `supportedCapabilityApi` w `packages/shared/src/schemas/capability-package.schema.ts`, z jednym wierszem komentarza dla każdej wersji podrzędnej, opisującym jej dodatki. |
| Obliczenia arkusza postaci i stan bieżący | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (operacje `[sheet:]`), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (blok `battle`). |
| Walki zestawu zasad | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (zawartość menu), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Wszystkie są funkcjami czystymi działającymi na `(definition, state)`. |
| Własna walka aplikacji Marinara | `packages/shared/src/features/tactical-combat/` (silnik Tactical, generowanie siatki, AI), `combat-director.ts`, `combat-conditions.ts`. |
| AI walki | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; zobacz [AI walki w trybie Game Mode](game-combat-ai.md). |
| Serwer: zestawy zasad | `packages/server/src/services/game/ruleset-registry.service.ts` (odczytuje zainstalowane i zaimportowane zestawy zasad, rozwiązuje przypięcie gry), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (stosuje polecenia `[sheet:]` z tury), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Serwer: testy i kości | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Serwer: walki | `combat-director.service.ts` (Classic i Tactical), `combat.service.ts` (obliczenia rundy Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (walka rozstrzygana przez zestaw zasad), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Trasy: `routes/combat-director.routes.ts` (uruchomienie, stan i polecenie reżysera), `routes/encounter.routes.ts` oraz starsze `POST /game/combat/round`, `/game/combat/tactical/start` i `/game/combat/tactical/action` w `routes/game.routes.ts`. |
| Prompt | `gm-prompts.ts` (`buildGmFormatReminder`, bloki arkusza postaci i tagi przekazywane w instrukcjach). |
| Klient | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` i pozostałe `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Zestaw zasad: od pakietu do gry

1. **Źródło.** Oficjalny zestaw zasad to pakiet możliwości typu `ruleset`, który wymienia `ruleset.json` (i ewentualne `catalogs/<id>.json`) w `contributions.assets.paths`, z przypiętymi hashami w `files[]`. Społecznościowy zestaw zasad importuje się jako pojedynczy plik, plik pakietu `<name>.ruleset.json` lub z folderu `rulesets/` repozytorium i przechowuje pod identyfikatorem z przestrzenią nazw (`local/<id>`, `<owner>/<id>`), dzięki czemu nigdy nie może przesłonić oficjalnego zestawu.
2. **Język.** Tłumaczenia oficjalnego zestawu zasad to osobne pakiety dla poszczególnych języków, wymienione w jego wpisie katalogu; menedżer pakietów zachowuje tylko pakiet w języku Engine (`syncRulesetLocalePack` w `package-manager.service.ts`). Zaimportowany plik pakietu zachowuje tylko język aktywny w chwili importu.
3. **Rejestr.** `ruleset-registry.service.ts` parsuje każdą definicję przy użyciu wspólnego schematu i pomija niezdatną do użycia, dodając wpis dziennika. Definicje są przechowywane według identyfikatora i wersji; ta sama wersja z innymi bajtami jest odrzucana.
4. **Przypięcie.** Utworzenie gry zapisuje jednorazowo `chat.metadata.gameRuleset`: `{ id, version, packageId, source?, options }`, gdzie `options` zawiera wybrane warstwy. Brak przypięcia oznacza własne zasady aplikacji Marinara. Przypięcie, którego ta instalacja nie może spełnić (brak zestawu lub wersja starsza od przypiętej), jest zgłaszane, a testy gry pozostają do rozstrzygnięcia; nigdy nie rozstrzyga się ich według zasad innego systemu.

## Stan

| Część | Zawartość | Gdzie | Cofanie wraz ze swipe'ami |
| --- | --- | --- | --- |
| Początkowa konfiguracja postaci | Arkusz postaci wypełniany przez gracza na karcie lub personie | Karta `data.extensions.rulesetSheets[rulesetId]`, persona `personaStats.rulesetSheets[rulesetId]` | Nie dotyczy |
| Konfiguracja postaci w grze | Kopia pobierana przy konfiguracji gry, zmieniana przez **Edit sheet** (edycja arkusza postaci) i awanse na kolejne poziomy | `chat.metadata.gameCharacterCards[].rulesetSheet` | Nie |
| Stan bieżący | Pule, tory, stany, statusy, notatki | `game_state_snapshots.ruleset_live` | Tak |
| Walka | Starcie, jego ziarno i kursor kości, informacja o tym, czyja jest tura | Wiersz przechowywany przez reżysera walki, jeden na czat | Przywracana wraz z turą, która ją rozpoczęła |

Stan bieżący należy do migawki, dzięki czemu ponownie wygenerowana tura nigdy nie wydaje zasobów ponownie. Przechowywany arkusz postaci ma postać `{ v, build }`, limit 64 KB i jest odczytywany tolerancyjnie: nieznane pola są zachowywane, a brakujące przyjmują wartości domyślne. Układ, który przenosi wartości pod nowe identyfikatory, deklaruje `sheet.migrations`, stosowane przy odczycie przez `readRulesetSheetEnvelope` i `readStoredLiveState`. Arkusz postaci zestawu zasad, który nie jest zainstalowany, jest zachowywany w stanie uśpienia, nigdy usuwany.

## Test od początku do końca

1. Mistrz gry zapisuje `[skill_check: …]`, opcjonalnie z `who=`, `with=`, nazwą stopnia drabiny, urokiem lub wydatkiem zasobu. Przy włączonych kościach w jednym żądaniu może zamiast tego zapisać blok rozgałęzień lub tekst zastępczy `[[roll: …]]` (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` odczytuje przypięty zestaw zasad i wybiera sposób rozstrzygania według `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` lub `symbol-pool`. Liczby zapisane przez model są kontrolowane i zastępowane, chyba że zestaw zasad gwarantuje ich poprawność; gwarancja nigdy nie obejmuje pul, zachowywanych kości ani wyników w przedziałach.
3. Kości: test wykonuje rzut przez `rollDieSecurely` (Web Crypto, w `packages/shared/src/utils/dice-notation.ts`). Walka zestawu zasad, użycia przedmiotów w jej ramach, łupy i rynki wykonują rzuty przez `seededDieRoller(seed, cursor)` z tego samego modułu, dzięki czemu walkę można odtworzyć z jej ziarna. Od #8608 nie ma innego mechanizmu rzutów.
4. Wynik jest zapisywany z powrotem jako kompletny tag i karta rzutu kośćmi oraz rejestrowany w **Logs** (dzienniki).

## Polecenia arkusza postaci

Mistrz gry zmienia arkusz postaci za pomocą `[sheet: who="Name" op="…"]`. Operacje, które może wskazać tag, to `spend`, `restore` (alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (alias `cast`), `pass`, `advance`, `dismiss`, `prepare` i `unprepare` (`RULESET_SHEET_OP_NAMES` i `RulesetSheetOp` w `live-state.ts`). `ruleset-sheet-turn.service.ts` weryfikuje każdą operację względem bieżącego arkusza postaci; operacja niemożliwa do wykonania, na przykład rzucenie zaklęcia, gdy nie zostało już żadne miejsce na zaklęcie, zostaje odrzucona, zapisana w dzienniku i zgłoszona raz na turę, a nic nie jest stosowane częściowo. `sheet` to zastrzeżony tag GM.

## Walka od początku do końca

Walka w grze toczy się w jednym z trzech stylów, wybranym przez zestaw zasad i ustawienie **Combat Preference** (preferowany styl walki) gry:

| Zestaw zasad | Styl | Serwer |
| --- | --- | --- |
| Brak zestawu lub brak bloku `battle`/`combat` | Walka Classic lub Tactical aplikacji Marinara | `combat-director.service.ts` |
| Blok `battle` | Walka aplikacji Marinara korzystająca z pul, miejsc i umiejętności katalogowych arkusza postaci; zdrowie przenoszone jako część maksimum i zapisywane z powrotem | `combat-director.service.ts` z `combat-bridge.ts` |
| Blok `combat` | Własna walka zestawu zasad, na planszy, gdy `combat` określa odległość odpowiadającą polu, a gra działa w trybie Tactical | `ruleset-combat-director.service.ts` |

Wszystkie trzy współdzielą rejestr reżysera: jeden wiersz przechowywanych danych na czat, jedną rewizję, zabezpieczenie oparte na identyfikatorze żądania i kolejkę osobną dla każdego czatu. Rejestr obejmuje tylko walki obsługiwane przez reżysera. Starsze trasy w `game.routes.ts`, `POST /game/combat/round` (która wywołuje `resolveCombatRound` dla przesłanych jej uczestników walki), `/game/combat/tactical/start` i `/game/combat/tactical/action`, nie prowadzą rejestru: klient przechowuje stan walki i przesyła go z powrotem przy każdym wywołaniu. W walce zestawu zasad menu decyduje o legalności (`options.ts`), moduł rozstrzygający stosuje wybór (`resolve.ts`), rzuty kośćmi wynikają z ziarna i kursora walki, a wszystko, co członek drużyny wydaje lub traci, jest zapisywane według zasad samego arkusza postaci, więc zamknięcie karty w trakcie walki niczego nie gubi. Przeciwnicy, których nikt nie opracował, są tworzeni na podstawie bestiariusza zestawu zasad i budżetu starcia; mistrz gry może prowadzić nazwanych przeciwników i bossów, wybierając spośród propozycji uszeregowanych przez Engine.

## Dodawanie klucza zestawu zasad

1. Dodaj go do `ruleset.schema.ts` wraz z kontrolami wzajemnej zgodności oraz do typów TypeScript odczytywanych przez moduł rozstrzygający.
2. Zwiększ `supportedCapabilityApi` o jedną wersję podrzędną i dodaj odpowiedni wiersz komentarza. Uzależnij dostępność klucza od wersji, tak aby korzystający z niego zestaw zasad musiał deklarować tę wersję podrzędną lub nowszą.
3. Najpierw zaimplementuj go we wspólnym kodzie funkcji czystych, następnie podłącz serwer, a potem klienta.
4. Uruchom `pnpm ruleset:schema`, aby ponownie wygenerować `docs/extending/ruleset.schema.json`.
5. Opisz go na odpowiedniej stronie przewodnika dla autorów (`docs/extending/ruleset-*.md`), a także w dokumentacji dla graczy, jeśli będzie dla nich widoczny.
6. Dodaj `scripts/regressions/*.regression.ts`, który sprawdza go przez kod funkcji czystych, uwzględniając odrzucane dane wejściowe.
7. Wymień zmienione strony angielskie w otwartym zgłoszeniu `[docs-i18n]`.

`docs/development/ruleset-5e-2014.example.json` to okrojony szkic 5e, który setki testów regresyjnych i testów od początku do końca odczytują jako dane testowe. Nie jest to dostarczany pakiet SRD, który znajduje się w repozytorium Marinara-Agents w `packages/ruleset-5e-2014/`.

## Prace do wykonania

- Przelatywanie nad przeszkodami na planszy zestawu zasad: latająca jednostka porusza się tak samo jak pozostałe.
- Przywoływanie we własnych systemach walki Classic i Tactical aplikacji Marinara (walki zestawu zasad już obsługują przywoływanie). Projekt opisuje [AI walki w trybie Game Mode](game-combat-ai.md#summoning-design-extension).
- Agent Battlefield Scout, który przygotowuje opis terenu walki, opisany w [AI walki w trybie Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
