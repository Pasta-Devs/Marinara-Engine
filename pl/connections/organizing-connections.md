# Porządkowanie połączeń

Z tego przewodnika dowiesz się, jak utrzymać porządek wśród zapisanych połączeń w aplikacji Marinara Engine. Opisuje foldery połączeń, wyszukiwanie i sortowanie, duplikowanie i usuwanie, pulę losową, panel **Quick Connection Switcher** (szybkie przełączanie połączeń) oraz eksport i import połączeń. Połączenie to zapisany zestaw ustawień, dzięki któremu Marinara wie, jak dotrzeć do jednej usługi AI.

Wszystko to robi się w panelu **Connections** (Połączenia). Po jego otwarciu zapisane połączenia pokazują się jako lista wierszy. W każdym wierszu widać nazwę połączenia, a pod nią dostawcę i model.

## Foldery połączeń

Grupuj powiązane ze sobą połączenia w folderach. Na przykład wszystkie modele lokalne trafiają do jednego folderu, a wszyscy płatni dostawcy do drugiego.

Aby utworzyć folder, wykonaj kolejno te kroki:

1. Kliknij przycisk **New Folder** (nowy folder) nad listą połączeń.
2. Pojawia się nowy folder o nazwie "unnamed".
3. Zmień jego nazwę od razu, żeby dało się go odróżnić (opis poniżej).

Aby zmienić nazwę folderu, kliknij dwukrotnie wiersz folderu, a na ekranie dotykowym dotknij go dwa razy. Inna opcja: zaznacz wiersz folderu i naciśnij klawisz **F2**. Wpisz nową nazwę i naciśnij Enter.

Aby wrzucić połączenie do folderu, przeciągnij wiersz połączenia i upuść go na folderze. Aby wyjąć połączenie z powrotem, przeciągnij je na obszar pod folderami. W trakcie przeciągania widać podpowiedź **Drop here to move out of folder**.

Na ekranie dotykowym naciśnij i przytrzymaj wiersz, żeby go podnieść, a potem go przeciągnij. Zwykłe przesunięcie palcem nadal przewija listę.

Aby zwinąć lub rozwinąć folder, kliknij jego wiersz raz. Mała liczba w wierszu folderu pokazuje, ile połączeń jest w środku.

Aby usunąć folder, kliknij ikonę kosza w jego wierszu. Jeśli w folderze wciąż są połączenia, Marinara prosi o potwierdzenie w oknie **Delete Folder** (usunięcie folderu). Pusty folder znika od razu, bez pytania o potwierdzenie. Usunięcie folderu nie usuwa połączeń, które są w środku. Te połączenia wracają do obszaru poza folderami.

## Wyszukiwanie i sortowanie

Pole **Search connections** filtruje listę w trakcie pisania. Dopasowanie obejmuje nazwę połączenia, dostawcę, model, bazowy adres URL, usługę obrazów lub wideo oraz model embeddingu. Gdy nic nie pasuje, widać komunikat "No connections match your search".

Lista rozwijana **Sort order** (kolejność sortowania) obok pola wyszukiwania zmienia kolejność listy. Ma pięć opcji:

| Opcja | Co robi |
|---|---|
| **Custom** | Twoja własna kolejność ustawiona przeciąganiem. |
| **A-Z** | Sortuje po nazwie, od A do Z. |
| **Z-A** | Sortuje po nazwie, od Z do A. |
| **Newest** | Najnowsze połączenia na górze. |
| **Oldest** | Najstarsze połączenia na górze. |

Aby ustawić własną kolejność, przeciągaj wiersze połączeń w górę lub w dół. Przeciągnięcie połączenia automatycznie przełącza sortowanie na **Custom**. Wiersz, który ma fokus, możesz też przesunąć skrótem Alt+strzałka w górę albo Alt+strzałka w dół.

## Duplikowanie i usuwanie

