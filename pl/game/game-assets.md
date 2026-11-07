# Zasoby gry: muzyka, dźwięki, sprite'y i tła

Zasoby gry to pliki multimedialne, które Game Mode odtwarza i pokazuje: muzyka, dźwięki, grafika postaci i tła scen. Ten przewodnik pokazuje, jak korzystać z zestawu startowego, wgrywać własne pliki w menedżerze **Asset Browser** (przeglądarka zasobów), ograniczać zasoby dostępne dla gry oraz generować efekty dźwiękowe i muzykę.

Game Mode czyta bibliotekę samodzielnie. Muzykę, dźwięki otoczenia i tła dobiera do sceny, więc w trakcie gry nie przypisujesz zasobów ręcznie.

| Kategoria | Co to jest |
| --- | --- |
| **Music** | Ścieżki muzyki w tle, zmieniające się razem ze sceną. |
| **Ambient** | Zapętlone dźwięki otoczenia, na przykład natura, miasto lub wnętrza. |
| **Sound Effects** (SFX) | Krótkie dźwięki do menu, walki i eksploracji. |
| **Sprites** | Grafika postaci i obiektów pokazywana na ekranie. |
| **Backgrounds** | Obrazy scen widoczne za historią. |

## Zestaw startowy

Marinara instaluje darmową bibliotekę startową przy pierwszym uruchomieniu serwera, a przy kolejnych uruchomieniach odświeża ją, jeśli wbudowany zestaw się zmienił. Zestaw zawiera:

- Pięć ścieżek **Music** dla różnych nastrojów sceny.
- Pętle **Ambient** w folderach `nature`, `urban` i `interior`.
- **Sound Effects** do menu, walki i eksploracji.

Foldery **Backgrounds** i **Sprites** w panelu Asset Browser są na starcie puste. Wbudowanych sprite'ów postaci nie ma, więc dodaj grafikę pasującą do własnych gier. Przy tłach Game Mode korzysta też z własnej biblioteki teł aplikacji. W nowej instalacji zawiera ona 13 startowych obrazów i zwykły `Black.jpg`, a gry mogą ich używać bez wgrywania czegokolwiek. Jeśli w tym folderze były już obrazy, przywracany jest tylko `Black.jpg`. Wygenerowana grafika scen i wgrane przez ciebie pliki są do nich dodawane.

Wszystkie wbudowane pliki audio mają licencję CC0 (domena publiczna, można ich używać bez ograniczeń). Informacje o autorach każdego pliku znajdują się w pliku `CREDITS.md`, który trafia na dysk razem z zasobami. Aplikacja go nie wyświetla.

Wbudowane pliki i foldery są chronione. Nie da się ich usunąć ani przenieść w panelu **Asset Browser**, ale można zmieniać ich nazwy i je kopiować.

## Otwieranie panelu Asset Browser

**Asset Browser** to menedżer plików dla zasobów gry. Otwórz go z panelu **Settings** (Ustawienia):

1. Otwórz **Settings**.
2. Przejdź do zakładki **Imports**.
3. Znajdź sekcję **Game Assets** i kliknij **Asset Browser**.

Albo otwórz go z gry:

1. Otwórz czat w trybie Game Mode.
2. Kliknij lub dotknij przycisk **Game Assets** (ikona folderu) blisko prawego górnego rogu czatu. Na komputerze i telefonie możesz przeciągnąć go w inne miejsce.

Przycisk pojawia się tylko w czatach w trybie Game Mode. Otwiera **Game Assets** z panelem **Asset Browser** w środku: jako ruchome okno na komputerze albo panel na całą szerokość ekranu na telefonie. Jeśli okno zostało przeniesione przyciskiem **Put back in Chat Settings**, otwórz zamiast niego sekcję **Game Assets** w Chat Settings.

Pasek narzędzi pokazuje ścieżkę nawigacji zaczynającą się od **Game Assets**, przełącznik **Grid view** i **List view**, przyciski **Upload**, **New**, **Rescan** i **Open in system folder** oraz pole **Search in folder**. Na szerszych ekranach drzewo folderów po lewej stronie pozwala przeskakiwać między kategoriami.

## Wgrywanie własnych zasobów

