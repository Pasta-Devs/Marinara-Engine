# Plan rozwoju walki w trybie Game Mode

Dokument zapisuje uzgodniony kierunek dla [terenu hybrydowego #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) i dalszych prac nad walką. Oddziela plany od obecnego działania gry. Implementacja zaczyna się na gałęzi `staging`; nie oznacza to, że wszystkie poniższe możliwości są już dostępne.

## Oddziel uczestnictwo od zasad pola bitwy

Obecne wartości `combatStyle` to `classic` i `tactical`. Zachowaj je. Przyszłe przywoływanie stworzeń należy do osobnego ustawienia uczestnictwa, domyślnie wybierającego walkę drużynową dla starszych konfiguracji i zapisów. Presety tworzenia mogą ustawiać obie wartości bez dodawania kolejnego zapisywanego wyliczenia trybów:

| Preset | Uczestnictwo | Pole bitwy |
| --- | --- | --- |
| Drużyna | Gracz i towarzysze | Menu Classic |
| Przywoływanie (planowane) | Sterowane stworzenia; trener poza walką | Menu Classic |
| Taktyczny | Gracz i towarzysze | Siatka Tactical |
| Taktyczne przywoływanie (później) | Sterowane stworzenia; trener poza walką | Siatka Tactical |

Nie udostępniaj niedokończonych kombinacji. Towarzysze fabularni i jednostki bojowe to odrębne pojęcia; pozycja pierwszego członka drużyny w tablicy nie może stać się trwałym identyfikatorem sterowanej postaci.

## Aktualny priorytet implementacji: teren hybrydowy

GM dostarcza niewielki opis strukturalny wynikający ze sceny. Silnik ustala dokładny teren i pozycje początkowe z użyciem ziarna, sprawdza planszę i zapisuje wynik. Następnie GM opisuje zaakceptowane pole bitwy. Zwykły ruch i ataki nie wymagają wywołań modelu.

Rozszerz istniejący przepływ środowiska i formacji o opcjonalny rozmiar mapy, charakterystyczne miejsca, wskazówki gracza i ziarno do ponownego użycia. Zachowaj zgodność starszych konfiguracji. Zapisuj zaakceptowaną siatkę i informacje o generatorze, aby jego przyszła zmiana nie przerysowała istniejącej bitwy. Zapisane ziarno odtwarza generowanie dla tego samego opisu i uczestników; nie czyni dowolnej odpowiedzi modelu deterministyczną.

Wygenerowany teren można naprawiać, by zapewnić połączenia, lecz ograniczenia autora nie mogą znikać bez ostrzeżenia. Ogranicz rozmiar odpowiedzi modelu, liczbę pól i jednostek oraz wymiary elementów. Odrzucaj niewykonalny układ z wyjaśnieniem pozwalającym zareagować i proponuj jawny wariant z wygenerowanym terenem. Pełny edytor malowania i rozmieszczania oraz dowolne autorskie mapy to późniejsze prace, podlegające tym samym zasadom walidacji.

### Możliwości ruchu

Ruch pieszy, lot i teleportacja wymagają jednoznacznych zasad. Lot i teleportacja mogą przekraczać ściany, wodę i góry oraz pomijać dodatkowy koszt lasu. Premie terenu do obrony i uniku pozostają niezależne od rodzaju ruchu.

Brak rodzaju ruchu oznacza ruch pieszy w starszych starciach. Jawnie podany nieobsługiwany rodzaj jest odrzucany z błędem; nie zastępuj go po cichu ruchem pieszym. Ta walidacja dotyczy generowanych planów i danych wejściowych taktycznego API.

Oddziel przemieszczanie, dozwolone cele i zajętość pól. Teleportacja przez ścianę nie pozwala zakończyć ruchu w jej wnętrzu. Początkowa płaska siatka nie odwzorowuje wysokości, sufitów, wymogów widoczności zaklęć ani ograniczonego czasu lotu; opisz to ograniczenie zamiast deklarować pełne zasady gier stołowych. Używaj tych samych reguł legalności ruchu w podglądach, rozstrzyganiu, animacji ścieżki i AI wrogów.

## Zasady gier stołowych: wbudowane profile i narzędzia referencyjne dla GM-a

Priorytetem jest rozgrywka podobna do 5e i V20, a nie pełna gra o kolekcjonowaniu stworzeń. Dodawaj ograniczone, wersjonowane profile zasad w późniejszych zmianach. Wybierz dokładną edycję i obsługiwany podzbiór, zanim nazwiesz profil implementacją danego systemu.

Silnik powinien odpowiadać za rzeczywiste rzuty, legalne cele, ruch, pule akcji, zużycie zasobów i wyniki liczbowe. GM interpretuje fikcję, wybiera obsługiwaną operację, określa zamiary NPC i opisuje rzeczywisty wynik. Tekst wyszukany w lorebookach może dostarczać źródeł i zasad kampanii, ale nie może omijać mechanizmu rozstrzygania ani zmieniać wyników rzutów.

[Zgłoszenie #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) obejmuje semantyczne wyszukiwanie w lorebookach i opcjonalny dostęp przez narzędzie. Wyszukiwanie uzupełnia profile: pomaga GM-a znaleźć informacje, a jawne profile zasad zapewniają spójne i testowalne mechaniki. Unikaj osobnego wyszukiwania dla każdego zwykłego rzutu.

Zacznij od obsługiwanych podstaw testów, tur i zasobów. Profil oparty na d20 i profil puli d10 potrzebują różnych zasad rozstrzygania; jeden nie jest drugim pod nową nazwą. Przyszły zakres powinien obejmować inicjatywę, testy przeciwstawne, obrażenia i ich redukcję, stany oraz zużycie zasobów. Dokumentuj nieobsługiwane przypadki i jawnie pozostawiaj decyzję GM-a.

Taktyczna gra stołowa potrzebuje też wspólnych zasad linii widzenia i osłon. Obecna siatka blokuje ruch przez ściany, lecz ataki dystansowe oparte na odległości mogą je przekraczać. Aktualizuj wspólnie mechanizm rozstrzygania, AI, kontrataki, prognozy i nakładki zagrożeń. Zachowaj obecne fazy drużyny i wroga; indywidualna inicjatywa to osobny wybierany profil zasad.

## Przywoływanie: zachowaj projekt, odłóż większy system

Pierwszy etap może być niewielki: jedno aktywne stworzenie na stronę, własne rezerwy, trener poza walką, dobrowolna zmiana zużywająca polecenie i zapisywana pauza na zastępstwo po utracie przytomności. Porażka następuje, gdy nie ma stworzenia zdolnego do walki. Przedmioty trenera nie mogą dawać stworzeniu dodatkowej akcji.

Utrzymuj jeden skład oparty na trwałych identyfikatorach oraz identyfikatory aktywnych miejsc. Wyliczaj rezerwy i stan nieprzytomności zamiast utrzymywać konkurujące tablice. HP, zasoby i stany własnych stworzeń są trwałe; generator starć nie powinien wymyślać ich od nowa w każdej walce. Określ jawnie aktualizację stanów stworzeń rezerwowych.

Łapanie, ewolucja, hodowla, walki podwójne, czas trwania tymczasowego przywołania i przywoływanie taktyczne to osobne dodatki. Podsumowanie GM-a musi odróżniać nieprzytomne stworzenie od rannego trenera.

## Trwałość danych i dowody działania

Ustal obowiązujące zasady starcia przy rozpoczęciu bitwy. Nowe pola opcjonalne muszą zachowywać starsze zapisy Classic i Tactical. Import konfiguracji, niezmienne migawki tworzenia i podsumowania muszą zachowywać nowe wybory. Odświeżenie, restart, przeniesienie do następnej sesji, warianty odpowiedzi, rozgałęzienie i przywracanie punktu kontrolnego wymagają osobnych testów.

Przyszły stan bitwy zarządzany przez serwer powinien zapisywać zmiany bitwy i składu razem, z identyfikatorami starć, rewizjami i idempotentnymi identyfikatorami akcji. Wykorzystaj istniejące kolejki zapisu tam, gdzie pasują. Sprawdź przestrzenie nazw gier turowych i Experience przed ponownym użyciem `game_engine_state`; nie jest to automatycznie bezpieczny magazyn walki.

Dla każdej nowej reguły dodaj najmniejszy uruchamialny dowód `*.regression.ts`, uwzględniający odrzucone akcje i starsze dane. Weryfikacja w przeglądarce musi objąć konfigurację, rzeczywistą akcję taktyczną, odświeżenie, małe ekrany, kontrast motywów, fokus i klawiaturę oraz pomocne komunikaty błędów. Lokalizację i dokumentację użytkownika aktualizuj razem z implementacją.

## Wcześniejsze prace i punkty wejścia dla współtwórców

[Zamknięty, niescalony PR #4391](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391) na gałęzi `feat/game-mode-combat-expansion` zawiera szersze rozszerzenie sesji walki, manewrów, celów i bossów. To przydatny wcześniejszy projekt, nie obecne działanie gałęzi staging. Sprawdź właściciela i status przed wznowieniem prac; nie scalaj całego rozszerzenia jako warunku wdrożenia terenu.

Główne pliki aplikacji Engine to `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx` i `TacticalCombatUI.tsx`. Definicje agentów i Experience do pobrania oraz prompty należące do pakietów pozostają w Marinara-Agents, jeśli późniejsze prace ich dotyczą.
