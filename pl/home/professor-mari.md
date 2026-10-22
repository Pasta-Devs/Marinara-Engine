# Professor Mari, twoja asystentka w aplikacji

Professor Mari to wbudowana asystentka aplikacji Marinara Engine, dostępna na ekranie głównym. Z tego przewodnika dowiesz się, gdzie ją znaleźć, co potrafi, jak zostawia sobie możliwość cofnięcia zmian i jak rozwiązać typowe problemy.

<a id="where-to-find-her"></a>

## Gdzie ją znaleźć

Professor Mari mieszka na ekranie głównym. Ekran główny to widok, który pojawia się wtedy, gdy żaden czat nie jest otwarty.

Poszukaj widgetu **Professor Mari** z jej pikselowym obrazkiem, a potem kliknij **Ask Professor Mari** (zapytaj Professor Mari), żeby otworzyć pełne okno czatu. Otwiera je też zakładka **Professor** u góry ekranu głównego. Jej okno otwiera się wewnątrz wyszukiwarki Search, więc możesz do niej dotrzeć z każdego ekranu: wpisz coś w polu Search i wybierz **Ask Prof. Mari** (zapytaj Professor Mari), naciśnij Ctrl+J (Cmd+J na Macu) albo na telefonie pociągnij w dół od górnego paska. Linia stanu w nagłówku jej okna pokazuje **Ready to help**, kiedy asystentka czeka, albo **Working on it...**, kiedy pracuje.

Rozmawiasz z nią zwykłym językiem. Wpisz wiadomość w polu, a potem naciśnij Enter, żeby ją wysłać. Shift i Enter razem dodają nową linię. Jeśli w jej ustawieniach wyłączysz **Enter sends to Professor Mari** (wysyłanie do Professor Mari klawiszem Enter), Enter doda nową linię, a wiadomość wyśle Ctrl+Enter (Cmd+Enter na Macu).

Wysłanie pierwszej wiadomości odblokowuje osiągnięcie **Hello World**.

Jej stan pokazuje też na każdym ekranie cienka linia wzdłuż dolnej krawędzi górnego paska aplikacji: faluje, kiedy asystentka pracuje, robi się zielona, kiedy skończy, złota, kiedy coś czeka na zatwierdzenie, albo czerwona, jeśli ostatnie zadanie się nie powiodło. Znika po otwarciu jej czatu. Linia jest wyłączona, gdy wyłączony jest przełącznik **Ask Professor Mari from Search** (pytania do Professor Mari z wyszukiwarki). Gdy jej okno jest zamknięte, mała plakietka na górnym pasku pokazuje ten sam stan jako **Working** (pracuje), **Needs you** (czeka na ciebie), **Done** (gotowe) albo **Failed** (niepowodzenie). Kliknij plakietkę, żeby wrócić do jej czatu. Wszystkie jej ustawienia znajdują się w ustawieniach wyszukiwarki Search i asystentki Professor Mari: otwiera je ikona koła zębatego w wyszukiwarce Search albo ścieżka **Settings** (Ustawienia) > **General** > **Search and Professor Mari settings** (ustawienia wyszukiwarki i asystentki Professor Mari) > **Open** (otwarcie).

Na komputerze możesz tam też zmienić rozmiar jej okna. Użyj suwaków **Height** (wysokość) i **Width** (szerokość) w sekcji **Professor Mari window** (okno Professor Mari). Suwaki w sekcji **Search window** (okno wyszukiwarki) robią to samo dla wyszukiwarki Search; jej wysokość zaczyna od **Automatic** (automatycznie). Na telefonie oba okna zawsze wypełniają ekran.

## Pytanie do Professor Mari prosto z bieżącej pracy

Professor Mari to coś więcej niż okienko na pytania. Wyjaśnia działanie aplikacji, pomaga w konfiguracji i tworzy różne rzeczy na życzenie.

Asystentkę Professor Mari możesz otworzyć z miejsca, w którym potrzebujesz pomocy. Te punkty wejścia tworzą szkic do edycji i dołączają krótkie podsumowanie kontekstu z oznaczonym typem. Dołączony kontekst da się usunąć przed wysłaniem wiadomości.

