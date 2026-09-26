# Memory Recall i podsumowania czatu

Ten przewodnik opisuje **Memory Recall** (wyszukiwanie w dawnych wiadomościach), opcjonalną funkcję **Advanced Memory Recall (Alpha)** (zaawansowane przywoływanie pamięci) do automatycznego zarządzania kontekstem Roleplay, **Chat Summary** oraz **Automatic Summarization** w trybie Conversation.

## Dwa systemy pamięci

Każdy model AI czyta naraz tylko ograniczoną ilość tekstu. Ten limit nazywa się oknem kontekstu. W długim czacie najstarsze wiadomości wypadają poza to okno i AI o nich zapomina. Marinara Engine (dalej: Marinara) ma na to dwa niezależne systemy.

- **Memory Recall** przeszukuje starsze wiadomości pod kątem fragmentów najbliższych temu, co właśnie zostało napisane, a potem po cichu dokłada je z powrotem do promptu. Działa we wszystkich trybach czatu.
- Podsumowania ściskają stare wiadomości w krótkie streszczenia, które zastępują w prompcie surowe wiadomości. Czaty Roleplay korzystają z panelu **Chat Summary**. Czaty Conversation korzystają z sekcji **Automatic Summarization**.

Czaty Game Mode dostają wyłącznie sekcję **Memory Recall**. Żadnej z funkcji podsumowań tam nie ma.

Obu systemów można używać jednocześnie. Robią co innego i nie wchodzą sobie w drogę.

## Konfiguracja Memory Recall

**Memory Recall** wyszukuje istotne fragmenty z wcześniejszej części czatu i wstawia je do promptu jako wspomnienia. Korzysta z embeddingu, czyli liczbowego odcisku palca znaczenia wiadomości. Marinara porównuje odcisk palca nowej wiadomości z zapisanymi odciskami wcześniejszych wiadomości i dokłada najbliższe trafienia.

### Włączanie Memory Recall

1. Otwórz czat i kliknij przycisk **Chat Settings** (ustawienia czatu) w nagłówku czatu.
2. Znajdź sekcję **Memory Recall** (rozpoznasz ją po ikonie mózgu).
3. Włącz przełącznik **Enable Memory Recall**.

Przełącznik **Enable Memory Recall** działa osobno dla każdego czatu. Wartość domyślna zależy od trybu:

- Włączony domyślnie w czatach Conversation.
- Włączony domyślnie w czatach Roleplay i Game z aktywną sceną.
- Wyłączony domyślnie we wszystkich pozostałych czatach.

Wyłączenie przełącznika sprawia, że przywołane wspomnienia przestają trafiać do promptu. Nic z tego, co już zapisano, nie zostaje usunięte.

### Źródło embeddingów

Do budowania odcisków palca znaczenia sekcja **Memory Recall** potrzebuje źródła embeddingów. Ustawia się je w połączeniu, a nie w ustawieniach czatu. Połączenie to zapisany skrót do dostawcy AI.

1. Otwórz panel **Connections** (połączenia) i przejdź do edycji połączenia.
2. Znajdź sekcję **Semantic Search (Embeddings)** (wyszukiwanie semantyczne).
3. W polu modelu wpisz nazwę modelu embeddingów. Przykładowa wartość to `text-embedding-3-small`.
4. Opcjonalnie ustaw pole **Embedding Endpoint URL**, żeby nadpisać adres.
5. Opcjonalnie skorzystaj z listy rozwijanej **Embedding Connection**, żeby pożyczyć klucz i adres z innego połączenia. Do wyboru są między innymi **Same as this connection** i **Local Model (sidecar)**.

Część dostawców nie udostępnia embeddingów. Wtedy Marinara pokazuje uwagę z prośbą o wskazanie osobnego połączenia do embeddingów, na przykład zgodnego z OpenAI, połączenia Google albo **Local Model**.

Jeśli nie zostanie ustawione żadne połączenie do embeddingów, Marinara przechodzi na wbudowany, lokalny model embeddingów. Pobiera go jeden raz i uruchamia na twoim komputerze, bez żadnego klucza API. Więcej o wbudowanym modelu znajdziesz w przewodniku [Konfiguracja modelu Local Model](../connections/local-model.md).

To samo ustawienie **Semantic Search (Embeddings)** napędza też wyszukiwanie semantyczne w lorebookach, więc jedna konfiguracja obsługuje obie funkcje.

### Memories for This Chat

Aby zobaczyć, co czat zapamiętał, otwórz **Chat Settings**, przejdź do sekcji **Memory Recall** i kliknij **Access memories for this chat**. Przy włączonej funkcji Advanced Memory przeglądarka pozostaje w panelu bocznym Roleplay; w przeciwnym razie otwiera się okno **Memories for This Chat**.

