# Opcjonalna gra wieloosobowa

Śledzenie implementacji: [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790). Dokument opisuje granice implementacji i wymagane dowody. Nie stwierdza, że gra wieloosobowa jest dostępna ani że dana platforma przeszła testy.

<a id="smallest-architecture"></a>

## Minimalna architektura

Jeden gospodarz posiada nowy wspólny czat, zapisany stan gry i połączenia AI. Wybiera ludzi i postacie AI bez stałego limitu uczestników lub kart. Conversation, Roleplay i Game zachowują istniejące tryby. Zaproszenie nigdy nie udostępnia starej prywatnej historii.

Transport to osobny serwer HTTPS z małymi akcjami JSON i ograniczonym długim odpytywaniem. Fastify, Node HTTPS i Zod są już zainstalowane. WebRTC dodałby sygnalizację, konfigurację ICE/TURN i problemy z czasem życia mobilnej karty gospodarza; WebSocket wymagałby kolejnej zależności serwerowej i parsera strumieniowego. Prywatne wspólne czaty wykorzystują HTTPS bez tych dodatków. To jedyny transport pokoju. Nasłuch rejestruje wyłącznie operacje pokoju, nigdy zwykłe API Engine. Gość łączy się bezpośrednio z gospodarzem, bez centralnego pośrednika. Zaproszenie nie daje dostępu do plików, bibliotek, ustawień, danych logowania ani innych czatów drugiej strony. Zwykły port administracyjny Engine pozostaje prywatny; do zaproszenia trafia tylko oddzielny port pokoju.

Własny zaufany Engine gościa łączy się z gospodarzem. TLS musi zweryfikować łańcuch certyfikatu i nazwę hosta; zaproszenie dodatkowo przypina odcisk certyfikatu gospodarza. Sprawdź to powiązanie przed wysłaniem hasła lub persony. Nie podążaj za przekierowaniami, nie przechodź na HTTP, nie wyłączaj weryfikacji certyfikatów ani nie konfiguruj automatycznego przekierowania routera. Gospodarz ustawia adres HTTPS i certyfikat za pomocą istniejących funkcji TLS.

Widok gościa to zaufany dostarczony kod w piaskownicy o nieprzezroczystym pochodzeniu, bez sieci, pobierania, nawigacji, pamięci, mostka natywnego i dostępu administracyjnego. Uwierzytelniony MessageChannel przenosi tylko zweryfikowane projekcje pokoju i mały jawny zbiór akcji. Rodzic dostarcza lokalne preferencje wyglądu; uczestnicy nie dostarczają stylów, zasobów, kodu, adresów do pobrania ani dowolnych wywołań API. Tekst uczestników jest wyświetlany jako tekst. Istniejące rozbudowane renderery czatów leżą poza tą granicą. Natywna aplikacja opakowująca na Androidzie wstrzykuje mostek do każdej ramki i musi pozostać niedostępna dla gości, dopóki kontekst bez mostka nie zostanie wdrożony i sprawdzony na fizycznym urządzeniu.

<a id="trust-boundaries"></a>

## Granice zaufania

| Granica | Egzekwowanie |
| --- | --- |
| Administrator lokalny do kontrolera pokoju | Istniejące Basic Auth, CSRF, weryfikacja hosta i natywne uwierzytelnianie lokalne pozostają bez zmian. |
| Engine gościa do nasłuchu uczestnika | HTTPS, powiązanie odcisku, osobne hasło, zatwierdzenie, wygasające losowe sesje i ograniczone żądania. |
| Uczestnik do zaufanego gościa | Ścisłe wersjonowane schematy po obu stronach odbiorczych, projekcja tekstowa, nieprzezroczysta piaskownica i restrykcyjne CSP. |
| Uczestnik do stanu czatu/gry | Tożsamość i własność wynikają z uwierzytelnionej sesji; nigdy z roli, trasy lub żądania generowania wybranego przez uczestnika. |
| Pokój do generowania i narzędzi | Mapowanie operacji pod kontrolą gospodarza, istniejąca blokada generowania, jawne zasady poleceń/narzędzi i bariera gotowości Game. |
| Wspólny stan do historii | Lista dozwolonych pól; wykluczenie danych dostępu, promptów debugowania, rozumowania, prywatnych notatek, obcych bibliotek i ukrytego stanu GM. |

