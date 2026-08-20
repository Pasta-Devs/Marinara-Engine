# Agenci do pobrania: przegląd pakietów

Ten przewodnik opisuje wszystkie 36 oficjalnych pakietów twórców aplikacji Marinara Engine, dostępnych w sekcji **Agents → Download Agents** (agenci → pobieranie agentów), z podziałem na kategorie. Świeża instalacja aplikacji Marinara Engine nie zawiera żadnych agentów. Źródła pakietów, manifesty, artefakty i katalog do odczytu maszynowego znajdują się w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Przy każdym agencie znajdziesz opis tego, co robi, kiedy się uruchamia lub jak się integruje, w których trybach czatu działa i jakie ma najważniejsze ustawienia. O instalacji i włączaniu przeczytaj najpierw w przewodniku [Agenci: pomocnicy AI](agents-overview.md).

## Jak czytać ten przegląd

Agent to niewielki pomocnik AI, który działa automatycznie obok głównej odpowiedzi na czacie. Najpierw zainstaluj go z katalogu, potem włącz i skonfiguruj – osobno dla każdego czatu, a nie dla karty postaci. Pobieranie, aktualizowanie, odinstalowanie, konfigurację dla pojedynczego czatu oraz ostrzeżenie o kosztach opisuje przewodnik [Agenci: pomocnicy AI](agents-overview.md).

Przy każdym agencie poniżej znajdziesz trzy szybkie informacje.

- **Faza lub integracja**: kiedy uruchamia się zwykły agent działający w potoku generowania. Faza **Pre-Generation** (przed generowaniem) działa przed odpowiedzią i może dodać tekst do promptu, czyli do tekstu, który Marinara wysyła do AI. Faza **Parallel** (równolegle) działa w tym samym czasie co odpowiedź i nie widzi gotowego tekstu. Faza **Post-Processing** (po wygenerowaniu) działa po zakończeniu odpowiedzi i może ją odczytać, a część agentów potrafi ją też przepisać. Pakiety funkcji, takie jak Maps, Calls i gry w trybie Conversation, zamiast tego integrują się bezpośrednio ze swoim ekranem czatu.
- **Gdzie działa**: tryby czatu, w których da się dodać danego agenta. Większość agentów działa na czatach w trybie **Roleplay**. Kilku działa w innych trybach – przy każdym jest to napisane.
- **Najważniejsze ustawienia**: ustawienia, które zmienia się najczęściej. Ustawisz je przy dodawaniu agenta albo później, w karcie konfiguracji agenta w panelu **Chat Settings** (ustawienia czatu).

Marinara dzieli agentów na trzy kategorie w panelu **Agents**: **Writer Agents**, **Tracker Agents** i **Misc Agents**. Ten przegląd trzyma się tego samego podziału.

Odstęp uruchamiania oznacza, że agent działa raz na kilka wiadomości użytkownika i asystenta, a nie po każdej wiadomości. Odstęp uruchamiania zmienisz w konfiguracji agenta, maksymalnie do 100.

## Agenci piszący

Agenci piszący kształtują fabułę albo sam tekst. Dodają wskazówki przed odpowiedzią lub porządkują odpowiedź po jej wygenerowaniu.

### Prose Guardian

Przepisuje ostatnią odpowiedź, usuwając zakazane słowa i powtórzenia, bez zmiany sensu. Przydaje się, gdy model powtarza te same zwroty albo nadużywa jakiegoś słowa.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: pola tekstowe **Banned Words** (zakazane słowa, domyślnie `ozone`), **Prefer In Writing** i **Remove From Writing**. Przełącznik **Hold Message Until Rewrite** (domyślnie włączony) ukrywa odpowiedź do czasu zakończenia poprawek. Bez niego najpierw pokazuje się surowa odpowiedź, a potem podmienia się na poprawioną.

### Continuity Checker

Naprawia w ostatniej odpowiedzi konkretne błędy logiczne, na przykład postać w dwóch miejscach naraz albo rozjechaną oś czasu. Znalezione problemy pokazuje jako listę do zaznaczenia, więc to ty decydujesz, które poprawki wprowadzić.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: przełącznik **Hold Message Until Rewrite**.

