# Harmonogramy postaci i wiadomości autonomiczne

Wiadomości autonomiczne to wiadomości, które postać wysyła do ciebie pierwsza, gdy przez jakiś czas milczysz. Harmonogram to tygodniowy plan postaci, dzięki któremu o różnych porach wydaje się ona obudzona, zajęta albo śpiąca. Oba mechanizmy działają tylko w trybie Conversation.

Harmonogramy są opcjonalne. Przy wyłączonych harmonogramach postacie nadal odzywają się same zależnie od swojej gadatliwości (jak często postać zaczyna rozmowę) i twojej obecności.

Skocz do: [Włącz harmonogramy](#turn-on-schedules), jeśli potrzebujesz tylko harmonogramu.

## Włącz wiadomości autonomiczne

Zanim zaczniesz: otwórz czat Conversation. Nowe czaty zaczynają z tą opcją włączoną (zobacz [Tryb Conversation: pierwsze kroki](getting-started.md)).

1. Otwórz **Chat Settings** (ustawienia czatu) w czacie.
2. Znajdź sekcję **Autonomous Messaging** (wiadomości autonomiczne).
3. Włącz **Autonomous Messages**.

Jeśli to nie zadziałało: postacie milczą, gdy twoja obecność to **Do Not Disturb** (zobacz [Twój status obecności](getting-started.md#your-presence-status)).

### Ustaw limit odezwań

W **Chat Settings → Autonomous Messaging** pole **Chat Check-In Cap** ogranicza, ile odezwań na dobę mogą wysłać postacie w tym czacie.

- **Default chat ceiling (talkativeness-based)** bierze limit z gadatliwości każdej postaci (tabela niżej).
- **Numeric value** pokazuje pole liczby. Wpisz dowolną liczbę całkowitą równą 1 lub większą. Wysokie liczby mogą oznaczać wiele żądań do modelu i powiadomień.

Postać może też mieć własny **Daily safety limit** (ustawiany w jej harmonogramie). Limit dla postaci działa tak:

- Limit czatu ustawiony na **Numeric value** i ustawiony **Daily safety limit**: wygrywa niższa liczba.
- Ustawiony tylko jeden z nich: obowiązuje ta liczba, nawet jeśli jest wyższa niż liczba wynikająca z gadatliwości podana niżej.
- Żaden nie jest ustawiony: liczba wynika z gadatliwości postaci.

| Gadatliwość postaci | Odezwań na dobę |
| --- | --- |
| 80 lub więcej | 8 |
| od 60 do 79 | 6 |
| od 40 do 59 | 5 |
| od 20 do 39 | 3 |
| poniżej 20 | 2 |

<a id="turn-on-schedules"></a>

## Włącz harmonogramy

Zanim zaczniesz: włącz **Autonomous Messages**.

1. W **Chat Settings → Autonomous Messaging** włącz **Schedules** (harmonogramy). (W kreatorze nowego czatu ta sama opcja nazywa się **Generate Schedules**.) Istniejące harmonogramy pojawiają się od razu.
2. Wybierz swoją strefę czasową w polu pod spodem.
3. Kliknij **Generate** (generuj), aby utworzyć harmonogramy dla postaci, które ich nie mają. Gdy harmonogramy już istnieją, przycisk nazywa się **Regenerate**.
4. Poczekaj na koniec. Pojawi się wtedy lista **Edit schedules** z jednym wierszem na postać. Wiersz podaje, ile dni jest wypełnionych (na przykład **3 days scheduled**), albo **Create schedule**. Lista pokazuje się dopiero wtedy, gdy harmonogramy istnieją.
5. Kliknij wiersz postaci, aby otworzyć jej edytor harmonogramu (następna sekcja).

Harmonogram należy do postaci i jest używany w każdym czacie Conversation. Wyłączenie **Schedules** w jednym czacie zostawia je wyłączone tylko tam i zachowuje harmonogram.

Automatyczne tygodniowe odnawianie jest wyłączone, chyba że włączysz **Renew weekly** dla tej postaci w oknie **Character Schedule Manager** (menedżer harmonogramów postaci). Otworzysz je przyciskiem kalendarza w stopce paska bocznego, obok pola statusu.

Aplikacja próbuje odnowić harmonogram raz dla każdego czatu przy każdym wczytaniu strony aplikacji. Jeśli się to nie uda, nie próbuje ponownie, dopóki nie wczytasz strony od nowa. Kliknij **Generate**, aby spróbować jeszcze raz.

Pole **Schedule generation preferences** w tym samym obszarze **Schedules** w **Chat Settings** zawiera wskazówki w wolnym tekście o tym, jak pisać harmonogramy. Obowiązuje we wszystkich czatach Conversation przy następnym generowaniu harmonogramów. Przykład:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Edytor harmonogramów

Tytuł edytora składa się ze słowa **Edit**, imienia postaci i słowa **Schedule**.

Na górze pole **Routine profile** (profil rutyny) pokazuje zwięzłe podsumowanie tygodnia. Kliknij **Generate summary**, aby je utworzyć, albo **Refresh summary**, aby je odświeżyć. Po zmianie harmonogramu pojawia się napis **Summary may be stale**. Lista **Generation model** wybiera model, który pisze harmonogramy.

### Tuning

Otwórz **Tuning** (dostrajanie), aby zobaczyć główne ustawienia.

- **Chat talkativeness**: suwak z pozycjami **Rare**, **Quiet**, **Balanced**, **Social** i **Very frequent**. Domyślna jest **Balanced**. Ustawia, jak często postać zaczyna wiadomości i włącza się do rozmowy grupowej, oraz jej domyślny dzienny limit.
- **Wait before checking in**: minuty ciszy, po których postać może się odezwać. Domyślnie 120. Możesz ustawić od 15 do 360.
- **Check-in moments**: plakietki **Morning**, **Goodnight**, **Meal breaks**, **After busy** i **Long absence**. Wszystkie są włączone. Kliknij jedną, aby ją wyłączyć.

Otwórz **Advanced timing** wewnątrz sekcji **Tuning**, aby zobaczyć trzy kolejne ustawienia.

- **Daily safety limit**: największa liczba odezwań na dobę dla tej postaci. Zostaw **Default** albo wpisz liczbę całkowitą równą 1 lub większą. Jeśli czat ma też limit liczbowy, wygrywa niższa liczba. W przeciwnym razie ta liczba zastępuje liczbę wynikającą z gadatliwości.
- **Delay while you're away**: dodatkowe minuty, zanim postać odpowie, gdy jej status to **Away**. Zostaw puste, aby losowo czekać od 1 do 3 minut. Możesz ustawić od 0 do 120.
- **Delay while you're busy**: to samo, gdy jej status to **Busy**. Zostaw puste, aby losowo czekać od 2 do 5 minut. Możesz ustawić od 0 do 120.

### Schedule AI: przepisanie tygodnia

Otwórz **Schedule AI**, aby model przepisał harmonogram. Wybierz jedną opcję **Week action**:

| Działanie | Wynik |
| --- | --- |
| **Rewrite** | Nowy szkic całego tygodnia. |
| **Adjust** | Zachowuje większość harmonogramu i stosuje twoje wskazówki. |
| **Vary** | Wyraźnie inny tydzień, który nadal jest wiarygodny. |
| **Repair** | Naprawia luki i oczywiste problemy małymi zmianami. |

1. Wybierz **Week action**.
2. W sekcji **Weekly generation** wybierz **Entire week in one request** albo **One request per day**. Opcja jednego żądania na dzień wysyła siedem mniejszych żądań i może zużyć więcej tokenów (małych kawałków tekstu, które liczą modele).
3. Wpisz opcjonalne wskazówki w polu **Week guidance**, na przykład `make weekdays more nocturnal, keep weekends social`.
4. Kliknij przycisk z nazwą twojego działania, na przykład **Rewrite week**.
5. Kliknij **Save schedule** (zapisz harmonogram), aby zachować wynik. Do tego czasu jest to tylko szkic (**Unsaved draft**).

Jeśli to nie zadziałało: twój szkic zostaje zachowany. Nieudane wywołanie nie jest ponawiane, więc kliknij przycisk jeszcze raz. Kliknij **Stop** albo zamknij edytor, aby przerwać trwające żądanie. Jeśli edytor pokazuje **Edit generated schedule JSON**, model zwrócił tekst, którego nie dało się odczytać. Popraw tam tekst i kliknij **Apply to draft**.

### Bloki dzienne

Każdy dzień od poniedziałku do niedzieli ma własny wiersz. Pusty dzień pokazuje **No blocks scheduled for this day**. Każdy blok ma status, zakres czasu, taki jak `09:00-11:30`, i krótką aktywność, taką jak `at work`.

1. Kliknij **Add block** pod danym dniem.
2. Wybierz status: **Online**, **Away**, **Busy** lub **Offline**.
3. Wpisz zakres czasu i aktywność.
4. Kliknij **Save schedule**. Przycisk **Cancel** zamyka edytor bez zapisu.

Użyj ikony kosza, aby usunąć blok. Aby przepisać jeden dzień, wpisz wskazówkę w polu **Guide Monday** (albo innego dnia) i kliknij **Regenerate Monday**.

Podczas bloku **Offline** postać nigdy nie pisze pierwsza. Podczas bloku **Busy** czeka trzy razy dłużej niż zwykle.

### Przenieś harmonogram między postaciami

Kliknij **Export schedule**, aby pobrać szkic jako plik JSON (bloki tygodniowe, podsumowanie, gadatliwość, momenty odezwań i czasy). W edytorze innej postaci kliknij **Import schedule**, aby go wczytać. Aplikacja sprawdza plik i przenosi harmonogram na bieżący tydzień. Nic nie zostaje zapisane, dopóki nie klikniesz **Save schedule**.

## Ustaw status poleceniem /status

Polecenie `/status` ustawia lub czyści tymczasowy status postaci bez zmiany jej zapisanego harmonogramu. Działa tylko w trybie Conversation. Status należy do postaci, więc obowiązuje w każdym czacie, w którym ona jest.

Wpisz jedną z tych linii w polu wiadomości:

```text
/status dnd Mira
/status clear Mira
```

Pierwsza sprawia, że Mira jest zajęta. Druga przywraca ją do harmonogramu. Gdy w czacie jest jedna postać, możesz pominąć imię. Samo `/status` wypisuje postacie i sposób użycia.

Pełna postać polecenia jest niżej. `idle` oznacza **Away**, a `dnd` oznacza **Busy**. Nawiasy kwadratowe oznaczają, że imię jest opcjonalne.

```text
/status online|idle|dnd|offline|clear [character name]
```

Ustawiony status trwa, dopóki go nie wyczyścisz, a postać nie może go zastąpić.

## Pozwól postaciom zmieniać własny status

Gdy **Schedule Updates** jest włączone w **Chat Settings → Agents → Commands**, postać może ustawić własny tymczasowy status i aktywność. Na przykład jeśli poprosisz ją o skupienie na godzinę, może przełączyć się na **Busy** z aktywnością "Studying".

- Zmiana trwa tak długo, jak powie postać, albo godzinę, jeśli nie poda czasu. Najdłuższy czas to siedem dni.
- Gdy czas minie, postać wraca do harmonogramu albo do **Online**, jeśli go nie ma.
- Nigdy nie edytuje zapisanego harmonogramu.

## Jak działa tempo odezwań

| Reguła | Szczegóły |
| --- | --- |
| Pierwsze odezwanie | Postać czeka, aż będziesz milczeć przez czas z ustawienia **Wait before checking in** (domyślnie 120 minut). |
| Reakcja | Twoja reakcja bez nowej wiadomości otwiera krótsze oczekiwanie. |
| Status **Offline** | Brak odezwań. |
| Status **Busy** | Oczekiwanie jest trzy razy dłuższe. |
| Kolejne odezwania | Do dwóch więcej, gdy nadal milczysz, czyli trzy w sumie. Pierwsze kolejne przychodzi po dwukrotności czasu oczekiwania, drugie po czterokrotności. |
| Twoja odpowiedź | Licznik się zeruje. |
| Kilka postaci gotowych | Pierwsza idzie ta z największą gadatliwością i najlepszym momentem. Postać ze statusem **Online** ma wyższą pozycję. |

W czacie grupowym, w którym każda postać odpowiada osobną wiadomością (zobacz [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md)), postacie dzielą jeden dzienny limit i jedno tempo. Gdy którakolwiek postać się odezwie, następne odezwanie dowolnej z nich czeka tak jak kolejne odezwanie. Wysłać je może każda postać, której własny czas oczekiwania minął, a pierwsza idzie ta, która danego dnia odezwała się najmniej razy. Po długiej nieobecności odzywa się tylko jedna postać.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](profiles.md)
- [Panel Chat Settings – przegląd](../chats/chat-settings.md)