Okno pokazuje liczbę zapisanych fragmentów wspomnień i przybliżony szacunek w tokenach. Każda karta fragmentu zawiera zakres dat, którego dotyczy, liczbę wiadomości, status oraz datę utworzenia. Status ma jedną z trzech wartości:

- **Vectorized**: odcisk palca jest gotowy i można go przeszukiwać.
- **Waiting for vector**: odcisk palca dopiero powstaje.
- **Embedding unavailable**: żadne źródło embeddingów nie mogło go zbudować.

Na pasku narzędzi są ikony eksportu wspomnień, importu wspomnień, przebudowy wspomnień oraz wyczyszczenia wszystkich wspomnień. Każdy fragment ma dodatkowo własną ikonę kosza, która usuwa tylko ten jeden fragment.

- Kliknięcie ikony kosza przy fragmencie otwiera okno **Forget Memory**. Potwierdź przyciskiem **Forget**.
- Ikona kosza czyszcząca wszystko otwiera okno **Clear Memories**. Potwierdź przyciskiem **Clear**. Usuwa to wspomnienia, ale wiadomości czatu zostają nietknięte.
- Ikona odświeżania przebudowuje każdy fragment wspomnień z bieżących wiadomości czatu. Użyj jej po zmianie modelu embeddingów.
- Eksport zapisuje plik `.marinara.json`. Import przyjmuje pliki `.json` i `.marinara`, a ich zawartość dołącza do istniejących wspomnień.

### Jak zachowuje się Memory Recall

Warto pamiętać o kilku rzeczach:

- Marinara zapisuje fragmenty wspomnień w tle zawsze, gdy dostępne jest źródło embeddingów, nawet przy wyłączonym przełączniku **Enable Memory Recall**. Przełącznik decyduje wyłącznie o tym, czy zapisane wspomnienia trafiają do promptu. Żeby zatrzymać zapisywanie, usuń źródło embeddingów albo co jakiś czas czyść wspomnienia.
- Fragment powstaje dopiero z co najmniej 5 nowych wiadomości. Mniejsze porcje czekają na kolejną odpowiedź.
- Przywołane fragmenty muszą być na tyle bliskie tematycznie, żeby przejść test podobieństwa. Słabe trafienia są pomijane, więc wyszukiwanie potrafi nic nie zwrócić, choć wspomnienia istnieją.
- Na przywołane wspomnienia przypada tylko niewielki wycinek promptu, więc dokładanych jest zawsze zaledwie kilka najtrafniejszych.
- Po zmianie modelu embeddingów, gdy wspomnienia już istnieją, stare fragmenty przestają pasować. Przebuduj je ikoną odświeżania.
- Usunięcie wiadomości czatu kasuje też jego fragmenty wspomnień.

Niektóre kontenerowe wersje aplikacji Marinara Engine, znane jako Marinara Lite, wyłączają sekcję **Memory Recall** całkowicie. Na tych wersjach sekcja **Memory Recall** w ogóle się nie pojawia.

## Advanced Memory Recall (Alpha, Roleplay)

Otwórz **Chat Settings → Memory Recall** i włącz **Advanced Memory Recall (Alpha)**. Możesz też włączyć **Automatic context and memory handling (alpha)** (automatyczna obsługa kontekstu i pamięci) pod sekcją Agents w kreatorze konfiguracji Roleplay. Ten opcjonalny tryb wspólnie zarządza oknem bieżącej historii, podsumowaniami ciągłości i istotnymi starszymi fragmentami. Ustawienia i postęp przygotowania są dostępne zarówno w kreatorze, jak i w panelu bocznym Chat Settings na komputerze i telefonie. Przeglądarka archiwum pozostaje w panelu bocznym Chat Settings.

### Konfiguracja

