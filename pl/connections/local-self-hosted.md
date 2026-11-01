# Podłączanie modelu lokalnego lub samodzielnie hostowanego

Z tego przewodnika dowiesz się, jak połączyć aplikację Marinara Engine z modelem AI, który działa na twoim komputerze albo na twoim serwerze. Opisuje popularne lokalne serwery modeli, takie jak Ollama, LM Studio i KoboldCpp, oraz ustawienia potrzebne do ich uruchomienia.

## Co znaczy "samodzielnie hostowany"

Model samodzielnie hostowany to model AI działający na sprzęcie, nad którym masz kontrolę. Instalujesz lokalny serwer modeli, ten serwer wczytuje model i odpowiada na zapytania pod adresem internetowym na twojej maszynie. Marinara Engine rozmawia wtedy z tym adresem zamiast z płatną usługą w chmurze.

Do popularnych lokalnych serwerów modeli należą Ollama, LM Studio i KoboldCpp. Każdy z nich działa na twoim komputerze i udostępnia prywatny endpoint. Endpoint to adres internetowy, pod którym serwer nasłuchuje zapytań.

Ten przewodnik dotyczy zewnętrznych serwerów lokalnych, które instalujesz i uruchamiasz samodzielnie. Marinara ma też własny, niewielki wbudowany model, który nie wymaga osobnego serwera. Jeśli wolisz to rozwiązanie, zajrzyj do przewodnika [Konfiguracja modelu Local Model](local-model.md).

Zanim zaczniesz, sprawdź, czy lokalny serwer modeli jest zainstalowany, uruchomiony i ma wczytany model. Marinara nie uruchamia tego serwera za ciebie. Tylko się z nim łączy.

## Konfiguracja połączenia Custom

Marinara łączy się z serwerami lokalnymi przez dostawcę **Custom (OAI-Compatible)**. Zgodność z OAI oznacza, że serwer mówi tym samym formatem zapytań co API OpenAI Chat Completions. Ollama, LM Studio i KoboldCpp obsługują ten format.

Wykonaj kolejno te kroki, aby utworzyć połączenie.

1. Otwórz panel **Connections** (Połączenia) z prawej strony aplikacji.
2. Kliknij przycisk **Add** (dodaj). Otwiera się okno **Add account** (dodanie konta).
3. W kroku 1 wybierz **Custom (OAI-Compatible)**. Ta opcja znajduje się w grupie **On your computer** (na twoim komputerze).
4. W kroku 2 wpisz adres lokalnego serwera (patrz tabela poniżej) w polu **Address** (adres).
5. Zostaw puste pole **API key** (klucz API). Większość serwerów lokalnych nie potrzebuje klucza. Aby nadać połączeniu nazwę, na przykład `Ollama Local`, otwórz **More options** (więcej opcji) i wpisz ją w polu **Name (optional)** (nazwa, opcjonalnie).
6. Kliknij przycisk **Connect** (połącz).
7. W kroku 3 wybierz model z listy zgłaszanej przez serwer. Identyfikator modelu da się też wpisać ręcznie. Kliknij **Done** (gotowe).

Połączenie widać teraz w panelu **Connections**, a jego model jest zgrupowany pod nim. Przetestuj je, zanim użyjesz go w czacie. Zajrzyj do sekcji "Testowanie połączenia" poniżej.

Pole **API Key** jest opcjonalne przy serwerach lokalnych. W przypadku dostawcy **Custom (OAI-Compatible)** edytor wyświetla pod tym polem przypomnienie. Mówi ono, że przy modelach lokalnych, takich jak Ollama, LM Studio i KoboldCpp, klucz może zostać pusty. Zamiast tego wystarczy ustawić pole **Address**.

## Adresy Base URL popularnych serwerów lokalnych

Pole **Address** (nazywane też Base URL) wskazuje aplikacji Marinara, gdzie nasłuchuje lokalny serwer. Każdy serwer ma domyślny adres i port. Port to numerowany kanał, z którego serwer korzysta na twojej maszynie. Użyj adresu tego serwera, który uruchamiasz.

| Serwer lokalny | Endpoint |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

Nazwa `localhost` oznacza tutaj "ten sam komputer". Jeśli Marinara działa na tym samym komputerze co serwer modeli, te adresy zadziałają dokładnie w takiej postaci.

Przy polu **Address** widać ostrzeżenie o bezpieczeństwie: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Wpisuj wyłącznie adres skonfigurowany samodzielnie albo taki, któremu w pełni ufasz.

### Uwaga o zaporze systemu Windows

W systemie Windows lokalny serwer bywa blokowany, mimo że działa. Edytor pokazuje taką uwagę dla dostawcy **Custom (OAI-Compatible)**: jeśli twój serwer proxy lub lokalny serwer nie zostaje wykryty, połączenie może blokować Zapora Windows Defender. Aby to naprawić, otwórz Zabezpieczenia Windows, następnie Zapora i ochrona sieci, potem Zezwalaj aplikacji na dostęp przez zaporę i dodaj Node.js albo swoją aplikację serwera.

