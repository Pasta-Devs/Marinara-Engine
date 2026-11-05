# Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie

Każda wiadomość, twoja albo napisana przez AI, ma pasek narzędzi. Służy on do edycji, usuwania, ponownego generowania i ukrywania pojedynczej wiadomości oraz do tworzenia od niej gałęzi.

Pasek pojawia się, gdy na telefonie lub tablecie dotkniesz wiadomości, a na komputerze najedziesz na nią kursorem.

## Pasek narzędzi wiadomości

Najczęściej używane:

- **Edit** (edycja) zmienia tekst wiadomości.
- **Regenerate** (ponowne generowanie) prosi model o nową wersję odpowiedzi AI. Każda taka wersja to swipe.
- **Delete** (usunięcie) usuwa wiadomość.

Przyciski są ikonami. Ich etykiety podaje tabela poniżej. Niektóre pojawiają się tylko w określonych sytuacjach.

| Przycisk | Do czego służy |
| --- | --- |
| **Copy** (kopiowanie) | Kopiuje tekst wiadomości. |
| **Edit** | Otwiera wiadomość do edycji. |
| **Regenerate** | Tworzy nowy swipe (kolejną wersję odpowiedzi). Tylko na wiadomościach AI. Także na twoich wiadomościach w trybie Roleplay i na twoich wiadomościach utworzonych przez Impersonate w trybie Conversation. |
| **Delete** | Usuwa wiadomość. |
| **Translate** (tłumaczenie) / **Hide translation** (ukrycie tłumaczenia) | Tłumaczy wiadomość na twój język, a potem chowa tłumaczenie. |
| **Add reaction** (dodanie reakcji) | Otwiera wybór emoji. Tylko w trybie Conversation. |
| **Hide from AI** (ukrycie przed AI) / **Unhide from AI** (odkrycie przed AI) | Wstrzymuje lub wznawia wysyłanie tej wiadomości do modelu. W czacie grupowym w trybie Roleplay otwiera wybór postaci. |
| **Bookmark, pin or note** (dodaj zakładkę, przypnij lub dodaj notatkę) | Dodaje wiadomość do zakładek, przypina ją, żeby zostawała w prompcie także poza limitem historii (do 10 na czat), albo dodaje **Private note** (prywatną notatkę). Model nigdy nie widzi notatki, chyba że włączysz **Show the note to the narrator character** (pokaż notatkę postaci narratora). Działa to w czatach z jedną postacią i w czatach grupowych, w których postacie odpowiadają osobno. |
| **Branch from here** (utworzenie gałęzi stąd) | Kopiuje czat aż do tej wiadomości do nowej gałęzi. Niedostępne w czatach sceny. |
| **Clone from here** (klonowanie od tego miejsca) | Kopiuje czat sceny aż do tej wiadomości do nowego czatu w trybie Roleplay. Tylko w czatach sceny. |
| **Peek prompt** (podejrzenie promptu) | Pokazuje dokładny prompt tej odpowiedzi. Tylko na najnowszej wiadomości AI. |
| **Stored guidance** (zapisana wskazówka) | Pokazuje wskazówkę, która pokierowała tą odpowiedzią. Tylko przy odpowiedziach powstałych na podstawie wskazówki albo przez Impersonate. |
| **View model thoughts** (podgląd myśli modelu) | Otwiera ukryte rozumowanie modelu. Tylko wtedy, gdy model zwrócił rozumowanie. |
| **Show original before rewrite** (pokazanie oryginału) / **Show rewritten version** (pokazanie wersji przepisanej) | Przełącza między tekstem oryginalnym a przepisanym, gdy agent (pomocnik działający obok odpowiedzi) przepisał wiadomość. |
| **Mark as new start** (oznacz jako nowy początek) | Tylko w trybie Roleplay. Gdy włączona jest funkcja Advanced Memory (pamięć długoterminowa aplikacji Marinara Engine), pamięć modelu o czacie zaczyna się od tej wiadomości. Zobacz [Memory Recall i podsumowania czatu](../agents/memory.md). |
| **Pause speaking** (wstrzymanie mowy) / **Resume speaking** (wznowienie mowy) / **Restart speaking** (odtworzenie mowy od nowa) | Steruje odczytem na głos, gdy włączona jest funkcja Text to Speech (synteza mowy, czyli głos czytający wiadomości) i trwa odczyt. |

