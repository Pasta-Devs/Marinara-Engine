# Wpisy lorebooka: słowa kluczowe, pozycja i czas działania

Ten przewodnik wyjaśnia, jak budować wpisy w lorebooku (zbiorze faktów o twoim świecie). Opisuje zakładkę **Entries** (wpisy), słowa kluczowe wyzwalające wpis oraz trzy typy wpisów. Pokazuje też, w którym miejscu promptu ląduje każdy wpis i jakie ustawienia czasu decydują o momencie jego uruchomienia. Jeśli lorebooki są nowością, zacznij od przewodnika [Lorebooki – przegląd](overview.md).

Wpis to jeden blok tekstu plus reguły, które decydują o tym, kiedy Marinara Engine dokłada ten tekst do promptu AI (prompt to tekst, który Marinara wysyła do AI). Aktywny wpis wstawia swoją treść do promptu, dzięki czemu AI "pamięta" fakt, którego nigdy nie wpisano w czacie.

## Zakładka Entries

Otwórz lorebook w panelu **Lorebooks**, żeby wejść do pełnoekranowego edytora. Edytor ma dwie boczne zakładki: **Overview** (przegląd) i **Entries**. Kliknij zakładkę **Entries**, aby zobaczyć listę wpisów. Plakietka przy zakładce pokazuje, ile wpisów liczy lorebook.

Pasek narzędzi na górze zakładki **Entries** zawiera te kontrolki:

- Pole **Search entries…**: filtruje listę po nazwie wpisu, słowach kluczowych lub treści.
- Lista rozwijana sortowania z opcjami **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest** i **Oldest**. Opcje ze strzałką ↓ sortują od największych do najmniejszych.
- **Select** (zaznaczanie): włącza tryb wielokrotnego wyboru, żeby skopiować, przenieść lub usunąć kilka wpisów naraz.
- **Add Folder** (dodanie folderu): tworzy folder grupujący wpisy (opisuje go sekcja o folderach wpisów poniżej).
- **Add Entry** (dodanie wpisu): tworzy nowy, pusty wpis na górze listy.

Pod paskiem narzędzi jedna linia podsumowania pokazuje liczbę wpisów, liczbę folderów i łączny szacowany rozmiar treści wszystkich wpisów w tokenach (token to mały kawałek tekstu).

## Dodawanie i edycja wpisu

Wykonaj kolejno te kroki, żeby utworzyć wpis.

1. Otwórz swój lorebook i kliknij zakładkę **Entries**.
2. Kliknij przycisk **Add Entry**. Na liście pojawia się nowy wiersz.
3. Wpisz nazwę w polu nazwy w tym wierszu. Każdy wpis musi mieć nazwę.
4. Kliknij wiersz (albo strzałkę na jego końcu), żeby rozwinąć pełny panel boczny edytora.
5. Uzupełnij słowa kluczowe i treść – opisują je sekcje poniżej.

Zmiany zapisują się same. Podczas pisania panel pokazuje kolejno **Autosaving…**, **Saving…** i **Saved automatically**. Jeśli zapis się nie uda, tekst zostaje na miejscu, a Marinara ponawia próbę przy następnej zmianie. Wpisy nie mają osobnego przycisku zapisu.

Każdy wpis wyświetla się jako zwarty, jednolinijkowy wiersz. Wiersz mieści najczęściej używane kontrolki. Resztę widać po rozwinięciu wiersza.

Aby powielić wpis, najedź na wiersz i kliknij przycisk **Duplicate** (powielenie). Aby go usunąć, kliknij przycisk **Delete** (usunięcie). Marinara prosi o potwierdzenie komunikatem "Delete this lorebook entry?".

## Treść wpisu i słowa kluczowe

Rozwiń wpis, żeby edytować jego główne pola.

- **Primary Keys** (główne słowa kluczowe): słowa kluczowe wyzwalające ten wpis. Kiedy w niedawnych wiadomościach czatu pada którekolwiek z nich, wpis się aktywuje. Wpisz słowo kluczowe i naciśnij Enter, żeby dodać je jako kafelek.
- **Content** (treść): tekst wstawiany do promptu AI w chwili aktywacji wpisu. Zapisz go jako zwykły fakt, który AI ma znać. Treść obsługuje makra promptu, a pod polem widać bieżący szacunek liczby tokenów.
- **Secondary Keys** (dodatkowe słowa kluczowe): dodatkowe słowa kluczowe, używane tylko przy typie wpisu **Selective**. Zajrzyj do sekcji o typach wpisów poniżej.
- **Description** (opis): krótkie streszczenie wpisu. Czyta je wyłącznie agent **Knowledge Router**, żeby zdecydować, czy wstawić wpis. Ten tekst nigdy nie trafia do głównego AI jako treść. Zobacz [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md).

Oto prosty przykład.

