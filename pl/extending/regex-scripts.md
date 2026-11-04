# Skrypty regex

Skrypt regex to reguła "znajdź i zamień", która automatycznie przepisuje tekst czatu. Użyj go, żeby uporządkować odpowiedź AI, przekształcić własną wiadomość albo zmienić tekst, który otrzymuje model. Do korzystania z niego nie trzeba umieć programować.

Regex to skrót od "regular expression", czyli wyrażenia regularnego: wzorca wyszukiwania, który znajduje tekst pasujący do reguły. Wzorzec ustawiasz raz, a potem działa w każdej pasującej wiadomości.

Przykład: niektóre modele otaczają opisy czynności gwiazdkami.

```text
*She smiles* Hello there.
```

Skopiuj dokładnie ten wzorzec: `\*([^*]+)\*`. Zamień go na `$1`, a gwiazdki znikną, a tekst z ich wnętrza zostanie:

```text
She smiles Hello there.
```

`$1` oznacza "tekst przechwycony przez pierwszą parę nawiasów". Inne typowe zastosowania to usuwanie uwag spoza roli w nawiasach, cenzurowanie wybranego słowa i poprawianie dziwactw formatowania jednej postaci.

## Tworzenie skryptu regex

Twoje globalne skrypty znajdują się w panelu **Presets** (presety), w sekcji **Regexes** (skrypty regex). Otwórz go przyciskiem **Presets** na górnym pasku.

### Jak utworzyć skrypt regex

