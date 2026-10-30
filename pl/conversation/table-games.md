# Gry stołowe w trybie Conversation

Ten przewodnik opisuje sześć opcjonalnych pakietów z grami stołowymi, w które można zagrać z postaciami z czatu w trybie Conversation: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** i **Rock-Paper-Scissors**. Wyjaśnia, jak rozpocząć grę i co oznacza każda opcja konfiguracji. Pokazuje też, jak grać na każdej planszy i jak pozwolić postaciom zaczynać gry z własnej inicjatywy.

## Czym są gry stołowe

Gry stołowe to niewielkie gry, które działają bezpośrednio w czacie w trybie Conversation. Marinara Engine rozdaje karty albo ustawia planszę i pilnuje wszystkich zasad za ciebie. Każda posadzona przy stole postać opisuje swoje ruchy zgodnie ze swoim charakterem. Na czas gry nad polem wiadomości pojawia się aktywna plansza.

Każdą grę, na którą masz ochotę, zainstaluj z sekcji **Agents → Agent Organizer (organizowanie agentów)**. Jest dostępna od razu, bez ponownego uruchamiania aplikacji Marinara Engine. Niezainstalowana gra nie pojawia się na liście gier, jej komenda slash nie działa, a ustawienie komendy postaci pozostaje ukryte.

Dwie rzeczy warto zapamiętać:

- Gry stołowe działają wyłącznie w trybie Conversation. Nie da się ich uruchomić w czacie w trybie Roleplay ani Game Mode. Po wpisaniu komendy gry w czacie w trybie Roleplay pojawia się komunikat w rodzaju "UNO can only be played in conversation chats."
- W jednym czacie może być aktywna tylko jedna gra naraz. Rozpoczęcie nowej gry zastępuje tę, która już trwa w tym czacie – nawet zakończoną, która wciąż pokazuje planszę końcową.

W czacie musi być też co najmniej jedna postać. Zanim rozdasz karty albo zaczniesz grę, posadź przy stole przynajmniej jedną z nich jako gracza sterowanego przez AI. Ruchy takiego gracza i jego kwestie korzystają z tego samego połączenia co zwykłe odpowiedzi w czacie. Dodatkowe konto ani klucz API nie są potrzebne. **Klucz API** to tajny kod, trochę jak hasło, dzięki któremu Marinara Engine rozmawia z dostawcą AI.

## Rozpoczynanie gry

Grę da się rozpocząć na trzy sposoby. Każdy z nich działa tylko w czacie w trybie Conversation, w którym jest co najmniej jedna postać.

### Wpisanie komendy slash

**Komenda slash** to krótkie polecenie wpisywane w polu wiadomości, zaczynające się od ukośnika. Wpisz jedną z poniższych i naciśnij Enter, żeby otworzyć okno konfiguracji danej gry:

- **/uno** rozpoczyna grę w UNO z postaciami z tego czatu.
- **/chess** rozpoczyna partię szachów jeden na jednego z postacią z tego czatu.
- **/poker** rozpoczyna grę w pokera Texas Hold'em z postaciami z tego czatu.
- **/8ball** (albo **/pool**) rozpoczyna partię bilarda ósemkę jeden na jednego z postacią z tego czatu.
- **/tictactoe** (albo **/ttt**) rozpoczyna partię kółka i krzyżyka jeden na jednego z postacią z tego czatu.
- **/rps** rozpoczyna pojedynek w papier-kamień-nożyce jeden na jednego z postacią z tego czatu.

### Powiedzenie o tym na czacie

Wystarczy też zwykła wiadomość. Zdanie w rodzaju "let's play uno", "start a game of chess" czy "deal me into poker" samo otwiera okno konfiguracji danej gry. Wiadomość i tak wysyła się normalnie, więc postać może zareagować na zaproszenie w tej samej odpowiedzi. Dzieje się tak tylko wtedy, gdy dana gra nie jest jeszcze uruchomiona w czacie.

### Zaproszenie od postaci

Postać może sama zaproponować grę albo przyjąć twoją propozycję. Jeśli ma ochotę zagrać od razu, jej odpowiedź natychmiast rozpoczyna grę z domyślnymi zasadami czatu. Okno konfiguracji się nie pojawia. Jeśli postać jest zajęta albo nie chce grać, po prostu mówi o tym w swoim stylu.

Żeby to zadziałało, ustawienie **Commands** (komendy) w czacie musi być włączone, a przełącznik samej gry również. Zobacz punkt "Zezwolenie postaciom na samodzielne rozpoczynanie gier" poniżej.

## UNO

### Konfiguracja gry UNO

