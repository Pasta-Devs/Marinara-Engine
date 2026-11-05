# Konfiguracja Haptic Feedback

Haptyczna informacja zwrotna pozwala postaci AI wysyłać w trakcie czatu sygnały dotykowe do podłączonego urządzenia haptycznego (zabawki erotycznej). Z tego przewodnika dowiesz się, jak zainstalować aplikację pomocniczą, dodać agenta **Haptic Feedback** do czatu, połączyć się z urządzeniem i dopasować ustawienia dotyku.

Marinara Engine nie rozmawia z urządzeniem bezpośrednio. Wysyła komendy do darmowej aplikacji towarzyszącej **Intiface Central**, która steruje urządzeniem. Aplikacja Intiface Central posługuje się standardem **Buttplug.io** – otwartym standardem, który obsługuje wiele zabawek i aplikacji. Marinara łączy się z nią przez adres sieciowy. Haptyczna informacja zwrotna to agent czatu (pomocnik AI, którego dodajesz do czatu). Działa w trybach Conversation, Roleplay i Game.

## Zanim zaczniesz

1. Zainstaluj aplikację **Intiface Central** ze strony `https://intiface.com/central/`.
2. Otwórz ją i uruchom jej serwer przyciskiem uruchamiania serwera.
3. Sparuj urządzenie w aplikacji Intiface Central, żeby aplikacja je widziała.

Jeśli aplikacja Intiface Central nie działa z uruchomionym serwerem, Marinara nie wyśle sygnałów dotykowych. Potrzebny jest też zainstalowany agent **Haptic Feedback**. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).

## Dodanie agenta Haptic Feedback

1. Otwórz czat w trybie Conversation, Roleplay lub Game.
2. Otwórz **Chat Settings** (ustawienia czatu) i przejdź do sekcji **Agents**.
3. Dodaj agenta **Haptic Feedback**. Na liście **Agents** pojawi się karta **Haptic Feedback**.
4. Włącz przełącznik **Haptic Feedback** na górze karty.

Domyślnie przełącznik jest wyłączony. Gdy jest wyłączony, opis brzmi "Allow this agent to send touch cues during the chat." Gdy jest włączony, opis brzmi "Touch cues are enabled for this chat." Po jego włączeniu AI wysyła w trakcie pisania ukryte sygnały dotykowe. Nie pojawiają się one w czacie jako tekst. Trafiają do wszystkich podłączonych urządzeń.

## Połączenie i skanowanie

Po otwarciu karty Marinara próbuje połączyć się z aplikacją Intiface Central pod zapisanym adresem. Wiersz stanu pokazuje zieloną kropkę, gdy połączenie jest aktywne, i czerwoną, gdy go nie ma. Obok jest przycisk **Connect** (połączenie), gdy połączenia nie ma, albo **Disconnect** (rozłączenie), gdy jest aktywne.

1. Kliknij **Connect**. Jeśli się uda, wiersz pokazuje "Connected" razem z adresem serwera.
2. Kliknij **Scan for devices** (skanowanie w poszukiwaniu urządzeń), aby wyszukać urządzenia ponownie. W trakcie skanowania przycisk pokazuje "Scanning...".

Karta pokazuje "No devices found" albo liczbę urządzeń i wymienia każde z nich z dokładną nazwą z Intiface i obsługiwanymi działaniami. Marinara przekazuje też agentowi Haptic Agent tę nazwę, rodzaj zabawki określony na podstawie jej możliwości oraz jej działania. Dzięki temu agent wybiera właściwe urządzenie i działanie, zamiast zakładać, że każda zabawka wibruje.

Jeśli to nie zadziałało: po nieudanym połączeniu pojawia się komunikat z prośbą o sprawdzenie, czy aplikacja Intiface Central działa i czy jej serwer jest uruchomiony, razem z linkiem do jej strony.

## Obsługiwane działania i wzorce

Marinara korzysta z każdego rodzaju wyjścia, który Intiface zgłasza dla urządzenia: wibracji, obracania, ruchu oscylacyjnego, zaciskania, pompowania, pozycji liniowej, temperatury, natrysku i oświetlenia. Pozycja liniowa steruje urządzeniami wykonującymi ruch posuwisty, pchający lub pompujący. Pompowanie steruje urządzeniami pompującymi, które wykorzystują ciśnienie powietrza.

Agent może zastosować wzorzec **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** albo **Impact** do każdego działania poza zatrzymaniem. Wzorce pozycyjne naprzemiennie wyznaczają prawdziwe cele ruchu, dzięki czemu wzorzec pompujący lub posuwisty wykonuje się w czasie, zamiast wysyłać kilka ruchów naraz.

