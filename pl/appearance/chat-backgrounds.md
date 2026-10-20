# Tła czatu

Ten przewodnik opisuje bibliotekę teł w aplikacji Marinara Engine. Chodzi o obrazy, które wgrywasz samodzielnie i wybierasz ręcznie, żeby pojawiły się za czatem. Agent **Background**, który sam dobiera tło sceny w każdej turze, ma osobny opis: [Tła w trybie Roleplay](../roleplay/backgrounds.md). Tła scen generowane przez AI w galerii opisuje z kolei [Tła scen i galeria](../media/scene-backgrounds.md).

## Gdzie znaleźć tła

Wszystkimi tłami zarządzasz w jednym miejscu: **Settings** (Ustawienia), zakładka **Appearance** (Wygląd), sekcja **Backgrounds** (Tła).

Sekcja **Backgrounds** składa się z trzech części:

1. Selektor **Chat Background** (tło czatu), w którym wybierasz obraz dla otwartego czatu.
2. Suwak **Background Blur** (rozmycie tła).
3. Biblioteka teł, w której importujesz, porządkujesz, filtrujesz, tagujesz, zmieniasz nazwy, pobierasz i usuwasz obrazy.

Tło czatu widać wyłącznie w czatach w trybie Roleplay i Game Mode. Tryb Conversation używa zamiast tego gradientu, który ustawisz w sekcji **Conversation Theme** (motyw trybu Conversation). Opisują to [Ustawienia wyglądu](appearance-settings.md).

## Biblioteka teł

Biblioteka zawiera wszystkie obrazy, spośród których możesz wybierać. Łączy obrazy wgrane przez ciebie z wbudowanymi grafikami dołączonymi do aplikacji Marinara Engine. Każdy obraz ma małą etykietę, dzięki której łatwo je odróżnić:

- **Library**: obraz wgrany przez ciebie. Takie obrazy da się przemianować, otagować i usunąć.
- **Game asset**: obraz wbudowany, dołączony do aplikacji Marinara Engine. Takie obrazy są tylko do odczytu. Nie można zmienić ich nazwy, otagować ich ani ich usunąć.

### Import tła

1. Znajdź pole **Import Backgrounds** (import teł) na górze biblioteki.
2. Przeciągnij na nie jeden lub więcej plików graficznych albo kliknij je i wskaż pliki.
3. Zaczekaj na koniec wgrywania. W trakcie pole pokazuje napis **Importing...**.
4. Nowe obrazy pojawiają się w siatce poniżej z etykietą **Library**.

Możesz zaimportować kilka plików naraz. Każdy plik musi być obrazem w jednym z tych formatów: JPG, PNG, GIF, WebP lub AVIF. Pojedynczy plik może mieć do 20 MB.

Marinara sprawdza rzeczywistą zawartość każdego pliku, nie tylko jego nazwę. Plik, który nie jest obrazem, zostanie odrzucony nawet po zmianie nazwy na kończącą się na `.png`.

### Wybór tła dla bieżącego czatu

1. Otwórz **Settings**, potem **Appearance**, potem **Backgrounds**.
2. Kliknij w siatce miniaturę, która ci odpowiada.
3. Na wybranym obrazie pojawia się znacznik. Obraz staje się tłem otwartego czatu.
4. Aby wrócić do ustawienia domyślnego, kliknij wybraną miniaturę ponownie albo kliknij przycisk **Remove** (usunięcie) obok pozycji **Chat Background**.

### Przeszukiwanie biblioteki

Pole **Search backgrounds** nad biblioteką filtruje obrazy po nazwie, tagu i źródle. Linia z licznikiem pokazuje, ile obrazów pasuje, na przykład "3 of 20 backgrounds". Kliknij mały X w polu wyszukiwania, żeby je wyczyścić.

Selektor obok wyszukiwania sortuje tła: **A-Z**, **Z-A**, **Newest** lub **Oldest**. Wybierz **All**, żeby wyczyścić filtry tagów, albo rozwiń **Tags** i zaznacz jeden tag lub kilka. Przy kilku zaznaczonych tagach tło pasuje wtedy, gdy ma dowolny z nich.

### Porządkowanie teł w folderach

Foldery porządkują bibliotekę, ale nie przenoszą ani nie ukrywają samych plików graficznych.

1. Kliknij przycisk **New Folder** (nowy folder). Marinara tworzy folder o unikalnej nazwie.
2. Kliknij dwukrotnie nazwę folderu (na ekranie dotykowym stuknij dwukrotnie), żeby ją zmienić. Inna opcja: ustaw na niej fokus i naciśnij F2.
3. Na komputerze przeciągnij wiersz tła do folderu. Na telefonie i tablecie naciśnij i przytrzymaj wiersz, a potem go przeciągnij.
4. Przeciągnij tło z powrotem do obszaru poza folderami, żeby wyjąć je z folderu.

Foldery i przypisania zapisują się na serwerze i trafiają do kopii zapasowej. Usunięcie folderu przenosi jego tła z powrotem na listę poza folderami; same obrazy zostają. Filtry wyszukiwania i tagów same odsłaniają pasujące elementy ukryte w folderach.

Agent **Background** nadal widzi wszystkie dostępne tła, także te umieszczone w folderach. Foldery porządkują widok wyłącznie w ustawieniach.

### Zmiana nazwy tła

Nazwę można zmienić tylko obrazom z etykietą **Library**.

1. Najedź na wiersz obrazu i kliknij ikonę ołówka (**Rename**, zmiana nazwy).
2. Wpisz nową nazwę. Rozszerzenia pliku nie trzeba podawać.
3. Kliknij przycisk **Save**.

