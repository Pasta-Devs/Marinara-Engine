# Architektura rozszerzeń osobistych

Rozszerzenia osobiste to kod domyślnie wyłączony i zatwierdzany skrótem treści, uruchamiany w dwóch odizolowanych środowiskach. Domyślnie dostępna jest tylko jedna klasa rozszerzeń: wersje robocze przygotowane przez Professor Mari. Każde inne źródło to rozszerzenie zewnętrzne, które wymaga otwarcia dwóch niezależnych bramek przez osobę obsługującą serwer.

## Niezmienniki bezpieczeństwa

Te właściwości muszą pozostać prawdziwe:

1. Utworzenie i import zawsze dają wersję roboczą: wyłączoną i niezatwierdzoną.
2. Zatwierdzenie wymaga dokładnego, aktualnego skrótu treści `sha256:` oraz wyraźnego potwierdzenia, że kod będzie wykonywany. Pełny dostęp do strony wymaga jeszcze jednego, osobnego potwierdzenia.
3. Każda zmiana kodu wykonywalnego wyłącza rozszerzenie i czyści `approvedHash`.
4. Przywrócenie starszej wersji daje wyłączoną wersję roboczą.
5. Kopia zapasowa oraz import profilu czyszczą zatwierdzenie i stan włączenia.
6. Professor Mari może tworzyć i aktualizować wersje robocze, ale nie ma żadnej akcji, która je zatwierdza albo włącza.
7. Każde źródło inne niż `professor_mari` jest zewnętrzne, w tym `external`, `local`, `legacy`, `profile_import` oraz nieznane wartości sprowadzane do `legacy`.
8. Rekordy zewnętrzne nie pojawiają się w odpowiedziach zarządzania ani środowiska uruchomieniowego, chyba że `ENABLE_EXTERNAL_EXTENSIONS=true`, a zapisana zgoda z sekcji **Danger Zone** (strefa zagrożenia) też ma wartość prawda.
9. Zamknięcie którejkolwiek bramki wyłącza zapisane rekordy zewnętrzne i zatrzymuje działające procesy serwera. Odpytywanie środowiska uruchomieniowego przeglądarki usuwa aktywne wątki Worker.
10. Kod przeglądarkowy z piaskownicy nigdy nie wykonuje się w dokumencie aplikacji Marinara Engine. Z osobnego środowiska uruchomieniowego strony może korzystać wyłącznie zewnętrzne rozszerzenie przeglądarkowe z uprawnieniem `full_page_access` zatwierdzonym dokładnym skrótem. Kod serwerowy nigdy nie wykonuje się w procesie serwera Marinara Engine.
11. Nie ma instalatora z adresu URL, zdalnego katalogu ani automatycznej aktualizacji.
12. Wkłady do interfejsu gospodarza to zwykłe, zwalidowane deskryptory. Znaczniki, style, adresy URL, komponenty i funkcje zwrotne rozszerzenia nigdy nie trafiają do drzewa React aplikacji Marinara Engine.
13. Rejestracja wkładu, jego aktywacja, zdarzenia, aktualizacje i usunięcie pozostają związane z dokładnym zatwierdzonym skrótem treści włączonego rozszerzenia.
14. Migawka kontekstu przeglądarki zawiera w wersji podstawowej wyłącznie identyfikator aktywnego czatu oraz identyfikatory postaci. Opcjonalne uprawnienia `read_active_characters` i `read_active_persona` mogą dodać ograniczone pola z listy dozwolonych, i to tylko z rekordów aktywnych w tym czacie; nigdy nie ujawniają wiadomości, całych bibliotek, niezadeklarowanych pól, metadanych ani dostępu do aplikacji.
15. Żądane uprawnienia wchodzą w skład skrótu kodu wykonywalnego. Każda zmiana uprawnień wyłącza rozszerzenie i wymaga ponownego zatwierdzenia dokładnym skrótem.
16. Uprawnienie `full_page_access` przysługuje tylko rozszerzeniom zewnętrznym, wymaga otwarcia obu bramek rozszerzeń zewnętrznych i nigdy nie jest dostępne dla wersji roboczych od Professor Mari. To wyraźnie zadeklarowany tryb zaufania, a nie obietnica piaskownicy.

