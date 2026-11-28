# Architektura frontendu (dla programistów)

To materiał dla programistów, a nie przewodnik dla użytkowników. Wyjaśnia, jak zbudowany jest klient aplikacji Marinara Engine. Opisuje strukturę aplikacji React, magazyny Zustand, hooki React Query, najważniejsze komponenty oraz mapę API serwera. Do samego korzystania z aplikacji lepiej nadają się przewodniki użytkownika.

## Przegląd

Marinara Engine to aplikacja do czatu z AI z trybami Conversation, Roleplay i Game Mode. Klient to jednostronicowa aplikacja React 19 serwowana przez Vite, ostylowana w Tailwind CSS v4 i spakowana jako aplikacja progresywna (PWA).

Kod klienta znajduje się w `packages/client`. Komunikuje się z serwerem API opartym na Fastify (`packages/server`) przez REST i Server-Sent Events (SSE). Wspólne kontrakty danych (typy, schematy Zod, stałe) leżą w `packages/shared` i importują je obie strony.

## Architektura aplikacji

### Układ powłoki aplikacji

`components/layout/AppShell.tsx` rozmieszcza górny pasek, środkową kolumnę i jeden pasek boczny. Pasek boczny pokazuje Czaty albo jeden panel, nigdy oba naraz. Domyślnie jest zadokowany po prawej, a gdy `sidebarSide` ma wartość `"left"`, po lewej:

```
+-----------------------------------+----------------+
|  Center                           |  Sidebar       |
|                                   |                |
|  Chat area or Editor              |  Chats         |
|  (lazy-loaded)                    |  (chat list,   |
|                                   |  folders,      |
|  ChatConversationSurface          |  mode tabs)    |
|  ChatRoleplaySurface              |                |
|  GameSurface                      |  or a panel:   |
|  CharacterEditor                  |  Characters    |
|  LorebookEditor                   |  Personas      |
|  PresetEditor                     |  Lorebooks     |
|  ...other editors                 |  Presets, ...  |
+-----------------------------------+----------------+
```