- Ustaw **Maximum allowed context before compression (tokens)** (maksymalny kontekst przed kompresją) w granicach kontekstu obsługiwanego przez model czatu. Limit obejmuje szacowany prompt wysyłany do modelu: instrukcje, wiadomości, przywołany kontekst, narzędzia i załączniki, zarówno dla czatu, jak i przetwarzania pamięci. Tokeny odpowiedzi i zapas bezpieczeństwa są liczone osobno. Całkowity limit kontekstu modelu nadal obowiązuje; to nie jest dokładny pomiar tokenizera ani limit rozliczeniowy.
- Ustaw **Summary and recall budget (tokens)** (budżet podsumowań i przywoływania) w ramach tego limitu. Aktywne stałe podsumowania mają docelowo zajmować najwyżej **70%** tej wartości. Pierwszeństwo mają stałe podsumowania, następnie podsumowania wybranych scen, a na końcu fragmenty wiadomości. Łączna pamięć może w razie potrzeby przekroczyć budżet o **2,000 tokenów**, ale musi zmieścić się w całym kontekście. Przykładowo budżet 10k oznacza cel do 7k dla stałych podsumowań i do 12k łącznie; te same proporcje dotyczą innych wartości. Bieżące wiadomości nie wliczają się do części przeznaczonej na stałe podsumowania ani nie uruchamiają ich łączenia.
- **Helper model** (model pomocniczy) podejmuje samodzielne decyzje o scenach, tworzy podsumowania scen i kompresuje ciągłość. Domyślnie używa połączenia agentów, a w drugiej kolejności połączenia czatu. Początkowe wykrywanie historycznych scen może używać modelu głównego lub pomocniczego; podsumowania zawsze używają pomocniczego. Wybrane modele widać przed przygotowaniem.
- Wszystkie wywołania podsumowań pamięci używają **Chat Summary → Maximum output size**, z co najmniej **8,196 tokenami wyjściowymi**, aby zostawić miejsce na rozumowanie. Dotyczy to podsumowań scen i łączenia stałych podsumowań; większe ustawienie jest zachowywane. Połączenie pomocnicze nie zastępuje go zwykłym limitem odpowiedzi. Dane wejściowe i rezerwa odpowiedzi nadal muszą mieścić się w całkowitym kontekście modelu.
- Żądanie podsumowania sceny zawiera instrukcje podsumowania, uprawnione wiadomości z tej sceny i pasujące poprawki zakresowe oraz format odpowiedzi JSON. Zbyt duże sceny są przetwarzane w zapisywanych partiach, a następnie łączone. Podsumowanie sceny ma mieć **2–3 akapity**. Domyślny prompt tworzy historyczne streszczenie bez sekcji bieżącej sytuacji i otwartych napięć; własne prompty wybrane w **Summaries** nadal obowiązują. Advanced Memory działa niezależnie od głównego przełącznika Agents i nie wymaga pobieranego agenta.
- **Maximum recalled scenes** (maksymalna liczba przywołanych scen) wynosi domyślnie **3**. To górna granica; słabe dopasowania są pomijane. Wartość **0** wyłącza opcjonalne przywoływanie scen, zachowując wymaganą ciągłość. Każda wybrana scena dostarcza podsumowanie, a po nim najwyżej jeden fragment wiadomości.
- **Moving context** (ruchomy kontekst) określa liczbę wiadomości we fragmencie, domyślnie **3–10**. Obie wartości **0** dają same podsumowania; minimum **0** czyni fragmenty opcjonalnymi. Trafność, dostęp postaci i wolne miejsce mogą ograniczyć liczbę wiadomości, także do zera.

W starszym czacie grupowym Individual potwierdź raz brakujące zakresy wiedzy postaci. Pierwsza wypowiedź postaci nie dowodzi, że znała całą wcześniejszą historię. Wybierz konkretną postać jako **Narrator** (narrator) tylko wtedy, gdy powinna omijać ograniczenia uczestnictwa. Ukrycie dla określonej postaci i potwierdzone zakresy wiedzy nadal ograniczają pamięć. Globalne **Hide from AI** (ukryj przed AI), ustawione ręcznie lub przez automatyczne podsumowania, usuwa turę tylko z bieżącego zapisu: Advanced Memory nadal ją skanuje, ustala uczestników sceny, podsumowuje i indeksuje do dozwolonego przywoływania. Znaczniki początku przycinają bieżący zapis. Zakresy możesz później poprawić; nowe postacie wymagają własnego potwierdzenia.

W istniejącym czacie kliknij najpierw **Prepare existing history** (przygotuj dotychczasową historię). Jeśli odzyskana historia zmieni granice sceny objętej ręczną poprawką, wyłącz tę pamięć, aby zachować tekst do wglądu, albo ją usuń, a potem ponownie przygotuj historię. Zapisanie tej samej poprawki nie może bezpiecznie przypisać tekstu do innego zakresu źródła. Przygotowanie przetwarza starszą historię partiami i pokazuje etap obok kołowrotka Professor Mari. **Cancel** (anuluj) zachowuje ukończoną pracę; **Resume** (wznów) kontynuuje po zamknięciu panelu, restarcie serwera lub aktualizacji aplikacji. Błąd wywołania modelu zachowuje poprawną pamięć i pokazuje błąd do ponowienia. Nie resetuj pamięci po błędzie: wznowienie używa gotowych podsumowań i niezmienionego wykrywania scen. Ostatnia trwająca scena pozostaje otwarta i otrzymuje podsumowanie po zamknięciu; gdy jej bieżące wiadomości przekraczają limit kontekstu, używane są ograniczone fragmenty źródłowe.

