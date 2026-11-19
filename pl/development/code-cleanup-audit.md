# Audyt porządkowania kodu

**Data audytu:** 2026-07-22

**Gałąź docelowa:** `staging`

**Cel:** wskazać artefakty do usunięcia oraz ograniczone uproszczenia, które nie zmieniają zachowania w czasie działania.

**Stan wdrożenia:** ustalenia pewne i obarczone małym ryzykiem zostały wdrożone w ramach tej samej zmiany porządkującej.

## Wynik wdrożenia

Zrobione:

- usunięte cztery nieosiągalne moduły źródłowe, przestarzały skrypt budujący sidecar, runner bez testów oraz zamknięte opisy zadań;
- usunięty bufor logów debugowania, który istniał wyłącznie na potrzeby nieosiągalnego panelu debugowania, z zachowaniem diagnostyki w konsoli przeglądarki;
- rozwiązane wszystkie 60 ustaleń o nieużywanym kodzie potwierdzonych przez kompilator oraz włączone kontrole nieużywanego kodu po stronie klienta i serwera;
- usunięte 53 nieużywane hooki, funkcje pomocnicze, typy i deklaracje interfejsu po stronie klienta, w partiach wydzielonych według domen;
- usunięte osiem pewnych osieroconych zależności, a przy okazji naprawiony plik blokady, kontrola instalacji przestrzeni roboczej i tekst w dokumencie rozwiązywania problemów;
- polecenie `pnpm test` w katalogu głównym uruchamia teraz prawdziwe testy regresyjne, zamiast zgłaszać sukces przy zerowej liczbie testów;
- ponownie wykorzystany istniejący selektor klatek kluczowych storyboardu i scalona zduplikowana logika tokenów zapytań Spotify;
- zmiana kolejności zmiennych presetu ograniczona do wskazanego presetu, przy czym ignorowany wcześniej `presetId` pełni rolę granicy spójności.

Świadomie zachowane do osobnych prac nad zgodnością lub produktem:

- `@rollup/wasm-node`;
- eksporty serwera, które mogą być API używanym poza repozytorium albo punktami zaczepienia dla testów;
- scalenie parsera PNG i geometrii samouczka;
- szerokie refaktoryzacje edytora/pola wiadomości oraz dużych modułów;
- pola zgodności zaplanowane na przyszłe wydanie główne.

Szczegółowe ustalenia poniżej zachowano jako zapis dowodów sprzed zmiany. Tam, gdzie zostało brzmienie rekomendacji, rozstrzygający jest opisany wyżej wynik wdrożenia.

## Weryfikacja

Wykonane porządki przeszły obsługiwane w repozytorium ścieżki dowodowe:

- `pnpm install --frozen-lockfile`
- `pnpm check` (egzekwowanie zakazu nieużywanego kodu, TypeScript, ESLint i kompilacje produkcyjne)
- `pnpm test` (wszystkie ścieżki regresyjne plus testy dymne w przeglądarce: 81 zdanych, 51 celowo pominiętych)

Zestaw testów przeglądarkowych ujawnił przy okazji cztery lokatory zależne od stanu, gdy ogólne polecenie testowe stało się uczciwe. Te testy nawigują teraz jawnie, zawężają zakres do zduplikowanych kontrolek mobilnych i trafiają we właściwy element przewijania osi czasu Noodle, bez osłabiania asercji produktowych.

## Podsumowanie dla kierownictwa

Repozytorium jest duże (1665 śledzonych plików i mniej więcej 478 000 linii w przejrzanych typach plików źródłowych), ale większość dużych plików to aktywny kod produktu, a nie oczywisty gruz. Najbezpieczniejsze porządki to zestaw małych, popartych dowodami usunięć, a nie szerokie przepisanie kodu.

Pierwsza ścieżka porządkowania w pierwotnym audycie wskazała:

- cztery moduły źródłowe bez żadnych odwołań przychodzących (łącznie 899 linii);
- jeden przestarzały skrypt budujący sidecar (173 linie);
- jeden runner testów, który kończy się sukcesem, choć nie wykonuje ani jednego testu (54 linie plus wpisy w skryptach pakietu);
- dwa opisy zakończonych zadań etapowych pozostawione w katalogu głównym repozytorium (235 linii);
- 60 nieużywanych deklaracji, importów, parametrów i zmiennych lokalnych potwierdzonych przez kompilator;
- osiem prawdopodobnie osieroconych zależności bezpośrednich, do potwierdzenia kontrolą czystej instalacji i kompilacji;
- jeden prawdopodobnie nieużywany statyczny sprite Mari, po sprawdzeniu dymnym w przeglądarce.

