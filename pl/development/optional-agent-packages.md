# Opcjonalne pakiety agentów i możliwości

Status: zaimplementowane w cyklu rozwojowym v2.3.0 w zgłoszeniu #3612.

## Cel

Podstawowa dystrybucja aplikacji Marinara Engine nie może kompilować ani dostarczać opcjonalnych implementacji agentów i możliwości. Świeża instalacja startuje bez żadnych opcjonalnych pakietów. Aktualizacja zachowuje możliwości, które były dostępne przed wprowadzeniem tego systemu pakietów.

Oficjalny katalog, źródła pakietów, powtarzalne artefakty, skrypty walidacyjne i proces współtworzenia znajdziesz w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Zainstalowane artefakty lądują wewnątrz skonfigurowanego folderu danych aplikacji Marinara Engine, więc aktualizacja aplikacji ich nie nadpisze.

## Model pakietu

Pakiet agenta może wnosić jednego lub kilku deklaratywnych agentów oraz opcjonalne zaufane możliwości wykonywalne:

- serwerowe punkty wejścia dla tras, haków cyklu życia, dostawców promptów, obsługi wyników i migracji magazynu danych;
- klienckie punkty wejścia dla paneli, powierzchni czatu, sekcji ustawień, wyborów w kreatorze konfiguracji i widoków czasu wykonania;
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

`api.runtime.resolveEmbeddings()` zwraca nowe `Promise<CapabilityEmbeddingHost>` według bieżącej konfiguracji połączenia agenta pakietu. Wywołuj je na początku operacji embeddingów zamiast buforować `api.runtime.embeddings`: to migawka z aktywacji, która bez ponownej aktywacji nie śledzi zmian połączenia.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

Zwrócony host ma `spaceId`, `label` i `embed(texts, signal?)`. Rozwiązywanie korzysta ze skonfigurowanego źródła embeddingów, a gdy żadne nie jest dostępne lub konfiguracja zawodzi, wraca do wbudowanego lokalnego MiniLM. `embed` może zwrócić `null`; puste partie, ponad 128 tekstów lub ponad 200 000 znaków łącznie są odrzucane. Nowy host nie przelicza istniejących wektorów, więc pakiet musi obsłużyć zmianę `spaceId`, zanim porówna nowe wektory z zapisanymi.

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

Host blokuje **Start Game**, potwierdzenie przygotowania widżetów i ponowne próby pierwszej tury, dopóki nie otrzyma ciągu oznaczającego gotowość. Podczas blokady własny interfejs ładowania oraz błędu i ponowienia pakietu pozostaje widoczny. Po uzyskaniu gotowości pakiet jest ukryty za zwykłym wprowadzeniem Engine. **Continue** otwiera zwykłą powierzchnię, która może zostać zamontowana ponownie: zadbaj o idempotentne przygotowanie świata i odtwarzaj zapisany stan zamiast generować go od nowa. Powrót do gry, w której wprowadzenie już się zakończyło, nie powtarza przygotowania startowego.

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

Kod środowiska pakietu nie ma jeszcze sposobu na bezpośrednie pytanie modelu decyzyjnego. Wymaga to własnej metody API możliwości i podniesienia wersji.

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

Przy starcie serwera host pobiera katalog jeden raz, o ile zainstalowany jest przynajmniej jeden oficjalny pakiet. Wybiera tylko nowsze wersje zgodne z działającym silnikiem i z API możliwości, weryfikuje je zwykłym potokiem instalacyjnym i instaluje jeszcze przed aktywacją środowisk uruchomieniowych pakietów. Awarie są izolowane osobno dla każdego pakietu. Gdy katalog jest niedostępny albo weryfikacja się nie powiedzie, dotychczasowe pliki i stan rejestru nadal działają, a niepowodzenie gotowości środowiska serwerowego korzysta ze ścieżki wycofania do poprzedniej wersji.

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

Panel **Agents** (Agenci) zawiera przycisk `Download Agents`, który odpowiada przyciskowi `Download Cards` w panelu Card Browser. Otwiera on pełnoekranową, responsywną bibliotekę z wyszukiwaniem, rodzajami pakietów, informacją o zgodności, stanem instalacji i aktualizacji, uprawnieniami, kosztem miejsca na dysku, dokumentacją oraz przyciskami odinstalowania.