Bramek pilnują trasy API i usługi środowiska uruchomieniowego. Ukrycie kontrolek nie jest granicą bezpieczeństwa. Rekord zewnętrzny dodany ręcznie, przywrócony, odziedziczony po starszej wersji albo wprowadzony poza normalną ścieżką musi pozostać niewidoczny i niewykonywalny tak długo, jak choć jedna bramka jest zamknięta.

## Przechowywanie danych i polityka

Tabela plikowa `installed_extensions` przechowuje metadane, kod wykonywalny, `contentHash`, `approvedHash`, źródło oraz do dziesięciu wcześniejszych wersji kodu. Prywatne ustawienia rozszerzenia korzystają z kluczy `app_settings` z przedrostkiem `extension-storage:`. Zgoda z sekcji **Danger Zone** zapisuje się pod kluczem `external-extensions-enabled`.

Podczas startu uruchamia się `preparePersonalExtensionTrust`. Stary wiersz bez skrótu zostaje zachowany, ale wyłączony i niezatwierdzony. Wiersz, którego zapisany skrót nie zgadza się już z polami kodu wykonywalnego, również zostaje wyłączony i dostaje nowy odcisk treści.

Plik `personal-extension-policy.service.ts` łączy bramkę odczytywaną na bieżąco z pliku `.env` z zapisaną zgodą użytkownika. Plik `personal-extension-storage.service.ts` potrafi wyłączyć wszystkie rekordy spoza Professor Mari. Obserwator pliku `.env` stosuje politykę ponownie w mniej więcej dwie sekundy i prosi środowisko uruchomieniowe serwera o zatrzymanie kodu, gdy bramka się zamyka.

## API

Powierzchnia zarządzania znajduje się pod `/api/personal-extensions`:

- `GET /policy` zwraca stan obu bramek oraz informację, czy piaskownica serwera jest dostępna.
- `PATCH /policy/external` zmienia zgodę z sekcji **Danger Zone** i odrzuca wartość `true`, dopóki bramka w pliku `.env` jest zamknięta.
- `GET /` wypisuje wersje robocze od Professor Mari, a wersje zewnętrzne dopiero wtedy, gdy obie bramki są otwarte.
- `POST /` importuje rozszerzenie zewnętrzne i kończy się odmową, jeśli obie bramki nie są otwarte.
- `PATCH /:id` edytuje albo wyłącza wersję roboczą.
- `POST /:id/approve` zatwierdza dokładny aktualny skrót, stosuje bramkę zewnętrzną i odmawia zatwierdzenia rozszerzenia serwerowego bez obsługiwanej piaskownicy systemu operacyjnego.
- `POST /:id/rollback` przywraca wcześniejszą, wyłączoną wersję.
- `DELETE /:id` usuwa rozszerzenie razem z prywatnymi ustawieniami.

Metadane zatwierdzonego środowiska uruchomieniowego przeglądarki odczytuje `GET /runtime/client`. Kod z piaskownicy wydaje `GET /:id/sandbox.html?hash=...`. Kod i style pełnej strony wydają `GET /:id/page-runtime.js?hash=...` oraz `GET /:id/page-style.css?hash=...`. Każdy z tych punktów końcowych wymaga, żeby dokładnie ten skrót pozostawał włączony, zatwierdzony i dopuszczony przez politykę; punkty końcowe strony wymagają dodatkowo źródła zewnętrznego i uprawnienia `full_page_access`.

## Środowisko uruchomieniowe przeglądarki w piaskownicy

