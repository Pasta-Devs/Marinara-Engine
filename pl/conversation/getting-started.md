# Tryb Conversation: pierwsze kroki

Z tego przewodnika dowiesz się, jak działa tryb Conversation w aplikacji Marinara Engine, czyli czat w stylu komunikatora. Wyjaśnia on, czym ten tryb jest i jak przebiega czterokrokowy kreator konfiguracji. Opisuje też funkcje dostępne wyłącznie w trybie Conversation: wiadomości autonomiczne, status obecności, reakcje, selfie i gry stołowe.

## Czym jest tryb Conversation

Tryb Conversation to jeden z trybów czatu w aplikacji Marinara Engine. Działa jak komunikator. Masz do dyspozycji jedną postać lub kilka postaci, pasek wpisywania i przewijaną historię wiadomości.

Wyobraź sobie wysyłanie wiadomości prywatnych, czyli DM, tak jak pisze się do znajomej osoby. Nie ma tu postaci Game Master, grafiki scen ani obowiązkowych mechanik. To najlżejszy tryb czatu i wiele osób spędza w nim większość czasu.

Tryb Conversation dokłada funkcje, które mają sens tylko przy stałej znajomości prowadzonej w komunikatorze. Postacie mają status online lub nieobecności oraz tygodniowe harmonogramy. Potrafią odezwać się pierwsze, przysłać selfie, zareagować emoji i zagrać w gry stołowe. Każda postać i persona (postać, w którą się wcielasz) dostaje też mały profil w stylu Discord, z nazwą wyświetlaną i sekcją o mnie. Te pola opisuje przewodnik [Profile w trybie Conversation](profiles.md).

Żadna z tych funkcji nie działa w trybie Roleplay ani Game Mode, nawet jeśli używasz tam tej samej karty postaci.

