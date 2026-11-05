# Zmienne presetu

Zmienna presetu to opisany wybór wbudowany w preset promptu. Autor presetu definiuje ją raz, a każdy, kto z presetu korzysta, wybiera opcje w momencie przypisania presetu do czatu. Dzięki niej jeden preset może działać na różne sposoby bez zmieniania tekstu promptu.

Nadajesz zmiennej nazwę, piszesz pytanie i wypisujesz opcje. Potem wpisujesz nazwę w podwójnych klamrach, na przykład `{{tone}}`, w dowolnej sekcji promptu. Kiedy AI generuje odpowiedź, Marinara podmienia `{{tone}}` na wartość opcji wybranej przez użytkownika.

Zmienne presetu wymagają presetu promptu, więc działają w czatach w trybie Roleplay. Nie działają w czatach w trybie Conversation ani Game Mode, które zamiast sekcji używają jednego tekstu promptu. Same presety opisuje przewodnik [Edytor presetów i menedżer promptów](presets.md).

## Rodzaje zmiennej presetu

Zmienna z kilkoma opcjami to domyślnie pojedynczy wybór. Użytkownik wskazuje jedną opcję, pokazaną jako przyciski radiowe. Zmieniają to trzy ustawienia.

| Rodzaj | Jak go uzyskać | Działanie |
| --- | --- | --- |
| **Boolean Toggle** (przełącznik dwustanowy) | Daj zmiennej dokładnie jedną opcję. | Przełącznik włącz/wyłącz. Po włączeniu wstawiana jest wartość opcji. Po wyłączeniu nie wstawia się nic. |
| **Multi-Select** (wybór wielokrotny) | Włącz **Multi-Select**. | Użytkownik wskazuje kilka opcji. Wartości łączą się za pomocą separatora, domyślnie `, `. Romance, Fantasy i Action dają "Romance, Fantasy, Action". |
| **Random Pick** (losowy wybór) | Włącz **Random Pick**. | Przy zmiennej z pojedynczym wyborem Marinara losowo zaznacza opcję przy każdym nowym czacie, a wybór pozostaje stały, dopóki go nie zmienisz. Przy włączonym **Multi-Select** użytkownik wybiera pulę, a każda odpowiedź losuje z niej jedną opcję. |

## Dodawanie zmiennej presetu

1. Otwórz panel **Presets** (Presety) i kliknij preset, żeby otworzyć okno **Preset Editor** (edytor presetów).
2. Przejdź do zakładki **Sections** (Sekcje) i przewiń na dół, do panelu **Preset Variables** (zmienne presetu).
3. Kliknij **Add Variable** (dodanie zmiennej). Pojawia się nowa karta zmiennej. Kliknij ją, żeby ją rozwinąć.
4. Wypełnij pole **Variable Name** (nazwa zmiennej). Pole zachowuje tylko litery, cyfry i podkreślenia. To tę nazwę wpisujesz w klamrach.
5. Wypełnij pole **Question (shown to user)** (pytanie widoczne dla użytkownika). Użytkownik czyta je przy wybieraniu.
6. Uzupełnij listę **Options** (opcje). Każda opcja ma pole **Label** (etykieta), które widzi użytkownik, oraz **Value** (tekst wstawiany do promptu). Pusta wartość nie wstawia niczego.
7. W sekcji **Presentation** (sposób wyświetlania) wybierz **Auto**, styl przyciskowy (**Radios** lub **Checkboxes**) albo styl kompaktowy (**Dropdown** lub **Listbox**). Włącz **Alphabetical option display**, żeby posortować opcje według etykiet.
8. Naciśnij <kbd>Escape</kbd> albo kliknij **Done**. Zmiany zapisują się same, a na dole widnieje napis "Changes auto-save. Press Escape to close."

