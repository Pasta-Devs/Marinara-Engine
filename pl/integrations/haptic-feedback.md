# Konfiguracja Haptic Feedback

Z tego przewodnika dowiesz się, jak pozwolić postaci AI sterować podłączonymi urządzeniami haptycznymi w aplikacji Marinara Engine. Znajdziesz tu instalację aplikacji pomocniczej, dodanie agenta **Haptic Feedback** do czatu, połączenie z urządzeniem oraz ustawienia dotyku, które da się dopasować.

## Czym jest haptyczna informacja zwrotna

Dzięki haptycznej informacji zwrotnej postać AI wysyła w trakcie czatu sygnały dotykowe do podłączonego urządzenia haptycznego (zabawki erotycznej). Marinara Engine nie rozmawia z urządzeniem bezpośrednio. Zamiast tego wysyła komendy do darmowej aplikacji towarzyszącej o nazwie **Intiface Central**, a ta aplikacja steruje urządzeniem.

Aplikacja **Intiface Central** posługuje się protokołem urządzeń **Buttplug.io**. To ten sam otwarty standard, który obsługuje wiele zabawek i innych aplikacji. Aplikację **Intiface Central** instaluje się raz, potem paruje się z nią urządzenie, a Marinara łączy się z nią przez lokalny adres sieciowy.

Haptyczna informacja zwrotna działa jako jeden z agentów czatu, czyli pomocników AI dodawanych do rozmowy w sekcji **Agents**. Sprawdza się w trybach Conversation, Roleplay i Game.

## Zanim zaczniesz

Przed włączeniem haptycznej informacji zwrotnej trzeba przygotować trzy rzeczy.

1. Zainstaluj aplikację **Intiface Central** z oficjalnej strony. Otwórz ten adres w przeglądarce.

```
https://intiface.com/central/
```

2. Otwórz aplikację **Intiface Central** i uruchom jej serwer. Poszukaj w aplikacji przycisku uruchamiającego serwer.
3. Sparuj lub podłącz urządzenie w aplikacji **Intiface Central**, żeby aplikacja je widziała.

Jeśli aplikacja **Intiface Central** nie działa z uruchomionym serwerem, Marinara nie wyśle żadnych sygnałów dotykowych.

## Dodanie agenta Haptic Feedback

Haptyczną informację zwrotną dodaje się tak samo jak każdego innego agenta, z poziomu ustawień czatu.

1. Otwórz czat w trybie Conversation, Roleplay lub Game.
2. Otwórz panel **Chat Settings** (ustawienia czatu) dla tego czatu.
3. Przejdź do sekcji **Agents**.
4. Dodaj do czatu agenta **Haptic Feedback**.
5. Znajdź kartę **Haptic Feedback**, która pojawiła się na liście **Agents**.

Włącz przełącznik **Haptic Feedback** na górze tej karty. Kiedy jest wyłączony, opis brzmi "Allow this agent to send touch cues during the chat." Kiedy jest włączony, opis brzmi "Touch cues are enabled for this chat." Domyślnie przełącznik jest wyłączony.

Po włączeniu przełącznika AI może wysyłać ukryte sygnały dotykowe w trakcie pisania. Te sygnały nie pojawiają się w czacie jako tekst. Trafiają do wszystkich podłączonych urządzeń.

## Połączenie, skanowanie i wykrywanie urządzenia

Po otwarciu karty **Haptic Feedback** Marinara próbuje połączyć się z aplikacją **Intiface Central** automatycznie, pod zapisanym adresem. Połączenie da się też nawiązać ręcznie.

Karta pokazuje wiersz stanu z kolorową kropką. Zielona kropka oznacza połączenie. Czerwona oznacza jego brak. Obok stoi przycisk z napisem **Connect**, gdy połączenia nie ma, oraz **Disconnect**, gdy jest aktywne.

Aby połączyć się ręcznie, kliknij przycisk **Connect** (połączenie). Jeśli się uda, wiersz pokazuje "Connected" razem z adresem serwera.

Jeśli się nie uda, zobaczysz komunikat o nieudanym połączeniu. Prosi on o sprawdzenie, czy aplikacja **Intiface Central** działa i czy jej serwer jest uruchomiony. W komunikacie jest też link do strony aplikacji **Intiface Central**.

Po nawiązaniu połączenia karta pokazuje liczbę wykrytych urządzeń. Widnieje tam "No devices found", gdy nie ma żadnego, albo liczba urządzeń, gdy jakieś są. Kliknij przycisk **Scan for devices** (skanowanie w poszukiwaniu urządzeń), aby wyszukać ponownie. W trakcie skanowania przycisk pokazuje "Scanning...". Karta wymienia każde urządzenie z nazwą i obsługiwanymi akcjami, na przykład wibracją lub obrotem.

Marinara przekazuje agentowi Haptic Agent także dokładną nazwę z Intiface, rodzaj zabawki określony na podstawie możliwości oraz obsługiwane działania. Dzięki temu agent wybiera właściwe urządzenie i działanie, zamiast zakładać, że każda zabawka jest wibratorem.

## Obsługiwane działania i wzorce

Marinara korzysta z każdego rodzaju wyjścia zgłaszanego przez Intiface dla podłączonego urządzenia: wibracji, obracania, ruchu oscylacyjnego, zaciskania, pompowania, pozycji liniowej, temperatury, natrysku i oświetlenia. Pozycja liniowa steruje urządzeniami wykonującymi ruch posuwisty, pchający lub pompujący; pompowanie steruje urządzeniami wykorzystującymi ciśnienie powietrza.

