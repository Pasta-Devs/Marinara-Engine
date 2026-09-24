# Prompty warunkowe ({{#if}})

Z tego przewodnika dowiesz się, jak używać bloków `{{#if}}` w aplikacji Marinara Engine. Blok warunkowy dołącza fragment promptu (tekstu, który Marinara wysyła do AI) tylko wtedy, gdy jakaś wartość pasuje do ustalonej reguły. Warunki są częścią systemu makr, więc działają wszędzie tam, gdzie działają makra: w kartach postaci, personach, wpisach lorebooków i presetach promptów.

## Do czego służą prompty warunkowe

Makro to symbol zastępczy w podwójnych klamrach, np. `{{double-brace}}`, który Marinara Engine zamienia na aktualną wartość podczas budowania promptu. Blok warunkowy idzie o krok dalej. Sprawdza wartość, zostawia jeden fragment tekstu, a resztę wyrzuca.

Zapisujesz warunek, tekst na wypadek jego spełnienia i opcjonalnie tekst na wypadek niespełnienia. Marinara odczytuje warunek przy każdym budowaniu promptu. Dzięki temu ta sama karta postaci czy ten sam preset zachowuje się inaczej przy różnych postaciach, personach i czatach.

Częste zastosowanie to instrukcje przypisane do konkretnej postaci wewnątrz jednego wspólnego presetu. Drugie częste zastosowanie to dołączanie pola tylko wtedy, gdy coś w nim jest – tak, żeby do modelu nie trafiła pusta etykieta.

## Podstawowa składnia

Blok warunkowy zaczyna się od `{{#if condition}}`, a kończy na `{{/if}}`. Wszystko pomiędzy to tekst używany przy spełnionym warunku.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

Dla przypadku niespełnionego warunku dodaj gałąź `{{else}}`:

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

Kolejne warunki dopisuje się przez `{{else if}}`. Marinara sprawdza gałęzie po kolei, od góry do dołu. Zostawia pierwszą gałąź ze spełnionym warunkiem, rozwija makra w jej wnętrzu i odrzuca wszystkie pozostałe gałęzie. Jeśli żaden warunek nie jest spełniony i nie ma gałęzi `{{else}}`, cały blok znika bez śladu.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Blok możesz rozpisać na kilka linii, jak wyżej, albo zmieścić w jednej. Jeden warunek da się też zagnieździć w gałęzi innego, większego warunku.

## Obsługiwane operatory

Warunek to zwykle wartość po lewej, operator i wartość po prawej, na przykład `char == "Alice"`. Poniższa tabela wymienia wszystkie dostępne operatory. Każdy zapisano stylem kodu.

| Operator | Znaczenie |
| --- | --- |
| `==`, `=`, `is` | Równe. |
| `!=`, `is not` | Różne. |
| `>` | Większe niż (tylko liczby). |
| `<` | Mniejsze niż (tylko liczby). |
| `>=` | Większe lub równe (tylko liczby). |
| `<=` | Mniejsze lub równe (tylko liczby). |
| `contains`, `includes` | Wartość po lewej zawiera wartość po prawej jako tekst. |
| `not contains`, `not includes` | Wartość po lewej nie zawiera wartości po prawej. |

Porównywaniem rządzi kilka reguł:

1. Przy `==`, `=`, `is`, `!=` i `is not` Marinara porównuje obie strony jak liczby, o ile obie wyglądają na liczby. Dlatego `5` równa się `5.0`. W przeciwnym razie porównuje je jak tekst, bez rozróżniania wielkich i małych liter. Dlatego `Mari` równa się `mari`.
2. Przy `>`, `<`, `>=` i `<=` obie strony muszą być liczbami. Jeśli którakolwiek liczbą nie jest, warunek nie jest spełniony.
3. Przy `contains`, `includes`, `not contains` i `not includes` wielkość liter nie ma znaczenia. Dlatego `contains "dr"` pasuje do tekstu `Dr Smith`.

## Łączenie warunków przez OR i AND

