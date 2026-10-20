# Peek Prompt: zobacz, co dostał model AI

Funkcja **Peek Prompt** (podgląd promptu) pokazuje dokładny tekst, który Marinara Engine wysyła do modelu AI po odpowiedź. Potrafi też pokazać podgląd na żywo, jeszcze zanim cokolwiek zostanie wysłane. Z tego przewodnika dowiesz się, co widać w tym oknie, jak je otworzyć, jak czytać zapisane wskazówki (**Stored guidance**) i jak szukać w nim przyczyn dziwnych odpowiedzi.

Prompt to cały blok instrukcji i historii czatu, który Marinara składa i wysyła do modelu. Model czyta ten prompt i pisze odpowiedź. Dzięki funkcji **Peek Prompt** widać ten blok już po złożeniu, więc żadna odpowiedź nie jest zagadką.

## Co pokazuje Peek Prompt

Po otwarciu funkcji **Peek Prompt** pojawia się okno **Assembled Prompt** (złożony prompt). Składa się z trzech części.

Na górze, obok tytułu, siedzi kafelek ze źródłem. Mówi, którą wersję promptu masz przed sobą:

- **Exact Text Model Request**: dosłowne zapytanie wysłane do modelu.
- **Live Preview**: świeży podgląd zbudowany w tej chwili.
- **Raw Messages**: surowa lista wiadomości.
- **Prompt Preview**: ogólny podgląd.
- **Decision test preview**: prompt złożony z odpowiedzi uzyskanych w jawnie uruchomionym teście decyzji. Nie został wysłany do modelu czatu.

Pod kafelkiem znajduje się panel informacji o generowaniu. Może pokazać dostawcę i nazwę modelu, szacowaną liczbę tokenów, a po zakończeniu odpowiedzi także rzeczywistą liczbę tokenów promptu. Token to mały kawałek tekstu – modele liczą właśnie tokeny, a nie słowa. Ten panel wyświetla też małe kafelki z użytymi wartościami, takimi jak **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** i **Assistant Prefill**. Mogą się tu pojawić również wartości próbkowania: **Top P**, **Top K** i **Min P**. Jeśli połączenie, dla którego była przeznaczona odpowiedź, zawiodło i zamiast niego napisało ją twoje połączenie zapasowe, panel podaje też nazwę połączenia, które zawiodło, jego model i krótki powód, na przykład "key rejected" albo "rate limited".

Reszta okna to sam prompt, podzielony na zwijane sekcje. Każda sekcja ma etykietę i własne zgrubne oszacowanie liczby tokenów. Wiadomości czatu trafiają razem do jednej sekcji **Chat History**. W zapisanym dosłownym zapytaniu dostawca mógł połączyć kilka tur czatu w jeden blok. Rozwiń każdy blok, żeby obejrzeć cały widoczny dla modelu tekst w środku. Kliknij nagłówek dowolnej sekcji, aby ją otworzyć lub zamknąć.

Żeby przenieść cały prompt gdzie indziej, kliknij przycisk kopiowania obok przycisku zamykania u góry okna. Kopiuje on każdą sekcję i wiadomość czatu jako zwykły tekst, w kolejności wysłania, łącznie z sekcjami, których nie otwarto. Każda wiadomość zaczyna się od linii z nazwą jej roli, na przykład `[system]`, `[user]` albo `[assistant]`. Przy zapisanym dosłownym zapytaniu kopiowane jest to zapytanie w takiej postaci, w jakiej je wysłano. Kopiowanie niczego nie wysyła do modelu ani nie zmienia promptu.

## Otwieranie funkcji Peek Prompt

To okno da się otworzyć na dwa sposoby.

Pierwszy to pasek akcji wiadomości. Wykonaj kolejno te kroki:

1. Najedź kursorem na najnowszą wiadomość AI w czacie.
2. Znajdź akcję **Peek prompt**. Jej ikona to lupa.
3. Kliknij ją. Otwiera się okno **Assembled Prompt**.