- Nazwa: `Silverhaven`
- Primary Keys: `Silverhaven`, `the capital`
- Content: `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

Kiedy w czacie padnie `Silverhaven` albo `the capital` – z twojej strony lub ze strony AI – model automatycznie dostaje ten fakt.

To najprostszy możliwy wpis: nazwa, kilka słów kluczowych i jeden fakt. Sekcje **Strategia pisania** i **Przykład w praktyce** poniżej pokazują, kiedy sięgnąć po pozostałe kontrolki i jak zbudować mały świat od zera.

## Reguły dopasowania słów kluczowych

Domyślnie główne słowo kluczowe pasuje, jeśli pojawia się gdziekolwiek w niedawnym tekście czatu, niezależnie od wielkości liter. Sposób dopasowania zmieniają trzy kontrolki. **Whole Words** i **Case Sensitive** siedzą w rozwiniętym panelu bocznym. Przełącznik **Regex** to mała ikona w zwartym wierszu, która po włączeniu robi się pomarańczowa.

| Kontrolka | Gdzie | Domyślnie | Co robi |
|---|---|---|---|
| **Whole Words** | Panel boczny wpisu | Off | Słowo kluczowe musi pasować do całego wyrazu, a nie do fragmentu dłuższego wyrazu. |
| **Case Sensitive** | Panel boczny wpisu | Off | Wielkość liter musi zgadzać się dokładnie. |
| **Regex** | Zwarty wiersz | Off | Traktuje każde słowo kluczowe jak wzorzec wyrażenia regularnego zamiast zwykłego tekstu. |

Regex (wyrażenie regularne) to język opisu wzorców tekstowych. Sięgaj po niego tylko wtedy, gdy znasz regex. Dla bezpieczeństwa Marinara nakłada na każde słowo kluczowe z regexem krótki limit czasu. Zbyt wolny wzorzec nie dopasuje się w danym skanowaniu, więc buduj proste wzorce.

## Typy wpisów: Normal, Constant, Selective

Każdy wpis ma swój typ. Kliknij małą kolorową kropkę w wierszu wpisu, aby otworzyć menu typów i wybrać jeden z nich.

- **Normal** (zielona kropka): wyzwala się, gdy główne słowo kluczowe pasuje do skanowanego tekstu. To ustawienie domyślne.
- **Constant** (żółta kropka): wstawia się za każdym razem, gdy lorebook jest aktywny, bez żadnego słowa kluczowego. Nadaje się do faktów, które muszą być obecne zawsze.
- **Selective** (czerwona kropka): muszą pasować główne słowa kluczowe, a dodatkowo musi się zgadzać logika dodatkowych słów kluczowych.

Wpis typu **Constant** nadal podlega ustawieniom czasu, prawdopodobieństwu i wszystkim ustawionym filtrom. Nie potrzebuje tylko słowa kluczowego.

Przy typie **Selective** dodaj w polu **Secondary Keys** co najmniej jedno słowo kluczowe i wybierz przycisk **Logic** (logika) w panelu bocznym:

- **AND Any**: musi pojawić się przynajmniej jedno dodatkowe słowo kluczowe.
- **AND All**: muszą pojawić się wszystkie dodatkowe słowa kluczowe.
- **NOT Any**: wpis jest blokowany, jeśli pojawi się którekolwiek dodatkowe słowo kluczowe.
- **NOT All**: wpis jest blokowany tylko wtedy, gdy pojawią się wszystkie dodatkowe słowa kluczowe.

Weźmy przykład: wpis typu **Selective** z głównym słowem kluczowym `king`, dodatkowym słowem kluczowym `Silverhaven` i logiką **AND Any**. Uruchamia się dopiero wtedy, gdy w czacie padnie i król, i Silverhaven. Dzięki temu pospolite słowo w rodzaju `king` nie wyzwala wpisu w niewłaściwej scenie.

## Position, Depth i Order

Te kontrolki decydują o tym, w którym miejscu promptu ląduje aktywowany wpis. Na szerokim ekranie znajdują się w zwartym wierszu. Na wąskim ekranie dotknij przycisku szybkich kontrolek w wierszu, żeby do nich dotrzeć.

- **Position** (pozycja): wybierz **Before chat**, **After chat**, **@ Depth** albo **Outlet**. Before chat i After chat umieszczają wpis wokół historii czatu. **@ Depth** wstawia wpis wewnątrz historii czatu. **Outlet** nie wstawia wpisu automatycznie – udostępnia aktywowaną treść nazwanemu makru `{{outlet::name}}`. Na szerokim ekranie wiersz pokazuje pierwsze trzy pozycje w postaci skróconych etykiet **↑Char**, **↓Char** i **@Depth**.
- **Depth** (głębokość): pojawia się tylko wtedy, gdy pole **Position** ma wartość **@ Depth**. Ustawia, ile wiadomości wstecz od ostatniej wiadomości trafia wpis. Domyślnie 4.
- **Order** (kolejność): kolejność wstawiania, gdy naraz aktywuje się kilka wpisów. Niższa liczba trafia do promptu wcześniej. Domyślnie 100.

Sięgaj po **@ Depth** rzadko i tylko świadomie. Wpis trafia wtedy *do środka* niedawnych wiadomości, a nie wokół nich. Jego tekst czyta się przez to jak wtręt wrzucony w środek wymiany zdań:

> **John:** Chodźmy odwiedzić zamek Vlada.
> **Bob:** Jasne.
> *Słabością hrabiego jest czosnek – ma na niego skrajną alergię i ukrywa to za wszelką cenę.*
> **John:** Świetnie, może jutro? Mam wtedy wolne.

Sięgaj po tę pozycję tylko wtedy, gdy notatka naprawdę musi stać obok ostatniej tury. Chodzi o regułę, o której model wciąż zapomina, albo o fakt, który dopiero się zmienił. Zwykłą wiedzę o świecie zostaw na **Before chat** albo **After chat**.

Po wybraniu wartości **Outlet** pojawia się pole **Outlet name** (nazwa outletu). Wpisz dokładną nazwę z uwzględnieniem wielkości liter, na przykład `character_rules`, a potem umieść `{{outlet::character_rules}}` w sekcji promptu. Każdy wpis przypisany do tego outletu (nazwanego punktu wstawiania) nadal podlega swoim zwykłym regułom: słów kluczowych, typu constant, prawdopodobieństwa, filtrów, czasu, limitu wpisów i limitu tokenów. Marinara zbiera wyłącznie wpisy aktywowane dla bieżącego generowania. Wpisy o tej samej nazwie outletu łączą się w kolejności Order, rozdzielone znakami nowej linii.

Makro outletu bez aktywnych pasujących wpisów zwraca pustkę. Treść outletu nie może wywołać kolejnego makra outletu, co zapobiega rekurencyjnym pętlom outletów. Makra outletu działają w sekcjach promptu w trybach Conversation, Roleplay i Game Mode.

## Prawdopodobieństwo wyzwolenia

Każdy wpis ma wartość **Probability** (prawdopodobieństwo), pokazywaną w wierszu jako procent. Domyślnie wynosi 100%, czyli wpis uruchamia się zawsze, gdy jego słowa kluczowe pasują. Obniż ją, żeby wpis uruchamiał się tylko czasem. Na przykład 25% oznacza jedną szansę na cztery przy każdym dopasowaniu słów kluczowych.

## Czas działania: Sticky, Cooldown, Delay, Ephemeral

Pola **Timing** (czas działania) w panelu bocznym sterują zachowaniem wpisu na przestrzeni kilku wiadomości. **Sticky**, **Cooldown** i **Delay** liczą wiadomości. **Ephemeral** liczy aktywacje. Wszystkie cztery są początkowo nieustawione (0, czyli wyłączone).

- **Sticky**: po wyzwoleniu wpis pozostaje aktywny przez tyle kolejnych wiadomości, nawet bez świeżego dopasowania słowa kluczowego.
- **Cooldown**: po wyzwoleniu wpis czeka tyle wiadomości, zanim może wyzwolić się ponownie.
- **Delay**: wpis czeka tyle wiadomości od początku czatu, zanim może aktywować się po raz pierwszy.
- **Ephemeral**: wpis wyłącza się sam po tylu aktywacjach. Wartość 0 oznacza brak limitu.

Na przykład ustaw **Sticky** na 3, żeby zatrzymać fakt w treści promptu na kilka tur po tym, jak się pojawi. Dzięki temu AI nie zapomina o nim w środku sceny.

## Więcej opcji wpisu

W rozwiniętym panelu bocznym czeka jeszcze kilka pól.

- **Role** (rola): decyduje o tym, czy wstawiony tekst jest oznaczony jako **System**, **User** czy **Assistant**. Ma to znaczenie tylko wtedy, gdy pole **Position** ma wartość **@ Depth**. Domyślnie **System**.
- **Group** (grupa) i **Tag**: umieść wpisy w tej samej grupie **Group**, żeby aktywował się tylko jeden z nich naraz. Pole **Tag** to dowolna etykieta tekstowa do własnego sortowania.
- **Locked** (zablokowany): nie pozwala agentowi **Lorebook Keeper** zmieniać tego wpisu. Zobacz [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md).
- **No Vector** i plakietka stanu wektorów dotyczą wyszukiwania semantycznego. Zobacz [Wyszukiwanie semantyczne w lorebookach](semantic-search.md).

Panel boczny ma też sekcję **Context filters & matching sources** (filtry kontekstu i źródła dopasowania). Można w niej ograniczyć wpis do wybranych postaci, tagów postaci lub typów generowania. Da się też przeszukiwać pod kątem słów kluczowych wpisu dodatkowe pola karty postaci, na przykład opis postaci.

## Strategia pisania: wybór właściwego wpisu

Sekcje powyżej opisują, co robi każda kontrolka. Ta sekcja przekłada je na decyzje podejmowane przy pisaniu lorebooka: jaki typ wybrać, kiedy zawęzić słowo kluczowe i jak nie rozdmuchać promptu. Zacznij od jednego pytania: *kiedy AI ma zobaczyć ten fakt?*

- **Fakt musi być prawdziwy zawsze** – założenia świata, rok, ton, reguła barwiąca każdą scenę. Ustaw typ **Constant**: wpis wstawia się za każdym razem, gdy lorebook jest aktywny, bez żadnego słowa kluczowego. Takich wpisów rób mało. Każdy wpis typu Constant kosztuje tokeny przy każdej wiadomości, więc kilkanaście takich wpisów wypycha z promptu sam czat.
- **Fakt liczy się dopiero wtedy, gdy pada** – osoba, miejsce, frakcja albo przedmiot. Zostaw domyślny typ **Normal** i wpisz od trzech do ośmiu konkretnych słów w polu **Primary Keys**: nazwę oraz określenia, których postacie naprawdę używają (`Castle Dracul`, `the castle`, `the fortress`). To koń pociągowy lorebooka – większość wpisów jest typu Normal.
- **Słowo kluczowe jest pospolite** i uruchomiłoby wpis w niewłaściwej scenie (`king`, `home`, `hunter`). Włącz przełącznik **Whole Words**, żeby `art` przestało pasować do `start`. Inna opcja: zmień typ na **Selective** i dodaj w polu **Secondary Keys** słowa przypinające wpis do właściwego kontekstu.
- **Kilka wpisów zajmuje to samo miejsce i nigdy nie może pojawić się razem** – trzy wersje jednego zamku, dwie alternatywne historie postaci. Wpisz im tę samą wartość w polu **Group**, żeby naraz ładował się tylko jeden.
- **Fakt jest ważny, ale rzadko pada wprost** – motyw przewodni, relacja, reguła, której nikt nie wypowiada na głos. Zostaw typ **Normal** i włącz dopasowanie semantyczne, żeby wpis aktywował się po znaczeniu (zobacz [Wyszukiwanie semantyczne](semantic-search.md)). Dopasowanie semantyczne wymaga modelu embeddingów. Bez niego zostaje typ **Constant** – gdy fakt naprawdę musi być obecny zawsze – albo szersze słowa kluczowe.

Kilka nawyków utrzymuje lorebooki w dobrej formie:

- **Daj każdemu wpisowi sposób na uruchomienie.** Przy wpisie typu **Normal** bez słów kluczowych dopasowanie po słowach nie ma czego złapać. Taki wpis aktywuje się wtedy wyłącznie przez wyszukiwanie semantyczne, a to wymaga zwektoryzowanego lorebooka i modelu embeddingów (zobacz [Wyszukiwanie semantyczne](semantic-search.md)). Fakt, który ma być obecny zawsze, ustaw jako **Constant**. Reszcie daj słowa kluczowe, żeby uruchamiała się bez wyszukiwania semantycznego.
- **Stawiaj na konkretne słowa kluczowe.** Słowo w rodzaju `he`, `it` czy `the city` pasuje do niemal każdej wiadomości i marnuje limit tokenów. Przy zbyt ogólnym słowie kluczowym sięgnij po dokładne nazwy, przełącznik **Whole Words** albo dodatkowe słowa kluczowe typu **Selective**.
- **Wypełnij pole Description** w każdym wpisie, który ma trafiać do agenta **Knowledge Router**. Agent czyta opis, a nie treść, i na tej podstawie ocenia trafność (zobacz [Źródła wiedzy](../agents/knowledge-sources.md)).
- **Zostaw pola Position, Depth, Order i Role na wartościach domyślnych**, o ile nie ma powodu, żeby je ruszać. Po **Order** sięgaj wtedy, gdy uruchamia się kilka wpisów, a limit tokenów jest ciasny: niższa liczba ładuje się pierwsza i przeżywa przycinanie. Pozycję **@ Depth** zostaw dla rzadkiego przypomnienia, które musi stać obok ostatniej wiadomości – tak, jak ostrzega sekcja wyżej. Miej na oku ustawienia **Token Budget** i **Entry Limit** danego lorebooka (zobacz [Limity tokenów i rekurencja](token-budgets.md)).

### Uporządkuj wiedzę o świecie jak drzewo

Dużym światem łatwiej zarządzać jak drzewem niż jak płaską stertą wpisów. Obok wpisu dla każdej postaci, miejsca czy przedmiotu dodaj **wpisy zbiorcze** dla grup, do których one należą. Może to być wpis o *Cesarstwie*, który je opisuje i wymienia najważniejszych członków, albo wpis o królestwie z listą ważnych miast. Taki wpis zbiorczy daje AI mapę: gdy pada nazwa Cesarstwa, model widzi, czym ono jest i kto do niego należy. Pełne wpisy wszystkich członków nie zapychają wtedy promptu.

We wpisach zbiorczych zostaw rekurencję wyłączoną. Przełącznik **Recursive** lorebooka i przełącznik **Recursion** wpisu są domyślnie wyłączone, a wpisowi zbiorczemu dokładnie o to chodzi. Wpis zbiorczy daje modelowi ogólny obraz, a wpis konkretnego członka pojawia się dopiero wtedy, gdy pada jego nazwa. Jeśli gdzie indziej włączysz rekurencję, żeby łańcuchowo wciągać powiązaną wiedzę, we wpisach zbiorczych zostaw ją wyłączoną. Inaczej sama nazwa grupy wciągnie do promptu naraz pełne wpisy wszystkich członków – tysiące tokenów szczegółów, które nie są jeszcze potrzebne.

### Wspólna wiedza o świecie dla postaci i czatów

Miejsce, w którym siedzi lorebook, decyduje o tym, które czaty go widzą. Dopasuj więc to miejsce do rodzaju wiedzy o świecie:

- **Zasady wspólnego świata** – realia, do których należy cała twoja biblioteka – trafiają do lorebooka **Global**, aktywnego w każdym czacie (włącz przełącznik **Global** w zakładce **Overview** lorebooka).
- **Wiedza o samej postaci** – jej historia, sekrety, relacje – trafia do lorebooka **powiązanego** z tą postacią. Włącza się wtedy sam w jej czatach i nigdzie indziej. Gdy kilka postaci dzieli jeden lorebook, nałóż **filtr** postaci na te wpisy, które należą tylko do jednej z nich.
- **Karta postaci przeznaczona do udostępnienia** – **osadź** lorebook w karcie postaci, żeby wiedza o świecie podróżowała razem z eksportem. Osadzanie działa tylko dla postaci, a jedna karta mieści naraz jeden osadzony lorebook.
- **Wiedza na jedną historię** – przypnij lorebook do tego jednego czatu w jego ustawieniach.

Działanie aktywacji opisuje przewodnik [Lorebooki – przegląd](overview.md), a kontrolki przypisania, zasięgu i osadzania – przewodnik [Podpinanie lorebooków do postaci i person](linking-to-characters.md).

## Przykład w praktyce: mały świat

Załóżmy, że prowadzisz sesję roleplay w klimacie gotyckiego horroru, osadzoną w Wołoszczyźnie lat 90. XIX wieku. Szkieletowy lorebook byłby stertą wpisów z samą nazwą i treścią. Dobrze zbudowany korzysta z opisanych wyżej kontrolek, żeby każdy fakt pojawiał się dokładnie wtedy, kiedy trzeba. Oto, jak można ustawić garść wpisów i dlaczego właśnie tak.

Zacznij od fundamentu – jeden fakt obecny zawsze i kilka szczegółów wyzwalanych słowami kluczowymi:

**Założenia świata** – *Constant.*

- Content: `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Dlaczego **Constant**: podstawowe zasady barwią każdą odpowiedź, więc ten wpis jest obecny zawsze i bez słowa kluczowego. To jedyny wpis, przy którym da się obronić stałą obecność. Nie ulegaj pokusie, żeby ustawiać typ Constant częściej.