Okno konfiguracji nosi tytuł **Start UNO**.

W sekcji **Players** (gracze) zaznacz każdą postać, która ma grać jako gracz sterowany przez AI. Domyślnie zaznaczone są wszystkie postacie z czatu. Pole wyboru **You go first** jest domyślnie zaznaczone i daje ci pierwszą turę. Jeśli w czacie nie ma żadnej postaci, w sekcji widnieje napis "Add at least one character to this chat to play."

Sekcja **House rules** (zasady domowe) zbiera reguły opcjonalne. Wszystkie są domyślnie wyłączone. Włącz te, na które masz ochotę:

| Zasada | Co robi |
|---|---|
| **Stacking** | Dokłada +2/+4 następnemu graczowi, zamiast dobierać karty. |
| **Draw to match** | Dobierasz karty, dopóki nie trafisz na taką, którą da się zagrać. |
| **7-0 rule** | 7 zamienia ręce z wybranym graczem, 0 obraca ręce wszystkich. |
| **Jump-in** | Pozwala zagrać identyczną kartę poza swoją turą. |
| **Force play** | Dobraną kartę trzeba zagrać, jeśli da się ją zagrać. |

Pod zasadami znajduje się pole **Starting hand**, które decyduje o liczbie kart na start dla każdego gracza. Domyślnie jest to **7**, a wybrać da się dowolną wartość od 1 do 10. Pole wyboru **Penalize missed UNO** jest domyślnie zaznaczone. Kiedy jest włączone, gracz przyłapany na niezgłoszeniu UNO dobiera 2 karty, a mechanika "Catch!" jest aktywna. Kiedy jest wyłączone, nie ma żadnej kary.

Kliknij przycisk **Cancel**, żeby zamknąć okno, albo przycisk **Deal**, żeby zacząć. Przycisk Deal pokazuje łączną liczbę miejsc przy stole, na przykład **Deal (3p)** dla ciebie i dwóch graczy sterowanych przez AI. Pozostaje nieaktywny, dopóki nie zaznaczysz przynajmniej jednej postaci. Przy stole UNO mieści się od 2 do 10 graczy.

### Gra na planszy UNO

Plansza pojawia się nad polem wiadomości i nosi tytuł **UNO**. Pokazuje aktywny kolor oraz strzałkę kierunku, która odwraca się po karcie Reverse. Widać na niej też liczbę kart w stosie dobierania jako "Draw pile: N", a przy spiętrzonej karze dobrania dodatkowo plakietkę "+N". W linii tury widnieje napis "Your turn" w twojej turze albo imię postaci w pozostałych.

Miejsca przy stole są wypisane w kolejności gry. Twoje miejsce jest oznaczone jako "(you)", miejsce gracza, który zaraz wykona ruch, jako "next", a każde miejsce z jedną kartą pokazuje "UNO?". Jeśli przeciwnik zejdzie do jednej karty i nie zgłosi UNO, przycisk **Catch!** pozwala go na tym przyłapać. Pojawia się tylko przy włączonej zasadzie **Penalize missed UNO**.

Twoja ręka wyświetla się jako klikalne karty. Karty możliwe do zagrania unoszą się i są podświetlone, reszta przygasa. Kliknięcie karty wild otwiera wybór koloru z napisem "Pick a color:". Przy włączonej zasadzie **7-0 rule** kliknięcie siódemki otwiera wybór gracza z napisem "Swap hands with:". W razie potrzeby pojawiają się dodatkowe przyciski, takie jak **Draw**, **Pass** oraz podświetlony **Call UNO!**, kiedy trzeba zgłosić UNO. Zagranie przedostatniej karty zgłasza UNO za ciebie w tym samym momencie, więc gracz sterowany przez AI nie zdąży cię przyłapać.

Po zakończeniu gry plansza końcowa pokazuje "{winner} wins!" albo "Game over", jeśli nie ma jednoznacznego zwycięzcy.

## Chess

### Konfiguracja gry Chess

Okno konfiguracji nosi tytuł **Start Chess**. Szachy są zawsze jeden na jednego, więc grają dokładnie dwa miejsca przy stole.

W sekcji **Opponent** (przeciwnik) wybierz jedną postać przyciskami opcji. Domyślnie zaznaczona jest pierwsza postać. Nawet w czacie grupowym przy stole siada tylko jeden przeciwnik. Pozostałe postacie rozmawiają normalnie.

W sekcji **Your color** (twój kolor) wybierz **White**, **Random** albo **Black**. Domyślnie jest to **Random**. Widnieje tam uwaga "White moves first."

