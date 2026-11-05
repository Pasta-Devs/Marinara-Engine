# Własne narzędzia i wywoływanie funkcji

Własne narzędzie (nazywane też funkcją) pozwala AI wykonać drobną akcję w trakcie czatu. Akcja może zwrócić stały fragment tekstu, odpytać adres internetowy albo uruchomić krótki skrypt na serwerze. Użyj go, gdy chcesz, żeby AI coś sprawdziło albo obliczyło, zamiast zgadywać.

Wywoływanie funkcji oznacza, że AI prosi aplikację o wykonanie akcji, a potem wykorzystuje wynik w odpowiedzi. Aplikacja Marinara Engine ma już wbudowane narzędzia, takie jak rzuty kością, wyszukiwanie w lorebookach i aktualizacje stanu gry. Twoje własne narzędzia działają obok nich. Własne narzędzie nie jest przypięte do karty postaci. Włączasz je dla czatu albo przypinasz do agenta (pomocnika, który działa obok czatu).

> **Uwaga:** Narzędzia wymagają połączenia, które je obsługuje. Połączenia subskrypcyjne Claude i Grok ignorują definicje narzędzi, dlatego panel **Chat Settings** (ustawienia czatu) pokazuje dla nich informację i wyłącza kontrolki narzędzi. Polecenia tekstowe i znaczniki kości nadal działają.

## Tworzenie narzędzia

Zanim zaczniesz, otwórz panel **Presets** (presety) z górnego paska. Narzędzia znajdują się w jego sekcji **Functions** (funkcje, ikona klucza). Jeśli otwierasz aplikację Marinara z innego urządzenia, najpierw zapisz sekret administratora w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny). Musi on być zgodny z `ADMIN_SECRET` serwera; zobacz przewodnik [Konfiguracja serwera](../CONFIGURATION.md).

Na pierwszą próbę wybierz **Static Result** (stały wynik): nie potrzebuje niczego więcej.

### Jak utworzyć narzędzie

