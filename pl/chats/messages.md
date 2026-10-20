# Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie

Z tego przewodnika dowiesz się, co da się zrobić z pojedynczą wiadomością w czacie. Opisuje pasek narzędzi wiadomości, edycję i usuwanie wiadomości oraz działanie swipe'ów i ponownego generowania. Wyjaśnia też przełączniki, które pokazują liczbę tokenów i numery wiadomości.

Każda wiadomość w aplikacji Marinara Engine – twoja albo napisana przez AI – ma mały pasek narzędzi. Pasek pojawia się, kiedy na komputerze najedziesz kursorem na wiadomość, a na telefonie lub tablecie – kiedy ją dotkniesz.

## Pasek narzędzi wiadomości

Poniższe przyciski pojawiają się na wiadomościach. Część z nich widać tylko w określonych sytuacjach, co opisuje tabela. Każdy przycisk ma podpowiedź zgodną z nazwą podaną tutaj.

| Przycisk | Do czego służy | Kiedy się pojawia |
| --- | --- | --- |
| **Copy** (kopiowanie) | Kopiuje tekst wiadomości. Ikona na moment zmienia się w znak zaznaczenia. | Zawsze |
| **Add reaction** (dodanie reakcji) | Otwiera wybór emoji i włącza lub wyłącza twoją reakcję na wiadomości. | Tylko w trybie Conversation |
| **Translate** (tłumaczenie) / **Hide translation** (ukrycie tłumaczenia) | Tłumaczy wiadomość na twój język, a potem znów chowa tłumaczenie. | Zawsze |
| **Edit** (edycja) | Otwiera wiadomość do edycji. Szczegóły poniżej. | Zawsze |
| **Regenerate** (ponowne generowanie) | Tworzy nową, alternatywną odpowiedź, czyli swipe. Szczegóły poniżej. | Na wiadomościach AI. W trybie Roleplay także na twoich wiadomościach. W trybie Conversation także na twoich wiadomościach utworzonych przez Impersonate |
| **Show original before rewrite** (pokazanie oryginału) / **Show rewritten version** (pokazanie wersji przepisanej) | Przełącza między tekstem oryginalnym a przepisanym. Obie wersje zostają dostępne, więc da się je porównać i zostawić tę, która bardziej odpowiada. | Tylko wtedy, gdy agent przepisał wiadomość |
| **Hide from AI** (ukrycie przed AI) / **Unhide from AI** (odkrycie przed AI) | Wstrzymuje lub wznawia wysyłanie tej wiadomości do AI w kolejnych turach. W czacie grupowym w trybie Roleplay otwiera wybór postaci. | Zawsze |
| **Peek prompt** (podejrzenie promptu) | Pokazuje dokładny prompt, czyli tekst, który AI dostało na potrzeby tej odpowiedzi. | Tylko na najnowszej wiadomości AI |
| **Stored guidance** (zapisana wskazówka) | Pokazuje wskazówkę, która pokierowała tą odpowiedzią. | Tylko wtedy, gdy odpowiedź powstała na podstawie wskazówki albo przez Impersonate |
| **Branch from here** (utworzenie gałęzi stąd) | Kopiuje czat aż do tej wiadomości i zakłada z niego nową gałąź. | Zawsze |
| **View model thoughts** (podgląd myśli modelu) | Otwiera ukryty tekst rozumowania modelu. | Tylko wtedy, gdy model zwrócił rozumowanie |
| **Delete** (usunięcie) | Usuwa wiadomość. Szczegóły poniżej. | Zawsze |
| **Pause speaking** (wstrzymanie mowy) / **Resume speaking** (wznowienie mowy) / **Restart speaking** (odtworzenie mowy od nowa) | Steruje odczytem wiadomości na głos. | Tylko gdy Text to Speech jest włączone i trwa odczyt |

Podgląd **Peek prompt** opisuje przewodnik [Peek Prompt](peek-prompt.md). Przycisk **Branch from here** opisują [Gałęzie czatu](branches.md). O przycisku **Translate** mówi [Tłumaczenie wiadomości](../integrations/message-translation.md). Sterowanie mową opisuje [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md). Wskazówki kierujące odpowiedzią, **Stored guidance** i Impersonate opisuje [Sterowane generowanie i Impersonate](guided-and-impersonate.md).

## Edytowanie wiadomości

Edytować da się tekst każdej wiadomości – twojej i tej od AI.

1. Kliknij przycisk **Edit** na wiadomości. Tekst zmienia się w pole edycji.
2. Zmień tekst.
3. Kliknij przycisk **Save** (zapisanie) albo naciśnij Ctrl i Enter razem (na komputerze Mac Cmd i Enter). Podpowiedź przycisku brzmi **Save (Cmd+Enter)**.
4. Aby przerwać bez zapisywania, kliknij przycisk **Cancel** (anulowanie) albo naciśnij klawisz Esc. Podpowiedź przycisku brzmi **Cancel (Esc)**.