Uwierzytelniony uczestnik nadal nie jest zaufany. Tekst promptu pozostaje dosłowny; autoryzację wymusza kod, a nie modyfikowanie promptów czy prośba do modelu o bezpieczeństwo. Gospodarz i jego dostawcy AI mogą czytać wspólne treści. Jak każde połączenie bezpośrednie, ten projekt ujawnia gospodarzowi IP łączącego się Engine. Inne dane biblioteki lub urządzenia gościa nie należą do protokołu. Nie obiecuje on ochrony przed każdą luką przeglądarki lub systemu.

<a id="activation-and-lifetime"></a>

## Aktywacja i czas życia

`MULTIPLAYER_ENABLED=true` jest warunkiem wymagającym restartu. Brak wartości, fałsz i niepoprawne wartości wyłączają grę wieloosobową. Potrzebna jest oddzielna aktywacja Settings; żadne z tych ustawień nie uruchamia sieci. Hostowanie i dołączanie wymagają jawnych działań. Restart nigdy nie przywraca aktywnego pokoju. Stop, Kick i Leave unieważniają właściwe dane sesji oraz blokują późniejsze akcje i spóźnione dostarczenia.

Gdy choć jedna zgoda jest wyłączona, nie ma przeglądania sesji, kontroli dostępności certyfikatów, odpytywania gospodarza/gościa ani autonomicznych zadań pokoju. Serwer odczytuje flagi, a klient buforuje jeden odczyt dostępności, odświeżany jawną czynnością Settings. Bezpośrednie żądania do wyłączonego API nadal są odrzucane. Sprzątanie zapisanych sesji czeka na aktywację i nie wznawia sieci.

<a id="proof-before-enabling-the-feature"></a>

## Dowody przed włączeniem

- Udowodnij, że złośliwy tekst nie może się wykonać, pobrać zasobów, nawigować, pobierać plików, dotrzeć do lokalnych API ani wywołać mostka natywnego w obsługiwanym kontekście gościa.
- Udowodnij, że wyłączone zgody, nieuwierzytelnione przyjęcie, własność, projekcja prywatnego stanu, ograniczony ruch i cofnięcie dostępu blokują niedozwolone operacje.
- Wykorzystaj istniejące generowanie, polecenia i autonomię przez jednego koordynatora gospodarza. Opublikuj tabelę zgodności poleceń z jawnymi ograniczeniami.
- Udowodnij, że dwóch graczy Game tworzy jedną rundę dopiero po akcji lub jawnym spasowaniu obu; ponowienia, rozłączenia, anulowanie i restart nie mogą podwójnie zastosować stanu.
- Sprawdź konfigurację, szufladę, panel boczny i pole wiadomości na komputerach oraz urządzeniach mobilnych, z czytelnymi Leave/Stop i odzyskiwaniem. Zapisz braki testów fizycznych urządzeń.

Niepełne etapy pozostają wyłączone. Wszystkie trzy tryby i ich granice bezpieczeństwa muszą być gotowe przed zamknięciem #6790 jako ukończonego.

<a id="command-and-feature-compatibility"></a>

## Zgodność poleceń i funkcji

Akcje pokoju przechodzą przez uwierzytelnionego koordynatora gospodarza. Tabela opisuje granicę, a nie pozwolenie na dowolne polecenia u drugiej strony. Pole wiadomości wyjaśnia odrzucone polecenie; gość nigdy go nie wykonuje.