- Pasek boczny (`[data-component="SidebarSlot"]` w `AppShell.tsx`): jedno miejsce na komputerze. W jego przesuwanym kontenerze (`SidebarSlotPanel`) znajdują się dwie warstwy ułożone jedna na drugiej. `ChatSidebarPanel` renderuje `components/layout/ChatSidebar.tsx`, czyli listę czatów z folderami i zakładkami trybów (Conversation, Roleplay, Game). Na komputerze jest zawsze zamontowany, ponieważ to z niego ładują się liczby nieprzeczytanych wiadomości i dymki powiadomień. `RightPanelDesktop` renderuje `components/layout/RightPanel.tsx` i montuje się przy pierwszym otwarciu panelu. Ukryta warstwa ma `invisible`, `inert` i `aria-hidden`. Przełączanie między widokiem Czaty a panelem jest natychmiastowe, a otwieraniu i zamykaniu paska bocznego towarzyszy przesuwanie.
- Szerokość: jeden separator na wewnętrznej krawędzi paska bocznego (aria-label "Resize sidebar") ustawia wspólną szerokość, od `SHARED_SIDEBAR_WIDTH_MIN` (280) do `SHARED_SIDEBAR_WIDTH_MAX` (480). Odczytuj ją przez `selectSharedSidebarWidth`; magazyn utrzymuje równe wartości `sidebarWidth` i `rightPanelWidth`.
- Strona: przy `sidebarSide: "left"` miejsce na pasek dostaje CSS `order: -1`. Zachowuje pozycję w drzewie React, więc zmiana strony nigdy nie montuje panelu ponownie. `--mari-chat-ui-inset-left` / `--mari-chat-ui-inset-right`, przesunięcie zadokowanego panelu trackerów i odstępy niemodalnego `Modal` dostosowują się do strony.
- Telefony i tablety: gdy `isMobileShellViewport()` zwraca prawdę (`MOBILE_SHELL_MEDIA_QUERY` albo okno zbyt wąskie na układ z zadokowanym paskiem), pasek boczny jest pełnoekranowym panelem wysuwanym z prawej, renderowanym jako `ChatSidebarPanel` lub `RightPanelMobile`. `sidebarSide` nie ma tam zastosowania.
- Środkowa kolumna: albo aktywna powierzchnia czatu, albo pełnoekranowy edytor (postaci, lorebooka, presetu i tak dalej). Zawsze widać tylko jedno. Edytory zastępują obszar czatu.
- Panele (`components/layout/RightPanel.tsx`): kieruje `rightPanel` do komponentu panelu i utrzymuje odwiedzone panele zamontowane. Zobacz [System paneli](#panel-system-componentspanels).
- Górny pasek (`components/layout/TopBar.tsx`): Strona główna i informacje o czacie po jednej stronie. Po stronie paska bocznego `[data-tour="panel-buttons"]` zawiera najpierw przycisk Czaty (`[data-tour="sidebar-toggle"]`), a następnie po jednym przycisku dla każdego panelu. Przy `sidebarSide: "left"` pasek odwraca układ (`flex-row-reverse`): przyciski paneli są po lewej, a Strona główna na skraju po prawej. Na telefonach i tabletach Czaty pozostają obok przycisku Strona główna, a na telefonach Czaty i przyciski paneli trafiają do menu **Więcej**.

### Nawigacja

Nawigacja opiera się na stanie. Nie ma routera adresów URL. O tym, co się renderuje, decyduje magazyn Zustand `stores/ui.store.ts`:

| Cel nawigacji          | Pole magazynu        | Funkcja wyzwalająca                               |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Otwarcie edytora postaci  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Otwarcie edytora lorebooka   | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Otwarcie edytora presetu     | `presetDetailId`     | `openPresetDetail(id)`                             |
| Otwarcie edytora połączenia | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Otwarcie edytora agenta      | `agentDetailId`      | `openAgentDetail(id)`                              |
| Otwarcie edytora persony    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Wyświetlenie panelu | `rightPanel` | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Wyświetlenie widoku Czaty | `sidebarOpen` | `toggleSidebar()` / `setSidebarOpen(open)` |
| Otwarcie okna modalnego              | `modal`              | `openModal(type, props?)`                          |

Czaty i panele współdzielą pasek boczny, więc wykluczają się przy każdym rozmiarze ekranu. `openRightPanel` i `toggleRightPanel` zamykają Czaty, a `toggleSidebar` i `setSidebarOpen(true)` zamykają panel. `setSidebarOpen(false)` pozostawia otwarty panel bez zmian. `selectSidebarShown` ma wartość false, gdy panel jest otwarty, więc nieaktualna para z obiema flagami ustawionymi na true wyświetla panel, a utrwalany stan przekształca taką zapisaną parę w sam panel.

### Dzielenie kodu

Największe edytory i ciężkie komponenty ładują się leniwie w `AppShell.tsx` przez `React.lazy()` i `Suspense`. Dzięki temu początkowa paczka zostaje mała (zobacz budżet paczki poniżej).

## Zarządzanie stanem

### Magazyny Zustand (stan klienta)

Do stanu interfejsu i stanu czasu wykonania klient używa zestawu magazynów Zustand w `packages/client/src/stores/`. `ui.store.ts` jako jedyny zapisuje się trwale. Pozostałe trzymają stan czasu wykonania dla czatów, agentów, gier, lokalnego środowiska modelu, tłumaczenia, okien dialogowych oraz uzupełniania wstecznego.

Obecne pliki magazynów to: `agent.store.ts`, `backfill.store.ts`, `chat-tools-menu.store.ts`, `chat.store.ts`, `combat-screen.store.ts`, `conversation-games.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `floating-window.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `roleplay-sheet.store.ts`, `sidecar.store.ts`, `translation.store.ts` oraz `ui.store.ts`. Magazyny gier stołowych przeniesiono do ich pakietów do pobrania; `conversation-games.store.ts` śledzi tylko wybór gry w trybie Conversation i jej konfigurację. `combat-screen.store.ts` śledzi widoczny ekran walki i jego rundę, aby górny pasek pokazywał przyciski walki tylko na tym ekranie. `roleplay-sheet.store.ts` śledzi, czyj arkusz zestawu zasad jest otwarty w czacie Roleplay.

#### `ui.store.ts`: ustawienia i oprawa interfejsu

Jedyny magazyn zapisywany trwale (localStorage przez oprogramowanie pośredniczące `persist` z Zustand). Trzyma:

- Motyw: `visualTheme` ("default" albo "sillytavern"), wartość `data-theme` (dark lub light) oraz własne nadpisania kolorów.
- Wygląd: `fontSize`, `chatFontSize`, `fontFamily`, własne czcionki i styl kursora.
- Wyświetlanie czatu: `boldDialogue`, `showTimestamps`, `showModelName` oraz `messagesPerPage`.
- Stylowanie tekstu: kolor tekstu czatu, krycie tła wiadomości w trybie Roleplay i obrys tekstu.
- Streaming: `enableStreaming` i `streamingSpeed`.
- Motyw trybu Conversation: kolory gradientu dla dymków wiadomości.
- Dźwięk: `convoNotificationSound` i `rpNotificationSound`.
- Zachowanie: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` oraz `guideGenerations`.
- Nawigacja: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, wszystkie pola `*DetailId` oraz `modal`.
- Układ paska bocznego: `sidebarSide` (`"right"` albo `"left"`, domyślnie `"right"`, synchronizowane między urządzeniami i przywracane do `"right"` przez `resetAppearanceSettings`) oraz `sidebarWidth` / `rightPanelWidth` (utrzymywane jako równe; odczytuj je przez `selectSharedSidebarWidth`).

Zsynchronizowanych własnych motywów `ui.store.ts` nie przechowuje. Pobiera je z serwera React Query, a potem trafiają na wszystkie urządzenia podłączone do tego samego serwera Marinara Engine.

#### `chat.store.ts`: czas wykonania czatu

Nie zapisuje się trwale. Śledzi aktywną sesję czatu:

- `activeChatId`: który czat jest wyświetlany.
- `messages`: bieżąca tablica wiadomości.
- `isStreaming`, `streamBuffer`: trwające generowanie.
- `inputDrafts`: wersje robocze wiadomości dla każdego czatu.
- `currentInput`: bieżąca zawartość pola wpisywania.
- `perChatTyping`: stan wskaźnika pisania.
- `unreadCounts`, `chatNotifications`: plakietki powiadomień.
- `abortControllers`: anulowanie trwających generowań.

#### `agent.store.ts`: wykonywanie agentów

Śledzi stan pipeline'u agentów w trakcie generowania i po nim:

- `activeAgents`: agenci właśnie działający.
- `thoughtBubbles`: rozumowanie agenta pokazywane na żywo.
- `echoMessages`: echo chamber (symulowany czat widowni).
- `cyoaChoices`: interfejs rozgałęziających się wyborów.
- `debugLog`: metryki wydajności i zużycie tokenów.
- `failedAgentTypes`: agenci, którzy zgłosili błąd (na potrzeby interfejsu ponawiania).

#### `game-state.store.ts`: towarzysz RPG

Trzyma kontekst sceny i świata dla trybu Roleplay:

- `current` (GameState): data, godzina, miejsce, pogoda, obecne postacie, wydarzenia, statystyki gracza, zadania i ekwipunek.
- `isVisible`, `expandedSections`: stan wyświetlania paska HUD.

#### `encounter.store.ts`: system walki

Stan walki turowej:

- `active`: czy starcie właśnie trwa.
- `party`, `enemies`: walczący wraz z HP, atakami i statusami.
- `environment`: szczegóły areny.
- `playerActions`, `encounterLog`: kolejka akcji i historia.
- `combatResult`: zwycięstwo, porażka, ucieczka albo przerwanie.

#### `gallery.store.ts`: nakładki z obrazami

- `pinnedImages`: obrazy przypięte do obszaru czatu jako nakładki.

### React Query (dane z serwera)

Wszystkie dane z serwera pobiera i cachuje TanStack React Query, skonfigurowany w `lib/query-client.ts`:

- Czas ważności danych: 30 sekund (globalna wartość domyślna).
- Ponowienie: 1 próba.
- Ponowne pobranie przy powrocie do okna: wyłączone.
- Cache: tylko w pamięci, bez trwałego zapisu.

Każda encja ma własny plik z hookami, który eksportuje hooki zapytań i mutacji.

## Przegląd hooków

Wszystkie hooki leżą w `src/hooks/` i trzymają się wzorca `use-{entity}.ts`. Tabele niżej opisują tylko najważniejsze hooki. Pełny zestaw znajduje się w `packages/client/src/hooks/`.

### Hooki czatu (`use-chats.ts`)

| Hook                               | Typ            | Opis                                         |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Wszystkie czaty                              |
| `useChat(id)`                      | Query          | Pojedynczy czat po ID                        |
| `useChatMessages(chatId, perPage)` | Infinite Query | Stronicowane wiadomości czatu                |
| `useChatGroup(groupId)`            | Query          | Grupa czatów                                 |
| `useCreateChat()`                  | Mutation       | Utworzenie nowego czatu                      |
| `useDeleteChat()`                  | Mutation       | Usunięcie czatu                              |
| `useUpdateChatMetadata()`          | Mutation       | Aktualizacja metadanych czatu (agenci, sprite'y i inne) |
| `useBranchChat()`                  | Mutation       | Utworzenie gałęzi czatu od wybranej wiadomości |
| `useUpdateMessage()`               | Mutation       | Edycja treści wiadomości (aktualizacja optymistyczna) |
| `useDeleteMessage()`               | Mutation       | Usunięcie pojedynczej wiadomości             |
| `useDeleteMessages()`              | Mutation       | Usunięcie wielu wiadomości                   |
| `useSetActiveSwipe()`              | Mutation       | Przełączenie na inny swipe generowania       |
| `usePeekPrompt()`                  | Mutation       | Podgląd złożonego promptu                    |
| `useClearAllData()`                | Mutation       | Usunięcie wszystkiego (nieodwracalne)        |

### Hooki postaci (`use-characters.ts`)

| Hook                   | Typ      | Opis                                   |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Wszystkie postacie                     |
| `useCharacter(id)`     | Query    | Pojedyncza postać z rozpakowaną kartą postaci |
| `useCreateCharacter()` | Mutation | Utworzenie postaci                     |
| `useUpdateCharacter()` | Mutation | Aktualizacja danych karty postaci      |
| `useDeleteCharacter()` | Mutation | Usunięcie postaci                      |
| `useUploadAvatar()`    | Mutation | Wgranie obrazu awatara                 |
| `usePersonas()`        | Query    | Wszystkie persony                      |
| `usePersona(id)`       | Query    | Pojedyncza persona                     |
| `useCreatePersona()`   | Mutation | Utworzenie persony                     |
| `useUpdatePersona()`   | Mutation | Aktualizacja persony                   |
| `useDeletePersona()`   | Mutation | Usunięcie persony                      |
| `useCharacterGroups()` | Query    | Grupy postaci                          |
| `usePersonaGroups()`   | Query    | Grupy person                           |

### Hooki presetów (`use-presets.ts`)

| Hook                           | Typ      | Opis                                                        |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Wszystkie presety                                          |
| `usePresetFull(id)` | Query | Preset z sekcjami, grupami i zmiennymi |
| `useDefaultPreset()`           | Query    | Preset domyślny                                            |
| `useUpdatePreset()`            | Mutation | Aktualizacja presetu                                       |
| `useDeletePreset()`            | Mutation | Usunięcie presetu                                          |
| `useDuplicatePreset()` | Mutation | Duplikowanie presetu |
| `useSetDefaultPreset()` | Mutation | Ustawienie presetu jako domyślnego |
| `useCreateSection()` | Mutation | Tworzenie sekcji promptu (obok są hooki aktualizacji, usuwania i zmiany kolejności) |
| `useCreateGroup()` | Mutation | Tworzenie grupy sekcji (obok są hooki aktualizacji i usuwania) |
| `useCreateVariable()` | Mutation | Tworzenie zmiennej presetu, dawniej bloku wyboru (obok są hooki aktualizacji, usuwania i zmiany kolejności) |

### Hooki agentów (`use-agents.ts`)

| Hook                 | Typ      | Opis                            |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Wszystkie konfiguracje agentów  |
| `useCreateAgent()`   | Mutation | Utworzenie własnego agenta      |
| `useUpdateAgent()`   | Mutation | Aktualizacja konfiguracji agenta |
| `useDeleteAgent()`   | Mutation | Usunięcie agenta                |
| `useUpdateAgentByType()` | Mutation | Aktualizacja konfiguracji agenta według jego typu |

### Hook generowania (`use-generate.ts`)

Najbardziej złożony hook. Zwraca `{ generate, retryAgents }`.

`generate(params)` przyjmuje jeden obiekt opcji z polami takimi jak `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` i `attachments`. Zwraca `false`, jeśli dla danego czatu trwa już generowanie. Przebieg wygląda tak:

1. Ustawienie stanu streamingu w `chat.store.ts`.
2. Wysłanie żądania generowania do `/api/generate`.
3. Przetworzenie zdarzeń SSE takich jak `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` i `error`.
4. Aktualizacja cache'u React Query o nowe wiadomości.
5. Zapełnienie magazynu agentów rozumowaniem agenta i informacjami diagnostycznymi.
6. Obsługa błędów przez powiadomienia typu toast.

### Pozostałe hooki

Folder `src/hooks/` zawiera też wiele hooków związanych z konkretnymi funkcjami. Reprezentatywna próbka:

| Plik                           | Przeznaczenie                             |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | CRUD połączeń API oraz test               |
| `use-lorebooks.ts`             | CRUD lorebooków i wpisów                   |
| `use-scene.ts`                 | Planowanie, tworzenie i kończenie sceny    |
| `use-encounter.ts`             | Inicjalizacja starcia, akcja, podsumowanie |
| `use-autonomous-messaging.ts`  | Odpytywanie i harmonogram wiadomości autonomicznych |
| `use-idle-detection.ts`        | Wykrywanie 10 minut bezczynności           |
| `use-background-autonomous.ts` | Odpytywanie w tle dla nieaktywnych czatów  |
| `use-translate.ts`             | Tłumaczenie tekstu                        |
| `use-apply-regex.ts`           | Wykonywanie skryptów regex na wiadomościach |
| `use-custom-tools.ts` | CRUD własnych narzędzi, zmiana kolejności i zbiorcze przełączanie |
| `use-knowledge-sources.ts`     | Zarządzanie źródłami wiedzy                |
| `use-gallery.ts`               | Obrazy w galerii czatu                     |
| `use-chat-folders.ts`          | CRUD folderów czatów oraz zmiana kolejności |
| `use-regex-scripts.ts` | CRUD skryptów regex, zmiana kolejności i zbiorcze przełączanie |
| `use-haptic.ts`                | Połączenie z urządzeniem haptycznym i komendy |

## Przewodnik po komponentach

### System czatu (`components/chat/`)

System czatu to największy obszar funkcjonalny. `ChatArea.tsx` ładuje leniwie trzy powierzchnie renderowania: Conversation, Roleplay i Game Mode.

#### Tryb Conversation (`ChatConversationSurface.tsx`)

Dymki czatu jak w komunikatorze. Wiadomości użytkownika po prawej, asystenta po lewej. Możliwości:

- Nieskończone przewijanie ze stronicowaniem (starsze wiadomości dogrywają się przy przewijaniu w górę).
- Akcje przy każdej wiadomości: edycja, kopiowanie, ponowne wygenerowanie, usunięcie, utworzenie gałęzi, podgląd promptu.
- Obsługa załączników (obrazy i pliki).
- Wybieraki emoji i GIF-ów.
- Komendy slash.
- Dźwięki powiadomień przy nowych wiadomościach.
- Zapamiętywanie wersji roboczej osobno dla każdego czatu.

#### Tryb Roleplay (`ChatRoleplaySurface.tsx`)

Ciemny, wciągający interfejs w klimacie RPG. Ma wszystko to, co tryb Conversation, a do tego:

- Sprite'y postaci ze zmianą wyrazu twarzy sterowaną przez agenta wyrazu twarzy.
- Pasek HUD trybu Roleplay pokazujący stan świata (czas, miejsce, pogoda, obecne postacie).
- Efekty pogodowe (nakładki cząsteczkowe dopasowane do pogody w scenie).
- Panel echo chamber (symulowane reakcje widowni).
- Starcia z systemem akcji turowych.
- Panel World Info z aktywnymi wpisami lorebooków.
- System scen do rozgałęziających się mini-scenariuszy.
- Obrazy tła z przenikaniem przy zmianie.

#### Game Mode (`GameSurface.tsx`)

Powierzchnia trybu z Game Master sterowanym przez AI. Leży poza folderem czatu, w `components/game/GameSurface.tsx`. `ChatArea.tsx` renderuje ją, gdy tryb czatu to `game`. Odczytuje dedykowane magazyny gry (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`). Steruje sesjami, rzutami kością, testami umiejętności, mapami i storyboardami tur przez hooki z `use-game.ts` i `use-game-storyboards.ts`.

