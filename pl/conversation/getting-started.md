# Tryb Conversation: pierwsze kroki

Tryb Conversation to tryb czatu w stylu komunikatora: jedna postać lub kilka, pasek wpisywania i przewijana historia, jak w rozmowie z przyjacielem przez SMS-y. Nie ma w nim mistrza gry ani grafik scen. Postacie mogą też pisać do ciebie pierwsze, trzymać się tygodniowych harmonogramów, wysyłać selfie i grać w gry stołowe, a te funkcje istnieją tylko w tym trybie.

## Rozpocznij czat w trybie Conversation

Zanim zaczniesz: dodaj konto w panelu **Connections** (połączenia; zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)) i miej co najmniej jedną postać. Persona, czyli karta postaci, która reprezentuje ciebie, jest opcjonalna (zobacz [Persony użytkownika: tworzenie i edycja](../characters/personas.md)).

1. Na pasku bocznym czatów otwórz zakładkę **CONVO** i kliknij **New Conversation** (nowa rozmowa). Otwiera się kreator konfiguracji z czterema stronami.
2. Na pierwszej stronie, **Name & Connection** (nazwa i połączenie), nazwij czat i wybierz konto, które pisze odpowiedzi.
3. Na drugiej stronie, **Prompt Preset** (preset promptu), wybierz preset promptu trybu Conversation albo zostaw domyślny.
4. Na trzeciej stronie, **Persona & Characters** (persona i postacie), wybierz swoją personę i jedną postać lub więcej.
5. Na ostatniej stronie, **Automation** (automatyzacja), wybierz, ile postacie robią same (zobacz tabelę niżej).
6. Kliknij **Start Chatting** (zacznij czatować).

Jedna postać tworzy czat prywatny. Dwie lub więcej tworzą czat grupowy, bez żadnego dodatkowego trybu. Zasady kolejności wypowiedzi opisuje [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md).

Jeśli to nie zadziałało: przycisk **Start Chatting** wymaga konta i co najmniej jednej postaci. Możesz zamknąć kreator i ustawić wszystko później w **Chat Settings** (ustawienia czatu).

## Wybierz opcje automatyzacji

| Opcja | Domyślnie | Co robi |
| --- | --- | --- |
| **Autonomous Messages** (wiadomości autonomiczne) | Włączona | Postacie piszą do ciebie pierwsze, gdy przez jakiś czas milczysz. |
| **Generate Schedules** (generuj harmonogramy) | Wyłączona | Tworzy tygodniowy plan dnia dla każdej postaci. Widoczna tylko wtedy, gdy włączono **Autonomous Messages**. |
| **Commands** (komendy) | Wyłączona | Główny przełącznik działań, które postać podejmuje sama. |

Włącz **Generate Schedules**, a potem wybierz swoją strefę czasową w polu, które się pojawi. W **Chat Settings** ten sam przełącznik nazywa się **Schedules**. Harmonogramy i limity odezwań opisuje [Harmonogramy postaci i wiadomości autonomiczne](schedules.md).

Zmienisz je później w **Chat Settings → Autonomous Messaging**. Jeśli postacie piszą zbyt często, wyłącz tam **Autonomous Messages** albo ustaw swoją obecność na **Do Not Disturb**.

<a id="choose-which-commands-a-character-can-use"></a>

## Wybierz, których komend może używać postać

Komendy to działania, które postać podejmuje sama. Nie wpisujesz ich. Po konfiguracji otwórz **Chat Settings → Agents → Commands**. Główny przełącznik **Commands** steruje wszystkimi rodzinami: gdy jest wyłączony, żadna rodzina nie działa.

Każda rodzina ma własny przełącznik. Wszystkie są na początku włączone z wyjątkiem **Videos**, który musisz włączyć samodzielnie. Rodziny należące do opcjonalnego agenta pokazują się dopiero po zainstalowaniu tego agenta w **Agents → Agent Organizer**.

