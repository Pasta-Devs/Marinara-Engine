# Tryb Roleplay: pierwsze kroki

Z tego przewodnika dowiesz się, czym jest tryb Roleplay, jak zacząć roleplay i co widać na ekranie. Znajdziesz tu też opis sterowania sprite'ami, narzędzi czatu, notatek **Author's Notes** (notatki autora) oraz wskazówki, gdzie szukać opisu dalszych funkcji.

## Czym jest tryb Roleplay

Tryb Roleplay to jeden z trybów czatu w aplikacji Marinara Engine. Pozostałe to Conversation i Game. Roleplay daje wciągający widok sceny zbudowany wokół opowieści.

Scena w trybie Roleplay może pokazywać obraz tła, sprite'y postaci i pasek HUD ze stanem świata. Sprite to obrazek postaci, który zmienia się razem z emocjami. HUD pokazuje ten stan: na telefonie jako małe widgety na górze czatu, a na komputerze w Tracker Panel lub oknie Trackers.

Tryb Roleplay korzysta też z pomocników zwanych agentami. Agent to małe zadanie, które wykonuje się automatycznie obok odpowiedzi AI. Agenci śledzą stan świata, dobierają sprite'y, wybierają tła i robią jeszcze więcej.

Do korzystania z trybu Roleplay generowanie obrazów nie jest potrzebne. Bez niego tryb nadal działa jako czat tekstowy. Miejsca na sprite'y zostają puste, tło ma jednolity kolor, a HUD dalej wszystko śledzi. Jak skonfigurować połączenie, opisuje przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Wybierz tryb Roleplay, gdy zależy ci na wciągającej scenie. Do zwykłego czatu z wiadomościami wybierz [tryb Conversation](../conversation/getting-started.md). Do uporządkowanej gry fabularnej z drużyną, walką i rzutami kością wybierz [Game Mode](../game/getting-started.md).

## Jak zacząć roleplay

Utwórz nowy czat w trybie Roleplay, a otworzy się kreator konfiguracji. Kreator ma pięć kroków. Wymagane jest tylko połączenie z AI. Każdy inny krok jest opcjonalny i da się go zmienić później.

1. **Name & Connection**. Nadaj nazwę czatowi i wybierz, które połączenie AI ma odpowiadać. Nazwę można zostawić pustą.
2. **Pick a Preset**. Preset, czyli zapisany szablon promptu, steruje strukturą promptu i ustawieniami generowania. Domyślny preset sprawdza się w większości czatów.
3. **Persona & Characters**. Wybierz personę, w którą się wcielasz, oraz postacie, które dołączają do sceny.
4. **Attach Lorebooks**. Lorebook to zbiór faktów o twoim świecie, które AI czyta, gdy pojawią się słowa kluczowe. Ten krok jest opcjonalny.
5. **Enable Agents**. Wybierz agentów, którzy działają w tym czacie. Agentów da się dodać lub usunąć później w panelu **Chat Settings** (ustawienia czatu), w sekcji **Agents**.

Po zakończeniu kreatora otwiera się scena i można wysłać pierwszą wiadomość.

## Obszar sceny: tło, sprite'y i HUD

Obszar sceny w trybie Roleplay to przestrzeń za wiadomościami i wokół nich. Składa się z trzech głównych części.

**Tło** to obraz obejmujący całą scenę, umieszczony za kolumną wiadomości. Przy zmianie przenika się płynnie. Agent **Background** może wybierać je co turę z twojej biblioteki teł. Da się też ustawić stałe tło dla konkretnego czatu. Cały system tła opisuje przewodnik [Tła w trybie Roleplay](backgrounds.md).

**Sprite'y** to obrazki postaci umieszczone na obszarze sceny. Nie ma tu sztywnego limitu. Pojawić się może każda postać w czacie, która ma włączone sprite'y. Sprite'y wymagają wgranej biblioteki sprite'ów na karcie postaci. Bez niej miejsce na sprite pozostaje puste. Jak dodać sprite'y do postaci, opisuje przewodnik [Sprite'y postaci](../characters/sprites.md).

