# Parametry generowania

Parametry generowania to ustawienia, które decydują o tym, jak model pisze każdą odpowiedź, na przykład **Temperature** (losowość) i **Max Output Tokens** (maksymalna długość odpowiedzi). Presety i konta dostarczają wartości domyślne, a sekcja **Advanced Parameters** (parametry zaawansowane) w **Chat Settings** (ustawienia czatu) nadpisuje je dla jednego czatu. Wartości domyślne dobrze sprawdzają się w zwykłym czacie i w trybie Roleplay, więc zmieniaj te ustawienia tylko po to, żeby rozwiązać konkretny problem.

## Gdzie ich szukać

| Co | Gdzie |
| --- | --- |
| Wartości początkowe presetu | **Presets** (presety), otwórz preset, zakładka **Parameters** (parametry) |
| Wartości zapisane w koncie | **Connections** (Połączenia), otwórz konto, sekcja **Chat defaults** (domyślne ustawienia czatu) |
| Nadpisania dla jednego czatu | **Chat Settings**, sekcja **Advanced Parameters** |

Presety nie ustawiają limitów tokenów kontekstu ani odpowiedzi. Okno kontekstu ustaw w **Connections**, a limity odpowiedzi w **Connections** albo w **Advanced Parameters**. Starsze pliki presetów nadal się wczytują, ale ich zapisane limity tokenów są ignorowane. Wbudowany **Marinara's Universal Preset** nie wnosi żadnych parametrów generowania.

Aby nadpisać parametry dla jednego czatu:

1. Otwórz czat.
2. Otwórz **Chat Settings**.
3. Znajdź **Advanced Parameters** i kliknij, żeby rozwinąć tę sekcję.
4. Znajdź parametr, na przykład **Temperature**, i wpisz nową wartość.
5. Sprawdź mały przełącznik obok jego nazwy. Jeśli jest wyłączony, włącz go. Parametr z wyłączonym przełącznikiem nie jest wysyłany, więc twoja zmiana nic nie da. **Temperature** zaczyna z wyłączonym przełącznikiem (zobacz [Przełącznik Send](#the-send-switch)).

Pojawia się informacja: "Change generation settings for this chat only. Leave these alone unless you know what they do." Sekcja **Advanced Parameters** jest dostępna w czatach w trybach Conversation, Roleplay i Game.

## Każdy parametr prostym językiem

Każdy parametr liczbowy ma pole do wpisania wartości i przełącznik Send (zobacz niżej).

| Parametr | Co robi | Zakres |
| --- | --- | --- |
| **Temperature** | Losowość. Niższa wartość daje odpowiedzi bardziej skupione i przewidywalne. Wyższa daje odpowiedzi bardziej kreatywne. Wartość w okolicach 1 to popularny złoty środek. | Od 0 do 2 |
| **Max Output Tokens** | Najdłuższa odpowiedź, jaką model może napisać w jednej turze. Tokeny to małe kawałki tekstu. Podnieś tę wartość, jeśli odpowiedzi się urywają. | Bez sztywnego górnego limitu |
| **Top P** | Model wybiera tylko spośród najbardziej prawdopodobnych słów, których łączna szansa sięga tej wartości. Przy 1 bierze pod uwagę wszystko. | Od 0 do 1 |
| **Top K** | Ogranicza model do kilku najbardziej prawdopodobnych słów na każdym kroku. 0 wyłącza ten limit. Wiele usług go ignoruje. | Od 0 do 500 |
| **Frequency** | Karze słowa tym mocniej, im częściej już wystąpiły. Wartości dodatnie ograniczają powtarzanie słów. | Od -2 do 2 |
| **Presence** | Karze słowa, które w ogóle się pojawiły. Wartości dodatnie popychają model w stronę nowych tematów. | Od -2 do 2 |

**Frequency** i **Presence** to kary za powtórzenia.

**Reasoning Effort** mówi modelowi zdolnemu do myślenia, czyli takiemu, który najpierw rozpisuje problem w ukrytych krokach, ile ma rozumować przed odpowiedzią. Do wyboru są **Off**, **Low**, **Medium**, **High**, **Extra high** i **Maximum**. Jeśli model nie obsługuje wybranego poziomu, Marinara obniża go do najwyższego poziomu, na jaki ten model pozwala. Po wybraniu modelu przyciski noszą nazwy poziomów, które dostaje ten model, więc **Maximum** może się wyświetlać jako **Max**, **Extra high** albo **High**.

- Przy włączonym przełączniku Send wartość **Off** prosi usługę o wyłączenie myślenia, o ile wiadomo, że model to obsługuje. Część modeli nie potrafi wyłączyć myślenia i nadal może zwracać rozumowanie. Gdy myślenia ma nie być, wybierz model, który nie rozumuje.
- Przy wyłączonym przełączniku Send nie jest wysyłana żadna preferencja co do rozumowania, a usługa używa własnego ustawienia domyślnego.

**Verbosity** ustala, jak długie i szczegółowe mają być odpowiedzi: **None**, **Low**, **Medium** albo **High**. Korzystają z tego tylko niektóre modele.

## Wskazówki dotyczące dostrajania

Zmieniaj po jednym ustawieniu naraz, żeby widzieć, co pomogło. To zasady z doświadczenia, a modele się różnią.

| Problem | Co wypróbować |
| --- | --- |
| Odpowiedzi są sztywne albo powtarzalne | Podnieś nieco **Temperature**, do wartości między 1,1 a 1,3. |
| Odpowiedzi są chaotyczne albo odbiegają od tematu | Obniż **Temperature**, do wartości między 0,7 a 0,9. |
| Odpowiedzi się urywają | Podnieś **Max Output Tokens**. |
| Postać powtarza te same sformułowania | Podnieś nieco **Frequency** albo **Presence**, do wartości między 0,3 a 0,6. |

Aby zobaczyć, jakie parametry wysłano z daną wiadomością, użyj funkcji **Peek Prompt**. Pokazuje złożony prompt, a do tego model, temperaturę, maksymalną liczbę tokenów, poziom rozumowania i więcej.

<a id="the-send-switch"></a>

## Przełącznik Send

Każdy parametr liczbowy, a także **Reasoning Effort** i **Verbosity**, ma obok nazwy mały przełącznik. Nie ma on podpisu. Najedź na niego kursorem, żeby zobaczyć "This parameter is sent to the model" albo "This parameter is not sent to the model."

- Włączony: Marinara dołącza parametr do żądania.
- Wyłączony: Marinara pomija parametr, a usługa używa własnej wartości domyślnej. To co innego niż wartość taka jak 0 czy 1, która nadal mówi usłudze, czego ma użyć.

Korzystaj z niego, gdy usługa zgłasza, że dwóch ustawień nie można używać razem (wyłącz jedno z nich), albo gdy komunikat błędu mówi, że parametr nie jest akceptowany (wyłącz go) lub jest wymagany (włącz go).

W sekcji **Advanced Parameters** czatu domyślnie wysyłane są tylko **Max Output Tokens** i **Reasoning Effort**.

## Wartości domyślne

To wartości, które pokazuje edytor, a nie zawsze te, które są wysyłane. Bez presetu generowanie zaczyna się od 4096 tokenów odpowiedzi, przed nadpisaniami konta i czatu. Aktywna scena może użyć 8192. Wiersz **Effective** (obowiązująca wartość) pokazuje wynikową wartość.

| Parametr | Wartość początkowa | Wysyłane domyślnie |
| --- | --- | --- |
| Temperature | 1 | Nie |
| Max Output Tokens | 4096 w trybie Conversation, 8192 w trybie Roleplay; bez nadpisania w trybie Game | Tak |
| Top P | 1 | Nie |
| Top K | 0 (wyłączone) | Nie |
| Frequency | 0 | Nie |
| Presence | 0 | Nie |
| Reasoning Effort | Maximum | Tak |
| Verbosity | High | Nie |

Wartość nadal widnieje w polu, gdy przełącznik Send jest wyłączony. Nie jest wysyłana, dopóki go nie włączysz.

## Prefille i znaczniki myślenia

**Assistant Prefill** (wstępny tekst odpowiedzi asystenta) to opcjonalny tekst dodawany na początku odpowiedzi AI. Zostaw to pole puste, chyba że model obsługuje tę funkcję.

- Jest wysyłany jako ostatni, po twojej wiadomości i po każdej instrukcji, która po niej następuje.
- Jeśli czat kończy się odpowiedzią AI, a **Post-Processing Messages** (przetwarzanie wiadomości) ma wartość **Apply** (zastosowanie), prefill zostaje dodany na końcu tej odpowiedzi.
- Niektóre modele odrzucają prompt, który kończy się słowami samego AI, w tym **Claude (Subscription)** z dowolnym modelem. W ich przypadku Marinara dodaje prefill na początku ostatniej odpowiedzi AI, więc nowa odpowiedź nie zaczyna się od niego.
- W czacie, w którym nie ma jeszcze odpowiedzi AI, prefill jest wysyłany na końcu jako twoja wiadomość.

**Assistant Reasoning Prefill** (wstępne rozumowanie asystenta) to opcjonalny ukryty tekst dodawany na początku rozumowania AI, przed widoczną odpowiedzią. Używaj go tylko z modelami, które obsługują osobny prefill rozumowania, takimi jak Kimi K3. Można go używać razem z **Assistant Prefill**.

Pole **Thinking Tags** (znaczniki myślenia) mówi aplikacji Marinara Engine, jak model oznacza ukryte rozumowanie w zwykłym tekście, dzięki czemu Marinara może schować to rozumowanie pod **View model thoughts** (podgląd myśli modelu). Wpisz jedno opakowanie w każdej linii, z miejscem na ukryty tekst pośrodku. Popularne opakowania, takie jak think, thinking, thought, pipe, channel i pary nawiasów, są już rozpoznawane. To pole jest potrzebne tylko przy nietypowym opakowaniu.

## Custom Parameters

Pole **Custom Parameters** (parametry własne) pozwala dodać surowe ustawienia, dla których Marinara nie ma osobnego pola. Wpisz obiekt JSON, a Marinara scali go z żądaniem.

- Zapisane jako wartości domyślne konta są wysyłane przy każdym generowaniu tekstu, które korzysta z tego konta: w trybach Conversation, Roleplay i Game, w zakładce Noodle, przy podsumowaniach, agentach i zainstalowanych pakietach agentów. Dotyczy to również własnych endpointów na twoim komputerze.
- Custom Parameters ustawione dla czatu są dodawane w tym czacie i mają pierwszeństwo przed pasującymi kluczami konta.
- Zły klucz może sprawić, że usługa odrzuci żądanie. Pisz `true`, `false` i `null` małymi literami. Zostaw to pole puste, chyba że przewodnik usługi każe dodać klucz.

## Service Tier

Ustawienie **Service Tier** (poziom usługi) pojawia się tylko wtedy, gdy konto czatu korzysta z usługi OpenRouter lub NanoGPT. Decyduje o tym, jak usługa kieruje twoje żądanie. **Default** nie wysyła żadnego poziomu. **Flex** bywa tańsze i wolniejsze. **Priority** bywa szybsze i droższe.

## Limit wiadomości w kontekście

Ustawienie **Limit Context Messages** (limit wiadomości w kontekście; podpisane też jako **Context message limit**) wysyła tylko ostatnie N wiadomości zamiast całego czatu. Domyślnie jest wyłączone. Po włączeniu licznik startuje od 50, a ustawić można wartość od 1 do 9999. Mniejsza liczba obniża koszt i przyspiesza działanie, a AI pamięta mniej.

W czacie w trybie Roleplay z włączoną funkcją **Advanced Memory Recall** (zaawansowane przywoływanie pamięci) ten limit nie jest używany. Advanced Memory Recall ustala, ile historii jest wysyłane, za pomocą ustawienia **Maximum allowed context before compression (tokens)** (maksymalny kontekst przed kompresją). Aby wysyłać mniej, zmniejsz to ustawienie w **Chat Settings → Memory Recall**. Zobacz [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

Ustawienie **Exclude Past Reasoning** (pomijanie wcześniejszego rozumowania) jest domyślnie włączone. Trzyma zapisane rozumowanie z wcześniejszych tur z dala od nowych promptów. Zostaw je włączone, chyba że masz wyraźny powód, żeby podawać modelowi stare rozumowanie z powrotem.

Po jego wyłączeniu pojawia się **Past reasoning blocks** (bloki wcześniejszego rozumowania). Domyślna wartość to 1, która zachowuje najnowszy dostępny blok rozumowania. Wartość 0 dołącza wszystkie dostępne bloki. Nie usuwa to zapisanych myśli, a ponownie wysłać można tylko rozumowanie obsługiwane przez bieżące konto.

## Image captioning

Ustawienie **Image captioning** (opisywanie obrazów) sprawia, że Marinara opisuje słowami każdy załączony obraz, korzystając z innego modelu, zamiast wysyłać sam obraz. Używaj go przy modelach, które nie widzą obrazów. Domyślnie jest wyłączone.

1. W sekcji **Advanced Parameters** włącz **Image captioning**.
2. Wybierz model z listy rozwijanej **Captioning model** (model do opisywania obrazów).
3. Opcjonalnie edytuj **Captioning Prompt** (prompt do opisywania obrazów), czyli instrukcje wysyłane razem z każdym obrazem. Przycisk resetowania albo wyczyszczenie pola przywraca wartość domyślną. Prompt jest zapisywany tylko dla tego czatu, a **Save as Connection Default** go nie kopiuje.

Jeśli to nie zadziałało: gdy opisywanie się nie uda, bo konto używane do opisów jest uszkodzone, zostało usunięte albo nic nie zwraca, odpowiedź zatrzymuje się z błędem **Image captioning failed**. Marinara nie wysyła wtedy zamiast tego samego obrazu. Napraw lub zmień model do opisywania obrazów albo wyłącz **Image captioning**.

## Save as Connection Default

Na dole sekcji **Advanced Parameters** przycisk **Save as Connection Default** (zapisanie jako domyślne dla połączenia) zapisuje bieżące wartości w koncie. Nowe czaty korzystające z tego konta zaczynają wtedy od tych wartości. Przycisk pojawia się tylko przy zapisanym, zwykłym koncie. Jest ukryty przy losowej puli i przy wbudowanym modelu.

**Reset to Defaults** (przywrócenie wartości domyślnych) kasuje wszystkie zmiany wprowadzone w tym czacie i przywraca czatowi odziedziczone ustawienia. Odziedziczone przełączniki Send podążają za wybranym kontem. Przełącznik Send zmieniony samodzielnie pozostaje nadpisaniem czatu, dopóki go nie zresetujesz.

## Jak nakładają się i nadpisują wartości domyślne

Marinara ustala każdy parametr według tej listy. Późniejsze pozycje nadpisują wcześniejsze.

1. Sekcja **Parameters** presetu albo wbudowane wartości domyślne, gdy nie używasz presetu. Limit odpowiedzi zaczyna się od 4096 tokenów, bo presety nie mogą ustawiać limitów odpowiedzi. W trybie Roleplay nadpisanie presetu ustawione w koncie ma pierwszeństwo przed presetem wybranym w czacie.
2. Sekcja **Chat defaults** konta.
3. Sekcja **Advanced Parameters** tego czatu.
4. Reguły trybu. Aktywny czat sceny ustawia limit odpowiedzi na 8192, rozumowanie na **Maximum**, a szczegółowość na **High**. Tryb Game używa zapisanych parametrów konta i czatu bez wymuszania próbkowania, rozumowania ani minimalnej długości odpowiedzi.
5. Limity odpowiedzi. Tryb Game stosuje znany limit odpowiedzi modelu, a ustawienie **Max output tokens override** (nadpisanie maksymalnej liczby tokenów odpowiedzi) konta ogranicza żądania w każdym trybie. Dostępny kontekst może dodatkowo zmniejszyć budżet.

Wiersz **Effective** obok parametru pokazuje wartość, która wygrywa, i warstwę, z której pochodzi, na przykład **Effective: 16384 · this chat** albo **Effective: 4096 · output token cap**, gdy obowiązuje limit konta. Wyłączony przełącznik Send pokazuje **not sent**. Usługi nadal mogą wymagać parametrów lub dostosowywać nieobsługiwane wartości. Custom Parameters i dopasowanie do kontekstu mogą zmienić ostateczne żądanie. Zresetowanie parametrów czatu usuwa tylko nadpisanie tego czatu (pozycja 3). Wartość pochodzi wtedy z **Chat defaults** konta, jeśli są ustawione, a w przeciwnym razie z presetu. Reguły trybu i limity odpowiedzi (pozycje 4 i 5) nadal obowiązują potem.

<a id="parameters-for-agents"></a>

## Parametry agentów

Wywołania agentów korzystają z **Chat defaults** zapisanych w koncie, na którym działają: własnym koncie agenta albo koncie czatu, gdy agent nie ma własnego. Przełączniki Send i limity modeli działają tak samo jak przy odpowiedzi na czacie. Presety i **Advanced Parameters** czatu nie zmieniają wywołań agentów, z wyjątkiem opisanej niżej reguły temperatury.

- **Wysyłane do agentów:** Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, własne nagłówki oraz dodatkowe parametry, takie jak Top A albo ziarno losowości, dodane w **Settings** (Ustawienia), potem **Advanced** (zaawansowane), a następnie **Parameters**. Parametr z wyłączonym przełącznikiem Send nie jest wysyłany.
- **Niewysyłane do agentów:** Max Output Tokens, sekwencje zatrzymania, prefille, Thinking Tags i inne ustawienia formatu promptu. Każdy agent zachowuje własne **Max Output Tokens**.
- **Temperature:** agent korzysta z temperatury konta albo z 0,7, gdy nie zapisano żadnej. Beholder zawsze używa 0, a moduł piszący prompty dla agenta Illustrator używa własnej wartości. Podczas odpowiedzi na czacie agenci na koncie czatu przyjmują temperaturę i przełączniki Send ustalone przez czat. Ponowienia korzystają z wartości zapisanych w koncie.
- **Reasoning Effort:** wybrany poziom albo **Off** dotyczy każdego agenta na tym koncie, którego model przyjmuje to ustawienie. **Use custom defaults for this model** (własne wartości domyślne dla tego modelu) ustawia początkowo Reasoning Effort na **Maximum** w większości kont (**Default** na koncie Codex), więc agenci myślą na najwyższym poziomie, co trwa dłużej i kosztuje więcej. Wybierz niższy poziom albo wyłącz przełącznik Send tego parametru, żeby agenci myśleli mniej. Bez zapisanego poziomu agenci odpowiadający w JSON proszą o wyłączenie myślenia, a pozostali zostawiają ustawienie domyślne modelu. Gemini 4 Argon i Carbon nie potrafią wyłączyć myślenia, więc w Google AI Studio i Vertex ich agenci wysyłają zamiast tego **Medium**.
- **Miejsce na myślenie:** gdy konto ma zapisany Reasoning Effort albo model to Gemini 4 Argon lub Carbon, Marinara dodaje miejsce na myślenie ponad **Max Output Tokens** agenta, w granicach limitu odpowiedzi konta, limitu modelu i wolnego kontekstu. Własny endpoint dostaje je nawet wtedy, gdy nie wysyła poziomu.

Zainstalowane pakiety agentów korzystają z tych samych wartości konta. Wartość, którą konto zapisuje i wysyła, zastępuje tę, o którą prosi pakiet, a wszystko, co nie jest ustawione, zachowuje ustawienie pakietu. **Reasoning Effort** albo **Max Output Tokens** wyłączone w koncie nie są wysyłane, nawet jeśli pakiet o nie prosi. Temperature i Verbosity są początkowo wyłączone, więc zostaje własna wartość pakietu.

## Część modeli ignoruje część parametrów

Nie każdy model przyjmuje każdy parametr. Gdy Marinara wie, że model odrzuca dane ustawienie, pomija je w żądaniu. Kontrolka nadal jest widoczna, ale jej zmiana nic nie daje. Zdarza się to często przy modelach rozumujących, które odrzucają ustawienia próbkowania, takie jak temperatura. Przy modelu z automatycznym routingiem, który za każdym razem zmienia model udzielający odpowiedzi, parametry mogą zachowywać się inaczej z tury na turę. Wybierz jeden stały model, żeby zachowanie było stabilne.

## Powiązane przewodniki

- [Edytor presetów i menedżer promptów](presets.md)
- [Peek Prompt: zobacz, co dostał model AI](../chats/peek-prompt.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