1. Otwórz **Presets** i znajdź **Regexes**.
2. Kliknij **Create regex** (utworzenie skryptu regex). Otwiera się pełny edytor.
3. Wpisz nazwę na górze. Nowy skrypt ma nazwę "New Regex Script".
4. W polu **Find Pattern (Regex)** (wzorzec wyszukiwania) wpisz `\*([^*]+)\*` (zobacz [Pola edytora](#editor-fields)).
5. W polu **Replace With** (zamiana na) wpisz `$1`.
6. W polu **Apply To** (zakres stosowania) zostaw zaznaczone **AI Output** (odpowiedzi AI). Domyślny tryb zastosowania **Only Display** (tylko wyświetlanie) jest bezpiecznym wyborem (zobacz [Wybór miejsca działania skryptu](#choose-where-a-script-runs)).
7. Wklej `*She smiles* Hello there.` do sekcji **Live Test** (test na żywo). Pod **Result:** powinien pojawić się tekst `She smiles Hello there.`
8. Kliknij **Save** (zapis). Na moment pojawi się zielona notatka **Saved**.
9. Sprawdź to w czacie: gdy odpowiedź AI zawiera tekst między gwiazdkami, gwiazdki nie są już widoczne.

Jeśli to nie zadziałało: czerwony komunikat pod polem **Find Pattern (Regex)** blokuje zapis. Wzorzec jest błędny albo niebezpieczny; zobacz [Bezpieczeństwo i wydajność](#safety-and-performance).

### Zarządzanie skryptami

Każdy wiersz listy **Regexes** pokazuje nazwę skryptu, tag **AI** albo **User**, wzorzec w postaci `/pattern/flags`, przełącznik włącz/wyłącz (zmiana działa od razu), **Edit regex** (edycja skryptu regex, ołówek) i **Delete regex** (usunięcie skryptu regex, kosz). Gdy nie ma żadnych skryptów, lista pokazuje "No regexes yet". Przeciągnij wiersz za uchwyt, żeby zmienić kolejność uruchamiania.

Nagłówek sekcji ma trzy przyciski z ikonami: **Create regex**, **Import regexes from JSON** (import skryptów z pliku JSON) i **Export regexes to JSON** (eksport skryptów do pliku JSON; zapisuje wszystkie twoje skrypty globalne do jednego pliku). Skrypty powiązane z jedną postacią są przechowywane osobno; zobacz [Ograniczenie skryptu do jednej postaci](#limit-a-script-to-one-character).

<a id="editor-fields"></a>

## Pola edytora

### Pole **Find Pattern (Regex)**

Wzorzec wyszukiwania. Wpisz sam wzorzec, bez ukośnika na początku ani na końcu. Tekst zastępczy pokazuje przykład: `\*([^*]+)\*`.

### Pole **Replace With**

Tekst, który zastępuje każde dopasowanie. Zostaw je puste, żeby usunąć dopasowanie. Przechwycony tekst wykorzystasz ponownie przez `$1`, `$2` i kolejne. Przed przechwyceniem działają takie zmiany wielkości liter:

| Zapis | Wynik |
| --- | --- |
| `\u$1` | Zamienia pierwszą literę przechwycenia na wielką |
| `\U$1\E` | Zapisuje całe przechwycenie wielkimi literami |
| `\l$1` | Zamienia pierwszą literę przechwycenia na małą |
| `\L$1\E` | Zapisuje całe przechwycenie małymi literami |

Dosłowny tekst z odwrotnym ukośnikiem, np. ścieżka Windows w rodzaju `C:\Users`, zostaje taki, jak go zapisano.

### Sekcja **Regex Flags**

Przyciski przełączające (flagi wyrażenia regularnego), które zmieniają sposób dopasowania wzorca. Nowy skrypt startuje z włączonymi `g` i `i`.

| Flaga | Znaczenie |
| --- | --- |
| `g` | Global: zamienia każde dopasowanie, nie tylko pierwsze |
| `i` | Case-insensitive: bez rozróżniania wielkości liter |
| `m` | Multiline: `^` i `$` dopasowują się przy podziałach wierszy |
| `s` | dotAll: `.` dopasowuje także znaki nowej linii |
| `u`, `y`, `d` | Unicode, sticky i match indices, do szczególnych przypadków |

### Sekcja **Trim Strings**

Opcjonalna lista zwykłych fragmentów tekstu (przycinanych ciągów), które są usuwane po wykonaniu zamiany. Kliknij **Add trim string** (dodanie przycinanego ciągu), żeby dodać wiersz, a przycisk **X**, żeby go usunąć. Użyj tego dla stałego fragmentu tekstu, który łatwiej wpisać, niż dopasować wzorcem.

### Sekcja **Live Test**

Wklej przykładowy tekst, a wynik pojawi się pod **Result:**. Live Test sprawdza tylko logikę wyszukiwania, zamiany i przycinania. Miejsce działania, stan włączenia, zasięg postaci i głębokość są oceniane w prawdziwym czacie. We wzorcu, w tekście zamiany i w przycinanych ciągach możesz używać makr takich jak `{{user}}` i `{{char}}`. W Live Test przyjmują wartości przykładowe. Zobacz [Makra](../prompts/macros.md).

<a id="choose-where-a-script-runs"></a>

## Wybór miejsca działania skryptu

### Pole **Apply To**

**Apply To** decyduje, którą stronę czatu obserwuje skrypt. Zostaw zaznaczoną co najmniej jedną opcję. Możesz wybrać obie.

- **AI Output**: działa na odpowiedziach AI, zanim zostaną wyświetlone.
- **User Input** (wiadomości użytkownika): działa na twoich wiadomościach, zanim zostaną wysłane.

### Selektor **Apply Mode**

**Apply Mode** (tryb zastosowania) znajduje się w sekcji **Advanced Options** (opcje zaawansowane). Decyduje o tym, co zmienia przepisanie. Nowy skrypt startuje w trybie **Only Display**.

- **Only Display**: zmienia to, co widzisz w czacie. Zapisana wiadomość i późniejszy kontekst modelu pozostają bez zmian. Najbezpieczniejsza opcja przy porządkowaniu wyglądu odpowiedzi.
- **Only Prompt** (tylko prompt): zmienia to, co otrzymuje model, co widać też w podglądzie promptu. Widok i zapisana wiadomość pozostają bez zmian. Użyj go, żeby usunąć coś, co model uparcie kopiuje.
- **Both** (oba): zmienia widok i tekst promptu.

W przypadku twoich własnych wiadomości skrypt **User Input** w trybie **Only Display** albo **Both** przepisuje wiadomość tuż przed jej wysłaniem. Zmienia się zapisana i wysłana wiadomość, a nie tylko jej wygląd. Dla wychodzących wiadomości nie ma trybu działającego wyłącznie na widok.

### Kolejność wykonania i zakres głębokości

Oba ustawienia są w sekcji **Advanced Options**.

- **Execution Order** (kolejność wykonania) to liczba. Niższe liczby działają pierwsze, co ma znaczenie, gdy do tego samego tekstu może pasować kilka skryptów. Nowy skrypt startuje od 0, a przy zapisie aplikacja przydziela kolejną wolną liczbę. Możesz też przeciągać wiersze na liście **Regexes**.
- **Depth Range** (zakres głębokości) ogranicza, jak daleko wstecz działa skrypt, za pomocą pól **Min** i **Max**. Najnowsza wiadomość ma głębokość 0, poprzednia głębokość 1 i tak dalej. Zostaw oba pola puste, żeby skrypt działał na każdej głębokości. Zapis jest zablokowany, gdy **Min** jest większe od **Max**.

### Czaty grupowe

Dotyczy to trybów **Only Prompt** i **Both** w czacie **Roleplay** z grupowym trybem **Individual** (osobne odpowiedzi).

- Miejsce działania zależy od postaci, która otrzymuje prompt.
- Twoje wiadomości i wiadomości innych postaci liczą się jako **User Input**.
- Własne odpowiedzi odpowiadającej postaci liczą się jako **AI Output**, także wcześniejsze odpowiedzi w tej samej turze grupowej.
- Ograniczenia do postaci nadal decydują, kto otrzymuje przepisany prompt. Narrator wykluczony ze skryptu ukrywającego myśli zachowuje oryginalne myśli.

<a id="limit-a-script-to-one-character"></a>

## Ograniczenie skryptu do jednej postaci

Skrypt może należeć do wybranych postaci, zamiast działać wszędzie. Są dwa sposoby.

- W edytorze: włącz **Specific Characters** (wybrane postacie) w sekcji **Apply To** i wybierz jedną lub kilka postaci. Przy wyłączonym przełączniku skrypt "Applies to all characters". Gdy jest włączony, wybierz co najmniej jedną postać.
- Przy postaci: otwórz postać, przejdź do zakładki **Advanced** (zaawansowane) i znajdź sekcję **Regex Scripts** (skrypty regex). Wymienia ona tylko skrypty tej postaci i ma własne przyciski **Create regex**, importu i eksportu. Najpierw zapisz postać, bo inaczej sekcja informuje, że nie można jeszcze dodać skryptów.

Otwarcie pełnego edytora z tej sekcji opuszcza edytor postaci (Character Editor). Jeśli postać ma niezapisane zmiany, aplikacja najpierw cię ostrzega.

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### Ustawienie **Scoped Regex Scripts** dla pojedynczego czatu

Skrypty przypisane do postaci nie działają same z siebie w każdym czacie. Steruje nimi ustawienie osobne dla każdego czatu. Otwórz **Chat Settings** (ustawienia czatu). Sekcja **Scoped Regex Scripts** pojawia się tylko wtedy, gdy co najmniej jedna postać w tym czacie ma przypisane skrypty.

| Tryb | Co się dzieje |
| --- | --- |
| **Disabled** (domyślnie) | Skrypty przypisane do postaci są wyłączone. Działają tylko skrypty globalne. |
| **Exclusive** | Każdy przypisany skrypt zmienia tylko wiadomości swojej postaci. |
| **Chat** | Każdy przypisany skrypt zmienia każdą wiadomość w czacie. |

**Use preset default** (użyj ustawienia domyślnego presetu) stosuje ustawienie **Scoped regex default** (domyślny tryb skryptów regex przypisanych do postaci) z presetu promptu. Wybranie trybu zastępuje je w tym czacie. Żeby nowe czaty zaczynały z wybranym trybem, użyj jednego z tych sposobów:

- Ustaw go jako ustawienie domyślne presetu.
- Zapisz go w swoim [domyślnym profilu ustawień](../chats/settings-profiles.md#choosing-the-default-profile).
- Wybierz go, a potem kliknij gwiazdkę ulubionego układu obok **Reset View** (zobacz [Wybieranie układu dla nowych czatów](../chats/chat-settings.md#choosing-a-layout-for-new-chats)).

Pod trybami panel wypisuje przypisane skrypty każdej postaci, każdy z własnym przełącznikiem. To przełącznik samego skryptu, więc zmienia skrypt we wszystkich czatach. Tryb steruje skryptami działającymi po stronie widoku. Skrypty promptu zawsze idą za postacią, która generuje odpowiedź.

## Import i zastępowanie skryptów

### Import z aplikacji SillyTavern

Marinara odczytuje skrypty regex dołączone do karty postaci z aplikacji SillyTavern. Przy imporcie karty sekcja **Imported regex scripts** (zaimportowane skrypty regex) oferuje dwie możliwości:

- **Character only** (tylko postać; domyślnie): skrypty pozostają przypisane do tej postaci.
- **Global** (globalnie): skrypty trafiają do panelu **Presets** i działają w każdym czacie.

Ten wybór pojawia się w oknie importu pojedynczej postaci i w zbiorczym imporcie **Import from SillyTavern Folder**. Skrypty z pustym wzorcem albo ze wzorcem, który nie przechodzi kontroli bezpieczeństwa, są pomijane. Żeby zaimportować zwykły plik JSON ze skryptami, użyj **Import regexes from JSON** w sekcji **Regexes**. Zobacz [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

### Zastępowanie pakietu regexów

1. W **Presets → Regexes** (presety, skrypty regex) wybierz **Select regex scripts** (wybierz skrypty regex).
2. Zaznacz wpisy starego pakietu albo wybierz **Select all regex scripts** (zaznacz wszystkie skrypty regex).
3. Użyj **Export** (eksportuj) lub **Delete** (usuń) na pasku akcji. Usuwanie wymaga jednego potwierdzenia i jest nieodwracalne.
4. Zaimportuj zaktualizowany pakiet.

Wpisy, których nie udało się usunąć, pozostają zaznaczone, żeby można było ponowić próbę. Niezaznaczone skrypty pozostają na miejscu. Przypisania do presetów nadal są dostępne w edytorze regexów.

<a id="safety-and-performance"></a>

## Bezpieczeństwo i wydajność

Każdy wzorzec jest sprawdzany, zanim będzie można go zapisać lub uruchomić. Wzorzec, który prawdopodobnie będzie działać wolno i zawiesi aplikację, zostaje zablokowany z tym komunikatem, a zapis jest wstrzymany do czasu poprawki:

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

Jeśli widzisz ten komunikat, skróć i uprość wzorzec. Unikaj takich konstrukcji:

- Wzorce dłuższe niż 1000 znaków.
- Powtarzalna grupa wewnątrz innej powtarzalnej grupy, np. `(a+)+`.
- Dwa szerokie symbole wieloznaczne obok siebie, np. `.*.*` albo `\s*\w*`. Szeroki symbol wieloznaczny to token w rodzaju `.*`, `\s*` czy `\w+`, który może dopasować dowolnie dużo tekstu.
- Trzy lub więcej szerokich symboli wieloznacznych w dowolnym miejscu jednego wzorca, nawet gdy dzieli je inny tekst.

Pojedyncze powtórzenie w rodzaju `a+` albo `(a+)` lub jeden szeroki symbol wieloznaczny, np. pojedyncze `.*`, są w porządku.

Nawet bezpieczny wzorzec ma limit czasu na jedną zamianę w długiej wiadomości. Jeśli skrypt trwa zbyt długo przy jednej wiadomości, aplikacja pomija ten skrypt tylko dla tej wiadomości. Skrypt pozostaje włączony i próbuje ponownie przy następnej wiadomości. Najpierw przetestuj nowy wzorzec w sekcji **Live Test** na krótkim przykładowym tekście.

## Powiązane przewodniki

- [Makra](../prompts/macros.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Importowanie z SillyTavern](../data/importing-from-sillytavern.md)