**HUD** pokazuje trackery. Na telefonie jest rzędem małych widgetów na górze czatu. Na komputerze trackery widać w **Tracker Panel** lub w oknie **Trackers**, gdy Tracker Panel jest wyłączony w ustawieniach. Każdy tracker należy do agenta śledzącego stan, więc pojawia się tylko wtedy, gdy jego agent jest włączony. Trackery pokazują datę, godzinę, pogodę, lokalizację, obecne postacie, ekwipunek, zadania i statystyki. Możesz edytować ich wartości. Wszystkie widgety i tryby blokad opisuje przewodnik [Pasek HUD i trackery w trybie Roleplay](hud-and-trackers.md).

### Sterowanie wyświetlaniem sprite'ów

Sterowanie sprite'ami znajduje się w panelu **Chat Settings**, w sekcji **Agents**, na karcie **Expression Engine**. Pojawia się ono, gdy co najmniej jedna postać ma włączone sprite'y.

- **Sprite Source**. Przełącznik z opcjami **Expressions** i **Full-body**. Wybierz jedną albo obie. Co najmniej jedna musi zostać włączona.
- **Expression Size**, **Full-body Size**, **Expression Opacity** i **Full-body Opacity**. Cztery suwaki ustawiające rozmiar sprite'ów i stopień przezroczystości. Te ustawienia zostają w tej przeglądarce i nie synchronizują się z innymi urządzeniami.
- **Default Side**. Przełącznik **Left** lub **Right**, który decyduje, po której stronie pojawiają się nowe sprite'y.
- **Expression Avatars**. Gdy jest włączone, awatary przy wiadomościach pokazują aktualny sprite z wyrazem twarzy danej postaci.

Aby przesunąć sprite'y ręcznie, kliknij na obszarze sceny przycisk **Arrange**. Na czas przesuwania zmienia się on w **Done**. Przeciągnij sprite, a potem kliknij mały ptaszek nad nim, żeby potwierdzić. Kliknij przycisk **Done**, aby zakończyć. Przycisk **Reset** usuwa wszystkie własne ustawienia położenia.

Wyraz twarzy da się też ustawić komendą **/emote** wpisaną w polu czatu. Działają dwie formy:

```
/emote happy
```

```
/emote "Aria" angry
```

Pierwsza forma ustawia wyraz twarzy dla całej sceny. Druga dotyczy jednej wskazanej postaci. Wpisz **/emote** bez żadnych słów, aby wyświetlić listę dostępnych wyrazów twarzy dla każdej postaci na scenie.

## Narzędzia czatu

Narzędzia czatu są sekcjami w **Chat Settings**. Otwórz ustawienia przyciskiem z suwakami wewnątrz czatu; domyślnie jest w prawym górnym rogu i można przeciągnąć go w inne miejsce. W czacie Roleplay znajdziesz:

- **Search messages**, rozwijaną sekcję blisko góry. Wyszukuje wiadomości po słowach lub numerze; ma też zakładki z zapisanymi odnośnikami do wiadomości i usuniętymi wiadomościami.
- **Chat Branches**. Przełączanie, zmiana nazw, eksport i import gałęzi czatu. Zobacz [Gałęzie czatu](../chats/branches.md).
- **Chat Summary**. Pokazuje bieżące podsumowanie czatu i umożliwia jego edycję.
- **Active Context**. Wymienia powiązane postacie, wpisy lorebooków i preset, które trafiły do ostatniej odpowiedzi. Pokazuje, które wpisy lorebooków pasowały i zostały wstawione.
- **Agent activity**, tuż pod **Agents**. Opis poniżej.
- **Author's Notes**. Dowolny tekst dopisywany do promptu w każdej turze. Opis poniżej.
- **Gallery**. Obrazy i wideo tego czatu; można tu wygenerować ilustrację albo tło.

Każdą z tych sekcji, także Search, możesz odłączyć do osobnego okna albo otwierać jej własnym przyciskiem na telefonie. Starsze czaty zachowują znajome ikony narzędzi jako ruchome przyciski. Otwórz taki przycisk i wybierz **Put back in Chat Settings**, żeby przenieść narzędzie do środka. Zobacz [Panel **Chat Settings** – przegląd](../chats/chat-settings.md).