Edycję da się uruchomić szybciej – służą do tego dwa ustawienia. Oba znajdują się w panelu **Settings** (Ustawienia), na zakładce **General**, w sekcji **Input & Editing**.

- **Up Arrow edits last message** (domyślnie włączone): naciśnij klawisz Up Arrow przy pustym polu wpisywania. Otwiera to najnowszą wiadomość do edycji.
- **Double-click edits messages** (domyślnie włączone): kliknij dwukrotnie albo dotknij dwukrotnie wiadomości w trybie Roleplay, żeby otworzyć ją do edycji.

## Usuwanie wiadomości

Przy usuwaniu wiadomości pojawia się okno o tytule **How to proceed?**. Dostępne opcje usunięcia to:

- **Delete only this swipe (1/3)**: usuwa tylko tę alternatywną odpowiedź, którą właśnie widać. Ta opcja pojawia się wyłącznie wtedy, gdy wiadomość ma więcej niż jeden swipe. Liczby pokazują, który swipe jest aktywny i ile ich w sumie jest.
- **Delete this message**: usuwa całą wiadomość razem ze wszystkimi swipe'ami.
- **Delete more**: zaznacza tę wiadomość i wszystkie poniżej, a następnie włącza zaznaczanie wielu wiadomości, żeby dało się poprawić wybór przed usunięciem.
- **Cancel**: zamyka okno i nic nie usuwa.

Wiadomości systemowe, na przykład wpis "joined the chat", mają zwykły przycisk usuwania bez żadnego okna.

## Swipe'y: alternatywne odpowiedzi

Swipe to jedna wersja odpowiedzi AI. Pojedyncza wiadomość może mieścić kilka swipe'ów, więc da się porównać różne odpowiedzi na tę samą turę i wybrać tę, która bardziej się podoba.

Gdy wiadomość ma dwa swipe'y lub więcej, pojawia się na niej sterowanie swipe'ami. Pokazuje aktywny swipe i łączną liczbę, na przykład "2/4", a w jego skład wchodzą:

- **Previous swipe** (poprzedni swipe) i **Next swipe** (następny swipe): przechodzą wstecz albo do przodu po kolejnych swipe'ach.
- Pole liczbowe: wpisz numer swipe'a i naciśnij Enter, żeby przejść od razu do niego. Podpowiedź brzmi **Jump to swipe 1-N**, gdzie N to łączna liczba swipe'ów.
- **Generate next swipe** (wygenerowanie kolejnego swipe'a): gdy widoczny jest najnowszy swipe, przycisk do przodu zmienia się właśnie w ten i tworzy całkiem nowy swipe.

Ostatniego swipe'a w wiadomości nie da się usunąć. Przy takiej próbie aplikacja zgłasza "Cannot delete the last remaining swipe". Żeby usunąć całą wiadomość, użyj opcji **Delete this message**.

## Ponowne generowanie, kontynuacja i ponowna próba

Te trzy działania wyglądają podobnie, ale robią co innego. Wybierz to, które odpowiada twojemu celowi.

**Regenerate** tworzy nowy swipe. Kliknij przycisk **Regenerate** na wiadomości AI, żeby wygenerować kolejną wersję tej odpowiedzi. Pierwotny swipe zostaje zachowany. Na ekranie dotykowym aplikacja najpierw pyta "Regenerate this message as a new swipe?", żeby nic nie uruchomiło się przypadkiem. Kiedy wskazówka kierująca jest przygotowana, przycisk nosi nazwę **Regenerate (guided)**.

Komenda **/continue** rozbudowuje tę samą wiadomość. Wpisz `/continue` (albo skróconą postać `/cont`) w polu wpisywania i wyślij. AI podejmuje wątek tam, gdzie poprzednia odpowiedź się urwała, i dopisuje dalszy tekst do tej samej wiadomości, zamiast tworzyć nowy swipe.

Domyślnie Marinara wstawia pustą linię przed dopisanym tekstem. Aby kontynuacja doklejała się wprost do ostatniego znaku poprzedniej odpowiedzi, wyłącz opcję **Settings → General → Responses → Add a new line before /continue text**. Marinara każe wtedy modelowi kontynuować dokładnie od miejsca przerwania, bez żadnego separatora.

```
/continue
```

Puste wysłanie uruchamia całkiem nową odpowiedź. Jeśli ostatnia wiadomość w czacie jest twoja, a pole wpisywania jest puste, ten sam przycisk **Send** (wysłanie) zamiast wysyłać, ponawia próbę. Wygląd przycisku się nie zmienia. Kliknij go albo naciśnij Enter, żeby dostać odpowiedź bez przepisywania wiadomości. W trybie Roleplay puste wysłanie może też skłonić AI do poprowadzenia sceny w kolejnej turze. To co innego niż **/continue**: puste wysłanie zawsze tworzy nową odpowiedź, a **/continue** dopisuje do istniejącej.

## Ukrywanie wiadomości przed AI

Kontekst AI to zestaw wiadomości, które aplikacja wysyła do AI w każdej turze. Kliknij przycisk **Hide from AI**, żeby trzymać wiadomość poza tym kontekstem w kolejnych turach. Wiadomość nadal widać na ekranie, z etykietą **Hidden from AI**. Kliknij przycisk **Unhide from AI**, żeby wysyłać ją ponownie.

W czacie grupowym w trybie Roleplay, w którym jest więcej niż jedna postać, przycisk **Hide from AI** otwiera niewielki wybór awatarów. Wybierz awatar grupy, żeby ukryć wiadomość przed wszystkimi, albo wskaż jeden lub kilka awatarów postaci, żeby ukryć ją tylko przed nimi. Wybór wszystkich czyści pojedyncze zaznaczenia, a wskazanie pojedynczej postaci wyłącza opcję obejmującą wszystkich. Znacznik z przekreślonym okiem na wiadomości pokazuje awatary postaci, które jej nie widzą. W czacie z jedną postacią przycisk po prostu ukrywa wiadomość albo ją odkrywa.

Szept w wiadomości nadal dociera do odbiorcy, gdy ukryjesz wiadomość tylko przed tą postacią. Odbiorca dostaje szept, ale nic z reszty wiadomości. Ukrycie wiadomości przed wszystkimi ukrywa również jej szepty. Zobacz [Szepty i sekrety](../roleplay/getting-started.md#whispers-and-secrets).

Wiadomości można też ukrywać komendą `/hide [range] [name (optional)]`, na przykład `/hide 3-8`. W trybie Roleplay `/hide 3-8 Maukie` ukrywa je tylko przed Maukie; bez imienia zostają ukryte przed wszystkimi. `/unhide [range]` przywraca wiadomości ukryte globalnie. Żeby cofnąć ukrycie przed konkretną postacią, użyj wyboru awatarów w grupowym czacie Roleplay albo przycisku **Unhide from AI** na wiadomości w czacie Roleplay z jedną postacią. Numery wiadomości zaczynają się od 1, licząc od pierwszej wiadomości w czacie. Formaty i przykłady opisuje przewodnik [Lista komend slash](slash-commands.md).

Gdy w Advanced Memory włączona jest opcja **Decide who sees new messages** (decydowanie, kto widzi nowe wiadomości), nowe wiadomości w czacie grupowym, w którym postacie odpowiadają po kolei, są automatycznie ukrywane przed nieobecnymi postaciami, z tym samym znacznikiem. Samodzielna zmiana wyboru dla wiadomości zawsze ma pierwszeństwo; zobacz [Decydowanie, kto widzi nowe wiadomości](../agents/memory.md#deciding-who-sees-new-messages).

## Przełączniki wyświetlania wiadomości

Dwa przełączniki decydują o tym, jakie dodatkowe szczegóły widać na wiadomościach. Oba znajdują się w panelu **Settings**, na zakładce **Advanced**, w sekcji **Message Tools**. Oba są domyślnie wyłączone.

- **Show message numbers**: pokazuje numer na każdej wiadomości. Numery zaczynają się od 1 przy pierwszej wiadomości w czacie. Tych samych numerów używają komendy `/goto`, `/hide` i `/unhide`. Włącz ten przełącznik, kiedy potrzebujesz numeru wiadomości.
- **Show token usage on messages**: dodaje do odpowiedzi AI licznik tokenów dla każdej wiadomości. Token to mały kawałek tekstu, który AI czyta i pisze. Licznik pokazuje tokeny promptu i tokeny odpowiedzi dla danej wiadomości. Jeśli dane są dostępne, pokazuje też trafienia w pamięci podręcznej i czas powstawania odpowiedzi.

Pokrewny przełącznik w tej samej sekcji **Message Tools**, **Show model name on messages**, dodaje nazwę modelu AI, który napisał daną odpowiedź. On również jest domyślnie wyłączony.

Gdy starsze wiadomości trzeba było pominąć w prompcie, żeby się zmieścił, krótka informacja pod odpowiedzią podaje ich liczbę, na przykład "1109 older messages not sent". Żeby ukryć tę informację pod odpowiedzią, wyłącz **Show "older messages not sent" note** (pokazanie informacji o niewysłanych starszych wiadomościach) w tej samej sekcji. Po otwarciu funkcji Checkup informacja nadal może się pokazać. Ten przełącznik jest domyślnie włączony. Informacje o odpowiedzi, która została ucięta albo wróciła pusta, nadal się pokazują.

## Powiązane przewodniki

- [Wysyłanie wiadomości i streaming](sending-and-streaming.md)
- [Sterowane generowanie i Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [Gałęzie czatu](branches.md)
- [Konfiguracja syntezy mowy (TTS)](../media/tts-setup.md)
- [Tłumaczenie wiadomości](../integrations/message-translation.md)
- [Przegląd ustawień](../settings/settings-overview.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