#### Kluczowe komponenty

- `ChatArea.tsx`: centralny dyrygent. Pobiera wszystkie dane (wiadomości, postacie, persony), buduje mapę postaci, ustala tryb czatu i renderuje właściwą powierzchnię.
- `ChatMessage.tsx`: renderuje pojedynczą wiadomość razem z Markdown, nawigacją po swipe'ach, edycją i menu akcji. Korzysta z niekontrolowanego podkomponentu `EditTextarea`, żeby uniknąć ponownego renderowania w trakcie edycji.
- `ChatInput.tsx`: pole wpisywania z automatyczną zmianą wysokości, zapamiętywaniem wersji roboczej, uzupełnianiem komend slash, obsługą załączników oraz wstawianiem emoji i GIF-ów.

### Komponenty edytorów

Każdy typ zasobu ma pełnoekranowy edytor, który zastępuje obszar czatu:

| Edytor            | Plik                                          | Czym zarządza                                                                   |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Edytor postaci  | `components/characters/CharacterEditor.tsx`   | Pola karty postaci, awatar, powitanie, osobowość, prompt systemowy, metadane   |
| Edytor lorebooków   | `components/lorebooks/LorebookEditor.tsx`     | Metadane lorebooka oraz wpisy z kluczami, regułami aktywacji i ustawieniami wstawiania   |
| Edytor presetów     | `components/presets/PresetEditor.tsx`         | Sekcje promptu, grupy, znaczniki, parametry generowania, bloki wyborów          |
| Edytor połączeń | `components/connections/ConnectionEditor.tsx` | Dostawca API, bazowy adres URL, model, okno kontekstu, flagi                            |
| Edytor agentów      | `components/agents/AgentEditor.tsx`           | Szablon promptu agenta, faza, połączenie, narzędzia, ustawienia                       |
| Edytor person    | `components/personas/PersonaEditor.tsx`       | Persona użytkownika z nazwą, opisem, statystykami i awatarem                              |

