# Professor Mari, twoja asystentka w aplikacji

Professor Mari to wbudowana asystentka aplikacji Marinara Engine, dostępna na ekranie głównym. Z tego przewodnika dowiesz się, gdzie ją znaleźć, co potrafi, jak zostawia sobie możliwość cofnięcia zmian i jak rozwiązać typowe problemy.

## Gdzie ją znaleźć

Professor Mari mieszka na ekranie głównym. Ekran główny to widok, który pojawia się wtedy, gdy żaden czat nie jest otwarty.

Poszukaj karty z jej pikselowym obrazkiem i nagłówkiem **Professor Mari**. Linia stanu pokazuje **Ready to help**, kiedy asystentka czeka, albo **Working on it...**, kiedy pracuje. Kliknij przycisk **Ask Professor Mari** (zapytaj Professor Mari), żeby otworzyć pełne okno czatu.

Rozmawiasz z nią zwykłym językiem. Wpisz wiadomość w polu, a potem naciśnij Enter, żeby ją wysłać. Shift i Enter razem dodają nową linię.

Wysłanie pierwszej wiadomości odblokowuje osiągnięcie **Hello World**.

**Wskaźnik obecności Professor Mari**, zwykły czat z postacią Professor Mari i czat obszaru roboczego na ekranie głównym korzystają z tego samego formatu przekazania.

## Co potrafi

Professor Mari to coś więcej niż okienko na pytania. Wyjaśnia działanie aplikacji, pomaga w konfiguracji i tworzy różne rzeczy na życzenie.

Poproś ją o pomoc przy dowolnej z tych rzeczy:

- Wyjaśnienie ustawienia, trybu albo pojęcia, zanim cokolwiek zmienisz.
- Utworzenie lub edycja postaci. Postać to karta, która nadaje AI imię, osobowość i sposób mówienia.
- Utworzenie lub edycja persony. Persona to postać, w którą się wcielasz w czacie, czyli "ty" w opowieści.
- Utworzenie lub edycja lorebooka. Lorebook to zbiór faktów o twoim świecie, które AI wciąga do rozmowy, kiedy pasują do sytuacji.
- Utworzenie lub edycja motywu, agenta, presetu promptu albo szkicu rozszerzenia Personal Extension. Professor Mari jest jedyną domyślną autorką rozszerzeń. Jej szkice pozostają wyłączone, dopóki nie sprawdzisz kodu w piaskownicy i nie przejrzysz wymaganych uprawnień do aktywnej karty postaci lub persony. Na koniec zatwierdź dokładny skrót w **Settings** (Ustawienia) > **Addons**.
- Edycja jednego fragmentu presetu promptu na miejscu. Asystentka wypisuje pojedyncze sekcje presetu, grupy promptów i zmienne wyboru, a każdą z nich czyta w całości. Potem dodaje, zmienia albo usuwa sam ten fragment, na przykład dopisuje jedną linię do wybranej sekcji. Nie musi tworzyć ani podmieniać całego presetu.
- Porównanie wszystkich 33 oficjalnych agentów i pakietów funkcji do pobrania, wyjaśnienie, które tryby obsługują, i podpowiedź, które pasują do celu użytkownika. Asystentka odróżnia dostępność w katalogu od tego, co jest naprawdę zainstalowane, i w razie potrzeby kieruje do sekcji **Agents → Download Agents**. Zna też repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), gdzie leżą źródła pakietów i pełny katalog.
- Generowanie lub przypisywanie obrazów: awatarów, sprite'ów i teł. Sprite to obrazek postaci, na przykład portret albo cała sylwetka, pokazywany podczas czatu.
- Wyszukiwanie publicznych stron wiki Fandom, które pomagają zebrać informacje o postaci albo świecie.
- Prowadzenie przez wieloetapowe tworzenie lub edycję za pomocą kafelków z podpowiedziami nad polem wiadomości, oznaczonych kolorami według typu elementu.

Zanim coś zmieni, najpierw to czyta, a przy niejasnej prośbie dopytuje o brakujące szczegóły. Zadania graficzne wymagają wcześniej skonfigurowanego, działającego połączenia do generowania obrazów. Asystentka sama takiego połączenia nie utworzy.