Kliknij przycisk **Cancel**, żeby zamknąć okno, albo przycisk **Start game**, żeby zacząć.

### Gra na planszy Chess

Plansza nosi tytuł **Chess** i składa się z siatki 8x8 z odręcznie rysowanymi figurami. Kafelek każdej ze stron pokazuje zbite figury przeciwnika i przewagę materialną jako "+N". W linii tury widnieje napis "Your turn" w twojej turze albo imię postaci w jej turze. Przy szachu dochodzi do tego ostrzeżenie.

Kliknij własną figurę, żeby ją zaznaczyć. Dozwolone ruchy pokazują się jako kropka na pustych polach i obwódka przy biciu. Ostatni ruch oraz szach są podświetlone, a krawędzie planszy mają oznaczenia rzędów i kolumn. Przy grze czarnymi plansza obraca się tak, że twoja strona jest na dole. Pionek, który dojdzie do ostatniego rzędu, otwiera wybór z napisem "Promote to:" i figurami Queen, Rook, Bishop oraz Knight.

Po zakończeniu gry plansza końcowa ogłasza zwycięstwo przez mata, remis wraz z jego powodem (na przykład pat albo zasada pięćdziesięciu posunięć) albo napis "Game over". Krótki pasek historii pod planszą wypisuje ostatnie ruchy w notacji szachowej.

## Poker

### Konfiguracja gry Poker

Okno konfiguracji nosi tytuł **Start Poker**. Przy stole mieści się od 2 do 8 graczy, czyli ty i maksymalnie siedem postaci.

W sekcji **Players** zaznacz postacie, które mają usiąść przy stole. Po zaznaczeniu siedmiu reszta staje się nieaktywna. Widnieje tam uwaga "8 seats max (you + up to 7 characters)."

Sekcja **Dealer** (rozdający) to lista rozwijana. Domyślnie stoi na **House dealer (silent)**, czyli rozdaje bez komentarza. Zamiast tego można wybrać dowolną postać, która zapowiada układy, flopy i rozstrzygnięcia własnym głosem. Karty w obu przypadkach rozdają się uczciwie, a rozdający nie musi grać przy stole.

Sekcja **Stakes** (stawki) ma cztery pola liczbowe:

| Ustawienie | Domyślnie | Uwagi |
|---|---|---|
| **Starting stack** | **1000** | Żetony, z którymi startuje każdy gracz (od 100 do 1 000 000). |
| **Small blind** | **10** | Duża ciemna zawsze wynosi dwa razy tyle. |
| **Blinds double every** | **0** | Liczba rozdań między podwyżkami ciemnych. 0 oznacza nigdy. |
| **Hand limit** | **0** | 0 oznacza grę, aż żetony zostaną tylko jednemu graczowi. |

Po ustawieniu wartości w polu **Hand limit** sesja kończy się po tylu rozdaniach, a wygrywa gracz z największą liczbą żetonów.

Kliknij przycisk **Cancel**, żeby zamknąć okno, albo przycisk **Deal**, żeby zacząć. Przycisk Deal pokazuje liczbę miejsc przy stole, na przykład **Deal (4p)**.

### Gra na planszy Poker

Nagłówek planszy pokazuje bieżące rozdanie, etap licytacji i ciemne, a obok łączną pulę. W linii tury widnieje napis "Your turn" albo imię postaci, na którą przypada kolej. Nad miejscami graczy znajduje się pięć slotów na karty wspólne.

Każde miejsce pokazuje imię gracza, napis "(you)" przy twoim, plakietkę "D" oznaczającą rozdającego oraz "SB" lub "BB" przy ciemnych. Widać tam też liczbę żetonów i status, na przykład bieżący zakład, "folded", "all in" albo "busted". Twoje dwie karty własne wyświetlają się większe pod napisem "Your hand". Kiedy masz już jakiś układ, pojawia się jego opis zwykłym językiem, na przykład "Full house, kings over nines".

W twojej turze pasek akcji daje przyciski **Fold**, **Check**, **Call** oraz podświetlony **All in**. Kiedy możesz postawić zakład albo przebić, pojawia się pole zakładu z szybkimi przyciskami **Min**, **½ pot**, **Pot** i **All-in** oraz przyciskiem zatwierdzenia.

Na koniec każdego rozdania panel **Showdown** odsłania układy i przyznaje pulę. Przycisk **Next hand** rozdaje kolejną rundę. Po zakończeniu całej sesji plansza końcowa podaje zwycięzcę i wypisuje końcową liczbę żetonów na każdym miejscu.

## 8-Ball Pool

