# Persony użytkownika: tworzenie i edycja

Z tego przewodnika dowiesz się, czym jest persona (postać, w którą się wcielasz), jak ją stworzyć i jak ją edytować. Zobaczysz też, jak persony importować, eksportować, duplikować i usuwać. Persona to twoja własna karta postaci: tożsamość, pod którą aplikacja Marinara Engine przedstawia cię w czacie.

## Czym jest persona

Persona to ktoś, kim jesteś w czacie. Ma nazwę, opis i kilka dodatkowych, opcjonalnych szczegółów. Marinara wysyła te szczegóły w każdym prompcie (tekst, który Marinara wysyła do AI), żeby AI wiedziało, z kim rozmawia.

Możesz tworzyć wiele person i przechowywać je w panelu **Personas** (Persony). Wybierz personę dla każdego czatu albo wybierz **None** (brak), żeby nie używać żadnej. Ten przewodnik opisuje tworzenie i edycję person. Sposób wybierania persony dla konkretnego czatu opisuje [Wybór persony w czacie](choosing-your-persona.md).

### Makro {{user}}

Makro to symbol zastępczy w tekście, który aplikacja zamienia na prawdziwą wartość tuż przed wysłaniem promptu. Makro **{{user}}** zamienia się na nazwę persony używanej w danym czacie. Jest to persona wybrana dla czatu. Przykład: gdy taka persona nazywa się Alex, w prompcie **{{user}}** staje się Alex.

Jeśli czat nie ma wybranej persony, AI zwraca się do ciebie ogólną nazwą "User" i nie otrzymuje żadnych szczegółów persony. Sposób, w jaki czat dobiera personę, opisuje [Wybór persony w czacie](choosing-your-persona.md). Więcej o makrach znajdziesz w przewodniku [Makra](../prompts/macros.md).

## Panel Personas

Panel **Personas** to biblioteka person. Otwiera go ikona osoby na górnym pasku prawego paska bocznego. Stoi obok przycisków **Lorebooks**, **Presets**, **Connections** i **Agents**.

Panel udostępnia takie kontrolki:

- **Download** (pobranie) otwiera [Card Browser](bot-browser.md), w którym znajdziesz też persony z serwisu PlotLight.
- **Open Library** (otwarcie biblioteki) otwiera responsywną, pełnoekranową bibliotekę person. Ma ten sam układ siatki z podglądem co biblioteka postaci: opisy person, sekcje karty, tagi i szacowaną liczbę tokenów (małych kawałków tekstu).
- **New** (nowa) tworzy personę.
- **Import** (import) otwiera okno **Import Persona**.
- **Select** (zaznaczanie) włącza tryb zaznaczania zbiorczego, dzięki czemu da się działać na wielu personach naraz.
- Pole wyszukiwania z tekstem zastępczym **Search personas** przeszukuje nazwę, opis, komentarz i tagi.
- Lista rozwijana sortowania oferuje **Manual order** (kolejność ręczna), **A-Z**, **Z-A**, **Newest**, **Oldest** oraz **Tokens** (szacowany rozmiar promptu). **Manual order** zachowuje ustawioną przez ciebie kolejność: przeciągnij wiersz w górę lub w dół albo naciśnij Alt+strzałka w górę lub Alt+strzałka w dół na wierszu, który ma fokus. Na ekranie dotykowym naciśnij i przytrzymaj wiersz, żeby go podnieść.
- **New Folder** (nowy folder) tworzy folder do porządkowania person.
- Kafelek **Tags** rozwija listę tagów do filtrowania.

Każdy wiersz pokazuje awatar persony, nazwę i krótki fragment opisu. Po najechaniu na wiersz pojawiają się akcje **Duplicate** (duplikowanie) i **Delete** (usunięcie). Kliknięty wiersz otwiera daną personę w pełnoekranowym edytorze **Persona Editor**.

Kiedy person jest więcej, niż mieści się na jednej stronie, na dole pojawia się przycisk **Load more**. Przy pustej bibliotece panel wyświetla krótki komunikat "No personas yet".

## Tworzenie persony

1. Otwórz panel **Personas**.
2. Kliknij przycisk **New**. Otwiera się okno **Create Persona**.
3. Wpisz nazwę w polu **Name**. To jedyne wymagane pole.
4. Kliknij przycisk **Create**.

Persona powstaje z pustym opisem. Od razu otwiera się w pełnym edytorze **Persona Editor**, żeby dało się uzupełnić resztę. W oknie tworzenia nie ustawia się innych pól – wszystko pozostałe edytuje się później w edytorze **Persona Editor**.