### Card Evolution Auditor

Obserwuje, jak postać zmienia się w trakcie gry, i proponuje zmiany w jej karcie postaci. Nigdy nie edytuje niczego samodzielnie. Każda propozycja otwiera okno **Review Character Card Updates** (przegląd zmian w karcie postaci), w którym można ją przyjąć albo odrzucić.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: domyślnie działa raz na 8 wiadomości użytkownika i asystenta. Zobacz [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Tworzy jednorazowe popchnięcie fabuły, ale tylko wtedy, gdy o to poprosisz. Kiedy ten agent jest aktywny na czacie w trybie Roleplay, nad polem wiadomości pojawia się przycisk **Push Story** (popchnij fabułę). Kliknij go, aby uzbroić kolejną odpowiedź, która następnie pchnie fabułę do przodu albo wprowadzi niespodziankę.

- **Faza**: Pre-Generation.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: **Story Push Mode** (tryb popychania fabuły) z opcjami **Natural**, która rozwija bieżące wątki, oraz **Random Event**, która dodaje prawdopodobną niespodziankę. Agent może też prowadzić opcjonalny, ukryty wątek długoterminowy o nazwie **Secret Plot**. Pełny opis krok po kroku znajdziesz w przewodniku [Narrative Director i Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Przed odpowiedzią przegląda wskazane lorebooki oraz wgrane pliki. Streszcza istotne fragmenty i dokłada to streszczenie do promptu. Lorebook to zbiór faktów o twoim świecie i postaciach. To lekkie wyszukiwanie, więc nie wymaga osobnej bazy danych.

- **Faza**: Pre-Generation.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: przełącznik **Use chat-active lorebooks** (używaj lorebooków aktywnych na czacie), lista wyboru **Fixed Source Lorebooks** oraz wgrywanie plików w obsługiwanych formatach. Nie uruchamiaj tego agenta razem z agentem Knowledge Router, bo ich zadania się pokrywają. Konfigurację opisuje przewodnik [Źródła wiedzy](knowledge-sources.md).

### Knowledge Router

Tańsza alternatywa dla agenta Knowledge Retrieval. Zamiast streszczać, czyta krótkie opisy wpisów w lorebookach. Następnie dokłada pasujące wpisy słowo w słowo. Działa najlepiej, gdy wpisy mają dobre opisy.

- **Faza**: Pre-Generation.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: przełącznik **Use chat-active lorebooks** i lista wyboru **Fixed Source Lorebooks**. Kafelek pokrycia pokazuje, jaki procent wpisów źródłowych ma napisany opis. Konfigurację opisuje przewodnik [Źródła wiedzy](knowledge-sources.md).

## Agenci śledzący

Agenci śledzący prowadzą na bieżąco zapis sceny, postaci i statystyk. Ich najnowszy wynik można dokładać do promptu jako osobną sekcję, dzięki czemu model zachowuje spójność. Agenci World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker i Beholder mają domyślnie włączoną opcję **Add as Prompt Section**. Wyjątkiem są Expression Engine i Background.

### World State

Śledzi datę, godzinę, pogodę, miejsce oraz to, które postacie są obecne. Dzięki temu scena zostaje osadzona w konkretach, a model nie zapomina, gdzie i kiedy dzieje się fabuła.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (dodaj jako sekcję promptu, domyślnie włączone).

### Expression Engine

Odczytuje emocje z ostatniej odpowiedzi i dobiera pasujący sprite lub wyraz twarzy postaci. Sprite to obrazek postaci pokazywany na scenie. Przydaje się do stojących ilustracji postaci, które zmieniają się razem z nastrojem.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Sprite Source** (źródło sprite'ów) z opcjami **Expressions**, **Full-body** albo obiema naraz, przełącznik **Expression Avatars**, lista wyboru **Sprite Owners** oraz suwaki rozmiaru i przezroczystości. Zobacz [Sprite'y postaci](../characters/sprites.md).

### Quest Tracker

Zarządza celami zadań, ich ukończeniem i nagrodami. Sięgnij po niego w rozgrywce przygodowej, gdy przydaje się widoczna lista zadań.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone).

### Background

Wybiera najlepiej pasujące tło do bieżącej sceny spośród wgranych obrazów. Nie generuje obrazów – do automatycznego generowania teł scen służy agent Illustrator.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: standardowe ustawienia połączenia i kontekstu agenta. Do wyboru tła służą wyłącznie obrazy dostępne już w bibliotece teł.

### Character Tracker

Śledzi obecne postacie, a przy tym ich nastrój, działania, wygląd, strój, myśli i statystyki osobne dla każdej postaci, na przykład HP. Potrafi też tworzyć portrety nowych postaci, które jeszcze ich nie mają.

Kiedy stała postać wraca po zniknięciu ze sceny, Character Tracker sięga po jej ostatnie zapisane statystyki i pola własne, żeby zachować ciągłość. Postacie oparte na kartach dostają dodatkowo skonfigurowane pule i atrybuty RPG jako punkt odniesienia oraz zawsze zachowują awatar i kadrowanie z karty. Automatycznie generowane portrety powstają wyłącznie dla postaci NPC bez pasującej karty postaci.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone) oraz opcjonalne ustawienie **Auto-Generate NPC Avatars** z własną listą wyboru połączenia do obrazów.