## Przełącznik Treat as local/custom endpoint

W edytorze połączenia jest sekcja **Local / Custom Endpoint** z przełącznikiem **Treat as local/custom endpoint** (traktuj jako endpoint lokalny lub własny). Domyślnie jest wyłączony. Włącz go dla endpointów samodzielnie hostowanych lub działających przez proxy, zwłaszcza dla własnego adresu internetowego wskazującego serwer modeli w sieci lokalnej.

Kiedy ten przełącznik jest wyłączony, Marinara ostrożnie podchodzi do wywołań narzędzi przy modelach, których nie rozpoznaje. Włączenie przełącznika każe aplikacji Marinara zawsze próbować wywołań narzędzi. Każe też asystentce Professor Mari korzystać z zapasowej metody narzędziowej (protokołu narzędzi w formacie JSON) zamiast wyłącznie z natywnych wywołań. Professor Mari to asystentka wbudowana w aplikację.

Włącz ten przełącznik, jeśli Professor Mari zatrzymuje się po użyciu narzędzia. Włącz go również wtedy, gdy twój endpoint deklaruje zgodność z OpenAI, ale nie obsługuje wywołań narzędzi w sposób niezawodny. Jeśli model lokalny działa dobrze bez tego, przełącznik może zostać wyłączony.

## Dostęp do serwera na innym komputerze

Marinara zawsze zezwala na połączenia z twoim własnym komputerem. Adresy takie jak `localhost` i `127.0.0.1` to adresy pętli zwrotnej, czyli "ta sama maszyna". Zawsze działają w połączeniu i nie wymagają dodatkowej konfiguracji.

Jeśli serwer modeli działa na innym komputerze w twojej sieci domowej lub firmowej, jest to adres sieci prywatnej. Marinara domyślnie blokuje adresy sieci prywatnych ze względów bezpieczeństwa. Aby na nie zezwolić, osoba prowadząca serwer Marinara musi ustawić zmienną środowiskową. Zmienna środowiskowa to ustawienie, które serwer odczytuje przy starcie.

Dodaj tę linię do pliku `.env` serwera:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Zapisz plik i uruchom ponownie serwer Marinara, żeby zmiana zaczęła obowiązywać. Potem da się użyć adresu Base URL wskazującego inną maszynę w sieci, na przykład `http://192.168.1.50:11434/v1`.

W systemie Android to ustawienie jest włączone domyślnie, kiedy nie zostanie ustawione ręcznie. Więcej o pliku `.env` i ustawieniach serwera znajdziesz w dokumentacji [Konfiguracja serwera](../CONFIGURATION.md).

## Testowanie połączenia

Przycisk **Connect** w oknie dodawania konta już sprawdził połączenie. Na dole edytora modelu jest karta **Connection Tests** (testy połączenia) do ponownego sprawdzenia. Skorzystaj z niej, zanim zaczniesz polegać na połączeniu w czacie.

1. Kliknij swój model w panelu **Connections**. Otwiera się edytor modelu.
2. Kliknij przycisk **Test Connection**. Sprawdza on, czy Base URL i konfiguracja są osiągalne, a także pokazuje czas odpowiedzi.
3. Wybierz model, jeśli nie jest jeszcze wybrany.
4. Kliknij przycisk **Send Test Message**. Wysyła on słowo "hi" do wybranego modelu i pokazuje odpowiedź.

Kiedy oba testy się powiodą, model lokalny jest gotowy do użycia w czacie. Otwórz czat, otwórz jego ustawienia i wskaż to połączenie albo użyj menu **Connections** w polu wiadomości.

Ten sam model może też odpowiadać na decyzje, na przykład pytania aktywacyjne agentów, bez ładowania drugiej kopii przez aplikację Marinara. Kliknij **Use this model for decisions** (używaj tego modelu do decyzji) w ustawieniach połączenia; zobacz [Modele decyzyjne](decision-models.md#on-a-server-you-already-run).

Jeśli test się nie powiedzie, sprawdź najpierw, czy lokalny serwer nadal działa i czy model jest wczytany. Potem sprawdź, czy pole **Address** dokładnie odpowiada adresowi i portowi serwera. Przy serwerze na innym komputerze upewnij się, że zmienna `PROVIDER_LOCAL_URLS_ENABLED` jest ustawiona, a serwer Marinara został ponownie uruchomiony.

## Powiązane przewodniki

- [Łączenie z dostawcą AI](connecting-to-a-provider.md)
- [Konfiguracja modelu Local Model](local-model.md)
- [Modele decyzyjne](decision-models.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
