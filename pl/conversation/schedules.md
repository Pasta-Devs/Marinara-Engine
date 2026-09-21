# Harmonogramy postaci i wiadomości autonomiczne

Z tego przewodnika dowiesz się, jak postacie w trybie Conversation odzywają się pierwsze i jak ustalić, kiedy to robią. Opisuje wiadomości autonomiczne, harmonogramy postaci, komendę **/status** oraz status obecności. Wszystkie te funkcje działają wyłącznie w trybie Conversation.

## Do czego służą wiadomości autonomiczne i harmonogramy

Wiadomość autonomiczna to wiadomość, którą postać wysyła pierwsza, bez żadnego pytania z drugiej strony. Marinara Engine (w skrócie Marinara) wysyła je po dłuższej ciszy, dzięki czemu czat przypomina prawdziwą wymianę wiadomości.

Za to zachowanie odpowiadają dwa ustawienia:

- **Autonomous Messages** decyduje, czy postacie w ogóle mogą się odzywać.
- **Schedules** dają każdej postaci tygodniową rutynę, więc o różnych porach wydaje się rozbudzona, zajęta albo śpiąca.

Harmonogramy są opcjonalne. Przy włączonych wiadomościach autonomicznych i wyłączonych harmonogramach postacie nadal się odzywają, kierując się swoją gadatliwością i twoim statusem. Gadatliwość to ustawienie osobne dla każdej postaci: mówi, jak często zaczyna ona rozmowę z własnej inicjatywy.

## Włączanie wiadomości autonomicznych

Steruje się tym z poziomu czatu, a nie karty postaci. Wszystkie te ustawienia znajdują się w sekcji **Autonomous Messaging** panelu **Chat Settings** (ustawienia czatu).

1. Otwórz czat w trybie Conversation.
2. Otwórz panel **Chat Settings** (ikona koła zębatego).
3. Znajdź sekcję **Autonomous Messaging**.
4. Włącz przełącznik **Autonomous Messages**.

W kreatorze nowego czatu opcja **Autonomous Messages** jest domyślnie włączona. Można ją wyłączyć w każdej chwili w panelu **Chat Settings**.

### Chat Check-In Cap

Pod przełącznikiem znajduje się lista rozwijana **Chat Check-In Cap**, która ogranicza liczbę odezwań postaci w tym czacie w ciągu doby.

- Domyślna opcja to **Default chat ceiling (talkativeness-based)**. Limit wynika wtedy z gadatliwości każdej postaci.
- Wybierz **Numeric value**, żeby pojawiło się pole liczbowe, i wpisz dowolny dodatni limit całkowity. Wysokie limity oznaczają wiele zapytań do modelu i wiele powiadomień.

Ten limit obowiązuje cały czat. Własny limit postaci, ustawiony w jej harmonogramie, może tę liczbę tylko obniżyć, nigdy podnieść.

Wartość domyślna oparta na gadatliwości działa tak:

| Gadatliwość postaci | Domyślna liczba odezwań dziennie |
|---|---|
| 80 lub więcej | 8 |
| od 60 do 79 | 6 |
| od 40 do 59 | 5 |
| od 20 do 39 | 3 |
| poniżej 20 | 2 |

### Włączanie harmonogramów

Przełącznik **Schedules** (harmonogramy) jest w sekcji **Autonomous Messaging**. Zapisane rutyny należą do postaci i są używane we wszystkich czatach Conversation, także w istniejącym czacie po dodaniu postaci. Wyraźne wyłączenie harmonogramów w danym czacie zachowuje to ustawienie bez usuwania rutyny postaci.

1. Włącz przełącznik **Schedules**.
2. Istniejące rutyny pojawiają się od razu. Samo włączenie harmonogramów nie generuje nowych; kliknij **Generate**, gdy ich potrzebujesz.
3. Kiedy rutyny są gotowe, pojawia się lista **Edit schedules** z jednym wierszem na postać.

Automatyczne odnawianie tygodniowe jest wyłączone, dopóki nie włączysz go dla postaci w **Character Schedule Manager** (menedżer harmonogramów postaci). Po błędzie otwieranie czatu nie ponawia stale żądania; użyj przycisków generowania, aby spróbować ponownie.

Każdy wiersz pokazuje liczbę wypełnionych dni, na przykład **3 days scheduled**, albo napis **Create schedule**, jeśli dana postać nie ma jeszcze harmonogramu. Przycisk **Generate** (po utworzeniu rutyn opisany jako **Regenerate**) buduje rutyny od nowa, kiedy tylko chcesz.

## Edytor harmonogramu

Kliknij wiersz postaci na liście **Edit schedules**, żeby otworzyć edytor harmonogramu. Tytuł okna to **Edit**, nazwa postaci i słowo **Schedule**.

