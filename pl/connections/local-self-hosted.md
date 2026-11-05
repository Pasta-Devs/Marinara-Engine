# Podłączanie modelu lokalnego lub samodzielnie hostowanego

Ten przewodnik pokazuje, jak połączyć aplikację Marinara Engine z modelem AI, który działa na twoim komputerze albo serwerze, przez program taki jak Ollama, LM Studio, KoboldCpp czy llama.cpp. Mały model, który Marinara uruchamia sama, bez osobnego serwera, opisuje przewodnik [Konfiguracja modelu wbudowanego](local-model.md).

## Konfiguracja połączenia Custom

W aplikacji ten rodzaj konta nazywa się **OpenAI-compatible** (zgodny z OpenAI). Oznacza to, że serwer przyjmuje ten sam format żądań co API czatu OpenAI. Ollama, LM Studio, KoboldCpp i llama.cpp go obsługują.

Zanim zaczniesz, zainstaluj serwer modeli, uruchom go i wczytaj w nim model. Na przykład pobierz program Ollama ze strony `ollama.com` i wykonaj jego instrukcje, żeby pobrać model. Marinara łączy się z serwerem, ale go za ciebie nie uruchamia. Serwer odpowiada na żądania pod adresem internetowym na twoim komputerze, nazywanym endpointem.

1. Kliknij **Connections** (Połączenia) na górnym pasku, a potem **Add** (dodaj). Otwiera się okno **Add account** (dodanie konta).
2. W sekcji **Chat** (czat) kliknij swój serwer: **Ollama**, **LM Studio**, **KoboldCpp** albo **llama.cpp**. Te kafelki mają etykietę **Self-hosted** (samodzielnie hostowany). Dla każdego innego serwera kliknij **OpenAI-compatible address** (adres zgodny z OpenAI).
3. Sprawdź pole **Server address** (adres serwera). Dla czterech wymienionych serwerów jest już wypełnione. Dla innego serwera wpisz jego adres. Zobacz tabelę poniżej.
4. Zostaw puste pole **API key (optional)** (klucz API, opcjonalnie). Większość serwerów lokalnych nie potrzebuje klucza. Żeby nazwać konto, wpisz nazwę w polu **Name (optional)** (nazwa, opcjonalnie).
5. Kliknij **Connect** (połącz). Marinara testuje adres. **Connected** oznacza, że udało się połączyć z serwerem.
6. Dalszy przebieg zależy od tego, czy masz już model Main. Jeśli go nie masz albo okno Add otwarto z nowego czatu, okno pokazuje modele zgłaszane przez serwer. Wybierz jeden albo wpisz identyfikator modelu w polu **Search or enter model ID…** (wyszukiwanie lub wpisanie identyfikatora modelu), a potem kliknij **Done** (gotowe). Jeśli model Main już masz, okno się zamyka, a komunikat informuje, że konto zostało dodane. Wtedy kliknij **⋯** na koncie i wybierz **Add model** (dodanie modelu).

