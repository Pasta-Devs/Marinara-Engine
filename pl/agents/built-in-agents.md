# Agenci do pobrania: przegląd pakietów

Ten przewodnik wymienia oficjalnych agentów od twórców aplikacji Marinara Engine, dostępnych w sekcji **Agents → Agent Organizer** (agenci, organizowanie agentów), z podziałem na grupy. Świeża instalacja nie zawiera żadnych agentów. Ich źródła i katalog są publicznie dostępne w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Przy każdym agencie znajdziesz opis tego, co robi, kiedy się uruchamia, gdzie działa i jakie ma najważniejsze ustawienia. O instalacji i włączaniu agentów przeczytaj najpierw w przewodniku [Agenci: pomocnicy AI](agents-overview.md). Pozycje oznaczone jako **staging only** (tylko staging) są dostępne dla użytkowników wersji staging aplikacji Marinara Engine; użytkownicy wersji stabilnej zobaczą je po opublikowaniu pakietu w kanale stabilnym.

## Jak czytać ten przegląd

Zainstaluj agenta z **Agent Organizer**, a potem dodaj go do każdego czatu, w którym ma działać. Agentów konfiguruje się osobno dla każdego czatu, a nie dla karty postaci. Instalację, aktualizowanie, konfigurację dla pojedynczego czatu i koszty opisuje przewodnik [Agenci: pomocnicy AI](agents-overview.md).

Każda pozycja pokazuje te same szybkie informacje.

- **Faza** lub **Integracja**: kiedy uruchamia się agent działający w potoku generowania. Faza **Pre-Generation** (przed generowaniem) działa przed odpowiedzią i może dodać tekst do promptu, czyli do tekstu, który Marinara wysyła do AI. Faza **Parallel** (równolegle) działa w tym samym czasie co odpowiedź i nie widzi gotowego tekstu. Faza **Post-Processing** (po wygenerowaniu) działa po odpowiedzi i może ją odczytać. Część agentów potrafi ją też przepisać. Pakiety funkcji, takie jak World Maps, Calls i gry w trybie Conversation, zamiast tego wpinają się w swój ekran czatu. Aplikacje otwierają się we własnej zakładce **Home** (ekran główny).
- **Gdzie działa**: tryby czatu, które przyjmują danego agenta. Większość agentów działa w trybie Roleplay.
- **Najważniejsze ustawienia**: ustawienia, które najprawdopodobniej zmienisz, na karcie agenta w panelu **Chat Settings** (ustawienia czatu).

Odstęp uruchamiania sprawia, że agent działa raz na kilka wiadomości użytkownika i asystenta, a nie po każdej wiadomości. Można go ustawić maksymalnie na 100.

W trybie Roleplay odstęp uruchamiania agenta Illustrator ustawia się osobno dla każdego czatu, na karcie tego agenta w panelu **Chat Settings**. Wartość z jego konfiguracji jest domyślna dla czatów, które nie mają własnej. Agent Illustrator przyjmuje też wartość **0**: wtedy nigdy nie uruchamia się automatycznie i pozostaje dostępny w działaniach galerii.

<a id="apps"></a>

## Aplikacje

Aplikacje mają własną zakładkę w **Home**. Korzystasz z nich osobno, zamiast dodawać je do czatu. Po instalacji każda z nich prosi o ponowne uruchomienie.

### Noodle

Dodaje opcjonalną lokalną publiczną oś czasu Noodle we własnej zakładce **Home**. Nie działa w potoku agentów czatu.

- **Integracja**: pakiet funkcji z lokalnymi trasami, procesami generowania i multimediów oraz harmonogramami w tle.
- **Gdzie działa**: Home, z opcjonalnym kontekstem przenoszonym z czatów Conversation, Roleplay i Game.
- **Najważniejsze ustawienia**: zainstaluj go z **Agents → Agent Organizer** i uruchom aplikację ponownie, gdy pojawi się taka prośba. W Noodle ustawiasz zaproszone konta, połączenia tekstowe i obrazowe, odświeżanie osi czasu, losowych użytkowników oraz przenoszenie treści do czatów.
- **Dane**: odinstalowanie usuwa zakładkę i po ponownym uruchomieniu zatrzymuje harmonogramy. Twoje dane Noodle zostają na wypadek późniejszej ponownej instalacji.
- **Pełny przewodnik**: [Noodle: wbudowana oś czasu społecznościowa](noodle.md).

### Slurp

