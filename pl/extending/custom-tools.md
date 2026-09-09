# Własne narzędzia i wywoływanie funkcji

Ten przewodnik wyjaśnia, czym są własne narzędzia, nazywane też funkcjami, w aplikacji Marinara Engine. Własne narzędzie uczy AI wykonywania drobnej akcji w trakcie czatu. Może zwrócić stały fragment tekstu, odpytać zewnętrzny adres internetowy albo uruchomić krótki skrypt na serwerze. Zobaczysz, jak zbudować takie narzędzie, jak włączyć korzystanie z narzędzi w czacie i jak bezpiecznie obchodzić się z narzędziami skryptowymi.

## Czym jest wywoływanie funkcji

Dzięki wywoływaniu funkcji AI może poprosić aplikację o wykonanie akcji, a potem wykorzystać wynik w odpowiedzi. Aplikacja ma już wbudowane narzędzia: rzuty kością, wyszukiwanie w lorebookach czy aktualizacje stanu gry. Własne narzędzia stoją obok tych wbudowanych, w tym samym systemie **Function Calling** (wywoływanie funkcji).

Własne narzędzie przydaje się na przykład do tego:

- Zwracania stałego faktu, na przykład godzin otwarcia sklepu albo zestawu zasad domowych.
- Pytania zewnętrznej usługi o dane na żywo, na przykład o pogodę albo o urządzenie w inteligentnym domu.
- Wykonania szybkiego obliczenia, na przykład dodania liczb albo wylosowania własnego wyniku.

Własne narzędzie nie jest przypięte do karty postaci. Zamiast tego włącza się je dla czatu albo przypina do agenta. Agent to pomocnik działający obok czatu. Poniżej opisane są obie drogi.

