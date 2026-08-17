# Parametry generowania

Ten przewodnik wyjaśnia parametry generowania w aplikacji Marinara Engine. To ustawienia, które decydują o tym, jak AI pisze każdą odpowiedź – na przykład **Temperature** (losowość) i **Max Output Tokens** (maksymalna długość odpowiedzi). Ustawia się je osobno dla każdego czatu, w panelu **Advanced Parameters** (parametry zaawansowane).

## Do czego służą parametry generowania

Parametr generowania to ustawienie próbkowania. Decyduje o tym, jak model zamienia prompt (tekst, który Marinara wysyła do AI) w gotową wypowiedź. Nie zmienia tego, co mówisz do AI. Zmienia to, jak AI odpowiada.

Na przykład jeden parametr sprawia, że odpowiedzi są bardziej losowe i kreatywne. Inny ustala, jak długą odpowiedź model może napisać. Większość osób nigdy nie musi tu nic ruszać. Wartości domyślne sprawdzają się w zwykłym czacie i w trybie Roleplay.

Zmieniaj te ustawienia tylko wtedy, gdy chcesz rozwiązać konkretny problem. Pod koniec tego przewodnika znajdziesz listę typowych problemów i parametrów, które warto przy nich wypróbować.

## Gdzie ich szukać

Parametry generowania należą do konkretnego czatu, a nie do globalnego menu.

1. Otwórz czat, w którym chcesz coś zmienić.
2. Otwórz panel **Chat Settings** (ustawienia czatu), czyli ikonę koła zębatego przy aktywnym czacie.
3. Znajdź sekcję **Advanced Parameters** i kliknij ją, żeby ją rozwinąć.

Powinna pojawić się podpowiedź o treści: "Override generation parameters for this chat. Only change these if you know what you're doing." Wszystkie opisane niżej ustawienia znajdują się w sekcji **Advanced Parameters**.

Sekcja **Advanced Parameters** jest dostępna w każdym trybie czatu (Conversation, Roleplay i Game).

## Każdy parametr prostym językiem

Każdy parametr liczbowy ma pole do wpisania wartości oraz własny przełącznik. Ten przełącznik decyduje o tym, czy parametr trafia do modelu. Opisuje go następna sekcja.

**Temperature** steruje losowością. Zakres to od 0 do 2. Niższe wartości dają odpowiedzi bardziej skupione i przewidywalne. Wyższe wartości dają odpowiedzi bardziej kreatywne i różnorodne. Wartość w okolicach 1 to popularny złoty środek.

**Max Output Tokens** ustala, jak długą odpowiedź model może napisać w jednej turze. Token to mały kawałek tekstu, mniej więcej krótkie słowo albo jego część. Podnieś tę wartość, jeśli odpowiedzi wciąż się urywają. Pole nie ma sztywnego górnego limitu.

**Top P** to tak zwane próbkowanie jądrowe (nucleus sampling). Zakres to od 0 do 1. Model wybiera tylko spośród najbardziej prawdopodobnych słów, których łączna szansa sięga tej wartości. Niższe wartości dają odpowiedzi bardziej skupione. Wartość 1 pozwala modelowi brać pod uwagę wszystko.

**Top K** ogranicza model do kilku najbardziej prawdopodobnych słów na każdym kroku. Zakres to od 0 do 500. Wartość 0 wyłącza ten limit. Wielu dostawców ignoruje to ustawienie.

**Frequency** karze słowa tym mocniej, im częściej już wystąpiły. Zakres to od -2 do 2. Wartość dodatnia ogranicza powtarzanie słów. To kara za częstotliwość, w aplikacji podpisana jako **Frequency**.

**Presence** karze słowa, które w ogóle się pojawiły, niezależnie od tego, jak często. Zakres to od -2 do 2. Wartość dodatnia popycha model w stronę nowych tematów. To kara za obecność, w aplikacji podpisana jako **Presence**.

Razem **Frequency** i **Presence** tworzą kary za powtórzenia.

