# Card Browser: wyszukiwanie i importowanie postaci

Ten przewodnik wyjaśnia, do czego służy panel **Card Browser** (przeglądarka kart) w aplikacji Marinara Engine. To wbudowane narzędzie wyszukuje karty postaci na publicznych stronach i importuje je do biblioteki. Poznasz dostępne źródła, sposoby wyszukiwania i filtrowania oraz zasady dotyczące treści dla dorosłych w każdym źródle. Dowiesz się też, jak zaimportować postać albo zapisać ją jako plik. W starszych wersjach ta zakładka nosiła nazwę **Bot Browser** lub **Browser**.

Karta postaci to plik z imieniem jednej postaci, jej osobowością, powitaniem i innymi szczegółami. Zwykle trzeba pobrać kartę ze strony internetowej, a potem wgrać ją do aplikacji Marinara. Panel **Card Browser** wykonuje oba kroki w jednym miejscu.

## Do czego służy Card Browser

Panel **Card Browser** przeszukuje kilka publicznych stron z kartami postaci bez wychodzenia z aplikacji Marinara. Obsługuje pięć źródeł: **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern** i **DataCat**. Źródło **CharacterTavern** nadal jest na liście, ale na razie nie da się go przeglądać (zobacz [CharacterTavern](#charactertavern)). Wybrane źródło da się przeszukać, wyniki przefiltrować, a szczegóły postaci obejrzeć przed decyzją. Potem wystarczy zaimportować postać do biblioteki albo zapisać ją jako plik PNG. Przy ustawieniach domyślnych przeglądanie i importowanie kart postaci nie wymaga konta ani klucza API (tajnego kodu, trochę jak hasło).

## Otwieranie panelu Card Browser

Panel **Card Browser** otwiera się na dwa sposoby.

1. Kliknij ikonę **Card Browser** na górnym pasku. Znajdziesz ją w rzędzie przycisków paneli po prawej stronie.
2. Inna opcja: otwórz panel **Card Browser** na prawym pasku bocznym, a potem kliknij przycisk **Download Cards** (pobranie kart) u góry tego panelu.

W obu przypadkach cały obszar treści przełącza się na pełny widok **Card Browser**. Ten widok zastępuje obszar czatu. To nie jest małe okienko.

Aby wyjść, kliknij przycisk ze strzałką wstecz w lewym górnym rogu nagłówka **Card Browser**. Aplikacja wraca do poprzedniego ekranu.

Panel **Card Browser** pozostaje wczytany przez cały czas działania aplikacji. Po zamknięciu i ponownym otwarciu ostatnie wyszukiwanie, filtry i wybrana postać nadal tam są. Dopiero przeładowanie całej aplikacji resetuje ten stan.

## Wybór źródła

Kliknij przycisk źródła w nagłówku. Widnieje na nim nazwa bieżącego źródła i mała strzałka. Otwiera się menu ze źródłami w tej kolejności: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern** i **DataCat**. Źródło **CharacterTavern** ma oznaczenie **Unavailable** (Niedostępne).

Przy pierwszym otwarciu panelu **Card Browser** wybrane jest źródło **ChubAI**. Zmiana źródła czyści wpisany tekst wyszukiwania, tagi i filtry. Każde źródło pamięta własne ustawienie treści dla dorosłych i własne logowanie, więc zmiana w jednym źródle nie wpływa na pozostałe.

Jedna uwaga o nazewnictwie: menu wymienia **ChubAI**, ale na stronie ze szczegółami postaci link zewnętrzny nosi nazwę **View on Chub**. Tak nazywa siebie sama strona. Pozostałe źródła używają w obu miejscach tej samej nazwy.

## CharacterTavern

Serwis CharacterTavern przebudował swoją stronę i nie udostępnia już połączenia, przez które Marinara wyszukiwała i pobierała karty. Po wybraniu źródła **CharacterTavern** panel **Card Browser** zamiast wyników wyszukiwania pokazuje krótki komunikat. Przeglądanie może wrócić, jeśli serwis CharacterTavern zapewni dostęp do API.

Do tego czasu postacie z serwisu CharacterTavern nadal da się ręcznie przenieść do aplikacji Marinara:

1. Kliknij **Open CharacterTavern** (Otwórz CharacterTavern) w komunikacie. Strona otwiera się w nowej zakładce.
2. Pobierz plik karty postaci ze strony character-tavern.com.
3. Kliknij **Import Character** (import postaci) w komunikacie i wybierz pobrany plik. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

Postacie zaimportowane wcześniej z serwisu CharacterTavern zostają w bibliotece.

## Wyszukiwanie, sortowanie i strony

Wpisz tekst w polu **Search characters...**, żeby wyszukać. Nie trzeba naciskać klawisza Enter. Marinara odczekuje chwilę (około pół sekundy) po zakończeniu pisania i wyszukuje automatycznie. Wyczyszczenie pola albo zmiana filtra również uruchamia wyszukiwanie od nowa.

Obok pola wyszukiwania jest lista rozwijana sortowania. Opcje różnią się w każdym źródle, a każde źródło startuje z własnym domyślnym sortowaniem:

| Źródło    | Domyślne sortowanie |
| --------- | --------------- |
| ChubAI    | Most Downloaded |
| JannyAI   | Newest          |
| Pygmalion | Downloads       |
| Wyvern    | Popular         |
| DataCat   | Relevance       |

Kliknij przycisk **Refresh** (odświeżenie, ikona okrągłej strzałki), aby powtórzyć bieżące wyszukiwanie.

Pod wynikami znajdziesz przyciski **Previous** (poprzednia) i **Next** (następna) oraz etykietę strony, na przykład **Page 2**. Kiedy źródło nie potrafi podać dokładnej sumy, widać tylko numer bieżącej strony.

Jedna uwaga o źródle **DataCat**: sortowanie **Fresh** pokazuje świeże wyniki tylko wtedy, gdy nie ma ani filtra tagów, ani tekstu wyszukiwania. Po wpisaniu tekstu lub wybraniu tagu **DataCat** wraca do zwykłych wyników według trafności.

## Filtrowanie po tagach

Kliknij przycisk **Tags** (tagi) na pasku narzędzi, aby otworzyć panel tagów.

- Wpisz tekst w polu **Search tags...**, żeby skrócić listę tagów.
- Kliknij zielony znacznik obok tagu, aby go uwzględnić. Kliknij czerwony minus, aby go wykluczyć. Tag może być uwzględniony albo wykluczony, nigdy jedno i drugie naraz.
- Uwzględnione tagi pokazują się jako zielony kafelek, wykluczone jako czerwony. Kliknięcie kafelka usuwa go.
- Przycisk **Clear** (wyczyszczenie) usuwa wszystkie aktywne tagi.

W większości źródeł lista tagów powstaje na podstawie postaci z ostatnich wyszukiwań. Przed pierwszym wyszukiwaniem panel wyświetla napis **Tags will appear after searching**. Jeśli brakuje potrzebnego tagu, wpisz jego nazwę. Pojawiają się wtedy dwa przyciski: jeden dodaje tag jako filtr, drugi blokuje go w wynikach.

Źródło **DataCat** działa inaczej. Od razu wczytuje najpopularniejsze tagi, bo jego lista tagów jest bardzo długa. Każdy inny tag nadal można wpisać ręcznie.

## Dodatkowe filtry

Niektóre źródła dokładają na pasku narzędzi przycisk **Filters** (filtry). Widać go tylko wtedy, gdy źródło ma jakieś filtry do zaoferowania, więc dla źródła **DataCat** się nie pojawia. Mała plakietka pokazuje liczbę aktywnych filtrów.

Panel filtrów może zawierać:

- Pola wyboru treści, na przykład **Lorebook** lub **Alt Greetings**, które zostawiają tylko postacie z daną cechą. Lorebook (zbiór faktów o twoim świecie) to dodatkowe informacje tła, które postać może nosić ze sobą.
- Ustawienie **Sort Direction** (kierunek sortowania) z wartościami **Descending** albo **Ascending**, dostępne w źródłach **ChubAI** i **Pygmalion**.
- Pola liczbowe **Min Tokens** i **Max Output Tokens**, które ograniczają wyniki według rozmiaru. Zostawione puste oznaczają wartość domyślną danego źródła. Token to mały kawałek tekstu.
- Źródło **JannyAI** ma przełącznik **Show Low Quality**. Domyślnie jest wyłączony i ukrywa postacie oznaczone przez **JannyAI** jako niskiej jakości. Włącz go, aby je zobaczyć.

Uwaga o źródle **Wyvern**: pola wyboru **Lorebook** i **Alt Greetings** są widoczne, podobnie jak pola **Min Tokens** i **Max Output Tokens**. Żadne z nich nie zmienia wyników w źródle **Wyvern**. Do zawężania wyników w tym źródle służą lista rozwijana sortowania i tagi.

## Treści dla dorosłych (NSFW) w poszczególnych źródłach

Treści dla dorosłych aplikacja oznacza jako **NSFW**. Na pasku narzędzi jest jedno pole wyboru **NSFW**, ale każde źródło traktuje je inaczej. To najczęstsze pytanie, więc czytaj uważnie.

- **ChubAI** i **JannyAI**: pole wyboru **NSFW** działa od razu, bez logowania. Domyślnie jest wyłączone.
- **Pygmalion**: pole wyboru **NSFW** jest wyszarzone do czasu zalogowania. Podpowiedź prosi o wcześniejsze zalogowanie. Po zalogowaniu aplikacja stosuje ustawienia konta w serwisie Pygmalion. Pole wyboru pokazuje wtedy napis **NSFW depends on your account settings**. Po zalogowaniu nie ma już osobnego przełącznika włącz/wyłącz.
- **Wyvern**: pole wyboru **NSFW** jest zawsze wyszarzone. Komunikat brzmi **Use "🔞 Popular NSFW" sort for NSFW content**. Aby zobaczyć treści dla dorosłych w tym źródle, wybierz opcję **🔞 Popular NSFW** na liście rozwijanej sortowania.
- **DataCat**: każda postać ma tam tag treści dla dorosłych, więc pole wyboru jest zablokowane we włączonej pozycji. Przy pierwszym wyborze źródła **DataCat** pojawia się okno o tytule **DataCat is NSFW only**. Kliknij **Continue to DataCat**, aby je przeglądać, albo **Don't continue to DataCat**, aby wrócić.

Postacie dla dorosłych mają małą czerwoną plakietkę **NSFW** w rogu miniatury.

## Logowanie do serwisu Pygmalion

Źródło **Pygmalion** ukrywa treści dla dorosłych za logowaniem. Zwykłe, publiczne postacie są dostępne bez logowania. Logowanie odblokowuje wyłącznie treści dla dorosłych.

Aby się zalogować, kliknij przycisk **Log In** (zalogowanie) na pasku narzędzi. Otwiera się okno logowania. Wklejasz w nim wartość skopiowaną z własnego konta w serwisie Pygmalion. Marinara nie prosi o hasło.

Dla źródła **Pygmalion** okno nosi tytuł **Pygmalion Authentication** i prosi o wartość **Auth Token**:

1. Wejdź na pygmalion.chat i zaloguj się na swoje konto.
2. Otwórz narzędzia deweloperskie przeglądarki. W większości przeglądarek służy do tego klawisz F12. Narzędzia deweloperskie to wbudowany panel przeglądarki dla zaawansowanych użytkowników.
3. Otwórz zakładkę **Application**, a w niej **Local Storage**.
4. Znajdź wpis o nazwie `authn` i skopiuj jego wartość.
5. Wklej wartość w pole **Auth Token** w aplikacji Marinara.
6. Kliknij przycisk **Save & Connect**. Powinien pojawić się komunikat o włączeniu treści NSFW.

Okno ma sekcję pomocy, która powtarza powyższe kroki, oraz link **Website**, który otwiera stronę pygmalion.chat. Aby się wylogować, otwórz okno logowania ponownie i kliknij przycisk **Log Out**.

Ważne: te dane logowania serwer trzyma tylko w pamięci. Nigdy nie trafiają do pliku. Po restarcie serwera Marinara logowanie przepada i trzeba wkleić token jeszcze raz. Marinara wyświetla wtedy komunikat z prośbą o ponowne zalogowanie.

## Przeglądanie postaci przed importem

Kliknij dowolną kartę wyniku, aby otworzyć widok szczegółów. Przycisk **Back to results** (powrót do wyników) wraca na listę.

Widok szczegółów pokazuje awatar postaci, imię, autora, krótki opis i do dwudziestu kafelków z tagami. Jest tam też link **View on**, który otwiera oryginalną stronę postaci w nowej zakładce.

Poniżej znajdują się pełne szczegóły postaci, widoczne tylko wtedy, gdy źródło je udostępnia. Te sekcje mają nagłówki takie jak **Creator's Notes**, **Personality**, **Scenario**, **First Message** i **Alternate Greetings**. Bursztynowa plakietka **Has embedded lorebook** pojawia się, gdy postać niesie ze sobą lorebook.

Niektóre źródła nie zawsze zwracają pełne szczegóły. Jeśli nic się nie wczyta, widok informuje, że postać nadal można zaimportować z podstawowymi danymi.

## Import lub pobranie postaci

Widok szczegółów daje dwa przyciski. Przycisk **Import** (import) dodaje postać do biblioteki w aplikacji Marinara. Przycisk **Download as PNG** (pobranie jako PNG) zapisuje postać jako plik na urządzeniu, bez dodawania jej do biblioteki.

Aby zaimportować karty postaci do biblioteki:

1. Otwórz widok szczegółów postaci.
2. Wybierz opcję w sekcji **Imported tags** (importowane tagi) – patrz tabela poniżej.
3. Kliknij przycisk **Import**. W trakcie pracy przycisk pokazuje napis **Importing...**.
4. Zaczekaj na komunikat o powodzeniu. Powinien pojawić się komunikat o zaimportowaniu postaci.
5. Otwórz panel **Characters**, żeby znaleźć zaimportowaną postać, zanim zaczniesz czat.

Zaimportowana postać zachowuje się jak każda inna. Do rozmowy z nią potrzebne jest jeszcze działające połączenie z dostawcą. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

### Importowane tagi

Sekcja **Imported tags** obok awatara decyduje o tym, które tagi trafiają do aplikacji razem z postacią. Domyślna wartość to **All tags**.

| Opcja        | Działanie                                 |
| ------------- | -------------------------------------------- |
| All tags      | Zachowuje tagi ze źródła.                     |
| No tags       | Pomija tagi ze źródła.                     |
| Existing only | Zachowuje tylko tagi używane już w aplikacji Marinara. |

### Pytanie o dołączony lorebook

Jeśli postać niesie ze sobą dołączony lorebook, przy imporcie przeglądarka wyświetla małe okno potwierdzenia. Pyta ono, czy zapisać ten lorebook również jako osobny, samodzielny lorebook w aplikacji Marinara. Kliknij **OK**, aby utworzyć osobny lorebook obok kopii przypisanej do postaci. Kliknij **Cancel**, aby zostawić lorebook wyłącznie przy postaci.

### Pobieranie jako PNG

Kliknij przycisk **Download as PNG**, aby zapisać postać jako standardowy plik karty postaci w formacie PNG. W trakcie pracy przycisk pokazuje napis **Building PNG...**. Działa to w każdym źródle. Zapisany plik nosi nazwę postaci, na przykład `Some_Character.png`. Takim plikiem da się podzielić albo zaimportować go później do innej aplikacji.

JSON i PNG to dwa popularne formaty tych samych danych postaci. JSON to zwykły format tekstowy. Karta PNG to plik obrazu z danymi postaci zapisanymi w środku. Oba niosą kompletną postać.

## Twoje zaimportowane postacie

Panel **Card Browser** na prawym pasku bocznym prowadzi osobną listę postaci zaimportowanych przez panel **Card Browser**. Postacie utworzone ręcznie albo zaimportowane inną drogą tu nie trafiają. Wszystkie i tak widać w głównej bibliotece **Characters**.

- Przycisk **Download Cards** otwiera pełny widok **Card Browser**.
- Pole **Search imported...** filtruje tę listę.
- Lista rozwijana sortowania oferuje **A-Z**, **Z-A**, **Newest** i **Oldest**.
- Kliknij wiersz prawym przyciskiem myszy albo użyj jego przycisków, aby znaleźć **Quick Start Roleplay** i **Quick Start Conversation**. Otwierają one nowy czat z tą postacią. Stąd też da się usunąć postać z tej listy.

## Rozwiązywanie problemów

**Wyszukiwanie lub szczegóły w źródle JannyAI kończą się błędem Cloudflare.** Niektóre strony blokują zautomatyzowane zapytania. Odwiedź raz jannyai.com w tej samej przeglądarce, przejdź ewentualne zabezpieczenie, a potem wróć do aplikacji Marinara i wyszukaj ponownie.

**Logowanie do serwisu Pygmalion przestało działać.** Restart serwera Marinara czyści te dane logowania. Otwórz okno **Log In** jeszcze raz i wklej token ponownie.

**Źródło CharacterTavern pokazuje tylko komunikat.** Tak ma być. Jak zaimportować karty z tego serwisu jako pliki, opisuje sekcja [CharacterTavern](#charactertavern).

**Wyszukiwanie się nie udaje albo źródło przestaje działać.** Publiczne strony mogą w każdej chwili zmienić swoje podstrony lub zablokować dostęp. Spróbuj później. Jeśli źródło zawodzi uparcie, otwórz postać bezpośrednio na stronie i pobierz kartę samodzielnie. Potem wczytaj ją zwykłą drogą importu. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Rozwiązywanie problemów](../TROUBLESHOOTING.md)
