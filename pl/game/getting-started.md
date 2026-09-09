# Game Mode: pierwsze kroki

Game Mode zmienia aplikację Marinara Engine w jednoosobową grę fabularną prowadzoną przez postać Game Master sterowaną przez AI. Z tego przewodnika dowiesz się, czym jest Game Mode i co trzeba przygotować przed startem. Dalej krok po kroku omawia kreator konfiguracji i pokazuje, gdzie znaleźć każdy element rozgrywki. Przeczytaj to raz, zacznij grę, a po szczegóły sięgnij do linków na końcu.

## Czym jest Game Mode

Game Mode to jeden z trybów czatu w aplikacji Marinara Engine. Pozostałe to Conversation i Roleplay.

W trybie Game Mode historię prowadzi postać Game Master (GM) sterowana przez AI, czyli mistrz gry. To AI opowiada o świecie, wciela się w każdą spotkaną postać i decyduje, co stanie się dalej. Działa jak Dungeon Master przy stole.

Aplikacja sama pilnuje stanu gry przez kolejne tury. Obejmuje to mapę, drużynę, postacie niezależne (NPC), przedmioty, zadania, czas w świecie gry i pogodę. Rozgrywka toczy się przez wiele tur. Długą grę da się podzielić na kilka **sesji**, tak jak drużyna przy stole dzieli kampanię na kolejne wieczory. Kampania to cała ciągnąca się historia.

Nie trzeba używać każdej mechaniki. Część graczy pomija walkę i kości, a Game Mode traktuje jako wizualną zabawę fabularną. Systemy RPG czekają wtedy, aż przyjdzie na nie ochota.

## Zanim zaczniesz

