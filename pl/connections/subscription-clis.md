# Połączenia abonamentowe z Claude, ChatGPT i Grok

Ten przewodnik opisuje trzy połączenia, które logują się przez konto zamiast przez klucz API: **Claude (Subscription)**, **OpenAI (ChatGPT)** i **Grok CLI (Subscription)**. Wystarczy zainstalować małe narzędzie wiersza poleceń i zalogować się jeden raz, a Marinara Engine korzysta z tego konta podczas czatu. Narzędzie wiersza poleceń (CLI) to program uruchamiany przez wpisanie komendy w oknie terminala.

## Czym są połączenia abonamentowe

Większość połączeń w aplikacji Marinara Engine korzysta z klucza API. Klucz API to tajny kod, trochę jak hasło, który wkleja się do połączenia, żeby usługa AI mogła naliczać opłaty na koncie.

Te trzy połączenia działają inaczej. Zamiast klucza API używają lokalnego logowania. Logujesz się w narzędziu CLI na własnym komputerze, a Marinara korzysta z tego logowania ponownie. Do aplikacji Marinara Engine nie trzeba niczego wklejać.

Wybierz połączenie abonamentowe wtedy, gdy konto daje dostęp przez jedno z tych narzędzi CLI:

- **Claude (Subscription)** korzysta z abonamentu Anthropic **Pro** lub **Max**.
- **OpenAI (ChatGPT)** korzysta z konta ChatGPT.
- **Grok CLI (Subscription)** korzysta z konta **SuperGrok** lub **X Premium+**.

## Co trzeba przygotować

Wymagania co do konta zależą od dostawcy.

- **Claude (Subscription)** wymaga planu Claude obsługiwanego przez logowanie abonamentowe Claude Code.
- **OpenAI (ChatGPT)** obsługuje kwalifikujące się plany ChatGPT, zarówno darmowe, jak i płatne. Limity użycia zależą od planu.
- **Grok CLI (Subscription)** wymaga konta SuperGrok lub X Premium+.

U wszystkich trzech dostawców narzędzie CLI musi być zainstalowane i zalogowane na tym samym komputerze, na którym działa serwer Marinara Engine. To nie jest przeglądarka ani telefon, na którym oglądasz aplikację Marinara Engine. Marinara uruchamia narzędzie CLI lokalnie, więc logowanie musi być tuż obok serwera.

Jeśli aplikacja Marinara Engine działa na twoim komputerze, to ten komputer jest serwerem. Jeśli działa na innej maszynie albo w kontenerze Docker, właśnie tam zainstaluj narzędzie CLI i tam się zaloguj.

## Claude (Subscription)

Potrzebny jest abonament Anthropic Pro lub Max. To ten sam sposób logowania, z którego korzysta Visual Studio Code i inne narzędzia Anthropic.

1. Na komputerze z uruchomioną aplikacją Marinara Engine zainstaluj narzędzie Claude Code CLI:

```
npm i -g @anthropic-ai/claude-code
```

2. Zaloguj się jeden raz:

```
claude auth login
```

3. W aplikacji Marinara Engine otwórz panel **Connections** (Połączenia) i kliknij przycisk **New** (Nowe).
4. W oknie **Create Connection** wpisz nazwę i wybierz dostawcę **Claude (Subscription)**, a potem kliknij przycisk **Create**.
5. Zwróć uwagę, że w edytorze nie ma pola **API Key** ani **Base URL**. Panel informacyjny potwierdza, że nie są potrzebne.
6. Z listy rozwijanej **Model** wybierz model Claude, na przykład jeden z modeli Opus lub Sonnet.
7. Kliknij przycisk **Save** (Zapisz), a potem przycisk **Send Test Message** (Wyślij wiadomość testową). Krótka odpowiedź oznacza, że logowanie działa.

Połączenia abonamentowe Claude obsługują wyłącznie czat tekstowy. To połączenie ma dwie dodatkowe kontrolki, **Fast Mode** i **Diagnose Model Routing**, opisane niżej.

## OpenAI (ChatGPT)

Potrzebne jest konto ChatGPT. Marinara kieruje czat przez logowanie w narzędziu Codex CLI.

1. Na komputerze z uruchomioną aplikacją Marinara Engine zainstaluj narzędzie Codex CLI:

```
npm i -g @openai/codex
```

2. Zaloguj się jeden raz:

```
codex login
```

3. W aplikacji Marinara Engine otwórz panel **Connections** i kliknij przycisk **New**.
4. W oknie **Create Connection** wpisz nazwę i wybierz dostawcę **OpenAI (ChatGPT)**, a potem kliknij przycisk **Create**.
5. Z listy rozwijanej **Model** wybierz model. Lista pochodzi z sesji ChatGPT, jeśli jest dostępna, a w przeciwnym razie z listy wbudowanej.
6. Kliknij przycisk **Save**, a potem przycisk **Send Test Message**, żeby potwierdzić odpowiedź.

Marinara odczytuje lokalny plik logowania Codex i odświeża sesję, kiedy tylko może.

## Grok CLI (Subscription)

Potrzebne jest konto SuperGrok lub X Premium+.

1. Na komputerze z uruchomioną aplikacją Marinara Engine zainstaluj narzędzie Grok CLI:

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Zaloguj się jeden raz:

```
grok login
```