- Edytory **Character**, **Persona**, **Lorebook** i **Preset**: zapytaj o otwarty zasób albo o wybrane pole.
- Odpowiedzi w **FAQ**: użyj **Ask Prof. Mari about this** (zapytaj o to Professor Mari), żeby dołączyć dopasowane pytanie i jego spisaną odpowiedź jako punkt wyjścia.
- **Search** (wyszukiwarka): naciśnij `Cmd/Ctrl+K`, wybierz wynik, a potem użyj **Ask Prof. Mari**, żeby dołączyć wybrany wynik do szkicu. Sama wyszukiwarka Search nie wysyła żądania do modelu, chyba że włączona jest szybka odpowiedź – zobacz niżej sekcję **Quick answers in Search** (szybkie odpowiedzi w wyszukiwarce).
- **Recent Chats** (ostatnie czaty) i inne stany błędu: użyj **Ask Professor Mari** obok **Try again** (ponowna próba), żeby wysłać opis błędu i żądaną naprawę.
- Zwykły czat z postacią Professor Mari i czat przestrzeni roboczej na ekranie głównym używają tego samego formatu przekazania.

Dołączone elementy pojawiają się nad polem wiadomości jako kafelki **Context** (kontekst). Usuń element kontekstu, jeśli nie ma związku z prośbą. Większą treść zasobu Professor Mari pobiera na serwerze w ramach budżetu kontekstu, już po wysłaniu wiadomości. Nie dostaje pełnego zasobu tylko dlatego, że masz otwarty edytor.

Poproś ją o pomoc przy dowolnej z tych rzeczy:

- Wyjaśnienie ustawienia, trybu albo pojęcia, zanim cokolwiek zmienisz.
- Utworzenie lub edycja postaci. Postać to karta, która nadaje AI imię, osobowość i sposób mówienia. Asystentka potrafi też napisać onboarding karty, czyli pytania, na które odpowiadają gracze, żeby zbudować swoją personę. Opisuje go przewodnik [Interaktywny onboarding](../characters/interactive-onboarding.md).
- Utworzenie lub edycja persony. Persona to postać, w którą się wcielasz w czacie, czyli "ty" w opowieści.
- Utworzenie lub edycja lorebooka. Lorebook to zbiór faktów o twoim świecie, które AI wciąga do rozmowy, kiedy pasują do sytuacji.
- Utworzenie lub edycja motywu, agenta, presetu promptu albo szkicu rozszerzenia Personal Extension. Professor Mari jest jedyną domyślną autorką rozszerzeń. Jej szkice pozostają wyłączone, dopóki nie sprawdzisz kodu w piaskownicy i nie przejrzysz wymaganych uprawnień do aktywnej karty postaci lub persony. Na koniec zatwierdź dokładny skrót w **Settings** (Ustawienia) > **Addons**.
- Edycja jednego fragmentu presetu promptu na miejscu. Asystentka wypisuje pojedyncze sekcje presetu, grupy promptów i zmienne wyboru, a każdą z nich czyta w całości. Potem dodaje, zmienia albo usuwa sam ten fragment, na przykład dopisuje jedną linię do wybranej sekcji. Nie musi tworzyć ani podmieniać całego presetu.
- Porównanie wszystkich 33 oficjalnych agentów i pakietów funkcji do pobrania, wyjaśnienie, które tryby obsługują, i podpowiedź, które pasują do celu użytkownika. Asystentka odróżnia dostępność w katalogu od tego, co jest naprawdę zainstalowane, i w razie potrzeby kieruje do sekcji **Agents → Download Agents**. Zna też repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), gdzie leżą źródła pakietów i pełny katalog.
- Generowanie lub przypisywanie obrazów: awatarów, sprite'ów i teł. Sprite to obrazek postaci, na przykład portret albo cała sylwetka, pokazywany podczas czatu.
- Wyszukiwanie publicznych stron wiki Fandom, które pomagają zebrać informacje o postaci albo świecie.
- Prowadzenie przez wieloetapowe tworzenie lub edycję za pomocą kafelków z podpowiedziami nad polem wiadomości, oznaczonych kolorami według typu elementu.

Zanim coś zmieni, najpierw to czyta, a przy niejasnej prośbie dopytuje o brakujące szczegóły. Zadania graficzne wymagają wcześniej skonfigurowanego, działającego połączenia do generowania obrazów. Asystentka sama takiego połączenia nie utworzy.

## Funkcja Quick answers in Search

Kiedy wpiszesz pytanie w wyszukiwarce Search i żaden wynik nie pasuje, Professor Mari może napisać krótką odpowiedź. Pojawia się ona jako karta **Quick answer · Read-only** (szybka odpowiedź, tylko do odczytu) pod wierszem **Ask Prof. Mari**.

