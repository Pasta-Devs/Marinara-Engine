# Łączenie czatu Conversation z czatem Roleplay lub Game

Z tego przewodnika dowiesz się, jak połączyć czat w trybie Conversation z czatem w trybie Roleplay lub Game, żeby oba dzieliły wspólny kontekst. Opisuje też funkcję **Cross-Chat Awareness** (świadomość innych czatów), specjalne tagi przekazujące informacje przez takie połączenie oraz sposób przeskakiwania między połączonymi czatami.

Marinara Engine (dalej krótko: Marinara) ma dwie osobne funkcje, dzięki którym czaty wiedzą o sobie nawzajem. Jedna działa automatycznie. Druga to jawne połączenie jeden do jednego, które trzeba utworzyć samodzielnie. Ten przewodnik traktuje je oddzielnie, bo działają zupełnie inaczej.

## Do czego służą Connected Chats

Sekcja **Connected Chats** (połączone czaty) łączy jeden czat Conversation z jednym czatem Roleplay lub Game. Połączenie jest jeden do jednego. Każdy czat może mieć w danej chwili tylko jeden taki odpowiednik.

Po utworzeniu połączenia strona Conversation sama czyta ostatnie wiadomości z połączonego czatu fabularnego. W każdej turze wciąga je do własnego kontekstu. To automatyczny kierunek połączenia.

Czat fabularny (Roleplay lub Game) nie czyta automatycznie wiadomości z czatu Conversation. Informacje w drugą stronę przekazuje postać za pomocą specjalnych tagów. Opisujemy je niżej.

Typowe zastosowanie: w jednym czacie toczy się wciągająca rozgrywka Roleplay lub Game, a w czacie Conversation trwa luźna rozmowa poza fabułą (OOC, czyli out-of-character) na wiadomości prywatne. Czat OOC zna bieżące wydarzenia, więc można je komentować na żywo.

## Cross-Chat Awareness to nie to samo co połączenie

Te dwie funkcje łatwo pomylić. Przeczytaj ten fragment, zanim cokolwiek skonfigurujesz.

Funkcja **Cross-Chat Awareness** działa automatycznie. To ustawienie trybu Conversation. Kiedy ta sama postać występuje w kilku czatach Conversation, potrafi pamiętać i przywoływać to, co wydarzyło się w pozostałych. Nic nie trzeba łączyć ręcznie. Ustawienie jest domyślnie włączone.

Znajdziesz je w sekcji **Cross-Chat Awareness** w panelu **Chat Settings** (ustawienia czatu). Opis pomocniczy brzmi: "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Marinara dobiera te pokrewne czaty po wspólnej postaci, a nie po wspólnym użytkowniku.

Połączenie **Connected Chats** działa inaczej. Tworzy się je świadomie. Łączy dokładnie jeden czat Conversation z jednym czatem Roleplay lub Game. Przenosi kontekst fabuły i obsługuje opisane niżej specjalne tagi.

W skrócie: **Cross-Chat Awareness** automatycznie łączy postać między jej własnymi czatami Conversation. Połączenie **Connected Chats** ręcznie spina jeden czat Conversation z jednym czatem fabularnym.

## Łączenie czatu Conversation z czatem Roleplay lub Game

Połączenie zaczyna się od strony czatu Conversation albo od czatu Game. Oto, jak zrobić to od strony czatu Conversation.

1. Otwórz czat Conversation, który chcesz połączyć.
2. Otwórz **Chat Settings** przyciskiem w czacie. Domyślnie jest w prawym górnym rogu; możesz go przenieść.
3. Znajdź sekcję **Connected Chats**.
4. Kliknij przycisk **Link to Roleplay or Game**.
5. Wyszukaj czat Roleplay lub Game w oknie wyboru, a potem go kliknij.

W sekcji **Connected Chats** powinna teraz widnieć nazwa połączonego czatu wraz z jego trybem. Obok znajduje się mały przycisk rozłączenia.

Żeby rozpocząć od strony czatu Game, otwórz panel **Chat Settings** tego czatu, znajdź sekcję **Connected Chats** i kliknij przycisk **Link to Conversation**. Następnie wskaż czat Conversation.

Czat Roleplay nie ma własnego przycisku łączenia. Pokazuje gotowe połączenie, ale utworzyć je trzeba od strony czatu Conversation.

W oknie wyboru pojawiają się wyłącznie czaty jeszcze niepołączone. Jeden czat obsługuje w danej chwili jedno połączenie.

### Usuwanie połączenia

