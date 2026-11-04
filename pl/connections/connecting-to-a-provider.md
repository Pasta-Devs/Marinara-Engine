# Łączenie z dostawcą AI

Do czatowania aplikacja Marinara Engine potrzebuje modelu AI. Możesz dodać konto w usłudze AI, wkleić jej klucz API i wybrać model. Klucz API to tajny kod od usługi, dzięki któremu Marinara może korzystać z twojego konta w tej usłudze. Traktuj go jak hasło. Możesz też użyć [modelu wbudowanego](local-model.md), małego modelu, który działa na twoim komputerze bez klucza.

## Dodawanie konta

Zanim zaczniesz, zdobądź klucz API w usłudze, z której chcesz korzystać. Okno **Add account** (dodanie konta) ma dla każdej usługi link **Where do I find my key?** (gdzie znajdę klucz?). Oto strony, które otwiera dla popularnych usług.

- OpenRouter (ma darmowe modele): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

Większość usług wymaga rejestracji, a niektóre także doładowania środków, zanim klucz zacznie działać. Inne usługi opisuje przewodnik [Obsługiwani dostawcy AI](providers-reference.md). Żeby użyć modelu na własnym komputerze bez klucza, zobacz [Konfiguracja modelu wbudowanego](local-model.md).

1. Kliknij **Connections** (Połączenia) na górnym pasku. Panel otwiera się po prawej stronie. Jeśli nie masz jeszcze żadnych kont, pyta **Where do your models come from?** (skąd pochodzą twoje modele?) i pokazuje kilka usług. Kliknij usługę, ale nie **Built-in model** (model wbudowany). Okno **Add account** otwiera się na kroku z kluczem. Przejdź do kroku 4.
2. Kliknij **Add** (dodaj). Otwiera się okno **Add account**.
3. Kliknij wybraną usługę. Żeby ją znaleźć, wpisz tekst w polu **Search providers** (wyszukiwanie dostawców). Lista ma sekcje **Chat** (czat), **Images & video** (obrazy i wideo), **Voice** (głos) i **Decisions** (decyzje). Zwykłego modelu czatu szukaj w sekcji **Chat**.
4. Kliknij **API key** (klucz API) i wklej klucz. Kliknij przycisk z ikoną oka, żeby sprawdzić, czy wkleił się cały.
5. Kliknij **Connect** (połącz). Marinara testuje klucz. Gdy działa, widzisz **Connected** z liczbą znalezionych modeli.
6. Dalszy przebieg zależy od tego, czy masz już model Main. Main to zadanie pisania odpowiedzi w twoich czatach.
   - **Nie masz jeszcze modelu Main albo okno Add otwarto z nowego czatu:** okno pokazuje modele usługi. Modele **Recommended** (zalecane) są na górze. Kliknij model, żeby go dodać, albo wpisz nazwę w polu **Search or enter model ID…** (wyszukiwanie lub wpisanie identyfikatora modelu). Jeśli nie wiesz, który wybrać, weź jeden z modeli **Recommended**. Możesz to później zmienić. Zostaw zaznaczone **Make … my Main model** (ustaw jako mój model główny). Ta opcja pojawia się tylko wtedy, gdy nie masz modelu Main. Gdy okno Add otwarto z nowego czatu, a model Main już masz, zamiast niej pojawia się przycisk **Set … as Main** (ustaw jako model główny). Potem kliknij **Done** (gotowe) albo, w nowym czacie, **Start chatting** (rozpocznij czat).
   - **Masz już model Main:** okno się zamyka, a komunikat informuje, że konto zostało dodane, i podaje liczbę jego modeli. Żeby dodać więcej modeli, kliknij **⋯** na koncie i wybierz **Add model** (dodanie modelu).

