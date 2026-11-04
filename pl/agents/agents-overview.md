# Agenci: pomocnicy AI w czatach

Agenci to niewielcy pomocnicy AI, którzy działają wokół głównej odpowiedzi w czacie. Jeden śledzi godzinę i pogodę, inny dobiera wyraz twarzy postaci, a jeszcze inny rysuje obraz do ważnej chwili. Z tego przewodnika dowiesz się, jak instalować agentów, jak włączyć ich w czacie i jak sprawdzić, czy zadziałali.

## Czym są agenci

Agentów włącza się osobno w każdym czacie, a nie przy postaci. Dwa czaty z tą samą postacią mogą korzystać z różnych agentów.

Świeża instalacja nie zawiera opcjonalnych agentów. Instaluje się ich przez **Agent Organizer** (organizowanie agentów), czyli sklep z oficjalnymi pakietami instalowanymi jednym kliknięciem. Kod źródłowy i katalog są publicznie dostępne w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Instaluj przez **Agent Organizer**, żeby Marinara mogła sprawdzić zgodność, uprawnienia i sumy kontrolne plików. Co robi każdy agent, opisuje przewodnik [Agenci do pobrania: przegląd pakietów](built-in-agents.md). Jak zrobić własnego, wyjaśnia [Tworzenie własnych agentów](custom-agents.md).

## Dodawanie agenta do czatu

