# Mapa architektury (dla programistów)

Ten przewodnik to materiał dla osób rozwijających projekt. Opisuje organizację kodu aplikacji Marinara Engine: wspólne fundamenty, systemy funkcji, przypisanie kodu do trybów oraz miejsce każdego elementu. Wymienia też obecne duże pliki i kierunek przyszłych refaktoryzacji.

Zakres: `packages/client/src`, `packages/server/src` i `packages/shared/src`. Repozytorium nie zawiera klasycznego zestawu testów `.test.ts`. Automatyczną weryfikację zapewniają śledzone skrypty regresyjne oraz przeglądarkowe testy dymne Playwright; tymczasowe pliki dowodowe `.test.ts` są w `.gitignore` i znikają po użyciu.

Liczba plików, linii i tras zmienia się wraz z repozytorium. Ta mapa podaje przybliżone kształty i nazwy. Dokładne liczby zawsze sprawdzaj w aktualnym drzewie plików.

## Kody sekcji

Używaj tych kodów przy planowaniu przenosin, opisywaniu zgłoszeń i dodawaniu krótkiego nagłówka do pliku, którego jeszcze nie da się przenieść.

| Kod | Znaczenie | Miejsce docelowe |
| --- | --- | --- |
| `CORE-CONTRACT` | Typy, schematy, stałe i czyste funkcje pomocnicze wspólne dla klienta i serwera | `packages/shared/src` |
| `CLIENT-APP` | Rozruch aplikacji React, powłoka układu, globalne podpięcie interfejsu | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | Elementy interfejsu tylko po stronie klienta, wspólne hooki, wspólne funkcje przeglądarkowe, globalne magazyny stanu | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Rozruch aplikacji Fastify, middleware, rejestracja tras, konfiguracja środowiska uruchomieniowego | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Fundamenty tylko serwerowe: magazyn danych, baza, LLM, prompty, lorebooki, import i integracje | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | Interfejs i zachowanie serwera wyłącznie dla trybu Conversation | komponenty trybu Conversation, `/api/conversation`, usługi trybu Conversation |
| `MODE-ROLEPLAY` | Interfejs trybu Roleplay, sceny, sprite'y, pomocniki starć | komponenty czatu w trybie Roleplay, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Interfejs trybu Game Mode, prompty GM, kości, drużyna, mapa, walka, zasoby, sesje | `components/game`, `/api/game`, usługi gry |
| `FEATURE-AGENTS` | Definicje agentów, wykonywanie, stan debugowania, kierowanie wiedzy | komponenty agentów, magazyn stanu agentów, trasy i usługi agentów |
| `FEATURE-ASSETS` | Tła, awatary, galeria, generowane obrazy, sprite'y, zasoby gry | trasy zasobów, magazyn galerii, usługi obrazów |
| `FEATURE-SIDECAR` | Lokalne środowisko modeli, analiza sceny, pobieranie, sterowanie procesami | magazyn stanu sidecar, `/api/sidecar`, usługi sidecar |
| `FEATURE-TTS` | Konfiguracja TTS, dobór głosów, klucze pamięci podręcznej, odtwarzanie dźwięku | ustawienia, hooki, trasy i usługi TTS |
| `FEATURE-IMPORT` | Importery SillyTavern i Marinara oraz pomocniki migracji | trasy i usługi importu |
| `TEST` | Śledzone testy regresyjne i przeglądarkowe testy dymne, a w razie potrzeby tymczasowe testy dowodowe | `scripts/regressions`, `e2e` oraz tymczasowe pliki `packages/server/src/**/__tests__/` usuwane po użyciu |

Najlepiej, żeby sekcję komunikowała sama ścieżka pliku. Komentarz w stylu `// Section: MODE-GAME` przydaje się tylko wtedy, gdy plik nadal leży w mieszanym folderze.

## Granice pakietów

### packages/shared

`CORE-CONTRACT`. Ten pakiet ma pozostać niezależny od środowiska uruchomieniowego.

