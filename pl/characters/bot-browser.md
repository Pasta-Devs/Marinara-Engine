# Card Browser: wyszukiwanie i importowanie postaci

Panel **Card Browser** (przeglądarka kart) wyszukuje karty postaci na publicznych stronach i importuje je do biblioteki bez wychodzenia z aplikacji Marinara Engine, więc nie trzeba ręcznie pobierać i wgrywać plików. W starszych wersjach nosił nazwę **Bot Browser** lub **Browser**.

Karta postaci to plik z imieniem jednej postaci, jej osobowością, powitaniem i innymi szczegółami. Przy ustawieniach domyślnych przeglądanie i importowanie nie wymaga konta ani klucza API.

## Otwieranie panelu Card Browser

1. Kliknij **Characters** (postacie) albo **Personas** (persony) na górnym pasku nawigacji. Jeśli tych pozycji nie widzisz, najpierw otwórz **More** (więcej).
2. Kliknij przycisk **Download** (pobranie) u góry. Jego podpowiedź brzmi **Download character cards** (pobieranie kart postaci).

Panel Card Browser wypełnia cały obszar treści i ma tytuł **Browse character cards online** (przeglądanie kart postaci online). Aby wyjść, kliknij strzałkę wstecz w lewym górnym rogu.

Po zamknięciu i ponownym otwarciu ostatnie wyszukiwanie, filtry i wybrana postać nadal tam są. Przeładowanie aplikacji je resetuje.

## Wybór źródła

Kliknij przycisk źródła w nagłówku. Menu wymienia po kolei: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** i **PlotLight Personas**. Za pierwszym razem wybrane jest źródło **ChubAI**. Zmiana źródła czyści wpisany tekst wyszukiwania, tagi i filtry. Każde źródło pamięta własne ustawienie treści dla dorosłych i własne logowanie.

| Źródło | Treści dla dorosłych (NSFW) |
| --- | --- |
| **ChubAI** | Pole wyboru **NSFW** działa. Domyślnie wyłączone. |
| **JannyAI** | Pole wyboru **NSFW** działa. Domyślnie wyłączone. |
| **Pygmalion** | Wyszarzone, dopóki się nie [zalogujesz](#log-in-to-pygmalion). Potem aplikacja stosuje ustawienia twojego konta w serwisie Pygmalion. |
| **Wyvern** | Zawsze wyszarzone. Zamiast tego wybierz sortowanie **🔞 Popular NSFW**. |
| **DataCat** | Każda karta ma tag treści dla dorosłych, więc pole wyboru jest zablokowane we włączonej pozycji. |
| **PlotLight** i **PlotLight Personas** | Zawsze wyszarzone. Serwis PlotLight stosuje własne zasady. Wyniki z tagiem treści dla dorosłych dostają plakietkę **NSFW**. |

Nie wiesz, od czego zacząć? Użyj pierwszego źródła, **ChubAI**. Każde źródło startuje z własną kolejnością sortowania, którą można zmienić na liście rozwijanej sortowania.

Karty dla dorosłych mają małą czerwoną plakietkę **NSFW** na miniaturze. Menu wymienia **ChubAI**, ale link zewnętrzny karty nosi nazwę **View on Chub** (wyświetlenie w serwisie Chub), bo tak nazywa siebie sama strona.

### DataCat

Przy pierwszym wyborze źródła **DataCat** pojawia się okno o tytule **DataCat is NSFW only** (DataCat zawiera wyłącznie treści NSFW). Kliknij **Continue to DataCat** (przejdź do DataCat), żeby przeglądać, albo **Don't continue to DataCat** (nie przechodź do DataCat), żeby wrócić. W tym źródle sortowanie **Fresh** (najświeższe) pokazuje świeże wyniki tylko wtedy, gdy nie ma ani filtra tagów, ani tekstu wyszukiwania.

### CharacterTavern

Serwis CharacterTavern przebudował swoją stronę i nie udostępnia już połączenia, z którego korzystała Marinara. Po wybraniu tego źródła zamiast wyników pojawia się komunikat. Przeglądanie może wrócić, jeśli serwis CharacterTavern zapewni dostęp do API. Do tego czasu importuj jego karty ręcznie:

1. Kliknij **Open CharacterTavern** (otwórz CharacterTavern) w komunikacie. Strona otwiera się w nowej karcie przeglądarki.
2. Pobierz plik karty ze strony character-tavern.com.
3. Kliknij **Import Character** (import postaci) w komunikacie i wybierz plik. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md).

