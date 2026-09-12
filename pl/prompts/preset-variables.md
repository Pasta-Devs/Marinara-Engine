# Zmienne presetu

Ten przewodnik wyjaśnia, czym są **Preset Variables** (zmienne presetu) – małe, formularzowe wybory, które da się wbudować w preset promptu. Autor presetu definiuje je raz, a każdy, kto z tego presetu korzysta, wybiera opcje w momencie przypisania presetu do czatu. Zmienne presetu bywają nazywane blokami wyboru.

## Do czego służą zmienne presetu

Preset promptu to szablon tekstu wysyłanego do AI, którego można używać wielokrotnie. Zmienna presetu dodaje do tego szablonu opisany wybór. Nadajesz mu nazwę, piszesz pytanie i wypisujesz kilka opcji.

W treści dowolnej sekcji promptu wpisujesz nazwę zmiennej w podwójnych klamrach, na przykład `{{tone}}`. Kiedy AI generuje odpowiedź, Marinara Engine podmienia `{{tone}}` na wartość wybranej opcji. Dzięki temu jeden preset daje różne zachowania i nie trzeba przy tym ruszać treści promptu.

Zmienne presetu żyją wewnątrz presetu promptu, więc działają w tych trybach czatu, które z presetów promptu korzystają. W trybie Conversation nie działają. Ten tryb zamiast presetu podzielonego na sekcje używa jednego nadpisanego tekstu promptu, więc zmienne nie mają czego wypełnić. Same presety opisuje przewodnik [Edytor presetów i menedżer promptów](presets.md).

## Trzy rodzaje zmiennej presetu

Zachowanie zmiennej zależy od jej opcji i od dwóch przełączników. Domyślnie zmienna z kilkoma opcjami to pojedynczy wybór: użytkownik wskazuje dokładnie jedną opcję, pokazaną jako przyciski radiowe. Na tej podstawie zbudowano trzy nazwane rodzaje.

**Boolean Toggle** (przełącznik dwustanowy). Zmienna z dokładnie jedną opcją zamienia się w przełącznik włącz/wyłącz. Po włączeniu wstawiana jest wartość opcji. Po wyłączeniu nie wstawia się nic. Edytor oznacza takie zmienne etykietą **Boolean Toggle**.

**Multi-Select** (wybór wielokrotny). Włącz przełącznik **Multi-Select**, żeby użytkownik mógł wskazać więcej niż jedną opcję. Domyślnie zaznaczone wartości łączą się w jeden tekst za pomocą separatora. Separator to krótkie pole tekstowe, a domyślnie jest to przecinek ze spacją. Na przykład opcje Romance, Fantasy i Action połączone przez `, ` dają tekst "Romance, Fantasy, Action".

**Random Pick** (losowy wybór). Dla zmiennej z pojedynczym wyborem aplikacja Marinara Engine losowo zaznacza opcję przy każdym nowym czacie. Możesz ją zmienić przed potwierdzeniem, a zapisany wybór pozostaje stały do następnej edycji. Przy włączonym **Multi-Select** aplikacja losuje jedną z zaznaczonych opcji przy każdym generowaniu. Przydaje się to dla urozmaicenia: użytkownik wybiera pulę opcji, a każda odpowiedź losuje z niej jedną.

## Dodawanie zmiennej presetu

Zmienne dodaje się podczas edycji presetu. Wykonaj kolejno te kroki.