Aby usunąć zapisane podsumowanie, otwórz je w **Access memories for this chat** i wybierz **Delete summary** (usuń podsumowanie) na dole. Potwierdź podsumowanie i odbiorców w oknie. Dotyczy to też starszych wpisów **Continuity** (ciągłość) i **Ongoing scene** (trwająca scena). Rutynowe przygotowanie nie odtwarza usuniętych podsumowań scen. Wiadomości źródłowe zostają zachowane. Nowe stałe podsumowania są w **Chat Summaries**, z dotychczasowymi przyciskami edycji, włączania, łączenia i usuwania; starsza ciągłość ze skarbca nie jest dodatkowym stałym podsumowaniem.

### Podczas rozmowy

Wykrywanie scen następuje po zapisaniu głównej odpowiedzi Roleplay. **Standalone scene check interval (messages)** (odstęp sprawdzania scen) wynosi domyślnie **5**. Model dostaje ponumerowane ostatnie wiadomości, jedną poprzedzającą dla kontekstu, instrukcje i format wyniku. Wskazuje dokładne numery wiadomości kończących sceny albo nie zwraca zakończeń, jeśli scena trwa. Liczą się wiadomości person i postaci. Częstotliwość jest niezależna od harmonogramów agentów śledzących; gdy widoczność źródeł i budżet pozwalają, sprawdzenie współdzieli ich wywołanie po generowaniu, a w przeciwnym razie korzysta osobno z modelu pomocniczego. Nowy zakres zaczyna się po końcu poprzedniej sceny i obejmuje wskazaną wiadomość końcową. Tylko wykryte zakończenie uruchamia przygotowanie podsumowania i indeksu w tle, także gdy scenę kończy najnowsza odpowiedź. Niepewne przejścia pozostawiają scenę otwartą. Menu **Agents** w lewym górnym rogu pokazuje zadanie jako **Advanced Recall**, z postępem, błędami i odzyskiwaniem, również przy wyłączonych zwykłych agentach. Odpytywanie postępu trwa tylko podczas zadania pamięci; gotowe archiwum nie jest odpytywane w czasie bezczynności.

Zwykłe przywoływanie odczytuje przygotowaną pamięć, zamiast ponownie przygotowywać archiwum. Opcjonalny embedding zapytania ma krótki limit czasu i w razie niedostępności korzysta z dopasowania tekstu.  Dopasowanie tekstu nadaje większą wagę charakterystycznym słowom z ostatniej wiadomości użytkownika, dzięki czemu krótki szczegół może wskazać długie podsumowanie sceny. Zaindeksowane oryginalne wiadomości pozwalają też znajdować sceny przy wyłączonym wyświetlaniu fragmentów. Żaden z tych mechanizmów nie dodaje wywołania modelu. Przywoływanie działa wyłącznie dla głównego generowania Roleplay: agenty, ich ręczne ponowienia i pomocnicze generowania próbne nie uruchamiają go ani nie otrzymują zwróconych podsumowań i fragmentów. Inspekcja głównego promptu pozostaje tylko do odczytu.

Ponowne generowanie wariantu wykorzystuje najwcześniejszą zgodną pamięć zapisaną dla tej odpowiedzi: ciągłość, podsumowania scen i dokładne fragmenty. Niezmienione warianty nie wyszukują ponownie ani nie wywołują modelu podsumowań. Kontynuacja zachowuje pamięć używaną na początku odpowiedzi. Starsza odpowiedź bez migawki zapisuje ją przy kolejnym generowaniu i wykorzystuje ponownie; reset archiwum nie jest potrzebny. Dodawanie i łączenie stałych podsumowań w tle zachowuje zgodne migawki. Ręczne zmiany historii, dostępu, podsumowań lub pamięci unieważniają niezgodne migawki. Bieżący limit kontekstu zawsze obowiązuje.

Główne generowanie od razu odczytuje zapisaną pamięć. Nigdy nie uruchamia generowania ciągłości ani nie czeka na nie, nawet podczas pracy pomocnika w tle. Gdy wysyłany prompt osiągnie limit, bieżący kontekst zaczyna się od początku najnowszej sceny dla **wszystkich postaci**, a następnie rośnie do kolejnego osiągnięcia limitu. Automatyczne odcięcie widać w istniejącym menu **Mark as new start** (oznacz jako nowy początek) z zaznaczonym **All** (wszyscy); odznacz All, aby je cofnąć. Osobiste flagi początku nadal obowiązują. Gdy niedokończona scena lub zbyt duże stałe podsumowanie nie mieści się w limicie, żądanie używa wyraźnie oznaczonych fragmentów źródłowych i zachowuje najnowsze wiadomości. Takie tymczasowe dopasowanie nie tworzy kolejnej trwałej flagi. Zapisane podsumowania i oryginalne wiadomości nie są nadpisywane.

