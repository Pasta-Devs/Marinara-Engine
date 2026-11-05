# Wpisy lorebooka: słowa kluczowe, pozycja i czas działania

Wpis to jeden fakt w lorebooku plus reguły, które decydują o tym, kiedy Marinara dodaje go do promptu (prompt to tekst, który Marinara wysyła do AI). Ten przewodnik opisuje dodawanie wpisów, wybór słów kluczowych i typów wpisów, ustalanie miejsca, w którym wpis ląduje, oraz czas działania.

Zanim zaczniesz: utwórz lorebook i go otwórz. Zobacz [Lorebooki – przegląd](overview.md).

## Zakładka Entries

Otwórz lorebook z panelu **Lorebooks**. Edytor ma dwie zakładki: **Overview** (przegląd) i **Entries** (wpisy). Kliknij **Entries**, żeby zobaczyć listę. Plakietka na zakładce pokazuje, ile masz wpisów.

Pasek narzędzi zawiera te kontrolki.

- Pole **Search entries…** filtruje wpisy po nazwie, słowach kluczowych lub treści.
- Menu sortowania oferuje opcje **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** i **Oldest**. Opcje ze strzałką ↓ sortują od najwyższej do najniższej wartości.
- **Select** (zaznaczanie) włącza wielokrotny wybór, dzięki czemu można skopiować, przenieść lub usunąć kilka wpisów.
- **Add Folder** (dodanie folderu) tworzy folder (zobacz [Foldery wpisów](#entry-folders)).
- **Add Entry** (dodanie wpisu) dodaje pusty wpis na górze listy.

Linia pod paskiem narzędzi pokazuje liczbę wpisów, liczbę folderów i szacowaną łączną liczbę tokenów w treści wszystkich wpisów (token to mały kawałek tekstu).

## Dodawanie i edycja wpisu

1. Kliknij **Add Entry**. Pojawia się nowy wiersz.
2. Wpisz nazwę w wierszu. Każdy wpis musi ją mieć. Nazwa jest dla ciebie i dla wyszukiwania, a nie dla AI.
3. Kliknij wiersz albo jego strzałkę. Pod wierszem otwiera się panel ze wszystkimi polami.
4. Wpisz słowo kluczowe w polu **Primary Keys** (główne słowa kluczowe) i naciśnij <kbd>Enter</kbd>. Potem napisz tekst dla AI w polu **Content** (treść). Zobacz [Treść i słowa kluczowe](#content-and-keys).

Zmiany zapisują się same. Panel pokazuje kolejno **Autosaving…**, **Saving…** i **Saved automatically**. Jeśli zapis się nie uda, twój tekst zostaje na miejscu, a Marinara ponawia próbę przy następnej zmianie.

Aby skopiować wpis, kliknij **Duplicate entry** (powielenie wpisu) w jego wierszu. Aby go usunąć, kliknij **Delete entry** (usunięcie wpisu) i potwierdź. Na komputerze te przyciski pojawiają się po najechaniu kursorem na wiersz.

<a id="content-and-keys"></a>

### Treść i słowa kluczowe

| Pole | Czym jest |
| --- | --- |
| **Primary Keys** | Słowa, które wyzwalają wpis. Wpisz słowo kluczowe i naciśnij <kbd>Enter</kbd>, żeby je dodać. Wpis typu **Normal** aktywuje się po dopasowaniu dowolnego z nich. |
| **Content** | Tekst wysyłany do AI. Zapisz zwykły fakt. Może zawierać [makra](../prompts/macros.md), a pod polem widać szacowaną liczbę tokenów. |
| **Secondary Keys** | Dodatkowe słowa kluczowe, używane tylko przez wpisy typu **Selective**. |
| **Description** | Krótkie streszczenie, które czyta tylko agent **Knowledge Router**. Nigdy nie trafia do głównego modelu. Zobacz [Źródła wiedzy](../agents/knowledge-sources.md). |

Lista z więcej niż 10 słowami kluczowymi pokazuje pierwsze 10. Kliknij **Show N more** (pokaż N więcej), żeby zobaczyć resztę, i **Collapse** (zwiń), żeby ją ukryć. Ukryte słowa kluczowe nadal są dopasowywane.

Na przykład wpis o nazwie `Silverhaven` ze słowami kluczowymi `Silverhaven` i `the capital` oraz treścią `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.` trafia do AI zawsze, gdy w niedawnej części czatu pojawi się którekolwiek z tych słów kluczowych.

### Reguły dopasowania

Domyślnie słowo kluczowe pasuje, gdy pojawia się gdziekolwiek w niedawnej części czatu, niezależnie od wielkości liter. Zmieniają to trzy kontrolki.

- **Whole Words** (całe wyrazy; w panelu wpisu, domyślnie wyłączone): słowo kluczowe musi być pełnym wyrazem. `Ash` pasuje do "Ash", ale nie do "cash".
- **Case Sensitive** (uwzględnianie wielkości liter; w panelu wpisu, domyślnie wyłączone): wielkość liter musi się zgadzać. `IT` pasuje do "IT", ale nie do "it".
- **Regex** (ikona w wierszu z podpowiedzią **Enable regex key matching**, domyślnie wyłączona): traktuje każde słowo kluczowe jak wyrażenie regularne, czyli wzorzec dopasowania tekstu. Po włączeniu ikona robi się pomarańczowa.

Używaj opcji **Regex** tylko wtedy, gdy znasz wyrażenia regularne. Każdy wzorzec działa z krótkim limitem czasu, a wzorzec, który działa zbyt długo, nie pasuje, więc buduj proste wzorce. Na przykład `\bVlad(?:'s)?\b` pasuje do "Vlad" i "Vlad's".

## Wybór typu wpisu

Kliknij kolorową kropkę w wierszu, żeby otworzyć menu typów.

- **Normal** (zielona kropka, ustawienie domyślne): aktywuje się, gdy pasuje główne słowo kluczowe. Używaj go do większości wpisów: osób, miejsc, przedmiotów. Daj każdemu od trzech do ośmiu konkretnych słów kluczowych.
- **Constant** (żółta kropka): aktywuje się za każdym razem, gdy lorebook jest aktywny, bez słowa kluczowego. Używaj go do nielicznych faktów, które muszą być obecne zawsze, takich jak rok albo ton. Czas działania, prawdopodobieństwo i filtry nadal obowiązują.
- **Selective** (czerwona kropka): aktywuje się, gdy pasuje główne słowo kluczowe i spełniona jest logika dodatkowych słów kluczowych. Używaj go, gdy pospolite słowo kluczowe uruchamiałoby wpis w niewłaściwej scenie.

Każdy wpis typu **Constant** kosztuje tokeny przy każdej wiadomości, więc rób ich mało.

We wpisie typu **Selective** dodaj **Secondary Keys** i wybierz przycisk **Logic** (logika).

| Logika | Wpis uruchamia się, gdy |
| --- | --- |
| **AND Any** | Pojawia się też co najmniej jedno dodatkowe słowo kluczowe. |
| **AND All** | Pojawiają się też wszystkie dodatkowe słowa kluczowe. |
| **NOT Any** | Nie pojawia się żadne dodatkowe słowo kluczowe. |
| **NOT All** | Nie pojawiają się razem wszystkie dodatkowe słowa kluczowe. |

Na przykład główne słowo kluczowe `king` z dodatkowym słowem kluczowym `Silverhaven` i logiką **AND Any** uruchamia wpis tylko wtedy, gdy czat wspomina o obu.

Jeśli to nie zadziałało: wpis typu **Normal** bez słów kluczowych nie ma czego dopasować. Dodaj słowa kluczowe albo ustaw typ **Constant**. Wpis bez słów kluczowych nadal da się znaleźć po znaczeniu, ale tylko wtedy, gdy [wyszukiwanie semantyczne](semantic-search.md) jest w pełni skonfigurowane.

## Position, Depth i Order

Te kontrolki decydują o tym, w którym miejscu promptu ląduje aktywowany wpis. Na szerokim ekranie znajdują się w zwartym wierszu. Na wąskim ekranie dotknij przycisku **Entry quick controls** (szybkie kontrolki wpisu) w wierszu.

| Kontrolka | Co robi |
| --- | --- |
| **Position** | Miejsce, do którego trafia wpis. Domyślnie **Before character definitions**. |
| **Before character definitions** | Przed kartą postaci w prompcie. Etykieta w wierszu: **↑Char**. |
| **After character definitions** | Za kartą postaci. Etykieta w wierszu: **↓Char**. |
| **@ Depth** | Wewnątrz historii czatu. Etykieta w wierszu: **@Depth**. |
| **Outlet** | Nigdzie automatycznie (zobacz niżej). |
| **Depth** | Widoczne tylko przy **@ Depth**. Ile wiadomości wstecz od najnowszej znajduje się wpis. Domyślnie 4. |
| **Order** | Kolejność, gdy aktywuje się kilka wpisów. Niższa liczba trafia wcześniej i przeżywa przycinanie, gdy limit jest ciasny. Domyślnie 100. |

Pole **Role** (rola) jest w rozwiniętym panelu wpisu, a nie w szybkich kontrolkach. Oznacza wstawiony tekst jako **System**, **User** albo **Assistant**, ma znaczenie tylko przy **@ Depth**, a domyślnie ma wartość **System**.

Zostaw te kontrolki na wartościach domyślnych, chyba że wpis potrzebuje czegoś więcej. Po **@ Depth** sięgaj rzadko. Tekst ląduje między niedawnymi wiadomościami jak wtręt, więc zostaw tę pozycję dla reguły, o której model wciąż zapomina, albo faktu, który zmienił się przed chwilą. Na przykład "Karczma właśnie stanęła w ogniu." na **@ Depth** 1.

### Outlet

Wpis z pozycją **Outlet** pojawia się tylko tam, gdzie umieścisz makro.

1. Ustaw **Position** na **Outlet**. Pojawia się pole **Outlet name** (nazwa outletu).
2. Wpisz dokładną nazwę, z uwzględnieniem wielkości liter, na przykład `character_rules`.
3. Umieść `{{outlet::character_rules}}` w sekcji promptu swojego [presetu](../prompts/presets.md).

Wpisy o tej samej nazwie łączą się w kolejności **Order**, rozdzielone znakami nowej linii. Makra outletu działają w sekcjach promptu czatów w trybach Conversation, Roleplay i Game. Pojawiają się tylko wpisy aktywowane dla tej odpowiedzi. Nadal podlegają słowom kluczowym, prawdopodobieństwu, filtrom, czasowi działania oraz ustawieniom **Entry Limit** (limit wpisów) i **Token Budget** (limit tokenów). Bez aktywnych wpisów makro nic nie dodaje. Wpis Outlet nie może wywołać innego makra outletu. Samo makro opisuje przewodnik [Makra promptów](../prompts/macros.md).

## Prawdopodobieństwo i czas działania

**Probability** (prawdopodobieństwo) to szansa, że wpis się uruchomi, gdy jego słowa kluczowe pasują. Domyślnie wynosi 100%. Ustaw 25%, żeby za każdym razem była jedna szansa na cztery.

Pola **Timing** (czas działania) sterują zachowaniem wpisu na przestrzeni kilku wiadomości. Wszystkie cztery są początkowo nieustawione, czyli wyłączone.

| Pole | Co robi | Przykład |
| --- | --- | --- |
| **Sticky** | Po wyzwoleniu wpis pozostaje aktywny przez tyle kolejnych wiadomości, nawet bez dopasowania słowa kluczowego. | Ujawniony sekret z wartością 3 zostaje przez trzy wiadomości. |
| **Cooldown** | Po wyzwoleniu wpis czeka tyle wiadomości, zanim może uruchomić się ponownie. | Omen z wartością 5 uruchamia się najwyżej raz na pięć wiadomości. |
| **Delay** | Wpis nie może się uruchomić, dopóki czat nie dojdzie do tylu wiadomości. | Zwrot akcji z wartością 20 na początku pozostaje ukryty. |
| **Ephemeral** | Wpis wyłącza się sam po tylu aktywacjach. 0 oznacza brak limitu. | Notatka wstępna z wartością 1 uruchamia się raz. |

**Sticky**, **Cooldown** i **Delay** liczą wiadomości. **Ephemeral** liczy aktywacje.

<a id="decision-activation"></a>

## Aktywacja przez decyzję

Pole **Decision** (decyzja) pozwala twojemu modelowi decyzyjnemu, czyli małemu modelowi odpowiadającemu na pytania typu tak lub nie, zdecydować, czy wpis pasuje. Napisz stwierdzenie o niedawnej części czatu, na przykład `In the latest message, a dragon is physically present`, i wybierz tryb.

| Tryb | Efekt |
| --- | --- |
| **Off** (wyłączone) | Wpis aktywuje się jak zwykle. To ustawienie domyślne. |
| **Require** (wymagaj) | Wpis aktywuje się jak zwykle i tylko wtedy, gdy stwierdzenie jest także prawdziwe. Odfiltrowuje luźne wzmianki. |
| **Trigger** (wyzwól) | Stwierdzenie to dodatkowy sposób aktywacji wpisu, nawet gdy nie ma słowa kluczowego. Wyłapuje parafrazy i sytuacje. |

W stwierdzeniu można używać makr, takich jak `{{user}}` i `{{char}}`.

Zanim zaczniesz: wybierz model decyzyjny w sekcji **Decision model** (model decyzyjny) panelu **Connections** (Połączenia). Bez modelu decyzyjnego albo bez odpowiedzi stwierdzenie liczy się jako nie. Edytor ostrzega, gdy żaden model nie jest ustawiony.

- **Require** nie dopuszcza wtedy żadnego nowego wpisu, choć istniejące utrzymanie **Sticky** może zachować aktywny wpis.
- **Trigger** nie dodaje drogi aktywacji, a wpis nadal może aktywować się przez swoje słowa kluczowe.

Ważnym wpisom daj też zwykłą drogę aktywacji, a **Require** używaj tylko do filtrowania opcjonalnej wiedzy o świecie.

**Require** sprawdza tylko wpis, który już się kwalifikuje przez słowa kluczowe, dopasowanie semantyczne, **Constant** albo miejsce na mapie, i to tylko wtedy, gdy stwierdzenie jest także prawdziwe. Przy wpisie typu **Constant** sprawia, że wpis staje się sytuacyjny, na przykład zasady walki ze stwierdzeniem `A fight is happening in the latest message`. Nie skanuje każdego nieużywanego wpisu.

Stwierdzenia decyzyjne dodają żądania do modelu i dzielą limit **Decision statements per turn** (stwierdzenia decyzyjne na turę). Wskazówki dotyczące sformułowań, limity, koszty i ponowne używanie odpowiedzi opisują sekcje [Pisanie stwierdzeń](../prompts/conditional-prompts.md#writing-statements), [Limity i koszty](../prompts/conditional-prompts.md#limits-and-cost) i [Ponowne używanie odpowiedzi](../prompts/conditional-prompts.md#answer-reuse). Konfigurację modelu opisuje przewodnik [Modele decyzyjne](../connections/decision-models.md).

Więcej szczegółów:

- Wpis **sticky** nie jest pytany ponownie, dopóki trwa jego utrzymanie, a wpis, którego cooldown trwa, nie jest pytany wcale.
- Lista aktywnych lorebooków pokazuje **decision** (decyzja) przy wpisie, który aktywowało stwierdzenie **Trigger**.
- **Peek Prompt** nigdy nie pyta. Pokazuje odpowiedzi, które tura już ma.
- Aktywacja przez decyzję dotyczy tylko tur czatu. Konfiguracja gry i skanowania, które agenci uruchamiają na własne potrzeby, odczytują wpisy decyzyjne jako nie.
- Warunek `{{#if decision:"..."}}` wewnątrz treści wpisu to coś innego. Przycina tekst wpisu, który już się aktywował.

## Grupy, filtry i inne opcje

Rozwinięty panel zawiera więcej pól.

| Pole | Co robi |
| --- | --- |
| **Group** (grupa) | Wpisy w tej samej grupie wykluczają się nawzajem. Na jedną odpowiedź aktywuje się tylko jeden z nich. Używaj tego do alternatyw, takich jak trzy wpisy "pogoda na dziś". Połącz to z niskim **Probability**, żeby plotki pojawiały się tylko czasem. |
| **Tag** | Dowolna etykieta tekstowa do własnego sortowania. Nie wpływa na aktywację. |
| **Locked** (zablokowany) | Nie pozwala agentowi **Lorebook Keeper** zmieniać tego wpisu. Zobacz [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md). |
| **No Vector** | Wyłącza wpis z wyszukiwania semantycznego. Zobacz [Wyszukiwanie semantyczne w lorebookach](semantic-search.md). |
| **Recursion** (rekurencja) | Pozwala treści tego wpisu wyzwalać kolejne wpisy. Domyślnie wyłączone. Zobacz [Limity tokenów i rekurencja w lorebookach](token-budgets.md). |

Sekcja **Context filters & matching sources** (filtry kontekstu i źródła dopasowania) ogranicza wpis do wybranych postaci, tagów postaci lub typów generowania. Pozwala też przeszukiwać pod kątem słów kluczowych wpisu dodatkowe pola karty, na przykład opis postaci. W czacie grupowym w trybie **Individual** (osobno) każda odpowiedź uwzględnia tylko postać, która ją pisze, więc filtr postaci trzyma wpis z dala od odpowiedzi innych postaci. W odpowiedzi **Merged (Narrator)** (odpowiedź scalona z narracją) liczy się każda postać w czacie, więc wpis zostaje, jeśli w czacie jest którakolwiek z filtrowanych postaci. Używaj tego do sekretów, które zna tylko jedna postać.

## Wybór ustawień dla faktu

Zadaj sobie pytanie, kiedy AI ma zobaczyć dany fakt, a potem skorzystaj z tej tabeli.

| Fakt | Ustawienia |
| --- | --- |
| Zawsze prawdziwy | **Constant**. Rób takich wpisów mało. |
| Liczy się tylko wtedy, gdy pada jego nazwa | **Normal** z konkretnymi słowami kluczowymi, takimi jak `Castle Dracul`, `the castle`, `the fortress`. |
| Jego słowo kluczowe jest pospolite, na przykład `king` albo `home` | **Whole Words** albo **Selective** z dodatkowymi słowami kluczowymi. |
| Ważny, ale rzadko wymieniany | **Normal** z [wyszukiwaniem semantycznym](semantic-search.md) albo szersze słowa kluczowe. |
| Kilka wersji, które nie mogą pojawić się razem | Ta sama grupa **Group**. |
| Reguła, o której model zapomina w środku sceny | **@ Depth** w okolicach od 1 do 4. |

Nawyki, dzięki którym lorebook pozostaje niewielki:

- Używaj konkretnych słów kluczowych. Słowo kluczowe w rodzaju `he` czy `the city` pasuje do niemal każdej wiadomości i marnuje limit.
- Wypełnij pole **Description** w każdym wpisie, którym ma kierować agent **Knowledge Router**. Agent czyta opis, a nie treść.
- Buduj duże światy jak drzewo. Obok wpisu dla każdego członka grupy dodaj wpis zbiorczy dla całej grupy, na przykład wpis o Cesarstwie, który wymienia jego członków.
- We wpisach zbiorczych zostaw **Recursion** wyłączone. Inaczej samo wymienienie grupy wciąga do promptu naraz pełne wpisy wszystkich członków.

Weźmy na przykład regułę mówiącą, jak można zabić złoczyńcę – fakt, o którym AI ma skłonność zapominać. Ustaw typ **Selective** z logiką **AND Any**, włącz **Whole Words** i ustaw **Order** na 10. Użyj głównych słów kluczowych `weakness`, `kill`, `destroy`, `stake` i dodatkowych słów kluczowych `Vlad`, `the count`. Dzięki dodatkowym słowom kluczowym wpis milczy, gdy drużyna zabija wilka. **Whole Words** nie pozwala, żeby `stake` pasowało do "mistake". Niska wartość Order chroni wpis przed przycięciem w zatłoczonej scenie.

Miejsce, w którym znajduje się lorebook, decyduje o tym, które czaty go widzą. Lorebooki globalne, powiązane i osadzone opisują przewodniki [Lorebooki – przegląd](overview.md) i [Podpinanie lorebooków do postaci i person](linking-to-characters.md).

## Makra w treści wpisu

Pole **Content** jest rozwijane przed wysłaniem jak każdy inny tekst promptu. Przydatne makra:

- `{{char}}` i `{{user}}` podają imiona, dzięki czemu wspólny wpis brzmi dobrze w każdym czacie.
- `{{roll:1d6}}` rzuca kością. `{{setvar::mood::angry}}` zapisuje wartość dla tego czatu, a `{{getvar::mood}}` ją odczytuje.
- `{{random::a::b::c}}` wybiera jedną opcję. Dodaj wagi, jak w `{{random::common@3::rare@1}}`. Połącz to z niskim **Probability**, żeby zwinąć całą tabelę spotkań w jeden wpis.
- `{{include::Entry name}}` wstawia tekst innego wpisu z tego samego lorebooka, nawet wyłączonego. Zobacz [Makro dołączania wpisów lorebooka](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` to komentarz. Znika, zanim zobaczy go AI, i zanim przebiegnie skanowanie rekurencyjne, więc nigdy niczego nie wyzwoli.

Pełną listę znajdziesz w przewodniku [Makra promptów](../prompts/macros.md).

Przy włączonym przełączniku **Recursive** (rekurencyjne) Marinara ponownie skanuje rozwiniętą treść aktywowanych wpisów. Tekst wyprodukowany przez makro może wyzwolić kolejne wpisy.

## Narzędzie Keyword test

Panel **Keyword test** (test słów kluczowych) na górze zakładki **Entries** sprawdza słowa kluczowe bez czatu.

1. Rozwiń **Keyword test**.
2. Wklej do pola przykładowy akapit albo kilka wiadomości.

Wpisy, które by pasowały, dostają zielone wyróżnienie i kafelek **Would activate** (aktywowałby się). Wpisy typu **Constant** dostają kafelek **Always active** (zawsze aktywny). Linia z licznikiem pokazuje, ile włączonych wpisów by się aktywowało. Przełącznik **Include other lorebooks** (uwzględnianie innych lorebooków) sprawdza też włączone wpisy w twoich pozostałych lorebookach.

Test pomija czas działania, prawdopodobieństwo, filtry postaci i person oraz dopasowanie po znaczeniu, więc w prawdziwym czacie wynik może być inny.

<a id="entry-folders"></a>

## Foldery wpisów

Foldery grupują wpisy wewnątrz jednego lorebooka. To co innego niż foldery biblioteki w panelu **Lorebooks**.

- Kliknij **Add Folder**, a potem zmień nazwę folderu na miejscu.
- Przeciągnij wpis na folder albo użyj selektora **Folder** we wpisie (działa też przez dotknięcie).
- Przeciągnij folder na inny, żeby go zagnieździć, albo na górny pasek, żeby wyciągnąć go z zagnieżdżenia.
- Każdy folder ma przełącznik włączenia (podpowiedź "Folder enabled"). Gdy jest wyłączony, żaden wpis w środku się nie aktywuje.
- **Clone folder** (klonowanie folderu) kopiuje folder razem ze wszystkimi wpisami i podfolderami.
- **Delete folder** (usunięcie folderu) usuwa wyłącznie folder. Jego zawartość przechodzi na najwyższy poziom.

Foldery wyświetlają się jako grupy tylko przy sortowaniu **Order** i bez wyszukiwania. W przeciwnym razie widać płaską listę i notkę **Folder view paused (clear search and sort by Order)**.

## Rozwiązywanie problemów

| Objaw | Rozwiązanie |
| --- | --- |
| Wpis nigdy się nie uruchamia. | Daj mu słowa kluczowe albo ustaw typ **Constant**. Sprawdź, czy lorebook jest włączony i aktywny w czacie. |
| Słowo kluczowe działało, a potem przestało. | Marinara skanuje tylko kilka ostatnich wiadomości – tyle, ile wskazuje **Scan Depth** (głębokość skanowania), domyślnie 2. Podnieś **Scan Depth**, dodaj **Sticky** albo ustaw typ **Constant**. |
| Wpis uruchamia się w niewłaściwych scenach. | Użyj **Whole Words**, dodatkowych słów kluczowych typu **Selective** albo filtra postaci. |
| Ważna wiedza wypada. | Ustaw jej niższe **Order** albo podnieś **Token Budget**. Sekcja **Active Context** (aktywny kontekst) w **Chat Settings** (ustawienia czatu) pokazuje, co zostało pominięte i dlaczego. Zobacz [Limity tokenów i rekurencja w lorebookach](token-budgets.md). |
| AI ignoruje wpis. | Sprawdź w **Active Context**, czy wpis się aktywował. Fakt daleko od najnowszej wiadomości ciągnie słabiej niż fakt umieszczony blisko najnowszej wiadomości za pomocą **@ Depth**. |

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Modele decyzyjne](../connections/decision-models.md)
- [Limity tokenów i rekurencja w lorebookach](token-budgets.md)
- [Wyszukiwanie semantyczne w lorebookach](semantic-search.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
