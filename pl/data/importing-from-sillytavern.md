# Importowanie z SillyTavern

Przenieś dane z aplikacji SillyTavern do aplikacji Marinara Engine. Możesz zaimportować jeden plik naraz albo przeskanować cały folder SillyTavern i zaimportować wszystko od razu.

## Co można przenieść

| Dane z SillyTavern | W aplikacji Marinara Engine |
| --- | --- |
| Postacie | Postacie |
| Czaty i czaty grupowe | Czaty |
| Presety | Presety (sekcje promptu i ustawienia samplerów presetu) |
| World Info | Lorebooki (notatki, które AI czyta, gdy w czacie padną określone słowa) |
| Tła | Tła czatu |
| Persony | Persony (profil, który występuje w twoim imieniu) |
| Skrypty regex | Skrypty regex: własne skrypty każdej karty i globalne z pliku `settings.json` (import folderu) |

## Szybki import pojedynczych plików

1. Otwórz **Settings → Imports** (ustawienia, import).
2. W sekcji **SillyTavern Import** kliknij przycisk dla swojego typu pliku.
3. Wybierz plik. Przyciski **Importuj postać**, **Importuj preset** i **Importuj lorebook** otwierają to samo okno co przycisk **Importuj** w ich własnym panelu, z tymi samymi opcjami i tym samym raportem o tym, co przeniesiono, a czego nie.

| Przycisk | Plik |
| --- | --- |
| **Import Character (JSON/PNG)** (import postaci) | Karta postaci w pliku `.json` lub `.png`. |
| **Import Chat (JSONL)** (import czatu) | Dziennik czatu w pliku `.jsonl` (jeden rekord JSON w każdym wierszu, czyli format, w którym SillyTavern zapisuje czaty). |
| **Import Preset (JSON)** (import presetu) | Preset w pliku `.json`. |
| **Import Lorebook (JSON)** (import lorebooka) | Plik World Info w formacie `.json`. |

Skrypt regex to reguła znajdź-i-zamień dla tekstu. Zobacz [Importowanie i eksportowanie kart postaci](../characters/import-export.md).

Jeśli karta postaci zawiera lorebook, okno Importuj postać pyta, co z nim zrobić: **Importuj lorebook** zachowuje go jako lorebook do ponownego użycia, a **Bez importu** importuje tylko postać.

Przycisk **Importuj czat (JSONL)** tworzy czat w trybie Roleplay, chyba że plik zapisuje inny tryb, i od razu go otwiera. Krótki komunikat podaje, co przeniesiono: notatkę autora, personę i wiadomości, które pozostają ukryte przed AI.

### Import czatu z listy czatów

Możesz też użyć przycisku importu na górze listy czatów. Jego podpowiedź brzmi **Importuj czat SillyTavern lub Marinara w formacie JSONL**. Działa tak samo: czat otwiera się w trybie zapisanym w pliku albo w trybie Roleplay, jeśli plik nie podaje trybu. Zobacz [Eksport i import czatów](../chats/export-import.md).

## Import folderu SillyTavern

Zanim zaczniesz: kreator czyta pliki na komputerze serwera. Jeśli SillyTavern jest na innym komputerze, najpierw skopiuj jego folder (ten, w którym zainstalowano SillyTavern) na komputer, na którym działa aplikacja Marinara Engine. Na tym komputerze kreator działa od razu. Aby użyć go z innego urządzenia, ustaw sekret administratora i wpisz go w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administratora). Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](backup-and-restore.md) oraz sekcję "Privileged APIs (ADMIN_SECRET)" w [Dokumentacji konfiguracji serwera](../CONFIGURATION.md).