Po utworzeniu persony wybierz ją w czacie, w którym chcesz jej używać.

## Edytor Persona Editor

Otwarcie persony zastępuje obszar czatu pełnoekranowym edytorem **Persona Editor**. W nagłówku znajdziesz:

- Strzałkę **Back** zamykającą edytor.
- Kafelek awatara. Kliknięcie wgrywa nowy awatar. Przy skonfigurowanym połączeniu do generowania obrazów pojawia się tu też przycisk z różdżką **Generate avatar**.
- Pole nazwy i pole komentarza (na krótką notatkę w rodzaju "Modern AU version").
- Przycisk **Save** (zapis). Pozostaje wyszarzony do pierwszej zmiany.
- Ikony akcji w nagłówku: **Export persona**, **Add persona as character**, **Duplicate persona** i **Delete persona**.

Przy próbie wyjścia z niezapisanymi zmianami pojawia się pasek z komunikatem "You have unsaved changes. Close without saving?". Daje on do wyboru **Keep editing**, **Discard & close** i **Save & close**.

W treści edytora stoi rząd zakładek, w tej kolejności: **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** i **Stats**.

### Zakładka Metadata

Zakładka **Metadata** zbiera dane tożsamości i informacje biblioteczne:

- Wiersz **Persona ID** z przyciskiem **Copy**. Większość osób nigdy go nie potrzebuje. Przydaje się przy zgłoszeniach do pomocy technicznej.
- Widget kadrowania awatara. Przeciąganiem przesuwasz albo przybliżasz okrągły kadr awatara.
- **Name**: wyświetlana nazwa persony. Marinara wstawia ją do promptów jako twoją tożsamość.
- **Creator**: autor tej persony, do podania przy udostępnianiu.
- **Phonetic name**: opcjonalny zapis wymowy. Ma znaczenie tylko wtedy, gdy nazwę persony czyta na głos synteza mowy (TTS). Funkcja TTS w aplikacji odczytuje tekst.
- **Title / Comment**: krótka, prywatna notatka pokazywana pod nazwą w bibliotece.
- **Version**: dowolny tekst z numerem wersji do śledzenia własnych zmian. Domyślnie ma wartość **1.0**.
- **Tags**: dowolne etykiety tekstowe. Naciśnij Enter albo kliknij przycisk **Add**, aby dodać tag. Po dodaniu tagów pojawia się przycisk **Remove All**. Tagi służą do filtrowania w panelu **Personas**.
- **Creator Notes**: prywatna, wielowierszowa notatka. Marinara nie wysyła jej do AI.

Panel **Version history** stoi pod polem **Version**. Jego działanie opisuje poniższa sekcja "Historia wersji".

### Zakładka Card

W zakładce **Card** wpisujesz najważniejsze pola persony. Każde pole to duże okno tekstowe z żywym licznikiem szacowanych tokenów pod spodem. Pasek odnośników pozwala przeskoczyć do każdej sekcji.

- **Description**: ogólna tożsamość i rola. Marinara wysyła ten opis w każdym prompcie, żeby AI wiedziało, kim jesteś.
- **Personality**: temperament, zachowanie, nawyki językowe i wzorce emocjonalne.
- **Backstory**: historia, pochodzenie, relacje i wydarzenia, które ukształtowały postać.
- **Appearance**: wygląd fizyczny, ubiór i szczegóły wizualne, o których model ma pamiętać.
- **Image Appearance Override** (osobny opis wyglądu do obrazów): opcjonalny przełącznik pod polem **Appearance**, domyślnie wyłączony. Włącz go, aby pokazać drugie pole na krótkie tagi obrazu opisujące twoją personę, na przykład słowo wyzwalające LoRA. Gdy przełącznik jest włączony, a pole wypełnione, prompty obrazów używają tych tagów dokładnie w zapisanej formie, a treść **Appearance** zostaje jako kontekst w tle. Narrator zawsze otrzymuje pełny opis z **Appearance**.
- **Scenario**: domyślna sytuacja albo kontekst dla roleplayu. Ustal tu, w jakim miejscu startuje persona.

Te okna tekstowe obsługują makra. Wpisywane cudzysłowy formatują się automatycznie zgodnie ze stylem cudzysłowów ustawionym w aplikacji.

### Zakładka Convo