## Kafelki z podpowiedziami

W pustym czacie z Professor Mari pojawiają się kafelki startowe, takie jak **Create a Character**, **Create a Lorebook** i **Create a Persona** – ułatwiają rozpoczęcie typowych zadań. W trakcie prowadzonego tworzenia lub edycji kafelki zmieniają się zgodnie z kolejnym krokiem. Kliknięty kafelek wypełnia treść pola wiadomości, a tę treść można jeszcze poprawić przed wysłaniem.

Prowadzone kroki to jedno konkretne pytanie naraz, zamiast długiego formularza podanego od razu w całości.

## Może też czytać i zmieniać pliki samej aplikacji

Professor Mari zagląda do plików programu aplikacji Marinara Engine, zmienia je i uruchamia polecenia w piaskownicy. To realna i potężna możliwość, więc warto dobrze zrozumieć jej granice.

Oto granica zaufania w prostych słowach:

- Narzędzia plikowe działają wyłącznie w folderze, w którym zainstalowana jest aplikacja Marinara Engine. Surowe polecenia powłoki mogą czytać przestrzeń roboczą i potrzebne programy systemowe, ale nie sięgną do innych plików osobistych.
- Pliki z sekretami środowiska, takie jak `.env`, oraz wewnętrzne pliki Git pozostają niedostępne dla narzędzi plikowych i surowej powłoki.
- Nie zapisuje niczego wprost w folderze z zapisanymi danymi, gdzie leżą postacie i czaty. Zamiast tego korzysta z opisanego niżej trybu zmian do zatwierdzenia.
- Surowe polecenia powłoki nie mają dostępu do sieci, nie dziedziczą sekretów serwera i mogą zapisywać tylko zwykłe pliki przestrzeni roboczej oraz prywatny folder tymczasowy.
- Zwykłe pliki źródłowe może edytować dalej bez ograniczeń. Zmiany w manifestach zależności, plikach blokad, programach uruchamiających, instalatorach i przepływach CI czekają w poczekalni i pokazują się do wglądu, zanim aplikacja Marinara Engine je zastosuje.
- Jeśli zmiana w kodzie wymaga publicznej biblioteki npm, asystentka prosi o konkretny pakiet. Marinara Engine zamienia `latest` na dokładną wersję, pokazuje jej sumę kontrolną z rejestru na karcie do zatwierdzenia i instaluje ją dopiero po twojej zgodzie. Skrypty cyklu życia pakietu pozostają wyłączone.
- Jeśli aplikacja Marinara Engine nie może uruchomić piaskownicy powłoki dla macOS albo Linux, surowe polecenia powłoki są wyłączone. Zostają bezpieczniejsze narzędzia do pracy z plikami i danymi aplikacji.
- Uruchamiane polecenia same kończą się po krótkim czasie, więc zawieszone polecenie nie będzie działać w nieskończoność.

Większość osób nigdy tego nie potrzebuje. Ta możliwość istnieje po to, żeby asystentka mogła sprawdzić albo naprawić samą aplikację, kiedy coś się zepsuje.

## Wybór połączenia

Do myślenia Professor Mari potrzebuje połączenia. Połączenie łączy aplikację Marinara Engine z dostawcą AI za pomocą klucza API. Klucz API to tajny kod od tego dostawcy, trochę jak hasło.

Kliknij ikonę ogniwa obok spinacza, żeby otworzyć listę rozwijaną **Connections** (Połączenia). Wybierz dowolne skonfigurowane połączenie do generowania tekstu. Pobrany wbudowany model lokalny też się tu pojawia, jako **Local Model (sidecar)**. Jeśli aplikacja zna nazwę modelu, w nawiasie widnieje właśnie ta nazwa. Wybór zapamiętuje się w przeglądarce.

Kiedy nie ma jeszcze żadnych połączeń, lista rozwijana pokazuje **Add a connection**. Próba wysłania wiadomości bez połączenia otwiera panel **Connections**. Pojawia się też komunikat wyskakujący (nazywany toastem):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