### System okien modalnych (`components/modals/`)

Okna modalne renderuje `components/layout/ModalRenderer.tsx`. Odczytuje `ui.store.modal` i renderuje pasujący komponent wewnątrz `Suspense`. Same komponenty okien leżą w `components/modals/`.

Obecne typy okien modalnych obejmują (lista jest poglądowa, nie wyczerpująca):

| Typ                        | Komponent                     | Przeznaczenie                              |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Szybkie tworzenie postaci (nazwa i awatar) |
| `create-connection`        | `CreateConnectionModal`       | Szybkie tworzenie połączenia               |
| `create-persona`           | `CreatePersonaModal`          | Szybkie tworzenie persony                  |
| `create-lorebook`          | `CreateLorebookModal`         | Szybkie tworzenie lorebooka                |
| `create-preset`            | `CreatePresetModal`           | Szybkie tworzenie presetu                  |
| `import-character`         | `ImportCharacterModal`        | Import z pliku (JSON albo PNG)             |
| `import-connection`        | `ImportConnectionModal`       | Import pakietu połączenia                  |
| `import-lorebook`          | `ImportLorebookModal`         | Import z pliku                             |
| `import-preset`            | `ImportPresetModal`           | Import z pliku                             |
| `import-persona`           | `ImportPersonaModal`          | Import z pliku                             |
| `character-card-update`    | `CharacterCardUpdateModal`    | Przegląd zmian karty postaci zaproponowanych przez agenta |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Zgoda na zapis przez agenta i przegląd zmian |
| `docs-viewer`              | `DocsViewerModal`             | Przeglądarka dokumentacji w aplikacji      |
| `st-bulk-import`           | `STBulkImportModal`           | Zbiorczy import danych z SillyTavern       |
| `about-me-viewer`          | `AboutMeViewerModal`          | Podgląd About Me z trybu Conversation      |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Ustawienia preferencji promptu sceny       |

Wzorzec okna modalnego: każde okno przyjmuje `{ open, onClose }`, opakowuje treść w komponent bazowy `Modal`, korzysta z mutacji przy wywołaniach API i pokazuje stan ładowania na podstawie `mutation.isPending`.

### System paneli (`components/panels/`)

Panele otwierają się w pasku bocznym zamiast widoku Czaty i pokazują listy zasobów z wyszukiwaniem, sortowaniem i filtrowaniem. Kliknięty zasób otwiera się w pełnym edytorze w środkowej kolumnie.

Panele rejestruje się w `RightPanel.tsx` w dwóch miejscach:

1. `PANEL_CONFIG`: tytuł, ikona i kolor gradientu.
2. `RIGHT_PANELS` (w `right-panel-panels.ts`): mapa komponentów.

Panele zachowują stan dzięki zbiorowi `mountedPanels` przechowywanemu w `useState` wewnątrz `RightPanel`. Śledzi on odwiedzone panele. Raz zamontowany panel zostaje w DOM (ukryty przez `display: none` albo `aria-hidden`), żeby zachować stan. Zbiór należy do jednego montowania `RightPanel`, więc ponowne zamontowanie, na przykład przy ponownym otwarciu panelu na telefonie, zaczyna tylko z bieżącym panelem.

### Prymitywy interfejsu (`components/ui/`)

| Komponent          | Opis                                                                   |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Bazowe okno modalne z zamykaniem po kliknięciu tła, klawiszem Esc oraz animacjami wejścia i wyjścia |
| `ColorPicker`      | Wybierak koloru jednolitego albo gradientu z gotowymi próbkami         |
| `ExpandedTextarea` | Pełnoekranowa nakładka w portalu do edycji dużych bloków tekstu        |
| `EmojiPicker`      | Panel podręczny emoji z wyszukiwaniem (renderowany w portalu)          |
| `GifPicker`        | Wyszukiwanie GIF-ów przez API Giphy                                    |
| `HelpTooltip`      | Ikona, która po najechaniu pokazuje podpowiedź umieszczoną w portalu   |
| `LibraryToolbar` | Wspólny pasek narzędzi wszystkich paneli biblioteki (zobacz niżej) |
| `EditorHeader` | Wspólny nagłówek wszystkich edytorów pełnostronicowych (zobacz niżej) |

Wszystkie komponenty interfejsu korzystają z kontrolowanych właściwości (value oraz onChange) i renderują nakładki w portalu.

**Panele biblioteki używają `LibraryToolbar`.** Panele Postacie, Persony, Lorebooki, Agenci i zakładki panelu Presety renderują przez niego górne kontrolki: opcjonalny wiersz biblioteki (jeden przycisk na całą szerokość albo para Pobierz / Otwórz bibliotekę), tworzenie / import / eksport / zaznaczanie, wyszukiwanie ze wspólnym menu sortowania, Nowy folder, a potem filtry panelu jako `children`. Wiersze są typowanymi propsami, a nie slotami, więc nowy panel biblioteki dostaje ten sam markup zamiast kopii, która z czasem zaczyna się różnić. Dodaj tam prop zamiast ręcznie budować pasek narzędzi w panelu.

`LibraryToolbar.tsx` eksportuje też `SegmentedButtons`, jeden długi przycisk `.mari-chrome-segmented` podzielony znakami `|`. Renderuje on parę Pobierz / Otwórz bibliotekę i zakładki **Prompty** / **Regexy** / **Narzędzia** / **Profile** panelu Presety, dzięki czemu górny wiersz każdego panelu ma tę samą wysokość. Przekazanie `groupLabel` nadaje wierszowi zakładek `role="group"`, a `pressed` ustawia `aria-pressed` każdej zakładki. `.mari-chrome-segmented` ma `flex-shrink: 0`, więc własny przewijany kontener flex panelu o stałej wysokości (jak w panelu Postacie) nie może ścisnąć tego wiersza.

