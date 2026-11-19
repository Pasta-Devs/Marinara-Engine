# Ocena możliwości integracji subskrypcji przez Antigravity CLI

To notatka badawcza dla programistów o [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), po raz pierwszy sprawdzona 2026-10-23, a ponownie 2026-11-19 z oficjalnymi wydaniami `agy` 1.5.11 i 1.5.12 dla systemu Windows. Aplikacja Marinara Engine **nie** obsługuje połączenia z subskrypcją Antigravity, a zgłoszenie nadal jest zamknięte jako nieplanowane. Wykluczenia własnego agenta powstrzymały sprawdzane procedury obsługi zdarzeń, ale podproces MCP wtyczki wykrywanej globalnie uruchamiał się w obu wydaniach. Izolacja wykonywania nadal nie jest potwierdzona.

## Potwierdzone oficjalne interfejsy

Oficjalne narzędzie CLI `agy` obsługuje logowanie przy użyciu zapisanych danych konta i generowanie tekstu bez interaktywnego interfejsu. Udokumentowany protokół obejmuje zdarzenia `init`, `step_update` i `result`, a strumieniowe dane wejściowe przyjmują postać wiadomości użytkownika w formacie JSON przekazywanych przez stdin. Podczas ponownej próby w systemie Windows polecenie `agy models` pokazało `gemini-4-neon-high`. Ograniczone żądania do tego modelu powiodły się po zalogowaniu użytkownika na istniejące konto Google AI Pro. Dostępność modeli konta trzeba odczytać z zainstalowanego CLI; przykład nie wystarcza. `--print-timeout 0` czeka na zakończenie, a `--disable-slash-commands` wyłącza rozwijanie poleceń w trybie print. Zobacz [tryb bez interaktywnego interfejsu](https://antigravity.google/docs/cli/headless/) i [opis opcji CLI](https://antigravity.google/docs/cli/reference/).

Logowanie do konta w CLI korzysta z magazynu poświadczeń systemu operacyjnego. Oddzielny tryb klucza API Gemini wymaga `modelProvider: "gemini"` i `GEMINI_API_KEY`; adapter subskrypcji nie może po cichu wybierać tej metody rozliczeń. Udokumentowane sposoby programowego uwierzytelniania w SDK dla języka Python to klucze API Gemini, poświadczenia Vertex/Google Cloud i modele lokalne. Nie potwierdzają one możliwości uwierzytelniania subskrypcji konsumenckiej w rozwiązaniu zastępującym CLI przez SDK. Zobacz [uwierzytelnianie](https://antigravity.google/docs/install/#programmatic-authentication) i [omówienie SDK](https://antigravity.google/docs/sdk/overview/).

## Aktualny wynik próby izolacji wykonywania

Oficjalne definicje własnych agentów udostępniają ustawienia narzędzi, MCP i dostosowań. Według przewodnika po wtyczkach `inheritCustomizations` steruje dziedziczeniem umiejętności, reguł i procedur obsługi zdarzeń, a `inheritMcp` steruje dziedziczeniem serwerów MCP obszaru roboczego. Pierwsza zapowiedź `excludeDefaultComponents: true` zachowywała procedury po wywołaniu, więc sama flaga nie zapewnia izolacji. Poniższa konfiguracja wyłączyła procedury testowe w wersji 1.5.11, ale część podprocesów MCP nadal się uruchamiała. Zobacz [Własne podagenty](https://antigravity.google/docs/subagents/), [Tworzenie wtyczek](https://antigravity.google/docs/build-plugins/) i [historia zmian CLI](https://antigravity.google/docs/changelog).

Procedury obsługi zdarzeń mogą pochodzić z obszaru roboczego, globalnego pliku `~/.gemini/config/hooks.json` i zainstalowanych wtyczek. Obejmują zdarzenia sesji, wywołania modelu, użycia narzędzi i zatrzymania. Aktualna dokumentacja ustawień oraz [oficjalny schemat ustawień](https://antigravity.google/schemas/v1/settings.json) wyraźnie stwierdzają, że wpis `hooks` w pliku `settings.json` nie jest wczytywany. Zapisanie tam pustego wpisu nie wyłączyłoby rzeczywistych źródeł tych procedur. Zobacz [procedury obsługi zdarzeń](https://antigravity.google/docs/hooks) i [ustawienia CLI](https://antigravity.google/docs/settings?tab=cli).

Pomoc zainstalowanej wersji 1.5.11 opisuje `--settings` jako nadpisania kluczy `settings.json` obowiązujące tylko w sesji, podawane wprost lub przez plik. Pozwala to tymczasowo ustawić zaufanie do obszaru roboczego i uprawnienia bez zmiany trwałych preferencji. To jeszcze nie osobny profil konfiguracji: `--settings '{"hooks":{}}'` kończy się kodem 1 i komunikatem `unknown setting "hooks"`. Pomoc nie wymienia opcji wyłączenia procedur ani odizolowanego profilu z zachowaniem uwierzytelnienia.

Według aktualnej dokumentacji ustawień polecenie `/hooks` pozwala dodawać, edytować i przełączać procedury obsługi zdarzeń, a zmiany zapisuje w plikach konfiguracji. W ponownej próbie `-p "/hooks" --output-format json` bez interfejsu zwróciło ustrukturyzowaną listę. Ani lista, ani zapisane przełączniki nie gwarantują wykluczenia wykonywalnych dostosowań przy późniejszym wywołaniu. Zmiana katalogu, pusta lista `tools`, polecenie unikania narzędzi i przerwanie po uruchomieniu nie wystarczą jako dowód izolacji.

Raporty o integracjach zewnętrznych są wskazówkami do dalszego badania. Twierdzenia o nieaktywnych narzędziach, logach rozpoznawania agentów lub dziedziczeniu dostosowań trzeba odtworzyć na oficjalnym wydaniu, zanim staną się gwarancjami, na których polega silnik.

## Próba wydania z października 2026

Sprawdzono [oficjalny instalator](https://antigravity.google/cli/install.sh) i jego [manifest wydania dla Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json), nie uruchamiając instalatora. Manifest wskazał [wersjonowane archiwum `agy` 1.4.6 dla Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) z następującą sumą SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

Suma kontrolna archiwum była zgodna. Plik binarny wypakowano do katalogu tymczasowego należącego do tego zadania. Uruchomiono wyłącznie `--version` i `--help`, w piaskownicy macOS blokującej dostęp do sieci, odczyt/zapis katalogu domowego i dostęp do usługi pęku kluczy. Oba polecenia zakończyły się powodzeniem. Pomoc nie wymieniała opcji wyłączania procedur obsługi zdarzeń, izolowania profilu ani wskazywania katalogu konfiguracji.

Ta próba **nie** instalowała ani nie uwierzytelniała CLI, nie sprawdzała poświadczeń, nie wywoływała modelu, nie wyliczała modeli zalogowanego konta ani nie testowała wykonywania procedur obsługi zdarzeń. Potwierdza publiczną listę opcji; nie dowodzi, że izolacja jest niemożliwa, ani nie potwierdza generowania w ramach subskrypcji.
## Próba w systemie Windows z listopada 2026

Zainstalowane `agy` zgłaszało wersję 1.5.11. Suma SHA-512 była zgodna z sumą zaobserwowaną w [oficjalnym manifeście Windows AMD64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json), ale nie zachowano pierwotnej odpowiedzi manifestu. Aktualizowany na bieżąco manifest przeszedł później do wersji 1.5.12. Podczas przeglądu niezależnie pobrano [wersjonowany plik wykonywalny 1.5.11 dla systemu Windows](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) i obliczono jego sumę bez uruchamiania. Plik o wielkości 234 827 416 bajtów miał tę samą sumę SHA-512 co zainstalowany plik:

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Próby przeprowadzono w tymczasowym obszarze roboczym należącym do zadania z metadanymi `.agents/agents/me-isolation-probe.md`:

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

Oficjalna [dokumentacja metadanych własnych agentów](https://antigravity.google/docs/subagents/) opisuje `mainAgent`, `subagent`, `tools` i `commandExecutionPolicy`. Ustawienia dziedziczenia i wykluczeń opisują powyższy przewodnik po wtyczkach i historia zmian. Konfigurację sprawdzano łącznie. Poprawny wybór agenta nie dowodzi, że każde pole egzekwowano niezależnie.

Podczas generowania użyto `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>` i niezależnego limitu 55 sekund dla podprocesu. Ustawienia JSON przekazane wprost nadawały zaufanie tymczasowemu obszarowi roboczemu, wybierały domyślny tryb agenta, wyłączały własne skrypty stanu i tytułu oraz wybierały tryb uprawnień z opisu poniżej. Nie pominięto żadnych uprawnień.

Obiekt ustawień miał poniższą postać. Wartość `<temporary-workspace>` zastąpiono katalogiem próby, a `toolPermission` ustawiono na tryb z danego wiersza:

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

Z otoczenia podprocesu prób usunięto zmienne przełączające klucz API i ADC. Nie wydobywano ani nie kopiowano poświadczeń.

Testowe procedury obsługi zdarzeń dopisywały nazwy do oddzielnych plików znaczników dla `SessionStart`, `PreInvocation`, `PostInvocation` i `Stop`. Lokalne atrapy MCP w Pythonie zapisywały znacznik startu przed odpowiedzią na `initialize` i `tools/list` przez stdio. Lokalna konfiguracja MCP korzystała z `.agents/mcp_config.json`. Wtyczki zawierały `plugin.json`, `hooks.json` i `mcp_config.json`. Wykrywano je przez manifest `entries` w `.agents/plugins.json` albo `~/.gemini/config/plugins.json`, zgodnie z [opisem wykrywania dostosowań](https://antigravity.google/docs/customization-discovery/). Próby kontrolne procedur obsługi zdarzeń, MCP i odczytu plików pomijały `--agent`, zachowując te same atrapy i ustawienia sesji. Próba nieistniejącej nazwy porównywała poprawne `--agent me-isolation-probe` z nierozpoznawaną nazwą.

| Próba | Próba kontrolna | Własny agent |
| --- | --- | --- |
| Procedury obszaru roboczego, globalne i z wtyczki wykrytej w obszarze roboczym (uprawnienia `strict`) | Wszystkie cztery zdarzenia zapisały znaczniki dla każdego źródła | Brak znaczników |
| MCP obszaru roboczego i wtyczki wykrytej w obszarze roboczym (uprawnienia `strict`) | Oba podprocesy zapisały znaczniki uruchomienia | Nie pojawił się żaden znacznik uruchomienia |
| Procedury wtyczki wykrytej globalnie (uprawnienia `request-review`) | Wszystkie cztery zdarzenia zapisały znaczniki | Brak znaczników |
| MCP wtyczki wykrytej globalnie (uprawnienia `request-review`) | Podproces zapisał znacznik uruchomienia | Podproces nadal zapisał znacznik uruchomienia |
| Jawne żądanie `view_file` z nieprzewidywalną wartością testową (uprawnienia `request-review`) | Zwróciło wartość testową | Zwróciło `FILE_UNAVAILABLE` bez wartości testowej |
| Nieistniejąca nazwa `--agent` (uprawnienia `strict`) | `--agent me-isolation-probe` zakończył generowanie | Nieprawidłowa nazwa zakończyła się kodem 1 z błędem, zerowym zużyciem i bez znaczników zdarzeń ani MCP |

Wynik dla globalnie wykrywanego MCP wtyczki powtórzono dwukrotnie z uprawnieniami `strict` i nową ścieżką znacznika dla każdego wywołania. Oba żądania własnego agenta zakończyły się kodem 0, a oba podprocesy zapisały znaczniki. Opóźniony zapis z wcześniejszej próby kontrolnej nie mógł trafić pod nowe ścieżki. Jest to nadal zaobserwowana przeszkoda w izolacji wykonywania, mimo że odpowiedź nie użyła żadnego narzędzia MCP.

Prompt odczytu pliku miał postać `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`, z podstawioną bezwzględną ścieżką tymczasowego pliku testowego. Treść Markdown własnego agenta nakazywała odpowiedzieć `FILE_UNAVAILABLE`, jeśli pliku nie da się odczytać.

Gdy oficjalny manifest zaktualizował się podczas badania, pobrano [plik wykonywalny wersji 1.5.12 dla systemu Windows](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) do katalogu próby należącego do zadania, bez zastępowania zainstalowanego CLI. Sumę SHA-512 zweryfikowano na podstawie zachowanej odpowiedzi manifestu:

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

Próbę kontrolną i próbę własnego agenta dotyczącą globalnie wykrywanej wtyczki i odczytu pliku powtórzono w 1.5.12 z tym samym zalogowanym kontem i uprawnieniami `request-review`. Próba kontrolna wykonała wszystkie procedury wtyczki, uruchomiła podproces MCP i zwróciła wartość testową. Własny agent zwrócił `FILE_UNAVAILABLE` i powstrzymał procedury, ale uruchomił podproces MCP. Oba żądania generowania zakończyły się kodem 0. Pozostałe wiersze tabeli sprawdzono tylko w wersji 1.5.11.

W strumieniu `init.agent` wskazało wybranego własnego agenta, a osobny prompt w wersji 1.5.11 zwrócił znacznik zdefiniowany wyłącznie w treści Markdown tego agenta. Jednak `init.tools` wymieniło te same wbudowane narzędzia w próbie kontrolnej i u własnego agenta, w tym `run_command` i `view_file`. Ta lista nie przesądza o faktycznym dostępie. Próba odczytu pliku pokazuje zachowanie jednego narzędzia. Pozostałe wymagają osobnej kwalifikacji.

Globalne pliki testowe tworzono wyłącznie pod wcześniej nieistniejącymi ścieżkami procedur i manifestu. Użyto wyłącznego tworzenia i sprawdzano ich treść przed usunięciem. Oba tymczasowe pliki globalne usunięto. Sumy trwałych ustawień CLI pozostały zgodne ze stanem sprzed próby. CLI zachowało zwykły stan rozmów. Nie zastąpiono istniejącej konfiguracji globalnej.

W próbach nie sprawdzano treści poświadczeń. Uwierzytelnianie pozostało w oficjalnym narzędziu CLI.

Wyniki na działającym systemie Windows potwierdzają generowanie z uwierzytelnieniem subskrypcji i zawężają obawy dotyczące procedur obsługi zdarzeń. Nadal nie kwalifikują adaptera: podproces MCP wtyczki wykrywanej globalnie wciąż startuje. Nie sprawdzono samodzielnych globalnych serwerów MCP, dziedziczonych umiejętności, reguł i podagentów, pełnego zestawu narzędzi wykonawczych, anulowania, długich okresów ciszy ani działania w systemach Linux lub macOS. Nowsze poprawki zasad wtyczek i izolacji w historii zmian CLI nie dowodzą, że zwykłe żądanie z subskrypcji konsumenckiej wyklucza wszystkie wykonywalne dostosowania.

## Wymagane dowody przed udostępnieniem adaptera

1. Ustal wspierany sposób wykluczenia globalnych i lokalnych dla obszaru roboczego procedur obsługi zdarzeń, wtyczek, umiejętności, reguł, podagentów, serwerów MCP i narzędzi wykonujących działania, zanim jakiekolwiek żądanie będzie mogło je uruchomić. Zwykłe logowanie do konta pozostaw w oficjalnym CLI; nie wyodrębniaj ani nie kopiuj tokenów.
2. Sprawdź ten mechanizm z rzeczywistym oficjalnym CLI i kontrolowanymi lokalnymi atrapami modeli. Skonfiguruj obserwowalne znaczniki testowe w globalnych i lokalnych procedurach obsługi zdarzeń oraz we wtyczkach/MCP, a także reguły i żądania użycia narzędzi. Sprawdź zarówno przebieg odizolowany, jak i kontrole negatywne potwierdzające, że bez izolacji można zaobserwować znaczniki.
3. Udowodnij przed wykonaniem, że wybrany własny agent został poprawnie rozpoznany. Odrzucaj niewspierane wersje, nierozpoznane nazwy agentów, nieznane formaty list i niejednoznaczne wyniki sprawdzania izolacji; nie polegaj na wewnętrznej treści logów ani na pozornie pustej liście narzędzi przy uruchomieniu.
4. Dodaj limity wejścia/wyjścia podprocesu, prywatne pliki tymczasowe i ich sprzątanie, anulowanie, obsługę niezerowych kodów wyjścia i błędów wyniku oraz testy limitów czasu uwzględniających aktywność, w tym długie rozumowanie bez widocznego tekstu. Pobieraj modele właściwe dla konta przez oficjalne polecenie i zachowuj wybrany model oraz wspierany poziom wysiłku rozumowania.
5. Wykorzystaj istniejące kontrakty połączeń/dostawców. Opcje SDK usługi Claude, takie jak `settingSources: []`, są specyficzne dla dostawcy i nie można przenosić ich jako opcji do `agy`. Jasno wskaż braki walidacji rzeczywistego uwierzytelniania, rozliczeń subskrypcji i testów na fizycznych platformach.

Wyniki dla wersji 1.5.11 i 1.5.12 w systemie Windows potwierdzają część tych warunków, ale nadal można odtworzyć niepożądane uruchomienie podprocesu. Zgłoszenie #8143 pozostaje zamknięte jako nieplanowane. Ponowna próba go nie otwiera ani nie zezwala na prace w środowisku wykonawczym. Dodanie wpisu dostawcy wymaga decyzji opiekuna i zakończenia kwalifikacji.