1. Otwórz **Settings → Imports → SillyTavern Import**.
2. Kliknij **Import from SillyTavern Folder** (import z folderu SillyTavern).
3. Wskaż folder SillyTavern. Wybierz folder główny, zwykle ten, który zawiera folder `data/` lub `public/`. Masz do wyboru jeden z tych sposobów:
   - Kliknij **Browse** (przeglądaj) i wskaż folder.
   - Jeśli nie ma okna wyboru folderu (zdalny serwer), otwiera się wbudowana przeglądarka folderów. Pokazuje tylko foldery w folderze domowym użytkownika, który uruchamia serwer. Kliknij **Select This Folder**.
   - Wpisz ścieżkę w polu **Ścieżka folderu SillyTavern**, na przykład `/home/you/SillyTavern`. Wpisana ścieżka działa, jeśli znajduje się wewnątrz folderu domowego użytkownika, który uruchamia serwer. Jeśli na serwerze ustawiono `IMPORT_ALLOWED_ROOTS`, musi zamiast tego znajdować się wewnątrz jednego z wymienionych tam folderów.
4. Kliknij **Scan Folder** (skanuj folder). Aplikacja pokazuje, ile elementów znalazła w każdej kategorii.
5. W oknie **Choose exactly what to import** zaznacz elementy, które chcesz zaimportować. Przy każdej kategorii są przyciski **All** i **None** oraz przełącznik **Show** lub **Hide**, który pokazuje lub ukrywa pojedyncze elementy.
6. Kliknij **Import Selected** (importuj zaznaczone). Pasek postępu pokazuje bieżący element i liczbę dla każdej kategorii.
7. Gdy zobaczysz **Import zakończony!**, sprawdź liczbę elementów w każdej kategorii i kliknij **Gotowe**. Pod licznikami krótka lista podaje, ile czatów zachowało notatkę autora i personę, które nazwy użytkowników z aplikacji SillyTavern nie miały tutaj persony, jak presety rozmieszczają World Info i które ustawienia presetów pominięto.

Opcja **Pomiń to, co już tu jest** (domyślnie włączona) pomija postacie, czaty i persony, które już masz, niezależnie od tego, czy pochodzą z wcześniejszego importu folderu, czy z importu pojedynczych plików. Persona z aplikacji SillyTavern o tej samej nazwie co jedna z twoich nie jest kopiowana: jej czaty zostają powiązane z twoją personą. Czaty importowane pojedynczo przed tą zmianą nie są rozpoznawane i zostaną zaimportowane ponownie.

Większość elementów jest na początku zaznaczona. Aplikacja zostawia niezaznaczone standardowe presety SillyTavern, takie jak `deterministic`, `neutral` i presety `universal-*`, a baner o tym informuje. Zostaw je niezaznaczone, chyba że naprawdę potrzebujesz ich kopii.

Jeśli skanowanie znajdzie postacie, pojawiają się dwie dodatkowe opcje:

**Imported character tags** (domyślnie **All tags**):

- **All tags** zachowuje tagi ze źródła.
- **No tags** pomija je.
- **Existing only** zachowuje tylko tagi, które już masz.

**Imported regex scripts** (domyślnie **Character only**):

- **Character only** stosuje skrypty do każdej postaci osobno.
- **Global** dodaje je do **Presets → Regexes** (presety, regexy), gdzie możesz zarządzać skryptami działającymi w różnych czatach. Zobacz [Skrypty regex](../extending/regex-scripts.md#manage-your-scripts).

Jeśli to nie zadziałało:

- Komunikat "Could not find SillyTavern data directory." oznacza, że aplikacja nie może odczytać tego folderu. Wybierz główny folder SillyTavern.
- "Marinara can only read folders inside your home folder" oznacza, że folder znajduje się poza folderem domowym użytkownika, który uruchamia serwer. Przenieś do niego folder SillyTavern albo poproś osobę prowadzącą serwer o dopuszczenie jego lokalizacji przez ustawienie `IMPORT_ALLOWED_ROOTS`. Jeśli to ustawienie jest ustawione, nawet folder wybrany w oknie musi znajdować się wewnątrz jednego z wymienionych folderów. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).
- Jeśli do **Przeglądaj** trafi wpisana ścieżka spoza folderu domowego, przeglądarka folderów otworzy się zamiast tego w folderze domowym.
- Jeśli jeden element się nie powiedzie, aplikacja pomija go, pracuje dalej i wypisuje go w ostrzeżeniach na ostatnim kroku, na przykład `Character "Foo": error message`.

## Co dzieje się z twoimi danymi