Natywne wywoływanie funkcji wymaga połączenia obsługującego narzędzia. Transporty subskrypcyjne Claude i Grok ignorują natywne definicje narzędzi, dlatego panel Chat Settings pokazuje informację o dostępności i wyłącza dla nich kontrolki narzędzi. Ich polecenia tekstowe i znaczniki kości pozostają dostępne. Czaty Game mogą wybrać osobne połączenie do planowania narzędzi; koszt i działanie opisuje sekcja [Opcjonalne planowanie narzędzi i wyszukiwanie w lorebookach](../game/getting-started.md#optional-tool-planning-and-lore-searches).

Wyszukiwanie w lorebookach korzysta z rankingu semantycznego, gdy włączone wpisy mają zgodne wektory. Tryby Conversation i Roleplay zachowują dopasowanie tekstowe, gdy wyszukiwanie semantyczne jest niedostępne. Wyszukiwanie lore w Game wymaga osobnego włączenia i zgłasza brakujące lub niezgodne wektory; nigdy nie wektoryzuje książki automatycznie.

## Sekcja **Functions**

Własne narzędzia tworzy się i porządkuje w panelu **Presets** (presety).

1. Otwórz górny pasek i kliknij przycisk **Presets**.
2. Znajdź sekcję **Functions** (funkcje) – jej ikoną jest klucz.
3. Pod nagłówkiem widać podpis **Custom function calls available from Chat Settings**.

Nagłówek sekcji ma trzy przyciski z ikonami:

- **Create function** (utworzenie funkcji, ikona plusa) otwiera pusty edytor narzędzia.
- **Import functions from ZIP or JSON** (import funkcji z pliku ZIP lub JSON, ikona pobierania) otwiera okno wyboru pliku.
- **Export functions to ZIP** (eksport funkcji do pliku ZIP, ikona wysyłania) zapisuje wszystkie narzędzia do jednego pliku. Przycisk jest wyszarzony, dopóki nie ma żadnego narzędzia.

Każde narzędzie na liście pokazuje nazwę i dwa małe kafelki: typ oraz liczbę parametrów. Widać przy nim też krótki opis, przełącznik włącz/wyłącz, przycisk **Edit function** (edycja funkcji) i przycisk **Delete function** (usunięcie funkcji). Narzędzie typu **Script** dostaje dodatkowo bursztynowy kafelek **Script disabled**, gdy narzędzia skryptowe są wyłączone na serwerze. Sekcja Typ wykonania: Script poniżej wyjaśnia, jak je włączyć. Narzędzia da się przeciągać za uchwyt, żeby zmienić kolejność listy. Kolejność jest tylko wizualna i nie zmienia działania. Dopóki nie ma żadnych narzędzi, lista pokazuje napis **No functions yet**.

Zarządzanie narzędziami, czyli tworzenie, edycja, usuwanie, zmiana kolejności i przełącznik włącz/wyłącz, korzysta z chronionej części aplikacji. Jeśli zarządzasz narzędziami z innego urządzenia niż komputer z serwerem, trzeba najpierw zapisać sekret administratora. Zajrzyj do przewodnika [Konfiguracja serwera](../CONFIGURATION.md) oraz do uwagi w sekcji Bezpieczeństwo skryptów poniżej.

## Tworzenie narzędzia

Wykonaj kolejno te kroki, żeby zbudować narzędzie.

1. W sekcji **Functions** kliknij przycisk **Create function**. Otwiera się pełny edytor narzędzia.
2. W polu nazwy na górze wpisz nazwę zapisaną małymi literami w formacie snake_case. Dokładnie tej nazwy AI używa do wywołania narzędzia. Poprawna nazwa zaczyna się od małej litery, a dalej zawiera tylko małe litery, cyfry i podkreślenia. Przykład: `check_weather`.
3. Wypełnij pole **Description** (opis). Napisz je jak instrukcję dla AI, bo to na jego podstawie AI decyduje, kiedy wywołać narzędzie. Przykład: `Get the current weather for a city the user names.`
4. Dodaj wszystkie **Parameters** (parametry), których narzędzie potrzebuje (patrz następna sekcja).
5. Wybierz **Execution Type** (typ wykonania): **Static Result**, **Webhook** albo **Script**.
6. Wypełnij pole właściwe dla wybranego typu.
7. Kliknij przycisk **Save** (zapis). Obok przycisku powinien mignąć zielony napis **Saved**.

Kilka zasad, o których warto wiedzieć:

- Nazwa musi mieć od 1 do 100 znaków. Opis musi mieć od 1 do 500 znaków.
- Dwa narzędzia nie mogą mieć tej samej nazwy. Nie da się też użyć nazwy narzędzia wbudowanego (patrz sekcja Nazwy zastrzeżone poniżej).
- Przy wyjściu z edytora z niezapisanymi zmianami pojawia się pasek z opcjami **Keep editing**, **Discard** i **Save & close**.

## Budowanie parametrów

Parametry to dane wejściowe, które AI przekazuje przy wywołaniu narzędzia. Każdy parametr ma nazwę, typ, znacznik wymagalności i opis.

1. W grupie **Parameters** kliknij przycisk **Add Parameter** (dodanie parametru).
2. Wpisz nazwę parametru, na przykład `city`.
3. Wybierz typ z listy rozwijanej: `string`, `number`, `boolean`, `array` albo `object`.
4. Włącz przełącznik **Required** (wymagany), jeśli AI zawsze musi przesłać tę wartość.
5. Napisz opis, który mówi AI, co ta wartość oznacza. Przykład: `The city name to look up, such as Tokyo.`

Kolejne wiersze dodaje przycisk **Add Parameter**, a wiersz usuwa przycisk z minusem obok niego. Wiersz z pustą nazwą znika przy zapisie. Dobre opisy parametrów mają duże znaczenie, bo to z nich AI dowiaduje się, co ma przesłać.

Jeśli narzędzie nigdy nie zostaje wywołane, częstą przyczyną jest zepsuta konfiguracja parametrów. Zwykle zdarza się to po zaimportowaniu narzędzia z ręcznie edytowanego pliku z niepoprawnymi parametrami. W takiej sytuacji aplikacja po cichu pomija narzędzie podczas generowania i zapisuje tylko wzmiankę w logu serwera.

## Typ wykonania: Static Result

Narzędzie typu **Static Result** przy każdym wywołaniu zwraca ten sam, stały fragment tekstu. Nie potrzebuje żadnej zewnętrznej usługi i działa od razu u każdego. Opis tego typu brzmi **Returns a fixed string when called.**

Jedyne pole to **Static Result** – wieloliniowe okienko tekstowe. To, co w nim wpiszesz, wraca do AI przy każdym wywołaniu narzędzia. Puste pole oznacza, że narzędzie zwraca `OK`.

Przykład z życia. Utwórz narzędzie o nazwie `store_hours` z pustą listą parametrów. W polu **Static Result** wpisz to:

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Teraz, gdy AI wywoła `store_hours`, dostaje ten tekst z powrotem i może podać użytkownikowi godziny otwarcia. AI widzi ten tekst razem z nazwą narzędzia i przesłanymi argumentami, a nie samą linię w oderwaniu.

## Typ wykonania: Webhook

Narzędzie typu **Webhook** wysyła wywołanie na zewnętrzny adres internetowy i zwraca AI odpowiedź tej usługi. Webhook to adres internetowy, który przyjmuje dane i odsyła dane z powrotem. Opis tego typu brzmi **Sends a POST request to an external URL.**

Jedyne pole to **Webhook URL** (adres webhooka). Aplikacja wysyła pod ten adres żądanie POST. Żądanie POST to sposób przesyłania danych do usługi internetowej. Treść żądania to JSON, czyli prosty tekstowy format zapisu danych, o takim kształcie:

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

Usługa powinna odpowiedzieć w formacie JSON albo zwykłym tekstem. Ta odpowiedź trafia do AI.

Przykład z życia. Utwórz narzędzie o nazwie `check_weather` z jednym wymaganym parametrem tekstowym o nazwie `city`. W polu **Webhook URL** wpisz adres własnej usługi:

```
https://api.example.com/weather
```

Kiedy AI wywoła `check_weather` z parametrem `city` ustawionym na Tokyo, usługa odbiera żądanie, sprawdza pogodę i odpowiada. AI wykorzystuje potem tę odpowiedź w swojej wiadomości.

Co warto wiedzieć o webhookach:

- Odpowiedź ma limit 512 KB.
- Każde wywołanie ma limit czasu ustawiony na serwerze. Domyślnie to 60 sekund.
- Domyślnie dozwolone są tylko adresy `https://`. Adresy prywatne i lokalne, takie jak `localhost` czy adres w sieci domowej, są blokowane. Administrator serwera musi włączyć osobne ustawienie, żeby zezwolić na adresy lokalne. Zajrzyj do przewodnika [Konfiguracja serwera](../CONFIGURATION.md).
- Jeśli wywołanie się nie powiedzie albo przekroczy limit czasu, AI dostaje wynik z błędem, a czat działa dalej.

## Typ wykonania: Script

Narzędzie typu **Script** uruchamia krótki fragment kodu JavaScript na serwerze i zwraca wynik. JavaScript to popularny język programowania. Opis tego typu brzmi **Runs a JavaScript expression server-side.**

Narzędzia skryptowe są domyślnie wyłączone ze względów bezpieczeństwa. Jeśli serwer ich nie włączył, opcja **Script** jest wyszarzona i pojawia się ostrzeżenie. Żeby włączyć skrypty, administrator serwera dopisuje tę linię do pliku `.env` serwera i uruchamia aplikację ponownie:

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Jedyne pole to **Script Body** (treść skryptu). Skrypt może czytać `args`, czyli wartości przesłane przez AI, i musi zwrócić wynik instrukcją `return`. Dostępne są też `JSON`, `Math` i `Date`.

Przykład z życia. Utwórz narzędzie o nazwie `add_numbers` z dwoma wymaganymi parametrami liczbowymi o nazwach `x` i `y`. W polu **Script Body** wpisz to:

```
const result = args.x + args.y;
return { sum: result };
```

Kiedy AI wywoła `add_numbers` z `x` równym 2 i `y` równym 3, narzędzie zwraca sumę 5. Jeśli skrypt zgłosi błąd, AI dostaje wynik z błędem zamiast awarii. Zanim włączysz skrypty, przeczytaj sekcję Bezpieczeństwo skryptów poniżej.

## Dołączanie ukrytego kontekstu czatu

Narzędzia typu **Webhook** i **Script** mogą dostawać ukryty obiekt kontekstu. To dodatkowe dane czatu, których AI nie widzi jako danych wejściowych narzędzia. Włącz przełącznik **Include hidden chat context** (dołączenie ukrytego kontekstu czatu) w edytorze narzędzia. Domyślnie jest wyłączony.

Po włączeniu webhook albo skrypt dostaje obok argumentów wartość `context`. Może ona zawierać tryb czatu, nazwę aktywnej persony oraz nazwy postaci biorących udział w czacie. Mogą się w niej znaleźć także zapisane zmienne czatu, a w trybie Game Mode również stan gry. Dzięki temu narzędzie dopasowuje wynik bez przesyłania tych wszystkich danych przez samo AI.

## Włączanie narzędzi w czacie

Samo utworzenie narzędzia nie sprawia, że AI z niego korzysta. Trzeba jeszcze włączyć korzystanie z narzędzi w danym czacie.

1. Otwórz czat i kliknij ikonę koła zębatego, żeby wejść w **Chat Settings** (ustawienia czatu).
2. Rozwiń sekcję **Function Calling** – jej ikoną jest klucz.
3. Włącz przełącznik **Enable Tool Use** (zezwolenie na korzystanie z narzędzi). Jego opis brzmi **Allow AI to call functions (dice rolls, game state, etc.)**. W nowym czacie jest domyślnie wyłączony.

Kiedy przełącznik **Enable Tool Use** jest włączony, a niżej nie dodano żadnych narzędzi, czat może korzystać ze wszystkich globalnie włączonych narzędzi. To znaczy z narzędzi wbudowanych, takich jak rzuty kością i wyszukiwanie w lorebookach, oraz z każdego własnego narzędzia włączonego w sekcji **Functions**. Żeby ograniczyć czat do wybranego zestawu, dodaj konkretne narzędzia:

1. Kliknij przycisk **Add Functions** (dodanie funkcji). Otwiera się okno wyboru z polem wyszukiwania.
2. Zaznacz narzędzia, które mają być dostępne. Lista miesza narzędzia wbudowane z własnymi.
3. Kliknij przycisk **Add Selected**, żeby je dodać.

Po dodaniu choćby jednego narzędzia w tym czacie działają wyłącznie narzędzia z listy. W oknie wyboru jest też przycisk **New Custom Function**, który przenosi prosto do edytora narzędzia. Pole wyszukiwania w tym oknie dopasowuje tylko nazwy narzędzi, nie opisy.

## Przypinanie narzędzi do agenta

Narzędzie można też dać agentowi zamiast czatowi. Agent to półautonomiczny pomocnik – na przykład opiekun lorebooków albo dobierający muzykę – który działa w trakcie generowania.

1. Otwórz panel **Agents** i wejdź w agenta.
2. Rozwiń grupę **Tools / Function Calling** (narzędzia i wywoływanie funkcji).
3. Włącz narzędzia, z których ten agent ma korzystać.

Nawet przy skonfigurowanym agencie trzeba włączyć przełącznik **Enable Tool Use** w sekcji **Function Calling** czatu. Jedna uwaga o nazewnictwie. Tekst na dole edytora agenta każe włączyć "Enable Function Calling". Przełącznik, który faktycznie się klika, nosi nazwę **Enable Tool Use**. To ta sama kontrolka. Dokładniejszy opis agentów znajdziesz w przewodniku [Tworzenie własnych agentów](../agents/custom-agents.md).

## Bezpieczeństwo skryptów

Narzędzie typu **Script** uruchamia prawdziwy kod na serwerze, więc wymaga ostrożności. Aplikacja uruchamia każdy skrypt w piaskownicy. Piaskownica to odgrodzony obszar, który ogranicza możliwości kodu. Ograniczenia są takie:

- Brak dostępu do sieci. Skrypt nie odezwie się do internetu ani do żadnego adresu internetowego.
- Brak dostępu do plików. Skrypt nie odczyta ani nie zapisze plików na serwerze.
- Brak dostępu do zmiennych środowiskowych i sekretów serwera.
- Limit czasu. Zbyt długo działający skrypt zostaje zatrzymany. Domyślny limit to 60 sekund.

To chroni przed wypadkami i odcina dostęp do sieci oraz do plików. Nie jest to jednak pełna izolacja na poziomie systemu operacyjnego. Ktoś, kto może tworzyć narzędzia, wciąż napisze skrypt marnujący procesor albo pamięć serwera. Włączaj narzędzia skryptowe tylko na serwerach, którym ufasz. Zachowaj ostrożność przy imporcie narzędzi skryptowych napisanych przez inne osoby.

Zarządzanie narzędziami z innego urządzenia też jest chronione. Poza komputerem, na którym działa serwer, trzeba zapisać sekret administratora w **Settings** (Ustawienia), dalej **Advanced**, dalej **Admin Access**. Ten sekret musi być zgodny z ustawieniem serwera. Stronę serwera opisuje przewodnik [Konfiguracja serwera](../CONFIGURATION.md).

## Eksport i import

Narzędzia da się przenosić między instalacjami.

- Żeby wyeksportować jedno narzędzie, otwórz je i kliknij przycisk **Export function** (eksport funkcji). Zapisuje się plik `.json`.
- Żeby wyeksportować wszystkie narzędzia, kliknij przycisk **Export functions to ZIP** w sekcji **Functions**.
- Żeby zaimportować, kliknij przycisk **Import functions from ZIP or JSON** i wskaż plik `.json` albo `.zip`. Komunikat pokazuje, ile narzędzi udało się zaimportować.

Zaimportowane narzędzia typu **Webhook** i **Script** zapisują się zawsze wyłączone i z wyłączonym przełącznikiem **Include hidden chat context**, nawet jeśli plik prosi o którekolwiek z tych uprawnień. Po imporcie Marinara pokazuje typ wykonania, miejsce docelowe webhooka (jeśli dotyczy) oraz uprawnienia, o które prosił plik. Otwórz każde zaimportowane narzędzie typu Webhook lub Script, sprawdź je, a potem włącz tylko wtedy, gdy mu ufasz. Narzędzia typu **Static** zachowują stan włączenia zapisany w pliku importu.

Import pomija każde narzędzie, którego nazwa koliduje z istniejącym narzędziem albo z nazwą narzędzia wbudowanego. Pakiety agentów nie zawierają własnych narzędzi ani ich nie importują: zaufane funkcje eksportuj osobno, przejrzyj je w sekcji **Function Calls**, a po zaimportowaniu agenta przypnij je do niego ręcznie.

## Nazwy zastrzeżone

Nazwa własnego narzędzia nie może pokrywać się z nazwą narzędzia wbudowanego. Wbudowane nazwy to między innymi `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` i `update_about_me`. Przy próbie zapisania takiej nazwy pojawia się komunikat:

```
"your_name" is a reserved built-in tool name.
```

Dwa własne narzędzia również nie mogą mieć tej samej nazwy. Powtórzona nazwa daje komunikat, że narzędzie o takiej nazwie już istnieje.

## Rozwiązywanie problemów

AI nigdy nie wywołuje mojego narzędzia.

- Sprawdź, czy przełącznik **Enable Tool Use** jest włączony w sekcji **Function Calling** czatu.
- Jeśli do czatu dodano konkretne narzędzia, sprawdź, czy jest wśród nich to twoje.
- Sprawdź, czy przełącznik włącz/wyłącz przy narzędziu w sekcji **Functions** jest włączony.
- Doprecyzuj pole **Description** i opisy parametrów, żeby AI wiedziało, kiedy sięgnąć po narzędzie.
- Jeśli narzędzie pochodzi z importu, zepsuta konfiguracja parametrów może sprawić, że aplikacja je pomija. Zbuduj parametry ponownie ręcznie.

Opcja **Script** jest wyszarzona.

- Skrypty są na tym serwerze wyłączone. Poproś administratora o ustawienie `CUSTOM_TOOL_SCRIPT_ENABLED=true` i ponowne uruchomienie. Zajrzyj do przewodnika [Konfiguracja serwera](../CONFIGURATION.md).

Webhook zawodzi albo przekracza limit czasu.

- Sprawdź, czy adres zaczyna się od `https://` i czy jest osiągalny.
- Adres lokalny jest blokowany, dopóki administrator nie zezwoli na adresy lokalne. Zajrzyj do przewodnika [Konfiguracja serwera](../CONFIGURATION.md).
- Wolne usługi potrafią przekroczyć limit 60 sekund.

Nie mogę tworzyć ani edytować narzędzi z telefonu lub innego urządzenia.

- Zapisz zgodny sekret administratora w **Settings**, dalej **Advanced**, dalej **Admin Access**.

## Powiązane przewodniki

- [Tworzenie własnych agentów](../agents/custom-agents.md)
- [Integracja z Home Assistant](../integrations/home-assistant.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