Same cztery nieosiągalne moduły, nieaktualny skrypt, runner bez działania i opisy zadań to 1361 śledzonych linii. Proponowaną pracę i tak warto rozbić na małe PR-y porządkujące, żeby każde usunięcie miało wąski dowód i łatwe wycofanie.

## Jak przeprowadzono audyt

Audyt połączył kilka rodzajów dowodów:

1. Inwentaryzacja wszystkich śledzonych plików, typów plików, głównych obszarów źródeł i największych plików.
2. Analiza importów i eksportów na drzewie AST TypeScriptu, z importami względnymi i aliasami repozytorium włącznie.
3. Wyszukiwanie dokładnych symboli i nazw plików w śledzonych źródłach, skryptach, dokumentacji, manifestach i przepływach pracy.
4. Sondy kompilatora TypeScript z wymuszonymi `noUnusedLocals` i `noUnusedParameters` po stronie klienta i serwera.
5. Wyszukiwanie zależności bezpośrednich oraz punktowa analiza historii Git tam, gdzie zależność lub skrypt sprawiały wrażenie osieroconych po wcześniejszej refaktoryzacji.
6. Porównanie znormalizowanych okien duplikatów, a następnie ręczny przegląd najbardziej wymownych trafień.
7. Kontrola składni śledzonych plików JSON, Python i Bash.

Etykiety pewności użyte poniżej:

- **Wysoka:** kilka niezależnych kontroli zgadza się ze sobą, usunięcie powinno być mechaniczne.
- **Średnia:** obecnie bez odwołań, ale znaczenie mogą mieć jeszcze ładowanie dynamiczne, konsumenci zewnętrzni albo zamysł produktowy.
- **Do odłożenia:** sensowna okazja do uproszczenia, której powierzchnia regresji jest zbyt szeroka jak na przebieg usuwający artefakty.

Analiza statyczna nie udowodni, że nie istnieje wyszukiwanie po tekście w czasie działania, użycie pobranego pakietu, ścieżki podane przez użytkownika ani konsumenci zewnętrzni. Takie przypadki są tu wskazane wprost, a nie traktowane jak martwy kod.

## 1. Pewne usunięcia plików

### 1.1 Nieosiągalne moduły źródłowe

| Kandydat | Dowody | Uwaga do porządkowania | Wymagany dowód |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 linii) | Brak importu przychodzącego, a `AgentDebugPanel` występuje tylko w miejscu deklaracji. | Usuń komponent. Potem przejrzyj `debugLog` i `clearDebugLog` w magazynie agentów: poza tym nieosiągalnym panelem nic ich nie używa. Nie usuwaj `lastResults`, z którego korzysta `SpriteOverlay`. | `pnpm check`; otwórz ustawienia agentów oraz tryb debugowania i sprawdź aktywne powierzchnie debugowania. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 linii) | Brak importu przychodzącego, a `AgentThoughtBubbles` występuje tylko w miejscu deklaracji. Obecny interfejs dymków myśli i listy kontrolnej rysują `RoleplayHUD` oraz `RoleplayHUDActionsMenu`. | Usuń komponent i jego nieaktualny wpis w `packages/client/.instructions.md`. | `pnpm check`; `pnpm regression:roleplay`; sprawdź w przeglądarce pasek HUD trybu Roleplay i listę kontrolną ciągłości. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 linii) | Brak importu przychodzącego, rejestracji trasy i odwołania po dokładnej nazwie. | Usuń wyłącznie ten panel. **Nie** wyciągaj z tego wniosku, że cała funkcja galerii jest martwa: `NoodleHome`, hooki galerii, trasy serwera i magazyn danych wciąż mają aktywne odwołania. | `pnpm check`; `pnpm smoke:ui`; sprawdź ręcznie wgrywanie obrazów i działanie galerii w zakładce Noodle. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 linie) | Brak importów, brak eksportu zbiorczego, a wszystkie cztery eksportowane symbole występują tylko w tym pliku. | Skasuj plik. | `pnpm check`; `pnpm regression`. |