### Beholder

Śledzi obecny strój każdej postaci według części ciała, trzymane przedmioty, rany, brakujące części ciała, miejsca wyraźnie oznaczone jako odsłonięte oraz gatunki inne niż człowiek. Najnowszy zweryfikowany zapis pojawia się w panelu Roleplay Chat Settings agenta Beholder i trafia zarówno do jego następnego wywołania śledzącego, jak i do kolejnej głównej odpowiedzi Roleplay.

- **Faza**: Post-Processing.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: dodaj go lub usuń w **Chat Settings → Agents → Tracker Agents**; otwórz tam **Configure Beholder**, aby wybrać połączenie, model, prompt, kontekst i limity wyniku. Opcja **Add as Prompt Section** jest domyślnie włączona.
- **Zalecany model**: do niezawodnego śledzenia pełnego stanu użyj modelu SOTA, na przykład OpenAI GPT-5.5+, Claude Opus 4.8+ albo Kimi K3+.
- **Pochodzenie**: dostosowano do natywnego środowiska Agent w Engine na podstawie projektu [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), objętego wyłącznie licencją AGPL-3.0. Oficjalny pakiet nie ładuje DOM, odpytywania ani środowiska pamięci lokalnej ze starszego rozszerzenia.

### Persona Stats

Śledzi paski stanu twojej własnej postaci, na przykład Satiety, Energy i Hygiene, a także dowolne paski dodane samodzielnie. Przydaje się w rozgrywce survivalowej albo w symulacji życia.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone). Zobacz [Kolory postaci i statystyki](../characters/colors-and-stats.md).

### Custom Tracker

Śledzi pola zdefiniowane samodzielnie, na przykład waluty, liczniki albo znaczniki. Przydaje się, gdy wbudowane trackery nie obejmują czegoś, czego wymaga twoja fabuła.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone).

### Inventory Tracker

Śledzi pieniądze, założone wyposażenie i noszone przedmioty w trzech ustrukturyzowanych listach bez ponownego używania ekwipunku z Persona Stats ani ściskania danych w ciągach tekstowych Custom Tracker. Powtarzające się nazwy są scalane, liczba wynosząca jeden pozostaje wizualnie zwięzła, a zablokowane wiersze nie zmieniają się przy kolejnych uruchomieniach trackera.

- **Faza**: Post-Processing (przetwarzanie po odpowiedzi).
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone). W pasku HUD i panelu Tracker Panel można zmieniać i blokować każdą nazwę oraz liczbę sztuk.

### World Maps

Dodaje do fabuły trwałe, zagnieżdżone miejsca i zależności przestrzenne. Można tworzyć regiony, obszary, pomieszczenia i przejścia, przemieszczać się między miejscami, a bieżące położenie dokłada kontekst przestrzenny do generowania. Tryb Game Mode zyskuje dodatkowo widok mapy świata z tego pakietu.