**Reasoning Effort** mówi modelowi myślącemu, ile ma się zastanawiać, zanim odpowie. Model myślący to taki, który najpierw rozpisuje problem w ukrytych krokach. Do wyboru są **None**, **Low**, **Medium**, **High**, **Xhigh** i **Maximum**. Jeśli model nie obsługuje wybranego poziomu, Marinara obniża go do najwyższego poziomu, na jaki ten model pozwala.

Kiedy przełącznik parametru jest włączony, wartość **None** prosi dostawcę o wyraźne wyłączenie myślenia, zamiast tylko pominąć ustawienie wysiłku. Marinara wysyła właściwą dla dostawcy komendę wyłączenia wyłącznie do modeli, o których wiadomo, że ją obsługują. Część modeli ma rozumowanie wymuszone, nie da się go u nich wyłączyć i nadal mogą je zwracać. Kiedy myślenia ma nie być, wybierz model, który nie rozumuje. Wyłączenie samego przełącznika parametru działa inaczej: wtedy Marinara nie wysyła żadnej preferencji co do rozumowania i zostawia domyślne zachowanie dostawcy bez zmian.

**Verbosity** decyduje o tym, jak długie i szczegółowe mają być odpowiedzi. Do wyboru są **None**, **Low**, **Medium** i **High**. Wartość **Low** skraca odpowiedzi. Wartość **High** zachęca do dłuższych i bardziej opisowych odpowiedzi. Z tego ustawienia korzystają tylko niektóre modele.

## Przełącznik Send

Każdy parametr liczbowy, a także **Reasoning Effort** i **Verbosity**, ma obok nazwy mały przełącznik. W aplikacji nie ma on żadnego podpisu; w tym przewodniku występuje pod nazwą przełącznik Send. Najedź na niego, żeby zobaczyć podpowiedź "This parameter is sent to the model" albo "This parameter is not sent to the model."

Kiedy przełącznik Send przy parametrze jest włączony, Marinara dołącza ten parametr do żądania wysyłanego do dostawcy. Kiedy jest wyłączony, Marinara całkowicie pomija ten parametr. Dostawca używa wtedy własnej wartości domyślnej.

Wyłączenie przełącznika Send to co innego niż wpisanie wartości 1 czy 0. Wartość 1 wciąż mówi dostawcy, czego ma użyć. Wyłączony przełącznik nie mówi dostawcy nic, więc decyduje sam model.

Przełącznik Send przydaje się wtedy, gdy dostawca zgłasza, że dwóch ustawień nie można używać razem. Wyłącz jedno z nich i spróbuj ponownie. Przyda się też wtedy, gdy komunikat błędu mówi, że parametr nie jest akceptowany albo że jest wymagany. Wyłącz przełącznik tego parametru, jeśli parametr nie jest akceptowany, albo włącz go, jeśli jest wymagany.

W sekcji **Advanced Parameters** danego czatu przełącznik Send jest domyślnie włączony tylko przy **Max Output Tokens** i **Reasoning Effort**. Pozostałe zaczynają jako wyłączone.

## Wartości domyślne

Nowe czaty startują z wbudowanego zestawu wartości. Tabela poniżej pokazuje te wartości początkowe oraz to, czy każda z nich jest domyślnie wysyłana.

| Parametr | Wartość początkowa | Wysyłane domyślnie |
|---|---|---|
| Temperature | 1 | Nie |
| Max Output Tokens | 4096 w trybie Conversation, 8192 w trybach Roleplay i Game | Tak |
| Top P | 1 | Nie |
| Top K | 0 (wyłączone) | Nie |
| Frequency | 0 | Nie |
| Presence | 0 | Nie |
| Reasoning Effort | Maximum | Tak |
| Verbosity | High | Nie |

Wartość widnieje w polu nawet wtedy, gdy przełącznik **Send toggle** jest wyłączony. Po prostu nie trafia do modelu, dopóki go nie włączysz.

## Assistant Prefill

**Assistant Prefill** to opcjonalny tekst dopisywany na samym początku odpowiedzi AI, zaraz po twojej wiadomości. Większość osób zostawia to pole puste.