**Edytory pełnostronicowe używają `EditorHeader`.** Rysuje on przycisk Wstecz, kafelek ikony, nazwę, opcjonalne zakładki sekcji, akcje i przycisk Zamknij w jednym z dwóch układów. Z `nav` (zakładkami sekcji) reguły zagęszczenia `mari-editor-header--with-nav` dopasowują rozmiary wszystkiego do zakładek. Bez niego akcje dostają na telefonach własny wiersz, a przycisk Zapisz pokazuje tam tylko ikonę. Nazwa, zawartość kafelka i przyciski to sloty, więc każdy edytor zachowuje własne pole nazwy i własne kontrolki. Twórz przyciski nagłówka za pomocą `EditorSaveButton` i `EditorHeaderAction`: ich etykieta jest zawsze jednocześnie podpowiedzią i nazwą dostępną dla technologii wspomagających. Dodaj tam slot lub element, zamiast ręcznie budować nagłówek w edytorze.

## Klient API (`lib/api-client.ts`)

Cała komunikacja z serwerem przechodzi przez obiekt `api`:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Metoda                         | Sygnatura           | Opis                                  |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Pobranie JSON                         |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Wysłanie JSON, odebranie JSON         |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Pełna aktualizacja                    |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Częściowa aktualizacja                |
| `api.delete(path)`             | `DELETE /api{path}` | Usunięcie zasobu                      |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Wgranie pliku (multipart)             |
| `api.download(path, filename)` | `GET /api{path}`    | Pobranie wraz z oknem zapisu pliku    |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Generator asynchroniczny SSE (wszystkie typy zdarzeń) |

Błędy zgłaszane są jako `ApiError`, który niesie właściwości `status` i `message`.

## Selektory i listy rozwijane

Każda kontrolka do wyboru wartości otwiera wspólne okno selektora. Zmieniaj wygląd, styl wiersza lub szerokość selektorów wyłącznie w komponentach wspólnych wymienionych poniżej. Nie dodawaj natywnego `<select>` ani własnej listy w wyskakującym oknie. Aplikacja nie używa już żadnego z tych rozwiązań.

| Warstwa | Plik | Za co odpowiada |
| --- | --- | --- |
| Okno | `components/ui/PickerWindow.tsx` | Na komputerze to wyskakujące okno przy polu, o szerokości dopasowanej do wierszy: co najmniej tyle co pole, najwyżej 352 px lub szerokość pola, jeśli jest większa. Na telefonie otwiera się od dołu jako `Modal`. Wewnątrz `Modal` pozostaje oknem przy polu, żeby nie nakładać dwóch wysuwanych paneli. Zamyka się po Escape, Wstecz, kliknięciu poza nim lub przewinięciu pola poza widok. |
| Wiersze | `components/ui/PickerParts.tsx` | `PickRow` (grafika, tytuł, dodatkowy tekst zawijany do dwóch linii, plakietka, znacznik lub pole wyboru), `PickerSearch`, nagłówki folderów i `usePickerKeyboard` (strzałki, Enter). |
| Lista | `components/ui/PickerFolderList.tsx` | Zawartość: wyszukiwarka, wiersze według folderów biblioteki lub `group`, wybór pojedynczy lub wielokrotny oraz przycisk "Add all" dla każdego folderu. |
| Pola | `components/ui/Select.tsx` | `Select` wybiera jedną wartość ze stałej listy i zastępuje natywny `<select>`. Ma przycisk typu combobox, wyszukiwanie od `SELECT_SEARCH_MIN` opcji oraz obsługę strzałek i wpisywania nazwy przy zamkniętym polu. |
|  | `components/ui/PickerField.tsx` | `PickerField` (jeden element, wiersz None i foldery), `PickerListField` / `PickerListWindow` (kilka elementów, które pojawiają się pod polem z przyciskami usuwania) oraz `useFieldWindow` (stan otwarcia i przywracanie fokusu do pola po zamknięciu). |
|  | `components/ui/LibraryPickers.tsx`, `components/characters/CharacterSelect.tsx` | Pola presetów, lorebooków, postaci i person zbudowane z powyższych elementów. |

Jak dodać selektor:

- **Jedna wartość z listy:** `Select`. Przekaż `label`, które nazywa pole i nadaje tytuł oknu.
- **Jeden element biblioteki** (z folderami, grafiką i wierszem None): `PickerField` lub odpowiednie pole z `LibraryPickers.tsx`.
- **Kilka elementów:** `PickerListField`. Escape i kliknięcie poza oknem zamykają je. Sam wybór go nie zamyka.
- **Kontrolka, która nie jest polem** (np. przycisk "Link to Conversation" z krótką listą wyboru): użyj `useFieldWindow` dla stanu otwarcia i fokusu, `PickerWindow` przy przycisku i `PickerFolderList` lub wierszy `PickRow` wewnątrz.

Selektor połączeń i modeli (`ConnectionSelect` / `ModelPicker`) nadal ma osobne okno. Galerie ikon (`StatIconPicker`), uzupełnianie tagów oraz menu kontekstowe i menu akcji mają własne interfejsy i nie są selektorami.

**Testowanie.** Przycisk `Select` ma `role="combobox"`, wybraną wartość w `data-value` i okno typu `dialog` nazwane etykietą pola. Wiersze mają `data-pick-row`. Wybrany wiersz przy wyborze pojedynczym ma `aria-current="true"`, a wiersze przy wyborze wielokrotnym mają `aria-pressed`. `e2e/select-field.ts` udostępnia `chooseOption` i `pickerLabels` w miejsce funkcji `selectOption` z Playwright używanej w starych natywnych polach.

## System stylów

### Tailwind CSS v4

Projekt korzysta z Tailwind CSS v4 i wtyczki `@tailwindcss/vite` (konfiguracja PostCSS jest zbędna). Tokeny motywu mapują się z niestandardowych właściwości CSS w `globals.css`:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Architektura motywów

Plik `globals.css` dzieli się na opisane sekcje. Są wśród nich mapowanie `@theme` z Tailwind, zmienne motywu ciemnego, nadpisania motywu jasnego, bazowy reset, własne kursory, paski przewijania, panele szklane, narzędzia poświaty, komponenty interfejsu i animacje klatek kluczowych. Kolejne sekcje obejmują animacje czatu, stylowanie czatu osobno dla każdego trybu, sprite'y i pasek HUD w grze, karty wywołań funkcji, reguły responsywności, zaimportowany motyw SillyTavern, reguły dostępności i wskazówki wydajnościowe.

### Własne motywy

Można tworzyć własne motywy. Definicje motywów zapisuje serwer Marinara Engine, a potem synchronizują się między podłączonymi urządzeniami. Aktywny własny motyw też jest współdzielony. CSS wstawia jako znacznik `style` komponent `CustomThemeInjector.tsx`.

Zsynchronizowany CSS motywu może poprosić o wbudowany mechanizm Accent Pulse przez `--marinara-theme-accent-pulse: enabled`. Dodaj `--marinara-theme-accent-pulse-source: #a78bfa` (albo gradient), gdy pulsowanie ma używać konkretnego akcentu motywu zamiast bieżącego akcentu z sekcji Appearance.

### Personal Extensions