Zanim zaczniesz: najpierw zainstaluj agenta. Otwórz panel **Agents** (agenci, ikona Sparkles w zakładkach po prawej stronie), kliknij **Agent Organizer**, otwórz stronę agenta i kliknij **Get** (pobranie). Zobacz [Instalowanie i aktualizowanie agentów](#install-and-update-agents).

1. Otwórz czat.
2. Otwórz **Chat Settings** (ustawienia czatu) i znajdź sekcję **Agents**.
3. Włącz **Enable Agents** (włączenie agentów). To główny przełącznik: kiedy jest wyłączony, w tym czacie nie działa żaden agent.
4. Kliknij **Add Agent** (dodanie agenta), otwórz grupę, do której należy agent (na przykład **Writer Agents** (agenci piszący) albo **Misc Agents** (pozostali agenci)), i wybierz go.

Dodani agenci pojawiają się jako aktywni, każdy z małym przyciskiem usuwania. Agentów można dodawać i usuwać w każdej chwili.

> **Uwaga:** Każdy tryb czatu pokazuje tylko agentów, którzy w nim działają. W trybie Conversation zainstalowane gry pojawiają się na liście wyboru gier, a **Calls** (rozmowy głosowe) dodaje kontrolki do paska narzędzi. W trybie Game Mode wybierz agentów podczas tworzenia gry albo dodaj ich później.

Jeśli agent nie zadziałał, sprawdź, czy **Enable Agents** jest włączone, czy agent jest aktywny w tym czacie i czy jego tryb pasuje do czatu.

### Więcej opcji w sekcji Agents

Te opcje są w tej samej sekcji **Agents**.

- **Agent Menus** (menu agentów; tylko Roleplay): kliknij nazwę agenta, aby przejść do jego ustawień.
- **Trackers Control** (sterowanie trackerami; tylko Roleplay): zwinięta karta z opisanymi niżej opcjami trackerów.
- **Agent Suite**: otwiera podgląd, w którym można przeczytać i zmienić to, co agenci zapisali dla tego czatu.
- **Review Agent Outputs** (przeglądanie wyników agentów): sprawia, że zmiany w lorebooku, podsumowaniu i karcie postaci czekają na twoje zatwierdzenie. W trybie Roleplay ta opcja jest w karcie **Trackers Control**. Zobacz [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md).

Opcje w karcie **Trackers Control**:

- **Attach chat summaries** (dołączanie podsumowań czatu): domyślnie wyłączone. Dołącza zapisane podsumowania czatu do zapytań agentów, także przy ponowieniach. Nie usuwa podsumowań z głównej odpowiedzi ani nie zatrzymuje ich generowania. Agenci z dostępem do pełnego głównego promptu nadal mogą odczytać zawarte w nim podsumowania.
- **Attach Lorebooks to Trackers** (dołączanie lorebooków do trackerów): agenci trackerów dostają też wpisy lorebooków użyte przy głównej odpowiedzi. Opcja pojawia się, gdy czat ma już agenta trackera.
- **Individual tracker schedule** (harmonogram poszczególnych trackerów): sprawia, że tracker nie uruchamia się po każdej odpowiedzi. Uruchamiasz go wtedy ręcznie z paska HUD (nakładki ze stanem na ekranie w trybie Roleplay).

### Lorebook referencyjny dla jednego agenta

1. W **Chat Settings** otwórz **Agents**, a potem ustawienia agenta.
2. Włącz **Attach lorebook for the specific agent** (dołącz lorebook dla tego agenta). Domyślnie ta opcja jest wyłączona.
3. Wybierz książkę w polu **Reference lorebook** (lorebook referencyjny).

Wybór dotyczy tego agenta w tym czacie. Pasujące wpisy podlegają zwykłym regułom wyzwalania lorebooków i trafiają do tego agenta, także przy ręcznych ponowieniach. To ustawienie nie dodaje książki do głównej odpowiedzi ani do niezwiązanych agentów, ale agenci uruchamiani razem mogą też widzieć te same wpisy. Usunięte lub niedostępne książki nie dostarczają niczego.

## Kiedy działają agenci

Każdy agent działa w jednym punkcie wokół odpowiedzi, nazywanym jego **pipeline phase** (faza w potoku przetwarzania). Każdy wbudowany agent ma wartość domyślną. Można ją zmienić w edytorze agenta.

| Faza | Kiedy działa | Przykłady |
| --- | --- | --- |
| **Pre-Generation** | Przed odpowiedzią. Może dodać kontekst do promptu. | Wyszukiwanie wiedzy |
| **Parallel** | Równocześnie z odpowiedzią. Nie może jej zmienić. | Reakcje publiczności na żywo |
| **Post-Processing** | Po odpowiedzi. Może ją odczytać, a agenci przepisujący mogą ją zmienić. | Większość trackerów, czyszczenie tekstu, obrazy |

<a id="tell-whether-an-agent-ran"></a>

## Jak sprawdzić, czy agent zadziałał

- Agenci trackerów zapisują dane na pasku HUD i w panelach trackerów. Jeśli godzina, miejsce, nastrój albo statystyki się zmieniły, tracker zadziałał.
- Sekcja **Agent activity** (aktywność agentów) w **Chat Settings** wymienia krótkie notatki od agentów. Jej ikona kręci się, gdy agenci pracują, a gdy któryś zawiedzie, pokazuje kropkę. Zobacz [Agent activity](../roleplay/getting-started.md#agent-activity).
- Agenci **Prose Guardian** i **Continuity Checker** zmieniają tekst odpowiedzi. Oczyszczona albo poprawiona odpowiedź oznacza, że zadziałali.
- Pełny ślad daje przełącznik **Debug mode** (tryb diagnostyczny) w **Settings → Advanced → Message Tools** (ustawienia, zaawansowane, narzędzia wiadomości). Zapisuje on prompt i odpowiedź każdego agenta w konsoli serwera, a wpisy diagnostyczne agentów pojawiają się też w konsoli przeglądarki. Panel Cached prompt injections widać w zakładce **Injections** (wstawienia do promptu) w sekcji **Agent activity**.

## Pilnowanie kosztów

Każdy agent dokłada własne instrukcje, a często też własne wywołanie modelu. Marinara łączy agentów korzystających z tego samego połączenia w jedno wywołanie, o ile to możliwe.

Odczyt nad listą agentów szacuje dodatkowe tokeny i wywołania na turę. Stuknij ikonę pomocy obok niego, aby zobaczyć szczegóły. Gdy obciążenie jest duże, odczyt robi się bursztynowy i dostaje ikonę ostrzeżenia. Rzeczywisty koszt jest wyższy, bo z każdym wywołaniem idzie historia czatu i szczegóły postaci.

Jeśli widzisz ostrzeżenie, usuń niepotrzebnych agentów albo przenieś część na tańsze lub lokalne połączenie. Zapisane w połączeniu ustawienie **Reasoning Effort** (poziom rozumowania) dotyczy też korzystających z niego agentów. Zobacz [Parametry agentów](../prompts/generation-parameters.md#parameters-for-agents).

<a id="install-and-update-agents"></a>

## Instalowanie i aktualizowanie agentów

Otwórz panel **Agents** (ikona Sparkles w zakładkach po prawej stronie) i kliknij **Agent Organizer**. Działa on na komputerze i na telefonie.

- **Home** (strona główna) pokazuje wyróżnionych agentów i półkę dla każdej sekcji: **Apps** (aplikacje), **Chat games** (gry czatu), **Trackers** (trackery) i **Writing help** (pomoc w pisaniu).
- **Updates** (aktualizacje) wymienia zainstalowanych agentów, dla których jest nowsza wersja. **Installed** (zainstalowane) pokazuje wszystko, co masz, z wersją i rozmiarem.
- Wyszukiwanie i filtr trybu zawężają każdą listę.
- Wybierz agenta, żeby zobaczyć jego opis, rozmiar pliku do pobrania, uprawnienia, zgodność i **Version history** (historia wersji). Kliknij **Get**, aby go zainstalować. Menu **⋯** zawiera opcję **Uninstall** (odinstalowanie).
- Menu **⋯** obok tytułu zawiera opcje **Update all** (aktualizacja wszystkich), **Install all** (instalacja wszystkich), **Refresh catalog** (odświeżenie katalogu) i **Uninstall all** (odinstalowanie wszystkich).

Zainstalowani agenci trafiają do grup **Apps**, **Writer Agents**, **Tracker Agents** (agenci trackerów) i **Misc Agents**, a dodatkowo jest grupa **Custom Agents** (agenci własni) na agentów, których tworzysz. **Apps** to pakiety z własną zakładką Home, takie jak Noodle i Slurp. Używa się ich osobno, zamiast dodawać je do czatu.

Pakiet oznaczony **Rules** (zasady) nie jest agentem. Dodaje zestaw zasad trybu Game Mode, na przykład 5e (SRD 5.1), który wybiera się w **Rules** podczas tworzenia gry. Zobacz [Gra z zestawem zasad](../game/rulesets.md). Pakiet 5e jest wersją podglądową, więc katalog pokazuje go tylko w aplikacji Engine na gałęzi `staging`.

Odinstalowanie pakietu usuwa jego kod i ustawienia, ale zachowuje wiadomości i historię czatów. Usunięcie własnego agenta jest nieodwracalne.

### Aktualizowanie agentów

Gdy jest dostępna nowsza zgodna wersja zainstalowanego pakietu, otwiera się okno **Agent updates available** (dostępne aktualizacje agentów). Wymienia ono każdą aktualizację z jej wersją i informacją, czy wymaga restartu.

1. Odznacz pole przy każdej aktualizacji, którą chcesz pominąć. Na początku wszystkie są zaznaczone.
2. Przeczytaj **What's new** (co nowego), jeśli pakiet opublikował informacje o zmianach. **More** (więcej) pokazuje długą informację w całości. Kropka oznacza zmianę, którą zauważysz.
3. Kliknij **Update all** (albo **Update 2 of 3** (aktualizacja 2 z 3), gdy część pól odznaczono). Każdy wiersz pokazuje **Updated** (zaktualizowano) albo **Failed** (niepowodzenie). Wiersz nieudanej aktualizacji pokazuje przyczynę i przycisk **Retry** (ponów).
4. Jeśli aktualizacja wymaga restartu, kliknij **Restart now** (uruchom ponownie teraz) albo uruchom ponownie aplikację Marinara Engine później.

Kliknij **Not now** (nie teraz), żeby zachować swoje wersje. Marinara nie pyta ponownie o pominiętą wersję. Aktualizować można w każdej chwili przez **Agent Organizer**. Zainstalowane pakiety działają w obecnej wersji, nawet gdy katalog jest nieosiągalny. **See in Agent Organizer** (otwarcie w Agent Organizer) otwiera stronę agenta.

Aktualizacje dotyczą wyłącznie zainstalowanych pakietów. Pakiety znajdują się na serwerze Marinara, więc klienty w przeglądarce korzystają z tego, co jest zainstalowane na serwerze.

Przy aktualizacji z wersji aplikacji Engine, która miała te funkcje wbudowane, Marinara jeden raz pobiera odpowiednie pakiety i zachowuje wybór agentów w czatach, ustawienia i historię. Jeśli katalog jest nieosiągalny, próba powtarza się przy następnym starcie.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Awatary 2D i 3D](avatars.md)
- [Tworzenie własnych agentów](custom-agents.md)
- [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md)
- [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md)
