# Music DJ: Spotify, YouTube i muzyka lokalna

Z tego przewodnika dowiesz się, jak odtwarzać muzykę w tle w aplikacji Marinara Engine za pomocą agenta **Music DJ**. Zobaczysz, jak podłączyć Spotify, YouTube albo własne pliki muzyczne. Poznasz też odtwarzacz muzyki, kreator playlist **DJ Mari** oraz muzykę w trybie Game Mode.

## Czym jest Music DJ

**Music DJ** to opcjonalny agent do pobrania. Agent to pomocnik, który działa automatycznie w tle czatu. Otwórz sekcję **Agents** (Agenci), wybierz **Download Agents** (pobieranie agentów) i zainstaluj agenta **Music DJ**, zanim przejdziesz do konfiguracji. Po każdej odpowiedzi Music DJ rozpoznaje nastrój sceny i odtwarza pasującą muzykę w tle.

Agent **Music DJ** odtwarza muzykę z trzech źródeł:

- **Spotify**: steruje odtwarzaniem na prawdziwym koncie Spotify i na twoich urządzeniach.
- **YouTube**: wyszukuje w serwisie YouTube i odtwarza wynik w małym odtwarzaczu w aplikacji. Logowanie nie jest potrzebne.
- **Custom**: odtwarza własne pliki dźwiękowe z folderu na komputerze, na którym działa Marinara.

Aktywne źródło widać jako mały odtwarzacz **Music Player** przypięty do górnego paska aplikacji. Na telefonach i w wąskich oknach zmienia się w mały pływający okrągły widget, który da się przeciągać.

Po instalacji agent **Music DJ** jest domyślnie wyłączony. Włącza się go dla czatu tak samo jak każdego innego agenta. Działa w czatach w trybie **Roleplay**, a w trybie **Game** przez osobny przełącznik (patrz Music DJ w trybie Game Mode poniżej). W trybie **Conversation** służy do tego komenda **Music** (patrz Komenda Music w trybie Conversation poniżej).

Agenta **Music DJ** konfiguruje się w jednym wspólnym miejscu. Otwórz prawy panel boczny **Agents**, a potem pozycję **Music DJ**. Inna opcja: kliknij ikonę koła zębatego na mini odtwarzaczu. Jej podpowiedź brzmi **Music DJ setup**.

### Wybór źródła muzyki

W edytorze **Music DJ** pole **Music Player** ma trzy przyciski: **Spotify**, **YouTube** i **Custom**. Tekst pomocy brzmi "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."

Pod przyciskami linia tekstu pokazuje aktywne źródło, na przykład "Visible player: Spotify. Saved provider: Spotify." Wybór źródła obowiązuje w całej aplikacji. Nie zapisuje się osobno dla każdego czatu.

Oto szybka ściągawka:

| Źródło | Potrzebne konto | Koszt | Najlepsze do |
|---|---|---|---|
| **Spotify** | Własne konto Spotify oraz Spotify Premium do odtwarzania | Konfiguracja za darmo, odtwarzanie w ramach Premium | Prawdziwe, konkretne utwory na twoich urządzeniach |
| **YouTube** | Darmowy klucz API Google | Bezpłatnie | Odtwarzanie bez logowania i bez Premium |
| **Custom** | Żadne | Bezpłatnie | Własne pliki dźwiękowe na dysku |

## Konfiguracja Spotify

Spotify korzysta z twojej własnej, darmowej aplikacji deweloperskiej Spotify. Wklejasz tylko **Spotify Client ID**. Nie trzeba podawać sekretu klienta.

Otwórz edytor **Music DJ** i znajdź pole **Spotify Connection**. Następnie wykonaj kolejno te kroki.

1. Otwórz panel **Spotify Developer Dashboard** pod adresem podanym w aplikacji.
2. Utwórz nową aplikację i wybierz "Web API".
3. W polu Redirect URIs tej aplikacji dodaj dokładny adres przekierowania, który Marinara pokazuje w kroku 3 okna konfiguracji. Adres przekierowania to adres internetowy, na który Spotify odsyła po zalogowaniu.
4. Skopiuj **Client ID** ze swojej aplikacji Spotify i wklej go w pole **Spotify Client ID**.
5. Zapisz agenta, a potem kliknij przycisk **Connect Spotify Account**.

