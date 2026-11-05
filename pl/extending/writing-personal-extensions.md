# Pisanie własnych rozszerzeń

Ten przewodnik pokazuje, jak napisać rozszerzenie Browser Extension albo Server Extension, spakować je i zaimportować. Jest przeznaczony dla osób, które umieją pisać w języku JavaScript. Informacje o sprawdzaniu i uruchamianiu rozszerzenia znajdziesz w przewodniku [Rozszerzenia osobiste](personal-extensions.md).

Kod, który samodzielnie napiszesz i zaimportujesz, jest traktowany jako **External Extension** (rozszerzenie zewnętrzne). Początkowo jest wyłączony i nie może działać, dopóki nie sprawdzisz go i nie zatwierdzisz jego dokładnego skrótu SHA-256.

## Zanim zaczniesz

External Extensions są ukryte, dopóki nie wykonasz obu kroków zabezpieczających z sekcji [Zezwalanie na import od osób trzecich](personal-extensions.md#allow-third-party-imports): `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env` oraz przełącznik **Allow third-party extension imports** (zezwolenie na import rozszerzeń od osób trzecich) w **Settings → Advanced → Danger Zone** (ustawienia, zaawansowane, strefa zagrożenia).

Importowanie rozszerzeń i zarządzanie nimi wymaga także dostępu przez localhost albo sekretu administratora. Jeśli korzystasz z telefonu, adresu LAN lub zdalnej przeglądarki, ustaw `ADMIN_SECRET` na serwerze i wpisz tę samą wartość w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny).

Wybierz środowisko o najmniejszych uprawnieniach, które wystarczy do wykonania zadania:

| Środowisko | Zastosowanie | Ważne ograniczenie |
| --- | --- | --- |
| Sandboxed Browser Extension | Prywatny stan, kontekst aktywnego czatu, przyciski, akcje menu i panele renderowane przez aplikację Marinara | Brak dostępu do DOM aplikacji Marinara, ciasteczek, pamięci przeglądarki, sieci i dowolnego HTML |
| Server Extension | Logika działająca w tle, która potrzebuje zarządzanych timerów i prywatnej pamięci rozszerzenia | Osobna piaskownica systemu operacyjnego; brak dostępu do plików i sekretów aplikacji Marinara, sieci, procesów potomnych i modułów natywnych |
| Full-page External Extension | Starszy kod, który potrzebuje dostępu do strony aplikacji Marinara lub interfejsów API tego samego źródła | Brak piaskownicy; używaj tylko w przypadku dokładnie sprawdzonego i w pełni zaufanego kodu |

