# Gdzie Marinara przechowuje dane

Ten przewodnik wyjaśnia, gdzie aplikacja Marinara Engine trzyma twoje dane na twoim własnym komputerze. Znajdziesz tu opis głównego folderu danych, folderu `storage` i folderów zasobów w jego wnętrzu, a także pliku z kluczem szyfrowania, który chroni zapisane klucze API (klucz API to tajny kod, trochę jak hasło).

Aplikacja Marinara Engine (dalej w skrócie "Marinara") działa na twoim własnym komputerze. Zapisane postacie, czaty i ustawienia Marinara trzyma wyłącznie na tym komputerze. Pamiętaj jednak, że przy generowaniu odpowiedzi Marinara wysyła treść czatu do dostawcy AI wskazanego w połączeniu.

## Folder danych (DATA_DIR)

Wszystko, co powstaje w aplikacji Marinara Engine, trafia do jednego folderu na komputerze, który uruchamia serwer. Ten folder nazywamy folderem danych. Zmienna środowiskowa, która na niego wskazuje, nosi nazwę `DATA_DIR`. Zmienna środowiskowa to wartość ustawiana na serwerze, poza aplikacją. Nie znajdziesz jej w panelu **Settings** (Ustawienia) w aplikacji.

Domyślnie folderem danych jest folder o nazwie `data`, który Marinara tworzy obok plików serwera. Przy uruchomieniu w oficjalnym kontenerze Docker folderem danych jest `/app/data` wewnątrz kontenera.

Jeśli nie wiadomo, gdzie leży folder danych, sprawdź log startowy serwera (log to dziennik serwera). Przy starcie Marinara wypisuje linię zaczynającą się od `[storage] DATA_DIR=`, a po niej pełną ścieżkę do folderu danych.

Folder danych da się przenieść w inne miejsce – wystarczy samodzielnie ustawić `DATA_DIR`. Jak to zrobić, opisuje [Konfiguracja serwera](../CONFIGURATION.md). Nowa wartość `DATA_DIR` zaczyna działać dopiero po ponownym uruchomieniu aplikacji Marinara Engine.

## Folder storage i foldery zasobów

Wewnątrz folderu danych dane dzielą się na folder `storage` i kilka folderów zasobów.

W folderze `storage` leżą dane tekstowe: postacie, czaty, wiadomości, lorebooki, presety i połączenia. Marinara zapisuje każdą tabelę w mniejszych plikach pogrupowanych według właściciela — na przykład wiadomości jednego czatu albo wpisy jednego lorebooka — dzięki czemu zmiana pojedynczego elementu nie przepisuje całego, stale rosnącego globalnego pliku JSON. Podczas jednorazowej aktualizacji starszego formatu pamięci Marinara zachowuje pierwotne pliki tabel obok nowych folderów z przyrostkiem `.pre-shard`.

Obrazy, dźwięki i inne pliki multimedialne mają własne foldery, a nazwa każdego z nich mówi, co się w nim znajduje. Najważniejsze foldery zasobów to:

| Folder | Co zawiera |
| --- | --- |
| `avatars` | Awatary postaci i person |
| `sprites` | Sprite'y postaci |
| `backgrounds` | Wgrane tła czatów |
| `gallery` | Obrazy z galerii |
| `fonts` | Dodane własne czcionki |
| `knowledge-sources` | Pliki wgrane na potrzeby agentów wiedzy |
| `game-assets` | Zasoby trybu Game Mode |
| `custom-emojis` | Własne obrazki emoji |
| `custom-stickers` | Własne obrazki naklejek |

Głębsze, techniczne wyjaśnienie działania folderu `storage` programiści znajdą w tekście [Przechowywanie danych w plikach](../development/file-storage.md).

## Plik z kluczem szyfrowania

Marinara szyfruje zapisane klucze API, żeby nie leżały w postaci zwykłego tekstu. Klucz użyty do tego szyfrowania trafia do pliku o nazwie `.encryption-key` w folderze danych.

Ten plik ma znaczenie przy przenoszeniu i przywracaniu danych. Załóżmy, że folder danych trafia na nowy komputer, ale plik `.encryption-key` zostaje w starym miejscu. Marinara nie potrafi już odszyfrować zapisanych kluczy API, więc trzeba wpisać je jeszcze raz. Trzymaj ten plik zawsze razem z resztą danych.

Niektóre zaawansowane konfiguracje podają klucz zmienną środowiskową `ENCRYPTION_KEY` zamiast pliku. Przy tym wariancie zadbaj o bezpieczne przechowanie samej wartości. Nie ma wtedy pliku `.encryption-key` do skopiowania. Szczegóły znajdziesz w dokumencie [Konfiguracja serwera](../CONFIGURATION.md).

## Gdzie znaleźć moje dane w systemie Android

W systemie Android folder danych serwera leży zwykle w pamięci aplikacji, do której nie ma dostępu bez uprawnień roota. Dlatego nie da się po prostu skopiować tego folderu z telefonu.

Kopię danych na urządzeniu z systemem Android pobierzesz przyciskiem **Download Backup** (pobranie kopii zapasowej). Znajdziesz go w panelu **Settings**, na zakładce **Advanced**, w sekcji **Backup & Export**. Powstaje wtedy jeden plik zip z twoimi danymi. Zip zawiera też plik `.encryption-key`, o ile taki istnieje. To najpewniejszy sposób na zapisanie danych z telefonu.

Ta sama sekcja potrafi trzymać od 1 do 9999 rotujących automatycznych archiwów dziennych, tygodniowych lub miesięcznych w folderze `backups/` wewnątrz
folderu danych. Najnowsze archiwum to `marinara-automatic-backup.zip`, a zachowane starsze archiwa automatyczne mają w nazwie datę i godzinę.
Ten limit dotyczy wyłącznie kopii automatycznych. Ważne kopie zapasowe skopiuj też poza pamięć aplikacji, ponieważ
odinstalowanie lub zresetowanie aplikacji może usunąć zarówno bieżące dane, jak i lokalne kopie automatyczne.

Pełne kroki tworzenia i przywracania kopii zapasowej na każdej platformie opisuje [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md).

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Przechowywanie danych w plikach](../development/file-storage.md)
