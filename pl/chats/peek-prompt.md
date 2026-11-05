# Peek Prompt: zobacz, co dostał model AI

Funkcja Peek Prompt (podgląd promptu) pokazuje dokładny tekst, który aplikacja Marinara Engine wysłała do modelu po daną odpowiedź, albo podgląd na żywo następnego promptu. Sięgnij po nią, gdy odpowiedź jest inna, niż się spodziewasz, i chcesz wiedzieć, co zobaczył model.

Prompt to cały blok instrukcji i historii czatu, który Marinara składa i wysyła. Model go czyta i pisze odpowiedź.

## Otwieranie funkcji Peek Prompt

Okno **Assembled Prompt** (złożony prompt) da się otworzyć na dwa sposoby.

Z wiadomości:

1. Dotknij najnowszej wiadomości AI, żeby pokazać jej pasek akcji.
2. Kliknij **Peek prompt** (podejrzenie promptu, ikona lupy).

Ten przycisk pojawia się tylko przy ostatniej wiadomości AI. Starsze wiadomości go nie mają.

Z pola wpisywania – ten sposób działa też przed pierwszą odpowiedzią AI:

1. Wpisz w polu wiadomości dokładnie ten tekst: `{{prompt}}`
2. Naciśnij <kbd>Enter</kbd> albo kliknij **Send** (wysłanie).

Zamiast wysłać wiadomość, Marinara czyści pole i otwiera okno. `{{prompt_preview}}` i `{{preview_prompt}}` działają tak samo.

## Co pokazuje okno

Plakietka obok tytułu mówi, którą wersję promptu czytasz.

| Plakietka | Znaczenie |
| --- | --- |
| **Exact Text Model Request** | Dosłowne zapytanie, które wysłano do modelu. |
| **Live Preview** | Podgląd zbudowany w tej chwili. |
| **Raw Messages** | Surowa lista wiadomości. |
| **Prompt Preview** | Ogólny podgląd. |
| **Decision test preview** | Prompt złożony z odpowiedzi z testu decyzji. Nie został wysłany do modelu czatu. |

Pod nią panel informacji może pokazać usługę i model, szacowaną liczbę tokenów, a po zakończeniu odpowiedzi także rzeczywistą liczbę tokenów promptu. Token to mały kawałek tekstu – modele liczą tokeny zamiast słów. Panel pokazuje też kafelki z użytymi wartościami, takimi jak **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** i **Assistant Prefill**, oraz wartości próbkowania, takie jak **Top P**, **Top K** i **Min P**. Kafelki takie jak **Service Tier** i **Assistant Prefill** oraz wartości próbkowania to zaawansowane ustawienia modelu. Na początek możesz je pominąć. Jeśli pierwszy model zawiódł i odpowiedź napisał twój model zapasowy, panel podaje nazwę modelu, który zawiódł, i krótki powód, na przykład "key rejected" albo "rate limited".

Resztę okna zajmuje prompt podzielony na zwijane sekcje, każda z własnym zgrubnym oszacowaniem liczby tokenów. Wiadomości czatu są zgrupowane w sekcji **Chat History** (historia czatu). W zapisanym dosłownym zapytaniu usługa mogła połączyć kilka tur czatu w jeden blok, więc rozwiń każdy blok, żeby zobaczyć cały tekst. Kliknij nagłówek sekcji, aby ją otworzyć lub zamknąć.

**Exact Text Model Request** to zapytanie w takiej postaci, w jakiej wysłano je po tę odpowiedź. Zostało zapisane przed wszystkim, co uruchomiło się po odpowiedzi, na przykład przed automatycznym podsumowaniem albo ukryciem wiadomości, więc może zawierać wiadomości, których następna odpowiedź nie dostanie. Kliknij **Show current context** (pokazanie bieżącego kontekstu), żeby złożyć prompt z czatu w jego obecnym stanie, bez wysyłania go. Kliknij **Show sent request** (pokazanie wysłanego zapytania), żeby wrócić.

