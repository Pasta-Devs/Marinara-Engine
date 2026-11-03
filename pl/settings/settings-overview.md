# Przegląd ustawień

Sprawdź, w której części panelu **Settings** (ustawienia) leży dana opcja, skonfiguruj zakładkę **General** (ogólne) i dowiedz się, jak ustawienia synchronizują się między urządzeniami.

## Panel Settings i jego sześć zakładek

Otwórz **Settings** ikoną koła zębatego na górnym pasku. Pole **Search settings** (szukaj w ustawieniach) na górze znajduje ustawienie po nazwie. Wpisz słowo, na przykład `delete`, `streaming` lub `quotes`, a aplikacja przeskoczy do pasującej sekcji. Dopasowuje nazwy w języku interfejsu i po angielsku.

Panel ma sześć zakładek. Każda zakładka ma własne sekcje.

### Chcę coś zrobić

| Co chcesz zrobić | Gdzie to znaleźć |
| --- | --- |
| Zmienić język | **Settings → General → App Behavior → Language** (ustawienia, ogólne, zachowanie aplikacji, język) |
| Powiększyć tekst | **Settings → Appearance → App → Text & Scale** |
| Zmienić motyw lub kolory | **Settings → Appearance → App → App Style** |
| Ustawić dźwięk powiadomień | **Settings → General → Notifications** |
| Wyłączyć potwierdzenie usuwania | **Settings → General → App Behavior** |
| Dodać szybkie odpowiedzi | **Settings → General → Input & Editing** |
| Zrobić kopię zapasową | **Settings → Advanced → Backup & Export** |
| Usunąć moje dane | **Settings → Advanced → Danger Zone** |
| Zaktualizować aplikację Marinara Engine | **Settings → Advanced → Updates** |

### Co zawiera każda zakładka

**General** (ten przewodnik)

- **App Behavior** (zachowanie aplikacji; z wierszem **Search and Professor Mari settings**)
- **Notifications** (powiadomienia)
- **Responses** (odpowiedzi)
- **Input & Editing** (wprowadzanie i edycja)
- **Text Rules** (zasady tekstu)
- **Game Playback** (odtwarzanie gry)

**Appearance** (wygląd) ma cztery przyciski. Zobacz [Ustawienia wyglądu](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

Zakładka **Generations** (generowanie) zawiera **Overall Generations**, **Image Generation**, **Video Generation** i **Prompt Overrides**. Dopóki nie zainstalujesz agenta Illustrator, ta zakładka pokazuje tylko zachętę do jego pobrania. Zobacz [Profile stylu obrazów](../media/style-profiles.md) i [Generowanie wideo sceny](../media/scene-video.md).

Zakładka **Addons** (dodatki) zawiera historię wersji rozszerzeń, **Personal Extensions**, **External Extensions** (tylko po ich odblokowaniu) i **Theme Library**. Zobacz [Rozszerzenia osobiste](../extending/personal-extensions.md) i [Własne motywy CSS (Theme Library)](../appearance/custom-css-themes.md).

Zakładka **Imports** (import) zawiera **Profile & Marinara**, **SillyTavern Import** i **Game Assets**. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md) i [Importowanie z SillyTavern](../data/importing-from-sillytavern.md).

