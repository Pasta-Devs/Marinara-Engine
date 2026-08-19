# Rozszerzenia osobiste

Rozszerzenia osobiste to prywatne szkice kodu, które przygotowuje dla ciebie Professor Mari. Otwórz **Settings** (Ustawienia) > **Addons** (dodatki) > **Personal Extensions** (rozszerzenia osobiste).

Domyślnie widać komunikat:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

W tej sekcji nie ma akcji tworzenia nowego szkicu ani żadnych kontrolek importu. O utworzenie lub poprawienie szkicu poproś Professor Mari. Asystentka zapisze kod, ale nie zatwierdzi go ani nie włączy.

Jeśli chcesz napisać i zaimportować własny pakiet, skorzystaj z [przewodnika tworzenia rozszerzeń osobistych](writing-personal-extensions.md). Pakiety napisane samodzielnie przechodzą przez osobno chroniony proces External Extensions.

## Przegląd kodu i włączenie

Każdy szkic zaczyna jako wyłączony. Marinara wylicza odcisk dokładnie tego kodu, który ma się wykonać, algorytmem SHA-256. Otwórz szkic, przejrzyj kod, porównaj wyświetlony odcisk i dopiero wtedy wybierz **Review and Run** (przegląd i uruchomienie) – tylko jeśli akceptujesz dokładnie tę wersję. Każda zmiana w wykonywanym kodzie i każda przywrócona wersja wyłączają rozszerzenie i wymagają ponownego zatwierdzenia.

Piaskownica ogranicza uprawnienia, ale nie sprawia, że dowolny kod staje się godny zaufania. Złośliwe rozszerzenie wciąż może marnować moc procesora, dopóki nie zatrzyma go strażnik, zapełnić własną przestrzeń danych w ramach narzuconych limitów albo zachowywać się zwodniczo w logach. Rozszerzenia z pełnym dostępem do strony celowo rezygnują z tej izolacji. Zawsze przejrzyj kod przed włączeniem.

## Izolacja środowiska uruchomieniowego

Rozszerzenie przeglądarkowe działa w osobnym wątku Worker wewnątrz ramki iframe z piaskownicą i nieprzezroczystym pochodzeniem. Nie ma dostępu do strony aplikacji Marinara Engine, drzewa DOM, ciasteczek, pamięci przeglądarki, interfejsów API danego pochodzenia ani do sieci. Ma do dyspozycji prywatną pamięć rozszerzenia, logi, zarządzane liczniki czasu, rejestrację sprzątania, ograniczone okna, bezpieczne miejsca na wkład w interfejs aplikacji oraz kopię danych o aktywnym czacie i identyfikatorach postaci tylko do odczytu. Wybrane pola z kart aktywnych postaci albo z wybranej persony trafiają do rozszerzenia dopiero wtedy, gdy odpowiednie uprawnienia są zadeklarowane i zatwierdzone.

Rozszerzenia mogą dodawać akcje na górnym pasku, pozycje w menu Extensions i trwałe panele po prawej stronie za pomocą `marinara.ui.registerContribution(...)`. Marinara rysuje te elementy w aktywnym motywie i korzysta ze stałego zestawu kontrolek: nagłówki, tekst, wynik w formacie preformatowanym, przyciski, pola tekstowe, listy rozwijane, przełączniki, suwaki, kontrolki koloru i odstępy. Rozszerzenie dostarcza treść i stan, nigdy kod HTML, CSS, adresy URL, komponenty React ani obsługę zdarzeń aplikacji.

Te możliwości interfejsu i te zasady są takie same dla każdego rozszerzenia przeglądarkowego w piaskownicy, niezależnie od jego pochodzenia. Zaimportowane rozszerzenie zewnętrzne (External) korzysta z tego bezpiecznego środowiska, chyba że jego paczka wprost prosi o **Full page access** (pełny dostęp do strony) albo używa formatu `marinara.extension` sprzed piaskownicy, opisanego niżej.

