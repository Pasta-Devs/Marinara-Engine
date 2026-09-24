# Przewodnik po PWA na iOS / iPadOS

Z tego przewodnika dowiesz się, jak korzystać z aplikacji Marinara Engine na iPhone lub iPad. Systemy iOS i iPadOS nie potrafią same uruchomić serwera Marinara. Zamiast tego łączysz się z serwerem na innym urządzeniu i zapisujesz go na ekranie głównym jako aplikację internetową.

## iOS uruchamia serwer na innym urządzeniu

Marinara Engine składa się z dwóch części: serwera, który wykonuje całą pracę, oraz aplikacji internetowej, którą oglądasz w przeglądarce. Na iPhone i iPad Apple nie pozwala uruchomić serwera lokalnie. Serwer działa więc gdzie indziej, a ty otwierasz go w przeglądarce Safari na iPhone lub iPad.

Serwer może działać w dowolnym z tych miejsc:

- Na komputerze z systemem Windows (zobacz [Przewodnik instalacji w systemie Windows](windows.md)).
- Na komputerze z systemem macOS lub Linux (zobacz [Przewodnik instalacji na macOS i Linux](macos-linux.md)).
- Na telefonie z systemem Android i aplikacją Termux (zobacz [Przewodnik instalacji na Android (Termux)](android-termux.md)).
- W kontenerze Docker lub Podman (zobacz [Uruchamianie w kontenerze](containers.md)).

iPhone lub iPad łączy się z tym serwerem przez sieć. Działa to tak samo jak otwieranie dowolnej strony internetowej, tyle że tą stroną jest twój własny serwer Marinara.

## Łączenie z przeglądarki Safari

Kiedy serwer działa już na urządzeniu głównym, wykonaj kolejno te kroki.

1. Sprawdź, czy urządzenie główne oraz iPhone lub iPad są w tej samej sieci albo w tej samej sieci Tailscale. Sieć LAN to twoja sieć lokalna, na przykład domowe Wi-Fi. Tailscale to bezpłatne narzędzie, które łączy urządzenia w prywatną sieć przez internet.
2. Ustal adres serwera głównego. Wygląda on tak jak w przykładzie poniżej. W miejsce `<host-ip>` wpisz adres IP urządzenia głównego w sieci LAN lub Tailscale. Domyślny port to `7860`.

```
http://<host-ip>:7860
```

3. Otwórz przeglądarkę **Safari** na iPhone lub iPad.
4. Wpisz ten adres w pasku adresu przeglądarki Safari i przejdź do niego.
5. W przeglądarce powinna wczytać się strona startowa aplikacji Marinara Engine.

Jeśli strona się nie wczytuje albo pojawia się prośba o hasło, zajrzyj do sekcji Rozwiązywanie problemów poniżej. To właściciel serwera decyduje o dostępie sieciowym i hasłach. Te ustawienia serwera opisuje [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md), a nie ustawienia na iPhone lub iPad.

## Dodawanie do ekranu głównego

Marinara Engine da się zapisać jako aplikację PWA, dzięki czemu otwiera się jak zwykła aplikacja. PWA to skrót od Progressive Web App: strona internetowa działająca we własnym oknie i z własną ikoną na ekranie głównym.

1. Otwórz serwer Marinara w przeglądarce **Safari** (zobacz kroki powyżej).
2. Dotknij przycisku udostępniania. To kwadratowa ikona ze strzałką skierowaną w górę.
3. Przewiń panel udostępniania w dół i dotknij opcji **Add to Home Screen** (dodanie do ekranu głównego).
4. Zmień nazwę, jeśli chcesz, a potem dotknij przycisku **Add**.
5. Na ekranie głównym powinna pojawić się ikona aplikacji Marinara Engine.

Dotknij tej ikony, aby otworzyć aplikację Marinara Engine we własnym oknie, bez paska adresu przeglądarki Safari.

## Uwaga o HTTPS

Aplikacje PWA działają najstabilniej przez HTTPS. HTTPS to bezpieczne, zaszyfrowane połączenie z internetem, widoczne jako `https://` na początku adresu.

Zwykły HTTP w sieci LAN nadal działa w przeglądarce Safari do codziennego użytku. Niektóre wersje systemu iOS lub iPadOS ograniczają jednak działanie samodzielnej aplikacji PWA pod adresem `http://`. W takim wypadku udostępnij aplikację Marinara Engine przez HTTPS.