Postacie zaimportowane wcześniej z tego serwisu zostają w bibliotece.

### PlotLight

Serwis PlotLight udostępnia publiczne postacie i persony. Źródło **PlotLight** pokazuje listę kart postaci. Źródło **PlotLight Personas** (persony z serwisu PlotLight) pokazuje listę person, czyli postaci, które reprezentują ciebie w czatach. Konto w serwisie PlotLight nie jest potrzebne. Widok szczegółów ma link **View on PlotLight** (wyświetlenie w serwisie PlotLight) do oryginalnej strony.

Marinara pobiera plik, który udostępnia serwis PlotLight. Karta postaci przychodzi zwykle jako plik PNG z portretem i lorebookiem, jeśli autor pozwala go dołączyć. Persona przychodzi jako plik tekstowy, a Marinara kopiuje jej obraz osobno. Każdy z tych rodzajów da się zaimportować jako postać albo jako personę.

Serwis PlotLight ogranicza, jak szybko aplikacje mogą wysyłać do niego zapytania. Jeśli działasz zbyt szybko, Marinara wyświetla komunikat **PlotLight is busy** (serwis PlotLight jest zajęty) z liczbą sekund i czeka właśnie tyle. Wyszukiwanie i importowanie mają osobne limity.

Niektórych kart nie da się pobrać, na przykład wtedy, gdy autor na to nie pozwala. Marinara wyświetla wtedy komunikat **PlotLight doesn't offer this for download.** Takiej karty nie da się zaimportować ani zobaczyć jej szczegółów, ale jej obraz, autor i link **View on PlotLight** zostają.

## Wyszukiwanie, sortowanie i strony

Wpisz tekst w polu **Search characters** (wyszukiwanie postaci). Nie trzeba naciskać <kbd>Enter</kbd>. Marinara wyszukuje chwilę po tym, jak przestaniesz pisać, i ponownie, gdy wyczyścisz pole albo zmienisz filtr. Każde źródło ma własną listę rozwijaną sortowania. Kliknij przycisk **Refresh** (odświeżenie, okrągła strzałka), żeby uruchomić wyszukiwanie ponownie.

Pod wynikami są przyciski **Previous** (poprzednia) i **Next** (następna) z etykietą w rodzaju **Page 2**. Kiedy źródło nie potrafi podać sumy, widać tylko bieżącą stronę. Źródło **PlotLight** nigdy nie podaje sumy, więc nagłówek pokazuje napis **Browsing PlotLight** (przeglądanie serwisu PlotLight). Strona z serwisu PlotLight może zawierać niewiele kart albo żadnej, a mimo to mieć po sobie kolejne strony. Przycisk **Next** pozostaje włączony, więc da się przeglądać dalej.

## Filtrowanie po tagach

1. Kliknij **Tags** (tagi) na pasku narzędzi.
2. Wpisz tekst w polu **Search tags** (wyszukiwanie tagów), żeby skrócić listę.
3. Kliknij zielony znak zaznaczenia obok tagu, żeby go uwzględnić, albo czerwony minus, żeby go wykluczyć. Tag nie może być jednocześnie uwzględniony i wykluczony.
4. Kliknij kafelek tagu, żeby go usunąć, albo **Clear** (wyczyszczenie), żeby usunąć wszystkie.

W większości źródeł lista powstaje na podstawie postaci z ostatnich wyszukiwań. Przed pierwszym wyszukiwaniem panel wyświetla napis **Tags will appear after searching** (tagi pojawią się po wyszukiwaniu). Jeśli potrzebnego tagu nie ma na liście, wpisz jego nazwę. Pojawiają się wtedy dwa przyciski: jeden dodaje tag jako filtr, drugi go blokuje. Źródło **DataCat** od razu wczytuje najpopularniejsze tagi, a inne nadal można wpisać. W źródle **PlotLight** Marinara szuka wpisanego tagu na własnej liście tagów serwisu PlotLight, a tag, którego serwis PlotLight nie ma, nie pasuje do niczego.