Najedź kursorem na wiersz połączenia, żeby zobaczyć jego przyciski akcji, a na ekranie dotykowym po prostu spójrz na wiersz.

Aby zduplikować połączenie, kliknij przycisk **Duplicate** (duplikowanie) z ikoną kopiowania. Powstaje pełna kopia razem z zapisanym kluczem API, czyli tajnym kodem, trochę jak hasło. Kopia otwiera się w edytorze, więc od razu da się zmienić jej nazwę. Nie ma kroku potwierdzenia.

Aby usunąć pojedyncze połączenie, kliknij jego przycisk **Delete** (usunięcie) z ikoną kosza. Marinara pokazuje okno **Delete Connection** z treścią Delete "your connection name"? This cannot be undone. Kliknij przycisk **Delete**, żeby potwierdzić.

Aby usunąć lub wyeksportować kilka połączeń naraz, kliknij przycisk **Select** (wybieranie) u góry panelu. Włącza się tryb zaznaczania. Dotknij połączeń, które mają zostać objęte operacją, a potem użyj przycisku **Export** lub **Delete** na pasku akcji na dole. Przy usuwaniu zbiorczym pojawia się najpierw okno **Delete Connections**.

<a id="the-random-pool-and-quick-connection-switcher"></a>

## Pula losowa i panel Quick Connection Switcher

Dzięki puli losowej czat przy każdej odpowiedzi wybiera inne połączenie. Przydaje się to wtedy, gdy zapytania mają się rozkładać na kilku dostawców lub kilka modeli.

Aby dodać połączenie do puli losowej, kliknij ikonę tasowania w jego wierszu. Podpowiedź brzmi **Add to random pool**. Gdy połączenie jest już w puli, podpowiedź zmienia się na **In random pool (click to remove)**. Ponowne kliknięcie ikony wyjmuje połączenie z puli.

Aby czat korzystał z puli losowej, otwórz **Chat Settings** (ustawienia czatu), znajdź sekcję **Connection** i wybierz z listy rozwijanej opcję **🎲 Random**. W trybie Game Mode ta lista rozwijana nosi nazwę **GM / Party Model**. Każda odpowiedź losuje wtedy połączenie z puli.

Jeśli połączenie wylosowane dla odpowiedzi zawiedzie, a dla **Main** ustawiono połączenie zapasowe (fallback), odpowiedź pisze połączenie zapasowe. Powiadomienie podaje połączenie, które zawiodło, jego model i krótki powód, na przykład "key rejected", "rate limited" albo "not found", dzięki czemu wiadomo, które połączenie z puli wymaga poprawy. Odpowiedź zachowuje małą etykietę **Fallback** (połączenie zapasowe); dotknij jej albo wskaż ją kursorem, żeby znów zobaczyć tę samą informację.

Panel **Quick Connection Switcher** to szybszy sposób na zmianę połączenia w otwartym czacie, a także jego modelu. Kliknij ikonę ogniwa w polu wpisywania wiadomości, żeby go otworzyć. Po lewej stronie widać połączenia, a po prawej kolumnę **Models** (modele) wybranego połączenia:

