# Przewodnik po PWA na iOS / iPadOS

Korzystaj z aplikacji Marinara Engine na urządzeniu iPhone lub iPad. Apple nie pozwala uruchomić serwera Marinara na tych urządzeniach, więc w przeglądarce Safari otwierasz serwer działający na innym urządzeniu. Potem możesz zapisać go na ekranie głównym jako PWA. PWA (Progressive Web App) to strona internetowa, która otwiera się we własnym oknie, jak aplikacja.

## Szybka ścieżka

1. Zainstaluj i uruchom aplikację Marinara na komputerze, serwerze domowym albo telefonie z systemem Android (zobacz listę niżej). Nie wyłączaj jej.
2. Ustaw logowanie na tym komputerze. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Ustal adres IP tego komputera (zobacz niżej).
4. Na urządzeniu iPhone lub iPad otwórz przeglądarkę **Safari** i przejdź pod adres złożony z `http://`, tego adresu IP i `:7860`.

Nie używaj adresu `127.0.0.1` na urządzeniu iPhone lub iPad. Ten adres oznacza sam iPhone.

## Gdzie działa serwer

Serwer może działać:

- Na komputerze z systemem Windows: [Przewodnik instalacji w systemie Windows](windows.md).
- Na komputerze Mac lub z systemem Linux: [Przewodnik instalacji na macOS i Linux](macos-linux.md).
- Na telefonie z systemem Android i aplikacją Termux: [Przewodnik instalacji na Android (Termux)](android-termux.md).
- W kontenerze Docker lub Podman: [Uruchamianie w kontenerze](containers.md).

## Łączenie z przeglądarki Safari

Zanim zaczniesz: serwer musi działać i wpuszczać twoje urządzenie, zwykle po zalogowaniu. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md).

1. Podłącz urządzenie z serwerem oraz iPhone lub iPad do tej samej sieci, na przykład do domowego Wi-Fi. Żeby łączyć się z innego miejsca, użyj narzędzia Tailscale, bezpłatnego narzędzia, które łączy urządzenia w prywatną sieć przez internet.
2. Ustal adres IP urządzenia z serwerem. Na komputerze z serwerem uruchom jedno polecenie w terminalu (oknie, w którym wpisuje się polecenia) i odczytaj adres, który wygląda jak `192.168.1.42`.

   - Windows (wiersz polecenia): `ipconfig`. Odczytaj wartość **IPv4 Address** (adres IPv4).
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. Otwórz przeglądarkę **Safari** i przejdź pod ten adres. W miejsce `<host-ip>` wpisz ustalony adres IP. Domyślny port to `7860`.

```text
http://<host-ip>:7860
```

4. Wczyta się strona startowa aplikacji Marinara.

Jeśli zobaczysz stronę logowania, zaloguj się nazwą użytkownika i hasłem serwera. Jeśli zobaczysz stronę konfiguracji, wpisz jednorazowy kod konfiguracji z logu serwera i wybierz nazwę użytkownika oraz hasło. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md).