## Pole Intiface URL

Pole **Intiface URL** zawiera adres WebSocket serwera aplikacji Intiface Central. Adres WebSocket to link, przez który obie aplikacje się porozumiewają. Wartość domyślna:

```text
ws://127.0.0.1:12345
```

Adres `127.0.0.1` oznacza ten sam komputer. Jeśli zostawisz pole puste, Marinara użyje wartości domyślnej serwera, którą można zmienić zmienną środowiskową `INTIFACE_URL` w pliku `.env`. Zobacz [Konfiguracja serwera](../CONFIGURATION.md). Marinara zapisuje adres razem z czatem i zapamiętuje go w tej przeglądarce, więc inne czaty otwierane tutaj zaczynają z tym adresem.

Adres pozostaje w tej instalacji aplikacji Marinara Engine. Eksporty czatów, eksportowane profile ustawień i pliki **Export Profile** (eksport profilu) go pomijają, a import żadnego z nich go nie ustawia. Po przeniesieniu czatu do innej instalacji wpisz adres ponownie.

Jeśli uruchamiasz aplikację Marinara Engine w kontenerze Docker albo otwierasz ją w przeglądarce na innym urządzeniu, adres `127.0.0.1` nie dotrze do aplikacji Intiface Central. Wpisz adres komputera, na którym ona działa, zastępując liczby jego prawdziwym adresem:

```text
ws://192.168.1.50:12345
```

## Czułość dotyku

W każdym trybie czatu karta pokazuje kontrolkę **Touch sensitivity** (czułość dotyku). Wskazuje ona agentowi, jak chętnie ma wybierać łagodny albo mocny sygnał. Nie jest to górny limit: każda opcja może wykorzystać pełny zakres intensywności `0.0-1.0`, gdy wymaga tego działanie. Marinara sprawdza każdą komendę względem fizycznego zakresu Intiface.

| Opcja | Odczucie |
| --- | --- |
| **Subtle** | Preferuje łagodniejsze sygnały. |
| **Standard** | Wyważona reakcja, dobra do większości scen. To ustawienie domyślne. |
| **Intense** | Chętniej wybiera mocniejsze sygnały. |

## Przypadkowy kontakt

Przełącznik **Incidental contact** (przypadkowy kontakt) z opisem "Tiny taps for accidental brushes and bumps." jest domyślnie wyłączony. Gdy jest wyłączony, AI pomija drobne przypadkowe dotknięcia i wysyła sygnały tylko przy kontakcie celowym lub zdecydowanym. Włącz go, żeby dostawać delikatne stuknięcia także przy muśnięciach i potrąceniach.

<a id="use-it-from-another-device"></a>

## Korzystanie z innego urządzenia

Domyślnie Marinara przyjmuje komendy haptyczne tylko z komputera, na którym działa serwer Marinara Engine. Dzięki temu sterowanie urządzeniem pozostaje prywatne. Dlatego haptyczna informacja zwrotna nie działa, gdy otwierasz aplikację Marinara Engine na telefonie lub innym urządzeniu, które łączy się z serwerem działającym gdzie indziej. Połączenie, skanowanie i komendy są wtedy odrzucane.

Aby na to zezwolić, włącz ustawienie serwera `HAPTICS_ALLOW_REMOTE` i skonfiguruj ochronę dostępu – logowanie albo sekret administratora. Zobacz [Konfiguracja serwera](../CONFIGURATION.md) i przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md). Dostęp administratora wpisuje się w **Settings → Advanced → Admin Access** (ustawienia, zaawansowane, dostęp administracyjny).

## Kiedy coś nie działa

Jeśli AI nigdy nie uruchamia urządzenia, sprawdź kolejno:

1. Aplikacja Intiface Central jest otwarta, a jej serwer uruchomiony.
2. Urządzenie jest sparowane i widać je na liście po użyciu **Scan for devices**.
3. Kropka stanu jest zielona, a przełącznik **Haptic Feedback** jest włączony.
4. Jeśli korzystasz z telefonu lub urządzenia zdalnego, zobacz [Korzystanie z innego urządzenia](#use-it-from-another-device).

Kiedy nie ma połączenia z aplikacją Intiface Central albo nie jest podłączone żadne urządzenie, Marinara po cichu pomija sygnał i nie pokazuje w czacie żadnego błędu.

## Powiązane przewodniki

- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Agenci do pobrania: przegląd pakietów](../agents/built-in-agents.md)
- [Dostęp zdalny: logowanie i lista dozwolonych adresów IP](../REMOTE_ACCESS.md)
