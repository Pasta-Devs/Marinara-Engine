# Przewodnik instalacji na Android (Termux)

Z tego przewodnika dowiesz się, jak uruchomić Marinara Engine na telefonie lub tablecie z systemem Android. Marinara działa w aplikacji Termux, czyli w darmowym środowisku Linux dla systemu Android. Konfigurację da się przeprowadzić łatwiej, przez aplikację na Android, albo ręcznie w terminalu Termux.

## Czym są Termux i F-Droid

Termux to darmowa aplikacja, która daje telefonowi mały system Linux i wiersz poleceń. Marinara Engine tego potrzebuje, bo Marinara jest serwerem linuksowym, a nie natywną aplikacją na Android.

F-Droid to darmowy sklep z aplikacjami dla systemu Android o otwartym kodzie źródłowym. Automatyczna konfiguracja Marinara pobiera stabilną wersję Termux z F-Droid. Termux ma też osobną eksperymentalną wersję w Google Play; jeśli jest już zainstalowana, Marinara rozpozna jej oficjalny podpis, ale w tym przewodniku nadal zalecamy F-Droid.

Aplikację Termux zainstaluj stąd: [Termux w sklepie F-Droid](https://f-droid.org/en/packages/com.termux/). Nie mieszaj aplikacji Termux ani jej dodatków z różnych źródeł, ponieważ ich podpisy muszą być zgodne. Szczegóły dla poszczególnych źródeł opisują [oficjalne uwagi instalacyjne Termux](https://github.com/termux/termux-app#installation).

## Instalacja przez aplikację na Android (APK)

Najprostsza droga prowadzi przez aplikację Marinara Engine na Android. APK to plik instalacyjny aplikacji dla systemu Android. Ta aplikacja jest małym pomocnikiem: konfiguruje za ciebie Termux, a potem otwiera Marinara, kiedy lokalny serwer już działa. Prawdziwą robotę i tak wykonuje Termux, więc Android poprosi o zatwierdzenie kilku komunikatów systemowych. Instalacja gotowego pliku APK nie wymaga klucza podpisu, hasła, sekretu dostępu lokalnego ani zmiany `CSRF_TRUSTED_ORIGINS`. Aplikacja automatycznie tworzy i wymienia prywatne poświadczenie localhost. Nie dodawaj `null` do `CSRF_TRUSTED_ORIGINS`; jest celowo traktowane jak brak wartości i uzgadnianie APK go nie potrzebuje.

1. Dotknij [Pobierz najnowszy plik APK dla Androida](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Zainstaluj plik APK, a potem otwórz aplikację.
3. Dotknij przycisku **Install / Start Marinara** (instalacja i uruchomienie).
4. Jeśli Termux nie jest jeszcze zainstalowany, zatwierdź komunikaty instalacyjne systemu Android, żeby aplikacja mogła pobrać i zainstalować Termux z F-Droid.
5. Kiedy Android zapyta, przyznaj uprawnienie **Run commands in Termux environment** (uruchamianie poleceń w środowisku Termux).
6. Jeśli Termux zablokuje konfigurację, aplikacja skopiuje za ciebie polecenie `allow-external-apps`. Wklej je raz do terminala Termux, a potem znów dotknij przycisku **Install / Start Marinara**.
7. Poczekaj, aż Termux zainstaluje zależności i zbuduje aplikację Marinara Engine. Pierwsze budowanie trwa kilka minut.
8. Po zakończeniu pracy Termux wróć do aplikacji Marinara Engine. Aplikacja połączy się i zaloguje automatycznie, gdy lokalny serwer będzie gotowy.

Jeśli wygodniejsza jest ikona na ekranie głównym, która otwiera Marinara jak zwykłą aplikację, ta sama aplikacja na Android to zapewnia. Jest nakładką na serwer w środowisku Termux, więc najpierw trzeba skonfigurować sam serwer. Nie da się przy tym pominąć systemowych komunikatów instalacyjnych ani pytań o uprawnienia, ale aplikacja nie prosi o konfigurowanie żadnego sekretu instalacyjnego Marinara.

## Ręczna instalacja w środowisku Termux

Marinara da się też zainstalować ręcznie, bez tej aplikacji. Otwórz Termux i wklej to jedno polecenie:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

To jedno polecenie robi pięć rzeczy:

1. Aktualizuje pakiety środowiska Termux.
2. Instaluje Git i Node.js. Marinara obsługuje Node.js w wersjach 24, 25 i 26.
3. Pobiera Marinara Engine, o ile aplikacja nie jest już zainstalowana.
4. Nadaje uprawnienia do uruchamiania programowi startowemu (skrypt `start-termux.sh`).
5. Uruchamia program startowy po raz pierwszy.

Program startowy instaluje zależności aplikacji, buduje Marinara na urządzeniu i uruchamia lokalny serwer. Aktualizuje też Node.js, jeśli zainstalowana wersja jest za stara. Pierwsze uruchomienie jest wolne, bo aplikacja się buduje. Kolejne idą znacznie szybciej.

Po zakończeniu otwórz ten adres w przeglądarce na urządzeniu z systemem Android:

```
http://127.0.0.1:7860
```

Marinara nasłuchuje na porcie ustawionym przez `PORT` (port sieciowy, którego używa aplikacja). Domyślnie jest to 7860. Przy innej wartości `PORT` wpisz odpowiedni numer.

Wskazówka: żeby dostać ikonę przypominającą aplikację, otwórz menu przeglądarki i wybierz opcję dodania aplikacji Marinara Engine do ekranu głównego. Nazwa tej opcji jest inna w każdej przeglądarce.

## Ponowne uruchamianie aplikacji Marinara Engine

Po pierwszej konfiguracji instalacji już się nie powtarza. Otwórz Termux i uruchom:

```
cd Marinara-Engine
./start-termux.sh
```

Program startowy sprawdza aktualizacje, a potem uruchamia Marinara. Żeby uruchomić bieżącą kopię bez sprawdzania serwisu GitHub, dodaj `--skip-update`:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

Podczas aktualizacji zależności program startowy usuwa też nieużywane pakiety z lokalnej pamięci podręcznej pnpm. Dzięki temu stare wydania nie zajmują z czasem kilku gigabajtów na telefonie; czaty, ustawienia i inne dane użytkownika pozostają nietknięte.

## Dostęp z innego urządzenia

Domyślnie program startowy udostępnia Marinara w sieci lokalnej. Aplikację można więc otworzyć na laptopie albo innym telefonie podłączonym do tej samej sieci Wi-Fi. Instrukcję krok po kroku, jak znaleźć właściwy adres, znajdziesz w dokumencie [Najczęściej zadawane pytania](../FAQ.md).

## Aktualizowanie

Przy każdym uruchomieniu programu startowego (`./start-termux.sh`) sprawdza on w serwisie GitHub, czy jest nowsza wersja, i aktualizuje ją jeszcze przed startem. Najprostszy sposób na bycie na bieżąco to więc zwyczajne uruchamianie aplikacji Marinara Engine.

Żeby uruchomić zainstalowaną kopię bez aktualizacji, użyj flagi pomijającej:

```
./start-termux.sh --skip-update
```

Żeby zachować zainstalowaną wersję silnika między uruchomieniami, dodaj `AUTO_UPDATE_ENABLED=false` do pliku `.env` w projekcie. Nie wyłącza to ręcznych poleceń aktualizacji ani sekcji **Settings → Advanced → Updates**.

Aktualizacje da się też sprawdzić w samej aplikacji. Otwórz **Settings** (Ustawienia), przejdź do zakładki **Advanced** i otwórz sekcję **Updates**. Kliknij przycisk **Check for Updates**, żeby zobaczyć, czy jest nowsze wydanie. Przycisk **Apply Update** w aplikacji jest domyślnie wyłączony i wymaga konfiguracji. O tym, jak go włączyć i używać, przeczytasz w dokumencie [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md).

## Powiązane przewodniki

- [Instalacja aplikacji Marinara Engine](../INSTALLATION.md)
- [Przewodnik po PWA na iOS / iPadOS](ios-pwa.md)
- [Aktualizacja aplikacji Marinara Engine](../UPGRADING.md)
- [Najczęściej zadawane pytania](../FAQ.md)