**Castle Dracul** – *Normal.*

- Primary Keys: `Castle Dracul`, `the castle`, `the fortress`
- Content: `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Dlaczego **Normal** z takimi słowami kluczowymi: zamek liczy się tylko wtedy, gdy jest w grze, więc czeka na słowo kluczowe. Słowa kluczowe obejmują jego nazwę i określenia, których używają postacie.

**Count Vlad** – *Normal, z włączonym Whole Words.*

- Primary Keys: `Vlad`
- Description: `The setting's central vampire.`
- Content: `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Dlaczego **Whole Words**: `Vlad` jest krótkie i mogłoby siedzieć w środku innego wyrazu, więc dopasowanie do całych wyrazów chroni przed przypadkowym uruchomieniem wpisu. Pole **Description** jest wypełnione, żeby agent Knowledge Router mógł pokierować wpisem, jeśli korzystasz z tego agenta.

### Kilka kontrolek naraz w jednym wpisie

Większość wpisów potrzebuje jednej albo dwóch kontrolek, a nieliczne zasługują na kilka naraz. Weź regułę mówiącą, jak naprawdę da się zabić głównego złoczyńcę – fakt, o którym AI zapomina w najgorszym możliwym momencie:

**Słabość hrabiego** – *Selective (AND Any), włączone Whole Words, Order 10, z wypełnionym polem Description.*

- Primary Keys: `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys: `Vlad`, `the count`
- Description: `How Count Vlad can actually be destroyed.`
- Content: `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Dlaczego akurat ten wpis zasługuje na kilka zaawansowanych kontrolek:

- **Selective** z takimi dodatkowymi słowami kluczowymi – `weakness`, `kill` i `destroy` to ogólne słowa związane z walką, które padają przy każdej potyczce drużyny. Dodatkowe słowa kluczowe przypinają wpis do hrabiego. Wpis milczy, gdy drużyna zabija wilka albo spiskuje przeciw rywalowi, a uruchamia się dopiero wtedy, gdy w grę wchodzi *jego* śmierć.
- **Whole Words** – bez tego `stake` pasowałoby do `mistake`, a `kill` do `skill`. Krótkie, pospolite słowa kluczowe prawie zawsze proszą się o dopasowanie do całych wyrazów.
- **Order 10** – kulminacyjna scena aktywuje wiele wpisów naraz i potrafi przekroczyć limit tokenów. Niska wartość Order ładuje ten wpis jako pierwszy. Nawet po przycięciu ogona listy przeżywa więc ten jeden fakt, na którym scena stoi.
- **Description** – agent Knowledge Router czyta ten opis i kieruje wpisem po znaczeniu. Reguła potrafi więc wypłynąć nawet wtedy, gdy w ostatniej wiadomości nie ma dokładnych słów kluczowych.

### Warianty, które nie mogą pojawić się razem

Wiejskie plotki o hrabim mają brzmieć niespójnie, ale dwie sprzeczne pogłoski nie mogą trafić do tej samej odpowiedzi. Wrzuć obie do jednej grupy **Group**, a prawdopodobieństwem zadbaj o to, żeby padały rzadko:

**Plotka: pakt** i **Plotka: ród** – *obie w grupie `count-rumor`, Probability 40%.*

- Słowa kluczowe obu wpisów: `rumor`, `they say`, `the count`
- Treści: `They say the count was once a crusader who bargained with something in the dark.` oraz `They say the count is not one man but a line of them, each wearing the last one's face.`
- Dlaczego grupa **Group** `count-rumor`: wpisy w jednej grupie wykluczają się nawzajem i na jedno generowanie aktywuje się tylko jeden. Obie plotki nigdy nie zaprzeczą sobie w tej samej wiadomości. Dlaczego **Probability 40%**: plotka, która wypływa przy każdej wzmiance o temacie, przestaje brzmieć jak plotka. Niższe szanse robią z niej okazjonalny, smakowity wtręt.