Obecna zawartość:

- `types`: czat, postać, gra, stan gry, walka, scena, sidecar, TTS, agenci, prompty, lorebooki, eksporty, motywy.
- `schemas`: schematy Zod dla utrwalanych i współdzielonych bytów.
- `constants`: dostawcy, wartości domyślne, tryby czatu, listy modeli, prompty agentów.
- `utils`: czyste funkcje pomocnicze, na przykład rozwijanie makr, opakowywanie w XML i dobór muzyki.
- `features`: manifesty i rejestr agentów, definicje wywołań funkcji, pakiety folderów, silniki gier turowych UNO, Chess i Poker, zestawy zasad Game Mode i ich walka (`rulesets`, `ruleset-combat`, `tactical-combat` oraz pliki `combat-*`), a także generator świata z plikami do udostępniania (zestawy settingu, światy, paczki kafelków, plansz i stworzeń) w `world`.

Zasady:

- Żadnego kodu React, DOM, Fastify, magazynu serwerowego, systemu plików, sieci ani SDK dostawców.
- Przenoś tu kod tylko wtedy, gdy klient i serwer potrzebują tego samego kontraktu albo czystego algorytmu.
- Nie rób z pakietu `shared` śmietnika na funkcje pomocnicze używane wyłącznie przez klienta.

### packages/client

React 19 i Vite PWA. Obecnie mieści kilkaset plików źródłowych.

Obecny kształt najwyższego poziomu:

- `App.tsx`, `main.tsx`: rozruch aplikacji, React Query, PWA, efekty globalne.
- `components/layout`: powłoka aplikacji, paski boczne, górny pasek, renderer okien modalnych.
- `components/ui`: elementy interfejsu wielokrotnego użytku.
- `components/chat`: wymieszany interfejs wspólny dla czatu oraz dla trybów Conversation i Roleplay, scen, sprite'ów i starć.
- `components/game`: powierzchnia i panele trybu Game Mode.
- `components/panels`, `components/modals`, edytory bytów: ustawienia i zarządzanie zasobami.
- `features`: wydzielone moduły funkcji, obecnie sekcje panelu **Chat Settings** (ustawienia czatu), elementy panelu trackera, gra wieloosobowa oraz kontrakt, konfiguracja, scena i renderery agentów awatarów (`features/avatars`).
- `hooks`: hooki React Query i hooki czasu pracy aplikacji dla większości funkcji API.
- `lib`: funkcje pomocnicze przeglądarki i klienta. Mieszają się tu obecnie pomocniki wspólne z pomocnikami tylko dla trybu Game Mode.
- `stores`: magazyny stanu Zustand dla interfejsu, czatu, agentów, stanu gry, trybu Game Mode, zasobów, procesu sidecar, tłumaczenia, galerii, starć i gier turowych.
- `styles`: globalny arkusz stylów i CSS poszczególnych motywów.

Ważne obecne powiązania między obszarami:

- `components/game` importuje `components/chat`, żeby korzystać ze wspólnych elementów wizualnych, na przykład efektów pogody i panelu bocznego galerii.
- `components/chat` importuje stan gry i stan starcia na potrzeby funkcji trybu Roleplay.
- `hooks/use-generate.ts` sięga do stanu czatu, agentów, gry, trybu Game Mode, tłumaczenia oraz ustawień interfejsu.
- Pomocniki `lib/game-*` służą tylko trybowi Game Mode, ale leżą obok pomocników globalnych.

### packages/server

API Fastify, magazyn danych oparty na plikach i integracje z dostawcami. Obecnie mieści kilkaset plików źródłowych.

Obecny kształt najwyższego poziomu:

- `app.ts`, `index.ts`: fabryka aplikacji, rozruch, serwowanie plików statycznych, wczytywanie magazynu plikowego i seedery.
- `routes`: wiele plików tras. Większość to cienkie API typu CRUD, ale `generate.routes.ts` i `game.routes.ts` to duże pliki orkiestrujące. Folder `routes/generate/` zawiera fragmenty wydzielone dotąd ze ścieżki generowania, w tym łańcuch wyjścia tokenów (`generation-stream-output.ts`), rundy wywołań narzędzi (`tool-rounds.ts`), parsowanie komend w odpowiedzi i czyszczenie tekstu oraz zapis odpowiedzi (`save-generated-reply.ts`).
- `services/storage`: warstwa fasady magazynu dla czatów, postaci, promptów, lorebooków, ustawień, zasobów, motywów i stanu gry.
- `services/llm`: rejestr dostawców, bazowy kontrakt dostawcy, dostawcy zgodni z OpenAI, most do lokalnego procesu sidecar.
- `services/prompt`: wspólne składanie promptu dla generowania poza trybem Game Mode.
- `services/conversation`: harmonogramy, wiadomości autonomiczne, świadomość kontekstu, profile trybu Conversation, obsługa komend trybu Conversation.
- `services/game`: prompty GM, kości, walka, maszyna stanów, prompty drużyny, mapy, pogoda, czas, sesje, punkty kontrolne, reputacja, zasoby.
- `services/sidecar`: lokalne środowisko uruchomieniowe, zarządzanie modelami, analiza sceny, obróbka sceny po analizie.
- `services/agents`: wykonywanie agentów i kierowanie wiedzy.
- Fundamenty funkcji: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (przechowywanie modeli awatarów, ich generowanie i klasyfikator emocji dla agentów awatarów), `speech-to-text.service.ts` oraz `discord-webhook.ts`.
- `db/schema`: definicje tabel plikowych dla danych zapisywanych w `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts`: metadane tabel natywnych i wyrażenia zapytań.
- `db/file-backed-store.ts`: magazyn tabel w pamięci, granica transakcji, odzyskiwanie po awarii i utrwalanie migawek JSON. Zobacz [Przechowywanie danych w plikach](file-storage.md).

Ważne obecne powiązania między obszarami:

- Trasy importują bezpośrednio usługi magazynu, LLM, promptów, lorebooków, gry, procesu sidecar i pozostałych funkcji.
- `generate.routes.ts` obsługuje główną ścieżkę generowania w trybach Conversation i Roleplay oraz potok agentów.
- `game.routes.ts` odpowiada za orkiestrację gry, a przy okazji sięga do LLM, procesu sidecar, lorebooków, obrazów, magazynu i zachowania webhooka Discord.
- Analiza sceny mieszka w usługach sidecar, ale tryb Game Mode może ją uruchomić albo przez proces sidecar, albo przez wybrane połączenie LLM.

## Przypisanie kodu do trybów

### Wspólne dla wszystkich trybów

To są fundamenty globalne:

- Utrwalanie czatów i wiadomości: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, wspólne typy i schematy czatu.
- Postacie i persony: trasy postaci, magazyn, schematy oraz klienckie hooki i edytory postaci.
- Połączenia i dostawcy: trasy połączeń, magazyn, wspólne stałe dostawców i `services/llm`.
- Presety promptów, lorebooki, regex i własne narzędzia: wspólne fundamenty tworzenia treści i wstawiania ich do promptu.
- Transport generowania: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` oraz rejestr dostawców.
- TTS, tłumaczenie, galeria, motywy, ustawienia, importy, kopie zapasowe.

### Tryb Conversation

Główny kod:

- Klient: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx` oraz obsługa szybkiego startu trybu Conversation w `ChatArea.tsx`.
- Hooki klienta: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Serwer: `/api/conversation`, `services/conversation/*`.
- Wspólne metadane: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart` oraz podsumowania dzienne i tygodniowe.

Oczekiwana granica:

- Tryb Conversation powinien odpowiadać za harmonogramy, autonomiczne zaczepki, aktywność w trybie Conversation i wyświetlanie wiadomości poza trybem Roleplay.
- Tryb Conversation nie powinien nic wiedzieć o kościach, tagach GM, zdarzeniach czasowych, mapach ani walce w grze.

### Tryb Roleplay

Główny kod:

- Klient: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, komponenty `RoleplayHUD`, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` i `EncounterModal.tsx`.
- Serwer: `/api/scene`, `/api/encounter`, `/api/sprites` oraz część `/api/generate`.
- Wspólne kontrakty: `scene`, pola metadanych czatu związane z trybem Roleplay i typy rozmieszczenia sprite'ów.