Panel pokazuje twoje konto. **Connected** w kroku 5 już oznacza, że klucz działa. Jeśli nowy model jest twoim modelem Main, rozpocznij czat i wyślij wiadomość: odpowiedź oznacza, że wszystko działa. Jeśli model Main był już wcześniej ustawiony, nowe czaty nadal go używają. Żeby korzystać z nowego konta, dodaj do niego model (**⋯** → **Add model**), a potem wybierz ten model dla czatu albo zadania (zobacz [Wybór modelu do każdego zadania](#choosing-the-model-for-each-job)).

Jeśli to nie zadziałało:

- **The key was not accepted. Check that you copied all of it.** Wklej klucz jeszcze raz i kliknij **Try again** (ponowna próba). Klucz musi pochodzić z wybranej usługi.
- **The service is busy, or your credit is used up.** Doładuj środki na stronie usługi albo poczekaj i spróbuj ponownie.
- Komunikat **Marinara could not reach** oznacza, że nie udało się połączyć z usługą. Sprawdź połączenie z internetem, a potem kliknij **Try again**.

### Opcjonalne pola konta

Krok z kluczem pokazuje też te pola. Zostaw je puste, chyba że ich potrzebujesz.

- **Name (optional)** (nazwa, opcjonalnie): nazwa widoczna w panelu. Puste pole oznacza nazwę usługi. Drugie konto w tej samej usłudze dostaje ostatnie 4 znaki swojego klucza, na przykład `OpenAI · …a1b2`.
- **Address** (adres): miejsce, do którego Marinara wysyła żądania. Gdy pole jest puste, Marinara używa własnego adresu usługi. Wypełnij je tylko dla serwera proxy, pośrednika (gateway) albo serwera, który uruchamiasz samodzielnie. Usługi, w których logujesz się na swoim komputerze, nie pokazują tego pola.
- **Requests per minute** (żądania na minutę): ogranicza tempo żądań aplikacji Marinara Engine na tym koncie. Puste pole oznacza brak limitu. Dozwolone wartości to od 1 do 600.
- **Parallel jobs** (zadania równoległe): ile żądań działa jednocześnie. Puste pole oznacza brak limitu. Dozwolone wartości to od 1 do 16. W oknie **Edit account** (edycja konta) to samo ustawienie nazywa się **Parallel requests** (żądania równoległe).

Niektóre usługi zamiast klucza używają logowania na twoim komputerze. Mają etykietę **Sign in** (logowanie) i nie mają pola klucza. Zobacz [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md). Serwer na twoim komputerze opisuje przewodnik [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md). Po nieudanym teście pojawia się **Continue anyway** (kontynuuj mimo to). Ta opcja zapisuje konto bez zaliczonego testu.

### Rozpoczynanie czatu bez konta

Jeśli zaczniesz czat, zanim będziesz mieć jakikolwiek model, Marinara najpierw otwiera okno **Add account**. Po kliknięciu **Connect** kliknij model, a potem **Start chatting**.

## Panel Connections

Kontami zarządzasz w panelu **Connections**. Od góry do dołu panel pokazuje:

- Pole wyszukiwania, które filtruje listę w trakcie pisania. Jego etykieta to **Search models and accounts** (wyszukiwanie modeli i kont).
- Przycisk **Add**, który otwiera okno **Add account**, oraz **More actions** (więcej działań, trzy kropki) z opcjami **Import account** (import konta), **Export all accounts** (eksport wszystkich kont), zwijaniem i grupowaniem. W szerokim panelu lista rozwijana sortowania jest obok pola wyszukiwania. W wąskim panelu sortowanie znajduje się w **More actions**.
- Sekcję **Jobs** (zadania). Pokazuje, który model wykonuje każde zadanie.
- Kartę **Built-in model**. Zobacz [Konfiguracja modelu wbudowanego](local-model.md).
- Twoje konta, a pod każdym z nich zapisane modele. Zobacz [Porządkowanie połączeń](organizing-connections.md).

**Konto** to jeden zapisany klucz, jedno logowanie albo jeden adres dla jednej usługi. Jeśli używasz dwóch kluczy w tej samej usłudze, masz dwa konta. **Model** to jeden model AI zapisany z konta. Każdy zapisany model ma własne ustawienia.

<a id="choosing-the-model-for-each-job"></a>

## Wybór modelu do każdego zadania

Zadanie to coś, co model robi dla ciebie. Sekcja **Jobs** wymienia zadania w czterech grupach:

| Grupa | Zadania |
| --- | --- |
| **Chat** | **Main** (główny) pisze odpowiedzi w twoich czatach. **Agents** (agenci) uruchamia agentów pomocniczych. **Impersonate** (pisanie za ciebie) pisze w twoim imieniu. |
| **Omnibar** (wyszukiwarka) | **Professor Mari** i **Quick answers** (szybkie odpowiedzi). |
| **Pictures & sound** (obrazy i dźwięk) | **Images** (obrazy), **Video** (wideo), **Voice (Text to Speech)** (głos, synteza mowy) i **Dictation (Speech to Text)** (dyktowanie, zamiana mowy na tekst), gdy jest dostępne. |
| **Behind the scenes** (za kulisami) | **Decision** (decyzje), **Embeddings** (embeddingi) i **Image reading** (odczytywanie obrazów). |

Każdy wiersz pokazuje model, który wykonuje dane zadanie, albo to, co zadanie robi bez modelu, na przykład **Follows Main** albo **Off**. Zadanie, które wymaga modelu, pokazuje **Choose a model** (wybór modelu). Kliknij **Jobs**, żeby zwinąć sekcję.

Żeby zmienić model zadania, kliknij jego wiersz. Otwiera się okno **Model for** (model dla) tego zadania, z wyjątkiem trzech wierszy. **Decision** i **Embeddings** otwierają własne kontrolki (zobacz [Modele decyzyjne](decision-models.md) i [Obsługiwani dostawcy AI](providers-reference.md#embeddings)). **Dictation (Speech to Text)** otwiera konfigurację mowy.

W oknie **Model for**:

1. Przejrzyj listę.
2. Kliknij model. Lista pokazuje model wykonujący zadanie w grupie **Now** (teraz), potem twoje modele z grupy **Starred** (oznaczone gwiazdką), a potem zapisane modele według kont. **All models** (wszystkie modele) pod kontem otwiera jego pełną listę. Wpisz tekst w polu **Search all models or paste a model ID** (przeszukiwanie wszystkich modeli lub wklejenie identyfikatora modelu), żeby przeszukać naraz wszystkie konta. Nie trzeba wcześniej zapisywać modelu.

**If it fails** (jeśli zawiedzie) u góry okna wybiera drugi model, który odpowiada, gdy pierwszy zawiedzie. **Add account** na dole otwiera okno dodawania konta.

### Gdy funkcja potrzebuje modelu

Funkcja, która nie może działać bez określonego rodzaju modelu, pokazuje etykietę **Needs an image model** (potrzebny model obrazów) albo analogiczną dla wideo, dźwięku, decyzji lub czatu. Widać ją na karcie agenta w panelu **Agents** (agenci), w **Chat Settings** (ustawienia czatu), w edytorze agenta oraz w oknach obrazów i wideo. Kliknij **Set up** (konfiguracja) obok niej, a potem wybierz model albo kliknij **Add account**. Etykieta znika, gdy zadanie ma już model.

## Testowanie konta

**Connect** już testuje klucz. Żeby przetestować go ponownie później, otwórz menu **⋯** konta w panelu i kliknij **Test** (test). Edytor konta (**Edit account**) ma przycisk **Test account** (test konta), który sprawdza klucz i adres w takiej postaci, w jakiej zostały wpisane, jeszcze przed zapisem.

<a id="choosing-a-model-for-one-chat"></a>

## Wybór modelu dla jednego czatu

Nowy czat używa twojego modelu **Main**. Żeby dać jednemu czatowi inny model, kliknij przycisk modelu w polu wiadomości (ikona linku z nazwą bieżącego modelu) albo użyj pola **Model** (model) w **Chat Settings → Connection** (ustawienia czatu, połączenie). Oba otwierają okno **Model for this chat** (model dla tego czatu):

- **Now** pokazuje model, którego używa czat. **This chat only** oznacza, że czat ma własny wybór. **follows Main** oznacza, że używa modelu Main.
- **Recent** (ostatnie) i **Starred** wymieniają twoje modele według kont.
- **Search models or paste an ID…** (wyszukiwanie modeli lub wklejenie identyfikatora) przeszukuje wszystkie konta. **Browse** (przeglądanie) otwiera pełną listę jednego konta.
- **Follow Main** (podążanie za modelem głównym) usuwa własny wybór czatu. **Shuffle** (losowanie) za każdym razem wybiera inny model.

Wybór zmienia tylko ten czat. Komunikat po wyborze proponuje **Make it my Main model** (ustaw jako mój model główny) i **Undo** (cofnięcie). W trybie Game Mode pole ma etykietę **Game Master model** (model mistrza gry).

## Częste błędy

Jeśli test albo wiadomość się nie uda, sprawdź najpierw te rzeczy:

- Zły lub wygasły klucz. Kliknij **⋯** na koncie, wybierz **Replace key** (zastąpienie klucza) i wklej klucz jeszcze raz. Konto bez klucza pokazuje **Needs key**.
- Wyłączone konto. Pokazuje **Off**. Kliknij **Turn on** (włączenie) w jego menu **⋯**.
- Klucz z innej usługi. Każda usługa wymaga własnego klucza.
- Zablokowany adres w polu **Address**. Puste pole oznacza własny adres usługi.

Więcej sposobów naprawy znajdziesz w przewodniku [Rozwiązywanie problemów w aplikacji Marinara Engine](../TROUBLESHOOTING.md).

## Powiązane przewodniki

- [Porządkowanie połączeń](organizing-connections.md)
- [Obsługiwani dostawcy AI](providers-reference.md)
- [Połączenia abonamentowe z Claude, ChatGPT i Grok](subscription-clis.md)
- [Podłączanie modelu lokalnego lub samodzielnie hostowanego](local-self-hosted.md)