Pełny opis krok po kroku znajdziesz w przewodniku o połączeniach, podlinkowanym na końcu.

## Dołączanie plików

Kliknij przycisk spinacza, opisany jako **Attach files** (dołączenie plików), żeby dodać plik do wiadomości.

Asystentka przyjmuje obrazy, pliki PDF i popularne pliki tekstowe, takie jak `.txt`, `.md`, `.json`, `.csv` i `.log`. Każdy plik może mieć do 20 MB. Dołączone pliki pokazują się jako kafelki nad polem wiadomości i przed wysłaniem da się je usunąć.

Żeby asystentka odczytała obraz, model wybranego połączenia musi obsługiwać obrazy na wejściu.

## Sprawdzanie jej zmian

Kiedy Professor Mari edytuje coś, co już istnieje, zapisuje zmianę od razu, a potem pokazuje kartę do zatwierdzenia. Dzięki temu efekt, który się nie podoba, da się cofnąć.

Karta nosi tytuł **Review Mari's changes**. Pokazuje, co asystentka zrobiła i jakich danych to dotyczyło. Ma dwa przyciski:

- Przycisk **Keep** zatwierdza zmianę. Widać wtedy komunikat "Kept Mari's workspace change."
- Przycisk **Restore** przywraca poprzednią zapisaną wersję. Widać wtedy komunikat "Restored the previous app data snapshot."

Kilka rzeczy warto wiedzieć:

- Zupełnie nowe elementy, na przykład świeża postać albo lorebook, zwykle pomijają ten krok. Nic istniejącego nie zostało nadpisane, więc nie ma czego cofać.
- Karta do zatwierdzenia wygasa sama po 10 minutach bez odpowiedzi.
- Postacie i persony trzymają też własną historię wersji w swoich edytorach. Starszą wersję da się przywrócić właśnie tam, jako drugie zabezpieczenie.

Dwie zmiany o większym ryzyku czekają na decyzję, zamiast zostać zastosowane od razu:

- **Sensitive file changes** (zmiany plików wrażliwych) pokazują ścieżkę i proponowaną treść wraz z przyciskami **Apply change** i **Discard**. Dotyczy to plików zależności, programów uruchamiających, instalatorów i przepływów CI. Zwykłe edycje plików TypeScript, React, CSS, promptów, tras i dokumentacji nie wymagają tej dodatkowej zgody.
- **Dependencies** (zależności) pokazują dokładny publiczny pakiet npm, wersję, docelową przestrzeń roboczą, typ zależności, sumę kontrolną z rejestru i zadeklarowane zależności bezpośrednie wraz z przyciskami **Install** i **Not now**. Surowe polecenia instalacji `npm`, `pnpm`, `yarn`, `pip` i podobne są w jej powłoce zablokowane, łącznie z instalacją z pamięci podręcznej.

Zatwierdzenie biblioteki oznacza zaufanie jej kodowi, kiedy aplikacja Marinara Engine później go zaimportuje albo uruchomi. Wyłączone skrypty cyklu życia blokują wykonanie kodu przy instalacji, ale nie sprawią, że biblioteka stanie się nieszkodliwa w trakcie działania.

## Własne dokumenty Skill

Skill to krótki dokument z instrukcjami, który zmienia sposób obsługi pewnego rodzaju próśb przez Professor Mari.

Kliknij przycisk **Skills** w nagłówku jej czatu, żeby otworzyć panel **Professor Mari Skills**. Można w nim:

- Kliknąć przycisk **New**, żeby zacząć nowy Skill z szablonu.
- Kliknąć przycisk **Upload**, żeby dodać Skill z pliku `.md` albo `.txt`.
- Włączyć albo wyłączyć każdy Skill z osobna. Wyłączony Skill nadal istnieje, ale nie jest używany.
- Wybrać Skill i zmienić pola **Name**, **Description** oraz **Instructions**, a potem kliknąć przycisk **Save**. Przycisk **Delete** go usuwa.

Kiedy nie ma jeszcze żadnych własnych dokumentów Skill, panel pokazuje napis **No custom skills yet**.

## Zapisane wspomnienia