Jeśli to nie zadziałało: sprawdź, czy serwer nadal działa i czy oba urządzenia są w tej samej sieci albo w sieci Tailscale. Sprawdź adres IP i port. Zobacz [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Dodawanie do ekranu głównego

1. Otwórz serwer Marinara w przeglądarce **Safari**.
2. Dotknij przycisku udostępniania, czyli kwadratowej ikony ze strzałką skierowaną w górę.
3. Przewiń panel udostępniania w dół i dotknij opcji **Add to Home Screen** (dodanie do ekranu głównego).
4. Jeśli chcesz, zmień nazwę, a potem dotknij przycisku **Add** (dodaj).

Na ekranie głównym pojawi się ikona aplikacji Marinara. Dotknij jej, aby otworzyć aplikację Marinara we własnym oknie, bez paska adresu przeglądarki Safari.

## Użyj HTTPS, gdy aplikacja działa nieprawidłowo

PWA działa najlepiej przez HTTPS, czyli bezpieczne połączenie, którego adres zaczyna się od `https://`. Zwykły adres `http://` działa w przeglądarce Safari. Niektóre wersje systemów iOS i iPadOS ograniczają jednak aplikację z ekranu głównego pod zwykłym adresem `http://`. Jeśli tak się dzieje, udostępnij aplikację Marinara przez HTTPS albo zostaw ją jako zakładkę w przeglądarce Safari.

Samo narzędzie Tailscale nie zamienia adresu na HTTPS. Użyj konfiguracji Tailscale, która udostępnia HTTPS, albo poproś właściciela serwera o ustawienie aplikacji Marinara za HTTPS. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md#serving-over-https).

<a id="clearing-and-reinstalling-the-pwa"></a>

## Czyszczenie i ponowna instalacja aplikacji PWA

Przeglądarka Safari czasem trzyma starszą wersję aplikacji albo zapisana aplikacja się zacina. Zwykle pomaga ponowna instalacja. Czaty, postacie i ustawienia są na serwerze, więc ponowna instalacja ich nie usuwa.

1. Naciśnij i przytrzymaj ikonę aplikacji Marinara na ekranie głównym.
2. Dotknij opcji usunięcia aplikacji, a potem potwierdź.
3. Otwórz aplikację **Settings** (Ustawienia) na urządzeniu iPhone lub iPad.
4. Dotknij pozycji **Safari**. W nowszych wersjach systemów iOS i iPadOS może się ona kryć w sekcji **Apps**, a potem **Safari**.
5. Dotknij pozycji **Advanced**, a potem pozycji **Website Data**.
6. Znajdź wpis z adresem serwera Marinara. Jeśli go nie widać, dotknij opcji **Show All Sites**.
7. Przesuń palcem w lewo po tym wpisie i dotknij przycisku **Delete**.
8. Otwórz aplikację Marinara ponownie w przeglądarce **Safari** i jeszcze raz dodaj ją do ekranu głównego, wykonując kroki opisane wyżej.

## Rozwiązywanie problemów

**Strona nie wczytuje się w przeglądarce Safari.** Sprawdź, czy serwer działa, czy oba urządzenia są w tej samej sieci lub w sieci Tailscale oraz czy adres IP i port `7860` są poprawne. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md) i [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

**Safari po aktualizacji pokazuje stronę logowania lub konfiguracji.**

- Zaloguj się na `/login` nazwą użytkownika i hasłem serwera.
- Jeśli logowania nie ma, wpisz na stronie konfiguracji jednorazowy kod konfiguracji z logu serwera.
- Jeśli serwer nie wypisuje kodu, ustaw logowanie na urządzeniu z serwerem w **Settings → Advanced → Access** (ustawienia, zaawansowane, dostęp).
- Kod **403** może oznaczać, że twojego urządzenia iPhone nie ma na liście `IP_ALLOWLIST`. Tę listę zmienia właściciel serwera.
- PWA nie może zresetować logowania serwera. Właściciel serwera uruchamia `node scripts/reset-login.mjs` w folderze aplikacji Marinara na serwerze (w kontenerze Docker: `docker exec <container> node scripts/reset-login.mjs`) albo zmienia logowanie ustawione w `.env`.

Zobacz [Zablokowany dostęp po aktualizacji](../REMOTE_ACCESS.md#locked-out-after-updating).

**Safari wciąż pokazuje starą wersję.** Odśwież stronę. Jeśli nadal wygląda staro, zainstaluj PWA ponownie, wykonując kroki opisane wyżej.

**Aplikacja z ekranu głównego zamyka się lub robi się pusta podczas generowania.** Otwórz ją ponownie i wróć do czatu. Sprawny serwer pracuje dalej: odpowiedzi czatu i żądania obrazów agenta Illustrator nadal działają na serwerze, a ponownie otwarty czat odświeża się po ich zakończeniu. **Stop** nadal anuluje generowanie w wybranym czacie. Jeśli pusty ekran wraca, zgłoś to razem z kopią z sekcji Support Diagnostics.

**Czerwony pasek ostrzega, że zapisy będą po cichu przepadać.** To ostrzeżenie serwera o zaufaniu sieciowym, a nie problem z urządzeniem iPhone lub iPad. Właściciel serwera musi uznać twój adres za zaufany. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**Działania uprzywilejowane są blokowane.** Niektóre czynności serwisowe wymagają sekretu administratora (drugiego hasła) od właściciela serwera. Zapisz go na urządzeniu iPhone lub iPad w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny). Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Powiązane przewodniki

- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
- [Najczęściej zadawane pytania](../FAQ.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
- [Przewodnik instalacji na Android (Termux)](android-termux.md)