- Szybka odpowiedź ma do trzech zdań opartych na dokumentacji aplikacji Marinara Engine. Asystentka widzi tylko wpisany przez ciebie tekst, a odpowiedź niczego nie zmienia.
- Karta wymienia strony dokumentacji, z których korzysta odpowiedź. Powtórzone pytanie przez pięć minut korzysta z zapisanej kopii.
- Pod odpowiedzią są przyciski **Copy** (kopiowanie), **Answer again** (ponowna odpowiedź) i **Continue with Prof. Mari** (kontynuacja z Professor Mari). **Continue with Prof. Mari** otwiera jej okno w nowym czacie nazwanym od twojego pytania, z dołączoną szybką odpowiedzią. Użyj **Ask Prof. Mari more…** (dalsze pytania do Professor Mari), żeby zadać pytanie uzupełniające w jej oknie. Szybkie odpowiedzi nie mają własnych pytań uzupełniających.
- Szybka odpowiedź czeka, aż przestaniesz pisać. Ustawienie **Wait after typing** (czas oczekiwania po wpisaniu) określa, jak długo wyszukiwarka Search czeka.
- Wybierz, kto odpowiada, w **Settings** > **General** > **Search and Professor Mari settings** > **Quick answers** (szybkie odpowiedzi) > **Answer with** (źródło odpowiedzi): pobrany model lokalny, **Same as Prof. Mari** (to samo połączenie, którego używa asystentka) albo inne połączenie. Każda odpowiedź to jedno krótkie żądanie. Płatne połączenie może generować koszty.
- Jeśli odpowiedź się nie uda, karta podaje przyczynę, na przykład że model nie odpowiedział. Przyciski **Try again** (ponowna próba) i **Continue with Prof. Mari** są zawsze dostępne. **Choose a model** (wybór modelu) pojawia się tylko wtedy, gdy brakuje klucza albo modelu. Własny komunikat dostawcy znajduje się pod **Details** (szczegóły).
- Szybkie odpowiedzi są wyłączone, dopóki nie włączysz ich przełącznikiem **Quick answers in Search** w tej samej grupie.

## Kafelki z podpowiedziami

W pustym czacie z Professor Mari pojawiają się kafelki startowe, takie jak **Create a Character**, **Create a Lorebook** i **Create a Persona** – ułatwiają rozpoczęcie typowych zadań. W trakcie prowadzonego tworzenia lub edycji kafelki zmieniają się zgodnie z kolejnym krokiem. Kliknięty kafelek wypełnia treść pola wiadomości, a tę treść można jeszcze poprawić przed wysłaniem.

Prowadzone kroki to jedno konkretne pytanie naraz, zamiast długiego formularza podanego od razu w całości.

Przy pełnej prośbie o utworzenie lub edycję Professor Mari może zwrócić prowadzony plan o ograniczonej liczbie kroków. Każdy krok ma niewielki zestaw podpowiedzi. Wybranie jednej z nich wypełnia bieżący szkic i lokalnie przesuwa plan do następnego kroku. Po zmianie podpowiedzi twój tekst zostaje w szkicu. Plan należy do bieżącego czatu z Professor Mari, więc przełączenie czatu, restart, zatrzymanie zadania albo ukończenie planu usuwa nieaktualne kroki. Wadliwe albo nadmiarowe podpowiedzi są odrzucane, a kafelki są nieaktywne, kiedy Professor Mari pracuje.

Podpowiedzi są dostępne tylko w czatach z Professor Mari. Inne postacie nie dostają kafelków Professor Mari.

## Może też czytać i zmieniać pliki samej aplikacji

Professor Mari zagląda do plików programu aplikacji Marinara Engine, zmienia je i uruchamia polecenia w piaskownicy. To realna i potężna możliwość, więc warto dobrze zrozumieć jej granice.

Oto granica zaufania w prostych słowach:

- Narzędzia plikowe działają wyłącznie w folderze, w którym zainstalowana jest aplikacja Marinara Engine. Surowe polecenia powłoki mogą czytać przestrzeń roboczą i potrzebne programy systemowe, ale nie sięgną do innych plików osobistych.
- Pliki z sekretami środowiska, takie jak `.env`, plik z kluczem, który chroni zapisane klucze API, oraz wewnętrzne pliki Git pozostają niedostępne dla narzędzi plikowych i surowej powłoki.
- Nie zapisuje niczego wprost w folderze z zapisanymi danymi, gdzie leżą postacie i czaty – ani przez narzędzia plikowe, ani przez surową powłokę. Zamiast tego korzysta z opisanego niżej trybu zmian do zatwierdzenia.
- Surowe polecenia powłoki nie mają dostępu do sieci, nie dziedziczą sekretów serwera i mogą zapisywać tylko zwykłe pliki przestrzeni roboczej oraz prywatny folder tymczasowy.
- Zwykłe pliki źródłowe może edytować dalej bez ograniczeń. Zmiany w manifestach zależności, plikach blokad, programach uruchamiających, instalatorach i przepływach CI czekają w poczekalni i pokazują się do wglądu, zanim aplikacja Marinara Engine je zastosuje.
- Może czytać zbudowane pliki aplikacji Marinara Engine, czyli foldery `dist`, z których działa program, ale nie może ich tworzyć, edytować, przenosić ani usuwać. Zamiast tego zmienia pliki źródłowe. Zbudowane pliki przebudowuje tylko polecenie `mari code check`, w tej samej piaskownicy.
- Jeśli zmiana w kodzie wymaga publicznej biblioteki npm, asystentka prosi o konkretny pakiet. Marinara Engine zamienia `latest` na dokładną wersję, pokazuje jej sumę kontrolną z rejestru na karcie do zatwierdzenia i instaluje ją dopiero po twojej zgodzie. Skrypty cyklu życia pakietu pozostają wyłączone.
- Jeśli aplikacja Marinara Engine nie może uruchomić piaskownicy powłoki dla macOS albo Linux, surowe polecenia powłoki i polecenie `mari code check` są wyłączone. Zostają bezpieczniejsze narzędzia do pracy z plikami i danymi aplikacji.
- Uruchamiane polecenia same kończą się po krótkim czasie, więc zawieszone polecenie nie będzie działać w nieskończoność.

Większość osób nigdy tego nie potrzebuje. Ta możliwość istnieje po to, żeby asystentka mogła sprawdzić albo naprawić samą aplikację, kiedy coś się zepsuje.

## Wybór połączenia

Do myślenia Professor Mari potrzebuje połączenia. Połączenie łączy aplikację Marinara Engine z dostawcą AI za pomocą klucza API. Klucz API to tajny kod od tego dostawcy, trochę jak hasło.

Kliknij przycisk połączenia obok spinacza. Pokazuje on ikonę ogniwa i nazwę połączenia, którego używa asystentka, albo **Select connection** (wybór połączenia), gdy żadne nie jest wybrane. Otwiera listę **Connections** (Połączenia). Wybierz dowolne skonfigurowane połączenie do generowania tekstu. Pobrany wbudowany model lokalny też się tu pojawia, jako **Local Model (sidecar)**. Jeśli aplikacja zna nazwę modelu, w nawiasie widnieje właśnie ta nazwa. Wybór zapisuje się razem z preferencjami aplikacji.

To samo menu wymienia też modele wybranego połączenia. Kliknij model, żeby go użyć. Model zapisuje się w połączeniu tak jak w zwykłym czacie, więc inne czaty korzystające z tego połączenia też się na niego przełączają. Na telefonie albo w wąskim oknie dotknij połączenia, żeby się na nie przełączyć, albo dotknij strzałki na końcu jego wiersza, żeby najpierw zobaczyć jego modele. Wbudowany model lokalny nie ma listy modeli.

Kiedy nie ma jeszcze żadnych połączeń, lista pokazuje **Add a connection** (dodanie połączenia). Kliknij tę pozycję, żeby utworzyć połączenie. Próba wysłania wiadomości bez połączenia otwiera listę **Connections**, żeby można było jakieś wybrać.

Pełny opis krok po kroku znajdziesz w przewodniku o połączeniach, podlinkowanym na końcu.

## Wypróbowanie środowiska Pi (eksperymentalne)

Professor Mari może działać na dwa sposoby. **Classic** (klasyczny) jest ustawieniem domyślnym. **Pi** to wersja próbna: asystentka więcej myśli, zanim podejmie działanie, i radzi sobie z dłuższymi zadaniami.

Żeby przełączyć, otwórz **Search and Professor Mari settings** i zmień **Runtime** (środowisko uruchomieniowe) pod **Permissions mode** (tryb uprawnień). Zmiana obowiązuje od następnej odpowiedzi asystentki. Tryb uprawnień, karty zmian i Undo (cofnięcie) działają tak samo w obu sposobach.

Pi działa z każdym połączeniem, także z modelem lokalnym. Jeśli Professor Mari dziwnie się zachowuje w trybie Pi, wróć do ustawienia Classic.

## Zmiana jej wyglądu

Otwórz **Search and Professor Mari settings** i przewiń do sekcji **Appearance** (wygląd). Wybierz jej wygląd, na przykład **Basic** (podstawowy), **Prof. Mari loves Dottore** albo **Safari Prof. Mari**. Nowy wygląd pokazuje się w jej czacie, w wyszukiwarce Search, na ekranie głównym i na górnym pasku. Niektóre wyglądy odblokowują się po odpowiednio długim czasie gry. Zablokowany wygląd pokazuje, ile godzin gry masz już za sobą.