1. Otwórz **Presets** i znajdź **Functions**.
2. Kliknij **Create function** (utworzenie funkcji, ikona plusa). Otwiera się pusty edytor narzędzia.
3. Wpisz nazwę małymi literami w formacie snake_case, np. `check_weather`. Dokładnie tej nazwy AI używa do wywołania narzędzia. Nazwa zaczyna się od małej litery, a dalej zawiera małe litery, cyfry i podkreślenia.
4. Wypełnij pole **Description** (opis). Napisz je jak instrukcję dla AI, bo AI czyta je, żeby zdecydować, kiedy wywołać narzędzie. Przykład: `Get the current weather for a city the user names.`
5. Dodaj parametry, których narzędzie potrzebuje (zobacz [Dodawanie parametrów](#add-parameters)).
6. Wybierz **Execution Type** (typ wykonania): **Static Result**, **Webhook** albo **Script** (skrypt).
7. Wypełnij pole właściwe dla tego typu (zobacz [Wybór typu wykonania](#choose-an-execution-type)).
8. Kliknij **Save** (zapis). Obok przycisku mignie zielony napis **Saved**.

Zasady dotyczące nazw i opisów:

- Nazwa ma od 1 do 100 znaków. Opis ma od 1 do 500 znaków.
- Dwa narzędzia nie mogą mieć tej samej nazwy, a narzędzie nie może używać nazwy wbudowanej, takiej jak `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` czy `update_about_me`. Przy kolizji pojawia się komunikat, np. `"your_name" is a reserved built-in tool name.`
- Jeśli wychodzisz z edytora z niezapisanymi zmianami, pasek oferuje **Keep editing** (dalsza edycja), **Discard** (odrzucenie) i **Save & close** (zapisanie i zamknięcie).

Nagłówek sekcji **Functions** ma trzy przyciski z ikonami:

- **Create function** (ikona plusa)
- **Import functions from ZIP or JSON** (import funkcji z pliku ZIP lub JSON)
- **Export functions to ZIP** (eksport funkcji do pliku ZIP), wyszarzony, gdy nie masz żadnych narzędzi

Każde narzędzie na liście pokazuje:

- nazwę, typ, liczbę parametrów i opis;
- przełącznik włącz/wyłącz;
- **Edit function** (edycja funkcji) i **Delete Function** (usunięcie funkcji).

Przeciągnij narzędzie za uchwyt, żeby zmienić kolejność listy. Kolejność służy tylko do wyświetlania. Gdy nie ma żadnych narzędzi, lista pokazuje napis **No functions yet**.

<a id="add-parameters"></a>

## Dodawanie parametrów

Parametry to dane wejściowe, które AI przesyła przy wywołaniu narzędzia. Każdy ma nazwę, typ, znacznik wymagalności i opis.

1. W grupie **Parameters** (parametry) kliknij **Add Parameter** (dodanie parametru).
2. Wpisz nazwę, np. `city`.
3. Wybierz typ: `string`, `number`, `boolean`, `array` albo `object`.
4. Włącz **Required** (wymagany), jeśli AI zawsze musi przesłać tę wartość.
5. Napisz opis, który mówi AI, co ta wartość oznacza, np. `The city name to look up, such as Tokyo.`

Kolejne wiersze dodaje przycisk **Add Parameter**, a wiersz usuwa jego przycisk z minusem. Wiersz z pustą nazwą znika przy zapisie.

Jeśli AI nigdy nie wywołuje zaimportowanego narzędzia, jego parametry mogą być niepoprawne, a wtedy aplikacja pomija narzędzie bez informowania cię o tym. Usuń parametry i dodaj je ponownie ręcznie.

<a id="choose-an-execution-type"></a>

## Wybór typu wykonania

### Static Result

Narzędzie typu **Static Result** za każdym razem zwraca ten sam tekst. Nie potrzebuje żadnej zewnętrznej usługi. Na jego kafelku widnieje napis **Returns a fixed string when called.**

Jedyne pole to **Static Result**, wieloliniowe pole tekstowe. Jeśli zostawisz je puste, narzędzie zwraca `OK`.

Przykład: narzędzie o nazwie `store_hours` bez parametrów, z takim polem **Static Result**:

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Gdy AI wywoła `store_hours`, otrzymuje ten tekst razem z nazwą narzędzia i przesłanymi argumentami i może podać użytkownikowi twoje godziny otwarcia.

### Webhook

Narzędzie typu **Webhook** wysyła wywołanie pod adres internetowy i zwraca AI odpowiedź tej usługi. Webhook to adres, który przyjmuje dane i odsyła dane z powrotem. Na jego kafelku widnieje napis **Sends a POST request to an external URL.**

Jedyne pole to **Webhook URL** (adres webhooka). Aplikacja wysyła żądanie POST, czyli przesyła dane do usługi internetowej. Treść żądania to JSON, prosty tekstowy format zapisu uporządkowanych danych, o takim kształcie:

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

Jeśli włączysz **Include hidden chat context** (dołączenie ukrytego kontekstu czatu), treść żądania zawiera też wartość `context`. Usługa odpowiada w formacie JSON albo zwykłym tekstem, a ta odpowiedź wraca do AI.

Przykład: narzędzie o nazwie `check_weather` z jednym wymaganym parametrem tekstowym `city` i takim polem **Webhook URL**:

```text
https://api.example.com/weather
```

Gdy AI wywoła je z `city` ustawionym na Tokyo, twoja usługa sprawdza pogodę i odpowiada, a AI wykorzystuje tę odpowiedź w swojej wiadomości.

Limity:

- Odpowiedź ma limit 512 KB.
- Każde wywołanie ma limit czasu. Domyślnie to 60 sekund (`CUSTOM_TOOL_TIMEOUT_MS`).
- Domyślnie dozwolone są tylko adresy `https://`. Adresy prywatne i lokalne, takie jak `localhost` czy adres w sieci domowej, są blokowane, dopóki administrator serwera na nie nie zezwoli. Zobacz przewodnik [Konfiguracja serwera](../CONFIGURATION.md).
- Jeśli wywołanie się nie powiedzie albo przekroczy limit czasu, AI otrzymuje wynik z błędem, a czat toczy się dalej.

Jeśli to nie zadziałało: sprawdź, czy adres zaczyna się od `https://` i czy jest osiągalny. Adres lokalny pozostaje zablokowany, dopóki administrator na niego nie zezwoli. Wolna usługa może przekroczyć limit 60 sekund.

### Script

Narzędzie typu **Script** uruchamia krótki fragment kodu JavaScript na serwerze i zwraca wynik. JavaScript to popularny język programowania. Na jego kafelku widnieje napis **Runs a JavaScript expression server-side.**

Narzędzia skryptowe są domyślnie wyłączone. Jeśli serwer ich nie włączył, kafelek **Script** jest wyszarzony i pojawia się bursztynowa plakietka **Script disabled**. Żeby je włączyć, administrator serwera dopisuje tę linię do pliku `.env` serwera i uruchamia ponownie aplikację Marinara:

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Jedyne pole to **Script Body** (treść skryptu). Skrypt czyta `args` (wartości przesłane przez AI) i musi zwrócić wynik instrukcją `return`. Dostępne są `JSON`, `Math` i `Date`.

Przykład: narzędzie o nazwie `add_numbers` z dwoma wymaganymi parametrami liczbowymi `x` i `y` oraz takim polem **Script Body**:

```js
const result = args.x + args.y;
return { sum: result };
```

Gdy AI wywoła je z `x` równym 2 i `y` równym 3, narzędzie zwraca sumę 5. Jeśli skrypt zgłosi błąd, AI otrzymuje wynik z błędem.

Skrypt uruchamia prawdziwy kod na twoim serwerze, wewnątrz piaskownicy (odgrodzonego obszaru, który ogranicza możliwości kodu):

- Brak dostępu do sieci i do plików.
- Brak dostępu do zmiennych środowiskowych i sekretów serwera.
- Limit czasu. Domyślnie to 60 sekund.

Piaskownica nie jest pełną izolacją na poziomie systemu operacyjnego. Ktoś, kto może tworzyć narzędzia, nadal może napisać skrypt marnujący procesor albo pamięć. Włączaj narzędzia skryptowe tylko na serwerach, którym ufasz, i zachowaj ostrożność przy skryptach napisanych przez inne osoby.

Jeśli to nie zadziałało: gdy kafelek **Script** jest wyszarzony, poproś administratora o ustawienie `CUSTOM_TOOL_SCRIPT_ENABLED=true` i ponowne uruchomienie.

### Dołączanie ukrytego kontekstu czatu

Narzędzia typu **Webhook** i **Script** mogą otrzymywać dodatkowe dane czatu, których AI nie widzi jako danych wejściowych narzędzia. Włącz **Include hidden chat context** w edytorze narzędzia (domyślnie wyłączone). Twoje narzędzie otrzymuje wtedy wartość `context`, która może zawierać:

- tryb czatu;
- nazwę aktywnej persony i nazwy postaci;
- zapisane zmienne czatu;
- w trybie Game Mode stan gry.

Dzięki temu narzędzie może dopasować wynik, a AI nie musi przesyłać wszystkich tych danych.

## Włączanie narzędzi w czacie

Samo utworzenie narzędzia nie sprawia, że AI z niego korzysta. Trzeba jeszcze włączyć korzystanie z narzędzi w czacie.

1. Otwórz czat, a potem **Chat Settings**.
2. Otwórz sekcję **Function Calling** (wywoływanie funkcji, ikona klucza).
3. Włącz **Enable Tool Use** (zezwolenie na korzystanie z narzędzi). Jego opis brzmi **Allow AI to call functions (dice rolls, game state, etc.)**. W nowym czacie jest domyślnie wyłączony.
4. Sprawdź, czy działa: zadaj AI pytanie, na które odpowiada twoje narzędzie, np. "Jakie są godziny otwarcia sklepu?" w przypadku przykładu `store_hours`. Odpowiedź powinna wykorzystać tekst narzędzia.

Gdy **Enable Tool Use** jest włączone, a poniżej nic nie dodano, czat może korzystać ze wszystkich globalnie włączonych narzędzi, które obsługuje: z narzędzi wbudowanych oraz z każdego własnego narzędzia, którego przełącznik w sekcji **Functions** jest włączony. Czaty Game wymagają też **Let the GM search lore** (pozwól postaci GM przeszukiwać lorebooki) dla `search_lorebook`.

Aby ograniczyć czat do wybranego zestawu:

1. Kliknij **Add Functions** (dodanie funkcji). Otwiera się okno wyboru z polem wyszukiwania, które dopasowuje tylko nazwy narzędzi.
2. Zaznacz narzędzia, które chcesz. Lista łączy narzędzia wbudowane i własne.
3. Kliknij **Add Selected** (dodanie zaznaczonych).

Po dodaniu choćby jednego narzędzia w tym czacie działają tylko dodane narzędzia. Przycisk **New Custom Function** (nowa własna funkcja) w oknie wyboru przenosi do edytora narzędzia.

Czaty Game mogą używać osobnego połączenia do planowania narzędzi. Jego koszt i działanie opisuje sekcja [Opcjonalne planowanie narzędzi i wyszukiwanie w lorebookach](../game/getting-started.md#optional-tool-planning-and-lore-searches).

Jeśli to nie zadziałało: upewnij się, że **Enable Tool Use** jest włączone, że narzędzie jest na liście czatu (jeśli dodano konkretne narzędzia) i że przełącznik narzędzia w sekcji **Functions** jest włączony. Jaśniejszy opis w polu **Description** i jaśniejsze opisy parametrów pomagają AI zdecydować, kiedy je wywołać.

## Przypinanie narzędzi do agenta

Narzędzie można też dać agentowi zamiast czatowi.

1. Otwórz panel **Agents** (agenci) i otwórz agenta.
2. Otwórz jego grupę **Tools / Function Calling** (narzędzia i wywoływanie funkcji).
3. Włącz narzędzia, z których ten agent może korzystać.

Nadal trzeba włączyć **Enable Tool Use** w sekcji **Function Calling** czatu. Przypomina o tym stopka edytora agenta. Agentów ogólnie opisuje przewodnik [Tworzenie własnych agentów](../agents/custom-agents.md).

## Eksport i import narzędzi

- Żeby wyeksportować jedno narzędzie, otwórz je i kliknij **Export function** (eksport funkcji). Zapisuje się plik `.json`.
- Żeby wyeksportować wszystkie narzędzia, kliknij **Export functions to ZIP**.
- Żeby zaimportować, kliknij **Import functions from ZIP or JSON** i wskaż plik `.json` albo `.zip`. Komunikat podaje, ile narzędzi zaimportowano.

Zaimportowane narzędzia typu Webhook i Script zapisują się zawsze wyłączone, z wyłączonym **Include hidden chat context**, nawet jeśli plik prosi o którekolwiek z tych ustawień. Marinara pokazuje wtedy typ, adres webhooka i uprawnienia, o które prosił plik. Otwórz każde zaimportowane narzędzie, sprawdź je i włącz tylko wtedy, gdy mu ufasz. Narzędzia statyczne zachowują stan włączenia zapisany w pliku importu.

Import pomija każde narzędzie, którego nazwa koliduje z istniejącym lub wbudowanym narzędziem. Pakiety agentów nie zawierają własnych narzędzi: wyeksportuj je i przejrzyj osobno, a potem przypnij je po zaimportowaniu agenta.

## Powiązane przewodniki

- [Tworzenie własnych agentów](../agents/custom-agents.md)
- [Integracja z Home Assistant](../integrations/home-assistant.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
