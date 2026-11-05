# Przewodnik instalacji w systemie Windows

Zainstaluj aplikację Marinara Engine na komputerze z systemem Windows za pomocą instalatora (najmniej kroków) albo ze źródeł. Marinara działa potem na twoim własnym komputerze.

## Zanim zaczniesz

Potrzebny jest system Windows 10 lub Windows 11 (64-bitowy), kilka gigabajtów wolnego miejsca na dysku i połączenie z internetem na czas instalacji. Instalator zaleca około 2,5 GB wolnego miejsca.

Potrzebne są też dwa narzędzia:

- **Node.js** w wersji 24, 25 lub 26. Node.js uruchamia aplikację. Zalecana jest wersja 24, czyli wydanie LTS (Long Term Support).
- **Git**. Git pobiera kod i pozwala aplikacji Marinara aktualizować się samodzielnie.

Przy instalatorze pomiń ich instalację, bo instalator pobierze oba narzędzia za ciebie. Przy instalacji ze źródeł instalujesz je samodzielnie. Nie musisz instalować pnpm (narzędzia, które instaluje części aplikacji). Instalator i `start.bat` przygotowują je same.

## Instalacja za pomocą instalatora dla systemu Windows

1. Otwórz [stronę z wydaniami aplikacji Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Pobierz najnowszy instalator dla systemu Windows. Jego nazwa to `Marinara-Engine-Installer-`, a po niej numer wersji.
3. Uruchom instalator. Jeśli system Windows pokaże komunikat "Windows protected your PC", wybierz **More info** (więcej informacji), a potem **Run anyway** (uruchom mimo to), ale tylko dla pliku ze strony z wydaniami.
4. Postępuj zgodnie z komunikatami. Jeśli brakuje Node.js albo Git, pozwól instalatorowi je zainstalować.
5. Wybierz folder instalacji albo zaakceptuj domyślny (`%LOCALAPPDATA%\Marinara-Engine`).
6. Poczekaj, aż instalator pobierze i zbuduje aplikację. Lista postępu pokazuje każdy krok. Trwa to kilka minut.
7. Gdy instalator poinformuje, że instalacja się zakończyła, kliknij dwukrotnie skrót **Marinara Engine** na pulpicie.

Otworzy się okno konsoli (czarne okno tekstowe), w którym widać postęp. Potem przeglądarka otworzy aplikację Marinara. Jeśli tak się nie stanie, przejdź pod adres `http://127.0.0.1:7860`.

Instalator tworzy kopię Git najnowszego stabilnego wydania, więc aplikacja Marinara może aktualizować się sama przy każdym uruchomieniu.

> **Wskazówka:** Niektóre programy antywirusowe oznaczają instalator jako podejrzany, bo pobiera on Node.js i Git. Uruchamiaj instalator tylko wtedy, gdy pochodzi z podanej wyżej strony z wydaniami.

## Uruchamianie i zatrzymywanie aplikacji Marinara

- **Uruchamianie:** kliknij dwukrotnie skrót na pulpicie albo pozycję w menu Start. Przy instalacji ze źródeł uruchom `start.bat` w folderze aplikacji Marinara.
- **Zatrzymywanie:** skrót otwiera okno konsoli. Naciśnij w nim <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Jeśli aplikacja Marinara już działa, skrót ponownie otwiera ją w przeglądarce.

## Instalacja ze źródeł

Użyj tej metody, jeśli wolisz wpisywać polecenia samodzielnie albo chcesz korzystać z wersji testowej (staging).

1. Zainstaluj [Node.js](https://nodejs.org/en/download) i [Git for Windows](https://git-scm.com/download/win).
2. Otwórz nowe okno wiersza polecenia (Command Prompt), czyli okno tekstowe, w którym wpisuje się polecenia.
3. Sprawdź oba narzędzia. `node -v` musi pokazać wersję 24, 25 lub 26.

   ```bat
   node -v
   git --version
   ```

   Jeśli polecenie nie zostanie znalezione, zamknij i ponownie otwórz wiersz polecenia albo zainstaluj brakujące narzędzie jeszcze raz.

4. Pobierz kod.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Otwórz jego folder.

   ```bat
   cd Marinara-Engine
   ```

6. Opcjonalnie: przed pierwszym uruchomieniem przełącz się na wersję testową (staging). Pomiń ten krok, żeby zostać na wersji stabilnej. Zanim użyjesz wersji staging, zrób kopię zapasową danych.

   ```bat
   git checkout staging
   ```

   Program uruchamiający będzie potem trzymał się wersji staging przy aktualizacjach.

7. Uruchom program uruchamiający, czyli skrypt, który konfiguruje i uruchamia aplikację Marinara.

   ```bat
   start.bat
   ```

Pierwsze uruchomienie trwa kilka minut, bo wszystko musi się zainstalować i zbudować. Okno konsoli pokazuje postęp. Gdy aplikacja Marinara będzie gotowa, przeglądarka ją otworzy. Żeby później uruchomić ją ponownie, uruchom `start.bat` z tego samego folderu.

Jeśli to nie zadziałało: komunikat `[ERROR] Node.js 24 LTS or newer is required` oznacza, że twoja wersja Node.js jest za stara. Zainstaluj Node.js 24 lub nowszy ze strony [nodejs.org](https://nodejs.org), a potem ponownie uruchom `start.bat`.

### Konfiguracja ręczna bez programu uruchamiającego

Ta droga wymaga polecenia `pnpm`. Uruchamiaj te polecenia wewnątrz folderu `Marinara-Engine`.

1. Zainstaluj pnpm (wystarczy raz).

   ```bat
   npm install -g pnpm
   ```

2. Zainstaluj zależności (części potrzebne aplikacji), zbuduj aplikację i uruchom serwer.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Otwórz `http://127.0.0.1:7860`.

Przy `pnpm start` do aplikacji Marinara ma dostęp tylko ten komputer. Żeby pozwolić na połączenia innym urządzeniom, utwórz plik o nazwie `.env` w folderze `Marinara-Engine`, dodaj do niego tę linię i uruchom serwer ponownie.

```env
HOST=0.0.0.0
```

## Otwieranie aplikacji Marinara na innym urządzeniu

Instalator, jego skrót i `start.bat` pozwalają innym urządzeniom w twojej sieci dotrzeć do aplikacji Marinara, ale aplikacja blokuje je, dopóki nie ustawisz logowania. Kroki opisują przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md) oraz [Najczęściej zadawane pytania](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Aktualizacja aplikacji Marinara

Przy każdym uruchomieniu aplikacji Marinara ze skrótu albo przez `start.bat` program uruchamiający sprawdza dostępność aktualizacji, instaluje je, przebudowuje aplikację i ją uruchamia. Czaty, postacie i ustawienia zostają na miejscu. Jeśli w kodzie są twoje własne zmiany, program uruchamiający odkłada je na bok i po aktualizacji przywraca na miejsce. Jeśli to się nie uda, zostawia obecną wersję i wypisuje informację. Przycisk **Apply Update** (wgranie aktualizacji) w aplikacji, pomijanie aktualizacji i polecenia ręczne opisuje przewodnik [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md#windows).

## Gdzie są dane i jak odinstalować aplikację

Dane znajdują się w folderze `packages\server\data` wewnątrz folderu aplikacji Marinara. Żeby odinstalować aplikację, otwórz pozycję **Uninstall Marinara Engine** (odinstalowanie aplikacji Marinara Engine) w menu Start. Deinstalator pyta, czy usunąć też dane. Wybierz **No** (nie), żeby zachować je na wypadek ponownej instalacji. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md).

## Opcjonalnie: usuwanie tła sprite'ów przez AI

Marinara prosi o przezroczyste tło generowanych sprite'ów i sama czyści jednolite tła. Jako metodę zapasową dla szczegółowej scenerii możesz zainstalować opcjonalne narzędzie `backgroundremover`. Pobiera ono duże pliki uczenia maszynowego, więc jest domyślnie wyłączone.

1. Zainstaluj Python 3.11 ze strony [python.org](https://www.python.org/downloads/windows/). Działają wersje Pythona od 3.9 do 3.11.
2. Uruchom to polecenie z folderu `Marinara-Engine`.

   ```bat
   pnpm backgroundremover:install
   ```

Polecenie tworzy prywatny folder Pythona (venv) w folderze z danymi. Marinara korzysta z niego automatycznie.

Żeby `start.bat` zainstalował to narzędzie przy następnym uruchomieniu, dodaj tę linię do pliku `.env`:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Kiedy coś pójdzie nie tak

Sprawdź, czy Node.js ma wersję 24, 25 lub 26 i czy Git jest zainstalowany. Więcej rozwiązań znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
- [Najczęściej zadawane pytania](../FAQ.md)
