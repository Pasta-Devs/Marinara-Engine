# Agenci: pomocnicy AI w czatach

Z tego przewodnika dowiesz się, czym są agenci w aplikacji Marinara Engine, jak ich pobrać, kiedy działają i jak włączyć ich w czacie. Opisuje panel **Agents** (Agenci), oficjalny katalog, ustawienia pojedynczego czatu oraz sposoby na sprawdzenie, czy agent zadziałał. Pełny katalog agentów od twórców aplikacji znajdziesz w powiązanych przewodnikach na końcu strony.

## Czym są agenci

Agenci to niewielcy pomocnicy AI, którzy uruchamiają się automatycznie wokół głównej odpowiedzi w czacie. Wykonują wąskie zadania, kiedy piszesz z postacią. Jeden agent śledzi na przykład godzinę i pogodę albo dobiera wyraz twarzy postaci. Inny przepisuje odpowiedź tak, by usunąć powtórzone słowa. Jeszcze inne generują obraz do ważnej chwili.

Agentów włącza się osobno w każdym czacie, a nie przy postaci. Na karcie postaci nie ma żadnego przełącznika agentów. Dwa czaty z tą samą postacią mogą korzystać z zupełnie różnych agentów. Wybór agentów odbywa się w ustawieniach danego czatu.

Świeża instalacja aplikacji Marinara Engine nie zawiera opcjonalnych agentów. Dzięki temu podstawowa aplikacja i instalacja w środowisku Termux zajmują mniej miejsca. Ekran **Download Agents** (pobieranie agentów) dzieli oficjalne pakiety instalowane jednym kliknięciem na grupy **Apps**, **Writer Agents**, **Tracker Agents** i **Misc Agents**. W katalogu znajdziesz między innymi Long-Term Memory, World Maps, Calls, Inventory Tracker oraz wszystkie sześć gier trybu Conversation. Kod źródłowy, manifesty, pliki do pobrania i katalog na poziomie repozytorium są publicznie dostępne w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Opis każdego agenta z osobna znajdziesz w przewodniku [Agenci do pobrania: przegląd pakietów](built-in-agents.md). Jak zrobić własnego, wyjaśnia [Tworzenie własnych agentów](custom-agents.md).

## Trzy fazy

Każdy agent działa w jednym z trzech punktów wokół odpowiedzi. Ten punkt to **pipeline phase** (faza w potoku przetwarzania) danego agenta. Ustawia się ją w edytorze agenta, a każdy wbudowany agent ma już rozsądną wartość domyślną.

- **Pre-Generation**: działa, zanim AI napisze odpowiedź. Może najpierw dodać przydatny kontekst do promptu, czyli tekstu, który Marinara wysyła do AI. Tutaj działają agenci wyszukujący wiedzę.
- **Parallel**: działa równocześnie z odpowiedzią. Nie czeka na nią i nie może jej zmienić. Tutaj działa agent pokazujący reakcje publiczności na żywo.
- **Post-Processing**: działa po zakończeniu odpowiedzi. Może ją odczytać, a w przypadku agentów przepisujących także zmienić. Tutaj działa większość trackerów, czyli agentów śledzących stan, agent czyszczący tekst oraz agent od obrazów.

## Panel **Agents**

Panel **Agents** otwiera się z zakładek panelu po prawej stronie (ikona Sparkles). Tu przeglądasz, tworzysz i porządkujesz agentów. To biblioteka agentów. Nie jest to przełącznik włączający agentów w pojedynczym czacie.

Kliknij przycisk **Download Agents** u góry, aby otworzyć pełnoekranowy oficjalny katalog. Działa on na komputerze i na telefonie. Po wybraniu pozycji zobaczysz jej opis, obsługiwany typ funkcji, rozmiar pliku do pobrania, uprawnienia, zgodność z wersjami oraz dokumentację. Kliknij przycisk **Install**, aby ją dodać. Ten sam ekran pozwala od razu zaktualizować pakiet ręcznie, a przycisk **Uninstall** odinstalowuje już posiadane pakiety.

