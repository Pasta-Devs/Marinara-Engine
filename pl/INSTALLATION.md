# Instalacja aplikacji Marinara Engine

Marinara działa na twoim własnym urządzeniu. Wybierz poniżej przewodnik dla swojego urządzenia.

## Wybierz platformę

| Twoje urządzenie | Przewodnik |
| --- | --- |
| Windows | [Przewodnik instalacji w systemie Windows](installation/windows.md) |
| macOS lub Linux | [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md) |
| Docker lub Podman | [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md) |
| Telefon lub tablet z systemem Android | [Przewodnik instalacji na Android](installation/android-termux.md) |
| iPhone lub iPad | [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md) |

## Co wybrać?

- **Windows:** użyj instalatora dla systemu Windows. Konfiguruje on wszystko i dodaje skrót na pulpicie.
- **Android:** [pobierz plik APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Otwórz pobrany plik, a potem dotknij w aplikacji przycisku **Install / Start Marinara** (instalacja i uruchomienie).
- **macOS, Linux albo domowy serwer:** wybierz jedną z dwóch dróg. Przewodnik natywny uruchamia aplikację Marinara Engine bezpośrednio na twoim komputerze za pomocą programu uruchamiającego, czyli skryptu. Droga z kontenerem Docker nie wymaga Node.js ani budowania czegokolwiek, ale najpierw trzeba zainstalować program Docker.
- **iPhone lub iPad:** na tych urządzeniach Marinara nie może uruchomić serwera. Uruchom aplikację Marinara Engine na komputerze, domowym serwerze albo urządzeniu z systemem Android, a potem otwórz ją w przeglądarce Safari. Jak to zrobić, wyjaśnia przewodnik dla systemu iOS.
- **Chcesz edytować kod:** uruchom aplikację ze źródeł. Oznacza to, że pobierasz kod i budujesz aplikację na swoim urządzeniu. Tę drogę opisują przewodniki dla systemów Windows, macOS i Linux oraz Android.

W systemie Android Marinara działa wewnątrz aplikacji **Termux**. To darmowa aplikacja na system Android, która daje telefonowi mały system Linux. Plik APK sam konfiguruje za ciebie aplikację Termux.

## Czego potrzebujesz

- Do uruchomienia ze źródeł: **Node.js** w wersji 24, 25 lub 26 oraz **Git**. Node.js uruchamia aplikację. Git pobiera kod i go aktualizuje. Przewodniki dla poszczególnych platform zawierają linki do pobrania obu narzędzi.
- Dla kontenera Docker lub Podman: Node.js nie jest potrzebny. Zalecana konfiguracja z Compose używa narzędzia Git tylko raz, do pobrania plików projektu.

## Otwieranie aplikacji Marinara Engine

Gdy Marinara działa, otwórz ten adres w przeglądarce na tym samym urządzeniu. Nie używaj go z innego urządzenia.

```text
http://127.0.0.1:7860
```

`127.0.0.1` oznacza to urządzenie. `7860` to domyślny port, czyli numer, na którym aplikacja nasłuchuje. Programy uruchamiające (skrypty, które uruchamiają aplikację Marinara Engine) pozwalają też innym urządzeniom w twojej sieci łączyć się z aplikacją, ale te urządzenia pozostają zablokowane, dopóki nie ustawisz logowania. Instalacja w kontenerze Docker lub Podman odpowiada tylko na tym urządzeniu, dopóki nie zmienisz w niej wiersza z portem; zobacz [Uruchamianie w kontenerze](installation/containers.md#open-marinara-from-another-device).

## Otwieranie aplikacji Marinara Engine na telefonie

1. Zainstaluj i uruchom aplikację Marinara Engine na komputerze, domowym serwerze albo telefonie z systemem Android.
   W przypadku kontenera Docker lub Podman najpierw wykonaj kroki z sekcji [Otwieranie aplikacji Marinara Engine z innego urządzenia](installation/containers.md#open-marinara-from-another-device).
2. Ustaw tam logowanie. Zobacz [Dostęp zdalny](REMOTE_ACCESS.md#option-1-login-recommended).
3. Znajdź adres IP tego urządzenia. Jak to zrobić, pokazuje dokument [Najczęściej zadawane pytania](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).
4. Na telefonie otwórz `http://`, a po nim adres IP i `:7860`.

Jeśli masz iPhone'a, zobacz [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md).

## Po instalacji

Przeczytaj przewodnik [Pierwsze kroki z aplikacją Marinara Engine](home/welcome.md), żeby dodać połączenie, utworzyć lub zaimportować postać i rozpocząć czat. Jak później zaktualizować aplikację, opisuje dokument [Aktualizacja aplikacji Marinara Engine](UPGRADING.md).

## Powiązane przewodniki

- [Przewodnik instalacji w systemie Windows](installation/windows.md)
- [Przewodnik instalacji na macOS i Linux](installation/macos-linux.md)
- [Uruchamianie w kontenerze (Docker / Podman)](installation/containers.md)
- [Przewodnik instalacji na Android (Termux)](installation/android-termux.md)
- [Przewodnik po PWA na iOS / iPadOS](installation/ios-pwa.md)
- [Aktualizacja aplikacji Marinara Engine](UPGRADING.md)
- [Pierwsze kroki z aplikacją Marinara Engine](home/welcome.md)