Oczekiwana granica:

- Tryb Roleplay powinien odpowiadać za sceny, wyświetlanie sprite'ów, wybory CYOA, pasek HUD trybu Roleplay i pomocnicze przepływy starć.
- Wspólne efekty wizualne, z których korzysta też tryb Game Mode, powinny wyprowadzić się z `components/chat`.

### Tryb Game Mode

Główny kod:

- Klient: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Serwer: `/api/game`, `/api/game-assets`, `services/game/*` oraz części plików `services/sidecar/scene-analyzer.ts` i `scene-postprocess.ts` dotyczące gry.
- Wspólne kontrakty: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts` oraz pola gry w `ChatMetadata`.

Oczekiwana granica:

- Tryb Game Mode powinien odpowiadać za prompty GM i drużyny, kości, testy umiejętności, zdarzenia czasowe oraz walkę. Należą do niego także mapy, podróż i odpoczynek, pogoda i czas, reputacja postaci NPC, podsumowania sesji gry, generowane zasoby gry i logi gry.
- Tryb Game Mode nie powinien zależeć od interfejsu czatu inaczej niż przez wspólne elementy podstawowe albo jawnie współdzielone komponenty funkcji.

## Obecne duże pliki

Te pliki najbardziej spowalniają dalszą pracę, bo mieszają wiele spraw w jednym miejscu. Liczba linii często się zmienia, więc lista podaje raczej kolejność i problem niż dokładny rozmiar.

| Plik | Sekcja | Problem |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | wspólne generowanie i agenci | Trasa, streaming, prompt, agenci, magazyn i efekty uboczne mieszkają w jednym pliku. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | Obsługa API, przepływ GM, analiza sceny, zasoby, walka i utrwalanie danych są ze sobą splecione. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | Renderowanie, orkiestracja stanu, zasoby, logi, narracja, walka i efekty są ze sobą splecione. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | mieszane ustawienia czatu | Wydzielanie sekcji trwa w `features/chat-settings`, ale panel boczny wciąż jest duży. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | Renderowanie widoku i formatowanie komend są ściśle powiązane. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | Widok walki, sterowanie i logi mogą się rozpaść na mniejsze panele i hooki. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | Podział częściowo wykonano przez `RoleplayHUDActionsMenu.tsx` i `RoleplayHUDPanels.tsx`. |

## Struktura docelowa

To kierunek przyszłych refaktoryzacji. Nie wymaga przeniesienia wszystkiego naraz.

### Cel po stronie klienta

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Cel po stronie serwera

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Cel dla pakietu shared

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

Dawny płaski układ `types`, `schemas` i `constants` to już nie cała historia. W `packages/shared/src/features/` mieszkają teraz agenci, wywołania funkcji, pakiety folderów, gry turowe, zestawy zasad z walką oraz generator świata. Pierwsze porządki w pakiecie shared nadal powinny dotyczyć typów i przebiegać stopniowo, bez masowego przenoszenia plików.

## Zasady migracji

1. Umieszczaj nowy kod w najwęższej pasującej sekcji.
2. Jeśli komponent klienta jest używany przez co najmniej dwa tryby, przenieś go do `CLIENT-SHARED`, zanim dojdzie kolejne zachowanie związane z jednym trybem.
3. Jeśli typ, schemat albo czysta funkcja pomocnicza są potrzebne i klientowi, i serwerowi, przenieś je do `CORE-CONTRACT`.
4. Jeśli potrzebuje tego wyłącznie serwer, trzymaj to poza `packages/shared`.
5. Pliki tras powinny sprawdzać dane wejściowe HTTP i wywoływać usługi. Decyzje dziedzinowe przenieś do usług.
6. Magazyny stanu mają być albo globalne (`ui`, `chat`, `sidecar`), albo związane z jednym trybem (`game-mode`, `encounter`). Unikaj sytuacji, w której jeden magazyn po cichu obsługuje kilka trybów.
7. Metadane powinny być rozróżniane przez `ChatMode`: metadane bazowe plus pola trybów Conversation, Roleplay i Game Mode.
8. Przenoś jedną funkcję naraz. Zostaw eksporty zgodnościowe albo opakowania, jeśli szeroko używana ścieżka importu wywołałaby inaczej lawinę zmian w repozytorium.
9. Po każdym przeniesieniu uruchom lint:

   ```bash
   pnpm lint
   ```

   Następnie uruchom celowaną kontrolę Prettier na zmienionych plikach.

## Pierwsi kandydaci do refaktoryzacji

To dobre pierwsze porządki, bo zmniejszają powiązania bez zmiany zachowania.

1. Podziel `components/chat` na grupy: wspólną, Conversation i Roleplay.
   - Kandydaci do części wspólnej: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects` oraz wspólne elementy wiadomości i pola wpisywania.
   - Kandydaci do trybu Conversation: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Kandydaci do trybu Roleplay: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. Podział paska HUD trybu Roleplay jest częściowo wykonany w `RoleplayHUDActionsMenu.tsx` i `RoleplayHUDPanels.tsx`.