Z niektórymi polami karty jest odwrotnie. Czat w trybie Conversation nie zaczyna się od pola **First Message** karty ani od innego powitania; robią to tylko czaty w trybie Roleplay. Nie używa też pól **Dialogue Highlight Color** ani **Message Box Color** karty. **Name Display Color** nadal koloruje imię postaci nad każdą wiadomością. Zobacz [Gdzie widać ustawione kolory](../characters/colors-and-stats.md#where-your-colors-show).

### Kiedy wybrać tryb Conversation

Wybierz tryb Conversation, jeśli zależy ci na czymkolwiek z tej listy:

- Czat z postacią jak pisanie DM do znajomej osoby: tekst na wejściu, tekst na wyjściu.
- Rozmowa z kilkoma postaciami naraz w jednym wątku.
- Samodzielne zachowanie postaci: wysyłanie wiadomości, trzymanie się harmonogramu i reagowanie z czasem.

Zamiast tego wybierz tryb Roleplay albo Game Mode, jeśli chcesz mieć grafikę scen, czyli sprite'y i tła, albo uporządkowane mechaniki gry.

## Czterokrokowy kreator konfiguracji

Przy zakładaniu nowego czatu Conversation otwiera się czterokrokowy kreator. Można go też zamknąć i wszystko ustawić później w panelu bocznym ustawień czatu. Oto te cztery kroki:

1. **Name & Connection** (nazwa i połączenie): nadaj nazwę czatowi i wybierz połączenie AI, z którego korzystają postacie. Połączenie to zapisany skrót do dostawcy AI. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
2. **Prompt Preset** (preset promptu): wybierz preset (zapisany szablon promptu), który dostarcza prompt trybu Conversation, albo zostaw domyślny.
3. **Persona & Characters** (persona i postacie): wskaż personę oraz jedną postać lub więcej.
4. **Automation** (automatyzacja): zdecyduj, jak dużo postacie mogą robić samodzielnie.

Persona to postać, w którą wcielasz się ty. Zobacz [Persony użytkownika](../characters/personas.md).

Liczba wybranych postaci przesądza o kształcie czatu. Jedna postać tworzy prywatny czat DM. Dwie postacie lub więcej tworzą czat grupowy i nie trzeba włączać żadnego dodatkowego trybu. Ustawienia czatu grupowego opisuje przewodnik [Czaty grupowe](../chats/group-chats.md).

Gdy połączenie i co najmniej jedna postać są już wybrane, kliknij przycisk **Start Chatting** (rozpocznij czat), żeby otworzyć czat.

### Krok Automation

Krok **Automation** zawsze zawiera te przełączniki:

| Przełącznik | Domyślnie | Do czego służy |
|---|---|---|
| **Autonomous Messages** | On | Postacie mogą odezwać się pierwsze, gdy nic nie piszesz. |
| **Generate Schedules** | Off | Tworzy opcjonalne tygodniowe rutyny. Widoczne tylko przy włączonym Autonomous Messages. |

Jeśli w aplikacji jest zainstalowany pakiet agenta z komendami dla trybu Conversation, krok pokazuje dodatkowo sekcję **Commands** (komendy). Rozmowy, selfie od agenta Illustrator, Music DJ, Haptic Feedback i każda gra przy stole pojawiają się dopiero po instalacji odpowiedniego pakietu. O rozmowach mówi przewodnik [Rozmowy audio i wideo w trybie Conversation](calls.md).

### Siatka Commands

Kiedy sekcja **Commands** jest dostępna i włączona, wyświetla się siatka nawet 17 rodzin komend. Każda z nich to ukryte działanie, które postać może podjąć sama. Pozycje należące do pakietów widać dopiero po instalacji danego pakietu. Każda widoczna rodzina jest na starcie włączona. Wyłączenie przełącznika usuwa tylko tę jedną rodzinę. Komendy uruchamia model, nie wpisuje się ich ręcznie.

Pełny zestaw rodzin komend wygląda tak:

- **Schedule Updates**: postacie mogą zmieniać swój bieżący status.
- **Cross-Post**: postacie mogą przekierować wiadomość do innego czatu.
- **Selfies**: postacie mogą poprosić o wygenerowanie selfie.
- **Memories**: postacie mogą tworzyć wspomnienia dla innych postaci.
- **Scenes**: postacie mogą rozpocząć wciągającą scenę.
- **Music**: postacie mogą puszczać utwory przez aktywny odtwarzacz Music Player.
- **Haptics**: postacie mogą sterować podłączonymi urządzeniami haptycznymi.
- **Influence**: postacie mogą wpływać na połączony czat.
- **Notes**: postacie mogą zapisywać trwałe notatki dla połączonego czatu.
- **Calls**: postacie mogą zadzwonić do ciebie, żeby zacząć rozmowę w trybie Conversation.
- **Reactions**: postacie mogą reagować na wiadomości plakietkami emoji.
- **UNO**: postacie mogą zacząć partię UNO przy stole, gdy zgodzisz się zagrać.
- **Chess**: postacie mogą przyjąć wyzwanie do szachów jeden na jeden przy stole.
- **Poker**: postacie mogą usiąść przy stole do partii pokera Texas Hold'em.
- **8-Ball Pool**: postacie mogą rozbić bile do partii 8-ball przy stole.
- **Tic-Tac-Toe**: postacie mogą przyjąć wyzwanie do kółka i krzyżyka jeden na jeden.
- **Rock-Paper-Scissors**: postacie mogą przyjąć wyzwanie do papier-kamień-nożyce jeden na jeden.

Nad wszystkim stoi jeden główny przełącznik **Commands**. Gdy jest wyłączony, żadna rodzina komend nie działa, nawet jeśli wygląda na włączoną.

## Wiadomości autonomiczne i status obecności

Dzięki wiadomościom autonomicznym postać może odezwać się pierwsza. Przy włączonym przełączniku **Autonomous Messages** postać może napisać do ciebie po dłuższej ciszy z twojej strony. Bierze przy tym pod uwagę własną gadatliwość, a przy włączonych harmonogramach także swoją dostępność. Po zakończeniu kreatora wiadomości autonomiczne są domyślnie włączone.

Ten przełącznik da się zmienić w każdej chwili. Otwórz panel boczny ustawień czatu i znajdź sekcję **Autonomous Messaging**.

### Twój status obecności

Masz swój status obecności, który wpływa na to, kiedy postacie się odzywają. Znajdziesz go w stopce paska bocznego jako kolorowy kafelek z bieżącym statusem. Kliknij kafelek i wybierz jedną z czterech opcji:

- **Active**: jesteś online i masz czas na czat.
- **Idle**: ustawia się samo podczas nieobecności.
- **Do Not Disturb**: wycisza wiadomości autonomiczne.
- **Invisible**: ukrywa status przed postaciami.

Obok kafelka jest pole **What are you doing?**. Wpisz tu krótko własną aktywność, jeśli postacie mają wiedzieć, co się u ciebie dzieje. Status obecności jest globalny, więc pozostaje taki sam we wszystkich czatach.

## Reakcje i powiadomienia

Każda wiadomość w trybie Conversation może dostać reakcję emoji. Użyj przycisku reakcji przy wiadomości, żeby dodać własną. Marinara zapisuje reakcję jako notatkę w rodzaju `[User reacted with ...]`, którą widzą kolejne odpowiedzi. Dzięki temu postać może zauważyć twoją reakcję.

Gdy rodzina komend **Reactions** jest włączona, postacie też mogą reagować. Reagują na twoje wiadomości albo na wiadomości innych postaci. W czatach grupowych to bardzo wygodne, bo postać odpowiada lekko, bez pełnej wiadomości.

Kiedy postać napisze w czacie, którego akurat nie oglądasz, przy krawędzi ekranu pojawia się pływający dymek z awatarem. Kliknij dymek, żeby przejść do tego czatu, albo zamknij go znakiem X. Na urządzeniach mobilnych kilka oczekujących dymków zwija się w jedną grupę do kliknięcia.

## Selfie

Postacie mogą przysyłać selfie, czyli zdjęcia postaci wygenerowane przez AI. Selfie różni się od grafiki scen z trybów Roleplay i Game Mode, bo jest przypisane do jednej postaci.

Żeby korzystać z selfie, zainstaluj agenta **Illustrator** przez **Agents → Download Agents**. Następnie otwórz panel boczny ustawień czatu, przejdź do **Agents → Illustrator Settings** i ustaw **Selfie Connection**. Połączenie do selfie to dostawca generowania obrazów. Każde selfie kosztuje jedno wywołanie generowania obrazu.

Pełną konfigurację, w tym styl, rozdzielczość i przycisk ręcznego zamówienia, opisuje przewodnik [Selfie](selfies.md).

## Gry przy stole

Tryb Conversation ma sześć opcjonalnych pakietów z grami przy stole: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** i **Rock-Paper-Scissors**. Wybrane gry zainstaluj przez **Agents → Download Agents**. Aplikacja przygotowuje stół, pilnuje zasad, a każda postać opisuje własne ruchy zgodnie ze swoją osobowością. Gry przy stole działają wyłącznie w czatach Conversation.

Grę można zacząć na trzy sposoby:

1. Wpisz komendę slash w polu wiadomości i naciśnij Enter.
2. Napisz zwykłą wiadomość, na przykład "let's play uno".
3. Poczekaj na zaproszenie od postaci, jeśli jej rodzina komend jest włączona.

Dostępne komendy slash:

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Każda gra ma własne okno konfiguracji z opcjami. Pełne zasady, okna konfiguracji i plansze opisuje przewodnik [Gry stołowe w trybie Conversation](table-games.md).

## Harmonogramy postaci

Każda postać w czacie Conversation może mieć tygodniowy harmonogram. Harmonogram ustala status i zajęcie postaci w siatce 7 dni na 24 godziny. Dzięki temu wiadomości autonomiczne liczą się z rutyną, a postać oznaczona jako nieobecna nie odezwie się w tych godzinach.

Harmonogram da się zbudować już podczas konfiguracji, przełącznikiem **Generate Schedules**. Można go też utworzyć albo poprawić później, w sekcji **Autonomous Messaging** w panelu bocznym ustawień czatu. Przewodnik [Harmonogramy postaci i wiadomości autonomiczne](schedules.md) omawia pełny edytor harmonogramu, dzienne limity oraz komendę `/status`, która nadpisuje status.

## Rozwiązywanie problemów

### Wiadomości autonomiczne przychodzą za często

Otwórz panel boczny ustawień czatu i wyłącz **Autonomous Messages** w sekcji **Autonomous Messaging**. Inna opcja: ustaw status obecności na **Do Not Disturb**, który wycisza wiadomości autonomiczne. Przy korzystaniu z harmonogramów oznacz więcej godzin jako nieobecność, zgodnie z przewodnikiem [Harmonogramy postaci i wiadomości autonomiczne](schedules.md).

### Jedna postać odpowiada na wszystko w czacie grupowym

Czaty grupowe mają ustawienia kolejności zabierania głosu, na przykład **Reply When Mentioned**. Otwórz przewodnik [Czaty grupowe](../chats/group-chats.md), żeby ustalić, kto i kiedy się odzywa.

### Postać zapomina wcześniejsze rzeczy

Długie czaty zapełniają pamięć modelu. Wypróbuj model z większym oknem kontekstu albo dopisz kluczowe fakty do wpisu w lorebooku (zbiorze faktów o twoim świecie), żeby zostawały w kontekście. Można też zacząć świeży czat z tą samą postacią i personą. Więcej wskazówek znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

### Selfie nie przypomina postaci

Otwórz ustawienia **Selfies** i ustaw **Attach Card Appearance** na **Images only** (tylko obrazy) albo **Images and videos** (obrazy i filmy). Jeśli dostawca obrazów obsługuje obrazy referencyjne, ustaw też **Send Avatar References**. Szczegóły opisuje przewodnik [Selfie](selfies.md).

## Powiązane przewodniki

- [Rozmowy audio i wideo w trybie Conversation](calls.md)
- [Harmonogramy postaci i wiadomości autonomiczne](schedules.md)
- [Profile w trybie Conversation](profiles.md)
- [Selfie](selfies.md)
- [Własne emoji, naklejki i GIF-y](emoji-stickers-gifs.md)
- [Gry stołowe w trybie Conversation](table-games.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)
