# Instalacja aplikacji Marinara Engine

Ten przewodnik pomaga wybrać sposób instalacji aplikacji Marinara Engine odpowiedni dla twojego urządzenia. Marinara Engine działa na twoim własnym komputerze, więc czaty i dane zostają lokalnie. Każda platforma z tabeli poniżej ma własny przewodnik krok po kroku.

## Wybierz platformę

Wybierz przewodnik pasujący do urządzenia, na którym ma działać Marinara Engine.

| Platforma | Przewodnik instalacji |
|---|---|
| Windows | [Przewodnik instalacji w systemie Windows](installation/windows.md) |
| macOS lub Linux | [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md) |
| Docker lub Podman | [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md) |
| Telefon lub tablet z systemem Android | [Pobierz APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Przewodnik instalacji na Android](installation/android-termux.md) |
| iPhone lub iPad | [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md) |

Zanim zdecydujesz, warto wiedzieć o dwóch rzeczach:

- Na urządzeniach **iPhone i iPad** Marinara Engine nie uruchamia serwera. Serwer działa na komputerze, na domowym serwerze albo na urządzeniu z systemem Android. Potem otwierasz go w przeglądarce Safari na iPhonie lub iPadzie. Wyjaśnia to przewodnik dla systemu iOS.
- W systemie **Android** Marinara Engine działa wewnątrz aplikacji **Termux**. Termux to darmowa aplikacja, która daje systemowi Android małe środowisko Linux. Dotknij bezpośredniego łącza pobierania APK, zatwierdź wymagane przez Android komunikaty instalacyjne i uprawnienia Termux, a aplikacja automatycznie zajmie się prywatnym poświadczeniem localhost. Instalator nigdy nie prosi o poświadczenia podpisywania Androida ani ten lokalny sekret.

## Co wybrać

Jeśli zaczynasz i zależy ci na jak najmniejszej liczbie kroków, wybierz jedną z tych dróg:

- W systemie **Windows** użyj instalatora **Windows installer**. Pobiera on i konfiguruje wszystko za ciebie oraz dodaje skrót na pulpicie.
- W systemie **Android** użyj powyższego łącza **Pobierz APK**. Otwórz pobrany plik, a potem dotknij w aplikacji **Install / Start Marinara**.
- W systemie **macOS**, **Linux** albo na domowym serwerze użyj obrazu **Docker**. Aplikację uruchamia jedno polecenie. Obraz zawiera już Node.js, wszystkie zależności i gotową, zbudowaną aplikację. Nie musisz więc instalować Node.js ani budować aplikacji samodzielnie.

Jeśli terminal nie jest ci obcy i chcesz mieć możliwość edycji kodu, uruchom aplikację ze źródeł. "Uruchomienie ze źródeł" oznacza, że pobierasz kod i budujesz aplikację na własnym komputerze. Tę drogę opisują przewodniki **Windows**, **macOS i Linux** oraz **Android (Termux)**.

## Minimalne wymagania

- Potrzebny jest komputer lub urządzenie zdolne uruchomić serwer: Windows, macOS, Linux albo Android.
- Do uruchomienia ze źródeł potrzebne są **Node.js** w wersji 24 oraz **Git**. Node.js uruchamia aplikację, a Git pobiera i aktualizuje kod. Przewodniki dla poszczególnych platform zawierają linki do obu pobrań.
- Instalacja przez **Docker** i **Podman** nie wymaga Node.js. Zalecana konfiguracja z Compose nadal używa narzędzia Git do pobrania plików projektu. Opisuje to przewodnik o instalacji w kontenerze.
- Domyślnie aplikacja działa na twoim komputerze pod tym adresem:

```text
http://127.0.0.1:7860
```

- Adres `127.0.0.1` oznacza twój własny komputer, a `7860` to domyślny port. Aby dotrzeć do aplikacji Marinara Engine z telefonu lub innego urządzenia w sieci, zajrzyj do przewodnika [Najczęściej zadawane pytania](FAQ.md) po informacje o dostępie w sieci lokalnej.

## Co dalej po instalacji

Kiedy aplikacja Marinara Engine już działa i jest otwarta w przeglądarce, przeczytaj [Pierwsze kroki z aplikacją Marinara Engine](home/welcome.md). Przewodnik prowadzi przez pierwsze czynności: dodanie połączenia, utworzenie lub zaimportowanie postaci i rozpoczęcie czatu.

Aby później utrzymywać instalację w aktualnej wersji, zajrzyj do przewodnika [Aktualizacja aplikacji Marinara Engine](UPGRADING.md).

## Powiązane przewodniki

- [Przewodnik instalacji w systemie Windows](installation/windows.md)
- [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md)
- [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md)
- [Przewodnik instalacji na Android (Termux)](installation/android-termux.md)
- [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md)
- [Aktualizacja aplikacji Marinara Engine](UPGRADING.md)
- [Pierwsze kroki z aplikacją Marinara Engine](home/welcome.md)