Użyj `||`, kiedy wystarczy dopasowanie któregokolwiek warunku. Użyj `&&`, kiedy pasować musi każdy warunek.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` liczy się przed `||`. Dodaj nawiasy, żeby wprost narzucić kolejność:

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Przy kilku możliwych wartościach tej samej rzeczy powtórzoną lewą stronę po `||` da się pominąć:

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

Ten skrót znaczy tyle co `character == "Maukie" || character == "Pantalone"`. Działa z operatorami równości `==`, `=` i `is`. Po obu stronach `&&` zapisuj pełne warunki, bo jedna wartość rzadko kiedy równa się dwóm różnym rzeczom naraz.

### Sprawdzenie prawdziwości (bez operatora)

Warunek bez operatora oznacza dla aplikacji Marinara Engine sprawdzenie prawdziwości. Pada wtedy proste pytanie: czy ta wartość zawiera cokolwiek konkretnego?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

Sprawdzenie prawdziwości wypada pozytywnie, gdy wartość nie jest pusta i nie jest jednym z tych słów: `false`, `0`, `no`, `off`, `null` lub `undefined`. Wielkość liter w tych słowach nie ma znaczenia. Sięgaj po sprawdzenie prawdziwości wtedy, gdy tekst ma trafić do promptu tylko przy wypełnionym polu.

### Co można porównywać

Po lewej lub prawej stronie warunku może stać dowolna z tych rzeczy:

1. Słowo kluczowe pola lub tożsamości, na przykład `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input` albo `model`. Odczytują one te same wartości co odpowiadające im makra. `group` wymienia pozostałe aktywne postacie czatu, z pominięciem tej, która właśnie odpowiada.
2. Wartość w cudzysłowie, na przykład `"Alice"`.
3. Nazwa zmiennej presetu, na przykład `length`. Zmienna presetu to nazwana wartość zdefiniowana w presecie promptu (**Prompt Preset**). Zobacz [Zmienne presetu](preset-variables.md).
4. Jawne odwołanie do zmiennej zapisane jako `var:name` albo `var.name`.
5. Inne makro – jego wartość rozwija się najpierw, a dopiero potem trafia do porównania.
6. Pytanie do modelu decyzyjnego, zapisane jako `decision:"..."` lub `decision_choice:"..."`. Zobacz [Pytanie modelu decyzyjnego](#asking-the-decision-model).

Gołe słowo, które nie jest słowem kluczowym, Marinara bierze za nazwę zmiennej. Jeśli zmienna o takiej nazwie nie istnieje, słowo zostaje potraktowane jako zwykły tekst. Cudzysłów przy stałych wartościach usuwa tę niejednoznaczność, więc w razie wątpliwości go dopisz.

## Zasady używania cudzysłowów

Stały fragment tekstu, z którym coś porównujesz, ujmij w cudzysłów. To znak dla aplikacji Marinara Engine, że chodzi o dosłowną wartość, a nie o słowo kluczowe czy zmienną.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

Możesz użyć prostego cudzysłowu podwójnego albo prostego apostrofu. Marinara przyjmuje też cudzysłowy drukarskie, ale proste są najbezpieczniejsze i zgodne ze wszystkimi przykładami w aplikacji. Wewnątrz wartości w cudzysłowie znak cudzysłowu poprzedza się ukośnikiem wstecznym, a `\n` oznacza przejście do nowej linii.

Wartość ze spacją, taką jak `"Dr Smith"`, zawsze ujmuj w cudzysłów. Kilka słów bez cudzysłowu Marinara czyta jako jedną nazwę zmiennej, a to prawie nigdy nie jest zamierzony efekt.

## Bloki grupowe dla wielu postaci

W czacie grupowym z dwiema postaciami lub większą ich liczbą blok grupowy powtarza ten sam tekst raz dla każdej postaci. Dzięki temu jeden blok opisuje wszystkie postacie w scenie.

Blok grupowy tworzy się tak: samotny znak `[` w osobnej linii, potem tekst, potem samotny znak `]` w osobnej linii. Wewnątrz musi znaleźć się makro postaci, na przykład `{{char}}` albo `{{description}}`, albo warunek oparty na postaci, na przykład `{{#if char == "Alice"}}`. Marinara powtarza wtedy blok raz na postać i za każdym razem rozwija makra postaci względem kolejnej z nich.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

W czacie grupowym z postaciami Alice i Bob blok wykonuje się dwa razy. Pierwsze przejście wstawia imię Alice i wybiera jej gałąź. Drugie wstawia imię Bob i wybiera jego gałąź. Poza blokiem grupowym makro postaci rozwija się wyłącznie względem bieżącej lub głównej postaci.

Bloki grupowe rozwijają się tylko w czacie z co najmniej dwiema postaciami. W czacie z jedną postacią linie `[` i `]` zostają zwykłym tekstem.

## Przykłady z omówieniem (przed i po)

Oto trzy pełne przykłady wraz z tym, co ostatecznie dostaje model.

Ton wypowiedzi zależny od postaci wewnątrz wspólnego presetu:

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Przy postaci o nazwie `Dottore` model dostaje `Speak in a cold, clinical tone.` Przy każdej innej postaci dostaje `Speak warmly and casually.`

Dołączenie pola tylko wtedy, gdy jest wypełnione:

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Jeśli postać ma wypełnione pole **Backstory** (historia postaci), model dostaje tę linię razem z treścią historii. Jeśli pole **Backstory** jest puste, cały blok znika bez śladu, więc pusta etykieta nigdzie nie trafia.

Dopasowanie fragmentu nazwy użytkownika:

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

Jeśli nazwa persony zawiera `Dr`, model dostaje polecenie, żeby zwracać się do ciebie per doktorze. W przeciwnym razie blok znika bez śladu.


<a id="asking-the-decision-model"></a>

## Pytanie modelu decyzyjnego

Warunek może też zapytać **Decision model** (model decyzyjny) o to, co dzieje się na czacie. Jest to model wybrany w **Decision model** w panelu Connections: już uruchomiony model lokalny, zdalne połączenie Decision lub zainstalowany model decyzyjny. Czyta kilka ostatnich wiadomości i napisane przez ciebie stwierdzenie, po czym ocenia jego prawdziwość. Nigdy nie pisze niczego na czacie. [Modele decyzyjne](../connections/decision-models.md) wyjaśniają tę funkcję i wybór modelu.

Dzięki temu preset, karta, wpis lorebooka lub prompt agenta wysyła instrukcję tylko w pasujących turach zamiast powtarzać "jeśli nastąpi X, zrób Y" w każdej turze. Aby sterować aktywacją całego wpisu lorebooka zamiast przycinać jego tekst, użyj pola [Decision](../lorebooks/entries.md#decision-activation) wpisu. Kilka pomysłów:

- **Zmiana sceny.** Opisz nowe miejsce lub przeskok w czasie tylko wtedy, gdy scena rzeczywiście się zmieniła.
- **Rodzaje scen.** Dołącz zasady tempa walki, intymności lub napięcia tylko podczas takiej sceny.
- **Najpierw odpowiedź na pytanie.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Nastroje karty.** Karta postaci może zawierać zachowanie "przy zakłopotaniu" lub "przy złości", które pojawia się tylko wtedy, gdy ostatnie wiadomości to pokazują.
- **Ograniczanie tempa.** Preset powolnego rozwoju relacji może wstrzymać instrukcje eskalacji, dopóki relacja wyraźnie się nie rozwinie.
- **Sceny grupowe.** W bloku grupowym `{{#if decision:"{{char}} is addressed in the latest message"}}` nakazuje bezpośrednią odpowiedź tylko sekcji postaci, do której się zwrócono.

### Tak lub nie: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Warunek jest prawdziwy, gdy model decyzyjny uzna stwierdzenie za prawdziwe. Działa ze wszystkimi elementami tego przewodnika: `{{else}}`, `{{else if}}`, `&&`, `||`, nawiasami, zagnieżdżaniem i blokami grupowymi.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

Makra w stwierdzeniu są rozwijane wcześniej, więc `{{user}}` i `{{char}}` działają. W bloku grupowym stwierdzenie z `{{char}}` jest zadawane osobno dla każdej postaci.

### Jedna z kilku odpowiedzi: `decision_choice:`

`decision_choice:` prosi model decyzyjny o wybór jednej opcji. Opcjami są wartości, z którymi porównujesz wynik w dowolnym miejscu promptu:

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Tutaj model wybiera między "angry", "sad" i "none of these". Działa też krótka forma: `decision_choice:"The weather in the latest message" == "rain" || "snow"` udostępnia obie opcje. Napisz stwierdzenie jako temat, na przykład "Kaelen's mood in the latest message", a opcje jako krótkie odpowiedzi.

<a id="sticky-and-cooldown"></a>

### Sticky i cooldown

Stwierdzenie może zachować odpowiedź przez kilka tur zamiast być zadawane za każdym razem. Dopisz `sticky:` i `cooldown:` po stwierdzeniu:

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** Po odpowiedzi tak stwierdzenie pozostaje prawdziwe przez następne N tur bez pytania, więc sterowana przez nie treść pozostaje w prompcie.
- **cooldown:N.** Zaczyna się po zakończeniu sticky albo zaraz po tak, jeśli nie ma sticky. Przez N tur stwierdzenie oznacza nie i nie jest zadawane. Potem jest zadawane ponownie.
- Tura to każda nowa wiadomość czytana przez model decyzyjny. Regeneracja lub swipe tej samej wiadomości to ta sama tura, więc ponowne losowanie odpowiedzi nie skraca licznika.
- Gdy sticky lub cooldown zatrzymuje stan stwierdzenia, nie jest ono zadawane i nie liczy się do **Decision statements per turn** (stwierdzenia decyzyjne na turę), zostawiając miejsce innemu.
- Dla `decision_choice:` sticky zachowuje wybraną opcję, a cooldown traktuje każde porównanie jako nie. Wybór żadnej opcji niczego nie uruchamia.
- Stwierdzenie zapisane w kilku miejscach używa najdłuższego sticky i cooldown podanego gdziekolwiek.
- Peek Prompt pokazuje zachowaną odpowiedź i nigdy nie przesuwa licznika.

Razem pasują do treści, która powinna pojawić się raz, a potem odpocząć: przejścia sceny, jednorazowego przypomnienia albo nastroju trwającego kilka tur. Dla wpisu lorebooka aktywowanego przez **Decision** (decyzja) użyj własnych **Sticky** (utrzymanie aktywności) i **Cooldown** (przerwa) wpisu: wpis sticky pozostaje bez ponownego pytania, a wpis w okresie cooldown nie jest sprawdzany.

<a id="checking-every-few-turns"></a>

### Sprawdzanie co kilka tur

Niektórych stwierdzeń nie trzeba sprawdzać w każdej turze. Dopisz `every:` po stwierdzeniu, żeby pytać tylko co N tur:

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Pytanie pada w pierwszej turze, w której aplikacja do niego dociera, następnie 3 tury później i tak dalej.
- Zmiana liczby działa od razu: kolejne sprawdzenie liczy się od ostatniej tury, w której zadano pytanie.
- Między sprawdzeniami wynik oznacza nie, pytanie nie pada i nie liczy się do **Decision statements per turn**.
- Tury liczą się tak samo jak w sticky i cooldown, więc regeneracja lub swipe nie przesuwa harmonogramu. Ponowne użycie odpowiedzi podlega [zasadom pamięci podręcznej odpowiedzi](#answer-reuse).
- Sticky i cooldown nadal utrzymują odpowiedź; `every:` decyduje tylko, kiedy pytać o stwierdzenie, którego nie zatrzymują.
- Stwierdzenie zapisane w kilku miejscach używa najmniejszego `every:` podanego gdziekolwiek.

<a id="priority"></a>

### Priorytet

Gdy plan promptu zawiera więcej stwierdzeń niż limit **Decision statements per turn**, `priority:` wybiera, które zostaną zadane. Limit stosuje się na [kilku etapach](#statement-allowance):

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Stwierdzenia `priority:high` są zadawane pierwsze, a `priority:low` ostatnie. Bez priorytetu obowiązuje poziom średni.
- Przy jednakowym priorytecie nadal decyduje kolejność wystąpienia w prompcie.
- Po przekroczeniu limitu najpierw odpadają stwierdzenia o najniższym priorytecie: oznaczają nie i są wymieniane przez Peek Prompt.
- Stwierdzenie zapisane w kilku miejscach używa najwyższego priorytetu podanego gdziekolwiek.
- Najpierw planowane są własne stwierdzenia promptu: preset, karty, persona i notatki autora. Stwierdzenia w treści lorebooków są planowane po ustaleniu aktywnych wpisów, w pozostałych miejscach. Stwierdzenie lorebooka nigdy nie zabiera więc miejsca stwierdzeniu promptu, niezależnie od priorytetu.

Wszystkie modyfikatory można łączyć w dowolnej kolejności: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Brak odpowiedzi oznacza nie

Warunek decyzyjny jest **fałszywy**, gdy nie ma odpowiedzi: model decyzyjny nie został wybrany, nie odpowiedział na czas albo zawiódł. Dla `decision_choice:` każde porównanie jest fałszywe. Użytkownik bez modelu decyzyjnego otrzymuje więc gałąź `{{else}}` albo nic.

Uwzględnij to w projekcie:

- Używaj decyzji do **dodawania lub przycinania wskazówek**, nigdy do treści niezbędnej dla historii. Pominięta gałąź powinna uczynić odpowiedź trochę mniej dopasowaną, a nie ją zepsuć.
- Daj każdemu blokowi rozsądną wartość domyślną: nic albo `{{else}}` pasujące do każdej tury.
- Nie łącz decyzji tak, by jedna błędna odpowiedź zmieniała kilka innych.
- Nie uzależniaj zgody, ostrzeżeń o treści ani instrukcji bezpieczeństwa od decyzji. Zachowaj je zawsze.

Każdy model może się mylić. Pisz dla "modelu decyzyjnego", nigdy "wymaga Jev": lokalny model czatu też może oceniać te stwierdzenia. Składnia jest wspólna, ale odpowiedzi i dokładność modeli mogą się różnić.

<a id="writing-statements"></a>

### Pisanie stwierdzeń

Te wskazówki pochodzą z testów lokalnego modelu czatu oraz Open-Jev 2B i 9B:

- **Stwierdź fakt, który jest prawdziwy albo fałszywy**, jak w raporcie. Nie pytanie ("Did the scene change?") ani instrukcję ("If the scene changed, describe it"). Lokalny model czatu zawsze odpowiadał nie na instrukcję, więc blok nigdy się nie uruchamiał.
- **Napisz "in the latest message"**, gdy chodzi o bieżącą turę. Model czyta kilka wiadomości i na "Mira asks questions" odpowiedział tak, ponieważ pytanie było we wcześniejszej wiadomości.
- **Wskaż, o kogo chodzi.** "He is angry" zostało przypisane niewłaściwej postaci.
- **Opisz coś widocznego w tekście**, działanie lub wypowiedź, zamiast nastroju wymagającego interpretacji ("The scene is intense") albo ukrytej intencji ("Mira is lying").
- Pisz krótko. Zwykłe "and" lub przeczenie działało poprawnie w testach, więc wybierz naturalne sformułowanie.

Jak sprawdzić sformułowanie:

1. Wybierz model w **Decision model** i kliknij **Test** (test). To sprawdza połączenie na stałym przykładzie, a nie twoje stwierdzenie ani bieżący czat.
2. Dodaj stwierdzenie do promptu i wyślij reprezentatywne wiadomości: takie, dla których powinno być prawdziwe, i takie, dla których powinno być fałszywe.
3. Użyj **Peek Prompt** (podgląd promptu), żeby sprawdzić wysłaną gałąź. Jeśli potrzebujesz prawdopodobieństwa i wyniku tak/nie, włącz [logowanie debug](../CONFIGURATION.md#logging-levels).
4. Popraw sformułowanie i sprawdź ponownie. Do nowego przypadku użyj nowych wiadomości lub zmień stwierdzenie: udane odpowiedzi mogą być [używane ponownie](#answer-reuse). Otwarcie świeżego podglądu Peek Prompt nie pyta modelu.

Wyniki testów. Każde sformułowanie sprawdzono na czterech oznaczonych turach roleplay (dwie z oczekiwanym tak, dwie z nie) w Open-Jev 2B, Open-Jev 9B i lokalnym Gemma 4 E4B. To mała próbka jednej sceny, a nie ogólny test dokładności ani test zdalnego Jev. Tabela zapisuje obserwacje z próbki; nie obiecuje tych samych wyników dla innego modelu lub czatu.

| Pisz | Unikaj | Co się stało przy sformułowaniu do unikania |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change?  Pytanie przesunęło tury "nie" Open-Jev 2B ponad próg. Nie wpłynęło na model lokalny. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense.  Wszystkie trzy uznały gorącą kłótnię za "intense". Przy niejasnym słowie znaczenie wybiera model, nie ty. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions.  Model lokalny i Open-Jev 9B odpowiedziały tak, gdy najnowsza wiadomość Miry nie zawierała pytania, ponieważ wcześniejsza je zawierała. |
| Kaelen is angry in the latest message. | He is angry.  Model lokalny odczytał "he" jako rozzłoszczonego karczmarza. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying.  Żaden model nie uznawał sprzeczności za kłamstwo w wiarygodny sposób. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences.  Model lokalny zawsze odpowiadał nie na instrukcję, więc blok nigdy się nie uruchamiał. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive.  Obsłużone poprawnie. Rozdzielenie nadal ułatwia ponowne użycie i debugowanie. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room.  Bez różnicy. Wybierz naturalne sformułowanie. |

Zalecane sformułowania uzyskały 31 z 32 w Open-Jev 2B, 31 z 32 w Open-Jev 9B i 32 z 32 w modelu lokalnym. Sformułowania do unikania uzyskały 26, 25 i 24. Te wyniki z małej próbki ilustrują wybór słów; dobieraj model do swoich czatów na własnych przypadkach.

<a id="limits-and-cost"></a>

### Limity i koszty

<a id="statement-allowance"></a>

#### Limit stwierdzeń

**Decision statements per turn** w **Decision model** ma domyślną wartość 32. Mimo nazwy nie jest jednym globalnym limitem wszystkich żądań Decision ani wydatków. Marinara stosuje go etapami:

1. Stwierdzenia głównego promptu czatu są planowane w ramach limitu. Decyzje lorebooka wykorzystują to, co pozostawi ten plan.
2. Dla agentów działających przed odpowiedzią lub obok niej Marinara tworzy wspólny plan stwierdzeń głównego promptu i promptów tych agentów, ponownie stosując skonfigurowany limit. Ten etap nie odejmuje wcześniejszego użycia przez lorebook, więc suma może przekroczyć ustawienie.
3. Agenci przetwarzania końcowego otrzymują osobny limit po odpowiedzi. Ich stwierdzenia czytają ukończoną odpowiedź.

**Pytania aktywacyjne** agentów i **Smart response order** (inteligentna kolejność odpowiedzi) są oddzielne od tego ustawienia.

Do planu wchodzą tylko stwierdzenia dostępne na bieżącym etapie: włączone sekcje i grupy presetu, wybrane opcje zmiennych i treść aktywowanych wpisów lorebooka. Stały warunek może wykluczyć stwierdzenie: `{{#if char == "Dottore" && decision:"..."}}` nie jest zadawane dla postaci Mira. Zmienne mogą zmienić się podczas budowania promptu, więc warunek zmiennej nie wyklucza stwierdzenia z wyprzedzeniem.

Stwierdzenie utrzymywane przez [sticky, cooldown](#sticky-and-cooldown) lub [`every:`](#checking-every-few-turns) nie zajmuje miejsca. [Priorytet](#priority) wybiera stwierdzenia mieszczące się w planie promptu. Aktywacja lorebooka wykorzystuje pozostały limit przy rozważaniu wpisów. Pominięte stwierdzenia oznaczają nie, a Peek Prompt je wymienia.

#### Żądania i czas

Jedna tura może wysłać kilka płatnych żądań przez zdalne połączenie Decision. Stwierdzenia można grupować, ale aktywacja lorebooka, treść nowych aktywnych wpisów, dopasowania rekurencyjne i fazy agentów mogą wymagać kolejnych grup. Pytania aktywacyjne są grupowane według Scan Depth i fazy; Smart order wysyła własne żądanie. Limit stwierdzeń nie ogranicza liczby żądań ani kwoty.

Lokalny model czatu dodaje czas przetwarzania zamiast zdalnych opłat. Odpowiada na `decision_choice:` osobnym pytaniem tak/nie dla każdej opcji, więc pojedynczy wybór może wymagać kilku generowań.

Każde żądanie ma [limit czasu](../connections/decision-models.md#time-limits): domyślnie 1,5 sekundy dla połączenia Decision lub limit lokalnego backendu. Kilka żądań może wydłużyć łączne oczekiwanie. Lokalny model wymagający rozumowania wstrzymuje się przed odpowiedzią, chyba że włączysz **Also gate agents that run before the reply** (sprawdzaj także agentów działających przed odpowiedzią).

<a id="answer-reuse"></a>

#### Ponowne używanie odpowiedzi

Udane odpowiedzi są zwykle używane ponownie dla tej samej tury i modelu decyzyjnego, więc regeneracja często wysyła te same gałęzie bez kolejnego żądania. Pamięć podręczna działa w uruchomionym serwerze i mieści do 200 kluczy tur. Restart lub usunięcie wpisu z pamięci podręcznej może wywołać kolejne żądanie. Nowa lub zmieniona najnowsza wiadomość, inny model, zmiana stwierdzenia lub zestawu opcji wyboru także mogą wymagać nowej odpowiedzi.

Brakujące lub nieudane odpowiedzi nie są zapisywane jako udane nie: ponowienie tej samej tury może zapytać znowu i wybrać inną gałąź. Liczniki sticky/cooldown są niezależne od tej pamięci odpowiedzi.

Stwierdzenia promptów agentów stosują te same zasady. Agenci wcześniejsi/równolegli czytają turę sprzed odpowiedzi; końcowi czytają ukończoną odpowiedź, więc zmieniony swipe może wymagać nowych odpowiedzi. Ręczne ponowienie agenta używa udanych odpowiedzi nadal zapisanych dla jego danych wejściowych. Zobacz [Stwierdzenia decyzyjne w prompcie agenta](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Pamięć podręczna promptu

**Pamięć podręczna promptu** dostawcy jest oddzielna od pamięci odpowiedzi Decision aplikacji Marinara. Może wykorzystać niezmieniony początek promptu wysyłanego do modelu czatu. Zmiana gałęzi decyzyjnej może uniemożliwić ponowne użycie od tego miejsca dalej; wcześniejszy niezmieniony początek nadal może się kwalifikować. Dokładny zakres i rozliczenia zależą od dostawcy, granic pamięci, minimalnej długości i czasu ważności.

**Umieszczaj zmienne bloki decyzyjne pod koniec promptu**, na przykład w instrukcjach po historii lub płytkiej notatce autora. Wczesna zmiana może zniweczyć większość oszczędności. Zachowaj decyzję blisko początku tylko wtedy, gdy odpowiedź rzadko się zmienia, a instrukcje tam pasują. Dotyczy to też opcji zmiennych presetu: ich tekst trafia wszędzie tam, gdzie występuje `{{name}}`.

Przy bezpośrednim połączeniu Anthropic z włączonym **Enable prompt caching** (włącz pamięć podręczną promptu) Marinara oznacza koniec promptu systemowego i wiadomość oddaloną o **Cache depth** (głębokość pamięci podręcznej) wiadomości od najnowszej (domyślnie 5). Zmiana przed historią może unieważnić granicę systemową i późniejszą historię, choć wcześniejszy zgodny początek może nadal być użyteczny. Zmiana po oznaczonej granicy historii może zachować ten początek. Zmiana między granicami może zachować początek systemowy, tracąc część historii z pamięci. Odczyty i zapisy pamięci mają różne ceny.

Minimalne długości i obsługiwane granice zależą od modelu i mogą się zmieniać. Szczegóły i rozliczenia sprawdź w aktualnym [przewodniku pamięci podręcznej Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) lub [przewodniku pamięci podręcznej OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Gdy gałąź decyzyjna nigdy się nie pojawia

Jeśli użytkownik zgłasza, że gałąź decyzyjna nigdy się nie pojawia, najbardziej prawdopodobne przyczyny w kolejności to:

1. **Nie wybrano modelu decyzyjnego.** Każdy warunek decyzyjny jest fałszywy w każdej turze. Edytor pokazuje ostrzeżenie pod używającym go polem.
2. **Model decyzyjny nie odpowiada.** Zdalne połączenie ma błędny klucz, brak środków lub limit żądań; model lokalny jest zatrzymany lub zbyt wolny; albo zainstalowany model decyzyjny nie wystartował.
3. **To model rozumujący**, który wstrzymuje się przed odpowiedzią.
4. **Zbyt wiele stwierdzeń na danym etapie planowania** przekracza jego limit.
5. **Odpowiada, ale poniżej progu.** Zwykle chodzi o sformułowanie albo model oceniający tę turę niżej, niż oczekujesz.

Zapytaj użytkownika o wybrany model decyzyjny i wynik **Test**. **Peek Prompt** pokazuje faktycznie wysłane gałęzie. Gdy musi zbudować nowy podgląd, wymienia stwierdzenia bez odpowiedzi, które znaczą tam nie. Przy poziomie logowania debug zapisuje każde stwierdzenie, odpowiedź i to, czy odczytano ją jako tak; zobacz [Poziomy logowania](../CONFIGURATION.md#logging-levels).

Problem rzadko leży w presecie. Jeśli tak jest, zwykle dotyczy sformułowania albo gałęzi zawierającej coś niezbędnego dla promptu.

## Powiązane przewodniki

- [Modele decyzyjne](../connections/decision-models.md)
- [Makra promptów](macros.md)
- [Zmienne presetu](preset-variables.md)
- [Czaty grupowe w trybach Conversation i Roleplay](../chats/group-chats.md)
