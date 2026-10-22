# Przewodnik instalacji na macOS i Linux

Z tego przewodnika dowiesz się, jak zainstalować i uruchomić aplikację Marinara Engine na macOS lub Linux. Zainstalujesz dwa wymagane narzędzia, uruchomisz aplikację skryptem startowym powłoki i poznasz sposób na późniejsze aktualizacje. Marinara Engine (dalej krótko: Marinara) działa w całości na twoim komputerze.

## Wymagania wstępne

Przed startem potrzebne są dwa bezpłatne narzędzia:

- **Node.js**: program, który uruchamia aplikację Marinara. Zainstaluj wersję 24, 25 lub 26 (zalecane jest wydanie LTS, czyli wersja 24).
- **Git**: narzędzie, które pobiera aplikację Marinara i przynosi aktualizacje.

Menedżera pakietów pnpm nie trzeba instalować samodzielnie. To on pobiera części składowe aplikacji Marinara. Skrypt startowy powłoki instaluje odpowiednią wersję pnpm za ciebie.

### Instalacja na macOS

Najprościej jest przez Homebrew. Jedno polecenie instaluje oba narzędzia:

```bash
brew install node git
```

Bez Homebrew pobierz instalator Node.js ze strony https://nodejs.org. Następnie zainstaluj Git razem z narzędziami wiersza poleceń Xcode:

```bash
xcode-select --install
```

### Instalacja na Linux

Skorzystaj z menedżera pakietów swojej dystrybucji. W Ubuntu i Debianie domyślny Node.js bywa starszy niż wersja 24. Dodaj więc najpierw nowsze wydanie z NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Potem zainstaluj Node.js i Git:

```bash
sudo apt install -y nodejs git
```

W Fedorze:

```bash
sudo dnf install -y nodejs git
```

W Arch:

```bash
sudo pacman -S nodejs npm git
```

### Sprawdzenie narzędzi

Sprawdź, czy oba narzędzia są gotowe. Uruchom to polecenie:

```bash
node -v
```

Powinno pojawić się `v24` albo wyższy numer. Następnie uruchom to polecenie:

```bash
git --version
```

Powinna pojawić się wersja w rodzaju `git version 2.40` albo wyższa. Jeśli któreś z poleceń zgłasza "command not found", narzędzie nie zostało zainstalowane poprawnie.

## Szybki start ze skryptem startowym

Skrypt startowy `start.sh` to zalecany sposób uruchamiania aplikacji Marinara. Instaluje wszystko, buduje aplikację i otwiera ją w przeglądarce.

1. Pobierz aplikację Marinara. Uruchom to polecenie:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Wejdź do nowego folderu. Uruchom to polecenie:

```bash
cd Marinara-Engine
```

3. Nadaj skryptowi startowemu prawo uruchamiania. Uruchom to polecenie:

```bash
chmod +x start.sh
```

4. Uruchom aplikację Marinara. Uruchom to polecenie:

```bash
./start.sh
```

Pierwsze uruchomienie trwa kilka minut, bo wszystko jest wtedy pobierane i budowane. Po zakończeniu Marinara otwiera się w przeglądarce pod adresem http://127.0.0.1:7860. Liczba 7860 to domyślny port, czyli furtka, z której aplikacja korzysta na twoim komputerze.

Jeśli przeglądarka nie otworzy się sama, otwórz ją ręcznie i przejdź pod ten sam adres.

### Co skrypt startowy robi za każdym razem

Przy każdym uruchomieniu `./start.sh` z kopii pobranej przez Git skrypt startowy:

1. Sprawdza, czy jest nowsza wersja, i aktualizuje sam siebie, jeśli ją znajdzie.
2. Potwierdza gotowość Node.js i właściwej wersji pnpm.
3. Instaluje brakujące części.
4. Przebudowuje aplikację, gdy zmienił się kod.
5. Przygotowuje lokalną przestrzeń na twoje dane.
6. Uruchamia serwer i otwiera aplikację w przeglądarce.

### Wyłączanie automatycznego otwierania przeglądarki

Domyślnie skrypt startowy otwiera przeglądarkę za ciebie. Aby to wyłączyć, utwórz w folderze aplikacji Marinara plik o nazwie `.env` i dopisz tę linię:

```bash
AUTO_OPEN_BROWSER=false
```

Plik `.env` to zwykły plik tekstowy z ustawieniami, po jednym w każdej linii. Prosty startowy `.env` wygląda tak:

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