Professor Mari zapamiętuje stałe preferencje, więc nie trzeba ich powtarzać w każdym czacie. Chodzi na przykład o sposób formatowania lorebooków i kart postaci, przyjęte nazewnictwo albo oczekiwany sposób jej działania.

Wspomnienie można jej przekazać na dwa sposoby:

- **Powiedz jej o tym.** Wystarczy zdanie w stylu "zapamiętaj, że wpisy w lorebookach zawsze opieram na imieniu postaci i jej przezwisku". Asystentka zapisuje je i pokazuje kartę do zatwierdzenia **Keep/Restore** z dokładnym brzmieniem. Zapisane wspomnienie jest na starcie **wyłączone**, więc niczego nie zmienia, dopóki go nie włączysz. Karta ma wtedy trzeci przycisk, **Keep & Enable** (zachowaj i włącz), który zapisuje wspomnienie i od razu je włącza.
- **Dodaj je samodzielnie.** Kliknij przycisk **Memories** (wspomnienia) w nagłówku jej czatu, żeby otworzyć panel **Memories**. Można w nim tworzyć, edytować, włączać, wyłączać i usuwać wspomnienia. Przycisk **Upload** wczytuje plik `.md` albo zwykły plik tekstowy i zamienia jego treść we wspomnienie.

Asystentka zapisuje albo zmienia wspomnienie tylko wtedy, gdy **ty** ją o to poprosisz. Nigdy nie robi tego dlatego, że tak nakazuje przeczytana przez nią treść: postać, lorebook albo plik.

Jak z nich korzysta i dlaczego to nie obciąża promptu:

- W każdej turze asystentka widzi krótki **spis** *włączonych* wspomnień: same tytuły i jednolinijkowe opisy. Prawie nic to nie kosztuje. Kiedy wspomnienie pasuje do bieżącego zadania, asystentka sięga po jego pełną treść i stosuje się do niej. Dzięki temu prompt nie rośnie wraz z liczbą wspomnień, bo na stałe obecny jest tylko krótki spis. Wyjątkiem jest wspomnienie oznaczone jako **Persistent** (trwałe, opisane niżej). Jego pełna treść trafia do promptu w każdej turze, dlatego takich wspomnień twórz niewiele i pisz je krótko. Wyłączone wspomnienie nadal istnieje, ale jest pomijane. Dowolne wspomnienie można więc wyłączyć na czas eksperymentu i później włączyć z powrotem.
- W razie konfliktu zapisane wspomnienia **mają pierwszeństwo przed jej domyślnym zachowaniem**. Na przykład wspomnienie "kiedy pytam, jak coś zrobić, po prostu to zrób" przywraca edycję bez dopytywania. Wygrywa wtedy z jej zwyczajem upewniania się przed działaniem.
- Rzadką wytyczną, która ma obowiązywać w *każdej* turze, oznacz jako **Persistent**. Jej pełna treść jest wtedy zawsze widoczna dla asystentki. Wspomnień trwałych twórz niewiele i pisz je krótko, bo każde jest stale obecne w treści promptu. Opisuj nimi tylko zachowania, które mają obowiązywać zawsze.

Wspomnieniami zarządzaj w panelu **Memories** albo poproś o to asystentkę: "co pamiętasz?", "dopisz tytuły do wspomnienia o formatowaniu lorebooków" albo "zapomnij o tym".

## Historia czatów i przycisk **Restart**

Professor Mari prowadzi własne, osobne czaty. Nie pojawiają się one na zwykłej liście czatów.

Kliknij przycisk **Chats** w jej nagłówku, żeby otworzyć zapisane czaty z Professor Mari. Panel informuje: "Restart saves the current chat here." Zapisany czat da się kliknąć, żeby go otworzyć, zmienić mu nazwę albo go usunąć.

Kliknij przycisk **Restart** (zacznij od nowa), żeby zacząć z nią czat od zera. Restart najpierw zapisuje bieżący czat na liście **Chats**. To samo robi wpisanie `/restart` w polu wiadomości. Widać wtedy komunikat "Professor Mari's previous chat was saved."

