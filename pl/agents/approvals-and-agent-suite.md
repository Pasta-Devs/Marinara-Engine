# Zatwierdzanie zapisów agentów i Agent Suite

Agenci mogą zapisywać dane w twoim czacie: wpisy lorebooków, podsumowania i zmiany w kartach postaci. Ten przewodnik pokazuje, jak sprawdzać te zapisy, zanim zostaną zapisane, oraz jak w **Agent Suite** przeglądać i poprawiać to, co agenci przechowują.

## Sprawdzanie zapisów agentów przed zapisem

Domyślnie część zapisów agentów zapisuje się sama. Przełącznik **Review Agent Outputs** (przeglądanie wyników agentów) sprawia, że każdy z nich czeka na twoją zgodę.

1. Otwórz czat i kliknij **Chat Settings** (ustawienia czatu).
2. Przewiń do sekcji **Agents**.
3. W czacie Roleplay otwórz **Trackers Control** (sterowanie trackerami). W trybie Game Mode pomiń ten krok.
4. Włącz **Review Agent Outputs**.

Kiedy przełącznik jest włączony, aktualizacje lorebooków, aktualizacje podsumowań i inne wyniki agentów zapisujących dane, które podlegają sprawdzeniu, czekają na ciebie. Kiedy jest wyłączony, aktualizacje lorebooków i podsumowań mogą zapisywać się automatycznie.

Zmiany w karcie postaci zawsze najpierw wymagają twojej zgody, nawet przy wyłączonym **Review Agent Outputs**. Tego zabezpieczenia nie da się wyłączyć.

### Sprawdzanie aktualizacji lorebooka lub podsumowania

Kiedy agent proponuje zapis, otwiera się okno zatytułowane **Review Lorebook Update** albo **Review Summary Update**. Widać w nim nazwę agenta i pole **Proposed Text**, które można edytować. Przy zapisach do lorebooka okno przypomina też, żeby każdy wpis trzymać pod nagłówkiem `###`.

- **Accept** zapisuje tekst razem z twoimi poprawkami.
- **Regenerate** uruchamia ponownie tylko tego agenta po nową propozycję.
- **Discard** odrzuca propozycję bez zapisywania.

Jeśli czeka więcej propozycji, okno pokazuje, ile ich jest. Po zakończeniu bieżącej otwiera się ponownie dla następnej.

Agent ze zdolnością **Create character cards** (tworzenie kart postaci) może też zaproponować nową kartę postaci. Otwiera się wtedy okno przeglądu z tekstem karty. Nic nie zostaje zapisane, dopóki nie zaakceptujesz.

### Sprawdzanie aktualizacji karty postaci

Agent **Card Evolution Auditor** proponuje zmiany w karcie postaci na podstawie tego, co wydarzyło się w roleplayu. W trybie Conversation wbudowane narzędzie `update_about_me` również może zaproponować zmianę publicznego opisu About Me. Żadne z nich nie edytuje karty samodzielnie. Oba otwierają okno **Review Character Card Updates**.

Przy każdej proponowanej zmianie okno pokazuje pole karty, którego dotyczy, krótkie uzasadnienie, jeśli agent je podał, blok **Before** z obecnym tekstem i pole **After**, które można edytować.

- **Approve** wprowadza zmiany. Liczba na przycisku mówi, ile zmian zostanie wprowadzonych. Zatwierdzenie podnosi numer wersji postaci i zapisuje wpis w historii wersji.
- **Regenerate** uruchamia agenta ponownie po nowe propozycje.
- **Reject** odrzuca je bez zmieniania karty.

Jeśli karta zmieniła się po tym, jak agent przygotował propozycję, zmiana zostaje oznaczona jako nieaktualna i przygaszona. Pojawia się wtedy przycisk **Override stale** z liczbą takich zmian. Użyj go tylko wtedy, gdy nadal chcesz zachować ten tekst. Marinara prosi o potwierdzenie, a potem dopisuje nieaktualny tekst do pola, zamiast zastępować tekst, który już do niego nie pasuje.

## Przeglądanie i edycja tego, co zapisali agenci

