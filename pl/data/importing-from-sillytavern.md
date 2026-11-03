# Importowanie z SillyTavern

Przenieś dane z aplikacji SillyTavern do aplikacji Marinara Engine. Możesz zaimportować jeden plik naraz albo przeskanować cały folder SillyTavern i zaimportować wszystko od razu.

## Co można przenieść

| Dane z SillyTavern | W aplikacji Marinara Engine |
| --- | --- |
| Postacie | Postacie |
| Czaty i czaty grupowe | Czaty |
| Presety | Presety (zapisany zestaw ustawień generowania) |
| World Info | Lorebooki (notatki, które AI czyta, gdy w czacie padną określone słowa) |
| Tła | Tła czatu |
| Persony | Persony (profil, który występuje w twoim imieniu) |

## Szybki import pojedynczych plików

1. Otwórz **Settings → Imports** (ustawienia, import).
2. W sekcji **SillyTavern Import** kliknij przycisk dla swojego typu pliku.
3. Wybierz plik.

| Przycisk | Plik |
| --- | --- |
| **Import Character (JSON/PNG)** (import postaci) | Karta postaci w pliku `.json` lub `.png`. |
| **Import Chat (JSONL)** (import czatu) | Dziennik czatu w pliku `.jsonl` (jeden rekord JSON w każdym wierszu, czyli format, w którym SillyTavern zapisuje czaty). |
| **Import Preset (JSON)** (import presetu) | Preset w pliku `.json`. |
| **Import Lorebook (JSON)** (import lorebooka) | Plik World Info w formacie `.json`. |

Te przyciski nie mają opcji. Import postaci zachowuje wszystkie tagi ze źródła i ogranicza skrypty regex do tej jednej postaci. Skrypt regex to reguła znajdź-i-zamień dla tekstu. Aby wybrać te opcje samodzielnie, użyj przycisku **Import** w panelu **Characters** (postacie). Zobacz [Importowanie i eksportowanie kart postaci](../characters/import-export.md).

Jeśli karta postaci zawiera w środku lorebook, przeglądarka pyta, czy zaimportować go jako osobny lorebook. Kliknij **OK**, aby zachować go jako lorebook do ponownego użycia, albo **Cancel** (anuluj), aby zaimportować tylko postać.

Przycisk **Import Chat (JSONL)** tworzy czat w trybie Roleplay, chyba że plik zapisuje inny tryb, i od razu go otwiera.

### Import czatu do wybranego trybu

Aby wybrać tryb, użyj przycisku importu na górze listy czatów. Jego podpowiedź brzmi **Import SillyTavern or Marinara chat JSONL**. Przycisk importuje do trybu z aktualnie otwartej zakładki (Conversation, Roleplay lub Game). Zobacz [Eksport i import czatów](../chats/export-import.md).

## Import folderu SillyTavern

Zanim zaczniesz: kreator czyta pliki na komputerze serwera. Jeśli SillyTavern jest na innym komputerze, najpierw skopiuj jego folder (ten, w którym zainstalowano SillyTavern) na komputer, na którym działa aplikacja Marinara Engine. Na tym komputerze kreator działa od razu. Aby użyć go z innego urządzenia, ustaw sekret administratora i wpisz go w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administratora). Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md) oraz sekcję "Privileged APIs (ADMIN_SECRET)" w [Dokumentacji konfiguracji serwera](../CONFIGURATION.md).

1. Otwórz **Settings → Imports → SillyTavern Import**.
2. Kliknij **Import from SillyTavern Folder** (import z folderu SillyTavern).
3. Wskaż folder SillyTavern. Wybierz folder główny, zwykle ten, który zawiera folder `data/` lub `public/`. Masz do wyboru jeden z tych sposobów:
   - Kliknij **Browse** (przeglądaj) i wskaż folder.
   - Jeśli nie ma okna wyboru folderu (zdalny serwer), otwiera się wbudowana przeglądarka folderów. Pokazuje tylko foldery w folderze domowym użytkownika, który uruchamia serwer. Kliknij **Select This Folder**.
   - Wpisz ścieżkę w polu **SillyTavern Folder Path**, na przykład `/path/to/SillyTavern`. Wpisana ścieżka działa tylko wtedy, gdy ustawienie serwera `IMPORT_ALLOWED_ROOTS` zawiera folder, w którym ona leży.
4. Kliknij **Scan Folder** (skanuj folder). Aplikacja pokazuje, ile elementów znalazła w każdej kategorii.
5. W oknie **Choose exactly what to import** zaznacz elementy, które chcesz zaimportować. Przy każdej kategorii są przyciski **All** i **None** oraz przełącznik **Show** lub **Hide**, który pokazuje lub ukrywa pojedyncze elementy.
6. Kliknij **Import Selected** (importuj zaznaczone). Pasek postępu pokazuje bieżący element i liczbę dla każdej kategorii.
7. Gdy pojawi się komunikat **Import complete!**, przeczytaj liczbę elementów w każdej kategorii i kliknij **Done**.

Większość elementów jest na początku zaznaczona. Aplikacja zostawia niezaznaczone standardowe presety SillyTavern, takie jak `deterministic`, `neutral` i presety `universal-*`, a baner o tym informuje. Zostaw je niezaznaczone, chyba że naprawdę potrzebujesz ich kopii.

Jeśli skanowanie znajdzie postacie, pojawiają się dwie dodatkowe opcje:

**Imported character tags** (domyślnie **All tags**):

- **All tags** zachowuje tagi ze źródła.
- **No tags** pomija je.
- **Existing only** zachowuje tylko tagi, które już masz.

**Imported regex scripts** (domyślnie **Character only**):

- **Character only** stosuje skrypty do każdej postaci osobno.
- **Global** dodaje je do **Presets → Regexes** (presety, regexy) dla każdego czatu.

Jeśli to nie zadziałało:

- Komunikat "Could not find SillyTavern data directory." oznacza, że aplikacja nie może odczytać tego folderu. Wybierz główny folder SillyTavern.
- Komunikat "folderPath is not allowed" oznacza, że serwer odrzucił tę ścieżkę. Kliknij **Browse** i wskaż folder w ten sposób. Właściciel serwera może ograniczyć, które foldery wolno importować, za pomocą ustawienia `IMPORT_ALLOWED_ROOTS`. Jeśli jest ustawione, nawet wskazany folder musi leżeć w jednym z tych folderów. Zapytaj osobę, która obsługuje serwer, albo zobacz [Dokumentację konfiguracji serwera](../CONFIGURATION.md).
- Jeśli jeden element się nie powiedzie, aplikacja pomija go, pracuje dalej i wypisuje go w ostrzeżeniach na ostatnim kroku, na przykład `Character "Foo": error message`.

## Co dzieje się z twoimi danymi

- Pliki czatów należące do jednej postaci trafiają do jednego czatu jako jego gałęzie. Gałąź to kopia czatu, którą kontynuujesz osobno.
- Czaty grupowe importują się jako czaty w trybie Roleplay.
- Zaimportowane elementy zachowują datę ostatniej zmiany pliku źródłowego, a nie datę importu.

## Czego nie da się przenieść

Kreator czyta tylko kategorie z pierwszej tabeli. Pozostałych danych z aplikacji SillyTavern, takich jak globalne ustawienia aplikacji i szybkie odpowiedzi, nie importuje.

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](../characters/import-export.md)
- [Importowanie i eksportowanie lorebooków](../lorebooks/import-export.md)
- [Eksport i import czatów](../chats/export-import.md)
- [Skrypty regex](../extending/regex-scripts.md)