Kiedy asystentka pracuje, w nagłówku pojawia się przycisk **Stop**. Kliknięcie go anuluje bieżące zadanie.

## Pływający dymek czatu

Jeśli okno jej czatu zostaje otwarte, a ty przechodzisz na inną stronę, Professor Mari może podążać za tobą jako mały pływający dymek.

Na telefonie albo wąskim ekranie zmienia się w mały okrągły awatar, który da się przeciągać. Dotknięcie go otwiera pełny czat z powrotem. Na szerokim ekranie pojawia się małe przeciągalne okno **Ask Professor Mari**. Każda wersja ma element sterujący, który chowa dymek do końca sesji.

## Sekcja FAQ działa osobno od czatu

Obok karty czatu ekran główny pokazuje panel **FAQ**. To stała, spisana lista pytań i odpowiedzi. To nie jest czat z AI.

Wpisz coś w polu **Search FAQ**, żeby przefiltrować pytania. Każde pytanie ma kolorowy tag kategorii, na przykład **Setup**, **Connections** albo **Game Mode**. Dotknij pytania, żeby przeczytać odpowiedź.

Ponieważ treść FAQ jest wpisana w aplikację, nie zna twojej bieżącej konfiguracji. O własne dane albo aktualny stan pytaj na czacie.

## Ograniczenia i bezpieczeństwo

Professor Mari to asystentka, a nie pełna dokumentacja. Pamiętaj o tych ograniczeniach:

- Nie może obiecać, że jej wbudowana wiedza odpowiada dokładnie twojej wersji aplikacji. Gdy coś zależy od wersji albo zmieniło się niedawno, zaufaj najpierw przewodnikom i informacjom o wydaniu.
- Tworzenie nowych treści jest zwykle bezpieczne, bo nic nie zostaje nadpisane. Edycja istniejących treści wymaga większej ostrożności.
- Zatwierdzona zależność to kod z zewnątrz, który w trakcie działania ma taki sam dostęp jak importujący go kod aplikacji Marinara Engine. Sprawdź nazwę pakietu, dokładną wersję, przeznaczenie i sumę kontrolną pokazane na karcie zatwierdzenia.
- Przy edycji podaj dokładnie element i dokładnie pole do zmiany. Prośba w stylu "przepisz całą tę postać" jest bardziej ryzykowna niż "skróć powitanie Luny, zostaw jej osobowość bez zmian".
- Przy wieloetapowym tworzeniu odpowiadaj na jedno konkretne pytanie naraz, korzystając z kafelków z podpowiedziami, zamiast podawać wszystkie pola za jednym razem.
- Jeśli asystentka twierdzi, że skończyła zadanie, a aplikacja tego nie pokazuje, zaufaj aplikacji. Dokończ zadanie samodzielnie w odpowiednim panelu.
- Jeśli aplikacja Marinara Engine jest otwierana z innego urządzenia, a nie z tego samego komputera, jej działania edycyjne wymagają skonfigurowanego dostępu zdalnego. Zajrzyj do przewodnika o dostępie zdalnym.

## Rozwiązywanie problemów

- Brak jakiejkolwiek odpowiedzi: sprawdź, czy przy ikonie ogniwa wybrane jest połączenie. Jeśli żadnego nie ma, otwórz panel **Connections** i dodaj jedno.
- Komunikat wyskakujący "You haven't set up a connection yet": wybierz połączenie z listy rozwijanej pod ikoną ogniwa albo najpierw jakieś dodaj.
- Asystentka nie odczytuje dołączonego obrazu: model musi obsługiwać obrazy na wejściu. Przełącz się na połączenie, którego model widzi obrazy.
- Wyszukiwanie w Fandom nie działa: wymaga ono dostępu do internetu, bo Fandom to zewnętrzna strona.
- Jej działania blokuje błąd uprawnień: aplikacja Marinara Engine jest otwierana przez sieć, a nie z tego samego komputera. Najpierw skonfiguruj dostęp zdalny.

## Powiązane przewodniki

- [Pierwsze kroki z aplikacją Marinara Engine](welcome.md)
- [Samouczek przy pierwszym uruchomieniu](tutorial.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
