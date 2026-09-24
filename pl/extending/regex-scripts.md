# Skrypty regex

Ten przewodnik wyjaśnia skrypty regex w aplikacji Marinara Engine. Skrypt regex to reguła "znajdź i zamień", która sama przepisuje tekst czatu. Dowiesz się, do czego służą skrypty regex, jak utworzyć własny, w których miejscach działają i jak ograniczyć ich zasięg do jednej postaci.

## Czym jest skrypt regex

Regex to skrót od "regular expression", czyli wyrażenia regularnego. Wyrażenie regularne to wzorzec wyszukiwania. Znajduje tekst pasujący do reguły, a skrypt regex zastępuje ten tekst czymś innym. Do korzystania z niego nie trzeba umieć programować.

Skrypt regex uruchamia się sam za każdym razem, gdy wiadomość przechodzi przez czat. Potrafi uporządkować odpowiedź AI, zanim pojawi się na ekranie. Potrafi zmienić twoją własną wiadomość przed wysłaniem. Potrafi też zmienić tekst, który trafia do modelu. Wzorzec ustawia się raz, a potem działa w każdej pasującej wiadomości.

Oto prosty przykład "przed i po". Niektóre modele otaczają opisy czynności gwiazdkami, w ten sposób:

```
*She smiles* Hello there.
```

Jeśli wzorzec `\*([^*]+)\*` zostanie zamieniony na `$1`, gwiazdki znikają, a tekst z ich wnętrza zostaje:

```
She smiles Hello there.
```

Zapis `$1` w polu zamiany oznacza "tekst przechwycony przez wzorzec w pierwszej parze nawiasów". Tokeny `$1`, `$2` i podobne przydają się bardzo często.

Typowe zastosowania to usuwanie gwiazdek, kasowanie uwag spoza roli w nawiasach, cenzurowanie wybranego słowa i poprawianie powtarzalnych dziwactw formatowania u jednej postaci.

## Gdzie znaleźć swoje skrypty regex

Globalne skrypty regex mieszkają w panelu **Presets** (presety). Otwórz go przyciskiem **Presets** na górnym pasku, a potem odszukaj sekcję **Regexes**. Notatka przy sekcji brzmi "Find/replace patterns applied to AI output or user input".

Każdy wiersz listy pokazuje:

- Nazwę skryptu.
- Mały tag **AI** albo **User**, który mówi, gdzie skrypt działa.
- Wzorzec w postaci `/pattern/flags`.
- Przełącznik włączający i wyłączający skrypt. Zmiana działa od razu, bez otwierania edytora.
- Przycisk **Edit regex** (edycja skryptu regex, ikona ołówka).
- Przycisk **Delete regex** (usunięcie skryptu regex, ikona kosza).

Kiedy nie ma jeszcze żadnego skryptu, lista pokazuje "No regexes yet". Wiersz można przeciągnąć za uchwyt i w ten sposób zmienić kolejność uruchamiania. Na tej liście widać wyłącznie skrypty globalne. Skrypty powiązane z jedną postacią trzymane są osobno. Zobacz sekcję "Skrypty regex przypisane do postaci" poniżej.

W nagłówku sekcji są też trzy przyciski z ikonami:

- **Create regex** (utworzenie skryptu regex): otwiera nowy, pusty skrypt.
- **Import regexes from JSON** (import skryptów z pliku JSON): wczytuje skrypty z pliku.
- **Export regexes to JSON** (eksport skryptów do pliku JSON): zapisuje wszystkie skrypty globalne do jednego pliku.

## Tworzenie skryptu regex

Aby zrobić nowy skrypt globalny:

1. Otwórz panel **Presets** i odszukaj sekcję **Regexes**.
2. Kliknij przycisk **Create regex**. Otwiera się pełny edytor skryptów regex.
3. Wpisz nazwę w polu na górze. Nowy skrypt startuje z nazwą "New Regex Script".
4. Wypełnij pola opisane poniżej.
5. Kliknij przycisk **Save**. Na moment pojawia się zielona notatka **Saved**.

Edytor ma następujące pola.

### Pole **Find Pattern (Regex)**