Tailscale nadaje każdemu urządzeniu stały adres prywatny i poprawia dostępność, ale sam nie zamienia adresu `http://` na HTTPS. Wybierz konfigurację Tailscale, która wprost udostępnia HTTPS, albo poproś właściciela serwera o ustawienie aplikacji Marinara Engine za HTTPS.

Te możliwości opisuje [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md). Jeśli zwykły adres HTTP sprawia kłopoty jako aplikacja na ekranie głównym, zostaw go raczej jako zakładkę w przeglądarce Safari.

## Czyszczenie i ponowna instalacja aplikacji PWA

Czasem przeglądarka Safari wciąż pokazuje starszą wersję aplikacji albo zapisana aplikacja internetowa się zacina. Zwykle pomaga ponowna instalacja aplikacji z ekranu głównego.

1. Naciśnij i przytrzymaj ikonę aplikacji Marinara Engine na ekranie głównym.
2. Dotknij opcji usunięcia aplikacji, a potem potwierdź.
3. Otwórz aplikację **Settings** (Ustawienia) na iPhone lub iPad.
4. Dotknij pozycji **Safari**. W nowszych wersjach systemu iOS i iPadOS może się ona kryć w sekcji **Apps**, a potem **Safari**.
5. Dotknij pozycji **Advanced**, a potem pozycji **Website Data**.
6. Znajdź wpis z adresem serwera Marinara. Jeśli go nie widać, dotknij opcji **Show All Sites**.
7. Przesuń palcem w lewo na tym wpisie i dotknij przycisku **Delete**. To usuwa stare pliki zapisane dla tego serwera.
8. Otwórz aplikację Marinara Engine ponownie w przeglądarce **Safari**, zgodnie z krokami z sekcji Łączenie z przeglądarki Safari.
9. Dodaj ją ponownie do ekranu głównego, zgodnie z krokami z sekcji Dodawanie do ekranu głównego.

Czaty, postacie i ustawienia są zapisane na serwerze, a nie na iPhone lub iPad. Ponowna instalacja aplikacji z ekranu głównego ich nie usuwa.

## Rozwiązywanie problemów

**Strona nie wczytuje się w przeglądarce Safari.** Sprawdź, czy serwer nadal działa na urządzeniu głównym. Sprawdź, czy oba urządzenia są w tej samej sieci lub w sieci Tailscale. Upewnij się, że adres IP i port `7860` są poprawne. Więcej pomocy dotyczącej sieci znajdziesz w dokumentach [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md) i [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

**Safari prosi o nazwę użytkownika i hasło.** Właściciel serwera włączył ochronę hasłem dla urządzeń zdalnych. Poproś o nazwę użytkownika i hasło osobę, która prowadzi serwer. Konfigurację opisuje [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

**Safari wciąż pokazuje starą wersję.** Najpierw odśwież stronę. Jeśli nadal wygląda staro, wykonaj kroki z sekcji Czyszczenie i ponowna instalacja aplikacji PWA powyżej.

**Aplikacja z ekranu głównego zamyka się lub bieleje podczas generowania.** Otwórz ją ponownie i wróć do czatu. Nie musisz restartować zdrowego serwera. Automatyczne odpowiedzi czatu i ręczne lub ponawiane żądania obrazów wyłącznie Illustrator działają dalej na serwerze po utracie połączenia przeglądarki. Ponownie otwarty czat sprawdza niedokończoną pracę i po jej zakończeniu odświeża zapisane wiadomości oraz obrazy galerii. **Stop** nadal anuluje generowanie wybranego czatu. Jeśli pusty ekran wraca, zgłoś Support Diagnostics i to, czy ponowne otwarcie przywraca czat; to odzyskiwanie nie diagnozuje ani nie zapobiega każdej awarii przeglądarki iOS.

**Czerwony pasek ostrzega, że zapisy będą po cichu przepadać.** To ostrzeżenie serwera o zaufaniu sieciowym, a nie problem z iPhone lub iPad. Właściciel serwera musi dodać twój adres do zaufanych. Zobacz [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md) i [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

**Działania uprzywilejowane są blokowane.** Część czynności serwisowych wymaga sekretu administratora od właściciela serwera. Na iPhone lub iPad zapisujesz tę wartość w sekcji **Settings**, potem **Advanced**, potem **Admin Access**. [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md) wyjaśnia, czym jest sekret administratora i jak go zdobyć.

## Powiązane przewodniki

- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
- [Najczęściej zadawane pytania](../FAQ.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
- [Przewodnik instalacji na Android (Termux)](android-termux.md)