Na górze, w obszarze **Routine profile**, widać opis całego tygodnia zwykłym językiem. Przycisk **Generate summary** tworzy ten opis, a **Refresh summary** go odświeża. Po zmianie harmonogramu już po utworzeniu opisu pojawia się uwaga **Summary may be stale**.

### Tuning

Główne ustawienia kryją się w sekcji **Tuning**.

- **Chat talkativeness** to suwak o pięciu stopniach: **Rare**, **Quiet**, **Balanced**, **Social** i **Very frequent**. Środkowy stopień **Balanced** jest domyślny. Ta wartość zastępuje domyślną gadatliwość postaci wszędzie tam, gdzie używany jest jej harmonogram. Wpływa na to, jak często postać zaczyna wiadomości, dopisuje kolejne i włącza się do rozmowy w grupie. Ustala też domyślny dzienny limit postaci.
- **Wait before checking in** to czas ciszy w minutach, po którym postać może się odezwać. Zakres to od 15 do 360 minut. Domyślnie **120**.
- **Check-in moments** to powody, dla których postać może się odezwać. Kafelki to **Morning**, **Goodnight**, **Meal breaks**, **After busy** i **Long absence**. Wszystkie są domyślnie włączone. Kliknięcie kafelka go wyłącza.

### Advanced timing

W sekcji **Tuning** otwórz **Advanced timing**, żeby zobaczyć trzy dodatkowe ustawienia.

- **Daily safety limit** to twardy limit dla tej jednej postaci: albo **Default**, albo liczba od 1 do 8 dziennie. Może obniżyć limit czatu, ale nie może go podnieść. Zwykle najlepiej zostawić **Default**.
- **Delay while you're away** określa, ile minut ta postać czeka z wysłaniem wiadomości, gdy jej własny status to **Away**. Puste pole oznacza wartość domyślną, czyli losowo od 1 do 3 minut. Zakres to od 0 do 120 minut.
- **Delay while you're busy** działa tak samo, gdy status postaci to **Busy**. Puste pole oznacza wartość domyślną, czyli losowo od 2 do 5 minut. Zakres to od 0 do 120 minut.

### Schedule AI: napisanie tygodnia od nowa

Otwórz sekcję **Schedule AI**, żeby model przepisał rutynę za ciebie. Wybierz jedną opcję **Week action**:

- **Rewrite** tworzy zupełnie nowy szkic całego tygodnia.
- **Adjust** zachowuje większość rutyny i stosuje twoje wskazówki.
- **Vary** układa tydzień wyraźnie inaczej, ale nadal wiarygodnie.
- **Repair** łata luki i widoczne problemy drobnymi poprawkami.

W polu **Week guidance** można wpisać dodatkowe wskazówki, na przykład:

```
make weekdays more nocturnal, keep weekends social
```

Potem kliknij przycisk z nazwą wybranej akcji, na przykład **Rewrite week**. Wynik jest tylko szkicem. Nic nie zapisuje się aż do kliknięcia przycisku **Save schedule**. Jeśli model zwróci niepoprawny JSON, popraw go w **Edit generated schedule JSON** (edytuj wygenerowany harmonogram JSON) i wybierz **Apply to draft** (zastosuj do szkicu). Zatwierdzone poprawki i udane dni pozostają w szkicu do zapisania. Nieudane wywołanie zatrzymuje pracę zamiast ponawiać ją automatycznie. **Stop** lub zamknięcie edytora anuluje aktywne żądanie. Zamknięcie menedżera harmonogramów lub ustawień czatu też anuluje rozpoczęte tam generowanie.

### Bloki dzienne

Pod sekcjami każdy dzień od poniedziałku do niedzieli ma własny wiersz. Dzień bez żadnych ustawień pokazuje napis **No blocks scheduled for this day**.

Każdy blok składa się z trzech części, opisanych jako **Status, time & activity**:

- **Status** wybierany spośród **Online**, **Away**, **Busy** i **Offline**.
- Zakres czasu wpisywany w postaci `09:00-11:30`.
- Krótka notatka o zajęciu, na przykład `at work`.

Przycisk **Add block** dodaje zakres czasu, a ikona kosza usuwa istniejący. Każdy dzień ma też własne pole wskazówek, opisane **Guide Monday**, **Guide Tuesday** i tak dalej. Wpisz tam wskazówkę i kliknij odpowiedni przycisk, na przykład **Regenerate Monday**, żeby napisać od nowa tylko ten jeden dzień.

Status bloku decyduje o tym, co postać zrobi, gdy nadejdzie pora odezwania się. Postać z blokiem **Offline** nigdy nie odzywa się pierwsza w tym czasie. Postać z blokiem **Busy** czeka przed odezwaniem się trzy razy dłużej niż zwykle.

Na koniec kliknij przycisk **Save schedule**. Przycisk **Cancel** zamyka edytor bez zapisywania.

### Przenoszenie harmonogramu między postaciami i instalacjami

