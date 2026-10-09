# Czyszczenie i resetowanie danych

Z tego przewodnika dowiesz się, jak trwale usunąć dane w aplikacji Marinara Engine za pomocą sekcji **Danger Zone** (strefa zagrożenia). Da się wyczyścić kilka wybranych kategorii albo skasować wszystko. Nie ma cofania, więc najpierw przeczytaj ostrzeżenia.

## Gdzie znaleźć sekcję Danger Zone

Wszystkie narzędzia do czyszczenia danych są w jednym miejscu.

1. Otwórz panel **Settings** (Ustawienia).
2. Przejdź do zakładki **Advanced**.
3. Przewiń na sam dół, do sekcji **Danger Zone**.

Opis sekcji **Danger Zone** brzmi: "Permanently clear selected categories of local data. Professor Mari is always preserved."

Jeśli korzystasz z aplikacji Marinara na innym urządzeniu niż komputer z uruchomionym programem, do czyszczenia danych potrzebny jest dostęp administratora. Konfigurację opisuje przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md).

## Zrób kopię zapasową przed czyszczeniem

Czyszczenia danych nie da się cofnąć. Nie ma tu kosza ani żadnego odzysku. Po potwierdzeniu dane znikają na dobre.

Najpierw utwórz kopię zapasową, żeby móc przywrócić dane po zmianie zdania. Szczegóły opisuje przewodnik [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md).

## Osiem kategorii danych

Sekcja **Danger Zone** pokazuje listę ośmiu kategorii z polami wyboru. Każda z nich to osobny zakres. Zaznaczenie jednej kategorii nie rusza pozostałych.

| Kategoria | Co czyści |
|---|---|
| **Chats & Messages** (czaty i wiadomości) | Czaty, foldery, wiadomości, dane scen i wypowiedzi OOC oraz bieżący stan czatu. |
| **Characters** (postacie) | Postacie i grupy postaci. Professor Mari zostaje nienaruszona. |
| **Personas** (persony) | Persony i grupy person. |
| **Lorebooks** (lorebooki) | Lorebooki i ich wpisy. |
| **Presets** (presety) | Presety promptów, grupy, sekcje i zmienne. |
| **Connections** (połączenia) | Połączenia API i adresy modeli. |
| **Automation & Addons** (automatyzacja i dodatki) | Agenci, narzędzia, skrypty regex, zsynchronizowane motywy i stan automatyzacji. |
| **Media & Assets** (multimedia i zasoby) | Tła, awatary, sprite'y, elementy galerii, czcionki i pliki źródeł wiedzy. |

Kilka kategorii usuwa więcej niż same rekordy z bazy danych. **Chats & Messages** kasuje też cały folder galerii na dysku razem ze wszystkimi plikami wideo scen. Dotyczy to również obrazów z galerii postaci i person, nawet bez zaznaczenia kategorii **Characters** i **Personas**. **Media & Assets** usuwa z dysku foldery teł, awatarów, sprite'ów, galerii, plików wideo scen, czcionek i plików źródeł wiedzy. **Connections** czyści dodatkowo zapisane ustawienia syntezy mowy (TTS) i Speech to Text (zamiana mowy na tekst), bo są one powiązane z połączeniem.

## Czyszczenie wybranych kategorii

Skorzystaj z tego, gdy chcesz usunąć część danych, a resztę zachować.

1. Zaznacz pole wyboru przy każdej kategorii do usunięcia.
2. Wszystkie pola naraz przełącza przycisk **Select All** (zaznacz wszystko). Gdy zaznaczone są już wszystkie, ten sam przycisk zmienia się w **Clear Selection** i pozwala odznaczyć je wszystkie.
3. Kliknij przycisk **Clear Selected Data**. Pozostaje on nieaktywny, dopóki nie zaznaczysz przynajmniej jednej kategorii.
4. Pojawia się ramka z ostrzeżeniem. Podaje ona liczbę wybranych kategorii i przypomina, że nie ma cofania.
5. Kliknij przycisk **Cancel**, żeby przerwać, albo **Confirm Delete**, żeby usunąć. Nic nie znika, dopóki nie klikniesz przycisku **Confirm Delete**.

Po udanym czyszczeniu pojawia się komunikat potwierdzający. Informuje on, że wybrane dane zostały wyczyszczone, a bieżące dane tymczasowe od razu zresetowane.

## Czyszczenie wszystkiego

Skorzystaj z tego, żeby jednym krokiem skasować wszystkie osiem kategorii.

1. Kliknij przycisk **Clear All Data**. Nie trzeba wcześniej zaznaczać żadnych pól.
2. Ramka z ostrzeżeniem pyta: "Delete all supported data categories except Professor Mari? There is no undo."
3. Kliknij przycisk **Cancel**, żeby przerwać, albo **Confirm Delete**, żeby usunąć wszystko.

Efekt jest taki sam jak przy zaznaczeniu każdego pola i wyczyszczeniu ich razem.

## Professor Mari zostaje zawsze

Professor Mari to wbudowana postać pomocnika. Ta funkcja nigdy jej nie usuwa. Nawet po wyczyszczeniu kategorii **Characters** albo użyciu przycisku **Clear All Data** Professor Mari zostaje na miejscu. Sekcja **Danger Zone** nie pozwala jej skasować.

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md)
- [Dostęp zdalny](../REMOTE_ACCESS.md)