| Rodzina | Co może zrobić postać | Wymaga agenta |
| --- | --- | --- |
| **Schedule Updates** | Zmienić swój aktualny status. | Nie |
| **Cross-Post** | Wysłać wiadomość do innego czatu. | Nie |
| **Memories** | Tworzyć wspomnienia dla innych postaci. | Nie |
| **Scenes** | Rozpocząć scenę z pełnym zanurzeniem. | Nie |
| **Influence** | Wpływać na połączony czat. | Nie |
| **Notes** | Zapisywać trwałe notatki dla połączonego czatu. | Nie |
| **Reactions** | Reagować na wiadomości plakietkami emoji. | Nie |
| **Selfies** | Poprosić o wygenerowane selfie. | Illustrator |
| **Videos** | Wysyłać krótkie wiadomości wideo. | Illustrator |
| **Music** | Odtwarzać utwory przez aktywny odtwarzacz muzyki. | Music DJ |
| **Haptics** | Sterować podłączonymi urządzeniami haptycznymi. | Haptic Feedback |
| **Calls** | Zadzwonić do ciebie. | Calls |
| **UNO** | Rozpocząć grę w UNO lub ją przyjąć. | UNO |
| **Chess** | Przyjąć wyzwanie do szachów. | Chess |
| **Poker** | Zasiąść do gry w Texas Hold'em. | Poker |
| **8-Ball Pool** | Rozstawić bile do gry w bilard. | 8-Ball Pool |
| **Tic-Tac-Toe** | Przyjąć wyzwanie do kółka i krzyżyka. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Przyjąć partię. | Rock-Paper-Scissors |

Informacje o **Influence** i **Notes** znajdziesz w [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md). Ostatnia kolumna podaje agenta, którego trzeba zainstalować z **Agent Organizer**.

<a id="your-presence-status"></a>

## Twój status obecności

Twoja obecność to kolorowa plakietka w stopce paska bocznego. Jest taka sama w każdym czacie. Kliknij ją, aby wybrać status:

| Status | Znaczenie |
| --- | --- |
| **Active** (aktywny) | Jesteś online. |
| **Idle** (bezczynny) | Jesteś nieobecny. |
| **Do Not Disturb** (nie przeszkadzać) | Zatrzymuje wiadomości autonomiczne. |
| **Invisible** (niewidoczny) | Ukrywa twój status przed modelami. |

Jeśli pozostajesz **Active** i przez 10 minut nic nie robisz, aplikacja ustawia **Idle**, a po twoim powrocie znów ustawia **Active**. Jeśli sam wybierzesz status, ta automatyczna zmiana zatrzymuje się, dopóki nie wybierzesz **Active** ponownie. Status **Idle** nie zatrzymuje odezwań postaci.

Obok plakietki jest pole statusu, które gdy jest puste, pokazuje "What's up?". Wpisz tam swoją bieżącą aktywność (do 120 znaków), aby postacie o niej wiedziały. Ostatnie wpisy pojawiają się w sekcji **Recent status** (ostatni status), więc możesz użyć ich ponownie.

<a id="react-and-get-notified"></a>

## Reaguj i otrzymuj powiadomienia

Użyj przycisku **Add reaction** (dodaj reakcję) przy wiadomości, aby zareagować emoji. Późniejsze odpowiedzi widzą twoją reakcję. Gdy komenda **Reactions** jest włączona, postacie mogą reagować na twoje wiadomości i na swoje nawzajem.

Gdy postać pisze w czacie, którego nie oglądasz, na krawędzi ekranu pojawia się dymek z awatarem. Kliknij go, aby otworzyć ten czat, albo kliknij jego X, aby go zamknąć. Na telefonie kilka dymków zwija się w jedną grupę, którą można stuknąć.

## Warto wiedzieć

Czat w trybie Conversation nie używa pola **First Message** karty postaci ani jej kolorów **Dialogue Highlight Color** i **Message Box Color**. Kolor **Name Display Color** nadal koloruje imię nad każdą wiadomością. Zobacz [Gdzie widać ustawione kolory](../characters/colors-and-stats.md#where-your-colors-show).

## Powiązane funkcje

- [Selfie](selfies.md): postacie wysyłają wygenerowane zdjęcia samych siebie.
- [Rozmowy audio i wideo w trybie Conversation](calls.md)
- [Gry stołowe w trybie Conversation](table-games.md): rozpocznij grę poleceniem `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` lub `/rps`.
- [Harmonogramy postaci i wiadomości autonomiczne](schedules.md)
- [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](profiles.md)
- [Własne emoji, naklejki i GIF-y](emoji-stickers-gifs.md)
- [Łączenie czatu Conversation z czatem Roleplay lub Game](../chats/connected-chats.md)

## Rozwiązywanie problemów

| Objaw | Rozwiązanie |
| --- | --- |
| Postacie piszą zbyt często | Wyłącz **Autonomous Messages**, ustaw **Do Not Disturb** albo oznacz więcej godzin jako nieobecność w [harmonogramach](schedules.md). |
| Jedna postać odpowiada na wszystko w grupie | Ustaw, kto się odzywa, w [czatach grupowych](../chats/group-chats.md). |
| Postać zapomina wcześniejszy czat | Użyj modelu z większym oknem kontekstu (ile tekstu model czyta naraz) albo dodaj kluczowe fakty do wpisu lorebooka. |
| Selfie nie przypomina postaci | Zobacz [Selfie](selfies.md). |

Więcej pomocy: [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).