Komponent `PersonalExtensionInjector.tsx` tworzy ukrytą ramkę iframe z `sandbox="allow-scripts"` i bez `allow-same-origin`. Ramka ma więc nieprzejrzyste pochodzenie i nie sięgnie do drzewa DOM, ciasteczek, magazynu ani interfejsów tego samego pochodzenia aplikacji Marinara Engine.

Odpowiedź piaskownicy zastępuje zwykłą politykę strony wąskim CSP: żadnych domyślnych zasobów, żądań sieciowych, formularzy, obiektów ani prawa do nawigacji. Kod CSS rozszerzenia zostaje wewnątrz ukrytej ramki iframe. JavaScript działa w osobnym wątku Worker, który tworzy zaufany kod startowy ramki. Globalne obiekty sieci i zagnieżdżonych wątków Worker są usuwane jako dodatkowa warstwa obrony.

Wątek Worker dostaje tylko:

- logowanie w osobnej przestrzeni nazw;
- prywatny magazyn rozszerzenia, pośredniczony przez dokument nadrzędny;
- zarządzane liczniki czasu;
- rejestrację funkcji sprzątających;
- identyfikatory aktywnego czatu i postaci, tylko do odczytu, przez `marinara.context`;
- ograniczone pola z kart aktywnych postaci i z wybranej persony, wyłącznie przez osobno zatwierdzone zdolności;
- ograniczone okno w ramce iframe przez `marinara.ui.showWindow(...)`;
- zaufane miejsca na wkłady w interfejsie gospodarza przez `marinara.ui.registerContribution(...)`.

Wersja 5 API rozszerzeń przeglądarkowych dodaje `marinara.context.get()` i `marinara.context.subscribe(listener)`. Niezmienna migawka ma taki kształt:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

Klient wyprowadza migawkę z `useChatStore` i wysyła ją, gdy zmienia się aktywny czat, jego lista postaci albo wybrana persona. Identyfikatory to niepuste ciągi znaków o długości do 256 znaków, a lista postaci jest pozbawiona duplikatów i ograniczona do 256 pozycji. Ramka iframe przyjmuje aktualizację kontekstu tylko od dokumentu nadrzędnego i tylko wtedy, gdy jej `contentHash` zgadza się z dokładną wersją rozszerzenia, a potem wątek Worker jeszcze raz normalizuje i zamraża dane. Start rozszerzenia czeka na pierwszą migawkę od aplikacji, a po sekundzie wchodzi zapasowy pusty kontekst, żeby zepsuty mostek nie zablokował wątku Worker na zawsze.

Pole `characterId` to ułatwienie dla czatów z jedną postacią i przy czatach grupowych pozostaje `null`; `characterIds` zawiera każdego aktywnego uczestnika. Pole `personaId` jest dostępne tylko z uprawnieniem `read_active_persona`. Bez aktywnego czatu `chatId`, `characterId`, `personaId` i `persona` mają wartość `null`, a `characterIds` oraz `characters` są puste. Rozszerzenia mogą bezpiecznie używać tych identyfikatorów jako kluczy we własnym prywatnym magazynie.

Uprawnienie `read_active_characters` pozwala, żeby `characters` zawierało wyłącznie te pola aktywnych kart: `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` i `conversationDisplayName`. Uprawnienie `read_active_persona` pozwala, żeby `persona` zawierała wyłącznie `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` i `conversationDisplayName`. Serwer wyprowadza oba zestawy z aktywnego czatu, stosuje limity dla pojedynczych pól i dla całości, a identyfikatora rekordu przysłanego przez klienta nigdy nie uznaje za dowód uprawnień.

Zdolności deklaruje się w danych rozszerzenia, zapisuje przy każdej wersji, pokazuje w sekcji **Settings** (Ustawienia) i w oknie zatwierdzania oraz wlicza do skrótu kodu wykonywalnego. Aplikacja wysyła najpierw migawkę z samymi identyfikatorami, a potem uzupełnia ją przez zatwierdzonego pośrednika danego rozszerzenia. Wątek Worker niezależnie odrzuca niezadeklarowane rekordy, odrzuca rekordy postaci o identyfikatorach spoza `characterIds`, ponownie stosuje limity i zamraża wynik.

