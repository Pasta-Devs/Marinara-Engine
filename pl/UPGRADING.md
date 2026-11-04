# Aktualizacja aplikacji Marinara Engine

Zaktualizuj aplikację Marinara Engine do nowszej wersji, sprawdzaj dostępność aktualizacji w samej aplikacji i wróć do starszej wersji, gdy coś się zepsuje. Czaty i ustawienia zostają zachowane przy aktualizacji.

## Którą metodę aktualizacji wybrać?

| Sposób instalacji | Sposób aktualizacji |
| --- | --- |
| Instalator dla systemu Windows lub `start.bat` | Zamknij aplikację Marinara i otwórz ją ponownie. Zobacz [Windows](#windows). |
| macOS lub Linux | Uruchom ponownie `./start.sh`. Zobacz [macOS i Linux](#macos-and-linux). |
| Docker lub Podman | Pobierz nowy obraz i uruchom kontener ponownie. Zobacz [Docker lub Podman](#docker-or-podman). |
| Aplikacja na system Android | Zaktualizuj plik APK, a potem dotknij **Install / Start Marinara**. Zobacz [Android (Termux)](#android-termux). |
| iPhone lub iPad | Zaktualizuj urządzenie, na którym działa serwer. Zobacz [iPhone i iPad](#iphone-and-ipad). |

<a id="back-up-first"></a>

## Najpierw kopia zapasowa

Zrób kopię zapasową przed każdym większym skokiem między wersjami i zawsze przed ewentualnym powrotem do starszej wersji.

1. Otwórz panel **Settings** (Ustawienia).
2. Przejdź do zakładki **Advanced** (Zaawansowane).
3. Znajdź sekcję **Backup & Export** (kopia zapasowa i eksport).
4. Kliknij przycisk **Download Backup** (pobranie kopii zapasowej).
5. Zapisz plik `.zip` w bezpiecznym miejscu.

Na czas pracy przycisk pokazuje **Creating backup…**. Po zakończeniu przeglądarka zapisuje archiwum `.zip` z danymi. Przywracanie opisuje przewodnik [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Aktualizacja według platformy

Wybierz sekcję pasującą do sposobu, w jaki aplikacja Marinara została zainstalowana. Kopia Git to kopia zainstalowana narzędziem Git. Obejmuje to instalację z instalatora dla systemu Windows i każdą kopię utworzoną poleceniem `git clone`.

### Windows

Program uruchamiający aktualizuje aplikację Marinara, gdy ją uruchamiasz.

1. Zamknij aplikację Marinara Engine.
2. Otwórz ją ponownie skrótem na pulpicie lub w menu Start albo uruchom `start.bat`.

Program uruchamiający pobiera najnowszy kod, doinstalowuje to, co się zmieniło, przebudowuje aplikację i uruchamia nową wersję. Jeśli w kodzie są twoje własne zmiany, odkłada je na bok i po aktualizacji przywraca na miejsce. Jeśli to się nie uda, zostawia obecną wersję i wypisuje informację. Przed aktualizacją kopiuje dane, a aktualizację, która prowadziłaby do wersji starszej niż twoje dane, pomija (zobacz [Powrót do starszej wersji](#downgrading-to-an-older-version)).

Żeby jednorazowo pominąć aktualizację, uruchom `start.bat --skip-update`. Żeby zostać na zainstalowanej wersji przy kolejnych uruchomieniach, ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env` projektu. Wyłącza to tylko automatyczne aktualizacje. Polecenia ręczne i **Settings → Advanced → Check for Updates** (ustawienia, zaawansowane, sprawdzenie aktualizacji) działają dalej.

Jeśli program uruchamiający zgłasza, że Node.js jest za stary, zainstaluj Node.js 24 LTS (Long Term Support, czyli zalecane stabilne wydanie) i uruchom aplikację Marinara ponownie. Możesz też pobrać najnowszy instalator ze strony GitHub Releases i go uruchomić.

<a id="macos-and-linux"></a>

### macOS i Linux

1. Zamknij aplikację Marinara Engine.
2. Uruchom program uruchamiający z folderu aplikacji Marinara.

```bash
./start.sh
```

Program uruchamiający pobiera najnowszy kod, doinstalowuje zmienione zależności, przebudowuje aplikację i uruchamia nową wersję. Użyj `./start.sh --skip-update`, żeby jednorazowo pominąć aktualizację, albo ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env`, żeby wyłączyć automatyczne aktualizacje. Jeśli Node.js jest za stary, zainstaluj Node.js 24 LTS i jeszcze raz uruchom program uruchamiający.

<a id="docker-or-podman"></a>

### Docker lub Podman

Kontenery aktualizuje się przez pobranie nowego obrazu, a nie przez program uruchamiający. Zrób kopię zapasową, a potem uruchom to polecenie w folderze, w którym leży plik Compose.

```bash
docker compose pull && docker compose up -d
```

W przypadku narzędzia Podman użyj zamiast tego `podman compose`. Obrazy wydań to `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` i `:latest` oraz odpowiadające im tagi `-lite`. Pobranie obrazu nie rusza danych w woluminie `marinara-data`. Zobacz [Uruchamianie w kontenerze](installation/containers.md).

### Android (Termux)

Termux to aplikacja na system Android, w której działa mały system Linux dla aplikacji Marinara. Program uruchamiający w środowisku Termux aktualizuje aplikację Marinara przy każdym uruchomieniu.

1. Otwórz aplikację Termux.
2. Uruchom program uruchamiający.

```bash
cd Marinara-Engine
./start-termux.sh
```

Program uruchamiający aktualizuje kod, w razie potrzeby podnosi wersję środowiska Node.js, przebudowuje aplikację i uruchamia serwer. Jeśli aktualizacja coś psuje i chcesz zostać na obecnej kopii, dodaj `--skip-update`. Żeby wyłączyć automatyczne aktualizacje, ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env` projektu.

Jeśli korzystasz z aplikacji na system Android (plik APK), [pobierz najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) i otwórz go, żeby Android zaktualizował aplikację. Następnie otwórz aplikację Marinara Engine i dotknij **Install / Start Marinara**, żeby zaktualizować i uruchomić kopię w środowisku Termux. Aktualizacja nigdy nie prosi o poświadczenia podpisu ani o sekret.

<a id="iphone-and-ipad"></a>

### iPhone i iPad

Na tych urządzeniach serwer nie działa. Ikona na ekranie głównym to PWA, czyli strona internetowa zapisana na ekranie głównym, która otwiera się jak aplikacja.

1. Zaktualizuj komputer, host kontenera albo urządzenie z systemem Android, na którym działa serwer Marinara. Skorzystaj z odpowiedniej sekcji powyżej.
2. Odśwież aplikację z ekranu głównego albo kartę w przeglądarce Safari.

Jeśli Safari wciąż pokazuje starszą wersję, zainstaluj PWA ponownie. Zobacz [Czyszczenie i ponowna instalacja aplikacji PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

<a id="manual-update-git-copy-no-launcher"></a>

### Ręczna aktualizacja (kopia Git, bez programu uruchamiającego)

Użyj tej metody, jeśli uruchamiasz kopię Git poleceniem `pnpm start` zamiast programem uruchamiającym. Wpisuj te polecenia w folderze aplikacji Marinara.

1. Pobierz najnowszy kod stabilny.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Przejdź na niego.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Zainstaluj ponownie zależności, przebuduj aplikację i ją uruchom.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

W przypadku wersji testowej (staging) uruchom te dwa polecenia zamiast kroków 1 i 2:

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Ostrzeżenie:** Wersje staging to przedpremierowe wersje testowe. Zanim ich użyjesz, zrób kopię zapasową danych.

## Aktualizacja z poziomu aplikacji

Marinara potrafi sprawdzić w serwisie GitHub, czy jest nowsza wersja. Część instalacji potrafi też wgrać aktualizację prosto z przeglądarki.

1. Otwórz panel **Settings**.
2. Przejdź do zakładki **Advanced**.
3. Znajdź sekcję **Updates** (aktualizacje).

### Wybór kanału wydań

Lista rozwijana **Release Channel** (kanał wydań) określa, które wersje śledzisz.

- **Latest Stable**: wydania oznaczone tagiem `vX.Y.Z`. To normalny wybór.
- **Staging/UAT**: przedpremierowe wersje testowe, które mogą być niedokończone. Wybór tej opcji wyświetla ostrzeżenie "Staging builds are pre-release tester builds. Back up your app data before applying them."

Gdy wybierzesz inny kanał w przeglądarce na komputerze, na którym działa serwer, przycisk aktualizacji zmienia napis na **Switch to** (przełącz na) z nazwą kanału. Działa nawet wtedy, gdy zwykłe aktualizacje w aplikacji są wyłączone, a na czas pracy pokazuje **Switching…**. Urządzenia zdalne nie mogą tego zrobić, chyba że spełniają opisane niżej warunki przycisku **Apply Update**.

### Check for Updates

Kliknij przycisk **Check for Updates**. Na czas pracy przycisk pokazuje **Checking…**. Pod nim widać pola **Release** (wydanie) z twoją wersją, **Build** (kompilacja) z kodem commita oraz, jeśli jest znana, **Branch** (gałąź).

- Jeśli masz aktualną wersję, zielony wiersz informuje "You're on the latest" razem z numerem wersji.
- Jeśli istnieje nowsze wydanie, kafelek pokazuje "vX.Y.Z available" i odnośnik **Release notes** (informacje o wydaniu).
- Jeśli kopia Git jest w tyle, kafelek pokazuje "N commits behind". Commit to jedna zapisana zmiana w kodzie, więc ta liczba może obejmować pracę jeszcze niewydaną.

Wynik sprawdzania wydań jest trzymany w pamięci podręcznej przez około 15 minut, a liczba commitów przez około 5 minut, więc ponowne kliknięcie od razu może pokazać te same liczby.

Jeśli sprawdzanie się nie powiedzie, zobaczysz komunikat "Could not check for updates. Try again later." Zwykle oznacza to problem z siecią albo z serwisem GitHub.

### Apply Update

Przycisk **Apply Update** (wgranie aktualizacji) aktualizuje kopię Git z poziomu przeglądarki. Pojawia się tylko wtedy, gdy spełnione są wszystkie te warunki:

- Instalacja jest kopią Git. Kontenery i inne instalacje nie mogą wgrywać aktualizacji w ten sposób.
- Gałąź to `main`, `master` lub `staging` albo kopia repozytorium jest odłączona (detached). Kopia na każdej innej gałęzi liczy się jako deweloperska kopia repozytorium i Marinara odmawia.
- Właściciel serwera ustawił `UPDATES_APPLY_ENABLED=true` w pliku `.env` serwera.
- Zmienna `UPDATES_APPLY_DISABLED` nie jest ustawiona. Blokuje ona każde wgranie aktualizacji, łącznie ze zmianą kanału, a ustawiają ją programy uruchamiające dla deweloperów.

Do wgrania aktualizacji z komputera, na którym działa serwer, sekret administratora nie jest potrzebny. Otwórz aplikację Marinara pod adresem `http://127.0.0.1:7860` albo `http://localhost:7860`.

Zmieniają to dwa ustawienia:

- Adres udostępniany przez odwrotne proxy lub tunel liczy się jako inne urządzenie. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` sprawia, że tacy goście liczą się jako lokalni, również przy lokalnym pominięciu sekretu administratora. Przy publicznym proxy lub tunelu zostaw to ustawienie włączone.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` sprawia, że sekretu wymagają nawet żądania lokalne.

Wgrywanie aktualizacji z innego urządzenia jest domyślnie wyłączone. Wymaga wszystkich trzech warunków:

- `UPDATES_ALLOW_REMOTE_APPLY=true` w pliku `.env` serwera.
- `ADMIN_SECRET` ustawiony w pliku `.env` serwera. To drugie hasło do ryzykownych działań.
- Ten sam sekret zapisany na twoim urządzeniu w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny).

Kliknij **Apply Update**. Gdy serwer pobiera kod, doinstalowuje zależności, przebudowuje aplikację i się wyłącza, przycisk pokazuje **Updating…**. Potem pojawia się komunikat "Update applied successfully. Please relaunch the app to use the new version." Uruchom aplikację Marinara ponownie, żeby dokończyć.

Jeśli to nie zadziałało: gdy przycisku **Apply Update** brakuje, Marinara pokazuje dlaczego.

- Instalacje w kontenerze pokazują tag obrazu oraz polecenie `docker compose pull && docker compose up -d` do uruchomienia na hoście.
- Kopie Git z wyłączonym wgrywaniem aktualizacji pokazują ręczne polecenie, które można skopiować.
- Pozostałe instalacje pokazują odnośnik **Download** (pobranie) do wydania w serwisie GitHub.

## Odświeżenie aplikacji w przeglądarce

Przycisk **Refresh App** (odświeżenie aplikacji) znajduje się w tej samej sekcji **Updates**. Nie aktualizuje serwera. Usuwa service workera (mały skrypt, dzięki któremu przeglądarka szybko wczytuje aplikację) i czyści pamięć podręczną przeglądarki, a potem przeładowuje stronę. Czaty i ustawienia zostają.

Użyj go, gdy aplikacja wygląda na starą albo pokazuje pustą stronę, choć serwer jest już zaktualizowany. Na czas pracy przycisk pokazuje **Refreshing…**.

## Twoje dane i opcjonalne pobieranie

Aktualizacja podmienia kod aplikacji, a nie folder z danymi ani wolumin `marinara-data`. Czaty, postacie, persony, lorebooki, presety, połączenia i ustawienia zostają na miejscu. Gdzie leżą dane, opisuje przewodnik [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

- **Pakiety opcjonalne.** Przy aktualizacji z wersji, która miała wbudowanych agentów, mapy, rozmowy i gry trybu Conversation od twórców aplikacji, pierwsze uruchomienie pobiera odpowiadające im pakiety opcjonalne. Wybory, ustawienia i historia zostają zachowane. Zadbaj o to, żeby przy tym pierwszym uruchomieniu serwer miał dostęp do sieci. Jeśli źródło pobierania jest nieosiągalne, Marinara próbuje ponownie przy kolejnym starcie i niczego nie usuwa.
- **Język przewodników.** Jeśli korzystasz z pobranego języka dokumentacji (**Settings → General → Documentation Language** (ustawienia, ogólne, język dokumentacji)), pierwsze uruchomienie po aktualizacji go odświeża. Jeśli źródło jest nieosiągalne, Marinara zostawia zainstalowany pakiet, brakujące przewodniki pokazuje po angielsku i próbuje ponownie przy następnym starcie.
- **Język interfejsu.** Pakiety językowe interfejsu pobiera się osobno i ręcznie. Przy pierwszej aktualizacji z wersji z wbudowanymi tłumaczeniami interfejs wraca do języka angielskiego. Wybierz ponownie swój język w **Settings → General → Language** (ustawienia, ogólne, język). Kolejne aktualizacje zachowują pobrane pakiety. Użyj **Refresh language pack** (odśwież pakiet językowy), żeby pobrać nowe tłumaczenia. Brakujące tłumaczenia pokazują się po angielsku.

## Aktualizacja z wersji 2.5.0

Powyższe kroki są takie same. Kilka zmian dotyczy serwera, z którego korzystają inne urządzenia lub inne osoby. Jeśli to twój przypadek, rozwiń szczegóły.

<details>
<summary>Zmiany dla współdzielonych serwerów</summary>

- **Odwrotne proxy albo tunel na tym samym komputerze.** Goście, których nginx, Caddy, Cloudflare Tunnel, Tailscale Serve lub ngrok przekazują do aplikacji Marinara, liczą się teraz jako zdalni. Bez logowania widzą stronę konfiguracji, a kopie zapasowe i inne chronione działania wymagają sekretu administratora. Zobacz [Odwrotne proxy i tunele na tym samym komputerze](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Pominięcie logowania w Tailscale.** Bezpośrednie połączenia z adresem Tailscale tego komputera nadal pomijają logowanie. Pozostałe połączenia z `100.64.0.0/10` już go nie pomijają, a odwiedzający przez Tailscale Serve i Funnel muszą się zalogować. Zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker z hasłem albo listą dozwolonych adresów.** Gdy ustawiono logowanie (logowanie w aplikacji albo Basic Auth), o logowanie prosi teraz także przeglądarka na komputerze-hoście. To samo dzieje się przy `TRUSTED_AUTH_PROXY`, chyba że łączy się właśnie to proxy. Przy samym `IP_ALLOWLIST` przeglądarka na hoście jest odrzucana, chyba że dopiszesz do listy bramę kontenera, więc użyj logowania. Zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Czaty i profile przeniesione do innej instalacji.** Zapis czatu, profil ustawień ani pełny profil nie przenoszą już do innej instalacji wartości **Discord Mirror**, **DeepLX URL** (adres DeepLX), **DeepL API Key** (klucz API DeepL) ani **Intiface URL** (adres Intiface). Wpisz je tam ponownie. Twoje własne profile oraz pełny profil przywrócony w tej samej instalacji je zachowują.
- **Zablokowany dostęp po aktualizacji?** Zobacz [Zablokowany dostęp po aktualizacji](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

<a id="downgrading-to-an-older-version"></a>

## Powrót do starszej wersji

Powrót nie zawsze jest możliwy. Nowsze wersje zapisują dane w nowszym formacie przechowywania, a kompilacja odrzuca dane w formacie nowszym niż te, które zna. Obecne kompilacje używają formatu przechowywania 10. Formaty 8, 9 i 10 dodały awatary MMD, powiązania połączeń z kontami oraz awatary GLB/FBX. Kompilacja, która zna tylko starszy format, nie otworzy zapisanych w nich danych.

Program uruchamiający pomija automatyczną aktualizację, która prowadziłaby do niezgodnej wersji, a aktualizator w aplikacji odmawia jej wgrania. Żeby wrócić do starszej kompilacji, zatrzymaj aplikację Marinara i przywróć pełną kopię zapasową wykonaną przed aktualizacją. Opisane niżej polecenie konwertujące pliki czatu nie potrafi przekształcić ustawień awatarów MMD. Nie zmieniaj ręcznie numeru formatu.

Jeśli twoje dane są starsze niż format przechowywania 8, jedno polecenie konwersji może przywrócić plikom czatu poprzedni układ. Zobacz [Po przejściu na starszą wersję czaty nie pokazują wiadomości](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

<a id="going-back-to-250"></a>

### Powrót do wersji 2.5.0

Wersja 2.5.0 nie otwiera danych zaktualizowanych do formatu przechowywania 8 lub nowszego. Użyj kopii zapasowej sprzed aktualizacji.

W przypadku starszych danych, które wersja 2.5.0 potrafi otworzyć, nie zna ona tego, co dodały nowsze funkcje: części ustawień połączeń, szczegółów potrzebnych do ponownego generowania obrazów w czacie oraz części punktów kontrolnych gry, zegarów zestawów zasad i wideo ze scen. Gdy wersja 2.5.0 zapisuje czat lub połączenie, na przykład gdy wysyłasz wiadomość, rozgrywasz turę gry, tworzysz obraz albo zmieniasz połączenie, usuwa te nowsze dane z całego czatu lub połączenia. Ponowna aktualizacja ich nie przywraca.

Żeby móc wrócić dokładnie do obecnego stanu, zrób kopię zapasową przed aktualizacją. Zobacz [Najpierw kopia zapasowa](#back-up-first).

## Gdy aktualizacja się nie powiedzie

Większość niepowodzeń bierze się ze starej wersji środowiska Node.js, niepełnego pobierania albo nieaktualnej pamięci podręcznej przeglądarki.

- Jeśli program uruchamiający zgłasza, że Node.js jest za stary, zainstaluj Node.js 24 LTS i uruchom aplikację ponownie.
- Jeśli aplikacja wygląda na zepsutą po aktualizacji serwera, kliknij **Refresh App**.
- Jeśli kopia Git nie potrafi zaktualizować się czysto, użyj poleceń [ręcznej aktualizacji](#manual-update-git-copy-no-launcher).

Komunikaty błędów i rozwiązania znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md)
- [Przewodnik instalacji w systemie Windows](installation/windows.md)
- [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md)
- [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md)
- [Przewodnik instalacji na Android (Termux)](installation/android-termux.md)
- [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md)
