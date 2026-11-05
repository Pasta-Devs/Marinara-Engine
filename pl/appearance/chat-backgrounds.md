# Tła czatu

Biblioteka teł zawiera obrazy, które wgrywasz i ręcznie wybierasz, żeby pojawiły się za czatem. Agenta **Background**, który sam dobiera tło w każdej turze, opisuje przewodnik [Tła w trybie Roleplay](../roleplay/backgrounds.md). Tła generowane przez AI w galerii opisuje [Tła scen i galeria](../media/scene-backgrounds.md).

Tło czatu widać we wszystkich trybach czatu. W czatach w trybie Conversation gradient z sekcji **Conversation Theme** (motyw trybu Conversation) zostaje nad obrazem, a **Conversation background image opacity** (nieprzezroczystość obrazu tła w trybie Conversation) ustawia, jak mocno widać obraz. Zobacz [Ustawienia wyglądu](appearance-settings.md).

## Zmiana tła czatu

Zanim zaczniesz: otwórz czat, który chcesz zmienić. Wybrane tło dotyczy tego czatu.

1. Otwórz **Settings** (Ustawienia), potem **Appearance** (wygląd), a potem przycisk **App** (aplikacja).
2. W sekcji **Backgrounds** (tła) dotknij **Browse library** (przeglądanie biblioteki).
3. Dotknij obrazu. Staje się tłem tego czatu, a okno się zamyka.