Panel pokazuje teraz konto. Przetestuj je, zanim zaczniesz na nim polegać (zobacz [Testowanie połączenia](#test-the-connection)).

Jeśli to nie zadziałało:

- Komunikat **Marinara could not reach** oznacza, że nie udało się połączyć z adresem. Sprawdź, czy serwer działa i czy adres oraz port się zgadzają. **Continue anyway** (kontynuuj mimo to) zapisuje konto bez zaliczonego testu.
- Adres jest na innym komputerze. Zobacz [Dostęp do serwera na innym komputerze](#reach-a-server-on-another-computer).

## Adresy popularnych serwerów lokalnych

Port to numerowany kanał, z którego serwer korzysta na twoim komputerze. `localhost` oznacza ten sam komputer, więc te adresy działają w podanej postaci, gdy Marinara i serwer działają na jednym komputerze.

| Serwer | Adres |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

W oknie **Edit model** (edycja modelu) pole adresu ostrzega: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Wpisuj wyłącznie adres skonfigurowany samodzielnie albo taki, któremu w pełni ufasz.

W systemie Windows działający serwer nadal może być blokowany. Jeśli Marinara go nie wykrywa, może go blokować Zapora Windows Defender. Otwórz **Windows Security → Firewall & network protection → Allow an app through firewall** (Zabezpieczenia Windows, Zapora i ochrona sieci, Zezwalaj aplikacji na dostęp przez zaporę) i dodaj Node.js albo program swojego serwera.

<a id="test-the-connection"></a>

## Testowanie połączenia

Przycisk **Connect** już sprawdził adres. Edytor modelu ma kartę **Provider tests** (testy dostawcy) do ponownego sprawdzenia.

1. Kliknij swój model w panelu **Connections**. Otwiera się edytor modelu.
2. Kliknij **Test provider** (test dostawcy). Ten test sprawdza, czy adres jest osiągalny, i pokazuje, ile to trwało.
3. Jeśli model nie jest jeszcze wybrany, wybierz go, a potem kliknij **Send test message** (Wyślij wiadomość testową). Ten test wysyła krótką wiadomość i pokazuje odpowiedź.

Gdy oba testy się powiodą, otwórz czat i wybierz konto w oknie **Model for this chat** (model dla tego czatu). Zobacz [Wybór modelu dla jednego czatu](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

Jeśli test się nie powiedzie, sprawdź, czy serwer działa z wczytanym modelem i czy adres oraz port dokładnie się zgadzają. Przy serwerze na innym komputerze sprawdź kroki poniżej.

<a id="reach-a-server-on-another-computer"></a>

## Dostęp do serwera na innym komputerze

Adresy takie jak `localhost` i `127.0.0.1` zawsze działają. Jeśli serwer modeli jest na innym komputerze w twojej sieci, Marinara domyślnie blokuje ten prywatny adres. Osoba prowadząca serwer Marinara może na niego zezwolić zmienną środowiskową, czyli ustawieniem, które serwer odczytuje przy starcie.

1. Otwórz plik `.env` serwera. W zwykłej instalacji leży w folderze projektu aplikacji Marinara Engine. Instrukcje dla kontenerów Docker i Podman znajdziesz w przewodniku [Konfiguracja serwera](../CONFIGURATION.md#edit-the-env-file).
2. Dodaj tę linię:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Zapisz plik i uruchom ponownie serwer Marinara.
4. Użyj adresu drugiego komputera, na przykład `http://192.168.1.50:11434/v1`.

W systemie Android to ustawienie jest domyślnie włączone, gdy go nie ustawisz.

## Używanie modelu do decyzji

Ten sam model może odpowiadać na pytania decyzyjne, na przykład przy sprawdzaniu aktywacji agentów, bez wczytywania drugiej kopii. Kliknij **⋯** na modelu w panelu i wybierz **Use this model for decisions** (używaj tego modelu do decyzji). Ta opcja pojawia się przy modelu OpenAI-compatible, który ma nazwę modelu. Zobacz [Modele decyzyjne](decision-models.md#on-a-server-you-already-run).

## Przełącznik Treat as local/custom endpoint

W oknie **Edit model** przełącznik **Treat as local/custom endpoint** (traktuj jako endpoint lokalny lub własny) znajduje się w sekcji **Local / custom endpoint**. Domyślnie jest wyłączony. Pojawia się tylko przy starszych modelach, które nie są powiązane z kontem. Modele dodawane teraz nigdy go nie pokazują.

Włącz go dla serwera proxy albo serwera samodzielnie hostowanego, który nie jest znaną usługą. Sprawia, że Marinara zawsze próbuje wywołań narzędzi, i pozwala asystentce Professor Mari korzystać z zapasowej metody narzędziowej (protokołu narzędzi w formacie JSON) zamiast wyłącznie z natywnych wywołań narzędzi. Włącz go, jeśli Professor Mari zatrzymuje się po użyciu narzędzia albo jeśli twój serwer deklaruje zgodność z OpenAI, ale słabo obsługuje wywołania narzędzi. Jeśli model działa bez tego przełącznika, zostaw go wyłączony.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Konfiguracja modelu wbudowanego](local-model.md)
- [Modele decyzyjne](decision-models.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