- Pliki czatów należące do jednej postaci trafiają do jednego czatu jako jego gałęzie. Gałąź to kopia czatu, którą kontynuujesz osobno. Każdy czat otrzymuje nazwę swojego pliku z aplikacji SillyTavern, tak jak przy imporcie pojedynczego pliku. Plik nadal nazwany "New Chat" otrzymuje imię postaci.
- Czaty grupowe importują się jako czaty w trybie Roleplay z ustawieniem **Indywidualnie**, więc każda postać odpowiada po kolei, w kolejności wypowiedzi z aplikacji SillyTavern.
- Wiadomości ukryte przed AI w aplikacji SillyTavern pozostają ukryte.
- Importowane elementy zachowują datę ostatniej zmiany pliku źródłowego, a nie datę importu. Każda wiadomość czatu zachowuje datę, z którą zapisała ją aplikacja SillyTavern.
- **Notatka autora** czatu przenosi się razem ze swoją głębokością. Jeśli w aplikacji SillyTavern miała inną częstotliwość, pozycję lub rolę, Marinara i tak dodaje ją przy każdej odpowiedzi na tej głębokości, a import o tym informuje. Notatka wyłączona w aplikacji SillyTavern pozostaje wyłączona.
- Czat zostaje powiązany z personą używaną w aplikacji SillyTavern: personą przypisaną na stałe do czatu, a jeśli takiej nie było, personą o tej samej nazwie co użytkownik czatu. Zaimportuj persony w tym samym przebiegu albo wcześniej utwórz personę o tej nazwie. Gdy nie ma dopasowania, czat nie ma persony, a import podaje nazwę brakującej persony.
- Preset zachowuje dwa miejsca na World Info z aplikacji SillyTavern. **World Info (przed)** i **World Info (po)** stają się osobnymi sekcjami, więc wpisy ustawione po postaci nadal trafiają za nią. Preset z wyłączoną jedną z tych sekcji pomija jej wpisy, tak jak SillyTavern. Preset z jednym miejscem na World Info otrzymuje jedną sekcję **World Info**, która wysyła obie grupy wpisów. Preset zaimportowany przed tą zmianą ma jedną sekcję **World Info**. Żeby to poprawić, zaimportuj go ponownie albo dodaj w jego sekcjach **Znacznik lorebooka (przed)** i **Znacznik lorebooka (po)** w wybranych miejscach i usuń starą sekcję **World Info**.
- Wpisy World Info umieszczone wokół notatki autora w aplikacji SillyTavern trafiają na głębokość 4 z rolą systemową, tam gdzie notatka autora (wpisy po notatce trafiają tuż za wpisami przed nią). Wpisy umieszczone wokół przykładowych wiadomości trafiają za definicje postaci. Import podaje, ile wpisów przeniesiono.
- Preset przenosi ustawienia samplerów: temperaturę, Top P, Top K, Min P, kary za częstotliwość i obecność oraz wysiłek rozumowania. To wartości początkowe dla czatów używających presetu; własne wartości połączenia lub czatu nadal mają pierwszeństwo. Maksymalna długość odpowiedzi i rozmiar kontekstu pozostają w połączeniu. Top A i kara za powtórzenia nie mają tu ustawienia i są pomijane.

## Czego nie da się przenieść

Kreator czyta tylko kategorie z pierwszej tabeli. Pozostałych danych z aplikacji SillyTavern, takich jak globalne ustawienia aplikacji i profile połączeń, nie importuje. Lista **Nie przeniesiono** w wynikach importu folderu podaje liczbę znalezionych elementów, które nie mają tutaj odpowiednika: zestawów Quick Reply, szablonów instruct, szablonów kontekstu i promptów systemowych. Czaty zaimportowane przed tą poprawką dostały czas importu jako daty wiadomości. Żeby poprawić taki czat, usuń go i ponownie zaimportuj jego plik (przy imporcie folderu odznacz **Pomiń to, co już tu jest**).

## Powiązane przewodniki

- [Importowanie i eksportowanie kart postaci](../characters/import-export.md)
- [Importowanie i eksportowanie lorebooków](../lorebooks/import-export.md)
- [Eksport i import czatów](../chats/export-import.md)
- [Skrypty regex](../extending/regex-scripts.md)
