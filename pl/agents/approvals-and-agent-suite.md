# Zatwierdzanie zapisów agentów i Agent Suite

Ten przewodnik wyjaśnia, jak sprawdzać i nadzorować to, co agenci (niewielcy pomocnicy AI pracujący obok twoich odpowiedzi) zapisują w trakcie czatu. Opisuje przełącznik **Review Agent Outputs** (sprawdzanie wyników agentów), dwa okna weryfikacji, edytor **Agent Suite** oraz panel **Cached prompt injections**.

## Review Agent Outputs

Część agentów chce zapisywać w czacie nowe dane. Agent lorebooków potrafi dodać wpisy do lorebooka (zbioru faktów o twoim świecie). Agent podsumowań potrafi zapisać podsumowanie czatu. Domyślnie niektóre z tych zapisów trafiają do danych automatycznie. Przełącznik **Review Agent Outputs** sprawia, że każdy zapis możesz najpierw obejrzeć.

Gdzie go znaleźć:

1. Otwórz czat, który chcesz nadzorować.
2. Otwórz **Chat Settings** (ustawienia czatu).
3. Przewiń do sekcji **Agents**.
4. Włącz przełącznik **Review Agent Outputs**.

Kiedy przełącznik **Review Agent Outputs** jest włączony, aktualizacje lorebooków, aktualizacje podsumowań i inne wyniki agentów zapisujących dane czekają na twoją zgodę. Kiedy jest wyłączony, aktualizacje lorebooków i podsumowań mogą zapisywać się automatycznie.

Zmiany w karcie postaci to osobny przypadek. Zawsze wymagają twojej zgody, nawet przy wyłączonym przełączniku **Review Agent Outputs**. Tego zabezpieczenia nie da się wyłączyć.

## Okno Agent Write Approval

Kiedy przełącznik **Review Agent Outputs** jest włączony, a agent proponuje zapis do lorebooka lub podsumowania, otwiera się okno weryfikacji. Nosi ono tytuł **Review Lorebook Update** albo **Review Summary Update**, zależnie od rodzaju zapisu.

W oknie widać:

- Nazwę agenta, który przygotował propozycję.
- Pole **Proposed Text** z tekstem propozycji, który można poprawić przed zapisem.
- Przy zapisach do lorebooka krótkie przypomnienie, żeby każdy wpis trzymać pod nagłówkiem `###`.

Na dole okna czekają trzy możliwości:

- **Accept**: zapisuje tekst w czacie razem z wprowadzonymi poprawkami.
- **Regenerate**: uruchamia ponownie tego jednego agenta po nową propozycję.
- **Discard**: odrzuca propozycję bez zapisywania.

Jeśli czeka więcej propozycji, okno pokazuje, ile ich zostało w kolejce. Po obsłużeniu bieżącej otwiera się ponownie dla następnej.

## Weryfikacja zmian w karcie postaci

Agent **Card Evolution Auditor** potrafi zaproponować zmiany w polach karty postaci na podstawie tego, co wydarzyło się w trakcie roleplayu. Wbudowane narzędzie `update_about_me` trybu Conversation również może zaproponować zmianę publicznego opisu About Me. Żadna z tych dróg nie edytuje karty samodzielnie: obie otwierają okno **Review Character Card Updates**, a decyzja należy do ciebie.

Okno wypisuje wszystkie proponowane zmiany. Przy każdej z nich widać:

- Pole karty, którego dotyczy (na przykład opis, osobowość albo wygląd).
- Krótkie uzasadnienie zmiany, o ile agent je podał.
- Blok **Before** z obecnym tekstem.
- Pole **After** z nowym tekstem. Ten tekst możesz poprawić przed zatwierdzeniem.

Do dyspozycji są takie działania:

- **Approve**: wprowadza zmiany. Liczba na przycisku mówi, ile zmian zostanie wprowadzonych. Zatwierdzenie podnosi numer wersji postaci i zapisuje wpis w historii wersji.
- **Regenerate**: uruchamia agenta ponownie po nowy zestaw propozycji.
- **Reject**: odrzuca propozycje i zostawia kartę bez zmian.

Czasem karta zmienia się już po tym, jak agent przygotował propozycję. Wtedy aplikacja oznacza taką zmianę jako **stale** (nieaktualna) i ją przygasza. Jeśli są nieaktualne zmiany, pojawia się przycisk **Override stale** wraz z ich liczbą. Skorzystaj z niego tylko wtedy, gdy mimo wszystko chcesz zachować ten tekst. Aplikacja najpierw prosi o potwierdzenie. Nieaktualny tekst zostaje potem dopisany do pola, zamiast zastąpić tekst, który już do niego nie pasuje.