Żeby użyć własnego obrazu, najpierw go zaimportuj (zobacz [Import tła](#import-a-background)).

## Gdzie znaleźć tła

1. Otwórz **Settings**.
2. Wybierz zakładkę **Appearance**, a potem przycisk **App**.
3. Znajdź sekcję **Backgrounds**.

Sekcja zawiera selektor **Chat Background** (tło czatu), suwak **Background Blur** (rozmycie tła) oraz kontrolki **Conversation background image opacity** i **Chat List Backgrounds** (tła na liście czatów) (zobacz [Ustawienia wyglądu](appearance-settings.md)).

Selektor pokazuje podgląd bieżącego tła albo napis **Default background** (tło domyślne), gdy żadnego nie wybrano. Pod nim masz na jedno dotknięcie do trzech ostatnio używanych teł **Recent** (ostatnie). Kliknij **Browse library**, żeby otworzyć okno **Background Library** (biblioteka teł).

## Biblioteka teł

Biblioteka łączy obrazy wgrane przez ciebie z grafikami dołączonymi do aplikacji Marinara Engine. Każdy obraz ma etykietę.

| Etykieta | Znaczenie |
| --- | --- |
| **My upload** (mój plik) | Obraz wgrany przez ciebie. Można zmienić jego nazwę, otagować go i usunąć. |
| **Game asset** (zasób gry) | Grafika wbudowana. Jest tylko do odczytu: nie da się zmienić jej nazwy, otagować jej ani usunąć. |

Przyciski **Filter by source** (filtrowanie według źródła), czyli **All sources** (wszystkie źródła), **My uploads** (moje pliki) i **Game assets** (zasoby gry), pokazują, ile obrazów zawiera każda grupa.

<a id="import-a-background"></a>

### Import tła

1. W oknie **Background Library** znajdź **Import Backgrounds** (import teł) obok pola wyszukiwania.
2. Dotknij go albo kliknij i wskaż pliki graficzne. Możesz wybrać kilka naraz. Na komputerze możesz też upuścić na nie pliki.
3. Zaczekaj. W trakcie pracy widać napis **Importing…**.

Nowe obrazy pojawiają się w siatce z etykietą **My upload**.

Każdy plik musi być w formacie JPG, PNG, GIF, WebP lub AVIF i mieć do 20 MB. Marinara sprawdza zawartość pliku, a nie jego nazwę. Plik, który nie jest obrazem, zostanie odrzucony nawet po zmianie nazwy na `.png`.

### Wybór tła dla bieżącego czatu

1. Otwórz **Browse library**.
2. Kliknij miniaturę. Pojawia się znacznik wyboru, obraz staje się tłem tego czatu, a okno się zamyka.
3. Żeby wrócić do ustawienia domyślnego, kliknij wybraną miniaturę ponownie albo kliknij X (**Clear selection**, wyczyszczenie zaznaczenia) na podglądzie.

### Wyszukiwanie i filtrowanie

- Pole **Search backgrounds** (wyszukiwanie teł) filtruje po nazwie, tagu lub źródle. Linia z licznikiem pokazuje, ile obrazów pasuje, na przykład "3 of 20 backgrounds". Kliknij X w polu, żeby je wyczyścić.
- **Sort backgrounds** (sortowanie teł) oferuje **Manual order** (kolejność ręczna), **A-Z**, **Z-A**, **Newest** i **Oldest**. Przy opcji **Manual order** przeciągnij obrazy, żeby zmienić kolejność, albo naciśnij <kbd>Alt</kbd>+<kbd>Up</kbd> lub <kbd>Alt</kbd>+<kbd>Down</kbd> na zaznaczonym obrazie.
- Kafelki folderów **All folders** (wszystkie foldery), **Favorites** (ulubione) i **Unfiled** (poza folderami) oraz po jednym kafelku na każdy folder filtrują według folderów.
- W tagach **All** czyści filtry tagów. Rozwiń **Tags** i wybierz jeden tag lub kilka. Obraz pasuje, jeśli ma dowolny z wybranych tagów.

Kliknij gwiazdkę na obrazie, żeby dodać go do ulubionych. Nie zmienia to tła domyślnego.

### Porządkowanie teł w folderach

Foldery porządkują bibliotekę, ale nie przenoszą ani nie ukrywają plików graficznych.

1. Kliknij **New Folder** (nowy folder), wpisz nazwę i kliknij **Add** (dodaj).
2. Dotknij przycisku **Move to folder** (przeniesienie do folderu) na obrazie i wybierz folder. Możesz też przeciągnąć obraz na kafelek folderu. Na telefonie lub tablecie naciśnij i przytrzymaj obraz, a potem go przeciągnij.
3. Żeby wyjąć obraz z folderu, przeciągnij go na **Unfiled**.
4. Wybierz kafelek folderu, żeby zobaczyć przyciski z ołówkiem (**Rename folder**, zmiana nazwy folderu) i koszem (**Delete folder**, usunięcie folderu).

Usunięcie folderu przenosi jego obrazy z powrotem do **Unfiled** i ich nie usuwa. Foldery zapisują się na serwerze i trafiają do kopii zapasowych. Agent **Background** nadal widzi każde tło, także te w folderach.

### Zmiana nazwy tła

Nazwę można zmienić tylko obrazom z etykietą **My upload**.

1. Kliknij ołówek (**Rename background**, zmiana nazwy tła) na obrazie.
2. Wpisz nową nazwę. Rozszerzenia pliku nie trzeba podawać.
3. Kliknij **Save**.

### Tagowanie tła

Otagować można tylko obrazy z etykietą **My upload**.

1. Kliknij ikonę tagu (**Edit tags**, edycja tagów) na obrazie.
2. Wpisz tag w polu **Add tag…**. Marinara podpowiada wcześniej używane tagi.
3. Naciśnij <kbd>Enter</kbd> albo kliknij **Add**.

Żeby usunąć tag, kliknij go podczas edycji tagów.

<a id="download-a-background"></a>

### Pobieranie tła

Kliknij ikonę pobierania (**Download background**, Pobierz tło) na dowolnym obrazie, także wbudowanym. Na urządzeniu iPhone lub iPad otwiera się arkusz udostępniania. Jeśli się nie otworzy, stuknij **Save file** (Zapisz plik) w wyświetlonym komunikacie.

### Usuwanie tła

Usunąć można tylko obrazy z etykietą **My upload**.

1. Kliknij ikonę kosza (**Delete background**, usunięcie tła) na obrazie.
2. Potwierdź.

Jeśli był to obraz bieżącego tła czatu albo domyślne tło trybu Roleplay, Marinara wraca do tła wbudowanego.

## Ustawianie domyślnego tła trybu Roleplay

Domyślne tło trybu Roleplay to obraz, od którego zaczyna każdy nowy czat w trybie Roleplay.

1. Znajdź obraz w oknie **Background Library**.
2. Kliknij jego ikonę pinezki (**Set as default for new Roleplay chats**, ustawienie jako domyślne dla nowych czatów w trybie Roleplay).

Na miniaturze pojawia się etykieta **Default** (domyślne). Żeby to cofnąć, kliknij pinezkę na tym obrazie ponownie albo kliknij **Reset Roleplay default** (przywrócenie domyślnego tła trybu Roleplay) nad siatką. Ten przycisk pojawia się tylko wtedy, gdy tło domyślne różni się od wbudowanego.

## Background Blur

**Background Blur** rozmywa tło za czatem, dzięki czemu tekst czyta się łatwiej. Działa na tła we wszystkich trybach czatu.

1. Znajdź suwak **Background Blur** w sekcji **Backgrounds**.
2. Przesuń go w zakresie od 0 do 24. Im wyższa wartość, tym mocniejsze rozmycie.

Przy 0 wartość wyświetla się jako **Off**, a tła pozostają ostre. Domyślnie jest to 0.

## Gdzie zapisują się wybrane tła

| Ustawienie | Gdzie się zapisuje |
| --- | --- |
| Tło **Chat Background** wybrane dla czatu | Razem z tym czatem na serwerze. Towarzyszy czatowi na każdym urządzeniu. |
| Foldery i przypisania do nich | Na serwerze, razem z biblioteką. |
| Domyślne tło trybu Roleplay i **Background Blur** | Osobno na każdym urządzeniu. Nie synchronizują się między przeglądarkami ani urządzeniami. |

Pełny model synchronizacji opisują [Ustawienia wyglądu](appearance-settings.md).

## Powiązane przewodniki

- [Tła w trybie Roleplay](../roleplay/backgrounds.md): agent Background, który dobiera tło w każdej turze.
- [Tła scen i galeria](../media/scene-backgrounds.md): tła scen generowane przez AI w galerii. One też trafiają do tej biblioteki.
- [Ustawienia wyglądu](appearance-settings.md): cała zakładka Appearance.