Pole **Find Pattern (Regex)** to wzorzec wyszukiwania. Zapisz go bez ukośników po bokach. Tekst zastępczy pokazuje przykład: `\*([^*]+)\*`. Jeśli wzorzec jest błędny albo niebezpieczny, pod polem pojawia się czerwony komunikat i blokuje zapis. Zobacz sekcję "Bezpieczeństwo i wydajność" poniżej.

### Pole **Replace With**

Pole **Replace With** zawiera tekst, który zastępuje każde dopasowanie. Zostaw je puste, żeby dopasowany tekst po prostu zniknął. Przechwycony tekst da się wykorzystać ponownie przez `$1`, `$2` i kolejne. Przekształcenia wielkości liter postawione przed przechwyceniem zmieniają jego zapis:

- `\u$1` zamienia pierwszą literę przechwycenia na wielką.
- `\U$1\E` zapisuje całe przechwycenie wielkimi literami.
- `\l$1` zamienia pierwszą literę przechwycenia na małą.
- `\L$1\E` zapisuje całe przechwycenie małymi literami.

Dosłowny tekst z odwrotnym ukośnikiem, na przykład ścieżka Windows w rodzaju `C:\Users`, zostaje dokładnie taki, jaki jest.

### Sekcja **Regex Flags**

Sekcja **Regex Flags** (flagi wyrażenia regularnego) to przyciski przełączające, które zmieniają sposób dopasowania wzorca. Nowy skrypt startuje z włączonymi `g` i `i`:

- `g` (global): zamienia każde dopasowanie, nie tylko pierwsze.
- `i` (case-insensitive): dopasowuje niezależnie od wielkości liter.
- `m` (multiline): pozwala znakom `^` i `$` dopasować się przy końcach wierszy.
- `s` (dotAll): pozwala znakowi `.` dopasować także znaki nowej linii.
- `u` (unicode), `y` (sticky) i `d` (match indices) to flagi zaawansowane, do szczególnych przypadków.

### Sekcja **Trim Strings**

Sekcja **Trim Strings** (przycinane ciągi tekstu) to opcjonalna lista zwykłych fragmentów tekstu, które znikają już po wykonaniu zamiany. Kliknij przycisk **Add trim string**, żeby dodać wiersz, a przycisk **X**, żeby go usunąć. Przydaje się to przy kasowaniu stałego fragmentu, który łatwiej wpisać, niż opisać wzorcem.

### Sekcja **Live Test**

Sekcja **Live Test** (test na żywo) pozwala sprawdzić wzorzec jeszcze przed zapisem. Wklej przykładowy tekst do pola, a wynik pojawi się niżej, pod napisem **Result:**. **Live Test** potwierdza wyłącznie logikę wyszukiwania, zamiany i przycinania. Nie sprawdza miejsca działania, stanu włączenia, zasięgu postaci ani głębokości. Notatka pod polem mówi to wprost: "Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime".

We wzorcu, w tekście zamiany i w przycinanych ciągach można używać makr takich jak `{{user}}` i `{{char}}`. W sekcji **Live Test** zamieniają się na wartości przykładowe. W prawdziwym czacie zamieniają się na prawdziwe imiona i teksty. Więcej o makrach znajdziesz w przewodniku [Makra](../prompts/macros.md).

## Miejsce działania: **AI Output** albo **User Input**

Pole **Apply To** (zakres stosowania) decyduje, którą stronę czatu obserwuje skrypt. Przynajmniej jedna opcja musi zostać zaznaczona. Da się wybrać obie naraz.

- **AI Output**: skrypt działa na odpowiedziach AI, zanim pojawią się na ekranie.
- **User Input**: skrypt działa na twoich wiadomościach, zanim zostaną wysłane.

Opcja **AI Output** służy do porządkowania tego, co pisze model. Opcja **User Input** poprawia i przekształca twój własny tekst.

