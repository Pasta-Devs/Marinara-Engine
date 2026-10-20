# Opcjonalne pakiety agentów i możliwości

Status: zaimplementowane w cyklu rozwojowym v2.3.0 w zgłoszeniu #3612.

## Cel

Podstawowa dystrybucja aplikacji Marinara Engine nie może kompilować ani dostarczać opcjonalnych implementacji agentów i możliwości. Świeża instalacja startuje bez żadnych opcjonalnych pakietów. Aktualizacja zachowuje możliwości, które były dostępne przed wprowadzeniem tego systemu pakietów.

Oficjalny katalog, źródła pakietów, powtarzalne artefakty, skrypty walidacyjne i proces współtworzenia znajdziesz w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Zainstalowane artefakty lądują wewnątrz skonfigurowanego folderu danych aplikacji Marinara Engine, więc aktualizacja aplikacji ich nie nadpisze.

## Model pakietu

Pakiet agenta może wnosić jednego lub kilku deklaratywnych agentów oraz opcjonalne zaufane możliwości wykonywalne:

- serwerowe punkty wejścia dla tras, haków cyklu życia, dostawców promptów, obsługi wyników i migracji magazynu danych;
- klienckie punkty wejścia dla paneli, powierzchni czatu, sekcji ustawień, wyborów w kreatorze konfiguracji, widoków czasu wykonania oraz pełnych powierzchni trybu Game Mode;
- wspólne schematy JSON i stabilne kontrakty transmisji;
- zasoby, dokumentację i fragmenty wiedzy dla asystentki Professor Mari należące do pakietu.

Pakiety celują w wersjonowane API możliwości aplikacji Marinara Engine. Nie mogą importować prywatnych ścieżek źródłowych silnika.

Klienckie elementy możliwości dostają wybrany w aplikacji język interfejsu przez atrybuty `lang` i `dir` oraz przez
obiekt `capabilityProps.localization`. Interfejsy należące do pakietu mają własne pliki językowe i wracają do angielskiego
z pakietu; Marinara Engine nie tłumaczy promptów pakietu ani wartości maszynowych zapisanych w pakiecie. Zmiana języka
nadal korzysta z istniejącego zdarzenia `marinara-capability-props`, więc zainstalowany interfejs odświeża się bez restartu aplikacji.

### Dostarczanie i pamięć podręczna

Zainstalowane pliki pakietu są udostępniane z silnymi walidatorami wyprowadzonymi ze skrótów SHA-256 poszczególnych plików w manifeście. Tych samych wartości Engine używa do ponownego sprawdzenia bajtów przy każdym odczycie. Pakiet klienta (`/api/capability-packages/<id>/client`) i każdy zasób pakietu są zawsze ponownie walidowane (`no-cache` wraz z `ETag`). Niezmieniony plik odpowiada więc kodem `304 Not Modified`, zamiast pobierać się ponownie, a ponownie opublikowany plik jest natychmiast wykrywany. Nic nie jest udostępniane jako `immutable`: zasady instalacji pozwalają ponownie opublikować tę samą wersję z innymi bajtami, dlatego adresy URL pakietów nie są adresowane zawartością.

API możliwości w wersji 1.1 dodaje do serwerowego kontekstu aktywacji ogólną
fasadę środowiska uruchomieniowego. Pakiety mogą odczytać obowiązujący stan debugowania agentów i pisać
przez logger Pino aplikacji Marinara Engine, łącznie z jawnym wymuszeniem trybu debugowania, bez importowania
prywatnych modułów loggera ani konfiguracji środowiska uruchomieniowego. Fasada udostępnia operacje,
a nie same obiekty silnika.

API możliwości w wersji 1.2 dodaje operacje na czatach i wiadomościach w obrębie transakcji,
wąskie zapisy metadanych czatu, odczyty istnienia wpisów lorebooka oraz zgodnościowy
magazyn migawek przestrzennych. Pakiety mogą sprawdzić poprawność zmian w domenie wewnątrz transakcji
silnika i atomowo zatwierdzić metadane razem z wiadomością właściciela, swipe'em lub migawką
przestrzenną, bez dostępu do uchwytu bazy danych czy obiektu tabeli. Marinara Engine odpowiada za
wycofywanie zmian i zgodność z historycznym magazynem, a pakiety za walidację i
zasady domeny. To samo API udostępnia znormalizowane rekordy czatów i postaci, wybór
kwalifikujących się wpisów lorebooka, parsowanie odpowiedzi zbliżonych do formatu JSON oraz rozstrzygnięte wywołania modeli językowych.
Dane uwierzytelniające połączeń, implementacje dostawców, uchwyty bazy danych i obiekty magazynu
pozostają prywatne dla silnika.

### Przestrzeń nazw hosta dla kodu klienckiego

