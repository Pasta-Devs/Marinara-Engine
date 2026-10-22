# Uruchamianie w kontenerze (Docker / Podman)

Z tego przewodnika dowiesz się, jak uruchomić aplikację Marinara Engine w kontenerze Docker lub Podman. Kontener to samodzielna paczka, która zawiera aplikację i wszystko, czego ona potrzebuje do działania. Nie trzeba instalować na komputerze ani Node.js, ani żadnych innych narzędzi. Dla osoby początkującej, która chce po prostu uruchomić aplikację Marinara Engine, to najprostsza droga.

## Wymagania wstępne

Zanim zaczniesz, zainstaluj jedno z tych narzędzi na komputerze, który ma uruchamiać aplikację Marinara Engine:

- Docker Desktop (Windows lub macOS) albo Docker Engine (Linux). Docker to najpopularniejsze narzędzie do kontenerów.
- Albo Podman. Podman zastępuje Docker jeden do jednego. Działa bez usługi w tle i dobrze radzi sobie bez uprawnień administratora.

Kilka pojęć, które pojawiają się dalej:

- **Image** (obraz): tylko do odczytu, gotowy do pobrania szablon z aplikacją Marinara Engine. Uruchomienie obrazu tworzy działający kontener.
- **Volume** (wolumin): miejsce na dane, którym zarządza narzędzie do kontenerów. Wolumin przechowuje dane nawet wtedy, gdy usuniesz kontener i utworzysz go od nowa.
- **LAN**: sieć lokalna (domowa lub biurowa sieć Wi-Fi albo kablowa).

Oficjalne obrazy aplikacji Marinara Engine publikowane są pod adresem `ghcr.io/pasta-devs/marinara-engine`.

## Pobranie i uruchomienie

W głównym folderze repozytorium leży gotowy plik `docker-compose.yml`. Compose czyta ten plik i sam uruchamia kontener. To zalecany sposób uruchamiania aplikacji Marinara Engine.

1. Pobierz kopię repozytorium. Jeśli kopia repozytorium Marinara Engine już jest na dysku, otwórz terminal w tym folderze. Jeśli nie, najpierw sklonuj repozytorium:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Przejdź do folderu:

```bash
cd Marinara-Engine
```

3. Uruchom kontener w tle:

```bash
docker compose up -d
```

Plik `docker-compose.yml` korzysta z obrazu `ghcr.io/pasta-devs/marinara-engine:latest` i pobiera go przy pierwszym uruchomieniu tego polecenia. Pierwsze pobieranie potrafi zająć kilka minut.

## Sprawdzenie, czy wszystko działa

1. Otwórz przeglądarkę internetową.
2. Wejdź pod ten adres:

```text
http://127.0.0.1:7860
```

Powinien pokazać się ekran główny aplikacji Marinara Engine. Jeśli tak jest, kontener działa. Adres `127.0.0.1` oznacza "ten sam komputer", a `7860` to domyślny port, na którym nasłuchuje aplikacja Marinara Engine.

Jeśli strona się nie ładuje, zajrzyj do sekcji Rozwiązywanie problemów poniżej.

## Gdzie zapisywane są dane

Dane (czaty, postacie, wgrane pliki, czcionki i domyślne tła) zapisują się jako zwykłe pliki. Marinara Engine przechowuje wszystko w plikach, a nie w jednym pliku bazy danych. Compose trzyma te pliki w nazwanym woluminie `marinara-data`.

Compose dokleja nazwę folderu projektu przed nazwą woluminu, więc prawdziwa nazwa ma postać `PROJECT_marinara-data`. Aby poznać dokładną nazwę na swoim komputerze, wypisz woluminy:

```bash
docker volume ls --filter name=marinara-data
```

Następnie sprawdź ten z listy, żeby zobaczyć, gdzie leży:

```bash
docker volume inspect PROJECT_marinara-data
```

W miejsce `PROJECT_marinara-data` wstaw nazwę, którą wypisało poprzednie polecenie.

Przy każdym starcie kontener przygotowuje folder z danymi. Domyślnie kontener startuje jako root. Naprawia uprawnienia do folderu, żeby aplikacja mogła w nim zapisywać, a potem dla bezpieczeństwa przełącza się na użytkownika bez uprawnień administratora. Ta naprawa działa zarówno dla nazwanego woluminu, jak i dla folderu podmontowanego z komputera. Dzięki temu starsze instalacje przechodzą na przechowywanie w plikach bez ręcznego grzebania w uprawnieniach.

Przy pierwszym starcie Marinara Engine tworzy też pusty plik ustawień `/app/data/.env` wewnątrz woluminu. To tam można później dopisać ustawienia serwera. Ponieważ plik leży w woluminie, ustawienia przetrwają restart kontenera i aktualizację obrazu. Pełną listę ustawień znajdziesz w przewodniku [Konfiguracja serwera](../CONFIGURATION.md).

## Udostępnianie aplikacji w sieci lokalnej