W całym lorebooku tylko założenia świata mają typ Constant. Jeden wpis łączy logikę **Selective** z niską wartością **Order**, a cała reszta zwyczajnie czeka na swoje słowa kluczowe. Dzięki temu prompt zostaje szczupły, a AI i tak dostaje właściwy fakt we właściwym momencie.

## Zastosowania poszczególnych ustawień

Strategia i przykład powyżej pokazują te kontrolki w połączeniach. Ta sekcja to szybka ściągawka: do czego *służy* każda kontrolka i jeden przykład na każdą.

### Dopasowanie

**Whole Words** – nie pozwala słowu kluczowemu pasować w środku dłuższego wyrazu.

- Przydaje się do: krótkich lub jednosylabowych słów kluczowych, skrótowców oraz słów będących fragmentem innych wyrazów.
- *Przykład:* słowo kluczowe `Ash` (imię postaci) pasuje do "Ash", ale nie do "ashes" ani "cash".

**Case Sensitive** – wielkość liter w słowie kluczowym musi zgadzać się dokładnie.

- Przydaje się do: słów kluczowych, które są też pospolitymi wyrazami pisanymi małą literą, skrótowców oraz kodów, w których wielkość liter coś znaczy.
- *Przykład:* `IT` (dział informatyczny) pasuje do "IT", ale nie do wyrazu "it".

