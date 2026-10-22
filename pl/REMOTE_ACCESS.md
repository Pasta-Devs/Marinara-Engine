# Dostęp zdalny: logowanie i lista dozwolonych adresów IP

Z tego przewodnika dowiesz się, jak połączyć się z aplikacją Marinara Engine z innego urządzenia: telefonu, laptopa albo kontenera Docker. Opisuje główną opcję, czyli logowanie. Wyjaśnia też listę dozwolonych adresów IP, proxy logowania, HTTPS, sekcję **Admin Access** (dostęp administracyjny) oraz komunikat CSRF o zablokowanym zapisie. Prawie każde ustawienie z tego przewodnika znajduje się w pliku `.env` serwera, a nie w aplikacji.

Kilka pojęć, które wracają w całym przewodniku:

- plik `.env`: zwykły tekstowy plik ustawień w folderze aplikacji Marinara Engine, obok `package.json`.
- Loopback: komputer, na którym rzeczywiście działa serwer. Jego adres to `127.0.0.1` albo `localhost`.
- Dostęp zdalny: otwarcie aplikacji Marinara na dowolnym urządzeniu, które NIE jest komputerem z serwerem.

## Co Marinara blokuje domyślnie

Świeża instalacja aplikacji Marinara odrzuca połączenia z innych urządzeń, dopóki nie skonfigurujesz kontroli dostępu. Chodzi o ochronę danych. Domyślnie zaufane są tylko trzy rodzaje klientów:

1. Loopback (`127.0.0.1` lub `::1`), czyli sam komputer z serwerem. Nie liczą się do niego goście przekazywani przez odwrotne proxy albo tunel na tym samym komputerze; zobacz [Odwrotne proxy i tunele na tym samym komputerze](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Urządzenia w sieci Tailscale. Tailscale to narzędzie do prywatnych sieci, a jego adresy mieszczą się w zakresie `100.64.0.0/10`.
3. Klienty Docker na tym samym komputerze. Marinara rozpoznaje typowy zakres mostka `172.16.0.0/12` oraz dokładną bramę domyślną kontenera, co obejmuje też Docker Desktop i własne pule adresów.

Wszystko inne, na przykład telefon w tej samej sieci Wi-Fi albo klient z publicznego internetu, jest zablokowane do czasu ustawienia logowania. Zablokowane urządzenie, które otworzy aplikację Marinara w przeglądarce, widzi ciemną stronę konfiguracyjną. Jej tytuł brzmi **This Marinara Engine install needs a login before remote devices can connect.** Strona ma formularz na jednorazowy kod konfiguracji z logu serwera, więc możesz ustawić logowanie z tego urządzenia.

Bez żadnej zmiany i bez ustawienia hasła Marinara nadal wpuszcza tylko te trzy zaufane źródła. To bezpieczne ustawienie domyślne.

## Gdzie znajduje się plik .env

Wszystkie ustawienia dostępu znajdują się w pliku `.env` w głównym folderze projektu, obok `package.json`. Jeśli tego pliku jeszcze nie ma, skopiuj przykładowy:

```bash
cp .env.example .env
```

Otwórz plik `.env` w dowolnym edytorze tekstu. Większość ustawień dostępu działa w ciągu kilku sekund, bez restartu: dotyczy to Basic Auth, listy dozwolonych adresów IP, sekretu administratora i źródeł CSRF. Kilka ustawień niskiego poziomu nadal wymaga restartu, w tym `PORT`, `HOST` oraz ścieżki do certyfikatu HTTPS.

Czasem inne urządzenia w ogóle nie docierają do serwera i zamiast błędu 403 dostają przekroczony limit czasu. Wtedy serwer prawdopodobnie nasłuchuje tylko na lokalnym komputerze. Ustaw nasłuchiwanie na wszystkich interfejsach sieciowych:

```env
HOST=0.0.0.0
```

Domyślny adres wiązania zależy od sposobu uruchomienia Marinary:

| Sposób uruchomienia | Domyślna wartość `HOST` |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, instalator Windows, `start-termux.sh` | `0.0.0.0` |
| Obraz Docker | `0.0.0.0` wewnątrz kontenera |
| `docker-compose.yml` | Publikuje port tylko na `127.0.0.1` |

## Którą opcję wybrać

Czytaj po kolei i zatrzymaj się przy pierwszym pasującym punkcie.

1. Łączysz się wyłącznie przez sieć Tailscale albo tylko z kontenerów Docker na tym samym komputerze. Nie trzeba nic robić, to już działa.
2. Chcesz otworzyć aplikację Marinara na telefonie, tablecie albo laptopie w domowej sieci Wi-Fi. Ustaw logowanie (opcja 1 poniżej).
3. Udostępniasz aplikację Marinara w publicznym internecie. Ustaw logowanie i użyj HTTPS.
4. Proxy logowania w twojej sieci, na przykład tinyauth, Authelia albo Authentik, już pyta każdego gościa o logowanie. Przeczytaj [Proxy logowania (forward auth)](#login-proxies-forward-auth).

Logowanie to najbardziej elastyczny wybór. Działa z każdego adresu IP, nie wymaga konfiguracji na każdym urządzeniu, a każda przeglądarka pozostaje zalogowana.

<a id="option-1-login-recommended"></a>

## Opcja 1: Logowanie (zalecana)

Logowanie to nazwa użytkownika i hasło, których wymaga każde urządzenie zdalne. Możesz je ustawić na trzy sposoby:

- **W Settings.** W przeglądarce, która jest już zalogowana, albo na komputerze z uruchomioną aplikacją Marinara (otwórz `http://localhost:7860`), przejdź do **Settings → Advanced → Access**. Ustaw nazwę użytkownika i hasło w sekcji **Remote login**. Dopóki logowanie nie istnieje, urządzenie, które Marinara odrzuca, na przykład przeglądarka na hoście Docker, może wpisać kod konfiguracji z logu serwera w tym samym miejscu.
- **Za pomocą kodu konfiguracji, z dowolnego urządzenia.** Dopóki nie ustawiono logowania, a serwer nasłuchuje poza loopbackiem, wypisuje w swoim logu jednorazowy kod konfiguracji. Linia logu zaczyna się od `[login] One-time setup code:`. Znajdziesz ją w terminalu, w którym działa aplikacja Marinara. W Dockerze uruchom `docker logs <container> 2>&1 | grep "setup code"`. Ostrzeżenie o odmowie w logu powtarza kod, dopóki logowanie nie istnieje. Potem otwórz aplikację Marinara na dowolnym urządzeniu. Strona, która blokuje urządzenie, ma formularz na kod konfiguracji, nazwę użytkownika i hasło. Kod wygląda tak: `XXXX-XXXX-XXXX-XXXX`. Wielkość liter, spacje i myślniki nie mają znaczenia. Każdy kod działa raz; restart albo reset wypisuje nowy. W Dockerze strona pokazuje też, jak ustawić logowanie w pliku `.env` w folderze danych (`/app/data/.env`) albo na liście `environment:` w pliku compose (potem uruchom `docker compose up -d`). Użyj tego sposobu dla instalacji Docker i NAS, na których host nie ma przeglądarki. Marinara pokazuje lokalnym gościom i zalogowanym sesjom baner o brakującym logowaniu, jako kartę na dole ekranu.
- **W `.env`.** Dodaj dwie linie:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Logowanie w `.env` ma pierwszeństwo przed logowaniem ustawionym w aplikacji i zmieniasz je tylko w `.env`. Zapisz `.env`; zmiana działa w ciągu kilku sekund, bez restartu.

Wybierz silne i unikalne hasło. Aplikacja wymaga co najmniej 10 znaków. Losowe hasło możesz wygenerować:

```bash
openssl rand -base64 24
```

Potem wykonaj te kroki na zdalnym urządzeniu.

1. Otwórz aplikację Marinara w przeglądarce pod adresem serwera, na przykład `http://192.168.1.50:7860`.
2. Zaloguj się na stronie logowania swoją nazwą użytkownika i hasłem.
3. Aplikacja powinna się załadować. Przeglądarka pozostaje zalogowana do roku, dopóki jej nie wylogujesz. Skrypty i klienci API wysyłają nazwę użytkownika i hasło z każdym żądaniem (Basic Auth).

Aby zalogować inne urządzenie bez wpisywania hasła, użyj kodu parowania. Na zalogowanym urządzeniu otwórz **Settings → Advanced → Access** i wybierz **Add a device**. Potem wpisz kod na stronie logowania nowego urządzenia. Kod działa raz, przez kilka minut. Wygasły kod dostaje własny komunikat; utwórz nowy. W sekcji **Signed-in devices** widzisz każde urządzenie z jego sposobem logowania i datą pierwszego logowania. Możesz wylogować każde urządzenie, także to, z którego korzystasz. Możesz też zmienić albo usunąć hasło. Do tego Marinara prosi o obecne hasło, chyba że pracujesz na komputerze, na którym działa aplikacja Marinara, albo ustawiono `ADMIN_SECRET`.

Jeśli zapomnisz hasła, uruchom `pnpm reset-login` na komputerze, na którym działa aplikacja Marinara. W Dockerze uruchom `docker exec <container> node scripts/reset-login.mjs`. To usuwa logowanie ustawione w aplikacji i wylogowuje każdą przeglądarkę. Jeśli serwer nasłuchuje poza loopbackiem, wypisuje wtedy nowy kod konfiguracji. Tylko jeśli to polecenie nie zadziała, usuń zamiast tego `.remote-login.json` i `.remote-sessions.json` z folderu danych. Przy domyślnym `/app/data` uruchom `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`; jeśli zmieniono `DATA_DIR`, użyj tego folderu. Logowania w `.env`, które zmieniasz w `.env`, to nie dotyczy.

**Serwer bez interfejsu i bez przeglądarki?** Natywna instalacja na serwerze bez interfejsu nasłuchuje tylko na loopbacku i nie wypisuje kodu konfiguracji. Na własnym komputerze uruchom `ssh -L 7860:127.0.0.1:7860 user@server`. Potem otwórz tam `http://localhost:7860` i użyj **Settings**.

Po 10 różnych błędnych hasłach lub kodach w ciągu 15 minut Marinara odrzuca logowania z tego adresu z kodem **429 Too Many Requests**, dopóki te 15 minut nie minie. Poprawne hasło wpisane wcześniej zeruje licznik. Goście przekazywani przez odwrotne proxy albo tunel na komputerze z serwerem mają jeden wspólny licznik, a zalogowanie się jednego z nich go nie zeruje. Licznik zeruje też restart serwera. Przeglądarka, która logowała się już wcześniej, nadal wchodzi po podaniu poprawnego hasła, więc cudze błędne hasła nie zablokują ci dostępu z urządzenia, z którego już korzystasz. Strona logowania podaje, ile minut trzeba czekać. Jeśli zapomnisz hasła, strona logowania ma podpowiedź **Forgot the password?**.

Domyślnie okno przeglądarki pokazuje napis **Marinara Engine**. Ten tekst zmienia zmienna `BASIC_AUTH_REALM`.

Część klientów pomija hasło nawet przy włączonym Basic Auth:

- Loopback (`127.0.0.1`, `::1`), więc na samym komputerze z serwerem hasło nigdy nie jest potrzebne. Goście przekazywani przez odwrotne proxy albo tunel na tym komputerze nadal go potrzebują.
- Każdy adres z `IP_ALLOWLIST`. Uwaga: ustawienie listy blokuje jednocześnie wszystkie adresy spoza niej (zobacz opcję 2).
- Bezpośredni ruch z sieci Tailscale (`100.64.0.0/10`), o ile pominięcie nie zostanie wyłączone.
- Ruch z mostka lub bramy Docker, tylko dopóki nie ustawiono logowania, listy dozwolonych adresów ani `TRUSTED_AUTH_PROXY` (zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](#tailscale-and-docker-bypass)).
- Adres `/api/health`, dzięki czemu monitory dostępności dalej działają. Odwiedzający, który nie może otworzyć aplikacji, dostaje tylko `{"status": "ok"}`; informacje o wersji, systemie i modelach zostają na tym komputerze, w zaufanych sieciach i w zalogowanych przeglądarkach.

Ważne: Basic Auth tylko koduje hasło, ale go nie szyfruje. Ktoś, kto podsłuchuje niezaszyfrowane połączenie, odczyta je bez trudu. Przy udostępnianiu aplikacji Marinara w publicznym internecie połącz Basic Auth z HTTPS (zobacz niżej).

## Opcja 2: lista dozwolonych adresów IP

Lista dozwolonych adresów IP wpuszcza wskazane adresy bez hasła. Sprawdza się wtedy, gdy urządzenia mają stałe adresy IP. Podaj listę adresów lub zakresów rozdzielonych przecinkami:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

Zapis `/24` w przykładzie to notacja CIDR. CIDR to skrócony sposób zapisania całego zakresu adresów w jednym wpisie. Na przykład `192.168.1.0/24` obejmuje wszystkie adresy od `192.168.1.0` do `192.168.1.255`. Sam adres bez ukośnika, taki jak `203.0.113.42`, pasuje tylko do tego jednego urządzenia.

Jak działa lista dozwolonych adresów IP:

- Każdy adres spoza listy dostaje odpowiedź **403 Forbidden**.
- Loopback jest zawsze dozwolony, więc dostępu lokalnego nie da się sobie zablokować. Goście przekazywani przez odwrotne proxy albo tunel na tym samym komputerze nie są ruchem loopback, więc lista ich blokuje. Za proxy używaj Basic Auth.
- W środowiskach Docker Desktop, OrbStack i rootless Docker każde urządzenie dociera do kontenera z tego samego adresu bramy, więc lista nie potrafi ich odróżnić. Tam używaj Basic Auth.
- Bezpośredni ruch z sieci Tailscale też pomija listę. Ruch z mostka lub bramy Docker pomija ją tylko dopóki nie ustawiono logowania, listy dozwolonych adresów ani ważnego `TRUSTED_AUTH_PROXY` (zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](#tailscale-and-docker-bypass)).
- Marinara pomija błędne wpisy i zapisuje je w logach. Nie powodują awarii serwera.
- Lista pozostaje rygorystyczna nawet przy włączonym Basic Auth. Adresy z listy nie widzą pytania o hasło. Pozostałe adresy dostają **403 Forbidden** i nigdy nie zobaczą okna logowania.

Lista nie tworzy układu mieszanego, w którym wskazane urządzenia wchodzą bez hasła, a reszta się loguje. Jeśli pozostałe urządzenia mają logować się hasłem, zostaw `IP_ALLOWLIST` bez wartości i użyj samego Basic Auth.

Egzekwowanie listy da się wyłączyć na chwilę, bez kasowania jej zawartości. Przydaje się to przy szukaniu problemów z nowego adresu IP. Ustaw flagę włączenia na false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Pominięcie ochrony w sieci prywatnej (opis)

Kilka flag znosi blokadę dla zaufanej sieci prywatnej. Służą do specjalnych konfiguracji. Lepszym wyborem jest logowanie. Flagi i ich ryzyko opisuje [Kontrola dostępu](CONFIGURATION.md#access-control).

<a id="tailscale-and-docker-bypass"></a>

## Pominięcie dla sieci Tailscale i kontenerów Docker

Domyślnie Marinara ufa urządzeniu, które łączy się bezpośrednio przez twoją sieć Tailscale. Ufa też własnemu hostowi kontenera Docker. Logowanie, lista dozwolonych adresów IP albo `TRUSTED_AUTH_PROXY` wyłącza automatyczne zaufanie do Dockera, więc każde urządzenie potrzebuje wtedy swojego logowania albo miejsca na liście. Flagi, które to zmieniają, opisuje [Kontrola dostępu](CONFIGURATION.md#access-control).

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Odwrotne proxy i tunele na tym samym komputerze

Odwrotne proxy albo tunel na komputerze, na którym działa Marinara, na przykład nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve lub Funnel albo ngrok, łączy się z aplikacją Marinara Engine przez loopback. Marinara rozpoznaje to po nagłówkach przekazywania, które dodaje proxy: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, nagłówkach tożsamości Tailscale albo `Via`. Marinara rozpoznaje także żądanie przychodzące przez HTTP/1.0, bo przeglądarki nigdy go nie używają, a domyślne `proxy_pass` w nginx tak. Marinara rozpoznaje także żądanie, którego nagłówek Host wskazuje inny komputer, na przykład domenę lub adres w sieci LAN, nawet gdy proxy nie dodaje nagłówków. Każde takie żądanie traktuje wtedy tak, jak należy, czyli jako żądanie zdalnego gościa:

- Obowiązuje logowanie (zobacz [Opcja 1](#option-1-login-recommended)). Bez niego goście widzą stronę konfiguracyjną. Ustaw logowanie w **Settings** na tym komputerze albo w `.env`.
- `IP_ALLOWLIST` blokuje przekazywanych gości, bo proxy ukrywa ich prawdziwe adresy.
- Działania uprzywilejowane wymagają sekretu administratora, a funkcje dostępne tylko przez loopback pozostają niedostępne.

Twoja własna przeglądarka na tym komputerze, otwarta pod adresem `http://127.0.0.1:7860` albo `http://localhost:7860`, nadal działa bez hasła.

Caddy, Traefik, Cloudflare Tunnel, Tailscale i ngrok domyślnie dodają nagłówki przekazywania. W nginx nadal zalecana jest ta linia w bloku `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Narzędzia przekazujące surowe połączenia, takie jak `socat` albo `ssh -R`, nie dodają żadnych nagłówków, więc ich ruch wygląda na lokalny. Nie publikuj nimi aplikacji Marinara Engine.

Jeśli twoje proxy już wymusza logowanie każdego gościa, zanim cokolwiek przekaże, zobacz [Proxy logowania (forward auth)](#login-proxies-forward-auth).

<a id="login-proxies-forward-auth"></a>

## Proxy logowania (forward auth)

Proxy typu forward-auth, na przykład [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io) albo oauth2-proxy, pyta każdego gościa o logowanie, zanim przekaże żądanie. Jeśli takie proxy to jedyna droga do aplikacji Marinara, możesz pominąć drugie logowanie w Marinarze. Nie ustawiaj tego bez takiego proxy.

Wpisz adres proxy w `.env`:

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara wpuszcza wtedy każde żądanie, którego połączenie pochodzi z tego adresu. Nie pyta ich o własne logowanie i nie wypisuje kodu konfiguracji. Marinara sprawdza adres samego połączenia. Do tej decyzji ignoruje nagłówki przekazywania, takie jak `X-Forwarded-For`. Żądania z proxy przechodzą też przez `IP_ALLOWLIST`, bo to proxy decyduje, kto wchodzi. Nie liczą się jako lokalne, więc działania uprzywilejowane nadal wymagają sekretu administratora. **Settings → Advanced → Access** pokazuje **Trusted login proxy: Set**, dopóki to ustawienie jest aktywne.

Zanim to ustawisz:

- **Proxy musi pytać o logowanie na każdej ścieżce.** Dotyczy to `/api/`, połączeń WebSocket i plików statycznych. Ścieżka, którą proxy przepuszcza bez logowania, jest otwarta dla wszystkich.
- **Do aplikacji Marinara nie wolno dojść z pominięciem proxy.** Powiąż Marinarę z adresem, do którego dociera tylko proxy, albo zablokuj jej port zaporą. W Dockerze umieść proxy i Marinarę w tej samej sieci Docker, nadaj proxy stały adres w tej sieci i nie publikuj portu Marinary. Jeśli proxy działa na hoście Docker, opublikuj port tylko na loopbacku (`127.0.0.1:7860:7860`): Docker Desktop i OrbStack pokazują każdego klienta LAN opublikowanego portu pod adresem bramy Docker, czyli tym samym adresem co proxy. Jeśli inne urządzenie może połączyć się z Marinarą bezpośrednio, pomija logowanie proxy.
- **Wpisz tylko własny adres proxy.** Zakres musi mieścić się w prywatnej przestrzeni adresowej; Marinara ignoruje inne zakresy. Zapisuje ostrzeżenie dla każdego zakresu, bo każde urządzenie w zakresie pomija logowanie.
- **Dodaj publiczną nazwę jak dla każdego innego proxy.** Wpisz nazwę hosta w `TRUSTED_HOSTS`, a źródło w `CSRF_TRUSTED_ORIGINS` (zobacz [Dlaczego zapis jest blokowany (CSRF)](#why-is-my-save-blocked-csrf)).

Gdy ustawiono `TRUSTED_AUTH_PROXY`, Marinara wyłącza też automatyczne zaufanie do Dockera. Goście bezpośredni, którzy nie są proxy, potrzebują logowania do Marinary albo listy dozwolonych adresów IP. Marinara nie pokazuje wtedy też banera „no login yet”.

Jeśli proxy działa na tym samym komputerze co Marinara, użyj `TRUSTED_AUTH_PROXY=127.0.0.1` i skieruj proxy na `127.0.0.1:7860`, nie na `localhost:7860`. Proxy, które łączy się z `localhost`, może połączyć się z `::1`, co nie pasuje do `127.0.0.1`. Wtedy każde inne proxy albo tunel na tym komputerze też jest zaufane, więc używaj tego tylko wtedy, gdy proxy logowania jest jedyne. To nie daje gościom przez proxy dostępu lokalnej maszyny.

Przykład dla Caddy, z Marinarą pod `192.168.1.20:7860`:

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Dla Authelii użyj `forward_auth authelia:9091` z `uri /api/authz/forward-auth`. Authentik też obsługuje własne strony logowania przez proxy. Umieść jego linie w bloku `route`, żeby Caddy zachował ich kolejność, a ścieżka outpost nie przechodziła sama przez forward auth:

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Dla Traefika i nginx postępuj według przewodnika forward-auth swojego proxy. Marinara nie potrzebuje niczego więcej poza adresem proxy.

## Udostępnianie przez HTTPS

HTTPS szyfruje połączenie za pomocą TLS. TLS to szyfrowanie, które zamienia zwykły adres `http` w bezpieczny adres `https`. Zawsze używaj HTTPS przy instalacji dostępnej spoza w pełni zaufanej sieci prywatnej, zwłaszcza razem z Basic Auth.

Są na to dwa sposoby.

1. Wbudowany TLS. Wskaż serwerowi plik certyfikatu i plik klucza prywatnego:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Odwrotne proxy. Postaw aplikację Marinara za nginx, Caddy, Traefik albo Cloudflare Tunnel. Proxy obsługuje część HTTPS i przekazuje ruch do aplikacji Marinara zwykłym HTTP na tym samym komputerze. Najpierw przeczytaj sekcję [Odwrotne proxy i tunele na tym samym komputerze](#reverse-proxies-and-tunnels-on-the-same-computer).

Zanim ustawisz `SSL_CERT` i `SSL_KEY`, potrzebujesz certyfikatu i klucza. Do użytku lokalnego wygenerujesz je narzędziem `mkcert`, a dla publicznej domeny narzędziem `certbot`. Jeśli plików brakuje albo nie da się ich odczytać, serwer zatrzymuje się przy starcie i podaje dokładne ścieżki, których szukał.

## Sekcja Admin Access i działania uprzywilejowane

Część działań jest szczególnie wrażliwa: czyszczenie danych, tworzenie i pobieranie kopii zapasowych, import i eksport profili, instalowanie motywów oraz instalacja środowiska Local Model. Wymagają one osobnego wspólnego sekretu, nazywanego sekretem administratora, niezależnie od wybranej wyżej opcji dostępu.

Na komputerze z serwerem te działania zwykle udają się bez sekretu administratora. Ze zdalnego urządzenia sekret trzeba najpierw ustawić. Wykonaj kolejno te kroki.

1. W pliku `.env` wpisz silną, losową wartość i zapisz plik. Zmiana działa w ciągu kilku sekund, bez restartu.

```env
ADMIN_SECRET=some-long-random-string
```

2. Na zdalnym urządzeniu otwórz aplikację Marinara i przejdź do sekcji **Settings** (Ustawienia), potem do zakładki **Advanced**, a następnie do sekcji **Admin Access**.
3. Wklej tę samą wartość do pola (jego tekst zastępczy to **ADMIN_SECRET**) i kliknij przycisk **Save** (Zapisz).
4. Powinien pojawić się komunikat **Admin secret saved for this browser**.

Kilka rzeczy, które warto wiedzieć o sekrecie administratora:

- Sekret zostaje tylko w tej jednej przeglądarce. Nie synchronizuje się między urządzeniami. Każda przeglądarka, która ma wykonywać działania uprzywilejowane, potrzebuje osobnego wklejenia.
- Kliknięcie przycisku **Save** przy pustym polu kasuje sekret i pokazuje komunikat **Admin secret cleared**.
- Gdy osoba prowadząca serwer ustawi `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, sekret jest potrzebny nawet na komputerze z serwerem.
- To mechanizm niezależny od Basic Auth i oba da się stosować naraz. Basic Auth pilnuje wejścia do całej aplikacji, a sekret administratora pilnuje niebezpiecznych działań.

Kiedy działanie uprzywilejowane nie uda się na zdalnym urządzeniu, Marinara pokazuje komunikat o błędzie z dwoma rozwiązaniami. Pierwsze: otworzyć aplikację przez localhost. Drugie: ustawić `ADMIN_SECRET` w pliku `.env` serwera, a potem wkleić tę samą wartość w **Settings** > **Advanced** > **Admin Access**.

<a id="why-is-my-save-blocked-csrf"></a>

## Dlaczego zapis jest blokowany (CSRF)

CSRF to skrót od cross-site request forgery, czyli fałszowania żądań między witrynami. To zabezpieczenie nie pozwala innej otwartej stronie po cichu zmieniać czegokolwiek w aplikacji Marinara bez twojej zgody. Działa automatycznie i nie ma ustawienia, które trzeba włączyć.

Czasem CSRF blokuje też twoje własne zapisy. Dzieje się tak zwykle przy wejściu do aplikacji Marinara przez publiczną nazwę domeny albo nietypowy port, którego serwer jeszcze nie zna. Poznasz to po dwóch rzeczach.

- Czerwony pasek na górze aplikacji ostrzega, że **Saves will silently fail**, bo to źródło nie jest zaufane. Pasek pokazuje dokładną linię do dopisania w pliku `.env` i ma przycisk **Copy** (Kopiuj).
- Przy faktycznie odrzuconym zapisie pojawia się małe okienko z komunikatem. Jego tytuł to **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** albo **Save blocked: origin not trusted**.

Żeby to naprawić, dopisz swój adres do listy zaufanych w pliku `.env`:

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Przy publicznej domenie albo domenie odwrotnego proxy dopuść też nazwę hosta:

```env
TRUSTED_HOSTS=chat.example.com
```

Bezpośrednie adresy w sieci LAN i Tailscale oraz adresy IPv4 i IPv6 nie wymagają `TRUSTED_HOSTS`. Lokalne nazwy `.local`/`.home.arpa` i jednoczłonowe nazwy komputerów są akceptowane automatycznie. Dokładna nazwa hosta wpisana już w `CSRF_TRUSTED_ORIGINS` również przechodzi.

Loopback, zwykłe adresy w sieci LAN, Tailscale (`100.64.0.0/10`) i mostek Docker (`172.16.0.0/12`) są zaufane automatycznie. Wypisywać trzeba tylko publiczne adresy IP i nazwy domen. Zmiana działa w ciągu kilku sekund, bez restartu.

## Uwaga o blokowanych lokalnych dostawcach

Załóżmy, że łączysz aplikację Marinara z lokalnym dostawcą AI, na przykład takim, który działa na tym samym komputerze. Żądanie może zostać odrzucone z komunikatem o "private, loopback, metadata, or reserved IP range". To inne zabezpieczenie, nazywane ochroną SSRF. SSRF to skrót od server-side request forgery, czyli fałszowania żądań po stronie serwera. Blokuje ono wywołania serwera pod adresy prywatne, dopóki nie zostaną dopuszczone. Komunikat błędu podaje dokładną zmienną z pliku `.env`, na przykład `PROVIDER_LOCAL_URLS_ENABLED`. Pełną listę znajdziesz w dokumencie [Konfiguracja serwera](CONFIGURATION.md).

## Dostęp z telefonu lub tabletu

Żeby otworzyć aplikację Marinara na telefonie lub tablecie w tej samej sieci:

1. Sprawdź, czy serwer nasłuchuje na wszystkich interfejsach – w pliku `.env` musi być `HOST=0.0.0.0`.
2. Ustaw logowanie (opcja 1 powyżej). Z telefonu możesz to zrobić na stronie, która cię blokuje, za pomocą kodu konfiguracji z logu serwera.
3. Ustal lokalny adres IP komputera z serwerem (na przykład `192.168.1.50`).
4. Otwórz na telefonie adres `http://192.168.1.50:7860` w przeglądarce. Domyślny port to `7860`.
5. Zaloguj się swoją nazwą użytkownika i hasłem.

Jeśli strona w ogóle się nie wczytuje, serwer prawdopodobnie jest nieosiągalny. Sprawdź `HOST=0.0.0.0` i wartość `PORT`. Błąd 403 oznacza co innego: urządzenie dociera do serwera, ale nie ma jeszcze wstępu. Wróć do wybranej wyżej opcji i sprawdź ją jeszcze raz.

<a id="locked-out-after-updating"></a>

## Zablokowany dostęp po aktualizacji

Nowsze wersje wymagają logowania, gdy wizyta przychodzi przez odwrotne proxy, tunel, Tailscale Serve lub Tailscale Funnel. Starsze wersje wpuszczały takie wizyty bez hasła. Jeśli teraz widzisz stronę logowania, stronę konfiguracji albo **403**, to jest powód.

**Uwaga przy aktualizacji:** jeśli używasz Tailscale Serve albo innego proxy na tym samym komputerze i nigdy nie ustawiłeś hasła, twoje inne urządzenia są po aktualizacji zablokowane. Proxy na tym samym komputerze zwykle łączy się z serwerem, który nasłuchuje tylko na loopbacku, więc serwer nie wypisuje kodu konfiguracji. Ustaw logowanie na komputerze, na którym działa aplikacja Marinara.

Aby wrócić:

1. Otwórz aplikację Marinara na komputerze, na którym działa, pod adresem `http://localhost:7860` (lub własnym `PORT`). Użycie lokalne nie wymaga hasła. Na serwerze bez interfejsu najpierw uruchom na własnym komputerze `ssh -L 7860:127.0.0.1:7860 user@server`, potem otwórz tam `http://localhost:7860`. W Dockerze to działa tylko wtedy, gdy nie ustawiono logowania ani `IP_ALLOWLIST`. W przeciwnym razie wpisz kod konfiguracji z logu serwera (`docker logs <container> 2>&1 | grep "setup code"`) na stronie, która cię blokuje, albo w **Settings → Advanced → Access**, albo użyj przeglądarki, która jest jeszcze zalogowana.
2. Przejdź do **Settings → Advanced → Access** i ustaw nazwę użytkownika oraz hasło w sekcji **Remote login**. Albo otwórz plik `.env` na tym komputerze i ustaw `BASIC_AUTH_USER` oraz `BASIC_AUTH_PASS`. Jeśli ustawiono `IP_ALLOWLIST`, dodaj do niej adres swojego drugiego urządzenia albo usuń to ustawienie, bo urządzenie spoza listy dostaje **403** nawet po zalogowaniu.
3. Zaloguj się z drugiego urządzenia tą nazwą użytkownika i tym hasłem.

## Wyszukiwarki

Marinara prosi wyszukiwarki, aby nie indeksowały jego stron (`X-Robots-Tag: noindex, nofollow`). Nie chroni to Twojej instalacji i nie usuwa stron, które są już zindeksowane. Aby zachować prywatność instalacji, użyj opisanych wyżej kontroli dostępu.

## Powiązane przewodniki

- [Konfiguracja serwera](CONFIGURATION.md) – pełna lista ustawień z pliku `.env` i przypadki brzegowe.
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md) – błędy połączeń, dostęp z urządzeń mobilnych i więcej.
- [Najczęściej zadawane pytania](FAQ.md) – szybkie omówienie dostępu do aplikacji Marinara z innego urządzenia.