Korzystaj z niego tylko przy modelach, które obsługują prefill albo ustalony znacznik otwierający. Można na przykład wpisać znacznik otwierający taki jak w tekście zastępczym pola, żeby wymusić na modelu określony początek odpowiedzi. W razie wątpliwości zostaw to pole puste.

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill** (wstępne rozumowanie asystenta) to opcjonalny ukryty tekst dopisywany na samym początku rozumowania modelu, zanim powstanie widoczna odpowiedź. Większość osób zostawia to pole puste.

Korzystaj z niego tylko przy modelach, które obsługują osobny prefill rozumowania, takich jak Kimi K3. Można używać go razem z **Assistant Prefill**: jedno rozpoczyna ukryte rozumowanie modelu, a drugie jego widoczną odpowiedź. Jeśli nie masz pewności, czy model to obsługuje, zostaw pole puste.

## Thinking Tags

Pole **Thinking Tags** mówi aplikacji Marinara Engine, jak dany model oznacza ukryte rozumowanie w zwykłym tekście. Część modeli opakowuje rozumowanie w znaczniki. Jeśli Marinara zna te znaczniki, chowa rozumowanie pod akcją **View thoughts** zamiast pokazywać je w odpowiedzi.

Wpisuj jedno opakowanie w każdej linii, z miejscem na ukryty tekst pośrodku. Popularne opakowania – think, thinking, thought, pipe, channel oraz pary nawiasów – Marinara rozpoznaje sama. To pole przydaje się tylko przy modelach, które używają nietypowego opakowania.

## Custom Parameters

Pole **Custom Parameters** pozwala dodać surowe ustawienia, dla których Marinara nie ma osobnego pola. Wpisujesz obiekt w formacie JSON, a Marinara dołącza go do żądania wysyłanego do dostawcy.

Wartości **Custom Parameters** zapisane jako domyślne dla połączenia trafiają do każdego generowania tekstu przez API, które korzysta z tego połączenia – w tym do trybów Conversation, Roleplay i Game, do zakładki Noodle, do podsumowań i do agentów. Dotyczy to również własnych endpointów działających na twoim komputerze. Wartości **Custom Parameters** ustawione dla pojedynczego czatu dochodzą tylko w tym czacie i mają pierwszeństwo przed pasującymi kluczami z poziomu połączenia.

To pole dla zaawansowanych. Zły klucz może sprawić, że dostawca odrzuci żądanie. W obiekcie trzeba pisać `true`, `false` i `null` małymi literami. Zostaw to pole puste, chyba że przewodnik dostawcy każe dodać konkretny klucz.

## OpenRouter Service Tier

Ustawienie **OpenRouter Service Tier** pojawia się tylko wtedy, gdy połączenie czatu korzysta z dostawcy OpenRouter. Decyduje o tym, jak OpenRouter kieruje żądanie. Do wyboru są **Default**, **Flex** i **Priority**. Opcja **Flex** bywa tańsza i wolniejsza. Opcja **Priority** bywa szybsza i droższa. Opcja **Default** nie wysyła żadnego poziomu.

## Limit wiadomości w kontekście

Ustawienie **Limit Context Messages** decyduje o tym, ile historii czatu trafia do modelu. Włącz je, żeby wysyłać tylko ostatnie N wiadomości zamiast całego czatu.

Po włączeniu licznik startuje z wartości 50. Da się wpisać dowolną liczbę od 1 do 9999. Mniejsza liczba wysyła mniej historii, co potrafi obniżyć koszt i przyspieszyć działanie. Oznacza też, że AI pamięta mniej ze starszej części czatu. To ustawienie jest domyślnie wyłączone.

## Exclude Past Reasoning

Ustawienie **Exclude Past Reasoning** jest domyślnie włączone. Trzyma zapisane myślenie i rozumowanie z wcześniejszych tur z dala od nowych promptów. Marinara nie wysyła tego rozumowania do modelu po raz drugi.

Zostaw je włączone, chyba że masz wyraźny powód, by podawać modelowi stare rozumowanie z powrotem.

## Image Captioning

Ustawienie **Image Captioning** zmienia sposób, w jaki AI obsługuje załączone obrazy. Po włączeniu Marinara opisuje każdy załączony obraz tekstem, korzystając z wybranego połączenia, zamiast wysyłać sam obraz.