Więcej: [Peek Prompt](peek-prompt.md), [Gałęzie czatu](branches.md), [Sceny](../roleplay/scenes.md) (czat sceny to krótki czat w trybie Roleplay odgałęziony od innego czatu), [Tłumaczenie wiadomości](../integrations/message-translation.md), [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md), [Sterowane generowanie i Impersonate](guided-and-impersonate.md), [prywatne notatki](../roleplay/getting-started.md#your-private-notes).

## Edytowanie wiadomości

1. Kliknij **Edit** na wiadomości. Tekst zmienia się w pole edycji.
2. Zmień tekst.
3. Kliknij **Save** (zapisanie) albo naciśnij <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (na komputerze Mac <kbd>Cmd</kbd>+<kbd>Enter</kbd>).
4. Aby przerwać bez zapisywania, kliknij **Cancel** (anulowanie) albo naciśnij <kbd>Esc</kbd>.

Dwa ustawienia w **Settings → General → Input & Editing** (ustawienia, ogólne, wprowadzanie i edycja) pozwalają szybciej zacząć edycję. Oba są domyślnie włączone.

- **Up Arrow edits last message** (edycja ostatniej wiadomości strzałką w górę): naciśnij <kbd>Up</kbd>, gdy pole wpisywania jest puste.
- **Double-click edits messages** (edycja wiadomości dwukrotnym kliknięciem): kliknij dwukrotnie albo dotknij dwukrotnie wiadomości w trybie Roleplay.

## Usuwanie wiadomości

1. Kliknij **Delete** na wiadomości. Otwiera się okno **Delete message** (usunięcie wiadomości).
2. Wybierz jedną z opcji.

| Opcja | Do czego służy |
| --- | --- |
| **Delete only this swipe (1/3)** (usunięcie tylko tego swipe'a) | Usuwa swipe, który właśnie widzisz. Pojawia się tylko wtedy, gdy wiadomość ma więcej niż jeden swipe. |
| **Delete all other swipes** (usunięcie wszystkich pozostałych swipe'ów) | Zachowuje oglądany swipe i usuwa resztę. Pojawia się tylko wtedy, gdy wiadomość ma więcej niż jeden swipe. |
| **Delete this message** (usunięcie tej wiadomości) | Usuwa wiadomość razem ze wszystkimi jej swipe'ami. |
| **Delete more** (usunięcie kolejnych) | Zaznacza tę wiadomość i każdą poniżej, a potem otwiera pasek zaznaczania. |
| **Cancel** | Zamyka okno. |

Na pasku zaznaczania klikaj wiadomości, żeby dodać je do zaznaczenia. **Select all messages above** (zaznaczenie wszystkich wiadomości powyżej) i **Select all messages below** (zaznaczenie wszystkich wiadomości poniżej) rozszerzają zaznaczenie, **Unselect all** (odznaczenie wszystkich) je czyści, a **Delete selected** (usunięcie zaznaczonych) usuwa zaznaczone wiadomości. Pasek pokazuje, ile wiadomości jest zaznaczonych.

Wiadomości systemowe, na przykład wiersz "joined the chat", usuwa się jednym kliknięciem, bez żadnego okna.

## Swipe'y: alternatywne odpowiedzi

Swipe to jedna wersja odpowiedzi AI. Jedna wiadomość może mieścić kilka swipe'ów, więc da się porównać odpowiedzi i zostawić tę, która ci się podoba. Sterowanie swipe'ami pojawia się, gdy wiadomość ma co najmniej dwa swipe'y. Pokazuje aktywny swipe i łączną liczbę, na przykład "2/4".

- **Previous swipe** (poprzedni swipe) i **Next swipe** (następny swipe) przechodzą po kolejnych swipe'ach.
- Pole liczbowe przenosi do wybranego swipe'a. Wpisz numer i naciśnij <kbd>Enter</kbd>. Etykieta pola to **Jump to swipe 1-N**.
- Gdy widzisz najnowszy swipe, przycisk do przodu zmienia się w **Generate next swipe** (wygenerowanie kolejnego swipe'a) i tworzy nowy swipe.

Ostatniego swipe'a nie da się usunąć. Aplikacja zgłasza wtedy "Cannot delete the last remaining swipe". Użyj zamiast tego opcji **Delete this message**.

## Ponowne generowanie, kontynuacja i ponowna próba

Te trzy działania wyglądają podobnie, ale robią co innego.

| Działanie | Wynik |
| --- | --- |
| **Regenerate** | Nowy swipe. Oryginał zostaje zachowany. Na ekranie dotykowym aplikacja najpierw pyta "Regenerate this message as a new swipe?". Gdy wskazówka jest przygotowana, przycisk nosi nazwę **Regenerate (guided)**. |
| `/continue` | Dalszy tekst w tej samej wiadomości, bez nowego swipe'a. |
| **Send** (wysłanie) przy pustym polu | Świeża odpowiedź. |

### Kontynuowanie odpowiedzi

Wpisz `/continue` (albo `/cont`) w polu wpisywania i wyślij. Model podejmuje wątek tam, gdzie urwała się jego ostatnia odpowiedź.

```text
/continue
```

Marinara wstawia pustą linię przed nowym tekstem. Aby doklejać go wprost do ostatniego znaku, wyłącz **Settings → General → Responses → Add a new line before /continue text** (ustawienia, ogólne, odpowiedzi, nowa linia przed tekstem z /continue).

### Ponowna próba przy pustym polu

Jeśli ostatnia wiadomość jest twoja, a pole wpisywania jest puste, przycisk **Send** zamiast wysyłać, ponawia próbę. W trybie Roleplay **Send** przy pustym polu rozpoczyna też nową turę już po odpowiedzi AI. Nigdy nie dopisuje niczego do poprzedniej odpowiedzi. Zobacz [Wysyłanie wiadomości i streaming](sending-and-streaming.md#retry-without-retyping).

## Ukrywanie wiadomości przed AI

Kliknij **Hide from AI**, żeby w kolejnych turach wiadomość nie trafiała do promptu. Nadal ją widzisz, z etykietą **Hidden from AI** (ukryte przed AI). Kliknij **Unhide from AI**, żeby znów ją wysyłać.

W czacie grupowym w trybie Roleplay przycisk **Hide from AI** otwiera wybór awatarów. Wybierz awatar grupy, żeby ukryć wiadomość przed wszystkimi, albo jedną lub kilka postaci, żeby ukryć ją tylko przed nimi. Znacznik z przekreślonym okiem na wiadomości pokazuje, kto jej nie widzi. W czacie z jedną postacią przycisk od razu ukrywa albo odkrywa wiadomość.

Jeśli ukryjesz wiadomość przed jedną postacią, ta postać nadal dostaje zawarty w niej szept, ale nic z reszty wiadomości. Ukrycie przed wszystkimi usuwa też szepty. Zobacz [Szepty i sekrety](../roleplay/getting-started.md#whispers-and-secrets).

Aby ukryć zakres wiadomości, użyj komend `/hide` i `/unhide`. Zobacz [Lista komend slash](slash-commands.md). Numery wiadomości zaczynają się od 1 przy pierwszej wiadomości.

Gdy w funkcji Advanced Memory włączona jest opcja **Decide who sees new messages** (decydowanie, kto widzi nowe wiadomości), nowe wiadomości w czacie grupowym, w którym postacie odpowiadają po kolei, są automatycznie ukrywane przed nieobecnymi postaciami. Twój własny wybór zawsze ma pierwszeństwo. Zobacz [Decydowanie, kto widzi nowe wiadomości](../agents/memory.md#deciding-who-sees-new-messages).

<a id="message-display-toggles"></a>

## Przełączniki wyświetlania wiadomości

Znajdują się w **Settings → Advanced → Message Tools** (ustawienia, zaawansowane, narzędzia wiadomości).

| Przełącznik | Domyślnie | Co pokazuje |
| --- | --- | --- |
| **Show message numbers** (pokazywanie numerów wiadomości) | Wyłączony | Numer na każdej wiadomości – te same numery, których używają `/goto`, `/hide` i `/unhide`. |
| **Show token usage on messages** (pokazywanie zużycia tokenów na wiadomościach) | Wyłączony | Tokeny promptu i odpowiedzi dla każdej odpowiedzi AI (token to mały kawałek tekstu, który liczy model), a jeśli dane są dostępne, także trafienia w pamięci podręcznej i czas odpowiedzi. |
| **Show model name on messages** (pokazywanie nazwy modelu na wiadomościach) | Wyłączony | Model, który napisał każdą odpowiedź. |
| **Show "older messages not sent" note** (pokazanie informacji o niewysłanych starszych wiadomościach) | Włączony | Informację pod odpowiedzią, na przykład "1109 older messages not sent", gdy starsze wiadomości nie zmieściły się w prompcie. Informacje o uciętej albo pustej odpowiedzi pokazują się zawsze. |