Domyślnie Compose wpuszcza do aplikacji Marinara Engine tylko z tego samego komputera. To bezpieczne ustawienie domyślne. Aby otworzyć aplikację na telefonie albo na innym komputerze w sieci, trzeba zrobić dwie rzeczy. Zmienić mapowanie portów i włączyć logowanie, żeby nikt obcy się nie dostał.

Inne urządzenia potrzebują logowania, zanim będą mogły używać aplikacji Marinara Engine. Nigdy nie udostępniaj aplikacji Marinara Engine w sieci bez logowania.

1. Otwórz plik `docker-compose.yml` w edytorze tekstu.

2. Znajdź linię z portem. Wygląda tak:

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Usuń fragment `127.0.0.1:`, żeby aplikacja była dostępna z innych urządzeń:

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. W tym samym pliku dopisz do listy `environment:` sekret administratora. Wpisz własną wartość:

```yaml
environment:
  - ADMIN_SECRET=another-long-random-value
```

5. Zapisz plik i zrestartuj kontener:

```bash
docker compose up -d
```

Od tej pory inne urządzenia w sieci docierają do aplikacji Marinara Engine pod adresem `http://YOUR_COMPUTER_IP:7860`, o ile zmienna `PORT` nie jest ustawiona. Jeśli ustawisz `PORT`, wstaw ten port zamiast `7860`. Zobaczą stronę, która prosi o logowanie. Aby je ustawić, znajdź jednorazowy kod konfiguracji poleceniem `docker logs <container> 2>&1 | grep "setup code"`. Wpisz kod na tej stronie razem z nową nazwą użytkownika i hasłem. Później możesz zmienić logowanie w **Settings → Advanced → Access** w zalogowanej przeglądarce. Jeśli zapomnisz hasła, uruchom `docker exec <container> node scripts/reset-login.mjs`. To nie zmienia logowania z `BASIC_AUTH_USER` i `BASIC_AUTH_PASS`; edytuj je w pliku compose i utwórz kontener ponownie. Możesz też ustawić logowanie w pliku compose za pomocą `BASIC_AUTH_USER` i `BASIC_AUTH_PASS` na liście `environment:`.