3. W aplikacji Marinara Engine otwórz panel **Connections** i kliknij przycisk **New**.
4. W oknie **Create Connection** wpisz nazwę i wybierz dostawcę **Grok CLI (Subscription)**, a potem kliknij przycisk **Create**.
5. Wybierz model albo zostaw pole **Model** puste, żeby użyć modelu domyślnego dla narzędzia CLI. Do trybu Roleplay najbezpieczniejszy jest zwykle model `grok-composer-2.5-fast`.
6. Kliknij przycisk **Save**, a potem przycisk **Send Test Message**. To połączenie można przetestować nawet bez wybranego modelu.

Grok CLI ma dwie osobliwości. Nie obsługuje streamingu, czyli tekstu pojawiającego się w trakcie pisania, więc odpowiedź przychodzi od razu w całości, a nie słowo po słowie. Okno kontekstu ma domyślnie 32000 tokenów, mniej niż u innych dostawców, ponieważ bardzo duże prompty potrafią przekroczyć limit tury samego narzędzia CLI.

Modele Grok wczytasz przyciskiem **Fetch Models from Grok CLI** w sekcji **Model**.

## Czas przechowywania promptów w pamięci podręcznej Claude

W edytorze połączenia Claude opcja **Prompt Caching → Extended token caching (1 hour)** żąda przechowywania cache przez godzinę, co pozwala na dłuższe przerwy między wiadomościami. Wymaga Claude Code w wersji **2.1.242 lub nowszej**. Aplikacja Marinara przekazuje to ustawienie dla danego żądania, bez zmieniania zapisanych ustawień Claude.

Gdy opcja jest wyłączona, główne rozmowy i żądania Agent SDK korzystają z domyślnych ustawień Claude: obecnie godziny dla użycia w ramach limitów subskrypcji oraz pięciu minut dla dodatkowego użycia, kredytów lub rozliczeń API. Własne podagenty Claude Code korzystają z pięciu minut, jeśli nie skonfigurowano ich osobno; wybrane żądania pomocnicze sterowane przez serwer mogą korzystać z godziny. Istniejące zmienne środowiskowe CLI nadpisujące tę wartość nadal mają pierwszeństwo. Zobacz [pamięć podręczną promptów w Claude Code](https://code.claude.com/docs/en/prompt-caching).

Logi debugowania rozróżniają zapisy cache na pięć minut i na godzinę na podstawie danych o użyciu zgłaszanych przez SDK. Odpowiedniki kosztów korzystają ze standardowych mnożników cen tokenów API, a nie z rachunku za subskrypcję. Gdy SDK nie podaje podziału zapisów według czasu przechowywania, szacowany koszt pozostaje nieznany.

## Dlaczego nie ma pola na klucz API

U wszystkich trzech dostawców abonamentowych pola **API Key** i **Base URL** są ukryte. Tak ma być. Logowanie siedzi wewnątrz narzędzia CLI na komputerze z serwerem, więc w aplikacji Marinara Engine nie ma czego wpisywać.

Jeśli przez pomyłkę wybrany został niewłaściwy dostawca i pola klucza nie widać, wróć w siatce dostawców do tego dostawcy, o który chodziło. Przy dostawcach opartych na kluczu API pole wraca.

## Fast Mode (tylko Claude)

Edytor połączenia **Claude (Subscription)** ma sekcję **Fast Mode** z jednym przełącznikiem, **Use Claude Code fast-mode routing**. Domyślnie jest wyłączony.

Zostaw go wyłączonego. Sama aplikacja opisuje tę funkcję jako taką, która dziś nic nie robi. Prosi ona narzędzie Claude Code o szybszy poziom modelu, ale obecne modele Claude już go nie oferują. Włączenie nie daje nic przydatnego i może dodać narzut. Przełącznik został w interfejsie wyłącznie na wypadek, gdyby Anthropic przywrócił tę funkcję.

Przy próbie włączenia pojawia się okno potwierdzenia zatytułowane **YOU DON'T WANT THIS SETTING ON!**. Wybierz **Keep it off**.

## Diagnose Model Routing (tylko Claude)

Edytor połączenia **Claude (Subscription)** ma w obszarze testów przycisk **Diagnose Model Routing**. Przydaje się wtedy, gdy prośba dotyczy jednego modelu Claude, a odpowiada podejrzanie mniejszy.

1. Wybierz model i kliknij przycisk **Save**. Do czasu wybrania modelu przycisk pozostaje nieaktywny.
2. Kliknij przycisk **Diagnose Model Routing**.
3. Przeczytaj wynik. Marinara wysyła prawdziwy prompt przez logowanie Claude Code. Potem podaje, za który model konto zostało rzeczywiście obciążone.

W ten sposób wychodzi na jaw ciche obniżenie modelu, czyli sytuacja, w której zamiast większego modelu Opus po cichu odpowiada Sonnet albo Haiku.

## Ograniczenia, o których warto wiedzieć

- Te połączenia wymagają płatnego abonamentu i zalogowanego narzędzia CLI na komputerze z serwerem.
- Embeddingi, czyli liczbowe reprezentacje tekstu, nie działają w żadnym z tych trzech połączeń. Wyszukiwanie semantyczne w lorebookach i przywoływanie pamięci wymagają osobnego połączenia do embeddingów.
- **Claude (Subscription)** obsługuje wyłącznie czat tekstowy.
- **Grok CLI (Subscription)** nie obsługuje streamingu i startuje z mniejszym oknem kontekstu.
- Przycisk **Send Test Message** wymaga wcześniejszego wybrania modelu. Wyjątkiem jest Grok CLI, który testuje się i bez modelu.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Obsługiwani dostawcy AI](providers-reference.md)