**Agent Suite** pokazuje wszystko, co zapisali agenci w tym czacie: dane trackerów, takie jak bieżąca scena, obecne postacie i statystyki persony, oraz zapisane wyniki własnych agentów. Użyj go, żeby poprawić błędne imię, złą wartość statystyki albo pogmatwany tekst.

1. Otwórz **Chat Settings** i przewiń do sekcji **Agents**.
2. Kliknij **Agent Suite**.
3. Wybierz agenta z listy po lewej.

Po prawej stronie widać bloki do edycji, w maksymalnie trzech grupach: **Stored Memory** (zapisana pamięć), **Tracker Data** (tylko agenci trackerów) i **Recent Outputs** (tylko własni agenci). Agenci, którzy nie śledzą danych, mają tylko **Stored Memory**.

Każdy blok to edytor tekstu albo JSON. Bloki JSON mają numery wierszy i od razu zgłaszają niepoprawny JSON. **Save** pozostaje wyłączony, dopóki JSON nie da się sparsować. Aby przeszukać wszystkie dane trackerów albo edytować je jako pola, kliknij **Open in State Editor** w nagłówku **Tracker Data**. Zobacz [State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

Po zmianie bloku kliknij **Save**, żeby go zachować, albo **Reset**, żeby wrócić do zapisanej wartości.

### Przepisywanie bloku przez AI

1. Kliknij **AI Edit** przy bloku.
2. Aby zmienić tylko jego część, najpierw zaznacz ten tekst. Bez zaznaczenia przepisany zostaje cały blok.
3. Wpisz instrukcję, na przykład "fix the garbled character names, she is called Mira".
4. Opcjonalnie: kliknij **Add Context**, żeby dołączyć karty postaci albo wpisy lorebooków. Dzięki temu AI wie, co oznaczają dane.
5. Wybierz połączenie (usługę AI i model), które wykona przepisanie.
6. Kliknij **Rewrite**.

Wynik trafia do bloku jako niezapisana wersja robocza. Przejrzyj go, a potem kliknij **Save** albo **Reset**.

- Jeśli agenci wciąż pracują nad tym czatem, zapisywanie czeka, aż skończą.
- **Clear memory** pojawia się w **Stored Memory** tylko wtedy, gdy agent ma zapisane dane. Usuwa naraz wszystko, co ten agent zapisał dla tego czatu, i nie da się tego cofnąć. Marinara najpierw prosi o potwierdzenie.
- W przypadku agenta **Narrative Director** zapisane spoilery są ukryte. Użyj **Reveal spoilers**, żeby je zobaczyć i edytować.

## Podgląd panelu Cached prompt injections

Zanim powstanie odpowiedź, część agentów zapisujących dane dopisuje tekst do promptu (tekstu, który Marinara wysyła do AI). Robią tak zwłaszcza **Prose Guardian**, **Narrative Director** i własni agenci od wstawiania tekstu. Panel **Cached prompt injections** pokazuje ten tekst dla najnowszej odpowiedzi. To widok do diagnostyki.

Zanim zaczniesz: włącz **Debug mode** (tryb diagnostyczny). Zobacz [Agenci: pomocnicy AI w czatach](agents-overview.md#tell-whether-an-agent-ran). W czacie Roleplay otwórz zakładkę **Injections** (wstawienia do promptu) w **Agent activity** (aktywność agentów). Zobacz [Agent activity](../roleplay/getting-started.md#agent-activity).

Każde wstawienie możesz rozwinąć, żeby przeczytać i poprawić tekst, kliknąć ikonę **Save**, żeby zachować poprawkę, albo kliknąć ikonę **Re-run**, żeby ten agent napisał je od nowa.

Wstawień agentów **Knowledge Retrieval** i **Knowledge Router** nie da się tutaj uruchomić ponownie. Poprawki i ponowne uruchomienia zadziałają tylko wtedy, gdy wygenerujesz tę samą odpowiedź jeszcze raz. Ponowne uruchomienie korzysta z historii czatu z tamtego momentu, a nie z nowszych wiadomości.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