### 1.2 Przestarzały skrypt budujący sidecar

Do `scripts/build-sidecar-runtime.mjs` nie odwołuje się żaden skrypt pakietu, przepływ pracy, dokument ani plik źródłowy. Skrypt wywołuje `pnpm exec node-llama-cpp`, ale `node-llama-cpp` nie jest już zależnością przestrzeni roboczej. Historia Git wiąże go z dawną ścieżką budowania sidecara dla lokalnej Gemmy.

**Rekomendacja (wysoka pewność):** skasuj skrypt. Wcześniej przeszukaj jeszcze raz artefakty wydania poza repozytorium, na wypadek gdyby jakiś proces instalatora był konfigurowany zewnętrznie.

### 1.3 Opisy zakończonych wdrożeń w katalogu głównym

`MARI_PHASE2_TASK.md` i `MARI_PHASE3_TASK.md` to instrukcje wdrożeniowe pisane pod konkretne gałęzie, a opisane w nich prace są już w kodzie. Nic w repozytorium się do nich nie odwołuje i nie jest to trwała dokumentacja dla użytkowników ani współtwórców.

**Rekomendacja (wysoka pewność):** usuń je z drzewa roboczego. Ich historia zostaje dostępna w Git. Jeśli któreś uzasadnienie wciąż ma wartość, przenieś do właściwego dokumentu architektury samo uzasadnienie, a nie instrukcje zadaniowe.

### 1.4 Mylący runner bez testów

`packages/server/scripts/run-tests.mjs` celuje w trzy wzorce `.test.ts`, ale w żadnym z docelowych folderów nie ma pliku testowego. Zarówno `pnpm --filter @marinara-engine/server test`, jak i `pnpm test` w katalogu głównym kończą się sukcesem przy zerowej liczbie testów i zerowej liczbie zestawów. Wcześniejsze testy usunięto celowo, a zasady repozytorium zabraniają trzymania plików `.test.ts`.

To groźniejsze niż zwykły martwy kod, bo zielony wynik `pnpm test` sugeruje dziś pokrycie, którego nie ma.

**Rekomendacja (wysoka pewność):**

1. Usuń runner serwera i skrypt `test` w pakiecie serwera.
2. Zachowaj kontrolę układu instalatora Windows, ale w razie potrzeby nadaj jej uczciwą, osobną nazwę skryptu.
3. Zdefiniuj `test` w katalogu głównym na nowo, tak aby uruchamiał świadomie wybrany podzbiór testów regresyjnych i dymnych, albo usuń ogólny alias i opisz `pnpm check`, `pnpm regression:*` oraz `pnpm smoke:ui` jako faktyczne polecenia dowodowe.
4. Zadbaj o to, żeby CI nie mogło zgłosić "tests passed" wyłącznie na podstawie wywołania bez testów.

## 2. Porządkowanie zależności

Te zależności bezpośrednie nie mają obecnie żadnego importu, rejestracji, konfiguracji ani odwołania tekstowego w czasie działania poza manifestami i plikiem blokady, o ile nie zaznaczono inaczej.

| Przestrzeń robocza | Zależność | Pewność i dowody |
| --- | --- | --- |
| client | `class-variance-authority` | **Wysoka.** Brak użycia w źródłach i konfiguracji. Wcześniejsza historia porządkowania zależności też traktowała ją jako nieużywaną. |
| client | `autoprefixer` | **Wysoka, z dowodem z kompilacji.** Brak konfiguracji PostCSS i importu; klient korzysta z wtyczki Tailwind dla Vite. |
| server | `@earendil-works/pi-ai` | **Wysoka.** Środowisko uruchomieniowe asystentki Professor Mari zostało odsunięte od zależności Pi. Historia repozytorium wprost odnotowuje, że pakiet jest już nieimportowany i został zostawiony do późniejszych porządków. |
| server | `@fastify/websocket` | **Wysoka.** Brak rejestracji wtyczki, trasy websocket i importu. |
| server | `png-chunk-text` | **Wysoka.** Brak importu. Obecna obsługa metadanych PNG jest zaimplementowana bezpośrednio. |
| server | `png-chunks-encode` | **Wysoka.** Brak importu. |
| server | `png-chunks-extract` | **Wysoka.** Brak importu. |
| shared | `chess.js` | **Wysoka, z dowodem zgodności.** Brak importu w obecnych źródłach. Wbudowaną funkcję szachów wydzielono do pakietów opcjonalnych. Usunięcie wymaga też skasowania wpisu w `scripts/check-workspace-install.mjs` i poprawienia nieaktualnego tekstu o brakującym `chess.js` w dokumencie rozwiązywania problemów. |

