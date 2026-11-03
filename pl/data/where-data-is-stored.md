# Gdzie Marinara przechowuje dane

Dowiedz się, w którym folderze aplikacja Marinara Engine trzyma twoje dane i które jego części musisz zachować, gdy go przenosisz lub kopiujesz.

Aplikacja Marinara Engine działa na twoim własnym komputerze i zapisuje tam postacie, czaty i ustawienia. Gdy generujesz odpowiedź, Marinara nadal wysyła treść czatu do usługi AI wskazanej w połączeniu.

## Znajdź folder danych

Wszystko, co tworzysz, leży w jednym folderze na komputerze, na którym działa serwer. To jest folder danych. Wskazuje na niego ustawienie `DATA_DIR`, czyli wartość, którą podajesz serwerowi przed startem (zmienna środowiskowa). Nie ma jej w panelu **Settings** (ustawienia).

- Domyślnie jest to folder o nazwie `data`, który leży obok plików serwera.
- W oficjalnym kontenerze Docker jest to `/app/data`.
- Aby zobaczyć dokładną ścieżkę, spójrz na okno, w którym uruchomiono aplikację Marinara Engine (terminal lub konsolę). Przy starcie aplikacja wypisuje tam linię zaczynającą się od `[storage] DATA_DIR=`, a po niej ścieżkę. Jeśli nie możesz znaleźć tego okna, poszukaj folderu `data` wewnątrz folderu aplikacji Marinara Engine.

Aby przenieść ten folder, ustaw `DATA_DIR` i uruchom aplikację Marinara Engine ponownie. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

## Co jest w środku

Dane tekstowe leżą w folderze `storage`: postacie, czaty, wiadomości, lorebooki, presety i połączenia. Marinara zapisuje je jako wiele małych plików. Po aktualizacji ze starszego układu w folderze `storage/tables/` mogą pojawić się stare kopie z nazwami kończącymi się na `.pre-shard`. Marinara nigdy ich nie usuwa. Gdy wszystko działa, możesz je usunąć samodzielnie, aby zwolnić miejsce.

Twoje obrazy, dźwięki i inne pliki leżą we własnych folderach obok folderu `storage`. Oto nazwy tych folderów:

| Folder | Co zawiera |
| --- | --- |
| `avatars` | Awatary postaci i person |
| `sprites` | Grafiki sprite'ów postaci |
| `avatar-models` | Pliki agentów **2D Avatars** i **3D Avatars**, na przykład obrazki PNGTuber i modele 3D |
| `backgrounds` | Wgrane tła czatów |
| `gallery` | Obrazy z galerii |
| `fonts` | Dodane własne czcionki |
| `knowledge-sources` | Pliki wgrane dla agentów wiedzy |
| `game-assets` | Zasoby trybu Game Mode |
| `game-scene-videos` | Filmy scen w trybie Game Mode |
| `conversation-call-character-videos` | Filmy postaci do połączeń w trybie Conversation |
| `custom-emojis` | Własne obrazki emoji |
| `custom-stickers` | Własne obrazki naklejek |
| `notification-sounds` | Twój własny dźwięk powiadomień |
| `long-term-memory` | Dane agenta pamięci długoterminowej |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Obrazy dołączone do lorebooków, presetów, agentów i kont |

W folderze danych leżą też folder `backups/` (twoje [automatyczne kopie zapasowe](backup-and-restore.md#automatic-backups)) oraz plik z kluczem szyfrowania. Przycisk **Download Backup** (pobranie kopii zapasowej) obejmuje każdy folder z tabeli, folder `storage` i plik z kluczem. Programiści mogą przeczytać [Przechowywanie danych w plikach](../development/file-storage.md).

## Zachowaj plik z kluczem szyfrowania

Marinara szyfruje zapisane klucze API. Kluczem do tego szyfrowania jest plik `.encryption-key` w folderze danych.

Jeśli skopiujesz dane na nowy komputer bez tego pliku, Marinara nie odczyta zapisanych kluczy API. Musisz wtedy wpisać je ponownie. Kopiuj ten plik razem z resztą folderu danych.

Niektóre konfiguracje podają klucz przez zmienną środowiskową `ENCRYPTION_KEY` zamiast przez plik. Wtedy nie ma pliku do skopiowania. Przechowuj tę wartość bezpiecznie osobno. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

## Skopiuj dane z Androida

W systemie Android folder danych leży w pamięci aplikacji, do której nie masz dostępu bez uprawnień roota, więc nie możesz go skopiować. Użyj **Settings → Advanced → Backup & Export → Download Backup** (ustawienia, zaawansowane, kopia zapasowa i eksport, pobranie kopii zapasowej). Plik `.zip` zawiera plik `.encryption-key`, jeśli on istnieje. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md).

Automatyczne kopie zapasowe trafiają do tej samej pamięci aplikacji. Odinstalowanie lub zresetowanie aplikacji może usunąć je razem z bieżącymi danymi, więc trzymaj kopię w innym miejscu.

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md)
- [Czyszczenie i resetowanie danych](clearing-data.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Przechowywanie danych w plikach](../development/file-storage.md)