### Tagowanie tła

Tagi ułatwiają grupowanie i wyszukiwanie wgranych obrazów. Otagować można tylko obrazy z etykietą **Library**.

1. Kliknij ikonę tagu (**Edit tags**, edycja tagów) w wierszu obrazu.
2. Wpisz tag w polu **Add tag...**. W trakcie pisania Marinara podpowiada wcześniej używane tagi.
3. Naciśnij Enter albo kliknij przycisk **Add**.
4. Aby usunąć tag, kliknij go. Gdy edycja tagów jest otwarta, każdy tag wyświetla się jako przycisk ze znakiem X.

<a id="download-a-background"></a>

### Pobieranie tła

Pobrać można każde tło, także wbudowane. Najedź na wiersz obrazu i kliknij ikonę pobierania (**Download background**, Pobierz tło). Obraz zapisuje się pod swoją nazwą pliku. Na urządzeniu iPhone lub iPad otwiera się arkusz udostępniania, w którym możesz zapisać obraz; jeśli się nie otworzy, stuknij **Save file** (Zapisz plik) w wyświetlonym komunikacie.

### Usuwanie tła

Usunąć można tylko obrazy z etykietą **Library**. Najedź na wiersz obrazu, kliknij ikonę kosza i potwierdź usunięcie. Jeśli obraz był bieżącym tłem czatu albo domyślnym tłem trybu Roleplay, Marinara wraca za ciebie do tła wbudowanego.

## Ustawianie domyślnego tła trybu Roleplay

Domyślne tło trybu Roleplay to obraz, od którego zaczyna każdy nowy czat w trybie Roleplay, zanim wybierze własne. Wystarczy ustawić je raz, a korzystają z niego wszystkie nowe czaty w trybie Roleplay.

1. Znajdź w siatce w sekcji **Backgrounds** obraz, który ci odpowiada.
2. Kliknij ikonę pinezki (**Set as default for new Roleplay chats**, ustawienie jako domyślne dla nowych czatów w trybie Roleplay) w wierszu tego obrazu.
3. Przycisk z pinezką pozostaje podświetlony, a na miniaturze pojawia się etykieta **Default** (domyślne). Nowe czaty w trybie Roleplay startują od tego obrazu.

Gwiazdka w lewym górnym rogu obrazu dodaje go do ulubionych. Nie zmienia tła domyślnego.

Aby to cofnąć, kliknij pinezkę na bieżącym obrazie domyślnym. Inna opcja: kliknij przycisk **Reset Roleplay default** (przywrócenie domyślnego tła trybu Roleplay) u góry siatki. Ten przycisk pojawia się tylko wtedy, gdy tło domyślne różni się od wbudowanego.

## Background Blur

**Background Blur** rozmywa obraz tła za czatem, dzięki czemu tekst czyta się łatwiej. Działa na tła w trybie Roleplay i Game Mode.

1. Znajdź suwak **Background Blur** w sekcji **Backgrounds**.
2. Przesuń go w zakresie od 0 do 24. Im wyższa liczba, tym mocniejsze rozmycie.
3. Ustaw 0, żeby tła pozostały ostre. Przy 0 wartość wyświetla się jako **Off**.

Domyślnie jest to 0 (**Off**).

## Jak łączą się tła wgrane i wbudowane

Biblioteka pokazuje w jednej siatce zarówno obrazy wgrane przez ciebie, jak i wbudowane obrazy **Game asset**. Wybiera się z nich tak samo. Różnica polega na tym, że obrazy **Game asset** są tylko do odczytu, więc nie mają przycisków zmiany nazwy, tagowania ani usuwania.

Tła scen generowane przez AI w galerii trafiają do tej samej biblioteki, więc można ich użyć ponownie później. Zobacz [Tła scen i galeria](../media/scene-backgrounds.md).

## Gdzie zapisują się wybrane tła

O tym, jakie tło pokazuje czat, decydują trzy różne ustawienia, a każde zapisuje się inaczej:

- Tło **Chat Background** wybrane dla czatu zapisuje się razem z tym czatem na serwerze. Towarzyszy czatowi na każdym urządzeniu, na którym go otworzysz.
- Foldery teł i przypisania do nich zapisują się na serwerze i wędrują razem z biblioteką na inne urządzenia.
- Domyślne tło trybu Roleplay oraz **Background Blur** zapisują się osobno na każdym urządzeniu. Nie synchronizują się między przeglądarkami ani urządzeniami. Pełny model synchronizacji opisują [Ustawienia wyglądu](appearance-settings.md).

## Tła automatyczne i generowane przez AI

Ten przewodnik opisuje bibliotekę, z której wybierasz ręcznie. Tłami zajmują się też dwie pokrewne funkcje:

- Agent **Background** potrafi sam dobierać tło sceny z biblioteki, tura po turze, w czatach w trybie Roleplay. Zobacz [Tła w trybie Roleplay](../roleplay/backgrounds.md).
- Galeria potrafi wygenerować przy pomocy AI zupełnie nowe tło sceny na podstawie bieżącej sceny. Zobacz [Tła scen i galeria](../media/scene-backgrounds.md).

## Powiązane przewodniki

- [Tła w trybie Roleplay](../roleplay/backgrounds.md): agent Background, który sam dobiera tło w każdej turze.
- [Tła scen i galeria](../media/scene-backgrounds.md): tła scen generowane przez AI w galerii.
- [Ustawienia wyglądu](appearance-settings.md): cała zakładka Appearance, w tym informacja o tym, które ustawienia się synchronizują, a które zostają na jednym urządzeniu.