W środowiskach Docker Desktop, OrbStack i rootless Docker każde urządzenie, łącznie z twoją przeglądarką, dociera do kontenera z tego samego adresu. Dlatego po ustawieniu logowania ten komputer też o nie prosi, a lista dozwolonych adresów IP nie potrafi odróżnić urządzeń. Ustaw logowanie, zanim usuniesz `127.0.0.1:`. W tych środowiskach otwórz Marinarę na tym komputerze pod adresem `http://localhost:7860` i użyj **Settings** albo ustaw `BASIC_AUTH_USER` i `BASIC_AUTH_PASS` w pliku compose. Nigdy nie usuwaj `127.0.0.1:` bez logowania: w tych środowiskach Marinara nie odróżni innych urządzeń od tego komputera. O tym, jak dopuścić tylko wybrane urządzenia i co robi sekret administratora, przeczytasz w przewodniku [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

## Wybór obrazu: latest, staging czy lite

Marinara Engine publikuje kilka tagów obrazu. Wybierz ten, który pasuje do twoich potrzeb.

- `latest` to zalecane stabilne wydanie. Plik `docker-compose.yml` używa go domyślnie.
- `X.Y.Z` to konkretna wersja, na przykład `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Przydaje się, gdy chcesz zostać przy jednym wydaniu.
- `staging` to niestabilna wersja testowa z najnowszego kodu rozwojowego. Używaj jej tylko po to, żeby sprawdzić niewydane zmiany. Może się psuć, może zmieniać działanie bez zapowiedzi i może uniemożliwić powrót danych do stabilnej wersji.
- `lite` to mniejszy obraz. Opisuje go następna sekcja.

Jeśli uruchamiasz obraz `staging`, użyj osobnego woluminu, żeby niestabilna wersja nie ruszała stabilnych danych:

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### Obraz lite

Obraz lite to mniejszy wariant, który oddaje część funkcji offline w zamian za dużo krótsze pobieranie. Zbudowano go na Wolfi, minimalnej bazie Linuksa przygotowanej pod kontenery.

Obraz lite pomija funkcje wymagające dużych plików lokalnych:

| Usunięte w lite | Co tracisz |
| --- | --- |
| Local Model (Gemma, działa na twoim komputerze) | Nie da się uruchomić modelu AI na własnym sprzęcie. |
| Lokalny model embeddingów | Brak embeddingów tekstu liczonych na urządzeniu. |
| Memory Recall (wyszukiwanie znaczeniowe) | Zależy od lokalnego modelu embeddingów. |
| Lokalne wejście głosowe Whisper | Znika zamiana mowy na tekst w rozmowach w trybie Conversation. |
| Odczytywanie nastroju przez awatary | Awatary 2D i 3D wybierają miny na podstawie listy słów zamiast małego lokalnego modelu rozpoznawania emocji. |

Cała reszta działa tak samo: czat, roleplay, Game Mode, agenci, lorebooki, postacie i połączenia ze zdalnymi dostawcami AI. Żeby korzystać z funkcji AI na obrazie lite, trzeba podłączyć zewnętrznego dostawcę (na przykład OpenRouter, OpenAI albo model hostowany samodzielnie). Zobacz przewodnik [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).

Tag obrazu lite to `ghcr.io/pasta-devs/marinara-engine:lite`, a każde wydanie dostaje też tag lite z numerem wersji, na przykład `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. Aby go uruchomić:

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Część starszych obrazów lite potrafi się wysypać na Raspberry Pi 4 i podobnych komputerach ARM. Awaria pokazuje błąd `SIGILL` (błąd niedozwolonej instrukcji procesora) podczas wychodzących zapytań do dostawcy AI. Na takich urządzeniach uruchom zwykły obraz `latest`. Aktualne szczegóły opisuje przewodnik [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Aktualizacja

Obrazy kontenerów nie aktualizują się same. Nowszy obraz pobiera się ręcznie, a potem restartuje kontener. Najpierw zrób kopię zapasową, żeby móc wrócić dokładnie do obecnego stanu. Zobacz [Kopia zapasowa i przywracanie danych aplikacji Marinara](../data/backup-and-restore.md).

W przypadku Docker Compose wystarczy jedno polecenie:

```bash
docker compose pull && docker compose up -d
```

W przypadku Podman Compose wystarczy jedno polecenie:

```bash
podman compose pull && podman compose up -d
```

Wersję można też sprawdzić w samej aplikacji. Otwórz panel **Settings** (Ustawienia), przejdź do zakładki **Advanced** i znajdź sekcję **Updates**. Kliknij przycisk **Check for Updates**. Przy instalacji w kontenerze Marinara Engine rozpoznaje, że działa w kontenerze Docker, i pokazuje tag obrazu z wydaniem oraz polecenie do uruchomienia na komputerze. Aktualizacji nie da się przeprowadzić z poziomu przeglądarki, więc powyższe polecenie i tak trzeba wykonać samodzielnie.

Żeby wrócić do starszego wydania, wpisz jego tag wersji w wierszu `image:` pliku `docker-compose.yml`, na przykład `ghcr.io/pasta-devs/marinara-engine:2.5.0`, a potem uruchom `docker compose up -d`. Powrót do wersji 2.5.0 działa i czaty otwierają się normalnie, ale wersja 2.5.0 nie zna ustawień ani danych gier dodanych przez nowsze funkcje. Każdy czat lub połączenie zapisane przez wersję 2.5.0 traci te dane, a ponowna aktualizacja ich nie przywraca. Zobacz [Powrót do wersji 2.5.0](../UPGRADING.md#going-back-to-250).

## Podman

Podman uruchamia te same obrazy co Docker. W większości przypadków wystarczy zamienić `docker` na `podman` w poleceniach powyżej.

Uruchomienie przez Compose:

```bash
podman compose up -d
```

Uruchomienie pojedynczego kontenera bez Compose:

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

Polecenie `podman compose` wymaga dodatku `podman-compose`. Zainstaluj go poleceniem właściwym dla twojego systemu.

W systemie Fedora:

```bash
sudo dnf install podman-compose
```

W systemie Debian lub Ubuntu:

```bash
sudo apt install podman-compose
```

Przez pip:

```bash
pip install podman-compose
```

## Samodzielne zbudowanie obrazu

Jeśli wolisz zbudować obraz ze źródeł, zamiast go pobierać:

```bash
docker build -t marinara-engine .
```

Potem uruchom własną wersję:

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Aby zbudować obraz lite ze źródeł, wskaż plik budowania wersji lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Rozwiązywanie problemów

**Strona się nie ładuje albo port jest już zajęty.** Port `7860` może być już zajęty przez inny program. Zmień mapowanie portów na wolny port, na przykład `8080:7860` na liście `ports:`. Potem zrestartuj poleceniem `docker compose up -d` i otwórz `http://127.0.0.1:8080`.

**Marinara Engine nie może zapisywać plików albo pojawiają się błędy uprawnień.** Kontener naprawia uprawnienia do folderu z danymi przy każdym starcie. Działa to dla nazwanych woluminów i dla folderów podmontowanych z komputera. Na niektórych systemach plików naprawa może się nie udać, a pomija ją ustawienie `MARINARA_SKIP_DATA_CHOWN=true`. Jeśli błędy nie znikają, użyj domyślnego nazwanego woluminu `marinara-data`. To najpewniejszy wybór.

**Obraz lite wysypuje się na Raspberry Pi 4.** Zobacz uwagę o obrazie lite powyżej. Na tym sprzęcie użyj zwykłego obrazu `latest`.

Więcej pomocy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Konfiguracja serwera](../CONFIGURATION.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