**Regex** – traktuje słowo kluczowe jak wzorzec wyrażenia regularnego.

- Przydaje się do: kilku pisowni lub form naraz, opcjonalnych końcówek oraz liczb i kodów o stałym wzorcu. Buduj proste wzorce, bo każdy ma krótki limit czasu.
- *Przykład:* `\bVlad(?:'s)?\b` pasuje do "Vlad" i do "Vlad's" jako całych wyrazów.

### Typ wpisu

**Constant** – wstawia się w każdej turze, bez słowa kluczowego.

- Przydaje się do: założeń i podstawowych zasad świata, wytycznej co do tonu albo stylu oraz faktu tak ważnego, że AI nigdy nie może go stracić.
- *Przykład:* wpis typu Constant bez słów kluczowych – "Everyone speaks in period 1800s English." – jest obecny w każdej odpowiedzi.

**Selective (dodatkowe słowa kluczowe + logika)** – dokłada drugi warunek do głównych słów kluczowych.

- Przydaje się do: pospolitego głównego słowa kluczowego, które uruchamia wpis w niewłaściwej scenie, oraz wiedzy pojawiającej się tylko przy określonym połączeniu tematów. Blokuje też wpis, gdy pada dany termin.
- *Przykład (AND Any):* główne `king`, dodatkowe `Silverhaven` – wpis o królu uruchamia się tylko wtedy, gdy pada też Silverhaven.
- *Przykład (NOT Any):* główne `the prophecy`, dodatkowe `fulfilled` – wpis "niespełniona przepowiednia" jest blokowany, gdy przepowiednia już się spełni.

