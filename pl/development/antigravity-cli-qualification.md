# Ocena możliwości integracji subskrypcji przez Antigravity CLI

To notatka badawcza dla programistów dotycząca [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), zweryfikowana 2026-10-23. Aplikacja Marinara Engine **nie** obsługuje połączenia z subskrypcją Antigravity. Nadal brakuje wspieranego i możliwego do sprawdzenia sposobu zapobiegania wykonywaniu narzędzi CLI oraz globalnych dostosowań, w tym procedur obsługi zdarzeń cyklu życia, podczas żądania generowania tekstu przez silnik.

## Potwierdzone oficjalne interfejsy

Oficjalne narzędzie CLI `agy` obsługuje logowanie przy użyciu zapisanych danych konta i generowanie tekstu bez interaktywnego interfejsu. Udokumentowany protokół obejmuje zdarzenia `init`, `step_update` i `result`, a strumieniowe dane wejściowe przyjmują postać wiadomości użytkownika w formacie JSON przekazywanych przez stdin. Polecenie `agy models` wylicza dostępne modele, w tym udokumentowane przykłady `gemini-4-argon-high` i `gemini-4-argon-medium`. Dostępność modeli dla danego konta trzeba odczytać z zainstalowanego CLI, zamiast wnioskować na podstawie przykładów. Opcja `--print-timeout 0` czeka na zakończenie, a `--disable-slash-commands` wyłącza rozwijanie poleceń w trybie print. Zobacz [tryb bez interaktywnego interfejsu](https://www.antigravity.google/docs/cli/headless/) i [opis opcji CLI](https://www.antigravity.google/docs/cli/reference/).

Logowanie do konta w CLI korzysta z magazynu poświadczeń systemu operacyjnego. Oddzielny tryb klucza API Gemini wymaga `modelProvider: "gemini"` i `GEMINI_API_KEY`; adapter subskrypcji nie może po cichu wybierać tej metody rozliczeń. Udokumentowane sposoby programowego uwierzytelniania w SDK dla języka Python to klucze API Gemini, poświadczenia Vertex/Google Cloud i modele lokalne. Nie potwierdzają one możliwości uwierzytelniania subskrypcji konsumenckiej w rozwiązaniu zastępującym CLI przez SDK. Zobacz [uwierzytelnianie](https://www.antigravity.google/docs/install/#programmatic-authentication) i [omówienie SDK](https://www.antigravity.google/docs/sdk/overview/).

## Brak gwarancji izolacji wykonywania

Oficjalne definicje własnych agentów udostępniają ustawienia narzędzi, MCP i dostosowań. Historia zmian opisuje także `inheritCustomizations`, `inheritMcp` i `excludeDefaultComponents`. Jednak zapowiedź `excludeDefaultComponents: true` wyraźnie zachowuje procedury uruchamiane po wywołaniu modelu. Sama ta opcja nie dowodzi więc, że żądanie generowania tekstu wyklucza wszystkie wykonywalne procedury obsługi zdarzeń. Zobacz [własnych podagentów](https://www.antigravity.google/docs/subagents/) i [historię zmian CLI](https://www.antigravity.google/docs/changelog).

Procedury obsługi zdarzeń mogą pochodzić z obszaru roboczego, globalnego pliku `~/.gemini/config/hooks.json` i zainstalowanych wtyczek. Obejmują zdarzenia sesji, wywołania modelu, użycia narzędzi i zatrzymania. Aktualna dokumentacja ustawień oraz [oficjalny schemat ustawień](https://antigravity.google/schemas/v1/settings.json) wyraźnie stwierdzają, że wpis `hooks` w pliku `settings.json` nie jest wczytywany. Zapisanie tam pustego wpisu nie wyłączyłoby rzeczywistych źródeł tych procedur. Zobacz [procedury obsługi zdarzeń](https://www.antigravity.google/docs/hooks) i [ustawienia CLI](https://www.antigravity.google/docs/settings?tab=cli).

Udokumentowane opcje i ustawienia CLI nie udostępniają wyłączania tych procedur dla pojedynczego żądania ani odizolowanego katalogu konfiguracji/profilu zachowującego uwierzytelnienie konta. Lista `/hooks`, dostępna tylko do odczytu, dostarcza przydatnych informacji, ale jej dokumentacja nie gwarantuje, że późniejsze wywołanie modelu użyje niezmiennej konfiguracji bez takich procedur. Zmiana katalogu, pusta lista `tools`, instrukcja unikania narzędzi ani przerwanie po uruchomieniu nie wystarczają jako dowód izolacji wykonywania.

Raporty o integracjach zewnętrznych są wskazówkami do dalszego badania. Twierdzenia o nieaktywnych narzędziach, logach rozpoznawania agentów lub dziedziczeniu dostosowań trzeba odtworzyć na oficjalnym wydaniu, zanim staną się gwarancjami, na których polega silnik.

## Lokalna próba wydania

Sprawdzono [oficjalny instalator](https://antigravity.google/cli/install.sh) i jego [manifest wydania dla Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json), nie uruchamiając instalatora. Manifest wskazał [wersjonowane archiwum `agy` 1.4.6 dla Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) z następującą sumą SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

Suma kontrolna archiwum była zgodna. Plik binarny wypakowano do katalogu tymczasowego należącego do tego zadania. Uruchomiono wyłącznie `--version` i `--help`, w piaskownicy macOS blokującej dostęp do sieci, odczyt/zapis katalogu domowego i dostęp do usługi pęku kluczy. Oba polecenia zakończyły się powodzeniem. Pomoc nie wymieniała opcji wyłączania procedur obsługi zdarzeń, izolowania profilu ani wskazywania katalogu konfiguracji.

Ta próba **nie** instalowała ani nie uwierzytelniała CLI, nie sprawdzała poświadczeń, nie wywoływała modelu, nie wyliczała modeli zalogowanego konta ani nie testowała wykonywania procedur obsługi zdarzeń. Potwierdza publiczną listę opcji; nie dowodzi, że izolacja jest niemożliwa, ani nie potwierdza generowania w ramach subskrypcji.

## Wymagane dowody przed udostępnieniem adaptera

1. Ustal wspierany sposób wykluczenia globalnych i lokalnych dla obszaru roboczego procedur obsługi zdarzeń, wtyczek, umiejętności, reguł, podagentów, serwerów MCP i narzędzi wykonujących działania, zanim jakiekolwiek żądanie będzie mogło je uruchomić. Zwykłe logowanie do konta pozostaw w oficjalnym CLI; nie wyodrębniaj ani nie kopiuj tokenów.
2. Sprawdź ten mechanizm z rzeczywistym oficjalnym CLI i kontrolowanymi lokalnymi atrapami modeli. Skonfiguruj obserwowalne znaczniki testowe w globalnych i lokalnych procedurach obsługi zdarzeń oraz we wtyczkach/MCP, a także reguły i żądania użycia narzędzi. Sprawdź zarówno przebieg odizolowany, jak i kontrole negatywne potwierdzające, że bez izolacji można zaobserwować znaczniki.
3. Udowodnij przed wykonaniem, że wybrany własny agent został poprawnie rozpoznany. Odrzucaj niewspierane wersje, nierozpoznane nazwy agentów, nieznane formaty list i niejednoznaczne wyniki sprawdzania izolacji; nie polegaj na wewnętrznej treści logów ani na pozornie pustej liście narzędzi przy uruchomieniu.
4. Dodaj limity wejścia/wyjścia podprocesu, prywatne pliki tymczasowe i ich sprzątanie, anulowanie, obsługę niezerowych kodów wyjścia i błędów wyniku oraz testy limitów czasu uwzględniających aktywność, w tym długie rozumowanie bez widocznego tekstu. Pobieraj modele właściwe dla konta przez oficjalne polecenie i zachowuj wybrany model oraz wspierany poziom wysiłku rozumowania.
5. Wykorzystaj istniejące kontrakty połączeń/dostawców. Opcje SDK usługi Claude, takie jak `settingSources: []`, są specyficzne dla dostawcy i nie można przenosić ich jako opcji do `agy`. Jasno wskaż braki walidacji rzeczywistego uwierzytelniania, rozliczeń subskrypcji i testów na fizycznych platformach.

Dopóki granica wykonywania nie zostanie potwierdzona, #8143 pozostaje otwarte i nie należy dodawać dostawcy do środowiska wykonawczego.
