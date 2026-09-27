# Lista komend slash

Ten przewodnik zbiera komendy slash, które można wpisać w czacie aplikacji Marinara Engine. Komenda slash to skrót wpisywany w polu wiadomości, zaczynający się od ukośnika, dzięki któremu coś dzieje się od razu. Część komend działa wyłącznie na ekranie, a część prosi AI o napisanie tekstu.

## Jak działają komendy slash

Komendę slash uruchamia się tak: wpisz ją w polu wiadomości na dole czatu i naciśnij przycisk **Send** (wyślij). Klawisz Enter też ją wysyła, o ile dla danego trybu czatu włączona jest opcja **Send on Enter** (wysyłanie Enterem) w sekcji **Settings** (Ustawienia). Domyślnie Enter wysyła wiadomość w czatach Conversation, a w czatach Roleplay przechodzi do nowej linii. Pole wiadomości samo przypomina o komendach slash. W czacie Roleplay tekst zastępczy brzmi **Write your response, / for commands**. W czacie Conversation widać tam imię postaci, na przykład "Message @Alice, / for commands". Jeśli w czacie jest więcej niż jedna postać, pojawia się nazwa czatu.

Zaraz po wpisaniu ukośnika nad polem wyskakuje małe menu z pasującymi komendami. Każdy wiersz pokazuje format komendy wraz z argumentami i krótki opis. Kliknij lub dotknij wiersz, żeby wstawić komendę do pola, dopisz resztę tekstu i wyślij.

Zastąp etykiety w nawiasach kwadratowych, takie jak `[name]` lub `[range]`, własnymi wartościami; nie wpisuj samych nawiasów. Argumenty oznaczone `(optional)` można pominąć. Znak `|` rozdziela alternatywy: wartości, takie jak `prompt|reset`, albo całe formaty komend.

Wiele komend ma krótsze odpowiedniki. Można na przykład wpisać `/continue` albo alias `/cont` – efekt jest ten sam. Pełną listę wyświetlisz w aplikacji w każdej chwili tą komendą:

```
/help
```

Część komend działa w przeglądarce i zmienia czat natychmiast, zupełnie za darmo. Inne proszą AI o wygenerowanie tekstu, więc korzystają z podłączonego dostawcy i mogą zużywać tokeny. Token to jednostka, którą większość dostawców AI mierzy i rozlicza tekst. W tabelach poniżej opisane jest działanie każdej komendy.

Komendy slash działają w polach wiadomości trybów **Conversation** i **Roleplay**. W trybie **Game** jako komenda slash działa tylko `/illustrate`. Cała reszta zaczynająca się od ukośnika idzie jako zwykły tekst.

Kilka komend odwołuje się do numerów wiadomości. Marinara liczy wiadomości od pierwszej w czacie: 1, potem 2, potem 3 i tak dalej. Z tych numerów korzystają komendy `/goto`, `/hide` i `/unhide`.

## Komendy czatu i wiadomości

Te komendy pomagają zarządzać czatem i jego wiadomościami. Działają w czatach **Conversation** i **Roleplay**.

| Komenda | Działa też jako | Co robi |
|---|---|---|
| `/help` | | Wypisuje wszystkie komendy slash. |
| `/send [message]` | | Wysyła wiadomość w imieniu twojej persony bez uruchamiania generowania. |
| `/continue` | `/cont` | Dopisuje tekst do ostatniej odpowiedzi AI, bez wysyłania nowej wiadomości. Opcja **Add a new line before /continue text** w **Settings → General → Responses** decyduje o tym, czy ten tekst zacznie się po pustej linii, czy dokładnie w miejscu przerwania. |
| `/goto [number]` | `/jump`, `/scroll` | Przewija czat do wiadomości o podanym numerze. |
| `/hide [range] [name (optional)]` | | Ukrywa jedną wiadomość lub więcej przed AI w kolejnych turach. |
| `/unhide [range]` | | Przywraca ukryte wiadomości do widoku AI. |
| `/sys [message]` | `/system` | Dodaje wiadomość systemową. Taka notatka widnieje w czacie i steruje AI, ale nie wypowiada jej żadna postać. |
| `/macros` | `/macro` | Wypisuje obsługiwane makra promptu, na przykład `{{user}}` i `{{char}}`. |
| `/remind [time] [message]` | `/reminder`, `/timer` | Ustawia minutnik, a po jego upływie wysyła w czacie przypomnienie. |

