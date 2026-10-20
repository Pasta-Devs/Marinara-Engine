# Plan przeciągania i upuszczania zasobów do czatu

## Status

Etapy od 1 do 4 zostały zaimplementowane w gałęzi `drag-me-baby-one-more-time` i scalone ze `staging`. Późniejsze prace (#7362) pozwalają przeciągać wiersze biblioteki bez uchwytu, pozwalają na ekranie dotykowym zebrać stos zgodnych zasobów stuknięciami drugiego palca i pokazują luki wstawiania przy zmianie kolejności.

Automatyczne testy resolvera działają. Powstały też testy Playwright dla komputera, obejmujące przypisanie postaci i podmianę persony, ale w obecnym kontenerze deweloperskim nie da się ich uruchomić lokalnie, bo Chromium nie ładuje `libnspr4.so`. Te przypadki przeglądarkowe musi wykonać CI albo środowisko z zależnościami systemowymi Playwright.

Zanim ruszą kolejne etapy, trzeba zastosować zasady koordynacji obowiązujące w repozytorium:

1. Sprawdź, czy istnieje już zgłoszenie, gałąź powiązana ze zgłoszeniem, wersja robocza PR albo pozycja na tablicy projektu dotycząca przeciągania zasobów do czatu.
2. Zaznacz w zgłoszeniu, kto bierze je na siebie.
3. Otwórz wersję roboczą PR do gałęzi `staging`, gdy zaczyna się implementacja.

## Cel

Obsługiwane zasoby mają dać się przeciągnąć z prawego panelu wprost do aktywnego czatu, bez wchodzenia w ustawienia czatu.

W środkowym oknie są dwa możliwe miejsca docelowe:

- **Obszar czatu:** zmiana trwałej konfiguracji aktywnego czatu.
- **Pole pisania:** dodanie obsługiwanego załącznika do przygotowywanej wiadomości.

To nie są uniwersalne miejsca upuszczenia. Miejsce docelowe pojawia się tylko wtedy, gdy przeciągany element ma tam prawdziwą, już obsługiwaną operację.

## Zasada produktowa

Przeciągnięcie wybiera zasób i miejsce docelowe. Aplikacja wykonuje wyłącznie operacje, które ma już w modelu danych czatu i w potoku generowania.

- Jedna dozwolona operacja dodająca: zastosuj od razu i zaproponuj Undo (cofnięcie).
- Jedna dozwolona operacja zastępująca: poproś o potwierdzenie, jeśli podmieni istniejącą wartość.
- Kilka naprawdę obsługiwanych operacji: pokaż mały wybór zawierający tylko te operacje.
- Brak dozwolonej operacji: nie aktywuj miejsca docelowego.
- Zasób już zastosowany: nie przyjmuj powtórnego upuszczenia.
- Bez domysłów: żadnego kontekstu na jedną turę, żadnego ukrytego wstawiania do promptu, żadnych sztucznych wzmianek ani ozdobnych kafelków.

## Obecne kontrakty

Istniejące kontrakty `Chat` i `ChatMetadata` obsługują takie trwałe operacje:

- Postacie: aktualizacja `Chat.characterIds`.
- Persona: aktualizacja `Chat.personaId`.
- Preset promptu: aktualizacja `Chat.promptPresetId`.
- Połączenie: aktualizacja `Chat.connectionId`.
- Lorebooki: aktualizacja `ChatMetadata.activeLorebookIds`.
- Agenci: aktualizacja `ChatMetadata.activeAgentIds`, a po zgodzie użytkownika także `ChatMetadata.enableAgents`.
- Tło czatu: aktualizacja istniejących metadanych tła czatu tą samą ścieżką przypisania, z której korzysta `BackgroundPicker`.

Obecne pola pisania obsługują załączniki plikowe. Nie obsługują na razie odwołań do postaci, lorebooka, agenta, persony, presetu ani połączenia w zasięgu pojedynczej wiadomości.

## Macierz obsługiwanych akcji

Resolver zdolności musi też pilnować obecnych ograniczeń trybu czatu i dostępności zasobu. Tabela opisuje operację przy założeniu, że interfejs już na nią pozwala w aktywnym trybie.

| Zasób | Obszar czatu | Pole pisania | Zachowanie po upuszczeniu |
| --- | --- | --- | --- |
| Postać | Dodanie identyfikatora do `characterIds` | Brak | Dodanie od razu; toast z Undo |
| Lorebook | Dodanie identyfikatora do `activeLorebookIds` | Brak | Dodanie od razu; toast z Undo |
| Agent | Dodanie identyfikatora do `activeAgentIds` | Brak | Dodanie od razu, gdy agenci są włączeni; w przeciwnym razie potwierdzenie włączenia agentów i dodania |
| Persona | Ustawienie `personaId` | Brak | Ustawienie od razu, gdy pole jest puste; potwierdzenie przy podmianie innej persony |
| Preset promptu | Ustawienie `promptPresetId` | Brak | Zgodnie z ograniczeniami trybu; ustawienie od razu, gdy pole jest puste; potwierdzenie przy podmianie innego presetu |
| Połączenie | Ustawienie `connectionId` | Brak | Potwierdzenie przy zmianie bieżącego połączenia, z nazwą starego i nowego |
| Tło czatu | Ustawienie istniejących metadanych tła czatu | Brak | Zgodnie z obecną semantyką przypisania tła; potwierdzenie podmiany tylko wtedy, gdy wymaga go obecna ścieżka |
| Obraz lub obsługiwany plik | Brak | Dodanie do załączników przygotowywanej wiadomości | Ponowne użycie obecnego potoku sprawdzania i przygotowania załączników |
| Folder postaci, lorebooków lub agentów | Brak | Brak | Brak miejsca docelowego |
| Kontrolka ustawień | Brak | Brak | Brak miejsca docelowego |
| Skrypt regex | Brak | Brak | Brak miejsca docelowego, dopóki nie powstanie kontrakt przypisania w zasięgu czatu |
| Własna funkcja lub narzędzie | Brak | Brak | Brak miejsca docelowego, dopóki nie powstanie kontrakt przypisania w zasięgu czatu |
| Wkład rozszerzenia | Domyślnie brak | Domyślnie brak | Tylko po samodzielnym włączeniu, przez przyszłe typowane API wkładów |

### Zasady trybów

Nie powielaj polityki trybów w obsłudze przeciągania. Resolver zdolności upuszczenia ma korzystać z tych samych predykatów co obecny interfejs konfiguracji i ustawień czatu.

Co najmniej:

- Presety promptów pozostają niedostępne w trybie Conversation, tak jak w `PresetsPanel`.
- Upuszczenie agenta wymaga, żeby agent był zainstalowany, dostępny i dozwolony w bieżącym trybie.
- Operacje na postaciach, personach, lorebookach, połączeniach i tłach pojawiają się tylko tam, gdzie dostępna jest ich zwykła kontrolka przypisania.
- Czat bez aktywnego identyfikatora nie udostępnia żadnego miejsca upuszczenia zasobu.
- Streaming ani praca agenta nie powinny blokować bezpiecznych aktualizacji metadanych, chyba że blokuje je już istniejąca ścieżka zapisu. Potwierdzenie podmiany musi przed zastosowaniem ponownie odczytać bieżący stan czatu.

## Projekt interakcji

### Początek przeciągania

Każdy obsługiwany wiersz panelu zapisuje jeden wersjonowany ładunek zasobu:

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Użyj jednego własnego typu MIME, na przykład `application/x-marinara-chat-resource`. Na czas migracji zachowaj dotychczasowe ładunki MIME folderów, bo zmiana kolejności folderów zostaje osobną, poprawną interpretacją tego samego przeciągnięcia.

Efekty przeciągania zasobu powinny deklarować `copyMove`:

- Miejsca docelowe folderów traktują przeciągnięcie jak przeniesienie.
- Miejsca docelowe czatu traktują je jak kopiowanie albo przypisanie.

Nie opieraj wewnętrznych operacji na zasobach o `text/plain`. Ten typ jest niejednoznaczny i zawiera dziś same identyfikatory.

### Widoczność miejsc docelowych

W stanie spoczynku miejsca upuszczenia są niewidoczne.

Gdy rozpoznane przeciągnięcie zasobu wchodzi w środkowe okno:

1. Przetwórz i sprawdź typowany ładunek.
2. Ustal dozwolone akcje względem najświeższego stanu aktywnego czatu.
3. Pokaż tylko dozwolone miejsca docelowe.
4. Użyj tekstu opisującego konkretną akcję, na przykład `Add Maris to this chat`, a nie ogólnego `Drop here`.
5. Pozostałe obszary zostaw bez zmian i bez możliwości upuszczenia.

Przy przeciąganiu obsługiwanego pliku podświetla się wyłącznie pole pisania. Przy przeciąganiu postaci, lorebooka, agenta, persony, presetu, połączenia albo tła w pierwszym wydaniu podświetla się wyłącznie obszar czatu.

### Upuszczenie na obszar czatu

Aktywne miejsce upuszczenia to bieżący obszar czatu, niezależnie od tego, jak przewinięty jest zapis czatu. Upuszczenie nad starą wiadomością nie wstawia historii ani nie zmienia kontekstu wstecz.

Po upuszczeniu:

1. Odczytaj ponownie identyfikator aktywnego czatu i jego bieżące dane.
2. Ustal zdolność jeszcze raz, żeby nie wykonać akcji nieaktualnej ani powtórzonej.
3. Zastosuj od razu, jeśli operacja tylko dodaje i nie budzi wątpliwości.
4. Przy podmianie albo włączaniu agentów otwórz krótkie okno potwierdzenia.
5. Sukces zgłoś przetłumaczonym toastem z akcją Undo.
6. Niepowodzenie zapisu zgłoś bez zmieniania zapisu czatu.

Nie twórz wiadomości w roli user, assistant, narrator ani system po to, żeby odnotować zmianę konfiguracji. Model wiadomości nie ma osobnego typu zdarzenia dla takich zmian, a zdarzenia konfiguracyjne nie mogą trafiać do historii widocznej dla modelu.

### Upuszczenie na pole pisania

Zachowaj obecne zachowanie plików w `ChatInput` i w `ConversationInput`:

- Sprawdzaj obsługiwane typy i limit rozmiaru 20 MB.
- Przygotowuj obrazy przez `prepareImageAttachment`.
- Wczytuj obsługiwane pliki tekstowe i PDF obecną ścieżką załączników.
- Zachowaj dotychczasowe zachowanie oczekujących załączników przypisanych do konkretnego czatu.

Zaostrz wykrywanie przeciągania w polu pisania, żeby wewnętrzne przeciągnięcia zasobów nie zapalały podświetlenia upuszczania plików, po którym i tak nic się nie dzieje.

### Potwierdzenie

Proś o potwierdzenie tylko wtedy, gdy operacja niesie realne skutki:

- Podmiana aktywnej persony.
- Podmiana aktywnego presetu promptu.
- Zmiana aktywnego połączenia.
- Włączenie agentów przy okazji dodawania agenta.
- Każda istniejąca ścieżka przypisania tła, która już teraz wymaga wyboru albo potwierdzenia podmiany.

Okno potwierdzenia musi tam, gdzie to możliwe, podać wartość obecną i proponowaną. Nie może zawierać akcji niezwiązanych z operacją, takich jak start nowego czatu, jednorazowe wywołanie agenta czy odwołanie się do zasobu w wiadomości.

### Undo

Undo przywraca dokładnie tę wartość, która obowiązywała przed upuszczeniem, a nie odtworzone przypuszczenie.

- Postać: przywrócenie całej poprzedniej tablicy `characterIds`.
- Lorebook: przywrócenie całej poprzedniej tablicy `activeLorebookIds`.
- Agent: przywrócenie zarówno `activeAgentIds`, jak i `enableAgents`.
- Persona, preset, połączenie i tło: przywrócenie poprzedniej wartości.

Zanim Undo się wykona, sprawdź, czy aktywny czat nadal ma wartość ustawioną przy upuszczeniu. Jeśli w międzyczasie inna zmiana ruszyła to samo pole, nie nadpisuj go: schowaj nieaktualne Undo i poinformuj użytkownika, że czat się zmienił.

## Architektura

### Wspólne narzędzie po stronie klienta

Dodaj wąski moduł klienta, roboczo `packages/client/src/lib/chat-resource-drag.ts`, zawierający:

- Stałą z typem MIME.
- Typ ładunku i parser działający w czasie wykonania.
- `writeChatResourceDragPayload(dataTransfer, payload)`.
- Wykrywanie przeciągania plików.
- Strażników rodzaju zasobu.

W pierwszym wydaniu trzymaj ładunek wyłącznie po stronie klienta, bo to stan interakcji w przeglądarce, a nie kontrakt API.

### Resolver zdolności

Dodaj czysty resolver, roboczo `packages/client/src/lib/chat-resource-drop-capabilities.ts`:

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

Na wejściu są: przetworzony ładunek zasobu, aktywny czat, znormalizowane metadane, bieżący tryb oraz identyfikatory dostępnych zasobów. Na wyjściu jest jedna konkretna akcja albo `null`.

Resolver odpowiada za:

- Odsiewanie duplikatów.
- Ograniczenia trybów.
- Filtrowanie wielu identyfikatorów naraz.
- Sprawdzenie, czy zasób jest zainstalowany i dostępny.
- Wykrycie podmiany.
- Wybór klucza tekstu akcji pokazywanego użytkownikowi.

Resolver nie zapisuje zmian ani nie rysuje interfejsu.

### Koordynator zapisu

Dodaj jeden hook blisko obszaru czatu, roboczo `use-chat-resource-drop.ts`, który:

- odczytuje najświeższy aktywny czat z React Query albo Zustand w chwili upuszczenia;
- wywołuje `useUpdateChat` dla pól czatu najwyższego poziomu;
- wywołuje `useUpdateChatMetadata` dla lorebooków i agentów;
- korzysta z istniejącej ścieżki zapisu przy przypisywaniu tła;
- otwiera przetłumaczone potwierdzenia przez dotychczasowych pomocników okien dialogowych;
- tworzy toasty sukcesu i błędu oraz zabezpieczone akcje Undo.

Nie umieszczaj logiki zapisu asynchronicznego w magazynie Zustand.

### Nakładka upuszczania

Dodaj jeden komponent prezentacyjny wokół wspólnej granicy środkowego czatu, zamiast osobnych wersji w każdym zapisie czatu:

- przyjmuje bieżący ładunek przeciągania i ustaloną akcję;
- zakrywa obszar czatu, ale nie zasłania pola pisania;
- liczy zagnieżdżenie zdarzeń `dragenter` i `dragleave`, żeby nakładka nie migotała nad elementami potomnymi;
- pokazuje ikonę, etykietę zasobu i przetłumaczony tekst akcji;
- dopasowuje się do rodzaju wskaźnika i do motywu.

Obszary trybu Conversation oraz Roleplay i Game mają prowadzić do tego samego koordynatora. Osobne otoczki mogą zadbać o geometrię danego obszaru, ale nie mogą powielać polityki zdolności.

### Podłączenie paneli

Przenoś przeciągalne wiersze stopniowo:

1. Postacie.
2. Lorebooki.
3. Agenci.
4. Persony.
5. Presety.
6. Połączenia.
7. Tła, jeśli da się czysto wykorzystać istniejący kontrakt przypisania.

Każdy wiersz zachowuje dotychczasowy ładunek przeciągania do folderu i dokłada ładunek zasobu czatu. Nie zmieniaj zachowania przenoszenia folderów.

## Etapy realizacji

### Etap 1: kontrakt przeciągania i nakładka na środku

- Dodanie narzędzia i parsera typowanego ładunku.
- Dodanie czystego resolvera zdolności dla postaci, lorebooków i agentów.
- Dodanie nakładki na środkowy obszar czatu oraz koordynatora zapisu.
- Podłączenie wierszy w panelach postaci, lorebooków i agentów.
- Dodanie przetłumaczonych tekstów akcji, potwierdzenia, sukcesu, błędu, duplikatu i Undo.
- Zadbanie o to, żeby wewnętrzne przeciągnięcia zasobów nie zapalały podświetlenia plików w polu pisania.

Ten etap potwierdza główną, dodającą ścieżkę pracy, o którą chodzi w tej funkcji.

### Etap 2: zasoby zastępujące

- Dodanie ładunków persony, presetu i połączenia.
- Dodanie wykrywania podmiany oraz przetłumaczonych okien potwierdzenia.
- Wykorzystanie istniejących ograniczeń trybów i hooków zapisu.
- Dodanie zabezpieczonego Undo dla operacji podmiany.

### Etap 3: przypisanie tła

- Ustalenie, czy dotychczasowa ścieżka wyboru tła przyjmie upuszczony identyfikator tła bez powielania polityki.
- Dodanie przeciągania tła tylko wtedy, gdy da się wykorzystać to samo przypisanie w zasięgu czatu.
- W przeciwnym razie tła zostają nieobsługiwane, a przeszkodę trzeba opisać w zgłoszeniu albo w PR.

### Etap 4: dotyk i równorzędność bez przeciągania

Najpierw powstaje przeciąganie HTML na komputerze. Wersja mobilna nie może wymagać precyzyjnego przeciągania między panelami.

- Dodanie akcji `Add to active chat` do istniejącego menu akcji każdego obsługiwanego wiersza.
- Ponowne użycie tego samego resolvera zdolności, potwierdzeń, zapisów i zachowania Undo.
- Jeśli przeciąganie dotykiem zostaje, użyj istniejących uchwytów przeciągania i ustal cel na środku przez `elementFromPoint`.
- Nie przeciążaj długiego przytrzymania na folderze tak, żeby porządkowanie zrobiło się nieprzewidywalne.

Bez tego etapu funkcja nie jest gotowa na urządzeniach mobilnych.

## Spodziewane zmiany w plikach

Prawdopodobnie nowe pliki:

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Prawdopodobnie zmienione pliki:

- `packages/client/src/components/chat/ChatArea.tsx` albo najwęższy wspólny właściciel środkowego obszaru.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, jeśli wymaga tego geometria obszaru.
- `packages/client/src/components/chat/ConversationView.tsx`, jeśli wymaga tego geometria obszaru.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, tylko na etapie 3.
- `packages/client/src/localization/locales/en.json` albo ścieżka kanonicznego pliku tekstów angielskich obowiązująca w chwili implementacji.

Etapy 1 i 2 nie powinny wymagać zmian na serwerze ani w pakiecie współdzielonym. Jeśli w trakcie implementacji okaże się, że jakaś operacja nie mieści się w istniejących trasach zmiany czatu, zatrzymaj się i przeskaluj plan, zamiast wprowadzać ukryty prompt albo nowy kontrakt zapisu.

## Wymagania dostępności i obsługi

- Nie polegaj na samym kolorze: pokaż ikonę zasobu i tekst akcji.
- Odpowiednik bez przeciągania musi być widoczny bez najeżdżania kursorem.
- Po oknach potwierdzenia da się poruszać klawiaturą, a po zamknięciu wracają one fokusem tam, gdzie był wcześniej.
- Klawisz Esc anuluje otwarte potwierdzenie.
- Czytniki ekranu dostają krótki komunikat, gdy pojawia się dozwolone miejsce upuszczenia oraz gdy operacja się udaje albo nie.
- Nakładki przeciągania nie mogą przechwytywać zwykłego przewijania, gdy nie trwa rozpoznane przeciąganie.
- Pola dotyku zachowują obowiązujące minimalne rozmiary mobilne.
- Przy ograniczonej animacji zmienia się przezroczystość i stan, bez zbędnego ruchu.

## Tłumaczenia

Cały nowy widoczny tekst korzysta z semantycznych kluczy tłumaczeń. Aktualizuj tylko kanoniczny plik tekstów angielskich; pakiety społecznościowe mogą awaryjnie pokazać angielski.

Kategorie tekstów:

- Etykiety akcji dla każdego rodzaju zasobu.
- Potwierdzenia podmiany.
- Potwierdzenie włączenia agentów.
- Toasty sukcesu i niepowodzenia.
- Komunikaty Undo oraz nieaktualnego Undo.
- Komunikaty dla technologii wspomagających.
- Informacja o duplikacie albo już aktywnym zasobie, jeśli się pojawia.
- Akcje `Add to active chat` dostępne bez przeciągania.

## Testy

Nie zostawiaj tymczasowych plików `.test.ts` w repozytorium.

### Czyste testy regresyjne

Stałe testy resolvera zdolności dodawaj wyłącznie w obsługiwanym już miejscu i formacie testów regresyjnych:

- Brak postaci -> akcja dodania.
- Postać już obecna -> brak akcji.
- Ładunek z wieloma postaciami, częściowo już obecnymi -> dodanie tylko brakujących, poprawnych identyfikatorów.
- Brak lorebooka -> akcja dodania.
- Lorebook już aktywny -> brak akcji.
- Brak agenta przy włączonych agentach -> akcja dodania.
- Brak agenta przy wyłączonych agentach -> akcja dodania wymagająca włączenia.
- Agent niedostępny -> brak akcji.
- Persona przy braku obecnej persony -> akcja ustawienia bez podmiany.
- Persona podmieniająca inną -> akcja podmiany.
- Preset w nieobsługiwanym trybie -> brak akcji.
- Połączenie takie samo jak obecne -> brak akcji.
- Zła wersja, nieznany rodzaj, uszkodzone identyfikatory i zbyt duży ładunek -> odrzucenie.

### Testy dymne w przeglądarce

Rozszerz `pnpm smoke:ui` tam, gdzie to praktyczne:

- Przeciągnij postać z panelu na obszar czatu i sprawdź przypisanie.
- Użyj Undo i sprawdź, czy wraca poprzednia lista postaci.
- Sprawdź, czy przeciągnięcie postaci nad pole pisania nie pokazuje reakcji na upuszczenie pliku.
- Przeciągnij obsługiwany plik nad pole pisania i sprawdź, czy załączanie działa jak wcześniej.
- Sprawdź, czy już aktywny zasób nie ma aktywnego miejsca upuszczenia.
- Sprawdź, czy anulowanie potwierdzenia podmiany nie zapisuje żadnej zmiany.
- Sprawdź, czy potwierdzona podmiana aktualizuje czat.
- Sprawdź, czy przeciąganie do folderów nadal przenosi zasoby w panelu.

### Weryfikacja ręczna

Sprawdź na komputerze w trybach Conversation, Roleplay i Game, tam gdzie są obsługiwane:

- Motyw ciemny i jasny.
- Otwarty prawy panel przy długim, przewiniętym zapisie czatu.
- Upuszczenie dodające, powtórzone, podmianę, anulowanie, błąd, Undo oraz nieaktualne Undo.
- Przeciąganie nad zagnieżdżonymi elementami zapisu czatu bez migotania nakładki.
- Dotychczasowe przenoszenie folderów w panelu.
- Dotychczasowe upuszczanie plików i obrazów w obu polach pisania.

Sprawdź na widoku mobilnym, ze wskaźnikiem o małej precyzji:

- Równorzędną akcję `Add to active chat` bez przeciągania.
- Czy dotykowe przeciąganie folderów nadal da się obsłużyć.
- Czy okna potwierdzenia mieszczą się i dają się zamknąć.
- Czy teksty i kontrolki na siebie nie nachodzą.

Wymagane polecenia:

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

`pnpm regression:prompt` jest obowiązkowe przed scaleniem: zmiana w `LorebooksPanel.tsx` wpływa na aktywację lorebooków, a ta zasila składanie promptu.

## Ryzyka i sposoby zaradzenia

### Konflikt z istniejącym przeciąganiem do folderów

Ryzyko: te same wiersze już teraz korzystają z przeciągania, żeby przenosić elementy do folderów.

Zaradzenie: zachowaj dotychczasowe typy MIME folderów, dodaj osobny typowany typ MIME zasobu czatu i pozwól, żeby każde miejsce docelowe czytało tylko swój ładunek. Sprawdź działanie `copyMove` oraz regresje folderów.

### Fałszywe podświetlenie pola pisania

Ryzyko: obecna obsługa `dragover` w polu pisania reaguje na każde przeciągnięcie, także na wewnętrzne identyfikatory zasobów.

Zaradzenie: włączaj reakcję pola pisania tylko wtedy, gdy `DataTransfer.types` albo `DataTransfer.items` wskazuje pliki lub inny wyraźnie obsługiwany ładunek załącznika.

### Nieaktualny stan czatu

Ryzyko: aktywny czat albo przypisane zasoby mogą się zmienić między początkiem przeciągania, upuszczeniem, potwierdzeniem i Undo.

Zaradzenie: ustalaj akcję na bieżącym stanie przy upuszczeniu i jeszcze raz przed zapisem oraz przed Undo. Zabezpiecz Undo przed nadpisaniem nowszych zmian.

### Rozjazd polityki trybów

Ryzyko: przeciąganie mogłoby przepuścić przypisanie, którego interfejs konfiguracji i ustawień zabrania.

Zaradzenie: wyciągnij albo wykorzystaj wspólne predykaty z istniejących ścieżek przypisania. Nie wpisuj na sztywno drugiej macierzy polityki w komponentach paneli.

### Ukryte rozszerzenie zachowania

Ryzyko: przyjęcie zasobu na oko w polu pisania sugerowałoby kontekst na jedną turę, którego serwer wcale nie uwzględnia.

Zaradzenie: upuszczanie zasobów na pole pisania zostaje wyłączone, dopóki nie powstanie osobno zaprojektowany kontrakt kontekstu w zasięgu wiadomości.

### Upuszczanie dużych zaznaczeń

Ryzyko: przeciąganie w trybie zaznaczania mogłoby dodać nieoczekiwanie duży zestaw postaci, lorebooków albo agentów.

Zaradzenie: odsiewaj niepoprawne i już aktywne identyfikatory, trzymaj się limitów serwera i trybu, a przy upuszczeniu wielu elementów proś o potwierdzenie, gdy przekracza ono istniejący próg. Nie wymyślaj nowego, dowolnego limitu.

## Wyraźnie poza zakresem

- Upuszczenie zasobu na starą wiadomość.
- Wsteczna zmiana historii promptu.
- Dopisywanie zmian konfiguracji jako wiadomości w zapisie czatu.
- Postacie, lorebooki, persony, presety, połączenia i agenci na jedną turę.
- Wywołanie agenta przez upuszczenie na pole pisania.
- Start nowego czatu po upuszczeniu na środkowy obszar.
- Przeciąganie dowolnych ustawień do czatu.
- Ogólne API upuszczania dla wtyczek w pierwszym wydaniu.
- Przeciąganie między czatami, z zapisu jednego czatu do drugiego.

## Kryteria odbioru

Etap 1 jest gotowy, gdy:

- postać, lorebook albo agenta da się przeciągnąć z wiersza w prawym panelu na dozwolony obszar aktywnego czatu;
- aktualizuje się właściwe pole czatu i nie powstaje przy tym żadna wiadomość w zapisie czatu;
- zasoby już aktywne oraz niedostępne nie są przyjmowane;
- dodanie agenta przy wyłączonych agentach wymaga wyraźnego potwierdzenia;
- każdy udany zapis daje zabezpieczone Undo;
- przeciąganie zasobów nie wywołuje reakcji załącznika w polu pisania;
- dotychczasowe upuszczanie załączników plikowych działa w obu polach pisania;
- dotychczasowe przeciąganie do folderów zachowuje się tak samo;
- cały nowy widoczny tekst ma tłumaczenia;
- komputer i urządzenie mobilne mają równorzędne akcje, nawet jeśli wersja mobilna korzysta z akcji w menu zamiast z przeciągania między panelami;
- `pnpm localization:check`, `pnpm check` i odpowiednie testy dymne interfejsu przechodzą.

Cała funkcja jest gotowa dopiero wtedy, gdy powstaną też zasoby zastępujące z etapu 2 oraz wymagana równorzędność mobilna. Przypisanie tła pozostaje opcjonalne, dopóki etap 3 nie potwierdzi, że jego dotychczasową semantykę da się wykorzystać bez powielania polityki.

## Odłożone rozszerzenie

Przyszła funkcja kontekstu w zasięgu wiadomości może sprawić, że postacie, lorebooki, agenci, persony, presety i połączenia staną się poprawnymi celami upuszczenia w polu pisania. Taka praca wymaga osobnego kontraktu współdzielonego i serwerowego, który opisze zapis, składanie promptu, budżet tokenów, kierowanie ruchu do dostawcy, wyświetlanie, odtwarzanie wersji roboczej oraz zasady historii wiadomości. Nie wolno przemycić jej do tej funkcji jako kafelków istniejących tylko po stronie klienta.