## Dodatkowe filtry

Większość źródeł dokłada przycisk **Filters** (filtry) z plakietką, która liczy aktywne filtry. Nie pojawia się dla źródeł **DataCat** ani **PlotLight**. Panel może zawierać:

- Pola wyboru treści, na przykład **Lorebook** lub **Alt Greetings**, które zostawiają tylko postacie z daną cechą. Lorebook to dodatkowe informacje tła, które postać nosi ze sobą.
- **Sort Direction** (kierunek sortowania) z wartościami **Descending** albo **Ascending**, w źródłach **ChubAI** i **Pygmalion**.
- Pola **Min Tokens** i **Max Output Tokens**, które ograniczają wyniki według rozmiaru. Zostaw je puste, żeby użyć wartości domyślnej źródła.
- Przełącznik **Show Low Quality** (pokazywanie niskiej jakości) w źródle **JannyAI**. Jest wyłączony, co ukrywa karty oznaczone przez JannyAI jako niskiej jakości.

W źródle **Wyvern** pola wyboru **Lorebook** i **Alt Greetings** oraz pola tokenów są widoczne, ale nie zmieniają wyników. Zamiast nich używaj listy rozwijanej sortowania i tagów.

## Przeglądanie postaci

Kliknij wynik, żeby otworzyć widok szczegółów. **Back to results** (powrót do wyników) wraca na listę.

Widok szczegółów pokazuje awatar, imię, autora, krótkie hasło, do dwudziestu kafelków z tagami i link **View on** do oryginalnej strony. Poniżej są pełne szczegóły, gdy źródło je udostępnia, pod nagłówkami takimi jak **Creator's Notes**, **Personality**, **Scenario**, **First Message** i **Alternate Greetings**. Bursztynowa plakietka **Has embedded lorebook** (zawiera wbudowany lorebook) pojawia się, gdy karta niesie ze sobą lorebook. Jeśli źródło nie zwraca szczegółów, widok informuje, że nadal można zaimportować postać z podstawowymi danymi.

## Importowanie postaci