Wywołanie `marinara.ui.showWindow({ title, elements, onEvent, onClose })` zwraca uchwyt z metodami `update({ title?, elements? })` i `close()`. Wątek Worker wysyła wyłącznie deskryptory, a każdy element buduje zaufany kod startowy ramki, korzystając z interfejsów DOM i `textContent` (nigdy `innerHTML`). Aplikacja odsłania normalnie ukrytą ramkę piaskownicy tylko na czas otwartego okna i chowa ją z powrotem po zamknięciu.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` zwraca zamrożony uchwyt z `update(patch)` i `remove()`. Obsługuje te zaufane miejsca hosta:

- `button`: domyślnie zwarta akcja na górnym pasku albo akcja renderowana przez hosta na powierzchni `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` lub `settings`;
- `menu-item`: akcja w menu **Extensions**;
- `panel`: wpis, który otwiera zaufany panel boczny **Extensions** aplikacji Marinara Engine.

Przyciski panelu bocznego przyjmują `position: "header"`, `"before-content"` lub `"after-content"`. Przyciski górnego paska pomijają `position`. Ikony to ograniczone długością nazwy kebab-case z katalogu Lucide aplikacji Marinara; nieobsługiwane nazwy wracają do ikony puzzla.

Elementy panelu korzystają z tego samego deklaratywnego słownika co okna ograniczone: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color` i `spacer`. Kontrolki interaktywne wymagają unikalnych identyfikatorów. Przycisk w panelu wysyła do `onEvent` obiekt `{ contributionId, elementId, values }`; pole `values` zawiera aktualną wartość tekstową każdej kontrolki. Funkcja `onActivate` wykonuje się wewnątrz wątku Worker rozszerzenia, gdy użytkownik otworzy albo wywoła dany wkład. Po zmianie stanu rozszerzenie może wywołać `handle.update(...)`, żeby podmienić etykietę, opis, ikonę lub elementy panelu.

Klient niezależnie sprawdza każdy deskryptor przed dodaniem do magazynu środowiska. Rodzaje wkładu, powierzchnie, pozycje, kontrolki, ID, listy opcji, składnia nazw ikon, długości tekstu, łączny tekst panelu, liczba elementów i liczba wkładów na rozszerzenie są walidowane i ograniczane. React renderuje tekst rozszerzenia jako tekst. Nie przyjmuje HTML, CSS, URL, komponentu React ani funkcji zwrotnej hosta kontrolowanych przez rozszerzenie. Host usuwa wszystkie wkłady po zatrzymaniu workera, zmianie jego hasza lub zniknięciu z zatwierdzonej odpowiedzi środowiska. Zdarzenia trafiają tylko do workera zarejestrowanego dla tego samego ID rozszerzenia i hasza zawartości.

Nie ma tu pomocnika do drzewa DOM, dostępu do API aplikacji Marinara Engine, dostępu do zdarzeń dokumentu nadrzędnego ani dowolnego dostępu do sieci. Ramka iframe sprawdza komunikaty i ogranicza ich częstotliwość. Strażnik oparty na sygnale życia kończy wątek Worker, który nie odpowiada albo kręci się w pętli.

## Środowisko zgodności z pełnym dostępem do strony

Protokół wkładów pozostaje zalecaną drogą dla narzędzi z rozbudowanymi ustawieniami i dla wieloetapowych procesów. Złożone rozszerzenie może stopniowo podmieniać elementy panelu i trzymać własny stan w prywatnym magazynie rozszerzenia.

Starsze pakiety, które wstawiają przyciski po selektorach aplikacji, przeszukują wnętrzności React, rysują dowolne nakładki albo wywołują trasy `/api` z tego samego pochodzenia, nie zadziałają w bezpiecznym środowisku uruchomieniowym bez zmian. Najlepiej przenieść je na deskryptory wkładów i wąskie zdolności pośredniczące.