1. Otwórz panel **Presets** (Presety) i kliknij preset, żeby otworzyć okno **Preset Editor** (edytor presetów).
2. Przejdź do zakładki **Sections** (Sekcje) i przewiń na sam dół, do panelu **Preset Variables**.
3. Kliknij przycisk **Add Variable** (dodanie zmiennej). Pojawia się nowa karta zmiennej. Kliknij ją, żeby rozwinąć edytor.
4. Wypełnij pole **Variable Name** (nazwa zmiennej). Wolno użyć wyłącznie liter, cyfr i podkreśleń. To właśnie tę nazwę wpisujesz w klamrach, na przykład `{{variable_name}}`.
5. Wypełnij pole **Question (shown to user)** (pytanie widoczne dla użytkownika). To tekst, który użytkownik czyta przy wybieraniu wartości.
6. Uzupełnij listę **Options** (Opcje). Każda opcja ma pole **Label** (to, co widzi użytkownik) oraz **Value** (tekst wstawiany do promptu). Pusta wartość nie wstawia niczego.
7. W sekcji **Presentation** (sposób wyświetlania) wybierz styl: **Auto**, styl przyciskowy (**Radios** lub **Checkboxes**) albo styl kompaktowy (**Dropdown** lub **Listbox**). Włącz opcję **Alphabetical option display**, żeby posortować opcje według etykiet.
8. Zmiany zapisują się same. Na dole edytora widnieje napis "Changes auto-save. Press Escape to close." Na koniec naciśnij Escape albo kliknij przycisk **Done**.

Żeby użyć zmiennej, wpisz jej nazwę w klamrach w treści dowolnej sekcji promptu. Na przykład: umieść `{{tone}}` w sekcji, a potem utwórz zmienną o nazwie `tone` z opcją **Gentle** i opcją **Harsh**. Kiedy użytkownik wskaże Harsh, sekcja dostaje wartość spod tej opcji.

Zmienna musi zawsze zachować co najmniej jedną opcję. Przy próbie usunięcia ostatniej opcji Marinara ją zostawia.

## Okno Configure Preset Variables

Kiedy przypisujesz do czatu preset ze zmiennymi, samo otwiera się okno **Configure Preset Variables** (konfiguracja zmiennych presetu). We wstępie widnieje napis: "This preset has configurable variables. Select option(s) for each to customize your experience."

Przy każdej zmiennej widać jej pytanie, symbol zastępczy, który zostanie podmieniony (na przykład `{{tone}}`), oraz – tam, gdzie ma to zastosowanie – mały kafelek z napisem **Boolean toggle**, **Multi-select** albo **Random pick**. Wskaż wartość dla każdej zmiennej.

- Przycisk **Save as default** zapisuje wybory z powrotem w presecie, więc następnym razem są już wypełnione.
- Przycisk **Skip** zamyka okno bez zapisywania wyborów.
- Przycisk **Confirm Choices** zapisuje wybory. Pozostaje nieaktywny, dopóki każda zmienna pojedynczego wyboru nie ma wartości. Zmienne **Boolean toggle** i **Multi-select** go nie blokują, nawet gdy nic nie jest wskazane.

Przełączenie na inny preset kasuje wszystkie wybory zmiennych zrobione dla poprzedniego presetu.

## Późniejsza zmiana odpowiedzi

Nie trzeba otwierać presetu od zera, żeby zmienić odpowiedzi. W panelu bocznym ustawień czatu, w sekcji **Prompt Preset**, przy każdym presecie ze zmiennymi widoczny jest przycisk z ołówkiem opisany jako **Edit preset variables**. Kliknij go, a okno **Configure Preset Variables** otworzy się ponownie z aktualnymi wyborami.

## Zapasowa obsługa {{NAME}}

Marinara rozwiązuje wiele wbudowanych makr, na przykład `{{user}}` i `{{char}}`. Potem każdy pozostały symbol zastępczy w postaci `{{NAME}}` (tylko litery, cyfry i podkreślenia) jest porównywany ze zmiennymi presetu.

Jeśli zmienna o dokładnie takiej nazwie istnieje, symbol zastępczy zmienia się w wybraną wartość. Jeśli żadna zmienna nie pasuje, tekst `{{NAME}}` zostaje dokładnie taki, jak został wpisany. Dlatego nieznany symbol zastępczy trafia do wyniku bez zmian, zamiast wywołać błąd. Pełną listę makr zawiera przewodnik [Makra promptów](macros.md).

## Powiązane przewodniki

- [Edytor presetów i menedżer promptów](presets.md)
- [Makra promptów](macros.md)

Zmienne presetu są rozwijane także w powitaniach postaci, również dla wyborów potwierdzonych już po utworzeniu powitania. Oryginalne powitanie pozostaje edytowalne i zachowuje swoje makra.