- **Integracja**: pakiet funkcji – dokłada interfejs mapy i kontekst działającego czatu, zamiast działać jak zwykły agent przypisany do fazy generowania.
- **Gdzie działa**: Roleplay i Game.
- **Najważniejsze ustawienia**: włącz pakiet dla czatu w trybie Roleplay w sekcji **Chat Settings → Agents** albo wybierz go przy tworzeniu gry i zarządzaj nim później w ustawieniach tej gry. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.
- **Pełny przewodnik**: [World Maps: konfiguracja, tworzenie map i podróże](hierarchical-maps.md).

## Agenci różni

Agenci różni wnoszą dodatki: obrazy, muzykę, reakcje publiczności i aktualizacje kart postaci.

### Echo Chamber

Symuluje publiczność reagującą na żywo na twoją scenę; jej reakcje pokazuje pływający widget **Echo** w obszarze czatu. Co 30 sekund odsłania jedną nową reakcję.

- **Faza**: Parallel.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: styl wybierasz spośród nazwanych opcji, takich jak **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** i **Harbingers**. Wśród kontrolek widgetu są też przyciski **Re-run Echo Chamber** i **Clear messages**.

### Noodle

Dodaje opcjonalny lokalny świat społecznościowy z publiczną osią czasu Noodle oraz kanałem roleplay NoodleR dla twórców i fanów. Otwiera się w osobnej karcie Home zamiast działać w zwykłym potoku agentów czatu.

- **Integracja**: pakiet funkcji; udostępnia kartę Home, lokalne trasy, procesy generowania i multimediów oraz harmonogramy w tle.
- **Gdzie działa**: Home, z opcjonalnym kontekstem przenoszonym z czatów Conversation, Roleplay i Game.
- **Najważniejsze ustawienia**: zainstaluj go przez **Agents → Download Agents** i uruchom ponownie Marinara Engine, gdy pojawi się taka prośba. W Noodle można skonfigurować zaproszone konta, połączenia tekstowe i obrazowe, odświeżanie osi czasu, profile NoodleR Creator, dostęp do symulowanych wpisów oraz aktywność odbiorców.
- **Cykl życia danych**: odinstalowanie usuwa kartę Home i po ponownym uruchomieniu zatrzymuje trasy oraz harmonogramy pakietu, ale zachowuje istniejące dane Noodle i NoodleR na wypadek późniejszej instalacji.
- **Pełny przewodnik**: [Noodle: oś czasu społeczności w aplikacji](../noodle/overview.md).

### Long-Term Memory

Wyciąga trwałe wspomnienia ze streszczeń czatu, zapisów o postaciach i lorebooków do skarbca należącego do pakietu, a potem przywołuje pasujący kontekst przed główną odpowiedzią. Obsługuje przeglądanie skarbca w zawężonym zakresie, import źródeł, przegląd oczekujących wersji roboczych oraz umieszczanie przywołanego kontekstu według znacznika w presecie.

- **Integracja**: pakiet funkcji – dokłada kontekst przed generowaniem oraz interfejs zarządzania pamięcią, zamiast działać jak zwykły tracker po wygenerowaniu.
- **Gdzie działa**: Conversation, Roleplay i Game.
- **Najważniejsze ustawienia**: włączenie, limit tokenów przywołania (128-16,384), maksymalna liczba przywołanych fragmentów (1-100), próg oceny, kontekst ostatnich wiadomości (1-20), styl przywołania oraz wagi semantyczna, leksykalna, grafowa i słów kluczowych, dołączanie rozstrzygniętych wspomnień, wstęp do przywołania, rozumowanie i szczegółowość wyciągania danych, limity generowania, limity źródeł, szablony promptów, wyciąganie słów kluczowych przez AI oraz wyciąganie danych w trybie Game.
- **Cykl życia danych**: do eksportu lub zastąpienia skarbca, wersji roboczych i ustawień służą przyciski kopii zapasowej w sekcji Memory Settings. Usunięcie wszystkich danych trwale kasuje wspomnienia, wersje robocze, aktywność i indeksy pochodne, ale zachowuje ustawienia. Odinstalowanie pakietu zachowuje skarbiec Long-Term Memory na wypadek ponownej instalacji. Instalacja, aktualizacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.
- **Zgodność**: silnik od wersji `2.3.5` do wersji sprzed `4.0.0`. Pakiet korzysta z uprawnień `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage` i `ui`.