Do `@rollup/wasm-node` po stronie klienta również nic się nie odwołuje, ale może to być zapasowa wersja Rollup dla konkretnych środowisk. Potraktuj to jako **średnią pewność**: przed usunięciem przejrzyj historię pakowania i CI oraz udowodnij, że kompilacje działają na obsługiwanych platformach.

Nie klasyfikuj jako nieużywanych takich zależności jak `workbox-window`, `pino-pretty`, `esbuild` w katalogu głównym, pakiety typów czy narzędzia dostępne tylko z wiersza poleceń, opierając się wyłącznie na tekście importów. Korzystają z nich moduły generowane, konfiguracja transportu oparta na tekście, skrypty budowania lub skrypty pakietów.

W PR z zależnościami zaktualizuj `pnpm-lock.yaml`, zainstaluj wszystko od czystego stanu zależności i uruchom pełną ścieżkę kompilacji oraz kontroli. Usunięcie pakietu z zapełnionego już drzewa `node_modules` to za mało jak na dowód.

## 3. Nieużywany kod potwierdzony przez kompilator

Wymuszenie kontroli nieużywanego kodu w TypeScripcie dało **57 diagnostyk serwera** i **3 diagnostyki klienta**. To mocniejszy dowód niż kandydaci znalezieni samym wyszukiwaniem tekstu. Większość to importy albo zmienne lokalne, które można usunąć mechanicznie; przy parametrach funkcji zwrotnych i parametrach metod publicznych trzeba najpierw sprawdzić sygnatury wywołań.

### 3.1 Klient

- `ChatSettingsDrawer.tsx`: nieużywany parametr filtra `subject`.
- `GameCombatUI.tsx`: nieużywany parametr `line` w funkcji mapującej.
- `hooks/use-encounter.ts`: nieużywany `_res`; poczekaj na żądanie bez przypisywania wyniku.

### 3.2 Serwer