## Dołączanie plików

Kliknij przycisk spinacza, opisany jako **Attach files** (dołączenie plików), żeby dodać plik do wiadomości.

Asystentka przyjmuje obrazy, pliki PDF i popularne pliki tekstowe, takie jak `.txt`, `.md`, `.json`, `.csv` i `.log`. Każdy plik może mieć do 20 MB. Dołączone pliki pokazują się jako kafelki nad polem wiadomości i przed wysłaniem da się je usunąć.

Żeby asystentka odczytała obraz, model wybranego połączenia musi obsługiwać obrazy na wejściu.

## Sprawdzanie jej zmian

Kiedy Professor Mari coś zmienia, od razu zapisuje zmianę i pokazuje pod swoją odpowiedzią kartę zmiany. Karta wymienia każde zmienione pole. Edycja tekstu pokazuje stare i nowe słowa, a lorebook pokazuje swoje wpisy. Zmiana głębiej wewnątrz elementu, na przykład w onboardingu karty, dostaje własne pole z nazwą tego, co się zmieniło. Otwórz **Show all** (pokaż wszystko), żeby zobaczyć każde pole. **Technical details** (szczegóły techniczne) pokazuje surowe polecenie.

Karta ma jedną akcję:

- **Undo** (cofnięcie) przywraca poprzednią zapisaną wersję. Każdą zmianę da się cofnąć, w każdym trybie uprawnień. Tryb uprawnień decyduje tylko o tym, czy asystentka najpierw pyta.
- Zmiana, której nie udało się zapisać, pokazuje **Not saved** (nie zapisano) i przyczynę. **Try again** prosi asystentkę o ponowną próbę.
- Karta pokazuje **Undo until** (cofnięcie możliwe do) tylko w ostatnich 24 godzinach. Kopia do cofnięcia zostaje maksymalnie przez 14 dni i przechowywanych jest tylko 50 najnowszych. Potem zmiana zostaje, a karta pokazuje **Undo closed** (cofnięcie niedostępne).

Inaczej jest ze zmianą, która czeka na ciebie. Wstrzymana zmiana (w trybie Manual albo zmiana pliku wrażliwego lub zależności) pokazuje **Apply** (zastosowanie) i **Don't apply** (rezygnacja z zastosowania). Usunięcie pokazuje **Delete** (usunięcie) i **Put back** (przywrócenie). Wyszukiwarka Search nie wyświetla jej zmian: otwórz asystentkę Professor Mari, żeby je zobaczyć, zastosować albo cofnąć.

- Karta należy do czatu z Professor Mari, w którym asystentka dokonała zmiany. Nowy czat zaczyna się bez kart z innych czatów. Usunięcie czatu zachowuje jego zmiany i usuwa jego karty. Zmiana wykonana poleceniem `mari` w terminalu nie należy do żadnego czatu, więc jej karta pojawia się we wszystkich czatach z Professor Mari.
- Edycja, która niczego by nie zmieniła, nie jest zapisywana i nie otrzymuje karty.
- Professor Mari nie może edytować ani usuwać własnej karty postaci. Przy każdym uruchomieniu aplikacja Marinara przywraca jej wbudowaną wersję.
- Postacie i persony trzymają też własną historię wersji w swoich edytorach. Starszą wersję da się przywrócić właśnie tam, jako drugie zabezpieczenie.

Kiedy Professor Mari tworzy albo aktualizuje postać, personę, lorebook lub preset, wynik może pokazywać przycisk **Open**. Użyj go, żeby otworzyć dokładnie ten zasób, gdy aplikacja odświeży dane. Zaktualizowany wynik może też pokazywać **Review** (przejrzyj), jeśli czeka przegląd. **Review** otwiera elementy sterujące oczekującą zmianą. Nowe elementy zwykle nie mają przeglądu, bo nie nadpisano żadnego istniejącego elementu.

Dwie zmiany o większym ryzyku czekają na decyzję, zamiast zostać zastosowane od razu:

- **Sensitive file changes** (zmiany plików wrażliwych) pokazują ścieżkę i proponowaną treść wraz z przyciskami **Apply change** i **Discard**. Dotyczy to plików zależności, programów uruchamiających, instalatorów i przepływów CI. Zwykłe edycje plików TypeScript, React, CSS, promptów, tras i dokumentacji nie wymagają tej dodatkowej zgody.
- **Dependencies** (zależności) pokazują dokładny publiczny pakiet npm, wersję, docelową przestrzeń roboczą, typ zależności, sumę kontrolną z rejestru i zadeklarowane zależności bezpośrednie wraz z przyciskami **Install** i **Not now**. Surowe polecenia instalacji `npm`, `pnpm`, `yarn`, `pip` i podobne są w jej powłoce zablokowane, łącznie z instalacją z pamięci podręcznej.