Silnik jest właścicielem stanu swojego klienta i swoich bibliotek, a kod kliencki pakietów agentów korzysta z nich, zamiast dołączać własne kopie. Kopia ma własny stan: kod kliencki pakietów, który dołączał magazyn ustawień interfejsu, przy każdym wczytaniu zapisywał jego starszą wersję na ustawieniach silnika (Pasta-Devs/Marinara-Agents#1478), a każdy dołączony magazyn czatu trzymał czat otwarty w chwili wczytania strony.

Zanim silnik zaimportuje kod kliencki pierwszego pakietu, definiuje jedną zmienną globalną:

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

Ta właściwość nie jest zapisywalna ani konfigurowalna, a przestrzeń nazw oraz jej obiekty `stores`, `services`, `modules`, `components` i `data` są zamrożone. Moduł ładujący pakiety (`useCapabilityClientModules`) wczytuje `lib/marinara-host.ts` przez `import()` i czeka na `ensureMarinaraHost()`, zanim zaimportuje kod kliencki jakiegokolwiek pakietu, więc w chwili wykonywania modułu pakietu przestrzeń nazw jest już kompletna. Silnik bez kodu klienckiego pakietów nigdy jej nie wczytuje. Jeśli nie da się jej wczytać (na przykład z powodu nieaktualnego fragmentu kodu po aktualizacji), każdy pakiet pokazuje swój dotychczasowy błąd wczytywania, a reszta silnika działa dalej. Typ TypeScript to `MarinaraHostV1` w `packages/client/src/lib/marinara-host-contract.ts`, razem z listami z tej strony. Buildy pakietów deklarują pasujące typy strukturalne, zamiast importować kod źródłowy silnika.

| Element | Wartość |
| --- | --- |
| `version` | `1`. Zmienia się tylko przy niezgodnej zmianie kształtu. |
| `capabilityApi` | `supportedCapabilityApi` silnika, na przykład `{ major: 1, minor: 341 }`. |
| `stores` | Działające magazyny Zustand `ui`, `chat`, `agent`, `sidecar`, `dialog`, `gallery`, `encounter`, `gameState` i `backfill`. `chat` zawiera wycinek oczekujących przejść przestrzennych. |
| `services.tts` | Moduł `lib/tts-service.ts` (`ttsService`, `playWhenAvailable`, ...). |
| `services.dialogs` | Moduł `lib/app-dialogs.ts` (`showAlertDialog`, `showConfirmDialog`, `showPromptDialog`, `showChoiceDialog`). |
| `modules` | Moduły bibliotek według samego specyfikatora (poniżej). |
| `queryClient` | Jedyny `QueryClient` React Query, z którym renderuje się silnik. |
| `components.Modal` | `Modal` silnika, z jego kolejnością nakładek oraz obsługą klawisza Escape i przycisku Wstecz. |
| `data.emojiCatalog` | Moduł `lib/emoji-catalog.generated.ts`. |
| `api` | Moduł `lib/api-client.ts` (`api`, `ApiError`, `getApiErrorMessage`, ...). |

Pakiet odczytuje element dopiero po sprawdzeniu go, na przykład `const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`. Przestrzeń nazw tylko się rozrasta: nowy element pojawia się razem z nową wersją minor API możliwości, a pakiet, który go potrzebuje, wymaga tej wersji minor. Pakiety zbudowane pod przestrzeń nazw wymagają wersji API możliwości, która ją dodała, więc starszy silnik nigdy ich nie instaluje i zachowuje wersję, którą ma. Jeśli element mimo to nie istnieje, pakiet nigdy nie wraca do dołączonej kopii stanowej usługi silnika: magazyny `ui` i `chat` stają się kopiami tylko do odczytu, które nigdy niczego nie zapisują, a każdy inny element zgłasza, że funkcja wymaga nowszej wersji aplikacji Marinara Engine.

**Moduły hosta.** `modules[specifier]` to dokładnie to, co `import * as m from "<specifier>"` zwraca we własnym buildzie silnika, łącznie z `default`, jeśli biblioteka go ma. Specyfikatory to `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `sonner`, `zod`, `i18next`, `react-i18next`, `framer-motion`, `tailwind-merge` i `clsx`. Build pakietu rozwiązuje te specyfikatory na shimy, które czytają przestrzeń nazw, więc pakiet renderuje się z jedynym Reactem silnika i współdzieli jego pamięć podręczną React Query oraz toasty.

- Pakiety nigdy nie renderują `<Toaster>` i nigdy nie tworzą `QueryClient`. `toast` z `sonner` pokazuje się w położeniu toastów wybranym przez użytkownika. Domyślne ustawienia zapytań silnika (30-sekundowy `staleTime`, jedna ponowna próba, brak ponownego pobierania po powrocie fokusu do okna) obowiązują, chyba że zapytanie ustawia własne opcje, a nowy klucz zapytania należący do pakietu zaczyna się od identyfikatora pakietu.
- Pakiet trzyma własną instancję i18next z `i18next.createInstance()` wewnątrz `<I18nextProvider>`. Nigdy nie używa `initReactI18next`, `setI18n` ani `setDefaults`, bo zastąpiłyby one instancję silnika.
- `lucide-react`, `chess.js`, `scheduler` i `@marinara-engine/shared` nie są modułami hosta; pakiety dołączają to, czego z nich używają.
- Pakiety są budowane pod te wersje główne: `react` 19, `react-dom` 19, `@tanstack/react-query` 5, `zustand` 5, `sonner` 2, `zod` 3, `i18next` 26, `react-i18next` 17, `framer-motion` 13, `tailwind-merge` 3 i `clsx` 2. Podniesienie wersji głównej którejś z nich w silniku (w pierwszej kolejności Reacta) psuje każdy pakiet zbudowany pod starą wersję główną, więc wymaga nowej wersji **major** API możliwości. `scripts/regressions/marinara-host-namespace.regression.ts` kończy się błędem, gdy wersja główna w `packages/client/package.json` się zmienia, a kontrakt nie.

**Pola magazynów odczytywane przez pakiety.** Opublikowane pakiety odczytują dziś te pola. Silnik zachowuje każde z nich, a usunięcie któregoś albo zmiana jego nazwy wymaga nowej wersji major API możliwości (`MARINARA_HOST_STORE_FIELDS` przypina je przez `Pick<>`):

| Magazyn | Pola |
| --- | --- |
| `ui` | `achievementsEnabled`, `debugMode`, `includeReasoningInExports`, `enableStreaming`, `userStatus`, `enterToSendConvo`, `conversationCallVoiceVolume`, `conversationCallVoiceMuted`, `setConversationCallVoiceVolume`, `setConversationCallVoiceMuted`, `conversationTimeZone`, `noodleNavigation`, `setNoodleNavigation`, `noodleSelectedPersonaId`, `setNoodleSelectedPersonaId`, `reviewImagePromptsBeforeSend`, `musicPlayerEnabled`, `musicPlayerSource`, `sidebarOpen`, `setSidebarOpen`, `chatBackground`, `setChatBackground`, `characterDetailId`, `lorebookDetailId`, `presetDetailId`, `connectionDetailId`, `agentDetailId`, `toolDetailId`, `personaDetailId`, `regexDetailId`, `characterLibraryOpen`, `botBrowserOpen`, `gameAssetsBrowserOpen`, `modal`, `rightPanelOpen`, `closeModal`, `closeRightPanel`, `closeBotBrowser`, `closeAllDetails` |
| `chat` | `activeChatId`, `activeChat`, `isStreaming`, `streamingChatId`, `abortControllers`, `reset`, `pendingSpatialTransitions`, `setPendingSpatialTransition`, `clearPendingSpatialTransition`, `setPendingSpatialTransitionStatus` |
| `agent` | `setYoutubePlay`, `reset` |
| `sidecar` | `modelDownloaded`, `modelDisplayName`, `fetchStatus` |
| `dialog` | `dialog`, `openDialog`, `closeDialog` |
| `gallery` | `pinImage`, `pinVideo` |
| `encounter` | `reset` |
| `gameState` | `current`, `setGameState`, `reset` |
| `backfill` | `resetBackfill` |

**Pamięć przeglądarki należąca do silnika.** Pakiety mogą odczytywać te klucze, ale nigdy ich nie zapisują ani nie usuwają: `marinara-engine-ui`, `marinara-engine-ui:host`, `marinara-active-chat-id`, `marinara-input-drafts` (local storage i session storage), `marinara-pending-spatial-transitions`, `marinara-pinned-gallery-images` i `marinara_sidecar_prompted`. Nigdy nie otwierają bazy IndexedDB `marinara-tts-audio-cache`. Aby zmienić ustawienie, pakiet wywołuje akcję magazynu, na przykład `host.stores.ui.getState().setConversationCallVoiceMuted(true)`, a silnik je zapisuje.

**Okna komunikatów aplikacji.** Silnik renderuje swoje okna alertu, potwierdzenia, zapytania o tekst i wyboru na najwyższej warstwie, czyli warstwie paska komend, więc okno otwarte przez pakiet pokazuje się nad własną nakładką pakietu i przejmuje fokus.

**Buildy pakietów sprzed przestrzeni nazw.** Dołączają własną kopię magazynu interfejsu w wersji 74 i nadpisują `marinara-engine-ui` tylko tymi ustawieniami, które zna ta kopia. Silnik zapisuje też każdą zmianę w kopii `marinara-engine-ui:host`, używanej tylko przez hosta, a przy wczytywaniu ignoruje zapisany blob starszy niż jego własna wersja, dopóki ta kopia ma bieżącą wersję. Silnik nadal ustawia `globalThis.React` i `globalThis.ReactDOM` dla zainstalowanych bundli, które używają klasycznego środowiska uruchomieniowego JSX.

### Capability API 1.7: gałęzie czatu

Capability API 1.7 dodaje znormalizowane metadane gałęzi do `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` to zapisana nazwa gałęzi bez zbędnych spacji. Czaty główne zwracają `null`. Znane gałęzie utworzone przez Engine udostępniają bezpośredni czat nadrzędny, wiadomość źródłową rozwidlenia i skopiowaną wiadomość potomną. Puste gałęzie używają kotwic wiadomości null. Starsze gałęzie, błędne metadane i zaimportowane równoległe czaty grupowe bez znanej relacji zwracają pola pochodzenia null; Engine nie odgaduje historycznych relacji. Ogólny eksport i import pomija identyfikatory elementu nadrzędnego i wiadomości, ponieważ zmieniają się między instalacjami. Usunięcie elementu nadrzędnego nie zmienia pochodzenia elementu potomnego.

### Capability API 1.8: Experiences w Game

Capability API 1.8 dodaje Experiences w Game dostarczane przez pakiety, kontekst promptu dla każdej tury Game oraz zapisywanie zasobów.

Pakiet może dostarczyć cały Game Mode zamiast dodatku do trybu wbudowanego. Deklaruje slot `game-surface` i jest wybierany podczas tworzenia gry w bloku Experiences kreatora konfiguracji. Wybór zostaje zapisany w grze na cały czas jej działania, dlatego Experience nigdy nie jest włączane ani wyłączane w połowie rozgrywki. Powierzchnia rysuje własny HUD, menu i walkę nad wspólną narracją oraz deklaruje, które systemy wbudowane zastępuje. Wszystko, czego nie zadeklaruje, pozostaje wbudowane, więc Experience wyłącza tylko to, co naprawdę implementuje. Opcjonalne `contributions.gameSurface.surfaceClass` podaje klasę nakładaną przez Engine na obszar gry, gdy powierzchnia jest zamontowana. Arkusz stylów pakietu może dzięki temu zmienić wspólny interfejs renderowany poza własnym elementem.

Pakiety z uprawnieniem `prompt-context` dodają tekst do promptu systemowego każdej generowanej tury Game. Pakiet posiadający stan na żywo może dzięki temu zachować zgodność modelu z widokiem gracza. Wkład może też zadeklarować zastępowane systemy wbudowane; Engine przestaje wtedy instruować model, aby nimi sterował. Wkłady są zbierane dla każdej tury i nigdy nie są wymagane: pusty wynik jest pomijany, a błąd lub przekroczenie czasu jest rejestrowane i pomijane bez wpływu na generowanie.

Fasada zasobów udostępnia zapis obok odczytu, więc konfiguracja pakietu może znaleźć lub utworzyć Personę gracza i jej lorebook. Pamięć, walidacja i tożsamość pozostają własnością Engine; treść domenowa pozostaje własnością pakietów.

### Capability API 1.10: zasoby pakietu

Capability API 1.10 dodaje ogólne udostępnianie statycznych zasobów pakietu. Manifest może zadeklarować `contributions.assets.paths` - listę dozwolonych maksymalnie 256 obrazów (`png`/`webp`/`gif`/`jpg`/`jpeg`) i plików JSON zawartych w pakiecie. Engine udostępnia je przez `/api/capability-packages/<id>/assets/<path>` przy użyciu tego samego łańcucha kontroli co ikony kart przeglądarki: zamknięcia ścieżki, obecności skrótu w `files[]`, listy dozwolonych pasywnych typów zawartości i ponownej kontroli integralności przy każdym odczycie. Schemat odrzuca aktywne typy dokumentów (SVG, HTML i skrypty); każda zadeklarowana ścieżka musi mieć przypięty skrót w `files[]`; a plik `manifest.json` z wnętrza pakietu nigdy nie może być udostępniony, nawet jeśli został zadeklarowany. `contributions.assets` wymaga manifestu `schemaVersion` 2 z `capabilityApi` 1.10 lub nowszym; manifest v1 w ogóle nie może go deklarować. Zasoby są zawsze ponownie walidowane: podobnie jak pakiet klienta mają silny `ETag` oparty na skrócie manifestu, a niezmienione żądanie dostaje `304 Not Modified` bez treści. Zestaw kafelków pobiera się ponownie tylko po rzeczywistej zmianie bajtów. Odpowiedzi celowo nigdy nie są `immutable`, ponieważ zasady instalacji pozwalają ponownie opublikować tę samą wersję z innymi bajtami, więc adres URL z wersją nie jest adresowany zawartością. W ten sposób Experience `game-surface` może dostarczyć prawdziwą grafikę zamiast osadzać ją w pakiecie klienta.

Manifest naruszający te zasady jest odrzucany przy instalacji jednym z komunikatów: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", błędem rozszerzenia schematu dla ścieżki innej niż obraz lub JSON albo - w przypadku archiwum o nazwach różniących się tylko wielkością liter, które na systemie bez rozróżniania wielkości liter trafiłyby do jednego pliku - "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Każdy element możliwości dostaje w tym celu własną tożsamość: `capabilityProps.packageId` i `capabilityProps.packageVersion` przychodzą razem z `localization`. Pakiet buduje adresy zasobów jako `/api/capability-packages/<packageId>/assets/<path>`, opcjonalnie z `?v=<packageVersion>`, aby zmiana wersji ominęła pośrednią pamięć podręczną, bez ponownego pobierania listy instalacji ani analizowania własnego adresu importu.

### Capability API 1.11: interfejs walki dla Experience

Capability API 1.11 dodaje interfejs walki do właściwości możliwości `game-surface`. `combatActive` zgłasza dokładny moment faktycznego zamontowania wbudowanego interfejsu walki. W przeciwieństwie do `chatMeta.gameActiveState`, narracyjnego stanu sceny GM, nie pozostaje w tyle za zmianą i nie wskazuje "combat", gdy nie istnieje jeszcze starcie. `combatStyle` zawiera efektywny styl (`classic` albo `tactical`). `requestCombat()` prosi Engine o wygenerowanie starcia tym samym przebiegiem co ręczny przycisk Start Combat, ale bez potwierdzenia, ponieważ własny interfejs Experience już wyraził zamiar. Przebieg generowania w Engine nadal decyduje, czym będzie starcie. Celowo nie istnieje sposób, by pakiet bezpośrednio dostarczył walczących lub stan walki - walka pozostaje własnością Engine.

`requestCombat()` ma stabilną tożsamość, pozostaje ciche na ścieżce pakietu i zwraca kod, z którego Experience renderuje własny komunikat: `"started"` albo odmowę - `"combat-active"`, `"pending"` (generowanie już trwa), `"no-turn"` (GM nie napisał jeszcze tury) lub `"unavailable"` (zakończona sesja albo powtórka). `combatPending` i `combatError` odzwierciedlają postęp i błąd generowania, aby pakiet nie czekał na `combatActive` po nieudanym generowaniu. Podobnie jak interfejsy 1.7 i 1.8, ale inaczej niż ściśle ograniczone `contributions.assets` z 1.10, te właściwości trafiają do każdego pakietu `game-surface` niezależnie od zadeklarowanego `capabilityApi`. Etykieta 1.11 oznacza czas ich wprowadzenia; pakiet, który ich wymaga, deklaruje 1.11, a starszy Engine odrzuca go w kontrolowany sposób.

### Capability API 1.12: zdarzenia przestrzenne dla właściciela Experience

Capability API 1.12 adresuje zdarzenia możliwości przestrzennych również do pakietu Experience, do którego należy gra. `spatial_transition_committed`, `spatial_transition_rejected` i nietypowana wskazówka `spatial_context_refresh`, wcześniej kierowane wyłącznie do `hierarchical-maps` w zdarzeniu okna `marinara-capability-server-event`, są teraz wysyłane również z `packageId` równym `gameExperienceId` czatu. Ładunki różnią się między zdarzeniami: zatwierdzone zdarzenie zawiera `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; odrzucone zawiera `{ chatId, commandId, code?, message? }` bez pól lokalizacji, ponieważ ruch nie nastąpił; wskazówka odświeżenia zawiera `data: null`. Experience, które wysłało polecenie podróży przez argument `pendingSpatialTransition` funkcji `sendMessage`, może potwierdzić lub usunąć podróż, gdy tylko host zna wynik, zamiast wnioskować z późniejszego odczytu. Wersja 1.12 zamyka też lukę dotyczącą World Maps: przejścia odrzucone przez jedną z dwóch cichych ścieżek HTTP - zatwierdzenie tury właściciela przed strumieniowaniem w generowaniu albo samodzielne zatwierdzenie REST - nie tworzyły wcześniej żadnego zdarzenia. Obie ścieżki tworzą teraz `spatial_transition_rejected`, wyłącznie przy rozstrzygającym dowodzie, czyli kodzie błędu `spatial_*` innym niż `already_applied`. Nierozstrzygające awarie, jak błąd sieci, który mógł zgubić udane zatwierdzenie, wysyłają zamiast tego nietypowaną wskazówkę `spatial_context_refresh`, aby odbiorcy uzgodnili stan z serwerem, zamiast przyjmować wymyślony werdykt. Zatwierdzone zdarzenie z `travel.mode` równym `"step_by_step"` i `complete: false` oznacza, że podróż trwa dalej; zachowaj stan oczekujący do zdarzenia kończącego. To miękki interfejs jak 1.11: zdarzenia są dostarczane niezależnie od zadeklarowanego `capabilityApi`. Deklaruj 1.12 tylko wtedy, gdy pakiet tego wymaga.

### Capability API 1.13: tymczasowe zwijanie narracji

Capability API 1.13 dodaje `requestsCollapsedNarration` do deklaracji interfejsu, którą pakiet `game-surface` przekazuje do `setExperienceChrome`. Gdy flaga ma wartość true, pole narracji w Game Mode zwija się do wąskiego uchwytu, aby Experience mogło odsłonić ekran na przerywnik filmowy lub pełnoekranową scenę.

To ŻĄDANIE, a nie preferencja. Ustawienie zwinięcia wybrane przez gracza nigdy nie jest zapisywane, a flaga działa tylko wtedy, gdy Experience jest aktywną powierzchnią. Usuń flagę albo przestań być aktywną powierzchnią, a pole wróci do wyboru gracza. To gwarancja, że później zawsze otworzy się ponownie; pakiet celowo nie może utrwalić zwinięcia.

Zasady bezpieczeństwa Engine mają pierwszeństwo. Pole jest przymusowo rozwijane zawsze, gdy widać pole tekstowe gracza, także na samym początku sceny przed powstaniem segmentu, oraz gdy działają kontrolki przejścia do kolejnego segmentu. Są one jedynym sposobem zakończenia tury; pakiet, który mógłby je ukryć, mógłby trwale zablokować gracza. Uchwyt nadal pokazuje wskaźnik uwagi przy oczekującej analizie sceny, generowaniu lub ponownej próbie generowania walki. Jeśli gracz rozwinie pole ręcznie podczas żądania, pozostaje ono otwarte do zakończenia żądania. Podobnie jak interfejsy 1.11 i 1.12 jest to miękki interfejs: pole działa niezależnie od zadeklarowanego `capabilityApi`. Etykieta 1.13 oznacza czas wprowadzenia, więc pakiet, który go wymaga, deklaruje 1.13.

### Capability API 1.14: powierzchnie trackerów i cykl życia agenta

Capability API 1.14 dodaje dwie wartości `contributions.slots` dla aktywnych, włączonych pakietów agentów Roleplay z punktem wejścia klienta:

- `roleplay-tracker` montuje widok `toolbar` pakietu w HUD Roleplay. Jego właściwości obejmują `chatId`, `chatMode`, `mobileCompact`, klasę hosta `toolbarButtonClass`, `onRerunTracker`, `trackerRetryBusy`, `lockMode` i `onToggleLockMode`. Funkcje zwrotne są opcjonalne: sprawdź ich istnienie przed użyciem.
- `tracker-panel` montuje widok `tracker` pakietu wewnątrz istniejącego Tracker Panel, z `chatId`, `chatMode` i `detached`. Używaj tej powierzchni hosta zamiast otwierać drugi panel. Oba sloty otrzymują też zwykłe właściwości tożsamości capability i lokalizacji.

Wkłady kontekstu promptu nadal rejestruje się przez `api.registerPromptContext` i wymagają uprawnienia `prompt-context`. Żądanie udostępnia teraz `targetCharacterIds`, `personaId` i `placedAgentTypes` (opcjonalne dla zgodności). `placedAgentTypes` mówi autorowi wkładu, które sekcje danych agentów preset już umieścił, aby uniknąć powtarzania kontekstu. Host zachowuje tożsamość pakietu każdego wkładu w `packageBlocks`, umieszczając tekst pakietu w odpowiedniej sekcji agenta. Autor zwracający tekst dla określonej grupy odbiorców powinien respektować podane identyfikatory postaci docelowych.

Punkt wejścia serwera może też rejestrować własną usługę cyklu przetwarzania końcowego przez `api.registerService("agent-runtime:<package-id>", service)`. Wymaga uprawnienia `agent-runtime`; rejestracja pod identyfikatorem innego pakietu jest odrzucana. Opcjonalne haki to:

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` działa przed przetwarzaniem końcowym; wynik różny od null należy do danego agenta i trafia do jego promptu jako serializowany kontekst środowiska. `finalizeResult` otrzymuje tę wartość oraz wygenerowany wynik i zwraca `AgentResult`. Generowanie i ręczne ponawianie odkładają publikację wyniku do finalizacji. Każdy asynchroniczny hak ma dwusekundowy termin: błąd przygotowania jest logowany i pomijany, a błąd finalizacji zamienia wynik w niepowodzenie zamiast stosować niesprawdzone dane. To krótkie haki cyklu hosta, nie miejsce na dodatkowe powolne wywołanie modelu.

Te dodatki nie mają bramki wersji 1.14 dla poszczególnych pól. Pakiet może wykrywać opcjonalne właściwości i ograniczać działanie w starszym Engine, ale jeśli wymaga slotów, rozmieszczenia lub cyklu życia, musi deklarować `capabilityApi: { major: 1, minor: 14 }` w manifeście v2, aby starszy Engine poprawnie odmówił instalacji.

### Capability API 1.15: bieżąca konfiguracja embeddingów

`api.runtime.resolveEmbeddings()` zwraca nowe `Promise<CapabilityEmbeddingHost>` według bieżącej konfiguracji połączenia agenta pakietu. Wywołuj je na początku operacji embeddingów zamiast zapamiętywać `api.runtime.embeddings`: to migawka z aktywacji, która bez ponownej aktywacji nie śledzi zmian połączenia.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

Zwrócony host ma `spaceId`, `label` i `embed(texts, signal?, inputType?)` (typ danych wejściowych opisuje Capability API 1.68). Rozwiązywanie korzysta ze skonfigurowanego źródła embeddingów, a gdy żadne nie jest dostępne lub konfiguracja zawodzi, wraca do wbudowanego lokalnego MiniLM. `embed` może zwrócić `null`; puste partie, ponad 128 tekstów lub ponad 200 000 znaków łącznie są odrzucane. Nowy host nie przelicza istniejących wektorów, więc pakiet musi obsłużyć zmianę `spaceId`, zanim porówna nowe wektory z zapisanymi.

W bieżącym Engine metoda jest dostępna niezależnie od wersji API deklarowanej przez pakiet. Zadeklaruj API 1.15, jeśli wymagane jest śledzenie zmian połączenia. Pakiet celowo wspierający starsze Engine może sprawdzić `typeof api.runtime.resolveEmbeddings === "function"` i wrócić do `api.runtime.embeddings`, akceptując ograniczenie migawki z aktywacji.

### Capability API 1.16: czasowniki Game Master deklarowane przez pakiet

Capability API 1.16 pozwala pakietowi Experience deklarować krótką, zamkniętą listę nazwanych działań Game Master – czasowników – które Engine umieszcza w przypomnieniu formatu GM, odczytuje z gotowej narracji i wykonuje w imieniu pakietu. Nie uruchamia to żadnego kodu serwerowego pakietu, więc Experience `game-surface` z samymi punktami wejścia `agents` i `client` także może zmieniać świat słowami GM.

Działa cały interfejs: schemat, reguły nazw zastrzeżonych i własności kluczy, czytnik tabeli, renderowanie promptu i wykonawca. Pakiet z tabelą i `chat-write` ma swoje czasowniki w przypomnieniu GM w każdej turze Game powiązanego czatu, a Engine wykonuje użyte przez GM czasowniki. Czat bez pakietu albo z pakietem bez tabeli nie rozwiązuje żadnych czasowników; jego tura jest identyczna bajtowo z turą sprzed wprowadzenia interfejsu.

Pakiet deklaruje tabelę jako `gm-verbs.json`, wymienia ją w `contributions.assets.paths` i przypina haszem w `files[]`, jak każdy zasób. Wykrywanie opiera się na tej zastrzeżonej nazwie pliku, co jest nową konwencją: wszystkie inne pliki w potoku pakietu są zadeklarowanymi ścieżkami czytanymi po nazwie (`entrypoints`, ścieżki ikon, ścieżki zasobów), niczego innego nie wyszukuje się po kształcie. Ta droga ma dwie istotne konsekwencje. Plik obecny w `files[]`, lecz pominięty w `contributions.assets.paths`, nie powoduje błędu ani podczas instalacji, ani budowania katalogu: pakiet po prostu nie ma czasowników i nigdzie nie ma diagnostyki. Zadeklarowany zasób jest też udostępniany bez ochrony pod `/api/capability-packages/<id>/assets/gm-verbs.json`, bo trasa zasobów nie sprawdza dostępu uprzywilejowanego; tabela nigdy nie może zawierać danych poufnych. Jak 1.11–1.13, to miękki interfejs: starszy Engine widzi zwykły zasób JSON i go ignoruje, więc tabela nie musi zawężać zgodności instalacji. Zadeklaruj `capabilityApi` 1.16 tylko wtedy, gdy pakiet _wymaga_ działania czasowników: deklaracja odrzuca instalację w każdym starszym Engine.

Dokument ma postać `{ "schemaVersion": 1, "verbs": [ … ] }` i od jednego do szesnastu czasowników. Każdy czasownik jest ścisły: nieznany klucz w nim powoduje odmowę, nie ciche pominięcie dodatku. Nieznane pola obok `schemaVersion` i `verbs` są celowo obsługiwane inaczej przez dwie powierzchnie: czytnik Engine je usuwa, aby tabela dla nowszego Engine nadal dostarczała rozumiane czasowniki; wspólny schemat dokumentu dla narzędzi autorskich jest ścisły i je odrzuca. Walidacja według schematu jest więc surowsza niż zachowanie Engine w czasie działania, co pomaga podczas tworzenia tabeli:

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

Nazwa czasownika pasuje do `[a-z][a-z0-9_]*`, ma do 32 znaków i nie może być własnym tagiem GM w nawiasach Engine. Kontrola ignoruje wielkość liter: przypomnienie renderuje `[Note:` i `[Book:` wielką literą, a dostarczone wyrażenie regularne parsera nie rozróżnia wielkości, więc czasownik `note` przesłoniłby tag dziennika. Zbiór nazw zastrzeżonych pochodzi ze wszystkich tagów renderowanych przez przypomnienia GM i drużyny we wszystkich wariantach oraz ze wszystkich tagów, które pięć parserów narracji Engine odczytuje z gotowej tury: parser tagów klienta i formater narracji klienta, edytor segmentów serwera, analizator scen sidecar i przepisujący dialogi kod trasy generowania. Ich słownik jest szerszy niż przypomnienia: obejmuje tokeny dialogowe `main`, `side`, `extra`, `action`, `thought` i `whisper` oraz parę QTE `qte_bonus` / `qte_result`, którą rozpoznaje tylko formater narracji. Ta ostatnia grupa pokazuje sens zabezpieczenia: czasownik `whisper` spowodowałby wycięcie `[whisper:Tam]` z dialogu przed zapisem tury i wiersz trwale przestałby być dialogiem. Chroni to regresja, łącznie z ekstraktorami: parser dostarczający wyłączną nazwę – `party-chat` / `party-turn` z parsera tagów czy parę QTE formatera – musi nadal ją dostarczać; ciche wypadnięcie źródła przerywa kompilację zamiast zwężać ochronę. Trzy źródła bez wyłącznych nazw też są skanowane, aby wychwycić tag, który pojawi się najpierw w jednym z nich. Nie gwarantuje to kompletności: tag w nowym, nieskanowanym pliku lub w nierozpoznawanej postaci nadal umknie, więc przy nowym parserze trzeba rozszerzyć zbiór. Zwykłe słowa też są zastrzeżone: `action`, `state`, `status` i `note` to tagi wbudowane, więc odmowa dla zwykłego czasownika zwykle wynika z tej reguły, nie literówki. `description` ma jedną linię, 1–200 znaków, bez nawiasów kwadratowych i znaków końca linii, bo trafia dosłownie do wiersza czasownika w bloku `COMMANDS:`. Koniec linii obejmuje poza CR i LF także `U+0085`, `U+2028` i `U+2029`, które kończą linię dla czytników bloku. Odrzucane są też kontrolne C0 i DEL – najczęściej tabulator – zmieniające kształt bloku bez kończenia linii. Dosłowność dotyczy bloku, lecz nie późniejszego rozwijania makr: całe przypomnienie przechodzi ten etap przed wysłaniem, więc `{{…}}` w opisie rozwija się zamiast drukować, także makra _zapisujące_ zmienne czatu, np. `{{setvar::…}}`. Uprawnienie `chat-write` już daje pakietowi taki zakres, ale łatwo użyć go przypadkiem; pomijaj klamry makr, jeśli nie są zamierzone. Czasownik przyjmuje do sześciu argumentów, każdy `{ name, type, enum?, maxLength?, optional? }`, nazwanych według `[a-z][a-zA-Z0-9_]*` do 32 znaków. To celowo szersze niż nazwa czasownika bez wielkich liter, bo argument jest kluczem JSON, nie tagiem. Tylko argument tekstowy może mieć `enum` (1–16 różnych wartości: powtórzenia nic nie dodają i są odrzucane jak inne duplikaty tabeli). Tekst _bez_ enum musi określać `maxLength` (1–500), bo lokalne parsowanie wykonawcy nie ma własnego limitu i dowolny tekst mógłby wciągnąć cały fragment narracji do pakietu. Połączenie `enum` i `maxLength` jest odrzucane, bo enum już ogranicza wartość. Dane są płaskim, jednoliniowym JSON – zagnieżdżone `}` przedwcześnie kończy dopasowanie tagu. Parsuje się jedno wystąpienie nazwy czasownika na wiadomość, więc powtórzony czasownik stosuje się raz.

Nie musisz opisywać tych zasad w opisie. Wiersz przypomnienia powstaje z odczytanej tabeli: schemat danych, potem opis, potem jeden przykład do skopiowania:

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

Schemat uczy słownika: pokazuje każdy argument w kolejności deklaracji, opcjonalne oznacza `"name"?:` poza tekstem JSON, enum przedstawia jako wszystkie alternatywy, tekst bez enum jako limit, a liczbę lub wartość logiczną bez cudzysłowów, bo walidator odrzuca `"3"` jako liczbę zamiast ją konwertować. Przykład jest jednym konkretnym przypadkiem i pokazuje tylko jedną wartość enum, dlatego sam nie wystarcza do nauki: GM widzący tylko `{"word":"fair"}` pisze "sunny", walidator odrzuca niepokazane słowo, a odmowa jest niewidoczna. Tag usuwa się po dopasowaniu nazwy, nie po pomyślnej walidacji, więc narracja wygląda poprawnie, lecz świat się nie zmienia. Wyprowadzanie obu części z jednej odczytanej tabeli zapobiega rozbieżności: opis nie obiecuje wartości odrzucanej przez walidator, bo nie przechowuje już wartości. Przeznacz 200 znaków na _kiedy_ użyć czasownika, nie powtarzanie argumentów.

Degradacja jest osobna dla czasowników. Nieużywalny czasownik – nowszy `effect`, niereprezentowalna postać lub odrzucana deklaracja, np. zastrzeżona nazwa albo cudzy klucz – jest pomijany z wpisem w logu, a wszystkie rozumiane nadal działają. Tak samo `parseCapabilityCatalogWithCompat` traktuje wpisy katalogu. Odmowa jest więc cicha, nie głośna: czytaj log, gdy zadeklarowany czasownik się nie pojawia. Cały nieużywalny dokument (nieznany `schemaVersion`, puste `verbs`, wartość niebędąca obiektem) daje pustą tabelę i jeden wpis logu. Tabela jest też odrzucana jeszcze przed odczytem według _zadeklarowanego_ `files[].bytes` przy 64 KB, bo `files[]` dopuszcza do 100 MB i nic innego nie ogranicza zasobu przed odczytem. W każdym przypadku tura pozostaje nietknięta.

Czasownik deklarujący `metadataKey` jest **czasownikiem stanu**: wszystkie argumenty zapisują się pod tym kluczem w wierszu metadanych czatu, a pakiet widzi zmianę przez istniejące właściwości. Bez `metadataKey` jest **czasownikiem zdarzenia**: trafia na żywo jako zdarzenie klienta capability, bez trwałego zapisu, kolejki, odtwarzania i potwierdzenia. `metadataKey` jest odrzucane dla zdarzenia, aby nie zajmowało klucza, którego nigdy nie zapisze, i wymagane dla stanu.

Przed wyborem poznaj różnice. Zapis stanu jest trwały i nigdy się nie cofa: przełączenie wariantu, edycja lub usunięcie tury zostawiają wartość, więc wygrywa ostatni wariant _wygenerowany_, nie ostatni _wyświetlony_. Narracja i świat mogą się rozchodzić w sesji bez mechanizmu uzgodnienia. Zdarzenie nie ma żadnej pamięci: jedna klatka, jedna synchroniczna emisja. Ginie po cichu przy przerwaniu tury, zamknięciu lub przeładowaniu karty w trakcie strumienia, emisji przed pierwszym montowaniem pakietu, przełączeniu gracza na inny czat i blokadzie ładowania samego pakietu. Nie ma ponownego dostarczenia. W zamian efekt zdarzenia cofa się z historią, jeśli pakiet przechowuje go tam, gdzie cofnięcie odbudowuje stan; zapis metadanych czatu tego nie potrafi. Utrata bez żadnego śladu zachodzi, gdy zdarzenie zastosowano do stanu na żywo, a twarde przeładowanie nastąpiło przed kolejnym zapisem pakietu.

Dlatego obie odmiany celowo odrzucają semantykę względną. Czasownik stanu nie może wyrazić "dodaj pięć sztuk złota", bo zapis jest bezwzględnym nadpisaniem. Względne _zdarzenie_ jest zabronione regułą, bo regeneracja nadaje nowy indeks wariantu bez znaczników poprzedniego, więc efekt narasta raz na każdy wygenerowany wariant. Deduplikacja po `chatId:messageId:swipeIndex` chroni ponowne dostarczenie, którego ten kanał i tak nie wykonuje, ale nie regenerację, którą wykonuje. Bezpieczne dwukrotne zastosowanie zapewnia bezwzględność, nie księga zapisów. Względny słownik można tu stosować dopiero po przekształceniu go w bezwzględny dla każdej wiadomości.

W turze zawierającej oba rodzaje synchroniczna emisja zdarzenia dociera do pakietu _przed_ asynchronicznym ponownym pobraniem zapisu stanu. Obsługa zdarzenia nie może oczekiwać nowej wartości czasownika stanu z tej samej tury.

Asymetria odmów jest zamierzona. Engine sprawdza tylko postać – nazwy argumentów, typy, przynależność do enum i limity tekstu – bo znaczenie należy do pakietu: nie da się wyliczyć nazw NPC w deklaracji, gdy świat kompiluje się osobno dla czatu. Odmowa pakietu dla stanu jest więc _doradcza_, bo metadane są już zapisane, zanim pakiet je zobaczy. Dla zdarzenia jest _wiążąca_: Engine niczego nie zapisał, więc odrzucenie nieznanej nazwy rzeczywiście blokuje efekt.

`metadataKey` stanu musi należeć do deklarującego pakietu według trzech reguł. Klucz zaczyna się identyfikatorem pakietu przekształconym na camel case (`hierarchical-maps` → `hierarchicalMaps`), ma niepusty dalszy człon zaczynający się wielką literą, co zapobiega podszywaniu się prefiksem pod inny pakiet, a znormalizowany identyfikator nie może być przestrzenią metadanych Engine ani rozszerzać jej na granicy wielkiej litery. Lista tych przestrzeni pochodzi ze wszystkich kluczy najwyższego poziomu `ChatMetadata`, stałych kluczy Engine i kluczy należących do sygnatury indeksowej interfejsu zamiast jego deklaracji: `encounterActive`, `internalAssistant`, `imageGenConnectionId` i reszty niezadeklarowanych metadanych, których dwa pierwsze źródła nie widzą. Trzecia grupa wymaga siedmiu źródeł, bo Engine zapisuje i czyta metadane na różne sposoby: obiekt przekazany do `patchMetadata`/`updateMetadata`; obiekt _zwracany_ przez funkcję aktualizującą (równie częsty); mutacja klienta `useUpdateChatMetadata()` i właściwość `onMetadataChange` (w ogóle nie używają `patchMetadata`); bezpośrednie wywołania klienta `PATCH /chats/:id/metadata` (pomijają też ten hak; Game zapisuje tak klucze walki, sceny i narracji); odczyty właściwości `chatMetadata.key` i `chat.metadata.key`; odczyty wyniku `parseChatMetadata(…)` – najczęstszy idiom Engine i jedyny widzący np. `scenario`; wreszcie ręczna lista kluczy metadanych poszczególnych czatów dla profili ustawień, która wyłapuje klucze zapisywane i czytane wyłącznie przez granice funkcji.

Wszystko to chroni regresja, łącznie z ekstraktorami. Dwa przypadki celowo pozostają poza skanowaniem. Zapis otrzymujący zmienną albo wynik funkcji pomocniczej (`patchMetadata(id, hydratedMeta)` lub ten sam kształt na trasie metadanych) zapisuje klucze niewidoczne dla analizy statycznej; dziś takich wywołań jest dwadzieścia i regresja przypina tę liczbę, więc dwudzieste pierwsze przerywa kompilację do ręcznego sprawdzenia. Odczyt _wewnątrz_ funkcji pomocniczej z parametru jest międzyproceduralny i poza zasięgiem skanowania odczytów: tak działa `spatialContext`, zapisywany przez klienta pakietu `hierarchical-maps` z repozytorium Agents, a odczytywany tutaj przez funkcję pomocniczą i parser lokalny dla pliku. Drugą lukę zamyka ręczna lista, dlatego jedno z siedmiu źródeł jest utrzymywane ręcznie. Mechanizm jawnie nazywa ograniczenia. `persona` jest ręcznie dodanym minimum, którego dziś nie dostarcza żadne źródło. Trzecia reguła celowo odrzuca całe pakiety: `conversation-calls` normalizuje się do `conversationCalls`, a `conversationCalls` + `Enabled` to istniejący klucz Engine, więc pakiet nie może posiadać metadanych pod własnym identyfikatorem. `noodle` i `background` mają ten sam problem; `background` samo jest kluczem metadanych Engine. Nadal mogą deklarować zdarzenia, które nie posiadają klucza. Klucze są płaskie i najwyższego poziomu, bo właśnie tak czyta je istniejący mechanizm uzgadniania pakietu.

Czasowniki działają tylko dla zainstalowanego, gotowego pakietu z `chat-write`. Uprawnienie to obejmuje też zapis przez API trwałości pakietu: wiadomości, metadane czatu, zdarzenia roleplay i migawki przestrzenne. `chat-read` ogranicza odczyty czatu, wiadomości, stanu gry i migawek przestrzennych. Te same kontrole działają w transakcjach i blokadach czatu; zapis nie daje automatycznie odczytu. Własne wywołania trwałości Engine pozostają zaufane.

Widok szczegółów **Download Agents** (pobierz agentów) po instalacji pokazuje uprawnienia zadeklarowane przez zainstalowaną wersję. Jeśli wersja katalogowa żąda innych, pokazuje je osobno. Instalacja i aktualizacja kodu nadal wymagają istniejącej zgody związanej z dokładną wersją i sumą kontrolną; polecenia modelu nie proszą o osobną zgodę w każdej turze.

To kontrole API, nie piaskownica JavaScript. Uprawnienia sieci, przechowywania i UI są deklaracjami dostępu. Kod pakietu w przeglądarce i serwerze pozostaje zaufany i ma dostęp do środowiska hosta; instaluj tylko zaufane pakiety. Sprawdzana jest gotowość, nie możliwość udostępnienia zasobów: aktualizacja pozostawiająca `restart-required` zatrzymuje rozwiązywanie czasowników do restartu Engine.

### Capability API 1.17: przygotowanie Experience przed pierwszą turą

Pakiet `game-surface` może zadeklarować `contributions.gameSurface.prepareBeforeStart: true` przy schemacie w wersji 2 i Capability API 1.17. Engine montuje tę powierzchnię, gdy gra jest gotowa, zanim włączy **Start Game** (Rozpocznij grę). Klasyczne gry i pakiety bez tej flagi zachowują dotychczasowy przebieg uruchamiania.

Główna powierzchnia, która włącza tę opcję, otrzymuje dwie dodatkowe właściwości:

- `startup: boolean` pozostaje true, dopóki gracz nie zakończy wprowadzenia Engine przyciskiem **Continue** (Kontynuuj). W tym czasie wstrzymaj symulację świata i działania gracza.
- `setStartupReady(context: string | null): void` zgłasza stan przygotowania. Wysyłaj `null` podczas ładowania, zapisywania lub wychodzenia z błędu. Wyślij ciąg znaków dopiero wtedy, gdy faktyczny świat jest trwale zapisany i gotowy do użycia; pusty ciąg pozwala rozpocząć bez dodatkowego kontekstu.

Host blokuje **Start Game**, potwierdzenie przygotowania widgetów i ponowne próby pierwszej tury, dopóki nie otrzyma ciągu oznaczającego gotowość. Podczas blokady własny interfejs ładowania oraz błędu i ponowienia pakietu pozostaje widoczny. Po uzyskaniu gotowości pakiet jest ukryty za zwykłym wprowadzeniem Engine. **Continue** otwiera zwykłą powierzchnię, która może zostać zamontowana ponownie: zadbaj o idempotentne przygotowanie świata i odtwarzaj zapisany stan zamiast generować go od nowa. Powrót do gry, w której wprowadzenie już się zakończyło, nie powtarza przygotowania startowego.

Kontekst otwarcia ma limit **8 000 znaków**. Niepoprawny lub zbyt długi kontekst nadal blokuje start i wyświetla błąd; host nie ucina faktów o świecie. Przekaż krótki opis przygotowanej lokacji początkowej i faktycznie obecnych tam postaci. Engine dołącza ten tekst do istniejącego `generationGuide` pierwszej tury ze źródłem `game_start`, aby otwarcie korzystało ze świata, który już istnieje. Nie rejestruje to kontekstu dla późniejszych tur; dla nich nadal używaj zwykłego wkładu pakietu do promptu lub kontekstu generowania tury.

Wywołania zwrotne gotowości należą do zamontowanego czatu, gry i pakietu. Spóźnione wywołania z innego zakresu są ignorowane. Błąd modułu lub środowiska uruchomieniowego blokuje start, zamiast uznawać brak kontekstu świata za sukces. Po przeładowaniu pakiet musi zgłosić gotowość na podstawie zapisanego świata. Serwerowy dostawca kontekstu promptu nadal działa tylko do odczytu i ma krótki limit czasu; nie używaj go do generowania świata ani jako długotrwałej blokady startu.

### Capability API 1.19: narzędzia udostępniane przez pakiety

Capability API 1.16 pozwalało pakietowi nakłonić model, by coś _powiedział_, a następnie na to zareagować. Ta wersja pozwala modelowi coś _wywołać_. Pakiet z nowym uprawnieniem `tools` rejestruje nazwane narzędzie w serwerowym punkcie wejścia. Engine udostępnia je obok wbudowanych narzędzi w każdej turze każdego czatu, sprawdza wywołanie według JSON Schema pakietu i przekazuje argumenty do jego funkcji obsługi.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

Wywołania narzędzi zamiast formatu odpowiedzi to świadomy wybór. Format zajmuje całą odpowiedź: narracja musiałaby trafić do pola obiektu JSON i nie mogłaby być strumieniowana. Wywołanie narzędzia może towarzyszyć tekstowi, gdy model pisze swoją turę. Pakiet otrzymuje argumenty, które dostawca już ograniczył, zamiast wydobywać je z gotowej narracji. Schemat wymusza reguły; konwencja tylko prosi model o ich przestrzeganie.

Widać to przy wyliczeniach. Pakiet znający dwanaście miejsc może wpisać ich nazwy do schematu. Trzynasta nazwa zostanie odrzucona, zanim dotrze do funkcji obsługi. Istniejący walidator argumentów w Engine wskazuje poprawne wartości, więc model może skorygować wywołanie. Wartość zwrócona przez funkcję obsługi trafia do modelu jako wynik narzędzia.

Zanim napiszesz narzędzie, poznaj te zasady:

- Nazwy mają postać `<packageId>_<name>`, a `-` jest zastępowany przez `_`: `set_time` z pakietu `world-clock` dociera do modelu jako `world_clock_set_time`. Nazwa zajęta przez inny pakiet jest odrzucana. Narzędzia wbudowane i włączone narzędzia niestandardowe zachowują kolidujące nazwy; definicja pakietu jest pomijana. Pełna nazwa może mieć najwyżej **64 znaki**. Definicje i wykonanie stosują tę samą kolejność: wbudowane, niestandardowe, pakietowe.
- Narzędzia są dołączane przez cały czas aktywności pakietu. Nie ma dodatkowego przełącznika dla czatu, jak przy narzędziach wbudowanych: decyzją jest nadanie uprawnienia i rejestracja. Wybrany dostawca musi obsługiwać natywne wywołania narzędzi.
- Schemat parametrów jest kopiowany i kompilowany podczas rejestracji. Jeśli Engine nie potrafi go skompilować, aktywacja kończy się błędem widocznym podczas pracy nad pakietem, zamiast przerywać turę.
- Wyjątek w funkcji obsługi oznacza nieudane wywołanie i jest zapisywany w logach; jego treść nie trafia do modelu. Po **10 sekundach** bez wyniku tura również przestaje czekać. Funkcja nadal działa, ale nie blokuje całej tury.
- Wyniki muszą dać się zserializować do najwyżej **64 KiB**. Większy wynik lub brak możliwości serializacji powoduje błąd wywołania, zamiast wypierać rozmowę z kontekstu. Opisy i wyniki są zaufaną treścią pakietu. Sprawdź `chatId`, zanim odczytasz lub zmienisz dane czatu.
- Każda definicja jest serializowana w żądaniu do dostawcy przy każdej turze i uwzględniana przy dopasowaniu kontekstu. Limity wynoszą **16 narzędzi na pakiet**, **64 we wszystkich pakietach**, **512 znaków** opisu i **8 KiB** schematu parametrów. Przekroczenie limitu zgłasza wyjątek i uniemożliwia aktywację. Ponowna rejestracja własnej nazwy zastępuje narzędzie bez zajmowania kolejnego miejsca.
- Kontekst aktywacji przestaje działać po jej zakończeniu. Jeśli pakiet zachowa `api` i później wywoła `registerTool` z callbacku, wywołanie zostanie odrzucone. Zakończone środowisko nie może rejestrować narzędzi ani zastępować narzędzi nowej aktywacji.
- Dezaktywacja, aktualizacja i usunięcie pakietu zwalniają jego narzędzia. Model nie otrzyma narzędzia, którego pakiet nie może już odpowiedzieć. Narzędzia są usuwane przed oczekiwaniem na sprzątanie; każdy callback sprzątający ma limit 8 sekund.

Te limity dotyczą wyłącznie oczekiwania asynchronicznego. Pakiety działają jako zaufany kod w procesie serwera; timer nie może przerwać pracy synchronicznej blokującej pętlę zdarzeń. Wymuszone anulowanie wymagałoby osobnego workera lub procesu, czego ten interfejs API nie zapewnia.

`api.registerTool` istnieje dopiero od tej wersji Engine. Pakiet, który go potrzebuje, musi zadeklarować `capabilityApi` 1.19 i nie zainstaluje się w starszej wersji.

## Instrukcje decyzyjne i model decyzyjny

**Decision model** (model decyzyjny) użytkownika odpowiada tak/nie i wybiera odpowiedzi na stwierdzenia o niedawnym czacie. [Modele decyzyjne](../connections/decision-models.md) wyjaśniają, czym jest i jak go skonfigurować.

Szablon promptu agenta dostarczony przez pakiet może używać instrukcji decyzyjnych tak samo jak własny agent użytkownika: `{{#if decision:"..."}}` i `{{#if decision_choice:"..." == "..."}}`. Engine znajduje je w szablonie, pyta o nie przed uruchomieniem agenta (po odpowiedzi dla agenta przetwarzania końcowego) i rozwiązuje szablon według odpowiedzi. Nie zależy to od wersji API możliwości. [Prompty warunkowe](../prompts/conditional-prompts.md#asking-the-decision-model) opisują składnię i formułowanie pytań, a [Tworzenie własnych agentów](../agents/custom-agents.md#decision-statements-in-the-agents-prompt) wyjaśnia, jak czytają je fazy agentów.

Kod serwerowy pakietu może też zadawać skonfigurowanemu modelowi decyzyjnemu użytkownika ograniczone pytania tak/nie oraz Choice o kontekst dostarczony przez pakiet, przez `api.runtime.decisions.evaluate(...)`. Używa tego samego modelu decyzyjnego co pytania aktywacyjne agentów i warunki w promptach (zarządzany model lokalny albo połączenie decyzyjne) i nigdy nie ujawnia kluczy ani wnętrza Engine. `decisions` jest opcjonalne i nie wymaga nowszego API możliwości ani uprawnienia: sprawdź `typeof api.runtime.decisions?.evaluate === "function"` i w starszych wersjach Engine użyj zachowania zastępczego.

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages` to własny kontekst pakietu, od najstarszej wiadomości (najwyżej 200 wiadomości i 200 000 znaków; `name` wiadomości ma najwyżej 100 znaków). Najstarsze wiadomości są odrzucane, żeby zmieściły się w modelu.
- Każde `question` ma najwyżej 500 znaków; identyfikatory muszą być unikalne. Pytanie Choice ma co najmniej dwie `options`, a odpowiedzią jest jedna z nich albo `"none of these"`.
- Jedno żądanie może pytać najwyżej o tyle odpowiedzi, ile wynosi limit **Decision statements per turn** (stwierdzenia decyzyjne na turę) użytkownika; każda opcja Choice liczy się raz, plus jeden. Nieprawidłowe żądanie zgłasza `TypeError`.
- `answers` zawiera prawdopodobieństwo odpowiedzi tak dla każdego pytania tak/nie, a pytanie, którego w nim brakuje, nie otrzymało odpowiedzi. Porównuj je z `threshold`, własnym punktem pracy modelu: prawdopodobieństw nie da się porównywać między modelami decyzyjnymi.

Projektuj każde użycie także dla użytkownika bez modelu decyzyjnego. Stwierdzenie bez odpowiedzi oznacza nie, więc gałąź `{{else}}` albo brak tekstu musi być rozsądną wartością domyślną. Pisz dla dowolnego modelu decyzyjnego zamiast wymagać Jev: lokalne modele czatu i inne obsługiwane zaplecza używają tej samej składni, lecz mogą odpowiadać inaczej. Zanim oprzesz działanie na określonym wyniku, liczbie żądań lub odpowiedzi z pamięci podręcznej, przeczytaj [Progi](../connections/decision-models.md#thresholds) oraz [Limity i koszt](../prompts/conditional-prompts.md#limits-and-cost).

### Uwaga dla twórców Experience w Game Mode

Walka Engine samodzielnie decyduje o działaniach zwykłych wrogów. Każdy przeciwnik niebędący bossem po stronie GM dostaje rolę wynikającą z umiejętności i klasy (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter lub controller), biegłość z poziomu, jeśli nie określił własnej (novice, trained, veteran lub master), oraz temperament, np. reckless, cautious, opportunistic lub protective. Beasts i monstrosities są zawsze mindless. Kod Engine wybiera je według ziarna bez wywołania modelu, a trudność gry zmienia konsekwencję działań zgodnych z typem. Tylko autorskimi bossami kieruje GM przez model. Zobacz [AI walki Game Mode](game-combat-ai-design.md).

Kolejne ulepszenia walki są w drodze. Zanim dodasz model decyzyjny do potoku walki, sprawdź, czy zwykła walka Engine już spełnia potrzeby. Jeśli wróg potrzebuje osobowości, najpierw nadaj mu właściwą biegłość i temperament. Decyzja w każdej turze wroga dodałaby pracę modelu i limit czasu, a przy hostowanym zapleczu także żądania sieciowe i opłaty. Walka zależałaby od odpowiedzi modelu, którego użytkownik mógł nie skonfigurować, więc potrzebowałaby rozsądnego zachowania bez odpowiedzi.

## Pakiety początkowe

- wszyscy dotychczas wbudowani agenci;
- hierarchiczne mapy przestrzenne dla trybów Roleplay i Game Mode;
- rozmowy audio i wideo w trybie Conversation;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

W podstawie zostaje menedżer pakietów, klient katalogu, ogólne kontrakty potoku agentów, ogólne kontrakty hosta gier turowych oraz puste interfejsy hosta. Konkretne implementacje należą do pakietów.

## Zaufanie i instalacja

Oficjalny katalog to wersjonowany dokument JSON o sprawdzanym schemacie, pobierany przez HTTPS. Każdy wpis wydania zawiera niezmienne adresy URL artefaktów, skróty SHA-256, rozmiary w bajtach, informacje o zgodności z silnikiem, uprawnienia oraz to, czy dane środowisko uruchomieniowe wymaga restartu.

Aktualizacje wymagają zgody użytkownika: poza jednorazowymi migracjami, które zachowują dawne wbudowane elementy zaktualizowanej instalacji (zobacz [Migracja zgodności](#compatibility-migration)), start serwera nigdy nie pobiera ani nie instaluje pakietu. `GET /api/capability-packages/updates/pending` wymienia każdy zainstalowany oficjalny pakiet, którego wersja w katalogu jest nowsza i zgodna z działającym silnikiem i z API możliwości, z pominięciem wersji, którą użytkownik już odrzucił. Klient pokazuje je w jednym oknie **Agent updates available** (dostępne aktualizacje agentów). **Update all** (aktualizacja wszystkich) instaluje każdy z nich zwykłym potokiem instalacyjnym, z przypięciem do oferowanej wersji i skrótu SHA-256 artefaktu. **Not now** (nie teraz) zapisuje odrzucone wersje w `DATA_DIR/capability-packages/update-decisions-v1.json` (`POST /api/capability-packages/updates/decline`), więc ta wersja nie jest proponowana ponownie, a nowsza już tak. Przycisk **Update** (aktualizacja) w obu przypadkach pozostaje dostępny w **Download Agents**. Awarie są izolowane osobno dla każdego pakietu. Gdy katalog jest niedostępny albo weryfikacja się nie powiedzie, dotychczasowe pliki i stan rejestru nadal działają, a niepowodzenie gotowości środowiska serwerowego korzysta ze ścieżki wycofania do poprzedniej wersji.

Informacje o wydaniu są publikowane jako `notes.json` obok opisywanego przez nie pliku `catalog.json`, nigdy wewnątrz wpisu katalogu ani manifestu: starszy Engine pomija wpis katalogu z kluczem, którego nie zna. Każda oczekująca aktualizacja zawiera w `releaseNotes` informacje o każdej wersji od wersji po zainstalowanej aż do oferowanej, od najnowszej, a `releaseHighlight` ma wartość true, gdy którakolwiek z nich jest oznaczona jako zmiana zauważalna dla użytkownika. Informacje są zwykłym tekstem i nigdy nie są renderowane jako Markdown ani HTML.

Instalator musi:

1. wymagać uprzywilejowanego dostępu przez pętlę zwrotną lub konto administratora;
2. wymuszać HTTPS, limity pobierania i limity czasu;
3. sprawdzić zaufanie do katalogu i skrót SHA-256 artefaktu jeszcze przed rozpakowaniem;
4. odrzucać ścieżki bezwzględne, przejścia w górę drzewa, dowiązania, pliki urządzeń i pliki niezadeklarowane;
5. sprawdzić poprawność manifestu i zgodność z silnikiem;
6. rozpakować pliki do tymczasowego folderu obok docelowego;
7. przeprowadzić atomową aktywację dopiero po udanej walidacji;
8. zachować poprzednią wersję do czasu, aż nowe środowisko uruchomieniowe wystartuje poprawnie;
9. wycofać aktywację w razie niepowodzenia;
10. nigdy nie uruchamiać skryptów instalacji, aktualizacji ani odinstalowania.

Oficjalny katalog włącza wyłącznie zaufane pakiety wykonywalne od twórców aplikacji. Przyszła ścieżka dla pakietów zewnętrznych wymaga osobnego, jawnego projektu zaufania.

## Środowisko uruchomieniowe i zachowanie przy restarcie

Serwer jest właścicielem rejestru zainstalowanych pakietów i udostępnia zainstalowane możliwości klientom. Moduły deklaratywne i przeładowywalne aktywują się natychmiast. Po aktywacji interfejs unieważnia zapytania o katalog, agentów, możliwości trybu i aktywny czat.

Manifest może deklarować `restartRequired` tylko wtedy, gdy host nie potrafi bezpiecznie przeładować danego punktu wejścia. Udana aktywacja na gorąco kończy się komunikatem `Agent installed. It is ready to use.` Aktywacja wymagająca restartu kończy się komunikatem `Agent installed. Restart Marinara Engine to finish setup.`

Pakiety gier turowych da się przeładować na gorąco: instalacja od razu rejestruje ich silnik serwerowy i ręczną komendę slash do uruchomienia, a odinstalowanie odłącza środowisko uruchomieniowe bez restartu aplikacji. Ustawienia Conversation Commands w danym czacie decydują wyłącznie o tym, czy postacie mogą wysyłać ukrytą komendę pakietu; nie blokują komendy slash uruchamianej ręcznie. Obecne oficjalne manifesty gier turowych zachowują zachowawczy, dawny znacznik restartu dla zgodności z silnikiem w wersji 2.x. Silnik w wersji 3.x rozpoznaje rodzaj `turn-game`, przeprowadza bezpieczną aktywację na gorąco i zwraca pakiet jako aktywny i gotowy do użycia.

### Miejsce na dysku: kopie uruchomieniowe i zachowywane wersje

Serwerowa część pakietu nie działa bezpośrednio z `DATA_DIR/capability-packages/versions/<id>/<version>`. Każda aktywacja weryfikuje zainstalowane pliki, kopiuje je do nowego folderu w `DATA_DIR/capability-runtime-snapshots` i importuje kopię. Kopia jest usuwana, gdy to środowisko uruchomieniowe się zatrzymuje.

- **Kopie uruchomieniowe.** Kopia zawiera każdy zweryfikowany plik z manifestu z wyjątkiem klienckiego punktu wejścia. Serwer nigdy go nie wczytuje, a przeglądarka pobiera go z `versions/`. Zasoby zostają, więc serwer może czytać pliki leżące obok jego `server.mjs`, tak jak Quartermaster czyta `icons/`. Skopiowane pliki są tylko do odczytu.
- **Sprzątanie przy starcie.** Po awarii albo wymuszonym zatrzymaniu sprzątanie kopii zostaje pominięte. Przy każdym starcie, zanim aktywuje się jakikolwiek pakiet, silnik usuwa każdy wpis w `capability-runtime-snapshots` z wyjątkiem współdzielonych dowiązań `node_modules`, bo żaden z nich nie może być używany przez nowy proces. Najpierw zdejmuje z plików atrybut tylko do odczytu, czego wymaga system Windows, i nigdy nie podąża za dowiązaniami. Do tego kroku dochodzi tylko proces, który trzyma dzierżawę zapisu do magazynu danych, więc drugi silnik uruchomiony na tym samym folderze danych zatrzymuje się przy otwieraniu magazynu i nigdy nie usuwa kopii działającego silnika.
- **Zachowywane wersje.** `versions/<id>` przechowuje bieżącą wersję i `previousVersion`, którą przywraca wycofanie, gdy nowe środowisko serwerowe nie wystartuje. Starsze wersje oraz wersja, z której wycofano nieudaną aktualizację, są usuwane po udanej aktywacji lub aktualizacji oraz przy starcie. Pakiet, którego aktualizacja czeka na restart (`restart-required`) albo którego środowisko uruchomieniowe jeszcze nie wystartowało (`readiness: "pending"`), zachowuje wszystkie wersje, dopóki nie wystartuje.
- **Nigdy nieusuwane:** dane pakietów (foldery takie jak `DATA_DIR/long-term-memory` i tabele pakietu w `storage`), czaty, ustawienia, `installed.json`, decyzje o aktualizacjach, foldery `.install-*` oraz foldery w `versions/` dla identyfikatorów, których nie ma w rejestrze. Odinstalowanie nadal usuwa kod pakietu i zachowuje jego dane.

<a id="compatibility-migration"></a>

## Migracja zgodności

Przy pierwszym uruchomieniu po aktualizacji:

- własni agenci pozostają nietknięci;
- każdy dawny wbudowany agent widoczny w tej instalacji zostaje zapisany jako zainstalowany;
- mapy, rozmowy w trybie Conversation i gry w trybie Conversation zachowują dotychczasową dostępność;
- dotychczasowa konfiguracja poszczególnych czatów, migawki, stan gry, historia rozmów i pamięć agentów zostają na miejscu;
- migracja jest idempotentna i zapisuje swoje zakończenie dopiero wtedy, gdy wszystkie wpisy o dawnej dostępności są trwałe.

Artefakty dawnych pakietów nadal są dostępne w oficjalnym katalogu jako źródła migracji. Świeża instalacja ich nie pokazuje ani nie aktywuje, dopóki nie zostaną zainstalowane ręcznie.

## Odinstalowanie

Odinstalowanie usuwa pakiet z wyborów w aktywnych czatach, kasuje jego konfigurację agenta oraz pobrane pliki wykonywalne, a w razie potrzeby odłącza jego środowisko uruchomieniowe przy restarcie. Historyczne czaty, wiadomości, migawki map, podsumowania rozmów i zakończone rozgrywki nadal da się odczytać, więc usunięcie pakietu nie zniszczy niczyjej pracy. Trwałe usunięcie historycznych danych domenowych to osobna, jawna decyzja użytkownika.

Każde odinstalowanie wymaga potwierdzenia. Objęte nim czaty wracają do zwykłych powierzchni podstawowych bez uszkodzenia historii.

## Interfejs katalogu

Panel **Agents** (Agenci) zawiera przycisk `Download Agents`, odpowiadający przyciskowi `Download` w panelach Characters i Personas, który otwiera Card Browser. Przycisk agentów otwiera pełnoekranową, responsywną bibliotekę z wyszukiwaniem, rodzajami pakietów, informacją o zgodności, stanem instalacji i aktualizacji, uprawnieniami, kosztem miejsca na dysku, dokumentacją oraz przyciskami odinstalowania.

Na komputerze widać listę do przeglądania i sąsiadujący z nią obszar szczegółów. Na telefonie jest jeden panel, z jawną nawigacją wstecz i akcjami wygodnymi pod palec. Stany pusty, offline, niezgodny, uszkodzone pobieranie, przerwana instalacja, aktualizacja, wycofanie i wymagany restart są obsłużone pełnoprawnie.

## Warunek zakończenia wydzielenia

Wydzielenie jest kompletne dopiero wtedy, gdy podstawowe produkcyjne paczki klienta i serwera nie zawierają już implementacji pakietu, świeża instalacja nie potrafi jej aktywować bez pobrania pakietu, instalacja po aktualizacji ją zachowuje, a instalacja, aktualizacja i odinstalowanie pakietu przechodzą pomyślnie na komputerze, telefonie i systemach plików zgodnych z Termux.

### Capability API 1.30: tory ran, zasoby na test i walka na torze

Wpis `live.tracks` zestawu może deklarować `levels` i `kinds`, zmieniając ograniczoną liczbę całkowitą w TOR RAN: kolumnę pól z własnymi etykietami i karami, na których umieszcza się znaczniki. `levels` to 1-16 poziomów od najlepszego do najgorszego, każdy z `label` i całkowitym `penalty`. `kinds` to 1-6 rodzajów obrażeń, każdy z `id`, krótkim `label` i odrębnym `severity`. `kinds` bez `levels` jest odrzucane, bo nie byłoby czego oznaczać. `resolution.penaltyFrom` wskazuje tor, którego kara dotyczy każdego rzutu: przy `dice-pool` odejmuje kości, nie poniżej `pool.min`, a przy `dice-sum` daje stały modyfikator.

Pozostałe dodatki tej części także należą do 1.30; pakiet dostarczający choć JEDEN deklaruje 1.30:

- `combat.health` może wskazać tor ran zamiast puli. Wtedy `combat.damageKinds` określa znaczniki typów obrażeń: `default`, opcjonalne mapowanie `byType` i `marks`, gdzie `per-blow` zaznacza pole za trafienie, a `per-point` liczy poziomy zdrowia z obrażeń. `damageKinds` jest wymagane przy torze ran i odrzucane przy puli.
- `resolution.spend` (tylko `dice-pool`): pula wydawana na test, koszt jednej płatności, czy kupuje `successes`, czy `dice`, oraz `perCheck`, limit na rzut.
- `mechanics.check` wpisu katalogu: wpływ WYBRANEJ przez postać rzeczy na test jako `reroll` (`upTo` i `once` lub `until`), `dice`, `successes` albo `threshold`. Też tylko pule.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Długość toru ran wynika z poziomów, więc `min` wynosi 0, a `max` to `levels.length`. Inna deklaracja jest odrzucana, nie poprawiana po cichu. `resolution.penaltyFrom` musi wskazywać tor ran: zwykły licznik nie ma kary.

To nie jest miękki interfejs, z tego samego powodu co 1.20-1.28: Engine nieznający `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` lub `mechanics.check` odrzuca cały plik zasad. Instalacja czyta zweryfikowane bajty `ruleset.json` i odrzuca pakiet ze starszą deklaracją. Bez zmian dla zestawu ze zwykłymi licznikami, zdrowiem jako pulą i bez wydatków na test.

### Capability API 1.29: możliwości jednej tury walki zestawu

Pięć opcjonalnych dodatków do `combat` i wpisów katalogu używanych w walce:

- Trafienie może mieć do trzech DODATKOWYCH wartości. `mechanics.plus` wpisu katalogu i `damage.plus` akcji stworzenia mają postać `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`: osobne rzuty i typy, osobne podwojenie przy krytyku oraz rzuty obronne celu, ale nadal jedna kontrola koncentracji i upadku dla całego trafienia.
- `combat.attacks[].strikes` to odwołanie do wartości określające liczbę uderzeń za jedno wydanie budżetu listy. Pozostałe są dostępne do końca tury; gdy jakiekolwiek pozostają, wszystkie wiersze tej listy nie zużywają budżetu.
- `mechanics.free` nie zużywa budżetu, `mechanics.gives` oddaje go tylko na tę turę z ograniczeniem do maksimum, a `mechanics.standard` kupuje nazwane standardowe akcje innym budżetem. Wpis `utility` z `gives` lub `standard` jest oferowany zamiast pomijany.
- Nowy rodzaj wpisu `rider` i własne `riders` stworzenia biernie dodają składnik obrażeń do pierwszego pasującego trafienia w turze lub rundzie, nigdy nie trafiając do menu.
- Zamknięta lista efektów stanów zyskuje `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` i `cannot-approach-source`. Stan może ograniczać rzuty obronne przez `saves`, działać tylko przy widocznym źródle (`whileSourceInSight`) albo kończyć się po jego upadku (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

To nie jest miękki interfejs, jak w 1.20-1.28: Engine nieznający tych kluczy odrzuca cały plik zasad lub katalogu. Instalacja czyta zweryfikowane bajty `ruleset.json` i każdego zadeklarowanego `catalogs/<id>.json`, odrzucając starszą deklarację dla obu. Bez nowych uprawnień i bez zmian, gdy zestaw nie deklaruje tych pól.

### Capability API 1.28: walka zestawu na planszy

Blok `combat` może określać wartość pola planszy we własnej jednostce odległości (`distance: { label, perCell }`), co umożliwia pozycjonowanie walki. `ranged` określa koszt strzału poza zwykły zasięg lub z wrogiem na sąsiednim polu; `cover` dodatek osłony do obrony; `opportunity` budżet ataku na odchodzącego przeciwnika. Lista ataków może mieć `reach` i `range` czytane z kolumny lub wspólne dla wierszy. `range` akcji stworzenia może być `{ "normal": 30, "long": 120 }` zamiast liczby.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Deklarowanie `ranged`, `cover`, `opportunity` albo zasięgu broni BEZ `distance` jest odrzucane przy imporcie: nic nie znaczy bez pola do pomiaru. Plansza używa generatora, terenu i rozmieszczenia taktycznego stylu walki, więc nie dodaje drugiego modelu pola bitwy ani uprawnień.

To nie jest miękki interfejs, jak w 1.20-1.27: Engine nieznający kluczy odrzuca cały plik zasad albo katalog ze stworzeniem o podwójnym zasięgu. Instalacja czyta zweryfikowane bajty `ruleset.json` i wszystkich zadeklarowanych `catalogs/<id>.json`, odrzucając starszą deklarację. Bez zmian dla zestawu bez odległości.

### Capability API 1.27: bestiariusze zestawu

Katalog zestawu zasad może deklarować `"holds": "creatures"` i zamiast wierszy arkusza zawierać bloki statystyk stworzeń. Stworzenie jest opisane liczbami, które blok `combat` już deklaruje: zdrowiem, które może być liczbą albo rzutem kośćmi na początku walki, obroną, modyfikatorem inicjatywy, wartościami cech i modyfikatorami rzutów obronnych według identyfikatorów arkusza, typami obrażeń, na które jest odporne, podatne albo niewrażliwe, stanami, którym nigdy nie podlega, poziomem zagrożenia, cechami pokazywanymi GM oraz akcjami, które mogą trafiać, wymuszać rzut obronny, nakładać stan, mieć limit użyć, odnawiać się rzutem, wykonywać sekwencję innych akcji bloku za jeden budżet albo kosztować własne punkty specjalne stworzenia.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Katalog stworzeń nie deklaruje `feeds` i nigdy nie pojawia się w selektorze edytora arkusza: czyta go walka, a nie arkusz postaci. Walka, która go czyta, to styl `ruleset` reżysera walki, który nie wymaga własnego poziomu Capability API: rozgrywa każdy blok `combat` i bestiariusz, które zainstalowany zestaw zasad już zawiera.

To nie jest miękki interfejs, z tego samego powodu co 1.20-1.26: Engine, który nie umie odczytać `holds` ani `creature` wpisu, odrzuca cały plik zasad albo plik katalogu, który je zawiera, więc instalacja czyta zweryfikowane bajty `ruleset.json` i każdego zadeklarowanego `catalogs/<id>.json` i odrzuca każdy z nich przy starszej deklaracji. Bez uprawnień i bez zmian dla zestawu bez bestiariusza.

### Capability API 1.26: rodzimy format walki zestawu

Zestaw zasad może zawierać opcjonalny blok `combat` najwyższego poziomu, który określa, jak walka jest ROZSTRZYGANA jego własnymi liczbami: co się rzuca i przeciw czemu, ekonomię akcji, które listy arkusza są atakami, a które zdolnościami, co robią jego stany, koncentrację, co dzieje się z postacią przy zerze, jakie typy obrażeń istnieją i z jakiej skali wybiera się przeciwnika. W tym samym wydaniu `mechanics` wpisu katalogu może określać, ile celów obejmuje, że zawsze trafia, jakie stany nakłada, jakie punkty tymczasowe daje, jak rośnie razem z arkuszem i jaki budżet zużywa.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Gra na zestawie zasad, który deklaruje `combat`, przy włączonym reżyserze walki toczy bitwy według tego bloku na ekranie bitwy. Zestaw bez niego walczy tak jak wcześniej: przez blok `battle` albo według wybranego przez gracza stylu Classic lub Tactical.

To nie jest miękki interfejs, z tego samego powodu co 1.20-1.25: Engine, który nie umie odczytać `combat` ani nowych kluczy `mechanics`, odrzuca cały plik zasad albo plik katalogu, który je zawiera, więc instalacja czyta zweryfikowane bajty `ruleset.json` i każdego zadeklarowanego `catalogs/<id>.json` i odrzuca każdy z nich przy starszej deklaracji. Bez uprawnień i bez zmian dla zestawu bez obu tych elementów.

### Capability API 1.25: warstwy i wskazówki świata

Zestaw zasad może deklarować opcjonalną tablicę `layers` najwyższego poziomu: nazwane warianty samego siebie (Low magic, Hard winter), które gracz włącza przy tworzeniu gry i które zostają utrwalone w przypisaniu zestawu do tej gry na cały czas jej trwania. To samo wydanie daje bazowemu blokowi `gm` opcjonalny tekst `worldGuidance`, który generowanie świata czyta raz podczas konfiguracji, aby świat pasował do zasad, według których będzie grać drużyna.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Efekty warstwy tworzą zamknięty zbiór i każdy z nich zawęża albo dopisuje: wskazówki dodane po wskazówkach zestawu, wartości usunięte z pola wyliczeniowego, skalę trudności zastąpioną skalą tego samego rodzaju rozstrzygania oraz wpisy katalogu ukryte w selektorze edytora arkusza. Nic nie jest dodawane, więc arkusz postaci pozostaje czytelny niezależnie od warstw wybranych w grze, a warstwa nie wnosi kodu pakietu ani dodatkowego wywołania modelu. Warstwy dostarczane przez kogoś innego niż autor zestawu zasad to późniejsze rozszerzenie.

To nie jest miękki interfejs, z tego samego powodu co 1.20-1.24: Engine, który nie zna `layers` ani `gm.worldGuidance`, odrzuca cały plik zasad, więc instalacja czyta zweryfikowane bajty `ruleset.json` i odrzuca każde z tych pól przy starszej deklaracji. Bez uprawnień i bez zmian dla zestawu bez obu pól.

### Capability API 1.24: pule kości

`resolution` zestawu zasad może deklarować `"kind": "dice-pool"` zamiast `"dice-sum"`. Test rzuca wtedy tyle kości, ile podaje arkusz postaci, i liczy te, które osiągają próg, z opcjonalnymi podwójnymi sukcesami, eksplodującymi i anulującymi wynikami, pechem, wyjątkowymi sukcesami oraz zakresem kości sytuacyjnych, które GM może dodać albo odjąć przy jednym teście.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Arkusz pozostaje ten sam: to, co `dice-sum` dodaje do rzutu, tutaj oznacza liczbę kości. Ten rodzaj rozstrzygania nie wnosi więc nowego słownictwa arkusza, slotu edytora ani kodu pakietu.

To nie jest miękki interfejs, z tego samego powodu co 1.20-1.23: Engine, który zna tylko `dice-sum`, odrzuca cały plik zasad, więc instalacja czyta zweryfikowane bajty `ruleset.json` i odrzuca rozstrzyganie `dice-pool` przy starszej deklaracji. Bez uprawnień i bez zmian dla zestawu, który sumuje kości.

### Capability API 1.23: skalowane wartości katalogu

Wiersz wpisu katalogu może mieć opcjonalną mapę `scaled`: do czterech własnych kolumn liczbowych tego wiersza, których wartość utrzymuje zestaw zasad, a nie gracz. Każda z nich to zwykłe odwołanie do wartości z opcjonalną tabelą progów, więc zasób klasy może zależeć od poziomu, a liczba użyć zdolności od wartości cechy, bez uczenia formatu nowej arytmetyki.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Wartość jest obliczana przy edycji arkusza, a nigdy przy jego odczycie, więc stan gry, blok promptu GM i most walki nadal czytają zapisaną liczbę.

Skalowany wiersz może znajdować się bezpośrednio w `ruleset.json` albo w zasobie `catalogs/<id>.json`. Manifest deklaruje oba pliki jako zasoby, ale nie pokazuje kluczy w ich wnętrzu, więc instalacja czyta zweryfikowane bajty obu plików i odrzuca klucz `scaled` przy deklaracji starszej niż 1.23, dokładnie tak jak `catalogs` poniżej 1.21 i `battle` poniżej 1.22. Ścisły schemat starszego Engine i tak odrzuciłby plik, który go zawiera. Bez uprawnień i bez zmian dla zestawu, którego katalogi nie zawierają skalowanych wierszy.

Ta wersja dodaje też polecenie `[sheet: op="use" name="..."]`, które opłaca `mechanics.cost` wpisu katalogu oraz po jednym użyciu każdej puli wiersza utworzonej przez ten wpis. Nie wymaga ono deklaracji: czyta katalogi, które Engine już udostępnia.

### Capability API 1.22: blok battle

Zestaw zasad może zawierać opcjonalny blok `battle`, który użycza walce liczb z arkusza postaci: bieżącej puli będącej punktami życia, opcjonalnej puli, która staje się MP, pul, które stają się komórkami zaklęć, oraz list arkusza, których wiersze oznaczone w katalogu stają się własnymi `CombatSkill` Engine. Po zakończeniu walki wydane punkty życia, energia i komórki są zapisywane z powrotem przez te same operacje arkusza, których używają przyciski gracza.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

To nie jest adapter walki. Arytmetyka obrażeń pozostaje po stronie Engine, a `attackRoll`, `save`, `concentration` i `perCostStep` wpisu katalogu nie są przez nikogo odczytywane: rozstrzyganie zgodne z zasadami systemu należy do adapterów poszczególnych zestawów w przekazaniu walki. `coverage.combat` zachowuje własne znaczenie i most nigdy go nie odczytuje.

Blok znajduje się w `ruleset.json`, którego zawartości manifest nie pokazuje, więc instalacja czyta zweryfikowane bajty i odrzuca klucz `battle` przy deklaracji starszej niż 1.22, dokładnie tak jak `catalogs` poniżej 1.21. Ścisły schemat starszego Engine i tak odrzuciłby cały plik zasad. Bez uprawnień i bez zmian dla zestawu, który nie dostarcza bloku `battle`.

### Capability API 1.21: katalogi zestawów zasad

Zestaw zasad może dostarczać **katalogi**: nazwane zbiory gotowych wpisów (zaklęcia, zdolności klas, ekwipunek), które edytor arkusza proponuje w selektorze, żeby gracz nie wpisywał listy wiersz po wierszu. Nagłówek znajduje się w `ruleset.json` pod kluczem `catalogs`; wpisy są albo bezpośrednio w tym nagłówku, albo w osobnym zastrzeżonym zasobie, po jednym pliku na katalog:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` to zastrzeżona rodzina zasobów: nazwa pliku jest identyfikatorem katalogu, więc Engine znajduje plik na podstawie samego zestawu zasad, a żaden katalog nie może wskazać pliku innego katalogu. Zasób katalogu ma przypięty hash w `files[]` jak każdy inny zadeklarowany zasób, występuje tylko obok deklarującego go `ruleset.json` i jest odrzucany przed odczytem, gdy deklarowany rozmiar przekracza 2 MB (1 MB przed Capability API 1.340; pakiet z plikiem katalogu większym niż 1 MB deklaruje 1.340). Jego zawartość przechodzi te same kontrole co wpisy bezpośrednie, względem tego samego arkusza, więc katalog nigdy nie zapisze wiersza, którego arkusz nie mógłby pomieścić. Limit to 12 katalogów na zestaw i 2000 wpisów na katalog.

Klient pobiera katalog dopiero po otwarciu selektora, przez `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. Lista zainstalowanych zestawów nigdy nie zawiera wpisów bezpośrednich, tylko ich liczbę, bo jest odczytywana przy każdym otwarciu edytora arkusza. Tekst katalogu nigdy nie trafia do promptu: GM nadal widzi tylko to, co wskazuje `gm.sheetSummary`, więc katalogi nie kosztują tokenów.

Tak jak w 1.20, to nie jest miękki interfejs, a bramka ma dwie części, bo katalogi znajdują się w pliku zasad, a nie w manifeście. Zadeklarowanie zasobu `catalogs/<id>.json` wymaga 1.21, a `ruleset.json` z kluczem `catalogs` jest odrzucany przy instalacji, gdy manifest deklaruje mniej, bo ścisły schemat starszego Engine i tak odrzuciłby cały plik zasad. Jak wcześniej, uprawnienia nie są potrzebne.

### Capability API 1.20: zestawy zasad Game Mode

Zestaw zasad to reguły gry w postaci sprawdzanych danych: sposób rozstrzygania testów, który Engine już obsługuje, arkusz postaci zadeklarowany z zamkniętego zbioru elementów, odpoczynki i wskazówki do promptu GM. Pakiet dostarcza go jako zasób o zastrzeżonej nazwie `ruleset.json`, wykrywany zgodnie z konwencją tak samo jak `gm-verbs.json`: wpisany w `contributions.assets.paths` i z przypiętym hashem w `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

Przykład pokazuje tylko klucze istotne dla zestawu zasad; zwykłe pola manifestu (`name`, `version`, `description`, `engine`, `builtAgainst`) nadal są wymagane.

Pakiet zestawu zasad nie potrzebuje uprawnień, punktu wejścia serwera ani klienta, ani agenta. Typ i zasób idą w parze: pakiet typu `ruleset` musi wymieniać `ruleset.json`, a pakiet wymieniający `ruleset.json` musi deklarować ten typ, więc zestaw zasad nie przedostanie się pod innym typem. Nic w pliku nie jest wykonywane: nie ma w nim wyrażeń tekstowych, a mechanika, której nie wyraża żaden rodzaj rozstrzygania, to zmiana w Engine dodająca nowy rodzaj, a nie coś, co może zrobić zestaw zasad. Format, oficjalny plik 5e i powody jego kształtu opisuje [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

To nie jest miękki interfejs. Pakiet zestawu zasad nic nie robi w Engine, który nie umie go odczytać, więc manifest wymieniający `ruleset.json` musi deklarować Capability API 1.20, a starszy Engine czysto odmawia instalacji.

Engine odrzuca zasób przed odczytem, gdy deklarowany rozmiar przekracza 512 KB (256 KB przed Capability API 1.340; pakiet, którego plik zasad przekracza 256 KB, deklaruje 1.340), ponownie sprawdza go względem hasha z instalacji i waliduje ścisłym wspólnym schematem (`packages/shared/src/schemas/ruleset.schema.ts`). Plik, którego nie da się użyć, zostaje pominięty z jednym wpisem dziennika, który wskazuje pakiet i kilka pierwszych błędów `path: message`. Gdy dwa pakiety deklarują ten sam identyfikator zestawu, wygrywa pierwszy według kolejności identyfikatorów pakietów, a drugi jest pomijany z wpisem dziennika. `engine-legacy` i `traditional` to identyfikatory należące do Engine, których plik nie może zająć.

Gra przypisuje sobie zestaw zasad raz, przy tworzeniu, jako `chat.metadata.gameRuleset`. Brak przypisania oznacza własne zasady Engine, dokładnie jak wcześniej. Przypisanie, którego instalacja nie może uszanować (pakietu już nie ma albo zainstalowana definicja jest starsza niż przypisana wersja), jest zgłaszane jako niedostępne i nigdy nie jest interpretowane jako inny zestaw. Przypisanie sprawdza identyfikator zestawu oraz pakiet, który go dostarczył, więc inny pakiet z tym samym identyfikatorem nie przejmie istniejącej gry.

### Capability API 1.73: agenci awatarów

Engine hostuje dwóch agentów awatarów: `2d-avatars` (sprite'y PNGTuber i awatary mesh) oraz `3d-avatars` (modele VRM). Ich pakiety pozostają cienkie: każdy zawiera definicję agenta, domyślne prompty, pliki lokalizacji i wpis w katalogu. Wszystko inne należy do Engine: przechowywanie danych osobno dla każdego właściciela w `DATA_DIR/avatar-models/`, import, leniwie ładowane renderery, konfiguracja na stronie każdego agenta w edytorze agenta, reżyser strumienia, klasyfikator wyrazów twarzy i trasy generowania. Wspólny kontrakt to `packages/shared/src/types/avatars.ts` (jego schematy są w `schemas/avatars.schema.ts`), a część kliencka to `packages/client/src/features/avatars/contract.ts`. Przewodnik dla użytkownika to [`docs/agents/avatars.md`](../agents/avatars.md).

Nie ma nowego pola manifestu. Pakiet awatarów deklaruje schemat w wersji 2 i Capability API 1.73, więc Engine bez tych powierzchni odmawia instalacji, zamiast wyświetlać agenta, który niczego nie pokazuje. Zmiana, która wprowadziła 1.73, dostarczyła te powierzchnie jako nieaktywne zaślepki; konfiguracja, scena i renderery Engine są już na `staging`, a oba pakiety figurują w katalogu podglądowym. Adresy URL artefaktów, do których odwołują się ich wpisy, muszą zostać opublikowane, zanim instalacja zadziała; sam wpis w katalogu nie dowodzi, że artefakt do pobrania jest dostępny. Prompty generowania agenta 2D są dostarczane jako kolekcja szablonów promptów `avatarGenerationTemplates` w jego `defaultSettings`, z identyfikatorami w `AVATAR_PROMPT_TEMPLATE_IDS`; edytor agenta scala je i przywraca do wartości domyślnych tak jak każdą inną wbudowaną kolekcję szablonów.

### Capability API 1.72: pakiet map dla Experience

Pakiet `game-surface` konfigurowany w kreatorze Game (`gameSurface.setup`, 1.18) może dostarczyć pakiet map przy schemacie w wersji 2 i Capability API 1.72: własny zestaw realiów świata (setting kit), gotowe światy zbudowane na tym zestawie realiów i własny zestaw kafelków. Każdy z nich to plik do udostępniania, który Game Mode i Pixelforge już odczytują i zapisują (plik `.worldkit.json`, pliki `.world.json` i plik `.tilepack.json`), a zarazem zadeklarowany zasób przypięty hashem.

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds` (maksymalnie 32) i `tiles` są opcjonalne. Plik świata może zawierać skrypt fabuły swojego świata (worldgen W10), który trafia do pakietu razem z mapą jako jej część. Plik świata w wersji 2 zawiera też `snapshot` świata, czyli świat w takiej postaci, w jakiej powstał (W11): Engine, którego generator światów od tego czasu się zmienił, odczytuje świat z tej migawki dokładnie w takiej postaci, w jakiej powstał, więc pakiet działa dalej po aktualizacjach Engine. Zapisuj pliki przyciskiem **Download** (pobranie) przy grze albo świecie z biblioteki (lub przez `GET /api/game/:chatId/world/file`), bo tak zapisane pliki zawierają migawkę. Plik pakietu może mieć najwyżej 8 MB, czyli tyle, ile największy plik do udostępniania odczytywany przez Engine (zestaw kafelków ma własne, mniejsze limity), więc świata z większym plikiem (migawka bardzo dużego świata) nie da się dostarczyć w pakiecie. Świat, którego fabuła ustawia `intro`, wymaga Capability API 1.339 (zobacz [Wiadomość otwierająca](../extending/writing-story-scripts.md#the-intro-message)). `tiles` może być graficznym zestawem kafelków (zestaw kafelków w wersji 2: arkusze PNG na siatce pól, ze sprite'ami zajmującymi kilka pól), co wymaga Capability API 1.80; Engine dekoduje i sprawdza jego arkusze raz na wersję pakietu. Gdy Experience jest włączone, nowa gra jest związana z zestawem realiów pakietu; jeśli pakiet dostarcza światy, gracz wybiera jeden z nich (razem z fabułą) i nie tworzy innego. Wyłączenie Experience przywraca graczowi własne wybory. `POST /api/game/create` wymusza tę samą blokadę. Gra zachowuje swój zestaw realiów i świat jak każda inna, więc działa dalej po usunięciu pakietu, a dopóki pakiet jest zainstalowany, rysuje mapę świata i miasta kafelkami z pakietu.

Engine odczytuje pliki zweryfikowaną ścieżką zasobów (deklarowany rozmiar najwyżej 8 MB na plik, hash sprawdzany ponownie) i sprawdza je tak samo jak pliki do udostępniania. Pakiet jest odrzucany w całości, z podaniem powodu, gdy któregoś pliku nie da się odczytać, gdy świat powstał na innym zestawie realiów albo do niego nie pasuje lub gdy bajty pliku nie są tymi zainstalowanymi; Experience nie może wtedy rozpocząć gry. Zestaw zasad nigdy nie jest częścią pakietu map: Experience, które potrzebuje własnych zasad, dostarcza osobny pakiet zestawu zasad.

### Capability API 1.18: konfiguracja Experience w kreatorze Game

Pakiet `game-surface` może zadeklarować `contributions.gameSurface.setup` przy schemacie w wersji 2 i Capability API 1.18. Engine zachowuje siedem zwykłych kroków konfiguracji, w tym **Party** (Drużyna), cele, modele i lorebooki. Experiences są dostępne tylko przy nowych grach; ponowne otwarcie konfiguracji istniejącej gry zachowuje jej Experience i konfigurację pakietu. Pakiety bez tej deklaracji zachowują dawny dialog konfiguracji.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Wszystkie trzy pola są opcjonalne. Zadeklarowane ziarno pojawia się pod wybranym Experience z przyciskiem **Randomize** (Losuj). Ziarno to liczba całkowita bez znaku od 0 do 4294967295; wartość pusta, ułamkowa, ujemna, w zapisie wykładniczym albo szesnastkowym blokuje **Start** (Rozpocznij). Host zapisuje liczbowe ziarno i zadeklarowane stałe w `experienceConfig`; `config` nie może zawierać klucza ziarna. Stałe po serializacji muszą mieścić się w 8 000 znaków. Etykieta ziarna to tekst wyświetlany autorstwa pakietu; pomiń ją, aby użyć zlokalizowanej etykiety Engine.

Zadeklarowane wymaganie dotyczące widgetów jest egzekwowane, dopóki Experience jest aktywne. Host ustawia kontrolkę na zadeklarowaną wartość, blokuje ją i wyjaśnia, które Experience ją ustawiło. Import pliku konfiguracji nie może nadpisać zadeklarowanej wartości. Wcześniejszy wybór gracza pozostaje nietknięty i wraca, gdy tylko Experience zostanie wyłączone. Dla tych Experiences kontrolki konfiguracji mapy przestrzennej są ukryte, więc nie uruchamia się osobny szkic mapy, szablon ani kreator.

Krok **Lorebooks** (Lorebooki) pozwala wybrać do 100 pojedynczych włączonych wpisów, także z niepodłączonych książek. Wyłączone książki i wpisy oraz wykluczenia czatu są respektowane. Identyfikatory trafiają do `GameSetupConfig.activeLorebookEntryIds`. W `/game/setup` są to dodatkowe wymuszone wpisy: pomijają losowanie prawdopodobieństwa, ale zachowują zwykłe limity tokenów. Lore globalne, powiązane z postaciami i podłączone nadal uczestniczy w zwykłym skanowaniu. Pakiety mogą odczytać te same wybrane identyfikatory z konfiguracji na potrzeby własnego żądania generowania świata. Importowane identyfikatory wpisów, których nie ma na tym komputerze, są zgłaszane i pomijane.

Import pliku konfiguracji odtwarza zainstalowane, zgodne Experience i jego poprawne liczbowe ziarno, ale odrzuca dowolną konfigurację pakietu. Stałe są ponownie dostarczane przez bieżący manifest. Plik bez użytecznego ziarna Experience pozostawia wstępnie wylosowane ziarno bez zmian. Istniejące gry pomijają import Experience z wyjaśnieniem. Migawki utworzenia zachowują nazwę Experience i ziarno do podsumowania konfiguracji.

Gdy świat musi być przygotowany przed pierwszą turą, niezależnie użyj istniejącej deklaracji gotowości startowej. Zadeklaruj API 1.18 jako minimum pakietu; starsze hosty nie potrafią zinterpretować tej deklaracji konfiguracji.

### Capability API 1.71: odczyt wiadomości tak, jak czytają je agenci

W trybie Roleplay wiadomość może zawierać szepty, które nie należą do jej `content`. Czyta je każdy agent uruchamiany przez Engine, a pakiet, który sam czyta czat, może teraz odczytać ten sam tekst. Każdy rekord z `persistence.listMessages(chatId)` dostaje pole `agentContent`: wiadomość w takiej postaci, w jakiej czytają ją agenci Engine. Każdy szept stoi w swoim miejscu, oznaczony jako `[Private whisper to <name>: …]`, a wiadomość, która jest tylko szeptem, czyta się jako jej szepty. Dokument przekazany przez postać, na przykład list, następuje po wiadomości. Prywatne notatki gracza są pomijane.

`agentContent` występuje tylko w czatach w trybie Roleplay. Brakuje go w innych trybach i w hostowanym pokoju gry wieloosobowej, gdzie wszyscy widzą, co piszą agenci. `content` nigdy się nie zmienia: nadal jest tekstem publicznym. `extra` też się nie zmienia: to zapisane dane wiadomości, ze wszystkimi szeptami, w każdym trybie. Nigdy nie pokazuj tekstu zbudowanego na jego podstawie graczom ani postaciom, dla których szept nie był przeznaczony.

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

To miękki interfejs: starszy Engine pomija to pole, więc pakiet, który czyta `agentContent ?? content`, nie musi deklarować 1.71. Potrzebuje uprawnienia `chat-read`, tak jak `listMessages`. Szepty są prywatne: wszystko, co pakiet napisze na ich podstawie, na przykład notatka albo wspomnienie, może dotrzeć do postaci, dla których szept nie był przeznaczony.

### Capability API 1.68: embedding zapytań wyszukiwania jako zapytań

`embeddings.embed(texts, signal?, inputType?)` przyjmuje trzeci argument: dla tekstu wyszukiwania, na przykład zapytania przywoływania, przekaż `"query"`. Domyślnie teksty mają typ `"document"`. Niektóre modele embeddingów oczekują prefiksu przed zapytaniami, a niektóre także przed dokumentami: e5 i nomic-embed-text mają po jednym prefiksie dla zapytań i dla dokumentów, a Snowflake Arctic Embed v2 dodaje prefiks tylko do zapytań. Engine dodaje właściwy prefiks. Gdy embedding zapytania powstaje tak jak dla dokumentu, przywoływanie działa gorzej. Inne modele, w tym wbudowany MiniLM, nie dostają prefiksu w żadnym z tych przypadków. Typ danych wejściowych nie zmienia `spaceId`, więc zapisane wektory pozostają porównywalne i niczego nie trzeba ponownie przeliczać.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

To miękki interfejs: starszy Engine ignoruje trzeci argument, więc pakiet może zawsze go przekazywać i nie musi deklarować 1.68. Przekazuj typ danych wejściowych jako trzeci argument, nigdy w obiekcie opcji: starszy Engine przekazuje drugi argument bezpośrednio dostawcy jako sygnał przerwania.

### Capability API 1.67: otwieranie postaci w edytorze

Widok w przeglądarce dostaje `openCharacter(characterId, { tab })`. Otwiera edytor postaci, a jeśli podano zakładkę, od razu na niej, więc pakiet może skierować użytkownika do pola karty postaci, które czyta. Starsze wersje Engine go nie mają: zanim pokażesz łącze, sprawdź, czy `openCharacter` istnieje.

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

### Capability API 1.66: sceny z wątków pakietów

Scena roleplay zwykle odgałęzia się od czatu Conversation (`/scene`). Pakiet z nowym uprawnieniem `scenes` może zamiast tego pozwolić, by punktem wyjścia były jego własne wątki, na przykład wątek wiadomości prywatnych. Scena jest zwykłym czatem sceny: ma tego samego planistę, to samo okno preferencji promptu, te same instrukcje sceny, przyciski End Scene, Discard i Convert oraz te same wspomnienia postaci po zakończeniu. Pakiet odpowiada za stronę wątku: za to, co czyta planista, za blokadę na czas trwania sceny i za to, co dzieje się z podsumowaniem.

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

Widok w przeglądarce (`home-browser-tab`) dostaje te właściwości:

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })` otwiera okno preferencji promptu sceny, planuje i tworzy scenę, a potem otwiera jej czat. Przekaż `plan` (obiekt `SceneFullPlan`: nazwa, opis, ukryty scenariusz, pierwsza wiadomość, prompt systemowy sceny, klasyfikacja treści, historia relacji, wskazówki dotyczące udziału, tło, obsada), żeby samodzielnie napisać scenę; okno i planista Engine są wtedy pomijane, a scena powstaje dokładnie według planu. Zwraca `{ chatId }` albo `null`, gdy użytkownik anuluje lub tworzenie się nie powiedzie (użytkownik widzi powód). Funkcja pomocnicza zawsze używa identyfikatora własnego pakietu. To udogodnienie, a nie granica bezpieczeństwa: trasy scen przyjmują identyfikator dowolnego pakietu, więc `getContext` musi zwracać tylko to, co gracz i tak może zobaczyć w tym wątku.
- `openChat(chatId)` przechodzi do czatu, na przykład dla przycisku "Go to scene" w zablokowanym wątku.
- `focusSceneOriginId` to wątek, który trzeba pokazać, gdy użytkownik wraca ze sceny (Back, End Scene, Discard). Po jego pokazaniu wywołaj `onFocusSceneOriginHandled()`.

Zasady, które warto znać:

- `data` to własne ustawienia tej sceny: zwykły obiekt JSON o długości najwyżej 4 000 znaków. Engine przechowuje go razem ze sceną i przekazuje do `claim(originId, { sceneChatId, characterIds, data })` oraz do `release` jako `end.data`, więc każda scena może zdecydować sama: `claim` może dopuścić scenę bez blokady (zwróć `true` i niczego nie zapisuj), a `release` może odblokować wątek bez przejmowania podsumowania albo przejąć je w zakresie, o który prosiła scena.
- Wymagane jest tylko `getContext`. Pakiet, który chce jedynie uruchamiać sceny, pomija `claim` i `release`: nic nie jest blokowane, z tego samego punktu wyjścia może działać dowolnie wiele scen, a po ich zakończeniu nic nie jest przekazywane (**Back** nadal wraca do pakietu). Pomiń tylko `release`, żeby blokować bez poznawania wyniku, albo tylko `claim`, żeby poznawać wyniki bez blokady.
- Jeden dostawca na pakiet; ponowna rejestracja go zastępuje, a dezaktywacja usuwa.
- `characterIds` muszą być postaciami Engine; nieznane identyfikatory są pomijane, a kontekst bez żadnej znanej postaci jest odrzucany. Nieznane `personaId` jest traktowane jak brak persony. `notes` jest przycinane do 8 000 znaków i trafia do planisty, a razem z zapisem rozmowy także do autora sceny jako ukryty kontekst.
- `claim` działa po utworzeniu czatu sceny. `false` odrzuca go z kodem 409; wyjątek odrzuca go z kodem 503. `getContext`, `claim` i `release` mają po 8 sekund: spóźnione `getContext` lub `claim` liczy się jako błąd (503, czat sceny zostaje usunięty), a spóźnione `release` jest zapisywane w dzienniku i pomijane.
- `release` dostaje `concluded` (z `summary`, `description`, `scenario`, `rating` i obsadą), `abandoned`, `deleted` albo `converted`. Musi być idempotentne i musi ignorować scenę, która nie trzyma blokady. Zwolnienie, które rzuci wyjątek albo nadejdzie, gdy pakiet jest nieaktywny, jest zapisywane w dzienniku i pomijane: czat sceny i tak pozostaje zakończony, więc nieaktualną blokadę uzgodnij, czytając czat sceny z uprawnieniem `chat-read`. Jego metadane mają `sceneStatus`, a zakończona scena ma też `sceneSummary`.
- Engine niczego nie zapisuje do czatu Conversation, gdy punktem wyjścia jest pakiet. Wspomnienia postaci są zapisywane przy zakończeniu dokładnie tak jak w scenie z czatu Conversation.

Uprawnienie `scenes` jest odrzucane w manifeście, który deklaruje `capabilityApi` starsze niż 1.66.

<a id="capability-api-150-professor-mari-actions"></a>

### Capability API 1.50: akcje dla Professor Mari

Pakiet z nowym uprawnieniem `mari-actions` może oferować nazwane akcje dla Professor Mari. Rejestruje jedną usługę pod własnym identyfikatorem; narzędzie `package_service` postaci Mari wyświetla akcje i wykonuje wybraną na prośbę użytkownika.

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

Ważne reguły:

- Klucz musi mieć postać `mari-actions:<package-id>` dla rejestrującego pakietu. Brak uprawnienia lub identyfikator innego pakietu powoduje wyjątek, więc wykonywana akcja zawsze należy do wskazanego pakietu.
- `list()` zwraca wpisy `{ name, summary?, inputs? }`. Nazwy mają 1–80 liter, cyfr, `.`, `_` lub `-`; pozostałe wpisy nie są wyświetlane. Mari czyta `summary` i `inputs`, więc używaj jasnego języka. Widoczne i wykonywalne jest tylko pierwszych 50 akcji. Mari widzi najwyżej 40 wejść na akcję; nazwy są obcinane do 80 znaków, każdy tekst do 300. `list()` musi odpowiedzieć w 5 sekund, inaczej akcje pakietu są pomijane.
- `run(name, input, { signal })` dostaje wyłącznie nazwę z listy i zwykły obiekt JSON do 64 000 znaków. Wejście pochodzi od modelu: przed działaniem sprawdź je własnym schematem. Zwróć `{ ok: true, value }` lub `{ ok: false, status?, error }`; Mari widzi pierwsze 2000 znaków błędu. `signal` anuluje pracę po zatrzymaniu Mari przez użytkownika albo po 5 minutach; Engine przestaje czekać, więc też zakończ pracę.
- Engine usuwa adresy data URL z `value` przed odczytem przez Mari i skraca długie odpowiedzi. Zwracaj identyfikatory i krótki tekst, nie pliki.
- Wyświetlanie listy jest tylko do odczytu. Każde wykonanie liczy się jako zmiana w Permissions Mode: Plan je odrzuca, Manual czeka na Accept użytkownika. Engine nie może pokazać podglądu ani cofnąć akcji pakietu, więc nie pokazuje karty Keep/Restore. Przy trudnych do odwrócenia zmianach zapewnij własną akcję cofania. Z tego powodu Plan odrzuca również akcje tylko odczytujące.
- Wyłączenie lub usunięcie pakietu usuwa jego akcje.

`mari-actions` jest odrzucane, jeśli manifest deklaruje `capabilityApi` starsze niż 1.50.

### Capability API 1.36: osiągnięcia pakietów

Pakiet z nowym uprawnieniem `achievements` może dodawać odznaki do panelu **Achievements** (osiągnięcia) na ekranie głównym, odczytywać, czy są odblokowane, i je odblokowywać. Panel pokazuje je w sekcji z nazwą pakietu w nagłówku, za odznakami samej aplikacji Marinara Engine.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

Zasady, które warto znać:

- Identyfikatory otrzymują przestrzeń nazw `<packageId>.<id>`. Wbudowany identyfikator nie zawiera kropki, więc nie może dojść do kolizji. Host przyjmuje identyfikator lokalny lub z przestrzenią nazw i odrzuca każdy identyfikator, którego pakiet sam nie zarejestrował.
- `unlock(id)` zwraca po zakończeniu `true` tylko dla wywołania, które odblokowało odznakę. `isUnlocked(id)` i `list()` odczytują stan; `list()` zwraca własne odznaki pakietu wraz z postępem.
- Za zliczanie odpowiada pakiet. Odznaka z rangą ustawia `target` i funkcję zwrotną `readProgress` – oba albo żadne. Aplikacja Marinara Engine odblokowuje ją podczas tego samego przebiegu co własne odznaki z rangami, gdy licznik osiągnie cel. Przechowuj licznik w hoście trwałego zapisu. Funkcja zwrotna, która zgłosi wyjątek lub nie zakończy się w ciągu **2 sekund**, zgłasza zero, a zdarzenie trafia do dziennika. Tak jak w przypadku narzędzi, limit obejmuje wyłącznie oczekiwanie asynchroniczne: pracy synchronicznej blokującej pętlę zdarzeń nie da się przerwać.
- `iconPath` to ścieżka wewnątrz katalogu głównego zasobów pakietu, udostępniana przez trasę zasobów pakietu. Zablokowana karta nadal pokazuje kłódkę. Jeśli grafika się nie wczyta, karta używa `icon` (domyślnie `trophy`).
- `title` i `description` to wyświetlany tekst. Pakiet językowy może je zastąpić przez `capabilityAchievements.<packageId>.<id>.title` i `.description`.
- Maksymalnie **32 odznaki na pakiet**. Partia zawierająca choć jeden nieprawidłowy wpis nie rejestruje niczego.
- Dezaktywacja lub usunięcie pakietu ukrywa jego odznaki. Odblokowania zostają zapisane, tak jak w przypadku własnych odznak aplikacji Marinara Engine, i pojawiają się ponownie po powrocie pakietu.

`api.registerAchievements` i `api.runtime.achievements` są dostępne dopiero w tak nowej wersji aplikacji Marinara Engine, więc korzystający z nich pakiet deklaruje `capabilityApi` 1.36.

<a id="capability-api-135-agent-home-widgets"></a>

### Capability API 1.35: widgety Home agentów

Pakiet agenta może oferować najwyżej trzy karty w siatce widgetów Home. Engine nigdy sam ich nie umieszcza: użytkownik dodaje, ukrywa, przywraca i porządkuje je w **Widget Manager** (menedżer widgetów), gdzie są zgrupowane pod agentem. Engine odpowiada za siatkę, ramkę i układ; pakiet za zawartość karty.

Zadeklaruj slot `home-widget` razem z definicjami:

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id` to kebab-case małymi literami, najwyżej 64 znaki, unikatowy w pakiecie.
- `label` (1–80 znaków) i `description` (do 200) są tekstami Widget Manager. Pakiet językowy może je zastąpić przez `localizations.<locale>.homeWidgets.<id>.label` i `.description`.
- `size` to `compact` lub `large`. Duży widget zajmuje więcej miejsca.
- `icon` jest nazwą ikony Engine (`activity`, `bell`, `calendar`, `chart`, `circle`, `clock`, `file`, `flame`, `heart`, `image`, `list`, `message`, `sparkles`, `star`, `zap`). `iconPath` to grafika pakietu (`gif`, `jpg`, `jpeg`, `png`, `webp`) wymieniona w `files[]`.
- `accent`, `surface` i `header` wybierają gotowe warianty prezentacji Engine.

Instalacja jest odrzucana, jeśli pakiet nie jest `agent` z uprawnieniem `ui` i punktem wejścia klienta, slot i `homeWidgets` nie występują razem, dwa widgety mają ten sam identyfikator lub `capabilityApi` jest starsze niż 1.35.

Engine montuje element klienta z `view="widget"`. Oprócz `packageId`, `packageVersion` i `localization`, `capabilityProps` zawiera:

- `widgetId`, `widgetLabel`, `widgetDescription`, `widgetIcon`, `widgetIconPath`, `widgetAccent`, `widgetSurface` i `widgetHeader`: definicję rysowanej karty, aby jedna paczka kodu obsłużyła wszystkie zadeklarowane widgety.
- `active`: `true` tylko gdy Home jest pokazane, a karta widoczna. Przy `false` wstrzymaj odpytywanie i animacje.
- `onOpenNoodle()`: otwiera własną kartę przeglądarki Home pakietu. Mimo nazwy działa dla każdego pakietu ze slotem `home-browser-tab`. Bez tej karty funkcja i `onOpenPost` nic nie robią.
- `onOpenPost(id)`: otwiera własną kartę Home na wskazanym elemencie. `id` jest ciągiem do 128 znaków; inne wartości są ignorowane. Element `view="browser"` otrzymuje `focusPostId: id` i po pokazaniu elementu powinien wywołać `onFocusPostHandled()`, by nie powtarzać ustawienia fokusu. Przejście na inną kartę usuwa oczekujący fokus.

Widget to mały widok agenta, nie jego druga kopia. Utrzymuj go lekkim, a większe zadania kieruj do karty przeglądarki.

### Capability API 1.34: stworzenie opisane zasadami zestawu

Stworzenie bestiariusza może mieć `sheet`: dowolnie częściowy arkusz w kategoriach zestawu. Walka buduje go jak członka drużyny, więc zdrowie, obrona, rzuty obronne, inicjatywa, szybkość i zdolności list pochodzą z deklaracji zestawu, a koszty z własnych pul. Obok arkusza nie podaje wtedy `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ani `saves` i nie musi mieć własnych akcji bloku:

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

Kontrola czyta bajty zasad i wszystkie pliki katalogu instalacji, jak w 1.27. Wiersz arkusza stworzenia może mieć `_catalog: "<catalog>/<entry>"` wskazujący wpis katalogu zasilającego listę; Engine ładuje te katalogi wraz z bestiariuszem. To nie jest miękki interfejs, jak w 1.20-1.33: nieznany klucz odrzuca cały ścisły plik katalogu, więc pakiet deklaruje 1.34. Bez uprawnień.

### Capability API 1.33: moment oczekiwany przez reakcję

`mechanics.reaction` wpisu katalogu może być obiektem zamiast `true`. `on` nazywa moment wykrywany przez Engine, `at` wskazuje cel wybranego działania, a `cancels` zatrzymuje akcję oczekującą w oknie:

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` to `aimed` (przed trafieniem posiadacza wpisu) lub `harmed` (po doznaniu obrażeń); wskazanie umieszcza wpis w menu tego okna. `at` to `source`, automatycznie wybierające sprawcę, lub `chosen`, zachowujące własne cele wpisu. Tylko wpis `aimed` może używać `cancel`: minionego zdarzenia nie można odwołać. Koszt anulowanej akcji pozostaje wydany, bo opłacono ją przed pytaniem.

`"reaction": true` oznacza jedynie działanie poza turą, co nie wystarcza do zaoferowania w oknie: nie pojawia się w menu i nie wymaga nowszej wersji. To nie jest miękki interfejs, jak w 1.20-1.32: Engine nieczytający obiektu odrzuca cały ścisły katalog, więc pakiet deklaruje 1.33. Bez uprawnień.

### Capability API 1.32: broń ograniczająca własne uderzenia

Źródło ataku może deklarować `strikesCappedBy`, logiczną kolumnę własnej listy. Zaznaczony wiersz kupuje jedno uderzenie niezależnie od `strikes` listy, więc broń strzelająca raz pozostaje przy jednym strzale, gdy reszta listy uderza tyle razy, ile mówi arkusz. Służy to zasadzie Loading z SRD 5.1: "you can fire only one piece of ammunition when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Wymaga towarzyszącego `strikes`; bez niego jest odrzucane, bo lista kupująca jedno uderzenie już ogranicza każdy wiersz. To nie jest miękki interfejs, jak w 1.20-1.31: nieznany klucz odrzuca cały plik zasad, więc pakiet deklaruje 1.32. Bez uprawnień.

### Capability API 1.31: integracje generowania hosta

Pakiety serwerowe mogą używać `api.runtime.integrations` do bieżących usług LLM, obrazów i wideo Engine. Zadeklaruj API 1.31 w manifeście i sprawdź dostępność hosta integracji podczas aktywacji. Starszy Engine odrzuca wymaganie przed aktywacją. Operacje dostawcy wymagają `network`; zapis, przygotowanie i usuwanie multimediów wymagają `storage`.

- `llm.createProvider(...)` przyjmuje ustawienia połączeń fabryki Engine, w tym własne parametry żądań i nagłówki. Zwrócony dostawca obsługuje `chat`, `chatComplete`, `embed`, `maxContextValue` i `maxTokensOverrideValue`, bez właściwości danych uwierzytelniających.
- `llm.localSidecar()` zwraca lokalnego dostawcę sidecar hosta przez tę samą fasadę.
- `llm.withFallback(...)` opakowuje dostawcę utworzonego przez ten sam host pakietu, zachowując dopuszczanie, powiadomienia zastępcze i wybór dostawcy Engine.
- `images.generate(...)` i `videos.generate(...)` korzystają z bieżących implementacji Engine, anulowania, logowania żądań, kontroli sieci i kolejek mediów. Przekazuj `signal` wywołującego i UI `debugMode`, jeśli są dostępne.
- `images.save`, `images.remove`, `images.stage` i `images.sweepStaged` używają bezpiecznych zapisów galerii i cyklu plików tymczasowych. `videos.save` i `videos.remove` korzystają ze ścieżki przechowywania wideo. `images.resolveNovelAiRequestSize` używa normalizacji rozmiaru NovelAI hosta. Normalizacja czasu wideo i publicznego wysyłania referencji jest dostępna jako `videos.resolveDuration` i `videos.resolveReferenceUpload`.
- `speech.transcribe(audio, { filename, mimeType, signal })` wysyła nagrany dźwięk do serwera zamiany mowy na tekst ustawionego przez użytkownika w **Connections → Speech to Text** i zwraca transkrypcję albo `null`, gdy ten serwer jest wyłączony – wtedy pakiet korzysta dalej z własnej transkrypcji. Stosuje politykę adresów URL hosta (`STT_LOCAL_URLS_ENABLED`) oraz limity rozmiaru i czasu, a zapisanego klucza nigdy nie ujawnia. `speech` jest opcjonalne i nie wymaga nowszego API możliwości: sprawdź `typeof api.runtime.integrations?.speech?.transcribe === "function"`, a w starszym Engine użyj rozwiązania zastępczego.

Typy żądań/wyników eksportuje `@marinara-engine/shared`. Budowanie promptów i orkiestrację pakietu zachowaj w nim; dla operacji dostawcy używaj tych punktów hosta zamiast kopiować usługi Engine. Czyste funkcje pomocnicze i typy nadal można dołączać do pakietu.

### Capability API 1.341: usługi uruchomieniowe hosta i współdzielone biblioteki serwera

Serwer pakietu, który dołącza własną kopię usługi silnika, uruchamia jej drugą instancję z osobnym stanem:
własnym połączeniem Intiface, własnym dopuszczaniem żądań do połączeń, własną kolejką metadanych czatu i własnym rejestrem usług.
Capability API 1.341 dodaje elementy `api.runtime`, które sięgają do działających instancji silnika, oraz pozwala
serwerom pakietów korzystać z kilku bibliotek silnika zamiast dołączać ich kopie. Każdy nowy element w
`CapabilityRuntimeHost` jest opcjonalny, więc przed użyciem sprawdź, czy istnieje.

- `runtime.services.get(key)` zwraca usługę zarejestrowaną przez pakiet za pomocą `api.registerService` albo `null`,
  gdy jej nie ma lub trwa generowanie we współdzielonym pokoju. Czyta rejestr silnika, więc każdy pakiet widzi tę samą usługę.
  Klucze `agent-runtime:` i `mari-actions:` zawsze zwracają `null`; odczytuje je tylko silnik.
- `runtime.commands.parse(content)`, `strip(content)` i `instructions()` odczytują komendy rozmowy zgodnie ze
  składnią silnika i zarejestrowanymi znacznikami wszystkich pakietów.
- `runtime.logger.isLevelEnabled(level)` informuje, czy logger silnika zapisuje obecnie dany poziom.
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })` to kolejkowana aktualizacja metadanych
  silnika: jedna kolejka na czat, wspólna z zapisami silnika, ochroną współdzielonego pokoju i numerami porządkowymi zapisów.
  Klucze z aktualizacji zastępują te klucze, a pozostałe pozostają bez zmian. `patch` może być funkcją bieżących metadanych.
  Wewnątrz `withChatLock` dla tego samego czatu wykonuje się w ramach tej blokady. Tak jak `updateChatMetadata`,
  odrzuca nowe odwołanie do obrazu z Global Gallery, który już nie istnieje.
- `runtime.persistence.appendMessages(chatId, messages)` dodaje wiadomości, każdą z pierwszym swipe'em, w jednej
  partii i je zwraca. `createChatNote` i `createChatInfluence` dodają notatkę lub jednorazowy wpływ z rozmowy do
  powiązanego z nią czatu w trybie Roleplay. Te cztery elementy zapisu wymagają `chat-write`.
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })` stosuje
  `[schedule_update]` tak jak silnik po odpowiedzi w trybie Conversation: tymczasowy status na karcie postaci,
  który postać pokazuje w każdym czacie do czasu jego wygaśnięcia. `status` to `online`, `idle`, `dnd` lub `offline`, `activity`
  ma najwyżej 500 znaków i wymagane jest przynajmniej jedno z tych dwóch pól. `duration` zapisuje się tak jak w komendzie (`2h`,
  `30m`); bez czasu trwania lub gdy nie da się go odczytać, status trwa 60 minut i nigdy dłużej niż tydzień. Metoda zwraca
  `{ status, activity, expiresAt }` lub `null`, gdy nic się nie zmieniło: status ustawiony ręcznie przez użytkownika zachowuje pierwszeństwo,
  a współdzielony pokój zachowuje własne rutyny. Odrzuca nieprawidłową aktualizację, czat inny niż w trybie Conversation
  i postać, której nie ma w czacie, i wymaga `chat-write`. Dodano ją do API możliwości 1.341 po
  pierwszych silnikach zgłaszających 1.341, więc sprawdź `typeof api.runtime.persistence.updateCharacterStatus === "function"` i
  pomiń zmianę statusu, gdy metody brakuje.
- `runtime.integrations.admission` to dopuszczanie żądań do połączeń przez silnik, więc zadania pakietu w tle czekają
  na własne żądania użytkownika w tym samym połączeniu. `withProvider(provider, connectionId, mode)` opakowuje dostawcę
  utworzonego przez integracje tego samego pakietu, `run(connectionId, mode, operation)` wykonuje jedną próbę,
  `tryBackground(connectionId)` zajmuje miejsce dla zadania w tle, gdy połączenie jest bezczynne, a `isFailure(error)`
  rozpoznaje błędy zajętości i odrzucenia przez silnik. Nie wymaga uprawnienia, bo tylko rezerwuje miejsca.
- `runtime.integrations.haptics` (`status`, `connect`, `executeCommand`) korzysta z jednego połączenia silnika z
  Intiface Central. Wymaga `network`.
- `runtime.integrations.spotify` (`commandsAvailable`, `playSong`) korzysta z konta Spotify agenta Music DJ.
  `playSong` odrzuca wywołanie z `ConversationSpotifyCommandError`; kody `spotify_unavailable` i
  `missing_playback_scope` oznaczają, że Spotify nie jest skonfigurowane, więc pomiń komendę bez komunikatu. Wymaga `network`.
- `runtime.integrations.speech.transcribeLocal(wav)` transkrybuje nagranie PCM WAV za pomocą modelu Local Whisper
  pobranego w **Connections** i odrzuca wywołanie z komunikatem silnika, jeśli model nie jest pobrany. Wymaga `network`.
- `runtime.integrations.images.addToChatGallery(input)` umieszcza obraz zapisany przez `images.save` w galerii czatu,
  a `images.persistToEntityGalleries(input)` umieszcza go w galeriach przedstawionych na nim postaci i person,
  tak jak obrazy wygenerowane przez silnik. Oba wymagają `storage`.

**Nigdy kopia dołączona do pakietu.** Gdy brakuje któregoś z tych elementów, pakiet zgłasza, że funkcja wymaga nowszej
aplikacji Marinara Engine. Nigdy nie sięga zastępczo po dołączoną do pakietu kopię stanowej usługi silnika, takiej jak
rejestr dostawców, lokalny sidecar, dopuszczanie żądań do połączeń, haptyka, Spotify, logger, rejestr czy kolejka zapisu,
bo druga kopia rozdziela stan, który silnik utrzymuje w jednym miejscu. Czyste funkcje pomocnicze i typy nadal można dołączać do pakietu.

**Współdzielone biblioteki serwera.** Serwer pakietu może nie dołączać `zod`, `adm-zip`, `dotenv`, `nanoid` i
`jsonrepair`, a zamiast tego importować je po nazwie, tak jak już może robić z `@huggingface/transformers`,
`onnxruntime-node`, `onnxruntime-web`, `sharp`, `pino`, `pino-pretty` i `undici`. Node odnajduje je z uruchomieniowej
kopii pakietu przez dwa dowiązania: z `<runtime copy>/node_modules` do `DATA_DIR/capability-packages/node_modules`,
a stamtąd do `packages/server/node_modules` silnika. Pakiet otrzymuje więc dokładnie tę samą instancję modułu co silnik.
pnpm trzyma tam tylko bezpośrednie zależności serwera, więc rozpoznawane są tylko te nazwy; zależność zależności,
na przykład `ws`, nie jest dostępna. Silnik zachowuje wymienione nazwy jako bezpośrednie zależności produkcyjne
`packages/server`, a każda instalacja zachowuje ten układ: instalacja ze źródeł i przez program uruchamiający,
system Windows (gdzie dowiązanie danych jest połączeniem katalogów), Android i Termux oraz oba obrazy Docker.
Przy uruchamianiu lub aktywacji pakietu silnik odbudowuje dowiązanie danych prowadzące gdzie indziej, w tym zerwane
dowiązanie pozostałe po przeniesieniu folderu danych z innej ścieżki instalacji. Elementy, które nie są dowiązaniami,
pozostają nietknięte.

**Deklarowanie.** Pakiet korzystający z któregokolwiek z tych elementów deklaruje `schemaVersion: 2`,
`capabilityApi: { major: 1, minor: 341 }` i `builtAgainst` oraz zachowuje swój zakres `engine`. Manifest
`schemaVersion: 1` nigdy nie jest sprawdzany względem API możliwości, więc przechodzi na wersję 2. Bramką jest API
możliwości, a nie wersja aplikacji Engine: silnik bez tych elementów odmawia instalacji lub aktualizacji
("Package requires capability API 1.341; this Engine supports ..."), pomija pakiet na liście aktualizacji i pozostawia
zainstalowaną wersję działającą.