Do rozpoczęcia gry potrzebna jest tylko jedna rzecz: połączenie z dostawcą AI dla postaci GM. Dzięki połączeniu aplikacja Marinara Engine sięga do dostawcy AI i może generować tekst. Jeśli nie ma jeszcze żadnego połączenia, zajrzyj do przewodnika [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Cała reszta jest opcjonalna i domyślnie wyłączona. Te elementy można dodać później:

- **Generowanie obrazów.** Game Mode ma wizualny układ ekranu z tłami i grafikami postaci. Do jego wypełnienia potrzebne jest połączenie do generowania obrazów. Ustawienie **Visual Generation** (generowanie grafiki) w kreatorze jest domyślnie wyłączone, więc trzeba włączyć je samodzielnie. Bez niego nadal działa historia, śledzenie stanu i walka, ale obszary wizualne pozostają puste.
- **Model lokalny do efektów scenicznych.** Marinara Engine potrafi uruchomić mały model na twoim komputerze, opisany jako **Local Model (Gemma)**. Podpowiada on tła i muzykę bez dodatkowych kosztów. W kreatorze jest wyborem domyślnym. Zobacz [Konfiguracja modelu Local Model](../connections/local-model.md).
- **Agent Storyboard.** Zainstaluj go z **Agents > Download Agents**, a potem włącz w gotowej grze w panelu **Chat Settings > Agents** (ustawienia czatu), kiedy potrzebne są nieruchome albo animowane storyboardy.
- **Połączenie do generowania wideo.** Przydaje się wyłącznie przy filmach ze scen i animowanych storyboardach.
- **Muzyka.** Agent **Music DJ** potrafi puszczać muzykę w grze. Wymaga usługi Spotify albo lokalnego folderu z muzyką i jest domyślnie wyłączony.

## Kreator konfiguracji

Przy tworzeniu czatu w trybie Game Mode otwiera się **kreator konfiguracji**. Ma siedem kroków. Jedyne wymagane pole to połączenie dla postaci GM w pierwszym kroku. Każde inne pole ma rozsądną wartość domyślną. Przez kreator da się przejść szybko, a resztę uzupełni aplikacja Marinara Engine.

Siedem kroków wygląda tak:

1. **Connection.** Ustaw nazwę gry, wybierz połączenie dla postaci GM i opcjonalnie połączenie do efektów scenicznych. Efekty sceniczne domyślnie korzystają z opcji **Local Model (Gemma)**.
2. **World.** Ustaw gatunek, realia, ton, poziom trudności, klasyfikację treści i język.
3. **Party.** Wybierz personę (postać, w którą się wcielasz), tryb **Game Master Mode** oraz członków drużyny.
4. **Goals.** Powiedz postaci GM, czego oczekujesz od przygody.
5. **Lorebooks.** Podłącz lorebooki, których fakty postać GM ma traktować jako kanon. Lorebook to zbiór faktów o twoim świecie. Zobacz [Lorebooki](../lorebooks/overview.md).
6. **Features.** Włącz opcjonalne systemy, takie jak Visual Generation, Music DJ i widgety HUD. Agentów do zainstalowania da się włączyć w panelu Chat Settings po utworzeniu gry.
7. **GM.** Wybierz styl prezentacji i przejrzyj zaawansowane instrukcje dla postaci GM, zanim świat powstanie.

Na koniec kliknij przycisk **Start Game** (rozpoczęcie gry).

### Wartości domyślne, które warto znać

Oto wartości startowe w krokach **World**, **Party** i **Features**. Każdą z nich można zmienić.

| Ustawienie | Domyślnie | Uwagi |
|---|---|---|
| Genre | Fantasy | Wybór wielokrotny, można też dopisać własne wpisy |
| Tone | Heroic | Wybór wielokrotny |
| Difficulty | Normal | Casual, Normal, Hard lub Brutal; wyższe ustawienia zaostrzają walkę |
| Content Rating | SFW | SFW lub NSFW; NSFW tylko dopuszcza treści dla dorosłych, wcale ich nie wymusza |
| Language | English | W tym języku powstaje cały tekst w grze |
| Game Master Mode | Standalone GM | Standalone GM buduje postać GM za ciebie; Character GM robi postać GM z jednej z twoich kart |
| Visual Generation | Off | Włącz, aby mieć obrazy; wymaga połączenia do generowania obrazów |
| Game Presentation | Standard | **Storyboard Optimized** kształtuje narrację postaci GM promptem Storyboard Game Prompt; nie instaluje agenta Storyboard ani go nie włącza |
| Music DJ | Off | Wymaga usługi Spotify albo lokalnego folderu z muzyką |
| Custom HUD Widgets | On | Korzysta z widgetów stanu przygotowanych przez AI dla nowego świata |
| Start Muted | Off | Gra zaczyna się z wyciszonym dźwiękiem |

Pierwszy raz w trybie Game Mode? Zostaw opcję **Game Master Mode** na wartości **Standalone GM**. Marinara Engine zbuduje sprawiedliwą, lekko złośliwą postać GM, dzięki czemu można poznać tryb, zanim powstanie własna karta postaci GM.

W ostatnim kroku wybierz opcję **Storyboard Optimized**, jeśli tury postaci GM mają być pisane jak gotowe do sfilmowania sceny. Ta opcja wybiera do narracji postaci GM wbudowany preset **Storyboard Game Prompt**. Nie instaluje agenta Storyboard ani go nie włącza. Nie włącza też generowania obrazów ani wideo, nie zmienia wybranych połączeń i nie podmienia domyślnego planera ani formatera w agencie. Po utworzeniu gry zainstaluj i włącz agenta Storyboard osobno, a jego ustawienia klatek kluczowych, planera, obrazów i wideo skonfiguruj w **Chat Settings > Agents > Storyboards**.

Alternatywne zestawienie w stylu anime pozostaje dostępne po konfiguracji: wybierz **Anime Episode Director** dla planera animacji i **Anime Game Video** dla promptu wideo storyboardu.

Edytor **GM Prompt** pokazuje podgląd promptu obowiązującego dla wybranej prezentacji. Przy wybranej opcji **Storyboard Optimized** edytor wyświetla prompt Storyboard Game Prompt razem z makrem liczby klatek kluczowych. Nietknięty tekst oznacza, że nadal działa wbudowany preset. Edycja tworzy własny prompt, który zastępuje preset prezentacji.

## Trzy rodzaje zapytań do AI

Game Mode wysyła do AI trzy różne rodzaje zapytań. Ich znajomość pomaga zrozumieć, skąd biorą się koszty i błędy.

1. **Generowanie świata.** Dzieje się raz, po kliknięciu przycisku **Start Game**. Połączenie postaci GM zwraca jeden duży, uporządkowany dokument w formacie JSON. Ten dokument zawiera opis świata, mapę startową, postacie NPC, arkusze postaci twojej drużyny oraz widgety widoczne na ekranie. JSON to ścisły format tekstowy, który AI musi zwrócić bezbłędnie, inaczej gra go nie odczyta. To najbardziej wymagający krok i właśnie dlatego wybór modelu ma tu największe znaczenie.
2. **Tury rozgrywki.** Każda wysłana wiadomość buduje świeży prompt z aktualnym stanem gry. Potem postać GM opowiada dalszy ciąg i aktualizuje świat. Matematykę rund walki liczy sama aplikacja, a nie model, więc wyniki są uczciwe i spójne.
3. **Podsumowania sesji.** Po zakończeniu sesji postać GM pisze uporządkowane streszczenie i notatki o ciągłości. Na starcie nowej sesji powstaje krótka wiadomość pomostowa, żeby kolejny rozdział ruszył gładko. Starsze sesje są kompresowane do streszczeń, dzięki czemu długie kampanie nie przytłaczają modelu.

## Tryby adresowania: do kogo mówisz

Na pasku wpisywania, obok przycisku dołączania plików, jest mały przycisk z dymkiem. Jego podpowiedź brzmi **Choose who to address**. Ten przycisk decyduje o tym, do kogo trafia wiadomość, i ma trzy stany.

- Domyślnie wiadomość trafia do sceny. To zwykłe działanie w grze albo kwestia dialogowa. Postać GM i drużyna odpowiadają w ramach historii.
- Opcja **Talk to Party** dodaje znacznik `[To the party]` i kieruje wypowiedź wprost do towarzyszy. Użyj jej do rozmów taktycznych w stylu "What should we do here?". Ta opcja pojawia się tylko wtedy, gdy drużyna nie jest pusta.
- Opcja **Talk to GM** dodaje znacznik `[To the GM]` i zwraca się do postaci GM poza rolą. Użyj jej do pytań w rodzaju "Does my character know about the temple?" albo do próśb o zmianę tempa.

Aktywny tryb ma w menu znacznik **On**. Aby wyłączyć opcję **Talk to Party** albo **Talk to GM**, kliknij tę samą pozycję menu jeszcze raz. Wiadomości wracają wtedy do sceny.

## Opcjonalne planowanie narzędzi i wyszukiwanie w lorebookach

Podczas gry otwórz **Chat Settings → Function Calling** (ustawienia czatu → wywoływanie funkcji). Opcja **Let the GM search lore** (pozwól postaci GM przeszukiwać lorebooki) umożliwia wyszukiwanie informacji według znaczenia bez włączania wszystkich pozostałych narzędzi opcjonalnych. Najpierw włącz wektoryzację odpowiednich lorebooków i zwektoryzuj ich wpisy. Wyszukiwanie uwzględnia włączone książki, foldery i przełączniki wpisów dla danego czatu. Korzysta ze skonfigurowanego połączenia do embeddingów i może wymagać dodatkowego zapytania do modelu.

Ustawienie **Game tool connection** (połączenie dla narzędzi gry) ma domyślną wartość **Same as narrator** (takie samo jak narrator), która zachowuje zwykłą pętlę narzędzi. Wybór innego połączenia uruchamia jedno osobne zapytanie planujące przed narracją. Ten model wybiera narzędzia, a narrator otrzymuje ich rzeczywiste wyniki jako tekst. Koszt dodatkowego zapytania obciąża wybrane połączenie; tańszy model może obniżyć koszty narzędzi, lecz wybrać inne narzędzia. Ten pojedynczy przebieg planowania nie może uruchomić drugiego wyszukiwania na podstawie pierwszego wyniku. Użyj **Same as narrator**, jeśli narrator ma rozumować przez kilka rund narzędzi.

Połączenia subskrypcyjne Claude i Grok nie obsługują natywnych wywołań narzędzi. Odpowiednie kontrolki wyjaśniają to i są wyłączone, dopóki nie wybierzesz obsługiwanego połączenia narzędzi gry. Polecenia tekstowe i znaczniki kości nadal działają. Jeśli osobnego połączenia brakuje lub zapytanie do niego się nie powiedzie, tura zgłasza błąd zamiast po cichu kontynuować narrację bez żądanej pracy narzędzi.

## Włączanie agentów

Agenci to opcjonalni pomocnicy AI, którzy działają obok postaci GM. Aby użyć ich w grze, otwórz podczas rozgrywki panel **Chat Settings**, przejdź do sekcji **Agents** i włącz opcję **Enable Agents**. Działający agenci podnoszą koszty, bo wysyłają dodatkowe zapytania.

W trybie Game Mode warto znać dwóch agentów:

- **Game Session Keeper** pomaga utrzymać ciągłość między sesjami.
- **Music DJ** dobiera muzykę w tle. Wymaga usługi Spotify albo lokalnego folderu z muzyką.

Game Mode korzysta też z opcji **Review Agent Outputs**, dzięki czemu można sprawdzić, co wytworzył dany agent. Pełny obraz agentów znajdziesz w przewodniku [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Wybór modelu

Generowanie świata to najtrudniejsza część trybu Game Mode. Wymaga od modelu jednego długiego, ścisłego dokumentu JSON bez brakujących pól. Model, który świetnie radzi sobie ze zwykłym czatem, i tak może polec na tym kroku.

Do generowania świata użyj mocnego, aktualnego modelu z najwyższej półki na płatnym połączeniu. W 2026 roku gracze zgłaszają dobre wyniki z flagowych modeli największych dostawców. Przykłady to Anthropic Claude, OpenAI GPT i Google Gemini. Konkretne nazwy modeli zmieniają się często, więc traktuj je jako przykłady, a nie stałą listę.

Do bieżących tur rozgrywki czasem wystarcza tańszy model, bo tury wymagają narracji, a nie ścisłego formatu JSON. Jeśli postać GM zaczyna zapominać o postaciach NPC albo przeczyć wcześniejszym faktom, wróć do mocniejszego modelu.

Unikaj darmowych modeli i automatycznego doboru modelu przy generowaniu świata. Zapytanie może trafić do mniejszego modelu, który nie utworzy poprawnego formatu JSON dla świata. Małe modele z otwartymi wagami zwykle też nie dają rady na tym kroku.

Pełny opis parametrów znajdziesz w przewodniku [Parametry generowania](../prompts/generation-parameters.md).

## Gdzie szukać poszczególnych tematów

Ten przewodnik wprowadza do gry. Każdy głębszy temat ma własny przewodnik:

- [Game Mode: walka](combat.md) omawia starcia, menu akcji, obliczanie obrażeń i wydarzenia na czas.
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md) omawia pasek drużyny, arkusze postaci i Adventure Journal.
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md) omawia kończenie i rozpoczynanie sesji oraz historię sesji.
- [Game Mode: mapa, czas i pogoda](map-time-weather.md) omawia widoki mapy oraz automatyczny zegar i pogodę.
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md) omawia menu kości i zasady testów umiejętności.
- [Game Mode: widgety HUD](hud-widgets.md) omawia widgety stanu widoczne na ekranie.
- [Zasoby gry](game-assets.md) omawia bibliotekę muzyki, dźwięków, sprite'ów i teł.
- [Przewodnik po agencie Storyboard](storyboard.md) omawia instalację oraz storyboardy w trybach Roleplay i Game Mode.

