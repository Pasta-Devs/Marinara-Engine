# Gry stołowe w trybie Conversation

Zagraj w UNO, szachy, pokera, bilard 8-Ball Pool, kółko i krzyżyk oraz papier-kamień-nożyce z postaciami z czatu Conversation. Aplikacja rozdaje karty lub ustawia planszę, pilnuje każdej reguły i sprawia, że każda zasiadająca postać opisuje swoje ruchy w swojej roli. Podczas gry nad polem wiadomości pojawia się plansza na żywo.

Każda gra to opcjonalny pakiet. Zainstaluj te, które chcesz mieć, w **Agents → Agent Organizer** (organizator agentów) i uruchom aplikację Marinara Engine ponownie, jeśli katalog o to poprosi. Gra, której nie zainstalowano, nie ma komendy slash, nie pojawia się w wyborze gier, a jej przełącznik **Commands** pozostaje ukryty.

Reguły dla każdej gry:

- Gry stołowe działają tylko w trybie Conversation. W czacie Roleplay zobaczysz komunikat, że w gry można grać tylko w czatach Conversation.
- W jednym czacie może być aktywna jedna gra. Rozpoczęcie nowej zastępuje bieżącą, nawet jeśli zakończona gra nadal pokazuje baner końcowy.
- Czat potrzebuje co najmniej jednej postaci, a co najmniej jedną musisz posadzić jako bota. Ruchy botów używają tego samego modelu co zwykłe odpowiedzi czatu. Nie jest potrzebne żadne dodatkowe konto ani klucz API.

## Rozpocznij grę

Zanim zaczniesz: zainstaluj grę i otwórz czat Conversation z co najmniej jedną postacią.

1. Wpisz komendę slash gry (krótką instrukcję zaczynającą się od `/`) w polu wiadomości i naciśnij <kbd>Enter</kbd>. Otwiera się okno konfiguracji gry.
2. Wybierz opcje (zobacz każdą grę niżej).
3. Kliknij **Deal** (rozdaj) albo **Start game** (rozpocznij grę).

Jeśli to nie zadziałało: komenda nie istnieje albo nic nie robi, gdy gra nie jest zainstalowana lub nie jesteś w czacie Conversation.

| Gra | Komenda | Gracze |
| --- | --- | --- |
| UNO | `/uno` | Ty plus od 1 do 9 postaci |
| Chess | `/chess` | Ty i jedna postać |
| Poker | `/poker` | Ty plus od 1 do 7 postaci |
| 8-Ball Pool | `/8ball` lub `/pool` | Ty i jedna postać |
| Tic-Tac-Toe | `/tictactoe` lub `/ttt` | Ty i jedna postać |
| Rock-Paper-Scissors | `/rps` | Ty i jedna postać |

Inne sposoby rozpoczęcia gry:

- Wpisz `/games`, aby wybrać z zainstalowanych gier.
- Powiedz to w zwykłej wiadomości, na przykład "let's play uno", "start a game of chess" albo "deal me into poker". Okno konfiguracji się otwiera, a twoja wiadomość nadal się wysyła, więc postać może zareagować na zaproszenie. Dzieje się tak tylko wtedy, gdy ta gra nie jest jeszcze uruchomiona.
- Postać może sama zaproponować lub przyjąć grę. Jej odpowiedź od razu rozpoczyna grę z domyślnymi regułami i bez okna konfiguracji. Jeśli jest zajęta albo odmawia, mówi o tym w swojej roli.
- Postać może to zrobić tylko wtedy, gdy przełącznik **Commands** tej gry jest włączony (zobacz [Pozwól postaciom rozpoczynać gry samodzielnie](#let-characters-start-games-on-their-own)).

## UNO

Okno konfiguracji ma tytuł **Start UNO**.

- **Players**: zaznacz każdą postać, która gra jako bot. Domyślnie wszystkie są zaznaczone. Opcja **You go first** jest domyślnie zaznaczona.
- **Starting hand**: liczba kart na gracza, od 1 do 10. Domyślnie **7**.
- **Penalize missed UNO**: domyślnie zaznaczone. Gracz przyłapany bez zgłoszenia UNO dobiera 2 karty, a przycisk **Catch!** jest aktywny.
- **House rules**, domyślnie wszystkie wyłączone:
  - **Stacking**: dokładaj +2/+4 na następnego gracza zamiast dobierać.
  - **Draw to match**: dobieraj dalej, aż dobierzesz kartę, którą można zagrać.
  - **7-0 rule**: siódemka zamienia ręce z wybranym graczem, a zero obraca wszystkie ręce.
  - **Jump-in**: zagraj identyczną kartę poza kolejnością.
  - **Force play**: jeśli dobrana karta da się zagrać, musisz ją zagrać.

Przycisk **Deal** pozostaje nieaktywny, dopóki nie wybierzesz co najmniej jednego przeciwnika. Pokazuje liczbę graczy, na przykład **Deal (3p)** dla ciebie i dwóch postaci.

Na planszy: karty, które można zagrać, unoszą się, a reszta jest przyciemniona. Kliknij kartę, aby ją zagrać. Karta Wild otwiera okno "Pick a color:". Przy włączonej opcji **7-0 rule** siódemka otwiera okno "Swap hands with:". Przyciski pojawiają się w miarę potrzeby: **Draw**, **Pass**, **Call UNO!** i **Catch!**. Zagranie przedostatniej karty zgłasza UNO za ciebie. Baner pokazuje "{winner} wins!" albo "Game over".

## Szachy

Okno konfiguracji ma tytuł **Start Chess**. Wybierz jednego przeciwnika w polu **Opponent** (domyślnie pierwsza postać). W czacie grupowym pozostałe postacie nadal rozmawiają. Opcja **Your color** to **White**, **Random** (domyślnie) albo **Black**. Kliknij **Start game**.

Kliknij jedną ze swoich figur, aby ją wybrać. Dozwolone ruchy pokazują się jako kropka, a bicia jako pierścień. Gra czarnymi odwraca planszę. Pion na ostatniej linii otwiera okno "Promote to:" (Queen, Rook, Bishop, Knight). Baner ogłasza mata, remis z powodem albo "Game over", a pasek pod planszą wypisuje ostatnie ruchy.

## Poker

Okno konfiguracji ma tytuł **Start Poker**. Przy stole mieści się od 2 do 8 graczy. Przy siedmiu pozostałe miejsca są wyszarzone.

- **Players**: zaznacz postacie do posadzenia przy stole.
- **Dealer**: **House dealer (silent)** (domyślnie) rozdaje bez komentarza. Możesz też wybrać postać, która ogłasza rozdania i pokazy kart.
- **Starting stack**: żetony na gracza, od 100 do 1 000 000. Domyślnie **1000**.
- **Small blind**: duży blind jest dwa razy większy. Domyślnie **10**.
- **Blinds double every**: liczba rozdań między podwyżkami blindów. Domyślnie **0**, czyli nigdy.
- **Hand limit**: sesja kończy się po tylu rozdaniach, a wygrywa ten, kto ma najwięcej żetonów. Domyślnie **0**, czyli gra trwa, dopóki jeden gracz ma żetony.

W twojej kolejce pasek pokazuje **Fold**, **Check**, **Call** i **All in**. Gdy możesz zalicytować lub podbić, pole stawki dodaje przyciski **Min**, **½ pot**, **Pot** i **All-in**. Po każdym rozdaniu panel **Showdown** przyznaje pulę, a przycisk **Next hand** rozdaje znowu. Na końcu baner podaje zwycięzcę i wypisuje końcowy stan każdego gracza.

## 8-Ball Pool

Okno konfiguracji ma tytuł **Start 8-Ball Pool**.

- **Opponent**: postać, przeciwko której grasz.
- **Announcer**: domyślnie **Silent (no announcer)** albo postać, która komentuje uderzenia.
- **Match length**: **Race to 1**, **Race to 3** albo **Race to 5** rack (rack to jedna pełna gra).
- **Who breaks first**: **You**, **Random** albo **Them**. Kolejne racki przełączają rozbicie na przemian.

Kliknij **Start game**. W twojej kolejce wybierz jedno z proponowanych uderzeń, a bile potoczą się według symulacji fizyki. Linia pod stołem opisuje ostatnie uderzenie.

## Tic-Tac-Toe i Rock-Paper-Scissors

W grze **Tic-Tac-Toe** wybierz przeciwnika i to, czy grasz **X**, **O**, czy losowym znakiem. X rusza pierwszy. W swojej kolejce kliknij puste pole. Niedozwolone ruchy są blokowane, a wygrane i remisy są wykrywane.

W grze **Rock-Paper-Scissors** wybierz przeciwnika i mecz do dwóch wygranych z trzech, pięciu lub siedmiu partii. W każdej rundzie wybierz **Rock**, **Paper** albo **Scissors**. Wybory pozostają ukryte, dopóki obie strony ich nie złożą, a potem aktualizują się wynik i licznik.

## Zakończ grę wcześniej

Każda plansza ma przycisk X.

- **UNO**: **End game**. Najpierw pyta "End this UNO game?".
- **Chess**: **Resign**. Najpierw pyta "Resign and end this game?".
- **Poker**: **End game**. Najpierw pyta "End this poker game?". Po zakończeniu sesji przycisk nazywa się **Close**.
- **8-Ball Pool**: **End game**. Najpierw pyta "End this pool game?". Po zakończeniu meczu przycisk nazywa się **Close**.
- **Tic-Tac-Toe** i **Rock-Paper-Scissors**: użyj przycisku zamknięcia lub zakończenia planszy, aby wyczyścić mecz.

Przedwczesne zakończenie gry usuwa jej stan i nie zapisuje zwycięzcy.

<a id="let-characters-start-games-on-their-own"></a>

## Pozwól postaciom rozpoczynać gry samodzielnie

Otwórz **Chat Settings → Agents → Commands** albo użyj kroku **Automation** przy tworzeniu czatu. Główny przełącznik **Commands** steruje wszystkimi działaniami uruchamianymi przez postacie, w tym grami stołowymi, selfie i rozmowami. Gdy jest wyłączony, postacie nie rozpoczynają niczego samodzielnie.

Każda zainstalowana gra ma własny przełącznik, który jest włączony, chyba że go wyłączysz: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** i **Rock-Paper-Scissors**. Zobacz [Wybierz, których komend może używać postać](getting-started.md#choose-which-commands-a-character-can-use). Te przełączniki kontrolują tylko to, co robią postacie. Komenda slash gry i fraza "let's play" działają nawet wtedy, gdy przełącznik jest wyłączony.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Lista komend slash](../chats/slash-commands.md)