Żeby usunąć połączenie, otwórz panel **Chat Settings**, znajdź sekcję **Connected Chats** i kliknij przycisk rozłączenia (jego podpowiedź brzmi **Disconnect**). Rozłączenie kasuje też wszystkie oczekujące wpływy i zapisane notatki związane z tym połączeniem.

Usunięcie czatu również rozłącza go od powiązanego czatu.

## Przekazywanie informacji przez połączenie

Czat Conversation czyta czat fabularny automatycznie. Pozostałe kierunki obsługują tagi. Tagi te pojawiają się w wiadomościach postaci. Pisze je AI. Zwykle nie wpisuje się ich ręcznie, ale wiedza o tym, co robią, ułatwia zrozumienie całego pomostu.

Gdyby zaszła potrzeba odwołania się do nich, zapisz je dosłownie. Każdy pokazujemy tutaj jako kod, żeby wyświetlił się dokładnie tak, jak trzeba.

- `<influence>` wysyła jednorazową podpowiedź z czatu Conversation do połączonego czatu fabularnego. Wpływa na najbliższą turę w tym czacie, a potem się zużywa.
- `<note>` zapisuje trwały fakt z czatu Conversation w połączonym czacie fabularnym. Zostaje w treści promptu czatu fabularnego w każdej turze, dopóki go nie usuniesz.
- `<ooc>` pozwala postaci z czatu Roleplay wyjść z fabuły i odpowiedzieć wprost w połączonym czacie Conversation. Marinara publikuje ten tekst w połączonym czacie na wiadomości prywatne.

Dzięki temu postać z czatu Conversation może dyskretnie kształtować fabułę lub uzupełniać ją o fakty za pomocą tagów `<influence>` i `<note>`. Postać z czatu Roleplay może odpowiedzieć do czatu Conversation tagiem `<ooc>`.

## Conversation Notes

Kiedy postać z czatu Conversation zapisze trwałą notatkę tagiem `<note>`, notatka pojawia się po stronie fabuły. W panelu **Chat Settings** czatu Roleplay lub Game przybywa wtedy sekcja **Conversation Notes** (notatki z czatu Conversation).

Sekcja ta wymienia wszystkie zapisane notatki. Przy każdej znajduje się przycisk usuwania. Żeby skasować je wszystkie naraz, użyj przycisku **Clear all notes**. Marinara prosi wtedy o potwierdzenie, a operacji nie da się cofnąć.

Jeśli żadna postać nie zapisała jeszcze notatki, sekcja wyjaśnia, że notatki objęte tagiem `<note>` pojawią się tutaj po zapisaniu.

<a id="switching-between-connected-chats"></a>

## Przeskakiwanie między połączonymi czatami

Kiedy czat ma swój odpowiednik, w prawym górnym rogu czatu pojawia się mały przycisk **Connected chat** z ikoną podwójnej strzałki. Możesz przeciągnąć go w inne miejsce na komputerze lub telefonie. Kliknij go lub dotknij, żeby otworzyć małe okno, a następnie wybierz **Switch to** z nazwą drugiego czatu.

Od razu przejdziesz do połączonego czatu. Przycisk działa po obu stronach połączenia.

Przyciskiem **Put back in Chat Settings** możesz przenieść tę kontrolkę do Chat Settings. Pojawi się tam w osobnej sekcji **Connected chat**. Przycisk otwierania sekcji w osobnym oknie pozwala ponownie ją odłączyć.

## Pozostałe kontrolki w tej sekcji

Sekcja **Connected Chats** zawiera też dwie dodatkowe kontrolki należące do innych funkcji. Wyświetlają się tutaj dla wygody.

- Pole na adres URL webhooka Discord (**Discord webhook URL**). Nie ma widocznej etykiety, tylko tekst zastępczy zaczynający się od `https://discord.com/api/webhooks/`. Wklejony tutaj adres URL webhooka Discord powiela wiadomości czatu na kanał Discord. To część funkcji powielania wiadomości na Discord, która ma własny przewodnik.
- Przełącznik **Allow Noodle references** (domyślnie wyłączony). Dzięki niemu wbudowana oś czasu Noodle może pobierać ostatnie wiadomości z tego czatu. Noodle ma własny przewodnik.

Po stronie czatu Roleplay widać dodatkowo przełącznik **Allow character DMs** (domyślnie wyłączony). Po włączeniu postać z czatu Roleplay może sama napisać do ciebie w nowym czacie Conversation na wiadomości prywatne, prosto z fabuły. Działa to nawet wtedy, gdy żaden czat Conversation nie jest jeszcze połączony.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
- [Tryb Roleplay: pierwsze kroki](../roleplay/getting-started.md)
