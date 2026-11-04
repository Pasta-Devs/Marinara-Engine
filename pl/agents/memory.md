# Memory Recall i podsumowania czatu

Każdy model AI czyta naraz tylko ograniczoną ilość tekstu. Ten limit nazywa się oknem kontekstu. W długim czacie najstarsze wiadomości wypadają poza to okno i AI o nich zapomina. Marinara Engine (dalej: Marinara) ma kilka sposobów, żeby przywrócić tę historię. Ten przewodnik pokazuje, jak włączyć każdy z nich i co zrobić, gdy nie działa.

## Którą funkcję pamięci wybrać?

Zacznij od **Memory Recall** (wyszukiwanie w dawnych wiadomościach). Działa bez dodatkowej konfiguracji, bo Marinara może korzystać z wbudowanego modelu embeddingów na twoim komputerze. Podsumowania dodaj, gdy czaty zrobią się bardzo długie.

| Funkcja | Co robi | Gdzie działa |
| --- | --- | --- |
| **Memory Recall** | Przeszukuje starsze wiadomości pod kątem fragmentów związanych z twoją ostatnią wiadomością i dodaje je do promptu. | We wszystkich trybach |
| **Chat Summary** (podsumowanie czatu) | Zastępuje stare wiadomości krótkimi streszczeniami. | Roleplay |
| **Automatic Summarization** (automatyczne podsumowywanie) | Podsumowuje każdy dzień, a potem każdy tydzień. Zawsze włączone. | Conversation |
| **Advanced Memory Recall** (zaawansowane przywoływanie pamięci) | Wspólnie zarządza bieżącą historią, podsumowaniami scen i przywołanymi fragmentami. Opcjonalne. | Roleplay i Game Mode |