Zatwierdzenie biblioteki oznacza zaufanie jej kodowi, kiedy aplikacja Marinara Engine później go zaimportuje albo uruchomi. Wyłączone skrypty cyklu życia blokują wykonanie kodu przy instalacji, ale nie sprawią, że biblioteka stanie się nieszkodliwa w trakcie działania.

## Tworzenie treści z decyzjami

Professor Mari może pisać **Activation questions** (pytania aktywacyjne) agentów, stwierdzenia **Decision** (decyzja) wpisów lorebooka i prompty warunkowe w presetach, kartach, lorebookach oraz promptach agentów. Przed wprowadzeniem tych funkcji sprawdza wybrany model decyzyjny. Wybrany model jest informacją o konfiguracji, nie dowodem dostępności dostawcy ani udanego uruchomienia modelu lokalnego.

Bez wybranego modelu nie dodaje nowych zależności od decyzji przy zwykłym tworzeniu i edycji. Istniejącą treść decyzyjną zachowuje przy niezwiązanych zmianach. Jeśli wyraźnie poprosisz o decyzje, wyjaśnia właściwe zachowanie zastępcze i raz w danym czacie z Professor Mari pyta, czy kontynuować. Zapis odpowiedzi przetrwa ponowne otwarcie czatu i rozmowy dłuższe niż jej okno ostatnich wiadomości. Brak odpowiedzi lub odmowa nie oznacza zgody.

Możesz powiedzieć **"Stop reminding me to set up a Decision model."** Przestaje przypominać w bieżącym czacie i może zapisać preferencję jako wspomnienie. Użyj **Turn on** (włączenie), żeby stosować ją też w przyszłych czatach. Wyłączenie lub usunięcie wspomnienia usuwa stałą preferencję. Wyłączenie przypomnień nie upoważnia jej do dodawania decyzji do zwykłych próśb.

Z wybranym modelem stosuje odpowiednie włączone wspomnienia i umiejętności. Jeśli nie określają preferencji tworzenia, pyta, czy używać decyzji i czy zapamiętać odpowiedź. Możesz je dopuścić, odrzucić lub zezwolić tylko dla bieżącego zadania. Umiejętność opisująca samą składnię nie oznacza zgody. Bezpośrednia prośba, taka jak "add Decision activation to this entry", już daje zgodę dla zadania.

Domyślnie używa decyzji oszczędnie z odpowiednim sterowaniem czasem: **Sticky** (utrzymanie aktywności) lub **Cooldown** (przerwa) wpisów lorebooka, **Trigger Cadence** (częstotliwość uruchamiania) agentów oraz `sticky`, `cooldown` lub `every` warunków promptu. Sticky i Cooldown ograniczają ponowne sprawdzanie po pozytywnej aktywacji; nie zatrzymują sprawdzania przy ciągłym nie. `every` pomija sprawdzanie między zaplanowanymi turami i oznacza wtedy nie, więc nie zawsze pasuje do ulotnych zdarzeń.

Professor Mari stara się też utrzymać stabilny początek złożonego promptu. Pyta przed dodaniem zmiennej treści wcześnie w prompcie lub kontekstu wewnątrz historii czatu, chyba że instrukcja lub włączona preferencja już pozwala na takie umiejscowienie. Nie istnieje uniwersalna zasada "bezpiecznie po 1 000 tokenów": pamięć podręczna zależy od dostawcy, modelu i zgodnego wyrenderowanego początku. Zgoda na decyzje nie oznacza automatycznej zgody na te pozycje.