| Funkcja | Wywołujący i wykonanie | Wspólny wynik i reguła rundy |
| --- | --- | --- |
| Wiadomości ludzi, `/send` | Przyjęty uczestnik; gospodarz tworzy wiadomość użytkownika z przypisanym autorem. `/send` tłumi automatyczną odpowiedź. | Publiczny tekst. Conversation/Roleplay szeregują przyjęte wpisy z generowaniem; zajęty nadawca zachowuje szkic. Game wysyła wyłącznie przez zbieranie rundy. |
| `/roll`, `/r`, `/dice` | Przyjęty uczestnik; istniejący ograniczony parser i mechanizm kości Engine działają u gospodarza. | Wynik tekstowy z autorem. Rzut Game pozostaje przesłaną akcją gracza do zamknięcia rundy. |
| Generowanie, `/trigger` | Przyjęty uczestnik; jeden trwały przydział generowania gospodarza i istniejąca blokada. | Filtrowana zapisana narracja AI. Game odrzuca niezależne wyzwalacze; tylko gotowość uruchamia rozstrzygnięcie. |
| Inne polecenia slash | Niedostępne do czasu audytu i jawnego dodania autoryzacji pokoju. | Bez wstawiania roli systemowej, podszywania się, nawigacji/edycji prywatnych czatów, galerii, działań urządzenia i dowolnych poleceń lokalnych. |
| Odpowiedzi grupowe | Zatwierdzona lista AI wybrana przez gospodarza i istniejące generowanie sekwencyjne/Smart/ręczne. | Tożsamość AI jest oddzielona od migawek person ludzi. `{{user}}` używa sprawdzonej persony gospodarza, nigdy ostatniego gościa, który się odezwał. |
| Harmonogramy i autonomia Conversation | Istniejący harmonogram serwera, logika kandydatów/intencji, przerwy i opóźnienia przy zajętości; ten sam przydział pokoju. | Brak harmonogramu gościa. Zatrzymane/wstrzymane pokoje i Game nie generują z timerów. Brak widoku człowieka lub przyjętego uczestnika przez 45 sekund wstrzymuje autonomię. |
| Conversation `schedule_update`, `memory`, `react` | Istniejące procedury Engine podlegają zasadom pokoju. | Zmiany harmonogramu/pamięci pozostają w pokoju; reakcje muszą dotyczyć tego czatu i nie mogą zawierać własnego obrazu. Bez globalnych zmian pamięci postaci lub obecności. |
| Notatki, przypomnienia, rzuty i szepty Roleplay | Istniejący parser i procedura gospodarza; zatwierdzone identyfikatory określają odbiorców. | Prywatne notatki pozostają prywatne. Szept jest tylko w filtrowanej migawce odbiorcy; gospodarz nadal posiada zapisane dane. Agenci pokoju nigdy nie czytają szeptów, bo ich wyniki widzi każdy uczestnik. |
| Sceny między czatami i przypomnienia przeglądarki | Ograniczone, bo zwykły przebieg tworzy/otwiera powiązane prywatne czaty lub korzysta z lokalnego timera przeglądarki. | Opisuj sceny we wspólnej historii; autonomiczne wiadomości kieruj przez harmonogramy Conversation gospodarza. Otrzymane polecenie nie tworzy prywatnego czatu ani lokalnego przypomnienia. |
| Lorebooki i wspomnienia | Dołączone/pokojowe książki sprawdzone przez gospodarza oraz wspomnienia rozmowy lokalne dla pokoju. | Tylko kontekst promptu, nie eksport biblioteki. Domyślne książki globalne, powiązane prywatne czaty i globalne wspomnienia kart są wykluczone. |
| Trackery Engine, kości, stan, podsumowania i zmienne | Jawne listy dozwolone w rzeczywistym wykonawcy narzędzi/agentów, nie tylko w promptach. | Można udostępniać bezpieczne pola publiczne; surowe wyniki agentów, ukryte rozumowanie, prompty debugowania i prywatne pola GM są wstrzymane. Efekty Game wymagają przydziału rundy. |
| Akcje, wybory, testy, ekwipunek i arkusze Game | Konfiguracja/start przez gospodarza i istniejące generowanie; deterministyczne efekty po turze zapisują się raz. | Własność ludzkich akcji wynika z uwierzytelnionego uczestnika. Wybory wypełniają szkic i nigdy nie omijają gotowości zgłoszeń. |
| Multimedia, własne/pakietowe narzędzia, Game Experiences i integracje urządzeń | Niedostępne podczas generowania pokoju. | Bez plików, obrazów, audio, wideo, zdalnych stylów, pobierania, natywnych poleceń ani interfejsu gościa z pakietu. Wymagają oddzielnego etapu zabezpieczeń. |

