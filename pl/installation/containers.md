# Uruchamianie w kontenerze (Docker / Podman)

Uruchom aplikację Marinara Engine w kontenerze za pomocą narzędzia Docker lub Podman. Kontener to paczka, która zawiera aplikację i wszystko, czego ona potrzebuje, więc nie instalujesz Node.js. Jeśli chcesz uruchomić aplikację Marinara jak najmniejszym nakładem pracy, zacznij tutaj.

## Zanim zaczniesz

Zainstaluj jedno z tych narzędzi na komputerze, na którym ma działać aplikacja Marinara:

- Docker Desktop (Windows lub macOS) albo Docker Engine (Linux).
- Podman, zamiennik narzędzia Docker, który nie potrzebuje usługi w tle i działa bez uprawnień roota.

Pojęcia używane dalej:

- **Image** (obraz): gotowa do pobrania kopia aplikacji Marinara, tylko do odczytu. Uruchomienie obrazu tworzy kontener.
- **Volume** (wolumin): miejsce na dane, którym zarządza narzędzie do kontenerów. Zachowuje dane, gdy usuniesz kontener i utworzysz go od nowa.

Oficjalne obrazy są dostępne pod adresem `ghcr.io/pasta-devs/marinara-engine`.

<a id="start-marinara"></a>

## Uruchamianie aplikacji Marinara

Projekt zawiera gotowy plik `docker-compose.yml`. Compose to część narzędzia Docker, która czyta ten plik i uruchamia kontener. To zalecany sposób.

1. Otwórz terminal, czyli okno, w którym wpisuje się polecenia. Jeśli masz już kopię repozytorium Marinara Engine, otwórz terminal w tym folderze i pomiń dwa następne kroki.
2. Pobierz pliki projektu.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Otwórz nowy folder.

   ```bash
   cd Marinara-Engine
   ```

4. Uruchom kontener w tle.

   ```bash
   docker compose up -d
   ```

   Pierwsze uruchomienie pobiera obraz `ghcr.io/pasta-devs/marinara-engine:latest`, co może potrwać kilka minut. Po zakończeniu terminal pokazuje kontener ze stanem `Started`.

5. Otwórz w przeglądarce adres `http://127.0.0.1:7860`. Wczyta się ekran główny aplikacji Marinara.