### Konfiguracja gry 8-Ball Pool

Okno konfiguracji nosi tytuł **Start 8-Ball Pool**. Bilard jest jeden na jednego, więc grasz przeciwko jednej postaci.

- **Opponent**: wybierz postać, z którą grasz.
- **Announcer** (komentator): opcjonalny. Domyślnie stoi na **Silent (no announcer)**. Wybierz postać, która będzie komentować zagrania własnym głosem.
- **Match length** (długość meczu): **Race to 1**, **Race to 3** albo **Race to 5**. Tyle partii trzeba wygrać, żeby wygrać cały mecz. Partia to jedno pełne rozdanie bilarda.
- **Who breaks first** (kto rozbija pierwszy): **You**, **Random** albo **Them**. Widnieje tam uwaga "Later racks alternate the break."

Kliknij przycisk **Start game**, żeby zacząć. Podczas ustawiania bil na przycisku widnieje napis "Racking up...".

### Gra na planszy 8-Ball Pool

Plansza pokazuje stół bilardowy z góry, z rzeczywistą pozycją każdej bili. W twojej turze w linii tury widnieje napis "Your turn". W turze postaci pokazuje się jej imię z dopiskiem "is thinking...". Zagrywasz, wybierając jedno z podpowiadanych zagrań, a bile toczą się po stole zgodnie z symulacją fizyczną. Linia pod stołem opisuje ostatnie zagranie albo pokazuje "Rack over." między partiami.

## Tic-Tac-Toe

Tic-Tac-Toe to gra jeden na jednego. W konfiguracji wybierasz przeciwnika oraz to, czy grasz znakiem **X**, **O**, czy losowym. Pierwszy ruch należy do X. W swojej turze kliknij puste pole. Marinara Engine blokuje niedozwolone ruchy, prosi postać o ruch zgodny z jej charakterem i sama wykrywa wygrane oraz remisy.

## Rock-Paper-Scissors

Rock-Paper-Scissors to gra jeden na jednego. W konfiguracji wybierasz przeciwnika oraz mecz do dwóch, trzech albo czterech wygranych. W każdej rundzie wybierz **Rock**, **Paper** albo **Scissors**. Wybór przeciwnika pozostaje ukryty, dopóki obie strony nie zdecydują, a potem Marinara Engine pokazuje wynik i aktualizuje stan meczu.

## Kończenie gry

Każda plansza ma przycisk z ikoną X, który kończy grę przed czasem.

- Na planszy UNO nosi nazwę **End game** i najpierw pyta "End this game?".
- Na planszy Chess nosi nazwę **Resign** i najpierw pyta "Resign and end this game?".
- Na planszy Poker w trakcie rozdania nosi nazwę **End game** i najpierw pyta "End this poker game?". Po zakończeniu całej sesji zmienia się w **Close** i nie wymaga potwierdzenia.
- Na planszy 8-Ball Pool nosi nazwę **End game** i najpierw pyta "End this pool game?". Po zakończeniu meczu zmienia się w **Close** i nie wymaga potwierdzenia.
- Na planszach Tic-Tac-Toe i Rock-Paper-Scissors bieżący mecz czyści przycisk zamknięcia lub zakończenia gry.

Zakończenie gry kasuje jej stan. Przy takim wcześniejszym zakończeniu żaden zwycięzca nie zostaje zapisany.

## Zezwolenie postaciom na samodzielne rozpoczynanie gier

O tym, czy postać może zaproponować grę albo przyjąć propozycję, decydujesz w **Chat Settings → Agents**, w grupie ustawień **Commands**. Te same opcje da się ustawić w kreatorze nowego czatu, w kroku **Automation**.

Główny przełącznik **Commands** jest domyślnie włączony. Steruje wszystkimi komendami uruchamianymi przez postacie, w tym grami stołowymi, selfie, wspomnieniami i rozmowami. Po wyłączeniu postacie nie zaczynają niczego z własnej inicjatywy.

W grupie Commands każda zainstalowana gra ma własny przełącznik, a wszystkie sześć jest domyślnie włączonych:

- **UNO**: "Let characters start a game of UNO at the table when you agree to play."
- **Chess**: "Let characters accept a one-on-one chess challenge at the table."
- **Poker**: "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool**: "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe**: "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors**: "Let characters accept a one-on-one rock-paper-scissors match at the table."

Te przełączniki sterują wyłącznie grami zaczynanymi przez postacie. Komenda slash zainstalowanej gry i zaproszenie wpisane na czacie działają nawet przy wyłączonym przełączniku danej gry.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Lista komend slash](../chats/slash-commands.md)