Żeby przeskoczyć do wiadomości 27, wpisz to:

```
/goto 27
```

Komendy `/hide` i `/unhide` przyjmują pojedynczy numer, zakres albo jedno i drugie naraz. Ten przykład ukrywa wiadomości od 3 do 8:

```
/hide 3-8
```

Da się też napisać `/hide 5` dla jednej wiadomości albo `/hide 2-5,9,12` dla kilku. Bez imienia postaci wiadomości zostają ukryte przed wszystkimi. Ukryte wiadomości zostają w czacie, ale AI nie czyta ich w następnej turze. Żeby przywrócić wiadomości ukryte globalnie, użyj `/unhide` z taką samą listą numerów.

W trybie **Roleplay** dopisz imię postaci po zakresie, żeby ukryć te wiadomości tylko przed nią:

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Dostęp pozostałych postaci się nie zmienia. Jeśli podajesz imię przed zakresem, ujmij je w cudzysłów, gdy zawiera spacje: starsze formy `/hide Maukie 3-8` i `/hide "Powers That Be" 2-5,9` nadal działają. Jeśli imię pasuje do kilku postaci, podaj je w całości. Imiona złożone z cyfr ujmij w cudzysłów, żeby odróżnić je od numerów wiadomości, na przykład `/hide 1 "123"`. W grupowym czacie Roleplay użyj wyboru awatarów przy przycisku **Hide from AI** (ukrycie przed AI), żeby sprawdzić lub cofnąć ukrycie przed konkretnymi postaciami. W czacie Roleplay z jedną postacią użyj zamiast tego przycisku **Unhide from AI** (odkrycie przed AI) na wiadomości. `/unhide` cofa tylko ukrycie globalne.

Komenda `/remind` przyjmuje najpierw czas, potem treść. W czasie `h` oznacza godziny, `m` minuty, a `s` sekundy. Ten przykład przypomni o czymś za 30 minut:

```
/remind 30m check the oven
```

Przypomnienie żyje w sesji przeglądarki, więc trzymaj zakładkę otwartą, aż się odezwie.

## Komendy fabuły i roleplayu

Te komendy pomagają prowadzić fabułę, wcielać się w postać i dodawać grafiki. Większość z nich sprawdza się najlepiej w czacie **Roleplay**. Wyjątkiem jest `/scene`, którą uruchamia się z czatu **Conversation**.

| Komenda | Działa też jako | Co robi |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`, `/narrate`, `/nar` | Nadaje kolejnej odpowiedzi AI kierunek, który opiszesz. |
| `/as [name] [message (optional)]` | `/respond` | Wysyła wiadomość w imieniu postaci albo prosi postać o odpowiedź. |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`, `/sprite` | Wypisuje wyrazy twarzy sprite'ów postaci albo przełącza między nimi. |
| `/roll [dice (optional)]` | `/r`, `/dice` | Rzuca kością i wysyła wynik. |
| `/random` | `/rand`, `/event` | Prosi AI o dorzucenie do fabuły niespodziewanego wydarzenia. |
| `/scene [description (optional)]` | `/rp` | Uruchamiana z czatu Conversation. Zaczyna nową scenę Roleplay, która odgałęzia się od tego czatu. |
| `/illustrate [range=N-M (optional)] [prompt (optional)]` | `/ill` | Generuje obraz do galerii bieżącego czatu. |
| `/impersonate [direction (optional)]` | `/imp` | Pisze odpowiedź w imieniu twojej persony. |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | Ustawia instrukcję, z której `/impersonate` korzysta w tym czacie. |

W trybie **Roleplay** komenda `/illustrate range=12` ilustruje wiadomość 12, a `/illustrate range=12-18` wysyła do Illustrator wiadomości od 12 do 18. Używaj numerów takich jak w `/goto`, w kolejności rosnącej, maksymalnie 200 wiadomości. Ukryte wiadomości pozostają pominięte. Obraz jest dołączany do ostatniej widocznej wiadomości w wybranym zakresie; przegląd promptu zachowuje wybór także po pojawieniu się nowszych wiadomości. Starsze wiadomości są dostępne również przy włączonym Advanced Memory. Bez `range=` komenda działa jak dotychczas dla bieżącej sceny. Opcjonalny wpisany prompt jest używany bezpośrednio, tak jak wcześniej.

