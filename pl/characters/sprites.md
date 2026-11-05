# Sprite'y postaci (wyrazy twarzy i całe sylwetki)

Sprite to obrazek postaci dla jednego nastroju, na przykład radości albo smutku. Marinara wyświetla go jako pływającą grafikę nad sceną czatu. Wgraj własne sprite'y, wygeneruj je przy pomocy AI, wyczyść ich tło i ustal, jak mają się pojawiać.

Zanim zaczniesz: nazwij każdy plik tak jak nastrój, na przykład `happy.png`, żeby Marinara mogła go wybrać. Na czacie w trybie Roleplay sprite'y wymagają też włączonego agenta **Expression Engine** (pomocnika, który wybiera sprite'a). Zobacz [Jak sprite'y pokazują się na czacie](#how-sprites-show-up-in-your-chat).

Są dwa rodzaje sprite'ów:

- **Facial Expressions** (wyrazy twarzy) to portrety dla nastrojów takich jak radość, smutek albo złość.
- **Full-body** (całe sylwetki) to obrazy całej postaci w pozach takich jak idle, walk albo battle stance.

Sprite'y widać na ekranie w trybie Roleplay Mode i Game Mode, ale nie w czatach w trybie Conversation. Wgrywać je można w każdym trybie, bo postać zachowuje swoje sprite'y w każdym czacie. Persona ma tę samą zakładkę **Sprites** (sprite'y).

## Gdzie znaleźć zakładkę Sprites

1. Otwórz postać (albo personę) w jej edytorze.
2. Kliknij zakładkę **Sprites**.
3. Na górze wybierz kategorię: **Facial Expressions**, **Full-body** albo **Clips**.

Poniższe sekcje opisują kategorie **Facial Expressions** i **Full-body**. Kategoria **Clips** (klipy) należy do funkcji rozmów. Zobacz [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md).

## Wgrywanie własnych sprite'ów

Można wgrać obrazy PNG, JPEG, GIF, WebP, AVIF i SVG. Najlepiej wyglądają pliki PNG z przezroczystością, bo puste miejsce wokół postaci pozostaje przezroczyste. Nieprawidłowy obraz podany jako zamiennik zostaje odrzucony, a zapisany sprite zostaje bez zmian.

### Wgrywanie jednego lub kilku sprite'ów

1. Otwórz zakładkę **Sprites** i wybierz **Facial Expressions** albo **Full-body**.
2. Kliknij **Add sprites** (dodawanie sprite'ów).
3. Kliknij **Upload images** (wgrywanie obrazów) i wybierz pliki. Można zaznaczyć kilka naraz.
4. Nazwa każdego pliku staje się nazwą sprite'a (jego etykietą). Żeby później zmienić nazwę, otwórz sprite'a.

Nowe sprite'y pojawiają się w siatce, poza folderami. W edytorze persony pojedynczy sprite wgrywa się przez pole nazwy w sekcji **Add Sprite** (dodawanie sprite'a) i przycisk **Upload** (wgranie).

### Wgrywanie całego folderu

1. Nazwij pliki graficzne tak jak wyraz twarzy albo pozę, na przykład `admiration.png` dla wyrazu twarzy o nazwie admiration.
2. Otwórz **Add sprites** i kliknij **Import folder** (import folderu). W edytorze persony kliknij **Upload Folder** (wgranie folderu) w sekcji **Add Sprite**.
3. Wskaż folder z obrazami.

Nazwa każdego pliku bez rozszerzenia staje się nazwą sprite'a. Wiersz postępu pokazuje "Uploading X/Y sprites". Podfoldery stają się opcjonalnymi folderami sprite'ów. Plik `catalog.json` z eksportu przywraca też foldery i zmienione etykiety. Nieprawidłowy wpis folderu zostaje zgłoszony, a nadające się obrazy i tak się importują.

Jeśli to nie zadziałało: nieudany lub częściowy import zgłasza błąd zamiast sukcesu z zerem obrazów. Sprawdź typy plików wymienione wyżej.

### Warianty nazw

| Nazwa pliku | Co oznacza |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Dwa obrazki happy. Obie nazwy zacznij od `happy_`. |
| `happy_pajamas.png` | Happy, w piżamie. Najpierw wpisz nastrój, potem strój. |
| `angry_formalwear_soaked_01.png` | Angry, strój wizytowy, przemoczenie. Liczba na końcu oznacza tylko kolejną wersję tego samego obrazka. |

Agent Expression Engine widzi zarówno wyraz twarzy (`happy`), jak i pełną nazwę (`happy_pajamas`). Jeśli żaden sprite nie pasuje do wszystkich słów, najpierw pomijane jest ostatnie słowo. Gdy więc brakuje sprite'a `happy_pajamas_wounded`, używany jest sprite `happy_pajamas`, a potem dowolny sprite happy.

<a id="how-sprites-show-up-in-your-chat"></a>

## Jak sprite'y pokazują się na czacie

O tym, kiedy i jak pojawiają się sprite'y, decydujesz w ustawieniach czatu, a nie w edytorze postaci.

### Roleplay Mode

W trybie Roleplay sprite'ami steruje agent Expression Engine. Agent to pomocnik, który działa równolegle z odpowiedziami. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md). Expression Engine odczytuje nastrój każdej wiadomości i dobiera pasujący sprite z wyrazem twarzy. Dodaj go do czatu, a jeśli go nie masz, zainstaluj go z sekcji **Agent Organizer** (organizowanie agentów). Zobacz [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md#expression-engine).

Żeby sprite'y się pojawiły, muszą być spełnione wszystkie poniższe warunki:

- Agent Expression Engine jest włączony dla czatu.
- Przynajmniej jedna postać albo persona jest wybrana jako właściciel sprite'ów.
- Przynajmniej jedno źródło sprite'ów jest włączone.

Otwórz **Chat Settings → Agents** (ustawienia czatu, agenci) i znajdź kafelek **Expression Engine**:

- **Sprite Source** (źródło sprite'ów): **Expressions**, **Full-body** albo oba. Domyślnie oba są włączone, a przynajmniej jedno musi zostać włączone.
- **Expression Avatars** (awatary z wyrazami twarzy) zastępuje mały awatar przy wiadomości pasującym sprite'em z wyrazem twarzy. Domyślnie jest wyłączone i działa tylko w trybie Roleplay.
- **Only show active sprites** (pokazywanie tylko aktywnych sprite'ów) pokazuje tylko postacie z ostatniego ukończonego wyniku i zostawia bieżące sprite'y widoczne, dopóki powstaje kolejny wynik.

### Game Mode

W trybie Game Mode sprite całej sylwetki pokazuje się automatycznie dla postaci, która mówi albo walczy. Agent Expression Engine nie jest potrzebny, wystarczą sprite'y całej sylwetki tej postaci. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md).

### Przesuwanie i zmiana rozmiaru sprite'ów

Kiedy właściciel sprite'ów jest już włączony, na kafelku **Expression Engine** pojawia się sekcja **Sprite Layout** (układ sprite'ów).

1. Kliknij **Arrange** (rozmieszczanie), a potem przeciągnij każdego sprite'a w wybrane miejsce.
2. Kliknij **Done** (gotowe).

**Reset** czyści twoje pozycje i przywraca układ automatyczny. **Default Side** (domyślna strona) to **Left** (lewa) albo **Right** (prawa), a na start ustawiona jest Left. Zmiana tego ustawienia odwraca bieżący układ. **Apply to** (zastosowanie do) pozwala ustawić układ dla wszystkich postaci albo dla jednej.

Rozmiar i stopień przezroczystości ustawiają cztery suwaki. **Expression Size** i **Full-body Size** działają w zakresie od 5% do 200%. **Expression Opacity** i **Full-body Opacity** działają w zakresie od 0% do 100%. Rozmiary i krycie startują na 100%.

## Generowanie sprite'ów przy pomocy AI

Zanim zaczniesz: dodaj połączenie do generowania obrazów. Do animowanych sprite'ów potrzebne jest też połączenie wideo. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Otwórz **Add sprites** i kliknij **Generate Sprite** (generowanie sprite'a). W edytorze persony ten przycisk jest w sekcji **Add Sprite**. Otwiera się okno **Generate Sprites**.
2. Na górze wybierz źródło: **Expressions (Portrait)** albo **Full-body**.
3. Wybierz połączenie w polu **Image Generation Connection** (połączenie do generowania obrazów).
4. Opcjonalnie dodaj maksymalnie cztery **Reference Images** (obrazy referencyjne) albo zaznacz pole wyboru, żeby użyć bieżącego awatara jako referencji.
5. Wpisz **Appearance Description** (opis wyglądu). To pole jest wymagane.
6. Opcjonalnie włącz **Transparent sprite background** (przezroczyste tło sprite'a). Marinara robi tło przezroczyste. Jeśli usługa tego nie potrafi, Marinara rysuje jednolite tło zielone, magentowe albo cyjanowe, które różni się od kolorów z pola **Appearance Description**, a potem je usuwa.
7. Ustaw **Expression Count** (liczba wyrazów twarzy) albo, przy całych sylwetkach, **Pose Count** (liczba póz) i wybierz, które wyrazy twarzy albo pozy mają powstać.
8. Kliknij **Generate** (generuj).

Gdy obrazy dotrą, każdy z nich możesz włączyć albo wyłączyć, zmienić mu nazwę i wykadrować. Potem zapisz zaznaczone obrazy w sprite'ach postaci. Jeśli dokładnie jeden zapisany sprite w tej kategorii ma wygenerowaną etykietę, zapis zastępuje jego obraz i zachowuje jego folder oraz uchwyt. Sprite, któremu zmieniono nazwę na inną niż ta etykieta, zostaje zachowany. Przy powtarzających się etykietach w różnych folderach zastąp właściwy sprite ręcznie.

W źródle **Full-body**, jeśli postać ma już portretowe wyrazy twarzy, zaznacz **Match existing expression sprites** (dopasowanie do istniejących sprite'ów z wyrazami twarzy), żeby powstały pozy całej sylwetki odpowiadające każdej nazwie wyrazu twarzy.

Generowanie może potrwać kilka minut, a w wolnych usługach dłużej. Poczekaj, zamiast zaczynać od nowa. Na niektórych urządzeniach, na przykład w części instalacji na systemie Android, generowanie sprite'ów przez AI i czyszczenie tła są niedostępne. Przycisk jest wtedy nieaktywny, a Marinara pokazuje powód.

### Animowane portrety

W źródle **Expressions (Portrait)** opcja **Generate animated portraits** (generowanie animowanych portretów) tworzy krótkie ruchome klipy i zamienia każdy z nich w zapętlonego sprite'a GIF. GIF to plik graficzny, który odtwarza krótką animację. Ta opcja korzysta z połączenia wideo zamiast z połączenia obrazowego. Zobacz [Animowane wyrazy twarzy](../media/animated-expressions.md).

## Czyszczenie tła sprite'ów

Sprite wygląda najlepiej, kiedy widać samą postać. Wygenerowane sprite'y korzystają z natywnej przezroczystości, o ile usługa ją obsługuje. W przeciwnym razie Marinara usuwa jednolity, dobrany kolor tła z miękką krawędzią i wypłukuje ten kolor z włosów, tkanin oraz innych częściowo przezroczystych pikseli. Starsze sprite'y z białym tłem nadal działają.

### Ręczne czyszczenie jednego sprite'a

Otwórz podgląd sprite'a postaci i użyj jego działania czyszczenia z ikoną różdżki albo kliknij obrazek sprite'a persony. Edytor czyszczenia pozwala wymazać tło, domalować fragmenty z powrotem i sprawdzić efekt na tle ciemnym, jasnym oraz w szachownicę. Zmiany da się cofać, przywrócić oryginał i na koniec zatwierdzić.

### Czyszczenie wielu sprite'ów naraz

1. W edytorze postaci kliknij **Select** (zaznaczanie) i wybierz sprite'y. W edytorze persony przycisk czyszczenia działa na zaznaczone sprite'y albo, gdy nic nie zaznaczono, na widoczną kategorię.
2. Kliknij **Clean Backgrounds** (czyszczenie teł).
3. Ustaw suwak **Cleanup strength** (siła czyszczenia) w zakresie od **Soft** (łagodnie) do **Aggressive** (agresywnie), od 0 do 100. Startuje na 35. Wyższa wartość usuwa więcej tła, ale może podgryźć samą postać.
4. Potwierdź.

Marinara zachowuje kopię bezpieczeństwa. Pojawia się wiersz "Last cleanup has a restore point" z przyciskiem **Undo Cleanup** (cofnięcie czyszczenia). Kliknij go, żeby przywrócić każdy zmieniony sprite.

Czyszczenie działa na obrazach PNG, JPG, JPEG, WEBP i AVIF. Nie działa na plikach GIF ani SVG.

Automatyczne czyszczenie najpierw bada obraz. Szybkie wbudowane czyszczenie radzi sobie z płaskim kolorem i dawnymi białymi tłami. Jeśli obramowanie nie jest jednolite, Marinara może sięgnąć po opcjonalny moduł AI do usuwania tła, o ile jest zainstalowany. Przy zatłoczonej scenie albo postaci w kolorach zbliżonych do tła najbezpieczniejszy jest ręczny edytor.

## Zarządzanie sprite'ami

Otwórz sprite'a postaci, żeby zobaczyć jego podgląd i dostępne działania. Sprite'y persony mają działania na samym kafelku.

- **Frame** (kadrowanie) przycina obraz tak, żeby postać stała tam, gdzie chcesz.
- **Download** (pobranie) zapisuje plik sprite'a.
- **Replace** (zamiana) wgrywa nowy obraz pod tą samą nazwą.
- **Rename** (zmiana nazwy; w podglądzie postaci) zmienia etykietę, do 160 znaków, i zachowuje uchwyt pliku oraz adres URL, więc istniejące odwołania do obrazu dalej działają.
- **Folder** (folder; w podglądzie postaci) albo **Move sprite** (przeniesienie sprite'a; na kafelku persony) wybiera folder albo **No folder** (bez folderu) bez przeciągania.
- **Delete** (usunięcie) usuwa ten sprite po potwierdzeniu. W edytorze persony **Delete All** (usunięcie wszystkich) z nazwą kategorii usuwa całą kategorię, nawet przy aktywnym wyszukiwaniu.

### Foldery i zaznaczanie

Kliknij **New folder** (nowy folder), żeby utworzyć zwinięty folder o nazwie **unnamed**. Dwukrotnie kliknij lub dotknij jego nazwy, żeby ją zmienić, a strzałką rozwiń folder. Wyrazy twarzy i sprite'y całej sylwetki mają osobne foldery. Foldery stoją nad sprite'ami luzem i można zmieniać ich kolejność przeciąganiem.

Przeciągaj sprite'y do folderu albo przeciągnij sprite'a z folderu na obszar luzem, żeby go z folderu zdjąć. Na telefonie przytrzymaj kafelek, żeby zacząć przeciąganie. Zwykłe przesunięcie palcem dalej przewija widok. Foldery tylko porządkują: nigdy nie wybierają aktywnego zestawu ani nie ukrywają obrazów przed czatami czy agentami. Usunięcie folderu zostawia jego sprite'y luzem.

Kliknij **Select**, żeby pokazać pola wyboru i **Select all sprites** (zaznaczenie wszystkich sprite'ów), a potem przeciągnij zaznaczone sprite'y razem albo użyj czyszczenia i usuwania. **Cancel** (anulowanie) kończy tryb zaznaczania. Wyszukiwanie filtruje widoczne sprite'y. Brak wyników wyszukiwania nie oznacza, że biblioteka jest pusta.

### Character Sheet

Wiersz **Character Sheet** w edytorze postaci otwiera się przyciskiem **Manage** (zarządzanie). Tam utworzysz albo wgrasz arkusz. Włącz **Use as reference image** (użycie jako obrazu referencyjnego), żeby arkusz był preferowany przy odwzorowaniu wyglądu postaci.

## Eksportowanie sprite'ów

1. Otwórz zakładkę **Sprites**.
2. Kliknij **Export** (eksport) nad siatką postaci albo w sekcji **Add Sprite** persony.
3. Wybierz **Expressions only** albo **Full-body only**, żeby wyeksportować bieżącą kategorię, albo **All sprites**, żeby wyeksportować wszystko.

Dostajesz plik zip z plikami sprite'ów i plikiem `catalog.json` z etykietami i folderami. Natywne eksporty postaci i person oraz kopie zapasowe profilu również zachowują te dane.

## Powiązane przewodniki

- [Tworzenie i edycja postaci](creating-and-editing-characters.md)
- [Persony](personas.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Game Mode: pierwsze kroki](../game/getting-started.md)
- [Rozmowy audio i wideo w trybie Conversation](../conversation/calls.md)
- [Animowane wyrazy twarzy](../media/animated-expressions.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)

## Informacje dla deweloperów: API sprite'ów i linki

`GET /api/sprites/:ownerId` zwraca wszystkie sprite'y, w folderach i luzem. `GET /api/sprites/:ownerId/catalog` dokłada foldery i przypisania dla narzędzi, które importują po jednym folderze. Każdy sprite ma stały uchwyt `expression`, edytowalny `label`, `folderId` i adres URL. Do przypisania używaj identyfikatorów folderów. Tablica `folders` to zapisana kolejność, którą edytor pokazuje odwrotnie, żeby nowe foldery były na górze. Kolejność folderów nie ustala priorytetu ani dostępności dla agentów.

Przeglądarka zasobów w czacie pokazuje zmienione etykiety, ale wstawia konkretne linki `card://sprites/<ownerId>/<filename>`, które działają także po zmianie nazwy. Linki w obrębie czatu, takie jak `card://sprites/facial/joy.png`, mogą też rozwiązać zmienioną etykietę. Istniejąca pasująca nazwa pliku ma pierwszeństwo.

Brakujące lub nieczytelne opcjonalne metadane nie ukrywają nadających się obrazów. Edycje odmawiają przy uszkodzonych metadanych, zamiast je zastępować. Listy tylko do odczytu pomijają niedostępne biblioteki, a ścieżki eksportu i zapisu odmawiają przy podlinkowanych folderach właściciela.
