# Narrative Director i Secret Plot

Narrative Director to agent (pomocnik, który działa obok odpowiedzi) sterujący fabułą czatu Roleplay. **Push Story** (popchnięcie fabuły) popycha jedną odpowiedź, gdy scena utknęła w miejscu. **Secret Plot** (sekretna fabuła) prowadzi ukryty, długofalowy wątek, który kształtuje wiele odpowiedzi. Agent działa wyłącznie w trybie Roleplay. Ogólne zasady działania agentów opisuje przewodnik [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Dodaj agenta Narrative Director do czatu

1. Otwórz **Chat Settings** (ustawienia czatu) przyciskiem z suwakami w czacie i przejdź do **Agents** (agenci).
2. Włącz **Enable Agents** (włączenie agentów), a potem dodaj agenta **Narrative Director**.

Nad polem wiadomości pojawia się teraz przycisk **Push Story**, a w sekcji **Agents** – karta **Narrative Director**. Agent nic nie robi, dopóki nie użyjesz **Push Story** albo nie włączysz **Secret Plot**.

## Popchnij fabułę do przodu

**Push Story** działa jednorazowo. Wpływa tylko na następną odpowiedź, a potem sam się wyłącza. Najpierw dodaj agenta Narrative Director do czatu (opis wyżej).

1. Kliknij **Push Story** nad polem wiadomości. Menu pyta, jak popchnąć fabułę:
   - **Naturally** (naturalnie): popycha istniejącą fabułę do przodu. AI rozwija wątki, które już są w historii.
   - **Randomly** (losowo): dorzuca do sceny wiarygodną niespodziankę.
2. Wybierz jedną z opcji. Pojawia się komunikat "The next time a character responds, they will push the story forward naturally!" (albo "randomly!"). Przycisk ma teraz napis **Push Story: Naturally** albo **Push Story: Randomly**.
3. Wyślij kolejną wiadomość albo wygeneruj nową odpowiedź. AI pisze tę jedną odpowiedź z uwzględnieniem popchnięcia fabuły.
4. Po tej odpowiedzi **Push Story** wyłącza się sam.

Tryb wybierasz z tego menu za każdym razem. Nie ma trybu domyślnego ani ustawienia trybu w **Chat Settings**.

Aby anulować przed wysłaniem, kliknij ponownie uzbrojony przycisk. Pojawia się komunikat "Push Story disarmed."

Jeśli to nie zadziałało: **Push Story** nie reaguje w trakcie generowania odpowiedzi. Poczekaj, aż odpowiedź się skończy, i dopiero wtedy go kliknij.

## Włącz funkcję Secret Plot

**Secret Plot** to ukryty, długofalowy wątek fabularny. AI prowadzi sekretny plan na dalszy ciąg historii. Plan trafia do promptu (tekstu, który Marinara wysyła do AI), ale pozostaje przed tobą ukryty, dopóki go nie odsłonisz. Domyślnie funkcja jest wyłączona. W przeciwieństwie do **Push Story** działa przez wiele odpowiedzi i aktualizuje swój plan w stałych odstępach.

1. Otwórz **Chat Settings → Agents** i znajdź kartę **Narrative Director**.
2. Włącz przełącznik **Secret Plot**. Jego etykieta brzmi "Maintain a hidden long-term arc for this roleplay."
3. Jeśli chcesz, ustaw **Run Interval** (odstęp między uruchomieniami). To liczba wiadomości (twoich i AI), które mijają między kolejnymi aktualizacjami wątku. Domyślna wartość to 8. Można wpisać dowolną liczbę całkowitą od 1 do 100. Im mniejsza liczba, tym częściej plan jest aktualizowany.

## Odsłoń i edytuj ukryty wątek

Panel **Secret plot** znajduje się pod polem **Run Interval**.

1. Kliknij **Reveal spoilers** (odsłonięcie spoilerów). Jeśli AI nie napisała jeszcze wątku, przycisk nosi nazwę **Reveal empty arc** (odsłonięcie pustego wątku). Przy ukrytym wątku panel pokazuje napis "Spoilers hidden". Kliknij **Hide spoilers** (ukrycie spoilerów), żeby znowu go ukryć.
2. Edytuj wybrane pola:
   - **Arc description** (opis wątku): cała ukryta linia fabularna.
   - **Protagonist arc** (wątek protagonisty): dokąd zmierza twoja postać.
   - **Character arc** (wątek postaci): dokąd zmierza jedna wybrana postać.
   - **Completed** (ukończony): zaznacz to pole po zakończeniu wątku.
3. Zapisz zmiany przyciskiem zapisu.

Żeby wyrzucić bieżący wątek i kazać AI napisać nowy, kliknij **Regenerate** (ponowne generowanie). Okno zatytułowane "Regenerate Secret Plot" prosi o potwierdzenie. Wybierz **Regenerate**, żeby zastąpić wątek, albo **Keep Current Arc** (zachowanie bieżącego wątku), żeby zrezygnować.

Wątek jest zapisany razem z agentem **Narrative Director**. Wyczyszczenie wyników agentów w czacie go nie kasuje. Znika dopiero wtedy, gdy usuniesz agenta z czatu, a wcześniej ostrzega o tym komunikat.

## Zmień prompt funkcji Secret Plot

**Secret Plot Prompt** (prompt funkcji Secret Plot) zawiera instrukcje, według których agent Narrative Director pisze i aktualizuje wątek. Wbudowany prompt przedstawia każdy wątek jako zagadkę do odkrycia. Pasuje to do przygód i intryg, ale może nie pasować do historii napędzanej przez postacie.

1. Otwórz panel **Agents** i edytuj agenta **Narrative Director**.
2. W sekcji **Secret Plot** kliknij **Copy default to edit** (skopiowanie domyślnego tekstu do edycji).
3. Zmień tekst, a potem zapisz agenta.

Kliknij **Reset to default** (przywrócenie domyślnego), żeby wrócić do wbudowanego promptu, a potem zapisz agenta.

> **Uwaga:** Nie usuwaj ostatniej części promptu. Opisuje ona format odpowiedzi, a bez niej Marinara nie odczyta wątku.

Prompt jest zapisywany w agencie, więc dotyczy każdego czatu, który korzysta z tego agenta Narrative Director.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Sterowane generowanie i Impersonate](../chats/guided-and-impersonate.md)