Początkowy wspólny Game to zsynchronizowany przebieg narracji/akcji. Taktyczne/minigrowe powierzchnie tylko po stronie klienta, własne Game Experiences i prezentacja scen/multimediów nie są oferowane gościom. Standardowa konfiguracja Game jest używana z jawnym ograniczeniem tych opcji. Żaden renderer gospodarza nie jest ładowany w celu wypełnienia luki zgodności.

<a id="recovery-and-limits"></a>

## Odzyskiwanie i limity

Każdy uwierzytelniony uczestnik ma zapisaną monotoniczną sekwencję akcji i ograniczone potwierdzenia operacji. Ponowienie zwraca poprzedni wynik; odtworzenie pozostaje nieaktualne po usunięciu potwierdzenia z pamięci 128 wpisów. Migawki person w wiadomościach nie zmieniają się po późniejszej zmianie persony. Nazwy ludzi i AI muszą być jednoznaczne dla adresowanych szeptów/testów.

Nazwy wyświetlane i nazwy person są publiczne, więc nigdy nie dowodzą, kto jest właścicielem miejsca. Gracz, który wyjdzie lub przestanie się odzywać, odzyskuje swoje dawne miejsce tylko wtedy, gdy jego Engine przedstawi prywatny klucz ponownego dołączenia do tego miejsca: token sesji z przyjęcia, które pierwotnie przydzieliło mu miejsce, wysłany ponownie jako token okaziciela (bearer) nowego żądania dołączenia. Bez niego żądanie z tymi samymi nazwami dostaje konflikt nazw, a sesje tego miejsca pozostają nienaruszone. Oba Engine trzymają klucz wyłącznie w pamięci. Po restarcie Engine gościa gospodarz usuwa stare miejsce, zanim ten gracz będzie mógł znowu użyć tej samej persony.

Zmiany persony Game obowiązują od następnej granicy rundy. Istniejące arkusze, bieżące statystyki, własność ekwipunku i klucze prywatności trackerów podążają za trwałą tożsamością uczestnika; stare wiadomości zachowują autora. Jeśli NPC zajmie żądaną nazwę przed tą granicą, stara persona pozostaje aktywna, a gracz widzi konflikt nazwy. Pasowanie, usuwanie, pauzy i wznowienia gospodarza pozostawiają przetłumaczone zdarzenia w tej samej historii.

Game zapisuje wymaganych uczestników, każdą rewizję zgłoszenia i unikatowy przydział rozstrzygnięcia w istniejących metadanych czatu. Zbieranie zgłoszeń i zapis wiadomości z autorami używają kolejki metadanych, a potem transakcji magazynu. Praca dostawcy odbywa się poza transakcją. Stop anuluje sygnał zaufanej operacji; opóźnione zapisy muszą nadal odpowiadać aktywnemu przydziałowi. Przerwane tury nie są ponawiane automatycznie. Jawne wznowienie przechodzi do następnej fazy zbierania bez powtarzania zapisanych efektów. Nieudana konfiguracja zostaje w poczekalni do jawnej kontroli/restartu.

Nie ma stałej górnej liczby ludzi lub AI. Protokół wersji 1 ogranicza akcje do 16 KiB, migawki do 256 KiB i 100 ostatnich wiadomości, a tekst wiadomości do 8000 znaków. Kolejki przyjęć, gniazda, żądania, długie odpytywania, sesje, wyprowadzanie haseł i generowanie są ograniczone. Na sesję przypada jedno aktywne odpytywanie uczestnika, na Engine gościa jedno odpytywanie łącznika. Kompresja i przekierowania są odrzucane. Hasła/tokeny nigdy nie trafiają do URL-i ani wspólnych migawek.

Większe pokoje zależą od zasobów gospodarza, przepustowości i kontekstu modelu. Nikt nie jest po cichu usuwany, by aktualizacja się zmieściła. Przy przekroczeniu limitu transportu gość zachowuje ostatni poprawny stan i może wyjść; gospodarz nadal zarządza pokojem i może zmniejszyć dane, by odpytywanie wróciło.