Akcja **Peek prompt** pojawia się wyłącznie przy ostatniej wiadomości AI w czacie. Przy starszych wiadomościach jej nie ma.

Drugi sposób to wpisywany skrót. Działa nawet wtedy, gdy nie ma jeszcze żadnej odpowiedzi AI, więc prompt można podejrzeć wcześniej. Wykonaj kolejno te kroki:

1. Kliknij pole wpisywania wiadomości.
2. Wpisz dokładnie ten tekst:

```
{{prompt}}
```

3. Naciśnij Enter albo kliknij przycisk **Send**.

Zamiast wysłać wiadomość, Marinara czyści pole i otwiera okno funkcji **Peek Prompt**. Skróty `{{prompt_preview}}` i `{{preview_prompt}}` robią dokładnie to samo.

## Czytanie zapisanych wskazówek Stored guidance

Generowanie sterowane pozwala pokierować odpowiedzią za pomocą instrukcji spoza roli. Jeśli wiadomość powstała z zapisaną wskazówką, ma przy sobie osobną akcję **Stored guidance**. Jej ikona to mały zwój. Ta akcja pojawia się także przy wiadomościach utworzonych komendą `/impersonate`.

Kliknij akcję **Stored guidance**, aby otworzyć okno ze wskazówką użytą przy tej wiadomości. Przy wiadomości sterowanej okno podpisuje wskazówkę zależnie od jej pochodzenia:

- **/guided**: użyto komendy slash `/guided`.
- **Guided regenerate**: wiadomość wygenerowano ponownie z wpisaną wskazówką.
- **Game start**: wskazówka pochodzi z konfiguracji trybu Game Mode.

Przycisk **Copy /guided** pokazuje się tylko przy wskazówkach **/guided** i **Guided regenerate**. Kopiuje on wskazówkę z powrotem jako komendę `/guided`. Taką komendę można potem wkleić, żeby powtórzyć to samo sterowanie. Przy wskazówkach **Game start** tego przycisku nie ma.

Przy wiadomości z wcieleniem okno pokazuje szczegóły wcielenia zamiast jednej wskazówki. Pełny opis generowania sterowanego i wcielania się w postać znajdziesz w przewodniku podlinkowanym niżej.

## Szukanie przyczyn dziwnych odpowiedzi

Funkcja **Peek Prompt** to najlepsze narzędzie do zrozumienia odpowiedzi, której nikt się nie spodziewał. Sięgnij po nią, kiedy postać o czymś zapomina, ignoruje zasadę albo wypada z roli.

Otwórz okno **Assembled Prompt** i sprawdź te rzeczy:

- Poszukaj brakujących informacji. Jeśli wpisu z lorebooka, wspomnienia albo szczegółu persony nie ma w żadnej sekcji, model nigdy tego nie zobaczył.
- Przejrzyj kafelki z parametrami. Bardzo wysoka wartość **Temperature** potrafi zrobić z odpowiedzi loterię, a niska wartość **Max Output Tokens** ucina je w połowie.
- Rozwiń sekcję **Chat History**. Sprawdź, czy są tam wszystkie oczekiwane wiadomości i czy stoją we właściwej kolejności.
- Po odpowiedzi odczytaj rzeczywistą liczbę tokenów. Bardzo duży prompt potrafi wypchnąć starsze wiadomości poza limit modelu.

Kiedy już wiadomo, co model właściwie dostał, można zabrać się za przyczynę. Czasem trzeba poprawić kartę postaci, czasem wpis w lorebooku, a czasem zmienić wartość w parametrach generowania.

<a id="testing-decision-statements"></a>

## Testowanie stwierdzeń decyzyjnych