Memory Recall i podsumowania robią co innego i mogą działać jednocześnie. Tryb Game Mode ma Memory Recall oraz opcjonalnie Advanced Memory Recall (zobacz [W trybie Game Mode](#in-game-mode)). Nie ma własnej funkcji podsumowań.

## Memory Recall

Memory Recall korzysta z embeddingów. Embedding to liczbowy odcisk palca znaczenia wiadomości. Marinara zapisuje wcześniejsze wiadomości w małych grupach, nazywanych fragmentami. Porównuje odcisk palca nowej wiadomości z zapisanymi odciskami i dodaje do promptu najbliższe fragmenty.

### Włączanie Memory Recall

1. Otwórz czat i kliknij **Chat Settings** (ustawienia czatu).
2. Znajdź sekcję **Memory Recall**.
3. Włącz **Enable Memory Recall** (włączenie Memory Recall).

Ustawienie działa osobno dla każdego czatu. Jest domyślnie włączone w czatach Conversation oraz w czatach Roleplay i Game, które mają aktywną scenę. W pozostałych czatach jest domyślnie wyłączone. Wyłączenie zatrzymuje przywoływanie, ale nie usuwa zapisanych wspomnień.

Jeśli to nie zadziałało: Memory Recall potrzebuje źródła embeddingów (następna sekcja). Jeśli żadnego nie ustawisz, Marinara używa swojego wbudowanego modelu, więc większość osób może pominąć tę sekcję. Sprawdź, czy sekcja **Memory Recall** w ogóle się pojawia. Niektóre kontenerowe wersje aplikacji Marinara Engine, znane jako Marinara Lite, całkowicie ją wyłączają.

### Ustawianie źródła embeddingów (opcjonalnie)

Memory Recall potrzebuje modelu, który tworzy odciski palca. Jeśli nic nie ustawisz, Marinara używa wbudowanego modelu embeddingów (zobacz niżej), co dla większości osób jest najprostszym rozwiązaniem. Żeby zamiast tego korzystać z usługi, ustaw ją w koncie, a nie w ustawieniach czatu.

Zanim zaczniesz: potrzebujesz konta, które oferuje embeddingi. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

1. Otwórz **Connections** (Połączenia) i przejdź do edycji konta.
2. Znajdź sekcję **Semantic search (embeddings)** (wyszukiwanie semantyczne).
3. Wpisz nazwę modelu embeddingów, na przykład `text-embedding-3-small`.
4. Opcjonalnie: ustaw **Embedding endpoint URL** (adres URL endpointu embeddingów), żeby zmienić adres.
5. Opcjonalnie: użyj **Embedding provider** (dostawca embeddingów), żeby pożyczyć klucz i adres z innego konta. **Same as this provider** (ten sam dostawca) zachowuje własny klucz i adres tego konta.

Część usług nie oferuje embeddingów. Marinara prosi wtedy o wybranie osobnego konta do embeddingów, na przykład konta zgodnego z OpenAI, konta Google albo wbudowanego modelu.

Żeby używać jednego źródła wszędzie, wybierz je w polu **Embeddings** (embeddingi) w **Connections → Defaults** (połączenia, ustawienia domyślne). Korzystają z niego konta, które nie mają własnego modelu embeddingów. Własne ustawienie konta nadal ma pierwszeństwo.

Gdy nie ma konta do embeddingów ani domyślnego ustawienia **Embeddings**, Marinara przechodzi na wbudowany model embeddingów. Pobiera go jeden raz i uruchamia na twoim komputerze, bez klucza API. Zobacz [Konfiguracja modelu wbudowanego](../connections/local-model.md).

To samo ustawienie napędza wyszukiwanie semantyczne w lorebookach, więc konfigurujesz je raz dla obu funkcji.

### Przeglądanie zapisanych wspomnień i zarządzanie nimi

1. Otwórz **Chat Settings → Memory Recall**.
2. Kliknij **Access memories for this chat** (dostęp do wspomnień tego czatu). Otworzy się okno **Memories for This Chat** (wspomnienia tego czatu). Przy włączonym Advanced Memory przeglądarka pozostaje w panelu bocznym Roleplay.

Okno pokazuje liczbę zapisanych fragmentów i przybliżoną liczbę tokenów. Każda karta fragmentu pokazuje zakres dat, liczbę wiadomości, czas utworzenia i status.

| Status | Znaczenie |
| --- | --- |
| **Vectorized** | Odcisk palca jest gotowy i można go przeszukiwać. |
| **Waiting for vector** | Odcisk palca dopiero powstaje. |
| **Embedding unavailable** | Żadne źródło embeddingów nie mogło go zbudować. |

Na pasku narzędzi są ikony eksportu, importu, przebudowy i wyczyszczenia wspomnień.

- Ikona kosza przy fragmencie otwiera okno **Forget Memory**. Potwierdź przyciskiem **Forget**.
- Ikona wyczyszczenia wszystkiego otwiera okno **Clear Memories**. Potwierdź przyciskiem **Clear**. Usuwa to wspomnienia do przywoływania, a nie wiadomości czatu.
- Ikona odświeżania przebudowuje każdy fragment z bieżących wiadomości. Użyj jej po zmianie modelu embeddingów.
- Eksport zapisuje plik `.marinara.json`. Import przyjmuje pliki `.json` lub `.marinara` i dołącza ich zawartość.

### Jak zachowuje się Memory Recall

- Marinara zapisuje fragmenty w tle zawsze, gdy istnieje źródło embeddingów, nawet przy wyłączonym **Enable Memory Recall**. Przełącznik decyduje tylko o tym, czy wspomnienia trafiają do promptu.
- Fragment powstaje dopiero z co najmniej 5 nowych wiadomości.
- Słabe dopasowania są pomijane, więc przywoływanie może nic nie zwrócić, nawet gdy wspomnienia istnieją. Na przywołane wspomnienia przypada tylko niewielka część promptu.
- Po zmianie modelu embeddingów stare fragmenty przestają pasować. Przebuduj je.
- Usunięcie wiadomości czatu usuwa też jego fragmenty.

<a id="chat-summary-roleplay"></a>

## Chat Summary (Roleplay)

Chat Summary ściska starsze wiadomości w krótkie streszczenia, nazywane wpisami podsumowania. Każdy wpis może napisać AI albo ty, a każdy da się włączyć i wyłączyć. Funkcja jest przeznaczona wyłącznie dla czatów Roleplay.

Otwórz **Chat Settings** i rozwiń sekcję **Chat Summary** pod **Lorebooks**. Na komputerze możesz wydzielić ją do osobnego okna. Zobacz [Panel **Chat Settings** – przegląd](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Tworzenie wpisu podsumowania

1. W sekcji **Summary Scope** (zakres podsumowania) wybierz **Last** (ostatnie), żeby objąć najnowsze wiadomości, albo **Range** (zakres), żeby wskazać zakres wiadomości.
2. Kliknij **Generate** (generuj), żeby AI napisało wpis, albo **Write** (napisz), żeby wpisać go samodzielnie.

Każdy wpis pokazuje tytuł, zakres źródłowy lub liczbę wiadomości oraz szacowaną liczbę tokenów. Możesz go włączyć lub wyłączyć, rozwinąć, zmienić przyciskiem **Edit** (edytuj) albo usunąć przyciskiem **Delete** (usuń). **Show Inactive** (pokaż nieaktywne) i **Hide Inactive** (ukryj nieaktywne) zmieniają to, co pokazuje lista. **Activate All** (aktywuj wszystkie) i **Deactivate All** (dezaktywuj wszystkie) przełączają naraz wszystkie wpisy.

Żeby zmienić kilka wpisów, zaznacz je (na komputerze kliknij z wciśniętym klawiszem Shift, żeby zaznaczyć zakres), a potem użyj **Enable selected** (włącz zaznaczone) lub **Disable selected** (wyłącz zaznaczone).

Jeśli włączone jest **Review Agent Outputs** (przeglądanie wyników agentów), podsumowania AI czekają na twoje zatwierdzenie. Zobacz [Zatwierdzanie zapisów agentów i Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

Panel **Automatic Summaries** (automatyczne podsumowania) dba o aktualność podsumowań w trakcie rozmowy.

1. Włącz **Enabled** (włączone).
2. W polu **Every** (co) ustaw, ile wiadomości użytkownika mija między podsumowaniami. Domyślnie jest to 5, a zakres wynosi od 1 do 200.
3. Opcjonalnie: kliknij **Backfill Summary** (uzupełnienie podsumowania), żeby podsumować starszy czat, który nigdy nie miał podsumowań. Pojawi się pasek postępu. Kliknij **Stop** (zatrzymaj), żeby przerwać wcześniej.

### Prompt podsumowania, dostawca i rozmiar wyniku

- **Summary Prompt** (prompt podsumowania): kliknij **Edit**, żeby zmienić instrukcje, których używa AI. Kliknij **Templates** (szablony), żeby zarządzać zapisanymi promptami przyciskami **New template** (nowy szablon), **Duplicate** (duplikuj), **Edit** i **Delete**. Szablony są globalne: wybranie jednego w czacie Roleplay zmienia prompt we wszystkich czatach Roleplay.
- **Summary Provider** (dostawca podsumowań): konto, które pisze podsumowania. W pierwszej kolejności używa domyślnego konta agentów, a w drugiej własnego konta czatu.
- **Maximum output size** (maksymalny rozmiar wyniku): jak długie może być podsumowanie. Domyślnie jest to 4096 tokenów, a zakres wynosi od 1 do 32768.

### Opcje wyświetlania

- **Hide summarised messages** (ukrywanie podsumowanych wiadomości): ukrywa surowe wiadomości, gdy obejmie je podsumowanie. Domyślnie wyłączone.
- **Recent message tail** (końcówka najnowszych wiadomości): określa, ile najnowszych wiadomości pozostaje widocznych nawet przy włączonym ukrywaniu. Domyślnie jest to 10. Działa każda liczba całkowita od 0 w górę. Wartość 0 ukrywa całą podsumowaną porcję. Wyższe wartości zwiększają rozmiar i koszt promptów.
- **Collapse hidden messages** (zwijanie ukrytych wiadomości): zmienia wygląd ukrytych wiadomości w zapisie czatu.

### Scalone czaty grupowe

W scalonym czacie grupowym jedna odpowiedź przemawia w imieniu wszystkich postaci. Część wpisu napisana dla określonych postaci, na przykład `{{#if char == "Kaito"}}…{{/if}}`, jest zachowywana dla każdej postaci, której dotyczy, i oznaczana informacją, kto ją zna, na przykład "known only to Kaito". Części, które dostaje tylko **Narrator** (narrator) z Advanced Memory, pozostają pominięte. W czatach grupowych, w których postacie odpowiadają po kolei, oraz w czatach z jedną postacią każda postać czyta wpisy tak jak dotychczas, a Narrator czyta każdą część.

## Automatic Summarization (Conversation)

Czaty Conversation podsumowują każdy dzień kalendarzowy, a zakończone tygodnie łączą w podsumowanie tygodnia. Prompt zawiera potem tylko podsumowania tygodni, podsumowania dni z bieżącego tygodnia i dzisiejsze wiadomości. Działa to samodzielnie i nie da się tego wyłączyć.

### Edycja podsumowań

1. Otwórz czat Conversation i kliknij **Chat Settings**.
2. Znajdź sekcję **Automatic Summarization**.
3. Kliknij **Edit Summaries** (edycja podsumowań).

Okno pokazuje najpierw tygodnie, a potem dni, których jeszcze nie zwinięto w tydzień. Rozwiń wpis, żeby edytować jego tekst w polu **Summary** (podsumowanie) i wiersze **Key Details** (kluczowe szczegóły).

### Ustawianie, kiedy kończy się dzień

- **Day Rollover Hour** (godzina zmiany dnia): godzina, o której na potrzeby podsumowań zaczyna się nowy dzień. Domyślnie jest to 4 AM. Możesz wybrać dowolną godzinę od 12 AM do 11 AM. Wiadomości sprzed tej godziny liczą się do dnia poprzedniego. Wybierz porę, o której nie piszesz. Jeśli zmienisz to ustawienie, gdy podsumowania już istnieją, Marinara ostrzega, że starsze podsumowania powstały przy poprzedniej godzinie.
- **Recent Message Tail** (końcówka najnowszych wiadomości): ile dzisiejszych najnowszych wiadomości zostaje w dosłownym brzmieniu po podsumowaniu. Domyślnie jest to 10. Wyższe wartości zwiększają rozmiar i koszt promptów.

### Uzupełnianie brakujących dni

Dzień może nie mieć podsumowania, na przykład po imporcie starego czatu. W oknie panel **Missing Summaries** (brakujące podsumowania) ma przycisk **Backfill** (uzupełnij). Ponawia on próbę dla najwyżej 14 ostatnich dni naraz. Zmiana modelu podsumowań nie przepisuje istniejących wpisów dziennych ani tygodniowych.

<a id="advanced-memory-recall-roleplay-and-game-mode"></a>

## Advanced Memory Recall (Roleplay i Game Mode)

Advanced Memory Recall to opcjonalny tryb, który wspólnie zarządza oknem bieżącej historii, podsumowaniami ciągłości i starymi fragmentami. Dzieli czat na sceny, podsumowuje każdą zakończoną scenę i przywołuje sceny oraz dokładne wiadomości, które mają znaczenie dla danej odpowiedzi. Działa bez przełącznika Agents i nie wymaga pobieranego agenta.

### Włączanie

1. Otwórz **Chat Settings → Memory Recall**.
2. Włącz **Advanced Memory Recall**. Możesz też włączyć **Automatic context and memory handling** (automatyczna obsługa kontekstu i pamięci) pod sekcją Agents w kreatorze konfiguracji Roleplay.
3. Ustaw **Maximum allowed context before compression (tokens)** (maksymalny kontekst przed kompresją) w granicach okna kontekstu twojego modelu.
4. Ustaw **Summary and recall budget (tokens)** (budżet podsumowań i przywoływania) w ramach tego limitu.
5. Opcjonalnie: wybierz **Helper model** (model pomocniczy).

W czacie, który ma już historię, najpierw kliknij **Prepare existing history** (przygotuj dotychczasową historię), opisane niżej. Ustawienia i postęp są widoczne zarówno w kreatorze, jak i w panelu bocznym **Chat Settings**, na komputerze i telefonie. Przeglądarka archiwum pozostaje w panelu bocznym.

### Ustawienia

| Ustawienie | Domyślnie | Co robi |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65 000 | Gdy wysyłany prompt osiągnie ten rozmiar, starszy kontekst zostaje odcięty i podsumowany do przywoływania. |
| **Summary and recall budget (tokens)** | 6 500 | Jaka część kontekstu przypada na wspomnienia. Zalecane jest co najmniej 10% maksimum. |
| **Helper model** | Konto agentów, potem konto czatu | Podejmuje decyzje o scenach, pisze podsumowania i dba o ciągłość. |
| **Maximum recalled scenes** (maksymalna liczba przywołanych scen) | 3 | Górna granica liczby scen przywoływanych przy jednej odpowiedzi. 0 wyłącza opcjonalne przywoływanie scen. |
| **Moving context** (ruchomy kontekst) | Od 3 do 5 wiadomości | Liczba wiadomości w każdym przywołanym fragmencie. 0 dla obu wartości daje podsumowania bez fragmentów. |
| **Standalone scene check interval (messages)** (odstęp sprawdzania scen) | 5 | Ile nowych wiadomości mija między sprawdzeniami scen. |
| **Use Decision model** (używaj modelu decyzyjnego) | Wyłączone | Pozwala modelowi decyzyjnemu wykrywać końce scen i wybierać wspomnienia. |
| **Decide who sees new messages** (decydowanie, kto widzi nowe wiadomości) | Wyłączone | Tylko czaty grupowe, w których postacie odpowiadają po kolei. |
| **Character recollections** (osobiste wspomnienia postaci) | Wyłączone | Daje każdej postaci jej własne wspomnienie sceny. |

Domyślny budżet to 10% domyślnego maksimum. Późniejsza zmiana maksimum go nie zmienia. Limit obejmuje cały szacowany wysyłany prompt: instrukcje, wiadomości, przywołany kontekst, narzędzia i załączniki. Tokeny odpowiedzi i zapas bezpieczeństwa są liczone osobno. To szacunek, a nie dokładny pomiar tokenizera ani limit rozliczeniowy.

Wszystkie wywołania podsumowań pamięci używają **Chat Summary → Maximum output size**, z co najmniej 8 196 tokenami wyjściowymi, żeby zostawić miejsce na rozumowanie.

### Przygotowanie dotychczasowej historii

1. Kliknij **Prepare existing history**. Przed rozpoczęciem widać ustalone modele.
2. Poczekaj. Przygotowanie przetwarza starszą historię partiami i pokazuje bieżący etap.
3. Użyj **Cancel** (anuluj), żeby zatrzymać. Ukończona praca zostaje zachowana. Użyj **Resume** (wznów), żeby kontynuować, nawet po zamknięciu panelu, restarcie serwera lub aktualizacji aplikacji.

Nieudane wywołanie modelu zachowuje wcześniejszą poprawną pamięć i pokazuje błąd do ponowienia. Nie resetuj pamięci po błędzie: **Resume** wykorzystuje ukończone podsumowania. Ostatnia trwająca scena pozostaje otwarta i dostaje podsumowanie, gdy się zamknie.

Jeśli odzyskana historia zmieni scenę objętą ręczną poprawką, wyłącz tę pamięć, żeby zachować jej tekst do wglądu, albo ją usuń, a potem ponownie przygotuj historię. **Fix** (napraw) pomija taką scenę i pokazuje ją na liście, zamiast się zatrzymać.

Gałąź utworzona z przygotowanego czatu, na przykład przyciskiem **Branch from here** (utworzenie gałęzi stąd), zachowuje jego Advanced Memory. Gałąź utworzona w środku sceny ponownie otwiera tę scenę: jej stare podsumowanie zostaje odrzucone, a nowe powstaje, gdy scena się zamknie. Czat zaimportowany jako nowa gałąź jest przygotowywany jak zwykle.

<a id="fixing-memory-problems"></a>

### Naprawianie problemów z pamięcią

Gdy coś w pamięci czatu jest zepsute, na przycisku **Chat Settings** pojawia się stale świecąca kropka w twoim kolorze akcentu, a powiadomienie podaje, ile scen ma problemy. Każdy zestaw problemów jest zgłaszany raz, a kropka pozostaje, dopóki nie zostaną rozwiązane. W **Chat Settings → Memory Recall** problemy są wymienione nad ustawieniami. **Access memories for this chat** pokazuje tę samą kropkę.

Naciśnij **Fix** w powiadomieniu albo na liście, żeby naprawić wszystkie oznaczone sceny za jednym razem. Naprawa używa **Helper model**. **Pause processing** (wstrzymaj przetwarzanie) ją zatrzymuje, a **Resume processing** (wznów przetwarzanie) kontynuuje. Fix:

- ponownie pyta model pomocniczy, kto uczestniczył w scenach oznaczonych **Check who was there** (sprawdź, kto tam był). Jeśli model nadal nie potrafi tego ustalić, nikt nie zyskuje dostępu, a scena trafia na listę do twojego sprawdzenia;
- sprawdza, kto uczestniczył w starszych scenach zapisanych przed wprowadzeniem sprawdzania uczestników;
- pisze nowe podsumowania scen, w których zmieniły się wiadomości, ukryte wiadomości, imiona postaci lub podsumowania, na których się opierają, oraz zakończonych scen bez podsumowania. Podsumowania usunięte przez ciebie pozostają usunięte;
- wznawia pracę nad pamięcią przerwaną przez błąd.

Fix nigdy nie przepisuje podsumowania edytowanego przez ciebie ręcznie. Wymienia takie podsumowania pod **need your review** (do twojego sprawdzenia) i zajmuje się resztą. Nie może zmienić ustawień za ciebie, takich jak zakres wiedzy postaci czy działające połączenie decyzyjne.

Gdy Fix skończy pracę, pokazuje "Advanced Memory fixed N scenes" oraz numery scen, które wymagają sprawdzenia. Wybierz numer, żeby otworzyć tę scenę w **Access memories for this chat**. Jeśli panel Chat Settings był zamknięty, powiadomienie z przyciskiem **Show** (pokaż) przeniesie cię tam. Przy kolejnym uruchomieniu Fix nie pyta ponownie o scenę, której nie udało się rozstrzygnąć, więc zapisz jej dostęp postaci samodzielnie.

### Ponowne skanowanie scen

Jeśli zmiany scen zostały przeoczone, na przykład gdy scena nigdy się nie skończyła, użyj **Re-scan scenes** (ponowne skanowanie scen) w **Chat Settings → Memory Recall**.

1. Wpisz numer pierwszej i ostatniej wiadomości do sprawdzenia. Na początku zakres obejmuje trwającą scenę.
2. Naciśnij **Re-scan** (uruchomienie skanowania).

Advanced Memory ponownie wyszukuje zmiany scen w tych wiadomościach i podsumowuje sceny, które się zmieniły. Używa modelu decyzyjnego, gdy włączone jest **Use Decision model**, a w przeciwnym razie modelu pomocniczego. Sceny spoza zakresu zachowują swoje granice i podsumowania. Jeśli zmieniłoby się podsumowanie edytowane przez ciebie, ponowne skanowanie zatrzymuje się i wskazuje tę scenę.

<a id="optional-decision-model"></a>

### Opcjonalny model decyzyjny

Model decyzyjny to mały model, który odpowiada na pytania typu tak lub nie. Jest domyślnie wyłączony i zapisywany osobno dla każdego czatu Roleplay.

1. Włącz **Use Decision model** w Advanced Memory.
2. Wybierz model w **Memory Decision connection** (połączenie decyzyjne dla pamięci). W grupie **Built-in model** (model wbudowany) lista zawiera te same modele co globalny **Decision model** (model decyzyjny). Model, który nie może jeszcze odpowiadać, jest wyszarzony wraz z przyczyną, a zatrzymany uruchamia się, gdy dostanie pytanie. W grupie **Connections** lista zawiera twoje zapisane konta decyzyjne. Zobacz [Modele decyzyjne](../connections/decision-models.md).

Ten wybór jest niezależny od globalnego domyślnego modelu decyzyjnego.

Model wykrywa granice scen podczas przygotowania historii i sprawdzania trwających scen. Przed nową odpowiedzią wybiera wspomnienia w dwóch przebiegach. Szczegóły opisuje sekcja [Jak działa przywoływanie decyzyjne](#how-decision-recall-works).

Konta u zewnętrznych dostawców otrzymują niedawny tekst rozmowy oraz wstępnie wybrane podsumowania lub wiadomości do oceny i mogą naliczać opłaty za kilka żądań przy jednej odpowiedzi. Przywoływanie filtruje dostęp postaci przed wysłaniem kandydatów.

<a id="deciding-who-sees-new-messages"></a>

### Decydowanie, kto widzi nowe wiadomości

W grupowym czacie Roleplay, w którym postacie odpowiadają po kolei, Advanced Memory może decydować, które postacie widzą każdą nową wiadomość. Nie musisz wtedy ukrywać każdej kwestii przed postacią, która opuściła scenę. Scalone czaty grupowe i czaty z jedną postacią tej opcji nie mają.

1. Włącz **Decide who sees new messages** w Advanced Memory.

Każda nowa wiadomość, twoja lub postaci, zostaje ukryta przed postaciami, których nie ma w scenie. Działa to tak samo jak ukrycie **Hide from AI** (ukrycie przed AI) dla poszczególnych postaci, które ustawia przycisk na samej wiadomości, więc znacznik z przekreślonym okiem pokazuje, kto jej nie widzi. Twoja wiadomość zostaje rozstrzygnięta zaraz po wysłaniu. Wcześniejsze wiadomości są rozstrzygane, zanim odpowie kolejna postać.

- **Narrator** wybrany tutaj oraz **Narrator character** (postać narratora) wybrana w ustawieniach komend Roleplay widzą każdą wiadomość. Autor wiadomości zawsze widzi własną. Odbiorca szeptu, którego nie ma w scenie, nadal dostaje szept.
- Przy włączonym **Use Decision model** ten model dostaje dla każdej postaci pytanie, czy wyraźnie nie może ona zobaczyć ani usłyszeć wiadomości. Postać, której fabuła nigdy nie umieszcza w scenie, liczy się jako przebywająca gdzie indziej. W przeciwnym razie decyduje **Helper model**. Wiadomość zostaje ukryta tylko wtedy, gdy model ma pewność.
- Model czyta dotychczasowe wiadomości bieżącej sceny i co najmniej kilka ostatnich wiadomości sprzed niej. Dostaje też listę postaci, które zabrały głos od początku sceny. Ta lista to tylko wskazówka: postać, która po cichu się przysłuchuje, nadal liczy się jako obecna.
- Jeśli samodzielnie zmienisz **Hide from AI** wiadomości albo użyjesz `/hide` lub `/unhide`, twój wybór zostaje, a Advanced Memory już nigdy nie zmienia tej wiadomości.
- O każdej wiadomości decyzja zapada raz. Jeśli model zawiedzie albo nie odpowie na czas, nic nie zostaje ukryte, a błąd trafia do logu serwera.

Przy włączonym Advanced Memory nowa odpowiedź postaci może zmienić scenę albo punkt widzenia za pomocą linii podziału, takiej jak `***`, `---` czy `* * *`. Odpowiedź zostaje wtedy zapisana jako osobne wiadomości tej samej postaci, po jednej na każdą część.

- Każda część ma własny krąg odbiorców. **Decide who sees new messages**, **Hide from AI** i szepty działają na każdą część.
- Postać, która napisała odpowiedź, nadal widzi każdą część. Jeśli nie powinna, samodzielnie ukryj przed nią daną część.
- Linia podziału zostaje na początku części, która po niej następuje. Podział wewnątrz bloku kodu albo bloku HTML, takiego jak `<details>`, się nie liczy.
- Myślenie odpowiedzi jest widoczne przy pierwszej części. Nie trafia z powrotem do modelu, nawet przy wyłączonym **Exclude Past Reasoning** (pomijanie wcześniejszego rozumowania).
- Informacje o wiadomości, trackery i wyniki agentów trafiają do ostatniej części.
- Agenci przepisujący, tacy jak Prose Guardian, przepisują każdą część osobno. Przy włączonym **Hold Message Until Rewrite** (wstrzymanie wiadomości do czasu przepisania) każda część czeka na własne przepisanie. Jeśli jedno przepisanie się nie powiedzie, ta część zostaje w pierwotnym brzmieniu.
- Automatyczne odtwarzanie mowy czyta wszystkie części po kolei.
- Swipe albo ponowne wygenerowanie części tworzy nową wersję tylko tej wiadomości. W przypadku wcześniejszej części nowa wersja zachowuje tekst sprzed pierwszego podziału.
- Funkcje Continue i Impersonate nigdy nie dzielą odpowiedzi.

<a id="character-recollections"></a>

### Osobiste wspomnienia postaci

Włącz **Character recollections**, żeby każda postać miała własne wspomnienie sceny. Opcja jest domyślnie wyłączona.

- Każda postać, która była w zakończonej scenie, dostaje jedno krótkie osobiste wspomnienie, liczące około 50 do 100 słów, napisane w pierwszej osobie i jej własnym głosem. To karta postaci decyduje, na co postać zwraca uwagę. **Narrator**, twoja persona i postacie, które były gdzie indziej, nie dostają żadnego.
- Model może korzystać tylko z tego, co każda postać mogła wiedzieć. Osobiste wspomnienie, które powtarza cztery słowa z rzędu z czegoś, czego jego postać nie mogła wiedzieć, zostaje pominięte. Przed faktem opowiedzianym innymi słowami chronią tylko instrukcje.

Jak pozostają poprawne:

- Osobiste wspomnienie liczy się tylko wtedy, gdy jego postać może przeczytać dokładnie to, co mogła w chwili, gdy je napisano. Jeśli jakaś wiadomość ze sceny zostanie później przed nią ukryta albo jej pokazana, wygenerowane wspomnienie zostaje napisane od nowa. Wspomnienie edytowane przez ciebie nie trafia do promptów, dopóki go nie sprawdzisz i ponownie nie zapiszesz.
- Osobiste wspomnienia nowej sceny powstają w tym samym żądaniu co jej podsumowanie. Jeśli karta postaci jest na to za duża, powstają w osobnych żądaniach. Postać, której karta zajmuje ponad połowę miejsca, jakie model pomocniczy ma na scenę, nie dostaje żadnego.
- Włączenie ustawienia w czacie z podsumowanymi scenami dodaje osobiste wspomnienia po jednej scenie naraz; postęp widać jako zadanie **Writing character recollections** (pisanie osobistych wspomnień postaci). Podsumowania scen nigdy się nie zmieniają. **Resume** ponawia próbę dla nieudanych scen.
- Jeśli model nie napisze niczego użytecznego, scena zachowuje puste osobiste wspomnienie, dopóki nie zmieni się jej podsumowanie lub tekst, który postać może przeczytać. Możesz napisać je samodzielnie w **Access memories for this chat**.

Gdzie się pojawiają i ile kosztują:

- Osobiste wspomnienia pojawiają się tylko przy przywołanych scenach, pod podsumowaniem sceny i przed jej fragmentem, po jednym wierszu na postać. W czacie grupowym, w którym postacie odpowiadają po kolei, postać widzi tylko własne. W scalonej odpowiedzi pojawia się, podpisane imieniem, wspomnienie każdej obecnej postaci, która pamięta scenę.
- Wliczają się do **Summary and recall budget**. Najpierw idą podsumowania, potem osobiste wspomnienia, a na końcu fragmenty. Najpierw skracane są fragmenty, a potem pomijane są całe osobiste wspomnienia. Osobiste wspomnienie nigdy nie jest ucinane.
- Osobiste wspomnienia nigdy nie trafiają do **Chat Summaries** i nigdy nie decydują o tym, które sceny są przywoływane.
- Gdy podsumowanie sceny się zmieni, jej wygenerowane osobiste wspomnienia są pisane od nowa: po każdej odpowiedzi dla najwyżej trzech scen, począwszy od najnowszych. **Prepare existing history**, **Re-scan scenes** i **Resume** robią to dla wszystkich.

Edycja i wyłączanie:

- W **Access memories for this chat** otwórz scenę, żeby przeczytać i edytować każde osobiste wspomnienie. Edytowane wspomnienie jest oznaczone etykietą **Manually edited** (edytowano ręcznie) i nigdy nie zostaje zastąpione. **Delete** na dobre usuwa je z promptów, ale możesz wpisać nowe.
- Wyłączenie ustawienia zachowuje zapisane osobiste wspomnienia, ale nie trafiają one do promptów. Eksport, import i gałęzie je obejmują.

<a id="in-game-mode"></a>

### W trybie Game Mode

Czaty w trybie Game Mode włączają Advanced Memory Recall tak samo, w **Chat Settings → Memory Recall**. Bez tej funkcji sesja Game wysyła w każdej turze całą swoją historię, aż do limitu kontekstu, więc długa sesja kosztuje znacznie więcej tokenów wejściowych na turę. Po włączeniu prompt mieści się w limicie **Maximum allowed context before compression**. Bieżąca scena trafia do niego jako bieżące wiadomości, a wcześniejsze sceny jako podsumowania oraz momenty wybrane przez przywoływanie.

- **Game Master czyta wszystkie wspomnienia.** Nie ma wyboru narratora, zakresów wiedzy, automatycznej widoczności wiadomości ani osobistych wspomnień postaci.
- **Rozmieszczenie.** Podsumowania i przywołane sceny trafiają za historię, tuż przed instrukcjami tury dla postaci GM. Instrukcje i historia przed nimi pozostają takie same między turami, więc połączenie z pamięcią podręczną promptów może je wykorzystać ponownie. Gdy scena się kończy, jedno żądanie nie trafia w pamięć podręczną.
- **Źródło.** Podsumowania odpowiadają opowieści w postaci, którą widzisz: uwzględniają twoje zmiany segmentów i pomijają znaczniki komend GM.
- **Sesje.** Nowa sesja zachowuje twoje ustawienia, ale zaczyna własne archiwum. GM nadal dostaje podsumowania wcześniejszych sesji.
- **Model decyzyjny.** Opcjonalny i domyślnie wyłączony. Zobacz [Opcjonalny model decyzyjny](#optional-decision-model). Dodaje niewielkie żądania do każdej tury.
- **Koszt.** Model pomocniczy pisze jedno podsumowanie na scenę i co kilka tur sprawdza, czy scena się zmieniła. Te żądania są niewielkie w porównaniu z ponownym wysyłaniem długiej sesji.
- Podgląd promptu czatu Game nie pokazuje jeszcze Advanced Memory. Użyj końcowego inspektora promptu.

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Memory Recall nic nie przywołuje | Sprawdź, czy skonfigurowane jest źródło embeddingów. Jeśli fragmenty mają status **Embedding unavailable**, ustaw model w sekcji **Semantic search (embeddings)** albo użyj wbudowanego modelu. Zobacz [Konfiguracja modelu wbudowanego](../connections/local-model.md). |
| Fragmenty mają status **Waiting for vector** | Daj im czas. Odciski palca powstają po odpowiedziach. |
| Nic nie wydaje się powiązane | Przywoływanie dodaje tylko blisko powiązane wspomnienia. To normalne, że nic nie dodaje. |
| Przywoływanie pogorszyło się po zmianie modelu embeddingów | Użyj ikony przebudowy w oknie **Memories for This Chat**. |
| Podsumowania nie powstają | Czat potrzebuje działającego konta tekstowego. Chat Summary używa **Summary Provider**. Jeśli żadne nie działa, generowanie zostaje pominięte. |
| Podsumowania AI nigdy się nie pojawiają | **Review Agent Outputs** może czekać na twoje zatwierdzenie. |
| Podsumowanie utknęło | Nieudane podsumowania są ponawiane po chwili. Uruchom **Backfill Summary** (Roleplay) albo **Backfill** (Conversation). |
| Scena jest oznaczona **Check who was there** | Naciśnij **Fix** albo otwórz ją w **Access memories for this chat** i użyj **Edit character access** (edytuj dostęp postaci). |

W przypadku innych problemów zobacz [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Szczegóły Advanced Memory

Szczegóły, których większość czytelników nie potrzebuje. Powyższe ustawienia działają bez czytania tej części.

### Jak sceny są wykrywane i podsumowywane

- Wykrywanie scen następuje po zapisaniu głównej odpowiedzi Roleplay. Gdy nadejdzie tyle nowych wiadomości, ile wynosi odstęp, model sprawdzający dostaje wszystkie wiadomości od ostatniego sprawdzenia (najwyżej dwukrotność odstępu), wiadomość, na której zakończyło się ostatnie sprawdzenie, instrukcje dotyczące scen i format wyniku. Wskazuje dokładną wiadomość kończącą każdą scenę albo nie wskazuje żadnej, gdy scena trwa. Liczą się zarówno wiadomości persony, jak i postaci.
- Przy wyłączonym trybie decyzyjnym należne sprawdzenie współdzieli kwalifikujące się wywołanie trackera po generowaniu, gdy pozwalają na to widoczność i budżet kontekstu. W przeciwnym razie model pomocniczy wykonuje własne wywołanie. Niepewne przejścia pozostawiają scenę otwartą.
- Tylko wykryte zakończenie uruchamia w tle przygotowanie podsumowania i indeksu wiadomości tej sceny. **Chat Settings → Agent activity** (ustawienia czatu, aktywność agentów) pokazuje postęp jako **Advanced Recall**, nawet gdy zwykli agenci są wyłączeni.
- Każde żądanie podsumowania sceny zawiera instrukcje podsumowania, uprawnione wiadomości sceny, pasujące poprawki zakresów i format wyniku JSON. Sceny zbyt duże na jedno żądanie są przetwarzane w zapisywanych partiach, a następnie łączone. Podsumowanie ma mieć od 2 do 3 akapitów. Domyślny prompt pisze historyczne streszczenie bez sekcji bieżącej sytuacji. Własne prompty wybrane w **Summaries** (podsumowania) nadal obowiązują.
- Początkowe wykrywanie w historii może używać modelu głównego lub pomocniczego. Podsumowania zawsze używają pomocniczego.
- Każde podsumowanie zapisuje też, kto uczestniczył w scenie. Imię uczestnika różniące się od karty, na przykład "Kaito" zamiast **Kaito Nakamura**, liczy się, gdy pasuje do dokładnie jednej postaci i nie jest imieniem twojej persony. Imiona wspólne, opisy w rodzaju "Kaito's sister" i imiona z dopiskami w rodzaju "(mentioned)" nie dają dostępu. Gdy model pomocniczy nie poda, kto uczestniczył, scena trafia do wszystkich postaci, a w czacie grupowym zostaje oznaczona **Check who was there**. Scena, w której występujesz tylko ty, pozostaje dostępna tylko narratorowi. Sceny zapisane przed wprowadzeniem sprawdzania uczestników pozostają dostępne tylko narratorowi, dopóki nie sprawdzi ich **Fix** lub **Prepare existing history**. Każda odpowiedź kończąca scenę sprawdza też najwyżej trzy.
- W starszym czacie grupowym, w którym postacie odpowiadają po kolei, potwierdź raz brakujące zakresy wiedzy. Pierwsza wypowiedź postaci nie dowodzi, że znała wszystko, co było wcześniej. Wybierz konkretną postać jako **Narrator** tylko wtedy, gdy powinna omijać ograniczenia uczestnictwa. Globalne **Hide from AI** usuwa turę tylko z bieżącego zapisu. Advanced Memory nadal ją skanuje, podsumowuje i indeksuje. Znaczniki początku przycinają bieżący zapis.

### Bieżące okno i budżet

- Pierwszeństwo w prompcie mają stałe podsumowania (zawsze włączone), potem podsumowania wybranych scen, potem osobiste wspomnienia postaci, a na końcu fragmenty wiadomości. Stałe podsumowania mają docelowo zajmować najwyżej 70% budżetu. Łączna pamięć może w razie potrzeby użyć do 2 000 dodatkowych tokenów, w granicach limitu kontekstu. Bieżące wiadomości nie wliczają się do części przeznaczonej na stałe podsumowania.
- Gdy wysyłany prompt osiągnie limit, bieżące okno resetuje się do początku najnowszej sceny dla wszystkich postaci, a potem znów rośnie. Dalsze żądania po wywołaniu funkcji i rzucie kością się nie liczą. Odcięcie widać w **Mark as new start** (oznacz jako nowy początek) z zaznaczonym **All** (wszyscy). Odznacz All, żeby je cofnąć. Osobiste flagi początku nadal obowiązują. Jeśli niedokończona scena lub zbyt duże stałe podsumowanie się nie mieści, żądanie używa oznaczonych fragmentów źródłowych i zachowuje najnowsze wiadomości. Zapisane podsumowania i wiadomości nigdy nie są nadpisywane.
- Główne generowanie od razu odczytuje zapisaną pamięć. Nigdy nie czeka na zadanie ciągłości.
- Po głównej odpowiedzi Advanced Memory dodaje **Chat Summaries** dla wiadomości archiwalnych, których nie obejmuje jeszcze żadne podsumowanie. W czacie grupowym, w którym postacie odpowiadają po kolei, wszyscy, którzy czytali scenę, współdzielą jedno jej podsumowanie.
- Gdy aktywne podsumowania czytane przez jedną postać przekroczą 70% budżetu, zadanie **Updating continuity** (aktualizowanie ciągłości) po odpowiedzi łączy je i skraca, używając modelu pomocniczego i **Chat Summary → Maximum output size**. Odpowiedź nigdy na to nie czeka. Podsumowanie, które nadal obejmuje bieżące wiadomości, czeka, aż te wiadomości opuszczą bieżące okno.
- Podsumowania czytane przez różne postacie są łączone w jedno, także te napisane przez ciebie. Prywatne części pozostają w swoich sekcjach `{{#if char == "Name"}}…{{/if}}`, dokładnie dla tych postaci, które je znały. Jeśli wynik zmieniłby, kto może przeczytać daną część, nie zostaje zapisany, a zamiast tego próbuje się mniejszych grup. Podsumowania używające innych makr pozostają bez zmian. Jeśli same wypełniają część przeznaczoną dla danej postaci, skróć je ręcznie albo zwiększ budżet. Zastąpione wpisy stają się nieaktywne, więc możesz je ponownie włączyć. **Resume processing** ponawia próbę dla nieudanego wyniku.
- Prompt postaci pokazuje zakres wiadomości i daty podsumowania tylko na podstawie wiadomości, które ta postać widzi. Narrator, gdy odpowiada w pojedynkę, czyta każdą część jeden raz.

### Co zwraca przywoływanie

- Jedna sekcja **Recalled Scenes** (przywołane sceny) zawiera każde podsumowanie, a po nim jego fragment, jeśli istnieje, pod jednym nagłówkiem zakresu. Blok wskazuje obecny zakres bieżącej historii i numer ostatniej wiadomości użytkownika, żeby przeszłe wydarzenia nie zostały pomylone z bieżącą turą.
- Scena jest przywoływana tylko wtedy, gdy wszystkie jej wiadomości źródłowe są poza wysyłaną bieżącą historią. Zakresowe **Chat Summaries** są pomijane, dopóki którakolwiek objęta nimi wiadomość jest w bieżącej historii. Pozostają zapisane i włączone. Uprawnione stałe podsumowania mają pierwszeństwo przed opcjonalnym przywoływaniem. Wszystkie wybrane podsumowania rezerwują miejsce przed jakimkolwiek fragmentem.
- Załączniki z ilustracjami i podpisy obrazów są pomijane w przywołanym tekście i nowych danych do podsumowań. Czytelne załączniki tekstowe pozostają.
- Przy wyłączonym trybie decyzyjnym przywoływanie odczytuje przygotowane wspomnienia. Embedding zapytania ma krótki limit czasu i w razie potrzeby przechodzi na dopasowanie tekstu. Dopasowanie tekstu nadaje większą wagę charakterystycznym słowom z twoich wiadomości wysłanych od ostatniej wypowiedzi odpowiadającej postaci. Najwięcej waży wymienione w nich imię. Imiona odpowiadających postaci i twojej persony nie mają takiej wagi, podobnie jak imię występujące w większości wspomnień. Nie dodaje to wywołania modelu.
- Przywoływanie działa tylko dla głównego generowania Roleplay. Wywołania agentów, ich ręczne ponowienia i przebiegi próbne go nie uruchamiają ani go nie otrzymują.
- Swipe'y wykorzystują najwcześniejszą zgodną pamięć zapisaną dla tej odpowiedzi. Swipe przywołuje ponownie, gdy od tamtej pory wcześniejsza scena, którą jego postać mogła przywołać, została zapisana, edytowana, włączona lub wyłączona. Kontynuacja odpowiedzi zachowuje pamięć, z którą odpowiedź się zaczęła. Zmiany historii, ustawień dostępu, podsumowań lub wspomnień unieważniają zapisane migawki.
- Edycja, swipe, ukrycie lub usunięcie wiadomości źródłowych powoduje ponowne sprawdzenie dotkniętej pamięci przed użyciem. Historyczna regeneracja korzysta tylko ze źródeł sprzed docelowej wiadomości.
- Raport pamięci pokazuje szacowany rozmiar kontekstu, wybraną granicę i przywołane źródła. Gdy nic nie zostało przywołane, podaje, czy nie było wcześniejszych scen, czy zabrakło miejsca, czy też nic nie okazało się istotne. Podgląd promptu używa przygotowanej pamięci i nie uruchamia wywołań modeli. Inspektor końcowego promptu pokazuje to, co trafiło do modelu.
- Gdy przywołana scena nie ma fragmentu, raport podaje powód: po podsumowaniach nie zostało miejsca albo żadnej z jej wiadomości nie można zacytować.

### Access memories for this chat

Otwórz je, żeby przeszukiwać ponumerowane podsumowania scen, sprawdzać ich ramy czasowe i odbiorców, edytować **Summary text** (tekst podsumowania) albo czytać oryginały przez **Inspect source messages** (sprawdź wiadomości źródłowe). Możesz wyłączać rekordy, użyć **Reindex** (ponowne indeksowanie), eksportować i importować albo użyć **Delete all memories** (usuń wszystkie wspomnienia), żeby zacząć przygotowanie od nowa, zachowując czat i ustawienia. Poprawki ręcznych podsumowań zostają zachowane i unieważniają zależną ciągłość. **Delete summary** (usuń podsumowanie) na dole podsumowania usuwa je po potwierdzeniu podsumowania i odbiorców. Działa to też dla starszych wpisów **Continuity** (ciągłość) i **Ongoing scene** (trwająca scena). Rutynowe przygotowanie nie odtwarza usuniętych podsumowań.

Żeby wykluczyć scenę z przywoływania, wyłącz jej rekord pamięci. Ukrycie dla określonej postaci nadal decyduje o tym, kto ma do niej dostęp. Globalne ukrycie nie usuwa jej z archiwum.

### Kto może przeczytać scenę

- Postać obecna podczas części sceny współdzieli dostęp do jej pamięci, nawet gdy niektóre wiadomości są przed nią ukryte. Scena bez dostępnych wiadomości źródłowych jest niedostępna. Wzmianka o nieobecnej postaci nie czyni jej uczestnikiem.
- Nowe podsumowania oznaczają widoczność wiadomości, opisują wspólne wydarzenia zwykłym tekstem i używają `{{#if character == "Name"}}…{{/if}}` dla prywatnych części. Jeśli zmieni się widoczność albo postać docelowa podsumowania, stare podsumowanie nie jest udostępniane postaciom z częściowym dostępem, dopóki ponownie nie przygotujesz tej sceny (**Fix** robi to dla każdej takiej sceny) albo nie sprawdzisz i nie zapiszesz jej warunków prywatności. Postać, która dołącza później, się nie liczy, chyba że widzi tylko część sceny. Starsze podsumowania wymagają jednego uruchomienia **Fix** po dołączeniu postaci. Postacie z dostępem do wszystkich wiadomości źródłowych nadal mogą przywołać scenę. Ręcznie poprawiony tekst nigdy nie jest po cichu przepisywany.
- Daty sceny są wspólne dla wszystkich przypisanych uczestników. Surowe fragmenty nigdy nie zawierają wiadomości ukrytych przed postacią ani szeptów. Podsumowanie z częściami tylko dla niektórych postaci nadal dostaje fragment, który cytuje tylko to, co dana postać widziała. Żeby wiadomość nie trafiła do pamięci postaci, ukryj ją przed tą postacią.
- W scalonym czacie grupowym przywoływanie obejmuje to, co pamięta co najmniej jedna postać. Scena lub prywatna część, której nie zna każda postać, jest oznaczana, na przykład "known only to Kaito". Fragment cytuje tylko wiadomości, które widziała każda postać pamiętająca scenę. Wspomnienia, których nie pamięta żadna postać, na przykład sceny dostępne tylko narratorowi, pozostają pominięte. W czatach grupowych, w których postacie odpowiadają po kolei, każda postać przywołuje tylko własne wspomnienia.

<a id="how-decision-recall-works"></a>

### Jak działa przywoływanie decyzyjne

- Zwykłe przywoływanie najpierw wstępnie wybiera do 24 podsumowań scen albo tyle, ile wynosi **Maximum recalled scenes**, jeśli to więcej. Wstępna lista łączy dopasowanie tekstu i embeddingi. Embeddingi porównują każdą scenę z najwyżej sześcioma twoimi wiadomościami wysłanymi od ostatniej wypowiedzi odpowiadającej postaci. Przy pierwszej odpowiedzi używana jest twoja najnowsza wiadomość. Dopóki embeddingów nie ma prawie każda scena, wstępna lista korzysta z rankingu zwykłego przywoływania. Miejsce dostaje też scena następująca bezpośrednio po każdej z trzech najlepszych.
- Każde podsumowanie oceniane przez model zaczyna się od jednego wiersza: zakresu wiadomości, daty w fabule i tego, kto mówił. Model wybiera przydatne sceny, a potem ocenia do 12 najlepiej dopasowanych oryginalnych wiadomości z każdej wybranej sceny, żeby wybrać jej fragment. Najlepszy wybór wyznacza środek, a pozostałe wydłużają fragment aż do **Maximum messages per excerpt** (maksymalna liczba wiadomości we fragmencie).
- Przy każdej nowej wiadomości model sprawdza też, czy fabuła przenosi się w inne miejsce lub czas, przechodzi do postaci, które są gdzie indziej, albo następuje po linii podziału sceny. Widzi trzy poprzednie wiadomości i ich autorów. Niepewne granice pozostawiają scenę otwartą. Prawidłowa decyzja może nie wybrać niczego.
- Limity czasu: każdy przebieg dostaje mniej więcej tyle, ile model potrzebuje na jedno pytanie, razy liczba pytań, plus połowa tej wartości, co najmniej 10 i najwyżej 25 sekund. Oba przebiegi razem dostają najwyżej 40 sekund na odpowiedź. Gdy model nie zmieści wszystkich pytań, ocenia ich mniej, zaczynając od najlepszych dopasowań. Żądania są krótkie, więc odpowiedzi, które nadejdą na czas, nadal się liczą. W tym czasie odpowiedź pokazuje swój zwykły tekst zastępczy **Thinking…** (myślenie).
- Gdy jedno żądanie się nie powiedzie, przekroczy limit czasu albo jest zbyt duże, tylko te wspomnienia przechodzą na zwykłe przywoływanie, za scenami wybranymi przez model, a raport to odnotowuje. Brak połączenia albo przebieg bez żadnej odpowiedzi oznacza pełny powrót do rankingu wstępnej listy i dopasowania tekstu. Niedostępne decyzje o scenach przechodzą na standardowe sprawdzanie scen.
- W tym trybie również powstają embeddingi. Nowa podsumowana scena dostaje je od razu. Starsze sceny i te z embeddingami z innego modelu dostają je po odpowiedziach, po kilka naraz. **Reindex** tworzy wszystkie od razu.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** (Peek Prompt, diagnostyka decyzji, aktywność Advanced Memory) pokazuje zapisane wyniki ostatniego przywołania i sprawdzenia sceny: model, czas, oceny, wybrane wspomnienia lub początki scen, stan mechanizmu zastępczego i powód, dla którego scena nie ma fragmentu. Mieści do 128 wyników. To wcześniejsza aktywność, a nie przewidywania. Otwarcie panelu nie powtarza decyzji. Zgodne swipe'y wykorzystują zapisany wybór. Kontynuacja wybiera swoje wspomnienia od nowa.
- Konta decyzyjne u zewnętrznych dostawców dostają ograniczone partie mieszczące się w ich budżecie kontekstu. Zarządzane modele Open-Jev korzystają ze zmierzonego czasu na pytanie, a konto decyzyjne odpowiada na pytania z jednego żądania razem, więc każde żądanie liczy się raz.

### Rozmieszczenie w presecie

Autorzy presetów mogą rozmieszczać te znaczniki treści za pomocą zwykłych ustawień kolejności sekcji, nazwy, roli i grupy:

| Znacznik | Treść |
| --- | --- |
| `chat_summary` | Kwalifikujące się stałe wpisy z Chat Summaries. |
| `current_scene_summary` | Fragmenty źródłowe ze starszej części trwającej sceny. |
| `recalled_scenes` | Wszystkie wybrane podsumowania scen, każde, a po nim jego fragment. |

Każdy znacznik używa formatu presetu **XML**, **Markdown** lub **None**. Puste elementy niczego nie dodają. Położenie wyznacza pierwszy włączony znacznik. Elementy bez włączonego znacznika trafiają raz przed historię, więc starsze presety działają. Wybór znaczników w presecie oferuje tylko **Recalled Scenes**. Stary znacznik `recalled_messages` jest aliasem, a włączony znacznik `recalled_scenes` ma pierwszeństwo. Te znaczniki są puste, gdy Advanced Memory jest wyłączone.

### Ograniczenia

Przywoływanie jest wybiórcze, a podsumowania mogą pomijać niuanse. Zachowuj ważne poprawki w źródłowym zapisie czatu lub w edytorze podsumowań. Jeśli embeddingi zawiodą, nadal działa ograniczone przywoływanie tekstowe i poprawna ciągłość. Archiwum nigdy nie trafia do promptu w całości. Jeśli instrukcje lub załącznik nie mieszczą się w limicie, zmniejsz je albo zwiększ limit. Jeśli rezerwa odpowiedzi nie mieści się w całkowitym kontekście modelu, zmniejsz rozmiar wyniku albo wybierz model z większym kontekstem. Advanced Memory zatrzymuje się, zamiast po cichu usuwać instrukcje.

Włączony tryb zaawansowany przejmuje przywoływanie, więc Standard Recall nie dokłada drugiej kopii. Zastępuje też zwykły harmonogram automatycznych podsumowań Roleplay w tym czacie. Wyłączenie go przywraca normalne ustawienia. Istniejące lorebooki i pobierani agenci zachowują własne zasady zakresu.

## Powiązane przewodniki

- [Konfiguracja modelu wbudowanego](../connections/local-model.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
