# Łączenie z dostawcą AI

Z tego przewodnika dowiesz się, jak połączyć aplikację Marinara Engine z dostawcą AI, żeby postacie mogły odpowiadać. Dodasz konto, wkleisz jego klucz i wybierzesz model, który odpowiada w twoich czatach.

## Konta i modele

**Konto** to jeden klucz, jedno logowanie albo jeden adres u dostawcy AI. Przechowuje dostawcę, klucz, adres i swoje limity. Jeśli używasz dwóch kluczy u tego samego dostawcy, masz dwa konta.

**Model** to jeden model AI zapisany z konta, na przykład GPT albo Claude. Każdy zapisany model ma własne ustawienia. Modele znajdują się pod swoim kontem w panelu **Connections** (Połączenia).

Klucz API to tajny kod od dostawcy AI, trochę jak hasło. Marinara przechowuje klucz na komputerze, na którym działa aplikacja Marinara Engine, i nigdy nie dołącza go do eksportu.

Marinara Engine nie ma gotowego konta ani darmowego klucza na start. Zanim zaczniesz czat, musisz dodać przynajmniej jedno konto. Jedynym wyjątkiem jest **Built-in model** (model wbudowany) w grupie **On your computer** (na twoim komputerze): działa na twoim własnym komputerze bez konta (zobacz [Konfiguracja modelu Local Model](local-model.md)).

## Panel Connections

Kontami zarządzasz w panelu **Connections** po prawej stronie aplikacji. Od góry do dołu panel pokazuje:

- Pole **Search models and accounts** (wyszukiwanie modeli i kont), które filtruje listę w trakcie pisania.
- Przycisk **Add** (dodaj), który otwiera okno **Add account** (dodanie konta), oraz **More actions** (więcej działań, trzy kropki) z opcjami **Import account** (import konta), **Export all accounts** (eksport wszystkich kont), zwijaniem i grupowaniem. W szerokim panelu lista rozwijana sortowania jest obok pola **Search models and accounts**. W wąskim panelu sortowanie znajduje się w **More actions**.
- Sekcję **Jobs** (zadania). Pokazuje, który model wykonuje każde zadanie, na przykład **Main** (główny) do odpowiedzi w czatach albo **Images** (obrazy) do obrazów. Zobacz [Wybór modelu do każdego zadania](#choosing-the-model-for-each-job).
- Twoje konta, a pod każdym z nich zapisane modele. Zobacz [Porządkowanie połączeń](organizing-connections.md).

## Dodawanie konta

1. W panelu **Connections** kliknij przycisk **Add**. Okno **Add account** wymienia dostawców w grupach **Popular** (popularne), **Subscriptions** (subskrypcje), **On your computer** i **All providers** (wszyscy dostawcy). Wpisz tekst w polu **Search providers** (wyszukiwanie dostawców), żeby znaleźć dostawcę.
2. Kliknij dostawcę, na przykład **OpenAI**, **Anthropic** albo **OpenRouter**.
3. Wklej klucz w pole **API key** (klucz API). **Where do I find my key?** (gdzie znajdę klucz?) otwiera stronę z kluczami dostawcy. Przycisk z ikoną oka pokazuje albo ukrywa klucz. **More options** (więcej opcji) zawiera opcjonalne pole **Name** (nazwa), pole **Address** (adres), **Requests per minute** (żądania na minutę) i **Parallel jobs** (zadania równoległe).
4. Kliknij przycisk **Connect** (połącz). Marinara testuje klucz. Gdy test się nie uda, okno pokazuje przyczynę i przycisk **Try again** (ponowna próba). Przy serwerach na twoim komputerze jest też opcja **Continue anyway** (kontynuuj mimo to).
5. Gdy dodajesz pierwsze konto, a nie masz modelu Main, albo dodajesz konto przy rozpoczynaniu czatu, okno przechodzi do wyboru modelu. Wybierz model. **Make … my Main** (ustaw jako mój główny) ustawia go jako Main, gdy ta opcja jest widoczna. Kliknij **Done** (gotowe), żeby zakończyć, albo **Start chatting** (rozpocznij czat), gdy dodawanie zaczęło się od nowego czatu. Jeśli masz już model Main i dodajesz konto z panelu, okno zamyka się po kliknięciu **Connect**, a panel pokazuje nowe konto. Usługi obrazów, wideo i głosu mają własne kontrolki konfiguracji; model wbudowany korzysta z ekranu konfiguracji lokalnej.

Model do każdego zadania możesz później zmienić w sekcji **Jobs**.

Jeśli pole **Name** zostanie puste, Marinara nazywa konto od dostawcy. Drugie konto u tego samego dostawcy bez wpisanej nazwy dostaje ostatnie 4 znaki swojego klucza, na przykład `OpenAI · …a1b2`. Nazwa wpisana przez ciebie nigdy nie jest zmieniana.

Pola **Address** zwykle nie trzeba ruszać. Marinara wypełnia je sama dla znanych dostawców. Zmieniaj je tylko przy serwerze proxy albo serwerze na twoim komputerze.

Część dostawców zamiast klucza używa logowania na twoim komputerze. Znajdują się w grupie **Subscriptions** i nie mają pola klucza. Zobacz [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md). Aby połączyć się z modelem działającym na własnym komputerze, zobacz [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md). Wszystkich obsługiwanych dostawców i miejsca, w których można pobrać poszczególne klucze, znajdziesz w przewodniku [Obsługiwani dostawcy AI](providers-reference.md).

### Rozpoczynanie czatu bez konta

Jeśli zaczniesz czat, zanim będziesz mieć jakikolwiek model, Marinara najpierw otwiera okno **Add account**. Po kliknięciu **Connect** pokazuje modele dostawcy. Kliknij jeden z nich, a potem przycisk **Start chatting**. Stopka okna może też ustawić ten model jako twój model **Main**.

<a id="choosing-the-model-for-each-job"></a>

## Wybór modelu do każdego zadania

Sekcja **Jobs** wymienia wszystkie zadania, które może wykonywać model, w czterech grupach:

- **Chat** (czat): **Main** pisze odpowiedzi w twoich czatach. **Agents** (agenci) uruchamia agentów pomocniczych. **Impersonate** (pisanie za ciebie) pisze w twoim imieniu.
- **Omnibar** (wyszukiwarka): **Professor Mari** i **Quick answers** (szybkie odpowiedzi).
- **Pictures & sound** (obrazy i dźwięk): **Images**, **Video** (wideo) i **Voice (Text to Speech)** (głos, synteza mowy).
- **Behind the scenes** (za kulisami): **Decision** (decyzje), **Embeddings** (embeddingi) i **Image reading** (odczytywanie obrazów).

Każdy wiersz pokazuje model, który wykonuje dane zadanie, i jego dostawcę albo to, co zadanie robi bez modelu, na przykład **Follows Main** albo **Off**. Zadanie, które wymaga modelu, pokazuje **Choose a model** (wybór modelu).

Kliknij wiersz, żeby otworzyć okno **Model for** (model dla) tego zadania. Pokazuje ono model wykonujący zadanie w grupie **Now** (teraz), twoje modele z grupy **Starred** (oznaczone gwiazdką), a potem zapisane modele według kont. **All models** (wszystkie modele) pod kontem otwiera jego pełny katalog. Wpisz tekst w polu **Search all models or paste a model ID** (przeszukiwanie wszystkich modeli lub wklejenie identyfikatora modelu), żeby przeszukać naraz wszystkie katalogi. Kliknij dowolny model, żeby przydzielić mu to zadanie; nie trzeba go wcześniej zapisywać. **If it fails** (jeśli zawiedzie) u góry okna wybiera drugi model, który odpowiada, gdy pierwszy zawiedzie. **Add account** na dole otwiera okno dodawania konta.

Kliknij **Jobs**, żeby zwinąć sekcję do samego nagłówka.

### Gdy funkcja potrzebuje modelu

Agent lub funkcja, które nie mogą działać bez określonego rodzaju modelu, sygnalizują to etykietą **Needs an image model** (potrzebny model obrazów) albo analogiczną etykietą dla wideo, dźwięku, decyzji lub czatu. Pojawia się ona na karcie agenta w panelu **Agents**, w **Chat Settings** (ustawienia czatu), w edytorze agenta oraz w oknach obrazów i wideo. Kliknij **Set up** (konfiguracja) obok niej, żeby otworzyć okno **Model for** dla tego zadania, w którym możesz wybrać model albo kliknąć **Add account**. Etykieta znika, gdy zadanie ma już model. Gdy odpowiedź się nie uda, bo nie ustawiono modelu obrazów, przycisk **Set up** w wiadomości otwiera panel **Connections**.

## Testowanie konta

Przycisk **Connect** już testuje klucz. Żeby przetestować go ponownie później, otwórz menu **⋯** konta w panelu i kliknij **Test** (test). Edytor konta, **Edit account** (edycja konta), ma przycisk **Test account** (test konta), który sprawdza klucz i adres w takiej postaci, w jakiej zostały wpisane, jeszcze przed zapisem.

<a id="choosing-a-model-for-one-chat"></a>

## Wybór modelu dla jednego czatu

Nowy czat używa twojego modelu **Main**. Żeby dać jednemu czatowi inny model, otwórz menu **Connections** w polu wiadomości albo pole **Model** w sekcji **Chat Settings → Connection**. Oba otwierają okno **Model for this chat** (model dla tego czatu):

- **Now** pokazuje model, którego używa czat. **This chat only** oznacza, że czat ma własny wybór; **follows Main** oznacza, że używa modelu Main.
- **Recent** (ostatnie) i **Starred** wymieniają twoje modele według kont.
- **Search models or paste an ID…** (wyszukiwanie modeli lub wklejenie identyfikatora) przeszukuje wszystkie katalogi. **Browse** (przeglądanie) otwiera pełną listę jednego konta.
- **Follow Main** (podążanie za modelem głównym) usuwa własny wybór czatu. **Shuffle** (losowanie) za każdym razem wybiera inny model.

Wybór zmienia tylko ten czat. Wiadomość po wyborze proponuje **Make it my Main model** (ustaw jako mój model główny) i **Undo** (cofnięcie). W trybie Game Mode pole ma etykietę **GM / Party Model**.

## Częste błędy

Jeśli test albo wiadomość się nie uda, sprawdź najpierw te rzeczy:

- Zły lub wygasły klucz. Otwórz menu **⋯** konta, kliknij **Replace key** (zastąpienie klucza) i wklej klucz jeszcze raz. Konto bez klucza pokazuje **Needs key**.
- Wyłączone konto. Pokazuje **Off**; kliknij **Turn on** (włączenie) w jego menu **⋯**.
- Klucz od niewłaściwego dostawcy. Każdy dostawca wymaga własnego klucza.
- Zablokowany lub nieosiągalny adres w polu **Address**. Zostaw je puste, żeby korzystać z adresu samego dostawcy – chyba że używasz serwera proxy albo serwera na twoim komputerze.

Więcej sposobów naprawy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Porządkowanie połączeń](organizing-connections.md)
- [Obsługiwani dostawcy AI](providers-reference.md)
- [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
- [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md)