Marinara sprawdza każdy wgrywany plik według zasad z części [Typy i rozmiary plików](#file-types-and-sizes). Wybierz jeden z dwóch sposobów.

### Wgrywanie z panelu Asset Browser

1. Otwórz panel **Asset Browser**.
2. Otwórz jeden z pięciu folderów kategorii albo podfolder w jego środku.
3. Kliknij **Upload** i wskaż pliki albo przeciągnij je na obszar plików.

Musisz być wewnątrz folderu kategorii. Jeśli upuścisz pliki na najwyższym poziomie, aplikacja poprosi o otwarcie folderu kategorii.

### Wgrywanie z panelu Settings

1. Otwórz **Settings** i przejdź do zakładki **Imports**.
2. W sekcji **Game Assets** wybierz kategorię z listy **Type**: **Music**, **Ambient**, **Sound Effects**, **Sprites** albo **Backgrounds**.
3. Ustaw miejsce docelowe w polu **Folder** albo zostaw wartość domyślną.
4. Kliknij **Choose Files** i zaznacz pliki.
5. Kliknij **Upload to Server**.

Jeśli to nie zadziałało: komunikat błędu wymienia dopuszczalne typy plików dla tej kategorii. Przy muzyce sprawdź ścieżkę folderu (zobacz [Zasada folderów muzycznych](#the-music-folder-rule)).

Domyślne wartości pola **Folder**:

| Typ | Folder domyślny |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### Typy i rozmiary plików

| Kategoria | Dopuszczalne typy plików |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Pliki audio i obrazy mogą mieć do 50 MB każdy. Pliki tekstowe mogą mieć do 10 MB.

<a id="the-music-folder-rule"></a>

### Zasada folderów muzycznych

Każda ścieżka muzyczna musi leżeć w trzypoziomowej ścieżce `state/genre/intensity`, na przykład `exploration/fantasy/calm`. Jeśli ścieżka nie pasuje, wgrywanie kończy się błędem. Dzięki temu układowi Game Mode wie, kiedy odtworzyć każdą ścieżkę.

- Stan: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Gatunek: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom` albo rodzina stylistyczna settingu (zobacz niżej), na przykład `wuxia`.
- Intensywność: `calm`, `tense`, `intense`.

Foldery dźwięków otoczenia, efektów dźwiękowych, sprite'ów i teł nie mają takiej zasady. Ich podfoldery możesz nazywać dowolnie.

## Porządkowanie zasobów

Kliknij plik lub folder prawym przyciskiem myszy na komputerze albo użyj jego menu "...", żeby zobaczyć dostępne działania.

| Działanie na pliku | Co robi |
| --- | --- |
| **Rename** | Nie powiedzie się, jeśli taka nazwa jest już zajęta w tym folderze. |
| **Move**, **Copy** | Wysyła plik do innego folderu przez okno wyboru folderu. |
| **Delete**, **Download** | Usuwa plik albo zapisuje go na twoim urządzeniu. |

| Działanie na folderze | Co robi |
| --- | --- |
| **Create subfolder** | Tworzy w nim nowy folder. |
| **Open in system folder** | Pokazuje go w menedżerze plików komputera. |
| **Delete folder** | Jeśli są w nim pliki, najpierw zaznacz **Delete everything inside**. |

Przycisk **New** na pasku narzędzi tworzy w bieżącym folderze **New folder**, **New text file** albo **New markdown file**. Żeby zadziałać na wielu plikach, zaznacz ich pola wyboru. Pasek pokazuje, ile plików zaznaczono, oraz przyciski **Select all**, **Move**, **Copy** i **Delete**. Duże foldery wczytują się w częściach, z przyciskiem **Load more**.

Do każdego folderu można dopisać krótką notatkę. Kliknij tekst opisu albo podpowiedź **Add description...**, żeby ją napisać. Pięć folderów kategorii ma stałe opisy.

### Ponowne skanowanie po zmianach spoza aplikacji

Marinara trzyma wewnętrzną listę zasobów, żeby Game Mode szybko je odnajdywał. Przy wgrywaniu przez aplikację lista aktualizuje się sama. Jeśli skopiujesz pliki do folderu zasobów gry na komputerze poza aplikacją, kliknij **Rescan**, żeby ponownie odczytać folder. **Rescan** jest na pasku narzędzi panelu **Asset Browser** i w sekcji **Game Assets** w panelu **Settings**.

### Otwieranie folderu na komputerze

**Open in system folder** działa tylko wtedy, gdy korzystasz z aplikacji na tym samym komputerze, na którym działa serwer. Na telefonie, tablecie lub innym komputerze aplikacja informuje, że foldery systemowe można otworzyć wyłącznie z urządzenia, na którym działa aplikacja Marinara.

## Wybór zasobów dostępnych dla gry

Czat w trybie Game Mode może korzystać tylko z części folderów zasobów, na przykład po to, żeby wesoła muzyka nie trafiła do gry grozy.

1. W trakcie konfiguracji rozwiń sekcję **Adjust Game Assets for this Game** (dopasowanie zasobów do tej gry) w kroku **Features** (funkcje). W istniejącej grze otwórz okno **Game Assets** tej gry.
2. Kliknij **Game assets**. Napis zmieni się na **Selecting**.
3. Użyj małej kontrolki stanu przy każdym folderze, żeby go włączyć albo wykluczyć.

Pasek pokazuje "All folders included" albo liczbę wykluczonych folderów. **Reset to all** znów włącza wszystkie. Wybór zapisuje się tylko dla tego czatu. Zmienia foldery, z których Game Mode może wybierać, ale nie usuwa ani nie ukrywa żadnego pliku.

<a id="a-settings-own-art-and-music"></a>

### Własna grafika i muzyka settingu

Gra rozpoczęta z zestawem settingu ma rodzinę stylistyczną, widoczną w sekcji **Art and music** (grafika i muzyka), gdy zmieniasz słownictwo zestawu: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` albo jedną z własnych rodzin zestawu. Gra korzysta z folderów nazwanych tak jak jej rodzina i z każdego folderu, którego nazwa nie jest nazwą żadnej rodziny, a foldery innych rodzin pomija. Gra cyberpunkowa nigdy nie zagra muzyki do bitew fantasy ani nie pokaże zaczarowanego lasu. Gdy nic z jej rodziny ani ze wspólnych folderów nie pasuje, nic nie gra – gra nie sięga po ścieżkę innej rodziny. Gra bez zestawu settingu korzysta ze wszystkich folderów.

- **Music**: ścieżki settingu umieść w `music/<state>/<family>/<intensity>`, na przykład `combat/wuxia/intense`. Mają pierwszeństwo przed wspólnymi ścieżkami.
- **Backgrounds**: `backgrounds/<family>`. Tła wygenerowane w grze z zestawem settingu też trafiają do tego folderu.
- **Dźwięki walki**: dźwięk w `sfx/combat/<family>` o tej samej nazwie co wbudowany, na przykład `sword-swing`, zastępuje go w grach tej rodziny. Wbudowane dźwięki walki są w stylu fantasy, więc walki innych rodzin są ciche, dopóki nie dodasz dla nich własnych.

Wbudowane tła startowe liczą się jako wspólne, z wyjątkiem teł fantasy (`ancient_library`, `castle_cliff`, `enchanted_forest`) i współczesnego `city_night`. Zestaw settingu zapisany, zanim pojawiły się rodziny stylistyczne, nadal działa: zestaw utworzony na podstawie zestawu startowego korzysta z rodziny tamtego zestawu, a każdy inny korzysta ze wszystkich folderów, dopóki nie wybierzesz rodziny w sekcji **Art and music**. Opisany wyżej pasek wyboru podaje rodzinę otwartej gry.

<a id="generated-sound-effects-and-music"></a>

## Generowane efekty dźwiękowe i muzyka

Game Mode potrafi generować efekty dźwiękowe i muzykę przez konto **Music & Sound Effects** (muzyka i efekty dźwiękowe). Wybierz ElevenLabs, SunoAPI albo własny zgodny serwer. Każdy nowy dźwięk lub utwór korzysta z konta w tej usłudze. Wbudowane pliki audio są dostępne bez generowania.

**Zanim zaczniesz:** potrzebujesz konta **Music & Sound Effects**. Okno **Add account** (dodanie konta) nie ma dla niego kafelka. Takie konta powstają przy aktualizacji albo przez import: **Import a backup** (import kopii zapasowej) w panelu **Connections** (Połączenia). Zobacz [konfigurację dostawców i limity](../connections/providers-reference.md#music--sound-effects).

1. W panelu **Connections** otwórz model konta przyciskiem **Edit model** (edycja modelu).
2. Wybierz usługę, wpisz jej klucz i wybierz modele muzyki oraz efektów dźwiękowych. Muzyka SunoAPI wymaga też publicznego adresu zwrotnego HTTPS. Własny serwer potrzebuje ścieżek endpointów.
3. Włącz **Sound-effect generation** (generowanie efektów dźwiękowych), **Music generation** (generowanie muzyki) albo oba przełączniki.
4. Zapisz konto. Zobacz [konfigurację dostawców i limity](../connections/providers-reference.md#music--sound-effects).

Potem włącz generowanie przy tworzeniu gry:

1. W kroku **Features** kreatora konfiguracji znajdź kartę **Game Audio** (dźwięk w grze).
2. Przy wyborze konta wybierz swoje konto albo zostaw **Use the default Music & Sound Effects account** (użycie domyślnego konta muzyki i efektów dźwiękowych).
3. Zostaw włączone **Sound effects** (efekty dźwiękowe) i **Music** (muzyka) albo wyłącz to, czego nie chcesz.

Każdy przełącznik wymaga włączenia odpowiedniej funkcji w wybranym koncie. Konto Audio obsługujące wyłącznie mowę nie jest używane do generowania.

W trakcie gry:

- **Sound effects.** Po turach GM Marinara prosi usługę o krótkie dźwięki pasujące do sceny.
- **Music.** Marinara komponuje jeden instrumentalny utwór, trwający około dwóch minut, dla każdego miejsca odwiedzanego przez drużynę i dla każdego rodzaju walki, na przykład walki z bossem. Każdy utwór powstaje raz i jest używany ponownie. Utwór nowego miejsca zaczyna grać przy późniejszej zmianie sceny, więc muzyka nie wcina się w środek sceny. Utwór walki płynnie się pojawia, gdy tylko jest gotowy.

Wygenerowane dźwięki i utwory zapisują się razem z zasobami gry, więc ten sam dźwięk nie powstaje dwa razy. Jeśli muzykę w grze odtwarza agent **Music DJ**, Game Mode nie generuje muzyki.

## Własny folder muzyki dla agenta Music DJ

**Music DJ** to pomocniczy agent, który potrafi odtwarzać muzykę w trakcie gry. W trybie Custom odtwarza ścieżki z wybranego folderu. Po włączeniu agenta **Music DJ** dla czatu ustawienia Music DJ w tym czacie pokazują **Apply to** (zastosowanie do). Ten wybór zapisuje folder dla tego czatu, dla jedynej postaci w czacie albo dla wszystkich czatów. **In use:** (w użyciu) pokazuje folder, z którego czat odtwarza muzykę. Przy **All chats (default)** (wszystkie czaty, domyślnie) źródło **Game Assets** przyjmuje ścieżkę wewnątrz zasobów gry, na przykład `music` albo `music/combat`. Żeby dać czatowi albo postaci własny folder, zobacz [Osobny folder dla czatu lub postaci](../media/music.md#use-a-different-folder-for-a-chat-or-character).

Pełny edytor agenta **Music DJ** ma sekcję **Custom Music Library**. Przełącznik **Use Game Assets music folder** wybiera jeden z dwóch trybów:

- Włączony: pole **Game Assets music folder** wskazuje folder wewnątrz zasobów gry. **Open Folder** otwiera go na komputerze z serwerem.
- Wyłączony: **Default music folder on this device** (domyślny folder muzyki na tym urządzeniu) odtwarza muzykę z dowolnego folderu na komputerze, na którym działa serwer. Kliknij **Select Folder** albo wklej ścieżkę.

Wybór folderu spoza aplikacji wymaga podwyższonych uprawnień. Na tym samym komputerze co serwer działa bez dodatkowej konfiguracji. Z innego urządzenia lub przez zdalny dostęp najpierw skonfiguruj dostęp administracyjny. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md). Resztę informacji o odtwarzaczu muzyki znajdziesz w przewodniku [Music DJ](../media/music.md).

## Powiązane przewodniki

- [Music DJ: Spotify, YouTube i muzyka lokalna](../media/music.md)
- [Obsługiwani dostawcy AI](../connections/providers-reference.md)
- [Game Mode: pierwsze kroki](getting-started.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