2. Przenieś klienckie pomocniki tylko dla trybu Game Mode do modułu gry.
   - Kandydaci: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Podziel `GameSurface.tsx` na hooki czasu pracy aplikacji i mniejsze kontenery.
   - Kandydaci na hooki: narracja, zasoby, analiza sceny, walka, logi i historia, dźwięk.
4. Podziel `GameNarration.tsx` na parsowanie i formatowanie komend oraz komponenty wyświetlające.
5. Podziel `game.routes.ts` według grup obsługi.
   - Kandydaci na grupy: konfiguracja i sesja, generowanie tury, kości oraz testy umiejętności i zdarzenia czasowe, dziennik i ekwipunek, mapa oraz podróż i pogoda, walka, zasoby i analiza sceny.
6. Podziel `generate.routes.ts` na transport generowania, obsługę potoku agentów, trasy ponawiania oraz pomocniki komend i obróbki końcowej. Zgłoszenie #7573 to rozpoczęło: łańcuch wyjścia tokenów, rundy narzędzi, komendy w odpowiedzi, czyszczenie tekstu odpowiedzi, informacje o generowaniu zapisywane w wiadomości, ukryta kotwica komend i zapis odpowiedzi znajdują się teraz w `routes/generate/`, każde z własną regresją.
7. Podziel `ChatMetadata` na kontrakty metadanych osobne dla każdego trybu.
8. Wyprowadź wspólne wizualia trybów Roleplay i Game Mode z `components/chat`, zanim tryb Game Mode zaimportuje jeszcze więcej wnętrzności czatu.

## Praktyczny start

Przy kolejnym PR porządkowym trzymaj się tej kolejności:

1. Utwórz foldery docelowe tylko dla jednego obszaru.
2. Najpierw przenieś czyste funkcje pomocnicze.
3. Potem przenieś komponenty liściowe.
4. Duży plik orkiestrujący zostaw na miejscu, dopóki jego importy nie będą w większości wskazywać nowego modułu.
5. Dodawaj ponowne eksporty zgodnościowe tylko tam, gdzie lawina zmian w importach odciągałaby uwagę od właściwej zmiany.
6. Uruchom lint:

   ```bash
   pnpm lint
   ```

   Następnie uruchom celowane kontrole Prettier na zmienionych plikach.

## Powiązane przewodniki

- [Architektura frontendu (dla programistów)](frontend.md)
- [Przechowywanie danych w plikach](file-storage.md)