Zwykły tryb uprawnień i mechanizmy przeglądu nadal obowiązują przy edycji. Zapisywane wspomnienia są początkowo wyłączone, dopóki ich nie włączysz. Zakres danych, zachowania zastępcze i przykłady opisują [Modele decyzyjne](../connections/decision-models.md), [Prompty warunkowe](../prompts/conditional-prompts.md), [Własni agenci](../agents/custom-agents.md#activation-questions) i [Wpisy lorebooka](../lorebooks/entries.md#decision-activation).

## Własne dokumenty Skill

Skill to krótki dokument z instrukcjami, który zmienia sposób obsługi pewnego rodzaju próśb przez Professor Mari.

Kliknij przycisk **Skills** w nagłówku jej czatu, żeby otworzyć panel **Professor Mari skills**. Można w nim:

- Kliknąć przycisk **New**, żeby zacząć nowy Skill z szablonu.
- Kliknąć przycisk **Upload**, żeby dodać Skill z pliku `.md` albo `.txt`.
- Włączyć albo wyłączyć każdy Skill z osobna. Wyłączony Skill nadal istnieje, ale nie jest używany.
- Wybrać Skill i zmienić pola **Name**, **Description** oraz **Instructions**, a potem kliknąć przycisk **Save**. Przycisk **Delete** go usuwa.

Kiedy nie ma jeszcze żadnych własnych dokumentów Skill, panel pokazuje napis **No custom skills yet**.

## Zapisane wspomnienia

Professor Mari zapamiętuje stałe preferencje, więc nie trzeba ich powtarzać w każdym czacie. Chodzi na przykład o sposób formatowania lorebooków i kart postaci, przyjęte nazewnictwo albo oczekiwany sposób jej działania.

Wspomnienie można jej przekazać na dwa sposoby:

- **Powiedz jej o tym.** Wystarczy zdanie w stylu "zapamiętaj, że wpisy w lorebookach zawsze opieram na imieniu postaci i jej przezwisku". Asystentka zapisuje je i pokazuje kartę zmiany z dokładnym brzmieniem. Zapisane wspomnienie jest na starcie **wyłączone**, więc niczego nie zmienia, dopóki go nie włączysz. Karta ma przycisk **Turn on**, który od razu je włącza.
- **Dodaj je samodzielnie.** Kliknij przycisk **Memories** (wspomnienia) w nagłówku jej czatu, żeby otworzyć panel **Memories**. Można w nim tworzyć, edytować, włączać, wyłączać i usuwać wspomnienia. Przycisk **Upload** wczytuje plik `.md` albo zwykły plik tekstowy i zamienia jego treść we wspomnienie.

Asystentka zapisuje albo zmienia wspomnienie tylko wtedy, gdy **ty** ją o to poprosisz. Nigdy nie robi tego dlatego, że tak nakazuje przeczytana przez nią treść: postać, lorebook albo plik.

Jak z nich korzysta i dlaczego to nie obciąża promptu:

- W każdej turze asystentka widzi krótki **spis** *włączonych* wspomnień: same tytuły i jednolinijkowe opisy. Prawie nic to nie kosztuje. Kiedy wspomnienie pasuje do bieżącego zadania, asystentka sięga po jego pełną treść i stosuje się do niej. Dzięki temu prompt nie rośnie wraz z liczbą wspomnień, bo na stałe obecny jest tylko krótki spis. Wyjątkiem jest wspomnienie oznaczone jako **Persistent** (trwałe, opisane niżej). Jego pełna treść trafia do promptu w każdej turze, dlatego takich wspomnień twórz niewiele i pisz je krótko. Wyłączone wspomnienie nadal istnieje, ale jest pomijane. Dowolne wspomnienie można więc wyłączyć na czas eksperymentu i później włączyć z powrotem.
- W razie konfliktu zapisane wspomnienia **mają pierwszeństwo przed jej domyślnym zachowaniem**. Na przykład wspomnienie "kiedy pytam, jak coś zrobić, po prostu to zrób" przywraca edycję bez dopytywania. Wygrywa wtedy z jej zwyczajem upewniania się przed działaniem.
- Rzadką wytyczną, która ma obowiązywać w *każdej* turze, oznacz jako **Persistent**. Jej pełna treść jest wtedy zawsze widoczna dla asystentki. Wspomnień trwałych twórz niewiele i pisz je krótko, bo każde jest stale obecne w treści promptu. Opisuj nimi tylko zachowania, które mają obowiązywać zawsze.

Wspomnieniami zarządzaj w panelu **Memories** albo poproś o to asystentkę: "co pamiętasz?", "dopisz tytuły do wspomnienia o formatowaniu lorebooków" albo "zapomnij o tym".

## Historia czatów i przycisk **Restart**

Professor Mari prowadzi własne, osobne czaty. Nie pojawiają się one na zwykłej liście czatów.

Kliknij przycisk **Chats** w jej nagłówku, żeby otworzyć zapisane czaty z Professor Mari. Gdy lista jest pusta, panel informuje: "New chat keeps this one here." Użyj pola **Search Prof. Mari chats** (szukaj w czatach z Professor Mari), żeby znaleźć czat. Zapisany czat da się kliknąć, żeby go otworzyć, zmienić mu nazwę albo go usunąć.

Kliknij przycisk **New chat** (nowy czat), żeby zacząć z nią czat od zera. Najpierw zapisuje on bieżący czat na liście **Chats**. To samo robi wpisanie `/restart` w polu wiadomości. Widać wtedy komunikat "Professor Mari's previous chat was saved."

Kiedy asystentka pracuje, przycisk wysyłania zmienia się w przycisk **Stop**. Kliknięcie go anuluje bieżące zadanie.

## Wychodzenie z jej okna

Możesz zamknąć jej okno i dalej korzystać z aplikacji, kiedy ona pracuje. Linia i plakietka na górnym pasku pokazują, jak jej idzie, zgodnie z opisem w sekcji [Gdzie ją znaleźć](#where-to-find-her). Kliknij plakietkę, żeby wrócić do jej czatu.

## Zaufanie i odzyskiwanie po błędach

Otwórz **Context** w nagłówku czatu z Professor Mari, żeby zobaczyć, co zostanie dołączone do następnej wiadomości, co zostaje w tym czacie z Professor Mari i jak asystentka działa: jakim modelem odpowiada, jaki ma budżet kontekstu i czy jej polecenia powłoki działają w piaskownicy. Nagłówek pokazuje też oczekujące zatwierdzenia, dokumenty Skill i wspomnienia. Sprawdź je przed prośbą, kiedy potrzebujesz wiedzieć, co Professor Mari może przeczytać.

Professor Mari wprowadza istotne zmiany w przestrzeni roboczej wyłącznie w ramach istniejących reguł zatwierdzania i przeglądu po stronie serwera. **Context** nie daje dodatkowego dostępu. Zmiany plików wrażliwych, zmiany zależności, limity powłoki i walidację danych aplikacji nadal egzekwuje serwer.

Kiedy prośba się nie uda, zapis rozmowy zachowuje przyczynę błędu i pokazuje **Retry**, jeśli prośbę da się wysłać ponownie. Najpierw usuń wskazany problem z połączeniem, piaskownicą, możliwościami albo dostępem zdalnym, a potem ponów prośbę. Jeśli twoje pytanie nie zostało zapisane, wraca do pola wiadomości razem z plikami, więc możesz je najpierw zmienić. **Retry** i **Retry with another model** (ponów z innym modelem) wysyłają wtedy to, co jest w polu. Ponowienie nie uruchamia się po cichu z wyszukiwania, FAQ ani stanu błędu. Zawsze wymaga twojego działania.

## Sekcja FAQ działa osobno od czatu

Kliknij skrót **FAQ** na ekranie głównym albo **Read FAQ** (przeczytaj FAQ) w widgecie **Learn the engine** (poznaj aplikację), żeby otworzyć **Professor Mari's FAQ**. To stała, spisana lista pytań i odpowiedzi. To nie jest czat z AI.

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

- Brak jakiejkolwiek odpowiedzi: sprawdź połączenie pokazane w **Context** albo wybierz je przyciskiem połączenia. Jeśli żadnego nie ma, otwórz panel **Connections** i dodaj jedno.
- Przekazanie zawiera niewłaściwy element: usuń element kontekstu, zacznij od nowa albo przełącz się na właściwy czat z Professor Mari i otwórz przekazanie ponownie z miejsca, z którego pochodzi. Kontekst obejmuje tylko dane przekazanie i bieżący czat z Professor Mari.
- Wynik nie pojawia się w edytorze: użyj **Open** na karcie wyniku. Professor Mari mogła wykonać polecenie, kiedy lista zasobów była nieaktualna.
- Prośba się nie udaje: przeczytaj stan błędu, popraw wskazany problem z konfiguracją i użyj **Retry**. Zapytaj Professor Mari ponownie z pierwotnego źródła tylko wtedy, gdy sam kontekst nie jest już poprawny.
- Po naciśnięciu przycisku wysyłania otwiera się lista **Connections**: nie wybrano jeszcze połączenia. Wybierz je z listy albo najpierw użyj **Add a connection**.
- Asystentka nie odczytuje dołączonego obrazu: model musi obsługiwać obrazy na wejściu. Przełącz się na połączenie, którego model widzi obrazy.
- Wyszukiwanie w Fandom nie działa: wymaga ono dostępu do internetu, bo Fandom to zewnętrzna strona.
- Jej działania blokuje błąd uprawnień: aplikacja Marinara Engine jest otwierana przez sieć, a nie z tego samego komputera. Najpierw skonfiguruj dostęp zdalny.

## Powiązane przewodniki

- [Pierwsze kroki z aplikacją Marinara Engine](welcome.md)
- [Samouczek przy pierwszym uruchomieniu](tutorial.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