Otworzy się okno logowania i zgód Spotify. Po zatwierdzeniu okno pokazuje krótką stronę "Spotify Connected!" i zamyka się. W aplikacji Marinara Engine powinien pojawić się zielony kafelek **Connected to Spotify**. Przycisk **Disconnect** usuwa zapisane połączenie.

Aplikacja pokazuje taką uwagę: "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." Darmowe konto Spotify można podłączyć, ale odtwarzanie, pauza, przewijanie i sterowanie głośnością wymagają Spotify Premium. Premium to płatny plan Spotify.

### Uwagi o urządzeniach Spotify

Spotify odtwarza muzykę przez urządzenie: telefon, aplikację Spotify na komputerze albo odtwarzacz w aplikacji.

Na komputerze samą zakładkę przeglądarki da się zamienić w urządzenie Spotify. Kliknij ikonę laptopa na mini odtwarzaczu. Jej podpowiedź brzmi **Enable Marinara player** albo **Use Marinara player**. To rejestruje urządzenie Spotify o nazwie "Marinara Engine", więc muzyka płynie prosto do zakładki. Odtwarzanie w aplikacji też wymaga Spotify Premium.

Na telefonie odtwarzacz woli urządzenie Spotify samego telefonu. Dlatego dotknięcie przycisku odtwarzania uruchamia muzykę na telefonie, a nie w zakładce przeglądarki działającej w tle.

Jeśli urządzenie Spotify nie pozwala na zdalną zmianę głośności, zamiast suwaka pojawia się przycisk **Use device volume**. Skorzystaj wtedy z przycisków głośności samego urządzenia.

### Spotify na innym komputerze

Spotify przyjmuje wyłącznie bezpieczne adresy przekierowania `https://` albo adres pętli zwrotnej `http://127.0.0.1`. Pętla zwrotna oznacza ten sam komputer. Jeśli Marinara działa na innym komputerze po zwykłym `http`, okno logowania może się nie wczytać.

Pomagają tu dwie opcje:

- W trakcie łączenia rozwiń sekcję "Browser couldn't reach the callback?" pod przyciskiem **Connect Spotify Account**. Skopiuj pełny adres z okna, które się nie wczytało, wklej go w pole i kliknij przycisk **Complete connection**.
- Możesz też ustawić stały adres przekierowania zmienną środowiskową na serwerze. Zmienna środowiskowa to ustawienie serwera odczytywane przy starcie.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

O tym, jak ustawiać zmienne środowiskowe, mówi [Konfiguracja serwera](../CONFIGURATION.md).

## Konfiguracja YouTube

Tryb YouTube wymaga darmowego klucza API YouTube Data. Klucz API to tajny kod, dzięki któremu Marinara korzysta z usługi w twoim imieniu. Logowanie do YouTube ani Premium nie są potrzebne.

Otwórz edytor **Music DJ** i znajdź pole **YouTube Connection**. Następnie wykonaj kolejno te kroki.

1. Otwórz panel **Google Cloud Console** pod adresem podanym w aplikacji, a potem utwórz albo wybierz projekt.
2. Włącz **YouTube Data API v3**.
3. Przejdź do Credentials, potem Create credentials, potem API key.
4. Wklej klucz w pole **YouTube Data API Key**.
5. Kliknij przycisk **Save Key**. Po zapisaniu przycisk zmienia nazwę na **Update Key**, a obok pojawia się zielony kafelek "API key configured". Odnośnik **Remove** usuwa klucz.

Zostaw klucz bez ograniczeń albo ogranicz go wyłącznie po API i wskaż YouTube Data API v3. Nie ograniczaj go po nagłówku HTTP referrer. Wyszukiwanie działa po stronie serwera, więc takie ograniczenie by je zablokowało.

Aplikacja pokazuje taką uwagę: "The free quota (~100 searches/day) is plenty for a personal DJ." Quota to dzienny limit użycia. Ta liczba pochodzi z tekstu samej aplikacji i z czasem może się zmienić. Klucz zostaje na serwerze, a Marinara szyfruje go przed zapisem.

## Muzyka własna (Custom)

Tryb Custom odtwarza własne pliki dźwiękowe z komputera, na którym działa serwer aplikacji Marinara Engine. Obsługiwane typy plików to `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` i `.webm`.

Otwórz edytor **Music DJ** i znajdź pole **Custom Music Library**. Ma ono jeden przełącznik: **Use Game Assets music folder**.