Po głównej odpowiedzi Advanced Memory rozszerza istniejące zakresowe **Chat Summaries** tylko o nieobjęte nimi wiadomości archiwalne, wykorzystując gotowe podsumowania scen, gdy to możliwe. Istniejące wpisy, także nieaktywne, oznaczają już obsłużone zakresy. Gdy uprawnione aktywne stałe podsumowania przekroczą 70% **Summary and recall budget**, zadanie **Updating continuity** łączy po odpowiedzi wyłącznie ich teksty, używając wybranego pomocnika i **Chat Summary → Maximum output size**. Podsumowania nachodzące na bieżące wiadomości nie wliczają się do tego budżetu ani łączenia; starsze wpisy bez zakresów pozostają uprawnione. Odpowiedź przekraczająca próg powstaje normalnie z zapisanymi uprawnionymi podsumowaniami, bez czekania na kompresję. Dodatkowe 2,000 tokenów dotyczy całej pamięci, nie części stałej. Wspólne szablony, których makra dają różną treść dla poszczególnych postaci, pozostają bez zmian; jeśli same przekraczają cel, wymagają ręcznej edycji. Pozostałe grupy dostają proporcjonalne wskazówki długości, a nie sztywny próg odrzucenia. Krótszy, poprawnie ukończony zamiennik otrzymuje tytuł z zakresem wiadomości i jest zapisywany jednocześnie z dezaktywacją zastępowanych wpisów. Błędny lub niedokończony wynik nie jest zapisywany; dotychczasowe wpisy pozostają dostępne, a **Resume processing** ponawia niedokończone zadanie. Podsumowania scen pozostają w skarbcu.

Archiwum przywołuje pasujące podsumowania scen i dokładne dialogi z oryginalnymi numerami wiadomości i mówcami. Jedna sekcja **Recalled Scenes** zawiera każde podsumowanie, a bezpośrednio pod nim dostępny fragment z jednym nagłówkiem zakresu. Sceny bez fragmentów pozostają w tej samej sekcji. Blok wskazuje bieżący zakres historii i numer ostatniej wiadomości użytkownika. Podsumowania scen są przywoływane tylko wtedy, gdy wszystkie ich źródła są poza wysyłaną historią; fragmenty także pomijają bieżące wiadomości. Zakresowe **Chat Summaries** również są pomijane, dopóki którakolwiek objęta nimi wiadomość pozostaje w kontekście. Pozostają zapisane i włączone, a wracają po wyjściu całego zakresu poza okno. Uprawnione stałe podsumowania mają pierwszeństwo przed opcjonalnym przywoływaniem i zachowują warunki dla postaci. Wszystkie wybrane podsumowania scen rezerwują miejsce przed dodaniem fragmentów. Ograniczenia dostępu postaci i historycznych źródeł nadal obowiązują. Ilustracje i podpisy obrazów są pomijane w przywołanych wiadomościach oraz nowych danych do podsumowania; czytelne załączniki tekstowe pozostają. Liczą się wiadomości person i postaci. Historyczna regeneracja korzysta tylko ze źródeł sprzed odpowiedzi, nawet przed aktualnym zarządzanym oknem. Edycja, zmiana wariantu, ukrycie lub usunięcie źródła powoduje ponowną weryfikację zależnej pamięci.

Otwórz **Access memories for this chat** w tym samym panelu, aby przeszukiwać chronologicznie ponumerowane podsumowania scen, sprawdzać ich ramy czasowe i odbiorców, edytować **Summary text** (tekst podsumowania) lub czytać pełne oryginalne wiadomości przez **Inspect source messages** (sprawdź wiadomości źródłowe). Wewnętrzne dosłowne fragmenty nie są osobnymi wpisami podsumowań scen. Przywoływany kontekst zawiera ramy czasowe fabuły oparte na źródłach; nieznane daty pozostają nieznane. Możesz wyłączać rekordy przywoływania, przebudować indeks, eksportować i importować lub potwierdzić **Delete all memories** (usuń wszystkie wspomnienia), aby zacząć przygotowanie pamięci od nowa, zachowując oryginalny czat i ustawienia. Poprawki oryginalnych ręcznych podsumowań zostają zachowane i unieważniają zależną ciągłość. Aby wykluczyć scenę z przywoływania, wyłącz jej rekord pamięci. Ukrycie źródła dla określonej postaci nadal określa dostęp; globalne ukrycie nie usuwa sceny z archiwum.