<a id="authors-notes"></a>

### Author's Notes

**Author's Notes** to notatka, którą piszesz i którą AI czyta przy każdym generowaniu. Przydaje się do stałych przypomnień, takich jak zasada tonu albo ukryty fakt. Otwórz **Chat Settings** i rozwiń **Author's Notes** pod **Agents**.

Wpisz notatkę w polu tekstowym. Na przykład: "Utrzymuj mroczny, pełen napięcia ton. Złoczyńca jest w tajemnicy sojusznikiem."

Pod notatką jest pole liczbowe **Injection Depth**. Decyduje ono, jak wysoko w historii czatu trafia notatka. Pomoc w aplikacji brzmi: "Depth 0 = after the latest message, 4 = four messages from the end." Wartość 0 trzyma notatkę najbliżej najnowszej odpowiedzi.

**Author's Notes** działa tak samo w trybie Game Mode i w trybie Conversation. Ten przewodnik jest jego głównym opisem.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** pokazuje, co zrobili agenci czatu. Pojawia się, gdy czat korzysta z agentów lub Advanced Memory. Ma własną sekcję tuż pod **Agents** w **Chat Settings**. Jest też na dole **Tracker Panel**, a na komputerze również na dole okna **Trackers**.

Zakładka **Activity** wymienia wyniki pracy agentów, zwane dymkami myśli. Każdy z nich da się odrzucić albo skorzystać z przycisku **Clear all**. Pojawiają się tu również wyniki własnych agentów.