### Illustrator

Odpowiada za generowanie obrazów i wideo. Pisze prompty wizualne do ważnych momentów, a potem wysyła je do skonfigurowanego dostawcy multimediów.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: domyślnie działa raz na 5 wiadomości użytkownika i asystenta. Wśród ustawień są **Prompt Model**, **Image Style**, **Attach Card Appearance** i **Send Avatar References**. Pełną konfigurację opisuje przewodnik [Agent Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Tworzy i aktualizuje wpisy w lorebookach na podstawie ważnych faktów z czatu, więc notatki o świecie rosną w trakcie gry.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay. W trybie Game Mode tę samą pracę na koniec sesji wykonuje wariant **Game Session Keeper**.
- **Najważniejsze ustawienia**: domyślnie działa raz na 8 wiadomości użytkownika i asystenta. Lista wyboru **Target Lorebook** decyduje, gdzie trafiają wpisy, i ma opcję automatycznego wyboru. Zaawansowana konfiguracja promptu może zwrócić dokładną nazwę lorebooka z prawem zapisu albo skonfigurowany alias, taki jak `world`, `npc`, `scene` czy `player`; brakujący cel aliasu zostanie automatycznie utworzony i powiązany z bieżącym czatem. Pominięcie celu zachowuje dotychczasowe działanie z jednym lorebookiem.

### Combat

Prowadzi walkę, w tym inicjatywę, HP i kolejność tur. Kiedy agent jest aktywny, nad polem wiadomości pojawia się przycisk **Encounter**.

- **Faza**: Parallel.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: pakiet zawiera narzędzie do rzutów kością, które rozstrzyga tury.

### Immersive HTML

Dodaje do ostatniej odpowiedzi elementy wizualne pasujące do świata, na przykład ostylowaną notatkę albo ekran, bez zmiany fabuły.

- **Faza**: Post-Processing.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: przełącznik **Hold Message Until Rewrite**.

### Music DJ

Odczytuje nastrój sceny i odtwarza pasującą muzykę. Może korzystać z serwisu Spotify, YouTube albo z lokalnych plików audio.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay i Game.
- **Najważniejsze ustawienia**: ustawienie **Music Player** wskazuje dostawcę, a każdy dostawca wymaga własnej konfiguracji. Pełne kroki dla serwisu Spotify, YouTube i muzyki lokalnej opisuje przewodnik [Music DJ](../media/music.md).

### Haptic Feedback

Czyta narrację i w czasie rzeczywistym steruje podłączonymi zabawkami erotycznymi przez program Intiface Central. Program Intiface Central musi już działać z podłączoną zabawką, zanim włączysz tego agenta.

- **Faza**: Post-Processing.
- **Gdzie działa**: Conversation, Roleplay i Game.
- **Najważniejsze ustawienia**: wybór **Touch Sensitivity** (czułość dotyku) z opcjami **Subtle**, **Standard** i **Intense** oraz pole **Intiface URL**. Czułość kieruje wyborami agenta, ale nie ogranicza dostępnego zakresu intensywności `0.0-1.0`. Pełną konfigurację opisuje przewodnik [Konfiguracja Haptic Feedback](../integrations/haptic-feedback.md).

### CYOA Choices

Dodaje po każdej odpowiedzi klikalne przyciski wyboru w stylu "What will you do?", czyli klimat przygodówki paragrafowej CYOA. Każdy przycisk kryje pełne działanie, które wyślesz jednym kliknięciem.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: przycisk **Edit** przepisuje wybory, a **Re-roll** generuje nowe.

### Storyboard

Planuje nieruchome albo animowane storyboardy na podstawie zakończonych wymian w trybie Roleplay i narracji w trybie Game. Osobne planowanie i formatowanie dopasowane do dostawcy pilnują chronologii źródła, tożsamości postaci oraz wybranego stylu wizualnego w generowanych klatkach kluczowych i filmach.

- **Integracja**: pakiet agenta – tryb Game i Roleplay korzystają z szablonów promptów i ustawień zainstalowanego pakietu przez wbudowaną integrację Storyboard w silniku.
- **Gdzie działa**: Roleplay i Game.
- **Najważniejsze ustawienia**: wybór planera obrazów nieruchomych albo animacji, połączenia do obrazów i wideo, liczba klatek kluczowych, czas trwania, tryb wyświetlania, obsługa odniesień do postaci, szablony odcinka i stylu dla trybu Roleplay oraz szablony ilustracji i wideo dla trybu Game.
- **Zgodność**: silnik od wersji `2.3.5` do wersji sprzed `3.0.0`. Pakiet korzysta z uprawnień `agent-runtime`, `chat-read`, `prompt-context`, `storage` i `ui`, a jego instalacja nie wymaga ponownego uruchomienia.
- **Pełny przewodnik**: [Przewodnik po agencie Storyboard](../game/storyboard.md).

### Calls

Dodaje rozmowy audio i wideo na żywo z postaciami w trybie Conversation, w tym rozmowy wychodzące i przychodzące, transkrypcje samych rozmów, syntezę mowy, wejście z mikrofonu oraz klipy wideo z postaciami.

- **Integracja**: pakiet funkcji trybu Conversation – dokłada kontrolki na pasku narzędzi, na ekranie czatu i w panelu **Chat Settings**, zamiast działać jak zwykły agent przypisany do fazy generowania.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: otwórz **Chat Settings → Agents → Calls**, aby włączyć rozmowy i wybrać zachowanie mowy, mikrofonu, dzwonka i wideo. Zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md). Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### UNO