Prywatna aplikacja społecznościowa dla twoich postaci. Zamieniaj postacie i persony w twórców (Creators), publikuj zdjęcia publiczne lub zablokowane i patrz, jak symulowana publiczność obserwuje, subskrybuje, kupuje, komentuje i wysyła wiadomości. Domyślnie jest nastawiona na treści dla dorosłych. To wszystko na niby: ceny są fikcyjne i nie dochodzi do żadnych prawdziwych płatności.

- **Integracja**: aplikacja we własnej zakładce **Slurp** w **Home**.
- **Gdzie działa**: Home.
- **Najważniejsze ustawienia**: zainstaluj ją, uruchom aplikację ponownie, gdy pojawi się prośba, a potem otwórz **Home → Slurp**. Żeby postacie z czatu pamiętały ostatnie wpisy i wiadomości z zakładki Slurp, włącz **Include Slurp activity** (uwzględnianie aktywności w Slurp) w **Chat Settings** tego czatu, w sekcji **Connected Chats** (połączone czaty). W ustawieniach Slurp przenoszenie treści do czatów musi być też włączone dla tego trybu czatu. **Slurp Settings → Autopurge** (ustawienia Slurp, automatyczne czyszczenie) usuwa stare multimedia Slurp, żeby oszczędzać miejsce. Domyślnie jest wyłączone.
- **Starsze nazwy**: starsze katalogi pokazują ją jako **Slurp Remastered**, obok wycofanego pakietu **Slurp Legacy**, który nie dostaje już aktualizacji.
- **Pełny przewodnik**: [Przewodnik pakietu Slurp](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

Gra typu gacha zbudowana na podstawie świata, który opiszesz: banery do losowania, obsada postaci, którą model pisze i rysuje, rozdziały fabuły opowiadane przez narratora w stylu powieści wizualnej oraz bitwy, ekwipunek i wydarzenia. Świat mogą zasilić twoje lorebooki, ale wystarczy też scenariusz napisany ręcznie.

- **Integracja**: aplikacja we własnej zakładce **Gacha Forge** w **Home**.
- **Gdzie działa**: Home.
- **Najważniejsze ustawienia**: zainstaluj ją, uruchom aplikację ponownie, gdy pojawi się prośba, a potem otwórz **Home → Gacha Forge**. Odinstalowanie usuwa zakładkę po ponownym uruchomieniu.
- **Pełny przewodnik**: [Przewodnik pakietu Gacha Forge](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

Symulacja życia. Żyjesz w małym miasteczku według zegara: trzeba utrzymać pracę, płacić rachunki oraz pilnować energii i głodu. Ludzie wokół ciebie pochodzą z twoich kart postaci, a ważne sceny opowiada narrator w stylu powieści wizualnej.

- **Integracja**: aplikacja we własnej zakładce **Life Sim** w **Home**.
- **Gdzie działa**: Home.
- **Dostępność**: **Staging only**; wymaga aplikacji Marinara Engine w wersji **2.4.4+** (poniżej 4.0.0). To wersja alfa. Jeśli aktualizacja zmieni coś, od czego zależy starszy zapis gry, Life Sim poinformuje o tym przy otwarciu tego zapisu. Możesz zacząć nowe życie albo grać dalej na własne ryzyko.
- **Najważniejsze ustawienia**: zainstaluj ją, uruchom aplikację ponownie, gdy pojawi się prośba, a potem otwórz **Home → Life Sim**. Wymaga połączenia tekstowego. Połączenie obrazowe jest opcjonalne: bez niego miejsca pokazują ilustrowane karty. Opcjonalne moduły pozostają wyłączone, dopóki nie włączysz ich dla danego życia. Moduł **Adult** (dla dorosłych) prosi o potwierdzenie pełnoletności.
- **Pełny przewodnik**: [Przewodnik pakietu Modern Life Sim](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

Książka, którą piszesz wspólnie z modelem. Ustaw fabułę, obsadę i lorebooki na pasku bocznym, zostaw instrukcje autorskie na karteczce, a model napisze kolejny rozdział, gdy o to poprosisz. Możesz kliknąć dowolne miejsce w tekście, żeby je zmienić, albo samodzielnie napisać pierwszy rozdział.

- **Integracja**: aplikacja we własnej zakładce **Story Writer** w **Home**.
- **Gdzie działa**: Home.
- **Dostępność**: wymaga aplikacji Marinara Engine w wersji nowszej niż **v2.5.1** (następnego wydania albo aktualnej wersji staging).
- **Najważniejsze ustawienia**: zainstaluj ją, uruchom aplikację ponownie, gdy pojawi się prośba, a potem otwórz **Home → Story Writer** i wybierz połączenie tekstowe na pasku bocznym. Historie są zapisywane na twoim serwerze Marinara. Możesz zaczynać nowe, wracać do starych i pobierać je jako Markdown albo zwykły tekst.
- **Pełny przewodnik**: [Przewodnik pakietu Story Writer](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Agenci piszący

Agenci piszący kształtują fabułę albo sam tekst. Dodają wskazówki przed odpowiedzią lub porządkują odpowiedź po jej wygenerowaniu.

### Prose Guardian

Przepisuje ostatnią odpowiedź, usuwając zakazane słowa i powtórzenia, bez zmiany sensu. Użyj go, żeby model przestał powtarzać te same zwroty albo nadużywać jakiegoś słowa.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: pola tekstowe **Banned Words** (zakazane słowa, domyślnie `ozone`), **Prefer In Writing** i **Remove From Writing**. Przełącznik **Hold Message Until Rewrite** (domyślnie włączony) ukrywa odpowiedź do czasu zakończenia poprawek. Bez niego najpierw pokazuje się surowa odpowiedź, a potem zostaje podmieniona.

### Continuity Checker

Naprawia w ostatniej odpowiedzi konkretne błędy logiczne, na przykład postać w dwóch miejscach naraz albo rozjechaną oś czasu. Gdy znajdzie problemy, pokazuje listę do zaznaczenia, na której wybierasz poprawki do wprowadzenia.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: przełącznik **Hold Message Until Rewrite**.

### Card Evolution Auditor

Obserwuje, jak postać zmienia się w trakcie gry, i proponuje zmiany w jej karcie postaci. Nigdy nie edytuje niczego samodzielnie. Każda propozycja otwiera okno **Review Character Card Updates** (przegląd zmian w karcie postaci), w którym można ją przyjąć albo odrzucić.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: domyślnie działa raz na 8 wiadomości użytkownika i asystenta. Zobacz [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Tworzy jednorazowe popchnięcie fabuły, gdy o to poprosisz. Kiedy ten agent jest aktywny na czacie w trybie Roleplay, pojawia się przycisk **Push Story** (popchnij fabułę). Kliknij go, aby uzbroić kolejną odpowiedź, która następnie pchnie fabułę do przodu albo doda niespodziankę.

- **Faza**: Pre-Generation.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: **Story Push Mode** (tryb popychania fabuły) z opcjami **Natural**, która rozwija bieżące wątki, i **Random Event**, która dodaje prawdopodobną niespodziankę. Agent może też prowadzić ukryty wątek długoterminowy o nazwie **Secret Plot**. Zobacz [Narrative Director i Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Przed odpowiedzią przegląda wybrane przez ciebie lorebooki oraz wgrane pliki. Streszcza istotne fragmenty i dokłada to streszczenie do promptu. Lorebook to zbiór faktów o twoim świecie, które tworzą tło fabuły. To lekkie wyszukiwanie, które nie wymaga osobnej bazy danych.

- **Faza**: Pre-Generation.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Use chat-active lorebooks** (używaj lorebooków aktywnych na czacie), lista wyboru **Fixed Source Lorebooks** oraz wgrywanie plików. Nie uruchamiaj go razem z agentem Knowledge Router, bo ich zadania się pokrywają. Zobacz [Źródła wiedzy](knowledge-sources.md).

### Knowledge Router

Tańsza alternatywa dla agenta Knowledge Retrieval. Czyta krótkie opisy wpisów w twoich lorebookach i dokłada pasujące wpisy słowo w słowo. Działa najlepiej, gdy wpisy mają dobre opisy.

- **Faza**: Pre-Generation.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Use chat-active lorebooks** i lista wyboru **Fixed Source Lorebooks**. Plakietka pokrycia pokazuje, jaki procent wpisów źródłowych ma opis. Zobacz [Źródła wiedzy](knowledge-sources.md).

## Agenci śledzący

Agenci śledzący prowadzą na bieżąco zapis sceny, postaci i twoich statystyk. **Add as Prompt Section** (dodaj jako sekcję promptu) dokłada najnowszy wynik agenta do promptu, dzięki czemu model zachowuje spójność. Ta opcja jest domyślnie włączona dla każdego trackera oprócz Expression Engine i Background.

### World State

Śledzi datę, godzinę, pogodę, miejsce oraz to, które postacie są obecne. Dzięki temu scena zostaje osadzona w konkretach, a model nie zapomina, gdzie i kiedy dzieje się fabuła.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone).

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

Wybiera najlepsze tło do bieżącej sceny spośród wgranych przez ciebie teł. Nie generuje obrazów. Do generowanych teł scen służy agent Illustrator.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: standardowe ustawienia połączenia i kontekstu agenta. Wybiera wyłącznie spośród obrazów dostępnych już w twojej bibliotece teł.

### Character Tracker

Śledzi obecne postacie wraz z ich nastrojem, działaniami, wyglądem, strojem, myślami i statystykami osobnymi dla każdej postaci, na przykład HP. Potrafi też tworzyć portrety nowych postaci, które jeszcze ich nie mają.

Kartę opisującą kilka osób, na przykład kartę scenariusza z obsadą, można śledzić osobno dla każdej osoby. Oznacz każdą osobę w treści karty nagłówkiem `[CHARACTER: Name]` lub polem `Name:`. Każda osoba zachowuje własne imię, nastrój, strój, myśli i portret. Osoby nie korzystają ze wspólnego portretu karty. Stary wpis nazwany tak jak karta pozostaje, dopóki tracker nie zgłosi konkretnej osoby, która go zastąpi. Postacie dodane ręcznie zachowują swoją ręczną tożsamość.

Kiedy postać wraca po opuszczeniu sceny, tracker używa jej ostatnich zapisanych statystyk i pól własnych. Postacie oparte na kartach dostają też skonfigurowane pule i atrybuty RPG. W grupie Roleplay w trybie Merged obecne postacie mogą też ustawiać, które karty postaci są aktywne przy następnej odpowiedzi. Zobacz [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only).

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone) oraz opcjonalne ustawienie **Auto-Generate NPC Avatars** z własną listą wyboru połączenia do obrazów. Przełącznik **Include the outfit in portraits** (uwzględnianie stroju na portretach) jest domyślnie włączony. Wyłącz go, żeby portrety powstawały na podstawie samego wyglądu.

### Beholder

Śledzi strój każdej postaci według części ciała, trzymane przedmioty, rany, brakujące części ciała, miejsca wyraźnie oznaczone jako odsłonięte oraz gatunki inne niż człowiek. Najnowsza zweryfikowana migawka pojawia się w szufladzie agenta Beholder w panelu **Chat Settings** czatu Roleplay. Trafia do następnego wywołania śledzącego agenta Beholder i do kolejnej głównej odpowiedzi.

- **Faza**: Post-Processing.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: dodaj go w **Chat Settings → Agents → Tracker Agents** (ustawienia czatu, agenci, agenci śledzący), a potem otwórz **Configure Beholder** (konfiguracja agenta Beholder), aby wybrać połączenie, model, prompt, kontekst i limity wyniku. Opcja **Add as Prompt Section** jest domyślnie włączona.
- **Szablon promptu**: wybierz szablon pasujący do modelu za połączeniem agenta Beholder. Marinara nie potrafi wykryć modelu, więc wybór jest ręczny. Zły wybór nie powoduje awarii, ale daje gorsze wyniki.
  - **SOTA model — one prompt** (model SOTA – jeden prompt, domyślnie): jedno wywołanie obejmuje wszystkie śledzone pola. Użyj silnego modelu ogólnego.
  - **Beholder local model — five passes** (lokalny model Beholder – pięć przebiegów): pięć wąskich wywołań, po jednym na obszar śledzenia, dla specjalnie wytrenowanego ekstraktora [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) uruchomionego na twoim komputerze (na przykład `Beholder-Q8_0.gguf` przez koboldcpp lub llama.cpp). Ten model odpowiada na jeden obszar naraz, więc szablon jednego promptu zwraca częściowy stan. Działa offline i bez opłat.
- **Pochodzenie**: adaptacja projektu [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), objętego wyłącznie licencją AGPL-3.0. Oficjalny pakiet nie ładuje DOM, odpytywania ani środowiska pamięci lokalnej ze starego rozszerzenia.

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

Śledzi pieniądze, założone wyposażenie i noszone przedmioty w trzech ustrukturyzowanych listach. Powtarzające się nazwy są scalane, a zablokowane wiersze nie zmieniają się przy kolejnych uruchomieniach trackera.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: **Add as Prompt Section** (domyślnie włączone). W pasku HUD i panelu Tracker Panel możesz zmieniać i blokować każdą nazwę oraz liczbę sztuk.

### Quartermaster

Zarządza ekwipunkiem aktywnej persony, miejscami na wyposażenie, liczbą przedmiotów, miejscami ich przechowywania i zapisanymi strojami. Po odpowiedziach czyta fabułę i wprowadza zmiany w przedmiotach. Pływający panel i Tracker Panel pozwalają ręcznie edytować ten sam ekwipunek. Grafiki przedmiotów i strojów są opcjonalne.

- **Faza**: Post-Processing, z kontekstem ekwipunku przekazywanym do kolejnych odpowiedzi.
- **Gdzie działa**: Roleplay. Śledzi aktywną personę, a nie członków drużyny ani postaci NPC.
- **Dostępność**: wymaga aplikacji Marinara Engine w wersji **2.4.6+**.
- **Konfiguracja**: zainstaluj go i uruchom aplikację ponownie, gdy pojawi się prośba. W każdym czacie Roleplay włącz agentów w **Chat Settings → Agents**, dodaj Quartermaster w grupie **Tracker Agents** i wybierz połączenie z modelem. Otwórz pływający panel przyciskiem nad panelem Tracker Panel.
- **Najważniejsze opcje**: zakładanie i przechowywanie przedmiotów, zapisywanie strojów, przywracanie ekwipunku lub cofanie ostatnich zmian trackera oraz eksport i import konfiguracji czatu. Generowanie obrazów korzysta z własnego połączenia obrazowego. Zanim włączysz makro wyglądu albo zastępowanie awatara, przeczytaj [przewodnik pakietu Quartermaster](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md).

### Relationship Tracker

Utrzymuje edytowalną sieć relacji między kartami postaci w grupowym czacie Roleplay oraz to, jak każda postać postrzega aktywną personę. Relacje są pozytywne, neutralne, negatywne lub skomplikowane. Ręczne blokady chronią twoje edycje przed automatycznymi zmianami.

- **Faza**: Post-Processing, z kontekstem relacji przekazywanym do kolejnych odpowiedzi.
- **Gdzie działa**: grupowe czaty Roleplay.
- **Dostępność**: wymaga aplikacji Marinara Engine w wersji **2.4.4+** (poniżej 4.0.0).
- **Konfiguracja**: zainstaluj go i uruchom aplikację ponownie, gdy pojawi się prośba. W każdym czacie Roleplay włącz agentów w **Chat Settings → Agents**, dodaj go w grupie **Tracker Agents** i wybierz połączenie z modelem. Sieć pojawi się w panelu Tracker Panel. Wybierz tam raz **All relationships** (wszystkie relacje) albo **Scene-only relationships** (tylko relacje w scenie), aby zainicjować czat.
- **Najważniejsze opcje**: **All relationships** lub **Scene-only relationships** dla kontekstu promptu, **Update from History** (aktualizuj z historii) do skanowania ostatnich wiadomości, ręczna edycja i blokowanie oraz **Resume automatic updates** (wznów automatyczne aktualizacje). **Context Size** (rozmiar kontekstu; domyślnie 5 wiadomości), **Presence lookback** (zakres sprawdzania obecności; domyślnie 15) i liczba wiadomości skanowanych z historii to osobne ustawienia. Zobacz [przewodnik pakietu Relationship Tracker](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Utrzymuje krótki, edytowalny skarbiec wspomnień dla każdego czatu Roleplay. Skanuje czat partiami, porządkuje wspomnienia według obecnych i dawnych uczestników oraz przenosi rozstrzygnięte wspomnienia na listę Resolved, z której można je przywrócić. Wspomnienie może zachować krótką kwestię dialogową słowo w słowo, gdy liczy się dokładne brzmienie.

Po każdej odpowiedzi dopasowanie słów przekazuje trackerowi tylko najtrafniejsze aktywne wspomnienia. Tracker ocenia, czy scena wymaga przypomnienia, i może wybierać wyłącznie spośród tych wspomnień. Podczas przywoływania nie może utworzyć nowego wspomnienia.

- **Faza**: Post-Processing.
- **Gdzie działa**: tylko Roleplay.
- **Najważniejsze ustawienia**: **Vault scan connection** (domyślnie: połączenie dla agentów), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) oraz **Maximum memories injected** (3). Użyj **Scan chat** do pierwszego przeskanowania historii, a **Open vault**, aby wyszukiwać, dodawać, edytować, rozstrzygać, przywracać lub usuwać wspomnienia.
- **Umiejscowienie w prompcie**: bez znacznika w presecie wybrane przypomnienia trafiają do następnej odpowiedzi wewnątrz `<context><memory_nags>…</memory_nags></context>`. Dodaj sekcję Memory Nag Agent, aby umieścić je samodzielnie.
- **Dane**: skarbiec należy do jednego czatu i zostaje po wyłączeniu lub odinstalowaniu pakietu. Usunięcie wspomnienia jest trwałe i zawsze wymaga wcześniejszego potwierdzenia.

### World Maps

Dodaje do fabuły zagnieżdżone miejsca i powiązania przestrzenne. Tworzysz regiony, obszary, pomieszczenia i przejścia, przemieszczasz się między miejscami, a bieżące położenie dokłada kontekst przestrzenny do generowania. Tryb Game Mode dostaje też widok mapy świata.

- **Integracja**: pakiet funkcji z interfejsem mapy i kontekstem czatu zamiast agenta przypisanego do fazy generowania.
- **Gdzie działa**: Roleplay i Game.
- **Najważniejsze ustawienia**: włącz go dla czatu Roleplay w **Chat Settings → Agents** albo wybierz go przy tworzeniu gry i zarządzaj nim w ustawieniach tej gry. Instalacja i usunięcie wymagają ponownego uruchomienia.
- **Pełny przewodnik**: [World Maps: konfiguracja, tworzenie map i podróże](hierarchical-maps.md).

## Agenci różni

Agenci różni wnoszą dodatki: obrazy, muzykę, reakcje publiczności i aktualizacje kart postaci.

### Echo Chamber

Symuluje publiczność reagującą na żywo na twoją scenę w pływającym widgecie **Echo** w obszarze czatu. Co 30 sekund odsłania jedną nową reakcję.

- **Faza**: Parallel.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: wybierz styl, na przykład **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** albo **Harbingers**. Widget ma przyciski **Re-run Echo Chamber** i **Clear messages**.

### Long-Term Memory

Wyciąga trwałe wspomnienia z podsumowań czatu, zapisów o postaciach i lorebooków do skarbca należącego do pakietu, a potem przed główną odpowiedzią przywołuje pasujący kontekst. Obsługuje przeglądanie skarbca, import źródeł, przegląd oczekujących wersji roboczych oraz umieszczanie kontekstu według znacznika w presecie.

- **Integracja**: pakiet funkcji z kontekstem przed generowaniem i interfejsem zarządzania pamięcią.
- **Gdzie działa**: Conversation, Roleplay i Game.
- **Najważniejsze ustawienia**: limit tokenów przywołania (128-16 384), maksymalna liczba przywołanych fragmentów (1-100), próg oceny, kontekst ostatnich wiadomości (1-20), styl przywołania, wagi wyszukiwania, dołączanie rozstrzygniętych wspomnień, wstęp do przywołania, ustawienia wyciągania danych, limity źródeł, szablony promptów, wyciąganie słów kluczowych przez AI oraz wyciąganie danych w trybie Game.
- **Dane**: do eksportu lub zastąpienia skarbca, wersji roboczych i ustawień służą przyciski kopii zapasowej w sekcji Memory Settings. **Delete all data** (usunięcie wszystkich danych) trwale usuwa wspomnienia, wersje robocze, aktywność i indeksy, ale zachowuje ustawienia. Odinstalowanie zachowuje skarbiec na wypadek ponownej instalacji. Instalacja, aktualizacja i usunięcie wymagają ponownego uruchomienia.
- **Zgodność**: silnik od wersji `2.3.5` do wersji sprzed `4.0.0`. Uprawnienia: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Tworzy obrazy i filmy. Pisze prompty wizualne do ważnych momentów i wysyła je do twojej usługi obrazów lub wideo.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: domyślnie agent Illustrator działa raz na 5 wiadomości użytkownika i asystenta. Zmień to polem **Image Run Interval** (odstęp między obrazami) na jego karcie w każdym czacie Roleplay. Automatyczne klipy korzystają z **Video Run Interval** (odstęp między klipami), gdy **Illustrator makes** ma wartość **Pictures and clips** lub **Clips only**. Ustaw **Video Run Interval** na **0**, aby wyłączyć automatyczne klipy. Wśród ustawień są **Prompt Model**, **Image Style**, **Attach Card Appearance** i **Send Avatar References**. Pełną konfigurację opisuje przewodnik [Agent Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Tworzy i aktualizuje wpisy w lorebookach na podstawie ważnych faktów z czatu, więc notatki o świecie rosną w trakcie gry.

- **Faza**: Post-Processing.
- **Gdzie działa**: Roleplay. W trybie Game Mode tę samą pracę wykonuje wariant uruchamiany na koniec sesji, **Game Session Keeper**.
- **Najważniejsze ustawienia**: domyślnie działa raz na 8 wiadomości użytkownika i asystenta. **Target Lorebook** decyduje, gdzie trafiają wpisy, i ma opcję automatycznego wyboru. Zaawansowane prompty mogą zwrócić nazwę lorebooka z prawem zapisu albo alias, taki jak `world`, `npc`, `scene` czy `player`. Brakujące cele aliasów są tworzone i wiązane z czatem. Bez celu zostaje dotychczasowe działanie z jednym lorebookiem.

### Combat

Prowadzi walkę: inicjatywę, HP i kolejność tur. Kiedy jest aktywny, nad polem wiadomości pojawia się przycisk **Encounter**.

- **Faza**: Parallel.
- **Gdzie działa**: Roleplay.
- **Najważniejsze ustawienia**: zawiera narzędzie do rzutów kością, które rozstrzyga tury.

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
- **Najważniejsze ustawienia**: przycisk **Edit** przepisuje wybory, a **Re-roll** generuje nowe. Włącz **Add CYOA choices to the message box instead of sending them** (dodawanie wyborów CYOA do pola wiadomości zamiast ich wysyłania) w **Settings → General → Input & Editing** (ustawienia, ogólne, wprowadzanie i edycja), żeby kliknięte wybory trafiały do pola wiadomości.

### Storyboard

Planuje nieruchome albo animowane storyboardy na podstawie zakończonych wymian w trybie Roleplay i narracji w trybie Game. Osobne planowanie i formatowanie dopasowane do dostawcy pilnują kolejności fabuły, tożsamości postaci i wybranego stylu w klatkach kluczowych i filmach.

- **Integracja**: pakiet agenta; tryby Game i Roleplay korzystają z jego szablonów promptów i ustawień przez integrację Storyboard w silniku.
- **Gdzie działa**: Roleplay i Game.
- **Najważniejsze ustawienia**: planery obrazów nieruchomych albo animacji, połączenia do obrazów i wideo, liczba klatek kluczowych, czas trwania, tryb wyświetlania, obsługa odniesień do postaci, szablony odcinka i stylu dla trybu Roleplay oraz szablony ilustracji i wideo dla trybu Game.
- **Zgodność**: silnik od wersji `2.3.5` do wersji sprzed `3.0.0`. Uprawnienia: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. Nie wymaga ponownego uruchomienia.
- **Pełny przewodnik**: [Przewodnik po agencie Storyboard](../game/storyboard.md).

### 2D Avatars

Pokazuje postacie i persony jako animowane awatary 2D, które mrugają, mówią i zmieniają minę przy każdej odpowiedzi. Awatar to albo sprite'y w stylu PNGTuber (twoje sprite'y wyrazów twarzy z obrazkami mrugania i mówienia), albo plik awatara mesh (`.mavatar`).

- **Integracja**: pakiet agenta. Awatary rysuje silnik. Podczas czatu pakiet nie wysyła żadnych dodatkowych zapytań do twoich połączeń AI.
- **Gdzie działa**: Roleplay i Game, dla postaci i person.
- **Dostępność**: w **Agent Organizer** w każdej instalacji. Wymaga aplikacji Marinara Engine w wersji 2.5.1 lub nowszej.
- **Najważniejsze ustawienia**: każdy awatar konfigurujesz na stronie agenta w panelu **Agents**. Agent zawiera też prompty, które ze sprite'a tworzą obrazki mrugania i mówienia oraz awatar mesh.
- **Zgodność**: silnik od wersji `2.5.0` do wersji sprzed `4.0.0`, Capability API 1.73. Uprawnienia: `agent-runtime`, `chat-read`, `storage`, `ui`. Nie wymaga ponownego uruchomienia.
- **Pełny przewodnik**: [Awatary 2D i 3D](avatars.md).

### 3D Avatars

Pokazuje postacie i persony jako animowane modele 3D, które mrugają, mówią i zmieniają minę przy każdej odpowiedzi. Obsługuje modele VRM (`.vrm`, w wersjach 0.x i 1.0) z opcjonalną animacją spoczynkową (`.vrma`), modele MMD PMX oraz modele GLB i FBX z układem kości, w których kości są dopasowywane po nazwach.

- **Integracja**: pakiet agenta. Awatary rysuje silnik. Podczas czatu pakiet nie wysyła żadnych dodatkowych zapytań do twoich połączeń AI.
- **Gdzie działa**: Roleplay i Game, dla postaci i person.
- **Dostępność**: w **Agent Organizer** w każdej instalacji. Wymaga aplikacji Marinara Engine w wersji 2.5.1 lub nowszej.
- **Najważniejsze ustawienia**: każdy awatar konfigurujesz na stronie agenta w panelu **Agents**.
- **Zgodność**: taka sama jak w przypadku 2D Avatars.
- **Pełny przewodnik**: [Awatary 2D i 3D](avatars.md).

### Calls

Dodaje rozmowy audio i wideo na żywo z postaciami w trybie Conversation: rozmowy rozpoczynane przez ciebie, rozmowy przychodzące, transkrypcje samych rozmów, syntezę mowy, wejście z mikrofonu oraz klipy wideo z postaciami.

- **Integracja**: pakiet funkcji trybu Conversation z kontrolkami na pasku narzędzi, na czacie i w panelu **Chat Settings**.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: otwórz **Chat Settings → Agents → Calls**, aby włączyć rozmowy i wybrać zachowanie mowy, mikrofonu, dzwonka i wideo. Zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md). Instalacja i usunięcie wymagają ponownego uruchomienia.

### UNO

Dodaje stół do gry UNO z pilnowaniem zasad, przeznaczony dla ciebie i postaci w trybie Conversation, z zasadami domowymi i od dwóch do dziesięciu graczy.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/uno`, a potem wybierz graczy i zasady domowe. Instalacja i usunięcie wymagają ponownego uruchomienia.

### Chess

Dodaje szachownicę do gry we dwoje, ze sprawdzaniem legalności ruchów, wykrywaniem szacha i mata, zbitymi bierkami oraz turami przeciwnika prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/chess`, a potem wybierz przeciwnika i swoją stronę. Instalacja i usunięcie wymagają ponownego uruchomienia.

### Poker

Dodaje stół do gry Texas Hold'em dla dwóch do ośmiu graczy, z ciemnymi, rundami licytacji, pulami pobocznymi, rozstrzygnięciami rozdań i przeciwnikami prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/poker`, a potem wybierz graczy, początkową liczbę żetonów i ciemne. Instalacja i usunięcie wymagają ponownego uruchomienia.

### 8-Ball Pool

Dodaje stół bilardowy do gry we dwoje, z bilami pełnymi i pasiastymi, celowaniem i siłą uderzenia, faulami, bilą w ręce oraz uderzeniami przeciwnika prowadzonymi w roli.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/8ball`, a potem wybierz przeciwnika. Instalacja i usunięcie wymagają ponownego uruchomienia.

### Tic-Tac-Toe

Dodaje planszę do gry w kółko i krzyżyk we dwoje, z wybranym lub losowym znakiem, obsługą tur oraz wykrywaniem wygranej i remisu.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/tictactoe` (skrót `/ttt`), a potem wybierz przeciwnika i znak. Instalacja i usunięcie wymagają ponownego uruchomienia.

### Rock-Paper-Scissors

Dodaje pojedynek we dwoje, w którym oba wybory pozostają ukryte aż do odsłonięcia.

- **Integracja**: pakiet gry w trybie Conversation.
- **Gdzie działa**: Conversation.
- **Najważniejsze ustawienia**: uruchom grę z listy gier albo komendą `/rps`, a potem wybierz przeciwnika oraz pojedynek w wersji do trzech, pięciu albo siedmiu partii. Instalacja i usunięcie wymagają ponownego uruchomienia.

## Powiązane przewodniki

- [Agenci: pomocnicy AI](agents-overview.md)
- [Agent Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Konfiguracja Haptic Feedback](../integrations/haptic-feedback.md)
- [Źródła wiedzy](knowledge-sources.md)
- [Narrative Director i Secret Plot](../roleplay/narrative-director.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Gry stołowe w trybie Conversation](../conversation/table-games.md)