<a id="verification-record"></a>

## Rejestr weryfikacji

Automatyczne dowody używają jednorazowego magazynu, lokalnego testowego CA i symulowanych dostawców. Nie zmieniają certyfikatów, danych ani połączeń AI użytkownika.

- `multiplayer-peer-security.regression.ts`: łańcuch TLS/nazwa/odcisk przed ujawnieniem HTTP, niepoprawne/zbyt duże/przekierowane odpowiedzi i anulowanie.
- `multiplayer-peer-server-security.regression.ts`: tylko trasy pokoju, limity treści/nagłówków/wyjścia/częstotliwości/współbieżności i natychmiastowe zamknięcie nasłuchu.
- `multiplayer-seat-key-security.regression.ts`: skopiowane nazwy ani błędny klucz ponownego dołączenia nigdy nie zajmują miejsca ani jego szeptów; posiadacz klucza wraca na to samo miejsce, a klucz nigdy nie trafia do innych uczestników ani do zapisanych danych czatu.
- `multiplayer-room.regression.ts`: dwa Engine, przyjęcie, własność, filtrowana historia, cofnięcie/odtworzenie, szeregowanie generowania i rundy/odzyskiwanie Game dla dwóch graczy.
- `multiplayer-session-flows.regression.ts`: dwa Engine przez HTTPS z prawdziwym generowaniem i środowiskiem Game, symulowany dostawca, pełne rundy Conversation, Roleplay i Game.
- `multiplayer-generation-policy.regression.ts` i `generation-output.regression.ts`: ograniczenia wykonawcy, wykluczenie prywatnych bibliotek, tożsamości lokalne dla promptu, wspólna blokada i semantyka zakończenia.
- `multiplayer-autonomy-security.regression.ts`: użycie istniejącego harmonogramu, zegar aktywności, pojedyncza władza i wyścigi Stop.
- `multiplayer-game-runtime.regression.ts`: konfiguracja/start/wstęp Game, deterministyczne efekty tur, nieaktualne zapisy i przerwana konfiguracja.
- `multiplayer-game-persona.regression.ts` i `multiplayer-game-projection.regression.ts`: przeniesienie własności persony, konflikty, filtrowanie odbiorców i ograniczone publiczne trackery.
- `e2e/multiplayer-guest-isolation.e2e.ts`: produkcyjny pakiet gościa wobec wrogiego tekstu i prób dostępu lokalnego/sieciowego/natywnego w Chromium desktop, Chromium mobile i WebKit mobile.
- Ukierunkowane przypadki przeglądarkowe obejmują ostrzeżenia przyjęcia, Players, poczekalnię Game, układ dotykowy, jasny/ciemny motyw i szkice/ponowienia.

Przed scaleniem ponów `pnpm check`, odpowiednie regresje Node, `pnpm regression:prompt`, `pnpm smoke:ui` i ukierunkowaną macierz przeglądarek dla końcowej wersji. Zapisz rzeczywiste wyniki i rewizję w PR, ukończ CodeRabbit i skupiony przegląd bezpieczeństwa oraz sprawdź obsługiwane fizyczne urządzenia. Emulacja nie dowodzi działania na ekranie początkowym prawdziwego iPhone'a/iPada ani Androida. Natywna aplikacja opakowująca Android pozostaje wyłączona dla gości. Wyniki fizyczne są oczekujące do zapisania; profil viewportu nie potwierdza obsługi.

Gość jest budowany jako klasyczne IIFE, ponieważ ładowanie modułów ES z nieprzezroczystego pochodzenia wymagałoby poluzowania CORS. Start produkcyjny i deweloperski buduje stałe lokalne zasoby gościa; po zmianie kodu przy działającym serwerze deweloperskim uruchom `node packages/client/scripts/build-multiplayer-guest.mjs` i odśwież widok. Kontrola kompletności programu uruchamiającego obejmuje oba izolowane zasoby.

Zadanie tłumaczenia: [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