Zakładka **Advanced** (zaawansowane) zawiera te sekcje, w tej kolejności. Zobacz [Zakładka Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## Zakładka General

Każda sekcja zakładki **General** leży w **Settings → General**.

| Sekcja | Co kontroluje |
| --- | --- |
| **App Behavior** | Język, zabezpieczenie przed usunięciem, przełączniki pokazywania i ukrywania oraz wiersz **Search and Professor Mari settings**. Zobacz [App Behavior](#app-behavior). |
| **Notifications** | Dźwięki powiadomień oraz powiadomienia w przeglądarce i na Androidzie. Zobacz [Notifications](#notifications). |
| **Responses** | Streaming, przycinanie i **Messages per page**. Zobacz [Wysyłanie wiadomości i streaming](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, skróty swipe'ów i edycji. Zobacz [Input and Editing](#input-and-editing). |
| **Text Rules** | Sposób formatowania tekstu czatu. Zobacz [Text Rules](#text-rules). |
| **Game Playback** | Czytanie i nawigacja w trybie Game Mode. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md). |

### App Behavior

| Ustawienie | Co robi |
| --- | --- |
| **Language** (język) | Ustawia język interfejsu. Nie zmienia promptów modelu ani treści czatów. Tekst, który nie został jeszcze przetłumaczony, pokazuje się po angielsku. Arabski używa układu od prawej do lewej. Domyślnie: English. |
| **Documentation Language** (język dokumentacji) | Ustawia język wbudowanych przewodników. Zobacz niżej. Domyślnie: English. |
| **Confirm before deleting** (potwierdzaj przed usunięciem) | Pyta, zanim aplikacja trwale usunie czat, postać lub inny element. Domyślnie: włączone. |
| **Hide chat Help button** (ukryj przycisk Help w czacie) | Ukrywa przycisk **Help** w czatach Conversation, Roleplay i Game. Domyślnie: wyłączone. |
| **Show Android status bar** (pokaż pasek stanu Androida) | Zostawia widoczne nad aplikacją godzinę, baterię i ikony powiadomień. Działa tylko w aplikacji na Androida. Domyślnie: wyłączone. |
| **Achievements** (osiągnięcia) | Śledzi osiągnięcia, pokazuje powiadomienia o odblokowaniu oraz zakładkę i widget na ekranie głównym. Zobacz [Osiągnięcia](../home/achievements.md). Domyślnie: włączone. |
| **Disable seasonal ME themes** (wyłącz sezonowe motywy ME) | Wyłącza sezonowe motywy aplikacji Marinara Engine. Domyślnie: wyłączone. |
| **Music Player** (odtwarzacz muzyki) | Pokazuje kompaktowy odtwarzacz muzyki. Wymaga agenta **Music DJ** z sekcji **Agents → Agent Organizer** i pozostaje wyszarzony, dopóki go nie zainstalujesz. Zobacz [Music DJ: Spotify, YouTube i muzyka lokalna](../media/music.md). Domyślnie: włączone. |

**Search and Professor Mari settings** to wiersz na dole sekcji **App Behavior**. Wybierz **Open**, aby przejść do strony ustawień wyszukiwania, szybkich odpowiedzi i asystentki Professor Mari. Zobacz [Professor Mari, twoja asystentka w aplikacji](../home/professor-mari.md).

Języki interfejsu to arabski, chiński uproszczony, angielski, francuski, niemiecki, hindi, japoński, koreański, polski, portugalski brazylijski, rosyjski i hiszpański. Aby ulepszyć tłumaczenie albo dodać język, zobacz [Lokalizacja interfejsu](../development/localization.md).

W przypadku **Documentation Language** angielski jest wbudowany. Wybierz inny język i kliknij **Download & Replace** (pobierz i zastąp). Aplikacja pobiera ten pakiet językowy jeden raz i usuwa poprzedni, więc przechowuje jeden pobrany język. Przewodniki, które nie zostały jeszcze przetłumaczone, otwierają się po angielsku z małą plakietką `EN`. Wyszukiwanie w dokumentacji działa w aktywnym języku. Twój wybór przetrwa aktualizacje, a pakiet odświeża się po aktualizacji, jeśli zmieniły się jego tłumaczenia. Jeśli pobrane przewodniki znikną lub przestaną działać, pojawia się przycisk **Fix documentation** (napraw dokumentację). Pobiera on pakiet ponownie albo przywraca przewodniki po angielsku, jeśli nie da się połączyć ze źródłem pobierania.

### Notifications

Aplikacja odtwarza wbudowany sygnał powiadomień. Aby użyć własnego dźwięku:

1. Otwórz **Settings → General → Notifications**.
2. Wgraj plik w polu **Custom sound** (własny dźwięk): MP3, WAV, OGG, M4A, MP4 lub WebM, do 10 MB.

Dźwięk odtwarza się na każdym urządzeniu połączonym z tym serwerem. Da się go odsłuchać, podmienić albo usunąć. Jeśli nie da się odczytać pliku, aplikacja odtwarza wbudowany sygnał. Plik wchodzi w skład kopii zapasowych i eksportów profilu.

**Background Notifications** (powiadomienia w tle) obejmują wiadomości w trybie Conversation, które postacie wysyłają same. **Generation Completion Notifications** (powiadomienia o zakończeniu generowania) obejmują odpowiedzi, które uruchamiasz samodzielnie w trybach Conversation, Roleplay i Game Mode. Oba działają, gdy aplikacja jest otwarta, ale nieaktywna. Nigdy nie pokazują treści wiadomości.

### Input and Editing

Ustawienia w **Settings → General → Input & Editing**:

| Ustawienie | Co robi |
| --- | --- |
| **Send on Enter** (wysyłaj klawiszem Enter) | Wybiera tryby, w których klawisz Enter wysyła wiadomość. |
| **Keep guidance after regenerating** (zachowaj wskazówkę po ponownym generowaniu) | Zostawia twoją wskazówkę w polu wiadomości po sterowanym ponownym generowaniu. Domyślnie włączone. |
| **Add CYOA choices to the message box instead of sending them** (dodawaj wybory CYOA do pola wiadomości zamiast je wysyłać) | Wstawia kliknięty wybór do pola wiadomości, aby można go było najpierw zmienić. |
| **Quick replies** (szybkie odpowiedzi) | Dodaje działania z gotowym szkicem obok przycisku wysyłania. Zobacz [Sterowane generowanie i Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** (mikrofon mowy na tekst) | Pokazuje przycisk mikrofonu w polach wpisywania czatu. |
| **Intuitive swipe navigation** (intuicyjna nawigacja swipe'ami) | Przełącza między swipe'ami (kilkoma odpowiedziami zachowanymi w jednej wiadomości) klawiszami strzałek albo przesunięciem palcem. |
| **Reroll past the newest swipe** (generuj ponownie za najnowszym swipe'em) | Tworzy nową odpowiedź, gdy przesuniesz poza najnowszy swipe. |
| **Up Arrow edits last message** (strzałka w górę edytuje ostatnią wiadomość) | Naciśnij strzałkę w górę w pustym polu wpisywania, aby edytować swoją ostatnią wiadomość. |
| **Double-click edits messages** (dwuklik edytuje wiadomości) | Kliknij dwukrotnie wiadomość w trybie Roleplay, aby ją edytować. |

Sekcja **Responses** zawiera **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (domyślnie włączone) i **Messages per page**. Zobacz [Wysyłanie wiadomości i streaming](../chats/sending-and-streaming.md). O działaniach na wiadomościach przeczytasz w [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](../chats/messages.md).

### Text Rules

Te zasady zmieniają sposób obsługi tekstu czatu w **Settings → General → Text Rules**. Ustawienia **Bold dialogue in quotes** i **Convert LaTeX symbols** zmieniają tylko wygląd tekstu, więc zapisane wiadomości zostają bez zmian. Ustawienie **Quote style** przepisuje cudzysłowy w tekście, który wpisujesz i zapisujesz.

| Ustawienie | Co robi |
| --- | --- |
| **Bold dialogue in quotes** | Pokazuje tekst w cudzysłowie pogrubiony. Domyślnie włączone. |
| **Convert LaTeX symbols** | Pokazuje polecenia matematyczne LaTeX jako symbole. Kod zostaje bez zmian. Domyślnie włączone. |
| **Quote style** | **Straight** zostawia zwykłe znaki (domyślnie). **Typographic** zamienia je na zakrzywione cudzysłowy i apostrofy. |
| **Load images from other websites in messages** | Steruje obrazami z innych stron internetowych. Domyślnie wyłączone. |

#### Bold dialogue in quotes

Gdy to ustawienie jest włączone, słowa w cudzysłowie w zdaniu `"I missed you," she said.` pojawiają się pogrubione. Wyłącz je, aby zachować kolor dialogu bez pogrubienia.

#### Convert LaTeX symbols

Niektóre modele zapisują matematykę jako polecenia LaTeX. Gdy to ustawienie jest włączone, `\rightarrow`, `\neq`, `\times` i `\alpha` pokazują się jako `→`, `≠`, `×` i `α`.

#### Load images from other websites in messages

Gdy to ustawienie jest wyłączone, obraz z innej strony internetowej w wiadomości, powitaniu lub podglądzie karty pokazuje nazwę tej strony i przycisk **Load image** (wczytaj obraz). Dzięki temu wiadomość nie łączy się sama z innymi stronami. Wybierz **Load image**, aby pokazać ten obraz. Aplikacja zapamiętuje twój wybór na wszystkich urządzeniach. Włącz to ustawienie, aby od razu pokazywać każdy obraz. Obrazy zapisane w aplikacji Marinara Engine, takie jak obrazy z galerii, awatary i sprite'y, pokazują się zawsze.

<a id="the-advanced-tab"></a>

## Zakładka Advanced

| Sekcja | Więcej informacji |
| --- | --- |
| **Admin Access** | [Dostęp zdalny](../REMOTE_ACCESS.md) |
| **Features** | [Przełączniki funkcji](../configuration/features.md) |
| **Updates** | [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [Czyszczenie i resetowanie danych](../data/clearing-data.md) |

### Message Tools

Te przełączniki leżą w **Settings → Advanced → Message Tools**. Wszystkie są domyślnie wyłączone, z wyjątkiem **Show context usage** i **Show "older messages not sent" note**.

| Przełącznik | Co robi |
| --- | --- |
| **Show message timestamps** (pokaż znaczniki czasu wiadomości) | Pokazuje datę i godzinę przy każdej wiadomości. |
| **Show characters in Persona pickers** (pokaż postacie w wyborze persony) | Wypisuje twoje postacie w oknach wyboru persony, aby można było grać jedną z nich. |
| **Show model name on messages** (pokaż nazwę modelu przy wiadomościach) | Pokazuje, który model napisał każdą odpowiedź. |
| **Show token usage on messages** (pokaż użycie tokenów przy wiadomościach) | Pokazuje liczbę tokenów promptu i odpowiedzi dla każdej wiadomości. |
| **Show context usage** (pokaż użycie kontekstu) | Pokazuje, jak bardzo zapełnione było okno kontekstu przy ostatnim zmierzonym żądaniu, w przełącznikach połączeń i ustawieniach czatu Game. |
| **Show message numbers** (pokaż numery wiadomości) | Pokazuje numer przy każdej wiadomości. |
| **Show "older messages not sent" note** (pokaż notatkę o niewysłanych starszych wiadomościach) | Pokazuje notatkę pod najnowszą odpowiedzią, gdy starsze wiadomości nie zmieściły się w prompcie. Odpowiedź urwana lub pusta nadal pokazuje własną notatkę. |
| **Guide swipes/regens with chat input** (steruj swipe'ami i ponownym generowaniem polem czatu) | Używa twojego szkicu jako wskazówki przy ponownym generowaniu. |
| **Include reasoning in exports** (dołącz rozumowanie do eksportów) | Dodaje ukryte myślenie modelu do eksportów czatu. |
| **Include private notes in exports** (dołącz prywatne notatki do eksportów) | Dodaje twoje prywatne notatki do wiadomości w eksportach JSONL i tekstowych. Zostaw wyłączone, gdy udostępniasz zapis rozmowy. |
| **Debug mode** (tryb debugowania) | Zapisuje dane wysyłane do modeli w konsoli serwera na potrzeby wsparcia. |

Więcej znajdziesz w: [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](../chats/messages.md), [Persony użytkownika: tworzenie i edycja](../characters/personas.md), [Wybór modelu dla jednego czatu](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt: zobacz, co dostał model AI](../chats/peek-prompt.md), [Sterowane generowanie i Impersonate](../chats/guided-and-impersonate.md), [Eksport i import czatów](../chats/export-import.md) i [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Jak ustawienia synchronizują się między urządzeniami

Aplikacja zapisuje większość ustawień na serwerze, więc podążają za tobą między przeglądarkami i urządzeniami.

1. Zmieniasz ustawienie w **Settings**.
2. Mniej więcej sekundę później aplikacja zapisuje je na serwerze.
3. Inna przeglądarka, która otwiera ten sam serwer, wczytuje te ustawienia.

Wygrywa najnowsza zmiana. Jeśli wkrótce po zmianie otworzysz aplikację na drugim urządzeniu, jego starsza kopia może zastąpić twoją zmianę. Poczekaj chwilę, zanim przełączysz urządzenie.

Dwa ustawienia nigdy się nie synchronizują. Ustaw je ponownie na każdym urządzeniu w **Settings → Appearance → Text & Scale**:

- **Display Size** (rozmiar wyświetlania), czyli rozmiar tekstu interfejsu
- **Chat Font Size** (rozmiar czcionki czatu), czyli rozmiar tekstu czatu

Zobacz [Ustawienia wyglądu](../appearance/appearance-settings.md). Jeśli nie da się połączyć z serwerem, aplikacja działa dalej na lokalnych ustawieniach i próbuje ponownie przy następnej zmianie.

## Powiązane przewodniki

- [Ustawienia wyglądu](../appearance/appearance-settings.md)
- [Działania na wiadomości: edycja, usuwanie, swipe'y, ponowne generowanie](../chats/messages.md)
- [Gdzie Marinara przechowuje dane](../data/where-data-is-stored.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