### Dodanie panelu rysowanego przez Marinara Engine

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Wartość `kind: "button"` daje zwięzłą akcję, a `kind: "menu-item"` — akcję w menu Extensions. Przyciski domyślnie używają `surface: "top-bar"`. Mogą też wskazywać `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` lub `settings`, z pozycją `header`, `before-content` albo `after-content`. Pole `icon` przyjmuje każdą obsługiwaną przez Marinara Engine nazwę ikony Lucide w formacie kebab-case. Oba typy akcji wywołują `onActivate`. Rodzaj `panel` wywołuje `onActivate` przy otwarciu, a jego przyciski wywołują `onEvent` z bieżącymi wartościami kontrolek. Uchwyt obsługuje aktualizacje zależne od typu: `button` przyjmuje `label`, `description`, `icon`, `surface` i `position`; `menu-item` — `label`, `description` i `icon`; `panel` — `label`, `description`, `icon` i `elements`. Wszystkie uchwyty obsługują `remove()`. Identyfikatory mogą zawierać litery, cyfry oraz `.`, `_` i `-`.

Ten przykład umieszcza natywną akcję nad zawartością panelu Presets:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Rozbudowane narzędzia mogą budować interfejsy wieloetapowe, aktualizując elementy panelu po zdarzeniu. Stan aplikacji trzymaj w `marinara.storage`, nigdy nie zapisuj go w samych znacznikach.

### Korzystanie z kontekstu aktywnego czatu

Interfejs rozszerzeń przeglądarkowych w wersji 5 udostępnia nieprzezroczyste identyfikatory czatu wyświetlanego w danej chwili w aplikacji Marinara Engine:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` zwraca tę samą bieżącą kopię danych, ale bez subskrypcji. Kiedy żaden czat nie jest aktywny, `chatId` ma wartość `null`, a `characterIds` jest puste. Wartość `characterId` pojawia się tylko wtedy, gdy w czacie bierze udział dokładnie jedna postać. Czaty grupowe wymieniają wszystkich uczestników w `characterIds` i zostawiają `characterId` jako `null`. Wartość `personaId` pojawia się dopiero po zatwierdzeniu uprawnienia `read_active_persona`.

Identyfikatory czatu i postaci są dostępne zawsze i pozwalają rozszerzeniu porządkować własną prywatną pamięć. Pola z samych wpisów wymagają jednego lub obu opcjonalnych uprawnień w manifeście rozszerzenia:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` wypełnia `characters` danymi kart biorących udział w aktywnym czacie.
- `read_active_persona` wypełnia `persona` danymi persony wybranej dla aktywnego czatu.

Bez danego uprawnienia wartość pozostaje `[]` albo `null`. Marinara pokazuje każde żądane uprawnienie na liście **Requested access** (żądany dostęp), a potem jeszcze raz w oknie zatwierdzania dokładnego odcisku. Dodanie lub usunięcie uprawnienia zmienia odcisk wykonywanego kodu, wyłącza rozszerzenie i wymaga ponownego zatwierdzenia.

Kopia danych postaci zawiera wyłącznie pola `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` i `conversationDisplayName`. Kopia danych persony zawiera wyłącznie pola `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` i `conversationDisplayName`. Tekst dostaje narzucony limit długości, zanim przejdzie przez most piaskownicy.

Marinara nigdy nie przekazuje wiadomości, notatek twórcy, promptów systemowych, instrukcji dopisywanych po historii, komentarzy, ścieżek do awatarów, całych bibliotek postaci ani person, pól niezadeklarowanych, metadanych czatu, uchwytów bazy danych, dostępu do sieci ani operacji zmieniających dane. Aktualizacje kontekstu pozostają związane z zatwierdzonym odciskiem kodu i przychodzą przy zmianie aktywnego czatu, jego listy postaci albo wybranej persony.

### Rozszerzenia starsze i z pełnym dostępem do strony

Sterowniki pogody, edytory promptów i inne rozbudowane procesy to dobre zastosowania dla wkładu w interfejs. Ich bezpieczne wersje mogą korzystać z uruchamiania z menu lub górnego paska oraz z paneli aktualizowanych krok po kroku. Istniejące paczki, które wstawiają nakładki do drzewa DOM, odpytują selektory CSS aplikacji Marinara Engine, przeszukują wnętrze biblioteki React albo wywołują trasy `/api` z tego samego pochodzenia, nie zaimportują się do bezpiecznego środowiska bez zmian.

Wkład w interfejs daje sam interfejs, a nie dodatkowe uprawnienia. Interfejs kontekstu zawsze udostępnia identyfikatory aktywnego czatu i postaci, a poza tym wyłącznie wymienione wyżej zadeklarowane pola aktywnych wpisów. Funkcje, które potrzebują wiadomości, presetów, lorebooków, niezadeklarowanych danych postaci lub persony albo efektów wizualnych sceny, nadal wymagają osobnego, wąsko zakrojonego pośrednika udostępnionego przez Marinara Engine. Rozszerzenie nie może go udawać przez dostęp do drzewa DOM aplikacji ani przez nieograniczone zapytania sieciowe.