Pole **Author's Notes** (notatki autora) działa tu tak samo jak w pozostałych trybach. Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md).

## Rozwiązywanie problemów

### Generowanie świata kończy się błędem formatu JSON albo błędem 422

Najczęstsza przyczyna: model nie zdołał utworzyć kompletnego dokumentu JSON. Wypróbuj kolejno te kroki.

1. Sprawdź, z jakiego połączenia korzysta postać GM. Jeśli wskazuje ono na model darmowy albo dobierany automatycznie, przełącz się na mocny model płatny.
2. Spróbuj jeszcze raz. Część błędów zdarza się jednorazowo, a ta sama konfiguracja działa za drugim podejściem.
3. Skróć bardzo długie pole realiów albo preferencji. Długie dane wejściowe zostawiają modelowi mniej miejsca na wynik w formacie JSON.

Jeśli zapytanie prawie się udało, a format JSON jest tylko lekko popsuty, Marinara Engine proponuje okno **Repair JSON** (naprawa formatu JSON). Otwiera się edytor z numerami linii i surowym wynikiem modelu. Linia stanu mówi, czy JSON jest poprawny, albo pokazuje błąd odczytu. Kliknij przycisk **Format**, aby uporządkować poprawny JSON. Potem kliknij przycisk **Apply Repaired JSON**, aby użyć poprawionej wersji bez płacenia za pełne ponowienie. Opcja **Repair JSON** pojawia się także przy podsumowaniach sesji i innych uporządkowanych zapytaniach.

Więcej objawów i sposobów naprawy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

### Postać GM opowiada pogodnie mimo wybranego mrocznego tonu

Część modeli trzyma radosny ton niezależnie od ustawień. Są dwa wyjścia. Dopisz wyraźną instrukcję w polu preferencji w kreatorze, na przykład "keep narration grim, do not soften failures". Albo przełącz się na model, którego domyślny głos pasuje do wybranego tonu.

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: sesje i zapisy gry](sessions-and-saves.md)
- [Game Mode: mapa, czas i pogoda](map-time-weather.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
- [Game Mode: widgety HUD](hud-widgets.md)
- [Zasoby gry](game-assets.md)
- [Przewodnik po agencie Storyboard](storyboard.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Parametry generowania](../prompts/generation-parameters.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
