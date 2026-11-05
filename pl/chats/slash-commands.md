# Lista komend slash

Komenda slash to skrót wpisywany w polu wiadomości, zaczynający się od `/`, dzięki któremu coś dzieje się szybko. Część komend od razu zmienia ekran. Inne proszą model o napisanie tekstu.

## Jak działają komendy slash

1. Wpisz komendę w polu wiadomości na dole czatu.
2. Kliknij **Send** (wyślij) albo naciśnij <kbd>Enter</kbd>, jeśli dla twojego trybu czatu włączona jest opcja **Send on Enter** (wysyłanie klawiszem Enter). Zobacz [Wysyłanie wiadomości i streaming](sending-and-streaming.md#send-on-enter).

Zaraz po wpisaniu `/` nad polem pojawia się menu pasujących komend. Każdy wiersz pokazuje format komendy i krótki opis. Kliknij wiersz, aby wstawić komendę do pola, dopisz resztę tekstu i wyślij. Tekst zastępczy pola też przypomina o komendach: **Write your response, / for commands** w trybie Roleplay i "Message @Alice, / for commands" w trybie Conversation.

W tabelach format każdej komendy podano w jej wierszu. Zastąp etykiety w nawiasach kwadratowych, takie jak `[name]` lub `[range]`, własnymi wartościami i nie wpisuj samych nawiasów. Argumenty oznaczone `(optional)` można pominąć. Znak `|` rozdziela alternatywy. Wiele komend ma krótsze aliasy, na przykład `/cont` zamiast `/continue`. Aby zobaczyć wszystkie komendy w aplikacji, wpisz:

```text
/help
```

Część komend działa w przeglądarce i nic nie kosztuje. Inne proszą model o napisanie tekstu, co korzysta z twojego konta i może zużywać tokeny (jednostki, które usługi liczą i rozliczają).

Komendy slash działają w polach wiadomości trybów Conversation i Roleplay. W trybie Game działa tylko samo `/illustrate` (lub `/ill`) bez zakresu i promptu, i to tylko wtedy, gdy ilustracje Game są skonfigurowane z kontem do generowania obrazów. Wszystko inne, co zaczyna się od ukośnika, zostaje wysłane jako zwykły tekst. W trybach Roleplay i Conversation komendy `/illustrate`, `/selfie` i `/video` wymagają agenta Illustrator i pojawiają się tylko wtedy, gdy jest zainstalowany.

Kilka komend korzysta z numerów wiadomości. Marinara liczy od pierwszej wiadomości w czacie jako numeru 1. Z tych numerów korzystają `/goto`, `/hide` i `/unhide`. Opcja **Show message numbers** (pokazywanie numerów wiadomości) je wyświetla. Zobacz [Działania na wiadomości](messages.md#message-display-toggles).

## Komendy czatu i wiadomości

Te komendy działają w trybach Conversation i Roleplay.

| Komenda | Co robi |
| --- | --- |
| `/help` | Wypisuje wszystkie komendy slash. |
| `/send` | Wysyła wiadomość w imieniu twojej persony, nie prosząc o odpowiedź. Makra zostają wypełnione, tak jak przy **Send**. Format: `/send [message]`. |
| `/continue` | Dopisuje tekst do ostatniej odpowiedzi AI, bez nowej wiadomości. Także `/cont`. Opcja **Settings → General → Responses → Add a new line before /continue text** (ustawienia, ogólne, odpowiedzi, nowa linia przed tekstem z /continue) decyduje o tym, czy tekst zaczyna się po pustej linii, czy w miejscu przerwania. |
| `/goto` | Przewija czat do wiadomości o podanym numerze. Także `/jump`, `/scroll`. Format: `/goto [number]`. |
| `/hide` | Ukrywa wiadomości przed modelem w kolejnych turach. Format: `/hide [range] [name (optional)]`. |
| `/unhide` | Przywraca wiadomości ukryte globalnie. Format: `/unhide [range]`. |
| `/sys` | Dodaje wiadomość systemową. Widać ją w czacie i steruje modelem, ale nie wypowiada jej żadna postać. Także `/system`. Format: `/sys [message]`. |
| `/macros` | Wypisuje makra promptu, takie jak `{{user}}` i `{{char}}`. Także `/macro`. |
| `/remind` | Ustawia minutnik, a potem wysyła w czacie przypomnienie. Także `/reminder`, `/timer`. Format: `/remind [time] [message]`. |

Przykłady:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

Komendy `/hide` i `/unhide` przyjmują jeden numer, zakres albo ich połączenie: `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. Ukryte wiadomości zostają w czacie, ale model ich nie czyta.

W trybie Roleplay dopisz imię postaci po zakresie, aby ukryć wiadomości tylko przed tą postacią. Pozostałe postacie zachowują do nich dostęp.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Imiona zawierające spacje ujmij w cudzysłów. Starsze formy z imieniem na początku, takie jak `/hide Maukie 3-8`, nadal działają. Jeśli imię pasuje do kilku postaci, podaj je w całości. Imiona złożone z cyfr ujmij w cudzysłów, aby odróżnić je od numerów wiadomości, na przykład `/hide 1 "123"`. Aby sprawdzić lub cofnąć ukrycie przed konkretnymi postaciami, użyj na wiadomości wyboru awatarów **Hide from AI** (ukrycie przed AI) w grupowym czacie Roleplay albo przycisku **Unhide from AI** (odkrycie przed AI) w czacie z jedną postacią. `/unhide` cofa tylko ukrycie globalne.

Komenda `/remind` przyjmuje czas z jednostką `h` (godziny), `m` (minuty) lub `s` (sekundy), a potem treść. Przypomnienie żyje w sesji przeglądarki, więc trzymaj kartę przeglądarki otwartą, aż się odezwie.

## Komendy fabuły i roleplayu

| Komenda | Co robi |
| --- | --- |
| `/guided` | Kieruje następną odpowiedzią. Także `/narrator`, `/narrate`, `/nar`. Format: `/guided [direction]`. |
| `/as` | Wysyła wiadomość w imieniu postaci albo prosi tę postać o odpowiedź. Także `/respond`. Format: `/as [name] [message (optional)]`. |
| `/emote` | Wypisuje wyrazy twarzy sprite'ów albo przełącza wyraz twarzy. Także `/emotion`, `/sprite`. Format: `/emote [expression]`. |
| `/roll` | Rzuca kośćmi i wysyła wynik. Także `/r`, `/dice`. Format: `/roll [dice (optional)]`. |
| `/random` | Prosi model o dodanie niespodziewanego wydarzenia. Także `/rand`, `/event`. |
| `/scene` | Zaczyna scenę Roleplay, która odgałęzia się od rozmowy. Także `/rp`. Format: `/scene [description (optional)]`. |
| `/illustrate` | Tylko Roleplay. Generuje obraz do galerii. Wymaga agenta Illustrator. Także `/ill`. Format: `/illustrate [range=N-M] [prompt]`. |
| `/html` | Tylko Roleplay. Tworzy jeden artefakt ze świata opowieści, na przykład `a spellbook page`, na końcu najnowszej odpowiedzi. Format: `/html [what you want]`. |
| `/video` | Tylko Roleplay. Tworzy krótki klip z najnowszej odpowiedzi lub na podstawie twojego opisu i umieszcza go pod tą odpowiedzią. Korzysta z ustawienia **First frame** (pierwsza klatka) agenta Illustrator. Wymaga agenta Illustrator. Format: `/video [description]`. |
| `/impersonate` | Pisze odpowiedź w imieniu twojej persony. Także `/imp`. Format: `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Ustawia instrukcję, z której `/impersonate` korzysta w tym czacie. Także `/imp_prompt`. Format: `/impersonate_prompt [prompt or reset]`. |

Większość z nich sprawdza się najlepiej w trybie Roleplay. `/scene` uruchamia się z czatu Conversation. `/impersonate` i `/impersonate_prompt` nie są dostępne w trybie Conversation.

### Kierowanie odpowiedzią

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

Zamiast `respond as` działają też `reply as` i `respond for`. Zobacz [Sterowane generowanie i Impersonate](guided-and-impersonate.md).

### Wysyłanie wiadomości w imieniu postaci

Pomiń wiadomość, a model napisze kolejną odpowiedź tej postaci.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Rzut kośćmi

Komenda `/roll 2d6` rzuca dwiema sześciościennymi kośćmi. Można dodać modyfikator, jak w `/roll 1d20+5`. Samo `/roll` bez niczego dalej rzuca `1d20`. Aby zachować tylko część kości, dopisz `kh` (zachowaj najwyższe) albo `kl` (zachowaj najniższe) i liczbę: `/roll 4d6kh3` sumuje trzy najwyższe wyniki, a `/roll 2d20kl1` zachowuje niższy z dwóch. `dl` i `dh` zamiast tego odrzucają najniższe lub najwyższe wyniki, jak w `/roll 4d6dl1`. Kości, które się nie liczą, nadal są widoczne, ale przyciemnione.

### Przełączanie sprite'a

Sprite to obrazek postaci pokazujący wyraz twarzy. Wpisz samo `/emote`, aby zobaczyć dostępne wyrazy twarzy, albo podaj nazwę jednego z nich:

```text
/emote joy
/emote "Powers That Be" joy
```

Z imieniem, ale bez wyrazu twarzy, komenda wypisuje wyrazy twarzy tej postaci. Wymaga czatu Roleplay z wgranymi sprite'ami. Zobacz [Sprite'y postaci](../characters/sprites.md).

### Ilustracje i artefakty

Komenda `/illustrate range=12` ilustruje wiadomość 12. `/illustrate range=12-18` wysyła do agenta Illustrator wiadomości od 12 do 18. Używaj tych samych numerów wiadomości co w `/goto`, w kolejności rosnącej, maksymalnie 200 wiadomości. Ukryte wiadomości są pomijane. Obraz zostaje dołączony do ostatniej widocznej wiadomości w zakresie. Wcześniejsze wiadomości pozostają dostępne przy włączonej funkcji Advanced Memory. Bez `range=` komenda działa na bieżącej scenie. Wpisany prompt jest używany dosłownie.

`/html a terminal readout` nie wymaga agenta i działa niezależnie od tego, czy opcja **HTML Artifacts** (artefakty HTML) jest włączona. Narrator może poprosić o to samo znacznikiem `[html: prompt="..."]`, gdy opcja **HTML Artifacts** jest włączona w sekcji **Roleplay Commands** (komendy Roleplay). Zobacz [Artefakty na żądanie](../roleplay/getting-started.md#artifacts-on-demand).

### Pisanie własnej odpowiedzi

`/impersonate ask about the weather` pisze odpowiedź głosem twojej persony. Persona to postać, która reprezentuje ciebie, w promptach zapisywana jako `{{user}}`. Te dwie komendy nie są dostępne w trybie Conversation.

## Komendy trybu Conversation

Te komendy działają wyłącznie w czacie Conversation.

| Komenda | Co robi |
| --- | --- |
| `/games` | Otwiera wybór zainstalowanych gier. `/game` i `/play` robią to samo. |
| `/selfie` | Generuje selfie za pomocą agenta Illustrator. Dopisz imię, aby wybrać postać. Format: `/selfie [name (optional)]`. |
| `/video` | Sprawia, że postać wysyła krótką wiadomość wideo, zgodnie z ustawieniami **Video messages** (wiadomości wideo) czatu. Zobacz [Wiadomości wideo](../conversation/selfies.md#video-messages). Format: `/video [name (optional)]`. |
| `/uno` | Zaczyna partię UNO z postaciami z czatu. |
| `/chess` | Zaczyna partię szachów jeden na jednego z postacią. |
| `/poker` | Zaczyna partię pokera Texas Hold'em z postaciami. |
| `/8ball` | Zaczyna partię bilarda 8-ball jeden na jednego z postacią. `/pool` robi to samo. |
| `/status` | Ustawia lub czyści status obecności postaci. Format: `/status [online, idle, dnd, offline or clear] [name]`. |

Komendy gier otwierają ekran przygotowania danej gry, a każda pojawia się tylko wtedy, gdy zainstalowany jest agent tej gry. W jednym czacie można prowadzić jedną grę naraz. Zobacz [Gry stołowe](../conversation/table-games.md).

Komenda `/status` nadpisuje obecność postaci. Status może mieć wartość `online`, `idle`, `dnd` (nie przeszkadzać) albo `offline`. `clear` usuwa nadpisanie. W czacie z kilkoma postaciami dopisz na końcu imię.

```text
/status idle
/status online Alice
```