Jeśli rozszerzenie zewnętrzne naprawdę potrzebuje dostępu do drzewa DOM aplikacji, może o niego poprosić:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access nie jest uprawnieniem w piaskownicy.** Zatwierdzony kod JavaScript i CSS działa wewnątrz strony aplikacji Marinara Engine. Taki kod może odczytać lub zmienić wszystko, co widzi bieżąca sesja przeglądarki, zajrzeć do czatów i kart, korzystać z pamięci przeglądarki, wysyłać zapytania sieciowe oraz wywoływać interfejsy API aplikacji Marinara Engine z tego samego pochodzenia. W praktyce ma na stronie takie same uprawnienia jak kod wklejony do konsoli przeglądarki. Szkice od Professor Mari nie mogą o to prosić.

Starszą kopertę `kind: "marinara.extension"` w wersji 1, bez wyraźnego pola `capabilities`, Marinara rozpoznaje jako paczkę sprzed piaskownicy i przy imporcie przypisuje jej **Full page access**. Dzięki temu starsze paczki, na przykład WeatherTweaker, trafiają do właściwej ścieżki przeglądu, zamiast po cichu zawodzić w wątku Worker. Nowoczesna paczka, która używa tej koperty, ale chce bezpiecznego środowiska, musi zawierać `"capabilities": []`.

Obie blokady rozszerzeń zewnętrznych oraz zatwierdzenie dokładnego odcisku obowiązują tak samo. Zmiana kodu, arkusza CSS lub uprawnień wyłącza rozszerzenie i wymaga ponownego zatwierdzenia. Wyłączenie usuwa węzły skryptu i arkusza stylów dodane przez Marinara Engine, anuluje liczniki czasu utworzone przez interfejs zgodności i uruchamia funkcje zarejestrowane przez `marinara.onCleanup(...)`. Kod działający na stronie może jednak tworzyć niezarejestrowane nasłuchy, liczniki czasu, zmienne globalne i zmiany w drzewie DOM, więc sprzątanie bywa niepełne. Jeśli coś zostanie, odśwież stronę po wyłączeniu rozszerzenia.

Starszy interfejs `marinara.ui.showWindow(...)` nadal działa i otwiera tymczasowe okno wewnątrz ramki iframe o nieprzezroczystym pochodzeniu. Korzysta z tego samego stałego zestawu kontrolek i zwraca uchwyty `update(...)` oraz `close()`. Kiedy narzędzie ma być osiągalne przez zwykłą nawigację aplikacji Marinara Engine, lepiej wybrać wkład w interfejs.

Rozszerzenie serwerowe działa w osobnym procesie Node z ograniczonymi uprawnieniami, wewnątrz mechanizmu Seatbelt na macOS albo Bubblewrap na Linux. Nie ma dostępu do plików aplikacji Marinara Engine, plików użytkownika, odziedziczonych sekretów serwera, sieci, procesów potomnych, wątków roboczych ani dodatków natywnych. Jeśli Marinara nie zestawi obsługiwanej piaskownicy systemowej, rozszerzenia serwerowe pozostają wyłączone.

### Obsługiwane platformy

Rozszerzenia przeglądarkowe zamyka w piaskownicy sama przeglądarka, więc działają wszędzie. Rozszerzenia serwerowe wymagają obsługiwanej piaskownicy systemowej – tam, gdzie jej nie ma, zostają wyłączone i nie da się ich włączyć. Marinara nigdy nie uruchamia ich awaryjnie poza piaskownicą.