Zakładka **Convo** zbiera pola działające wyłącznie w trybie Conversation. Marinara nigdy nie wysyła ich w trybie Roleplay ani Game Mode. Należą do nich **Convo Display Name**, **About Me** i **Convo Behavior**. Ponieważ pola te są wspólne z postaciami, mają własny przewodnik. Zobacz [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](../conversation/profiles.md).

### Zakładka Lorebook

W zakładce **Lorebook** przypisujesz do persony wpisy lorebooka (zbioru faktów o twoim świecie). Lorebook to zestaw wpisów World Info, które dokładają tło wtedy, kiedy jest ono na temat. Wpisy powiązane z personą mogą włączać się wtedy, gdy ta persona bierze udział w czacie. Zobacz [Lorebooki – przegląd](../lorebooks/overview.md).

### Zakładka Sprites

W zakładce **Sprites** wgrywasz grafiki postaci w pozycji stojącej dla swojej persony. Sprite'y (obrazki postaci na obszarze sceny) działają w trybie Game Mode i Roleplay. Zakładka ma podział na kategorie: **Facial Expressions**, **Full-body** i **Clips**. Da się wgrywać obrazy pojedynczo albo skorzystać z **Upload Folder** i zaimportować zbiorczo cały folder plików PNG. Sprite'y to system wspólny dla wszystkich, więc pełne szczegóły znajdziesz w przewodniku [Sprite'y postaci](sprites.md).

### Zakładka Gallery

W zakładce **Gallery** trzymasz grafiki referencyjne i filmy przypisane do persony. Ma dwie podzakładki: **Images** i **Videos**. Pliki dodajesz przyciskiem **Upload Persona Images** albo **Upload Persona Videos**. Podzakładka **Videos** zarządza dodatkowo klipami do rozmów wideo w trybie Conversation. Zobacz [Galerie postaci i person](galleries.md).

### Zakładka Colors

Zakładka **Colors** decyduje o tym, jak persona prezentuje się w czacie. Kolory obejmują nazwę, wypowiedzi i dymek wiadomości.

- **Extract Colors from Avatar** dobiera kolory automatycznie na podstawie obrazu awatara. Do czasu wgrania awatara pozostaje wyszarzony z komunikatem "Upload an avatar first".
- **Name Display Color** ustawia kolor nazwy persony. Przyjmuje gradienty CSS.
- **Dialogue Highlight Color** ustawia kolor tekstu w cudzysłowach.
- **Message Box Color** ustawia kolor tła dymka wiadomości persony.

Zostaw dowolne z tych pól puste, aby użyć domyślnych kolorów motywu aplikacji. Szersze omówienie kolorów i statystyk zawiera przewodnik [Kolory postaci i statystyki RPG](colors-and-stats.md).

### Zakładka Stats

Zakładka **Stats** dzieli się na dwa osobne bloki. Oba zasilają ekranowy pasek statystyk (HUD) w trakcie czatu.

- **Enable Persona Stats** włącza paski stanu dla potrzeb takich jak głód, energia i nastrój. Przy pierwszym włączeniu dostajesz startowe paski Satiety, Energy, Hygiene i Mood, każdy z wartością 100 na 100. Wartościami tymi steruje w miarę rozwoju historii agent **Persona Stats**.
- **Enable RPG Attributes** włącza statystyki w stylu RPG: pule (Pools) i atrybuty (Attributes). Przy pierwszym włączeniu dostajesz startowe pule HP i MP z wartością 100 na 100 oraz startowe atrybuty STR, DEX, CON, INT, WIS i CHA, każdy z wartością 10. Te wartości są wysyłane razem z kartą persony na potrzeby walki (Combat) i trybu Game Mode oraz opcjonalnych rzutów w trybie Roleplay lub Game Mode. Agenci trackerów ich nie aktualizują.

Gdy jest zainstalowany zestaw zasad Game Mode lub persona nadal przechowuje jego arkusz, pod obiema sekcjami pojawia się **Ruleset sheets** (arkusze zestawów zasad). To konfiguracja początkowa persony dla każdego zestawu, kopiowana do nowej gry. Zobacz [Arkusze zestawów zasad](colors-and-stats.md#ruleset-sheets).

Ustawione tu wartości są domyślnymi wartościami startowymi dla nowych czatów. Paski stanu persony (Persona Status Bars) mogą aktualizować się automatycznie, gdy włączony jest agent Persona Stats; pule i atrybuty RPG persony nie są zarządzane przez agentów. Pełne wyjaśnienie zawiera przewodnik [Kolory postaci i statystyki RPG](colors-and-stats.md).

## Historia wersji

Za każdym razem, gdy zapisujesz zmianę w polach karty persony, Marinara automatycznie zapisuje migawkę. Panel **Version history** w zakładce **Metadata** wypisuje te zapisane wersje wraz ze znacznikiem czasu.

Z każdą zapisaną wersją da się zrobić to:

1. Kliknij jej tytuł, aby otworzyć widok porównania z bieżącą personą.
2. Kliknij **Rename this saved version** (ikona ołówka), aby poprawić etykietę wersji karty bez przywracania tej wersji.
3. Kliknij **Restore this version**, aby nadpisać bieżącą personę zapisaną wersją. Pojawia się okno z prośbą o potwierdzenie.
4. Kliknij **Delete this saved version**, aby usunąć ten wpis z historii. Bieżąca persona pozostaje bez zmian.

Przed pierwszą edycją panel wyświetla komunikat "Previous persona states will appear here after the next edit.".

Przycisk **Reset** w nagłówku panelu usuwa wszystkie zapisane migawki persony i ustawia bieżącą wersję karty na `0.0`. Marinara prosi o potwierdzenie, ponieważ usuniętej historii nie da się odzyskać.

## Duplikowanie persony

Kliknij **Duplicate** w wierszu persony albo ikonę **Duplicate persona** w nagłówku edytora **Persona Editor**. Powstaje pełna kopia persony o nazwie "{oryginalna nazwa} (Copy)". Kopiują się wszystkie pola karty, kolory, statystyki i pola zakładki Convo. Duplikowanie persony nie zmienia persony wybranej w żadnym czacie.

## Usuwanie person

Aby usunąć jedną personę, kliknij ikonę kosza w jej wierszu albo ikonę **Delete persona** w nagłówku edytora **Persona Editor**. Pojawia się okno potwierdzenia. Usunięcia persony nie da się cofnąć.

Aby usunąć wiele person naraz, kliknij **Select** w panelu **Personas** i zaznacz wybrane persony. Następnie użyj przycisku **Delete** na pasku zaznaczenia. Jeśli któreś usunięcie się nie powiedzie, nieusunięte pozycje pozostają zaznaczone, więc da się spróbować ponownie.

## Import i eksport person

### Import

Kliknij **Import** w panelu **Personas**, aby otworzyć okno **Import Persona**. Pliki da się przeciągnąć albo wskazać kliknięciem. Można importować wiele plików naraz. Okno przyjmuje dwa typy plików:

- Natywne pliki pakietu **.marinara**. Odtwarzają pełne szczegóły persony, sprite'y i strukturę galerii.
- Pliki **.json**. Eksport z aplikacji Marinara Engine w formacie JSON wczytuje się w całości. Zwykły plik JSON z innego narzędzia mapuje się pole po polu na nową personę. Nazwa jest wymagana. Pozostałe rozpoznane pola wczytują się wtedy, gdy występują.

Przy każdym pliku widać ikonę powodzenia albo niepowodzenia oraz komunikat. Linia podsumowania pokazuje, ile plików się udało, a ile nie.

### Eksport

Eksport uruchamiasz ikoną **Export persona** w edytorze **Persona Editor** albo zbiorczą akcją **Export** w trybie zaznaczania w panelu. Okno **Export Persona** oferuje dwa formaty:

- **Marinara Native**: zachowuje wszystkie szczegóły persony, sprite'y i przypisane lorebooki. Użyj tego formatu do przenoszenia persony między instalacjami aplikacji Marinara Engine.
- **Compatible JSON**: eksportuje wyłącznie podstawowe pola persony. Użyj tego formatu dla innych narzędzi, które nie znają formatu aplikacji Marinara Engine.

Eksport zbiorczy pobiera jeden plik zip z osobnym plikiem dla każdej zaznaczonej persony.

## Dodanie persony jako postaci

Nagłówek edytora **Persona Editor** zawiera ikonę **Add persona as character**. Tworzy ona nową kartę postaci w bibliotece postaci. Nowa karta przejmuje nazwę, opis, osobowość, scenariusz, historię, wygląd, tagi, autora, wersję i awatar persony.

Przydaje się to wtedy, gdy dawną personę chcesz odgrywać jako postać. Oryginalna persona nie znika ani się nie zmienia. O edycji postaci przeczytasz w przewodniku [Tworzenie i edycja postaci](creating-and-editing-characters.md).

## Powiązane przewodniki

- [Wybór persony w czacie](choosing-your-persona.md)
- [Kolory postaci i statystyki RPG](colors-and-stats.md)
- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](../conversation/profiles.md)
- [Makra](../prompts/macros.md)