- `db/file-backed-store.ts`: nieużywany `TABLES_REVERSE`; nieużywane pole instancji `loadedManifest` wraz z przypisaniem.
- Importy i zmienne lokalne tras: `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`) oraz `generate/dry-run-route.ts` (`lorebooksStore`).
- Nieużywane parametry funkcji zwrotnych tras: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts` i `youtube.routes.ts` (`reply`). Zmieniaj nazwę na `_reply` tylko wtedy, gdy trzeba zachować pozycję w sygnaturze Fastify.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext` i `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval` oraz lokalna zmienna `chatParams`.
- `generate/dry-run-route.ts`: martwa lokalna funkcja pomocnicza `wrapperMessages`.
- `services/agents/agent-executor.ts`: nieużywany parametr `agentType` w `sanitizeTextAgentResponse`; po jego usunięciu zaktualizuj wywołania wewnętrzne.
- `services/agents/agent-pipeline.ts`: nieużywany `AgentPhase`.
- `services/conversation/schedule.service.ts`: nieużywane `createLLMProvider` i `ConversationStatusOverride`.
- `services/game/perception.service.ts`: nieużywany `RPGAttributes`.
- `services/generation/conversation-react-command-runtime.ts`: nieużywany parametr `command` w funkcji pomocniczej.
- `services/import/st-bulk.importer.ts`: nieużywany `personasTable`.
- `services/lorebook/keyword-scanner.ts`: nieużywany, destrukturyzowany `currentMessageIndex`; przed usunięciem sprawdź kształt wewnętrznych opcji.
- `services/lorebook/prompt-injector.ts`: nieużywany `LorebookEntry`.
- `services/mari-db/mari-db.service.ts`: martwa funkcja pomocnicza `makeEmptyValidation`.
- `services/prompt/assembler.ts`: nieużywane `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder` i `chatHistoryEndIdx`.
- `services/sidecar/scene-analyzer.ts`: martwe funkcje pomocnicze `widgetUpdateHint` i `widgetStateSummary`.
- `services/sidecar/scene-postprocess.ts`: martwa funkcja pomocnicza `normalizeExpression`.
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt` jest przypisywane, ale nigdy odczytywane.
- `services/storage/noodle.storage.ts`: nieużywany `NoodlerStageProfile`.
- `services/storage/prompts.storage.ts`: nieużywany parametr `presetId` w `reorderVariables`; przed zmianą sygnatury sprawdź wywołania i zasady kolejności w magazynie danych.

Kiedy ta lista będzie czysta, włącz `noUnusedLocals` i `noUnusedParameters` w konfiguracjach TypeScriptu dla serwera i klienta. Dzięki temu audyt zamieni się z jednorazowego przeglądu w utrzymywaną regułę. Poprzedzanie znakiem `_` parametrów funkcji zwrotnych, które muszą zostać, jest lepsze niż ponowne wyłączenie reguły globalnie.

## 4. Eksporty wewnętrzne bez konsumenta w repozytorium

Deklaracje eksportowane są wyłączone ze zwykłych kontroli nieużywanych zmiennych lokalnych, więc drugi przebieg wyszukał nazwy, które występują tylko w miejscu deklaracji. Klient to aplikacja, a nie publiczna biblioteka, więc takie nazwy są dobrymi kandydatami do usunięcia. Kasuj je w partiach wydzielonych według domen i pozwól kompilatorowi wskazać powiązane prywatne funkcje pomocnicze oraz importy.

### 4.1 Hooki i funkcje pomocnicze klienta

- Hooki agentów: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Hooki postaci: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Hooki czatów i folderów: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Hooki trybu Game Mode: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Hooki wibracji: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Hooki lorebooków: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Pozostałe hooki: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- Deklaracje interfejsu: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS` i `SyncedSettings`.
- Funkcje pomocnicze bibliotek: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip` i `buildTTSMessageText`.

Nieużywany hook klienta **nie** dowodzi, że jego punkt końcowy na serwerze też jest nieużywany. Najpierw usuń hook; trasy sprawdzaj osobno, zestawiając je z interfejsem, pakietami możliwości i zgodnością API dla świata zewnętrznego.

### 4.2 Kandydaci po stronie serwera wymagający ostatecznej decyzji o API i punktach zaczepienia

Poniższe eksportowane deklaracje serwera również nie mają konsumenta w repozytorium. Większość wygląda na wewnętrzne, ale z eksportowanych punktów zaczepienia dla testów i funkcji pomocniczych mogą korzystać narzędzia spoza drzewa, więc pewność pozostaje średnia, dopóki opiekunowie nie potwierdzą, że nie są to obsługiwane API:

- środowisko uruchomieniowe i uwierzytelnianie podstawowe: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`;
- punkty zaczepienia dla testów: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`;
- funkcje pomocnicze generowania i promptów: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`;
- funkcje pomocnicze trybu Game Mode: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`;
- funkcje pomocnicze lorebooków: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`;
- narzędzia i typy: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

Nie stosuj testu "jedno wystąpienie w tekście" hurtowo do `packages/shared`: eksporty współdzielone to kontrakty zgodności dla klienta, serwera i pobieranych pakietów agentów, w tym dla konsumentów spoza tego repozytorium.

## 5. Kandydat wśród zasobów statycznych

Plik `packages/client/public/sprites/mari/Mari_point_down_left.png`, jedyny dołączony sprite Mari, do którego nazwy ani ścieżki nic w repozytorium się nie odwoływało, został usunięty w ramach zmiany omnibar slice 38a.

Nie przycinaj dołączonych zasobów trybu Game Mode na podstawie wyszukiwania po nazwach plików. Skrypty zasilające serwer i manifesty przeglądają część folderów z zasobami dynamicznie.

## 6. Ograniczone uproszczenia

To usprawnienia dla łatwiejszego utrzymania, a nie usuwanie martwego kodu. Każde powinno zachować zachowanie co do joty i mieć własny, celowany dowód regresyjny.

### 6.1 Zduplikowana logika biznesowa, dokładnie lub prawie dokładnie