Postać obecna podczas części sceny może współdzielić dostęp do jej pamięci z innymi uczestnikami, nawet jeśli niektóre wiadomości są przed nią ukryte. Scena bez dostępnych wiadomości źródłowych pozostaje niedostępna. Nowe instrukcje podsumowania określają widoczność wiadomości, opisują wspólne wydarzenia zwykłym tekstem i zastrzegają `{{#if character == "Name"}}…{{/if}}` dla prywatnych części. Wspomnienie nieobecnej postaci nie czyni jej uczestnikiem. Po zmianie widoczności źródeł lub imion postaci stare podsumowanie nie jest udostępniane postaciom z częściowym dostępem, dopóki ponownie nie przygotujesz sceny albo nie sprawdzisz warunków prywatności i nie zapiszesz poprawionego tekstu. Starsze podsumowania bez zapisanej informacji o widoczności wymagają takiej samej weryfikacji przed przyznaniem częściowego dostępu; sama zmiana odbiorców nie oznacza sprawdzenia tekstu. Postacie z dostępem do wszystkich wiadomości źródłowych nadal mogą je przywołać, a ręcznie poprawiony tekst nigdy nie jest po cichu przepisywany. Te kontrole nie wywołują modelu podczas przywoływania. Daty i ramy czasowe sceny są wspólnymi metadanymi wszystkich przypisanych uczestników, nawet gdy część wiadomości jest ukryta. Fragmenty oryginalnych wiadomości nigdy nie obejmują wiadomości ukrytych przed postacią; fragmenty z podsumowań objętych warunkami pozostają dostępne tylko narratorowi, ponieważ sama widoczność wiadomości nie opisuje każdego prywatnego faktu. Stałe Chat Summaries nadal obejmują wiadomości ukryte przed AI; warunki postaci kontrolują dostęp do prywatnych szczegółów bez pomijania tych wiadomości w podsumowaniu.

Włączony tryb zaawansowany przejmuje przywoływanie, więc przełącznik Standard Recall nie dokłada drugiej kopii. Zastępuje też zwykły harmonogram automatycznych podsumowań Roleplay w tym czacie. Wyłączenie Advanced Memory przywraca normalne ustawienia. Istniejące lorebooki i pobierane agenty zachowują własne zasady zakresu; Advanced Memory nie może zapewnić prywatności dowolnym treściom użytkownika ani kontekstowi zewnętrznemu.

### Rozmieszczenie w presecie

Autorzy presetów mogą rozmieszczać te zwykłe znaczniki treści za pomocą istniejących ustawień kolejności sekcji, nazwy, roli i grupy:

| Znacznik | Treść |
| --- | --- |
| `chat_summary` | Kwalifikujące się stałe wpisy z Chat Summaries. |
| `current_scene_summary` | Ograniczone fragmenty źródłowe ze starszej części trwającej sceny. |
| `recalled_scenes` | Wszystkie wybrane podsumowania scen, każde z dostępnym fragmentem historii bezpośrednio pod nim. |

Wybór znaczników w presecie oferuje dla przywoływania tylko **Recalled Scenes** (przywołane sceny). Istniejące znaczniki `recalled_messages` pozostają zgodnymi aliasami i są wyświetlane jako Recalled Scenes. Włączony `recalled_scenes` ma pierwszeństwo; znaczniki nigdy nie tworzą osobnych sekcji.

Każdy element używa formatu presetu **XML**, **Markdown** lub **None** i krótko wyjaśnia swoje przeznaczenie. Puste elementy niczego nie dodają. Pierwsze włączone wystąpienie wyznacza położenie; elementy bez włączonego znacznika trafiają raz przed historię, więc starsze presety działają. Fragmenty są kontekstem, nie nowymi bieżącymi wiadomościami ani poleceniami. Zaawansowane znaczniki scen pozostają puste, gdy Advanced Memory jest wyłączone.

Podgląd promptu używa przygotowanej pamięci bez wywołań modeli i embeddingów. W panelu przygotuj niezainicjowane archiwum lub wznów nieudane zadanie w tle. Raport pamięci pokazuje szacowany rozmiar kontekstu, wybraną granicę i przywołane źródła; inspektor końcowego promptu pokazuje treść faktycznie wysłaną do modelu.

### Ograniczenia i odzyskiwanie

