# Czyszczenie i resetowanie danych

Usuń na stałe wszystkie dane albo ich część za pomocą sekcji **Danger Zone** (strefa zagrożenia). Nie ma cofania. Aby usunąć jeden czat albo jedną postać, użyj ich własnych przycisków usuwania. Zobacz [Zarządzanie listą czatów](../chats/managing-chats.md) i [Tworzenie i edycja postaci](../characters/creating-and-editing-characters.md).

**Zanim zaczniesz:** zrób kopię zapasową. Nie ma kosza ani żadnego odzysku. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md). Jeśli korzystasz z aplikacji Marinara Engine z innego urządzenia, potrzebujesz też sekretu administratora. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md).

## Wyczyść wybrane kategorie

1. Otwórz **Settings → Advanced** (ustawienia, zaawansowane) i przewiń do sekcji **Danger Zone**.
2. Zaznacz każdą kategorię, którą chcesz usunąć. Przycisk **Select All** (zaznacz wszystko) zaznacza wszystkie pola. Gdy zaznaczone są już wszystkie, ten sam przycisk zmienia nazwę na **Clear Selection** (wyczyść zaznaczenie) i odznacza je.
3. Kliknij **Clear Selected Data** (wyczyść zaznaczone dane). Przycisk jest nieaktywny, dopóki nie zaznaczysz kategorii.
4. Przeczytaj ostrzeżenie. Pokazuje, ile kategorii wybrano.
5. Kliknij **Confirm Delete** (potwierdź usunięcie) albo **Cancel** (anuluj), aby przerwać. Nic nie zostanie usunięte, dopóki nie potwierdzisz.

Gdy operacja się uda, pojawia się komunikat, że wybrane dane zostały wyczyszczone. Jeśli żądanie się nie powiedzie, pojawia się komunikat o błędzie ("Failed to clear selected data."). Część danych mogła już zostać wyczyszczona, więc sprawdź, co zostało. Sprawdź też, czy masz dostęp administratora.

## Wyczyść wszystko

1. W sekcji **Danger Zone** kliknij **Clear All Data** (wyczyść wszystkie dane). Nie musisz zaznaczać żadnego pola.
2. Ostrzeżenie pyta: "Delete all supported data categories except Professor Mari? There is no undo."
3. Kliknij **Confirm Delete** albo **Cancel**, aby przerwać.

Efekt jest taki sam, jak po zaznaczeniu wszystkich ośmiu pól.

## Osiem kategorii danych

Każda kategoria usuwa tylko to, co wymienia jej wiersz, z wyjątkiem folderu galerii opisanego pod tabelą.

| Kategoria | Co usuwa |
| --- | --- |
| **Chats & Messages** (czaty i wiadomości) | Wszystkie czaty wraz z zawartością oraz cały folder `gallery` i filmy scen gry. |
| **Characters** (postacie) | Wszystkie postacie i grupy wraz z awatarami, oprócz Professor Mari. |
| **Personas** (persony) | Wszystkie persony i grupy wraz z awatarami. |
| **Lorebooks** (lorebooki) | Wszystkie lorebooki, wpisy i foldery. |
| **Presets** (presety) | Wszystkie presety promptów i foldery presetów, oprócz wbudowanego presetu standardowego. |
| **Connections** (połączenia) | Wszystkie zapisane konta oraz powiązane z nimi wybory modeli i ustawienia głosu. |
| **Automation & Addons** (automatyzacja i dodatki) | Wszystkie ustawienia agentów, własne narzędzia, skrypty regex i zsynchronizowane motywy. Nie dotyczy to Personal Extensions ani External Extensions. |
| **Media & Assets** (multimedia i zasoby) | Pliki teł, awatarów, sprite'ów, galerii, filmów scen, czcionek i źródeł wiedzy. |

Więcej szczegółów:

- **Chats & Messages** usuwa też swipe'y (kilka odpowiedzi zachowanych w jednej wiadomości), wspomnienia, wyniki agentów, stan gry i obrazy czatów.
- **Characters** i **Personas** usuwają też modele awatarów 2D i 3D.
- **Presets** usuwa też ich grupy, sekcje i zmienne. Jeśli domyślny był inny preset, domyślnym staje się preset standardowy.
- **Connections** czyści też ustawienia zamiany tekstu na mowę i mowy na tekst, modele wybrane dla funkcji oraz klucz API Tripo zapisany na stronie **3D Avatars**.
- **Automation & Addons** usuwa też wyniki agentów, pamięć agentów, foldery agentów i widgety agentów na ekranie głównym.
- **Media & Assets** usuwa też listę zasobów i obrazy czatów.
- Pliki źródeł wiedzy to pliki, które wgrano dla agentów wiedzy. Zsynchronizowane motywy to twoje własne motywy zapisane w aplikacji Marinara Engine.

Niektóre kategorie sięgają do plików poza swoją nazwą. **Chats & Messages** usuwa cały folder `gallery`, w tym obrazy z galerii postaci i person, nawet jeśli nie zaznaczono **Characters** ani **Personas**.

Czyszczenie nie rusza innych ustawień, folderu `backups/` ani pliku `.encryption-key`. Zostawia też Personal Extensions, zasoby trybu Game Mode, własne emoji i naklejki, twój dźwięk powiadomień oraz obrazy lorebooków, presetów, agentów i kont, a także pliki pamięci długoterminowej. Zobacz [Gdzie Marinara przechowuje dane](where-data-is-stored.md).

## Professor Mari zostaje

Professor Mari to wbudowana asystentka na ekranie głównym. Sekcja **Danger Zone** nigdy jej nie usuwa, nawet po kliknięciu **Clear All Data**.

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md)
- [Gdzie Marinara przechowuje dane](where-data-is-stored.md)
- [Dostęp zdalny](../REMOTE_ACCESS.md)
