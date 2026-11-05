# Przewodnik instalacji na Android (Termux)

Uruchom aplikację Marinara Engine na telefonie lub tablecie z systemem Android. Marinara działa wewnątrz aplikacji Termux. Ta darmowa aplikacja daje telefonowi mały system Linux. Konfigurację da się przeprowadzić przez aplikację Marinara na system Android (najprościej) albo ręcznie w środowisku Termux.

## O środowisku Termux i sklepie F-Droid

Marinara to serwer linuksowy, a nie natywna aplikacja na system Android, więc do działania potrzebuje aplikacji Termux. F-Droid to darmowy sklep z aplikacjami o otwartym kodzie źródłowym. Konfiguracja w aplikacji na system Android pobiera stabilną wersję aplikacji Termux ze sklepu F-Droid. Termux ma też eksperymentalną wersję w sklepie Google Play. Jeśli jest już zainstalowana, Marinara ją akceptuje, ale ten przewodnik zaleca sklep F-Droid.

Zainstaluj aplikację Termux ze strony [Termux w sklepie F-Droid](https://f-droid.org/en/packages/com.termux/). Nie mieszaj aplikacji Termux ani jej aplikacji dodatkowych z różnych źródeł, ponieważ ich podpisy muszą być zgodne. Zobacz [oficjalne uwagi instalacyjne projektu Termux](https://github.com/termux/termux-app#installation).

## Instalacja przez aplikację na system Android

Aplikacja Marinara Engine na system Android konfiguruje środowisko Termux, a potem, gdy lokalny serwer już działa, otwiera aplikację Marinara Engine. Po drodze Android prosi o zatwierdzenie kilku komunikatów systemowych.

1. Dotknij [Pobierz najnowszy plik APK dla Androida](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). APK to plik instalacyjny aplikacji na system Android.
2. Zainstaluj plik APK, a potem otwórz aplikację.
3. Dotknij przycisku **Install / Start Marinara** (instalacja i uruchomienie).
4. Jeśli aplikacja Termux nie jest zainstalowana, zatwierdź komunikaty instalacyjne systemu Android, w tym pozwolenie na instalowanie aplikacji przez tę aplikację, żeby mogła zainstalować aplikację Termux ze sklepu F-Droid.
5. Kiedy Android zapyta, przyznaj uprawnienie **Run commands in Termux environment** (uruchamianie poleceń w środowisku Termux).
6. Jeśli Termux zablokuje konfigurację, aplikacja skopiuje polecenie `allow-external-apps` i otworzy aplikację Termux. Naciśnij i przytrzymaj ekran aplikacji Termux, dotknij **Paste** (wklej), naciśnij Enter, a potem wróć i znów dotknij przycisku **Install / Start Marinara**.
7. Poczekaj, aż Termux zainstaluje zależności (elementy potrzebne aplikacji) i zbuduje aplikację Marinara Engine. Termux wyświetla przewijający się tekst. Pierwsze budowanie trwa kilka minut.
8. Gdy Termux skończy, wróć do aplikacji Marinara Engine. Kiedy serwer będzie gotowy, aplikacja sama się połączy i zaloguje, a ty zobaczysz ekran główny aplikacji Marinara Engine.

Żeby zamiast tego korzystać z przeglądarki, wybierz **Open in browser** (otwórz w przeglądarce) na ekranie uruchamiania aplikacji. Aplikacja zapamiętuje wybór, a logowanie w przeglądarce też odbywa się automatycznie.

Jeśli to nie zadziałało: rozwiąż problem z komunikatem, który zablokował instalację, i znów dotknij **Install / Start Marinara**. Jeśli aplikacja nie może otworzyć adresu localhost, zaktualizuj plik APK i dotknij **Install / Start Marinara**. Zobacz [Pomoc z logowaniem do localhost na Androidzie](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

Aplikacja nie wymaga klucza podpisu, hasła ani zmiany `CSRF_TRUSTED_ORIGINS`. Sama tworzy własne prywatne poświadczenie localhost. Nie dodawaj `null` do `CSRF_TRUSTED_ORIGINS`.

## Ręczna instalacja w środowisku Termux

Wybierz tę drogę, jeśli nie chcesz korzystać z aplikacji. Otwórz aplikację Termux, a potem naciśnij i przytrzymaj ekran i dotknij **Paste**, żeby wkleić to polecenie (skopiuj je w całości):

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Po kolei to polecenie:

1. Aktualizuje wszystkie pakiety środowiska Termux. Nowsza wersja Node.js nie uruchomi się ze starszymi bibliotekami środowiska Termux, więc środowisko trzeba zaktualizować w całości. Jeśli polecenie zapyta, czy zachować plik konfiguracyjny, naciśnij Enter, żeby zachować swój.
2. Instaluje Git i Node.js. Marinara obsługuje Node.js w wersjach 24, 25 i 26.
3. Pobiera aplikację Marinara Engine, o ile nie ma jej już na urządzeniu.
4. Nadaje programowi uruchamiającemu (`start-termux.sh`) uprawnienia do uruchamiania i go uruchamia.

Program uruchamiający instaluje zależności, buduje aplikację Marinara Engine na twoim urządzeniu i uruchamia lokalny serwer. Jeśli twoja wersja Node.js jest za stara, aktualizuje ją. Pierwsze uruchomienie jest wolne, a Termux wyświetla przewijający się tekst. Kolejne uruchomienia są szybsze.

Gdy program uruchamiający poinformuje, że serwer działa, otwórz ten adres w przeglądarce na urządzeniu z systemem Android:

```text
http://127.0.0.1:7860
```

Jeśli masz ustawiony inny `PORT`, użyj tego numeru. Żeby dostać ikonę przypominającą aplikację, użyj opcji w menu przeglądarki, która dodaje stronę do ekranu głównego. Jej nazwa różni się w zależności od przeglądarki.

## Uruchamianie i zatrzymywanie aplikacji Marinara Engine

Przy instalacji przez aplikację otwórz ją i dotknij **Install / Start Marinara**, jeśli serwer jest zatrzymany. Żeby przełączać się między aplikacją a przeglądarką, użyj **Open in browser** na ekranie uruchamiania, a potem **Retry connection** (ponów połączenie). Z wnętrza aplikacji wrócisz na ekran uruchamiania przez **Settings → General → App Behavior → Open Android launcher (app or browser)** (ustawienia, ogólne, zachowanie aplikacji, otwórz ekran uruchamiania Android: aplikacja lub przeglądarka).

Przy ręcznej instalacji otwórz aplikację Termux i uruchom:

```bash
cd Marinara-Engine
./start-termux.sh
```

Żeby zatrzymać serwer, naciśnij <kbd>Ctrl</kbd>+<kbd>C</kbd> w aplikacji Termux.

## Aktualizowanie aplikacji Marinara Engine

Przy każdym uruchomieniu `./start-termux.sh` program uruchamiający sprawdza w serwisie GitHub, czy jest nowsza wersja, i aktualizuje aplikację przed startem. Żeby uruchomić aplikację bez aktualizacji, dodaj `--skip-update`. Więcej opcji i kroki aktualizacji pliku APK znajdziesz w dokumencie [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md#android-termux).

Podczas aktualizacji program uruchamiający usuwa też nieużywane pakiety z lokalnej pamięci podręcznej pnpm. Dzięki temu stare wydania nie zajmują kilku gigabajtów miejsca. Program nie rusza przy tym twoich czatów ani ustawień.

## Otwieranie aplikacji Marinara Engine z innego urządzenia

Program uruchamiający pozwala innym urządzeniom w twojej sieci Wi-Fi łączyć się z aplikacją Marinara Engine, ale blokuje je, dopóki nie ustawisz logowania. Zobacz [Najczęściej zadawane pytania](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) i [Dostęp zdalny](../REMOTE_ACCESS.md).

Jeśli inne urządzenie nie może się zalogować po aktualizacji, zobacz [Zablokowany dostęp po aktualizacji](../REMOTE_ACCESS.md#locked-out-after-updating). W aplikacji Termux to polecenie usuwa logowanie do aplikacji i wylogowuje wszystkie przeglądarki:

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Przewodnik po PWA na iOS / iPadOS](ios-pwa.md)
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md)
- [Najczęściej zadawane pytania](../FAQ.md)