Dodaje stół do gry UNO z pilnowaniem zasad, przeznaczony dla ciebie i postaci w trybie Conversation, z konfigurowalnymi zasadami domowymi i obsługą od dwóch do dziesięciu graczy.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/uno`; przy konfiguracji wybierasz graczy i zasady domowe. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### Chess

Dodaje szachownicę do gry we dwoje, z pilnowaniem legalnych ruchów, wykrywaniem szacha i mata, zbitymi bierkami oraz turami przeciwnika prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/chess`, a potem wybierz przeciwnika i stronę, którą grasz. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### Poker

Dodaje stół do gry Texas Hold'em dla dwóch do ośmiu graczy, z ciemnymi, rundami licytacji, pulami pobocznymi, oceną kart w rozstrzygnięciu i przeciwnikami prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/poker`, a potem wybierz graczy, początkową liczbę żetonów i wysokość ciemnych. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### 8-Ball Pool

Dodaje stół bilardowy do gry we dwoje, z bilami pełnymi i pasiastymi, celowaniem i siłą uderzenia, faulami, bilą w ręce oraz uderzeniami przeciwnika prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/8ball`, a potem wybierz przeciwnika. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### Tic-Tac-Toe

Dodaje planszę do gry w kółko i krzyżyk we dwoje, z wyborem lub losowaniem znaku, pilnowaniem legalnych tur oraz wykrywaniem wygranej i remisu.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/tictactoe` (skrót `/ttt`), a potem wybierz przeciwnika i znak. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

### Rock-Paper-Scissors

Dodaje pojedynek w kamień, papier, nożyce we dwoje, w którym oba wybory pozostają ukryte aż do odsłonięcia.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/rps`, a potem wybierz przeciwnika oraz pojedynek w wersji do trzech, pięciu albo siedmiu partii. Instalacja i usunięcie wymagają ponownego uruchomienia aplikacji Marinara Engine.

## Powiązane przewodniki

- [Agenci: pomocnicy AI](agents-overview.md)
- [Agent Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Konfiguracja Haptic Feedback](../integrations/haptic-feedback.md)
- [Źródła wiedzy](knowledge-sources.md)
- [Narrative Director i Secret Plot](../roleplay/narrative-director.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Gry stołowe w trybie Conversation](../conversation/table-games.md)
