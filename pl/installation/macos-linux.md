# Przewodnik instalacji na macOS i Linux

Zainstaluj aplikację Marinara Engine na komputerze Mac lub z systemem Linux i uruchom ją programem uruchamiającym `start.sh`. Marinara działa potem na twoim własnym komputerze.

## Zanim zaczniesz

Potrzebne są dwa narzędzia:

- **Node.js** w wersji 24, 25 lub 26. Node.js uruchamia aplikację Marinara. Zalecana jest wersja 24, czyli wydanie LTS (Long Term Support).
- **Git**. Git pobiera aplikację Marinara i jej aktualizacje.

Nie musisz instalować pnpm (narzędzia, które instaluje części aplikacji). Program uruchamiający przygotowuje właściwą wersję.

### Instalacja Node.js i Git w systemie macOS

Jeśli masz Homebrew, jedno polecenie instaluje oba narzędzia:

```bash
brew install node git
```

Bez Homebrew pobierz instalator Node.js ze strony [nodejs.org](https://nodejs.org). Następnie zainstaluj Git razem z narzędziami wiersza poleceń Xcode:

```bash
xcode-select --install
```

### Instalacja Node.js i Git w systemie Linux

Użyj menedżera pakietów. W systemach Ubuntu i Debian domyślny Node.js bywa starszy niż wersja 24, więc najpierw dodaj wydanie z NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

W systemie Fedora:

```bash
sudo dnf install -y nodejs git
```

W systemie Arch:

```bash
sudo pacman -S nodejs npm git
```

### Sprawdzenie narzędzi

```bash
node -v
git --version
```

`node -v` musi pokazać `v24` lub wyższą wersję. Jeśli któreś z poleceń zgłasza "command not found", narzędzie nie zostało zainstalowane poprawnie.

## Instalacja i uruchomienie aplikacji Marinara

1. Otwórz terminal, czyli okno, w którym wpisuje się polecenia. Na komputerze Mac naciśnij <kbd>Cmd</kbd>+<kbd>Space</kbd>, wpisz Terminal i naciśnij Enter. W systemie Linux otwórz aplikację Terminal.
2. Pobierz aplikację Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Otwórz nowy folder.

   ```bash
   cd Marinara-Engine
   ```

4. Uruchom aplikację Marinara programem uruchamiającym, czyli skryptem, który ją konfiguruje i uruchamia.

   ```bash
   ./start.sh
   ```

Pierwsze uruchomienie trwa kilka minut, bo wszystko jest wtedy pobierane i budowane. Terminal pokazuje postęp, a potem `Press Ctrl+C to stop`. Marinara otwiera się w przeglądarce pod adresem `http://127.0.0.1:7860`. Jeśli przeglądarka się nie otworzy, przejdź pod ten adres samodzielnie.

Jeśli to nie zadziałało:

- `permission denied`: uruchom `chmod +x start.sh`, a potem jeszcze raz `./start.sh`.
- `[ERROR] Node.js 24 LTS or newer is required`: twoja wersja Node.js jest za stara. Zainstaluj nowszą wersję, a potem jeszcze raz uruchom `./start.sh`.

## Uruchamianie i zatrzymywanie aplikacji Marinara

- **Ponowne uruchomienie:** uruchom `./start.sh` z folderu aplikacji Marinara. Jeśli aplikacja Marinara już działa, program uruchamiający ponownie otwiera ją w przeglądarce.
- **Zatrzymanie:** naciśnij <kbd>Ctrl</kbd>+<kbd>C</kbd> w terminalu.

Przy każdym uruchomieniu `./start.sh` z kopii pobranej przez Git program uruchamiający:

1. Sprawdza, czy jest nowsza wersja, i aktualizuje aplikację, jeśli ją znajdzie.
2. Sprawdza Node.js i właściwą wersję pnpm.
3. Instaluje brakujące części i przebudowuje aplikację, jeśli zmienił się kod.
4. Uruchamia serwer i otwiera przeglądarkę.

## Zmiana ustawień programu uruchamiającego

Ustawienia programu uruchamiającego leżą w pliku `.env` w folderze aplikacji Marinara. Plik `.env` to zwykły plik tekstowy z jednym ustawieniem w każdej linii. Żeby program uruchamiający nie otwierał przeglądarki, dodaj tę linię:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` ustawia port, czyli liczbę po dwukropku w adresie (domyślnie 7860). Program uruchamiający pozwala innym urządzeniom w sieci lokalnej dotrzeć do aplikacji Marinara, ale blokuje je, dopóki nie ustawisz logowania. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md).

## Aktualizacja aplikacji Marinara

Uruchomienie `./start.sh` najpierw aktualizuje aplikację Marinara. Czaty, postacie i ustawienia zostają na miejscu. Jeśli w kodzie są twoje własne zmiany, program uruchamiający odkłada je na bok i po aktualizacji przywraca na miejsce. Pomijanie aktualizacji, przycisk **Apply Update** (wgranie aktualizacji) w aplikacji i polecenia ręczne opisuje przewodnik [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md#macos-and-linux).

## Konfiguracja ręczna bez programu uruchamiającego

Większość osób powinna korzystać z programu uruchamiającego. Żeby wykonać każdy krok samodzielnie, potrzebujesz pnpm. Node.js 24 zawiera Corepack, narzędzie, które włącza pnpm. Node.js 25 go nie zawiera.

1. W Node.js 24 włącz pnpm:

   ```bash
   corepack enable pnpm
   ```

   W Node.js 25 lub 26 najpierw zainstaluj Corepack:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Pobierz aplikację Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Otwórz jej folder.

   ```bash
   cd Marinara-Engine
   ```

4. Zainstaluj części, zbuduj aplikację i uruchom serwer.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Otwórz `http://127.0.0.1:7860`.

Przy `pnpm start` serwer nasłuchuje tylko na twoim komputerze. Żeby pozwolić na połączenia innym urządzeniom, dodaj `HOST=0.0.0.0` do pliku `.env` i uruchom serwer ponownie.

## Opcjonalnie: narzędzie do usuwania tła

Marinara prosi o przezroczyste tło generowanych sprite'ów (obrazków postaci) i sama czyści jednolite tła. Jako metodę zapasową dla szczegółowej scenerii lub cieni możesz zainstalować opcjonalne narzędzie AI do usuwania tła. Tworzy ono środowisko venv Pythona (prywatny folder na pakiety Pythona) i pobiera duże pliki: PyTorch (bibliotekę uczenia maszynowego) oraz modele U2Net (pliki, które odnajdują główny obiekt na obrazie).

1. W systemie macOS najlepiej sprawdza się Python 3.11. Najpierw go zainstaluj. Działają wersje Pythona od 3.9 do 3.11.

   ```bash
   brew install python@3.11
   ```

2. W folderze aplikacji Marinara uruchom:

   ```bash
   pnpm backgroundremover:install
   ```

Żeby program uruchamiający zainstalował to narzędzie przy następnym uruchomieniu, dodaj tę linię do pliku `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Kiedy coś pójdzie nie tak

W niektórych systemach Linux instalacja kończy się błędem zawierającym `ERR_PNPM_ENAMETOOLONG` (za długie ścieżki plików). Usuń niedokończone foldery i jeszcze raz uruchom program uruchamiający:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

Więcej rozwiązań znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