Agent może zastosować wzorzec **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** albo **Impact** do każdego działania poza zatrzymaniem. Wzorce pozycyjne naprzemiennie wyznaczają prawdziwe cele ruchu, dzięki czemu ruch pompujący lub posuwisty wykonuje się w czasie zamiast wysyłać kilka ruchów naraz.

### Pole Intiface URL

W polu **Intiface URL** znajduje się adres sieciowy serwera aplikacji **Intiface Central**. To adres WebSocket, czyli lokalny link, przez który obie aplikacje się porozumiewają. Wartość domyślna jest podana niżej.

```
ws://127.0.0.1:12345
```

Adres `127.0.0.1` oznacza "ten sam komputer". Jeśli zostawisz pole puste, Marinara użyje wartości domyślnej serwera. Marinara zapamiętuje też adres w przeglądarce, więc jest on używany ponownie w kolejnych czatach i na kolejnych urządzeniach.

Jeśli uruchamiasz aplikację Marinara Engine w kontenerze Docker albo otwierasz ją w przeglądarce na innym urządzeniu, adres `127.0.0.1` nie trafi do aplikacji **Intiface Central**. Wpisz wtedy adres komputera, na którym działa aplikacja **Intiface Central**. Wygląda on jak w przykładzie niżej, w którym liczby zastępuje się prawdziwym adresem tego komputera.

```
ws://192.168.1.50:12345
```

## Czułość dotyku

W każdym trybie czatu karta **Haptic Feedback** pokazuje kontrolkę **Touch sensitivity** (czułość dotyku) z trzema opcjami. Czułość podpowiada agentowi, jak chętnie wybierać łagodny albo mocny sygnał, ale nie nakłada sztywnego limitu. Każda opcja może wykorzystać pełny zakres intensywności urządzenia `0.0-1.0`, gdy wymaga tego bieżące działanie.

Trzy opcje wyznaczają styl reakcji agenta.

| Opcja | Odczucie | Uwagi |
|---|---|---|
| **Subtle** | Preferuje łagodniejsze sygnały | Pełny zakres pozostaje dostępny |
| **Standard** | Wyważona reakcja, dobra do większości scen | Ustawienie domyślne; pełny zakres jest dostępny |
| **Intense** | Chętniej wybiera mocne sygnały | Może wykorzystać pełną moc |

Domyślnie zaznaczona jest opcja **Standard**. Wybierz styl reakcji pasujący do sceny. Marinara nadal sprawdza każdą komendę względem fizycznego zakresu Intiface `0.0-1.0`.

## Przypadkowy kontakt

Pod kontrolką czułości każdy tryb czatu pokazuje też przełącznik **Incidental contact** (przypadkowy kontakt). Widnieje przy nim opis "Tiny taps for accidental brushes and bumps." Domyślnie przełącznik jest wyłączony.

Kiedy jest wyłączony, AI pomija w historii drobne przypadkowe dotknięcia. Wysyła sygnały tylko przy kontakcie celowym lub zdecydowanym. Włącz go, jeśli chcesz odczuwać delikatne stuknięcia także przy muśnięciach i potrąceniach.

## Korzystanie z innego urządzenia

Domyślnie Marinara przyjmuje komendy haptyczne tylko z tego komputera, na którym działa serwer Marinara Engine. Dzięki temu sterowanie urządzeniem zostaje lokalne i prywatne.

Z tego powodu haptyczna informacja zwrotna nie zadziała, gdy otworzysz aplikację Marinara Engine na telefonie lub innym urządzeniu. Dotyczy to sytuacji, w której takie urządzenie łączy się z serwerem Marinara Engine działającym gdzie indziej. Połączenie, skanowanie i komendy są wtedy odrzucane, dopóki nie zmienisz ustawień serwera.

Aby zezwolić na sterowanie haptyczne z innego urządzenia, włącz ustawienie serwera o nazwie `HAPTICS_ALLOW_REMOTE`. Trzeba też skonfigurować ochronę dostępu, na przykład Basic Auth albo sekret administratora. Samo ustawienie opisuje [Konfiguracja serwera](../CONFIGURATION.md). Ochronę dostępu opisuje [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md). Dostęp administratora wpisuje się w panelu **Settings** (Ustawienia), w obszarze **Advanced**, w sekcji **Admin Access**.

## Kiedy coś nie działa

Jeśli AI nigdy nie uruchamia urządzenia, sprawdź kolejno te punkty.

1. Sprawdź, czy aplikacja **Intiface Central** jest otwarta i czy jej serwer jest uruchomiony.
2. Sprawdź, czy urządzenie jest sparowane i widoczne na liście urządzeń po kliknięciu przycisku **Scan for devices**.
3. Sprawdź, czy kropka stanu jest zielona i czy przełącznik **Haptic Feedback** jest włączony.
4. Jeśli korzystasz z telefonu lub urządzenia zdalnego, wróć do uwag o dostępie zdalnym powyżej.

Kiedy nie ma połączenia z aplikacją **Intiface Central** albo nie jest podłączone żadne urządzenie, Marinara po cichu pomija sygnał dotykowy od AI. W czacie nie pojawi się żaden błąd.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Dostęp zdalny: Basic Auth i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