Przydaje się przy modelach, które nie widzą obrazów. Po włączeniu wybierz połączenie z listy rozwijanej **Captioning Connection**. Endpoint obsługujący tylko tekst może zgłosić błąd, jeśli wskażesz niewłaściwe połączenie. To ustawienie jest domyślnie wyłączone.

## Save as Connection Default

Na dole sekcji **Advanced Parameters** przycisk **Save as Connection Default** zapisuje bieżące wartości parametrów w samym połączeniu. Od tej pory nowe czaty korzystające z tego połączenia startują z tych wartości.

Przycisk pojawia się tylko przy zwykłym, zapisanym połączeniu. Nie ma go przy losowej puli połączeń ani przy wbudowanym modelu lokalnym.

Przycisk **Reset to Defaults** poniżej kasuje wszystkie zmiany parametrów wprowadzone w tym czacie i przywraca wartości bazowe trybu.

## Jak nakładają się i nadpisują wartości domyślne

Obowiązujące parametry powstają z trzech warstw. Każda warstwa wygrywa z poprzednią, ustawienie po ustawieniu.

1. Wartości bazowe trybu. To wbudowany punkt startowy dla trybu, w którym działa czat.
2. Wartości domyślne zapisane w połączeniu. To wartości zapisane przyciskiem **Save as Connection Default**.
3. Sekcja **Advanced Parameters** tego czatu. To wartości ustawione tutaj i właśnie one wygrywają.

Wartość ustawiona w sekcji **Advanced Parameters** zawsze bije wartość domyślną połączenia i wartość bazową trybu.

Game Mode to przypadek szczególny. Tryb Game Mode część parametrów ustawia sam, żeby jego uporządkowane tury działały poprawnie. W trybie Game Mode część zmian z sekcji **Advanced Parameters** może więc nie zadziałać w pełni. Tak ma być.

## Część modeli ignoruje część parametrów

Nie każdy model przyjmuje każdy parametr. Kiedy Marinara wie, że model odrzuca dane ustawienie, pomija je w żądaniu. Suwak albo pole nadal widnieje w aplikacji, ale jego zmiana nie robi przy tym modelu żadnej różnicy.

Zdarza się to często przy modelach rozumujących i myślących, które odrzucają ustawienia próbkowania takie jak temperatura. Jeśli ustawienie sprawia wrażenie martwego, model może go nie przyjmować. Zachowanie zależy też mocno od wybranego modelu, więc ta sama wartość potrafi dawać inny efekt w różnych modelach.

Przy modelu z automatycznym routingiem, który za każdym razem może wybrać inny model do odpowiedzi, parametry potrafią zachowywać się inaczej z tury na turę. Wskazanie jednego konkretnego modelu utrzymuje stabilne zachowanie.

## Wskazówki: co zmienić przy jakim objawie

Większość osób nigdy tego nie zmienia. Jeśli chcesz spróbować, zmieniaj po jednym ustawieniu naraz – tylko wtedy widać, co faktycznie pomogło.

- Odpowiedzi są sztywne albo powtarzalne: podnieś nieco **Temperature**, na przykład z 1 do wartości między 1.1 a 1.3.
- Odpowiedzi są chaotyczne albo odbiegają od tematu: obniż **Temperature**, na przykład do wartości między 0.7 a 0.9.
- Odpowiedzi urywają się w połowie: podnieś **Max Output Tokens**.
- Postać wciąż powtarza te same sformułowania: podnieś nieco **Frequency** albo **Presence**, na przykład do wartości między 0.3 a 0.6.

To zasady z doświadczenia, a nie przetestowane zalecenia. Różne modele reagują różnie, więc wartość, która sprawdza się na jednym połączeniu, nie musi zadziałać na innym.

Żeby zobaczyć dokładnie, jakie parametry poszły z konkretną wiadomością, użyj funkcji **Peek Prompt**. Pokazuje ona złożony prompt, a do tego model, temperaturę, maksymalną liczbę tokenów, poziom rozumowania i więcej.

## Powiązane przewodniki

- [Edytor presetów i menedżer promptów](presets.md)
- [Peek Prompt: zobacz, co dostał model AI](../chats/peek-prompt.md)
- [Łączenie z dostawcą AI](../connections/connecting-to-a-provider.md)
