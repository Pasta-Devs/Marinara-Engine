# Łączenie czatu Conversation z czatem Roleplay lub Game

Połącz czat w trybie Conversation z czatem w trybie Roleplay lub Game, żeby oba dzieliły wspólny kontekst. Typowe zastosowanie: w jednym czacie prowadzisz opowieść, a w czacie Conversation, który pozostaje z nią na bieżąco, rozmawiasz o niej poza fabułą (OOC, czyli out-of-character).

Sekcja **Connected Chats** (połączone czaty) w panelu **Chat Settings** (ustawienia czatu) zawiera dwie różne funkcje. Połączenie **Connected Chats** łączy czaty jeden do jednego i tworzysz je ręcznie. **Cross-Chat Awareness** (świadomość innych czatów) to przełącznik, który działa samoczynnie i pozwala postaci pamiętać jej pozostałe czaty Conversation.

## Jak działa połączenie

Połączenie łączy jeden czat Conversation z jednym czatem Roleplay lub Game. Każdy czat może mieć w danej chwili tylko jedno połączenie.

- Czat Conversation w każdej turze automatycznie czyta ostatnie wiadomości z połączonego czatu fabularnego.
- Czat fabularny nie czyta z powrotem czatu Conversation. Informacje w drugą stronę postacie przekazują za pomocą tagów, opisanych niżej.

## Podłączanie czatu Conversation do czatu Roleplay lub Game

Zanim zaczniesz: przygotuj oba czaty. Zobacz [Zarządzanie listą czatów](managing-chats.md).

1. Otwórz czat Conversation, a w nim panel **Chat Settings**. Zobacz [Panel **Chat Settings** – przegląd](chat-settings.md).
2. Otwórz sekcję **Connected Chats**.
3. Kliknij **Link to Roleplay or Game** (połączenie z czatem Roleplay lub Game).
4. Wyszukaj czat w oknie wyboru, a potem go kliknij.

Sekcja pokazuje teraz nazwę i tryb połączonego czatu oraz mały przycisk rozłączenia.

Jeśli to nie zadziałało: w oknie wyboru pojawiają się wyłącznie czaty, które nie są jeszcze połączone. Najpierw rozłącz ten drugi czat.

Żeby zacząć od czatu Game, otwórz w nim **Chat Settings → Connected Chats**, kliknij **Link to Conversation** (połączenie z czatem Conversation) i wybierz czat Conversation. Czat Roleplay nie ma przycisku łączenia. Pokazuje połączenie dopiero wtedy, gdy ono istnieje, więc utwórz je od strony czatu Conversation.

### Usuwanie połączenia

Otwórz **Chat Settings → Connected Chats** i kliknij przycisk rozłączenia (z etykietą **Disconnect**). To kasuje też oczekujące wpływy i zapisane notatki związane z tym połączeniem. Usunięcie czatu również go rozłącza.

## Funkcja Cross-Chat Awareness

**Cross-Chat Awareness** to przełącznik w sekcji **Connected Chats** czatu Conversation. Jego opis brzmi "Characters know what happens in their other chats". Kiedy postać występuje w kilku czatach Conversation, potrafi pamiętać to, co wydarzyło się w pozostałych, i o tym wspominać. Marinara dobiera te czaty po wspólnej postaci, a nie po wspólnym użytkowniku. Przełącznik jest domyślnie włączony i nie wymaga połączenia.

## Przekazywanie informacji przez połączenie

Postacie zapisują te tagi w swoich wiadomościach. Nie musisz nic robić. W ten sposób oba czaty komunikują się ze sobą.

| Tag | Co robi |
| --- | --- |
| `<influence>` | Jednorazowa wskazówka z czatu Conversation dla połączonego czatu fabularnego. Wpływa na najbliższą turę w połączonym czacie, a potem się zużywa. |
| `<note>` | Zapisuje trwały fakt z czatu Conversation w czacie fabularnym. Zostaje w prompcie czatu fabularnego w każdej turze, dopóki go nie usuniesz. |
| `<ooc>` | Pozwala postaci z czatu Roleplay wyjść z fabuły i odpowiedzieć w połączonym czacie Conversation. Marinara publikuje tam ten tekst. |

### Conversation Notes

Fakty zapisane tagiem `<note>` pojawiają się w sekcji **Conversation Notes** (notatki z czatu Conversation) w panelu **Chat Settings** czatu fabularnego. Przy każdej notatce jest przycisk usuwania. **Clear all notes** (usunięcie wszystkich notatek) po potwierdzeniu usuwa je wszystkie i tej operacji nie da się cofnąć. Gdy nie ma żadnych notatek, sekcja informuje, że pojawią się w niej notatki objęte tagiem `<note>`.

<a id="switching-between-connected-chats"></a>

## Przeskakiwanie między połączonymi czatami

Gdy połączenie istnieje, w obu czatach pojawia się przycisk **Connected chat** (połączony czat, ikona podwójnej strzałki). Na komputerze zaczyna w prawym górnym rogu i można go przeciągać. Na telefonie otwórz menu **Chat tools** (narzędzia czatu) z trzema kropkami, otwórz **Connected chat** i wybierz **Switch to** (przełącz na) z nazwą drugiego czatu.

Żeby trzymać tę kontrolkę wewnątrz Chat Settings, wybierz **Put back in Chat Settings** (przeniesienie do Chat Settings). Pojawia się wtedy jako osobna sekcja **Connected chat**. Użyj przycisku wydzielania w tej sekcji, żeby znów zrobić z niej osobne okno.

## Pozostałe kontrolki w tej sekcji

- **Discord webhook URL** (adres URL webhooka Discord): pole bez etykiety, z samym tekstem zastępczym, który zaczyna się od `https://discord.com/api/webhooks/`. Wklej adres URL webhooka, żeby kopiować wiadomości czatu na kanał Discord. Ta funkcja ma własny przewodnik.
- **Allow Noodle references** (zezwolenie na odwołania do Noodle): pozwala osi czasu Noodle pobierać ostatnie wiadomości z tego czatu. Domyślnie jest wyłączony i pojawia się tylko wtedy, gdy zainstalowano Noodle.
- **Allow character DMs** (zezwolenie na wiadomości prywatne od postaci, w trybie Roleplay): pozwala postaci z czatu Roleplay rozpocząć z tobą, prosto z fabuły, nowy czat Conversation na wiadomości prywatne. Domyślnie jest wyłączony i działa nawet bez połączenia.
