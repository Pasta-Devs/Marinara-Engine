# Aktualizacja aplikacji Marinara Engine

Z tego przewodnika dowiesz się, jak zaktualizować aplikację Marinara Engine do nowszej wersji. Opisuje każdy rodzaj instalacji, narzędzia aktualizacji wbudowane w aplikację oraz to, co zrobić, gdy aktualizacja się nie powiedzie. Czaty i ustawienia zostają na miejscu.

## Dane zostają nietknięte

Aktualizacja aplikacji Marinara Engine niczego nie kasuje. Czaty, postacie, persony (postacie, w które się wcielasz), lorebooki (zbiory faktów o twoim świecie), presety (zapisane szablony promptów), połączenia i ustawienia zostają na miejscu.

Marinara trzyma dane w lokalnym folderze z danymi, na tym urządzeniu, które uruchamia serwer. Docker i Podman przechowują je w woluminie `marinara-data`. Aktualizacja podmienia wyłącznie kod aplikacji, a nie ten folder ani wolumin.

Przy aktualizacji z wersji, która miała wbudowanych agentów, mapy, rozmowy i gry trybu Conversation od twórców, pierwsze uruchomienie pobiera odpowiadające im pakiety opcjonalne z oficjalnego katalogu. Wybory dokonane w czatach, ustawienia agentów, zapisane dane oraz historia zostają zachowane. Zadbaj o to, żeby serwer miał wtedy dostęp do sieci. Jeśli katalog jest nieosiągalny, Marinara ponawia migrację przy kolejnym starcie, zamiast kasować lub wyłączać zapisaną konfigurację.

Przy pobranym języku dokumentacji (**Settings** (Ustawienia) → **General** (Ogólne) → **Documentation Language** (język dokumentacji)) pierwsze uruchomienie po aktualizacji sprawdza też, czy dany pakiet językowy się zmienił, i odświeża go automatycznie. Jeśli źródło pobierania jest nieosiągalne, Marinara zostawia zainstalowany pakiet (brakujące w nim przewodniki wyświetlają się po angielsku) i próbuje ponownie przy następnym starcie. Aktualizacja nigdy nie resetuje wyboru języka.