Kiedy zgodność naprawdę wymaga strony aplikacji, rozszerzenie zewnętrzne może poprosić o `full_page_access`. Komponent `PersonalExtensionInjector.tsx` ładuje wtedy dokładnie tę zatwierdzoną wersję przez element skryptu z tego samego pochodzenia i opcjonalny arkusz stylów. Kod działa w funkcji asynchronicznej z małym zgodnościowym obiektem `marinara`, który daje tożsamość, logowanie, prywatny magazyn, zarządzane liczniki czasu i rejestrację funkcji sprzątających. Globalne obiekty strony pozostają dostępne, bo dokładnie o takie uprawnienia poprosiło rozszerzenie.

Program ładujący sprawdza `id`, nazwę i skrót treści względem metadanych środowiska uruchomieniowego, zanim wywoła kod. Serwer przy każdym żądaniu skryptu lub arkusza stylów osobno weryfikuje dokładny skrót, stan włączenia, źródło zewnętrzne, uprawnienie oraz politykę dwóch bramek. Zamknięcie bramki wyłącza rekord, a odpytywanie środowiska uruchomieniowego usuwa wstawione elementy i sprząta, na ile się da. To nie cofnie dowolnych skutków ubocznych wywołanych już przez w pełni zaufany kod strony, więc aplikacja ostrzega, że może być potrzebne przeładowanie strony.

Starsze importy z `kind: "marinara.extension"` i bez wyraźnej deklaracji `capabilities` dostają uprawnienie `full_page_access`. Nowoczesny eksport zawsze zapisuje pole zdolności, nawet jako pustą listę, więc bezpieczne pakiety nie zmieniają klasyfikacji przy ponownym imporcie.

## Środowisko uruchomieniowe serwera

Kod serwerowy działa w osobnym procesie Node, nigdy przez import wewnątrz procesu głównego. Model uprawnień Node odbiera dostęp do systemu plików, sieci, procesów potomnych, wątków, dodatków natywnych, WASI i inspektora. Proces potomny działa dodatkowo wewnątrz:

- mechanizmu Seatbelt w systemie macOS; albo
- mechanizmu Bubblewrap w systemie Linux, z osobnymi przestrzeniami nazw PID, sieci, IPC i punktów montowania.

Piaskownica dostaje minimalne środowisko, małą stertę V8, żadnych plików aplikacji, żadnych sekretów serwera oraz ograniczone rozmiarem pliki protokołu z podziałem na linie, umieszczone w prywatnym folderze tymczasowym. Dostaje wyłącznie logowanie, prywatny magazyn rozszerzenia, zarządzane liczniki czasu i rejestrację funkcji sprzątających. Limity liczby komunikatów i osobny plik sygnału życia powstrzymują zalewanie protokołu oraz pętle bez końca.

Uprawnienia Node i moduł `node:vm` to warstwy dodatkowej obrony, a nie granica bezpieczeństwa. Osobna piaskownica systemu operacyjnego jest obowiązkowa. Windows, Android, Linux bez `bwrap` i każda inna nieobsługiwana platforma odmawiają włączenia rozszerzeń serwerowych.

## Weryfikacja

Uruchom:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

Test regresyjny bezpieczeństwa musi udowodnić: dwuetapową bramkę, unieważnienie przy zmianie dokładnego skrótu, kształt wątku Worker o nieprzejrzystym pochodzeniu, ograniczone i związane ze skrótem migawki kontekstu, sprawdzanie i sprzątanie wkładów gospodarza, kierowanie ruchu pełnej strony wyłącznie do źródeł zewnętrznych razem z potwierdzeniem, klasyfikację starszych pakietów, czyszczenie środowiska, odcięcie systemu plików i sieci, prywatny magazyn oraz bezpieczne domyślne zachowanie przy niedostępnej piaskownicy.