Zanim zaczniesz: do czatu z postacią potrzebne będzie działające połączenie tekstowe. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Otwórz widok szczegółów postaci.
2. Wybierz opcję **Imported tags** (importowane tagi) obok awatara. Domyślnie to **All tags** (wszystkie tagi). Zobacz [Opcje importu](import-export.md#import-options).
3. Kliknij **Import**. Otwiera się okno **Import Card** (import karty) z pytaniem **Where should this card live?** (gdzie ma się znaleźć ta karta).
4. Opcjonalnie zaznacz **Split description into fields** (podział opisu na pola). Zobacz [Opcje importu](import-export.md#import-options).
5. Kliknij **Import as Character** (import jako postać), żeby dodać ją do panelu **Characters**, albo **Import as Persona** (import jako persona), żeby dodać ją do panelu **Personas**.
6. Jeśli karta ma wbudowany lorebook, panel **Embedded lorebook found** (znaleziono wbudowany lorebook) pokazuje, ile ma wpisów. Kliknij **Import Lorebook** (import lorebooka), żeby utworzyć też osobny lorebook, albo **No Import** (bez importu), żeby zostawić go tylko w karcie. **Back** (wstecz) wraca do kroku 5.
7. Czekaj, dopóki przycisk pokazuje napis **Importing...**. Pojawia się komunikat `Imported "Name" successfully!`
8. Otwórz **Characters** (albo **Personas**), żeby ją znaleźć.

Jeśli to nie zadziałało: przeczytaj komunikat o błędzie w powiadomieniu. W źródle **JannyAI** najczęstszą przyczyną jest blokada Cloudflare (zobacz sekcję Rozwiązywanie problemów poniżej).

### Pobieranie jako PNG

Kliknij **Download as PNG** (pobranie jako PNG) w widoku szczegółów, żeby zapisać kartę na urządzeniu jako standardową kartę postaci w formacie PNG, bez dodawania jej do biblioteki. W trakcie pracy przycisk pokazuje napis **Building PNG...**. Działa to w każdym źródle, a plik nosi nazwę postaci, na przykład `Some_Character.png`. Karta PNG to plik obrazu z danymi postaci zapisanymi w środku. Można się nią podzielić albo zaimportować ją do innej aplikacji.

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Wyszukiwanie lub szczegóły w źródle **JannyAI** kończą się błędem, który wspomina o Cloudflare (zabezpieczeniu blokującym automatyczne zapytania), albo pełna definicja karty jest zablokowana. | Odwiedź raz jannyai.com w tej samej przeglądarce i przejdź ewentualne zabezpieczenie. Potem wyszukaj ponownie. Jeśli karta nadal jest zablokowana, otwórz ją w serwisie JannyAI, pobierz jej plik PNG i zaimportuj ten plik. |
| Logowanie do serwisu Pygmalion przestało działać. | Restart serwera czyści dane logowania. Zaloguj się ponownie ze świeżym tokenem. |
| Źródło **CharacterTavern** pokazuje tylko komunikat. | Tak ma być. Zobacz [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Odczekaj liczbę sekund podaną w komunikacie, a potem spróbuj ponownie. |
| **PlotLight doesn't offer this for download.** | Autor może nie zezwalać na pobieranie albo karta nie jest już publiczna. Sprawdź to przez link **View on PlotLight**. |
| Wyszukiwanie się nie udaje albo źródło przestaje działać. | Publiczne strony mogą w każdej chwili się zmienić albo zablokować dostęp. Spróbuj później albo pobierz kartę ze strony i użyj zwykłego importu. Zobacz [Importowanie i eksportowanie kart postaci](import-export.md). |

<a id="log-in-to-pygmalion"></a>

## Logowanie do serwisu Pygmalion

Serwis Pygmalion ukrywa treści dla dorosłych za logowaniem. Publiczne postacie nie wymagają logowania. Marinara nigdy nie prosi o hasło. Wklejasz wartość skopiowaną z własnego konta.

1. Kliknij **Log In** (zalogowanie) na pasku narzędzi. Otwiera się okno **Pygmalion Authentication** (uwierzytelnianie w serwisie Pygmalion).
2. Wejdź w przeglądarce na pygmalion.chat i zaloguj się.
3. Otwórz narzędzia deweloperskie przeglądarki, czyli wbudowany panel dla zaawansowanych użytkowników. W większości przeglądarek na komputerze naciśnij <kbd>F12</kbd>. Przeglądarki na telefonie zwykle go nie mają, więc ten krok wykonaj na komputerze.
4. Otwórz zakładkę **Application**, a potem **Local Storage**.
5. Znajdź wpis o nazwie `authn` i skopiuj jego wartość.
6. Wklej ją w pole **Auth Token** w aplikacji Marinara Engine. Pole ukrywa wklejoną wartość.
7. Kliknij **Save & Connect** (zapisanie i połączenie). Komunikat informuje o włączeniu treści NSFW.

Okno ma sekcję pomocy, która powtarza te kroki, oraz link **Website** (strona internetowa) do pygmalion.chat.

Marinara najpierw sprawdza token w serwisie Pygmalion. Jeśli serwis Pygmalion go odrzuci, nic nie zostaje zapisane, a komunikat wyjaśnia powód. Jeśli serwis Pygmalion później przestanie go przyjmować, Marinara wylogowuje cię i prosi o ponowne zalogowanie.

Dane logowania serwer trzyma tylko w pamięci. Nigdy nie trafiają do pliku, więc restart serwera Marinara cię wyloguje. Aby wylogować się samodzielnie, otwórz okno ponownie i kliknij **Log Out** (wylogowanie). Aby wylogować się całkowicie, wyloguj się też na stronie pygmalion.chat.

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](import-export.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Rozwiązywanie problemów](../TROUBLESHOOTING.md)
