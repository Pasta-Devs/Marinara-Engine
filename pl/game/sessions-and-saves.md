# Game Mode: sesje i zapisy gry

Z tego przewodnika dowiesz się, jak aplikacja Marinara Engine śledzi postępy w trybie Game Mode między kolejnymi sesjami gry. Opisuje kończenie i rozpoczynanie sesji oraz czytanie dawnych sesji w **Session History** (historia sesji). Wyjaśnia też widok **Show Spoilers** (pokazanie spoilerów) i sposób, w jaki gra zapisuje dane.

## Czym jest sesja

Game Mode dzieli przygodę na ponumerowane sesje. Sesja to jeden ciągły okres gry, jak pojedynczy wieczór przy stole. Narrację każdej sesji prowadzi Game Master (GM, mistrz gry – AI, która kieruje rozgrywką). Po zakończeniu sesji GM pisze podsumowanie, do którego można wrócić później.

Pierwsza sesja to **Session 1**. Zakończenie jej i rozpoczęcie kolejnej tworzy **Session 2**, i tak dalej.

<a id="opening-session"></a>

## Otwieranie Session

W **Session** (sesja) kończy się sesje, zaczyna nowe i czyta historię.

1. Rozpocznij lub otwórz czat w trybie Game Mode, żeby pokazała się plansza gry.
2. Kliknij lub dotknij przycisk **Session** (ikona pióra). Domyślnie znajduje się blisko prawego górnego rogu czatu. Możesz przeciągnąć go w inne miejsce (zobacz [Okna kontrolek i ich przyciski](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** otwiera się w oknie na komputerze lub panelu na całą szerokość ekranu na telefonie. Pierwszy wiersz pokazuje **Session** wraz z numerem bieżącej sesji i jej statusem.
4. Do wyboru są dwie zakładki: **Session History** i **Journal** (dziennik). Do sterowania sesjami i udostępniania konfiguracji zostań w zakładce **Session History**.

Jeśli okno zostało przeniesione przyciskiem **Put back in Chat Settings**, otwórz zamiast niego sekcję **Session** w Chat Settings.

## Udostępnianie konfiguracji, z której powstała gra

Game Mode przechowuje niezmienną migawkę konfiguracji użytej przy tworzeniu każdej nowej kampanii. Dzięki temu można najpierw pograć, ocenić, że dane zestawienie sprawdza się w praktyce, i dopiero potem je udostępnić, bez ręcznego spisywania każdego pola przed startem.

1. Otwórz kampanię Game Mode, którą chcesz udostępnić.
2. Otwórz **Session** (przycisk z ikoną pióra).
3. Zostań w zakładce **Session History**, a potem rozwiń sekcję **Initial Game Setup** (początkowa konfiguracja gry).
4. Przejrzyj zapisaną przygodę, obsadę, model, prompt (tekst, który Marinara wysyła do AI), obowiązujące parametry generowania oraz ustawienia wizualne, ustawienia storyboardu i narzędzi świata.
5. Kliknij przycisk **Copy setup**, aby skopiować tekst do schowka, albo przycisk **Download .txt**, aby zapisać plik tekstowy do udostępnienia.

Skopiowany tekst zawiera długie preferencje gracza i własne instrukcje dla GM. Przeczytaj go przed publikacją, jeśli w tych polach są prywatne treści. Dane logowania do połączeń, adresy serwerów, klucze API (tajne kody, trochę jak hasła) ani lokalne identyfikatory bazy danych nigdy się w nim nie znajdują. Karty postaci, persony, lorebooki, modele i konta u dostawców są wymienione z nazwy dla orientacji, ale nie są dołączane, więc druga osoba musi mieć albo wybrać własne lokalne odpowiedniki.

Kampanie utworzone przed wprowadzeniem migawek konfiguracji nie odzyskają preferencji, których nigdy nie zapisano. Dlatego sekcja **Initial Game Setup** pojawia się tylko wtedy, gdy dostępna jest wiarygodna migawka z chwili utworzenia.

## Kończenie sesji

Zakończ sesję, kiedy chcesz zamknąć bieżący rozdział i pozwolić GM go podsumować.

1. Otwórz **Session** i zostań w zakładce **Session History**.
2. Na górze widać bieżącą sesję, opisaną jako **Session N (Current)**.
3. W tym wierszu kliknij przycisk **End Session** (zakończenie sesji) – małą kwadratową ikonę obok przycisku **Show Spoilers**.
4. Otwiera się okno o tytule **End Session** z prośbą o potwierdzenie.
5. Jeśli chcesz, wpisz coś w pole **What do you want to happen in the next session (optional)?**. Zmieści się w nim do 5000 znaków.
6. Zostaw to pole puste, żeby GM poprowadził historię po swojemu.
7. Kliknij przycisk **End Session** w oknie, aby potwierdzić, albo przycisk **Cancel**, aby się wycofać.

Po potwierdzeniu silnik generuje podsumowanie. Zaczekaj na tym ekranie, aż praca się skończy. W trakcie tytuł okna brzmi **Ending Session**. Na koniec sesja zostaje oznaczona jako zamknięta i pojawia się w historii.

## Rozpoczynanie nowej sesji

Kiedy bieżąca sesja jest już zamknięta, ten sam przycisk zmienia się w **New Session** (nowa sesja).

1. Otwórz **Session** i przejdź do zakładki **Session History**.
2. W wierszu bieżącej sesji kliknij przycisk **New Session** (ikona odtwarzania).
3. GM wznawia opowieść. Korzysta z podsumowania poprzedniej sesji oraz z notatki o kolejnej sesji, jeśli została wpisana przy jej kończeniu.

## Czytanie dawnych sesji

Zakładka **Session History** wymienia zamknięte sesje, od najnowszej. Zanim któraś się skończy, widnieje tam napis **No completed sessions yet**.

W każdym wierszu widać numer sesji, datę i liczbę zapisanych odkryć. Kliknij wiersz, żeby go rozwinąć. Rozwinięta sesja może pokazywać takie pola:

- **Summary**: co wydarzyło się w trakcie sesji.
- **Resume Point**: od czego ma zacząć kolejna sesja.
- **Party Dynamics**: jak układały się relacje między członkami drużyny.
- **Key Discoveries**: ważne fakty, zwroty akcji i odkrycia.
- **Character Moments**: wyjątkowe momenty postaci.
- **Little Details To Recall**: drobne nawyki, obietnice i szczegóły.
- **NPC Updates**: zmiany dotyczące postaci NPC (postaci niezależnych, którymi kieruje GM).
- **Next Session Request**: notatka zostawiona przy kończeniu sesji.
- **Stats Snapshot** i **Party Status**: zapisane liczby oraz stan drużyny.

### Odtwarzanie zakończonej sesji

Zakończone sesje można odtworzyć bez żadnego wpływu na kampanię.

1. Rozwiń zamkniętą sesję w zakładce **Session History**.
2. Kliknij przycisk **Replay Session** (odtworzenie sesji).
3. Przyciskami **Next** i **Next turn** przeklikaj oryginalną narrację i dialogi.
4. Kiedy odtwarzanie dochodzi do wyboru, aktywna jest tylko ta opcja, którą wybrano w pierwotnej sesji. Kliknij ją, żeby iść dalej zapisaną ścieżką.
5. Na koniec kliknij przycisk zamykania na górze odtwarzania albo przycisk **Return to current session**.

Odtwarzanie tylko pokazuje zapis. Nie odpytuje GM, nie tworzy wiadomości, nie zmienia ekwipunku ani statystyk, nie aktualizuje dziennika i nie przywraca punktu kontrolnego. Sesje utworzone przed wprowadzeniem odtwarzania nadal korzystają z zapisanego tekstu, efektów w treści, wyborów i dostępnych zasobów. W starszej turze może zabraknąć efektu scenicznego, którego nie zapisano w chwili, gdy ta tura była rozgrywana.

### Edytowanie dawnej sesji

Notatki zamkniętej sesji da się poprawić ręcznie, żeby kolejne sesje pamiętały je właściwie.

1. Rozwiń sesję, którą chcesz zmienić.
2. Kliknij przycisk **Edit Details** (edycja szczegółów).
3. Zmień dowolne pole, a potem kliknij przycisk **Save Details**. Kliknij przycisk **Cancel**, żeby odrzucić zmiany.

Na rozwiniętej sesji są jeszcze dwa przyciski:

- **Regenerate**: uruchamia ponownie generowanie zakończenia tej sesji przez AI. Nadpisuje podsumowanie i wszystkie pozostałe pola wpisu. Zmiany wprowadzone przyciskiem **Edit Details** przepadają.
- **Update Plot Arcs**: prosi AI o zaktualizowanie ukrytych planów fabularnych GM na podstawie wydarzeń tej sesji. Te plany to **Story Arc**, **Plot Twists** i **Party Arcs** widoczne w widoku **Show Spoilers**.

Przycisk **Regenerate Lorebook** pojawia się tylko przy ostatniej zamkniętej sesji i tylko wtedy, gdy włączona jest opcjonalna funkcja Lorebook Keeper. Lorebook to zbiór faktów o twoim świecie, które AI może przywołać.

## Widok Show Spoilers

**Show Spoilers** odsłania ukryte notatki GM dotyczące bieżącej sesji. W trakcie gry są one normalnie trzymane w tajemnicy. Ich lektura może zepsuć niespodzianki fabularne.

1. Otwórz **Session** i przejdź do zakładki **Session History**.
2. W wierszu bieżącej sesji kliknij przycisk **Show Spoilers** (ikona oka).
3. Pojawia się prywatny stan GM.

Widok spoilerów może pokazywać takie sekcje:

- **World Overview**: ogólny obraz świata gry.
- **Story Arc**: zaplanowany kierunek opowieści.
- **Plot Twists**: niespodzianki, które GM trzyma w zanadrzu.
- **Party Arcs**: zaplanowane wątki członków drużyny.
- **Maps**, **NPCs** i **Character Cards**: zapisane dane gry.

Żeby znowu ukryć notatki, kliknij ten sam przycisk. Teraz widnieje na nim napis **Hide Spoilers**.

Te sekrety da się też edytować, co działa jak panel oszustw mistrza gry. Kliknij przycisk **Edit Spoilers**, zmień tekst, a potem kliknij przycisk **Save Spoilers**. Część pól ma postać JSON, czyli ustrukturyzowanego formatu tekstowego. Edytuj pola JSON tylko wtedy, gdy ten format jest ci znany, bo błędny JSON się nie zapisze.

## Jak gra zapisuje postępy

Game Mode zapisuje postępy automatycznie. Nie trzeba naciskać żadnego przycisku zapisu. Świat, drużyna, mapa, ekwipunek, czas w grze i podsumowania sesji są przechowywane na bieżąco, w trakcie gry.

Aplikacja odnotowuje też w tle automatyczne punkty kontrolne. Zapisuje punkt kontrolny na początku sesji, na jej końcu oraz w chwili rozpoczęcia i zakończenia walki. Na razie nie ma w aplikacji ekranu do przeglądania ani przywracania tych punktów kontrolnych. Nie licz więc na to, że wczytanie starego punktu kontrolnego cofnie turę.

Aby mieć własną kopię danych, skorzystaj z narzędzi do tworzenia kopii zapasowych w aplikacji. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md).

## Powiązane przewodniki

- [Game Mode: pierwsze kroki](getting-started.md)
- [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md)