### Kopiowanie promptu

Kliknij przycisk kopiowania obok przycisku zamykania. Kopiuje on każdą sekcję i wiadomość jako zwykły tekst, w kolejności wysłania, łącznie z zamkniętymi sekcjami. Każda wiadomość zaczyna się od linii z nazwą jej roli, na przykład `[system]`, `[user]` albo `[assistant]`. Przy zapisanym dosłownym zapytaniu kopiowane jest zapytanie w takiej postaci, w jakiej je wysłano. Kopiowanie niczego nie wysyła.

### Wyszukiwanie tekstu w prompcie

Użyj pola **Find** (znajdź) u góry albo naciśnij <kbd>Ctrl</kbd>+<kbd>F</kbd> (na komputerze Mac <kbd>Cmd</kbd>+<kbd>F</kbd>) wewnątrz okna. Wyszukiwanie nie rozróżnia wielkości liter i obejmuje cały prompt, także zamknięte sekcje i historię czatu. Licznik pokazuje bieżące dopasowanie, na przykład "2 of 5". Między dopasowaniami przechodzisz przyciskami w górę i w dół albo klawiszami <kbd>Enter</kbd> i <kbd>Shift</kbd>+<kbd>Enter</kbd>. Po dotarciu do któregokolwiek końca wyszukiwanie przechodzi na drugi koniec. Gdy pole **Find** zawiera tekst, okno pokazuje pełny tekst wiadomości. Wyczyść pole, żeby wrócić do sekcji.

## Sprawdzanie odpowiedzi w panelu Reply checkup

Gdy Marinara wykryje prawdopodobną przyczynę słabej odpowiedzi, okno pokazuje nad promptem panel **Reply checkup** (sprawdzenie odpowiedzi). Panel może zgłosić:

- Karta postaci jest duża i zajmuje sporą część budżetu promptu (**Large character card**).
- Odpowiedź dotarła do limitu tokenów i urwała się w pół zdania (**Cut off**).
- Model nie odesłał żadnego widocznego tekstu (**Empty reply**).
- Starsze wiadomości nie zostały wysłane, bo prompt by się nie zmieścił (**N older messages not sent**).
- Wpisy lorebooka pasowały, ale nie zmieściły się w budżecie (**N lorebook entries left out**).
- Limit odpowiedzi obniżono, żeby zrobić miejsce na prompt (**Reply limit cut**).

Tam, gdzie to pomaga, łącze przenosi do ustawienia, które trzeba zmienić, na przykład **Max output tokens** (maksymalna liczba tokenów wyjściowych) albo **Lorebook token budget** (budżet tokenów lorebooka).

## Szukanie przyczyn nieoczekiwanej odpowiedzi

Otwórz okno **Assembled Prompt** i sprawdź:

- **Brakujące informacje.** Jeśli wpisu z lorebooka, wspomnienia albo szczegółu persony nie ma w żadnej sekcji, model nigdy go nie zobaczył.
- **Kafelki z parametrami.** Wysoka wartość **Temperature** może sprawić, że odpowiedzi będą przypadkowe, a niska wartość **Max Output Tokens** może je ucinać.
- **Chat History.** Sprawdź, czy są tam oczekiwane wiadomości i czy stoją we właściwej kolejności.
- **Liczba tokenów.** Duży prompt może wypchnąć starsze wiadomości poza limit modelu.

Potem usuń przyczynę: popraw kartę postaci, dostosuj wpis lorebooka albo zmień ustawienie generowania. Zobacz [Parametry generowania](../prompts/generation-parameters.md).