W czacie **Roleplay** z grupowym trybem **Individual** (osobne odpowiedzi), przy ustawieniu **Only Prompt** lub **Both**, miejsce działania zależy od postaci otrzymującej prompt: twoje wiadomości i wiadomości innych postaci podlegają regułom **User Input**, a własne odpowiedzi postaci, która właśnie odpowiada, podlegają regułom **AI Output**. Dotyczy to także odpowiedzi napisanych wcześniej w tej samej turze grupowej. Ograniczenia do wybranych postaci nadal określają, kto otrzymuje przepisany prompt, więc narrator wykluczony ze skryptu ukrywającego myśli zachowuje ich oryginalną treść. Wybierz **Only Prompt**, aby nie zmieniać zapisanego tekstu czatu.

## Tryb **Apply Mode**: **Only Display**, **Only Prompt** albo **Both**

Selektor **Apply Mode** (moment zastosowania) znajduje się w sekcji **Advanced Options**. Decyduje o tym, kiedy przepisanie tekstu wchodzi w życie. To coś innego niż miejsce działania. Nowy skrypt startuje w trybie **Only Display**.

- **Only Display**: zmienia tylko to, co widać w czacie. Zapisana wiadomość i tekst, który model dostaje w kolejnych turach, pozostają bez zmian.
- **Only Prompt**: zmienia tylko to, co trafia do modelu. Widok czatu i zapisana wiadomość pozostają bez zmian. To samo widać w podglądzie promptu w aplikacji.
- **Both**: zmienia i widok, i tekst promptu.

### Który tryb wybrać

Kieruj się tą krótką ściągą:

- Chodzi tylko o wygląd odpowiedzi na ekranie: wybierz **Only Display**. To najbezpieczniejsza opcja przy poprawkach kosmetycznych.
- Chodzi o zmianę tego, co czyta model, na przykład o usunięcie tagu, który model uparcie kopiuje: wybierz **Only Prompt**.
- Zmiana ma obowiązywać na ekranie i w kontekście modelu: wybierz **Both**.

Jedna rzecz warta uwagi przy twoich własnych wiadomościach. Kiedy skrypt **User Input** ma tryb **Only Display** albo **Both**, przepisanie tekstu następuje tuż przed wysłaniem wiadomości. Zmienia więc wiadomość faktycznie zapisaną i wysłaną, a nie tylko jej późniejszy wygląd. Dla wychodzących wiadomości nie ma trybu działającego wyłącznie na widok.

## Kolejność wykonania i głębokość

Oba ustawienia siedzą w sekcji **Advanced Options**.

Pole **Execution Order** (kolejność wykonania) to liczba. Niższe liczby idą pierwsze. Ma to znaczenie wtedy, gdy do tego samego tekstu pasuje więcej niż jeden skrypt. Nowy skrypt startuje z wartością 0, a przy zapisie aplikacja przydziela kolejną wolną liczbę, więc świeże skrypty nie wchodzą sobie w drogę. Kolejność zmienia też przeciąganie wierszy na liście **Regexes**.

Ustawienie **Depth Range** (zakres głębokości) ogranicza to, jak daleko wstecz w czacie sięga skrypt, i korzysta z dwóch pól liczbowych, **Min** oraz **Max**. Głębokość liczy się wstecz od najnowszej wiadomości. Najnowsza wiadomość ma głębokość 0, poprzednia głębokość 1, i tak dalej. Zostaw oba pola puste, żeby skrypt działał na każdej głębokości. Jeśli minimum jest większe od maksimum, zapis zostaje zablokowany.

## Skrypty regex przypisane do postaci

Skrypt regex może należeć do jednej lub kilku wybranych postaci, zamiast działać wszędzie. Są dwa sposoby na przypisanie skryptu do postaci.

Pierwszy sposób prowadzi przez edytor. Włącz przełącznik **Specific Characters** (wybrane postacie) na karcie **Apply To**, a potem wskaż jedną lub kilka postaci w siatce. Przy wyłączonym przełączniku skrypt "Applies to all characters". Przy włączonym trzeba wskazać co najmniej jedną postać.

Drugi sposób prowadzi przez samą postać. Otwórz postać, przejdź do zakładki **Advanced** i odszukaj kartę **Regex Scripts**. Ta karta wymienia wyłącznie skrypty powiązane z tą postacią i ma własne przyciski **Create regex**, importu i eksportu. Postać trzeba najpierw zapisać, dopiero potem da się dodać przypisane skrypty. Przy niezapisanej postaci karta o tym informuje.