1. **Wybór klatki kluczowej storyboardu – małe ryzyko.** `GameSurface.tsx` ma lokalną implementację `findStoryboardKeyframeForSegment`, zgodną z eksportowaną funkcją `findReplayStoryboardKeyframe` w `lib/game-session-replay.ts`. Wykorzystaj funkcję z biblioteki i usuń lokalną kopię.
2. **Normalizacja wyszukiwania w Spotify – małe lub średnie ryzyko.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS` oraz sam przebieg rozwijania zapytania są zduplikowane między `game-spotify-music.service.ts` a `tool-executor.ts`. Wydziel małą funkcję pomocniczą do tokenów zapytań Spotify, żeby obie ścieżki nie mogły się rozjechać.
3. **Wyciąganie metadanych karty postaci z PNG – średnie ryzyko.** `extractCharaFromPng` jest niezależnie zaimplementowane w `import.routes.ts` i `st-bulk.importer.ts`. Wydziel jedno narzędzie serwera i udowodnij na danych regresyjnych obsługę zwykłych bloków tekstowych, międzynarodowych bloków tekstowych, danych base64 i surowych, kart V2 i V3 oraz uszkodzonych plików PNG.
4. **Geometria podpowiedzi samouczka – średnie ryzyko.** `GameTutorial.tsx` i `OnboardingTutorial.tsx` powielają logikę kolizji i rozmieszczania. Wydziel wyłącznie wspólne obliczenia geometrii; zasady mobilne i produktowe każdego samouczka zostaw jako jawne opcje.
5. **Normalizacja edycji segmentu gry po stronie klienta i serwera – średnie lub duże ryzyko.** Czysta normalizacja po obu stronach jest podobna. Do części współdzielonej przenoś tylko taki schemat lub normalizator, który naprawdę nie zależy od środowiska uruchomieniowego; parsowanie i zapis danych zostaw na serwerze.

### 6.2 Duże powtarzające się obszary interfejsu: odłóż szerokie scalanie

- `CharacterEditor.tsx` i `PersonaEditor.tsx` zawierają obszerny, powtórzony przebieg zarządzania sprite'ami.
- `ChatInput.tsx` i `ConversationInput.tsx` powielają zachowanie planu prowadzonego i pola wiadomości.

Scalanie ma tu realną wartość, ale zlanie którejkolwiek pary w całości dałoby ogromną powierzchnię regresji. Wydzielaj po jednym spójnym hooku lub komponencie naraz – dla edytorów najpierw zarządzanie sprite'ami, dla pól wiadomości najpierw plan prowadzony – i po każdym wydzieleniu testuj w przeglądarce oba miejsca użycia.

### 6.3 Aktywne ogniska złożoności

Największe aktywne moduły to `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts` i `client/components/panels/SettingsPanel.tsx`. Nie są kandydatami do usunięcia. Wydzielaj z nich ograniczone obsługi tras, usługi domenowe, sekcje panelu bocznego i czyste funkcje pomocnicze tylko wtedy, gdy dana funkcja i tak jest właśnie zmieniana. Osobny PR w stylu "podzielmy wszystko" wprowadziłby zamieszanie bez wiarygodnego dowodu zachowania. Panel ustawień czatu był wyjątkiem: został podzielony po jednej sekcji na PR (#9119), a reguły dotyczące jego folderu opisuje sekcja Chat Settings w pliku `packages/client/.instructions.md`.

## 7. Elementy świadomie wyłączone z porządkowania

- Pola zgodności wyraźnie oznaczone jako akceptowane w całej linii 2.x, w tym kształty zgodności stylu obrazów, stanu gry, TTS, trackera persony i kontekstu rozmowy w trybie Conversation. Usuwaj je wyłącznie przez migrację wersjonowaną w kolejnym wydaniu głównym.
- Generowane rejestry i manifesty możliwości. Generuj je ponownie ich własnymi skryptami; nie przycinaj ręcznie.
- Kod pobieranych pakietów agentów Illustrator, Music DJ, Lorebook Keeper i pozostałych. Porządkowanie środowiska uruchomieniowego i promptów należących do agentów odbywa się w `Pasta-Devs/Marinara-Agents`; tutaj mieści się tylko integracja z aplikacją.
- Moduły Home Assistant w `custom_components`, których wykrywanie opiera się na konwencji i manifeście.
- `MarinaraLauncher.exe`, z którego korzysta kod migrujący skróty na pasku zadań.
- `start-local.bat`, do którego nie odwołują się skrypty pakietów, ale który pozostaje wiarygodnym narzędziem do lokalnego uruchamiania przez człowieka. Usuń dopiero po sprawdzeniu intencji u opiekuna.
- Deklaracje schematów, które wyglądają na pozbawione odwołań, ale wykonują się przy inicjalizacji modułu albo rejestracji tabeli.
- Trasy serwera tylko dlatego, że wygodny hook React jest nieużywany; pobierane pakiety lub konsumenci API wciąż mogą je wywoływać.

## 8. Zalecana kolejność porządkowania

Praca ma zostać prosta i możliwa do przejrzenia:

1. **PR A – artefakty:** usuń cztery nieosiągalne moduły, nieaktualny wpis w dokumentacji komponentu, przestarzały skrypt sidecara, opisy zakończonych zadań oraz – po ręcznym potwierdzeniu – nieużywany sprite Mari.
2. **PR B – uczciwa powierzchnia testów:** usuń runner bez testów i zmień nazwy oraz definicje skryptów pakietu tak, żeby polecenia kończące się sukcesem oznaczały prawdziwe kontrole.
3. **PR C – porządki po kompilatorze:** rozwiąż 60 diagnostyk TypeScriptu, a potem włącz kontrole nieużywanego kodu w konfiguracjach klienta i serwera.
4. **PR D – zależności:** usuń osiem pewnych pakietów, napraw kontrolę instalacji przestrzeni roboczej i tekst w dokumencie rozwiązywania problemów, wygeneruj plik blokady od nowa i udowodnij czystą instalację oraz kompilację.
5. **PR E i kolejne – partie domenowe:** usuwaj nieużywane eksporty klienta domena po domenie, a potem bierz po kolei mało ryzykowne duplikaty funkcji pomocniczych.

Nie łącz usuwania zależności, szerokiej refaktoryzacji interfejsu i rozbijania tras w jednym PR porządkującym.

## 9. Macierz weryfikacji

Do każdej zmiany uruchom właściwy dla niej dowód:

- Każde porządkowanie kodu: `pnpm check`.
- Zmiany współdzielone lub szerokie zmiany serwera: najpierw `pnpm regression` albo wąskie polecenie `pnpm regression:<domain>`, a przed scaleniem pełna ścieżka.
- Porządkowanie komponentów i hooków interfejsu: `pnpm smoke:ui` oraz ręczne sprawdzenie w przeglądarce zmienionego przebiegu.
- Ścieżki promptów, agentów lub trybu Roleplay: `pnpm regression:prompt` i/lub `pnpm regression:roleplay`.
- Porządkowanie zależności: czysta instalacja z zamrożonym plikiem blokady, `pnpm check`, kompilacje produkcyjne i CI na obsługiwanych platformach.
- Scalenie importu PNG: bezpośrednie testy regresyjne importu obejmujące poprawne i uszkodzone karty postaci.
- Pliki wydania i wersji, jeśli zostały niespodziewanie ruszone: `pnpm version:check` i `pnpm credits:check`.

Przed tymi porządkami wyniku ogólnego `pnpm test` nie dało się przywołać jako dowodu z testów, bo polecenie kończyło się sukcesem, nie uruchamiając żadnego testu.

## 10. Weryfikacja audytu i jego ograniczenia

W trakcie audytu:

- wszystkie śledzone pliki JSON zostały poprawnie sparsowane;
- wszystkie 12 śledzonych plików Python zostało poprawnie sparsowanych parserem AST Pythona;
- `start.sh`, `start-termux.sh` i `android/build-apk.sh` przeszły `bash -n`;
- sondy nieużywanego kodu w TypeScripcie dały 57 ustaleń serwera i 3 ustalenia klienta opisane wyżej;
- bezpośrednio zaobserwowano, że polecenia testowe serwera i katalogu głównego kończą się sukcesem przy zerowej liczbie testów.

ShellCheck i PowerShell nie były zainstalowane, więc nie wykonano semantycznej analizy skryptów powłoki ani parsowania skryptów PowerShell i Windows. Cele Android oraz Home Assistant przejrzano pod kątem struktury, ale w tym audycie nie zbudowano ich w całości. Te kontrole platformowe należą do PR-ów porządkujących, które dotykają ich plików.
