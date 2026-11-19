# Game Mode: pierwsze kroki

Game Mode zmienia aplikację Marinara Engine w jednoosobową grę fabularną prowadzoną przez postać Game Master sterowaną przez AI. Z tego przewodnika dowiesz się, jak rozpocząć grę, rozegrać pierwszą turę i znaleźć kontrolki.

Game Mode to jeden z trzech trybów czatu (Conversation, Roleplay i Game Mode). Game Master (GM), czyli mistrz gry, to AI, które opowiada o świecie, wciela się w każdą spotkaną postać i decyduje, co stanie się dalej, jak Dungeon Master w grze przy stole. Marinara śledzi mapę, twoją drużynę, postacie niezależne (NPC), przedmioty, zadania, czas w świecie gry i pogodę. Długą grę da się podzielić na kilka **sesji**, jak wieczory z grą w ramach jednej kampanii.

Nie trzeba używać każdej mechaniki. Możesz pominąć walkę i kości i grać dla samej historii.

## Zanim zaczniesz

Potrzebna jest jedna rzecz: konto AI dla postaci GM. Jeśli nie masz jeszcze żadnego konta, zajrzyj do przewodnika [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Cała reszta jest opcjonalna i domyślnie wyłączona. Możesz dodać ją później:

- **Obrazy.** Agent **Illustrator** rysuje portrety postaci NPC, tła miejsc i obrazy scen. Pobierz go z **Agents → Agent Organizer** (agenci, organizowanie agentów). Wymaga konta do generowania obrazów. Bez niego nadal działa historia, śledzenie stanu i walka, ale obszary wizualne pozostają puste.
- **Efekty sceniczne z modelu wbudowanego.** Marinara może uruchomić mały model na twoim komputerze, który bez kosztów wybiera tła i muzykę. Po pobraniu staje się domyślną wartością pola **Scene effects model** (model efektów scen). Do tego czasu wartość domyślna to **Skip - use inline tags from GM** (pominięcie, użycie znaczników z tekstu GM). Zobacz [Konfiguracja modelu wbudowanego](../connections/local-model.md).
- **Storyboardy.** Pobierz agenta Storyboard, a potem włącz go dla gry. Zobacz [Przewodnik po agencie Storyboard](storyboard.md).
- **Wideo.** Konto do generowania wideo jest potrzebne tylko do filmów ze scen albo animowanych storyboardów.
- **Muzyka.** Agent **Music DJ** odtwarza muzykę z usługi Spotify albo z lokalnego folderu z muzyką.

## Rozpoczynanie gry

1. Na pasku bocznym czatów otwórz zakładkę **GM** i kliknij przycisk **+** o etykiecie **New Game** (nowa gra). Możesz też kliknąć **Game** (gra) na ekranie głównym. Otworzy się kreator konfiguracji. Zobacz [Zarządzanie listą czatów](../chats/managing-chats.md).
2. W pierwszym kroku wybierz **Model**, który obsługuje postać GM. Wybierz jedno z wcześniej dodanych kont. Jeśli lista jest pusta, najpierw dodaj konto. Do generowania świata wybierz mocny płatny model (zobacz [Wybór modelu](#choosing-a-model)).
3. W każdym kroku klikaj **Next** (dalej). Każde inne pole ma wartość domyślną, więc możesz po prostu przejść przez kreator.
4. W ostatnim kroku kliknij **Create world** (utworzenie świata). Podczas budowania świata przycisk pokazuje **Generating World…** (generowanie świata). To jedno duże zapytanie do twojego modelu, więc poczekaj, aż się zakończy.
5. Gdy świat jest gotowy, ekran gry pokazuje **Start Game** (rozpoczęcie gry). Kliknij ten przycisk. Postać GM pisze wtedy pierwszą wiadomość.

Gdy własne widgety HUD są włączone (domyślnie tak jest), pod przyciskiem **Start Game** znajduje się przycisk **Review Starting Widgets** (przegląd widgetów początkowych). Możesz go pominąć albo najpierw zmienić w nim widgety startowe. Zobacz [Game Mode: widgety HUD](hud-widgets.md).

> **Wskazówka:** Jeśli dopiero poznajesz Game Mode, zostaw opcję **Game Master Mode** (tryb mistrza gry) na wartości **Standalone GM** (samodzielny GM). Marinara zbuduje dla ciebie złośliwego narratora.

Jeśli coś nie zadziałało, zajrzyj do sekcji [Generowanie świata kończy się błędem formatu JSON albo błędem 422](#world-generation-fails-with-a-json-or-422-error).

### Kreator konfiguracji

| Krok | Co ustawiasz |
| --- | --- |
| **Connection** (połączenie) | **Game Name** (nazwa gry), **Model**, który obsługuje postać GM, oraz opcjonalny **Scene effects model**. Karta **Game Mode** pokazuje na razie tylko **VN**. |
| **World** (świat) | Gatunek, realia, ton, poziom trudności, klasyfikacja treści, styl historii, przemoc, granice treści i język. **Combat Preference** (preferowany rodzaj walki) to **Turn-Based** albo **Tactical**. Każda nowa gra korzysta z klas **MRPG** (Marinara RPG) (zobacz [Klasy MRPG](mrpg-classes.md)). Gdy jest zainstalowany zestaw zasad, pojawia się wybór **Rules** (zasady) (zobacz [Wybór zasad](#choose-rules)). |
| **Party** (drużyna) | Twoja persona (postać, w którą się wcielasz), **Game Master Mode**, członkowie drużyny i **GM intro message** (wiadomość otwierająca GM; zobacz [Wiadomość otwierająca GM](#the-gm-intro-message)). Początkowe drzewko MRPG każdego członka wynika z sekcji **Game Mode** na jego karcie (zobacz [Wybieranie drzewek postaci](mrpg-classes.md#choose-a-characters-trees)). |
| **Goals** (cele) | Czego oczekujesz od przygody. |
| **Lorebooks** (lorebooki) | Lorebooki, które postać GM traktuje jako kanon. Lorebook to zbiór faktów o świecie w tle. Zobacz [Lorebooki](../lorebooks/overview.md). |
| **Features** (funkcje) | **Enable Agents** (włączenie agentów), a pod nim karta każdego pobranego agenta (**Illustrator**, **Music DJ**, **Lorebook Keeper**), a także **Custom HUD Widgets** (własne widgety HUD), **Quick Time Events** (wydarzenia na czas) i **Start Muted** (start z wyciszonym dźwiękiem). |
| **GM** | Styl prezentacji i **GM Prompt** (prompt GM). |

Pomysły podsuwane przy realiach i celach zmieniają się przy każdym otwarciu kreatora. W grze Tactical postać GM pisze krótki opis każdej walki, a Marinara buduje na jego podstawie planszę. Zobacz [Game Mode: walka](combat.md#tactical-battles-and-terrain).

Krok **World** ma też opcje walki z bossami. **GM directs bosses** (GM steruje bossami) jest domyślnie włączone. Pozwala postaci GM decydować o turach bossów przez twoje połączenie GM, co może chwilę potrwać. Zwykli przeciwnicy decydują sami, chyba że **GM directs bosses** jest włączone, a zestaw zasad gry oddaje stronę przeciwników postaci Game Master (zobacz [Tekst Game Master](../extending/ruleset-sheets.md#game-master-text)). Gdy **GM directs bosses** jest włączone, opcja **Game Master also plays named and brilliant opponents** (Game Master prowadzi też nazwanych i błyskotliwych przeciwników; domyślnie włączona) pozwala postaci GM wcielać się także w postacie z imieniem i bardzo sprytnych wrogów. Dwie kolejne opcje są widoczne zawsze: **Companions fight on their own** (towarzysze walczą samodzielnie; domyślnie włączona – wyłącz ją, żeby samodzielnie kierować całą drużyną) oraz **Let cruel opponents strike the fallen** (okrutni przeciwnicy mogą atakować powalonych; domyślnie wyłączona). Nowa gra oferuje też opcję **Permadeath** (trwała śmierć; domyślnie wyłączona): członek drużyny, który padnie w walce i nie zostanie uratowany przed jej końcem, przepada na zawsze. Zobacz [Game Mode: walka](combat.md).

Gdy agent **Hierarchical Maps** jest pobrany (teraz nazywa się World Maps, zobacz [World Maps](../agents/hierarchical-maps.md)), a **Enable Agents** jest włączone, krok **Features** może też przygotować szkic mapy **Hierarchical world map** (hierarchiczna mapa świata), użyć zapisanego szablonu mapy albo podłączyć udostępniony świat.

### Wartości domyślne, które warto znać

| Ustawienie | Domyślnie | Uwagi |
| --- | --- | --- |
| Genre | Fantasy | Można wybrać kilka, a także dopisać własne. |
| Tone | Heroic | Można wybrać kilka. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** albo **Brutal**. Wyższe ustawienia utrudniają walki: w grze MRPG dodają liczniejszych i silniejszych przeciwników (zobacz [Walki w grze MRPG](combat.md#battles-in-an-mrpg-game)), a w grze Legacy zwiększają obrażenia zadawane przez wrogów (zobacz [Skalowanie trudności](combat.md#difficulty-scaling)). |
| Content Rating (sexual content) (Kategoria treści (treści seksualne)) | SFW | **SFW** albo **NSFW**. Dotyczy wyłącznie treści seksualnych. NSFW dopuszcza je, ale ich nie wymusza. |
| Story style (Styl historii) | Standard (Standardowy) | **Gentle** (Łagodny) oznacza mniej stresującą grę prowadzoną przez GM. Zobacz [Styl historii, przemoc i granice treści](#story-style-violence-and-content-boundaries). |
| Violence (Przemoc) | Serious (Poważna, SFW) albo Graphic (Dosłowna, NSFW) | **Mild** (Łagodna), **Serious** albo **Graphic**. Ustawiana niezależnie od kategorii treści. |
| Content boundaries (Granice treści) | Brak | Tematy, które GM pomija w historii. |
| Language | English | W tym języku powstaje cały tekst w grze. |
| Game Master Mode | Standalone GM | **Character GM** (GM z karty postaci) używa jednej z twoich kart postaci jako postaci GM. |
| Scene effects model | Built-in model | Dopiero po jego pobraniu. Do tego czasu wartość domyślna to **Skip - use inline tags from GM**. |
| Enable Agents | Off | Włącz, żeby zobaczyć karty agentów. |
| Illustrator | Off | Wymaga agenta Illustrator i konta do generowania obrazów. |
| Music DJ | Off | Wymaga usługi Spotify albo lokalnego folderu z muzyką. |
| Custom HUD Widgets | On | Model projektuje widgety stanu dla nowego świata. |
| Quick Time Events | On | Wyłącz do gry z czytnikiem ekranu albo bez limitów czasu. |
| Start Muted | Off | Gra zaczyna się z wyciszonym całym dźwiękiem. |
| Game Presentation | Standard | Zobacz niżej. |

### Styl historii, przemoc i granice treści

Krok **World** zawiera cztery ustawienia, które określają, co może się pojawić w historii i jak mocno będzie oddziaływać. Znajdują się razem pod **Content Rating (sexual content)**. Po rozpoczęciu gry możesz zmienić je wszystkie poza kategorią treści. Zobacz [Zmiana ustawień podczas gry](#change-them-during-a-game).

| Ustawienie | O czym decyduje |
| --- | --- |
| **Content Rating (sexual content)** | **SFW**: romans i czułość, a sceny seksu kończą się przed pokazaniem szczegółów. **NSFW**: sceny seksu mogą być opisywane dosłownie. Nie decyduje o niczym innym. |
| **Story style** | **Standard**: błędy i pech mają rzeczywiste konsekwencje. **Gentle**: prawdziwe wyzwania, ale niepowodzenia nie prowadzą do karania ani traumy. |
| **Violence** | **Mild**, **Serious** albo **Graphic**: sposób pokazywania przemocy. Początkowo ustawiona na **Serious** dla SFW i **Graphic** dla NSFW, zgodnie z dotychczasowym znaczeniem tych kategorii. |
| **Content boundaries** | Tematy, których nigdy nie chcesz w historii, po jednym w wierszu, na przykład `harm to animals`. |

#### Łagodny styl historii

Wybierz **Gentle**, jeśli chcesz cieszyć się historią i jej postaciami, a GM nie ma karać za każde potknięcie. W stylu **Gentle**:

- Niepowodzenia kosztują czas, reputację, zasoby albo wymagają obrania okrężnej drogi. GM nie odpowiada na nie obrażeniami, upokorzeniem, utratą kogoś bliskiego ani traumą, ku której nie kierujesz historii.
- GM prosi o test umiejętności tylko wtedy, gdy znaczenie mają umiejętności lub wybory twojej postaci. Nigdy nie wykonuje rzutu dotyczącego czegoś, na co postać nie ma wpływu, na przykład niepełnosprawności, choroby, jej ciała lub pochodzenia. Zobacz [Testy umiejętności w łagodnej grze](dice-and-skill-checks.md#skill-checks-in-a-gentle-game).
- Świat jest planowany z ciepłem: wątki wyrastają z nadziei i relacji w równym stopniu co z ran, a zwroty akcji zaskakują, zamiast zdradzać twoje zaufanie.

**Gentle** zastępuje tylko wbudowane instrukcje GM. Jeśli masz własny **GM Prompt**, GM zachowuje twój tekst. Walka, obrażenia i ustawienie poziomu trudności działają tak samo w obu stylach.

#### Granice treści

Wpisz jeden temat w wierszu, maksymalnie 40 tematów i łącznie 2 000 znaków. Wszystko ponad którykolwiek z limitów jest pomijane. GM traktuje każdy temat jako nieprzekraczalną granicę, ważniejszą od kategorii treści, tonu, osobowości dowolnej postaci i fabuły. Nie porusza tych tematów, nie używa ich jako groźby, zwrotu akcji ani historii postaci i nie nawiązuje do nich pośrednio. Jeśli samodzielnie poruszysz taki temat, GM ogranicza go do krótkiej wzmianki i przechodzi dalej. Granice działają w obu stylach historii i przy obu kategoriach treści, a twoje własne wytyczne kategorii treści nie mogą ich znieść.

> **Uwaga:** Historię pisze model AI, więc Marinara nie może zagwarantować, że wymieniony temat nigdy się nie pojawi. Jeśli się pojawi, użyj swipe'a albo edytuj odpowiedź.

#### Edycja wytycznych kategorii treści

Pod przyciskami kategorii treści rozwiń **Edit rating guidelines** (Edytuj wytyczne kategorii treści), aby zobaczyć tekst przekazywany GM dla wybranej kategorii treści, przemocy i stylu historii. Edytuj go, aby ustalić własne zasady dotyczące treści w tej grze, albo kliknij **Reset to default** (Przywróć domyślne), aby wrócić do wbudowanego tekstu. Dopóki pozostawiasz go bez zmian, dostosowuje się do wybranej kategorii treści, przemocy i stylu.

#### Zmiana ustawień podczas gry

Otwórz **Chat Settings → Prompt Preset** (ustawienia czatu, preset promptu). W grze ta sekcja zawiera też **Story style**, **Violence**, **Content boundaries** i **Rating guidelines** (Wytyczne kategorii treści). Zmiany obowiązują od następnej tury. Sama kategoria treści jest ustalona na stałe przy tworzeniu gry.

Preset promptu może też zawierać styl historii, poziom przemocy i granice, aby można było używać ich w każdej grze. Zobacz [Ustawienia historii gry](../prompts/presets.md#game-story-settings).

<a id="choose-rules"></a>

### Wybór zasad

Opcja **Rules** pojawia się tylko przy nowej grze i tylko wtedy, gdy zainstalowano co najmniej jeden zestaw zasad. Domyślna opcja to **Marinara's own rules** (własne zasady aplikacji Marinara): wbudowane testy d20 i arkusz postaci z sześcioma atrybutami. Zestaw zasad, na przykład **5e (SRD 5.1)**, zastępuje je testami i arkuszem postaci danego systemu gier fabularnych, a walki też może rozstrzygać według własnych zasad. Kreator pokazuje, co obejmuje każdy zestaw zasad. Po utworzeniu gry wyboru nie da się zmienić. Zobacz [Game Mode: gra z zestawem zasad](rulesets.md).

<a id="the-gm-intro-message"></a>

### Wiadomość otwierająca GM

Pole **GM intro message** (w kroku **Party**) decyduje o tym, jak zaczyna się gra:

- **None** (brak, wartość domyślna): postać GM otwiera grę tak, jak uzna za stosowne.
- **Defined** (określona): wpisz pierwszą wiadomość dokładnie tak, jak ma brzmieć. Gra zaczyna się od tego tekstu, a ponowne wygenerowanie daje ten sam tekst.
- **Guided** (z przewodnikiem): opisz, jak ma wyglądać początek, na przykład gdzie się zaczyna i kto tam jest. Postać GM pisze otwarcie na tej podstawie.

Tekst może mieć do 8 000 znaków. Nie może zawierać podwójnych nawiasów klamrowych, a tekst **Guided** nie może też zawierać nawiasów kwadratowych. Pole informuje, gdy tekstu nie da się użyć. Fabuła świata może ustalić własne wprowadzenie. Pole pokazuje je wtedy jako zablokowane i nie da się go zmienić.

### Prezentacja Storyboard Optimized

W kroku **GM** opcja **Game Presentation** (prezentacja gry) może mieć wartość **Standard** albo **Storyboard Optimized** (zoptymalizowana pod storyboard). **Storyboard Optimized** korzysta z promptu Storyboard Game Prompt, który kształtuje tury postaci GM w wizualne momenty gotowe do sfilmowania. Nie pobiera ani nie włącza agenta Storyboard, nie włącza generowania obrazów ani wideo i nie zmienia twoich kont. Po utworzeniu gry skonfiguruj to w **Chat Settings → Agents → Storyboards** (ustawienia czatu, agenci, storyboardy).

Edytor **GM Prompt** pokazuje podgląd promptu dla wybranej prezentacji. Jeśli zostawisz tekst bez zmian, nadal wybrany jest wbudowany preset. Jeśli go edytujesz, twój tekst zastępuje preset.

Alternatywne jednoujęciowe zestawienie w stylu anime pozostaje dostępne po konfiguracji: wybierz **Anime Episode Director** dla planera Animation Planner i **Anime Game Video** dla promptu Storyboard Video Prompt.

## Rozgrywanie pierwszej tury

Wpisz, co robi albo mówi twoja postać, i wyślij wiadomość. Postać GM odpowiada, aktualizuje świat i może poprosić o rzut kością albo rozpocząć walkę.

Przycisk z dymkiem obok przycisku dołączania plików, z podpowiedzią **Choose who to address** (wybór adresata), ustala, do kogo trafia twoja wiadomość:

| Tryb | Co robi |
| --- | --- |
| Domyślny | Wiadomość trafia do sceny jako działanie albo kwestia dialogowa. Postać GM i drużyna odpowiadają w ramach historii. |
| **Talk to Party** (rozmowa z drużyną) | Dodaje znacznik `[To the party]` i kieruje wypowiedź do towarzyszy. Widoczny tylko wtedy, gdy drużyna nie jest pusta. |
| **Talk to GM** (rozmowa z GM) | Dodaje znacznik `[To the GM]` i zadaje pytanie postaci GM poza rolą, na przykład "Czy moja postać wie o świątyni?". |

Aktywny tryb ma w menu oznaczenie **On** (włączony). Kliknij tę samą pozycję jeszcze raz, żeby go wyłączyć.

<a id="the-games-controls"></a>

## Kontrolki gry

Na komputerze kontrolki otwierają się przyciskami blisko prawego górnego rogu czatu. Na telefonie znajdziesz je w ruchomym menu **Chat tools** (narzędzia czatu) z trzema kropkami.

| Kontrolka | Co zawiera |
| --- | --- |
| **Game controls** (Kontrolki gry, ikona kontrolera do gier) | **Retry turn**, **Retry scene analysis**, **Retry Music DJ** (gdy Music DJ odtwarza muzykę) i **Retry assets image generation**. Przy tle ze storyboardu także ponowne odtwarzanie, odtwarzanie/pauza i wyciszenie. **Edit game data** (edycja danych gry) pozwala ręcznie poprawić zapisane dane (zobacz [Ręczna edycja danych gry](sessions-and-saves. md#editing-game-data-by-hand)). **Checkpoints** (punkty kontrolne) cofa grę do wcześniejszego momentu (zobacz [Jak gra zapisuje postępy](sessions-and-saves. md#how-your-game-saves)). |
| **Session** (sesja, ikona pióra) | Historia sesji, dziennik i kontrolki sesji. Zobacz [Game Mode: sesje i zapisy gry](sessions-and-saves.md). |
| **Volume** (głośność, ikona głośnika) | Głośność **Master**, **Music**, **Sound Effects**, **TTS** i **Ambient**. |
| **Game Assets** (zasoby gry, ikona folderu) | Multimedia sceny i Asset Browser. Zobacz [Zasoby gry](game-assets.md). |
| **Connected chat** (połączony czat) | Widoczna, gdy gra jest połączona z czatem Conversation. Zobacz [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md#switching-between-connected-chats). |

Wybierz narzędzie, żeby otworzyć je w ruchomym oknie na komputerze albo w panelu na całą szerokość ekranu na telefonie. Na komputerze przeciągnij przycisk narzędzia, żeby go przenieść. Na telefonie przesuń menu z trzema kropkami albo je odblokuj, żeby zmienić kolejność narzędzi w środku. Zobacz [Okna narzędzi i ich przyciski](../chats/chat-settings.md#control-windows-and-their-buttons).

Kontrolkę możesz też trzymać wewnątrz **Chat Settings**. Otwórz okno kontrolki i wybierz **Put back in Chat Settings** (przeniesienie do Chat Settings). Pojawi się tam jako rozwijana sekcja, a jej przycisk wydzielenia znów zmieni ją w okno. Każda gra zapisuje twój wybór. **Reset View** (przywrócenie widoku) przywraca początkowy układ.

**Character Profiles** (profile postaci) zostaje poza menu Chat tools zarówno na komputerze, jak i na telefonie. Przeciągnij przycisk z portretem w wybrane miejsce, a potem otwórz go, żeby wybrać członka drużyny i obejrzeć albo edytować jego arkusz postaci. Na telefonach **Map** (mapa) też ma własny ruchomy przycisk. Oba przyciski korzystają z twojego stylu widgetów czatu, zapisują swoje położenie dla tej gry i można je zablokować z poziomu otwartego okna.

<a id="choosing-a-model"></a>

## Wybór modelu

Generowanie świata to najtrudniejsza część trybu Game Mode. Wymaga od modelu jednego długiego, ścisłego dokumentu JSON (formatu tekstowego, który musi być bezbłędny, inaczej gra go nie odczyta) bez brakujących pól. Model, który dobrze radzi sobie z czatem, i tak może polec na tym kroku.

- Do generowania świata użyj mocnego, aktualnego modelu z najwyższej półki na płatnym koncie. W 2026 roku gracze zgłaszają dobre wyniki z flagowych modeli największych dostawców, takich jak Anthropic Claude, OpenAI GPT i Google Gemini. Nazwy modeli często się zmieniają, więc traktuj je jako przykłady, a nie stałą listę.
- Najtańsze polecane przez nas modele, oba przetestowane w rozgrywce na dzień 31 października 2026 roku, to DeepSeek V4 Flash i Claude Haiku 5.5.
- Do późniejszych tur czasem wystarcza tańszy model, bo tury wymagają narracji, a nie ścisłego formatu JSON. Jeśli postać GM zapomina o postaciach NPC albo przeczy wcześniejszym szczegółom, wróć do mocniejszego modelu.
- Unikaj darmowych modeli i automatycznego doboru modelu przy generowaniu świata. Zapytanie może trafić do małego modelu, który nie utworzy poprawnego formatu JSON. Małe modele z otwartymi wagami zwykle też zawodzą.

Pełny opis parametrów znajdziesz w przewodniku [Parametry generowania](../prompts/generation-parameters.md).

## Ile kosztuje tura

Game Mode wysyła do AI trzy rodzaje zapytań:

1. **Generowanie świata.** Raz, po kliknięciu **Start Game**. Jedno duże zapytanie, które zwraca opis świata, mapę startową, postacie NPC, arkusze postaci drużyny i widgety.
2. **Tury rozgrywki.** Każda wiadomość buduje świeży prompt z aktualnym stanem gry. Postać GM opowiada dalszy ciąg i aktualizuje świat. Matematykę rund walki liczy silnik, a nie model, więc wyniki są uczciwe.
3. **Podsumowania sesji.** Po zakończeniu sesji postać GM pisze streszczenie i notatki o ciągłości. Na starcie następnej sesji pisze krótką wiadomość pomostową. Starsze sesje są kompresowane do streszczeń, dzięki czemu długie kampanie mieszczą się w tym, co model może przyjąć.

<a id="optional-tool-planning-and-lore-searches"></a>

## Opcjonalne planowanie narzędzi i wyszukiwanie w lorebookach

Podczas gry otwórz **Chat Settings → Function Calling** (ustawienia czatu, wywoływanie funkcji).

- **Let the GM search lore** (pozwól postaci GM przeszukiwać lorebooki) pozwala postaci GM wyszukiwać fakty z lorebooków według znaczenia. Najpierw włącz wektoryzację lorebooków i zwektoryzuj ich wpisy. Wyszukiwanie uwzględnia włączone lorebooki, foldery i przełączniki wpisów dla danego czatu. Korzysta z twojego konta do embeddingów i może dodać zapytanie do modelu. W czatach Game wyszukiwanie w lorebookach wymaga tego przełącznika, nawet gdy **Enable Tool Use** (zezwolenie na korzystanie z narzędzi) jest włączone. Przy wyłączonym przełączniku `search_lorebook` jest niedostępne w selektorze narzędzi.
- **Game tool provider** (dostawca narzędzi gry) ma domyślną wartość **Same as narrator** (takie samo jak narrator), która zachowuje zwykłą pętlę narzędzi (do czterech rund narzędzi na turę). Wybór innego konta uruchamia jedno osobne zapytanie planujące przed narracją. Ten model wybiera narzędzia, a narrator otrzymuje ich wyniki jako tekst. Kosztuje to jedno dodatkowe zapytanie na turę na tym koncie. Tańszy model może obniżyć koszt, ale może wybrać inne narzędzia. Jeden przebieg planowania nie może po pierwszym wyszukiwaniu uruchomić kolejnego.
- **Finish rolled turns in one request** (kończenie tur z rzutami jednym żądaniem) jest domyślnie włączone i oszczędza jedno zapytanie w turach z rzutem kośćmi. Zobacz [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Konta subskrypcyjne Claude i Grok nie obsługują natywnych wywołań narzędzi. Kontrolki to wyjaśniają i pozostają wyłączone, dopóki nie wybierzesz obsługiwanego dostawcy w polu **Game tool provider**. Polecenia tekstowe i znaczniki kości nadal działają. Jeśli osobnego konta brakuje albo jego zapytanie się nie powiedzie, tura zgłasza błąd zamiast prowadzić narrację bez pracy narzędzi.

Jeśli lokalne modele współdzielą ograniczoną pamięć GPU, otwórz **Chat Settings → Agents** (ustawienia czatu, agenci) i włącz **Run Game tasks one at a time** (wykonuj zadania Game pojedynczo). Narracja, agenci i multimedia sceny czekają wtedy na siebie w obrębie tego czatu Game. Opcja jest domyślnie wyłączona i nie rezerwuje GPU względem innych czatów ani aplikacji.

## Włączanie agentów

Agenci to opcjonalni pomocnicy AI, którzy działają obok postaci GM. Wysyłają dodatkowe zapytania, więc podnoszą koszty. Aby ich użyć, otwórz podczas gry **Chat Settings → Agents** i włącz **Enable Agents**. W trybie Game Mode przydają się dwaj:

- **Game Session Keeper** pomaga utrzymać ciągłość między sesjami.
- **Music DJ** dobiera muzykę w tle.

**Review Agent Outputs** (przeglądanie wyników agentów) pozwala sprawdzić, co wytworzył agent. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Rozwiązywanie problemów

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### Generowanie świata kończy się błędem formatu JSON albo błędem 422

Najpewniej model nie zdołał utworzyć kompletnego dokumentu JSON. Wypróbuj kolejno te kroki.

1. Sprawdź, z jakiego modelu korzysta postać GM. Jeśli to model darmowy albo dobierany automatycznie, przełącz się na mocny model płatny.
2. Spróbuj jeszcze raz. Część błędów zdarza się jednorazowo.
3. Skróć długie pole realiów albo preferencji. Długie dane wejściowe zostawiają mniej miejsca na JSON.

Jeśli zapytanie prawie się udało, Marinara proponuje okno dialogowe **Repair JSON** (naprawa formatu JSON) z surowym wynikiem modelu w edytorze z numerami linii. Linia stanu mówi, czy JSON jest poprawny, albo pokazuje błąd odczytu. Kliknij **Format** (formatowanie), żeby uporządkować poprawny JSON, a potem **Apply Repaired JSON** (zastosowanie naprawionego JSON), żeby użyć poprawki bez płacenia za ponowienie. Okno **Repair JSON** pojawia się też przy podsumowaniach sesji i innych uporządkowanych zapytaniach. Więcej sposobów naprawy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

### Postać GM opowiada pogodnie mimo wybranego mrocznego tonu

Sprawdź, czy ustawienie **Story style** gry ma wartość **Standard**: **Gentle** celowo łagodzi niepowodzenia (zobacz [Łagodny styl historii](#the-gentle-story-style)). Część modeli pozostaje radosna. Dopisz wyraźną instrukcję w polu preferencji w kreatorze, na przykład "utrzymuj ponury ton narracji, nie łagodź porażek". Albo przełącz się na model, którego domyślny głos pasuje do tonu.

### Model odmawia napisania tury

Powiadomienie **The model declined this request** informuje, że model odmówił napisania tury. Niektóre modele odmawiają z powodu konkretnych sformułowań w wytycznych kategorii treści gry, presecie lub karcie postaci. Spróbuj kolejno:

1. Ponów turę. Niektóre odmowy zdarzają się tylko raz.
2. Jeśli wytyczne kategorii treści zostały zmienione, otwórz **Chat Settings → Prompt Preset** i przywróć w **Rating guidelines** wbudowany tekst.
3. Wypróbuj w tej grze inny model.

## Gdzie szukać poszczególnych tematów

- [Game Mode: walka](combat.md): starcia, menu akcji, obliczanie obrażeń i wydarzenia na czas.
- [Game Mode: klasy MRPG](mrpg-classes.md): wybieranie klas, statystyki, poziomy i awanse klas, arkusz klas, gry współdzielone oraz przenoszenie gry Legacy.
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md): Character Profiles, arkusze postaci i Adventure Journal.
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md): kończenie i rozpoczynanie sesji, historia i punkty kontrolne.
- [Game Mode: mapa, czas i pogoda](map-time-weather.md): widoki mapy, zegar, pogoda i morale.
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md): menu kości i zasady testów umiejętności.
- [Game Mode: widgety HUD](hud-widgets.md): widgety stanu widoczne na ekranie.
- [Zasoby gry](game-assets.md): biblioteka muzyki, dźwięków, sprite'ów i teł.
- [Przewodnik po agencie Storyboard](storyboard.md): storyboardy w trybach Game Mode i Roleplay.
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md): funkcja Author's Notes (notatki autora) działa tu tak samo.
