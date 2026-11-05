# Music DJ: Spotify, YouTube i muzyka lokalna

**Music DJ** odtwarza muzykę w tle dopasowaną do twojej sceny. Z tego przewodnika dowiesz się, jak podłączyć Spotify, YouTube albo własne pliki dźwiękowe, jak korzystać z odtwarzacza muzyki i jak używać muzyki w trybach Game Mode i Conversation.

## Czym jest Music DJ

**Music DJ** to opcjonalny agent do pobrania. Agent to pomocnik, który działa w tle czatu. Po każdej odpowiedzi Music DJ może odczytać nastrój sceny i odtworzyć pasującą muzykę.

Zanim zaczniesz: otwórz **Agents** (Agenci), wybierz **Agent Organizer** (organizowanie agentów) i zainstaluj agenta **Music DJ**. Po instalacji jest wyłączony. Włącz go dla czatu tak samo jak każdego innego agenta. Działa w czatach Roleplay, w trybie Game Mode przez osobny przełącznik ([Music DJ w trybie Game Mode](#music-dj-in-game-mode)) oraz w trybie Conversation przez komendę **Music** ([Komenda Music w trybie Conversation](#the-conversation-music-command)).

Odtwarza muzykę z trzech źródeł.

| Źródło | Potrzebne konto | Koszt | Najlepsze do |
| --- | --- | --- | --- |
| **Spotify** | Własne konto Spotify oraz Spotify Premium do odtwarzania | Konfiguracja za darmo, odtwarzanie w ramach Premium | Prawdziwe, konkretne utwory na twoich urządzeniach |
| **YouTube** | Darmowy klucz API Google | Bezpłatnie | Odtwarzanie bez logowania i bez Premium |
| **Custom** | Żadne | Bezpłatnie | Własne pliki dźwiękowe |

Aktywne źródło widać jako mały odtwarzacz **Music Player** (odtwarzacz muzyki) przypięty do górnego paska. Na telefonach i w wąskich oknach zmienia się w mały, pływający, okrągły widget, który da się przeciągać.

Agenta Music DJ konfiguruje się w jednym wspólnym miejscu. Otwórz prawy panel **Agents**, a potem **Music DJ**. Możesz też kliknąć ikonę koła zębatego na mini odtwarzaczu (podpowiedź **Music DJ setup**).

### Wybór źródła muzyki

W edytorze **Music DJ** pole **Music Player** ma trzy przyciski: **Spotify**, **YouTube** i **Custom**. Wiersz pod nimi pokazuje, co jest aktywne, na przykład "Visible player: Spotify. Saved provider: Spotify." Ten wybór obowiązuje w całej aplikacji i nie zapisuje się osobno dla każdego czatu.

## Konfiguracja Spotify

Spotify korzysta z twojej własnej, darmowej aplikacji deweloperskiej Spotify. Wklejasz tylko **Spotify Client ID**. Sekret klienta nie jest potrzebny.

1. W edytorze **Music DJ** znajdź **Spotify Connection**.
2. Otwórz **Spotify Developer Dashboard** z linku podanego w aplikacji.
3. Utwórz nową aplikację i wybierz "Web API".
4. W polu Redirect URIs tej aplikacji dodaj dokładny adres przekierowania, który Marinara pokazuje w kroku 3 okna konfiguracji w aplikacji. Adres przekierowania to adres, na który Spotify odsyła cię po zalogowaniu.
5. Skopiuj **Client ID** i wklej go w pole **Spotify Client ID**.
6. Zapisz agenta, a potem kliknij **Connect Spotify Account**.

Otwiera się okno logowania i zgód Spotify. Po zatwierdzeniu pokazuje krótką stronę z informacją o powodzeniu i się zamyka. Marinara pokazuje zielony kafelek **Connected to Spotify**. **Disconnect** usuwa zapisane połączenie.

> **Uwaga:** Odtwarzanie, pauza, przewijanie i głośność wymagają Spotify Premium (płatnego planu). Darmowe konto można podłączyć. Tokeny odświeżają się automatycznie.

Jeśli to nie zadziałało: na innym komputerze okno logowania może się nie wczytać (zobacz niżej). W przeciwnym razie sprawdź, czy adres przekierowania zgadza się co do znaku.

### Urządzenia Spotify

Spotify odtwarza muzykę przez urządzenie, na przykład telefon, aplikację Spotify na komputerze albo odtwarzacz w aplikacji.

- Na komputerze kliknij ikonę laptopa na mini odtwarzaczu (**Enable Marinara player** albo **Use Marinara player**), żeby zamienić zakładkę przeglądarki w urządzenie Spotify o nazwie "Marinara Engine". Odtwarzanie w zakładce wymaga Premium.
- Na telefonie odtwarzacz woli urządzenie Spotify samego telefonu, więc muzyka gra na telefonie, a nie w zakładce działającej w tle.
- Jeśli urządzenie nie pozwala na zdalną zmianę głośności, zamiast suwaka pojawia się **Use device volume**. Użyj przycisków głośności samego urządzenia.

### Spotify na innym komputerze

Spotify przyjmuje wyłącznie bezpieczne adresy przekierowania `https://` albo adres pętli zwrotnej `http://127.0.0.1` (ten sam komputer). Jeśli Marinara działa na innym komputerze po zwykłym `http`, okno logowania może się nie wczytać. Są dwa rozwiązania:

- W trakcie łączenia rozwiń "Browser couldn't reach the callback?" pod **Connect Spotify Account**. Skopiuj pełny adres z okna, które się nie wczytało, wklej go w pole i kliknij **Complete connection**.
- Możesz też ustawić stały adres przekierowania jako zmienną środowiskową (ustawienie serwera odczytywane przy starcie):

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Zobacz [Konfiguracja serwera](../CONFIGURATION.md).

### Wybór miejsca, z którego Spotify bierze utwory (Roleplay)

Gdy Music DJ działa w czacie Roleplay, jego karta ma listę **Spotify source** (źródło Spotify).

- **Liked Songs**: wybiera najpierw spośród zapisanych utworów.
- **Playlist**: trzyma się jednej playlisty, wybranej na liście **Playlist**.
- **Artist**: szuka wokół jednego wykonawcy, wpisanego w polu **Artist**.
- **Any Spotify**: pozwala agentowi korzystać z wyszukiwarki Spotify, gdy to pasuje.

## Konfiguracja YouTube

Tryb YouTube wymaga darmowego klucza YouTube Data API. Klucz API to tajny kod, dzięki któremu Marinara korzysta z usługi w twoim imieniu. Logowanie do YouTube ani Premium nie są potrzebne.

1. W edytorze **Music DJ** znajdź **YouTube Connection**.
2. Otwórz **Google Cloud Console** z linku w aplikacji i utwórz albo wybierz projekt.
3. Włącz **YouTube Data API v3**.
4. Przejdź do Credentials, potem Create credentials, potem API key.
5. Wklej klucz w pole **YouTube Data API Key**.
6. Kliknij **Save Key**. Przycisk zmienia wtedy nazwę na **Update Key** i pojawia się zielony kafelek "API key configured". **Remove** usuwa klucz.

Zostaw klucz bez ograniczeń albo ogranicz go wyłącznie po API do YouTube Data API v3. Nie ograniczaj go po nagłówku HTTP referrer. Wyszukiwanie działa na serwerze, więc takie ograniczenie by je zablokowało. Według aplikacji darmowy limit (około 100 wyszukiwań dziennie) w zupełności wystarcza dla osobistego agenta DJ. Ta liczba pochodzi z tekstu aplikacji i może się zmienić. Klucz zostaje na serwerze, zaszyfrowany.

## Własne pliki muzyczne

Tryb Custom odtwarza pliki dźwiękowe z komputera, na którym działa aplikacja Marinara Engine. Obsługiwane typy to `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` i `.webm`.

W edytorze **Music DJ** znajdź **Custom Music Library** (własna biblioteka muzyki). Ma jeden przełącznik: **Use Game Assets music folder** (użycie folderu muzyki z Game Assets).

- **Włączony**: tryb Custom czyta dźwięki wgrane do Game Assets, biblioteki zasobów aplikacji Marinara Engine dla trybu Game Mode. Folder wybierz w polu **Game Assets music folder**. Wpisz `music`, żeby objąć całą bibliotekę, albo podfolder, na przykład `music/combat`. **Open Folder** otwiera ten folder na komputerze z serwerem.
- **Wyłączony**: tryb Custom czyta folder na urządzeniu z serwerem. Kliknij **Select Folder**, żeby otworzyć okno wyboru folderu na komputerze z serwerem, albo wklej ścieżkę w pole **Music folder on this device**.

Konfiguracja w trybie Roleplay i Game pokazuje to samo źródło. Jeśli wybrano folder na urządzeniu z serwerem, ustawienia Music DJ w czacie pokazują tę ścieżkę i przycisk **Choose Folder**.

Odtwarzanie z folderu spoza Game Assets wymaga lokalnego dostępu na serwerze. Z innego urządzenia bez logowania lub sekretu administratora ta funkcja może być zablokowana. Zobacz [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).

## Korzystanie z odtwarzacza muzyki

**Music Player** to kafelek na górnym pasku na komputerze i przeciągany widget na telefonie. Żeby go pokazać lub ukryć, otwórz **Settings → General → App Behavior** (ustawienia, ogólne, zachowanie aplikacji) i przestaw przełącznik **Music Player**. Domyślnie jest włączony. Gdy jest włączony, a agent Music DJ nie jest zainstalowany, odtwarzacz pokazuje napis **Download Music DJ Agent to configure** i przycisk **Agent Organizer**.

W świeżym profilu źródłem jest na początku **YouTube**. Zmienisz je okrągłym przełącznikiem źródła na odtwarzaczu (podpowiedź "Switch to ... player"), przyciskami **Music Player** w edytorze albo w ustawieniach **Music DJ** w czacie.

Odtwarzacz pokazuje okładkę lub miniaturę utworu, tytuł oraz wykonawcę albo kanał. Kontrolki zależą od źródła.

- **Spotify**: losowa kolejność, **Previous**, odtwarzanie lub pauza, **Next**, powtarzanie, głośność z wyciszeniem, **DJ**, przycisk laptopa **Marinara player** i koło zębate **Music DJ setup**. Gdy Spotify nie jest podłączone, odtwarzacz pokazuje napis "Spotify not connected", a dotknięcie go otwiera **Music DJ setup**.
- **YouTube**: odtwarzanie lub pauza, strzałka otwierająca mały panel wideo 16:9, **Stop** oraz głośność z wyciszeniem.
- **Custom**: odtwarzanie lub pauza i głośność.

## DJ Mari: playlisty układane przez AI

Przycisk **DJ** na mini odtwarzaczu Spotify ("DJ Mari composes a playlist for you!") układa tematyczną playlistę. DJ Mari prosi podłączony model AI, żeby ułożył ją na podstawie twojej persony, najczęściej używanej postaci i ostatnich czatów ze wszystkich rozmów. Dopasowane utwory dodaje do nowej playlisty Spotify o nazwie "DJ Mari" z dzisiejszą datą i ją uruchamia.

Potrzebuje dwóch rzeczy.

- Modelu przypisanego do agenta **Music DJ**. Bez niego pojawia się komunikat "Configure a model connection on the Music DJ agent before using DJ Mari." Zobacz [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md).
- Co najmniej 25 dopasowanych utworów Spotify. Wybiera ich najwyżej 50. Przy mniej niż 25 prosi o dodanie kolejnych Liked Songs i ponowną próbę.

Po udanym ułożeniu playlisty pojawia się komunikat "DJ Mari playlist is ready" z przyciskiem **Open playlist** (otwarcie playlisty).

<a id="music-dj-in-game-mode"></a>

## Music DJ w trybie Game Mode

Tryb Game Mode ma własną muzykę w tle z Game Assets. Żeby zamiast niej korzystać z agenta Music DJ, włącz przełącznik **Music DJ** w konfiguracji gry ("Use the Music DJ for this game instead of local music assets"). Domyślnie jest wyłączony. Dostajesz wtedy te same opcje **Spotify**, **YouTube** i **Custom** oraz te same pola co w trybie Roleplay.

Przy Spotify serwer po każdej scenie buduje z wybranego źródła krótką listę prawdziwych utworów kandydujących, a AI wybiera jeden z nich. Dzięki temu AI nie wymyśla utworu. Tryb Game Mode odtwarza jeden zapętlony utwór naraz. Żeby dostać nowy wybór dla bieżącej sceny, otwórz **Game controls** (sterowanie grą) i wybierz **Retry Music DJ** (ponowny wybór muzyki). Zobacz [Kontrolki gry](../game/getting-started.md#the-games-controls).

<a id="the-conversation-music-command"></a>

## Komenda Music w trybie Conversation

W trybie Conversation nie da się dodać agenta Music DJ. Zamiast tego postacie odtwarzają utwory komendą **Music**.

1. Otwórz sekcję **Commands** (komendy) czatu i włącz główny przełącznik **Commands**.
2. Włącz **Music** ("Let characters play songs through the active Music Player").

Postać może wtedy podać nazwę utworu dla Spotify albo opisać utwór dla YouTube, a Marinara odtworzy go przez aktywne źródło. Działa to nawet wtedy, gdy agent Music DJ nie jest nigdzie włączony. Wystarczy podłączone Spotify albo zapisany klucz YouTube. Jeśli Spotify nie jest podłączone albo nie ma uprawnień do odtwarzania, komenda z utworem Spotify nic nie robi i nie pokazuje błędu.

## Rozwiązywanie problemów

- **Brakuje mini odtwarzacza**: włącz **Music Player** w **Settings → General → App Behavior**.
- **Spotify nic nie odtwarza**: odtwarzanie wymaga Spotify Premium i aktywnego urządzenia Spotify. Otwórz desktopową aplikację Spotify na jakimś urządzeniu albo kliknij **Enable Marinara player** na komputerze.
- **Okno logowania Spotify nie działa na innym komputerze**: skorzystaj z pola wklejania "Browser couldn't reach the callback?" albo ustaw `SPOTIFY_REDIRECT_URI` na serwerze.
- **Wyszukiwanie w YouTube zawodzi**: sprawdź, czy **YouTube Data API v3** jest włączone dla twojego projektu i czy klucz nie jest ograniczony po nagłówku HTTP referrer. Po wyczerpaniu dziennego limitu spróbuj następnego dnia albo użyj innego klucza.
- **Muzyka własna nie gra z folderu na urządzeniu przy dostępie zdalnym**: ten folder wymaga lokalnego dostępu na serwerze. Zobacz [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md).
- **Komenda z utworem od postaci nic nie robi w trybie Conversation**: podłącz Spotify albo zapisz klucz YouTube i sprawdź, czy przełączniki **Commands** i **Music** są włączone.

## Powiązane przewodniki

- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
- [Zasoby gry: muzyka, dźwięki, sprite'y i tła](../game/game-assets.md)
- [Tryb Conversation: pierwsze kroki](../conversation/getting-started.md)