### Umiejscowienie

**Before chat / After chat** – miejsce wpisu względem historii czatu.

- Przydaje się do: większości wiedzy o świecie (Before chat, ustawienie domyślne) oraz podpowiedzi, która ma stać najbliżej kolejnej odpowiedzi modelu (After chat).
- *Przykład:* streszczenie frakcji na Before chat, krótkie przypomnienie "trzymaj się roli" na After chat.

**@ Depth (razem z Depth i Role)** – wstawia wpis *do środka* niedawnych wiadomości. Sięgaj po tę pozycję rzadko – zobacz ostrzeżenie w sekcji **Position, Depth i Order** powyżej.

- Przydaje się do: reguły, o której model wciąż zapomina w środku sceny, albo faktu, który dopiero się zmienił i musi wylądować obok ostatniej tury. Pole **Role** oznacza wstawioną linię jako **System**, **User** albo **Assistant**.
- *Przykład:* "Karczma właśnie stanęła w ogniu." na @ Depth 1 z rolą System.

**Order** – kolejność ładowania aktywowanych wpisów.

- Przydaje się do: wskazania zwycięskiego wpisu, gdy uruchamia się kilka, a limit jest ciasny, oraz do sterowania kolejnością powiązanych wpisów.
- *Przykład:* reguła kluczowa dla fabuły z Order 10 ładuje się przed wpisami klimatycznymi z domyślną wartością 100 i przeżywa przycinanie limitu.

**Outlet** – zbiera aktywowane wpisy w nazwanym makrze zamiast wstawiać je wprost.

- Przydaje się do: zebrania kilku wpisów w jednym miejscu promptu albo do zbudowania zmiennego bloku umieszczanego samodzielnie.
- *Przykład:* trzy wpisy z pozycją Outlet i nazwą `house_rules`. Wstaw `{{outlet::house_rules}}` w sekcji promptu, a pojawią się tam tylko te, które aktywowały się w tej turze, połączone w kolejności Order.

### Kiedy i jak często wpis się uruchamia

**Probability** – procentowa szansa na uruchomienie wpisu przy dopasowaniu słów kluczowych.

- Przydaje się do: okazjonalnego klimatu, losowych zdarzeń oraz cech, które mają wypływać tylko czasem.
- *Przykład:* "dziś karczmarz jest w podłym nastroju" z Probability 30%.

**Sticky** – utrzymuje wpis aktywny przez zadaną liczbę wiadomości po wyzwoleniu.

- Przydaje się do: zatrzymania faktu w treści promptu na kilka tur, żeby model nie zapomniał o nim w środku sceny.
- *Przykład:* ujawniony sekret z Sticky 3 zostaje aktywny przez trzy wiadomości po tym, jak padnie.

**Cooldown** – blokuje ponowne uruchomienie wpisu przez zadaną liczbę wiadomości po wyzwoleniu.

- Przydaje się do: powstrzymania dramatycznego lub ciężkiego wpisu przed powtarzaniem się w każdej wiadomości oraz do rozłożenia w czasie powracającego zdarzenia.
- *Przykład:* omen "ziemia drży" z Cooldown 5 uruchamia się najwyżej raz na pięć wiadomości.

**Delay** – wpis nie może się uruchomić, dopóki czat nie osiągnie zadanej liczby wiadomości.

- Przydaje się do: wiedzy, która nie powinna pojawić się na samym początku, oraz do zwrotu akcji lub późniejszego faktu wstrzymanego do czasu rozwinięcia historii.
- *Przykład:* wpis "mentor od początku był zdrajcą" z Delay 20.

**Ephemeral** – wpis wyłącza się sam po zadanej liczbie aktywacji.

- Przydaje się do: treści jednorazowej lub prawie jednorazowej – wstępu, notatki o pierwszym spotkaniu, podpowiedzi z samouczka.
- *Przykład:* "Budzisz się bez żadnych wspomnień o drodze w to miejsce." z Ephemeral 1 uruchamia się raz, a potem sam się wyłącza.

### Porządkowanie i sterowanie

**Group** – sprawia, że wpisy wykluczają się nawzajem, bo na jedną odpowiedź aktywuje się tylko jeden z grupy.

- Przydaje się do: wariantów (jedna z kilku plotek, nastrojów albo wersji) oraz puli losowego wyboru.
- *Przykład:* trzy wpisy "pogoda na dziś" w grupie `weather` – na jedną odpowiedź wybierany jest dokładnie jeden.

**Tag** – dowolna etykieta tekstowa do własnego sortowania. Nie wpływa na aktywację.

- Przydaje się do: porządkowania i filtrowania wpisów w edytorze.
- *Przykład:* oznacz wpisy tagami `npc`, `location` albo `wip`, żeby szybciej je znaleźć i uporządkować.

**Description** – streszczenie, które agent Knowledge Router czyta, żeby pokierować wpisem. Nigdy nie trafia do AI jako treść.