Jeśli agent zawiódł w ostatniej turze, pokazuje się lista błędów z przyciskiem ponowienia. Możesz też zatrzymać działających agentów, ponownie uruchomić wszystkie trackery i użyć **Clear Trackers**. Cały system agentów opisuje prostym językiem przewodnik [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

Zakładka **Injections** pojawia się tylko wtedy, gdy włączony jest **Debug mode** (tryb diagnostyczny). Włącz go w panelu **Settings** (Ustawienia), w sekcji **Advanced**. Zakładka pokazuje fragmenty promptu, które agenci piszący zapisali przed ostatnią odpowiedzią. Do agentów piszących należą **Prose Guardian**, który przepisuje odpowiedzi zgodnie z twoimi zasadami stylu, oraz **Narrative Director**, który steruje fabułą.

Zapisany fragment można obejrzeć, edytować i uruchomić ponownie. Edycja zmienia tylko to, co zostaje użyte przy ponownym generowaniu tej samej odpowiedzi. Nie zmienia odpowiedzi, która jest już na ekranie. Dzięki temu ponowne generowanie jest stabilne i powtarzalne.

Nad polem czatu Narrative Director ma przycisk **Push Story**. Uzbraja on tego agenta wyłącznie na następną odpowiedź. Narrative Director może też prowadzić ukryty, długofalowy wątek o nazwie **Secret Plot**. Oba opisuje przewodnik [Narrative Director i Secret Plot](narrative-director.md).

## Szepty i sekrety

W **Chat Settings → Agents → Roleplay Commands** (ustawienia czatu → agenci → komendy Roleplay) włącz **Whisper** (szept), aby pozwolić na prywatne uwagi, sekrety lub wizje w odpowiedzi. Domyślnie jest wyłączone. Wybierz, czy mogą używać go **All** (wszystkie) postacie, czy tylko wyznaczony **Narrator** (narrator). Jak Personal Notes wymaga czatu solo lub generowania grupowego **Individual**.

Komenda to `[whisper: character="name" text="the secret"]`. Wskaż dokładnie jedną postać czatu lub wybraną personę. Tylko odbiorca i wyznaczony narrator otrzymują tekst w promptach. Nieznane lub niejednoznaczne imię jest ignorowane bez ujawniania sekretu. Współdzieleni agenci nie dostają szeptów.

Szept pozostaje w swoim miejscu wiadomości. Szepty do twojej persony widać od razu; inne odczytasz przez **Reveal a secret** (ujawnij sekret). Ujawnienie zmienia tylko ekran, nie wiedzę postaci. Sekrety podążają za wiadomością i aktywnym swipe'em oraz znikają z promptu po ukryciu wiadomości lub wyjściu poza wybraną historię.

Gdy szept jest już widoczny, wybierz **Edit whisper** (edytuj szept), zmień tekst, a następnie **Save** (zapisz). Poprawka pozostaje przy swipe'ie tej wiadomości i jest używana w kolejnych promptach dla pierwotnego odbiorcy oraz narratora. **Cancel** (anuluj) pozostawia tekst bez zmian.

Możesz też wpisać `[whisper: character="name" text="the secret"]` we własnej wiadomości Roleplay, aby wyszeptać coś jednej postaci w czacie. Własne szepty widzisz od razu. Działa to w zwykłych czatach, bez włączania trybu wieloosobowego.

Ta sama komenda działa też wtedy, gdy edytujesz wiadomość postaci lub narratora: po zapisaniu staje się szeptem tej wiadomości. Tekst szeptu może zajmować kilka wierszy i zawierać wypowiedzi w cudzysłowie bez zmian, na przykład `text=""I love you.""`.

### Twoje prywatne notatki

Przy włączonym **Personal Notes** w **Roleplay Commands** wpisz `[notes: content="your private note"]` we własnej wiadomości. Te notatki należą do ciebie i trafiają wyłącznie do wyznaczonego narratora, nie do zwykłych postaci ani wspólnych agentów. Edytuj je lub usuwaj w szczegółach poleceń wiadomości.

Narrator przestaje też otrzymywać notatki postaci, gdy jest ona wyłączona lub usunięta z grupy. Wyłączenie nie usuwa zapisanych notatek; ponowne włączenie postaci znów je udostępnia.

Możesz też zapisać notatkę przy pojedynczej wiadomości. Wybierz **Bookmark, pin or note** (dodaj zakładkę, przypnij lub dodaj notatkę) pod wiadomością i wpisz **Private note** (prywatną notatkę). Pozostaje ona prywatna i nigdy nie trafia do modelu, chyba że włączysz **Show the note to the narrator character** (pokaż notatkę postaci narratora) i wybierzesz postać. Wtedy tylko ta postać otrzyma notatkę obok wiadomości; żadna inna jej nie otrzyma. Udostępnianie wymaga czatu z jedną postacią lub generowania grupowego **Individual**, ponieważ scalona odpowiedź grupy jest pisana dla wszystkich postaci naraz. **Remove note** (usuń notatkę) również kończy jej udostępnianie.

## Przerywanie wypowiedzi i działań

W sekcji **Chat Settings → Agents → Roleplay Commands** włącz **Interruptions** (przerywanie), aby postacie mogły przerwać ostatnią wiadomość, gdy słowna lub fizyczna interwencja jest wiarygodna. Opcja jest domyślnie wyłączona i nie wymaga pobieranego agenta.

Model używa `[interrupt: part="a verbatim phrase of at least three words"]`. Aplikacja Marinara Engine szuka tej frazy tylko w wiadomości bezpośrednio poprzedzającej odpowiedź, zachowuje tekst do końca frazy i zastępuje jego zakończenie pauzą oznaczającą przerwanie. Dialog zachowuje zamykający cudzysłów; opis działania go nie zyskuje. Brak dopasowania lub niejednoznaczne dopasowanie pozostawia wiadomość bez zmian.

Otwórz informacje o poleceniach użytych w odpowiedzi i wybierz **Restore original message** (przywróć oryginalną wiadomość), aby odzyskać pełną treść. Ponowne generowanie najpierw przywraca pełną oryginalną wiadomość wejściową, więc nowa odpowiedź może zdecydować, czy ją przerwać. Wybranie istniejącego wariantu odpowiedzi stosuje przypisane mu przerwanie, chyba że wiadomość została jawnie przywrócona. Późniejsze ręczne zmiany są zachowywane i nie zostaną nadpisane przez wcześniejsze przerwanie.

## Echo Chamber

**Echo Chamber** to opcjonalny agent, który dodaje do sceny reagującą na żywo publiczność. Działa jak czat na streamingu, w którym co jakiś czas pojawia się nowa reakcja. Włącz go w panelu **Chat Settings**, w sekcji **Agents**, na karcie **Echo Chamber**. Panel unosi się nad sceną i da się go zwinąć do małego kafelka.

## Wybory CYOA

**CYOA** to skrót od Choose Your Own Adventure, czyli "wybierz własną przygodę". Agent **CYOA Choices** jest domyślnie wyłączony. Po włączeniu dodaje pod odpowiedzią klikalne przyciski wyboru. Kliknięty wybór staje się twoją kolejną wiadomością. Działa tylko w trybie Roleplay.

## Starcia

Tryb Roleplay ma lekką warstwę walki. Włącz agenta **Combat**, a potem kliknij przycisk **Encounter** nad polem czatu (jego podpowiedź brzmi "Start Combat Encounter"). Otwiera się okno konfiguracji, a po nim ekran walki z paskami zdrowia i przyciskami akcji. To system osobny od walki w trybie Game Mode. Cały przebieg opisuje przewodnik [Starcia bojowe (Roleplay)](combat-encounters.md).

## Sceny

**Scena** to boczna gałąź w trybie Roleplay. Przydaje się na retrospekcję, poboczną lokalizację albo alternatywną ścieżkę, bez utraty głównego wątku. Scena nie pobiera kontekstu z połączonego czatu Conversation, nawet jeśli robi to roleplay nadrzędny. Zobacz [Sceny: odgałęzienie roleplayu](scenes.md).

## Wybór modeli

W trybie Roleplay ustawienia domyślne sprawdzają się dobrze. Przy większości konfiguracji pomagają dwie ogólne wskazówki.

Połączenie czatu odpowiada za prozę postaci. Model ze średniej półki albo lepszy utrzymuje spójny głos przez długie sceny. Połączenia agentów wykonują małe, uporządkowane zadania, na przykład odczyt stanu albo wybór wyrazu twarzy. Bardzo słabe modele potrafią zwrócić błędny stan albo źle dobrać sprite'y.

Dla agentów da się ustawić tańszy model niż dla czatu. Wielu użytkowników prowadzi czat na mocnym modelu, a agentów na szybkim i tanim. Jeśli wartości na pasku HUD albo sprite'y ciągle wychodzą źle, przełącz połączenie agentów na mocniejszy model. Ustawienia samplera opisuje przewodnik [Parametry generowania](../prompts/generation-parameters.md).

## Rozwiązywanie problemów

**Widgety HUD pokazują złą wartość.** Każdy widget wypełnia tracker. Otwórz panel widgetu i popraw wartość ręcznie. Jeśli wartości ciągle uciekają, przełącz połączenie agenta na mocniejszy model. Da się też zablokować pole, żeby kolejne automatyczne uruchomienie go nie nadpisało.

**Wyrazy twarzy na sprite'ach się nie zmieniają.** Sprawdź, czy postać ma wgraną bibliotekę sprite'ów. Generowanie obrazów jest potrzebne tylko wtedy, gdy Marinara ma tworzyć nowe sprite'y. Bez sprite'ów do pokazania agent od wyrazów twarzy działa, ale nie ma czego wyświetlić. Wyraz twarzy można też ustawić ręcznie komendą **/emote**.

**Tło nigdy się nie zmienia.** Agent **Background** wybiera z twojej biblioteki teł. Przy jednym czy dwóch tłach wybiera ciągle te same. Dodaj więcej teł, żeby agent miał w czym wybierać. Zobacz [Tła w trybie Roleplay](backgrounds.md).

**Ponownie wygenerowana odpowiedź wciąż idzie w złym kierunku.** Włącz **Debug mode** w panelu **Settings**, w sekcji **Advanced**. Otwórz **Agent activity**, znajdź zakładkę **Injections**, a potem edytuj albo uruchom ponownie zapisany fragment, zanim wygenerujesz odpowiedź jeszcze raz. Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Tła w trybie Roleplay](backgrounds.md)
- [HUD i trackery w trybie Roleplay](hud-and-trackers.md)
- [Starcia bojowe (Roleplay)](combat-encounters.md)
- [Narrative Director i Secret Plot](narrative-director.md)
- [Sceny: odgałęzienie roleplayu](scenes.md)
- [Sprite'y postaci](../characters/sprites.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
- [Makra](../prompts/macros.md)
