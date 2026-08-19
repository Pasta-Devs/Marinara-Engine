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