- Przydaje się do: opisania zwykłym językiem gęstego wpisu albo wpisu pełnego makr, żeby agent dopasował go po znaczeniu, oraz do notatki dla siebie.
- *Przykład:* wpis pełen makr formatujących dostaje w polu Description opis "zasady areny pojedynków".

**Recursion (dla pojedynczego wpisu)** – pozwala treści tego wpisu wyzwalać kolejne wpisy. Domyślnie wyłączone.

- Przydaje się do: wpisu, który *ma* pociągać za sobą ograniczony zestaw powiązanej wiedzy. We wpisach zbiorczych zostaw to wyłączone (zobacz sekcję **Uporządkuj wiedzę o świecie jak drzewo** powyżej).
- *Przykład:* wpis "Drużyna wchodzi do lasu Thornwood." z włączoną rekurencją i treścią wymieniającą charakterystyczne miejsca tego lasu, dzięki czemu tamte wpisy też się aktywują.

**No Vector** – wyłącza wpis z wyszukiwania semantycznego.

- Przydaje się do: powstrzymania ogólnego lub szablonowego wpisu przed zaśmiecaniem dopasowań po znaczeniu oraz do wpisu, który ma reagować wyłącznie na swoje dokładne słowa kluczowe.
- *Przykład:* oznacz wpis z instrukcją formatowania jako No Vector, żeby nigdy nie wypłynął jako semantyczne trafienie w "powiązaną wiedzę".

**Locked** – chroni wpis przed agentem Lorebook Keeper.

- Przydaje się do: ręcznie dopieszczonego wpisu, którego automatyczna poprawka nie powinna przepisać.
- *Przykład:* zablokuj starannie sformułowane założenia świata, żeby agent Keeper nie mógł ich zmienić.

**Context filters** – ograniczają wpis do wybranych postaci, tagów postaci albo typów generowania.

- Przydaje się do: wiedzy, która dotyczy tylko części postaci albo tylko części typów generowania.
- Filtr postaci nie tylko ukrywa wpis w innych czatach. W czacie grupowym trzyma wpis z dala od odpowiedzi *pozostałych postaci* i aktywuje go tylko wtedy, gdy odpowiada wskazana postać. Świetnie nadaje się do prywatnych historii, sekretów i wiedzy, którą ma jedna postać, a reszta mieć nie powinna.
- *Przykład:* przypisz sekretną lojalność szpiega filtrem do tej właśnie postaci. Zasila wtedy jej własne odpowiedzi, ale nigdy nie wycieka do odpowiedzi postaci, które oszukuje.

## Makra w treści wpisu

Pole **Content** wpisu rozwija się jak każdy inny tekst promptu: makra promptu rozwiązują się przed wstawieniem treści. Kilka makr szczególnie przydatnych we wpisach lorebooka:

- `{{char}}` i `{{user}}` – imię bieżącej postaci oraz imię użytkownika lub persony, dzięki czemu wspólny wpis brzmi naturalnie w każdym czacie.
- `{{random::a::b::c}}` i `{{roll:1d6}}` – losują opcję albo rzucają kością, żeby klimat zmieniał się przy każdym uruchomieniu wpisu. Dodaj wagi po `@`, jak w `{{random::common@3::rare@1}}`, żeby część opcji wypadała częściej.
- `{{#if ...}}...{{else}}...{{/if}}` – zmienia tekst zależnie od tego, kto mówi, od zmiennej albo od aktywnej postaci.
- `{{getvar::name}}` i `{{setvar::name::value}}` – odczytują albo ustawiają trwałą zmienną lokalną czatu, dzięki czemu wpis reaguje na stan lub nim steruje w kolejnych turach, bez przenoszenia wartości do innych czatów.

Losowanie z wagami dobrze łączy się z **Probability** i pozwala zwinąć całą tabelę w jeden wpis. Zamiast grupy dwudziestu wpisów o potworach zrób jeden wpis "wędrujące starcie". Daj mu niskie **Probability**, żeby starcie zdarzało się tylko czasem, i ważoną listę tego, co się pojawia:

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

Wpis uruchamia się tylko czasem, a wtedy losuje jedno starcie. Wagi sprawiają, że pospolici przeciwnicy wypadają częściej niż rzadcy. Nie trzeba przy tym utrzymywać osobnego kompendium wpisów.

Zostaw notatkę, która nigdy nie dotrze do AI, za pomocą **makra komentarza**:

- `{{// draft wording, revisit later}}` – wszystko w środku `{{// ... }}` znika z wyniku.

**Uwaga o rekurencji.** Przy włączonym skanowaniu **Recursive** dla lorebooka (zobacz [Limity tokenów i rekurencja](token-budgets.md)) Marinara przeszukuje ponownie *rozwiniętą* treść aktywowanych wpisów w poszukiwaniu kolejnych słów kluczowych. Makra rozwiązują się jako pierwsze, więc tekst wyprodukowany przez makro potrafi wyzwolić dalsze wpisy. Treść, która rozwija się do jakiejś nazwy, aktywuje na przykład wpis ze słowem kluczowym o tej nazwie. Wyjątkiem jest `{{// comment}}`: przed ponownym skanowaniem znika bez śladu, więc jego tekst nigdy niczego nie wyzwoli. Komentarze służą wyłącznie do notatek. Tekst, który ma zasilać rekurencję, zapisz zwyczajnie.

## Częste problemy