Żeby pokierować kolejną odpowiedzią, dopisz wskazówkę po `/guided`:

```
/guided make him confess he is lying
```

W grupowym czacie Roleplay użyj `/guided respond for [name] [direction (optional)]`, żeby wybrać odpowiadającą postać. Na przykład:

```
/guided respond for "Powers That Be" describe the approaching storm
```

Użyj `/as [name] [message (optional)]`, żeby wysłać tekst w imieniu postaci. Jeśli pominiesz wiadomość, model wygeneruje kolejną odpowiedź tej postaci:

```
/as Dottore "The experiment begins."
/as Dottore
```

Komenda `/roll` rozumie notację kostkową. Ten zapis rzuca dwiema sześciościennymi kośćmi:

```
/roll 2d6
```

Można dodać modyfikator, na przykład `/roll 1d20+5`. Samo `/roll` bez niczego dalej oznacza dla aplikacji rzut `1d20`.

Sprite to obrazek postaci pokazujący wyraz twarzy. Komenda `/emote` przełącza, który z nich jest widoczny. Wpisz samo `/emote`, żeby zobaczyć dostępne wyrazy twarzy, albo podaj nazwę jednego z nich, żeby go włączyć:

```
/emote joy
```

Żeby wskazać jedną postać, użyj `/emote "[name]" [expression (optional)]`, na przykład `/emote "Powers That Be" joy`. Pomiń wyraz twarzy, żeby wyświetlić listę dostępnych wyrazów twarzy tej postaci.

Przełączanie sprite'ów wymaga czatu Roleplay z wgranymi sprite'ami. Sposób ich dodawania opisuje przewodnik [Sprite'y postaci](../characters/sprites.md).

Persona to postać, w którą się wcielasz w czacie – w promptach zapisuje ją makro `{{user}}`. Komenda `/impersonate` pisze odpowiedź za ciebie. Można dopisać po niej wskazówkę:

```
/impersonate ask about the weather
```

Komendy `/impersonate` i `/impersonate_prompt` nie działają w czatach **Conversation**. Pełne omówienie generowania z podpowiedzią i wcielania się w personę znajdziesz w przewodniku [Sterowane generowanie i Impersonate](guided-and-impersonate.md).

## Komendy trybu Conversation

Te komendy działają wyłącznie w czacie **Conversation**.

| Komenda | Co robi |
|---|---|
| `/games` | Otwiera wybór zainstalowanych gier dla trybu Conversation. `/game` i `/play` robią to samo. |
| `/selfie [name (optional)]` | Generuje selfie za pomocą zainstalowanego agenta Illustrator. Dopisz imię, żeby wybrać postać. |
| `/uno` | Zaczyna partię UNO z postaciami z czatu. |
| `/chess` | Zaczyna partię szachów jeden na jednego z postacią. |
| `/poker` | Zaczyna partię pokera Texas Hold'em z postaciami. |
| `/8ball` | Zaczyna partię bilarda 8-ball jeden na jednego z postacią. `/pool` robi to samo. |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | Ustawia lub czyści status obecności postaci. |

Komendy `/uno`, `/chess`, `/poker` i `/8ball` otwierają ekran przygotowania danej gry. W jednym czacie da się prowadzić jedną grę naraz. Zasady i opcje opisuje przewodnik [Gry stołowe](../conversation/table-games.md).

Komenda `/status` nadpisuje obecność postaci. Status może mieć wartość `online`, `idle`, `dnd` (nie przeszkadzać) albo `offline`. Wpisz `clear`, żeby usunąć nadpisanie. Ten przykład ustawia postać jako bezczynną:

```
/status idle
```

W czacie z więcej niż jedną postacią dopisz na końcu jej imię, na przykład `/status online Alice`.

## Powiązane przewodniki

- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](messages.md)
- [Sterowane generowanie i Impersonate](guided-and-impersonate.md)
- [Gry stołowe](../conversation/table-games.md)
- [Makra](../prompts/macros.md)