Na komputerze widać listę do przeglądania i sąsiadujący z nią obszar szczegółów. Na telefonie jest jeden panel, z jawną nawigacją wstecz i akcjami wygodnymi pod palec. Stany pusty, offline, niezgodny, uszkodzone pobieranie, przerwana instalacja, aktualizacja, wycofanie i wymagany restart są obsłużone pełnoprawnie.

## Warunek zakończenia wydzielenia

Wydzielenie jest kompletne dopiero wtedy, gdy podstawowe produkcyjne paczki klienta i serwera nie zawierają już implementacji pakietu, świeża instalacja nie potrafi jej aktywować bez pobrania pakietu, instalacja po aktualizacji ją zachowuje, a instalacja, aktualizacja i odinstalowanie pakietu przechodzą pomyślnie na komputerze, telefonie i systemach plików zgodnych z Termux.

### Capability API 1.20: zestawy zasad Game Mode

Zestaw zasad to sprawdzone dane: obsługiwany przez Engine sposób rozstrzygania testów, arkusz z zamkniętego zbioru elementów, odpoczynki i wskazówki do promptu GM. Pakiet dostarcza zastrzeżony zasób `ruleset.json`, wykrywany tak jak `gm-verbs.json`: wpisany w `contributions.assets.paths` i powiązany z hashem w `files[]`.

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

