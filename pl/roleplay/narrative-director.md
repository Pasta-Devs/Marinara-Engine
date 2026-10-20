# Narrative Director i Secret Plot

Ten przewodnik wyjaśnia, jak działa agent **Narrative Director** (reżyser fabuły) w aplikacji Marinara Engine. Znajdziesz tu opis przycisku **Push Story** (popchnięcie fabuły), trybów **Natural** i **Random Event** oraz ukrytego wątku **Secret Plot** (sekretna fabuła). Wszystkie te funkcje działają w trybie Roleplay.

## Czym jest Narrative Director

Agent to pomocnik AI, który pracuje w tle czatu i wykonuje jedno konkretne zadanie. **Narrative Director** jest właśnie takim agentem. Pisze jednorazową wskazówkę do następnej odpowiedzi, dzięki czemu historia idzie w wybraną przez ciebie stronę. Ogólne zasady działania agentów opisuje [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

Agent **Narrative Director** działa wyłącznie w trybie Roleplay. Sam z siebie nie robi nic. Włącza się tylko wtedy, gdy uzbroisz go na jedną odpowiedź przyciskiem **Push Story** albo gdy włączysz funkcję **Secret Plot**.

Najpierw trzeba dodać agenta do czatu. Otwórz panel **Chat Settings** (ustawienia czatu), przejdź do sekcji **Agents** i włącz agenta **Narrative Director**. Od tej chwili nad polem wiadomości pojawia się przycisk **Push Story**, a w sekcji **Agents** – karta ustawień **Narrative Director**.

## Push Story

Przycisk **Push Story** działa jednorazowo. Wpływa tylko na następną odpowiedź, a potem sam się wyłącza. Sięgnij po niego, kiedy scena stoi w miejscu i chcesz, żeby AI pchnęła akcję do przodu.

Wykonaj kolejno te kroki:

1. Otwórz czat w trybie Roleplay z włączonym agentem **Narrative Director**.
2. Znajdź przycisk **Push Story** nad polem wiadomości.
3. Kliknij przycisk **Push Story**. W trybie **Natural** pojawia się komunikat "The next time a character responds, they will push the story forward naturally!" W trybie **Random Event** komunikat kończy się słowem "randomly!".
4. Wyślij kolejną wiadomość albo wygeneruj nową odpowiedź.
5. AI pisze tę jedną odpowiedź z uwzględnieniem popchnięcia fabuły.
6. Po tej odpowiedzi przycisk **Push Story** wyłącza się sam.

Jeśli przed wysłaniem wiadomości zmienisz zdanie, kliknij przycisk **Push Story** ponownie, żeby go wyłączyć. Pojawia się wtedy komunikat "Push Story disarmed."

Przycisk **Push Story** jest niedostępny w trakcie generowania odpowiedzi. Poczekaj, aż bieżąca odpowiedź się skończy, i dopiero wtedy uzbrój przycisk.

## Tryby Natural i Random Event

Przycisk **Push Story** ma dwa tryby. Tryb wybiera się na karcie **Narrative Director** w panelu **Chat Settings**. Od wyboru zależy rodzaj popchnięcia fabuły.

Dostępne tryby:

- **Natural**: popycha istniejącą fabułę do przodu. AI rozwija wątki, które już są w historii.
- **Random Event**: dorzuca wiarygodną niespodziankę. AI wprowadza nowy zwrot akcji, ale taki, który pasuje do sceny.

Domyślny jest tryb **Natural**. Żeby go zmienić, otwórz panel **Chat Settings**, przejdź do sekcji **Agents**, znajdź kartę **Narrative Director** i kliknij wybrany tryb.

Podpowiedź przy przycisku **Push Story** mówi, który tryb jest uzbrojony. W trybie **Natural** brzmi ona **Arm a natural Narrative Director push for the next response.** W trybie **Random Event** – **Arm a random Narrative Director event for the next response.**

## Secret Plot

**Secret Plot** to ukryty, długofalowy wątek fabularny twojego roleplayu. AI prowadzi wtedy sekretny plan na dalszy ciąg historii. Plan trafia do promptu (tekstu, który Marinara wysyła do AI), ale pozostaje przed tobą ukryty, dopóki go nie odsłonisz. Domyślnie funkcja jest wyłączona.

Przycisk **Push Story** działa raz, a **Secret Plot** – przez wiele odpowiedzi. W miarę trwania czatu agent aktualizuje ukryty plan w stałych odstępach.

### Włączanie funkcji Secret Plot

1. Otwórz panel **Chat Settings** i przejdź do sekcji **Agents**.
2. Znajdź kartę **Narrative Director**.
3. Włącz przełącznik **Secret Plot**. Jego opis brzmi "Maintain a hidden long-term arc for this roleplay."

### Run Interval

Po włączeniu funkcji **Secret Plot** pojawia się pole **Run Interval** (odstęp między uruchomieniami). Decyduje ono o tym, ile wiadomości typu user i assistant mija między kolejnymi aktualizacjami ukrytego wątku.

Domyślna wartość to 8. Można wpisać dowolną liczbę całkowitą od 1 do 100. Im mniejsza liczba, tym częstsze aktualizacje planu. Im większa, tym rzadsze.

### Odsłanianie i edycja ukrytego wątku

Pod polem **Run Interval** znajduje się panel **Secret plot**. Służy on do podglądu i zmiany ukrytego planu.

Kliknij przycisk odsłaniania, żeby zobaczyć wątek. Jeśli wątek już istnieje, przycisk nosi nazwę **Reveal spoilers**, a jeśli AI jeszcze go nie napisała – **Reveal empty arc**. Kliknij przycisk **Hide spoilers**, żeby znowu go ukryć. Przy ukrytym wątku panel pokazuje napis "Spoilers hidden".

Po odsłonięciu wątku można edytować te pola:

- **Arc description**: cała ukryta linia fabularna.
- **Protagonist arc**: dokąd zmierza twoja postać.
- **Character arc**: dokąd zmierza jedna wybrana postać z roleplayu.
- **Completed**: pole wyboru, które zaznaczasz po zakończeniu wątku.

Po edycji pola zapisz zmiany przyciskiem zapisu.

Żeby wyrzucić bieżący wątek i kazać AI napisać nowy, kliknij przycisk **Regenerate**. Prośbę o potwierdzenie pokazuje okno "Regenerate Secret Plot". Wybierz przycisk **Regenerate**, żeby zastąpić wątek, albo **Keep Current Arc**, żeby zrezygnować.

### Wątek zostaje przy agencie

Ukryty wątek jest zapisany razem z agentem **Narrative Director**. Wyczyszczenie uruchomień agentów i pamięci czatu go nie kasuje. Wątek znika dopiero wtedy, gdy usuniesz agenta **Narrative Director** z czatu. Przy usuwaniu agenta pojawia się ostrzeżenie, że ukryty wątek zostanie skasowany bezpowrotnie.

### Prompt funkcji Secret Plot

**Secret Plot Prompt** (prompt funkcji Secret Plot) zawiera instrukcje, według których agent Narrative Director pisze i aktualizuje ukryty wątek. Wbudowany prompt przedstawia każdy wątek jako zagadkę do odkrycia. Pasuje to do przygód i intryg, ale może nie pasować do historii napędzanej przez postacie.

Aby użyć własnych instrukcji, wykonaj te kroki.

1. Otwórz panel **Agents** i edytuj agenta **Narrative Director**.
2. W sekcji **Secret Plot** kliknij **Copy default to edit** (skopiowanie domyślnego tekstu do edycji).
3. Zmień tekst, a potem zapisz agenta.

Kliknij **Reset to default** (przywrócenie domyślnego), żeby wrócić do wbudowanego promptu, a potem zapisz agenta.

Zachowaj format odpowiedzi JSON na końcu promptu: obiekt `overarchingArc` z polami `description`, `protagonistArc`, opcjonalnym `characterArc` oraz `completed`. Bez niego wątku nie da się odczytać.

Ten prompt jest zapisywany w agencie, więc dotyczy każdego czatu, który korzysta z tego agenta Narrative Director.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Tryb Roleplay: pierwsze kroki](getting-started.md)
- [Sterowane generowanie i Impersonate](../chats/guided-and-impersonate.md)