Przycisk **Export schedule** (eksport harmonogramu) na dole edytora pobiera bieżący szkic jako plik JSON. W eksporcie znajdują się bloki tygodniowe, podsumowanie rutyny, gadatliwość, pory odezwania się oraz zaawansowane ustawienia czasu.

Otwórz edytor harmonogramu innej postaci i wybierz **Import schedule** (import harmonogramu), żeby wczytać ten plik. Marinara sprawdza plik, zanim podmieni szkic w edytorze, i przenosi zaimportowaną rutynę na bieżący tydzień. Import nie zapisuje się sam: kliknij przycisk **Save schedule**, żeby go zachować, albo przycisk **Cancel**, żeby zostawić dotychczasowy harmonogram postaci bez zmian.

### Schedule generation preferences

W panelu **Chat Settings** pole **Schedule generation preferences** przyjmuje dowolny tekst ze wskazówkami, jak mają powstawać rutyny. To ustawienie globalne. Obejmuje każdy czat w trybie Conversation przy następnym generowaniu harmonogramów, ręcznym albo automatycznym. Na przykład:

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Ustawianie jednorazowego statusu komendą /status

Komenda **/status** ustawia albo czyści tymczasowy status postaci, nie ruszając jej zapisanego harmonogramu. Działa wyłącznie w trybie Conversation.

Postać komendy wygląda tak:

```
/status <online|idle|dnd|offline|clear> [character name]
```

Wpisz `idle` dla statusu **Away** i `dnd` dla statusu **Busy**. To te same cztery statusy, których używają bloki harmonogramu. Żeby postać o imieniu Mira wyglądała teraz na zajętą:

```
/status dnd Mira
```

Żeby usunąć to nadpisanie i przywrócić Mirę do harmonogramu:

```
/status clear Mira
```

Jeśli w czacie jest tylko jedna postać, nazwę można pominąć. Komenda **/status** bez żadnych opcji pokazuje listę postaci i pomoc do użycia.

## Jak rozkładane są wiadomości autonomiczne

Marinara rozkłada wiadomości autonomiczne w czasie, żeby żadna postać nie zasypywała cię wiadomościami. Poniższe zasady korzystają z harmonogramu każdej postaci.

- Postać czeka, aż cisza z twojej strony potrwa tyle, ile mówi ustawienie **Wait before checking in**. Domyślnie to 120 minut.
- Postać, której bieżący status to **Offline**, nie odzywa się pierwsza.
- Postać, której bieżący status to **Busy**, czeka trzy razy dłużej.
- Po pierwszej wiadomości postać może wysłać jeszcze najwyżej dwie, dopóki cisza trwa. Razem daje to trzy wiadomości na jeden okres ciszy.
- Każda kolejna wiadomość czeka dłużej niż poprzednia. Pierwsza dodatkowa czeka dwa razy dłużej niż czas bazowy, a druga cztery razy dłużej.
- Po twojej odpowiedzi licznik zeruje się. Kolejna cisza liczy się od nowa.

Jeśli kilka postaci jest gotowych naraz, pierwszeństwo ma ta o najwyższej gadatliwości i najlepszym momencie.

## Twój status obecności

Twój własny status mówi postaciom, czy jesteś w pobliżu. Sterowanie statusem znajduje się w stopce paska bocznego i jest widoczne w każdym trybie czatu. Na wiadomości wpływa jednak tylko w trybie Conversation.

Kliknij kafelek statusu, żeby zobaczyć cztery opcje:

- **Active**: jesteś online i w zasięgu.
- **Idle**: pokazuje, że cię nie ma przy urządzeniu.
- **Do Not Disturb**: wstrzymuje wszystkie wiadomości autonomiczne.
- **Invisible**: ukrywa twój status przed postaciami.

Status **Idle** włącza się przeważnie sam. Przy statusie **Active** i dziesięciu minutach bez żadnej aktywności Marinara przełącza cię na **Idle**. Po powrocie wraca do statusu **Active**. Status **Idle** można też wybrać ręcznie w panelu podręcznym. Ręczny wybór dowolnego statusu wyłącza automatyczne przełączanie aż do ponownego wybrania **Active**.

Ustaw **Do Not Disturb**, kiedy potrzebujesz ciszy. Przy tym statusie żadna postać nie odezwie się pierwsza. Status **Idle** nie blokuje wiadomości autonomicznych. Postacie mogą się odzywać także podczas twojej nieobecności.

Obok kafelka statusu jest pole **What are you doing?**. Wpisz tam krótki własny opis zajęcia, do 120 znaków. Ostatnio używane wpisy pojawiają się na liście **Recent status**, więc łatwo ich użyć ponownie.

## Powiązane przewodniki

- [Tryb Conversation: pierwsze kroki](getting-started.md)
- [Profile w trybie Conversation Mode (nazwa wyświetlana, About Me, zachowanie)](profiles.md)
- [Panel **Chat Settings** – przegląd](../chats/chat-settings.md)