- **Wpis nigdy się nie uruchamia.** Przy wpisie typu **Normal** bez słów kluczowych dopasowanie po słowach nie ma czego złapać – dodaj wpisowi słowa kluczowe albo ustaw typ **Constant**. (Wpis bez słów kluczowych nadal da się przywołać po znaczeniu, ale tylko przy w pełni skonfigurowanym wyszukiwaniu semantycznym. Potrzebne są: włączony przełącznik **Vectors**, ustawiony model embeddingów i zwektoryzowany wpis – zobacz [Wyszukiwanie semantyczne](semantic-search.md).) Sprawdź też, czy lorebook jest włączony i aktywny w czacie.
- **Słowo kluczowe przestało działać.** Marinara dopasowuje słowa kluczowe tylko w kilku ostatnich wiadomościach – tyle, ile mówi pole **Scan Depth** lorebooka (domyślnie 2). Gdy słowo wyzwalające wyjedzie poza to okno, wpis milknie. Podnieś **Scan Depth**, dodaj **Sticky**, żeby fakt został po uruchomieniu, albo ustaw typ **Constant**.
- **Wpis uruchamia się w niewłaściwych scenach.** Szerokie słowo kluczowe w rodzaju `home` czy `king` pasuje do zbyt wielu rzeczy. Zawęź je przełącznikiem **Whole Words**, zabezpiecz dodatkowymi słowami kluczowymi typu **Selective** albo nałóż na wpis filtr właściwej postaci.
- **Ważna wiedza wciąż wypada.** Gdy pasuje więcej wpisów, niż mieści limit, przycinany jest ogon listy. Ustaw ważnym wpisom niższe **Order**, podnieś **Token Budget** albo przenieś obszerną wiedzę encyklopedyczną za agenta Knowledge Router. Panel **Active Context** pokazuje dokładnie, co zostało pominięte i dlaczego (zobacz [Limity tokenów i rekurencja](token-budgets.md)).
- **AI ignoruje twoją wiedzę o świecie.** Sprawdź w panelu **Active Context**, czy wpis naprawdę się aktywował. Pamiętaj też, że konkuruje z resztą promptu: fakt zakopany daleko od ostatniej tury ciągnie słabiej niż ten na **After chat** albo – rzadko – na **@ Depth**.

## Lista kontrolna przy pisaniu wpisu

Szybki przegląd każdego pisanego wpisu:

1. **Nadaj mu jasną nazwę** – nazwa jest dla ciebie i dla wyszukiwania, a nie dla AI.
2. **Zdecyduj, jak ma się uruchamiać:** fakt zawsze prawdziwy → **Constant**, wszystko inne → **Normal** z trzema do ośmiu konkretnymi **słowami kluczowymi**.
3. **Okiełznaj zbyt ogólne słowa kluczowe** przełącznikiem **Whole Words** albo rozłóż je na dodatkowe słowa kluczowe typu **Selective**.
4. **Napisz treść** jako zwykły fakt, w tylu tokenach, ile naprawdę trzeba.
5. **Wypełnij pole Description**, jeśli korzystasz z agenta Knowledge Router.
6. **Zostaw umiejscowienie na wartościach domyślnych**, o ile wpis naprawdę nie potrzebuje własnego **Position**, **Depth** albo **Order**.
7. Wzajemnie wykluczające się warianty wrzuć do jednej grupy **Group**, a wiedzę o konkretnej postaci ogranicz **filtrem** do tej postaci.
8. **Przetestuj** go w panelu **Keyword test**, a potem obserwuj **Active Context** w prawdziwym czacie, żeby sprawdzić, czy się uruchamia i mieści w limicie.

## Narzędzie Keyword test

Panel **Keyword test** (test słów kluczowych) na górze zakładki **Entries** pozwala sprawdzić słowa kluczowe bez rozpoczynania czatu. Rozwiń go i wklej do pola przykładowy akapit albo kilka wiadomości.

Wpisy, których słowa kluczowe by pasowały, dostają zielone wyróżnienie i kafelek **Would activate**. Wpisy typu **Constant** dostają kafelek **Always active**, bo uruchamiają się niezależnie od treści tekstu. Linia z licznikiem pokazuje, ile z włączonych wpisów by się aktywowało.

Ten test sprawdza wyłącznie reguły słów kluczowych. Pomija czas działania, prawdopodobieństwo, filtry postaci i dopasowanie semantyczne, więc żywy czat może wypaść inaczej niż podgląd.

## Foldery wpisów

Foldery grupują wpisy wewnątrz jednego lorebooka. To co innego niż foldery biblioteki w głównym panelu **Lorebooks**.

- Kliknij przycisk **Add Folder**, żeby utworzyć folder, a potem zmień jego nazwę na miejscu.
- Przeciągnij wpis na folder, żeby go tam umieścić, albo wskaż folder w polu **Folder** we wpisie.
- Przeciągnij folder na inny folder, żeby go zagnieździć, albo przeciągnij go na górny pasek, żeby wyciągnąć go na najwyższy poziom.
- Każdy folder ma przełącznik **Enabled** (włączony). Wyłączony folder zatrzymuje aktywację wszystkich wpisów w środku, nawet jeśli własny przełącznik wpisu jest włączony.
- Nagłówek folderu ma też przyciski **Clone** (klonowanie) i **Delete**. **Clone** kopiuje folder w całości, razem ze wszystkimi wpisami i podfolderami. **Delete** usuwa wyłącznie sam folder. Jego wpisy i podfoldery przechodzą poziom wyżej.

Foldery wyświetlają się jako grupy tylko przy sortowaniu **Order** i pustym wyszukiwaniu. Każde inne sortowanie lub wyszukiwanie przełącza widok na płaską listę i pokazuje notkę "Folder view paused (clear search and sort by Order)".

## Powiązane przewodniki

- [Lorebooki – przegląd](overview.md)
- [Limity tokenów i rekurencja w lorebookach](token-budgets.md)
- [Wyszukiwanie semantyczne w lorebookach](semantic-search.md)
- [Źródła wiedzy: agenci Knowledge Retrieval i Knowledge Router](../agents/knowledge-sources.md)