Otwórz **Decision diagnostics** (diagnostyka decyzji) w Peek Prompt, aby sprawdzić stwierdzenia promptu i decyzje lorebooków w bieżącym czacie. Otwarcie panelu lub wybranie **Preview inputs** (podgląd danych wejściowych) przygotowuje treść żądań bez pytania modelu decyzyjnego ani uruchamiania modelu lokalnego. Rozwiń **Prepared request bodies** (przygotowane treści żądań), aby zobaczyć ostatnie wiadomości, rozwinięte stwierdzenia, opcje i format żądania właściwy dla modelu. Kolejne stwierdzenia lorebooków mogą stać się osiągalne dopiero po odpowiedzi na wcześniejszą decyzję.

Wybierz **Test decisions** (testuj decyzje), aby wysłać kwalifikujące się pytania do wybranego modelu decyzyjnego. To rzeczywiste żądania decyzyjne, więc model hostowany może naliczyć opłaty. Test nie generuje odpowiedzi czatu, nie uruchamia agentów, nie zmienia stanu gry ani nie zapisuje w czacie swoich odpowiedzi i liczników czasu.

Jawnie uruchomiony test może czekać na lokalny model rozumujący, nawet gdy zwykłe decyzje przed odpowiedzią są odraczane. Nie zmienia to ustawienia dla bieżących odpowiedzi; podgląd danych wejściowych nadal nie wysyła żądań do modelu.

Każdy wynik pokazuje ocenę, jeśli jest dostępna, próg użyty dla stwierdzenia tak/nie oraz wynikającą z niego odpowiedź. Model zwracający tylko słowo tak/nie jest odpowiednio oznaczony; jego odpowiedź nie jest przedstawiana jako prawdopodobieństwo. Wyniki Choice pokazują wybraną opcję. Decyzje podtrzymane, odroczone, ponad limitem, niedostępne i nieudane mają osobne wyjaśnienia, aby brak odpowiedzi nie wyglądał jak niska ocena.

Po teście prompt poniżej używa jego odpowiedzi. **Show original prompt** (pokaż oryginalny prompt) przywraca pierwotnie otwartą treść, a **Show tested prompt** (pokaż testowany prompt) wraca do testu. **Requests sent and results** (wysłane żądania i wyniki) pokazuje rzeczywiste treści żądań decyzyjnych oraz otrzymane wyniki, bez nagłówków uwierzytelniania.

Testy używają bieżącego czatu i aktualnych ustawień, nawet gdy Peek Prompt otwarto ze starszej odpowiedzi. Nie odtwarzają pierwotnych żądań decyzyjnych. Obejmują stwierdzenia promptu i decyzje lorebooków; nie uruchamiają aktywacji agentów ani decyzji po odpowiedzi. Zwykły Peek Prompt pozostaje pasywny, dopóki nie wybierzesz jawnie **Test decisions**.

Gdy **Use Decision model** (używaj modelu decyzyjnego) jest włączone dla Advanced Memory, panel pokazuje też **Advanced Memory activity** (aktywność Advanced Memory). Zapisane raporty wskazują ostatnie przywołanie pamięci i sprawdzenie końca sceny wraz z modelem, czasem, ocenami, wyborem oraz stanem mechanizmu zastępczego. Mogą się pojawić także bez stwierdzeń decyzyjnych w prompcie. Opisują rzeczywiste wcześniejsze wywołania, a nie bieżący podgląd czy powtórzenie wybranej historycznej odpowiedzi. Zgodne swipe'y mogą ponownie użyć wcześniejszego raportu przywołania. Każdy raport zapisuje do 128 wyników, najpierw wybrane; pominięte wyniki są zliczane. Nowe raporty pojawiają się po następnym kwalifikującym się wywołaniu modelu decyzyjnego, a ich przeglądanie nie wysyła żądań do modelu.

## Powiązane przewodniki

- [Parametry generowania](../prompts/generation-parameters.md)
- [Edytor presetów i menedżer promptów](../prompts/presets.md)
- [Modele decyzyjne](../connections/decision-models.md)
- [Sterowane generowanie i Impersonate](guided-and-impersonate.md)
- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
