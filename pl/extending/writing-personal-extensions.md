# Pisanie własnych rozszerzeń

Ten przewodnik jest przeznaczony dla osób tworzących własne rozszerzenia aplikacji Marinara Engine. Informacje o instalowaniu, sprawdzaniu i bezpiecznym uruchamianiu rozszerzenia znajdziesz najpierw w przewodniku [Personal Extensions](personal-extensions.md).

Kod, który samodzielnie napiszesz i zaimportujesz, jest traktowany jako **External Extension** (rozszerzenie zewnętrzne). Początkowo jest wyłączony i nie może działać, dopóki nie sprawdzisz go i nie zatwierdzisz jego dokładnego skrótu SHA-256.

## Zanim zaczniesz

External Extensions są ukryte, dopóki nie otworzysz obu zabezpieczeń:

1. Ustaw `ENABLE_EXTERNAL_EXTENSIONS=true` w pliku `.env` hosta Marinara.
2. Otwórz **Settings** > **Advanced** > **Danger Zone** i włącz **Allow third-party extension imports**.

Importowanie rozszerzeń i zarządzanie nimi wymaga także dostępu przez localhost albo skonfigurowanego **Admin Access**. Jeśli używasz aplikacji Marinara z telefonu, adresu LAN lub zdalnej przeglądarki, ustaw `ADMIN_SECRET` na serwerze i wpisz tę samą wartość w **Settings** > **Advanced** > **Admin Access**.

Wybierz środowisko o najmniejszych uprawnieniach, które wystarczą do wykonania zadania:

| Środowisko | Zastosowanie | Ważne ograniczenie |
| --- | --- | --- |
| Sandboxed Browser Extension | Prywatny stan, kontekst aktywnego czatu, przyciski, akcje menu i panele renderowane przez aplikację Marinara | Brak dostępu do DOM aplikacji Marinara, ciasteczek, pamięci przeglądarki, sieci i dowolnego HTML |
| Server Extension | Logika działająca w tle, która potrzebuje zarządzanych timerów i prywatnej pamięci rozszerzenia | Osobna piaskownica systemu operacyjnego; brak dostępu do plików i sekretów aplikacji Marinara, sieci, procesów potomnych i modułów natywnych |
| Full-page External Extension | Starszy kod, który naprawdę potrzebuje dostępu do strony aplikacji Marinara lub interfejsów API tego samego źródła | Brak piaskownicy; używaj tylko w przypadku dokładnie sprawdzonego i w pełni zaufanego kodu |

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

1. Otwórz **Settings** > **Addons** > **External Extensions**.
2. Wybierz **Import Folder** i wskaż folder `Hello Panel` albo spakuj folder do archiwum ZIP i zaimportuj je.
3. Otwórz wyłączoną wersję roboczą i sprawdź jej manifest oraz kod JavaScript.
4. Wybierz **Review and Run** i zatwierdź dokładnie wyświetlony skrót.
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
| `context.get()` | Odczyt bieżącego obrazu aktywnego czatu |
| `context.subscribe(listener)` | Odbieranie zmian kontekstu; zwraca funkcję anulującą subskrypcję |
| `ui.registerContribution(options)` | Dodanie bezpiecznego przycisku, pozycji menu Extensions albo panelu renderowanego przez aplikację Marinara |
| `ui.showWindow(options)` | Otwarcie ograniczonego okna iframe |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Zarządzane timery usuwane po zatrzymaniu rozszerzenia |
| `onCleanup(callback)` | Zarejestrowanie dodatkowej logiki sprzątającej |

Do zwykłego interfejsu używaj [paneli renderowanych przez aplikację Marinara](personal-extensions.md#add-a-marinara-rendered-panel), a do zachowania zależnego od czatu - [kontekstu aktywnego czatu](personal-extensions.md#use-active-chat-context). Stan rozszerzenia należy do `marinara.storage`, a nie do pamięci przeglądarki.

`showWindow({ title, elements, onEvent, onClose })` zwraca uchwyt z metodami `update({ title?, elements? })` oraz `close()`. Kod CSS pakietu nadaje styl oknom iframe działającym w piaskownicy; elementy renderowane przez hosta zawsze używają motywu i kontrolek aplikacji Marinara.

Bezpieczne środowisko Browser nie udostępnia DOM ani sieciowego API. Nie obchodź tego ograniczenia. Jeśli brakuje użytecznej możliwości, poproś o wąską możliwość po stronie hosta, zamiast domyślnie przełączać się na dostęp do całej strony.

### Możliwości kontekstu

Zadeklaruj opcjonalny dostęp do rekordów w `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` wypełnia ograniczony zestaw pól kart Character z aktywnego czatu.
- `read_active_persona` wypełnia ograniczony zestaw pól wybranej Persony.
- `full_page_access` wybiera środowisko zgodności bez piaskownicy i jest dostępne tylko dla External Extensions.

Zmiana możliwości zmienia skrót kodu wykonywalnego, wyłącza rozszerzenie i wymaga ponownego sprawdzenia.

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
- **Export** zapisuje bieżący manifest i pliki źródłowe w przenośnym pakiecie. Zatwierdzenie nigdy nie jest eksportowane.
- Przywrócenie wersji, import profilu lub odtworzenie kopii zapasowej pozostawia rozszerzenie wyłączone do czasu ponownego sprawdzenia.
- **Disable** zatrzymuje środowisko i zarejestrowane sprzątanie. Kod całostronicowy może wymagać ponownego załadowania strony, jeśli utworzył niezarejestrowane skutki uboczne.
- **Delete** usuwa zainstalowany rekord. Najpierw wykonaj eksport, jeśli źródło może być jeszcze potrzebne.

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
| Server Extension zgłasza wyjątek | Sprawdź jego stan w **Settings** > **Addons** oraz dziennik serwera Marinara |

Kod CSS, prywatna pamięć, archiwa importu i wiadomości środowiska mają osobne limity bezpieczeństwa. Marinara powinna zgłosić granicę, która odrzuciła pakiet, zamiast przedstawiać problem jako błąd wykonania.

## Powiązane przewodniki

- [Personal Extensions](personal-extensions.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Rozwiązywanie problemów](../TROUBLESHOOTING.md)
- [Architektura Personal Extension](../development/personal-extensions.md)