Aby przeczytać wskazówkę, która pokierowała odpowiedzią, użyj przycisku **Stored guidance** (zapisana wskazówka) na wiadomości. Zobacz [Sterowane generowanie i Impersonate](guided-and-impersonate.md#read-stored-guidance).

<a id="testing-decision-statements"></a>

## Testowanie stwierdzeń decyzyjnych

[Model decyzyjny](../connections/decision-models.md) odpowiada na pytania typu tak/nie dla funkcji takich jak lorebooki. Panel **Decision diagnostics** (diagnostyka decyzji) w oknie Peek Prompt pozwala przejrzeć i przetestować te pytania dla bieżącego czatu.

1. Otwórz Peek Prompt i znajdź **Decision diagnostics**.
2. Otwarcie panelu albo kliknięcie **Preview inputs** (podgląd danych wejściowych) przygotowuje treści żądań bez pytania żadnego modelu. Rozwiń **Prepared request bodies** (przygotowane treści żądań), aby zobaczyć ostatnie wiadomości, rozwinięte stwierdzenia, opcje i format żądania.
3. Kliknij **Test decisions** (testuj decyzje), aby zadać kwalifikujące się pytania twojemu modelowi decyzyjnemu.

**Test decisions** wysyła prawdziwe żądania, więc model hostowany może naliczyć za nie opłaty. Test nie pisze odpowiedzi czatu, nie uruchamia agentów, nie zmienia stanu gry ani nie zapisuje w czacie swoich odpowiedzi i liczników czasu. Późniejsze stwierdzenia lorebooków mogą stać się osiągalne dopiero po odpowiedzi na wcześniejsze. Jawnie uruchomiony test może czekać na lokalny model rozumujący, nawet gdy zwykłe decyzje przed odpowiedzią są odraczane. Nie zmienia to twojego ustawienia dla bieżących odpowiedzi.

Każdy wynik pokazuje ocenę, jeśli jest dostępna, próg dla stwierdzenia typu tak/nie oraz odpowiedź. Model, który zwraca tylko "yes" albo "no", jest tak oznaczony, a jego odpowiedź nie jest pokazywana jako prawdopodobieństwo. Wyniki typu Choice pokazują wybraną opcję. Decyzje podtrzymane, odroczone, ponad limitem, niedostępne i nieudane mają osobne wyjaśnienia.

Po teście prompt poniżej korzysta z odpowiedzi testu. Kliknij **Show original prompt** (pokaż oryginalny prompt), żeby wrócić do tego, co otwarto, albo **Show tested prompt** (pokaż testowany prompt), żeby przełączyć się z powrotem. **Requests sent and results** (wysłane żądania i wyniki) pokazuje rzeczywiste treści żądań i wyniki, bez nagłówków uwierzytelniania.

Jeśli to nie zadziałało: przy komunikacie **Could not prepare the decision test. Check the chat connection and try again.** sprawdź, czy czat ma działający model, i spróbuj ponownie.

Testy korzystają z bieżącego czatu i ustawień, nawet gdy Peek Prompt otwarto ze starszej odpowiedzi. Nie odtwarzają pierwotnych żądań decyzyjnych. Obejmują stwierdzenia promptu i decyzje lorebooków, ale nie aktywację agentów ani decyzje po odpowiedzi.

Gdy dla funkcji Advanced Memory (pamięci długoterminowej aplikacji Marinara Engine, zobacz [Memory Recall i podsumowania czatu](../agents/memory.md)) włączone jest **Use Decision model** (używaj modelu decyzyjnego), panel pokazuje też **Advanced Memory activity** (aktywność Advanced Memory). Te zapisane raporty pokazują ostatnie przywołanie i sprawdzenie końca sceny wraz z modelem, czasem, ocenami, wyborami i stanem mechanizmu zastępczego. Opisują wcześniejsze wywołania, a nie bieżący podgląd, i mogą się pojawić nawet wtedy, gdy prompt nie ma stwierdzeń decyzyjnych. Zgodne swipe'y mogą ponownie użyć wcześniejszego raportu przywołania. Każdy raport zachowuje do 128 wyników, najpierw wybrane, a resztę zlicza. Nowe raporty pojawiają się po następnym kwalifikującym się wywołaniu modelu decyzyjnego. Ich przeglądanie nie wysyła żądań do modelu.