Browser Extensions działają na każdej obsługiwanej platformie. Server Extensions wymagają mechanizmu Seatbelt w systemie macOS albo Bubblewrap w systemie Linux. Przed wybraniem Server Extension sprawdź [tabelę platform](personal-extensions.md#platform-support).

## Szybki start z Browser Extension

Utwórz folder o takim układzie:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Użyj następującego pliku `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Użyj następującego pliku `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Użyj następującego pliku `extension.css`, aby nadać styl ograniczonemu oknu iframe otwieranemu przez przycisk:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Następnie zaimportuj i uruchom rozszerzenie:

1. Otwórz **Settings → Addons → External Extensions** (ustawienia, dodatki, rozszerzenia zewnętrzne).
2. Wybierz **Import Extension Folder** (import folderu rozszerzenia) i wskaż folder `Hello Panel` albo spakuj folder do archiwum ZIP i zaimportuj je przyciskiem **Import Extension File** (import pliku rozszerzenia).
3. Otwórz wyłączoną wersję roboczą i sprawdź jej manifest oraz kod JavaScript.
4. Wybierz **Review and Run** (przegląd i uruchomienie) i zatwierdź dokładnie wyświetlony skrót.
5. Otwórz menu Extensions i wybierz **Hello Panel**.

Ten sam działający przykład znajduje się w repozytorium w katalogu `docs/examples/personal-extensions/browser-minimal/`.

## Opis interfejsu Browser API

Browser Extensions działające w piaskownicy otrzymują jeden zamrożony obiekt globalny o nazwie `marinara`:

| API | Przeznaczenie |
| --- | --- |
| `runtime`, `version` | Nazwa środowiska (`client`) i bieżąca wersja Browser API |
| `extensionId`, `extensionName`, `capabilities` | Tożsamość i zatwierdzone możliwości tej dokładnej wersji rozszerzenia |
| `log.debug/info/warn/error(...)` | Zapis oznaczonego wpisu w konsoli przeglądarki |
| `storage.get()` | Odczyt prywatnego obiektu JSON tego rozszerzenia |
| `storage.patch(object)` | Scalenie wartości w prywatnej pamięci i zwrócenie nowego obiektu |
| `storage.delete()` | Wyczyszczenie prywatnej pamięci |
| `context.get()` | Odczyt bieżącej migawki aktywnego czatu |
| `context.subscribe(listener)` | Odbieranie zmian kontekstu; zwraca funkcję anulującą subskrypcję |
| `ui.registerContribution(options)` | Dodanie bezpiecznego przycisku, pozycji menu Extensions albo panelu renderowanego przez aplikację Marinara |
| `ui.showWindow(options)` | Otwarcie ograniczonego okna iframe |
| `dice.registerFormat(options)` | Nauczenie `/roll` notacji; Marinara rzuca wskazanymi w niej kośćmi |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Zarządzane timery usuwane po zatrzymaniu rozszerzenia |
| `onCleanup(callback)` | Zarejestrowanie dodatkowej logiki sprzątającej |

Do zwykłego interfejsu używaj [paneli renderowanych przez aplikację Marinara](#add-a-marinara-rendered-panel), do zachowania zależnego od czatu – [kontekstu aktywnego czatu](#use-active-chat-context), a do własnej notacji `/roll` – [formatów kości](#add-a-dice-format). Stan rozszerzenia należy do `marinara.storage`, a nie do pamięci przeglądarki.

`showWindow({ title, elements, onEvent, onClose })` zwraca uchwyt z metodami `update({ title?, elements? })` oraz `close()`. Kod CSS pakietu nadaje styl oknom iframe działającym w piaskownicy; elementy renderowane przez hosta zawsze używają motywu i kontrolek aplikacji Marinara.

Bezpieczne środowisko Browser nie udostępnia DOM ani sieciowego API. Nie obchodź tego ograniczenia. Jeśli brakuje użytecznej możliwości, poproś o wąską możliwość po stronie hosta, zamiast domyślnie przełączać się na dostęp do całej strony.

### Możliwości kontekstu

Zadeklaruj opcjonalny dostęp do rekordów w `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` wypełnia ograniczony zestaw pól kart postaci z aktywnego czatu.
- `read_active_persona` wypełnia ograniczony zestaw pól wybranej persony.
- `full_page_access` wybiera środowisko zgodności bez piaskownicy i jest dostępne tylko dla External Extensions.

Zmiana możliwości zmienia skrót kodu wykonywalnego, wyłącza rozszerzenie i wymaga ponownego sprawdzenia.

<a id="what-a-browser-extension-can-do"></a>

### Co może zrobić Browser Extension

Browser Extension działa w osobnym wątku Worker wewnątrz ramki iframe z piaskownicą i nieprzezroczystym pochodzeniem. Nie ma dostępu do strony aplikacji Marinara, drzewa DOM, ciasteczek, pamięci przeglądarki, interfejsów API danego pochodzenia ani do sieci. Ma do dyspozycji prywatną pamięć rozszerzenia, logi, zarządzane timery, rejestrację sprzątania, ograniczone okna, bezpieczne miejsca na wkład w interfejs hosta oraz migawkę aktywnego czatu i identyfikatorów postaci tylko do odczytu. Wybrane pola z kart aktywnych postaci albo z wybranej persony trafiają do rozszerzenia dopiero wtedy, gdy odpowiednie uprawnienia są zadeklarowane i zatwierdzone.

Rozszerzenia mogą dodawać akcje na górnym pasku lub w panelu bocznym, pozycje w menu Extensions i trwałe panele po prawej stronie za pomocą `marinara.ui.registerContribution(...)`. Marinara renderuje te elementy w aktywnym motywie i korzysta ze stałego zestawu kontrolek: nagłówki, tekst, wynik w formacie preformatowanym, przyciski, pola tekstowe, listy rozwijane, przełączniki, suwaki, kontrolki koloru i odstępy. Rozszerzenie dostarcza treść i stan, nigdy kod HTML, CSS, adresy URL, komponenty React ani obsługę zdarzeń hosta.

Te możliwości interfejsu i te zasady są takie same dla każdego Browser Extension w piaskownicy, niezależnie od jego pochodzenia. Zaimportowane rozszerzenie od osób trzecich (External) korzysta z tego bezpiecznego środowiska, chyba że jego pakiet wprost prosi o **Full page access** (pełny dostęp do strony) albo używa opisanego niżej formatu `marinara.extension` sprzed piaskownicy.

### Szacowanie liczby tokenów w tekście

Rozszerzenia osobiste typu Browser, Full page access i Server mogą korzystać z wbudowanej w aplikację Marinara Engine funkcji szacowania liczby tokenów w tekście:

```js
const tokens = marinara.estimateTextTokens(text);
```

Sygnatura funkcji to `estimateTextTokens(text: string): number`. Opisuje ją również typ `PersonalExtensionTokenApi` eksportowany z `@marinara-engine/shared`. Wywołanie jest synchroniczne, nie wymaga dodatkowej możliwości i zwraca niezależny od modelu szacunek liczby tokenów używany przez aplikację Marinara Engine, a nie dokładny wynik tokenizera. W starszych wersjach Engine przed wywołaniem sprawdź `typeof marinara.estimateTextTokens === "function"`.

<a id="add-a-marinara-rendered-panel"></a>

### Dodanie panelu renderowanego przez aplikację Marinara

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

Wartość `kind: "button"` daje zwięzłą akcję, a `kind: "menu-item"` – akcję w menu Extensions. Wartość `kind: "command"` tworzy wpis w oknie Command Center, który uruchamia istniejący wkład z tej samej wersji rozszerzenia. Wkład `command` wymaga `targetContributionId` i nie może używać `onActivate` ani `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

Host rozwiązuje wkład `command` tylko wtedy, gdy cel ma ten sam identyfikator rozszerzenia i ten sam skrót treści. Brakujący cel, cel z innego rozszerzenia i cel z nieaktualnej wersji kończą się odmową. Przyciski domyślnie używają `surface: "top-bar"`. Mogą też wskazywać `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` lub `settings`, z polem `position` ustawionym na `header`, `before-content` albo `after-content`. Pole `icon` przyjmuje każdą obsługiwaną przez aplikację Marinara Engine nazwę ikony Lucide w formacie kebab-case. Oba rodzaje akcji wywołują `onActivate`. Rodzaj `panel` wywołuje `onActivate` przy otwarciu, a jego przyciski wywołują `onEvent` z bieżącymi wartościami wszystkich kontrolek panelu. Zwrócony uchwyt obsługuje aktualizacje zależne od rodzaju: `button` przyjmuje `label`, `description`, `icon`, `surface` i `position`; `menu-item` – `label`, `description` i `icon`; `panel` – `label`, `description`, `icon` i `elements`. Wszystkie uchwyty obsługują `remove()`. Identyfikatory mogą zawierać litery, cyfry oraz `.`, `_` i `-`.

Na przykład ten kod umieszcza natywną akcję nad zawartością panelu Presets:

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

<a id="use-active-chat-context"></a>

### Korzystanie z kontekstu aktywnego czatu

Browser Extension API w wersji 5 udostępnia nieprzezroczyste identyfikatory czatu wyświetlanego w danej chwili w aplikacji Marinara Engine:

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

`marinara.context.get()` zwraca tę samą bieżącą migawkę, ale bez subskrypcji. Kiedy żaden czat nie jest aktywny, `chatId` ma wartość `null`, a `characterIds` jest puste. Wartość `characterId` pojawia się tylko wtedy, gdy w czacie bierze udział dokładnie jedna postać. Czaty grupowe wymieniają wszystkich uczestników w `characterIds` i zostawiają `characterId` jako `null`. Wartość `personaId` pojawia się dopiero po zatwierdzeniu uprawnienia `read_active_persona`.

Identyfikatory czatu i postaci są dostępne zawsze i pozwalają rozszerzeniu porządkować własną prywatną pamięć. Pola rekordów wymagają jednego lub obu opcjonalnych uprawnień w manifeście rozszerzenia:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` wypełnia `characters` danymi kart biorących udział w aktywnym czacie.
- `read_active_persona` wypełnia `persona` danymi persony wybranej dla aktywnego czatu.

Bez danego uprawnienia wartość pozostaje `[]` albo `null`. Marinara pokazuje każde żądane uprawnienie na liście **Requested access** (żądany zakres dostępu), a potem jeszcze raz w oknie zatwierdzania dokładnego skrótu. Dodanie lub usunięcie uprawnienia zmienia skrót kodu wykonywalnego, wyłącza rozszerzenie i wymaga ponownego zatwierdzenia.

Migawki postaci zawierają wyłącznie pola `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` i `conversationDisplayName`. Migawki persony zawierają wyłącznie pola `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` i `conversationDisplayName`. Tekst dostaje narzucony limit długości, zanim przejdzie przez most piaskownicy.

Marinara nigdy nie przekazuje wiadomości, notatek twórcy, promptów systemowych, instrukcji dopisywanych po historii, komentarzy, ścieżek do awatarów, całych bibliotek postaci ani person, pól niezadeklarowanych, metadanych czatu, uchwytów bazy danych, dostępu do sieci ani operacji zmieniających dane. Aktualizacje kontekstu pozostają związane z zatwierdzonym skrótem kodu i przychodzą przy zmianie aktywnego czatu, jego listy postaci albo wybranej persony.

<a id="add-a-dice-format"></a>

### Dodanie formatu kości

Browser Extension API w wersji 6 pozwala rozszerzeniu nauczyć `/roll` własnej notacji, na przykład puli kości narracyjnych. Rozszerzenie odczytuje notację i wskazuje kości do rzutu; Marinara rzuca nimi za pomocą własnego bezpiecznego mechanizmu losowania i zwraca wyniki na ściankach. Rozszerzenie może określić znaczenie rzutu, ale nigdy jego wylosowany wynik.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

`/roll 2 boost 1 setback` publikuje wtedy wyniki na ściankach, sumę i tekst rozszerzenia, oznaczone nazwą formatu. Zwykła notacja, taka jak `2d6` lub `4d6kh3`, zawsze działa jak dotychczas i nigdy nie trafia do rozszerzenia. Inna notacja trafia kolejno do każdego zarejestrowanego formatu, a rzut obsługuje pierwszy, którego `parse` zwróci kości.

- `parse(notation)` zwraca `null` albo `{ dice: [sides, ...] }` z 1-100 kośćmi o 2-1000 ściankach. Wszystko inne w obiekcie pozostaje w piaskownicy i jest przekazywane do `read` jako `plan`.
- `read(...)` zwraca `{ total, text?, kept? }`: skończoną liczbę, najwyżej 200 znaków zwykłego tekstu oraz opcjonalnie pozycje kości, które się liczyły, w kolejności rosnącej. `/roll` przekreśla pozostałe.
- Każde rozszerzenie może zarejestrować 4 formaty. Notacja ma najwyżej 100 znaków. `parse` i `read` mogą być asynchroniczne, ale każde musi odpowiedzieć w ciągu 2 sekund.
- Tekst jest pokazywany jako zwykły tekst: linki, obrazy, formatowanie i HTML są zamieniane na zapis dosłowny.

Formaty kości obsługują `/roll` w przeglądarce. Narzędzie `roll_dice` mistrza gry i inne rzuty po stronie serwera zachowują wbudowaną notację oraz kości zestawu zasad. Przed wywołaniem w starszych wersjach Engine sprawdź `typeof marinara.dice?.registerFormat === "function"`.

### Rozszerzenia starsze i z pełnym dostępem do strony

Sterowniki pogody, edytory promptów i inne rozbudowane procesy to dobre zastosowania dla wkładu w interfejs. Ich bezpieczne wersje mogą korzystać z uruchamiania z menu lub górnego paska oraz z paneli aktualizowanych krok po kroku. Istniejące pakiety, które wstawiają nakładki do drzewa DOM, odpytują selektory CSS aplikacji Marinara Engine, przeszukują wnętrze biblioteki React albo wywołują trasy `/api` z tego samego pochodzenia, nie zaimportują się do bezpiecznego środowiska bez zmian.

Wkład w interfejs daje sam interfejs, a nie dodatkowe uprawnienia. Interfejs kontekstu zawsze udostępnia identyfikatory aktywnego czatu i postaci, a poza tym wyłącznie wymienione wyżej zadeklarowane pola aktywnych rekordów. Funkcje, które potrzebują wiadomości, presetów, lorebooków, niezadeklarowanych danych postaci lub persony albo efektów wizualnych sceny, nadal wymagają osobnej, wąsko zakrojonej możliwości pośredniczącej udostępnionej przez aplikację Marinara Engine. Rozszerzenie nie może jej udawać przez dostęp do drzewa DOM hosta ani przez nieograniczone zapytania sieciowe.

Jeśli External Extension zależy od dostępu do drzewa DOM hosta, może o niego poprosić:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access nie jest możliwością piaskownicy.** Zatwierdzony kod JavaScript i CSS działa wewnątrz strony aplikacji Marinara Engine. Taki kod może odczytać lub zmienić wszystko, co widzi bieżąca sesja przeglądarki, zajrzeć do czatów i kart, korzystać z pamięci przeglądarki, wysyłać zapytania sieciowe oraz wywoływać interfejsy API aplikacji Marinara Engine z tego samego pochodzenia. W praktyce ma na stronie takie same uprawnienia jak kod wklejony do konsoli przeglądarki. Szkice od Professor Mari nie mogą o niego prosić.

Rozszerzenia z pełnym dostępem do strony powinny używać `marinara.fetch(...)` do żądań sieciowych. Funkcja ma taką samą sygnaturę i zwraca taki sam wynik jak `window.fetch`, a jednocześnie pozwala sekcji **Settings > Addons > External Extensions** wyświetlać liczbę żądań tego rozszerzenia w bieżącej sesji, liczbę przesłanych bajtów zgłaszaną przez odpowiedzi, ostatnią częstotliwość żądań oraz ostrzeżenie o utrzymującym się dużym ruchu. Bezpośrednie wywołania `window.fetch` pozostają dostępne, ponieważ pełny dostęp oznacza uruchamianie zaufanego kodu strony, ale tych żądań nie można przypisać do rozszerzenia.

Starszą kopertę `kind: "marinara.extension"` w wersji 1, bez wyraźnego pola `capabilities`, Marinara rozpoznaje jako pakiet sprzed piaskownicy i przy imporcie przypisuje jej **Full page access**. Dzięki temu starsze pakiety, na przykład WeatherTweaker, trafiają do właściwej ścieżki przeglądu, zamiast po cichu zawodzić w wątku Worker. Nowoczesny pakiet, który używa tej koperty, ale chce bezpiecznego środowiska, musi zawierać `"capabilities": []`.

Oba zabezpieczenia External Extension oraz zatwierdzenie dokładnego skrótu nadal obowiązują. Zmiana kodu, arkusza CSS lub uprawnień wyłącza rozszerzenie i wymaga ponownego zatwierdzenia. Wyłączenie usuwa węzły skryptu i arkusza stylów dodane przez aplikację Marinara Engine, anuluje timery utworzone przez interfejs zgodności i uruchamia funkcje zarejestrowane przez `marinara.onCleanup(...)`. Kod działający na stronie może jednak tworzyć niezarejestrowane nasłuchy, timery, zmienne globalne i zmiany w drzewie DOM, więc sprzątanie bywa niepełne. Jeśli coś zostanie, odśwież stronę po wyłączeniu rozszerzenia.

Starszy interfejs `marinara.ui.showWindow(...)` nadal działa i otwiera tymczasowe okno wewnątrz ramki iframe o nieprzezroczystym pochodzeniu. Korzysta z tego samego stałego zestawu kontrolek i zwraca uchwyty `update(...)` oraz `close()`. Kiedy narzędzie ma być osiągalne przez zwykłą nawigację aplikacji Marinara Engine, lepiej wybrać wkład w interfejs.

## Szybki start z Server Extension

Utwórz następujący folder:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Użyj następującego pliku `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Użyj następującego pliku `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

Ten sam działający pakiet jest dostępny w katalogu `docs/examples/personal-extensions/server-minimal/`.

Kod serwera otrzymuje `marinara.runtime`, `marinara.version`, tożsamość rozszerzenia, `log`, `storage`, zarządzane timery i `onCleanup`. Nie otrzymuje dostępu do systemu plików, procesów, sieci, ładowania modułów ani bazy danych aplikacji Marinara.

Server Extensions pozostają wyłączone, jeśli host nie może uruchomić mechanizmu Seatbelt albo Bubblewrap. Jest to ograniczenie platformy, a nie błąd rozszerzenia.

## Opis pakietu i manifestu

| Pole | Uwagi |
| --- | --- |
| `kind` | `marinara.personal-extension` albo `marinara.personal-server-extension` |
| top-level `version` | Wersja opakowania pakietu; obecnie `1` |
| `config.name` | Wymagana nazwa wyświetlana, od 1 do 200 znaków |
| `config.version` | Opcjonalna wersja rozszerzenia, np. `1.2.0`; numeryczne wersje rozdzielone kropkami pozwalają ostrzegać o obniżeniu wersji |
| `config.description` | Opcjonalny opis o długości do 2000 znaków |
| `config.runtime` | `client` albo `server`; domyślnie `client` |
| `config.capabilities` | Żądane możliwości Browser; Server Extensions muszą używać pustej listy |
| `config.jsPath` / `config.serverJsPath` | Ścieżka do pliku JavaScript albo uporządkowana tablica ścieżek względem manifestu |
| `config.cssPath` | Opcjonalna ścieżka do pliku CSS albo uporządkowana tablica; CSS bezpiecznego środowiska pozostaje w ramce iframe piaskownicy |
| `config.js`, `config.serverJs`, `config.css` | Alternatywny kod wbudowany, gdy osobne pliki nie są potrzebne |

Używaj zwykłego języka JavaScript. Marinara nie kompiluje TypeScript ani nie instaluje zależności rozszerzenia. W razie potrzeby dołącz zależności do kodu JavaScript przed importem.

Można również bezpośrednio importować luźne pliki `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` i `.css`. Manifest jest preferowany, ponieważ jawnie zapisuje tożsamość, środowisko, wersję, możliwości i kolejność plików.

### Limity walidacji

| Zawartość | Bieżące ograniczenie |
| --- | --- |
| Nazwa / wersja / opis | 200 znaków / 64 znaki / 2000 znaków |
| Kod JS środowiska Browser lub Server | Brak limitu dla pojedynczego pola źródłowego; nadal obowiązuje limit otaczającego pliku, archiwum lub żądania |
| CSS | 256 KiB |
| Importowane archiwum ZIP | 32 MiB po kompresji, 2 MiB na wpis tekstowy i 16 MiB całego wyodrębnionego tekstu |
| Prywatna pamięć | 1 000 000 bajtów zserializowanego JSON na rozszerzenie |

Limity archiwum ZIP, żądania, wiadomości piaskownicy i pamięci chronią osobne granice transportu lub środowiska; nie stanowią zasad dotyczących źródła wykonywalnego.

## Cykl aktualizacji i odzyskiwania

- Każdy nowy import jest początkowo wyłączony i niezatwierdzony.
- Edycja kodu, CSS, środowiska lub możliwości usuwa zatwierdzenie i wyłącza rozszerzenie.
- Ponowny import tej samej nazwy aktualizuje istniejący rekord po potwierdzeniu. Ponowny import identyczny co do bajtu zachowuje bieżący skrót i zatwierdzenie; zmieniona zawartość wykonywalna usuwa zatwierdzenie. Marinara ostrzega, gdy wersje numeryczne wskazują obniżenie wersji.
- **Export** (eksport) zapisuje bieżący manifest i pliki źródłowe w przenośnym pakiecie. Zatwierdzenie nigdy nie jest eksportowane.
- Przywrócenie wersji, import profilu lub odtworzenie kopii zapasowej pozostawia rozszerzenie wyłączone do czasu ponownego sprawdzenia.
- **Disable** (wyłączenie) zatrzymuje środowisko i zarejestrowane sprzątanie. Kod całostronicowy może wymagać ponownego załadowania strony, jeśli utworzył niezarejestrowane skutki uboczne.
- **Delete** (usunięcie) usuwa zainstalowany rekord. Najpierw wykonaj eksport, jeśli źródło może być jeszcze potrzebne.

## Debugowanie

| Objaw | Sprawdź |
| --- | --- |
| Nie ma kontrolek importu zewnętrznego | Otwórz oba opisane wyżej zabezpieczenia External Extension |
| Zarządzanie zgłasza, że wymagany jest localhost lub Admin Access | Skonfiguruj `ADMIN_SECRET` i zapisz go w **Admin Access** |
| Import nie znajduje rozszerzenia | Sprawdź `manifest.json` i ścieżki względne; Server potrzebuje JS, a Browser potrzebuje CSS lub JS |
| Rozszerzenie wyłącza się po edycji | To oczekiwane: sprawdź i zatwierdź nowy dokładny skrót |
| Kod Browser nie może użyć `document`, `window`, `fetch` ani pamięci lokalnej | To oczekiwane w bezpiecznej piaskownicy; użyj udokumentowanych interfejsów pośredniczących |
| Server Extension jest niedostępne | Użyj mechanizmu Seatbelt w systemie macOS albo systemu Linux z Bubblewrap lub przełącz się na Browser Extension |
| Browser Extension zgłasza wyjątek | Otwórz narzędzia deweloperskie przeglądarki; wpisy `marinara.log` i błędy uruchamiania są oznaczone nazwą rozszerzenia |
| Server Extension zgłasza wyjątek | Sprawdź jego stan w **Settings → Addons** (ustawienia, dodatki) oraz dziennik serwera Marinara |

Kod CSS, prywatna pamięć, archiwa importu i wiadomości środowiska mają osobne limity bezpieczeństwa. Marinara powinna zgłosić granicę, która odrzuciła pakiet, zamiast przedstawiać problem jako błąd wykonania.

## Powiązane przewodniki

- [Rozszerzenia osobiste](personal-extensions.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Rozwiązywanie problemów](../TROUBLESHOOTING.md)
- [Architektura rozszerzeń osobistych](../development/personal-extensions.md)