Katalog w aplikacji opiera się na publicznym [repozytorium Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Można tam obejrzeć każdy pakiet i plik, ale zwykli użytkownicy powinni instalować przez przycisk **Download Agents**, bo wtedy Marinara sprawdza zgodność, uprawnienia, sumy kontrolne, zawartość archiwum i wymagania dotyczące restartu.

W katalogu znajdziesz agentów czatu od twórców aplikacji, World Maps, rozmowy audio i wideo w trybie Conversation oraz wszystkie opcjonalne gry trybu Conversation. Zainstalowani agenci trafiają do grup **Apps**, **Writer Agents**, **Tracker Agents** i **Misc Agents**, a dodatkowo jest sekcja **Custom Agents** na agentów własnych. **Apps** to pakiety z własną kartą Home, takie jak Noodle i Slurp, z których korzystasz samodzielnie, zamiast dodawać je do czatu. Odinstalowanie pakietu z katalogu usuwa jego kod i ustawienia z aplikacji, ale zachowuje wiadomości i historię czatów. Usunięcie własnego agenta jest nieodwracalne.

Pakiet oznaczony **Rules** (zasady) dodaje zestaw zasad Game Mode, np. 5e (SRD 5.1), a nie agenta. Wybiera się go podczas tworzenia nowej gry w **Rules**; zobacz [Wybór zasad](../game/getting-started.md#choosing-rules). Nie ma przełącznika włączania w czacie. Pakiet 5e jest wersją podglądową, więc na razie katalog pokazuje go tylko w aplikacji Engine na gałęzi `staging`.

Przy aktualizacji z wersji, która miała te funkcje wbudowane, Marinara pobiera odpowiednie pakiety jeden raz i zachowuje dotychczasowy wybór agentów w czatach, ich ustawienia, zapisane dane działania oraz historię. Jeśli podczas takiej migracji katalog jest nieosiągalny, próba powtarza się przy następnym starcie i nic nie ginie.

<a id="updating-packages"></a>

### Aktualizowanie pakietów

Marinara pyta, zanim zaktualizuje pakiet. Gdy jest dostępna nowsza zgodna wersja zainstalowanego pakietu, pojawia się okno **Agent updates available** (dostępne aktualizacje agentów). Wymienia każdą aktualizację z jej nową wersją i informacją, czy wymaga restartu. Jeśli pakiet publikuje informacje o zmianach, pokazuje je sekcja **What changed** (co się zmieniło). Kropka oznacza zmianę, którą zauważysz; aktualizacje bez kropki to rutynowe poprawki.

- Kliknij przycisk **Update all** (aktualizacja wszystkich), żeby zainstalować wszystkie wymienione aktualizacje. Gdy pojawi się prośba o restart, uruchom ponownie aplikację Marinara Engine.
- Kliknij przycisk **Not now** (nie teraz), żeby zachować obecne wersje. Marinara nie pyta ponownie o pominiętą wersję.

Każdy pakiet da się też zaktualizować później przez **Download Agents**. Zainstalowane pakiety działają w obecnej wersji, dopóki ich nie zaktualizujesz, nawet gdy katalog jest nieosiągalny.

Aktualizacje dotyczą wyłącznie już zainstalowanych pakietów. Instalacje na komputerze, w kontenerze Docker oraz w systemie Android i w środowisku Termux trzymają pakiety na swoim lokalnym serwerze. Klienty na iOS, iPadOS i w innych przeglądarkach korzystają z pakietów zainstalowanych na serwerze Marinara, z którym się łączą.

## Włączanie agentów w czacie

Agentów włącza się w każdym czacie z osobna, w **Chat Settings** (ustawienia czatu).

1. Otwórz wybrany czat.
2. Otwórz **Chat Settings**.
3. Znajdź sekcję **Agents**.
4. Włącz przełącznik **Enable Agents** (włączenie agentów). To główny wyłącznik. Kiedy jest wyłączony, w tym czacie nie działa żaden agent.
5. Dodaj wybranych agentów z list pod przełącznikiem albo usuń tych, których nie chcesz.

Dodani agenci powinni pojawić się na liście jako aktywni, każdy z małym przyciskiem usuwania.

W sekcji **Agents** jest jeszcze kilka opcji:

- **Agent Menus** (menu agentów; tylko czaty Roleplay): znajduje się tuż pod przełącznikiem **Enable Agents**. Kliknij nazwę agenta, aby przejść do jego ustawień.
- **Trackers Control** (sterowanie trackerami; tylko czaty Roleplay): karta, która domyślnie jest zwinięta. Kliknij ją, aby rozwinąć te ustawienia:
  - **Attach chat summaries** (dołączanie podsumowań czatu): domyślnie wyłączone, także w istniejących czatach bez zapisanego wyboru. Włącz tę opcję, aby dołączać zapisane podsumowania do zapytań agentów, również podczas przetwarzania po odpowiedzi i ręcznych ponowień. Nie usuwa to podsumowań z kontekstu głównej odpowiedzi ani nie zatrzymuje ich generowania. Agenci z przyznanym dostępem do pełnego głównego promptu nadal mogą odczytać zawarte w nim podsumowania.
  - **Attach Lorebooks to Trackers** (dołączanie lorebooków do trackerów): po włączeniu agenci trackerów dostają też wpisy lorebooków użyte przy generowaniu głównej odpowiedzi. Ta opcja pojawia się, gdy do czatu dodano już któregoś z agentów trackerów.
  - **Review Agent Outputs** (przeglądanie wyników agentów): opis znajdziesz w osobnym punkcie pod tą listą.
  - **Individual tracker schedule** (harmonogram poszczególnych trackerów): włącz tu tracker, aby nie uruchamiał się po każdej odpowiedzi. Uruchamiasz go wtedy ręcznie przyciskiem na pasku HUD. HUD to pasek informacji na górze czatu w trybie Roleplay. Ta opcja pojawia się, gdy do czatu dodano już któregoś z agentów trackerów.
- **Review Agent Outputs**: po włączeniu zmiany w lorebooku, podsumowaniu i karcie postaci czekają na twoje zatwierdzenie przed zapisem. Po wyłączeniu zmiany w lorebooku i podsumowaniu zapisują się same, ale zmiany w karcie postaci nadal wymagają wcześniejszego potwierdzenia. Zobacz [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md). W czatach Roleplay ta opcja znajduje się w karcie **Trackers Control**.
- **Agent Suite**: otwiera podgląd, w którym można przeczytać i zmienić wszystko, co agenci zapisali dla tego czatu.

### Ostrzeżenie o koszcie

Agenci kosztują dodatkowe tokeny, czyli małe kawałki tekstu, oraz dodatkowe wywołania modelu. Każdy agent dokłada własne instrukcje, a często też własne wywołanie modelu. Marinara łączy agentów korzystających z tego samego połączenia w jedno wywołanie, o ile to możliwe. Nad listą agentów widnieje odczyt z szacunkowym obciążeniem przy obecnych ustawieniach. Pokazuje on w przybliżeniu, ile tokenów instrukcji agentów doszło i ile dodatkowych wywołań przypada na turę.

Kliknij lub stuknij ikonę pomocy obok odczytu, aby otworzyć wyjaśnienie na komputerze lub telefonie. Odczyt robi się bursztynowy i dostaje ikonę ostrzeżenia, gdy obciążenie rośnie. Rzeczywisty koszt tury jest wyższy niż pokazana liczba. Z każdym wywołaniem idzie historia czatu i szczegóły postaci. Limit ostatnich wiadomości dotyczy tylko wiadomości z czatu; instrukcje agentów, szczegóły postaci i dołączone podsumowania stanowią dodatkowy kontekst. Po zobaczeniu ostrzeżenia usuń zbędnych agentów albo przenieś część na tańsze lub lokalne połączenie. Zapisane w połączeniu ustawienie **Reasoning Effort** (poziom rozumowania) dotyczy też korzystających z niego agentów, więc wysoki poziom wydłuża i podraża każde ich wywołanie. Zobacz [Parametry agentów](../prompts/generation-parameters.md#parameters-for-agents).

## Z jakimi agentami startuje każdy tryb

Świeża instalacja nie ma zainstalowanych ani aktywnych żadnych opcjonalnych agentów. Każdy tryb czatu pokazuje tylko zgodne z nim pakiety, które są zainstalowane.

- **Roleplay**: zainstaluj agentów dla trybu Roleplay z katalogu, a potem dodaj ich w panelu **Chat Settings**. World Maps pojawia się tam jak każdy inny obsługiwany agent.
- **Conversation**: zainstaluj pakiet Calls albo pojedyncze gry stołowe z katalogu. Gry pojawiają się w liście wyboru gier i rejestrują swoje komendy slash, a rozmowy dodają własny pasek narzędzi i opcje w panelu **Chat Settings**.
- **Game Mode**: zainstalowanych agentów zgodnych z trybem gry można wybrać podczas tworzenia gry albo dodać później. World Maps udostępnia swój obszar roboczy map i widok mapy świata tylko wtedy, gdy jest aktywny w danej grze.

Zgodnych agentów da się dodawać i usuwać w każdej chwili.

## Jak sprawdzić, czy agent zadziałał

Część agentów zmienia coś od razu widocznego. Inni pracują po cichu. Oto sposoby na sprawdzenie.

- Agenci trackerów zapisują dane na pasku HUD i w panelach trackerów. Jeśli godzina, miejsce, nastrój albo statystyki się zmieniły, tracker zadziałał.
- Pływający pasek stanu pokazuje krótkie komunikaty agentów w trakcie pracy, więc ich działanie widać na bieżąco.
- Agenci **Prose Guardian** i **Continuity Checker** zmieniają sam tekst odpowiedzi. Oczyszczona albo poprawiona odpowiedź to znak, że zadziałali.
- Pełny ślad daje przełącznik **Debug mode** (tryb diagnostyczny) w **Settings** (Ustawienia), dalej **Advanced**, dalej **Message Tools**. Zapisuje on prompt i odpowiedź każdego agenta w konsoli serwera. Pokazuje też nakładkę **Agent Debug** z wywołaniami, tokenami i czasami dla poszczególnych agentów.

Spodziewany agent nie zadziałał? Sprawdź, czy przełącznik **Enable Agents** jest włączony. Sprawdź, czy agent jest aktywny w tym czacie. Sprawdź, czy tryb czatu na niego pozwala.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Awatary 2D i 3D](avatars.md)
- [Oficjalne repozytorium Marinara Agents](https://github.com/Pasta-Devs/Marinara-Agents)
- [Tworzenie własnych agentów](custom-agents.md)
- [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md)
- [Pasek HUD i trackery w trybie Roleplay](../roleplay/hud-and-trackers.md)