Zmienna `PORT` ustawia port adresu (domyślnie 7860). Domyślnie skrypt startowy pozwala też innym urządzeniom w sieci LAN dotrzeć do serwera. LAN to sieć lokalna, czyli sieć w domu lub biurze. Marinara i tak blokuje te urządzenia, dopóki nie zostanie ustawione hasło albo inna opcja dostępu. Pokazuje to przewodnik [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

## Konfiguracja ręczna

Dla większości osób najlepszy jest skrypt startowy opisany wyżej. Jeśli wolisz wykonać każdy krok samodzielnie, użyj poniższych poleceń. Do konfiguracji ręcznej potrzebny jest dostępny menedżer pakietów pnpm. Node.js 24 zawiera Corepack, ale Node.js 25 już nie.

1. W Node.js 24 włącz pnpm przez Corepack:

```bash
corepack enable pnpm
```

W Node.js 25 lub 26 zainstaluj najpierw pakiet Corepack udostępniany przez użytkowników, a potem włącz pnpm:

```bash
npm install --global corepack
corepack enable pnpm
```

2. Pobierz aplikację Marinara. Uruchom to polecenie:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Wejdź do folderu. Uruchom to polecenie:

```bash
cd Marinara-Engine
```

4. Zainstaluj części składowe. Uruchom to polecenie:

```bash
pnpm install --force
```

5. Zbuduj aplikację. Uruchom to polecenie:

```bash
pnpm build
```

6. Uruchom serwer. Uruchom to polecenie:

```bash
pnpm start
```

Teraz otwórz w przeglądarce http://127.0.0.1:7860. Przy `pnpm start` serwer domyślnie nasłuchuje tylko na twoim komputerze. Wszystko działa lokalnie, a miejsce na dane przygotowuje się przy pierwszym uruchomieniu.

### Jeśli instalacja nie powiedzie się na Linux

Niektóre systemy Linux odrzucają bardzo długie ścieżki plików podczas instalacji. Jeśli pojawi się błąd zawierający `ERR_PNPM_ENAMETOOLONG`, usuń niedokończone foldery i zacznij od nowa ze skryptu startowego. Uruchom to polecenie:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Następnie uruchom to polecenie:

```bash
./start.sh
```

## Opcjonalne usuwanie tła

Marinara umie usunąć tło z obrazków sprite'ów postaci. Sprite to obrazek postaci używany w trybach Roleplay i Game Mode. Natywna przezroczystość i wbudowane adaptacyjne czyszczenie maski działają bez tego pobierania. Dodatkowe narzędzie AI do usuwania tła instaluj tylko wtedy, gdy potrzebujesz zapasowej metody dla sprite'ów zrobionych na tle szczegółowej scenerii, cieni albo innego niejednolitego tła; pobiera ono duże pliki.

Dodatkowe narzędzie to program w Pythonie. Jego instalacja tworzy środowisko venv (środowisko wirtualne Pythona, czyli prywatny folder na pakiety Pythona). Pobiera też bibliotekę uczenia maszynowego PyTorch. Na końcu pobiera modele U2Net, czyli pliki, które odnajdują temat obrazu.

Aby zainstalować je jednorazowo, uruchom to polecenie z folderu aplikacji Marinara:

```bash
pnpm backgroundremover:install
```

Na macOS najpewniej sprawdza się Python w wersji 3.11. Zainstaluj go najpierw przez Homebrew:

```bash
brew install python@3.11
```

Potem uruchom polecenie instalacji ponownie:

```bash
pnpm backgroundremover:install
```

Aby skrypt startowy zainstalował to narzędzie przy następnym uruchomieniu, dopisz tę linię do pliku `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Aktualizowanie

Kiedy uruchamiasz aplikację Marinara poleceniem `./start.sh` z kopii pobranej przez Git, skrypt startowy sprawdza, czy jest nowsza wersja. Aktualizuje się automatycznie przed startem. Czaty, postacie i ustawienia zostają nienaruszone.

Uruchom `./start.sh --skip-update`, aby pominąć jedno sprawdzenie. Aby zachować zainstalowaną wersję silnika między uruchomieniami, dopisz `AUTO_UPDATE_ENABLED=false` do pliku `.env`. Nadal można sprawdzić wersję lub zaktualizować ją ręcznie w **Settings → Advanced → Updates** albo poleceniami Git.

Da się to sprawdzić także w aplikacji. Otwórz **Settings** (Ustawienia), przejdź do zakładki **Advanced** i znajdź sekcję **Updates**. Kliknij przycisk **Check for Updates**, aby zobaczyć, czy jest nowsze wydanie. Przycisk **Apply Update** jest domyślnie wyłączony. Aby go włączyć, ustaw kilka opcji serwera. Następnie zapisz sekret administratora w **Settings**, **Advanced**, **Admin Access**. Bez włączania tej opcji wystarczy uruchomić ponownie `./start.sh`, żeby zaktualizować aplikację.

Pełne kroki aktualizacji, w tym utworzenie kopii zapasowej i zmianę kanału wydań, opisuje przewodnik aktualizacji podlinkowany niżej.

## Kluczowe pojęcia

- **pnpm**: menedżer pakietów, którym Marinara pobiera i porządkuje swoje części składowe.
- **Corepack**: pomocnik dołączony do Node.js, który włącza pnpm.
- **LAN**: sieć lokalna, czyli prywatna sieć w domu lub biurze.
- **.env**: zwykły plik tekstowy z ustawieniami w folderze aplikacji Marinara, po jednym ustawieniu w linii.
- **venv**: środowisko wirtualne Pythona, czyli prywatny folder na pakiety Pythona.
- **PyTorch**: biblioteka uczenia maszynowego używana przez opcjonalne narzędzie do usuwania tła.
- **U2Net**: pliki modelu, dzięki którym narzędzie do usuwania tła odnajduje temat obrazu.

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md): wybierz metodę instalacji odpowiednią dla swojego urządzenia.
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md): pełne kroki aktualizacji i tworzenia kopii zapasowej dla każdej platformy.
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md): ustaw hasło, aby inne urządzenia mogły dotrzeć do aplikacji Marinara Engine.
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md): rozwiązania problemów z instalacją i uruchamianiem.