Przykład pokazuje tylko pola istotne dla zestawu. Nadal wymagane są `name`, `version`, `description`, `engine` i `builtAgainst`. Nie potrzeba uprawnień, agenta ani punktów wejścia klienta lub serwera. Typ `ruleset` wymaga `ruleset.json`, a ten plik wymaga tego typu. Plik nie wykonuje kodu ani wyrażeń tekstowych; nowa mechanika rozstrzygania wymaga zmiany Engine. Format i przykład 5e opisuje [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

To twarda granica zgodności: manifest z tym zasobem musi deklarować API 1.20; starszy Engine odmawia instalacji. Engine odrzuca deklarowany rozmiar powyżej 256 KB przed odczytem, ponownie sprawdza hash instalacji i waliduje plik ścisłym schematem `packages/shared/src/schemas/ruleset.schema.ts`. Nieprawidłowy plik zostaje pominięty z jednym wpisem dziennika wskazującym pakiet i pierwsze błędy `path: message`. Przy powtórzonym identyfikatorze wygrywa pierwszy pakiet według kolejności identyfikatorów pakietów; drugi jest pomijany z wpisem dziennika. `engine-legacy` i `traditional` są zastrzeżone dla Engine.

Gra zapisuje wybór raz w `chat.metadata.gameRuleset`. Brak przypisania oznacza dotychczasowe zasady Engine. Brak pakietu lub starsza definicja oznaczają niedostępny zestaw, nie zastąpienie go innymi zasadami. Przypisanie sprawdza identyfikator zestawu oraz pakiet dostawcy, więc inny pakiet nie przejmie gry przez powtórzenie identyfikatora.

### Capability API 1.21: katalogi zestawów zasad

Katalogi dostarczają gotowe zaklęcia, zdolności klas i ekwipunek do selektora w edytorze arkusza. Nagłówek znajduje się w `ruleset.json` pod `catalogs`; wpisy mogą być tam bezpośrednio lub w osobnym zastrzeżonym zasobie:

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

Nazwa `catalogs/<id>.json` odpowiada identyfikatorowi katalogu; katalog nie może wskazać pliku innego katalogu. Zasób ma hash w `files[]`, występuje tylko obok deklarującego go `ruleset.json` i jest odrzucany przed odczytem przy deklarowanym rozmiarze powyżej 1 MB. Walidacja względem tego samego arkusza jest taka sama dla wpisów wbudowanych i plikowych. Limit to 12 katalogów na zestaw i 2000 wpisów na katalog.

Klient pobiera katalog dopiero po otwarciu selektora przez `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. Lista zainstalowanych zestawów zawiera liczbę wpisów, nie ich treść. Tekst katalogu nie trafia do promptu: GM widzi tylko to, co wskazuje `gm.sheetSummary`, więc katalog sam nie zużywa tokenów. Zasób katalogu wymaga API 1.21; instalacja sprawdza też deklarację przy kluczu `catalogs` wewnątrz zweryfikowanego `ruleset.json`. Starszy ścisły schemat odrzuciłby cały plik. Uprawnienia nie są potrzebne.

### Capability API 1.22: blok battle

Opcjonalny `battle` wskazuje bieżącą pulę zdrowia, opcjonalną pulę MP, pule komórek zaklęć oraz listy, których wiersze z katalogu stają się `CombatSkill`. Po walce zdrowie, energia i komórki wracają przez te same operacje arkusza, których używają przyciski gracza.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

To połączenie danych z walką Engine, nie pełny adapter systemu stołowego. Obliczenia obrażeń pozostają wbudowane; most nie używa `attackRoll`, `save`, `concentration` ani `perCostStep` wpisu katalogu. Dokładne zasady systemu należą do osobnego przekazania walki adapterom. `coverage.combat` zachowuje własne znaczenie i nie jest odczytywane przez most. Instalacja sprawdza zweryfikowaną zawartość `ruleset.json` i odrzuca `battle` przy deklaracji poniżej API 1.22, tak jak `catalogs` poniżej 1.21. Bez uprawnień i bez zmian dla zestawu bez tego bloku.

### Capability API 1.23: skalowane wartości katalogu

Wiersz wpisu katalogu może mieć `scaled`: mapę maksymalnie czterech własnych kolumn liczbowych, które utrzymuje zestaw. Każda używa zwykłego odwołania do wartości i opcjonalnej tabeli progów, np. zasób klasy zależny od poziomu lub użycia zależne od cechy, bez nowej arytmetyki formatu.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Wartość jest przeliczana przy edycji, nie przy odczycie. Stan gry, prompt GM i most walki czytają zapisaną liczbę. Wiersz może być w `ruleset.json` lub `catalogs/<id>.json`; oba pliki są zasobami manifestu. Instalacja sprawdza ich zweryfikowaną treść i odrzuca `scaled` poniżej API 1.23, tak jak wcześniejsze bramki katalogów i walki. Bez uprawnień i bez zmian dla katalogów bez skalowania.

Ta wersja dodaje też `[sheet: op="use" name="..."]`, opłacające `mechanics.cost` wpisu oraz po jednym użyciu każdej puli wiersza utworzonej przez ten wpis. Polecenie nie wymaga nowej deklaracji: czyta już obsługiwane katalogi.

### Capability API 1.24: pule kości

`resolution` może deklarować `"kind": "dice-pool"` zamiast `"dice-sum"`. Liczba z arkusza określa liczbę kości; silnik liczy wyniki osiągające próg. Zestaw może określać podwójne sukcesy, eksplodujące i anulujące wyniki, pech, wyjątkowe sukcesy oraz zakres kości dodawanych lub odejmowanych przez GM za okoliczności.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Arkusz pozostaje ten sam: wartość dodawana do rzutu w `dice-sum` oznacza tutaj liczbę kości. Nie powstają nowe elementy arkusza, slot edytora ani kod pakietu. Instalacja odczytuje zweryfikowany `ruleset.json` i odrzuca `dice-pool` przy deklaracji poniżej 1.24; starszy Engine obsługujący tylko `dice-sum` odrzuciłby cały plik. Bez uprawnień i bez zmian dla zestawu sumującego kości.

### Capability API 1.25: warstwy i wskazówki świata

Opcjonalne `layers` to nazwane warianty wybierane przy tworzeniu gry i utrwalane w jej przypisaniu na cały czas gry. Blok `gm` może zawierać opcjonalny tekst `worldGuidance`. `gm.worldGuidance` jest czytany raz podczas tworzenia świata, aby pasował on do zasad drużyny.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Zamknięty zbiór efektów warstw pozwala dopisywać wskazówki po wskazówkach zestawu, usuwać wartości pól wyliczeniowych, zastępować skalę trudności skalą tego samego rodzaju rozstrzygania i ukrywać wpisy katalogu w selektorze arkusza. Nie dodaje nowych elementów arkusza, więc arkusze pozostają czytelne niezależnie od warstw. Brak kodu pakietu i dodatkowego wywołania modelu. Warstwy innych autorów są planowane później. Instalacja odrzuca `layers` i `gm.worldGuidance` poniżej API 1.25 po sprawdzeniu zweryfikowanej treści. Bez uprawnień i bez zmian dla zestawów bez obu pól.

### Capability API 1.26: rodzimy format walki zestawu

API 1.26 dodaje opcjonalny `combat`: rzuty, cele, ekonomię akcji, listy ataków i zdolności, stany, koncentrację, zasady przy zerowym zdrowiu, typy obrażeń i skalę przeciwników. `mechanics` wpisów katalogu może opisywać liczbę celów, pewne trafienie, stany, punkty tymczasowe, skalowanie z arkuszem i zużywany budżet.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

### Capability API 1.27: bestiariusze zestawu

API 1.27 pozwala katalogowi deklarować `"holds": "creatures"`. Bloki stworzeń używają liczb z `combat`: zdrowia jako liczby lub rzutu na początku walki, obrony, inicjatywy, cech i obron według identyfikatorów arkusza, odporności, podatności i niewrażliwości na obrażenia, niewrażliwości na stany, poziomu zagrożenia oraz cech pokazywanych GM. Akcje mogą trafiać, wymuszać obronę, nakładać stan, mieć limit użyć, odnawiać się rzutem, wykonywać sekwencję innych akcji za jeden budżet albo kosztować własne punkty specjalne stworzenia.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Katalog stworzeń nie deklaruje `feeds` i nie pojawia się w selektorze arkusza. Przy włączonym reżyserze walki gra z `combat` używa tych zasad i bestiariusza na ekranie bitwy oraz zapisuje arkusze po każdym działaniu. To styl `ruleset`, który nie wymaga osobnego poziomu Capability API. Bez `combat` nadal działa blok `battle` albo wybrane Classic/Tactical. Instalacja sprawdza zweryfikowane `ruleset.json` i `catalogs/<id>.json`: `combat` i nowe klucze `mechanics` wymagają 1.26, a `holds` i `creature` — 1.27. Starszy ścisły schemat odrzuciłby plik. Nie ma nowych uprawnień ani zmian dla zestawów bez tych pól.

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

Wszystkie trzy pola są opcjonalne. Zadeklarowane ziarno pojawia się pod wybranym Experience z przyciskiem **Randomize** (Losuj). Pusta lub nieskończona wartość albo wartość niebędąca liczbą blokuje **Start** (Rozpocznij). Host zapisuje liczbowe ziarno i zadeklarowane stałe w `experienceConfig`; `config` nie może zawierać klucza ziarna. Stałe po serializacji muszą mieścić się w 8 000 znaków. Etykieta ziarna to tekst wyświetlany autorstwa pakietu; pomiń ją, aby użyć zlokalizowanej etykiety Engine.

Zadeklarowane wymaganie dotyczące widżetów ustala wartość domyślną tylko do chwili, gdy gracz zmieni tę kontrolkę. Wyłączenie Experience przywraca zwykłą wartość domyślną, a jawne wybory gracza pozostają bez zmian. Kontrolka wyjaśnia oczekiwanie Experience i nadal można ją edytować. Dla tych Experiences kontrolki konfiguracji mapy przestrzennej są ukryte, więc nie uruchamia się osobny szkic mapy, szablon ani kreator.

Krok **Lorebooks** (Lorebooki) pozwala wybrać do 100 pojedynczych włączonych wpisów, także z niepodłączonych książek. Wyłączone książki i wpisy oraz wykluczenia czatu są respektowane. Identyfikatory trafiają do `GameSetupConfig.activeLorebookEntryIds`. W `/game/setup` są to dodatkowe wymuszone wpisy: pomijają losowanie prawdopodobieństwa, ale zachowują zwykłe limity tokenów. Lore globalne, powiązane z postaciami i podłączone nadal uczestniczy w zwykłym skanowaniu. Pakiety mogą odczytać te same wybrane identyfikatory z konfiguracji na potrzeby własnego żądania generowania świata.

Import pliku konfiguracji odtwarza zainstalowane, zgodne Experience i jego poprawne liczbowe ziarno, ale odrzuca dowolną konfigurację pakietu. Stałe są ponownie dostarczane przez bieżący manifest. Istniejące gry pomijają import Experience z wyjaśnieniem. Migawki utworzenia zachowują nazwę Experience i ziarno do podsumowania konfiguracji.

Gdy świat musi być przygotowany przed pierwszą turą, niezależnie użyj istniejącej deklaracji gotowości startowej. Zadeklaruj API 1.18 jako minimum pakietu; starsze hosty nie potrafią zinterpretować tej deklaracji konfiguracji.

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

Typy żądań/wyników eksportuje `@marinara-engine/shared`. Budowanie promptów i orkiestrację pakietu zachowaj w nim; dla operacji dostawcy używaj tych punktów hosta zamiast kopiować usługi Engine. Czyste funkcje pomocnicze i typy nadal można dołączać do pakietu.