Otwarcie pełnego edytora z tej karty oznacza opuszczenie edytora postaci. Jeśli w postaci są niezapisane zmiany, aplikacja najpierw ostrzega, żeby nic nie przepadło.

### Ustawienie **Scoped Regex Scripts** dla pojedynczego czatu

Skrypty przypisane do postaci nie działają automatycznie w każdym czacie. Steruje nimi ustawienie osobne dla każdego czatu. Otwórz panel **Chat Settings** (ustawienia czatu) dla danego czatu. Sekcja **Scoped Regex Scripts** pojawia się tylko wtedy, gdy przynajmniej jedna postać w tym czacie ma przypisane skrypty. Oferuje trzy tryby:

- **Disabled** (domyślnie): skrypty przypisane do postaci są wyłączone i działają tylko skrypty globalne.
- **Exclusive**: każdy przypisany skrypt zmienia wyłącznie wiadomości postaci, do której należy.
- **Chat**: każdy przypisany skrypt zmienia każdą wiadomość w czacie.

Pod przyciskami trybów panel wypisuje każdą postać z przypisanymi skryptami i pozwala włączyć albo wyłączyć każdy skrypt na potrzeby tego czatu. Ustawienie to steruje skryptami działającymi po stronie widoku. Skrypty promptu zawsze idą za postacią, która akurat generuje odpowiedź.

## Importowanie skryptów regex z aplikacji SillyTavern

Marinara odczytuje skrypty regex dołączone do karty postaci z aplikacji SillyTavern. Przy imporcie karty pojawia się sekcja **Imported regex scripts** z dwiema możliwościami:

- **Character only** (domyślnie): skrypty zostają przypisane do tej jednej postaci.
- **Global**: skrypty trafiają do panelu **Presets** i działają w każdym czacie.

Ten wybór pojawia się zarówno w oknie importu pojedynczej postaci, jak i w zbiorczym imporcie **Import from SillyTavern Folder**. Dołączone skrypty z pustym wzorcem albo ze wzorcem, który nie przechodzi kontroli bezpieczeństwa, zostają przy imporcie pominięte. Zwykły plik JSON ze skryptami wczytasz przyciskiem **Import regexes from JSON** w sekcji **Regexes**. Pełny opis importu znajdziesz w przewodniku [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

## Bezpieczeństwo i wydajność

Każdy wzorzec przechodzi kontrolę przed zapisem i przed uruchomieniem. Marinara blokuje wzorce, które z dużym prawdopodobieństwem będą działać wolno i zawieszą aplikację. Zablokowany wzorzec pokazuje komunikat "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns." Zapis pozostaje zablokowany do czasu poprawki.

Mówiąc prosto, unikaj takich konstrukcji:

- Wzorce dłuższe niż 1000 znaków.
- Powtarzalna grupa umieszczona wewnątrz innej powtarzalnej grupy, na przykład `(a+)+`.
- Dwa szerokie symbole wieloznaczne obok siebie, na przykład `.*.*` albo `\s*\w*`. Szeroki symbol wieloznaczny to token w rodzaju `.*`, `\s*` czy `\w+`, który potrafi dopasować dowolnie dużo tekstu.
- Trzy lub więcej szerokich symboli wieloznacznych w jednym wzorcu, nawet gdy dzieli je inny tekst.

Pojedyncze powtórzenie w rodzaju `a+` albo `(a+)` jest w porządku. Jeden szeroki symbol wieloznaczny sam w sobie, na przykład jedno `.*`, też nie sprawia kłopotu.

Nawet przy bezpiecznym wzorcu aplikacja pilnuje, ile czasu może zająć jedna zamiana w dłuższej wiadomości. Kiedy skrypt zajmuje zbyt dużo czasu przy jednej wiadomości, aplikacja pomija go tylko dla tej wiadomości i pracuje dalej. Skrypt nie zostaje wyłączony i spróbuje ponownie przy następnej wiadomości. Dla pewności zawsze przetestuj nowy wzorzec w sekcji **Live Test** na krótkim przykładowym tekście, zanim go włączysz.

## Powiązane przewodniki

- [Makra](../prompts/macros.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