Jeśli to nie zadziałało: port `7860` może zajmować inny program. Wybierz wolny port, na przykład `8080`. Utwórz plik o nazwie `.env` w tym samym folderze co `docker-compose.yml`, wpisz w nim linię `PORT=8080` i jeszcze raz uruchom `docker compose up -d`. Compose czyta ten plik za każdym razem, więc późniejsze aktualizacje zachowają nowy port. Potem otwórz `http://127.0.0.1:8080`. Inne rozwiązania znajdziesz w sekcji [Rozwiązywanie problemów](#troubleshooting).

## Zatrzymywanie aplikacji Marinara

Uruchom to polecenie w tym samym folderze. Zatrzymuje ono i usuwa kontener. Dane zostają w woluminie.

```bash
docker compose down
```

W przypadku narzędzia Podman użyj `podman compose down`.

## Gdzie zapisywane są dane

Marinara zapisuje czaty, postacie, wgrane pliki, czcionki i domyślne tła jako zwykłe pliki w woluminie Compose o nazwie `marinara-data`. Compose dokleja z przodu nazwę folderu projektu, więc prawdziwa nazwa ma postać `PROJECT_marinara-data`. Aby poznać dokładną nazwę woluminu i miejsce, w którym leży:

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

W miejsce `PROJECT_marinara-data` wstaw nazwę, którą wypisało pierwsze polecenie.

Przy pierwszym starcie Marinara tworzy też wewnątrz woluminu pusty plik ustawień `/app/data/.env`. Tam dopisuje się ustawienia serwera. Przetrwają restarty i aktualizacje obrazu. Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

Przy każdym starcie kontener poprawia właściciela folderu z danymi, żeby aplikacja mogła w nim zapisywać. Startuje jako root, poprawia właściciela, a potem przełącza się na użytkownika innego niż root. Działa to zarówno dla woluminu, jak i dla folderu podmontowanego z komputera.

<a id="open-marinara-from-another-device"></a>

## Otwieranie aplikacji Marinara na innym urządzeniu

Domyślnie Compose pozwala dotrzeć do aplikacji Marinara tylko z tego komputera. Aby otworzyć ją na telefonie albo innym komputerze, opublikuj port na wszystkich interfejsach, a wcześniej ustaw logowanie. Nigdy nie udostępniaj aplikacji Marinara w sieci bez logowania.

W środowiskach Docker Desktop, OrbStack i rootless Docker (Docker bez uprawnień roota) każde urządzenie widać pod jednym adresem bramy. Bez logowania port opublikowany na wszystkich interfejsach wpuszcza wszystkich. Po ustawieniu logowania ten komputer też jest o nie proszony. Zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Otwórz w edytorze tekstu plik `docker-compose.yml` z folderu aplikacji Marinara.
2. Na liście `ports:` usuń `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. Na liście `environment:` dodaj sekret administratora. Użyj własnej, długiej, losowej wartości.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. Na tej samej liście dodaj logowanie. Użyj własnej nazwy użytkownika i długiego, losowego hasła.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Zapisz plik i uruchom kontener ponownie.

   ```bash
   docker compose up -d
   ```

6. Na drugim urządzeniu otwórz `http://YOUR_COMPUTER_IP:7860`. Jeśli ustawiono `PORT`, użyj tego portu. Strona poprosi o dane logowania.

Jeśli pominiesz `BASIC_AUTH_USER` i `BASIC_AUTH_PASS`, strona poprosi zamiast tego o jednorazowy kod konfiguracji. Znajdź go w logach, a potem wpisz na stronie razem z nową nazwą użytkownika i hasłem.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

Logowanie w aplikacji możesz później zmienić w **Settings → Advanced → Access** (ustawienia, zaawansowane, dostęp) w zalogowanej przeglądarce. Jeśli zapomnisz hasła, uruchom `docker exec <container> node scripts/reset-login.mjs`. To polecenie nie zmienia logowania ustawionego przez `BASIC_AUTH_USER` i `BASIC_AUTH_PASS`. Te wartości zmień w pliku compose i utwórz kontener ponownie.

W środowiskach Docker Desktop, OrbStack i rootless Docker otwórz aplikację Marinara na tym komputerze pod adresem `http://localhost:7860`, żeby ustawić logowanie w **Settings**. Lista dozwolonych adresów IP nie potrafi tam odróżnić urządzeń, więc użyj logowania. Inne sposoby ograniczania dostępu i to, co robi sekret administratora, opisuje przewodnik [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

## Aktualizacja aplikacji Marinara

Kontenery nie aktualizują się same. Najpierw zrób kopię zapasową (zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md)), a potem pobierz nowy obraz i uruchom kontener ponownie. Uruchom to polecenie w folderze, w którym leży plik `docker-compose.yml`:

```bash
docker compose pull && docker compose up -d
```

W przypadku narzędzia Podman użyj zamiast tego `podman compose`. W aplikacji **Settings → Advanced → Updates → Check for Updates** (ustawienia, zaawansowane, aktualizacje, sprawdzenie aktualizacji) pokazuje tag obrazu i to polecenie. W kontenerze aplikacja nie potrafi sama wgrać aktualizacji.

Żeby wrócić do starszego wydania, wpisz jego tag w wierszu `image:` pliku `docker-compose.yml`, a potem uruchom `docker compose up -d`. Najpierw przeczytaj [Powrót do starszej wersji](../UPGRADING.md#downgrading-to-an-older-version). Starsze kompilacje nie otwierają danych zapisanych przez nowsze.

## Wybór tagu obrazu

| Tag | Co to jest |
| --- | --- |
| `latest` | Stabilne wydanie. Używa go plik `docker-compose.yml`. |
| `X.Y.Z` | Jedna stała wersja, na przykład `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | Niestabilna wersja testowa z niewydanym kodem. Może się psuć, a przeniesienie danych z powrotem do stabilnej wersji może okazać się niemożliwe. |
| `lite` | Mniejszy obraz. Zobacz niżej. |
| `X.Y.Z-lite` | Stała wersja obrazu lite. |

Jeśli uruchamiasz `staging`, użyj osobnego woluminu, żeby ta wersja nie mogła zmienić twoich stabilnych danych:

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### Obraz lite

Obraz lite to mniejsze pobieranie, zbudowane na Wolfi, minimalnej bazie Linuksa dla kontenerów. Pomija funkcje, które wymagają dużych plików lokalnych:

| Brak w lite | Co tracisz |
| --- | --- |
| Built-in model (model wbudowany) | Nie da się uruchomić modelu AI na własnym sprzęcie. |
| Lokalny model embeddingów | Brak embeddingów tekstu liczonych na urządzeniu. |
| Memory Recall (wyszukiwanie semantyczne) | Zależy od lokalnego modelu embeddingów. |
| Lokalne wejście głosowe Whisper | Brak zamiany mowy na tekst w rozmowach w trybie Conversation. |
| Odczytywanie nastroju przez awatary | Awatary 2D i 3D wybierają miny na podstawie listy słów, a nie małego lokalnego modelu rozpoznawania emocji. |

Wszystko inne działa: czat, roleplay, Game Mode, agenci, lorebooki, postacie i zdalne usługi AI. Do korzystania z funkcji AI trzeba dodać konto w zewnętrznej usłudze. Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Część starszych obrazów lite wysypuje się na Raspberry Pi 4 i podobnych komputerach ARM z błędem `SIGILL` (błąd niedozwolonej instrukcji) podczas wychodzących wywołań AI. Na takich urządzeniach używaj zwykłego obrazu `latest`. Aktualne szczegóły opisuje przewodnik [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Podman

Podman uruchamia te same obrazy. W większości poleceń zamień `docker` na `podman`.

```bash
podman compose up -d
```

Uruchomienie jednego kontenera bez Compose:

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

Polecenie `podman compose` wymaga pomocniczego narzędzia `podman-compose`. Zainstaluj je jednym z tych poleceń:

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

Pierwsza linia jest dla systemu Fedora, druga dla systemu Debian lub Ubuntu, a trzecia działa wszędzie tam, gdzie jest pip.

## Samodzielne budowanie obrazu

Żeby zbudować obraz ze źródeł zamiast go pobierać:

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Żeby zbudować obraz lite, użyj pliku budowania wersji lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

**Strona się nie ładuje albo port jest zajęty.** Zobacz rozwiązanie problemu z portem w sekcji [Uruchamianie aplikacji Marinara](#start-marinara).

**Marinara nie może zapisywać plików albo pojawiają się błędy uprawnień.** Kontener poprawia właściciela folderu przy każdym starcie. Na niektórych systemach plików hosta ta poprawka może się nie udać, a pomija ją ustawienie `MARINARA_SKIP_DATA_CHOWN=true`. Jeśli błędy nie znikają, użyj domyślnego woluminu `marinara-data`. To najpewniejszy wybór.

**Obraz lite wysypuje się na Raspberry Pi 4.** Użyj zwykłego obrazu `latest`.

Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Konfiguracja serwera](../CONFIGURATION.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