Teraz wpisz nazwę w klamrach w sekcji promptu. Na przykład umieść `{{tone}}` w sekcji i utwórz zmienną o nazwie `tone` z opcją **Gentle** i opcją **Harsh**. Kiedy użytkownik wybierze **Harsh**, sekcja dostaje jej wartość.

Zmienna zawsze zachowuje co najmniej jedną opcję. Przy próbie usunięcia ostatniej Marinara ją zostawia.

## Odpowiadanie na zmienne

Kiedy przypisujesz do czatu preset ze zmiennymi, otwiera się okno **Configure Preset Variables** (konfiguracja zmiennych presetu). Widnieje w nim napis: "This preset has configurable variables. Select option(s) for each to customize your experience."

Przy każdej zmiennej widać jej pytanie, jej symbol, na przykład `{{tone}}`, oraz plakietkę (**Boolean toggle**, **Multi-select** albo **Random pick**) tam, gdzie ma to zastosowanie.

1. Wskaż wartość dla każdej zmiennej.
2. Kliknij **Confirm Choices** (potwierdzenie wyborów).

Pozostałe przyciski:

- **Save as default** (zapisanie jako domyślne) zapisuje wybory w presecie, więc następnym razem są już wypełnione.
- **Skip** (pominięcie) zamyka okno bez zapisywania.

**Confirm Choices** pozostaje nieaktywny, dopóki każda zmienna pojedynczego wyboru nie ma wartości. Zmienne **Boolean toggle** i **Multi-select** go nie blokują, nawet gdy nic nie jest wskazane. Przełączenie na inny preset kasuje wybory dla poprzedniego.

## Późniejsza zmiana odpowiedzi

W panelu **Chat Settings** (ustawienia czatu) sekcja **Prompt Preset** pokazuje przycisk z ołówkiem, **Edit preset variables** (edycja zmiennych presetu), gdy wybrany preset ma zmienne. Kliknij go, żeby ponownie otworzyć okno z aktualnymi wyborami.

## Nazwy, które nie są zmiennymi

Marinara najpierw rozwiązuje wbudowane makra, takie jak `{{user}}` i `{{char}}`. Potem porównuje każdy inny zapis `{{NAME}}` (litery, cyfry i podkreślenia) ze zmiennymi presetu. Jeśli żadna nie pasuje, sprawdza zmienne samego czatu z sekcji **Chat Variables** (zmienne czatu) panelu **Chat Settings**. Zmienna presetu ma pierwszeństwo, gdy obie używają tej samej nazwy. Jeśli nazwy nie ma w żadnej z nich, tekst zostaje dokładnie taki, jak został wpisany, bez błędu. Zobacz [Makra promptów](macros.md).

## Bloki decyzyjne w opcjach

Wartość opcji może zawierać blok decyzyjny, `{{#if decision:"..."}}`, jak każdy tekst promptu. Pytane są tylko opcje wybrane w czacie i liczą się do **Decision statements per turn** (stwierdzenia decyzyjne na turę). Dla zmiennej **Random Pick** pytane są wszystkie opcje z puli, bo każda może zostać wylosowana. Zobacz [Pytanie modelu decyzyjnego](conditional-prompts.md#asking-the-decision-model).

Wartość zmiennej trafia tam, gdzie stoi jej `{{name}}`. Jeśli decyzja zmienia tę wartość blisko początku presetu, możesz stracić dużą część ponownego użycia pamięci podręcznej promptu w usłudze. Często zmienianą treść umieszczaj dalej. Zobacz [Bloki decyzyjne i pamięć podręczna promptu](presets.md#decision-blocks-and-prompt-caching).

## Powitania

Zmienne presetu są rozwijane także w powitaniach postaci, również dla wyborów potwierdzonych już po utworzeniu powitania. Oryginalne powitanie pozostaje edytowalne i zachowuje swoje makra.

## Powiązane przewodniki

- [Edytor presetów i menedżer promptów](presets.md)
- [Makra promptów](macros.md)