Personal Extensions to kod w piaskownicy, przechowywany na serwerze i zatwierdzany przez dokładny skrót. Interfejs Addons korzysta z `use-personal-extensions.ts`; `PersonalExtensionInjector.tsx` uruchamia zatwierdzony kod przeglądarkowy w osobnym obiekcie Worker wewnątrz izolowanej ramki iframe o nieprzezroczystym pochodzeniu, a przy tym pośredniczy w przekazywaniu niezmiennych migawek kontekstu aktywnego czatu. Pola kontekstu są zawsze obecne; poza aktywnym czatem `chatId` i `characterId` mają wartość `null`, a `characterIds` pozostaje puste. Ograniczone pola aktywnej karty postaci i wybranej persony wymagają osobno zadeklarowanych uprawnień powiązanych ze skrótem. Rozszerzenia serwerowe działają w oddzielnym procesie Node wewnątrz macOS Seatbelt albo Linux Bubblewrap i odmawiają uruchomienia, gdy żadne z tych rozwiązań nie jest dostępne. Źródła zewnętrzne wymagają odblokowania w `.env` oraz ręcznego włączenia w sekcji Danger Zone – na poziomie listowania, zatwierdzania i uruchamiania.

Zajrzyj do dokumentu [Architektura rozszerzeń osobistych](personal-extensions.md), zanim zmienisz cokolwiek w tej funkcji.

## Pakiet współdzielony (`packages/shared`)

Frontend importuje typy, schematy i stałe z `@marinara-engine/shared`.

### Stałe

Najważniejsze pliki w `packages/shared/src/constants/`:

- `defaults.ts`: eksporty takie jak `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` i `LIMITS`. To źródło wersji, a zarazem miejsce z domyślnymi ustawieniami generowania.
- `providers.ts`: eksportuje `PROVIDERS`, czyli konfiguracje dostawców API (OpenAI, Anthropic, Google i inni) z adresami URL i uwierzytelnianiem.
- `model-lists.ts`: statyczne katalogi modeli dla każdego dostawcy oraz `IMAGE_GENERATION_SOURCES` dla dostawców generowania obrazów.
- `agent-prompts.ts`: prompty podsumowania i sekretnego wątku dostępne w wersji bazowej, a do tego wyszukiwanie w czasie wykonania promptów dostarczonych przez zainstalowane pakiety agentów.

### Schematy (Zod)

Cała walidacja danych wejściowych opiera się na schematach Zod z `packages/shared/src/schemas/`. Reprezentatywne pliki:

| Plik schematu           | Encje                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | Tworzenie i aktualizacja AgentConfig, fazy agentów, typy wyników   |
| `character.schema.ts`   | Karty postaci, metadane zgodności, księgi postaci, grupy   |
| `chat.schema.ts`        | Tworzenie czatu, tworzenie wiadomości, żądanie generowania        |
| `connection.schema.ts`  | Tworzenie i aktualizacja połączenia API                            |
| `custom-tool.schema.ts` | Definicje własnych narzędzi                                        |
| `lorebook.schema.ts`    | Tworzenie i aktualizacja lorebooka oraz wpisów, warunki aktywacji, harmonogramy |
| `prompt.schema.ts`      | Preset, sekcja, grupa, blok wyborów, parametry generowania         |
| `regex.schema.ts`       | Tworzenie i aktualizacja skryptu regex                             |
| `personal-extension.schema.ts` | Wersje robocze Personal Extensions, zatwierdzanie po dokładnym skrócie, wycofywanie zmian i prywatny magazyn |

W tym folderze leżą też schematy ustawień aplikacji, profili ustawień czatu, rozmów w trybie Conversation, własnych emoji i naklejek, sekcji Noodle oraz motywów.

### Typy

Definicje typów encji leżą w `packages/shared/src/types/`. Próbka najważniejszych plików:

| Plik typów            | Kluczowe interfejsy                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, metadane czasu wykonania, wersje, źródło i stan środowiska serwerowego                         |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Narzędzia pomocnicze

| Plik              | Przeznaczenie                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: podstawia makra takie jak `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` i `{{getvar::name}}`     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: zamienia nazwę wyświetlaną na znacznik XML ("World Info (Before)" staje się "world_info_before")                           |

## Punkty końcowe API

Serwer (`packages/server`) udostępnia API REST pod `/api`. To mapa ogólna, a nie pełna lista. Źródłem prawdy są plik `packages/server/src/routes/index.ts` oraz poszczególne pliki tras.

### Zasoby podstawowe

