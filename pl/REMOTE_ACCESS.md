# Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP

Z tego przewodnika dowiesz się, jak połączyć się z aplikacją Marinara Engine z innego urządzenia: telefonu, laptopa albo kontenera Docker. Opisuje dwie główne opcje: Basic Auth i listę dozwolonych adresów IP. Wyjaśnia też pominięcie ochrony w sieci prywatnej, HTTPS, sekcję **Admin Access** (dostęp administracyjny) oraz komunikat CSRF o zablokowanym zapisie. Prawie każde ustawienie z tego przewodnika znajduje się w pliku `.env` serwera, a nie w aplikacji.

Kilka pojęć, które wracają w całym przewodniku:

- plik `.env`: zwykły tekstowy plik ustawień w folderze aplikacji Marinara Engine, obok `package.json`.
- Loopback: komputer, na którym rzeczywiście działa serwer. Jego adres to `127.0.0.1` albo `localhost`.
- Dostęp zdalny: otwarcie aplikacji Marinara na dowolnym urządzeniu, które NIE jest komputerem z serwerem.

## Co Marinara blokuje domyślnie

Świeża instalacja aplikacji Marinara odrzuca połączenia z innych urządzeń, dopóki nie skonfigurujesz kontroli dostępu. Chodzi o ochronę danych. Domyślnie zaufane są tylko trzy rodzaje klientów:

1. Loopback (`127.0.0.1` lub `::1`), czyli sam komputer z serwerem. Nie liczą się do niego goście przekazywani przez odwrotne proxy albo tunel na tym samym komputerze; zobacz [Odwrotne proxy i tunele na tym samym komputerze](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Urządzenia w sieci Tailscale. Tailscale to narzędzie do prywatnych sieci, a jego adresy mieszczą się w zakresie `100.64.0.0/10`.
3. Klienty Docker na tym samym komputerze. Marinara rozpoznaje typowy zakres mostka `172.16.0.0/12` oraz dokładną bramę domyślną kontenera, co obejmuje też Docker Desktop i własne pule adresów.

Wszystko inne, na przykład telefon w tej samej sieci Wi-Fi albo klient z publicznego internetu, jest zablokowane do czasu wybrania jednej z poniższych opcji. Zablokowane urządzenie, które otworzy aplikację Marinara w przeglądarce, widzi ciemną stronę konfiguracyjną. Jej tytuł brzmi **This Marinara Engine install needs access control before remote devices can connect.** Strona pokazuje adres IP tego urządzenia oraz dwa gotowe do skopiowania fragmenty pliku `.env`.

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

Skrypty startowe (`start.bat`, `start.sh`) ustawiają `HOST=0.0.0.0` same. Uruchomienie `pnpm start` wprost tego nie robi.

## Którą opcję wybrać

Czytaj po kolei i zatrzymaj się przy pierwszym pasującym punkcie.

1. Łączysz się wyłącznie przez sieć Tailscale albo tylko z kontenerów Docker na tym samym komputerze. Nie trzeba nic robić, to już działa.
2. Chcesz otworzyć aplikację Marinara na telefonie, tablecie albo laptopie w domowej sieci Wi-Fi. Wybierz Basic Auth (opcja 1 poniżej).
3. Udostępniasz aplikację Marinara w publicznym internecie. Wybierz Basic Auth razem z HTTPS.
4. Urządzenia klienckie mają stałe adresy IP, a wpisywanie hasła jest niewygodne. Wybierz listę dozwolonych adresów IP (opcja 2 poniżej).
5. Cała sieć jest zaufana i hasło nie jest w ogóle potrzebne. Wybierz pominięcie ochrony w sieci prywatnej (opcja 3 poniżej). Najpierw przeczytaj tamtejsze ostrzeżenie.

Basic Auth to najbardziej elastyczny wybór. Działa z każdego adresu IP, nie wymaga konfiguracji na każdym urządzeniu, a przeglądarka zapamiętuje dane logowania.

## Opcja 1: Basic Auth (zalecana)

Basic Auth działa tak, że przeglądarka pyta o nazwę użytkownika i hasło, zanim wpuści do aplikacji. Aby to włączyć, dodaj dwie linie do pliku `.env`:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Wybierz silne i unikalne hasło. Basic Auth wysyła dane logowania przy każdym żądaniu, więc traktuj je jak każde inne hasło do konta. Losowe hasło da się wygenerować:

```bash
openssl rand -base64 24
```

Zapisz plik `.env`. Zmiana działa w ciągu kilku sekund, bez restartu. Potem wykonaj kolejno te kroki na zdalnym urządzeniu.

1. Otwórz aplikację Marinara w przeglądarce pod adresem serwera, na przykład `http://192.168.1.50:7860`.
2. Kiedy przeglądarka o to poprosi, wpisz ustawioną nazwę użytkownika i hasło.
3. Aplikacja powinna się załadować. Przeglądarka pamięta dane logowania do końca sesji.

Po 10 różnych błędnych hasłach w ciągu 15 minut Marinara odrzuca logowania z tego adresu z kodem **429 Too Many Requests**, dopóki te 15 minut nie minie. Poprawne hasło wpisane wcześniej zeruje licznik. Goście przekazywani przez odwrotne proxy albo tunel na komputerze z serwerem mają jeden wspólny licznik, a zalogowanie się jednego z nich go nie zeruje. Licznik zeruje też restart serwera. Przeglądarka, która logowała się już wcześniej, nadal wchodzi po podaniu poprawnego hasła, więc cudze błędne hasła nie zablokują ci dostępu z urządzenia, z którego już korzystasz.

Domyślnie okno przeglądarki pokazuje napis **Marinara Engine**. Ten tekst zmienia zmienna `BASIC_AUTH_REALM`.

Część klientów pomija hasło nawet przy włączonym Basic Auth:

- Loopback (`127.0.0.1`, `::1`), więc na samym komputerze z serwerem hasło nigdy nie jest potrzebne. Goście przekazywani przez odwrotne proxy albo tunel na tym komputerze nadal go potrzebują.
- Każdy adres z `IP_ALLOWLIST`. Uwaga: ustawienie listy blokuje jednocześnie wszystkie adresy spoza niej (zobacz opcję 2).
- Bezpośredni ruch z sieci Tailscale (`100.64.0.0/10`), o ile pominięcie nie zostanie wyłączone.
- Ruch z mostka lub bramy Docker, tylko gdy ustawisz `BYPASS_AUTH_DOCKER=true`. Przy włączonym Basic Auth automatyczne zaufanie do ruchu Docker jest wyłączone (zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](#tailscale-and-docker-bypass)).
- Adres `/api/health`, dzięki czemu monitory dostępności dalej działają. Bez hasła zwraca on tylko podstawowy stan, bez informacji o twoich lokalnych modelach i karcie graficznej.

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
- Bezpośredni ruch z sieci Tailscale też pomija listę, o ile pominięcie nie zostanie wyłączone. Ruch z mostka lub bramy Docker pomija ją tylko wtedy, gdy ustawisz `BYPASS_AUTH_DOCKER=true` (zobacz [Pominięcie dla sieci Tailscale i kontenerów Docker](#tailscale-and-docker-bypass)).
- Marinara pomija błędne wpisy i zapisuje je w logach. Nie powodują awarii serwera.
- Lista pozostaje rygorystyczna nawet przy włączonym Basic Auth. Adresy z listy nie widzą pytania o hasło. Pozostałe adresy dostają **403 Forbidden** i nigdy nie zobaczą okna logowania.

Lista nie tworzy układu mieszanego, w którym wskazane urządzenia wchodzą bez hasła, a reszta się loguje. Jeśli pozostałe urządzenia mają logować się hasłem, zostaw `IP_ALLOWLIST` bez wartości i użyj samego Basic Auth.

Egzekwowanie listy da się wyłączyć na chwilę, bez kasowania jej zawartości. Przydaje się to przy szukaniu problemów z nowego adresu IP. Ustaw flagę włączenia na false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Opcja 3: pominięcie ochrony w sieci prywatnej (bez hasła)

Cała sieć bywa zaufana, na przykład domowa sieć LAN (sieć lokalna) bez przekierowania portów. W takim wypadku blokadę da się zdjąć bez ustawiania hasła:

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

Wraca wtedy dawne zachowanie: "otwarte w sieci LAN, zablokowane z publicznego internetu". Dotyczy to wyłącznie standardowych zakresów sieci prywatnych, na przykład `10.0.0.0/8`, `172.16.0.0/12` i `192.168.0.0/16`. Liczy się też zakres CGNAT `100.64.0.0/10`. CGNAT to system współdzielonych adresów, którego używa część dostawców internetu, a Tailscale korzysta z tego samego zakresu. Adresy z publicznego internetu nadal dostają błąd 403.

Ostrzeżenie: każdy w tej samej sieci dostanie się wtedy do aplikacji Marinara bez hasła. W sieci pod twoją kontrolą to nie problem. We współdzielonym Wi-Fi w kawiarni, na lotnisku czy w akademiku – już tak. W razie wątpliwości wybierz Basic Auth.

Istnieje też szersza flaga `ALLOW_UNAUTHENTICATED_REMOTE=true`, która otwiera dostęp bez hasła z DOWOLNEGO adresu, łącznie z publicznym internetem. Nie włączaj jej. Jeśli dostęp publiczny jest naprawdę potrzebny, użyj Basic Auth razem z HTTPS albo postaw przed serwerem odwrotne proxy, które przejmie logowanie.

<a id="tailscale-and-docker-bypass"></a>

## Pominięcie dla sieci Tailscale i kontenerów Docker

Dwie flagi pozwalają bezpośredniemu ruchowi z sieci Tailscale i z kontenerów Docker pominąć zarówno listę dozwolonych adresów IP, jak i Basic Auth, dokładnie tak samo jak robi to loopback. Zostaw je puste, żeby korzystać z automatycznego wykrywania:

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

Tryb automatyczny ufa urządzeniu Tailscale tylko wtedy, gdy oba końce jego bezpośredniego gniazda używają adresów sieci Tailscale. Ruch Docker jest zaufany tylko wtedy, gdy Marinara Engine działa w kontenerze, a źródło pasuje do wykrytego interfejsu kontenera albo jego dokładnej bramy. Dzięki temu zwykła prywatna konfiguracja sieci Tailscale i kontenerów Docker na tym samym komputerze nadal działa, ale niezwiązany ruch CGNAT, LAN, sieci hosta ani proxy nie jest uznawany za uwierzytelniony.

Automatyczne zaufanie do ruchu Docker działa tylko wtedy, gdy nie ustawiono ani Basic Auth, ani `IP_ALLOWLIST`. Docker Desktop, OrbStack i rootless Docker przepuszczają każde urządzenie, które otwiera opublikowany port, przez bramę kontenera, więc Marinara nie odróżni twojej przeglądarki od telefonu albo obcej osoby w sieci. Po ustawieniu hasła albo listy dozwolonych adresów każdy klient Docker musi przejść te kontrole, łącznie z przeglądarką na komputerze z serwerem. Ustaw `BYPASS_AUTH_DOCKER=true` tylko wtedy, gdy ufasz każdemu urządzeniu, które może dotrzeć do opublikowanego portu.

Ustaw flagę na `false`, jeśli wobec tych klientów mają obowiązywać zwykłe kontrole Basic Auth i listy dozwolonych adresów IP. Ustaw `true`, żeby zachować starsze szerokie pominięcie, gdy automatyczne wykrywanie jest niedostępne: Tailscale ufa wtedy całemu zakresowi `100.64.0.0/10`, a Docker także wykrytym interfejsom i bramie oraz starszemu zakresowi `172.16.0.0/12`. Używaj tego trybu zgodności tylko wtedy, gdy każdy pasujący klient jest zaufany.

Jeśli na przykład w twojej sieci Tailscale są mniej zaufane urządzenia, wyłącz pominięcie dla sieci Tailscale:

```env
BYPASS_AUTH_TAILSCALE=false
```

Jeśli wykryte urządzenia Docker nie mają omijać uwierzytelniania, wyłącz pominięcie Docker i w razie potrzeby dodaj konkretne klienty do `IP_ALLOWLIST`:

```env
BYPASS_AUTH_DOCKER=false
```

Aplikacja Marinara Engine bywa też ustawiona za kontenerem z odwrotnym proxy albo z tunelem, działającym na mostku Docker lub na wykrytej bramie. Nagłówki przekazywania, takie jak `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host` lub `X-Forwarded-Proto`, oznaczają, że klient Docker reprezentuje inne urządzenie, więc Marinara domyślnie stosuje wtedy zwykłe kontrole Basic Auth i listy dozwolonych adresów IP:

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

Żeby przywrócić dawne pominięcie, ustaw tę flagę na `false`. Rób to tylko wtedy, gdy każdy klient zdolny dotrzeć do proxy jest zaufany, bo przekazywani klienci odziedziczą bezhasłowy status ruchu Docker.

Przy pierwszym żądaniu przepuszczonym przez takie pominięcie serwer zapisuje w logach ostrzeżenie `[auth-bypass]`. To potwierdzenie, że pominięcie działa.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Odwrotne proxy i tunele na tym samym komputerze

Odwrotne proxy albo tunel na komputerze, na którym działa Marinara, na przykład nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve lub Funnel albo ngrok, łączy się z aplikacją Marinara Engine przez loopback. Marinara rozpoznaje to po nagłówkach przekazywania, które dodaje proxy: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, nagłówkach tożsamości Tailscale albo `Via`. Każde takie żądanie traktuje wtedy tak, jak należy, czyli jako żądanie zdalnego gościa:

- Obowiązuje Basic Auth, więc ustaw `BASIC_AUTH_USER` i `BASIC_AUTH_PASS`. Bez nich goście widzą stronę konfiguracyjną.
- `IP_ALLOWLIST` blokuje przekazywanych gości, bo proxy ukrywa ich prawdziwe adresy.
- Działania uprzywilejowane wymagają sekretu administratora, a funkcje dostępne tylko przez loopback pozostają niedostępne.

Twoja własna przeglądarka na tym komputerze, otwarta pod adresem `http://127.0.0.1:7860` albo `http://localhost:7860`, nadal działa bez hasła.

Caddy, Traefik, Cloudflare Tunnel, Tailscale i ngrok domyślnie dodają nagłówki przekazywania. W przypadku nginx dodaj tę linię do bloku `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Narzędzia przekazujące surowe połączenia, takie jak `socat` albo `ssh -R`, nie dodają żadnych nagłówków, więc ich ruch wygląda na lokalny. Nie publikuj nimi aplikacji Marinara Engine.

Jeśli twoje proxy już wymaga logowania od każdego gościa, zanim cokolwiek przekaże, możesz pominąć własne kontrole aplikacji Marinara Engine dla jego ruchu:

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

Goście dostają wtedy taki sam pełny dostęp jak komputer z serwerem, łącznie z działaniami uprzywilejowanymi bez sekretu administratora. Rób to tylko wtedy, gdy logowanie w proxy chroni każdą ścieżkę.

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
2. Wybierz jedną z powyższych opcji dostępu. Dla telefonu w domowej sieci Wi-Fi najprostszy jest Basic Auth.
3. Ustal lokalny adres IP komputera z serwerem (na przykład `192.168.1.50`).
4. Otwórz na telefonie adres `http://192.168.1.50:7860` w przeglądarce. Domyślny port to `7860`.
5. Przy włączonym Basic Auth wpisz nazwę użytkownika i hasło, gdy pojawi się pytanie.

Jeśli strona w ogóle się nie wczytuje, serwer prawdopodobnie jest nieosiągalny. Sprawdź `HOST=0.0.0.0` i wartość `PORT`. Błąd 403 oznacza co innego: urządzenie dociera do serwera, ale nie ma jeszcze wstępu. Wróć do wybranej wyżej opcji i sprawdź ją jeszcze raz.

## Powiązane przewodniki

- [Konfiguracja serwera](CONFIGURATION.md) – pełna lista ustawień z pliku `.env` i przypadki brzegowe.
- [Rozwiązywanie problemów w aplikacji Marinara Engine](TROUBLESHOOTING.md) – błędy połączeń, dostęp z urządzeń mobilnych i więcej.
- [Najczęściej zadawane pytania](FAQ.md) – szybkie omówienie dostępu do aplikacji Marinara z innego urządzenia.