## Edytor Agent Suite i przepisywanie z pomocą AI

W panelu **Agent Suite** widać wszystko, co zapisali agenci działający w tym czacie, i można to od razu edytować. Chodzi o dane trackerów (agentów śledzących stan) – na przykład bieżącą scenę, obecne postacie i statystyki persony – oraz o zapisane wyniki własnych agentów. Błędne imię, złą wartość statystyki czy pogmatwany zapisany tekst da się poprawić ręcznie albo z pomocą AI.

Jak go otworzyć:

1. Otwórz **Chat Settings**.
2. Przewiń do sekcji **Agents**.
3. Kliknij przycisk **Agent Suite**.

Po lewej stronie jest lista agentów aktywnych w tym czacie. Wybierz jednego, żeby zobaczyć, co zapisał. Po prawej pojawiają się bloki do edycji. Dzielą się na sekcje **Stored Memory** (zapisana pamięć), **Tracker Data** (tylko dla trackerów) oraz **Recent Outputs** (tylko dla własnych agentów). Agenci, którzy nie śledzą danych, mają wyłącznie sekcję **Stored Memory**.

Każdy blok to edytor tekstu albo edytor formatu JSON. Po zmianie bloku:

- Kliknij przycisk **Save**, żeby zachować poprawkę.
- Kliknij przycisk **Reset**, żeby cofnąć niezapisaną zmianę i wrócić do zapisanej wartości.

Blok może też przepisać za ciebie AI:

1. Kliknij przycisk **AI Edit** przy bloku, który chcesz zmienić.
2. Aby objąć zmianą tylko fragment tekstu, najpierw zaznacz go w edytorze. Bez zaznaczenia przepisany zostaje cały blok.
3. Wpisz polecenie, na przykład "fix the garbled character names, she is called Mira".
4. Opcjonalnie: kliknij przycisk **Add Context**, żeby dołączyć karty postaci albo wpisy z lorebooków. Dzięki temu AI lepiej rozumie, co oznaczają dane.
5. Wybierz połączenie (dostawcę AI i model), które wykona przepisanie.
6. Kliknij przycisk **Rewrite**.

Przepisany tekst trafia do bloku jako niezapisana wersja robocza. Przejrzyj go, a potem kliknij przycisk **Save**, żeby go zachować, albo **Reset**, żeby go odrzucić.

Kilka uwag:

- Jeśli agenci wciąż pracują nad tym czatem, zapisywanie jest wstrzymane do czasu, aż skończą.
- Sekcja **Stored Memory** ma jeden przycisk **Clear memory**. Pojawia się tylko wtedy, gdy agent ma zapisane dane. Usuwa naraz wszystko, co ten agent zapisał dla tego czatu, i tej operacji nie da się cofnąć. Aplikacja najpierw prosi o potwierdzenie.
- W przypadku agenta **Narrative Director** zapisane spoilery są ukryte. Użyj przycisku **Reveal spoilers**, żeby je zobaczyć i edytować.

## Panel Cached prompt injections

Zanim powstanie odpowiedź, część agentów zapisujących dane dopisuje tekst do promptu (tekstu, który Marinara wysyła do AI). Robią tak zwłaszcza **Prose Guardian**, **Narrative Director** oraz własni agenci od wstawiania tekstu. Panel **Cached prompt injections** pokazuje ten dopisany tekst na potrzeby diagnostyki. Znajdziesz go w zakładce **Injections** (wstawienia do promptu) w sekcji **Agent activity** (aktywność agentów) czatu Roleplay. Zakładka jest widoczna, gdy włączony jest **Debug mode** (tryb debugowania). Zobacz [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md#agent-activity). Panel obejmuje najnowszą odpowiedź.

Przy każdym zapisanym wstawieniu możesz:

- Rozwinąć je, żeby przeczytać i poprawić tekst.
- Kliknąć ikonę **Save**, żeby zachować poprawkę.
- Kliknąć ikonę **Re-run**, żeby ten jeden agent napisał wstawienie od nowa.

Wstawień agentów **Knowledge Retrieval** i **Knowledge Router** nie da się uruchomić ponownie z tego panelu. Poprawki i ponowne uruchomienia zadziałają tylko wtedy, gdy wygenerujesz tę samą odpowiedź jeszcze raz. Ponowne uruchomienie korzysta z pierwotnej historii czatu z tamtego momentu, a nie z nowszych wiadomości.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](built-in-agents.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