- Przełącznik włączony: tryb Custom czyta dźwięki wgrane do Game Assets. Game Assets to wbudowana biblioteka zasobów aplikacji Marinara Engine dla trybu Game Mode. Folder wskazuje się w polu **Game Assets music folder**. Wpisz `music`, żeby objąć całą bibliotekę muzyki, albo podfolder w rodzaju `music/combat`. Przycisk **Open Folder** otwiera ten folder na komputerze z serwerem.
- Przełącznik wyłączony: tryb Custom czyta folder na urządzeniu z serwerem. Kliknij przycisk **Select Folder**, żeby otworzyć okno wyboru folderu na komputerze z serwerem, albo wklej ścieżkę w pole **Music folder on this device**.

Konfiguracja czatu w trybie Roleplay i Game pokazuje to samo wybrane źródło. Jeśli wybrany jest folder na urządzeniu z serwerem, ustawienia Music DJ w czacie pokazują zapisaną ścieżkę i przycisk **Choose Folder**, zamiast pytać o ścieżkę w Game Assets.

Odtwarzanie z folderu spoza Game Assets wymaga lokalnego dostępu na serwerze. Jeśli korzystasz z aplikacji Marinara Engine z innego urządzenia bez hasła lub sekretu administratora, akurat ta jedna funkcja może być zablokowana. Zobacz [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

## Korzystanie z odtwarzacza muzyki

Odtwarzacz **Music Player** pojawia się jako mały kafelek na górnym pasku na komputerze albo jako przeciągany pływający widget na telefonie. Da się go ukryć i pokazać w ustawieniach.

Otwórz **Settings** (Ustawienia), przejdź do zakładki **General** i znajdź sekcję **App Behavior**. Przestaw przełącznik **Music Player**. Tekst pomocy brzmi "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings." Ten przełącznik jest dostępny zawsze i domyślnie włączony. Kiedy jest włączony, a agent Music DJ nie został zainstalowany, odtwarzacz na komputerze i na telefonie pokazuje zamiast tego napis **Download Music DJ Agent to configure** oraz przycisk **Download Agents**.

W świeżym profilu widoczne źródło startuje na **YouTube**. Źródło zmienia się na trzy sposoby:

- Małym okrągłym przełącznikiem źródła na odtwarzaczu. Jego podpowiedź brzmi "Switch to ... player".
- Przyciskami **Music Player** w edytorze **Music DJ**.
- Przez ustawienia **Music DJ** w czacie.

Odtwarzacz pokazuje okładkę lub miniaturę bieżącego utworu, tytuł oraz wykonawcę albo kanał. Dostępne kontrolki zależą od źródła.

- Spotify: losowa kolejność, **Previous**, odtwarzanie lub pauza, **Next**, powtarzanie, suwak głośności z wyciszeniem, przycisk **DJ**, przycisk laptopa **Marinara player** i koło zębate **Music DJ setup**.
- YouTube: odtwarzanie lub pauza, strzałka rozwijania małego panelu wideo 16:9, przycisk **Stop** oraz suwak głośności z wyciszeniem.
- Custom: odtwarzanie lub pauza i głośność, na plikach z dysku.

Jeśli Spotify nie jest jeszcze podłączone, odtwarzacz pokazuje napis "Spotify not connected", a dotknięcie go otwiera **Music DJ setup**.

### Źródło Spotify dla pojedynczego czatu

Kiedy agent **Music DJ** działa w czacie w trybie **Roleplay**, jego karta ustawień pokazuje listę rozwijaną **Spotify source** z czterema opcjami.

- **Liked Songs**: wybiera najpierw spośród zapisanych utworów.
- **Playlist**: trzyma się jednej playlisty Spotify. Playlisty wypisuje lista rozwijana **Playlist**.
- **Artist**: szuka tylko wokół wskazanego wykonawcy. Pojawia się pole tekstowe **Artist**.
- **Any Spotify**: pozwala agentowi sięgać do wyszukiwarki Spotify, kiedy to pasuje.

## DJ Mari: playlisty układane przez AI

Przycisk **DJ** na mini odtwarzaczu Spotify układa tematyczną playlistę. Jego podpowiedź brzmi "DJ Mari composes a playlist for you!"

**DJ Mari** prosi podłączony model AI o playlistę opartą na twojej personie (postaci, w którą się wcielasz), najczęściej używanej postaci oraz ostatnich czatach ze wszystkich rozmów. Dopasowane utwory trafiają do nowej playlisty Spotify o nazwie "DJ Mari" z dzisiejszą datą, a odtwarzanie rusza od razu.

**DJ Mari** potrzebuje dwóch rzeczy:

- Połączenia z modelem przypisanego do agenta **Music DJ**. Bez niego pojawia się komunikat "Configure a model connection on the Music DJ agent before using DJ Mari." Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
- Odpowiedniej liczby dopasowanych utworów Spotify. Potrzeba co najmniej 25 utworów, a wybieranych jest maksymalnie 50. Przy mniej niż 25 trafieniach pojawia się prośba o dodanie kolejnych Liked Songs i ponowną próbę.

Po udanym ułożeniu playlisty widać komunikat "DJ Mari playlist is ready" z przyciskiem **Open playlist**.

## Music DJ w trybie Game Mode

Tryb Game Mode ma własną wbudowaną muzykę w tle z Game Assets. Żeby zamiast niej grał agent **Music DJ**, włącz przełącznik **Music DJ** w konfiguracji gry. Jego opis brzmi "Use the Music DJ for this game instead of local music assets." Ten przełącznik jest domyślnie wyłączony.

Po włączeniu dostajesz te same opcje **Spotify**, **YouTube** i **Custom** oraz te same pola dla każdego źródła co w trybie Roleplay.

W trybie Game Mode Spotify działa trochę inaczej. Po każdej scenie serwer buduje krótką listę prawdziwych utworów kandydujących z wybranego źródła. Model AI wybiera z niej jeden utwór. Dzięki temu AI nie wymyśla utworu, który nie istnieje. Tryb Game Mode odtwarza jeden zapętlony utwór naraz.

Otwórz **Game controls** (sterowanie grą) i wybierz **Retry Music DJ** (ponowny wybór muzyki), aby poprosić o nowy utwór dla bieżącej sceny. Działa to na komputerze i telefonie. Zobacz [Game Mode: pierwsze kroki](../game/getting-started.md#the-games-controls).

## Komenda Music w trybie Conversation

W trybie **Conversation** agenta **Music DJ** nie da się dodać. Zamiast tego postacie odtwarzają utwory komendą **Music**.

Otwórz sekcję **Commands** w czacie. Najpierw włącz główny przełącznik **Commands**. Potem włącz przełącznik **Music**. Jego opis brzmi "Let characters play songs through the active Music Player."

Od tej chwili postać może podać nazwę utworu dla Spotify albo opisać utwór dla YouTube, a Marinara odtworzy go z aktywnego źródła. Działa to nawet wtedy, gdy agent **Music DJ** nie jest nigdzie włączony. Wystarczy podłączone Spotify albo zapisany klucz YouTube.

Jeśli Spotify nie jest podłączone albo brakuje mu uprawnień do odtwarzania, komenda z utworem Spotify nic nie robi i nie pokazuje błędu. Dlatego przy braku muzyki zacznij od konfiguracji źródła.

## Rozwiązywanie problemów

- Brakuje mini odtwarzacza. Włącz **Music Player** w **Settings**, zakładka **General**, sekcja **App Behavior**.
- Spotify nic nie odtwarza. Sterowanie odtwarzaniem wymaga Spotify Premium i aktywnego urządzenia Spotify. Otwórz aplikację na jakimś urządzeniu albo kliknij **Enable Marinara player** na komputerze.
- Okno logowania Spotify nie działa na innym komputerze. Skorzystaj z pola wklejania w sekcji "Browser couldn't reach the callback?" albo ustaw `SPOTIFY_REDIRECT_URI` na serwerze.
- Wyszukiwanie w YouTube zawodzi. Sprawdź, czy **YouTube Data API v3** jest włączone dla projektu i czy klucz nie jest ograniczony po nagłówku HTTP referrer. Po wyczerpaniu dziennego limitu spróbuj następnego dnia albo użyj innego klucza.
- Muzyka własna nie chce grać z folderu na urządzeniu przy dostępie zdalnym. Ten folder wymaga lokalnego dostępu na serwerze. Zobacz [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).
- Komenda z utworem od postaci nic nie robi w trybie Conversation. Podłącz Spotify albo zapisz klucz YouTube i sprawdź, czy przełączniki **Commands** oraz **Music** są włączone.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Zasoby gry: muzyka, dźwięki, sprite'y i tła](../game/game-assets.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
