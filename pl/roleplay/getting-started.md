# Tryb Roleplay: pierwsze kroki

Z tego przewodnika dowiesz się, czym jest tryb Roleplay, jak zacząć roleplay i co widać na ekranie. Znajdziesz tu też opis sterowania sprite'ami, paska narzędzi czatu, notatek **Author's Notes** (notatki autora) oraz wskazówki, gdzie szukać opisu dalszych funkcji.

## Czym jest tryb Roleplay

Tryb Roleplay to jeden z trybów czatu w aplikacji Marinara Engine. Pozostałe to Conversation i Game. Roleplay daje wciągający widok sceny zbudowany wokół opowieści.

Scena w trybie Roleplay może pokazywać obraz tła, sprite'y postaci i pasek HUD ze stanem świata. Sprite to obrazek postaci, który zmienia się razem z emocjami. HUD, czyli pasek informacji na górze czatu, to wąski rząd małych widgetów.

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

**HUD** to rząd małych widgetów na górze czatu. Każdy widget należy do jakiegoś trackera, czyli agenta śledzącego stan, więc widget pojawia się tylko wtedy, gdy jego agent jest włączony. Widgety pokazują datę, godzinę, pogodę, lokalizację, obecne postacie, ekwipunek, zadania i statystyki. Kliknij widget, aby otworzyć panel i edytować wartości. Wszystkie widgety i tryby blokad opisuje przewodnik [HUD i trackery w trybie Roleplay](hud-and-trackers.md).

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

## Pasek narzędzi czatu

Pasek narzędzi znajduje się na górze obszaru czatu. Ma przyciski, które otwierają małe panele podręczne. Główne przyciski to:

- **Chat Summary**. Pokazuje bieżące podsumowanie czatu i umożliwia jego edycję.
- **Active Context**. Wymienia powiązane postacie, wpisy lorebooków i preset, które trafiły do ostatniej odpowiedzi. Pokazuje, które wpisy lorebooków pasowały i zostały wstawione.
- **Author's Notes**. Dowolny tekst dopisywany do promptu w każdej turze. Opis poniżej.
- **Gallery**. Otwiera galerię obrazów i wideo tego czatu, gdzie da się wygenerować ilustrację albo tło.
- **Chat Settings**. Otwiera pełny panel boczny ustawień tego czatu.

### Author's Notes

**Author's Notes** to notatka, którą piszesz i którą AI czyta przy każdym generowaniu. Przydaje się do stałych przypomnień, takich jak zasada tonu albo ukryty fakt. Otwórz ją przyciskiem z piórem na pasku narzędzi.

Wpisz notatkę w polu tekstowym. Na przykład: "Utrzymuj mroczny, pełen napięcia ton. Złoczyńca jest w tajemnicy sojusznikiem."

Pod notatką jest pole liczbowe **Injection Depth**. Decyduje ono, jak wysoko w historii czatu trafia notatka. Pomoc w aplikacji brzmi: "Depth 0 = after the latest message, 4 = four messages from the end." Wartość 0 trzyma notatkę najbliżej najnowszej odpowiedzi.

**Author's Notes** działa tak samo w trybie Game Mode i w trybie Conversation. Ten przewodnik jest jego głównym opisem.

## Menu Agents & Actions

Przycisk z iskierką w rzędzie HUD otwiera menu **Agents & Actions**. Zakładka **Activity** wymienia wyniki pracy agentów, zwane dymkami myśli. Każdy z nich da się odrzucić albo skorzystać z przycisku **Clear all**. Pojawiają się tu również wyniki własnych agentów.

Jeśli agent zawiódł w ostatniej turze, pokazuje się lista błędów z przyciskiem ponowienia. Z tego menu da się też uruchomić ponownie wszystkie trackery. Cały system agentów opisuje prostym językiem przewodnik [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

Zakładka **Injections** pojawia się tylko wtedy, gdy włączony jest **Debug mode** (tryb diagnostyczny). Włącz go w panelu **Settings** (Ustawienia), w sekcji **Advanced**. Zakładka pokazuje fragmenty promptu, które agenci piszący zapisali przed ostatnią odpowiedzią. Do agentów piszących należą **Prose Guardian**, który przepisuje odpowiedzi zgodnie z twoimi zasadami stylu, oraz **Narrative Director**, który steruje fabułą.

Zapisany fragment można obejrzeć, edytować i uruchomić ponownie. Edycja zmienia tylko to, co zostaje użyte przy ponownym generowaniu tej samej odpowiedzi. Nie zmienia odpowiedzi, która jest już na ekranie. Dzięki temu ponowne generowanie jest stabilne i powtarzalne.

Nad polem czatu Narrative Director ma przycisk **Push Story**. Uzbraja on tego agenta wyłącznie na następną odpowiedź. Narrative Director może też prowadzić ukryty, długofalowy wątek o nazwie **Secret Plot**. Oba opisuje przewodnik [Narrative Director i Secret Plot](narrative-director.md).

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

**Ponownie wygenerowana odpowiedź wciąż idzie w złym kierunku.** Włącz **Debug mode** w panelu **Settings**, w sekcji **Advanced**. Otwórz menu **Agents & Actions**, znajdź zakładkę **Injections**, a potem edytuj albo uruchom ponownie zapisany fragment, zanim wygenerujesz odpowiedź jeszcze raz. Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Tła w trybie Roleplay](backgrounds.md)
- [HUD i trackery w trybie Roleplay](hud-and-trackers.md)
- [Starcia bojowe (Roleplay)](combat-encounters.md)
- [Narrative Director i Secret Plot](narrative-director.md)
- [Sceny: odgałęzienie roleplayu](scenes.md)
- [Sprite'y postaci](../characters/sprites.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
- [Makra](../prompts/macros.md)