| Platforma                | Rozszerzenia przeglądarkowe w piaskownicy | Rozszerzenia zewnętrzne z pełnym dostępem do strony | Rozszerzenia serwerowe                          |
| ------------------------ | ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| macOS                    | ✅ W piaskownicy                          | ⚠️ Wymaga wyraźnego zaufania                        | ✅ W piaskownicy (Seatbelt)                     |
| Linux (z Bubblewrap)     | ✅ W piaskownicy                          | ⚠️ Wymaga wyraźnego zaufania                        | ✅ W piaskownicy (Bubblewrap)                   |
| Linux (bez `bwrap`)      | ✅ W piaskownicy                          | ⚠️ Wymaga wyraźnego zaufania                        | ⛔ Wyłączone – zainstaluj `bwrap`               |
| Windows                  | ✅ W piaskownicy                          | ⚠️ Wymaga wyraźnego zaufania                        | ⛔ Wyłączone – użyj rozszerzenia przeglądarkowego |
| Android                  | ✅ W piaskownicy                          | ⚠️ Wymaga wyraźnego zaufania                        | ⛔ Wyłączone – użyj rozszerzenia przeglądarkowego |

Na systemach Windows i Android nie ma obsługiwanej systemowej piaskownicy procesów, więc rozszerzeń serwerowych celowo tam nie ma. Użyj zamiast tego rozszerzenia przeglądarkowego albo uruchom serwer Marinara Engine na macOS lub Linux (z `bwrap`), jeśli rozszerzenie serwerowe jest niezbędne.

## Rozszerzenia zewnętrzne

Import cudzych rozszerzeń jest domyślnie zablokowany i ukryty. Trzeba wykonać dwa kroki:

1. Na komputerze z serwerem Marinara Engine ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env`.
2. Otwórz **Settings** > **Advanced** (zaawansowane) > **Danger Zone** (strefa zagrożenia), przewiń poniżej kontrolek usuwania danych, przeczytaj ostrzeżenie i włącz przełącznik **Allow third-party extension imports** (zgoda na import cudzych rozszerzeń).

Dopiero wtedy sekcja **Settings** > **Addons** pokazuje **External Extensions** (rozszerzenia zewnętrzne) razem z kontrolkami importu plików i folderów. Obsługiwane formaty są zawsze rozwinięte:

- `.personal-extension.zip` oraz zgodne paczki `.zip`;
- manifesty `.json`;
- `.css`;
- `.js`, `.mjs` i `.cjs`;
- `.server.js`, `.server.mjs` i `.server.cjs`.

Import nigdy nie przenosi zatwierdzenia i nie potrafi sam się włączyć. Wpisy starsze, wciągnięte z profilu, zapisane ręcznie oraz te o nieznanym pochodzeniu również liczą się jako zewnętrzne. Pozostają ukryte, nie da się ich zatwierdzić i oba środowiska uruchomieniowe je pomijają, dopóki obie blokady nie zostaną zdjęte.

Przed zatwierdzeniem dokładnego odcisku przejrzyj listę **Requested access**. Większość rozszerzeń przeglądarkowych powinna zostać w bezpiecznej piaskownicy. Paczka oznaczona jako **Full page access** celowo nie jest izolowana, więc włącz ją tylko wtedy, gdy dokładnie tę wersję sprawdzisz i uznasz za godną zaufania.

Wyłączenie którejkolwiek z tych blokad zatrzymuje działające zewnętrzne procesy serwerowe, usuwa wątki robocze w przeglądarce i węzły środowiska działającego na całej stronie oraz wyłącza zapisane wpisy zewnętrzne. Ponowne zdjęcie blokad nie uruchamia ich automatycznie. Jeśli rozszerzenie z pełnym dostępem do strony zostawiło po sobie zmiany, których nie zgłosiło do sprzątania, odśwież stronę.

Cudze rozszerzenia mogą zawierać złośliwy lub niebezpieczny kod. Przejrzyj każdą linijkę, zanim cokolwiek pobierzesz, zaimportujesz lub włączysz. Cała odpowiedzialność jest po twojej stronie.

## Eksport, wersje i odzyskiwanie

Akcja eksportu w rozszerzeniu pobiera przenośną paczkę. Paczki wyeksportowane i przywrócone pozostają wyłączone. Przywrócenie wcześniejszej wersji też zamienia ją z powrotem w wyłączony szkic.

Jeśli rozszerzenie zachowuje się źle, wybierz **Disable** (wyłączenie). Jeśli interfejs jest niedostępny, zatrzymaj Marinara Engine i ustaw wartość `enabled` na `"false"` we właściwym wpisie `installed_extensions`. Nigdy nie ustawiaj `approvedHash` ręcznie.

## Powiązane przewodniki

- [Tworzenie rozszerzeń osobistych](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Kopia zapasowa i przywracanie](../data/backup-and-restore.md)
- [Dostęp zdalny](../REMOTE_ACCESS.md)