Przywoływanie jest wybiórcze, a podsumowania mogą pomijać niuanse. Zachowuj ważne poprawki w transkrypcie źródłowym lub edytorze podsumowań. Żaden system nie odtworzy niezapisanych szczegółów. Jeśli embeddingi zawiodą, nadal dostępne są ograniczone wyszukiwanie leksykalne i poprawna ciągłość; całe archiwum nigdy nie trafia do promptu. Jeśli obowiązkowe instrukcje lub załącznik nie mieszczą się w limicie promptu, zmniejsz je albo zwiększ limit. Jeśli rezerwa odpowiedzi nie mieści się w całkowitym kontekście modelu, zmniejsz rozmiar wyniku albo wybierz model z większym kontekstem. Advanced Memory zatrzymuje się zamiast po cichu usuwać instrukcje.

## Chat Summary (Roleplay)

**Chat Summary** ściska starsze wiadomości w krótkie streszczenia fabularne, nazywane wpisami podsumowania. Każdy wpis może napisać AI albo ty samodzielnie, a każdy da się włączyć i wyłączyć niezależnie. Ta funkcja istnieje wyłącznie w czatach Roleplay. Zapis pojedynczego przełącznika nie blokuje innych wpisów; Activate All i Deactivate All zapisują cały wybór razem.

Żeby ją otworzyć, kliknij przycisk **Chat Summary** (ikona zwoju) w nagłówku czatu Roleplay. Otwiera się panel podręczny **Chat Summary**.

### Tworzenie wpisu podsumowania

1. W sekcji **Summary Scope** wybierz **Last**, żeby podsumować najnowsze wiadomości, albo **Range**, żeby wskazać konkretny zakres wiadomości.
2. Kliknij przycisk **Generate**, żeby AI napisało wpis z tego zakresu.
3. Możesz też kliknąć przycisk **Write**, utworzyć pusty wpis i wpisać streszczenie ręcznie.

Każdy wpis na liście pokazuje tytuł, zakres źródłowy lub liczbę wiadomości oraz szacowany rozmiar w tokenach. Wpis da się włączyć lub wyłączyć, rozwinąć, zmienić przyciskiem **Edit** albo usunąć przyciskiem **Delete**. Przyciski zbiorcze pozwalają na **Show Inactive** lub **Hide Inactive** oraz na **Activate All** albo **Deactivate All** za jednym razem.

### Automatic Summaries

Panel **Automatic Summaries** (automatyczne podsumowania) dba o aktualność podsumowań w trakcie dalszej rozmowy. Pojawia się wyłącznie w czatach Roleplay.

- Włącz przełącznik **Enabled** wewnątrz panelu **Automatic Summaries**.
- Częstotliwość ustaw w polu **Every**, liczoną w wiadomościach użytkownika. Domyślnie jest to 5, a zakres wynosi od 1 do 200.
- Kliknij przycisk **Backfill Summary**, żeby nadrobić starszy czat, który nigdy nie miał podsumowań. Przetwarza on czat porcjami, a w trakcie widać pasek postępu. Kliknij przycisk **Stop**, żeby przerwać wcześniej.

### Szablony Summary Prompt

Panel **Summary Prompt** steruje instrukcjami, według których AI pisze podsumowanie. Kliknij przycisk **Edit**, żeby zmienić aktywny prompt. Kliknij przycisk **Templates**, żeby otworzyć menedżera szablonów. Przycisk **New template** zapisuje tam nazwany prompt. Każdy zapisany szablon ma własne przyciski **Duplicate**, **Edit** i **Delete**.

Zapisane szablony to ustawienie globalne, wspólne dla całej aplikacji. Edycja lub wybór szablonu w jednym czacie Roleplay zmienia prompt podsumowania we wszystkich czatach Roleplay.

### Summary Connection i rozmiar wyniku

Panel **Summary Connection** wskazuje połączenie, które pisze podsumowania. Domyślna wartość nazywa się **Agent default (falls back to chat connection)**. Oznacza to, że w pierwszej kolejności używane jest domyślne połączenie agenta, a w drugiej własne połączenie czatu.

Pole **Maximum output size** decyduje o tym, jak długie może być wygenerowane podsumowanie. Domyślnie jest to 4096 tokenów, a zakres wynosi od 1 do 32768.

### Opcje wyświetlania

Sekcja **Display** w panelu podręcznym decyduje o tym, jak podsumowane wiadomości wyglądają na ekranie:

- **Hide summarised messages**: ukrywa surowe wiadomości, gdy obejmie je podsumowanie. Domyślnie wyłączone.
- **Recent message tail**: zostawia tyle najnowszych wiadomości w pełni widocznych nawet przy włączonym ukrywaniu. Domyślnie jest to 10, a przyjmowana jest każda nieujemna liczba całkowita. Wartość 0 ukrywa całą podsumowaną porcję. Wyższe wartości zwiększają rozmiar promptu i koszt modelu.
- **Collapse hidden messages**: steruje wyglądem ukrytych wiadomości w zapisie czatu.