- Kliknij połączenie, żeby od razu użyć go w bieżącym czacie. Menu zostaje otwarte, więc zaraz potem da się wybrać jeden z modeli tego połączenia.
- Kliknij model, żeby go użyć. Model zapisuje się w tym połączeniu, połączenie zostaje wybrane dla czatu, jeśli nie było wybrane wcześniej, a menu się zamyka. Znacznik pokazuje model, którego połączenie używa w tej chwili. Tak jak w edytorze połączenia, wybranie modelu z listy aktualizuje też rozmiar kontekstu połączenia oraz jego limit odpowiedzi, jeśli dostawca je podaje.
- Wpisz tekst w polu **Search or enter model ID…**, żeby zawęzić listę. Naciśnięcie Enter wybiera model o wpisanym identyfikatorze lub nazwie albo jedyny model, który został na liście. Aby użyć modelu spoza listy, wpisz jego dokładny identyfikator: naciśnij Enter, gdy nic na liście do niego nie pasuje, albo kliknij wiersz **Use "…"**.
- Kliknij gwiazdkę obok modelu, żeby go przypiąć. Przypięte modele zostają na górze, w grupie **Pinned** (przypięte), także te wpisane ręcznie. Ponowne kliknięcie gwiazdki odpina model.
- Przy pierwszym otwarciu modeli połączenia Marinara wczytuje listę od dostawcy i zapisuje ją razem z połączeniem, więc przy kolejnych otwarciach lista pojawia się od razu. Kliknij przycisk odświeżania obok pola wyszukiwania, żeby wczytać listę ponownie, na przykład gdy dostawca doda nowe modele. Zmiana klucza API, bazowego adresu URL lub dostawcy połączenia także wczytuje świeżą listę.
- Jeśli dostawca nie udostępnia listy modeli albo jest nieosiągalny, menu o tym informuje, a identyfikator modelu nadal da się wpisać.
- Kliknij przycisk z kością u góry menu, żeby włączyć lub wyłączyć pulę losową dla tego czatu.
- Gdy pula losowa jest włączona, kliknięcie połączenia dodaje je do puli albo z niej usuwa. Znacznik pokazuje, które połączenia są w puli. Kolumna **Models** jest wtedy ukryta, bo pula nie ma jednego połączenia.

Na telefonie dotknij strzałki obok pola wiadomości i otwórz zakładkę **Connections**. Dotknij połączenia, żeby przełączyć na nie czat; menu się zamyka. Żeby wybrać model, dotknij zamiast tego strzałki na prawym końcu wiersza połączenia. Jego modele otwierają się w tym samym menu, a czat przełącza się dopiero po wybraniu jednego z nich. Strzałka wstecz wraca do listy połączeń.

**Zmiana modelu obowiązuje wszędzie, gdzie używane jest to połączenie.** Napis u dołu menu, "Model changes are saved to this connection.", oznacza, że agenci, funkcje pomocnicze i inne czaty korzystające z tego samego połączenia też przechodzą na nowy model. Pozostałe ustawienia modeli w połączeniu, takie jak model embeddingu czy połączenie do opisywania obrazów, się nie zmieniają. Jeśli inny model jest potrzebny tylko do jednego zadania, zduplikuj połączenie i zmień kopię.

## Eksport i import połączeń

Połączenia da się wyeksportować do pliku jako kopię zapasową albo po to, żeby przenieść je do innej instalacji, a później zaimportować.

**Eksport nigdy nie zawiera kluczy API.** Po zaimportowaniu połączeń trzeba otworzyć każde z nich i wpisać klucz API jeszcze raz. Przypięte modele trafiają do eksportu, ale zapisana lista modeli już nie, więc wczytuje się ponownie przy pierwszym otwarciu modeli połączenia.

Aby wyeksportować pojedyncze połączenie, otwórz je w edytorze i kliknij przycisk **Export** (eksport) z ikoną wgrywania. Aby wyeksportować kilka naraz, włącz w panelu tryb **Select** i kliknij przycisk **Export** na pasku akcji. Zanim pobieranie ruszy, Marinara pokazuje okno **Export Connection Data** z takim ostrzeżeniem: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Kliknij przycisk **Export**, żeby kontynuować.

Pojedyncze połączenie pobiera się jako plik `.connection.json`. Kilka połączeń pobiera się razem jako plik `marinara-connections.zip`.

Aby zaimportować połączenia, kliknij przycisk **Import** (import) u góry panelu Connections. Otwiera się okno **Import Connections**. Upuść na nie jeden plik `.json` lub kilka takich plików albo kliknij, żeby je wskazać. Okno przypomina: Imported connections never include API keys. Add each key again after import. Po imporcie każde nowe połączenie ma puste pole klucza API, dopóki nie zostanie ono uzupełnione.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