Gdzie leżą dane i jak zapisać ich kopię, opisuje przewodnik [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Najpierw kopia zapasowa

Aktualizacje są bezpieczne, ale kopia zapasowa to tania polisa. Warto ją zrobić przed każdym większym skokiem między wersjami.

1. Otwórz panel **Settings**.
2. Przejdź do zakładki **Advanced** (Zaawansowane).
3. Znajdź sekcję **Backup & Export** (kopia zapasowa i eksport).
4. Kliknij przycisk **Download Backup** (pobranie kopii zapasowej).
5. Zapisz plik `.zip` w bezpiecznym miejscu.

Na czas pracy napis na przycisku zmienia się na **Creating backup…**. Po zakończeniu przeglądarka zapisuje archiwum `.zip` z danymi.

Pełne kroki tworzenia i przywracania kopii zapasowej znajdziesz w przewodniku [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md).

## Aktualizacja według platformy

Wybierz sekcję pasującą do sposobu, w jaki aplikacja Marinara została zainstalowana. "Git checkout" poniżej oznacza kopię zainstalowaną narzędziem Git. "Klon" to pobrana kopia utworzona przez Git.

### Windows

Przy instalatorze dla systemu Windows albo kopii z git checkout launcher aktualizuje wszystko sam.

1. Zamknij aplikację Marinara Engine.
2. Uruchom ją ponownie skrótem z menu Start albo poleceniem `start.bat`.

Launcher pobiera najnowszy kod, doinstalowuje to, co się zmieniło, przebudowuje aplikację i uruchamia nową wersję. Działa to tak samo dla instalatora i dla ręcznego klonu.

Żeby pominąć aktualizację przy jednym uruchomieniu, wpisz `start.bat --skip-update`. Żeby zostać na zainstalowanej wersji Engine na stałe, ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env` projektu. Wyłącza to wyłącznie automatyczne aktualizacje Engine; polecenia ręczne oraz **Settings → Advanced → Check for Updates** działają dalej.

Jeśli launcher zgłasza, że Node.js jest za stary, zainstaluj Node.js 24 LTS i uruchom aplikację Marinara ponownie. LTS to skrót od Long Term Support, czyli zalecane, stabilne wydanie środowiska Node.js.

Inna opcja: pobierz najnowszy instalator ze strony GitHub Releases i uruchom go. Korzysta z tej samej ścieżki opartej na Git, więc kolejne aktualizacje nadal przechodzą przez launcher.

### macOS i Linux

Zamknij aplikację Marinara Engine, a potem uruchom launcher z folderu Marinara.

```bash
./start.sh
```

Launcher pobiera najnowszy kod, doinstalowuje zmienione zależności, przebudowuje aplikację i uruchamia nową wersję.

Użyj `./start.sh --skip-update`, żeby pominąć aktualizację przy jednym uruchomieniu, albo ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env`, żeby wyłączyć ją na stałe. Ręczne polecenia aktualizacji i wbudowane w aplikację przyciski aktualizacji działają dalej.

Jeśli pojawia się komunikat, że Node.js jest za stary, zainstaluj Node.js 24 LTS i uruchom launcher jeszcze raz.

### Docker lub Podman

Instalacje w kontenerze aktualizuje się przez pobranie nowego obrazu, a nie przez launcher. Uruchom to polecenie w folderze, w którym leży plik Compose.

```bash
docker compose down && docker compose pull && docker compose up -d
```

W przypadku narzędzia Podman użyj tych samych poleceń z `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

Obrazy wydań publikowane są jako `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` i `:latest`, razem z odpowiadającymi im tagami `-lite`. Pobieraj `:latest` albo tag najnowszej wersji, chyba że celowo chcesz zostać na starszym wydaniu. Pobranie obrazu nie rusza danych w woluminie `marinara-data`.

### Android (Termux)

Termux to terminal i środowisko Linux na system Android. Jego launcher aktualizuje aplikację Marinara przy każdym uruchomieniu.

1. Otwórz aplikację Termux.
2. Uruchom launcher.

```bash
cd Marinara-Engine
./start-termux.sh
```

Launcher aktualizuje kod, w razie potrzeby podnosi wersję środowiska Node.js, przebudowuje aplikację i uruchamia lokalny serwer.

Jeśli aktualizacja jest wadliwa i trzeba zostać na obecnej kopii, pomiń sprawdzanie aktualizacji.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

Żeby wyłączyć to na stałe, ustaw `AUTO_UPDATE_ENABLED=false` w pliku `.env` projektu. Dotyczy to tylko aktualizacji Engine sterowanych przez launcher; ręczne aktualizacje i wbudowane w aplikację przyciski aktualizacji działają dalej.

Przy korzystaniu z ikony aplikacji na system Android (plik APK) [pobierz najnowszy plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) i otwórz pobrany plik, aby Android zaktualizował samą nakładkę. Następnie otwórz Marinara Engine i dotknij **Install / Start Marinara**, żeby zaktualizować i uruchomić kopię w środowisku Termux. Aplikacja automatycznie zachowuje i wymienia swoje prywatne poświadczenie localhost; aktualizacja nigdy nie prosi o poświadczenia podpisu ani ten sekret.

### iPhone i iPad

Na urządzeniach iPhone i iPad serwer Marinara nie działa. Otwierają one przez Safari serwer uruchomiony na innym urządzeniu. Kopia na ekranie początkowym to PWA, czyli Progressive Web App. PWA to strona internetowa dodana do ekranu początkowego, dzięki czemu otwiera się jak aplikacja.

1. Zaktualizuj komputer, host Docker albo urządzenie z systemem Android, na którym faktycznie działa serwer Marinara. Skorzystaj z sekcji tego urządzenia powyżej.
2. Odśwież PWA na ekranie początkowym albo zakładkę Safari na urządzeniu iPhone lub iPad.

Jeśli Safari po aktualizacji hosta wciąż pokazuje starszą wersję, wyczyść zapisaną kopię.

1. Usuń ikonę z ekranu początkowego.
2. Wyczyść dane witryny w Safari dla hosta Marinara.
3. Dodaj ją do ekranu początkowego jeszcze raz.

## Sprawdzanie i instalowanie aktualizacji w aplikacji

Marinara potrafi sprawdzić w serwisie GitHub, czy jest nowsza wersja, bez wychodzenia z aplikacji. Część instalacji potrafi też zainstalować aktualizację prosto z przeglądarki.

1. Otwórz panel **Settings**.
2. Przejdź do zakładki **Advanced**.
3. Znajdź sekcję **Updates** (aktualizacje).

### Release Channel

Lista rozwijana **Release Channel** (kanał wydań) decyduje o tym, które wersje są śledzone. Ma dwie opcje.

- **Latest Stable**: śledzi wydania oznaczone tagiem `vX.Y.Z`. To normalny wybór dla większości użytkowników.
- **Staging/UAT**: śledzi testowe wersje przedpremierowe. Mogą być niedokończone. Zrób kopię zapasową danych, zanim ich użyjesz.

Wybór opcji **Staging/UAT** wyświetla ostrzeżenie: "Staging builds are pre-release tester builds. Back up your app data before applying them."

Zmiana kanału traktowana jest jak decyzja świadoma. Przy wyborze innego kanału z przeglądarki na urządzeniu, które uruchamia serwer, przycisk aktualizacji zmienia się na **Switch to** z nazwą kanału i działa nawet wtedy, gdy zwykłe aktualizacje w aplikacji są wyłączone. Na czas pracy pokazuje **Switching…**. Zwykłe aktualizacje w obrębie jednego kanału nadal wymagają konfiguracji opisanej niżej w sekcji Apply Update, a urządzenia zdalne wymagają jej zawsze.

### Check for Updates

Kliknij przycisk **Check for Updates** (sprawdzenie aktualizacji). Na czas pracy przycisk pokazuje **Checking…**.

Pod przyciskiem widać wersję **Release** oraz kod commita w polu **Build**. Gdy gałąź jest znana, pojawia się też linia **Branch**.

- Przy aktualnej wersji zielony wiersz z haczykiem informuje "You're on the latest ... target" razem z numerem wersji.
- Jeśli istnieje nowsza wersja, kafelek pokazuje "vX.Y.Z available" i odnośnik **Release notes**.
- Przy instalacji z Git, która jest po prostu w tyle, kafelek pokazuje zamiast tego "N commits behind". Commit to jedna zapisana zmiana w kodzie, więc ta liczba może obejmować pracę jeszcze niewydaną.

Wyniki sprawdzania aktualizacji zapisywane są w pamięci podręcznej. Sprawdzenie wersji wydania trzymane jest tam około 15 minut, a liczba "commits behind" około 5 minut. Ponowne kliknięcie przycisku **Check for Updates** od razu może więc pokazać te same liczby.

### Apply Update

Przycisk **Apply Update** (instalacja aktualizacji) pojawia się tylko wtedy, gdy dana instalacja potrafi zaktualizować się sama z poziomu przeglądarki. Wymaga to obu poniższych warunków.

- Instalacja oparta na Git (instalacje Docker i pakietowe nie potrafią tego zrobić).
- Właściciel serwera ustawił `UPDATES_APPLY_ENABLED=true` w pliku `.env` serwera. Plik `.env` przechowuje ustawienia serwera.

Jeśli klikasz przycisk **Apply Update** na urządzeniu, które uruchamia serwer, to wystarczy. Żaden sekret nie jest tam potrzebny.

Instalowanie aktualizacji z innego urządzenia jest domyślnie wyłączone. Wymaga wszystkich trzech poniższych warunków.

- Właściciel serwera ustawił `UPDATES_ALLOW_REMOTE_APPLY=true` w pliku `.env`.
- Właściciel serwera ustawił `ADMIN_SECRET` (hasło do działań chronionych) w pliku `.env`.
- Ten sam sekret jest zapisany na twoim urządzeniu w **Settings -> Advanced -> Admin Access**.

Po kliknięciu przycisku **Apply Update** napis zmienia się na **Updating...**. Serwer pobiera nowy kod, doinstalowuje zależności, przebudowuje aplikację, a potem się wyłącza. Wtedy pojawia się komunikat: "Update applied successfully. Please relaunch the app to use the new version." Uruchom aplikację Marinara ponownie, żeby dokończyć.

Jeśli przycisk **Apply Update** jest niedostępny, Marinara wyjaśnia dlaczego i co zrobić zamiast tego.

- Instalacje w kontenerze pokazują tag obrazu oraz polecenie `docker compose pull && docker compose up -d` do uruchomienia na hoście.
- Instalacje z Git z wyłączoną instalacją aktualizacji pokazują ręczne polecenie aktualizacji, które można skopiować.
- Pozostałe instalacje pokazują odnośnik **Download** do wydania w serwisie GitHub.

Jeśli samo sprawdzenie się nie powiedzie, zobaczysz komunikat: "Could not check for updates. Try again later." Zwykle oznacza to problem z siecią albo z serwisem GitHub, więc spróbuj za chwilę jeszcze raz.

## Przycisk Refresh App

Przycisk **Refresh App** (odświeżenie aplikacji) znajduje się w tej samej sekcji **Updates**. Nie aktualizuje serwera. Odświeża tylko aplikację w bieżącej przeglądarce.

Przycisk **Refresh App** wyrejestrowuje service workera i czyści pamięć podręczną przeglądarki, a potem przeładowuje stronę. Service worker to mały skrypt, dzięki któremu przeglądarka wczytuje aplikację szybko i offline. Zapisane czaty, ustawienia i pozostałe dane lokalne pozostają nietknięte.

Użyj przycisku **Refresh App**, kiedy aplikacja wygląda na nieodświeżoną albo pokazuje pustą stronę po aktualizacji, choć serwer działa już na nowej wersji. Naprawia to zablokowaną stronę. Nie zmienia kodu serwera, więc nie zastąpi prawdziwej aktualizacji.

Na czas pracy przycisk pokazuje **Refreshing…**, a potem aplikacja przeładowuje się.

## Powrót do starszej wersji

Aktualizacje są zawsze bezpieczne, ale bezpośredni powrót nie zawsze jest możliwy. Nowsze wersje Marinara Engine zapisują wiadomości czatu w nowszym formacie na dysku, którego wersja starsza niż format danych nie potrafi odczytać. Aby chronić historię czatów, program uruchamiający pomija automatyczne aktualizacje prowadzące do niezgodnej wersji, a aktualizator w aplikacji odmawia ich zastosowania.

Jeśli mimo to potrzebujesz starszej wersji, jedno polecenie konwertujące najpierw przywróci stary format danych. Instrukcję znajdziesz w sekcji [Po przejściu na starszą wersję czaty nie pokazują wiadomości](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

## Gdy aktualizacja się nie powiedzie

Większość problemów z aktualizacją bierze się ze starej wersji środowiska Node.js, niepełnego pobierania albo nieodświeżonej pamięci podręcznej przeglądarki.

- Jeśli launcher zgłasza, że Node.js jest za stary, zainstaluj Node.js 24 LTS i uruchom aplikację ponownie.
- Jeśli aplikacja wygląda na zepsutą po aktualizacji serwera, spróbuj użyć opisanego wyżej przycisku **Refresh App**.
- Jeśli instalacja z Git nie potrafi zaktualizować się czysto, uruchom ręczne polecenia aktualizacji dla swojej platformy, podane w odpowiednim przewodniku instalacji.

Komunikaty błędów i rozwiązania krok po kroku znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Kopia zapasowa i przywracanie danych aplikacji Marinara](data/backup-and-restore.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md)
- [Przewodnik instalacji w systemie Windows](installation/windows.md)
- [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md)
- [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md)
- [Przewodnik instalacji na Android (Termux)](installation/android-termux.md)
- [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md)