Jeśli czat wymaga zatwierdzania zapisów przez agenta (osobne ustawienie w sekcji Agents), podsumowania napisane przez AI czekają na twoją weryfikację, zanim zaczną obowiązywać.

## Automatic Summarization (Conversation)

Czaty Conversation korzystają z innego systemu, nazwanego **Automatic Summarization**. Zamyka on każdy dzień kalendarzowy w podsumowaniu dnia, a zakończone tygodnie podsumowań dziennych łączy w podsumowanie tygodnia. Prompt wysyła potem tylko podsumowania tygodni, podsumowania dni z bieżącego tygodnia i dzisiejsze wiadomości. Dzięki temu każde żądanie zostaje małe.

Ta funkcja działa samodzielnie i w czatach Conversation nie da się jej wyłączyć.

### Otwieranie edytora

1. Otwórz czat Conversation i kliknij przycisk **Chat Settings**.
2. Znajdź sekcję **Automatic Summarization** (rozpoznasz ją po ikonie kalendarza).
3. Kliknij przycisk **Edit Summaries**, żeby otworzyć okno **Automatic Summarization**.

Okno pokazuje najpierw wpisy tygodniowe, a pod nimi dni, których jeszcze nie zwinięto w tydzień. Rozwiń wpis, żeby zmienić jego tekst w polu **Summary** oraz listę **Key Details**, w której da się dodawać i usuwać wiersze.

### Day Rollover Hour i Recent Message Tail

Dwa ustawienia w sekcji **Automatic Summarization** decydują o podziale na dni:

- **Day Rollover Hour**: godzina, o której na potrzeby podsumowań zaczyna się nowy dzień. Domyślnie jest to 4 AM, a do wyboru są godziny od 12 AM (północ) do 11 AM. Wiadomości wysłane przed tą godziną liczą się do dnia poprzedniego. Wybierz porę, o której nigdy nie piszesz, żeby nocna sesja nie została przecięta na pół.
- **Recent Message Tail**: ile dzisiejszych najnowszych wiadomości zostaje w formie dosłownej nawet po podsumowaniu. Domyślnie jest to 10, a przyjmowana jest każda nieujemna liczba całkowita. Wyższe wartości zwiększają rozmiar promptu i koszt modelu.

Po zmianie ustawienia **Day Rollover Hour**, gdy podsumowania już istnieją, Marinara ostrzega, że starsze podsumowania powstały przy poprzedniej wartości.

### Uzupełnianie brakujących dni

Czasem dzień nie dostaje podsumowania, na przykład po imporcie starego czatu. Panel **Missing Summaries** w tym oknie ma przycisk **Backfill**, który ponawia próbę dla ostatnich dni bez podsumowania. Sięga wstecz najwyżej o 14 dni naraz.

Zmiana połączenia lub modelu używanego do podsumowań nie przepisuje wpisów dziennych i tygodniowych, które już istnieją.

## Rozwiązywanie problemów

### Memory Recall nic nie przywołuje

- Sprawdź, czy skonfigurowane jest źródło embeddingów. Jeśli fragmenty w oknie **Memories for This Chat** mają status **Embedding unavailable**, uzupełnij sekcję **Semantic Search (Embeddings)** w połączeniu albo oprzyj się na wbudowanym modelu lokalnym. Zobacz przewodnik [Konfiguracja modelu Local Model](../connections/local-model.md).
- Jeśli fragmenty mają status **Waiting for vector**, daj im chwilę. Odciski palca powstają po odpowiedziach.
- Wyszukiwanie dokłada wyłącznie wspomnienia blisko związane z twoją ostatnią wiadomością. Gdy nic nie pasuje, nie dokłada nic. Tak ma być.
- Jeśli model embeddingów zmienił się niedawno, użyj ikony odświeżania w oknie **Memories for This Chat**, żeby stare fragmenty pasowały do nowego modelu.

### Podsumowania nie powstają

- Sprawdź, czy czat ma działające połączenie tekstowe. Panel **Chat Summary** używa połączenia z panelu **Summary Connection**, a sekcja **Automatic Summarization** ustalonego połączenia do podsumowań. Gdy żadne nie działa, generowanie zostaje pominięte.
- Jeśli czat wymaga zatwierdzania zapisów przez agenta, podsumowania AI czekają na twoją zgodę.
- Nieudane podsumowanie ponawia się automatycznie po chwili. Jeśli sprawa stoi w miejscu, uruchom ręcznie przycisk **Backfill Summary** (Roleplay) albo **Backfill** (Conversation).

## Powiązane przewodniki

- [Konfiguracja modelu Local Model](../connections/local-model.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