| Prefiks              | Metody                   | Opis                                                                                       |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD postaci, grupy, eksport (JSON albo PNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD czatów, wiadomości, metadane, podłączanie i odłączanie                                     |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD presetów, sekcje, grupy, bloki wyborów, eksport                                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD połączeń API, duplikowanie, test                                                      |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD agentów, wiadomości echo, uruchomienia; przełączniki agentów wbudowanych korzystają z `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD lorebooków, wpisy, eksport                                                            |
| `/api/custom-tools` | GET, POST, PUT, PATCH, DELETE | CRUD własnych narzędzi, `PUT /reorder` i `PUT /enabled` |
| `/api/regex-scripts` | GET, POST, PUT, PATCH, DELETE | CRUD skryptów regex, `PUT /reorder` i `PUT /enabled` |
| `/api/library-folders/regex` | GET, POST, PATCH, DELETE | CRUD folderów skryptów regex, stan wstrzymania i `POST /move` |
| `/api/library-folders/functions` | GET, POST, PATCH, DELETE | CRUD folderów własnych narzędzi, stan wstrzymania i `POST /move` |

`PUT /api/regex-scripts/enabled` przyjmuje `scriptIds` i `enabled`. Jeśli brakuje któregoś identyfikatora, zwraca 404 i nie aktualizuje żadnego skryptu. Lista skryptów regex zawiera `pausedByFolder` niezależnie od zapisanego stanu `enabled`. `PUT /api/custom-tools/enabled` działa tak samo z `toolIds`, a lista własnych narzędzi też zawiera `pausedByFolder`. Narzędzie we wstrzymanym folderze nigdy nie jest udostępniane modelowi.

Narzędzia pamięci agentów korzystają z `/api/agents/memory/:agentType/:chatId`, gdzie `agentType` to tekstowy typ agenta, a `chatId` to identyfikator docelowego czatu.

### Generowanie

| Punkt końcowy                | Metoda | Opis                                                 |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Główne generowanie SSE z pipeline'em agentów         |
| `/api/generate/retry-agents` | POST   | Ponowienie SSE dla typów agentów podanych przez wywołującego |

### Funkcje czatu

| Prefiks                   | Punkty końcowe                   | Opis                         |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD oraz zmiana kolejności      | Zarządzanie folderami czatów |
| `/api/conversation`       | schedule, status, activity, autonomous | System wiadomości autonomicznych |
| `/api/scene`              | create, plan, conclude           | Rozgałęzianie scen           |
| `/api/encounter`          | init, action, summary            | Starcia                      |
| `/api/translate`          | POST                             | Tłumaczenie tekstu           |
| `/api/game`               | CRUD i akcje                     | Sesje i stan trybu Game Mode |
| `/api/game-assets`        | CRUD i wgrywanie                 | Zasoby gry                   |
| `/api/game-rulesets`      | import, schemat, źródło, usuwanie | Zaimportowane zestawy zasad Game Mode |
| `/api/game-worlds`        | CRUD biblioteki i edycja świata  | Biblioteka światów dla nowych gier i pakietów map |
| `/api/game-tile-packs`    | paczki kafelków oraz `/creatures` i `/boards` | Paczki grafik map, stworzeń i plansz walki |
| `/api/turn-games` | catalog, state, start, move, resign | Gry stołowe w trybie Conversation (gry pochodzą z pakietów) |
| `/api/conversation-calls` | Trasy rozmów i sesji (trasy rejestruje pakiet połączeń Conversation) | Rozmowy audio w trybie Conversation |

### Multimedia i zasoby

| Prefiks                       | Opis                         |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Serwowanie obrazów awatarów  |
| `/api/backgrounds`            | CRUD teł oraz wgrywanie      |
| `/api/sprites/:characterId`   | Zarządzanie wyrazami twarzy sprite'ów |
| `/api/fonts`                  | Zarządzanie własnymi czcionkami |
| `/api/gallery/:chatId`        | Obrazy galerii danego czatu  |
| `/api/global-gallery`         | Obrazy galerii globalnej     |
| `/api/tts`                    | Trasy syntezy mowy           |
| `/api/speech-to-text`         | Ustawienia i test serwera Speech to Text |
| `/api/avatar-models`          | Modele awatarów 2D i 3D dla agentów awatarów |
| `/api/avatar-generation`      | Szkice awatarów ze sprite'ów i klucz Tripo |
| `/api/avatar-classify`        | Klasyfikator emocji awatarów i jego model lokalny |
| `/api/youtube`                | Trasy YouTube DJ             |
| `/api/custom-emojis`          | Zasoby własnych emoji        |
| `/api/custom-stickers`        | Zasoby własnych naklejek     |
| `/api/gifs/search`            | Wyszukiwanie GIF-ów (proxy Giphy) |

### Integracje zewnętrzne

| Prefiks                         | Opis                         |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Wyszukiwanie postaci w Chub  |
| `/api/bot-browser/janny/*`      | Wyszukiwanie w JannyAI       |
| `/api/bot-browser/pygmalion/*`  | Wyszukiwanie w Pygmalion     |
| `/api/bot-browser/wyvern/*`     | Wyszukiwanie w Wyvern        |
| `/api/bot-browser/datacat/*`    | Wyszukiwanie w DataCat       |
| `/api/haptic/*`                 | Sterowanie urządzeniem haptycznym |
| `/api/spotify/*`                | Uwierzytelnianie Spotify     |
| `/api/knowledge-sources`        | Baza wiedzy do wyszukiwania  |

### System

| Punkt końcowy                   | Opis                                    |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check` | Sprawdzenie wersji względem wydań w serwisie GitHub oraz, dla instalacji z Git, o ile kopia repozytorium jest za kanałem aktualizacji |
| `/api/updates/channel` | Kanał aktualizacji, bieżąca gałąź i lista kanałów |
| `/api/updates/apply` | Wgranie aktualizacji |
| `/api/backup`                   | Pełna kopia zapasowa, eksport, import   |
| `/api/import/*`                 | Import profilu z SillyTavern i Marinara Engine |
| `/api/admin/clear-all`          | Pełne wyczyszczenie danych              |
| `/api/themes`                   | Zsynchronizowane własne motywy          |
| `/api/personal-extensions`      | Polityka rozszerzeń w piaskownicy, wersje robocze, zatwierdzanie, środowisko wykonania i prywatny magazyn |
| `/api/app-settings`             | Ustawienia aplikacji po stronie serwera |
| `/api/sidecar`                  | Środowisko lokalnego modelu             |
| `/api/chat-presets`             | Profile ustawień czatu (dawna nazwa punktu końcowego) |
| `/api/connection-folders`       | Foldery połączeń                        |
| `/api/prompt-overrides`         | Nadpisania promptów wbudowanych         |
| `/api/achievements`             | Odblokowane osiągnięcia                 |
| `/api/capability-packages`      | Katalog agentów, instalacje, aktualizacje, informacje o wydaniu i zasoby pakietów |
| `/api/noodle`                   | Oś czasu społecznościowa Noodle (rejestrowana przez pakiet Noodle) |
| `/api/professor-mari/workspace` | Operacje na obszarze roboczym Professor Mari |
| `/api/professor-mari/quick`     | Szybkie odpowiedzi Professor Mari i stosowanie zaproponowanych w nich zmian |

## Obsługa PWA

Aplikacja jest aplikacją progresywną skonfigurowaną za pomocą VitePWA:

- Manifest: `public/manifest.json` z nazwą aplikacji "Marinara Engine", trybem wyświetlania standalone i motywem ciemnym.
- Ikony: favikona 64 px, ikony maskowalne 192 px i 512 px oraz logo ekranu powitalnego.
- Service worker: Workbox z `registerType: "prompt"`. Nowa wersja czeka na akceptację użytkownika.
- Cache: zasoby statyczne są cachowane, a trasy `/api/*` korzystają z NetworkOnly.
- Podtrzymanie działania: `lib/keep-alive.ts` używa Web Locks API i pingów przez BroadcastChannel, żeby zakładka nie zasypiała.

### Wykrywanie rozjazdu wersji

`App.tsx` odpytuje `/api/health` co 5 minut. Jeśli wersja serwera różni się od wersji zapisanej w cache'u klienta, klient odświeża się przez `forceRefreshSpa` z `lib/browser-runtime.ts`. Ta funkcja wyrejestrowuje service worker i czyści cache.

## System agentów

System agentów przetwarza odpowiedzi AI przez konfigurowalne pipeline'y. Agenci działają w trzech fazach:

1. Przed generowaniem: przed głównym wywołaniem modelu LLM (na przykład wstawianie kontekstu albo pobieranie wiedzy).
2. Równolegle: obok głównego generowania (na przykład śledzenie stanu świata albo walka).
3. Po przetworzeniu: po głównej odpowiedzi (na przykład przepisanie stylu albo aktualizacja lorebooków).

Żądania ponowienia idą przez `/api/generate/retry-agents` z jawną listą `agentTypes`. Szeroka akcja interfejsu, taka jak **Re-run Trackers** (ponowne uruchomienie trackerów), przekazuje wszystkie aktywne typy trackerów. Kontrolka pojedynczego widgetu przekazuje tylko swój tracker.

Narzędzia pamięci agentów, na przykład panel Narrative Director Secret Plot, korzystają z `/api/agents/memory/:agentType/:chatId`. Trasa dotyczy skonfigurowanych agentów, którzy przechowują pamięć osobno dla każdego czatu. W bieżących konfiguracjach pamięć Secret Plot zapisuje się pod `director`, a `secret-plot-driver` pozostaje akceptowane dla starszych czatów.

### Agenci własnej produkcji do pobrania

Lekka wersja Engine startuje z pustym rejestrem agentów. Pakiety zainstalowane z publicznego katalogu [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) dokładają zweryfikowane manifesty agentów, punkty wejścia funkcji po stronie klienta i serwera oraz sloty interfejsu w czasie wykonania. Aktywne definicje są nadal wystawiane przez `BUILT_IN_AGENTS` dla zgodności, ale pochodzą z zainstalowanych pakietów, a nie z implementacji dołączonych do aplikacji. Oficjalny katalog zawiera te pakiety:

| Agent                    | Faza            | Co robi                                                           |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Pilnuje jakości pisania (brak powtórzeń, pokazywanie zamiast opowiadania) |
| `continuity`             | post_processing | Wykrywa nieciągłości i potrafi podpowiedzieć, jak je poprawić     |
| `director`               | pre_generation  | Wstawia wskazówki narracyjne i opcjonalny stan Secret Plot        |
| `echo-chamber`           | parallel        | Symuluje reakcje widowni                                          |
| `world-state`            | post_processing | Wyciąga z narracji datę, godzinę, miejsce i pogodę                |
| `expression`             | post_processing | Dobiera wyrazy twarzy sprite'ów postaci                           |
| `quest`                  | post_processing | Śledzi tworzenie, aktualizacje i ukończenie zadań                 |
| `background`             | post_processing | Dobiera pasujące obrazy tła                                       |
| `character-tracker`      | post_processing | Śledzi zmiany stanu postaci                                       |
| `persona-stats`          | post_processing | Śledzi zmiany statystyk persony gracza                            |
| `custom-tracker`         | post_processing | Śledzi ustrukturyzowany stan zdefiniowany przez użytkownika       |
| `inventory-tracker`      | post_processing | Śledzi waluty, założone wyposażenie i noszone przedmioty          |
| `quartermaster`          | post_processing | Prowadzi kartę postaci w trybie Roleplay, założone wyposażenie i stroje |
| `beholder`               | post_processing | Śledzi, co każda postać ma na sobie i w rękach, oraz jej obrażenia |
| `relationship-tracker`   | post_processing | Śledzi, co postacie i persona czują do siebie nawzajem            |
| `memory-nag`             | post_processing | Pamięta niezamknięte wątki, takie jak obietnice, i przypomina o nich modelowi |
| `illustrator`            | post_processing | Tworzy prompty obrazów scen i żądania multimediów                 |
| `lorebook-keeper`        | post_processing | Sam tworzy i aktualizuje wpisy lorebooków                         |
| `card-evolution-auditor` | post_processing | Sprawdza karty postaci pod kątem sugerowanych zmian               |
| `combat`                 | parallel        | Śledzi tury walki, HP, inicjatywę i wyniki                        |
| `html`                   | post_processing | Przepisuje gotowe odpowiedzi w trybie Roleplay, dokładając diegetyczne elementy HTML |
| `spotify`                | post_processing | Steruje odtwarzaniem w Music DJ (Spotify, YouTube albo muzyka lokalna) |
| `knowledge-retrieval`    | pre_generation  | Pobiera kontekst ze źródeł wiedzy                                 |
| `knowledge-router`       | pre_generation  | Kieruje trafnymi wpisami lorebooków i wiedzy                      |
| `long-term-memory` | feature | Przechowuje trwałe wspomnienia i przywołuje istotny kontekst |
| `haptic`                 | post_processing | Wysyła komendy do urządzenia haptycznego                          |
| `cyoa`                   | post_processing | Generuje prompty z wyborami                                       |
| `storyboard` | post_processing | Planuje nieruchome i animowane storyboardy Game i Roleplay |
| `2d-avatars`             | feature         | Renderuje animowane awatary postaci 2D ze sprite'ów lub siatek     |
| `3d-avatars`             | feature         | Renderuje animowane awatary 3D w formatach VRM, MMD PMX, GLB i FBX |
| `conversation-calls`     | feature         | Dodaje rozmowy audio/wideo w trybie Conversation i powiązane ustawienia |
| `hierarchical-maps`      | feature         | Dodaje mapy, kontekst przestrzenny i ruch w trybach Roleplay i Game Mode |
| `noodle` | feature | Dodaje lokalny kanał społecznościowy Noodle do Home |
| `otome-forge`            | feature         | Dodaje do Home Otome Hearth, grę otome zbudowaną z postaci        |
| `saucelings`             | feature         | Dodaje do Home Saucelings, wirtualne zwierzątko wychowywane przez postacie |
| `slurp2` | feature | Dodaje do Home Slurp, prywatną aplikację do tworzenia postaci |
| `story-writer`           | feature         | Dodaje do Home Story Writer, przestrzeń do wspólnego pisania książki |
| `gacha-forge` | feature | Dodaje do Home tryb gry gacha |
| `blackjack`              | feature         | Dodaje stolik do blackjacka w trybie Conversation                 |
| `uno`                    | feature         | Dodaje stolik UNO w trybie Conversation                           |
| `chess`                  | feature         | Dodaje szachownicę w trybie Conversation                          |
| `poker`                  | feature         | Dodaje stolik Texas Hold'em w trybie Conversation                 |
| `eightball`              | feature         | Dodaje stół do bilarda 8-Ball w trybie Conversation               |
| `tic-tac-toe`            | feature         | Dodaje planszę do kółka i krzyżyka w trybie Conversation          |
| `rock-paper-scissors`    | feature         | Dodaje partie w kamień, papier, nożyce w trybie Conversation      |
| `wordle`                 | feature         | Dodaje codzienny wyścig Wordle w trybie Conversation              |

### Typy wyników agentów

Agenci zwracają wyniki o określonych typach, które obsługuje frontend. Unia `AgentResultType` w `packages/shared/src/types/agent.ts` obejmuje:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `character_card_create`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `character_activity_update`, `frontend_theme_update`, `about_me_update` oraz `memory_nag`.

## Tryby czatu

### Tryb Conversation

Zwykły dialog z jedną postacią AI albo z kilkoma. Postacie mogą mieć różne statusy (online, bezczynny, nie przeszkadzać, offline), które wpływają na czas i styl odpowiedzi. Agentów wbudowanych dodaje się osobno do każdego czatu, a nie włącza globalnie.

### Tryb Roleplay

Wciągające doświadczenie narracyjne ze śledzeniem stanu świata: kontekst sceny (miejsce, czas, pogoda), obecność i nastrój postaci, statystyki gracza, ekwipunek i zadania, starcia, World Info z lorebooków oraz wyrazy twarzy sprite'ów.

### Game Mode

Sesje z Game Master sterowanym przez AI: członkowie drużyny, kości, stan świata, zasoby, storyboardy, dziennik i ustrukturyzowany cykl życia sesji. Game Mode korzysta z dedykowanych magazynów i tras dla stanu świata, zasobów, gier stołowych, filmów scen i storyboardów. Sposób pracy od strony użytkownika opisuje [Game Mode: pierwsze kroki](../game/getting-started.md).

## Rozwój

### Polecenia

Instalacja zależności:

```bash
pnpm install
```

Uruchomienie serwera i klienta z przeładowywaniem na gorąco:

```bash
pnpm dev
```

Uruchomienie samego serwera deweloperskiego klienta:

```bash
pnpm dev:client
```

Uruchomienie samego serwera API:

```bash
pnpm dev:server
```

Uruchom podstawową walidację (Prettier, ESLint, sprawdzanie typów i kompilacje produkcyjne; na komputerze z małą ilością pamięci ustaw `MARINARA_CHECK_JOBS=1`):

```bash
pnpm check
```

Budowanie wersji produkcyjnej:

```bash
pnpm build
```

### Budżet paczki

- Wejście główne: maksymalnie 1 MB.
- Rozmiar pojedynczego fragmentu: `chunkSizeWarningLimit` to 512 KB. Przekroczenie tego progu wyświetla ostrzeżenie podczas kompilacji, która trwa dalej.
- Podziały bibliotek zewnętrznych: react, tanstack, motion, zustand, icons i misc.

### Alias ścieżki

`@/*` wskazuje na `./src/*` zarówno w konfiguracji TypeScript, jak i Vite.

## Powiązane przewodniki

- [Mapa architektury (dla programistów)](architecture-map.md)
- [Przechowywanie danych w plikach](file-storage.md)
